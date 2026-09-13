/**
 * WHO IS DUE A TRIAL NOTICE — and the four accounts that must never get one.
 *
 * `src/trials.js` holds no clock and sends nothing, which is the whole reason
 * this file can pin the behaviour without a timer or a mail provider. The SWEEP
 * is `server.js`'s and is checked over HTTP in `test/trial-emails.test.js`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { WARN_DAYS, onTrial, dueWarning, dueEnded, daysLeft, endsAt } from '../src/trials.js';

const NOW = Date.parse('2026-09-13T12:00:00.000Z');
const inDays = (n) => new Date(NOW + n * 86_400_000).toISOString();

const trialing = (over = {}) => ({
  id: `a${Math.random()}`.slice(0, 8),
  email: 'rob@example.com',
  role: 'quizmaster',
  status: 'trialing',
  tier: 'bronze',
  trialEndsAt: inDays(2),
  ...over,
});

test('somebody three days out is warned, and somebody with a fortnight is not', () => {
  const soon = trialing({ trialEndsAt: inDays(WARN_DAYS - 0.5) });
  const later = trialing({ trialEndsAt: inDays(WARN_DAYS + 4) });
  assert.deepEqual(dueWarning([soon, later], NOW).map((a) => a.trialEndsAt), [soon.trialEndsAt]);
});

test('the day it runs out, the warning stops and the ended notice starts', () => {
  const gone = trialing({ trialEndsAt: inDays(-1) });
  assert.deepEqual(dueWarning([gone], NOW), [], 'no point warning about something that has happened');
  assert.equal(dueEnded([gone], NOW).length, 1);
});

test('and neither goes twice — the mark on the account is what stops it', () => {
  /*
   * EVERY PUSH IS A DEPLOY AND EVERY DEPLOY IS A BOOT, so the sweep runs several
   * times on a busy Monday. Without this a quizmaster gets one notice per push.
   */
  const warned = trialing({ trialWarnedAt: inDays(-1) });
  assert.deepEqual(dueWarning([warned], NOW), []);
  const told = trialing({ trialEndsAt: inDays(-2), trialEndedAt: inDays(-1) });
  assert.deepEqual(dueEnded([told], NOW), []);
});

test('a warning having gone is NOT a precondition for the ended notice', () => {
  /*
   * Somebody who signed up eleven days before a deploy that happened after their
   * trial ended never got a warning. The second email is the useful one anyway:
   * it is the one that says what to do about it.
   */
  const neverWarned = trialing({ trialEndsAt: inDays(-3) });
  assert.equal(dueEnded([neverWarned], NOW).length, 1);
});

test('FOUR ACCOUNTS ARE NEVER TOLD ANYTHING, and each is a real case', () => {
  const owner = trialing({ role: 'owner' });
  assert.equal(onTrial(owner), false, 'the owner has no subscription');

  const paying = trialing({ status: 'active' });
  assert.equal(onTrial(paying), false, 'somebody paying is a different conversation');
  const lapsed = trialing({ status: 'past_due' });
  assert.equal(onTrial(lapsed), false, 'and so is a lapse — applyBilling owns that');

  const comped = trialing({ comped: true });
  assert.equal(onTrial(comped), false, 'on the house by decision');

  /*
   * THE SEAT IS THE ONE WORTH THE TEST. A group seat carries its PARENT'S
   * trialEndsAt through effective(), so without the parentId check a company of
   * five gets five copies of one warning and four go to people who cannot act on
   * it — their standing is not theirs to fix.
   */
  const seat = trialing({ parentId: 'parent-1' });
  assert.equal(onTrial(seat), false, 'a seat holds its parent’s standing');

  assert.deepEqual(dueWarning([owner, paying, lapsed, comped, seat], NOW), []);
  assert.deepEqual(dueEnded([owner, paying, lapsed, comped, seat], NOW), []);
});

test('an account with no trial clock at all is left alone', () => {
  assert.equal(onTrial(trialing({ trialEndsAt: '' })), false);
  assert.equal(endsAt({ trialEndsAt: 'not a date' }), 0);
  assert.deepEqual(dueWarning([trialing({ trialEndsAt: 'rubbish' })], NOW), []);
  assert.deepEqual(dueEnded([trialing({ trialEndsAt: 'rubbish' })], NOW), []);
});

test('the days left round UP, so a day and a half never reads as one', () => {
  /*
   * Rounding down prints "ends in 1 day" to somebody with thirty hours — the app
   * being wrong in the direction that costs them the chance to act.
   */
  assert.equal(daysLeft(trialing({ trialEndsAt: inDays(1.5) }), NOW), 2);
  assert.equal(daysLeft(trialing({ trialEndsAt: inDays(0.1) }), NOW), 1, 'and never below one');
  assert.equal(daysLeft(trialing({ trialEndsAt: inDays(-1) }), NOW), 0, 'except when it has gone');
});

test('nothing is passed a list it cannot read', () => {
  assert.deepEqual(dueWarning(null, NOW), []);
  assert.deepEqual(dueEnded(undefined, NOW), []);
  assert.equal(onTrial(null), false);
});
