/**
 * `/prizes` — THE PRIZE CODES THIS PHONE HAS WON, FOUND AGAIN.
 *
 * Asked for on 8 October 2026: *"would be useful if there was a URL they could
 * go to to redeem their prizes QR codes."* The codes were already kept — the
 * game page writes every one it is shown into `WALLET_KEY` and re-checks them
 * on every load (`play.js`) — but only the GAME page ever read them, so a
 * closed tab or a tidy-minded phone meant scanning the join code again to find
 * a drink.
 *
 * **NOTHING NEW IS STORED AND NOTHING IS LOGGED IN.** The same pocket the game
 * page uses, the same `/api/voucher` lookup per code, the same rules: a 404
 * drops a code, a request that FAILED keeps it, and a prize the bar has
 * collected is forgotten. A phone that never played, or whose browser was
 * wiped, has nothing here — and the page says so rather than offering a login
 * that does not exist.
 */
import { esc, heldCodes, saveHeld } from './client.js';

const card = document.getElementById('card');

function when(at) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function prizeCard(v, g) {
  // The same address the game page's own card carries, so the bar's scan
  // lands on the same `/v` page either way.
  const target = `${location.origin}/v?c=${encodeURIComponent(v.code)}${g ? `&g=${encodeURIComponent(g)}` : ''}`;
  const said = [v.venue, when(v.issuedAt)].filter(Boolean).join(' · ');
  return `
    <div class="win-card place-1">
      <div class="sub">${esc(said || 'You won')}</div>
      <div class="win-what">${esc(v.reward)}</div>
      <img class="win-qr" alt="Show this at the bar"
        src="/qr.svg?text=${encodeURIComponent(target)}&dark=%230b0b12&light=%23ffffff">
      <div class="win-code">${esc(v.code)}</div>
      <p class="tiny">${v.name ? `Won by ${esc(v.name)}. ` : ''}Show this at the bar. They scan it, you get it. It only works once.</p>
    </div>`;
}

function paint(list, couldNotCheck) {
  const head = '<h1 class="prizes-title">My prizes</h1>';
  if (!list.length) {
    card.innerHTML = `${head}
      <p class="prizes-none">${couldNotCheck
    ? 'Could not reach the prizes just now. Check your signal and try again.'
    : 'No prizes on this phone yet.'}</p>
      <p class="tiny">Prizes you win at a quiz or a bingo show up here. Open this page on the
        same phone, in the same browser, you played on.</p>`;
    return;
  }
  card.innerHTML = `${head}${list.map(({ v, g }) => prizeCard(v, g)).join('')}
    ${couldNotCheck ? '<p class="tiny">Some prizes could not be checked just now — they are still saved.</p>' : ''}`;
}

/** Ask about every code this phone holds — `refreshHeldDrinks()`'s rules exactly. */
async function load() {
  card.innerHTML = '<h1 class="prizes-title">My prizes</h1><p class="tiny">Looking…</p>';
  const held = heldCodes();
  const keep = [];
  const live = [];
  let failed = 0;
  for (const h of held) {
    try {
      const res = await fetch(`/api/voucher?c=${encodeURIComponent(h.code)}${h.g ? `&g=${encodeURIComponent(h.g)}` : ''}`);
      if (res.status === 404) continue;                       // gone for good
      if (!res.ok) { keep.push(h); failed += 1; continue; }   // could not look — keep it
      const v = await res.json();
      if (v.redeemedAt) continue;                             // collected: forgotten
      keep.push(h);
      live.push({ v, g: h.g || '' });
    } catch {
      keep.push(h);
      failed += 1;
    }
  }
  saveHeld(keep);
  paint(live.reverse(), failed > 0);
}

load();
