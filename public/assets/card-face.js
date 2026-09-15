/**
 * A PLAYING CARD, DRAWN — pips, indices and the three court cards.
 *
 * ---
 *
 * Asked for after Card Bingo shipped with the rank and suit as plain text:
 * *"would it be possible to actually draw the face cards?"*
 *
 * **SVG, LIKE THE BRANDMARK AND THE PHOTO PROPS, BECAUSE ONE DRAWING HAS TO
 * SERVE TWO SIZES THAT ARE A HUNDRED TIMES APART.** A hand card on a 390px
 * phone measures about 45px across; the same card on the projector's *"Just
 * played"* is most of a wall. A canvas would need a raster per size and would
 * be soft on one of them; a `viewBox` is exact at both, and `currentColor`
 * lets the red suits take their colour from the stylesheet rather than
 * carrying a second definition of what red means.
 *
 * **AND THE SUITS ARE PATHS RATHER THAN THE GLYPHS ♠♥♦♣, WHICH FIXES SOMETHING
 * THAT WAS ALREADY SHIPPED.** Those characters live in Miscellaneous Symbols,
 * and a phone is entitled to render them as EMOJI — a colour heart, and worse a
 * blue-and-orange diamond that is not a red suit at all. That is the rule this
 * app already sets for the bin icon, the seasonal shapes and the avatars:
 * **drawn, never emoji**, because some phones and some projectors render a
 * character as something else entirely and this one is six feet wide. The
 * engine still calls the card `7♥` — that is its NAME and nothing about the
 * payload changed — but nothing draws that string any more.
 *
 * **THE INDEX IS THE PART THAT IS READ, AND IT NEVER GIVES WAY TO THE ART.**
 * A real player reads the corner, not the picture; they fan a hand so only the
 * corners show. So the rank and the suit in the top-left are sized as a share
 * of the card and drawn first, and everything else is decoration that may
 * simplify. At 45px that is the difference between a hand you can scan against
 * *"seven of hearts"* and a row of pretty blobs.
 */

/** One pip, on a 0–100 box. Diamond is a polygon; the rest are curves. */
const SUIT_ART = {
  hearts: '<path d="M50 90C22 68 9 52 9 35a21 21 0 0 1 41-8 21 21 0 0 1 41 8c0 17-13 33-41 55Z"/>',
  diamonds: '<path d="M50 6 90 50 50 94 10 50Z"/>',
  spades: '<path d="M50 6c28 22 41 38 41 55a21 21 0 0 1-34 16c1 8 5 14 11 19H32c6-5 10-11 11-19a21 21 0 0 1-34-16C9 44 22 28 50 6Z"/>',
  clubs: '<circle cx="50" cy="26" r="19"/><circle cx="24" cy="60" r="19"/><circle cx="76" cy="60" r="19"/>'
    + '<path d="M44 58h12c0 18 3 29 9 38H35c6-9 9-20 9-38Z"/>',
};

/* A club and a spade need a stem; a club's three lobes are drawn above it. */
const STEM = {
  spades: '',
  clubs: '',
};

/**
 * Where the pips go, as fractions of the card.
 *
 * The standard Anglo-American layout, which is centuries old and belongs to
 * nobody — but the SHAPES above are drawn here rather than copied from any
 * modern deck, because this app is SOLD and a published deck's artwork is
 * somebody's copyright even when the arrangement is not.
 *
 * `x` is 0.5 for a centre column, 0.28/0.72 for the two outer ones. Anything
 * below the middle is drawn upside down, exactly as a real card does it.
 */
const COL = { L: 0.28, C: 0.5, R: 0.72 };
const ROW3 = [0.19, 0.5, 0.81];
const ROW4 = [0.19, 0.3833, 0.6167, 0.81];

const PIPS = {
  A: [[COL.C, 0.5]],
  2: [[COL.C, 0.19], [COL.C, 0.81]],
  3: [[COL.C, 0.19], [COL.C, 0.5], [COL.C, 0.81]],
  4: [[COL.L, 0.19], [COL.R, 0.19], [COL.L, 0.81], [COL.R, 0.81]],
  5: [[COL.L, 0.19], [COL.R, 0.19], [COL.C, 0.5], [COL.L, 0.81], [COL.R, 0.81]],
  6: [COL.L, COL.R].flatMap((x) => ROW3.map((y) => [x, y])),
  7: [...[COL.L, COL.R].flatMap((x) => ROW3.map((y) => [x, y])), [COL.C, 0.345]],
  8: [...[COL.L, COL.R].flatMap((x) => ROW3.map((y) => [x, y])), [COL.C, 0.345], [COL.C, 0.655]],
  9: [...[COL.L, COL.R].flatMap((x) => ROW4.map((y) => [x, y])), [COL.C, 0.5]],
  10: [...[COL.L, COL.R].flatMap((x) => ROW4.map((y) => [x, y])), [COL.C, 0.2867], [COL.C, 0.7133]],
};

/** Ace's single pip is large; the rest are read as a group. */
const PIP_SIZE = { A: 40, big: 17 };

const SUIT_OF = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };

/**
 * A court card, as a figure mirrored about the middle.
 *
 * **DELIBERATELY A DEVICE RATHER THAN A PORTRAIT, and that is the lesson the
 * pack cards already paid for** — *cartoon figures were tried and do not read*,
 * because at the real size a whole person is a blob. A court card here is half
 * of a 45px square: a Victorian king with a halberd would be forty pixels of
 * grey. So each one is a single strong silhouette — a crown, a tiara, a
 * jack's plumed cap — over a collar, mirrored the way a real court card is, and
 * it still says *picture card, this suit* from across a table.
 */
/**
 * THE COURT CARDS DO NOT GET A FIGURE, AND THAT WAS MEASURED RATHER THAN
 * ASSUMED.
 *
 * Asked for directly — *"would it be possible to actually draw the face
 * cards?"* — and the honest answer is in the renders. Three designs were drawn
 * at the REAL 45px a hand card gets on a 390px phone: a crowned figure over a
 * collar, then three deliberately different silhouettes, then a tilted cap with
 * a plume. **Every one came out as the same dome-and-bar blob**, the three
 * indistinguishable from each other and all of them reading as kitchenware. It
 * is the pack cards' lesson arriving again — *cartoon figures were tried and do
 * not read; at the real card size a whole person is a blob* — and the rule
 * there says not to re-propose them without new evidence. This is the evidence,
 * and it says no.
 *
 * So a Jack, Queen and King are drawn the way an Ace is: **one large suit pip,
 * under a rank letter big enough to read across a table.** That is also how
 * anybody actually reads a court card in a fanned hand — off the index, never
 * off the picture.
 *
 * **A real figure would work at the dealer's 120px and on the projector**, and
 * is the one place worth spending the drawing. It is deliberately not built
 * yet: a card that is a portrait on one screen and a letter on another is two
 * drawings to keep in step, and nobody has asked for the big one.
 */

/** Is this card one of the three that carry a figure? */
export const isCourt = (rank) => rank === 'J' || rank === 'Q' || rank === 'K';

/**
 * The card as an `<svg>` string.
 *
 * @param {string} title  the card's own name, e.g. `7♥` — the engine's `title`
 * @param {object} [opts]
 * @param {boolean} [opts.plain]  no border or ground, for drawing inside a
 *   square that already has its own (the phone's hand)
 */
export function cardFaceSvg(title = '', { plain = false } = {}) {
  const glyph = String(title).slice(-1);
  const rank = String(title).slice(0, -1);
  const suit = SUIT_OF[glyph];
  if (!suit || !rank) return '';

  const art = SUIT_ART[suit] + (STEM[suit] || '');
  const red = suit === 'hearts' || suit === 'diamonds';

  /* One pip, scaled and placed — and turned over below the middle. */
  const pip = (x, y, size) => {
    const s = size / 100;
    /*
     * ROTATED ABOUT ITS OWN CENTRE, WHICH IS `rotate(180)` AND NOT
     * `rotate(180 x y)`.
     *
     * The transform list has already translated the origin to the pip's place,
     * so naming a centre again rotates about that point measured in the NEW
     * local system — twice as far out, and the pip lands off the card. Every
     * pip below the middle silently disappeared: a seven drew four, a two drew
     * one, and nothing threw. Caught by rendering the whole deck and counting,
     * which is the only way it could have been.
     */
    const flip = y > 0.5 ? ' rotate(180)' : '';
    return `<g transform="translate(${x * 100} ${y * 140})${flip} scale(${s}) translate(-50 -50)">${art}</g>`;
  };

  /* A court card and an Ace are the same drawing: one big pip under the index. */
  const big = isCourt(rank) || rank === 'A';
  const middle = big
    ? pip(COL.C, 0.58, PIP_SIZE.A)
    : (PIPS[rank] || []).map(([x, y]) => pip(x, y, PIP_SIZE.big)).join('');

  /*
   * THE INDEX, AND IT IS THE BIGGEST THING ON THE CARD.
   *
   * Measured before it was changed: the first version put the rank in the
   * corner at a real 7px on a 45px hand card, where the plain text it replaced
   * had been 20px in the middle. Prettier and harder to read is the wrong
   * trade on the one screen somebody scans against *"seven of hearts"*.
   *
   * **AND THERE IS ONLY ONE, WHERE A REAL CARD HAS TWO.** The second, upside
   * down in the far corner, exists so a physical hand can be fanned from
   * either end — a screen has no other end, so it was thirteen little rotated
   * numbers of noise, and dropping it is what pays for the size of this one.
   */
  const index = `<text x="9" y="34" class="cf-rank" text-anchor="start">${rank}</text>`
    + `<g transform="translate(74 25) scale(0.26) translate(-50 -50)">${art}</g>`;

  const ground = plain ? '' : '<rect x="1" y="1" width="98" height="138" rx="9" class="cf-ground"/>';

  /*
   * `cf-plain` vs `cf-solid` is the whole reason the caller says which it
   * wants: on a phone the square already has a dark ground, so a black suit has
   * to be LIGHT; on the dealer's panel and the projector the card prints its
   * own white ground, so the same suit has to be DARK. One drawing, two
   * grounds, and the stylesheet decides rather than the caller passing colours.
   */
  return `<svg class="cardface ${red ? 'red' : 'black'} ${plain ? 'cf-plain' : 'cf-solid'}" viewBox="0 0 100 140"`
    + ` xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${rank} of ${suit}">`
    + `${ground}${index}${middle}</svg>`;
}
