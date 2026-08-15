/**
 * THE PUBLIC GALLERY — the gate, and only the gate.
 *
 * There is nothing worth testing about a grid of photographs. What matters is
 * that **an unpublished night is not reachable**, because being wrong here is
 * not a broken page, it is a disclosure: photographs of members of the public,
 * taken under a line on a phone that only ever said *"goes on the big
 * screen"*.
 *
 * So this checks the refusals, over real HTTP, against the real server —
 * because the gate lives in the routes and a test that read `gallery.js` alone
 * would prove nothing about whether the routes call it. That is the lesson
 * this repo learned the expensive way with the launch route.
 *
 * **WHAT IT CANNOT COVER, said plainly:** `PHOTO_REPO` is not configured in a
 * test environment, so every repo call fails closed and the published path
 * cannot be exercised here. That half needs a real night with a real photo in
 * it — which AUDIT.md already lists as the round trip nobody has proven end to
 * end. These tests prove the DENIALS, which is the half that can hurt somebody.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { publishedNights, isPublished, setPublished, readableNight } from '../src/gallery.js';

const ROOT = new URL('..', import.meta.url).pathname;

/* ------------------------------------------------------------ fails closed */

test('WITH NO PHOTO REPOSITORY, NOTHING IS PUBLISHED', async () => {
  // Fails closed on purpose: a gallery that shows nothing is a
  // disappointment, one that shows everything because a fetch failed is a
  // disclosure.
  assert.deepEqual(await publishedNights('house'), []);
  assert.equal(await isPublished('house', '2026-08-14'), false);
});

test('a night that is not a date is never published, whatever is asked', async () => {
  for (const bad of ['', 'publish', '../../etc', '2026-8-4', 'null', '2026-08-14/..']) {
    assert.equal(await isPublished('house', bad), false, `"${bad}" passed as a night`);
  }
});

test('publishing refuses a bad night before it touches anything', async () => {
  const res = await setPublished('house', 'not-a-night', true);
  assert.equal(res.ok, false);
  assert.match(res.error, /night/i);
});

test('and says so honestly when there is nowhere to record it', async () => {
  // Rather than reporting success and losing it — the host would then believe
  // a night was public when it was not, which is the wrong way round to be
  // wrong about, but still wrong.
  const res = await setPublished('house', '2026-08-14', true);
  assert.equal(res.ok, false);
  assert.match(res.error, /repository/i);
});

test('a date reads as a person would say it', () => {
  assert.equal(readableNight('2026-08-14'), 'Friday 14 August 2026');
  assert.equal(readableNight('2026-01-01'), 'Thursday 1 January 2026');
  assert.equal(readableNight('nonsense'), '');
});

/* -------------------------------------------------- the routes, over HTTP */

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'gallery-route-'));
  const port = 4900 + (process.pid % 90);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: 'gallery-test-key' },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try { await fetch(`${base}/gallery`); up = true; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    assert.ok(up, 'the server never came up');
    await run(base);
  } finally {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

test('THE PAGE IS PUBLIC, AND TELLS SEARCH ENGINES TO STAY AWAY', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/gallery`);
    assert.equal(res.status, 200, 'the gallery page did not serve');
    /*
     * Being findable on Google is speculative marketing value; a stranger's
     * face in a search result is a concrete cost, and it lands on the player
     * rather than on the business. One header to change later if it earns it.
     */
    assert.match(res.headers.get('x-robots-tag') || '', /noindex/);
  });
});

test('AN UNPUBLISHED NIGHT IS NOT REACHABLE, three ways', async () => {
  await withServer(async (base) => {
    // Nothing is published in a test environment, so every one of these is
    // the refusal path — which is exactly the path worth proving.
    const list = await (await fetch(`${base}/api/gallery`)).json();
    assert.deepEqual(list.nights, [], 'a night was listed with nothing published');
    assert.ok(!list.preview, 'an anonymous visitor was given the owner preview');

    const one = await fetch(`${base}/api/gallery/2026-08-14`);
    assert.equal(one.status, 404, 'an unpublished night answered');

    const shot = await fetch(`${base}/gallery-photo/2026-08-14/abc123.jpg`);
    assert.equal(shot.status, 404, 'a photo from an unpublished night was served');
  });
});

test('the photo route re-checks for itself rather than trusting the listing', async () => {
  // A URL can be typed. If the only check were on the listing, a guessed
  // filename would walk straight past it.
  await withServer(async (base) => {
    for (const path of [
      '/gallery-photo/2026-08-14/../../server.js',
      '/gallery-photo/2026-08-14/a.jpg/extra',
      '/gallery-photo/notanight/a.jpg',
      '/gallery-photo/2026-08-14/not-a-safe-name',
    ]) {
      const res = await fetch(base + path);
      assert.equal(res.status, 404, `${path} did not 404`);
    }
  });
});

test('SOMETHING ACTUALLY CALLS THE PUBLISH ROUTE', async () => {
  /*
   * The route existed from the day the gallery was built and nothing ever
   * called it — so a night could be published only by hand, which in practice
   * means not at all, on the feature whose entire purpose is putting a night
   * up. The gate was perfect and the gate had no handle.
   *
   * It is the same class of miss as the projector's arcade board: the server
   * computed it, this file tested it, the docs described it, and no page ever
   * drew the control. **A test that the route works proves nothing about
   * whether anybody can reach it.**
   *
   * A text search is a weak check and is the right weight here: the fault was
   * not a broken caller, it was the total absence of one.
   */
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = join(ROOT, 'public', 'assets');
  const callers = readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => readFileSync(join(dir, f), 'utf8').includes('/api/past-gigs/publish'));
  assert.ok(callers.length, 'nothing in the browser can put a night on the gallery');
});

test('EVERY REFUSAL LOOKS THE SAME, so nobody can map which nights exist', async () => {
  /*
   * The same shape `/api/voucher` already uses. Three different messages —
   * "not a date", "not published", "no photos" — would let anybody walk the
   * calendar and learn when this quizmaster works.
   */
  await withServer(async (base) => {
    const bodies = [];
    for (const n of ['2026-08-14', '1999-01-01', 'rubbish']) {
      const res = await fetch(`${base}/api/gallery/${n}`);
      assert.equal(res.status, 404);
      bodies.push(JSON.stringify(await res.json()));
    }
    assert.equal(new Set(bodies).size, 1, `refusals differed: ${bodies.join(' | ')}`);
  });
});
