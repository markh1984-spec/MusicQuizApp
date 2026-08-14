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
 * Three to start with, because three is what people can pick from without
 * reading, and because the three want completely different things doing about
 * them: an idea goes on a list, an irritation is a design question, and a bug
 * is a job.
 *
 * **A pack request is the fourth, and it is deliberately in HERE rather than
 * in a subsystem of its own.** "There is no One Direction quiz and I want one"
 * needs exactly what a suggestion needs — somebody to read it, decide, and say
 * yes or no in words — and all of that already exists: the inbox with its two
 * piles, the reply that clears it, the draft button, the badge, the
 * been-opened receipt. A second list with its own version of all that would be
 * a second place to forget to look.
 *
 * It is the one kind that is GATED, and `PACK_REQUEST_KIND` is exported so the
 * server can check it. See `FEATURES.REQUEST_PACK`.
 */
export const PACK_REQUEST_KIND = 'pack';
export const KINDS = ['idea', 'annoying', 'broken', PACK_REQUEST_KIND];
export const KIND_LABEL = {
  idea: 'An idea',
  annoying: 'Something that got in the way',
  broken: 'Something broken',
  [PACK_REQUEST_KIND]: 'A pack they want written',
};

export const STATUSES = ['open', 'done'];

/**
 * ================================================ WHEN A REQUESTED PACK GETS WRITTEN
 *
 * **Monday.** The host does his admin on Mondays, so that is when the inbox
 * gets read and the generator gets pressed — and saying so is worth more than
 * the limit below is.
 *
 * A request with no stated turnaround is a promise broken by silence: the
 * subscriber does not know whether it is coming on Thursday or at all, so they
 * chase, or they quietly stop believing in the feature. "Ask by Sunday and it
 * is in your library on Monday" is a smaller promise and a keepable one, which
 * makes it the better offer.
 *
 * 1 is Monday in `getDay()` terms. Asking ON a Monday means the Monday after,
 * because by then the admin is done.
 */
export const PACK_DAY = 1;
export const PACK_DAY_LABEL = 'Monday';

/**
 * **One a month, per account** — and note which of the two limits is doing the
 * real work.
 *
 * This one stops a single subscriber asking every week for ever: with only the
 * one-open-at-a-time rule, somebody could ask on Monday, get it on Monday, and
 * ask again on Tuesday — fifty-two packs a year from one person.
 *
 * But the constraint that actually binds is the OWNER'S MONDAY, not any one
 * subscriber's appetite, and that is handled by the queue rather than by a cap.
 * A global limit would mean refusing somebody who asked on Sunday night
 * because three other people got there first, which reads as "Gold, but be
 * quick" — and a control that refuses is the mistake this codebase keeps
 * recording. A queue position never says no, it says WHEN.
 */
export const PACK_PER_MONTH = 1;

/** The next Monday after `now`. Asking on a Monday means the Monday after. */
export function nextPackDay(now) {
  const day = new Date(now);
  const ahead = ((PACK_DAY - day.getUTCDay() + 7) % 7) || 7;
  const when = new Date(now);
  when.setUTCDate(when.getUTCDate() + ahead);
  when.setUTCHours(0, 0, 0, 0);
  return when.getTime();
}

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
      return {
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        // Notes the owner writes for the drafting model. Kept in this file
        // rather than on the account, because they belong to the box rather
        // than to a person, and they back up with it.
        house: typeof parsed.house === 'string' ? parsed.house : '',
      };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Never overwrite something unreadable — the same rule as the accounts,
        // the invoices and the reports. A parse error is not permission to bin
        // somebody's words.
        console.error('[suggestions] could not read the file:', err.message);
        try { fs.renameSync(this.filePath, this.filePath + '.broken'); } catch { /* nothing useful */ }
      }
      return { suggestions: [], house: '' };
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
    this.data = {
      suggestions: parsed.suggestions,
      house: typeof parsed.house === 'string' ? parsed.house : '',
    };
    this.save();
    return { ok: true, suggestions: this.data.suggestions.length };
  }

  get all() {
    return this.data.suggestions;
  }

  /**
   * The owner's own notes for the drafting model.
   *
   * The point of these being editable is that they are how the drafts get
   * better: every time one says something wrong, a line goes in here and it
   * stops saying it. Nothing else in the app teaches it anything.
   */
  get house() {
    return this.data.house || '';
  }

  setHouse(text) {
    this.data.house = String(text || '').trim().slice(0, 4000);
    this.save();
    return this.data.house;
  }

  /** Every reply the owner has written, newest first — examples of voice. */
  everyReply() {
    return this.data.suggestions;
  }

  find(id) {
    return this.data.suggestions.find((s) => s.id === id) || null;
  }

  open() {
    return this.data.suggestions.filter((s) => s.status === 'open');
  }

  /**
   * Has this account got a pack request still waiting?
   *
   * **One at a time, and that is what makes the feature deliverable.** A
   * request is a claim on the owner's writing time — about £2 and twenty
   * minutes of reading, for one person — and a Gold subscriber who could queue
   * ten would turn a promise into a backlog. One open request also makes the
   * answer easy to give: it is the next one, and they can see that it is.
   *
   * Worse than not having the feature is having it and not delivering, so the
   * limit is the honest half of the offer rather than a meanness.
   */
  /**
   * Everything the console needs to draw the panel BEFORE somebody types.
   *
   * The whole state up front rather than a refusal afterwards: being told you
   * cannot after writing three sentences is the version that annoys people,
   * and "you have had this month's, the next is from the 1st" is a sentence
   * somebody can plan around.
   */
  packRequestStatus(accountId, now = this.now()) {
    const id = String(accountId || '');
    const open = this.openPackRequest(id);
    const month = new Date(now).toISOString().slice(0, 7);
    const usedThisMonth = this.data.suggestions.filter((s) => (
      s.kind === PACK_REQUEST_KIND
      && s.byId === id
      && new Date(s.at || 0).toISOString().slice(0, 7) === month
    )).length;

    /*
     * Oldest first — the queue is the order they were asked in, which is the
     * only ordering nobody can argue with.
     *
     * `reverse()` before the sort, not decoration: the list is stored
     * newest-first, and a stable sort leaves two requests with the same
     * timestamp in the order it found them — which would have put the SECOND
     * person asked in front of the first.
     */
    const queue = this.data.suggestions
      .filter((s) => s.status === 'open' && s.kind === PACK_REQUEST_KIND)
      .reverse()
      .sort((a, b) => (a.at || 0) - (b.at || 0));

    const nextMonth = new Date(now);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
    nextMonth.setUTCHours(0, 0, 0, 0);

    return {
      open: open ? { id: open.id, text: open.text, at: open.at } : null,
      // 1-based, and 0 when they have nothing waiting.
      position: open ? queue.findIndex((s) => s.id === open.id) + 1 : 0,
      waiting: queue.length,
      usedThisMonth,
      perMonth: PACK_PER_MONTH,
      mayAsk: !open && usedThisMonth < PACK_PER_MONTH,
      // Only meaningful when they may not ask — when the allowance comes back.
      nextAllowedAt: nextMonth.getTime(),
      writtenOn: nextPackDay(now),
      day: PACK_DAY_LABEL,
      /*
       * THE ANSWER, WHERE THEY ASKED.
       *
       * A pack request is made under the shop on the pack tabs, because that
       * is where the want arrives — you have scrolled the catalogue and the
       * shelf and neither has the thing. But the REPLY only ever appeared on
       * the Help tab, so somebody asked in one place and heard back in
       * another, and the panel they asked from quietly reverted to an empty
       * box as though nothing had happened.
       *
       * So the most recent answered request comes back with the status. A
       * MONTH of it, and no longer: this is "what happened to the thing I
       * asked for", not a history, and a reply from the spring sitting on the
       * pack tab for ever is the clutter rule broken by something that was
       * useful once.
       */
      lastAnswered: this.lastAnsweredPackRequest(id, now),
    };
  }

  /**
   * The most recent pack request of theirs that has been replied to, if it was
   * recent enough to still be the answer to a question they remember asking.
   */
  lastAnsweredPackRequest(accountId, now = this.now(), days = 30) {
    const id = String(accountId || '');
    if (!id) return null;
    const since = now - days * 86_400_000;
    for (const s of this.data.suggestions) {
      if (s.kind !== PACK_REQUEST_KIND || s.byId !== id) continue;
      const last = (s.replies || [])[(s.replies || []).length - 1];
      if (!last) continue;
      // The list is newest-first, so the first match is the latest.
      if (Date.parse(last.at || 0) < since) return null;
      return { text: s.text, reply: last.text, at: last.at };
    }
    return null;
  }

  openPackRequest(accountId) {
    const id = String(accountId || '');
    if (!id) return null;
    return this.data.suggestions.find(
      (s) => s.status === 'open' && s.kind === PACK_REQUEST_KIND && s.byId === id,
    ) || null;
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
      // What the owner said back. A list rather than one field, because a
      // thread is the natural shape and because a second reply is a normal
      // thing to want — "tried that, still broken" deserves an answer too.
      replies: [],
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

  /**
   * The owner answering one.
   *
   * Replying CLEARS it by default, because the point of the list is that it
   * gets shorter: an inbox where answering something leaves it sitting there
   * is one you stop trusting to tell you what is left. Reopening is one tap
   * if the answer did not settle it.
   */
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.machine]  the model largely wrote this, so it must
   *   NOT be fed back as an example of the owner's voice — see `mostlyMine()`.
   */
  reply(id, text, { by = '', clear = true, machine = false } = {}) {
    const item = this.find(id);
    if (!item) return { ok: false, error: 'No such suggestion' };
    const words = String(text || '').trim().slice(0, MAX_TEXT);
    if (!words) return { ok: false, error: 'Write something first.' };

    item.replies = [...(item.replies || []), {
      at: this.now(),
      by: String(by || '').slice(0, 120),
      text: words,
      // Filled in when their console next draws this thread. See markSeen.
      seenAt: null,
      // Kept so the drafting model can be stopped from learning from itself.
      machine: Boolean(machine),
    }];
    if (clear) {
      item.status = 'done';
      item.closedAt = this.now();
    }
    this.save();
    return { ok: true, suggestion: item };
  }

  /**
   * They have now had a chance to read what came back.
   *
   * Called when their console draws their own threads, so it means "their
   * console opened it" rather than "they read it" — which is all any read
   * receipt has ever meant, and is worth labelling honestly on the owner's
   * side rather than dressing up as more than it is.
   *
   * Only ever fills a blank: the FIRST time it was seen is the useful fact,
   * and rewriting it on every page load would turn a read receipt into a
   * "they were looking a second ago" ticker, which answers a different and
   * less useful question.
   */
  markSeen(accountId, at = this.now()) {
    let marked = 0;
    for (const item of this.forAccount(accountId)) {
      for (const reply of item.replies || []) {
        if (!reply.seenAt) { reply.seenAt = at; marked++; }
      }
    }
    if (marked) this.save();
    return marked;
  }

  /** Everything one account has sent, with whatever came back. */
  forAccount(accountId) {
    const id = String(accountId || '');
    if (!id) return [];
    return this.data.suggestions.filter((s) => s.byId === id);
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
