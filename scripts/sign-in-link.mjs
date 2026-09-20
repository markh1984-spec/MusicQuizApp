#!/usr/bin/env node
/**
 * THE SIGN-IN LINK, PRESSED — the half the unit tests cannot see.
 *
 * `test/magic-link.test.js` proves the token rules. What it cannot prove is
 * that anybody can reach them: this repo's own recorded fault is a route that
 * works perfectly with nothing calling it, and a control that reports success
 * it did not have.
 *
 * So this drives the real thing: ask for a link on `/login`, take the address
 * out of the email the fake provider captured, open it, press the button, and
 * assert the browser ends up signed in. Plus the two refusals that make the
 * design worth having — the link is NOT spent by fetching the page, and it is
 * dead on the second press.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();

const KEY = 'magic-guard-key';
const PW = 'a long enough password';
const WHO = 'rob@example.com';

const fails = [];
const ok = (cond, what) => { if (!cond) fails.push(what); return cond; };

/*
 * THE MAIL PROVIDER IS STUBBED THE WAY `trial-emails.test.js` STUBS IT — every
 * send appended to a JSONL file — and loaded through `NODE_OPTIONS` so the
 * shared `live-app.mjs` needs no new argument. A guard that had to change the
 * helper every other app uses would be paying for itself out of somebody
 * else's budget.
 */
const OUTBOX = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'magic-mail-')), 'sent.jsonl');
const STUB = new URL('../test/helpers/mail-stub.mjs', import.meta.url).pathname;
const sentSoFar = () => (fs.existsSync(OUTBOX) ? fs.readFileSync(OUTBOX, 'utf8') : '')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

await withApp(async ({ base }) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

    // ---- ask for one, the way a person does
    await page.goto(`${base}/login`);
    await page.locator('#forgot').click();
    await page.fill('#forgotForm input[type=email]', WHO);
    await page.locator('#wantMagic').click();
    await page.waitForTimeout(800);
    const said = await page.locator('#forgotSaid').innerText();
    ok(/on its way/i.test(said), `the form did not say a link was sent: "${said}"`);

    const sent = sentSoFar();
    ok(sent.length === 1, `${sent.length} emails sent, wanted 1`);
    const link = (sent[0]?.text || '').match(/https?:\/\/\S+\/magic\?t=\S+/)?.[0];
    ok(Boolean(link), 'no sign-in link in the email');
    ok(/sign-in link/i.test(sent[0]?.subject || ''), 'the subject is not a sign-in link');
    if (!link) return;

    // ---- A SCANNER FETCHING THE LINK MUST NOT SPEND IT
    /*
     * The whole reason `/magic` is a page with a button rather than a GET that
     * signs you in. Mail clients and corporate scanners fetch the links in a
     * message before a human sees it; if that spent the link, the one person
     * it was sent to would be locked out — which is the situation they were
     * already in.
     */
    const scanner = await browser.newPage();
    await scanner.goto(link);
    await scanner.waitForTimeout(500);
    await scanner.close();

    // ---- and the human still gets in
    await page.goto(link);
    await page.waitForTimeout(600);
    ok(await page.locator('#go').count() === 1, 'no button on the sign-in page');
    /*
     * SAID AS A SENTENCE, AND BEFORE ANYTHING IS PRESSED.
     *
     * The first version went straight to the click, so a link the scanner had
     * already spent failed as a THIRTY-SECOND PLAYWRIGHT TIMEOUT on a hidden
     * button — a stall and a stack trace where the actual finding is one line.
     * Verified by putting the fault back: spending the link on page load now
     * fails here, in words, immediately.
     */
    const stillGood = await page.locator('#go').isVisible() && await page.locator('#dud').isHidden();
    ok(stillGood, 'A SCANNER FETCHING THE LINK SPENT IT — the page must not sign in on load');
    if (!stillGood) return;
    await page.locator('#go').click();
    await page.waitForTimeout(1500);
    ok(/\/console|\/owner/.test(page.url()), `pressing it landed on ${page.url()}`);

    const me = await page.evaluate(async () => (await (await fetch('/api/me')).json()));
    ok(me.signedIn === true, 'the browser is not actually signed in');
    ok(me.account?.email === WHO, `signed in as ${me.account?.email}`);

    // ---- AND THE PASSWORD STILL WORKS, which is the difference from a reset
    const still = await page.evaluate(async (pw) => {
      const r = await fetch('/api/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rob@example.com', password: pw }),
      });
      return r.status;
    }, PW);
    ok(still === 200, `the password stopped working (${still})`);

    // ---- single use
    const again = await browser.newPage();
    await again.goto(link);
    await again.waitForTimeout(400);
    await again.locator('#go').click();
    await again.waitForTimeout(900);
    ok(await again.locator('#dud').isVisible(), 'a spent link does not say so');
    ok(!/\/console|\/owner/.test(again.url()), 'a spent link signed somebody in');
  } finally {
    await browser.close();
  }
}, {
  key: KEY,
  env: {
    NODE_OPTIONS: `--import=${STUB}`,
    MAIL_STUB_FILE: OUTBOX,
    // A provider and a from-address, or `emailConfigured()` is false and the
    // route declines to send at all — which is correct, and not what is
    // under test here.
    BREVO_API_KEY: 'stub-key',
    EMAIL_FROM: 'Quizporium <no-reply@example.com>',
  },
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: WHO, password: PW, name: 'Rob', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

if (fails.length) {
  console.error('\nTHE SIGN-IN LINK IS BROKEN:\n');
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nA sign-in link works: asked for on the sign-in page, opened from the email,');
  console.log('pressed once — and NOT spent by a scanner fetching it first.');
}
