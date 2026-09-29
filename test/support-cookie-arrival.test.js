/**
 * A HAND-SET ACTING COOKIE IS AN ARRIVAL, AND AN ARRIVAL IS CHECKED AND
 * WRITTEN DOWN — exactly as the support button's is.
 *
 * The button (`POST /api/owner/act-as` with an `accountId`) checks the grant,
 * refuses a room with people in it and writes "<owner> came in" to the
 * subscriber's log before it issues `mmm_acting`. `whoIs()` then honoured the
 * cookie on every request having checked the grant ALONE — so an owner who
 * set the cookie by hand walked into a busy room with no line in the log.
 * Owner-only and behind a live grant, and still the one promise this log
 * makes: everything done inside is written down where they can read it.
 *
 * Three claims over HTTP: a hand-set cookie writes the line, once; a hand-set
 * cookie into a busy room is refused and writes nothing; and the button still
 * writes its one line and its cookie adds no second.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import { ACTING_COOKIE } from '../src/http/identity.js';
import { withServer as live } from './helpers/live-server.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const QUIZ = fs.readdirSync(path.join(ROOT, 'quizzes')).find((f) => f.endsWith('.json')).slice(0, -5);

function seed(dir) {
  const accounts = new Accounts(path.join(dir, 'accounts.json'));
  accounts.create({ email: 'owner@x.com', password: 'a-long-owner-password', name: 'Mark', role: 'owner', status: 'active' });
  const rob = accounts.create({ email: 'rob@x.com', password: 'a-long-rob-password', name: 'Rob', role: 'quizmaster', tier: 'gold', status: 'active' });
  accounts.save();
  return { rob };
}
const withServer = (run) => live(run, { hostKey: 'support-arrival-key', seed });

const J = { 'Content-Type': 'application/json' };
async function signIn(base, email, password) {
  const res = await fetch(`${base}/api/sign-in`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200, `could not sign ${email} in`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}
const me = async (base, cookie) => (await (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).json()).account;
const cameIn = async (base, rob) => ((await me(base, rob)).support?.log || []).filter((l) => /came in/.test(l.what));
const openDoor = (base, rob) => fetch(`${base}/api/me/support`, { method: 'PUT', headers: { ...J, Cookie: rob }, body: JSON.stringify({ open: true }) });

test('a cookie set by hand is an arrival: the line is written, once', async () => {
  await withServer(async (base, { rob }) => {
    const robCookie = await signIn(base, 'rob@x.com', 'a-long-rob-password');
    await openDoor(base, robCookie);
    const owner = await signIn(base, 'owner@x.com', 'a-long-owner-password');
    const byHand = `${owner}; ${ACTING_COOKIE}=${rob.id}`;

    assert.equal((await me(base, byHand)).email, 'rob@x.com', 'the open door did not let the cookie in');
    assert.equal((await cameIn(base, robCookie)).length, 1, 'a hand-set cookie walked in with no line in the log');
    await me(base, byHand);
    await me(base, byHand);
    assert.equal((await cameIn(base, robCookie)).length, 1, 'every request wrote "came in" again');
  });
});

test('a cookie set by hand into a room with people in it is refused, and writes nothing', async () => {
  await withServer(async (base, { rob }) => {
    const robCookie = await signIn(base, 'rob@x.com', 'a-long-rob-password');
    await openDoor(base, robCookie);
    // Rob's night is up and somebody is in it — the state the button's 409 is for.
    const launch = await fetch(`${base}/api/host/launch`, { method: 'POST', headers: { ...J, Cookie: robCookie }, body: JSON.stringify({ game: 'quiz', packId: QUIZ, venue: 'The Crown', breakPlan: {} }) });
    assert.equal(launch.status, 200, await launch.text());
    const { running } = await (await fetch(`${base}/api/library`, { headers: { Cookie: robCookie } })).json();
    const joined = await fetch(`${base}/api/join`, { method: 'POST', headers: J, body: JSON.stringify({ name: 'Dave', joinCode: running.joinCode }) });
    assert.equal(joined.status, 200);

    const owner = await signIn(base, 'owner@x.com', 'a-long-owner-password');
    const byHand = `${owner}; ${ACTING_COOKIE}=${rob.id}`;
    assert.equal((await me(base, byHand)).email, 'owner@x.com', 'a hand-set cookie reached a night somebody is in the middle of');
    assert.equal((await cameIn(base, robCookie)).length, 0, 'a refused arrival was written down as an arrival');

    // And the button says so in words, as it always did.
    const pressed = await fetch(`${base}/api/owner/act-as`, { method: 'POST', headers: { ...J, Cookie: owner }, body: JSON.stringify({ on: true, accountId: rob.id }) });
    assert.equal(pressed.status, 409);
  });
});

test('the button still writes one line, and the cookie it issues adds no second', async () => {
  await withServer(async (base, { rob }) => {
    const robCookie = await signIn(base, 'rob@x.com', 'a-long-rob-password');
    await openDoor(base, robCookie);
    const owner = await signIn(base, 'owner@x.com', 'a-long-owner-password');
    const pressed = await fetch(`${base}/api/owner/act-as`, { method: 'POST', headers: { ...J, Cookie: owner }, body: JSON.stringify({ on: true, accountId: rob.id }) });
    assert.equal(pressed.status, 200);
    const issued = (pressed.headers.get('set-cookie') || '').split(';')[0];
    assert.equal((await cameIn(base, robCookie)).length, 1);
    assert.equal((await me(base, `${owner}; ${issued}`)).email, 'rob@x.com');
    assert.equal((await cameIn(base, robCookie)).length, 1, 'the cookie the button issued counted as a second arrival');

    // Taking the hat off and coming back by hand is a NEW arrival.
    await fetch(`${base}/api/owner/act-as`, { method: 'POST', headers: { ...J, Cookie: `${owner}; ${issued}` }, body: JSON.stringify({ on: false }) });
    assert.equal((await me(base, `${owner}; ${issued}`)).email, 'rob@x.com');
    assert.equal((await cameIn(base, robCookie)).length, 2, 'coming back after taking the hat off was not written down');
  });
});
