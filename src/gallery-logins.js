/**
 * GALLERY LOGINS — a pub's staff, signed in to that pub's photographs and
 * NOTHING else.
 *
 * The host, 1 October 2026: *"I need to give Evie and Tabby at Station Tap
 * Wokingham their own logins to be able to download photos and videos from the
 * gallery with the watermark"*, then *"only have access to the gallery and
 * under the passwords I set"*, *"usernames as Tabby and Evie, and also give
 * them the ability to change their passwords."*
 *
 * **A BOOK OF ITS OWN, NOT THE ACCOUNTS BOOK, AND THAT IS THE SECURITY.** Every
 * route in this app resolves a caller through `whoIs()` against the accounts
 * book, and billing, the trial emails, the owner's subscriber list and every
 * `can()` assume an account is an owner or a quizmaster. A third role in there
 * would be gated route by route, and the first route somebody forgets is a
 * pub's barmaid reading a console. Here the login lives in another file with
 * another cookie, so **no existing route can see one at all** — "gallery
 * only" is true by construction, and the only routes that read this book are
 * the ones in `src/http/venue-photos.js`.
 *
 * - A login is a USERNAME, never an email — `@` is refused so it can never be
 *   mistaken for an account's address on the shared sign-in desk.
 * - **The quizmaster sets the password**; the login may change it.
 * - **A session is stored as its SHA-256**, so a copy of this file (it is
 *   backed up to the private repository like the accounts book) signs nobody in.
 * - Passwords use the accounts book's own scrypt (`hashPassword`/`verifyAsync`)
 *   and its own rules (`checkPassword`); the breach check is at the ROUTE, as
 *   it is for accounts.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { checkPassword, hashPassword, verifyAsync } from './accounts.js';
import { staffGame } from '../public/assets/staff-games.js';

export const GALLERY_COOKIE = 'mqz_gallery';
const SESSION_DAYS = 30;
/** A SAFETY number, like `MAX_SEATS`: a pub with more staff logins is a conversation. */
export const MAX_PER_VENUE = 12;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const fold = (s) => String(s || '').trim().toLowerCase();

/** 'Tabby' — letters, digits, spaces, dots, dashes and underscores; 2 to 30. */
export function cleanUsername(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 30) throw new Error('A username needs to be 2 to 30 characters.');
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) throw new Error('A username can only use letters, numbers, spaces, dots and dashes.');
  return name;
}

export class GalleryLogins {
  constructor(file, { now = Date.now } = {}) {
    this.file = file;
    this.now = now;
    this.data = { logins: [], sessions: [] };
    try {
      const read = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data = { logins: Array.isArray(read.logins) ? read.logins : [], sessions: Array.isArray(read.sessions) ? read.sessions : [] };
    } catch { /* a first boot has no file */ }
  }

  isEmpty() { return this.data.logins.length === 0; }

  serialise() { return JSON.stringify(this.data, null, 2) + '\n'; }

  /** Only ever into an EMPTY book — the accounts book's own rule. `restoreStore()`'s shape. */
  restore(text) {
    if (!this.isEmpty()) return { ok: false, reason: 'the book already holds logins' };
    try {
      const read = JSON.parse(text);
      if (!Array.isArray(read.logins)) return { ok: false, reason: 'not a gallery logins book' };
      this.data = { logins: read.logins, sessions: Array.isArray(read.sessions) ? read.sessions : [] };
      this.save();
      return { ok: true, logins: read.logins.length };
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, this.serialise());
    fs.renameSync(tmp, this.file);
  }

  /** What a quizmaster's console may see of a login — never the hash. */
  static safe(login) {
    return {
      id: login.id, username: login.username, venueId: login.venueId, venue: login.venue, createdAt: login.createdAt,
      // WHEN THEY ACTUALLY USE IT — asked for by the host, 2 October 2026: a
      // panel that says when Evie or Tabby sign in. A session lasts thirty
      // days, so the sign-in alone goes quiet; `lastSeen` is the page opening.
      ...(login.lastSignIn ? { lastSignIn: login.lastSignIn } : {}),
      ...(login.lastSeen ? { lastSeen: login.lastSeen } : {}),
      ...(login.game ? { game: login.game } : {}),
    };
  }

  list(roomId, venueId) {
    return this.data.logins.filter((l) => l.roomId === roomId && (!venueId || l.venueId === venueId)).map(GalleryLogins.safe);
  }

  find(id) { return this.data.logins.find((l) => l.id === id) || null; }

  create({ roomId, venueId, venue, username, password }) {
    const name = cleanUsername(username);
    if (!roomId || !venueId || !String(venue || '').trim()) throw new Error('Pick the pub this login is for.');
    if (this.data.logins.some((l) => fold(l.username) === fold(name))) throw new Error(`There is already a login called ${name}. Pick another name.`);
    if (this.list(roomId, venueId).length >= MAX_PER_VENUE) throw new Error(`A pub can have up to ${MAX_PER_VENUE} logins.`);
    checkPassword(password);
    const login = {
      id: crypto.randomBytes(9).toString('base64url'),
      username: name,
      roomId,
      venueId,
      venue: String(venue).trim(),
      createdAt: new Date(this.now()).toISOString(),
      ...hashPassword(password),
    };
    this.data.logins.push(login);
    this.save();
    return GalleryLogins.safe(login);
  }

  /** Remove a login, and every session it holds — only from the room that made it. */
  remove(id, roomId) {
    const login = this.find(id);
    if (!login || login.roomId !== roomId) return false;
    this.data.logins = this.data.logins.filter((l) => l.id !== id);
    this.data.sessions = this.data.sessions.filter((s) => s.loginId !== id);
    this.save();
    return true;
  }

  async signIn(username, password) {
    const login = this.data.logins.find((l) => fold(l.username) === fold(username));
    // An unknown name still pays for a hash, so the time taken says nothing.
    const ok = await verifyAsync(login || DUMMY, password);
    if (!login || !ok) return null;
    const token = crypto.randomBytes(32).toString('base64url');
    const now = this.now();
    login.lastSignIn = new Date(now).toISOString();
    login.lastSeen = login.lastSignIn;
    this.data.sessions = this.data.sessions.filter((s) => s.expires > now);
    this.data.sessions.push({ hash: sha(token), loginId: login.id, expires: now + SESSION_DAYS * 86_400_000 });
    this.save();
    return { token, login: GalleryLogins.safe(login) };
  }

  /** The login a session token belongs to, or null. */
  who(token) {
    if (!token) return null;
    const hash = sha(token);
    const s = this.data.sessions.find((x) => x.hash === hash && x.expires > this.now());
    return s ? this.find(s.loginId) : null;
  }

  /**
   * A login opened the page. Written at most every ten minutes — a staff
   * member scrolling a night must not rewrite and back up the book per
   * photo. Answers whether it wrote.
   */
  seen(login, everyMs = 10 * 60_000) {
    const now = this.now();
    if (login.lastSeen && now - Date.parse(login.lastSeen) < everyMs) return false;
    login.lastSeen = new Date(now).toISOString();
    this.save();
    return true;
  }

  /**
   * The quizmaster sets a new password for a login — a typo at creation, or
   * a phone lost behind the bar. Every session that login holds ends: whoever
   * had the old one is out.
   */
  setPassword(id, roomId, password) {
    const login = this.find(id);
    if (!login || login.roomId !== roomId) return false;
    checkPassword(password);
    Object.assign(login, hashPassword(password));
    this.data.sessions = this.data.sessions.filter((x) => x.loginId !== id);
    this.save();
    return true;
  }

  /**
   * A GAME ON ONE LOGIN — the host's gift, chosen per person on the venue
   * card (3 October 2026): an id off `staff-games.js`, or '' for none. Absent
   * unless chosen, so every other login's record is byte-for-byte what it was.
   * An id not on the list is refused, never stored.
   */
  setGame(id, roomId, game) {
    const login = this.find(id);
    if (!login || login.roomId !== roomId) return false;
    if (game && !staffGame(game)) throw new Error('There is no game called that.');
    if (game) login.game = game;
    else delete login.game;
    this.save();
    return true;
  }

  signOut(token) {
    const hash = sha(token);
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.hash !== hash);
    if (this.data.sessions.length !== before) this.save();
  }

  /**
   * Change a password, knowing the current one. Every OTHER session goes —
   * a password changed because somebody else knew it must shut them out —
   * and the one doing the changing stays signed in.
   */
  async changePassword(token, current, next) {
    const login = this.who(token);
    if (!login) throw new Error('Sign in again first.');
    if (!(await verifyAsync(login, current))) throw new Error('Your current password is not right.');
    checkPassword(next);
    Object.assign(login, hashPassword(next));
    const keep = sha(token);
    this.data.sessions = this.data.sessions.filter((s) => s.loginId !== login.id || s.hash === keep);
    this.save();
    return true;
  }
}

const DUMMY = hashPassword('a password nobody has, for timing only');
