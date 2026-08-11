/**
 * What the AI has actually cost, written down as it happens.
 *
 * This is the number the whole tier structure is built on, and until now it
 * existed nowhere. The rule that decides which tier a feature goes in is the
 * host's own — *anything that costs the owner money every time it is used is
 * not in Bronze* — and it was being applied from memory, against a bill that
 * arrives a month later with no idea which pack it was for.
 *
 * ---
 *
 * **It records what was SPENT, never an estimate of what might be.** The
 * console already estimates before you press a button ("4 to draw — about
 * 16p"), which is a different job: that one is a warning, this one is a
 * record. They use the same price table so the two cannot disagree, but a row
 * only ever lands here after a call has actually been made and paid for.
 *
 * **A failed call still costs.** Anthropic and OpenAI bill for tokens they
 * generated whether or not the reply parsed, so the ledger is written from the
 * usage the API reports rather than from whether the generation succeeded. A
 * checker batch that timed out is money spent, and a ledger that quietly left
 * it out would flatter every sum on the owner page.
 *
 * **Never fatal, ever.** A generation that died because the accounting failed
 * would be the tail wagging the dog — several minutes and real money lost to a
 * bookkeeping error. Every write here is wrapped, and the worst case is a
 * missing row.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * What the two suppliers charge, in PENCE.
 *
 * Deliberately on the high side, and rounded up rather than down. This number
 * decides what a subscription has to cover, so guessing low is the direction
 * that costs money — an under-estimate looks like a healthy margin right up
 * until the card statement.
 *
 * Kept here rather than read from an API because neither supplier publishes a
 * per-account rate you can query, and a hardcoded number that is written down
 * in one place and reviewed is better than one written out at four call sites.
 * **When a price changes, change it here and note the date** — old rows keep
 * the pence they were written with, so the history stays true to what was
 * actually billed.
 */
export const PRICES = {
  // Per 1,000 tokens. Checked against Anthropic's published rates, Aug 2026,
  // converted at $1 = 80p — which is the rate every row here already implied.
  claude: {
    // Opus 5 is $5/$25 per million. This row USED to say 1.2 and 6.0, which is
    // a $15/$75 model — three times the truth, on the one page whose whole job
    // is answering "what did the AI actually cost". Every Claude figure the
    // Money tab has ever shown was inflated by it, including the "£2 a topical
    // pack" that the tier arithmetic was sanity-checked against; the real
    // number is nearer 70p. Rows already written keep their stored pence, so
    // the history stays true to what was reported at the time — this only
    // affects what is written from here on.
    'claude-opus-5': { in: 0.4, out: 2.0 },
    'claude-sonnet-5': { in: 0.24, out: 1.2 },
    'claude-haiku-4-5-20251001': { in: 0.08, out: 0.4 },
    // Anything unrecognised is priced as the dearest model there is, so a new
    // model name can only ever make the sums look WORSE than they are. The
    // other way round is a bill nobody saw coming. That is Fable 5 at $10/$50.
    default: { in: 0.8, out: 4.0 },
  },
  /*
   * Per 1024x1024 image, PER SUPPLIER — because they are priced nothing like
   * each other and an average would misreport whichever one you are using.
   *
   * Google's three tiers are Imagen 4 Fast, Standard and Ultra, which line up
   * exactly with low / medium / high, so the quality control the console
   * already has needs no second meaning.
   */
  image: {
    google: { low: 2, medium: 4, high: 5 },
    openai: { low: 1, medium: 4, high: 14 },
  },
  /*
   * Cached input, as MULTIPLES of the model's ordinary input rate.
   *
   * Not a flat price, because the discount is proportional: a cache read is
   * about a tenth of what the same tokens cost cold, and a write costs a
   * quarter more than cold (the price of putting them there). Recording them
   * as ordinary input — which is what happens if you ignore these fields —
   * overstates a cached job by roughly ten times on the part that matters.
   */
  cache: { read: 0.1, write: 1.25 },
  /*
   * One web search, in pence. Published as $10 per 1,000, so 1p each at
   * parity and 0.8p at a rough exchange rate — rounded UP for the same reason
   * every price here is: the only safe direction to be wrong is dearer.
   */
  search: 0.8,
};

/**
 * @param {object} row
 * @param {number} [row.cacheRead]   input tokens served from the cache
 * @param {number} [row.cacheWrite]  input tokens written INTO the cache
 * @param {number} [row.searches]    web searches this call made
 *
 * `tokensIn` is the UNCACHED remainder only — the API reports the three
 * separately and they do not overlap. Adding them together and pricing the
 * total as ordinary input is the mistake this signature exists to prevent.
 */
export function claudePence({
  model = '', tokensIn = 0, tokensOut = 0, cacheRead = 0, cacheWrite = 0, searches = 0,
} = {}) {
  const rate = PRICES.claude[model] || PRICES.claude.default;
  const n = (v) => (Number(v) || 0) / 1000;
  return n(tokensIn) * rate.in
    + n(tokensOut) * rate.out
    + n(cacheRead) * rate.in * PRICES.cache.read
    + n(cacheWrite) * rate.in * PRICES.cache.write
    + (Number(searches) || 0) * PRICES.search;
}

/**
 * An unknown supplier is priced as the DEAREST one, same rule as an unknown
 * model: a row that reads high is a question, and a row that reads low is a
 * bill nobody saw coming.
 */
export function imagePrices(provider = '') {
  return PRICES.image[provider] || PRICES.image.openai;
}

export function imagePence({ provider = '', quality = 'medium', images = 1 } = {}) {
  const table = imagePrices(provider);
  const each = table[quality] ?? table.medium;
  return each * (Number(images) || 0);
}

/** Enough to answer "what did last year cost", small enough to keep in one file. */
const MAX_ROWS = 5000;

export class Spend {
  constructor(filePath, now = () => Date.now()) {
    this.filePath = filePath;
    this.tmpPath = filePath + '.tmp';
    this.now = now;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.rows = this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return Array.isArray(parsed.rows) ? parsed.rows : [];
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Never overwrite something unreadable — the same rule as the accounts,
        // the invoices and the suggestion box.
        console.error('[spend] could not read the ledger:', err.message);
        try { fs.renameSync(this.filePath, this.filePath + '.broken'); } catch { /* nothing useful */ }
      }
      return [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.tmpPath, JSON.stringify({ rows: this.rows }, null, 2) + '\n', 'utf8');
      fs.renameSync(this.tmpPath, this.filePath);
      return true;
    } catch (err) {
      console.error('[spend] could not save:', err.message);
      return false;
    }
  }

  serialise() {
    return JSON.stringify({ rows: this.rows }, null, 2) + '\n';
  }

  isEmpty() {
    return this.rows.length === 0;
  }

  /**
   * Only into an empty ledger, only at boot. Same rule as everything else that
   * comes back from the private repository — a disk with rows on it is ahead
   * of any backup, and reading one over the top would double-count or lose a
   * morning's generation depending on which way it went.
   */
  restore(serialised) {
    if (this.rows.length) return { ok: false, reason: 'already_have_some' };
    let parsed;
    try {
      parsed = JSON.parse(String(serialised));
    } catch (err) {
      return { ok: false, reason: 'unreadable', error: err.message };
    }
    if (!parsed || !Array.isArray(parsed.rows)) return { ok: false, reason: 'nothing_in_it' };
    this.rows = parsed.rows;
    this.save();
    return { ok: true, rows: this.rows.length };
  }

  /**
   * One line in the ledger.
   *
   * `pence` is worked out here and STORED, rather than computed from the token
   * counts whenever somebody looks. A price change would otherwise silently
   * rewrite what last year cost, and "what did I actually pay" is the one
   * question this file exists to answer.
   *
   * @param {object} row
   * @param {'claude'|'image'} row.kind
   * @param {string} row.what     "wrote a quiz", "checked a round", "a portrait"
   * @param {string} [row.packId] which pack it was for, so a cost has a subject
   */
  record({
    kind, what = '', packId = '', model = '', quality = '', provider = '',
    tokensIn = 0, tokensOut = 0, images = 0,
    cacheRead = 0, cacheWrite = 0, searches = 0,
  } = {}) {
    try {
      const pence = kind === 'image'
        ? imagePence({ provider, quality, images })
        : claudePence({ model, tokensIn, tokensOut, cacheRead, cacheWrite, searches });

      const row = {
        at: this.now(),
        kind: kind === 'image' ? 'image' : 'claude',
        what: String(what).slice(0, 80),
        packId: String(packId).slice(0, 80),
        ...(model ? { model } : {}),
        ...(provider ? { provider } : {}),
        ...(quality ? { quality } : {}),
        ...(tokensIn ? { tokensIn: Math.round(tokensIn) } : {}),
        ...(tokensOut ? { tokensOut: Math.round(tokensOut) } : {}),
        ...(cacheRead ? { cacheRead: Math.round(cacheRead) } : {}),
        ...(cacheWrite ? { cacheWrite: Math.round(cacheWrite) } : {}),
        ...(searches ? { searches } : {}),
        ...(images ? { images } : {}),
        // Kept to two decimal places of a penny. A single checker batch is
        // fractions of one, and rounding each row to a whole penny would turn
        // sixty of them into a number several times too big.
        pence: Math.round(pence * 100) / 100,
      };
      this.rows.push(row);
      while (this.rows.length > MAX_ROWS) this.rows.shift();
      this.save();
      return row;
    } catch (err) {
      // A generation must never die of a bookkeeping error.
      console.error('[spend] could not record:', err.message);
      return null;
    }
  }

  /**
   * What it has cost, in the shape the owner page reads.
   *
   * Three cuts, because they answer three different questions: the total is
   * "what is this costing me", by month is "is it going up", and by pack is
   * "what does one quiz cost to make" — which is the one that decides pricing.
   */
  summary({ months = 12, at = this.now() } = {}) {
    const since = at - months * 30 * 86400000;
    const recent = this.rows.filter((r) => (r.at || 0) >= since);

    const byMonth = new Map();
    const byPack = new Map();
    let claude = 0;
    let image = 0;
    let searches = 0;

    for (const row of recent) {
      const pence = Number(row.pence) || 0;
      searches += Number(row.searches) || 0;
      if (row.kind === 'image') image += pence; else claude += pence;

      const month = new Date(row.at || 0).toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + pence);

      if (row.packId) {
        const seen = byPack.get(row.packId) || { packId: row.packId, pence: 0, rows: 0 };
        seen.pence += pence;
        seen.rows++;
        byPack.set(row.packId, seen);
      }
    }

    const round = (n) => Math.round(n * 100) / 100;
    return {
      total: round(claude + image),
      claude: round(claude),
      image: round(image),
      rows: recent.length,
      // How much of the web was read. Worth its own number rather than being
      // folded into the Claude total: it is the one line that grows with how
      // TOPICAL the writing is rather than with how much of it there is.
      searches,
      // Newest month first, so the interesting one is not at the bottom.
      months: [...byMonth.entries()]
        .map(([month, pence]) => ({ month, pence: round(pence) }))
        .sort((a, b) => b.month.localeCompare(a.month)),
      // Dearest first — the point of this list is what to look at, not an index.
      packs: [...byPack.values()]
        .map((p) => ({ ...p, pence: round(p.pence) }))
        .sort((a, b) => b.pence - a.pence),
      // What a pack costs on average, which is the number a price is set from.
      perPack: byPack.size ? round((claude + image) / byPack.size) : 0,
    };
  }
}

/**
 * The thing a generator is handed.
 *
 * Generators take an `onSpend` callback rather than the ledger itself, so
 * nothing in `src/generate-*.js` has to know that a ledger exists, and every
 * test that calls one carries on working with no accounting at all. The server
 * is the only place the two are joined up.
 */
export function spendRecorder(ledger, { packId = '' } = {}) {
  if (!ledger) return () => {};
  return (row) => ledger.record({ packId, ...row });
}
