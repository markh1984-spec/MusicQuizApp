/**
 * THE MIXED ROW — a quiz pack's rounds pulled apart and scattered around a
 * bingo interlude, in slots on the Tonight bar. Asked for directly: *"when
 * you drag a quiz pack in, you've got the rounds inside it that you can drag
 * out of the quiz pack into a second slot… you could either leave three
 * rounds inside the quiz pack, or drag round three out into another slot."*
 *
 * **THIS IS DELIBERATELY A SEPARATE PATH FROM `lbExtra`/`lbOff`, NOT A
 * REPLACEMENT OF THEM.** Those two already run every ordinary night — one
 * pack, or several whole packs composed into one quiz — and `nightOrder()`
 * sends nothing at all for the plainest case, which is what keeps a night
 * nobody has rearranged on exactly the route it always took. Round-splitting
 * and bingo-in-the-row is the rarer, richer case, and it earns its own
 * data shape rather than bending the simple one to fit it — the same
 * decision this codebase already made once, in `running-order.js`'s own
 * note about a running order being "a list of rounds to play this evening,
 * thrown away when the night ends", never a second copy of anything.
 *
 * A SLOT is one of:
 *   null
 *   { kind: 'quiz', packId, rounds: number[] }   — a pack's rounds, ANY
 *     subset, in the order they will be asked. Two slots may name the SAME
 *     packId — that is exactly how "round 1 here, round 3 over there" is
 *     represented.
 *   { kind: 'bingo', packId, shape: {rows,cols}|null, prizes: number }
 *
 * Slots compile straight into `segments`, the shape `/api/host/launchOrder`
 * already accepts (see `src/session.js`). **CONSECUTIVE quiz slots merge
 * into ONE segment**, whatever packs they name — the same "a run of quiz
 * items is one quiz" rule `composeQuiz()` already applies to an ordinary
 * multi-pack night, so two quiz slots with no bingo between them play
 * straight through with no "Continue" prompt, exactly as today. Only a
 * bingo slot is a real break.
 *
 * **PURE DATA ONLY IN THIS FILE, DELIBERATELY.** No DOM, no `library`, no
 * `localStorage` — `console-state.js` (and anything importing it) reads
 * `localStorage` at module load, which throws outside a browser. Keeping
 * this file free of that is what lets its logic be tested directly under
 * plain Node, the same way `plans.test.js`/`schemes.test.js` already test
 * their own browser modules. The rendering half — `renderSlots()`, and
 * everything that needs `library.cardShapes` or draws a tile — lives in
 * `console-tonight-mix-ui.js`.
 */

/** How many rounds this many prizes wants — mirrors `bingo.js`'s DEFAULT_STAGES shape without importing server code into the browser. */
export const DEFAULT_BINGO_PRIZES = 2;

/** The general slots array, built once from today's simple state — the moment a night needs it (a bingo pack lands in the row, or a round is dragged apart from its siblings). */
export function slotsFromSimple({ currentPack, lbExtra, lbOff, packOf }) {
  if (!currentPack) return [];
  const packs = [currentPack, ...lbExtra.map(packOf).filter(Boolean)];
  return packs.map((pack) => ({
    kind: 'quiz',
    packId: pack.id,
    rounds: (pack.rounds || [])
      .map((_, i) => i)
      .filter((i) => !lbOff.has(`${pack.id}:${i}`)),
  }));
}

/** Every quiz round currently placed anywhere in the slots, so a shelf pick or a drag-in can refuse a duplicate. */
export function placedRounds(slots) {
  const set = new Set();
  for (const slot of slots) {
    if (slot && slot.kind === 'quiz') for (const r of slot.rounds) set.add(`${slot.packId}:${r}`);
  }
  return set;
}

/**
 * Take round `round` of `packId` out of wherever it currently sits and put
 * it in slot `toIndex` — merging into that slot if it already holds the SAME
 * pack, filling an empty slot, or refused (returns the SAME array, unchanged)
 * if the target holds a bingo game or a DIFFERENT pack: a slot is one pack's
 * rounds or one bingo game, never a mix of two packs.
 *
 * **POSITIONS DO NOT SHIFT.** A slot left with no rounds at all becomes an
 * empty gap (`null`) IN PLACE rather than the list compacting round it — the
 * same reason the drop zone itself pins where it already is on a drag: a
 * round dragged out from under slot 2 must not silently turn what was slot 3
 * into the new slot 2 while your thumb is still moving. Explicit removal (a
 * slot's own × button) is a different, deliberate act and DOES compact the
 * list — see `removeSlot()`.
 */
export function moveRoundToSlot(slots, { packId, round }, toIndex) {
  const target = slots[toIndex] || null;
  if (target && (target.kind === 'bingo' || target.packId !== packId)) return slots;

  const width = Math.max(slots.length, toIndex + 1);
  const cleared = Array.from({ length: width }, (_, i) => slots[i] || null).map((slot, i) => {
    if (i === toIndex) return slot;
    if (slot && slot.kind === 'quiz' && slot.packId === packId && slot.rounds.includes(round)) {
      const rounds = slot.rounds.filter((r) => r !== round);
      return rounds.length ? { ...slot, rounds } : null;
    }
    return slot;
  });

  const targetNow = cleared[toIndex];
  cleared[toIndex] = (targetNow && targetNow.kind === 'quiz' && targetNow.packId === packId)
    ? { ...targetNow, rounds: [...targetNow.rounds, round].sort((a, b) => a - b) }
    : { kind: 'quiz', packId, rounds: [round] };
  return cleared;
}

/** Add a whole quiz pack (every round not already placed elsewhere) as a new slot. */
export function addQuizPackSlot(slots, pack) {
  const placed = placedRounds(slots);
  const rounds = (pack.rounds || [])
    .map((_, i) => i)
    .filter((i) => !placed.has(`${pack.id}:${i}`));
  if (!rounds.length) return slots;
  return [...slots, { kind: 'quiz', packId: pack.id, rounds }];
}

/** Add a bingo pack as its own new slot, with the night-wide defaults until its own control changes them. */
export function addBingoSlot(slots, pack, { shape = null, prizes = DEFAULT_BINGO_PRIZES } = {}) {
  return [...slots, { kind: 'bingo', packId: pack.id, shape, prizes }];
}

/** Remove a whole slot — the tile's own × button, same gesture as today's pack tile. */
export function removeSlot(slots, at) {
  return slots.filter((_, i) => i !== at);
}

/** Move slot `from` to sit at position `to`, same "which half of the target" rule the pack row already uses. */
export function moveSlot(slots, from, to) {
  const list = slots.slice();
  const [moved] = list.splice(from, 1);
  list.splice(from < to ? to - 1 : to, 0, moved);
  return list;
}

/**
 * Slots -> segments, for `doLaunchOrder()`. Consecutive quiz slots merge
 * into one segment — the "a run of quiz items is one quiz" rule.
 */
export function segmentsFromSlots(slots) {
  const segments = [];
  for (const slot of slots) {
    if (!slot) continue;
    if (slot.kind === 'bingo') {
      segments.push({ kind: 'bingo', packId: slot.packId, shape: slot.shape || null, prizes: slot.prizes || 0 });
      continue;
    }
    const order = slot.rounds.map((round) => ({ packId: slot.packId, round }));
    const last = segments[segments.length - 1];
    if (last && last.kind === 'quiz') last.order.push(...order);
    else segments.push({ kind: 'quiz', order });
  }
  return segments;
}

/** The first slot naming this pack — where an OFF round for it is shown, and where a brand new one lands if the pack has no slot at all yet. */
export function homeSlotIndex(slots, packId) {
  return slots.findIndex((s) => s && s.kind === 'quiz' && s.packId === packId);
}

/**
 * TAP FALLBACK for round-splitting — HTML5 drag never fires on touch, so a
 * drag-only way to move a round is a dead control on the phone half of this
 * console. A tap does the one thing every phone can do without a picker:
 * toggle the round off (out of tonight entirely, same meaning `lbOff`
 * already has) or back on, into its pack's own home slot. Repositioning
 * WHICH slot a round plays in stays drag-only, the same precedent whole-pack
 * reordering already sets in the ordinary strip.
 */
export function toggleRoundOff(slots, { packId, round }) {
  if (placedRounds(slots).has(`${packId}:${round}`)) {
    return removeRound(slots, packId, round);
  }
  const home = homeSlotIndex(slots, packId);
  if (home === -1) return [...slots, { kind: 'quiz', packId, rounds: [round] }];
  const next = slots.slice();
  next[home] = { ...next[home], rounds: [...next[home].rounds, round].sort((a, b) => a - b) };
  return next;
}

function removeRound(slots, packId, round) {
  return slots.map((slot) => (slot && slot.kind === 'quiz' && slot.packId === packId
    ? { ...slot, rounds: slot.rounds.filter((r) => r !== round) }
    : slot))
    .map((slot) => (slot && slot.kind === 'quiz' && slot.rounds.length === 0 ? null : slot));
}

/** Every round of this pack currently excluded from tonight — not present in any slot at all. */
export function offRoundsFor(slots, packId, roundCount) {
  const placed = placedRounds(slots);
  return Array.from({ length: roundCount }, (_, i) => i).filter((i) => !placed.has(`${packId}:${i}`));
}

/** Whether the slots are genuinely a mixed night — a bingo slot anywhere, or a pack split across more than one slot. Used to decide `doLaunchOrder()` vs the ordinary single-pack/simple-order launch. */
export function isMixed(slots) {
  if (slots.some((s) => s && s.kind === 'bingo')) return true;
  const seen = new Set();
  for (const slot of slots) {
    if (!slot || slot.kind !== 'quiz') continue;
    if (seen.has(slot.packId)) return true;
    seen.add(slot.packId);
  }
  return false;
}

