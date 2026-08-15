/**
 * QUICK DRAW — the fourth lobby game.
 *
 * Two things are worth pinning down that the other three did not need:
 *
 * **THAT THE SCHEDULE IS THE SAME ON ANY HANDSET.** This is the third answer
 * this codebase has given to one fairness problem — a grid, an accumulator,
 * and now a schedule — and it is the strongest: the state at time T is a pure
 * function of the seed and T, so a phone sampling the clock every 8ms and one
 * managing 120ms must land in exactly the same place.
 *
 * **AND THAT MASHING LOSES.** The whole reason there is a sheriff. Nobody had
 * to write a rule against tapping wildly; tapping wildly shoots the sheriff,
 * and the test is what says so rather than the paragraph.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLS, ROWS, SLOTS, LIVES, OUTLAW, FRIEND,
  newGame, runTo, shoot, showing, playOut,
} from '../public/assets/quickdraw.js';

const SEEDS = [1, 4242, 999999, 5];

/** Shoots the first outlaw showing and never anybody else. A ceiling. */
const sharp = (g, up) => {
  const o = up.find((p) => p.kind === OUTLAW);
  return o ? o.slot : null;
};
/** Never touches it. */
const idle = () => null;
/** Taps every slot in turn as fast as it can. */
const masher = () => { let i = 0; return () => i++ % SLOTS; };

/* ------------------------------------------------------- the same game */

test('THE SCHEDULE IS IDENTICAL AT ANY FRAME RATE', () => {
  /*
   * With nobody playing, the whole world is the schedule — so if a phone that
   * looks at the clock every 120ms dies at a different moment from one looking
   * every 8ms, then the board is comparing handsets.
   *
   * This is the property the other games get from a grid or an accumulator,
   * and it is exact here rather than approximate: nothing accumulates, so
   * there is nothing to drift.
   */
  for (const seed of SEEDS) {
    const at = [8, 16, 33, 50, 120].map((frameMs) => playOut(seed, idle, { frameMs }).game.at);
    assert.equal(new Set(at).size, 1, `seed ${seed}: died at ${at.join(', ')} on different frame rates`);
  }
});

test('…and the same shots at the same moments give the same score', () => {
  /*
   * The half that CAN hold once a player is involved. A reaction game makes
   * input latency part of the score and no amount of engineering removes that
   * — a slower handset really does report a touch later. What must not also
   * vary is the game underneath it.
   */
  const script = () => {
    const times = [1000, 2000, 3000, 4000, 5000];
    let i = 0;
    return (g, up) => {
      if (i >= times.length || g.at < times[i]) return null;
      i++;
      const o = up.find((p) => p.kind === OUTLAW);
      return o ? o.slot : null;
    };
  };
  const scores = [1, 2, 4].map((frameMs) => playOut(4242, script(), { frameMs }).game.score);
  assert.equal(new Set(scores).size, 1, `scored ${scores.join(', ')} at different sampling rates`);
});

test('a phone that froze does not get an easier game', () => {
  // Jumping straight to `t` would let a stuttering handset skip the outlaws
  // who drew while it was busy. They drew.
  const slow = newGame(4242);
  const fast = newGame(4242);
  runTo(slow, 6_000);                                   // one enormous step
  for (let t = 0; t <= 6_000; t += 16) runTo(fast, t);  // and the same in frames
  assert.equal(slow.lives, fast.lives);
  assert.equal(slow.at, fast.at);
});

test('THE SAME SEED IS THE SAME GAME, and a different one is not', () => {
  for (const seed of SEEDS) {
    const a = playOut(seed, sharp);
    const b = playOut(seed, sharp);
    assert.equal(a.game.score, b.game.score);
    assert.equal(a.game.at, b.game.at);
  }
  assert.notEqual(playOut(1, sharp).game.score, playOut(2, sharp).game.score);
});

/* ----------------------------------------------------------- the rules */

test('AN OUTLAW LEFT ALONE DRAWS ON YOU', () => {
  // The reason to hurry, and what makes this a game rather than a patience
  // test: ignoring one is not neutral, it costs a life.
  const { game, events, finished } = playOut(4242, idle);
  assert.equal(finished, true, 'a game nobody played never ended');
  assert.ok(events.includes('drew'));
  assert.equal(game.lives, 0);
  assert.equal(game.score, 0);
});

test('MASHING EVERY SLOT LOSES — the game is its own anti-cheat', () => {
  /*
   * Nobody had to write "you may not tap wildly". Roughly a quarter of
   * everyone who pops up is somebody you must not shoot, so a masher runs out
   * of lives fast and scores a fraction of what a player does. That is worth
   * more than a penalty a player cannot see the reason for.
   */
  for (const seed of SEEDS) {
    const mash = playOut(seed, masher());
    const play = playOut(seed, sharp);
    assert.equal(mash.finished, true, `seed ${seed}: a masher survived`);
    assert.ok(mash.game.score < play.game.score / 10,
      `seed ${seed}: mashing scored ${mash.game.score} against a player's ${play.game.score}`);
  }
});

test('shooting the sheriff costs a life; shooting thin air costs nothing', () => {
  const g = newGame(4242);
  // Early, and deliberately so: with nobody playing this game is over by
  // 3.8 seconds, and a shot at a finished game is 'ignored' rather than 'air'.
  runTo(g, 1_000);
  assert.equal(g.over, false, 'the game was already lost before the test began');
  const empty = [...Array(SLOTS).keys()].find((s) => !showing(g).some((p) => p.slot === s));
  const before = g.lives;
  assert.equal(shoot(g, empty), 'air');
  assert.equal(g.lives, before, 'a shot at an empty hole cost a life');

  // And a real sheriff, wherever the schedule next puts one.
  const found = newGame(1);
  for (let t = 0; t < 60_000 && !found.over; t += 10) {
    runTo(found, t);
    const friend = showing(found).find((p) => p.kind === FRIEND);
    if (!friend) continue;
    const had = found.lives;
    assert.equal(shoot(found, friend.slot), 'sheriff');
    assert.equal(found.lives, had - 1, 'shooting the sheriff was free');
    return;
  }
  assert.fail('no sheriff ever appeared');
});

test('two figures never share a hole', () => {
  // A tap that could mean either is the app taking the life rather than the
  // player losing it — and one of the two costs a life.
  for (const seed of SEEDS) {
    const g = newGame(seed);
    for (let t = 0; t < 90_000 && !g.over; t += 7) {
      runTo(g, t);
      const slots = showing(g).map((p) => p.slot);
      assert.equal(new Set(slots).size, slots.length, `seed ${seed}: two in one hole`);
    }
  }
});

test('quicker is worth more, measured against the window you actually had', () => {
  /*
   * Never against a fixed number of milliseconds: the window tightens as the
   * game goes on, so a flat scale would quietly make the late hard shots worth
   * less than the early easy ones — the reveal-curve fault this app already
   * records against the picture round.
   */
  const quick = newGame(4242);
  const slow = newGame(4242);
  const firstOutlaw = (g) => {
    for (let t = 0; t < 30_000; t += 5) {
      runTo(g, t);
      const o = showing(g).find((p) => p.kind === OUTLAW);
      if (o) return o;
    }
    return null;
  };
  const a = firstOutlaw(quick);
  shoot(quick, a.slot);
  const b = firstOutlaw(slow);
  runTo(slow, b.downAt - 30);          // leave it until the last moment
  shoot(slow, b.slot);
  assert.ok(quick.score > slow.score, `quick ${quick.score} did not beat slow ${slow.score}`);
  assert.ok(slow.score > 0, 'a late but valid shot scored nothing');
});

test('a finished game ignores everything after it', () => {
  const { game } = playOut(4242, idle);
  const before = game.score;
  assert.equal(shoot(game, 0), 'ignored');
  assert.deepEqual(runTo(game, 999_999), []);
  assert.equal(game.score, before);
});

test('three lives, and the wall is the shape it says it is', () => {
  assert.equal(SLOTS, COLS * ROWS);
  assert.equal(newGame(1).lives, LIVES);
});

/* ---------------------------------------------------------- the naming */

test('the game does not print a real firearm or anybody real', async () => {
  /*
   * A cartoon shooting gallery is a fairground stall, and this one stays that:
   * silhouettes, a bandana and a star. No brand of gun, no named person, and
   * nothing that reads as anything but the Wild West — the same instinct that
   * keeps photoreal pictures of living musicians out of `portraits.js`.
   */
  const { readFile } = await import('node:fs/promises');
  const words = /\b(colt|winchester|remington|glock|smith\s*&\s*wesson)\b/i;
  for (const f of ['quickdraw.js', 'lobby-quickdraw.js']) {
    const text = await readFile(new URL(`../public/assets/${f}`, import.meta.url), 'utf8');
    assert.ok(!words.test(text), `${f} names a real firearm`);
  }
});
