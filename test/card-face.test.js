/**
 * A DRAWN CARD HAS TO SHOW ITS OWN RANK, AND NOTHING MAY BE A GLYPH.
 *
 * ---
 *
 * Both halves of this were bugs before they were tests.
 *
 * **The pips.** A pip below the middle of the card is turned over, the way a
 * real card does it — and the first version wrote `rotate(180 x y)` inside a
 * transform list that had ALREADY translated the origin to that point. SVG
 * reads the centre in the new local system, so every lower pip flew off the
 * card: a seven drew four, a two drew one, the Ace drew none. Nothing threw,
 * every card rendered, and it was only visible by drawing all fifty-two and
 * counting them.
 *
 * **The glyphs.** `♠♥♦♣` live in Miscellaneous Symbols and a phone may render
 * them as EMOJI — a colour heart, and a blue-and-orange diamond that is not a
 * red suit at all. `CLAUDE.md` sets that rule for the bin icon, the seasonal
 * shapes and the avatars: **drawn, never emoji.** The card's NAME is still
 * `7♥` — that is what the engine stores and what `pub-unchanged` sees — but
 * nothing may draw that character.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { cardFaceSvg, isCourt } from '../public/assets/card-face.js';
import { DECK, RANKS, SUITS, HAND } from '../public/assets/deck.js';

/** Each pip, and the index's own little suit, is one `<g transform=…>`. */
const groups = (svg) => (svg.match(/<g transform=/g) || []).length;

test('every one of the fifty-two draws something', () => {
  assert.equal(DECK.length, 52);
  for (const card of DECK) {
    const svg = cardFaceSvg(card.title, { plain: true });
    assert.match(svg, /^<svg /, `${card.title} drew nothing`);
    assert.ok(svg.includes('</svg>'), `${card.title} is not closed`);
  }
});

test('A NUMBER CARD DRAWS EXACTLY ITS OWN NUMBER OF PIPS', () => {
  for (const card of DECK) {
    const svg = cardFaceSvg(card.title, { plain: true });
    // One group is the index's suit; the rest are the pips.
    const pips = groups(svg) - 1;
    const want = isCourt(card.rank) || card.rank === 'A' ? 1 : Number(card.rank);
    assert.equal(pips, want,
      `${card.title} drew ${pips} pips, wanted ${want} — a lower pip has flown off the card again`);
  }
});

test('A LOWER PIP IS TURNED ABOUT ITS OWN CENTRE, never about a named point', () => {
  /*
   * `rotate(180)` and not `rotate(180 x y)` — see the note at the top. Pinned
   * on the STRING because that is where the fault was: the numbers looked
   * right and meant something else.
   */
  for (const card of DECK) {
    const svg = cardFaceSvg(card.title, { plain: true });
    const rotates = svg.match(/rotate\([^)]*\)/g) || [];
    for (const r of rotates) {
      assert.equal(r, 'rotate(180)',
        `${card.title} names a centre in ${r}, which SVG reads in the translated system`);
    }
  }
});

test('NO SUIT IS EVER A CHARACTER — drawn, never emoji', () => {
  for (const card of DECK) {
    for (const plain of [true, false]) {
      const svg = cardFaceSvg(card.title, { plain });
      for (const glyph of ['♠', '♥', '♦', '♣']) {
        assert.ok(!svg.includes(glyph),
          `${card.title} puts ${glyph} in the markup, where a phone may draw an emoji`);
      }
    }
  }
});

test('the index says the rank, and a ten is not a one', () => {
  for (const rank of RANKS) {
    const svg = cardFaceSvg(`${rank}♠`, { plain: true });
    // `10` carries an extra class for its own size — see the note beside the
    // index in card-face.js — so the class list is matched loosely and the
    // TEXT exactly, which is the half that matters.
    assert.match(svg, new RegExp(`class="cf-rank[^"]*"[^>]*>${rank}</text>`),
      `${rank} is not printed as its own index`);
  }
});

test('red is the two red suits and nothing else', () => {
  for (const suit of SUITS) {
    const svg = cardFaceSvg(`7${suit.glyph}`, { plain: true });
    assert.equal(/class="cardface red/.test(svg), suit.red, `${suit.name} has the wrong colour class`);
  }
});

test('a hand is thirteen, and rubbish draws nothing rather than half a card', () => {
  assert.equal(HAND, 13);
  for (const bad of ['', 'nonsense', '7', '♥', null, undefined]) {
    assert.equal(cardFaceSvg(bad, { plain: true }), '', `${String(bad)} drew something`);
  }
});

/**
 * A DROPPED-IN PICTURE REPLACES THE MIDDLE AND LEAVES THE INDEX ALONE.
 *
 * The interface is a file named after a card's id, exactly as a sting is
 * (`public/assets/cards/README.md`), and the two halves that could quietly
 * break are both here: **the drawn pips are the fallback and are never
 * deleted**, so a card nobody has supplied a picture for has to go on drawing
 * itself; and **the corner index survives the picture**, because it is the
 * part that is read at 45px and an imported drawing is exactly the thing that
 * would take it back.
 *
 * It runs LAST in this file on purpose: `ensureCardArt()` fills a module-level
 * map that every later call would then see, so the no-artwork assertions above
 * have to have happened first.
 */
test('with no artwork supplied, every card draws its own pips', () => {
  assert.match(cardFaceSvg('7♥', { plain: true }), /<g transform=/);
  assert.ok(!cardFaceSvg('7♥', { plain: true }).includes('<image'));
});

test('a supplied picture takes the middle, and only of that card', async () => {
  const { ensureCardArt } = await import('../public/assets/card-face.js');
  const real = globalThis.fetch;
  let asked = '';
  globalThis.fetch = async (u) => {
    asked = String(u);
    // A junk id and a junk extension, because the browser must never build a
    // path out of a string it was handed — the pack-id trap, wearing a
    // filename.
    return { ok: true, json: async () => ({ art: { sj: 'png', hq: 'webp', 'not-a-card': 'png' } }) };
  };
  try {
    await ensureCardArt();
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(asked, '/api/card-art');

  const jack = cardFaceSvg('J♠');
  assert.match(jack, /<image [^>]*href="\/assets\/cards\/sj\.png"/,
    'the Jack of Spades did not wear its picture');
  assert.match(jack, /class="cf-rank[^"]*"[^>]*>J<\/text>/,
    'the picture took the index with it');
  assert.ok(jack.includes('cf-ground'), 'the picture took the white ground with it');

  assert.match(cardFaceSvg('Q♥'), /href="\/assets\/cards\/hq\.webp"/);

  // Everything else still draws itself.
  const king = cardFaceSvg('K♠', { plain: true });
  assert.ok(!king.includes('<image'), 'a card with no file supplied drew a picture');
  assert.match(king, /<g transform=/, 'a card with no file supplied stopped drawing');
});
