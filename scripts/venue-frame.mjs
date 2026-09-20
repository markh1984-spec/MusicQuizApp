#!/usr/bin/env node
/**
 * DOES THE VENUE FRAME REPLACE THE APP MARK, RATHER THAN SIT UNDER IT?
 *
 * Reported off a real export: the app's own "Mark (quizmaster)" watermark was
 * stamping on top of the venue's designed frame, over the venue logo — two
 * logos saying the same thing, which is exactly the compositing TODO item 0
 * decided against (Pub Champions and the venue logo go INSIDE the frame). So
 * when a frame draws, that IS the branding and the app mark is suppressed; the
 * mark stays only as the FALLBACK, on a pub with no frame and on the public
 * gallery, which never had one.
 *
 * `photo-save.js` draws both from one canvas, so the only honest proof is in
 * the exported BYTES. This composes the same photograph twice — with a frame
 * and without — and samples the bottom-right corner, where the app mark's mic
 * sits in the account's saturated `--hot` colour. With a frame that colour
 * must be ABSENT (the mark was not drawn); without one it must be PRESENT.
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
const VENUE = 'The Station Tap, Wokingham';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? `  — ${detail}` : ''}`); };

const data = mkdtempSync(join(tmpdir(), 'vframe-'));
const repo = mkdtempSync(join(tmpdir(), 'vframe-gh-'));
const port = await freePort();
const env = { ...process.env, PORT: String(port), HOST_KEY: 'x', DATA_DIR: data, GH_STUB_DIR: repo, PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub' };
const base = `http://127.0.0.1:${port}`;
let server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
const up = async () => { for (let i = 0; i < 60; i += 1) { try { await fetch(base); return; } catch { await wait(200); } } throw new Error('no up'); };
const post = (p, b, c = '') => fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(c ? { Cookie: c } : {}) }, body: JSON.stringify(b) });
const get = (p, c = '') => fetch(`${base}${p}`, { headers: c ? { Cookie: c } : {} });
const put = (p, b, c) => fetch(`${base}${p}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify(b) });

const browser = await chromium.launch();
console.log('\nTHE VENUE FRAME — does it replace the app mark rather than sit under it?\n');
try {
  await up();
  const made = await (await post('/api/signup', { email: 'qm@example.com', password: PW, name: 'Mark' })).json();
  const t = new URL(made.devLink).searchParams.get('t'); await post('/api/reset/complete', { token: t, password: PW });
  const file = join(data, 'accounts.json'); const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'quizmaster'; acc.accounts[0].comped = true; acc.accounts[0].status = 'active'; writeFileSync(file, JSON.stringify(acc));
  server.kill(); await wait(300); server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' }); await up();
  const signIn = await post('/api/sign-in', { email: 'qm@example.com', password: PW });
  const cookie = (signIn.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  const me = await (await get('/api/me', cookie)).json(); const roomId = me.account.id;

  const maker = await browser.newPage(); await maker.goto(`${base}/`);
  const { jpeg, overlay } = await maker.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 800; const x = c.getContext('2d');
    // a flat, unsaturated photograph, so the ONLY saturated thing that can be
    // in the corner is the app mark's mic — same reasoning as photo-to-socials
    x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, 800, 800);
    const jpeg = c.toDataURL('image/jpeg', 0.9).split(',')[1];
    // a frame whose bottom band is dark with WHITE text — deliberately NOT
    // saturated, so it can never be mistaken for the mark's --hot mic
    const o = document.createElement('canvas'); o.width = 1080; o.height = 1080; const ox = o.getContext('2d');
    ox.fillStyle = 'rgba(20,16,40,0.92)'; ox.fillRect(0, 980, 1080, 100);
    ox.fillStyle = '#ffffff'; ox.font = 'bold 34px sans-serif'; ox.textAlign = 'right'; ox.fillText('THE STATION TAP', 1050, 1042);
    return { jpeg, overlay: o.toDataURL('image/png') };
  });
  await maker.close();
  const bytes = Buffer.from(jpeg, 'base64');
  const mk = await (await post('/api/invoices/customers', { name: VENUE }, cookie)).json();
  const venue = (mk.customers || []).find((v) => v.name === VENUE);
  await put(`/api/invoices/customers/${venue.id}/rewards`, { overlay }, cookie);
  const dir = join(repo, 'photos', roomId, NIGHT); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'aaaa.jpg'), bytes);
  server.kill(); await wait(300); server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' }); await up();

  const page = await browser.newPage();
  const u = new URL(base);
  await page.context().addCookies((signIn.headers.getSetCookie() || []).map((c) => { const [n, ...v] = c.split(';')[0].split('='); return { name: n, value: v.join('='), domain: u.hostname, path: '/' }; }));
  await page.goto(`${base}/console`, { waitUntil: 'load' });

  // Compose both exports in the page (same code the console button runs), then
  // ask whether the bottom-right corner holds a saturated (mark) pixel.
  const result = await page.evaluate(async ({ url, overlay }) => {
    const mod = await import('/assets/photo-save.js');
    const cornerSaturated = async (ov) => {
      const blob = await mod.framedBlob(url, { words: 'Mark (quizmaster)', overlay: ov });
      const src = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      // scan the bottom-right corner for a strongly saturated pixel (the mic)
      let hit = false;
      const w = c.width; const h = c.height;
      // the whole bottom-right quadrant, every other pixel — the mic is small
      const band = x.getImageData(Math.floor(w / 2), Math.floor(h * 0.72), Math.ceil(w / 2), Math.floor(h * 0.28)).data;
      for (let i = 0; i < band.length && !hit; i += 8) {
        const r = band[i]; const gg = band[i + 1]; const b = band[i + 2];
        const mx = Math.max(r, gg, b); const mn = Math.min(r, gg, b);
        if (mx > 100 && mx - mn > 60) hit = true; // colourful, not grey/white/dark
      }
      return hit;
    };
    return { withFrame: await cornerSaturated(overlay), withoutFrame: await cornerSaturated('') };
  }, { url: `/past-photo/${NIGHT}/aaaa.jpg`, overlay });

  check('with NO frame, the app mark IS stamped (the fallback)', result.withoutFrame === true, 'the mic was not found — the fallback watermark is missing');
  check('with a venue frame, the app mark is NOT stamped', result.withFrame === false, 'the mic was found on top of the frame — the fix regressed');
} catch (err) {
  failures += 1;
  console.log('  FAIL threw:', err.stack || err.message);
} finally {
  await browser.close(); server.kill();
}
console.log(failures ? `\n${failures} FAILED\n` : '\nALL GOOD — the frame is the whole branding, the app mark is the fallback.\n');
process.exit(failures ? 1 : 0);
