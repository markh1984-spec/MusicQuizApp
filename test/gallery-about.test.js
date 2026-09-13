/**
 * THE NUMBERS AND THE BOOKING LINE on a quizmaster's public page.
 *
 * ---
 *
 * Two halves, because the arithmetic and the DISCLOSURE are different risks.
 *
 * The sums are pure and are tested as sums. What matters more is the pair of
 * gates in `server.js`, and they are only real over HTTP against the real
 * routes with a real published night behind them — which needs the photo
 * repository stub, because a night's published flag lives in a private repo the
 * suite has no token for. That is the same reasoning `gallery-publish-loop`
 * records, and the same reason it exists: **a test that never runs the artefact
 * proves nothing about it.**
 *
 * The gate that can hurt somebody is the venue one. A venue name is the only
 * thing on this page that is somebody ELSE'S business, so guessing
 * `/some-pub/gallery` must not come back with a headcount and confirm that
 * this quizmaster works there.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { galleryNumbers, cleanBooking, bookingLink, bookingOf, BOOKING_MAX } from '../src/gallery-about.js';
import { freePort } from './helpers/live-server.mjs';

/* ---------------------------------------------------------- the arithmetic */

const NIGHTS = [
  { night: '2026-09-10', venue: 'The Crown', games: [{ players: 58 }, { players: 55 }] },
  { night: '2026-08-10', venue: 'The Crown', games: [{ players: 40 }] },
  { night: '2026-07-10', venue: 'The Crown, Reading', games: [{ players: 22 }] },
  { night: '2026-06-10', venue: 'The Tap', games: [{ players: 30 }] },
  { night: '2026-06-01', venue: '', games: [{ players: 12 }] },
  { night: '2026-05-01', venue: 'The Tap', games: [{ players: 0 }] },
];

test('THE HEADCOUNT OF A NIGHT IS THE MAX ACROSS ITS GAMES, never the sum', () => {
  // A quiz and the bingo after it are the same room and mostly the same
  // phones. Added, the page reports a night as twice the size it was.
  const all = galleryNumbers(NIGHTS);
  assert.equal(all.best, 58, 'the quiz and the bingo were added together');
});

test('a night nobody played is not evidence of anything', () => {
  const all = galleryNumbers(NIGHTS);
  // Five nights have a headcount; the sixth is an abandoned launch.
  assert.equal(all.nights, 5, 'an empty night was counted');
});

test('A NIGHT WITH NO VENUE IS STILL A NIGHT THEY RAN', () => {
  // `venueHeadcounts()` files these as a bare `unplaced` count with no
  // players in it, so totalling the venue groups would lose them — and every
  // night filed before venues existed has no venue on it.
  const all = galleryNumbers(NIGHTS);
  assert.equal(all.nights, 5);
  // 58 + 40 + 22 + 30 + 12 = 162 over five nights.
  assert.equal(all.average, Math.round(162 / 5));
});

test('THE AVERAGE, NEVER THE TOTAL — the total is the flattering number', () => {
  const all = galleryNumbers(NIGHTS);
  assert.equal(all.average, 32);
  assert.equal(all.players, undefined, 'a summed headcount rode out as "players"');
});

test('no pub is named by the totals, and they count the venues', () => {
  const all = galleryNumbers(NIGHTS);
  // The Crown (both spellings are one pub) and The Tap — and The Tap's only
  // night had nobody in it, so it is not a venue with numbers.
  assert.equal(all.venues, 2);
  assert.equal(JSON.stringify(all).includes('Crown'), false, 'a pub was named in the totals');
});

test('ONE PUB IS ONE PUB, whichever of its spellings is in the address', () => {
  // `sameVenueSlug()`, symmetrically — the fold this app already applies to
  // the league, the headcounts and the night page's own arrows.
  const a = galleryNumbers(NIGHTS, { venue: 'crown' });
  const b = galleryNumbers(NIGHTS, { venue: 'crown-reading' });
  assert.deepEqual(a, b, 'two addresses for one pub disagree');
  assert.equal(a.nights, 3);
  assert.deepEqual(a.grew, { from: 22, to: 58 });
});

test('the growth line is only ever about ONE pub', () => {
  // Across four pubs, "first night to latest night" is two different rooms.
  assert.equal(galleryNumbers(NIGHTS).grew, undefined);
});

test('AND A ROOM THAT SHRANK IS NOT PUBLISHED AS A SENTENCE', () => {
  /*
   * Not the app hiding a fact from the quizmaster — Past gigs shows them every
   * night of it, deliberately without red. It is the app declining to print a
   * line arguing against the person whose page it is. `best` is still there.
   */
  const down = [
    { night: '2026-09-01', venue: 'The Bell', games: [{ players: 14 }] },
    { night: '2026-07-01', venue: 'The Bell', games: [{ players: 40 }] },
  ];
  const one = galleryNumbers(down, { venue: 'bell' });
  assert.equal(one.grew, undefined, 'a shrinking room was printed');
  assert.equal(one.best, 40, 'the best night went with it');
});

test('a pub with no nights, and no nights at all, both say nothing', () => {
  assert.equal(galleryNumbers(NIGHTS, { venue: 'nowhere-at-all' }), null);
  assert.equal(galleryNumbers([]), null);
  assert.equal(galleryNumbers([{ night: '2026-01-01', venue: 'X', games: [] }]), null);
});

/* -------------------------------------------------------- the booking line */

test('AN EMAIL ADDRESS IS A MAILTO, not a website with a username on it', () => {
  /*
   * `new URL('https://mark@example.com')` PARSES — as a URL with a username
   * and the host `example.com` — so the obvious thing to type came back as a
   * live link to somebody else's site, with no error anywhere.
   */
  assert.equal(bookingLink('mark@example.com'), 'mailto:mark@example.com');
  assert.equal(bookingLink('mailto:mark@example.com'), 'mailto:mark@example.com');
});

test('a link that is not http(s) or an email is refused rather than repaired', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>', 'mailto:nonsense', '', '   ', 'ftp://x.com']) {
    assert.equal(bookingLink(bad), '', `"${bad}" became a link`);
  }
});

test('a website typed off a business card is assumed https', () => {
  assert.equal(bookingLink('markquizzes.co.uk'), 'https://markquizzes.co.uk/');
  assert.equal(bookingLink('http://x.co.uk/book'), 'http://x.co.uk/book');
  assert.equal(bookingLink('notahost'), '');
});

test('one line, cleaned the way a team name is and not word-filtered', () => {
  assert.equal(cleanBooking('  Quiz   nights\tacross Berkshire \n'), 'Quiz nights across Berkshire');
  assert.equal(cleanBooking('a\u0000b'), 'a b');
  assert.equal(cleanBooking('x'.repeat(400)).length, BOOKING_MAX);
  assert.equal(cleanBooking(null), '');
  // Their own words about their own business. No filter, deliberately.
  assert.equal(cleanBooking('bloody good quiz'), 'bloody good quiz');
});

test('NOTHING IS DERIVED — silence is the default', () => {
  assert.equal(bookingOf(null), null);
  assert.equal(bookingOf({ email: 'mark@example.com', name: 'Mark' }), null,
    'a sign-in address was published as a contact');
  assert.deepEqual(bookingOf({ prefs: { booking: 'Book me' } }), { words: 'Book me' });
  assert.deepEqual(bookingOf({ prefs: { bookingLink: 'x.co.uk' } }), { link: 'https://x.co.uk/' });
  // A link the server cannot read leaves the words standing rather than
  // taking the whole panel down with it.
  assert.deepEqual(bookingOf({ prefs: { booking: 'Hi', bookingLink: 'javascript:x' } }), { words: 'Hi' });
});

/* ------------------------------------------------- the two gates, over HTTP */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const PASSWORD = 'a longer pass phrase';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const UP = '2026-08-20';    // at The Station Tap, and published
const QUIET = '2026-08-13'; // at The Wheatsheaf, and never published

async function withApp(run) {
  const data = mkdtempSync(join(tmpdir(), 'galabout-'));
  const repo = mkdtempSync(join(tmpdir(), 'galabout-gh-'));
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port), HOST_KEY: 'not-used-here', DATA_DIR: data,
    GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub',
  };
  const start = () => spawn(process.execPath, ['--import', STUB, 'server.js'],
    { cwd: ROOT, env, stdio: 'ignore' });
  let server = start();
  const base = `http://127.0.0.1:${port}`;
  const up = async () => {
    for (let i = 0; i < 60; i += 1) {
      try { await fetch(base); return; } catch { await wait(200); }
    }
    throw new Error('the server never came up');
  };
  const restart = async () => { server.kill(); await wait(300); server = start(); await up(); };
  try {
    await up();
    await run({ base, data, repo, restart });
  } finally {
    server.kill();
    rmSync(data, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
}

const post = (base, path, body, cookie = '') => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

/**
 * An owner with a password plus the owner's own quizmaster account — the real
 * shape, and the one whose room the public page reads. Copied from
 * `gallery-publish-loop.test.js` for the same reason it is there: the host key
 * resolves to the house room, which is the room the gallery does NOT read.
 */
async function signedIn({ base, data, restart }) {
  const made = await (await post(base, '/api/signup',
    { email: 'mark@example.com', password: PASSWORD, name: 'Mark' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  assert.equal((await post(base, '/api/reset/complete', { token, password: PASSWORD })).status, 200);

  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'owner';
  acc.accounts.push({
    ...acc.accounts[0], id: 'qm-mark', email: 'mark+qm@example.com',
    name: "Mark's Quizporium", role: 'quizmaster', ownedBy: acc.accounts[0].id,
    comped: true, status: 'active',
  });
  writeFileSync(file, JSON.stringify(acc));
  await restart();

  const res = await post(base, '/api/sign-in', { email: 'mark@example.com', password: PASSWORD });
  assert.equal(res.status, 200, 'could not sign in');
  return (res.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
}

/**
 * THE BOOKING LINE BELONGS TO THE HAT WHOSE PAGE IT IS — and the first version
 * of this test typed it on the wrong one.
 *
 * One login, two identities: the page reads the account that owns the gallery
 * room, which is the QUIZMASTER hat. Saving it on the owner account stored it
 * against an account with no public page, and the page came back with no
 * booking line and nothing wrong anywhere. That is exactly the distinction
 * `pagePanel()` encodes by being silent on the owner hat, so it is worth
 * proving through the real switch rather than by writing the file.
 */
async function asTheQuizmaster(base, cookie) {
  const res = await post(base, '/api/owner/act-as', {}, cookie);
  assert.equal(res.status, 200, 'could not put the quizmaster hat on');
  const acting = (res.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  assert.ok(acting.includes('mmm_acting'), 'the hat switch set no acting cookie');
  return `${cookie}; ${acting}`;
}

const typeIt = (base, cookie, body) => fetch(`${base}/api/me/prefs`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify(body),
});

/** Two nights at two pubs, with photographs in the gallery's own room. */
function fileTwoNights(data, repo) {
  const arc = join(data, 'rooms', 'qm-mark', 'archive');
  mkdirSync(arc, { recursive: true });
  const night = (id, when, venue, players) => writeFileSync(join(arc, `${id}.json`), JSON.stringify({
    id, kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${when}T21:30:00Z`), venue,
    leaderboard: Array.from({ length: players }, (_, i) => ({
      name: `Team ${i}`, score: 100, position: i + 1, faceKey: '',
    })),
  }));
  // A first night and a later, bigger one at the SAME pub, so the growth line
  // has something true to say.
  night('n0', '2026-07-16', 'The Station Tap, Wokingham', 20);
  night('n1', UP, 'The Station Tap, Wokingham', 44);
  night('n2', QUIET, 'The Wheatsheaf', 31);
  for (const when of [UP, QUIET]) {
    const dir = join(repo, 'photos', 'qm-mark', when);
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 3; i += 1) writeFileSync(join(dir, `p${i}.jpg`), Buffer.alloc(64, 1));
  }
}

const about = async (base, query = '', cookie = '') => {
  const res = await fetch(`${base}/api/gallery-about${query}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const text = await res.text();
  assert.ok(!text.startsWith('<'), 'the about API answered with a page');
  assert.equal(res.status, 200, 'the about API did not answer');
  return JSON.parse(text);
};

test('WITH NOTHING PUBLISHED A STRANGER GETS NO NUMBERS — but the booking line stands', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileTwoNights(app.data, app.repo);

    // Two rules, each obvious on its own: what the APP worked out about
    // somebody's nights needs a night they made public; what they TYPED needs
    // only them having typed it.
    const wearing = await asTheQuizmaster(app.base, cookie);
    const saved = await typeIt(app.base, wearing,
      { booking: 'Quiz nights across Berkshire', bookingLink: 'mark@example.com' });
    assert.equal(saved.status, 200, 'the booking line would not save');

    const seen = await about(app.base);
    assert.equal(seen.numbers, undefined, 'a whole season was reported with nothing published');
    assert.deepEqual(seen.book, { words: 'Quiz nights across Berkshire', link: 'mailto:mark@example.com' });
  });
});

test('the save says what it UNDERSTOOD, so a link that cannot be used is visible', async () => {
  await withApp(async (app) => {
    const cookie = await asTheQuizmaster(app.base, await signedIn(app));
    const res = await typeIt(app.base, cookie, { booking: 'Book me', bookingLink: 'javascript:alert(1)' });
    const data = await res.json();
    // Stored as typed, so there is something on screen to correct...
    assert.equal(data.prefs.bookingLink, 'javascript:alert(1)');
    // ...and never publishable.
    assert.deepEqual(data.booking, { words: 'Book me' });
  });
});

test('ONCE A NIGHT IS UP, THE NUMBERS COVER EVERY NIGHT AND NAME NO PUB', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileTwoNights(app.data, app.repo);
    assert.equal((await post(app.base, '/api/past-gigs/publish', { night: UP, on: true }, cookie)).status, 200);

    const seen = await about(app.base);
    // All three filed nights, including the one whose photographs are still a
    // draft — the totals name nobody, which is what makes that safe.
    assert.equal(seen.numbers.nights, 3);
    assert.equal(seen.numbers.best, 44);
    assert.equal(seen.numbers.venues, 2);
    assert.equal(JSON.stringify(seen.numbers).includes('Wheatsheaf'), false,
      'an unpublished pub was named by the totals');
    assert.equal(seen.numbers.grew, undefined, 'a growth line was printed across two pubs');
  });
});

test("A PUB'S OWN NUMBERS NEED A PUBLISHED NIGHT AT THAT PUB", async () => {
  /*
   * The gate that can hurt somebody. Without it, typing a pub's slug would
   * confirm that this quizmaster works there, with a headcount attached — and
   * the index only ever names pubs that already have a night up.
   */
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileTwoNights(app.data, app.repo);
    assert.equal((await post(app.base, '/api/past-gigs/publish', { night: UP, on: true }, cookie)).status, 200);

    const open = await about(app.base, '?venue=station-tap-wokingham');
    assert.equal(open.numbers.nights, 2, "the published pub's own nights are missing");
    assert.deepEqual(open.numbers.grew, { from: 20, to: 44 }, 'the growth line did not reach the page');

    const shut = await about(app.base, '?venue=wheatsheaf');
    assert.equal(shut.numbers, undefined,
      'guessing a pub slug confirmed that this quizmaster works there');

    // And a slug that names nothing answers exactly like one that is private,
    // so nobody can map which pubs exist by trying names.
    const nowhere = await about(app.base, '?venue=the-invented-arms');
    assert.equal(nowhere.numbers, undefined);
  });
});

test('one pub is one pub on the public page too, whichever spelling is asked for', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileTwoNights(app.data, app.repo);
    assert.equal((await post(app.base, '/api/past-gigs/publish', { night: UP, on: true }, cookie)).status, 200);

    // `station-tap` and `station-tap-wokingham` are two addresses for one pub
    // and both are legitimate — see `sameVenueSlug()`.
    const long = await about(app.base, '?venue=station-tap-wokingham');
    const short = await about(app.base, '?venue=station-tap');
    assert.deepEqual(short.numbers, long.numbers, 'two addresses for one pub disagree');
  });
});

test('AND THE QUIZMASTER SEES IT BEFORE ANYBODY — preview only, on their own page', async () => {
  await withApp(async (app) => {
    const cookie = await signedIn(app);
    fileTwoNights(app.data, app.repo);

    // Nothing published: signed in, the numbers are there to check.
    const mine = await about(app.base, '', cookie);
    assert.equal(mine.numbers.nights, 3, 'the quizmaster cannot see their own page before publishing');

    // `?as=visitor` only ever takes access away, here as everywhere.
    const asVisitor = await about(app.base, '?as=visitor', cookie);
    assert.equal(asVisitor.numbers, undefined, 'the preview survived ?as=visitor');
    const theirs = await about(app.base);
    assert.deepEqual(asVisitor, theirs, 'as=visitor and a real stranger disagree');
  });
});
