#!/usr/bin/env node
/**
 * DOES THE BUY BUTTON ACTUALLY REACH A CHECKOUT?
 *
 * ---
 *
 * The £3 pack sale is Bronze's whole reason to exist — *Bronze buys packs,
 * Silver includes them* — and until 13 September 2026 the button was an
 * `alert()` saying there was no way to pay.
 *
 * **A unit test cannot answer the question this script exists for.** The button
 * is drawn from a locked pack summary, gated on `me.canBuy`, and posts from a
 * click handler whose catch would swallow a `ReferenceError` — which is exactly
 * how a gap dial died twice in a week. So: press it, in a real browser, and read
 * the request body the server actually receives.
 *
 * It never reaches Stripe: the route is intercepted, so what is measured is what
 * the BROWSER sent and what it did with the reply.
 *
 *   node scripts/buy-a-pack.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

import { startApp } from './helpers/live-app.mjs';

const KEY = 'buy-pack-key';
const EMAIL = 'bronze@example.com';
const PW = 'quizmaster passphrase';

/* Bronze, paying, so the shop has something in it AND the starter set is held. */
const { base: B, stop } = await startApp({
  key: KEY,
  env: {
    STRIPE_SECRET_KEY: 'sk_test_not_a_real_key',
    STRIPE_PRICE_BRONZE: 'price_b',
    STRIPE_PRICE_SILVER: 'price_s',
    STRIPE_PRICE_GOLD: 'price_g',
  },
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    book.create({ email: EMAIL, password: PW, name: 'Rob', role: 'quizmaster', tier: 'bronze', status: 'active' });
    book.save();
  },
});

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${JSON.stringify(want)}\n        got    ${JSON.stringify(got)}`);
};

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));

  /*
   * THE ROUTE IS INTERCEPTED, so nothing leaves for Stripe and the reply is a
   * url the page can follow. What is being measured is the BODY the browser
   * sent — the only place a wired-through field goes missing silently, which is
   * how `winners` arrived null on the launch path.
   */
  let sent = null;
  await page.route('**/api/buy-pack', async (r) => {
    sent = JSON.parse(r.request().postData() || '{}');
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: `${B}/console?door=account&tab=shop&bought=${sent.packId}` }),
    });
  });

  await page.goto(`${B}/login`, { waitUntil: 'load' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PW);
  await page.evaluate(() => document.querySelector('form')?.requestSubmit());
  await page.waitForTimeout(1800);
  await page.goto(`${B}/console?door=account&tab=shop`, { waitUntil: 'load' });
  await page.waitForTimeout(2600);

  console.log('\nTHE £3 BUY BUTTON, PRESSED\n');

  const shelf = await page.evaluate(() => [...document.querySelectorAll('.pack-card.locked')].map((c) => ({
    title: c.querySelector('.pack-title')?.textContent.trim(),
    price: c.querySelector('.shop-price')?.textContent.trim(),
    label: c.querySelector('.buy')?.textContent.trim(),
    // A button in the document with a size is not one somebody can press.
    pressable: (() => {
      const b = c.querySelector('.buy');
      if (!b || b.disabled) return false;
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return Boolean(at && (at === b || b.contains(at)));
    })(),
  })));
  check('the shop has locked packs on it', shelf.length > 0, true);
  check('each says £3', shelf.every((c) => c.price === '£3'), true);
  check('the button says Buy it', shelf[0] && shelf[0].label, 'Buy it');
  check('and it is genuinely pressable, not just in the DOM', shelf[0] && shelf[0].pressable, true);

  const wanted = shelf[0].title;
  await page.evaluate(() => document.querySelector('.pack-card.locked .buy')?.click());
  await page.waitForTimeout(1200);

  check('pressing it posts a pack id', Boolean(sent && sent.packId), true);
  check('and a kind the server can resolve', ['quiz', 'bingo'].includes(sent && sent.kind), true);
  check('and nothing else — no price from the browser', Object.keys(sent || {}).sort(), ['kind', 'packId']);
  check('it followed the url it was given', new URL(page.url()).searchParams.get('bought'), sent.packId);
  check('nothing threw', errs, []);
  console.log(`       (bought: ${JSON.stringify(wanted)} as ${JSON.stringify(sent.packId)})`);

  /*
   * AND WITH NO STRIPE KEYS THE BUTTON IS PRESENT AND INERT — never absent, and
   * never an alert. A control that comes and goes is one you cannot learn the
   * position of; this is the same rule Launch follows when it goes hollow.
   */
  console.log('\nAND ON A SERVER WITH NO STRIPE KEYS\n');
  const dry = await startApp({
    key: 'buy-pack-dry',
    async seed(dir) {
      const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
      const book = new Accounts(path.join(dir, 'accounts.json'));
      book.create({ email: EMAIL, password: PW, name: 'Rob', role: 'quizmaster', tier: 'bronze', status: 'active' });
      book.save();
    },
  });
  try {
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await p2.goto(`${dry.base}/login`, { waitUntil: 'load' });
    await p2.fill('input[type=email]', EMAIL);
    await p2.fill('input[type=password]', PW);
    await p2.evaluate(() => document.querySelector('form')?.requestSubmit());
    await p2.waitForTimeout(1800);
    await p2.goto(`${dry.base}/console?door=account&tab=shop`, { waitUntil: 'load' });
    await p2.waitForTimeout(2600);
    const off = await p2.evaluate(() => {
      const b = document.querySelector('.pack-card.locked .buy');
      return b ? { there: true, disabled: b.disabled, label: b.textContent.trim() } : { there: false };
    });
    check('the button is still there', off.there, true);
    check('disabled rather than gone', off.disabled, true);
    check('and says why on itself', off.label, 'Not on sale yet');
    await p2.close();
  } finally { dry.stop(); }

  console.log(fails ? `\n${fails} FAILED — the on-ramp does not work.\n`
    : '\nA pack can be bought, and nothing but the server decides what it costs.\n');
  process.exitCode = fails ? 1 : 0;
} finally {
  try { await browser?.close(); } catch {}
  stop();
}
