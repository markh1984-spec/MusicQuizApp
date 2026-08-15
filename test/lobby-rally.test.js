/**
 * RALLY — the second lobby game, and the one a BINGO night gets.
 *
 * The same two kinds of thing are worth pinning down as for Maze Mouth, and
 * neither is whether the game is fun.
 *
 * **That it cannot reach a bingo round.** A score arriving mid-game means a
 * phone still playing while a track is being called, and a leaderboard on the
 * projector at any phase but the lobby is two things on one screen. Both are
 * the one way this feature could make a night worse rather than better.
 *
 * **That every phone plays the SAME game.** The host's own catch — *"the game
 * has to be consistent or else the scoreboard makes no sense"* — which for a
 * bat and a ball means two things rather than one: the same seed has to give
 * the same serves, AND the tick has to be fixed, or two people on one board
 * are comparing their handsets' frame rates.
 *
 * And one thing the maze did not need: **that the game is playable at all.**
 * Winnable, loseable, and it ends. A bat-and-ball game that cannot be lost is
 * a stopwatch and one that cannot be won is a chore, and neither shows up in a
 * screenshot or in any other test here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BingoGame } from '../src/bingo.js';
import {
  COURT, BAT, BALL, TICK_MS, LIVES, newGame, tick, moveBat, playOut, serve,
} from '../public/assets/rally.js';
import { seeded } from '../public/assets/seeded.js';

/* --------------------------------------------------------------- the game */

/** A bot with a perfect bat. Not a person — a ceiling. */
const perfect = (g) => g.ball.x;
/** Somebody who never touches it. */
const idle = () => COURT.w / 2;
/**
 * A THUMB. Moves at most 0.7 court units a tick, which is slower than the
 * ball — the honest middle case, and the one the balance is judged on.
 */
const thumb = (g) => {
  const want = g.ball.x - g.batX;
  return g.batX + Math.max(-0.7, Math.min(0.7, want));
};

test('IT CAN BE LOST — somebody who never touches it runs out of lives', () => {
  const { game, finished } = playOut(4242, idle);
  assert.equal(finished, true, 'a game nobody played never ended');
  assert.equal(game.lives, 0);
  assert.equal(game.score, 0);
});

test('…but not before they have had a look at it', () => {
  /*
   * The first build served the instant a life was lost, so three lives were
   * gone in four and a half seconds — a game that ends before anybody has
   * understood what they are looking at. There is a beat before each serve
   * now, and this is the number that says so.
   */
  const { ticks } = playOut(4242, idle);
  const seconds = (ticks * TICK_MS) / 1000;
  assert.ok(seconds > 5, `three lives went in ${seconds.toFixed(1)}s`);
});

test('IT CAN BE WON FROM — a rally scores, and getting it past them scores more', () => {
  const { game, events } = playOut(4242, perfect, 6000);
  assert.ok(game.rallies > 5, `only ${game.rallies} rallies in a hundred seconds of perfect play`);
  assert.ok(events.includes('point'), 'the other bat never missed once');
  assert.ok(game.score > 0);
});

test('a thumb does better than nobody and worse than a bot', () => {
  // The middle case is the one the balance is actually judged on: a game only
  // a perfect tracker can score in is a game nobody in a pub can score in.
  for (const seed of [1, 4242, 999999]) {
    const none = playOut(seed, idle).game.score;
    const some = playOut(seed, thumb).game.score;
    const best = playOut(seed, perfect, 6000).game.score;
    assert.ok(some > none, `a thumb scored ${some} against ${none} for nobody (seed ${seed})`);
    assert.ok(some < best, `a thumb matched the bot on seed ${seed}`);
  }
});

test('a thumb gets a few minutes out of it, which is what the lobby is for', () => {
  // The whole reliability argument for this feature is that a phone with a
  // game on it stays in the FOREGROUND. Ten seconds of game does not do that.
  for (const seed of [1, 4242, 999999]) {
    const seconds = (playOut(seed, thumb).ticks * TICK_MS) / 1000;
    assert.ok(seconds > 30, `a game lasted ${seconds.toFixed(0)}s on seed ${seed}`);
  }
});

test('THE SAME SEED IS THE SAME GAME, every time', () => {
  // The host's catch. Two people on one leaderboard have to have faced the
  // same serves, or the higher score might only have been the luckier one.
  for (const seed of [1, 4242, 999999]) {
    const a = playOut(seed, thumb);
    const b = playOut(seed, thumb);
    assert.equal(a.game.score, b.game.score);
    assert.equal(a.ticks, b.ticks);
    assert.deepEqual(a.events, b.events);
  }
});

test('…and a different seed is a different game', () => {
  const a = playOut(1, thumb);
  const b = playOut(2, thumb);
  assert.notEqual(`${a.game.score}:${a.ticks}`, `${b.game.score}:${b.ticks}`);
});

test('THE SERVE ALWAYS COMES TOWARDS YOU, never away', () => {
  /*
   * Serving away is a free point to whoever happened to be looking, which is
   * not a score anybody earned — and on a board beside a join code an unearned
   * hundred is the one thing that would make the whole thing feel arbitrary.
   */
  const roll = seeded(99);
  for (let i = 0; i < 200; i++) {
    const b = serve(roll);
    assert.ok(b.vy > 0, 'a serve went towards the other bat');
    assert.ok(Math.abs(b.vx) > 0, 'a serve went straight down, which is a return you make without moving');
  }
});

test('the ball never leaves the court sideways, however fast it gets', () => {
  /*
   * A ball that overshoots a wall in one tick used to stick to it, flipping
   * direction every tick for the rest of the game — the fault a reflection
   * without a push-back always has, and it only appears once the ball is fast.
   */
  const g = newGame(7);
  for (let i = 0; i < 20_000 && !g.over; i++) {
    moveBat(g, perfect(g));
    tick(g);
    assert.ok(g.ball.x >= BALL.r - 0.001 && g.ball.x <= COURT.w - BALL.r + 0.001,
      `the ball reached x=${g.ball.x}`);
  }
});

test('a bat cannot be pushed off the end of the court', () => {
  const g = newGame(3);
  moveBat(g, -500);
  assert.equal(g.batX, BAT.w / 2);
  moveBat(g, 500);
  assert.equal(g.batX, COURT.w - BAT.w / 2);
});

test('a finished game stays finished, and ticking it again does nothing', () => {
  const { game } = playOut(4242, idle);
  const before = JSON.stringify({ s: game.score, l: game.lives });
  assert.equal(tick(game), null);
  assert.equal(JSON.stringify({ s: game.score, l: game.lives }), before);
});

test('three lives, and each one is banked on the way past', () => {
  // Banking at each life is what puts the people who played LONGEST on the
  // board: a game interrupted by the bingo starting never reaches game over.
  const { events } = playOut(4242, idle);
  assert.equal(events.filter((e) => e === 'life').length, LIVES - 1);
  assert.equal(events[events.length - 1], 'over');
});

/* ------------------------------------------------- reaching a bingo round */

const PACK = {
  id: 'test-bingo',
  title: 'Test bingo',
  cardSize: 4,
  tracks: Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, title: `Song ${i}`, artist: `Act ${i}` })),
};

const bingo = () => new BingoGame({ pack: PACK, now: () => 1_000 });

test('A SCORE IS REFUSED ANYWHERE BUT THE BINGO LOBBY', () => {
  const e = bingo();
  const join = e.join({ name: 'Norfolk N Chance' });
  assert.equal(e.arcadeScore(join.id, 120).ok, true);

  e.start();
  const mid = e.arcadeScore(join.id, 999);
  assert.equal(mid.ok, false);
  assert.equal(mid.reason, 'not_waiting');
  // …and the score it already had is untouched, not overwritten by the refusal.
  assert.equal(e.state.arcade[join.id], 120);
});

test('the bingo projector is told about it in the lobby and NOWHERE else', () => {
  const e = bingo();
  const join = e.join({ name: 'Quizteama Aguilera' });
  e.arcadeScore(join.id, 70);
  assert.deepEqual(e.screenView().arcade, [{ name: 'Quizteama Aguilera', score: 70 }]);

  e.start();
  assert.equal(e.screenView().arcade, undefined, 'a phone game is on the projector during the bingo');
});

test('the phone is given the seed in the bingo lobby and NOWHERE else', () => {
  const e = bingo();
  const join = e.join({ name: 'Agatha Quiztie' });
  const inLobby = e.playerView(join.id);
  assert.equal(typeof inLobby.gameSeed, 'number');
  assert.ok(inLobby.gameSeed > 0);

  e.start();
  assert.equal(e.playerView(join.id).gameSeed, undefined);
  assert.equal(e.playerView(join.id).arcadeBest, undefined);
});

test('an unknown phone cannot put a score on the bingo projector', () => {
  const e = bingo();
  assert.deepEqual(e.arcadeScore('nobody', 500), { ok: false, reason: 'unknown_player' });
  assert.equal(e.screenView().arcade, undefined);
});

test('the bingo board is the best, capped, and drops anybody who has left', () => {
  const e = bingo();
  const ids = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((n, i) => {
    const j = e.join({ name: n });
    e.arcadeScore(j.id, (i + 1) * 10);
    return j.id;
  });
  e.arcadeScore(ids[5], 5);   // a worse go does not replace a better one
  const board = e.arcadeBoard();
  assert.equal(board.length, 5, 'the board is not capped');
  assert.deepEqual(board.map((r) => r.score), [60, 50, 40, 30, 20]);
  e.removePlayer(ids[5]);
  assert.ok(!e.arcadeBoard().some((r) => r.name === 'Six'));
});

test('a bingo night restored from before this existed still has a seed', () => {
  // A night launched by an older deploy has no `gameSeed`, and a phone reading
  // `undefined` would fall back to its own random one — precisely the
  // unfairness the seed exists to remove. And no `arcade`, which used to throw.
  const e = bingo();
  const old = JSON.parse(JSON.stringify(e.state));
  delete old.gameSeed;
  delete old.arcade;
  const back = new BingoGame({ pack: PACK, state: old, now: () => 1 });
  const join = back.join({ name: 'Sirloin Steak' });
  assert.ok(back.playerView(join.id).gameSeed >= 1, 'a restored night handed the room no seed');
  assert.doesNotThrow(() => back.arcadeScore(join.id, 10));
});

test('the seed survives a restart, so the room does not get two different games', () => {
  const e = bingo();
  const saved = JSON.parse(JSON.stringify(e.state));
  saved.gameSeed = 4242;
  const back = new BingoGame({ pack: PACK, state: saved, now: () => 1 });
  const join = back.join({ name: 'Tequila Mockingbird' });
  assert.equal(back.playerView(join.id).gameSeed, 4242);
});

/* ------------------------------------------------------------- the naming */

test('NOTHING IN THE GAME IS CALLED PONG OR BREAKOUT', async () => {
  /*
   * A legal line rather than a taste one, and the same one Maze Mouth is drawn
   * along: the names are Atari's and this app is SOLD. CLAUDE.md already
   * records that an unnamed game keeps inviting the wrong name — so this
   * checks the words as well as trusting the paragraph.
   */
  const { readFile } = await import('node:fs/promises');
  for (const f of ['rally.js', 'lobby-rally.js', 'lobby-menu.js']) {
    const text = await readFile(new URL(`../public/assets/${f}`, import.meta.url), 'utf8');
    // Said once each in rally.js, in the paragraph explaining why they cannot
    // be used. Anywhere a player could see one is a different matter.
    const shown = text.split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');
    assert.ok(!/\bpong\b/i.test(shown), `${f} says "Pong" outside a comment`);
    assert.ok(!/\bbreakout\b/i.test(shown), `${f} says "Breakout" outside a comment`);
  }
});
