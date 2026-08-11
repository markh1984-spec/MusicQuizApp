/**
 * What a payment processor may and may not do to an account.
 *
 * PayPal goes in first, at 2.9%, and Stripe is cheaper — so a migration is
 * likely rather than hypothetical, and these tests are what make
 * "processor-agnostic" a fact rather than an intention.
 *
 * Three of them are security properties rather than behaviour. This endpoint
 * is reachable by anybody who finds the URL and a signature check is the only
 * thing in front of it, so a bug there should cost a wrong tier and never an
 * account.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Accounts } from '../src/accounts.js';
import { applyBilling, readEvent, BILLING_EVENTS } from '../src/billing.js';
import { ladderFor, can, whyNot, FEATURES, FEATURE_TIER } from '../public/assets/plans.js';
import { Suggestions, PACK_REQUEST_KIND } from '../src/suggestions.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASSWORD = 'a-long-test-password';

function book() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billing-'));
  return new Accounts(path.join(dir, 'accounts.json'));
}

function subscriber(accounts, extra = {}) {
  const made = accounts.create({ email: 'rob@example.com', password: PASSWORD, status: 'trialing', ...extra });
  return made.id;
}

const NOW = Date.parse('2026-08-11T20:00:00Z');
const event = (kind, over = {}) => ({
  kind, accountId: '', at: NOW, processor: 'paypal', reference: 'I-SUB-123', ...over,
});

// ========================================================== the ordinary path

test('subscribing sets the tier and marks it active', () => {
  const accounts = book();
  const id = subscriber(accounts);

  const done = applyBilling(accounts, event('started', { accountId: id, tier: 'gold' }));
  assert.equal(done.ok, true, done.reason);
  assert.equal(accounts.find(id).tier, 'gold');
  assert.equal(accounts.find(id).status, 'active');
  // The receipt, so somebody can find the same subscription in the processor's
  // own dashboard — and so two processors' ids cannot be confused mid-migration.
  assert.equal(accounts.find(id).billing.processor, 'paypal');
  assert.equal(accounts.find(id).billing.reference, 'I-SUB-123');
});

test('a renewal clears a past-due without needing the tier resending', () => {
  const accounts = book();
  const id = subscriber(accounts);
  applyBilling(accounts, event('started', { accountId: id, tier: 'silver' }));
  applyBilling(accounts, event('payment_failed', { accountId: id, at: NOW + 1000 }));
  assert.equal(accounts.find(id).status, 'past_due');

  applyBilling(accounts, event('renewed', { accountId: id, at: NOW + 2000 }));
  assert.equal(accounts.find(id).status, 'active');
  assert.equal(accounts.find(id).tier, 'silver', 'a renewal moved the tier');
});

/*
 * **A failed payment must not take the tier away**, and this is the rule the
 * whole codebase already has tests for: a lapsed subscription never interrupts
 * a night. `allowed(..., { live: true })` keeps a running game going whatever
 * the status says, and `mayStartSomething` is what actually refuses. Dropping
 * somebody to Bronze because a card expired on a Tuesday would take their
 * packs away in the middle of the week.
 */
test('a failed payment moves the status and never the tier', () => {
  const accounts = book();
  const id = subscriber(accounts);
  applyBilling(accounts, event('started', { accountId: id, tier: 'gold' }));

  applyBilling(accounts, event('payment_failed', { accountId: id, at: NOW + 1000, tier: 'bronze' }));
  assert.equal(accounts.find(id).tier, 'gold', 'a failed payment demoted the account');
  assert.equal(accounts.find(id).status, 'past_due');
});

test('cancelling and expiring both close it, and neither touches the tier', () => {
  for (const kind of ['cancelled', 'expired']) {
    const accounts = book();
    const id = subscriber(accounts);
    applyBilling(accounts, event('started', { accountId: id, tier: 'gold' }));
    applyBilling(accounts, event(kind, { accountId: id, at: NOW + 1000 }));
    assert.equal(accounts.find(id).status, 'cancelled', kind);
    assert.equal(accounts.find(id).tier, 'gold', `${kind} moved the tier`);
  }
});

// ================================================= retries and things arriving late

/*
 * Webhooks retry and arrive out of order. A stale "cancelled" landing after a
 * fresh "started" would close an account somebody has just paid for — the same
 * lesson the invoice counter learned, where believing a stale backup would
 * have reissued a number already printed on somebody's invoice.
 */
test('AN OLDER EVENT CAN NEVER ROLL A SUBSCRIPTION BACKWARDS', () => {
  const accounts = book();
  const id = subscriber(accounts);

  applyBilling(accounts, event('cancelled', { accountId: id, at: NOW }));
  applyBilling(accounts, event('started', { accountId: id, tier: 'gold', at: NOW + 5000 }));
  assert.equal(accounts.find(id).status, 'active');

  // The cancellation, delivered again an hour later because the first attempt
  // timed out somewhere.
  const late = applyBilling(accounts, event('cancelled', { accountId: id, at: NOW }));
  assert.equal(late.ok, false);
  assert.equal(late.stale, true);
  assert.equal(accounts.find(id).status, 'active', 'a stale retry closed a paid account');
});

test('the same event twice is harmless', () => {
  const accounts = book();
  const id = subscriber(accounts);
  const one = event('started', { accountId: id, tier: 'silver' });
  applyBilling(accounts, one);
  applyBilling(accounts, one);
  assert.equal(accounts.find(id).tier, 'silver');
  assert.equal(accounts.find(id).status, 'active');
});

// ==================================================== what a webhook may NOT do

/*
 * The wall. This endpoint is reachable by anybody who finds the URL, and the
 * signature check is the only thing standing in front of it — so the blast
 * radius of a bug there has to be a wrong TIER, never an account.
 */
test('a webhook cannot hand out comped, a role, packs or a password', () => {
  const accounts = book();
  const id = subscriber(accounts);

  applyBilling(accounts, {
    ...event('started', { accountId: id, tier: 'bronze' }),
    comped: true,
    role: 'owner',
    packs: ['everything'],
    passwordHash: 'nonsense',
    email: 'attacker@example.com',
  });

  const after = accounts.find(id);
  assert.notEqual(after.comped, true, 'a webhook comped an account');
  assert.equal(after.role, 'quizmaster', 'a webhook changed a role');
  assert.equal(after.packs, undefined, 'a webhook handed out packs');
  assert.equal(after.email, 'rob@example.com', 'a webhook changed an email address');
});

test('a tier the app has never heard of is refused rather than guessed at', () => {
  const accounts = book();
  const id = subscriber(accounts);
  const done = applyBilling(accounts, event('started', { accountId: id, tier: 'platinum' }));
  assert.equal(done.ok, false);
  assert.equal(accounts.find(id).status, 'trialing', 'a bad tier still moved the status');
});

test('an owner has no subscription, and that is reported rather than thrown', () => {
  const accounts = book();
  const owner = accounts.create({ email: 'me@example.com', password: PASSWORD, role: 'owner' });
  assert.doesNotThrow(() => applyBilling(accounts, event('started', { accountId: owner.id, tier: 'gold' })));
  assert.equal(applyBilling(accounts, event('started', { accountId: owner.id, tier: 'gold' })).ok, false);
});

/*
 * A webhook endpoint that throws makes the processor retry the same bad
 * payload for hours. Everything here reports and lets the route answer 200 —
 * "received and ignored" is the honest reply to a message this app has no
 * business acting on.
 */
test('nothing about a malformed event throws', () => {
  const accounts = book();
  for (const bad of [undefined, {}, { kind: 'nonsense' }, { kind: 'started' }, { kind: 'started', accountId: 'nope', at: NOW }]) {
    assert.doesNotThrow(() => applyBilling(accounts, bad));
    assert.equal(applyBilling(accounts, bad).ok, false);
  }
  assert.equal(readEvent({ kind: 'started', accountId: 'x', at: 0 }).ok, false, 'an event with no clock got through');
});

// ============================================== the migration this exists for

/*
 * PayPal is 2.9% and Stripe is cheaper, so this WILL be swapped. The whole
 * point of this file is that swapping it is one new adapter and one route
 * rather than a search through the codebase for the word "paypal".
 */
// Comments may name a processor — explaining WHY this split exists is most of
// the value of the file. Code may not.
const codeOf = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');

test('nothing outside a processor adapter knows which processor it is', () => {
  assert.doesNotMatch(codeOf('src/billing.js'), /paypal|stripe/i,
    'the processor-agnostic layer has learned the name of a processor');

  // And an account carries an opaque reference, never a processor-shaped field.
  assert.doesNotMatch(codeOf('src/accounts.js'), /paypal|stripe/i,
    'the accounts book has learned the name of a processor');
});

// ======================================== the account that must never be billed

/*
 * The owner is a quizmaster too, on one laptop, through the Owner | Quizmaster
 * hat — and that linked account is `comped`: everything, for nothing. It has no
 * subscription and must never be offered one.
 *
 * It carries no TIER, though, so before this it read as Bronze while
 * `featuresFor` handed it the lot: the account page drew Silver and Gold as
 * locked, with a price on each, to the person who wrote the app. Harmless
 * while there was nothing to press. Not harmless the moment a Subscribe button
 * exists, because a button belongs on a rung that is not included — so the one
 * account that must never be billed would have been the one being sold to.
 */
test('a comped account holds every rung, so it is never sold anything', () => {
  for (const who of [
    { role: 'quizmaster', comped: true, status: 'active', ownedBy: 'owner-1' },
    { bootstrap: true, role: 'quizmaster' },
  ]) {
    const ladder = ladderFor(who);
    assert.ok(ladder.every((t) => t.included), 'a comped account was shown a rung it does not have');
    // And every feature on every rung reads as held, or the page contradicts
    // itself: an included tier full of things you apparently cannot use.
    assert.ok(ladder.every((t) => t.features.every((f) => f.held)));
  }
});

/*
 * And it must not leak into the tier preview, which is the whole point of that
 * feature: the owner looks at the console as a Bronze subscriber sees it.
 * Previewing CLEARS comped first — a rule that already has a test named after
 * the day it did not — so the ladder has to go back to being locked.
 */
test('previewing a tier still shows the rungs above as locked', () => {
  const preview = { role: 'quizmaster', tier: 'bronze', status: 'active', comped: false };
  const ladder = ladderFor(preview);
  assert.equal(ladder.find((t) => t.id === 'bronze').included, true);
  assert.equal(ladder.find((t) => t.id === 'silver').included, false, 'a Bronze preview held Silver');
  assert.equal(ladder.find((t) => t.id === 'gold').included, false);
});

/*
 * The other half of the same guarantee: nothing a processor says can start
 * billing an account that is comped, because a webhook cannot reach `comped`
 * at all. Belt and braces — no subscription exists for it in the first place.
 */
test('a stray webhook cannot un-comp the owner\'s own quizmaster account', () => {
  const accounts = book();
  const hat = accounts.create({
    email: 'me+quizmaster@example.com', password: PASSWORD, comped: true, status: 'active', ownedBy: 'owner-1',
  });
  applyBilling(accounts, { ...event('cancelled', { accountId: hat.id, at: NOW + 9000 }) });
  assert.equal(accounts.find(hat.id).comped, true, 'a webhook took the comp away');
});

test('the five events are the whole vocabulary', () => {
  // A processor that wants to say something outside this list is telling the
  // app about something it should not be reacting to automatically.
  assert.deepEqual([...BILLING_EVENTS].sort(),
    ['cancelled', 'expired', 'payment_failed', 'renewed', 'started']);
});

// ================================================= asking for a pack — Gold only

/*
 * "There is no One Direction quiz and I want one."
 *
 * It lives in the SUGGESTION BOX rather than a subsystem of its own, because
 * what it needs is exactly what a suggestion needs — somebody to read it,
 * decide, and say yes or no in words — and the inbox, the reply that clears
 * it, the draft button and the been-opened receipt all already exist.
 *
 * It is the one kind that is gated, and the reason is NOT the per-use rule:
 * a request costs nothing until the owner agrees to it. What it spends is the
 * owner's writing time, which is the same thing Gold already sells. Silver
 * buys the back catalogue; Gold buys the owner's time.
 */
test('a pack request is Gold, and every other kind stays open to everybody', () => {
  const bronze = { role: 'quizmaster', tier: 'bronze', status: 'active' };
  const gold = { role: 'quizmaster', tier: 'gold', status: 'active' };

  assert.equal(can(bronze, FEATURES.REQUEST_PACK), false);
  assert.equal(can(gold, FEATURES.REQUEST_PACK), true);
  assert.match(whyNot(bronze, FEATURES.REQUEST_PACK), /Gold/);
  // The box itself is deliberately not gated at all — the people most worth
  // hearing from are the ones having the worst time, who are least likely to
  // be on the top rung.
  assert.equal(FEATURE_TIER[FEATURES.REQUEST_PACK], 'gold');
});

/*
 * **Checked on the SERVER, not left to the console not drawing the option.** A
 * kind is one word in a request body, which is exactly the shape of the hole
 * `POST /api/quiz` had — the id was in the body and the route prefix never
 * matched it.
 */
test('the kind is gated where it is received, not where it is drawn', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const at = server.indexOf("if (route === '/api/suggestions' && req.method === 'POST')");
  assert.ok(at > 0, 'the suggestions route has moved');
  const route = server.slice(at, at + 1800);
  assert.match(route, /PACK_REQUEST_KIND/, 'a pack request is no longer told apart on the server');
  assert.match(route, /FEATURES\.REQUEST_PACK/, 'the pack-request kind is not gated on the server');
  assert.match(route, /openPackRequest/, 'nothing stops a subscriber queueing ten of them');
});

/*
 * One at a time, and that is what makes the offer deliverable rather than a
 * backlog. Worse than not having this feature is having it and not delivering.
 */
test('one open pack request at a time, per account', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugg-'));
  const box = new Suggestions(path.join(dir, 'suggestions.json'), () => NOW);

  box.add({ text: 'A One Direction quiz please', kind: PACK_REQUEST_KIND, byId: 'rob' });
  assert.ok(box.openPackRequest('rob'), 'the request is not on the list');
  // Somebody else asking is not affected by Rob's.
  assert.equal(box.openPackRequest('dave'), null);
  // And an ordinary suggestion is never mistaken for one.
  box.add({ text: 'The editor is confusing', kind: 'annoying', byId: 'dave' });
  assert.equal(box.openPackRequest('dave'), null);

  // Answered and cleared, so the next one may be asked for.
  box.reply(box.openPackRequest('rob').id, 'Written — it is in your library.');
  assert.equal(box.openPackRequest('rob'), null, 'a cleared request still blocks the next one');
});
