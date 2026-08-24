#!/usr/bin/env node
/**
 * DOES TONIGHT'S DRAG AND DROP STILL WORK — with a REAL browser drag.
 *
 * ---
 *
 * **This exists because a one-word change broke every pack drop onto a slot
 * and the test that covered it stayed green.** A pack card starts its drag
 * with `effectAllowed = 'copy'` and a round tick with `'move'`; a `dropEffect`
 * the source did not allow makes the browser treat the target as REFUSING, so
 * **no `drop` event fires at all**. Hard-coding `'move'` in a handler that
 * served both silently killed the pack half.
 *
 * A synthesised `DragEvent` does not enforce that rule. Nor does it enforce
 * the other one this bar has already been bitten by: a browser fires no `drop`
 * unless `dragover` called `preventDefault()`. Both are the BROWSER's
 * preconditions, and the only way to check them is to make the browser do the
 * drag.
 *
 * It cannot live in `npm test`: this repo has no dependencies, and Playwright
 * is a container tool rather than a project one. So it is a script, like
 * `pub-unchanged.mjs` — run it after anything that touches the launch bar's
 * drag handlers.
 *
 *   node scripts/drag-check.mjs
 *
 * It starts its own server on its own port with its own DATA_DIR, so it never
 * touches a real one, and cleans both up on the way out.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const PORT = Number(process.env.PORT || 48771);
const KEY = 'dragcheck';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'dragcheck-'));
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
  await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  /** What the running order looks like, slot by slot. */
  const shape = () => page.evaluate(() => [...document.querySelectorAll('.lb-tiles > .lb-tile')]
    .map((t) => (t.classList.contains('lb-doors-slot') ? 'doors'
      : t.classList.contains('is-pack') ? 'PACK' : 'empty')).join(' '));

  /*
   * THE MOUSE, NOT A DISPATCHED EVENT. Several moves rather than one jump —
   * a single jump is read as a click, and no drag ever starts.
   */
  async function drag(fromSel, toSel) {
    const from = await page.locator(fromSel).first().boundingBox();
    const to = await page.locator(toSel).first().boundingBox();
    if (!from || !to) throw new Error(`nothing to drag: ${fromSel} -> ${toSel}`);
    const fx = from.x + from.width / 2;
    const fy = from.y + from.height / 2;
    const tx = to.x + to.width / 2;
    const ty = to.y + to.height / 2;
    await page.mouse.move(fx, fy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(fx + (tx - fx) * (i / 6), fy + (ty - fy) * (i / 6), { steps: 4 });
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
  }

  await page.evaluate(() => document.querySelector('button.tab[data-tab="quiz"]')?.click());
  await page.waitForSelector('.pack-card[data-pack]');
  await page.waitForTimeout(500);

  console.log('\nTONIGHT — real browser drags\n');
  await drag('.pack-card[data-pack]', '.lb-tiles');
  check('a pack card onto the row', await shape(), 'doors PACK empty empty empty empty empty');

  /*
   * `:not(.in-tonight)` — a pack already in the running order stays on the
   * shelf as a dashed ghost, and dropping the SAME pack twice is refused on
   * purpose ("a night does not play the same ten questions in rounds two and
   * four"). Grabbing the first card again would test that refusal rather than
   * this drop.
   */
  await drag('.pack-card[data-pack]:not(.in-tonight)', '.lb-tile.lb-drop, .lb-tile.mix-drop');
  check('a pack card onto an EMPTY SLOT', await shape(), 'doors PACK PACK empty empty empty empty');

  await page.evaluate(() => {
    const e = [...document.querySelectorAll('.lb-tile.lb-drop, .lb-tile.mix-drop')]
      .filter((x) => x.getClientRects().length)[1];
    if (e) e.setAttribute('data-probe', '1');
  });
  await drag('.lb-rd, .mix-rd', '[data-probe="1"]');
  check('a round out to a later slot', await shape(), 'doors PACK PACK empty PACK empty empty');

  check('no console errors', errors.join(' | ') || 'none', 'none');
  await browser.close();
} finally {
  stop();
}

console.log(failures
  ? `\n${failures} FAILED — a drag on the launch bar is broken.\n`
  : '\nEvery drag landed where it was aimed.\n');
process.exit(failures ? 1 : 0);
