/**
 * The public gallery, generalised from Mark's own single-tenant page to one
 * per quizmaster (`?q=<accountId>`) — for real, over HTTP.
 *
 * The one thing worth being certain about, and the reason this is a route
 * test rather than a unit test: the OWNER PREVIEW SHORTCUT (`who.role ===
 * 'owner'` sees a night before it is published, to prove the feature works
 * before anything goes public) must NOT survive `?q=` pointing at somebody
 * else's gallery. Before this generalisation the shortcut was safe because
 * there was only ever one gallery, the owner's own; extending it naively
 * would have let the owner preview EVERY subscriber's unpublished, private
 * photos with nothing consented and nothing logged — exactly the cross-room
 * read the own-packs guarantee refuses everywhere else in this app.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'gallery-route-test-key';

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'gallery-route-'));
  mkdirSync(join(dir), { recursive: true });

  // Two real quizmaster accounts, seeded directly — same file shape
  // Accounts.save() writes, so this is exactly what a real signup produces,
  // just without going through the email/reset-link dance to get there.
  const { Accounts } = await import('../src/accounts.js');
  const book = new Accounts(join(dir, 'accounts.json'));
  const a = book.create({ email: 'alice@example.com', password: 'a horse walked into a pub', name: 'Alice', tier: 'gold', status: 'active' });
  const b = book.create({ email: 'bob@example.com', password: 'a horse walked into a pub', name: 'Bob', tier: 'gold', status: 'active' });

  const port = 4500 + (process.pid % 500);
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
    await run(base, { a, b });
  } finally {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

async function signIn(base, email, password) {
  const res = await fetch(`${base}/api/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `sign-in for ${email} failed: ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  assert.ok(cookie.includes('mmm_session'), `no session cookie came back for ${email}`);
  return cookie;
}

test('a quizmaster does NOT get owner-style preview on somebody else\'s gallery by naming their id', async () => {
  await withServer(async (base, { a, b }) => {
    const cookieA = await signIn(base, 'alice@example.com', 'a horse walked into a pub');
    const res = await fetch(`${base}/api/gallery?q=${encodeURIComponent(b.id)}`, {
      headers: { Cookie: cookieA },
    });
    const data = await res.json();
    assert.equal(data.preview, false, 'Alice must not preview Bob\'s unpublished gallery');
  });
});

test('a quizmaster DOES get preview on their own gallery, named explicitly', async () => {
  await withServer(async (base, { a }) => {
    const cookieA = await signIn(base, 'alice@example.com', 'a horse walked into a pub');
    const res = await fetch(`${base}/api/gallery?q=${encodeURIComponent(a.id)}`, {
      headers: { Cookie: cookieA },
    });
    const data = await res.json();
    assert.equal(data.preview, true, 'Alice previewing her own gallery by her own id must work');
  });
});

test('THE HOST KEY DOES NOT GET A FREE PREVIEW OF SOMEBODY ELSE\'S GALLERY VIA ?q=', async () => {
  await withServer(async (base, { b }) => {
    const res = await fetch(`${base}/api/gallery?q=${encodeURIComponent(b.id)}`, {
      headers: { 'X-Host-Key': KEY },
    });
    const data = await res.json();
    assert.equal(data.preview, false,
      'the owner/host-key shortcut must fall through to "is this actually my own room", never a blanket yes');
  });
});

test('the host key still previews its OWN gallery exactly as before — backward compatible', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/gallery`, { headers: { 'X-Host-Key': KEY } });
    const data = await res.json();
    assert.equal(data.preview, true, 'the original single-tenant behaviour (no ?q=) must be unchanged');
  });
});

test('an unauthenticated visitor gets no preview, on anybody\'s gallery', async () => {
  await withServer(async (base, { a }) => {
    const res = await fetch(`${base}/api/gallery?q=${encodeURIComponent(a.id)}`);
    const data = await res.json();
    assert.equal(data.preview, false);
  });
});

test('a made-up id resolves to an empty gallery, never a crash or a 500', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/gallery?q=not-a-real-account-id-at-all`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.nights, []);
  });
});

test('/api/brand names the right quizmaster for a gallery link, not always the house room', async () => {
  await withServer(async (base, { a }) => {
    const res = await fetch(`${base}/api/brand?q=${encodeURIComponent(a.id)}`);
    const data = await res.json();
    assert.match(data.name, /Alice/);
  });
});
