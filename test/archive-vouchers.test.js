/**
 * The filed night has to say what actually happened at the bar.
 *
 * A night is archived the instant it reaches the final scores, and the bar
 * scans the winner's QR several minutes later — so every night in the record
 * said "not used" for every prize, for ever. The live panel on the control
 * view was right and the permanent record was wrong, which is the worst way
 * round: one is a screen you glance at, the other is the evidence a
 * quizmaster shows a venue.
 *
 * The second test here is a different bug found in the same place: the flag
 * that stops a night being filed twice lived on the Session object and was
 * cleared by `build()`, which runs on BOOT — so a restart while a game sat on
 * the final scores filed the whole evening again. On a host whose disk is
 * wiped every deploy, a restart is not the unusual case.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';
import { updateArchivedNight, archiveResults } from '../src/library.js';

const QUIZ = {
  id: 'nightly', title: 'A Quiz', questionSeconds: 20,
  rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
    { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] }],
};

/** A Session with everything on disk in a folder we throw away afterwards. */
function withSession() {
  const dir = mkdtempSync(join(tmpdir(), 'archive-vouchers-'));
  let at = Date.parse('2026-08-14T22:30:00.000Z');
  const saved = [];
  // A Store the session can flush into without needing the real one.
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store,
    onPush: () => {},
    onArchive: (record) => saved.push(record),
    now: () => at,
    paths: { archive: dir },
  });
  session.build('quiz', QUIZ);
  return {
    session,
    dir,
    saved,
    tick: (ms) => { at += ms; },
    nights: () => readdirSync(dir).filter((f) => f.endsWith('.json')),
    filed: () => {
      const [file] = readdirSync(dir).filter((f) => f.endsWith('.json'));
      return JSON.parse(readFileSync(join(dir, file), 'utf8'));
    },
    done: () => { rmSync(dir, { recursive: true, force: true }); },
  };
}

/**
 * `results()` carries the vouchers as a LIST rather than a map — one row per
 * prize, which is what a record wants — so a filed night is read that way.
 */
function voucherIn(record, code) {
  const found = (record.vouchers || []).find((v) => v.code === code);
  assert.ok(found, `the filed night has no voucher ${code}`);
  return found;
}

/** Play a one-question night with a prize and somebody to win it. */
function playIt(session) {
  session.engine.state.reward = 'A free drink at the bar';
  const winner = session.engine.join({ name: 'Quizteam Aguilera' });
  session.engine.start();
  session.engine.finish();
  const [code] = Object.keys(session.engine.state.vouchers);
  return { winner, code };
}

test('A DRINK TAKEN AT THE BAR REACHES THE FILED NIGHT', () => {
  const it = withSession();
  try {
    const { code } = playIt(it.session);
    assert.equal(voucherIn(it.filed(), code).redeemedAt, null, 'nobody has been to the bar yet');

    it.tick(6 * 60_000);                       // the bar scans it six minutes later
    it.session.engine.redeemVoucher(code, { by: 'scan' });

    const after = voucherIn(it.filed(), code);
    assert.ok(after.redeemedAt, 'the permanent record still says the prize was never taken');
    assert.equal(it.nights().length, 1, 'and it is an UPDATE, not a second night');
  } finally {
    it.done();
  }
});

test('putting it back reaches the record too, and so does the reinstate count', () => {
  // "This one has been put back three times" is the signal for somebody
  // working it, and it is worth nothing if it only exists until the app
  // restarts.
  const it = withSession();
  try {
    const { code } = playIt(it.session);
    it.session.engine.redeemVoucher(code, { by: 'scan' });
    it.session.engine.reinstateVoucher(code);

    const after = voucherIn(it.filed(), code);
    assert.equal(after.redeemedAt, null);
    assert.equal(after.reinstated, 1);
  } finally {
    it.done();
  }
});

test('the updated night is BACKED UP again, or the fix only reaches this disk', () => {
  const it = withSession();
  try {
    const { code } = playIt(it.session);
    assert.equal(it.saved.length, 1, 'filed once when the night ended');
    it.session.engine.redeemVoucher(code, { by: 'scan' });
    assert.equal(it.saved.length, 2, 'and pushed again when the prize was taken');
    assert.ok(voucherIn(it.saved[1], code).redeemedAt);
  } finally {
    it.done();
  }
});

test('a night sitting on the final scores is not rewritten for nothing', () => {
  // Vouchers move rarely and pushes do not, so this compares before writing.
  const it = withSession();
  try {
    playIt(it.session);
    const before = it.saved.length;
    for (let i = 0; i < 5; i++) it.session.engine.changed();
    assert.equal(it.saved.length, before, 'an idle final screen kept rewriting the archive');
  } finally {
    it.done();
  }
});

test('A RESTART ON THE FINAL SCORES DOES NOT FILE THE NIGHT TWICE', () => {
  // The flag used to live on the Session and be cleared by build(), which runs
  // on boot — so the deploy that wipes the disk also duplicated the evening.
  const it = withSession();
  try {
    playIt(it.session);
    assert.equal(it.nights().length, 1);
    const state = JSON.parse(JSON.stringify(it.session.engine.state));

    // What a restart does: the same state, handed to a freshly built engine.
    it.session.build('quiz', QUIZ, state);
    it.session.engine.changed();

    assert.equal(it.nights().length, 1, 'the night was filed twice');
  } finally {
    it.done();
  }
});

test('updating a night that is not there says so rather than throwing', () => {
  // A night can be deleted, and a voucher moving must never be the thing that
  // takes the app down in front of a room.
  const dir = mkdtempSync(join(tmpdir(), 'archive-missing-'));
  try {
    assert.equal(updateArchivedNight(dir, 'nothing-here', { vouchers: {} }), null);
    // And a name that is not plain letters, digits and hyphens is refused
    // rather than scrubbed — the same rule the restore follows.
    archiveResults(dir, { packId: 'eighties', title: 'The Eighties', kind: 'quiz', leaderboard: [] },
      Date.parse('2026-08-11T21:30:00Z'));
    assert.equal(updateArchivedNight(dir, '../../etc/passwd', { vouchers: {} }), null);
    assert.equal(updateArchivedNight(dir, '2026-08-11-eighties', { note: 'hello' }).note, 'hello');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
