/**
 * A TRIAL THAT ENDS IN SILENCE — and it did, for as long as trials existed.
 *
 * ---
 *
 * `trialEndsAt` is written once at sign-up and `trialExpired()` is evaluated on
 * READ, which is exactly right for a gate and useless as a notice: nothing ever
 * told anybody their fortnight was running out. The only sign was a line on My
 * account — a page somebody who has stopped opening the console is by definition
 * not looking at — and then `/api/host/launch` simply refused, **on a day they
 * had a gig booked**, with no grace night (an expired trial gets none, and that
 * is deliberate: a grace there is a free gig for anyone who signs up and walks
 * away).
 *
 * So this is the biggest hole in the funnel, and it is two emails and a clock.
 *
 * **THIS FILE HOLDS NO CLOCK AND SENDS NOTHING.** It answers *who is due what*
 * from an accounts list and a `now`, so the whole of it is testable without a
 * timer, a mail provider or a server — and `server.js` owns the sweep. The same
 * split `src/comeback.js` uses for the come-back slide.
 *
 * **AND IT IS AN AUTOMATIC SEND, WHICH THIS CODEBASE OTHERWISE REFUSES.**
 * *"Do not build a send that skips the reading"* is a rule about the QUIZMASTER'S
 * admin — an invoice or a thank-you, where the risk is naming the wrong headcount
 * or billing a cancelled night, and where a human has to stay accountable for
 * what goes out in their name. This is the other class, the one CLAUDE.md already
 * settles under *the app sends the money emails, and nothing else*: transactional,
 * about the recipient's own subscription, triggered by a date rather than by a
 * judgement. **There is nothing here for a human to read and correct** — a trial
 * either ends on the 20th or it does not.
 */

/**
 * HOW MUCH WARNING. Three days: long enough to do something about it on the
 * Monday most people would, short enough that it is still true when it lands.
 *
 * **A CONSTANT WITH A NOTE, NOT A SETTING** — nobody has asked to change it, and
 * a settings panel for a number the owner would touch once is the clutter rule
 * failing. One line to move.
 */
export const WARN_DAYS = 3;

/** A day in milliseconds, named because it appears three times below. */
const DAY = 86_400_000;

/**
 * Is this account one a trial notice could ever be about?
 *
 * Four exclusions, and each is a real case rather than defensive coding:
 *
 * - **the owner**, who has no subscription;
 * - **anybody not `trialing`** — somebody who has paid, lapsed or cancelled is a
 *   different conversation, and `applyBilling()` owns it;
 * - **a comped account**, which is on the house by decision and whose
 *   `trialEndsAt` is never even written;
 * - **a GROUP SEAT**, because its standing is its parent's through
 *   `effective()`. A seat carries the parent's `trialEndsAt`, so without this
 *   line a company of five seats gets five copies of one warning and four of
 *   them go to people who cannot act on it.
 */
export function onTrial(account) {
  if (!account || account.role === 'owner') return false;
  if (account.comped) return false;
  if (account.parentId) return false;
  return account.status === 'trialing' && Boolean(account.trialEndsAt);
}

/** When a trial runs out, in ms, or 0 if it has no clock on it. */
export function endsAt(account) {
  const at = Date.parse((account && account.trialEndsAt) || '');
  return Number.isFinite(at) ? at : 0;
}

/**
 * WHO IS DUE THE "it runs out on Thursday" EMAIL.
 *
 * Inside the window and not yet run out, and **not already told** —
 * `trialWarnedAt` is the mark. Idempotency is the whole job of these two
 * functions: the sweep runs at every boot and every push is a boot, so a
 * quizmaster would otherwise get one of these per deploy.
 */
export function dueWarning(list, now = Date.now()) {
  return (list || []).filter((a) => {
    if (!onTrial(a) || a.trialWarnedAt) return false;
    const at = endsAt(a);
    if (!at || at <= now) return false;
    return at - now <= WARN_DAYS * DAY;
  });
}

/**
 * AND WHO IS DUE THE "it has run out" ONE.
 *
 * Run out, and not already told. **The warning having gone is NOT a
 * precondition** — somebody who signed up eleven days before a deploy that
 * happened after their trial ended never got one, and the useful email is still
 * the second: it is the one that says what to do about it.
 */
export function dueEnded(list, now = Date.now()) {
  return (list || []).filter((a) => {
    if (!onTrial(a) || a.trialEndedAt) return false;
    const at = endsAt(a);
    return Boolean(at) && at <= now;
  });
}

/**
 * HOW MANY DAYS LEFT, for the wording — rounded UP, so a trial with thirty
 * hours on it says "2 days" rather than "1".
 *
 * Rounding down would print *"ends in 1 day"* to somebody with a day and a
 * half, which is the app being wrong in the direction that costs them the
 * chance to act. Never below 1: this is only ever called on an account the
 * filter above has already said has time left.
 */
export function daysLeft(account, now = Date.now()) {
  const at = endsAt(account);
  if (!at || at <= now) return 0;
  return Math.max(1, Math.ceil((at - now) / DAY));
}
