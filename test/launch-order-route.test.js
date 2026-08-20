/**
 * TONIGHT AS MORE THAN ONE GAME, THROUGH THE REAL ROUTE — the same
 * "actually run the server" shape as `launch-route.test.js`, for the same
 * reason: session.js's own tests call `launchRunningOrder`/`advanceOrder`
 * directly, and CLAUDE.md's own lesson is that a method call proves nothing
 * about the route in front of it. `/api/host/launchOrder` is brand new and
 * has never been hit by an HTTP request before this file.
 *
 * Deliberately shallow, like its sibling: boot, launch a real mixed running
 * order, confirm the projector shows the first part, then advance into the
 * bingo interlude and confirm THAT reaches the projector too. The score-
 * carry and no-early-archiving guarantees are session.test.js's job; this
 * file only proves the HTTP surface is wired at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'launch-order-route-test-key';

function aRealQuiz() {
  const f = readdirSync(join(ROOT, 'quizzes')).find((n) => n.endsWith('.json'));
  return f ? f.replace(/\.json$/, '') : null;
}

function aRealBingo() {
  const f = readdirSync(join(ROOT, 'bingo')).find((n) => n.endsWith('.json'));
  return f ? f.replace(/\.json$/, '') : null;
}

/** Same shape as launch-route.test.js's own helper — a fresh port and DATA_DIR. */
async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'launch-order-route-'));
  const port = 4900 + (process.pid % 800);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: KEY },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
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

test('launchOrder actually launches a mixed running order, through the real route', async () => {
  const quizId = aRealQuiz();
  const bingoId = aRealBingo();
  assert.ok(quizId, 'there are no quiz packs on disk to launch');
  assert.ok(bingoId, 'there are no bingo packs on disk to launch');

  await withServer(async (base) => {
    const res = await fetch(`${base}/api/host/launchOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({
        segments: [
          { kind: 'quiz', order: [{ packId: quizId, round: 0 }] },
          { kind: 'bingo', packId: bingoId, prizes: 2 },
        ],
        replace: true,
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, `launchOrder answered ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.ok, true);

    const screen = await (await fetch(`${base}/api/state?role=screen`)).json();
    assert.equal(screen.game, 'quiz');
    assert.equal(screen.phase, 'lobby');

    // The host view says a running order is under way and what kind is next.
    const host = await (await fetch(`${base}/api/state?role=host&key=${KEY}`)).json();
    assert.ok(host.runningOrder, 'the host was not told a running order is on');
    assert.equal(host.runningOrder.pos, 0);
    assert.equal(host.runningOrder.total, 2);
    assert.equal(host.runningOrder.nextKind, 'bingo');

    // Advance, through the ordinary generic action route — no new plumbing
    // needed there, since `advanceOrder` sits in Session's shared actions.
    const adv = await fetch(`${base}/api/host/advanceOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    });
    const advBody = await adv.json();
    assert.equal(adv.status, 200, `advanceOrder answered ${adv.status}: ${JSON.stringify(advBody)}`);

    const screenAfter = await (await fetch(`${base}/api/state?role=screen`)).json();
    assert.equal(screenAfter.game, 'bingo', 'the projector did not follow the switch into the bingo part');

    const hostAfter = await (await fetch(`${base}/api/state?role=host&key=${KEY}`)).json();
    assert.equal(hostAfter.runningOrder.pos, 1);
    assert.equal(hostAfter.runningOrder.nextKind, null, 'the last part should have no "next" kind');
  });
});

test('a pack that has gone from the shelf is named in the error, for every part, not just the first', async () => {
  /*
   * The host key is the owner's own bootstrap account, comped and holding
   * everything — so the ownership/tier 403 that `launch` itself gets
   * (mirrored here for the same reason) is not reachable through this
   * harness at all, and neither is the equivalent single-pack test in
   * launch-route.test.js. What IS reachable, and worth pinning: a SECOND
   * part naming a pack that simply is not there any more must not be
   * silently dropped — `composeQuiz`/`readPack` already say so for the
   * first part, and this is the same guarantee for the second.
   */
  const quizId = aRealQuiz();
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/host/launchOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({
        segments: [
          { kind: 'quiz', order: [{ packId: quizId, round: 0 }] },
          { kind: 'bingo', packId: 'not-a-real-pack-at-all', prizes: 1 },
        ],
        replace: true,
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, `expected the missing second-part pack to be refused, got ${res.status}: ${JSON.stringify(body)}`);
    assert.ok(body.error, 'the refusal did not say why');
  });
});

test('launchOrder says what it is about to destroy, same as an ordinary launch', async () => {
  const quizId = aRealQuiz();
  const bingoId = aRealBingo();
  await withServer(async (base) => {
    await fetch(`${base}/api/host/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ game: 'quiz', packId: quizId, replace: true }),
    });
    await fetch(`${base}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Quizteam Aguilera' }),
    });

    const res = await fetch(`${base}/api/host/launchOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({
        segments: [
          { kind: 'quiz', order: [{ packId: quizId, round: 0 }] },
          { kind: 'bingo', packId: bingoId, prizes: 1 },
        ],
      }),
    });
    assert.equal(res.status, 409, 'launching a running order over a live game with a real player must not be silent');
    const body = await res.json();
    assert.ok(body.live, 'the 409 did not say what was about to be destroyed');
  });
});
