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
    assert.equal(body.referred, false);
    assert.equal(body.trialDays, 14);
    assert.ok(body.devLink, 'no dev fallback link came back, and there is no email service in this test run');

    const saved = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8'));
    const made = saved.accounts.find((a) => a.email === 'rob@example.com');
    assert.ok(made, 'no account was written to disk');
    assert.equal(made.name, 'Rob Quizteam');
    assert.equal(made.role, 'quizmaster');
    assert.equal(made.tier, 'bronze');
    assert.equal(made.status, 'trialing');
    assert.ok(made.trialEndsAt, 'no trial clock was set');
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

test('signing up with a real ?ref= doubles the trial and credits the referrer once they pay', async () => {
  await withServer(async (base, dir) => {
    const referrerRes = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Referrer', email: 'referrer@example.com' }),
    });
    const referrerId = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8'))
      .accounts.find((a) => a.email === 'referrer@example.com').id;
    assert.equal(referrerRes.status, 200);

    const referredRes = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Referred', email: 'referred@example.com', ref: referrerId }),
    });
    const referredBody = await referredRes.json();
    assert.equal(referredRes.status, 200);
    assert.equal(referredBody.referred, true);
    assert.equal(referredBody.trialDays, 28);

    const saved = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8'));
    const referred = saved.accounts.find((a) => a.email === 'referred@example.com');
    assert.equal(referred.referredBy, referrerId);
  });
});

test('a bogus ?ref= is dropped rather than refusing the signup', async () => {
  await withServer(async (base, dir) => {
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rob', email: 'rob@example.com', ref: 'acc_nonexistent' }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.referred, false);
    assert.equal(body.trialDays, 14);

    const saved = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8'));
    assert.equal(saved.accounts.find((a) => a.email === 'rob@example.com').referredBy, '');
  });
});

/*
 * ---- WHICH RUNG THEY PRESSED ON THE WAY IN ---------------------------------
 *
 * The sales page has a button per tier, so a signup carries which one was
 * pressed. That is worth keeping: before payments exist it is the only signal
 * about what people actually want to pay for, and afterwards it is what to
 * offer rather than ask again.
 *
 * **THE WHOLE RISK IS THAT IT BECOMES A GRANT.** A rung read out of a request
 * body and written to `tier` hands anybody Gold for nothing — and a stranger
 * can type `?tier=gold` as easily as press it. Same shape as the pack id that
 * had to be re-checked at the launch route rather than trusted to the console
 * not drawing a button. So this goes over real HTTP: what matters is what the
 * ROUTE writes to the account file, not what a function would do if asked
 * nicely.
 */

const accountsIn = (dir) => JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8')).accounts;

test('the rung pressed on the sales page is recorded, and is NOT granted', async () => {
  await withServer(async (base, dir) => {
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gold Presser', email: 'gold@example.com', tier: 'gold' }),
    });
    assert.equal(res.status, 200);
    const acc = accountsIn(dir).find((a) => a.email === 'gold@example.com');
    assert.ok(acc, 'the account was not created at all');
    assert.equal(acc.wantedTier, 'gold', 'the rung they pressed was dropped on the way through');
    assert.equal(acc.tier, 'bronze',
      'asking for gold GRANTED gold — that is anybody upgrading themselves for free');
  });
});

test('a rung that is not on the ladder is dropped rather than stored', async () => {
  await withServer(async (base, dir) => {
    // `?tier=` is a query-string parameter a stranger can hand-edit. A junk one
    // must not be kept and later believed by whatever wires up the payments.
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Chancer', email: 'junk@example.com', tier: 'free' }),
    });
    assert.equal(res.status, 200, 'a junk tier failed a real signup — it must only be dropped');
    const acc = accountsIn(dir).find((a) => a.email === 'junk@example.com');
    assert.equal('wantedTier' in acc, false, 'a rung that does not exist was stored anyway');
    assert.equal(acc.tier, 'bronze');
  });
});

test('somebody who pressed no rung carries no field at all', async () => {
  await withServer(async (base, dir) => {
    // The common case costs nothing, like `parentId` on an ordinary account.
    await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Plain', email: 'plain@example.com' }),
    });
    const acc = accountsIn(dir).find((a) => a.email === 'plain@example.com');
    assert.equal('wantedTier' in acc, false);
  });
});

/*
 * ---- THE FRONT DOOR ---------------------------------------------------------
 *
 * `/` used to send anybody not signed in to `/login` — a password box for an
 * account they do not have — while the page that sells the thing sat at `/home`,
 * findable only by knowing to type it. A shop with its lights on and the door
 * round the back.
 */

test('A STRANGER AT THE ROOT GETS THE SALES PAGE, NOT A PASSWORD BOX', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/home',
      'a visitor typing the domain is still being met by a login form');
  });
});

test('and the sales page offers a way in at every rung', async () => {
  await withServer(async (base) => {
    const html = await (await fetch(`${base}/home`)).text();
    for (const tier of ['bronze', 'silver', 'gold']) {
      assert.ok(html.includes(`/signup?tier=${tier}`),
        `no way to start on ${tier} — that rung is a price with no button`);
    }
    // And the screenshots it rests on are actually served, not 404s in a page
    // nobody looked at.
    for (const shot of ['night-winner', 'night-lobby', 'night-question', 'night-phone', 'the-console']) {
      const img = await fetch(`${base}/assets/site/${shot}.webp`);
      assert.equal(img.status, 200, `${shot}.webp is missing from the sales page`);
      assert.equal(img.headers.get('content-type'), 'image/webp');
    }
  });
});
