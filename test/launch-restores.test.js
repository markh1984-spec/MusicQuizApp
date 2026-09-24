/**
 * A LAUNCH BRINGS BACK WHAT IT READS AND WRITES — before it touches the disk.
 *
 * The archive, the venue book and a quizmaster's own packs came back from the
 * backup only when a CONSOLE PAGE loaded (`/api/library`, `/api/past-gigs`,
 * the invoices tab). Rooms are made lazily, so the boot restores the HOUSE
 * room's and nobody else's — see `restoreFromBackup()`. So a console left
 * open across a deploy onto an EMPTY disk (a new disk, a replaced one, or the
 * no-disk case rule 7 is written for) launched before any of them ran, and
 * three things went wrong in silence:
 *
 *   - the night was filed into an empty archive and the backup was written
 *     with tonight ALONE — every past night gone but for git history;
 *   - the venue's prizes were read off an empty invoice book, so the night
 *     launched with `rewards: []` and the winner's phone was blank;
 *   - an own pack was not on disk, so Launch answered 400 with a file path.
 *
 * Found by the 23 September 2026 launch-path sweep. `a-night-survives-a-deploy`
 * could not see it because it loads `/api/library` first. These three drive
 * the HOST ROUTE only, as a signed-in quizmaster, with nothing else loaded —
 * `restoreForLaunch()` in `src/http/helpers.js` is what makes them pass.
 *
 * As a QUIZMASTER, NEVER THE HOST KEY — `test/helpers/empty-disk.mjs` says why.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, onAnEmptyDisk, readJson, wait, withGitHubDown, writeJson } from './helpers/empty-disk.mjs';

const PACK = '1980s-pop-music';

/** Start the night and press Next until the final scores — the write that files it. */
async function playToTheEnd(host, hostView) {
  await host('start', {});
  for (let i = 0; i < 300; i += 1) {
    if ((await hostView()).phase === 'final') break;
    await host('next', {});
  }
  assert.equal((await hostView()).phase, 'final', 'the night never reached its final scores');
}

const TWO_OLD_NIGHTS = {
  nights: [
    { id: 'night-one', kind: 'quiz', quizTitle: 'Old One', venue: 'The Anchor', archivedAt: 1, leaderboard: [{ name: 'A', score: 10, position: 1 }] },
    { id: 'night-two', kind: 'quiz', quizTitle: 'Old Two', venue: 'The Anchor', archivedAt: 2, leaderboard: [{ name: 'B', score: 20, position: 1 }] },
  ],
};
const backedUpIds = (repo, roomId) => ((readJson(path.join(repo, `archive-${roomId}.json`)) || {}).nights || []).map((n) => n.id);

test('a launch on an empty disk keeps the past nights the backup holds', async () => {
  await onAnEmptyDisk(async ({ repo, roomId, host, hostView }) => {
    const nightsBackedUp = () => backedUpIds(repo, roomId);
    assert.deepEqual(nightsBackedUp(), ['night-one', 'night-two'], 'the backup was not seeded');

    const launched = await host('launch', { game: 'quiz', packId: PACK });
    assert.equal(launched.status, 200, `the night would not launch: ${JSON.stringify(launched.json)}`);
    // Run it to the end so it files — the write that used to clobber the backup.
    await playToTheEnd(host, hostView);
    // The archive backup is fire-and-forget; give it a moment to land.
    for (let i = 0; i < 60 && nightsBackedUp().length < 3; i += 1) await wait(100);

    const ids = nightsBackedUp();
    assert.ok(ids.includes('night-one') && ids.includes('night-two'),
      `the launch overwrote the past-nights backup: it now holds ${JSON.stringify(ids)}`);
    assert.equal(ids.length, 3, `tonight was not filed alongside the two old nights: ${JSON.stringify(ids)}`);
  }, {
    seedRepo: (repo, roomId) => writeJson(path.join(repo, `archive-${roomId}.json`), TWO_OLD_NIGHTS),
  });
});

/*
 * AND WHEN GITHUB IS DOWN AT THE LAUNCH, THE BACKUP IS NOT WRITTEN OVER. The
 * restore failing is the case the first test cannot reach: tonight files into
 * an archive that never got its past nights, and the backup — the WHOLE book,
 * serialised off that disk — used to go out holding tonight alone. Two shapes
 * of the same outage, because a write needs a read (the file's sha) and so a
 * GitHub still down at the end cannot clobber anything by itself:
 *
 *   - DOWN AT THE LAUNCH, BACK BY THE END: `backUpArchive()` reads the past
 *     nights back before it writes, and refuses if it cannot;
 *   - DOWN ALL NIGHT, BACK TOMORROW: nothing was written, and the next thing
 *     that asks merges the backup onto the disk and pushes the disk back out.
 *
 * `RESTORE_BACKOFF_MS` is shortened so the retry is watched, not waited a
 * minute for. Each is proven by putting its own fault back.
 */
const down = (run) => withGitHubDown(run, {
  env: { RESTORE_BACKOFF_MS: '50' },
  seedRepo: (repo, roomId) => writeJson(path.join(repo, `archive-${roomId}.json`), TWO_OLD_NIGHTS),
});

test('GitHub down at the launch and back by the end: tonight is filed BESIDE the past nights, not over them', async () => {
  await down(async ({ repo, roomId, host, hostView, back }) => {
    const launched = await host('launch', { game: 'quiz', packId: PACK });
    assert.equal(launched.status, 200, `GitHub being down stopped the launch: ${JSON.stringify(launched.json)}`);
    back();
    await wait(150);   // past the backoff, so the filing's own read is a real retry
    await playToTheEnd(host, hostView);
    for (let i = 0; i < 60 && backedUpIds(repo, roomId).length < 3; i += 1) await wait(100);
    const ids = backedUpIds(repo, roomId);
    assert.ok(ids.includes('night-one') && ids.includes('night-two') && ids.length === 3,
      `the filing wrote tonight OVER the past nights it had never read back: the backup holds ${JSON.stringify(ids)}`);
  });
});

test('GitHub down all night: the backup is untouched, and catches up the next time anything asks', async () => {
  await down(async ({ repo, roomId, host, hostView, get, back }) => {
    const launched = await host('launch', { game: 'quiz', packId: PACK });
    assert.equal(launched.status, 200, `GitHub being down stopped the launch: ${JSON.stringify(launched.json)}`);
    await playToTheEnd(host, hostView);
    await wait(700);   // a fire-and-forget backup would have landed by now
    assert.deepEqual(backedUpIds(repo, roomId), ['night-one', 'night-two'], 'the backup was written while GitHub was down');

    // Tomorrow. The Past gigs tab is the first thing to ask.
    back();
    await wait(150);
    assert.equal((await get('/api/past-gigs')).status, 200);
    for (let i = 0; i < 60 && backedUpIds(repo, roomId).length < 3; i += 1) await wait(100);
    const ids = backedUpIds(repo, roomId);
    assert.ok(ids.includes('night-one') && ids.includes('night-two') && ids.length === 3,
      `the backup did not catch up once GitHub answered: it holds ${JSON.stringify(ids)}`);
  });
});

test("a launch on an empty disk reads the venue's prizes off the backed-up book", async () => {
  await onAnEmptyDisk(async ({ host, hostView }) => {
    const launched = await host('launch', { game: 'quiz', packId: PACK, venue: 'The Anchor' });
    assert.equal(launched.status, 200, `the night would not launch: ${JSON.stringify(launched.json)}`);
    assert.deepEqual((await hostView()).rewards, ['A pint', 'A half', 'Crisps'],
      'the night launched playing for nothing: the venue book had not been restored');
  }, {
    seedRepo(repo, roomId) {
      writeJson(path.join(repo, `invoicing-${roomId}.json`), {
        settings: {}, invoices: [], bookings: [],
        customers: [{ id: 'anchor', name: 'The Anchor', rewards: ['A pint', 'A half', 'Crisps'] }],
      });
    },
  });
});

test("a launch on an empty disk finds one of the quizmaster's own packs", async () => {
  await onAnEmptyDisk(async ({ host, hostView }) => {
    const launched = await host('launch', { game: 'quiz', packId: 'robs-own-night' });
    assert.equal(launched.status, 200, `their own pack would not launch: ${JSON.stringify(launched.json)}`);
    assert.equal((await hostView()).quizTitle, "Rob's Own Night");
  }, {
    env: { PACKS_REPO: 'someone/packs', PACKS_TOKEN: 'stub' },
    seedRepo(repo, roomId) {
      const quiz = JSON.parse(fs.readFileSync(path.join(ROOT, 'quizzes', `${PACK}.json`), 'utf8'));
      writeJson(path.join(repo, 'packs', roomId, 'quiz', 'robs-own-night.json'), { ...quiz, id: 'robs-own-night', title: "Rob's Own Night" });
    },
  });
});
