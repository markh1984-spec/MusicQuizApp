/**
 * TONIGHT'S RUNNING ORDER.
 *
 * The things worth pinning down are the ones that would go wrong in front of
 * a room: a night quietly playing fewer rounds than it was built with, a
 * composed night editing the pack it borrowed from, and — the expensive one —
 * a composed pack's id colliding with a real one, which would let a
 * correction saved to an unrelated quiz replace a running night mid-question.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { composeQuiz, COMPOSED_ID, isComposed, MAX_ROUNDS } from '../src/running-order.js';

const round = (title, n = 2) => ({
  title,
  type: 'text',
  questions: Array.from({ length: n }, (_, i) => ({
    prompt: `${title} question ${i + 1}`,
    options: ['One', 'Two', 'Three', 'Four'],
    correctIndex: 0,
  })),
});

const PACKS = {
  eighties: { id: 'eighties', title: 'The 1980s Pop Music Quiz', look: 'halloween', rounds: [round('Eighties A'), round('Eighties B')] },
  motown: { id: 'motown', title: 'The Motown Quiz', rounds: [round('Motown A'), round('Motown B'), round('Motown C')] },
};

let reads = [];
const load = (id) => {
  reads.push(id);
  const pack = PACKS[id];
  if (!pack) throw new Error('no such pack');
  // A fresh object per read, exactly as `readPack` gives every caller its own.
  return JSON.parse(JSON.stringify(pack));
};

test('rounds from two packs become one night, in the order given', () => {
  reads = [];
  const pack = composeQuiz([
    { packId: 'motown', round: 1 },
    { packId: 'eighties', round: 0 },
    { packId: 'motown', round: 2 },
  ], load);
  assert.deepEqual(pack.rounds.map((r) => r.title), ['Motown B', 'Eighties A', 'Motown C']);
  assert.equal(pack.rounds[0].questions.length, 2);
});

test('one read per PACK, not one per round', () => {
  // A night built of five rounds from one quiz must not read that file five
  // times — and on a host with no disk that read is the slow part of a launch.
  reads = [];
  composeQuiz([
    { packId: 'motown', round: 0 },
    { packId: 'motown', round: 1 },
    { packId: 'motown', round: 2 },
  ], load);
  assert.deepEqual(reads, ['motown']);
});

test('THE ID IS RESERVED AND CANNOT BE A FILE ON DISK', () => {
  /*
   * The expensive one. `reloadPackEverywhere()` finds a running game by
   * comparing `session.pack.id` with the id being saved, then re-reads that id
   * from disk — so if a composed pack's id could collide with a real one,
   * saving an unrelated quiz would replace a running night with something
   * else, mid-question, in front of a room.
   *
   * `safeId()` in quizzes.js strips everything outside [a-zA-Z0-9._-], so a
   * leading "~" is unreachable for any pack that came off a filename.
   */
  const pack = composeQuiz([{ packId: 'motown', round: 0 }], load);
  assert.equal(pack.id, COMPOSED_ID);
  assert.ok(isComposed(pack.id));
  assert.ok(/^[^a-zA-Z0-9._-]/.test(COMPOSED_ID),
    'the reserved id starts with a character safeId() would have stripped, so no file can be called it');
  assert.ok(!isComposed('motown'));
});

test('the source packs are not edited by the night that borrowed from them', () => {
  // The engine writes to what it is handed, and these objects are the same
  // ones every other caller of readPack is holding.
  const mine = JSON.parse(JSON.stringify(PACKS));
  const pack = composeQuiz([{ packId: 'motown', round: 0 }], (id) => mine[id]);
  pack.rounds[0].title = 'Renamed mid-game';
  pack.rounds[0].questions[0].prompt = 'Changed';
  assert.equal(mine.motown.rounds[0].title, 'Motown A');
  assert.equal(mine.motown.rounds[0].questions[0].prompt, 'Motown A question 1');
});

test('all from one pack keeps that pack’s title, mixed is named for the night', () => {
  // An ordinary launch goes through here too once this exists, and nothing
  // about a normal night should change on screen or in the archive.
  const one = composeQuiz([{ packId: 'eighties', round: 0 }, { packId: 'eighties', round: 1 }], load);
  assert.equal(one.title, 'The 1980s Pop Music Quiz');
  const mixed = composeQuiz([{ packId: 'eighties', round: 0 }, { packId: 'motown', round: 0 }], load);
  assert.notEqual(mixed.title, 'The 1980s Pop Music Quiz');
  assert.match(mixed.title, /tonight/i);
});

test('the look follows the first round’s pack', () => {
  const dressed = composeQuiz([{ packId: 'eighties', round: 0 }, { packId: 'motown', round: 0 }], load);
  assert.equal(dressed.look, 'halloween');
  const plain = composeQuiz([{ packId: 'motown', round: 0 }, { packId: 'eighties', round: 0 }], load);
  assert.equal(plain.look, '');
});

test('a pack that has been deleted since is NAMED, never silently skipped', () => {
  // Somebody builds a running order in the morning and deletes a pack in the
  // afternoon. A night that quietly launched with four rounds instead of five
  // is something you find out at question one, in front of a room.
  assert.throws(
    () => composeQuiz([{ packId: 'motown', round: 0 }, { packId: 'gone', round: 0 }], load),
    /no pack called gone/,
  );
});

test('a round that is not there is named too, with the number somebody typed', () => {
  assert.throws(
    () => composeQuiz([{ packId: 'motown', round: 9 }], load),
    /has no round 10/,
  );
  assert.throws(() => composeQuiz([{ packId: 'motown', round: -1 }], load), /has no round/);
  assert.throws(() => composeQuiz([{ packId: 'motown' }], load), /has no round/);
});

test('an empty running order is refused rather than launching an empty quiz', () => {
  assert.throws(() => composeQuiz([], load), /at least one round/);
  assert.throws(() => composeQuiz(null, load), /at least one round/);
});

test('a stuck drag cannot build a forty-round night', () => {
  const many = Array.from({ length: MAX_ROUNDS + 1 }, () => ({ packId: 'motown', round: 0 }));
  assert.throws(() => composeQuiz(many, load), /at most/);
  // …and exactly the limit is allowed.
  const ok = composeQuiz(many.slice(0, MAX_ROUNDS), load);
  assert.equal(ok.rounds.length, MAX_ROUNDS);
});

test('where each round came from is kept, for the host’s screen only', () => {
  const pack = composeQuiz([
    { packId: 'motown', round: 0 },
    { packId: 'eighties', round: 1 },
  ], load);
  assert.deepEqual(pack.sources.map((s) => s.title), ['The Motown Quiz', 'The 1980s Pop Music Quiz']);
});

/*
 * THE CONSOLE'S OWN COPY OF THE LIMIT HAS TO AGREE WITH THIS ONE.
 *
 * The server is the authority and refuses anything longer whatever the page
 * thinks — the browser copy exists only so the strip can say no before
 * somebody drags a fourth pack in and finds out at Launch, in a venue. They
 * cannot be shared: this module imports the quiz validator, which is
 * server-only. So the next best thing is a test, for the reason this codebase
 * already has one comparing the two halves of the brandmark: a number stated
 * in two places disagrees with itself within a month.
 */
test('the console and the server agree on how long a night may be', async () => {
  const { consoleSource } = await import('./console-source.js');
  const console_ = consoleSource();
  const found = console_.match(/const MAX_NIGHT_ROUNDS = (\d+);/);
  assert.ok(found, 'the console no longer caps the running order at all');
  assert.equal(Number(found[1]), MAX_ROUNDS,
    'the console and src/running-order.js disagree about the maximum number of rounds');
});
