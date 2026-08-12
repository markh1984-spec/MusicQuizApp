/**
 * Resetting a forgotten password.
 *
 * It exists because there was NO WAY BACK IN: a password is only ever a scrypt
 * hash so nobody can be told what theirs was, the reset route needs an account
 * id, an owner's own account is not in the subscriber list so even the host key
 * cannot find that id, and Render's free tier has no shell.
 *
 * Everything here is a security property rather than a nicety. A reset link is
 * a password in an inbox: whatever is true of one has to be true of the other.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import { sendEmail, emailConfigured, fromAddress } from '../src/email.js';

function book(now = () => Date.now()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-'));
  const accounts = new Accounts(path.join(dir, 'accounts.json'), { now });
  accounts.create({ email: 'rob@example.com', password: 'thelongoldone', name: 'Rob' });
  return { accounts, dir, file: path.join(dir, 'accounts.json') };
}

test('a link sets a new password, and the old one stops working', () => {
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com');
  assert.ok(token, 'a token comes back once');
  assert.ok(accounts.useReset(token, 'abrandnewlongone'));
  assert.equal(accounts.signIn('rob@example.com', 'thelongoldone'), null, 'the old password is dead');
  assert.ok(accounts.signIn('rob@example.com', 'abrandnewlongone'), 'and the new one works');
});

test('THE TOKEN IS NEVER WRITTEN DOWN — only its hash', () => {
  // A copy of the accounts file must not be a bag of live reset links, exactly
  // as it is not a bag of live sessions.
  const { accounts, file } = book();
  const { token } = accounts.startReset('rob@example.com');
  const onDisk = fs.readFileSync(file, 'utf8');
  assert.ok(!onDisk.includes(token), 'the token itself is not in the file');
  assert.match(onDisk, /"reset"/, 'but something about the reset is');
});

test('A LINK WORKS ONCE', () => {
  // Otherwise it sits in an inbox for ever, one forwarded email away from
  // being somebody else's way into the account.
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com');
  assert.ok(accounts.useReset(token, 'abrandnewlongone'));
  assert.equal(accounts.useReset(token, 'athirdpasswordhere'), null, 'the second go finds nothing');
  assert.ok(accounts.signIn('rob@example.com', 'abrandnewlongone'), 'and the first change stood');
});

test('a link runs out', () => {
  let clock = 1_000_000;
  const { accounts } = book(() => clock);
  const { token } = accounts.startReset('rob@example.com', { minutes: 30 });
  clock += 31 * 60_000;
  assert.equal(accounts.whoseReset(token), null, 'expired');
  assert.equal(accounts.useReset(token, 'abrandnewlongone'), null);
  assert.ok(accounts.signIn('rob@example.com', 'thelongoldone'), 'and the old password is untouched');
});

test('asking again replaces the last link rather than leaving a trail', () => {
  let clock = 1_000_000;
  const { accounts } = book(() => clock);
  const first = accounts.startReset('rob@example.com').token;
  clock += 120_000;                       // past the cooldown
  const second = accounts.startReset('rob@example.com').token;
  assert.notEqual(first, second);
  assert.equal(accounts.whoseReset(first), null, 'the older link is dead');
  assert.ok(accounts.whoseReset(second));
});

test('a held-down button cannot post somebody a hundred emails', () => {
  let clock = 1_000_000;
  const { accounts } = book(() => clock);
  assert.ok(accounts.startReset('rob@example.com').token);
  const again = accounts.startReset('rob@example.com');
  assert.equal(again.throttled, true, 'inside a minute it is throttled');
  assert.equal(again.token, undefined, 'and no new token is minted, so nothing is sent');
  clock += 61_000;
  assert.ok(accounts.startReset('rob@example.com').token, 'a minute later it is fine');
});

test('AN UNKNOWN ADDRESS IS NOT TOLD IT IS UNKNOWN', () => {
  // `startReset` answers null and the ROUTE says the same sentence either way.
  // Anything else turns this into a way to ask who has a login here — the one
  // thing the sign-in page carefully refuses to be.
  const { accounts } = book();
  assert.equal(accounts.startReset('nobody@example.com'), null);
});

test('a forged or empty token finds nothing', () => {
  const { accounts } = book();
  accounts.startReset('rob@example.com');
  assert.equal(accounts.whoseReset(''), null);
  assert.equal(accounts.whoseReset('made-up'), null);
  assert.equal(accounts.useReset('made-up', 'abrandnewlongone'), null);
});

test('resetting signs out everything already signed in as them', () => {
  // Somebody resetting a password is usually somebody worried, and
  // half-logged-out is no use to them.
  const { accounts } = book();
  const session = accounts.signIn('rob@example.com', 'thelongoldone');
  assert.ok(accounts.fromToken(session.token));
  const { token } = accounts.startReset('rob@example.com');
  accounts.useReset(token, 'abrandnewlongone');
  assert.equal(accounts.fromToken(session.token), null);
});

test('a too-short password is refused, and the link is NOT spent', () => {
  // Otherwise a typo costs somebody the only way back into their account.
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com');
  assert.throws(() => accounts.useReset(token, 'short'));
  assert.ok(accounts.whoseReset(token), 'the link still works');
  assert.ok(accounts.useReset(token, 'aproperlongone'));
});

test('a reset survives a restart, because it lives on the ACCOUNT', () => {
  // On a host with no permanent disk the accounts file is what comes back from
  // the backup. A token kept anywhere else would die on the restart that is
  // quite likely to be why somebody is signing in again in the first place.
  const { accounts, file } = book();
  const { token } = accounts.startReset('rob@example.com');
  const revived = new Accounts(file);
  assert.ok(revived.whoseReset(token));
  assert.ok(revived.useReset(token, 'abrandnewlongone'));
});

/* ---- the mailer ------------------------------------------------------- */

test('with no key configured, email is a STATE rather than a failure', async () => {
  const before = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  assert.equal(emailConfigured(), false);
  const out = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' });
  assert.equal(out.ok, false);
  assert.equal(out.unconfigured, true, 'said plainly, so the page can say so rather than offering a dead button');
  if (before) process.env.RESEND_API_KEY = before;
});

test('the request Resend gets is the shape Resend wants', async () => {
  // Pinned against a stub because this container's egress does not reach
  // Resend — "it worked when I tried it" is not available here.
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM = 'Quizporium <no-reply@quizporium.co.uk>';
  let seen = null;
  const fetchImpl = async (url, options) => {
    seen = { url, options };
    return { ok: true, json: async () => ({ id: 'abc' }) };
  };
  const out = await sendEmail({ to: 'rob@example.com', subject: 'Hello', text: 'A link' }, { fetchImpl });
  assert.equal(out.ok, true);
  assert.equal(seen.url, 'https://api.resend.com/emails');
  assert.equal(seen.options.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(seen.options.body);
  assert.deepEqual(body.to, ['rob@example.com'], 'an ARRAY — Resend refuses a bare string');
  assert.equal(body.from, 'Quizporium <no-reply@quizporium.co.uk>');
  assert.equal(body.subject, 'Hello');
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

test('A REFUSAL IS EXPLAINED, not swallowed', async () => {
  // The commonest failure setting this up by a mile is a sending domain that
  // has not been verified, and a bare 403 sends you looking at the key.
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM = 'x@y.z';
  const refuse = (status, payload) => async () => ({ ok: false, status, json: async () => payload });

  const badKey = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' }, { fetchImpl: refuse(401, { message: 'API key is invalid' }) });
  assert.match(badKey.reason, /RESEND_API_KEY/, 'points at the key');

  const badDomain = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' },
    { fetchImpl: refuse(403, { message: 'The quizporium.co.uk domain is not verified' }) });
  assert.match(badDomain.reason, /verified/i, 'names the real cause');

  const dead = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' },
    { fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND'); } });
  assert.equal(dead.ok, false);
  assert.match(dead.reason, /Could not reach/, 'and a network failure never throws');

  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

test('the from address falls back to the app own domain', () => {
  const before = process.env.PUBLIC_URL;
  delete process.env.RESEND_FROM;
  process.env.PUBLIC_URL = 'https://quizporium.co.uk';
  assert.equal(fromAddress(), 'Quizporium <no-reply@quizporium.co.uk>');
  delete process.env.PUBLIC_URL;
  assert.equal(fromAddress(), '', 'and with nothing to go on it says so rather than inventing a domain');
  if (before) process.env.PUBLIC_URL = before;
});
