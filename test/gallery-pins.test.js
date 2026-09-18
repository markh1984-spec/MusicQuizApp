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
  /*
   * `a.jpg` is a camera photo the host switched OFF by hand; `b-picked.jpg` is
   * an upload, off by default under the camera gate (`showsByDefault()`,
   * restored). Either way both are off the page, and the point of the test is
   * unchanged: a pin on a photograph the lamp will not show must not reach the
   * card.
   */
  const all = ['a.jpg', 'b-picked.jpg', 'c.jpg', 'd.jpg'];
  const said = { [`${NIGHT}/a.jpg`]: 'off', [`${NIGHT}/b-picked.jpg`]: 'off' };
  const shown = galleryPhotosOf(all, NIGHT, said, (n, m) => `${n}/${m}`);
  assert.deepEqual(shown, ['c.jpg', 'd.jpg'], 'the filter itself moved');
  const cover = coverPhotos(shown, NIGHT, ['a.jpg', 'b-picked.jpg']);
  assert.equal(cover.includes('a.jpg'), false, 'a hidden photo reached the card');
  assert.equal(cover.includes('b-picked.jpg'), false, 'a hidden photo reached the card');
  assert.equal(showsOnGallery('a.jpg', 'off'), false);
  // And a picked one with NO ruling is off by default now — the camera gate.
  assert.equal(showsOnGallery('b-picked.jpg', undefined), false);
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

/*
 * ---- A STAR MEANS PUBLIC -----------------------------------------------
 *
 * Reported off a live console: *"I just saw a photo that had a star on it but
 * with a red dot, which doesn't make any sense."* It did not. The test above
 * proves a hidden photograph never reaches the card — which was correct, and
 * was the whole problem: the app resolved a contradiction it was happy to
 * store, in silence, and the star sat there lit and doing nothing.
 *
 * So the two controls are now one decision with an order to it, enforced in
 * the two writers that share the file. `coverPhotos()` still filters, and that
 * is deliberate belt and braces: `published.json` lives in a repo a human can
 * hand-edit, so the READ must go on refusing what the WRITERS can no longer
 * produce.
 */

test('STARRING ONE PUBLISHES IT — an upload the room sent, off by default', async () => {
  const repo = stubRepo();
  try {
    const name = 'b-picked.jpg';
    assert.equal(showsOnGallery(name, undefined), false, 'the default moved');
    const done = await setPhotoPin(ROOM, NIGHT, name, true);
    assert.equal(done.ok, true);
    assert.equal(done.onGallery, true, 'the star left the photo hidden');
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/${name}`]: 'on' });
  } finally { repo.restore(); }
});

test('…and on a house photo it CLEARS the hiding rather than stacking an "on" over it', async () => {
  /*
   * A ruling that only restates the default is cleared, not stored — the rule
   * `showsOnGallery()` exists to keep. Writing `'on'` here would pin this
   * photograph to today's default for ever, and a later change to how the
   * default is decided could never reach it again.
   */
  const repo = stubRepo();
  try {
    await setPhotoDecision(ROOM, NIGHT, 'a.jpg', 'off');
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/a.jpg`]: 'off' });
    const done = await setPhotoPin(ROOM, NIGHT, 'a.jpg', true);
    assert.equal(done.onGallery, true);
    assert.deepEqual(await photoDecisions(ROOM), {}, 'a ruling that says nothing was stored');
  } finally { repo.restore(); }
});

test('HIDING A STARRED PHOTOGRAPH TAKES ITS STAR OFF — the other direction', async () => {
  const repo = stubRepo();
  try {
    await setPhotoPin(ROOM, NIGHT, 'a.jpg', true);
    await setPhotoPin(ROOM, NIGHT, 'c.jpg', true);
    const done = await setPhotoDecision(ROOM, NIGHT, 'a.jpg', 'off');
    assert.equal(done.ok, true);
    assert.equal(done.pinned, false, 'the reply still claimed it was starred');
    assert.deepEqual((await photoPins(ROOM))[NIGHT], ['c.jpg'],
      'a hidden photograph kept a star that now means nothing');
  } finally { repo.restore(); }
});

test('but UN-starring one does not hide it', async () => {
  // One direction only. A star is a preference about which public photographs
  // lead; taking it off says nothing about whether the photo is public, and a
  // control that quietly hid a picture would be far worse than one that did not.
  const repo = stubRepo();
  try {
    await setPhotoPin(ROOM, NIGHT, 'b-picked.jpg', true);
    await setPhotoPin(ROOM, NIGHT, 'b-picked.jpg', false);
    assert.deepEqual(await photoPins(ROOM), {});
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/b-picked.jpg`]: 'on' },
      'taking the star off hid the photograph as well');
  } finally { repo.restore(); }
});

test('A REFUSED FOURTH STAR PUBLISHES NOTHING', async () => {
  /*
   * The cap is refused rather than trimmed, and the refusal has to take the
   * publish with it — otherwise a press that visibly did nothing would still
   * have put a photograph the room sent onto a public page.
   */
  const repo = stubRepo();
  try {
    for (const n of ['p1.jpg', 'p2.jpg', 'p3.jpg']) await setPhotoPin(ROOM, NIGHT, n, true);
    const over = await setPhotoPin(ROOM, NIGHT, 'p4-picked.jpg', true);
    assert.equal(over.ok, false);
    assert.deepEqual(await photoDecisions(ROOM), {}, 'a refused star published a photograph');
    assert.equal(showsOnGallery('p4-picked.jpg', (await photoDecisions(ROOM))[`${NIGHT}/p4-picked.jpg`]), false);
  } finally { repo.restore(); }
});

test('starring one already starred and public writes nothing at all', async () => {
  // A second tap on a control that is already where it should be must not make
  // a commit — the rule every writer of this file follows.
  const repo = stubRepo();
  try {
    await setPhotoPin(ROOM, NIGHT, 'a.jpg', true);
    const before = repo.files.size && JSON.stringify([...repo.files]);
    const again = await setPhotoPin(ROOM, NIGHT, 'a.jpg', true);
    assert.equal(again.ok, true);
    assert.equal(JSON.stringify([...repo.files]), before, 'a no-op press wrote the file');
  } finally { repo.restore(); }
});
