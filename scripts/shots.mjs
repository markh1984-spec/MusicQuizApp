#!/usr/bin/env node
/**
 * See the screens without running a whole quiz by hand.
 *
 * Drives a headless browser through a scripted quiz — a few teams join, they
 * answer at different speeds, the host advances — and saves a screenshot of
 * every screen at every stage. Use it to check a design change, or to show
 * somebody what the night looks like.
 *
 *   node scripts/shots.mjs                  # against http://localhost:3000
 *   node scripts/shots.mjs --url https://…  # against a deployment
 *   node scripts/shots.mjs --out ./shots    # where to write the PNGs
 *
 * Needs Playwright available (`npm i -g playwright`). It is not a dependency
 * of the app itself — nothing here ships to the venue.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const c of candidates) {
    try { return require(c); } catch { /* try the next */ }
  }
  console.error('Playwright is not installed. Run:  npm i -g playwright');
  process.exit(1);
}

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf('--url', 'http://localhost:3000').replace(/\/+$/, '');
const OUT = path.resolve(argOf('--out', 'screenshots'));
const KEY = argOf('--key', process.env.HOST_KEY || '');
const TEAMS = ['Sofa King Good', 'Quizteama Aguilera', 'The Quizzly Bears', 'Norfolk & Chance'];

const { chromium } = loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let shotIndex = 0;

async function shot(page, name) {
  const file = path.join(OUT, `${String(++shotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('  saved', path.relative(process.cwd(), file));
}

async function hostAction(action, body = {}) {
  const res = await fetch(`${BASE}/api/host/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${action} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Where the game actually is, according to the server.
 *
 * The script used to assume it knew: press start, and you are on the round
 * intro. Then the rules slide was added in front of round one and every shot
 * after it was one step behind — "screen-question" was a picture of the round
 * intro for months, and nothing said so. A screenshot tool that quietly lies
 * is worse than no screenshot tool, so it asks now instead of assuming.
 */
async function phase() {
  const res = await fetch(`${BASE}/health`);
  return (await res.json()).phase;
}

/** Press onwards until the server says we have arrived. */
async function advanceTo(wanted, limit = 12) {
  for (let i = 0; i < limit; i++) {
    if (await phase() === wanted) return;
    await hostAction('next');
    await wait(120);
  }
  throw new Error(`never reached "${wanted}" — stuck on "${await phase()}". Has a new slide been added?`);
}

/** Take the shot, and refuse to file it under a name that is not true. */
async function shotAt(page, name, wanted) {
  const now = await phase();
  if (now !== wanted) throw new Error(`about to save "${name}" while the game is on "${now}", not "${wanted}"`);
  await shot(page, name);
}

async function main() {
  if (!KEY) {
    console.error('Give me the host key:  node scripts/shots.mjs --key <key>   (or set HOST_KEY)');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const screen = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const phones = [];

  console.log(`\nDriving a demo quiz at ${BASE}\n`);

  await hostAction('resetAll');
  // Launch a known pack rather than photographing whatever happened to be
  // loaded — otherwise the shots are of a different quiz every time, and the
  // scripted answers below land on questions they were not written for.
  const quizzes = await (await fetch(`${BASE}/api/quizzes?key=${encodeURIComponent(KEY)}`)).json();
  const wanted = argOf('--quiz', (quizzes.quizzes[0] || {}).id);
  if (wanted) await hostAction('launch', { game: 'quiz', packId: wanted });
  await screen.goto(`${BASE}/screen`, { waitUntil: 'domcontentloaded' });

  // Teams join.
  for (const name of TEAMS) {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await phone.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
    await phone.fill('#nameInput', name);
    await phone.click('#joinBtn');
    await phone.waitForTimeout(250);
    phones.push({ name, page: phone });
  }
  await screen.waitForTimeout(600);
  await shot(screen, 'screen-lobby');
  await shot(phones[0].page, 'phone-waiting');

  const host = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  await host.goto(`${BASE}/host?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded' });
  await host.waitForTimeout(400);
  await shot(host, 'host-lobby');

  // The rules slide, which is the first thing every quiz shows.
  await hostAction('start');
  await screen.waitForTimeout(500);
  await shotAt(screen, 'screen-rules', 'rules');

  // Round intro.
  await advanceTo('round_intro');
  await screen.waitForTimeout(500);
  await shotAt(screen, 'screen-round-intro', 'round_intro');

  // First question: teams answer at staggered speeds so the reveal has a
  // proper "fastest finger" line and a spread of scores.
  await advanceTo('question');
  await screen.waitForTimeout(1200);
  await shotAt(screen, 'screen-question', 'question');
  await shot(phones[0].page, 'phone-question');
  await shot(host, 'host-question');

  await answerAll(phones, [0, 0, 2, 0], [300, 900, 1500, 2600]);
  await screen.waitForTimeout(500);
  await shotAt(screen, 'screen-question-answers-in', 'question');

  await hostAction('reveal');
  await screen.waitForTimeout(700);
  await shotAt(screen, 'screen-reveal', 'reveal');
  await shot(phones[0].page, 'phone-reveal-correct');
  await shot(phones[2].page, 'phone-reveal-wrong');
  await shot(host, 'host-reveal');

  // Play out a few more so the leaderboard has something to show.
  for (let i = 1; i < 4; i++) {
    await hostAction('next');
    await screen.waitForTimeout(400);
    await answerAll(phones, randomPicks(i), [400 + i * 120, 800, 1400, 2200]);
    await hostAction('reveal');
    await screen.waitForTimeout(300);
  }

  // Jump to the end of the round for the board.
  await hostAction('goto', { roundIndex: 0, questionIndex: 9 });
  await screen.waitForTimeout(300);
  await answerAll(phones, [3, 3, 1, 3], [500, 1100, 1700, 2400]);
  await hostAction('reveal');
  await screen.waitForTimeout(400);
  await advanceTo('round_board');
  await screen.waitForTimeout(900);
  await shotAt(screen, 'screen-round-board', 'round_board');
  await shot(phones[0].page, 'phone-round-board');

  // finish() jumps to the end from wherever the quiz is, so this works whether
  // the loaded pack has one round or five. Pressing next until something looks
  // like the end only worked on a one-round quiz, and failed loudly on a two.
  await hostAction('finish');
  await screen.waitForTimeout(900);
  await shotAt(screen, 'screen-winner', 'final');
  await shot(host, 'host-final');

  await browser.close();
  console.log(`\nDone. ${shotIndex} screenshots in ${OUT}\n`);
}

function randomPicks(seed) {
  return TEAMS.map((_, i) => (i + seed) % 4 === 0 ? 0 : (i + seed) % 4);
}

async function answerAll(phones, picks, delays) {
  await Promise.all(
    phones.map(async ({ page }, i) => {
      await wait(delays[i] || 500);
      const buttons = await page.$$('.answer-btn');
      const target = buttons[picks[i] ?? 0];
      if (target) await target.click().catch(() => {});
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
