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
const PORT = 49600 + Math.floor(Math.random() * 300);

async function withApp(run) {
  const data = mkdtempSync(join(tmpdir(), 'rotate-'));
  const repo = mkdtempSync(join(tmpdir(), 'rotate-gh-'));
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


/*
 * A FILED PHOTOGRAPH TURNED A QUARTER TURN — `PUT /api/past-photo/<night>/<name>`.
 *
 * The browser turns it and sends the bytes; the server writes them OVER the
 * same name so every reader gets the turned picture without a ruling to
 * carry. What has to hold: the bytes land, the next read serves them (the
 * memory and disk caches were dropped), the kind must match the name, and a
 * name that is not on the night is refused rather than created.
 */
const JPEG = (fill) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, fill)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 3)]);

test('a turned photo is written over its own name, and the next read serves it', async () => {
  await withApp(async ({ base, data, repo, restart }) => {
    const cookie = await signedIn({ base, data, restart });
    fileANight(data, repo);
    const url = `${base}/api/past-photo/${NIGHT}/p1.jpg`;
    const before = await (await fetch(`${base}/past-photo/${NIGHT}/p1.jpg`, { headers: { Cookie: cookie } })).arrayBuffer();
    assert.equal(Buffer.from(before)[10], 1, 'the fixture did not come back as filed');

    const put = await fetch(url, { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'image/jpeg' }, body: JPEG(7) });
    assert.equal(put.status, 200, `PUT answered ${put.status}: ${await put.text()}`);
    assert.equal(readFileSync(join(repo, 'photos', 'qm-mark', NIGHT, 'p1.jpg'))[10], 7, 'the repo does not hold the turned bytes');

    const after = await (await fetch(`${base}/past-photo/${NIGHT}/p1.jpg`, { headers: { Cookie: cookie } })).arrayBuffer();
    assert.equal(Buffer.from(after)[10], 7, 'the cached copy was served after the turn');
  });
});

test('the bytes must be the kind the name says, and a name not on the night is refused', async () => {
  await withApp(async ({ base, data, repo, restart }) => {
    const cookie = await signedIn({ base, data, restart });
    fileANight(data, repo);
    const wrongKind = await fetch(`${base}/api/past-photo/${NIGHT}/p1.jpg`, { method: 'PUT', headers: { Cookie: cookie }, body: PNG });
    assert.equal(wrongKind.status, 415);
    const notThere = await fetch(`${base}/api/past-photo/${NIGHT}/p9.jpg`, { method: 'PUT', headers: { Cookie: cookie }, body: JPEG(7) });
    assert.equal(notThere.status, 404);
    assert.ok(!existsSync(join(repo, 'photos', 'qm-mark', NIGHT, 'p9.jpg')), 'a refused PUT created a file');
    const noCookie = await fetch(`${base}/api/past-photo/${NIGHT}/p1.jpg`, { method: 'PUT', body: JPEG(7) });
    assert.notEqual(noCookie.status, 200, 'anybody could turn a photograph');
  });
});
