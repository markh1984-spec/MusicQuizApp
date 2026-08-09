/**
 * Accounts: who is signed in, and what they are.
 *
 * One owner account (the app dev) and as many quizmaster accounts as there are
 * subscribers. See `public/assets/plans.js` for what each is allowed to do —
 * it lives there because the browser needs the same list, like `looks.js`.
 *
 * Rules that everything else leans on:
 *
 *  1. **A PASSWORD IS NEVER STORED.** Only a scrypt hash and its salt, from
 *     node's own crypto — no dependency, and nothing to keep up to date. The
 *     comparison is timing-safe. The owner cannot read a subscriber's password
 *     because it is not written down anywhere, which is the honest version of
 *     "your account is private from me".
 *
 *  2. **A LAPSED SUBSCRIPTION NEVER INTERRUPTS A NIGHT.** Payments fail for
 *     stupid reasons — an expired card, a bank being cautious — and they fail
 *     at the worst possible moment often enough to plan for. Losing features is
 *     something that happens between gigs, never during one. See
 *     `mayStartSomething` versus `mayCarryOn`.
 *
 *  3. **THE FILE IS PRIVATE.** Email addresses, password hashes and payment
 *     references. It backs up to the private repository, never the main one,
 *     exactly like the invoices — see `backUpAccounts()` in server.js.
 *
 * Payments stay processor-agnostic on purpose: an account carries a customer
 * reference and a status and nothing else, so Stripe, PayPal or a merchant of
 * record can be swapped without touching anything in here. No card details ever
 * reach this server.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { PLANS, ADDONS, ROLES, STATUSES, can, featuresFor, entitlements } from '../public/assets/plans.js';

/** Work factor for scrypt. Slow enough to matter, fast enough for a login. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_DAYS = 30;

export class Accounts {
  constructor(filePath, { now = () => Date.now() } = {}) {
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
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Never overwrite something unreadable: it is the only copy of every
        // login, and a parse error is not permission to bin it.
        console.error('[accounts] could not read the accounts file:', err.message);
        try { fs.renameSync(this.filePath, this.filePath + '.broken'); } catch { /* nothing useful */ }
      }
      return { accounts: [], sessions: [] };
    }
  }

  save() {
    fs.writeFileSync(this.tmpPath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
    fs.renameSync(this.tmpPath, this.filePath);
    return true;
  }

  serialise() {
    return JSON.stringify(this.data, null, 2) + '\n';
  }

  /**
   * Take a backup of the accounts file back in.
   *
   * Only ever used at boot, and only when there is nothing here already —
   * restoring over a live file would sign everybody out and could roll a
   * password change back to the one before it. On a host with no permanent
   * disk this is what makes a login survive a deploy at all.
   *
   * Sessions come back with it on purpose: they are hashes of tokens sitting
   * in people's cookies, and dropping them would sign the whole room out
   * every time the app restarted, which is the thing accounts were supposed to
   * stop being a problem.
   */
  restore(serialised) {
    if (this.data.accounts.length) return { ok: false, reason: 'already_have_accounts' };
    let parsed;
    try {
      parsed = JSON.parse(String(serialised));
    } catch (err) {
      return { ok: false, reason: 'unreadable', error: err.message };
    }
    if (!parsed || !Array.isArray(parsed.accounts) || !parsed.accounts.length) {
      return { ok: false, reason: 'nothing_in_it' };
    }
    this.data = {
      accounts: parsed.accounts,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
    this.save();
    return { ok: true, accounts: this.data.accounts.length };
  }

  // ------------------------------------------------------------- the accounts

  get all() {
    return this.data.accounts;
  }

  find(id) {
    return this.data.accounts.find((a) => a.id === id) || null;
  }

  byEmail(email) {
    const wanted = normaliseEmail(email);
    return this.data.accounts.find((a) => a.email === wanted) || null;
  }

  /**
   * The owner's own quizmaster account, if they have made one.
   *
   * One login, two hats. Mark is the app dev and a quizmaster, and the point of
   * switching rather than signing in twice is that he then experiences the app
   * EXACTLY as a subscriber does — same permissions, same room, same read-only
   * packs. Anything that irritates a quizmaster irritates him too, which is the
   * only way those things get found.
   */
  ownQuizmasterFor(ownerId) {
    return this.data.accounts.find((a) => a.role === 'quizmaster' && a.ownedBy === ownerId) || null;
  }

  get owner() {
    return this.data.accounts.find((a) => a.role === 'owner') || null;
  }

  /**
   * @param {object} opts
   * @param {'owner'|'quizmaster'} opts.role
   * @param {boolean} [opts.comped]  everything, for nothing. The owner's own
   *                                 quizmaster account, and anybody he gifts it to.
   */
  create({ email, password, name = '', role = 'quizmaster', plan = 'basic', addons = [], comped = false, status = 'trialing', ownedBy = '' }) {
    const clean = normaliseEmail(email);
    if (!clean || !clean.includes('@')) throw new Error('That does not look like an email address.');
    if (this.byEmail(clean)) throw new Error('There is already an account with that email address.');
    if (!ROLES.includes(role)) throw new Error(`"${role}" is not a role.`);
    // One owner, and only one. A second would be a second person able to see
    // every subscriber, which is not something to create by accident.
    if (role === 'owner' && this.owner) throw new Error('There is already an owner account.');
    if (!PLANS[plan]) throw new Error(`"${plan}" is not a plan.`);
    if (!STATUSES.includes(status)) throw new Error(`"${status}" is not a subscription status.`);
    checkPassword(password);

    const account = {
      id: newId(),
      email: clean,
      name: String(name || '').trim(),
      role,
      ...hashPassword(password),
      // The owner's own quizmaster account. Marked so the owner page can offer
      // to switch into it, and so nothing else can: acting as somebody ELSE's
      // quizmaster is support access, which is theirs to grant and is logged —
      // a different feature from wearing your own second hat.
      ...(ownedBy ? { ownedBy } : {}),
      ...(role === 'owner' ? {} : {
        plan,
        addons: (addons || []).filter((a) => ADDONS[a]),
        comped: Boolean(comped),
        status: comped ? 'active' : status,
        // Whatever the payment processor calls them. Deliberately just a string:
        // swapping Stripe for PayPal must not need a migration.
        billing: { customerRef: '', processor: '' },
      }),
      createdAt: new Date(this.now()).toISOString(),
      lastSeenAt: null,
      // Support access is theirs to grant, it expires, and what happened while
      // it was open is written down. See `openSupport`.
      support: null,
    };
    this.data.accounts.push(account);
    this.save();
    return safe(account);
  }

  /** Change a password, checking the old one first unless the owner is resetting it. */
  setPassword(id, password, { requireOld = null } = {}) {
    const account = this.find(id);
    if (!account) return null;
    if (requireOld !== null && !verify(account, requireOld)) throw new Error('That is not your current password.');
    checkPassword(password);
    Object.assign(account, hashPassword(password));
    // Everything signed in as them stops being signed in. A password change is
    // usually somebody worried, and half-logged-out is no use to them.
    this.data.sessions = this.data.sessions.filter((s) => s.accountId !== id);
    this.save();
    return safe(account);
  }

  /** Plan, add-ons and status. The only things a payment webhook ever touches. */
  update(id, patch = {}) {
    const account = this.find(id);
    if (!account) return null;
    if (account.role === 'owner') throw new Error('The owner account has no subscription to change.');
    if (patch.plan !== undefined) {
      if (!PLANS[patch.plan]) throw new Error(`"${patch.plan}" is not a plan.`);
      account.plan = patch.plan;
    }
    if (patch.addons !== undefined) {
      account.addons = (patch.addons || []).filter((a) => ADDONS[a]);
    }
    if (patch.status !== undefined) {
      if (!STATUSES.includes(patch.status)) throw new Error(`"${patch.status}" is not a subscription status.`);
      account.status = patch.status;
    }
    if (patch.comped !== undefined) account.comped = Boolean(patch.comped);
    if (patch.name !== undefined) account.name = String(patch.name).trim();
    if (patch.billing) account.billing = { ...account.billing, ...patch.billing };
    this.save();
    return safe(account);
  }

  /**
   * Close an account without destroying the record.
   *
   * Deleting one would take their invoice history and their packs with it, and
   * "we deleted everything the moment you stopped paying" is not something to
   * do to somebody who might come back in March.
   */
  close(id) {
    const account = this.find(id);
    if (!account) return null;
    if (account.role === 'owner') throw new Error('The owner account cannot be closed.');
    account.status = 'cancelled';
    account.comped = false;
    this.data.sessions = this.data.sessions.filter((s) => s.accountId !== id);
    this.save();
    return safe(account);
  }

  // ---------------------------------------------------------------- signing in

  /**
   * @returns {{token: string, account: object}|null}  null on any failure, with
   *   no clue as to whether it was the email or the password that was wrong.
   */
  signIn(email, password) {
    const account = this.byEmail(email);
    if (!account) {
      // Hash anyway, so a missing address does not answer faster than a wrong
      // password and quietly confirm who has an account here.
      hashPassword('not-a-real-password-just-burning-the-same-time');
      return null;
    }
    if (!verify(account, password)) return null;

    const token = newToken();
    const at = this.now();
    this.data.sessions.push({
      token: hashToken(token),
      accountId: account.id,
      startedAt: new Date(at).toISOString(),
      expiresAt: new Date(at + SESSION_DAYS * 86_400_000).toISOString(),
    });
    account.lastSeenAt = new Date(at).toISOString();
    this.sweep();
    this.save();
    return { token, account: safe(account) };
  }

  /** Who is this? `null` if the token is unknown, expired or forged. */
  fromToken(token) {
    if (!token) return null;
    const hashed = hashToken(token);
    const session = this.data.sessions.find((s) => s.token === hashed);
    if (!session) return null;
    if (Date.parse(session.expiresAt) < this.now()) return null;
    const account = this.find(session.accountId);
    return account ? safe(account) : null;
  }

  signOut(token) {
    if (!token) return false;
    const hashed = hashToken(token);
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.token !== hashed);
    if (this.data.sessions.length !== before) this.save();
    return this.data.sessions.length !== before;
  }

  /** Drop expired sessions rather than letting the file grow all year. */
  sweep() {
    const at = this.now();
    this.data.sessions = this.data.sessions.filter((s) => Date.parse(s.expiresAt) >= at);
  }

  // ------------------------------------------------------------ support access

  /**
   * Let the owner in, on the subscriber's say-so, for a while.
   *
   * Their quizzes are their own work and other quizmasters will assume the
   * worst about a competitor who can read them. "Only when you let me in, it
   * runs out on its own, and here is everything I did" is a better answer than
   * a promise — so this is opt-in, it expires, and it keeps a log the
   * subscriber can read.
   */
  openSupport(id, hours = 24) {
    const account = this.find(id);
    if (!account) return null;
    const at = this.now();
    const span = Math.max(1, Math.min(168, Math.floor(hours)));
    account.support = {
      openedAt: new Date(at).toISOString(),
      expiresAt: new Date(at + span * 3_600_000).toISOString(),
      log: (account.support && account.support.log) || [],
    };
    this.save();
    return safe(account);
  }

  closeSupport(id) {
    const account = this.find(id);
    if (!account || !account.support) return null;
    account.support = { ...account.support, expiresAt: new Date(this.now()).toISOString() };
    this.save();
    return safe(account);
  }

  supportOpen(id) {
    const account = this.find(id);
    return Boolean(account && account.support && Date.parse(account.support.expiresAt) > this.now());
  }

  /** Write down something the owner did while inside a subscriber's account. */
  noteSupport(id, what) {
    const account = this.find(id);
    if (!account || !account.support) return false;
    account.support.log = [
      ...account.support.log,
      { at: new Date(this.now()).toISOString(), what: String(what).slice(0, 200) },
    ].slice(-500);
    this.save();
    return true;
  }

  // ----------------------------------------------------------------- the gate

  /**
   * The two questions worth asking separately.
   *
   * `mayStartSomething` is the real gate: launching a game, generating, issuing
   * an invoice. `mayCarryOn` is deliberately laxer — it is what the control
   * view and the live connection ask, and it says yes even when the
   * subscription has lapsed, because a card that expired on Tuesday must not
   * black out a projector in front of ninety people on Wednesday. Sorting the
   * payment out is a thing for the morning.
   */
  mayStartSomething(account, feature) {
    return can(account, feature);
  }

  mayCarryOn(account, feature) {
    if (can(account, feature)) return true;
    if (!account || account.role === 'owner') return false;
    // Lapsed, but this is a feature their plan would otherwise cover.
    return featuresFor({ ...account, status: 'active' }).includes(feature);
  }

  view(account) {
    return { ...safe(account), entitlements: entitlements(account) };
  }
}

// --------------------------------------------------------------------- crypto

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT).toString('hex');
  return { salt, hash, scrypt: { ...SCRYPT } };
}

export function verify(account, password) {
  if (!account || !account.hash || !account.salt) return false;
  const params = account.scrypt || SCRYPT;
  let attempt;
  try {
    attempt = crypto.scryptSync(String(password ?? ''), account.salt, params.keylen || 64, params);
  } catch {
    return false;
  }
  const stored = Buffer.from(account.hash, 'hex');
  if (stored.length !== attempt.length) return false;
  return crypto.timingSafeEqual(stored, attempt);
}

/**
 * Short, but not guessable in a lifetime. Only the HASH of a token is stored,
 * so a copy of the accounts file is not a set of live sessions.
 */
export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newId() {
  return crypto.randomBytes(9).toString('base64url');
}

// ---------------------------------------------------------------------- bits

export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Long enough to be worth having. No rules about punctuation: they make people
 * write the password on the laptop and are worth less than four more letters.
 */
export function checkPassword(password) {
  const value = String(password ?? '');
  if (value.length < 10) throw new Error('A password needs to be at least 10 characters. A short sentence is ideal.');
  if (value.length > 200) throw new Error('That password is too long.');
  return true;
}

/** Never hand the hash out, not even to the owner. */
export function safe(account) {
  if (!account) return null;
  const { hash, salt, scrypt, ...rest } = account;
  return rest;
}
