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

import { ROLES, KINDS, DEFAULT_KIND, STATUSES, TIERS, DEFAULT_TIER, findTier, tierFor, can, featuresFor, entitlements, FEATURE_TIER, switchable } from '../public/assets/plans.js';
import { findScheme, DEFAULT_SCHEME } from '../public/assets/schemes.js';

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
  create({ email, password, name = '', role = 'quizmaster', kind = DEFAULT_KIND, tier = '', plan = '', addons = [], comped = false, status = 'trialing', ownedBy = '' }) {
    const clean = normaliseEmail(email);
    if (!clean || !clean.includes('@')) throw new Error('That does not look like an email address.');
    if (this.byEmail(clean)) throw new Error('There is already an account with that email address.');
    if (!ROLES.includes(role)) throw new Error(`"${role}" is not a role.`);
    // What they ARE, as opposed to what they may do — see KINDS in plans.js.
    if (!KINDS.includes(kind)) throw new Error(`"${kind}" is not a kind of account.`);
    // One owner, and only one. A second would be a second person able to see
    // every subscriber, which is not something to create by accident.
    if (role === 'owner' && this.owner) throw new Error('There is already an owner account.');
    // `plan` and `addons` are the OLD shape and are still accepted, because a
    // backup written before the ladder existed is restored through here.
    // No tier given? Work it out from the OLD plan-and-add-ons shape, which is
    // what a backup written before the ladder existed carries. `tierFor` lands
    // on the bottom rung when there is nothing to go on.
    const wanted = tier || tierFor({ plan, addons });
    if (!TIERS.some((t) => t.id === wanted)) throw new Error(`"${wanted}" is not a tier.`);
    if (!STATUSES.includes(status)) throw new Error(`"${status}" is not a subscription status.`);
    checkPassword(password);

    const account = {
      id: newId(),
      email: clean,
      name: String(name || '').trim(),
      role,
      // Their two colours. Written on at creation rather than left undefined so
      // an account made before schemes existed and one made after read the
      // same, and so `safe()` always carries one to the browser.
      scheme: DEFAULT_SCHEME,
      ...hashPassword(password),
      // The owner's own quizmaster account. Marked so the owner page can offer
      // to switch into it, and so nothing else can: acting as somebody ELSE's
      // quizmaster is support access, which is theirs to grant and is logged —
      // a different feature from wearing your own second hat.
      ...(ownedBy ? { ownedBy } : {}),
      ...(role === 'owner' ? {} : {
        // Written on at creation rather than left absent, so an account made
        // before kinds existed and one made after read identically to
        // everything downstream. `kindOf()` still tolerates it missing,
        // because the accounts already on disk do not have it.
        kind,
        tier: wanted,
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
    // The tier IS the subscription now. `plan` and `addons` are still accepted
    // so an older console, or a script somebody wrote last month, keeps working
    // — they are simply read as a tier.
    const wantedTier = patch.tier !== undefined ? patch.tier
      : (patch.plan !== undefined || patch.addons !== undefined)
        ? tierFor({ plan: patch.plan, addons: patch.addons })
        : undefined;
    if (wantedTier !== undefined) {
      if (!TIERS.some((t) => t.id === wantedTier)) throw new Error(`"${wantedTier}" is not a tier.`);
      account.tier = wantedTier;
      // The old fields go, or an account carries two answers to one question
      // and the next person to read it picks the wrong one.
      delete account.plan;
      delete account.addons;
    }
    if (patch.status !== undefined) {
      if (!STATUSES.includes(patch.status)) throw new Error(`"${patch.status}" is not a subscription status.`);
      account.status = patch.status;
    }
    /*
     * Which packs this account can reach.
     *
     * An ENTITLEMENT, so it lives here in `update()` — the owner's method —
     * and deliberately not in `setPrefs()`, which only ever subtracts. Same
     * wall that stops a preferences payload handing out a tier.
     *
     * `null` clears it back to whatever the tier says, which is the only way
     * to undo a starter list without guessing at the tier's contents. An empty
     * ARRAY is a real answer meaning "none", and must not be confused with it.
     */
    if (patch.packs !== undefined) {
      if (patch.packs === null) delete account.packs;
      else if (!Array.isArray(patch.packs)) throw new Error('packs must be a list of pack ids, or null to follow the tier.');
      else account.packs = [...new Set(patch.packs.map((p) => String(p).slice(0, 120)).filter(Boolean))];
    }
    if (patch.comped !== undefined) account.comped = Boolean(patch.comped);
    if (patch.name !== undefined) account.name = String(patch.name).trim();
    if (patch.billing) account.billing = { ...account.billing, ...patch.billing };
    this.save();
    return safe(account);
  }

  /**
   * The two colours this account's screens wear.
   *
   * Its own method rather than a field on `update()`, because `update()` is the
   * SUBSCRIPTION — plan, add-ons, status — and it throws outright for the owner,
   * who has no subscription to change. Picking a colour is neither of those
   * things: it is yours, it is cosmetic, and the owner wants it too.
   *
   * An unknown id lands on the ordinary scheme rather than throwing. This comes
   * from a dropdown, and a colour that will not save is a strange thing to be
   * stopped by.
   */
  setScheme(id, scheme) {
    const account = this.find(id);
    if (!account) return null;
    account.scheme = findScheme(scheme);
    this.save();
    return safe(account);
  }

  /**
   * What this account chooses to LOOK at. Never what it is allowed to do.
   *
   * **This is the load-bearing distinction and the whole reason prefs are a
   * separate method from `update()`.** `update()` sets the plan, the add-ons
   * and the subscription status — what somebody has PAID for, owner only. This
   * sets which of the things they already have they want on screen, and it can
   * only ever take something away.
   *
   * So a hidden tab is a tidier console and nothing else: `allowed()` in
   * server.js never reads this, and there is a test that hiding invoicing does
   * not change a single answer `can()` gives. Get that backwards and the
   * paywall becomes a checkbox the customer ticks.
   *
   * Ids are not checked against a list of tabs on purpose — the tabs live in
   * the browser, a stale id is simply a tab that no longer exists, and an
   * account that will not save because a tab was renamed is a worse bug than
   * a leftover string.
   */
  /**
   * The receipt from a payment processor, and NOTHING else.
   *
   * Its own method for the same reason `setPrefs` is: `update()` is what a
   * webhook already talks to, and the narrower the thing a webhook can touch,
   * the smaller a bug in the signature check costs. This one writes under
   * `billing` and cannot reach a tier, a status, a role or a password —
   * changing the subscription is `update()`, and `src/billing.js` is the only
   * caller of both.
   *
   * Stored rather than interpreted: `reference` means something in the
   * processor's own dashboard and nothing here. `processor` is on it because
   * a migration runs both for a while, and "which one is actually billing this
   * person" is a question somebody will need to answer in a hurry.
   */
  setBilling(id, { processor = '', reference = '', at = 0, last = '' } = {}) {
    const account = this.find(id);
    if (!account) return null;
    account.billing = {
      processor: String(processor).slice(0, 24),
      reference: String(reference).slice(0, 120),
      at: Number(at) || 0,
      last: String(last).slice(0, 32),
    };
    this.save();
    return account.billing;
  }

  setPrefs(id, patch = {}) {
    const account = this.find(id);
    if (!account) return null;
    const prefs = { ...(account.prefs || {}) };
    /*
     * Features switched off for yourself.
     *
     * Filtered against the tier the account actually holds, so an id it was
     * never entitled to cannot be stored — not because storing one would grant
     * anything (it could not; this list only ever SUBTRACTS) but because a
     * preferences file full of features somebody never had is a thing that
     * looks meaningful to whoever reads it next.
     */
    if (patch.featuresOff !== undefined) {
      const held = new Set(featuresFor(account));
      prefs.featuresOff = [...new Set(
        (Array.isArray(patch.featuresOff) ? patch.featuresOff : [])
          .map((f) => String(f))
          // …and only ones the page actually offers a switch for. Not
          // security — this list can never grant anything, it only ever
          // subtracts — but `quiz.library` in here takes both pack tabs off
          // the console, which is a foot-gun with no obvious way back, and a
          // stale page or a curl call should not be able to set it. See
          // SWITCHABLE in plans.js for the rule about which earn a switch.
          .filter((f) => held.has(f) && FEATURE_TIER[f] && switchable(f)),
      )];
    }
    if (patch.hiddenTabs !== undefined) {
      prefs.hiddenTabs = [...new Set(
        (Array.isArray(patch.hiddenTabs) ? patch.hiddenTabs : [])
          .map((t) => String(t).slice(0, 40))
          .filter(Boolean),
      )].slice(0, 40);
    }
    account.prefs = prefs;
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

  /**
   * Start a password reset. Returns the token to put in a link, or null.
   *
   * ONLY THE HASH IS STORED, exactly like a session token — a copy of the
   * accounts file must not be a bag of live reset links. The token itself is
   * returned once, goes into one email, and is never written down here.
   *
   * NULL IS NOT AN ERROR AND THE CALLER MUST NOT SAY SO. An address with no
   * account gets the same reply as one with an account, or this becomes a way
   * to ask "who has a login here" — the same reason `signIn` burns the same
   * time on a missing address.
   *
   * It lives ON THE ACCOUNT rather than in a list of its own, and that is what
   * makes it survive a deploy: accounts are backed up and restored, and on a
   * host with no permanent disk a reset link that died the moment the app
   * restarted would fail exactly when somebody was already locked out.
   */
  startReset(email, { minutes = 30 } = {}) {
    const account = this.byEmail(email);
    if (!account) return null;
    const at = this.now();
    // One live link at a time. Asking again replaces the last one rather than
    // leaving a trail of working links behind, and the cooldown means a button
    // held down cannot post somebody a hundred emails at the owner's expense.
    const last = account.reset && Date.parse(account.reset.sentAt || 0);
    if (last && at - last < 60_000) return { account: safe(account), throttled: true };
    const token = newToken();
    account.reset = {
      token: hashToken(token),
      sentAt: new Date(at).toISOString(),
      expiresAt: new Date(at + minutes * 60_000).toISOString(),
    };
    this.save();
    return { token, account: safe(account) };
  }

  /** Who a reset token belongs to, or null if it is unknown, used or stale. */
  whoseReset(token) {
    if (!token) return null;
    const hashed = hashToken(token);
    const account = this.all.find((a) => a.reset && a.reset.token === hashed);
    if (!account) return null;
    if (Date.parse(account.reset.expiresAt) < this.now()) return null;
    return safe(account);
  }

  /**
   * Spend a reset token and set the new password.
   *
   * SINGLE USE, and cleared BEFORE the password is written — a link that still
   * worked after it had been used would sit in an inbox for ever being one
   * forwarded email away from somebody else's account. `setPassword` also drops
   * every session, so anybody already signed in as them is signed out, which is
   * what somebody who has just had to reset a password wants.
   */
  useReset(token, password) {
    const who = this.whoseReset(token);
    if (!who) return null;
    const account = this.find(who.id);
    /*
     * CHECKED BEFORE THE LINK IS SPENT.
     *
     * The obvious order — clear the token, then set the password — burns the
     * link on a typo: too short, `setPassword` throws, and the only way back
     * into the account has already gone. Somebody doing this is locked out
     * already, so that is the one mistake here that cannot be recovered from.
     * Caught by its own test.
     */
    checkPassword(password);
    delete account.reset;
    return this.setPassword(account.id, password);
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
  /**
   * @param {string} id
   * @param {number} [minutes]  how long THIS stretch lasts. Minutes, not hours,
   *   because the window is a dead man's switch rather than a booking: it runs
   *   out fast on purpose and the subscriber keeps it alive by saying they
   *   still need help. Forgetting is meant to close it.
   */
  openSupport(id, minutes = 30) {
    const account = this.find(id);
    if (!account) return null;
    const at = this.now();
    const span = Math.max(5, Math.min(1440, Math.floor(minutes)));
    account.support = {
      openedAt: (account.support && account.support.openedAt) || new Date(at).toISOString(),
      // Reset every time they confirm, so the countdown starts again rather
      // than the grant having one fixed end whatever they do.
      expiresAt: new Date(at + span * 60_000).toISOString(),
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
