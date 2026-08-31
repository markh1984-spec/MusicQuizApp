/**
 * A VENUE'S OWN ADDRESS ANSWERS — over real HTTP, on the real server.
 *
 * *"I want to be able to have the URLs conveniently reachable, so something
 * like quizporium.co.uk/station-tap-wokingham/gallery/20-august and
 * quizporium.co.uk/station-tap-wokingham/quiz-league (or similar)."*
 *
 * ---
 *
 * **THE ONE THAT MATTERS IS THAT NOTHING ELSE BROKE.** A one-segment prefix at
 * the root is a catch-all, and the first version of this route ate
 * `/api/gallery` — two segments, the second one `gallery`, exactly the shape a
 * venue address has, so the API answered with the gallery PAGE and four
 * unrelated tests failed with *"Unexpected token '<'"*. `test/slugs.test.js`
 * guards the reserved list against the source; this drives the real server, so
 * the two halves of that fault are covered from both ends.
 *
 * **AND AN ADDRESS IS NOT A KEY.** It resolves to a venue; the league switch
 * and the published list decide whether that venue has a page. A slug that
 * names nothing must answer exactly as one that names an unpublished venue —
 * the page, with nothing on it — or somebody can map which pubs exist by
 * trying names.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'venue-address-test-key';

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'venue-address-'));
  const port = 4300 + (process.pid % 800);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: KEY },
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

test('a venue address serves the page it names', async () => {
  await withServer(async (base) => {
    for (const [path, marker] of [
      ['/station-tap-wokingham/quiz-league', 'league-page.js'],
      ['/station-tap-wokingham/gallery', 'gallery.js'],
      ['/station-tap-wokingham/gallery/20-august', 'gallery.js'],
    ]) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, `${path} answered ${res.status}`);
      const html = await res.text();
      assert.ok(html.includes(marker), `${path} did not serve the right page`);
      // NOT in a search result, published or not — the same header the plain
      // routes set, and it has to be on these too or the pretty address is a
      // way round the decision.
      assert.match(res.headers.get('x-robots-tag') || '', /noindex/);
    }
  });
});

test('AND IT DOES NOT EAT A ROUTE THIS APP ALREADY SERVES', async () => {
  await withServer(async (base) => {
    /*
     * `/api/gallery` is the one that actually broke. The others are the same
     * shape: a first segment this app owns, with something after it.
     */
    const res = await fetch(`${base}/api/gallery`, { headers: { Accept: 'application/json' } });
    const body = await res.text();
    assert.ok(!body.startsWith('<'), 'the API answered with a page — the venue route ate it');
    assert.doesNotThrow(() => JSON.parse(body), 'the API answered with something that is not JSON');

    /*
     * MATCH SOMETHING ONLY THE PAGE HAS, never a filename.
     *
     * This looked for the string `gallery.js` — which is the page's script tag,
     * and also any COMMENT anywhere that happens to name the file. A note added
     * to `style.css` pointing at `gallery.js` failed this test with the routing
     * perfectly correct. `id="galBody"` is markup: it exists in the gallery page
     * and nowhere else, so it cannot be written into a stylesheet by accident.
     */
    for (const path of ['/assets/style.css', '/api/brand']) {
      const one = await fetch(`${base}${path}`);
      const text = await one.text();
      assert.ok(!text.includes('id="galBody"'), `${path} was served the gallery page`);
    }
  });
});

test('an address that names nothing looks exactly like one that is not published', async () => {
  await withServer(async (base) => {
    // Both answer the page; the page then shows nothing. One refusal for every
    // miss, so a stranger cannot map which pubs exist by trying names.
    const nowhere = await fetch(`${base}/no-such-pub-at-all/quiz-league`);
    const real = await fetch(`${base}/station-tap-wokingham/quiz-league`);
    assert.equal(nowhere.status, real.status);
    assert.equal(nowhere.status, 200);

    // And the DATA behind it is empty either way, which is the half that
    // matters — the page is the same file for everybody.
    const d = await (await fetch(`${base}/api/league?venue=no-such-pub-at-all`)).json();
    assert.deepEqual(d.leagues, []);
  });
});

test('a bad venue segment is not a page at all', async () => {
  await withServer(async (base) => {
    for (const path of ['/Crown/quiz-league', '/crown/photos', '/crown/quiz-league/20-august']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 404, `${path} answered ${res.status}`);
    }
  });
});
