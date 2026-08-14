/**
 * The diary.
 *
 * Two things are worth testing here and they are not the same thing: that the
 * projection puts the right nights on the page, and that it NEVER puts a night
 * on the page you are not doing. The second is the one that decides whether
 * anybody trusts the feature — a diary that says you are at The Crown on a
 * Thursday you are not is worse than no diary, because it is believed.
 *
 * The clock is injected throughout, so none of this is on a timer and a test
 * run at ten to midnight cannot behave differently from one run at noon.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { upcoming, tonight, clashTonight, nightKey, weekdayOf, WEEKDAYS } from '../public/assets/diary.js';

// A Thursday, deliberately: it is the host's own residency night.
const THU = new Date(2026, 7, 13, 20, 0).getTime();

const STATION = { name: 'The Station Tap', usualNight: 'thu', rewards: ['A free drink at the bar'] };
const CROWN = { name: 'The Crown', usualNight: 'sat', rewards: [] };

test('a residency fills its own weeks in, and nothing else does', () => {
  const nights = upcoming({ venues: [STATION], now: THU, weeks: 3 });
  assert.equal(nights.length, 3, 'three Thursdays in three weeks');
  assert.deepEqual(nights.map((n) => n.date), ['2026-08-13', '2026-08-20', '2026-08-27']);
  assert.ok(nights.every((n) => n.venue === 'The Station Tap' && n.why === 'usual'));
  // The prizes come with it, so the row can say what the night plays for
  // without a second lookup.
  assert.deepEqual(nights[0].rewards, ['A free drink at the bar']);
});

test('a venue with no usual night fills in nothing', () => {
  assert.equal(upcoming({ venues: [{ name: 'Nowhere' }], now: THU, weeks: 4 }).length, 0);
});

test('two residencies interleave in date order', () => {
  const nights = upcoming({ venues: [STATION, CROWN], now: THU, weeks: 2 });
  assert.deepEqual(nights.map((n) => `${n.date} ${n.venue}`), [
    '2026-08-13 The Station Tap',
    '2026-08-15 The Crown',
    '2026-08-20 The Station Tap',
    '2026-08-22 The Crown',
  ]);
});

/*
 * THE ONE THAT MATTERS. A residency is generated rather than stored, so the
 * only way to say "not that Thursday" is to record the exception — and if that
 * exception can be beaten by anything, the diary lies on the one night
 * somebody checked it.
 */
test('a night OFF removes a residency and cannot be overridden', () => {
  const off = [{ date: '2026-08-20', venue: 'The Station Tap', off: true }];
  const nights = upcoming({ venues: [STATION], bookings: off, now: THU, weeks: 3 });
  assert.deepEqual(nights.map((n) => n.date), ['2026-08-13', '2026-08-27']);

  // …even if a booking for the same slot arrives as well. Off is applied
  // first and is not reconsidered.
  const both = [...off, { date: '2026-08-20', venue: 'The Station Tap' }];
  assert.deepEqual(
    upcoming({ venues: [STATION], bookings: both, now: THU, weeks: 3 }).map((n) => n.date),
    ['2026-08-13', '2026-08-27'],
    'a booking beat a cancellation',
  );
});

test('a one-off is added and marked as one', () => {
  const nights = upcoming({
    venues: [STATION],
    bookings: [{ date: '2026-08-18', venue: 'The Dog and Duck', note: 'Corporate, 40 in' }],
    now: THU,
    weeks: 2,
  });
  const oneOff = nights.find((n) => n.venue === 'The Dog and Duck');
  assert.equal(oneOff.why, 'booked');
  assert.equal(oneOff.note, 'Corporate, 40 in');
  assert.equal(oneOff.date, '2026-08-18');
});

/*
 * A booking on a night you already play there is a NOTE on that night, not a
 * second entry for it — otherwise adding "they want bingo too" would print the
 * same Thursday twice.
 */
test('a booking on the usual night annotates it rather than duplicating it', () => {
  const nights = upcoming({
    venues: [STATION],
    bookings: [{ date: '2026-08-20', venue: 'The Station Tap', note: 'They want bingo after' }],
    now: THU,
    weeks: 3,
  });
  assert.equal(nights.filter((n) => n.date === '2026-08-20').length, 1, 'the night appeared twice');
  const annotated = nights.find((n) => n.date === '2026-08-20');
  assert.equal(annotated.note, 'They want bingo after');
  assert.equal(annotated.why, 'usual', 'a normal Thursday is not a one-off just because it has a note');
});

test('nothing outside the window is offered', () => {
  const nights = upcoming({
    venues: [],
    bookings: [
      { date: '2026-08-01', venue: 'Last month' },
      { date: '2027-01-01', venue: 'Next year' },
      { date: '2026-08-18', venue: 'Soon' },
    ],
    now: THU,
    weeks: 6,
  });
  assert.deepEqual(nights.map((n) => n.venue), ['Soon']);
});

/*
 * THE 6AM ROLL-OVER, which every date in this app shares. A quiz running past
 * midnight is still the same night, so a host launching a second game at half
 * twelve must not have tonight drop off their own diary.
 */
test('a night runs until 6am, so half past midnight is still yesterday', () => {
  assert.equal(nightKey(new Date(2026, 7, 13, 21, 0).getTime()), '2026-08-13');
  assert.equal(nightKey(new Date(2026, 7, 14, 0, 30).getTime()), '2026-08-13');
  assert.equal(nightKey(new Date(2026, 7, 14, 5, 59).getTime()), '2026-08-13');
  assert.equal(nightKey(new Date(2026, 7, 14, 6, 1).getTime()), '2026-08-14');
});

test('the week starts on Monday, not on Sunday', () => {
  // `0` is Sunday in JavaScript and Monday in a diary. Getting this wrong puts
  // every residency one day out, which would put the wrong pub's prizes on a
  // night — so it is worth an explicit test rather than trusting the modulo.
  assert.equal(weekdayOf('2026-08-10'), 'mon');
  assert.equal(weekdayOf('2026-08-13'), 'thu');
  assert.equal(weekdayOf('2026-08-16'), 'sun');
  assert.deepEqual(WEEKDAYS, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
});

// ---------------------------------------------------------------- tonight

test('tonight is the venue whose usual night it is', () => {
  assert.deepEqual(tonight({ venues: [STATION, CROWN], now: THU }),
    { name: 'The Station Tap', why: 'your usual night here' });
});

/*
 * A DATE SOMEBODY TYPED BEATS A PATTERN. That is the whole reason a one-off
 * can be added at all: the Tuesday you are standing in somewhere has to win
 * over the Tuesday residency you are not doing this week.
 */
test('a booking for tonight beats the usual night', () => {
  const answer = tonight({
    venues: [STATION],
    bookings: [
      { date: '2026-08-13', venue: 'The Station Tap', off: true },
      { date: '2026-08-13', venue: 'The Dog and Duck' },
    ],
    now: THU,
  });
  assert.deepEqual(answer, { name: 'The Dog and Duck', why: 'in your diary tonight' });
});

/*
 * A DOUBLE BOOKING MEANS NEITHER. Picking whichever sorted first would put one
 * pub's prizes in front of another pub's room, which surfaces at the final
 * scores in front of sixty people.
 */
test('two venues claiming tonight means neither is offered', () => {
  const clash = [STATION, { name: 'The Crown', usualNight: 'thu' }];
  assert.equal(tonight({ venues: clash, now: THU }), null);
  // …and it does not quietly fall through to "where you played last" either,
  // which would be a third venue nobody asked for.
  assert.equal(tonight({ venues: clash, playedVenues: ['Somewhere else'], now: THU }), null);
});

/*
 * A TYPED DATE BEATS A LIVE RESIDENCY AT ANOTHER VENUE, which is the ranking
 * this used to get wrong: both were treated as equal claims, so the bar went
 * blank and threw away the one answer somebody had actually stated.
 */
test('a one-off tonight beats a residency somewhere else', () => {
  const answer = tonight({
    venues: [STATION, { name: 'The Crown', usualNight: 'thu' }],
    bookings: [{ date: '2026-08-13', venue: 'The Dog and Duck' }],
    now: THU,
  });
  assert.deepEqual(answer, { name: 'The Dog and Duck', why: 'in your diary tonight' });
});

test('and it still beats it when the one-off is at a venue with a usual night of its own', () => {
  // `why` says "usual" for a booking that lands on the venue's own night, so
  // the ranking has to ask the BOOKINGS rather than the label.
  const answer = tonight({
    venues: [{ name: 'The Anchor', usualNight: 'thu' }, { name: 'The Crown', usualNight: 'thu' }],
    bookings: [{ date: '2026-08-13', venue: 'The Anchor' }],
    now: THU,
  });
  assert.equal(answer.name, 'The Anchor');
});

test('TWO TYPED DATES ARE A REAL DOUBLE BOOKING, and neither is offered', () => {
  const both = {
    venues: [],
    bookings: [
      { date: '2026-08-13', venue: 'The Anchor' },
      { date: '2026-08-13', venue: 'The Crown' },
    ],
    now: THU,
  };
  assert.equal(tonight(both), null);
  assert.deepEqual(clashTonight(both).sort(), ['The Anchor', 'The Crown']);
});

test('a clash is NAMED so the bar can say which two', () => {
  const clash = { venues: [STATION, { name: 'The Crown', usualNight: 'thu' }], now: THU };
  assert.deepEqual(clashTonight(clash).sort(), ['The Crown', 'The Station Tap']);
  // And an ordinary night has nothing to say.
  assert.deepEqual(clashTonight({ venues: [CROWN], now: THU }), []);
  assert.deepEqual(clashTonight({ venues: [STATION], now: THU }), []);
});

test('with nothing set it falls back to where you played last', () => {
  assert.deepEqual(tonight({ venues: [CROWN], playedVenues: ['The Old Bell'], now: THU }),
    { name: 'The Old Bell', why: 'where you played last' });
});

test('a brand new account is offered nothing at all', () => {
  assert.equal(tonight({ now: THU }), null);
});

/* A cancelled residency must not still be offered by the launch bar. */
test('a night off is not offered as tonight', () => {
  const answer = tonight({
    venues: [STATION],
    bookings: [{ date: '2026-08-13', venue: 'The Station Tap', off: true }],
    playedVenues: ['The Old Bell'],
    now: THU,
  });
  assert.deepEqual(answer, { name: 'The Old Bell', why: 'where you played last' },
    'a cancelled night was still offered, or the fallback was skipped');
});
