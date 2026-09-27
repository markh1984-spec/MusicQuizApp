/**
 * A FLOOD OF WRONG PASSWORDS MUST NOT FREEZE THE ROOM.
 *
 * Sign-in ran `scryptSync` (~40ms of the event loop) on every attempt, with no
 * throttle — signup had one, sign-in did not — so 120 concurrent wrong
 * passwords from one script made `/health` take five seconds. One server hosts
 * every room: that is every projector's stream, every phone's answer and every
 * control view, in every pub, frozen by anybody with the login page's address.
 * O24 of the 23 September 2026 launch-path sweep.
 *
 * Two halves, both needed: the hash is computed OFF the event loop
 * (`crypto.scrypt`, the thread pool), and there is a door — attempts per
 * address per window and hashes in the pool at once, both SAFETY numbers like
 * `SIGNUPS_PER_HOUR`, refusing BEFORE any hash runs. Nobody signing in is
 * mid-gig, so a 429 with a sentence costs nobody a night (CLAUDE.md: a signup
 * may be refused and a join may not).
 *
 * The measurement is the assertion: `/health` is timed while the flood is in
 * flight, against a bound the fault misses by seconds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { withServer } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';
import { SIGN_INS_PER_WINDOW } from '../src/http/plumbing.js';

const EMAIL = 'flood@x.com';
const PASSWORD = 'a-long-flood-password';
const FLOOD = 120;
const HEALTH_BOUND_MS = 1000;

const signIn = (base, password, address) => fetch(`${base}/api/sign-in`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(address ? { 'x-forwarded-for': address } : {}) },
  body: JSON.stringify({ email: EMAIL, password }),
});

test('120 wrong passwords at once: the server still answers /health in under a second', async () => {
  await withServer(async (base) => {
    const t0 = Date.now();
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const quiet = Date.now() - t0;

    const flood = Array.from({ length: FLOOD }, () => signIn(base, 'not-the-password'));
    // Let the flood LAND before asking — a probe sent in the same tick slips in
    // between two hashes; the room's phones arrive behind the backlog.
    await new Promise((r) => setTimeout(r, 150));
    const t1 = Date.now();
    const health = await fetch(`${base}/health`);
    const underFlood = Date.now() - t1;
    assert.equal(health.status, 200);
    assert.ok(underFlood < HEALTH_BOUND_MS,
      `/health took ${underFlood}ms with ${FLOOD} sign-ins in flight (${quiet}ms when quiet) — the room is frozen by the login page`);

    const answers = await Promise.all(flood);
    const statuses = answers.map((r) => r.status);
    assert.ok(!statuses.includes(500), `a sign-in answered 500: ${JSON.stringify(statuses)}`);
    assert.ok(statuses.includes(401), 'a wrong password must still be told it is wrong');
    assert.ok(statuses.includes(429), `nothing refused the flood: ${JSON.stringify([...new Set(statuses)])}`);
    assert.ok(statuses.filter((s) => s === 401).length <= SIGN_INS_PER_WINDOW,
      `more attempts than ${SIGN_INS_PER_WINDOW} were hashed from one address`);
    const refused = answers[statuses.indexOf(429)];
    const said = await refused.json();
    assert.match(String(said.error || ''), /sign in|sign-in/i, `the refusal is not a sentence: ${JSON.stringify(said)}`);

    // The door is per address: a quizmaster somewhere else still gets in.
    const other = await signIn(base, PASSWORD, '10.9.8.7');
    assert.equal(other.status, 200, `a genuine sign-in from another address was refused: ${await other.text()}`);
    // And the flooded address is still told wrong is wrong, not who exists.
    const wrongElsewhere = await signIn(base, 'still-wrong', '10.9.8.7');
    assert.equal(wrongElsewhere.status, 401);
  }, {
    seed(dir) {
      const accounts = new Accounts(path.join(dir, 'accounts.json'));
      accounts.create({ email: EMAIL, password: PASSWORD, name: 'Flo', role: 'quizmaster', tier: 'gold', status: 'active' });
      accounts.save();
    },
  });
});
