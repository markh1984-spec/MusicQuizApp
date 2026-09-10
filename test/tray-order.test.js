/**
 * THE TRAY ROTATES, AND THE FLOOR IS WHAT STOPS IT EATING ITSELF.
 *
 * Forty-two props on an ordinary night and four above the fold on a 320px
 * phone, so nine rows in ten were only ever seen by somebody scrolling for the
 * fun of it. The tray now rotates, weighted towards what people reach for.
 *
 * **The weighting is the dangerous half.** Bias hard enough and an unpopular
 * prop stops appearing, so it stops being used, so it is weighted lower still
 * — and the usage table then reports "nobody wants this" about something
 * nobody was offered. These check the floor holds and the head is left alone.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { STICKERS, trayOrder, withRecent, HEAD_KEPT, RECENT_KEPT } from '../public/assets/stickers.js';

/** A deterministic stand-in for Math.random, cycling a fixed list. */
const rolls = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('the composed head keeps its place — the band shirts are one joke', () => {
  const head = STICKERS.slice(0, HEAD_KEPT).map((s) => s.id);
  for (let seed = 0; seed < 20; seed += 1) {
    const out = trayOrder(STICKERS, {}, rolls((seed + 1) / 21, 0.1, 0.9, 0.5));
    assert.deepEqual(out.slice(0, HEAD_KEPT).map((s) => s.id), head,
      'the first row moved, which turns a joke in three pieces into a shirt');
  }
});

test('nothing is lost or duplicated, however it is rolled', () => {
  for (let seed = 0; seed < 30; seed += 1) {
    const out = trayOrder(STICKERS, {}, rolls(seed / 31, 0.99, 0.01, 0.4, 0.77));
    assert.equal(out.length, STICKERS.length, 'a prop went missing from the tray');
    assert.equal(new Set(out.map((s) => s.id)).size, STICKERS.length, 'a prop appeared twice');
  }
});

test('IT ACTUALLY ROTATES — two opens are not the same tray', () => {
  const a = trayOrder(STICKERS, {}, rolls(0.11, 0.83, 0.29, 0.61, 0.05));
  const b = trayOrder(STICKERS, {}, rolls(0.92, 0.07, 0.55, 0.38, 0.74));
  assert.notDeepEqual(a.map((s) => s.id), b.map((s) => s.id),
    'the tray is fixed, so the whole exercise does nothing');
});

test('AN UNUSED PROP STILL APPEARS NEAR THE FRONT SOMETIMES — the floor', () => {
  /*
   * The one that matters. Every other prop is loved and one is used by
   * nobody at all; over many opens it must still reach the visible rows, or
   * the loop closes and the usage table starts lying about it.
   */
  const weights = {};
  for (const s of STICKERS) weights[s.id] = 0.9;
  const loser = STICKERS[STICKERS.length - 1].id;
  weights[loser] = 0;

  let random = 1;
  const prng = () => { random = (random * 48271) % 2147483647; return random / 2147483647; };

  let seenHigh = 0;
  const RUNS = 400;
  for (let i = 0; i < RUNS; i += 1) {
    const out = trayOrder(STICKERS, weights, prng);
    // The first two rows past the fixed head — roughly what a thumb reaches.
    if (out.slice(0, HEAD_KEPT + 10).some((s) => s.id === loser)) seenHigh += 1;
  }
  assert.ok(seenHigh > RUNS * 0.05,
    `the least popular prop reached the top rows ${seenHigh}/${RUNS} times — the floor is gone`);
});

test('…and a popular prop genuinely does better than an unpopular one', () => {
  // The floor must not be so generous that the bias does nothing at all,
  // or the answer to "bias towards popular" is no.
  const weights = {};
  for (const s of STICKERS) weights[s.id] = 0.05;
  const star = STICKERS[STICKERS.length - 2].id;
  const dud = STICKERS[STICKERS.length - 1].id;
  weights[star] = 1;
  weights[dud] = 0;

  let random = 7;
  const prng = () => { random = (random * 48271) % 2147483647; return random / 2147483647; };

  let starWins = 0;
  const RUNS = 600;
  for (let i = 0; i < RUNS; i += 1) {
    const ids = trayOrder(STICKERS, weights, prng).map((s) => s.id);
    if (ids.indexOf(star) < ids.indexOf(dud)) starWins += 1;
  }
  assert.ok(starWins > RUNS * 0.55,
    `the popular prop led only ${starWins}/${RUNS} times — the bias is doing nothing`);
});

test('NO USAGE DATA AT ALL IS AN HONEST SHUFFLE, not a crash or a fixed list', () => {
  const out = trayOrder(STICKERS, {}, rolls(0.3, 0.6, 0.9, 0.2));
  assert.equal(out.length, STICKERS.length);
  // And a table of nulls behaves the same way — "not judged yet" is not a verdict.
  const nulls = Object.fromEntries(STICKERS.map((s) => [s.id, null]));
  assert.equal(trayOrder(STICKERS, nulls, rolls(0.5)).length, STICKERS.length);
});

test('what they reached for last time comes first', () => {
  const ids = STICKERS.map((s) => s.id);
  const recent = [ids[30], ids[12]];
  const out = withRecent(STICKERS, recent).map((s) => s.id);
  assert.deepEqual(out.slice(0, 2), recent);
  assert.equal(out.length, STICKERS.length, 'a prop was lost or duplicated');
  assert.equal(new Set(out).size, STICKERS.length);
});

test('…capped, and a prop that has since been DELETED is skipped not gapped', () => {
  const ids = STICKERS.map((s) => s.id);
  const recent = [...ids.slice(20, 20 + RECENT_KEPT + 3)];
  assert.ok(withRecent(STICKERS, recent).length === STICKERS.length);
  assert.deepEqual(withRecent(STICKERS, recent).slice(0, RECENT_KEPT).map((s) => s.id),
    recent.slice(0, RECENT_KEPT));

  const gone = withRecent(STICKERS, ['a-prop-that-was-deleted', ids[5]]).map((s) => s.id);
  assert.equal(gone[0], ids[5], 'a deleted favourite left a hole at the top');
  assert.equal(gone.length, STICKERS.length);
});

test('no recents is the tray untouched', () => {
  assert.deepEqual(withRecent(STICKERS, []).map((s) => s.id), STICKERS.map((s) => s.id));
});
