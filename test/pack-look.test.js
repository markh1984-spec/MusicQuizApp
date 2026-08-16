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

import { packLook, packLookAttrs, kindEdge, PACK_SUBJECTS, shortTitle, titleSize } from '../public/assets/pack-look.js';

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

test('a pack that says Disco is a disco pack, not a soul one', () => {
  /*
   * "Disco & Funk Bingo" came out as SOUL, because `funk` is in the soul list
   * and soul was checked first — so the card printed a word the title does not
   * lead with. Where two entries are both true, the more specific wins.
   */
  assert.equal(packLook({ title: 'Disco & Funk Bingo' }).word, 'DISCO');
  // ...and the plain case is untouched.
  assert.equal(packLook({ title: 'Motown & Soul Bingo' }).word, 'SOUL');
});

/* ---- THE DRAWN TITLE IS TRIMMED; THE STORED ONE IS NOT
 *
 * Asked for as *"is it possible to make it so the title doesn't go to two
 * lines half the time"*, and the answer was not smaller type: the card says
 * what kind of pack it is three times over — the edge colour, the shelf
 * heading and the tab you are stood on — so the word "Quiz" in the title is
 * the card repeating itself, and it is what wraps the line.
 *
 * The property worth defending is the second half. Nothing here writes
 * anything, and SEARCH looks inside titles — a pack you could no longer find
 * by typing "quiz" would be a worse fault than a wrapped line.
 */
test('a trailing Quiz or Bingo comes off the drawn title', () => {
  assert.equal(shortTitle('The 1980s Pop Music Quiz'), '1980s Pop');
  assert.equal(shortTitle('Disco & Funk Bingo'), 'Disco & Funk');
  assert.equal(shortTitle('90s Bangers Music Bingo'), '90s Bangers');
  assert.equal(shortTitle('Rock Anthems Quiz'), 'Rock Anthems');
  assert.equal(shortTitle('The Motown & Soul Quiz'), 'Motown & Soul');
});

test('a title with nothing to trim is left exactly as it is', () => {
  assert.equal(shortTitle('Christmas Cracker'), 'Christmas Cracker');
  assert.equal(shortTitle('Guilty Pleasures'), 'Guilty Pleasures');
  // "The" only comes off the FRONT — it is a leading article, not a word ban.
  assert.equal(shortTitle('Songs About The Weather'), 'Songs About The Weather');
});

test('IT NEVER RETURNS AN EMPTY NAME, whatever it is handed', () => {
  // A pack somebody called "The Quiz" would otherwise draw a card with no name
  // on it, which is worse than the two lines this exists to avoid.
  assert.equal(shortTitle('The Quiz'), 'The Quiz');
  assert.equal(shortTitle('Bingo'), 'Bingo');
  assert.equal(shortTitle('Quiz'), 'Quiz');
  assert.equal(shortTitle(''), '');
  assert.equal(shortTitle(undefined), '');
});

test('the word QUIZ INSIDE a title is left alone', () => {
  // Only a TRAILING one is furniture. "Quiz Night Classics" is a name.
  assert.equal(shortTitle('Quiz Night Classics'), 'Quiz Night Classics');
  assert.equal(shortTitle('The Quiz Night Quiz'), 'Quiz Night');
});

test('the type size steps with the length, and only three ways', () => {
  assert.equal(titleSize('Disco Fever'), 't-s');
  assert.equal(titleSize('Motown & Soul'), 't-m');
  assert.equal(titleSize('Guilty Pleasures'), 't-m');
  assert.equal(titleSize('Pub Floor-Fillers Bingo'), 't-l');
  assert.equal(titleSize(''), 't-s');
  for (const t of ['a', 'a'.repeat(13), 'a'.repeat(40)]) {
    assert.ok(['t-s', 't-m', 't-l'].includes(titleSize(t)), 'never a fourth size');
  }
});
