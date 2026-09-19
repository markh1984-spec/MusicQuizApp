#!/usr/bin/env node
/**
 * DOES A NIGHT SURVIVE A DEPLOY — the venue, the record and the photographs?
 *
 * ---
 *
 * `data/` is wiped on every deploy and there is no disk, so **the backup IS the
 * data**. Four things are supposed to be written to the private repository as
 * they change: the accounts book, the join codes, the invoice book (which holds
 * every venue, its prizes and its photo overlay) and the night archive (which is
 * Past gigs, the league, the headcounts, *heard here* and the report).
 *
 * On 19 September 2026 the private repository was found to hold **two `Update
 * accounts` commits from 9 August and nothing else**. Not one `Update past
 * nights`, not one `Update invoices`, not one `Update join codes` — six weeks
 * and five gigs. Every one of those writes is fired and forgotten
 * (`onArchive: (room) => { hooks.backUpArchive(room).catch(() => {}) }`), so
 * there was nothing to see: the night files, the console looks right, and the
 * record lasts exactly until the next push.
 *
 * It surfaced as *"we seem to have lost the overlay"* — `venueOverlayFor()`
 * needs the night's ARCHIVE record to know which pub it was and the INVOICE
 * book to find that pub's frame, and after a restart it had neither.
 *
 * So this drives a real night through a real server and then **takes the disk
 * away**, which is the only honest version of the question:
 *
 *   - a venue is made, given prizes and an overlay;
 *   - a night is launched, played by two phones and run to the final scores;
 *   - the four backup files are looked for BY NAME in the repository;
 *   - the data directory is wiped and the app restarted — a deploy, exactly;
 *   - and then the venue, the night and the night's frame have to still be
 *     there.
 *
 *     node scripts/a-night-survives-a-deploy.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const STUB = path.join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PW = 'a-long-enough-one-for-here';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? `  — ${detail}` : ''}`);
};

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'survive-repo-'));
const app = await startApp({
  nodeArgs: ['--import', STUB],
  env: { GH_STUB_DIR: repo, PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub' },
  seed: async (dir) => {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'qm@example.com', password: PW, name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

console.log('\nDOES A NIGHT SURVIVE A DEPLOY?\n');
let cookie = '';
const H = () => ({ 'content-type': 'application/json', cookie });
const J = async (route, opts = {}) => {
  const r = await fetch(app.base + route, opts);
  let body = null;
  try { body = await r.json(); } catch { /* some routes answer nothing */ }
  return { status: r.status, body };
};
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });
const inRepo = (name) => fs.existsSync(path.join(repo, name));

try {
  const signIn = await fetch(`${app.base}/api/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: PW }) });
  cookie = (signIn.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  check('signed in', Boolean(cookie));
  const me = await J('/api/me', { headers: H() });
  const room = me.body && me.body.account && me.body.account.id;
  check('the account has a room', Boolean(room), JSON.stringify(me.body && me.body.account).slice(0, 120));

  /* ------------------------------------------------ a venue, as he would make one */
  const mk = await J('/api/invoices/customers', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'The Station Tap, Wokingham' }) });
  const venue = ((mk.body || {}).customers || []).find((v) => v.name === 'The Station Tap, Wokingham');
  check('a venue was made', Boolean(venue), JSON.stringify(mk.body).slice(0, 140));
  /*
   * THE OVERLAY GOES THROUGH `/rewards` — the route is named for what it was
   * for first, and `setVenueDetails()` writes whichever of the five fields it
   * was sent. `/overlay` is a GET; PUTting there answers nothing and the venue
   * comes back undressed, which is how this check was wrong before it was right.
   */
  await J(`/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H(), body: JSON.stringify({ rewards: ['A pint', 'A half', 'A packet of crisps'], usualNight: 'thu', overlay: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }) });
  const withOverlay = await J('/api/library', { headers: H() });
  check('the venue is in the library with its overlay',
    (((withOverlay.body || {}).venueRecords) || []).some((v) => v.name === 'The Station Tap, Wokingham' && v.hasOverlay),
    JSON.stringify((withOverlay.body || {}).venueRecords));

  /* ------------------------------------------------------------- and a night */
  const lib = withOverlay.body || {};
  const code = lib.running && lib.running.joinCode;
  check('the room has a join code', Boolean(code), JSON.stringify(lib.running).slice(0, 120));
  const go = await host('launch', { game: 'quiz', packId: '1980s-pop-music', order: [{ packId: '1980s-pop-music', round: 0 }], venue: venue.name, venueId: venue.id, replace: true });
  check('the night launched', go.status === 200, JSON.stringify(go.body).slice(0, 140));

  const phones = [];
  for (const name of ['Dave', 'Sue']) {
    const j = await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) });
    phones.push(j.body);
  }
  check('two phones are in', phones.every((p) => p && p.id && p.token), JSON.stringify(phones).slice(0, 140));

  await host('start');
  let view = (await J('/api/state?role=host', { headers: H() })).body;
  for (let i = 0; i < 6 && view && view.phase !== 'question'; i += 1) {
    await host('next');
    view = (await J('/api/state?role=host', { headers: H() })).body;
  }
  for (const p of phones) {
    await J('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code, optionIndex: 0 }) });
  }
  for (let i = 0; i < 60 && view && view.phase !== 'final'; i += 1) {
    await host('next');
    view = (await J('/api/state?role=host', { headers: H() })).body;
  }
  check('the night reached the final scores — which is what FILES it', view && view.phase === 'final', view && view.phase);

  // The archive backup is fired and forgotten. Give it a moment before looking.
  await wait(2000);

  /* ------------------------------- the four files, by name, in the repository */
  console.log('\n  what reached the private repository:\n');
  check(`the accounts book (accounts.json)`, inRepo('accounts.json'));
  check(`the join codes (room-codes.json)`, inRepo('room-codes.json'));
  check(`the venue book (invoicing-${room}.json)`, inRepo(`invoicing-${room}.json`),
    'the venues, their prizes and their photo overlays');
  check(`the night archive (archive-${room}.json)`, inRepo(`archive-${room}.json`),
    'Past gigs, the league, the headcounts, heard-here and the report');
  console.log(`\n  (everything in it: ${fs.readdirSync(repo).join(', ')})\n`);

  /* ------------------------------------------------------- and now the deploy */
  for (const f of fs.readdirSync(app.data)) {
    if (f === 'quizzes' || f === 'bingo') continue;
    fs.rmSync(path.join(app.data, f), { recursive: true, force: true });
  }
  const up = await app.restart();
  check('the app came back up', up);
  await wait(500);

  const back = await fetch(`${app.base}/api/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: PW }) });
  cookie = (back.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  check('signed in again after the deploy', Boolean(cookie));

  const after = await J('/api/library', { headers: H() });
  const venues = ((after.body || {}).venueRecords) || [];
  check('THE VENUE IS STILL THERE', venues.some((v) => v.name === 'The Station Tap, Wokingham'),
    `${venues.length} venue(s): ${JSON.stringify(venues).slice(0, 140)}`);
  check('…with its prizes', venues.some((v) => (v.rewards || []).length === 3), JSON.stringify(venues).slice(0, 140));
  check('…and its photo overlay', venues.some((v) => v.hasOverlay), JSON.stringify(venues).slice(0, 140));

  const gigs = await J('/api/past-gigs', { headers: H() });
  const filed = ((gigs.body || {}).nights) || [];
  check('THE NIGHT IS STILL IN PAST GIGS', filed.length >= 1, `${filed.length} night(s) filed`);
  /*
   * AND IT KNOWS WHICH PUB — which is the half the gallery's frame hangs on.
   * `venueOverlayFor()` reads the night's archive record for its venue and then
   * the invoice book for that venue's overlay, so a night that comes back
   * WITHOUT a pub on it is a gallery with no frame, which is how this was
   * reported: *"we seem to have lost the overlay"*.
   */
  const pub = filed.find((g) => String(g.venue || '').includes('Station Tap'));
  check('…and it still knows which pub it was at', Boolean(pub),
    JSON.stringify(filed.slice(0, 2)).slice(0, 220));
  /* ------------------------------------ AND A FAILED BACKUP SAYS SO OUT LOUD
   *
   * The half that actually cost six weeks. Every backup is fired and forgotten,
   * so when `PHOTO_TOKEN` stopped being able to write, nothing anywhere said a
   * word — the console looked right, the night filed, and the record went
   * nowhere. So: a second app whose repository CANNOT be written, one venue
   * saved, and the flight recorder has to be able to tell somebody.
   */
  const deaf = fs.mkdtempSync(path.join(os.tmpdir(), 'survive-deaf-'));
  // A FILE where the stub wants a folder: every write throws, which is what a
  // token that cannot write looks like from in here.
  fs.writeFileSync(path.join(deaf, 'wall'), 'not a folder');
  const broken = await startApp({
    key: 'deaf-key',
    nodeArgs: ['--import', STUB],
    env: { GH_STUB_DIR: path.join(deaf, 'wall'), PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub' },
    seed: async (dir) => {
      const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
      const book = new Accounts(path.join(dir, 'accounts.json'));
      book.create({ email: 'qm@example.com', password: PW, name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
      book.save();
    },
  });
  try {
    const inAgain = await fetch(`${broken.base}/api/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: PW }) });
    const c2 = (inAgain.headers.getSetCookie() || []).map((x) => x.split(';')[0]).join('; ');
    const saved = await fetch(`${broken.base}/api/invoices/customers`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: c2 }, body: JSON.stringify({ name: 'The Unwritable Arms' }) });
    const said = await saved.json().catch(() => ({}));
    check('a venue still saves when the backup cannot be written', saved.status === 200, `${saved.status}`);
    check('…and the reply says it was not backed up', said.backedUp === false, JSON.stringify(said).slice(0, 120));
    await wait(600);
    const rec = await fetch(`${broken.base}/api/flight`, { headers: { cookie: c2 } });
    const flight = await rec.json().catch(() => ({}));
    const text = String((flight && flight.text) || JSON.stringify(flight));
    check('AND THE FLIGHT RECORDER SAYS SO — the six-week silence is over',
      /was NOT backed up/.test(text), text.slice(-260));
  } finally {
    broken.stop();
    fs.rmSync(deaf, { recursive: true, force: true });
  }

  /* --------------------------- AND A SLOW ONE DOES NOT CRY WOLF
   *
   * The other half, and the one that decides whether the line above is worth
   * anything. `within()` stops a REQUEST waiting after three seconds and says
   * `ok:false` — but the write is still running and still lands, which is its
   * whole design. Warning on that would put *"the invoice book was NOT backed
   * up"* on the Help tab on any slow GitHub morning, about books that were
   * backed up perfectly, and `github-down.mjs` has measured a venue save at two
   * full timeouts. **A warning that fires when nothing is wrong is how the one
   * sentence he is meant to act on becomes the one he skims.**
   *
   * **THE STUB HAS TO BE SLOWED FOR THIS TO MEAN ANYTHING.** A local write
   * finishes in under a millisecond, so with an ordinary stub the timeout branch
   * never runs and this passes with the fault put back — which it did, once.
   * `GH_STUB_DELAY_MS=60` against `BACKUP_WAIT_MS=20` makes every backup late
   * and every backup land.
   */
  const slowRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'survive-slow-'));
  const slow = await startApp({
    key: 'slow-key',
    nodeArgs: ['--import', STUB],
    env: { GH_STUB_DIR: slowRepo, PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub', BACKUP_WAIT_MS: '20', GH_STUB_DELAY_MS: '60' },
    seed: async (dir) => {
      const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
      const book = new Accounts(path.join(dir, 'accounts.json'));
      book.create({ email: 'qm@example.com', password: PW, name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
      book.save();
    },
  });
  try {
    const inSlow = await fetch(`${slow.base}/api/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: PW }) });
    const c3 = (inSlow.headers.getSetCookie() || []).map((x) => x.split(';')[0]).join('; ');
    await fetch(`${slow.base}/api/invoices/customers`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: c3 }, body: JSON.stringify({ name: 'The Slow Arms' }) });
    await wait(900);
    const me = await (await fetch(`${slow.base}/api/me`, { headers: { cookie: c3 } })).json();
    const slowRoom = me && me.account && me.account.id;
    check('a slow backup still lands', fs.existsSync(path.join(slowRepo, `invoicing-${slowRoom}.json`)),
      `everything written: ${fs.readdirSync(slowRepo).join(', ')}`);
    const rec2 = await (await fetch(`${slow.base}/api/flight`, { headers: { cookie: c3 } })).json();
    const said2 = String((rec2 && rec2.text) || '');
    check('…and NOTHING says it was not backed up — a late write is not a failure',
      !/was NOT backed up/.test(said2), said2.split('\n').filter((l) => /backup/.test(l)).join(' | ').slice(0, 220));
  } finally {
    slow.stop();
    fs.rmSync(slowRepo, { recursive: true, force: true });
  }
} catch (err) {
  failures += 1;
  console.log('  FAIL threw:', err.stack || err.message);
} finally {
  app.stop();
  fs.rmSync(repo, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILED — a night does not survive a deploy.\n` : '\nALL GOOD — the venue, the night and the frame all come back after a deploy.\n');
process.exit(failures ? 1 : 0);
