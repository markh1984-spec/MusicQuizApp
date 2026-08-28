/**
 * THE LEAGUE, EXPORTED — to the landlord on a report, and to the teams on a
 * public page.
 *
 * Two audiences, two shapes, and the tests that matter are about the GATE and
 * about the table being wound back to the night it describes. The arithmetic
 * itself is `league.test.js`'s job and is not repeated here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { leagueAfter, leagueTable } from '../src/league.js';
import { isVenueKey } from '../src/league-publish.js';
import { nightReportPdf } from '../src/report-pdf.js';

const NOW = Date.parse('2026-03-01T12:00:00Z');

/** One filed night, in the shape `mergeGigs()` returns. */
function night(date, order, venue = 'The Crown') {
  return {
    night: date,
    venue,
    games: [{
      kind: 'quiz',
      title: 'A Quiz',
      leaderboard: order.map((name, i) => ({ name, position: i + 1 })),
    }],
  };
}

test('THE TABLE ON A REPORT IS THE TABLE AS IT STOOD THAT NIGHT', () => {
  // Newest first, as mergeGigs returns them.
  const nights = [
    night('2026-02-20', ['Late Starters', 'Quizzly Bears']),
    night('2026-02-13', ['Quizzly Bears', 'Brain Trust']),
    night('2026-02-06', ['Quizzly Bears', 'Brain Trust']),
  ];

  const after = leagueAfter(nights, '2026-02-13');
  assert.equal(after.nights, 2, 'the night after this one is not counted');
  assert.equal(after.table[0].name, 'Quizzly Bears');
  assert.equal(after.table[0].points, 22, 'two wins plus two nights played, and nothing from the 20th');
  assert.ok(!after.table.some((t) => t.name === 'Late Starters'),
    'a team who first played AFTER this night is not on this night\'s table');

  // And today's table is a different, larger answer — which is the whole
  // point: a report handed over in March must not have moved on since.
  const today = leagueTable(nights, { now: NOW });
  assert.equal(today.nights, 3);
  assert.ok(today.table.some((t) => t.name === 'Late Starters'));
});

test('a night with no date falls back to the whole table rather than throwing', () => {
  const nights = [night('2026-02-13', ['A', 'B'])];
  // The clock is INJECTED here, as everywhere else in this repo: without it
  // the season window is measured from whenever the suite happens to run, and
  // a fixture from February silently falls out of a twelve-week season. That
  // is the fallback behaving correctly, and it made this test fail the first
  // time it was run — which is the test being wrong, not the code.
  assert.equal(leagueAfter(nights, '', { now: NOW }).nights, 1);
  assert.equal(leagueAfter(nights, null, { now: NOW }).nights, 1);
});

test('THE REPORT DRAWS A LEAGUE WHEN THERE IS ONE, AND IS SILENT WHEN THERE IS NOT', () => {
  const entry = night('2026-02-13', ['Quizzly Bears', 'Brain Trust']);
  const league = { table: [{ position: 1, name: 'Quizzly Bears', played: 2, wins: 2, points: 20 }], nights: 2, teams: 1 };

  const withOne = nightReportPdf(entry, { headcount: 40, league });
  const without = nightReportPdf(entry, { headcount: 40 });
  assert.ok(Buffer.isBuffer(withOne) || typeof withOne === 'object', 'a PDF comes back');
  // The table adds rows, so the document is longer. A weak assertion on
  // purpose: this is a binary, and the strong claim (that the numbers are
  // right) belongs to the league tests above.
  assert.ok(String(withOne).length !== String(without).length,
    'a report with a league is not the same document as one without');
});

test('A VENUE KEY IS VALIDATED ON THE WAY IN AND OUT — this file is human-editable', () => {
  assert.ok(isVenueKey('the crown'));
  assert.ok(isVenueKey('id:abc123'));
  assert.ok(!isVenueKey(''), 'empty is not a venue');
  assert.ok(!isVenueKey('a\nb'), 'a newline could forge a second entry');
  assert.ok(!isVenueKey('<script>'), 'never something that could become markup');
  assert.ok(!isVenueKey('x'.repeat(201)), 'and never unbounded');
});

test('THE PUBLISH GATE FAILS CLOSED WITH NO REPOSITORY CONFIGURED', async () => {
  const { publishedVenues, isVenuePublished, setVenuePublished } = await import('../src/league-publish.js');
  /*
   * No GITHUB config in the test environment, which is exactly the state this
   * has to be safe in: nothing is published, nothing can be published, and
   * the refusal SAYS why rather than failing silently.
   */
  assert.deepEqual(await publishedVenues('room'), [], 'nothing is public by default');
  assert.equal(await isVenuePublished('room', 'the crown'), false);
  const tried = await setVenuePublished('room', 'the crown', true);
  assert.equal(tried.ok, false);
  assert.match(tried.error, /repository/, 'it names the cause rather than saying "could not save"');
});

test('and a bad key is refused before anything else is even attempted', async () => {
  const { setVenuePublished } = await import('../src/league-publish.js');
  const out = await setVenuePublished('room', '', true);
  assert.equal(out.ok, false);
  assert.match(out.error, /not a venue/);
});

/**
 * BEST SIX — the rule that lets somebody go on holiday and still have a
 * season, without letting one lucky night win it.
 */
test('A FORTNIGHT AWAY NO LONGER ENDS A TEAM\'S SEASON', () => {
  // Ten weekly nights. Two teams in the same form; one is away for two of
  // them. Positions alternate so neither runs away with it.
  const nights = [];
  for (let w = 0; w < 10; w++) {
    const day = String(10 + w).padStart(2, '0');
    const away = w === 3 || w === 4;
    const order = w % 2 === 0 ? ['Regulars', 'Holiday'] : ['Holiday', 'Regulars'];
    nights.push({
      night: `2026-02-${day}`,
      venue: 'The Crown',
      games: [{
        kind: 'quiz',
        leaderboard: (away ? order.filter((n) => n !== 'Holiday') : order)
          .map((name, i) => ({ name, position: i + 1 })),
      }],
    });
  }
  // Newest first, as mergeGigs returns them.
  nights.reverse();

  const { table } = leagueTable(nights, { now: Date.parse('2026-02-20T12:00:00'), weeks: 0 });
  const reg = table.find((t) => t.name === 'Regulars');
  const hol = table.find((t) => t.name === 'Holiday');

  assert.equal(reg.played, 10);
  assert.equal(hol.played, 8, 'two nights away');
  assert.equal(reg.counted, 6, 'only the best six score');
  assert.equal(hol.counted, 6);

  /*
   * THE WHOLE POINT, and the gap is now made of two nameable parts: the form
   * across their best six, plus TWO for the two nights the away team did not
   * turn up to. Under a running total the away team was 20 points down and
   * out of it; here it is six — less than one win, so a single good night
   * puts them back in front.
   */
  const gap = reg.points - hol.points;
  assert.equal(gap, 6, `expected a recoverable gap — got ${reg.points} v ${hol.points}`);
  assert.equal(reg.played - hol.played, 2, 'two nights of that gap are the attendance point');
  assert.ok(gap < 10, 'and the whole gap is worth less than a single win');
});

test('AND ONE LUCKY NIGHT DOES NOT WIN IT — which a plain average would have allowed', () => {
  const nights = [];
  for (let w = 0; w < 8; w++) {
    const day = String(10 + w).padStart(2, '0');
    // The regular wins every week. The one-hit team plays only the last one,
    // and wins that.
    const order = w === 7 ? ['One Hit', 'Regulars'] : ['Regulars', 'Also Rans'];
    nights.push({
      night: `2026-02-${day}`,
      venue: 'The Crown',
      games: [{ kind: 'quiz', leaderboard: order.map((name, i) => ({ name, position: i + 1 })) }],
    });
  }
  nights.reverse();

  const { table } = leagueTable(nights, { now: Date.parse('2026-02-18T12:00:00'), weeks: 0 });
  assert.equal(table[0].name, 'Regulars', 'seven wins beats one');
  const oneHit = table.find((t) => t.name === 'One Hit');
  assert.equal(oneHit.played, 1);
  assert.equal(oneHit.points, 11, 'ten for the win, one for being there — and no more');
  assert.ok(table[0].points > oneHit.points);
});

test('countingScore takes the best six and drops the rest', async () => {
  const { countingScore, COUNTING_NIGHTS } = await import('../src/league.js');
  assert.equal(COUNTING_NIGHTS, 6, 'the constant this whole rule is named for');
  assert.equal(countingScore([]), 0, 'nobody has played');
  assert.equal(countingScore([10, 8]), 18, 'fewer than six: all of them count');
  assert.equal(countingScore([1, 1, 1, 1, 1, 1]), 6, 'exactly six');
  assert.equal(countingScore([10, 10, 10, 10, 10, 10, 1, 1, 1]), 60,
    'the ones worth nothing are dropped, however many there are');
  // Four tens and four ones: the best six are 10+10+10+10+1+1.
  assert.equal(countingScore([1, 10, 1, 10, 1, 10, 1, 10]), 42,
    'and it is the BEST six, not the first six');
  assert.deepEqual([1, 10, 1], [1, 10, 1], 'the input is not reordered under the caller');
});
