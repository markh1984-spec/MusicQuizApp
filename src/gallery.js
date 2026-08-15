/**
 * THE PUBLIC GALLERY — which nights the room is allowed to see.
 *
 * Asked for on 15 August 2026: *"I want quizporium.co.uk/gallery to show my
 * photos, based on date."*
 *
 * ---
 *
 * **A NIGHT IS PRIVATE UNTIL IT IS PUBLISHED, and that is the whole of this
 * file.** Everything else about the gallery — listing, serving, the page — is
 * plumbing on top of routes that already existed for the owner's own export
 * tab. This is the gate.
 *
 * The reason it is a gate rather than "show everything": a photo was taken
 * under a line on a phone that says it **goes on the big screen**. That is not
 * permission for a public web page, and publishing years of history the moment
 * the feature exists would apply the weakest consent in the app to the largest
 * audience it has. One tap per night is the difference between the quizmaster
 * deciding and the deploy deciding.
 *
 * **THE LIST LIVES IN THE PRIVATE PHOTO REPO, not on disk.** Render's free tier
 * wipes the disk on every deploy — the fact this codebase has been bitten by
 * more than once — so a published flag kept in `data/` would quietly unpublish
 * every night the next time anything shipped. The photos are already in that
 * repo; the list of which ones are public belongs beside them.
 *
 * **IT FAILS CLOSED.** If the repo is unreachable, unconfigured, or the file is
 * unreadable, nothing is published. A gallery that shows nothing is a
 * disappointment; a gallery that shows everything because a fetch failed is a
 * disclosure.
 */

import { getFile, putFile, photosRepoConfigured } from './github.js';
import { photoFolder, isNightFolder } from './past-gigs.js';

/** Beside the photos it governs, in the same private repo. */
function listPath(roomId) {
  return `${photoFolder(roomId)}/published.json`;
}

/**
 * Which nights this room has published.
 *
 * @returns {Promise<string[]>} `YYYY-MM-DD`, newest first. Empty on any doubt.
 */
export async function publishedNights(roomId) {
  if (!photosRepoConfigured()) return [];
  let raw = null;
  try {
    raw = await getFile(listPath(roomId), 'photos');
  } catch {
    // Fails closed — see the note at the top. A network wobble must not
    // publish anybody's photographs.
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    const nights = Array.isArray(parsed) ? parsed : parsed.nights;
    return (nights || [])
      .map((n) => String(n || ''))
      // Validated on the way OUT as well as in: this file is in a repo a human
      // can edit, and a bad line in it must not become a path.
      .filter(isNightFolder)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Is this one night public? The question every public route asks first. */
export async function isPublished(roomId, night) {
  if (!isNightFolder(night)) return false;
  return (await publishedNights(roomId)).includes(night);
}

/**
 * Publish a night, or take it back down.
 *
 * **Taking it down is as important as putting it up** — somebody will want
 * their photo gone, and the only honest answer to that on a page with no
 * contact on it is a quizmaster who can unpublish the night in one tap.
 *
 * @returns {Promise<{ok: boolean, nights?: string[], error?: string}>}
 */
export async function setPublished(roomId, night, on) {
  if (!isNightFolder(night)) return { ok: false, error: 'That is not a night.' };
  if (!photosRepoConfigured()) {
    return { ok: false, error: 'The private photo repository is not set up, so there is nowhere to record this.' };
  }
  const have = await publishedNights(roomId);
  const want = on ? [...new Set([...have, night])] : have.filter((n) => n !== night);
  // Nothing to write, and nothing to say — a second tap on an already-published
  // night should not make a commit.
  if (want.length === have.length && want.every((n) => have.includes(n))) {
    return { ok: true, nights: have };
  }
  const sorted = [...want].sort().reverse();
  const res = await putFile(
    listPath(roomId),
    JSON.stringify({ nights: sorted }, null, 2),
    `${on ? 'Publish' : 'Unpublish'} the gallery for ${night}`,
    'photos',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, nights: sorted };
}

/**
 * How a date reads on the page — "Thursday 14 August 2026".
 *
 * Written out rather than left to `toLocaleDateString` on the server, because
 * the server's locale is whatever the host machine happens to be and this is
 * a UK app: the whole file is British spelling and UK chart references.
 */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function readableNight(night) {
  if (!isNightFolder(night)) return '';
  const [y, m, d] = night.split('-').map(Number);
  // Midday UTC, so no timezone can nudge it onto the day before — the same
  // trap the 6am roll-over exists to avoid at the other end.
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  return `${DAYS[at.getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}
