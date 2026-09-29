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


const { chromium } = playwright();

import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const KEY = 'phonecheck';
const PHONE = { width: 390, height: 844 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, stop, restart } = await startApp({ key: KEY });

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

  // ---- 1b. an answer the server TOOK, then lost to a crash
  /*
   * Answers are debounced to disk (rule 7), so a crash in the quarter-second
   * after one lands comes back without it. The phone had its 200, painted
   * "Locked in" and kept its pending choice — so it refused every tap for the
   * rest of the question, the `paintUnlocked()` fault with the POST having
   * SUCCEEDED (launch-path sweep, 23 September 2026). SIGKILL straight after
   * the answer's reply, then read the phone once it has reconnected.
   */
  console.log('\nAND WHEN THE SERVER RESTARTS UNDER AN ANSWER\n');
  const hostState = async () => (await fetch(`${BASE}/api/state?role=host`, { headers: { 'X-Host-Key': KEY } })).json();
  const lostPhone = await browser.newPage({ viewport: PHONE });
  lostPhone.on('pageerror', (e) => errors.push(String(e.message)));
  await lostPhone.goto(`${BASE}/play`, { waitUntil: 'load' });
  await lostPhone.waitForTimeout(1000);
  await lostPhone.fill('#nameInput', 'Les Quizerables');
  await lostPhone.click('#joinBtn');
  await lostPhone.waitForTimeout(1200);
  // A fresh question, with most of its twenty seconds still to run.
  const before = await hostState();
  await post('reveal', {});
  await post('next', {});
  let fresh = await hostState();
  for (let i = 0; i < 6 && !(fresh.phase === 'question' && fresh.questionIndex !== before.questionIndex); i += 1) {
    await post('next', {});
    fresh = await hostState();
  }
  check('a fresh question is up for the crash leg', fresh.phase, 'question');
  await lostPhone.waitForTimeout(1200);
  const [reply] = await Promise.all([
    lostPhone.waitForResponse((r) => r.url().includes('/api/answer')),
    lostPhone.locator('.answer-btn').first().click(),
  ]);
  check('the answer is taken', reply.status(), 200);
  const back = await restart({ hard: true });
  check('the server comes back', back, true);
  const afterCrash = await hostState();
  check('and the crash really did lose the answer (the case this leg is for)',
    afterCrash.phase === 'question' && (afterCrash.answeredCount || 0) === 0, true);
  // The stream has to notice it dropped and come back.
  await lostPhone.waitForFunction(() => {
    const live = [...document.querySelectorAll('.answer-btn')].filter((b) => !b.disabled).length;
    return live > 0;
  }, null, { timeout: 15000 }).catch(() => {});
  const lostAfter = await lostPhone.evaluate(() => ({
    live: [...document.querySelectorAll('.answer-btn')].filter((b) => !b.disabled).length,
    hint: document.getElementById('pHint')?.textContent || '',
  }));
  check('the buttons come back once the phone sees the server lost its answer', lostAfter.live > 0, true);
  check('and it no longer tells them they are locked in', /locked in/i.test(lostAfter.hint), false);
  await lostPhone.locator('.answer-btn').first().click({ timeout: 3000 }).catch(() => {});
  await lostPhone.waitForTimeout(1200);
  check('and a second tap lands on the restarted server', ((await hostState()).answeredCount || 0) >= 1, true);
  await lostPhone.close();

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
