#!/usr/bin/env node
/**
 * SAVE FOR INSTAGRAM — the square and the Story, pressed on the console and
 * measured in the files that come out.
 *
 *   node scripts/save-for-instagram.mjs
 *
 * The host, 1 October 2026: *"we also need to be able to export in both
 * instagram story and instagram square formats."* The square existed
 * ("Save with the venue frame"); the Story is new — 1080 x 1920, the poster
 * layout he picked: the framed photograph up top, *Quiz night* and the next
 * night under it, everything clear of the strips Instagram draws over.
 *
 * NOTHING PRESSED THE CONSOLE'S SAVE BUTTON BEFORE THIS. The other photo
 * guards call `framedBlob()` in the page, which proves the drawing and not
 * the control. This presses both buttons on an enlarged photograph on Post
 * gig, catches the downloads and reads the pixels back.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NIGHT = '2026-09-24';
const VENUE = 'The Station Tap, Wokingham';
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const repo = mkdtempSync(join(tmpdir(), 'insta-gh-'));
const app = await startApp({
  key: 'save-for-instagram',
  nodeArgs: ['--import', join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs')],
  env: { GH_STUB_DIR: repo, PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub' },
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(join(dir, 'accounts.json'));
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Mark', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});
const B = app.base;
let browser;
try {
  const signIn = await fetch(`${B}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const roomId = (await (await fetch(`${B}/api/me`, { headers: H })).json()).account.id;

  browser = await chromium.launch();
  const maker = await browser.newPage();
  await maker.goto(`${B}/`);
  // A BLUE landscape photograph, so where it lands in the Story can be found
  // by colour; and a frame whose band is dark with white words.
  const { jpeg, overlay } = await maker.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
    const x = c.getContext('2d'); x.fillStyle = '#2f6fff'; x.fillRect(0, 0, 1600, 1200);
    const o = document.createElement('canvas'); o.width = 1080; o.height = 1080; const ox = o.getContext('2d');
    ox.fillStyle = 'rgba(20,16,40,0.95)'; ox.fillRect(0, 960, 1080, 120);
    ox.fillStyle = '#ffffff'; ox.font = 'bold 40px sans-serif'; ox.textAlign = 'center'; ox.fillText('THE STATION TAP', 540, 1035);
    return { jpeg: c.toDataURL('image/jpeg', 0.9).split(',')[1], overlay: o.toDataURL('image/png') };
  });
  await maker.close();

  const mk = await (await fetch(`${B}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: VENUE }) })).json();
  const venue = (mk.customers || []).find((v) => v.name === VENUE);
  await fetch(`${B}/api/invoices/customers/${encodeURIComponent(venue.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ overlay, usualNight: 'thu', rewards: ['A pint'] }) });
  const arc = join(app.data, 'rooms', roomId, 'archive'); mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({
    id: 'n1', kind: 'quiz', quizTitle: '2006', packId: '2006',
    archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: VENUE, venueId: venue.id,
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));
  const dir = join(repo, 'photos', roomId, NIGHT); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'h1abc.jpg'), Buffer.from(jpeg, 'base64'));
  if (!await app.restart({ hard: false })) throw new Error('the server did not come back');

  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));

  console.log('\nAN ENLARGED PHOTO ON POST GIG');
  await page.goto(`${B}/console?door=post`, { waitUntil: 'load' });
  await wait(2000);
  const row = page.locator('.bay-rail .bay-pick').filter({ hasNotText: 'The wall' }).first();
  if (!(await row.count())) { await page.locator('.bay-rail .bay-rail-group').first().click().catch(() => {}); await wait(700); }
  await row.click();
  await wait(2500);
  await page.locator('.doorhead .cphoto').first().click();
  await wait(800);
  // ONE BUTTON ON THE ENLARGED PHOTO, AND IT OPENS THE SIDE-BY-SIDE SHEET
  // (2 October 2026) — the square and the Story drawn, a Download under each.
  const controls = await page.$$eval('.community-big .gal-save', (bs) => bs.map((b) => b.textContent.trim()));
  check('the enlarged photo offers one Save for Instagram', JSON.stringify(controls) === '["Save for Instagram"]', JSON.stringify(controls));
  await page.locator('.community-big .gal-save', { hasText: 'Save for Instagram' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.vp-big .vp-prev img').length === 2, null, { timeout: 15000 }).catch(() => {});
  const sheet = await page.$$eval('.vp-big .vp-opt', (fs) => fs.map((f) => ({ cap: f.querySelector('figcaption').textContent.trim(), btn: f.querySelector('.vp-share').textContent.trim() })));
  check('it opens the square and the Story side by side, Download under each (the console is the laptop)',
    sheet.length === 2 && sheet.every((x) => x.btn === 'Download'), JSON.stringify(sheet));
  check('and the enlarged photo is still there underneath', await page.locator('.community-big').count() === 1);
  if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, 'console-instagram-sheet.png') });

  // Read a downloaded JPEG back in the page and measure it.
  const measure = async (file) => page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/jpeg;base64,${b64}`; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const px = (X, Y) => { const i = (Y * c.width + X) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const blue = ([r, g, b]) => b > 200 && r < 90 && g > 80 && g < 150;
    const white = ([r, g, b]) => r > 225 && g > 225 && b > 225;
    let top = Infinity; let bottom = -1; let whiteBelow = 0; let blueAbove = 0;
    for (let Y = 0; Y < c.height; Y += 4) for (let X = 0; X < c.width; X += 8) {
      const p = px(X, Y);
      if (blue(p)) { top = Math.min(top, Y); bottom = Math.max(bottom, Y); if (Y < 250) blueAbove += 1; }
    }
    for (let Y = bottom + 20; Y < Math.min(c.height, 1580); Y += 3) for (let X = 0; X < c.width; X += 4) if (white(px(X, Y))) whiteBelow += 1;
    // the frame's dark band sits at the bottom of the framed picture
    const band = px(Math.round(c.width / 2), Math.round(bottom + (c.width === c.height ? -20 : 40)));
    return { w: c.width, h: c.height, top, bottom, whiteBelow, blueAbove, band };
  }, readFileSync(file).toString('base64'));

  const press = async (which) => {
    const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.locator(`.vp-big ${which} .vp-share`).click();
    const got = await dl;
    if (!got) return null;
    const to = join(repo, `${which.replace(/\W+/g, '-')}.jpg`);
    await got.saveAs(to);
    return { name: got.suggestedFilename(), file: to };
  };

  console.log('\nTHE SQUARE');
  const sq = await press('.vp-opt-square');
  check('it downloads', Boolean(sq), String(sq && sq.name));
  if (sq) {
    const m = await measure(sq.file);
    check('square, in the frame\'s shape', m.w === m.h, `${m.w}x${m.h}`);
  }
  await wait(2800);

  console.log('\nTHE STORY');
  const st = await press('.vp-opt-story');
  check('it downloads, named as a Story', Boolean(st) && /-story\.jpg$/.test(st.name), String(st && st.name));
  if (st) {
    const m = await measure(st.file);
    check('1080 x 1920', m.w === 1080 && m.h === 1920, `${m.w}x${m.h}`);
    check('the photograph sits below Instagram\'s top strip', m.top >= 250 && m.blueAbove === 0, `top ${m.top}`);
    check('and above its bottom strip', m.bottom > m.top && m.bottom <= 1580, `bottom ${m.bottom}`);
    check('framed — the venue\'s dark band is on it', m.band.every((v) => v < 90), JSON.stringify(m.band));
    check('words under it ("Every Thursday" and the name), inside the safe area', m.whiteBelow > 200, `${m.whiteBelow} white pixels`);
  }
  check('nothing threw', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await app.stop();
}
console.log(fails ? `\n${fails} FAILED — a save for Instagram is not what it says` : '\nThe square and the Story both save from the console, the Story in Instagram\'s shape.');
process.exit(fails ? 1 : 0);
