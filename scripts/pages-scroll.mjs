#!/usr/bin/env node
/**
 * CAN A PERSON ACTUALLY SCROLL THIS PAGE? — every page, with a real wheel.
 *
 * ---
 *
 * **This exists because the answer was NO on four public pages for two years,
 * and nothing in this repo could see it.** `body { overflow: hidden }` was
 * written for the projector — but `body`'s overflow PROPAGATES TO THE VIEWPORT
 * when `html` is `visible`, so it did not clip the body box, it switched off
 * scrolling for the whole document. Every other page then had to opt back OUT
 * of it, and four of the eight did. Terms was 2,528 pixels tall in a 900 pixel
 * window and moved nothing; so were Privacy, Refunds, the sign-up form, and a
 * gallery of fourteen photographs on a phone.
 *
 * **A PROGRAMMATIC SCROLL IS NOT A SCROLL, and that is the whole trap here.**
 * `window.scrollTo(0, 220)` succeeds on a viewport that is `overflow: hidden`
 * and `scrollY` reads back 220, so a check written that way reports a page
 * scrolling perfectly while a person's finger does nothing at all. This one
 * turns the real wheel and reads where the page ended up — the same distinction
 * as measuring `getClientRects()` rather than counting elements, which this
 * repo has now been bitten by four times.
 *
 * **AND IT ASSERTS THE EXCEPTION AS WELL AS THE RULE.** The projector must NOT
 * scroll: it is a fixed sheet on a wall, there is nothing below the fold, and a
 * stray scroll in a dark pub takes the question off the top of the room's
 * screen. A guard that only demanded scrolling would happily "fix" the one page
 * where it is wrong.
 *
 * It cannot live in `npm test` — no dependencies, and Playwright is a container
 * tool. So it is a script, like `pub-unchanged.mjs` and `drag-check.mjs`.
 *
 *   node scripts/pages-scroll.mjs
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const PORT = Number(process.env.PORT || (48000 + Math.floor(Math.random() * 900)));
const KEY = 'scrollcheck';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'scrollcheck-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * EVERY PAGE THIS APP SERVES, and what each one is allowed to do.
 *
 * `scrolls: false` is the projector and nothing else. Everything else is an
 * ordinary web page: if it is taller than the window it has to move, and if it
 * fits there is nothing to prove — a page shorter than its viewport reports
 * `fits` rather than passing or failing, because a check that demanded movement
 * from a page with nowhere to go would fail for the wrong reason on a big
 * monitor and pass on a phone.
 */
const PAGES = [
  { path: '/', what: 'the landing page' },
  { path: '/terms', what: 'the terms' },
  { path: '/privacy', what: 'the privacy policy' },
  { path: '/refunds', what: 'the refund policy' },
  { path: '/signup', what: 'the sign-up form' },
  { path: '/login', what: 'signing in' },
  { path: '/gallery', what: 'the public gallery' },
  { path: '/league', what: 'the public league' },
  { path: `/console?key=${KEY}`, what: 'the console' },
  { path: `/owner?key=${KEY}`, what: 'the owner page' },
  { path: `/editor?key=${KEY}`, what: 'the pack editor' },
  { path: `/host?key=${KEY}`, what: "the host's own screen" },
  { path: '/play?g=ZZZZ', what: "a player's phone" },
  { path: '/screen?g=ZZZZ', what: 'THE PROJECTOR', scrolls: false },
];

const SIZES = [['laptop', 1280, 900], ['phone', 390, 844]];

const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA },
  stdio: 'ignore',
});
const stop = () => { server.kill(); fs.rmSync(DATA, { recursive: true, force: true }); };
process.on('exit', stop);

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
  console.log('\nCAN A PERSON SCROLL IT? — a real wheel, every page\n');

  for (const spec of PAGES) {
    for (const [tag, w, h] of SIZES) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`http://127.0.0.1:${PORT}${spec.path}`, { waitUntil: 'networkidle' })
        .catch(() => { /* a page that will not load is the next check's problem */ });
      // Long enough for the console and the projector to have drawn themselves.
      await page.waitForTimeout(700);

      const before = await page.evaluate(() => ({
        cls: document.body.className,
        docH: document.documentElement.scrollHeight,
        winH: innerHeight,
        overflow: getComputedStyle(document.body).overflow,
      }));
      // THE REAL GESTURE. Over the middle of the window, so it lands on the
      // page rather than on a fixed bar at the top of it.
      await page.mouse.move(w / 2, h / 2);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(250);
      const y = await page.evaluate(() => scrollY);
      await page.close();

      const label = `${spec.what} (${tag})`;
      // Four pixels of slack: a sub-pixel layout must not read as overflow.
      const taller = before.docH > before.winH + 4;
      if (spec.scrolls === false) {
        /*
         * THE RULE, NOT THE SYMPTOM. The projector's page is a fixed sheet that
         * happens to fit, so "it did not move" is true of a correctly pinned
         * screen AND of a completely unpinned one — a pass for the wrong
         * reason, which is the exact fault this whole script exists to stop
         * repeating. So the assertion is the declaration itself.
         */
        check(`${label} is pinned`, before.overflow === 'hidden' && y === 0,
          `overflow: ${before.overflow}, wheel → ${y}`);
      } else if (!taller) {
        console.log(`  --   ${label} fits — nothing to scroll (${before.docH}px in ${before.winH}px)`);
      } else {
        check(label, y > 0, `${before.docH}px in ${before.winH}px, wheel → ${y}`);
      }
    }
  }

  await browser.close();
  console.log(failures
    ? `\n${failures} page${failures === 1 ? '' : 's'} a person cannot use.`
    : '\nEvery page moves when it has somewhere to go, and the projector stays put.');
} finally {
  stop();
}
process.exit(failures ? 1 : 0);
