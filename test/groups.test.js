/**
 * Group accounts — a quizmaster company or a pub group, seats under a
 * parent. A parent is DERIVED, never stored: it is simply any account at
 * least one other account points at via `parentId`. See CLAUDE.md's
 * Owner/Parent/Child section and `docs/business/groups.md`.
 *
 * Three things worth being certain about: a seat gets its parent's tier
 * (minus streaming, the one settled exception), the scoping cannot be
 * tricked into crossing into somebody else's group, and removing a seat is
 * never destructive — the account, its room and its own packs survive.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import { FEATURES, can, featuresFor } from '../public/assets/plans.js';

const AT = Date.parse('2026-08-20T20:00:00.000Z');
const PASSWORD = 'a horse walked into a pub';

function withBook(fn, now = () => AT) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groups-'));
  try {
    return fn(new Accounts(path.join(dir, 'accounts.json'), { now }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function makeParent(book, { tier = 'gold', status = 'active', comped = false } = {}) {
  const p = book.create({ email: 'rob@example.com', password: PASSWORD, name: 'Rob', tier, status, comped });
  return p;
}

// --------------------------------------------------------------- structure

test('addChild creates a real quizmaster account with parentId set', () => {
  withBook((book) => {
    const parent = makeParent(book);
    const child = book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' });
    assert.equal(child.parentId, parent.id);
    assert.equal(child.role, 'quizmaster');
    assert.equal(child.name, 'Dave');
    // A real, ordinary account — it can sign in on its own.
    assert.ok(book.signIn('dave@example.com', PASSWORD));
  });
});

test('childrenOf / parentOf agree with each other', () => {
  withBook((book) => {
    const parent = makeParent(book);
    const a = book.addChild(parent.id, { email: 'a@example.com', password: PASSWORD, name: 'A' });
    const b = book.addChild(parent.id, { email: 'b@example.com', password: PASSWORD, name: 'B' });
    const kids = book.childrenOf(parent.id);
    assert.deepEqual(kids.map((k) => k.id).sort(), [a.id, b.id].sort());
    assert.equal(book.parentOf(a.id).id, parent.id);
    assert.equal(book.parentOf(parent.id), null, 'the parent has no parent of its own');
  });
});

test('an ordinary account with no children is not a parent of anybody', () => {
  withBook((book) => {
    const solo = book.create({ email: 'solo@example.com', password: PASSWORD, name: 'Solo', tier: 'silver', status: 'active' });
    assert.deepEqual(book.childrenOf(solo.id), []);
  });
});

test('a seat cannot itself become a parent — no nesting', () => {
  withBook((book) => {
    const parent = makeParent(book);
    const child = book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' });
    assert.throws(
      () => book.addChild(child.id, { email: 'grandchild@example.com', password: PASSWORD, name: 'X' }),
      /nesting/i,
    );
  });
});

test('the owner role cannot be made a group seat', () => {
  withBook((book) => {
    const parent = makeParent(book);
    assert.throws(() => book.create({
      email: 'x@example.com', password: PASSWORD, role: 'owner', parentId: parent.id,
    }), /quizmaster/i);
  });
});

test('a group cannot be run by anybody other than a quizmaster', () => {
  withBook((book) => {
    const owner = book.create({ email: 'owner@example.com', password: PASSWORD, name: 'Owner', role: 'owner' });
    assert.throws(
      () => book.addChild(owner.id, { email: 'x@example.com', password: PASSWORD, name: 'X' }),
      /quizmaster/i,
    );
  });
});

// -------------------------------------------------------------- non-destructive removal

test('removeChild is never destructive — the account survives, just on its own', () => {
  withBook((book) => {
    const parent = makeParent(book);
    const child = book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' });
    const removed = book.removeChild(child.id);
    assert.equal(removed.parentId, undefined);
    assert.equal(removed.name, 'Dave', 'nothing else about the account changed');
    assert.deepEqual(book.childrenOf(parent.id), []);
    // Still a real, signed-in-able account.
    assert.ok(book.signIn('dave@example.com', PASSWORD));
  });
});

test('removeChild on somebody who is not a seat is a no-op, not an error', () => {
  withBook((book) => {
    const solo = book.create({ email: 'solo@example.com', password: PASSWORD, name: 'Solo' });
    assert.equal(book.removeChild(solo.id), null);
  });
});

// -------------------------------------------------------------------- effective()

test('effective() substitutes a child\'s tier/status/comped for its parent\'s', () => {
  withBook((book) => {
    const parent = makeParent(book, { tier: 'gold', status: 'active', comped: false });
    const child = book.find(book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' }).id);
    const eff = book.effective(child);
    assert.equal(eff.tier, 'gold');
    assert.equal(eff.status, 'active');
    assert.equal(eff.id, child.id, 'still the CHILD\'s own identity');
    assert.equal(eff.email, 'dave@example.com');
  });
});

test('effective() is a no-op for an ordinary account', () => {
  withBook((book) => {
    const solo = book.find(book.create({ email: 'solo@example.com', password: PASSWORD, name: 'Solo', tier: 'silver', status: 'active' }).id);
    assert.equal(book.effective(solo), solo, 'the exact same object, not even a copy');
  });
});

test('effective() falls back to the child\'s own standing if the parent has vanished', () => {
  withBook((book) => {
    const parent = makeParent(book);
    const child = book.find(book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' }).id);
    // Simulate the parent record having gone missing (data corruption, or a
    // close() that should have cleared the link but did not).
    child.parentId = 'not-a-real-account-id';
    const eff = book.effective(child);
    assert.equal(eff, child, 'falls back rather than throwing — never interrupts anything');
  });
});

// ----------------------------------------------------- entitlements: the point of it

test('a seat gets everything its parent\'s tier gives — Gold in, Gold features out', () => {
  withBook((book) => {
    const parent = makeParent(book, { tier: 'gold', status: 'active' });
    const child = book.find(book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' }).id);
    const eff = book.effective(child);
    assert.ok(can(eff, FEATURES.REQUEST_PACK), 'REQUEST_PACK is gold-tier; the seat should hold it');
    assert.ok(can(eff, FEATURES.LEAGUE), 'silver-tier features flow down too');
  });
});

test('THE ONE EXCEPTION: a seat never gets streaming, even off a Gold parent', () => {
  withBook((book) => {
    const parent = makeParent(book, { tier: 'gold', status: 'active' });
    const child = book.find(book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' }).id);
    const eff = book.effective(child);
    assert.equal(can(eff, FEATURES.STREAM), false, 'egress is a real per-use cost a group has not been priced for');
    // And the parent itself, playing on its own room, keeps it — the
    // exclusion is specifically for BEING A SEAT, not for being in a group.
    assert.ok(can(parent, FEATURES.STREAM));
  });
});

test('a seat off a COMPED parent still gets everything except streaming', () => {
  withBook((book) => {
    const parent = makeParent(book, { comped: true, status: 'active' });
    const child = book.find(book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' }).id);
    const eff = book.effective(child);
    assert.ok(can(eff, FEATURES.REQUEST_PACK));
    assert.equal(can(eff, FEATURES.STREAM), false);
  });
});

test('a LAPSED parent means the seat has nothing — same as any lapsed account, never mid-game', () => {
  withBook((book) => {
    const parent = makeParent(book, { tier: 'gold', status: 'past_due' });
    const child = book.find(book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' }).id);
    const eff = book.effective(child);
    assert.deepEqual(featuresFor(eff), []);
  });
});

// ------------------------------------------------------ a seat's own password

test('a seat can set its own password through the same reset-link mechanism signup uses', () => {
  withBook((book) => {
    const parent = makeParent(book);
    const created = book.addChild(parent.id, { email: 'dave@example.com', password: 'thrown-away-immediately', name: 'Dave' });
    // The parent never learns or chooses this — a route handles the token,
    // this just proves the underlying mechanism works for a seat exactly as
    // it already does for an ordinary signup.
    const { token } = book.startReset('dave@example.com');
    assert.ok(token);
    const completed = book.useReset(token, 'a brand new chosen password');
    assert.equal(completed.email, 'dave@example.com');
    assert.ok(book.signIn('dave@example.com', 'a brand new chosen password'));
    assert.equal(book.signIn('dave@example.com', 'thrown-away-immediately'), null,
      'the throwaway password addChild used to create the account must not still work');
  });
});

test('removing a seat drops it back to its OWN standing, not the ex-parent\'s', () => {
  withBook((book) => {
    const parent = makeParent(book, { tier: 'gold', status: 'active' });
    const created = book.addChild(parent.id, { email: 'dave@example.com', password: PASSWORD, name: 'Dave' });
    book.removeChild(created.id);
    const child = book.find(created.id);
    const eff = book.effective(child);
    assert.equal(eff, child, 'no parentId left, so effective() is a no-op');
    // A seat is created with status: 'active' but no tier of its own, which
    // resolves to the bottom rung — Bronze — once it is on its own.
    assert.equal(can(eff, FEATURES.REQUEST_PACK), false, 'the gold feature it had as a seat does not follow it out');
  });
});
