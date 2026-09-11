/**
 * A DRINK IS STILL A DRINK NEXT WEEK.
 *
 * *"The app already remembers phones from previous weeks including their name,
 * so I don't understand why it can't just remember the drinks they've won as
 * well?"*
 *
 * It can, and the reason it did not was that `/api/voucher` and
 * `/api/voucher/redeem` read the LIVE game's state — which is replaced the
 * moment the next night launches. The codes were in the archive the whole
 * time with nothing able to look them up. See `src/wallet.js`.
 *
 * **OVER REAL HTTP, because the bug was in the ROUTES and nowhere else.** The
 * engine minted the voucher correctly, filed it correctly, and backed it up
 * correctly; a unit test on any of those three passed throughout. *A test that
 * never runs the artefact proves nothing about it.*
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withServer } from './helpers/live-server.mjs';
import { findInArchive, redeemInArchive } from '../src/wallet.js';

const KEY = 'wallet-test-key';

/** A night filed exactly as `results()` files one — vouchers as an ARRAY. */
function fileNight(dir, id, vouchers) {
  const archive = path.join(dir, 'archive');
  fs.mkdirSync(archive, { recursive: true });
  fs.writeFileSync(
    path.join(archive, `${id}.json`),
    JSON.stringify({
      id,
      kind: 'quiz',
      quizTitle: 'Last Thursday',
      archivedAt: 1,
      venue: 'The Guard Dog',
      leaderboard: [{ name: 'Quizteam Aguilera', score: 10 }],
      vouchers,
    }, null, 2),
  );
  return archive;
}

const A_DRINK = {
  code: 'OLDCODE1',
  name: 'Quizteam Aguilera',
  reward: 'A bottle of house red',
  venue: 'The Guard Dog',
  place: 1,
  issuedAt: 1,
  redeemedAt: null,
};

test('A CODE FROM A FILED NIGHT IS STILL FOUND', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'wallet-'));
  const archive = fileNight(dir, '2026-09-04', [A_DRINK]);
  const hit = findInArchive(archive, 'OLDCODE1');
  assert.ok(hit, 'the code should resolve against the filed night');
  assert.equal(hit.nightId, '2026-09-04');
  assert.equal(hit.voucher.reward, 'A bottle of house red');
});

test('and the lookup is CASE-INSENSITIVE, like the live one', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'wallet-'));
  const archive = fileNight(dir, '2026-09-04', [A_DRINK]);
  assert.ok(findInArchive(archive, 'oldcode1'));
});

test('a code nobody won is not a voucher here', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'wallet-'));
  const archive = fileNight(dir, '2026-09-04', [A_DRINK]);
  assert.equal(findInArchive(archive, 'MADEUPXX'), null);
  assert.equal(findInArchive(archive, ''), null);
});

test('TAKING IT WRITES BACK TO THE FILED NIGHT', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'wallet-'));
  const archive = fileNight(dir, '2026-09-04', [A_DRINK]);

  const out = redeemInArchive(archive, 'OLDCODE1', 5000);
  assert.equal(out.ok, true);
  assert.equal(out.voucher.redeemedAt, 5000);

  /* On DISK, not just in the returned object — the filed night is the
     evidence, and Past gigs reads `rewardsTaken` off it. */
  const onDisk = JSON.parse(fs.readFileSync(path.join(archive, '2026-09-04.json'), 'utf8'));
  assert.equal(onDisk.vouchers[0].redeemedAt, 5000);
  assert.equal(onDisk.vouchers[0].code, 'OLDCODE1', 'the rest of the voucher survives');
  assert.equal(onDisk.venue, 'The Guard Dog', 'and so does the rest of the night');
});

test('AND IT CANNOT BE TAKEN TWICE', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'wallet-'));
  const archive = fileNight(dir, '2026-09-04', [A_DRINK]);
  assert.equal(redeemInArchive(archive, 'OLDCODE1', 5000).ok, true);
  const again = redeemInArchive(archive, 'OLDCODE1', 6000);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'already');
  const onDisk = JSON.parse(fs.readFileSync(path.join(archive, '2026-09-04.json'), 'utf8'));
  assert.equal(onDisk.vouchers[0].redeemedAt, 5000, 'the first time is the one kept');
});

test("a night that does not parse is skipped, never thrown at a bar's scanner", () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'wallet-'));
  const archive = fileNight(dir, '2026-09-04', [A_DRINK]);
  fs.writeFileSync(path.join(archive, 'broken.json'), '{ not json');
  assert.ok(findInArchive(archive, 'OLDCODE1'), 'the good night is still found');
});

test('no archive at all is simply no voucher', () => {
  assert.equal(findInArchive('/nowhere/at/all', 'OLDCODE1'), null);
  assert.equal(redeemInArchive('/nowhere/at/all', 'OLDCODE1', 1).reason, 'unknown');
});

/* ---------------------------------------------------------- over real HTTP */

test('THE BAR CAN SCAN LAST WEEK\'S CODE, AND TAKE IT', async () => {
  await withServer(async (base, _seeded, dir) => {
    fileNight(dir, '2026-09-04', [A_DRINK]);

    const look = await fetch(`${base}/api/voucher?c=OLDCODE1`);
    assert.equal(look.status, 200, 'a code from a filed night still resolves');
    const body = await look.json();
    assert.equal(body.reward, 'A bottle of house red');
    assert.equal(body.name, 'Quizteam Aguilera');
    assert.equal(body.redeemedAt, null, 'and it is still owed');

    const take = await fetch(`${base}/api/voucher/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'OLDCODE1' }),
    });
    assert.equal(take.status, 200, 'and the bar can take it');

    const after = await fetch(`${base}/api/voucher?c=OLDCODE1`).then((r) => r.json());
    assert.ok(after.redeemedAt, 'which the next scan says');

    const again = await fetch(`${base}/api/voucher/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'OLDCODE1' }),
    });
    assert.equal(again.status, 409, 'and it cannot be taken a second time');
  }, { hostKey: KEY });
});

test('a code that was never won is still refused, and says nothing else', async () => {
  await withServer(async (base, _seeded, dir) => {
    fileNight(dir, '2026-09-04', [A_DRINK]);
    const look = await fetch(`${base}/api/voucher?c=MADEUPXX`);
    assert.equal(look.status, 404);
    const take = await fetch(`${base}/api/voucher/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MADEUPXX' }),
    });
    assert.equal(take.status, 404);
  }, { hostKey: KEY });
});
