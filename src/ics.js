/**
 * THE DIARY, READABLE BY A REAL CALENDAR.
 *
 * Asked for directly: *"can we make the calendar readable by external
 * calendars in case they have a personal calendar or general work
 * calendar?"* — and it is the right ask, because a quizmaster's nights are
 * not a thing they want to check in two places. A residency that only exists
 * inside this app is a residency they double-book themselves over.
 *
 * ---
 *
 * **IT IS A SUBSCRIPTION, NOT A DOWNLOAD.** A `.ics` file you save once is a
 * snapshot that is wrong the first time a night moves; a URL the calendar
 * re-reads is always what the app currently thinks. Every calendar worth
 * having — Google, Apple, Outlook — subscribes to a URL, so this is a GET
 * that returns the whole diary and nothing else.
 *
 * **NO DEPENDENCY.** iCalendar is a text format from 1998 and the parts a
 * diary needs are half a page: a `VCALENDAR` wrapper and a `VEVENT` per
 * night. Same reasoning as the QR encoder and the PDF writer — a library here
 * would be a thing that breaks on a gig night for no benefit.
 *
 * ---
 *
 * **A NIGHT IS ALL-DAY UNLESS SOMEBODY TYPED A TIME, and the app never
 * guesses one.** A residency carries no start time — that is the venue's
 * arrangement and lives in no record here — so most nights are day-long
 * entries, which say exactly what is known. An event at a guessed 8pm would be
 * a made-up fact in somebody's real calendar, sat next to their dentist
 * appointment. A night booked through the diary CAN carry a time, because
 * somebody typed it, and then it is worth being a real appointment: that is
 * the difference between a phone that knows when to remind you and one that
 * does not.
 *
 * **A NIGHT OFF IS ABSENT, NOT CANCELLED.** `upcoming()` has already dropped
 * it, and this only ever writes what that returns — so the one failure that
 * would make the feed untrustworthy, a calendar insisting you are at The
 * Crown on a Thursday you are not, cannot happen here without happening in
 * the app first.
 *
 * **THE UID IS DERIVED FROM THE NIGHT, never random.** A calendar matches
 * events across refreshes by UID: generate a new one each time and every
 * refresh deletes and re-adds every night, which on a phone means a
 * notification per night per refresh. Date plus venue is stable and is
 * exactly what identifies a night here.
 */

import crypto from 'node:crypto';

/** Wrapped at 75 octets, which the format demands and some parsers enforce. */
function fold(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/**
 * Commas, semicolons and backslashes are separators in this format, and a
 * venue called "Dog & Duck, Chelmsford" would otherwise split one field into
 * two and take the rest of the event with it.
 */
function esc(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** `2026-08-20` as the format wants it. */
const compact = (date) => String(date || '').replace(/-/g, '');

/** The day after, because an all-day event's end is exclusive. */
function dayAfter(date) {
  const at = new Date(date + 'T12:00:00Z');
  at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString().slice(0, 10).replace(/-/g, '');
}

/** A stable id for a night, so a refresh updates rather than re-adds. */
function uid(night, host) {
  const seed = `${night.date}|${String(night.venue || '').toLowerCase()}`;
  return `${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 20)}@${host}`;
}

/**
 * The whole diary as one iCalendar document.
 *
 * @param {Array} nights  what `upcoming()` returned — already has the nights
 *                        off removed and the one-offs folded in
 * @param {object} opts
 * @param {string} opts.name   what the calendar is called once subscribed
 * @param {string} opts.host   for the UIDs; any stable string will do
 * @param {number} opts.now    injected, like every other clock in this app
 */
export function calendarIcs(nights = [], { name = 'Quiz nights', host = 'quizporium', now = Date.now() } = {}) {
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quizporium//Diary//EN',
    'CALSCALE:GREGORIAN',
    // Read-only: this is a mirror of the app's diary, and a calendar client
    // that let somebody drag a night about would be editing something it
    // cannot write back to.
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const night of nights) {
    if (!night || !night.date) continue;
    lines.push('BEGIN:VEVENT', `UID:${uid(night, host)}`, `DTSTAMP:${stamp}`);
    /*
     * A TIME IF SOMEBODY GAVE ONE, and an all-day entry if not.
     *
     * A residency carries no time — the venue's arrangement lives in no record
     * here — so most nights are all-day, which says exactly what is known. A
     * night typed into the diary can carry one, and then it is worth being a
     * real appointment: that is the difference between a phone that knows when
     * to remind you and a phone that does not.
     *
     * FLOATING, with no Z and no TZID: "8pm" means 8pm where the quizmaster
     * is, which is what they meant when they typed it. Pinning it to a zone
     * the server guessed is how a night moves an hour in March.
     *
     * The two hours is a stated DEFAULT rather than a known fact, and it is
     * here because a calendar entry with no length is not an appointment —
     * every client needs an end. If a quizmaster ever wants to set it, that is
     * a field on the booking and one line here.
     */
    if (night.time) {
      const [h, m] = night.time.split(':').map(Number);
      /*
       * The DATE has to move with the clock, not only the hours. A quiz at
       * half eleven ends at half one THE NEXT DAY, and the first version wrote
       * that against the same date — an event ending twenty-two hours before
       * it starts, which a calendar either refuses or draws across the whole
       * day. Built as a real date so the month end and the year end come free.
       */
      const [y, mo, d] = String(night.date).split('-').map(Number);
      const end = new Date(y, mo - 1, d, h + 2, m);
      const two = (n) => String(n).padStart(2, '0');
      lines.push(
        `DTSTART:${compact(night.date)}T${two(h)}${two(m)}00`,
        `DTEND:${end.getFullYear()}${two(end.getMonth() + 1)}${two(end.getDate())}T${two(end.getHours())}${two(end.getMinutes())}00`,
      );
    } else {
      // VALUE=DATE is what makes it an all-day entry rather than midnight.
      lines.push(
        `DTSTART;VALUE=DATE:${compact(night.date)}`,
        `DTEND;VALUE=DATE:${dayAfter(night.date)}`,
      );
    }
    lines.push(`SUMMARY:${esc(night.venue ? `Quiz — ${night.venue}` : 'Quiz night')}`);
    if (night.venue) lines.push(`LOCATION:${esc(night.venue)}`);
    const notes = [];
    if (night.note) notes.push(night.note);
    // What the room is playing for, because it is the thing most likely to
    // need checking before you leave the house.
    const prizes = (night.rewards || []).filter(Boolean);
    if (prizes.length) notes.push(`Playing for ${prizes.join(', then ')}`);
    if (night.why === 'booked') notes.push('A one-off, not your usual night here.');
    if (notes.length) lines.push(`DESCRIPTION:${esc(notes.join('\n'))}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  // CRLF throughout: the format says so, and Outlook is the one that minds.
  return lines.map(fold).join('\r\n') + '\r\n';
}
