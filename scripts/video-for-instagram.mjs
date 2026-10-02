#!/usr/bin/env node
/**
 * A VIDEO SAVED FOR INSTAGRAM — square and Story, with the frame recorded in,
 * from the host's console and from a pub's staff page.
 *
 *   node scripts/video-for-instagram.mjs
 *
 * The host, 1–2 October 2026: a downloaded video carries the watermark *"baked
 * in"*, in the two Instagram shapes, and a save is a USE that keeps the clip
 * from the thirty-day clear-out. The remaking is the browser's own
 * (`video-export.js`), so only a real browser can say it works: a clip is
 * MADE in one, filed under a night at the pub, then made into both shapes on
 * the console and the square on the staff page, and the files measured.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NIGHT = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const TAP = 'The Station Tap, Wokingham';
const PW = 'quizmaster passphrase';
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.SHOT_DIR || '';

const shelf = mkdtempSync(join(tmpdir(), 'vid-insta-'));
const app = await startApp({
  key: 'video-for-instagram',
  nodeArgs: ['--import', join(ROOT, 'test', 'helpers', 'object-store-stub.mjs')],
  env: {
    OBJECT_STUB_DIR: shelf,
    R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com', R2_BUCKET: 'photos', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret',
    PHOTO_REPO: '', PHOTO_TOKEN: '', GITHUB_TOKEN: '', GITHUB_REPO: '',
  },
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(join(dir, 'accounts.json'));
    const owner = b.create({ email: 'owner@example.com', password: PW, name: 'Mark', role: 'owner' });
    b.create({ email: 'qm@example.com', password: PW, name: 'Mark', role: 'quizmaster', tier: 'gold', comped: true, ownedBy: owner.id });
    b.save();
  },
});
const B = app.base;
let browser;
try {
  const signIn = await fetch(`${B}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: PW }) });
  const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const roomId = (await (await fetch(`${B}/api/me`, { headers: H })).json()).account.id;

  browser = await chromium.launch();
  // A TWO-SECOND CLIP WITH SOUND, MADE IN A BROWSER — so the remake is fed what
  // a phone really sends, not a hand-written header.
  const maker = await browser.newPage();
  await maker.goto(`${B}/`);
  const clip = await maker.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    const x = c.getContext('2d');
    const ac = new AudioContext();
    const osc = ac.createOscillator(); const dest = ac.createMediaStreamDestination(); osc.connect(dest); osc.start();
    const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const type = ['video/mp4', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, { mimeType: type });
    const parts = []; rec.ondataavailable = (e) => parts.push(e.data);
    let f = 0; const tick = setInterval(() => { x.fillStyle = `hsl(${(f++ * 9) % 360},80%,50%)`; x.fillRect(0, 0, 640, 360); }, 33);
    rec.start(200); await new Promise((r) => setTimeout(r, 2000)); rec.stop();
    await new Promise((r) => { rec.onstop = r; }); clearInterval(tick); osc.stop();
    const blob = new Blob(parts, { type: rec.mimeType });
    // After ';base64,' — the type itself can hold a comma ('codecs=avc1,mp4a').
    const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => { const s = String(fr.result); r(s.slice(s.indexOf(';base64,') + 8)); }; fr.readAsDataURL(blob); });
    return { b64, type: rec.mimeType.split(';')[0] };
  });
  await maker.close();
  const ext = clip.type === 'video/webm' ? 'webm' : 'mp4';
  const name = `clip1-vid.${ext}`;

  const mk = await (await fetch(`${B}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name: TAP }) })).json();
  const tap = (mk.customers || []).find((c) => c.name === TAP);
  await fetch(`${B}/api/invoices/customers/${encodeURIComponent(tap.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint'], usualNight: 'thu' }) });
  const arc = join(app.data, 'rooms', roomId, 'archive'); mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({ id: 'n1', kind: 'quiz', quizTitle: '2006', packId: '2006', archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: TAP, venueId: tap.id, leaderboard: [] }));
  const dir = join(shelf, 'photos', roomId, NIGHT); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), Buffer.from(clip.b64, 'base64'));
  writeFileSync(join(dir, 'h1abc.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]));
  if (!await app.restart({ hard: false })) throw new Error('the server did not come back');

  // Read a made video's own size and length back in the page.
  const measure = async (page, file) => page.evaluate(async ({ b64, type }) => {
    const v = document.createElement('video'); v.muted = true;
    v.src = `data:${type};base64,${b64}`;
    await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = j; });
    return { w: v.videoWidth, h: v.videoHeight };
  }, { b64: readFileSync(file).toString('base64'), type: file.endsWith('.webm') ? 'video/webm' : 'video/mp4' }).catch((e) => ({ error: String(e) }));

  const make = async (page, which) => {
    await page.locator(`.vp-big ${which} .vp-make`).click();
    await page.waitForFunction((w) => /^(Download|Share)$/.test(document.querySelector(`.vp-big ${w} .vp-make`)?.textContent.trim() || ''), which, { timeout: 30000 }).catch(() => {});
    const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.locator(`.vp-big ${which} .vp-make`).click();
    const got = await dl;
    if (!got) return null;
    const to = join(shelf, `out-${which.replace(/\W/g, '')}-${Date.now()}.${got.suggestedFilename().split('.').pop()}`);
    await got.saveAs(to);
    return { file: to, name: got.suggestedFilename() };
  };

  console.log('\nTHE CONSOLE — the night\'s video, under its photos');
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]);
  const con = await ctx.newPage();
  const errors = [];
  con.on('pageerror', (e) => errors.push(`console: ${String(e.message).slice(0, 140)}`));
  await con.goto(`${B}/console?door=post`, { waitUntil: 'load' });
  await wait(2000);
  const row = con.locator('.bay-rail .bay-pick').filter({ hasNotText: 'The wall' }).first();
  if (!(await row.count())) { await con.locator('.bay-rail .bay-rail-group').first().click().catch(() => {}); await wait(700); }
  await row.click();
  await con.waitForSelector('.cvideo', { timeout: 15000 }).catch(() => {});
  const tile = await con.$$eval('.cvideo', (ts) => ts.map((t) => t.textContent.replace(/\s+/g, ' ').trim()));
  check('the video is under the photos, saying when it goes', tile.length === 1 && /Goes on .+ unless kept/.test(tile[0]), JSON.stringify(tile));
  if (SHOTS) {
    await con.evaluate(() => document.querySelector('.cvideos')?.scrollIntoView({ block: 'center' }));
    await wait(300);
    await con.screenshot({ path: join(SHOTS, 'console-videos.png') });
  }
  await con.locator('.cvideo .cvideo-save').click();
  await wait(500);
  if (SHOTS) await con.screenshot({ path: join(SHOTS, 'console-video-sheet.png') });
  const sq = await make(con, '.vp-opt-square');
  const sqSize = sq ? await measure(con, sq.file) : null;
  check('the square is made and downloads, 1080 x 1080', sqSize && sqSize.w === 1080 && sqSize.h === 1080, `${sq && sq.name} ${JSON.stringify(sqSize)}`);
  const st = await make(con, '.vp-opt-story');
  const stSize = st ? await measure(con, st.file) : null;
  check('the Story is made and downloads, 1080 x 1920', stSize && stSize.w === 1080 && stSize.h === 1920, `${st && st.name} ${JSON.stringify(stSize)}`);
  if (SHOTS) await con.screenshot({ path: join(SHOTS, 'console-video-made.png') });
  await con.keyboard.press('Escape');
  await wait(800);
  const kept = await (await fetch(`${B}/api/videos/${NIGHT}`, { headers: H })).json();
  check('a save keeps it from the clear-out', kept.videos[0] && kept.videos[0].kept === 'saved' && kept.videos[0].goesOn === null, JSON.stringify(kept.videos[0]));

  console.log('\nA PUB\'S STAFF PAGE — the same video, saved square');
  await fetch(`${B}/api/videos/keep`, { method: 'POST', headers: H, body: JSON.stringify({ night: NIGHT, name, keep: false }) });
  await fetch(`${B}/api/venue-logins`, { method: 'POST', headers: H, body: JSON.stringify({ venueId: tap.id, username: 'Tabby', password: 'tabby test password' }) });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await phone.newPage();
  p.on('pageerror', (e) => errors.push(`staff: ${String(e.message).slice(0, 140)}`));
  await p.goto(`${B}/venue-photos`, { waitUntil: 'load' });
  await p.fill('input[name=username]', 'Tabby');
  await p.fill('input[name=password]', 'tabby test password');
  await p.click('.vp-form button');
  await p.waitForSelector('.cvideo', { timeout: 15000 }).catch(() => {});
  check('her night shows its video', await p.locator('.cvideo').count() === 1);
  if (SHOTS) await p.screenshot({ path: join(SHOTS, 'staff-videos.png'), fullPage: true });
  await p.locator('.cvideo .gal-save').click();
  await wait(400);
  const label = await p.$eval('.vp-big .vp-opt-square .vp-make', (b) => b.textContent.trim());
  check('it opens into the two shapes, each to make', label === 'Make it', label);
  const ssq = await make(p, '.vp-opt-square');
  const ssqSize = ssq ? await measure(p, ssq.file) : null;
  check('she makes the square and downloads it', ssqSize && ssqSize.w === 1080 && ssqSize.h === 1080, JSON.stringify(ssqSize));
  await wait(800);
  const kept2 = await (await fetch(`${B}/api/videos/${NIGHT}`, { headers: H })).json();
  check('her save keeps it too', kept2.videos[0] && kept2.videos[0].kept === 'saved', JSON.stringify(kept2.videos[0]));
  check('the original is still on the shelf, untouched', readdirSync(join(shelf, 'photos', roomId, NIGHT)).includes(name));
  check('nothing threw', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await app.stop();
}
console.log(fails ? `\n${fails} FAILED — a video saved for Instagram is not what it says` : '\nA video is remade square and Story with the frame in it, from the console and the staff page, and a save keeps it.');
process.exit(fails ? 1 : 0);
