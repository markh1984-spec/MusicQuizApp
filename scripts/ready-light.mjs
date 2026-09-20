#!/usr/bin/env node
/**
 * DOES THE READY LINE ACTUALLY GO GREEN?
 *
 * `console-ready.js` polls `/api/host/ready` and paints one line on the
 * launch bar. Its first build never polled at all: the first tick ran before
 * the caller had attached the node, saw it detached, and cleared its own
 * interval — so the light sat on "checking the server…" for ever, with every
 * unit test green and the route answering perfectly when asked directly.
 * Found by the screenshot. *A test that the payload is right proves nothing
 * about whether anybody drew it*, for the sixth time in this repo.
 *
 * So this opens the real console in a real browser, watches the line say NOT
 * ready with no projector open, opens the projector on the room's own code,
 * and waits for the words "Ready for tonight" in green. Then it closes the
 * projector and waits for the line to go back — a light that only ever goes
 * on is a light that lies the second time.
 */

import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
/*
 * THE APP'S OWN IDEA OF WHICH NIGHT IT IS, never the calendar's — see below.
 */
import { nightKey, weekdayOf } from '../public/assets/diary.js';

const { chromium } = playwright();

const EMAIL = 'qm@example.com';
const PASSWORD = 'quizmaster passphrase';
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`); };

const { base: BASE, stop } = await startApp({
  key: 'readylight',
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: EMAIL, password: PASSWORD, name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

console.log('\nTHE READY LINE — does it go green, and back?\n');
let browser;
try {
  const signIn = await fetch(`${BASE}/api/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const [cookieName, cookieValue] = cookie.split('=');
  const H = { 'content-type': 'application/json', cookie };
  const mk = await (await fetch(`${BASE}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Crown' }) })).json();
  const venue = (mk.customers || []).find((c) => c.name === 'The Crown');
  /*
   * THE DAY ROLLS AT 6am, AND THIS GUARD USED THE CALENDAR'S MIDNIGHT.
   *
   * `usualNight` is matched against `weekdayOf(nightKey(now))`, and `nightKey`
   * takes six hours off before asking — a quiz that runs past twelve is still
   * the same night, which is the rule the archive, the photos, the league and
   * the headcounts all share. This line read `new Date().getDay()`.
   *
   * So between midnight and 6am the guard wrote `usualNight: 'mon'` while the
   * app was still calling it Sunday, no venue claimed tonight, and four checks
   * failed with *"no venue picked"* — the ready line telling the exact truth
   * about a venue the guard had misfiled. It passed at 23:40 and failed at
   * 00:15 on the same commit, which is the signature of this class of bug and
   * the only reason it was ever caught: `gig-build` is a Monday-morning job.
   *
   * **A CHECK THAT ASKS THE CALENDAR WHAT DAY IT IS WILL DISAGREE WITH THIS
   * APP FOR SIX HOURS OF EVERY DAY.** Ask the app.
   */
  const today = weekdayOf(nightKey());
  await fetch(`${BASE}/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint', 'A half'], usualNight: today }) });
  const lib = await (await fetch(`${BASE}/api/library`, { headers: H })).json();
  const code = lib.running.joinCode;

  browser = await chromium.launch();
  const context = await browser.newContext();
  const url = new URL(BASE);
  await context.addCookies([{ name: cookieName, value: decodeURIComponent(cookieValue), domain: url.hostname, path: '/' }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/console`, { waitUntil: 'load' });
  await page.waitForSelector('.lb-ready', { timeout: 15000 });

  const text = () => page.locator('.lb-ready').first().textContent();
  const waitFor = async (want, ms = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const t = await text(); if (want.test(t)) return t; await page.waitForTimeout(250); }
    return await text();
  };

  let t = await waitFor(/no projector open/);
  check('with no projector open the line says so, and offers to open it', /Not ready yet/.test(t) && /no projector open/.test(t) && await page.locator('.lb-ready a').count() === 1, t);
  check('the line stopped saying "checking the server" — the poll ran', !/checking the server/.test(t), t);
  check('the venue and its prizes are named', /The Crown/.test(t) && /prizes set/.test(t), t);

  const screen = await context.newPage();
  await screen.goto(`${BASE}/screen?g=${code}`, { waitUntil: 'load' });
  t = await waitFor(/Ready for tonight/);
  check('with the projector open it says Ready for tonight', /Ready for tonight/.test(t) && /projector open/.test(t), t);
  const green = await page.locator('.lb-ready').first().evaluate((el) => el.classList.contains('lb-ready-ok'));
  check('…in green', green);

  await screen.close();
  t = await waitFor(/no projector open/);
  check('closing the projector takes the light back off', /Not ready yet/.test(t), t);

  // A re-render must not leave a dead line behind: pick the venue again
  // (the bar rebuilds) and the new line must still poll.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const screen2 = await context.newPage();
  await screen2.goto(`${BASE}/screen?g=${code}`, { waitUntil: 'load' });
  t = await waitFor(/Ready for tonight/);
  check('after a rebuild of the bar the line still polls', /Ready for tonight/.test(t), t);
  await screen2.close();

  check('no console errors', errors.length === 0, errors.join(' | '));
} catch (err) {
  fails += 1;
  console.log('  FAIL threw:', err.stack || err);
} finally {
  if (browser) await browser.close();
  await stop();
}
if (fails) { console.log(`\n${fails} FAILED — the ready line is not telling the truth.`); process.exit(1); }
console.log('\nThe ready line goes green when it should, and off when it should.');
