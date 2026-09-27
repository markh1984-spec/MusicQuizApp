/**
 * ONE NIGHT, ONE KEY — see `public/assets/launch-key.js`. The quiet launch a
 * tap sends and the loud one Launch sends spell the same night differently
 * (one omits what the other sends as null), and both must key the same; a
 * night that has changed in any field must not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { launchKey } from '../public/assets/launch-key.js';

const quiet = { game: 'quiz', packId: 'madonna', winners: 3, look: '', shape: null, prizes: 0, stages: null, breakPlan: {} };
const loud = { packId: 'madonna', game: 'quiz', look: '', winners: 3, prizes: 0, breakPlan: {}, order: null, shape: null, stages: null };

test('the same night keys the same, however it is spelt', () => {
  assert.equal(launchKey(quiet), launchKey(loud));
  assert.equal(launchKey({ ...loud, replace: true }), launchKey(loud), '`replace` is about the press, not the night');
  assert.equal(launchKey({ ...loud, rewards: undefined }), launchKey(loud));
});

test('a changed night keys differently — a round off, a winner fewer, a prize typed, another venue', () => {
  const base = launchKey(loud);
  assert.notEqual(launchKey({ ...loud, order: [{ packId: 'madonna', round: 0 }] }), base);
  assert.notEqual(launchKey({ ...loud, winners: 1 }), base);
  assert.notEqual(launchKey({ ...loud, rewards: ['A pint'] }), base);
  assert.notEqual(launchKey({ ...loud, venue: 'The Crown' }), base);
  assert.notEqual(launchKey({ ...loud, breakPlan: { 'p0:lobby': { phone: 'off' } } }), base);
  // and a running order is keyed by its segments, in order
  const a = launchKey({ segments: [{ kind: 'quiz', order: [{ packId: 'a', round: 0 }] }, { kind: 'bingo', packId: 'b' }] });
  const b = launchKey({ segments: [{ kind: 'bingo', packId: 'b' }, { kind: 'quiz', order: [{ packId: 'a', round: 0 }] }] });
  assert.notEqual(a, b);
});
