/**
 * THE GOOGLY EYES — do the props actually go on a photograph, on both cameras?
 *
 * ---
 *
 * Asked for on 16 September 2026: *"the camera photo upload thingy doesn't have
 * sticker options when the camera QR code comes from the community bit — can I
 * have the googly eyes etc. functionality in both pls"*.
 *
 * **THIS WAS WRITTEN BEFORE THE SHEET WAS MOVED, NOT AFTER.** `openCamera()` is
 * 610 lines of pointer handling and **nothing in this repo drove one line of
 * it** — `prop-edges.mjs` renders each prop's ARTWORK and never opens the
 * sheet. Moving that much drag code with no guard under it is the fault this
 * project has a name for: *a dead control draws perfectly*, and the gap dial
 * died twice in one week exactly that way. So this pins the behaviour on
 * `/play` first, and only then is the same assertion pointed at `/snap`.
 *
 * **A PROP IS PLACED BY A REAL POINTER DRAG, never a click.** The chips listen
 * for `pointerdown`/`pointermove`/`pointerup` and drop the prop where the
 * finger lets go — so a synthesised click proves nothing, the same lesson
 * `drag-check.mjs` records about `DragEvent`. Playwright's mouse is used
 * throughout.
 *
 * **AND THE CANVAS IS SAMPLED, because a prop that is "in the items array" is
 * not a prop anybody can see.** *Painted and moving are two questions and a
 * canvas answers neither by existing* — `lobby-games-play.mjs`'s rule, and it
 * applies to anything drawn rather than laid out.
 *
 *     node scripts/props-on-a-photo.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'props-photo';
const QM = { email: 'qm@example.com', password: 'quizmaster passphrase' };

const { base: BASE, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import('/home/user/MusicQuizApp/src/accounts.js');
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    book.create({ ...QM, name: 'Mark', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();
try {
  const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desk = await deskCtx.newPage();
  await desk.goto(`${BASE}/login`, { waitUntil: 'load' });
  await desk.fill('input[type=email]', QM.email);
  await desk.fill('input[type=password]', QM.password);
  await desk.evaluate(() => document.querySelector('form')?.requestSubmit());
  await desk.waitForTimeout(2500);

  const api = (route, body) => desk.evaluate(([r, b]) => fetch(r, {
    method: b ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(b ? { body: JSON.stringify(b) } : {}),
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) })), [route, body || null]);

  const lib = (await api('/api/library')).body;
  const pack = (lib.quiz || lib.text || [])[0] || (lib.quizzes || [])[0];
  /*
   * A SEASONAL LOOK, BECAUSE THE DEFAULT ONE IS THE HALF THAT CANNOT BREAK.
   *
   * This ran on `default`, where `stickersFor()` returns an EMPTY seasonal
   * tray — so the whole seasonal branch of the sheet never executed, and a
   * `ReferenceError` on `LOOKS` in that branch shipped with this guard green,
   * `node --check` happy and 1996 tests passing. On Halloween, Christmas,
   * Valentines, summer, Eurovision or an international night the camera drew
   * NOTHING on either page.
   *
   * Halloween rather than a tour of all six: one look proves the branch runs,
   * and the six differ only in which drawings are in the tray.
   */
  await api('/api/host/launch', { game: 'quiz', packId: pack.id, replace: true, venue: 'The Googly Arms', look: 'halloween' });
  const joinCode = ((await api('/api/library')).body.running || {}).joinCode || '';
  check('a night is up with a join code', joinCode.length >= 4, joinCode);

  // A real JPEG for the file input — nothing here encodes one.
  const maker = await browser.newPage();
  await maker.goto(`${BASE}/login`);
  const b64 = await maker.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900; c.height = 600;
    const x = c.getContext('2d');
    x.fillStyle = '#23304a'; x.fillRect(0, 0, 900, 600);
    x.fillStyle = '#d8c39a'; x.beginPath(); x.arc(450, 300, 150, 0, 7); x.fill();
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  await maker.close();
  const JPEG = Buffer.from(b64, 'base64');

  /**
   * Open a camera sheet, put a photo in it, drag a prop onto it, and report
   * what happened at every step. The SAME function is pointed at both pages —
   * that is the whole point of the exercise.
   */
  async function driveSheet(page, label, { loaded = false } = {}) {
    await page.waitForSelector('.cam-sheet', { timeout: 15000 });
    // `/snap` hands the photograph in at open time — its own shutter is the
    // first press, so the sheet arrives with a picture already on it.
    if (!loaded) {
      await page.setInputFiles('.cam-pick input[type="file"]', {
        name: 'the-room.jpg', mimeType: 'image/jpeg', buffer: JPEG,
      });
    }
    /*
     * `.cam-stage` IS THE SIGNAL, not the canvas. The first version waited for
     * `canvas.width > 0` — which a canvas satisfies before anything is drawn on
     * it, because the default is 300 — so the guard sailed past a photo that
     * had not loaded and then blamed the prop handler, whose very first line is
     * `if (!source) return`. *In the document and has a size are different
     * questions*, and this repo has been bitten by it more times than that.
     */
    await page.waitForSelector('.cam-stage:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(500);

    const chips = await page.locator('.cam-props:not(.cam-props-season) .cam-prop').count();
    check(`${label}: the props tray is drawn`, chips > 0, `${chips} props`);
    if (!chips) return;

    /*
     * AND THE SEASONAL ROW, WHICH IS A DIFFERENT BRANCH OF THE SAME BUILD.
     * Setting the look above buys nothing unless something looks at what it
     * drew — the tray heading is named from `LOOKS`, which is exactly the
     * statement that was missing.
     */
    const season = await page.locator('.cam-props-season .cam-prop').count();
    const seasonName = (await page.locator('.cam-season-name').textContent().catch(() => '')) || '';
    check(`${label}: the seasonal row is drawn too`, season > 0, `${season} seasonal props`);
    check(`${label}: and the season is NAMED on it`, /halloween/i.test(seasonName), JSON.stringify(seasonName));

    // What the picture looks like before anything is stuck on it. Sampled off
    // the canvas rather than read out of a state object: a prop in an array is
    // not a prop anybody can see.
    const shot = () => page.evaluate(() => {
      const c = document.querySelector('.cam-canvas');
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.join(',').length
        + ':' + c.toDataURL().length;
    });
    const before = await shot();

    /*
     * A TAP places it in the middle; press-and-HOLD lifts it to be dragged.
     * Getting this wrong is what the first version of this guard did: it moved
     * the pointer straight off the chip, which the handler reads as SCROLLING
     * (more than 10px before the hold lands) and cancels — so nothing was
     * placed and the app looked broken when the gesture was.
     */
    /*
     * AND THE CHIP HAS TO BE ON THE SCREEN BEFORE IT IS MEASURED.
     * `boundingBox()` is VIEWPORT-relative, and the tray sits at y=833 in a
     * 780px phone — so the first version took a coordinate that is off the
     * bottom of the window, aimed the mouse at it, hit nothing, and reported the
     * app broken. Same fault as `community-bay.mjs`'s hover, one week apart:
     * settle the scroll FIRST, then read. Every box below is re-read after any
     * scroll, or the second gesture aims at where the first one used to be.
     */
    const chip = page.locator('.cam-props:not(.cam-props-season) .cam-prop').first();
    await chip.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const tap = async () => {
      const box = await chip.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(500);
    };
    await tap();

    const after = await shot();
    check(`${label}: dragging a prop changes the picture`, after !== before);

    const undoUp = await page.locator('.cam-undo:not([hidden])').count();
    check(`${label}: Undo appears once something is on`, undoUp === 1, `${undoUp}`);

    // And it MOVES on the canvas — the drag handler at the other end.
    // A tap drops it in the MIDDLE of the picture, so that is where the drag
    // has to pick it up from — `to` is where a held drag would have put it.
    // And the PICTURE has to be on the screen to be dragged on, which after
    // scrolling the tray into view it is not — the sheet is taller than the
    // phone, so one of the two is always off it. Scroll back, then measure.
    await page.locator('.cam-canvas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const stage = await page.locator('.cam-canvas').boundingBox();
    const mid = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x - stage.width * 0.2, mid.y + stage.height * 0.16, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const moved = await shot();
    check(`${label}: and it can be dragged around the photo`, moved !== after);

    await page.locator('.cam-undo').click();
    await page.waitForTimeout(350);
    const undone = await shot();
    check(`${label}: Undo takes it back off`, undone !== moved);

    // Put one back on, so what is sent has a prop on it.
    await chip.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await tap();
  }

  const screenPhotos = async () => ((await desk.evaluate((g) => fetch(`/api/state?role=screen&g=${g}`)
    .then((r) => r.json()).then((s) => (s.photos || []).length), joinCode)));

  /* ------------------------------------------------ the phone, as it is today */

  const phone = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const boom = [];
  phone.on('pageerror', (e) => boom.push(`play: ${e}`));
  await phone.goto(`${BASE}/play?g=${joinCode}`);
  await phone.fill('#nameInput', 'The Shutterbugs');
  await phone.click('#joinBtn');
  await phone.waitForTimeout(1800);

  const camBtn = phone.locator('button', { hasText: /photo|camera/i }).first();
  const reachable = await camBtn.count();
  check('play: the phone offers a camera', reachable > 0);
  if (reachable) {
    await camBtn.click();
    const was = await screenPhotos();
    await driveSheet(phone, 'play');
    await phone.locator('.cam-send').click();
    await phone.waitForTimeout(2500);
    const now = await screenPhotos();
    check('play: the photo with a prop on it reaches the room', now === was + 1, `${was} -> ${now}`);
  }

  /* ---------------------------------------------- and the bar's camera, /snap */

  const bar = await browser.newPage({ viewport: { width: 390, height: 780 } });
  bar.on('pageerror', (e) => boom.push(`snap: ${e}`));
  await bar.goto(`${BASE}/snap?g=${joinCode}`);
  await bar.waitForSelector('.snap-take', { timeout: 15000 });
  const hasSheet = await bar.evaluate(() => Boolean(document.querySelector('.cam-pick, .snap-take')));
  check('snap: the page is up', hasSheet);

  /*
   * THE BAR'S SHUTTER IS THE FIRST PRESS, so the file goes into the page's own
   * input and the sheet opens around it. Driven with the SAME function as the
   * phone — a second copy of these assertions is a second thing to keep in
   * step, and the point of the move was that there is one sheet.
   */
  const wasBar = await screenPhotos();
  await bar.setInputFiles('.snap-take input[type="file"]', {
    name: 'behind-the-bar.jpg', mimeType: 'image/jpeg', buffer: JPEG,
  });
  await bar.waitForTimeout(1200);
  const barProps = await bar.locator('.cam-prop').count();
  check('snap: it offers the same props as the phone', barProps > 0,
    barProps ? `${barProps} props` : 'NONE — this is what was asked for');
  if (barProps) {
    await driveSheet(bar, 'snap', { loaded: true });
    await bar.locator('.cam-send').click();
    await bar.waitForTimeout(2500);
    const nowBar = await screenPhotos();
    check('snap: the photo with a prop on it reaches the room', nowBar === wasBar + 1,
      `${wasBar} -> ${nowBar}`);
    // NO TEAM ON IT, which is the whole reason /snap is not a player. Rule 1's
    // other half: the bar is not on the leaderboard and not on the projector.
    const named = await desk.evaluate((g) => fetch(`/api/state?role=screen&g=${g}`)
      .then((r) => r.json()).then((st) => (st.photos || []).filter((ph) => ph.teamName).length), joinCode);
    check('snap: and it lands with no team on it', named === 1, `${named} captioned`);
  }

  check('nothing threw on either page', boom.length === 0, boom.join(' | '));
  await phone.close();
  await bar.close();
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
