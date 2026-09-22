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

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootApp, safeEnv, stopped } from './live-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');

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
  /*
   * ONE ENVIRONMENT, BUILT ONCE — `safeEnv()`, so the catalogue is a COPY as it
   * is for every other spawner. This helper never copied it: every photo test
   * ran against the repository's own `quizzes/` and `bingo/`, the packs the app
   * ships. And a restart reuses the SAME object, so it cannot drop half of it.
   */
  const env = safeEnv(data, {
    hostKey: 'not-used-here',
    env: { GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub', ...extra },
  });
  const nodeArgs = ['--import', STUB];

  /*
   * ONE SPAWN FOR EVERY SPAWNER — `bootApp()`: a fresh port per attempt, and it
   * waits for ITS OWN child by pid, so another test's server that took the port
   * in the gap is never the one measured.
   */
  let server = null;
  let base = '';
  let port = 0;
  const up = async () => {
    const booted = await bootApp({ env, nodeArgs, port });
    if (!booted) throw new Error(port ? `the server did not come back on :${port}` : 'the server never came up');
    ({ child: server, base, port } = booted);
  };
  const restart = async () => {
    // GONE BEFORE THE REPLACEMENT BINDS — and on the SAME port, because the
    // caller is holding `base`. If something else took it in the gap, `up()`
    // says so rather than handing back somebody else's server.
    await stopped(server);
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
