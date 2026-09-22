/**
 * PHOTOGRAPHS OFF THIS SERVER AND INTO THE STORE — and what retries the ones
 * that did not make it.
 *
 * Moved out of `helpers.js` on 22 September 2026, when the retry was added and
 * that file went over its budget: filing is one job with three callers (the
 * upload, the owner's button and the sweep) and one rule about each photo
 * going exactly once, which is easier to keep true in a file of its own.
 */
import { dropNight, moderationConfigured, photoFolder, photosRepoConfigured, putFile, rooms, scorePhoto, setPhotoFlag, spend, spendRecorder } from './context.js';
import { galleryRoomOf } from './helpers.js';
import { pushState } from './views.js';
import { PHOTO_SWEEP_MS, nextPhotoSweep } from '../photo-sweep.js';

/**
 * Put one photo in the private repository, foldered by night.
 *
 * Never throws and never blocks a response: a failure here means the photo is
 * still on screen and still on this server, just not yet permanent.
 *
 * **WHAT RETRIES A FAILURE IS `sweepUnfiledPhotos()`, BELOW.** This note used to
 * say *"retried by the file the rest away button"* — and for every quizmaster
 * but the owner there was no such button: the one on the control view had been
 * taken off and the route behind it left with no caller, and the owner's page
 * only ever acts on the owner's own room. So a photograph that met one bad
 * GitHub minute sat on this server, missing from Past gigs and the gallery,
 * until the next deploy took it. *A comment that claims the opposite is where
 * the next bug hides*, fifth sighting.
 *
 * **ONE JOB PER PHOTO, JOINED RATHER THAN REPEATED.** The upload path calls this
 * the moment a photo lands and the sweep calls it again for anything unfiled,
 * so without the join a sweep arriving mid-upload PUTs the same file twice at
 * once — both ask for its `sha` before it exists, and the Contents API refuses
 * the second, writing a failure about a photograph that was filed perfectly
 * well.
 *
 * `quiet` keeps the per-photo warning out of the log: the sweep says ONE line
 * for the whole batch, or a bad token writes sixty an hour into the record the
 * host copies off the Help tab.
 */
const filingNow = new Map();
export function fileAway(room, photo, { quiet = false } = {}) {
  const key = `${room.id}\0${photo.id}`;
  if (filingNow.has(key)) return filingNow.get(key);
  const job = fileAwayOnce(room, photo, { quiet })
    .catch((err) => ({ ok: false, error: err.message }))
    .finally(() => filingNow.delete(key));
  filingNow.set(key, job);
  return job;
}

async function fileAwayOnce(room, photo, { quiet }) {
  if (!photosRepoConfigured()) return { ok: false };
  const { photos } = room;
  const read = photos.read(photo.id);
  if (!read) return { ok: false };
  // THE ROOM THE READERS WILL LOOK IN, never `room.id` — see `galleryRoomOf()`.
  // Foldered per room, so one quizmaster's night is never mixed in with
  // another's.
  const filedIn = galleryRoomOf(room.id);
  const folder = `${photoFolder(filedIn)}/${photo.night}`;
  // One of the three places a night's folder changes — see `photo-cache.js`.
  dropNight(folder);
  const result = await putFile(
    `${folder}/${photo.file}`,
    read.bytes,
    `${photo.night}${photo.teamName ? ` — ${photo.teamName}` : ''}`,
    'photos',
  );
  if (result.ok) {
    photos.markFiled(photo.id);
    pushState(room);
    /*
     * THE RUDE-PHOTO CHECK — background, inert without a Vision key, and it
     * never blocks the file-away it rides behind. A flag sorts this photo to
     * the front of the night's grid for review; it never deletes and never
     * touches the room. See `src/moderation.js` and `src/photo-flags.js`.
     */
    if (moderationConfigured()) {
      scorePhoto(read.bytes, { onSpend: spendRecorder(spend) })
        .then((r) => (r.level ? setPhotoFlag(filedIn, photo.night, photo.file, r.level) : null))
        .catch(() => { /* a flag that will not settle costs the flag, never the photo */ });
    }
  } else if (!quiet) {
    console.warn('[photos] could not file one away:', result.error);
  }
  return result;
}

/**
 * FILE EVERYTHING IN ONE ROOM THAT HAS NOT REACHED THE STORE — a few at a time.
 *
 * **BOUNDED, NEVER SERIAL AND NEVER ALL AT ONCE.** The owner's button awaited
 * each photo in turn, and every `putFile()` carries a twenty-second deadline, so
 * sixty photos on a slow morning held one request open for twenty minutes —
 * past every proxy between here and a browser, which then reported a failure
 * about a job that was still quietly succeeding. All sixty at once is the other
 * way to be wrong: it spends the GitHub hour the packs and the backups share in
 * one go. `FILE_AT_ONCE` is a constant with a note, not a setting.
 */
export const FILE_AT_ONCE = 3;
/** How long the owner's "file the rest" button waits before saying it is still going. */
export const FILE_REST_WAIT_MS = Number(process.env.FILE_REST_WAIT_MS) || 10_000;
export async function fileTheRest(room, { atOnce = FILE_AT_ONCE, quiet = false } = {}) {
  if (!photosRepoConfigured()) return { ok: false, reason: 'no_repo', total: 0, filed: 0, failed: 0 };
  const todo = room.photos.unfiled();
  let next = 0;
  let filed = 0;
  let failed = 0;
  let error = '';
  const worker = async () => {
    while (next < todo.length) {
      const result = await fileAway(room, todo[next++], { quiet });
      if (result && result.ok) filed += 1;
      else {
        failed += 1;
        if (!error && result && result.error) error = String(result.error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(atOnce, todo.length) }, worker));
  return { ok: true, total: todo.length, filed, failed, error };
}

/**
 * ---- THE RETRY THAT SERVES ITSELF.
 *
 * Every loaded room, every few minutes: anything still unfiled is tried again.
 * **A room that is not loaded is left alone** — it loads the moment a photo
 * arrives or its quizmaster opens the console, and loading every room at boot
 * to look for stragglers is a cost paid on every deploy for a case the disk
 * already keeps safe.
 *
 * **IT BACKS OFF WHILE NOTHING LANDS, AND THAT IS WHAT MAKES A LOOP SAFE.** The
 * reason the old note gave for having no loop was *"a loop on a bad token would
 * hammer GitHub all night for nothing"* — true of a fixed interval, and not of
 * one that doubles on every sweep that files nothing, to an hour. A dead token
 * then costs one attempt per photo per hour; the first success puts it back to
 * five minutes, so a GitHub blip clears itself before the night is over.
 *
 * **SAID ONCE PER SWEEP, NOT ONCE PER PHOTO** — `saidSo()`'s rule, that a
 * failure nobody hears about is the six-weeks-of-nothing failure, without
 * turning one bad token into a wall of identical lines.
 */
export async function sweepUnfiledPhotos() {
  if (!photosRepoConfigured()) return { attempted: 0, filed: 0 };
  let attempted = 0;
  let filed = 0;
  let error = '';
  for (const room of rooms.all()) {
    if (!room.photos.unfiled().length) continue;
    const done = await fileTheRest(room, { quiet: true });
    attempted += done.total;
    filed += done.filed;
    if (!error && done.error) error = done.error;
  }
  if (filed) console.log(`[photos] filed ${filed} of ${attempted} that had been waiting`);
  else if (attempted) console.warn(`[photos] ${attempted} waiting to be filed and none would go: ${error || 'no reason given'}`);
  return { attempted, filed };
}

/**
 * START THE RETRY — called once, from the boot, and never awaited.
 *
 * **Not at boot itself**: nothing is loaded yet but the house room, and a
 * deploy is the moment the backups are already queueing for GitHub. **A
 * `setTimeout` chain rather than `setInterval`**, because the gap BACKS OFF
 * while nothing lands (`nextPhotoSweep()`). **`unref()`** like every timer the
 * boot starts: it may never hold the process open.
 */
export function startPhotoSweep() {
  let gap = PHOTO_SWEEP_MS;
  const sweep = () => {
    sweepUnfiledPhotos()
      .then((done) => { gap = nextPhotoSweep(gap, done); })
      .catch((err) => console.warn('[photos] sweep failed:', err.message))
      .finally(() => { setTimeout(sweep, gap).unref(); });
  };
  setTimeout(sweep, gap).unref();
}
