/**
 * THE TWO REPAIR SCRIPTS, ACTUALLY RUN — copy a room's photographs into the
 * room the app reads, then delete the duplicate.
 *
 * ---
 *
 * **BOTH OF THESE CAN DESTROY A NIGHT'S PHOTOGRAPHS AND NEITHER HAD EVER BEEN
 * EXECUTED.** They were written in an incident, against a live bucket, and read
 * as correct — which this repo's own oldest lesson says is worth nothing: *a
 * test that never runs the artefact proves nothing about it.* The delete in
 * particular has no `--force` and no undo, so the thing that has to be true is
 * the REFUSAL: it must not remove anything until every file is provably
 * elsewhere.
 *
 * The scripts are spawned for real, with `test/helpers/photo-repo-stub.mjs`
 * behind their GitHub calls, so the code under test is the code that runs on
 * Render and only the network is a fixture. No token, no bucket, no keys.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');

/** A repository with two nights filed in the flat house folder, and nothing else. */
function aHouseFolder() {
  const repo = mkdtempSync(join(tmpdir(), 'photo-repair-'));
  for (const night of ['2026-08-11', '2026-08-12']) {
    mkdirSync(join(repo, 'photos', night), { recursive: true });
    writeFileSync(join(repo, 'photos', night, 'a.jpg'), Buffer.alloc(32, 1));
    writeFileSync(join(repo, 'photos', night, 'b.jpg'), Buffer.alloc(32, 2));
  }
  writeFileSync(join(repo, 'photos', 'published.json'), JSON.stringify({ nights: ['2026-08-11'] }));
  return repo;
}

const run = (repo, script, args) => spawnSync(process.execPath, ['--import', STUB, join('scripts', script), ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub' },
});

const filesIn = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);

test('the copy script moves the house folder into the room the readers look in', () => {
  const repo = aHouseFolder();
  try {
    /*
     * `house` HAS TO NAME THE FLAT FOLDER. It is the room `fileAway()` filed
     * under raw until 19 September 2026, so it is where every photograph from a
     * night hosted on the owner hat or the host key ended up — and it is the one
     * source this repair has to be able to name.
     */
    const look = run(repo, 'photos-into-the-right-room.mjs', ['house', 'qm-mark']);
    assert.match(look.stdout, /WOULD be copied/, look.stdout + look.stderr);
    assert.equal(filesIn(join(repo, 'photos', 'qm-mark')).length, 0, 'a dry run wrote something');

    const done = run(repo, 'photos-into-the-right-room.mjs', ['house', 'qm-mark', '--go']);
    assert.match(done.stdout, /5 file\(s\) copied/, done.stdout + done.stderr);
    assert.deepEqual(filesIn(join(repo, 'photos', 'qm-mark', '2026-08-11')), ['a.jpg', 'b.jpg']);
    assert.deepEqual(filesIn(join(repo, 'photos', 'qm-mark', '2026-08-12')), ['a.jpg', 'b.jpg']);
    // The file that decides what a stranger can see travels too, or the repair
    // looks like it did nothing.
    assert.ok(existsSync(join(repo, 'photos', 'qm-mark', 'published.json')), 'published.json was left behind');
    // And the source is untouched, which is what makes a mistake cost disk.
    assert.deepEqual(filesIn(join(repo, 'photos', '2026-08-11')), ['a.jpg', 'b.jpg']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('AND THE DELETE REFUSES UNTIL EVERY FILE IS PROVABLY SOMEWHERE ELSE', () => {
  const repo = aHouseFolder();
  try {
    // A half-finished copy: one night carried over, one not.
    mkdirSync(join(repo, 'photos', 'old-room', '2026-08-11'), { recursive: true });
    writeFileSync(join(repo, 'photos', 'old-room', '2026-08-11', 'a.jpg'), Buffer.alloc(32, 1));
    mkdirSync(join(repo, 'photos', 'old-room', '2026-08-13'), { recursive: true });
    writeFileSync(join(repo, 'photos', 'old-room', '2026-08-13', 'z.jpg'), Buffer.alloc(32, 9));
    mkdirSync(join(repo, 'photos', 'qm-mark', '2026-08-11'), { recursive: true });
    writeFileSync(join(repo, 'photos', 'qm-mark', '2026-08-11', 'a.jpg'), Buffer.alloc(32, 1));

    const refused = run(repo, 'photos-out-of-the-old-room.mjs', ['old-room', 'qm-mark', '--go']);
    assert.notEqual(refused.status, 0, 'an incomplete copy was not refused');
    assert.match(refused.stdout, /REFUSED/, refused.stdout + refused.stderr);
    assert.match(refused.stdout, /2026-08-13\/z\.jpg/, 'it did not name the file that is not safe yet');
    assert.ok(existsSync(join(repo, 'photos', 'old-room', '2026-08-11', 'a.jpg')),
      'it deleted the file it could prove was safe — a partial delete is the worst outcome');

    // Finish the copy, and now it goes.
    mkdirSync(join(repo, 'photos', 'qm-mark', '2026-08-13'), { recursive: true });
    writeFileSync(join(repo, 'photos', 'qm-mark', '2026-08-13', 'z.jpg'), Buffer.alloc(32, 9));
    const done = run(repo, 'photos-out-of-the-old-room.mjs', ['old-room', 'qm-mark', '--go']);
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.match(done.stdout, /2 file\(s\) deleted/, done.stdout + done.stderr);
    assert.equal(filesIn(join(repo, 'photos', 'old-room', '2026-08-11')).length, 0);
    assert.equal(filesIn(join(repo, 'photos', 'old-room', '2026-08-13')).length, 0);
    // The kept copies are all still there.
    assert.deepEqual(filesIn(join(repo, 'photos', 'qm-mark', '2026-08-11')), ['a.jpg']);
    assert.deepEqual(filesIn(join(repo, 'photos', 'qm-mark', '2026-08-13')), ['z.jpg']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

/*
 * THE ARGUMENT ORDER IS THE HAZARD, AND THE FIRST VERSION GUARDED THE WRONG END.
 *
 * It refused the flat `photos/` folder as a SOURCE, which reads sensibly and
 * blocks the one cleanup that folder actually needs — the nights `fileAway()`
 * filed there. The catastrophic direction is the reverse: once those nights have
 * been copied into a real room, naming that room as the source and `house` as
 * the safety copy deletes fifty-seven LIVE photographs, precisely because the
 * flat folder holds copies of them. So the refusal is on what is TRUSTED.
 */
test('the flat house folder can never be the safety copy', () => {
  const repo = aHouseFolder();
  try {
    // The live room, holding what was copied out of the flat folder.
    mkdirSync(join(repo, 'photos', 'qm-mark', '2026-08-11'), { recursive: true });
    writeFileSync(join(repo, 'photos', 'qm-mark', '2026-08-11', 'a.jpg'), Buffer.alloc(32, 1));

    const no = run(repo, 'photos-out-of-the-old-room.mjs', ['qm-mark', 'house', '--go']);
    assert.notEqual(no.status, 0, 'a live room was deletable against the flat folder');
    assert.match(no.stdout, /Refused/);
    assert.deepEqual(filesIn(join(repo, 'photos', 'qm-mark', '2026-08-11')), ['a.jpg']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('AND THE FLAT FOLDER ITSELF CAN BE CLEARED, once its nights are safely elsewhere', () => {
  const repo = aHouseFolder();
  try {
    for (const night of ['2026-08-11', '2026-08-12']) {
      mkdirSync(join(repo, 'photos', 'qm-mark', night), { recursive: true });
      for (const f of ['a.jpg', 'b.jpg']) writeFileSync(join(repo, 'photos', 'qm-mark', night, f), Buffer.alloc(32, 1));
    }
    writeFileSync(join(repo, 'photos', 'qm-mark', 'published.json'), JSON.stringify({ nights: [] }));

    const done = run(repo, 'photos-out-of-the-old-room.mjs', ['house', 'qm-mark', '--go']);
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.equal(filesIn(join(repo, 'photos', '2026-08-11')).length, 0);
    assert.equal(filesIn(join(repo, 'photos', '2026-08-12')).length, 0);
    assert.deepEqual(filesIn(join(repo, 'photos', 'qm-mark', '2026-08-11')), ['a.jpg', 'b.jpg']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
