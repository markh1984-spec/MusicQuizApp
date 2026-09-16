/**
 * THE BAR STAFF'S CAMERA — does their photo reach the same pile, and nothing else?
 *
 * ---
 *
 * Asked for as *"one of the bar staff could also get access to this. So they
 * can take photos, I can take photos, people can upload their own photos, and
 * then they all go into one like shared bucket."*
 *
 * Three things to prove, and they pull against each other:
 *
 *   - **one bucket** — the word he used the day before about the projector and
 *     the wall, so it is the thing this feature would most obviously get
 *     wrong;
 *   - **and nothing else reaches that page.** This link is handed to somebody
 *     who does not work for him, on a phone he will never see again, so rule 1
 *     has to hold for a fourth screen: no question, no answer key, no scores,
 *     no player id. Swept over the WHOLE payload rather than checked field by
 *     field, because a named check only catches what somebody thought of.
 *   - **no row on the board.** The whole reason this is not a join.
 *
 *     node scripts/bar-staff-camera.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'bar-staff';
const QM = { email: 'qm@example.com', password: 'quizmaster passphrase' };

/*
 * A REAL QUIZMASTER ACCOUNT, NOT THE HOST KEY — the lesson `two-screens.mjs`
 * was written for. The host key resolves to the HOUSE room, which has NO JOIN
 * CODE, and a join code is the entire mechanism this feature hangs on: on the
 * host key the link would be handed over with nothing on it and the guard
 * would be measuring a page that cannot exist in a pub.
 */
const { base: BASE, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import('/home/user/MusicQuizApp/src/accounts.js');
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    book.create({ ...QM, name: 'Mark', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

/*
 * Every quizmaster-side call goes through the SIGNED-IN TAB, so the cookie
 * resolves the room the same way `/host` does. Set up in the try block below.
 */
let desk = null;
const host = (route, body) => desk.evaluate(([r, b]) => fetch(r, {
  method: b ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json' },
  ...(b ? { body: JSON.stringify(b) } : {}),
}).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) })),
[route, body || null]);

const settled = async (read, tries = 40) => {
  let last = await read();
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 120));
    const now = await read();
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  return last;
};

const browser = await chromium.launch();
try {
  // ONE CONTEXT for the quizmaster's tabs — `browser.newPage()` opens a fresh
  // incognito context with its own cookie jar, which is how a working control
  // view comes back 401.
  const deskCtx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  desk = await deskCtx.newPage();
  await desk.goto(`${BASE}/login`, { waitUntil: 'load' });
  await desk.fill('input[type=email]', QM.email);
  await desk.fill('input[type=password]', QM.password);
  await desk.evaluate(() => document.querySelector('form')?.requestSubmit());
  await desk.waitForTimeout(2500);

  const lib = (await host('/api/library')).body;
  const pack = (lib.quiz || lib.text || [])[0] || (lib.quizzes || [])[0];
  await host('/api/host/launch', { game: 'quiz', packId: pack.id, replace: true, venue: 'The Bar Staff Arms' });
  const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';
  const gq = joinCode ? `&g=${joinCode}` : '';
  check('the night has a join code to hand over', Boolean(joinCode), joinCode);

  // Somewhere for the quiz to actually be, so the sweep below has an answer
  // key and a question to find if this page leaks one.
  await host('/api/host/start', {});
  await host('/api/host/next', {});

  const screenState = () => fetch(`${BASE}/api/state?role=screen${gq}`).then((r) => r.json());
  const hostState = () => host('/api/state?role=host').then((r) => r.body);

  // A real JPEG, drawn in a browser because nothing here encodes one.
  const maker = await browser.newPage();
  await maker.goto(`${BASE}/login`);
  const b64 = await maker.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 400;
    const x = c.getContext('2d');
    x.fillStyle = '#134'; x.fillRect(0, 0, 600, 400);
    x.fillStyle = '#6fd'; x.font = 'bold 44px sans-serif';
    x.fillText('behind the bar', 40, 210);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  });
  await maker.close();
  const JPEG = Buffer.from(b64, 'base64');

  /* ------------------------------------------- a phone that has never seen it */

  // A FRESH CONTEXT: `browser.newPage()` opens its own cookie jar, which is
  // exactly what a member of bar staff is — no account, no key, no history.
  // A FRESH incognito context IS what we want here, unlike above: bar staff
  // have never signed into anything.
  const bar = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  bar.on('pageerror', (e) => errors.push(String(e)));
  const res = await bar.goto(`${BASE}/snap${g}`);
  check('the page opens with no account at all', res.status() === 200, `HTTP ${res.status()}`);
  check('and it does not bounce to a sign-in', !/\/login/.test(bar.url()), bar.url());
  await bar.waitForSelector('.snap-take', { timeout: 15000 });

  const cookies = await bar.context().cookies();
  check('it needs no cookie', cookies.length === 0, `${cookies.length} set`);

  const reachable = await bar.evaluate(() => {
    const el = document.querySelector('.snap-take');
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { h: Math.round(r.height), pressable: Boolean(at && (at === el || el.contains(at))) };
  });
  check('a finger lands on the camera', reachable.pressable, `${reachable.h}px tall`);
  check('it is well past the touch floor', reachable.h >= 44, `${reachable.h}px`);

  /* -------------------------------------- nothing about the quiz reaches them */

  const wall = await fetch(`${BASE}/api/state?role=wall${gq}`).then((r) => r.json());
  const wire = JSON.stringify(wall);
  const q = ((await hostState()) || {}).question || {};
  check('no question text on the wire', !q.prompt || !wire.includes(q.prompt),
    JSON.stringify(q.prompt || '').slice(0, 40));
  for (const field of ['correctIndex', 'correctIndexes', 'answer', 'hostNote', 'reveal', 'options', 'players', 'leaderboard', 'playerId', 'token']) {
    check(`no ${field} on the wire`, !wire.includes(`"${field}"`));
  }

  /* -------------------------------------------------- one bucket, one bin */

  const before = ((await screenState()).photos || []).length;
  await bar.setInputFiles('.snap-take input[type="file"]', {
    name: 'behind-the-bar.jpg', mimeType: 'image/jpeg', buffer: JPEG,
  });
  await bar.waitForFunction(
    () => /Sent/i.test((document.querySelector('.snap-said') || {}).textContent || ''),
    null, { timeout: 15000 },
  ).then(() => check('the page says it went', true)).catch(() => check('the page says it went', false));

  const onScreen = await settled(async () => ((await screenState()).photos || []).length);
  const onWall = ((await fetch(`${BASE}/api/state?role=wall${gq}`).then((r) => r.json())).photos || []);
  const onHost = ((await hostState()) || {}).photos || { items: [], count: 0 };

  check('it is on the projector', onScreen === before + 1, `${onScreen} up`);
  check('it is on the second screen — ONE bucket', onWall.length === onScreen,
    JSON.stringify({ projector: onScreen, wall: onWall.length }));
  check('it is in the quizmaster\'s own grid, with a bin on it', onHost.count === onScreen);

  const mine = onWall[0] || {};
  check('it carries no caption', !mine.teamName, JSON.stringify(mine.teamName));

  /* ---------------------------------------------- and NOT on the leaderboard */

  const board = ((await hostState()) || {}).players || [];
  check('nobody joined the quiz to send it', board.length === 0, `${board.length} on the board`);
  check('the projector is not showing a phantom team',
    (((await screenState()) || {}).playerCount || 0) === 0);

  /* ------------------------------ the pile is shown back, and the bin clears it */

  await bar.waitForFunction(() => document.querySelectorAll('.snap-shot').length > 0,
    null, { timeout: 15000 })
    .then(() => check('the page shows what is already up', true))
    .catch(() => check('the page shows what is already up', false));

  await host('/api/host/photoRemove', { id: mine.id });
  const after = await settled(async () => ((await screenState()).photos || []).length);
  check('one bin press takes it off everything', after === before, `${after} left`);

  /* ------------------------------------------- the switch reaches this page too */

  await host('/api/host/photosOn', { on: false });
  const refused = await fetch(`${BASE}/api/snap?camera=1${gq}`, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: JPEG,
  }).then((r) => r.json());
  check('with photographs switched off, the bar is refused too', refused.ok === false,
    JSON.stringify(refused));
  await bar.waitForFunction(
    () => /switched off/i.test(document.body.textContent || ''),
    null, { timeout: 15000 },
  ).then(() => check('and the page says so rather than offering a dead button', true))
    .catch(() => check('and the page says so rather than offering a dead button', false));
  await host('/api/host/photosOn', { on: true });

  /* ------------------------------------------------------ a mistyped code */

  const junk = await fetch(`${BASE}/api/snap?camera=1&g=ZZZZ`, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: JPEG,
  });
  check('a mistyped code reaches nobody\'s room', junk.status >= 400, `HTTP ${junk.status}`);

  check('nothing threw on the bar\'s phone', errors.length === 0, errors.join(' | '));
  await bar.close();
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
