/**
 * THE SHOP WINDOW'S OWN CARD — a pack you do not hold, and the way to buy it.
 *
 * ---
 *
 * A SEAM TAKEN RATHER THAN A LINE BUDGET RAISED, which is `console-breaks.js`
 * and `console-warnings.js`'s shape. Wiring the £3 Buy button put
 * `console-packs.js` over its cap, and the honest answer to that is to take
 * something out rather than to move the number: buying is not launching, and it
 * is the one thing on this shelf that talks to a payment processor.
 *
 * It imports `packPrice` and `freshLabel` back from `console-packs.js`. That is a
 * cycle, and it is the kind the split guard explicitly allows — both are
 * function DECLARATIONS, so they are hoisted. **State is what may not go round a
 * cycle**, which is why `console-state.js` imports nothing.
 */

import { esc, node, postJson } from './client.js';
import { me } from './console-state.js';
import { freshLabel, freshness, packPrice } from './console-packs.js';

/**
 * CAN THIS APP TAKE MONEY FOR A PACK AT ALL?
 *
 * `me.canBuy` is the SERVER's answer and is empty until the Stripe keys are set
 * — the same field the tier rungs read, so the shop and the ladder cannot
 * disagree about whether anybody can pay. Deliberately not a separate flag: one
 * question, one source.
 *
 * It is a list of TIERS on sale, and a pack sale needs no price in the dashboard
 * — it is built from PACK_PENCE — so the secret key being present is the whole
 * test, and that is what a non-empty list means.
 */
function onSale() {
  return Boolean(me && Array.isArray(me.canBuy) && me.canBuy.length);
}

/**
 * A pack on the shelf rather than in the library.
 *
 * It shows the title, how big it is and what it costs — and deliberately not a
 * word of what is inside. That is enforced on the SERVER, which strips the
 * search blob and the playlist link out of a locked summary before it is sent,
 * because a padlock drawn over a payload that still contained every question
 * and answer would be decoration rather than a lever.
 *
 * **BUY TAKES REAL MONEY NOW — one-off Stripe Checkout, 13 September 2026.** It
 * used to be an `alert()` saying there was no way to pay, which is what the
 * whole Bronze rung is FOR: Bronze buys packs, Silver includes them.
 *
 * Three things about it are the rules rather than the implementation:
 *
 * - **NOTHING HERE GRANTS ANYTHING.** The browser names a pack; the server
 *   checks it is really on the shelf, refuses one this account can already play,
 *   and prices it from `PACK_PENCE`. What lands in the library comes off the
 *   webhook, so a reply arriving or not changes nothing about what was bought.
 * - **PRESENT AND INERT WHERE THERE IS NO PRICE** — `onSale()` below. A control
 *   that comes and goes is one you cannot learn the position of.
 * - **A refusal lands ON the card**, beside the pack it is about. *"You already
 *   have that one"* and Stripe's own words are both sentences somebody can act
 *   on, and neither belongs in a dialog.
 */
export function shopCard(kind, pack) {
  const roundCount = (pack.rounds || []).length;
  const detail = kind === 'quiz'
    ? `${pack.questionCount} question${pack.questionCount === 1 ? '' : 's'} · ${roundCount} round${roundCount === 1 ? '' : 's'}`
    : `${pack.trackCount} track${pack.trackCount === 1 ? '' : 's'}`;

  /*
   * A dated pack says so on the shelf, and that is the one thing the shop
   * window genuinely needs to tell you.
   *
   * Every other locked card is worth the same in a month's time; a topical one
   * is worth the most this week and nothing much after it. Leaving that off
   * makes the strongest card in the shop look like the weakest — an unfamiliar
   * title with no theme anybody recognises.
   */
  const { topical, expired } = freshness(pack);

  const el = node(`
    <div class="pack-card locked">
      <div class="pack-title">${esc(pack.title)}</div>
      <div class="tiny">${esc(detail)}</div>
      ${topical ? `<div class="tiny fresh ${expired ? 'gone' : ''}">${esc(freshLabel(pack))}</div>` : ''}
      <!-- GREEN, because money is green everywhere in this app — the same
           language as "paying" on an account and "makes something" on a
           button. It is a marker rather than a control: the whole card is
           already about buying, and a price you can press as well as a Buy
           button underneath it is two controls for one job. -->
      <div class="shop-price">${esc(packPrice())}</div>
      <!-- PRESENT AND INERT WHERE THERE IS NO WAY TO PAY, never absent and never
           an alert(): a control that comes and goes is one you cannot learn the
           position of, and an alert for something the app already knows is a
           dialog instead of a label. See onSale() below.
           NO BACKTICKS IN HERE — this comment is inside a template literal, and
           one terminated the string: console.js was a syntax error for a whole
           deploy that way, and only a parse check sees it. Nor a bare command
           line: console-split.test.js strips JS comments, not HTML ones inside a
           template, and read a minus-minus flag as a decrement. -->
      <button class="go buy" ${onSale() ? '' : 'disabled'}>${
  onSale() ? 'Buy it' : 'Not on sale yet'}</button>
    </div>`);

  /*
   * ONE PACK, ONE CHECKOUT — and nothing here grants anything.
   *
   * The browser names a pack; the SERVER checks it is really on the shelf, that
   * this account cannot already play it, and prices it from `PACK_PENCE`. What
   * lands in the library comes off the webhook, so a reply arriving or not
   * changes nothing about what was bought.
   */
  el.querySelector('.buy').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    if (btn.disabled) return;
    // SAYS SO WHILE IT WAITS. A Checkout session is a round trip, and a button
    // that looks unpressed gets pressed twice — which on this one would be two
    // sessions for one pack.
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = 'Opening\u2026';
    try {
      const got = await postJson('/api/buy-pack', { packId: pack.id, kind });
      if (got && got.url) { location.href = got.url; return; }
      btn.disabled = false;
      btn.textContent = was;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = was;
      /*
       * THE REASON GOES ON THE CARD, not in a dialog. "You already have that
       * one" and Stripe's own words are both sentences somebody can act on, and
       * they belong beside the pack they are about.
       */
      const said = el.querySelector('.shop-why') || node('<div class="tiny warn shop-why"></div>');
      said.textContent = err.message || 'Could not open the payment page.';
      if (!said.isConnected) el.append(said);
    }
  });
  return el;
}
