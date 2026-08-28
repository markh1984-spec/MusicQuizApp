/**
 * WHICH VENUES' LEAGUE TABLES THE ROOM IS ALLOWED TO SEE.
 *
 * The gate for `/league`, and the exact shape of `src/gallery.js` one door
 * along — deliberately, because the question is the same question and a second
 * answer to it is a second thing that can be got wrong.
 *
 * ---
 *
 * **A LEAGUE IS PRIVATE UNTIL IT IS PUBLISHED.** A team name was typed on a
 * phone to be a team name for one night; a table on a public web page is a
 * different audience and a much longer time. Publishing every venue the moment
 * the feature exists would apply the weakest consent in the app to the largest
 * audience it has — the same sentence the gallery is built on, and it holds
 * here for the same reason.
 *
 * **PER VENUE, NOT PER NIGHT**, and that is the one real difference. A league
 * IS a venue's season — a page per pub, put up once and left up, which is what
 * a table on a wall is. There is no per-night decision to make because there
 * is no per-night page.
 *
 * **THE LIST LIVES IN THE PRIVATE REPO, not on disk.** Render's free tier
 * wipes `data/` on every deploy — a fact this codebase has been bitten by more
 * than once, and the reason the archive this table is BUILT from is backed up
 * there too. A flag kept in `data/` would silently unpublish every venue the
 * next time anything shipped, and nobody would know until a regular mentioned
 * the page had gone.
 *
 * **IT FAILS CLOSED.** Unreachable, unconfigured or unparseable means nothing
 * is published. A page that shows nothing is a disappointment; a page that
 * shows every team in every pub because a fetch failed is a disclosure.
 *
 * ---
 *
 * **NO FACES HERE, AND THAT IS DECIDED IN THE VIEW RATHER THAN LEFT TO
 * TASTE.** `leagueTable()` carries a `faceKey` per team so the console can
 * draw one; the public page prints names, played, won and points and nothing
 * else. A face is a photograph of somebody in a pub, and the consent it was
 * given under is the big screen — see the gallery's own note.
 */

import { getFile, putFile, photosRepoConfigured } from './github.js';
import { photoFolder } from './past-gigs.js';

/**
 * Beside the gallery's own list, in the same private repo.
 *
 * `photoFolder()` names the room's folder rather than anything photographic —
 * it is where a room's private things live, and putting this somewhere else
 * would mean a second folder to configure for no gain.
 */
function listPath(roomId) {
  return `${photoFolder(roomId)}/leagues-published.json`;
}

/**
 * A venue key is `venueKeyOf()`'s output — an id or a lowercased name.
 *
 * Validated on the way in AND on the way out, because this file sits in a
 * repository a human can open and edit: a bad line in it must never become a
 * path, a lookup against something it was not meant to match, or markup.
 */
export function isVenueKey(key) {
  const k = String(key || '');
  return Boolean(k) && k.length <= 200 && !/[<>\n\r]/.test(k);
}

/**
 * Which venues this room has published.
 *
 * @returns {Promise<string[]>} venue keys, sorted. Empty on any doubt.
 */
export async function publishedVenues(roomId) {
  if (!photosRepoConfigured()) return [];
  let raw = null;
  try {
    raw = await getFile(listPath(roomId), 'private');
  } catch {
    // Fails closed — see the note at the top. A network wobble must not put
    // anybody's team name on a public page.
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    const venues = Array.isArray(parsed) ? parsed : parsed.venues;
    return [...new Set((venues || []).map((v) => String(v || '')).filter(isVenueKey))].sort();
  } catch {
    return [];
  }
}

/** Is this one venue's table public? The question the public route asks first. */
export async function isVenuePublished(roomId, key) {
  if (!isVenueKey(key)) return false;
  return (await publishedVenues(roomId)).includes(String(key));
}

/**
 * Publish a venue's table, or take it back down.
 *
 * **Taking it down is as important as putting it up.** A team will ask, and
 * the only honest answer on a page with no contact details on it is a
 * quizmaster who can unpublish the venue in one tap. That is why the console
 * draws the two controls with equal weight rather than hiding the second.
 *
 * @returns {Promise<{ok: boolean, venues?: string[], error?: string}>}
 */
export async function setVenuePublished(roomId, key, on) {
  if (!isVenueKey(key)) return { ok: false, error: 'That is not a venue.' };
  if (!photosRepoConfigured()) {
    return { ok: false, error: 'The private repository is not set up, so there is nowhere to record this.' };
  }
  const have = await publishedVenues(roomId);
  const want = on
    ? [...new Set([...have, String(key)])]
    : have.filter((v) => v !== String(key));
  // A second tap on an already-published venue should not make a commit.
  if (want.length === have.length && want.every((v) => have.includes(v))) {
    return { ok: true, venues: have };
  }
  const sorted = [...want].sort();
  const res = await putFile(
    listPath(roomId),
    JSON.stringify({ venues: sorted }, null, 2),
    `${on ? 'Publish' : 'Unpublish'} the league table for ${key}`,
    'private',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, venues: sorted };
}
