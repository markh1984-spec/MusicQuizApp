/**
 * Filing a batch as ONE commit.
 *
 * This exists because of a real failure rather than for coverage: a picture
 * round asked for ten portraits, drew seven, and stopped. Every picture was
 * its own commit through the Contents API — two sequential GitHub round trips
 * each — threaded in between the ten calls that drew them, so the backup took
 * longer than the drawing and the job ran long enough for something between
 * the app and the browser to hang up.
 *
 * So the properties worth pinning are about SHAPE and COUNT, not about
 * GitHub: one commit however many files, the blobs asked for concurrently,
 * and — the one that matters on a gig night — a failure that comes back as a
 * reason rather than as an exception, because the caller has just spent
 * minutes and real money and must not lose it to a bookkeeping error.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { putFiles, getFile, tryGetFile, listDir, tryListDir } from '../src/github.js';
import fs from 'node:fs';

const realFetch = globalThis.fetch;
const realEnv = { ...process.env };
test.afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

function repoEnv() {
  process.env.GITHUB_REPO = 'someone/somewhere';
  process.env.GITHUB_TOKEN = 'token';
  process.env.GITHUB_BRANCH = 'MusicQuizApp';
}

/**
 * A GitHub that records what it was asked. `inFlight` peaks above one only if
 * the blobs really do go up together.
 */
function fakeGitHub({ failAt = '' } = {}) {
  const calls = [];
  let inFlight = 0;
  const seen = { peak: 0 };
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).replace('https://api.github.com', '');
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (failAt && path.includes(failAt)) {
      return { ok: false, status: 422, text: async () => 'nope' };
    }
    inFlight += 1;
    seen.peak = Math.max(seen.peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    const reply = path.includes('/git/ref/') ? { object: { sha: 'HEADSHA' } }
      : path.includes('/git/blobs') ? { sha: `blob${calls.length}` }
        : path.includes('/git/trees') ? { sha: 'TREESHA' }
          : path.includes('/git/commits') ? { sha: 'COMMITSHA' }
            : { ok: true };
    return { ok: true, status: 200, json: async () => reply };
  };
  return { calls, seen };
}

const THREE = [
  { path: 'images/portraits/a.png', contents: Buffer.from([1, 2, 3]) },
  { path: 'images/portraits/b.png', contents: Buffer.from([4, 5, 6]) },
  { path: 'images/portraits/c.png', contents: 'not a buffer' },
];

test('TEN PICTURES ARE ONE COMMIT, not ten', async () => {
  repoEnv();
  const { calls } = fakeGitHub();
  const result = await putFiles(THREE, 'Round 2 pictures: The 80s Quiz');
  assert.equal(result.ok, true);
  assert.equal(result.count, 3);

  const commits = calls.filter((c) => c.path.includes('/git/commits') && c.method === 'POST');
  assert.equal(commits.length, 1, 'one commit for the batch');
  const moves = calls.filter((c) => c.method === 'PATCH');
  assert.equal(moves.length, 1, 'the branch moves once');
  // The Contents API is the thing being replaced — two round trips per file.
  assert.equal(calls.filter((c) => c.path.includes('/contents/')).length, 0);
});

test('the blobs go up together, which is the whole saving', async () => {
  repoEnv();
  const { seen } = fakeGitHub();
  await putFiles(THREE, 'pictures');
  assert.ok(seen.peak > 1, `blobs were sequential (peak ${seen.peak})`);
});

test('a string and a Buffer both survive the trip', async () => {
  repoEnv();
  const { calls } = fakeGitHub();
  await putFiles(THREE, 'pictures');
  const blobs = calls.filter((c) => c.path.includes('/git/blobs'));
  assert.equal(blobs.length, 3);
  for (const b of blobs) assert.equal(b.body.encoding, 'base64');
  // A PNG run through utf8 would have every invalid byte replaced and file a
  // corrupt image — the same trap `putFile` carries a comment about.
  const bytes = blobs.map((b) => Buffer.from(b.body.content, 'base64'));
  assert.deepEqual([...bytes[0]], [1, 2, 3]);
  assert.equal(bytes[2].toString('utf8'), 'not a buffer');
});

test('the commit says [skip render], so filing never redeploys mid-gig', async () => {
  repoEnv();
  const { calls } = fakeGitHub();
  await putFiles(THREE, 'Round 2 pictures');
  const commit = calls.find((c) => c.path.includes('/git/commits'));
  assert.match(commit.body.message, /\[skip render\]$/);
  assert.match(commit.body.message, /^Round 2 pictures/);
});

test('it builds ON the branch rather than over it', async () => {
  repoEnv();
  const { calls } = fakeGitHub();
  await putFiles(THREE, 'pictures');
  const tree = calls.find((c) => c.path.includes('/git/trees'));
  const commit = calls.find((c) => c.path.includes('/git/commits'));
  // Without base_tree the commit is the three files and NOTHING ELSE — the
  // whole repository replaced by a picture round.
  assert.equal(tree.body.base_tree, 'HEADSHA');
  assert.deepEqual(commit.body.parents, ['HEADSHA']);
  // And the ref move is not forced, so a push that landed in between loses
  // this commit rather than the other way round.
  const move = calls.find((c) => c.method === 'PATCH');
  assert.ok(!move.body.force, 'the ref update must not be forced');
});

test('NOTHING HERE THROWS — a failed backup is a reason, never an exception', async () => {
  // The caller is minutes and real money deep by the time this runs. Losing a
  // drawn round to a bookkeeping error is the tail wagging the dog.
  repoEnv();
  fakeGitHub({ failAt: '/git/blobs' });
  const result = await putFiles(THREE, 'pictures');
  assert.equal(result.ok, false);
  assert.match(result.error, /GitHub 422/);
});

test('nothing to file is an ok no-op, not an empty commit', async () => {
  repoEnv();
  const { calls } = fakeGitHub();
  for (const nothing of [[], null, undefined, [null]]) {
    const result = await putFiles(nothing, 'pictures');
    assert.deepEqual(result, { ok: true, count: 0 });
  }
  assert.equal(calls.length, 0, 'a quiz with no picture round talks to nobody');
});

test('an unconfigured repo says so rather than half-committing', async () => {
  delete process.env.GITHUB_REPO;
  delete process.env.GITHUB_TOKEN;
  const { calls } = fakeGitHub();
  const result = await putFiles(THREE, 'pictures');
  assert.equal(result.ok, false);
  assert.match(result.error, /not set up/);
  assert.equal(calls.length, 0);
});

/*
 * A READ THAT FAILED IS NOT AN EMPTY FOLDER.
 *
 * `getFile()` answers `null` and `listDir()` answers `[]` for a 404, a 403, a
 * 500 and a dropped connection alike — right for ninety call sites, and a
 * data-loss bug for the four that LATCH on the answer. One 403 on the first
 * read after a deploy marked a room restored with nothing restored: public
 * league empty, `report.pdf` 404, Past gigs zero nights, for the whole process
 * lifetime, with the backup intact and nothing logged. The photo cache had the
 * same shape and cached it.
 */
function answersWith(status, body = '{}') {
  globalThis.fetch = async () => new Response(body, { status });
}

test('tryGetFile TELLS A MISSING FILE APART FROM A FAILED READ', async () => {
  repoEnv();

  // A 404 is an ANSWER: there genuinely is no backup yet, which is a first
  // boot and must not be retried on every request.
  answersWith(404, '{"message":"Not Found"}');
  assert.deepEqual(await tryGetFile('backup.json', 'app'), { ok: true, body: null });
  assert.equal(await getFile('backup.json', 'app'), null);

  // Everything else is a failure to LOOK.
  for (const status of [403, 429, 500, 502]) {
    answersWith(status, '{"message":"nope"}');
    const read = await tryGetFile('backup.json', 'app');
    assert.equal(read.ok, false, `a ${status} must not read as "there is nothing there"`);
    assert.match(read.error, new RegExp(String(status)));
    // …and the old shape is unchanged, because ninety callers still want it.
    assert.equal(await getFile('backup.json', 'app'), null);
  }

  // A dropped connection is the same kind of answer.
  globalThis.fetch = async () => { throw new Error('socket hang up'); };
  assert.equal((await tryGetFile('backup.json', 'app')).ok, false);
  assert.equal(await getFile('backup.json', 'app'), null);

  // And a real read still comes back.
  answersWith(200, JSON.stringify({ content: Buffer.from('hello').toString('base64') }));
  const good = await tryGetFile('backup.json', 'app');
  assert.equal(good.ok, true);
  assert.equal(good.body.toString('utf8'), 'hello');
});

test('tryListDir TELLS AN EMPTY FOLDER APART FROM A FAILED LISTING', async () => {
  repoEnv();

  answersWith(404, '{"message":"Not Found"}');
  assert.deepEqual(await tryListDir('packs/rob/quiz', 'app'), { ok: true, files: [] });

  answersWith(403, '{"message":"rate limited"}');
  const read = await tryListDir('packs/rob/quiz', 'app');
  assert.equal(read.ok, false, 'a rate-limited moment is not an empty library');
  assert.deepEqual(await listDir('packs/rob/quiz', 'app'), [],
    'the old shape is unchanged — ninety callers still want an empty array');

  answersWith(200, JSON.stringify([
    { name: 'a.json', path: 'packs/rob/quiz/a.json', type: 'file' },
    { name: 'sub', path: 'packs/rob/quiz/sub', type: 'dir' },
  ]));
  assert.deepEqual(await tryListDir('packs/rob/quiz', 'app'),
    { ok: true, files: [{ name: 'a.json', path: 'packs/rob/quiz/a.json' }] });
});

test('NO RESTORE LATCHES BEFORE IT KNOWS THE READ WORKED', () => {
  /*
   * The four `ensure*Restored()` functions each did `set.add(room.id)` on the
   * line before the await, so a transient failure was remembered as a
   * successful restore for ever. They go through `restoreOnce()` now, which
   * latches on the way OUT and holds an in-flight promise per room so two tabs
   * cannot both restore at once.
   *
   * A source check, because these live in `server.js` and are not importable
   * without booting the app — and what it pins is the SHAPE, which is what
   * would have caught this in all four places at once.
   */
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8')
    // Comments first: three guards in this repo have gone green on the note
    // explaining a fix rather than on the code.
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

  for (const name of ['ensureArchiveRestored', 'ensureInvoicesRestored',
    'ensureAdvertsRestored', 'ensureOwnPacksRestored']) {
    const at = src.indexOf(`async function ${name}(`);
    assert.ok(at > 0, `${name}() has gone`);
    const body = src.slice(at, src.indexOf('\n}', at));
    assert.match(body, /restoreOnce\(/,
      `${name}() must go through restoreOnce(), or one bad morning at GitHub `
      + 'is permanent data loss');
    assert.doesNotMatch(body, /Restored\.add\(/,
      `${name}() must not latch its own set — restoreOnce() does it on the way `
      + 'out, only when the read actually worked');
  }
});
