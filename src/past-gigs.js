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

import { HOUSE_ROOM, listArchive, updateArchivedNight, archiveResults } from './library.js';
// The 6am roll-over lives in its own file — see the note there for why.
import { nightDay } from './night-day.js';

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
  return nightDay(at);
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
    if (!nights.has(key)) nights.set(key, { night: key, games: [], hasPhotos: false, venue: '', venueId: '', venueMixed: false });
    return nights.get(key);
  };

  for (const record of archived) {
    const night = nightOfGig(record.archivedAt);
    if (!night) continue;
    const entry = nightFor(night);
    /*
     * WHERE IT WAS, on the night rather than on each game.
     *
     * **STILL KEYED ON THE DATE ALONE, DELIBERATELY** — a photo folder is
     * physically one-per-date on disk with no venue in its name at all, and
     * the invoicing "unbilled" match, the PDF export route and the Post-gig
     * bench's drag-and-drop all address a night by `night.night`, the raw
     * date string, as though it were unique. Splitting this INTO two rows
     * by venue was tried and reverted: it would have made every one of
     * those into an ambiguous lookup on exactly the rare day it was meant
     * to fix — a worse bug than the one being fixed.
     *
     * So instead: an honest `venueMixed` flag. Two games at the SAME venue
     * (or both with none set — the ordinary case, a quiz then the bingo
     * after it) still merge and still claim that venue. Two games at
     * genuinely DIFFERENT venues on the same day still share one row (the
     * addressing above needs that), but the row stops CLAIMING either
     * venue — `venueMixed: true`, `venue: ''` — rather than silently
     * misattributing everything to whichever was typed first.
     * `venueKeyOf` is the same canonicalisation `headcounts.js` and the
     * league already use, so this cannot disagree with either about what
     * counts as "the same venue".
     */
    if (!entry.venueMixed) {
      const seen = entry.venue || entry.venueId ? venueKeyOf(entry) : '';
      const now = venueKeyOf(record);
      if (!seen) {
        if (record.venue) entry.venue = record.venue;
        if (record.venueId) entry.venueId = record.venueId;
      } else if (now && now !== seen) {
        entry.venueMixed = true;
        entry.venue = '';
        entry.venueId = '';
      }
    }
    /*
     * A VENUE NOTE IS NOT A GAME — see `setNightVenue()` below.
     *
     * It exists to carry a venue for a night nothing was ever filed for, so
     * the block above has already taken the one field it holds. Counting it
     * as a game would put a phantom nought-player quiz into the headcounts,
     * a board with nobody on it into the league, and a pack that does not
     * exist into "has this room heard this before?" — and Post gig's own
     * *"No results saved"* would stop being true of a night that genuinely
     * has none.
     */
    if (record.kind === 'note') continue;
    entry.games.push({
      id: record.id,
      kind: record.kind || 'quiz',
      title: record.title || '',
      /*
       * WHICH PACK, AND WHEN — both needed by `playedByVenue()` to answer
       * "has this room heard this before?", and both were being dropped here
       * for the reason the note on the leaderboard below already gives: this
       * function PICKS fields rather than spreading, so anything not named
       * simply does not come out. `id` above is the night's own file name,
       * not the pack's.
       */
      packId: record.packId || '',
      archivedAt: record.archivedAt || null,
      players: record.playerCount || 0,
      winner: record.winner || null,
      rewards: record.rewards || [],
      rewardsTaken: record.rewardsTaken || 0,
      rewardsReinstated: record.rewardsReinstated || 0,
      /*
       * The leaderboard rides along ONLY when the caller asked `listArchive`
       * for it, which is the league and nothing else. This function picks
       * fields rather than spreading the record — deliberately, so a new field
       * on a filed night cannot appear in a payload nobody meant to grow — and
       * that is exactly why the boards were invisible here at first: they were
       * on the record and dropped one line later.
       */
      ...(record.leaderboard ? { leaderboard: record.leaderboard } : {}),
      /*
       * A RUNNING-ORDER NIGHT — quiz, then a bingo interlude, then quiz again
       * — is still ONE archived record, because only the last part ever
       * reaches its own game's real ending. Without this, the single game
       * entry it produces names only that last part, and the quiz either
       * side of the interlude simply never appears here. `parts` carries
       * every part in order; a night that was never a running order has no
       * such field, so nothing changes for the ordinary case.
       */
      ...(record.parts ? { parts: record.parts } : {}),
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
 *
 * The one optional `-picked` marker (`NOT_CAMERA_SUFFIX` in photos.js) is
 * part of that same scheme, not an exception to it — `add()` is still the
 * only thing that writes it, in the one place it is allowed to appear.
 */
export function safePhotoName(name) {
  return /^[a-z0-9]+(-picked)?\.(jpg|png|webp)$/i.test(String(name || '')) ? String(name) : '';
}

/**
 * WHICH VENUE A NIGHT BELONGS TO, as one key.
 *
 * **The id when the night has one, the lowercased name when it does not.**
 *
 * Every night filed before 17 August 2026 carries only a name, and so does any
 * night launched with a venue typed straight into the box rather than picked
 * off the book. Those are not edge cases — they are most of the history — so a
 * join that insisted on an id would throw away the very thing it exists to
 * hold together.
 *
 * **One function, because two readers must not disagree.** The headcounts and
 * the league both group by venue, and the day one of them keys on the id while
 * the other keys on the name is the day a venue card and a league table
 * describe different sets of nights. That is the same rule `nightHeadcount()`
 * was written for.
 *
 * The known limit, stated rather than hidden: a pub renamed BEFORE it had an
 * id still reads as two venues, because there is nothing in the old nights to
 * tie them together. Nights from here on cannot drift apart that way.
 */
export function venueKeyOf(night) {
  if (!night) return '';
  const id = String(night.venueId || '').trim();
  if (id) return `id:${id}`;
  return String(night.venue || '').trim().toLowerCase();
}

/**
 * ARE THESE TWO NIGHTS AT THE SAME PUB? — the id-or-name fold, as one answer.
 *
 * `venueKeyOf()` alone SPLITS a pub, because picking a venue off the book files
 * a night under `id:xyz` and typing the same name freehand files it under the
 * bare name. That split has now been found three times — the rail showing "The
 * Station Tap, Wokingham" twice, the headcounts, and the gallery's own URLs —
 * and each was fixed where it was found.
 *
 * This is the same fold as a function, because there were still THREE more
 * places asking the question a fourth way: the landlord's report and the
 * projector's league band both compared venue STRINGS directly, and one of them
 * did not even trim. A rename, or one week booked off the book and the next
 * typed in, and a season quietly splits — on a document a landlord forwards.
 *
 * **The id wins when both have one**, so two pubs that genuinely share a name
 * stay apart wherever the book was used. Otherwise it falls to the name, which
 * is all a night filed before venue ids existed has — and that is most of the
 * history. An EMPTY venue matches nothing, or every night with no pub on it
 * lands in every pub's season.
 */
export function sameVenue(a, b) {
  if (!a || !b) return false;
  const idA = String(a.venueId || '').trim();
  const idB = String(b.venueId || '').trim();
  if (idA && idB) return idA === idB;
  const nameA = String(a.venue || '').trim().toLowerCase();
  const nameB = String(b.venue || '').trim().toLowerCase();
  return Boolean(nameA) && nameA === nameB;
}

/**
 * SET THE VENUE ON A NIGHT THAT HAS ALREADY BEEN RUN.
 *
 * ---
 *
 * Asked for on 8 September 2026, off a Community rail with a batch of
 * photographs sitting under *"No venue on these"*: *"all of these were taken
 * at the same venue but the last ones have no venue attached?"*, and then
 * *"let me set the venue on a past night"*.
 *
 * **A VENUE IS A FACT ABOUT THE EVENING, AND IT IS THE ONE FACT A HOST CAN
 * STILL SUPPLY AFTERWARDS.** Everything else in a filed night — who played,
 * what they scored, which prizes went out — is the app's own record of
 * something it watched, and letting a human edit that would make the evidence
 * a quizmaster shows a venue worth less. Where it happened is different: the
 * app only ever knew it because somebody typed it at launch, so somebody
 * typing it the next morning is the same fact arriving late rather than
 * history being rewritten.
 *
 * **IT PATCHES EVERY RECORD FOR THAT DATE, not one.** A night is addressed by
 * its date everywhere in this app, and one date can hold a quiz and the bingo
 * after it as two records — so setting the venue on one of them would give the
 * evening two answers and `mergeGigs()` would fold it to `venueMixed`, which
 * is the state this control exists to get out of.
 *
 * @param {string} dir    the room's archive folder
 * @param {string} night  the date, as the photo folders and `nightOfGig()` say it
 * @returns {{ ok: boolean, changed: number }}
 */
export function setNightVenue(dir, night, { venue = '', venueId = '' } = {}) {
  if (!isNightFolder(night)) return { ok: false, changed: 0 };
  const patch = { venue: String(venue || '').trim(), venueId: String(venueId || '').trim() };
  let changed = 0;
  for (const record of listArchive(dir)) {
    // `nightOfGig()`, never the first ten characters of the timestamp — a quiz
    // that finished at half past midnight belongs to the night before, and the
    // photographs beside it are already filed that way.
    if (nightOfGig(record.archivedAt) !== night) continue;
    if (updateArchivedNight(dir, record.id, patch)) changed++;
  }
  return { ok: true, changed };
}

/**
 * WHERE THE VENUE GOES WHEN THERE IS NO RECORD TO PUT IT ON.
 *
 * A night can have photographs and nothing filed at all — the quiz was stopped
 * before the final scores, or the server restarted mid-evening — and that is
 * one of the four states `whyNoVenue()` names on the rail. Those nights are
 * the ones most likely to need this control, so refusing them would leave the
 * feature useless in exactly the case that asked for it.
 *
 * So it files a NOTE: a record carrying the venue and nothing else, which
 * `mergeGigs()` deliberately does not count as a game. The night still reads
 * *"No results saved"*, because it still has none — it just knows which pub it
 * was at now.
 *
 * **NINE IN THE EVENING, UTC.** `archiveResults()` derives the filename and
 * `nightOfGig()` the night from this timestamp, and both have the 6am
 * roll-over in them; midnight would land the note on the night before.
 */
export function noteNightVenue(dir, night, { venue = '', venueId = '' } = {}) {
  if (!isNightFolder(night)) return null;
  return archiveResults(dir, {
    kind: 'note',
    packId: 'venue',
    quizTitle: 'Where this night was',
    venue: String(venue || '').trim(),
    venueId: String(venueId || '').trim(),
    leaderboard: [],
  }, Date.parse(`${night}T21:00:00Z`));
}
