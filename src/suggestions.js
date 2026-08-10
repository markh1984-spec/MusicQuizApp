/**
 * The suggestion box — ideas, irritations and bugs, from the people using it.
 *
 * Deliberately NOT the same list as `reports.js`. A report says "this question
 * is wrong", which is a fault in a pack and is answered by editing the pack. A
 * suggestion is about the APP — something that could be better, something that
 * got in the way, something that broke. Mixing them would mean one list where
 * half the entries need a pack opening and half need a decision, and the owner
 * page would be a pile rather than two things to work through.
 *
 * **Why a box and not a support hour.** A scheduled Q&A only works at a scale
 * that does not exist yet, and it asks somebody to REMEMBER what annoyed them
 * at 9:40pm mid-gig and bring it to 7pm on a Tuesday. The good ones do not
 * survive that trip. This is the same shape as "Something wrong with this
 * one?" on the answer key, and it works for the same reason: it catches the
 * thought at the moment it happens and costs almost nothing to send.
 *
 * It is asynchronous on purpose. Nobody is on call: they type when it occurs
 * to them, and the owner reads a batch when they feel like it.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * What kind of thing this is, chosen by the sender in one tap.
 *
 * Three, because three is what people can pick from without reading, and
 * because the three want completely different things doing about them: an idea
 * goes on a list, an irritation is a design question, and a bug is a job.
 */
export const KINDS = ['idea', 'annoying', 'broken'];
export const KIND_LABEL = {
  idea: 'An idea',
  annoying: 'Something that got in the way',
  broken: 'Something broken',
};

export const STATUSES = ['open', 'done'];

/** Enough to be a proper thought, short enough that nobody writes an essay. */
const MAX_TEXT = 1200;
const MAX_ITEMS = 400;

export class Suggestions {
  constructor(filePath, now = () => Date.now()) {
    this.filePath = filePath;
    this.tmpPath = filePath + '.tmp';
    this.now = now;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.data = this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return { suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [] };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Never overwrite something unreadable — the same rule as the accounts,
        // the invoices and the reports. A parse error is not permission to bin
        // somebody's words.
        console.error('[suggestions] could not read the file:', err.message);
        try { fs.renameSync(this.filePath, this.filePath + '.broken'); } catch { /* nothing useful */ }
      }
      return { suggestions: [] };
    }
  }

  save() {
    try {
      fs.writeFileSync(this.tmpPath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
      fs.renameSync(this.tmpPath, this.filePath);
      return true;
    } catch (err) {
      console.error('[suggestions] could not save:', err.message);
      return false;
    }
  }

  serialise() {
    return JSON.stringify(this.data, null, 2) + '\n';
  }

  isEmpty() {
    return this.data.suggestions.length === 0;
  }

  /** Only into an empty file, only at boot. Same rule as everything else. */
  restore(serialised) {
    if (this.data.suggestions.length) return { ok: false, reason: 'already_have_some' };
    let parsed;
    try {
      parsed = JSON.parse(String(serialised));
    } catch (err) {
      return { ok: false, reason: 'unreadable', error: err.message };
    }
    if (!parsed || !Array.isArray(parsed.suggestions)) return { ok: false, reason: 'nothing_in_it' };
    this.data = { suggestions: parsed.suggestions };
    this.save();
    return { ok: true, suggestions: this.data.suggestions.length };
  }

  get all() {
    return this.data.suggestions;
  }

  find(id) {
    return this.data.suggestions.find((s) => s.id === id) || null;
  }

  open() {
    return this.data.suggestions.filter((s) => s.status === 'open');
  }

  /**
   * @param {object} opts
   * @param {string} opts.text  what they wrote. The only required part.
   * @param {string} [opts.kind]
   * @param {string} [opts.by]      who sent it, so a reply can find them
   * @param {string} [opts.where]   which page they were on, for a bug
   */
  add({ text, kind = 'idea', by = '', byId = '', where = '' } = {}) {
    const words = String(text || '').trim().slice(0, MAX_TEXT);
    if (!words) return { ok: false, error: 'Write a line or two first.' };

    const at = this.now();
    const item = {
      id: `s${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at,
      kind: KINDS.includes(kind) ? kind : 'idea',
      text: words,
      by: String(by || '').slice(0, 120),
      byId: String(byId || '').slice(0, 60),
      // Which page they were on. Sent by the browser rather than guessed, and
      // it is the difference between "the editor is confusing" being actionable
      // and being a shrug.
      where: String(where || '').slice(0, 120),
      status: 'open',
      closedAt: null,
    };

    this.data.suggestions.unshift(item);

    // When it fills up, the ones already dealt with go first — an open
    // suggestion is somebody still waiting to hear back.
    while (this.data.suggestions.length > MAX_ITEMS) {
      const oldestDone = [...this.data.suggestions].reverse().find((s) => s.status === 'done');
      const drop = oldestDone || this.data.suggestions[this.data.suggestions.length - 1];
      this.data.suggestions.splice(this.data.suggestions.indexOf(drop), 1);
    }

    this.save();
    return { ok: true, suggestion: item };
  }

  setStatus(id, status) {
    if (!STATUSES.includes(status)) return false;
    const item = this.find(id);
    if (!item) return false;
    item.status = status;
    item.closedAt = status === 'done' ? this.now() : null;
    this.save();
    return true;
  }

  remove(id) {
    const i = this.data.suggestions.findIndex((s) => s.id === id);
    if (i < 0) return false;
    this.data.suggestions.splice(i, 1);
    this.save();
    return true;
  }

  summary() {
    return { open: this.open().length, total: this.data.suggestions.length };
  }
}
