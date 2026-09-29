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
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A REAL QUIZMASTER WITH A PUB, never the host key: the house room has no
// venue, so Launch stands down for want of prizes and a press proves nothing.
const { base: BASE, stop } = await startApp({
  key: 'bar-layout',
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});
let browser;
let cookie = '';
async function barWith(pack, { width = 1280, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch });
  await context.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: BASE }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(`${BASE}/console`, { waitUntil: 'load' });
  await page.waitForSelector('.pack-card', { timeout: 20000 });
  await page.evaluate(async () => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes('The Crown'))?.click();
  });
  await wait(500);
  if (pack) {
    await page.evaluate((id) => document.querySelector(`.pack-card[data-pack="${id}"]`)?.click(), pack);
    await wait(1800);
  }
  return { page, errors, close: () => context.close() };
}
try {
  const signIn = await fetch(`${BASE}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const mk = await (await fetch(`${BASE}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Crown' }) })).json();
  const venue = (mk.customers || []).find((c) => c.name === 'The Crown');
  await fetch(`${BASE}/api/invoices/customers/${encodeURIComponent(venue.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['Pint', 'Half', 'Crisps'] }) });
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

  console.log('\n2 · HIDE FOLDS THE TILES, THE SETTINGS AND THE PRIZES, AND LEAVES LAUNCH');
  // It folded only the tiles (424 -> 315px), keeping a row of settings nobody
  // changes mid-evening. The host's pick, 29 Sept: fold those too, keep the
  // name line, the ready light and Launch, so a folded bar still launches.
  for (const width of [1280, 390]) {
    const { page, errors, close } = await barWith('1980s-pop-music', { width });
    const openH = await page.evaluate(() => Math.round(document.querySelector('.launchbar').getBoundingClientRect().height));
    await page.evaluate(() => document.querySelector('.lb-fold')?.click());
    await wait(500);
    const shut = await page.evaluate(() => {
      const seen = (sel) => { const n = document.querySelector(sel); return Boolean(n && n.getClientRects().length); };
      const go = document.querySelector('.lb-go');
      go.scrollIntoView({ block: 'center' });
      const b = go.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { settings: seen('.lb-set-night'), prizes: seen('.lb-prizes'), tiles: seen('.lb-order'), launch: Boolean(hit && hit.closest('.lb-go')), h: Math.round(document.querySelector('.launchbar').getBoundingClientRect().height) };
    });
    check(`at ${width}px, shut hides the tiles, settings and prizes (${openH} -> ${shut.h}px)`, !shut.settings && !shut.prizes && !shut.tiles, JSON.stringify(shut));
    check(`at ${width}px, and Launch is still there to press`, shut.launch);
    const asked = page.waitForRequest((r) => r.url().includes('/api/host/launch') && r.method() === 'POST', { timeout: 5000 }).then(() => true, () => false);
    await page.evaluate(() => document.querySelector('.lb-go').click());
    check(`at ${width}px, and pressing it while shut launches rather than opening the bar`, await asked);
    check(`at ${width}px, nothing threw`, errors.length === 0, errors.join(' | '));
    await close();
  }

  console.log('\n3 · AN EMPTY SLOT OPENS THE SEARCH, AND WHAT YOU PICK IS ADDED');
  // Once a pack was in, the empty squares were drop targets only: a dashed
  // "+" with a pointer cursor that did nothing when tapped, and HTML5 drag
  // never fires on a phone. The host's pick, 29 Sept: a tap opens the same
  // search an empty night opens, and a pick ADDS to the night.
  for (const width of [1280, 390]) {
    const { page, errors, close } = await barWith('2006', { width });
    const before = await page.evaluate(() => ({
      empties: document.querySelectorAll('.lb-tile.mix-drop').length,
      buttons: [...document.querySelectorAll('.lb-tile.mix-drop')].filter((n) => n.tagName === 'BUTTON').length,
      said: [...document.querySelectorAll('.lb-tile.mix-drop')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
    }));
    check(`at ${width}px, ${before.empties} empty slots, every one a button`, before.empties > 0 && before.buttons === before.empties, JSON.stringify(before));
    check(`at ${width}px, the first says "Tap to add" and the rest do not`, /Tap to add/.test(before.said[0] || '') && before.said.slice(1).every((t) => !/Tap to add/.test(t)), JSON.stringify(before.said));
    await page.locator('.lb-tile.mix-drop').first().click();
    await wait(400);
    const opened = await page.evaluate(() => ({ find: Boolean(document.querySelector('.lb-find')?.getClientRects().length), focused: document.activeElement?.classList.contains('lb-text') }));
    check(`at ${width}px, tapping it opens the pack search, ready to type`, opened.find && opened.focused, JSON.stringify(opened));
    await page.evaluate(() => { const t = document.querySelector('.lb-text'); t.value = 'madonna'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(400);
    await page.evaluate(() => document.querySelector('.lb-hit')?.click());
    await wait(1200);
    const after = await page.evaluate(() => [...document.querySelectorAll('.lb-tile.is-pack')].map((n) => n.getAttribute('title') || ''));
    check(`at ${width}px, the pick is ADDED — both packs are in the night`, after.some((t) => /2006/.test(t)) && after.some((t) => /madonna/i.test(t)), JSON.stringify(after));
    check(`at ${width}px, nothing threw`, errors.length === 0, errors.join(' | '));
    await close();
  }

  console.log('\n4 · A THUMB GETS 44px, A MOUSE KEEPS THE COMPACT BAR');
  // Menu rows were 34px tall, the ready line's "open it" 42x16 and a tile's
  // x 30x30. The host's pick, 29 Sept: 44px on a touchscreen only — the
  // laptop is driven with a mouse and keeps its compact menus — and the x's
  // tap area grows invisibly everywhere.
  for (const [width, touch] of [[390, true], [1280, false]]) {
    const { page, errors, close } = await barWith('1980s-pop-music', { width, touch });
    const coarse = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
    const x = await page.evaluate(() => {
      const b = document.querySelector('.lb-tile-off');
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const on = (px, py) => Boolean(document.elementFromPoint(px, py)?.closest('.lb-tile-off'));
      let w = 0, h = 0;
      for (let d = -40; d <= 40; d += 1) { if (on(cx + d, cy)) w += 1; if (on(cx, cy + d)) h += 1; }
      return { w, h, drawn: Math.round(r.width) };
    });
    check(`at ${width}px${touch ? ' (touch)' : ''}, a tile's x takes a press across 44x44 (drawn ${x.drawn}px)`, x.w >= 44 && x.h >= 44, JSON.stringify(x));
    const link = await page.evaluate(() => { const a = document.querySelector('.lb-ready a'); if (!a) return null; const r = a.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
    await page.evaluate(() => document.querySelector('.launchbar .pick-face')?.click());
    await wait(400);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.pick-menu:not([hidden]) .pick-opt')].map((n) => Math.round(n.getBoundingClientRect().height)));
    if (touch) {
      check(`at ${width}px on a touchscreen (coarse pointer: ${coarse}), every menu row is at least 44px`, coarse && rows.length > 0 && rows.every((hh) => hh >= 44), JSON.stringify(rows));
      check(`at ${width}px on a touchscreen, "open it" is a 44px target`, Boolean(link) && link.h >= 44, JSON.stringify(link));
    } else {
      check(`at ${width}px with a mouse, the menus stay compact (${rows[0]}px rows)`, !coarse && rows.length > 0 && rows.every((hh) => hh < 44), JSON.stringify(rows));
    }
    check(`at ${width}px, nothing threw`, errors.length === 0, errors.join(' | '));
    await close();
  }
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the launch bar's layout is wrong` : '\nThe launch bar lays out as chosen.');
process.exit(fails ? 1 : 0);
