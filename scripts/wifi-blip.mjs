#!/usr/bin/env node
/**
 * THE WIFI DROPS FOR EIGHT SECONDS. DOES EVERYTHING COME BACK RIGHT?
 *
 * Pub wifi is the one thing on a gig night nobody controls. A phone, the
 * projector and the host's own control view each lose the network for a few
 * seconds at the worst moment — mid-question, across the reveal, across a
 * Next — and the rule is that when they come back they show EXACTLY what a
 * device that never dropped shows: same question, same buttons, same big
 * button, no "you were removed", no answer counted twice, no answer lost.
 *
 * So every blipped device has a TWIN that stayed online, and the check is
 * that the two agree afterwards. Nothing here knows what a screen should
 * say; it knows two screens must say the same thing.
 *
 * Driven with Playwright's `setOffline`, which kills the stream and every
 * request, exactly as a router does. Four blips:
 *
 *   1. a phone, mid-question — it comes back on the same question and can
 *      answer, and the answer counts once;
 *   2. the projector, across the reveal — it comes back showing the reveal;
 *   3. the control view, across a Next pressed elsewhere — it comes back on
 *      the new question with the right big button;
 *   4. a phone, across a whole question and its reveal — it comes back on the
 *      NEXT question with fresh buttons, and is never told it was removed.
 */

import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const KEY = 'wifiblip';
const BLIP_MS = 8000;
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: B, stop } = await startApp({ key: KEY });
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (route, opts = {}) => { const r = await fetch(B + route, opts); let body; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const hv = async () => (await J(`/api/state?role=host&key=${KEY}`)).body;

console.log('\nTHE WIFI DROPS — a phone, the projector, the control view\n');
let browser;
try {
  const go = await host('launch', { game: 'quiz', packId: '1980s-pop-music', questionSeconds: 30, replace: true });
  check('launched', go.status === 200, JSON.stringify(go.body).slice(0, 100));

  browser = await chromium.launch();
  // One context per device, so each can lose the network on its own.
  const device = async (url, { width = 390, height = 844 } = {}) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: 'load' });
    return { ctx, page };
  };
  const join = async (page, name) => { await page.fill('#nameInput', name); await page.click('#joinBtn'); await page.waitForTimeout(400); };

  const phoneA = await device(`${B}/play`); await join(phoneA.page, 'Blip');
  const phoneB = await device(`${B}/play`); await join(phoneB.page, 'Long blip');
  const phoneRef = await device(`${B}/play`); await join(phoneRef.page, 'Steady');
  const screen = await device(`${B}/screen`, { width: 1280, height: 720 });
  const screenRef = await device(`${B}/screen`, { width: 1280, height: 720 });
  const control = await device(`${B}/host?key=${KEY}`);
  const controlRef = await device(`${B}/host?key=${KEY}`);
  check('three phones joined', ((await hv()).players || []).length === 3, JSON.stringify(((await hv()).players || []).map((p) => p.name)));

  await host('start');
  let v = await hv();
  let guard = 0;
  while (v.phase !== 'question' && guard++ < 6) { await host('next'); v = await hv(); }
  check('a question is up', v.phase === 'question', v.phase);
  await phoneA.page.waitForSelector('.answer-btn', { timeout: 8000 });
  const buttonsOn = (page) => page.evaluate(() => [...document.querySelectorAll('.answer-btn')].filter((b) => !b.disabled).length);

  // ---- 1. a phone, mid-question
  await phoneA.ctx.setOffline(true);
  await wait(BLIP_MS);
  await phoneA.ctx.setOffline(false);
  await wait(3500);   // EventSource retries every 2s
  check('phone back on the same question, with the same live buttons as the steady phone', await buttonsOn(phoneA.page) === await buttonsOn(phoneRef.page) && await buttonsOn(phoneA.page) > 0, `${await buttonsOn(phoneA.page)} vs ${await buttonsOn(phoneRef.page)}`);
  await phoneA.page.locator('.answer-btn').first().click();
  await wait(600);
  v = await hv();
  check('…and its answer counted once', v.answeredCount === 1, `answeredCount ${v.answeredCount}`);
  check('the phone was never told it was removed', !(await phoneA.page.evaluate(() => document.body.innerText.includes('removed'))));

  // ---- 2. the projector, across the reveal
  await screen.ctx.setOffline(true);
  await host('reveal');
  await wait(BLIP_MS);
  await screen.ctx.setOffline(false);
  await wait(3500);
  const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
  check('projector back showing the reveal, identical to the projector that never dropped', await text(screen.page) === await text(screenRef.page) && (await hv()).phase === 'reveal', `phase ${(await hv()).phase}`);

  // ---- 3. the control view, across a Next pressed on another device
  await control.ctx.setOffline(true);
  await host('next');
  await wait(BLIP_MS);
  await control.ctx.setOffline(false);
  await wait(3500);
  const primary = (page) => page.evaluate(() => (document.querySelector('button.primary') || {}).textContent || '');
  check('control view back on the new question, same big button as the one that never dropped', await primary(control.page) === await primary(controlRef.page) && /Reveal/.test(await primary(control.page)), `${await primary(control.page)} vs ${await primary(controlRef.page)}`);

  // ---- 4. a phone, across a whole question and its reveal
  await phoneB.ctx.setOffline(true);
  await host('reveal');
  await wait(1500);
  await host('next');
  await wait(BLIP_MS - 1500);
  await phoneB.ctx.setOffline(false);
  await wait(3500);
  await phoneRef.page.waitForSelector('.answer-btn', { timeout: 8000 });
  check('long-blip phone back on the NEXT question with fresh buttons, like the steady phone', await buttonsOn(phoneB.page) === await buttonsOn(phoneRef.page) && await buttonsOn(phoneB.page) > 0, `${await buttonsOn(phoneB.page)} vs ${await buttonsOn(phoneRef.page)}`);
  check('…and never told it was removed', !(await phoneB.page.evaluate(() => document.body.innerText.includes('removed'))));
  await phoneB.page.locator('.answer-btn').first().click();
  await wait(600);
  check('…and it can answer', ((await hv()).answeredCount || 0) >= 1, `answeredCount ${(await hv()).answeredCount}`);

  // The room is intact: three phones, nobody duplicated, nobody dropped.
  v = await hv();
  check('still three phones, none duplicated', (v.players || []).length === 3, JSON.stringify((v.players || []).map((p) => p.name)));
  for (const d of [phoneA, phoneB, phoneRef, screen, screenRef, control, controlRef]) await d.ctx.close();
} catch (err) {
  fails += 1;
  console.log('  FAIL threw:', err.stack || err);
} finally {
  if (browser) await browser.close();
  await stop();
}
if (fails) { console.log(`\n${fails} FAILED — a wifi blip leaves a screen wrong.`); process.exit(1); }
console.log('\nThe wifi dropped on every screen in turn, and every one came back right.');
