#!/usr/bin/env node
/**
 * A ROUND'S OWN SECONDS AND REVEAL REACH THE ROOM — set in the "Each round"
 * fold, sent by Launch, played by the engine, and kept by Save.
 *
 *   node scripts/round-settings-reach-the-room.mjs
 *
 * The host, 29 September 2026: *"each round should carry its own settings but
 * there should be defaults so you're only changing them if you need to."* A
 * setting is carried on the round's reference in the running order
 * (`round-set.js`), and this app has lost a field on its way to the room five
 * times — through a whitelist nobody remembered. So this drives the real bar,
 * reads the request body out of the browser, then asks the ROOM.
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, stop } = await startApp({
  key: 'round-settings',
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
  const mk = await (await fetch(`${BASE}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Crown' }) })).json();
  const venue = (mk.customers || []).find((c) => c.name === 'The Crown');
  await fetch(`${BASE}/api/invoices/customers/${encodeURIComponent(venue.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['Pint', 'Half', 'Crisps'] }) });

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: BASE }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(`${d.type()}: ${d.message().slice(0, 80)}`); d.accept(d.type() === 'prompt' ? 'Round settings night' : undefined).catch(() => {}); });
  await page.goto(`${BASE}/console`, { waitUntil: 'load' });
  await page.waitForSelector('.pack-card', { timeout: 20000 });
  await page.evaluate(async () => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes('The Crown'))?.click();
  });
  await wait(500);
  // 2006: general knowledge, a picture round, intros — one of each kind of row.
  await page.evaluate(() => document.querySelector('.pack-card[data-pack="2006"]')?.click());
  await wait(2000);

  console.log('\nTHE FOLD, SHUT AND OPEN');
  const shut = await page.evaluate(() => (document.querySelector('.lb-rounds-set')?.textContent || '').replace(/\s+/g, ' ').trim());
  check('shut, it says every round plays as the night', /every round as the night/.test(shut), shut);
  await page.evaluate(() => document.querySelector('.lb-rs-head')?.click());
  await wait(300);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.lb-rounds-set .lb-pz-row')].map((r) => ({
    name: r.querySelector('.lb-pz-who')?.textContent.trim(),
    picks: [...r.querySelectorAll('.lb-rs-pick')].map((s) => s.dataset.what),
  })));
  check('open, one row per round', rows.length === 3, JSON.stringify(rows));
  check('seconds on every row, a reveal on the picture round only', rows.length === 3 && rows.every((r) => r.picks.includes('seconds'))
    && rows[1].picks.includes('reveal') && !rows[0].picks.includes('reveal') && !rows[2].picks.includes('reveal'), JSON.stringify(rows));
  const prizeOpen = await page.evaluate(() => document.querySelector('.lb-pz-head')?.getAttribute('aria-expanded'));
  check('and opening it left the prize table alone', prizeOpen === 'false', String(prizeOpen));

  console.log('\nTHE INTROS AT 30 SECONDS, THE PICTURES PIXELATED');
  await page.evaluate(() => {
    const set = (what, at, value) => {
      const s = document.querySelectorAll('.lb-rounds-set .lb-pz-row')[at].querySelector(`.lb-rs-pick[data-what="${what}"]`);
      s.value = value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('seconds', 2, '30');
    set('reveal', 1, 'pixelate');
  });
  await wait(400);
  const live = await page.evaluate(() => (document.querySelector('.lb-live')?.textContent || '').replace(/\s+/g, ' ').trim());
  check('the live line says Launch applies it', /Launch to apply/.test(live), live);

  // BEFORE Launch: a running night is the running panel, with no bar and no
  // Save. And Save re-renders the bar, so Launch after it proves the settings
  // survive a render too.
  console.log('\nSAVE KEEPS THEM');
  await page.evaluate(() => document.querySelector('.set-save')?.click());
  await wait(1500);
  const shows = (await (await fetch(`${BASE}/api/library`, { headers: H })).json()).shows || [];
  const kept = ((shows[0] || {}).items || []).flatMap((it) => it.order || []);
  check('the saved show carries the round\'s own clock and reveal', kept.some((e) => e.questionSeconds === 30) && kept.some((e) => e.reveal === 'pixelate'), `${JSON.stringify(kept)} ${dialogs.join(' | ')}`);

  // A FRESH CONSOLE — its own page, so nothing is left in memory — loads the
  // show onto Tonight, and the fold names both settings again (`applyShow()`).
  const again = await context.newPage();
  again.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  await again.goto(`${BASE}/console`, { waitUntil: 'load' });
  await again.waitForSelector('.pack-card', { timeout: 20000 });
  await again.evaluate(() => document.querySelector('[data-tab="shows"]')?.click());
  await wait(900);
  await again.evaluate(() => document.querySelector('.show-card')?.click());
  await wait(1500);
  const ledger = await again.evaluate(() => (document.querySelector('.lb-rounds-set')?.textContent || '').replace(/\s+/g, ' ').trim());
  check('a saved show loaded onto Tonight brings its rounds\' settings back', /Pixelate/.test(ledger) && /30s/.test(ledger), ledger);
  await again.close();

  console.log('\nLAUNCH SENDS THEM, AND THE ROOM PLAYS THEM');
  const sent = page.waitForRequest((r) => r.url().includes('/api/host/launch') && r.method() === 'POST', { timeout: 8000 }).then((r) => r.postDataJSON(), () => null);
  await page.evaluate(() => document.querySelector('.lb-go')?.click());
  const body = await sent;
  const order = (body && body.order) || [];
  check('Launch sends the rounds, each carrying its own', order.length === 3 && order[2].questionSeconds === 30 && order[1].reveal === 'pixelate' && !order[0].questionSeconds && !order[0].reveal, JSON.stringify(order));
  await wait(1500);

  // Drive the room: the picture round's questions, then the intros' clock.
  const host = (action) => fetch(`${BASE}/api/host/${action}`, { method: 'POST', headers: H, body: '{}' }).then((r) => r.json());
  const hostView = () => fetch(`${BASE}/api/state?role=host`, { headers: H }).then((r) => r.json());
  const code = (await (await fetch(`${BASE}/api/library`, { headers: H })).json()).joinCode;
  const screenView = () => fetch(`${BASE}/api/state?role=screen&g=${encodeURIComponent(code)}`).then((r) => r.json());
  await host('start');
  let reveal = null;
  let seconds = null;
  for (let i = 0; i < 200 && (reveal === null || seconds === null); i += 1) {
    const hv = await hostView();
    if (hv.phase === 'final') break;
    if (hv.phase === 'question' && hv.roundIndex === 1 && reveal === null) reveal = ((await screenView()).question || {}).reveal || '';
    if (hv.phase === 'question' && hv.roundIndex === 2 && seconds === null) seconds = (hv.clock || {}).seconds;
    await host('next');
  }
  check('the room reveals the pictures by pixelating', reveal === 'pixelate', String(reveal));
  check('and gives the intros 30 seconds', seconds === 30, String(seconds));

  check('nothing threw', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — a round's own settings did not reach the room` : '\nA round\'s own seconds and reveal reach the room, and Save keeps them.');
process.exit(fails ? 1 : 0);
