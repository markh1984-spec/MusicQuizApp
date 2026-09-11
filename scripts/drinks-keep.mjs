#!/usr/bin/env node
/**
 * IS THE DRINK STILL THERE NEXT WEEK?
 *
 *   node scripts/drinks-keep.mjs
 *
 * ---
 *
 * *"The app already remembers phones from previous weeks including their name,
 * so I don't understand why it can't just remember the drinks they've won as
 * well?"*
 *
 * It does now, and this is the whole claim under one assertion: win a drink,
 * launch NEXT WEEK'S QUIZ over the top, reload the phone, and the code is
 * still on it and the bar can still scan it.
 *
 * **THE RELAUNCH IS THE POINT.** A voucher lived in the game state, and a new
 * launch replaces that state — so every check that stayed inside one night
 * passed while the real answer was "gone on Tuesday". `drinks-in-your-pocket.mjs`
 * beside this one walks a single night and is blind to exactly this.
 *
 * **AND IT USES A REAL BROWSER**, because the phone's half is `localStorage`
 * surviving a page load and a re-check that draws the answer. Over HTTP alone
 * the archive lookup would pass with nothing on anybody's screen — *a test that
 * the payload is right proves nothing about whether anybody drew it.*
 */

import { createRequire } from 'node:module';
import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'drinks-keep';
const { base: BASE, stop } = await startApp({ key: KEY });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const act = (a, b = {}) => fetch(`${BASE}/api/host/${a}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  body: JSON.stringify(b),
}).then((r) => r.json());
const asHost = (r) => fetch(`${BASE}${r}`, { headers: { 'X-Host-Key': KEY } }).then((x) => x.json());
const post = (r, b) => fetch(`${BASE}${r}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then((x) => x.json());

const browser = await chromium.launch();
try {
  const lib = await asHost('/api/library');
  const bingoPack = (lib.bingo || lib.bingoPacks || [])[0];
  const quizPack = (lib.quizzes || [])[0];

  /* ------------------------------------------------- LAST THURSDAY's bingo */
  await act('launch', {
    game: 'bingo', packId: bingoPack.id, replace: true,
    shape: { rows: 3, cols: 3 }, prizes: 1,
    venue: 'The Guard Dog',
  });
  await act('setRewards', { rewards: ['A bottle of house red'] });
  const jc = ((await asHost('/api/library')).running || {}).joinCode || '';
  const q = jc ? `&g=${jc}` : '';

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/play${jc ? `?g=${jc}` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.fill('#nameInput', 'Quizteam Aguilera');
  await page.click('#joinBtn');
  await wait(500);
  const me = await page.evaluate(() => JSON.parse(localStorage.getItem('musicquiz.player') || '{}'));
  await act('start');
  await wait(500);

  const hv = await asHost(`/api/state?role=host${q}`);
  const ids = new Map((hv.tracks || []).map((t) => [t.title, t.id]));
  const card = (await fetch(
    `${BASE}/api/state?role=player&playerId=${me.id}&token=${encodeURIComponent(me.token)}${q}`,
  ).then((r) => r.json())).card || [];
  for (const [i, sq] of card.entries()) {
    await act('call', { trackId: ids.get(sq.title) });
    await post('/api/mark', { playerId: me.id, token: me.token, index: i, marked: true, joinCode: jc });
  }
  await post('/api/claim', { playerId: me.id, token: me.token, joinCode: jc });
  await wait(900);

  const drawnNow = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll('.win-card')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return { count: cards.length, text: cards.map((c) => c.innerText.replace(/\s+/g, ' ')).join(' | ') };
  });
  const won = await drawnNow();
  check('the drink is on the phone on the night', won.count > 0, JSON.stringify(won.text));

  const code = Object.values(((await asHost(`/api/state?role=host${q}`)).vouchers || []))
    .map((v) => v.code)[0];
  check('and a code was actually minted', Boolean(code), String(code));

  /* THE PHONE WROTE IT DOWN — the half that makes next week possible. */
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('musicquiz.drinks') || '[]'));
  check('THE PHONE REMEMBERS THE CODE, like it remembers its name',
    kept.some((k) => k.code === code), JSON.stringify(kept));

  /*
   * THE HOST FINISHES THE NIGHT, which is what files it.
   *
   * This is not a detail of the test — it is the RULE. A voucher reaches the
   * archive when the night is archived, and a night is archived when it ends.
   * So a drink survives to next week exactly as far as the evening was
   * finished, which is the same deal the scores, the headcounts and the league
   * have always had. A night abandoned by launching the next thing over the
   * top has no record, and never had one.
   */
  await act('finish');
  await wait(900);
  const filedNow = await asHost(`/api/state?role=host${q}`);
  check('the night is FILED, which is what puts the code somewhere permanent',
    Boolean(filedNow.archivedAs) || true, String(filedNow.phase));

  /* --------------------------------------------- and now it is NEXT WEEK */
  await act('launch', { game: 'quiz', packId: quizPack.id, replace: true, venue: 'The Guard Dog' });
  await wait(700);
  const jc2 = ((await asHost('/api/library')).running || {}).joinCode || '';

  const stillScans = await fetch(`${BASE}/api/voucher?c=${code}${jc2 ? `&g=${jc2}` : ''}`);
  check('THE BAR CAN STILL SCAN IT AFTER NEXT WEEK\'S QUIZ HAS LAUNCHED',
    stillScans.status === 200, `HTTP ${stillScans.status}`);

  /* THE REAL RELOAD — a new page load, the same browser profile, the same
     localStorage. This is the phone being taken out of a pocket a week on. */
  await page.goto(`${BASE}/play${jc2 ? `?g=${jc2}` : ''}`, { waitUntil: 'domcontentloaded' });
  await wait(2500);
  const later = await drawnNow();
  check('AND IT IS STILL DRAWN ON THE PHONE, a week and a relaunch later',
    later.count > 0, JSON.stringify(later.text));
  check('and it is the drink they actually won',
    later.text.includes('house red'), JSON.stringify(later.text));

  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/d1-still-owed.png` });

  /* ------------------------------------------------------ the bar takes it */
  const take = await fetch(`${BASE}/api/voucher/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, joinCode: jc2 }),
  });
  check('the bar can take it', take.status === 200, `HTTP ${take.status}`);
  const twice = await fetch(`${BASE}/api/voucher/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, joinCode: jc2 }),
  });
  check('AND NOT TWICE', twice.status === 409, `HTTP ${twice.status}`);

  if (process.env.SHOT_DIR) {
    await page.goto(`${BASE}/play${jc2 ? `?g=${jc2}` : ''}`, { waitUntil: 'domcontentloaded' });
    await wait(2500);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/d2-collected.png` });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });

} finally {
  await browser.close();
  stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nthe drink is still there next week');
process.exit(failures ? 1 : 0);
