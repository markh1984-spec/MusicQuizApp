/**
 * WHAT A SAVED PHOTOGRAPH IS CALLED, AND HOW BIG THE MARK ON IT IS.
 *
 * ---
 *
 * The drawing itself needs a canvas and is checked by
 * `node scripts/photo-to-socials.mjs`, which presses the real button on a real
 * published gallery and reads the bytes back. What is here is the half that is
 * pure arithmetic and text — and both halves of it have a way of going wrong
 * silently.
 *
 * **The name** goes into somebody's downloads folder next to forty others, and
 * it is built from a venue typed freehand, so it can hold an apostrophe, a
 * comma, a slash or an emoji.
 *
 * **The size** scales with the picture, because these arrive from whatever
 * phone was in the room: a fixed number is a shout on one photograph and
 * invisible on the next.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { saveName, markSize } from '../public/assets/photo-save.js';

test('a filename says the pub, the night and which one', () => {
  assert.equal(saveName('The Station Tap, Wokingham', '2026-08-20', 0),
    'the-station-tap-wokingham-2026-08-20-1.jpg');
  // `at` is an index and a human counts from one.
  assert.equal(saveName('The Crown', '2026-01-02', 4), 'the-crown-2026-01-02-5.jpg');
});

test('a venue typed freehand cannot put anything odd in a filename', () => {
  for (const venue of ["O'Malley's / Back Bar", 'The Crown  &  Anchor', 'Café ☕ Nero', '../../etc']) {
    const name = saveName(venue, '2026-08-20', 0);
    assert.ok(!/[^a-z0-9.-]/.test(name), `${venue} produced ${name}`);
    assert.ok(!name.includes('..'), `${venue} produced ${name}`);
    assert.ok(name.endsWith('.jpg'));
  }
});

test('a night with no venue on it still gets a usable name', () => {
  // Not a bare number: "3.jpg" in a downloads folder is the same problem as
  // the stored name wearing a friendlier face.
  const name = saveName('', '', 2);
  assert.ok(name.length > 5 && name.endsWith('.jpg'), name);
  assert.ok(/[a-z]/.test(name), `${name} is only digits`);
});

test('the mark scales with the SHORT side, and is clamped at both ends', () => {
  // A phone photograph, portrait and landscape: the same picture turned round
  // must not get a different mark.
  assert.equal(markSize(900, 1200), markSize(1200, 900));

  // It grows with the picture...
  assert.ok(markSize(3000, 4000) > markSize(900, 1200));

  // ...but never past the ceiling, or it is a name over somebody's face...
  assert.ok(markSize(8000, 8000) <= 44);
  // ...and never under the floor, or nothing survives Facebook.
  assert.ok(markSize(120, 90) >= 13);
});
