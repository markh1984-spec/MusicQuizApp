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
import { sendEmail, emailConfigured, emailProvider, fromAddress, keepKeyAlive, resetEmail } from '../src/email.js';

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
  const before = { ...process.env };
  delete process.env.BREVO_API_KEY;
  delete process.env.RESEND_API_KEY;
  assert.equal(emailProvider(), '');
  assert.equal(emailConfigured(), false);
  const out = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' });
  assert.equal(out.ok, false);
  assert.equal(out.unconfigured, true, 'said plainly, so the page can say so rather than offering a dead button');
  Object.assign(process.env, before);
});

test('NOBODY PICKS A PROVIDER ON A BUTTON — whichever key is set is used', () => {
  // Same rule `artProvider()` follows for the picture round. Brevo wins when
  // both are set, because it is the one that can hold this app own sending
  // domain for nothing.
  delete process.env.BREVO_API_KEY;
  delete process.env.RESEND_API_KEY;
  assert.equal(emailProvider(), '');
  process.env.RESEND_API_KEY = 'r';
  assert.equal(emailProvider(), 'resend');
  process.env.BREVO_API_KEY = 'b';
  assert.equal(emailProvider(), 'brevo');
  delete process.env.BREVO_API_KEY;
  delete process.env.RESEND_API_KEY;
});

test('the request BREVO gets is the shape Brevo wants', async () => {
  // Pinned against a stub because this container egress reaches neither
  // provider — "it worked when I tried it" is not available here.
  delete process.env.RESEND_API_KEY;
  process.env.BREVO_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'Quizporium <no-reply@quizporium.co.uk>';
  let seen = null;
  const fetchImpl = async (url, options) => {
    seen = { url, options };
    return { ok: true, json: async () => ({ messageId: '<abc@brevo>' }) };
  };
  const out = await sendEmail({ to: 'rob@example.com', subject: 'Hello', text: 'A link' }, { fetchImpl });
  assert.equal(out.ok, true);
  assert.equal(out.provider, 'brevo');
  assert.equal(seen.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(seen.options.headers['api-key'], 'test-key', 'a bare api-key header, NOT a bearer token');
  const body = JSON.parse(seen.options.body);
  assert.deepEqual(body.sender, { name: 'Quizporium', email: 'no-reply@quizporium.co.uk' },
    'Brevo wants the name and the address apart');
  assert.deepEqual(body.to, [{ email: 'rob@example.com' }], 'and recipients as objects');
  assert.equal(body.textContent, 'A link', 'textContent, not text');
  delete process.env.BREVO_API_KEY;
  delete process.env.EMAIL_FROM;
});

test('the request RESEND gets is the shape Resend wants', async () => {
  delete process.env.BREVO_API_KEY;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'Quizporium <no-reply@quizporium.co.uk>';
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
  assert.deepEqual(body.to, ['rob@example.com'], 'an ARRAY of plain strings — the opposite of Brevo');
  assert.equal(body.from, 'Quizporium <no-reply@quizporium.co.uk>', 'and the two halves back together');
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

test('A REFUSAL IS EXPLAINED, not swallowed', async () => {
  // The commonest failure setting this up by a mile is a sending domain that
  // has not been authenticated, and a bare 403 sends you looking at the key.
  process.env.BREVO_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'x@y.z';
  const refuse = (status, payload) => async () => ({ ok: false, status, json: async () => payload });

  const badKey = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' },
    { fetchImpl: refuse(401, { message: 'Key not found' }) });
  assert.match(badKey.reason, /BREVO_API_KEY/, 'points at the right key by name');

  const badDomain = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' },
    { fetchImpl: refuse(400, { message: 'Sender domain is not verified' }) });
  assert.match(badDomain.reason, /authenticated with brevo/i, 'names the real cause');

  const dead = await sendEmail({ to: 'a@b.c', subject: 'x', text: 'y' },
    { fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND'); } });
  assert.equal(dead.ok, false);
  assert.match(dead.reason, /Could not reach/, 'and a network failure never throws');

  delete process.env.BREVO_API_KEY;
  delete process.env.EMAIL_FROM;
});

test('the from address is split, and falls back to the app own domain', () => {
  const before = { ...process.env };
  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_FROM;
  process.env.PUBLIC_URL = 'https://quizporium.co.uk';
  assert.deepEqual(fromAddress(), { name: 'Quizporium', email: 'no-reply@quizporium.co.uk' });

  process.env.EMAIL_FROM = 'bare@example.com';
  assert.deepEqual(fromAddress(), { name: '', email: 'bare@example.com' }, 'a bare address is fine');

  // RESEND_FROM was the name before there were two providers. A live server may
  // still have it set, and quietly ignoring it would be a silent outage on the
  // one feature whose whole job is getting somebody back in.
  delete process.env.EMAIL_FROM;
  process.env.RESEND_FROM = 'Old Name <old@example.com>';
  assert.deepEqual(fromAddress(), { name: 'Old Name', email: 'old@example.com' });

  delete process.env.RESEND_FROM;
  delete process.env.PUBLIC_URL;
  assert.deepEqual(fromAddress(), { name: '', email: '' },
    'and with nothing to go on it says so rather than inventing a domain');
  Object.assign(process.env, before);
});

/*
 * KEEPING THE KEY ALIVE.
 *
 * Brevo expires an API key after 90 DAYS OF INACTIVITY whatever expiry was set
 * on it. This app sends about five password resets a year, so the key would go
 * ninety days idle and die quietly — to be found on the one evening somebody is
 * locked out and in a hurry, which is the exact failure this was built to
 * prevent. One trivial authenticated call at boot and weekly is activity
 * without sending anything.
 */

test('the keep-alive asks the cheapest thing the key can do', async () => {
  process.env.BREVO_API_KEY = 'test-key';
  let seen = null;
  const fetchImpl = async (url, options) => { seen = { url, options }; return { ok: true, json: async () => ({}) }; };
  assert.equal((await keepKeyAlive({ fetchImpl })).ok, true);
  assert.equal(seen.url, 'https://api.brevo.com/v3/account', 'no email, no contact, nothing created');
  assert.equal(seen.options.headers['api-key'], 'test-key');
  assert.equal(seen.options.method, undefined, 'a GET');
  delete process.env.BREVO_API_KEY;
});

test('the keep-alive does nothing at all on Resend, which has no idle rule', async () => {
  delete process.env.BREVO_API_KEY;
  process.env.RESEND_API_KEY = 'r';
  let called = false;
  const out = await keepKeyAlive({ fetchImpl: async () => { called = true; return { ok: true, json: async () => ({}) }; } });
  assert.equal(called, false);
  assert.equal(out.skipped, true);
  delete process.env.RESEND_API_KEY;
});

test('and it NEVER throws, whatever the network does', async () => {
  // A mail provider having a bad morning has nothing to do with whether a quiz
  // can run tonight, and this runs at boot.
  process.env.BREVO_API_KEY = 'test-key';
  const out = await keepKeyAlive({ fetchImpl: async () => { throw new Error('ENOTFOUND'); } });
  assert.equal(out.ok, false);
  const refused = await keepKeyAlive({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Key not found' }) }) });
  assert.match(refused.reason, /BREVO_API_KEY/, 'and still names the cause');
  delete process.env.BREVO_API_KEY;
});

/*
 * WHAT THE EMAIL SAYS.
 *
 * The first one that actually went out said "Set a new password for
 * undefined", because the route read `.name` off a function that returns a
 * string. An email with `undefined` in the subject is a phishing email as far
 * as anybody reading it is concerned — and it is the one message this app
 * sends to somebody already locked out and already unsure.
 */

test('the reset email never says undefined, whatever it is handed', () => {
  for (const name of [undefined, null, '', '   ', 'Mark\'s Quizporium']) {
    const mail = resetEmail({ name, link: 'https://quizporium.co.uk/reset?t=abc' });
    assert.ok(!/undefined|null|\[object/.test(mail.subject), `subject: ${mail.subject}`);
    assert.ok(!/undefined|null|\[object/.test(mail.text), `body: ${mail.text}`);
    assert.match(mail.subject, /Set a new password for \S/);
  }
});

test('it carries the quizmaster own brand, and the link, written out', () => {
  const mail = resetEmail({ name: "Mark's Quizporium", link: 'https://quizporium.co.uk/reset?t=abc' });
  assert.equal(mail.subject, "Set a new password for Mark's Quizporium");
  assert.ok(mail.text.includes("Mark's Quizporium"));
  // Written out rather than hidden behind a button: it is a password reset, and
  // people are told to look at the address before they click one.
  assert.ok(mail.text.includes('https://quizporium.co.uk/reset?t=abc'));
  assert.match(mail.text, /works once/);
  assert.match(mail.text, /If it was not you/);
});

test('with nothing to go on it falls back to the app name', () => {
  assert.equal(resetEmail({ link: 'x' }).subject, 'Set a new password for Quizporium');
});
