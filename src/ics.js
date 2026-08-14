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
 * **EVERY NIGHT IS AN ALL-DAY EVENT, and that is deliberate rather than lazy.**
 * The app knows which DATE a quiz is on and does not know what time it starts
 * — that is the venue's arrangement and lives in nobody's record. An event at
 * a guessed 8pm would be a made-up fact in somebody's real calendar, sat next
 * to their dentist appointment. A day-long entry says exactly what is known.
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
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid(night, host)}`,
      `DTSTAMP:${stamp}`,
      // VALUE=DATE is what makes it an all-day entry rather than midnight.
      `DTSTART;VALUE=DATE:${compact(night.date)}`,
      `DTEND;VALUE=DATE:${dayAfter(night.date)}`,
      `SUMMARY:${esc(night.venue ? `Quiz — ${night.venue}` : 'Quiz night')}`,
    );
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
