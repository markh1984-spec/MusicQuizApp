/**
 * EVERY NAME IN `MOVES` IS A REAL HOST ACTION.
 *
 * `MOVES` decides which presses carry the two-devices cursor guard: a move
 * sent with a stale `seen` is refused 409, one that is not in this set is
 * never refused. So a name that matches no action silently switches the guard
 * OFF for that control, and nothing anywhere throws.
 *
 * It had FOUR wrong: `skipQuestion` and `redoQuestion` are the ENGINE's method
 * names where the actions are `skip` and `redo`, and `undoLastCall` is the
 * engine's where the action is `undoCall`. Skip and Ask again — both drawn at
 * `question` and `reveal`, the phases two control views are most often one
 * press apart — took a stale press with no refusal. A stale Skip takes the
 * question the room is answering off the projector; a stale Ask again wipes
 * its answers and restarts its clock.
 *
 * `two-devices.mjs` presses `next` and `reveal` and could not see it. This
 * reads the dispatch itself rather than a list somebody typed twice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MOVES } from '../public/assets/host-cursor.js';

test('every name in MOVES is an action the session actually dispatches', () => {
  const src = fs.readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
  /*
   * READ OFF THE DISPATCH, never a second list. Both shapes count: the plain
   * `name: () =>` entries and the conditional ones spread in for one kind
   * (`...(this.kind === 'cards' ? { draw: ... } : {})`), which is how `draw`
   * reaches a deck.
   */
  const actions = new Set([...src.matchAll(/([a-zA-Z][a-zA-Z0-9]*):\s*\(\s*\)\s*=>/g)].map((m) => m[1]));
  const missing = [...MOVES].filter((m) => !actions.has(m));
  assert.deepEqual(missing, [],
    `MOVES names ${missing.join(', ')}, which no host action answers to — so the `
    + 'two-devices guard is silently off for those presses. Use the ACTION name '
    + '(what the control view POSTs), not the engine method.');
});

test('and the moves that actually change what the room sees are all in it', () => {
  // The four a stale press must never take, named rather than derived — a
  // derived list would drift with the dispatch and stop asserting anything.
  for (const must of ['next', 'back', 'reveal', 'skip', 'redo']) {
    assert.ok(MOVES.has(must), `${must} moves the night and must carry the cursor guard`);
  }
});
