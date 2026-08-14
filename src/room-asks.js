/**
 * WHAT THE ROOM ASKED FOR — a suggestion box for the people who played.
 *
 * ---
 *
 * *"A customer finishes a quiz and thinks 'wouldn't it be great if there was a
 * reggae round' — they can just drop it into the suggestion box."* That is the
 * cheapest market research a quizmaster will ever get: it arrives from the
 * people who were in the room, on the night, while they are still thinking
 * about it, and it answers the one question that decides what to write next.
 *
 * ---
 *
 * **A SEPARATE BOX FROM THE QUIZMASTERS'.** `suggestions.js` is subscribers
 * writing to the owner — feature requests, pack requests, bug reports — and it
 * is read on a Monday as a work queue. Strangers' one-liners from a pub have
 * no business in it: they are a different channel, from different people,
 * answering a different question, and mixing them would bury the one that has
 * somebody waiting for a reply.
 *
 * **YES OR NO, AND NO IS A DELETE.** The host's own shape, and it is the same
 * Monday-load rule this codebase keeps applying: a queue that shrinks as you
 * work it costs a fraction of one that only grows. A bad idea is one tap and
 * gone for ever; a good one moves to the list of things worth writing, where
 * it stays until it is done.
 *
 * **IT COMES FROM A PHONE THAT PLAYED, not from a QR.** The token proves the
 * sender was in the game, which does three things at once: it makes anonymous
 * flooding impossible without joining first, it costs the room no scanning at
 * the one moment they are looking at the screen, and it tags every ask with
 * the NIGHT and the VENUE for free — so "four people at The Crown wanted a
 * reggae round" is a sentence the app can say.
 *
 * **IT IS A ROUND IDEA BOX, NOT A FEEDBACK FORM, and four things keep it
 * that way** — because "durrr I was bored" is not useful and a channel that
 * collects it becomes a thing somebody has to moderate:
 *
 *  - **The field is sixty characters.** A theme fits; a grievance does not.
 *  - **It asks for a ROUND**, in those words, and offers an example. Nothing
 *    on it invites an opinion about the night.
 *  - **It only exists at the END**, on a phone that played, twice per person.
 *    There is no comment box open all evening.
 *  - **No costs one tap and deletes it for ever.** That is the real answer:
 *    the worst case is a second of somebody's Monday, not a moderation queue.
 *
 * **No word filtering**, the same rule as team names — and unlike a team name
 * this is never projected. It is read by one person, later, who bins it in one
 * tap. It is never shown to the venue either: this is ideas, not evidence.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * A THEME, NOT AN ESSAY — and the length is the guard rail.
 *
 * The host's own worry, and it is the right one: *"I don't want it to be
 * feedback by the backdoor — 'durrr I was bored' is not useful or relevant."*
 * You cannot stop somebody typing a complaint into a box, but you can make the
 * box obviously wrong for it. Sixty characters holds "a reggae round" or
 * "80s one-hit wonders" and will not hold a grievance, and a field somebody
 * has to fight is a field they abandon.
 *
 * The rest of the answer is that a bad one costs ONE TAP: No deletes it for
 * ever, so the worst case is a second of somebody's Monday rather than a
 * channel that has to be moderated.
 */
export const MAX_ASK = 60;

/**
 * How many one phone may send in a night.
 *
 * Not a security control — the token already means they played — but somebody
 * bored at the bar with a full pint can otherwise turn one tap into forty, and
 * the person who pays for that is the quizmaster reading them on Monday.
 */
export const MAX_PER_PLAYER = 2;

/** Tidied exactly like a team name: control characters out, capped, no filter. */
export function cleanAsk(text) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ASK);
}

/** For grouping: "A reggae round!" and "a reggae round" are one idea. */
export function askKey(text) {
  return cleanAsk(text).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export class RoomAsks {
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
      return { asks: Array.isArray(parsed.asks) ? parsed.asks : [] };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        /*
         * Never overwrite something unreadable — the same rule as the accounts,
         * the invoices and the suggestion box. A parse error is not permission
         * to bin what a room asked for.
         */
        console.error('[asks] could not read the file:', err.message);
        try { fs.renameSync(this.filePath, this.filePath + '.broken'); } catch { /* nothing useful */ }
      }
      return { asks: [] };
    }
  }

  save() {
    try {
      fs.writeFileSync(this.tmpPath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
      fs.renameSync(this.tmpPath, this.filePath);
      return true;
    } catch (err) {
      console.error('[asks] could not save:', err.message);
      return false;
    }
  }

  serialise() {
    return JSON.stringify(this.data, null, 2) + '\n';
  }

  /**
   * Somebody in the room asks for something.
   *
   * @param {object} ask
   * @param {string} ask.text     what they typed
   * @param {string} ask.by       the player id, so one phone cannot flood it
   * @param {string} ask.name     their team name, because "the winners asked
   *                              for a reggae round" is worth knowing
   * @param {string} ask.night    which evening, `YYYY-MM-DD`
   * @param {string} ask.venue    where, so the ask carries its own evidence
   */
  add({ text, by = '', name = '', night = '', venue = '' } = {}) {
    const clean = cleanAsk(text);
    if (!clean) return { ok: false, reason: 'empty' };
    const mine = this.data.asks.filter((a) => a.by && a.by === by && a.night === night);
    if (mine.length >= MAX_PER_PLAYER) return { ok: false, reason: 'enough' };
    // The same phone asking the same thing twice is a double tap, not a vote.
    if (mine.some((a) => askKey(a.text) === askKey(clean))) return { ok: true, already: true };
    const ask = {
      id: `a${this.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      by,
      name: String(name || '').slice(0, 28),
      night: String(night || '').slice(0, 10),
      venue: String(venue || '').slice(0, 60),
      at: this.now(),
      // Nothing decided yet. Yes sets it true, No deletes the row outright —
      // there is no "rejected" state, because a list of things you have already
      // said no to is a list you read twice.
      kept: false,
    };
    this.data.asks.push(ask);
    this.save();
    return { ok: true, ask };
  }

  /** Everything, newest first — the console groups and splits it. */
  get all() {
    return [...this.data.asks].sort((a, b) => b.at - a.at);
  }

  /** Worth doing: the ones that got a yes. */
  get kept() {
    return this.all.filter((a) => a.kept);
  }

  /** Not looked at yet. */
  get pending() {
    return this.all.filter((a) => !a.kept);
  }

  keep(id) {
    const ask = this.data.asks.find((a) => a.id === id);
    if (!ask) return null;
    ask.kept = true;
    ask.keptAt = this.now();
    this.save();
    return ask;
  }

  /** No, or done. Gone either way — see the note on `kept` above. */
  drop(id) {
    const before = this.data.asks.length;
    this.data.asks = this.data.asks.filter((a) => a.id !== id);
    if (this.data.asks.length === before) return false;
    this.save();
    return true;
  }

  /**
   * The same idea from several phones, counted.
   *
   * Four people asking for reggae is a different thing from one person asking
   * four times, and it is the number that decides whether it is worth writing
   * — so the console shows one row with a count rather than four rows.
   */
  grouped(list = this.pending) {
    const groups = new Map();
    for (const ask of list) {
      const key = askKey(ask.text);
      if (!groups.has(key)) groups.set(key, { key, text: ask.text, count: 0, ids: [], venues: [], at: ask.at });
      const group = groups.get(key);
      group.count++;
      group.ids.push(ask.id);
      if (ask.venue && !group.venues.includes(ask.venue)) group.venues.push(ask.venue);
      group.at = Math.max(group.at, ask.at);
    }
    // Most asked first, then most recent — the order somebody would work them.
    return [...groups.values()].sort((a, b) => b.count - a.count || b.at - a.at);
  }
}
