#!/usr/bin/env node
/**
 * WHAT YOU TYPE IN THE PRIZE TABLE IS WHAT THE ROOM PLAYS FOR.
 *
 * ---
 *
 * Found by sweeping the launch path the day after the per-game prize table
 * was built, and it had shipped:
 *
 *   - the bar read **TYPED 1, TYPED 2, TYPED 3** and the room played for the
 *     VENUE's list — the console and the big screen disagreeing, silently,
 *     which the launch bar has a standing rule against;
 *   - and with no venue picked at all, the typed drinks still OPENED the
 *     launch gate (`noPrizesReason()` accepts what was typed) and then went
 *     nowhere, so the night launched with an empty list and nobody to pay.
 *     That is precisely the failure the table was built to prevent.
 *
 * THE CAUSE IS THE BURST, WHICH IS WHY IT HID. A quiz pack arrives as one tile
 * per ROUND, so `lbSlots` exists on an ordinary one-pack night — the table
 * therefore wrote the part's list onto `lbSlots[0]`, while `simpleNight()`
 * collapsed the row back and the launch read `night.*`. Reading one place and
 * writing another.
 *
 * TWO GUARDS MISSED IT AND BOTH FOR THE SAME REASON — they were not on this
 * path. The drive that shipped the feature used a quiz AND a bingo, where each
 * part's list travels on its own segment; `bar-reaches-the-room.mjs` picks a
 * BINGO pack, which has no rounds and so never bursts. Only a quiz on its own
 * takes the road the bug was on, and that is most nights.
 *
 *   node scripts/typed-prizes-reach-the-room.mjs
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  — ${d}` : ''}`); };
const VENUE = 'The Typed Arms';
const VENUE_LIST = ['VENUE ONE', 'VENUE TWO', 'VENUE THREE'];
const TYPED = ['A PINT OF THE GOOD STUFF', 'A LARGE WINE', 'A PACKET OF CRISPS'];

const { base: BASE, stop } = await startApp({
  key: 'typed-prizes',
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
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  p.on('dialog', (d) => d.accept());
  const bodies = [];
  p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/host\/launch/.test(r.url())) bodies.push(r.postData() || ''); });

  await p.goto(`${BASE}/login`, { waitUntil: 'load' });
  await p.fill('input[type=email]', 'qm@example.com');
  await p.fill('input[type=password]', 'quizmaster passphrase');
  await p.evaluate(() => document.querySelector('form')?.requestSubmit());
  await p.waitForTimeout(2500);
  await p.evaluate(async ({ venue, list }) => {
    const H = { 'Content-Type': 'application/json' };
    const mk = await fetch('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: venue }) });
    const c = ((await mk.json()).customers || []).find((x) => x.name === venue);
    await fetch(`/api/invoices/customers/${encodeURIComponent(c.id)}/rewards`, { method: 'PUT', headers: H,
      body: JSON.stringify({ rewards: list, usualNight: 'thu' }) });
  }, { venue: VENUE, list: VENUE_LIST });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.pack-card', { timeout: 20000 });
  await p.evaluate(async (v) => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes(v))?.click();
  }, VENUE);
  await p.waitForTimeout(900);

  console.log('\nA QUIZ ON ITS OWN — the pack bursts, so the row is slots and the launch is simple');
  const card = await p.$('.pack-card[data-pack="2000s-2010s-mixed"]') || await p.$('.pack-card[data-pack]');
  const box = await card.boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(1300);
  const tiles = await p.$$eval('.lb-tile.is-pack', (n) => n.length);
  check('the pack burst into a tile per round', tiles >= 1, `${tiles} tiles`);
  const go = await p.$eval('.lb-go', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  check('Launch names one pack, so this is the SIMPLE path', !/\+/.test(go), go);

  console.log('\nTYPE OVER THE VENUE’S LIST');
  const out = await p.evaluate(async (want) => {
    const head = document.querySelector('.lb-pz-head');
    if (!head) return { ok: false, why: 'no prize table' };
    if (head.getAttribute('aria-expanded') !== 'true') head.click();
    await new Promise((r) => setTimeout(r, 400));
    const boxes = [...document.querySelectorAll('.lb-pz-in')];
    if (!boxes.length) return { ok: false, why: 'no boxes' };
    const n = Math.min(boxes.length, want.length);
    for (let i = 0; i < n; i += 1) {
      boxes[i].value = want[i];
      boxes[i].dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('.lb-pz-head').click();
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, used: n, ledger: document.querySelector('.lb-prizes').innerText.replace(/\s+/g, ' ').trim() };
  }, TYPED);
  check(`the table takes it${out.why ? ` (${out.why})` : ''}`, out.ok, true);
  const want = out.ok ? TYPED.slice(0, out.used) : [];
  check('the shut ledger reads back what was typed', want.length > 0 && want.every((t) => out.ledger.includes(t)), out.ledger.slice(0, 110));
  check('and the venue’s own words are GONE from it', !VENUE_LIST.some((v) => out.ledger.includes(v)), out.ledger.slice(0, 110));

  console.log('\nLAUNCH');
  bodies.length = 0;
  await p.locator('.lb-go').click();
  await p.waitForTimeout(3000);
  const sent = bodies.length ? JSON.parse(bodies[bodies.length - 1]) : {};
  /* Wherever this night's shape puts the list — the night-wide field on a
     one-game launch, a segment's own on a mixed one. Asserting the FIELD would
     pin the shape rather than the promise. */
  const onWire = JSON.stringify(sent.rewards || (sent.segments || []).map((x) => x.rewards || []));
  check('the drinks it SENT are the drinks it SHOWED', want.every((t) => onWire.includes(t)), onWire.slice(0, 120));
  const live = await p.evaluate(async () => {
    const lib = await (await fetch('/api/library')).json();
    const code = lib.joinCode || '';
    return (await (await fetch(`/api/state?role=host&g=${encodeURIComponent(code)}`)).json()).rewards || [];
  });
  check('and the ROOM is playing for them', want.every((t) => JSON.stringify(live).includes(t)), JSON.stringify(live));
  check('and NOT for the venue’s list', !VENUE_LIST.some((v) => JSON.stringify(live).includes(v)), JSON.stringify(live));
  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the bar and the room disagree about the drinks` : '\nWhat the bar says it pays is what the room plays for.');
process.exit(fails ? 1 : 0);
