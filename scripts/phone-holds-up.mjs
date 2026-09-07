#!/usr/bin/env node
/**
 * WHAT A PHONE DOES WHEN SOMETHING GOES WRONG — driven on a real handset-sized
 * browser, with the failures made to happen.
 *
 * ---
 *
 * Both of these are on the protected surface and both are invisible to every
 * other check here, because both need a request to FAIL:
 *
 *  - **An answer that does not send left the phone disabled saying "Locked
 *    in."** One dropped POST on pub wifi cost that team the whole question —
 *    and told them they had answered it, so they did not even know to try
 *    again. The comment in the catch claimed the buttons came back on the next
 *    update; nothing did that. Bingo's `toggle()` reverts its optimistic paint
 *    correctly; the quiz path was the outlier.
 *  - **Reopening a phone while the join gate is holding wrote `{waiting:true}`
 *    over its stored id, token and team name**, then opened a stream on an id
 *    the server had never issued. `showJoin()` and `silentRejoin()` both check
 *    the 202; `boot()` was the one that did not — so the phone came back to a
 *    bare join box with the name gone and nothing saying why, which reads as
 *    being thrown out and is what rule 5 exists to prevent.
 *
 *   node scripts/phone-holds-up.mjs
 *
 * Its own port, its own DATA_DIR, both cleaned up on the way out.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

import { startApp } from './helpers/live-app.mjs';

const KEY = 'phonecheck';
const PHONE = { width: 390, height: 844 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, stop } = await startApp({ key: KEY });

let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${want}\n        got    ${got}`);
};

let browser;
try {
  const post = (action, body) => fetch(`${BASE}/api/host/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify(body || {}),
  }).then((r) => r.json().then((json) => ({ status: r.status, json })));

  const library = await (await fetch(`${BASE}/api/library`, {
    headers: { 'X-Host-Key': KEY },
  })).json();
  const pack = (library.quizzes || [])[0];
  await post('launch', { game: 'quiz', packId: pack.id });

  browser = await chromium.launch();

  console.log('\nA PHONE WHEN THE REQUEST DOES NOT LAND\n');

  // ---- 1. an answer that fails to send
  const page = await browser.newPage({ viewport: PHONE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`${BASE}/play`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.fill('#nameInput', 'Quizteam Aguilera');
  await page.click('#joinBtn');
  await page.waitForTimeout(1200);

  await post('start', {});
  for (let i = 0; i < 8; i += 1) {
    const state = await (await fetch(`${BASE}/api/state?role=screen`)).json();
    if (state.phase === 'question') break;
    await post('next', {});
    await wait(120);
  }
  await page.waitForTimeout(1200);
  const buttons = await page.locator('.answer-btn').count();
  check('the options are on the phone', buttons > 0, true);

  // Pub wifi: the request leaves and nothing comes back.
  await page.route('**/api/answer', (route) => route.abort());
  await page.locator('.answer-btn').first().click();
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => ({
    live: [...document.querySelectorAll('.answer-btn')].filter((b) => !b.disabled).length,
    hint: document.getElementById('pHint')?.textContent || '',
  }));
  check('the buttons come back live', after.live > 0, true);
  check('and the phone does not claim they answered',
    /locked in/i.test(after.hint), false);
  check('it says what happened instead', after.hint.length > 0, true);

  // And with the network back, the answer still goes.
  await page.unroute('**/api/answer');
  await page.locator('.answer-btn').first().click();
  await page.waitForTimeout(1200);
  const landed = await page.evaluate(() =>
    /locked in/i.test(document.getElementById('pHint')?.textContent || ''));
  check('and a retry lands', landed, true);
  await page.close();

  // ---- 2. reopening a phone while the door is held
  console.log('\nAND WHEN THE DOOR IS HELD\n');
  /*
   * Trip the gate. `BURST` is 120 new joins inside a ten-second window — a
   * dozen a SECOND, which is what CLAUDE.md's "the threshold is twelve" means
   * — so these go out together. Awaited one at a time they arrive slowly
   * enough to be a room, which is exactly the judgement `src/joins.js` is
   * making, and exactly why a sequential loop of twenty reported the gate open
   * and skipped the rest of this while printing green.
   */
  await Promise.all(Array.from({ length: 150 }, (_, i) => fetch(`${BASE}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Flood ${i}`, tryId: `flood-${i}` }),
  })));
  const held = await (await fetch(`${BASE}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'One more', tryId: 'one-more' }),
  })).json();
  check('the join gate is holding', Boolean(held.waiting), true);

  const phone = await browser.newPage({ viewport: PHONE });
  phone.on('pageerror', (e) => errors.push(String(e.message)));
  // A phone that already has a name but whose token the server has forgotten —
  // a redeploy, or one that joined before tokens existed. A phone that CAN
  // prove who it is is never held, which is rule 4 and is why this is the case
  // that bites.
  await phone.addInitScript(() => {
    localStorage.setItem('musicquiz.player', JSON.stringify({
      id: 'p_forgotten_phone', token: 'gone', name: 'Quizteam Aguilera',
    }));
  });
  await phone.goto(`${BASE}/play`, { waitUntil: 'load' });
  await phone.waitForTimeout(1500);

  const state = await phone.evaluate(() => {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('musicquiz.player') || 'null'); } catch { /* gone */ }
    return {
      body: (document.getElementById('body')?.innerText || document.body.innerText || '')
        .replace(/\s+/g, ' ').trim(),
      name: stored && stored.name,
      waitingSaved: Boolean(stored && stored.waiting),
    };
  });
  check('the phone is told to wait rather than shown a join box',
    /just a moment/i.test(state.body), true);
  check('its team name survives', state.name, 'Quizteam Aguilera');
  check('and the held reply was not saved over it', state.waitingSaved, false);

  check('nothing threw', errors.join(' | ') || 'none', 'none');

  console.log(failures
    ? `\n${failures} failed — a phone is lying to somebody in a pub.\n`
    : '\nA phone holds up when the request does not.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* already gone */ }
  stop();
}
