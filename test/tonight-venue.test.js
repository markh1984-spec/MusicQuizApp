/**
 * TONIGHT'S PUB SURVIVES A RELOAD UNTIL 6AM, and no further — see
 * `public/assets/tonight-venue.js`. Times are local, like `nightKey()`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUE_STORE, rememberVenue, rememberedVenue } from '../public/assets/tonight-venue.js';

const storage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test('a pub picked at 7pm is still picked at 11pm and at half past midnight', () => {
  const s = storage();
  rememberVenue(s, 'The Crown', at(2026, 10, 1, 19));
  assert.equal(rememberedVenue(s, at(2026, 10, 1, 23)), 'The Crown');
  assert.equal(rememberedVenue(s, at(2026, 10, 2, 0, 30)), 'The Crown', 'still the same night until 6am');
});

test('and forgotten from 6am, so next week cannot file under it', () => {
  const s = storage();
  rememberVenue(s, 'The Crown', at(2026, 10, 1, 19));
  assert.equal(rememberedVenue(s, at(2026, 10, 2, 6)), null);
  assert.equal(rememberedVenue(s, at(2026, 10, 8, 19)), null, 'next Thursday starts with nobody having said');
});

test('"nowhere in particular" is a pick too, and kept', () => {
  const s = storage();
  rememberVenue(s, '', at(2026, 10, 1, 19));
  assert.equal(rememberedVenue(s, at(2026, 10, 1, 21)), '');
});

test('nothing kept, junk kept, or storage that throws all read as nobody having said', () => {
  assert.equal(rememberedVenue(storage()), null);
  const junk = storage();
  junk.setItem(VENUE_STORE, '{not json');
  assert.equal(rememberedVenue(junk), null);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(rememberedVenue(blocked), null);
  assert.doesNotThrow(() => rememberVenue(blocked, 'The Crown'));
});
