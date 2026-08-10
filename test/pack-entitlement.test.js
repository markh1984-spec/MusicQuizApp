/**
 * Which packs an account can reach.
 *
 * The upsell lever is CONTENT rather than capability: a Bronze host gets the
 * whole machine and a starter set of packs, and the pressure to move up
 * arrives on its own when the room has heard them all. Nothing is greyed out,
 * so nothing looks broken in front of a paying room.
 *
 * Every tier is `'all'` today on purpose — this is the mechanism with nothing
 * switched on. These tests pin the mechanism so switching it on later is one
 * line rather than an afternoon of finding out what it broke.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { packsFor, canPlayPack, TIER_PACKS, FEATURES, can } from '../public/assets/plans.js';
import { Accounts } from '../src/accounts.js';

function book() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-ent-'));
  return new Accounts(path.join(dir, 'accounts.json'));
}

test('nothing is restricted today — every tier sees the whole catalogue', () => {
  for (const [tier, scope] of Object.entries(TIER_PACKS)) {
    assert.equal(scope, 'all', `${tier} is no longer 'all' — was that deliberate?`);
    assert.equal(packsFor({ role: 'quizmaster', tier }), 'all');
  }
});

test('a starter list on the account beats the tier', () => {
  const rob = { role: 'quizmaster', tier: 'bronze', packs: ['eighties', 'madonna'] };
  assert.deepEqual(packsFor(rob), ['eighties', 'madonna']);
  assert.equal(canPlayPack(rob, 'eighties'), true);
  assert.equal(canPlayPack(rob, 'metallica'), false);
});

test('an empty list means none, and is not confused with following the tier', () => {
  assert.deepEqual(packsFor({ role: 'quizmaster', tier: 'bronze', packs: [] }), []);
  assert.equal(canPlayPack({ role: 'quizmaster', packs: [] }, 'anything'), false);
});

/*
 * The three that must never be restricted. An owner writes the catalogue, the
 * host key is every hat at once, and a comped account is the owner's own
 * quizmaster — locking any of them out of a pack would be locking the author
 * out of their own work.
 */
test('the owner, the host key and a comped account always see everything', () => {
  assert.equal(packsFor({ role: 'owner' }), 'all');
  assert.equal(packsFor({ bootstrap: true }), 'all');
  assert.equal(packsFor({ role: 'quizmaster', tier: 'bronze', comped: true, packs: ['one'] }), 'all');
});

test('a pack list is an entitlement, so it is set by the owner and not by prefs', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');

  accounts.update(rob.id, { packs: ['eighties'] });
  assert.deepEqual(accounts.find(rob.id).packs, ['eighties']);

  // The wall: a preferences payload must not widen what you can reach.
  accounts.setPrefs(rob.id, { packs: ['eighties', 'metallica', 'madonna'] });
  assert.deepEqual(accounts.find(rob.id).packs, ['eighties'], 'prefs handed out packs');
});

test('null clears the list back to the tier, an empty array does not', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');

  accounts.update(rob.id, { packs: ['eighties'] });
  accounts.update(rob.id, { packs: [] });
  assert.deepEqual(accounts.find(rob.id).packs, [], 'an empty list is a real answer meaning none');

  accounts.update(rob.id, { packs: null });
  assert.equal(accounts.find(rob.id).packs, undefined, 'null follows the tier again');
  assert.equal(packsFor(accounts.find(rob.id)), 'all');
});

test('duplicate ids are folded, and rubbish is dropped', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');
  accounts.update(rob.id, { packs: ['a', 'a', '', 'b'] });
  assert.deepEqual(accounts.find(rob.id).packs, ['a', 'b']);
});

test('a list that is not a list is refused rather than half-stored', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');
  assert.throws(() => accounts.update(rob.id, { packs: 'eighties' }), /list of pack ids/);
  assert.equal(accounts.find(rob.id).packs, undefined);
});

/*
 * The library is what you can PLAY, not what you can DO. A starter set must
 * not quietly take the running of a night away with it — that is the whole
 * point of choosing content as the lever instead of capability.
 */
test('a smaller library takes away no features at all', () => {
  const full = { role: 'quizmaster', tier: 'bronze', status: 'active' };
  const starter = { ...full, packs: ['eighties'] };
  for (const feature of [FEATURES.QUIZ, FEATURES.BINGO, FEATURES.LIBRARY, FEATURES.PHOTOS, FEATURES.LOOKS]) {
    assert.equal(can(starter, feature), can(full, feature), `${feature} changed with the pack list`);
  }
});
