#!/usr/bin/env node
/**
 * CAN A FILED PHOTOGRAPH BE TURNED, FROM THE TILE? The bottom-left corner on
 * Community > Photos: the browser turns it on a canvas, PUTs the bytes over
 * the same name in the private repo, and re-points its own thumbnail. Driven
 * against the photo-repo stub with a REAL JPEG (Playwright draws one), because
 * a canvas cannot turn 64 bytes of ones.
 *
 *   node scripts/turn-a-photo.mjs
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const ROOT = new URL('..', import.meta.url).pathname;
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const NIGHT = '2026-08-20';
const PASSWORD = 'a longer pass phrase';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${n}${note ? `\n        ${note}` : ''}`); };

const repo = mkdtempSync(join(tmpdir(), 'turn-gh-'));
/*
 * ONE SPAWN FOR EVERY SPAWNER — `startApp()` in `scripts/helpers/live-app.mjs`:
 * it waits for its OWN server by pid, runs it on a COPY of the catalogue, and
 * its restart waits for the old server to be gone before binding the port
 * again. This script used to take a port on trust and restart with a kill and
 * a sleep.
 */
const app = await startApp({
  key: 'not-used',
  nodeArgs: ['--import', STUB],
  env: {
    GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub',
  },
});
const { base, data } = app;
const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let browser;
try {
  const made = await (await post('/api/signup', { email: 'mark@example.com', password: PASSWORD, name: 'Mark' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  await post('/api/reset/complete', { token, password: PASSWORD });
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'owner';
  acc.accounts.push({ ...acc.accounts[0], id: 'qm-mark', email: 'mark+qm@example.com', name: "Mark's Quizporium", role: 'quizmaster', ownedBy: acc.accounts[0].id, tier: 'gold', comped: true, status: 'active' });
  writeFileSync(file, JSON.stringify(acc));
  if (!await app.restart({ hard: false })) throw new Error('the server did not come back');

  const arc = join(data, 'rooms', 'qm-mark', 'archive'); mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({ id: 'n1', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties', archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: 'The Station Tap, Wokingham', leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }] }));
  const dir = join(repo, 'photos', 'qm-mark', NIGHT); mkdirSync(dir, { recursive: true });

  browser = await chromium.launch();
  // A REAL, LANDSCAPE JPEG: 300 wide, 200 tall, so a quarter turn is measurable.
  const painter = await browser.newPage({ viewport: { width: 300, height: 200 } });
  await painter.setContent('<body style="margin:0;background:linear-gradient(90deg,#c2427a,#f4a261)"></body>');
  writeFileSync(join(dir, 'p1.jpg'), await painter.screenshot({ type: 'jpeg', quality: 80 }));
  await painter.close();

  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const puts = []; page.on('response', (r) => { if (r.request().method() === 'PUT' && /\/api\/past-photo\//.test(r.url())) puts.push(r.status()); });
  await page.goto(`${base}/login`); await page.fill('input[type=email]', 'mark+qm@example.com'); await page.fill('input[type=password]', PASSWORD);
  await page.evaluate(() => document.querySelector('form')?.requestSubmit()); await page.waitForTimeout(1500);
  await page.goto(`${base}/console?door=community`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="photos"]')?.click()); await page.waitForTimeout(2500);
  // Open the night from the rail.
  const seen = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('button.tab')].map((b) => b.dataset.tab + (b.classList.contains('on') ? '*' : '')), door: new URL(location.href).searchParams.get('door'), tab: document.querySelector('button.tab.on')?.textContent.trim(), rail: [...document.querySelectorAll('.bay-rail .bay-pick')].map((b) => b.textContent.trim().slice(0, 30)), head: (document.querySelector('.doorhead')?.textContent || '').replace(/\s+/g, ' ').slice(0, 160) }));
  console.log('page:', JSON.stringify(seen));
  // THE NIGHT'S ROW, not "The wall" above it — the wall's tiles carry no corner controls.
  // The pub folds; open it, then its one night.
  await page.locator('.bay-rail .bay-rail-group', { hasText: /Station Tap/ }).first().click(); await page.waitForTimeout(600);
  await page.locator('.bay-rail .bay-pick', { hasText: /Aug/ }).first().click(); await page.waitForTimeout(2500);
  const before = await page.evaluate(() => { const i = document.querySelector('.doorhead .cphoto img'); return i ? { w: i.naturalWidth, h: i.naturalHeight, rot: !!document.querySelector('.doorhead .cphoto-rot') } : null; });
  check('the night opens with the photograph, landscape', before && before.w === 300 && before.h === 200, JSON.stringify(before));
  check('the tile has the turn button in its bottom-left', before && before.rot);

  await page.evaluate(() => document.querySelector('.doorhead .cphoto-rot').click());
  for (let i = 0; i < 40 && !puts.length; i += 1) await wait(250);
  await page.waitForTimeout(800);
  check('pressing it wrote the turned photograph over its name', puts[0] === 200, `PUT answered ${puts[0]}`);
  const after = await page.evaluate(async () => {
    const i = document.querySelector('.doorhead .cphoto img');
    await new Promise((r) => { if (i.complete) r(); else i.onload = r; });
    return { w: i.naturalWidth, h: i.naturalHeight, opened: document.querySelectorAll('.doorhead .community-big').length };
  });
  check('  ...and the tile shows it turned — portrait now', after.w === 200 && after.h === 300, JSON.stringify(after));
  check('  ...without opening the picture', after.opened === 0);
  const fresh = await (await fetch(`${base}/past-photo/${NIGHT}/p1.jpg`, { headers: { Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ') } })).arrayBuffer();
  check('  ...and a fresh read serves the turned bytes', fresh.byteLength !== readFileSync(join(dir, 'p1.jpg')).length ? false : true, `${fresh.byteLength} bytes`);
  /*
   * THE SHOWCASE IS THE GRID'S OWN BAND NOW, not a second framed strip below.
   * Two displays of one thing disagreed — the band draws what is STARRED and
   * the strip drew `cover`, which fans out to three whatever you starred.
   */
  const show = await page.evaluate(() => ({
    bands: [...document.querySelectorAll('.doorhead .cphoto-group')].map((h) => h.textContent.trim()),
    strip: document.querySelectorAll('.showcase-strip').length,
  }));
  check('the showcase is a band in the grid, and there is no second strip', show.strip === 0, JSON.stringify(show));

  // AND ON POST GIG: the grid, the showcase, the picker, the gallery — all
  // reachable inside the capped bay, which clipped everything past the
  // photographs until 18 September 2026.
  await page.goto(`${base}/console?door=post`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  // Open the pub's group only if its night is not already showing — a press
  // on an open heading FOLDS it (what is remembered wins).
  if (!(await page.locator('.bay-rail .bay-pick', { hasText: /Aug/ }).count())) {
    await page.locator('.bay-rail .bay-rail-group', { hasText: /Station Tap/ }).first().click(); await page.waitForTimeout(600);
  }
  const rows = await page.evaluate(() => [...document.querySelectorAll('.bay-rail .bay-pick, .bay-rail .bay-rail-group')].map((b) => b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)));
  console.log('post gig rail:', JSON.stringify(rows));
  await page.locator('.bay-rail .bay-pick', { hasText: /Aug/ }).first().click(); await page.waitForTimeout(3000);
  const pg = await page.evaluate(() => {
    const side = document.querySelector('.bench-detail');
    const seen = (sel) => {
      const el = side && side.querySelector(sel);
      if (!el) return 'missing';
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && (el === hit || el.contains(hit)) ? 'reachable' : 'covered';
    };
    return {
      grid: side ? Boolean(side.querySelector('.community-wall')) : false,
      sweep: seen('.photo-sweep'), save: seen('.showcase-save'), picker: seen('.night-venue select'), gallery: seen('.gig-gal-on, .gig-gal-off, .gig-gallery'),
      /* HOW FAR DOWN THE PUBLISH CONTROL IS — reachable and findable are two
         questions, and *"looks like I lose the ability to publish"* is the
         second one being answered no. */
      galleryDown: (() => {
        const g = side && side.querySelector('.gig-gal-on, .gig-gal-off, .gig-gallery');
        if (!g || !side) return -1;
        return Math.round((g.getBoundingClientRect().top - side.getBoundingClientRect().top) + side.scrollTop);
      })(),
      boxHigh: side ? Math.round(side.clientHeight) : 0,
      order: side ? [...side.querySelectorAll('.community-wall, .photo-sweep, .showcase-save, .night-venue, .gig-gal-on, .gig-gal-off')].map((n) => ['community-wall', 'photo-sweep', 'showcase-save', 'night-venue'].find((c) => n.classList.contains(c)) || 'gallery') : [],
    };
  });
  check('Post gig draws the photographs as the grid, not a sideways strip', pg.grid, JSON.stringify(pg));
  /*
   * THE GALLERY CONTROL IS IN THE ASSERTION NOW, NOT ONLY IN THE SENTENCE.
   * This line named it and then checked `['sweep','save','picker']` — the
   * comment-that-claims-the-opposite fault, inside a guard. Reported as *"looks
   * like I lose the ability to publish or unpublish the night itself?"*, which
   * is exactly the question this was pretending to answer.
   */
  check('  ...and the sweep, the showcase save, the picker and the gallery control can all be reached',
    ['sweep', 'save', 'picker', 'gallery'].every((k) => pg[k] === 'reachable'), JSON.stringify(pg));
  check('  ...in that order, publishing right under the photographs',
    pg.order.join(',').startsWith('community-wall,photo-sweep,gallery,showcase-save,night-venue'), pg.order.join(','));
  /*
   * AND IT IS FINDABLE, NOT MERELY REACHABLE. `seen()` scrolls before it asks,
   * so it called a control 656px down a 289px box fine — which is exactly the
   * screen that got reported as having lost its publish button. One box-height
   * of scrolling is the line: past that it is somewhere you go looking.
   */
  check('  ...and publishing is within a screen of the photographs',
    pg.galleryDown >= 0 && pg.galleryDown <= pg.boxHigh,
    `${pg.galleryDown}px down a ${pg.boxHigh}px box`);
  console.log('publish control sits', pg.galleryDown, 'px down a', pg.boxHigh, 'px box');
  const shots = process.env.SHOT_DIR || '/tmp';
  await page.locator('.doorhead .panel.bench').first().screenshot({ path: `${shots}/postgig-top.png` }).catch(() => {});
  await page.evaluate(() => { const s2 = document.querySelector('.bench-detail'); if (s2) s2.scrollTop = s2.scrollHeight; });
  await page.waitForTimeout(400);
  await page.locator('.doorhead .panel.bench').first().screenshot({ path: `${shots}/postgig-bottom.png` }).catch(() => {});
  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally {
  await browser?.close().catch(() => {});
  /*
   * GONE, THEN DELETED — `stopAndWait()` is `startApp()`'s.
   * `kill()` sends a signal and waits for nothing, so deleting the data
   * directory on the next line races a server still flushing `state.json`
   * into it: ENOTEMPTY out of this `finally`, every assertion already
   * passed, naming a feature that works.
   */
  await app.stopAndWait();
  rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
console.log(fails ? `\n${fails} FAILED` : '\nA filed photograph can be turned from its tile.');
process.exit(fails ? 1 : 0);
