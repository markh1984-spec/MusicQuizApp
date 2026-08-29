/**
 * ONLY WHAT A CAMERA TOOK GOES ON THE PUBLIC GALLERY.
 *
 * Asked for again on 29 August 2026: *"can we make it so only photos actually
 * taken on the night appear on the gallery on the website, and the uploaded
 * photos can go on the screen but aren't accessible? Uploaded photos are funny
 * but aren't good promo for the night."*
 *
 * **THE MECHANISM ALREADY EXISTED AND NOTHING TESTED IT**, which is why this
 * file does rather than the feature being built a second time. `add()` writes
 * the marker into the filename, `isCameraFile()` reads it, and `server.js`
 * checks it twice — once when listing a night and again on the single-photo
 * route, because a URL can be typed. A rule with no assertion on it is one
 * refactor away from being a rule nobody applies, and this one fails SILENTLY:
 * the page still loads, it just has somebody's meme on it.
 *
 * **THE PROJECTOR IS UNAFFECTED AND THERE IS A CASE FOR IT BELOW.** The whole
 * point is that a picked photo is fine on the night — *"them appearing on the
 * screen can be fun"* — so this must never turn into a rule that keeps one out
 * of the room. It is a VIEW, like the two-screens rule and the name filter:
 * the same photo, said differently depending on who is looking.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Photos, isCameraFile, NOT_CAMERA_SUFFIX, showsOnGallery } from '../src/photos.js';

/** The smallest thing `sniffType()` will accept as a JPEG. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

function room() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  let t = 1_700_000_000_000;
  return new Photos(dir, () => (t += 1000));
}

test('a photo the camera took carries no marker, and the gallery takes it', () => {
  const shots = room();
  const out = shots.add(JPEG, { contentType: 'image/jpeg', camera: true });
  assert.equal(out.ok, true);
  assert.equal(out.photo.file.includes(NOT_CAMERA_SUFFIX), false);
  assert.equal(isCameraFile(out.photo.file), true);
});

test('a photo picked off the phone is marked, and the gallery refuses it', () => {
  const shots = room();
  const out = shots.add(JPEG, { contentType: 'image/jpeg', camera: false });
  assert.equal(out.ok, true);
  assert.equal(out.photo.file.includes(NOT_CAMERA_SUFFIX), true);
  assert.equal(isCameraFile(out.photo.file), false);
});

test('camera defaults to FALSE, so an unknown photo is kept off the gallery', () => {
  /*
   * IT ERRS THE SAFE WAY, and that is the calibration rather than an accident.
   * `looksCameraTaken()` needs a JPEG with an EXIF Make tag; a photo that has
   * been through a share sheet may have lost it. The two mistakes are not
   * equal — a real photo left off the public page costs the quizmaster one
   * picture out of forty, and a meme ON it is what he said is bad promo.
   */
  const shots = room();
  const out = shots.add(JPEG, { contentType: 'image/jpeg' });
  assert.equal(isCameraFile(out.photo.file), false);
});

test('a marked photo is still in the room list, because the screen still shows it', () => {
  // The rule is a VIEW, never a refusal. If this ever fails, somebody has
  // turned "not on the public page" into "not on the projector", which is the
  // opposite of what was asked for.
  const shots = room();
  const picked = shots.add(JPEG, { contentType: 'image/jpeg', camera: false });
  const taken = shots.add(JPEG, { contentType: 'image/jpeg', camera: true });
  assert.equal(shots.list().length, 2);
  assert.ok(shots.list().some((i) => i.file === picked.photo.file));
  assert.ok(shots.list().some((i) => i.file === taken.photo.file));
});

/**
 * AND A HUMAN OVERRULES THE GUESS, IN BOTH DIRECTIONS.
 *
 * Asked for on 29 August 2026: *"there may be some that were uploaded but are
 * appropriate for a public gallery that I can switch on."* The same shape as
 * the team-name override, for the same reason: the guess is wrong BOTH ways —
 * it misses a real photograph whose EXIF a share sheet stripped, and it passes
 * a screenshot somebody took with their own camera app.
 */
test('a ruling beats the filename, either way', () => {
  assert.equal(showsOnGallery('p1abc.jpg', undefined), true);
  assert.equal(showsOnGallery('p1abc-picked.jpg', undefined), false);
  // The two overrides, which are the whole feature.
  assert.equal(showsOnGallery('p1abc-picked.jpg', 'on'), true);
  assert.equal(showsOnGallery('p1abc.jpg', 'off'), false);
});

test('an unknown ruling falls back to the filename rather than becoming a third state', () => {
  // The file lives in a repository a human can edit. A typo in it must not
  // invent a behaviour — `photoDecisions()` drops anything that is not on/off,
  // and this is the belt to that braces.
  for (const junk of ['yes', 'true', '1', '', null]) {
    assert.equal(showsOnGallery('p1abc-picked.jpg', junk), false);
    assert.equal(showsOnGallery('p1abc.jpg', junk), true);
  }
});

test('ALL THREE READERS ASK THE ONE FUNCTION', () => {
  /*
   * A SOURCE CHECK, and it is the honest shape for this one: the routes read
   * the private repository, so running them needs a GitHub token this suite
   * does not have and must not need.
   *
   * What it guards is that there is ONE decision. The gallery listing, the
   * single-photo route (which re-checks, because a URL can be typed and that
   * photo's name was on the projector all night) and the console's own pill
   * all have to answer the same way — and the day one of them does not is the
   * day a photograph is on a page the console swears is private.
   */
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const listing = src.slice(src.indexOf("if (route.startsWith('/api/gallery/'"));
  assert.ok(listing.slice(0, 2400).includes('showsOnGallery'),
    'the gallery LISTING must ask showsOnGallery()');
  const one = src.slice(src.indexOf("if (route.startsWith('/gallery-photo/'"));
  assert.ok(one.slice(0, 1600).includes('showsOnGallery'),
    'the single-photo route must ask it too — a URL can be typed');
  /*
   * The night's own listing, NOT the report route that shares its prefix — the
   * same prefix trap `/report.pdf` already exists above to avoid, wearing a
   * test's clothes this time.
   */
  const console_ = src.slice(src.indexOf("if (route.startsWith('/api/past-gigs/')) {"));
  assert.ok(console_.slice(0, 3000).includes('showsOnGallery'),
    "the console's per-photo pill must ask it as well, or it will disagree with the page");
});
