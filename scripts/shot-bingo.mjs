#!/usr/bin/env node
/**
 * Screenshots of a bingo game: the console, the lobby, a card on a phone,
 * the call sheet on the big screen, and the caller's list.
 *
 * Also doubles as a working check that a card really is fixed to a phone —
 * it reloads a player page and compares the card before and after.
 *
 * ---
 *
 * **IT STARTS ITS OWN APP.** It took `http://localhost:3000` on trust, so
 * running it the way `CLAUDE.md` lists it (`node scripts/shot-bingo.mjs`, no
 * server up) died on `ERR_CONNECTION_REFUSED` — and with a server up it drove
 * whatever was already listening, with its data. Both halves are the fault
 * `helpers/live-app.mjs` exists for: it asks the OS for a free port, hands the
 * app its own `DATA_DIR` and a COPY of the catalogue, and stops it whatever
 * happens. `BASE` still overrides, for driving a deployment on purpose.
 *
 * **AND THE EXIT CODE WAS A `ReferenceError`.** The last line read
 * `process.exit(same ? 0 : 1)` while `same` is a `const` declared inside the
 * `else` block above it — so the script THREW on its way out, on every run,
 * including every passing one. `node --check` cannot see it: the file parses,
 * and the fault only exists when the line runs. Same class as the import that
 * shipped a broken Launch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = process.env.HOST_KEY || 'shot-bingo';
const started = process.env.BASE ? null : await startApp({ key: KEY });
const BASE = process.env.BASE || started.base;
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

/*
 * ---- ANTI-CHEAT CHECK: reload and confirm the identical card comes back
 *
 * **THIS IS RULE 6'S ONLY GUARD IN A BROWSER, AND IT USED TO PASS ON
 * NOTHING.** It read two lists of card squares and compared them; with the
 * selector matching nothing both were `[]`, `JSON.stringify` made them equal,
 * and it printed *"card identical after a full page reload: YES"*. Renaming
 * one class in `play-bingo.js` was enough — and it never set an exit code
 * either, so a real NO also came back as a pass to anything running it.
 *
 * The fourth sighting in this repo of "it is in the document" being confused
 * with "somebody can see it": count what you found, and say so.
 */
const EXPECT_LEAST = 9;  // the smallest card this app deals is 3 x 3
let same = false;
if (cardBefore.length < EXPECT_LEAST) {
  console.log(`\n  CARD CHECK CANNOT RUN — found ${cardBefore.length} squares before the reload.`);
  console.log('  The selector ".bingo-cell .bt" matches nothing, so this check would compare');
  console.log('  two empty lists and call them identical. Rule 6 has no browser guard until');
  console.log('  this is pointed at the real markup again.');
  process.exitCode = 1;
} else {
  await p0.reload({ waitUntil: 'domcontentloaded' });
  await wait(1200);
  const cardAfter = await p0.$$eval('.bingo-cell .bt', (els) => els.map((e) => e.textContent));
  same = cardAfter.length === cardBefore.length
    && JSON.stringify(cardBefore) === JSON.stringify(cardAfter);
  console.log(`\n  card identical after a full page reload: ${same ? 'YES' : 'NO'} (${cardBefore.length} squares)`);
  if (!same) {
    console.log('  before:', cardBefore.slice(0, 4));
    console.log('  after: ', cardAfter.slice(0, 4));
    // A CARD THAT CHANGED IS THE ONE THING THIS SCRIPT MUST NOT SHRUG AT: it
    // is the whole of rule 6, and the host asked for it by name to stop
    // cheating.
    process.exitCode = 1;
  }
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
if (started) started.stop();
console.log('\ndone');
process.exit(same ? 0 : 1);
