/**
 * THE SHA A WRITE SENDS, AND THE 409 THAT REACHED A LIVE CONSOLE.
 *
 * Reported off the Photos door on 1 September 2026, in red across the top of
 * a night's photographs:
 *
 *     GitHub 409: photos/…/published.json does not match 50979a2a…
 *
 * Which should have been impossible by this repo's own reasoning: every write
 * to that file goes through `inOrder()` one at a time per room, and nothing
 * else in the codebase writes it. So the sha was never RACED — it was STALE.
 * `shaOf()` reads the Contents API, which is served from a replica and through
 * a cache, so a read moments after a 200 can hand back the version before it.
 *
 * The stub below is the one the real one is not: it keeps real shas, refuses a
 * write that does not carry the current one, and can be told to answer reads
 * from one version behind — which is the whole fault, reproduced.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const shaOf = (text) => createHash('sha1').update(text).digest('hex');

/** A repository of one file that keeps shas honestly. */
function fakeRepo({ staleReads = false } = {}) {
  const calls = { reads: 0, writes: 0, conflicts: 0 };
  let now = null;      // what is actually on the branch
  let before = null;   // what a stale read hands back
  const real = globalThis.fetch;

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('https://api.github.com/')) return real(input, init);
    const method = (init.method || 'GET').toUpperCase();

    if (method === 'GET') {
      calls.reads += 1;
      // A read asking to skip the caches always gets the truth. That is what
      // the retry after a 409 relies on.
      const fresh = url.includes('_=') || (init.headers || {})['Cache-Control'] === 'no-cache';
      const seen = (staleReads && !fresh) ? before : now;
      if (!seen) return new Response('{"message":"Not Found"}', { status: 404 });
      return new Response(JSON.stringify({ sha: shaOf(seen), content: '', type: 'file' }), { status: 200 });
    }
    if (method === 'PUT') {
      calls.writes += 1;
      const body = JSON.parse(init.body);
      const sent = body.sha || null;
      const wanted = now === null ? null : shaOf(now);
      if (sent !== wanted) {
        calls.conflicts += 1;
        return new Response(JSON.stringify({
          message: `photos/x/published.json does not match ${wanted}`,
          documentation_url: 'https://docs.github.com/rest/repos/',
        }), { status: 409 });
      }
      before = now;
      now = Buffer.from(body.content, 'base64').toString('utf8');
      return new Response(JSON.stringify({ content: { sha: shaOf(now), html_url: 'u' } }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };

  return {
    calls,
    read: () => now,
    set: (text) => { now = text; before = text; },
    // What is on the branch, and what a stale read still believes — the two
    // genuinely apart, which is the state the retry has to see past.
    setBehind: (isNow, isBefore) => { now = isNow; before = isBefore; },
    stop: () => { globalThis.fetch = real; },
  };
}

async function withRepo(opts, job) {
  const repo = fakeRepo(opts);
  const prev = { ...process.env };
  process.env.PHOTO_REPO = 'someone/private';
  process.env.PHOTO_TOKEN = 'tok';
  process.env.PHOTO_BRANCH = 'main';
  // A fresh module each time, so nothing it remembers leaks between cases.
  const gh = await import(`../src/github.js?sha=${Math.random()}`);
  try {
    return await job(gh, repo);
  } finally {
    repo.stop();
    for (const k of ['PHOTO_REPO', 'PHOTO_TOKEN', 'PHOTO_BRANCH']) {
      if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k];
    }
  }
}

test('A SECOND WRITE USES THE SHA THE FIRST ONE WAS GIVEN, and does not read', async () => {
  await withRepo({}, async (gh, repo) => {
    repo.set('{"nights":[]}');
    const a = await gh.putFile('p/published.json', '{"nights":["a"]}', 'one', 'photos');
    assert.equal(a.ok, true, a.error);
    const readsAfterFirst = repo.calls.reads;

    const b = await gh.putFile('p/published.json', '{"nights":["a","b"]}', 'two', 'photos');
    assert.equal(b.ok, true, b.error);
    assert.equal(repo.read(), '{"nights":["a","b"]}');
    // The whole saving: a write with no read in front of it.
    assert.equal(repo.calls.reads, readsAfterFirst, 'the second write read the sha again');
    assert.equal(repo.calls.conflicts, 0);
  });
});

test('THE STALE READ THAT CAUSED THE LIVE 409 NEVER EVEN ASKS', async () => {
  await withRepo({ staleReads: true }, async (gh, repo) => {
    repo.set('{"nights":[]}');
    // Lamps flicked down a night: writes back to back with no gap, which is
    // exactly the shape that outruns GitHub's own replicas.
    for (const text of ['one', 'two', 'three', 'four']) {
      const out = await gh.putFile('p/published.json', text, 'flick', 'photos');
      assert.equal(out.ok, true, out.error);
    }
    assert.equal(repo.read(), 'four');
    /*
     * ZERO, not "recovered from". The retry below would rescue every one of
     * these — and would spend a 409 and an extra read on each, on the API this
     * app has already had to fit inside 5,000 calls an hour. Asserting the
     * OUTCOME alone lets the memory rot away unnoticed behind a working retry,
     * which is this repo's own lesson about a guard measuring the wrong thing.
     */
    assert.equal(repo.calls.conflicts, 0, 'it should never have sent a stale sha at all');
  });
});

test('A SHA MOVED BY SOMETHING ELSE IS RETRIED ONCE, NOT FOUGHT OVER', async () => {
  await withRepo({}, async (gh, repo) => {
    repo.set('start');
    assert.equal((await gh.putFile('p/f.json', 'mine', 'a', 'photos')).ok, true);
    // Somebody edits the file in GitHub's own web editor. What `putFile`
    // remembers is now wrong, which is the case the retry exists for.
    repo.set('theirs');
    const out = await gh.putFile('p/f.json', 'mine again', 'b', 'photos');
    assert.equal(out.ok, true, out.error);
    assert.equal(repo.calls.conflicts, 1, 'it should have hit exactly one 409');
    assert.equal(repo.read(), 'mine again');
  });
});

test('THE RETRY READS PAST THE CACHES, or it just fails the same way twice', async () => {
  await withRepo({ staleReads: true }, async (gh, repo) => {
    repo.set('start');
    assert.equal((await gh.putFile('p/f.json', 'mine', 'a', 'photos')).ok, true);
    /*
     * BOTH THINGS WRONG AT ONCE, which is the state that needs the third half:
     * the host has edited the file in GitHub's web editor, so what we remember
     * is stale — AND the replicas are behind, so an ordinary read hands back
     * the version we already had. A retry that reads the same cached answer
     * sends the same sha and gets the same 409.
     */
    repo.setBehind('theirs', 'mine');
    const out = await gh.putFile('p/f.json', 'mine again', 'b', 'photos');
    assert.equal(out.ok, true, out.error);
    assert.equal(repo.read(), 'mine again');
    assert.equal(repo.calls.conflicts, 1, 'one 409, then done');
  });
});

test('A 409 THAT SURVIVES THE RETRY IS SAID IN WORDS, NOT IN JSON', async () => {
  await withRepo({}, async (gh, repo) => {
    repo.set('start');
    // Every read lies, so the retry cannot help — the honest end of the road.
    const real = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('https://api.github.com/') && (init.method || 'GET').toUpperCase() === 'GET') {
        return new Response(JSON.stringify({ sha: 'nonsense', type: 'file' }), { status: 200 });
      }
      return real(input, init);
    };
    const out = await gh.putFile('p/f.json', 'x', 'a', 'photos');
    assert.equal(out.ok, false);
    assert.match(out.error, /changed by something else/i);
    assert.doesNotMatch(out.error, /documentation_url|does not match/);
  });
});

test('AND A FAILED WRITE LEAVES NOTHING REMEMBERED, so the next one reads', async () => {
  await withRepo({}, async (gh, repo) => {
    repo.set('start');
    assert.equal((await gh.putFile('p/f.json', 'one', 'a', 'photos')).ok, true);
    const real = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('https://api.github.com/') && (init.method || 'GET').toUpperCase() === 'PUT') {
        return new Response('{"message":"boom"}', { status: 500 });
      }
      return real(input, init);
    };
    assert.equal((await gh.putFile('p/f.json', 'two', 'b', 'photos')).ok, false);
    globalThis.fetch = real;

    const readsBefore = repo.calls.reads;
    const out = await gh.putFile('p/f.json', 'three', 'c', 'photos');
    assert.equal(out.ok, true, out.error);
    assert.ok(repo.calls.reads > readsBefore, 'it should have gone back to reading the sha');
  });
});
