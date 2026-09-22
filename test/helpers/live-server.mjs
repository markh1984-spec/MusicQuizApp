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
 * IS THE SERVER ANSWERING AT `base` THIS CHILD — not merely something?
 *
 * **`freePort()` CANNOT PROMISE THE PORT STAYS FREE.** It asks the OS for one,
 * lets it go, and the app only binds it seconds later — after reading the
 * catalogue and running the restore. Under `gig-build`, with a dozen servers
 * booting at once, another test's app can take that port in between. Every
 * poll in this repo then asked only *does something answer?* — and something
 * did, so the check ran its whole body against a different process, while its
 * own child died quietly on `EADDRINUSE` behind it. A pass there is about
 * somebody else's server; a failure names a feature that is fine. Both are the
 * kind of result this repo has learned to distrust most.
 *
 * **IT REPLACED `waitForApp()`, WHICH REPLACED TWELVE COPIES OF ONE LOOP** —
 * and keeps what that one learned: it notices a dead child on the next turn
 * rather than waiting out a server that already died, and it gives a live one
 * twenty-five seconds, because ten was not enough under `gig-build`.
 *
 * So `/health` says its `pid`, and this compares it with the child's. A server
 * that answers with ANOTHER pid is not ours: stop waiting at once. One that
 * answers with NO pid is an app older than this check — only
 * `pub-unchanged.mjs` ever boots one, for its baseline, and it says so with
 * `legacyOk`; everybody else keeps waiting, because ours will either answer
 * properly or die, and dying is noticed on the next turn.
 */
export async function ownsPort(child, base, { tries = 250, every = 100, legacyOk = false } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return false;
    try {
      const res = await fetch(`${base}/health`);
      const body = await res.json().catch(() => ({}));
      if (body.pid === child.pid) return true;
      if (typeof body.pid === 'number') return false;
      if (legacyOk && body.ok) return true;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, every));
  }
  return false;
}

/**
 * START THE APP ON A PORT THAT IS PROVABLY ITS OWN — the one spawn in this repo.
 *
 * **THERE WERE TWENTY-FIVE**, three in the helpers and twenty-two private
 * copies in tests and guards, each asking for a port once, spawning once and
 * trusting whatever answered. One here now, and every spawner calls it:
 * `withServer()` below, `withStubbedApp()`, `startApp()` in
 * `scripts/helpers/live-app.mjs`, and the files that need a shape of their own.
 *
 * - **A fresh port on every attempt, three attempts** — a port lost to a race
 *   is simply asked for again. With `port` given (a restart that must keep its
 *   address) there is one attempt and a failure is the caller's to report.
 * - **Waits for its own child by pid** — `ownsPort()`.
 * - **A child that loses is KILLED and WAITED FOR** before the next attempt,
 *   because the next one reuses the same data directory.
 *
 * `env` is the WHOLE environment the child gets apart from `PORT`, so a caller
 * builds it once and a restart cannot quietly drop half of it — which is how a
 * restart once lost `QUIZ_DIR` and ran its second boot against the shipped
 * catalogue. It may be a FUNCTION of the port, for the one value that has to
 * follow it (`PUBLIC_URL`, when a check reads the links the app writes).
 *
 * @returns {Promise<{child, base, port}|null>}  null if it never came up
 */
export async function bootApp({ env, nodeArgs = [], port: fixed = 0, attempts = 3, unref = false, cwd = ROOT, legacyOk = false } = {}) {
  for (let attempt = 0; attempt < (fixed ? 1 : attempts); attempt += 1) {
    const port = fixed || await freePort();
    const child = spawn(process.execPath, [...nodeArgs, 'server.js'], {
      cwd, env: { ...(typeof env === 'function' ? env(port) : env), PORT: String(port) }, stdio: 'ignore',
    });
    if (unref) child.unref();
    const base = `http://127.0.0.1:${port}`;
    if (await ownsPort(child, base, { legacyOk })) return { child, base, port };
    await stopped(child, 'SIGKILL');
  }
  return null;
}

/**
 * The environment a spawned app needs so it can never write anything the
 * repository tracks: its own data directory, its own adverts folder, and a COPY
 * of the catalogue (see `withServer()` for the day that last one mattered).
 * Built once per app and reused by a restart, so the second boot sees the same
 * library as the first — never a fresh copy, which would quietly restore a pack
 * the check had just deleted.
 */
export function safeEnv(dir, { hostKey = 'live-test-key', env = {}, catalogue = true } = {}) {
  return {
    ...process.env,
    DATA_DIR: dir,
    ADVERT_DIR: path.join(dir, 'adverts'),
    ...(catalogue ? { QUIZ_DIR: catalogueCopy(dir, 'quizzes'), BINGO_DIR: catalogueCopy(dir, 'bingo') } : {}),
    HOST_KEY: hostKey,
    ...env,
  };
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

export async function withServer(run, { seed, hostKey = 'live-test-key', env = {}, nodeArgs = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-server-'));
  const seeded = seed ? seed(dir) : undefined;
  let child = null;
  try {
    /*
     * THE CATALOGUE IS A COPY — `safeEnv()`. `QUIZ_DIR`/`BINGO_DIR` default to
     * the repository's own `quizzes/` and `bingo/`, the packs the app SHIPS, so
     * any test that writes a pack would edit them in the working tree. One did:
     * checking that `POST /api/quiz` refuses to create over an existing pack
     * meant taking the refusal out for a single run, and that run replaced
     * `1980s-pop-music.json` with the one-question stub the bug would have
     * written. A guard that can damage the thing it guards is one nobody
     * should have to remember to be careful around.
     */
    const booted = await bootApp({ env: safeEnv(dir, { hostKey, env }), nodeArgs });
    if (booted) child = booted.child;
    const base = booted ? booted.base : '';
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
