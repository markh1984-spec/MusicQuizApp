#!/usr/bin/env node
/**
 * THE CONTENT-SECURITY-POLICY BREAKS NOTHING — read off the browser's own console.
 *
 * A policy that blocks an inline handler or a script says so ONLY in the
 * browser's console ("Refused to execute inline event handler because it
 * violates the following Content Security Policy directive…"); the server
 * cannot see it, the suite cannot see it, and the page looks fine right up to
 * the moment the blocked thing was needed. So this opens every screen a night
 * uses — the sales page, the sign-in, the console, the projector, a phone, the
 * control view, the wall, the camera, the gallery, the league, the DJ door —
 * and fails on any console line that names the policy. The phone and the
 * projector are driven onto a question with a picture, because that is where
 * the last inline handlers lived.
 *
 * It was proven by leaving one `onerror=` inline under the new policy: this
 * failed and nothing else did.
 *
 *   node scripts/csp-clean.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  — ${d}` : ''}`); };

const { base: BASE, stop } = await startApp({
  key: 'csp-clean-key',
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const violations = [];
  const watch = (page, where) => {
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(`${where}: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => violations.push(`${where} threw: ${String(e).slice(0, 160)}`));
  };
  const open = async (route, where = route) => {
    const page = await context.newPage();
    watch(page, where);
    await page.goto(`${BASE}${route}`, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    return page;
  };

  // The quizmaster signs in and launches a picture round from the API — the
  // screens are then driven, not the bar (drag-check and console-controls do that).
  const login = await open('/login');
  await login.fill('input[type=email]', 'qm@example.com');
  await login.fill('input[type=password]', 'quizmaster passphrase');
  await login.evaluate(() => document.querySelector('form')?.requestSubmit());
  await login.waitForTimeout(1500);
  const code = await login.evaluate(async () => {
    await fetch('/api/host/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'quiz', packId: '2006', replace: true }) });
    const lib = await (await fetch('/api/library')).json();
    return (lib.running && lib.running.joinCode) || '';
  });
  check('the night launched and the room has a code', Boolean(code), code);

  const consolePage = await open('/console');
  check('the console draws its shelf', await consolePage.waitForSelector('.pack-card', { timeout: 20000 }).then(() => true).catch(() => false));
  const host = await open('/host', '/host (control view)');
  const screen = await open(`/screen?g=${code}`, '/screen (projector)');
  const phone = await open(`/play?g=${code}`, '/play (phone)');
  await phone.fill('input[name=name], #name, input[type=text]', 'CSP Table').catch(() => {});
  await phone.evaluate(() => document.querySelector('form')?.requestSubmit()).catch(() => {});
  await phone.waitForTimeout(800);

  // Onto the picture round: start, jump to the image round's first question.
  const pack = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'quizzes', '2006.json'), 'utf8'));
  const imageRound = (pack.rounds || []).findIndex((r) => r.type === 'image');
  check('the pack has a picture round to drive to', imageRound >= 0);
  await host.evaluate(async (roundIndex) => {
    const press = (a, body = {}) => fetch(`/api/host/${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await press('start');
    await press('goto', { roundIndex, questionIndex: 0 });
    for (let i = 0; i < 6; i += 1) {
      const v = await (await fetch('/api/state?role=host')).json();
      if (v.phase === 'question' && v.question && v.question.image) break;
      await press('next');
    }
  }, imageRound);
  await screen.waitForTimeout(1200);
  await phone.waitForTimeout(600);
  const onPicture = await screen.evaluate(() => Boolean(document.querySelector('.zoom-frame img, .zoom-img')));
  check('the projector reached a picture question', onPicture);

  for (const route of ['/wall', `/wall?g=${code}`, '/snap', '/gallery', '/league', '/home', '/faq', '/terms', '/privacy', '/refunds', '/dj', '/signup', '/reset', '/magic', '/editor', '/owner']) {
    await open(route);
  }
  check('no page logged a Content-Security-Policy violation or threw', violations.length === 0, violations.join(' | ').slice(0, 600));
} catch (err) {
  fails += 1;
  console.log('  FAIL threw:', err.stack || err);
} finally {
  if (browser) await browser.close();
  await stop();
}

console.log(fails ? `\n${fails} FAILED — the policy is blocking something a screen needs.` : '\nThe policy blocks nothing a night uses.');
process.exit(fails ? 1 : 0);
