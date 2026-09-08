/**
 * THE PHOTOGRAPHS A RESTART USED TO THROW AWAY.
 *
 * The memory cache is empty after every deploy, and every push is a deploy —
 * so the first people to open a gallery afterwards each cost a GitHub call
 * against an allowance of 5,000 an hour shared with everything else. The disk
 * tier is what makes that survive a restart, which is only worth anything once
 * `DATA_DIR` points at a persistent disk.
 *
 * The assertion that matters most is the boring one: a key is a REPOSITORY
 * PATH, and this app has already been bitten by a path walking out of its own
 * folder — `?q=..` minted a shadow room over the projector's state file. So a
 * `..` must not be able to write, read or delete a byte outside the cache.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The cache reads `config.dataDir` when the module loads, so the directory has
// to exist before the import rather than after it.
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-disk-'));
process.env.DATA_DIR = DIR;
process.env.PHOTO_DISK_CACHE_MB = '1';

const { diskPhoto, keepPhotoOnDisk, dropPhotoFromDisk, photoDiskState } =
  await import('../src/photo-cache.js');

const KEY = 'photos/room-abc/20-august/one.jpg';

test('a photograph kept on disk is read back exactly', () => {
  const bytes = Buffer.from('a picture of a pub', 'utf8');
  keepPhotoOnDisk(KEY, bytes);
  assert.deepEqual(diskPhoto(KEY), bytes);
});

test('two different keys never land on one file', () => {
  keepPhotoOnDisk('photos/a/b/c.jpg', Buffer.from('first'));
  keepPhotoOnDisk('photos/a/b~c.jpg', Buffer.from('second'));
  assert.equal(String(diskPhoto('photos/a/b/c.jpg')), 'first');
  assert.equal(String(diskPhoto('photos/a/b~c.jpg')), 'second');
});

test('a miss is null rather than a throw', () => {
  assert.equal(diskPhoto('photos/room-abc/20-august/never.jpg'), null);
});

test('deleting a photograph forgets the copy', () => {
  keepPhotoOnDisk(KEY, Buffer.from('gone soon'));
  dropPhotoFromDisk(KEY);
  assert.equal(diskPhoto(KEY), null);
  // And doing it twice is not an error — a delete races the cache by nature.
  dropPhotoFromDisk(KEY);
});

test('A PATH MAY NOT WALK OUT OF THE CACHE — read, write or delete', () => {
  const outside = path.join(DIR, 'state.json');
  fs.writeFileSync(outside, '{"the":"projector\'s own crash recovery"}');

  for (const nasty of [
    '../state.json',
    'photos/../../state.json',
    '/etc/passwd',
    'photos/./../../state.json',
    '',
  ]) {
    assert.equal(diskPhoto(nasty), null, `read escaped on ${nasty}`);
    keepPhotoOnDisk(nasty, Buffer.from('written by a stranger'));
    dropPhotoFromDisk(nasty);
  }

  // Nothing outside the cache folder was read, written or removed.
  assert.equal(fs.readFileSync(outside, 'utf8'), '{"the":"projector\'s own crash recovery"}');
});

test('the folder is trimmed back under its cap, oldest first', () => {
  const big = Buffer.alloc(300 * 1024, 1);
  // Four of these is 1.2MB against a 1MB cap, so at least one must go.
  for (const n of [1, 2, 3, 4]) {
    keepPhotoOnDisk(`photos/room-cap/night/${n}.jpg`, big);
    // Distinct mtimes, so "oldest" is a real ordering rather than a tie.
    const at = new Date(Date.now() - (10 - n) * 60_000);
    fs.utimesSync(path.join(DIR, 'photo-cache', encodeURIComponent(`photos/room-cap/night/${n}.jpg`)), at, at);
  }
  keepPhotoOnDisk('photos/room-cap/night/5.jpg', big);
  const state = photoDiskState();
  assert.ok(state.bytes <= state.cap, `${state.bytes} bytes over a ${state.cap} cap`);
  // The newest survives; the first one written is the first to go.
  assert.ok(diskPhoto('photos/room-cap/night/5.jpg'), 'the newest was evicted');
  assert.equal(diskPhoto('photos/room-cap/night/1.jpg'), null, 'the oldest survived');
});

test('a photograph larger than the whole cap is not kept', () => {
  const huge = Buffer.alloc(2 * 1024 * 1024, 7);
  keepPhotoOnDisk('photos/room-abc/night/huge.jpg', huge);
  assert.equal(diskPhoto('photos/room-abc/night/huge.jpg'), null);
});
