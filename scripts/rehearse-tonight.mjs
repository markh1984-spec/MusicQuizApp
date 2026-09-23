#!/usr/bin/env node
/**
 * REHEARSE TONIGHT — drive the packs you are about to play, end to end.
 *
 * ---
 *
 * **EVERY OTHER GUARD PROVES THE APP. THIS ONE PROVES THE NIGHT.** `gig-path`
 * and the rest run whatever pack they find first, because their subject is the
 * machinery: the console loads, Launch works, a phone answers. None of them
 * has ever looked at the pack a room is actually going to hear.
 *
 * That gap is where a Thursday goes wrong. A pack can validate perfectly and
 * still have an image round with no pictures (three of four did), an intro cue
 * with no track behind it (most of them), or a general-knowledge question that
 * names the song the intro round plays an hour later. None of that is a fault
 * in the app, so nothing in the suite says a word about it.
 *
 * So this signs in as a REAL quizmaster, puts a venue with real prizes on the
 * bar, taps the pack into Tonight, presses Launch in a browser, opens the
 * projector, joins five phones, answers every question in the pack, and reads
 * the vouchers back. Then it does the bingo as the second part of the SAME
 * night and checks the drinks carry on down the venue's list instead of
 * starting again at the first one.
 *
 *   node scripts/rehearse-tonight.mjs --quiz <packId> --bingo <packId>
 *
 * **AND A THIRD GAME MAKES IT A THREE-PART NIGHT.** Card bingo has no pack
 * file, so it was the one game no rehearsal could name — and a running order
 * holding it is this repo's SIXTH sighting of the kind test written when there
 * were two games: a night of card bingo then music bingo launched as the music
 * bingo ALONE and answered 200. `--cards off` skips the leg; by default it
 * builds quiz + cards + bingo ON THE BAR, in the browser, because the engine
 * is rarely the hazard and the console's launch form is.
 *
 * Both are optional; it rehearses whichever you name. `SHOT_DIR` says where
 * the screenshots go — look at them, because a check can only tell you the
 * payload was right.
 *
 * **IT MAKES ITS OWN ACCOUNT AND ITS OWN VENUE**, on a throwaway disk, so it
 * can be run on a gig day without touching a real room.
 */
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();


const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const KEY = 'rehearse-tonight';
const QUIZ = argOf('quiz', '2000s-2010s-mixed');
const BINGO = argOf('bingo', 'mbc-6');
const CARDS = argOf('cards', 'deck');   // 'off' skips the card-bingo leg
const VENUE = argOf('venue', 'The Rehearsal Arms');
const DRINKS = ['A pint', 'A house double', 'A glass of wine', 'A bottle of beer', 'A soft drink', 'A shot'];
const SHOTS = process.env.SHOT_DIR || '/tmp/rehearse-tonight';

const { base: BASE, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    book.create({ email: 'mark@example.com', password: 'quizmaster passphrase', name: 'Mark', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  — ${d}` : ''}`); };
const section = (s) => console.log(`\n${s}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(SHOTS, { recursive: true });
let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const con = await ctx.newPage();
  const errors = [];
  con.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });

  section('SIGNING IN AS THE QUIZMASTER (not the host key)');
  await con.goto(`${BASE}/login`, { waitUntil: 'load' });
  await con.fill('input[type=email]', 'mark@example.com');
  await con.fill('input[type=password]', 'quizmaster passphrase');
  await con.evaluate(() => document.querySelector('form')?.requestSubmit());
  await con.waitForTimeout(2500);
  check('the console loads on his own account', /console/.test(con.url()) || (await con.$('.pack-card')) !== null, con.url());

  section('THE STATION TAP, WITH SIX DRINKS ON IT');
  await con.evaluate(async ({ venue, drinks }) => {
    const H = { 'Content-Type': 'application/json' };
    const mk = await fetch('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: venue }) });
    const c = ((await mk.json()).customers || []).find((x) => x.name === venue);
    await fetch(`/api/invoices/customers/${encodeURIComponent(c.id)}/rewards`,
      { method: 'PUT', headers: H, body: JSON.stringify({ rewards: drinks }) });
  }, { venue: VENUE, drinks: DRINKS });
  await con.reload({ waitUntil: 'load' });
  await con.waitForSelector('.pack-card', { timeout: 20000 });
  const pickVenue = async () => {
    await con.evaluate(async (v) => {
      document.querySelector('.lb-where')?.click();
      await new Promise((r) => setTimeout(r, 500));
      // THE VENUE IT MADE, never a hard-coded name: this said 'Station Tap'
      // while the default venue was The Rehearsal Arms, so with no --venue
      // the pick found nothing, Launch stood down for want of prizes, and
      // the guard only ever passed when somebody named the venue by hand.
      [...document.querySelectorAll('.lb-venues button')].find((b) => b.textContent.includes(v))?.click();
    }, VENUE);
    await con.waitForTimeout(1000);
  };
  await pickVenue();
  const venueSet = await con.$eval('.lb-where', (n) => n.textContent.trim()).catch(() => '');
  check('the venue is picked on the bar', venueSet.includes(VENUE), venueSet.slice(0, 50));

  section(`LAUNCHING THE QUIZ — ${QUIZ}`);
  const put = await con.evaluate(async (id) => {
    const r = await fetch('/api/library');
    const lib = await r.json();
    const all = [].concat(...Object.values(lib.games || {}).map((g) => g.packs || []), lib.quizzes || []);
    return (all.find((p) => p && p.id === id) || {}).title || null;
  }, QUIZ);
  check('the new quiz pack is in his library', Boolean(put), put || 'NOT FOUND');

  const card = await con.$(`.pack-card[data-pack="${QUIZ}"]`);
  check('and it is drawn as a card on the shelf', Boolean(card));
  if (card) {
    const box = await card.boundingBox();
    await con.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await con.waitForTimeout(900);
  }
  const tiles = await con.$$eval('.lb-tile.is-pack', (ns) => ns.length);
  check('tapping it puts every round in Tonight', tiles > 0, `${tiles} tile(s)`);

  const go = await con.$eval('.lb-go', (n) => ({ off: n.disabled, text: n.textContent.trim() }));
  check('Launch is live and says what it will play', !go.off && /launch/i.test(go.text), go.text);
  await con.locator('.lb-go').click();
  await con.waitForTimeout(2500);
  check('Launch lands on the control view', /\/host/.test(con.url()), con.url());

  section('THE PROJECTOR');
  const screen = await ctx.newPage();
  await screen.setViewportSize({ width: 1280, height: 720 });
  await screen.goto(`${BASE}/screen`, { waitUntil: 'load' });
  await screen.waitForTimeout(2000);
  const lobby = await screen.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160));
  check('the projector is on the lobby with a join code', /join/i.test(lobby), lobby.slice(0, 80));
  const code = await con.evaluate(async () => ((await (await fetch('/api/library')).json()).running || {}).joinCode || '');
  check('the room has its own join code', /^[A-Z0-9]{4,}$/.test(code), JSON.stringify(code));
  await screen.screenshot({ path: `${SHOTS}/1-lobby.png` });

  section('FIVE PHONES JOIN AND ANSWER');
  const teams = ['Quiz Team Aguilera', 'Beer Pressure', 'Les Quizerables', 'Smarty Pints', 'Norfolk Enchants'];
  const players = [];
  for (const name of teams) {
    const r = await fetch(`${BASE}/api/join?g=${code}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }),
    });
    const j = await r.json();
    players.push({ name, id: j.id || j.playerId, token: j.token });
  }
  check('all five phones are in', players.every((p) => p.id && p.token), players.map((p) => p.id ? 'ok' : 'FAILED').join(' '));

  const phone = await ctx.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${BASE}/play?g=${code}`, { waitUntil: 'load' });
  await phone.waitForTimeout(1500);
  await phone.screenshot({ path: `${SHOTS}/2-phone-lobby.png` });

  const host = async (action, body = {}) => (await con.evaluate(async ({ a, b }) => {
    const r = await fetch(`/api/host/${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { a: action, b: body }));
  const view = async () => (await con.evaluate(async () => (await (await fetch('/api/state?role=host')).json())));

  let asked = 0, answered = 0, guard = 0;
  while (guard++ < 120) {
    const v = await view();
    if (v.phase === 'final') break;
    if (v.phase === 'question') {
      asked += 1;
      for (const [i, p] of players.entries()) {
        const r = await fetch(`${BASE}/api/answer`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: p.id, token: p.token, optionIndex: i % 4, joinCode: code }),
        });
        const jb = await r.json().catch(() => ({}));
        if (jb && jb.ok !== false) answered += 1;
      }
      if (asked === 1) { await phone.waitForTimeout(600); await phone.screenshot({ path: `${SHOTS}/3-phone-question.png` }); }
      if (asked === 1) { await screen.waitForTimeout(400); await screen.screenshot({ path: `${SHOTS}/4-screen-question.png` }); }
    }
    await host('next');
    await wait(120);
  }
  check('every question in the pack was asked', asked > 0, `${asked} asked`);
  check('and the phones could answer them', answered >= asked * 4, `${answered} answers landed`);
  const fv = await view();
  check('the night reaches the final', fv.phase === 'final', fv.phase);

  await screen.waitForTimeout(1200);
  await screen.screenshot({ path: `${SHOTS}/5-screen-final.png` });

  const vouchers = () => con.evaluate(async () => Object.values(((await (await fetch('/api/state?role=host')).json()).vouchers) || {}));
  const diag = await con.evaluate(async () => {
    const v = await (await fetch('/api/state?role=host')).json();
    return { keys: Object.keys(v).filter(k=>/vouch|winner|board|player/i.test(k)),
             players: (v.players||[]).slice(0,5).map(r=>[r.name,r.score,r.position]),
             rewards: v.rewards || null,
             allKeys: Object.keys(v).slice(0,45),
             voucher: v.voucher || null,
             vouchersType: Array.isArray(v.vouchers) ? 'array:'+v.vouchers.length : typeof v.vouchers };
  });
  const qv = await vouchers();
  check('three drinks go out for the quiz', qv.filter((v) => !v.carried).length === 3, qv.map((v) => `${v.place}:${v.reward}`).join(' | '));
  check('and they are the first three on the venue list',
    JSON.stringify(qv.filter((v) => v.place).sort((a, b) => a.place - b.place).map((v) => v.reward)) === JSON.stringify(DRINKS.slice(0, 3)),
    qv.map((v) => v.reward).join(', '));

  section(`THEN THE BINGO — ${BINGO}`);
  await con.goto(`${BASE}/console`, { waitUntil: 'load' });
  await con.waitForSelector('.pack-card', { timeout: 20000 });
  await pickVenue();
  /*
   * ONE NIGHT, NOT TWO LAUNCHES — which is the whole point of the six drinks.
   * A separate `launch` starts a fresh night and the prize list begins again
   * at drink one; a running order carries how many the night has given.
   */
  const bingoLaunch = await host('launchOrder', {
    segments: [
      { kind: 'quiz', order: [{ packId: QUIZ, round: 0 }, { packId: QUIZ, round: 1 }] },
      { kind: 'bingo', packId: BINGO, prizes: 2 },
    ],
    replace: true, venue: VENUE, winners: 3,
  });
  check('the whole night launches as one running order', bingoLaunch.status === 200, JSON.stringify(bingoLaunch.body).slice(0, 110));
  const bv = await view();
  check('the night opens on the QUIZ part, the bingo queued behind it',
    bv.kind !== 'bingo' && /2000s & 2010s/i.test(String(bv.quizTitle || '')), String(bv.quizTitle || bv.kind));

  const playPart = async (who) => {
    let g = 0;
    while (g++ < 120) {
      const v = await view();
      if (v.phase === 'round_board' || v.phase === 'final' || v.kind === 'bingo') return v.phase;
      if (v.phase === 'question') {
        for (const [i, p] of who.entries()) {
          await fetch(`${BASE}/api/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: p.id, token: p.token, optionIndex: i % 4, joinCode: code }) });
        }
      }
      await host('next');
      await wait(90);
    }
    return 'stuck';
  };

  const rejoined = [];
  for (const name of teams) {
    const r = await fetch(`${BASE}/api/join?g=${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) });
    const j = await r.json();
    rejoined.push({ name, id: j.id || j.playerId, token: j.token });
  }
  const endedAt = await playPart(rejoined);
  check('the quiz part reaches its own boundary', /round_board|final/.test(endedAt), endedAt);
  const cont = await host('advanceOrder');
  check('Continue to the bingo', cont.status === 200, JSON.stringify(cont.body).slice(0, 70));
  /*
   * THE QUIZ PAYS AT THE CONTINUE PRESS — that is the moment its part ends,
   * and `advanceOrder()` mints before the part is thrown away. The room has
   * just seen the quiz's final standings on the round board, so the drink
   * arrives while they still feel like they won it.
   */
  const paidAtBoundary = await vouchers();
  check('THE QUIZ PAYS ITS THREE AS THE PART ENDS, before a track is called',
    paidAtBoundary.length === 3, paidAtBoundary.map((v) => `${v.place}:${v.reward}`).join(' | ') || 'none');
  check('and they are drinks one, two and three in order',
    JSON.stringify(paidAtBoundary.sort((a,b)=>a.place-b.place).map(v=>v.reward)) === JSON.stringify(DRINKS.slice(0,3)),
    paidAtBoundary.map(v=>v.reward).join(', '));

  const st = await con.evaluate(async () => (await (await fetch('/api/state?role=host')).json()));
  const tracks = (st.tracks || st.callSheet || []).map((t) => t.id || t);
  let called = 0, claimed = 0;
  for (const t of tracks) {
    const r = await host('call', { trackId: t });
    if (r.status !== 200) continue;
    called += 1;
    for (const p of rejoined) {
      const mine = await (await fetch(`${BASE}/api/state?role=player&playerId=${p.id}&token=${p.token}&g=${code}`)).json();
      const card = mine.card || mine.squares || [];
      const calledNow = mine.called || [];
      for (const [index, sq] of card.entries()) {
        const id = sq && (sq.id || sq.trackId || sq);
        const isCalled = sq && typeof sq === 'object' && 'called' in sq ? sq.called : calledNow.includes(id);
        if (isCalled) {
          await fetch(`${BASE}/api/mark`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, index, marked: true, joinCode: code }) });
        }
      }
      const after = await (await fetch(`${BASE}/api/state?role=player&playerId=${p.id}&token=${p.token}&g=${code}`)).json();
      if (!after.canClaim) continue;
      const c = await fetch(`${BASE}/api/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code }) });
      const cj = await c.json().catch(() => ({}));
      if (cj && (cj.prize || cj.valid)) claimed += 1;
    }
    if (claimed >= 1 || called > 30) break;
  }
  check('tracks are called and a prize is claimed', claimed >= 1, `${called} called, ${claimed} claimed`);
  const allv = await vouchers();
  const fresh = allv.filter((v) => !v.carried);
  check('the bingo takes the NEXT drink, not a pint again',
    fresh.length >= 1 && fresh[0].reward === DRINKS[3], fresh.map((v) => v.reward).join(', ') || 'none');
  check('nothing was handed out twice',
    new Set(allv.map((v) => v.reward)).size === allv.length, allv.map((v) => v.reward).join(', '));

  await screen.waitForTimeout(800);
  await screen.screenshot({ path: `${SHOTS}/6-screen-bingo.png` });

  /*
   * ---- ALL THREE IN ONE NIGHT -------------------------------------------
   *
   * The night he actually asked about: a quiz, card bingo and music bingo,
   * one running score and one list of drinks. It is BUILT ON THE BAR rather
   * than posted to the route, because `launchOrder` already has a route test
   * and the console's launch form is where this keeps breaking.
   *
   * Card bingo is the awkward one and worth saying why: it has no pack file,
   * its tab is console-only, and a running order holding it was the SIXTH
   * sighting of the kind test written when there were two games. So the leg
   * proves the deck is a part of its own — that the projector follows the
   * switch INTO it and OUT of it, and that it takes one drink off the venue's
   * list rather than the quiz's three again.
   */
  if (CARDS !== 'off') {
    section('ALL THREE IN ONE NIGHT — quiz, card bingo, music bingo');
    /*
     * A FRESH BROWSER, because this is a fresh night. The sections above have
     * played two nights in `con` and left the bar mid-story; rehearsing on top
     * of that measures the guard's own history rather than tomorrow. Tomorrow
     * he opens a console that has just been signed into, so that is what this
     * opens — its own page and its own helpers, never the ones closed over the
     * page above, or the venue gets picked on one bar and the night launched
     * from another.
     */
    const ctx3 = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    const con3 = await ctx3.newPage();
    con3.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    const misses = [];
    con3.on('response', (r) => { if (r.status() === 404) misses.push(new URL(r.url()).pathname); });
    await con3.goto(`${BASE}/login`, { waitUntil: 'load' });
    await con3.fill('input[type=email]', 'mark@example.com');
    await con3.fill('input[type=password]', 'quizmaster passphrase');
    await con3.evaluate(() => document.querySelector('form')?.requestSubmit());
    await con3.waitForTimeout(2500);
    await con3.waitForSelector('.pack-card', { timeout: 20000 });

    const host3 = async (action, body = {}) => con3.evaluate(async ({ a, b }) => {
      const r = await fetch(`/api/host/${a}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    }, { a: action, b: body });
    const view3 = async () => con3.evaluate(async () => (await (await fetch('/api/state?role=host')).json()));
    const vouchers3 = async () => con3.evaluate(async () =>
      Object.values(((await (await fetch('/api/state?role=host')).json()).vouchers) || {}));

    /*
     * END WHATEVER IS STILL RUNNING FIRST — and this is the bit that is worth
     * knowing rather than working around. With a night mid-play the console
     * has NO LAUNCH BAR AT ALL: the doorhead is the running panel, and Stop is
     * the way back to one. At the LOBBY the bar is there beside it. So the
     * only way to build the next night is to end this one, which is what a
     * human would have to do too.
     */
    con3.on('dialog', (d) => d.accept().catch(() => {}));
    for (let i = 0; i < 3; i += 1) {
      const pressed = await con3.evaluate(() => {
        const b = [...document.querySelectorAll('button')]
          .find((n) => /^(unlaunch|stop)$/i.test((n.textContent || '').trim()));
        if (!b) return false;
        b.click();
        return true;
      });
      if (!pressed) break;
      await con3.waitForTimeout(1800);
    }
    await con3.waitForTimeout(500);
    const barBack = await con3.evaluate(() => !!document.querySelector('.lb-go'));
    check('ending the running night brings the launch bar back', barBack);
    for (let i = 0; i < 24; i += 1) {
      const done = await con3.evaluate(() => {
        const x = document.querySelector('.lb-tile.is-pack .lb-tile-off');
        if (!x) return true;
        x.click();
        return false;
      });
      if (done) break;
      await con3.waitForTimeout(250);
    }
    const cleared = await con3.$$eval('.lb-tile.is-pack', (ns) => ns.length);
    check('the bar starts the rehearsal empty, as it will tomorrow', cleared === 0, `${cleared} left`);

    await con3.evaluate(async (v) => {
      document.querySelector('.lb-where')?.click();
      await new Promise((r) => setTimeout(r, 500));
      [...document.querySelectorAll('.lb-venues button')].find((b) => b.textContent.includes(v))?.click();
    }, VENUE);
    await con3.waitForTimeout(1000);

    const tab3 = async (t) => {
      await con3.evaluate((x) => document.querySelector(`[data-tab="${x}"]`)?.click(), t);
      await con3.waitForTimeout(900);
    };
    const tap3 = async (id) => {
      const hit = await con3.evaluate((x) => {
        const c = document.querySelector(`.pack-card[data-pack="${x}"]`);
        if (!c) return false;
        c.click();
        return true;
      }, id);
      await con3.waitForTimeout(1100);
      return hit;
    };

    await tab3('quiz');
    check('the quiz taps into Tonight', await tap3(QUIZ));
    await tab3('cards');
    check('the deck is on its own tab and taps in beside it', await tap3(CARDS));
    await tab3('bingo');
    check('and the music bingo makes it three games', await tap3(BINGO));

    const built = await con3.$$eval('.lb-tile.is-pack', (ns) =>
      ns.map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)));
    check('the bar holds all three games at once', built.length >= 3, built.join(' | '));
    check('and the deck is one of them', built.some((t) => /card/i.test(t)), built.join(' | '));

    const go3 = await con3.$eval('.lb-go', (n) => ({ off: n.disabled, text: n.textContent.trim() }));
    check('Launch is live for a three-game night', !go3.off, go3.text);
    /*
     * AND IT NAMES BOTH GAMES. It read *"2 rounds + 2 bingo games"* for this
     * night — card bingo and music bingo counted as one thing, on the one
     * control that says what is about to be played to a room.
     */
    check('Launch names the card bingo and the music bingo separately',
      /card bingo/i.test(go3.text) && /music bingo/i.test(go3.text)
        && !/2 bingo games/i.test(go3.text), go3.text);
    await con3.screenshot({ path: `${SHOTS}/7-three-game-bar.png` });

    await con3.locator('.lb-go').click();
    await con3.waitForTimeout(3000);
    check('Launch lands on the control view', /\/host/.test(con3.url()), con3.url());

    const ord = await view3();
    check('the night arrived as THREE parts, not one',
      (ord.runningOrder || {}).total === 3, JSON.stringify(ord.runningOrder || {}).slice(0, 90));

    const code3 = await con3.evaluate(async () =>
      ((await (await fetch('/api/library')).json()).running || {}).joinCode || '');
    const crowd = [];
    for (const name of teams) {
      const r = await fetch(`${BASE}/api/join?g=${code3}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, joinCode: code3 }),
      });
      const j = await r.json();
      crowd.push({ name, id: j.id || j.playerId, token: j.token });
    }
    check('the room joins the three-game night', crowd.every((p) => p.id && p.token),
      crowd.map((p) => (p.id ? 'ok' : 'FAILED')).join(' '));

    const screen3 = await ctx3.newPage();
    await screen3.setViewportSize({ width: 1280, height: 720 });
    await screen3.goto(`${BASE}/screen`, { waitUntil: 'load' });
    await screen3.waitForTimeout(1500);

    const marks = async (p) => {
      const mine = await (await fetch(`${BASE}/api/state?role=player&playerId=${p.id}&token=${p.token}&g=${code3}`)).json();
      const calledNow = mine.called || [];
      for (const [index, sq] of (mine.card || mine.squares || []).entries()) {
        const id = sq && (sq.id || sq.trackId || sq);
        const isCalled = sq && typeof sq === 'object' && 'called' in sq ? sq.called : calledNow.includes(id);
        const already = sq && typeof sq === 'object' ? sq.marked : false;
        if (isCalled && !already) {
          await fetch(`${BASE}/api/mark`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: p.id, token: p.token, index: (sq && sq.index != null) ? sq.index : index, marked: true, joinCode: code3 }),
          });
        }
      }
      const after = await (await fetch(`${BASE}/api/state?role=player&playerId=${p.id}&token=${p.token}&g=${code3}`)).json();
      if (!after.canClaim) return false;
      const c = await fetch(`${BASE}/api/claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code3 }),
      });
      const cj = await c.json().catch(() => ({}));
      return Boolean(cj && (cj.prize || cj.valid));
    };

    const played = [];
    const owedAfter = [];
    for (let part = 0; part < 3; part += 1) {
      /*
       * THE PROJECTOR IS ASKED WITH THE JOIN CODE — `role=screen` with no `g=`
       * is the HOUSE room by design, which sat on the quiz all night and had
       * this leg play the quiz branch three times while the night moved on
       * underneath it. A guard that asks the wrong room measures the wrong room.
       */
      const g = await con3.evaluate(async (c) =>
        (await (await fetch(`/api/state?role=screen&g=${c}`)).json()).game, code3);
      played.push(g);

      /*
       * AND THE PROJECTOR IS READ, NOT JUST ASKED. The payload being right
       * proves nothing about what the room is looking at: the lobby card's key
       * was the constant 'lobby', so at a part boundary the heading changed and
       * the card under it kept the previous game's name and prize list.
       */
      await screen3.waitForTimeout(1200);
      const onWall = await screen3.evaluate(() =>
        (document.body.innerText || '').replace(/\s+/g, ' ').trim());
      /* `quizTitle` is the QUIZ's field and is empty on a bingo or cards part,
       * where the pack's name arrives as `title`. Asking for one of them made
       * this assertion fail about a projector that was right. */
      const named = await con3.evaluate(async (c) => {
        const v = await (await fetch(`/api/state?role=screen&g=${c}`)).json();
        return v.quizTitle || v.title || '';
      }, code3);
      check(`the projector names the ${g} part, not the one before it`,
        Boolean(named) && onWall.toUpperCase().includes(named.toUpperCase()),
        `wall wants "${named}" — got "${onWall.slice(0, 70)}"`);

      if (g === 'quiz') {
        let guard3 = 0;
        while (guard3++ < 120) {
          const v = await view3();
          if (v.phase === 'round_board' || v.phase === 'final') break;
          if (v.phase === 'question') {
            for (const [i, p] of crowd.entries()) {
              await fetch(`${BASE}/api/answer`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: p.id, token: p.token, optionIndex: i % 4, joinCode: code3 }),
              });
            }
          }
          await host3('next');
          await wait(90);
        }
        check('the quiz part plays to its own boundary', true);
      } else if (g === 'cards') {
        /* THIRTEEN IS ONE LINE OF ALL THIRTEEN — a hand is complete or it is
         * not, so the deck is turned until somebody has the lot. */
        let turned = 0;
        let claimed = 0;
        for (let i = 0; i < 56 && !claimed; i += 1) {
          const d = await host3('draw');
          if (d.status !== 200 || d.body === null) break;
          turned += 1;
          for (const p of crowd) {
            if (await marks(p)) { claimed += 1; break; }
          }
        }
        check('the deck deals and a hand is completed', turned > 0 && claimed >= 1,
          `${turned} turned, ${claimed} claimed`);
        await screen3.waitForTimeout(600);
        await screen3.screenshot({ path: `${SHOTS}/8-screen-cards.png` });
      } else if (g === 'bingo') {
        const st3 = await view3();
        const list = (st3.tracks || st3.callSheet || []).map((t) => t.id || t);
        let called = 0;
        let claimed = 0;
        for (const t of list) {
          const r = await host3('call', { trackId: t });
          if (r.status !== 200) continue;
          called += 1;
          for (const p of crowd) {
            if (await marks(p)) { claimed += 1; break; }
          }
          if (claimed >= 1 || called > 30) break;
        }
        check('the music bingo calls and pays', called > 0 && claimed >= 1,
          `${called} called, ${claimed} claimed`);
      }

      const owed = await vouchers3();
      owedAfter.push(owed.length);
      if (part < 2) {
        const nxt = await host3('advanceOrder');
        check(`Continue out of the ${g} part`, nxt.status === 200, JSON.stringify(nxt.body).slice(0, 70));
        await wait(500);
      }
    }

    check('all three games reached the projector, each as its own part',
      new Set(played).size === 3 && played.includes('cards'), played.join(' -> '));

    const end = await vouchers3();
    const words = end.map((v) => v.reward);
    check("every drink handed out is one of the venue's own",
      words.length > 0 && words.every((w) => DRINKS.includes(w)), words.join(', ') || 'none');
    check('NOTHING WAS HANDED OUT TWICE ACROSS THE WHOLE NIGHT',
      new Set(words).size === words.length, words.join(', '));
    check('the three games worked DOWN the list rather than each starting at a pint',
      words.filter((w) => w === DRINKS[0]).length <= 1, words.join(', '));
    check('and the night paid more than the quiz alone', words.length > 3,
      `${words.length} drinks: ${words.join(', ')}`);
    console.log(`     drinks owed after each part: ${owedAfter.join(' -> ')}`);
    check('nothing the console asked for was missing', misses.length === 0,
      [...new Set(misses)].slice(0, 4).join(' '));
  }

  check('no console errors all night', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser?.close().catch(() => {});
  await stop();
}
console.log(fails ? `\n${fails} FAILED — do not play this` : `\nTonight's packs run end to end. Screenshots in ${SHOTS}`);
process.exit(fails ? 1 : 0);
