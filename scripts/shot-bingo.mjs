#!/usr/bin/env node
/**
 * Screenshots of a bingo game: the console, the lobby, a card on a phone,
 * the call sheet on the big screen, and the caller's list.
 *
 * Also doubles as a working check that a card really is fixed to a phone —
 * it reloads a player page and compares the card before and after.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const KEY = process.env.HOST_KEY || 'test-key';
const OUT = path.resolve('screenshots');
fs.mkdirSync(OUT, { recursive: true });

const post = (action, body = {}) =>
  fetch(`${BASE}/api/host/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 40;
const shot = async (page, name) => {
  const file = path.join(OUT, `${n++}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('  saved', path.relative(process.cwd(), file));
};

const browser = await chromium.launch();

// ---- the console
const console_ = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await console_.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'domcontentloaded' });
await wait(900);
await shot(console_, 'console');

// ---- launch bingo
await post('launch', { game: 'bingo', packId: 'eighties-bingo' });
await wait(400);

const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await screen.goto(`${BASE}/screen`, { waitUntil: 'domcontentloaded' });
const host = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
await host.goto(`${BASE}/host?key=${KEY}`, { waitUntil: 'domcontentloaded' });

// ---- teams join
const phones = [];
for (const name of ['Sofa King Good', 'Quizteama Aguilera', 'The Quizzly Bears', 'Norfolk & Chance']) {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await phone.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await phone.fill('#nameInput', name);
  await phone.click('#joinBtn');
  await wait(200);
  phones.push({ name, page: phone });
}
await wait(700);
await shot(screen, 'bingo-lobby');

// ---- start and call a dozen tracks
await post('start');
const state = await fetch(`${BASE}/api/state?role=host&key=${KEY}`).then((r) => r.json());
const toCall = state.tracks.slice(0, 12);
for (const t of toCall) {
  await post('call', { trackId: t.id });
  await wait(60);
}
await wait(700);
await shot(screen, 'bingo-call-sheet');
await shot(host, 'bingo-caller');

// ---- a phone marks a few squares
const p0 = phones[0].page;
const cardBefore = await p0.$$eval('.bingo-cell .bt', (els) => els.map((e) => e.textContent));
const cells = await p0.$$('.bingo-cell');
for (const i of [0, 1, 2, 5]) await cells[i]?.click();
await wait(500);
await shot(p0, 'bingo-card');

// ---- ANTI-CHEAT CHECK: reload and confirm the identical card comes back
await p0.reload({ waitUntil: 'domcontentloaded' });
await wait(1200);
const cardAfter = await p0.$$eval('.bingo-cell .bt', (els) => els.map((e) => e.textContent));
const same = JSON.stringify(cardBefore) === JSON.stringify(cardAfter);
console.log(`\n  card identical after a full page reload: ${same ? 'YES' : 'NO'}`);
if (!same) {
  console.log('  before:', cardBefore.slice(0, 4));
  console.log('  after: ', cardAfter.slice(0, 4));
}

// ---- a false alarm, then a real win
const marks = await p0.$$('.bingo-cell');
for (let i = 0; i < 4; i++) await marks[i]?.click();
await wait(300);
const callBtn = await p0.$('#bingoCall');
if (callBtn && !(await callBtn.isDisabled())) {
  await callBtn.click();
  await wait(700);
  await shot(p0, 'bingo-false-alarm');
}

await browser.close();
console.log('\ndone');
process.exit(same ? 0 : 1);
