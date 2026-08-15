/**
 * A PACK'S OWN COLOUR — the rules that make it worth having.
 *
 * There is nothing to test about whether a gradient is pretty. What matters is
 * the handful of properties that decide whether the shelf is faster to read:
 *
 *  - the SAME pack is the SAME colour every time, on every device;
 *  - two packs from one decade are told apart by their genre;
 *  - nothing is left plain, so no card looks half-built beside a dressed one;
 *  - and it never speaks the app's own colour language.
 *
 * The last one is the one worth having a test for rather than a comment: gold,
 * green and red mean winning, good and destructive everywhere in this app, and
 * a Christmas pack is red and green.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { packLook, packLookAttrs, kindEdge, PACK_SUBJECTS } from '../public/assets/pack-look.js';

/* The decade table is not exported — it is an implementation detail — so the
 * length rule is checked against what `packLook` actually returns for each. */
const DECADES_FOR_TEST = ['50s', '60s', '70s', '80s', '90s', '00s', '10s', '20s']
  .map((d) => ({ word: packLook({ title: `The ${d} Quiz` }).word }));

test('a pack is the same colour every time it is asked', () => {
  // The entire value is recognising a card you have seen before, so a shelf
  // that reshuffles its colours on reload is worse than no colours at all.
  const a = packLook({ title: 'The Madonna Quiz' });
  const b = packLook({ title: 'The Madonna Quiz' });
  assert.deepEqual(a, b);
});

test('NOTHING IS LEFT PLAIN — an unrecognised pack still gets a colour', () => {
  const look = packLook({ title: 'The Madonna Quiz' });
  assert.equal(look.subject, '', 'Madonna is not a subject and should not be one');
  assert.match(look.a, /^hsla\(/, 'an unrecognised pack was left without a colour');
  assert.match(look.b, /^hsla\(/);
});

test('two packs with different names get different colours', () => {
  const one = packLook({ title: 'The Madonna Quiz' });
  const two = packLook({ title: 'The Snow Patrol Quiz' });
  assert.notEqual(one.a, two.a);
});

test('GENRE BEATS DECADE, which is the point of the ordering', () => {
  // Both of these are 2000s packs. If the decade won they would be the same
  // colour, and the shelf would be no faster to read than it is now.
  const metal = packLook({ title: 'The 2000s Metal Quiz' });
  const rnb = packLook({ title: "The 2000s Pop R'n'B and Chart Quiz" });
  assert.equal(metal.subject, 'metal');
  assert.equal(rnb.subject, 'soul');
  assert.notEqual(metal.a, rnb.a);
});

test('a decade is recognised however it is written', () => {
  for (const title of ['The 1980s Pop Music Quiz', 'An 80s Night', 'The Eighties Quiz']) {
    assert.equal(packLook({ title }).subject, '1980s', `"${title}" was not read as the eighties`);
  }
});

test('seasonal beats everything, because it is the least ambiguous', () => {
  assert.equal(packLook({ title: 'The 1980s Christmas Quiz' }).subject, 'christmas');
});

test('"POP" IS NOT A SUBJECT, deliberately', () => {
  // Nearly every pack in this library is a pop quiz of some kind, so matching
  // it would colour most of the shelf one colour — the exact failure the whole
  // feature exists to avoid.
  for (const s of PACK_SUBJECTS) {
    assert.ok(!s.words.includes('pop'), `"pop" is a subject on ${s.id}, which would flatten the shelf`);
  }
  assert.equal(packLook({ title: 'The Pop Quiz' }).subject, '');
});

test('a word is matched whole, never inside a longer one', () => {
  // "rock" inside "Rocky", "rap" inside "rapture" — a substring match would
  // colour a film quiz as a rock quiz and nobody would ever work out why.
  assert.equal(packLook({ title: 'The Rocky Horror Quiz' }).subject, 'halloween');
  assert.equal(packLook({ title: 'The Rapture Quiz' }).subject, '');
});

test("punctuation does not change what a pack is about", () => {
  // "R'n'B", "RnB" and "R n B" are one thing to a human and must be one thing
  // here, or the same quiz gets two different colours depending on typing.
  const forms = ["The R'n'B Quiz", 'The RnB Quiz', 'The R n B Quiz'];
  const looks = forms.map((title) => packLook({ title }));
  assert.ok(looks.every((l) => l.subject === 'soul'), forms.join(' / '));
});

test('IT NEVER SPEAKS THE APP\'S OWN COLOUR LANGUAGE — every tint is a wash', () => {
  /*
   * Gold means winning, green means good, red means destructive. The guard is
   * not "avoid those hues" — Christmas IS red and green — it is that a tint is
   * never strong enough to read as a filled control. Full-strength colour on a
   * card is the thing that would collide.
   */
  const titles = ['The Christmas Quiz', 'The 2000s Metal Quiz', 'The Madonna Quiz', 'A Halloween Special'];
  for (const title of titles) {
    for (const colour of [packLook({ title }).a, packLook({ title }).b]) {
      const alpha = Number(colour.match(/([\d.]+)\s*\)$/)[1]);
      assert.ok(alpha > 0, `${title}: a colour with no alpha at all`);
      assert.ok(alpha <= 0.35, `${title}: ${colour} is strong enough to read as a filled control`);
    }
  }
});

test('THE EDGE IS THE KIND OF PACK, NOT ITS SUBJECT', () => {
  /*
   * The two channels say two different things and that is the whole design:
   * the edge answers "what kind of night is this", the background answers
   * "what era". If the edge ever went back to being derived from the subject
   * it would be a louder copy of the wash and the shelf would answer one
   * question twice.
   */
  const quiz = packLookAttrs({ title: 'The 1980s Pop Music Quiz' }, 'quiz');
  const bingo = packLookAttrs({ title: 'The 1980s Pop Music Quiz' }, 'bingo');
  const edgeOf = (a) => a.style.match(/--pk-edge: ([^;]+)/)[1];
  assert.notEqual(edgeOf(quiz), edgeOf(bingo), 'the same pack got the same edge for two kinds');
  // ...and the SUBJECT half is identical, because that is not what changed.
  assert.equal(quiz.style.match(/--pk-a: ([^;]+)/)[1], bingo.style.match(/--pk-a: ([^;]+)/)[1]);
});

test('two packs of one kind share an edge however different their subjects', () => {
  const a = packLookAttrs({ title: 'The 1980s Pop Music Quiz' }, 'quiz');
  const b = packLookAttrs({ title: 'The 2000s Metal Quiz' }, 'quiz');
  const edgeOf = (x) => x.style.match(/--pk-edge: ([^;]+)/)[1];
  assert.equal(edgeOf(a), edgeOf(b));
  // The subject half still differs, or nothing tells them apart at all.
  assert.notEqual(a.style.match(/--pk-a: ([^;]+)/)[1], b.style.match(/--pk-a: ([^;]+)/)[1]);
});

test('A NEW GAME KIND STILL GETS AN EDGE rather than losing one', () => {
  // "When I add further round types they can have new highlights" — until
  // somebody does, a karaoke pack must not ship with a card that looks broken.
  const next = packLookAttrs({ title: 'The Karaoke Pack' }, 'karaoke');
  assert.match(next.style, /--pk-edge: [^;]+/);
  assert.ok(kindEdge('karaoke'), 'an unknown kind produced no edge at all');
});

test('THE ERA IS PRINTED, AND ONLY WHEN IT IS SHORT ENOUGH TO READ', () => {
  assert.equal(packLook({ title: 'The 1980s Pop Music Quiz' }).word, '80s');
  assert.equal(packLook({ title: 'An 80s Night' }).word, '80s');
  assert.equal(packLook({ title: 'The 2000s Metal Quiz' }).word, 'METAL');
  // Nothing short and true to say — printing the whole title big is not the
  // feature, and a nine-letter word across a 200px card is either unreadable
  // or off the edge.
  assert.equal(packLook({ title: 'The Christmas Number Ones Quiz' }).word, '');
  assert.equal(packLook({ title: 'The Madonna Quiz' }).word, '');
});

test('nothing printed big is ever longer than five characters', () => {
  // The size steps in `packLookAttrs` only go down to five. A longer word
  // would be rendered at the five-character size and run off the card.
  for (const s of [...PACK_SUBJECTS, ...DECADES_FOR_TEST]) {
    if (s.word) assert.ok(s.word.length <= 5, `"${s.word}" is too long to print big`);
  }
});

test('a pack with no title at all is still given something', () => {
  // The generator, Import and the editor can all produce a pack mid-save, and
  // a card that throws is a shelf that does not draw.
  for (const pack of [undefined, null, {}, { id: 'x' }, { title: '' }]) {
    const look = packLook(pack);
    assert.ok(look.a && look.b, `${JSON.stringify(pack)} produced no colour`);
  }
});

test('THE CARD AND THE SLOT GET THE SAME COLOURS', () => {
  // A pack that looked like one thing on the shelf and another in the hole it
  // was dragged into would undo the reason the two are the same shape.
  const pack = { title: 'The 1980s Pop Music Quiz' };
  const attrs = packLookAttrs(pack);
  const look = packLook(pack);
  assert.ok(attrs.cls.includes('tinted'));
  assert.ok(attrs.style.includes(look.a) && attrs.style.includes(look.b));
});

test('the pattern class is only there when there is a pattern', () => {
  assert.equal(packLookAttrs({ title: 'The Madonna Quiz' }).cls, 'tinted');
  assert.equal(packLookAttrs({ title: 'The 1980s Quiz' }).cls, 'tinted pk-lines');
  assert.equal(packLookAttrs({ title: 'The Metal Quiz' }).cls, 'tinted pk-slash');
});

test('nothing a human typed reaches the style attribute', () => {
  /*
   * The colours are built here out of numbers, never out of the title — so a
   * pack called `"><script>` cannot put anything into the markup. Worth a test
   * rather than a comment: this is generated markup dropped into an inline
   * style, which is exactly where an injection would go unnoticed.
   */
  const attrs = packLookAttrs({ title: '"><script>alert(1)</script>' });
  assert.ok(!attrs.style.includes('<'), attrs.style);
  assert.ok(!attrs.style.includes('"'), attrs.style);
  assert.match(attrs.style, /^--pk-a: [^;]+; --pk-b: [^;]+; --pk-edge: [^;]+$/);
});
