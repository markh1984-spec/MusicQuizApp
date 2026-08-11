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

import * as plans from '../public/assets/plans.js';
import { packsFor, canPlayPack, TIER_PACKS, TIERS, FEATURES, can } from '../public/assets/plans.js';
import { Accounts } from '../src/accounts.js';

import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function book() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-ent-'));
  return new Accounts(path.join(dir, 'accounts.json'));
}

/*
 * The lever, switched on. This is what the whole ladder is made of: Bronze
 * buys packs, Silver gets them included — the host's own reasoning, and also
 * why a quizmaster never generates.
 *
 * Deliberately asserts the SHAPE rather than the contents. Which eight packs
 * Bronze starts with is a commercial decision that will move, and a test that
 * named them would fail every time somebody changed their mind rather than
 * every time something broke.
 */
test('Bronze is a starter set, and every rung above it is the whole catalogue', () => {
  assert.ok(Array.isArray(TIER_PACKS.bronze), 'Bronze is no longer a starter set — was that deliberate?');
  assert.ok(TIER_PACKS.bronze.length >= 4, 'the starter set is too thin to run a month on');
  assert.equal(new Set(TIER_PACKS.bronze).size, TIER_PACKS.bronze.length, 'a pack is listed twice');

  for (const tier of ['silver', 'gold']) {
    assert.equal(TIER_PACKS[tier], 'all', `${tier} no longer includes the whole catalogue`);
    assert.equal(packsFor({ role: 'quizmaster', tier }), 'all');
  }
  assert.deepEqual(packsFor({ role: 'quizmaster', tier: 'bronze' }), TIER_PACKS.bronze);
});

/*
 * The starter packs have to BE packs. A list of ids drifts silently when one is
 * renamed — the pack does not disappear, it just stops being in Bronze, and
 * nothing on any screen says so.
 */
test('every pack in the starter set is really in the catalogue', () => {
  const inLibrary = new Set([
    ...fs.readdirSync(path.join(ROOT, 'quizzes')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
    ...fs.readdirSync(path.join(ROOT, 'bingo')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
  ]);
  for (const id of TIER_PACKS.bronze) {
    assert.ok(inLibrary.has(id), `Bronze starts with "${id}", which is not in the catalogue — renamed?`);
  }
});

/*
 * A price is a decision, but a FREE rung is a structural one: the machine is
 * the same at every level, so a £0 tier is somebody running paying gigs on it
 * forever. The host decided against one. A trial is a status, not a rung.
 */
test('there is no free rung', () => {
  for (const tier of TIERS) {
    assert.ok(tier.pence > 0, `${tier.id} is free — a trial is a status, not a tier`);
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
  // Back to whatever the tier says — which for a brand new account is Bronze's
  // starter set, not the whole catalogue.
  assert.deepEqual(packsFor(accounts.find(rob.id)), TIER_PACKS.bronze);
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

/*
 * The account page's line about what a higher tier holds.
 *
 * The first version named the LOWEST tier that includes the whole catalogue —
 * which today is Bronze, since nothing is switched on. So a Bronze subscriber
 * on a starter list was told "Bronze includes every pack" while looking at
 * three of seven. That reads as a fault in their account, not as an offer.
 *
 * Kept in step with server.js: only ever a tier ABOVE this one, and nothing
 * about tiers at all when the limit is an explicit list rather than the ladder.
 */
function upsellLine(who, tierPacks) {
  const { TIERS, tierFor } = plans;
  const theirs = TIERS.find((t) => t.id === tierFor(who || {}));
  const rank = theirs ? theirs.rank : -1;
  const up = TIERS
    .filter((t) => t.rank > rank && tierPacks[t.id] === 'all')
    .sort((a, b) => a.rank - b.rank)[0];
  return up ? `${up.label} includes every pack` : 'Ask about the rest of the catalogue.';
}

test('the upsell never names the tier the reader is already on', () => {
  const allAll = { bronze: 'all', silver: 'all', gold: 'all' };
  const rob = { role: 'quizmaster', tier: 'bronze', packs: ['one'] };
  const line = upsellLine(rob, allAll);
  assert.doesNotMatch(line, /Bronze/, 'told a Bronze reader that Bronze has everything');
  assert.match(line, /Silver/);
});

test('a Gold reader with a hand-set list is sold nothing, because there is nothing above', () => {
  const allAll = { bronze: 'all', silver: 'all', gold: 'all' };
  const line = upsellLine({ role: 'quizmaster', tier: 'gold', packs: ['one'] }, allAll);
  assert.match(line, /Ask about the rest/);
  assert.doesNotMatch(line, /Gold|Silver|Bronze/);
});

test('once Bronze is a starter set, a Bronze reader is pointed at Silver', () => {
  const starter = { bronze: ['one', 'two'], silver: 'all', gold: 'all' };
  const line = upsellLine({ role: 'quizmaster', tier: 'bronze' }, starter);
  assert.match(line, /Silver includes every pack/);
});
