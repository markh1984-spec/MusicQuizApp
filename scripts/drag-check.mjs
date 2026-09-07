#!/usr/bin/env node
/**
 * DOES TONIGHT'S DRAG AND DROP STILL WORK — with a REAL browser drag, and do
 * the controls on its tiles still DO anything when pressed.
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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'dragcheck';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
const { base: BASE, stop } = await startApp({ key: KEY });


let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${want}\n        got    ${got}`);
};

try {

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
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

  /*
   * A PACK ARRIVES AS ITS ROUNDS, so these count tiles rather than pinning a
   * literal row. Before 5 September 2026 a pack card made exactly one PACK
   * tile and the shapes could be written out; it now makes one per round, and
   * a pack's round count is a fact about a JSON file that a check on the drag
   * has no business asserting.
   */
  const packs = async () => (await shape()).split(' ').filter((w) => w === 'PACK').length;
  const names = () => page.evaluate(() => [...document.querySelectorAll('.lb-tiles .lb-tile.is-pack .lb-tile-name')]
    .map((b) => b.textContent.trim()).join(' | '));

  console.log('\nTONIGHT — real browser drags\n');
  await drag('.pack-card[data-pack]', '.lb-tiles');
  const afterOne = await packs();
  check('a pack card onto the row BURSTS into a tile per round', afterOne > 1, true);
  check('and each tile names its own round', /\| /.test(await names()), true);

  /*
   * `:not(.in-tonight)` — a pack already in the running order stays on the
   * shelf as a dashed ghost, and dropping the SAME pack twice is refused on
   * purpose ("a night does not play the same ten questions in rounds two and
   * four"). Grabbing the first card again would test that refusal rather than
   * this drop.
   */
  await drag('.pack-card[data-pack]:not(.in-tonight)', '.lb-tile.lb-drop, .lb-tile.mix-drop');
  check('a second pack card onto an EMPTY SLOT adds its rounds too', await packs() > afterOne, true);

  /*
   * MOVING A ROUND IS NOW MOVING ITS TILE — with one round to a tile there
   * are no round dots to lift, and the tile's own grip is the handle. The
   * check is that the ORDER changed and nothing was lost: a drag that
   * silently drops a round is the fault this whole script exists for.
   */
  const before = await names();
  const held = await packs();
  // Onto another FILLED tile — that is the swap gesture the row actually has
  // for reordering. An empty square is a drop TARGET for a pack or a round
  // off the shelf, which is a different wiring and already checked above.
  await page.evaluate(() => {
    const filled = [...document.querySelectorAll('.lb-tiles .lb-tile.is-pack')]
      .filter((x) => x.getClientRects().length);
    const last = filled[filled.length - 1];
    if (last) last.setAttribute('data-probe', '1');
  });
  await drag('.lb-tiles .lb-tile.is-pack .drag-grip', '[data-probe="1"]');
  check('a round tile dragged to a later slot moves', await names() !== before, true);
  check('and nothing was lost on the way', await packs(), held);

  /*
   * AND THE CONTROLS ON THOSE TILES ARE PRESSED, because nothing else in this
   * repo presses one.
   *
   * The gap dial has now died twice in a way every static check waves through
   * — first a lost `import`, then a moved body still calling the launch bar's
   * `paintOrder()` from a module that has no such function. Both times the
   * dial DREW perfectly, both times the `ReferenceError` landed in the click
   * handler's own catch, and both times `node --check`, the full suite,
   * `pub-unchanged` and this script's own drags all passed.
   *
   * A press is the only thing that can see it. Cycling twice is deliberate:
   * one press proves the handler runs, and the second proves it is stepping a
   * dial rather than initialising one — which is the same distinction the
   * seconds field turned out to be hiding.
   */
  const dialFaces = () => page.evaluate(() =>
    [...document.querySelectorAll('.gap-dial')].map((d) => d.textContent.trim()).join(' '));

  const dials = await page.evaluate(() => document.querySelectorAll('.gap-dial').length);
  check('a gap dial exists to press', dials > 0 ? 'yes' : 'no', 'yes');
  if (dials) {
    const first = await dialFaces();
    await page.locator('.gap-dial').first().click();
    await wait(250);
    const second = await dialFaces();
    check('pressing a gap dial changes it', second === first ? 'nothing happened' : 'changed', 'changed');
    await page.locator('.gap-dial').first().click();
    await wait(250);
    const third = await dialFaces();
    check('a second press moves it on again', third !== second && third !== first ? 'changed' : `stuck on ${third}`, 'changed');
  }

  check('no console errors', errors.join(' | ') || 'none', 'none');
  await browser.close();
} finally {
  stop();
}

console.log(failures
  ? `\n${failures} FAILED — something on the launch bar is broken.\n`
  : '\nEvery drag landed where it was aimed, and every dial answered.\n');
process.exit(failures ? 1 : 0);
