/**
 * HOW MANY PLAYED, PER VENUE.
 *
 * The numbers a quizmaster shows a landlord, so the things worth pinning down
 * are the ones that would put a WRONG number in front of somebody: a quiz and
 * the bingo after it counted twice, an abandoned launch dragging an average
 * down, or a venue typed in two cases showing up as two half-histories.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { venueHeadcounts, nightHeadcount, headcountsFor } from '../src/headcounts.js';
import { mergeGigs } from '../src/past-gigs.js';

/** A night as `mergeGigs()` hands it over. */
const night = (date, venue, ...players) => ({
  night: date,
  venue,
  hasPhotos: false,
  games: players.map((n, i) => ({ id: `${date}-${i}`, kind: 'quiz', title: 'A quiz', players: n, winner: null })),
});

test('one venue, three nights — the first, the latest and the way it went', () => {
  const { venues } = venueHeadcounts([
    night('2026-08-13', 'The Crown', 58),
    night('2026-07-09', 'The Crown', 40),
    night('2026-03-05', 'The Crown', 22),
  ]);
  assert.equal(venues.length, 1);
  const crown = venues[0];
  assert.equal(crown.venue, 'The Crown');
  assert.equal(crown.nights, 3);
  assert.equal(crown.first.players, 22);
  assert.equal(crown.latest.players, 58);
  assert.equal(crown.best, 58);
  assert.equal(crown.average, 40);
  assert.equal(crown.change, 36);
  // Oldest first, because a trend is read forwards.
  assert.deepEqual(crown.series.map((s) => s.players), [22, 40, 58]);
});

test('A QUIZ AND THE BINGO AFTER IT ARE ONE ROOM — the max, never the sum', () => {
  // Adding them would report a 58-person night as 116 on the one page whose
  // whole job is being evidence.
  assert.equal(nightHeadcount(night('2026-08-13', 'The Crown', 58, 51)), 58);
  const { venues } = venueHeadcounts([night('2026-08-13', 'The Crown', 58, 51)]);
  assert.equal(venues[0].latest.players, 58);
});

test('a night nobody played is left out rather than averaged in', () => {
  // A launch that was tested and abandoned files a night with an empty
  // leaderboard. Counted, it puts a 0 in the middle of somebody's trend.
  const { venues } = venueHeadcounts([
    night('2026-08-13', 'The Crown', 58),
    night('2026-08-12', 'The Crown'),
    night('2026-08-11', 'The Crown', 42),
  ]);
  assert.equal(venues[0].nights, 2);
  assert.equal(venues[0].average, 50);
});

test('A NIGHT WITH NO VENUE IS COUNTED AND SAID, not quietly dropped', () => {
  // Every night filed before venues existed has none. Leaving them out in
  // silence means somebody with forty nights sees twelve and thinks the app
  // lost the rest.
  const { venues, unplaced } = venueHeadcounts([
    night('2026-08-13', 'The Crown', 58),
    night('2026-08-06', '', 31),
    night('2026-07-30', '   ', 29),
  ]);
  assert.equal(venues.length, 1);
  assert.equal(unplaced, 2);
});

test('one venue typed in two cases is one venue, spelt as it was last typed', () => {
  const { venues } = venueHeadcounts([
    night('2026-08-13', 'The Crown', 58),
    night('2026-08-06', 'the crown', 22),
  ]);
  assert.equal(venues.length, 1);
  assert.equal(venues[0].venue, 'The Crown');
  assert.equal(venues[0].nights, 2);
  assert.equal(venues[0].change, 36);
});

test('a night with a venueId and a night at the same pub with none are one venue, not two half-histories', () => {
  // The exact shape that split a pub into two cards on the Gigs tab: one
  // night launched by picking it off the Venues list (carries a venueId),
  // another launched by typing the same name freehand (does not).
  const { venues } = venueHeadcounts([
    { ...night('2026-08-20', 'The Station Tap, Wokingham', 19), venueId: 'v1' },
    night('2026-08-13', 'The Station Tap, Wokingham', 17),
  ]);
  assert.equal(venues.length, 1);
  const v = venues[0];
  assert.equal(v.venue, 'The Station Tap, Wokingham');
  assert.equal(v.nights, 2);
  assert.equal(v.first.players, 17);
  assert.equal(v.latest.players, 19);
});

test('a RENAME still merges by venueId, even though the names differ', () => {
  // The other direction: the venue is renamed in the Venues tab, so an
  // older night carries the old free-text name and a newer one the new
  // name — both point at the same venueId, and a name-only key would have
  // split them instead of merging them.
  const { venues } = venueHeadcounts([
    { ...night('2026-08-20', 'The Station Tap & Kitchen', 30), venueId: 'v1' },
    { ...night('2026-07-20', 'The Station Tap', 25), venueId: 'v1' },
  ]);
  assert.equal(venues.length, 1);
  assert.equal(venues[0].nights, 2);
  // The most recent night's spelling wins, same as every other rename here.
  assert.equal(venues[0].venue, 'The Station Tap & Kitchen');
});

test('venues come back most recently played first', () => {
  const { venues } = venueHeadcounts([
    night('2026-08-13', 'The Crown', 58),
    night('2026-08-10', 'The Station Tap', 20),
    night('2026-01-02', 'The Dog and Duck', 44),
  ]);
  assert.deepEqual(venues.map((v) => v.venue), ['The Crown', 'The Station Tap', 'The Dog and Duck']);
});

test('one night is one night — not a trend, and no divide by zero anywhere', () => {
  const { venues } = venueHeadcounts([night('2026-08-13', 'The Station Tap', 20)]);
  assert.equal(venues[0].nights, 1);
  assert.equal(venues[0].first.players, 20);
  assert.equal(venues[0].latest.players, 20);
  assert.equal(venues[0].change, 0);
  assert.equal(venues[0].average, 20);
});

test('nothing at all comes back empty rather than throwing', () => {
  assert.deepEqual(venueHeadcounts([]), { venues: [], unplaced: 0 });
  assert.deepEqual(venueHeadcounts(), { venues: [], unplaced: 0 });
  assert.equal(nightHeadcount({}), 0);
});

test('THE 6AM ROLL-OVER APPLIES — a quiz that ended at half twelve is that evening', () => {
  // Through `mergeGigs`, which is where the roll-over lives, so the headcounts
  // cannot disagree with Past gigs about which day a night was.
  const at = (iso) => Date.parse(iso);
  const nights = mergeGigs([
    { id: 'a', kind: 'quiz', title: 'Q', archivedAt: at('2026-08-13T22:30:00Z'), venue: 'The Crown', rewards: [], playerCount: 30, winner: 'Rob' },
    { id: 'b', kind: 'bingo', title: 'B', archivedAt: at('2026-08-14T00:30:00Z'), venue: 'The Crown', rewards: [], playerCount: 28, winner: 'Rob' },
  ], []);
  const { venues } = venueHeadcounts(nights);
  assert.equal(venues.length, 1);
  assert.equal(venues[0].nights, 1, 'one evening, not two');
  assert.equal(venues[0].latest.players, 30);
});

test('looking one venue up out of the same record', () => {
  const heads = venueHeadcounts([
    night('2026-08-13', 'The Crown', 58),
    night('2026-08-10', 'The Station Tap', 20),
  ]);
  assert.equal(headcountsFor(heads, 'the crown ').latest.players, 58);
  assert.equal(headcountsFor(heads, 'Nowhere'), null);
  assert.equal(headcountsFor(heads, ''), null);
  assert.equal(headcountsFor(null, 'The Crown'), null);
});
