/**
 * STRIPE — the first and only processor adapter.
 *
 * `src/billing.js` sets the rule this file obeys: **nothing outside a
 * processor's own adapter may know which processor it is.** This translates
 * Stripe's webhooks into the five events `applyBilling()` understands and
 * knows nothing about accounts; `billing.js` applies those events and knows
 * nothing about Stripe. There is a test that greps for the word.
 *
 * ---
 *
 * **NO DEPENDENCIES, INCLUDING STRIPE'S OWN SDK.** That is the oldest decision
 * in this repo and it costs almost nothing here: Stripe's API is
 * form-encoded HTTP and its webhook signature is an HMAC that node's own
 * `crypto` computes. The SDK would bring ~40 transitive packages onto the one
 * server that holds a live connection to every phone in a pub.
 *
 * **THE ACCOUNT ID TRAVELS WITH THE SUBSCRIPTION, NEVER WITH THE SESSION
 * ALONE.** It goes on the Checkout Session as `client_reference_id` AND into
 * `subscription_data.metadata.accountId`, because the renewal events months
 * later have no session on them at all — only the subscription. Getting that
 * wrong means the first payment lands and every renewal after it is an event
 * this app cannot attribute to anybody.
 *
 * **THE TIER COMES FROM THE PRICE ID, NEVER FROM THE REQUEST.** `wantedTier`
 * must never become `tier` — a rung read out of a request body and granted
 * hands anybody Gold for nothing. The browser asks for a tier, this file turns
 * that into one of THREE price ids it holds, and the tier an account actually
 * gets is read back off whatever Stripe says was paid for.
 *
 * **A WEBHOOK IS UNAUTHENTICATED UNTIL THE SIGNATURE SAYS OTHERWISE.** The URL
 * is the only secret and it will end up in a log somewhere, so the signature
 * is the whole gate. It is checked against the RAW BYTES — parsing and
 * re-serialising changes them and every check then fails — and against a
 * timestamp, or a captured payload can be replayed for ever.
 */

import crypto from 'node:crypto';

import { TIERS } from '../public/assets/plans.js';

const API = 'https://api.stripe.com/v1';

/**
 * How far out of step a webhook's own timestamp may be. Stripe's own
 * recommendation, and it is a REPLAY window rather than a clock-skew
 * allowance: a payload captured off a log is worthless five minutes later.
 */
export const TOLERANCE_SECONDS = 300;

/** The three price ids, from the environment. One line each in Render. */
export const priceIds = () => ({
  bronze: process.env.STRIPE_PRICE_BRONZE || '',
  silver: process.env.STRIPE_PRICE_SILVER || '',
  gold: process.env.STRIPE_PRICE_GOLD || '',
});

export const secretKey = () => process.env.STRIPE_SECRET_KEY || '';
export const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * Is there enough here to sell anything?
 *
 * **The console asks this before it draws a Subscribe button** — the rule
 * recorded on the rungs is *no subscribe button until there is a processor*,
 * and a button that opens a 500 is worse than no button. It wants the key AND
 * at least one price: a key with no prices sells nothing.
 */
export function stripeConfigured() {
  const prices = priceIds();
  return Boolean(secretKey()) && Object.values(prices).some(Boolean);
}

/** Which tiers can actually be bought right now — the ones with a price id. */
export function sellableTiers() {
  const prices = priceIds();
  return TIERS.filter((t) => prices[t.id]).map((t) => t.id);
}

/** The price for a tier, or '' — validated against `TIERS`, never trusted. */
export function priceForTier(tier) {
  const id = String(tier || '');
  if (!TIERS.some((t) => t.id === id)) return '';
  return priceIds()[id] || '';
}

/** And back, which is the direction that decides what somebody is GRANTED. */
export function tierForPrice(priceId) {
  const id = String(priceId || '');
  if (!id) return '';
  const found = Object.entries(priceIds()).find(([, price]) => price && price === id);
  return found ? found[0] : '';
}

/**
 * Stripe's `Stripe-Signature` header, checked against the raw bytes.
 *
 * The header looks like `t=1699999999,v1=<hex>,v1=<hex>` — more than one `v1`
 * while a secret is being rotated, so EVERY one is tried and any match passes.
 * Checking only the first would break silently in the middle of a rotation,
 * which is exactly when nobody is watching the webhook log.
 *
 * @param {Buffer|string} raw   the request body, unparsed
 * @param {string} header       the Stripe-Signature header
 * @param {string} secret       the endpoint's signing secret
 * @param {object} [opts]       `now` in ms, injected like every clock here
 */
export function verifySignature(raw, header, secret, { now = () => Date.now() } = {}) {
  if (!secret) return { ok: false, reason: 'no signing secret is configured' };
  if (!header) return { ok: false, reason: 'no signature on the request' };

  const parts = String(header).split(',').map((p) => p.trim());
  const stamp = (parts.find((p) => p.startsWith('t=')) || '').slice(2);
  const sent = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!stamp || !sent.length) return { ok: false, reason: 'the signature header is not the shape Stripe sends' };

  const seconds = Number(stamp);
  if (!Number.isFinite(seconds)) return { ok: false, reason: 'the signature has no usable timestamp' };
  const drift = Math.abs(Math.floor(now() / 1000) - seconds);
  if (drift > TOLERANCE_SECONDS) return { ok: false, reason: `the signature is ${drift}s out of date` };

  const body = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
  const want = crypto.createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${stamp}.`, 'utf8'), body]))
    .digest('hex');

  /*
   * `timingSafeEqual` needs equal lengths or it THROWS rather than returning
   * false — so the length is checked first, and a wrong-length signature is
   * simply wrong. It is a hex digest either way, so this leaks nothing.
   */
  const matched = sent.some((sig) => sig.length === want.length
    && crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(want, 'utf8')));
  if (!matched) return { ok: false, reason: 'the signature does not match' };

  try {
    return { ok: true, event: JSON.parse(body.toString('utf8')) };
  } catch {
    return { ok: false, reason: 'a correctly signed body that is not JSON' };
  }
}

/**
 * One Stripe event, as one of the five things a processor may say — or null.
 *
 * **NULL IS THE COMMON ANSWER AND IS NOT A FAILURE.** Stripe sends dozens of
 * event types and this app acts on five things; the route answers 200 to the
 * rest, because a webhook endpoint that errors on an event it simply does not
 * care about makes Stripe retry it for hours.
 */
export function toBillingEvent(raw = {}) {
  const type = String(raw.type || '');
  const object = (raw.data && raw.data.object) || {};
  const at = Number(raw.created) * 1000;
  if (!Number.isFinite(at) || at <= 0) return null;

  /*
   * WHERE THE ACCOUNT ID IS depends on which object arrived, so it is asked
   * for in one place. `client_reference_id` is the Checkout Session's; the
   * metadata is what every later subscription and invoice event carries.
   */
  const accountId = String(
    object.client_reference_id
    || (object.metadata && object.metadata.accountId)
    || (object.subscription_details && object.subscription_details.metadata
      && object.subscription_details.metadata.accountId)
    || '',
  ).trim();
  if (!accountId) return null;

  /*
   * AND THE TIER COMES OFF THE LINE ITEM'S PRICE, which is the only thing in
   * the payload that says what was actually paid for. An unknown price is a
   * plan somebody made in the dashboard that this app has never heard of —
   * left blank, so `applyBilling()` keeps the tier where it is rather than
   * guessing one.
   */
  const priceId = String(
    (object.plan && object.plan.id)
    || (object.items && object.items.data && object.items.data[0]
      && object.items.data[0].price && object.items.data[0].price.id)
    || (object.lines && object.lines.data && object.lines.data[0]
      && object.lines.data[0].price && object.lines.data[0].price.id)
    || '',
  );
  const tier = tierForPrice(priceId);

  const base = {
    accountId,
    at,
    processor: 'stripe',
    reference: String(object.subscription || object.id || '').slice(0, 120),
    // The customer, so the billing portal has something to open. Only the
    // first event of a subscription reliably names one; `setBilling()` keeps
    // the last it saw rather than blanking it on every renewal.
    customer: String(object.customer || '').slice(0, 120),
  };

  /*
   * THE MAP, and it is deliberately short. `customer.subscription.updated`
   * is NOT here: it fires for every trivial change (a card updated, a proration
   * recalculated) and acting on it would move somebody's status for reasons
   * that are not about whether they have paid.
   */
  if (type === 'checkout.session.completed') {
    // `paid` is the one that matters — a session can complete unpaid.
    if (object.payment_status && object.payment_status !== 'paid') return null;
    return { kind: 'started', tier, ...base };
  }
  if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
    return { kind: 'renewed', tier, ...base };
  }
  if (type === 'invoice.payment_failed') {
    return { kind: 'payment_failed', ...base };
  }
  if (type === 'customer.subscription.deleted') {
    return { kind: 'cancelled', ...base };
  }
  return null;
}

/** Stripe's API is form-encoded, and nested keys are `a[b][c]`. */
export function formEncode(obj, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object' && !Array.isArray(value)) out.push(formEncode(value, name));
    else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'object') out.push(formEncode(v, `${name}[${i}]`));
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(v)}`);
      });
    } else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  return out.filter(Boolean).join('&');
}

/**
 * One call to Stripe. Injected `fetch` so a test never needs the network and
 * never needs a key — the same reason `now()` is injected everywhere here.
 */
async function call(path, body, { key = secretKey(), doFetch = fetch } = {}) {
  if (!key) return { ok: false, reason: 'Stripe is not configured on this server.' };
  let res;
  try {
    res = await doFetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formEncode(body),
    });
  } catch (err) {
    return { ok: false, reason: `could not reach Stripe: ${err.message}` };
  }
  let json = {};
  try { json = await res.json(); } catch { /* an error page rather than JSON */ }
  if (!res.ok) {
    /*
     * SAID IN STRIPE'S OWN WORDS where there are any. "No such price" is a
     * sentence somebody can act on; "402" is not, and this is the message a
     * quizmaster meets at the moment they are trying to give you money.
     */
    return { ok: false, reason: (json.error && json.error.message) || `Stripe answered ${res.status}.` };
  }
  return { ok: true, data: json };
}

/**
 * The page somebody is sent to in order to pay.
 *
 * Stripe Checkout rather than a form on this app, and that is a decision about
 * LIABILITY rather than effort: a card number that never touches this server
 * is one this server can never leak, and the invoice-book rule already here
 * says no card details are stored and none ever will be.
 */
export async function checkoutSession({
  accountId, email, tier, successUrl, cancelUrl, customerId = '',
}, opts = {}) {
  const price = priceForTier(tier);
  if (!price) return { ok: false, reason: 'That plan is not on sale here.' };

  const res = await call('/checkout/sessions', {
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    // The app's own id, on the session AND on the subscription it creates —
    // see the note at the top. A renewal in March has no session on it.
    client_reference_id: accountId,
    ...(customerId ? { customer: customerId } : { customer_email: email }),
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { accountId } },
    allow_promotion_codes: 'true',
  }, opts);
  if (!res.ok) return res;
  return { ok: true, url: res.data.url, id: res.data.id };
}

/**
 * Where somebody goes to change their card, see their invoices or stop paying.
 *
 * **STRIPE'S OWN PORTAL, and cancelling is deliberately not built here.** A
 * cancel button on this app would be a second place a subscription can end,
 * and the two would disagree the first time one of them failed. It also means
 * the honest answer to "how do I stop paying" is a link rather than an email.
 */
export async function portalSession({ customerId, returnUrl }, opts = {}) {
  if (!customerId) return { ok: false, reason: 'There is no subscription on this account yet.' };
  const res = await call('/billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
  }, opts);
  if (!res.ok) return res;
  return { ok: true, url: res.data.url };
}
