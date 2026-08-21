/**
 * The group routes, for real — starts the server and hits them over HTTP.
 *
 * Not a test of the group LOGIC (see test/groups.test.js for that, against
 * accounts.js directly) — this is the same shallow, deliberate check
 * launch-route.test.js does for Launch: prove the routes are actually wired
 * into server.js's dispatch chain, under the names the client calls, rather
 * than trusting that a route which parses is a route that runs. See
 * CLAUDE.md: "a `node --check` passing means the file parses, not that
 * Launch still launches" — the identical risk applies to any new route.
 *
 * Full sign-in-and-add-a-seat coverage happens in the real-browser live
 * verification for this feature, which exercises actual signup/login rather
 * than reimplementing that flow here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'group-route-test-key';

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'group-route-'));
  const port = 4300 + (process.pid % 700);
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

test('GET /api/group with nobody signed in is refused, not a 404 or a 500', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/group`);
    assert.equal(res.status, 401, `expected 401, got ${res.status} — is the route even wired up?`);
  });
});

test('POST /api/group/seats with nobody signed in is refused', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/group/seats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', password: 'irrelevant password here' }),
    });
    assert.equal(res.status, 401);
  });
});

test('DELETE /api/group/seats/<id> with nobody signed in is refused', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/group/seats/not-a-real-id`, { method: 'DELETE' });
    assert.equal(res.status, 401);
  });
});

test('the host key is not a group — told plainly, not a crash', async () => {
  await withServer(async (base) => {
    const list = await fetch(`${base}/api/group`, { headers: { 'X-Host-Key': KEY } });
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), { seats: [], isSeat: false });

    const add = await fetch(`${base}/api/group/seats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ email: 'x@example.com', password: 'irrelevant password here', name: 'X' }),
    });
    assert.equal(add.status, 400);
    const body = await add.json();
    assert.match(body.error, /host key is not an account/i);
  });
});
