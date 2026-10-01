#!/usr/bin/env node
/**
 * CLEAR THE BAR — one press empties Tonight, and nothing in the room moves.
 *
 *   node scripts/clear-the-bar.mjs
 *
 * The host, 1 October 2026: *"I need to be able to just clear the launch bar
 * and do a new game even if I already played one."* Emptying it meant a × on
 * every tile — up to eighteen of them. His picks: **the bar only** (the game on
 * the big screen stays until the next Launch, so a mis-tap costs nothing in
 * front of the room), and **beside the tiles**, away from Unlaunch, which acts
 * on the big screen.
 *
 * Driven in a real browser: a quiz on the big screen with a phone in it, a
 * card bingo added beside it, a prize typed — Clear — then a different game in
 * and Launch, which must still work and land on the same join code.
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: B, stop } = await startApp({
  key: 'clear-the-bar',
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
  const running = async () => ((await (await fetch(`${B}/api/library`, { headers: H })).json()).running || {});
  const mk = await (await fetch(`${B}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Crown' }) })).json();
  const venue = (mk.customers || []).find((c) => c.name === 'The Crown');
  await fetch(`${B}/api/invoices/customers/${encodeURIComponent(venue.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint', 'A half', 'Crisps'] }) });

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(`${B}/console`, { waitUntil: 'load' });
  await page.waitForSelector('.pack-card', { timeout: 20000 });
  await page.evaluate(async () => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes('The Crown'))?.click();
  });
  await wait(600);
  const tiles = () => page.evaluate(() => [...document.querySelectorAll('.lb-tile.is-pack, .lb-tile:not(.mix-drop):not(.lb-doors)')].filter((t) => t.getClientRects().length && t.querySelector('.lb-tile-off')).length);
  const clearBtn = () => page.evaluate(() => { const b = document.querySelector('.lb-clear'); if (!b || !b.getClientRects().length) return null; const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), off: b.disabled, h: Math.round(r.height) }; });

  console.log('\nAN EMPTY BAR');
  const idle = await clearBtn();
  check('Clear is there, present and inert, saying why', idle && idle.off && /Nothing to clear/.test(idle.text), JSON.stringify(idle));

  console.log('\nA QUIZ ON THE BIG SCREEN, A PHONE IN IT, A CARD BINGO BESIDE IT');
  await page.evaluate(() => document.querySelector('.pack-card[data-pack="2006"]')?.click());
  await wait(1800);
  const first = await running();
  check('tapping the quiz put it on the big screen', first.packId === '2006' && first.launched === true, JSON.stringify(first).slice(0, 80));
  const joined = await (await fetch(`${B}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Dave', joinCode: first.joinCode }) })).json();
  await page.evaluate(() => document.querySelector('[data-tab="cards"]')?.click());
  await wait(700);
  await page.evaluate(() => document.querySelector('.pack-card[data-pack]')?.click());
  await wait(1300);
  const before = await tiles();
  check('the bar holds the quiz rounds and the deck', before >= 4, `${before} tiles`);
  const ready = await clearBtn();
  check('Clear is live, at the touch floor', ready && !ready.off && /Clear the bar/.test(ready.text) && ready.h >= 44, JSON.stringify(ready));

  console.log('\nCLEAR');
  await page.evaluate(() => document.querySelector('.lb-clear')?.click());
  await wait(900);
  check('one press empties every tile', (await tiles()) === 0, `${await tiles()} tiles left`);
  const go = await page.evaluate(() => { const b = document.querySelector('.lb-go'); return { text: b.textContent.trim(), off: b.disabled || b.classList.contains('hollow') }; });
  check('Launch goes hollow, asking for a game', go.off, JSON.stringify(go));
  const where = await page.evaluate(() => document.querySelector('.lb-where')?.textContent.trim());
  check('the pub stays picked', /The Crown/.test(where), where);
  const after = await running();
  check('AND THE BIG SCREEN IS UNTOUCHED — the quiz is still up', after.packId === '2006' && after.launched === true, JSON.stringify(after).slice(0, 80));
  const dave = await (await fetch(`${B}/api/state?role=player&playerId=${joined.id}&token=${joined.token}&g=${first.joinCode}`)).json();
  check('and the phone in it is still in it', !dave.rejoin && !dave.kicked, JSON.stringify(dave).slice(0, 80));
  const idleAgain = await clearBtn();
  check('Clear says there is nothing left to clear', idleAgain && idleAgain.off, JSON.stringify(idleAgain));

  console.log('\nA NEW GAME AFTER IT');
  await page.evaluate(() => document.querySelector('[data-tab="bingo"]')?.click());
  await wait(700);
  await page.evaluate(() => document.querySelector('.pack-card[data-pack="mbc-6a"]')?.click());
  await wait(1300);
  check('a music bingo goes in on its own', (await tiles()) === 1, `${await tiles()} tiles`);
  const sent = page.waitForRequest((r) => /\/api\/host\/launch(Order)?$/.test(r.url()) && r.method() === 'POST', { timeout: 8000 }).then((r) => r.postDataJSON(), () => null);
  await page.evaluate(() => document.querySelector('.lb-go')?.click());
  const body = await sent;
  await wait(1500);
  check('Launch sends the music bingo alone — nothing cleared came back', body && body.game === 'bingo' && body.packId === 'mbc-6a' && !body.segments, JSON.stringify(body || {}).slice(0, 100));
  const next = await running();
  check('the room is on it, same join code', next.packId === 'mbc-6a' && next.joinCode === first.joinCode, JSON.stringify(next).slice(0, 80));
  check('nothing threw', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — Clear does not do what it says` : '\nClear empties the bar in one press, and the room does not move until Launch.');
process.exit(fails ? 1 : 0);
