/**
 * THE FLIGHT RECORDER — what the app saw, written down as it happens.
 *
 * Asked for after a night where the launch would not go and it took an hour
 * to find out why: *"literally anything that goes wrong, you can have a
 * report so you can action it straight away."* Render's log is the only
 * record of a live night and it is on a page nobody opens from a pub. This
 * is a short, structured, COPYABLE version of that log, per room, with the
 * things a phone and a console saw folded in — so the report of a broken
 * night is one Copy button rather than a conversation.
 *
 * What it is NOT: a metrics system, an audit trail, or a second log. It holds
 * the last couple of thousand lines and forgets the rest. A note is one line
 * with a kind, a level and at most a few hundred characters, so nothing in
 * here can ever be the reason a night slows down.
 *
 * WHERE THE LINES COME FROM, and none of them needs remembering by hand:
 *
 * - `captureConsole()` wraps `console.warn` and `console.error`, so every
 *   `[backup]`, `[accounts]`, `[trials]` and `[http]` line the app already
 *   prints is an entry — the code that says something went wrong did not have
 *   to learn a second way of saying it.
 * - `sendJson()` notes every answer of 400 or more, tagged with the room the
 *   route resolved, so a refused launch and a phone's rejected answer both
 *   appear under the night they happened on.
 * - The host route notes each launch and each press that was refused.
 * - `pushState()` notes a phase change per room, so the report reads as a
 *   night: lobby, rules, question one, reveal…
 * - The browsers report what THEY saw — a thrown error, a request that failed
 *   — through `POST /api/flight`, and those land under the room too.
 * - The self-test at boot writes its verdict here, with the failing step.
 *
 * IT IS MIRRORED TO `data/flight.jsonl`, and that is a courtesy, not a store.
 * A deploy wipes `data/`, and a night that ended in a crash is exactly the
 * one whose lines are worth having after the restart — so the tail is read
 * back at boot. Every append is fire-and-forget: a disk that will not take
 * the write must never cost a request.
 *
 * A ROOM'S REPORT IS ITS OWN LINES PLUS THE GLOBAL ONES THAT MATTER. A
 * quizmaster reading "what the app saw tonight" wants their room and the
 * server-wide failures (a boot, a self-test, an uncaught error), never the
 * 401s off somebody else's login page. The owner asks with `all` and gets
 * the lot.
 */

import fs from 'node:fs';
import path from 'node:path';

export const LEVELS = ['info', 'warn', 'fail'];
const MSG_MAX = 300;
const DATA_MAX = 600;
// Above this the mirror file is rewritten from the ring rather than grown —
// a long season of appends must not become a file the boot spends a second on.
const FILE_MAX_BYTES = 2 * 1024 * 1024;
// Global kinds every room's report carries, whatever their level.
const SHARED_KINDS = new Set(['boot', 'selftest', 'uncaught']);

/** One line of anything, printable, and never longer than it needs to be. */
export function clean(value, max) {
  let s = typeof value === 'string' ? value : (value === undefined ? '' : safeString(value));
  // Control characters go, tabs and newlines become spaces: one entry is one
  // line, in the file and in the copied text.
  s = s.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function safeString(value) {
  try {
    if (value instanceof Error) return value.stack || value.message || String(value);
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  } catch {
    return String(value);
  }
}

export class Flight {
  constructor(filePath, { limit = 2000, now = () => Date.now() } = {}) {
    this.filePath = filePath;
    this.limit = limit;
    this.now = now;
    this.entries = [];
    this.seq = 0;
    this.bytes = 0;
    this.capturing = false;
    // Appends are queued behind one another: two `appendFile`s in flight at
    // once may land in either order, and a record read back out of order is
    // a record that lies about what happened first.
    this.writing = Promise.resolve();
  }

  /** The tail of the mirror file, so a crash's last lines survive the restart. */
  load() {
    if (!this.filePath) return this;
    let text = '';
    try { text = fs.readFileSync(this.filePath, 'utf8'); } catch { return this; }
    this.bytes = Buffer.byteLength(text);
    const kept = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const e = JSON.parse(line);
        if (e && typeof e.at === 'number' && typeof e.kind === 'string') kept.push(e);
      } catch { /* a half-written last line, the one thing a crash leaves */ }
    }
    this.entries = kept.slice(-this.limit);
    this.seq = this.entries.length;
    return this;
  }

  /**
   * One line. `kind` is a short word saying what part of the app is talking
   * (`launch`, `http`, `phone`, `backup`); `level` is how bad; `room` is the
   * room it belongs to, or null for the server as a whole.
   */
  note(kind, msg, { room = null, level = 'info', data = null } = {}) {
    const entry = {
      at: this.now(),
      seq: ++this.seq,
      level: LEVELS.includes(level) ? level : 'info',
      kind: clean(kind, 24) || 'note',
      room: room ? clean(String(room), 40) : null,
      msg: clean(msg, MSG_MAX),
    };
    if (data !== null && data !== undefined) {
      const d = clean(data, DATA_MAX);
      if (d) entry.data = d;
    }
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    this.append(entry);
    return entry;
  }

  append(entry) {
    if (!this.filePath) return;
    const line = JSON.stringify(entry) + '\n';
    this.bytes += Buffer.byteLength(line);
    let job;
    if (this.bytes > FILE_MAX_BYTES) {
      // Rewrite from the ring: the file only ever holds what memory holds.
      const whole = this.entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
      this.bytes = Buffer.byteLength(whole);
      job = () => fs.promises.writeFile(this.filePath, whole);
    } else {
      job = () => fs.promises.appendFile(this.filePath, line);
    }
    this.writing = this.writing
      .then(() => fs.promises.mkdir(path.dirname(this.filePath), { recursive: true }))
      .then(job)
      .catch(() => {});
  }

  /** Every queued append has landed — for tests and a tidy shutdown. */
  flush() {
    return this.writing;
  }

  /**
   * What one room's report holds: its own lines, plus the server-wide ones
   * that would explain a bad night (a boot, the self-test, anything that
   * FAILED with no room on it). `all` is the owner's view — everything.
   */
  recent({ room = null, all = false, limit = 200, since = 0 } = {}) {
    const out = [];
    for (let i = this.entries.length - 1; i >= 0 && out.length < limit; i -= 1) {
      const e = this.entries[i];
      if (since && e.at < since) break;
      if (all) { out.push(e); continue; }
      if (e.room) { if (e.room === room) out.push(e); continue; }
      if (e.level === 'fail' || SHARED_KINDS.has(e.kind)) out.push(e);
    }
    return out.reverse();
  }

  /** Every entry since a moment, unfiltered — for the guard and the owner. */
  all() {
    return this.entries.slice();
  }

  /**
   * The copyable text. One line each, oldest first, wide enough to read in a
   * chat message and narrow enough to paste into one.
   */
  static text(entries, { tz = 'Europe/London' } = {}) {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return entries.map((e) => {
      const when = fmt.format(new Date(e.at));
      const level = e.level === 'fail' ? 'FAIL' : e.level === 'warn' ? 'warn' : '    ';
      const room = e.room ? ` [${e.room}]` : '';
      const data = e.data ? `  — ${e.data}` : '';
      return `${when} ${level} ${e.kind.padEnd(9)}${room} ${e.msg}${data}`;
    }).join('\n');
  }

  /**
   * Every `console.warn` and `console.error` the app prints becomes a line.
   * Called once at boot; the original functions still print, so Render's log
   * is untouched. A warn is `warn`, an error is `fail`, and the tag in square
   * brackets at the front of the message — `[backup]`, `[trials]` — is the
   * kind, which is how the app already names its subsystems.
   */
  captureConsole() {
    if (this.capturing) return;
    this.capturing = true;
    const wrap = (name, level) => {
      const original = console[name].bind(console);
      console[name] = (...args) => {
        original(...args);
        try {
          const text = args.map((a) => (typeof a === 'string' ? a : safeString(a))).join(' ');
          const tag = text.match(/^\[([a-z-]+)\]\s*/i);
          this.note(tag ? tag[1] : name, tag ? text.slice(tag[0].length) : text, { level });
        } catch { /* the recorder must never be the thing that throws */ }
      };
    };
    wrap('warn', 'warn');
    wrap('error', 'fail');
  }
}
