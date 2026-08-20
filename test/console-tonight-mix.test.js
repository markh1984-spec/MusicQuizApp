/**
 * The mixed-row slot logic — pure functions, no DOM, so tested directly like
 * `plans.test.js`/`schemes.test.js` already test their own browser modules.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  slotsFromSimple, placedRounds, moveRoundToSlot, addQuizPackSlot, addBingoSlot,
  removeSlot, moveSlot, segmentsFromSlots, isMixed, homeSlotIndex, toggleRoundOff, offRoundsFor,
} from '../public/assets/console-tonight-mix.js';

const PACK_A = { id: 'a', title: 'Pack A', rounds: [{ title: 'R1' }, { title: 'R2' }, { title: 'R3' }] };
const PACK_B = { id: 'b', title: 'Pack B', rounds: [{ title: 'R1' }] };
const packOf = (id) => ({ a: PACK_A, b: PACK_B }[id]);

test('slotsFromSimple: one pack, nothing switched off', () => {
  const slots = slotsFromSimple({ currentPack: PACK_A, lbExtra: [], lbOff: new Set(), packOf });
  assert.deepEqual(slots, [{ kind: 'quiz', packId: 'a', rounds: [0, 1, 2] }]);
});

test('slotsFromSimple: a switched-off round is left out, a second pack becomes a second slot', () => {
  const slots = slotsFromSimple({ currentPack: PACK_A, lbExtra: ['b'], lbOff: new Set(['a:1']), packOf });
  assert.deepEqual(slots, [
    { kind: 'quiz', packId: 'a', rounds: [0, 2] },
    { kind: 'quiz', packId: 'b', rounds: [0] },
  ]);
});

test('slotsFromSimple: no pack chosen at all is an empty night', () => {
  assert.deepEqual(slotsFromSimple({ currentPack: null, lbExtra: [], lbOff: new Set(), packOf }), []);
});

test('moveRoundToSlot: drags round 3 out of pack A into a new empty slot after a bingo one', () => {
  const start = [
    { kind: 'quiz', packId: 'a', rounds: [0, 1, 2] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    null,
  ];
  const after = moveRoundToSlot(start, { packId: 'a', round: 2 }, 2);
  assert.deepEqual(after, [
    { kind: 'quiz', packId: 'a', rounds: [0, 1] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ]);
});

test('moveRoundToSlot: dropping onto a slot that already holds the SAME pack merges into it', () => {
  const start = [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ];
  const after = moveRoundToSlot(start, { packId: 'a', round: 1 }, 1);
  assert.deepEqual(after, [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'quiz', packId: 'a', rounds: [1, 2] },
  ]);
});

test('moveRoundToSlot: a slot left with no rounds at all becomes an empty GAP in place, positions do not shift', () => {
  const start = [
    { kind: 'quiz', packId: 'a', rounds: [2] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 1 },
    null,
  ];
  // The only round in slot 0 moves to the empty slot 2 — slot 0 becomes an
  // empty gap rather than the bingo slot silently sliding up to position 1.
  const after = moveRoundToSlot(start, { packId: 'a', round: 2 }, 2);
  assert.deepEqual(after, [
    null,
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 1 },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ]);
});

test('moveRoundToSlot: refused onto a bingo slot or a different pack\'s slot — the array comes back unchanged', () => {
  const start = [
    { kind: 'quiz', packId: 'a', rounds: [0, 1] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'b', rounds: [0] },
  ];
  assert.deepEqual(moveRoundToSlot(start, { packId: 'a', round: 0 }, 1), start, 'dropped onto a bingo slot');
  assert.deepEqual(moveRoundToSlot(start, { packId: 'a', round: 0 }, 2), start, "dropped onto a different pack's slot");
});

test('placedRounds: every round anywhere in the slots, keyed the same way lbOff already is', () => {
  const slots = [
    { kind: 'quiz', packId: 'a', rounds: [0, 2] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
  ];
  assert.deepEqual([...placedRounds(slots)].sort(), ['a:0', 'a:2']);
});

test('addQuizPackSlot: only the rounds not already placed elsewhere come in', () => {
  const start = [{ kind: 'quiz', packId: 'a', rounds: [0] }];
  const after = addQuizPackSlot(start, PACK_A);
  assert.deepEqual(after, [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'quiz', packId: 'a', rounds: [1, 2] },
  ]);
});

test('addQuizPackSlot: nothing is added if every round of that pack is already in the night', () => {
  const start = [{ kind: 'quiz', packId: 'a', rounds: [0, 1, 2] }];
  assert.deepEqual(addQuizPackSlot(start, PACK_A), start);
});

test('addBingoSlot: a new bingo slot with its OWN prizes/shape, defaulting sensibly', () => {
  const after = addBingoSlot([], { id: 'disco' });
  assert.deepEqual(after, [{ kind: 'bingo', packId: 'disco', shape: null, prizes: 2 }]);
});

test('removeSlot and moveSlot do the obvious thing', () => {
  const slots = [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'b', rounds: [0] },
  ];
  assert.deepEqual(removeSlot(slots, 1), [slots[0], slots[2]]);
  assert.deepEqual(moveSlot(slots, 2, 0), [slots[2], slots[0], slots[1]]);
});

test('segmentsFromSlots: consecutive quiz slots merge into ONE segment — a run of quiz items is one quiz', () => {
  const slots = [
    { kind: 'quiz', packId: 'a', rounds: [0, 1] },
    { kind: 'quiz', packId: 'b', rounds: [0] },
    { kind: 'bingo', packId: 'disco', shape: { rows: 3, cols: 3 }, prizes: 2 },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ];
  assert.deepEqual(segmentsFromSlots(slots), [
    { kind: 'quiz', order: [{ packId: 'a', round: 0 }, { packId: 'a', round: 1 }, { packId: 'b', round: 0 }] },
    { kind: 'bingo', packId: 'disco', shape: { rows: 3, cols: 3 }, prizes: 2 },
    { kind: 'quiz', order: [{ packId: 'a', round: 2 }] },
  ]);
});

test('segmentsFromSlots: null slots are simply skipped', () => {
  const slots = [null, { kind: 'quiz', packId: 'a', rounds: [0] }, null];
  assert.deepEqual(segmentsFromSlots(slots), [{ kind: 'quiz', order: [{ packId: 'a', round: 0 }] }]);
});

test('isMixed: false for the ordinary case, true the moment a pack is split or bingo joins', () => {
  assert.equal(isMixed([{ kind: 'quiz', packId: 'a', rounds: [0, 1, 2] }]), false);
  assert.equal(isMixed([{ kind: 'quiz', packId: 'a', rounds: [0, 1] }, { kind: 'quiz', packId: 'b', rounds: [0] }]), false);
  assert.equal(isMixed([{ kind: 'quiz', packId: 'a', rounds: [0] }, { kind: 'quiz', packId: 'a', rounds: [2] }]), true);
  assert.equal(isMixed([{ kind: 'bingo', packId: 'disco', shape: null, prizes: 2 }]), true);
});

test('homeSlotIndex: the FIRST slot naming a pack, -1 if it has none', () => {
  const slots = [
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ];
  assert.equal(homeSlotIndex(slots, 'a'), 1);
  assert.equal(homeSlotIndex(slots, 'b'), -1);
});

test('toggleRoundOff: an ON round is removed entirely — the tap fallback for touch, same meaning lbOff already has', () => {
  const slots = [{ kind: 'quiz', packId: 'a', rounds: [0, 1, 2] }];
  const after = toggleRoundOff(slots, { packId: 'a', round: 1 });
  assert.deepEqual(after, [{ kind: 'quiz', packId: 'a', rounds: [0, 2] }]);
});

test('toggleRoundOff: an OFF round comes back into the pack\'s HOME slot, not wherever else the pack might also appear', () => {
  const slots = [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ];
  const after = toggleRoundOff(slots, { packId: 'a', round: 1 });
  assert.deepEqual(after, [
    { kind: 'quiz', packId: 'a', rounds: [0, 1] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ]);
});

test('toggleRoundOff: turning off the only round in a slot leaves an empty gap, not a shifted list', () => {
  const slots = [{ kind: 'quiz', packId: 'a', rounds: [0] }, { kind: 'bingo', packId: 'disco', shape: null, prizes: 1 }];
  assert.deepEqual(toggleRoundOff(slots, { packId: 'a', round: 0 }), [null, { kind: 'bingo', packId: 'disco', shape: null, prizes: 1 }]);
});

test('offRoundsFor: every round of a pack not placed in any slot', () => {
  const slots = [{ kind: 'quiz', packId: 'a', rounds: [0, 2] }];
  assert.deepEqual(offRoundsFor(slots, 'a', 3), [1]);
  assert.deepEqual(offRoundsFor(slots, 'a', 4), [1, 3]);
});
