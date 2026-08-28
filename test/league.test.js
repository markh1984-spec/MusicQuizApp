/**
 * THE QUIZ LEAGUE — the table a venue puts on its wall.
 *
 * The rules being pinned here are the ones somebody would argue about in a pub,
 * which is exactly why they need to be fixed in a test rather than in a
 * comment: how a tie breaks, what turning up is worth, and whether staying for
 * the bingo earns anything.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { leagueTable, leaguesByVenue, teamKey, pointsFor } from '../src/league.js';

const NOW = Date.parse('2026-08-17T20:00:00Z');
const day = (n) => new Date(NOW - n * 86400000).toISOString().slice(0, 10);

/** A quiz night, newest first, in the shape `mergeGigs()` returns. */
const night = (ago, venue, names, kind = 'quiz') => ({
  night: day(ago),
  venue,
  games: [{
    kind,
    leaderboard: names.map((name, i) => ({ position: i + 1, name, score: 100 - i, faceKey: `f-${name}` })),
  }],
});

test('the winner takes ten, and the ladder stops paying at seventh', () => {
  assert.equal(pointsFor(1), 10);
  assert.equal(pointsFor(2), 8);
  assert.equal(pointsFor(7), 2);
  /*
   * NOTHING BELOW SEVENTH FROM THE POSITION ITSELF — the point a team gets for
   * being there is the ATTENDANCE point, added once per night played by
   * `leagueTable()`. It used to be a floor here as well, and keeping both
   * would pay the same point twice under two names.
   *
   * The tail still matters, which is the argument the lucky dip is built on:
   * a team out of contention in week three is on one point a week rather than
   * nothing, and now gets it for EVERY week rather than only their best six.
   */
  assert.equal(pointsFor(8), 0);
  assert.equal(pointsFor(40), 0);
  assert.equal(pointsFor(0), 0, 'and a missing position pays nothing on its own');
});

test('A NIGHT IS ITS FINISH PLUS ONE FOR BEING THERE', () => {
  // Eighth place is still worth exactly 1, as it always was — it just arrives
  // as the attendance point now instead of as a floor on the ladder.
  const { table } = leagueTable([
    night(1, 'The Crown', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'Also Rans']),
  ], { now: NOW });
  assert.equal(table.find((t) => t.name === 'Also Rans').points, 1);
  assert.equal(table.find((t) => t.name === 'a').points, 11, '10 for the win, 1 for being there');
});

test('a team is its name, tidied the four ways a team actually types it', () => {
  assert.equal(teamKey('The Quizzly Bears'), teamKey('quizzly bears'));
  assert.equal(teamKey('  Norfolk   Enchance '), teamKey('Norfolk Enchance'));
  assert.equal(teamKey('Agatha Quiztie!'), teamKey('Agatha Quiztie'));
  // And NOT cleverer than that: two genuinely different names stay different,
  // because a fuzzy match would silently merge two teams on a wall poster.
  assert.notEqual(teamKey('Quiz Team A'), teamKey('Quiz Team B'));
});

test('points add up across a season and the table is ordered', () => {
  const { table, nights } = leagueTable([
    night(1, 'The Crown', ['Quizzly Bears', 'Norfolk Enchance']),
    night(8, 'The Crown', ['Norfolk Enchance', 'Quizzly Bears']),
    night(15, 'The Crown', ['Quizzly Bears', 'Norfolk Enchance']),
  ], { now: NOW });

  assert.equal(nights, 3);
  assert.equal(table[0].name, 'Quizzly Bears');
  assert.equal(table[0].points, 31);      // (10 + 8 + 10) + 3 nights played
  assert.equal(table[0].wins, 2);
  assert.equal(table[0].played, 3);
  assert.equal(table[0].position, 1);
  assert.equal(table[1].points, 29);      // (8 + 10 + 8) + 3 nights played
});

test('a tie is broken by WINS, the way every pub league breaks it', () => {
  // Both finish level: one has a win and a third, the other two seconds — and
  // both played two nights, so the attendance point cannot separate them.
  const { table } = leagueTable([
    night(1, 'The Crown', ['Winners', 'Steady', 'x']),
    night(8, 'The Crown', ['y', 'Steady', 'Winners']),
  ], { now: NOW });

  const winners = table.find((t) => t.name === 'Winners');
  const steady = table.find((t) => t.name === 'Steady');
  assert.equal(winners.points, 18);       // (10 + 6) + 2 nights
  assert.equal(steady.points, 18);        // (8 + 8) + 2 nights
  assert.ok(winners.position < steady.position, 'a win has to beat two seconds');
});

test('the season rolls, so a table cannot be won by having played longest', () => {
  const { table, nights } = leagueTable([
    night(1, 'The Crown', ['Newcomers']),
    night(200, 'The Crown', ['Ancient History']),
  ], { weeks: 12, now: NOW });

  assert.equal(nights, 1);
  assert.deepEqual(table.map((t) => t.name), ['Newcomers']);

  // And everything ever, when a season is not wanted.
  const all = leagueTable([
    night(1, 'The Crown', ['Newcomers']),
    night(200, 'The Crown', ['Ancient History']),
  ], { weeks: 0, now: NOW });
  assert.equal(all.nights, 2);
});

test('bingo scores nobody — a placing there is luck, not a finish', () => {
  const { table, nights } = leagueTable([
    night(1, 'The Crown', ['Lucky Card'], 'bingo'),
    night(2, 'The Crown', ['Actually Played']),
  ], { now: NOW });

  assert.equal(nights, 1, 'the bingo night contributed no table');
  assert.deepEqual(table.map((t) => t.name), ['Actually Played']);
});

test('an evening with two quizzes is ONE night, and the BEST finish counts', () => {
  const evening = {
    night: day(1),
    venue: 'The Crown',
    games: [
      { kind: 'quiz', leaderboard: [{ position: 3, name: 'Stayers' }, { position: 1, name: 'Early Birds' }] },
      { kind: 'quiz', leaderboard: [{ position: 1, name: 'Stayers' }, { position: 2, name: 'Early Birds' }] },
    ],
  };
  const { table, nights } = leagueTable([evening], { now: NOW });

  assert.equal(nights, 1);
  const stayers = table.find((t) => t.name === 'Stayers');
  assert.equal(stayers.played, 1, 'one evening is one appearance');
  assert.equal(stayers.points, 11,
    'their best finish plus ONE night — an evening is one appearance, however many quizzes');
});

test('every venue gets its own table, and a night with no venue joins none', () => {
  const leagues = leaguesByVenue([
    night(1, 'The Crown', ['Crown Regulars']),
    night(2, 'The Dog & Duck', ['Duck Regulars']),
    night(3, '', ['Nowhere']),
  ], { now: NOW });

  assert.deepEqual(Object.keys(leagues).sort(), ['the crown', 'the dog & duck']);
  assert.equal(leagues['the crown'].venue, 'The Crown');
  assert.equal(leagues['the crown'].table[0].name, 'Crown Regulars');
  assert.equal(JSON.stringify(leagues).includes('Nowhere'), false);
});

test('one venue typed two ways is one league', () => {
  const leagues = leaguesByVenue([
    night(1, 'The Crown', ['Regulars']),
    night(8, 'the crown', ['Regulars']),
  ], { now: NOW });

  assert.equal(Object.keys(leagues).length, 1);
  assert.equal(leagues['the crown'].table[0].played, 2);
});

test('a venue with no quiz nights in the season has no league at all', () => {
  const leagues = leaguesByVenue([night(1, 'The Crown', ['Lucky'], 'bingo')], { now: NOW });
  assert.deepEqual(leagues, {}, 'an empty table on a card is worse than none');
});

/**
 * ON THE PROJECTOR AT THE FINAL AND NOWHERE ELSE — the same rule the comeback
 * band follows, and for the same reason: a table of other nights while a
 * question is up is two things on one screen.
 *
 * The state is written by `session.js` once the night is FILED, so what the
 * room sees includes the night they just played. These pin the view rules; the
 * band was also driven to a real final in a browser, which is the only thing
 * that proves anybody draws it.
 */
test('the league reaches the projector at the final, and at no other phase', async () => {
  const { Engine } = await import('../src/engine.js');
  const quiz = {
    id: 'q', title: 'Q',
    rounds: [{ name: 'One', type: 'text', questions: [
      { prompt: 'a', options: ['1', '2'], answerIndex: 0 },
    ] }],
  };
  const e = new Engine({ quiz, now: () => NOW });
  e.state.league = { venue: 'The Crown', nights: 5, teams: 6, table: [{ position: 1, name: 'Quizzly Bears', points: 42 }] };

  assert.equal(e.screenView().league, undefined, 'a league in the lobby is a table nobody asked for');
  e.start();
  e.askQuestion();
  assert.equal(e.screenView().league, undefined, 'never over a live question');
  e.reveal();
  assert.equal(e.screenView().league, undefined, 'never over a reveal');

  e.state.phase = 'final';
  assert.equal(e.screenView().league.table[0].name, 'Quizzly Bears');
});

/**
 * WHERE THE LEAGUE SITS ON THE LADDER — Silver, decided 17 August 2026.
 *
 * Pinned because the reasoning does not fall out of the cost rule. Nothing
 * about a league bills the owner per use, so *"anything that costs money every
 * time it is used is not in Bronze"* leaves it free to sit anywhere; it is on
 * Silver for what it SELLS. A one-line change moves it, and this test is what
 * makes that a decision rather than a drift.
 */
test('the league is a Silver feature, and Bronze does not get it', async () => {
  const { FEATURES, featuresAt, tierOf } = await import('../public/assets/plans.js');

  assert.equal(tierOf(FEATURES.LEAGUE), 'silver');
  assert.equal(featuresAt('bronze').includes(FEATURES.LEAGUE), false);
  assert.equal(featuresAt('silver').includes(FEATURES.LEAGUE), true);
  assert.equal(featuresAt('gold').includes(FEATURES.LEAGUE), true);

  // And the record it reads stays Bronze: everybody keeps their own nights,
  // and the TABLE across them is what the tier buys.
  assert.equal(tierOf(FEATURES.PAST_GIGS), 'bronze');
});

/**
 * The projector band is gated by a flag written AT LAUNCH, never by the
 * console — the same rule the lobby game follows. A night launched before the
 * flag existed has none, and must get no table rather than a default one.
 */
test('no table on a night that was never told it could have one', async () => {
  const { Engine } = await import('../src/engine.js');
  const quiz = { id: 'q', title: 'Q', rounds: [{ name: 'One', type: 'text', questions: [{ prompt: 'a', options: ['1', '2'], answerIndex: 0 }] }] };
  const e = new Engine({ quiz, now: () => NOW });
  e.state.phase = 'final';
  assert.equal(e.screenView().league, undefined, 'a night with no league in its state shows none');
});

/**
 * THE JOIN — a night knows WHICH venue, not just what it was called.
 *
 * Everything that groups nights by venue matched on the name lowercased, which
 * works until a pub is renamed and then one venue silently becomes two
 * half-histories. `venueKeyOf()` is the single answer both the league and the
 * headcounts ask, so they cannot end up describing different sets of nights.
 */
test('a renamed pub keeps ONE league once its nights carry an id', async () => {
  const { venueKeyOf } = await import('../src/past-gigs.js');

  const withId = (ago, name, id, names) => ({ ...night(ago, name, names), venueId: id });
  const leagues = leaguesByVenue([
    withId(1, 'The Crown & Anchor', 'v1', ['Regulars']),   // renamed last week
    withId(8, 'The Crown', 'v1', ['Regulars']),
  ], { now: NOW });

  assert.equal(Object.keys(leagues).length, 1, 'a rename must not split the season in two');
  const [only] = Object.values(leagues);
  assert.equal(only.table[0].played, 2);
  // The name shown is the most recent one — nights arrive newest first, and
  // that is what the pub is called today.
  assert.equal(only.venue, 'The Crown & Anchor');

  assert.equal(venueKeyOf({ venueId: 'v1', venue: 'Anything' }), 'id:v1');
});

test('a night with only a name still groups exactly as it always did', async () => {
  const { venueKeyOf } = await import('../src/past-gigs.js');

  // Most of the history has no id and never will. A join that could not read
  // those would throw away the thing it exists to hold together.
  assert.equal(venueKeyOf({ venue: 'The Crown' }), 'the crown');
  assert.equal(venueKeyOf({ venue: ' the crown ' }), 'the crown');
  assert.equal(venueKeyOf({}), '');

  const leagues = leaguesByVenue([
    night(1, 'The Crown', ['Regulars']),
    night(8, 'the crown', ['Regulars']),
  ], { now: NOW });
  assert.equal(Object.keys(leagues).length, 1);
});

test('an id and a bare name are NOT merged, which is the honest limit', async () => {
  // A night filed before ids existed has nothing tying it to the record, so it
  // cannot be joined to one without guessing. Stated in the code and pinned
  // here so nobody "fixes" it into a name-match that reintroduces the bug.
  const leagues = leaguesByVenue([
    { ...night(1, 'The Crown', ['New']), venueId: 'v1' },
    night(8, 'The Crown', ['Old']),
  ], { now: NOW });
  assert.equal(Object.keys(leagues).length, 2);
});
