#!/usr/bin/env node
/**
 * DOES THE VENUE FRAME REACH THE PUBLIC GALLERY — on screen and in a save?
 *
 * Asked for directly: *"is it possible to have the overlay automatically apply
 * to all photos on the /gallery pathway so when people share the public gallery
 * it's already there?"* It was already on the CONSOLE export; this puts it on
 * the page a stranger opens.
 *
 * The frame lives on the venue's invoice record, behind an owner-gated route a
 * visitor cannot reach — so the public path is a NEW route, `/gallery-frame/
 * <night>`, gated on the same publish check as the photographs and resolving
 * the venue itself (a visitor never names a venue id). This drives the whole
 * thing over real HTTP and in a real browser, because a payload being right
 * proves nothing about whether anybody drew it:
 *
 *   - the frame route serves an image to a visitor with NO cookie;
 *   - the night payload names the frame;
 *   - the grid draws a frame layer over every photo, with real size;
 *   - the enlarged photo has the frame ON the picture, not the letterboxing;
 *   - and the whole thing rests on a CAMERA photo (the default gate is back),
 *     so a night of camera shots actually shows.
 *
 * Nothing is baked into the stored bytes — the frame is a layer the browser
 * draws and composites into a save, exactly as `console-photo-export.js` does.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { freePort } from '../test/helpers/live-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const PW = 'a-long-enough-one-for-here';
const NIGHT = '2026-08-20';
const VENUE = 'The Station Tap, Wokingham';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? `  — ${detail}` : ''}`); };

const data = mkdtempSync(join(tmpdir(), 'gfr-'));
const repo = mkdtempSync(join(tmpdir(), 'gfr-gh-'));
const port = await freePort();
const env = { ...process.env, PORT: String(port), HOST_KEY: 'x', DATA_DIR: data, GH_STUB_DIR: repo, PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub' };
const base = `http://127.0.0.1:${port}`;
let server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
const up = async () => { for (let i = 0; i < 60; i += 1) { try { await fetch(base); return; } catch { await wait(200); } } throw new Error('no up'); };
const post = (p, b, c = '') => fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(c ? { Cookie: c } : {}) }, body: JSON.stringify(b) });
const get = (p, c = '') => fetch(`${base}${p}`, { headers: c ? { Cookie: c } : {} });
const put = (p, b, c) => fetch(`${base}${p}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify(b) });

const browser = await chromium.launch();
console.log('\nTHE VENUE FRAME ON THE PUBLIC GALLERY — on screen and in the save?\n');
try {
  await up();
  const made = await (await post('/api/signup', { email: 'qm@example.com', password: PW, name: 'Mark' })).json();
  const t = new URL(made.devLink).searchParams.get('t'); await post('/api/reset/complete', { token: t, password: PW });
  const file = join(data, 'accounts.json'); const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'quizmaster'; acc.accounts[0].comped = true; acc.accounts[0].status = 'active'; writeFileSync(file, JSON.stringify(acc));
  server.kill(); await wait(300); server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' }); await up();
  const signIn = await post('/api/sign-in', { email: 'qm@example.com', password: PW });
  const cookie = (signIn.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  const me = await (await get('/api/me', cookie)).json(); const roomId = me.account.id;

  const maker = await browser.newPage(); await maker.goto(`${base}/`);
  const { jpeg, tall, overlay } = await maker.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; const x = c.getContext('2d');
    x.fillStyle = '#6f5a48'; x.fillRect(0, 0, 1080, 1080); x.fillStyle = '#c8a875'; x.beginPath(); x.arc(540, 470, 220, 0, 7); x.fill();
    const jpeg = c.toDataURL('image/jpeg', 0.9).split(',')[1];
    /*
     * AND A PORTRAIT ONE. A player's photo is squared on the way in, but the
     * quizmaster's own (`myPhotos`, `square: false`) is not — so the gallery
     * holds pictures that are taller than they are wide, and the frame has to
     * behave on one. Drawn with a stripe down each side so a stretch shows.
     */
    const t = document.createElement('canvas'); t.width = 1080; t.height = 1440; const tx = t.getContext('2d');
    tx.fillStyle = '#48425a'; tx.fillRect(0, 0, 1080, 1440); tx.fillStyle = '#a8c875'; tx.beginPath(); tx.arc(540, 700, 260, 0, 7); tx.fill();
    const tall = t.toDataURL('image/jpeg', 0.9).split(',')[1];
    const o = document.createElement('canvas'); o.width = 1080; o.height = 1080; const ox = o.getContext('2d');
    ox.strokeStyle = 'rgba(255,210,63,0.95)'; ox.lineWidth = 26; ox.strokeRect(13, 13, 1054, 1054);
    ox.fillStyle = 'rgba(18,14,36,0.92)'; ox.fillRect(0, 960, 1080, 120);
    ox.fillStyle = '#ffd23f'; ox.font = 'bold 44px sans-serif'; ox.textAlign = 'left'; ox.fillText('PUB CHAMPIONS', 40, 1032);
    ox.fillStyle = '#fff'; ox.textAlign = 'right'; ox.font = 'bold 46px sans-serif'; ox.fillText('THE STATION TAP', 1044, 1032);
    return { jpeg, tall, overlay: o.toDataURL('image/png') };
  });
  await maker.close();
  const bytes = Buffer.from(jpeg, 'base64');
  const tallBytes = Buffer.from(tall, 'base64');

  const mk = await (await post('/api/invoices/customers', { name: VENUE }, cookie)).json();
  const venue = (mk.customers || []).find((v) => v.name === VENUE);
  check('a venue record was made', Boolean(venue));
  await put(`/api/invoices/customers/${venue.id}/rewards`, { overlay }, cookie);

  const arc = join(data, 'rooms', roomId, 'archive'); mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({
    id: 'n1', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: VENUE, venueId: venue.id,
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));
  /*
   * FOUR FROM THE HOUSE CAMERA AND ONE FROM THE ROOM. The gallery gate is the
   * SOURCE now (`isHousePhoto()`): a name carrying `-picked` is one a punter's
   * handset sent, and it waits for a green lamp rather than publishing itself.
   * Seeded here so the READ path is proven over real HTTP — the write half
   * (`playerId` decides the marker) is pinned in gallery-camera-only.test.js.
   */
  const dir = join(repo, 'photos', roomId, NIGHT); mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 4; i += 1) writeFileSync(join(dir, `p${i}.jpg`), bytes);
  writeFileSync(join(dir, 'p4.jpg'), tallBytes);
  writeFileSync(join(dir, 'p9-picked.jpg'), bytes);
  const pub = await post('/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);
  check('the night publishes', pub.status === 200, `${pub.status}`);

  const fr = await get(`/gallery-frame/${NIGHT}?q=${roomId}`);
  check('the frame route serves an image to a stranger', fr.status === 200 && /image\//.test(fr.headers.get('content-type') || ''), `${fr.status} ${fr.headers.get('content-type')}`);

  const nightJson = await (await get(`/api/gallery/${NIGHT}?q=${roomId}`)).json();
  check('the night payload names the frame', /gallery-frame/.test(nightJson.frame || ''), JSON.stringify(nightJson.frame));
  check('the night shows the house camera\'s five', (nightJson.photos || []).length === 5, `${(nightJson.photos || []).length} photos`);
  check('and the one the room sent stays off the public page',
    !(nightJson.photos || []).some((p) => String(p.name).includes('-picked')),
    JSON.stringify((nightJson.photos || []).map((p) => p.name)));

  const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
  await page.goto(`${base}/gallery?q=${roomId}&n=${NIGHT}`, { waitUntil: 'load' });
  await wait(700);
  const grid = await page.evaluate(() => {
    const shots = [...document.querySelectorAll('.gal-shot')];
    const frames = [...document.querySelectorAll('.gal-shot .gal-frame')];
    return { shots: shots.length, frames: frames.length, frameShown: frames.length ? frames[0].getBoundingClientRect().width > 20 : false };
  });
  check('the grid drew a frame layer over each photo', grid.shots === 5 && grid.frames === 5, JSON.stringify(grid));
  check('the frame layer has real size', grid.frameShown, JSON.stringify(grid));

  await page.click('.gal-shot');
  await wait(500);
  const big = await page.evaluate(() => {
    const img = document.querySelector('.gal-big-pic > .gal-photo');
    const frame = document.querySelector('.gal-big-pic .gal-frame');
    if (!img || !frame) return { ok: false };
    const a = img.getBoundingClientRect(); const b = frame.getBoundingClientRect();
    const aligned = Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2
      && Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;
    return { ok: true, aligned, shape: a.width / a.height, natural: img.naturalWidth / img.naturalHeight, a, b };
  });
  check('the enlarged photo has the frame ON the picture', big.ok && big.aligned, JSON.stringify(big));
  check('and a square photograph is drawn square', big.ok && Math.abs(big.shape - big.natural) < 0.02,
    `drawn ${big.shape?.toFixed(3)} against its own ${big.natural?.toFixed(3)}`);

  /*
   * AND ON A PORTRAIT PHOTOGRAPH, which is the half this guard could not see:
   * every fixture was 1080 SQUARE, where a stretched square overlay and a
   * fitted one are the same picture. Reported off the live page — *"on enlarge
   * the logos seem to distort and leave the picture frame."*
   */
  await page.evaluate(() => document.querySelector('.gal-big')?.click());
  await wait(300);
  const tallAt = await page.evaluate(() => [...document.querySelectorAll('.gal-shot img:not(.gal-frame)')]
    .findIndex((im) => im.naturalHeight > im.naturalWidth));
  check('the grid holds a portrait photograph', tallAt >= 0, `index ${tallAt}`);
  await page.evaluate((at) => document.querySelectorAll('.gal-shot')[at].click(), tallAt);
  await wait(500);
  const tallBig = await page.evaluate(() => {
    const img = document.querySelector('.gal-big-pic > .gal-photo');
    const frame = document.querySelector('.gal-big-pic .gal-frame');
    if (!img || !frame) return { ok: false };
    const a = img.getBoundingClientRect(); const b = frame.getBoundingClientRect();
    const near = (x, y) => Math.abs(x - y) < 2;
    return {
      ok: true,
      aligned: near(a.left, b.left) && near(a.top, b.top) && near(a.width, b.width) && near(a.height, b.height),
      // The frame is a designed square. Drawn to a box that is not its own
      // shape, every logo in it is stretched.
      frameShape: b.width / b.height,
      frameNatural: frame.naturalWidth / frame.naturalHeight,
      photoShape: a.width / a.height,
      photoNatural: img.naturalWidth / img.naturalHeight,
      // FITTED, not cropped: the box is the frame's shape and the photograph
      // letterboxes inside it. `cover` here would be the whole picture put up
      // to be looked at with its top and bottom taken off.
      fit: getComputedStyle(img).objectFit,
      inside: a.right <= window.innerWidth + 1 && a.bottom <= window.innerHeight + 1 && a.top >= -1 && a.left >= -1,
      a, b,
    };
  });
  // A picture of it, when one is asked for — the frame is a LOOK, and a
  // measurement in pixels is not what somebody judges a look by.
  if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, 'gallery-portrait-enlarged.png') });
  check('a portrait photo\'s frame sits on the picture', tallBig.ok && tallBig.aligned, JSON.stringify(tallBig));
  check('and the frame is not stretched out of shape',
    tallBig.ok && Math.abs(tallBig.frameShape - tallBig.frameNatural) < 0.02,
    `drawn ${tallBig.frameShape?.toFixed(3)} against its own ${tallBig.frameNatural?.toFixed(3)}`);
  check('and the whole photograph is still there, fitted rather than cropped',
    tallBig.ok && tallBig.fit === 'contain', `object-fit: ${tallBig.fit}`);
  check('and the pair is on the screen', tallBig.ok && tallBig.inside, JSON.stringify(tallBig.a));
} catch (err) {
  failures += 1;
  console.log('  FAIL threw:', err.stack || err.message);
} finally {
  await browser.close(); server.kill();
}
console.log(failures ? `\n${failures} FAILED\n` : '\nALL GOOD — the venue frame is on the public gallery, on screen and in the save.\n');
process.exit(failures ? 1 : 0);
