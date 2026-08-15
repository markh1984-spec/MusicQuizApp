/**
 * THE LOBBY GAME.
 *
 * Two kinds of thing are worth pinning down here, and neither is the game
 * itself — nobody's night depends on whether the chasers are fun.
 *
 * **That it cannot reach a quiz.** A score arriving mid-question means a phone
 * still playing while the room is being read a question, and a leaderboard on
 * a projector at any phase but the lobby is two things on one screen. Both are
 * the one way this feature could make a night worse rather than better.
 *
 * **That every phone plays the SAME game.** The host's own catch — *"the game
 * has to be consistent or else the scoreboard makes no sense"* — so the seed
 * lives in the state, survives a restart, and is the same for everybody.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine } from '../src/engine.js';
import { MAZE, COLS, ROWS, pellets, reachable, startPoints, open } from '../public/assets/maze.js';

const QUIZ = {
  id: 'test',
  title: 'Test quiz',
  rounds: [{
    title: 'One',
    type: 'text',
    questions: [
      { prompt: 'A?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
      { prompt: 'B?', options: ['a', 'b', 'c', 'd'], correctIndex: 1 },
    ],
  }],
};

function game() {
  let at = 1_000;
  const e = new Engine({ quiz: QUIZ, now: () => at });
  return { e, tick: (ms) => { at += ms; } };
}

/* ------------------------------------------------------------- the maze */

test('EVERY PELLET CAN BE REACHED — a walled-off one is a game nobody finishes', () => {
  /*
   * The fault this catches survives every other check: the maze looks fine,
   * nothing throws, and the only way to find it is to play to the end and
   * discover the last pellet is behind a wall. A flood fill turns that into
   * something a machine says in a millisecond.
   */
  const seen = reachable();
  const stuck = pellets().filter((p) => !seen.has(`${p.col},${p.row}`));
  assert.deepEqual(stuck, [], 'there are pellets nobody can get to');
});

test('every chaser starts somewhere it can move from', () => {
  // A chaser boxed in by walls is a decoration rather than a threat, and it
  // happened on the first draft of this maze.
  const { chasers, player } = startPoints();
  assert.ok(chasers.length >= 2, 'a chase needs more than one chaser');
  assert.ok(player, 'the maze has nowhere for the player to start');
  const seen = reachable();
  for (const c of chasers) {
    assert.ok(seen.has(`${c.col},${c.row}`),
      `a chaser starts at ${c.col},${c.row} where the player can never meet it`);
    const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => open(c.col + dc, c.row + dr));
    assert.ok(ways.length >= 2, `a chaser at ${c.col},${c.row} is in a dead end`);
  }
});

test('the maze is a rectangle and is walled all the way round', () => {
  for (const row of MAZE) assert.equal(row.length, COLS, `a row is ${row.length} not ${COLS}`);
  assert.equal(MAZE.length, ROWS);
  for (let c = 0; c < COLS; c++) {
    assert.equal(MAZE[0][c], '#', 'the top is open');
    assert.equal(MAZE[ROWS - 1][c], '#', 'the bottom is open');
  }
  for (let r = 0; r < ROWS; r++) {
    assert.equal(MAZE[r][0], '#', 'the left is open');
    assert.equal(MAZE[r][COLS - 1], '#', 'the right is open');
  }
});

/* ------------------------------------------------------- reaching a quiz */

test('A SCORE IS REFUSED ANYWHERE BUT THE LOBBY', () => {
  const { e } = game();
  const join = e.join({ name: 'Norfolk N Chance' });
  assert.equal(e.arcadeScore(join.id, 120).ok, true);

  e.start();
  e.askQuestion();
  const mid = e.arcadeScore(join.id, 999);
  assert.equal(mid.ok, false);
  assert.equal(mid.reason, 'not_waiting');
  // …and the score it already had is untouched, not overwritten by the refusal.
  assert.equal(e.state.arcade[join.id], 120);
});

test('the projector is told about it in the lobby and NOWHERE else', () => {
  const { e } = game();
  const join = e.join({ name: 'Quizteama Aguilera' });
  e.arcadeScore(join.id, 70);
  assert.deepEqual(e.screenView().arcade, [{ name: 'Quizteama Aguilera', score: 70 }]);

  e.start();
  assert.equal(e.screenView().arcade, undefined, 'a phone game is on the projector during the quiz');
  e.askQuestion();
  assert.equal(e.screenView().arcade, undefined);
  e.reveal();
  assert.equal(e.screenView().arcade, undefined);
});

test('the phone is given the seed in the lobby and NOWHERE else', () => {
  // A phone still holding a seed at question one is a phone that could still
  // be playing, and the whole design of this app is a room looking up.
  const { e } = game();
  const join = e.join({ name: 'Agatha Quiztie' });
  const inLobby = e.playerView(join.id);
  assert.equal(typeof inLobby.gameSeed, 'number');
  assert.ok(inLobby.gameSeed > 0);

  e.start();
  e.askQuestion();
  assert.equal(e.playerView(join.id).gameSeed, undefined);
  assert.equal(e.playerView(join.id).arcadeBest, undefined);
});

test('an unknown phone cannot put a score on the projector', () => {
  const { e } = game();
  assert.deepEqual(e.arcadeScore('nobody', 500), { ok: false, reason: 'unknown_player' });
  assert.deepEqual(e.screenView().arcade, undefined);
});

/* ------------------------------------------------------------ the scores */

test('THE BEST, NOT THE LATEST — one more go while the host talks cannot lose it', () => {
  const { e } = game();
  const join = e.join({ name: 'The Quizzly Bears' });
  e.arcadeScore(join.id, 300);
  e.arcadeScore(join.id, 40);
  assert.equal(e.state.arcade[join.id], 300);
  assert.deepEqual(e.screenView().arcade, [{ name: 'The Quizzly Bears', score: 300 }]);
});

test('a score is clamped rather than trusted, because a phone can send anything', () => {
  const { e } = game();
  const join = e.join({ name: 'E=MC Hammer' });
  e.arcadeScore(join.id, 10 ** 12);
  assert.ok(e.state.arcade[join.id] <= 99999);
  const other = e.join({ name: 'Trivia Newton John' });
  e.arcadeScore(other.id, -50);
  assert.equal(e.state.arcade[other.id], undefined, 'a negative score was recorded');
  const third = e.join({ name: 'Les Quizerables' });
  e.arcadeScore(third.id, 'lots');
  assert.equal(e.state.arcade[third.id], undefined);
});

test('the board is best first, capped, and drops anybody who has left', () => {
  const { e } = game();
  const names = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  const ids = names.map((n, i) => {
    const j = e.join({ name: n });
    e.arcadeScore(j.id, (i + 1) * 10);
    return j.id;
  });
  const board = e.arcadeBoard();
  assert.equal(board.length, 5, 'the board is not capped');
  assert.deepEqual(board.map((r) => r.score), [60, 50, 40, 30, 20]);

  // Somebody removed by the host leaves a score with nobody attached, which is
  // a puzzle on a projector rather than a result.
  e.removePlayer(ids[5]);
  assert.ok(!e.arcadeBoard().some((r) => r.name === 'Six'));
});

/* --------------------------------------------------------------- the seed */

test('THE SEED SURVIVES A RESTART, so the room does not get two different games', () => {
  const { e } = game();
  const saved = JSON.parse(JSON.stringify(e.state));
  saved.gameSeed = 4242;
  const back = new Engine({ quiz: QUIZ, state: saved, now: () => 1 });
  const join = back.join({ name: 'Tequila Mockingbird' });
  assert.equal(back.playerView(join.id).gameSeed, 4242);
});

test('a game restored from before this existed still has a seed rather than none', () => {
  // A night launched by an older deploy has no `gameSeed`, and a phone reading
  // `undefined` would fall back to its own random one — which is precisely the
  // unfairness the seed exists to remove.
  const { e } = game();
  const old = JSON.parse(JSON.stringify(e.state));
  delete old.gameSeed;
  delete old.arcade;
  const back = new Engine({ quiz: QUIZ, state: old, now: () => 1 });
  const join = back.join({ name: 'Sirloin Steak' });
  const view = back.playerView(join.id);
  assert.ok(view.gameSeed >= 1, 'a restored night handed the room no seed at all');
  assert.doesNotThrow(() => back.arcadeScore(join.id, 10));
});
