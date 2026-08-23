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

/*
 * IT COUNTS SONGS RATHER THAN QUOTING A PERCENTAGE — reported directly:
 * *"'60% of your calls hit your card' is awkward wording, can we clarify this
 * and simplify it as well for the reading QM."* A percentage had to be
 * converted before it meant anything, and "your card" is ambiguous on a
 * screen only the quizmaster reads.
 */
test('bingoShapeLabel: says how much of the pack is on a card', () => {
  // 25 of 40 is over half, so this one keeps up and says nothing more.
  assert.equal(bingoShapeLabel(find(5, 5), 40), '5×5 — line of 5 · 25 of 40 songs on a card');
});

test('bingoShapeLabel: under half the pack is named as dragging, in words', () => {
  // The exact fault this whole label exists for, in the host's own numbers:
  // 16 squares against 40 tracks, "not even getting a song 50% of the time".
  assert.equal(bingoShapeLabel(find(4, 4), 40), '4×4 — line of 4 · 16 of 40 songs on a card — drags');
});

test('bingoShapeLabel: exactly half does NOT drag — the boundary is inclusive', () => {
  // 16 squares of 32 is half, which is the line the host drew rather than one
  // either side of it. A strict `<` here would call a fine card slow.
  assert.equal(bingoShapeLabel(find(4, 4), 32), '4×4 — line of 4 · 16 of 32 songs on a card');
});

test('bingoShapeLabel: no track count, no pacing claim', () => {
  assert.equal(bingoShapeLabel(find(4, 4), 0), '4×4 — line of 4');
});
