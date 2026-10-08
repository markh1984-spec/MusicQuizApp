/**
 * START THIS GAME AGAIN — the quiz control view's restart (option A, picked 7
 * October 2026): beside Stop, at every phase, pressed twice. The same quiz,
 * the same settings and the same phones, with scores back to where this game
 * began and nobody retyping a name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';
import { PHASES } from '../src/engine.js';

const START = 1_700_000_000_000;

function writeQuizPack(dir, id) {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({
    id, title: `Quiz ${id}`, questionSeconds: 20,
    rounds: [
      { id: 'r1', type: 'text', title: 'Round One', questions: [
        { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
        { id: 'q2', prompt: 'Another?', options: ['a', 'b', 'c', 'd'], correctIndex: 1 },
      ] },
      { id: 'r2', type: 'text', title: 'Round Two', questions: [
        { id: 'q3', prompt: 'Third?', options: ['a', 'b', 'c', 'd'], correctIndex: 2 },
      ] },
    ],
  }));
}

function writeBingoPack(dir, id) {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({
    id, title: `Bingo ${id}`, cardSize: 3,
    tracks: Array.from({ length: 30 }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` })),
  }));
}

function withSession() {
  const dir = mkdtempSync(join(tmpdir(), 'start-again-'));
  writeQuizPack(dir, 'quiz-a');
  writeQuizPack(dir, 'quiz-b');
  writeBingoPack(dir, 'bingo-a');
  let now = START;
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store, onPush: () => {}, now: () => (now += 500),
  });
  return { session, done: () => rmSync(dir, { recursive: true, force: true }) };
}

function toQuestion(e) {
  let guard = 0;
  while (e.state.phase !== PHASES.QUESTION && guard++ < 10) e.next();
}

test('half way through: back to the start, scores to 0, the same phones and settings', () => {
  const it = withSession();
  try {
    const { session } = it;
    session.launch('quiz', 'quiz-a', { questionSeconds: 30, winners: 1, rewards: ['A pint'] });
    const e = session.engine;
    const a = e.join({ name: 'Alpha' });
    const b = e.join({ name: 'Bravo' });
    e.start();
    toQuestion(e);
    e.answer({ playerId: a.id, optionIndex: 0 });
    e.next(); e.next();
    assert.ok(e.state.players[a.id].score > 0, 'Alpha scored');
    const tokenBefore = e.state.players[a.id].token;

    const r = session.run('startAgain', {});
    assert.equal(r.ok, true);
    const s = session.engine.state;
    assert.equal(s.phase, PHASES.LOBBY);
    assert.equal(s.roundIndex, 0);
    assert.equal(s.questionIndex, 0);
    assert.equal(s.question, null);
    assert.deepEqual(s.answers, {});
    assert.deepEqual(s.history, []);
    assert.equal(s.players[a.id].score, 0);
    assert.equal(s.players[a.id].token, tokenBefore, 'the phone is still itself — nobody rejoins');
    assert.ok(s.players[b.id], 'everybody is still in');
    assert.equal(s.questionSeconds, 30, 'the same settings');
    assert.equal(s.winners, 1);
    assert.deepEqual(s.rewards, ['A pint']);
    assert.equal(s.launched, true, 'still a launched night, not a deploy\'s leftover lobby');
    assert.equal(session.engine.playerView(a.id).phase, PHASES.LOBBY);
  } finally { it.done(); }
});

test('from the final: the drinks already won stay won, and the next game pays its own', () => {
  const it = withSession();
  try {
    const { session } = it;
    session.launch('quiz', 'quiz-a', { winners: 1, rewards: ['A pint'] });
    const e = session.engine;
    const a = e.join({ name: 'Alpha' });
    e.start();
    toQuestion(e);
    e.answer({ playerId: a.id, optionIndex: 0 });
    e.finish();
    const first = Object.values(e.state.vouchers);
    assert.equal(first.length, 1);
    session.run('startAgain', {});
    const kept = Object.values(session.engine.state.vouchers);
    assert.equal(kept.length, 1, 'the first game\'s drink is not taken away');
    assert.equal(kept[0].carried, true, 'and it is not the next game\'s');
    assert.equal(kept[0].redeemedAt, null);
  } finally { it.done(); }
});

test('in a running order: this quiz restarts from the scores it began with, not from 0', () => {
  const it = withSession();
  try {
    const { session } = it;
    session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', shape: { rows: 3, cols: 3 }, prizes: 1 },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ], { winners: 1, rewards: ['A pint'] });
    let e = session.engine;
    const a = e.join({ name: 'Alpha' });
    e.start();
    toQuestion(e);
    e.answer({ playerId: a.id, optionIndex: 0 });
    let guard = 0;
    while (e.state.phase !== PHASES.ROUND_BOARD && guard++ < 10) e.next();
    const carried = e.state.players[a.id].score;
    assert.ok(carried > 0);
    session.advanceOrder();
    session.advanceOrder();
    e = session.engine;
    assert.equal(session.kind, 'quiz');
    e.start();
    toQuestion(e);
    e.answer({ playerId: a.id, optionIndex: 0 });
    e.next();
    assert.ok(e.state.players[a.id].score > carried, 'scored again in the second stretch');
    session.run('startAgain', {});
    assert.equal(session.engine.state.players[a.id].score, carried, 'back to where this stretch began');
    assert.equal(session.orderPos, 2, 'still the same part of the night');
  } finally { it.done(); }
});

test('a bingo game is not restarted this way — it has New cards', () => {
  const it = withSession();
  try {
    const { session } = it;
    session.launch('bingo', 'bingo-a');
    assert.equal(session.run('startAgain', {}).reason, 'quiz_only');
  } finally { it.done(); }
});
