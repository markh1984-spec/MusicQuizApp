/**
 * A SIGN-IN LINK — the way in that is not a password.
 *
 * Asked for after the host forgot his own: *"perhaps the login can just be a
 * magic link instead?"* Built as an ADDITION rather than a replacement, and
 * that is the first thing worth writing down — this app is signed into ten
 * minutes before a gig, in a pub, on somebody else's wifi, and a way in that
 * depends on an email ARRIVING is the wrong only-way-in at exactly that
 * moment. The password box stays and stays first.
 *
 * A link is a password in an inbox, so everything true of `reset.test.js` has
 * to be true here too — and two things more, which are what this file is for:
 * a link may only be spent for the thing it was ASKED for, and it may not be
 * spent by anything but a deliberate press.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import { magicEmail } from '../src/email.js';

function book(now = () => Date.now()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magic-'));
  const accounts = new Accounts(path.join(dir, 'accounts.json'), { now });
  accounts.create({ email: 'rob@example.com', password: 'thelongoldone', name: 'Rob' });
  return { accounts, file: path.join(dir, 'accounts.json') };
}

test('a link signs you in, and the password is untouched', () => {
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com', { kind: 'magic' });
  const done = accounts.useMagic(token);
  assert.ok(done && done.token, 'a session comes back');
  assert.equal(accounts.fromToken(done.token).email, 'rob@example.com');
  // The whole difference from a reset: nothing about the account changed.
  assert.ok(accounts.signIn('rob@example.com', 'thelongoldone'), 'the password still works');
});

test('SINGLE USE — a link in an inbox is one forwarded email away from an account', () => {
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com', { kind: 'magic' });
  assert.ok(accounts.useMagic(token));
  assert.equal(accounts.useMagic(token), null, 'the second press gets nothing');
});

test('A SIGN-IN LINK MAY NOT BE SPENT AS A PASSWORD RESET, or the email lied', () => {
  /*
   * Both grant the same access in the end, so this is not a privilege
   * boundary — it is a promise about what the email SAID. A link posted as
   * "here is a way to sign in" must not also be a way to change the password
   * on that account, because the person reading it was not told it was.
   */
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com', { kind: 'magic' });
  assert.equal(accounts.useReset(token, 'somethingelselong'), null, 'refused as a reset');
  assert.ok(accounts.signIn('rob@example.com', 'thelongoldone'), 'and the password is untouched');
  assert.ok(accounts.useMagic(token), 'still good for what it WAS asked for');
});

test('and a reset link may not be spent as a sign-in either', () => {
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com');
  assert.equal(accounts.useMagic(token), null);
});

test('A TOKEN WRITTEN BEFORE `kind` EXISTED READS AS A RESET', () => {
  /*
   * A live link in somebody's inbox must not stop working because this gained
   * a field. Written straight into the book the way an older deploy left it.
   */
  const { accounts } = book();
  const { token } = accounts.startReset('rob@example.com');
  delete accounts.byEmail('rob@example.com').reset.kind;
  assert.ok(accounts.whoseReset(token), 'still a reset');
  assert.equal(accounts.useMagic(token), null, 'and never a sign-in');
});

test('THE TOKEN IS NEVER WRITTEN DOWN — only its hash', () => {
  const { accounts, file } = book();
  const { token } = accounts.startReset('rob@example.com', { kind: 'magic' });
  assert.ok(!fs.readFileSync(file, 'utf8').includes(token),
    'the accounts file is a bag of live sign-in links');
});

test('it expires, and a stale one is worth nothing', () => {
  let clock = Date.parse('2026-09-14T12:00:00Z');
  const { accounts } = book(() => clock);
  const { token } = accounts.startReset('rob@example.com', { kind: 'magic' });
  clock += 31 * 60_000;
  assert.equal(accounts.useMagic(token), null);
});

test('asking again replaces the last one rather than leaving a trail', () => {
  let clock = Date.parse('2026-09-14T12:00:00Z');
  const { accounts } = book(() => clock);
  const first = accounts.startReset('rob@example.com', { kind: 'magic' }).token;
  clock += 61_000;                                   // past the one-a-minute throttle
  const second = accounts.startReset('rob@example.com', { kind: 'magic' }).token;
  assert.notEqual(first, second);
  assert.equal(accounts.useMagic(first), null, 'the old link is dead');
  assert.ok(accounts.useMagic(second));
});

test('SIGNING IN BY LINK DOES NOT SIGN THE OTHER DEVICES OUT', () => {
  /*
   * The difference from a password reset, and deliberate. A reset means
   * "somebody may have had this, sign everything else out"; forgetting your
   * password on a phone means nothing of the kind, and signing the laptop out
   * of a console mid-gig would be this app doing damage on its own initiative.
   */
  const { accounts } = book();
  const laptop = accounts.signIn('rob@example.com', 'thelongoldone');
  const { token } = accounts.startReset('rob@example.com', { kind: 'magic' });
  accounts.useMagic(token);
  assert.ok(accounts.fromToken(laptop.token), 'the laptop is still signed in');
});

test('the email says the password is unchanged, which is the whole difference', () => {
  const mail = magicEmail({ name: "Mark's Quizporium", link: 'https://x/magic?t=abc' });
  assert.match(mail.subject, /sign-in link/i);
  assert.ok(mail.text.includes('https://x/magic?t=abc'));
  assert.match(mail.text, /password is not changed/i);
});
