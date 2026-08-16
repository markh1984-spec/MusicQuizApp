/**
 * THE CODE A WINNER SHOWS AT THE BAR — one card, both games.
 *
 * Split out of `play.js` on 16 August 2026, when bingo was given prizes. A
 * bingo voucher and a quiz voucher are the same thing: the same words, the
 * same QR, the same "it only works once". So the phone draws them with the
 * same function, and `playerView()` on both engines sends the same `voucher`
 * field for exactly that reason.
 *
 * **ITS OWN FILE RATHER THAN AN EXPORT FROM `play.js`**, because `play.js`
 * already imports `play-bingo.js` — importing back the other way is a cycle,
 * and a cycle that happens to work today is a page that dies the day somebody
 * reorders an import. Same shape as `pack-look.js` and `show-parts.js`: a
 * shared reader in a file of its own.
 */

import { esc, roomCode } from './client.js';

/**
 * WHAT YOU WON, and how the bar gives it to you.
 *
 * Only ever on the winner's own phone — the server puts `voucher` in that one
 * player's payload and nobody else's, for the same reason the answer key is
 * host-only: the code is the credential, and the projector is pointed at a
 * room. On a team night everybody on the winning team gets the same card with
 * the same code, which is the point: one drink per team, not one each.
 *
 * The QR is the thing that matters and it is the biggest element, because the
 * whole interaction is "hold your phone up and let them scan it". The written
 * code is under it for when the bar's camera will not play or the wifi has
 * gone, which in a pub is often enough to be worth the two lines.
 *
 * The NAME is on it deliberately. It stops nothing technically — a screenshot
 * is a screenshot — but it works the way a paper voucher does: the bar can say
 * "you are not Quizteam Aguilera" without needing a system at all.
 */
export function voucherCard(s) {
  const v = s.voucher;
  if (!v) return '';
  /*
   * `roomCode()` rather than a new field on the payload — the phone already
   * remembers which room it is in, next to its player id, and has since rooms
   * existed. The house room has no code and its link is the bare `/v?c=`, the
   * same shape `/play` has always had, so nothing special-cases it.
   */
  const code = roomCode();
  const target = `${location.origin}/v?c=${encodeURIComponent(v.code)}${
    code ? `&g=${encodeURIComponent(code)}` : ''}`;
  /*
   * WHICH PLACE, in words. Second and third have to say so or the card reads
   * as "you won" to somebody who came third, which is the app misreporting the
   * projector — and it is the sentence they will show the bar.
   *
   * Never "gold", "silver" or "bronze": those are the subscription tiers. The
   * medal COLOUR is fine and is what the card is tinted with.
   */
  /*
   * WHAT THEY DID, in words.
   *
   * A quiz sends a NUMBER — second and third have to say so, or the card reads
   * as "you won" to somebody who came third, which is the app misreporting the
   * projector. Bingo sends a PHRASE instead, because a bingo prize is not a
   * placing: *"a line"*, *"3 lines"*, *"a full house"*. Numbering those would
   * be a lie — a full house won after two other prizes is not "1st".
   *
   * Never "gold", "silver" or "bronze": those are the subscription tiers. The
   * medal COLOUR is fine and is what the card is tinted with.
   */
  const place = v.place || 1;
  const said = typeof place === 'string'
    ? place.charAt(0).toUpperCase() + place.slice(1)
    : ({ 1: 'You won', 2: 'Second place', 3: 'Third place' }[place] || 'You won');
  if (v.redeemedAt) {
    return `
      <div class="win-card win-spent">
        ${v.logo ? `<img class="win-logo" alt="${esc(v.venue || '')}" src="${esc(v.logo)}" onerror="this.remove()">` : ''}
        <div class="sub">Collected</div>
        <div class="win-what">${esc(v.reward)}</div>
        <p class="tiny">Already redeemed. If that is wrong, ask the quizmaster.</p>
      </div>`;
  }
  /*
   * THE VENUE'S OWN LOGO, above everything.
   *
   * A voucher is a credential a stranger behind the bar has to decide whether
   * to trust, and until now it was a code and some words in the quiz app's
   * colours. The pub's own mark at the top is what makes it read as something
   * the pub issued.
   *
   * DECORATION, and it has to stay decoration: the prize is `v.reward` in
   * words directly underneath, so a logo that never loads, was never set, or
   * is on a phone with no signal costs nothing at the bar. `onerror` removes
   * it rather than leaving a broken-image icon on the one screen somebody is
   * holding up to be served.
   */
  const logo = v.logo
    ? `<img class="win-logo" alt="${esc(v.venue || '')}" src="${esc(v.logo)}"
         onerror="this.remove()">`
    : '';
  return `
    <div class="win-card place-${typeof place === 'number' ? place : 1}">
      ${logo}
      <div class="sub">${esc(said)}</div>
      <div class="win-what">${esc(v.reward)}</div>
      <img class="win-qr" alt="Show this at the bar"
        src="/qr.svg?text=${encodeURIComponent(target)}&dark=%230b0b12&light=%23ffffff">
      <div class="win-code">${esc(v.code)}</div>
      <p class="tiny">Show this at the bar. They scan it, you get it. It only works once.</p>
    </div>`;
}
