/**
 * A DISK THAT ALREADY HOLDS THE BOOKS DOES NOT MAKE `listen()` WAIT ON GITHUB.
 *
 * `restoreFromBackup()` runs before `server.listen()`, which is right for a
 * book the disk does NOT hold: a request in the gap would be told there are
 * no accounts. But two of its reads — the join-code book and the house
 * archive — asked GitHub on every boot whether or not the disk had them, and
 * with a disk attached it always does. So every deploy spent one GitHub
 * deadline of blank projector on a read whose answer the disk already had,
 * 8.2s of it on a bad GitHub hour.
 *
 * What the disk holds is booted from the disk and GitHub is asked AFTERWARDS,
 * in the background, merging exactly as it did before (the printed code wins
 * on the code book, the disk on the archive). Two claims: a hung GitHub costs
 * a full-disk boot nothing, and a slow one still lands its merge.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import { withServer } from './helpers/live-server.mjs';

const HELPERS = new URL('./helpers/', import.meta.url).pathname;
const HANGS = path.join(HELPERS, 'github-hangs-stub.mjs');
const STUB = path.join(HELPERS, 'photo-repo-stub.mjs');
const REPO = { PHOTO_REPO: 'nobody/private', PHOTO_TOKEN: 'stub', GITHUB_REPO: 'nobody/app', GITHUB_TOKEN: 'stub' };

const write = (file, obj) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
};

/** Every book the boot restores, already on the disk — the state after a deploy WITH a disk. */
function fullDisk(dir) {
  const book = new Accounts(path.join(dir, 'accounts.json'));
  const qm = book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
  book.save();
  write(path.join(dir, 'room-codes.json'), { [qm.id]: 'ABCD' });
  write(path.join(dir, 'archive', 'night-on-disk.json'), { id: 'night-on-disk', kind: 'quiz', packId: '2006', title: '2006', archivedAt: 1, leaderboard: [], vouchers: {} });
  write(path.join(dir, 'reports.json'), { reports: [{ id: 'r1', at: 1, packId: '2006', text: 'q3 is wrong' }] });
  write(path.join(dir, 'suggestions.json'), { suggestions: [{ id: 's1', at: 1, text: 'more 90s' }], house: '' });
  write(path.join(dir, 'spend.json'), { rows: [{ at: 1, kind: 'generate', pence: 1 }] });
  write(path.join(dir, 'prop-use.json'), { props: { 'dog-ears': 3 } });
  write(path.join(dir, 'invoicing.json'), { customers: [{ id: 'c1', name: 'The Crown' }], invoices: [] });
  write(path.join(dir, 'room-asks.json'), { asks: [{ id: 'a1', at: 1, ideaId: 'x', night: 'night-on-disk' }] });
  write(path.join(dir, 'library-stats.json'), {});
  return { qm };
}

test('with every book on the disk, a hung GitHub does not delay listen()', async () => {
  const READ_MS = 4000;
  const t0 = Date.now();
  await withServer(async (base) => {
    const up = Date.now() - t0;
    const health = await (await fetch(`${base}/health`)).json();
    assert.ok(health && health.ok !== false, 'the app is not healthy');
    assert.ok(up < READ_MS, `the app took ${up}ms to answer — it waited a GitHub deadline (${READ_MS}ms) for a book the disk already held`);
  }, {
    seed: fullDisk,
    nodeArgs: ['--import', HANGS],
    env: { ...REPO, GITHUB_TIMEOUT_MS: String(READ_MS), GITHUB_READ_TIMEOUT_MS: String(READ_MS), BACKUP_WAIT_MS: '200' },
  });
});

test('…and a slow GitHub is still asked in the background, and its answer merged', async () => {
  const DELAY_MS = 1500;
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-gh-'));
  const t0 = Date.now();
  await withServer(async (base, { qm }, dir) => {
    const up = Date.now() - t0;
    assert.ok(up < DELAY_MS, `the app took ${up}ms to answer — it waited on GitHub (${DELAY_MS}ms) for a book the disk already held`);
    // The backup lands late and is merged: a code and a night the disk did not
    // hold arrive, the printed code winning and the disk's own night kept.
    await new Promise((r) => setTimeout(r, DELAY_MS + 1200));
    const codes = JSON.parse(fs.readFileSync(path.join(dir, 'room-codes.json'), 'utf8'));
    assert.equal(codes['other-room'], 'PQRS', `the background read never merged the code book: ${JSON.stringify(codes)}`);
    assert.equal(codes[qm.id], 'WXYZ', 'the printed code did not win the merge');
    const nights = fs.readdirSync(path.join(dir, 'archive')).sort();
    assert.deepEqual(nights, ['night-in-backup.json', 'night-on-disk.json'], 'the archive was not merged in the background');
  }, {
    seed: (dir) => {
      const seeded = fullDisk(dir);
      write(path.join(repo, 'room-codes.json'), { [seeded.qm.id]: 'WXYZ', 'other-room': 'PQRS' });
      write(path.join(repo, 'archive.json'), { nights: [{ id: 'night-in-backup', kind: 'quiz', packId: '2006', title: '2006', archivedAt: 2, leaderboard: [], vouchers: {} }] });
      return seeded;
    },
    nodeArgs: ['--import', STUB],
    env: { ...REPO, GH_STUB_DIR: repo, GH_STUB_DELAY_MS: String(DELAY_MS), BACKUP_WAIT_MS: '200' },
  });
  fs.rmSync(repo, { recursive: true, force: true });
});
