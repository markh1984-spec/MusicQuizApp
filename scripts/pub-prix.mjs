/**
 * PUB PRIX, END TO END — a real server, a real projector, a real phone.
 *
 *   node scripts/pub-prix.mjs            # quiz leg, bingo leg, screenshots
 *
 * What it proves, and why each is here:
 *
 *  - a race only opens at a BREAK (a round board / a won bingo round), and is
 *    refused at the lobby — the join code owns that screen;
 *  - the projector DRAWS it (a canvas, karts moving — sampled twice, because a
 *    blank canvas and a frozen one look identical) and a phone gets the road;
 *  - a tap reaches the projector as a `race` event carrying a NUMBER, never a
 *    player id or a token (rule 3), and the projector's payload never carries
 *    one either;
 *  - the SERVER ends the race and names the winner, a kart that never started
 *    cannot win, and the winner's phone holds the last drink on the list;
 *  - a move takes the race down (rule 9) and a question never goes up behind
 *    it — nor behind a settled funniest-photo vote, the fault found building
 *    this;
 *  - the same over a bingo night, between rounds.
 *
 * Screenshots land in shots/pub-prix/ (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';

import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const KEY = 'pub-prix';
const SHOTS = path.join(process.cwd(), 'shots', 'pub-prix');
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
// -1 left, 0 straight, +1 right — what a phone sends while a thumb is held.
const steer = (p, v, token = p.token) => fetch(`${BASE}/api/race`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerId: p.playerId || p.id, token, steer: v }),
}).then((r) => r.json());

/** Every `race` event the projector's stream carries, collected as it goes. */
async function listenAsScreen(seen) {
  const ctrl = new AbortController();
  const res = await fetch(`${BASE}/api/stream?role=screen`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          if (/^event: race$/m.test(block)) seen.push(block.split('\n').find((l) => l.startsWith('data: ')).slice(6));
        }
      }
    } catch { /* aborted */ }
  })();
  return () => ctrl.abort();
}

/** Press on until the quiz reaches a round board. */
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

/** How much of a canvas is painted, and a fingerprint of it, in the page. */
/**
 * HOLD a side of the phone's road, as a thumb does — a real press with the
 * mouse, so `pointerdown`, the capture and the lift all run for real.
 */
async function hold(page, side, ms) {
  const box = await page.locator('.race-steer').boundingBox();
  await page.mouse.move(box.x + box.width * (side < 0 ? 0.2 : 0.8), box.y + box.height * 0.5);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

const sample = (page, sel) => page.evaluate((selector) => {
  const c = document.querySelector(selector);
  if (!c || !c.width) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let lit = 0; let h = 0;
  for (let i = 0; i < d.length; i += 64) { if (d[i + 3] > 0) lit += 1; h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; }
  return { lit, h };
}, sel);

const browser = await chromium.launch();
try {
  /* ---------------------------------------------------------- the quiz */
  const lib = await get('/api/library', { 'X-Host-Key': KEY });
  // A pack with more than one round, or there is no question after the board.
  const quizzes = [...(lib.quiz || []), ...(lib.quizzes || [])];
  const pack = quizzes.find((p) => p.id === '1980s-pop-music') || quizzes.find((p) => (p.rounds || 0) >= 2) || quizzes[0];
  const launch = await host('launch', {
    game: 'quiz', packId: pack.id, replace: true, venue: 'The Chequered Flag',
    rewards: ['A bottle of fizz', 'A round of drinks', 'A pint'],
  });
  check('a quiz launches with prizes on the table', launch.status === 200, String(launch.status));

  const ann = await join('Ann'); const bob = await join('Bob'); const cat = await join('Cat');
  check('three phones join', Boolean(ann.token && bob.token && cat.token));
  // And a room's worth more, so the projector is drawn with a real pack on it.
  const crowd = [];
  for (const name of ['The Quizzly Bears', 'Les Quizerables', 'Agatha Quiztie', 'Pint Floyd',
    'Universally Challenged', 'Tequila Mockingbird', 'Quiz Team Aguilera', 'Sherlock Homies', 'The Lager Louts']) {
    crowd.push(await join(name));
  }

  const early = await host('raceOpen');
  check('a race is refused at the lobby — the join code owns that screen',
    early.body && early.body.ok && early.body.ok.ok === false && early.body.ok.reason === 'not_a_break',
    JSON.stringify(early.body && early.body.ok));

  const board = await toRoundBoard();
  check('the quiz reaches a round board', board.phase === 'round_board', board.phase);

  // The projector and Ann's phone, in real browsers.
  const screen = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await screen.goto(`${BASE}/screen`);
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await phone.goto(`${BASE}/play`);
  await phone.evaluate((me) => localStorage.setItem('musicquiz.player', JSON.stringify(me)),
    { id: ann.playerId || ann.id, token: ann.token, name: 'Ann' });
  await phone.goto(`${BASE}/play`);
  const ctl = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await ctl.goto(`${BASE}/host?key=${KEY}`);
  await ctl.waitForSelector('.racepanel', { timeout: 15000 });
  const btn = await ctl.textContent('.racepanel [data-race="open"]');
  check('the control view names the prize on the button', /winner gets A pint/.test(btn || ''), btn);
  await ctl.screenshot({ path: path.join(SHOTS, 'host-before.png'), fullPage: true });

  const events = [];
  const unlisten = await listenAsScreen(events);

  await ctl.click('.racepanel [data-race="open"]');
  await screen.waitForSelector('canvas.race-canvas', { timeout: 10000 });
  await phone.waitForSelector('.race-phone', { timeout: 10000 });
  check('the projector draws the race', true);
  check('the phone gets the road', true);
  await sleep(800);
  await screen.screenshot({ path: path.join(SHOTS, 'screen-countdown.png') });
  await phone.screenshot({ path: path.join(SHOTS, 'phone-countdown.png') });

  // Rule 3, on the payload.
  const sv = JSON.stringify(await screenState());
  check('no player id or token on the projector\'s payload',
    ![ann, bob, cat].some((p) => sv.includes(p.playerId || p.id) || sv.includes(p.token)));

  // Who may steer.
  const forged = await steer(bob, 1, 'not-a-token');
  check('a tap without the phone\'s token is refused', forged.ok === false && forged.reason === 'not_yours', JSON.stringify(forged));

  // Ann taps in the browser; Bob starts his engine over HTTP; Cat never taps;
  // the crowd all start in the countdown, which is exactly the pack that
  // would be one dot if karts were drawn on top of each other.
  for (const [i, p] of crowd.entries()) await steer(p, (i % 3) - 1);
  await hold(phone, -1, 250);
  const bobTap = await steer(bob, 0);
  check('a tap is answered with the SERVER\'s time', bobTap.ok && Number.isFinite(bobTap.at), JSON.stringify(bobTap));

  const s0 = await hostState();
  await sleep(5200); // past GO
  const a = await sample(screen, 'canvas.race-canvas');
  await sleep(700);
  const b = await sample(screen, 'canvas.race-canvas');
  check('the projector canvas is painted', a && a.lit > 1000, JSON.stringify(a));
  check('and it is MOVING, not frozen', a && b && a.h !== b.h);
  // A few more taps from the phone, as a person would.
  // Steering as a person would: a hold, a let-go, the other way.
  for (const side of [-1, 1, -1]) {
    await hold(phone, side, 450);
    await sleep(500);
  }
  await screen.screenshot({ path: path.join(SHOTS, 'screen-racing.png') });
  await phone.screenshot({ path: path.join(SHOTS, 'phone-racing.png') });
  await ctl.screenshot({ path: path.join(SHOTS, 'host-racing.png'), fullPage: true });

  const pa = await sample(phone, 'canvas.race-road-canvas');
  check('the phone\'s road is painted', pa && pa.lit > 1000, JSON.stringify(pa));

  check('taps reached the projector as race events', events.length >= 2, `${events.length}`);
  // Ann's own kart is 0: her holds arrived as left, right AND the let-go.
  const annSteers = new Set(events.map((e) => JSON.parse(e)).filter((e) => e.n === 0).map((e) => e.steer));
  check('a held press steers, and lifting the thumb straightens up',
    annSteers.has(-1) && annSteers.has(1) && annSteers.has(0), JSON.stringify([...annSteers]));
  // TILT — the phone's sensor, as the browser reports it.
  const tiltFrom = events.length;
  const tip = (gamma) => phone.evaluate((g) => window.dispatchEvent(
    new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 20, gamma: g })), gamma);
  await tip(45); await sleep(450); await tip(0); await sleep(450);
  const tilted = events.slice(tiltFrom).map((e) => JSON.parse(e)).filter((e) => e.n === 0).map((e) => e.steer);
  check('tipping the phone right steers right, and levelling it straightens up',
    tilted.includes(1) && tilted[tilted.length - 1] === 0, JSON.stringify(tilted));
  check('a race event carries a kart NUMBER and nothing that identifies a phone',
    events.length > 0 && events.every((e) => {
      const o = JSON.parse(e);
      return Object.keys(o).sort().join(',') === 'at,id,n,steer'
        && ![ann, bob, cat].some((p) => e.includes(p.playerId || p.id) || e.includes(p.token));
    }), events[0]);

  // Let the SERVER finish it.
  let done = null;
  for (let i = 0; i < 180 && !done; i += 1) {
    const h = await hostState();
    if (h.race && h.race.phase === 'done') done = h; else await sleep(1000);
  }
  check('the server ends the race by itself', Boolean(done), s0.race ? s0.race.phase : 'no race');
  unlisten();
  if (done) {
    const w = done.race.winner;
    check('a kart that never started cannot win', w && w.name !== 'Cat', w && w.name);
    const everyone = [ann, bob, ...crowd];
    check('the winner\'s drink was minted', w && /^[A-Z0-9]{6,}$/.test(w.code || ''), JSON.stringify(w));
    const names = ['Ann', 'Bob', 'The Quizzly Bears', 'Les Quizerables', 'Agatha Quiztie', 'Pint Floyd',
      'Universally Challenged', 'Tequila Mockingbird', 'Quiz Team Aguilera', 'Sherlock Homies', 'The Lager Louts'];
    const winner = everyone[Math.max(0, names.indexOf(w && w.name))];
    const wp = await playerState(winner);
    const drink = (wp.vouchers || []).find((v) => v.race);
    check('the winner\'s phone holds it, and it is the last prize on the list',
      drink && drink.reward === 'A pint' && drink.place === null, JSON.stringify(drink));
    const cp = await playerState(cat);
    check('Cat, who never tapped, came last', cp.race && cp.race.place === cp.race.karts, JSON.stringify(cp.race));
    await sleep(1200);
    await screen.screenshot({ path: path.join(SHOTS, 'screen-result.png') });
    await phone.screenshot({ path: path.join(SHOTS, 'phone-after.png'), fullPage: true });
    await ctl.screenshot({ path: path.join(SHOTS, 'host-result.png'), fullPage: true });
  }

  await host('raceDrop');
  check('taking it down takes it off the projector', !(await screenState()).race);

  // A move settles it, and the next question never goes up behind it.
  await host('raceOpen');
  await steer(ann, 1);
  await host('next');
  const after = await screenState();
  check('a move takes the race down (rule 9)', !after.race, after.phase);
  for (let i = 0; i < 4 && after.phase !== 'question'; i += 1) { await host('next'); Object.assign(after, await screenState()); }
  check('and the next question is what the projector shows', after.phase === 'question' && !after.race && !after.photoVote, after.phase);

  /* --------------------------------------------------------- the bingo */
  const blib = await get('/api/library', { 'X-Host-Key': KEY });
  const bpack = (blib.bingo || [])[0];
  const bl = await host('launch', { game: 'bingo', packId: bpack.id, replace: true, shape: '3x3', prizes: 1, rewards: ['A pint'] });
  check('a bingo night launches', bl.status === 200, String(bl.status));
  const dee = await join('Dee'); const eve = await join('Eve');
  await host('start');
  const refused = await host('raceOpen');
  check('a bingo race is refused mid-round', refused.body.ok.ok === false, JSON.stringify(refused.body.ok));
  const ds = await playerState(dee);
  const hs = await hostState();
  const idByTitle = new Map((hs.tracks || []).map((t) => [t.title, t.id]));
  for (const [i, sq] of (ds.card || []).entries()) {
    await host('call', { trackId: idByTitle.get(sq.title) });
    await fetch(`${BASE}/api/mark`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: dee.playerId || dee.id, token: dee.token, index: i, marked: true }) });
  }
  await fetch(`${BASE}/api/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: dee.playerId || dee.id, token: dee.token }) });
  await host('approveClaim', { playerId: dee.playerId || dee.id });
  const won = await hostState();
  check('the bingo round is won', won.phase === 'won', won.phase);
  const bo = await host('raceOpen');
  check('a race opens between bingo rounds', bo.body.ok.ok === true, JSON.stringify(bo.body.ok));
  await steer(eve, 1);
  const shut = await host('raceClose');
  check('ended in the countdown, nobody has moved — so nobody wins',
    shut.body.ok.winner === null, JSON.stringify(shut.body.ok));
  await host('raceDrop');
  await host('raceOpen');
  await steer(eve, 1);
  await sleep(6000); // past GO, so Eve's kart is moving
  const closed = await host('raceClose');
  check('ending it early pays whoever is in front', closed.body.ok.winner && closed.body.ok.winner.name === 'Eve',
    JSON.stringify(closed.body.ok));
  await host('newRound'); await host('newRound');
  check('a new round takes it down', !(await screenState()).race);

  /* ------------------------------------- Pub Prix as a PART of the night */
  // Quiz -> Pub Prix -> quiz, the way Tonight sends it when a race tile sits
  // between two rounds: `src/race-game.js`, `LAUNCHERS.race`.
  const rounds = (pack.roundTitles || []).length || pack.rounds || 2;
  const lo = await host('launchOrder', {
    replace: true, venue: 'The Chequered Flag',
    rewards: ['A bottle of fizz', 'A round of drinks', 'A pint'],
    segments: [
      { kind: 'quiz', order: [{ packId: pack.id, round: 0 }] },
      { kind: 'race', packId: 'pub-prix' },
      { kind: 'quiz', order: [{ packId: pack.id, round: Math.min(1, rounds - 1) }] },
    ],
  });
  check('a night with Pub Prix in the middle launches', lo.status === 200, `${lo.status} ${JSON.stringify(lo.body).slice(0, 200)}`);
  const fay = await join('Fay'); const gus = await join('Gus'); const hal = await join('Hal');
  const qb = await toRoundBoard();
  check('the first quiz part reaches its board', qb.phase === 'round_board', qb.phase);
  check('the control view offers Pub Prix next', qb.runningOrder && qb.runningOrder.nextKind === 'race', JSON.stringify(qb.runningOrder));
  await host('advanceOrder');
  const grid = await hostState();
  check('Continue goes to Pub Prix, on the grid', grid.game === 'race' && grid.phase === 'lobby', `${grid.game} ${grid.phase}`);
  check('the race part is told its own drink — the venue\'s first', grid.nextPrize === 'A bottle of fizz', grid.nextPrize);
  const gs = await screenState();
  // Ann's phone from the first leg is still open, so she rejoins too — correct.
  const onGrid = gs.race ? gs.race.karts.map((k) => k.name) : [];
  check('the projector shows every phone on the grid', gs.race && gs.race.phase === 'grid'
    && ['Fay', 'Gus', 'Hal'].every((n) => onGrid.includes(n)), JSON.stringify(onGrid));
  check('no player id or token on the grid\'s payload',
    ![fay, gus, hal].some((p) => JSON.stringify(gs).includes(p.playerId || p.id) || JSON.stringify(gs).includes(p.token)));
  const fp = await playerState(fay);
  check('a phone is told which kart is its own', fp.race && fp.race.you && fp.race.you.n === 0, JSON.stringify(fp.race));

  const gScreen = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await gScreen.goto(`${BASE}/screen`);
  await gScreen.waitForSelector('canvas.race-canvas', { timeout: 10000 });
  await sleep(600);
  const ga = await sample(gScreen, 'canvas.race-canvas');
  check('the projector draws the grid', ga && ga.lit > 1000, JSON.stringify(ga));
  await gScreen.screenshot({ path: path.join(SHOTS, 'part-screen-grid.png') });
  const gPhone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await gPhone.goto(`${BASE}/play`);
  await gPhone.evaluate((me) => localStorage.setItem('musicquiz.player', JSON.stringify(me)),
    { id: fay.playerId || fay.id, token: fay.token, name: 'Fay' });
  await gPhone.goto(`${BASE}/play`);
  await gPhone.waitForSelector('.race-grid', { timeout: 10000 });
  const selfie = await gPhone.$('.race-selfie');
  check('the phone offers a selfie for the kart', Boolean(selfie));
  await gPhone.screenshot({ path: path.join(SHOTS, 'part-phone-grid.png'), fullPage: true });
  const gCtl = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await gCtl.goto(`${BASE}/host?key=${KEY}`);
  await gCtl.waitForSelector('.actions .primary', { timeout: 10000 });
  const startText = await gCtl.textContent('.actions .primary');
  check('the control view\'s one button starts the race and names the drink', /Start the race — winner gets A bottle of fizz/.test(startText || ''), startText);
  await gCtl.screenshot({ path: path.join(SHOTS, 'part-host-grid.png'), fullPage: true });

  await gCtl.click('.actions .primary');
  await gPhone.waitForSelector('.race-phone', { timeout: 10000 });
  check('starting it gives the phone the road', true);
  await steer(gus, 1);
  await hold(gPhone, 1, 300);
  await sleep(6500);
  await gScreen.screenshot({ path: path.join(SHOTS, 'part-screen-racing.png') });
  await gCtl.waitForSelector('.actions .primary');
  await gCtl.click('.actions .primary'); // End the race now
  let pd = null;
  for (let i = 0; i < 20 && !pd; i += 1) { const h = await hostState(); if (h.race && h.race.phase === 'done') pd = h; else await sleep(300); }
  check('ending it names a winner who started', pd && pd.race.winner && ['Fay', 'Gus'].includes(pd.race.winner.name), JSON.stringify(pd && pd.race.winner));
  const minted = pd && Object.values(pd.vouchers || {}).find((v) => v.race);
  check('and mints the part\'s own first drink', minted && minted.reward === 'A bottle of fizz', JSON.stringify(minted));
  await sleep(800);
  await gScreen.screenshot({ path: path.join(SHOTS, 'part-screen-result.png') });
  await gCtl.screenshot({ path: path.join(SHOTS, 'part-host-result.png'), fullPage: true });
  const contText = await gCtl.textContent('.actions .primary');
  check('after the race, the one button continues to the quiz', /Continue to the quiz/.test(contText || ''), contText);
  await host('advanceOrder');
  const back = await hostState();
  check('the night carries on into the second quiz', back.game === 'quiz', back.game);
  // The race's drink is minted with the night's venue — proof the part got it
  // (that it carries on into the quiz is `test/race-part.test.js`'s).
  check('the venue reached the race part', (back.vouchers || []).some((v) => v.race && v.venue === 'The Chequered Flag'),
    JSON.stringify((back.vouchers || []).map((v) => v.venue)));
  check('the race\'s drink is still on the winner\'s phone',
    (back.vouchers || []).some((v) => v.race && v.reward === 'A bottle of fizz'), JSON.stringify((back.vouchers || []).map((v) => v.reward)));
  check('everybody is still in the room', (back.players || back.leaderboard || []).length >= 3 || back.playerCount >= 3, String(back.playerCount));

  /* ----------------------------------------- and from the console's own bar */
  // A real host's path: a quiz pack tapped in, then the Pub Prix card, prizes
  // typed in the table, Launch pressed — and the REQUEST BODY read, because a
  // field missing from a launch whitelist is dropped in silence.
  const con = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const conErrors = [];
  con.on('pageerror', (e) => conErrors.push(String(e)));
  // The night before is still running, so Launch asks first — say yes.
  con.on('dialog', (d) => d.accept());
  await con.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
  await con.waitForSelector('.pack-card', { timeout: 20000 });
  await con.waitForTimeout(800);
  await con.evaluate(() => document.querySelector('button.tab[data-tab="race"]')?.click());
  await con.waitForTimeout(500);
  const raceCards = await con.evaluate(() => [...document.querySelectorAll('.pack-card[data-pack]')].map((c) => c.dataset.pack));
  check('the Pub Prix tab holds one card', raceCards.length === 1 && raceCards[0] === 'pub-prix', JSON.stringify(raceCards));
  await con.screenshot({ path: path.join(SHOTS, 'console-race-tab.png') });
  await con.evaluate(() => document.querySelector('button.tab[data-tab="quiz"]')?.click());
  await con.waitForTimeout(400);
  await con.evaluate((id) => document.querySelector(`.pack-card[data-pack="${id}"]`)?.click(), pack.id);
  await con.waitForTimeout(900);
  await con.evaluate(() => document.querySelector('button.tab[data-tab="race"]')?.click());
  await con.waitForTimeout(400);
  await con.evaluate(() => document.querySelector('.pack-card[data-pack="pub-prix"]')?.click());
  await con.waitForTimeout(900);
  const lastTile = await con.evaluate(() => [...document.querySelectorAll('.lb-tiles .lb-tile.is-pack')].pop()?.textContent.replace(/\s+/g, ' ').trim() || '');
  check('tapping it puts a Pub Prix tile on Tonight, after the rounds', /Pub Prix/.test(lastTile) && /kart race/.test(lastTile), lastTile);
  await con.evaluate(() => document.querySelector('.lb-pz-head')?.click());
  await con.waitForTimeout(300);
  for (const inp of await con.$$('.lb-prizes input')) await inp.fill('A pint');
  await con.evaluate(() => document.querySelector('.lb-pz-head')?.click());
  await con.waitForTimeout(400);
  await con.screenshot({ path: path.join(SHOTS, 'console-tonight.png') });
  let sent = null;
  con.on('request', (r) => { if (/\/api\/host\/launch/.test(r.url())) sent = { url: r.url(), data: r.postData() }; });
  await con.evaluate(() => document.querySelector('.lb-go')?.click());
  await con.waitForTimeout(1500);
  if (!sent) { await con.evaluate(() => document.querySelector('.lb-go')?.click()); await con.waitForTimeout(1500); }
  const segs = sent ? (JSON.parse(sent.data).segments || []) : [];
  check('Launch sends the race as its own part, with its own drink',
    /launchOrder/.test(sent ? sent.url : '') && segs.some((x) => x.kind === 'race' && x.packId === 'pub-prix' && (x.rewards || [])[0] === 'A pint'),
    JSON.stringify(segs.map((x) => x.kind)));
  const lit = await hostState();
  check('and the night is up with Pub Prix next', lit.runningOrder && lit.runningOrder.nextKind === 'race', JSON.stringify(lit.runningOrder));
  check('the console threw nothing', conErrors.length === 0, conErrors.join(' | '));
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nPub Prix runs, end to end.');
process.exit(failures ? 1 : 0);
