#!/usr/bin/env node
/**
 * TONIGHT'S PUB SURVIVES A RELOAD — and is gone by tomorrow.
 *
 *   node scripts/pub-stays-tonight.mjs
 *
 * The host, 1 October 2026: clear the bar, launch another game, and *"have it
 * assigned to the same night"*. A reload between games dropped the pub unless
 * tonight was its usual night — Launch then stood down for want of prizes, or
 * the next game filed under no pub. `tonight-venue.js` keeps the pick until
 * 6am. This drives the real console: pick, reload, read the bar.
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: B, stop } = await startApp({
  key: 'pub-stays-tonight',
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});
let browser;
try {
  const signIn = await fetch(`${B}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  // NOT tonight's usual night — three days on, so the app cannot pick it by
  // itself and the only way it is on the bar after a reload is remembering.
  const usualNight = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][(new Date().getDay() + 3) % 7];
  const mk = await (await fetch(`${B}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Crown' }) })).json();
  const venue = (mk.customers || []).find((c) => c.name === 'The Crown');
  await fetch(`${B}/api/invoices/customers/${encodeURIComponent(venue.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint'], usualNight }) });

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  const open = async () => { await page.goto(`${B}/console`, { waitUntil: 'load' }); await page.waitForSelector('.pack-card', { timeout: 20000 }); await wait(500); };
  const where = () => page.evaluate(() => (document.querySelector('.lb-where')?.textContent || '').trim());

  await open();
  check('a fresh console has no pub picked', !/The Crown/.test(await where()), await where());
  await page.evaluate(async () => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes('The Crown'))?.click();
  });
  await wait(600);
  check('the pub is picked', /The Crown/.test(await where()), await where());

  await open();
  check('AND STILL PICKED AFTER A RELOAD', /The Crown/.test(await where()), await where());

  // A pick stamped with LAST night reads as nobody having said.
  await page.evaluate(() => {
    const kept = JSON.parse(localStorage.getItem('musicquiz.tonightvenue') || '{}');
    localStorage.setItem('musicquiz.tonightvenue', JSON.stringify({ ...kept, night: '2000-01-01' }));
  });
  await open();
  check('and a pick from another night is forgotten', !/The Crown/.test(await where()), await where());
  check('nothing threw', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — tonight's pub does not hold` : '\nTonight\'s pub survives a reload, and is gone by tomorrow.');
process.exit(fails ? 1 : 0);
