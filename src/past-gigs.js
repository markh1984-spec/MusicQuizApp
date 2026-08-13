/**
 * What a quizmaster has actually run — the nights, the packs and the pictures.
 *
 * ---
 *
 * **This is a record of somebody's WORK, not a feature of the game.** A
 * quizmaster pitching for a Thursday at a new venue is asked what they have
 * done; "here are the last two years of nights, the packs, the crowd sizes and
 * the photographs" answers that in one page. Everything it needs was already
 * being written down — the archive files a night the moment it ends, and the
 * photos are filed away as they arrive — but the two were kept in different
 * places and neither was shown to anybody.
 *
 * ---
 *
 * **The photos are read from the private repository, never from the disk.**
 * `data/photos/` is wiped on every deploy, so a page built from it would show
 * the current night and swear blind that nothing else had ever happened. The
 * repo is the permanent copy and is where the pictures actually live; this
 * reads it, and the server proxies the bytes back because that repo is private
 * and a browser cannot fetch from it.
 *
 * **And they are foldered PER ROOM.** `photos/<roomId>/<night>/` — the house
 * keeps the flat `photos/<night>/` it has always used, for the reason every
 * other house path is unchanged: Mark already has nights filed under it and
 * moving them would make his own history disappear. Without the room in the
 * path two quizmasters' nights would land in one folder, which on the one
 * feature whose whole point is "this is my work" is exactly wrong.
 */

import { HOUSE_ROOM } from './library.js';

/** Where this room's photos are filed in the private photo repository. */
export function photoFolder(roomId) {
  const id = String(roomId || HOUSE_ROOM);
  return id === HOUSE_ROOM ? 'photos' : `photos/${id}`;
}

/**
 * A folder name is only a night if it looks like one.
 *
 * The house folder is shared with nothing today, but a stray directory in
 * there would otherwise become a gig with no date, sorted wherever the
 * comparison happened to put it.
 */
export function isNightFolder(name) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(name || ''));
}

/**
 * Which night an archived game belongs to.
 *
 * The same 6am roll-over the photos use (`nightOf` in photos.js), and it has to
 * be the same or a quiz that finished at half past midnight would be filed
 * under Wednesday while its own photographs were under Tuesday — one gig
 * appearing twice, which is worse than either half being missing.
 */
export function nightOfGig(at) {
  const t = Number(at);
  if (!Number.isFinite(t) || t <= 0) return '';
  return new Date(t - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * One list of nights, newest first, out of the two records.
 *
 * A night can have games and no photos (nobody opened the camera), or photos
 * and no games (an older night, or one whose archive was lost before the
 * backup existed) — both are real and both belong on the page. What must not
 * happen is the same evening appearing twice because the two halves disagreed
 * about which day it was.
 *
 * @param {Array} archived      what `listArchive()` returns
 * @param {Array<string>} photoNights   folder names from the photo repository
 */
export function mergeGigs(archived = [], photoNights = []) {
  const nights = new Map();
  const nightFor = (key) => {
    // No photo COUNT here on purpose: knowing how many there are means listing
    // the folder, which is a request per night, and the page only ever needs
    // "is there anything to open". The count arrives with the pictures.
    if (!nights.has(key)) nights.set(key, { night: key, games: [], hasPhotos: false, venue: '' });
    return nights.get(key);
  };

  for (const record of archived) {
    const night = nightOfGig(record.archivedAt);
    if (!night) continue;
    const entry = nightFor(night);
    /*
     * WHERE IT WAS, on the night rather than on each game.
     *
     * A quiz and the bingo after it are one evening at one venue, so it
     * belongs to the night — the same reason the tab badge counts nights and
     * not games. `listArchive` has carried it since a night learned where it
     * was, and this function simply never passed it through, which is why the
     * page that exists to show somebody your work never said where any of it
     * happened.
     *
     * First one wins, and only if it is set: a night filed before venues
     * existed has none, and the honest answer there is nothing rather than a
     * guess. If two games somehow disagree the first is as good as either —
     * a quizmaster who moved venue mid-evening has bigger problems.
     */
    if (!entry.venue && record.venue) entry.venue = record.venue;
    entry.games.push({
      id: record.id,
      kind: record.kind || 'quiz',
      title: record.title || '',
      players: record.playerCount || 0,
      winner: record.winner || null,
    });
  }

  for (const name of photoNights) {
    if (!isNightFolder(name)) continue;
    nightFor(name).hasPhotos = true;
  }

  return [...nights.values()].sort((a, b) => b.night.localeCompare(a.night));
}

/**
 * A file name that came out of the photo repository, checked before it is used
 * to build a path.
 *
 * The names are ours — `add()` in photos.js issues them — but by the time they
 * come back they have been through a listing, so treating them as trusted would
 * be trusting the round trip rather than the source. A night is a date and a
 * photo is one of our own ids with a known extension; anything else is not
 * something this app filed.
 */
export function safePhotoName(name) {
  return /^[a-z0-9]+\.(jpg|png|webp)$/i.test(String(name || '')) ? String(name) : '';
}
