/**
 * A CHECK MEASURES ITS OWN SERVER, NEVER WHATEVER ANSWERED ON THE PORT.
 *
 * `freePort()` asks the OS for a port and lets it go; the app binds it seconds
 * later, after the restore. Every spawner in this repo used to poll "does
 * something answer?" — so another test's server that took the port in the gap
 * was measured in place of its own, while its own child died on EADDRINUSE
 * behind it. `bootApp()` waits for a `/health` that names ITS child's pid.
 *
 * The impostor below is exactly that other server: it holds the port and
 * answers every request, promptly and politely, with somebody else's pid.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bootApp, safeEnv, stopped } from './helpers/live-server.mjs';

/** A server on a port of its own, answering `/health` with `body`. */
async function impostor(body) {
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  // Bound the way the APP binds — every interface — so ours meets EADDRINUSE
  // exactly as it would against another test's server, rather than quietly
  // taking the wildcard address beside a loopback-only one.
  await new Promise((r) => srv.listen(0, r));
  return { port: srv.address().port, close: () => new Promise((r) => srv.close(r)) };
}

async function withDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'boot-app-'));
  try { return await run(dir); } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
}

test("a server holding the port with somebody else's pid is never taken for ours", async () => {
  const other = await impostor({ ok: true, pid: 999_999 });
  try {
    await withDir(async (dir) => {
      const booted = await bootApp({ env: safeEnv(dir), port: other.port });
      if (booted) await stopped(booted.child, 'SIGKILL');
      assert.equal(booted, null,
        'bootApp handed back the impostor — a check would have measured another process');
    });
  } finally { await other.close(); }
});

test('an app too old to say its pid is only accepted when the caller says it may be', async () => {
  // Only `pub-unchanged.mjs` boots one — its baseline — and says so.
  const legacy = await impostor({ ok: true });
  try {
    await withDir(async (dir) => {
      const strict = await bootApp({ env: safeEnv(dir), port: legacy.port });
      if (strict) await stopped(strict.child, 'SIGKILL');
      assert.equal(strict, null, 'a server that cannot say who it is was taken on trust');
    });
  } finally { await legacy.close(); }
});

test('on a free port it comes up, and the pid on /health is its own child', async () => {
  await withDir(async (dir) => {
    const booted = await bootApp({ env: safeEnv(dir) });
    assert.ok(booted, 'the app never came up');
    try {
      const health = await (await fetch(`${booted.base}/health`)).json();
      assert.equal(health.pid, booted.child.pid);
    } finally { await stopped(booted.child, 'SIGKILL'); }
  });
});
