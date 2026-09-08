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
  /*
   * FROM THE TITLE, NOT THE MIDDLE OF THE CARD — and that distinction is the
   * whole of this check rather than a detail of it.
   *
   * `drag()` aims at the centre of whatever it is given, and on five of the
   * six cards on the quiz shelf the centre of the card is a ROUND SQUARE:
   * `elementFromPoint()` at the middle of "1980s Pop Music" returns
   * `button.lb-rd`, round index 1. So this line was lifting ONE ROUND and
   * then asserting that a whole pack had burst — it has been failing on a
   * working app, which is the shape of guard this repo already has a rule
   * about: *a guard aimed at whatever happens to be first is measuring the
   * shelf, not the row.*
   *
   * The app is behaving exactly as CLAUDE.md says it should — *the pack lifts
   * from its grip; a round lifts from its own square* — so what had to move
   * is the aim. `.pack-title` is the pack's own grip and is on every card.
   */
  await drag('.pack-card[data-pack] .pack-title', '.lb-tiles');
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
  await drag('.pack-card[data-pack]:not(.in-tonight) .pack-title', '.lb-tile.lb-drop, .lb-tile.mix-drop');
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
  /*
   * EACH DIAL WITH THE PACK ITS TILE BELONGS TO, so the press below can be
   * aimed at a pack that is genuinely burst across several tiles. Written the
   * lazy way — press the first dial and count how many faces moved — this
   * check passed with the fault in, because the first pack on the shelf has
   * ONE round and one tile, and a set of one cannot be over-written. **A
   * guard aimed at whatever happens to be first is measuring the shelf, not
   * the row.**
   */
  const dialInfo = () => page.evaluate(() => {
    const groupOf = (tile) => {
      const t = tile.getAttribute('title') || '';
      const at = t.indexOf(' — ');
      return at === -1 ? t : t.slice(at + 3);
    };
    return [...document.querySelectorAll('.lb-tiles .lb-tile')].flatMap((tile) => {
      const dial = tile.querySelector('.gap-dial');
      if (!dial) return [];
      return [{
        group: tile.classList.contains('is-pack') ? groupOf(tile) : 'doors',
        face: dial.textContent.trim(),
      }];
    });
  });
  const faces = async () => (await dialInfo()).map((d) => d.face);
  const moved = (a, b) => a.filter((face, i) => face !== b[i]).length;

  const info = await dialInfo();
  check('a gap dial exists to press', info.length > 0 ? 'yes' : 'no', 'yes');
  const seen = {};
  for (const d of info) seen[d.group] = (seen[d.group] || 0) + 1;
  const at = info.findIndex((d) => d.group !== 'doors' && seen[d.group] > 1);
  check('and a burst pack has more than one of them', at !== -1, true);
  if (at !== -1) {
    const press = async () => {
      await page.locator('.lb-tiles .lb-tile .gap-dial').nth(at).click();
      await wait(250);
    };
    const first = await faces();
    await press();
    const second = await faces();
    check('pressing a gap dial changes it', moved(first, second) ? 'changed' : 'nothing happened', 'changed');
    /*
     * AND IT CHANGES ONE TILE, NOT THE WHOLE PACK.
     *
     * Every round tile of a burst pack was handed "the gaps this pack makes",
     * so one press moved all of that pack's faces at once — the duplication
     * the strip of chips under the row was deleted for, back through the tile
     * that replaced it. Nothing threw, and the checks either side of this one
     * pass with it in: the dial ran, and it stepped.
     */
    check('and only the tile you pressed', moved(first, second), 1);
    await press();
    const third = await faces();
    const stepped = moved(second, third) === 1 && third[at] !== first[at];
    check('a second press moves it on again', stepped ? 'changed' : `stuck on ${third[at]}`, 'changed');
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
