/**
 * THE MOVE, HALF DONE — which is the state this app will actually be in.
 *
 * Setting the object store's variables is one press on a settings page; moving
 * a year of photographs across is a script somebody runs afterwards, or next
 * month, or never. In between, the two stores each hold some of the nights —
 * and the gallery, Past gigs, the league and the headcounts all read that as
 * *somebody's history*, so getting it wrong does not throw, it makes half of
 * their work disappear off a page they show to a landlord.
 *
 * So the rule, stated in `src/github.js` and asserted here:
 *
 *   - a WRITE goes to the store and only the store, so the repository stops
 *     growing the moment the variables are set;
 *   - a READ tries the store and falls through to the repository ON A MISS —
 *     never on a failure, which would put every timeout back on the rate limit
 *     the store exists to escape;
 *   - a LISTING is the UNION of both, never one or the other;
 *   - and the BIN reaches both, or a deleted photograph comes back the next
 *     time the store misses and the read falls through as designed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const SHELF = mkdtempSync(path.join(tmpdir(), 'objstore-b-'));
const REPO = mkdtempSync(path.join(tmpdir(), 'ghrepo-b-'));
process.env.OBJECT_STUB_DIR = SHELF;
process.env.GH_STUB_DIR = REPO;
process.env.R2_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
process.env.R2_BUCKET = 'photos';
process.env.R2_ACCESS_KEY_ID = 'key';
process.env.R2_SECRET_ACCESS_KEY = 'secret';
process.env.PHOTO_REPO = 'a/b';
process.env.PHOTO_TOKEN = 'stub';

// ORDER MATTERS: each stub keeps the `fetch` it found and falls through to it,
// so the object store's has to be the outer one for the GitHub calls to reach
// theirs at all.
await import('./helpers/photo-repo-stub.mjs');
await import('./helpers/object-store-stub.mjs');
const github = await import('../src/github.js');

const inRepo = (key, body) => {
  fs.mkdirSync(path.join(REPO, path.dirname(key)), { recursive: true });
  fs.writeFileSync(path.join(REPO, key), body);
};
const inStore = (key, body) => {
  fs.mkdirSync(path.join(SHELF, path.dirname(key)), { recursive: true });
  fs.writeFileSync(path.join(SHELF, key), body);
};

test('a photograph still in the OLD repository is still served', async () => {
  inRepo('photos/r/2026-01-01/old.jpg', 'OLDBYTES');
  const read = await github.tryGetFile('photos/r/2026-01-01/old.jpg', 'photos');
  assert.deepEqual(read, { ok: true, body: Buffer.from('OLDBYTES') });
});

test('a WRITE goes to the store and never to the repository', async () => {
  await github.putFile('photos/r/2026-02-02/new.jpg', Buffer.from('NEW'), 'filed', 'photos');
  assert.equal(fs.existsSync(path.join(SHELF, 'photos/r/2026-02-02/new.jpg')), true);
  assert.equal(fs.existsSync(path.join(REPO, 'photos/r/2026-02-02/new.jpg')), false,
    'the repository must stop growing the moment the store is set up');
});

test('THE NIGHTS ARE UNIONED, NEVER SWAPPED', async () => {
  // One night in each. Picking a store rather than merging them is how half of
  // somebody's history vanishes off Past gigs with nothing thrown.
  const nights = (await github.listDirs('photos/r', 'photos')).map((f) => f.name).sort();
  assert.deepEqual(nights, ['2026-01-01', '2026-02-02']);
});

test('and a night filed in BOTH is one night, not two', async () => {
  inRepo('photos/r/2026-03-03/a.jpg', 'A');
  inStore('photos/r/2026-03-03/b.jpg', 'B');
  const nights = (await github.listDirs('photos/r', 'photos')).map((f) => f.name);
  assert.equal(nights.filter((n) => n === '2026-03-03').length, 1);
  // …and it shows everything in it, wherever each picture happens to live.
  const files = (await github.listDir('photos/r/2026-03-03', 'photos')).map((f) => f.name).sort();
  assert.deepEqual(files, ['a.jpg', 'b.jpg']);
});

test('the BIN reaches the old repository too', async () => {
  inRepo('photos/r/2026-04-04/binme.jpg', 'X');
  assert.equal((await github.deleteFile('photos/r/2026-04-04/binme.jpg', 'gone', 'photos')).ok, true);
  assert.equal(fs.existsSync(path.join(REPO, 'photos/r/2026-04-04/binme.jpg')), false,
    'a photograph left in the repository comes straight back through the read fallback');
  assert.equal(await github.getFile('photos/r/2026-04-04/binme.jpg', 'photos'), null);
});

test('A FAILURE IS NOT A MISS — a broken store does not quietly become a GitHub read', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/r2\.cloudflarestorage\.com/.test(url)) return new Response('', { status: 500 });
    return real(input, init);
  };
  try {
    inRepo('photos/r/2026-05-05/there.jpg', 'HERE');
    const read = await github.tryGetFile('photos/r/2026-05-05/there.jpg', 'photos');
    /*
     * The tempting behaviour is to fall through and serve it. It is wrong: a
     * store that is failing would then push its whole read load back onto the
     * 5,000-an-hour limit this move exists to escape, and it would do it
     * silently, for as long as the old repository still answered.
     */
    assert.equal(read.ok, false);
    assert.match(read.error, /500/);
  } finally {
    globalThis.fetch = real;
  }
});
