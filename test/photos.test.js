/**
 * Photos from the room.
 *
 * The rule that drives all of this: there is NO approval step, by the host's
 * explicit decision. So the things that must work are the ones he reaches for
 * when something has already gone up — the switch and the bin — and they have
 * to work instantly and survive a restart.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Photos, sniffType, extensionFor, nightOf, MAX_BYTES, MAX_PHOTOS } from '../src/photos.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-photos-'));
}

/** A real JPEG header followed by filler — enough to be sniffed as one. */
function jpeg(size = 64) {
  const b = Buffer.alloc(size, 0x20);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0;
  return b;
}

function png(size = 64) {
  const b = Buffer.alloc(size, 0x20);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  return b;
}

test('a photo is stored and appears on the screen', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    const result = photos.add(jpeg(), { contentType: 'image/jpeg', playerId: 'abcdef123456', teamName: 'The Wing Nuts' });
    assert.equal(result.ok, true);

    const screen = photos.forScreen();
    assert.equal(screen.length, 1);
    assert.equal(screen[0].teamName, 'The Wing Nuts');
    assert.match(screen[0].url, /^\/photos\/.+\.jpg$/);
    assert.ok(fs.existsSync(path.join(dir, result.photo.file)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('newest first — the one just taken is the one being looked at', () => {
  const dir = tempDir();
  try {
    let t = 1000;
    const photos = new Photos(dir, () => (t += 1000));
    photos.add(jpeg(), { contentType: 'image/jpeg', teamName: 'First' });
    photos.add(jpeg(), { contentType: 'image/jpeg', teamName: 'Second' });
    assert.deepEqual(photos.forScreen().map((p) => p.teamName), ['Second', 'First']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the switch stops new ones AND hides the ones already up', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    photos.add(jpeg(), { contentType: 'image/jpeg', teamName: 'X' });

    photos.setEnabled(false);
    assert.deepEqual(photos.forScreen(), [], 'the screen shows none of them');
    assert.equal(photos.add(jpeg(), { contentType: 'image/jpeg' }).reason, 'off', 'and no more are taken');

    // ...but the host can still see it, or they could not delete it.
    assert.equal(photos.forHost().length, 1);

    photos.setEnabled(true);
    assert.equal(photos.forScreen().length, 1, 'switching back on restores them');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('binning one photo deletes the file, not just the entry', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    const { photo } = photos.add(jpeg(), { contentType: 'image/jpeg' });
    const file = path.join(dir, photo.file);

    assert.equal(photos.remove(photo.id), true);
    assert.equal(photos.forScreen().length, 0);
    assert.equal(fs.existsSync(file), false, 'the file is gone too');
    assert.equal(photos.remove(photo.id), false, 'and removing it again says so');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('clearing takes the lot, files and all', () => {
  const dir = tempDir();
  try {
    let t = 1000;
    const photos = new Photos(dir, () => (t += 10));
    for (let i = 0; i < 5; i++) photos.add(jpeg(), { contentType: 'image/jpeg' });
    assert.equal(photos.clear(), 5);
    assert.equal(photos.count(), 0);
    assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the switch and the photos survive a restart', () => {
  const dir = tempDir();
  try {
    const first = new Photos(dir, () => 1000);
    first.add(jpeg(), { contentType: 'image/jpeg', teamName: 'The Wing Nuts' });
    first.setEnabled(false);

    // A restart is a new instance over the same folder.
    const second = new Photos(dir, () => 2000);
    assert.equal(second.enabled, false, 'still switched off');
    assert.equal(second.forHost().length, 1);
    assert.equal(second.forHost()[0].teamName, 'The Wing Nuts');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('something that is not an image is refused', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    // Claims to be a JPEG. Is not.
    const result = photos.add(Buffer.from('<html><script>alert(1)</script></html>'), { contentType: 'image/jpeg' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not_an_image');
    assert.equal(photos.count(), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an oversized file is refused rather than filling the disk', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    const huge = jpeg(MAX_BYTES + 1);
    assert.equal(photos.add(huge, { contentType: 'image/jpeg' }).reason, 'too_big');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a busy night drops the oldest rather than filling the disk', () => {
  const dir = tempDir();
  try {
    let t = 1000;
    const photos = new Photos(dir, () => (t += 10));
    for (let i = 0; i < MAX_PHOTOS + 12; i++) {
      photos.add(jpeg(), { contentType: 'image/jpeg', teamName: `T${i}` });
    }
    assert.equal(photos.count(), MAX_PHOTOS);
    // The newest survived; the oldest went, files and all.
    assert.equal(photos.forHost()[0].teamName, `T${MAX_PHOTOS + 11}`);
    assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length, MAX_PHOTOS);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('only a filename the app issued can be served', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    const { photo } = photos.add(jpeg(), { contentType: 'image/jpeg' });

    assert.ok(photos.fileFor(photo.file), 'its own file resolves');
    // Nothing from a request reaches the filesystem as a path.
    assert.equal(photos.fileFor('../../../etc/passwd'), null);
    assert.equal(photos.fileFor('photos.json'), null);
    assert.equal(photos.fileFor('nope.jpg'), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('png and webp are allowed, other things are not', () => {
  assert.equal(sniffType(png()), 'image/png');
  assert.equal(sniffType(jpeg()), 'image/jpeg');
  assert.equal(sniffType(Buffer.from('not an image at all really')), null);
  assert.equal(extensionFor('image/jpeg'), '.jpg');
  assert.equal(extensionFor('image/gif'), null);
  assert.equal(extensionFor('text/html'), null);
});

test('the screen payload is capped, because it goes to every device', () => {
  const dir = tempDir();
  try {
    let t = 1000;
    const photos = new Photos(dir, () => (t += 10));
    for (let i = 0; i < 80; i++) photos.add(jpeg(), { contentType: 'image/jpeg' });
    assert.ok(photos.forScreen().length <= 40, photos.forScreen().length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- Foldered by night, and filed away so a restart cannot take them.

test('a night rolls over at 6am, not midnight', () => {
  // A quiz that runs past twelve is still the same night. Half a gig under
  // Tuesday and half under Wednesday would be useless for posting.
  assert.equal(nightOf(Date.parse('2026-08-05T21:30:00Z')), '2026-08-05');
  assert.equal(nightOf(Date.parse('2026-08-06T00:30:00Z')), '2026-08-05', 'still that night');
  assert.equal(nightOf(Date.parse('2026-08-06T01:45:00Z')), '2026-08-05');
  assert.equal(nightOf(Date.parse('2026-08-06T09:00:00Z')), '2026-08-06', 'a new day');
});

test('photos group into nights, newest night first', () => {
  const dir = tempDir();
  try {
    const times = [
      Date.parse('2026-08-05T21:00:00Z'),
      Date.parse('2026-08-06T00:10:00Z'), // same night, past midnight
      Date.parse('2026-08-12T21:00:00Z'), // the following week
    ];
    let i = 0;
    const photos = new Photos(dir, () => times[i]);
    for (; i < times.length; i++) photos.add(jpeg(), { contentType: 'image/jpeg', teamName: `T${i}` });

    const nights = photos.nights();
    assert.equal(nights.length, 2);
    assert.equal(nights[0].night, '2026-08-12', 'newest night first');
    assert.equal(nights[1].night, '2026-08-05');
    assert.equal(nights[1].photos.length, 2, 'the one after midnight belongs to the same night');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a photo is not filed until it actually reaches the repository', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    const { photo } = photos.add(jpeg(), { contentType: 'image/jpeg' });
    assert.equal(photos.unfiled().length, 1, 'not safe yet');
    assert.equal(photos.forHost()[0].filed, false);

    photos.markFiled(photo.id);
    assert.equal(photos.unfiled().length, 0);
    assert.equal(photos.forHost()[0].filed, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('being filed survives a restart, so nothing is uploaded twice', () => {
  const dir = tempDir();
  try {
    const first = new Photos(dir, () => 1000);
    const { photo } = first.add(jpeg(), { contentType: 'image/jpeg' });
    first.markFiled(photo.id);

    const second = new Photos(dir, () => 2000);
    assert.equal(second.unfiled().length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('reading a photo back gives the bytes that were stored', () => {
  const dir = tempDir();
  try {
    const photos = new Photos(dir, () => 1000);
    const original = jpeg(128);
    const { photo } = photos.add(original, { contentType: 'image/jpeg' });
    const read = photos.read(photo.id);
    assert.ok(read.bytes.equals(original));
    assert.equal(photos.read('nope'), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
