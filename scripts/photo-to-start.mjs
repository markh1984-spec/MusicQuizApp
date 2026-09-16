/**
 * ONE PHOTOGRAPH TO START THE NIGHT — is the gate real, and is the way past it?
 *
 * ---
 *
 * Asked for as *"one photo as a cost to enter the night's entertainment… and
 * it can't be an upload, has to be from the camera"*, then *"make it awkward
 * to join without taking a camera photo."*
 *
 * **BOTH HALVES OF THAT ARE THINGS THAT BREAK SILENTLY**, in opposite
 * directions, and each of them draws perfectly when it is broken:
 *
 *   - the gate never appearing, so the ask does nothing and the host finds out
 *     from a thin gallery weeks later;
 *   - the gate never CLEARING, so a phone that did exactly what was asked is
 *     still looking at the same screen while the quiz starts around it;
 *   - the skip not working, which is the one this app must never ship — the
 *     people it strands are the ones who cannot take a photograph at all;
 *   - and the camera test accepting anything, which is the whole distinction
 *     the host asked for.
 *
 * So this drives three real phones over HTTP and a real browser:
 *
 *   - a phone that has sent nothing sees the gate, and can put a finger on it;
 *   - while the gate is up the lobby GAME is not offered — one primary;
 *   - a phone that posts `camera=1` no longer sees it;
 *   - a phone that posts WITHOUT `camera=1` still does — an upload is not the
 *     thing that was asked for;
 *   - pressing the skip stands it down and the game comes back;
 *   - and at kick-off it is gone for everybody, sent one or not.
 *
 *     node scripts/photo-to-start.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'photo-to-start';
const OWNER = { email: 'gate@example.com', password: 'photo-gate-password-here' };

const { Accounts } = await import('../src/accounts.js');
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Gate Check', role: 'owner' });

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

const browser = await chromium.launch();
try {
  const lib = (await host('/api/library')).body;
  const pack = (lib.quiz || lib.text || [])[0] || (lib.quizzes || [])[0];
  const launch = await host('/api/host/launch',
    { game: 'quiz', packId: pack.id, replace: true, venue: 'The Shutter' });
  check('a quiz launches', launch.status === 200, `${launch.status}`);
  const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';

  /*
   * A REAL JPEG WITH AND WITHOUT AN EXIF `Make` TAG.
   *
   * The whole distinction being tested is one the server reads off a query
   * flag the PHONE sets from `looksCameraTaken()`, so what matters here is the
   * two shapes of request rather than the bytes. The bytes still have to be a
   * decodable JPEG, which the browser makes rather than this checking one in —
   * the fixtures elsewhere in this repo are 64 bytes of nothing.
   */
  const maker = await browser.newPage();
  await maker.goto(`${BASE}/`);
  const b64 = await maker.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 800;
    const x = c.getContext('2d');
    x.fillStyle = '#c94'; x.fillRect(0, 0, 600, 800);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  });
  await maker.close();
  const jpeg = Buffer.from(b64, 'base64');

  const join = async (name) => (await fetch(`${BASE}/api/join${g}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })).json();
  const sendPhoto = (who, camera) => fetch(
    `${BASE}/api/photo?playerId=${encodeURIComponent(who.playerId || who.id)}`
    + `${camera ? '&camera=1' : ''}${joinCode ? `&g=${joinCode}` : ''}`,
    { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg },
  ).then((r) => r.json());

  /* ------------------------------------------ a phone that has sent nothing */

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const boom = [];
  page.on('pageerror', (e) => boom.push(String(e)));
  await page.goto(`${BASE}/play${g ? `?g=${joinCode}` : ''}`);
  await page.fill('#nameInput', 'The Shutterbugs');
  await page.click('#joinBtn');
  await page.waitForSelector('.photo-gate', { timeout: 10000 }).catch(() => {});

  check('a phone that has sent nothing is asked for one',
    await page.locator('.photo-gate').count() === 1,
    'the gate never drew');

  /*
   * PUT A FINGER ON IT — in the document, has a size and can be pressed are
   * three questions, and this repo has been bitten by the gap five times.
   */
  const reach = await page.evaluate(() => {
    const el = document.querySelector('.photo-gate-go');
    if (!el) return 'not drawn';
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 'no size';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el.contains(hit) || hit === el ? 'yes' : `covered by ${hit && hit.className}`;
  });
  check('the camera button can actually be pressed', reach === 'yes', reach);

  const skipBox = await page.locator('.photo-gate-skip').boundingBox().catch(() => null);
  check('and the way past it is a real 44px target, not a trap',
    Boolean(skipBox) && skipBox.height >= 44, JSON.stringify(skipBox));

  /*
   * BOTH HALVES IN ONE ASSERTION, because the first version of this passed on
   * a phone that had never joined: no `.wait-menu` is also what an empty page
   * looks like. A guard that is satisfied by nothing having happened is the
   * fault this repo keeps recording.
   */
  check('the lobby game is not offered while the gate is up',
    await page.locator('.photo-gate').count() === 1
      && await page.locator('.wait-menu').count() === 0,
    'two primaries — the game wins and the ask is wallpaper');

  /* ------------------------------- a camera shot clears it; an upload does not */

  const alpha = await join('Alpha');
  const upload = await sendPhoto(alpha, false);
  check('an upload is accepted and kept', upload.ok === true, JSON.stringify(upload));
  const afterUpload = await fetch(
    `${BASE}/api/state?role=player&playerId=${alpha.playerId || alpha.id}`
    + `&token=${encodeURIComponent(alpha.token)}${joinCode ? `&g=${joinCode}` : ''}`,
  ).then((r) => r.json());
  check('but an upload does NOT answer the ask', !afterUpload.photoDone,
    'a camera roll pick cleared a gate that asked for a camera');

  await sendPhoto(alpha, true);
  const afterCamera = await fetch(
    `${BASE}/api/state?role=player&playerId=${alpha.playerId || alpha.id}`
    + `&token=${encodeURIComponent(alpha.token)}${joinCode ? `&g=${joinCode}` : ''}`,
  ).then((r) => r.json());
  check('a camera shot does', afterCamera.photoDone === true,
    'the phone did what was asked and is still being asked');

  /* --------------------------------------------- and the way past it works */

  await page.locator('.photo-gate-skip').click();
  await page.waitForTimeout(400);
  check('pressing the way past it stands the gate down',
    await page.locator('.photo-gate').count() === 0,
    'the skip is drawn and does nothing, which is worse than no skip');
  check('and the lobby comes back with it',
    await page.locator('.wait-menu').count() === 1,
    'stood the gate down and left the phone with nothing to do');

  /* ------------------------------------- and it owns the lobby and no more */

  const fresh = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fresh.goto(`${BASE}/play${g ? `?g=${joinCode}` : ''}`);
  await fresh.fill('#nameInput', 'Late Arrivals');
  await fresh.click('#joinBtn');
  await fresh.waitForSelector('.photo-gate', { timeout: 8000 }).catch(() => {});
  check('a phone arriving later is asked too',
    await fresh.locator('.photo-gate').count() === 1);

  await host('/api/host/start', {});
  await fresh.waitForTimeout(1200);
  check('and at kick-off it is gone, sent one or not',
    await fresh.locator('.photo-gate').count() === 0,
    'the gate outlived the lobby — a phone can be locked out of a question');

  check('nothing threw on the phone', boom.length === 0, boom.join(' | '));
} finally {
  await browser.close().catch(() => {});
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
