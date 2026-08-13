/**
 * The diary: what is on, and when.
 *
 * **MOSTLY DERIVED, AND THAT IS THE WHOLE DESIGN.** A calendar you have to
 * keep up is a calendar that starts lying the first week somebody is busy —
 * and this app's fifth constraint is that a feature's real price is the admin
 * it creates on a Monday, not the code it takes to write. So the recurring
 * nights come out of something the quizmaster already maintains for another
 * reason: `usualNight` on the venue record, which exists so the launch bar
 * knows whose night tonight is.
 *
 * That means a host who has set their residencies up gets a working diary
 * having typed nothing at all, for ever. What is left to type is only the part
 * nothing can derive:
 *
 * - a ONE-OFF — a Christmas party, a corporate booking, a stand-in Tuesday;
 * - a night OFF — the Thursday the pub has a darts match on.
 *
 * Both are exceptions to the pattern rather than the pattern itself, which is
 * the right way round: the common case costs nothing and the rare one costs a
 * tap.
 *
 * **IT LIVES HERE RATHER THAN IN `src/` BECAUSE THE DATES ARE THE READER'S.**
 * The console imports it in the browser and the test imports it in node, the
 * same arrangement as `plans.js`, `looks.js` and `balance.js`. Doing the
 * projection on the SERVER would work it out in UTC, and this app's own
 * invoice code already records why that is wrong: a quiz that ends at half
 * past midnight in August is 23:30 the previous day in UTC, so the server and
 * the person who ran the night would disagree about which day it was. The
 * browser is on the quizmaster's own device, in their own timezone, which is
 * the only clock that agrees with them.
 */

/**
 * The days a residency can fall on, lower case, Monday first.
 *
 * Stored as a NAME rather than a number because `0` is Sunday in JavaScript
 * and Monday everywhere a quizmaster thinks about a week — exactly the
 * off-by-one that would put the wrong pub's prizes on a night. `WEEKDAYS` in
 * `src/invoices.js` is the same list and validates against it.
 */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS = [
  ['mon', 'Mondays'], ['tue', 'Tuesdays'], ['wed', 'Wednesdays'], ['thu', 'Thursdays'],
  ['fri', 'Fridays'], ['sat', 'Saturdays'], ['sun', 'Sundays'],
];

/**
 * How far ahead the diary looks.
 *
 * FOUR WEEKS — a month, which is the unit a quizmaster already thinks in and
 * the one this app uses everywhere else. Six was tried and is a wall: two
 * residencies print thirteen rows, three print twenty, and Past gigs ends up
 * a screen and a half below its own heading. A page you scroll past is a page
 * you stop reading, which is the same reason the review panel caps its flags
 * and the wander badge waits until three.
 *
 * The cost is real and small: a booking further out than a month is added
 * without being able to see it. That is the right way round — it is stored, it
 * appears as the date approaches, and the alternative costs every reader every
 * day to serve the rarer case.
 */
export const WEEKS_AHEAD = 4;

/**
 * WHICH NIGHT A MOMENT BELONGS TO — the 6am roll-over, shared.
 *
 * A quiz that runs past midnight is still the same night, so the day rolls
 * over at 6am rather than at twelve. `nightOf()` in `src/photos.js` and
 * `nightOfGig()` in `src/past-gigs.js` do the same thing for photos and for
 * the archive, and all three have to agree or one evening appears under two
 * dates — which is a fault this codebase has already had once.
 *
 * Local parts rather than `toISOString()`, deliberately: this runs in the
 * quizmaster's own browser, and an ISO string is UTC. In British Summer Time
 * that puts a night launched at half past midnight on the day before.
 */
export function nightKey(at = Date.now()) {
  const d = new Date(at - 6 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The weekday id a `YYYY-MM-DD` falls on. Noon, so no timezone can shift it. */
export function weekdayOf(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  if (!y || !m || !d) return '';
  return WEEKDAYS[(new Date(y, m - 1, d, 12).getDay() + 6) % 7];
}

/** `YYYY-MM-DD`, n days after another one. Noon for the same reason. */
function addDays(date, n) {
  const [y, m, d] = String(date).split('-').map(Number);
  const at = new Date(y, m - 1, d + n, 12);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

/** A booking's identity: one venue on one date. */
const slotKey = (date, venue) => `${date}|${String(venue || '').trim().toLowerCase()}`;

/**
 * What is coming up.
 *
 * @param {object} opts
 * @param {Array}  opts.venues    venue records — `{ name, usualNight, rewards }`
 * @param {Array}  opts.bookings  `{ date, venue, off, note }`
 * @param {number} opts.now       the clock, injected so a test is not on a timer
 * @param {number} opts.weeks     how far to look
 * @returns {Array} `{ date, venue, why, note, rewards }`, soonest first
 */
export function upcoming({ venues = [], bookings = [], now = Date.now(), weeks = WEEKS_AHEAD } = {}) {
  const from = nightKey(now);
  const to = addDays(from, weeks * 7);

  /*
   * A NIGHT OFF WINS OVER EVERYTHING, and it is applied first so that neither
   * of the two things that could put a night on the page can sneak past it.
   * The diary saying you are at The Crown on a Thursday you are not is the one
   * failure that makes the whole feature untrustworthy — the same reasoning
   * that makes an expired topical pack warn rather than hide.
   */
  const off = new Set(bookings.filter((b) => b.off).map((b) => slotKey(b.date, b.venue)));

  const nights = new Map();

  // 1. The residencies, projected forward. Nothing is typed for these.
  for (const venue of venues) {
    if (!venue || !WEEKDAYS.includes(venue.usualNight || '')) continue;
    for (let date = from; date < to; date = addDays(date, 1)) {
      if (weekdayOf(date) !== venue.usualNight) continue;
      const key = slotKey(date, venue.name);
      if (off.has(key)) continue;
      nights.set(key, { date, venue: venue.name, why: 'usual', note: '', rewards: venue.rewards || [] });
    }
  }

  /*
   * 2. The one-offs. LAST, so an explicit booking replaces the residency it
   * lands on rather than appearing twice — which is what lets somebody add a
   * note to an ordinary Thursday ("quiz then bingo, they want both") without
   * inventing a second entry for the same night.
   */
  for (const booking of bookings) {
    if (booking.off) continue;
    const date = String(booking.date || '');
    if (date < from || date >= to) continue;
    const key = slotKey(date, booking.venue);
    if (off.has(key)) continue;
    const venue = venues.find((v) => (v.name || '').toLowerCase() === String(booking.venue || '').toLowerCase());
    nights.set(key, {
      date,
      venue: String(booking.venue || '').trim(),
      // A booking that happens to fall on the usual night is still the usual
      // night as far as the reader is concerned — it is only "one off" when it
      // is somewhere you do not normally play that day.
      why: venue && venue.usualNight === weekdayOf(date) ? 'usual' : 'booked',
      note: String(booking.note || '').trim(),
      rewards: (venue && venue.rewards) || [],
    });
  }

  return [...nights.values()].sort((a, b) => (
    a.date === b.date ? a.venue.localeCompare(b.venue) : a.date.localeCompare(b.date)
  ));
}

/**
 * WHOSE NIGHT IS TONIGHT — the one question the rest of the app asks the diary.
 *
 * Read by `tonightsVenue()` in the console so the launch bar, the search card
 * and every pack card start on the right venue. Three sources, in order, and
 * the order is the design:
 *
 * 1. **A booking for tonight**, because a date somebody typed beats a pattern.
 *    That is the whole point of being able to add a one-off: the Tuesday you
 *    are standing in somewhere has to beat the Tuesday residency you are not
 *    doing this week.
 * 2. **The venue whose usual night is tonight.** Stated rather than guessed,
 *    so it is right in week one and right for two residencies.
 * 3. **Otherwise the venue of your last night**, which the archive already
 *    gives newest-first — the "remember what you did last week" that was
 *    originally asked for.
 *
 * **TWO VENUES CLAIMING TONIGHT MEANS NEITHER GETS IT.** A double booking is
 * a real thing in December, and picking whichever sorted first would put one
 * pub's prizes in front of another pub's room. Nothing is returned and the
 * picker is left blank, which is exactly what happened before any of this.
 */
export function tonight({ venues = [], bookings = [], playedVenues = [], now = Date.now() } = {}) {
  const today = nightKey(now);
  const on = upcoming({ venues, bookings, now, weeks: 1 }).filter((n) => n.date === today);
  if (on.length === 1) {
    return { name: on[0].venue, why: on[0].why === 'booked' ? 'in your diary tonight' : 'your usual night here' };
  }
  if (on.length > 1) return null;
  const last = playedVenues[0];
  return last ? { name: last, why: 'where you played last' } : null;
}
