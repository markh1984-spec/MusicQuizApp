/**
 * TWO WRITES TO `published.json` MUST NOT LOSE EACH OTHER.
 *
 * Reported off a live gallery on 31 August 2026, from a screenshot: *"it says
 * 'not published', but it is."* The console had published the night and been
 * told it worked; the public page said the opposite, and a stranger with the
 * link would have seen nothing.
 *
 * **IT IS A LOST UPDATE, AND NOTHING COULD REPORT IT.** One file holds both
 * halves of what a room publishes — which NIGHTS are up, and the per-photo
 * rulings behind the green/red lamps — and `setPublished()` and
 * `setPhotoDecision()` each read the whole thing, change their own half, and
 * write the whole thing back. Nothing serialised them, so a lamp write that
 * began before a publish finished wrote back the nights as they were BEFORE
 * it, quietly undoing it.
 *
 * **AND GITHUB CANNOT REFUSE IT**, which is why it is silent: `putFile()`
 * fetches a fresh sha immediately before writing, so the write is never
 * "against" the version its content was built from. The API sees a perfectly
 * ordinary update and answers 200. Both callers are told they succeeded.
 *
 * **THE BROWSER'S OWN QUEUE CANNOT COVER THIS.** `galleryQueue()` serialises
 * the console's own calls, and the lamp deliberately settles for 600ms before
 * sending — so the press that overlaps a publish is exactly the one the queue
 * has not started yet. The ordering has to be where the file is.
 *
 * No network: the private repo is a Map behind a stubbed `fetch`, with a delay
 * on the read so the interleaving is deterministic rather than lucky.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PHOTO_REPO = 'someone/photos';
process.env.PHOTO_TOKEN = 'stub';

const {
  setPublished, setPhotoDecision, publishedNights, photoDecisions,
  setPhotoPin, photoPins,
} = await import('../src/gallery.js');

const NIGHT = '2026-08-20';
const ROOM = 'qm-mark';

/** The repository, as a Map — and a read that takes long enough to overlap. */
function stubRepo({ readDelay = 0 } = {}) {
  const files = new Map();
  const real = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('https://api.github.com/')) return real(input, init);
    const at = decodeURI(url.match(/\/contents\/([^?]*)/)[1]);
    if ((init.method || 'GET').toUpperCase() === 'PUT') {
      files.set(at, Buffer.from(JSON.parse(init.body).content, 'base64').toString('utf8'));
      return new Response(JSON.stringify({ content: { sha: 'x' } }), { status: 200 });
    }
    reads += 1;
    if (readDelay) await new Promise((r) => setTimeout(r, readDelay));
    if (!files.has(at)) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(JSON.stringify({
      name: 'published.json', path: at, sha: 'x', type: 'file', encoding: 'base64',
      content: Buffer.from(files.get(at), 'utf8').toString('base64'),
    }), { status: 200 });
  };
  return { files, reads: () => reads, restore: () => { globalThis.fetch = real; } };
}

test('a lamp pressed while a night is being published does not un-publish it', async () => {
  const repo = stubRepo({ readDelay: 25 });
  try {
    // Both start before either finishes — the real case, where the lamp's own
    // 600ms settle lands on top of the publish that was pressed just after it.
    await Promise.all([
      setPublished(ROOM, NIGHT, true),
      setPhotoDecision(ROOM, NIGHT, 'p1abc-picked.jpg', 'on'),
    ]);
    assert.deepEqual(await publishedNights(ROOM), [NIGHT],
      'the night was published and a lamp write put it back the way it was');
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/p1abc-picked.jpg`]: 'on' },
      'and the ruling has to survive too — losing it the other way round is the same bug');
  } finally {
    repo.restore();
  }
});

test('and it holds the other way round, with the publish second', async () => {
  const repo = stubRepo({ readDelay: 25 });
  try {
    await Promise.all([
      setPhotoDecision(ROOM, NIGHT, 'p1abc-picked.jpg', 'off'),
      setPublished(ROOM, NIGHT, true),
    ]);
    assert.deepEqual(await publishedNights(ROOM), [NIGHT]);
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/p1abc-picked.jpg`]: 'off' });
  } finally {
    repo.restore();
  }
});

test('several lamps at once all land — none is overwritten by its neighbour', async () => {
  const repo = stubRepo({ readDelay: 15 });
  try {
    const names = ['p1a-picked.jpg', 'p2b-picked.jpg', 'p3c-picked.jpg', 'p4d-picked.jpg'];
    await Promise.all(names.map((n) => setPhotoDecision(ROOM, NIGHT, n, 'on')));
    assert.deepEqual(await photoDecisions(ROOM),
      Object.fromEntries(names.map((n) => [`${NIGHT}/${n}`, 'on'])));
  } finally {
    repo.restore();
  }
});

test('unpublishing still works, and is not undone by a ruling either', async () => {
  const repo = stubRepo({ readDelay: 20 });
  try {
    await setPublished(ROOM, NIGHT, true);
    await Promise.all([
      setPublished(ROOM, NIGHT, false),
      setPhotoDecision(ROOM, NIGHT, 'p9z-picked.jpg', 'on'),
    ]);
    assert.deepEqual(await publishedNights(ROOM), [],
      'taking a night down must be as reliable as putting it up');
  } finally {
    repo.restore();
  }
});

/*
 * ---- AND ONE READ OF THE FILE, NOT ONE PER PHOTOGRAPH --------------------
 *
 * Reported as *"these photos take a while to load"*, and measured before
 * anything was changed: serving ONE photograph asked `published.json` twice —
 * is this night up, and has a human overruled this picture — before fetching
 * the picture itself. Three GitHub calls each, two of them the same small file.
 *
 * A night of thirty cost ninety calls; a night of ninety-nine costs about two
 * hundred and ninety-seven **every time the page is opened**, against a limit
 * of five thousand an hour. That is not slowness, it is a gallery that stops
 * working after seventeen visits.
 *
 * **THE CACHE IS ONLY DEFENSIBLE BECAUSE THE INVALIDATION IS EXACT.** This
 * file decides what is public, so a stale answer means a photograph somebody
 * asked to have taken down still being served — which is not a trade anybody
 * would accept for a faster page. Every write already goes through `inOrder()`,
 * so there is exactly one place to drop it from, and these cases assert the
 * dropping rather than the speed.
 */

test('the file is read ONCE for many readers, not once each', async () => {
  const repo = stubRepo();
  try {
    await setPublished(ROOM, NIGHT, true);
    const before = repo.reads();
    await Promise.all(Array.from({ length: 20 }, () => publishedNights(ROOM)));
    await Promise.all(Array.from({ length: 20 }, () => photoDecisions(ROOM)));
    const cost = repo.reads() - before;
    assert.ok(cost <= 1, `forty readers cost ${cost} fetches of one small file`);
  } finally { repo.restore(); }
});

test('SWITCHING A PHOTO OFF IS VISIBLE ON THE VERY NEXT READ', async () => {
  /*
   * The case the whole design turns on. If a cache can outlive a ruling by even
   * one request, the app is serving a picture it has been told to stop serving.
   */
  const repo = stubRepo();
  try {
    await setPhotoDecision(ROOM, NIGHT, 'p1abc.jpg', 'off');
    // Warm it, the way a page of photographs does.
    await photoDecisions(ROOM);
    await setPhotoDecision(ROOM, NIGHT, 'p1abc.jpg', 'on');
    assert.deepEqual(await photoDecisions(ROOM), { [`${NIGHT}/p1abc.jpg`]: 'on' },
      'a ruling made after the file was cached did not reach the next reader');
  } finally { repo.restore(); }
});

test('and taking a NIGHT down is visible on the very next read', async () => {
  const repo = stubRepo();
  try {
    await setPublished(ROOM, NIGHT, true);
    await publishedNights(ROOM);            // warm
    await setPublished(ROOM, NIGHT, false);
    assert.deepEqual(await publishedNights(ROOM), [],
      'a night unpublished after the file was cached was still being served');
  } finally { repo.restore(); }
});

test('a pin made after a read reaches the next reader too', async () => {
  const repo = stubRepo();
  try {
    await photoPins(ROOM);                  // warm on an empty file
    await setPhotoPin(ROOM, NIGHT, 'p1.jpg', true);
    assert.deepEqual((await photoPins(ROOM))[NIGHT], ['p1.jpg']);
  } finally { repo.restore(); }
});
