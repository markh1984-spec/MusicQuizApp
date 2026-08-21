/**
 * A CARD DRAGS WHEN IT IS TOO SMALL FOR THE POOL — `bestBingoShape()` and
 * `bingoShapeLabel()` in `public/assets/client.js`, pure functions with no
 * DOM, tested directly the same way `console-tonight-mix.test.js` tests its
 * own browser module.
 *
 * Reported live: a 40-track pack defaulted to a 4×4 card (16 of the 40 songs
 * on a given player's card, well under half of every call meaning anything
 * to them) when the pack had plenty of tracks for a 5×5 — the shape with the
 * most squares this pool can actually fill.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_SHAPES, minimumTracks, shapeLabel } from '../src/bingo.js';
import { bestBingoShape, bingoShapeLabel } from '../public/assets/client.js';

// The exact shape of `library.cardShapes` the server sends — see server.js.
const SHAPES = CARD_SHAPES.map((s) => ({ ...s, label: shapeLabel(s), minimum: minimumTracks(s) }));
const find = (rows, cols) => SHAPES.find((s) => s.rows === rows && s.cols === cols);

test('bestBingoShape: 40 tracks picks 5x5, the reported case', () => {
  assert.deepEqual(bestBingoShape(SHAPES, 40), find(5, 5));
});

test('bestBingoShape: only enough for the smallest shape picks the smallest', () => {
  // 14 tracks clears 3x3's minimum (14) but nothing bigger (4x4 needs 24).
  assert.deepEqual(bestBingoShape(SHAPES, 14), find(3, 3));
});

test('bestBingoShape: nothing fits falls back to the first shape rather than throwing', () => {
  assert.deepEqual(bestBingoShape(SHAPES, 5), SHAPES[0]);
});

test('bingoShapeLabel: says the pacing, rounded', () => {
  // 5x5 = 25 squares of 40 tracks = 62.5%, rounds to 63.
  assert.equal(bingoShapeLabel(find(5, 5), 40), '5×5 — line of 5 · 63% of calls hit your card');
});

test('bingoShapeLabel: no track count, no pacing claim', () => {
  assert.equal(bingoShapeLabel(find(4, 4), 0), '4×4 — line of 4');
});
