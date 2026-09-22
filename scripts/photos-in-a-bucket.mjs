#!/usr/bin/env node
/**
 * THE PHOTOGRAPHS IN AN OBJECT STORE — does a gallery still work, and does the
 * BIN finally mean it?
 *
 * ---
 *
 * The private repository has been an honest store for a year and it has one
 * fault that cannot be fixed from inside it: **a deleted photo leaves the repo
 * but NOT git history.** For pictures of the public in a pub that is the wrong
 * promise, and it is why `src/r2.js` exists.
 *
 * The swap happens at one choke point — `github.js` sends `which === 'photos'`
 * to the store whenever one is configured — so the risk is not the store, it
 * is the twenty call sites that were never told. Every one of them is on the
 * read path of a page a stranger opens. So this drives the whole thing over
 * real HTTP, against a fixture bucket, with NO photo repository configured at
 * all:
 *
 *   - a night publishes and its photographs are listed;
 *   - the public gallery serves the bytes to a visitor with no cookie;
 *   - the index names the night, which comes from a FOLDER listing — the one
 *     shape an object store genuinely does not have and has to fake;
 *   - the console's own grid reads the same night;
 *   - and the bin removes it from the bucket, verified on the shelf itself,
 *     which is the entire reason for the move.
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers/live-app.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'object-store-stub.mjs');
const PW = 'a-long-enough-one-for-here';
const NIGHT = '2026-08-20';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? `  — ${detail}` : ''}`); };

const shelf = mkdtempSync(join(tmpdir(), 'bucket-obj-'));
/*
 * ONE SPAWN FOR EVERY SPAWNER — `startApp()` in `scripts/helpers/live-app.mjs`:
 * it waits for its OWN server by pid, runs it on a COPY of the catalogue, and
 * its restart waits for the old server to be gone before binding the port
 * again. This script used to take a port on trust and restart with a kill and
 * a sleep.
 */
const app = await startApp({
  key: 'x',
  nodeArgs: ['--import', STUB],
  env: {
    OBJECT_STUB_DIR: shelf,
    R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    R2_BUCKET: 'photos',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    // UNSET, so the store is the only place a photograph can go: empty is how
    // this app reads a variable nobody set.
    PHOTO_REPO: '', PHOTO_TOKEN: '', GITHUB_TOKEN: '', GITHUB_REPO: '',
  },
});
const { base, data } = app;
const post = (p, b, c = '') => fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(c ? { Cookie: c } : {}) }, body: JSON.stringify(b) });
const get = (p, c = '') => fetch(`${base}${p}`, { headers: c ? { Cookie: c } : {} });

console.log('\nTHE PHOTOGRAPHS IN AN OBJECT STORE — and does the bin mean it?\n');
try {
  const made = await (await post('/api/signup', { email: 'qm@example.com', password: PW, name: 'Mark' })).json();
  const t = new URL(made.devLink).searchParams.get('t');
  await post('/api/reset/complete', { token: t, password: PW });
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'quizmaster'; acc.accounts[0].comped = true; acc.accounts[0].status = 'active';
  writeFileSync(file, JSON.stringify(acc));
  if (!await app.restart({ hard: false })) throw new Error('the server did not come back');
  const signIn = await post('/api/sign-in', { email: 'qm@example.com', password: PW });
  const cookie = (signIn.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  const me = await (await get('/api/me', cookie)).json();
  const roomId = me.account.id;

  check('the app says the photographs live in the bucket', /object store/.test(
    (await (await get(`/api/owner/photos?key=x`, cookie)).json()).repo || ''), 'the console would name the wrong place');

  // A night to hang them on, and four photographs on the shelf. Seeded
  // directly so the READ path is what is under test; the write half is
  // `putFile()` and is pinned in test/object-store.test.js.
  const arc = join(data, 'rooms', roomId, 'archive');
  mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({
    id: 'n1', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: 'The Station Tap, Wokingham',
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));

  const maker = await (await get('/')).text();
  void maker;
  // A one-pixel JPEG is enough: nothing here decodes it, and a real encoder
  // would make this guard depend on a browser it does not otherwise need.
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
    + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
    + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
  const bucketNight = join(shelf, 'photos', roomId, NIGHT);
  mkdirSync(bucketNight, { recursive: true });
  for (let i = 0; i < 4; i += 1) writeFileSync(join(bucketNight, `p${i}.jpg`), jpeg);

  const pub = await post('/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);
  check('the night publishes', pub.status === 200, `${pub.status}`);

  const index = await (await get(`/api/gallery?q=${roomId}`)).json();
  // A FOLDER IS A FICTION IN AN OBJECT STORE — rolled up from the key prefixes
  // rather than being a thing that exists. This is the assertion that proves
  // the fiction holds, and it is the one an S3 client gets wrong.
  check('the index names the night, off a folder listing that is really a prefix',
    (index.nights || []).some((n) => n.night === NIGHT), JSON.stringify((index.nights || []).map((n) => n.night)));

  const night = await (await get(`/api/gallery/${NIGHT}?q=${roomId}`)).json();
  check('all four photographs are listed to a stranger', (night.photos || []).length === 4,
    `${(night.photos || []).length} photos`);

  const one = (night.photos || [])[0];
  const served = await get(`/gallery-photo/${NIGHT}/${one && one.name}?q=${roomId}`);
  const bytes = served.ok ? Buffer.from(await served.arrayBuffer()) : Buffer.alloc(0);
  check('the bytes reach a visitor with no cookie', served.status === 200 && bytes.length === jpeg.length,
    `${served.status}, ${bytes.length} of ${jpeg.length} bytes`);

  const mine = await (await get(`/api/past-gigs/${NIGHT}`, cookie)).json();
  check("the console's own grid reads the same night", (mine.photos || []).length === 4,
    `${(mine.photos || []).length} photos`);

  // ---- and the whole reason for the move
  const binned = await fetch(`${base}/api/past-photo/${NIGHT}/${one.name}`, { method: 'DELETE', headers: { Cookie: cookie } });
  check('the bin answers', binned.status === 200, `${binned.status}`);
  check('AND THE BYTES ARE GONE FROM THE STORE, not just off the page',
    !existsSync(join(bucketNight, one.name)),
    'in a repository this could only ever be true of the working tree');

  const after = await (await get(`/api/gallery/${NIGHT}?q=${roomId}`)).json();
  check('and the gallery is down to three', (after.photos || []).length === 3,
    `${(after.photos || []).length} photos`);

  /*
   * AND NOTHING BUT PHOTOGRAPHS WENT INTO THE BUCKET.
   *
   * This is the assertion that was missing on 18 September 2026, and the fault
   * it would have caught cost a live gallery. `inStore()` read
   * `which === 'photos' || which === 'private'`, so the accounts book and the
   * join-code book — which have nothing to do with photographs — were written to
   * the bucket and then read from it FIRST, shadowing the good copies in the
   * repository for good. An account has been created, signed in and published a
   * night by this point in the run, so if `'private'` is in the store there is a
   * file up here to find.
   */
  const root = readdirSync(shelf);
  check('and NOTHING but photographs went into the bucket',
    root.length === 1 && root[0] === 'photos',
    `the bucket's root holds: ${root.join(', ')} — the accounts book and the join codes belong in the repository`);
} catch (err) {
  failures += 1;
  console.log('  FAIL threw:', err.stack || err.message);
} finally {
  await app.stopAndWait();
  rmSync(shelf, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
console.log(failures ? `\n${failures} FAILED\n` : '\nALL GOOD — the gallery runs off the object store, and a binned photo is really gone.\n');
process.exit(failures ? 1 : 0);
