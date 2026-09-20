/**
 * A DJ SET — the lock, the queue, and the screen that must not show it.
 *
 * ---
 *
 * Two halves, because two different things can go wrong.
 *
 * The **model** is arithmetic and rules: who may ask, how many, what the DJ
 * sees. That is unit-tested.
 *
 * The **path** is the one worth driving over real HTTP, because the whole
 * argument for building this inside Quizporium rather than as a second
 * codebase is that `POST /api/photo` already does the job — and *a test that
 * never runs the artefact proves nothing about it*. So the live half starts a
 * set, joins a phone, is refused a request, uploads a real photograph through
 * the real route, and is then allowed one. If that passes, the reuse claim is
 * evidence rather than optimism.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DjSet, DJ_PHASES, REQUESTS_EACH, MAX_REQUESTS } from '../src/dj.js';
import { freePort, stopped, waitForApp } from './helpers/live-server.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** A set with a clock that never repeats, so request ids cannot collide. */
function aSet() {
  let t = 1_000_000;
  const dj = new DjSet({ now: () => (t += 1000) });
  const guest = dj.join({ name: 'Sam' });
  return { dj, guest };
}

/* ------------------------------------------------------------- the lock */

test('A PHOTO IS THE KEY — no photograph, no request', () => {
  const { dj, guest } = aSet();
  assert.equal(dj.unlocked(guest.id), false);
  const refused = dj.request({ playerId: guest.id, token: guest.token, title: 'No Reptiles' });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'locked');

  dj.notePhoto(guest.id);
  assert.equal(dj.unlocked(guest.id), true);
  assert.equal(dj.request({ playerId: guest.id, token: guest.token, title: 'No Reptiles' }).ok, true);
});

test('notePhoto only counts a phone that is actually here', () => {
  const { dj } = aSet();
  assert.equal(dj.notePhoto('nobody'), false);
  assert.equal(dj.unlocked('nobody'), false);
});

test('AND A REQUEST PROVES WHO IT IS — rule 3, with a name attached', () => {
  /*
   * A request carries somebody's NAME to the DJ. One anybody could post with a
   * borrowed id is a way to put words in front of the person on the mic under
   * somebody else's name, which is the same reasoning the host's note and the
   * arcade score already sit behind.
   */
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  const forged = dj.request({ playerId: guest.id, token: 'not-the-token', title: 'x' });
  assert.equal(forged.ok, false);
  assert.equal(forged.reason, 'not_you');
  assert.equal(dj.hostView().requests.length, 0);
});

/* ------------------------------------------------------- the two screens */

test('THE BIG SCREEN HAS NO REQUESTS IN IT — rule 1, and the sharpest case', () => {
  /*
   * A queue on the wall is a list of songs the room can watch the DJ not play,
   * and the first rude title somebody types is six feet wide in front of
   * everybody. Asserted on the SHAPE rather than on one field, so a later
   * field cannot arrive carrying them.
   */
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  dj.request({ playerId: guest.id, token: guest.token, artist: 'Slipknot', title: 'Duality' });

  const screen = JSON.stringify(dj.screenView());
  assert.equal(screen.includes('Duality'), false, 'a request reached the big screen');
  assert.equal(screen.includes('Slipknot'), false, 'a request reached the big screen');
  assert.equal(screen.includes('Sam'), false, "a requester's name reached the big screen");
  assert.ok(dj.hostView().requests.length === 1, 'and the DJ cannot see it either');
});

test('a phone sees its own requests and nobody else\'s', () => {
  const { dj, guest } = aSet();
  const other = dj.join({ name: 'Alex' });
  dj.notePhoto(guest.id);
  dj.notePhoto(other.id);
  dj.request({ playerId: guest.id, token: guest.token, title: 'Mine' });
  dj.request({ playerId: other.id, token: other.token, title: 'Theirs' });

  const view = JSON.stringify(dj.playerView(guest.id));
  assert.ok(view.includes('Mine'));
  assert.equal(view.includes('Theirs'), false);
});

test('a phone the set does not know is asked to rejoin, never told it was kicked', () => {
  // Rule 5: absent has many causes and only one of them is a removal.
  const { dj } = aSet();
  assert.deepEqual(dj.playerView('never-seen'), { kind: 'dj', rejoin: true });
});

/* --------------------------------------------------------------- the caps */

test('THREE WAITING, NOT THREE ALL NIGHT — playing one frees the slot', () => {
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  for (let i = 0; i < REQUESTS_EACH; i += 1) {
    assert.equal(dj.request({ playerId: guest.id, token: guest.token, title: `Song ${i}` }).ok, true);
  }
  const overflow = dj.request({ playerId: guest.id, token: guest.token, title: 'One too many' });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.reason, 'enough');

  // The DJ plays one, and the regular who asks every half hour is welcome back.
  dj.played(dj.hostView().requests[0].id);
  assert.equal(dj.request({ playerId: guest.id, token: guest.token, title: 'Later on' }).ok, true);
});

test('binning frees the slot too, and never deletes the record', () => {
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  for (let i = 0; i < REQUESTS_EACH; i += 1) {
    dj.request({ playerId: guest.id, token: guest.token, title: `Song ${i}` });
  }
  const first = dj.hostView().requests[0].id;
  assert.equal(dj.bin(first), true);
  assert.equal(dj.bin(first), false, 'binning twice should not count twice');
  assert.equal(dj.request({ playerId: guest.id, token: guest.token, title: 'Another' }).ok, true);
  // Binned, never deleted — the same decision the photo bin takes.
  assert.equal(dj.state.requests.length, REQUESTS_EACH + 1);
  assert.equal(dj.hostView().requests.length, REQUESTS_EACH);
});

test('an empty request is refused rather than silently dropped', () => {
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  for (const bad of ['', '   ', null, undefined]) {
    const out = dj.request({ playerId: guest.id, token: guest.token, title: bad });
    assert.equal(out.ok, false, `"${bad}" was accepted`);
    assert.equal(out.reason, 'empty');
  }
  // A title with no artist IS a request — plenty of people know the song and
  // not who did it.
  assert.equal(dj.request({ playerId: guest.id, token: guest.token, title: 'That one' }).ok, true);
});

test('THE DJ PASTES ONE STRING, and it is built in one place', () => {
  // The DJ software reads titles, so what the desk shows is what goes in the
  // search box. Worded once, here, or the queue and anything that prints a
  // request later say it two ways.
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  dj.request({ playerId: guest.id, token: guest.token, artist: 'Everything Everything', title: 'No Reptiles' });
  dj.request({ playerId: guest.id, token: guest.token, title: 'Just The Song' });
  const [withArtist, without] = dj.hostView().requests;
  assert.equal(withArtist.line, 'Everything Everything — No Reptiles');
  assert.equal(without.line, 'Just The Song');
});

test('a typed request is MARKED as typed', () => {
  // The DJ is the one who has to find it in their own library, so a spelling
  // off a search and a spelling off a thumb are not the same fact.
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  dj.request({ playerId: guest.id, token: guest.token, title: 'A', source: 'spotify' });
  dj.request({ playerId: guest.id, token: guest.token, title: 'B' });
  dj.request({ playerId: guest.id, token: guest.token, title: 'C', source: 'made-up' });
  assert.deepEqual(dj.hostView().requests.map((r) => r.source), ['spotify', 'typed', 'typed']);
});

test('the queue has a ceiling, and it is a SAFETY number', () => {
  const { dj } = aSet();
  // One phone each, so the per-phone cap is not what stops it.
  for (let i = 0; i < MAX_REQUESTS + 5; i += 1) {
    const p = dj.join({ name: `Guest ${i}` });
    dj.notePhoto(p.id);
    dj.request({ playerId: p.id, token: p.token, title: `Song ${i}` });
  }
  assert.equal(dj.state.requests.length, MAX_REQUESTS);
});

test('nothing is accepted once the set is over', () => {
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  dj.finish();
  assert.equal(dj.state.phase, DJ_PHASES.FINISHED);
  assert.equal(dj.request({ playerId: guest.id, token: guest.token, title: 'x' }).reason, 'over');
});

test('what gets filed is a night with a headcount, and no league table', () => {
  /*
   * `kind: 'dj'` so `league.js` drops it — a set has no scores, which is the
   * behaviour bingo already taught it. The headcount and the photographs are
   * what make it evidence, and those are what Past gigs reads.
   */
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  dj.request({ playerId: guest.id, token: guest.token, title: 'One' });
  dj.request({ playerId: guest.id, token: guest.token, title: 'Two' });
  dj.played(dj.hostView().requests[0].id);
  assert.deepEqual(dj.results(), {
    kind: 'dj', players: 1, requested: 2, played: 1, leaderboard: [],
  });
});

test('A SET COMES BACK FROM ITS OWN STATE — the unlock survives a restart', () => {
  /*
   * Every push is a deploy and every deploy is a restart, so the lock had to
   * live in the state file rather than be re-derived from the photo folder —
   * which is wiped — or a room would find itself locked out mid-set.
   */
  const { dj, guest } = aSet();
  dj.notePhoto(guest.id);
  dj.request({ playerId: guest.id, token: guest.token, title: 'Before' });

  const onDisk = JSON.parse(JSON.stringify(dj.state));
  const back = new DjSet({ state: onDisk, now: () => 2_000_000 });
  assert.equal(back.unlocked(guest.id), true);
  assert.equal(back.hostView().requests.length, 1);
  assert.equal(back.request({ playerId: guest.id, token: guest.token, title: 'After' }).ok, true);
});

test('a state from another game is not adopted', () => {
  // `boot()` hands whatever is on disk to whichever launcher the kind names;
  // a bingo state reaching this constructor must start fresh rather than be
  // read as a half-built set.
  const dj = new DjSet({ state: { kind: 'bingo', players: {}, called: [] } });
  assert.equal(dj.state.kind, 'dj');
  assert.deepEqual(dj.state.requests, []);
});

/* --------------------------------------------- the path, over real HTTP */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The smallest thing `sniffType()` will accept as a photograph. */
const A_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200, 7),
]);

async function withApp(run) {
  const data = mkdtempSync(join(tmpdir(), 'dj-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port), DATA_DIR: data, HOST_KEY: 'dj-test-key',
      ADVERT_DIR: join(data, 'adverts'),
    },
    stdio: 'ignore',
  });
  child.unref();
  const base = `http://127.0.0.1:${port}`;
  try {
    // One poll for every spawner — see `waitForApp()`. Ten seconds was not
    // enough under gig-build, and it waited them out on a server already dead.
    const up = await waitForApp(child, base);
    assert.ok(up, 'the server never came up');
    await run(base);
  } finally {
    /*
     * GONE, THEN DELETED — `stopped()` is `test/helpers/live-server.mjs`'s.
     * `kill()` sends a signal and waits for nothing, so deleting the data
     * directory on the next line races a server still flushing `state.json`
     * into it: ENOTEMPTY out of this `finally`, every assertion already
     * passed, naming a feature that works.
     */
    await stopped(child, 'SIGKILL');
    rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

const post = (base, path, body, headers = {}) => fetch(base + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

const KEY = { 'X-Host-Key': 'dj-test-key' };

test('THE WHOLE PATH: start a set, join, be refused, send a photo, ask for a song', async () => {
  await withApp(async (base) => {
    const started = await post(base, '/api/dj/start', { replace: true }, KEY);
    assert.equal(started.status, 200, 'the set would not start');

    const joined = await (await post(base, '/api/join', { name: 'Sam' })).json();
    assert.ok(joined.id && joined.token, 'a phone did not get an id and a token');

    // Locked, because no photograph has landed.
    const locked = await (await post(base, '/api/dj/request', {
      playerId: joined.id, token: joined.token, title: 'No Reptiles',
    })).json();
    assert.equal(locked.ok, false);
    assert.equal(locked.reason, 'locked');

    /*
     * THE REAL PHOTO ROUTE, UNCHANGED — this is the claim the whole design
     * rests on. If this needed a DJ-shaped edit, the argument for one codebase
     * was wrong.
     */
    const sent = await fetch(`${base}/api/photo?playerId=${encodeURIComponent(joined.id)}&camera=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: A_JPEG,
    });
    const shot = await sent.json();
    assert.equal(shot.ok, true, `the photo was refused: ${JSON.stringify(shot)}`);

    // And the request box opens.
    const asked = await (await post(base, '/api/dj/request', {
      playerId: joined.id, token: joined.token,
      artist: 'Everything Everything', title: 'No Reptiles', source: 'spotify',
    })).json();
    assert.equal(asked.ok, true, `still locked after a photo: ${JSON.stringify(asked)}`);

    // The phone sees its own.
    const mine = await (await fetch(`${base}/api/state?role=player&playerId=${joined.id}`)).json();
    assert.equal(mine.unlocked, true);
    assert.equal(mine.mine.length, 1);
    assert.equal(mine.mine[0].title, 'No Reptiles');

    /*
     * THE BIG SCREEN DOES NOT.
     *
     * **The NAME is deliberately not asserted on, and that is a correction to
     * this test rather than to the code.** Sam sent a photograph, and the photo
     * strip has carried the sender's name since long before a DJ set existed —
     * so a bare "is this string anywhere" check fails on the photo feature
     * working correctly. A guard that cries wolf about the wrong thing is one
     * somebody turns off.
     *
     * What actually has to hold is that nothing REQUEST-SHAPED is there: not
     * the song, not the id, and not the fields that would carry the next one.
     */
    const screen = await (await fetch(`${base}/api/state?role=screen`)).json();
    const asText = JSON.stringify(screen);
    assert.equal(asText.includes('No Reptiles'), false, 'a request reached the projector');
    assert.equal(asText.includes('Everything Everything'), false, 'a request reached the projector');
    assert.equal('requests' in screen, false, 'the projector payload grew a request list');
    assert.equal('played' in screen, false, 'the projector payload grew a played list');
  });
});

test('and the desk can play one, which takes it off the queue', async () => {
  await withApp(async (base) => {
    await post(base, '/api/dj/start', { replace: true }, KEY);
    const joined = await (await post(base, '/api/join', { name: 'Sam' })).json();
    await fetch(`${base}/api/photo?playerId=${encodeURIComponent(joined.id)}&camera=1`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: A_JPEG,
    });
    await post(base, '/api/dj/request', {
      playerId: joined.id, token: joined.token, artist: 'Slipknot', title: 'Duality',
    });

    const desk = await (await fetch(`${base}/api/state?role=host&key=dj-test-key`)).json();
    assert.equal(desk.requests.length, 1);
    assert.equal(desk.requests[0].line, 'Slipknot — Duality');

    const done = await post(base, '/api/dj/played', { id: desk.requests[0].id }, KEY);
    assert.equal(done.status, 200);
    const after = await (await fetch(`${base}/api/state?role=host&key=dj-test-key`)).json();
    assert.equal(after.requests.length, 0);
    assert.equal(after.played.length, 1);
  });
});

test('A DJ ROUTE REFUSES WHEN NO SET IS RUNNING, rather than throwing', async () => {
  // The room always has a game built — a quiz, by default — so every one of
  // these has to say no to a phone that arrived from somewhere else.
  await withApp(async (base) => {
    const joined = await (await post(base, '/api/join', { name: 'Sam' })).json();
    const out = await post(base, '/api/dj/request', {
      playerId: joined.id, token: joined.token, title: 'x',
    });
    assert.equal(out.status, 409);
    const desk = await post(base, '/api/dj/played', { id: 'r1' }, KEY);
    assert.equal(desk.status, 409);
  });
});

test('and the desk needs an account — a stranger cannot bin somebody\'s request', async () => {
  await withApp(async (base) => {
    await post(base, '/api/dj/start', { replace: true }, KEY);
    for (const what of ['start', 'played', 'bin', 'finish']) {
      const out = await post(base, `/api/dj/${what}`, { id: 'r1', replace: true });
      assert.equal(out.status, 401, `/api/dj/${what} let a stranger in`);
    }
  });
});

test('A QUIZ CONTROL VIEW LEFT OPEN CANNOT 500 A DJ SET', async () => {
  /*
   * The DJ drives their own page, so none of these is a button anybody
   * presses on purpose. What reaches them is a quiz or bingo control view
   * still open in another tab — same account, same room, every button still
   * drawn — which is how a night once got filed two hours early.
   *
   * Before this, `perGame` in `session.js` read `quiz ? {…} : {…bingo}`, so a
   * DJ set inherited bingo's whole control view and `call` was a **500** from
   * a button; the shared half asked for `removeIdlePlayers`, `setRewards` and
   * four more that `DjSet` did not have, which is the same fault `bingo.js`
   * already paid for once.
   *
   * VERIFIED BY PUTTING IT BACK: with the `else` branch unnamed, `call`
   * throws `this.engine.call is not a function` and the run below goes 500.
   */
  await withApp(async (base) => {
    await post(base, '/api/dj/start', { replace: true }, KEY);
    const joined = await (await post(base, '/api/join', { name: 'Sam' })).json();

    // Bingo's buttons, which a DJ set must not be offered at all.
    for (const action of ['call', 'newRound', 'playOn', 'undoCall', 'uncall']) {
      const out = await post(base, `/api/host/${action}`, { trackId: 't1' }, KEY);
      assert.ok(out.status < 500, `/api/host/${action} threw on a DJ night`);
    }
    // The quiz's, likewise — these were already unreachable, and are checked
    // so that stays true rather than being true by luck.
    for (const action of ['next', 'reveal', 'back', 'skip', 'redo', 'scoreboard']) {
      const out = await post(base, `/api/host/${action}`, {}, KEY);
      assert.ok(out.status < 500, `/api/host/${action} threw on a DJ night`);
    }
    // And the SHARED half, every one of which reaches the engine directly.
    for (const action of ['removeIdle', 'setRewards', 'redeemVoucher', 'reinstateVoucher', 'resetAll', 'letThemIn']) {
      const out = await post(base, `/api/host/${action}`, { rewards: [], code: 'x' }, KEY);
      assert.ok(out.status < 500, `/api/host/${action} threw on a DJ night`);
    }
    // A phone carrying a lobby-game score from a quiz that ended an hour ago.
    const arcade = await post(base, '/api/arcade', {
      playerId: joined.id, token: joined.token, score: 40, game: 'maze',
    });
    assert.ok(arcade.status < 500, 'a stale arcade score threw on a DJ night');

    // AND THE SET IS STILL RUNNING AFTER ALL OF IT — a refusal that quietly
    // ended the night would pass every assertion above.
    const desk = await (await fetch(`${base}/api/state?role=host&key=dj-test-key`)).json();
    assert.equal(desk.kind, 'dj');
    assert.equal(desk.phase, 'set');
  });
});
