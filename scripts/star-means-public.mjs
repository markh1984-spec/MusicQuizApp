#!/usr/bin/env node
/**
 * A STAR MEANS PUBLIC, AND THE POST KIT UNDER IT — pressed with a real mouse.
 *
 * ---
 *
 * Reported off a live console: *"I just saw a photo that had a star on it but
 * with a red dot, which doesn't make any sense."* It did not. A star says
 * *this is one of the three the night leads with*; a red lamp says *this never
 * goes public*. Both were stored, both were drawn, and `coverPhotos()`
 * resolved the contradiction in silence by ignoring the star — a control
 * present, lit and inert, which is the one thing this app has a rule against.
 *
 * The rule is the SERVER'S (`gallery.js`), and `test/gallery-pins.test.js`
 * pins it there. What no unit test can see is the half that was reported: two
 * controls on one tile, each flipping optimistically and then settling against
 * a reply. **A test that the payload is right proves nothing about whether
 * anybody drew it** — so this presses both, in a browser, and reads the
 * classes off the screen:
 *
 *   - a photograph the room sent starts RED with no star;
 *   - pressing its STAR turns the lamp green — on screen and on the server;
 *   - pressing the LAMP red again takes the star off — both halves;
 *   - and the pairing survives a reload, which is what says it was WRITTEN
 *     rather than merely painted.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort } from '../test/helpers/live-server.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const PW = 'a-long-enough-one-for-here';
const NIGHT = '2026-08-20';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? `  — ${detail}` : ''}`); };

const data = mkdtempSync(join(tmpdir(), 'star-'));
const repo = mkdtempSync(join(tmpdir(), 'star-gh-'));
const port = await freePort();
const env = { ...process.env, PORT: String(port), HOST_KEY: 'x', DATA_DIR: data, GH_STUB_DIR: repo, PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub' };
const base = `http://127.0.0.1:${port}`;
let server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
const up = async () => { for (let i = 0; i < 60; i += 1) { try { await fetch(base); return; } catch { await wait(200); } } throw new Error('no up'); };
const post = (p, b, c = '') => fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(c ? { Cookie: c } : {}) }, body: JSON.stringify(b) });
const get = (p, c = '') => fetch(`${base}${p}`, { headers: c ? { Cookie: c } : {} });

const browser = await chromium.launch();
console.log('\nA STAR MEANS PUBLIC, AND THE POST KIT UNDER IT\n');
try {
  await up();
  const made = await (await post('/api/signup', { email: 'qm@example.com', password: PW, name: 'Mark' })).json();
  const t = new URL(made.devLink).searchParams.get('t');
  await post('/api/reset/complete', { token: t, password: PW });
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'quizmaster'; acc.accounts[0].comped = true; acc.accounts[0].status = 'active';
  writeFileSync(file, JSON.stringify(acc));
  server.kill(); await wait(300);
  server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  await up();
  const signIn = await post('/api/sign-in', { email: 'qm@example.com', password: PW });
  const cookie = (signIn.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  const me = await (await get('/api/me', cookie)).json();
  const roomId = me.account.id;

  const arc = join(data, 'rooms', roomId, 'archive');
  mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({
    id: 'n1', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: 'The Station Tap, Wokingham',
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));
  /*
   * ONE PHOTOGRAPH, AND IT IS THE ROOM'S — `-picked` is the source marker, so
   * this one is RED by default and waiting for a human. That is the exact
   * tile the contradiction was seen on: a star could be put on it while the
   * lamp still said it would never show.
   */
  const dir = join(repo, 'photos', roomId, NIGHT);
  mkdirSync(dir, { recursive: true });
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
    + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
    + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
  writeFileSync(join(dir, 'r1-picked.jpg'), jpeg);

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.context().addCookies((signIn.headers.getSetCookie() || []).map((c) => {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    return { name: pair.slice(0, i), value: pair.slice(i + 1), domain: '127.0.0.1', path: '/' };
  }));
  await page.goto(`${base}/console?door=post&night=${NIGHT}`, { waitUntil: 'load' });

  const tile = '.cphoto.filed';
  await page.waitForSelector(tile, { timeout: 20_000 });
  const stateNow = () => page.evaluate(() => {
    const shot = document.querySelector('.cphoto.filed');
    return {
      starred: shot.querySelector('.cphoto-pin').classList.contains('is-on'),
      green: shot.querySelector('.cphoto-pub').classList.contains('is-on'),
    };
  });
  const onServer = async () => {
    const night = await (await get(`/api/past-gigs/${NIGHT}`, cookie)).json();
    const p = (night.photos || [])[0] || {};
    return { starred: Boolean(p.pinned), green: Boolean(p.onGallery) };
  };

  const start = await stateNow();
  check('the room\'s photograph starts red, with no star',
    start.starred === false && start.green === false, JSON.stringify(start));

  // ---- press the STAR
  await page.click(`${tile} .cphoto-pin`);
  const afterStar = await stateNow();
  check('STARRING IT TURNS THE LAMP GREEN ON SCREEN',
    afterStar.starred === true && afterStar.green === true, JSON.stringify(afterStar));
  // The write settles after a beat, then goes to the store.
  await wait(2500);
  const serverStar = await onServer();
  check('and the server agrees — starred AND public',
    serverStar.starred === true && serverStar.green === true, JSON.stringify(serverStar));

  // ---- press the LAMP back to red
  await page.click(`${tile} .cphoto-pub`);
  const afterHide = await stateNow();
  check('HIDING IT TAKES THE STAR OFF ON SCREEN',
    afterHide.starred === false && afterHide.green === false, JSON.stringify(afterHide));
  await wait(2500);
  const serverHide = await onServer();
  check('and the server agrees — neither starred nor public',
    serverHide.starred === false && serverHide.green === false, JSON.stringify(serverHide));

  // ---- and it was WRITTEN, not merely painted
  await page.goto(`${base}/console?door=post&night=${NIGHT}`, { waitUntil: 'load' });
  await page.waitForSelector(tile, { timeout: 20_000 });
  const reloaded = await stateNow();
  check('it survives a reload, so it was written rather than drawn',
    reloaded.starred === false && reloaded.green === false, JSON.stringify(reloaded));

  const shot = join(data, 'star-means-public.png');
  await page.locator(tile).screenshot({ path: shot });
  console.log(`\n  tile: ${shot}`);

  /*
   * ---- AND THE POST KIT UNDER IT ----------------------------------------
   *
   * The caption, the one press that readies a post, and the mark saying a
   * night has gone out. All three draw in the tab body under the photographs,
   * and a panel that draws perfectly and does nothing is this repo's
   * commonest fault — so the mark is PRESSED and the page reloaded.
   */
  await page.click(`${tile} .cphoto-pin`);   // star it so there IS a showcase
  await wait(2500);
  await page.goto(`${base}/console?door=post&night=${NIGHT}`, { waitUntil: 'load' });
  await page.waitForSelector('.insta-cap', { timeout: 20_000 });
  const cap = await page.evaluate(() => {
    const box = document.querySelector('.insta-cap');
    const btn = document.querySelector('.showcase-save');
    const done = document.querySelector('.insta-done');
    return {
      words: box ? box.value : '',
      save: btn ? btn.textContent.trim() : '',
      posted: done ? done.textContent.trim() : '',
      link: Boolean(document.querySelector('.insta-posted a[href*="instagram.com"]')),
    };
  });
  check('the caption is drafted off what the app already knows',
    /Station Tap/.test(cap.words) && /#pubquiz/.test(cap.words), JSON.stringify(cap.words));
  check('one press readies the whole post', /Copy the caption/.test(cap.save), cap.save);
  check('and there is a link to where you post it', cap.link);

  await page.click('.insta-done');
  await wait(2000);
  await page.goto(`${base}/console?door=post&night=${NIGHT}`, { waitUntil: 'load' });
  await page.waitForSelector('.insta-done', { timeout: 20_000 });
  const marked = await page.evaluate(() => {
    const done = document.querySelector('.insta-done');
    return { text: done.textContent.trim(), on: done.classList.contains('is-on') };
  });
  check('MARKED AS POSTED, AND IT SURVIVES A RELOAD',
    marked.on && /Posted/.test(marked.text), JSON.stringify(marked));

  const kit = join(data, 'post-kit.png');
  await page.locator('.photo-night-controls, .gig-photos').first().screenshot({ path: kit }).catch(async () => {
    await page.screenshot({ path: kit, fullPage: true });
  });
  console.log(`  kit:  ${kit}`);
} catch (err) {
  failures += 1;
  console.log('  FAIL threw:', err.stack || err.message);
} finally {
  await browser.close(); server.kill();
}
console.log(failures ? `\n${failures} FAILED\n` : '\nALL GOOD — a star means public, and the post kit drafts, presses and remembers.\n');
process.exit(failures ? 1 : 0);
