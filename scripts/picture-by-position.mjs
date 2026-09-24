#!/usr/bin/env node
/**
 * THE PICTURE STILL REACHES THE WALL — now that it is asked for by position.
 *
 *   node scripts/picture-by-position.mjs
 *
 * R2 of the 23 September 2026 sweep took the portrait's FILENAME — the answer
 * — out of the projector's payload: the projector is told where the question
 * is (`/quiz-images/q/<round>/<question>`) and the server answers only for a
 * question the room has been asked. `test/picture-answers.test.js` proves the
 * wire. This proves the WALL: a real projector on a real room's code, stepped
 * onto a picture question, with the `<img>` measured as decoded and drawn —
 * because a test that the payload is right proves nothing about whether
 * anybody drew it. A screenshot at 1280x720 goes beside it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const PACK = '2000-2010-pop-indie-and-rock';
const SHOT = process.env.SHOT_DIR || path.join(process.cwd(), 'shots');
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };

const { base: BASE, stop } = await startApp({
  key: 'picture-key',
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});
let browser;
try {
  const signIn = await fetch(`${BASE}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const host = (action, body) => fetch(`${BASE}/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body || {}) }).then((r) => r.json());
  const hostView = () => fetch(`${BASE}/api/state?role=host`, { headers: H }).then((r) => r.json());
  await host('launch', { game: 'quiz', packId: PACK });
  const code = (await (await fetch(`${BASE}/api/library`, { headers: H })).json()).joinCode;
  check('the room has a join code', Boolean(code));

  browser = await chromium.launch();
  const wall = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  wall.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await wall.goto(`${BASE}/screen?g=${encodeURIComponent(code)}`, { waitUntil: 'load' });
  await wall.waitForTimeout(1200);

  const pack = JSON.parse(fs.readFileSync(new URL(`../quizzes/${PACK}.json`, import.meta.url), 'utf8'));
  const RI = pack.rounds.findIndex((r) => r.type === 'image');
  await host('start', {});
  for (let i = 0; i < 120; i += 1) {
    const v = await hostView();
    if (v.roundIndex === RI && v.phase === 'question') break;
    await host('next', {});
  }
  await wall.waitForTimeout(2500);
  const img = await wall.evaluate(() => {
    const el = document.getElementById('zoomImg');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { src: el.getAttribute('src'), complete: el.complete, naturalWidth: el.naturalWidth, w: Math.round(r.width), h: Math.round(r.height), missing: Boolean(el.closest('.zoom-frame')?.classList.contains('no-image')) };
  });
  check('the projector is on the picture question', Boolean(img), 'no #zoomImg on the wall');
  check('it asked for the picture by POSITION, with its room on the address', Boolean(img && /\/quiz-images\/q\/\d+\/\d+\?g=/.test(img.src)), img && img.src);
  check('and never by name', Boolean(img && !/portraits\//.test(img.src)), img && img.src);
  check('the picture decoded and is drawn', Boolean(img && img.complete && img.naturalWidth > 0 && !img.missing && img.w > 100 && img.h > 100), JSON.stringify(img));
  fs.mkdirSync(SHOT, { recursive: true });
  const file = path.join(SHOT, 'picture-by-position.png');
  await wall.screenshot({ path: file });
  console.log(`  shot  ${file}`);
  check('nothing threw on the wall', errs.length === 0, errs.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the picture did not reach the wall` : '\nThe picture reaches the wall, asked for by where it is and never by what it is.');
process.exit(fails ? 1 : 0);
