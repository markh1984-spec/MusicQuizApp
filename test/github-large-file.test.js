/**
 * THE FILE GITHUB WOULD NOT INLINE, AND THE ZERO BYTES IT SENT INSTEAD.
 *
 * The Contents API only returns a file's bytes inline up to 1MB. Above that it
 * still answers **200**, with the metadata intact and `content: ''` — which is
 * a perfectly good string, so the type check passed and
 * `Buffer.from('', 'base64')` handed back an EMPTY BUFFER as a success.
 *
 * On the gallery that is a broken photograph reported as `ok: true`: nothing
 * logged, nothing retried, and no way for the caller to tell it from a real
 * file. Both upload paths shrink to 1280/1600px at quality 0.85 so it is
 * unlikely in practice — but the server accepts up to 3MB, and a crowded pub
 * is the densest thing you can hand a JPEG encoder.
 *
 * The fix asks again with the raw media type, which has no such ceiling. This
 * test is the fault reproduced: put `rawGet` back to returning the envelope
 * and the first assertion fails on a zero-length buffer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const BIG = Buffer.alloc(1_500_000, 9);

/** GitHub's own behaviour for a file over the inline limit. */
function fakeGitHub({ raw = BIG } = {}) {
  const seen = { envelope: 0, raw: 0 };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('https://api.github.com/')) return real(input, init);
    const accept = (init.headers || {}).Accept || '';
    if (accept.includes('raw')) {
      seen.raw += 1;
      if (!raw) return new Response('no', { status: 500 });
      return new Response(raw, { status: 200 });
    }
    seen.envelope += 1;
    // Over 1MB: 200, real size, and NO content.
    return new Response(JSON.stringify({
      name: 'big.jpg', size: BIG.length, content: '', encoding: 'none',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { seen, stop: () => { globalThis.fetch = real; } };
}

async function withRepo(run) {
  const prev = { ...process.env };
  process.env.PHOTO_REPO = 'someone/private';
  process.env.PHOTO_TOKEN = 'tok';
  process.env.PHOTO_BRANCH = 'main';
  try {
    return await run();
  } finally {
    for (const k of ['PHOTO_REPO', 'PHOTO_TOKEN', 'PHOTO_BRANCH']) {
      if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k];
    }
  }
}

const { tryGetFile, getFile } = await import('../src/github.js');

test('a file over the 1MB inline limit comes back WHOLE, not as zero bytes', async () => {
  await withRepo(async () => {
    const gh = fakeGitHub();
    try {
      const read = await tryGetFile('photos/room/night/big.jpg', 'photos');
      assert.equal(read.ok, true);
      assert.equal(read.body.length, BIG.length,
        'an empty inline body must not be served as a successful read');
      assert.equal(gh.seen.raw, 1, 'it asked again with the raw media type');
    } finally { gh.stop(); }
  });
});

test('and if the raw read fails too, that is a failure to LOOK — never an empty answer', async () => {
  await withRepo(async () => {
    const gh = fakeGitHub({ raw: null });
    try {
      const read = await tryGetFile('photos/room/night/big.jpg', 'photos');
      assert.equal(read.ok, false, 'a caller that latches must not record this as "empty"');
      // getFile() flattens to null, which is the ninety call sites' contract.
      assert.equal(await getFile('photos/room/night/big.jpg', 'photos'), null);
    } finally { gh.stop(); }
  });
});

test('an ordinary small file still takes one call and never asks for raw', async () => {
  await withRepo(async () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://api.github.com/')) return real(input, init);
      calls += 1;
      return new Response(JSON.stringify({
        size: 5, content: Buffer.from('hello').toString('base64'), encoding: 'base64',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      const read = await tryGetFile('photos/room/night/small.jpg', 'photos');
      assert.equal(String(read.body), 'hello');
      assert.equal(calls, 1, 'the common path must not have grown a second call');
    } finally { globalThis.fetch = real; }
  });
});

test('a 404 is still an ANSWER, not a failure', async () => {
  await withRepo(async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async () => new Response('', { status: 404 });
    try {
      const read = await tryGetFile('photos/room/night/gone.jpg', 'photos');
      assert.deepEqual(read, { ok: true, body: null });
    } finally { globalThis.fetch = real; }
  });
});
