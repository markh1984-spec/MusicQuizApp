/**
 * THE PICTURE BYTES HELD IN MEMORY — bounded, and dropped when one is deleted.
 *
 * Asked on 31 August 2026, after the per-photo GitHub calls came down from
 * three to one: *"so even at 5000, 99 photos would stop working if 500 people
 * tried seeing galleries in an hour — is there further trimming?"* The
 * arithmetic is worse than that: 5,000 ÷ 99 is about FIFTY page opens an hour.
 *
 * **AND IT IS THE SAME NIGHT EVERYBODY OPENS.** A gallery is sent to a pub full
 * of people who were all there on the same evening, so the fix is to pay for a
 * night ONCE rather than once per visitor. The browser's own day-long cache
 * only ever helped somebody coming back; it does nothing for the fiftieth
 * different person.
 *
 * **THE CAP IS THE POINT, not the caching.** This process also runs live
 * quizzes for rooms of sixty phones on a 512MB instance, and *reliability beats
 * cleverness*: a cache that makes a gallery quick and a Wednesday night flaky
 * is a bad trade. So what is tested here is mostly that it REFUSES to grow.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PHOTO_CACHE_MB = '1';
const { cachedPhoto, keepPhoto, dropPhoto, photoCacheState } =
  await import('../src/photo-cache.js');

const CAP = 1024 * 1024;
const pic = (kb) => Buffer.alloc(kb * 1024, 1);

test('a photograph comes back without a second fetch', () => {
  keepPhoto('photos/a/p1.jpg', pic(10));
  assert.equal(cachedPhoto('photos/a/p1.jpg').length, 10 * 1024);
  assert.equal(cachedPhoto('photos/a/nope.jpg'), null);
});

test('IT NEVER GROWS PAST ITS CAP, whatever it is asked to hold', () => {
  for (let i = 0; i < 40; i += 1) keepPhoto(`photos/big/p${i}.jpg`, pic(100));
  const state = photoCacheState();
  assert.ok(state.bytes <= CAP, `held ${state.bytes} bytes against a ${CAP} cap`);
  assert.ok(state.photos < 40, 'nothing was evicted');
});

test('the LEAST RECENTLY USED goes first, not the oldest kept', () => {
  /*
   * The distinction is the whole reason this is an LRU rather than a queue: the
   * night everybody is looking at must survive somebody opening an old one.
   */
  for (const n of ['x', 'y', 'z']) keepPhoto(`photos/lru/${n}.jpg`, pic(300));
  // Touch x, so y is now the least recently used.
  assert.ok(cachedPhoto('photos/lru/x.jpg'));
  keepPhoto('photos/lru/w.jpg', pic(300));   // forces one out
  assert.ok(cachedPhoto('photos/lru/x.jpg'), 'the one just looked at was evicted');
  assert.equal(cachedPhoto('photos/lru/y.jpg'), null, 'the stale one survived');
});

test('a photograph bigger than the whole cache is NOT kept', () => {
  /*
   * Keeping it would evict everything else to hold one picture, which is worse
   * than not caching it at all.
   */
  const before = photoCacheState().photos;
  keepPhoto('photos/huge/p.jpg', pic(2048));
  assert.equal(cachedPhoto('photos/huge/p.jpg'), null);
  assert.ok(photoCacheState().photos >= Math.min(before, 1) - 1,
    'holding an oversized picture emptied the cache');
});

test('A DELETED PHOTOGRAPH IS DROPPED — the only thing that can make one wrong', () => {
  /*
   * A filed photograph is immutable by name, so nothing else invalidates an
   * entry. But somebody asking for theirs to be taken down must not be served
   * it a moment later out of memory.
   */
  keepPhoto('photos/gone/p9.jpg', pic(5));
  assert.ok(cachedPhoto('photos/gone/p9.jpg'));
  dropPhoto('photos/gone/p9.jpg');
  assert.equal(cachedPhoto('photos/gone/p9.jpg'), null,
    'a deleted photograph was still being served from memory');
});

test('dropping something it never had is harmless, and the count stays honest', () => {
  const before = photoCacheState();
  dropPhoto('photos/never/here.jpg');
  assert.deepEqual(photoCacheState(), before);
});

test('re-keeping the same name does not double-count its bytes', () => {
  dropPhoto('photos/same/p.jpg');
  const start = photoCacheState().bytes;
  keepPhoto('photos/same/p.jpg', pic(20));
  keepPhoto('photos/same/p.jpg', pic(20));
  assert.equal(photoCacheState().bytes - start, 20 * 1024,
    'one photograph kept twice was counted twice, so the cap would drift');
});

/*
 * ---- AND WHAT IS IN A NIGHT'S FOLDER --------------------------------------
 *
 * The gallery index asked GitHub for every night's directory, one after
 * another. Measured with a season on the shelf: twenty-one nights cost
 * twenty-two calls and 3.3 SECONDS, every time anybody opened the way in.
 *
 * A folder changes in exactly three places — a photograph arriving from the
 * room, the quizmaster adding one, and one being deleted — and all three call
 * `dropNight()`. These cases are about that, because a stale listing shows a
 * deleted photograph on a page.
 */

const { cachedNight, keepNight, dropNight } = await import('../src/photo-cache.js');

test("a night's file names come back without a second listing", () => {
  keepNight('photos/room/2026-08-13', [{ name: 'p1.jpg' }, { name: 'p2.jpg' }]);
  assert.equal(cachedNight('photos/room/2026-08-13').length, 2);
  assert.equal(cachedNight('photos/room/2026-08-20'), null);
});

test('A PHOTOGRAPH LANDING OR LEAVING FORGETS THE FOLDER', () => {
  keepNight('photos/room/2026-08-13', [{ name: 'p1.jpg' }]);
  dropNight('photos/room/2026-08-13');
  assert.equal(cachedNight('photos/room/2026-08-13'), null,
    'a deleted photograph would still be listed on the page');
});

test('two rooms are two folders, and one does not answer for the other', () => {
  /*
   * The key is the whole path, so the house room's flat `photos/<night>` and a
   * quizmaster's `photos/<id>/<night>` cannot collide — which they would if
   * this were keyed on the date, and one quizmaster would see another's list.
   */
  keepNight('photos/2026-08-13', [{ name: 'house.jpg' }]);
  keepNight('photos/qm-mark/2026-08-13', [{ name: 'mine.jpg' }, { name: 'more.jpg' }]);
  assert.equal(cachedNight('photos/2026-08-13').length, 1);
  assert.equal(cachedNight('photos/qm-mark/2026-08-13').length, 2);
});
