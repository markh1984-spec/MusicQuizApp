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
import { MAZE, COLS, ROWS, pellets, reachable, startPoints, open, stepToward, turnFrom } from '../public/assets/maze.js';

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

/**
 * THE BOARD NAMES THE GAME, and both halves are checked here for the reason
 * this file already records: `arcade` was in the payload, tested, documented as
 * being on screen — and no projector file ever read it, for as long as the
 * feature existed. **Asserting a field is present proves nothing about whether
 * anybody draws it.**
 *
 * So: the payload carries the id, and the one file that draws the board reads
 * it. The second half is a source check and is deliberately weak — the real
 * proof is pressing it in a browser, which is how this was verified
 * ("Top scores · Tailback" at 1280x720 with four teams on it).
 */
test('the board is told WHICH GAME the scores are at, and only with a board', () => {
  const { e } = game();
  e.state.lobbyGame = 'tailback';

  // No board, no field — a name for an empty scoreboard is a hole on screen.
  assert.equal(e.screenView().lobbyGame, undefined, 'named a game with no scores under it');

  const join = e.join({ name: 'Quizteama Aguilera' });
  e.arcadeScore(join.id, 70);
  assert.equal(e.screenView().lobbyGame, 'tailback');

  // Never outside the lobby, exactly like the board it labels.
  e.start();
  assert.equal(e.screenView().lobbyGame, undefined);
});

test('a night launched before lobbyGame existed names no game rather than the wrong one', () => {
  const { e } = game();
  delete e.state.lobbyGame;
  const join = e.join({ name: 'Quizteama Aguilera' });
  e.arcadeScore(join.id, 70);
  const view = e.screenView();
  assert.ok(view.arcade.length, 'the board itself must still be there');
  assert.equal(view.lobbyGame, undefined,
    'a missing id must degrade to a bare "Top scores" — the resolver that would guess one lives '
    + 'on the phone, where the tier is known, and naming the wrong game on the big screen is '
    + 'worse than naming none');
});

test('the projector actually READS it — the fault this whole file remembers', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../public/assets/lobby-board.js', import.meta.url), 'utf8');
  assert.match(src, /lobbyGameById/, 'lobby-board.js no longer resolves the game name');
  assert.match(src, /s\.lobbyGame/, 'lobby-board.js no longer reads the field the payload sends');
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

/*
 * ---- A TURN PRESSED EARLY IS REMEMBERED ---------------------------------
 *
 * Reported off the live game: *"the turning corners function is a little
 * glitchy — usually you can press left or right ahead of the next turn and
 * it'll remember to turn that way?"*
 *
 * It was worse than glitchy. The arrow handler set a TARGET by running as far
 * down the corridor as it could, so with a wall that way the run never
 * happened and the target came out as the cell the player was standing on —
 * which `stepToward()` answers with null. Pressing a turn a moment early
 * therefore STOPPED THE PLAYER DEAD, in front of three chasers, until they
 * pressed again. From the starting cell both Up and Down do it.
 */

const LEFT = [-1, 0];
const RIGHT = [1, 0];
const UP = [0, -1];
const DOWN = [0, 1];

test('THE OLD ARROW HANDLER STOPPED YOU DEAD — the fault, pinned', () => {
  /*
   * Kept as a test of `stepToward` rather than of deleted code: it is the
   * property the old handler leant on, and it is still true. Anybody
   * reintroducing "run down the corridor and target the far end" gets a null
   * step the moment there is a wall that way.
   */
  const you = startPoints().player;
  assert.equal(open(you.col + UP[0], you.row + UP[1]), false, 'the start cell should have a wall above it');
  let col = you.col;
  let row = you.row;
  while (open(col + UP[0], row + UP[1])) { col += UP[0]; row += UP[1]; }
  assert.deepEqual({ col, row }, { col: you.col, row: you.row },
    'a blocked run targets the cell you are standing on');
  assert.equal(stepToward(you, { col, row }), null,
    'and a target of your own cell is a null step — which is the player stopping dead');
});

test('a turn that is legal right now happens on the next step', () => {
  const you = startPoints().player;
  assert.equal(open(you.col + LEFT[0], you.row + LEFT[1]), true, 'the start cell should be open to the left');
  const out = turnFrom(you, RIGHT, LEFT, 6);
  assert.deepEqual(out.dir, LEFT);
  assert.deepEqual(out.heading, LEFT, 'taking the turn has to become the new heading');
  assert.equal(out.want, null, 'a turn that was taken must not stay buffered');
});

test('a turn into a wall does NOT stop you — you carry on and it waits', () => {
  // The whole bug, stated as the behaviour that replaces it.
  const you = startPoints().player;
  const out = turnFrom(you, LEFT, UP, 6);
  assert.deepEqual(out.dir, LEFT, 'pressing a blocked turn stopped the player dead');
  assert.deepEqual(out.want, UP, 'the turn was forgotten instead of being remembered');
  assert.equal(out.wantFor, 5, 'the buffer has to tick down or it never expires');
});

test('and it FIRES at the first cell where it becomes legal', () => {
  /*
   * The sentence he actually wrote: *"press left or right ahead of the next
   * turn and it'll remember to turn that way"*. Walk the corridor with the
   * turn held and assert it is taken at the first opening rather than missed.
   */
  const you = { ...startPoints().player };
  let heading = LEFT;
  let want = UP;
  let wantFor = 6;
  let turned = null;
  let at = { ...you };
  for (let i = 0; i < 6 && !turned; i++) {
    const out = turnFrom(at, heading, want, wantFor);
    heading = out.heading;
    want = out.want;
    wantFor = out.wantFor;
    if (!out.dir) break;
    if (out.dir === UP) { turned = { ...at }; break; }
    at = { col: at.col + out.dir[0], row: at.row + out.dir[1] };
  }
  assert.ok(turned, 'walking left with Up held never took the turn at an opening');
  assert.equal(open(turned.col, turned.row - 1), true,
    'it turned at a cell with no opening above it');
});

test('the buffer expires, so a forgotten press cannot turn you later', () => {
  // A turn nobody remembers asking for is worse than one that did not happen.
  const you = startPoints().player;
  let want = UP;
  let wantFor = 1;
  const out = turnFrom(you, LEFT, want, wantFor);
  assert.equal(out.want, null, 'the last step of the buffer should drop it');
  assert.deepEqual(out.dir, LEFT, 'and it must not stop the player on the way out');
});

test('running into a wall stops you facing it, and never picks a way for you', () => {
  const you = startPoints().player;
  const out = turnFrom(you, UP, null, 0);
  assert.equal(out.dir, null, 'it should stop rather than invent a direction');
  assert.equal(out.heading, null, 'and let go of the heading it could not follow');
});
