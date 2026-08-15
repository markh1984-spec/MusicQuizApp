/**
 * WHAT A PACK LOOKS LIKE, FROM WHAT IS IN IT.
 *
 * Asked for on 15 August 2026: *"can the packs have backgrounds that are
 * relative to the contents?"*
 *
 * ---
 *
 * **THE JOB IS SCANNING, NOT DECORATION.** The common job on a pack tab is
 * *find tonight's pack and press Launch* — and a shelf of nine identical cards
 * makes that a reading task, so you check nine titles to find the one you
 * already know the shape of. A colour you recognise turns it into a glance.
 * That is the whole justification; if it did not make the shelf faster to read
 * it would be clutter, which this app's rules say to leave out.
 *
 * **IT DERIVES, IT DOES NOT STORE.** Nothing is written into a pack file and
 * there is nothing to set — a pack that arrives from the generator, from
 * Import, or from a quizmaster's own editor is coloured the moment it appears.
 * A field somebody has to fill in would be a Monday job per pack, which is
 * exactly the kind of cost this app measures features by.
 *
 * **A SUBJECT IT KNOWS, OTHERWISE A COLOUR OF ITS OWN.** Christmas, metal, the
 * eighties — those get a look that means something. Everything else gets a
 * quiet colour derived from its name, so no card ever sits on the shelf looking
 * unfinished next to one that is dressed. That was the deciding difference
 * between two options put up side by side: recognising SOME packs and leaving
 * the rest plain reads as half-built.
 *
 * **AND IT NEVER SPEAKS THE APP'S OWN LANGUAGE.** Gold means winning, green
 * means good, red means destructive — everywhere, in every scheme, and a pack
 * about Christmas must not read as a pack that is broken. Two things keep that
 * true and both are load-bearing:
 *
 *  - the tint is a WASH BEHIND the card, never a fill and never a border, so
 *    `.pack-card.broken`'s red edge still reads as the only red that means
 *    anything;
 *  - every colour is capped well below full strength (see `TINT`), because a
 *    saturated card is a control that looks pressed.
 *
 * **NO NEW DEPENDENCY, NO ASSET, NOTHING FETCHED.** Two colours and, at most, a
 * repeating line pattern — drawn in CSS like the logo, the avatars and the
 * props are drawn. A picture per pack would be an image per pack to make, host
 * and pay for, on a shelf that is meant to load instantly in a dark pub.
 */

/**
 * How much of the colour actually lands. Kept low deliberately — see the note
 * above about the app's own colour language, and note that these sit on a
 * surface that is itself tinted with the quizmaster's scheme, so a strong wash
 * would fight the account's own colours rather than sitting inside them.
 */
const TINT = { top: 0.30, bottom: 0.16 };

/**
 * THE EDGE IS NEARLY SOLID, AND THAT IS THE POINT OF HAVING BOTH.
 *
 * The wash has to stay faint or it fights the words on top of it — which means
 * on a dark card the actual HUE is hard to name, and two packs whose colours
 * are close read as the same colour. Three pixels of the same colour at full
 * strength says it outright, in a place with no text over it.
 *
 * **On the BOTTOM, because that is the shape this app already uses** — an
 * ordinary button carries the account's colour on its bottom border and the
 * tab bar underlines the tab you are on. A stripe down the left was rendered
 * beside it and turned down for exactly that reason: nothing else in the app
 * does it, so it would be a second visual language for the same job.
 */
const EDGE_ALPHA = 0.85;

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * The subjects worth recognising, MOST SPECIFIC FIRST — the first match wins.
 *
 * Seasonal beats genre beats decade, and that order is doing real work rather
 * than being alphabetical: this library is decade-heavy, so if a decade won,
 * "The 2000s Metal Quiz" and "The 2000s Pop Rnb and Chart Quiz" would be the
 * same colour and the shelf would be no faster to read than it is now. Genre
 * is the axis that separates packs WITHIN a decade, so genre goes first.
 *
 * **"Pop" is deliberately not on this list.** Nearly every pack here is a pop
 * quiz of some kind, so matching it would colour most of the shelf one colour —
 * which is the failure this whole file exists to avoid. A word only earns a
 * place here if it tells two packs APART.
 *
 * Matched against the title with the punctuation taken out, so "R'n'B" and
 * "RnB" are the same word and "rock" does not match inside "Rocky".
 */
export const PACK_SUBJECTS = [
  // ---- seasonal: the loudest and the least ambiguous
  { id: 'christmas', words: ['christmas', 'xmas', 'festive', 'santa'], a: '#d8283c', b: '#127a46' },
  { id: 'halloween', words: ['halloween', 'spooky', 'horror'], a: '#e8720f', b: '#1a0b2e' },
  { id: 'valentines', words: ['valentine', 'valentines', 'love songs'], a: '#ff4d7d', b: '#8a1450' },

  // ---- genre: what separates two packs from the same decade
  { id: 'metal', words: ['metal', 'thrash'], a: '#8e99ad', b: '#0c0c12', pattern: 'slash' },
  { id: 'rock', words: ['rock', 'grunge'], a: '#c33b2e', b: '#241016', pattern: 'slash' },
  { id: 'punk', words: ['punk', 'ska'], a: '#e11d74', b: '#111014' },
  { id: 'indie', words: ['indie', 'britpop', 'alternative'], a: '#2f9fb5', b: '#1b2f66' },
  // "R'n'B" comes out of `words()` as three separate letters, so the spaced
  // forms have to be listed too — the punctuation is stripped, which is what
  // makes "RnB" and "R'n'B" the same pack, and it is also what splits them.
  { id: 'soul', words: ['soul', 'motown', 'rnb', 'r n b', 'r and b', 'funk'], a: '#c9862b', b: '#5a2352' },
  { id: 'disco', words: ['disco', 'boogie'], a: '#b552d8', b: '#5a1f7a', pattern: 'lines' },
  { id: 'dance', words: ['dance', 'house', 'rave', 'club', 'garage', 'techno'], a: '#7a4dff', b: '#0f4f78' },
  { id: 'hiphop', words: ['hip hop', 'hiphop', 'rap', 'grime'], a: '#d1701f', b: '#2c1550' },
  { id: 'country', words: ['country', 'western', 'folk'], a: '#b58a4a', b: '#274031' },
  { id: 'reggae', words: ['reggae', 'ska', 'dub'], a: '#3f9c4a', b: '#7a5c15' },
  { id: 'musicals', words: ['musical', 'musicals', 'showtunes', 'broadway', 'disney'], a: '#d94f9e', b: '#3b2d8f' },
];

/**
 * The decades, which are a regex rather than a word list — "1980s", "80s" and
 * "eighties" are the same pack, and a list would have to carry every spelling
 * of every decade.
 */
const DECADES = [
  { id: '1950s', test: /\b(1950s?|50s|fifties)\b/, a: '#d9603f', b: '#4a2a1c' },
  { id: '1960s', test: /\b(1960s?|60s|sixties)\b/, a: '#e08a2a', b: '#16665f' },
  { id: '1970s', test: /\b(1970s?|70s|seventies)\b/, a: '#c9932b', b: '#5c3018', pattern: 'lines' },
  { id: '1980s', test: /\b(1980s?|80s|eighties)\b/, a: '#f0369a', b: '#4b23b0', pattern: 'lines' },
  { id: '1990s', test: /\b(1990s?|90s|nineties)\b/, a: '#2ec7d9', b: '#3a2596' },
  { id: '2000s', test: /\b(2000s?|00s|noughties|2000\s*2010)\b/, a: '#2f7de0', b: '#16205a' },
  { id: '2010s', test: /\b(2010s?|10s|twenty tens)\b/, a: '#17b39c', b: '#1d3f66' },
  { id: '2020s', test: /\b(2020s?|20s)\b/, a: '#e0417f', b: '#20134f' },
];

/**
 * Punctuation out, spaces in — so "R'n'B", "RnB" and "R n B" all read the same,
 * and a word is matched at its boundaries rather than inside a longer one.
 */
function words(title) {
  return ` ${String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * A stable hue for anything unrecognised. FNV-1a, because it has to give the
 * same pack the same colour on every device and every reload — a shelf that
 * reshuffles its colours is worse than one with no colours at all, since the
 * whole value is recognising a card you have seen before.
 */
function hueOf(title) {
  let h = 2166136261;
  for (const ch of String(title || 'pack')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

/**
 * The two colours and the pattern for one pack.
 *
 * @param {{title?: string, id?: string}} pack
 * @returns {{subject: string, a: string, b: string, pattern: string}}
 *   `subject` is '' when nothing was recognised — which is not a failure, it is
 *   the ordinary case for "The Madonna Quiz".
 */
export function packLook(pack) {
  const title = (pack && (pack.title || pack.id)) || '';
  const w = words(title);

  const subject = PACK_SUBJECTS.find((s) => s.words.some((word) => w.includes(` ${word} `)))
    || DECADES.find((d) => d.test.test(w));

  if (subject) {
    return {
      subject: subject.id,
      a: rgba(subject.a, TINT.top),
      b: rgba(subject.b, TINT.bottom + 0.1),
      edge: rgba(subject.a, EDGE_ALPHA),
      pattern: subject.pattern || 'none',
    };
  }

  // Nothing recognised: a colour of its own, so it still belongs on the shelf.
  const h = hueOf(title);
  return {
    subject: '',
    a: `hsla(${h}, 55%, 45%, ${TINT.top})`,
    b: `hsla(${(h + 34) % 360}, 50%, 26%, ${TINT.bottom + 0.1})`,
    edge: `hsla(${h}, 62%, 58%, ${EDGE_ALPHA})`,
    pattern: 'none',
  };
}

/**
 * The classes and the inline custom properties, ready to drop into markup.
 *
 * Two call sites want exactly this — a pack card on the shelf and a pack tile
 * in Tonight — and both must produce the same colours, or a pack would change
 * appearance on being dragged into the slot it is supposed to match.
 *
 * The colours are INLINE rather than in the stylesheet because they are per
 * pack, and there is no build step here to generate a sheet from a library that
 * changes every week. The classes carry everything that is shared.
 *
 * @returns {{cls: string, style: string}} both already escaped-safe: every
 *   value is generated here from numbers, never from anything a human typed.
 */
export function packLookAttrs(pack) {
  const look = packLook(pack);
  return {
    cls: `tinted${look.pattern === 'none' ? '' : ` pk-${look.pattern}`}`,
    style: `--pk-a: ${look.a}; --pk-b: ${look.b}; --pk-edge: ${look.edge}`,
  };
}
