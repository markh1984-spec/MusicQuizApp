/**
 * PRESSING LAUNCH, FOR REAL — the one test in this repo that starts the server
 * and asks it to do something.
 *
 * ---
 *
 * **IT EXISTS BECAUSE LAUNCH WAS BROKEN ON THE LIVE APP FOR EVERY GAME AND
 * 1,150 TESTS PASSED.** A function was called in `server.js` and never
 * imported. `node --check` was happy — a missing import is a ReferenceError at
 * the moment the line runs, not a syntax error — and every existing test
 * either calls `session.launch()` directly or reads `server.js` as TEXT. So
 * nothing in this repo had ever executed the file.
 *
 * CLAUDE.md already said this in words: *"the engine is rarely the hazard; the
 * console's launch form is, and no unit test presses a button"*, and *"a `node
 * --check` passing means the file parses, not that Launch still launches."*
 * Both were true and both were only advice. This is the advice with an
 * assertion on it.
 *
 * **WHAT IT IS FOR IS THE PROTECTED SURFACE, NOT THE FEATURE.** It is
 * deliberately shallow: boot, launch a real pack, get a 200, see the game on
 * the projector's payload. Anything that stops that path is a night that does
 * not happen, and this is the cheapest possible alarm on it. Do NOT grow it
 * into a test of what launching does — that is what the engine tests are for,
 * and a slow suite is a suite people stop running before a gig.
 *
 * **Localhost only, its own DATA_DIR, its own port, and it cleans up.** It must
 * never touch the repo's `data/` — a session lost `data/invoicing.json` out of
 * the working tree that way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'launch-route-test-key';

/** A pack that really is on disk, so this cannot pass against a made-up id. */
function aRealQuiz() {
  const f = readdirSync(join(ROOT, 'quizzes')).find((n) => n.endsWith('.json'));
  return f ? f.replace(/\.json$/, '') : null;
}

/**
 * Boot the real server on its own port, with its own data directory.
 *
 * The port is derived from the process id rather than fixed, so this cannot
 * collide with a server somebody left running — which on this machine is a
 * real possibility, because half the checks in this repo start one.
 */
async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'launch-route-'));
  const port = 4100 + (process.pid % 800);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: KEY },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    // Up to ten seconds to come up, then give in — a hang here would be worse
    // than a failure, because a test that hangs is a test people skip.
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try {
        await fetch(`${base}/api/state?role=screen`);
        up = true;
      } catch {
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

test('LAUNCH ACTUALLY LAUNCHES — the route, not the engine behind it', async () => {
  const packId = aRealQuiz();
  assert.ok(packId, 'there are no quiz packs on disk to launch');

  await withServer(async (base) => {
    const res = await fetch(`${base}/api/host/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ game: 'quiz', packId, replace: true }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, `launch answered ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.ok, true);
    assert.equal(body.started.id, packId);

    // And the projector really is showing it, which is the half a 200 does not
    // prove on its own.
    const screen = await (await fetch(`${base}/api/state?role=screen`)).json();
    assert.equal(screen.phase, 'lobby');
    assert.ok(screen.quizTitle, 'the big screen has no quiz on it after a launch');
  });
});

test('a bingo pack launches too, because it is a different branch of the same route', async () => {
  const f = readdirSync(join(ROOT, 'bingo')).find((n) => n.endsWith('.json'));
  const packId = f ? f.replace(/\.json$/, '') : null;
  assert.ok(packId, 'there are no bingo packs on disk to launch');

  await withServer(async (base) => {
    const res = await fetch(`${base}/api/host/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ game: 'bingo', packId, replace: true }),
    });
    assert.equal(res.status, 200, `bingo launch answered ${res.status}`);
  });
});

test('the lobby game chosen at launch reaches the phone', async () => {
  /*
   * The specific thing that broke: `lobbyGameFor` was called in the route and
   * never imported, so every launch threw. Asserting the CHOICE arrives is
   * strictly better than asserting a 200 — it covers the import and the
   * plumbing behind it in one go.
   */
  const packId = aRealQuiz();
  await withServer(async (base) => {
    await fetch(`${base}/api/host/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ game: 'quiz', packId, lobbyGame: 'tailback', replace: true }),
    });
    const join = await (await fetch(`${base}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Norfolk N Chance' }),
    })).json();
    const id = join.playerId || join.id || (join.you && join.you.id);
    assert.ok(id, `no player id came back from join: ${JSON.stringify(join).slice(0, 200)}`);
    const view = await (await fetch(`${base}/api/state?role=player&playerId=${encodeURIComponent(id)}`)).json();
    assert.equal(view.lobbyGame, 'tailback', 'the phone was not told which game tonight');
    assert.ok(view.gameSeed >= 1, 'the phone was given no seed');
  });
});
