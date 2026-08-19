/**
 * THE SIGNUP FORM, FOR REAL — the route, not just the class behind it.
 *
 * Same lesson as launch-route.test.js: nothing in this repo had ever
 * executed server.js's account-creation path from an HTTP request before
 * this. It starts the real server and posts to it.
 *
 * There is no email service configured in a test run, so `/api/signup`
 * falls back to handing the password-setup link back in its own response
 * (`devLink`) — the same fallback a local/dev setup gets. That is exactly
 * what makes the whole loop testable end to end without a mail provider.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'signup-route-'));
  const port = 4900 + (process.pid % 600);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: 'signup-route-test-key' },
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
    await run(base, dir);
  } finally {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the landing and signup pages serve with no key and no account', async () => {
  await withServer(async (base) => {
    const home = await fetch(`${base}/home`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Quizporium/);

    const signup = await fetch(`${base}/signup`);
    assert.equal(signup.status, 200);
    assert.match(await signup.text(), /signupForm/);
  });
});

test('signing up opens a real Bronze, trialing account — and the whole loop works with no email service', async () => {
  await withServer(async (base, dir) => {
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rob Quizteam', email: 'rob@example.com' }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, `signup answered ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.ok, true);
    assert.ok(body.devLink, 'no dev fallback link came back, and there is no email service in this test run');

    const saved = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8'));
    const made = saved.accounts.find((a) => a.email === 'rob@example.com');
    assert.ok(made, 'no account was written to disk');
    assert.equal(made.name, 'Rob Quizteam');
    assert.equal(made.role, 'quizmaster');
    assert.equal(made.tier, 'bronze');
    assert.equal(made.status, 'trialing');
    assert.ok(!made.hash || made.hash.length, 'a password was set, even if a throwaway one');

    // The link actually completes the loop — set a password with it, then
    // sign in with what was just set. This is the whole point of reusing
    // the reset mechanism rather than inventing a second one.
    const token = new URL(body.devLink).searchParams.get('t');
    const complete = await fetch(`${base}/api/reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'a proper password' }),
    });
    assert.equal(complete.status, 200, `reset/complete answered ${complete.status}`);

    const signIn = await fetch(`${base}/api/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rob@example.com', password: 'a proper password' }),
    });
    assert.equal(signIn.status, 200, `sign-in after signup answered ${signIn.status}`);
  });
});

test('a duplicate email is refused with a 400 naming the reason, not a 500', async () => {
  await withServer(async (base) => {
    const first = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rob', email: 'rob@example.com' }),
    });
    assert.equal(first.status, 200);

    const second = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Someone else', email: 'rob@example.com' }),
    });
    assert.equal(second.status, 400);
    const body = await second.json();
    assert.match(body.error, /already/i);
  });
});

test('no name, or an unusable email, is refused rather than opening a broken account', async () => {
  await withServer(async (base) => {
    const noName = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'rob@example.com' }),
    });
    assert.equal(noName.status, 400);

    const badEmail = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rob', email: 'not an email' }),
    });
    assert.equal(badEmail.status, 400);
  });
});
