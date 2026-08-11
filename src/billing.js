/**
 * What a payment processor is allowed to say to this app.
 *
 * PayPal is what gets wired up first — a business account already exists for
 * the kids' party side — but the rate is 2.9% and Stripe is cheaper, so a move
 * is likely rather than hypothetical. CLAUDE.md has said from the beginning
 * that payments stay processor-agnostic; this file is what makes that
 * structural instead of a good intention.
 *
 * ---
 *
 * **The rule: nothing outside a processor's own adapter may know which
 * processor it is.** `src/paypal.js` translates PayPal's webhooks into the
 * five events below and knows nothing about accounts; this file applies those
 * events to an account and knows nothing about PayPal. Swapping to Stripe is
 * then one new adapter file and one route — not a search through the codebase
 * for the word "paypal". There is a test that greps for exactly that.
 *
 * **A webhook may only ever move a SUBSCRIPTION.** It can set the tier and the
 * status and store an opaque reference, and that is the whole list. It can
 * never set `comped`, `role`, `packs` or a password — the same wall that stops
 * a preferences payload handing out a tier, for a stronger reason: this
 * endpoint is reachable by anybody who can find the URL, and the signature
 * check is the only thing standing in front of it. A bug there should cost a
 * wrong tier, never an account.
 *
 * **Out of order must never roll a subscription backwards.** Webhooks retry
 * and arrive out of sequence, so a stale "cancelled" landing after a fresh
 * "started" would close an account somebody has just paid for. Every event
 * carries its own timestamp and an older one than the last applied is ignored
 * — the same lesson the invoice counter learned, where believing a stale
 * backup would have reissued a number already on somebody's invoice.
 */

/**
 * The five things a processor may say. Deliberately small: anything that does
 * not fit one of these is something the app should not be reacting to
 * automatically.
 */
export const BILLING_EVENTS = [
  'started',        // they subscribed, or moved to a different tier
  'renewed',        // this month was paid
  'payment_failed', // the card was refused
  'cancelled',      // they stopped it, or the processor did
  'expired',        // it ran out and was not renewed
];

/**
 * What each event does to an account.
 *
 * Note what `payment_failed` and `cancelled` do NOT do: they leave the tier
 * exactly where it is and only move the status. That is not laziness, it is
 * the rule this codebase already has tests for — **a lapsed subscription never
 * interrupts a night.** `allowed(..., { live: true })` keeps a running game
 * going whatever the status says, and `mayStartSomething` is what actually
 * refuses. Dropping somebody's tier on a failed payment would take their packs
 * away mid-week for a card that expired on a Tuesday.
 */
const OUTCOME = {
  started: { status: 'active', takesTier: true },
  renewed: { status: 'active', takesTier: true },
  payment_failed: { status: 'past_due', takesTier: false },
  cancelled: { status: 'cancelled', takesTier: false },
  expired: { status: 'cancelled', takesTier: false },
};

/** Is this a shape this app will act on at all? */
export function readEvent(raw = {}) {
  const kind = String(raw.kind || '');
  if (!BILLING_EVENTS.includes(kind)) return { ok: false, reason: `not an event this app acts on: "${kind}"` };

  const accountId = String(raw.accountId || '').trim();
  if (!accountId) return { ok: false, reason: 'no account on the event' };

  const at = Number(raw.at);
  if (!Number.isFinite(at) || at <= 0) return { ok: false, reason: 'no usable timestamp' };

  return {
    ok: true,
    event: {
      kind,
      accountId,
      at,
      // Optional, and only meaningful on the two events that carry a tier.
      tier: raw.tier ? String(raw.tier) : '',
      // Whatever the processor calls this subscription. Stored and never
      // interpreted here — it exists so a human can find the same thing in the
      // processor's own dashboard, and so a second processor's ids cannot be
      // confused with the first one's.
      processor: String(raw.processor || '').slice(0, 24),
      reference: String(raw.reference || '').slice(0, 120),
    },
  };
}

/**
 * Apply one event to the accounts book.
 *
 * Never throws for an event it does not like — a webhook endpoint that 500s
 * makes the processor retry the same bad payload for hours. It reports and the
 * route answers 200, because "received and ignored" is the honest answer to a
 * message this app has no business acting on.
 *
 * @param {object} accounts  the Accounts book
 * @param {object} raw       an event from an adapter, already verified
 */
export function applyBilling(accounts, raw = {}) {
  const read = readEvent(raw);
  if (!read.ok) return { ok: false, reason: read.reason };
  const { event } = read;

  const account = accounts.find(event.accountId);
  if (!account) return { ok: false, reason: 'no account with that id' };
  /*
   * The owner has no subscription, and `accounts.update()` throws on one.
   * Reaching here means a processor has an owner's id against a subscription,
   * which is worth reporting rather than crashing on.
   */
  if (account.role === 'owner') return { ok: false, reason: 'the owner has no subscription' };

  const billing = account.billing || {};
  if (Number(billing.at) > event.at) {
    // Stale. Retries and out-of-order delivery are normal; letting one close
    // an account that has since been paid for is not.
    return { ok: false, reason: 'an older event than the one already applied', stale: true };
  }

  const outcome = OUTCOME[event.kind];
  const patch = { status: outcome.status };
  if (outcome.takesTier && event.tier) patch.tier = event.tier;

  try {
    accounts.update(event.accountId, patch);
  } catch (err) {
    // An unknown tier is the likely one — a plan in the processor that this
    // app has never heard of. Report it; do not guess a tier.
    return { ok: false, reason: err.message };
  }

  /*
   * The receipt, stored on the account.
   *
   * `processor` is on it deliberately: during a migration both will be live
   * for a while, and "which of the two is actually billing this person" is the
   * question somebody will need to answer at speed. `reference` is opaque here
   * and only means something in that processor's dashboard.
   */
  accounts.setBilling(event.accountId, {
    processor: event.processor,
    reference: event.reference,
    at: event.at,
    last: event.kind,
  });

  return { ok: true, kind: event.kind, tier: patch.tier || account.tier, status: patch.status };
}
