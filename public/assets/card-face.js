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

import { DECK } from './deck.js';

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

/*
 * THE PIP FIELD IS INSET BELOW THE INDEX, AND THAT IS WHY IT IS NOT CENTRED.
 *
 * The index is deliberately large — it is the part that gets read — and at the
 * classic layout the top-left pip sat straight underneath it: the rank and the
 * first pip overlapped on every card that has one there, on all four suits.
 * A real card avoids it by printing a SMALL index in the corner margin; this
 * one cannot, because a small index is unreadable at the 45px a hand card gets.
 *
 * So the pips give way instead. The field runs 0.30 to 0.84 rather than 0.19 to
 * 0.81, which puts its middle at 0.57 — everything below THAT is what turns
 * over, not everything below the card's own middle.
 */
const FIELD_MID = 0.57;
const ROW3 = [0.30, FIELD_MID, 0.84];
const ROW4 = [0.30, 0.48, 0.66, 0.84];

/**
 * Where the pips go, as fractions of the card.
 *
 * The standard Anglo-American arrangement, which is centuries old and belongs
 * to nobody — but the SHAPES are drawn in this file rather than copied from any
 * modern deck, because this app is SOLD and a published deck's artwork is
 * somebody's copyright even where the arrangement is not.
 */
const PIPS = {
  A: [[COL.C, FIELD_MID]],
  2: [[COL.C, 0.30], [COL.C, 0.84]],
  3: [[COL.C, 0.30], [COL.C, FIELD_MID], [COL.C, 0.84]],
  4: [[COL.L, 0.30], [COL.R, 0.30], [COL.L, 0.84], [COL.R, 0.84]],
  5: [[COL.L, 0.30], [COL.R, 0.30], [COL.C, FIELD_MID], [COL.L, 0.84], [COL.R, 0.84]],
  6: [COL.L, COL.R].flatMap((x) => ROW3.map((y) => [x, y])),
  7: [...[COL.L, COL.R].flatMap((x) => ROW3.map((y) => [x, y])), [COL.C, 0.435]],
  8: [...[COL.L, COL.R].flatMap((x) => ROW3.map((y) => [x, y])), [COL.C, 0.435], [COL.C, 0.705]],
  9: [...[COL.L, COL.R].flatMap((x) => ROW4.map((y) => [x, y])), [COL.C, FIELD_MID]],
  10: [...[COL.L, COL.R].flatMap((x) => ROW4.map((y) => [x, y])), [COL.C, 0.39], [COL.C, 0.75]],
};

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

/*
 * A DRAWN-IN PICTURE BEATS ANYTHING THIS FILE CAN DRAW, AND IT DROPS IN.
 *
 * *"I'll go to Nano Banana and I'll get that to draw it, and then I'll import
 * those in here for you to use in this system."* — which is the right way
 * round, and it is the SOUNDBOARD'S interface exactly, because that argument
 * has already been had once: **a file named after its id, and that is the
 * whole interface.** Drop `public/assets/cards/sj.png` in and the Jack of
 * Spades wears it; take it away and the drawn pip comes back. No list to edit,
 * no build step, and it works for all fifty-two rather than only the twelve
 * court cards — a seven of hearts with a picture on it needs no new code.
 *
 * **THE DRAWN ONE IS THE FALLBACK, NEVER DELETED**, for the sting's reason: a
 * missing file, a deploy that dropped the folder, a format a browser will not
 * decode. A card that draws NOTHING is a hand nobody can play, and this runs on
 * the projector where an exception is a blank screen in front of a room.
 *
 * **AND THE INDEX AND THE GROUND ARE NEVER GIVEN AWAY.** The rule at the top of
 * this file is that the corner is the part that is READ, and it was measured
 * three times getting there; an imported picture is exactly the thing that
 * would take it back, because an AI asked for "a Jack of Spades" draws its own
 * corner index at whatever size it likes and at 45px that is a smudge. So the
 * picture fills the MIDDLE — the field the pips would have used, clear of the
 * index — and the app goes on drawing the rank, the suit and the white ground
 * around it. One drawing per card, two channels for one fact, unchanged.
 *
 * **THE MANIFEST IS ASKED FOR, NOT PROBED.** Fifty-two speculative requests
 * that 404 is a lot of noise on a projector's network and the browser is
 * entitled to re-ask for every one of them; the server reads its own folder
 * once instead. `ensureCardArt()` is called from the three pages that draw
 * cards, at their LOBBY, so the answer has landed long before a card is turned
 * — the sting's *"fetched when the page is armed, not on the press"*.
 *
 * **A FAILURE HERE IS NOT AN ERROR.** An empty folder is the ordinary state of
 * this feature, not a fault, so nothing is logged and nothing is thrown.
 */

/** Which of the deck's own ids a title belongs to. One definition, in `deck.js`. */
const ID_OF = new Map(DECK.map((c) => [c.title, c.id]));
const REAL_ID = new Set(DECK.map((c) => c.id));

/*
 * WHERE A PICTURE GOES, ON THE 100x140 BOX.
 *
 * Clear of the index: the rank's glyph runs to y 35 and the corner suit pip to
 * y 36, so the field starts at 38 and stops 8 short of the bottom. `meet`
 * rather than `slice`, so a picture drawn at any shape is letterboxed inside
 * the card rather than cropped by it — **an imported file may not be trusted
 * to be the ratio it was asked for**, and a crop is how a King loses his head.
 */
const ART = { x: 8, y: 38, w: 84, h: 94 };

/*
 * AND A WHOLE CARD IS ITS OWN FOLDER — `cards/full/`.
 *
 * Asked for by sending one: a black card with a gold border and no corner
 * index, which is a CARD rather than a figure. Dropped into `cards/` it would
 * have drawn a black card inside the app's white one with two indices on it,
 * so the two are told apart by WHERE THEY SIT rather than by a suffix —
 * nothing to rename on the way in, and the folder's name is the explanation.
 *
 * **THE INDEX IS STILL THE APP'S, AND STILL ON TOP.** That is the whole reason
 * this file exists: at the 45px a hand card gets, a supplied card's own corner
 * index is a smudge, and the rank is the one thing somebody is scanning for.
 * A card beautiful at 200px and unreadable at 45 is a hand nobody can play.
 *
 * **A FULL CARD IS ASSUMED DARK**, so the index takes the same light treatment
 * the phone's own squares already use — no new colours, just `cf-plain`'s pair.
 * A pale supplied card would need its own decision, and nobody has one.
 *
 * **IT IS CLIPPED TO THE CARD'S OWN CORNERS.** A supplied file is a rectangle
 * with the rounded card drawn inside it, so whatever is in the four corners —
 * white, a checker, a shadow — would print as nubs outside the app's radius.
 * The clip means it cannot.
 *
 * **AND IT IS ALL FIFTY-TWO OR NONE.** Twelve black courts in a hand of
 * thirteen white cards reads as broken rather than as a theme. Nothing in the
 * code enforces that — it is a thing to know before generating twelve.
 */

/*
 * AND ONE SUPPLIED CARD DRESSES THE OTHER FIFTY-ONE — `themed()`.
 *
 * The whole-card path solved the wrong half on its own: one black card in a
 * hand of thirteen white ones reads as a card that failed to load, not as a
 * theme, which put "all fifty-two or none" in front of somebody who had drawn
 * twelve. But the forty numbers do not need DRAWING — the app already draws
 * them, correctly, with the pips where a seven is read off its pattern. What
 * they need is the same GROUND.
 *
 * So the moment any full card exists, every card without one takes a dark
 * ground and a gold edge and keeps its own pips. Twelve files, fifty-two cards.
 *
 * **DERIVED, NEVER A SETTING** — the rule the pack colours already follow. A
 * switch here would be a thing to remember on a Monday, and a deck that is
 * half dressed is exactly what it would cause.
 */

/** id -> `{ ext, full }`. `full` means it covers the whole card. */
const artFiles = new Map();
let artAsked = null;

/**
 * Pull in the list of pictures somebody has dropped in. Safe to call as often
 * as you like; every call after the first gets the first one's promise.
 */
export function ensureCardArt() {
  if (artAsked) return artAsked;
  artAsked = fetch('/api/card-art')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      // The id and the extension are both built from the server's own reading
      // of its own folder against `DECK`, so there is nothing here a caller
      // could have named — but the href is assembled from them rather than
      // sent whole, so the markup can never carry a string somebody chose.
      const take = (from, full) => Object.keys(from || {}).forEach((id) => {
        if (!REAL_ID.has(id)) return;
        artFiles.set(id, { ext: String(from[id]).replace(/[^a-z0-9]/gi, ''), full });
      });
      // A whole card wins over a middle for the same id: it is the more
      // deliberate of the two, and it is the one that names its own folder.
      take(j && j.art, false);
      take(j && j.full, true);
      return artFiles;
    })
    .catch(() => artFiles);
  return artAsked;
}

/** Has anybody supplied a whole card? Then the rest of the deck follows it. */
const themed = () => {
  for (const v of artFiles.values()) if (v && v.full) return true;
  return false;
};

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
    const flip = y > FIELD_MID ? ' rotate(180)' : '';
    return `<g transform="translate(${x * 100} ${y * 140})${flip} scale(${s}) translate(-50 -50)">${art}</g>`;
  };

  /* A court card and an Ace are the same drawing: one big pip under the index. */
  const big = isCourt(rank) || rank === 'A';
  const drawn = big
    ? pip(COL.C, FIELD_MID, PIP_SIZE.A)
    : (PIPS[rank] || []).map(([x, y]) => pip(x, y, PIP_SIZE.big)).join('');

  /*
   * A DROPPED-IN PICTURE INSTEAD OF THE PIPS, WHERE SOMEBODY HAS SUPPLIED ONE.
   *
   * `href` AND `xlink:href`, deliberately. The first is SVG 2 and is what every
   * current browser reads; the second is the SVG 1.1 spelling an older iPad
   * needs, and one of those is what a pub's spare projector laptop is. The
   * cost of getting it wrong is the middle of every card blank six feet wide,
   * which is a worse trade than one duplicated attribute.
   */
  const id = ID_OF.get(String(title)) || '';
  const supplied = artFiles.get(id);
  const href = supplied ? `/assets/cards/${supplied.full ? 'full/' : ''}${id}.${supplied.ext}` : '';
  const image = (x, y, w, h, fit) => `<image href="${href}" xlink:href="${href}"`
    + ` x="${x}" y="${y}" width="${w}" height="${h}"`
    + (fit ? ` preserveAspectRatio="${fit}"` : '')
    + (supplied && supplied.full ? ` clip-path="url(#cf-clip-${id})"` : '') + '/>';
  const middle = !href ? drawn
    /*
     * A WHOLE CARD IS `slice`, WHERE A MIDDLE IS `meet` — and the two are
     * opposite for the same reason. A figure letterboxed inside its field
     * loses space; a CARD letterboxed inside the card leaves a bar of the
     * app's own ground down one edge, which reads as the picture having
     * failed to load. The clip is what makes the overflow safe.
     */
    : supplied.full ? image(0, 0, 100, 140, 'xMidYMid slice')
    : image(ART.x, ART.y, ART.w, ART.h, 'xMidYMid meet');

  /*
   * THE INDEX, AND IT IS THE BIGGEST THING ON THE CARD.
   *
   * Measured, twice. The first version put the rank at a real 7px on a 45px
   * hand card, where the plain text it replaced had been 20px in the middle —
   * prettier and harder to read, which is the wrong trade on the one screen
   * somebody scans against *"seven of hearts"*.
   *
   * **It still lands around 16px, and that is a real loss against 20 — what
   * pays for it is the PIPS.** A seven is read off its pattern without the
   * corner being read at all, which is exactly why a real deck is quick to
   * fan: two channels for one fact. The plain text had only ever had one.
   * **Measure it after any change to the size or the field.**
   *
   * **AND THERE IS ONLY ONE, WHERE A REAL CARD HAS TWO.** The second, upside
   * down in the far corner, exists so a physical hand can be fanned from
   * either end — a screen has no other end, so it was thirteen little rotated
   * numbers of noise, and dropping it is what pays for the size of this one.
   */
  /*
   * `10` IS THE ONLY TWO-CHARACTER RANK AND IT GETS ITS OWN SIZE.
   *
   * At the single-digit size it ran straight into the suit pip beside it — on
   * all four tens, worst on the projector where the collision is a foot wide.
   * A real card prints its ten narrower for exactly this reason. Sized in the
   * stylesheet rather than here, so the two live beside each other.
   */
  const index = `<text x="8" y="35" class="cf-rank${rank.length > 1 ? ' two' : ''}" text-anchor="start">${rank}</text>`
    + `<g transform="translate(78 24) scale(0.24) translate(-50 -50)">${art}</g>`;

  /*
   * A SUPPLIED WHOLE CARD BRINGS ITS OWN GROUND, so the app's white one is not
   * drawn under it — and it takes `cf-plain`'s LIGHT ink, because that ground
   * is dark. Nothing about the phone's own squares changed: `plain` still asks
   * *"does this square already have a ground"*, and a full card answers yes.
   */
  const overArt = Boolean(supplied && supplied.full);
  /*
   * A DRESSED CARD DRAWS ITS GROUND EVEN IN `plain`, which the white one does
   * not. On a phone the square underneath is already dark, so the white card
   * could be skipped; a dark card has a GOLD EDGE, and that edge is the only
   * thing saying where one card in a fanned hand of thirteen ends.
   */
  const dressed = !supplied && themed();
  const bare = (plain && !dressed) || overArt;
  const ground = bare ? ''
    : `<rect x="1" y="1" width="98" height="138" rx="9" class="cf-ground${dressed ? ' cf-dark' : ''}"/>`;
  /*
   * KEYED BY THE CARD, because thirteen of these share one document. Every
   * clip is the same rectangle, so a shared id would look fine — right up
   * until something removed the card that happened to be FIRST, and the other
   * twelve lost their corners with nothing thrown.
   */
  const clip = overArt
    ? `<defs><clipPath id="cf-clip-${id}"><rect x="0" y="0" width="100" height="140" rx="9"/>`
      + '</clipPath></defs>'
    : '';

  /*
   * `cf-plain` vs `cf-solid` is the whole reason the caller says which it
   * wants: on a phone the square already has a dark ground, so a black suit has
   * to be LIGHT; on the dealer's panel and the projector the card prints its
   * own white ground, so the same suit has to be DARK. One drawing, two
   * grounds, and the stylesheet decides rather than the caller passing colours.
   */
  const ink = bare || dressed ? 'cf-plain' : 'cf-solid';
  return `<svg class="cardface ${red ? 'red' : 'black'} ${ink}" viewBox="0 0 100 140"`
    + ` xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`
    + ` role="img" aria-label="${rank} of ${suit}">`
    + `${clip}${ground}${middle}${index}</svg>`;
}
