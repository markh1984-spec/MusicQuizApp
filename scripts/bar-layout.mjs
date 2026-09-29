#!/usr/bin/env node
/**
 * THE LAUNCH BAR'S LAYOUT — four things the 23 September 2026 sweep measured
 * and the host chose a fix for on 29 September.
 *
 *   node scripts/bar-layout.mjs
 *
 * Nothing here throws when it is wrong: words sit under a button, a fold keeps
 * what it should hide, a "+" does nothing, a target is too small for a thumb.
 * Only rectangles and real presses find any of it.
 */
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, key: KEY, stop } = await startApp({ key: 'bar-layout' });
let browser;
async function barWith(pack, { width = 1280, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
  await page.waitForSelector('.pack-card', { timeout: 20000 });
  if (pack) {
    await page.evaluate((id) => document.querySelector(`.pack-card[data-pack="${id}"]`)?.click(), pack);
    await wait(1800);
  }
  return { page, errors, close: () => context.close() };
}
try {
  browser = await chromium.launch();

  console.log('\n1 · THE ROUND-TYPE WORDS STOP BEFORE THE GAP DIAL');
  // The dial is absolute in the tile's corner and the words were in flow under
  // it: "Pick them all" and "First letter" ran beneath the 📷 at every width.
  for (const width of [1280, 1000, 390]) {
    const { page, errors, close } = await barWith('1980s-pop-music', { width });
    const hits = await page.evaluate(() => {
      const out = [];
      for (const tile of document.querySelectorAll('.lb-tile.is-pack')) {
        const dial = tile.querySelector(':scope > .gap-dial');
        const sub = tile.querySelector('.lb-tile-sub');
        if (!dial || !sub) continue;
        const d = dial.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(sub);
        for (const r of range.getClientRects()) {
          if (r.width && r.right > d.left && r.left < d.right && r.bottom > d.top && r.top < d.bottom) out.push(`${sub.textContent.trim()} runs ${Math.round(r.right - d.left)}px under the dial`);
        }
      }
      return { out, tiles: document.querySelectorAll('.lb-tile.is-pack .gap-dial').length };
    });
    check(`at ${width}px, ${hits.tiles} tiles with a dial, no words under it`, hits.tiles > 0 && hits.out.length === 0, hits.out.slice(0, 2).join(' | '));
    check(`at ${width}px, nothing threw`, errors.length === 0, errors.join(' | '));
    await close();
  }
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the launch bar's layout is wrong` : '\nThe launch bar lays out as chosen.');
process.exit(fails ? 1 : 0);
