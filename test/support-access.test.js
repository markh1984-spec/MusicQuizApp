/**
 * Support access — the promise, and its limits.
 *
 * A quizmaster's own material is their work, and other quizmasters will assume
 * the worst about a competitor who can read it. So the answer is not "I
 * promise not to look": it is that the app refuses until they open the door,
 * it shuts itself again, and everything done inside is written down where they
 * can read it.
 *
 * What this CANNOT promise, and it is worth being straight about in the code
 * as well as to a subscriber: the owner runs the server, the disk and the
 * backups, and the server has to be able to read a quiz to put it on a
 * projector. So this is access control and an audit trail, which is what every
 * hosted service has, rather than something cryptographic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';

function book(now = () => 1_000_000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'support-'));
  return new Accounts(path.join(dir, 'accounts.json'), { now });
}

function twoAccounts(accounts) {
  const owner = accounts.create({
    email: 'mark@x.com', password: 'a-long-test-password', name: 'Mark', role: 'owner',
  });
  const rob = accounts.create({
    email: 'rob@x.com', password: 'another-long-password', name: 'Rob', role: 'quizmaster',
  });
  return { owner, rob };
}

test('the door starts shut, and only the account holder can open it', () => {
  const accounts = book();
  const { rob } = twoAccounts(accounts);
  assert.equal(accounts.supportOpen(rob.id), false);

  accounts.openSupport(rob.id, 24);
  assert.equal(accounts.supportOpen(rob.id), true);
});

test('switching it off is instant, not a countdown', () => {
  const accounts = book();
  const { rob } = twoAccounts(accounts);
  accounts.openSupport(rob.id, 24);
  accounts.closeSupport(rob.id);
  assert.equal(accounts.supportOpen(rob.id), false, 'the door stayed open after being shut');
});

/*
 * The backstop. A plain toggle's real risk is the subscriber forgetting it is
 * on, not the owner overstaying — so a grant that nobody closes closes itself.
 */
test('a forgotten grant expires on its own', () => {
  let clock = 1_000_000;
  const accounts = book(() => clock);
  const { rob } = twoAccounts(accounts);

  accounts.openSupport(rob.id, 24);
  clock += 23 * 3_600_000;
  assert.equal(accounts.supportOpen(rob.id), true, 'it expired early');

  clock += 2 * 3_600_000;
  assert.equal(accounts.supportOpen(rob.id), false, 'a forgotten grant is still open a day later');
});

/*
 * Reads as well as writes. "Did you look at my quizzes" is the question this
 * log exists to answer, and a writes-only log is silent about exactly that.
 */
test('the log records what was done, and the subscriber can read it', () => {
  const accounts = book();
  const { rob } = twoAccounts(accounts);
  accounts.openSupport(rob.id, 24);

  accounts.noteSupport(rob.id, 'GET /api/quiz/their-own-pack');
  accounts.noteSupport(rob.id, 'PUT /api/invoices/settings');

  const theirs = accounts.view(accounts.find(rob.id));
  const what = theirs.support.log.map((r) => r.what);
  assert.deepEqual(what, ['GET /api/quiz/their-own-pack', 'PUT /api/invoices/settings']);
  assert.ok(theirs.support.log.every((r) => r.at), 'every entry is timestamped');
});

test('the log survives the door being shut and reopened', () => {
  const accounts = book();
  const { rob } = twoAccounts(accounts);
  accounts.openSupport(rob.id, 24);
  accounts.noteSupport(rob.id, 'GET /api/quiz/one');
  accounts.closeSupport(rob.id);
  accounts.openSupport(rob.id, 24);

  assert.equal(accounts.find(rob.id).support.log.length, 1,
    'closing the door wiped the record of what was done through it');
});

test('nothing is written to the log while the door is shut', () => {
  const accounts = book();
  const { rob } = twoAccounts(accounts);
  assert.equal(accounts.noteSupport(rob.id, 'GET /api/quiz/one'), false);
  assert.equal(accounts.find(rob.id).support, null);
});

/*
 * THE PROMISE, in the one place it is actually enforced.
 *
 * `whoIs()` in server.js allows an acting cookie through on one of two
 * conditions: the account is the owner's OWN linked quizmaster, or support is
 * open on it. There is no third branch, and the host key never reaches the
 * check at all because it returns BOOTSTRAP first — so holding the key does
 * not open a subscriber's account either.
 */
test('server.js has no way into an account except your own or an open door', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const branch = server.match(/const mine = hat[\s\S]{0,600}?\n\s*if \(hat &&[^\n]*\)/);
  assert.ok(branch, 'the acting branch in whoIs has been restructured — re-read this test');
  assert.match(branch[0], /accounts\.supportOpen\(hat\.id\)/,
    'support access is not checked on the way in');
  assert.match(branch[0], /hat\.ownedBy === account\.id/,
    'the own-hat check has gone, so any owner could act as anyone');
});

test('the host key cannot act as anybody, with or without a grant', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const whoIs = server.slice(server.indexOf('function whoIs('), server.indexOf('function roomForHost('));
  // The key returns the bootstrap identity before the acting cookie is ever
  // read. If that order ever flipped, a key would be a way into any account.
  assert.ok(whoIs.indexOf('isHostKey') < whoIs.indexOf('ACTING_COOKIE'),
    'the host key is now read AFTER the acting cookie — it could act as a subscriber');
});

/*
 * Support access is for between gigs. Going in mid-round is one mis-tap from
 * ending somebody's night in front of sixty people, so entry is refused while
 * their game is live AND host actions are refused for a game that starts while
 * somebody is already inside.
 */
/*
 * The log is read by somebody deciding whether they trust you, so it has to say
 * what happened rather than which endpoint was called.
 */
test('the log is written in words a subscriber would use, not route paths', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /function supportWords\(/, 'the log is back to printing raw routes');
  assert.match(server, /Looked at your pack library/);
  // Anything unmapped still gets logged rather than dropped — an ugly line
  // beats a missing one when the whole point is completeness.
  assert.match(server, /return `\$\{method\} \$\{route\}`/,
    'an unmapped route now vanishes from the log instead of falling back');
});

test('server.js refuses to enter a live game and blocks host actions inside', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /rooms\.get\(them\.id\)\.live[\s\S]{0,300}409/,
    'support access can be taken into a running game');
  assert.match(server, /SUPPORT_NEVER = \['\/api\/host\/'\]/,
    'host actions are not blocked inside a support session');
});

test('the owner cannot extend a grant from inside the session', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const route = server.slice(server.indexOf("route === '/api/me/support'"),
    server.indexOf("route === '/api/me/prefs'"));
  assert.match(route, /account\.actingAs/,
    'one grant could extend itself for ever from inside a support session');
});
