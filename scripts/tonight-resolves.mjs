#!/usr/bin/env node
/**
 * THE LAUNCH BAR OFFERS REAL GAMES, AND A NIGHT CAN NAME ANY PACK YOU HOLD.
 *
 * Two faults, both found by a sweep, both introduced by a change to the TAB
 * LIST — which is why they need a guard that opens the real console rather
 * than one that reads `TABS`:
 *
 *  1. The game dropdown was built from every `TABS` entry with `packs` +
 *     `needs`. That was quiz and bingo until the round tabs landed, and then
 *     five — so the picker offered General Knowledge, Image Rounds and Music
 *     Intros, and `gameOf().id` went to `/api/host/launch` as `game`:
 *     `400 Unknown game: text`, on the protected surface.
 *
 *  2. Quiz Packs deliberately hides the one-round packs, and `applyShow()`
 *     resolved a show's pack ids against THAT filtered shelf. So loading a
 *     saved show naming one of the twenty-four left Tonight EMPTY with
 *     nothing said anywhere — `loadShow()`'s banner cannot cover it, because
 *     the server reports no `problems`: the file is there and perfectly fine.
 *
 * Neither throws, both draw a page that looks right, and `npm test` cannot
 * see either — *a test that never runs the artefact proves nothing about it.*
 *
 *   node scripts/tonight-resolves.mjs
 */

import { createRequire } from 'node:module';

import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'tonightresolves';
const { base: BASE, stop } = await startApp({ key: KEY });

let failures = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${JSON.stringify(want)}\n        got    ${JSON.stringify(got)}`);
};

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
  await page.waitForSelector('.launchbar');
  await page.waitForTimeout(1200);

  console.log('\nTONIGHT — what it offers, and what it can find\n');

  /*
   * THE NATIVE `<select>` IS THE TRUTH, not the popover skin over it — see
   * `console-pick.js`. So this reads the options the LAUNCH would send.
   */
  const kinds = await page.evaluate(() => {
    const sel = document.querySelector('.launchbar select.lb-game')
      || [...document.querySelectorAll('.launchbar select')]
        .find((s) => [...s.options].some((o) => o.value === 'bingo'));
    return sel ? [...sel.options].map((o) => o.value) : ['NO GAME PICKER FOUND'];
  });
  check('the game picker offers only kinds the server can launch', kinds.sort(), ['bingo', 'quiz']);

  /*
   * AND EVERY ONE OF THEM IS ASKED OF THE SERVER, rather than trusted to a
   * list — the 400 is what a host actually met.
   */
  for (const kind of kinds) {
    const res = await page.evaluate(async ([b, k, key]) => {
      const r = await fetch(`${b}/api/host/launch?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: k, packId: 'definitely-not-a-pack' }),
      });
      return { status: r.status, body: await r.text() };
    }, [BASE, kind, KEY]);
    check(`  ...and "${kind}" is not refused as an unknown game`, /Unknown game/.test(res.body), false);
  }

  /*
   * A ONE-ROUND PACK IS OFF THE QUIZ PACKS SHELF BY DESIGN — this finds one
   * and then asks Tonight to resolve it, which is the whole of fault 2.
   */
  const oneRound = await page.evaluate(async ([b, key]) => {
    const lib = await (await fetch(`${b}/api/library?key=${key}`)).json();
    const found = (lib.quizzes || []).find((p) => (p.rounds || []).length === 1 && !p.locked && !p.broken);
    return found ? found.id : '';
  }, [BASE, KEY]);
  check('there is a one-round pack to test with', Boolean(oneRound), true);

  if (oneRound) {
    const onShelf = await page.evaluate((id) => [...document.querySelectorAll('.pack-card[data-pack]')]
      .some((c) => c.dataset.pack === id), oneRound);
    check('  ...and it is NOT on the Quiz Packs shelf, which is the whole trap', onShelf, false);

    // A show naming it. `?show=` is not a thing, so it is saved and loaded the
    // way the console itself does it.
    const saved = await page.evaluate(async ([b, key, id]) => {
      const r = await fetch(`${b}/api/shows?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'One round only', items: [{ kind: 'quiz', packId: id }] }),
      });
      return r.status;
    }, [BASE, KEY, oneRound]);
    // The STATUS, not `true` — the first version of this line returned a bare
    // `true` and reported a save that had 404ed.
    check('  ...a show naming it saved', saved, 200);

    // Loaded THROUGH THE CARD, on the tab a quizmaster would use — a
    // synthesised call would not be the path that was broken.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.launchbar');
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('button.tab[data-tab="shows"]')?.click());
    await page.waitForSelector('.show-card');
    await page.waitForTimeout(400);
    const found = await page.evaluate(() => Boolean(document.querySelector('.show-card')));
    check('  ...the show has a card to press', found, true);
    await page.evaluate(() => document.querySelector('.show-card')?.click());
    await page.waitForTimeout(1500);
    const tiles = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
    check('  ...and loading it puts the pack in Tonight rather than nothing', tiles > 0, true);
  }

  /*
   * The 400s this check causes ITSELF are the point of the launch probes
   * above — a pack id that does not exist. Anything else is a real error.
   */
  check('nothing threw', errors.filter((e) => !/favicon/i.test(e) && !/400 \(Bad Request\)/.test(e)), []);

  await browser.close();
  console.log(failures
    ? `\n${failures} problem${failures === 1 ? '' : 's'}.\n`
    : '\nTonight offers real games, and can find every pack you hold.\n');
} finally {
  stop();
}

process.exit(failures ? 1 : 0);
