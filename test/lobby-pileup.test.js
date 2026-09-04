/**
 * PILE UP — the fifth lobby game.
 *
 * The tests that matter are the fairness ones, as with the other four: every
 * phone in the room must play the identical game, and a slow handset must not
 * play a different one from a fast handset. Everything else is the shape of
 * the difficulty curve, which is worth pinning because it is the thing a
 * casual change to a constant silently ruins.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  W, H, CRATE_H, LIVES, newGame, runTo, dropAt, crateAt, top, speed, playOut,
} from '../public/assets/pileup.js';

/** A player who aims at the crate below and is off by up to `slop`. */
const human = (slop) => (g, t) => {
  const c = crateAt(g, t);
  return Math.abs(c.x - top(g).x) <= slop;
};

/* ------------------------------------------------ the fairness guarantees */

test('THE SAME GAME AT ANY FRAME RATE — nothing accumulates, so nothing drifts', () => {
  /*
   * The whole reason this is a SCHEDULE rather than an accumulator. A 120Hz
   * phone and a tired 30Hz one must land in the same place, or two people on
   * one leaderboard are comparing handsets rather than play. Rally needed a
   * capped accumulator for this; here it falls out of the crate's position
   * being a pure function of the clock.
   */
  /*
   * THE CONTROLLER FIRES ON THE CLOCK, NOT ON WHAT IT CAN SEE — and getting
   * that wrong is what this comment is for. A controller that drops when the
   * crate LOOKS lined up samples different positions at different frame rates
   * and so taps at different moments: it fails this test while the game is
   * perfectly sound. The claim being made is "the same taps at the same
   * moments give the same game", so the taps have to be pinned to the clock.
   */
  const everyNth = (ms) => { let last = -1; return (g, t) => { if (t - last >= ms) { last = t; return true; } return false; }; };
  const shape = (g) => JSON.stringify([g.score, g.placed, g.lives, g.perfects, g.stack.length]);
  const results = [8, 16, 32, 64].map((frameMs) => playOut(7, everyNth(640), { frameMs, maxMs: 90_000 }));
  assert.equal(new Set(results.map(shape)).size, 1,
    `the same game played out differently at different frame rates: ${results.map(shape).join(' vs ')}`);
});

test('a phone that misses a whole second lands where every other phone is', () => {
  // The catch-up case, stated directly: a browser that was busy must not be
  // able to hand somebody an easier or a harder game.
  const steady = newGame(3);
  for (let t = 0; t <= 4000; t += 16) runTo(steady, t);
  const stalled = newGame(3);
  runTo(stalled, 1000);
  runTo(stalled, 4000);
  assert.deepEqual(crateAt(stalled, 4000), crateAt(steady, 4000));
});

test('a drop resolves at the moment of the tap, not at the last frame', () => {
  /*
   * The swing is continuous, so resolving a tap a frame late costs real width
   * on a slow phone and none on a fast one — the handset in the score, which
   * is the exact thing the seed exists to keep out.
   */
  const a = newGame(5);
  const b = newGame(5);
  runTo(a, 900);
  dropAt(a, 900);
  // b's canvas was a frame behind and only ran to 884 before the same tap.
  runTo(b, 884);
  dropAt(b, 900);
  assert.deepEqual(a.stack, b.stack, 'the drop used the frame time rather than the tap time');
});

/* ------------------------------------------------------------- the rules */

test('there is no timer — a phone left alone never loses', () => {
  // It is a lobby game on a table in a pub. Losing while nobody is holding it
  // would put junk on the board and punish somebody for going to the bar.
  const g = playOut(7, () => false, { frameMs: 16, maxMs: 120_000 });
  assert.equal(g.over, false);
  assert.equal(g.lives, LIVES);
  assert.equal(g.score, 0);
});

test('the overhang shears off, so the tower narrows when you are out', () => {
  const g = newGame(11);
  const before = top(g).w;
  /*
   * A PARTIAL overlap, which is the case being tested — and the first version
   * of this searched only for "not lined up", found t = 0 with the crate flat
   * against the wall, and got a total MISS instead. A miss widens the tower
   * back out, so the test read as the shear not happening at all.
   */
  let t = 0;
  const off = () => Math.abs(crateAt(g, t).x - top(g).x);
  while ((off() < 30 || off() > before - 30) && t < 20_000) t += 4;
  assert.ok(t < 20_000, 'never found a partially overlapping moment to drop on');
  dropAt(g, t);
  assert.ok(top(g).w < before, 'a crate dropped off-centre kept its full width');
  assert.ok(top(g).w > 0, 'the whole crate sheared away');
});

test('a clean drop keeps the full width and scores double', () => {
  /*
   * Without this the tower only ever narrows, and every game ends at about the
   * same height whoever is playing — which takes the skill out of a skill
   * game. It is a reward and never a requirement.
   */
  const g = newGame(11);
  const wide = top(g).w;
  let t = 0;
  while (Math.abs(crateAt(g, t).x - top(g).x) > 2 && t < 20_000) t += 4;
  const events = dropAt(g, t);
  assert.ok(events.includes('perfect'), 'a dead-centre drop was not counted as clean');
  assert.equal(top(g).w, wide, 'a clean drop lost width');
  assert.ok(g.score > 10, 'a clean drop scored the same as a scruffy one');
});

test('losing a life widens the top back out rather than resetting the tower', () => {
  /*
   * Starting again from one crate would make the second life worth nothing —
   * you would be re-earning what you already had — and this game banks a score
   * at every life lost, which would make those banks meaningless.
   */
  const g = playOut(7, human(60), { frameMs: 16, maxMs: 60_000 });
  assert.ok(g.lives < LIVES, 'a sloppy player did not lose a life at all');
  assert.ok(g.stack.length > 1, 'the tower was reset to nothing on a lost life');
});

test('three lives and then it is over, with the score kept', () => {
  const g = playOut(7, () => true, { frameMs: 16, maxMs: 60_000 });
  assert.equal(g.over, true);
  assert.equal(g.lives, 0);
  assert.ok(g.score >= 0);
});

/* -------------------------------------------------------- the difficulty */

test('the difficulty curve rewards aim, and a scruffy player still gets a game', () => {
  /*
   * Pinned because it is what a one-word change to a constant silently ruins.
   * A lobby game somebody loses in two taps is one nobody presses twice, and
   * one nobody can lose is not worth a leaderboard.
   */
  const crates = (slop) => {
    const runs = [1, 2, 3, 4, 5, 6].map((s) => playOut(s, human(slop), { frameMs: 16, maxMs: 90_000 }));
    return runs.reduce((a, g) => a + g.placed, 0) / runs.length;
  };
  const scruffy = crates(70);
  const decent = crates(20);
  const good = crates(10);
  assert.ok(scruffy >= 3, `a scruffy player only stacked ${scruffy} crates — too short to be fun`);
  assert.ok(decent > scruffy, 'aiming better did not get further');
  assert.ok(good > decent, 'aiming better still did not get further');
});

test('the crate speeds up as the tower grows, and is capped', () => {
  const g = newGame(2);
  const first = speed(g);
  g.placed = 4;
  assert.ok(speed(g) > first, 'the game never gets harder');
  g.placed = 10_000;
  assert.ok(speed(g) < 1, 'the crate outruns anybody at the top of a long game');
});

/* ----------------------------------------------------------- the naming */

test('it is a crate stacker and must never become the falling-blocks one', async () => {
  /*
   * The same legal line the first three games were named around, and here it
   * decided the GAME rather than only its title: the seven tetromino shapes,
   * the playfield and their colours were held to be protectable expression in
   * Tetris Holding v. Xio, and this app is SOLD. A stacker has none of it —
   * no rotation, no shapes, no line clears, no well.
   */
  const { readFileSync } = await import('node:fs');
  const words = /\b(tetris|tetromino|rotate|line\s*clear|wall\s*kick)\b/i;
  for (const f of ['pileup.js', 'lobby-pileup.js']) {
    const text = readFileSync(new URL(`../public/assets/${f}`, import.meta.url), 'utf8')
      // The note explaining WHY names it, deliberately. Strip the comments, or
      // this check goes green the worse a file is documented — the same fault
      // the gallery guard already shipped once.
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!words.test(text), `${f} has drifted towards the falling-blocks game`);
  }
});

test('the playfield is the phone shape the other tall games use', () => {
  assert.equal(W / H, 600 / 900);
  assert.ok(CRATE_H > 0 && H / CRATE_H >= 8, 'too few rows fit on screen to read a tower');
});
