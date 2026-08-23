/**
 * WHAT THIS ROOM HAS ALREADY HEARD — the last time each pack was played, per
 * venue.
 *
 * ---
 *
 * Asked for on 23 August 2026, against the shelf's existing ranking: *"that's
 * a good order but it needs to be per venue as well — if you've done a quiz
 * at venue A and not at venue B recently then this needs to be factored in."*
 *
 * **He is right, and the old comment admitted the gap in its own words.**
 * `quickPicks()` said: *"The app cannot know which venue tonight is (a night
 * does not carry one yet), so 'not played recently' is the closest honest
 * answer to 'will not be a repeat'."* That was true when it was written. A
 * night carries a venue now, so the closest honest answer is no longer the
 * best one — and `library.js`'s own note on the play counts has said the real
 * purpose out loud the whole time: *"the whole use of this line is deciding
 * what not to run at the same venue again."*
 *
 * **The distinction is the entire point of the ranking.** A global "last
 * played" answers *have I run this recently*, which is a fact about the
 * quizmaster's diary. What the shelf is actually for is *will this room have
 * heard it*, which is a fact about one venue. Run the 80s quiz at The Crown
 * on Tuesday and it is still completely fresh at The Station Tap on Thursday
 * — and under the old ranking it sank to the bottom of both.
 *
 * ---
 *
 * **NOTHING NEW IS COLLECTED. This reads what is already on disk** — the same
 * promise `headcounts.js` makes, and this is the same shape of job: the
 * archive has recorded the venue and the pack of every filed night for
 * months, and nothing has ever put the two together.
 *
 * **ONE FUNCTION TAKES A SET OF NIGHTS AND RETURNS THE ANSWER ACROSS THEM**,
 * exactly as `venueHeadcounts()` does, and it takes what `mergeGigs()`
 * returns rather than the raw archive — which settles two things for free:
 * the **6am roll-over**, so a quiz that finished at half past midnight
 * belongs to the evening it started, and **a quiz and the bingo after it
 * being ONE night** rather than two.
 *
 * **AND IT USES `venueKeyOf()`, never the name.** Two readers deciding what
 * counts as "the same venue" in two slightly different ways is how a pack
 * reads as fresh on one screen and stale on the next; the headcounts already
 * key on that function, so a venue means the same thing in both.
 */

import { venueKeyOf } from './past-gigs.js';

/**
 * Every pack this venue has heard, and when it last did.
 *
 * @param {Array} nights what `mergeGigs()` returned
 * @returns {Object} `{ [venueKey]: { [packId]: lastPlayedAt } }`
 */
export function playedByVenue(nights = []) {
  const out = {};
  for (const night of nights) {
    /*
     * A NIGHT WITH NO VENUE TEACHES US NOTHING HERE, so it is skipped rather
     * than filed under "". It is not lost: the GLOBAL `lastPlayedAt` still
     * counts it, and that is the fallback every pack keeps. Filing it under
     * an empty key would make "nowhere" behave like a venue, so a night run
     * before venues existed would suppress a pack at whichever real venue
     * happened to resolve to the same blank.
     */
    const keys = keysFor(night);
    if (!keys.length) continue;
    const at = whenOf(night);
    if (!at) continue;
    for (const key of keys) {
      const here = out[key] || (out[key] = {});
      for (const id of packsIn(night)) {
        // The most recent wins — a pack played here twice is only as stale as
        // the last time, which is the question being asked.
        if (!here[id] || at > here[id]) here[id] = at;
      }
    }
  }
  return out;
}

/**
 * EVERY KEY ONE NIGHT ANSWERS TO — its id AND its name, not one or the other.
 *
 * **This is the split `venueHeadcounts()` already had to fix, and it is worth
 * copying rather than rediscovering.** Its own note: *"pick 'The Station Tap'
 * off the Venues list one week and type the same name freehand the next, and
 * the two nights land under `id:xyz` and `the station tap` respectively — two
 * half-histories under one name."* Every night filed before 17 August 2026
 * carries a name and no id at all, so that is not a rare case — it is most of
 * the history, and it is the half that says a pack has been heard before.
 *
 * The headcounts fold the two together in a second pass because they are
 * BUILDING a list of venues and have to end up with one row each. Nothing is
 * being listed here — this is a lookup — so the same job is done by filing a
 * night under both keys and letting the reader ask under whichever it holds.
 * `venueKeyOf()` is still first, and still does the thing a name-only key
 * cannot: catch a RENAME, where two different names share one id.
 */
function keysFor(night) {
  const keys = new Set();
  const key = venueKeyOf(night);
  if (key) keys.add(key);
  const name = String(night.venue || '').trim().toLowerCase();
  if (name) keys.add(name);
  return [...keys];
}

/**
 * When a merged night happened, in ms.
 *
 * `mergeGigs()` keys on the 6am night STRING, so the timestamp has to come
 * off one of its games. The latest wins, since a quiz and the bingo after it
 * are one evening and the evening's date is when it ended.
 */
function whenOf(night) {
  const times = (night.games || []).map((g) => Number(g.archivedAt) || 0).filter(Boolean);
  if (times.length) return Math.max(...times);
  // A night merged from PHOTOS alone has no archived game to read — fall back
  // to its own date, which is the 6am key and therefore already correct.
  const parsed = Date.parse(`${night.night}T20:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Every pack id a night actually played.
 *
 * **A MIXED NIGHT COUNTS ALL OF ITS PARTS**, not just the one whose ending
 * reached the archive. A quiz → bingo → quiz evening is one record naming the
 * last part, so without this the bingo in the middle would read as never
 * played at this venue however many times it had been.
 *
 * The composed-quiz placeholder (`~tonight`) rides along and is harmless: it
 * matches no pack on any shelf, so it can never suppress a real one.
 */
function packsIn(night) {
  const ids = new Set();
  for (const game of night.games || []) {
    if (game.packId) ids.add(String(game.packId));
    for (const part of game.parts || []) {
      if (part && part.id) ids.add(String(part.id));
    }
  }
  return ids;
}

/**
 * When this venue last heard this pack — 0 for never.
 *
 * The one reader both the shelf and the launch bar use, so the ORDER and the
 * line explaining it can never disagree about whether a pack is fresh here.
 * With no venue chosen there is no venue-specific answer, and the caller
 * falls back to the global date rather than this inventing one.
 */
export function heardHere(index, venueKey, packId) {
  if (!index || !venueKey || !packId) return 0;
  return (index[venueKey] || {})[packId] || 0;
}
