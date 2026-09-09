/**
 * STRIPE — the signature, the translation, and the two directions the tier
 * travels in.
 *
 * **THE SIGNATURE IS THE WHOLE GATE.** The webhook URL is the only other
 * secret and it will end up in a log somewhere, so everything that decides
 * whether a body is real lives in `verifySignature()` — and a hole there is
 * somebody moving their own account to Gold from a `curl` call.
 *
 * **AND `wantedTier` MUST NEVER BECOME `tier`.** The browser names a rung, the
 * server turns that into one of three price ids it holds, and the tier an
 * account is GRANTED is read back off whatever Stripe says was paid for.
 * There are checks below on both halves of that round trip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  TOLERANCE_SECONDS, formEncode, priceForTier, sellableTiers, stripeConfigured,
  tierForPrice, toBillingEvent, verifySignature,
} from '../src/stripe.js';

const SECRET = 'whsec_a_test_signing_secret';
const NOW = Date.parse('2026-09-09T20:00:00.000Z');

/** Sign a body the way Stripe does, so the check has something real to read. */
function signed(body, { secret = SECRET, at = Math.floor(NOW / 1000) } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(`${at}.${raw}`).digest('hex');
  return { raw, header: `t=${at},v1=${sig}` };
}

const withPrices = (fn) => {
  const before = { ...process.env };
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_PRICE_BRONZE = 'price_bronze';
  process.env.STRIPE_PRICE_SILVER = 'price_silver';
  process.env.STRIPE_PRICE_GOLD = 'price_gold';
  try { return fn(); } finally {
    for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_BRONZE', 'STRIPE_PRICE_SILVER', 'STRIPE_PRICE_GOLD']) {
      if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k];
    }
  }
};

// ------------------------------------------------------------------- the gate

test('a correctly signed body is read', () => {
  const { raw, header } = signed({ type: 'ping', id: 'evt_1' });
  const got = verifySignature(raw, header, SECRET, { now: () => NOW });
  assert.equal(got.ok, true, got.reason);
  assert.equal(got.event.id, 'evt_1');
});

test('a body changed after signing is refused', () => {
  const { header } = signed({ type: 'ping', amount: 1 });
  const got = verifySignature(JSON.stringify({ type: 'ping', amount: 999999 }), header, SECRET, { now: () => NOW });
  assert.equal(got.ok, false);
  assert.match(got.reason, /does not match/);
});

test('a signature from the wrong secret is refused', () => {
  const { raw, header } = signed({ type: 'ping' }, { secret: 'whsec_somebody_elses' });
  assert.equal(verifySignature(raw, header, SECRET, { now: () => NOW }).ok, false);
});

test('AND AN OLD ONE IS REFUSED, or a captured payload replays for ever', () => {
  const stale = Math.floor(NOW / 1000) - (TOLERANCE_SECONDS + 60);
  const { raw, header } = signed({ type: 'ping' }, { at: stale });
  // Correctly signed — this is a REAL Stripe payload, just an old one.
  const got = verifySignature(raw, header, SECRET, { now: () => NOW });
  assert.equal(got.ok, false);
  assert.match(got.reason, /out of date/);
  // And inside the window it still passes, or the tolerance is doing nothing
  // except breaking honest deliveries.
  const fresh = signed({ type: 'ping' }, { at: Math.floor(NOW / 1000) - 10 });
  assert.equal(verifySignature(fresh.raw, fresh.header, SECRET, { now: () => NOW }).ok, true);
});

test('a header with no signature, or none at all, is refused rather than thrown', () => {
  for (const header of ['', 't=123', 'nonsense', 'v1=abc']) {
    const got = verifySignature('{}', header, SECRET, { now: () => NOW });
    assert.equal(got.ok, false, `"${header}" was accepted`);
  }
});

test('a v1 of the wrong LENGTH is refused, not thrown', () => {
  // `timingSafeEqual` throws on unequal lengths, so this used to be a 500 on
  // the one endpoint that must never 500 — Stripe retries a 500 for hours.
  const { raw } = signed({ type: 'ping' });
  const got = verifySignature(raw, `t=${Math.floor(NOW / 1000)},v1=abc`, SECRET, { now: () => NOW });
  assert.equal(got.ok, false);
  assert.match(got.reason, /does not match/);
});

test('MORE THAN ONE v1 PASSES IF ANY MATCHES — a secret being rotated', () => {
  const { raw, header } = signed({ type: 'ping' });
  const at = header.split(',')[0].slice(2);
  const real = header.split('v1=')[1];
  const both = `t=${at},v1=${'0'.repeat(real.length)},v1=${real}`;
  assert.equal(verifySignature(raw, both, SECRET, { now: () => NOW }).ok, true,
    'only the first v1 is checked, so a rotation breaks silently');
});

test('with no signing secret configured, nothing is accepted', () => {
  const { raw, header } = signed({ type: 'ping' });
  assert.equal(verifySignature(raw, header, '', { now: () => NOW }).ok, false);
});

// ------------------------------------------------------------ the translation

const at = Math.floor(NOW / 1000);

test('a paid checkout is a "started", with the tier read off the PRICE', () => {
  withPrices(() => {
    const got = toBillingEvent({
      type: 'checkout.session.completed',
      created: at,
      data: { object: {
        id: 'cs_1', client_reference_id: 'acc_1', customer: 'cus_1', subscription: 'sub_1',
        payment_status: 'paid',
        lines: { data: [{ price: { id: 'price_gold' } }] },
      } },
    });
    assert.equal(got.kind, 'started');
    assert.equal(got.accountId, 'acc_1');
    assert.equal(got.tier, 'gold');
    assert.equal(got.customer, 'cus_1');
    assert.equal(got.processor, 'stripe');
  });
});

test('AN UNPAID CHECKOUT IS NOTHING — a session can complete without paying', () => {
  withPrices(() => {
    assert.equal(toBillingEvent({
      type: 'checkout.session.completed',
      created: at,
      data: { object: { client_reference_id: 'acc_1', payment_status: 'unpaid' } },
    }), null);
  });
});

test('a renewal finds the account in the SUBSCRIPTION metadata, not a session', () => {
  withPrices(() => {
    // Months later there is no session on the event at all. Getting this wrong
    // means the first payment lands and every renewal is unattributable.
    const got = toBillingEvent({
      type: 'invoice.paid',
      created: at,
      data: { object: {
        id: 'in_1', subscription: 'sub_1', customer: 'cus_1',
        subscription_details: { metadata: { accountId: 'acc_1' } },
        lines: { data: [{ price: { id: 'price_silver' } }] },
      } },
    });
    assert.equal(got.kind, 'renewed');
    assert.equal(got.accountId, 'acc_1');
    assert.equal(got.tier, 'silver');
  });
});

test('a failed payment and a cancellation carry NO tier', () => {
  withPrices(() => {
    const failed = toBillingEvent({
      type: 'invoice.payment_failed',
      created: at,
      data: { object: { metadata: { accountId: 'acc_1' }, lines: { data: [{ price: { id: 'price_gold' } }] } } },
    });
    assert.equal(failed.kind, 'payment_failed');
    // `applyBilling()` only takes a tier on started/renewed, but sending one
    // here would be the adapter asserting something it has not been told.
    assert.equal(failed.tier, undefined);
    const gone = toBillingEvent({
      type: 'customer.subscription.deleted',
      created: at,
      data: { object: { metadata: { accountId: 'acc_1' } } },
    });
    assert.equal(gone.kind, 'cancelled');
  });
});

test('AN EVENT WITH NO ACCOUNT ON IT IS NOTHING, never a guess', () => {
  withPrices(() => {
    assert.equal(toBillingEvent({
      type: 'checkout.session.completed', created: at,
      data: { object: { payment_status: 'paid', customer: 'cus_1' } },
    }), null);
  });
});

test('AN UNKNOWN PRICE LEAVES THE TIER BLANK rather than guessing one', () => {
  withPrices(() => {
    const got = toBillingEvent({
      type: 'invoice.paid', created: at,
      data: { object: { metadata: { accountId: 'acc_1' }, lines: { data: [{ price: { id: 'price_made_in_the_dashboard' } }] } } },
    });
    // `applyBilling()` then leaves the tier where it is — which is right: a
    // plan this app has never heard of must not move anybody.
    assert.equal(got.tier, '');
  });
});

test('every other Stripe event is ignored, and that is not a failure', () => {
  withPrices(() => {
    for (const type of ['customer.subscription.updated', 'charge.succeeded', 'payment_intent.created']) {
      assert.equal(toBillingEvent({
        type, created: at, data: { object: { metadata: { accountId: 'acc_1' } } },
      }), null, `${type} was acted on`);
    }
  });
});

// ------------------------------------------------------------------ the tiers

test('a tier maps to a price and back, and NOTHING ELSE DOES', () => {
  withPrices(() => {
    assert.equal(priceForTier('gold'), 'price_gold');
    assert.equal(tierForPrice('price_gold'), 'gold');
    // The whole `wantedTier` rule: a string out of a request body that is not
    // one of the three tiers gets no price, so no checkout, so no grant.
    for (const junk of ['platinum', 'owner', '', 'GOLD', '../gold', 'price_gold']) {
      assert.equal(priceForTier(junk), '', `"${junk}" resolved to a price`);
    }
    assert.equal(tierForPrice('price_not_ours'), '');
    assert.equal(tierForPrice(''), '');
  });
});

test('nothing is on sale without a key and a price', () => {
  const before = { ...process.env };
  try {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_BRONZE;
    delete process.env.STRIPE_PRICE_SILVER;
    delete process.env.STRIPE_PRICE_GOLD;
    assert.equal(stripeConfigured(), false);
    assert.deepEqual(sellableTiers(), []);
    // A key with no prices sells nothing either — which is what stops a
    // half-finished setup drawing a Subscribe button that 400s.
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    assert.equal(stripeConfigured(), false);
  } finally {
    for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_BRONZE', 'STRIPE_PRICE_SILVER', 'STRIPE_PRICE_GOLD']) {
      if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k];
    }
  }
});

test('AND THE TIERS GO ON SALE ONE AT A TIME', () => {
  const before = process.env.STRIPE_PRICE_SILVER;
  withPrices(() => {
    delete process.env.STRIPE_PRICE_SILVER;
    // A rung with no price behind it stays a price list — the console reads
    // this list, so a half-configured Stripe cannot draw a dead button.
    assert.deepEqual(sellableTiers(), ['bronze', 'gold']);
  });
  if (before === undefined) delete process.env.STRIPE_PRICE_SILVER; else process.env.STRIPE_PRICE_SILVER = before;
});

test('the form encoder writes the nested shape Stripe actually reads', () => {
  const body = formEncode({
    mode: 'subscription',
    line_items: [{ price: 'price_gold', quantity: 1 }],
    subscription_data: { metadata: { accountId: 'acc_1' } },
    skipped: '',
  });
  // Decoded before matching: the brackets are percent-encoded on the wire,
  // which is what `x-www-form-urlencoded` means and what Stripe reads.
  const readable = decodeURIComponent(body);
  assert.match(readable, /line_items\[0\]\[price\]=price_gold/);
  assert.match(readable, /subscription_data\[metadata\]\[accountId\]=acc_1/);
  assert.equal(body.includes('skipped'), false, 'an empty value was sent');
});
