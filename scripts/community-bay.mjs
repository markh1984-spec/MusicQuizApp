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

// A port of its own per run, so two of these side by side cannot half-connect
// to each other's server and report a failure that is about the harness.
const PORT = Number(process.env.PORT || (48000 + Math.floor(Math.random() * 900)));
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

    /*
     * THE LAUNCH BAR IS THE REFERENCE, so it is measured rather than assumed.
     * If it grows, this fails and `--bay-h` gets updated deliberately — which
     * is the only way "every bay is the launch bay's size" stays true rather
     * than being a sentence in a stylesheet.
     */
    await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}&door=console&tab=quiz`, { waitUntil: 'load' });
    await page.addStyleTag({ content: '.backup-warn, main > .panel.warn { display: none !important; }' });
    await page.waitForTimeout(1800);
    const bayH = await page.evaluate(() => {
      const d = document.querySelector('.doorhead');
      return d ? Math.round(d.getBoundingClientRect().height) : 0;
    });
    console.log(`\n${label} ${width}x${height} — the launch bay is ${bayH}px tall`);

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
        wall: document.querySelectorAll('.community-wall .cphoto').length,
        wallCols: wall ? getComputedStyle(wall).gridTemplateColumns.split(' ').length : 0,
        rail: document.querySelectorAll('.bay-pick').length,
        bayRows: document.querySelectorAll('.bay-side tbody tr').length,
        // NO CONTROL AND NO SECOND COPY OF THE THING. Publishing a table,
        // publishing a night and overruling the filter all belong under what
        // they act on; a table drawn in the tab body as well as the bay is the
        // duplicate display this door was rearranged to stop.
        bayControls: document.querySelectorAll('.doorhead .lg-pub-on, .doorhead .lg-pub-off, .doorhead .lg-review').length,
        bodyTables: document.querySelectorAll('.tabbody .lg-table').length,
        bodyPhotos: document.querySelectorAll('.tabbody .cphoto').length,
        bayPhotos: document.querySelectorAll('.doorhead .cphoto').length,
        bigShot: document.querySelectorAll('.doorhead .community-big').length,
        lit: (document.querySelector('.bay-pick.on .bay-pick-name') || {}).textContent || '',
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
        check(`${label}/${tab}: the bay is the launch bay's height`, f.doorhead === bayH, `${f.doorhead}px, launch bar is ${bayH}px`);
      }
      check(`${label}/${tab}: nothing overflows sideways`, f.pageOverflow <= 0, `${f.pageOverflow}px`);
      check(`${label}/${tab}: no control in the bay`, f.bayControls === 0, `${f.bayControls}`);
      check(`${label}/${tab}: the thing itself is not also at the bottom`, f.bodyTables === 0 && f.bodyPhotos === 0, `${f.bodyTables} tables, ${f.bodyPhotos} photos`);
      if (tab === 'photos') {
        check(`${label}: the wall stops at 18`, f.wall === 18, `drew ${f.wall}`);
        check(`${label}: ${width < 700 ? 'three' : 'six'} across`, f.wallCols === (width < 700 ? 3 : 6), `${f.wallCols}`);
      }
      if (tab === 'league') {
        check(`${label}: every venue on the rail`, f.rail === 2, `${f.rail}`);
        // EVERY team, because the bay scrolls inside a fixed height — a cap
        // plus "and N more, below" would point at a table that is not there.
        check(`${label}: every team is in the bay's table`, f.bayRows === 11, `${f.bayRows}`);
      }
    }

    /* ---- EVERY DOOR, not only this one. The rule is that the bay is the same
       size across sections, so a door left out of the sweep is a door that can
       drift back to its own height without anything noticing. */
    if (width >= 900) {
      for (const [door, tab] of [['workshop', 'quiz'], ['post', 'past'], ['community', 'league']]) {
        await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}&door=${door}&tab=${tab}`, { waitUntil: 'load' });
        await page.addStyleTag({ content: '.backup-warn, main > .panel.warn { display: none !important; }' });
        await page.waitForTimeout(1500);
        const m = await page.evaluate(() => ({
          h: Math.round(document.querySelector('.doorhead').getBoundingClientRect().height),
          // A RAIL ON EVERY DOOR BUT THE CONSOLE — its bay is the launch bar,
          // which is the reference and is not a list of things to look at.
          rail: document.querySelectorAll('.doorhead .bay-pick').length,
          /*
           * AND THE PUB HEADINGS ARE VISIBLE, not merely present. A flex column
           * shrinks its children, and these had no floor: they rendered at 2px
           * with their text in the DOM, so a rail that had compartmentalised
           * its nights perfectly drew as one undivided list and nothing threw.
           * `getClientRects()` over `querySelectorAll().length` — the third
           * time this repo has been bitten by that difference.
           */
          squashed: [...document.querySelectorAll('.doorhead .bay-rail-group')]
            .filter((g) => g.getBoundingClientRect().height < 12).length,
        }));
        check(`${label}: the ${door} bay is the launch bay's height`, m.h === bayH, `${m.h}px vs ${bayH}px`);
        check(`${label}: ${door} has a rail`, m.rail > 0, `${m.rail} rows`);
        check(`${label}: ${door}'s group headings are not squashed`, m.squashed === 0, `${m.squashed} under 12px`);
      }
    }

    /* ---- PRESS THE THING AT THE BOTTOM, SEE IT AT THE TOP — and press a
       picture to open it, and again to come back. All four are click handlers,
       and a dead one draws perfectly: the handler's own catch swallows a
       ReferenceError and the button simply does nothing. */
    await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}&door=community&tab=photos`, { waitUntil: 'load' });
    await page.addStyleTag({ content: '.backup-warn, main > .panel.warn { display: none !important; }' });
    await page.waitForTimeout(2200);
    await page.locator('.tabbody .venue-top').first().click();
    await page.waitForTimeout(500);
    await page.locator('.tabbody .photo-night-top').first().click();
    await page.waitForTimeout(1800);
    const opened = await frame();
    check(`${label}: opening a night puts its photos in the bay`, opened.bayPhotos > 0, `${opened.bayPhotos}`);
    check(`${label}: and none of them at the bottom`, opened.bodyPhotos === 0, `${opened.bodyPhotos}`);
    const pubUnder = await page.locator('.tabbody .photo-night-controls .gig-gallery').count();
    check(`${label}: the publish control is under the night's row`, pubUnder === 1, `${pubUnder}`);
    if (width >= 900) {
      const h = await page.evaluate(() => Math.round(document.querySelector('.doorhead').getBoundingClientRect().height));
      check(`${label}: an open night does not change the bay's height`, h === bayH, `${h}px vs ${bayH}px`);
    }
    await page.locator('.doorhead .cphoto').first().click();
    await page.waitForTimeout(500);
    check(`${label}: clicking a photo opens it`, (await frame()).bigShot === 1);
    if (label === 'desk') await page.screenshot({ path: path.join(OUT, 'desk-photo-open.png') });
    await page.locator('.community-big').click();
    await page.waitForTimeout(500);
    const back = await frame();
    check(`${label}: clicking it again goes back`, back.bigShot === 0 && back.bayPhotos > 0, `${back.bigShot}/${back.bayPhotos}`);
    if (label === 'desk') await page.screenshot({ path: path.join(OUT, 'desk-night-open.png') });
    await page.locator('.tabbody .photo-night-top').first().click();
    await page.waitForTimeout(1500);
    check(`${label}: pressing the night again returns to the wall`, (await frame()).wall === 18, `${(await frame()).wall}`);

    // AND THE RAIL ACTUALLY CHANGES THE TABLE. A dead control draws perfectly:
    // the click handler's own catch would swallow a `ReferenceError` and leave
    // a rail that lights up and does nothing.
    await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}&door=community&tab=league`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const first = (await frame()).lit;
    await page.locator('.bay-pick:not(.on)').first().click();
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
