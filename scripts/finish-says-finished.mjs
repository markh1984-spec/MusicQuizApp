#!/usr/bin/env node
/**
 * THE BIG BUTTON SAYS THE GAME HAS FINISHED, once it has.
 *
 *   node scripts/finish-says-finished.mjs
 *
 * Off a live night, 1 October 2026: *"the orange bar doesn't work but the red
 * button does after two presses."* It did work. The press finished the game —
 * the status line read "Bingo — finished" — but the big button went on saying
 * *Finish the game*, lit, so a host with a room waiting saw nothing happen and
 * reached for the red Finish below it. Every guard had pressed it over HTTP
 * and read the phase; none looked at what the button said afterwards.
 *
 * This plays a real game to its prize on both bingo engines' screens — music
 * bingo and card bingo — approves the claim on the control view, presses the
 * orange button in a real browser and reads the button back.
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: B, stop } = await startApp({
  key: 'finish-says-finished',
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
  const J = async (route, opts = {}) => { const r = await fetch(B + route, opts); let body; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };
  const host = (a, body = {}) => J(`/api/host/${a}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const post = (route, body) => J(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const mk = await J('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Crown' }) });
  const venue = (mk.body.customers || []).find((c) => c.name === 'The Crown');
  await J(`/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint', 'A half'] }) });

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]);
  const errors = [];

  for (const game of ['bingo', 'cards']) {
    console.log(`\n${game === 'cards' ? 'CARD BINGO' : 'MUSIC BINGO'}`);
    const go = await host('launch', game === 'cards'
      ? { game: 'cards', packId: 'deck', replace: true, venue: 'The Crown', breakPlan: {} }
      : { game: 'bingo', packId: 'mbc-6a', replace: true, venue: 'The Crown', breakPlan: {} });
    check('it launches', go.status === 200, String(go.status));
    const code = (await J('/api/library', { headers: H })).body.joinCode;
    const phones = [];
    for (const name of ['Dave', 'Sue', 'Table Six']) phones.push((await post('/api/join', { name, joinCode: code })).body);

    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    await page.goto(`${B}/host`, { waitUntil: 'load' });
    await wait(1500);
    await page.click('button.primary:not(#drawNext)');   // Start
    await wait(1000);

    const mine = async (p) => (await J(`/api/state?role=player&playerId=${p.id}&token=${p.token}&g=${code}`)).body;
    const tracks = (((await J('/api/state?role=host', { headers: H })).body || {}).tracks || []).map((t) => t.id);
    let claimed = false;
    for (let i = 0; i < 60 && !claimed; i += 1) {
      if (game === 'cards') await host('draw'); else await host('call', { trackId: tracks[i] });
      for (const p of phones) {
        for (const [index, sq] of ((await mine(p)).card || []).entries()) {
          if (sq && sq.called && !sq.marked) await post('/api/mark', { playerId: p.id, token: p.token, index, marked: true, joinCode: code });
        }
        if ((await mine(p)).canClaim) { await post('/api/claim', { playerId: p.id, token: p.token, joinCode: code }); claimed = true; break; }
      }
    }
    check('somebody claims', claimed);
    await wait(1200);
    const approve = await page.$('button:has-text("Approve")');
    if (approve) { await approve.click(); await wait(1500); }
    const before = await page.$eval('button.primary:not(#drawNext)', (b) => b.textContent.trim());
    check('the big button offers to finish the game', /^Finish the game$/.test(before), before);

    await page.click('button.primary:not(#drawNext)');
    await wait(1500);
    const phase = ((await J('/api/state?role=host', { headers: H })).body || {}).phase;
    check('the press finished it', phase === 'finished', phase);
    const after = await page.$eval('button.primary:not(#drawNext)', (b) => ({ text: b.textContent.trim(), off: b.disabled }));
    check('AND THE BUTTON SAYS SO — it no longer offers to finish it', !/Finish the game/.test(after.text) && /finished/i.test(after.text), JSON.stringify(after));
    check('and it is not lit for another press', after.off === true, JSON.stringify(after));
    const red = await page.$$eval('button', (bs) => bs.filter((b) => b.getClientRects().length && b.textContent.trim() === 'Finish').map((b) => b.disabled));
    check('the red Finish is inert too, the game being over', red.length === 1 && red[0] === true, JSON.stringify(red));
    await page.close();
  }
  check('nothing threw', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the control view does not say the game finished` : '\nThe big button says the game has finished, on both bingo games.');
process.exit(fails ? 1 : 0);
