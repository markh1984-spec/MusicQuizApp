/**
 * A REAL APP, ON A PORT NOBODY ELSE IS ON.
 *
 * ---
 *
 * **Three test files spawn a server now, and a fixed port made the suite
 * flaky.** Each of them had its own copy of "pick a port from the pid, spawn,
 * poll until it answers" — `offers.test.js`, `support-access.test.js` and
 * `gates.test.js` — and `node --test` runs one process per FILE at CPU
 * concurrency, so under load two of them can want the same port, or a server
 * killed a moment ago can still be holding one. Measured: two of three full
 * runs failed, in a different file each time, every one of them passing alone.
 *
 * That is the exact shape this repo already records — *"a 113th test file made
 * the suite flaky, a different test each run"* — and the lesson written down
 * then is the one that matters here: **a flaky suite is worse than a slow one,
 * because slow gets skipped and flaky teaches you to ignore red.**
 *
 * So the port is not guessed. The operating system is asked for a free one, on
 * the same interface the server will bind, and it is handed straight over. The
 * window between letting go and the server taking it is a few milliseconds
 * wide, and a collision inside it is retried rather than reported as a bug in
 * the app.
 *
 * ONE COPY, for the same reason `arcade.js` is one copy: three implementations
 * of "start the app" is three chances for one of them to be subtly wrong, and
 * the day one is fixed is the day the other two are not.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

/**
 * GONE, NOT MERELY SIGNALLED — and the third helper to need it.
 *
 * **`kill()` SENDS A SIGNAL AND WAITS FOR NOTHING.** Delete the data directory
 * on the next line and `rmSync` is walking a tree the server is still writing
 * into — `state.json`, the join-code book, the photo disk cache — so a file
 * appearing behind the walk is:
 *
 *     ENOTEMPTY: directory not empty, rmdir '/tmp/live-server-FKumxv'
 *
 * thrown out of the `finally`, **after every assertion in the test has already
 * passed**. That is the worst shape a flake can have: it names a feature that
 * is working, so the reflex is to go and read that feature's code, and the
 * answer is never there. It cost a session the diagnosis once
 * (`last-night.test.js`, reported as unattributable) and `stub-app.mjs` carries
 * the full account of the first sighting.
 *
 * It is load-dependent rather than random, which is why it looks haunted: the
 * file alone passes six times out of six, and the full suite at CPU
 * concurrency loses the race about one run in nine.
 *
 * **So it lives HERE, where `freePort()` already does.** This module is the
 * leaf both other spawners borrow from, and *three implementations of "stop the
 * app" is three chances for one of them to be subtly wrong, and the day one is
 * fixed is the day the other two are not* — which is precisely what happened:
 * `stub-app.mjs` fixed it in June and the two helpers either side of it kept
 * the fault.
 *
 * The timeout is a backstop rather than a normal path: a server that will not
 * die in two seconds is a bug worth seeing, and hanging the whole suite on it
 * would hide that behind a runner timeout with no stack.
 *
 * @param {import('node:child_process').ChildProcess|null} child
 * @param {string} signal  the CALLER'S — a check that SIGKILLs to prove crash
 *                         recovery must not be quietly downgraded to a
 *                         graceful stop by the helper that waits for it.
 */
export async function stopped(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill(signal);
  await Promise.race([
    once(child, 'exit'),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
}

/**
 * IS IT UP YET — one poll, not twelve.
 *
 * **TWELVE TEST FILES EACH CARRIED THIS LOOP**, identical to the character,
 * and every one of them had the same two faults:
 *
 * **IT GAVE UP AFTER TEN SECONDS.** Fine alone; not fine under `gig-build`,
 * where `npm test` runs at CPU concurrency with browsers either side of it and
 * a cold boot has to read the catalogue, copy two pack folders and open a
 * store. It failed twice in one evening, in a different file each time — and
 * the message it fails with names the APP, so the reflex is to go and look at
 * a server that was simply still starting. That is the same shape as the
 * hard-coded Playwright path: *a guard that fails for a reason that is not the
 * app's teaches you to read past red.*
 *
 * **AND IT WAITED THE FULL TEN SECONDS ON A SERVER THAT HAD ALREADY DIED.**
 * A boot that throws — a bad import, a port taken — exits in milliseconds, and
 * the loop then sat there refusing connections to a process that was gone,
 * before reporting the one thing it could not have been. `withServer()` above
 * has checked `child.exitCode` since the day it was written; the copies never
 * learned it.
 *
 * @param {import('node:child_process').ChildProcess} child  so a dead one is
 *        noticed at once rather than waited out
 * @param {string} url  something that answers when the app is listening
 * @returns {Promise<boolean>}
 */
export async function waitForApp(child, url, { tries = 250, every = 100 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (child && child.exitCode !== null) return false;
    try { await fetch(url); return true; } catch { await new Promise((r) => setTimeout(r, every)); }
  }
  return false;
}

/** A port the OS says is free right now, on the loopback the server binds. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Start the app, run something against it, and take it down again.
 *
 * `seed` is handed the data directory BEFORE the server starts — which is not
 * a detail: `Accounts` reads its file once at boot, so an account written
 * afterwards does not exist as far as the running app is concerned and every
 * sign-in answers 401. A test failing on its own scaffolding is the worst kind
 * to read.
 */
/** One of the shipped pack folders, copied where a test may safely write it. */
function catalogueCopy(dir, name) {
  const to = path.join(dir, name);
  fs.cpSync(new URL(`../../${name}/`, import.meta.url).pathname, to, { recursive: true });
  return to;
}

export async function withServer(run, { seed, hostKey = 'live-test-key', env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-server-'));
  const seeded = seed ? seed(dir) : undefined;
  let child = null;
  try {
    let base = '';
    for (let attempt = 0; attempt < 3 && !base; attempt += 1) {
      const port = await freePort();
      child = spawn(process.execPath, ['server.js'], {
        cwd: ROOT,
        env: {
          ...process.env,
          PORT: String(port),
          DATA_DIR: dir,
          /*
           * ADVERT_DIR EXPLICITLY, or the house room's adverts default to
           * `<repo>/adverts` — a real, git-tracked folder — and a test would
           * write its fixtures straight into it. `offers.test.js` did exactly
           * that once.
           */
          ADVERT_DIR: path.join(dir, 'adverts'),
          /*
           * AND THE CATALOGUE IS A COPY, for exactly the same reason one step
           * further on. `QUIZ_DIR`/`BINGO_DIR` default to the repository's own
           * `quizzes/` and `bingo/` — the packs the app SHIPS, tracked in git
           * — so any test that writes a pack edits them in the working tree.
           *
           * One did: checking that `POST /api/quiz` refuses to create over an
           * existing pack meant taking the refusal out for a single run, and
           * that run replaced `1980s-pop-music.json` with the one-question stub
           * the bug would have written. `npm test` and `pub-unchanged` both
           * caught it a minute later — but a guard that can damage the thing it
           * guards is one nobody should have to remember to be careful around.
           *
           * 240KB of JSON per run, thrown away with the rest of the directory.
           */
          QUIZ_DIR: catalogueCopy(dir, 'quizzes'),
          BINGO_DIR: catalogueCopy(dir, 'bingo'),
          HOST_KEY: hostKey,
          ...env,
        },
        stdio: 'ignore',
      });
      const at = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 100; i += 1) {
        if (child.exitCode !== null) break;
        try { await fetch(at); base = at; break; } catch { await new Promise((r) => setTimeout(r, 100)); }
      }
      // AND THE RETRY PATH TOO — the next attempt reuses this same `dir`, so a
      // half-started server still writing into it races the attempt that
      // replaces it, not only the delete at the end.
      if (!base) { await stopped(child, 'SIGKILL'); child = null; }
    }
    if (!base) throw new Error('the app never came up on any free port');
    // `dir` third: several checks need to read what the server WROTE, and
    // deriving it from `seeded` only works for tests that seeded a file.
    // Existing callers take two arguments and are untouched.
    await run(base, seeded, dir);
  } finally {
    await stopped(child, 'SIGKILL');
    // `maxRetries` is belt and braces on top of the wait above: the process is
    // gone by here, but a filesystem can still be finishing with it.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}
