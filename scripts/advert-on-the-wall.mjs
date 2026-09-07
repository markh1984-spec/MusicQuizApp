#!/usr/bin/env node
/**
 * A CORRECTED SLIDE REACHES THE PROJECTOR — the money feature, checked on a
 * real wall.
 *
 * ---
 *
 * Rule 9 is explicit that an advert's words are looked up when a VIEW is built
 * rather than copied into state, *"so correcting a price on a venue's slide
 * changes the projector without taking it down and putting it back"*. The
 * lookup did exactly that for months and the projector refused to redraw: the
 * card key was `ad:${s.advert.heading}`, so a corrected price arrived on the
 * wire and never reached the wall, and two of a venue's slides that happen to
 * share a heading did not switch at all.
 *
 * **Nothing in this repo could see it.** The engine tests assert the payload
 * carries the right words — and they were right, it did. Whether anybody DREW
 * them is a different question, and it is the same gap that let the lobby
 * game's scoreboard sit in a payload nobody read for as long as the feature
 * existed.
 *
 * So this drives the real thing: a real server with a real advert pack on
 * disk, a real projector page, an advert put up through the host route, the
 * price corrected on disk underneath it, and then the WALL read back.
 *
 * **The re-push is a host action that has nothing to do with adverts.** Taking
 * the slide down and putting it back would redraw whatever the key was, which
 * is precisely the thing rule 9 says must not be necessary — so the check
 * would pass on the broken build.
 *
 *   node scripts/advert-on-the-wall.mjs
 *
 * Its own port, its own DATA_DIR, both cleaned up on the way out.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

import { startApp } from './helpers/live-app.mjs';

const KEY = 'advertwall';
const VENUE = 'The Crown';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A venue's advert set, with one slide whose body is the thing under test. */
const slideSet = (body) => ({
  id: 'crown',
  venue: VENUE,
  slides: [{ id: 's1', heading: 'Pint of the week', body }],
});

let dataDir = '';
const { base: BASE, stop } = await startApp({
  key: KEY,
  seed: (dir) => {
    dataDir = dir;
    const adverts = path.join(dir, 'adverts');
    fs.mkdirSync(adverts, { recursive: true });
    fs.writeFileSync(path.join(adverts, 'crown.json'),
      JSON.stringify(slideSet('Four pounds fifty'), null, 2));
  },
});

let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${want}\n        got    ${got}`);
};

let browser;
try {
  const post = (action, body) => fetch(`${BASE}/api/host/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify(body || {}),
  }).then((r) => r.json().then((json) => ({ status: r.status, json })));

  const library = await (await fetch(`${BASE}/api/library`, {
    headers: { 'X-Host-Key': KEY },
  })).json();
  const pack = (library.quizzes || [])[0];
  if (!pack) throw new Error('no quiz pack to launch');

  console.log('\nA CORRECTED SLIDE ON A REAL PROJECTOR\n');

  const launched = await post('launch', { game: 'quiz', packId: pack.id, venue: VENUE });
  check('a night is running at the venue', launched.status, 200);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`${BASE}/screen`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const wall = async () => (await page.evaluate(() =>
    document.getElementById('card')?.innerText || '')).replace(/\s+/g, ' ').trim();

  const up = await post('advert', { packId: 'crown', slideId: 's1' });
  check('the slide goes up', up.status, 200);
  await page.waitForTimeout(1200);
  check('and the wall shows its price', (await wall()).includes('Four pounds fifty'), true);

  // The venue rings up: the price is wrong. It is corrected where it lives.
  fs.writeFileSync(path.join(dataDir, 'adverts', 'crown.json'),
    JSON.stringify(slideSet('Three pounds ninety'), null, 2));
  await post('startsIn', { minutes: 5 });
  await page.waitForTimeout(1500);

  const now = await wall();
  check('the correction reaches the wall', now.includes('Three pounds ninety'), true);
  check('and the old price has gone', now.includes('Four pounds fifty'), false);
  check('nothing threw', errors.join(' | ') || 'none', 'none');

  console.log(failures
    ? `\n${failures} failed — a venue's correction does not reach the projector.\n`
    : '\nA corrected slide reaches the wall without being taken down.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* already gone */ }
  stop();
}
