/**
 * Accounts.
 *
 * Three things are worth being certain about: a password is never recoverable
 * from what is stored, a session cannot be forged, and a failed payment cannot
 * black out a projector in front of a room.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts, verify, hashPassword, checkPassword, normaliseEmail, safe } from '../src/accounts.js';
import { FEATURES } from '../public/assets/plans.js';

const AT = Date.parse('2026-08-07T20:00:00.000Z');

function withBook(fn, now = () => AT) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-'));
  try {
    return fn(new Accounts(path.join(dir, 'accounts.json'), { now }), path.join(dir, 'accounts.json'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const PASSWORD = 'a horse walked into a pub';

// ----------------------------------------------------------------- passwords

test('a password is stored as a hash and a salt, never as itself', () => {
  withBook((book, file) => {
    book.create({ email: 'Mark@Example.com ', password: PASSWORD, name: 'Mark', role: 'owner' });
    const raw = fs.readFileSync(file, 'utf8');
    assert.equal(raw.includes(PASSWORD), false, 'the password must not be in the file');
    assert.ok(raw.includes('"hash"') && raw.includes('"salt"'));
  });
});

test('two accounts with the same password get different hashes', () => {
  const a = hashPassword(PASSWORD);
  const b = hashPassword(PASSWORD);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash, 'a shared salt would let one crack reveal both');
  assert.equal(verify({ ...a }, PASSWORD), true);
  assert.equal(verify({ ...b }, PASSWORD), true);
});

test('a wrong password is refused, and so is a corrupted record', () => {
  const stored = hashPassword(PASSWORD);
  assert.equal(verify(stored, 'a horse walked into a bar'), false);
  assert.equal(verify(stored, ''), false);
  assert.equal(verify(stored, undefined), false);
  assert.equal(verify({ hash: 'nonsense', salt: stored.salt }, PASSWORD), false);
  assert.equal(verify(null, PASSWORD), false);
});

test('a short password is refused, with a suggestion rather than a rule', () => {
  assert.throws(() => checkPassword('short'), /at least 10 characters/);
  assert.throws(() => checkPassword(''), /at least 10 characters/);
  assert.equal(checkPassword(PASSWORD), true);
  // No punctuation rules: they get written on the laptop lid.
  assert.equal(checkPassword('correct horse battery'), true);
});

test('the hash never leaves the building, even to the owner', () => {
  withBook((book) => {
    const account = book.create({ email: 'a@b.com', password: PASSWORD });
    assert.equal(account.hash, undefined);
    assert.equal(account.salt, undefined);
    assert.equal(book.view(account).hash, undefined);
    assert.equal(safe({ id: '1', hash: 'x', salt: 'y', scrypt: {}, email: 'a' }).hash, undefined);
  });
});

// ------------------------------------------------------------------ accounts

test('an email address is one address however it was typed', () => {
  assert.equal(normaliseEmail('  Mark@Example.COM '), 'mark@example.com');
  withBook((book) => {
    book.create({ email: 'mark@example.com', password: PASSWORD });
    assert.throws(() => book.create({ email: ' MARK@example.com ', password: PASSWORD }), /already an account/);
    assert.ok(book.byEmail('Mark@Example.com'));
  });
});

test('there can only ever be one owner', () => {
  withBook((book) => {
    book.create({ email: 'owner@example.com', password: PASSWORD, role: 'owner' });
    assert.throws(() => book.create({ email: 'other@example.com', password: PASSWORD, role: 'owner' }), /already an owner/);
    // A quizmaster is fine, as many as you like.
    book.create({ email: 'dave@example.com', password: PASSWORD });
    book.create({ email: 'sue@example.com', password: PASSWORD });
    assert.equal(book.all.filter((a) => a.role === 'quizmaster').length, 2);
  });
});

test('rubbish is refused rather than stored', () => {
  withBook((book) => {
    assert.throws(() => book.create({ email: 'not-an-email', password: PASSWORD }), /does not look like an email/);
    assert.throws(() => book.create({ email: 'a@b.com', password: PASSWORD, role: 'wizard' }), /is not a role/);
    assert.throws(() => book.create({ email: 'a@b.com', password: PASSWORD, plan: 'gold' }), /is not a plan/);
    assert.throws(() => book.create({ email: 'a@b.com', password: PASSWORD, status: 'maybe' }), /is not a subscription status/);
    assert.equal(book.all.length, 0);
  });
});

test('an owner account has no subscription to change', () => {
  withBook((book) => {
    const owner = book.create({ email: 'owner@example.com', password: PASSWORD, role: 'owner' });
    assert.equal(owner.plan, undefined);
    assert.equal(owner.status, undefined);
    assert.throws(() => book.update(owner.id, { status: 'past_due' }), /no subscription/);
    assert.throws(() => book.close(owner.id), /cannot be closed/);
  });
});

// ------------------------------------------------------------------ signing in

test('signing in gives a token that identifies the account', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, name: 'Dave' });
    const session = book.signIn('DAVE@example.com', PASSWORD);
    assert.ok(session.token);
    assert.equal(session.account.id, made.id);
    assert.equal(book.fromToken(session.token).id, made.id);
  });
});

test('a wrong password and an unknown address both just fail', () => {
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    assert.equal(book.signIn('dave@example.com', 'wrong password here'), null);
    assert.equal(book.signIn('nobody@example.com', PASSWORD), null);
  });
});

test('only the hash of a token is stored, so the file is not a set of live logins', () => {
  withBook((book, file) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const { token } = book.signIn('dave@example.com', PASSWORD);
    assert.equal(fs.readFileSync(file, 'utf8').includes(token), false);
  });
});

test('a made-up token is nobody', () => {
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    book.signIn('dave@example.com', PASSWORD);
    assert.equal(book.fromToken('made-up'), null);
    assert.equal(book.fromToken(''), null);
    assert.equal(book.fromToken(null), null);
  });
});

test('a session runs out, and an expired one is nobody', () => {
  let now = AT;
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const { token } = book.signIn('dave@example.com', PASSWORD);
    now = AT + 29 * 86_400_000;
    assert.ok(book.fromToken(token), 'still signed in after 29 days');
    now = AT + 31 * 86_400_000;
    assert.equal(book.fromToken(token), null, 'and not after 31');
  }, () => now);
});

test('signing out ends that session and only that one', () => {
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const phone = book.signIn('dave@example.com', PASSWORD);
    const laptop = book.signIn('dave@example.com', PASSWORD);
    book.signOut(phone.token);
    assert.equal(book.fromToken(phone.token), null);
    assert.ok(book.fromToken(laptop.token), 'the laptop is still signed in');
  });
});

test('changing a password signs everything out', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    const phone = book.signIn('dave@example.com', PASSWORD);
    const laptop = book.signIn('dave@example.com', PASSWORD);

    assert.throws(() => book.setPassword(made.id, 'a new long password', { requireOld: 'wrong one here' }), /not your current password/);
    book.setPassword(made.id, 'a new long password', { requireOld: PASSWORD });

    assert.equal(book.fromToken(phone.token), null, 'half signed out is no use to somebody worried');
    assert.equal(book.fromToken(laptop.token), null);
    assert.equal(book.signIn('dave@example.com', PASSWORD), null);
    assert.ok(book.signIn('dave@example.com', 'a new long password'));
  });
});

test('accounts and sessions survive a restart', () => {
  withBook((book, file) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const { token } = book.signIn('dave@example.com', PASSWORD);

    const reopened = new Accounts(file, { now: () => AT });
    assert.equal(reopened.all.length, 1);
    assert.ok(reopened.fromToken(token), 'a redeploy must not sign everybody out mid-week');
  });
});

test('an unreadable accounts file is kept, never overwritten', () => {
  withBook((book, file) => {
    fs.writeFileSync(file, '{ not json at all');
    const reopened = new Accounts(file, { now: () => AT });
    assert.deepEqual(reopened.all, []);
    assert.equal(fs.existsSync(file + '.broken'), true);
  });
});

// ------------------------------------------------------- the gate on the night

test('a failed payment never blacks out a live projector', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'active' });
    const account = book.view(book.find(made.id));
    assert.equal(book.mayStartSomething(account, FEATURES.QUIZ), true);

    // The card expires on the Tuesday. It is now Wednesday, and there are
    // ninety people in the room.
    book.update(made.id, { status: 'past_due' });
    const lapsed = safe(book.find(made.id));

    assert.equal(book.mayStartSomething(lapsed, FEATURES.QUIZ), false, 'no NEW night starts');
    assert.equal(book.mayCarryOn(lapsed, FEATURES.QUIZ), true, 'but the one already running carries on');
    assert.equal(book.mayCarryOn(lapsed, FEATURES.BINGO), true);
  });
});

test('carrying on is not a way round the paywall', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'past_due' });
    const lapsed = safe(book.find(made.id));
    // Never had the add-on, so a lapse does not hand it over.
    assert.equal(book.mayCarryOn(lapsed, FEATURES.INVOICES), false);
    assert.equal(book.mayCarryOn(lapsed, FEATURES.GENERATE), false);
    assert.equal(book.mayCarryOn(lapsed, FEATURES.STREAM), false);
  });
});

test('closing an account keeps the record', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'active' });
    const { token } = book.signIn('dave@example.com', PASSWORD);
    book.close(made.id);
    assert.equal(book.find(made.id).status, 'cancelled');
    assert.equal(book.all.length, 1, 'their invoices and packs still belong to somebody');
    assert.equal(book.fromToken(token), null, 'but they are signed out');
  });
});

// --------------------------------------------------------------- support access

test('support access is theirs to grant, and it runs out on its own', () => {
  let now = AT;
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    assert.equal(book.supportOpen(made.id), false, 'shut unless they open it');

    book.openSupport(made.id, 24);
    assert.equal(book.supportOpen(made.id), true);

    now = AT + 25 * 3_600_000;
    assert.equal(book.supportOpen(made.id), false, 'nobody has to remember to close it');
  }, () => now);
});

test('what was done while inside is written down for them to read', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    book.openSupport(made.id);
    book.noteSupport(made.id, 'Opened the 1990s quiz to look at round 2');
    book.noteSupport(made.id, 'Fixed the answer on question 7');

    const log = book.find(made.id).support.log;
    assert.equal(log.length, 2);
    assert.match(log[1].what, /Fixed the answer/);
    assert.ok(log[0].at);
  });
});

test('support can be shut early, and the log survives it', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    book.openSupport(made.id);
    book.noteSupport(made.id, 'had a look');
    book.closeSupport(made.id);
    assert.equal(book.supportOpen(made.id), false);
    assert.equal(book.find(made.id).support.log.length, 1);
  });
});

// ---------------------------------------------------------------- the payments

test('an account carries a payment reference and nothing else', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    book.update(made.id, { billing: { customerRef: 'cus_123', processor: 'stripe' } });
    const account = book.find(made.id);
    assert.equal(account.billing.customerRef, 'cus_123');
    // Swapping processor must never need a migration, so nothing else is stored.
    assert.deepEqual(Object.keys(account.billing).sort(), ['customerRef', 'processor']);
  });
});

test('add-ons can be bought and dropped', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'active' });
    book.update(made.id, { addons: ['admin', 'nonsense'] });
    assert.deepEqual(book.find(made.id).addons, ['admin'], 'a made-up add-on is dropped');
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.INVOICES), true);
    book.update(made.id, { addons: [] });
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.INVOICES), false);
  });
});
