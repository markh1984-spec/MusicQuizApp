#!/usr/bin/env node
/**
 * Screenshots of rounds 2 and 3 specifically, including the zoom part-way
 * through and the host's private cue panel. Used to check those two rounds
 * without playing thirty questions by hand.
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

const browser = await chromium.launch();
const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const host = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });

await post('resetAll');
await screen.goto(`${BASE}/screen`, { waitUntil: 'domcontentloaded' });
await host.goto(`${BASE}/host?key=${KEY}`, { waitUntil: 'domcontentloaded' });

// A few teams so the tallies are not empty.
for (const name of ['Sofa King Good', 'Quizteama Aguilera', 'The Quizzly Bears']) {
  const phone = await browser.newPage();
  await phone.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await phone.fill('#nameInput', name);
  await phone.click('#joinBtn');
}
await wait(400);

// ---- round 2: the zoom, early and late
await post('goto', { roundIndex: 1, questionIndex: 0 });
await wait(1200);
await screen.screenshot({ path: path.join(OUT, '20-round2-zoomed-in.png') });
await host.screenshot({ path: path.join(OUT, '21-round2-host.png') });

await wait(9000);
await screen.screenshot({ path: path.join(OUT, '22-round2-pulling-back.png') });

await post('reveal');
await wait(700);
await screen.screenshot({ path: path.join(OUT, '23-round2-reveal.png') });

// ---- round 3: the screen must give nothing away, the host must have the cue
await post('goto', { roundIndex: 2, questionIndex: 0 });
await wait(1000);
await screen.screenshot({ path: path.join(OUT, '24-round3-screen.png') });
await host.screenshot({ path: path.join(OUT, '25-round3-host-cue.png') });

// The round intro is where the host reads the cue ahead of time.
await post('goto', { roundIndex: 2, questionIndex: 4 });
await post('reveal');
await wait(600);
await host.screenshot({ path: path.join(OUT, '26-round3-host-next-cue.png') });

await browser.close();
console.log('done');
