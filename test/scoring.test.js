/**
 * The scoring maths, tested against the rules as written in the brief:
 *
 *   100 for a correct answer
 * + 10 for every whole second left on the clock
 * + 100 for the first correct answer of that question
 *
 * Every timestamp here is a number we chose, so these tests are instant and
 * can never be flaky — nothing waits on a real clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreAnswer, wholeSecondsRemaining, responseSeconds, rankPlayers } from '../src/scoring.js';

const START = 1_700_000_000_000;
const ENDS = START + 20_000; // a twenty second question

test('the worked example from the brief: fourteen seconds left scores 240', () => {
  const answeredAt = ENDS - 14_000;
  assert.equal(scoreAnswer({ correct: true, answeredAt, endsAt: ENDS }), 240);
});

test('and 340 if you were also first', () => {
  const answeredAt = ENDS - 14_000;
  assert.equal(scoreAnswer({ correct: true, answeredAt, endsAt: ENDS, isFirstCorrect: true }), 340);
});

test('a wrong answer scores nothing, however fast it was', () => {
  assert.equal(scoreAnswer({ correct: false, answeredAt: START + 10, endsAt: ENDS }), 0);
  assert.equal(scoreAnswer({ correct: false, answeredAt: START + 10, endsAt: ENDS, isFirstCorrect: true }), 0);
});

test('only whole seconds count, so part-seconds are rounded down', () => {
  // 14.9 seconds left is still fourteen whole seconds.
  assert.equal(scoreAnswer({ correct: true, answeredAt: ENDS - 14_900, endsAt: ENDS }), 240);
  // 14.0 exactly is fourteen.
  assert.equal(scoreAnswer({ correct: true, answeredAt: ENDS - 14_000, endsAt: ENDS }), 240);
  // 13.999 is thirteen.
  assert.equal(scoreAnswer({ correct: true, answeredAt: ENDS - 13_999, endsAt: ENDS }), 230);
});

test('answering the instant it appears scores the lot', () => {
  assert.equal(scoreAnswer({ correct: true, answeredAt: START, endsAt: ENDS, isFirstCorrect: true }), 400);
});

test('answering as the clock hits zero still scores the base 100', () => {
  assert.equal(scoreAnswer({ correct: true, answeredAt: ENDS, endsAt: ENDS }), 100);
  assert.equal(scoreAnswer({ correct: true, answeredAt: ENDS - 1, endsAt: ENDS }), 100);
});

test('an answer somehow arriving after the clock never scores negative points', () => {
  assert.equal(wholeSecondsRemaining(ENDS + 5_000, ENDS), 0);
  assert.equal(scoreAnswer({ correct: true, answeredAt: ENDS + 5_000, endsAt: ENDS }), 100);
});

test('response time is reported to one decimal place', () => {
  assert.equal(responseSeconds(START + 2_840, START), 2.8);
  assert.equal(responseSeconds(START + 2_850, START), 2.9);
  assert.equal(responseSeconds(START - 500, START), 0);
});

test('the leaderboard sorts on score, then on who was quicker overall', () => {
  const ranked = rankPlayers([
    { name: 'Slow but right', score: 500, totalResponseMs: 40_000 },
    { name: 'Quick and right', score: 500, totalResponseMs: 12_000 },
    { name: 'Runaway leader', score: 900, totalResponseMs: 60_000 },
  ]);
  assert.deepEqual(ranked.map((p) => p.name), ['Runaway leader', 'Quick and right', 'Slow but right']);
});

test('teams on the same score share a position, and the next position skips', () => {
  const ranked = rankPlayers([
    { name: 'A', score: 300, totalResponseMs: 100 },
    { name: 'B', score: 200, totalResponseMs: 100 },
    { name: 'C', score: 200, totalResponseMs: 100 },
    { name: 'D', score: 100, totalResponseMs: 100 },
  ]);
  assert.deepEqual(ranked.map((p) => p.position), [1, 2, 2, 4]);
});

test('ranking does not mutate the players it was given', () => {
  const players = [{ name: 'A', score: 10, totalResponseMs: 1 }];
  rankPlayers(players);
  assert.equal('position' in players[0], false);
});
