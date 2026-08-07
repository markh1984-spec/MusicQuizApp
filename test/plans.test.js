/**
 * Who is allowed to do what.
 *
 * The tests here are the commercial rules written down: what Basic gets, what
 * costs money and is therefore not in Basic, and the one that matters most on
 * the night — a lapsed subscription must never black out a live projector.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FEATURES, PLANS, ADDONS, can, featuresFor, whyNot, entitlements } from '../public/assets/plans.js';

const owner = { role: 'owner' };
const basic = { role: 'quizmaster', plan: 'basic', addons: [], status: 'active' };
const withAdmin = { ...basic, addons: ['admin'] };
const mark = { role: 'quizmaster', plan: 'basic', addons: [], comped: true, status: 'active' };

test('Basic runs a whole night, both games', () => {
  assert.equal(can(basic, FEATURES.QUIZ), true);
  assert.equal(can(basic, FEATURES.BINGO), true);
  assert.equal(can(basic, FEATURES.LIBRARY), true);
  assert.equal(can(basic, FEATURES.BUY_PACKS), true);
  assert.equal(can(basic, FEATURES.LOOKS), true);
  assert.equal(can(basic, FEATURES.ADVERTS), true);
  assert.equal(can(basic, FEATURES.PHOTOS), true);
});

test('nothing that costs the owner money per use is in Basic', () => {
  // The rule the tiers are drawn with. If one of these ever passes, either the
  // cost moved or somebody put a bill on the owner's account by accident.
  for (const feature of [FEATURES.GENERATE, FEATURES.ARTWORK, FEATURES.STREAM]) {
    assert.equal(can(basic, feature), false, `${feature} must not be in Basic`);
  }
});

test('a quizmaster can never generate a quiz — the packs are written for them', () => {
  for (const account of [basic, withAdmin, mark]) {
    assert.equal(can(account, FEATURES.GENERATE), false);
    assert.equal(can(account, FEATURES.ARTWORK), false);
  }
  assert.equal(can(owner, FEATURES.GENERATE), true);
  // And it says why, rather than just refusing.
  assert.match(whyNot(basic, FEATURES.GENERATE), /written for you/);
});

test('the admin add-on is what turns invoicing on', () => {
  assert.equal(can(basic, FEATURES.INVOICES), false);
  assert.equal(can(withAdmin, FEATURES.INVOICES), true);
  assert.equal(can(withAdmin, FEATURES.CALENDAR), true);
  assert.match(whyNot(basic, FEATURES.INVOICES), /Admin is an add-on/);
});

test('the streaming add-on is separate, because egress is a real bill', () => {
  assert.equal(can(withAdmin, FEATURES.STREAM), false);
  assert.equal(can({ ...basic, addons: ['stream'] }, FEATURES.STREAM), true);
});

test("the owner's own quizmaster account gets everything, for nothing", () => {
  for (const feature of [...PLANS.basic.features, ...Object.values(ADDONS).flatMap((a) => a.features)]) {
    assert.equal(can(mark, feature), true, `comped account should have ${feature}`);
  }
  // But it is still not the owner console.
  assert.equal(can(mark, FEATURES.SUBSCRIBERS), false);
});

test('the owner account runs no quiz nights of its own', () => {
  assert.equal(can(owner, FEATURES.QUIZ), false);
  assert.equal(can(owner, FEATURES.INVOICES), false);
  assert.equal(can(owner, FEATURES.SUBSCRIBERS), true);
  assert.equal(can(owner, FEATURES.CATALOGUE), true);
  assert.match(whyNot(owner, FEATURES.QUIZ), /quizmaster account/);
});

test('an unpaid subscription loses its features', () => {
  const lapsed = { ...basic, status: 'past_due' };
  assert.equal(can(lapsed, FEATURES.QUIZ), false);
  assert.deepEqual(featuresFor(lapsed), []);
  assert.match(whyNot(lapsed, FEATURES.QUIZ), /needs a payment/);

  const cancelled = { ...basic, status: 'cancelled' };
  assert.equal(can(cancelled, FEATURES.QUIZ), false);
  assert.match(whyNot(cancelled, FEATURES.QUIZ), /has ended/);
});

test('a trial is a paying customer as far as the app is concerned', () => {
  assert.equal(can({ ...basic, status: 'trialing' }, FEATURES.QUIZ), true);
});

test('nobody at all can do anything', () => {
  assert.equal(can(null, FEATURES.QUIZ), false);
  assert.equal(can(undefined, FEATURES.QUIZ), false);
  assert.equal(can(basic, ''), false);
  assert.equal(can(basic, 'made.up.feature'), false);
  assert.match(whyNot(null, FEATURES.QUIZ), /not signed in/);
});

test('the console is told what is missing AND why, so it can offer it', () => {
  const ent = entitlements(basic);
  assert.equal(ent.plan, 'basic');
  assert.ok(ent.features.includes(FEATURES.QUIZ));

  const invoices = ent.missing.find((m) => m.feature === FEATURES.INVOICES);
  assert.ok(invoices, 'invoicing should be offered rather than hidden');
  assert.match(invoices.why, /add-on/);

  // Owner-only things are not for sale, so they are not dangled.
  assert.equal(ent.missing.some((m) => m.feature === FEATURES.GENERATE), false);
  assert.equal(ent.missing.some((m) => m.feature === FEATURES.SUBSCRIBERS), false);
});

test('a comped account is marked as such, so the owner console can see why it pays nothing', () => {
  assert.equal(entitlements(mark).comped, true);
  assert.equal(entitlements(basic).comped, false);
});
