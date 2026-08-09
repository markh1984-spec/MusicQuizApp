/**
 * "That one's wrong" — corrections on a question, from whoever is running it.
 *
 * The packs are read-only to a quizmaster on purpose: they are written to a
 * house style and sold, and letting three people edit them is how that style
 * stops being one. But the person standing in front of sixty people is the one
 * who finds out a question is wrong, and the answer to that cannot be "email
 * Mark" — it has to be one tap, mid-gig, with the room waiting.
 *
 * So this is the other half of read-only: they cannot change a question, and
 * they can always tell you about one.
 *
 * ---
 *
 * **A report carries a COPY of the question, not just a pointer to it.** By the
 * time anybody reads it the pack may well have been edited, reordered, or had
 * the round rewritten — and a report that says "round 2 question 7" against a
 * quiz that has since changed is worse than no report, because it sends you to
 * the wrong question with confidence. The copy is what the host actually had on
 * screen, and it is the thing you compare against.
 *
 * Global rather than per-room, and that is deliberate: the packs are shared, so
 * a fault Rob finds in a quiz is a fault in YOUR quiz, and it should reach you
 * whichever room noticed it.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Enough for a long time; the oldest resolved ones go first when it fills. */
export const MAX_REPORTS = 500;

export const STATUSES = ['open', 'done'];

export class Reports {
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
      return { reports: Array.isArray(parsed.reports) ? parsed.reports : [] };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Never overwrite something unreadable — the same rule as the accounts
        // and the invoices. A parse error is not permission to bin it.
        console.error('[reports] could not read the file:', err.message);
        try { fs.renameSync(this.filePath, this.filePath + '.broken'); } catch { /* nothing useful */ }
      }
      return { reports: [] };
    }
  }

  /** Immediate, not debounced. Somebody pressed a button once, mid-gig. */
  save() {
    try {
      fs.writeFileSync(this.tmpPath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
      fs.renameSync(this.tmpPath, this.filePath);
      return true;
    } catch (err) {
      console.error('[reports] could not save:', err.message);
      return false;
    }
  }

  serialise() {
    return JSON.stringify(this.data, null, 2) + '\n';
  }

  isEmpty() {
    return this.data.reports.length === 0;
  }

  /** Only into an empty file, only at boot. Same rule as everything else. */
  restore(serialised) {
    if (!this.isEmpty()) return { ok: false, reason: 'already_have_reports' };
    let parsed;
    try {
      parsed = JSON.parse(String(serialised));
    } catch (err) {
      return { ok: false, reason: 'unreadable', error: err.message };
    }
    if (!parsed || !Array.isArray(parsed.reports)) return { ok: false, reason: 'nothing_in_it' };
    this.data = { reports: parsed.reports };
    this.save();
    return { ok: true, reports: this.data.reports.length };
  }

  all() {
    return this.data.reports;
  }

  open() {
    return this.data.reports.filter((r) => r.status === 'open');
  }

  find(id) {
    return this.data.reports.find((r) => r.id === id) || null;
  }

  /**
   * File one.
   *
   * The same person reporting the same question twice is ONE report with a
   * later timestamp, not two. A laggy phone on pub wifi invites a second tap,
   * and a list with the same question in it three times is a list you stop
   * reading — the same reasoning as the double-tap guard on the control view.
   */
  add({ packId, packKind = 'quiz', roundIndex = null, questionIndex = null, questionId = '', prompt = '', answer = '', note = '', by = '' } = {}) {
    if (!packId) return { ok: false, reason: 'no_pack' };

    const at = this.now();
    const sameOne = this.data.reports.find((r) => r.status === 'open'
      && r.packId === packId
      && r.questionId === questionId
      && r.roundIndex === roundIndex
      && r.questionIndex === questionIndex
      && r.by === by);

    if (sameOne) {
      sameOne.at = at;
      if (note) sameOne.note = String(note).slice(0, 500);
      this.save();
      return { ok: true, report: sameOne, already: true };
    }

    const report = {
      id: `r${at.toString(36)}${this.data.reports.length}`,
      packId,
      packKind,
      roundIndex,
      questionIndex,
      questionId,
      // The copy. See the note at the top of this file — a pointer alone goes
      // stale the moment the pack is edited.
      prompt: String(prompt).slice(0, 300),
      answer: String(answer).slice(0, 200),
      note: String(note).slice(0, 500),
      by: String(by).slice(0, 60),
      at,
      status: 'open',
    };
    this.data.reports.unshift(report);

    // When it fills up, the ones already dealt with go first. An open report
    // is somebody waiting for an answer.
    while (this.data.reports.length > MAX_REPORTS) {
      const oldestDone = [...this.data.reports].reverse().find((r) => r.status === 'done');
      const drop = oldestDone || this.data.reports[this.data.reports.length - 1];
      this.data.reports.splice(this.data.reports.indexOf(drop), 1);
    }

    this.save();
    return { ok: true, report };
  }

  setStatus(id, status) {
    if (!STATUSES.includes(status)) return false;
    const report = this.find(id);
    if (!report) return false;
    report.status = status;
    report.closedAt = status === 'done' ? this.now() : null;
    this.save();
    return true;
  }

  remove(id) {
    const i = this.data.reports.findIndex((r) => r.id === id);
    if (i < 0) return false;
    this.data.reports.splice(i, 1);
    this.save();
    return true;
  }

  /** A count for the console's tab badge. */
  summary() {
    return { open: this.open().length, total: this.data.reports.length };
  }
}
