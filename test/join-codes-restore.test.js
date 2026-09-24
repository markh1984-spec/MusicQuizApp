/**
 * A CODE MINTED WHILE THE CODE BOOK COULD NOT BE READ IS NOT WRITTEN OVER THE
 * PRINTED ONES — and goes out once the book has been read.
 *
 * The join-code book is restored at boot, and if that read failed the first
 * console load MINTED this room a code (`codeFor()`) and pushed the WHOLE
 * book: one code, over every quizmaster's printed one, for good — the second
 * half of the 23 September 2026 sweep's R6 ("and for good if the new code's
 * push lands"). The merge in `restoreCodes()` is the first half; this is the
 * writer's, `backUpCodes()`, which holds a push until the boot's read (or its
 * retry) has succeeded — and the retry then pushes the merged book, so the
 * minted code is not lost either. `RESTORE_RETRY_MS` is the seam: far too
 * long to fire for the guard's half, short for the catch-up's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { readJson, wait, withGitHubDown, writeJson } from './helpers/empty-disk.mjs';

/*
 * TWO TESTS, NOT ONE, BECAUSE ONE WAS A RACE. The first version put both
 * halves on one boot with the retry timer set to 1.5s, and under a full suite
 * a slow boot let the retry read the book BEFORE the console minted — so the
 * "untouched" assertion met a merged book and failed on a feature that works.
 * A flaky suite is worse than a slow one. Here the retry is either far too
 * long to fire (the guard's half) or fires only once reads are allowed again
 * (the catch-up's half), so neither depends on how busy the machine is.
 */
test('a code minted after a boot that could not read the book is HELD BACK from the backup', async () => {
  await withGitHubDown(async ({ repo, data, roomId, get, back }) => {
    const book = () => readJson(path.join(repo, 'room-codes.json'));
    assert.deepEqual(book(), { 'acct-other': 'ZZZZ' }, 'the backup was not seeded');
    /*
     * THE HICCUP WAS AT BOOT AND IS OVER: GitHub answers again before the
     * console loads, so a push CAN land — a GitHub still down could not write
     * either (a write reads the file's sha first), and would prove nothing
     * about the guard. The boot's retry is ten minutes away, so the guard is
     * the only thing standing between the mint and the backup.
     */
    back();
    assert.equal((await get('/api/library')).status, 200);   // mints this room's code, pushes the book
    const mine = (readJson(path.join(data, 'room-codes.json')) || {})[roomId];
    assert.match(String(mine || ''), /^[0-9A-Z]{4,8}$/, 'no code was minted for the room');
    await wait(700);   // a fire-and-forget push would have landed by now
    assert.deepEqual(book(), { 'acct-other': 'ZZZZ' },
      "the minted code's one-entry book was pushed over every printed code");
  }, {
    env: { RESTORE_RETRY_MS: '600000' },
    seedRepo: (repo) => writeJson(path.join(repo, 'room-codes.json'), { 'acct-other': 'ZZZZ' }),
  });
});

test('and once the book has been read, the retry pushes the minted code out WITH the printed ones', async () => {
  await withGitHubDown(async ({ repo, data, roomId, get, back }) => {
    const book = () => readJson(path.join(repo, 'room-codes.json'));
    // GitHub is down for the boot AND the console's first load, so the mint
    // reaches the disk and nothing else; the retry keeps trying every 300ms.
    assert.equal((await get('/api/library')).status, 200);
    const mine = (readJson(path.join(data, 'room-codes.json')) || {})[roomId];
    assert.match(String(mine || ''), /^[0-9A-Z]{4,8}$/, 'no code was minted for the room');
    assert.deepEqual(book(), { 'acct-other': 'ZZZZ' });
    // GitHub answers. The next retry reads the book, merges, and pushes the merge.
    back();
    for (let i = 0; i < 80 && !(book() || {})[roomId]; i += 1) await wait(100);
    assert.deepEqual(book(), { 'acct-other': 'ZZZZ', [roomId]: mine },
      'the merged book — the printed code AND the minted one — did not go out');
  }, {
    env: { RESTORE_RETRY_MS: '300' },
    seedRepo: (repo) => writeJson(path.join(repo, 'room-codes.json'), { 'acct-other': 'ZZZZ' }),
  });
});
