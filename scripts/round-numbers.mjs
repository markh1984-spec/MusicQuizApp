#!/usr/bin/env node
/**
 * DOES EVERY SCREEN CALL THE ROUND THE SAME THING? — with a bonus round in
 * the night.
 *
 * ---
 *
 * A breakout round is delivered like any other and scores nothing, so it is
 * not one of the rounds the room is counting: the engine says so with
 * `scoreRoundNumber`, and the projector's round intro has read it since the
 * round existed. Nothing checked whether the OTHER screens agreed. They did
 * not (launch-path sweep, 23 September 2026): the host's status line, his
 * answer key and his next-up panel, the phone's board heading and the
 * projector's own scoreboard caption all printed the array position — so with
 * a bonus round first the wall said *Round 1 of 2*, the control view said
 * *R2 Q1 — live*, and sixty phones said *After round 2*. The host reads his
 * number off his own screen and says it into a microphone, in front of a wall
 * saying a different one.
 *
 * So this launches a night with a bonus round FIRST, opens the control view,
 * the projector and a phone in a real browser, and reads the round's name off
 * each at every moment it is printed. The wall's `scoreRoundNumber` is the
 * reference; every other screen must say the same word.
 *
 *   node scripts/round-numbers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

const KEY = 'round-numbers';
const app = await startApp({
  key: KEY,
  // A breakout round is in no catalogue pack, so one is written into the COPY
  // of the catalogue this run plays from — `seed` runs before the copy merges
  // in, and a file written here survives it.
  seed(dir) {
    fs.mkdirSync(path.join(dir, 'quizzes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'quizzes', 'bonus-bits.json'), JSON.stringify({
      id: 'bonus-bits', title: 'Bonus Bits',
      rounds: [{ title: 'Round One — Say Anything', type: 'breakout', questions: [{ prompt: 'Finish the line: "Never gonna give you ___"' }] }],
    }, null, 2));
  },
});
const { base: B, stop } = app;

let fails = 0;
const check = (name, ok, got = '') => {
  if (!ok) fails += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !got ? '' : ` — ${got}`}`);
};
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (route, opts = {}) => {
  const r = await fetch(B + route, opts);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const hostView = async () => (await J('/api/state?role=host', { headers: H })).body;

let browser;
try {
  console.log('\nDOES EVERY SCREEN CALL THE ROUND THE SAME THING?\n');
  const lib = (await J('/api/library', { headers: H })).body;
  const pack = (lib.quizzes || []).find((q) => (q.rounds || []).length > 1);
  if (!pack) throw new Error('no quiz pack with more than one round');
  // The bonus round FIRST, so every counting round after it is a round whose
  // position and whose number differ — the case the labels got wrong.
  const order = [{ packId: 'bonus-bits', round: 0 }, { packId: pack.id, round: 0 }, { packId: pack.id, round: 1 }];
  const go = await host('launch', { game: 'quiz', packId: pack.id, order, venue: 'The Crown', replace: true });
  check('a night launches with a bonus round first', go.status === 200, JSON.stringify(go.body).slice(0, 160));

  browser = await chromium.launch();
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const wall = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const boom = [];
  for (const p of [desk, wall, phone]) p.on('pageerror', (e) => boom.push(String(e.message)));
  await desk.goto(`${B}/host?key=${KEY}`, { waitUntil: 'load' });
  await wall.goto(`${B}/screen`, { waitUntil: 'load' });
  await phone.goto(`${B}/play`, { waitUntil: 'load' });
  await phone.fill('#nameInput', 'Table Six');
  await phone.click('#joinBtn');
  await desk.waitForTimeout(1200);

  const settle = () => desk.waitForTimeout(800);
  const where = async () => (await desk.locator('#where').textContent()).trim();
  const heading = async (page, re) => ((await page.locator('h3', { hasText: re }).first().textContent().catch(() => '')) || '').trim();
  const drive = async (target) => {
    let v = await hostView();
    for (let i = 0; i < 60 && v.phase !== target; i += 1) {
      await host('next');
      v = await hostView();
    }
    await settle();
    return v;
  };
  const wallSays = async () => (await wall.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ');

  /* ------------------------------------------------ the bonus round itself */
  let v = await drive('round_intro');
  check('the first round intro is the bonus round\'s', v.roundType === 'breakout', String(v.roundType));
  let up = await heading(desk, /next up/i);
  check('the next-up panel calls its question the bonus round\'s, not "R1"', /Bonus Q1/.test(up) && !/\bR1\b/.test(up), up);
  v = await drive('question');
  check('the first question is the bonus round\'s', v.roundType === 'breakout', String(v.roundType));
  let said = await where();
  check('the host\'s status line calls it the bonus round, never "R1"', /bonus/i.test(said) && !/\bR1\b/.test(said), said);
  let key = await heading(desk, /question 1 of/i);
  check('and so does the panel under it', /bonus round/i.test(key) && !/round 1/i.test(key), key);

  v = await drive('reveal');
  await host('scoreboard', { on: true });
  await settle();
  let caption = (await wall.locator('.board-sub').first().textContent().catch(() => '')) || '';
  check('the projector\'s scoreboard caption says "of the bonus round"', /of the bonus round/i.test(caption), `${caption} (phase ${v.phase})`);
  await host('scoreboard', { on: false });
  await settle();

  /* ------------------------------------------------ the first counting round */
  v = await drive('round_intro');
  check('the wall introduces the next round as Round 1', /Round 1 of 2/i.test(await wallSays()), await wallSays());
  said = await where();
  check('and the host\'s status line agrees', /^Round 1 intro/.test(said), said);
  up = await heading(desk, /next up/i);
  check('and his next-up panel says R1', /\bR1 Q1\b/.test(up), up);

  v = await drive('question');
  said = await where();
  check('at its first question the host reads "R1 Q1" off his screen', /\bR1 Q1\b/.test(said) && !/\bR2\b/.test(said), said);
  key = await heading(desk, /question 1 of/i);
  check('and the answer key is headed Round 1', /^Round 1,/.test(key), key);

  v = await drive('reveal');
  await host('scoreboard', { on: true });
  await settle();
  caption = (await wall.locator('.board-sub').first().textContent().catch(() => '')) || '';
  check('the projector\'s caption says "of round 1"', /of round 1$/i.test(caption), `${caption} (phase ${v.phase})`);
  await host('scoreboard', { on: false });
  await settle();

  v = await drive('round_board');
  const board = ((await phone.locator('h2').first().textContent().catch(() => '')) || '').trim();
  check('the phone\'s board says "After round 1"', board === 'After round 1', board);
  said = await where();
  check('and the host\'s status line says "Round 1 scores"', /^Round 1 scores/.test(said), said);

  check('nothing threw on any screen', boom.length === 0, boom.join(' | '));
} finally {
  if (browser) await browser.close().catch(() => {});
  await stop();
}

console.log(fails ? `\n${fails} FAILED — the screens disagree about which round it is.` : '\nEvery screen calls the round the same thing.');
process.exit(fails ? 1 : 0);
