#!/usr/bin/env node
/**
 * THE CONSOLE DOOR'S FRAME, IN A REAL BROWSER — is every control still on the
 * screen, and can a finger actually reach it?
 *
 * ---
 *
 * **This exists because three separate bugs in one week were the same bug: a
 * control that was in the DOM, had a size, passed every test — and was not on
 * the screen.** Nothing throws for that. Nothing goes red. The console draws
 * perfectly and one of its doors is simply gone.
 *
 *   - `.topbar` is a grid item, so it defaults to `min-width: auto` and
 *     refused to shrink; `.wrap` is `overflow-x: hidden`, so at ~960px the
 *     tier rungs were **clipped with no scrollbar to reach them**.
 *   - Constraining the bar moved the pressure onto `.topnav`, which is
 *     `flex: 1 1 auto` with a deliberately invisible `overflow-x` — so **My
 *     account simply was not there.** Reported as *"what happened to the other
 *     menu?"*
 *   - Letting the bay shrink on a short window made the doorhead smaller and
 *     the launch bar inside it stayed the same size, so the bar **painted over
 *     the tab column**: the tabs measured 200px tall at y=315 and were
 *     invisible. Reported as *"the sub menu is still missing from the
 *     console"*, twice.
 *
 * Every one of those was found by a human looking at a screenshot, and the
 * third was found AFTER my own measurements said it was fixed — because I was
 * counting elements and reading heights rather than asking whether anything
 * was painted on top.
 *
 * **So the question this script asks is not "is it in the document" and not
 * "how big is it". It is: put a finger on the middle of this control — what
 * does it hit?** `document.elementFromPoint()` answers that, and it is the
 * only check that sees clipped, off-screen and painted-over at once. That is
 * `getClientRects()` over `querySelectorAll().length`, taken one step further:
 * *in the document*, *has a size* and *somebody can press it* are three
 * different questions, and this repo has now been bitten by the gap between
 * them five times.
 *
 * `community-bay.mjs` guards the other four doors' bays. This guards the
 * Console door, which is the one on the protected launch path and the only one
 * that has never had a geometry check of its own.
 *
 *   node scripts/console-frame.mjs [output dir for screenshots]
 *
 * It starts its own server on its own port with its own `DATA_DIR`, signs in
 * on the host key — which is the WIDEST the topbar ever gets, since it carries
 * the hat switch and the tier rungs that nobody else has — and walks six
 * window sizes chosen for the rules that change at them, not for being round
 * numbers.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'framecheck';
const OUT = process.argv[2] || path.join(os.tmpdir(), 'frameshots');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * AN OWNER ACCOUNT, SIGNED IN ALONGSIDE THE KEY — because that is the WIDEST
 * the topbar ever gets, and the widest bar is the one that broke.
 *
 * On a bare host key `hatSwitch()` returns null: no hat, no tier rungs, and
 * therefore none of the 326px this bar has to find room for. So a harness on
 * the key alone would sweep six window sizes and never once look at the two
 * controls that went off the side of the screen. `?key=` AND an owner cookie
 * in the same browser is the `alsoOwner` case — three hat halves and four
 * rungs, which is the bar an ordinary quizmaster is never shown and the host
 * looks at every day.
 */
const OWNER = { email: 'frame@example.com', password: 'framecheck-password' };
const { Accounts } = await import('../src/accounts.js');
/*
 * WRITTEN BEFORE THE SERVER STARTS — `seed` runs first for exactly this
 * reason. `Accounts` reads its file once at boot, so an account created after
 * the spawn does not exist as far as the running app is concerned and the
 * sign-in below would answer 401.
 */
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Frame Check', role: 'owner' });

/*
 * THE APP COMES FROM `helpers/live-app.mjs`.
 *
 * It used to pick a port and hope. `spawn` here has `stdio: 'ignore'`, so a
 * port already in use fails SILENTLY — no server of ours starts and every
 * measurement is about somebody else's process. That is not theoretical: this
 * folder produced a false PASS that way once, and a false FAIL on the
 * projector while another check was running. The helper asks the OS for a free
 * port and `unref()`s the child, which is also what lets a script actually
 * end.
 */
const { base: BASE, stop } = await startApp({ key: KEY, seed: seedOwner });


let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

/*
 * THE SIX SIZES ARE THE RULES, NOT ROUND NUMBERS. Every one of them sits on a
 * threshold in `style.css`, so a query edited by hand has somewhere to fail:
 *
 *   1500x900  the frame, no diet, the launch row on one line
 *   1280x800  the frame, the topbar's diet (under 1180), still one line
 *   1100x820  the frame, the diet, and the launch row WRAPPED (under 1150),
 *             which is the taller `--bay-h` of the two
 *    960x760  the narrowest and shortest the frame exists at — the size the
 *             menu went missing at, and the tightest the topbar ever is
 *   1280x640  wide but SHORT: no frame, the page scrolls — and the 190px rail
 *             must survive, because the drag is what the layout is for
 *    390x844  a phone: no frame, no two columns, tabs full width
 */
const SIZES = [
  ['desk', 1500, 900],
  ['laptop', 1280, 800],
  ['wrapped', 1100, 820],
  ['tight', 960, 760],
  ['short', 1280, 640],
  ['phone', 390, 844],
];

/*
 * PUT A FINGER ON IT. Runs in the page: for every control matched, scroll it
 * into view if the page can scroll at all, then ask what is painted at its
 * middle. A control is REACHABLE only if the hit is the control itself or
 * something inside it — an ancestor coming back means the control is not what
 * is on screen there.
 *
 * The scroll is restored afterwards, or the next measurement is about a page
 * this function moved.
 */
const REACH = (sel) => {
  /*
   * SCROLL WHAT A FINGER COULD SCROLL, AND NOTHING ELSE.
   *
   * `scrollIntoView()` would be one line, and it is wrong here: it happily
   * scrolls an `overflow: hidden` box, which is the one thing a person cannot
   * do. `.wrap` is `overflow-x: hidden` and that is exactly how the tier rungs
   * went off the side of the screen with no scrollbar to reach them — so a
   * check that quietly scrolled it would report the fault it exists for as
   * fine. Only `auto` and `scroll` count, which is the tab column's own
   * documented fallback: *"a tab you cannot reach is a tab that does not
   * exist"*, and it gets its own scrollbar rather than cutting one off.
   */
  const scroller = (el) => {
    /*
     * STOP AT `body`. `body { overflow: auto }` is what makes every ordinary
     * page scroll, but a body's own `scrollTop` does nothing — the overflow
     * PROPAGATES to the viewport, so the window is what moves. Treating body
     * as a box left every control on a phone reported off screen, which is a
     * failure about this function rather than about the app.
     */
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p);
      if (/auto|scroll/.test(o.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
      // SIDEWAYS COUNTS TOO — the menu is `overflow-x` with `flex: 1 1 auto`,
      // which is the box "My account" went missing inside.
      if (/auto|scroll/.test(o.overflowX) && p.scrollWidth > p.clientWidth + 1) return p;
    }
    return null;
  };
  const docScrolls = document.documentElement.scrollHeight > document.documentElement.clientHeight + 1;
  const wasWindow = window.scrollY;
  const restore = [];
  const restoreX = [];
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const box = scroller(el);
    if (box) {
      restore.push([box, box.scrollTop]);
      restoreX.push([box, box.scrollLeft]);
      const r0 = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r0.top < b.top) box.scrollTop -= b.top - r0.top;
      else if (r0.bottom > b.bottom) box.scrollTop += r0.bottom - b.bottom;
      if (r0.left < b.left) box.scrollLeft -= b.left - r0.left;
      else if (r0.right > b.right) box.scrollLeft += r0.right - b.right;
    } else if (docScrolls) {
      const r0 = el.getBoundingClientRect();
      if (r0.top < 0) window.scrollBy(0, r0.top);
      else if (r0.bottom > window.innerHeight) window.scrollBy(0, r0.bottom - window.innerHeight);
    }
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const onScreen = r.width > 0 && r.height > 0
      && cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight;
    const hit = onScreen ? document.elementFromPoint(cx, cy) : null;
    out.push({
      what: (el.textContent || el.getAttribute('aria-label') || el.className || '?').trim().slice(0, 24),
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.left), y: Math.round(r.top),
      reachable: Boolean(hit) && (hit === el || el.contains(hit)),
      hitBy: hit && !(hit === el || el.contains(hit))
        ? (hit.className || hit.tagName || '?').toString().slice(0, 40) : '',
    });
  }
  for (const [box, top] of restore) box.scrollTop = top;
  for (const [box, left] of restoreX) box.scrollLeft = left;
  window.scrollTo(0, wasWindow);
  return out;
};

const unreachable = (rows) => rows.filter((r) => !r.reachable);
const say = (rows) => unreachable(rows)
  .map((r) => `${r.what} @${r.x},${r.y} ${r.w}x${r.h}${r.hitBy ? ` under ${r.hitBy}` : ' off screen'}`)
  .join('; ');

try {

  /*
   * LAUNCH SOMETHING FIRST, because an idle console is not the bar that broke.
   *
   * `#runningNow` is empty until a game is on, and the fault this script exists
   * for was measured with one: *"with a game running at ~960px it came out
   * 1128px wide and the tier rungs were off the side of the screen."* A sweep
   * of an idle console is a sweep of a narrower bar than the host ever sees on
   * a gig day — it would have passed every size with the clipping fault put
   * back, which is exactly the guard-that-tests-nothing this repo keeps
   * catching itself building.
   */
  const packId = fs.readdirSync('quizzes').filter((f) => f.endsWith('.json'))[0].replace(/\.json$/, '');
  const launched = await fetch(`${BASE}/api/host/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify({ game: 'quiz', packId, replace: true }),
  });
  check('a quiz is running, so the bar carries a live line', launched.status === 200, `${launched.status}`);

  /*
   * AND TWO PHONES IN IT — because `aNightIsOn()` is false for an EMPTY lobby,
   * so the topbar's live line stays blank and the bar measures ~230px narrower
   * than the one the host actually drives.
   *
   * That gap is exactly how this script passed every size while his header was
   * on two rows. **A guard that sets a night up but never lets anybody join is
   * measuring a console nobody uses** — the launch is not the state that
   * matters here, the ROOM being in it is.
   */
  const joinCode = ((await (await fetch(`${BASE}/api/library`, {
    headers: { 'X-Host-Key': KEY },
  })).json()).running || {}).joinCode || '';
  for (const name of ['Mick', 'Rita']) {
    await fetch(`${BASE}/api/join${joinCode ? `?g=${joinCode}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  const browser = await chromium.launch();

  for (const [label, width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    /*
     * A 409 FROM THE QUIET LAUNCH IS NOT AN ERROR — it is the documented
     * answer. Tapping a pack card puts it straight on the projector, and the
     * launch route refuses with 409 when a game is already in progress; the
     * console swallows that on purpose (*"a 409 is SILENT here"*). The browser
     * still logs the failed request, and this script taps five packs into
     * Tonight to put the frame under real pressure, so it would otherwise
     * report a fault every run for behaviour this repo chose.
     */
    const noise = (text) => /\b409\b/.test(text) && /Conflict|Failed to load resource/i.test(text);
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push(m.text()); });

    /*
     * THE FRAME'S OWN RULE, KEPT IN STEP WITH `style.css`. It is two numbers
     * because the doorhead is two heights: 73 + 573 + 200 at 1150px and up,
     * and 73 + 690 + 200 below that where the launch bar's settings row wraps.
     * A guard carrying a stale copy of a threshold reports the app broken when
     * it is the check that is out of date — so if these move, they move
     * together.
     */
    const framed = (width >= 1150 && height >= 850) || (width >= 900 && height >= 965);
    const twoCols = width >= 900;
    console.log(`\n${label} ${width}x${height} — ${framed ? 'pinned frame' : 'the page scrolls'}${twoCols ? ', two columns' : ', one column'}`);

    // The context's own cookie jar, so the page that follows is signed in.
    await page.context().request.post(`${BASE}/api/sign-in`, { data: OWNER });

    await page.goto(`${BASE}/console?key=${KEY}&door=console&tab=quiz`, { waitUntil: 'load' });
    await page.waitForTimeout(2200);

    /*
     * FIRST, WITH THE BANNERS STILL UP — because that is the case that broke.
     * `.console main` was a two-row grid assuming exactly two children, so ANY
     * banner above the doorhead (the no-accounts maker, Workshop's backup
     * warning) pushed the doorhead into the `1fr` row: it was STRETCHED with
     * ~160px of nothing under the launch bar, and the columns fell into an
     * implicit row that quietly turned the fixed frame back into a scrolling
     * page. A bare environment raises both banners, so this harness gets the
     * hard case for free — and only by measuring BEFORE hiding them.
     */
    /*
     * PUT A BANNER UP RATHER THAN HOPING FOR ONE. A bare container raises the
     * no-accounts maker and the backup warning, and this harness now creates
     * an owner account — so it raises NEITHER, and the check below was
     * skipping itself in silence on every size. That is the guard-that-tests-
     * nothing fault wearing an `if`, so the banner is a fixture now: a real
     * `main > .panel.warn`, which is the shape both of the app's own take.
     */
    const banners = await page.evaluate(() => {
      const main = document.querySelector('main');
      const warn = document.createElement('div');
      warn.className = 'panel warn';
      warn.textContent = 'Your own packs are not being backed up.';
      main.prepend(warn);
      return document.querySelectorAll('.backup-warn, main > .panel.warn').length;
    });
    if (framed && banners) {
      const withBanner = await page.evaluate(() => ({
        scrolls: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        cols: Math.round((document.querySelector('.consolecols') || {}).clientHeight || 0),
        // THE HONEST QUESTION IS WHETHER A TAB IS STILL REACHABLE, not whether
        // the column cleared some number I made up. A banner takes ~110px off
        // the column at 760px of height and two tabs go under the fold — which
        // is fine, because the rail scrolls; it would not be fine if it were
        // cut instead, and those two are what have to be told apart.
        cut: (() => {
          const rail = document.querySelector('.tabbar');
          if (!rail) return true;
          return rail.scrollHeight > rail.clientHeight + 1
            && !/auto|scroll/.test(getComputedStyle(rail).overflowY);
        })(),
      }));
      const bannerTabs = await page.evaluate(REACH, '.tabbar .tab');
      check(`${label}: a banner above the doorhead does not un-pin the frame`,
        withBanner.scrolls <= 0,
        `${banners} banner(s), ${withBanner.scrolls}px of scroll, ${withBanner.cols}px of columns`);
      check(`${label}: and every tab is still reachable with one up`,
        !withBanner.cut && unreachable(bannerTabs).length === 0,
        `${withBanner.cols}px of columns; ${say(bannerTabs)}`);
    }

    /* And now out of the way, so every measurement below is about the console
       a configured account actually sees rather than about this container. */
    await page.addStyleTag({ content: '.backup-warn, main > .panel.warn { display: none !important; }' });
    await page.waitForTimeout(500);

    /* ---- THE TOPBAR: every door, the hat and the rungs ------------------ */

    /*
     * THE LIVE LINE HAS TO BE ON THE BAR BEFORE ANY OF THIS MEANS ANYTHING.
     * It arrives with a later fetch, so measuring without waiting measures the
     * narrow bar again — the same miss, one step further along.
     */
    const liveLine = await page.evaluate(
      () => ((document.querySelector('#runningNow') || {}).textContent || '').trim());
    check(`${label}: the bar is carrying the live line`, liveLine.length > 0, `"${liveLine}"`);

    const doors = await page.evaluate(REACH, '.topnav a');
    check(`${label}: all five doors are on the screen`, doors.length === 5, `${doors.length} chips`);
    check(`${label}: and every one of them can be pressed`, unreachable(doors).length === 0, say(doors));

    const bar = await page.evaluate(() => {
      const b = document.querySelector('.topbar');
      const r = b.getBoundingClientRect();
      return {
        clipped: Math.round(b.scrollWidth - b.clientWidth),
        past: Math.round(r.right - window.innerWidth),
        /*
         * BANDS, NOT DISTINCT TOPS. The bar's children are different heights
         * and sit on different baselines by design, so counting tops says
         * "three rows" about a bar that is plainly one. A second row is a
         * child that STARTS below where every child before it ENDED, which is
         * what wrapping actually is.
         */
        rows: [...b.children].map((c) => c.getBoundingClientRect())
          .filter((r) => r.height)
          .sort((x, y) => x.top - y.top)
          .reduce((acc, r) => (r.top >= acc.floor - 1
            ? { n: acc.n + 1, floor: r.bottom }
            : { n: acc.n, floor: Math.max(acc.floor, r.bottom) }), { n: 0, floor: -Infinity }).n,
      };
    });
    /*
     * A CLIPPED OVERFLOW IS WORSE THAN A SCROLLING ONE — nothing throws,
     * nothing looks broken, and the control is simply unreachable. `.wrap` is
     * `overflow-x: hidden`, so a bar wider than its box has no scrollbar to
     * find and whatever is on the end is gone.
     */
    check(`${label}: the topbar is not clipped`, bar.clipped <= 1 && bar.past <= 1,
      `${bar.clipped}px over its box, ${bar.past}px past the window`);
    /*
     * AND IT IS ONE ROW. Two rows read as a second bar, and under the fixed
     * frame every row the header takes comes off the tab column below it — so
     * the diet (the wordmark goes, the mark stays) exists precisely to keep
     * this true, and `flex-wrap: wrap` is only the fallback behind it.
     */
    if (width >= 431) {
      check(`${label}: the menu items all sit on one row`, bar.rows === 1, `${bar.rows} rows`);
    }

    /*
     * THE OWNER'S RUNGS AND THE HAT SWITCH — the two controls nobody else has,
     * which is why the owner's bar is the one that broke and why this harness
     * signs in on the host key. *"The clickable part of the G/S/B needs to
     * increase, it's hard to click"* — measured at 24x22 with a 2px gap, so a
     * slightly-off press previewed the wrong tier. 30x34 now, height being the
     * free dimension inside the bar's own padding; four 44px rungs would cost
     * 68px the bar does not have.
     */
    const rungs = await page.evaluate(REACH, '.topbar .tier-preview .tier-half');
    const hat = await page.evaluate(REACH, '.topbar .hat-switch .hat-half');
    check(`${label}: every tier rung can be pressed`, rungs.length >= 4 && unreachable(rungs).length === 0,
      `${rungs.length} rungs; ${say(rungs)}`);
    if (width > 560) {
      check(`${label}: a rung is big enough to hit`, rungs.every((r) => r.w >= 28 && r.h >= 30),
        rungs.map((r) => `${r.w}x${r.h}`).join(' '));
    }
    check(`${label}: the hat switch can be pressed`, hat.length === 3 && unreachable(hat).length === 0,
      `${hat.length} halves; ${say(hat)}`);
    /*
     * LEVEL AT EVERY WIDTH, which is the rule the size itself hangs off — a
     * secondary control taller than the primary one it sits INSIDE reads as
     * the wrong way round, and it is also how the bar came to run off the side
     * of a phone: the 560px diet shrank the halves and left the rungs at 34,
     * so the owner's console scrolled sideways by five pixels.
     */
    const level = [...hat, ...rungs].map((r) => r.h);
    check(`${label}: the rungs and the hat halves are the same height`,
      Math.max(...level) - Math.min(...level) <= 1, level.join('/'));

    /* ---- THE TAB COLUMN ------------------------------------------------- */

    /*
     * THE ONE THAT WOULD HAVE CAUGHT THE INVISIBLE TABS. They were 200px tall
     * and 315px down a 515px frame with the launch bar painted over them —
     * present, sized, and not on the screen. A hit test sees that; a height
     * does not.
     */
    const tabs = await page.evaluate(REACH, '.tabbar .tab');
    check(`${label}: there are tabs`, tabs.length >= 3, `${tabs.length}`);
    check(`${label}: and every tab can be pressed`, unreachable(tabs).length === 0, say(tabs));

    const cols = await page.evaluate(() => {
      const rail = document.querySelector('.tabbar');
      const body = document.querySelector('.tabbody');
      if (!rail || !body) return null;
      const a = rail.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      return {
        railW: Math.round(a.width),
        beside: b.left >= a.right - 1,
        // NOT "does it fit" — a column with more tabs than room is meant to
        // get its own scrollbar. What must never happen is it being CUT: an
        // overflowing rail set to `hidden` loses a door in silence.
        railScrolls: rail.scrollHeight <= rail.clientHeight + 1
          || /auto|scroll/.test(getComputedStyle(rail).overflowY),
      };
    });
    if (twoCols) {
      /*
       * THE 190px RAIL HOLDS AT EVERY HEIGHT, and that is a rule with a bug
       * behind it. Two columns is a WIDTH decision and the pinned frame is a
       * HEIGHT one; they lived in one media query, so gating the frame on
       * height took the sidebar away too — the tabs went full width above the
       * shelf and put a wall of tab between the pack cards and the launch bar.
       * *"The submenu was meant to allow for the content to be dragged to the
       * launch bar, at the moment it takes up the full width of the page and
       * is in the way of this functionality."* THE DRAG IS WHAT THE LAYOUT IS
       * FOR, so this is checked at 640px of height as well as at 900.
       */
      check(`${label}: the tab column is a rail, not a wall`,
        cols && cols.railW > 150 && cols.railW < 240, `${cols && cols.railW}px wide`);
      check(`${label}: and the shelf sits beside it`, cols && cols.beside, '');
    }
    check(`${label}: an overflowing tab column scrolls rather than cutting`,
      cols && cols.railScrolls, '');

    /* ---- THE PROTECTED SURFACE: Launch, and something to drag ----------- */

    const go = await page.evaluate(REACH, '.lb-go');
    check(`${label}: Launch is on the screen`, go.length === 1 && unreachable(go).length === 0, say(go));

    const drag = await page.evaluate(() => {
      const slot = document.querySelector('.lb-tiles .lb-tile');
      const card = document.querySelector('.pack-grid .pack-card');
      if (!slot || !card) return { slot: Boolean(slot), card: Boolean(card) };
      const s = slot.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      return {
        slot: true, card: true,
        // BOTH ENDS OF THE GESTURE ON SCREEN AT ONCE. A drag that needs the
        // page scrolled half way through is a drag nobody completes.
        together: s.top >= 0 && s.bottom <= window.innerHeight
          && c.top >= 0 && c.bottom <= window.innerHeight,
        slotY: `${Math.round(s.top)}-${Math.round(s.bottom)}`,
        cardY: `${Math.round(c.top)}-${Math.round(c.bottom)}`,
        view: window.innerHeight,
      };
    });
    check(`${label}: there is a drop slot and a pack to put in it`, drag.slot && drag.card, JSON.stringify(drag));
    /*
     * ONLY WHERE THE FRAME IS PINNED. Where it is not, the page scrolls — and
     * `pinTonightWhereItIs()` exists for exactly that: it freezes Tonight
     * where the eye last saw it when a card is picked up, so the drop target
     * cannot scroll away. Demanding both ends on screen at once there would be
     * asserting against the answer this app already has.
     */
    if (framed && drag.slot && drag.card) {
      check(`${label}: and both ends of the drag are on screen at once`, drag.together,
        `slot ${drag.slotY}, card ${drag.cardY}, window ${drag.view}`);
    }

    /* ---- THE FRAME ITSELF ----------------------------------------------- */

    const frame = await page.evaluate(() => ({
      scrolls: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cols: Math.round((document.querySelector('.consolecols') || {}).clientHeight || 0),
      doorhead: Math.round((document.querySelector('.doorhead') || {}).clientHeight || 0),
    }));
    check(`${label}: nothing overflows sideways`, frame.sideways <= 0, `${frame.sideways}px`);
    if (framed) {
      check(`${label}: the page itself does not scroll`, frame.scrolls <= 0, `${frame.scrolls}px`);
      check(`${label}: the columns have room left`, frame.cols > 140, `${frame.cols}px`);
      /*
       * AND WHEN THE FRAME GENUINELY CANNOT FIT ITS CONTENT, A REAL WHEEL
       * MOVES IT.
       *
       * `.console .wrap` ended its block with a trailing `overflow: hidden`
       * that wiped the `overflow-y: auto` five lines above it, so the frame
       * CLIPPED instead of scrolling — measured at 1500x900 with five packs in
       * Tonight: 161px of overflow, three tabs and all six pack cards off the
       * bottom, and a wheel moving nothing. That is the fault reported twice
       * as *"the sub menu is still missing from the console"*, and the fix
       * written for it had never once been in effect.
       *
       * **A REAL WHEEL, never `scrollTo`** — a programmatic scroll succeeds on
       * a clipped box and reads back the number you set, which is how a check
       * written that way reports a scrolling frame while a finger does
       * nothing. `pages-scroll.mjs` records the same lesson.
       */
      /*
       * TONIGHT IS FILLED FIRST, or this measures a console nobody drives.
       * One pack in the row is 41px of overflow at 1500x900 and none at all
       * on a taller window — the reported fault was FIVE packs and 161px.
       * A guard that sets a night up but never loads it is the empty-lobby
       * lesson this script already carries, one row further down.
       */
      for (let i = 0; i < 5; i += 1) {
        await page.evaluate(() => document.querySelector('.pack-card[data-pack]:not(.in-tonight)')?.click());
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => {
        const w = document.querySelector('.console .wrap');
        return w ? Math.round(w.scrollHeight - w.clientHeight) : 0;
      });
      if (over > 2) {
        await page.mouse.move(Math.round(width / 2), Math.round(height * 0.7));
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(300);
        const moved = await page.evaluate(() => {
          const w = document.querySelector('.console .wrap');
          return w ? Math.round(w.scrollTop) : 0;
        });
        check(`${label}: a frame that cannot fit its content SCROLLS`, moved > 0,
          `${over}px over, wheel moved ${moved}px`);
        // And with the row full, every tab is still something a finger reaches.
        const tabsNow = await page.evaluate(REACH, '.tabbar .tab');
        check(`${label}: and every tab is still reachable with Tonight full`,
          unreachable(tabsNow).length === 0, say(tabsNow));
        await page.mouse.wheel(0, -600);
        await page.waitForTimeout(200);
      }
    } else {
      /*
       * AND UNDER THE THRESHOLD IT MUST BE ABLE TO. The frame is off below
       * 900px of width or 700px of height precisely so the console scrolls
       * instead — a console that neither pins nor scrolls is the 515px frame
       * with 592px of content in it, which is the fault this whole block
       * exists to catch.
       */
      const below = await page.evaluate(() => {
        const last = document.querySelector('.tabbody');
        return last ? Math.round(last.getBoundingClientRect().bottom - window.innerHeight) : 0;
      });
      check(`${label}: what is under the fold can be scrolled to`,
        below <= 0 || frame.scrolls >= below - 2, `${below}px below, ${frame.scrolls}px of scroll`);
    }

    await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: !framed });
    console.log(`   ${JSON.stringify({ ...frame, bar, railW: cols && cols.railW })}`);

    check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }

  await browser.close();
} catch (err) {
  console.log('THREW', err.stack || err.message);
  failures += 1;
}
console.log(`\nScreenshots in ${OUT}`);
console.log(failures ? `${failures} FAILED` : 'all clear');
process.exit(failures ? 1 : 0);
