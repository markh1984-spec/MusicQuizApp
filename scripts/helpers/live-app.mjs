#!/usr/bin/env node
/**
 * START THE APP FOR A CHECK, AND ALWAYS STOP IT AGAIN.
 *
 * ---
 *
 * Nine scripts in this folder had their own copy of "pick a port, spawn
 * `server.js`, poll until it answers, kill it afterwards", and the copies had
 * drifted into two faults the September 2026 sweep found:
 *
 * **THEY COULD NOT EXIT.** Cleanup was on `process.on('exit')` alone — and a
 * spawned child keeps node's event loop alive, so that hook never fires. The
 * script printed every result and then sat there. `dead-controls.mjs` and
 * `gig-path.mjs` were still doing it when this was written: `gig-path` prints
 * *"The whole gig path works, in a real browser"* and then hangs for ever,
 * which from outside is indistinguishable from the app hanging.
 * `save-a-night.mjs` spent eight hours that way on its first run.
 *
 * **AND THEY TOOK A PORT ON TRUST.** `spawn` here has `stdio: 'ignore'`, so a
 * port already in use fails SILENTLY: no server of ours starts, and every
 * request goes to whatever is already listening — with its data, which
 * outlives the run. A stale server from an earlier crash made a deliberately
 * broken Save pass, because the show it read back was the previous run's.
 * Three scripts took a fixed port with no check at all.
 *
 * So: the port comes from the operating system, the child is `unref()`d so it
 * cannot hold the process open, and `stop()` runs on the way out whether the
 * check passed, failed or threw.
 *
 *   import { withApp } from './helpers/live-app.mjs';
 *   await withApp(async ({ base, key, page }) => { ... });
 *
 * ONE COPY, for the reason `src/arcade.js` is one copy: nine implementations
 * of "start the app" is nine chances for one to be subtly wrong, and the day
 * one is fixed is the day the other eight are not.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// GONE, NOT MERELY SIGNALLED — one definition, in the leaf nine scripts in
// this folder already borrow `freePort` from. See its own account of why.
import { bootApp, safeEnv, stopped } from '../../test/helpers/live-server.mjs';



/**
 * Start the app on a free port with its own data directory.
 *
 * `seed(dir)` runs BEFORE the spawn — which is not a detail: `Accounts` reads
 * its file once at boot, so an account written afterwards does not exist as
 * far as the running app is concerned and every sign-in answers 401.
 *
 * Returns `{ base, key, stop }`. Prefer `withApp()` below, which cannot forget
 * to call `stop`.
 */

/**
 * `nodeArgs` go in front of `server.js` — the way a guard puts a stub behind
 * the real server (`--import test/helpers/….mjs`) so its real calls hit a
 * fixture. The restart keeps them, or the second boot is a different app.
 */
export async function startApp({ key = 'live-app-key', seed, env = {}, nodeArgs = [] } = {}) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'live-app-'));
  const seeded = seed ? seed(data) : undefined;
  /*
   * ONE ENVIRONMENT, BUILT ONCE — `safeEnv()`: its own data directory, its own
   * adverts folder, and a COPY of the catalogue, because `QUIZ_DIR`/`BINGO_DIR`
   * default to the packs the app SHIPS and a check that saves a pack would edit
   * them in the working tree — one replaced `1980s-pop-music.json` with a
   * one-question stub. **The restart below reuses this same object**, which is
   * what stops it losing the copy: it once rebuilt its environment by hand, left
   * both directories out, and every crash-recovery guard measured its second boot
   * against a different library from the one it launched with.
   */
  const appEnv = safeEnv(data, { hostKey: key, env });
  /*
   * ONE SPAWN FOR EVERY SPAWNER — `bootApp()`: a fresh port per attempt, and it
   * waits for ITS OWN child by pid, so another check's server that took the port
   * in the gap is never the one measured. `unref()` IS WHAT LETS THE SCRIPT END:
   * without it the child keeps the event loop alive and the process never exits.
   */
  const booted = await bootApp({ env: appEnv, nodeArgs, unref: true });
  let child = booted ? booted.child : null;
  const base = booted ? booted.base : '';
  let down = false;

  /**
   * THE SYNCHRONOUS ONE, because `process.on('exit')` cannot await anything.
   *
   * It is the BACKSTOP — the path taken when a check throws its way out or the
   * process is ending — so the delete is given `maxRetries` instead of the wait
   * it cannot have: `rmSync` retries ENOTEMPTY itself, which is the one error
   * a server still flushing produces. `stopAndWait()` below is the ordinary
   * path and does wait.
   */
  const stop = () => {
    if (down) return;
    down = true;
    child?.kill('SIGKILL');
    fs.rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  };

  /** The ordinary way out: gone, and only then deleted. */
  const stopAndWait = async () => {
    if (down) return;
    await stopped(child, 'SIGKILL');
    stop();
  };
  process.on('exit', stop);
  if (!base) {
    stop();
    throw new Error('the app never started — it cannot serve a pub night at all');
  }
  const port = Number(new URL(base).port);

  /**
   * KILL IT AND BRING IT BACK ON THE SAME PORT AND THE SAME DISK.
   *
   * Crash recovery is one of the five things on the protected surface, and the
   * only honest way to check it is to `SIGKILL` a running game and see what
   * comes back — which needs the SAME data directory and the same address, or
   * it is a different app answering.
   *
   * `hard` is what the check itself wants: `SIGKILL` with no warning, so
   * nothing gets a chance to flush on the way out.
   */
  const restart = async ({ hard = true } = {}) => {
    /*
     * GONE BEFORE THE REPLACEMENT BINDS THE SAME PORT. A sleep is a guess
     * about how long a process takes to release a socket, and the answer is
     * "longer, when the machine is busy" — which is exactly when a guard runs.
     * The SIGNAL is still the caller's: `hard` means nothing gets a chance to
     * flush, which is the whole point of the crash-recovery check.
     */
    await stopped(child, hard ? 'SIGKILL' : 'SIGTERM');
    // THE SAME PORT AND THE SAME ENVIRONMENT — the caller is holding `base`, and
    // `appEnv` carries the same catalogue copy the first boot got (never a
    // fresh one, which would quietly restore a pack the check had just
    // deleted). One attempt: if something took the port in the gap, this says
    // so rather than handing back somebody else's server.
    const again = await bootApp({ env: appEnv, nodeArgs, port, unref: true });
    child = again ? again.child : null;
    return Boolean(again);
  };

  return { base, key, data, port, seeded, stop, stopAndWait, restart };
}

/**
 * The same thing, with the teardown made impossible to forget.
 *
 * Anything thrown inside comes back out AFTER the app has been stopped, so a
 * failing check leaves no server and no temp directory behind — which matters
 * because the next run is the one that would then be measuring somebody else's
 * process.
 */
export async function withApp(run, opts = {}) {
  const app = await startApp(opts);
  try {
    return await run(app);
  } finally {
    await app.stopAndWait();
  }
}
