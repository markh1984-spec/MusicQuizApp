#!/usr/bin/env node
/**
 * CAN SOMEBODY WHO IS NOT PAYING BUY THE RUNG THEY ARE ON?
 *
 * ---
 *
 * Found by an audit of the money path on 13 September 2026, and it is the one
 * fault on it that config could not fix: `tierRow()` decided which rung was
 * "yours" from RANK alone (`i <= mine`), never from whether anybody was paying.
 * So an account whose **trial had expired** — Bronze, `trialing`, clock run out,
 * every capability off — opened My account and read *"Bronze: this is the one
 * you are on"* with **no Subscribe button on it**. Silver and Gold were
 * buyable. The rung they wanted was not.
 *
 * **That is the path every expired trial takes**, so the ladder's only job
 * failed for precisely the people who had just decided to pay. A `cancelled`
 * account hit the same wall, and so did anybody mid-trial who simply wanted to
 * commit early.
 *
 * And the other half, which is why this is not just "always show the button":
 * somebody who HAS paid before already has a subscription at Stripe, so a
 * second Checkout opens a SECOND one and bills them twice. They get the portal
 * instead — which `subscribeSlot()` already draws on `hasBilling`.
 *
 * A unit test cannot see any of this: `tierRow()` builds DOM, the button is
 * conditional on `/api/me`, and the fault was in a boolean nobody had written
 * down. **Four accounts in four standings, in a real browser, pressing the
 * rung.**
 *
 *   node scripts/buy-your-own-rung.mjs
 *
 * The Stripe keys are FAKE and deliberately so — `stripeConfigured()` only
 * asks whether a secret and a price are present, and nothing here reaches the
 * network: the check is whether the BUTTON is drawn, not whether Checkout
 * opens.
 */

import path from 'node:path';

const { chromium } = playwright();

import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const KEY = 'rung-key';
const PW = 'quizmaster passphrase';

/*
 * FOUR STANDINGS, and the fourth is the one that must NOT get a button.
 * `trialEndsAt` is written once by `create()` and never touched again, so an
 * expired trial is made by winding that field back rather than by waiting a
 * fortnight.
 */
const WHO = [
  { email: 'expired@example.com', label: 'an expired trial', status: 'trialing', trialDaysAgo: 3, buyOwn: true },
  { email: 'live@example.com', label: 'a live trial', status: 'trialing', buyOwn: true },
  { email: 'cancelled@example.com', label: 'a cancelled account that never paid', status: 'cancelled', buyOwn: true },
  { email: 'paid@example.com', label: 'somebody paying right now', status: 'active', buyOwn: false },
  { email: 'pastdue@example.com', label: 'past due, having paid before', status: 'past_due', customer: 'cus_fake', buyOwn: false },
];

const { base: B, stop } = await startApp({
  key: KEY,
  env: {
    STRIPE_SECRET_KEY: 'sk_test_not_a_real_key',
    STRIPE_PRICE_BRONZE: 'price_bronze_fake',
    STRIPE_PRICE_SILVER: 'price_silver_fake',
    STRIPE_PRICE_GOLD: 'price_gold_fake',
  },
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    for (const w of WHO) {
      const made = book.create({
        email: w.email, password: PW, name: w.label, role: 'quizmaster', tier: 'bronze', status: w.status,
      });
      const row = book.find(made.id);
      if (w.trialDaysAgo) row.trialEndsAt = new Date(Date.now() - w.trialDaysAgo * 86_400_000).toISOString();
      if (w.customer) row.billing = { processor: 'stripe', customer: w.customer, reference: 'sub_fake', at: new Date().toISOString() };
    }
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
  console.log('\nTHE RUNG YOU ARE ON, PRESSED BY FIVE STANDINGS\n');

  for (const w of WHO) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    await page.goto(`${B}/login`, { waitUntil: 'load' });
    await page.fill('input[type=email]', w.email);
    await page.fill('input[type=password]', PW);
    await page.evaluate(() => document.querySelector('form')?.requestSubmit());
    await page.waitForTimeout(1600);
    await page.goto(`${B}/console?door=account&tab=account`, { waitUntil: 'load' });
    await page.waitForTimeout(2200);

    console.log(`\n  ${w.label}`);

    // The ladder has to be there at all before anything else means anything.
    const rungs = await page.evaluate(() => [...document.querySelectorAll('.tier-rung')].map((b) => b.dataset.tier));
    check('    the three rungs draw', rungs, ['bronze', 'silver', 'gold']);

    /*
     * PRESS BRONZE — their own rung — and look for the button. `sells()` is
     * what decides, so this is the assertion the fix exists for.
     */
    await page.evaluate(() => document.querySelector('.tier-rung[data-tier=bronze]')?.click());
    await page.waitForTimeout(500);
    const own = await page.evaluate(() => {
      const card = document.querySelector('.tier-card');
      const buy = card?.querySelector('.tier-buy');
      return {
        buy: Boolean(buy && buy.getClientRects().length),
        foot: card?.querySelector('.tier-card-foot')?.textContent.trim() || '',
      };
    });
    check(`    Bronze ${w.buyOwn ? 'can' : 'cannot'} be subscribed to`, own.buy, w.buyOwn);
    // A card with no button must still SAY something — a blank foot and no
    // control is a rung that reads as broken.
    check('    and the card says where they stand', own.buy || own.foot.length > 0, true);

    /*
     * AND GOLD IS UNCHANGED IN EVERY STANDING. The old behaviour was right for
     * the rungs ABOVE yours, so this is the half the fix must not have moved.
     */
    await page.evaluate(() => document.querySelector('.tier-rung[data-tier=gold]')?.click());
    await page.waitForTimeout(500);
    const up = await page.evaluate(() => {
      const b = document.querySelector('.tier-card .tier-buy');
      return Boolean(b && b.getClientRects().length);
    });
    check('    and Gold is still buyable, as it always was', up, true);

    /*
     * THE WAY BACK IN FOR SOMEBODY WHO HAS PAID: the portal. If the rung is
     * withheld from them, this has to be present or they have no route at all.
     */
    const portal = await page.evaluate(() => Boolean(document.querySelector('#acctBilling')));
    if (w.customer) check('    and the portal is there instead', portal, true);

    check('    nothing threw', errs, []);
    await page.close();
  }

  console.log(fails
    ? `\n${fails} FAILED — somebody who wants to pay cannot.\n`
    : '\nEvery standing can buy what it should, and nobody is billed twice.\n');
  process.exitCode = fails ? 1 : 0;
} finally {
  try { await browser?.close(); } catch {}
  stop();
}
