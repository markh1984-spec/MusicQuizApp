#!/usr/bin/env node
/**
 * THE PHOTO SCREEN — a code and the photographs, and nothing else.
 *
 * ---
 *
 * *"I need a separate DJ QR code where literally its only function is to
 * gather photos, needs specifically to do nothing else other than a QR code
 * and a bit where the uploaded photos display but no quiz explainer on this
 * one because there is no quiz."*
 *
 * `/wall` was already the second screen, and on a night WITH a quiz its code
 * is the JOIN code — a joined phone carries a camera into the rest of the
 * evening, so its second step reads **Type in a name**. On a karaoke night
 * that is three instructions about photographs ending at a box asking for a
 * team name, which is the exact fault the current wording was written to fix.
 *
 * So `?photos=only` swaps the code for the SNAP one — the identity-free
 * camera, no player, no caption, no row on a board — and drops the step. This
 * drives both, from a browser that has never seen the app, and asserts the
 * three things that make it what it is: the right destination, no quiz
 * wording, and rule 1 still structural.
 *
 *   node scripts/photo-screen.mjs
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  — ${d}` : ''}`); };

const { base: BASE, stop } = await startApp({
  key: 'photo-screen',
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'o@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});

let browser;
try {
  browser = await chromium.launch();
  const con = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await con.goto(`${BASE}/login`, { waitUntil: 'load' });
  await con.fill('input[type=email]', 'qm@example.com');
  await con.fill('input[type=password]', 'quizmaster passphrase');
  await con.evaluate(() => document.querySelector('form')?.requestSubmit());
  await con.waitForTimeout(2500);
  await con.evaluate(async () => {
    const H = { 'Content-Type': 'application/json' };
    const mk = await fetch('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Karaoke Arms' }) });
    const c = ((await mk.json()).customers || []).find((x) => /Karaoke/.test(x.name));
    await fetch(`/api/invoices/customers/${encodeURIComponent(c.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint'], usualNight: 'thu' }) });
  });
  const code = await con.evaluate(async () => (await (await fetch('/api/library')).json()).joinCode || '');
  check('the room has a code to hand round', Boolean(code), code);

  /*
   * A SPARE LAPTOP: a fresh context, so no cookie and no host key — the whole
   * reason this page can run on the second HDMI at all.
   */
  const spare = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const open = async (url) => {
    const pg = await spare.newPage();
    const errs = [];
    pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForTimeout(1800);
    return { pg, errs };
  };

  console.log('\nTHE ORDINARY WALL — a quiz night, so the code is the JOIN code');
  const w = await open(`${BASE}/wall?g=${encodeURIComponent(code)}`);
  const wallText = (await w.pg.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  check('it says how to send a photo', /photos on the screen/i.test(wallText), wallText.slice(0, 70));
  check('and it asks for a name, because joining is what its code does', /type in a name/i.test(wallText));

  console.log('\nTHE PHOTO SCREEN — no quiz, so no name and no join');
  const s = await open(`${BASE}/wall?g=${encodeURIComponent(code)}&photos=only`);
  const text = (await s.pg.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  check('it still says how to send a photo', /photos on the screen/i.test(text), text.slice(0, 70));
  check('NO name step — there is no game to join', !/type in a name/i.test(text), text.slice(0, 120));
  /*
   * THE ASK PANEL, NOT THE WHOLE BODY — the brand is "…'s Quizporium", which
   * contains the word and is not quiz WORDING. A guard that reads the page
   * furniture as content fails on somebody's business name, which is the kind
   * of false finding that teaches you to skim the next one.
   */
  const ask = (await s.pg.$eval('.wall-ask', (n) => n.innerText)).replace(/\s+/g, ' ');
  check('and the panel says nothing about a quiz, a team or a score',
    !/quiz|team|score|leaderboard|round/i.test(ask), ask.slice(0, 160));
  const qr = await s.pg.$eval('.wall-qr img, .qr-panel img', (n) => n.getAttribute('src'));
  check('its code points at /snap — the camera with no identity',
    /snap/.test(decodeURIComponent(qr || '')), decodeURIComponent(qr || '').slice(0, 90));
  const shown = await s.pg.$eval('#wallUrl', (n) => n.textContent.trim()).catch(() => '');
  check('and the address printed under it is the SAME destination', /\/snap/.test(shown), shown);
  check('no console errors', s.errs.length === 0, s.errs.join(' | '));
  if (process.env.SHOT_DIR) {
    const fs = await import('node:fs');
    fs.mkdirSync(process.env.SHOT_DIR, { recursive: true });
    await s.pg.setViewportSize({ width: 1280, height: 720 });
    await s.pg.waitForTimeout(800);
    await s.pg.screenshot({ path: path.join(process.env.SHOT_DIR, 'photo-screen.png') });
    await w.pg.setViewportSize({ width: 1280, height: 720 });
    await w.pg.waitForTimeout(800);
    await w.pg.screenshot({ path: path.join(process.env.SHOT_DIR, 'ordinary-wall.png') });
  }

  /*
   * RULE 1, SWEPT RATHER THAN CHECKED — the payload this page receives may not
   * carry the game, however the page is asked for. A flag that quietly opened
   * a door into the quiz would be worth more than the wording it changed.
   */
  console.log('\nRULE 1 — the payload still says nothing about the game');
  const payload = await s.pg.evaluate(async () => {
    const g = new URLSearchParams(location.search).get('g');
    return (await (await fetch(`/api/state?role=wall&g=${encodeURIComponent(g)}`)).json());
  });
  const banned = ['question', 'options', 'answer', 'correct', 'reveal', 'scores', 'leaderboard', 'players', 'teams', 'phase', 'round'];
  const leaked = banned.filter((k) => JSON.stringify(payload).toLowerCase().includes(`"${k}"`));
  check('nothing about the quiz is on the wire', leaked.length === 0, leaked.join(', '));
  check('it carries only what a photo wall needs', Object.keys(payload).join(',').length < 200, Object.keys(payload).join(','));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED` : '\nThe photo screen gathers photographs and does nothing else.');
process.exit(fails ? 1 : 0);
