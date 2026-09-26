/**
 * HOW MANY WINNERS A NIGHT HAS SURVIVES A BINGO PART.
 *
 * `nightWideOpts()` hands `winners` from the part that is ending to the part
 * that is starting — but it reads it with `winnersOf(state)`, and a BINGO
 * state's `winners` is `{ line: [], full: [] }`, a different thing wearing
 * the same name. So `winnersOf()` fell to the default: asked for ONE winner
 * on a bingo-then-quiz night, the quiz after the interlude drew a podium of
 * three and paid three places (launch-path sweep, 23 September 2026, the
 * running-order row). Quiz → bingo → quiz lost it at the bingo the same way.
 *
 * A bingo part carries the NIGHT's number under its own name now
 * (`nightWinners`), and `winnersOf()` reads either — so a quiz after a bingo
 * pays and draws exactly what was chosen at launch.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';
import { PHASES, winnersOf } from '../src/engine.js';

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

/** A Session whose packs are real files, like a running quizmaster's room. */
function withFileSession() {
  const dir = mkdtempSync(join(tmpdir(), 'winners-carry-'));
  writeQuizPack(dir, 'quiz-a');
  writeQuizPack(dir, 'quiz-b');
  writeBingoPack(dir, 'bingo-a');
  let at = START;
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store,
    onPush: () => {},
    now: () => at,
  });
  return { session, tick: (ms) => { at += ms; }, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Play the current quiz part through to its final, one right answer. */
function playToFinal(session, playerId) {
  const e = session.engine;
  e.start();
  let guard = 0;
  while (e.state.phase !== PHASES.QUESTION && guard++ < 10) e.next();
  e.answer({ playerId, optionIndex: 0 });
  guard = 0;
  while (e.state.phase !== PHASES.FINAL && guard++ < 10) e.next();
  assert.equal(e.state.phase, PHASES.FINAL);
}

test('A BINGO PART CARRIES THE NIGHT\'S WINNERS TO THE QUIZ AFTER IT', () => {
  const it = withFileSession();
  try {
    const { session } = it;
    session.launchRunningOrder([
      { kind: 'bingo', packId: 'bingo-a', shape: { rows: 3, cols: 3 }, prizes: 1 },
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
    ], { winners: 1, rewards: ['A pint', 'A half', 'Crisps'] });
    assert.equal(session.kind, 'bingo');
    const p = session.engine.join({ name: 'Alpha' });
    session.advanceOrder();
    assert.equal(session.kind, 'quiz');
    assert.equal(winnersOf(session.engine.state), 1,
      'asked for one winner, the quiz after the bingo interlude recognises three places again');

    playToFinal(session, p.id);
    assert.equal(session.engine.screenView().winners, 1, 'the podium draws one, as chosen');
    const live = Object.values(session.engine.state.vouchers || {}).filter((v) => !v.carried);
    assert.equal(live.length, 1, 'and one place is paid');
  } finally {
    it.done();
  }
});

test('…and through quiz → bingo → quiz as well', () => {
  const it = withFileSession();
  try {
    const { session } = it;
    session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', shape: { rows: 3, cols: 3 }, prizes: 1 },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ], { winners: 1, rewards: ['A pint', 'A half', 'Crisps'] });
    session.engine.join({ name: 'Alpha' });
    assert.equal(winnersOf(session.engine.state), 1, 'the first part has it');
    session.advanceOrder();                           // into the bingo
    assert.equal(session.kind, 'bingo');
    session.advanceOrder();                           // and out again
    assert.equal(session.kind, 'quiz');
    assert.equal(winnersOf(session.engine.state), 1, 'the bingo in the middle lost it');
  } finally {
    it.done();
  }
});

test('a night that never chose still reads as three, on both sides of a bingo', () => {
  const it = withFileSession();
  try {
    const { session } = it;
    session.launchRunningOrder([
      { kind: 'bingo', packId: 'bingo-a', shape: { rows: 3, cols: 3 }, prizes: 1 },
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
    ], { rewards: ['A pint', 'A half', 'Crisps'] });
    session.engine.join({ name: 'Alpha' });
    session.advanceOrder();
    assert.equal(winnersOf(session.engine.state), 3);
  } finally {
    it.done();
  }
});
