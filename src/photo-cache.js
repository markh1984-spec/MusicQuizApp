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

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { config } from './config.js';

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

/*
 * ---- AND THE SAME BYTES ON DISK, WHICH IS WHAT A PERSISTENT DISK BUYS ----
 *
 * **THE MEMORY CAP ABOVE IS SET BY THE BOX, NOT BY THE PROBLEM.** Forty-eight
 * megabytes is a night and a half, chosen because this process also runs live
 * quizzes for rooms of sixty phones inside 512MB. Disk has no such argument
 * against it: it is a pound a month for five gigabytes and it is not competing
 * with a Wednesday night for RAM.
 *
 * **AND IT SURVIVES A RESTART, WHICH IS THE HALF THAT ACTUALLY BIT.** The
 * memory cache is empty after every deploy — and every push is a deploy — so
 * the first fifty people to open a gallery after one paid full price against
 * an allowance of 5,000 GitHub calls an hour. A gallery is sent to a pub full
 * of people who were all there on the same night, which is exactly that burst.
 *
 * **IT IS A CACHE OF WHAT GITHUB HAS, NOT A SECOND STORE.** The private
 * repository stays the record; this only ever holds a copy of something
 * already filed, so losing the disk costs speed and nothing else. That is what
 * makes it safe to evict from without thinking about it.
 *
 * **NOTHING HERE DECIDES WHO MAY SEE A PHOTOGRAPH** — same rule as the memory
 * half. Whether a night is published and whether one picture is on the gallery
 * are read per request, so a cached copy is simply never reached once it is
 * switched off.
 *
 * **A KEY IS A REPOSITORY PATH, AND A PATH IS THE THING THIS APP HAS ALREADY
 * BEEN BITTEN BY.** `?q=..` once walked out of `dataDir` and minted a shadow
 * room over the projector's own state file. So a key is checked rather than
 * trusted: anything absolute, or with a `..` segment in it, is refused and
 * simply not cached.
 */


/** Roughly a season of photographs. Override with `PHOTO_DISK_CACHE_MB`. */
const DISK_CAP = Math.max(0, Number(process.env.PHOTO_DISK_CACHE_MB || 1024)) * 1024 * 1024;
const DISK_DIR = path.join(config.dataDir, 'photo-cache');

/**
 * A repository path, turned into one safe file name. Null if it is not one.
 *
 * **THE MAPPING HAS TO BE INJECTIVE, AND THE FIRST ONE WAS NOT.** Replacing
 * `/` with a separator character puts `photos/a/b/c.jpg` and `photos/a/b~c.jpg`
 * on the SAME file — one photograph served in place of another, which on a
 * gallery of a pub full of people is the worst way for a cache to be wrong.
 * The test caught it; `safePhotoName()` would probably have prevented it
 * upstream, and relying on a guarantee held somewhere else is how it comes
 * back. `encodeURIComponent` escapes both `/` and `%`, so nothing can collide.
 *
 * A very long path is hashed instead, because a file name has a length limit
 * and silently truncating one would reintroduce exactly the collision above.
 */
function diskName(key) {
  const at = String(key || '');
  if (!at || at.startsWith('/')) return null;
  const parts = at.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return null;
  const flat = encodeURIComponent(at);
  return flat.length <= 200 ? flat : createHash('sha256').update(at).digest('hex');
}

/** The bytes this disk cache holds for a key, or `null`. */
export function diskPhoto(key) {
  if (!DISK_CAP) return null;
  const name = diskName(key);
  if (!name) return null;
  try {
    return fs.readFileSync(path.join(DISK_DIR, name));
  } catch {
    return null;
  }
}

/** Keep a copy, trimming the oldest away when the folder is over its cap. */
export function keepPhotoOnDisk(key, bytes) {
  if (!DISK_CAP || !bytes || bytes.length > DISK_CAP) return;
  const name = diskName(key);
  if (!name) return;
  try {
    fs.mkdirSync(DISK_DIR, { recursive: true });
    const tmp = path.join(DISK_DIR, `.${name}.tmp`);
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, path.join(DISK_DIR, name));
    trimDisk();
  } catch { /* A cache that cannot write is a cache that misses. */ }
}

/** Forget one — the only thing that can make a copy wrong is a deletion. */
export function dropPhotoFromDisk(key) {
  const name = diskName(key);
  if (!name) return;
  try { fs.unlinkSync(path.join(DISK_DIR, name)); } catch { /* not there */ }
}

/*
 * OLDEST FIRST, BY MODIFICATION TIME. There is no access log to read, so this
 * is least-recently-WRITTEN rather than least-recently-used — which for files
 * that are immutable once written is the same ordering, and needs no index to
 * be kept in step with the folder.
 */
function trimDisk() {
  let files;
  try {
    files = fs.readdirSync(DISK_DIR)
      .filter((n) => !n.startsWith('.'))
      .map((n) => {
        const s = fs.statSync(path.join(DISK_DIR, n));
        return { n, size: s.size, at: s.mtimeMs };
      });
  } catch { return; }
  let total = files.reduce((sum, f) => sum + f.size, 0);
  if (total <= DISK_CAP) return;
  files.sort((a, b) => a.at - b.at);
  for (const f of files) {
    if (total <= DISK_CAP) break;
    try { fs.unlinkSync(path.join(DISK_DIR, f.n)); total -= f.size; } catch { /* gone */ }
  }
}

/** For a test, and for saying so on the owner page one day. */
export function photoDiskState() {
  try {
    const files = fs.readdirSync(DISK_DIR).filter((n) => !n.startsWith('.'));
    const bytes = files.reduce((sum, n) => sum + fs.statSync(path.join(DISK_DIR, n)).size, 0);
    return { photos: files.length, bytes, cap: DISK_CAP };
  } catch {
    return { photos: 0, bytes: 0, cap: DISK_CAP };
  }
}
