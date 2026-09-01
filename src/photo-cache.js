/**
 * THE BYTES OF A PHOTOGRAPH, HELD IN MEMORY — because the same night is what
 * everybody looks at.
 *
 * ---
 *
 * **THE LIMIT IS THE PROBLEM, NOT THE LATENCY.** Every photograph served comes
 * out of the private repository through GitHub's Contents API, which allows
 * 5,000 calls an hour on a token. A night of ninety-nine is ninety-nine calls,
 * so **about fifty page opens an hour and the gallery stops working** — and a
 * gallery exists to be sent to a pub full of people who were all there on the
 * same night, which is precisely the traffic that breaks it.
 *
 * The browser's own 24-hour cache covers somebody coming BACK. It does nothing
 * for the fiftieth different person opening the same night for the first time,
 * which is the case that matters.
 *
 * **A FILED PHOTOGRAPH IS IMMUTABLE BY NAME.** `add()` in `photos.js` issues a
 * fresh id per picture and nothing ever rewrites one, so there is no staleness
 * to reason about: the only event that can invalidate an entry is the picture
 * being DELETED, and `drop()` is called there.
 *
 * **IT IS BOUNDED IN BYTES AND EVICTS THE LEAST RECENTLY USED, and the cap is
 * deliberately modest.** This process also runs live quizzes for rooms of sixty
 * phones on a 512MB instance, and *reliability beats cleverness* is the rule
 * that decides this: a cache that makes a gallery quick and a Wednesday night
 * flaky is a bad trade. Forty-eight megabytes is roughly a night and a half of
 * photographs, which is what a busy evening actually gets looked at.
 *
 * **NOTHING IS CACHED THAT DECIDES WHO MAY SEE IT.** This holds picture bytes
 * only. Whether a night is published and whether one photograph is on the
 * gallery are read from `published.json` on every request, behind their own
 * short cache with exact invalidation — so taking a photograph down still
 * works on the very next request, and a cached picture is simply never
 * reached.
 */

/** A night and a half of phone photographs. Override with `PHOTO_CACHE_MB`. */
const CAP = Math.max(0, Number(process.env.PHOTO_CACHE_MB || 48)) * 1024 * 1024;

/*
 * A `Map` IS THE LRU. JavaScript's Map keeps insertion order and lets a key be
 * deleted and re-set, so "move to the end" is two operations and the oldest is
 * always the first key — no list to maintain and nothing to get wrong.
 */
const held = new Map();
let bytesHeld = 0;

/** What the cache has, or `null`. Reading one marks it as recently used. */
export function cachedPhoto(path) {
  const hit = held.get(path);
  if (!hit) return null;
  // Move to the end: most recently used.
  held.delete(path);
  held.set(path, hit);
  return hit;
}

/**
 * Keep one, evicting the oldest until it fits.
 *
 * A single photograph larger than the whole cap is NOT kept — it would evict
 * everything else to hold one picture, which is worse than not caching it.
 */
export function keepPhoto(path, bytes) {
  if (!CAP || !bytes || bytes.length > CAP) return;
  if (held.has(path)) { bytesHeld -= held.get(path).length; held.delete(path); }
  held.set(path, bytes);
  bytesHeld += bytes.length;
  while (bytesHeld > CAP) {
    const oldest = held.keys().next().value;
    if (oldest === undefined) break;
    bytesHeld -= held.get(oldest).length;
    held.delete(oldest);
  }
}

/** Forget one — the ONLY thing that can make an entry wrong is a deletion. */
export function dropPhoto(path) {
  const had = held.get(path);
  if (!had) return;
  bytesHeld -= had.length;
  held.delete(path);
}

/** For a test, and for saying so on the owner page one day. */
export function photoCacheState() {
  return { photos: held.size, bytes: bytesHeld, cap: CAP };
}

/*
 * ---- AND WHAT IS IN A NIGHT'S FOLDER ------------------------------------
 *
 * **THE GALLERY INDEX LISTED EVERY NIGHT'S DIRECTORY, ONE AFTER ANOTHER.**
 * Measured with a season on the shelf: twenty-one nights cost twenty-two GitHub
 * calls and **3.3 seconds**, every time anybody opened the page — because the
 * loop `await`ed each listing before starting the next.
 *
 * Running them together fixes the seconds. Holding the answer fixes the calls,
 * which is the half that matters, because it is the same index everybody opens.
 *
 * **A NIGHT'S FOLDER CHANGES IN EXACTLY THREE PLACES**: a photograph arriving
 * from the room, the quizmaster adding one of their own, and one being deleted.
 * All three call `dropNight()`. A listing is otherwise as immutable as the
 * pictures in it.
 *
 * Names only — a listing is a few hundred bytes, so this is not counted against
 * the byte cap the pictures share. It is bounded by the number of NIGHTS a
 * quizmaster has, which grows by two a week.
 */
const nights = new Map();

/** A night's file names, or `null`. */
export function cachedNight(folder) {
  const hit = nights.get(folder);
  return hit ? hit.names : null;
}

export function keepNight(folder, names) {
  nights.set(folder, { names });
}

/** Forget one — called wherever a photograph lands in or leaves a folder. */
export function dropNight(folder) {
  nights.delete(folder);
}
