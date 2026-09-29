/**
 * THE QUIZ PAYS ONCE, AT ITS LAST ROUND — however many stretches the bingo
 * cuts it into.
 *
 * The host, 29 September 2026: *"the bingo rounds are separate so they should
 * pay at the end of each round then the quiz winners paid at the end of the
 * last quiz round."* The running score already added up across a bingo
 * interlude; the prizes did not follow it. Every quiz part paid at its own
 * boundary on the running total, so quiz → bingo → quiz put the quiz's first
 * drink on the table TWICE — the leader at the break, then the leader at the
 * end, very often the same team. `prizes-fuzz.mjs` section N counted three
 * pints on that night and called it right.
 *
 * And a list TYPED on the first stretch is the quiz's list: typed before the
 * bingo and a second stretch were added, it must not be lost to the venue's.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';
import { PHASES } from '../src/engine.js';
import { laterQuiz, typedQuizRewards } from '../public/assets/prize-parts.js';

const START = 1_700_000_000_000;

function writeQuizPack(dir, id) {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({
    id, title: `Quiz ${id}`, questionSeconds: 20,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  }));
}

function writeBingoPack(dir, id) {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({
    id, title: `Bingo ${id}`, cardSize: 4,
    tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` })),
  }));
}

function withFileSession() {
  const dir = mkdtempSync(join(tmpdir(), 'quiz-pays-once-'));
  writeQuizPack(dir, 'quiz-a');
  writeQuizPack(dir, 'quiz-b');
  writeBingoPack(dir, 'bingo-a');
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store,
    onPush: () => {},
    now: () => START,
  });
  return { session, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Play the running quiz part to its round board — where a part with more to
 * come stops — and, for the LAST part, on to the final. A last part stops at
 * its round board too and needs one more press: a check that stops there
 * never sees the final's vouchers at all, and passed this file's typed-list
 * case with the fault in.
 */
function playPart(session, playerId, { toFinal = false } = {}) {
  const e = session.engine;
  e.start();
  let guard = 0;
  while (e.state.phase !== PHASES.QUESTION && guard++ < 10) e.next();
  e.answer({ playerId, optionIndex: 0 });
  guard = 0;
  while (e.state.phase !== PHASES.ROUND_BOARD && guard++ < 10) e.next();
  guard = 0;
  while (toFinal && e.state.phase !== PHASES.FINAL && guard++ < 10) e.next();
}

const live = (session) => Object.values(session.engine.state.vouchers || {}).filter((v) => !v.carried);
const all = (session) => Object.values(session.engine.state.vouchers || {});

const SPLIT = [
  { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
  { kind: 'bingo', packId: 'bingo-a', shape: { rows: 3, cols: 3 }, prizes: 1 },
  { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
];

test('quiz → bingo → quiz: nothing is paid for the quiz at the break', () => {
  const it = withFileSession();
  try {
    const { session } = it;
    session.launchRunningOrder(structuredClone(SPLIT), { winners: 1, rewards: ['A pint', 'A half'] });
    const p = session.engine.join({ name: 'Alpha' });
    playPart(session, p.id);
    session.advanceOrder();
    assert.equal(session.kind, 'bingo');
    assert.deepEqual(all(session).map((v) => v.reward), [],
      'the leader at the break was handed the quiz\'s drink before the quiz was over');
  } finally { it.done(); }
});

test('…and the quiz pays once, on the total, when its last round ends', () => {
  const it = withFileSession();
  try {
    const { session } = it;
    session.launchRunningOrder(structuredClone(SPLIT), { winners: 1, rewards: ['A pint', 'A half'] });
    const p = session.engine.join({ name: 'Alpha' });
    playPart(session, p.id);
    session.advanceOrder();
    session.advanceOrder();
    assert.equal(session.kind, 'quiz');
    playPart(session, p.id, { toFinal: true });
    assert.equal(session.engine.state.phase, PHASES.FINAL);
    assert.deepEqual(all(session).map((v) => v.reward), ['A pint'], 'one quiz drink for the whole night');
    assert.equal(live(session)[0].winnerId, p.id);
  } finally { it.done(); }
});

test('a night that ENDS on the bingo still pays the quiz, at the quiz\'s last round', () => {
  const it = withFileSession();
  try {
    const { session } = it;
    session.launchRunningOrder([SPLIT[0], SPLIT[1]].map((s) => structuredClone(s)), { winners: 1, rewards: ['A pint'] });
    const p = session.engine.join({ name: 'Alpha' });
    playPart(session, p.id);
    session.advanceOrder();
    assert.equal(session.kind, 'bingo');
    assert.deepEqual(all(session).map((v) => v.reward), ['A pint'], 'the quiz before a closing bingo is paid as it ends');
  } finally { it.done(); }
});

test('a list TYPED on the first stretch is the one the quiz pays', () => {
  const it = withFileSession();
  try {
    const { session } = it;
    const order = structuredClone(SPLIT);
    order[0].rewards = ['Typed drink'];           // typed before the rest was added
    session.launchRunningOrder(order, { winners: 1, rewards: ['Venue pint'] });
    const p = session.engine.join({ name: 'Alpha' });
    playPart(session, p.id);
    session.advanceOrder();
    session.advanceOrder();
    playPart(session, p.id, { toFinal: true });
    assert.equal(session.engine.state.phase, PHASES.FINAL);
    assert.deepEqual(all(session).map((v) => v.reward), ['Typed drink'],
      'the last stretch fell back to the venue\'s list and lost what was typed');
  } finally { it.done(); }
});

test('the shared helpers: which parts are followed by more quiz, and the typed list', () => {
  const parts = [{ kind: 'quiz' }, { kind: 'bingo' }, { kind: 'quiz', rewards: ['x'] }, { kind: 'cards' }];
  assert.equal(laterQuiz(parts, 0), true);
  assert.equal(laterQuiz(parts, 2), false);
  assert.equal(laterQuiz(parts, 1), true);
  assert.deepEqual(typedQuizRewards(parts), ['x']);
  assert.deepEqual(typedQuizRewards([{ kind: 'quiz', rewards: ['a'] }, { kind: 'quiz' }]), ['a']);
  assert.equal(typedQuizRewards([{ kind: 'quiz' }, { kind: 'bingo', rewards: ['b'] }]), null, 'a bingo list is not the quiz\'s');
});

/*
 * AND THE BAR SAYS SO: ONE QUIZ ROW, however many stretches — the prize table
 * drew a row per stretch, each paying the winners, so the night's reminder
 * counted the quiz's drinks twice and a list typed on one stretch looked like
 * a different game's.
 */
test('the prize table draws ONE Quiz row for a quiz split by bingo, and writes reach every stretch', async () => {
  const { prizeParts } = await import('../public/assets/console-prizes.js');
  const slots = [
    { kind: 'quiz', packId: 'q', rounds: [0], rewards: ['Typed drink'] },
    { kind: 'quiz', packId: 'q', rounds: [1] },
    { kind: 'bingo', packId: 'b', shape: { rows: 3, cols: 3 }, prizes: 1 },
    { kind: 'quiz', packId: 'q', rounds: [2] },
  ];
  const parts = prizeParts({ slots, night: { winners: 1 }, picked: null, packOf: () => ({ trackCount: 40 }), cardShapes: [], venueList: ['Venue pint'] });
  assert.deepEqual(parts.map((p) => p.kind), ['quiz', 'bingo'], 'one row for the quiz, one for the bingo');
  const quiz = parts[0];
  assert.deepEqual(quiz.list, ['Typed drink'], 'the list typed on the first stretch is the quiz\'s');
  assert.deepEqual([...quiz.ats].sort(), [0, 3], 'a write lands on every stretch');
  assert.equal(quiz.at, 3, 'and the row is the stretch that pays');
});
