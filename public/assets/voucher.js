/**
 * The prize, on the bar's phone.
 *
 * Somebody wins the quiz, their phone shows a QR, and the person behind the
 * bar points their own camera at it and lands here. No app, no login, nothing
 * to install — a URL is the only thing that works on a stranger's handset.
 *
 * **THE FIRST SCAN SPENDS IT, HERE, ON THE SERVER.** That is what makes a
 * screenshot harmless: the phone is not what gets checked. A copy of the code
 * arrives at the same endpoint and is told when the original went.
 *
 * But it does NOT redeem on load, and that is deliberate. The winner will scan
 * their own code out of curiosity — everybody does — and a page that burns it
 * on sight costs them their drink for looking at it. So the page SHOWS what it
 * is and the burning is a deliberate press, worded at the person behind the
 * bar. The host can put it back either way, which is the safety net rather
 * than the plan.
 */

import { esc, node } from './client.js';

const url = new URL(location.href);
const code = String(url.searchParams.get('c') || '').trim().toUpperCase();
const g = String(url.searchParams.get('g') || '').trim();
const qs = `c=${encodeURIComponent(code)}${g ? `&g=${encodeURIComponent(g)}` : ''}`;

const main = document.getElementById('main');
const show = (html) => main.replaceChildren(node(html));

/*
 * THE DEMO ONE, for showing a venue what the bar sees.
 *
 * A quizmaster selling a night wants to hand somebody a phone and let them
 * scan it — so it has to work over and over, for a different person each time,
 * and it must never touch a real night. So it is handled ENTIRELY here: no
 * request, nothing stored, and reloading gives a fresh one. Pressing the
 * button shows the used state so the whole thing can be demonstrated, and then
 * it is forgotten.
 *
 * `DEMO` cannot collide with a real code: the voucher alphabet has no vowels,
 * so `E` and `O` can never appear in one. That is a property of `newVoucherCode`
 * rather than a coincidence, and it is why this needs no reserved-word check.
 */
const DEMO = 'DEMO';

/*
 * WHOSE BAR IT IS, off the link — `?at=The+Crown`.
 *
 * A demo is shown to ONE landlord at a time, and the whole job it does is
 * getting them to picture it happening in THEIR pub. Their own name on the
 * card does that; a blank footer leaves them imagining somebody else's.
 *
 * Off the URL rather than out of an account, because the link is the product
 * here — the quizmaster builds one per venue from My account and can send it
 * ahead of the meeting. Nothing is stored and nothing is asked of the server,
 * which is what keeps the demo working in a pub at four in the afternoon with
 * no game running.
 *
 * Trimmed and capped: it is drawn straight onto the card, so a pasted essay
 * would push the reward off a phone. `esc()` still does the escaping — this is
 * only about length.
 */
const demoVenue = String(url.searchParams.get('at') || '').trim().slice(0, 60);

const demoVoucher = () => ({
  code: DEMO,
  name: 'Quizteam Aguilera',
  reward: 'A free drink at the bar',
  venue: demoVenue,
  issuedAt: Date.now(),
  redeemedAt: null,
  reinstated: 0,
  /*
   * IT SAYS IT IS A DEMONSTRATION, ON THE CARD.
   *
   * The demo exists to be handed across a table on a stranger's phone, and it
   * is pixel-identical to the real thing by design — which is exactly why it
   * has to say so. Bar staff are shown these; one left open on a phone at the
   * end of an evening is otherwise a free drink somebody can ask for, and the
   * quizmaster is not there to explain.
   *
   * The `code DEMO` in the footer was doing that job and doing it too quietly:
   * it is the smallest text on the page, next to a date, where nobody reads.
   */
  demo: true,
});

/** A time as somebody behind a bar reads it: half ten, not an ISO string. */
function clockTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function drawn(v) {
  /*
   * THE REWARD IS THE BIGGEST THING ON THE PAGE, and the name is second.
   *
   * The order is what somebody behind a bar needs in the order they need it:
   * what am I giving, then to whom, then the button. The venue and the date
   * are underneath because they only matter if something is being questioned.
   */
  if (v.redeemedAt) {
    return `
      <div class="v-card v-spent">
        <div class="v-flag">Already used</div>
        ${demoMark(v)}
        <p class="v-big">${esc(v.reward)}</p>
        <p class="v-who">${esc(v.name)}</p>
        <p class="v-note">Redeemed at ${esc(clockTime(v.redeemedAt))}${
  v.reinstated ? ` · put back by the quizmaster ${v.reinstated} time${v.reinstated === 1 ? '' : 's'}` : ''}</p>
        <p class="v-note">If that is wrong, ask the quizmaster — they can put it back.</p>
        ${footer(v)}
      </div>`;
  }
  return `
    <div class="v-card">
      <div class="v-flag v-good">Winner</div>
      ${demoMark(v)}
      <p class="v-lead">Give them</p>
      <p class="v-big">${esc(v.reward)}</p>
      <p class="v-who">${esc(v.name)}</p>
      <button class="go v-go" id="spend">Given — mark it used</button>
      <p class="v-note">This can only be used once. Press it after you have handed it over.</p>
      ${footer(v)}
    </div>`;
}

/**
 * The demonstration mark. Never on a real voucher, always on the demo.
 *
 * Under the flag rather than over the reward: it has to be unmissable to
 * somebody READING the card and must not get between the bar and the thing
 * they are giving away, which is the one job the card has.
 */
const demoMark = (v) => (v.demo ? '<div class="v-demo">Demonstration — not a real prize</div>' : '');

const footer = (v) => `
  <p class="v-foot">${v.venue ? `${esc(v.venue)} · ` : ''}${
  v.issuedAt ? esc(new Date(v.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })) : ''}
  · code ${esc(v.code)}</p>`;

async function load() {
  /*
   * The demo never asks the server anything, so it works with no game running,
   * no night on, and nothing to break — which is the point, because it gets
   * shown across a table in a pub at four in the afternoon.
   */
  if (code === DEMO) return void demo(demoVoucher());

  let res;
  try {
    res = await fetch(`/api/voucher?${qs}`);
  } catch {
    // Pub wifi. Say which it is, because "not found" would send the bar away
    // from a perfectly good drink.
    return show('<div class="v-card"><p class="v-big">No connection</p>'
      + '<p class="v-note">The code is fine — this phone cannot reach us. '
      + 'Ask the quizmaster to mark it used.</p></div>');
  }
  if (!res.ok) {
    return show('<div class="v-card"><p class="v-big">Not a voucher</p>'
      + '<p class="v-note">Nothing here matches that code. Check the quizmaster’s screen.</p></div>');
  }
  const v = await res.json();
  show(drawn(v));

  const button = document.getElementById('spend');
  if (!button) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Marking…';
    try {
      const r = await fetch(`/api/voucher/redeem?${g ? `g=${encodeURIComponent(g)}` : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, joinCode: g }),
      });
      // 409 is somebody else getting there first, which is this working rather
      // than failing — so it redraws as spent instead of showing an error.
      const body = await r.json().catch(() => ({}));
      if (r.ok || r.status === 409) return void load();
      throw new Error(body.error || 'Could not mark it');
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Given — mark it used';
      const note = node(`<p class="v-note v-bad">${esc(err.message)} — try again, or ask the quizmaster.</p>`);
      button.after(note);
    }
  });
}

load();

/**
 * The demo, driven with no server behind it.
 *
 * Deliberately the SAME `drawn()` the real one uses, so what a venue is shown
 * is what a venue gets rather than a mock-up that quietly drifts from it. The
 * only difference is what the button does: it flips a local copy rather than
 * spending anything.
 */
function demo(v) {
  const paint = (state) => {
    show(drawn(state));
    const button = document.getElementById('spend');
    if (button) {
      button.addEventListener('click', () => paint({ ...state, redeemedAt: Date.now() }));
    }
    // A way back, so the demo can be given to the next person without the
    // phone being handed back and the page reloaded by hand.
    if (state.redeemedAt) {
      const again = node('<button class="minor" style="margin-top:14px">Show it again</button>');
      again.addEventListener('click', () => paint(demoVoucher()));
      main.querySelector('.v-card').appendChild(again);
    }
  };
  paint(v);
}
