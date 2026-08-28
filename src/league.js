/**
 * THE QUIZ LEAGUE — the same teams, tracked over a season, per venue.
 *
 * A landlord's question is never *"how many came last Thursday"*, it is
 * *"are the same people coming back"*. The headcount answers the first and
 * this answers the second, out of the same record: every filed night already
 * carries its full leaderboard, so a league is arithmetic over what is on disk
 * rather than anything new to collect.
 *
 * What it is FOR, in order:
 *
 * - **It gives a room a reason to come back next week**, which is the venue's
 *   revenue and therefore the quizmaster's booking. A team lying fourth in
 *   February turns up in March.
 * - **It is something to sell.** A venue running "the league" has a season, a
 *   table to put on a wall and a champion at the end of it — a night with a
 *   shape rather than a quiz that happens weekly.
 * - **It costs the quizmaster nothing to run.** No sign-up, no admin on a
 *   Monday: teams type the same name they always type and the table maintains
 *   itself. That is the test every feature here has to pass.
 *
 * ---
 *
 * **ONE FUNCTION TAKES A SET OF NIGHTS AND RETURNS THE TABLE ACROSS THEM**,
 * exactly as `headcounts.js` does and for the same reason: a venue's own table
 * and any future table across venues must be the same code, or the two drift
 * and then a wall poster disagrees with a screen.
 *
 * ---
 *
 * **A TEAM IS A NAME, AND THAT IS A REAL LIMIT — SAY IT RATHER THAN HIDE IT.**
 * There is no login for a team and there must not be: a phone proves nothing
 * beyond the night it is playing (rule 3), and asking a pub team to register
 * would kill the thing at the door. So identity is the name typed on a phone,
 * normalised — case, spacing, a leading "The", and trailing punctuation.
 *
 * That means *Quizzly Bears* and *The Quizly Bears* are two teams, and a
 * borrowed name is the same team. **Both are acceptable and neither is
 * fixable without an account**, which is why the console prints the rule
 * beside the table instead of pretending to a precision it has not got.
 *
 * ---
 *
 * **QUIZZES ONLY.** A bingo leaderboard has no finishing order in the sense a
 * league needs — it is who won a line and how many squares away everybody else
 * was, which is luck rather than a placing, and awarding league points for it
 * would put a team top for being dealt a good card. Bingo nights are counted
 * as nights the venue ran; they contribute no points.
 */

import { venueKeyOf } from './past-gigs.js';

/**
 * THE POINTS, and why everybody who turns up scores.
 *
 * Ten for a win down to one for taking part. The tail matters more than the
 * head here: a team that works out in week three that it cannot win the season
 * has nothing left to come back for, which is the same retention argument the
 * lucky dip is built on — and a room that thins out by March is worth less to
 * the pub than one that does not.
 *
 * Positions rather than raw scores, deliberately. A quiz's score depends on
 * how many rounds it had and how fast the answers came; a night with twelve
 * rounds would otherwise be worth three of a night with four, and the league
 * would measure the quizmaster's programme rather than the teams.
 */
export const LEAGUE_POINTS = [10, 8, 6, 5, 4, 3, 2];
export const POINTS_FOR_TURNING_UP = 1;

/**
 * HOW MANY NIGHTS COUNT — your best six, and the rest are dropped.
 *
 * Asked for on 25 August 2026, and it is the fix to the one thing a
 * cumulative table gets badly wrong: *"there's incentive to come every week
 * but also doesn't make it pointless to come if you had to miss 1-2 weeks for
 * holiday or whatever."*
 *
 * **A RUNNING TOTAL PUNISHES ABSENCE ABSOLUTELY.** Two weeks away is twenty
 * points you can never make up, so the team works out in week six that the
 * season is gone and stops coming — which is the retention argument this
 * whole feature exists to serve, running backwards. Measured on a ten-night
 * fixture: a team away for a fortnight finished 22 points behind on the
 * total, more than two wins, with no way back.
 *
 * **AND A PLAIN AVERAGE BREAKS IT THE OTHER WAY, which is why it was offered
 * and not taken.** Mean points per night puts a team that played ONCE AND WON
 * above a team that won five of ten — 10.00 against 9.20 on that same
 * fixture. That removes the reason to come every week entirely, which is the
 * half of the ask a mean was meant to protect.
 *
 * **BEST SIX DOES BOTH.** The holiday costs nothing while six nights survive;
 * turning up every week is still worth it, because more nights mean more
 * chances at a big score AND the right to drop your worst ones. On the
 * fixture above it closes that 22-point gap to 6 — a race decidable on one
 * good night rather than one already over.
 *
 * **SUMMED, NOT DIVIDED, AND THE TWO ARE THE SAME TABLE.** "Best six
 * averaged" is this divided by a FIXED six, which changes every number by the
 * same factor and therefore changes no position at all. Dividing by how many
 * you actually played is the plain average again, with its one-hit problem
 * back. So the order is identical and whole points are what get shown, because
 * "46 points" is what gets read out in a pub and "7.67" is not.
 *
 * Six because a rolling twelve-week season is ten to twelve weekly nights, so
 * it is comfortably half of them off — well past the one or two he asked
 * about — while still needing a real run to win. A fortnightly venue runs
 * about six in a season, where this is simply the total and costs nothing.
 * **A constant with a note rather than a setting**, the same call the season
 * length itself already made.
 */
export const COUNTING_NIGHTS = 6;

/**
 * The best `COUNTING_NIGHTS` of a team's scores, added up.
 *
 * Fewer than six nights played means all of them count, so an early season —
 * and a team who has only just started — behaves exactly as a running total
 * did. The drop only ever begins once there is something to drop, which is
 * what makes this degrade gracefully rather than needing a rule about when it
 * switches on.
 */
export function countingScore(scores = []) {
  return [...scores]
    .sort((a, b) => b - a)
    .slice(0, COUNTING_NIGHTS)
    .reduce((sum, n) => sum + n, 0);
}

/** What a finishing position is worth. */
export function pointsFor(position) {
  const at = Math.floor(Number(position) || 0) - 1;
  if (at < 0) return POINTS_FOR_TURNING_UP;
  return LEAGUE_POINTS[at] ?? POINTS_FOR_TURNING_UP;
}

/**
 * One team's identity, from the name they typed.
 *
 * Lowercased, whitespace collapsed, a leading "the" dropped and trailing
 * punctuation trimmed — the four differences a team actually types week to
 * week. Nothing cleverer: a fuzzy match that decided *Quiz Team A* and
 * *Quiz Team B* were one team would corrupt a table somebody has pinned to a
 * wall, and there would be no way to see that it had happened.
 */
export function teamKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/[.,!?]+$/, '')
    .trim();
}

/**
 * The table for a set of nights.
 *
 * Takes what `mergeGigs()` returns — so the 6am roll-over and "a quiz and the
 * bingo after it are ONE night" both come free, exactly as they do for the
 * headcounts — with each game's `leaderboard` still on it.
 *
 * @param {Array} nights   newest first, as mergeGigs returns them
 * @param {object} [opts]
 * @param {number} [opts.weeks]  the season's length; 0 for everything ever
 * @param {number} [opts.now]    injected clock, never Date.now() inline
 * @returns {{table: Array, nights: number, from: string, to: string}}
 */
export function leagueTable(nights = [], { weeks = 12, now = Date.now() } = {}) {
  /*
   * A ROLLING SEASON, not everything ever.
   *
   * A table that never resets is won by whoever played most in it, so by the
   * second year it is a loyalty record rather than a competition and nobody
   * new can catch up — which removes the reason it exists. Twelve weeks is a
   * quarter: long enough that one bad night does not settle it, short enough
   * that a team joining in week two can still win.
   */
  const floor = weeks > 0 ? now - weeks * 7 * 24 * 60 * 60 * 1000 : 0;

  const teams = new Map();
  let counted = 0;
  let first = '';
  let last = '';

  for (const night of nights) {
    // `night.night` is the evening's own key (YYYY-MM-DD), which is what makes
    // this comparable without re-deriving a date from a filename.
    const when = Date.parse(`${night.night}T12:00:00`);
    if (floor && (!Number.isFinite(when) || when < floor)) continue;

    // Quizzes only — see the note at the top. A bingo-only night is a night
    // the venue ran and scores nobody.
    const boards = (night.games || [])
      .filter((g) => (g.kind || 'quiz') !== 'bingo' && Array.isArray(g.leaderboard) && g.leaderboard.length);
    if (!boards.length) continue;

    counted++;
    if (!last) last = night.night;
    first = night.night;

    /*
     * ONE PLACING PER TEAM PER NIGHT, even when the evening had two quizzes.
     * Their BEST is the one that counts — an evening is a night out, not two
     * chances to bank points, and a team that stayed for both should not be
     * ahead of one that played the same quiz and went home.
     */
    const tonight = new Map();
    for (const board of boards) {
      for (const row of board.leaderboard) {
        const key = teamKey(row.name);
        if (!key) continue;
        const place = Number(row.position) || 0;
        const seen = tonight.get(key);
        if (!seen || (place && place < seen.position)) {
          tonight.set(key, { name: row.name, position: place, faceKey: row.faceKey || '' });
        }
      }
    }

    for (const [key, row] of tonight) {
      if (!teams.has(key)) {
        teams.set(key, {
          key, name: row.name, faceKey: row.faceKey,
          // EVERY NIGHT'S SCORE IS KEPT, and the best six are added up at the
          // end — a running total cannot be un-run once a seventh night
          // arrives and a worse one has to drop out of it.
          scores: [], points: 0, played: 0, wins: 0, best: 0, lastSeen: night.night,
        });
      }
      const team = teams.get(key);
      team.scores.push(pointsFor(row.position));
      team.played++;
      if (row.position === 1) team.wins++;
      if (row.position && (!team.best || row.position < team.best)) team.best = row.position;
      /*
       * The name they used MOST RECENTLY wins, and `nights` arrives newest
       * first — so a team that tidied its spelling shows the tidy one, and the
       * face on the newest night is the face on the table.
       */
      if (night.night > team.lastSeen) team.lastSeen = night.night;
      if (!team.faceKey && row.faceKey) team.faceKey = row.faceKey;
    }
  }

  /*
   * Points, then wins, then the best finish, then the name.
   *
   * Wins before best-finish because a league is won by winning: two teams on
   * 30 points where one has three firsts and the other three seconds are not
   * level, and every pub league in the country breaks that tie the same way.
   * The name last so the order is stable — a table that reshuffles between two
   * loads of the same page is a table nobody believes.
   */
  const table = [...teams.values()]
    .map((team) => ({
      ...team,
      points: countingScore(team.scores),
      // How many of their nights actually counted, so a table can say "best 6
      // of 9" rather than leaving somebody to work out why their total is not
      // the sum of their weeks.
      counted: Math.min(team.played, COUNTING_NIGHTS),
    }))
    /*
     * Points, then wins, then the best finish, then the name.
     *
     * WINS ARE COUNTED ACROSS EVERY NIGHT, not only the six that scored — it
     * is a plain fact about the team and it is only ever a tie-break, so the
     * honest number beats one that would need explaining. Two teams level on
     * their best six are separated by who actually won more quizzes, which is
     * how every pub league in the country breaks it.
     */
    .sort((a, b) => b.points - a.points
      || b.wins - a.wins
      || (a.best || 99) - (b.best || 99)
      || a.name.localeCompare(b.name))
    .map((team, i) => ({ ...team, position: i + 1 }));

  return { table, nights: counted, from: first, to: last };
}

/**
 * THE TABLE AS IT STOOD AFTER ONE PARTICULAR NIGHT.
 *
 * The same arithmetic, wound back: nights after `night` are dropped and the
 * season window is measured from that evening rather than from today. So the
 * report a landlord is handed for the 14th says what the room was looking at
 * on the 14th — which is the one thing that makes it evidence rather than a
 * snapshot that has moved on since.
 *
 * It has to be `leagueTable()` itself doing the work, with a different clock
 * and a shorter list, or the report and the projector would be two
 * calculations of one number and would eventually disagree. That is the same
 * argument `headcounts.js` records for taking a SET of nights: one function,
 * many questions.
 *
 * @param {Array} nights   as `mergeGigs()` returns them, newest first
 * @param {string} night   `YYYY-MM-DD` — the evening the table is "after"
 */
export function leagueAfter(nights = [], night, opts = {}) {
  const upTo = String(night || '');
  if (!upTo) return leagueTable(nights, opts);
  // Noon, so no timezone can move the day — the guard the diary and the
  // comeback slide both already use.
  const when = Date.parse(`${upTo}T12:00:00`);
  return leagueTable(
    nights.filter((n) => String(n.night || '') <= upTo),
    { ...opts, now: Number.isFinite(when) ? when : opts.now },
  );
}

/**
 * Every venue's table, keyed by the JOIN rather than by the name.
 *
 * `venueKeyOf()` returns the venue's id when the night has one and the
 * lowercased name when it does not, so a pub that gets renamed keeps one table
 * from the day it had an id — and every night filed before ids existed still
 * groups exactly as it always did. One helper, shared with the headcounts, so
 * a venue card and a league table can never describe different sets of nights.
 *
 * The KEY is the join; the NAME shown is the most recent one, because `nights`
 * arrives newest first and that is the name on the pub today.
 */
export function leaguesByVenue(nights = [], opts = {}) {
  const byVenue = new Map();
  for (const night of nights) {
    const name = String(night.venue || '').trim();
    if (!name) continue;   // a night with no venue belongs to no league
    const key = venueKeyOf(night);
    if (!byVenue.has(key)) byVenue.set(key, { venue: name, nights: [] });
    byVenue.get(key).nights.push(night);
  }

  const out = {};
  for (const [key, entry] of byVenue) {
    const league = leagueTable(entry.nights, opts);
    // A venue with no quiz nights in the season has no league, and saying so
    // by absence is better than an empty table on a card.
    if (league.nights) out[key] = { venue: entry.venue, ...league };
  }
  return out;
}
