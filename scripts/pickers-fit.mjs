#!/usr/bin/env node
/**
 * EVERY DROPDOWN ON THE LAUNCH BAR OPENS INSIDE THE WINDOW.
 *
 *   node scripts/pickers-fit.mjs
 *
 * The bar's pickers are popovers wider than their own face (console-pick.js,
 * "narrow shut and wide open"), and the side each opens from was measured
 * against the RIGHT edge only. At 390px a menu is 80vw wide, so a picker in
 * the middle of the row overflowed the right, was flipped to open leftwards,
 * and then hung 91px off the LEFT edge — every card shape cut off (the
 * 23 September 2026 sweep). Nothing throws and the options are in the DOM, so
 * only a rectangle finds it. Each picker is opened with a real click, at a
 * phone width and a laptop width, with a bingo pack in Tonight so Card and
 * Bingo prizes are live.
 */
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, key: KEY, stop } = await startApp({ key: 'pickers-fit' });
let browser;
try {
  browser = await chromium.launch();
  for (const width of [390, 320, 1280]) {
    console.log(`\nAT ${width}px`);
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
    await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
    await page.waitForSelector('.pack-card', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('[data-tab="bingo"]')?.click());
    await wait(900);
    await page.evaluate(() => document.querySelector('.pack-card[data-pack]')?.click());
    await wait(1500);
    const count = await page.locator('.launchbar .pick-face').count();
    check(`the bar has pickers to open (${count})`, count > 3);
    for (let i = 0; i < count; i += 1) {
      const face = page.locator('.launchbar .pick-face').nth(i);
      if (!(await face.isVisible()) || !(await face.isEnabled())) continue;
      await face.scrollIntoViewIfNeeded();
      await face.click();
      await wait(150);
      const got = await page.evaluate(() => {
        const menu = [...document.querySelectorAll('.pick-menu')].find((m) => !m.hidden);
        if (!menu) return null;
        const r = menu.getBoundingClientRect();
        const name = (menu.closest('.pick')?.parentElement?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
        return { left: Math.round(r.left), right: Math.round(r.right), vw: document.documentElement.clientWidth, name };
      });
      if (got) check(`"${got.name}" opens inside the window`, got.left >= 0 && got.right <= got.vw, `${got.left}..${got.right} of ${got.vw}`);
      await page.keyboard.press('Escape');
      await page.mouse.click(2, 2);
      await wait(100);
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — a dropdown opens off the screen.` : '\nEvery dropdown opens where a thumb can reach it.');
process.exit(fails ? 1 : 0);
