#!/usr/bin/env node
/**
 * CAN A NIGHT ACTUALLY BE SAVED? — the one control that creates a show, pressed
 * in a real browser.
 *
 * ---
 *
 * **This exists because `Save for another night` was completely dead for a day
 * and every check in the repo stayed green.** `tonightAsShow()` is module
 * scope; the `segmentsNow()` it was rewritten to call is declared inside
 * `launchBar()`. That is a `ReferenceError` thrown BEFORE the `try` that would
 * have caught it, so the button did nothing at all — no prompt, no request, no
 * error on screen — and `node --check`, 1,684 unit tests, `drag-check`,
 * `console-frame`, `community-bay` and `dead-controls` all passed.
 *
 * `dead-controls.mjs` came closest and could not see it either: it walks an
 * IDLE console, where Save is deliberately `disabled` because there is nothing
 * to keep, and it skips disabled controls. **A guard that never puts a night in
 * Tonight is measuring a console nobody uses** — the same lesson
 * `console-frame.mjs` already records about an empty lobby.
 *
 * So this one sets a night up first, and then presses the button.
 *
 * **Save is the ONLY thing that creates a show.** The other two `/api/shows`
 * callers both edit one that already exists, so when this is broken "Prepare a
 * night" is a tab nothing can be put into and every running-order feature —
 * quiz to bingo to quiz, the whole reason shows exist — is unreachable.
 *
 *   node scripts/save-a-night.mjs
 *
 * Its own port, its own DATA_DIR, both cleaned up on the way out.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

import { startApp } from './helpers/live-app.mjs';

const KEY = 'savecheck';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * THE APP COMES FROM `helpers/live-app.mjs`.
 *
 * This file used to probe its own fixed port and stop dead if something was
 * answering on it — a fair guard and the wrong shape, because it turns a
 * collision into a refusal to run rather than into no collision at all. The
 * helper asks the OS for a free one, `unref()`s the child so the script can
 * end, and cleans up whether the run passed, failed or threw.
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
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  /*
   * THE PROMPT HAS TO BE ANSWERED, and Playwright dismisses every dialog by
   * default. Left alone, `prompt()` returns null, the handler returns early on
   * purpose, and this check would report a working Save on a broken one —
   * which is the auto-dismiss trap this repo already records for `confirm()`.
   */
  const named = [];
  page.on('dialog', async (d) => {
    named.push(d.type());
    await (d.type() === 'prompt' ? d.accept('Sweep night') : d.accept());
  });

  /** Every POST the page makes, so the request can be read off the wire. */
  const posted = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/shows')) {
      posted.push(r.postData() || '');
    }
  });

  await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="quiz"]')?.click());
  await page.waitForSelector('.pack-card[data-pack]');
  await page.waitForTimeout(500);

  console.log('\nSAVE A NIGHT — the only thing that makes a show\n');

  // A TAP puts a pack in Tonight, the same path a drop takes — and it is the
  // half that works on a touchscreen, where HTML5 drag never fires at all.
  await page.evaluate(() => document.querySelector('.pack-card[data-pack]')?.click());
  await page.waitForTimeout(900);

  const tiles = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
  check('a pack is in Tonight to save', tiles > 0, true);

  const enabled = await page.evaluate(() => {
    const b = document.querySelector('.lb-keep, .lb-save, [class*="save"]');
    return b ? !b.disabled : null;
  });
  check('and Save is no longer inert', enabled, true);

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save');
    if (b) b.click();
  });
  await page.waitForTimeout(1500);

  /*
   * THREE SEPARATE QUESTIONS, because the fault showed as all three at once
   * and any one of them alone could pass on a broken button.
   */
  check('pressing Save threw nothing', errors.join(' | ') || 'none', 'none');
  check('it asked what the night is called', named.includes('prompt'), true);
  check('and it sent the night to the server', posted.length, 1);

  const body = posted.length ? JSON.parse(posted[0]) : {};
  check('the show it sent has a name', String(body.name || ''), 'Sweep night');
  check('and something to play', Array.isArray(body.items) && body.items.length > 0, true);

  /*
   * THE SERVER'S OWN ANSWER, rather than the browser's optimism — and it comes
   * back on `/api/library`, because `/api/shows` is a POST-only route. Reading
   * a show back from the thing that stores it is the difference between "the
   * request left" and "the night is saved".
   */
  const lib = await (await fetch(`${BASE}/api/library`, {
    headers: { 'X-Host-Key': KEY },
  })).json();
  const kept = (lib.shows || []).map((s) => s.name);
  check('and the server kept it', kept.includes('Sweep night'), true);

  /*
   * AND THEN IT IS LOADED BACK, FROM THE DOOR THE SHELF IS ON.
   *
   * "Prepare a night" is behind the WORKSHOP door as well as the Console's,
   * and CLAUDE.md says the Workshop is where a show is edited — but Tonight
   * is only ever built on the CONSOLE door, so tapping a show over there set
   * `showWanted` (module state) and re-rendered a page with nothing that
   * reads it. Nothing threw and nothing moved. Dragging was dead for a second
   * reason: there is no Tonight on that door to drop one onto, and on a phone
   * the tap is the only way in at all.
   *
   * Saving and loading belong in one script because they are one round trip:
   * a night that saves and cannot be got back is not saved.
   */
  console.log('\nAND LOADED BACK — from the Workshop door, where the shelf is\n');
  await page.goto(`${BASE}/console?door=workshop&key=${KEY}`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="shows"]')?.click());
  await page.waitForTimeout(600);

  const cards = await page.evaluate(() => document.querySelectorAll('.show-card').length);
  check('the saved night is on the Workshop shelf', cards > 0, true);

  await page.evaluate(() => document.querySelector('.show-card')?.click());
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => ({
    door: new URL(location.href).searchParams.get('door') || 'console',
    // `.launchbar` is the class EVERY door's bay wears, so asking for it
    // passes on the Workshop too and says nothing. `.lb-go` is Launch,
    // which only the real bar has.
    bar: document.querySelectorAll('.lb-go').length,
    tiles: document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length,
  }));
  check('tapping it moves to the Console door', after.door, 'console');
  check('where Tonight actually exists', after.bar > 0, true);
  check('with the night back in it', after.tiles > 0, true);
  check('and nothing threw on the way', errors.join(' | ') || 'none', 'none');

  await browser.close();
  console.log(failures
    ? `\n${failures} check${failures === 1 ? '' : 's'} failed — a night cannot be saved and got back.\n`
    : '\nA night can be saved, the server has it, and it loads back.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  /*
   * THE BROWSER IS CLOSED EVEN WHEN SOMETHING THREW, or node keeps its handles
   * open and never exits — which is not a hang in the app, it is a hang in the
   * check, and it looks identical from outside. This script's own first run
   * spent eight hours that way over a mistyped read-back URL.
   */
  try { await browser?.close(); } catch { /* already gone */ }
  stop();
}
