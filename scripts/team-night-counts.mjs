#!/usr/bin/env node
/**
 * ON A TEAM NIGHT THE CONTROL VIEW COUNTS PHONES WHERE IT SAYS PHONES.
 *
 * ---
 *
 * A team night is one entity per BOARD ROW everywhere (`boardIdFor()`), so
 * `playerCount` is rows and `phoneCount` is handsets — two numbers the moment
 * anybody shares a table. The projector's "N of M answered" was taught the
 * difference; the control view's own status line was not (launch-path sweep,
 * 23 September 2026): five phones dealt into two teams read *"2 playing"* to
 * the host, and the breakout panel counted its typed answers against the
 * rows rather than the phones that type them.
 *
 * So this launches a team night dealt at random, joins five phones over HTTP,
 * opens the control view in a real browser and reads the line.
 *
 *   node scripts/team-night-counts.mjs
 */
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

const KEY = 'team-counts';
const { base: B, stop } = await startApp({ key: KEY });
let fails = 0;
const check = (name, ok, got = '') => {
  if (!ok) fails += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !got ? '' : ` — ${got}`}`);
};
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (route, opts = {}) => {
  const r = await fetch(B + route, opts);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const hostView = async () => (await J('/api/state?role=host', { headers: H })).body;

let browser;
try {
  console.log('\nDOES THE CONTROL VIEW COUNT PHONES ON A TEAM NIGHT?\n');
  const lib = (await J('/api/library', { headers: H })).body;
  const pack = (lib.quizzes || []).find((q) => (q.rounds || []).length > 1);
  const go = await host('launch', { game: 'quiz', packId: pack.id, teamPlay: true, teamMode: 'random', venue: 'The Crown', replace: true });
  check('a team night dealt at random launches', go.status === 200, JSON.stringify(go.body).slice(0, 120));

  const names = ['Ann', 'Bob', 'Cat', 'Dan', 'Eve'];
  const phones = [];
  for (const name of names) {
    const r = await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    phones.push(r.body);
  }
  check('five phones join', phones.every((p) => p && p.id), phones.map((p) => p && p.id).join(','));
  const v = await hostView();
  check('and are dealt into fewer teams than phones', v.playerCount < 5 && v.phoneCount === 5,
    `playerCount ${v.playerCount}, phoneCount ${v.phoneCount}`);

  browser = await chromium.launch();
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const boom = [];
  desk.on('pageerror', (e) => boom.push(String(e.message)));
  await desk.goto(`${B}/host?key=${KEY}`, { waitUntil: 'load' });
  await desk.waitForTimeout(1200);
  const line = ((await desk.locator('#connText').textContent().catch(() => '')) || '').trim();
  check('the status line says five are playing, not the number of teams', /\b5 playing\b/.test(line), line);
  check('nothing threw', boom.length === 0, boom.join(' | '));
} finally {
  if (browser) await browser.close().catch(() => {});
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the control view counts rows where it says phones.` : '\nThe control view counts phones.');
process.exit(fails ? 1 : 0);
