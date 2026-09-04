#!/usr/bin/env node
/**
 * PRESS EVERY CONTROL ON THE CONSOLE AND SEE WHETHER ANYTHING HAPPENS.
 *
 * ---
 *
 * **This repo's whole failure class is a control nobody ever pressed.** The
 * list is long and every entry looked fine in a diff: the arcade board that
 * was computed and never drawn, the publish route with no caller, the gap dial
 * that died twice in a week, the fold that neither folded nor expanded, and —
 * the one that cost a live gig on 3 September 2026 — a pack card where the
 * click listener sat on a 112 x 15 button in the middle of a 146 x 146 poster,
 * so **8% of it answered a press and the other 92% did nothing at all**.
 *
 * Not one of those is visible to `npm test`. Every one of them is a
 * `ReferenceError` swallowed by a click handler's catch, or a listener on the
 * wrong element, or a route with no button — and in every case the page draws
 * perfectly and nothing throws where anybody is looking.
 *
 * So this presses things. For each control it takes a fingerprint of the page,
 * clicks, waits, and takes another: if the DOM did not change, the URL did not
 * change and no request left the browser, **the control did nothing**, and it
 * is named. That is the one assertion that generalises across all of the
 * faults above.
 *
 * **IT NEVER PRESSES ANYTHING DESTRUCTIVE AND NEVER CONFIRMS A DIALOG.** Every
 * `confirm()` is answered NO, and anything wearing `.danger` or named like a
 * delete is skipped outright — so a run creates nothing, launches nothing and
 * destroys nothing. It also runs against its own server, on its own port, with
 * its own DATA_DIR, which is thrown away afterwards.
 *
 * It cannot live in `npm test`: this repo has no dependencies and Playwright is
 * a container tool. Run it before a gig week, and after anything that moves a
 * listener or restructures a card.
 *
 *   node scripts/dead-controls.mjs
 *   node scripts/dead-controls.mjs --door workshop     # just one door
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

/*
 * A RANDOM PORT, because a run that is killed leaves its server behind.
 * A fixed one then collides with the orphan and every check quietly runs
 * against a server this script never started — which happened, and read as
 * three failures in the app. The guard below still refuses a busy port; the
 * random one just means it almost never has to.
 */
const PORT = Number(process.env.PORT || 48773 + Math.floor(Math.random() * 120));
const KEY = 'deadcontrols';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'deadcontrols-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const onlyDoor = (() => {
  const at = process.argv.indexOf('--door');
  return at > -1 ? process.argv[at + 1] : '';
})();

/*
 * REFUSE TO RUN AGAINST SOMEBODY ELSE'S SERVER.
 *
 * A previous run that did not clean up leaves a server on this port with a
 * game half way through it — and the spawn below then fails to bind, quietly,
 * while the browser happily talks to the OLD one. Every check still runs and
 * every answer is about a server this script never started. That is exactly
 * the "guard that quietly tests nothing" this repo keeps being bitten by, so
 * it is a hard stop rather than a warning.
 */
const portIsFree = async () => {
  try { await fetch(`http://127.0.0.1:${PORT}/health`); return false; } catch { return true; }
};
if (!await portIsFree()) {
  console.error(`\nSomething is already answering on ${PORT}. Stop it, or run with PORT=<free port>.`);
  process.exit(1);
}

const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA },
  stdio: 'ignore',
});
const stop = () => {
  server.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
};
process.on('exit', stop);
// A killed run must still take its server with it.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop(); process.exit(1); });

/*
 * WHAT IS NEVER PRESSED.
 *
 * Two kinds, and they are different reasons. The first is DESTRUCTIVE — a
 * press really does throw a night away, and a check that has to be run before
 * a gig must not be a thing you think twice about running. The second is
 * anything that LEAVES the console, because the next probe would then be
 * measuring a page this script never meant to be on.
 *
 * Nothing goes on this list to quieten a finding. A control that is genuinely
 * inert on purpose goes on ALLOWED_INERT below, with the reason beside it.
 */
const NEVER_PRESS = [
  '.danger',                 // every destructive control wears it, by rule
  '.pack-del', '.lb-unlaunch', '.rw-del',
  '[data-nopress]',
];
const NEVER_PRESS_TEXT = /^(delete|remove|stop|unlaunch|close|sign out|log out|launch|take control|publish)/i;

/*
 * CONTROLS THAT CORRECTLY DO NOTHING WHEN PRESSED, and why.
 *
 * A locked tier rung is the shape: it is pressable ON PURPOSE — `disabled`
 * would grey it and swallow the press, and the sell is the point — but on an
 * account that already holds that rung there is nothing for it to open.
 */
const ALLOWED_INERT = [
  { match: /^(bronze|silver|gold)$/i, why: 'a rung you already hold opens nothing' },
];

let dead = [];
let tiny = [];
let errors = [];

try {
  for (let i = 0; i < 40; i += 1) {
    try { await fetch(`http://127.0.0.1:${PORT}/`); break; } catch { await wait(250); }
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  // Every dialog is answered NO. A check that can say yes is a check that can
  // change something, and this one is meant to be safe to run on any day.
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  let requests = 0;
  page.on('request', (r) => { if (r.url().includes('/api/')) requests += 1; });

  const url = `http://127.0.0.1:${PORT}/console?key=${KEY}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  /** A cheap fingerprint of what is on screen — see the header. */
  const print = () => page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const txt = (main.innerText || '').replace(/\s+/g, ' ');
    let h = 0;
    for (let i = 0; i < txt.length; i += 1) h = (h * 31 + txt.charCodeAt(i)) | 0;
    return `${location.pathname}${location.search}|${main.innerHTML.length}|${h}|${document.querySelectorAll('*').length}`;
  });

  /*
   * THE DOORS, READ OUT OF `console.js` ITSELF rather than written down here.
   *
   * A list copied into a check goes stale the day somebody adds a door, and a
   * check that quietly stops covering a door is worse than no check — this
   * file's whole subject. The doors are LINKS (`/console?door=workshop`), not
   * buttons with a data attribute, so they are navigated to rather than
   * clicked, which also gives each probe a clean page.
   */
  const doors = (() => {
    const src = fs.readFileSync('public/assets/console.js', 'utf8');
    const m = src.match(/const DOORS = \[([^\]]+)\]/);
    if (!m) throw new Error('could not find DOORS in console.js — has it been renamed?');
    return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  })();

  const goDoor = async (door) => {
    await page.goto(`${url}&door=${encodeURIComponent(door)}`, { waitUntil: 'load' });
    // Wait for the page rather than for a guess at how busy the machine is.
    await page.waitForSelector('button.tab[data-tab], .doorhead', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);
  };

  const tabsOn = () => page.evaluate(() => [...document.querySelectorAll('button.tab[data-tab]')]
    .filter((n) => n.getClientRects().length)
    .map((n) => n.dataset.tab));

  const goTab = async (door, tab) => {
    await goDoor(door);
    await page.evaluate((t) => document.querySelector(`button.tab[data-tab="${t}"]`)?.click(), tab);
    await page.waitForTimeout(900);
  };

  /*
   * THE CONTROLS ON WHATEVER IS ON SCREEN, as stable descriptions rather than
   * handles — the page is rebuilt between probes, so a handle from before is
   * detached and clicking it measures nothing.
   */
  const controlsHere = () => page.evaluate(({ never, neverText }) => {
    const out = [];
    const seen = new Set();
    [...document.querySelectorAll('button, [role="button"]')].forEach((n) => {
      if (!n.getClientRects().length) return;
      if (n.disabled) return;
      if (never.some((sel) => n.matches(sel) || n.closest(sel))) return;
      /*
       * THE HALF YOU ARE ALREADY ON DOES NOTHING, AND THAT IS RIGHT. The tab
       * you are looking at, the lit side of the room/online switch, a rung you
       * already hold: pressing one is a no-op by design, so counting it as a
       * dead control would fill the report with noise and teach somebody to
       * skim it — which is how a real finding gets missed.
       */
      if (n.getAttribute('aria-selected') === 'true' || n.getAttribute('aria-pressed') === 'true') return;
      /*
       * `live` IS THIS APP'S WORD FOR "the one you are on" — the lit half of
       * the room/online switch, the scheme you already wear, the tab you are
       * looking at. It has to be listed by NAME: a check that does not know
       * the app's own vocabulary reports fourteen correct no-ops and buries
       * the one real finding underneath them, which is exactly what the first
       * run of this did.
       */
      if (/(^|\s)(live|on|is-on|active|current|lit|selected)(\s|$)/.test(n.className)) return;
      const label = (n.textContent || n.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (new RegExp(neverText, 'i').test(label)) return;
      const r = n.getBoundingClientRect();
      const key = `${n.className}|${label}|${Math.round(r.top)}`;
      if (seen.has(key)) return;
      seen.add(key);
      /*
       * IS SOMETHING BIGGER LISTENING? The lesson from the pack card: what
       * decides whether a control is hittable is the size of the thing that
       * TAKES THE PRESS, not the size of the box somebody drew. A 15px name on
       * a 146px poster is fine when the poster answers, and a bug when it does
       * not — so measure the nearest clickable ancestor where there is one.
       */
      const host = n.parentElement && n.parentElement.closest('[data-clickable], .pack-card, .venue-card, .show-card, .bay-row');
      const hr = host ? host.getBoundingClientRect() : r;
      out.push({
        label, cls: String(n.className || '').split(' ')[0],
        w: Math.round(r.width), h: Math.round(r.height),
        hostW: Math.round(hr.width), hostH: Math.round(hr.height),
      });
    });
    return out;
  }, { never: NEVER_PRESS, neverText: NEVER_PRESS_TEXT.source });

  /** Press the nth control that matches this description, on a fresh page. */
  const press = (c) => page.evaluate((want) => {
    const all = [...document.querySelectorAll('button, [role="button"]')].filter((n) => n.getClientRects().length);
    const el = all.find((n) => {
      const label = (n.textContent || n.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return label === want.label && String(n.className || '').split(' ')[0] === want.cls;
    });
    if (!el) return false;
    el.click();
    return true;
  }, c);

  const list = (onlyDoor ? [onlyDoor] : doors);
  console.log(`\nDEAD CONTROLS — pressing everything on ${list.length} door(s)\n`);

  for (const door of list) {
    await goDoor(door);
    const tabs = await tabsOn();
    for (const tab of tabs.length ? tabs : ['']) {
      if (tab) await goTab(door, tab); else await goDoor(door);
      const controls = await controlsHere();
      let n = 0;
      let dirty = false;
      for (const c of controls) {
        if (ALLOWED_INERT.some((a) => a.match.test(c.label))) continue;
        // The hit-area half of the same question: a control smaller than the
        // touch floor is one somebody misses in a dark pub, and missing is
        // indistinguishable from dead.
        if (Math.min(c.hostW, c.hostH) < 24) tiny.push({ door, tab, ...c });
        /*
         * BACK TO A KNOWN PAGE ONLY WHEN THE LAST PRESS MOVED IT. Reloading
         * before every probe is correct and takes six seconds a control; a
         * press that changed nothing has left the page exactly where it was,
         * so the next probe can start from here.
         */
        if (dirty) {
          if (tab) await goTab(door, tab); else await goDoor(door);
          dirty = false;
        }
        const before = await print();
        const reqBefore = requests;
        const found = await press(c);
        if (!found) continue;
        await page.waitForTimeout(450);
        const after = await print();
        if (after === before && requests === reqBefore) dead.push({ door, tab, ...c });
        else dirty = true;
        n += 1;
      }
      console.log(`  ${door}${tab ? ' / ' + tab : ''} — pressed ${n}`);
    }
  }

  await browser.close();
} catch (err) {
  console.error('\nthe check itself fell over:', err.message);
  process.exitCode = 1;
}

const say = (title, rows, line) => {
  if (!rows.length) return;
  console.log(`\n${title}\n`);
  rows.forEach((r) => console.log(`  ${r.door}${r.tab ? '/' + r.tab : ''}  ${line(r)}`));
};

say('PRESSED AND NOTHING HAPPENED — no DOM change, no request', dead,
  (r) => `"${r.label}"  (.${r.cls}, ${r.w}x${r.h})`);
say('NOTHING BIG ENOUGH LISTENS — the press target is under 24px', tiny,
  (r) => `"${r.label}"  (.${r.cls}, ${r.w}x${r.h}, nearest clickable ${r.hostW}x${r.hostH})`);

if (errors.length) {
  console.log('\nERRORS THE PAGE THREW WHILE THIS RAN\n');
  [...new Set(errors)].slice(0, 20).forEach((e) => console.log('  ' + e));
}

console.log('');
if (dead.length) {
  console.log(`${dead.length} control(s) did nothing when pressed.`);
  process.exitCode = 1;
} else {
  console.log('Every control pressed did something.');
}
