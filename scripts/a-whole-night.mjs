#!/usr/bin/env node
/**
 * A WHOLE NIGHT, END TO END — two quiz rounds, two music bingo rounds and two
 * card bingo rounds, built on the real launch bar and played by three phones.
 *
 *   node scripts/a-whole-night.mjs            # add --shots DIR for the projector
 *
 * Asked for on 29 September 2026: *"run a game from end to end, it has to
 * include 2 quiz rounds, 2 music bingo rounds and 2 card bingo rounds."* The
 * night is interleaved — quiz, music bingo, cards, quiz, music bingo, cards —
 * because that is the order that exercises every boundary: the running score
 * carried across two bingo interludes, the quiz paying ONCE at its last round,
 * each bingo paying its own, and a deck on either side of a quiz. Music bingo
 * is played on 3×3 cards, one prize (a full house), chosen on the bar the way
 * a host would.
 */
import path from 'node:path';
import fs from 'node:fs';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : ''; })();
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: B, stop } = await startApp({
  key: 'a-whole-night',
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
const phoneView = async (p, code) => (await J(`/api/state?role=player&playerId=${p.id}&token=${encodeURIComponent(p.token)}&g=${code}`)).body;
const phoneDo = (action, p, code, extra = {}) => J(`/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code, ...extra }) });
const running = async () => (await J('/api/library', { headers: H() })).body.running || {};
const all = (hv) => Object.values((hv && hv.vouchers) || {});

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
  await bar.goto(`${B}/console`, { waitUntil: 'load' });
  await bar.waitForSelector('.pack-card', { timeout: 20000 });
  await bar.evaluate(async () => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes('The Crown'))?.click();
  });
  await wait(500);

  console.log('\nBUILDING THE NIGHT ON THE LAUNCH BAR — quiz, music bingo, cards, quiz, music bingo, cards');
  const tab = async (id) => { await bar.evaluate((t) => document.querySelector(`[data-tab="${t}"]`)?.click(), id); await wait(700); };
  const tap = async (sel) => { await bar.evaluate((s) => document.querySelector(s)?.click(), sel); await wait(1200); };
  await tab('quiz'); await tap('.pack-card[data-pack="2006"] .pack-rounds .lb-rd[data-round="0"]');
  await tab('bingo'); await tap('.pack-card[data-pack="mbc-4a"]');
  await tab('cards'); await tap('.pack-card[data-pack]');
  await tab('quiz'); await tap('.pack-card[data-pack="2006"] .pack-rounds .lb-rd[data-round="1"]');
  await tab('bingo'); await tap('.pack-card[data-pack="mbc-5a"]');
  await tab('cards'); await tap('.pack-card[data-pack]');
  const row = await bar.evaluate(() => [...document.querySelectorAll('.lb-tiles .lb-tile.is-pack')].map((t) => (t.getAttribute('title') || '').slice(0, 40)));
  check('six tiles, in the order they were added', row.length === 6, JSON.stringify(row));

  // Each music bingo tile on a 3×3 card — picked, then chosen on the Card
  // picker, as a host would. The Bingo prizes picker follows the shape.
  for (const at of [1, 4]) {
    await bar.evaluate((i) => document.querySelectorAll('.lb-tiles .lb-tile.is-pack')[i]?.click(), at);
    await wait(500);
    await bar.evaluate(() => {
      const s = document.querySelector('.lb-set-card select');
      const opt = [...s.options].find((o) => /"rows":3,"cols":3/.test(o.value));
      s.value = opt.value;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await wait(700);
  }
  const prizeFace = await bar.evaluate(() => { const s = document.querySelector('.lb-set-prizes select'); return s ? s.options[s.selectedIndex]?.text : ''; });
  check('a 3×3 music bingo card offers one prize by default', /^1\b/.test(prizeFace || ''), prizeFace);
  if (SHOTS) await (await bar.$('.launchbar')).screenshot({ path: `${SHOTS}/1-the-bar.png` });

  const sent = bar.waitForRequest((r) => /\/api\/host\/launch(Order)?$/.test(r.url()) && r.method() === 'POST', { timeout: 8000 }).then((r) => r.postDataJSON(), () => null);
  await bar.evaluate(() => document.querySelector('.lb-go')?.click());
  const body = await sent;
  const segs = (body && body.segments) || [];
  check('Launch sends a six-part running order', segs.length === 6 && segs.map((s) => s.kind).join(',') === 'quiz,bingo,cards,quiz,bingo,cards', JSON.stringify(segs.map((s) => s.kind)));
  check('both music bingo parts are 3×3', [1, 4].every((i) => segs[i] && segs[i].shape && segs[i].shape.rows === 3 && segs[i].shape.cols === 3), JSON.stringify([segs[1] && segs[1].shape, segs[4] && segs[4].shape]));
  await wait(1500);

  const code = (await running()).joinCode;
  const join = async (name) => (await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) })).body;
  const phones = [await join('Ann'), await join('Ben'), await join('Cat')];
  check('three phones in the room', phones.every((p) => p && p.id && p.token), JSON.stringify(phones.map((p) => p && p.id)));

  const wall = await ctx.newPage();
  wall.on('pageerror', (e) => errors.push(`projector: ${String(e.message).slice(0, 120)}`));
  await wall.setViewportSize({ width: 1280, height: 720 });
  await wall.goto(`${B}/screen?g=${encodeURIComponent(code)}`, { waitUntil: 'load' });
  await wait(1200);
  const shoot = async (name) => { if (SHOTS) { await wait(900); await wall.screenshot({ path: `${SHOTS}/${name}.png` }); } };
  await shoot('2-lobby');

  /** A quiz stretch: Ann always right and first, Cat right, Ben right on the
      first question only — so all three score and the podium has three. */
  const playQuiz = async (label, shotName) => {
    await host('start');
    let asked = 0;
    for (let i = 0; i < 120; i += 1) {
      const hv = await hostView();
      if (hv.phase === 'question' && !hv.clock?.closed) {
        const right = hv.question.correctIndex ?? 0;
        const wrong = (right + 1) % Math.max(2, (hv.question.options || []).length || 4);
        await phoneDo('answer', phones[0], code, { optionIndex: right });
        await phoneDo('answer', phones[2], code, { optionIndex: right });
        await phoneDo('answer', phones[1], code, { optionIndex: asked === 0 ? right : wrong });
        if (asked === 0) await shoot(shotName);
        asked += 1;
        await host('reveal');
      }
      if (hv.phase === 'round_board' || hv.phase === 'final') break;
      await host('next');
    }
    const hv = await hostView();
    check(`${label}: played ${asked} questions to its round board`, asked > 0 && hv.phase === 'round_board', `${asked} asked, at ${hv.phase}`);
    return hv;
  };

  /** A bingo or card round: call until somebody's card is full, they press, the host approves. */
  const playCard = async (label, kind, shotName) => {
    const hv0 = await hostView();
    // THE PHONE'S OWN CARD, not a field on the host's view: nine squares.
    if (kind === 'bingo') { const n = ((await phoneView(phones[0], code)).card || []).length; check(`${label}: every phone holds a 3×3 card`, n === 9, `${n} squares`); }
    await host('start');
    let won = null;
    const tracks = (hv0.tracks || []).map((t) => t.id);
    for (let i = 0; i < 60 && !won; i += 1) {
      if (kind === 'bingo') await host('call', { trackId: tracks[i] }); else await host('draw');
      if (i === 2) await shoot(shotName);
      for (const p of phones) {
        const s = await phoneView(p, code);
        for (const sq of s.card || []) if (sq.called && !sq.marked) await phoneDo('mark', p, code, { index: sq.index, marked: true });
        const s2 = await phoneView(p, code);
        if ((s2.you || {}).squaresAway === 0) {
          const c = await phoneDo('claim', p, code);
          if (c.status === 200 && (c.body || {}).pending) {
            const a = await host('approveClaim', { playerId: p.id });
            if (a.status === 200) { won = p; break; }
          }
        }
      }
    }
    check(`${label}: somebody won it and the host approved the press`, Boolean(won), won ? won.name : 'nobody');
    const hv = await hostView();
    const mine = all(hv).filter((v) => !v.carried);
    check(`${label}: ONE prize paid`, mine.length === 1, JSON.stringify(mine.map((v) => [v.name, v.reward])));
    return hv;
  };

  console.log('\nPART 1 — QUIZ ROUND ONE');
  await playQuiz('quiz round one', '3-quiz-question');
  const annAfter1 = (await phoneView(phones[0], code)).you?.score ?? 0;
  check('Ann has a score after round one', annAfter1 > 0, String(annAfter1));
  await host('advanceOrder');

  console.log('\nPART 2 — MUSIC BINGO ROUND ONE (3×3)');
  check('the quiz paid nothing at the break', all(await hostView()).length === 0);
  await playCard('music bingo one', 'bingo', '4-music-bingo');
  await host('advanceOrder');

  console.log('\nPART 3 — CARD BINGO ROUND ONE');
  check('the room is on card bingo', (await running()).game === 'cards', (await running()).game);
  await playCard('card bingo one', 'cards', '5-card-bingo');
  await host('advanceOrder');

  console.log('\nPART 4 — QUIZ ROUND TWO');
  const annBack = (await phoneView(phones[0], code)).you?.score ?? 0;
  check('Ann\'s score came back across both bingo parts', annBack === annAfter1, `${annAfter1} -> ${annBack}`);
  const before4 = all(await hostView()).length;
  await playQuiz('quiz round two', '6-quiz-two');
  await host('advanceOrder');
  // The quiz's last round has ended, so it pays now — once, on the total.
  const quizCodes = all(await hostView()).length - before4;
  check('the quiz paid its three places once, at its last round', quizCodes === 3, `${quizCodes} codes`);

  console.log('\nPART 5 — MUSIC BINGO ROUND TWO (3×3)');
  await playCard('music bingo two', 'bingo', '7-music-bingo-two');
  await host('advanceOrder');

  console.log('\nPART 6 — CARD BINGO ROUND TWO, AND THE END OF THE NIGHT');
  await playCard('card bingo two', 'cards', '8-card-bingo-two');
  await host('finish');
  await wait(800);
  const end = await hostView();
  await shoot('9-the-end');
  check('the night is finished', /finish|final|over/i.test(end.phase), end.phase);
  const every = all(end);
  console.log(`    every code the night paid: ${every.map((v) => `${v.name}: ${v.reward}`).join(' · ')}`);
  check('seven codes in all — three for the quiz, one for each bingo and deck round', every.length === 7, String(every.length));

  const ann = await phoneView(phones[0], code);
  check('Ann\'s phone holds every drink she won', (ann.vouchers || []).length === every.filter((v) => v.winnerId === phones[0].id).length, `${(ann.vouchers || []).length} on the phone`);
  const filed = ((await J('/api/past-gigs', { headers: H() })).body.nights || [])[0] || {};
  check('the evening is filed as one night at The Crown', /crown/i.test(JSON.stringify(filed)), JSON.stringify(filed).slice(0, 160));
  if (process.argv.includes('--filed')) console.log(JSON.stringify(filed, null, 1));
  check('nothing threw on the console or the projector', errors.length === 0, errors.join(' | '));
} catch (err) {
  fails += 1;
  console.error('\nthe night fell over:', err.stack || err.message);
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the night did not run end to end` : '\nA whole night ran end to end: two quiz rounds, two music bingo rounds, two card bingo rounds.');
process.exit(fails ? 1 : 0);
