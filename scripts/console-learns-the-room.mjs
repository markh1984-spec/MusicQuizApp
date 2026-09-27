#!/usr/bin/env node
/**
 * A CONSOLE LEFT OPEN LEARNS THE ROOM CHANGED.
 *
 *   node scripts/console-learns-the-room.mjs
 *
 * The console has NO stream of its own — every push goes to the projector
 * and the phones — and fourteen comments plus CLAUDE.md said the bar was
 * "rebuilt on every state push". It was not: a night launched from another
 * device (the phone in the other hand, the laptop on the bar) left the
 * console saying nothing was on, every tap refused in silence, and no way
 * in to take control (O9 of the 23 September 2026 sweep). Now the ready
 * light's five-second poll carries which night is up and repaints when it
 * is a different one, and a tap the server refuses asks straight away.
 *
 * Driven on a real console: launched from the API as the same account,
 * ended from the API, launched again and tapped over.
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, stop } = await startApp({
  key: 'learns-room',
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});
let browser;
try {
  const signIn = await fetch(`${BASE}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const api = (route, body) => fetch(`${BASE}${route}`, { method: 'POST', headers: H, body: JSON.stringify(body || {}) }).then((r) => r.status);
  // A venue with prizes, so the console's own Launch is live too.
  const mk = await (await fetch(`${BASE}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Other Device' }) })).json();
  const venue = (mk.customers || []).find((c) => c.name === 'The Other Device');
  if (venue) await fetch(`${BASE}/api/invoices/customers/${encodeURIComponent(venue.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['Pint', 'Half', 'Crisps'], usualNight: 'thu' }) });

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await context.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: BASE }]);
  const p = await context.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  p.on('dialog', (d) => d.accept().catch(() => {}));
  await p.goto(`${BASE}/console`, { waitUntil: 'load' });
  await p.waitForSelector('.pack-card', { timeout: 20000 });
  const panel = () => p.evaluate(() => (document.querySelector('.doorhead')?.innerText || '').replace(/\s+/g, ' '));
  const nightOn = async () => /On the big screen now/.test(await panel());
  check('the console opens on nothing running', !(await nightOn()));
  // The venue on the console too, or its quiet launch stands down for want
  // of prizes before it ever asks the server — and the third act needs the ask.
  await p.evaluate(async (v) => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes(v))?.click();
  }, 'The Other Device');
  await wait(600);

  console.log('\nLAUNCHED FROM ANOTHER DEVICE — does the open console notice?');
  check('the other device launches', await api('/api/host/launch', { game: 'quiz', packId: 'madonna', venue: 'The Other Device' }) === 200);
  let seen = false;
  for (let i = 0; i < 16 && !seen; i += 1) { await wait(500); seen = await nightOn(); }
  check('within eight seconds the console shows the night on the big screen, without a reload', seen, (await panel()).slice(0, 120));

  console.log('\nENDED FROM ANOTHER DEVICE');
  check('the other device ends it', await api('/api/host/resetAll', {}) === 200);
  let gone = false;
  for (let i = 0; i < 16 && !gone; i += 1) { await wait(500); gone = !(await nightOn()); }
  check('within eight seconds the running panel is gone', gone, (await panel()).slice(0, 120));

  console.log('\nLAUNCHED AGAIN, AND A TAP ON THE STALE CONSOLE');
  // THE POLL IS PAUSED for this act — a hidden tab skips its ticks, which is
  // real — so the tap's own path is the only way the console can learn.
  await p.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
  check('the other device launches again', await api('/api/host/launch', { game: 'quiz', packId: 'madonna', venue: 'The Other Device' }) === 200);
  // AND A PHONE IS IN IT — a launched night at an EMPTY lobby is one the
  // console's quiet launch may replace by design; with a phone in, the tap is
  // refused (409), which is the path under test.
  const code = (await (await fetch(`${BASE}/api/library`, { headers: H })).json()).joinCode;
  check('a phone joins the other device\'s night', await api(`/api/join?g=${encodeURIComponent(code)}`, { name: 'Table One', joinCode: code }) === 200);
  await wait(1200);
  check('  ...and with the poll paused the console still says nothing is on', !(await nightOn()));
  await p.evaluate(() => document.querySelector('.pack-card[data-pack="metallica"]')?.click());
  let quick = false;
  for (let i = 0; i < 6 && !quick; i += 1) { await wait(500); quick = await nightOn(); }
  check('the refused tap makes the console ask, and the night is on the panel within three seconds', quick, (await panel()).slice(0, 120));
  await p.evaluate(() => { delete document.visibilityState; });
  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — a console left open does not learn the room changed` : '\nA console left open learns the room changed.');
process.exit(fails ? 1 : 0);
