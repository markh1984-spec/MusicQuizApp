/**
 * VIDEO — `src/videos.js`: the names, the 30-day clock and the byte ranges.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEEP_DAYS, dueToGo, goesOn, isVideoName, rangeOf, sniffVideo, videoName } from '../src/videos.js';
import { PHOTO_NAME } from '../src/past-gigs.js';

test('a video is named apart from every photograph', () => {
  const n = videoName('L3x9ab', { type: 'video/mp4' });
  assert.equal(n, 'l3x9ab-vid.mp4');
  assert.ok(isVideoName(n));
  assert.ok(isVideoName(videoName('a1', { house: true, type: 'video/webm' })));
  assert.equal(PHOTO_NAME.test(n), false, 'no photo listing can pick one up by accident');
  assert.equal(isVideoName('l3x9ab.jpg'), false);
  assert.equal(isVideoName('../x-vid.mp4'), false);
});

test('the bytes say what they are, whatever the request claims', () => {
  const mp4 = Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(sniffVideo(mp4), 'video/mp4');
  assert.equal(sniffVideo(webm), 'video/webm');
  assert.equal(sniffVideo(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), null, 'a JPEG is not a video');
});

test('an unused video goes thirty days after its night, a kept one never', () => {
  assert.equal(KEEP_DAYS, 30);
  assert.equal(goesOn('2026-10-01'), '2026-10-31');
  assert.equal(dueToGo('2026-10-01', false, '2026-10-30'), false);
  assert.equal(dueToGo('2026-10-01', false, '2026-10-31'), true);
  assert.equal(dueToGo('2026-10-01', true, '2027-01-01'), false, 'starred or saved is kept for good');
  assert.equal(dueToGo('not a night', false, '2027-01-01'), false, 'a folder that is not a night is never swept');
});

test('a byte range is answered the way Safari asks', () => {
  assert.deepEqual(rangeOf(undefined, 100), { whole: true });
  assert.deepEqual(rangeOf('bytes=0-1', 100), { start: 0, end: 1 });
  assert.deepEqual(rangeOf('bytes=50-', 100), { start: 50, end: 99 });
  assert.deepEqual(rangeOf('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(rangeOf('bytes=90-500', 100), { start: 90, end: 99 });
  assert.equal(rangeOf('bytes=200-300', 100), null);
  assert.equal(rangeOf('nonsense', 100), null);
});
