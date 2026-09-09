/**
 * THE WEBHOOK, ASKED OVER REAL HTTP.
 *
 * `stripe.test.js` checks the adapter. This checks the ROUTE, which is where
 * the two faults that matter live and which no unit test can reach:
 *
 *  - **the raw bytes.** The signature is an HMAC over the body exactly as
 *    sent, so anything that parses and re-serialises it first breaks every
 *    check — a fault that looks like a wrong secret and is not. The only way
 *    to know the route reads the stream before `readJson()` does is to make
 *    the request.
 *  - **that it grants.** `applyBilling()` is tested against the book; whether
 *    a signed `checkout.session.completed` arriving on a real port actually
 *    moves a real account is a different question, and it is THE question.
 *
 * *A test that never runs the artefact proves nothing about it* — this repo
 * shipped a broken Launch to the live app with 1,150 tests green for exactly
 * that reason.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { withServer as live } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const SECRET = 'whsec_route_test_secret';
const EMAIL = 'payer@x.com';
const PASSWORD = 'a-long-payer-password';

let accountId = '';

const withServer = (run) => live(run, {
  hostKey: 'stripe-route-key',
  env: {
    STRIPE_SECRET_KEY: 'sk_test_never_called',
    STRIPE_WEBHOOK_SECRET: SECRET,
    STRIPE_PRICE_BRONZE: 'price_bronze',
    STRIPE_PRICE_GOLD: 'price_gold',
  },
  seed(dir) {
    const file = path.join(dir, 'accounts.json');
    const accounts = new Accounts(file);
    const made = accounts.create({
      email: EMAIL, password: PASSWORD, name: 'Payer', role: 'quizmaster',
      tier: 'bronze', status: 'cancelled',
    });
    accountId = made.id;
    accounts.save();
    return file;
  },
});

/*
 * PRETTY-PRINTED ON PURPOSE, and that is the whole raw-bytes half of this file.
 *
 * A body built with `JSON.stringify(x)` survives `JSON.parse` and
 * `JSON.stringify` again UNCHANGED — so a route that parsed the body before
 * checking the signature would still pass, and the first version of this test
 * proved nothing at all. Verified by putting that fault in: 0 failures.
 *
 * Real Stripe payloads carry their own whitespace and key order. Two spaces of
 * indentation reproduces that in one argument: re-serialising this loses them,
 * the HMAC no longer matches, and the check fails exactly as it would live.
 */
function post(base, body, { secret = SECRET, at = Math.floor(Date.now() / 1000) } = {}) {
  const raw = JSON.stringify(body, null, 2);
  const sig = crypto.createHmac('sha256', secret).update(`${at}.${raw}`).digest('hex');
  return fetch(`${base}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${at},v1=${sig}` },
    body: raw,
  });
}

const book = (file) => JSON.parse(fs.readFileSync(file, 'utf8')).accounts.find((a) => a.email === EMAIL);

const paid = () => ({
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  data: { object: {
    id: 'cs_1', client_reference_id: accountId, customer: 'cus_1', subscription: 'sub_1',
    payment_status: 'paid',
    lines: { data: [{ price: { id: 'price_gold' } }] },
  } },
});

test('a signed payment moves a real account, over real HTTP', async () => {
  await withServer(async (base, file) => {
    assert.equal(book(file).status, 'cancelled', 'the fixture already pays');

    const res = await post(base, paid());
    assert.equal(res.status, 200, await res.text());

    const after = book(file);
    assert.equal(after.status, 'active', 'a paid webhook did not activate the account');
    assert.equal(after.tier, 'gold', 'the tier did not follow the price');
    assert.equal(after.billing.customer, 'cus_1', 'the portal has nothing to open');
    assert.equal(after.billing.processor, 'stripe');
  });
});

test('AND AN UNSIGNED ONE MOVES NOTHING — the signature is the whole gate', async () => {
  await withServer(async (base, file) => {
    const raw = JSON.stringify(paid());
    const res = await fetch(`${base}/api/stripe/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw,
    });
    assert.equal(res.status, 400);
    assert.equal(book(file).status, 'cancelled', 'an unsigned webhook granted a tier');

    // And one signed with the wrong secret, which is the realistic attempt.
    const wrong = await post(base, paid(), { secret: 'whsec_somebody_elses' });
    assert.equal(wrong.status, 400);
    assert.equal(book(file).tier, 'bronze', 'a forged webhook granted Gold');
  });
});

test('AND A REPLAY OF A REAL ONE IS REFUSED', async () => {
  await withServer(async (base, file) => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const res = await post(base, paid(), { at: old });
    assert.equal(res.status, 400, 'an hour-old signature was accepted');
    assert.equal(book(file).status, 'cancelled');
  });
});

test('an event this app does not act on is a 200, not an error', async () => {
  await withServer(async (base, file) => {
    // A 400 or a 500 here makes Stripe retry for hours and eventually disable
    // the endpoint — the whole subscription plumbing going quiet in silence.
    const res = await post(base, {
      type: 'customer.subscription.updated',
      created: Math.floor(Date.now() / 1000),
      data: { object: { metadata: { accountId } } },
    });
    assert.equal(res.status, 200);
    assert.equal(book(file).status, 'cancelled', 'an ignored event moved the account');
  });
});

test('a renewal months later still finds the account, off the subscription', async () => {
  await withServer(async (base, file) => {
    await post(base, paid());
    // No session on it at all — only the subscription's own metadata.
    const res = await post(base, {
      type: 'invoice.paid',
      created: Math.floor(Date.now() / 1000) + 1,
      data: { object: {
        id: 'in_2', subscription: 'sub_1', customer: 'cus_1',
        subscription_details: { metadata: { accountId } },
        lines: { data: [{ price: { id: 'price_gold' } }] },
      } },
    });
    assert.equal(res.status, 200);
    const after = book(file);
    assert.equal(after.status, 'active');
    assert.equal(after.billing.last, 'renewed');
    // And the customer survived an event that named one — and would have to
    // survive one that did not; see `setBilling()`.
    assert.equal(after.billing.customer, 'cus_1');
  });
});

test('A FAILED PAYMENT MOVES THE STATUS AND LEAVES THE TIER ALONE', async () => {
  await withServer(async (base, file) => {
    await post(base, paid());
    const res = await post(base, {
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000) + 2,
      data: { object: { id: 'in_3', subscription: 'sub_1', metadata: { accountId } } },
    });
    assert.equal(res.status, 200);
    const after = book(file);
    assert.equal(after.status, 'past_due', 'a failed card did not move the status');
    // Dropping the tier would take somebody's packs away mid-week for a card
    // that expired on a Tuesday — see `applyBilling()`.
    assert.equal(after.tier, 'gold', 'a failed card took the tier away');
    // AND THE CUSTOMER SURVIVED an event that does not carry one, or the
    // "change your card" link dies at the exact moment it is needed.
    assert.equal(after.billing.customer, 'cus_1', 'the portal link died on a failed payment');
  });
});

test('the checkout route refuses a rung that is not on sale', async () => {
  await withServer(async (base) => {
    const signIn = await fetch(`${base}/api/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];

    // `wantedTier` must never become `tier`: junk gets no price, so no
    // checkout, so nothing to grant. It never reaches Stripe at all.
    for (const tier of ['platinum', 'owner', '', 'silver']) {
      const res = await fetch(`${base}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ tier }),
      });
      assert.equal(res.status, 400, `"${tier}" was allowed to start a checkout`);
    }
  });
});
