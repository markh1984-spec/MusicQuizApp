/**
 * Advertising slides.
 *
 * This is the one feature that earns money rather than spending it, so the
 * things worth testing are the ones that would embarrass him in front of a
 * venue: a slide that says nothing, a QR nobody knows what to scan for, and
 * a slide appearing over a live question.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  validateAdvertPack, normaliseAdvertPack, saveAdvertPack, loadAdvertPack,
  listAdvertPacks, deleteAdvertPack, safeAdvertFile, isSafeLink, findSlide,
} from '../src/adverts.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-ads-'));
}

function goodSet(extra = {}) {
  return {
    id: 'the-crown',
    title: 'The Crown',
    venue: 'The Crown, Chelmsford',
    slides: [
      { id: 's1', heading: 'PIZZA — 2 FOR 1', body: 'Kitchen open till 10.', say: 'Mention the pizza deal' },
      { id: 's2', heading: 'THE RIFFRAFF, 28TH', body: 'Live at 9.', link: 'https://tickets.example.com/riffraff', linkLabel: 'Tickets' },
    ],
    ...extra,
  };
}

test('a well formed set is valid', () => {
  assert.deepEqual(validateAdvertPack(goodSet()), []);
});

test('a set needs a title and at least one slide', () => {
  assert.match(validateAdvertPack({ slides: [] }).join(' '), /needs a title/);
  assert.match(validateAdvertPack({ title: 'X', slides: [] }).join(' '), /no slides/);
});

test('a slide with nothing on it is caught', () => {
  const set = goodSet();
  set.slides[0] = { id: 's1', heading: '', body: '' };
  assert.match(validateAdvertPack(set).join(' '), /nothing on it/);
});

test('a heading alone is a perfectly good slide', () => {
  // "PIZZA 2 FOR 1 TONIGHT" needs no more than that.
  const set = goodSet();
  set.slides = [{ id: 's1', heading: 'PIZZA — 2 FOR 1 TONIGHT' }];
  assert.deepEqual(validateAdvertPack(set), []);
});

test('a QR code with no words is caught — nobody scans a mystery', () => {
  const set = goodSet();
  set.slides = [{ id: 's1', heading: '', body: '', link: 'https://example.com' }];
  const problems = validateAdvertPack(set).join(' ');
  assert.match(problems, /needs to know what they are scanning|nothing on it/);
});

test('only real web links become QR codes', () => {
  assert.equal(isSafeLink('https://tickets.example.com/gig'), true);
  assert.equal(isSafeLink('http://example.com'), true);
  assert.equal(isSafeLink('javascript:alert(1)'), false);
  assert.equal(isSafeLink('data:text/html,<script>'), false);
  assert.equal(isSafeLink('tickets.example.com'), false, 'no scheme');
  assert.equal(isSafeLink(''), false);

  const set = goodSet();
  set.slides[1].link = 'javascript:alert(1)';
  assert.match(validateAdvertPack(set).join(' '), /does not look like a web address/);
});

test('a set survives a save and load, venue and all', () => {
  const dir = tempDir();
  try {
    saveAdvertPack(dir, 'the-crown', goodSet());
    const loaded = loadAdvertPack(dir, 'the-crown');
    assert.equal(loaded.venue, 'The Crown, Chelmsford');
    assert.equal(loaded.slides.length, 2);
    assert.equal(loaded.slides[1].link, 'https://tickets.example.com/riffraff');

    const listed = listAdvertPacks(dir);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].slideCount, 2);
    // The list says which slides have a QR, so the picker can badge them.
    assert.deepEqual(listed[0].slides.map((s) => s.hasLink), [false, true]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('saving an invalid set is refused rather than written', () => {
  const dir = tempDir();
  try {
    const bad = goodSet();
    bad.slides[0] = { id: 's1' };
    assert.throws(() => saveAdvertPack(dir, 'bad', bad), /not valid/);
    assert.equal(fs.existsSync(path.join(dir, 'bad.json')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an advert id cannot escape the folder', () => {
  assert.equal(safeAdvertFile('the-crown'), 'the-crown.json');
  assert.throws(() => safeAdvertFile('../../etc/passwd'), /Bad advert id/);
  assert.throws(() => safeAdvertFile(''), /Bad advert id/);
});

test('the host line is kept, and is not part of what the slide says', () => {
  // `say` is for the mic. It has to survive a save, and it must never be
  // mistaken for screen copy.
  const norm = normaliseAdvertPack(goodSet());
  assert.equal(norm.slides[0].say, 'Mention the pizza deal');
  assert.equal(norm.slides[0].body, 'Kitchen open till 10.');
});

test('over-long copy is cut rather than allowed onto a projector', () => {
  const norm = normaliseAdvertPack({
    title: 'X',
    slides: [{ heading: 'H'.repeat(200), body: 'B'.repeat(500) }],
  });
  assert.ok(norm.slides[0].heading.length <= 60);
  assert.ok(norm.slides[0].body.length <= 160);
});

test('finding one slide by id, for putting it on the screen', () => {
  const dir = tempDir();
  try {
    saveAdvertPack(dir, 'the-crown', goodSet());
    const found = findSlide(dir, 'the-crown', 's2');
    assert.equal(found.slide.heading, 'THE RIFFRAFF, 28TH');
    assert.equal(found.pack.venue, 'The Crown, Chelmsford');
    assert.equal(findSlide(dir, 'the-crown', 'nope'), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deleting a set removes the file', () => {
  const dir = tempDir();
  try {
    saveAdvertPack(dir, 'the-crown', goodSet());
    deleteAdvertPack(dir, 'the-crown');
    assert.equal(listAdvertPacks(dir).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
