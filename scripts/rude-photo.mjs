#!/usr/bin/env node
/**
 * DOES A RUDE PHOTO GET FLAGGED, AND DOES THE HOST SEE IT?
 *
 * The rude-photo check (`src/moderation.js`) scores a photograph when it is
 * filed and writes a flag beside the photos (`src/photo-flags.js`); the console
 * sorts the flagged ones to the front of the night's grid with a "Review" pill
 * (`console-gigs.js`), so a review of ninety becomes a look at the two worth
 * looking at. A check nobody drew is worse than none — *a test that the
 * payload is right proves nothing about whether anybody drew it* — so this
 * drives both halves for real:
 *
 *  LEG A — THE PIPELINE. The app runs with a stub standing in for Google
 *  Vision (the `VISION_URL` seam). A phone uploads two photographs; the stub
 *  flags the second and passes the first. The guard then reads `flags.json`
 *  off the private-repo stub and the `/api/past-gigs` payload, and asserts the
 *  rude one is flagged `adult` and the clean one is not — proving `fileAway`
 *  calls the scorer, the scorer writes the sidecar, and the route carries it.
 *
 *  LEG B — THE CONSOLE. A night is seeded with two filed photographs and a
 *  flag on one, opened in a real browser on Past gigs, and the guard asserts
 *  the flagged tile renders FIRST with the "Review" pill and the clean one
 *  without — proving the sort and the marker are drawn.
 *
 * Inert without a key is covered by `test/moderation.test.js`; this needs the
 * key set (to the stub), so it never touches Google.
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { freePort } from '../test/helpers/live-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const PASSWORD = 'a-long-enough-one-for-here';
const SEED_NIGHT = '2026-08-20';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && detail ? `  — ${detail}` : ''}`);
};

// ---- a stub Google Vision: flags the SECOND image it is shown, passes the first.
let visionCalls = 0;
const vision = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    visionCalls += 1;
    const rude = visionCalls >= 2; // first upload clean, second rude — deterministic, they are sequential
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      responses: [{
        safeSearchAnnotation: {
          adult: rude ? 'VERY_LIKELY' : 'VERY_UNLIKELY',
          racy: rude ? 'LIKELY' : 'UNLIKELY',
          violence: 'VERY_UNLIKELY', medical: 'VERY_UNLIKELY', spoof: 'VERY_UNLIKELY',
        },
      }],
    }));
  });
});
const visionPort = await freePort();
await new Promise((r) => vision.listen(visionPort, '127.0.0.1', r));

const data = mkdtempSync(join(tmpdir(), 'rude-'));
const repo = mkdtempSync(join(tmpdir(), 'rude-gh-'));
const port = await freePort();
const env = {
  ...process.env,
  PORT: String(port), HOST_KEY: 'not-used-here', DATA_DIR: data,
  GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub',
  GOOGLE_API_KEY: 'stub-key', VISION_URL: `http://127.0.0.1:${visionPort}`,
};
const base = `http://127.0.0.1:${port}`;
let server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
const up = async () => {
  for (let i = 0; i < 60; i += 1) { try { await fetch(base); return; } catch { await wait(200); } }
  throw new Error('the server never came up');
};
const post = (path, body, cookie = '', extra = {}) => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify(body),
});
const get = (path, cookie = '') => fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {} });

const browser = await chromium.launch();
console.log('\nTHE RUDE-PHOTO CHECK — does a flag get written, and does the host see it?\n');
try {
  await up();

  // ---- one plain quizmaster
  const made = await (await post('/api/signup', { email: 'qm@example.com', password: PASSWORD, name: 'Quizzy' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  await post('/api/reset/complete', { token, password: PASSWORD });
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'quizmaster'; acc.accounts[0].comped = true; acc.accounts[0].status = 'active';
  writeFileSync(file, JSON.stringify(acc));
  server.kill(); await wait(300);
  server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  await up();
  const signIn = await post('/api/sign-in', { email: 'qm@example.com', password: PASSWORD });
  const cookie = (signIn.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
  const me = await (await get('/api/me', cookie)).json();
  const roomId = me.account.id;

  /* ================= LEG A — the pipeline ================= */

  // a photograph the browser makes, so it is a real JPEG the pipeline files
  const maker = await browser.newPage();
  await maker.goto(`${base}/`);
  const jpegB64 = await maker.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 1000;
    const x = c.getContext('2d'); x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, 800, 1000);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  await maker.close();
  const jpeg = Buffer.from(jpegB64, 'base64');

  const lib = await (await get('/api/library', cookie)).json();
  const packId = (lib.games || []).flatMap((g) => g.packs || []).find((p) => p && p.id)?.id;
  await post('/api/host/launch', { game: 'quiz', packId }, cookie);
  const joinCode = ((await (await get('/api/library', cookie)).json()).running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';

  const upload = async (name) => {
    const who = await (await fetch(`${base}/api/join${g}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })).json();
    const r = await fetch(`${base}/api/photo?playerId=${encodeURIComponent(who.id)}${joinCode ? `&g=${joinCode}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg });
    return (await r.json());
  };
  // Sequential, so the Vision stub's counter is deterministic: first clean, second rude.
  const clean = await upload('Table One');
  check('the clean photo uploaded', clean.ok !== false, JSON.stringify(clean));
  await wait(400);
  const rude = await upload('Table Two');
  check('the rude photo uploaded', rude.ok !== false, JSON.stringify(rude));

  // wait for both to be filed and scored, then read the flag sidecar off the repo stub
  const flagsFile = join(repo, 'photos', roomId, 'flags.json');
  let flags = {};
  for (let i = 0; i < 40; i += 1) {
    await wait(300);
    if (existsSync(flagsFile)) { try { flags = JSON.parse(readFileSync(flagsFile, 'utf8')); } catch { flags = {}; } }
    if (Object.keys(flags).length) break;
  }
  const flagged = Object.entries(flags);
  check('exactly one photo was flagged in the sidecar', flagged.length === 1, JSON.stringify(flags));
  check('and it was flagged adult', flagged[0] && flagged[0][1] === 'adult', JSON.stringify(flags));
  check('the Vision stub was actually asked (both photos)', visionCalls >= 2, `${visionCalls} calls`);

  // the night is the one in the flag key; assert the past-gigs payload carries it
  const liveNight = flagged.length ? flagged[0][0].split('/')[0] : '';
  if (liveNight) {
    const payload = await (await get(`/api/past-gigs/${liveNight}`, cookie)).json();
    const rudeInPayload = (payload.photos || []).filter((p) => p.flagged === 'adult').length;
    const cleanInPayload = (payload.photos || []).filter((p) => !p.flagged).length;
    check('the route carries the flag to the console', rudeInPayload === 1 && cleanInPayload >= 1, JSON.stringify((payload.photos || []).map((p) => [p.name, p.flagged])));
  }

  /* ================= LEG B — the console draws it and sorts it ================= */

  // seed a separate night: two filed photos, a flag on the SECOND file, plus an
  // archive record so the night is a real gig row the console lists.
  const dir = join(repo, 'photos', roomId, SEED_NIGHT);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'aaaa.jpg'), jpeg);   // clean, sorts first by name
  writeFileSync(join(dir, 'zzzz.jpg'), jpeg);   // rude, sorts LAST by name — so the flag has to move it
  writeFileSync(join(repo, 'photos', roomId, 'flags.json'), JSON.stringify({
    ...flags, [`${SEED_NIGHT}/zzzz.jpg`]: 'adult',
  }, null, 2));
  const arc = join(data, 'rooms', roomId, 'archive');
  mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'seed.json'), JSON.stringify({
    id: 'seed', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${SEED_NIGHT}T21:30:00Z`), venue: 'The Station Tap, Wokingham',
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));

  // The server cached flags.json during Leg A (a 30s read cache), and the seed
  // above was written straight to the repo behind its back — so restart, and
  // the console reads the seeded flags fresh. A restart is what a deploy is
  // anyway; the archive and repo survive it.
  server.kill(); await wait(400);
  server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  await up();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = new URL(base);
  await page.context().addCookies((signIn.headers.getSetCookie() || []).map((c) => {
    const [n, ...v] = c.split(';')[0].split('=');
    return { name: n, value: v.join('='), domain: url.hostname, path: '/' };
  }));
  await page.goto(`${base}/console?door=post&night=${SEED_NIGHT}`, { waitUntil: 'load' });
  await page.waitForSelector('.cphoto', { timeout: 15000 }).catch(() => {});

  const tiles = await page.locator('.cphoto').count();
  check('the night draws its two photos', tiles === 2, `${tiles} tiles`);
  const firstIsFlagged = await page.evaluate(() => {
    const first = document.querySelector('.cphoto');
    return Boolean(first && first.classList.contains('flagged') && first.querySelector('.cphoto-flag'));
  });
  check('the flagged photo is FIRST, with the Review pill', firstIsFlagged);
  const pillText = await page.locator('.cphoto.flagged .cphoto-flag').first().textContent().catch(() => '');
  check('the pill says Review', (pillText || '').trim() === 'Review', pillText);
  const flaggedCount = await page.locator('.cphoto.flagged').count();
  check('only the rude one is flagged, not the clean one', flaggedCount === 1, `${flaggedCount} flagged`);

  // the marker must actually be on screen, not just in the DOM
  const reachable = await page.evaluate(() => {
    const el = document.querySelector('.cphoto.flagged .cphoto-flag');
    if (!el) return 'not drawn';
    const r = el.getBoundingClientRect();
    return (r.width && r.height) ? 'yes' : 'no size';
  });
  check('the Review pill has a size on screen', reachable === 'yes', reachable);

  const shot = process.env.RUDE_SHOT;
  if (shot && tiles) {
    await page.locator('.night-strip, .community-wall').first().screenshot({ path: shot }).catch(() => {});
    console.log(`  shot  ${shot}`);
  }
} catch (err) {
  failures += 1;
  console.log('  FAIL threw:', err.stack || err.message);
} finally {
  await browser.close();
  server.kill();
  vision.close();
}

console.log(failures ? `\n${failures} FAILED\n` : '\nALL GOOD — a rude photo is flagged, sorted to the front and marked.\n');
process.exit(failures ? 1 : 0);
