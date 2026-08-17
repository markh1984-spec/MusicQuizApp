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

test('the winner takes ten and everybody who turned up scores', () => {
  assert.equal(pointsFor(1), 10);
  assert.equal(pointsFor(2), 8);
  assert.equal(pointsFor(7), 2);
  // The tail is the point: a team out of contention in week three still has a
  // reason to come back, which is the same argument the lucky dip is built on.
  assert.equal(pointsFor(8), 1);
  assert.equal(pointsFor(40), 1);
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
  assert.equal(table[0].points, 28);      // 10 + 8 + 10
  assert.equal(table[0].wins, 2);
  assert.equal(table[0].played, 3);
  assert.equal(table[0].position, 1);
  assert.equal(table[1].points, 26);      // 8 + 10 + 8
});

test('a tie is broken by WINS, the way every pub league breaks it', () => {
  // Both finish on 18: one has a win and a third, the other two seconds.
  const { table } = leagueTable([
    night(1, 'The Crown', ['Winners', 'Steady', 'x']),
    night(8, 'The Crown', ['y', 'Steady', 'Winners']),
  ], { now: NOW });

  const winners = table.find((t) => t.name === 'Winners');
  const steady = table.find((t) => t.name === 'Steady');
  assert.equal(winners.points, 16);
  assert.equal(steady.points, 16);
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
  assert.equal(stayers.points, 10, 'their best finish, not both added together');
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
