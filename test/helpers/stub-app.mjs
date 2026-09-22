/**
 * THE APP, WITH THE PHOTO REPOSITORY STUBBED — one helper, two callers.
 *
 * ---
 *
 * **IT EXISTS BECAUSE THE SAME HELPER WAS WRITTEN TWICE AND WAS WRONG TWICE.**
 * `gallery-publish-loop.test.js` and `photo-rotate.test.js` each carried a
 * private copy: spawn the server with `photo-repo-stub.mjs` imported, run
 * something, kill it, delete the temp directories. The copies had drifted only
 * in their prefixes and their port ranges, and they shared two faults —
 * which is this repo's oldest lesson wearing another hat: *two copies is one
 * that gets fixed.*
 *
 * **`kill()` SENDS A SIGNAL; IT DOES NOT WAIT FOR ANYTHING.** Both copies then
 * deleted the data directory on the very next line, while the server was still
 * running and still flushing `state.json`, the join-code book and the photo
 * disk cache into it. `rmSync` walks a tree and then `rmdir`s it, so a file
 * appearing behind the walk is:
 *
 *     ENOTEMPTY: directory not empty, rmdir '/tmp/publoop-qiohMP'
 *
 * — thrown out of the `finally`, which node's test runner reports as the test
 * failing. **Every assertion in it had already passed.** That is the worst
 * shape a flake can have: it names a feature that is working, so the reflex is
 * to go and read the gallery code, and the answer is never there.
 *
 * It is load-dependent rather than random, which is why it looked haunted: run
 * from a terminal it almost never lost the race, and run the way
 * `gig-build.mjs` runs it — spawned from node, stdin ignored, both streams
 * through pipes — it lost it about one time in three, and printed **DO NOT
 * DEPLOY** over a green suite.
 *
 * So: **wait for the process to actually be gone, then delete.**
 *
 * **AND THE PORT WAS GUESSED, which `CLAUDE.md` already forbids** — *a guessed
 * port fails to bind SILENTLY, so every measurement is then about somebody
 * else's process; a fixed one made the suite flaky.* Both copies picked one out
 * of a small range at MODULE level, so every test in a file shared it and two
 * files could collide. `freePort()` has existed for months; it is asked per
 * run.
 *
 * **`restart()` HAD THE SAME RACE IN THE OTHER DIRECTION** — kill, sleep 300ms,
 * bind the same port again. A server that took longer than that to let go of
 * its socket meant the replacement never came up, and the test then failed on
 * whatever it asked first rather than on the restart.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { freePort, stopped, waitForApp } from './live-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * `stopped()` IS `live-server.mjs`'S NOW, not a second copy here. The account
 * of the fault stays above because this is where it was first diagnosed — but
 * the two helpers either side of this one kept the fault for three months
 * while this file's private fix sat next to them, which is the whole argument
 * for one definition. `freePort()` already came from there.
 */

/**
 * Start the app against a stubbed photo repository, run something, take it
 * down.
 *
 * `run` is handed `{ base, data, repo, restart }` — the same shape both
 * callers already used, so neither test body changed.
 *
 * @param {string} prefix  what the temp directories are named, for a human
 *                         reading `/tmp` after a failure
 */
export async function withStubbedApp(run, { prefix = 'stubapp', env: extra = {} } = {}) {
  const data = mkdtempSync(join(tmpdir(), `${prefix}-`));
  const repo = mkdtempSync(join(tmpdir(), `${prefix}-gh-`));
  // ASKED FOR, NEVER GUESSED — and per run, so two tests in one file cannot
  // share one and two files cannot collide.
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    HOST_KEY: 'not-used-here',
    DATA_DIR: data,
    GH_STUB_DIR: repo,
    PHOTO_REPO: 'someone/photos',
    PHOTO_TOKEN: 'stub',
    ...extra,
  };
  const start = () => spawn(process.execPath, ['--import', STUB, 'server.js'],
    { cwd: ROOT, env, stdio: 'ignore' });

  let server = start();
  const base = `http://127.0.0.1:${port}`;
  /*
   * ONE POLL FOR EVERY SPAWNER — `waitForApp()`. Twelve seconds was not enough
   * under `gig-build`, where `npm test` runs at CPU concurrency with browsers
   * either side of it, and this waited them out on a server that had already
   * died. It notices a dead child at once and gives a live one longer.
   */
  const up = async () => {
    if (!await waitForApp(server, base)) throw new Error('the server never came up');
  };
  const restart = async () => {
    // GONE BEFORE THE REPLACEMENT BINDS. A sleep is a guess about how long a
    // process takes to release a socket, and the answer is "longer, when the
    // machine is busy" — which is exactly when the suite is running.
    await stopped(server);
    server = start();
    await up();
  };

  try {
    await up();
    await run({ base, data, repo, restart });
  } finally {
    await stopped(server);
    // `maxRetries` is belt and braces on top of the wait above: the process is
    // gone by here, but a filesystem can still be finishing with it.
    rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}
