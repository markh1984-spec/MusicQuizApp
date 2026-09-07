#!/usr/bin/env node
/**
 * CAN A NIGHT ACTUALLY BE SAVED? — the one control that creates a show, pressed
 * in a real browser.
 *
 * ---
 *
 * **This exists because `Save for another night` was completely dead for a day
 * and every check in the repo stayed green.** `tonightAsShow()` is module
 * scope; the `segmentsNow()` it was rewritten to call is declared inside
 * `launchBar()`. That is a `ReferenceError` thrown BEFORE the `try` that would
 * have caught it, so the button did nothing at all — no prompt, no request, no
 * error on screen — and `node --check`, 1,684 unit tests, `drag-check`,
 * `console-frame`, `community-bay` and `dead-controls` all passed.
 *
 * `dead-controls.mjs` came closest and could not see it either: it walks an
 * IDLE console, where Save is deliberately `disabled` because there is nothing
 * to keep, and it skips disabled controls. **A guard that never puts a night in
 * Tonight is measuring a console nobody uses** — the same lesson
 * `console-frame.mjs` already records about an empty lobby.
 *
 * So this one sets a night up first, and then presses the button.
 *
 * **Save is the ONLY thing that creates a show.** The other two `/api/shows`
 * callers both edit one that already exists, so when this is broken "Prepare a
 * night" is a tab nothing can be put into and every running-order feature —
 * quiz to bingo to quiz, the whole reason shows exist — is unreachable.
 *
 *   node scripts/save-a-night.mjs
 *
 * Its own port, its own DATA_DIR, both cleaned up on the way out.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const PORT = Number(process.env.PORT || 48991);
const KEY = 'savecheck';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'savecheck-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * REFUSE TO RUN AGAINST SOMEBODY ELSE'S SERVER — and this check learned that
 * the hard way, on itself.
 *
 * `spawn` here has `stdio: 'ignore'`, so a port already in use fails silently:
 * no server of our own starts, and every request goes to whatever is already
 * listening — with ITS data directory, which outlives this run. A stale server
 * from an earlier crash made "and the server kept it" pass on a deliberately
 * broken Save, because the show it read back was the previous run's.
 *
 * A guard that quietly measures the wrong process is worse than no guard, so
 * this one stops rather than lying.
 */
const busy = await new Promise((resolve) => {
  const probe = net.createServer();
  probe.once('error', () => resolve(true));
  probe.once('listening', () => probe.close(() => resolve(false)));
  probe.listen(PORT, '127.0.0.1');
});
if (busy) {
  console.error(`\nPort ${PORT} is already in use, so this check would talk to somebody`);
  console.error('else\'s server and could pass on a broken Save. Stop that process, or');
  console.error(`run with PORT=<free port>.\n`);
  process.exit(1);
}

const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA },
  stdio: 'ignore',
});
/*
 * `unref()` AND AN EXPLICIT STOP, not just the exit hook.
 *
 * A spawned child keeps node's event loop alive, so `process.on('exit')` never
 * fires: the script printed every result and then sat there for ever, which
 * from outside is indistinguishable from the app hanging. It cost this check
 * eight hours on its first run before anybody looked at where it was stuck.
 */
let stopped = false;
const stop = () => {
  if (stopped) return;
  stopped = true;
  server.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
};
server.unref();
process.on('exit', stop);

let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${want}\n        got    ${got}`);
};

let browser;
try {
  for (let i = 0; i < 40; i += 1) {
    try { await fetch(`http://127.0.0.1:${PORT}/`); break; } catch { await wait(250); }
  }

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  /*
   * THE PROMPT HAS TO BE ANSWERED, and Playwright dismisses every dialog by
   * default. Left alone, `prompt()` returns null, the handler returns early on
   * purpose, and this check would report a working Save on a broken one —
   * which is the auto-dismiss trap this repo already records for `confirm()`.
   */
  const named = [];
  page.on('dialog', async (d) => {
    named.push(d.type());
    await (d.type() === 'prompt' ? d.accept('Sweep night') : d.accept());
  });

  /** Every POST the page makes, so the request can be read off the wire. */
  const posted = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/shows')) {
      posted.push(r.postData() || '');
    }
  });

  await page.goto(`http://127.0.0.1:${PORT}/console?key=${KEY}`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="quiz"]')?.click());
  await page.waitForSelector('.pack-card[data-pack]');
  await page.waitForTimeout(500);

  console.log('\nSAVE A NIGHT — the only thing that makes a show\n');

  // A TAP puts a pack in Tonight, the same path a drop takes — and it is the
  // half that works on a touchscreen, where HTML5 drag never fires at all.
  await page.evaluate(() => document.querySelector('.pack-card[data-pack]')?.click());
  await page.waitForTimeout(900);

  const tiles = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
  check('a pack is in Tonight to save', tiles > 0, true);

  const enabled = await page.evaluate(() => {
    const b = document.querySelector('.lb-keep, .lb-save, [class*="save"]');
    return b ? !b.disabled : null;
  });
  check('and Save is no longer inert', enabled, true);

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save');
    if (b) b.click();
  });
  await page.waitForTimeout(1500);

  /*
   * THREE SEPARATE QUESTIONS, because the fault showed as all three at once
   * and any one of them alone could pass on a broken button.
   */
  check('pressing Save threw nothing', errors.join(' | ') || 'none', 'none');
  check('it asked what the night is called', named.includes('prompt'), true);
  check('and it sent the night to the server', posted.length, 1);

  const body = posted.length ? JSON.parse(posted[0]) : {};
  check('the show it sent has a name', String(body.name || ''), 'Sweep night');
  check('and something to play', Array.isArray(body.items) && body.items.length > 0, true);

  /*
   * THE SERVER'S OWN ANSWER, rather than the browser's optimism — and it comes
   * back on `/api/library`, because `/api/shows` is a POST-only route. Reading
   * a show back from the thing that stores it is the difference between "the
   * request left" and "the night is saved".
   */
  const lib = await (await fetch(`http://127.0.0.1:${PORT}/api/library`, {
    headers: { 'X-Host-Key': KEY },
  })).json();
  const kept = (lib.shows || []).map((s) => s.name);
  check('and the server kept it', kept.includes('Sweep night'), true);

  await browser.close();
  console.log(failures
    ? `\n${failures} check${failures === 1 ? '' : 's'} failed — a night cannot be saved.\n`
    : '\nA night can be saved, and the server has it.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  /*
   * THE BROWSER IS CLOSED EVEN WHEN SOMETHING THREW, or node keeps its handles
   * open and never exits — which is not a hang in the app, it is a hang in the
   * check, and it looks identical from outside. This script's own first run
   * spent eight hours that way over a mistyped read-back URL.
   */
  try { await browser?.close(); } catch { /* already gone */ }
  stop();
}
