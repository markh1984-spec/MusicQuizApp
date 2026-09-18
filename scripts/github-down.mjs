#!/usr/bin/env node
/**
 * GITHUB IS DOWN. CAN A PUB STILL RUN A QUIZ?
 *
 * Every backup, the join-code book, the photographs and the accounts restore
 * go through the GitHub API, on a limit of 5,000 calls an hour shared across
 * all of them. None of that may stand between a room and a game: the rule is
 * that nothing on the protected surface WAITS on GitHub, and a GitHub that
 * has gone quiet costs a backup, never a night.
 *
 * It was true by inspection and never proved, and inspection missed the
 * worst case: `fetch()` has no timeout, `restoreFromBackup()` runs before
 * `server.listen()`, so a GitHub that accepted the connection and never
 * answered was a deploy that never came up. This hangs GitHub behind the REAL
 * server (`test/helpers/github-hangs-stub.mjs`) and measures:
 *
 *   1. the app answers HTTP within a few seconds of boot — one deadline, not
 *      nine in a row, and never "for ever";
 *   2. with GitHub still hung, a quizmaster signs in, launches, three phones
 *      join, answer and reach the final scores, and every one of those
 *      requests comes back in well under a second — nothing on the path
 *      waits on the backup;
 *   3. a photo upload answers the phone at once — the push to the repository
 *      is a background job, never something a phone waits on;
 *   4. and the console's own first request after a deploy, which restores
 *      four files, costs ONE deadline rather than four in a row.
 *
 * `GITHUB_TIMEOUT_MS` is set short here so the run is short; the shape of the
 * result does not depend on the number.
 */

import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';

const STUB = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'test', 'helpers', 'github-hangs-stub.mjs');
const TIMEOUT_MS = 2500;
// How long a request may wait for its backup before answering without it.
const WAIT_MS = 600;
const KEY = 'ghdown';

let fails = 0;
const check = (name, ok, note = '') => {
  if (!ok) fails += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`);
};
const timed = async (fn) => { const t0 = Date.now(); const out = await fn(); return { out, ms: Date.now() - t0 }; };

console.log('\nGITHUB HAS GONE QUIET — a deploy, a sign-in, a night\n');

const booted = await timed(() => startApp({
  key: KEY,
  nodeArgs: ['--import', STUB],
  env: {
    // Configured, so the app genuinely tries: a private repo and a photo repo.
    PHOTO_REPO: 'nobody/private-photos', PHOTO_TOKEN: 'not-a-token',
    GITHUB_REPO: 'nobody/app', GITHUB_TOKEN: 'not-a-token',
    GITHUB_TIMEOUT_MS: String(TIMEOUT_MS),
    GITHUB_READ_TIMEOUT_MS: String(TIMEOUT_MS),
    BACKUP_WAIT_MS: String(WAIT_MS),
  },
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
}));
const { base: B, stop } = booted.out;
// startApp polls for up to 12s and throws past that; a boot of nine sequential
// deadlines (22s) fails here BEFORE the parallel restore existed.
check(`the app answered within one GitHub deadline of boot (${booted.ms}ms)`, booted.ms < TIMEOUT_MS + 4000, `${booted.ms}ms`);

let cookie = '';
const H = () => ({ 'content-type': 'application/json', cookie });
const J = async (route, opts = {}) => {
  const r = await fetch(B + route, opts);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const fast = async (name, fn, limit = WAIT_MS + 400) => {
  const { out, ms } = await timed(fn);
  check(`${name} came back in ${ms}ms`, ms < limit && out.status < 500, `status ${out.status} in ${ms}ms`);
  return out;
};
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });

try {
  const signIn = await fast('sign-in (it backs up the session, waiting at most the budget)', () => fetch(B + '/api/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) }).then(async (r) => ({ status: r.status, headers: r.headers })));
  cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  check('signed in', Boolean(cookie));

  const mk = await fast('making a venue (it backs up the invoice book)', () => J('/api/invoices/customers', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'The Quiet Arms' }) }), TIMEOUT_MS + WAIT_MS + 400);
  check('…and said the backup was NOT confirmed', mk.body && (mk.body.backupReady === false || mk.body.backedUp === false || JSON.stringify(mk.body).includes('false')), JSON.stringify(mk.body).slice(0, 160));
  const venue = ((mk.body || {}).customers || [])[0];
  if (venue) await fast('setting its prizes', () => J(`/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H(), body: JSON.stringify({ rewards: ['A pint'], usualNight: 'fri' }) }), WAIT_MS + 400);

  // The console's first request after a deploy restores four files. One
  // deadline, not four.
  const lib = await fast('the library (four restores, one deadline)', () => J('/api/library', { headers: H() }), TIMEOUT_MS + 900);
  const lib2 = await fast('the library again — a failed restore backs off, it is not retried per request', () => J('/api/library', { headers: H() }));
  check('venues survived the outage in the payload', Array.isArray(lib2.body && lib2.body.venueRecords) && lib2.body.venueRecords.some((v) => v.name === 'The Quiet Arms'), JSON.stringify(lib2.body && lib2.body.venueRecords));
  const code = lib.body && lib.body.running && lib.body.running.joinCode;
  check('the room has a join code (minting one writes the code book — in the background)', Boolean(code), JSON.stringify(lib.body && lib.body.running));

  const go = await fast('launch', () => host('launch', { game: 'quiz', packId: '1980s-pop-music', order: [{ packId: '1980s-pop-music', round: 0 }], venue: venue ? venue.name : '', venueId: venue ? venue.id : '', replace: true }), 1500);
  check('the night launched', go.status === 200, JSON.stringify(go.body).slice(0, 120));

  const phones = [];
  for (const name of ['Dave', 'Sue', 'Al']) {
    const j = await fast(`${name} joins`, () => J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) }));
    phones.push(j.body);
  }
  check('three phones are in', phones.every((p) => p && p.id && p.token));

  await fast('start', () => host('start'));
  const hv = await fast('the host view', () => J('/api/state?role=host', { headers: H() }));
  let guard = 0;
  let view = hv.body;
  while (view && view.phase !== 'question' && guard++ < 6) view = (await fast('next', () => host('next'))).body ? (await J('/api/state?role=host', { headers: H() })).body : view;
  check('a question is up', view && view.phase === 'question', view && view.phase);
  for (const p of phones) {
    await fast(`${p.name || 'a phone'} answers`, () => J('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code, optionIndex: 0 }) }));
  }
  await fast('reveal', () => host('reveal'));
  guard = 0;
  view = (await J('/api/state?role=host', { headers: H() })).body;
  while (view && view.phase !== 'final' && guard++ < 40) { await fast('next', () => host('next')); view = (await J('/api/state?role=host', { headers: H() })).body; }
  check('the night reached the final scores (filing it backs up the archive — in the background)', view && view.phase === 'final', view && view.phase);
  const vouchers = Object.values((view && view.vouchers) || {});
  check('a voucher was issued off the venue prizes', vouchers.length >= 1, `${vouchers.length}`);
  await fast('the winner\'s phone', () => J(`/api/state?role=player&playerId=${phones[0].id}&token=${encodeURIComponent(phones[0].token)}&g=${code}`));

  // A photograph genuinely needs the repo. It must fail within the deadline,
  // never hang the phone that sent it.
  const ONE_PIXEL = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
  const photo = await fast('a photo upload (the push to the repo is a background job)', () => fetch(`${B}/api/photo?playerId=${encodeURIComponent(phones[0].id)}&g=${code}&filter=none`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: ONE_PIXEL }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) })));
  check('…and the room has it', photo.body && photo.body.ok === true, JSON.stringify(photo.body).slice(0, 160));

  // After all that, the app is still answering — the queue of failed backups
  // did not pile up into anything a phone can feel.
  await fast('the host view, afterwards', () => J('/api/state?role=host', { headers: H() }));
} catch (err) {
  fails += 1;
  console.log('  FAIL threw:', err.stack || err);
} finally {
  await stop();
}

if (fails) { console.log(`\n${fails} FAILED — a quiet GitHub reached the room.`); process.exit(1); }
console.log('\nGitHub down, and a pub night ran without noticing.');
