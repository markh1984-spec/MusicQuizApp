#!/usr/bin/env node
/**
 * DOES THE MONEY TAB SAY WHAT IS ACTUALLY COMING IN?
 *
 * ---
 *
 * Found by an audit of the money path on 13 September 2026. `moneyTab()` folded
 * `trialing` in with `active`, so **"£X a month coming in" was inflated by every
 * free trial** — and so was the "more than is coming in" flag under it, which is
 * the one question the page exists to answer. Worst at the only moment it
 * matters: the month a tier goes on sale and a dozen people start trials, the
 * page says the business has turned a corner.
 *
 * It is the same fault the hosting fee had — a figure flattering itself — and
 * `npm test` cannot see either, because the sum is in the browser and the page
 * only draws for an owner.
 *
 * Also checked here: **`wantedTier`, which was stored on every account and drawn
 * by nothing.** A field on a view is a promise that something draws it, and this
 * one was the only signal about which rung people actually press. It shows only
 * where it DIFFERS from the rung they are on — and `findTier()` falls back to
 * Bronze for an empty id, so "no preference" must not read as "wanted Bronze".
 *
 *   node scripts/owner-money.mjs
 */

import path from 'node:path';

const { chromium } = playwright();

import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const KEY = 'owner-money-key';
const PW = 'owner passphrase here';

/*
 * A BOOK WHOSE RIGHT ANSWER IS ARITHMETIC NOBODY CAN GET RIGHT BY ACCIDENT.
 *
 * Two paying (Silver £20 + Gold £30 = £50), three trials (one of them run out),
 * one comped and one cancelled. The old sum said £50 + three trials on Bronze
 * = £80 and "5 paying".
 */
const PEOPLE = [
  { email: 'pays-silver@example.com', tier: 'silver', status: 'active' },
  { email: 'pays-gold@example.com', tier: 'gold', status: 'active' },
  { email: 'trial-one@example.com', tier: 'bronze', status: 'trialing' },
  { email: 'trial-two@example.com', tier: 'bronze', status: 'trialing', wantedTier: 'gold' },
  { email: 'trial-over@example.com', tier: 'bronze', status: 'trialing', trialDaysAgo: 2 },
  { email: 'on-the-house@example.com', tier: 'gold', status: 'active', comped: true },
  { email: 'gone@example.com', tier: 'silver', status: 'cancelled' },
];

const { base: B, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'owner@example.com', password: PW, name: 'Owner', role: 'owner', status: 'active' });
    for (const p of PEOPLE) {
      const made = book.create({
        email: p.email, password: 'quizmaster passphrase', name: p.email.split('@')[0],
        role: 'quizmaster', tier: p.tier, status: p.status, comped: Boolean(p.comped),
        wantedTier: p.wantedTier || '',
      });
      const row = book.find(made.id);
      if (p.trialDaysAgo) row.trialEndsAt = new Date(Date.now() - p.trialDaysAgo * 86_400_000).toISOString();
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.goto(`${B}/login`, { waitUntil: 'load' });
  await page.fill('input[type=email]', 'owner@example.com');
  await page.fill('input[type=password]', PW);
  await page.evaluate(() => document.querySelector('form')?.requestSubmit());
  await page.waitForTimeout(1800);
  /*
   * THE OWNER PAGE HAS NO `?tab=`, unlike the console — the tab is a module
   * binding and a click. A first version of this guard used `?tab=money`, got
   * the People tab, and every money assertion failed for the wrong reason. Press
   * the button and assert it went there before measuring anything.
   */
  await page.goto(`${B}/owner`, { waitUntil: 'load' });
  await page.waitForTimeout(2400);
  await page.evaluate(() => document.querySelector('.tab[data-tab="money"]')?.click());
  await page.waitForTimeout(1200);
  check('the Money tab is the one being read', await page.evaluate(
    () => document.querySelector('.tab.on')?.dataset.tab), 'money');

  console.log('\nWHAT THE MONEY TAB SAYS\n');

  const money = await page.evaluate(() => {
    const figs = [...document.querySelectorAll('.own-fig')].map((f) => ({
      big: f.querySelector('b')?.textContent.trim() || '',
      said: f.querySelector('span')?.textContent.replace(/\s+/g, ' ').trim() || '',
    }));
    return { figs, body: document.body.textContent.replace(/\s+/g, ' ') };
  });

  const income = money.figs[0] || {};
  check('the headline is the two accounts actually paying', income.big, '£50');
  check('and it counts two of them, not five', /2 paying accounts/.test(income.said), true);
  check('the trials are named separately', /3 on trial/.test(money.body), false);
  check('the LIVE trials are named separately', /2 on trial/.test(money.body), true);
  check('a trial that ran out is called out as a job', /1 trial run out/.test(money.body), true);
  check('and no forecast is printed beside it', /if every one of them/.test(money.body), false);

  // "Where it comes from" multiplies by a price, so a trial in it is the same
  // overstatement as the headline had.
  const rows = await page.evaluate(() => [...document.querySelectorAll('.own-row')]
    .map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  check('Bronze brings in nothing, because nobody is paying for it', rows.some((r) => /Bronze.*0 × = £0/.test(r)), true);
  check('Silver is one account', rows.some((r) => /Silver.*1 × = £20/.test(r)), true);
  check('Gold is one, not two — the comped one pays nothing', rows.some((r) => /Gold.*1 × = £30/.test(r)), true);

  console.log('\nAND WHICH RUNG THEY PRESSED ON THE WAY IN\n');
  await page.evaluate(() => document.querySelector('.tab[data-tab="people"]')?.click());
  await page.waitForTimeout(1200);
  check('and the People tab is the one being read', await page.evaluate(
    () => document.querySelector('.tab.on')?.dataset.tab), 'people');
  const people = await page.evaluate(() => ({
    // The Quizmasters heading, not whatever .game-head comes first on the page.
    head: [...document.querySelectorAll('.game-head')]
      .find((h) => /Quizmasters/.test(h.textContent))
      ?.querySelector('.tiny')?.textContent.replace(/\s+/g, ' ').trim() || '',
    wanted: [...document.querySelectorAll('.inv-row')].map((r) => ({
      who: r.querySelector('b')?.textContent.trim(),
      note: r.querySelector('.inv-wanted')?.textContent.trim() || '',
    })),
  }));
  console.log(`       (header reads: ${JSON.stringify(people.head)})`);
  check('the header counts paying and trialing apart', /2 paying · 3 on trial/.test(people.head), true);
  const wanted = people.wanted.filter((r) => r.note);
  check('exactly one row says what they wanted', wanted.length, 1);
  check('and it is the one who pressed Gold on the way in', wanted[0] || null, { who: 'trial-two', note: 'wanted Gold' });

  check('nothing threw', errs, []);

  console.log(fails ? `\n${fails} FAILED — the page is not telling the truth about the money.\n`
    : '\nThe figures are what has actually arrived, and nothing is invented.\n');
  process.exitCode = fails ? 1 : 0;
} finally {
  try { await browser?.close(); } catch {}
  stop();
}
