/**
 * A PHOTOGRAPH THAT MISSED THE STORE IS FILED LATER, BY NOBODY PRESSING ANYTHING.
 *
 * Until 22 September 2026 `fileAway()` said a failure was *"retried by the file
 * the rest away button"* — and for every quizmaster but the owner there was no
 * such button. The one on the control view had been taken off and its route
 * left with no caller; the owner's page only ever acts on the owner's own room.
 * So a photograph that met one bad GitHub minute stayed on this server, missing
 * from Past gigs and the gallery, until the next deploy took it.
 *
 * Three things are proven here, each against the real server with only the
 * network behind it stubbed:
 *
 *  1. the backoff that makes a retry loop safe on a dead token;
 *  2. a photo whose first filing is REFUSED reaches the store on its own;
 *  3. the owner's button stops holding the request after its budget, and a
 *     photo already on its way is JOINED rather than sent twice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { withStubbedApp } from './helpers/stub-app.mjs';
import { PHOTO_SWEEP_MAX_MS, PHOTO_SWEEP_MS, nextPhotoSweep } from '../src/photo-sweep.js';

const KEY = 'not-used-here';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (base, path, body) => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
// The smallest thing `sniffType()` takes as a JPEG.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

/** Every photograph in the stubbed repository, wherever it was filed. */
function filedPhotos(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.jpe?g$/i.test(name)) out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/** How many times the server PUT a photograph, read off the stub's own log. */
const photoPuts = (log) => (existsSync(log) ? readFileSync(log, 'utf8') : '')
  .split('\n').filter((l) => /^PUT .*\.jpe?g$/i.test(l)).length;

/** Launch a night on the host key, join one phone, send one photograph. */
async function sendAPhoto(base) {
  const lib = await (await fetch(`${base}/api/library?key=${KEY}`)).json();
  const packId = (lib.quizzes || [])[0]?.id;
  assert.ok(packId, 'no pack to launch');
  const launched = await post(base, `/api/host/launch?key=${KEY}`, { game: 'quiz', packId });
  assert.equal(launched.status, 200, `the night would not launch: ${await launched.text()}`);
  const who = await (await post(base, '/api/join', { name: 'Table One' })).json();
  assert.ok(who.id, `the phone could not join: ${JSON.stringify(who)}`);
  const sent = await fetch(`${base}/api/photo?playerId=${encodeURIComponent(who.id)}`, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: JPEG,
  });
  assert.equal(sent.status, 200, 'the photograph was refused');
}

test('the retry backs off while nothing lands, and comes straight back when something does', () => {
  // Nothing waiting: stay at the base, which costs an in-memory scan and no network.
  assert.equal(nextPhotoSweep(PHOTO_SWEEP_MS, { attempted: 0, filed: 0 }), PHOTO_SWEEP_MS);
  // Tried and nothing went: double.
  assert.equal(nextPhotoSweep(PHOTO_SWEEP_MS, { attempted: 4, filed: 0 }), PHOTO_SWEEP_MS * 2);
  // A dead token all night: capped, never unbounded and never a hammer.
  let gap = PHOTO_SWEEP_MS;
  for (let i = 0; i < 40; i += 1) gap = nextPhotoSweep(gap, { attempted: 60, filed: 0 });
  assert.equal(gap, PHOTO_SWEEP_MAX_MS);
  // One success puts it back, so a blip clears itself before the night is over.
  assert.equal(nextPhotoSweep(gap, { attempted: 60, filed: 1 }), PHOTO_SWEEP_MS);
});

test('a photograph whose first filing was refused reaches the store on its own', async () => {
  const side = mkdtempSync(join(tmpdir(), 'filing-side-'));
  const refuse = join(side, 'refuse');
  const log = join(side, 'log');
  writeFileSync(refuse, 'yes');
  try {
    await withStubbedApp(async ({ base, repo }) => {
      await sendAPhoto(base);

      // The upload's own attempt is made and refused.
      for (let i = 0; i < 50 && photoPuts(log) < 1; i += 1) await wait(50);
      assert.ok(photoPuts(log) >= 1, 'the upload never tried to file the photograph');
      assert.deepEqual(filedPhotos(repo), [], 'the stub was meant to refuse that write');

      // GitHub comes back. Nobody presses anything.
      rmSync(refuse);
      for (let i = 0; i < 100 && !filedPhotos(repo).length; i += 1) await wait(100);
      assert.equal(filedPhotos(repo).length, 1,
        'the photograph was never filed — a failed upload is still retried by nothing');
    }, { prefix: 'filing-retry', env: { PHOTO_SWEEP_MS: '300', GH_STUB_REFUSE: refuse, GH_STUB_LOG: log } });
  } finally {
    rmSync(side, { recursive: true, force: true });
  }
});

test("the owner's button stops waiting after its budget, and never sends one photograph twice", async () => {
  const side = mkdtempSync(join(tmpdir(), 'filing-side-'));
  const log = join(side, 'log');
  try {
    await withStubbedApp(async ({ base, repo }) => {
      // A slow GitHub: the upload's own filing is still on its way when the
      // button is pressed, which is exactly when a second PUT used to happen.
      await sendAPhoto(base);
      const started = Date.now();
      const res = await post(base, `/api/owner/photos/file?key=${KEY}`, {});
      const took = Date.now() - started;
      assert.equal(res.status, 200, `the button's route answered ${res.status}`);
      const body = await res.json();
      assert.equal(body.still, true, `expected "still going" on a slow store, got ${JSON.stringify(body)}`);
      assert.ok(took < 1500, `the request was held for ${took}ms — past its budget`);

      // It still lands, once.
      for (let i = 0; i < 80 && !filedPhotos(repo).length; i += 1) await wait(100);
      assert.equal(filedPhotos(repo).length, 1, 'the photograph never reached the store');
      // Long enough for a second, unjoined attempt to have reached the stub.
      await wait(2000);
      assert.equal(photoPuts(log), 1,
        'the same photograph was PUT more than once — the upload and the button each sent it');
    }, {
      prefix: 'filing-button',
      env: { GH_STUB_DELAY_MS: '800', FILE_REST_WAIT_MS: '300', GH_STUB_LOG: log },
    });
  } finally {
    rmSync(side, { recursive: true, force: true });
  }
});
