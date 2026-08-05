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
 * then a bingo round, and launching the second one throws the first game away
 * — the photos should not go with it.
 *
 * They are deliberately NOT backed up to GitHub. Everything else this app
 * saves is a pack you would want back in six months; these are pictures of
 * members of the public, and the repository is not the place for them. They
 * live for the night, and there is a download button for the ones worth
 * keeping.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Room for a busy night without ever filling a small disk. */
export const MAX_PHOTOS = 300;

/** Big enough for a phone photo scaled down, small enough to refuse a video. */
export const MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

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
   * @param {object} meta  { contentType, playerId, teamName, filter }
   */
  add(bytes, { contentType, playerId = '', teamName = '', filter = '' } = {}) {
    if (!this.state.enabled) return { ok: false, reason: 'off' };
    if (!bytes || !bytes.length) return { ok: false, reason: 'empty' };
    if (bytes.length > MAX_BYTES) return { ok: false, reason: 'too_big' };

    const sniffed = sniffType(bytes);
    const ext = extensionFor(sniffed || contentType);
    if (!sniffed || !ext) return { ok: false, reason: 'not_an_image' };

    const at = this.now();
    const id = `p${at.toString(36)}${Math.floor(at % 997).toString(36)}${this.state.items.length}`;
    const name = id + ext;

    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(path.join(this.dir, name), bytes);
    } catch (err) {
      return { ok: false, reason: 'could_not_save', error: err.message };
    }

    const item = { id, file: name, at, playerId, teamName, filter, bytes: bytes.length };
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
      .map((p) => ({ id: p.id, url: `/photos/${p.file}`, teamName: p.teamName, at: p.at }));
  }

  /** The host sees them whether or not the screen does, so they can be binned. */
  forHost(limit = 60) {
    return this.state.items
      .slice(-limit)
      .reverse()
      .map((p) => ({ id: p.id, url: `/photos/${p.file}`, teamName: p.teamName, at: p.at }));
  }
}
