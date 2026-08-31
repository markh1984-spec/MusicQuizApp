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
 * ONE FILE, TWO ANSWERS — which nights are up, and which individual photos a
 * human has overruled the camera guess on.
 *
 * Both are the same question ("what does this room publish") asked at one
 * moment, and two files would be two GitHub round trips on a page that already
 * waits for one. The night list keeps the shape it has always had: `nights` is
 * read from an array OR an object, so a file written before this existed reads
 * without a migration — a rewrite over everybody's file is a one-shot script
 * on a disk that gets wiped, which this repo knows better than to write.
 */
async function readAll(roomId) {
  if (!photosRepoConfigured()) return { nights: [], photos: {} };
  let raw = null;
  try {
    raw = await getFile(listPath(roomId), 'photos');
  } catch {
    return { nights: [], photos: {} };
  }
  if (!raw) return { nights: [], photos: {} };
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    const nights = Array.isArray(parsed) ? parsed : parsed.nights;
    const photos = (!Array.isArray(parsed) && parsed.photos) || {};
    return {
      nights: (nights || [])
        .map((n) => String(n || ''))
        // Validated on the way OUT as well as in: this file is in a repo a
        // human can edit, and a bad line in it must not become a path.
        .filter(isNightFolder)
        .sort()
        .reverse(),
      /*
       * Keyed `night/name`, and validated the same way. An unknown verdict is
       * DROPPED rather than becoming a third behaviour — the only two states
       * are "a human said yes" and "a human said no", and everything else
       * falls back to what the filename says.
       */
      photos: Object.fromEntries(Object.entries(photos)
        .filter(([k, v]) => photoKeyOk(k) && (v === 'on' || v === 'off'))),
    };
  } catch {
    return { nights: [], photos: {} };
  }
}

/*
 * ---- ONE WRITER AT A TIME, PER ROOM ------------------------------------
 *
 * **`published.json` HOLDS TWO HALVES AND TWO CALLERS EDIT IT.** Which nights
 * are up is `setPublished()`; the per-photo rulings behind the green and red
 * lamps are `setPhotoDecision()`. Each reads the WHOLE file, changes its own
 * half and writes the whole thing back — so without ordering, a lamp write
 * that began before a publish finished writes the nights back the way they
 * were and quietly un-publishes it.
 *
 * That reached a live gallery: the console said the night was published, the
 * public page said it was not, and a stranger with the link saw nothing.
 *
 * **GITHUB CANNOT REFUSE IT.** `putFile()` fetches a fresh sha immediately
 * before writing, so the write is never against the version its content was
 * built from — the API sees an ordinary update and answers 200 to both. There
 * is no error anywhere to notice.
 *
 * **AND THE BROWSER'S QUEUE CANNOT COVER IT.** `galleryQueue()` orders the
 * console's own calls, and the lamp deliberately settles for 600ms before
 * sending, so the press that overlaps a publish is precisely the one that
 * queue has not started. Ordering belongs where the file is.
 *
 * A chain per room rather than one global: two quizmasters write different
 * files and have no reason to wait for each other. The chain swallows
 * rejections so one failed write cannot wedge the room for ever — every
 * caller still gets its own result.
 */
const writing = new Map();

function inOrder(roomId, job) {
  const after = (writing.get(roomId) || Promise.resolve()).then(job, job);
  writing.set(roomId, after.then(() => {}, () => {}));
  return after;
}

/** `2026-08-27/p1abc.jpg` — a night we recognise and a name we issued. */
function photoKeyOk(key) {
  const [night, name, ...rest] = String(key || '').split('/');
  return !rest.length && isNightFolder(night) && /^[a-z0-9]+(-picked)?\.(jpg|png|webp)$/i.test(name || '');
}

/** The key one photo's ruling is stored under. */
export function photoKey(night, name) {
  return `${night}/${name}`;
}

/**
 * WHAT A HUMAN HAS SAID ABOUT INDIVIDUAL PHOTOGRAPHS.
 *
 * Asked for on 29 August 2026: *"maybe a little green pill to show it's on the
 * public gallery for this night and a red one to show it isn't, and I can
 * click one for each purpose… there may be some that were uploaded but are
 * appropriate for a public gallery that I can switch on."*
 *
 * **THIS IS THE SAME SHAPE AS THE TEAM-NAME OVERRIDE, deliberately.** A guess
 * decides by default and a human who was in the room can overrule it, in BOTH
 * directions — because the guess is wrong both ways. `looksCameraTaken()`
 * misses a real photograph whose EXIF a share sheet stripped, and it passes a
 * screenshot somebody took with their own camera app. One override with two
 * values answers both; a one-way "allow" control would have left the second
 * with no answer at all.
 *
 * @returns {Promise<Record<string, 'on'|'off'>>} empty on any doubt, which
 *   means the filename decides — the cautious default this sits on top of
 *   rather than replaces.
 */
export async function photoDecisions(roomId) {
  return (await readAll(roomId)).photos;
}

/**
 * Which nights this room has published.
 *
 * @returns {Promise<string[]>} `YYYY-MM-DD`, newest first. Empty on any doubt.
 */
export async function publishedNights(roomId) {
  // Fails closed through `readAll` — see the note at the top. A network wobble
  // must not publish anybody's photographs.
  return (await readAll(roomId)).nights;
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
  // The READ is inside the queue with the write, or the ordering buys nothing:
  // it is reading a version somebody else is about to replace that loses this.
  return inOrder(roomId, () => publishNow(roomId, night, on));
}

async function publishNow(roomId, night, on) {
  const held = await readAll(roomId);
  const have = held.nights;
  const want = on ? [...new Set([...have, night])] : have.filter((n) => n !== night);
  // Nothing to write, and nothing to say — a second tap on an already-published
  // night should not make a commit.
  if (want.length === have.length && want.every((n) => have.includes(n))) {
    return { ok: true, nights: have };
  }
  const sorted = [...want].sort().reverse();
  const res = await putFile(
    listPath(roomId),
    // The per-photo rulings ride along untouched — writing only the nights
    // would wipe every one a human had made, which is the shape of bug that
    // only shows up weeks later when somebody notices a photo has come back.
    JSON.stringify({ nights: sorted, photos: held.photos }, null, 2),
    `${on ? 'Publish' : 'Unpublish'} the gallery for ${night}`,
    'photos',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, nights: sorted };
}

/**
 * Overrule the camera guess on one photograph, or take the ruling back.
 *
 * **A RULING THAT ONLY RESTATES THE GUESS IS CLEARED, NOT STORED** — the gap
 * dial's own rule, and the team-name override's. If the filename would have
 * said the same thing, keeping a human ruling beside it means a later change
 * to how the guess is made silently cannot reach this photo.
 *
 * @param {'on'|'off'|''} decision  '' clears it back to the filename
 */
export async function setPhotoDecision(roomId, night, name, decision) {
  const key = photoKey(night, name);
  if (!photoKeyOk(key)) return { ok: false, error: 'No photo there.' };
  if (!['on', 'off', ''].includes(decision)) return { ok: false, error: 'That is not a decision.' };
  if (!photosRepoConfigured()) {
    return { ok: false, error: 'The private photo repository is not set up, so there is nowhere to record this.' };
  }
  // Behind the same queue as publishing, and it has to be the SAME one: these
  // two edit one file, so ordering them separately would order nothing.
  return inOrder(roomId, () => decideNow(roomId, key, decision));
}

async function decideNow(roomId, key, decision) {
  const held = await readAll(roomId);
  const photos = { ...held.photos };
  if (decision) photos[key] = decision; else delete photos[key];
  if (JSON.stringify(photos) === JSON.stringify(held.photos)) return { ok: true, photos: held.photos };

  const res = await putFile(
    listPath(roomId),
    JSON.stringify({ nights: held.nights, photos }, null, 2),
    decision ? `${decision === 'on' ? 'Show' : 'Hide'} ${key} on the gallery` : `Clear the ruling on ${key}`,
    'photos',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, photos };
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
