/**
 * THE PLAY COUNTS COME BACK ON AN EMPTY DISK — and the first launch adds to
 * them rather than replacing them.
 *
 * `restoreStats()` in `src/http/helpers.js` wrote the backup to `statsFile`,
 * a name defined nowhere: the ReferenceError was caught and logged as *"could
 * not restore play counts: statsFile is not defined"*, so on every boot onto
 * an empty disk every pack read "Never played", and the first launch then
 * pushed a one-play book over the backup. Found by the 23 September 2026
 * launch-path sweep (O23). `test/server-split.test.js` could not see it —
 * it only flagged names another module EXPORTS — and it can now.
 *
 * As a quizmaster on an empty disk, the way every restore is proven here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { onAnEmptyDisk, readJson, wait, writeJson } from './helpers/empty-disk.mjs';

const PACK = '1980s-pop-music';

test('play counts restore from the backup on an empty disk, and the first launch adds to them', async () => {
  await onAnEmptyDisk(async ({ repo, roomId, host, get }) => {
    const book = () => readJson(path.join(repo, 'library-stats.json'));
    assert.equal(book().rooms[roomId][`quiz:${PACK}`].playCount, 7, 'the backup was not seeded');

    const library = await (await get('/api/library')).json();
    const pack = (library.quizzes || []).find((q) => q.id === PACK);
    assert.ok(pack, `${PACK} is not in the library`);
    assert.equal(pack.playCount, 7, 'the play count did not come back from the backup');

    const launched = await host('launch', { game: 'quiz', packId: PACK });
    assert.equal(launched.status, 200, `the night would not launch: ${JSON.stringify(launched.json)}`);
    // The push is fire-and-forget; give it a moment to land.
    for (let i = 0; i < 60 && (book().rooms[roomId][`quiz:${PACK}`] || {}).playCount !== 8; i += 1) await wait(100);
    assert.equal(book().rooms[roomId][`quiz:${PACK}`].playCount, 8,
      `the first launch wrote the backup as ${JSON.stringify(book())} rather than adding one play to seven`);
  }, {
    seedRepo: (repo, roomId) => writeJson(path.join(repo, 'library-stats.json'), {
      rooms: { [roomId]: { [`quiz:${PACK}`]: { playCount: 7, lastPlayedAt: 1700000000000 } } },
    }),
  });
});
