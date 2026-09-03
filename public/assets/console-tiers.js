/**
 * ================================================== WHICH RUNG YOU ARE ON
 *
 * Three named rungs — Bronze, Silver, Gold — with yours lit in its metal and
 * the ones above it locked. Pressing any of them opens a small card naming
 * what that rung holds.
 *
 * Asked for on 3 September 2026, off the owner's own hat switch: *"I've got a
 * little button that I can switch between gold, silver, and bronze. I feel
 * like all of the Quizmaster accounts should get that as well. But obviously,
 * if they're only paying for bronze then silver and gold should be greyed out,
 * and maybe a tooltip should come out trying to sell it."*
 *
 * **IT LOOKS LIKE THE OWNER'S CONTROL AND IT IS THE OPPOSITE OF IT, WHICH IS
 * WHY IT USES WORDS.** `tierPreview()` in `client.js` is a DOWNGRADE tool: it
 * makes the owner's comped account render as a Bronze subscriber, so *"Rob
 * says the Invoices tab has gone"* is answerable. This one can only ever sell,
 * and **must never change what the console renders** — pressing Gold on a
 * Bronze account has to be inert, or Gold is free. Two identical-looking
 * controls meaning opposite things is exactly the label collision this repo
 * keeps finding, and the owner is the one person who sees both (his own switch
 * in the topbar, this on the quizmaster hat's account page). So the owner's
 * keeps its initials — he uses it daily and a topbar corner has no room — and
 * this one spells the words out.
 *
 * **AND THE WORDS ARE ALSO WHAT MAKES IT READABLE.** Rendered at the real size
 * before choosing: a locked `S` and `G` at `opacity: 0.5` in 24px chips are two
 * grey dots somebody has to decode. Nobody outside this codebase has ever seen
 * that control.
 *
 * **A LOCKED RUNG IS PRESSABLE, WHICH IS THE WHOLE POINT.** `disabled` would
 * grey it correctly and then swallow the press — the sell is the reason it is
 * there, so it is `.locked` and a real button. That is not a break of *nothing
 * clickable is a flat grey box*: it carries its metal, dimmed.
 *
 * **NOT A NATIVE `title`.** A hover tooltip is an unstyled box that lands over
 * whatever is beneath it and does nothing at all on a touchscreen, which is
 * where the host usually is — the same reasoning that took `title` out of the
 * bay rail. It is a card, and it closes on an outside click, because a popover
 * only its own button can close is a trap.
 *
 * **EVERY RUNG ANSWERS, including the one you are on.** A row where two of the
 * three do something is one you have to learn; the same rule the gap dial runs
 * on — every state is a real answer.
 *
 * **BUILT FROM `ladderFor()`, never written out**, so a feature moving tier in
 * `FEATURE_TIER` moves here too and this cannot start quoting a rung that is
 * not the one being sold.
 */
import { esc, node } from './client.js';
import { NOT_BUILT } from './plans.js';

/** £30 a month, £15 a month, or "included". Pence in, words out. */
export function priceLabel(pence) {
  if (!pence) return 'included';
  return `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)} a month`;
}

/*
 * ONE DOCUMENT LISTENER FOR EVERY ROW, not one per render.
 *
 * The account page is rebuilt on every state push, so a listener added per row
 * would leak one per repaint — `console-pick.js`'s rule, and the same fix.
 * `openRow` is the row currently showing a card, so opening one shuts another.
 */
let openRow = null;

function shut() {
  if (!openRow) return;
  for (const b of openRow.querySelectorAll('.tier-rung')) b.setAttribute('aria-expanded', 'false');
  const card = openRow.querySelector('.tier-card');
  if (card) card.hidden = true;
  openRow = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (ev) => {
    if (openRow && !openRow.contains(ev.target)) shut();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') shut();
  });
}

/**
 * What a rung actually holds, as lines — the packs it carries, then the
 * capabilities that START at it.
 *
 * `ladderFor()` has already filtered `features` to the ones whose tier IS this
 * rung, so the list reads as "what this one adds" without any arithmetic here.
 * Something on the ladder but not built says so: a rung listing a thing that
 * does not exist is one nobody trusts the rest of.
 */
function addsOf(tier) {
  const lines = [];
  if (tier.content && tier.content.label) lines.push({ words: tier.content.label, soon: false });
  for (const f of tier.features || []) {
    lines.push({ words: f.label, soon: NOT_BUILT.includes(f.id) });
  }
  return lines;
}

/**
 * The row itself.
 *
 * @param {object} ent  `me.entitlements` — the ladder, and whether a live
 *   trial is widening it. Passed in rather than imported so this module stays
 *   a leaf.
 * @returns {Element|null}  null when there is no ladder to draw: the OWNER,
 *   whose `ladder` is empty because none of it is for sale to him.
 */
export function tierRow(ent) {
  const ladder = (ent && ent.ladder) || [];
  if (ladder.length < 2) return null;

  /*
   * WHICH RUNG IS YOURS is the one you are PAYING for, never what a trial has
   * switched on. `included` is rank-based and stays the answer to "what am I
   * billed for"; the trial is said separately, below, because during one every
   * rung genuinely works and a locked Gold would be the app lying about its
   * own behaviour.
   */
  const mine = ladder.reduce((best, t, i) => (t.included ? i : best), -1);
  const previewing = Boolean(ent && ent.previewing);
  const stateOf = (i) => (i <= mine ? 'yours' : previewing ? 'trial' : 'locked');
  const words = { yours: 'yours', trial: 'on trial', locked: 'not included' };

  const el = node(`
    <div class="rung-row">
      <div class="tier-rungs" role="group" aria-label="Your tier">
        ${ladder.map((t, i) => `
          <button type="button" class="tier-rung tier-${esc(t.id)} is-${stateOf(i)}"
                  data-tier="${esc(t.id)}" aria-expanded="false"
                  aria-label="${esc(t.label)} — ${esc(words[stateOf(i)])}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="tier-card" hidden></div>
    </div>`);

  const card = el.querySelector('.tier-card');

  const paint = (tier, state) => {
    const adds = addsOf(tier);
    card.innerHTML = `
      <div class="tier-card-head tier-${esc(tier.id)}">
        <b>${esc(tier.label)}</b>
        <span class="tiny">${esc(priceLabel(tier.pence))}</span>
      </div>
      ${adds.length ? `<ul class="tier-adds">${adds.map((a) => `
        <li>${esc(a.words)}${a.soon ? ' <span class="cmp-soon">not yet</span>' : ''}</li>`).join('')}</ul>` : ''}
      <div class="tiny tier-card-foot">${
  state === 'yours' ? 'This is the one you are on.'
    : state === 'trial' ? 'Switched on for the rest of your trial.'
      /*
       * NO BUTTON, BECAUSE THERE IS NOTHING TO PRESS YET — payments are not
       * wired, so a Subscribe here would be a control that does nothing, which
       * is worse than the sentence. This is the line that becomes the button
       * the day the processor lands, and it is the same wording the expired
       * trial already uses.
       */
      : 'Get in touch to move up.'}</div>`;
  };

  for (const button of el.querySelectorAll('.tier-rung')) {
    button.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const wasOpen = button.getAttribute('aria-expanded') === 'true';
      shut();
      if (wasOpen) return;
      const i = ladder.findIndex((t) => t.id === button.dataset.tier);
      if (i < 0) return;
      paint(ladder[i], stateOf(i));
      card.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      openRow = el;
    });
  }
  return el;
}
