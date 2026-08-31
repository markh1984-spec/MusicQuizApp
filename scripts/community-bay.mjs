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
const seed = (venue, teams, weeksBack, shift, dayOffset = 0, venueId = '') => {
  // DIFFERENT DAYS PER VENUE, or `mergeGigs` folds both onto one night, marks
  // it `venueMixed`, drops the venue — and there is then no league at all.
  const at = base - weeksBack * 7 * DAY - dayOffset * DAY;
  const r = rnd(shift + 7);
  // A couple of teams miss each week, which is what makes best-of-six mean
  // anything and what puts different numbers in the P column.
  const board = teams.filter(() => r() > 0.2)
    .map((name) => ({ name, score: Math.round(1500 + r() * 2500), faceKey: '' }))
    .sort((a, b) => b.score - a.score)
    // `position` IS WHAT THE LEAGUE SCORES ON — a board without it scores
    // nobody, so a fixture without it draws an empty night and an empty table.
    // Real archived boards carry it; this one has to as well or it is testing
    // a shape the app never sees.
    .map((row, i) => ({ ...row, position: i + 1 }));
  const id = `night-${n += 1}`;
  fs.writeFileSync(path.join(arc, `${id}.json`), JSON.stringify({
    id, kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    // A venue ID, so the league's key is `id:…` deterministically — which is
    // what the decision file is keyed on and what this harness has to mock.
    archivedAt: at, venue, venueId, leaderboard: board,
  }, null, 2));
};
for (let w = 0; w < 8; w += 1) {
  seed('The Crown', TEAMS_A, w, w, 0, 'v1');
  seed('The Station Tap', TEAMS_B, w, w * 3 + 1, 3, 'v2');
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
            name: `p${i}${i % 4 === 0 ? '-picked' : ''}.jpg`,
            url: `/shot/${(i * 7 + night.length) % 12}.svg`,
            // A quarter of them off the gallery, so the pill has both states
            // to draw and the check has something to count.
            onGallery: i % 4 !== 0,
            ruled: '',
          })),
        },
      });
    });
    /*
     * The lamp's own write goes to the private repository, which this harness
     * has no token for — so it is answered here. Without it the click 400s and
     * the console-error check fires on the harness rather than on the app.
     */
    await page.route('**/api/gallery-photo/**', async (route) => {
      await route.fulfill({ json: { ok: true } });
    });
    // The pin's write goes to the same private repository, for the same reason.
    await page.route('**/api/gallery-pin/**', async (route) => {
      await route.fulfill({ json: { ok: true } });
    });
    // The rail's P lamp writes through here. Answered, or the click 400s and
    // the console-error check fires on the harness rather than on the app.
    await page.route('**/api/past-gigs/publish*', async (route) => {
      await route.fulfill({ json: { ok: true, nights: [] } });
    });
    /*
     * The league's own decision file lives in the private repository, which
     * this harness has no token for. Answered here with one venue running, so
     * both sides of the switch are on screen to be checked.
     */
    let running = ['id:v1'];
    // Published as well as running, so the address the console hands out is
    // on screen to be checked — it is only printed once a table is actually
    // up, which is the only time it would work.
    await page.route('**/api/league/published*', async (route) => {
      await route.fulfill({ json: { venues: [...running], names: {}, running } });
    });
    await page.route('**/api/league/running*', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      running = body.on
        ? [...new Set([...running, body.venueKey])]
        : running.filter((v) => v !== body.venueKey);
      await route.fulfill({ json: { ok: true, running, venues: [] } });
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
        /*
         * A VENUE'S OWN TABLE ROW PLUS ITS NIGHTS, capped like every other
         * group — so with two venues, one open, the rail is `The table` and up
         * to four dates rather than the two rows it held before the nights
         * arrived.
         */
        check(`${label}: the open venue shows its table and its nights`, f.rail > 2, `${f.rail} rows`);
        /*
         * AND A VENUE THAT DOES NOT RUN A LEAGUE IS NOT OFFERED A PUBLIC PAGE
         * — *"it might be misleading if this app just had that as standard
         * even in venues that don't have a quiz league."* The switch decides,
         * and the controls under it are absent rather than greyed: publishing
         * a league at a pub that does not run one is not a disabled action, it
         * is a question that does not arise.
         */
        const lg = await page.evaluate(() => ({
          run: document.querySelectorAll('.tabbody .lg-run-on, .tabbody .lg-run-off').length,
          pub: document.querySelectorAll('.tabbody .lg-pub-on, .tabbody .lg-pub-off').length,
          on: document.querySelectorAll('.tabbody .lg-run-off').length,
        }));
        check(`${label}: the league has an on/off switch`, lg.run === 1, JSON.stringify(lg));
        check(`${label}: a running venue is offered a public page`, lg.on === 1 && lg.pub === 1, JSON.stringify(lg));
        /*
         * AND THE ADDRESS IS WRITTEN OUT — *"I want to be able to have the
         * URLs conveniently reachable."* A link somebody has to construct is a
         * link nobody hands out, so the console says what it is; and it is the
         * venue's own address rather than `?q=`, because this account is the
         * owner and the pretty path resolves against the owner's room.
         */
        const addr = await page.evaluate(() => {
          const el = document.querySelector('.tabbody .pub-address');
          const a = document.querySelector('.tabbody .gig-gal-live a');
          return { said: el ? el.textContent.trim() : '', href: a ? a.getAttribute('href') : '' };
        });
        // `crown`, not `the-crown` — the article is dropped, because an
        // article is not an address. See `venueSlug()`.
        check(`${label}: the league's address is written out`,
          /\/crown\/quiz-league$/.test(addr.said), addr.said);
        check(`${label}: and the link goes to it`, addr.href === '/crown/quiz-league', addr.href);
        await page.locator('.tabbody .lg-run-off').click();
        await page.waitForTimeout(700);
        const off = await page.evaluate(() => ({
          run: document.querySelectorAll('.tabbody .lg-run-on').length,
          pub: document.querySelectorAll('.tabbody .lg-pub-on, .tabbody .lg-pub-off').length,
          table: document.querySelectorAll('.doorhead .lg-table tbody tr').length,
        }));
        check(`${label}: switching it off removes the publish control`, off.run === 1 && off.pub === 0, JSON.stringify(off));
        // AND THE TABLE STAYS — *"it's useful to have the information
        // regardless"*. The switch gates what LEAVES, never what he sees.
        check(`${label}: but the table is still there to read`, off.table > 0, `${off.table} rows`);
        await page.locator('.tabbody .lg-run-on').click();
        await page.waitForTimeout(700);
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
        /*
         * A GROUP FOLDS AND UNFOLDS. Nothing in this repo presses a control,
         * and a dead one draws perfectly — the handler's own catch eats the
         * ReferenceError, so the caret simply never turns.
         */
        const beforeRows = m.rail;
        /*
         * ONLY WHERE THERE IS SOMETHING TO FOLD. The league rail is one row per
         * venue with nothing above a venue to fold it into, which is correct —
         * a fold with one level under it is a control with no job.
         */
        if (!(await page.locator('.doorhead .bay-rail-group').count())) continue;
        await page.locator('.doorhead .bay-rail-group').first().click();
        await page.waitForTimeout(600);
        const shut = await page.evaluate(() => document.querySelectorAll('.doorhead .bay-pick').length);
        await page.locator('.doorhead .bay-rail-group').first().click();
        await page.waitForTimeout(600);
        const open2 = await page.evaluate(() => document.querySelectorAll('.doorhead .bay-pick').length);
        check(`${label}: ${door}'s first group folds`, shut < beforeRows, `${beforeRows} -> ${shut}`);
        check(`${label}: and unfolds again`, open2 === beforeRows, `${shut} -> ${open2}`);
        // FOUR AT A TIME, with the rest named as being below — asked for.
        check(`${label}: ${door} shows at most 4 per group`, open2 <= 4 * 3, `${open2}`);
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

    /* ---- AND THE HEAD OF THE BAY CARRIES THE NIGHT'S PUBLIC ADDRESS.
       A link that says "see it live" over a night nobody else can see would be
       the app lying about its own state, so the WORDS are checked as well as
       the href — the two states are the whole point of it. */
    const link = await page.evaluate(() => {
      const a = document.querySelector('.bay-head .bay-head-live');
      if (!a) return null;
      const head = a.closest('.bay-head').getBoundingClientRect();
      const r = a.getBoundingClientRect();
      return {
        href: a.getAttribute('href') || '', text: a.textContent.trim(),
        live: a.classList.contains('is-live'),
        blank: a.getAttribute('target') === '_blank',
        // It must be IN the head, not spilling out of it.
        inside: r.right <= head.right + 1 && r.left >= head.left - 1,
        seen: a.getClientRects().length > 0,
      };
    });
    check(`${label}: the bay head links to the live gallery`, Boolean(link && link.seen), `${link && link.href}`);
    if (link) {
      check(`${label}: and the link points at this night`, /gallery/.test(link.href), link.href);
      check(`${label}: it opens in its own tab, not over the console`, link.blank);
      check(`${label}: the words match whether it is actually public`,
        link.live ? /see it/i.test(link.text) : /preview/i.test(link.text),
        `${link.live ? 'live' : 'draft'} — "${link.text}"`);
      check(`${label}: and it stays inside the head`, link.inside);
    }

    /* ---- THE P LAMP ON A RAIL ROW — the one control allowed in a rail.

       *A rail picks; it never acts* is bent here on purpose, and the reason
       the rule existed is kept by the lamp ALSO picking: the night's pictures
       land in the bay at the moment it goes public, so nobody publishes a set
       of strangers' faces without seeing them.

       So there are three things to prove, and pressing is the only way to see
       any of them — a dead handler draws a perfect lamp. */
    const lampsAt = await page.evaluate(() => ({
      total: document.querySelectorAll('.doorhead .bay-lamp').length,
      rows: document.querySelectorAll('.doorhead .bay-pick-row').length,
      // The wall row has no night behind it, so it must NOT carry one.
      onWall: Boolean(document.querySelector('.doorhead .bay-pick-row .bay-pick-name')
        && [...document.querySelectorAll('.doorhead .bay-pick-row')]
          .some((r) => r.textContent.includes('The wall'))),
    }));
    check(`${label}: every night row has a publish lamp`, lampsAt.total > 0, `${lampsAt.total}`);
    check(`${label}: one lamp per row, never a spare`, lampsAt.total === lampsAt.rows,
      `${lampsAt.total} lamps, ${lampsAt.rows} rows`);
    check(`${label}: the wall row has no lamp — there is no night behind it`, !lampsAt.onWall);

    if (lampsAt.total) {
      const lampWas = await page.evaluate(() => {
        const l = document.querySelector('.doorhead .bay-lamp');
        return { on: l.classList.contains('is-on'), said: l.getAttribute('aria-label') || '' };
      });
      await page.evaluate(() => document.querySelector('.doorhead .bay-lamp').click());
      await page.waitForTimeout(700);
      const lampNow = await page.evaluate(() => {
        const l = document.querySelector('.doorhead .bay-lamp');
        const row = l.closest('.bay-pick-row');
        return {
          on: l.classList.contains('is-on'),
          // PRESSING IT ALSO PICKS THE ROW — the whole safeguard.
          picked: row.querySelector('.bay-pick').classList.contains('on'),
          photos: document.querySelectorAll('.doorhead .cphoto').length,
          said: l.getAttribute('aria-label') || '',
          trouble: document.querySelector('.bay-rail-trouble')?.textContent || '',
        };
      });
      check(`${label}: pressing P changes the colour`, lampNow.on === !lampWas.on,
        `${lampWas.on} -> ${lampNow.on}`);
      check(`${label}: and it opens that night's photos`, lampNow.picked && lampNow.photos > 0,
        `picked=${lampNow.picked}, ${lampNow.photos} photos`);
      check(`${label}: a wordless colour still says what it is`,
        lampNow.said.length > 8 && lampNow.said !== lampWas.said, lampNow.said);
      check(`${label}: and nothing went wrong writing it`, !lampNow.trouble, lampNow.trouble);
      // Put it back, so the checks below start where they expect.
      await page.evaluate(() => document.querySelector('.doorhead .bay-lamp').click());
      await page.waitForTimeout(500);
    }
    check(`${label}: and none of them at the bottom`, opened.bodyPhotos === 0, `${opened.bodyPhotos}`);
    /*
     * THERE IS EXACTLY ONE WAY TO PUBLISH ON THIS DOOR, and it is the lamp.
     *
     * This check used to demand the OPPOSITE — a `.gig-gallery` panel under the
     * night's row — because that is where the control was. It moved to the
     * rail on 31 August 2026 and the panel went with it: two controls for one
     * job on one screen is the label collision this app has a rule against, and
     * they are the pair that can disagree. So the check is inverted rather than
     * deleted, because "no second publish button grew back" is the half worth
     * guarding now.
     */
    const pubUnder = await page.locator('.tabbody .photo-night-controls .gig-gallery').count();
    check(`${label}: publishing is the lamp and nothing else`, pubUnder === 0,
      `${pubUnder} publish panels under the night`);
    /*
     * AND THE WAY TO ADD YOUR OWN IS THERE — *"would be good to be able to add
     * room photos to the gallery that everyone sees, that I take from my own
     * phone"*. A `<label>` wrapping a hidden file input, so what is checked is
     * that the input EXISTS and that the label is what a thumb can hit.
     */
    /*
     * A PILL PER PHOTO, IN BOTH STATES — *"a little green pill to show it's on
     * the public gallery and a red one to show it isn't"*. Counted rather than
     * eyeballed, because a pill that drew one colour for everything would look
     * fine in a screenshot and be useless.
     */
    const pills = await page.evaluate(() => ({
      all: document.querySelectorAll('.doorhead .cphoto-pub').length,
      on: document.querySelectorAll('.doorhead .cphoto-pub.is-on').length,
      off: document.querySelectorAll('.doorhead .cphoto-pub.is-off').length,
      photos: document.querySelectorAll('.doorhead .cphoto').length,
      // The old grey badge is gone rather than sitting beside it.
      oldBadge: document.querySelectorAll('.cphoto-tag').length,
    }));
    check(`${label}: every photo has a gallery pill`, pills.all === pills.photos, `${pills.all}/${pills.photos}`);
    check(`${label}: and both states are drawn`, pills.on > 0 && pills.off > 0, `${pills.on} on, ${pills.off} off`);
    check(`${label}: the old Screen only badge is gone`, pills.oldBadge === 0, `${pills.oldBadge}`);
    /*
     * A LAMP, NOT A LABEL — *"no text needed but it must be clickable"*. So
     * what is checked is that it says nothing, that a screen reader still gets
     * a sentence out of it, and that the HIT AREA reaches the touch floor even
     * though the dot itself is 18px. A wordless control with a thumb-sized
     * target is the whole trade; get either half wrong and it is a smudge.
     */
    const lamp = await page.evaluate(() => {
      const el = document.querySelector('.doorhead .cphoto-pub');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      const grow = Math.abs(parseFloat(after.getPropertyValue('inset-block-start')) || 0);
      return {
        words: (el.textContent || '').trim(),
        said: el.getAttribute('aria-label') || '',
        w: Math.round(r.width), h: Math.round(r.height),
        hit: Math.round(r.height + grow * 2),
      };
    });
    check(`${label}: the lamp carries no words`, lamp && lamp.words === '', JSON.stringify(lamp && lamp.words));
    check(`${label}: but it still says what it is`, lamp && lamp.said.length > 10, lamp && lamp.said);
    check(`${label}: and its target reaches the touch floor`, lamp && lamp.hit >= 44, lamp && `${lamp.w}px dot, ${lamp.hit}px target`);
    /*
     * AND PRESSING THE LAMP DOES NOT ALSO OPEN THE PICTURE. It sits ON the
     * photograph with a hit area bigger than it looks, and the figure beneath
     * it opens on click — so without the guard, switching a photo off the
     * gallery would blow it up to fill the bay at the same time.
     */
    const wasOn = await page.evaluate(() => document.querySelector('.doorhead .cphoto-pub').classList.contains('is-on'));
    await page.evaluate(() => document.querySelector('.doorhead .cphoto-pub').click());
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      opened: document.querySelectorAll('.doorhead .community-big').length,
      // AND IT ACTUALLY SWITCHED — read against what it WAS, not against a
      // colour assumed from the fixture. A dead lamp draws perfectly: the
      // handler's own catch eats a ReferenceError and the colour never moves.
      on: document.querySelector('.doorhead .cphoto-pub').classList.contains('is-on'),
    }));
    check(`${label}: the lamp does not also open the picture`, after.opened === 0, `${after.opened}`);
    check(`${label}: and pressing it switches the colour`, after.on === !wasOn, `${wasOn} -> ${after.on}`);

    /*
     * THE PIN IS PRESSED TOO, and for the reason the dial's two presses exist:
     * nothing in this repo presses a control, and a dead one draws perfectly —
     * the handler's own catch swallows a ReferenceError and the mark never
     * moves. Pressed against what it WAS rather than against a state assumed
     * from the fixture, and checked for the same not-also-opening guard the
     * lamp needs, since it sits on the photograph as well.
     */
    const pins = await page.evaluate(() => document.querySelectorAll('.doorhead .cphoto-pin').length);
    check(`${label}: every photo has a pin`, pins > 0, `${pins}`);
    if (pins) {
      const pinWas = await page.evaluate(() => document.querySelector('.doorhead .cphoto-pin').classList.contains('is-on'));
      await page.evaluate(() => document.querySelector('.doorhead .cphoto-pin').click());
      await page.waitForTimeout(400);
      const pinNow = await page.evaluate(() => ({
        on: document.querySelector('.doorhead .cphoto-pin').classList.contains('is-on'),
        opened: document.querySelectorAll('.doorhead .community-big').length,
        // A wordless control has to say what it is somewhere.
        said: document.querySelector('.doorhead .cphoto-pin').getAttribute('aria-label') || '',
      }));
      check(`${label}: pressing the pin marks the photo`, pinNow.on === !pinWas, `${pinWas} -> ${pinNow.on}`);
      check(`${label}: the pin does not also open the picture`, pinNow.opened === 0, `${pinNow.opened}`);
      check(`${label}: and it says what it is`, pinNow.said.length > 8, pinNow.said);
      // Put it back, so the fold checks below start from the state they expect.
      await page.evaluate(() => document.querySelector('.doorhead .cphoto-pin').click());
      await page.waitForTimeout(200);
    }

    /*
     * AND THE FOLD STILL WORKS OVER THE NIGHT YOU HAVE OPEN — which is the
     * case it did NOT, reported as *"the section needs to collapse on click
     * and expand on click"*. `holdsPicked` was forcing the group open, so
     * pressing its heading set the flag, re-rendered, and the override put it
     * straight back: a dead control, in the commonest state there is, with
     * nothing thrown. Pressed here with a night open on purpose.
     */
    const railBefore = await page.evaluate(() => document.querySelectorAll('.doorhead .bay-pick').length);
    await page.locator('.doorhead .bay-rail-group').first().click();
    await page.waitForTimeout(600);
    const railShut = await page.evaluate(() => ({
      rows: document.querySelectorAll('.doorhead .bay-pick').length,
      // Shut over what you are looking at, the heading says so itself rather
      // than forcing itself open — which is how the rail still points at you.
      marked: document.querySelectorAll('.doorhead .bay-rail-group.holds-picked').length,
    }));
    check(`${label}: the fold works over the night you have open`, railShut.rows < railBefore, `${railBefore} -> ${railShut.rows}`);
    check(`${label}: and a shut group says it holds you`, railShut.marked === 1, `${railShut.marked}`);
    await page.locator('.doorhead .bay-rail-group').first().click();
    await page.waitForTimeout(600);

    const mine = await page.locator('.tabbody .mine-add input[type=file]').count();
    const hittable = await page.evaluate(() => {
      const l = document.querySelector('.tabbody .mine-pick');
      return l ? Math.round(l.getBoundingClientRect().height) : 0;
    });
    check(`${label}: you can add your own photos to the night`, mine === 1, `${mine}`);
    check(`${label}: and the control is big enough to press`, hittable >= 36, `${hittable}px`);
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

    /*
     * AND THE WALL KEEPS ITS PLACE. Reported as *"it seems to reload the
     * entire gallery at the top"* — nothing reloaded; the bay was REBUILT, and
     * a fresh element scrolls at 0. The picture is an overlay now, so the grid
     * underneath is never destroyed and there is an offset to compare either
     * side of it.
     *
     * Clicked through `evaluate` rather than the mouse ON PURPOSE: Playwright
     * scrolls a target into view before clicking it, which would put the wall
     * back to the top itself and make this assertion about the harness. The
     * real-mouse path is already proved by the two checks above.
     */
    if (width >= 900) {
      const scrolled = await page.evaluate(() => {
        const b = document.querySelector('.doorhead .bay-body');
        b.scrollTop = 120;
        return b.scrollTop;
      });
      await page.evaluate(() => document.querySelectorAll('.doorhead .cphoto')[3].click());
      await page.waitForTimeout(400);
      /*
       * AND IT COVERS THE BAY WHILE THE GRID UNDER IT IS SCROLLED — the fault
       * reported off a screenshot. `position: absolute; inset: 0` inside a
       * SCROLLED container anchors to the content box's origin, which is above
       * the visible top, so the picture drew half out of view with thumbnails
       * showing round it. Measured against the column it is supposed to fill.
       */
      const cover = await page.evaluate(() => {
        const big = document.querySelector('.community-big');
        const side = document.querySelector('.doorhead .bay-side');
        if (!big || !side) return null;
        const b = big.getBoundingClientRect();
        const s = side.getBoundingClientRect();
        return {
          top: Math.round(b.top - s.top), left: Math.round(b.left - s.left),
          w: Math.round(b.width - s.width), h: Math.round(b.height - s.height),
        };
      });
      check(`${label}: the open picture covers the bay`,
        cover && Math.abs(cover.top) <= 2 && Math.abs(cover.left) <= 2
          && Math.abs(cover.w) <= 2 && Math.abs(cover.h) <= 2,
        JSON.stringify(cover));
      await page.evaluate(() => document.querySelector('.community-big').click());
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => document.querySelector('.doorhead .bay-body').scrollTop);
      check(`${label}: and it goes back where you were`, scrolled > 0 && after === scrolled, `${scrolled} -> ${after}`);
    }
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
    /*
     * AND A NIGHT SHOWS THAT NIGHT — *"you can click each night to see who won
     * and when on any given night."* The season table has five columns and a
     * night has three, which is the cheapest thing to tell them apart by that
     * is not the words themselves.
     */
    const nightTable = await page.evaluate(() => ({
      cols: document.querySelectorAll('.doorhead .lg-table thead th').length,
      // AND IT HAS ROWS IN IT. A header with an empty body draws perfectly and
      // is what a board with no `position` on it produces — which is exactly
      // what a fixture without one was quietly testing.
      rows: document.querySelectorAll('.doorhead .lg-table tbody tr').length,
    }));
    check(`${label}: a night's own placings are a different table`, nightTable.cols === 3, `${nightTable.cols} columns`);
    check(`${label}: and it actually has placings in it`, nightTable.rows > 0, `${nightTable.rows} rows`);
    if (label === 'desk') await page.screenshot({ path: path.join(OUT, 'desk-league-night.png') });

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
