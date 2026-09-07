#!/usr/bin/env node
/**
 * WHAT THE LAUNCH BAR SAYS IS WHAT THE ROOM GETS.
 *
 * ---
 *
 * *"THE CONSOLE AND THE BIG SCREEN MUST AGREE, ALWAYS."* That is the launch
 * bar's own rule and this repo keeps breaking it in the same way: a control
 * shows a value, the value is never written anywhere, and the launch sends
 * something else. Nothing throws, the console agrees with itself, and the
 * disagreement is only visible in the room.
 *
 * Three sightings before this script existed:
 *
 *  - **`lobbyGame` was missing from the quiet launch.** Reported twice as
 *    *"still only allowing maze mouth"*, both times on a night nobody had
 *    pressed Launch on.
 *  - **The quiet launch then turned out to send FIVE of twelve fields**, so a
 *    tapped-up night ran on the default look with the game sound off ignored.
 *  - **The Card picker's DEFAULT was never written back.** The bar read
 *    *"5x5 — 25 of 40 songs on a card"*, the tile said 5x5, and the launch
 *    sent `shape: null`: the room got a 4x4 running five prize stops. Choosing
 *    a shape by hand worked, so only the default was lost — which is every
 *    bingo night nobody opens the picker on.
 *
 * **`pub-unchanged.mjs` cannot see any of it.** It reads `quizzes/` and never
 * loads a bingo pack, and it compares the engine's payloads rather than what
 * the CONSOLE asked for. The only thing that can is reading the request body
 * out of a real browser and then asking the room — which is the rule `winners`
 * taught and what this does.
 *
 *   node scripts/bar-reaches-the-room.mjs
 *
 * Its own port, its own DATA_DIR, both cleaned up on the way out.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

import { startApp } from './helpers/live-app.mjs';

const KEY = 'barvsroom';
const { base: BASE, stop } = await startApp({ key: KEY });

let failures = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${JSON.stringify(want)}\n        got    ${JSON.stringify(got)}`);
};

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));

  /** Every launch body the page sends, so the request can be read off the wire. */
  const bodies = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/host\/launch/.test(r.url())) bodies.push(r.postData() || '');
  });

  await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('\nWHAT THE BAR SAYS, WHAT IT SENDS, WHAT THE ROOM GETS\n');

  /*
   * A BINGO PACK, WITH NOBODY TOUCHING THE PICKERS — which is the case the
   * default was lost in, and the ordinary way a bingo night is set up.
   */
  await page.evaluate(() => document.querySelector('button.tab[data-tab="bingo"]')?.click());
  await page.waitForSelector('.pack-card[data-pack]');
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('.pack-card[data-pack]')?.click());
  await page.waitForTimeout(1400);

  const face = await page.evaluate(() => {
    const shape = document.querySelector('.shape-pick');
    const prizes = document.querySelector('.prize-pick');
    return {
      shape: shape && shape.value ? JSON.parse(shape.value) : null,
      prizes: prizes ? Number(prizes.value) : null,
    };
  });
  check('the bar names a card', Boolean(face.shape && face.shape.rows), true);

  bodies.length = 0;
  await page.evaluate(() => {
    const go = [...document.querySelectorAll('button')].find((b) => /^Launch/.test(b.textContent.trim()));
    if (go) go.click();
  });
  await page.waitForTimeout(1800);
  check('and Launch sent something', bodies.length > 0, true);

  const sent = bodies.length ? JSON.parse(bodies[bodies.length - 1]) : {};
  check('the card it SENT is the card it SHOWED', sent.shape, face.shape);
  check('and so is the prize count', sent.prizes, face.prizes);

  const room = await (await fetch(`${BASE}/api/state?role=screen`)).json();
  check('and the ROOM got that card', { rows: room.cardRows, cols: room.cardCols },
    { rows: face.shape && face.shape.rows, cols: face.shape && face.shape.cols });

  check('nothing threw', errors.join(' | ') || 'none', 'none');

  console.log(failures
    ? `\n${failures} failed — the console and the room disagree.\n`
    : '\nThe bar, the wire and the room all say the same thing.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* already gone */ }
  stop();
}
