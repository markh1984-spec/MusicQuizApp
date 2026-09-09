/**
 * WHICH NIGHT A MOMENT BELONGS TO — the 6am roll-over, in one place.
 *
 * A quiz that runs past midnight is still the same night, so the day rolls at
 * 6am rather than at twelve. Nobody wants half a gig filed under Tuesday and
 * half under Wednesday.
 *
 * ---
 *
 * **IT LIVES ON ITS OWN BECAUSE THREE MODULES NEEDED IT AND TWO HAD ALREADY
 * WRITTEN IT OUT.** `past-gigs.js` and `photos.js` each carried their own copy
 * — and the copies had already drifted: one guards a bad timestamp and returns
 * an empty string, the other hands `new Date(NaN).toISOString()` a value that
 * THROWS. Two copies of one rule is one rule that gets fixed once, which is
 * this repo's own oldest lesson, so the third caller got this file rather than
 * a third copy.
 *
 * **NOTHING IS IMPORTED HERE, DELIBERATELY.** `accounts.js` is loaded before
 * almost everything and must not pull `library.js` in behind it just to ask
 * what day it is.
 *
 * **THE GUARDED SHAPE WINS.** A bad timestamp answers with an empty string,
 * which every caller can test, rather than throwing from inside a date
 * library four frames down.
 */
export function nightDay(at) {
  const t = Number(at);
  if (!Number.isFinite(t) || t <= 0) return '';
  return new Date(t - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
