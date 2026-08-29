#!/usr/bin/env node
/**
 * THE COMMUNITY DOOR'S BAY, IN A REAL BROWSER — and whether it still fits.
 *
 * ---
 *
 * **This exists because the bay now carries the tab's own content, and the
 * doorhead is the one region of the console that cannot scroll.** Above 900px
 * the frame is three fixed areas and one scroller: the topbar, the door's own
 * header and the tab column stay put, and only the tab body moves. So a bay
 * that grows with the data does not get a scrollbar — it pushes the tab column
 * off the bottom of the screen, and nothing throws, nothing fails a unit test,
 * and the console simply loses its menu.
 *
 * That has happened once already, from the other direction: `.console main`
 * was a two-row grid, so any banner above the doorhead dropped the columns
 * into an implicit row and turned the fixed frame back into a scrolling page.
 * Every check was green. The only thing that can see this is a browser with a
 * viewport.
 *
 * So what this measures is GEOMETRY rather than markup: how tall the doorhead
 * ends up on each Community tab, how much is left for the columns underneath,
 * and whether the page itself has started to scroll. Plus the two counts that
 * are the whole safety argument — the wall stops at eighteen pictures and the
 * bay's table stops at eight rows, both bounded by construction rather than by
 * a ceiling on the box round them.
 *
 * It cannot live in `npm test`: this repo has no dependencies and Playwright is
 * a container tool rather than a project one. So it is a script, like
 * `pub-unchanged.mjs` and `drag-check.mjs`.
 *
 *   node scripts/community-bay.mjs [output dir for screenshots]
 *
 * It starts its own server on its own port with its own `DATA_DIR`, seeds an
 * archive of two venues' league nights, and stands in for the private photo
 * repository with `page.route()` — the console's own fetching and layout code
 * is the real thing throughout; only the network behind it is a fixture.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const PORT = Number(process.env.PORT || 48822);
const KEY = 'baycheck';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'baycheck-'));
const OUT = process.argv[2] || path.join(os.tmpdir(), 'bayshots');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- an archive of league nights ------------------------------------- */

// The HOUSE room's archive is `DATA_DIR/archive`, not `DATA_DIR/rooms/HOUSE`.
const arc = path.join(DATA, 'archive');
fs.mkdirSync(arc, { recursive: true });

const TEAMS_A = ['The Quizzy Rascals', 'Norfolk Enchants', 'Beer Pressure', 'Agatha Quiztie',
  'Let Us Win', 'Quiz Team Aguilera', 'The Pen Is Mightier', 'Trivia Newton John',
  'Bare Bear Bores', 'Sofa King Good', 'Pint Sized Heroes'];
const TEAMS_B = ['Smarty Pints', 'The Wrong Answers', 'E=MC Hammer', 'Tequila Mockingbird',
  'Universally Challenged', 'Cunning Stunts', 'Les Quizerables', 'Bumbling Wrecks'];
const DAY = 86400000;
const base = Date.parse('2026-08-27T21:30:00Z');

/* A repeatable shuffle, so the fixture is a league rather than eight identical
   nights — every team on the same points reads as a fault in the arithmetic
   rather than as test data. */
const rnd = (n) => {
  let x = (n * 1103515245 + 12345) & 0x7fffffff;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
};

let n = 0;
const seed = (venue, teams, weeksBack, shift, dayOffset = 0) => {
  // DIFFERENT DAYS PER VENUE, or `mergeGigs` folds both onto one night, marks
  // it `venueMixed`, drops the venue — and there is then no league at all.
  const at = base - weeksBack * 7 * DAY - dayOffset * DAY;
  const r = rnd(shift + 7);
  // A couple of teams miss each week, which is what makes best-of-six mean
  // anything and what puts different numbers in the P column.
  const board = teams.filter(() => r() > 0.2)
    .map((name) => ({ name, score: Math.round(1500 + r() * 2500), faceKey: '' }))
    .sort((a, b) => b.score - a.score);
  const id = `night-${n += 1}`;
  fs.writeFileSync(path.join(arc, `${id}.json`), JSON.stringify({
    id, kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: at, venue, leaderboard: board,
  }, null, 2));
};
for (let w = 0; w < 8; w += 1) {
  seed('The Crown', TEAMS_A, w, w);
  seed('The Station Tap', TEAMS_B, w, w * 3 + 1, 3);
}

const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA },
  stdio: 'ignore',
});
const stop = () => { server.kill(); fs.rmSync(DATA, { recursive: true, force: true }); };
process.on('exit', stop);

/* ---- a stand-in for the private photo repository ---------------------- */

const PHOTO_NIGHTS = ['2026-08-27', '2026-08-24', '2026-08-20'];

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

try {
  for (let i = 0; i < 40; i += 1) {
    try { await fetch(`http://127.0.0.1:${PORT}/`); break; } catch { await wait(250); }
  }
  const browser = await chromium.launch();

  for (const [label, width, height] of [['desk', 1500, 900], ['laptop', 1280, 720], ['phone', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.route('**/api/past-gigs?*', async (route) => {
      const r = await route.fetch();
      const body = await r.json();
      const nights = (body.nights || []).map((x) => ({ ...x, hasPhotos: PHOTO_NIGHTS.includes(x.night) }));
      await route.fulfill({ json: { ...body, nights, photosKept: true } });
    });
    await page.route('**/api/past-gigs/*', async (route) => {
      const night = new URL(route.request().url()).pathname.split('/').pop();
      // The newest night carries more than a wall's worth on its own, which is
      // what proves the loader stops rather than asking every night.
      const many = night === PHOTO_NIGHTS[0] ? 22 : 9;
      await route.fulfill({
        json: {
          night,
          published: false,
          photos: Array.from({ length: many }, (_, i) => ({
            name: `${i}.jpg`, url: `/shot/${(i * 7 + night.length) % 12}.svg`,
          })),
        },
      });
    });
    await page.route('**/shot/*.svg', async (route) => {
      const i = Number(route.request().url().match(/(\d+)\.svg/)[1]);
      const hue = (i * 31) % 360;
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${200 + (i % 3) * 120}">
          <rect width="100%" height="100%" fill="hsl(${hue} 55% 45%)"/>
          <circle cx="150" cy="120" r="60" fill="hsl(${hue} 60% 72%)"/></svg>`,
      });
    });

    const frame = () => page.evaluate(() => {
      const head = document.querySelector('.doorhead');
      const cols = document.querySelector('.consolecols');
      const body = document.querySelector('.tabbody');
      const bar = document.querySelector('.tabbar');
      const wall = document.querySelector('.community-wall');
      return {
        doorhead: head ? Math.round(head.getBoundingClientRect().height) : 0,
        colsHeight: cols ? Math.round(cols.getBoundingClientRect().height) : 0,
        // Every tab still reachable is the thing a crushed frame takes away.
        tabsFit: bar ? bar.scrollHeight <= bar.clientHeight + 1 : false,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pageScrolls: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        wall: document.querySelectorAll('.community-shot').length,
        wallCols: wall ? getComputedStyle(wall).gridTemplateColumns.split(' ').length : 0,
        rail: document.querySelectorAll('.community-venue').length,
        bayRows: document.querySelectorAll('.community-side tbody tr').length,
        // No control may be drawn up here: publishing a table and overruling
        // the filter both belong under the table they act on.
        bayControls: document.querySelectorAll('.doorhead .lg-pub-on, .doorhead .lg-pub-off, .doorhead .lg-review, .doorhead .cphoto-bin').length,
        lit: (document.querySelector('.community-venue.on .community-venue-name') || {}).textContent || '',
      };
    });

    for (const tab of ['league', 'photos', 'asks']) {
      await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}&door=community&tab=${tab}`, { waitUntil: 'load' });
      /* The two warnings a bare environment raises — no GitHub, no accounts —
         are not on a configured console, and 282px of them would make every
         measurement here about the harness rather than about the bay. */
      await page.addStyleTag({ content: '.backup-warn, main > .panel.warn { display: none !important; }' });
      await page.waitForTimeout(2200);
      const f = await frame();
      console.log(`\n${label} ${width}x${height} — ${tab}\n   ${JSON.stringify(f)}`);
      await page.screenshot({ path: path.join(OUT, `${label}-${tab}.png`) });

      if (width >= 900) {
        check(`${label}/${tab}: the page itself does not scroll`, f.pageScrolls <= 0, `${f.pageScrolls}px`);
        check(`${label}/${tab}: the tab column still fits`, f.tabsFit && f.colsHeight > 140, `${f.colsHeight}px left for the columns`);
      }
      check(`${label}/${tab}: nothing overflows sideways`, f.pageOverflow <= 0, `${f.pageOverflow}px`);
      check(`${label}/${tab}: no control in the bay`, f.bayControls === 0, `${f.bayControls}`);
      if (tab === 'photos') {
        check(`${label}: the wall stops at 18`, f.wall === 18, `drew ${f.wall}`);
        check(`${label}: ${width < 700 ? 'three' : 'six'} across`, f.wallCols === (width < 700 ? 3 : 6), `${f.wallCols}`);
      }
      if (tab === 'league') {
        check(`${label}: every venue on the rail`, f.rail === 2, `${f.rail}`);
        check(`${label}: the bay's table stops at 8`, f.bayRows === 8, `${f.bayRows}`);
      }
    }

    // AND THE RAIL ACTUALLY CHANGES THE TABLE. A dead control draws perfectly:
    // the click handler's own catch would swallow a `ReferenceError` and leave
    // a rail that lights up and does nothing.
    await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}&door=community&tab=league`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const first = (await frame()).lit;
    await page.locator('.community-venue:not(.on)').first().click();
    await page.waitForTimeout(400);
    const second = (await frame()).lit;
    check(`${label}: the rail changes the table`, Boolean(first) && first !== second, `${first} → ${second}`);
    if (label === 'desk') await page.screenshot({ path: path.join(OUT, 'desk-league-second.png') });

    check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }

  await browser.close();
} catch (err) {
  console.log('THREW', err.message);
  failures += 1;
}
console.log(`\nScreenshots in ${OUT}`);
console.log(failures ? `${failures} FAILED` : 'all clear');
process.exit(failures ? 1 : 0);
