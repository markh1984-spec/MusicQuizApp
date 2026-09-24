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
 * minted code is not lost either. `RESTORE_RETRY_MS` is shortened so the
 * retry is watched rather than waited a minute for — and set LONGER than the
 * console's first load, so the guard is what holds the push, not the retry
 * having already read the book.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { readJson, wait, withGitHubDown, writeJson } from './helpers/empty-disk.mjs';

test('a code minted while the book could not be read is held back, then pushed with the printed ones', async () => {
  await withGitHubDown(async ({ repo, data, roomId, get, back }) => {
    const book = () => readJson(path.join(repo, 'room-codes.json'));
    assert.deepEqual(book(), { 'acct-other': 'ZZZZ' }, 'the backup was not seeded');

    /*
     * THE HICCUP WAS AT BOOT AND IS OVER: GitHub answers again before the
     * console loads, so a push CAN land — a GitHub still down could not write
     * either (a write reads the file's sha first), and would prove nothing
     * about the guard. The boot's retry is still a second away.
     */
    back();
    // The console loads. The library mints this room's code and pushes the book.
    assert.equal((await get('/api/library')).status, 200);
    const mine = (readJson(path.join(data, 'room-codes.json')) || {})[roomId];
    assert.match(String(mine || ''), /^[0-9A-Z]{4,8}$/, 'no code was minted for the room');
    await wait(600);   // a fire-and-forget push would have landed by now
    assert.deepEqual(book(), { 'acct-other': 'ZZZZ' },
      "the minted code's one-entry book was pushed over every printed code");

    // The boot's retry reads the book, merges, and pushes the merged one.
    for (let i = 0; i < 80 && !(book() || {})[roomId]; i += 1) await wait(100);
    assert.deepEqual(book(), { 'acct-other': 'ZZZZ', [roomId]: mine },
      'the merged book — the printed code AND the minted one — did not go out');
  }, {
    env: { RESTORE_RETRY_MS: '1500' },
    seedRepo: (repo) => writeJson(path.join(repo, 'room-codes.json'), { 'acct-other': 'ZZZZ' }),
  });
});
