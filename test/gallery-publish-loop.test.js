/**
 * THE WHOLE LOOP, OVER REAL HTTP: sign in, see your drafts, publish, and check
 * a stranger can now see it.
 *
 * ---
 *
 * **THIS IS THE PATH THAT BROKE TWICE IN ONE DAY, AND NOTHING COVERED IT.**
 * The console wrote the published flag into one room while the public gallery
 * read another, so a night was published, reported as published, and invisible.
 * Separately, two writers to the same file lost each other's updates. Both were
 * silent, both reached a live page, and every check in the repo was green —
 * because the only thing standing between the console and the public page is a
 * private repository the suite has no token for, so nothing had ever run it.
 *
 * `test/helpers/photo-repo-stub.mjs` is that missing half. The server under
 * test is the real one, spawned with `--import`; only the network behind its
 * GitHub calls is a fixture.
 *
 * **AND IT SIGNS IN RATHER THAN USING THE HOST KEY.** The key is the identity
 * that hides this class of bug — it resolves to the house room, which is
 * exactly the room the gallery does NOT read. A quizmaster with a password is
 * the ordinary case, and the one a customer's experience depends on.
 *
 * Kept shallow on purpose: it guards the publishing path, not the feature.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const NIGHT = '2026-08-20';
const PASSWORD = 'a longer pass phrase';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A port of its own per run, so two of these cannot half-connect. */
const PORT = 49100 + Math.floor(Math.random() * 400);

async function withApp(run) {
  const data = mkdtempSync(join(tmpdir(), 'publoop-'));
  const repo = mkdtempSync(join(tmpdir(), 'publoop-gh-'));
  const env = {
    ...process.env,
    PORT: String(PORT), HOST_KEY: 'not-used-here', DATA_DIR: data,
    GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub',
  };
  let server = spawn(process.execPath, ['--import', STUB, 'server.js'],
    { cwd: ROOT, env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${PORT}`;
  const up = async () => {
    for (let i = 0; i < 60; i += 1) {
      try { await fetch(base); return; } catch { await wait(200); }
    }
    throw new Error('the server never came up');
  };
  const restart = async () => {
    server.kill(); await wait(300);
    server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
    await up();
  };
  try {
    await up();
    await run({ base, data, repo, restart });
  } finally {
    server.kill();
    rmSync(data, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
}

const post = (base, path, body, cookie = '') => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

/** An owner with a password, plus the owner's own quizmaster account. */
async function signedIn({ base, data, restart }) {
  const made = await (await post(base, '/api/signup',
    { email: 'mark@example.com', password: PASSWORD, name: 'Mark' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  const set = await post(base, '/api/reset/complete', { token, password: PASSWORD });
  assert.equal(set.status, 200, 'the password was not set');

  // The real shape: one login, an owner account and its own quizmaster room.
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'owner';
  acc.accounts.push({
    ...acc.accounts[0], id: 'qm-mark', email: 'mark+qm@example.com',
    name: "Mark's Quizporium", role: 'quizmaster', ownedBy: acc.accounts[0].id,
    comped: true, status: 'active',
  });
  writeFileSync(file, JSON.stringify(acc));
  await restart();

  const res = await post(base, '/api/sign-in', { email: 'mark@example.com', password: PASSWORD });
  assert.equal(res.status, 200, 'could not sign in');
  const cookie = (res.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  assert.ok(cookie, 'signing in returned no session cookie');
  return cookie;
}

/** A filed night: an archived game, and photographs in the gallery's room. */
function fileANight(data, repo) {
  const arc = join(data, 'rooms', 'qm-mark', 'archive');
  mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({
    id: 'n1', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: 'The Station Tap, Wokingham',
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));
  const dir = join(repo, 'photos', 'qm-mark', NIGHT);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 5; i += 1) writeFileSync(join(dir, `p${i}.jpg`), Buffer.alloc(64, 1));
}

const gallery = async (base, cookie = '') => {
  const r = await fetch(`${base}/api/gallery`, { headers: cookie ? { Cookie: cookie } : {} });
  const t = await r.text();
  assert.ok(!t.startsWith('<'), 'the gallery API answered with a page');
  return JSON.parse(t);
};

test('SIGNING IN IS ENOUGH — the drafts show without a host key anywhere', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileANight(app.data, app.repo);

    const mine = await gallery(app.base, cookie);
    assert.equal(mine.preview, true, 'a signed-in owner got no preview');
    assert.equal(mine.nights.length, 1, 'the owner cannot see their own unpublished night');
    assert.equal(mine.nights[0].live, false, 'an unpublished night claimed to be live');
    // The card is built server-side, so it has to arrive with the night.
    assert.equal(mine.nights[0].cover.length, 3, 'the night has no photographs on its card');
    assert.equal(mine.nights[0].venue, 'The Station Tap, Wokingham', 'the venue join is not happening');

    const theirs = await gallery(app.base);
    assert.equal(theirs.preview, false);
    assert.deepEqual(theirs.nights, [], 'a stranger can see an unpublished night');
  });
});

test('PUBLISHING PUTS IT WHERE THE PUBLIC PAGE LOOKS — the bug that shipped', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileANight(app.data, app.repo);

    const done = await post(app.base, '/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);
    assert.equal(done.status, 200, 'the publish was refused');

    /*
     * THE FILE HAS TO BE IN THE GALLERY'S OWN FOLDER. This is the whole bug:
     * the write went to the house room's flat `photos/` while the page read
     * `photos/<the owner's quizmaster room>/`, and both sides answered 200
     * with nothing wrong anywhere.
     */
    assert.ok(existsSync(join(app.repo, 'photos', 'qm-mark', 'published.json')),
      'the publish did not land in the room the gallery reads');

    const theirs = await gallery(app.base);
    assert.equal(theirs.nights.length, 1, 'a stranger still cannot see the published night');
    assert.equal(theirs.nights[0].live, true);
    assert.equal(theirs.nights[0].cover.length, 3);
  });
});

test('AND TAKING IT DOWN IS AS RELIABLE AS PUTTING IT UP', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileANight(app.data, app.repo);
    await post(app.base, '/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);
    assert.equal((await gallery(app.base)).nights.length, 1);

    await post(app.base, '/api/past-gigs/publish', { night: NIGHT, on: false }, cookie);
    assert.deepEqual((await gallery(app.base)).nights, [],
      'somebody asked for their photo to come down and it did not');
  });
});
