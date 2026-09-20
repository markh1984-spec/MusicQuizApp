#!/usr/bin/env node
/**
 * TWO DEVICES, ONE QUIZ — does Next pressed on both move ONE question?
 *
 * The host drives the night from a phone and from the laptop with the HDMI
 * in it. `host.js` has a per-device double-tap guard; it cannot see the other
 * device, so Next on both within a second was two questions gone, one never
 * asked. `host-cursor.js` is the fix: every move carries the cursor it was
 * pressed against and the server refuses a move whose cursor has moved on,
 * with the fresh view in the refusal so the loser catches up.
 *
 * Two halves. Over HTTP: two Nexts with the same `seen` — exactly one lands,
 * the other is a 409 carrying the view, and a press with NO `seen` (every
 * older client, every guard) is not refused. In a real browser: two control
 * views on one room press the big button together, the question index moves
 * by one, and the losing screen shows "Already done" and repaints to the
 * winner's state.
 */

import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { hostCursor } from '../public/assets/host-cursor.js';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const KEY = 'twodevices';
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`); };

const { base: B, stop } = await startApp({ key: KEY });
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (route, opts = {}) => { const r = await fetch(B + route, opts); let body; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const hv = async () => (await J(`/api/state?role=host&key=${KEY}`)).body;

console.log('\nTWO DEVICES, ONE QUIZ\n');
let browser;
try {
  const go = await host('launch', { game: 'quiz', packId: '1980s-pop-music', replace: true });
  check('launched', go.status === 200, JSON.stringify(go.body).slice(0, 100));
  const code = (await hv()).joinCode || '';
  for (const name of ['Dave', 'Sue']) await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) });
  await host('start');
  let v = await hv();
  let guard = 0;
  while (v.phase !== 'question' && guard++ < 6) { await host('next'); v = await hv(); }
  check('a question is up', v.phase === 'question', v.phase);

  // ---- HTTP: the same cursor, twice, at once
  const seen = hostCursor(v);
  const [a, b] = await Promise.all([host('reveal', { seen }), host('reveal', { seen })]);
  const landed = [a, b].filter((r) => r.status === 200);
  const refused = [a, b].filter((r) => r.status === 409);
  check('two Reveals with one cursor: exactly one lands', landed.length === 1, `${a.status} ${b.status}`);
  check('…and the other is refused as stale, carrying the fresh view', refused.length === 1 && refused[0].body.stale === true && refused[0].body.view && refused[0].body.view.phase === 'reveal', JSON.stringify(refused[0] && refused[0].body).slice(0, 120));
  v = await hv();
  const before = v.questionIndex;
  const seen2 = hostCursor(v);
  const [c, d] = await Promise.all([host('next', { seen: seen2 }), host('next', { seen: seen2 })]);
  v = await hv();
  check('two Nexts with one cursor move ONE question', v.questionIndex === before + 1 && [c, d].filter((r) => r.status === 200).length === 1, `from ${before} to ${v.questionIndex}; ${c.status} ${d.status}`);
  // A press with no cursor at all is never refused — older clients, every guard.
  const e = await host('reveal', {});
  check('a press without a cursor is not refused', e.status === 200, `${e.status}`);
  // And a stale cursor on a non-move (a score nudge) is not refused either.
  const players = (await hv()).players || [];
  const f = await host('adjustScore', { seen: 'nonsense', playerId: players[0] && players[0].id, delta: 5 });
  check('a stale cursor on a non-move is ignored', f.status === 200, `${f.status} ${JSON.stringify(f.body).slice(0, 80)}`);
  // Answers move the version, not the cursor: a Next after answers still lands.
  v = await hv();
  check('answers do not move the cursor', hostCursor(v) === hostCursor(await hv()));

  // ---- the browser: two control views, one big button, pressed together
  browser = await chromium.launch();
  const ctx = await browser.newContext();
  const pages = await Promise.all([ctx.newPage(), ctx.newPage()]);
  for (const p of pages) { await p.setViewportSize({ width: 390, height: 844 }); await p.goto(`${B}/host?key=${KEY}`, { waitUntil: 'load' }); }
  // Get to the reveal, where the big button is "Next question" with no
  // too-soon guard in front of it.
  v = await hv();
  if (v.phase === 'question') { await host('reveal'); }
  await pages[0].waitForFunction(() => /Next question/.test(document.querySelector('button.primary')?.textContent || ''), null, { timeout: 8000 });
  await pages[1].waitForFunction(() => /Next question/.test(document.querySelector('button.primary')?.textContent || ''), null, { timeout: 8000 });
  const idx = (await hv()).questionIndex;
  // A DOM click on both at once — a pointer click waits and scrolls, which is
  // slower than the state push, and then the loser is stopped by the
  // client's own too-soon guard instead. Either way the night moves once.
  await Promise.all(pages.map((p) => p.evaluate(() => document.querySelector('button.primary').click())));
  await pages[0].waitForTimeout(600);
  const toasts = await Promise.all(pages.map((p) => p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent))));
  v = await hv();
  check('two screens pressing Next together move ONE question', v.questionIndex === idx + 1 && v.phase === 'question', `from ${idx} to ${v.questionIndex} (${v.phase})`);
  const told = toasts.flat().filter((t) => /Already done|Too soon/.test(t));
  check('the losing screen is told, not left thinking it pressed nothing', told.length === 1, JSON.stringify(toasts));
  await pages[0].waitForTimeout(600);
  const shown = await Promise.all(pages.map((p) => p.evaluate(() => (document.querySelector('button.primary') || {}).textContent || '')));
  check('both screens now show the same button', shown[0] === shown[1], JSON.stringify(shown));
} catch (err) {
  fails += 1;
  console.log('  FAIL threw:', err.stack || err);
} finally {
  if (browser) await browser.close();
  await stop();
}
if (fails) { console.log(`\n${fails} FAILED — two devices can still double-move the night.`); process.exit(1); }
console.log('\nTwo devices, one quiz: a press only ever lands once.');
