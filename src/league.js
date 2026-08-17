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
          points: 0, played: 0, wins: 0, best: 0, lastSeen: night.night,
        });
      }
      const team = teams.get(key);
      team.points += pointsFor(row.position);
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
    .sort((a, b) => b.points - a.points
      || b.wins - a.wins
      || (a.best || 99) - (b.best || 99)
      || a.name.localeCompare(b.name))
    .map((team, i) => ({ ...team, position: i + 1 }));

  return { table, nights: counted, from: first, to: last };
}

/**
 * Every venue's table, keyed the way the venue record is.
 *
 * Lowercased keys, the same comparison the headcounts and the adverts use — a
 * venue typed "the crown" one week and "The Crown" the next is one place.
 */
export function leaguesByVenue(nights = [], opts = {}) {
  const byVenue = new Map();
  for (const night of nights) {
    const name = String(night.venue || '').trim();
    if (!name) continue;   // a night with no venue belongs to no league
    const key = name.toLowerCase();
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
