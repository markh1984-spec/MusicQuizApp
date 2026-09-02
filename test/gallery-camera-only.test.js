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

import {
  Photos, isCameraFile, NOT_CAMERA_SUFFIX, showsOnGallery, showsByDefault, galleryPhotosOf,
} from '../src/photos.js';

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
test('WITH NO RULING, EVERY PHOTOGRAPH IS ON — the camera guess is not the gate', () => {
  /*
   * REVERSED ON 2 SEPTEMBER 2026, and this test is the reversal rather than a
   * weakening of the old one. The guess held back EVERY photograph of a real
   * night — reported as a gallery that said published and showed nothing — so
   * what it filtered was not memes, it was everything.
   *
   * The gate is now the human review the publish button already forces.
   */
  assert.equal(showsOnGallery('p1abc.jpg', undefined), true);
  assert.equal(showsOnGallery('p1abc-picked.jpg', undefined), true,
    'the camera marker is still acting as a gate');
  // The overrides, and switching OFF is now the one that carries the feature.
  assert.equal(showsOnGallery('p1abc-picked.jpg', 'off'), false);
  assert.equal(showsOnGallery('p1abc.jpg', 'off'), false);
  assert.equal(showsOnGallery('p1abc-picked.jpg', 'on'), true);
});

test('an unknown ruling falls back to the default rather than becoming a third state', () => {
  // The file lives in a repository a human can edit. A typo in it must not
  // invent a behaviour — `photoDecisions()` drops anything that is not on/off,
  // and this is the belt to that braces.
  for (const junk of ['yes', 'true', '1', '', null]) {
    assert.equal(showsOnGallery('p1abc-picked.jpg', junk), true);
    assert.equal(showsOnGallery('p1abc.jpg', junk), true);
  }
});

/**
 * THE ROUTE THAT CLEARS A REDUNDANT RULING MUST ASK THE SAME FUNCTION.
 *
 * This is the trap the reversal walked into and stepped over. `/api/gallery-photo/`
 * clears a ruling that only restates the default, so that a later change to
 * the default can still reach the photograph. It had the OLD default written
 * out a second time as `isCameraFile(name)` — so flipping `showsOnGallery()`
 * alone would have made pressing a lamp RED on a `-picked` photograph compute
 * "that agrees with the guess", clear the ruling, and let the new default put
 * the photograph straight back ON.
 *
 * A control that silently undoes itself, with nothing thrown anywhere. So the
 * two expressions are one function now, and this says so.
 */
test('THE CLEARING RULE AND THE FALLBACK ARE ONE FUNCTION', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(src, /on === showsByDefault\(name\)/,
    'the ruling route is not asking showsByDefault() — a second copy of the default has crept back');
  assert.equal(src.includes('on === isCameraFile(name)'), false,
    'the route still uses the old camera guess as the default it compares against');
  // And the fallback itself, so the pair cannot drift from the other side.
  for (const name of ['p1abc.jpg', 'p1abc-picked.jpg']) {
    assert.equal(showsOnGallery(name, undefined), showsByDefault(name),
      'showsOnGallery does not fall back to showsByDefault');
  }
});

test('ALL FOUR READERS ASK THE ONE FUNCTION', () => {
  /*
   * A SOURCE CHECK, and it is the honest shape for this one: the routes read
   * the private repository, so running them needs a GitHub token this suite
   * does not have and must not need.
   *
   * What it guards is that there is ONE decision. Four things answer "is this
   * photograph public" and every one of them has to answer the same way — the
   * day one does not is the day a photograph is on a page the console swears
   * is private.
   *
   * **IT SAID THREE, AND THE MISSING FOURTH IS THE ONE THAT WENT WRONG.** The
   * slice below started at `/api/gallery/` — with the slash, which is a NIGHT'S
   * OWN PAGE. The night LIST is `/api/gallery` without it, and it was never
   * looked at, so it spent weeks counting on the filename alone while the page
   * it was counting for asked the full question. A guard aimed one character
   * off its target passes for ever and proves nothing, which is this repo's
   * oldest lesson wearing a URL this time.
   *
   * `galleryPhotosOf()` counts as asking: it is `showsOnGallery()` over a
   * list, in the module that owns the decision.
   */
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  /*
   * THE COMMENTS COME OUT FIRST, and this was found by putting the fault back.
   *
   * The fix for the count drift left a paragraph above it explaining what had
   * gone wrong — a paragraph that names `showsOnGallery()`. So when the broken
   * line was restored underneath to check this test could see it, the test
   * passed: it had matched the note ABOUT the rule instead of the rule. A
   * source check that its own documentation satisfies is a check that goes
   * green the better a file is commented, which in this repo is always.
   */
  const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const asks = (text) => {
    const bare = code(text);
    return bare.includes('showsOnGallery') || bare.includes('galleryPhotosOf');
  };

  // The LIST of nights — up to where the night's own page begins.
  const listAt = src.indexOf("if (route === '/api/gallery'");
  assert.ok(listAt > -1, 'the night list route must still be findable');
  const list = src.slice(listAt, src.indexOf("if (route.startsWith('/api/gallery/'"));
  assert.ok(list.length > 0 && asks(list),
    'the night LIST must ask it, or its count will disagree with the page it counts');

  /*
   * EACH SLICE RUNS TO THE NEXT ROUTE, NEVER A CHARACTER COUNT.
   *
   * These were fixed windows — 2,400 characters and 1,600 — and adding the
   * venue and the night-to-night navigation pushed the call past the end of
   * the first one, so a correct route failed. The other way round is worse and
   * is the real reason: a window that no longer reaches the code it was aimed
   * at goes on passing while covering nothing, which is this file's own
   * subject wearing a different hat. A route's boundary is the next route.
   */
  const between = (from, to) => {
    const a = src.indexOf(from);
    assert.ok(a > -1, `${from} — has this route moved?`);
    const b = to ? src.indexOf(to, a + 1) : -1;
    assert.ok(!to || b > a, `${to} — has this route moved?`);
    return src.slice(a, b > a ? b : undefined);
  };

  assert.ok(asks(between("if (route.startsWith('/api/gallery/'", "if (route.startsWith('/gallery-photo/'")),
    "a night's own PAGE must ask it");
  assert.ok(asks(between("if (route.startsWith('/gallery-photo/'", "if (route.startsWith('/past-photo/'")),
    'the single-photo route must ask it too — a URL can be typed');
  /*
   * The night's own listing, NOT the report route that shares its prefix — the
   * same prefix trap `/report.pdf` already exists above to avoid, wearing a
   * test's clothes this time.
   */
  const console_ = src.slice(src.indexOf("if (route.startsWith('/api/past-gigs/')) {"));
  assert.ok(asks(console_.slice(0, 3000)),
    "the console's per-photo pill must ask it as well, or it will disagree with the page");
});

/*
 * THE COUNT AND THE PAGE ARE ONE QUESTION.
 *
 * The night list said "N photos" and the night's page showed the photos, and
 * for a while they were worked out by two different filters a screen apart —
 * the list on the filename alone, the page on the filename AND the human's
 * ruling. So the first time a photograph was switched off by hand the list
 * over-counted, and switching a whole night off left a date in the list whose
 * page was blank. Nothing threw; the page simply lied about itself.
 *
 * `galleryPhotosOf()` is now the only way either of them asks, so these cases
 * are about that function rather than about two call sites staying in step.
 */

const key = (night, name) => `${night}/${name}`;

test('the list and the page count the same photographs', () => {
  const night = '2026-08-13';
  const names = ['a.jpg', 'b-picked.jpg', 'c.jpg'];
  const said = {};
  // Nothing ruled on: every one of them shows, the picked one included.
  assert.deepEqual(galleryPhotosOf(names, night, said, key), names);
});

test('switching one off takes it out of the count as well as off the page', () => {
  const night = '2026-08-13';
  const names = ['a.jpg', 'b-picked.jpg', 'c.jpg'];
  const said = { [key(night, 'a.jpg')]: 'off' };
  assert.deepEqual(galleryPhotosOf(names, night, said, key), ['b-picked.jpg', 'c.jpg']);
});

test('switching a picked one ON puts it in the count as well as on the page', () => {
  const night = '2026-08-13';
  const names = ['a.jpg', 'b-picked.jpg'];
  const said = { [key(night, 'b-picked.jpg')]: 'on' };
  assert.deepEqual(galleryPhotosOf(names, night, said, key), ['a.jpg', 'b-picked.jpg']);
});

test('a night with every photograph switched off counts NOTHING, so it is not listed', () => {
  /*
   * This is the case the list's own `if (count)` is there to catch — a night
   * whose page is a heading over a blank space. Counting on the filename alone
   * could never see it, because switching a photo off does not rename it.
   */
  const night = '2026-08-13';
  const names = ['a.jpg', 'c.jpg'];
  const said = { [key(night, 'a.jpg')]: 'off', [key(night, 'c.jpg')]: 'off' };
  assert.equal(galleryPhotosOf(names, night, said, key).length, 0);
});

test("a ruling on ANOTHER night does not reach this one", () => {
  const names = ['a.jpg'];
  const said = { [key('2026-08-20', 'a.jpg')]: 'off' };
  assert.deepEqual(galleryPhotosOf(names, '2026-08-13', said, key), ['a.jpg']);
});
