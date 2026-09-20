#!/usr/bin/env node
/**
 * CAN POST GIG SAY WHERE A NIGHT WAS? The picker under the photographs and
 * the rail that regroups — reported off a night run on KaraFun whose 112
 * photographs sat under "No venue on these" with nothing on that door to
 * move them. node scripts/post-gig-venue.mjs
 */
const { chromium } = playwright();
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const KEY = 'pgv';
const { base: B, stop } = await startApp({ key: KEY });
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (r, o = {}) => { const x = await fetch(B + r, o); let b; try { b = await x.json(); } catch { b = null; } return { status: x.status, body: b }; };
let fails = 0; const check = (n, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${n}${note ? `\n        ${note}` : ''}`); };
let browser;
try {
  // A venue in the book, and a night filed with NO venue: launch with none and run it to the final.
  const mk = await J('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Station Tap, Wokingham' }) });
  const venue = (mk.body.customers || [])[0];
  const lib = (await J('/api/library', { headers: H })).body;
  const pack = lib.quizzes.find((q) => (q.rounds || []).length === 1) || lib.quizzes[0];
  await J('/api/host/launch', { method: 'POST', headers: H, body: JSON.stringify({ game: 'quiz', packId: pack.id, replace: true, venue: '', breakPlan: {} }) });
  const code = (await J('/api/library', { headers: H })).body.running.joinCode;
  await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Dave', joinCode: code }) });
  for (let i = 0; i < 400; i += 1) {
    const s = (await J('/api/state?role=screen&key=' + KEY)).body;
    if (s.phase === 'final') break;
    await J('/api/host/next', { method: 'POST', headers: H, body: '{}' });
  }
  const gigs = (await J('/api/past-gigs', { headers: H })).body;
  const night = (gigs.nights || [])[0];
  check('a night is filed with no venue on it', night && !night.venue, JSON.stringify(night && { night: night.night, venue: night.venue }));

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${B}/console?key=${KEY}&door=post`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  const rail = await page.evaluate(() => [...document.querySelectorAll('.bay-rail .bay-rail-what')].map((h) => h.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)));
  check('the rail groups it under "No venue on these"', rail.some((t) => /No venue on these/.test(t)), JSON.stringify(rail));
  await page.locator('.bay-rail .bay-pick').first().click(); await page.waitForTimeout(2500);
  const picker = await page.evaluate(() => {
    const p = document.querySelector('.bench-detail .night-venue select');
    return p ? { opts: [...p.options].map((o) => o.textContent), label: document.querySelector('.bench-detail .night-venue label')?.textContent } : null;
  });
  check('the picker is under the photographs on Post gig', !!picker, JSON.stringify(picker));
  check('  ...offering the pub from the book', picker && picker.opts.some((o) => /Station Tap/.test(o)), JSON.stringify(picker && picker.opts));
  // The pub has no heading yet (only pubs with filed nights are drawn), so first file it by picker,
  // then reload and check the rail, then drag a SECOND venue-less night onto that heading.
  await page.evaluate((id) => { const p = document.querySelector('.bench-detail .night-venue select'); p.value = id; p.dispatchEvent(new Event('change', { bubbles: true })); }, venue.id);
  await page.waitForTimeout(2000);
  const after = (await J('/api/past-gigs', { headers: H })).body;
  const filed = (after.nights || []).find((n) => n.night === night.night);
  check('choosing the pub files the night under it', filed && filed.venue === 'The Station Tap, Wokingham', JSON.stringify(filed && { venue: filed.venue, venueId: filed.venueId }));
  const rail2 = await page.evaluate(() => [...document.querySelectorAll('.bay-rail .bay-rail-what')].map((h) => h.textContent.trim()));
  check('  ...and the rail regroups it under the pub without a reload', rail2.some((t) => /Station Tap/.test(t)) && !rail2.some((t) => /No venue/.test(t)), JSON.stringify(rail2));
  const bench = await page.$('.bench-detail');
  if (bench) { const box = await bench.boundingBox(); await page.screenshot({ path: '/tmp/postgig-picker.png', clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(1400, box.width + 16), height: Math.min(1000, box.height + 16) } }); }
  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally { await browser?.close(); stop(); }
console.log(fails ? `\n${fails} FAILED` : '\nPost gig can say where a night was.');
