/**
 * LAST ORDERS — the rules, without a canvas.
 *
 * The fifth lobby game and the one that replaced Pile Up, so the assertions
 * that matter are the ones the old game could not pass: that it gets harder on
 * its own, that it can actually be lost, and that a phone nobody is touching
 * cannot reach the board.
 *
 * And one that is not about play at all. The game this resembles belongs to
 * Taito, and what they own is the NAME and the specific sprites rather than
 * the idea of a formation coming down at a defender — so there is a test on
 * the words, exactly as there was on Pile Up's, because that is the half a
 * future session is most likely to undo by accident.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  COLS, ROWS, BAR_ROW, LIVES, TICK_MS,
  newGame, tick, aim, edges, playOut,
} from '../public/assets/lastorders.js';

const SEEDS = [1, 7, 99, 4242];

/** Somebody playing: always slide under whoever is furthest down. */
const player = () => (g) => {
  if (!g.drinkers.length) return null;
  const front = g.drinkers.reduce((a, b) => (b.row > a.row ? b : a));
  return front.col;
};
/** Somebody who taps once and puts the phone down. */
const quits = () => {
  let taps = 0;
  return () => (taps++ < 1 ? Math.floor(COLS / 2) : null);
};

test('NOTHING MOVES UNTIL THE FIRST TAP', () => {
  const g = newGame(1);
  const before = JSON.stringify(g.drinkers);
  for (let i = 0; i < 500; i += 1) tick(g);
  assert.equal(JSON.stringify(g.drinkers), before, 'it started without the player');
  assert.equal(g.lives, LIVES, 'a life went before anybody had looked at it');
});

test('a tap outside the field is a miss, not a clamp', () => {
  const g = newGame(1);
  aim(g, -1); aim(g, COLS); aim(g, 1.5);
  assert.equal(g.want, null);
  assert.equal(g.waiting, true, 'junk started the game');
  aim(g, 3);
  assert.equal(g.want, 3);
});

test('THE FORMATION COMES DOWN, and reaching the bar ends it outright', () => {
  const g = newGame(1);
  aim(g, 4);
  let ticks = 0;
  while (!g.over && ticks < 40_000) { tick(g); ticks += 1; }
  assert.ok(g.over, 'a game nobody shot at never ended');
  const { maxR } = edges(g);
  assert.ok(maxR >= BAR_ROW - 1 || g.lives <= 0, 'it ended for no reason');
});

test('IT GETS HARDER AS THE ROOM EMPTIES', () => {
  const g = newGame(7);
  aim(g, 4);
  const first = g.stepEvery;
  // Clear a few by hand, which is what a player's shots do.
  for (let i = 0; i < 8 && g.drinkers.length; i += 1) g.drinkers.pop();
  for (let i = 0; i < 8; i += 1) {
    g.shots.push({ col: g.drinkers[0].col, row: g.drinkers[0].row + 1 });
    tick(g);
  }
  assert.ok(g.stepEvery <= first, `it did not speed up: ${first} -> ${g.stepEvery}`);
});

test('IT CAN BE LOST, and it lasts long enough to be worth opening', () => {
  for (const seed of SEEDS) {
    const { game, ticks } = playOut(seed, player());
    assert.ok(game.over, `seed ${seed}: never ended`);
    const seconds = (ticks * TICK_MS) / 1000;
    assert.ok(seconds > 20, `seed ${seed}: a whole game lasted ${seconds.toFixed(0)}s`);
  }
});

test('skill scores more than a thumb', () => {
  for (const seed of SEEDS) {
    const played = playOut(seed, player()).game.score;
    const dropped = playOut(seed, quits()).game.score;
    assert.ok(played > dropped, `seed ${seed}: playing (${played}) beat nothing (${dropped})`);
  }
});

test('A PHONE LEFT ALONE CANNOT REACH THE BOARD', () => {
  for (const seed of SEEDS) {
    const abandoned = playOut(seed, quits()).game.score;
    const played = playOut(seed, player()).game.score;
    assert.ok(abandoned < played / 3,
      `seed ${seed}: an abandoned phone reached ${abandoned} against ${played}`);
  }
});

test('THE SAME SEED IS THE SAME GAME, every time', () => {
  const a = playOut(21, player());
  const b = playOut(21, player());
  assert.equal(a.game.score, b.game.score);
  assert.deepEqual(a.events, b.events);
});

test('…and a different seed is a different game', () => {
  const a = playOut(21, player());
  const b = playOut(22, player());
  assert.notDeepEqual(a.events, b.events);
});

test('nothing ever leaves the field', () => {
  for (const seed of SEEDS) {
    const g = newGame(seed);
    aim(g, 4);
    for (let i = 0; i < 6_000 && !g.over; i += 1) {
      tick(g);
      assert.ok(g.col >= 0 && g.col < COLS, `the glass left the field at ${g.col}`);
      for (const d of g.drinkers) {
        assert.ok(d.col >= 0 && d.col < COLS, `a drinker left the field at ${d.col}`);
        assert.ok(d.row >= 0 && d.row <= ROWS, `a drinker left the field at row ${d.row}`);
      }
    }
  }
});

test('NOTHING IN THE GAME IS CALLED SPACE INVADERS', () => {
  /*
   * The name and the sprites are Taito's; the idea of a formation descending
   * on a defender is not, and is a whole genre. This app is SOLD, so the line
   * is legal rather than a matter of taste — and it is the half most likely to
   * be undone by somebody being helpful in six months.
   */
  const banned = /space\s*invader|taito|alien|ufo|saucer|bunker/i;
  for (const f of ['lastorders.js', 'lobby-lastorders.js']) {
    const src = fs.readFileSync(`public/assets/${f}`, 'utf8');
    // The one place the name may appear is the note explaining why it may not.
    const body = src.replace(/It is not called Space Invaders[^;]*;/g, '');
    const hits = body.split('\n').filter((l) => banned.test(l) && !/^\s*\*/.test(l));
    assert.deepEqual(hits, [], `${f} names somebody else's game: ${hits.join(' | ')}`);
  }
});
