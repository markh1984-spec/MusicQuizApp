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
 * THE EDGE SAYS WHAT KIND OF PACK IT IS. THE BACKGROUND SAYS WHAT ERA.
 *
 * Changed on 15 August 2026: *"the accent colour at the bottom should be
 * defined by the type of pack it is, so quiz packs have a green highlight,
 * bingo has a purple highlight etc."*
 *
 * **That split is better than what it replaces, and worth naming so it is not
 * quietly merged again.** The edge was the pack's SUBJECT at full strength,
 * which made it a louder copy of the wash — two channels saying one thing.
 * Now they say two different things, and the shelf answers two questions at a
 * glance rather than one twice: *what kind of night is this* and *what era is
 * it from*.
 *
 * **On the BOTTOM, because that is the shape this app already uses** — an
 * ordinary button carries the account's colour on its bottom border and the
 * tab bar underlines the tab you are on. A stripe down the left was rendered
 * beside it and turned down for exactly that reason: nothing else in the app
 * does it, so it would be a second visual language for the same job.
 *
 * **ONE NOTED COLLISION, deliberately accepted rather than missed.** Green
 * already means *good, paying, makes something* in this app — it is on Write
 * it, on Import, and on the Playlist button that sits on a bingo pack card. A
 * green edge meaning "this is a quiz" gives green a second job. It is mild,
 * because a 3px edge is not a filled control and the two never appear on the
 * same element; if it ever reads muddy, teal is a one-line change here.
 *
 * **ADDING A KIND IS ONE LINE**, which is the point — *"when I add further
 * round types they can have new highlights"*. Keyed on the game kind, the same
 * string `LAUNCHERS` and the console's `TABS` already use.
 */
const KIND_EDGE = {
  quiz: '#2fe07a',
  bingo: '#a855f7',
};

/**
 * A pack whose kind is not on the list still gets an edge rather than losing
 * one — a new game type would otherwise ship with a card that looks broken
 * until somebody remembers this file.
 */
const KIND_EDGE_FALLBACK = 'rgba(255, 255, 255, 0.35)';

const EDGE_ALPHA = 0.85;

/** The bottom edge for a game kind — 'quiz', 'bingo', or whatever comes next. */
export function kindEdge(kind) {
  const hex = KIND_EDGE[String(kind || '').toLowerCase()];
  return hex ? rgba(hex, EDGE_ALPHA) : KIND_EDGE_FALLBACK;
}

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
  { id: 'metal', words: ['metal', 'thrash'], word: 'METAL', a: '#8e99ad', b: '#0c0c12', pattern: 'slash' },
  /*
   * ROCK BEATS INDIE, and it was checked rather than assumed: *"The 2000-2010
   * Pop, Indie and Rock Quiz"* reads ROCK even though the title says Indie
   * first. Asked on 15 August 2026 and left as it is — a fixed order is
   * predictable, and matching whichever word appears earliest in the title
   * costs more code for a case that comes up on one pack.
   *
   * If it is ever revisited: the argument for indie is that it is the more
   * specific of the two, since nearly everything here is rock in some sense.
   */
  { id: 'rock', words: ['rock', 'grunge'], word: 'ROCK', a: '#c33b2e', b: '#241016', pattern: 'slash' },
  { id: 'punk', words: ['punk', 'ska'], word: 'PUNK', a: '#e11d74', b: '#111014' },
  { id: 'indie', words: ['indie', 'britpop', 'alternative'], word: 'INDIE', a: '#2f9fb5', b: '#1b2f66' },
  // "R'n'B" comes out of `words()` as three separate letters, so the spaced
  // forms have to be listed too — the punctuation is stripped, which is what
  // makes "RnB" and "R'n'B" the same pack, and it is also what splits them.
  // DISCO BEFORE SOUL, because 'funk' is in the soul list and "Disco & Funk
  // Bingo" was coming out as SOUL — printing a word the title does not lead
  // with. Where two are both true, the more specific one should win, and a
  // pack that says Disco is a disco pack.
  { id: 'disco', words: ['disco', 'boogie'], word: 'DISCO', a: '#b552d8', b: '#5a1f7a', pattern: 'lines' },
  { id: 'soul', words: ['soul', 'motown', 'rnb', 'r n b', 'r and b', 'funk'], word: 'SOUL', a: '#c9862b', b: '#5a2352' },
  { id: 'dance', words: ['dance', 'house', 'rave', 'club', 'garage', 'techno'], word: 'DANCE', a: '#7a4dff', b: '#0f4f78' },
  { id: 'hiphop', words: ['hip hop', 'hiphop', 'rap', 'grime'], word: 'RAP', a: '#d1701f', b: '#2c1550' },
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
  { id: '1950s', test: /\b(1950s?|50s|fifties)\b/, word: '50s', a: '#d9603f', b: '#4a2a1c' },
  { id: '1960s', test: /\b(1960s?|60s|sixties)\b/, word: '60s', a: '#e08a2a', b: '#16665f' },
  { id: '1970s', test: /\b(1970s?|70s|seventies)\b/, word: '70s', a: '#c9932b', b: '#5c3018', pattern: 'lines' },
  { id: '1980s', test: /\b(1980s?|80s|eighties)\b/, word: '80s', a: '#f0369a', b: '#4b23b0', pattern: 'lines' },
  { id: '1990s', test: /\b(1990s?|90s|nineties)\b/, word: '90s', a: '#2ec7d9', b: '#3a2596' },
  { id: '2000s', test: /\b(2000s?|00s|noughties|2000\s*2010)\b/, word: '00s', a: '#2f7de0', b: '#16205a' },
  { id: '2010s', test: /\b(2010s?|10s|twenty tens)\b/, word: '10s', a: '#17b39c', b: '#1d3f66' },
  { id: '2020s', test: /\b(2020s?|20s)\b/, word: '20s', a: '#e0417f', b: '#20134f' },
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
 * WHAT A PACK SAYS ABOUT ITSELF: an era in big letters, and a wash behind it.
 *
 * @param {{title?: string, id?: string}} pack
 * @returns {{subject: string, word: string, a: string, b: string, pattern: string}}
 *   `subject` is '' when nothing was recognised — which is not a failure, it is
 *   the ordinary case for "The Madonna Quiz". `word` is what gets printed big:
 *   '80s', 'METAL', or '' when there is nothing short and true to say.
 */
export function packLook(pack) {
  const title = (pack && (pack.title || pack.id)) || '';
  const w = words(title);

  /*
   * "CHART" MEANS MIXED, so a genre word riding alongside it does not win.
   *
   * Found on a real pair: "The 2000s Pop Rnb and Chart Quiz" and "The 2000s
   * R'n'B Quiz" both printed SOUL on the same shelf — correctly, since Rnb IS
   * in the soul list, but the first title does not LEAD with it, it lists
   * three things and Rnb is one of them. The exact fault DISCO-before-SOUL
   * already exists to catch, on a title neither reordering nor a fixed
   * priority can fix, because there is no second genre word here to prefer
   * instead — "chart" and "pop" are not genre words at all, deliberately.
   * A title that announces itself as a MIX falls through to the decade,
   * which is what a various-genre pop/chart pack should say about itself.
   */
  const isChartMix = w.includes(' chart ');
  const subject = (isChartMix ? null : PACK_SUBJECTS.find((s) => s.words.some((word) => w.includes(` ${word} `))))
    || DECADES.find((d) => d.test.test(w));

  if (subject) {
    return {
      subject: subject.id,
      /*
       * NOT EVERY SUBJECT GETS A WORD, and the missing ones are deliberate.
       * Asked for as *"80s just has a big colourful 80s in the background"* —
       * and a decade is perfect for that because it is three characters. So is
       * a short genre. "CHRISTMAS" is nine and would either be unreadably
       * small or run off the card, and Christmas is the one subject whose
       * colours already say it outright. A word only earns the space if it is
       * short enough to be read at a glance, which is the whole point of
       * printing it big.
       */
      word: subject.word || '',
      a: rgba(subject.a, TINT.top),
      b: rgba(subject.b, TINT.bottom + 0.1),
      pattern: subject.pattern || 'none',
    };
  }

  // Nothing recognised: a colour of its own, so it still belongs on the shelf.
  const h = hueOf(title);
  return {
    subject: '',
    word: '',
    a: `hsla(${h}, 55%, 45%, ${TINT.top})`,
    b: `hsla(${(h + 34) % 360}, 50%, 26%, ${TINT.bottom + 0.1})`,
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
export function packLookAttrs(pack, kind) {
  const look = packLook(pack);
  return {
    cls: `tinted${look.pattern === 'none' ? '' : ` pk-${look.pattern}`}`,
    // The edge is the KIND, the wash is the subject — see the note on
    // KIND_EDGE. They are on one element and mean two different things, which
    // is exactly why they must not be generated in two different places.
    style: `--pk-a: ${look.a}; --pk-b: ${look.b}; --pk-edge: ${kindEdge(kind)}`,
    word: look.word,
    /*
     * Sized here rather than in the sheet, because the length varies and the
     * card does not: '80s' is three characters and 'DISCO' is five, and one
     * font size for both either wastes the card or runs off it. Three steps is
     * enough — nothing longer than five characters ever gets a word.
     */
    wordSize: look.word.length <= 3 ? 46 : (look.word.length === 4 ? 34 : 27),
  };
}

/**
 * WHAT THE CARD ALREADY SAYS, TAKEN BACK OFF THE TITLE.
 *
 * Asked for as *"is it possible to make it so the title doesn't go to two
 * lines half the time"* — and the answer turned out not to be smaller type.
 * Measured across twelve realistic packs, three fitted on one line before this
 * and twelve after, with the type getting BIGGER rather than smaller.
 *
 * **The card says what kind of pack it is three times over**: the bottom edge
 * is green for a quiz and purple for the bingo, the shelf is under a heading
 * that says which, and you are stood on the Music Quiz tab. So the word "Quiz"
 * in the title is the card telling you something it has already told you
 * twice, and it is what pushes half the shelf onto a second line.
 *
 * Off the front: a leading "The". Off the back: Quiz, Bingo, Music Quiz, Music
 * Bingo. *"The 1980s Pop Music Quiz"* becomes *"1980s Pop"*.
 *
 * **THIS IS WHAT IS DRAWN, NEVER WHAT IS STORED.** The pack file keeps its
 * real name, and so do the editor, the archive, the projector and — the one
 * that would actually bite — the SEARCH box, which looks inside titles. A pack
 * you could no longer find by typing "quiz" would be a worse fault than a
 * wrapped line. Nothing here writes anything.
 *
 * **It falls back to the full title when the trim empties it**, or a pack
 * somebody called "The Quiz" would draw a card with no name on it.
 */
export function shortTitle(title) {
  const full = String(title || '');
  const cut = full
    .replace(/^the\s+/i, '')
    .replace(/\s*(music\s+)?(quiz|bingo)\s*$/i, '')
    .trim();
  return cut || full;
}

/**
 * Which of three type sizes a title gets, by length.
 *
 * Three steps rather than measuring each card and fitting it exactly: a
 * per-card fit gives nine slightly different type sizes on one shelf, which
 * reads as sloppy rather than tidy. The same reasoning as `wordSize` above,
 * and the classes are in the sheet so the numbers live with the rest of the
 * type ladder.
 */
export function titleSize(text) {
  /*
   * THE THRESHOLDS ARE CALIBRATED TO THE REAL CARD, NOT A MOCK-UP — and the
   * first version was not, which is worth recording because the mistake looked
   * like success.
   *
   * They were set from a mock at 1100px with invented pack names, where twelve
   * of twelve fitted on one line. On the actual shelf the sidebar takes 190px,
   * so a card is 146px rather than 173 — and the host's real titles are longer
   * than the ones I made up ("2000-2010 Pop, Indie and Rock"). Measured in a
   * browser against his own library, four of six still wrapped and two were
   * being clipped with an ellipsis, which loses a word off the end of the name.
   *
   * **A design measured against invented content is measured against nothing.**
   */
  const n = String(text || '').length;
  return n <= 11 ? 't-s' : (n <= 17 ? 't-m' : 't-l');
}
