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
const steer = (p, lane, token = p.token) => fetch(`${BASE}/api/race`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerId: p.playerId || p.id, token, lane }),
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
  const forged = await steer(bob, 2, 'not-a-token');
  check('a tap without the phone\'s token is refused', forged.ok === false && forged.reason === 'not_yours', JSON.stringify(forged));

  // Ann taps in the browser; Bob starts his engine over HTTP; Cat never taps;
  // the crowd all start in the countdown, which is exactly the pack that
  // would be one dot if karts were drawn on top of each other.
  for (const [i, p] of crowd.entries()) await steer(p, i % 3);
  await phone.locator('.race-lanes [data-lane="1"]').dispatchEvent('pointerdown');
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
  for (const lane of [0, 2, 1, 0]) {
    await phone.locator(`.race-lanes [data-lane="${lane}"]`).dispatchEvent('pointerdown');
    await sleep(900);
  }
  await screen.screenshot({ path: path.join(SHOTS, 'screen-racing.png') });
  await phone.screenshot({ path: path.join(SHOTS, 'phone-racing.png') });
  await ctl.screenshot({ path: path.join(SHOTS, 'host-racing.png'), fullPage: true });

  const pa = await sample(phone, 'canvas.race-road-canvas');
  check('the phone\'s road is painted', pa && pa.lit > 1000, JSON.stringify(pa));

  check('taps reached the projector as race events', events.length >= 2, `${events.length}`);
  check('a race event carries a kart NUMBER and nothing that identifies a phone',
    events.length > 0 && events.every((e) => {
      const o = JSON.parse(e);
      return Object.keys(o).sort().join(',') === 'at,id,lane,n'
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
  await steer(ann, 2);
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
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nPub Prix runs, end to end.');
process.exit(failures ? 1 : 0);
