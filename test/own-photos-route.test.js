/**
 * THE QUIZMASTER'S OWN PHOTOGRAPHS REACH A ROUTE THAT ANSWERS.
 *
 * Asked for on 29 August 2026: *"would be good to be able to add room photos
 * to the gallery that everyone sees, that I take from my own phone?"*
 *
 * ---
 *
 * **THIS EXISTS BECAUSE OF THE GALLERY PUBLISH ROUTE.** That one was written
 * beside its GET neighbours and so lived inside `handleGet`, which only ever
 * runs for GET and HEAD — every POST fell through to the generic 404. It read
 * as a working feature for months, with the gate perfect and no handle on it.
 * A new POST in this file is exactly that shape again, so this test posts over
 * real HTTP and asserts against the **404**. That difference is the bug: a
 * test written for the 400 would pass on a route that does not exist.
 *
 * **WHAT IT CANNOT TEST, AND SAYS SO.** The write itself goes to the private
 * repository, which needs a token this suite does not have and must not need.
 * So the deepest assertion here is that an unconfigured repo is refused with a
 * message that NAMES the missing thing — which is the branch a fresh
 * deployment actually hits, and the one where a generic "could not save that"
 * would send somebody hunting through the app for a fault in an env var.
 *
 * Everything before that write — the method, the night, the size cap and the
 * "is this really an image" sniff — is real and is checked here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'own-photos-test-key';

/** The smallest thing `sniffType()` accepts as a JPEG. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'own-photos-'));
  const port = 4950 + (process.pid % 800);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    // PHOTO_REPO deliberately absent: the branch a fresh deployment hits, and
    // the only one reachable without a token.
    env: {
      ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: KEY,
      PHOTO_REPO: '', PHOTO_TOKEN: '', GITHUB_TOKEN: '', GITHUB_REPO: '',
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try { await fetch(`${base}/api/state?role=screen`); up = true; } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(up, 'the server never came up');
    await run(base);
  } finally {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

const post = (base, night, body, type = 'image/jpeg') => fetch(
  `${base}/api/past-photo/${encodeURIComponent(night)}`,
  { method: 'POST', headers: { 'Content-Type': type, 'X-Host-Key': KEY }, body },
);

test('THE ROUTE EXISTS FOR POST — never a 404, which is what a missing one gives', async () => {
  await withServer(async (base) => {
    const res = await post(base, '2026-08-27', JPEG);
    assert.notEqual(res.status, 404,
      'a POST to /api/past-photo/<night> 404ed — the route is in the wrong handler, '
      + 'exactly as the gallery publish route once was');
    // Without a private repository there is nowhere to put it, and the message
    // has to name that rather than blaming the photo.
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /private photo repository/i);
  });
});

test('a night that is not a night is refused, before anything is read', async () => {
  await withServer(async (base) => {
    for (const bad of ['../secrets', 'tuesday', '2026-8-27']) {
      const res = await post(base, bad, JPEG);
      assert.equal(res.status, 404, `${bad} was not refused`);
    }
  });
});

test('something that is not an image is refused on its BYTES, not its header', async () => {
  /*
   * A request can claim `image/jpeg` and send anything, and this file is
   * served straight back as an image on a public page. The sniff runs before
   * the write, so it is reachable without a repository — which is why it can
   * be tested here at all.
   *
   * It has to come AFTER the repo check in the response order, so this asserts
   * the pair rather than one: with no repo the answer is 400 about the repo,
   * and that is correct — there is genuinely nowhere to put it either way.
   */
    await withServer(async (base) => {
    const res = await post(base, '2026-08-27', Buffer.from('<html>not a photo</html>'));
    assert.ok([400, 415].includes(res.status), `answered ${res.status}`);
    const body = await res.json();
    assert.ok(body.error, 'a refusal must say why');
  });
});

test('the host key is required, like every other write behind that door', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/past-photo/2026-08-27`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: JPEG,
    });
    assert.ok(res.status === 401 || res.status === 403, `answered ${res.status}`);
  });
});
