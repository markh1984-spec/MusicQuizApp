/**
 * THE RUDE-PHOTO CHECK — `src/moderation.js`.
 *
 * The score decides whether a photograph is flagged for the host to look at,
 * so the tests are about the two things that matter: the line it draws on a
 * SafeSearch annotation, and that it is INERT and silent when there is no key
 * or the call fails — a night must read exactly as it does today unless the
 * Vision API is set up and answers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { flagFrom, scorePhoto, moderationConfigured } from '../src/moderation.js';

const withKey = async (fn) => {
  const had = process.env.GOOGLE_API_KEY;
  const hadUrl = process.env.VISION_URL;
  process.env.GOOGLE_API_KEY = 'test-key';
  process.env.VISION_URL = 'https://vision.example';
  try { await fn(); } finally {
    if (had === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = had;
    if (hadUrl === undefined) delete process.env.VISION_URL; else process.env.VISION_URL = hadUrl;
  }
};

const reply = (annotation) => ({
  ok: true,
  async json() { return { responses: [{ safeSearchAnnotation: annotation }] }; },
  async text() { return ''; },
});

test('flagFrom draws the line: adult a rung lower than racy, and errs to flag', () => {
  assert.equal(flagFrom({ adult: 'VERY_LIKELY', racy: 'UNLIKELY' }), 'adult');
  assert.equal(flagFrom({ adult: 'LIKELY', racy: 'UNLIKELY' }), 'adult');
  // adult below its line, racy at the top → racy
  assert.equal(flagFrom({ adult: 'POSSIBLE', racy: 'VERY_LIKELY' }), 'racy');
  // racy only LIKELY (below its VERY_LIKELY line) → nothing, so an ordinary
  // beach or gym photo does not flag half the wall
  assert.equal(flagFrom({ adult: 'POSSIBLE', racy: 'LIKELY' }), '');
  assert.equal(flagFrom({ adult: 'UNLIKELY', racy: 'UNLIKELY' }), '');
  assert.equal(flagFrom({}), '');
  // adult beats racy when both fire — one marker, the stronger word
  assert.equal(flagFrom({ adult: 'VERY_LIKELY', racy: 'VERY_LIKELY' }), 'adult');
});

test('scorePhoto maps a SafeSearch reply to a level and records the spend', async () => {
  await withKey(async () => {
    const spent = [];
    const fetchImpl = async (url, opts) => {
      assert.match(url, /vision\.example\/images:annotate\?key=test-key/);
      const body = JSON.parse(opts.body);
      assert.ok(body.requests[0].image.content, 'the image goes as base64');
      assert.equal(body.requests[0].features[0].type, 'SAFE_SEARCH_DETECTION');
      return reply({ adult: 'VERY_LIKELY', racy: 'POSSIBLE' });
    };
    const r = await scorePhoto(Buffer.from('a photo'), { fetchImpl, onSpend: (row) => spent.push(row) });
    assert.equal(r.level, 'adult');
    assert.equal(spent.length, 1);
    assert.equal(spent[0].kind, 'moderation');
    assert.equal(spent[0].provider, 'google');
  });
});

test('a clean photo is not flagged and still costs a check', async () => {
  await withKey(async () => {
    const spent = [];
    const r = await scorePhoto(Buffer.from('x'), {
      fetchImpl: async () => reply({ adult: 'VERY_UNLIKELY', racy: 'UNLIKELY' }),
      onSpend: (row) => spent.push(row),
    });
    assert.equal(r.level, '');
    assert.equal(spent.length, 1, 'a check ran, so it is billed even when clean');
  });
});

test('no key is inert and silent — no flag, no spend, no throw', async () => {
  const had = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  try {
    assert.equal(moderationConfigured(), false);
    const spent = [];
    const r = await scorePhoto(Buffer.from('x'), {
      fetchImpl: async () => { throw new Error('must not be called'); },
      onSpend: (row) => spent.push(row),
    });
    assert.equal(r.level, '');
    assert.equal(spent.length, 0);
  } finally {
    if (had === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = had;
  }
});

test('a failed check is not a flag — an outage costs nothing, never a false positive', async () => {
  await withKey(async () => {
    const thrown = await scorePhoto(Buffer.from('x'), { fetchImpl: async () => { throw new Error('network down'); } });
    assert.equal(thrown.level, '');
    assert.match(thrown.error, /network down/);

    const refused = await scorePhoto(Buffer.from('x'), {
      fetchImpl: async () => ({ ok: false, status: 403, async text() { return 'Vision API disabled'; } }),
    });
    assert.equal(refused.level, '');
    assert.match(refused.error, /403/);
  });
});

test('an empty photo is not scored', async () => {
  await withKey(async () => {
    const r = await scorePhoto(Buffer.alloc(0), { fetchImpl: async () => { throw new Error('must not be called'); } });
    assert.equal(r.level, '');
  });
});
