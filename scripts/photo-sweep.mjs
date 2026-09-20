#!/usr/bin/env node
/**
 * BIN EVERYTHING THAT IS NOT ON THE GALLERY — does the button do it, and does
 * it leave the green ones alone?
 *
 * *"Can I have a button that deletes all the non-gallery photos?"* The grid is
 * an inbox: you work down the reds promoting what is worth keeping, and this
 * empties what is left. It deletes somebody's photographs for good and there
 * is no undo, so the thing that must be proved is not that it fires but that
 * it fires on EXACTLY the red ones.
 *
 * **A PRESS, NEVER A PAYLOAD.** *A control that reports success it did not
 * have is this repo's commonest fault* — so this presses the real button in a
 * real browser and then reads the private repository's own folder to see what
 * actually left.
 *
 *   node scripts/photo-sweep.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { freePort } from '../test/helpers/live-server.mjs';

const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const ROOT = new URL('..', import.meta.url).pathname;
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const NIGHT = '2026-08-20';
const PASSWORD = 'a longer pass phrase';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${n}${note ? `\n        ${note}` : ''}`); };

const data = mkdtempSync(join(tmpdir(), 'sweep-'));
const repo = mkdtempSync(join(tmpdir(), 'sweep-gh-'));
const port = await freePort();
const env = {
  ...process.env, PORT: String(port), HOST_KEY: 'not-used', DATA_DIR: data,
  GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub',
};
const base = `http://127.0.0.1:${port}`;
let server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
server.unref();
const up = async () => { for (let i = 0; i < 80; i += 1) { try { await fetch(base); return; } catch { await wait(150); } } throw new Error('never came up'); };
const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let browser;
try {
  await up();
  const made = await (await post('/api/signup', { email: 'mark@example.com', password: PASSWORD, name: 'Mark' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  await post('/api/reset/complete', { token, password: PASSWORD });
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'owner';
  acc.accounts.push({ ...acc.accounts[0], id: 'qm-mark', email: 'mark+qm@example.com', name: "Mark's Quizporium", role: 'quizmaster', ownedBy: acc.accounts[0].id, tier: 'gold', comped: true, status: 'active' });
  writeFileSync(file, JSON.stringify(acc));
  server.kill(); await wait(300);
  server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' }); server.unref();
  await up();

  const arc = join(data, 'rooms', 'qm-mark', 'archive'); mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({
    id: 'n1', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: 'The Station Tap, Wokingham',
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));
  /*
   * TWO GREEN AND THREE RED, AND THE DOOR IS WHAT DECIDES IT — a name with no
   * `-picked` on it came through the house camera and shows by default; one
   * with it came off a punter's phone and waits for a lamp. That is
   * `showsByDefault()`, and seeding it this way means the fixture is not
   * asserting its own answer.
   */
  const dir = join(repo, 'photos', 'qm-mark', NIGHT); mkdirSync(dir, { recursive: true });
  const GREEN = ['h1abc.jpg', 'h2abc.jpg'];
  const RED = ['u1abc-picked.jpg', 'u2abc-picked.jpg', 'u3abc-picked.jpg'];
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
    + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCABQAFABAREA/8QAHwAAAQUBAQEB'
    + 'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh'
    + 'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ'
    + 'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG'
    + 'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z', 'base64');
  for (const n of [...GREEN, ...RED]) writeFileSync(join(dir, n), jpeg);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', 'mark+qm@example.com');
  await page.fill('input[type=password]', PASSWORD);
  await page.evaluate(() => document.querySelector('form')?.requestSubmit()); await page.waitForTimeout(1500);
  await page.goto(`${base}/console?door=community`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="photos"]')?.click()); await page.waitForTimeout(2000);
  await page.locator('.bay-rail .bay-rail-group').first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('.bay-rail .bay-pick').filter({ hasNotText: 'The wall' }).first().click();
  await page.waitForTimeout(2500);

  const before = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.doorhead .cphoto').length,
    red: document.querySelectorAll('.doorhead .cphoto-pub.is-off').length,
    green: document.querySelectorAll('.doorhead .cphoto-pub.is-on').length,
    words: (document.querySelector('.photo-sweep') || {}).textContent,
    off: (document.querySelector('.photo-sweep') || {}).disabled,
  }));
  check('the night opens with three off the gallery and two on', before.tiles === 5 && before.red === 3 && before.green === 2, JSON.stringify(before));
  // The shots are what a human looks at afterwards — the standing rule is a
  // screenshot for every UI change, and this one is two states of one button.
  const shots = process.argv[2] || join(tmpdir(), 'sweepshots');
  mkdirSync(shots, { recursive: true });
  const shoot = async (name, sel) => {
    const el = page.locator(sel).first();
    if (!(await el.count())) return;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    await el.screenshot({ path: join(shots, name) }).catch(() => {});
  };
  await shoot('bay.png', '.doorhead .panel.bench');
  await shoot('controls-before.png', '.photo-night-controls');
  check('the button is there and says how many it will bin', /3/.test(before.words || '') && before.off === false, JSON.stringify(before));

  // THE CONFIRM IS PART OF THE CONTROL — a press that skipped it would prove
  // nothing about the one thing standing between a mis-tap and a deletion.
  let asked = '';
  page.on('dialog', (d) => { asked = d.message(); d.accept(); });
  await page.locator('.photo-sweep').click();
  await page.waitForTimeout(4000);
  check('it asked first, naming the number and what survives', /3 photos/.test(asked) && /2 green/.test(asked), asked);

  const after = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.doorhead .cphoto').length,
    red: document.querySelectorAll('.doorhead .cphoto-pub.is-off').length,
    words: (document.querySelector('.photo-sweep') || {}).textContent,
    off: (document.querySelector('.photo-sweep') || {}).disabled,
    count: (document.querySelector('.doorhead .tiny') || {}).textContent,
  }));
  check('the reds are off the grid and the greens are still there', after.tiles === 2 && after.red === 0, JSON.stringify(after));
  check('  ...and the button goes inert, saying why', after.off === true && /Nothing off the gallery/.test(after.words || ''), JSON.stringify(after));

  /*
   * ---- AND A PHOTOGRAPH CAN BE LOOKED AT, ON BOTH DOORS.
   *
   * *"Can I have a click enlarge the photo and another click un-enlarge it?
   * I'm generally going through these photos trying to decide if I want them
   * on the gallery or showcase and sometimes they're not big enough."* Post
   * gig brought no opener at all, so on the door whose subject is EVIDENCE the
   * pictures could not be enlarged — and neither `npm test` nor any other
   * guard asks whether a tile opens.
   */
  for (const [door, where] of [['community', 'community'], ['post gig', 'post']]) {
    await page.goto(`${base}/console?door=${where}`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    if (where === 'community') {
      await page.evaluate(() => document.querySelector('button.tab[data-tab="photos"]')?.click());
      await page.waitForTimeout(1500);
    }
    // A PRESS ON AN OPEN HEADING FOLDS IT — what is remembered wins — so the
    // group is only opened when its night is not already showing.
    const row = page.locator('.bay-rail .bay-pick').filter({ hasNotText: 'The wall' }).first();
    if (!(await row.count())) {
      await page.locator('.bay-rail .bay-rail-group').first().click().catch(() => {});
      await page.waitForTimeout(700);
    }
    if (!(await row.count())) { check(`${door}: the night is in the rail`, false); continue; }
    await row.click();
    await page.waitForTimeout(2500);
    const tile = page.locator('.doorhead .cphoto').first();
    if (!(await tile.count())) { check(`${door}: the night's photographs are in the bay`, false); continue; }
    await tile.click();
    await page.waitForTimeout(700);
    const open = await page.locator('.community-big').count();
    check(`${door}: clicking a photograph enlarges it`, open === 1, `${open} overlays`);
    if (open) await shoot(`enlarged-${where}.png`, '.bay-side');
    // AND THE SAME PRESS AGAIN PUTS IT BACK — half of what was asked for, and
    // the half an overlay with no way out would fail.
    await page.locator('.community-big').click();
    await page.waitForTimeout(500);
    const shut = await page.locator('.community-big').count();
    check(`  ...and clicking it again puts it back`, shut === 0, `${shut} overlays`);
  }

  /*
   * AND THE REPOSITORY IS WHAT SETTLES IT. A grid that dropped three tiles
   * without the bytes leaving is exactly the control-reports-success fault
   * this guard exists for, and the next reload would bring them all back.
   */
  const left = readdirSync(dir).filter((n) => /\.(jpg|png|webp)$/i.test(n)).sort();
  check('the private repo kept the two green ones and nothing else', left.join(',') === GREEN.join(','), left.join(',') || '(empty)');
  await shoot('controls-after.png', '.photo-night-controls');
  console.log(`Screenshots in ${shots}`);
  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally {
  await browser?.close().catch(() => {});
  server.kill();
}
console.log(fails ? `${fails} FAILED` : 'all clear');
process.exit(fails ? 1 : 0);
