#!/usr/bin/env node
/**
 * A PHOTO SENT DURING A BINGO ROUND WAITS FOR THE WIN — and the phone can send
 * one at all.
 *
 * Asked on 8 October 2026: *"is it possible to let them upload photos during
 * the actual music bingo rounds?"* The answer turned out to be that it already
 * worked, and the claim made on the night that it did not was wrong. So this
 * proves it rather than leaving it to be re-asked:
 *
 * - the camera is on a bingo phone mid-round, on the screen and pressable;
 * - a photo sent then does NOT go over the song list while songs are called;
 * - it gets its moment in the middle of the projector the moment somebody wins.
 *
 *   node scripts/photos-at-the-win.mjs
 */
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const KEY = 'photos-at-the-win';
const A_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7)]);
let fails = 0;
const check = (name, ok, note = '') => {
  if (!ok) fails += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${note ? `  — ${note}` : ''}`);
};

const { base: B, stop } = await startApp({ key: KEY });
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (route, opts = {}) => {
  const r = await fetch(B + route, opts);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const hv = async () => (await J(`/api/state?role=host&key=${KEY}`)).body;

console.log('\nA PHOTO SENT DURING A BINGO ROUND\n');
const browser = await playwright().chromium.launch();
try {
  const go = await host('launch', { game: 'bingo', packId: 'mbc-18', replace: true, prizes: 1, rewards: ['A pint'] });
  check('a music bingo night launches', go.status === 200, String(go.status));
  const j = (await J('/api/join', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Snappers', joinCode: '' }) })).body;
  await host('start');
  const tracks = (await hv()).tracks || [];
  await host('call', { trackId: tracks[0].id });

  const screen = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await screen.goto(`${B}/screen?key=${KEY}`, { waitUntil: 'load' });
  await screen.waitForTimeout(1500);

  // The phone, mid-round: is the camera there to press?
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((me) => localStorage.setItem('musicquiz.player', JSON.stringify(me)), { id: j.id, token: j.token, name: 'Snappers' });
  const phone = await ctx.newPage();
  await phone.goto(`${B}/play`, { waitUntil: 'load' });
  await phone.waitForTimeout(2000);
  const cam = await phone.evaluate(() => {
    const b = document.getElementById('cameraBtn');
    if (!b) return { there: false };
    const r = b.getBoundingClientRect();
    return { there: true, pressable: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b };
  });
  check('THE CAMERA IS ON A BINGO PHONE MID-ROUND, and can be pressed', cam.there && cam.pressable, JSON.stringify(cam));

  const sent = await J(`/api/photo?playerId=${j.id}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: A_JPEG });
  check('a photo sent mid-round is taken', sent.status === 200 && sent.body && sent.body.ok !== false, JSON.stringify(sent.body));
  await screen.waitForTimeout(2000);
  const during = await screen.evaluate(() => ({
    big: Boolean(document.getElementById('photoBig')),
    strip: Boolean(document.getElementById('photoStrip')),
  }));
  check('IT DOES NOT GO OVER THE SONG LIST while songs are being called', !during.big && !during.strip, JSON.stringify(during));

  // Somebody wins.
  const card = (await J(`/api/state?role=player&playerId=${j.id}`)).body.card || [];
  for (const [i, sq] of card.entries()) {
    const id = (tracks.find((t) => t.title === sq.title && t.artist === sq.artist) || {}).id;
    await host('call', { trackId: id });
    await J('/api/mark', { method: 'POST', headers: H, body: JSON.stringify({ playerId: j.id, token: j.token, index: i, marked: true, joinCode: '' }) });
  }
  await J('/api/claim', { method: 'POST', headers: H, body: JSON.stringify({ playerId: j.id, token: j.token, joinCode: '' }) });
  const paid = await host('approveClaim', { playerId: j.id });
  check('the card is paid', paid.status === 200, JSON.stringify(paid.body).slice(0, 80));
  let atWin = { big: false };
  for (let t = 0; t < 10 && !atWin.big; t += 1) {
    await screen.waitForTimeout(400);
    atWin = await screen.evaluate(() => ({
      big: Boolean(document.getElementById('photoBig')),
      caption: (document.querySelector('#photoBig figcaption') || {}).textContent || '',
    }));
  }
  check('IT GOES UP IN THE MIDDLE OF THE SCREEN WHEN SOMEBODY WINS', atWin.big && atWin.caption === 'Snappers', JSON.stringify(atWin));
} finally {
  await browser.close();
  stop();
}

console.log(fails ? `\n${fails} FAILED` : '\na photo sent during a bingo round goes up at the win');
process.exit(fails ? 1 : 0);
