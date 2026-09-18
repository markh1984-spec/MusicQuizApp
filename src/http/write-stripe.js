/**
 * WRITE ROUTES — stripe. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { HOUSE, PACK_PENCE, accounts, applyBilling, billingEmail, canPlayPack, checkoutSession, config, emailConfigured, fullLibrary, http, packCheckoutSession, portalSession, sendEmail, stripeConfigured, toBillingEvent, toPackPurchase, verifySignature, webhookSecret } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { whoIs } from './identity.js';
import { backUpAccounts } from './helpers.js';

export async function writeStripe(req, res, url, route) {
  /*
   * ---- STRIPE
   *
   * THE WEBHOOK IS FIRST IN THIS FUNCTION BECAUSE IT NEEDS THE RAW BYTES.
   * The signature is an HMAC over the body exactly as it was sent, so parsing
   * it and re-serialising changes it and every check then fails — a fault
   * that looks like a wrong secret and is not. `readJson()` consumes the
   * stream, so nothing may reach it before this.
   *
   * **AND IT ANSWERS 200 TO ALMOST EVERYTHING.** Stripe sends dozens of event
   * types; this app acts on five things. An endpoint that errors on an event
   * it does not care about makes Stripe retry it for hours and eventually
   * disable the endpoint — which is the whole subscription plumbing going
   * quiet with nothing on screen to say so. 400 is reserved for the one thing
   * that IS an emergency: a body that does not carry a valid signature.
   */
  if (route === '/api/stripe/webhook' && req.method === 'POST') {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      // A webhook is small. A body far past that is not Stripe.
      if (total > 512 * 1024) return sendJson(res, 400, { error: 'too big' }), true;
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks);
    const checked = verifySignature(raw, req.headers['stripe-signature'], webhookSecret());
    if (!checked.ok) {
      // Said out loud in the log, never to the caller: which half of the check
      // failed is exactly what somebody probing would like to know.
      console.warn('[stripe] refused a webhook:', checked.reason);
      return sendJson(res, 400, { error: 'signature' }), true;
    }

    /*
     * A PACK SOMEBODY BOUGHT — ITS OWN BRANCH, AND IT MAY NOT GO THROUGH
     * `applyBilling()`.
     *
     * That function is a pure translation of a billing event into a status and
     * a tier, with a hard rule that it writes nothing else and a test pinning
     * the list. A one-off purchase writes `account.bought`, so it gets its own
     * door rather than a hole in that one.
     *
     * **The pack id is the one this server put on the session**, having checked
     * it against the real catalogue before charging anybody — Stripe hands it
     * straight back, so the same rule holds as for the tier: what is granted
     * comes off what was actually paid for, never off a request.
     */
    const bought = toPackPurchase(checked.event);
    if (bought) {
      const granted = accounts.grantPack(bought.accountId, bought.packId);
      if (granted) {
        await backUpAccounts();
        console.log(`[stripe] ${bought.accountId} bought ${bought.packId} for ${bought.pence}p`);
      } else {
        // Said out loud rather than swallowed: somebody has paid and the app
        // could not find their account, which is the one case here that needs
        // a human.
        console.error(`[stripe] PAID BUT NOT GRANTED — no account ${bought.accountId} for pack ${bought.packId}`);
      }
      return sendJson(res, 200, { ok: true, pack: bought.packId }), true;
    }

    const event = toBillingEvent(checked.event);
    if (!event) return sendJson(res, 200, { ok: true, ignored: String(checked.event.type || '') }), true;

    const result = applyBilling(accounts, event);
    if (result.ok) {
      await backUpAccounts();
      const mail = billingEmail(result, accounts.find(event.accountId));
      if (mail && emailConfigured()) {
        sendEmail(mail).catch((err) => console.warn('[stripe] could not email:', err.message));
      }
    } else {
      // Reported rather than thrown — see `applyBilling()`. A stale retry is
      // normal and is not a fault.
      console.warn('[stripe]', String(checked.event.type || ''), 'not applied:', result.reason);
    }
    return sendJson(res, 200, { ok: true }), true;
  }

  /*
   * WHERE A SUBSCRIBE BUTTON SENDS SOMEBODY.
   *
   * **`wantedTier` MUST NEVER BECOME `tier`.** The browser names a rung; this
   * turns that into one of three price ids the SERVER holds, and the tier the
   * account actually ends up on is read back off whatever Stripe says was
   * paid for, in the webhook above. A rung out of a request body is never
   * granted anywhere on this path.
   */
  if (route === '/api/subscribe' && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (me.bootstrap) return sendJson(res, 400, { error: 'The host key is not an account, so there is nothing to subscribe.' }), true;
    if (me.role === 'owner') return sendJson(res, 400, { error: 'The owner account has no subscription.' }), true;
    // A seat is covered by its parent — see `effective()`. Billing one
    // separately would take money for something it already holds.
    if (me.parentId) return sendJson(res, 400, { error: 'Your subscription is your group’s. Ask whoever manages it.' }), true;

    const body = await readJson(req);
    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const made = await checkoutSession({
      accountId: me.id,
      email: me.email,
      tier: String(body.tier || ''),
      // Back onto their own account page either way — the webhook is what
      // actually grants anything, so there is nothing to read off the URL.
      successUrl: `${base}/console?tab=account&paid=1`,
      cancelUrl: `${base}/console?tab=account`,
      customerId: (me.billing || {}).customer || '',
    });
    if (!made.ok) return sendJson(res, 400, { error: made.reason }), true;
    return sendJson(res, 200, { url: made.url }), true;
  }

  /*
   * BUYING ONE PACK — the £3 on-ramp, and the only thing on the ladder that is
   * not a subscription.
   *
   * **THE PACK ID IS VALIDATED AGAINST THE REAL CATALOGUE BEFORE ANYBODY IS
   * CHARGED.** An id out of a request body is the trap this codebase already
   * records at the launch route and again as `wantedTier`: here it would mean
   * being charged for a pack that does not exist, or a session carrying a name
   * the webhook would then grant. So the id has to be a pack on the shelf, and
   * the TITLE and the PRICE come off the catalogue and `PACK_PENCE` rather than
   * off the request — the customer cannot name their own price.
   *
   * **AND WHAT THEY ALREADY HOLD IS REFUSED.** Silver holds every evergreen
   * pack, so the only thing left to sell it is a TOPICAL one; a Bronze account
   * can buy anything outside its eight. Taking money for something somebody can
   * already play is the one outcome here worth refusing outright.
   */
  if (route === '/api/buy-pack' && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (me.bootstrap) return sendJson(res, 400, { error: 'The host key is not an account, so there is nothing to buy with.' }), true;
    if (me.role === 'owner') return sendJson(res, 400, { error: 'The owner holds every pack already.' }), true;
    if (!stripeConfigured()) return sendJson(res, 400, { error: 'There is no way to pay here yet.' }), true;

    const body = await readJson(req);
    const wanted = String(body.packId || '').trim();
    const kind = String(body.kind || '') === 'bingo' ? 'bingo' : 'quiz';
    if (!wanted) return sendJson(res, 400, { error: 'No pack named.' }), true;

    /*
     * THE CATALOGUE, NOT THEIR SHELF. `onlyTheirPacks()` and `withShop()` both
     * hide or strip what somebody cannot play, so resolving against either would
     * refuse the very packs this route exists to sell — the shelf-is-not-the-
     * library trap that emptied Tonight once.
     */
    const catalogue = fullLibrary(config, HOUSE);
    const pack = (catalogue[kind === 'bingo' ? 'bingo' : 'quizzes'] || [])
      .find((p) => String(p.id) === wanted);
    if (!pack) return sendJson(res, 404, { error: 'There is no pack with that name.' }), true;

    // Their own writing is not for sale to them, and a pack their tier covers is
    // not either. `canPlayPack` takes the pack so a topical one is judged as
    // topical rather than looking evergreen.
    if (pack.mine) return sendJson(res, 400, { error: 'That one is yours already.' }), true;
    if (canPlayPack(me, pack.id, pack)) {
      return sendJson(res, 400, { error: 'You already have that one.' }), true;
    }

    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const made = await packCheckoutSession({
      accountId: me.id,
      email: me.email,
      packId: pack.id,
      packKind: kind,
      title: pack.title || pack.id,
      // FROM `plans.js`, never from the request. One number, with the reasoning
      // for why it is £3 written beside it, and the shop card prints the same.
      pence: PACK_PENCE,
      // Back to the shop either way. The webhook is what grants it, so there is
      // nothing to read off the URL — `bought=` only tells the page to say so.
      successUrl: `${base}/console?door=account&tab=shop&bought=${encodeURIComponent(pack.id)}`,
      cancelUrl: `${base}/console?door=account&tab=shop`,
      customerId: (me.billing || {}).customer || '',
    });
    if (!made.ok) return sendJson(res, 400, { error: made.reason }), true;
    return sendJson(res, 200, { url: made.url }), true;
  }

  /*
   * AND WHERE THEY GO TO CHANGE A CARD OR STOP PAYING — Stripe's own portal.
   *
   * **CANCELLING IS DELIBERATELY NOT BUILT HERE.** A cancel button on this app
   * would be a second place a subscription can end, and the two would disagree
   * the first time one of them failed. It also makes the honest answer to "how
   * do I stop paying" a link rather than an email to somebody with one admin
   * day a week.
   */
  if (route === '/api/billing/portal' && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (me.bootstrap) return sendJson(res, 400, { error: 'The host key is not an account.' }), true;
    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const made = await portalSession({
      customerId: (me.billing || {}).customer || '',
      returnUrl: `${base}/console?tab=account`,
    });
    if (!made.ok) return sendJson(res, 400, { error: made.reason }), true;
    return sendJson(res, 200, { url: made.url }), true;
  }

  return false;
}
