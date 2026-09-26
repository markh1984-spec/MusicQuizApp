/**
 * A VOUCHER CHANGE GOES TO DISK THIS INSTANT — a redeem, a reinstate, a code
 * carried across a part boundary.
 *
 * The bar scans a QR and the live state waited the debounce's 250ms, while
 * the ARCHIVE copy was written at once. A hard crash inside that window came
 * back with the live voucher unredeemed and the filed one redeemed, and the
 * next scan answered 200: a drink paid twice — O22 of the 23 September 2026
 * launch-path sweep. Rule 7's test is "does this move the night forward", and
 * a drink leaving the bar does. So the vouchers are part of the milestone on
 * both engines (`voucherMark()` in session.js), the way bingo's marks already
 * are: nobody can un-pour a pint any more than re-tick ten songs.
 *
 * A REAL `Store`, never a stub — the debounce is the fault.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';
import { Store } from '../src/store.js';

function writePacks(dir) {
  writeFileSync(join(dir, 'quiz-a.json'), JSON.stringify({
    id: 'quiz-a', title: 'Quiz A', questionSeconds: 20, showRules: false,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  }));
  writeFileSync(join(dir, 'bingo-a.json'), JSON.stringify({
    id: 'bingo-a', title: 'Bingo A', cardSize: 4,
    tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` })),
  }));
}

function withDiskSession() {
  const dir = mkdtempSync(join(tmpdir(), 'voucher-flush-'));
  writePacks(dir);
  let at = Date.parse('2026-09-24T21:00:00.000Z');
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store: new Store(join(dir, 'state.json')),
    onPush: () => {},
    onArchive: () => {},
    now: () => at,
    paths: { archive: join(dir, 'archive') },
  });
  return {
    session,
    dir,
    tick: (ms) => { at += ms; },
    // What is on DISK right now — never what is in memory.
    onDisk: () => JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')),
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** A code in somebody's hand, as either engine mints one. */
function seedVoucher(session, code, playerId) {
  session.engine.state.vouchers = {
    ...(session.engine.state.vouchers || {}),
    [code]: { code, playerId, reward: 'A pint', place: 1, issuedAt: 1, redeemedAt: null, reinstated: 0, history: [] },
  };
}

for (const kind of ['quiz', 'bingo']) {
  test(`${kind}: a redeem and a reinstate are on disk before the request answers`, () => {
    const it = withDiskSession();
    try {
      it.session.launch(kind, `${kind}-a`, {});
      const player = it.session.engine.join({ name: 'Table One' });
      seedVoucher(it.session, 'QWER', player.id);
      it.tick(1000);
      const redeemed = it.session.engine.redeemVoucher('QWER', { by: 'scan' });
      assert.ok(redeemed.ok, 'the seeded voucher would not redeem');
      assert.ok(it.onDisk().vouchers.QWER.redeemedAt,
        'the bar scanned the code and the disk still says it is unredeemed — a crash now pays the drink twice');

      it.tick(1000);
      assert.ok(it.session.engine.reinstateVoucher('QWER').ok);
      assert.equal(it.onDisk().vouchers.QWER.redeemedAt, null,
        'the host put the code back and the disk still says it is spent');
    } finally {
      it.done();
    }
  });
}

test('a voucher carried across a part boundary is on disk with the new part', () => {
  const it = withDiskSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a' },
    ], { rewards: ['A pint'] });
    const player = it.session.engine.join({ name: 'Table One' });
    // Play the one question, correctly, to the round board: the pause the
    // boundary leans on, and the board `issueVouchers()` pays from.
    it.session.engine.next();
    if (it.session.engine.state.phase === 'rules') it.session.engine.next();
    it.session.engine.next();
    it.tick(500);
    assert.ok(it.session.engine.answer({ playerId: player.id, optionIndex: 0 }).ok, 'the answer was refused');
    it.session.engine.next();
    it.session.engine.next();
    assert.equal(it.session.engine.state.phase, 'round_board');

    const moved = it.session.advanceOrder();
    assert.ok(moved && moved.ok !== false, `could not move on to the bingo: ${JSON.stringify(moved)}`);
    assert.equal(it.session.kind, 'bingo');
    const codes = Object.values(it.onDisk().vouchers || {});
    assert.equal(codes.length, 1, `the quiz's winner should hold one code on disk, found ${codes.length}`);
    assert.equal(codes[0].winnerId, player.id);
    assert.equal(codes[0].carried, true, 'the code reached the disk without its carried mark');
    assert.equal(it.onDisk().kind, 'bingo', 'the disk is not on the new part');
  } finally {
    it.done();
  }
});
