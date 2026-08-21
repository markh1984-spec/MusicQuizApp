/**
 * HOW MANY PLAYED, PER VENUE — the strongest sentence a quizmaster owns.
 *
 * ---
 *
 * *"The Crown went from 22 on a Thursday to 58"* wins a new venue, and — worth
 * more — it SAVES a residency in January, when a landlord is looking at his
 * costs and cannot remember what the room was like before. The app has stored
 * how many phones joined every night since it was written and **nobody has
 * ever seen the number twice**: it went into the archive, was printed once on
 * the night's own row, and was never added up.
 *
 * Nothing new is collected here. This reads what is already on disk.
 *
 * ---
 *
 * **ONE FUNCTION TAKES A SET OF NIGHTS AND RETURNS THE NUMBERS ACROSS THEM.**
 * Venues asks it for one place, Gigs asks it for all of them — same code, same
 * record, N of one or N of five. That is the same rule CLAUDE.md sets for
 * stats across a group of accounts, and it is here for the same reason:
 * shipping "the trend for one venue" and later "across all venues" as two
 * features is how the two drift, and then the card and the panel disagree
 * about a number somebody is showing a landlord.
 *
 * It takes what `mergeGigs()` returns rather than the raw archive, which
 * settles two things for free: the **6am roll-over**, so a quiz that finished
 * at half past midnight belongs to the evening it started, and the quiz and
 * the bingo after it being ONE night rather than two.
 */

import { venueKeyOf } from './past-gigs.js';

/**
 * How many were in the room on one night.
 *
 * **The MAX across the night's games, never the sum.** A quiz and the bingo
 * after it are the same room and mostly the same phones, so adding them would
 * report a night as twice the size it was — on the one page whose entire job
 * is being evidence somebody shows a venue. Past gigs has always printed the
 * max on the night's own row; this is that rule, in a function, so the summary
 * and the row can never disagree.
 */
export function nightHeadcount(night) {
  return (night.games || []).reduce((n, g) => Math.max(n, Number(g.players) || 0), 0);
}

/**
 * Every venue this room has played, with the numbers across its nights.
 *
 * @param {Array} nights   what `mergeGigs()` returns — newest first
 * @returns {{venues: Array, unplaced: number}}
 */
export function venueHeadcounts(nights = []) {
  const byVenue = new Map();
  let unplaced = 0;

  for (const night of nights) {
    const players = nightHeadcount(night);
    /*
     * A NIGHT NOBODY PLAYED IS NOT EVIDENCE OF ANYTHING.
     *
     * A launch that was tested and abandoned, or a game that ended in an empty
     * lobby, files a night with an empty leaderboard. Counted, it drags the
     * average down and — worse — puts a 0 in the middle of the trend somebody
     * is showing a landlord, for a night that never happened. It is the same
     * judgement as "remove the ones who answered nothing" on the scoreboard.
     */
    if (!players) continue;

    const name = String(night.venue || '').trim();
    /*
     * A night with no venue on it is COUNTED AND SAID, never quietly dropped.
     *
     * Every night filed before venues existed has none, and so does any night
     * where the box was left blank. Silently leaving them out means a
     * quizmaster with forty nights sees twelve and believes the app lost the
     * rest — so the number comes back and the page says it in a line.
     */
    if (!name) { unplaced++; continue; }

    // Keyed on the lowercase name, so "the crown" typed one week and "The
    // Crown" the next are one venue rather than two half-histories. The
    // spelling shown is the one from the most recent night, which is what
    // `venuesUsed` already does — `nights` arrives newest first.
    /*
     * KEYED ON THE JOIN, not on the name. `venueKeyOf()` gives the venue's id
     * when the night has one and the lowercased name when it does not — the
     * same helper the league uses, so a venue card and a league table can
     * never be built from different sets of nights.
     */
    const key = venueKeyOf(night);
    if (!byVenue.has(key)) byVenue.set(key, { venue: name, series: [] });
    byVenue.get(key).series.push({ night: night.night, players });
  }

  /*
   * A NIGHT WITH A `venueId` AND A NIGHT AT THE SAME PUB WITHOUT ONE ARE ONE
   * VENUE, and `venueKeyOf()` alone splits them: pick "The Station Tap" off
   * the Venues list one week and type the same name freehand the next, and
   * the two nights land under `id:xyz` and `the station tap` respectively —
   * two half-histories under one name, on the one page whose whole job is
   * showing somebody the shape of their own room. Folded together here, a
   * second pass, purely by the lowercase name every raw group already
   * carries — `venueKeyOf()` still does the first-pass job of catching a
   * RENAME (two different names, one id) that a name-only key would miss.
   */
  const byName = new Map();
  for (const entry of byVenue.values()) {
    const nameKey = entry.venue.toLowerCase();
    // `nights` arrives newest first, so the raw group created FIRST for a
    // given name is the one built from the most recent night — its spelling
    // is the one kept, same as `venuesUsed` already does.
    if (!byName.has(nameKey)) byName.set(nameKey, { venue: entry.venue, series: [] });
    byName.get(nameKey).series.push(...entry.series);
  }

  const venues = [...byName.values()]
    .map(summarise)
    // Most recently played first: the pub you were at last week is the one you
    // are thinking about, and it matches the order every other list of venues
    // in this app comes back in.
    .sort((a, b) => b.latest.night.localeCompare(a.latest.night));

  return { venues, unplaced };
}

/**
 * The numbers for one venue, out of the same record.
 *
 * The console matches on the NAME because that is all a night carries — the
 * venue on a night is free text typed at launch, deliberately, since almost no
 * venue is an account. Same lowercase comparison as everywhere else.
 */
export function headcountsFor(headcounts, venue) {
  const want = String(venue || '').trim().toLowerCase();
  if (!want) return null;
  return (headcounts && headcounts.venues || [])
    .find((v) => v.venue.toLowerCase() === want) || null;
}

/** One venue's nights, oldest first, with the four numbers worth saying. */
function summarise(entry) {
  // Oldest first, because a trend is read forwards: `first` has to be the
  // night they started at for "22 → 58" to mean what it says.
  const series = [...entry.series].sort((a, b) => a.night.localeCompare(b.night));
  const counts = series.map((s) => s.players);
  const total = counts.reduce((a, b) => a + b, 0);
  return {
    venue: entry.venue,
    nights: series.length,
    series,
    first: series[0],
    latest: series[series.length - 1],
    best: Math.max(...counts),
    average: Math.round(total / series.length),
    // How much the room has grown since the first night there. Sent rather
    // than worked out in the browser, so the panel and the card cannot arrive
    // at two different answers.
    change: counts[counts.length - 1] - counts[0],
  };
}
