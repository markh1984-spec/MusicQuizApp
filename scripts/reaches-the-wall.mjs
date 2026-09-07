#!/usr/bin/env node
/**
 * WHAT CHANGES ON THE WIRE REACHES THE WALL — the projector's card keys,
 * driven for real.
 *
 * ---
 *
 * A card key exists to be STABLE: the card is built once and refreshed in
 * place, or the projector flashes every time a phone pings. That makes a key
 * naming one field — or nothing at all — the projector's commonest fault, and
 * it is invisible from every direction that is not a screen:
 *
 *  - **A question corrected mid-quiz.** Rule 11 exists so a fix at nine
 *    o'clock reaches a quiz already on question four. The PUT returned 200,
 *    `reloadPackEverywhere()` ran, and `q:round:question` is the same string
 *    before and after — so the room kept reading the old prompt, and when the
 *    ANSWER moved the reveal lit the new index against the old options.
 *  - **A score fixed in front of the room.** `final` was `key: () => 'final'`
 *    with no `update`, so the wrong team was announced in gold at 13vh while
 *    the voucher went to whoever the engine actually had first. The round
 *    board had the same fault, keyed on *whether* there were scores.
 *  - **A big photo over a live question.** The queue chained `setTimeout`s
 *    nothing could reach, so photos posted at a round board went on landing
 *    through the next question — the stage scrimmed, the options greyed, the
 *    clock running — and the host's kill switch could not take them down.
 *
 * Every one of these passes `npm test`, `pub-unchanged` and every static
 * check: the PAYLOAD was right each time. Whether anybody drew it is a
 * different question, and this is the only thing here that asks it.
 *
 *   node scripts/reaches-the-wall.mjs
 *
 * Its own port, its own DATA_DIR, both cleaned up on the way out.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

import { startApp } from './helpers/live-app.mjs';

const KEY = 'wallcheck';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * The catalogue this writes to is a COPY — `live-app.mjs` gives every check
 * one, because this script SAVES a corrected question and `QUIZ_DIR` defaults
 * to the repository's own `quizzes/` folder.
 */
const { base: BASE, stop } = await startApp({ key: KEY });

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
  // A pack with MORE THAN ONE ROUND, so there is a round board to post a
  // photo at — a one-round quiz goes question, reveal, final, and the photo
  // half of this would skip itself while reporting green.
  const pack = (library.quizzes || []).find((q) => (q.rounds || []).length > 1);
  if (!pack) throw new Error('no quiz pack with more than one round');

  console.log('\nDOES A CHANGE ON THE WIRE REACH THE WALL?\n');

  const launched = await post('launch', { game: 'quiz', packId: pack.id, venue: 'The Crown' });
  check('a night is running', launched.status, 200);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`${BASE}/screen`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const wall = async () => (await page.evaluate(() =>
    document.getElementById('card')?.innerText || '')).replace(/\s+/g, ' ').trim();

  // A phone, so there is somebody to score and somebody to post a photo.
  const joined = await (await fetch(`${BASE}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Quizteam Aguilera' }),
  })).json();
  check('a phone is in the game', Boolean(joined.id), true);

  // ---- 1. a question corrected while it is on the screen
  await post('start', {});
  for (let i = 0; i < 8; i += 1) {
    const state = await (await fetch(`${BASE}/api/state?role=screen`)).json();
    if (state.phase === 'question') break;
    await post('next', {});
    await wait(120);
  }
  await page.waitForTimeout(1200);
  const before = await wall();
  check('a question is on the wall', before.length > 0, true);

  const full = await (await fetch(`${BASE}/api/quiz/${encodeURIComponent(pack.id)}`, {
    headers: { 'X-Host-Key': KEY },
  })).json();
  const quiz = full.quiz || full;
  const live = await (await fetch(`${BASE}/api/state?role=screen`)).json();
  const round = quiz.rounds[live.roundIndex];
  const question = round.questions[live.questionIndex];
  const CORRECTED = 'WHO SANG THIS, CORRECTED?';
  question.prompt = CORRECTED;
  const saved = await fetch(`${BASE}/api/quiz/${encodeURIComponent(pack.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify({ ...quiz, confirmLive: true }),
  });
  check('the correction saved', saved.status, 200);
  await page.waitForTimeout(1500);
  check('and it reached the wall', (await wall()).includes(CORRECTED), true);

  // ---- 2. a photo posted at a round board does not outlive the question
  for (let i = 0; i < 80; i += 1) {
    const state = await (await fetch(`${BASE}/api/state?role=screen`)).json();
    if (state.phase === 'round_board' || state.phase === 'final') break;
    await post('next', {});
    await wait(40);
  }
  const atBoard = await (await fetch(`${BASE}/api/state?role=screen`)).json();
  check('the night reached a round board', atBoard.phase, 'round_board');
  if (atBoard.phase === 'round_board') {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await fetch(`${BASE}/api/photo?playerId=${encodeURIComponent(joined.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png,
    });
    await page.waitForTimeout(900);
    const up = await page.evaluate(() => Boolean(document.getElementById('photoBig')));
    check('a photo takes the middle of the screen', up, true);

    // …and then the quiz moves on, well inside the photo's own 4.4 seconds.
    await post('next', {});
    await page.waitForTimeout(900);
    const still = await page.evaluate(() => Boolean(document.getElementById('photoBig')));
    check('and it is gone the moment the phase has no room for it', still, false);
  }

  // ---- 3. a score fixed at the final reaches the winner slide
  for (let i = 0; i < 40; i += 1) {
    const state = await (await fetch(`${BASE}/api/state?role=screen`)).json();
    if (state.phase === 'final') break;
    await post('next', {});
    await wait(60);
  }
  await page.waitForTimeout(1200);
  const finalNow = await (await fetch(`${BASE}/api/state?role=screen`)).json();
  check('the night reached the final', finalNow.phase, 'final');
  const shown = await wall();
  await post('adjustScore', { playerId: joined.id, delta: 9999 });
  await page.waitForTimeout(1500);
  const after = await wall();
  check('a score fixed at the final reaches the wall', after !== shown, true);
  check('and the wall names the team that actually won',
    after.includes('9,999') || after.includes('9999'), true);

  check('nothing threw', errors.join(' | ') || 'none', 'none');

  console.log(failures
    ? `\n${failures} failed — the projector is showing something the wire has moved on from.\n`
    : '\nEvery change reached the wall.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* already gone */ }
  stop();
}
