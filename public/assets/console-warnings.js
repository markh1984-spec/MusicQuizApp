/**
 * WHAT IS WRONG WITH TONIGHT — the launch bar's warning slot, in one place.
 *
 * ---
 *
 * **A SEAM, TAKEN RATHER THAN A FIFTH PAYMENT ON THE LINE CAP.** These two
 * builders were nested inside `launchBar()`, and adding the second one put
 * `console-tonight.js` over its budget — at which point the choice is to shave
 * somebody's reasoning off an unrelated paragraph or to take a seam out. The
 * break plumbing faced exactly this and went to `console-breaks.js`; this is
 * that decision again, so the next warning does not pay the tax either.
 *
 * **IT IS A LEAF, AND HANDED WHAT IT NEEDS.** No `console-state.js`, no
 * `console.js` — everything arrives as an argument, so nothing here can
 * assign to an imported binding or drag a page's boot code in behind it.
 *
 * **BOTH RETURN A NODE OR `null`, NEVER AN EMPTY DIV.** The caller filters and
 * hides the slot when nothing is left, so a night with nothing wrong has no
 * empty row on the one bar where *space is at a premium*.
 */

import { node } from './client.js';
import { goTo } from './console.js';

/**
 * TONIGHT IS THE LAST ONE — said BEFORE they launch, not after.
 *
 * Asked for in these words: *"it warns them, yeah, you haven't paid, so this
 * will be the last night you can run."* The gate itself is `lastNightLeft()`
 * in `accounts.js`; this is the half a gate cannot do, because a refusal that
 * only arrives when the button stops working IS the nasty shock the whole
 * policy exists to avoid.
 *
 * **THE SERVER ANSWERS WHETHER; THIS SAYS WHAT.** `me.lastNightLeft` needs the
 * accounts book and a 6am roll-over — re-deriving it here from `status` would
 * warn a group seat whose parent had already spent the night, and stay silent
 * for the one that had not.
 *
 * **IT NAMES WHAT STILL WORKS FIRST.** Money and warnings are the two stated
 * exceptions to the one-short-line rule, and somebody reading this ten minutes
 * before a gig needs *tonight is fine* before they need anything else — the
 * other order is a quizmaster wondering whether to cancel on the landlord.
 *
 * **AND IT IS NOT RED.** Nothing has gone wrong and the night is not at risk;
 * red here would say it was, which is the same fault as the publish warning
 * that had to stay neutral because it is read BEFORE the press.
 */
export function lastNightWarning(me) {
  if (!me || !me.lastNightLeft) return null;
  return node(`<div class="lb-say lb-say-money"><b>Tonight still runs — and it is the last one
    until the payment is sorted.</b> Nothing stops mid-night, and a night already running is
    never cut off. From tomorrow a new night will not launch.</div>`);
}

/**
 * NO PRIZES ON THE VENUE, SO THE WINNER GETS A BLANK PHONE.
 *
 * Off a live night: *"my quiz and bingo winners didn't receive a QR code"*.
 * Prizes are read off the venue record at LAUNCH and nowhere else, so a night
 * with no venue has none — and this began `if (!name) return null`, switched
 * off in exactly the case it was for.
 *
 * It says "VENUE prizes" because *Prizes* is taken 80px lower on the same bar:
 * that one is how many stopping points a bingo CARD pays out, this one is the
 * venue's list of what they are. A bar reading "Prizes 5" under "No prizes
 * set" says the app is broken.
 *
 * **SILENT WHEN THERE IS NOTHING WRONG** — a night whose prizes are right
 * gains nothing from being told so, and *space is at a premium*.
 */
export function venuePrizeWarning(name, venueRecords) {
  const record = name
    ? (venueRecords || []).find((v) => (v.name || '').toLowerCase() === String(name).toLowerCase())
    : null;
  const prizes = ((record && record.rewards) || []).map((r) => String(r || '').trim()).filter(Boolean);
  if (prizes.length) return null;
  return node(`<div class="lb-say lb-say-none">No venue prizes set${
    name ? '' : ' — no venue picked'}, so the winners get no voucher to scan${
    name ? ` — add them on ${goTo('workshop', 'venues', 'the Venues tab')}` : ''}</div>`);
}
