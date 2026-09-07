#!/usr/bin/env node
/**
 * DO THE CONSOLE'S CONTROLS DO WHAT THEY SAY? — pressed, in a real browser, on
 * a real signed-in account.
 *
 * ---
 *
 * **This exists because "a control reports success it did not have" was the
 * single most common fault in the September 2026 sweep**, and not one of the
 * repo's checks could see any of them. Every fault below passed `node --check`,
 * 1,684 unit tests, `console-frame`, `drag-check` and `community-bay`:
 *
 *  - a `?tab=` link killed every tab button on that door, silently — the app
 *    puts him there itself, from six `goTo()` links;
 *  - the colour swatch for the scheme you started on was dead after one change;
 *  - switching a feature off removed its own row, so it could never be switched
 *    back on — and the next switch-off posted a list without it, turning the
 *    first one back ON;
 *  - the editor's Check answered 403 for the OWNER, who writes every pack in
 *    the catalogue, and the button flashed "All good" at the refusal;
 *  - renaming a prepared night to the same slug DELETED it — "Friday Night" to
 *    "Friday night" — with no confirm and both calls answering 200.
 *
 * Each check here was run against the broken code first: nine of them failed
 * before the fixes and all of them pass after. **A check nobody has seen fail
 * is a check nobody knows the meaning of.**
 *
 *   node scripts/console-controls.mjs
 *
 * It makes its own owner and quizmaster rather than driving the host key: the
 * key has no account to save a colour or a preference against, so half of this
 * cannot persist on it and the run would be measuring the wrong thing. That is
 * the same lesson `console-frame.mjs` records about an empty lobby.
 *
 * Its own port, its own DATA_DIR, both cleaned up on the way out.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import net from 'node:net'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = Number(process.env.PORT || 49001), KEY = 'yellowcheck';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'yellow-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const busy = await new Promise((res) => { const p = net.createServer();
  p.once('error', () => res(true)); p.once('listening', () => p.close(() => res(false))); p.listen(PORT, '127.0.0.1'); });
if (busy) { console.error('port busy'); process.exit(1); }
const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA }, stdio: 'ignore' });
let stopped = false;
const stop = () => { if (stopped) return; stopped = true; server.kill(); fs.rmSync(DATA, { recursive: true, force: true }); };
server.unref(); process.on('exit', stop);
const B = `http://127.0.0.1:${PORT}`;
let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${JSON.stringify(want)}\n        got    ${JSON.stringify(got)}`);
};
let browser;
try {
  for (let i = 0; i < 40; i += 1) { try { await fetch(`${B}/`); break; } catch { await wait(250); } }
  // A REAL SIGNED-IN QUIZMASTER, not the host key: the host key has no account
  // to save a colour or a preference against, so half of what is being checked
  // here cannot persist on it and the check would be measuring the wrong thing.
  server.kill();
  await wait(500);
  const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
  const bookFile = path.join(DATA, 'accounts.json');
  const book = new Accounts(bookFile);
  book.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
  const qm = book.create({ email: 'qm@example.com', password: 'quizmaster passphrase',
    name: "Quizzy Rascal", role: 'quizmaster', tier: 'gold', status: 'active' });
  book.save();
  const again = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA }, stdio: 'ignore' });
  again.unref(); process.on('exit', () => again.kill());
  for (let i = 0; i < 40; i += 1) { try { await fetch(`${B}/`); break; } catch { await wait(250); } }

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${B}/login`, { waitUntil: 'load' });
  await page.fill('input[type=email]', 'qm@example.com');
  await page.fill('input[type=password]', 'quizmaster passphrase');
  await page.evaluate(() => document.querySelector('form')?.requestSubmit());
  await page.waitForTimeout(2000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));

  console.log('\nTHE CONSOLE\u2019S CONTROLS, PRESSED\n');

  // 1 — a ?tab= link must not kill every tab button on that door.
  await page.goto(`${B}/console?door=account&tab=help`, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const onHelp = await page.evaluate(() => document.querySelector('button.tab.on')?.textContent.trim());
  check('arriving on ?tab=help lands on Help', onHelp, 'Help');
  await page.evaluate(() => [...document.querySelectorAll('button.tab')]
    .find((b) => b.textContent.trim().startsWith('Account'))?.click());
  await page.waitForTimeout(900);
  const moved = await page.evaluate(() => ({
    lit: document.querySelector('button.tab.on')?.textContent.trim(),
    url: new URL(location.href).searchParams.get('tab'),
  }));
  check('and pressing Account actually goes there', moved.lit, 'Account');
  check('with the ?tab= moved along rather than left behind', moved.url, 'account');

  // 3 — a feature switched off keeps its row, so it can be switched back on.
  await page.goto(`${B}/console?door=account&tab=settings`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // 2 — the colour swatch you started on is still pressable after a change.
  const schemes = await page.evaluate(() => [...document.querySelectorAll('.scheme-swatch')].map((b) => b.dataset.scheme));
  if (schemes.length > 1) {
    const first = await page.evaluate(() => document.querySelector('.scheme-swatch.live')?.dataset.scheme);
    const other = schemes.find((s) => s !== first);
    await page.evaluate((s) => document.querySelector(`.scheme-swatch[data-scheme="${s}"]`)?.click(), other);
    await page.waitForTimeout(900);
    const now = await page.evaluate(() => document.querySelector('.scheme-swatch.live')?.dataset.scheme);
    check('picking a second colour moves the lit swatch', now, other);
    await page.evaluate((s) => document.querySelector(`.scheme-swatch[data-scheme="${s}"]`)?.click(), first);
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => document.querySelector('.scheme-swatch.live')?.dataset.scheme);
    check('and the one you STARTED on still works', back, first);
  } else {
    console.log('  --   no colour picker on this account, skipped');
  }


  const before = await page.evaluate(() => [...document.querySelectorAll('.feat-switch')].map((s) => s.dataset.feature));
  if (before.length) {
    await page.evaluate((f) => document.querySelector(`.feat-switch[data-feature="${f}"] .hat-half[data-want="0"]`)?.click(), before[0]);
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => [...document.querySelectorAll('.feat-switch')].map((s) => s.dataset.feature));
    check('a switched-off feature keeps its row', after.includes(before[0]), true);
    check('and every other row is still there', after.length, before.length);
    const state = await page.evaluate((f) => document.querySelector(`.feat-switch[data-feature="${f}"]`)?.dataset.on, before[0]);
    check('and it reads as off', state, '0');
    await page.evaluate((f) => document.querySelector(`.feat-switch[data-feature="${f}"] .hat-half[data-want="1"]`)?.click(), before[0]);
    await page.waitForTimeout(1800);
    const backOn = await page.evaluate((f) => document.querySelector(`.feat-switch[data-feature="${f}"]`)?.dataset.on, before[0]);
    check('and it can be switched back on', backOn, '1');
  } else {
    console.log('  --   no switchable features on this account, skipped');
  }

  // 4 — the editor's Check runs for whoever is signed in.
  for (const [who, email, pw] of [['an owner', 'owner@example.com', 'owner passphrase here'],
                                  ['a quizmaster', 'qm@example.com', 'quizmaster passphrase']]) {
    const inPage = await browser.newPage();
    await inPage.goto(`${B}/login`, { waitUntil: 'load' });
    await inPage.fill('input[type=email]', email);
    await inPage.fill('input[type=password]', pw);
    await inPage.evaluate(() => document.querySelector('form')?.requestSubmit());
    await inPage.waitForTimeout(1500);
    const got = await inPage.evaluate(async () => {
      const r = await fetch('/api/quiz/__validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'x', title: '', rounds: [] }),
      });
      const d = await r.json().catch(() => ({}));
      return { status: r.status, problems: Array.isArray(d.problems) ? d.problems.length : -1 };
    });
    check(`the editor's Check runs for ${who}`, got.status, 200);
    check(`  ...and tells ${who} what is wrong`, got.problems > 0, true);
    await inPage.close();
  }

  /*
   * 5 — RENAMING A NIGHT TO THE SAME SLUG MUST NOT DELETE IT.
   *
   * "Friday Night" and "Friday night" both make the id `friday-night`, so the
   * save REPLACED the show and the delete that follows a rename then threw the
   * replacement away — with no confirm, both calls answering 200.
   */
  const dialogs = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.type());
    await (d.type() === 'prompt' ? d.accept(dialogs.length === 1 ? 'Friday Night' : 'Friday night') : d.accept());
  });

  await page.goto(`${B}/console?door=console`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="quiz"]')?.click());
  await page.waitForSelector('.pack-card[data-pack]');
  await page.evaluate(() => document.querySelector('.pack-card[data-pack]')?.click());
  await page.waitForTimeout(1000);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save')?.click());
  await page.waitForTimeout(1500);

  const madeIt = await page.evaluate(async () => {
    const r = await fetch('/api/library');
    const d = await r.json();
    return (d.shows || []).map((x) => ({ id: x.id, name: x.name, items: (x.items || []).length }));
  });
  check('a night was saved to rename', madeIt.length, 1);

  await page.goto(`${B}/console?door=workshop&tab=shows`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const pressed = await page.evaluate(() => {
    const b = document.querySelector('.show-rename');
    if (b) b.click();
    return Boolean(b);
  });
  check('the Rename control is there to press', pressed, true);
  await page.waitForTimeout(1800);

  const after = await page.evaluate(async () => {
    const r = await fetch('/api/library');
    const d = await r.json();
    return (d.shows || []).map((x) => ({ id: x.id, name: x.name, items: (x.items || []).length }));
  });
  check('the night survives a rename to the same slug', after.length, 1);
  check('  ...under the new spelling', after[0] && after[0].name, 'Friday night');
  check('  ...with what it plays still in it', after[0] && after[0].items, madeIt[0] && madeIt[0].items);

  check('nothing threw', errs.length ? errs.slice(0, 3) : 'none', 'none');
  console.log(fails
    ? `\n${fails} check${fails === 1 ? '' : 's'} failed \u2014 a control is saying something it did not do.\n`
    : '\nEvery control did what it said.\n');
  process.exitCode = fails ? 1 : 0;
} catch (e) { console.error('threw:', e.message); process.exitCode = 1; }
finally { try { await browser?.close(); } catch {} stop(); }
