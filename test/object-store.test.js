/**
 * THE OBJECT STORE — the path encoding, the round trip, and the one thing the
 * whole move was for: a DELETE that actually deletes.
 *
 * **WHAT THIS PROVES AND WHAT IT DOES NOT.** It runs `src/r2.js` and the
 * `which === 'photos'` delegation in `src/github.js` against a fixture store,
 * so the shapes, the fallback, the union and the bin are all exercised for
 * real. It does NOT prove the SigV4 signature against a live supplier — no
 * suite here holds keys and none ever should. That half is checked by
 * `checkAccess()`, which WRITES and removes rather than reading, and which
 * `scripts/photos-to-r2.mjs` runs before it moves a single photograph: a
 * signing fault is a 403 on the first call, said out loud, rather than a night
 * that files into nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

process.env.OBJECT_STUB_DIR = mkdtempSync(path.join(tmpdir(), 'objstore-'));
// Named explicitly rather than inherited: this asserts what is and is NOT
// reached, so a token in the ambient environment would quietly change what is
// being tested — and pass while doing it.
for (const v of ['GITHUB_TOKEN', 'GITHUB_REPO', 'PHOTO_REPO', 'PHOTO_TOKEN']) delete process.env[v];
process.env.R2_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
process.env.R2_BUCKET = 'photos';
process.env.R2_ACCESS_KEY_ID = 'key';
process.env.R2_SECRET_ACCESS_KEY = 'secret';

await import('./helpers/object-store-stub.mjs');
const store = await import('../src/r2.js');
const github = await import('../src/github.js');

const ROOT = process.env.OBJECT_STUB_DIR;
const onShelf = (key) => fs.existsSync(path.join(ROOT, key));

test('RFC 3986, NOT encodeURIComponent — the four characters they disagree on', () => {
  /*
   * S3 signs ITS encoding of the path. `encodeURIComponent` leaves ! ' ( ) *
   * alone and S3 does not, so a name holding one would be signed one way and
   * asked for another — a 403 that reads like a rejected key.
   */
  assert.equal(store.encodePath("a/b'c(d)e!f*g.jpg"), 'a/b%27c%28d%29e%21f%2Ag.jpg');
  // A slash stays a slash: it is what separates the parts, not part of one.
  assert.equal(store.encodePath('photos/room/2026-08-20/p0.jpg'), 'photos/room/2026-08-20/p0.jpg');
  // A space is %20, never a plus. A plus is a literal plus in a path.
  assert.equal(store.encodePath('a b/c+d.jpg'), 'a%20b/c%2Bd.jpg');
});

test('a photograph goes in, comes back, and is listed', async () => {
  const at = 'photos/room1/2026-08-20/p0.jpg';
  assert.deepEqual(await store.put(at, Buffer.from('JPEGBYTES')), { ok: true });
  assert.equal(onShelf(at), true);
  assert.equal((await store.get(at)).toString(), 'JPEGBYTES');

  const listed = await store.tryListDir('photos/room1/2026-08-20');
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.files, [{ name: 'p0.jpg', path: at }]);

  // The FOLDERS in a folder — the list of nights somebody has run.
  assert.deepEqual(await store.listDirs('photos/room1'), [{ name: '2026-08-20', path: 'photos/room1/2026-08-20' }]);
});

test('A MISS IS AN ANSWER — null, not a failure', async () => {
  const read = await store.tryGet('photos/room1/nothing/here.jpg');
  assert.deepEqual(read, { ok: true, body: null });
  assert.equal(await store.get('photos/room1/nothing/here.jpg'), null);
});

test('THE WHOLE POINT — a delete leaves nothing behind it', async () => {
  const at = 'photos/room1/2026-08-20/gone.jpg';
  await store.put(at, Buffer.from('x'));
  assert.equal(onShelf(at), true);
  assert.deepEqual(await store.remove(at), { ok: true });
  /*
   * In the private repository this assertion could only ever be about the
   * working tree: `git log` still holds the bytes, for ever, which is the
   * sentence in CLAUDE.md that this whole module exists to stop being true.
   */
  assert.equal(onShelf(at), false);
  assert.equal(await store.get(at), null);
});

test('a folder marker is not a photograph', async () => {
  await store.put('photos/room2/2026-09-01/', Buffer.alloc(0));
  await store.put('photos/room2/2026-09-01/real.jpg', Buffer.from('x'));
  const listed = await store.tryListDir('photos/room2/2026-09-01');
  assert.deepEqual(listed.files.map((f) => f.name), ['real.jpg']);
});

test("github.js sends `which === 'photos'` to the store, and nothing else", async () => {
  const at = 'photos/room3/2026-09-10/p1.jpg';
  assert.deepEqual(await github.putFile(at, Buffer.from('bytes'), 'a message', 'photos'), { ok: true });
  assert.equal(onShelf(at), true);
  assert.equal((await github.getFile(at, 'photos')).toString(), 'bytes');
  assert.deepEqual((await github.listDirs('photos/room3', 'photos')).map((f) => f.name), ['2026-09-10']);

  // And the bin reaches it.
  assert.equal((await github.deleteFile(at, 'binned', 'photos')).ok, true);
  assert.equal(onShelf(at), false);

  // The app repo is untouched by any of this — it is a different store and a
  // different question, and it is deliberately NOT set up here.
  assert.equal(github.githubConfigured(), false);
  assert.deepEqual(await github.tryGetFile('data/accounts.json'), { ok: true, body: null });
});

test('somewhere to put a photograph — the question every caller is really asking', () => {
  assert.equal(github.photosRepoConfigured(), true, 'an object store IS somewhere to put one');
  assert.deepEqual(github.missingPhotoConfig(), []);
});

test('putFiles is a parallel put, and an empty list is still an ok no-op', async () => {
  assert.deepEqual(await github.putFiles([], 'nothing', 'photos'), { ok: true, count: 0 });
  const done = await github.putFiles([
    { path: 'photos/room4/n/a.jpg', contents: Buffer.from('a') },
    { path: 'photos/room4/n/b.jpg', contents: Buffer.from('b') },
  ], 'two', 'photos');
  assert.deepEqual(done, { ok: true, count: 2 });
  assert.equal(onShelf('photos/room4/n/a.jpg') && onShelf('photos/room4/n/b.jpg'), true);
});
