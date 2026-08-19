/**
 * Accounts.
 *
 * Three things are worth being certain about: a password is never recoverable
 * from what is stored, a session cannot be forged, and a failed payment cannot
 * black out a projector in front of a room.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts, verify, hashPassword, checkPassword, normaliseEmail, safe } from '../src/accounts.js';
import { FEATURES, can, featuresFor, activeFeatures } from '../public/assets/plans.js';

const AT = Date.parse('2026-08-07T20:00:00.000Z');

function withBook(fn, now = () => AT) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-'));
  try {
    return fn(new Accounts(path.join(dir, 'accounts.json'), { now }), path.join(dir, 'accounts.json'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const PASSWORD = 'a horse walked into a pub';

// ----------------------------------------------------------------- passwords

test('a password is stored as a hash and a salt, never as itself', () => {
  withBook((book, file) => {
    book.create({ email: 'Mark@Example.com ', password: PASSWORD, name: 'Mark', role: 'owner' });
    const raw = fs.readFileSync(file, 'utf8');
    assert.equal(raw.includes(PASSWORD), false, 'the password must not be in the file');
    assert.ok(raw.includes('"hash"') && raw.includes('"salt"'));
  });
});

test('two accounts with the same password get different hashes', () => {
  const a = hashPassword(PASSWORD);
  const b = hashPassword(PASSWORD);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash, 'a shared salt would let one crack reveal both');
  assert.equal(verify({ ...a }, PASSWORD), true);
  assert.equal(verify({ ...b }, PASSWORD), true);
});

test('a wrong password is refused, and so is a corrupted record', () => {
  const stored = hashPassword(PASSWORD);
  assert.equal(verify(stored, 'a horse walked into a bar'), false);
  assert.equal(verify(stored, ''), false);
  assert.equal(verify(stored, undefined), false);
  assert.equal(verify({ hash: 'nonsense', salt: stored.salt }, PASSWORD), false);
  assert.equal(verify(null, PASSWORD), false);
});

test('a short password is refused, with a suggestion rather than a rule', () => {
  assert.throws(() => checkPassword('short'), /at least 10 characters/);
  assert.throws(() => checkPassword(''), /at least 10 characters/);
  assert.equal(checkPassword(PASSWORD), true);
  // No punctuation rules: they get written on the laptop lid.
  assert.equal(checkPassword('correct horse battery'), true);
});

test('the hash never leaves the building, even to the owner', () => {
  withBook((book) => {
    const account = book.create({ email: 'a@b.com', password: PASSWORD });
    assert.equal(account.hash, undefined);
    assert.equal(account.salt, undefined);
    assert.equal(book.view(account).hash, undefined);
    assert.equal(safe({ id: '1', hash: 'x', salt: 'y', scrypt: {}, email: 'a' }).hash, undefined);
  });
});

// ------------------------------------------------------------------ accounts

test('an email address is one address however it was typed', () => {
  assert.equal(normaliseEmail('  Mark@Example.COM '), 'mark@example.com');
  withBook((book) => {
    book.create({ email: 'mark@example.com', password: PASSWORD });
    assert.throws(() => book.create({ email: ' MARK@example.com ', password: PASSWORD }), /already an account/);
    assert.ok(book.byEmail('Mark@Example.com'));
  });
});

test('there can only ever be one owner', () => {
  withBook((book) => {
    book.create({ email: 'owner@example.com', password: PASSWORD, role: 'owner' });
    assert.throws(() => book.create({ email: 'other@example.com', password: PASSWORD, role: 'owner' }), /already an owner/);
    // A quizmaster is fine, as many as you like.
    book.create({ email: 'dave@example.com', password: PASSWORD });
    book.create({ email: 'sue@example.com', password: PASSWORD });
    assert.equal(book.all.filter((a) => a.role === 'quizmaster').length, 2);
  });
});

test('rubbish is refused rather than stored', () => {
  withBook((book) => {
    assert.throws(() => book.create({ email: 'not-an-email', password: PASSWORD }), /does not look like an email/);
    assert.throws(() => book.create({ email: 'a@b.com', password: PASSWORD, role: 'wizard' }), /is not a role/);
    assert.throws(() => book.create({ email: 'a@b.com', password: PASSWORD, tier: 'platinum' }), /is not a tier/);
    assert.throws(() => book.create({ email: 'a@b.com', password: PASSWORD, status: 'maybe' }), /is not a subscription status/);
    assert.equal(book.all.length, 0);
  });
});

test('an owner account has no subscription to change', () => {
  withBook((book) => {
    const owner = book.create({ email: 'owner@example.com', password: PASSWORD, role: 'owner' });
    assert.equal(owner.tier, undefined);
    assert.equal(owner.status, undefined);
    assert.throws(() => book.update(owner.id, { status: 'past_due' }), /no subscription/);
    assert.throws(() => book.close(owner.id), /cannot be closed/);
  });
});

// ------------------------------------------------------------------ signing in

test('signing in gives a token that identifies the account', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, name: 'Dave' });
    const session = book.signIn('DAVE@example.com', PASSWORD);
    assert.ok(session.token);
    assert.equal(session.account.id, made.id);
    assert.equal(book.fromToken(session.token).id, made.id);
  });
});

test('a wrong password and an unknown address both just fail', () => {
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    assert.equal(book.signIn('dave@example.com', 'wrong password here'), null);
    assert.equal(book.signIn('nobody@example.com', PASSWORD), null);
  });
});

test('only the hash of a token is stored, so the file is not a set of live logins', () => {
  withBook((book, file) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const { token } = book.signIn('dave@example.com', PASSWORD);
    assert.equal(fs.readFileSync(file, 'utf8').includes(token), false);
  });
});

test('a made-up token is nobody', () => {
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    book.signIn('dave@example.com', PASSWORD);
    assert.equal(book.fromToken('made-up'), null);
    assert.equal(book.fromToken(''), null);
    assert.equal(book.fromToken(null), null);
  });
});

test('a session runs out, and an expired one is nobody', () => {
  let now = AT;
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const { token } = book.signIn('dave@example.com', PASSWORD);
    now = AT + 29 * 86_400_000;
    assert.ok(book.fromToken(token), 'still signed in after 29 days');
    now = AT + 31 * 86_400_000;
    assert.equal(book.fromToken(token), null, 'and not after 31');
  }, () => now);
});

test('signing out ends that session and only that one', () => {
  withBook((book) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const phone = book.signIn('dave@example.com', PASSWORD);
    const laptop = book.signIn('dave@example.com', PASSWORD);
    book.signOut(phone.token);
    assert.equal(book.fromToken(phone.token), null);
    assert.ok(book.fromToken(laptop.token), 'the laptop is still signed in');
  });
});

test('changing a password signs everything out', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    const phone = book.signIn('dave@example.com', PASSWORD);
    const laptop = book.signIn('dave@example.com', PASSWORD);

    assert.throws(() => book.setPassword(made.id, 'a new long password', { requireOld: 'wrong one here' }), /not your current password/);
    book.setPassword(made.id, 'a new long password', { requireOld: PASSWORD });

    assert.equal(book.fromToken(phone.token), null, 'half signed out is no use to somebody worried');
    assert.equal(book.fromToken(laptop.token), null);
    assert.equal(book.signIn('dave@example.com', PASSWORD), null);
    assert.ok(book.signIn('dave@example.com', 'a new long password'));
  });
});

test('accounts and sessions survive a restart', () => {
  withBook((book, file) => {
    book.create({ email: 'dave@example.com', password: PASSWORD });
    const { token } = book.signIn('dave@example.com', PASSWORD);

    const reopened = new Accounts(file, { now: () => AT });
    assert.equal(reopened.all.length, 1);
    assert.ok(reopened.fromToken(token), 'a redeploy must not sign everybody out mid-week');
  });
});

test('an unreadable accounts file is kept, never overwritten', () => {
  withBook((book, file) => {
    fs.writeFileSync(file, '{ not json at all');
    const reopened = new Accounts(file, { now: () => AT });
    assert.deepEqual(reopened.all, []);
    assert.equal(fs.existsSync(file + '.broken'), true);
  });
});

// ------------------------------------------------------- the gate on the night

test('a failed payment never blacks out a live projector', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'active' });
    const account = book.view(book.find(made.id));
    assert.equal(book.mayStartSomething(account, FEATURES.QUIZ), true);

    // The card expires on the Tuesday. It is now Wednesday, and there are
    // ninety people in the room.
    book.update(made.id, { status: 'past_due' });
    const lapsed = safe(book.find(made.id));

    assert.equal(book.mayStartSomething(lapsed, FEATURES.QUIZ), false, 'no NEW night starts');
    assert.equal(book.mayCarryOn(lapsed, FEATURES.QUIZ), true, 'but the one already running carries on');
    assert.equal(book.mayCarryOn(lapsed, FEATURES.BINGO), true);
  });
});

test('carrying on is not a way round the paywall', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'past_due' });
    const lapsed = safe(book.find(made.id));
    // Never had the add-on, so a lapse does not hand it over.
    assert.equal(book.mayCarryOn(lapsed, FEATURES.ADVERTS), false);
    assert.equal(book.mayCarryOn(lapsed, FEATURES.GENERATE), false);
    assert.equal(book.mayCarryOn(lapsed, FEATURES.STREAM), false);
  });
});

test('closing an account keeps the record', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'active' });
    const { token } = book.signIn('dave@example.com', PASSWORD);
    book.close(made.id);
    assert.equal(book.find(made.id).status, 'cancelled');
    assert.equal(book.all.length, 1, 'their invoices and packs still belong to somebody');
    assert.equal(book.fromToken(token), null, 'but they are signed out');
  });
});

// --------------------------------------------------------------- support access

test('support access is theirs to grant, and it runs out on its own', () => {
  let now = AT;
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    assert.equal(book.supportOpen(made.id), false, 'shut unless they open it');

    book.openSupport(made.id, 24);
    assert.equal(book.supportOpen(made.id), true);

    now = AT + 25 * 3_600_000;
    assert.equal(book.supportOpen(made.id), false, 'nobody has to remember to close it');
  }, () => now);
});

test('what was done while inside is written down for them to read', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    book.openSupport(made.id);
    book.noteSupport(made.id, 'Opened the 1990s quiz to look at round 2');
    book.noteSupport(made.id, 'Fixed the answer on question 7');

    const log = book.find(made.id).support.log;
    assert.equal(log.length, 2);
    assert.match(log[1].what, /Fixed the answer/);
    assert.ok(log[0].at);
  });
});

test('support can be shut early, and the log survives it', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    book.openSupport(made.id);
    book.noteSupport(made.id, 'had a look');
    book.closeSupport(made.id);
    assert.equal(book.supportOpen(made.id), false);
    assert.equal(book.find(made.id).support.log.length, 1);
  });
});

// ---------------------------------------------------------------- the payments

test('an account carries a payment reference and nothing else', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD });
    book.update(made.id, { billing: { customerRef: 'cus_123', processor: 'stripe' } });
    const account = book.find(made.id);
    assert.equal(account.billing.customerRef, 'cus_123');
    // Swapping processor must never need a migration, so nothing else is stored.
    assert.deepEqual(Object.keys(account.billing).sort(), ['customerRef', 'processor']);
  });
});

/*
 * The ladder: Bronze, Silver, Gold, and they stack. Moving somebody up gives
 * them everything below the new tier as well, which is the whole structure.
 */
test('the tier is the subscription, and the tiers stack', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, status: 'active' });
    assert.equal(book.find(made.id).tier, 'bronze', 'a new account starts on the bottom rung');
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.QUIZ), true);
    // Invoicing is Bronze now — the tiers separate on quiz-app functionality,
    // not on business tools — so an advert slide is what a bottom rung lacks.
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.INVOICES), true);
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.ADVERTS), false);

    book.update(made.id, { tier: 'silver' });
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.ADVERTS), true);
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.QUIZ), true, 'silver lost bronze');
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.STREAM), false);

    book.update(made.id, { tier: 'gold' });
    for (const f of [FEATURES.QUIZ, FEATURES.ADVERTS, FEATURES.STREAM]) {
      assert.equal(book.mayStartSomething(safe(book.find(made.id)), f), true, `gold is missing ${f}`);
    }

    book.update(made.id, { tier: 'bronze' });
    assert.equal(book.mayStartSomething(safe(book.find(made.id)), FEATURES.ADVERTS), false);
    assert.throws(() => book.update(made.id, { tier: 'platinum' }), /is not a tier/);
  });
});

/*
 * An account written before the ladder existed is sitting on disk and in a
 * backup. A subscriber silently dropping to Bronze because a field was renamed
 * is not a migration, it is a bug with a bill attached.
 */
test('an account on the old plan-and-add-ons shape reads as the right tier', () => {
  withBook((book) => {
    const admin = book.create({ email: 'a@example.com', password: PASSWORD, plan: 'basic', addons: ['admin'], status: 'active' });
    assert.equal(book.find(admin.id).tier, 'silver', 'the admin add-on was Silver');
    const stream = book.create({ email: 'b@example.com', password: PASSWORD, plan: 'basic', addons: ['admin', 'stream'], status: 'active' });
    assert.equal(book.find(stream.id).tier, 'gold', 'streaming was the top of the ladder');
    const plain = book.create({ email: 'c@example.com', password: PASSWORD, plan: 'basic', addons: [], status: 'active' });
    assert.equal(book.find(plain.id).tier, 'bronze');
  });
});

// Two answers to one question is how the next person to read the file picks
// the wrong one.
test('moving a tier clears the old plan and add-on fields', () => {
  withBook((book) => {
    const made = book.create({ email: 'dave@example.com', password: PASSWORD, plan: 'basic', addons: ['admin'], status: 'active' });
    book.update(made.id, { tier: 'gold' });
    const account = book.find(made.id);
    assert.equal(account.tier, 'gold');
    assert.equal(account.plan, undefined);
    assert.equal(account.addons, undefined);
  });
});


/*
 * Surviving a deploy.
 *
 * On a host with no permanent disk `data/` is empty on every boot, so a backup
 * that is only ever WRITTEN is the same as no backup at all: the login you made
 * last week has quietly stopped existing and the only clue is being asked to
 * sign in again.
 */
test('a wiped disk gets its accounts back from the backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-restore-'));
  try {
    const file = path.join(dir, 'accounts.json');
    const book = new Accounts(file);
    book.create({ email: 'mark@example.com', password: 'testpassword123', name: 'Mark', role: 'owner' });
    book.create({ email: 'rob@example.com', password: 'robpassword123', name: 'Rob' });
    const backup = book.serialise();

    fs.rmSync(file);                       // the deploy
    const fresh = new Accounts(file);
    assert.equal(fresh.all.length, 0);

    assert.equal(fresh.restore(backup).ok, true);
    assert.equal(fresh.all.length, 2);
    // The passwords have to still work, or the restore was decorative.
    assert.ok(fresh.signIn('rob@example.com', 'robpassword123'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a restore never runs over accounts that are already here', () => {
  // Reading a backup over live data would sign everybody out and could roll a
  // password change back to the one before it. The disk always wins.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-restore-'));
  try {
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'mark@example.com', password: 'testpassword123', name: 'Mark', role: 'owner' });
    const result = book.restore(JSON.stringify({ accounts: [{ id: 'x', email: 'someone@else.com' }] }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'already_have_accounts');
    assert.equal(book.all.length, 1);
    assert.equal(book.all[0].email, 'mark@example.com');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrupt or empty backup is refused rather than believed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-restore-'));
  try {
    const book = new Accounts(path.join(dir, 'accounts.json'));
    assert.equal(book.restore('not json at all').ok, false);
    assert.equal(book.restore(JSON.stringify({ accounts: [] })).ok, false);
    assert.equal(book.restore('{}').ok, false);
    assert.equal(book.all.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------- colours and preferences

/*
 * THE ONE THAT MATTERS ON THE MY ACCOUNT PAGE.
 *
 * That page shows two things side by side: what you are subscribed to, and
 * which tabs you want on screen. They look similar and they are nothing alike
 * — one is what you have paid for and one is what you feel like looking at. If
 * a preference could ever grant a feature, the paywall would be a tick box the
 * customer ticks for themselves.
 *
 * So: hide every tab there is, then check the account can do exactly what it
 * could before. `allowed()` in server.js never reads prefs, and this is the
 * test that fails if somebody ever wires it up.
 */
test('switching a feature off never changes what the tier includes', () => {
  withBook((book) => {
    const made = book.create({ email: 'rob@example.com', password: PASSWORD, name: 'Rob', tier: 'silver', status: 'active' });
    const before = book.find(made.id);

    book.setPrefs(made.id, {
      featuresOff: [FEATURES.INVOICES, FEATURES.PHOTOS, FEATURES.ADVERTS, FEATURES.QUIZ],
    });

    const after = book.find(made.id);
    assert.equal(after.tier, before.tier, 'a switch changed the tier');
    assert.equal(after.status, before.status);
    assert.equal(after.comped, before.comped);
    assert.equal(after.role, before.role);
    // ENTITLEMENT is untouched — this is what the server gate asks, and it is
    // why a switch cannot lock somebody out of their own gig.
    assert.equal(can(after, FEATURES.INVOICES), true, 'switching invoicing off took the tier away');
    assert.equal(can(after, FEATURES.QUIZ), true);
    // …while what is ON is a strict subset of it.
    assert.ok(!activeFeatures(after).includes(FEATURES.INVOICES));
    assert.ok(featuresFor(after).includes(FEATURES.INVOICES));
    for (const f of activeFeatures(after)) {
      assert.ok(featuresFor(after).includes(f), `${f} is on but not entitled`);
    }
  });
});

test('a preference cannot smuggle in a feature the tier does not include', () => {
  withBook((book) => {
    const made = book.create({ email: 'rob@example.com', password: PASSWORD, name: 'Rob', tier: 'bronze', status: 'active' });
    // Nothing in this shape is read as an entitlement, whatever it is called —
    // and a feature above the tier cannot even be STORED as switched off.
    book.setPrefs(made.id, {
      featuresOff: [FEATURES.STREAM, FEATURES.ADVERTS],
      tier: 'gold', addons: ['admin'], plan: 'basic', comped: true, status: 'active', role: 'owner',
    });
    const after = book.find(made.id);
    assert.equal(after.tier, 'bronze', 'setPrefs moved the tier');
    assert.equal(after.comped, false);
    assert.equal(after.role, 'quizmaster');
    assert.deepEqual(after.prefs.featuresOff, [], 'a feature above the tier was stored');
    assert.equal(can(after, FEATURES.ADVERTS), false, 'a preference bought a tier');
    assert.equal(can(after, FEATURES.STREAM), false);
    assert.equal(can(after, FEATURES.CATALOGUE), false);
  });
});

// Switching one off and back on has to actually come back, and a duplicate or
// an id from a tier they have since dropped must not linger.
test('switched-off features are deduplicated and kept to what is held', () => {
  withBook((book) => {
    const made = book.create({ email: 'rob@example.com', password: PASSWORD, tier: 'silver', status: 'active' });
    const saved = book.setPrefs(made.id, {
      featuresOff: [FEATURES.INVOICES, FEATURES.INVOICES, FEATURES.STREAM, 'made.up'],
    });
    assert.deepEqual(saved.prefs.featuresOff, [FEATURES.INVOICES]);
    assert.deepEqual(book.setPrefs(made.id, { featuresOff: [] }).prefs.featuresOff, []);
    assert.equal(activeFeatures(book.find(made.id)).includes(FEATURES.INVOICES), true, 'it did not come back');
  });
});

test('a colour is yours, and an unknown one lands on the ordinary scheme', () => {
  withBook((book) => {
    const made = book.create({ email: 'rob@example.com', password: PASSWORD });
    assert.equal(made.scheme, 'sunset', 'a new account has no colour at all');
    assert.equal(book.setScheme(made.id, 'ultra').scheme, 'ultra');
    // From a dropdown, so a value that is not on the list is not worth an error.
    assert.equal(book.setScheme(made.id, 'chartreuse').scheme, 'sunset');
  });
});

// The owner has no subscription, so `update()` throws for them outright — but
// a colour is not a subscription and the owner wants one too.
test('the owner can pick a colour even though they have no plan to change', () => {
  withBook((book) => {
    const owner = book.create({ email: 'mark@example.com', password: PASSWORD, role: 'owner' });
    assert.throws(() => book.update(owner.id, { plan: 'basic' }));
    assert.equal(book.setScheme(owner.id, 'lagoon').scheme, 'lagoon');
    assert.equal(book.setPrefs(owner.id, { hiddenTabs: ['past'] }).prefs.hiddenTabs[0], 'past');
  });
});

/*
 * A SIGN-IN THAT IS NOT BACKED UP IS A SIGN-IN THAT DIES ON THE NEXT DEPLOY.
 *
 * `restore()` deliberately keeps sessions — the comment there says dropping
 * them would sign the whole room out on every restart. But nothing pushed a
 * backup when somebody signed IN, so the file in the private repo was the one
 * written the last time an ACCOUNT changed, weeks earlier, with no sessions in
 * it at all. On a host with no permanent disk that is the same as not keeping
 * them: the cookie in the browser pointed at a token the restored file had
 * never seen, and every route answered 401.
 *
 * It cost a live test on a gig day — a deploy landed between Launch and the
 * first press on the control view. The route fix is one awaited
 * `backUpAccounts()`; this pins the property it relies on.
 */
test('a backup taken BEFORE a sign-in cannot carry that session', () => {
  withBook((book) => {
    book.create({ email: 'rob@example.com', password: PASSWORD });
    const stale = book.serialise();
    const session = book.signIn('rob@example.com', PASSWORD);
    assert.ok(session && session.token, 'signed in');
    assert.ok(book.fromToken(session.token), 'the token works on the machine that issued it');

    // The deploy: an empty disk, and the older backup read back into it.
    withBook((after) => {
      assert.equal(after.restore(stale).ok, true);
      assert.equal(after.fromToken(session.token), null,
        'this is the 401 — the cookie survived the deploy and the session did not');
    });
  });
});

test('a backup taken AFTER a sign-in carries it through a deploy', () => {
  withBook((book) => {
    book.create({ email: 'rob@example.com', password: PASSWORD });
    const session = book.signIn('rob@example.com', PASSWORD);
    // What the route now does: serialise AFTER the session exists.
    const fresh = book.serialise();
    assert.equal(JSON.parse(fresh).sessions.length, 1, 'the backup contains the session');

    withBook((after) => {
      assert.equal(after.restore(fresh).ok, true);
      const who = after.fromToken(session.token);
      assert.ok(who, 'the same cookie still works on the other side of a deploy');
      assert.equal(who.email, 'rob@example.com');
    });
  });
});

/*
 * And the ROUTE has to be the thing that does it, or the property above is
 * true of a function nobody calls at the right moment. A grep, in the style of
 * the invoice-gate test: it is the ORDER that matters — the backup has to be
 * awaited before the reply goes out, so the session is in the repository
 * before the browser has the cookie.
 */
test('the sign-in and sign-out routes back the accounts up', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  for (const route of ['/api/sign-in', '/api/sign-out']) {
    const at = server.indexOf(`if (route === '${route}' && req.method === 'POST')`);
    assert.ok(at > 0, `${route} has moved`);
    const body = server.slice(at, at + 2600);
    const backup = body.indexOf('await backUpAccounts()');
    const reply = body.indexOf('sendJson(res, 200');
    assert.ok(backup > 0, `${route} does not back the accounts up — a deploy will sign everybody out`);
    assert.ok(backup < reply, `${route} replies before backing up, so the cookie can outlive the record of it`);
  }
});

/* ------------------------------------------------------- pinned packs */

/**
 * A PIN IS PER ACCOUNT, AND IT IS THE STATE RATHER THAN THE ICON THAT MATTERS.
 *
 * Somebody pins a pack on the laptop before a gig and reaches for it on the
 * phone in the pub. A pin that lived on the device would be missing at exactly
 * that moment, which is why this is on the account beside `hiddenTabs` rather
 * than in `localStorage` with the fold state.
 */
test('PINNED PACKS ARE KEPT ON THE ACCOUNT, deduplicated and capped', () => {
  withBook((book) => {
    const made = book.create({ email: 'pin@example.com', password: PASSWORD, name: 'Pin', tier: 'bronze', status: 'active' });

    book.setPrefs(made.id, { pinnedPacks: ['eighties', 'eighties', 'motown'] });
    assert.deepEqual(book.find(made.id).prefs.pinnedPacks, ['eighties', 'motown'],
      'the same pack pinned twice should be one pin');

    // A runaway client must not write an unbounded list into the account file.
    book.setPrefs(made.id, { pinnedPacks: Array.from({ length: 200 }, (_, i) => `p${i}`) });
    assert.ok(book.find(made.id).prefs.pinnedPacks.length <= 24,
      'the pin list is not capped');

    // Unpinning everything is a real state, not a no-op.
    book.setPrefs(made.id, { pinnedPacks: [] });
    assert.deepEqual(book.find(made.id).prefs.pinnedPacks, []);
  });
});

test('a pin does not grant anything, and nothing else moves with it', () => {
  // The same guarantee every other pref carries: it decides what is in reach
  // on a shelf, never what somebody may run.
  withBook((book) => {
    const made = book.create({ email: 'pin2@example.com', password: PASSWORD, name: 'Pin', tier: 'bronze', status: 'active' });
    const before = book.find(made.id);
    book.setPrefs(made.id, { pinnedPacks: ['anything-at-all'] });
    const after = book.find(made.id);
    assert.equal(after.tier, before.tier);
    assert.equal(after.status, before.status);
    assert.equal(after.role, before.role);
  });
});

test('a pin for a pack that no longer exists is simply ignored', () => {
  /*
   * Deliberately NOT validated against the library — that would mean the
   * accounts file knowing about packs, and it would go stale the moment one
   * was deleted anyway. A pin that matches nothing is a pin that matches
   * nothing; the shelf sorts by it and finds no card.
   */
  withBook((book) => {
    const made = book.create({ email: 'pin3@example.com', password: PASSWORD, name: 'Pin', tier: 'bronze', status: 'active' });
    book.setPrefs(made.id, { pinnedPacks: ['a-pack-that-was-deleted'] });
    assert.deepEqual(book.find(made.id).prefs.pinnedPacks, ['a-pack-that-was-deleted']);
  });
});

// ----------------------------------------------------------------- the trial

/*
 * There is no background job in this app to come back and flip a status
 * later, so `trialEndsAt` is written once and everything that gates a
 * feature checks it live — see `trialExpired()` in plans.js.
 */
test('an ordinary trialing account gets 14 days, written once at creation', () => {
  withBook((book) => {
    const made = book.create({ email: 'rob@example.com', password: PASSWORD, name: 'Rob' });
    assert.equal(made.status, 'trialing');
    const days = Math.round((Date.parse(made.trialEndsAt) - AT) / 86_400_000);
    assert.equal(days, 14);
  });
});

test('a referred signup gets 28 days, not 14', () => {
  withBook((book) => {
    const referrer = book.create({ email: 'referrer@example.com', password: PASSWORD, name: 'Referrer' });
    const made = book.create({ email: 'referred@example.com', password: PASSWORD, name: 'Referred', referredBy: referrer.id });
    const days = Math.round((Date.parse(made.trialEndsAt) - AT) / 86_400_000);
    assert.equal(days, 28);
    assert.equal(made.referredBy, referrer.id);
  });
});

test('a referral code that matches nobody is dropped, not thrown on', () => {
  withBook((book) => {
    const made = book.create({ email: 'rob@example.com', password: PASSWORD, name: 'Rob', referredBy: 'acc_nonexistent' });
    assert.equal(made.referredBy, '');
    const days = Math.round((Date.parse(made.trialEndsAt) - AT) / 86_400_000);
    assert.equal(days, 14, 'a bad code must not silently grant the bonus');
  });
});

test('a comped account gets no trial clock at all', () => {
  withBook((book) => {
    const made = book.create({ email: 'gifted@example.com', password: PASSWORD, name: 'Gifted', comped: true });
    assert.equal(made.status, 'active');
    assert.equal(made.trialEndsAt, undefined);
  });
});

test('featuresFor treats an expired trial as nothing paid, and an unexpired one as everything the tier gives', () => {
  // `featuresFor` -> `trialExpired` reads the REAL clock (this is ordinary
  // wall-clock gating, not scoring — there is no injected `now` to thread
  // through it), so the fixture has to sit relative to Date.now() rather
  // than the fixed historical `AT` this file uses elsewhere for the store.
  const account = { role: 'quizmaster', status: 'trialing', tier: 'bronze', trialEndsAt: new Date(Date.now() + 86_400_000).toISOString() };
  assert.ok(featuresFor(account).length > 0, 'a trial with a day left should still work');
  assert.equal(featuresFor({ ...account, trialEndsAt: new Date(Date.now() - 1000).toISOString() }).length, 0,
    'a trial that ended a second ago should not');
});

test('a comped or genuinely paying account is never touched by trial expiry', () => {
  assert.ok(featuresFor({ role: 'quizmaster', status: 'trialing', comped: true, tier: 'gold', trialEndsAt: new Date(0).toISOString() }).length > 0);
  assert.ok(featuresFor({ role: 'quizmaster', status: 'active', tier: 'bronze' }).length > 0, 'status active has no clock at all');
});

// --------------------------------------------------------------- referral credit

/*
 * 20% of what a referral is actually paying, added up, and it must count
 * ONLY somebody genuinely paying — a referral still on their own trial has
 * not converted yet, and crediting the referrer for it would be paying out
 * on money that was never taken.
 */
test('referral credit is 20% of what a referred, PAYING account is on — nothing for a trialing one', () => {
  withBook((book) => {
    const referrer = book.create({ email: 'referrer@example.com', password: PASSWORD, name: 'Referrer' });
    const stillTrialing = book.create({ email: 'a@example.com', password: PASSWORD, name: 'A', referredBy: referrer.id });
    assert.equal(book.referralCredit(referrer.id), 0, 'nobody referred has started paying yet');

    book.update(stillTrialing.id, { status: 'active', tier: 'silver' });
    // Silver is 2000 pence — 20% is 400.
    assert.equal(book.referralCredit(referrer.id), 400);
  });
});

test('referral credit adds up across more than one referred, paying account', () => {
  withBook((book) => {
    const referrer = book.create({ email: 'referrer@example.com', password: PASSWORD, name: 'Referrer' });
    const a = book.create({ email: 'a@example.com', password: PASSWORD, name: 'A', referredBy: referrer.id });
    const b = book.create({ email: 'b@example.com', password: PASSWORD, name: 'B', referredBy: referrer.id });
    book.update(a.id, { status: 'active', tier: 'bronze' }); // 1000 * 0.2 = 200
    book.update(b.id, { status: 'active', tier: 'gold' });   // 3000 * 0.2 = 600
    assert.equal(book.referralCredit(referrer.id), 800);
  });
});

test('an account referred by nobody earns nothing for anybody', () => {
  withBook((book) => {
    const referrer = book.create({ email: 'referrer@example.com', password: PASSWORD, name: 'Referrer' });
    book.create({ email: 'independent@example.com', password: PASSWORD, name: 'Independent', tier: 'gold', status: 'active' });
    assert.equal(book.referralCredit(referrer.id), 0);
  });
});
