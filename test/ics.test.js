/**
 * THE DIARY, READABLE BY A REAL CALENDAR.
 *
 * The things worth pinning down are the ones that would put a WRONG fact in
 * somebody's personal calendar, sat next to their dentist appointment — and
 * the one that would make a phone buzz once per night per refresh.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { calendarIcs } from '../src/ics.js';

const NOW = Date.parse('2026-08-14T12:00:00Z');
const one = (nights, opts = {}) => calendarIcs(nights, { now: NOW, ...opts });

test('it is a calendar a real client will parse', () => {
  const out = one([{ date: '2026-08-20', venue: 'The Crown' }]);
  assert.match(out, /^BEGIN:VCALENDAR\r\n/);
  assert.match(out, /\r\nEND:VCALENDAR\r\n$/);
  assert.match(out, /VERSION:2\.0/);
  // CRLF throughout — the format says so and Outlook is the one that minds.
  assert.equal(out.includes('\n') && !out.includes('\r\n') ? 'bare LF' : 'ok', 'ok');
});

test('A NIGHT WITH NO TIME IS ALL-DAY, because the app must not invent one', () => {
  // A guessed 8pm would be a made-up fact in somebody's real calendar. A
  // residency carries no time — the venue's arrangement lives in no record
  // here — so the app knows the DATE and says only that.
  const out = one([{ date: '2026-08-20', venue: 'The Crown' }]);
  assert.match(out, /DTSTART;VALUE=DATE:20260820/);
  // An all-day event's end is EXCLUSIVE, so a one-night booking ends on the
  // 21st. Getting this wrong shows the quiz as two days long.
  assert.match(out, /DTEND;VALUE=DATE:20260821/);
  assert.ok(!/DTSTART:\d{8}T/.test(out), 'it invented a start time');
});

test('…and a night somebody gave a time to is a real appointment', () => {
  const out = one([{ date: '2026-08-20', venue: 'The Crown', time: '20:00' }]);
  assert.match(out, /DTSTART:20260820T200000/);
  // Two hours is a stated DEFAULT rather than a known fact: every client needs
  // an end, and an event with no length is not an appointment.
  assert.match(out, /DTEND:20260820T220000/);
  assert.ok(!out.includes('VALUE=DATE'), 'it was still written as all-day');
  /*
   * FLOATING — no Z and no TZID. "8pm" means 8pm where the quizmaster is,
   * which is what they meant when they typed it; pinning it to a zone the
   * server guessed is how a night moves an hour in March.
   */
  assert.ok(!/DTSTART:\d{8}T\d{6}Z/.test(out), 'it pinned the time to UTC');
  assert.ok(!out.includes('TZID'), 'it pinned the time to a guessed zone');
});

test('a time near midnight does not roll the end onto the wrong day', () => {
  // 23:30 plus two hours is half past one, and the naive version wrote
  // "T013000" against the SAME date — an event that ends 22 hours before it
  // starts, which a calendar either refuses or draws across the whole day.
  const out = one([{ date: '2026-08-20', venue: 'The Crown', time: '23:30' }]);
  assert.match(out, /DTSTART:20260820T233000/);
  assert.match(out, /DTEND:20260821T013000/);
});

test('THE UID IS DERIVED FROM THE NIGHT, so a refresh updates rather than re-adds', () => {
  /*
   * A calendar matches events across refreshes by UID. A random one means every
   * refresh deletes and re-adds every night — which on a phone is a
   * notification per night, per refresh, for ever.
   */
  const night = [{ date: '2026-08-20', venue: 'The Crown' }];
  const first = one(night).match(/UID:(.+)/)[1];
  const again = calendarIcs(night, { now: NOW + 86_400_000 }).match(/UID:(.+)/)[1];
  assert.equal(first, again, 'the same night got a different id an hour later');

  // …and two different nights are two different events.
  const other = one([{ date: '2026-08-27', venue: 'The Crown' }]).match(/UID:(.+)/)[1];
  assert.notEqual(first, other);
  const elsewhere = one([{ date: '2026-08-20', venue: 'The Anchor' }]).match(/UID:(.+)/)[1];
  assert.notEqual(first, elsewhere, 'two venues on one night collapsed into one event');
});

test('a comma in a venue name does not split the event in half', () => {
  // Commas and semicolons are SEPARATORS in this format, so "Dog & Duck,
  // Chelmsford" would otherwise end one field early and take the rest of the
  // event with it.
  const out = one([{ date: '2026-08-20', venue: 'The Dog & Duck, Chelmsford; upstairs' }]);
  // The venue IS the title: the feed cannot know what will be played weeks
  // ahead, so it no longer says "Quiz —" in front of it. The escaping of the
  // comma and semicolon is the point of this assertion and is unchanged.
  assert.match(out, /SUMMARY:The Dog & Duck\\, Chelmsford\\; upstairs/);
  assert.doesNotMatch(out, /SUMMARY:Quiz/,
    'the feed is future BOOKINGS — claiming a game labels a bingo night as a quiz');
  assert.match(out, /LOCATION:The Dog & Duck\\, Chelmsford\\; upstairs/);
});

test('what the room is playing for rides along, and a one-off says so', () => {
  const out = one([
    { date: '2026-08-20', venue: 'The Crown', why: 'usual', rewards: ['A £30 bar tab', '', 'A pint'] },
    { date: '2026-08-22', venue: 'The Anchor', why: 'booked', note: 'Hen night' },
  ]);
  assert.match(out, /DESCRIPTION:Playing for A £30 bar tab\\, then A pint/);
  assert.match(out, /DESCRIPTION:Hen night\\nA one-off/);
});

test('an empty diary is still a valid calendar, not an error', () => {
  // A quizmaster with nothing booked must get a calendar that subscribes and
  // sits empty, rather than something their phone refuses and then nags about.
  const out = one([]);
  assert.match(out, /^BEGIN:VCALENDAR/);
  assert.match(out, /END:VCALENDAR\r\n$/);
  assert.ok(!out.includes('BEGIN:VEVENT'));
});

test('a night with no date is skipped rather than written as garbage', () => {
  const out = one([{ venue: 'The Crown' }, { date: '2026-08-20', venue: 'The Anchor' }]);
  assert.equal((out.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test('long lines are folded, which some parsers enforce', () => {
  const out = one([{ date: '2026-08-20', venue: 'The ' + 'Very '.repeat(30) + 'Long Arms' }]);
  for (const line of out.split('\r\n')) {
    assert.ok(line.length <= 75, `a line came out ${line.length} long`);
  }
  // …and a folded line continues with a single leading space.
  assert.match(out, /\r\n [^\s]/);
});
