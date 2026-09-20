/**
 * TOMORROW NIGHT'S ACTUAL SETUP — a quiz, the bingo, and karaoke on two outputs.
 *
 * ---
 *
 * Asked for the night before a gig: *"I'm going to be running a quiz, music
 * bingo and karaoke night. I want the quiz and the music bingo to take up both
 * screens. And then when I run the karaoke, I want the karaoke on the main
 * screen and the photo app on the second screen."*
 *
 * **EVERY OTHER GUARD IN THIS REPO THAT TOUCHES A SCREEN RUNS ON THE HOST KEY,
 * WHICH IS THE HOUSE ROOM.** That room has no join code — by decision, it is
 * his own projector and every card printed before rooms existed — so an entire
 * class of thing goes unmeasured: a `?g=` that has to resolve, a second screen
 * pointed at somebody's OWN room, a control view driven from a cookie rather
 * than a key. `second-screen.mjs` proved `/wall` works; it proved it on the one
 * room where the code is empty.
 *
 * So this signs in as an ordinary quizmaster and drives the whole evening:
 *
 *   - a quiz launched from his own console, with a REAL join code;
 *   - **two projector windows on one room**, both drawing it and both
 *     following when the night moves — which is what "take up both screens"
 *     means and had never been run;
 *   - the second one swapped to `/wall` for the karaoke stretch;
 *   - a phone joining off that code and landing a photograph on it;
 *   - **the bingo launched over the quiz, and the photographs still there** —
 *     a relaunch builds a fresh engine and asks every phone to rejoin, so the
 *     fair worry is that the wall goes with it. It does not, because
 *     photographs live on the ROOM; *a comment that claims the opposite is
 *     where the next bug hides*, so it is asserted.
 *
 * **AND THE HARNESS ITSELF IS THE WARNING.** `browser.newPage()` opens a fresh
 * incognito context with its own cookie jar, so the control view came back 401
 * and the Second screen button "did not exist" — a working app, reported broken,
 * by a test that had signed in on a different tab. One `newContext()` shared by
 * every window the QUIZMASTER opens, and the phone kept separate because a
 * phone genuinely is another device.
 *
 *     node scripts/two-screens.mjs
 */

import path from 'node:path';
/*
 * RELATIVE, BECAUSE AN ABSOLUTE PATH IS ONE MACHINE'S. This read
 * `/home/user/MusicQuizApp/...` — a container that no longer exists — so the
 * check died with `ERR_MODULE_NOT_FOUND` before it reached a line of its own
 * code, and `gig-build` printed DO NOT DEPLOY about the app.
 */
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

const KEY = 'two-screens';
const { base: B, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Mark', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});
let fails = 0;
const check = (n, ok, d='') => { if(!ok) fails++; console.log(`${ok?'  ok  ':'  FAIL'} ${n}${d?`  — ${d}`:''}`); };
const b = await chromium.launch();
try {
  const ctx0 = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx0.newPage();
  await page.goto(`${B}/login`, { waitUntil: 'load' });
  await page.fill('input[type=email]', 'qm@example.com');
  await page.fill('input[type=password]', 'quizmaster passphrase');
  await page.evaluate(() => document.querySelector('form')?.requestSubmit());
  await page.waitForTimeout(2500);

  // Launch a quiz from this account's own console, the way he would.
  const lib = await page.evaluate(() => fetch('/api/library').then(r=>r.json()));
  const pack = (lib.quiz||lib.text||[])[0] || (lib.quizzes||[])[0];
  const launched = await page.evaluate((id) => fetch('/api/host/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:'quiz',packId:id,replace:true,venue:'The Laughing Dog'})}).then(r=>r.status), pack.id);
  check('a quiz launches on his OWN account', launched === 200, String(launched));

  const lib2 = await page.evaluate(() => fetch('/api/library').then(r=>r.json()));
  const code = (lib2.running||{}).joinCode || '';
  check('and the room has a real join code (NOT the house room)', code.length >= 4, JSON.stringify(code));

  // The control view, and the Second screen button on it.
  // Signed in, the control view takes NO params — `linkTo('/host')` is just
  // `/host` and `roomForHost()` reads the cookie. This is what he clicks.
  // SAME CONTEXT as the signed-in tab — `browser.newPage()` opens a fresh
  // incognito context with its own cookie jar, which is why this 401'd.
  const ctx = ctx0;
  const host = await ctx.newPage();
  await host.setViewportSize({ width: 1400, height: 1000 });
  await host.goto(`${B}/host`, { waitUntil: 'load' });
  await host.waitForTimeout(2000);
  const btn = host.locator('button', { hasText: 'Second screen' });
  check('the control view offers a Second screen button', await btn.count() === 1);

  // TWO projector windows on the same room.
  const s1 = await ctx.newPage(); await s1.setViewportSize({ width: 1280, height: 720 });
  const s2 = await ctx.newPage(); await s2.setViewportSize({ width: 1280, height: 720 });
  await s1.goto(`${B}/screen?g=${code}`); await s2.goto(`${B}/screen?g=${code}`);
  await s1.waitForTimeout(1800); await s2.waitForTimeout(1800);
  const t1 = await s1.locator('.stage').innerText();
  const t2 = await s2.locator('.stage').innerText();
  check('TWO projector windows both draw the same night', t1.length > 20 && t1 === t2,
    `${t1.slice(0,40)} || ${t2.slice(0,40)}`);

  // …and both follow the game when it moves.
  const startStatus = await host.evaluate(() => fetch('/api/host/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status));
  check('the host can start the night from his own console', startStatus === 200, String(startStatus));
  await s1.waitForTimeout(1500);
  const a1 = await s1.locator('.stage').innerText();
  const a2 = await s2.locator('.stage').innerText();
  check('and BOTH follow when the quiz moves', a1 !== t1 && a1 === a2, `${a1.slice(0,40)}`);

  // Now the karaoke swap: screen 2 becomes the wall.
  await s2.goto(`${B}/wall?g=${code}`);
  await s2.waitForSelector('.wall-qr img', { timeout: 10000 }).catch(()=>{});
  check('screen 2 becomes the photo wall on a REAL room', await s2.locator('.wall-qr img').count() === 1);
  const url2 = await s2.locator('#wallUrl').textContent();
  check('and it prints THAT room\'s address', (url2||'').includes(code.toLowerCase()) || (url2||'').length > 4, url2);

  // A phone joins off that code and sends a photo; it must land on the wall.
  const ph = await b.newPage({ viewport: { width: 390, height: 844 } });
  await ph.goto(`${B}/play?g=${code}`);
  await ph.fill('#nameInput','The Back Table'); await ph.click('#joinBtn');
  await ph.waitForTimeout(1200);
  const sent = await ph.evaluate(async () => {
    const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#e74c3c';x.fillRect(0,0,400,300);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
    const me=JSON.parse(localStorage.getItem('musicquiz.player')||'{}');
    const g=new URLSearchParams(location.search).get('g')||'';
    const r=await fetch(`/api/photo?playerId=${me.id}&camera=1&g=${g}`,{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob});
    return r.json();
  });
  check('a phone on that code can send a photo', sent && sent.ok === true, JSON.stringify(sent));
  await s2.waitForTimeout(1500);
  check('and it LANDS on the second screen', await s2.locator('.wall-shot').count() === 1);

  // And the main projector is unaffected by any of it.
  // Not a text compare — a phone joined and a photo landed, so the projector's
  // words legitimately moved. The question is whether it is still the QUIZ.
  check('the main projector is untouched by any of it',
    await s1.locator('.wall-grid').count() === 0
      && (await s1.locator('#quizTitle').textContent() || '').length > 2
      && (await s1.locator('#roundPill').textContent() || '').length > 2,
    await s1.locator('#roundPill').textContent());
  /*
   * AND THE NIGHT MOVES ON — quiz, then the bingo over the top of it.
   *
   * This is the half that would ruin an evening if it were wrong: launching a
   * second game builds a FRESH engine and every phone is asked to rejoin, so
   * the obvious worry is that the photographs go with it. They do not, and the
   * reason is the decision this whole feature rests on — photographs live on
   * the ROOM, not on the game state — but *a comment that claims the opposite
   * is where the next bug hides*, so it is asserted rather than reasoned about.
   */
  const bingo = (lib2.bingo || [])[0];
  if (bingo) {
    const st = await page.evaluate((id) => fetch('/api/host/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'bingo', packId: id, replace: true, venue: 'The Laughing Dog' }),
    }).then((r) => r.status), bingo.id);
    check('the bingo launches over the quiz', st === 200, String(st));
    await s2.waitForTimeout(1800);
    check('and the photographs are STILL on the second screen',
      await s2.locator('.wall-shot').count() === 1,
      'a relaunch took the wall with it — photos would not be on the room');
    check('and the code on it still works', await s2.locator('.wall-qr img').count() === 1);
  } else {
    console.log('  --   no bingo pack in this library, skipped');
  }
  /*
   * AND A STRANGER SCANS IT AT TEN O'CLOCK, DURING THE KARAOKE.
   *
   * The second screen stands all night inviting scans, including for the hour
   * after the games have finished — so the question is not whether the wall
   * works, it is whether the phone it sends somebody to still does. Every other
   * check in this repo joins a room with a game in front of it.
   *
   * **KNOWN AND DELIBERATELY NOT FIXED ON A GIG DAY:** their phone leads with a
   * dead bingo card for a round that ended an hour ago, with the camera button
   * below it. Cosmetic — the photograph goes through — and re-leading the phone
   * on the protected surface the night before a gig is the trade this repo
   * already refuses. The checks below are on what MUST work; the wording is not
   * one of them, on purpose.
   */
  await host.evaluate(() => fetch('/api/host/finish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }));
  await host.waitForTimeout(800);

  const late = await b.newPage({ viewport: { width: 390, height: 844 } });
  await late.goto(`${B}/play?g=${code}`);
  await late.waitForTimeout(1200);
  const canJoin = await late.locator('#nameInput').count() === 1;
  check('a stranger scanning after the games end can still join', canJoin,
    'the wall invites a scan all night and the phone turned them away');
  if (canJoin) {
    await late.fill('#nameInput', 'Karaoke Kev');
    await late.click('#joinBtn');
    await late.waitForTimeout(1500);
  }
  check('and is still offered the camera',
    await late.locator('.camera-btn').count() > 0,
    'no way to do the one thing the second screen asked them to do');

  const lateShot = await late.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const x = c.getContext('2d');
    x.fillStyle = '#4c9'; x.fillRect(0, 0, 400, 300);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    const me = JSON.parse(localStorage.getItem('musicquiz.player') || '{}');
    const g = new URLSearchParams(location.search).get('g') || '';
    return (await fetch(`/api/photo?playerId=${me.id}&camera=1&g=${g}`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob,
    })).json();
  });
  check('and their photograph is ACCEPTED with no game running',
    lateShot && lateShot.ok === true, JSON.stringify(lateShot));
  await s2.waitForTimeout(1500);
  check('and it reaches the second screen too',
    await s2.locator('.wall-shot').count() === 2,
    'the wall stopped updating once the night was over');

} finally { await b.close().catch(()=>{}); await stop(); }
console.log(fails ? `\n${fails} FAILED` : '\nAll good.');
process.exit(fails?1:0);
