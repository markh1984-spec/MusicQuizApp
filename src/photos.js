/**
 * Photos from the room, on the big screen.
 *
 * The host's decision, recorded early and not revisited: these go up **without
 * approval**. The fun is that it is theirs to do, and he handles the room with
 * the mic — "no naughtiness" — rather than sitting behind a moderation queue
 * while a quiz is running. So there is no approve step anywhere in here.
 *
 * What there is instead is a switch and a bin. One tap stops the whole thing;
 * one tap removes a single photo. That is what a host actually needs when
 * something goes wrong in front of a room: it has to be immediate, and it has
 * to be one movement in the dark.
 *
 * These live outside the game state on purpose. A night is often a quiz and
 * then a bingo game, and launching the second one throws the first away
 * — the photos should not go with it.
 *
 * They are filed into a SEPARATE PRIVATE repository (`PHOTO_REPO`), never the
 * main one. The main repo is public and git history is forever, so pictures of
 * members of the public would be permanent and undeletable there. The private
 * one is free, survives the restart that wipes this disk, and is the host's
 * own suggestion.
 *
 * Filing happens in the background, after the phone has already been answered.
 * A photo is on the projector either way; filing only decides whether it is
 * still there tomorrow.
 */

import fs from 'node:fs';
import path from 'node:path';

// A player's PUBLIC handle. The screen matches a photo to the fastest finger
// by identity, and a player id is a bearer credential — see faceKey there.
import { faceKey } from './engine.js';

/** Room for a busy night without ever filling a small disk. */
export const MAX_PHOTOS = 300;

/** Big enough for a phone photo scaled down, small enough to refuse a video. */
export const MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/**
 * MARKS A PHOTO AS NOT LOOKING LIKE A CAMERA TOOK IT — asked for directly:
 * *"if people upload photos for a bit of a laugh, I don't necessarily want
 * those going into the gallery, but them appearing on the screen can be
 * fun."* Detected client-side (`looksCameraTaken()` in `public/assets/
 * filters.js`) from EXIF the upload's own canvas redraw would otherwise
 * strip, and carried from there into the filename rather than a second
 * file — see the note in `add()`. It never keeps a photo off the projector,
 * only off the public gallery later; `/api/gallery/<night>` in server.js is
 * the one place that reads this.
 */
export const NOT_CAMERA_SUFFIX = '-picked';

/** Whether a filename this app issued was marked NOT camera-taken. */
export function isCameraFile(name) {
  return !String(name || '').includes(NOT_CAMERA_SUFFIX);
}

/**
 * WHETHER ONE PHOTOGRAPH GOES ON THE PUBLIC GALLERY — the filename's guess,
 * unless a human has said otherwise.
 *
 * **ONE FUNCTION, because there are three readers and they must not drift.**
 * The gallery listing, the single-photo route (which re-checks, since a URL
 * can be typed) and the console's own pill all ask this — and the day one of
 * them answers differently is the day a photograph is on a page the console
 * says is private, or missing from one it says is public.
 *
 * @param {string} name      the file, as this app issued it
 * @param {string} said      'on' | 'off' | undefined — the human's ruling
 */
export function showsOnGallery(name, said) {
  if (said === 'on') return true;
  if (said === 'off') return false;
  return isCameraFile(name);
}

/**
 * WHICH OF A NIGHT'S PHOTOGRAPHS GO ON THE PUBLIC PAGE — the whole list, in
 * one call, so the two places that need it cannot ask it differently.
 *
 * **THIS EXISTS BECAUSE THEY DID.** The night LIST counted with
 * `isCameraFile()` while the night's own PAGE filtered with
 * `showsOnGallery()`, one screen apart, under a comment claiming they matched.
 * Switching a single photograph off by hand then left the list saying
 * "12 photos" over a page that opened on 11, and switching a night's whole set
 * off left a date in the list whose page was blank.
 *
 * `showsOnGallery()` was already the one decision; what drifted was which
 * READER remembered to ask it. So the loop is here too, and there is nothing
 * left at the call sites to get wrong.
 *
 * @param {string[]} names  file names, already checked as safe
 * @param {string} night    the night they belong to, for the ruling key
 * @param {object} said     every ruling, keyed `night/name` — see gallery.js
 * @param {function(string, string): string} key  how a ruling is keyed
 */
export function galleryPhotosOf(names, night, said, key) {
  return names.filter((name) => showsOnGallery(name, said[key(night, name)]));
}

export function extensionFor(contentType) {
  return ALLOWED[String(contentType || '').split(';')[0].trim().toLowerCase()] || null;
}

/**
 * What the bytes actually are, rather than what the request claimed.
 *
 * A phone can say image/jpeg and send anything. Checking the first few bytes
 * is not security on its own — the file is only ever served back as an image
 * and never executed — but it stops a mislabelled file becoming a broken box
 * on the projector.
 */
export function sniffType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export class Photos {
  /**
   * @param {string} dir       where the files go
   * @param {function(): number} [now]
   */
  constructor(dir, now = () => Date.now()) {
    this.dir = dir;
    this.now = now;
    this.file = path.join(dir, 'photos.json');
    this.state = { enabled: true, items: [] };
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        this.state = { enabled: parsed.enabled !== false, items: parsed.items };
      }
    } catch {
      /* nothing saved yet, or unreadable — start clean */
    }
    return this;
  }

  /**
   * Written immediately, not debounced. A photo is a thing somebody did once
   * and cannot be asked to do again, and the write is tiny.
   */
  save() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[photos] could not save the list:', err.message);
    }
  }

  get enabled() {
    return this.state.enabled;
  }

  /** The kill switch. Off means not accepted and not shown. */
  setEnabled(on) {
    this.state.enabled = Boolean(on);
    this.save();
    return this.state.enabled;
  }

  list() {
    return this.state.items;
  }

  count() {
    return this.state.items.length;
  }

  /**
   * @param {Buffer} bytes
   * @param {object} meta  { contentType, playerId, teamName, filter, camera }
   */
  add(bytes, { contentType, playerId = '', teamName = '', filter = '', camera = false } = {}) {
    if (!this.state.enabled) return { ok: false, reason: 'off' };
    if (!bytes || !bytes.length) return { ok: false, reason: 'empty' };
    if (bytes.length > MAX_BYTES) return { ok: false, reason: 'too_big' };

    const sniffed = sniffType(bytes);
    const ext = extensionFor(sniffed || contentType);
    if (!sniffed || !ext) return { ok: false, reason: 'not_an_image' };

    const at = this.now();
    const id = `p${at.toString(36)}${Math.floor(at % 997).toString(36)}${this.state.items.length}`;
    /*
     * THE FLAG RIDES IN THE FILENAME, not a second file beside it.
     *
     * The private repo has no structured metadata today — a photo is a name
     * and the commit message that filed it — and the gallery only ever reads
     * a night's own directory listing. A separate manifest (one JSON file
     * per night, read-modify-written every time a photo lands) would race
     * against itself the moment two people upload within the same second,
     * which a pub quiz does constantly. The filename cannot race: it is
     * decided once, here, and every later reader — the gallery filter, the
     * console's own badge — just looks at the name it already has.
     */
    const name = id + (camera ? '' : NOT_CAMERA_SUFFIX) + ext;

    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(path.join(this.dir, name), bytes);
    } catch (err) {
      return { ok: false, reason: 'could_not_save', error: err.message };
    }

    const item = {
      id, file: name, at, playerId, teamName, filter, bytes: bytes.length, night: nightOf(at),
      // Best-effort, read client-side before the upload's own canvas redraw
      // stripped the file's EXIF — see looksCameraTaken() in filters.js.
      // Never gates the projector; only decides gallery eligibility later.
      camera: Boolean(camera),
    };
    this.state.items.push(item);

    // Oldest out first when it fills up. A night that takes 300 photos is a
    // good night, and the newest are the ones the room wants to see.
    while (this.state.items.length > MAX_PHOTOS) {
      const dropped = this.state.items.shift();
      this.unlink(dropped);
    }

    this.save();
    return { ok: true, photo: item };
  }

  remove(id) {
    const i = this.state.items.findIndex((p) => p.id === id);
    if (i < 0) return false;
    const [gone] = this.state.items.splice(i, 1);
    this.unlink(gone);
    this.save();
    return true;
  }

  clear() {
    for (const item of this.state.items) this.unlink(item);
    const n = this.state.items.length;
    this.state.items = [];
    this.save();
    return n;
  }

  unlink(item) {
    try {
      fs.unlinkSync(path.join(this.dir, item.file));
    } catch {
      /* already gone */
    }
  }

  /** Only a filename this instance issued — never a path from a request. */
  fileFor(name) {
    const item = this.state.items.find((p) => p.file === name);
    return item ? path.join(this.dir, item.file) : null;
  }

  /**
   * What the big screen shows: newest first, and nothing at all when the
   * switch is off. Capped because the screen can only show so many and the
   * payload goes to every connected device on every update.
   */
  forScreen(limit = 40) {
    if (!this.state.enabled) return [];
    return this.state.items
      .slice(-limit)
      .reverse()
      /*
       * `faceKey`, NEVER the player id.
       *
       * The screen needs a stable handle so a photo can be matched to the
       * fastest finger by identity rather than by name — two teams picking the
       * same name is a thing that happens, and the wrong person's face six
       * feet wide is not a small mistake.
       *
       * But this payload goes to anybody holding the join code, which is
       * printed on the projector — and a player id is a bearer credential, so
       * publishing one lets the room answer and rename as that player. The
       * derived key matches just as well and gives nothing back. See `faceKey`
       * in engine.js.
       */
      .map((p) => ({ id: p.id, url: `/photos/${p.file}`, teamName: p.teamName, at: p.at, faceKey: faceKey(p.playerId || '') }));
  }

  /** The host sees them whether or not the screen does, so they can be binned. */
  forHost(limit = 60) {
    return this.state.items
      .slice(-limit)
      .reverse()
      .map((p) => ({ id: p.id, url: `/photos/${p.file}`, teamName: p.teamName, at: p.at, filed: Boolean(p.filed) }));
  }

  /** Everything, grouped by the night it was taken, for the console. */
  nights() {
    return byNight(this.state.items.map((p) => ({
      id: p.id,
      url: `/photos/${p.file}`,
      file: p.file,
      teamName: p.teamName,
      at: p.at,
      night: p.night || nightOf(p.at),
      filed: Boolean(p.filed),
    })));
  }

  /** Note that a photo reached the private repo, so the console can say so. */
  markFiled(id) {
    const item = this.state.items.find((p) => p.id === id);
    if (!item || item.filed) return false;
    item.filed = true;
    this.save();
    return true;
  }

  /** Anything not yet filed away — what an "archive the rest" button acts on. */
  unfiled() {
    return this.state.items.filter((p) => !p.filed);
  }

  /** The bytes of one photo, for filing it. */
  read(id) {
    const item = this.state.items.find((p) => p.id === id);
    if (!item) return null;
    try {
      return { item, bytes: fs.readFileSync(path.join(this.dir, item.file)) };
    } catch {
      return null;
    }
  }
}

/**
 * Which night a photo belongs to.
 *
 * A quiz that runs past midnight is still the same night, so the day rolls
 * over at 6am rather than at twelve. Nobody wants half a gig filed under
 * Tuesday and half under Wednesday.
 */
export function nightOf(at) {
  const d = new Date(at - 6 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Everything from one night, newest first. */
export function byNight(items) {
  const nights = new Map();
  for (const p of items) {
    const key = p.night || nightOf(p.at);
    if (!nights.has(key)) nights.set(key, []);
    nights.get(key).push(p);
  }
  return [...nights.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([night, list]) => ({ night, photos: [...list].reverse() }));
}
