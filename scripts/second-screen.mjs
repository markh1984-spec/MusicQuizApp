/**
 * THE SECOND SCREEN — does a photograph reach it, and can it ever show the quiz?
 *
 * ---
 *
 * Asked for as *"if I'm doing karaoke, then the karaoke screen uses one of the
 * output screens… I would need a second screen for that second QR code and
 * photo uploads."*
 *
 * Two things to prove and they pull in opposite directions:
 *
 *   - **it works with no game of this app's running at all**, which is the
 *     night it was built for — KaraFun owns the projector and this app is only
 *     collecting photographs;
 *   - **it cannot show the quiz**, which matters precisely because a second
 *     output ends up somewhere the host is not standing. That is rule 1 with a
 *     third screen in it, and the guarantee is STRUCTURAL — `wallView()` does
 *     not build a question — so this checks the payload rather than the CSS.
 *
 * And the one that breaks silently: **a photo posted while the wall is open has
 * to arrive on it.** Nothing else in this repo watches a `role=wall` push, and
 * a screen that draws perfectly and then never updates is the arcade board
 * again.
 *
 *     node scripts/second-screen.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'second-screen';
const OWNER = { email: 'wall@example.com', password: 'second-screen-password' };

const { Accounts } = await import('../src/accounts.js');
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Wall Check', role: 'owner' });

const { base: BASE, stop } = await startApp({ key: KEY, seed: seedOwner });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const host = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const browser = await chromium.launch();
try {
  const lib = (await host('/api/library')).body;
  const pack = (lib.quiz || lib.text || [])[0] || (lib.quizzes || [])[0];
  await host('/api/host/launch', { game: 'quiz', packId: pack.id, replace: true, venue: 'The Second Telly' });
  const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';
  const gq = joinCode ? `&g=${joinCode}` : '';

  const wallState = () => fetch(`${BASE}/api/state?role=wall${gq}`).then((r) => r.json());
  const screenState = () => fetch(`${BASE}/api/state?role=screen${gq}`).then((r) => r.json());

  /* ------------------------------------------- it is told about the room only */

  const w = await wallState();
  check('the wall answers at all', w.kind === 'wall', JSON.stringify(w).slice(0, 120));
  check('and whose night it is', Boolean(w.brand) && Boolean(w.scheme));
  check('and whether photos are on', w.open === true, String(w.open));

  /*
   * THE GUARANTEE, SWEPT RATHER THAN NAMED FIELD BY FIELD. A check on
   * `w.question` only catches the field somebody thought of; the projector's
   * own payload is the list of everything a screen COULD be told, so anything
   * of the game's arriving here fails.
   */
  const scr = await screenState();
  /*
   * THE TWO SCREENS AGREE ABOUT WHICH ROOM THEY ARE IN, which is the real
   * property — and it is stated this way because *"the wall knows a join
   * code"* is FALSE on the house room by design, where there is no code and
   * never was. A guard asserting a truth that only holds for some rooms fails
   * on the one the host key actually runs.
   */
  check('the second screen is in the same room as the projector',
    (w.joinCode || '') === (scr.joinCode || ''),
    `wall ${JSON.stringify(w.joinCode)} vs screen ${JSON.stringify(scr.joinCode)}`);
  /* And it is not being handed a phone's fields — `viewFor`'s `else` is the
   * PLAYER branch, which a new role falls into for free. */
  check('and it is not told the things a PHONE is told',
    !('photosOpen' in w) && !('photoDone' in w),
    Object.keys(w).filter((k) => k.startsWith('photo')).join(', '));
  /*
   * WHAT IS ALLOWED ON BOTH IS THE ROOM'S DRESSING, AND NOTHING ELSE.
   *
   * `brand`, `appName` and `scheme` are whose night it is; `look` is which
   * season it is wearing, chosen at launch beside the scheme and already six
   * feet wide on the projector and on every phone in the building. `/snap`
   * opens the same camera sheet a player's phone does, and its props tray is
   * dressed for the look — the bar's camera offering a different season would
   * be the app disagreeing with itself in one room.
   *
   * **A FIELD EARNS A PLACE HERE BY BEING A FACT ABOUT THE ROOM, NEVER ABOUT
   * THE GAME.** Adding one is how this sweep would quietly stop sweeping, so
   * the question to answer first is whether the room is already looking at it.
   */
  const shared = new Set(['brand', 'appName', 'scheme', 'look', 'joinCode', 'photos', 'kind']);
  const gameFields = Object.keys(scr).filter((k) => !shared.has(k));
  const leaked = gameFields.filter((k) => k in w);
  check('the second screen is told NOTHING about the game', leaked.length === 0,
    leaked.join(', '));
  check('…and the projector genuinely is, so that check means something',
    gameFields.length > 5, `${gameFields.length} game fields on the projector`);

  /* ------------------------------------------------ a real browser draws it */

  const wall = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const boom = [];
  wall.on('pageerror', (e) => boom.push(String(e)));
  await wall.goto(`${BASE}/wall${g}`);
  await wall.waitForSelector('.wall-qr img', { timeout: 10000 }).catch(() => {});

  check('a real second screen draws the code', await wall.locator('.wall-qr img').count() === 1,
    'every payload correct and nobody drew it');
  const qr = await wall.locator('.wall-qr img').boundingBox().catch(() => null);
  /*
   * A QR IS FOR SCANNING, so its SIZE is the feature. The lobby's own lesson —
   * a code measured at 166px on a page that does not scroll — and the number
   * here is deliberately generous: this screen has nothing else to spend
   * height on.
   */
  check('and it is big enough to scan from across a room',
    Boolean(qr) && qr.width >= 240, qr ? `${Math.round(qr.width)}px` : 'not drawn');
  check('and it says the address in words too',
    (await wall.locator('#wallUrl').textContent() || '').length > 4,
    'a camera that will not focus leaves somebody typing it');
  check('the empty side says so rather than sitting blank',
    await wall.locator('.wall-empty').count() === 1,
    'a blank half-screen reads as a screen that failed to load');

  /* -------------------------------------- and a photograph actually arrives */

  const maker = await browser.newPage();
  await maker.goto(`${BASE}/`);
  const b64 = await maker.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const x = c.getContext('2d');
    x.fillStyle = '#4c9'; x.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  });
  await maker.close();

  const player = await fetch(`${BASE}/api/join${g}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'The Back Table' }),
  }).then((r) => r.json());
  await fetch(`${BASE}/api/photo?playerId=${player.playerId || player.id}&camera=1${gq}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: Buffer.from(b64, 'base64'),
  });

  await wall.waitForSelector('.wall-shot', { timeout: 8000 }).catch(() => {});
  check('a photo posted from a phone LANDS on the second screen',
    await wall.locator('.wall-shot').count() === 1,
    'the push never reached a role nothing else in this repo watches');
  check('and it is named', (await wall.locator('.wall-shot figcaption').textContent() || '')
    .includes('Back Table'));
  check('and the empty note has gone', await wall.locator('.wall-empty').count() === 0);

  /* --------------------------------------------------------- ONE BUCKET */

  /*
   * *"I don't want to have two buckets of photos."* There is one, and the proof
   * is not that both screens SHOW a photograph — two separate stores would look
   * identical while both filled up. It is that acting on one acts on the other:
   * the host bins a picture and it leaves BOTH.
   *
   * That is the control quietly halved if the wall ever grew a list of its own.
   * Somebody asks for their photograph to come down, the host presses the bin,
   * and it goes off the projector while the screen by the door keeps showing
   * it — which on the night somebody actually asks is the worst half-measure
   * available.
   */
  const projector = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await projector.goto(`${BASE}/screen${g}`);
  await projector.waitForTimeout(1600);

  const onBoth = async () => ({
    projector: await projector.evaluate(() => document.querySelectorAll('.photo-strip .photo').length),
    wall: await wall.evaluate(() => document.querySelectorAll('.wall-shot').length),
  });

  const before = await onBoth();
  check('the SAME photograph is on the projector and the second screen',
    before.projector === 1 && before.wall === 1, JSON.stringify(before));

  const binned = await host('/api/host/photoRemove', { id: (await wallState()).photos[0].id });
  check('the host can bin it', binned.status === 200, JSON.stringify(binned.body));
  await projector.waitForTimeout(1600);

  const after = await onBoth();
  check('and binning it takes it off BOTH screens',
    after.projector === 0 && after.wall === 0,
    `${JSON.stringify(after)} — one control, two screens, or the bin is half a control`);
  await projector.close();

  /* Put one back, so the checks below still have something to look at. */
  await fetch(`${BASE}/api/photo?playerId=${player.playerId || player.id}&camera=1${gq}`, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: Buffer.from(b64, 'base64'),
  });
  await wall.waitForTimeout(1400);

  /* ------------------------ the quiz moves and this screen does not follow it */

  await host('/api/host/start', {});
  await host('/api/host/next', {});
  await wall.waitForTimeout(900);
  const text = await wall.locator('.stage').innerText();
  check('starting the quiz changes nothing on the second screen',
    await wall.locator('.wall-qr img').count() === 1
      && !/round|question|score/i.test(text),
    text.slice(0, 120).replace(/\n/g, ' | '));

  /* ---------------------------------- the switch is answered on the screen */

  await host('/api/host/photosOn', { on: false });
  await wall.waitForTimeout(900);
  check('switching photos off SAYS so rather than leaving a dead code up',
    await wall.locator('.wall-shut').count() === 1,
    'a QR inviting a room to send photos the server refuses, six feet wide');
  await host('/api/host/photosOn', { on: true });
  await wall.waitForTimeout(900);
  check('and switching them back on fills it in again',
    await wall.locator('.wall-qr img').count() === 1
      && await wall.locator('.wall-shot').count() === 1,
    'it recovered the code but not the photographs, or neither');

  /* ------------------------------------------- and NOTHING is clipped away */

  /*
   * BOTH AXES, AT BOTH SHAPES, AND THE VERTICAL ONE IS THE ONE THAT BIT.
   *
   * `body.screen` is `overflow: hidden` by decision — *the projector is the one
   * that does not scroll* — so anything past the bottom is not a scroll
   * somebody can reach, it is GONE. The first build measured only the
   * horizontal axis at 1280x720 and passed; at 720x1280 the QR took 46vh of a
   * tall screen and shoved 106px of photographs off the end. A guard that
   * names one axis at one size is the *`console-frame.mjs` looked at 390 and
   * 960* lesson, wearing a second screen.
   *
   * The portrait shape is not hypothetical here: a second output is usually a
   * telly on a stand or a tablet, which is the way this feature will most often
   * be used.
   */
  /*
   * MEASURED TWICE UNTIL IT AGREES WITH ITSELF.
   *
   * The first version read the box the instant `.wall-shot` appeared and got
   * 10px of overflow that a second look could never reproduce — the images are
   * `loading="lazy"` and the grid is still settling. `setViewportSize()` in a
   * loop is non-deterministic here* is the same lesson: a layout number taken
   * mid-reflow is not a fact about the layout. Polling until two readings match
   * fails a REAL overflow (which is stable) and stops reporting a race.
   */
  const settled = async (page, read) => {
    let last = null;
    for (let i = 0; i < 12; i += 1) {
      const now = await page.evaluate(read);
      if (last && JSON.stringify(last) === JSON.stringify(now)) return now;
      last = now;
      await page.waitForTimeout(150);
    }
    return last;
  };

  const fits = async (page, what) => {
    const m = await settled(page, () => {
      /*
       * `scrollHeight` IS A LIE ON THIS PAGE, AND PROVING THAT COST AN HOUR.
       *
       * `body.screen` is `overflow: hidden`, so the document is CLAMPED to the
       * viewport — `document.documentElement.scrollHeight - innerHeight` reads
       * 0 no matter how far the content runs past the bottom. The first version
       * of this check used exactly that, and it passed with the heading set to
       * 22vh: content four times too tall, reported as fitting.
       *
       * So it asks the ELEMENTS where they end. That is the same distinction
       * `console-frame.mjs` exists for — *in the document*, *has a size* and
       * *somebody can see it* are three questions — and here it is the third
       * one, on a screen that by decision cannot scroll to reveal the answer.
       */
      const far = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().bottom) : 0;
      };
      const wide = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().right) : 0;
      };
      return {
        x: Math.max(wide('.wall-ask'), wide('.wall-shots')) - window.innerWidth,
        y: Math.max(far('.wall-ask'), far('.wall-shots')) - window.innerHeight,
        qr: (() => {
          const el = document.querySelector('.wall-qr img');
          return el ? Math.round(el.getBoundingClientRect().width) : 0;
        })(),
        shots: document.querySelectorAll('.wall-shot').length,
      };
    });
    check(`nothing is clipped ${what}`, m.x <= 0 && m.y <= 0,
      `${m.x}px across, ${m.y}px down — and this screen cannot scroll`);
    check(`and the code is still scannable ${what}`, m.qr >= 200, `${m.qr}px`);
    // MORE THAN ONE, deliberately: a single row fits any screen, so "photos are
    // drawn" with one of them is the check passing by not trying.
    check(`and the photographs are still drawn ${what}`, m.shots > 4, `${m.shots}`);
  };

  /*
   * ENOUGH PHOTOGRAPHS TO FILL THE GRID, or this measures nothing.
   *
   * The first version of the portrait leg ran with the ONE photo posted above
   * and reported no overflow — while the real page, with four, was losing 106px
   * off the bottom. A grid of one row fits anything. This is *a guard that is
   * satisfied by nothing having happened* wearing a layout check, and the fix
   * is the same one every time: make the thing actually happen first.
   */
  for (let i = 0; i < 8; i += 1) {
    await fetch(`${BASE}/api/photo?playerId=${player.playerId || player.id}&camera=1${gq}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: Buffer.from(b64, 'base64'),
    });
  }

  await fits(wall, 'on a landscape screen');

  const tall = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  const tallBoom = [];
  tall.on('pageerror', (e) => tallBoom.push(String(e)));
  await tall.goto(`${BASE}/wall${g}`);
  await tall.waitForSelector('.wall-shot', { timeout: 10000 }).catch(() => {});
  await fits(tall, 'on a screen stood on its end');

  check('nothing threw', boom.length === 0 && tallBoom.length === 0,
    [...boom, ...tallBoom].join(' | '));
} finally {
  await browser.close().catch(() => {});
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
