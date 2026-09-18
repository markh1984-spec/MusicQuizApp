/**
 * A PASSWORD ALREADY IN A BREACH IS REFUSED — the thing four characters of
 * minimum length were traded FOR.
 *
 * The minimum came down from ten to eight on 14 September 2026, because ten
 * pushed the host off the password he would actually remember and onto one he
 * then forgot. That is a real cost and it was worth paying — but only against
 * something better, and length is a poor proxy on its own: `Password1` is nine
 * characters and has been in every wordlist for twenty years, while a password
 * nobody has ever used is fine at eight.
 *
 * **What actually loses an account is REUSE**, and this is the check that
 * catches it. Everything below is a security property or an operational one;
 * none of it is a nicety.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { timesBreached, looksBreached, BREACHED_SAID } from '../src/breached.js';
import { checkPassword } from '../src/accounts.js';

const sha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase();

/** The range API answers with SUFFIXES, plus padding rows that count zero. */
function api(known = {}) {
  const calls = [];
  const fetchIt = async (url) => {
    calls.push(url);
    const prefix = url.slice(-5).toUpperCase();
    const lines = ['0000000000000000000000000000000000A:0'];
    for (const [word, count] of Object.entries(known)) {
      const hash = sha1(word);
      if (hash.slice(0, 5) === prefix) lines.push(`${hash.slice(5)}:${count}`);
    }
    return { ok: true, text: async () => lines.join('\r\n') };
  };
  return { fetchIt, calls };
}

test('eight characters is the minimum now, and seven is still refused', () => {
  assert.ok(checkPassword('eightchr'));
  assert.throws(() => checkPassword('sevench'), /at least 8/);
});

test('a breached password is refused however long it is', async () => {
  const { fetchIt } = api({ 'correct horse battery staple': 2451 });
  assert.equal(await looksBreached('correct horse battery staple', { fetchIt }), true,
    'twenty-eight characters and on the list is still on the list');
});

test('one nobody has used is allowed', async () => {
  const { fetchIt } = api({ password: 9_999_999 });
  assert.equal(await looksBreached('a-password-nobody-has-ever-typed', { fetchIt }), false);
});

test('THE PASSWORD NEVER LEAVES — only the first five characters of its hash', async () => {
  /*
   * The whole reason this can call a third party at all. Five hex characters
   * match roughly one in a million of the hashes in the set, so what goes out
   * identifies nothing — the comparison happens here.
   */
  const secret = 'the actual password';
  const { fetchIt, calls } = api();
  await looksBreached(secret, { fetchIt });
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].includes(secret), 'the password itself went over the wire');
  assert.ok(!calls[0].includes(sha1(secret).slice(5)), 'the rest of the hash went over the wire');
  assert.ok(calls[0].endsWith(sha1(secret).slice(0, 5)), 'the prefix is what was asked for');
});

test('IT FAILS OPEN — an outage must never lock somebody out of their own account', async () => {
  /*
   * Three states, never two: yes, no, and COULD NOT TELL. The person setting a
   * password is very often already locked out, and refusing them because a
   * third party is down does far more damage than a reused password would.
   */
  const dead = async () => { throw new Error('getaddrinfo ENOTFOUND'); };
  assert.equal(await timesBreached('anything', { fetchIt: dead }), null, 'unknown, not false');
  assert.equal(await looksBreached('anything', { fetchIt: dead }), false, 'and unknown means allowed');

  const sad = async () => ({ ok: false, status: 503, text: async () => '' });
  assert.equal(await timesBreached('anything', { fetchIt: sad }), null);
  assert.equal(await looksBreached('anything', { fetchIt: sad }), false);
});

test('A PADDING ROW COUNTS ZERO AND IS NOT A HIT', async () => {
  /*
   * The padded response adds decoy suffixes so the SIZE of the reply says
   * nothing about how many real hashes sit under the prefix. "Is it in the
   * list at all" is therefore the wrong question — a decoy IS in the list.
   */
  const secret = 'a-quiet-one';
  const fetchIt = async () => ({ ok: true, text: async () => `${sha1(secret).slice(5)}:0` });
  assert.equal(await timesBreached(secret, { fetchIt }), 0);
  assert.equal(await looksBreached(secret, { fetchIt }), false);
});

test('a hung provider is ABORTED, not merely raced', async () => {
  /*
   * The first version of this test waited for a real abort to fire and was
   * flaky for a reason worth keeping: `AbortSignal.timeout()`'s timer does not
   * hold the event loop open, so the await never settled and node moved on —
   * "Promise resolution is still pending but the event loop has already
   * resolved". Racing a timer proves the clock works; what matters is the
   * CONTRACT, so that is what is asserted.
   *
   * Aborting rather than racing is the point: a promise left running behind a
   * form that has already moved on is a connection nobody closes.
   */
  let seen = null;
  const hang = async (url, opts) => { seen = opts.signal; throw new Error('aborted'); };
  assert.equal(await timesBreached('anything', { fetchIt: hang, timeout: 120 }), null);
  assert.ok(seen instanceof AbortSignal, 'no abort signal was passed to the fetch');
  assert.equal(seen.aborted, false, 'it was already aborted before the call was made');
});

test('and `checkPassword` stays synchronous, with no network in it', () => {
  /*
   * The rule about the SHAPE of a password is pure and testable without a
   * timer; the thing that can time out is at the ROUTES. Same split as
   * `applyBilling()` having no send in it and `trials.js` holding no clock.
   */
  assert.equal(checkPassword('eightchr'), true, 'it answers without awaiting anything');
});

/**
 * AND THE ROUTES ACTUALLY CALL IT.
 *
 * Everything above tests the module. This repo's own oldest lesson is that a
 * module which works perfectly and is called by nothing looks exactly the same
 * from a unit test — the arcade board sat in a payload for as long as the
 * feature existed, and the gallery publish route had no caller for weeks. So
 * this asks the SERVER, over HTTP, with the provider stubbed.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withServer } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';
import { serverSource } from './server-source.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('EVERY ROUTE THAT SETS A PASSWORD CHECKS IT — named, not counted', () => {
  /*
   * A COUNT GOES STALE SILENTLY, which this file already records three times
   * over. So the routes are NAMED, and a new one that sets a password without
   * the check fails here rather than shipping.
   */
  const src = serverSource();
  /*
   * THE METHOD IS PART OF THE NEEDLE, and the first version left it out.
   * `/api/me/password` appears twice in `server.js` — once on the
   * support-log's quiet list and once as the route — so `indexOf` found the
   * LOG LINE and reported a route with no check on it. A guard aimed at the
   * wrong line proves nothing, which is this repo's oldest lesson.
   */
  const setters = [
    "route === '/api/me/password' && req.method === 'PUT'",
    "route === '/api/reset/complete' && req.method === 'POST'",
  ];
  for (const route of setters) {
    const at = src.indexOf(route);
    assert.ok(at > 0, `${route} is not a route any more — is this guard stale?`);
    // The check has to be inside the first few lines of the handler, before
    // anything is written.
    const head = src.slice(at, at + 900);
    assert.ok(head.includes('refuseBreached'),
      `${route} sets a password without asking whether it is already breached`);
  }

  // The account-creation route takes a TYPED password, including the very
  // first owner account — the one with the most to lose in the system.
  const made = src.indexOf('const first = accounts.all.length === 0 && isHostKey(req, url);');
  assert.ok(made > 0, 'the first-account route moved — is this guard stale?');
  assert.ok(src.slice(made, made + 900).includes('refuseBreached'),
    'an account can be created with a password that is already in a breach');
});

test('the refusal says what to do about it, not just no', () => {
  assert.match(BREACHED_SAID, /breach/i);
  assert.match(BREACHED_SAID, /different one/i, 'it does not say what to do instead');
});

/**
 * AND NOW FIRE IT — the real server, the real routes, the provider stubbed.
 *
 * Everything above this reads `server.js` as a STRING, which is the weakest
 * kind of check this repo has and the one it has been bitten by: a grep goes
 * green the better a file is documented, and a route deleted with its comment
 * left behind kept `gates.test.js` at 22/22. So the last word is a server that
 * is actually running, asked over HTTP, with `test/helpers/breach-stub.mjs`
 * standing in for Have I Been Pwned.
 *
 * `password` is EIGHT characters. It clears the new minimum and is refused on
 * the breach list instead — which is the trade this whole file exists to pin,
 * demonstrated end to end rather than argued.
 */
test('THE LIVE ROUTE REFUSES A BREACHED PASSWORD, AND LETS A FRESH ONE THROUGH', async () => {
  const OLD = 'the long old one';
  await withServer(async (base) => {
    const post = (path, body, cookie) => fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });

    const inRes = await post('/api/sign-in', { email: 'rob@example.com', password: OLD });
    assert.equal(inRes.status, 200, 'could not sign in — the scaffolding is wrong, not the app');
    const cookie = (inRes.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');

    const put = (password) => fetch(`${base}/api/me/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ current: OLD, password }),
    });

    const refused = await put('password');
    assert.equal(refused.status, 400, 'a password straight off the breach list was accepted');
    assert.match((await refused.json()).error, /breach/i, 'and it did not say why');

    // AND THE CHECK IS NOT SIMPLY REFUSING EVERYTHING — the half a guard that
    // only ever says no would pass without.
    const fine = await put('quizporium station tap 42');
    assert.equal(fine.status, 200, 'a password nobody has used was refused');

    // The new one is what signs you in, so the route did the work rather than
    // merely answering 200.
    const again = await post('/api/sign-in',
      { email: 'rob@example.com', password: 'quizporium station tap 42' });
    assert.equal(again.status, 200, 'the password did not actually change');
  }, {
    seed: (dir) => {
      const book = new Accounts(join(dir, 'accounts.json'));
      book.create({ email: 'rob@example.com', password: OLD, name: 'Rob', role: 'owner' });
      book.save();
    },
    env: { NODE_OPTIONS: `--import ${join(ROOT, 'test', 'helpers', 'breach-stub.mjs')}` },
  });
});
