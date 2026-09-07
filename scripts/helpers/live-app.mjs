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

import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
 * Start the app on a free port with its own data directory.
 *
 * `seed(dir)` runs BEFORE the spawn — which is not a detail: `Accounts` reads
 * its file once at boot, so an account written afterwards does not exist as
 * far as the running app is concerned and every sign-in answers 401.
 *
 * Returns `{ base, key, stop }`. Prefer `withApp()` below, which cannot forget
 * to call `stop`.
 */
export async function startApp({ key = 'live-app-key', seed, env = {} } = {}) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'live-app-'));
  const seeded = seed ? seed(data) : undefined;
  let child = null;
  let base = '';
  for (let attempt = 0; attempt < 3 && !base; attempt += 1) {
    const port = await freePort();
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: data,
        // Never let a spawned app default to the repo's own adverts folder — a
        // real, git-tracked directory a check would write fixtures into.
        ADVERT_DIR: path.join(data, 'adverts'),
        HOST_KEY: key,
        ...env,
      },
      stdio: 'ignore',
    });
    /*
     * `unref()` IS WHAT LETS THE SCRIPT END. Without it the child keeps the
     * event loop alive and the process never exits, however tidy the rest of
     * the code is.
     */
    child.unref();
    const at = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 120; i += 1) {
      if (child.exitCode !== null) break;
      try { await fetch(at); base = at; break; } catch { await wait(100); }
    }
    if (!base) { child.kill('SIGKILL'); child = null; }
  }
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    child?.kill('SIGKILL');
    fs.rmSync(data, { recursive: true, force: true });
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
    child?.kill(hard ? 'SIGKILL' : 'SIGTERM');
    await wait(400);
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: data,
        ADVERT_DIR: path.join(data, 'adverts'),
        HOST_KEY: key,
        ...env,
      },
      stdio: 'ignore',
    });
    child.unref();
    for (let i = 0; i < 120; i += 1) {
      try { await fetch(base); return true; } catch { await wait(100); }
    }
    return false;
  };

  return { base, key, data, port, seeded, stop, restart };
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
    app.stop();
  }
}
