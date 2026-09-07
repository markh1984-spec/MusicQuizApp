/**
 * The mixed-row slot logic — pure functions, no DOM, so tested directly like
 * `plans.test.js`/`schemes.test.js` already test their own browser modules.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  slotsFromSimple, placedRounds, moveRoundToSlot, addQuizPackSlot, addBingoSlot,
  removeSlot, swapSlots, segmentsFromSlots, homeSlotIndex, toggleRoundOff, offRoundsFor,
  simpleNight, gapIdsOfSlot,
} from '../public/assets/console-tonight-mix.js';
import { breaksOf } from '../public/assets/console-breaks.js';

const PACK_A = { id: 'a', title: 'Pack A', rounds: [{ title: 'R1' }, { title: 'R2' }, { title: 'R3' }] };
const PACK_B = { id: 'b', title: 'Pack B', rounds: [{ title: 'R1' }] };
const PACK_C = { id: 'c', title: 'Pack C', rounds: [{ title: 'R1' }] };
const packOf = (id) => ({ a: PACK_A, b: PACK_B, c: PACK_C }[id]);

/*
 * THESE TWO WERE REVERSED DELIBERATELY on 5 September 2026. They pinned a pack
 * arriving as ONE slot holding all its rounds; a pack now arrives as one slot
 * PER ROUND — *"the packs shouldn't be dragged in as packs… all of the rounds
 * go into separate slots."* The night it compiles to is unchanged, which is
 * the assertion two tests below this one.
 */
test('slotsFromSimple: one pack becomes one slot PER ROUND', () => {
  const slots = slotsFromSimple({ currentPack: PACK_A, lbExtra: [], lbOff: new Set(), packOf });
  assert.deepEqual(slots, [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'quiz', packId: 'a', rounds: [1] },
    { kind: 'quiz', packId: 'a', rounds: [2] },
  ]);
});

test('slotsFromSimple: a switched-off round is left out, and a second pack keeps going', () => {
  const slots = slotsFromSimple({ currentPack: PACK_A, lbExtra: ['b'], lbOff: new Set(['a:1']), packOf });
  assert.deepEqual(slots, [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'quiz', packId: 'a', rounds: [2] },
    { kind: 'quiz', packId: 'b', rounds: [0] },
  ]);
});

test('BURSTING CHANGES THE ROW AND NOT THE NIGHT — the segments are identical', () => {
  /*
   * The whole safety argument for this change, asserted rather than believed.
   * `segmentsFromSlots()` merges CONSECUTIVE quiz slots into one segment, so a
   * pack spread over three tiles compiles to exactly what one tile compiled
   * to. If this ever fails, bursting has started changing what a room plays.
   */
  const grouped = [{ kind: 'quiz', packId: 'a', rounds: [0, 1, 2] }];
  const burst = slotsFromSimple({ currentPack: PACK_A, lbExtra: [], lbOff: new Set(), packOf });
  assert.deepEqual(segmentsFromSlots(burst), segmentsFromSlots(grouped));
  // And a hole between two of them does not split the segment either.
  const withHole = [burst[0], null, burst[1], burst[2]];
  assert.deepEqual(segmentsFromSlots(withHole), segmentsFromSlots(grouped));
});

test('slotsFromSimple: no pack chosen at all is an empty night', () => {
  assert.deepEqual(slotsFromSimple({ currentPack: null, lbExtra: [], lbOff: new Set(), packOf }), []);
});

test('slotsFromSimple: a BINGO currentPack converts to a bingo slot, not an empty quiz one', () => {
  const bingoPack = { id: 'disco', title: 'Disco & Funk', trackCount: 40 };
  const slots = slotsFromSimple({ currentPack: bingoPack, lbExtra: [], lbOff: new Set(), packOf });
  assert.deepEqual(slots, [{ kind: 'bingo', packId: 'disco', shape: null, prizes: 2 }]);
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
    { kind: 'quiz', packId: 'a', rounds: [1] },
    { kind: 'quiz', packId: 'a', rounds: [2] },
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

test('removeSlot drops the one slot and leaves the rest in order', () => {
  const slots = [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'b', rounds: [0] },
  ];
  assert.deepEqual(removeSlot(slots, 1), [slots[0], slots[2]]);
});

test('swapSlots exchanges two positions and leaves everything between them alone', () => {
  const slots = [
    { kind: 'quiz', packId: 'a', rounds: [0] },
    { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 },
    { kind: 'quiz', packId: 'b', rounds: [0] },
  ];
  // Tile 1 onto tile 3: only those two move — the bingo slot between them
  // must not shift, which an insert-and-shift would have done instead.
  assert.deepEqual(swapSlots(slots, 0, 2), [slots[2], slots[1], slots[0]]);
  // Adjacent tiles: a swap and a shift agree here, so this is also a
  // regression guard for the adjacent case alone.
  assert.deepEqual(swapSlots(slots, 1, 2), [slots[0], slots[2], slots[1]]);
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

/* ------------------------------------------------- collapsing back to simple */

test('SIMPLE NIGHT: one pack in order still launches down the ordinary route', () => {
  /*
   * The other half of the safety argument. Bursting means `lbSlots` exists on
   * EVERY night rather than only a rearranged one — and `lbSlots` is what
   * switches the launch from `/api/host/launch` to `/api/host/launchOrder`.
   * Letting that happen to every gig would be a change to the protected
   * surface bought with a change to the layout, so the row bursts and the
   * launch collapses back.
   */
  const burst = slotsFromSimple({ currentPack: PACK_A, lbExtra: [], lbOff: new Set(), packOf });
  assert.deepEqual(simpleNight(burst), { packId: 'a', rounds: [0, 1, 2] });
  // A round switched off is still an ordinary night — that is what `lbOff` is.
  const some = slotsFromSimple({ currentPack: PACK_A, lbExtra: [], lbOff: new Set(['a:1']), packOf });
  assert.deepEqual(simpleNight(some), { packId: 'a', rounds: [0, 2] });
  // Holes in the row are positions, not content.
  assert.deepEqual(simpleNight([burst[0], null, burst[1]]), { packId: 'a', rounds: [0, 1] });
});

test('SIMPLE NIGHT: anything the ordinary launch cannot express keeps the running order', () => {
  const A = (r) => ({ kind: 'quiz', packId: 'a', rounds: [r] });
  const cases = [
    ['nothing in the row', []],
    ['a bingo game', [A(0), { kind: 'bingo', packId: 'disco', shape: null, prizes: 2 }]],
    ['two different packs', [A(0), { kind: 'quiz', packId: 'b', rounds: [0] }]],
    // The one that matters most: an ordinary launch plays a pack in the PACK'S
    // order, so rounds reordered is a genuinely different night it cannot say.
    ['rounds reordered', [A(2), A(0), A(1)]],
    ['the same round twice', [A(0), A(0)]],
  ];
  for (const [what, slots] of cases) {
    assert.equal(simpleNight(slots), null, `${what} was wrongly called a simple night`);
  }
});

/*
 * A TILE'S DIAL OWNS ITS OWN GAP.
 *
 * A burst pack is several tiles of one pack, and every one of them used to be
 * handed "the gaps this pack makes" — so pressing the last tile's dial
 * changed the first. All four agreed with each other and none of them was
 * answering the question the corner they sit in asks.
 */
test('gapIdsOfSlot: each round tile owns the gap after its OWN round', () => {
  const slots = slotsFromSimple({ currentPack: PACK_A, lbExtra: [], lbOff: new Set(), packOf });
  assert.deepEqual(gapIdsOfSlot(slots, 0), ['p0:r0']);
  assert.deepEqual(gapIdsOfSlot(slots, 1), ['p0:r1']);
  // The board after the last round of the last part is the FINAL, not a gap —
  // the candidate is offered and the caller drops it against `breaksOf()`.
  assert.deepEqual(gapIdsOfSlot(slots, 2), ['p0:r2']);
  const live = new Set(breaksOf(segmentsFromSlots(slots)).map((b) => b.id));
  assert.equal(live.has('p0:r1'), true);
  assert.equal(live.has('p0:r2'), false);
});

test('gapIdsOfSlot: a bingo slot owns the gap BEFORE it, and never the doors', () => {
  // Bingo first: its lobby IS the doors, which has a dial of its own in the head.
  const bingoFirst = addBingoSlot([], { id: 'bg' }, { at: 0 });
  assert.deepEqual(gapIdsOfSlot(bingoFirst, 0), []);
  // Quiz, then bingo, then quiz — three parts, and the two later lobbies are
  // real gaps that belong to whatever follows them.
  let slots = slotsFromSimple({ currentPack: PACK_B, lbExtra: [], lbOff: new Set(), packOf });
  slots = addBingoSlot(slots, { id: 'bg' }, { at: 1 });
  slots = addQuizPackSlot(slots, PACK_C, { at: 2, packOf });
  assert.deepEqual(segmentsFromSlots(slots).map((s) => s.kind), ['quiz', 'bingo', 'quiz']);
  assert.deepEqual(gapIdsOfSlot(slots, 0), ['p0:r0']);
  assert.deepEqual(gapIdsOfSlot(slots, 1), ['p1:lobby']);
  assert.deepEqual(gapIdsOfSlot(slots, 2), ['p2:r0']);
});

test('gapIdsOfSlot: two packs in one part keep counting up the SAME part', () => {
  // Consecutive quiz slots merge into one segment, so pack B's round is
  // position 3 of part 0 — not round 0 of a part of its own.
  let slots = slotsFromSimple({ currentPack: PACK_A, lbExtra: [], lbOff: new Set(), packOf });
  slots = addQuizPackSlot(slots, PACK_B, { at: 3, packOf });
  assert.deepEqual(gapIdsOfSlot(slots, 3), ['p0:r3']);
  assert.equal(gapIdsOfSlot(slots, 4).length, 0, 'there is no fifth tile');
});
