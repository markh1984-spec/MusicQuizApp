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
import {
  imageJobs, imagePlan, promptFor, generateImages, artProvider, PROVIDERS,
} from '../src/generate-images.js';

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

/*
 * THE WORD THAT WOULD HAVE BROKEN EVERY PICTURE ON DAY ONE.
 *
 * Tested by hand against Google: "do me a Michael Jackson cartoon" is drawn,
 * "an illustration" of the same person is refused. Every prompt this app sends
 * used to end "It must clearly be an illustration and not a photograph" — so
 * every style, on every question, would have come back refused, and from the
 * console that looks exactly like a bad key.
 *
 * The guarantee underneath it is unchanged and tested above: nothing may ask
 * for a photograph. This only pins HOW that is said.
 */
test('no prompt asks for an illustration, which is the word that gets refused', () => {
  for (const id of Object.keys(STYLES)) {
    const text = promptFor(picture('Prince'), { style: id });
    assert.doesNotMatch(text, /illustration/i, `${id} asks for an illustration and will be refused`);
    assert.match(text, /cartoon/i, `${id} is not in the register that is known to work`);
  }
});

test('there is no painted or true-to-life style left, and cartoon is the default', () => {
  // The host's call once the realistic end turned out to be off the table:
  // do not ship a setting that pretends we can do it.
  assert.equal(DEFAULT_STYLE, 'cartoon');
  assert.ok(!('portrait' in STYLES), 'the painted style is back, and it gets refused');
  for (const st of Object.values(STYLES)) {
    assert.doesNotMatch(st.prompt, /painting|painted|true to life|lifelike/i);
  }
});

/*
 * Which supplier gets billed is worked out from what is CONFIGURED, never sent
 * up from the browser — the same shape of hole `POST /api/quiz` had. It also
 * means the switch away from a dead OpenAI account needed no console change.
 */
test('the cheaper picture supplier wins, and no key means no real pictures', () => {
  const before = { g: process.env.GOOGLE_API_KEY, o: process.env.OPENAI_API_KEY };
  try {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    assert.equal(artProvider(), '', 'it offered to spend money with no key set');

    process.env.OPENAI_API_KEY = 'sk-test';
    assert.equal(artProvider(), 'openai');

    process.env.GOOGLE_API_KEY = 'AIza-test';
    assert.equal(artProvider(), 'google', 'the dearer supplier won');

    for (const p of ['placeholder', 'google', 'openai']) assert.ok(PROVIDERS.includes(p));
  } finally {
    if (before.g === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = before.g;
    if (before.o === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = before.o;
  }
});

/*
 * The Google request, pinned against a stub.
 *
 * Written because it CANNOT be checked from here — this container's egress
 * policy blocks Google — so the first real call is on the host's machine, and
 * a typo in a field name would look like a broken key at the worst moment.
 * Every assertion below is a thing the API cares about.
 */
async function withStubbedFetch(reply, run) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return reply;
  };
  try {
    return { result: await run(), calls };
  } finally {
    globalThis.fetch = real;
  }
}

const okImage = (b64) => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: b64 } }] } }] }),
  text: async () => '',
});

test('the Google request says what the image model needs it to say', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portraits-g-'));
  const before = process.env.GOOGLE_API_KEY;
  process.env.GOOGLE_API_KEY = 'AIza-test';
  try {
    const quiz = quizOf(picture('Madonna'));
    const png = Buffer.from('pretend-png').toString('base64');
    const { result, calls } = await withStubbedFetch(okImage(png), () => generateImages({
      quiz, imageDir: dir, provider: 'google', quality: 'low',
    }));

    assert.deepEqual(result.made, ['portraits/madonna.png']);
    assert.equal(fs.readFileSync(path.join(dir, 'portraits/madonna.png'), 'utf8'), 'pretend-png');

    assert.equal(calls.length, 1);
    const [{ url, opts }] = calls;
    // Quality picks the model, so `low` must be the Fast one or the cheap
    // setting quietly bills at the standard rate.
    assert.match(url, /gemini-3\.1-flash-lite-image:generateContent$/);
    assert.equal(opts.headers['x-goog-api-key'], 'AIza-test');

    const body = JSON.parse(opts.body);
    assert.equal(body.contents.length, 1);
    assert.match(body.contents[0].parts[0].text, /Madonna/);
    // An image model here is an ordinary generateContent call. Reaching for
    // Imagen's `instances`/`parameters` shape is what the first attempt did,
    // and it 404s: Imagen is a Vertex model on `:predict`, shut off in
    // August 2026 and already closed to new keys.
    assert.ok(!('instances' in body), 'this is the retired Imagen request shape');
    // These models default to landscape where Imagen defaulted to square, and
    // the projector crops to fill — so a wide picture loses its sides before
    // anybody sees it.
    assert.equal(body.generationConfig.imageConfig.aspectRatio, '1:1');
  } finally {
    if (before === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = before;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a refused picture is reported in words, and the rest of the round carries on', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portraits-r-'));
  const before = process.env.GOOGLE_API_KEY;
  process.env.GOOGLE_API_KEY = 'AIza-test';
  const said = [];
  try {
    const quiz = quizOf(picture('Madonna'), { ...picture('Prince'), id: 'q2' });
    // A block is a 200 with no image part — indistinguishable from a bug here
    // unless the reason is dug out and said.
    const refused = {
      ok: true, status: 200,
      json: async () => ({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] }),
      text: async () => '',
    };
    const { result } = await withStubbedFetch(refused, () => generateImages({
      quiz, imageDir: dir, provider: 'google', log: (l) => said.push(l),
    }));

    // Both refused, neither thrown — nine portraits and one stand-in is a round
    // you can still run tonight.
    assert.equal(result.made.length, 0);
    assert.equal(result.failed.length, 2);
    const why = said.join('\n');
    assert.match(why, /IMAGE_SAFETY/, 'the reason was swallowed');
    assert.match(why, /different style/i, 'it does not say what to do about it');
  } finally {
    if (before === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = before;
    fs.rmSync(dir, { recursive: true, force: true });
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
    // quietly reporting a saving that will not happen. `superhero` rather than
    // `cartoon`, which is the DEFAULT now and therefore the unsuffixed file.
    assert.equal(imagePlan(quiz, dir, { style: 'superhero' }).reused, 0);
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
