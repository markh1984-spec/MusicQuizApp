/**
 * WHICH PHOTOGRAPHS THE CHECK FLAGGED — `flags.json`, beside the photos.
 *
 * The rude-photo check (`src/moderation.js`) scores a photo when it is filed;
 * this is where the answer lives so the console can sort the questionable ones
 * to the front of the night. A sidecar in the private photo repo, exactly like
 * `published.json` (`src/gallery.js`) — the disk is wiped on deploy and the
 * repo is not, and the list of which pictures are questionable belongs with
 * the pictures.
 *
 * A SEPARATE FILE FROM `published.json`, DELIBERATELY. That file is written by
 * a human clicking — publish, pin, a gallery ruling — and this one by a robot
 * finishing an async check seconds after an upload. `published.json` already
 * carries the scar of two writers racing (its own long note): a publish that a
 * lamp write silently reverted, on a live gallery. Folding a background robot
 * into the same read-modify-write would recreate exactly that, human against
 * machine. Its own file with its own one-writer-at-a-time queue cannot touch a
 * publish or a pin.
 *
 * The value is one word — `adult` or `racy`, the marker on the tile — and
 * nothing else. The score behind it is not kept: the flag is *look at this
 * one*, and the host looks.
 */

import { getFile, putFile, photosRepoConfigured } from './github.js';
import { photoFolder, isNightFolder } from './past-gigs.js';

const LEVELS = new Set(['adult', 'racy']);

/** Beside the photos it flags, in the same private repo. */
function flagsPath(roomId) {
  return `${photoFolder(roomId)}/flags.json`;
}

/** `2026-08-27/p1abc.jpg` — a night we recognise and a name we issued. */
function keyOk(key) {
  const [night, name, ...rest] = String(key || '').split('/');
  return !rest.length && isNightFolder(night) && /^[a-z0-9]+(-picked)?\.(jpg|png|webp)$/i.test(name || '');
}

/** The key one photo's flag is stored under. */
export function flagKey(night, name) {
  return `${night}/${name}`;
}

/*
 * ONE READ, CACHED LIKE `gallery.js` DOES IT — a night's grid asks this once
 * per open, and the promise is held so a burst of readers shares one fetch.
 * The rejection is never cached; a failed read fails closed (an empty map), so
 * nothing is flagged rather than everything.
 */
const CACHE_MS = 30_000;
const cached = new Map();

function forget(roomId) { cached.delete(roomId); }

function readAll(roomId) {
  const held = cached.get(roomId);
  if (held && Date.now() - held.at < CACHE_MS) return held.data;
  const pending = readAllNow(roomId).catch((err) => { forget(roomId); throw err; });
  cached.set(roomId, { at: Date.now(), data: pending });
  return pending;
}

async function readAllNow(roomId) {
  if (!photosRepoConfigured()) return {};
  let raw = null;
  try { raw = await getFile(flagsPath(roomId), 'photos'); } catch { return {}; }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    // Validated on the way OUT as well as in: the file is in a repo a human
    // can edit, and a bad line must not become a marker or a path.
    return Object.fromEntries(Object.entries(parsed)
      .filter(([k, v]) => keyOk(k) && LEVELS.has(v)));
  } catch {
    return {};
  }
}

/** Every flag for a room, `{ 'night/name': 'adult'|'racy' }`. */
export async function photoFlags(roomId) {
  return readAll(roomId);
}

/*
 * ONE WRITER AT A TIME, PER ROOM — its own chain, so a background score can
 * never overlap another score for the same room and lose one. It shares
 * nothing with `gallery.js`'s chain on purpose: this file and that file are
 * never written together.
 */
const writing = new Map();

function inOrder(roomId, job) {
  const wrapped = () => { forget(roomId); return Promise.resolve(job()).finally(() => forget(roomId)); };
  const after = (writing.get(roomId) || Promise.resolve()).then(wrapped, wrapped);
  writing.set(roomId, after.then(() => {}, () => {}));
  return after;
}

/**
 * Record (or clear) one photo's flag. `level` is 'adult' / 'racy' to set, or
 * '' to clear. Never throws — a flag that will not save costs the flag, never
 * the photo, which is already safely in the repo.
 */
export async function setPhotoFlag(roomId, night, name, level) {
  if (!photosRepoConfigured()) return { ok: false };
  if (!keyOk(flagKey(night, name))) return { ok: false };
  if (level && !LEVELS.has(level)) return { ok: false };
  return inOrder(roomId, () => flagNow(roomId, night, name, level));
}

async function flagNow(roomId, night, name, level) {
  const held = await readAll(roomId);
  const key = flagKey(night, name);
  if ((held[key] || '') === (level || '')) return { ok: true };
  const next = { ...held };
  if (level) next[key] = level; else delete next[key];
  const res = await putFile(
    flagsPath(roomId),
    JSON.stringify(next, null, 2),
    level ? `Flag ${key} for review (${level})` : `Clear flag on ${key}`,
    'photos',
  );
  if (res && res.ok === false) return { ok: false, error: res.error };
  return { ok: true };
}
