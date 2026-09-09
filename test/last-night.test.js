/**
 * THE LAST NIGHT, ASKED OVER REAL HTTP.
 *
 * Asked for in these words: *"I don't want someone to get a nasty shock if
 * they haven't paid… I want them to be able to run the nights that they
 * thought they were gonna run, but it warns them — this will be the last
 * night you can run — and then it cuts them off at midnight."*
 *
 * ---
 *
 * **THIS FILE EXISTS BECAUSE NOTHING ELSE CAN REACH THE STATE.** No account in
 * this app becomes `past_due` on its own: `applyBilling()` is the only thing
 * that sets it and nothing calls `applyBilling()` until a payment processor is
 * wired up. So the whole policy is unreachable by clicking, and the unit tests
 * in `accounts.test.js` only ever ask the BOOK. A gate on the protected
 * surface that has never been asked over HTTP is the fault this repo already
 * shipped once — *a test that never runs the artefact proves nothing about
 * it* — so these seed the state on disk and make the request.
 *
 * **THE STAMP IS THE HALF WORTH GUARDING.** `mayStartSomething()` allows the
 * night; only the launch ROUTE spends it. If that call is ever dropped the
 * grace becomes unlimited, every unit test still passes, and nobody finds out
 * until somebody has been running free for a month.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { withServer as live } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const PASSWORD = 'a-long-lapsed-password';
const EMAIL = 'skint@x.com';

/*
 * THE STALE NIGHT IS SEEDED BEFORE THE SPAWN, NEVER WRITTEN MID-TEST.
 *
 * `Accounts` reads its file ONCE, at boot — so the first version of the third
 * test wrote yesterday's date into the file while the server was up, saw the
 * launch succeed, and reported the grace as unlimited. The server had never
 * read it. That is this repo's own note on `live-server.mjs` arriving as a
 * false finding, which is exactly what a guard must not produce.
 */
const withServer = (run, { status = 'past_due', lastNight = '' } = {}) => live(run, {
  hostKey: 'last-night-key',
  seed(dir) {
    const file = path.join(dir, 'accounts.json');
    const accounts = new Accounts(file);
    const made = accounts.create({
      email: EMAIL, password: PASSWORD, name: 'Dave', role: 'quizmaster',
      tier: 'gold', status,
    });
    if (lastNight) accounts.find(made.id).lastNight = lastNight;
    accounts.save();
    return file;
  },
});

async function cookieFor(base) {
  const res = await fetch(`${base}/api/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert.equal(res.status, 200, 'could not sign the lapsed account in');
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

const launch = (base, cookie) => fetch(`${base}/api/host/launch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ game: 'quiz', packId: '1980s-pop-music' }),
});

test('a lapsed subscription still launches tonight, and says so', async () => {
  await withServer(async (base, file) => {
    const cookie = await cookieFor(base);

    // The console is told, BEFORE anything is pressed — this is the warning.
    const me = await (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).json();
    assert.equal(me.account.entitlements.status, 'past_due', 'the fixture is not lapsed');
    assert.equal(me.account.lastNightLeft, true, 'the console was never told it is the last night');

    const res = await launch(base, cookie);
    assert.equal(res.status, 200, 'a lapsed subscription was refused its last night');

    // And the launch SPENT it — the half no unit test can see.
    const book = JSON.parse(fs.readFileSync(file, 'utf8'));
    const dave = book.accounts.find((a) => a.email === EMAIL);
    assert.ok(dave.lastNight, 'the launch route did not spend the last night');
  });
});

test('and the same evening is still that one night', async () => {
  await withServer(async (base, file) => {
    const cookie = await cookieFor(base);
    assert.equal((await launch(base, cookie)).status, 200);
    const first = JSON.parse(fs.readFileSync(file, 'utf8')).accounts.find((a) => a.email === EMAIL).lastNight;

    // The bingo after the quiz, or the second of two short quizzes.
    const again = await launch(base, cookie);
    assert.equal(again.status, 200, 'the second game of one evening was refused');
    const after = JSON.parse(fs.readFileSync(file, 'utf8')).accounts.find((a) => a.email === EMAIL).lastNight;
    assert.equal(after, first, 'a second game the same night moved the day on');
  });
});

test('a night already spent on an earlier day is refused, with the reason in words', async () => {
  await withServer(async (base) => {
    const cookie = await cookieFor(base);
    const res = await launch(base, cookie);
    assert.equal(res.status, 403, 'the grace was unlimited');
    const body = await res.json();
    assert.match(body.error, /payment/i, `a bare refusal: ${body.error}`);

    const me = await (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).json();
    assert.equal(me.account.lastNightLeft, false, 'the console still offers a last night that is gone');
  }, { lastNight: '2000-01-01' });
});

test('a paying account is untouched by any of it', async () => {
  await withServer(async (base, file) => {
    const cookie = await cookieFor(base);
    const me = await (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).json();
    assert.equal(me.account.lastNightLeft, false, 'a paying account was warned about a last night');

    assert.equal((await launch(base, cookie)).status, 200);
    const dave = JSON.parse(fs.readFileSync(file, 'utf8')).accounts.find((a) => a.email === EMAIL);
    assert.equal(dave.lastNight, undefined, 'a paying account had a grace night stamped on it');
  }, { status: 'active' });
});
