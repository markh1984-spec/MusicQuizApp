/**
 * WHICH PROPS PEOPLE ACTUALLY USE — two numbers each, and the second one is
 * what makes the first mean anything.
 *
 * Asked for directly: *"track which ones just don't get used, because if people
 * don't like those icons then they're bloat and they need to go, and then we
 * can replace them with other ones."* Right question — there are 67 props, 42
 * of them on an ordinary night, and a phone shows four above the fold.
 *
 * ---
 *
 * **A COUNT OF USES ON ITS OWN WOULD HAVE LIED, AND THE TRAY IS WHY.**
 *
 * The tray rotates, and it is weighted towards what gets used. So a count of
 * uses alone measures *how often a prop was OFFERED* at least as much as
 * whether anybody likes it — and it is a feedback loop: shown less, so used
 * less, so shown less again. Six weeks of that and the numbers say "delete
 * these thirty", when what they actually say is "these thirty were never on
 * screen". **A guard that answers confidently about something it is not
 * looking at** is this repo's most expensive recurring fault, and deleting
 * artwork on its say-so is an irreversible version of it.
 *
 * So both halves are counted, and **the verdict is a RATE — `used / shown`**.
 * A rate does not care how often something was offered, which is exactly what
 * makes the weighting safe to have at all.
 *
 * **IT IS A TALLY, NEVER A LOG.** Two integers per prop id and nothing else:
 * no player, no team, no night, no photograph. There is no row here that could
 * say what one person put on their face, which keeps this entirely out of the
 * consent question the photographs themselves live under.
 *
 * **AND IT IS GLOBAL RATHER THAN PER ROOM**, because the props are the OWNER'S
 * catalogue rather than anybody's content — the question is "should this
 * drawing exist", which is the same question whoever ran the night. A per-room
 * split would also make every individual number too small to read.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * How many times a prop has to have been SHOWN before its rate is worth
 * reading. Under this it is reported as "not enough yet" rather than as a
 * percentage — three impressions and no uses is not evidence of anything, and
 * a table that prints "0%" against it invites deleting a good drawing.
 *
 * A constant with a note rather than a setting, like the season length.
 */
export const ENOUGH_TO_JUDGE = 50;

/** Nothing outside this file decides what a sane id looks like. */
const okId = (id) => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id);

export class PropUse {
  constructor(file) {
    this.file = file;
    this.data = { props: {} };
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (raw && typeof raw === 'object' && raw.props) this.data = { props: raw.props };
    } catch {
      // No file yet, or an unreadable one. An empty tally is the honest start
      // and is never fatal — see the note in spend.js: bookkeeping must not be
      // able to break the thing it is keeping books on.
    }
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch {
      /* never fatal */
    }
  }

  /**
   * One photograph's worth: what the tray had on it, and what got stuck on.
   *
   * **`used` IS DEDUPLICATED AND `shown` IS TOO.** Somebody who puts three
   * pairs of googly eyes on one face likes googly eyes once, not three times —
   * counting placements would let one person with a sense of humour outvote a
   * room. The question is "did anybody reach for this", per photograph.
   *
   * **AND A USE IMPLIES A SHOW.** A prop reached for from a recently-used row
   * might not be in the rotated tray, and a rate over 100% is a table nobody
   * trusts.
   */
  record({ shown = [], used = [] } = {}) {
    const seen = new Set(shown.filter(okId));
    const took = new Set(used.filter(okId));
    for (const id of took) seen.add(id);
    if (!seen.size) return { shown: 0, used: 0 };

    for (const id of seen) {
      const row = this.data.props[id] || { shown: 0, used: 0 };
      row.shown += 1;
      if (took.has(id)) row.used += 1;
      this.data.props[id] = row;
    }
    this.save();
    return { shown: seen.size, used: took.size };
  }

  /** The raw tally, for the backup. */
  contents() {
    return JSON.stringify(this.data, null, 2);
  }

  /** Nothing counted yet, so a backup is worth restoring over it. */
  isEmpty() {
    return Object.keys(this.data.props).length === 0;
  }

  /**
   * Put a backup back, at boot on an empty disk.
   *
   * **IT TAKES `props` WHOLE rather than naming the two fields**, which is the
   * whitelist trap this repo has now recorded six times — a field added later
   * and not named here would be read back, dropped, and saved as dropped on
   * every deploy, in silence.
   */
  restore(json) {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || !parsed.props) return { ok: false, reason: 'not a tally' };
      this.data = { props: parsed.props };
      this.save();
      return { ok: true, props: Object.keys(this.data.props).length };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  /**
   * The tally as a table, worst first — which is the order somebody deleting
   * things wants to read it in.
   *
   * `rate` is null rather than 0 below the threshold: **null means "not
   * enough yet" and 0 means "offered plenty and nobody wanted it"**, and a
   * table that renders both as 0% is one that gets a good drawing deleted.
   *
   * @param {string[]} ids  every prop that exists, so one nobody has EVER been
   *   shown still appears — a prop missing from the tally is the most
   *   interesting row there is and would otherwise be the one row absent.
   */
  table(ids = []) {
    const rows = ids.map((id) => {
      const row = this.data.props[id] || { shown: 0, used: 0 };
      const enough = row.shown >= ENOUGH_TO_JUDGE;
      return {
        id,
        shown: row.shown,
        used: row.used,
        rate: enough ? row.used / row.shown : null,
        enough,
      };
    });
    /*
     * Worst first, but everything that cannot be judged yet goes to the BOTTOM
     * rather than to the top. Sorted naively, a brand new prop with 0 of 0
     * leads a list headed "delete these" — which is the opposite of true.
     */
    return rows.sort((a, b) => {
      if (a.enough !== b.enough) return a.enough ? -1 : 1;
      if (a.enough) return a.rate - b.rate;
      return b.shown - a.shown;
    });
  }

  /**
   * How often each prop gets reached for, as a weight for the tray.
   *
   * **A FLOOR, ALWAYS.** A prop nobody has used yet must still be showable, or
   * the loop this file exists to prevent closes anyway — and the floor is what
   * keeps `shown` climbing for the props whose rate is not yet trustworthy.
   * Everything is at least `MIN_WEIGHT`; a popular one is worth more, capped,
   * so one runaway favourite cannot fill the tray.
   */
  weights(ids = []) {
    const out = {};
    for (const id of ids) {
      const row = this.data.props[id] || { shown: 0, used: 0 };
      out[id] = row.shown >= ENOUGH_TO_JUDGE ? row.used / row.shown : null;
    }
    return out;
  }
}
