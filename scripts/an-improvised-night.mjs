#!/usr/bin/env node
/**
 * AN IMPROVISED NIGHT — three separate launches off the bar, cleared and
 * rebuilt between each, and every photograph still in the one night's folder.
 *
 *   node scripts/an-improvised-night.mjs
 *
 * Asked on 30 September 2026: *"if tomorrow I decide to play a couple of games
 * of card bingo, then decide I can't be arsed with a quiz, do a music bingo,
 * then after all I want to do two quiz rounds — is the launch bar able to be
 * cleared and restarted indefinitely in a night? … and for all of the photos
 * to still land in the right place after."* `a-whole-night.mjs` plays ONE
 * launch with six parts; this is the other way a night is run — made up as it
 * goes, a Stop and a fresh Launch between each game.
 *
 * Card bingo (two rounds, New round between), then music bingo, then two quiz
 * rounds, all at one pub. Three phones over HTTP send a photograph in every
 * game; one REAL phone in a browser must come back by itself after every
 * relaunch without being asked its name again. Then Past gigs is asked what it
 * has: one night, three games, the pub, every photograph.
 */
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = playwright();
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The private photo repository is a folder behind a stubbed fetch, so every
// photograph is filed exactly as it would be live (`photo-repo-stub.mjs`).
const REPO = mkdtempSync(path.join(tmpdir(), 'improvised-repo-'));
const { base: B, stop } = await startApp({
  key: 'an-improvised-night',
  env: {
    GH_STUB_DIR: REPO,
    PHOTO_REPO: 'someone/photos',
    PHOTO_TOKEN: 'stub',
    NODE_OPTIONS: `--import ${path.join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs')}`,
  },
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});

let cookie = '';
const H = () => ({ 'content-type': 'application/json', cookie });
const J = async (route, opts = {}) => { const r = await fetch(B + route, opts); let body; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });
const hostView = async () => (await J('/api/state?role=host', { headers: H() })).body;
const running = async () => (await J('/api/library', { headers: H() })).body.running || {};

let browser;
try {
  const signIn = await fetch(`${B}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const mk = await J('/api/invoices/customers', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'The Crown' }) });
  const venue = (mk.body.customers || []).find((c) => c.name === 'The Crown');
  await J(`/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H(), body: JSON.stringify({ rewards: ['A pint', 'A half', 'Crisps'] }) });

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]);
  const bar = await ctx.newPage();
  const errors = [];
  bar.on('pageerror', (e) => errors.push(`console: ${String(e.message).slice(0, 120)}`));
  bar.on('dialog', (d) => d.accept().catch(() => {}));

  // A real JPEG, made by the browser, for the phones to send.
  await bar.goto(`${B}/console`, { waitUntil: 'load' });
  const jpeg = Buffer.from(await bar.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 800;
    const x = c.getContext('2d'); x.fillStyle = '#88a'; x.fillRect(0, 0, 600, 800);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }), 'base64');

  /** A fresh console with an empty bar at The Crown — the host's "clear it". */
  const freshBar = async () => {
    await bar.goto(`${B}/console`, { waitUntil: 'load' });
    await bar.waitForSelector('.pack-card', { timeout: 20000 });
    await wait(600);
    for (let i = 0; i < 24; i += 1) {
      const gone = await bar.evaluate(() => { const x = document.querySelector('.lb-tile.is-pack .lb-tile-off'); if (!x) return true; x.click(); return false; });
      if (gone) break;
      await wait(250);
    }
    await bar.evaluate(async () => {
      document.querySelector('.lb-where')?.click();
      await new Promise((r) => setTimeout(r, 400));
      [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes('The Crown'))?.click();
    });
    await wait(600);
  };
  const tab = async (id) => { await bar.evaluate((t) => document.querySelector(`[data-tab="${t}"]`)?.click(), id); await wait(700); };
  const tap = async (sel) => { await bar.evaluate((s) => document.querySelector(s)?.click(), sel); await wait(1300); };
  const launch = async () => {
    const sent = bar.waitForRequest((r) => /\/api\/host\/launch(Order)?$/.test(r.url()) && r.method() === 'POST', { timeout: 8000 }).then((r) => r.postDataJSON(), () => null);
    await bar.evaluate(() => document.querySelector('.lb-go')?.click());
    const body = await sent;
    await wait(1500);
    return body;
  };
  /** Stop the night on the console — the way back to an empty bar. */
  const stopNight = async () => {
    await bar.goto(`${B}/console`, { waitUntil: 'load' });
    await wait(2000);
    for (let i = 0; i < 3; i += 1) {
      const pressed = await bar.evaluate(() => { const b = [...document.querySelectorAll('button')].find((n) => /^(unlaunch|stop)$/i.test((n.textContent || '').trim())); if (!b) return false; b.click(); return true; });
      if (!pressed) break;
      await wait(1500);
    }
  };

  const code = (await running()).joinCode;
  check('the room has a join code, the same all night', Boolean(code), code);

  // THE REAL PHONE — joins once, and must never be asked its name again.
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => errors.push(`phone: ${String(e.message).slice(0, 120)}`));
  await phone.setViewportSize({ width: 390, height: 844 });
  const phoneShows = () => phone.evaluate(() => ({
    askingName: Boolean(document.getElementById('nameInput')?.getClientRects().length),
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 90),
  }));

  // THE HTTP PHONES — rejoin by name after each relaunch, as a reopened phone does.
  const join = async (name) => (await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) })).body;
  const sendPhoto = async (p) => (await fetch(`${B}/api/photo?playerId=${encodeURIComponent(p.id)}&g=${code}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg })).status;
  let sent = 0;
  const everyoneSendsOne = async (label) => {
    const statuses = [];
    for (const p of phones) statuses.push(await sendPhoto(p));
    sent += statuses.filter((s) => s === 200).length;
    check(`${label}: all three phones' photographs accepted`, statuses.every((s) => s === 200), statuses.join(','));
  };
  let phones = [];
  const phoneView = async (p) => (await J(`/api/state?role=player&playerId=${p.id}&token=${encodeURIComponent(p.token)}&g=${code}`)).body;
  const phoneDo = (action, p, extra = {}) => J(`/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code, ...extra }) });

  /** Call or draw until a card is full, press, approve. */
  const playCardRound = async (label, kind) => {
    const tracks = ((await hostView()).tracks || []).map((t) => t.id);
    await host('start');
    let won = null;
    for (let i = 0; i < 60 && !won; i += 1) {
      if (kind === 'bingo') await host('call', { trackId: tracks[i] }); else await host('draw');
      for (const p of phones) {
        const s = await phoneView(p);
        for (const sq of s.card || []) if (sq.called && !sq.marked) await phoneDo('mark', p, { index: sq.index, marked: true });
        if (((await phoneView(p)).you || {}).squaresAway === 0) {
          const c = await phoneDo('claim', p);
          if (c.status === 200 && (c.body || {}).pending && (await host('approveClaim', { playerId: p.id })).status === 200) { won = p; break; }
        }
      }
    }
    check(`${label}: won, pressed and approved`, Boolean(won), won ? won.name : 'nobody');
  };

  /* ------------------------------------------------ 1. CARD BINGO, TWO ROUNDS */
  console.log('\n1 · CARD BINGO, TWO ROUNDS');
  await freshBar();
  await tab('cards'); await tap('.pack-card[data-pack]');
  const b1 = await launch();
  check('Launch sends card bingo', b1 && (b1.game === 'cards' || (b1.segments || []).some((s) => s.kind === 'cards')), JSON.stringify(b1 || {}).slice(0, 80));
  await phone.goto(`${B}/play?g=${code}`, { waitUntil: 'domcontentloaded' });
  await phone.fill('#nameInput', 'The Real Phone');
  await phone.click('#joinBtn');
  await wait(800);
  phones = [await join('Ann'), await join('Ben'), await join('Cat')];
  await everyoneSendsOne('card bingo');
  await playCardRound('card bingo round one', 'cards');
  await host('newRound');
  await playCardRound('card bingo round two', 'cards');
  await host('finish');
  await wait(800);
  check('card bingo is finished', /finish/i.test((await hostView()).phase), (await hostView()).phase);

  /* ------------------------------------------------ 2. STOP, MUSIC BINGO */
  console.log('\n2 · CLEARED, THEN MUSIC BINGO');
  await stopNight();
  await freshBar();
  await tab('bingo'); await tap('.pack-card[data-pack="mbc-4"]');
  const b2 = await launch();
  check('Launch sends music bingo on the 3×3 default', b2 && b2.game === 'bingo' && b2.shape && b2.shape.rows === 3, JSON.stringify(b2 && b2.shape));
  await wait(3000);
  const p2 = await phoneShows();
  check('the real phone came back by itself, not asked its name', !p2.askingName, p2.text);
  phones = [await join('Ann'), await join('Ben'), await join('Cat')];
  await everyoneSendsOne('music bingo');
  await playCardRound('music bingo', 'bingo');
  await host('finish');
  await wait(800);

  /* ------------------------------------------------ 3. STOP, TWO QUIZ ROUNDS */
  console.log('\n3 · CLEARED, THEN TWO QUIZ ROUNDS');
  await stopNight();
  await freshBar();
  await tab('quiz');
  await tap('.pack-card[data-pack="2006"] .pack-rounds .lb-rd[data-round="0"]');
  await tap('.pack-card[data-pack="2006"] .pack-rounds .lb-rd[data-round="1"]');
  const b3 = await launch();
  const order = (b3 && b3.order) || ((b3 && b3.segments) || []).flatMap((s) => s.order || []);
  check('Launch sends the two quiz rounds', b3 && (b3.game === 'quiz' || (b3.segments || [])[0]?.kind === 'quiz') && (order.length === 2 || (!b3.order && b3.packId === '2006')), JSON.stringify(b3 || {}).slice(0, 120));
  await wait(3000);
  const p3 = await phoneShows();
  check('the real phone came back again, still not asked its name', !p3.askingName, p3.text);
  phones = [await join('Ann'), await join('Ben'), await join('Cat')];
  await everyoneSendsOne('the quiz');
  await host('start');
  let asked = 0;
  for (let i = 0; i < 200; i += 1) {
    const hv = await hostView();
    if (hv.phase === 'final') break;
    if (hv.phase === 'question' && !(hv.clock || {}).closed) {
      const right = hv.question.correctIndex ?? 0;
      for (const [n, p] of phones.entries()) await phoneDo('answer', p, { optionIndex: n === 1 && asked > 0 ? (right + 1) % 4 : right });
      asked += 1;
      await host('reveal');
    }
    await host('next');
  }
  check(`the quiz played ${asked} questions to its final scores`, asked > 0 && (await hostView()).phase === 'final', (await hostView()).phase);
  await wait(1500);

  /* ------------------------------------------------ WHAT PAST GIGS HAS */
  console.log('\nWHAT PAST GIGS HAS AFTERWARDS');
  const nights = (await J('/api/past-gigs', { headers: H() })).body.nights || [];
  const tonight = nights[0] || {};
  const kinds = (tonight.games || []).map((g) => g.kind);
  check('one night, not three', nights.length === 1, `${nights.length} nights`);
  check('three games filed in it — card bingo, music bingo, the quiz', (tonight.games || []).length === 3, JSON.stringify(kinds));
  check('filed under The Crown', tonight.venue === 'The Crown' && !tonight.venueMixed, `${tonight.venue} mixed=${tonight.venueMixed}`);
  const given = (tonight.games || []).reduce((n, g) => n + (Number(g.rewardsGiven) || 0), 0);
  check('the drinks are on the record — two card rounds, one music bingo, three quiz places', given === 6, `${given} codes`);
  let photos = [];
  for (let i = 0; i < 20; i += 1) {
    photos = ((await J(`/api/past-gigs/${tonight.night}`, { headers: H() })).body || {}).photos || [];
    if (photos.length >= sent) break;
    await wait(500);
  }
  check(`every photograph is in that night's folder (${sent} sent)`, photos.length === sent && sent === 9, `${photos.length} filed`);
  check('nothing threw on the console or the phone', errors.length === 0, errors.join(' | '));
} catch (err) {
  fails += 1;
  console.error('\nthe night fell over:', err.stack || err.message);
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — an improvised night does not hold together` : '\nAn improvised night holds together: three launches, one night, every photograph in its place.');
process.exit(fails ? 1 : 0);
