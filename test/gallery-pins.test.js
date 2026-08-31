/**
 * THE PHOTOGRAPHS A HUMAN PICKED FOR A NIGHT'S CARD.
 *
 * Asked for on 31 August 2026: *"random spread across a night but also the
 * ability to pick them — a little icon on each photo where I can pin up to 3,
 * so if I dislike one of the random photos I can remove the pin from that one
 * and give it to something else."*
 *
 * **A PIN IS A PREFERENCE, NEVER A GATE.** Which photographs are public is the
 * lamp's question, asked once by `showsOnGallery()`. A pin only says which of
 * the public ones lead on the card — so a pin on a photograph the lamp has
 * switched off must do nothing at all, which is the case worth a test of its
 * own: getting it wrong would put a picture on the index page advertising a
 * night whose own page refuses to show it.
 *
 * The repo is a Map behind a stubbed `fetch` — no network, like every other
 * test here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PHOTO_REPO = 'someone/photos';
process.env.PHOTO_TOKEN = 'stub';

const { setPhotoPin, photoPins, setPublished, publishedNights, setPhotoDecision, photoDecisions, MAX_PINS } =
  await import('../src/gallery.js');
const { coverPhotos, showsOnGallery, galleryPhotosOf } = await import('../src/photos.js');

const NIGHT = '2026-08-20';
const ROOM = 'qm-mark';

function stubRepo() {
  const files = new Map();
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('https://api.github.com/')) return real(input, init);
    const at = decodeURI(url.match(/\/contents\/([^?]*)/)[1]);
    if ((init.method || 'GET').toUpperCase() === 'PUT') {
      files.set(at, Buffer.from(JSON.parse(init.body).content, 'base64').toString('utf8'));
      return new Response(JSON.stringify({ content: { sha: 'x' } }), { status: 200 });
    }
    if (!files.has(at)) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(JSON.stringify({
      name: 'published.json', path: at, sha: 'x', type: 'file', encoding: 'base64',
      content: Buffer.from(files.get(at), 'utf8').toString('base64'),
    }), { status: 200 });
  };
  return { files, restore: () => { globalThis.fetch = real; } };
}

const names = (n) => Array.from({ length: n }, (_, i) => `p${i}.jpg`);

test('three is the cap, and a fourth is REFUSED rather than dropped', async () => {
  const repo = stubRepo();
  try {
    for (const n of ['p1.jpg', 'p2.jpg', 'p3.jpg']) {
      assert.equal((await setPhotoPin(ROOM, NIGHT, n, true)).ok, true);
    }
    const over = await setPhotoPin(ROOM, NIGHT, 'p4.jpg', true);
    assert.equal(over.ok, false, 'a fourth pin was accepted');
    /*
     * The REASON matters as much as the refusal: silently keeping three would
     * look exactly like a press that did not register, which is the fault this
     * app has a rule against.
     */
    assert.match(over.error, /Three/);
    assert.deepEqual((await photoPins(ROOM))[NIGHT], ['p1.jpg', 'p2.jpg', 'p3.jpg']);
    assert.equal(MAX_PINS, 3);
  } finally { repo.restore(); }
});

test('taking one off frees the slot for another', async () => {
  const repo = stubRepo();
  try {
    for (const n of ['p1.jpg', 'p2.jpg', 'p3.jpg']) await setPhotoPin(ROOM, NIGHT, n, true);
    assert.equal((await setPhotoPin(ROOM, NIGHT, 'p2.jpg', false)).ok, true);
    assert.equal((await setPhotoPin(ROOM, NIGHT, 'p9.jpg', true)).ok, true);
    assert.deepEqual((await photoPins(ROOM))[NIGHT], ['p1.jpg', 'p3.jpg', 'p9.jpg']);
  } finally { repo.restore(); }
});

test('a night with no pins left is REMOVED, not stored as an empty list', async () => {
  const repo = stubRepo();
  try {
    await setPhotoPin(ROOM, NIGHT, 'p1.jpg', true);
    await setPhotoPin(ROOM, NIGHT, 'p1.jpg', false);
    assert.deepEqual(await photoPins(ROOM), {},
      'an empty list is a ruling that says nothing — the gap dial rule');
  } finally { repo.restore(); }
});

test('publishing a night does not wipe its pins, and pinning does not unpublish it', async () => {
  /*
   * THE HALVES RIDE ALONG. Three writers share this file now — nights,
   * rulings and pins — and each has to carry the two it is not changing. The
   * publish writer already had this rule for the rulings; adding a third half
   * is exactly when it gets forgotten.
   */
  const repo = stubRepo();
  try {
    await setPhotoPin(ROOM, NIGHT, 'p1.jpg', true);
    await setPhotoDecision(ROOM, NIGHT, 'p2-picked.jpg', 'on');
    await setPublished(ROOM, NIGHT, true);
    assert.deepEqual((await photoPins(ROOM))[NIGHT], ['p1.jpg'], 'publishing wiped the pins');
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/p2-picked.jpg`]: 'on' },
      'publishing wiped the rulings');

    await setPhotoPin(ROOM, NIGHT, 'p3.jpg', true);
    assert.deepEqual(await publishedNights(ROOM), [NIGHT], 'pinning unpublished the night');
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/p2-picked.jpg`]: 'on' },
      'pinning wiped the rulings');
  } finally { repo.restore(); }
});

test('A PIN CANNOT PUT A HIDDEN PHOTOGRAPH ON THE CARD', () => {
  /*
   * The card is built from the SAME filtered list a night's page shows, so a
   * pin on a photo the lamp switched off is simply not used. Getting this
   * wrong would advertise a night with a picture its own page refuses.
   */
  const all = ['a.jpg', 'b-picked.jpg', 'c.jpg', 'd.jpg'];
  const said = { [`${NIGHT}/a.jpg`]: 'off' };
  const shown = galleryPhotosOf(all, NIGHT, said, (n, m) => `${n}/${m}`);
  assert.deepEqual(shown, ['c.jpg', 'd.jpg'], 'the filter itself moved');
  // 'a.jpg' is switched off and 'b-picked.jpg' was never camera-taken.
  const cover = coverPhotos(shown, NIGHT, ['a.jpg', 'b-picked.jpg']);
  assert.equal(cover.includes('a.jpg'), false, 'a hidden photo reached the card');
  assert.equal(cover.includes('b-picked.jpg'), false, 'a non-camera photo reached the card');
  assert.equal(showsOnGallery('a.jpg', 'off'), false);
});

test('the card is the same on every device and every reload', () => {
  const shown = names(18);
  const once = coverPhotos(shown, NIGHT, []);
  assert.deepEqual(coverPhotos(shown, NIGHT, []), once, 'the card reshuffles');
  assert.equal(new Set(once).size, 3, 'the same photo appeared twice on one card');
});

test('the picks are spread across the night and stay in order', () => {
  const shown = names(40);
  const got = coverPhotos(shown, NIGHT, []);
  const at = got.map((n) => shown.indexOf(n));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the picks came back out of order');
  /*
   * The whole point of a spread: the first three photographs of a night are
   * usually one table in one minute, so adjacent picks are the failure.
   */
  assert.ok(at[1] - at[0] > 4 && at[2] - at[1] > 4, `too close together: ${at.join(', ')}`);
});

test('a short night still gets a card, and never a duplicate on it', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const got = coverPhotos(names(n), NIGHT, []);
    assert.equal(got.length, Math.min(3, n), `${n} photos gave ${got.length}`);
    assert.equal(new Set(got).size, got.length, `${n} photos gave a duplicate`);
  }
  assert.deepEqual(coverPhotos([], NIGHT, []), [], 'a night with no photos should give no card');
});

test('two nights of the same length do not get the same card', () => {
  const shown = names(18);
  assert.notDeepEqual(coverPhotos(shown, '2026-08-20', []), coverPhotos(shown, '2026-08-13', []));
});
