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
      <p class="v-lead">Give them</p>
      <p class="v-big">${esc(v.reward)}</p>
      <p class="v-who">${esc(v.name)}</p>
      <button class="go v-go" id="spend">Given — mark it used</button>
      <p class="v-note">This can only be used once. Press it after you have handed it over.</p>
      ${footer(v)}
    </div>`;
}

const footer = (v) => `
  <p class="v-foot">${v.venue ? `${esc(v.venue)} · ` : ''}${
  v.issuedAt ? esc(new Date(v.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })) : ''}
  · code ${esc(v.code)}</p>`;

async function load() {
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
