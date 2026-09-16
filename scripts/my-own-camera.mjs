/**
 * THE QUIZMASTER'S OWN CAMERA — does his photograph reach the same bucket?
 *
 * ---
 *
 * Asked for as *"an app on my phone, or even just be able to bring up a PWA on
 * my phone, that I take photos and it goes into that same bucket from that same
 * evening."*
 *
 * The answer was that there is no new app: the control view is already the
 * thing in his hand all night, so the camera goes in the panel headed *Photos
 * on the big screen*, beside the switch that already governs them.
 *
 * Which leaves exactly one thing worth proving and it is the word BUCKET.
 * *"I don't want to have two buckets of photos"* was said about the projector
 * and the wall a day earlier, and the way this feature would go wrong is the
 * same way: a second store, or a photograph that lands somewhere only one
 * screen looks. So this presses the REAL control in a REAL browser and then
 * asks the projector, the wall and the host's own grid whether they are all
 * looking at the same picture — and whether ONE bin takes it off all three.
 *
 * **A ROUTE THAT WORKS PROVES NOTHING ABOUT WHETHER ANYBODY CAN REACH IT** —
 * this repo's oldest lesson, and the publish route that nothing ever called is
 * the scar. So the file goes on through the page's own `<input>`, found by
 * `elementFromPoint()` at its middle rather than by a selector: *in the
 * document*, *has a size* and *can be pressed* are three questions.
 *
 *     node scripts/my-own-camera.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'my-own-camera';
const OWNER = { email: 'camera@example.com', password: 'my-own-camera-password' };

const { Accounts } = await import('../src/accounts.js');
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Camera Check', role: 'owner' });

const { base: BASE, stop } = await startApp({ key: KEY, seed: seedOwner });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const host = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const screenState = () => fetch(`${BASE}/api/state?role=screen`).then((r) => r.json());
const wallState = () => fetch(`${BASE}/api/state?role=wall`).then((r) => r.json());
const hostState = () => host('/api/state?role=host').then((r) => r.body);

/** The page rebuilds on every push, so give it a moment to settle. */
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
  const lib = (await host('/api/library')).body;
  const pack = (lib.quiz || lib.text || [])[0] || (lib.quizzes || [])[0];
  await host('/api/host/launch', { game: 'quiz', packId: pack.id, replace: true, venue: 'The Camera Arms' });

  // A real JPEG, drawn in a browser because nothing here encodes one.
  const maker = await browser.newPage();
  await maker.goto(`${BASE}/login`);
  const b64 = await maker.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 420;
    const x = c.getContext('2d');
    x.fillStyle = '#243'; x.fillRect(0, 0, 640, 420);
    x.fillStyle = '#fd6'; x.font = 'bold 48px sans-serif';
    x.fillText('the room', 60, 220);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  });
  await maker.close();
  const JPEG = Buffer.from(b64, 'base64');

  /* --------------------------------------------- the control is on the screen */

  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/host?key=${KEY}`);
  await page.waitForSelector('.panel.photos .mine-pick', { timeout: 15000 });

  const reachable = await page.evaluate(() => {
    const el = document.querySelector('.panel.photos .mine-pick');
    if (!el) return { drawn: false };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      drawn: true,
      words: el.textContent.trim(),
      height: Math.round(r.height),
      pressable: Boolean(at && (at === el || el.contains(at))),
      said: (document.querySelector('.panel.photos .mine-said') || {}).textContent || '',
    };
  });
  check('the control view draws a camera of the host\'s own', reachable.drawn);
  check('a finger lands on it', reachable.pressable, `${reachable.height}px tall`);
  check('it is at the touch floor', reachable.height >= 44, `${reachable.height}px`);
  // THE ONE FACT HE ASKED ABOUT: not that photographs go on a screen — the
  // panel's own line above already says that — but that HIS go in the same
  // pile as everybody else's. *"I don't want to have two buckets of photos."*
  check('it says his goes in with the room\'s', /with the room/i.test(reachable.said),
    JSON.stringify(reachable.said));

  /* ------------------------------------------------------------- one bucket */

  const before = (await screenState()).photos || [];
  await page.setInputFiles('.panel.photos .mine-pick input[type="file"]', {
    name: 'the-room.jpg', mimeType: 'image/jpeg', buffer: JPEG,
  });
  await page.waitForFunction(
    (n) => document.querySelectorAll('.panel.photos .photo-grid .host-photo').length > n,
    before.length, { timeout: 15000 },
  );

  const onScreen = await settled(async () => ((await screenState()).photos || []).length);
  const onWall = ((await wallState()).photos || []);
  const onHost = ((await hostState()).photos || { items: [] });

  check('it is on the projector', onScreen === before.length + 1, `${onScreen} up`);
  check('it is on the wall — ONE bucket, not two', onWall.length === onScreen,
    JSON.stringify({ projector: onScreen, wall: onWall.length }));
  check('it is in the host\'s own grid, with a bin on it', onHost.count === onScreen);

  const mine = onWall[0] || {};
  check('it carries no caption — a picture of the room is not captioned with the name of whoever took it',
    !mine.teamName, JSON.stringify(mine.teamName));
  check('no player id leaves on any wire', !JSON.stringify(onWall).includes('playerId'));

  /* ------------------------------------------ one bin takes it off everything */

  await host('/api/host/photoRemove', { id: mine.id });
  const afterScreen = await settled(async () => ((await screenState()).photos || []).length);
  const afterWall = ((await wallState()).photos || []).length;
  check('the host\'s bin takes it off the projector', afterScreen === before.length);
  check('and off the wall in the same press', afterWall === afterScreen,
    JSON.stringify({ projector: afterScreen, wall: afterWall }));

  /* --------------------------------- the kill switch is honoured, and in words */

  await host('/api/host/photosOn', { on: false });
  const refused = await fetch(`${BASE}/api/host/photo?camera=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg', 'X-Host-Key': KEY },
    body: JPEG,
  }).then((r) => r.json());
  check('with the room\'s photographs switched off, his own is refused too', refused.ok === false,
    JSON.stringify(refused));
  check('and the refusal says which switch', refused.reason === 'off', JSON.stringify(refused.reason));

  await page.waitForFunction(
    () => /switched off/i.test((document.querySelector('.panel.photos .mine-said') || {}).textContent || ''),
    null, { timeout: 15000 },
  ).then(() => check('the control says so before it is pressed', true))
    .catch(() => check('the control says so before it is pressed', false));
  await host('/api/host/photosOn', { on: true });

  /* ------------------------------------------ and it is there on a bingo night */

  const bingoPack = (lib.bingo || [])[0];
  if (bingoPack) {
    await host('/api/host/launch', { game: 'bingo', packId: bingoPack.id, replace: true, venue: 'The Camera Arms' });
    await page.reload();
    await page.waitForSelector('.panel.photos', { timeout: 15000 });
    const onBingo = await page.evaluate(() => Boolean(document.querySelector('.panel.photos .mine-pick')));
    check('it is on the BINGO desk too — photographs belong to the room, not the game', onBingo);
  }

  check('nothing threw in the browser', errors.length === 0, errors.join(' | '));
  await page.close();
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
