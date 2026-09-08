#!/usr/bin/env node
/**
 * DOES ANYBODY ACTUALLY PLAY THE FIVE GAMES? — a real browser, a real phone
 * viewport, and a finger on each one.
 *
 * ---
 *
 * **THERE ARE 94 UNIT TESTS ACROSS THE FIVE GAMES AND NOT ONE OF THEM HAS
 * EVER DRAWN A PIXEL.** They exercise `step()`, `turnFrom()`, the tick
 * accumulator and the schedules — the pure halves, correctly, and that is the
 * half that was never going to be the problem. This repo's own most expensive
 * lesson is the other half: *a test that never runs the artefact proves
 * nothing about it*, and *a dead control draws perfectly*. The lobby game is
 * the exact shape that fault likes — a canvas built inside a hidden box, wired
 * by one module, loaded on demand, with a `catch` around the press.
 *
 * The arcade BOARD is the precedent and it is not a hypothetical: it was
 * computed and never drawn **for as long as the feature existed**, while the
 * phone promised sixty people *"Top scores go on the big screen"*. Everything
 * about the payload was right. Nobody had looked.
 *
 * So this drives what a player does:
 *
 *   1. opens the game card on a 390px phone,
 *   2. switches to each of the five games in turn,
 *   3. checks the canvas is REACHABLE, PAINTED and MOVING,
 *   4. plays it, and waits for a score to reach the room,
 *   5. checks the board draws on the projector.
 *
 * **PAINTED AND MOVING ARE TWO QUESTIONS, and a canvas answers neither by
 * existing.** `querySelector` finds a canvas that never had a context;
 * `getClientRects` finds one that is blank; a blank one and a FROZEN one look
 * identical in a screenshot. So the pixels are sampled twice with input driven
 * in between: not blank, and not the same. A game whose loop never started, or
 * stopped when it was switched, fails on the second sample.
 *
 * **AND SWITCHING IS ITS OWN HAZARD.** `stopArcade()` has to run first and the
 * canvas has to be reshaped, or a loop banks under the wrong game — so every
 * game here is reached by SWITCHING to it from the one before, which is the
 * path a player takes and the one that can leak a loop.
 *
 * A console error anywhere in the run is a failure. The click handler has a
 * `catch`, which is how a gap dial died twice in a week with every check green.
 *
 *   node scripts/lobby-games-play.mjs            # all five
 *   node scripts/lobby-games-play.mjs --shots    # …and write screenshots
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { withApp } from './helpers/live-app.mjs';
import { ANY_LOBBY_GAME } from '../public/assets/lobby-games.js';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(os.tmpdir(), 'lobby-games');

/* The five, in tier order — the same list the server and the browser read. */
const GAMES = [
  { id: 'maze', name: 'Maze Mouth', tier: 'bronze' },
  { id: 'rally', name: 'Rally', tier: 'bronze' },
  { id: 'tailback', name: 'Tailback', tier: 'silver' },
  { id: 'quickdraw', name: 'Quick Draw', tier: 'gold' },
  { id: 'lastorders', name: 'Last Orders', tier: 'gold' },
];

let failures = 0;
/*
 * THE DETAIL IS THE FAILURE'S, NOT THE LINE'S. Printed on a pass it reads as
 * its own contradiction — "ok … 21 colours — a blank canvas" — which is the
 * *comment that claims the opposite* trap wearing a log line, on the one
 * output somebody skims at speed.
 */
const check = (what, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${!ok && detail ? ` — ${detail}` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await withApp(async ({ base, key, stop }) => {
  const packId = fs.readdirSync('quizzes').filter((f) => f.endsWith('.json'))[0]
    .replace(/\.json$/, '');

  /*
   * `lobbyGame: ANY_LOBBY_GAME` IS WHAT PUTS THE CHOOSER ON THE PHONE, and
   * leaving it out is how this script failed its own first run: without it the
   * night resolves to ONE game, **a list of one is deliberately dropped**, and
   * the box opens with no tiles in it. That is the app behaving correctly and
   * the guard measuring the wrong night — the same fault as a bay measured
   * idle. The list is then resolved at the ROUTE against the account's tier,
   * so what comes back is also the assertion that an owner is offered all five.
   */
  await fetch(`${base}/api/host/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': key },
    body: JSON.stringify({ game: 'quiz', packId, replace: true, lobbyGame: ANY_LOBBY_GAME }),
  });
  const running = ((await (await fetch(`${base}/api/library`, {
    headers: { 'X-Host-Key': key },
  })).json()).running || {});
  const g = running.joinCode ? `?g=${running.joinCode}` : '';

  const browser = await chromium.launch();
  // A phone, at the size this is actually held at.
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true,
  });

  /*
   * EVERY ERROR IS A FAILURE, and this is the point of running it in a browser
   * at all. `wireArcade`'s press is inside a try/catch, so a lost import or a
   * moved body is a ReferenceError that is swallowed whole — the game simply
   * does not start and the card looks fine.
   */
  const noise = [];
  page.on('pageerror', (err) => noise.push(`pageerror: ${err.message}`));
  page.on('console', (m) => { if (m.type() === 'error') noise.push(`console: ${m.text()}`); });

  await page.goto(`${base}/play${g}`, { waitUntil: 'domcontentloaded' });

  // Join, the way a phone does.
  const nameBox = page.locator('input[name="name"], #name, input[type="text"]').first();
  await nameBox.fill('Tester');
  await page.locator('button[type="submit"], .join-go, button:has-text("Join")').first().click();
  await page.waitForTimeout(1200);

  /*
   * WHAT THE ROOM WAS GIVEN IS READ OFF THE PHONE, NOT THE PROJECTOR. The
   * first version asked `?role=screen` and printed "given: nothing" under a
   * chooser holding five tiles — because the game list is a PHONE's business
   * and the projector's payload rightly never carries it. A log line that
   * disagrees with the assertions beneath it is worse than no log line.
   */
  console.log(`\nA phone at 390x844, in the lobby of "${running.title || packId}"\n`);

  /* ---- the card opens at all ------------------------------------------ */

  const openBtn = page.locator('.arcade-open');
  check('the game card is on the phone', await openBtn.count() === 1);
  if (await openBtn.count() !== 1) { await browser.close(); stop(); return; }

  // PUT A FINGER ON IT: in the document, sized, and not painted over.
  const pressable = await page.evaluate(() => {
    const b = document.querySelector('.arcade-open');
    const r = b?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return 'no box';
    b.scrollIntoView({ block: 'center' });
    const at = b.getBoundingClientRect();
    const hit = document.elementFromPoint(at.left + at.width / 2, at.top + at.height / 2);
    return b.contains(hit) || hit === b ? 'yes' : `covered by ${hit?.className || hit?.tagName}`;
  });
  check('…and a finger reaches it', pressable === 'yes', pressable);

  await openBtn.click();
  await page.waitForTimeout(400);
  check('pressing it opens the chooser', await page.locator('.arcade-box').isVisible());

  const offered = await page.evaluate(() => [...document.querySelectorAll('.arcade-pick-one')]
    .map((b) => b.dataset.game));
  check('all five games are offered', offered.length === GAMES.length,
    `${offered.length} tiles: ${offered.join(', ') || 'none'}`);
  console.log(`  The phone was offered: ${offered.join(', ') || 'nothing'}\n`);

  /* ---- each game in turn, reached by SWITCHING ------------------------- */

  const played = [];
  for (const game of GAMES) {
    const tile = page.locator(`.arcade-pick-one[data-game="${game.id}"]`);
    if (await tile.count() !== 1) { check(`${game.name}: is offered`, false); continue; }

    await tile.click();
    await page.waitForTimeout(500);

    const shape = await page.evaluate(() => {
      const c = document.querySelector('.arcade-canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { w: c.width, h: c.height, onScreen: r.width > 0 && r.height > 0, klass: c.className };
    });
    check(`${game.name}: the canvas is there and on screen`, Boolean(shape?.onScreen),
      shape ? `${shape.w}x${shape.h}` : 'no canvas');
    if (!shape?.onScreen) continue;

    /*
     * PAINTED AND MOVING. A fingerprint of the pixels now, input, then again:
     * all-one-colour is a game that never drew, and identical is one whose
     * loop is not running — which is what a switch that failed to start, or a
     * teardown that killed the wrong game, actually looks like.
     */
    const shot = () => page.evaluate(() => {
      const c = document.querySelector('.arcade-canvas');
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0; const seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 37) {
        sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 2147483647;
        seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      }
      return { sum, colours: seen.size };
    });

    const first = await shot();
    check(`${game.name}: it is actually painted`, first.colours > 1,
      `${first.colours} colour(s) — a blank canvas`);

    // Play it: taps where a thumb lands, and the keys a laptop would use.
    const box = await page.locator('.arcade-canvas').boundingBox();
    for (const [dx, dy] of [[0.5, 0.8], [0.2, 0.5], [0.8, 0.5], [0.5, 0.2]]) {
      await page.mouse.click(box.x + box.width * dx, box.y + box.height * dy);
      await page.keyboard.press(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'][Math.floor(dx * 3)]);
      await wait(220);
    }

    const second = await shot();
    check(`${game.name}: the loop is running`, second.sum !== first.sum,
      'the canvas never changed — a game that is not ticking');

    if (SHOTS) {
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      await page.locator('.arcade-box').screenshot({
        path: path.join(SHOT_DIR, `${game.id}.png`),
      });
    }
    played.push(game);
  }

  /* ---- and does a score reach the room? -------------------------------- */

  /*
   * ONE POST LEAVES A PHONE, at game over and at each life lost — so a score
   * arrives by PLAYING BADLY, which is what idling on a chaser game does. The
   * window is generous because five games lose a life at five different rates;
   * what is NOT tolerated is nothing ever arriving, which would mean the whole
   * scoreboard is decoration.
   */
  let board = {};
  for (let i = 0; i < 40; i += 1) {
    await wait(500);
    const s = await (await fetch(`${base}/api/state?role=screen${g ? `&g=${running.joinCode}` : ''}`)).json();
    board = s.arcade || {};
    if (Object.keys(board).length) break;
  }
  check('a score reaches the room', Object.keys(board).length > 0,
    'nothing ever banked — the board would be empty all night');

  /* ---- the board on the projector -------------------------------------- */

  const big = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await big.goto(`${base}/screen${g}`, { waitUntil: 'domcontentloaded' });
  await big.waitForTimeout(1500);
  const drawn = await big.evaluate(() => {
    const el = document.querySelector('.lobbyboard, .arcade-board, [class*="board"]');
    if (!el) return { there: false };
    const r = el.getBoundingClientRect();
    return { there: true, painted: r.width > 0 && r.height > 0, text: (el.textContent || '').trim().slice(0, 80) };
  });
  check('the projector draws the board at the lobby', Boolean(drawn.there && drawn.painted),
    drawn.there ? `${drawn.painted ? drawn.text : 'zero size'}` : 'nothing on the projector');
  if (SHOTS) {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await big.screenshot({ path: path.join(SHOT_DIR, 'projector-board.png') });
  }

  check('no errors on the phone all run', noise.length === 0, noise.slice(0, 3).join(' | '));

  console.log(`\nPlayed: ${played.map((p) => p.name).join(', ') || 'none'}`);
  if (SHOTS) console.log(`Screenshots: ${SHOT_DIR}`);
  await browser.close();
});

console.log(failures
  ? `\n${failures} problem${failures === 1 ? '' : 's'} with the lobby games.`
  : '\nAll five lobby games draw, run and reach the room.');
process.exit(failures ? 1 : 0);
