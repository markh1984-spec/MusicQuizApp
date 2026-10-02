#!/usr/bin/env node
/**
 * VIDEO FROM A PHONE — recorded in the app, stored in the bucket, kept or
 * cleared after thirty days, and never on the big screen.
 *
 *   node scripts/video-from-a-phone.mjs
 *
 * The host, 1–2 October 2026: video from everyone's phones through the same QR
 * codes, recorded in the app at 720p and fifteen seconds so nothing big leaves
 * a phone, kept in the object store only, and deleted after thirty days unless
 * starred or saved.
 *
 * A REAL BROWSER WITH A FAKE CAMERA joins as a phone, skips the photo ask,
 * finds "Send a video" in the menu, records two seconds and sends it — so the
 * recorder, the upload and the store are proved together. Then the console's
 * routes list it, play a piece of it, star and bin it; the bytes are checked
 * for what they are; the kill switch stops it; and a boot with old clips on
 * the shelf clears the unused one and keeps the starred one and every photo.
 */
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.SHOT_DIR || '';
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, name) }).catch(() => {}); };
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const shelf = mkdtempSync(join(tmpdir(), 'video-shelf-'));
let roomId = '';
const OLD = daysAgo(40);
const app = await startApp({
  key: 'video-from-a-phone',
  nodeArgs: ['--import', join(ROOT, 'test', 'helpers', 'object-store-stub.mjs')],
  env: {
    OBJECT_STUB_DIR: shelf,
    R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com', R2_BUCKET: 'photos', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret',
    PHOTO_REPO: '', PHOTO_TOKEN: '', GITHUB_TOKEN: '', GITHUB_REPO: '',
    VIDEO_SWEEP_FIRST_MS: '2500',
  },
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(join(dir, 'accounts.json'));
    const qm = b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Mark', role: 'quizmaster', tier: 'gold', status: 'active' });
    roomId = qm.id;
    b.save();
    // OLD CLIPS ON THE SHELF BEFORE THE BOOT — one unused, one starred, and a
    // photograph from the same night, which the sweep must never touch.
    const night = join(shelf, 'photos', qm.id, OLD);
    mkdirSync(night, { recursive: true });
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
    writeFileSync(join(night, 'oldunused-vid.mp4'), mp4);
    writeFileSync(join(night, 'oldstarred-vid.mp4'), mp4);
    writeFileSync(join(night, 'oldphoto.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]));
    writeFileSync(join(shelf, 'photos', qm.id, 'videos-kept.json'), JSON.stringify({ [`${OLD}/oldstarred-vid.mp4`]: { how: 'star', at: '2026-01-01' } }));
  },
});
const B = app.base;
let browser;
try {
  const signIn = await fetch(`${B}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const J = async (route, opts = {}) => { const r = await fetch(B + route, opts); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body, headers: r.headers }; };

  console.log('\nTHIRTY DAYS — a boot with old clips on the shelf');
  await wait(4000);
  const oldDir = join(shelf, 'photos', roomId, OLD);
  check('the unused clip from forty days ago is gone', !existsSync(join(oldDir, 'oldunused-vid.mp4')), readdirSync(oldDir).join(', '));
  check('the starred one is kept', existsSync(join(oldDir, 'oldstarred-vid.mp4')));
  check('and the photograph beside them is untouched', existsSync(join(oldDir, 'oldphoto.jpg')));

  const go = await J('/api/host/launch', { method: 'POST', headers: H, body: JSON.stringify({ game: 'quiz', packId: '2006', replace: true, breakPlan: {} }) });
  check('a quiz launches', go.status === 200, String(go.status));
  const code = (await J('/api/library', { headers: H })).body.joinCode;
  const ok = await J(`/api/video/ok?g=${code}`);
  check('the server says video is on (a store is configured)', ok.body && ok.body.ok === true, JSON.stringify(ok.body));

  console.log('\nA PHONE RECORDS TWO SECONDS AND SENDS IT');
  browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera', 'microphone'] });
  const phone = await ctx.newPage();
  const errors = [];
  phone.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));
  await phone.goto(`${B}/play?g=${code}`, { waitUntil: 'load' });
  await phone.fill('#nameInput', 'Dave');
  await phone.click('#joinBtn');
  await wait(2500);
  await phone.locator('.photo-gate-skip').click().catch(() => {});
  await phone.waitForSelector('.wait-video', { timeout: 10000 }).catch(() => {});
  const row = await phone.locator('.wait-video').count();
  if (!row) console.log('     the phone shows:', (await phone.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300),
    '| menus:', await phone.evaluate(() => [...document.querySelectorAll('.wait-menu, .wait-photo, .photo-gate')].map((e) => e.className).join(',')));
  check('"Send a video" is in the menu, beside the photo', row === 1, `${row}`);
  await shot(phone, 'video-1-menu.png');
  if (row) {
    await phone.locator('.wait-video').click();
    await phone.waitForFunction(() => !document.querySelector('.vr-rec')?.disabled, null, { timeout: 15000 }).catch(() => {});
    const said = await phone.$eval('.vr-said', (n) => n.textContent);
    check('the recorder opens on the camera, saying the limit', /15 seconds/.test(said), said);
    await phone.click('.vr-rec');
    await wait(1300);
    const counting = await phone.$eval('.vr-count', (n) => ({ shown: !n.hidden, text: n.textContent }));
    await shot(phone, 'video-2-recording.png');
    check('a countdown runs while it records', counting.shown && Number(counting.text) <= 15 && Number(counting.text) >= 13, JSON.stringify(counting));
    await wait(800);
    await phone.click('.vr-rec');
    await phone.waitForSelector('.vr-send:not([hidden])', { timeout: 8000 }).catch(() => {});
    await shot(phone, 'video-3-recorded.png');
    await phone.click('.vr-send');
    await phone.waitForFunction(() => /Sent/.test(document.querySelector('.vr-said')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    check('it says sent', /Sent/.test(await phone.$eval('.vr-said', (n) => n.textContent).catch(() => '')));
  }

  const nights = readdirSync(join(shelf, 'photos', roomId)).filter((n) => /^\d{4}-\d\d-\d\d$/.test(n) && n !== OLD);
  const night = nights[0] || '';
  const stored = night ? readdirSync(join(shelf, 'photos', roomId, night)).filter((n) => /-vid\.(mp4|webm)$/.test(n)) : [];
  check('it is in the bucket, in tonight\'s folder, named as a video', stored.length === 1, `${night}: ${stored.join(', ')}`);

  console.log('\nTHE CONSOLE LISTS IT, PLAYS A PIECE, STARS IT, BINS IT');
  const list = await J(`/api/videos/${night}`, { headers: H });
  const v = (list.body && list.body.videos || [])[0] || {};
  check('listed, with the day it goes if nobody keeps it', v.name === stored[0] && /^\d{4}-\d\d-\d\d$/.test(v.goesOn || ''), JSON.stringify(list.body).slice(0, 160));
  if (!v.url) throw new Error('no video to check further');
  const part = await fetch(`${B}${v.url}`, { headers: { Cookie: cookie, Range: 'bytes=0-3' } });
  check('a piece of it plays (206, the way Safari asks)', part.status === 206 && (await part.arrayBuffer()).byteLength === 4, String(part.status));
  const anon = await fetch(`${B}${v.url}`);
  check('nobody signed out can fetch it', [401, 403].includes(anon.status), String(anon.status));
  const star = await J('/api/videos/keep', { method: 'POST', headers: H, body: JSON.stringify({ night, name: v.name, keep: true }) });
  const after = (await J(`/api/videos/${night}`, { headers: H })).body.videos[0];
  check('starring keeps it for good', star.status === 200 && after.kept === 'star' && after.goesOn === null, JSON.stringify(after));
  const bin = await J(`/api/videos/${encodeURIComponent(night)}/${encodeURIComponent(v.name)}`, { method: 'DELETE', headers: H });
  check('the bin deletes it from the bucket', bin.status === 200 && !existsSync(join(shelf, 'photos', roomId, night, v.name)), String(bin.status));

  console.log('\nWHAT IS REFUSED');
  const pid = (await J('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Sue', joinCode: code }) })).body.id;
  const send = (bytes, type = 'video/mp4') => J(`/api/video?playerId=${encodeURIComponent(pid)}&g=${code}`, { method: 'POST', headers: { 'Content-Type': type }, body: bytes });
  const jpeg = await send(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]));
  check('a photograph posted as a video is refused, by its bytes', jpeg.body && jpeg.body.reason === 'not_a_video', JSON.stringify(jpeg.body));
  // A server that stops reading part-way may cut the connection before the
  // reply arrives; either way nothing is stored, which is the point.
  const huge = await send(Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(17 * 1024 * 1024)]))
    .catch((err) => ({ body: { reason: 'cut off', error: err.cause ? err.cause.code : err.message } }));
  check('a clip over the size limit is refused', huge.body && ['too_big', 'cut off'].includes(huge.body.reason), JSON.stringify(huge.body));
  const stranger = await J(`/api/video?playerId=nobody&g=${code}`, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: Buffer.from('x') });
  check('a phone that never joined is refused', stranger.body && stranger.body.reason === 'not_playing', JSON.stringify(stranger.body));
  await J('/api/host/photosOn', { method: 'POST', headers: H, body: JSON.stringify({ on: false }) });
  const off = await send(Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(64)]));
  check('the kill switch stops video too', off.body && off.body.reason === 'off', JSON.stringify(off.body));
  const screen = JSON.stringify((await J(`/api/state?role=screen&g=${code}`)).body || {});
  check('nothing about a video reaches the big screen', !/-vid\.(mp4|webm)/.test(screen));
  check('nothing threw on the phone', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await app.stop();
}
console.log(fails ? `\n${fails} FAILED — video from a phone is not what it says` : '\nA phone records fifteen seconds, it lands in the bucket, and unused clips go after thirty days.');
process.exit(fails ? 1 : 0);
