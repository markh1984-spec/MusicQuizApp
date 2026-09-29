#!/usr/bin/env node
/**
 * THE LIVE LINE TELLS THE TRUTH — "this one" means THIS night, not this title.
 *
 *   node scripts/live-line-tells-the-truth.mjs
 *
 * A tap puts a pack on the big screen quietly, and every change made after
 * it — Winners 1, a round switched off, a prize typed — reached nothing while
 * the line still read "On the big screen now — this one"; a host going in
 * through Open the controls ran a night the bar said was gone (O1 of the 23
 * September 2026 sweep). The server keys what it launched off the request
 * body and the bar keys what Launch would send, through one function
 * (launch-key.js), so the line can only say "this one" when they agree.
 * And a row emptied tile by tile is no night at all.
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, stop } = await startApp({
  key: 'live-line',
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
  const mk = await (await fetch(`${BASE}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Honest Arms' }) })).json();
  const venue = (mk.customers || []).find((c) => c.name === 'The Honest Arms');
  if (venue) await fetch(`${BASE}/api/invoices/customers/${encodeURIComponent(venue.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['Pint', 'Half', 'Crisps'], usualNight: 'thu' }) });
  const mk2 = await (await fetch(`${BASE}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Other Arms' }) })).json();
  const other = (mk2.customers || []).find((c) => c.name === 'The Other Arms');
  if (other) await fetch(`${BASE}/api/invoices/customers/${encodeURIComponent(other.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['Wine'] }) });

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await context.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: BASE }]);
  const p = await context.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  p.on('dialog', (d) => d.accept().catch(() => {}));
  await p.goto(`${BASE}/console`, { waitUntil: 'load' });
  await p.waitForSelector('.pack-card', { timeout: 20000 });
  await p.evaluate(async (v) => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes(v))?.click();
  }, 'The Honest Arms');
  await wait(600);
  const line = () => p.evaluate(() => ({ text: (document.querySelector('.lb-live')?.textContent || '').replace(/\s+/g, ' ').trim(), warn: document.querySelector('.lb-live')?.classList.contains('lb-warn') }));
  // The projector's view carries `winners` only at the FINAL, and only when
  // it is not three — so each night is driven to its final scores to read it.
  const code = (await (await fetch(`${BASE}/api/library`, { headers: H })).json()).joinCode;
  const host = (action) => fetch(`${BASE}/api/host/${action}`, { method: 'POST', headers: H, body: '{}' }).then((r) => r.json());
  const hostView = () => fetch(`${BASE}/api/state?role=host`, { headers: H }).then((r) => r.json());
  const winnersAtFinal = async () => {
    await host('start');
    for (let i = 0; i < 300 && (await hostView()).phase !== 'final'; i += 1) await host('next');
    return (await (await fetch(`${BASE}/api/state?role=screen&g=${encodeURIComponent(code)}`)).json()).winners ?? 3;
  };
  const keyUp = async () => ((await (await fetch(`${BASE}/api/library`, { headers: H })).json()).running || {}).launchKey || '';

  console.log('\nA TAP PUTS IT UP, AND THE LINE SAYS "THIS ONE"');
  await p.evaluate(() => document.querySelector('.pack-card[data-pack="madonna"]')?.click());
  await wait(2500);
  const up = await line();
  check('the line says this one after the tap', /this one$/.test(up.text) && !up.warn, JSON.stringify(up));

  console.log('\nANOTHER PUB PICKED OVER AN EMPTY NIGHT — it moves, and the line says so');
  // Nobody has joined, so chooseVenue() relaunches quietly under the new pub.
  // The line must then read "this one", never "filed under The Honest Arms".
  await p.evaluate(async (v) => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes(v))?.click();
  }, 'The Other Arms');
  // SAMPLED WHILE IT MOVES, not only after: for three quarters of a second
  // the new bar read the old pub and told the host to Launch again.
  const seen = [];
  for (let i = 0; i < 12; i += 1) { await wait(250); const l = await line(); if (l.warn) seen.push(`${(i + 1) * 250}ms: ${l.text}`); }
  check('no moment while it moves tells the host to Launch again', seen.length === 0, seen[0] || '');
  const roomVenue = ((await (await fetch(`${BASE}/api/library`, { headers: H })).json()).running || {}).venue || '';
  const moved = await line();
  check('the room moved to the other pub', roomVenue === 'The Other Arms', roomVenue);
  check('and the line says this one, not "filed under" the old pub', /this one$/.test(moved.text) && !moved.warn, JSON.stringify(moved));

  console.log('\nWINNERS 1 AFTER THE TAP — the room has not moved');
  const keyBefore = await keyUp();
  check('the room carries the tap\'s key', Boolean(keyBefore));
  await p.evaluate(async () => {
    const w = document.querySelector('.winners-pick');
    w.value = '1';
    w.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
  });
  const changed = await line();
  check('the line says the night has changed and Launch applies it', /Launch to apply/.test(changed.text) && changed.warn, JSON.stringify(changed));
  check('and the room is exactly as the tap left it', (await keyUp()) === keyBefore);

  console.log('\nLAUNCH APPLIES IT');
  await p.evaluate(() => document.querySelector('.lb-go')?.click());
  await wait(3000);
  check('the room carries a new key', (await keyUp()) !== keyBefore);
  check('and, driven to its final, pays one winner', (await winnersAtFinal()) === 1);
  // A finished night is the running panel and no bar: Stop is the way back.
  await p.goto(`${BASE}/console`, { waitUntil: 'load' });
  await wait(2500);
  for (let i = 0; i < 3; i += 1) {
    const pressed = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((n) => /^(unlaunch|stop)$/i.test((n.textContent || '').trim())); if (!b) return false; b.click(); return true; });
    if (!pressed) break;
    await wait(1800);
  }
  await p.waitForSelector('.pack-card', { timeout: 20000 });
  await wait(800);
  const fresh = await line();
  check('a fresh console, nothing picked, names the night quietly', !fresh.warn && !/this one/.test(fresh.text), JSON.stringify(fresh));
  // Picked again with the SAME settings the room has, the line agrees.
  await p.evaluate(async () => {
    const w = document.querySelector('.winners-pick');
    w.value = '1';
    w.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('.pack-card[data-pack="madonna"]')?.click();
  });
  await wait(2500);
  const agreed = await line();
  check('picked again with the same settings, the line says this one', /this one$/.test(agreed.text) && !agreed.warn, JSON.stringify(agreed));

  console.log('\nTHE ROW EMPTIED TILE BY TILE IS NO NIGHT');
  for (let i = 0; i < 24; i += 1) {
    const done = await p.evaluate(() => { const x = document.querySelector('.lb-tile.is-pack .lb-tile-off'); if (!x) return true; x.click(); return false; });
    if (done) break;
    await wait(250);
  }
  await wait(600);
  const emptied = await line();
  const go = await p.$eval('.lb-go', (n) => n.textContent.trim());
  check('the line names the running night rather than calling an empty row "this one"', /On the big screen now: /.test(emptied.text) && !/this one/.test(emptied.text), JSON.stringify(emptied));
  check('and Launch asks for a pack', /Tap a pack/i.test(go), go);
  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the live line lied` : '\nThe live line tells the truth.');
process.exit(fails ? 1 : 0);
