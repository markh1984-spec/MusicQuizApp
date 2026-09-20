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
import { freePort, stopped } from './helpers/live-server.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'signup-route-'));
  /*
   * A PORT FROM THE OPERATING SYSTEM, NEVER FROM THE PID.
   *
   * Ten test files spawn a server and every one of them derived a port from
   * `process.pid` — the SAME pid — so their ranges overlapped and, at CPU
   * concurrency, two suites could want one port. That is a flake that reads
   * as a bug in the app: a different test each run, all of them passing
   * alone. See `test/helpers/live-server.mjs`.
   */
  const port = await freePort();
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
    /*
     * GONE, THEN DELETED — `stopped()` is `test/helpers/live-server.mjs`'s.
     * `kill()` sends a signal and waits for nothing, so deleting the data
     * directory on the next line races a server still flushing `state.json`
     * into it: ENOTEMPTY out of this `finally`, every assertion already
     * passed, naming a feature that works.
     */
    await stopped(child, 'SIGKILL');
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
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

/*
 * ====================================================== HELD AT THE DOOR
 *
 * Account creation was unbounded, and each signup fires TWO emails off the
 * owner's provider quota. A script could fill the accounts book, burn the
 * quota, and RESERVE addresses it does not own — `create()` throws on a
 * duplicate, so a reserved address is one a real customer then cannot use.
 *
 * A fresh server per test is what makes this measurable: the window lives in
 * memory, so the count starts at nothing.
 */
test('one place may open a few accounts, and then is asked to come back later', async () => {
  await withServer(async (base, dir) => {
    const open = (n) => fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Rob ${n}`, email: `rob${n}@example.com` }),
    });

    // Five is the cap and the fifth must still work — a limit that bites at
    // four would refuse the busiest honest case, a quiz company signing its
    // own hosts up one at a time.
    for (let i = 0; i < 5; i += 1) {
      const res = await open(i);
      assert.equal(res.status, 200, `signup ${i + 1} of 5 should be allowed`);
    }

    const sixth = await open(99);
    assert.equal(sixth.status, 429, 'the sixth in an hour from one place is a script, not a customer');
    const said = await sixth.json();
    assert.match(said.error, /try again shortly/i,
      'and it says when to come back — a bare 429 reads as the app being broken');

    /*
     * AND IT REFUSES BEFORE IT WRITES. The whole point is that the address is
     * not reserved, so a real customer can still use it afterwards.
     */
    const book = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8'));
    assert.equal(
      book.accounts.filter((a) => a.email === 'rob99@example.com').length, 0,
      'a refused signup must leave no account behind, or it has reserved the address anyway',
    );
  });
});

/*
 * AND THE PASSWORD LINK MAY NOT COME BACK IN THE BODY ON THE DEPLOYED APP.
 *
 * It used to come back whenever no mail provider was configured — anywhere —
 * which on the live app meant **anybody could create AND activate an account on
 * an address they do not own**, the magic link being the only thing standing in
 * for verifying it. `signup.js`'s own comment claimed this never happened.
 *
 * A forwarding header is what a proxy in front of the app adds, so it is the
 * honest test for "this is deployed" and cannot be forgotten the way an
 * environment variable can.
 */
test('a signup from behind a proxy gets no password link in the response', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ name: 'Deployed Dave', email: 'dave@example.com' }),
    });
    assert.equal(res.status, 200, 'the account is still made — losing it reserves the address for nothing');
    const body = await res.json();
    assert.equal(body.devLink, undefined,
      'a deployed app handing out a password link lets anybody activate somebody else’s address');
    assert.equal(body.noEmail, true,
      'and it must SAY so, or they watch an inbox for a message nobody sent');
  });
});

/* The loopback case is unchanged, and that is what keeps every test above working. */
test('a local run still gets the link, so there is a way in with no mail provider', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Local Local', email: 'local@example.com' }),
    });
    const body = await res.json();
    assert.match(String(body.devLink), /\/reset\?t=/, 'a local run with no mail provider must still hand the link over');
    assert.equal(body.noEmail, undefined, 'and must not also claim there is no way in');
  });
});
