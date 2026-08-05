/**
 * Crash recovery.
 *
 * The whole live state is one small JSON object, so "survive a restart" is
 * just: write it to disk after every change, read it back on boot. If the
 * server process dies mid-quiz, scores and the player list come back and the
 * host carries on from where the room was — no restarting from question one.
 *
 * Writes are atomic (temp file + rename) so a power cut halfway through a
 * write cannot leave a truncated file that fails to parse on the way back up.
 * They are also debounced, because a room of sixty phones answering at once
 * would otherwise mean sixty writes in two seconds.
 */

import fs from 'node:fs';
import path from 'node:path';

const SAVE_DEBOUNCE_MS = 250;

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.tmpPath = filePath + '.tmp';
    this.pending = null;
    this.timer = null;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[store] could not read saved state, starting fresh:', err.message);
        this.quarantineBadFile();
      }
    }
    return null;
  }

  /** Keep an unreadable file around rather than silently overwriting it. */
  quarantineBadFile() {
    try {
      fs.renameSync(this.filePath, this.filePath + '.broken');
    } catch {
      /* nothing useful to do */
    }
  }

  /** Queue a save. Safe to call on every single mutation. */
  save(data) {
    this.pending = data;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, SAVE_DEBOUNCE_MS);
    if (this.timer.unref) this.timer.unref();
  }

  /** Write immediately. Used on shutdown so nothing in flight is lost. */
  flush() {
    if (this.pending === null) return;
    const data = this.pending;
    this.pending = null;
    try {
      fs.writeFileSync(this.tmpPath, JSON.stringify(data), 'utf8');
      fs.renameSync(this.tmpPath, this.filePath);
    } catch (err) {
      console.error('[store] save failed:', err.message);
    }
  }

  clear() {
    this.pending = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      fs.unlinkSync(this.filePath);
    } catch {
      /* already gone */
    }
  }
}
