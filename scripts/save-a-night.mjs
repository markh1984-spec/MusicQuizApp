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

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const PORT = Number(process.env.PORT || 48991);
const KEY = 'savecheck';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'savecheck-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA },
  stdio: 'ignore',
});
const stop = () => {
  server.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
};
process.on('exit', stop);

let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${want}\n        got    ${got}`);
};

try {
  for (let i = 0; i < 40; i += 1) {
    try { await fetch(`http://127.0.0.1:${PORT}/`); break; } catch { await wait(250); }
  }

  const browser = await chromium.launch();
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

  await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}`, { waitUntil: 'load' });
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

  // The server's own answer, rather than the browser's optimism.
  const shows = await (await fetch(`http://127.0.0.1:${PORT}/api/shows`, {
    headers: { 'X-Host-Key': KEY },
  })).json();
  const kept = (shows.shows || []).map((s) => s.name);
  check('and the server kept it', kept.includes('Sweep night'), true);

  await browser.close();
  console.log(failures
    ? `\n${failures} check${failures === 1 ? '' : 's'} failed — a night cannot be saved.\n`
    : '\nA night can be saved, and the server has it.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
}
