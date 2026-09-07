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
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

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
      if (!base) { child.kill('SIGKILL'); child = null; }
    }
    if (!base) throw new Error('the app never came up on any free port');
    await run(base, seeded);
  } finally {
    child?.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
