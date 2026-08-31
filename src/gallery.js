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

/**
 * HOW MANY PHOTOGRAPHS A NIGHT'S CARD CAN BE PINNED TO — three.
 *
 * The card on `/gallery` is a fanned pile of three, so three is what there is
 * room for rather than a number anybody picked. A constant with a note, which
 * is what this repo does instead of a setting nobody has asked for.
 */
export const MAX_PINS = 3;

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
/*
 * ---- ONE READ OF `published.json`, NOT ONE PER PHOTOGRAPH -----------------
 *
 * **MEASURED, because "photos take a while to load" is a symptom and not a
 * diagnosis.** Serving one photograph asks this file TWICE — once for "is this
 * night published" and once for "has a human overruled the camera guess" —
 * before it fetches the picture itself. Counted against a stubbed repo: THREE
 * GitHub calls per photograph, of which two are the same small file.
 *
 * A night of thirty cost ninety calls. A night of NINETY-NINE costs about two
 * hundred and ninety-seven, **every time somebody opens the page**, against a
 * limit of five thousand an hour — so seventeen visits and the gallery stops
 * working altogether, which is a good deal worse than slow.
 *
 * **THE INVALIDATION IS EXACT RATHER THAN HOPEFUL, and that is what makes a
 * cache safe on a file that decides what is public.** Every write already goes
 * through `inOrder()`, so there is exactly one place to drop it from, and a
 * photograph switched off is off on the very next request. A stale answer here
 * would mean a picture somebody asked to have taken down still being served,
 * which is not a performance trade anybody would accept.
 *
 * **THE TTL IS A BACKSTOP, NOT THE MECHANISM.** This file lives in a repo a
 * human can edit — the validation on the way out exists because of that — so a
 * hand-edit in GitHub's own web editor is invisible to `inOrder()`. Thirty
 * seconds bounds how long that can be wrong without making the common path pay
 * anything.
 */
const CACHE_MS = 30_000;
const cached = new Map();

/** Forget a room's file — called by every writer, on the way out. */
function forget(roomId) {
  cached.delete(roomId);
}

/*
 * IT CACHES THE PROMISE, NOT THE ANSWER — and that is the difference between
 * a cache that helps and one that does nothing on the only burst that matters.
 *
 * Caching the resolved value only fills after the first read RETURNS, so a
 * page opening ninety-nine photographs at once has ninety-nine readers all
 * miss together and ninety-nine fetches of one small file. Holding the
 * in-flight promise means the second reader through the door waits on the
 * first one's fetch instead of starting its own. Found by a test that expected
 * one fetch for forty readers and got twenty.
 */
function readAll(roomId) {
  const held = cached.get(roomId);
  if (held && Date.now() - held.at < CACHE_MS) return held.data;
  // A rejection is not cached — `readAllNow()` fails closed rather than
  // throwing, but a promise that settled badly must never become the answer
  // for the next thirty seconds.
  const pending = readAllNow(roomId).catch((err) => { forget(roomId); throw err; });
  cached.set(roomId, { at: Date.now(), data: pending });
  return pending;
}

async function readAllNow(roomId) {
  if (!photosRepoConfigured()) return { nights: [], photos: {}, pins: {} };
  let raw = null;
  try {
    raw = await getFile(listPath(roomId), 'photos');
  } catch {
    return { nights: [], photos: {}, pins: {} };
  }
  if (!raw) return { nights: [], photos: {}, pins: {} };
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    const nights = Array.isArray(parsed) ? parsed : parsed.nights;
    const photos = (!Array.isArray(parsed) && parsed.photos) || {};
    const pins = (!Array.isArray(parsed) && parsed.pins) || {};
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
      /*
       * WHICH PHOTOGRAPHS A HUMAN CHOSE FOR A NIGHT'S CARD — `{ night: [name,
       * name, name] }`, at most `MAX_PINS`.
       *
       * Validated on the way OUT as well as in, like everything else here: the
       * file is in a repo a person can edit, and a bad line must not become a
       * path. Anything over the cap is TRIMMED rather than dropped, because a
       * hand-edited fourth pin should cost the fourth pin and not the night.
       */
      pins: Object.fromEntries(Object.entries(pins)
        .filter(([night, names]) => isNightFolder(night) && Array.isArray(names))
        .map(([night, names]) => [night, names
          .filter((n) => photoKeyOk(photoKey(night, n)))
          .slice(0, MAX_PINS)])
        .filter(([, names]) => names.length)),
    };
  } catch {
    return { nights: [], photos: {}, pins: {} };
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
  /*
   * AND EVERY WRITE FORGETS THE CACHED FILE, on the way IN and on the way OUT.
   *
   * On the way in, because the job is about to read the file and must not read
   * a copy taken before the write it is queued behind. On the way out, because
   * what it just wrote is now the truth and the next reader has to see it — a
   * photograph switched off must be off on the very next request, not in thirty
   * seconds. Both, or the cache is a performance win that can serve a picture
   * somebody asked to have taken down.
   */
  const wrapped = () => { forget(roomId); return Promise.resolve(job()).finally(() => forget(roomId)); };
  const after = (writing.get(roomId) || Promise.resolve()).then(wrapped, wrapped);
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
    // The per-photo rulings and the card pins ride along untouched — writing
    // only the nights would wipe every one a human had made, which is the shape
    // of bug that only shows up weeks later when somebody notices a photo has
    // come back. EVERY writer of this file has to carry the halves it is not
    // changing; there is a test walking them.
    JSON.stringify({ nights: sorted, photos: held.photos, pins: held.pins }, null, 2),
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
    // The nights and the card pins ride along untouched — see the note on the
    // publish writer above.
    JSON.stringify({ nights: held.nights, photos, pins: held.pins }, null, 2),
    decision ? `${decision === 'on' ? 'Show' : 'Hide'} ${key} on the gallery` : `Clear the ruling on ${key}`,
    'photos',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, photos };
}

/**
 * PIN A PHOTOGRAPH TO A NIGHT'S CARD, OR TAKE THE PIN OFF IT.
 *
 * Asked for on 31 August 2026: *"random spread across a night but also the
 * ability to pick them — perhaps a little icon on each photo where I can pin up
 * to 3, so if I dislike one of the random photos I can remove the pin from that
 * one and give it to something else."*
 *
 * **PINS ARE AN OVERRIDE, NOT A REQUIREMENT.** A night with none still gets a
 * card: the spread picks three for it. So this is never work anybody has to do,
 * which is the Monday rule — it is there for the night where the random three
 * happen to be three pictures of the same table.
 *
 * **THE CAP IS REFUSED, NOT TRIMMED.** Silently dropping a fourth pin would
 * look exactly like a failed press. Somebody has to take one off first, and the
 * error says so — the same reasoning as refusing an over-full `multi` answer
 * rather than trimming it.
 *
 * **ORDER IS THE ORDER THEY WERE PINNED**, so the card is stable and a person
 * can predict what moves when they unpin one.
 *
 * @param {boolean} on
 */
export async function setPhotoPin(roomId, night, name, on) {
  if (!photoKeyOk(photoKey(night, name))) return { ok: false, error: 'No photo there.' };
  if (!photosRepoConfigured()) {
    return { ok: false, error: 'The private photo repository is not set up, so there is nowhere to record this.' };
  }
  // The same queue as the nights and the rulings — one file, one writer.
  return inOrder(roomId, () => pinNow(roomId, night, name, on));
}

async function pinNow(roomId, night, name, on) {
  const held = await readAll(roomId);
  const had = held.pins[night] || [];
  if (on && had.includes(name)) return { ok: true, pins: had };
  if (on && had.length >= MAX_PINS) {
    return { ok: false, error: `Three is the most a card can show. Take one off first.` };
  }
  const want = on ? [...had, name] : had.filter((n) => n !== name);
  if (want.length === had.length && want.every((n, i) => n === had[i])) {
    return { ok: true, pins: had };
  }
  const pins = { ...held.pins };
  // An empty list is REMOVED rather than stored as `[]` — the same rule as a
  // ruling that only restates the guess: nothing to say, nothing kept.
  if (want.length) pins[night] = want; else delete pins[night];
  const res = await putFile(
    listPath(roomId),
    JSON.stringify({ nights: held.nights, photos: held.photos, pins }, null, 2),
    `${on ? 'Pin' : 'Unpin'} ${photoKey(night, name)} on the gallery card`,
    'photos',
  );
  if (res && res.ok === false) return { ok: false, error: res.error || 'Could not save that.' };
  return { ok: true, pins: want };
}

/** Which photographs a human pinned, per night. */
export async function photoPins(roomId) {
  return (await readAll(roomId)).pins;
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
