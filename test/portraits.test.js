/**
 * The shared portrait library.
 *
 * The tests that matter are the two that cost real money: a picture keyed on
 * anything Claude wrote (which would silently spawn a second Madonna per quiz),
 * and a style that quietly reuses another style's artwork.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  STYLES, DEFAULT_STYLE, DEFAULT_QUALITY, QUALITIES,
  portraitPath, readPortraitPath, slugName, findStyle, findQuality, musicianOf, isShared,
} from '../src/portraits.js';
import { imageJobs, imagePlan, promptFor, generateImages } from '../src/generate-images.js';

const picture = (answer, extra = {}) => ({
  id: 'q1', prompt: 'Who is this?', options: [answer, 'Someone', 'Else', 'Again'],
  correctIndex: 0, image: `oldquiz/${slugName(answer)}.png`, ...extra,
});
const quizOf = (...questions) => ({
  id: 'test', title: 'Test', rounds: [{ type: 'image', questions }],
});

test('the same musician is the same file whatever quiz asks for them', () => {
  // The whole saving. Two packs, two different image prompts written by Claude,
  // one picture and one bill.
  const a = quizOf(picture('Madonna', { imagePrompt: 'Madonna in 1984, lace gloves' }));
  const b = quizOf(picture('Madonna', { imagePrompt: 'Madonna, Ray of Light era, blue light' }));
  assert.equal(imageJobs(a)[0].wants, imageJobs(b)[0].wants);
  assert.equal(imageJobs(a)[0].wants, 'portraits/madonna.png');
});

test('one spelling is one file', () => {
  assert.equal(slugName('Beyoncé'), 'beyonce');
  assert.equal(slugName('Simon & Garfunkel'), 'simon-and-garfunkel');
  assert.equal(slugName('  The B-52s  '), 'the-b-52s');
  assert.equal(slugName(''), 'unknown');
});

test('a style is its own library, never a reuse of another one', () => {
  const seen = new Set(Object.keys(STYLES).map((s) => portraitPath('Prince', s)));
  assert.equal(seen.size, Object.keys(STYLES).length, 'two styles share a filename');
});

test('the default style keeps the plain name, so an existing library still fits', () => {
  assert.equal(portraitPath('Prince'), 'portraits/prince.png');
  assert.equal(portraitPath('Prince', DEFAULT_STYLE), 'portraits/prince.png');
  assert.match(portraitPath('Prince', 'superhero'), /--superhero\.png$/);
});

test('a portrait path reads back as who and which style', () => {
  assert.deepEqual(readPortraitPath('portraits/prince.png'), { slug: 'prince', style: DEFAULT_STYLE });
  assert.deepEqual(readPortraitPath('portraits/prince--cartoon.png'), { slug: 'prince', style: 'cartoon' });
  assert.equal(readPortraitPath('eighties/prince.png'), null);
});

test('a nonsense style or quality falls back rather than throwing', () => {
  assert.equal(findStyle('photoreal-deepfake'), DEFAULT_STYLE);
  assert.equal(findQuality('ultra'), DEFAULT_QUALITY);
  for (const q of QUALITIES) assert.equal(findQuality(q), q);
});

test('there is no photoreal style, and every style says it is not a photograph', () => {
  // The on-screen caption "AI-generated illustration — not a real photograph"
  // is doing legal work, and a prompt that contradicts it undoes that.
  for (const id of Object.keys(STYLES)) {
    assert.doesNotMatch(id, /photo|real(?!ly)/, `${id} reads as a photographic style`);
    const text = promptFor(picture('Prince'), { style: id });
    assert.match(text, /not a photograph/i, `${id} does not rule out a photograph`);
    assert.match(text, /no text, lettering/i, `${id} could write the answer on the picture`);
  }
});

test("the host's chosen style beats whatever Claude wrote", () => {
  // Otherwise picking "as a superhero" would do nothing at all on any question
  // where the generator happened to write a prompt of its own — which is most
  // of them — and it would look like the setting was broken.
  const q = picture('Prince', { imagePrompt: 'A quiet pencil sketch of Prince' });
  const text = promptFor(q, { style: 'superhero' });
  assert.match(text, /superhero/i);
  assert.match(text, /Prince/, 'it stopped describing the person');
});

test('the plan says what is free before anything is spent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portraits-'));
  try {
    fs.mkdirSync(path.join(dir, 'portraits'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'portraits/madonna.png'), 'x');

    const quiz = quizOf(picture('Madonna'), { ...picture('Prince'), id: 'q2' });
    const plan = imagePlan(quiz, dir);
    assert.equal(plan.total, 2);
    assert.equal(plan.reused, 1);
    assert.equal(plan.toDraw, 1);
    assert.deepEqual(plan.need, ['Prince']);

    // A different style shares nothing, and the plan has to say so rather than
    // quietly reporting a saving that will not happen.
    assert.equal(imagePlan(quiz, dir, { style: 'cartoon' }).reused, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('making the pictures moves an old pack onto the shared library', async () => {
  // A pack written before the library existed points at `oldquiz/madonna.png`.
  // Drawing its pictures has to repoint it, or the sharing buys nothing and the
  // next quiz pays for Madonna all over again.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portraits-'));
  try {
    const quiz = quizOf(picture('Madonna'));
    const before = quiz.rounds[0].questions[0].image;
    const result = await generateImages({ quiz, imageDir: dir, provider: 'placeholder' });

    assert.equal(before, 'oldquiz/madonna.png');
    assert.equal(quiz.rounds[0].questions[0].image, 'portraits/madonna.png');
    assert.deepEqual(result.repointed, [{ id: 'q1', from: before, to: 'portraits/madonna.png' }]);
    assert.equal(result.made.length, 1);

    // And a second run has nothing to move and nothing to draw.
    const again = await generateImages({ quiz, imageDir: dir, provider: 'placeholder' });
    assert.deepEqual(again.repointed, []);
    assert.equal(again.skipped.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an old per-quiz picture is recognised as not shared', () => {
  assert.equal(isShared('portraits/madonna.png'), true);
  assert.equal(isShared('eighties/madonna.png'), false);
});

test('the musician is the answer, not the first option', () => {
  assert.equal(musicianOf({ options: ['A', 'Kate Bush'], correctIndex: 1 }), 'Kate Bush');
  assert.equal(musicianOf({}), '');
});
