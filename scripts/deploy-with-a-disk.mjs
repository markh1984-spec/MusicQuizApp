#!/usr/bin/env node
/**
 * A NIGHT SURVIVES A DEPLOY *WITH* THE DISK — and the host can still replace it.
 *
 * ---
 *
 * `after-a-deploy.mjs` starts where a no-disk Render started: `data/` wiped,
 * a cold room on `pickPack()`'s first pack, phones already in it. That was the
 * 17th. There is a disk now, so a deploy leaves the OPPOSITE state behind: the
 * night that was running comes back exactly as it was, phones and all — and
 * nothing had ever driven the console from there.
 *
 * Reproduced on 22 September 2026 from *"I put card bingo on the launch and
 * then took it off, and I was defaulting every game to the 2006 regardless of
 * what was on the launch control"*. With the disk it does not default to
 * anything: the room comes back on the game it was on. What it DOES do is
 * exactly what reads as "the console isn't changing state" — a tap on a pack
 * puts a tile in Tonight and the projector does not move, because a launched
 * night with phones in it may not be wiped by a quiet launch. That is by
 * design; the live line names what is on the wall, and Launch asks before it
 * ends it. This guard pins all of that, for card bingo AND music bingo,
 * because the first reproduction looked card-specific and was not.
 *
 * It also pins the venue coming back BY ITSELF after a restart. The venue is
 * never remembered on the device (by decision), so it has to be DERIVED — and
 * a venue with no usual night comes back as "No venue — pick one", which
 * stands Launch down for want of prizes. Station Tap has Thursdays on it.
 *
 *   node scripts/deploy-with-a-disk.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
import { nightKey, weekdayOf } from '../public/assets/diary.js';
const { chromium } = playwright();

let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  — ${d}` : ''}`); };
const VENUE = 'The Restart Arms';

async function drive({ kind, tab, packSel, title, thenTab, thenSel, thenTitle }) {
  console.log(`\n${title.toUpperCase()} RUNNING ACROSS A RESTART`);
  const { base: BASE, data: DATA, stop, restart } = await startApp({
    key: `deploy-disk-${kind}`,
    async seed(dir) {
      const { Accounts } = await import('../src/accounts.js');
      const book = new Accounts(path.join(dir, 'accounts.json'));
      book.create({ email: 'o@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
      book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
      book.save();
    },
  });
  let browser;
  try {
    browser = await chromium.launch();
    const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
    const errs = [];
    /*
     * TWO LINES THE BROWSER LOGS AS ERRORS AND THAT ARE NOT: the SSE stream
     * the restart cuts (`ERR_INCOMPLETE_CHUNKED_ENCODING`), and the 409 the
     * quiet launch takes when it taps a pack over a launched night — that
     * refusal is the whole point of the assertion above it, and the browser
     * writes every non-2xx fetch to its console as "Failed to load resource".
     */
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/CHUNKED_ENCODING|status of 409/.test(m.text())) return;
      errs.push(m.text().slice(0, 160));
    });
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160)));
    const dialogs = [];
    p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

    await p.goto(`${BASE}/login`, { waitUntil: 'load' });
    await p.fill('input[type=email]', 'qm@example.com');
    await p.fill('input[type=password]', 'quizmaster passphrase');
    await p.evaluate(() => document.querySelector('form')?.requestSubmit());
    await p.waitForTimeout(2500);
    // A venue with prizes AND a usual night of tonight — Station Tap's shape.
    await p.evaluate(async ({ venue, night }) => {
      const H = { 'Content-Type': 'application/json' };
      const mk = await fetch('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: venue }) });
      const c = ((await mk.json()).customers || []).find((x) => x.name === venue);
      await fetch(`/api/invoices/customers/${encodeURIComponent(c.id)}/rewards`, { method: 'PUT', headers: H,
        body: JSON.stringify({ rewards: ['A pint', 'A double', 'A wine'], usualNight: night }) });
    }, { venue: VENUE, night: weekdayOf(nightKey()) });
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('.pack-card', { timeout: 20000 });
    await p.evaluate(async (venue) => {
      document.querySelector('.lb-where')?.click();
      await new Promise((r) => setTimeout(r, 400));
      [...document.querySelectorAll('.lb-venues button')].find((b) => b.textContent.includes(venue))?.click();
    }, VENUE);
    await p.waitForTimeout(800);

    const room = () => p.evaluate(async () => {
      const lib = await (await fetch('/api/library')).json();
      const code = lib.joinCode || (lib.running && lib.running.joinCode) || '';
      const v = await (await fetch(`/api/state?role=screen&g=${encodeURIComponent(code)}`)).json();
      return { code, title: v.title || '', phase: v.phase };
    });
    const openTab = async (want) => {
      await p.evaluate((w) => [...document.querySelectorAll('.tab')].find((b) => new RegExp(w, 'i').test(b.textContent))?.click(), want);
      await p.waitForTimeout(900);
    };
    const tap = async (sel) => {
      const c = await p.$(sel);
      if (!c) return false;
      const b = await c.boundingBox();
      await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await p.waitForTimeout(1500);
      return true;
    };

    await openTab(tab);
    check(`the ${title} card is on its shelf`, await tap(packSel));
    await p.locator('.lb-go').click();
    await p.waitForTimeout(2500);
    check('Launch takes the host to the control view', /\/host/.test(p.url()), p.url().replace(BASE, ''));
    const before = await room();
    check(`the room is on ${title}`, before.title === title, before.title);
    for (const name of ['Table 1', 'Table 2']) {
      await p.evaluate(async ({ code, name }) => fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) }), { code: before.code, name });
    }
    await p.waitForTimeout(600);

    console.log('  — the deploy: the server restarts and the disk stays —');
    check('the server came back', await restart());
    await p.waitForTimeout(1200);
    const files = [];
    const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const full = path.join(d, f.name); if (f.isDirectory()) walk(full); else if (f.name === 'state.json') files.push(full); } };
    walk(DATA);
    const st = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))).find((s) => s.kind === kind) || {};
    check('the night is on the disk as it was', st.launched === true && Object.keys(st.players || {}).length === 2, `launched=${st.launched} players=${Object.keys(st.players || {}).length}`);
    const after = await room();
    check(`and the room comes back on ${title}, phones and all`, after.title === title && after.code === before.code, `${after.title} / ${after.code}`);

    await p.goto(`${BASE}/console`, { waitUntil: 'load' });
    check('the console draws its shelf after the restart', await p.waitForSelector('.pack-card', { timeout: 20000 }).then(() => true).catch(() => false));
    await p.waitForTimeout(1200);
    const venueOnBar = await p.$eval('.lb-where', (n) => n.textContent.trim()).catch(() => '');
    check('the venue comes back BY ITSELF (usual night), so Launch is not stood down for want of prizes', venueOnBar.includes(VENUE), venueOnBar);
    const live = await p.$eval('.lb-live, .lb-live-row', (n) => n.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
    check(`the live line says what is on the wall: ${title}`, live.includes(title), live.slice(0, 80));

    await openTab(thenTab);
    check(`tapping ${thenTitle} puts it in Tonight`, await tap(thenSel) && (await p.$$('.lb-tile.is-pack')).length > 0);
    const untouched = await room();
    check('…and does NOT wipe the night on the wall (a launched night with phones is never replaced by a tap)', untouched.title === title, untouched.title);
    const go = await p.$eval('.lb-go', (n) => ({ off: n.disabled, text: n.textContent.replace(/\s+/g, ' ').trim() }));
    check(`Launch is live and names ${thenTitle}`, !go.off && go.text.includes(thenTitle.split(' ')[0]), go.text);

    await p.locator('.lb-go').click();
    await p.waitForTimeout(3000);
    check('Launch ASKS before ending the running night, naming it', dialogs.some((m) => m.includes(title) && /running/i.test(m)), (dialogs[0] || '(no dialog)').slice(0, 90));
    const switched = await room();
    check(`and the room is now on ${thenTitle}`, switched.title === thenTitle, switched.title);
    check('no browser errors', errs.length === 0, errs.join(' | '));
  } finally {
    if (browser) await browser.close();
    await stop();
  }
}

await drive({ kind: 'cards', tab: 'card', packSel: '.pack-card', title: 'Card Bingo', thenTab: 'music bingo', thenSel: '.pack-card[data-pack="mbc-6"]', thenTitle: 'MBC 6 - 2000s & 2010s' });
await drive({ kind: 'bingo', tab: 'music bingo', packSel: '.pack-card[data-pack="mbc-6"]', title: 'MBC 6 - 2000s & 2010s', thenTab: 'card', thenSel: '.pack-card', thenTitle: 'Card Bingo' });

console.log(fails ? `\n${fails} FAILED — a deploy with the disk does not leave the host able to launch` : '\nA night survives a deploy with the disk, and the host can still replace it.');
process.exit(fails ? 1 : 0);
