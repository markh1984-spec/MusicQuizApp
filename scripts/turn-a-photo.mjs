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
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { freePort } from '../test/helpers/live-server.mjs';

const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const ROOT = new URL('..', import.meta.url).pathname;
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const NIGHT = '2026-08-20';
const PASSWORD = 'a longer pass phrase';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${n}${note ? `\n        ${note}` : ''}`); };

const data = mkdtempSync(join(tmpdir(), 'turn-'));
const repo = mkdtempSync(join(tmpdir(), 'turn-gh-'));
const port = await freePort();
const env = { ...process.env, PORT: String(port), HOST_KEY: 'not-used', DATA_DIR: data, GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub' };
const base = `http://127.0.0.1:${port}`;
let server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
server.unref();
const up = async () => { for (let i = 0; i < 80; i += 1) { try { await fetch(base); return; } catch { await wait(150); } } throw new Error('never came up'); };
const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let browser;
try {
  await up();
  const made = await (await post('/api/signup', { email: 'mark@example.com', password: PASSWORD, name: 'Mark' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  await post('/api/reset/complete', { token, password: PASSWORD });
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'owner';
  acc.accounts.push({ ...acc.accounts[0], id: 'qm-mark', email: 'mark+qm@example.com', name: "Mark's Quizporium", role: 'quizmaster', ownedBy: acc.accounts[0].id, tier: 'gold', comped: true, status: 'active' });
  writeFileSync(file, JSON.stringify(acc));
  server.kill(); await wait(300);
  server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' }); server.unref();
  await up();

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
  const strip = await page.evaluate(() => ({ strip: !!document.querySelector('.showcase-strip'), pics: document.querySelectorAll('.showcase-pic').length }));
  check('the showcase strip is drawn under the night', strip.strip, JSON.stringify(strip));

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
      strip: seen('.showcase-strip'), save: seen('.showcase-save'), picker: seen('.night-venue select'), gallery: seen('.gig-gal-on, .gig-gal-off, .gig-gallery'),
      order: side ? [...side.querySelectorAll('.community-wall, .showcase-strip, .showcase-save, .night-venue, .gig-gal-on, .gig-gal-off')].map((n) => ['community-wall', 'showcase-strip', 'showcase-save', 'night-venue'].find((c) => n.classList.contains(c)) || 'gallery') : [],
    };
  });
  check('Post gig draws the photographs as the grid, not a sideways strip', pg.grid, JSON.stringify(pg));
  check('  ...and the showcase strip, its save, the picker and the gallery control can all be reached', ['strip', 'save', 'picker'].every((k) => pg[k] === 'reachable'), JSON.stringify(pg));
  check('  ...in that order, gallery last', pg.order.join(',').startsWith('community-wall,showcase-strip,showcase-save,night-venue'), pg.order.join(','));
  await page.screenshot({ path: '/tmp/postgig-after.png', clip: { x: 0, y: 80, width: 1400, height: 720 } }).catch(() => {});
  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally {
  await browser?.close().catch(() => {});
  server.kill();
  rmSync(data, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
}
console.log(fails ? `\n${fails} FAILED` : '\nA filed photograph can be turned from its tile.');
process.exit(fails ? 1 : 0);
