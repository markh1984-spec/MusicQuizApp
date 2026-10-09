/**
 * UP OR DOWN, END TO END — a real server, a real projector, a real phone, a
 * real control view, and the console's own bar.
 *
 *   node scripts/up-or-down.mjs
 *
 * What it proves:
 *  - a night with Up or Down between two quiz parts launches, and Continue
 *    reaches it with the venue and the part's own drink;
 *  - the control view's one button deals, turns and moves on, and names the
 *    drink before the game starts;
 *  - a phone votes with a real press, and the projector shows HOW MANY have
 *    voted, never which way, and never a player id or a token (rule 3);
 *  - the game always ends with one winner holding the drink, and the night
 *    carries on into the quiz with that drink still in their hand;
 *  - the console offers it as a card, a Tonight tile, and a prize-table row.
 *
 * Screenshots land in shots/up-or-down/ (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';

import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const KEY = 'up-or-down';
const SHOTS = path.join(process.cwd(), 'shots', 'up-or-down');
fs.mkdirSync(SHOTS, { recursive: true });

const { base: BASE, stop } = await startApp({ key: KEY });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const host = (action, body = {}) => fetch(`${BASE}/api/host/${action}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const get = (route, headers = {}) => fetch(`${BASE}${route}`, { headers }).then((r) => r.json());
const hostState = () => get('/api/state?role=host', { 'X-Host-Key': KEY });
const screenState = () => get('/api/state?role=screen');
const playerState = (p) => get(`/api/state?role=player&playerId=${p.playerId || p.id}&token=${encodeURIComponent(p.token)}`);
const join = (name) => fetch(`${BASE}/api/join`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
}).then((r) => r.json());
const vote = (p, choice, token = p.token) => fetch(`${BASE}/api/updown`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerId: p.playerId || p.id, token, choice }),
}).then((r) => r.json());

async function toRoundBoard() {
  for (let i = 0; i < 200; i += 1) {
    const s = await hostState();
    if (s.phase === 'round_board') return s;
    if (s.phase === 'lobby') await host('start');
    else if (s.phase === 'question') await host('reveal');
    else await host('next');
  }
  return hostState();
}

const browser = await chromium.launch();
try {
  const lib = await get('/api/library', { 'X-Host-Key': KEY });
  const quizzes = [...(lib.quiz || []), ...(lib.quizzes || [])];
  const pack = quizzes.find((p) => p.id === '1980s-pop-music') || quizzes[0];
  const lo = await host('launchOrder', {
    replace: true, venue: 'The Card Sharp',
    rewards: ['A bottle of fizz', 'A round of drinks', 'A pint'],
    segments: [
      { kind: 'quiz', order: [{ packId: pack.id, round: 0 }] },
      { kind: 'updown', packId: 'up-or-down' },
      { kind: 'quiz', order: [{ packId: pack.id, round: 1 }] },
    ],
  });
  check('a night with Up or Down in the middle launches', lo.status === 200, String(lo.status));
  const ann = await join('Ann'); const bob = await join('Bob'); const cat = await join('Cat');
  const board = await toRoundBoard();
  check('the control view offers Up or Down next', board.runningOrder && board.runningOrder.nextKind === 'updown', JSON.stringify(board.runningOrder));
  await host('advanceOrder');
  const ready = await hostState();
  check('Continue reaches Up or Down, waiting to deal', ready.game === 'updown' && ready.phase === 'lobby', `${ready.game} ${ready.phase}`);
  check('it is told its own drink — the venue\'s first', ready.nextPrize === 'A bottle of fizz', ready.nextPrize);

  const screen = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await screen.goto(`${BASE}/screen`);
  await screen.waitForSelector('.ud-stage', { timeout: 10000 });
  await screen.screenshot({ path: path.join(SHOTS, 'screen-waiting.png') });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await phone.goto(`${BASE}/play`);
  await phone.evaluate((me) => localStorage.setItem('musicquiz.player', JSON.stringify(me)),
    { id: ann.playerId || ann.id, token: ann.token, name: 'Ann' });
  await phone.goto(`${BASE}/play`);
  await phone.waitForSelector('.ud-phone', { timeout: 10000 });
  const ctl = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await ctl.goto(`${BASE}/host?key=${KEY}`);
  await ctl.waitForSelector('.actions .primary', { timeout: 10000 });
  const dealText = await ctl.textContent('.actions .primary');
  check('the one button deals, and names the drink', /Deal Up or Down — winner gets A bottle of fizz/.test(dealText || ''), dealText);

  await ctl.click('.actions .primary');
  await phone.waitForSelector('.ud-vote', { timeout: 10000 });
  check('dealing puts Higher and Lower on the phone', (await phone.$$('.ud-vote')).length === 2);
  await phone.click('.ud-vote[data-way="up"]');
  await sleep(500);
  check('a real press lights the button', await phone.$('.ud-vote.picked[data-way="up"]') !== null);
  const forged = await vote(bob, 'up', 'not-bobs');
  check('a vote without the phone\'s token is refused', forged.ok === false && forged.reason === 'not_yours', JSON.stringify(forged));
  await vote(bob, 'down');
  await sleep(400);
  const sv = await screenState();
  check('the projector says how many have voted', sv.updown && sv.updown.voted === 2, JSON.stringify(sv.updown && sv.updown.voted));
  check('…never which way, while the clock runs', sv.updown && sv.updown.up === undefined && sv.updown.down === undefined);
  const text = JSON.stringify(sv);
  check('no player id or token on the projector\'s payload',
    ![ann, bob, cat].some((p) => text.includes(p.playerId || p.id) || text.includes(p.token)));
  await screen.screenshot({ path: path.join(SHOTS, 'screen-guessing.png') });
  await phone.screenshot({ path: path.join(SHOTS, 'phone-guessing.png') });
  await ctl.screenshot({ path: path.join(SHOTS, 'host-guessing.png'), fullPage: true });

  // Play it out: Ann says higher, Bob lower, Cat never says. One of the two is
  // right on every card that is not a pair, so the game must end.
  let h = await hostState();
  for (let turn = 0; turn < 40 && h.phase !== 'done'; turn += 1) {
    if (h.phase === 'shown') { await host('updownNext'); h = await hostState(); continue; }
    if (turn > 0) { await vote(ann, 'up'); await vote(bob, 'down'); }
    await host('updownTurn');
    h = await hostState();
    if (turn === 0) {
      await sleep(600);
      await screen.screenshot({ path: path.join(SHOTS, 'screen-turned.png') });
      check('the turn shows the split on the projector', (await screenState()).updown.up !== undefined);
    }
  }
  check('the game ends with one winner', h.phase === 'done' && h.updown && h.updown.winner, JSON.stringify(h.updown && h.updown.winner));
  const w = h.updown && h.updown.winner;
  check('and never Cat, who never said', w && w.name !== 'Cat', w && w.name);
  check('the winner\'s drink is minted', w && /^[A-Z0-9]{6,}$/.test(w.code || ''), JSON.stringify(w));
  const winner = w && w.name === 'Ann' ? ann : bob;
  const wp = await playerState(winner);
  const drink = (wp.vouchers || []).find((v) => v.updown);
  check('the winner\'s phone holds it — the part\'s first drink', drink && drink.reward === 'A bottle of fizz' && drink.place === null, JSON.stringify(drink));
  await sleep(700);
  await screen.screenshot({ path: path.join(SHOTS, 'screen-winner.png') });
  await phone.screenshot({ path: path.join(SHOTS, 'phone-after.png'), fullPage: true });
  await ctl.screenshot({ path: path.join(SHOTS, 'host-winner.png'), fullPage: true });
  const cont = await ctl.textContent('.actions .primary');
  check('after the winner, the one button continues to the quiz', /Continue to the quiz/.test(cont || ''), cont);
  await host('advanceOrder');
  const back = await hostState();
  check('the night carries on into the quiz', back.game === 'quiz', back.game);
  check('with the drink still in the winner\'s hand', (back.vouchers || []).some((v) => v.updown && v.reward === 'A bottle of fizz'));

  /* ------------------------------------------ and from the console's own bar */
  const con = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const conErrors = [];
  con.on('pageerror', (e) => conErrors.push(String(e)));
  con.on('dialog', (d) => d.accept());
  await con.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
  await con.waitForSelector('.pack-card', { timeout: 20000 });
  await con.waitForTimeout(800);
  await con.evaluate(() => document.querySelector('button.tab[data-tab="updown"]')?.click());
  await con.waitForTimeout(500);
  const cards = await con.evaluate(() => [...document.querySelectorAll('.pack-card[data-pack]')].map((c) => c.dataset.pack));
  check('the Up or Down tab holds one card', cards.length === 1 && cards[0] === 'up-or-down', JSON.stringify(cards));
  await con.evaluate(() => document.querySelector('button.tab[data-tab="quiz"]')?.click());
  await con.waitForTimeout(400);
  await con.evaluate((id) => document.querySelector(`.pack-card[data-pack="${id}"]`)?.click(), pack.id);
  await con.waitForTimeout(900);
  await con.evaluate(() => document.querySelector('button.tab[data-tab="updown"]')?.click());
  await con.waitForTimeout(400);
  await con.evaluate(() => document.querySelector('.pack-card[data-pack="up-or-down"]')?.click());
  await con.waitForTimeout(900);
  const lastTile = await con.evaluate(() => [...document.querySelectorAll('.lb-tiles .lb-tile.is-pack')].pop()?.textContent.replace(/\s+/g, ' ').trim() || '');
  check('tapping it puts an Up or Down tile on Tonight', /Up or Down/.test(lastTile) && /Higher or lower/.test(lastTile), lastTile);
  const table = await con.evaluate(() => (document.querySelector('.lb-prizes')?.textContent || '').replace(/\s+/g, ' '));
  check('the prize table has its row, one drink a game', /Up or Down\s*Each game/.test(table), table.slice(0, 160));
  await con.screenshot({ path: path.join(SHOTS, 'console-tonight.png') });
  check('the console threw nothing', conErrors.length === 0, conErrors.join(' | '));
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nUp or Down runs, end to end.');
process.exit(failures ? 1 : 0);
