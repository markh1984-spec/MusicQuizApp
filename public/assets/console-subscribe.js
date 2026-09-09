/**
 * THE RUNGS PLUS WHAT YOU DO ABOUT THEM — the row, and the two controls that
 * talk to Stripe.
 *
 * **ITS OWN MODULE BECAUSE `console-tiers.js` MAY NOT MAKE A NETWORK CALL.**
 * There is a guard on that file forbidding `postJson`, `fetch(` and `act-as`
 * outright — the rungs SELL a tier and must never be able to change what an
 * account holds, and the way that promise stays true is that the file cannot
 * reach the server at all. Adding a Subscribe button to it would have been
 * one small exception to a rule whose whole value is having none.
 *
 * So the row stays presentational and this holds the wiring. **It grants
 * nothing either**: both controls open a page on Stripe, and the webhook is
 * the only thing in this app that moves a tier. Pressing Gold on a Bronze
 * account changes nothing here, whatever the reply says.
 *
 * A leaf, like `console-tiers.js` — `ent` and `me` are handed in rather than
 * imported.
 */

import { node, postJson } from './client.js';
import { tierRow } from './console-tiers.js';

/**
 * @param {object} ent  `me.entitlements`
 * @param {object} me   the account, for `canBuy` and `hasBilling`
 * @returns {Node}  a fragment — the row, and the portal link if there is one
 */
export function subscribeSlot(ent, me) {
  const out = document.createDocumentFragment();

  /*
   * The reason comes BACK to the button rather than to an `alert()`: this
   * happens on a click, and "That plan is not on sale here" — or Stripe's own
   * words — belongs on the card being read. An empty string means it worked
   * and the page is already leaving.
   */
  const buy = async (tier) => {
    try {
      const res = await postJson('/api/subscribe', { tier });
      if (res && res.url) { location.href = res.url; return ''; }
      return 'Could not open the payment page. Try again in a moment.';
    } catch (err) {
      return err.message || 'Could not open the payment page.';
    }
  };

  out.append(tierRow(ent, { canBuy: (me && me.canBuy) || [], onBuy: buy })
    || document.createComment('no ladder'));

  /*
   * AND THE WAY OUT, drawn only where there IS a subscription to manage —
   * Stripe's portal 400s without a customer, and a dead link on the page
   * somebody visits in order to cancel is the worst possible place for one.
   *
   * **Cancelling is not built here on purpose**: a second place a
   * subscription can end is a second place it can disagree with the first.
   */
  if (me && me.hasBilling) {
    const manage = node('<div class="row acct-actions"><button class="minor" id="acctBilling">Your subscription and card</button></div>');
    manage.querySelector('#acctBilling').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        const res = await postJson('/api/billing/portal', {});
        if (res && res.url) { location.href = res.url; return; }
        btn.disabled = false;
      } catch (err) {
        btn.disabled = false;
        btn.textContent = err.message || 'Could not open it just now.';
      }
    });
    out.append(manage);
  }
  return out;
}
