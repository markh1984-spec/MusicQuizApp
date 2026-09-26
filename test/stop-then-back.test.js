/**
 * "STOP THE QUIZ — BACK UNDOES IT" HAS TO BE TRUE.
 *
 * The confirm on the control view promises it, and on a one-game night it was
 * false three ways (launch-path sweep, 23 September 2026): Stop after Q1 then
 * Back landed on the ROUND BOARD, so the rest of the round was never asked;
 * the early leader kept a live first-place code for a night that had not
 * finished; and the evening stayed filed with the early board, so Past gigs,
 * the league and the landlord's report all said the wrong team won.
 *
 * So Stop remembers where it was pressed (`state.stoppedFrom`) and Back puts
 * the night back exactly there; a final being undone takes back every
 * placing code nobody has spent; and the filed night is UPDATED at the true
 * final — one row for one evening — the same path bingo's mis-pressed Finish
 * already takes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Engine, PHASES } from '../src/engine.js';
import { Session } from '../src/session.js';

const QUIZ = {
  id: 'stopback', title: 'Stop Then Back', questionSeconds: 20,
  rounds: [{
    id: 'r1', type: 'text', title: 'Round One',
    questions: [
      { id: 'q1', prompt: 'First?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
      { id: 'q2', prompt: 'Second?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
    ],
  }],
};

/** Two phones, a prize on the table, the first question up. */
function night() {
  let at = Date.parse('2026-09-24T21:00:00.000Z');
  const engine = new Engine({ quiz: QUIZ, now: () => at });
  engine.state.rewards = ['A pint', 'A half'];
  const a = engine.join({ name: 'Alpha' });
  const b = engine.join({ name: 'Bravo' });
  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();
  return { engine, a, b, tick: (ms) => { at += ms; } };
}

const live = (engine) => Object.values(engine.state.vouchers || {}).filter((v) => !v.redeemedAt);

test('STOP THEN BACK RETURNS EXACTLY WHERE YOU WERE, and the rest of the round is still asked', () => {
  const { engine, a, b, tick } = night();
  tick(1000);
  engine.answer({ playerId: a.id, optionIndex: 1 });   // Alpha right, first
  tick(4000);
  engine.answer({ playerId: b.id, optionIndex: 1 });   // Bravo right, slower
  engine.reveal();
  const alphaAfterOne = engine.state.players[a.id].score;
  assert.ok(alphaAfterOne > engine.state.players[b.id].score, 'Alpha leads after one');

  // A mis-press of Stop the quiz.
  assert.equal(engine.finish(), true);
  assert.equal(engine.state.phase, PHASES.FINAL);
  const early = live(engine);
  assert.equal(early.length, 2, 'Stop pays the early board');
  const earlyCode = early.find((v) => v.place === 1).code;

  assert.equal(engine.back(), true);
  assert.equal(engine.state.phase, PHASES.REVEAL, 'Back lands where Stop was pressed, not on the round board');
  assert.equal(engine.state.questionIndex, 0);
  assert.equal(engine.state.players[a.id].score, alphaAfterOne, 'every score is kept');
  assert.equal(engine.state.finishedAt, null);
  assert.equal(live(engine).length, 0,
    'the early leader still holds a live first-place code for a night that has not finished');
  assert.equal(engine.state.vouchers[earlyCode], undefined, 'the code minted by the undone Stop must not scan');

  // The rest of the round IS asked.
  assert.equal(engine.next(), true);
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.questionIndex, 1, 'Next asks the second question, not the next round');
  tick(1000);
  engine.answer({ playerId: b.id, optionIndex: 2 });   // Bravo right, first
  tick(6000);
  engine.answer({ playerId: a.id, optionIndex: 0 });   // Alpha wrong
  engine.reveal();
  engine.next();                                        // the round board
  assert.equal(engine.state.phase, PHASES.ROUND_BOARD);
  engine.next();                                        // the true final
  assert.equal(engine.state.phase, PHASES.FINAL);
  const board = engine.leaderboard();
  assert.equal(board[0].name, 'Bravo', 'Bravo wins the real night');
  const paid = live(engine);
  assert.equal(paid.find((v) => v.place === 1).winnerId, b.id, 'the true final pays the true winner');
  assert.equal(paid.find((v) => v.place === 2).winnerId, a.id);
});

test('a Stop mid-question comes back to that question — revealed, because its clock has run out', () => {
  const { engine, a, tick } = night();
  tick(2000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.finish();
  tick(60_000);                     // the confirm, the winner slide, a minute of doubt
  engine.back();
  assert.equal(engine.state.phase, PHASES.REVEAL, 'the clock ran out while the winner was up, so it is the reveal');
  assert.equal(engine.state.questionIndex, 0);
  assert.ok(engine.state.answers[engine.answerKey(0, 0)][a.id], 'the answer that was in before Stop stands');
  assert.equal(engine.state.history.length, 1, 'and it is in the recap like any revealed question');
});

test('…and with time still on the clock it comes back live, clock intact', () => {
  const { engine, tick } = night();
  const endsAt = engine.state.question.endsAt;
  tick(3000);
  engine.finish();
  tick(2000);
  engine.back();
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.question.endsAt, endsAt, 'the same clock, not a fresh one');
  assert.ok(engine.msRemaining() > 0);
});

test('Stop at the rules slide and Back is the rules slide again, not a round board', () => {
  const engine = new Engine({ quiz: QUIZ, now: () => 1_700_000_000_000 });
  engine.join({ name: 'Alpha' });
  engine.start();
  assert.equal(engine.state.phase, PHASES.RULES);
  engine.finish();
  engine.back();
  assert.equal(engine.state.phase, PHASES.RULES);
});

test('a code already spent at the bar survives the Back — the drink has gone', () => {
  const { engine, a, tick } = night();
  tick(1000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();
  engine.finish();
  const [code] = Object.keys(engine.state.vouchers);
  engine.redeemVoucher(code, { by: 'scan' });
  engine.back();
  assert.ok(engine.state.vouchers[code], 'a spent voucher is a record, not a promise');
  assert.ok(engine.state.vouchers[code].redeemedAt);
});

test('a night that reached its final on its own still steps Back to the round board', () => {
  const { engine, a, tick } = night();
  tick(1000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();
  engine.next();               // q2
  engine.reveal();
  engine.next();               // the round board
  engine.next();               // the final, reached the ordinary way
  assert.equal(engine.state.phase, PHASES.FINAL);
  engine.back();
  assert.equal(engine.state.phase, PHASES.ROUND_BOARD);
  assert.equal(live(engine).length, 0, 'an undone final owes nobody a place yet');
});

/* ------------------------------------------------------------ the record */

/** A Session with a real archive folder we throw away afterwards. */
function withSession() {
  const dir = mkdtempSync(join(tmpdir(), 'stop-then-back-'));
  let at = Date.parse('2026-09-24T21:00:00.000Z');
  const saved = [];
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store,
    onPush: () => {},
    onArchive: (record) => saved.push(record),
    now: () => at,
    paths: { archive: dir },
  });
  session.build('quiz', QUIZ);
  return {
    session,
    saved,
    tick: (ms) => { at += ms; },
    nights: () => readdirSync(dir).filter((f) => f.endsWith('.json')),
    filed: () => {
      const [file] = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return JSON.parse(readFileSync(join(dir, file), 'utf8'));
    },
    done: () => { rmSync(dir, { recursive: true, force: true }); },
  };
}

test('THE FILED NIGHT IS UPDATED AT THE TRUE FINAL — one row, the real board, the real winner', () => {
  const it = withSession();
  try {
    const { session } = it;
    const engine = session.engine;
    engine.state.rewards = ['A pint'];
    const a = engine.join({ name: 'Alpha' });
    const b = engine.join({ name: 'Bravo' });
    engine.start();
    while (engine.state.phase !== PHASES.QUESTION) engine.next();
    it.tick(1000);
    engine.answer({ playerId: a.id, optionIndex: 1 });   // Alpha right, first
    it.tick(4000);
    engine.answer({ playerId: b.id, optionIndex: 1 });   // Bravo right, slower
    engine.reveal();
    engine.finish();                                     // the mis-press files the night
    assert.equal(it.nights().length, 1);
    assert.equal(it.filed().leaderboard[0].name, 'Alpha', 'filed with the early board');
    const earlyFinish = it.filed().finishedAt;

    engine.back();
    engine.next();                                       // q2
    it.tick(1000);
    engine.answer({ playerId: b.id, optionIndex: 2 });
    it.tick(5000);
    engine.answer({ playerId: a.id, optionIndex: 0 });
    engine.reveal();
    engine.next();                                       // the round board
    it.tick(30_000);
    engine.next();                                       // the true final

    assert.equal(it.nights().length, 1, 'one evening is one row, never two');
    const record = it.filed();
    assert.equal(record.leaderboard[0].name, 'Bravo', 'the record still says the early leader won');
    assert.equal(record.questions.length, 2, 'both questions are in the recap');
    assert.notEqual(record.finishedAt, earlyFinish, 'the finish time is the real one');
    const owed = (record.vouchers || []).filter((v) => !v.redeemedAt);
    assert.equal(owed.length, 1);
    assert.equal(owed[0].name, 'Bravo', 'the filed code is the true winner\'s');
    assert.ok(it.saved.length >= 2, 'and the backup was pushed again with the real board');
  } finally {
    it.done();
  }
});

test('a night sitting on its final scores is still not rewritten for nothing', () => {
  const it = withSession();
  try {
    const { session } = it;
    const engine = session.engine;
    engine.state.rewards = ['A pint'];
    const a = engine.join({ name: 'Alpha' });
    engine.start();
    while (engine.state.phase !== PHASES.QUESTION) engine.next();
    engine.answer({ playerId: a.id, optionIndex: 1 });
    engine.finish();
    const pushes = it.saved.length;
    for (let i = 0; i < 5; i += 1) engine.changed();
    assert.equal(it.saved.length, pushes, 'a push with nothing moved rewrote the filed night');
  } finally {
    it.done();
  }
});
