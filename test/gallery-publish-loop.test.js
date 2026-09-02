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

/*
 * ---- SEEING IT AS A VISITOR -----------------------------------------------
 *
 * *"This is the public gallery and needs to display these photos without
 * signing in otherwise there's no point in it being published at all."*
 *
 * It does — and the quizmaster is the one person who cannot verify that,
 * because the browser they check in carries the console's cookie and therefore
 * always gets the preview. `?as=visitor` stands the preview down.
 *
 * **THE POINT OF TESTING IT HERE IS THAT IT IS THE SERVER'S ANSWER.** A page
 * that filtered its own drafts out would prove the page can hide them, not
 * that the server refuses them — and refusing them is the thing being checked.
 * So this asserts on the JSON, signed in, against the SAME night the test
 * above proves a stranger cannot see.
 */
test('?as=visitor gives a signed-in quizmaster exactly what a stranger gets', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileANight(app.data, app.repo);

    // Signed in: the preview, with the draft on it.
    const mine = await gallery(app.base, cookie);
    assert.equal(mine.preview, true);
    assert.equal(mine.nights.length, 1, 'the preview is not showing the draft');

    // The same browser, the same cookie, standing the preview down.
    const asVisitor = await (await fetch(`${app.base}/api/gallery?as=visitor`,
      { headers: { Cookie: cookie } })).json();
    assert.equal(asVisitor.preview, false, 'the preview survived ?as=visitor');
    assert.deepEqual(asVisitor.nights, [],
      'a quizmaster checking as a visitor was still shown their own draft');

    // And it matches what a stranger genuinely gets, which is the whole claim.
    const theirs = await gallery(app.base);
    assert.deepEqual(asVisitor.nights, theirs.nights,
      'as=visitor and a real stranger disagree about what is public');

    /*
     * IT MUST REACH THE NIGHT'S OWN PAGE AND THE PHOTOGRAPHS THEMSELVES, or
     * the check passes on the way in and quietly fails one click later — which
     * is the shape of every gallery bug this file already records.
     */
    const one = await fetch(`${app.base}/api/gallery/${NIGHT}?as=visitor`,
      { headers: { Cookie: cookie } });
    assert.equal(one.status, 404, "a draft night's own page opened as a visitor");
    const pic = await fetch(`${app.base}/gallery-photo/${NIGHT}/p0.jpg?as=visitor`,
      { headers: { Cookie: cookie } });
    assert.equal(pic.status, 404, "a draft night's photographs served as a visitor");
  });
});

/*
 * AND IT ONLY EVER TAKES ACCESS AWAY. A parameter that granted anything would
 * be a gate with a query string round it; this asserts the published case is
 * untouched, so the switch cannot be mistaken for one that changes what is
 * public rather than what this browser is shown.
 */
test('?as=visitor never hides anything that is genuinely published', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileANight(app.data, app.repo);
    await post(app.base, '/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);

    const asVisitor = await (await fetch(`${app.base}/api/gallery?as=visitor`,
      { headers: { Cookie: cookie } })).json();
    assert.equal(asVisitor.nights.length, 1, 'a published night vanished under ?as=visitor');
    assert.equal(asVisitor.nights[0].live, true);

    const one = await fetch(`${app.base}/api/gallery/${NIGHT}?as=visitor`,
      { headers: { Cookie: cookie } });
    assert.equal(one.status, 200, "a published night's page was refused as a visitor");
    const pic = await fetch(`${app.base}/gallery-photo/${NIGHT}/p0.jpg?as=visitor`,
      { headers: { Cookie: cookie } });
    assert.equal(pic.status, 200, 'a published photograph was refused as a visitor');
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

/*
 * ---- A CACHED LISTING MUST NOT OUTLIVE A PHOTOGRAPH ----------------------
 *
 * The gallery index listed every night's folder one after another — twenty-one
 * nights cost twenty-two GitHub calls and 3.3 seconds, on the page that is the
 * way in. They run together now and the answer is held.
 *
 * **WHICH IS ONLY SAFE IF A FOLDER FORGETS ITSELF WHEN IT CHANGES.** A stale
 * listing on this page means a photograph somebody asked to have deleted still
 * being offered — the same class of harm as a stale publish flag, and the
 * reason this is tested over real HTTP rather than against the cache's own
 * functions: what matters is that the ROUTES drop it, not that the module can.
 */

test('a photograph added is on the page immediately, not in a minute', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileANight(app.data, app.repo);
    await post(app.base, '/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);

    const count = async () => ((await gallery(app.base)).nights[0] || {}).count || 0;
    const before = await count();          // warms the listing
    assert.equal(before, 5);

    // The smallest thing `sniffType()` takes as a JPEG.
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
    const up = await fetch(`${app.base}/api/past-photo/${NIGHT}`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg', Cookie: cookie }, body: jpeg,
    });
    assert.equal(up.status, 200, 'the upload was refused');
    assert.equal(await count(), before + 1,
      'the added photograph is missing — a cached listing outlived it');
  });
});

test('AND A PHOTOGRAPH DELETED IS GONE FROM IT IMMEDIATELY', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileANight(app.data, app.repo);
    await post(app.base, '/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);

    const page = async () => (await fetch(`${app.base}/api/gallery/${NIGHT}`)).json();
    const first = await page();            // warms the listing
    const name = first.photos[0].name;

    const del = await fetch(`${app.base}/api/past-photo/${NIGHT}/${name}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    });
    assert.equal(del.status, 200, 'the delete was refused');

    const after = await page();
    assert.equal(after.photos.length, first.photos.length - 1);
    assert.ok(!after.photos.some((p) => p.name === name),
      'a deleted photograph is still being offered from a cached listing');
  });
});
