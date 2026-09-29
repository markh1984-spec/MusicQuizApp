#!/usr/bin/env node
/**
 * WHAT YOU TYPE IN THE PRIZE TABLE IS WHAT THE ROOM PLAYS FOR.
 *
 * ---
 *
 * Found by sweeping the launch path the day after the per-game prize table
 * was built, and it had shipped:
 *
 *   - the bar read **TYPED 1, TYPED 2, TYPED 3** and the room played for the
 *     VENUE's list — the console and the big screen disagreeing, silently,
 *     which the launch bar has a standing rule against;
 *   - and with no venue picked at all, the typed drinks still OPENED the
 *     launch gate (`noPrizesReason()` accepts what was typed) and then went
 *     nowhere, so the night launched with an empty list and nobody to pay.
 *     That is precisely the failure the table was built to prevent.
 *
 * THE CAUSE IS THE BURST, WHICH IS WHY IT HID. A quiz pack arrives as one tile
 * per ROUND, so `lbSlots` exists on an ordinary one-pack night — the table
 * therefore wrote the part's list onto `lbSlots[0]`, while `simpleNight()`
 * collapsed the row back and the launch read `night.*`. Reading one place and
 * writing another.
 *
 * TWO GUARDS MISSED IT AND BOTH FOR THE SAME REASON — they were not on this
 * path. The drive that shipped the feature used a quiz AND a bingo, where each
 * part's list travels on its own segment; `bar-reaches-the-room.mjs` picks a
 * BINGO pack, which has no rounds and so never bursts. Only a quiz on its own
 * takes the road the bug was on, and that is most nights.
 *
 *   node scripts/typed-prizes-reach-the-room.mjs
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  — ${d}` : ''}`); };
const VENUE = 'The Typed Arms';
const VENUE_LIST = ['VENUE ONE', 'VENUE TWO', 'VENUE THREE'];
const TYPED = ['A PINT OF THE GOOD STUFF', 'A LARGE WINE', 'A PACKET OF CRISPS'];

const { base: BASE, stop } = await startApp({
  key: 'typed-prizes',
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'o@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});

let browser;
try {
  browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  p.on('dialog', (d) => d.accept());
  const bodies = [];
  p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/host\/launch/.test(r.url())) bodies.push(r.postData() || ''); });

  await p.goto(`${BASE}/login`, { waitUntil: 'load' });
  await p.fill('input[type=email]', 'qm@example.com');
  await p.fill('input[type=password]', 'quizmaster passphrase');
  await p.evaluate(() => document.querySelector('form')?.requestSubmit());
  await p.waitForTimeout(2500);
  await p.evaluate(async ({ venue, list }) => {
    const H = { 'Content-Type': 'application/json' };
    const mk = await fetch('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: venue }) });
    const c = ((await mk.json()).customers || []).find((x) => x.name === venue);
    await fetch(`/api/invoices/customers/${encodeURIComponent(c.id)}/rewards`, { method: 'PUT', headers: H,
      body: JSON.stringify({ rewards: list, usualNight: 'thu' }) });
  }, { venue: VENUE, list: VENUE_LIST });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.pack-card', { timeout: 20000 });
  await p.evaluate(async (v) => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes(v))?.click();
  }, VENUE);
  await p.waitForTimeout(900);

  console.log('\nA QUIZ ON ITS OWN — the pack bursts, so the row is slots and the launch is simple');
  const card = await p.$('.pack-card[data-pack="2000s-2010s-mixed"]') || await p.$('.pack-card[data-pack]');
  const box = await card.boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(1300);
  const tiles = await p.$$eval('.lb-tile.is-pack', (n) => n.length);
  check('the pack burst into a tile per round', tiles >= 1, `${tiles} tiles`);
  const go = await p.$eval('.lb-go', (n) => n.textContent.replace(/\s+/g, ' ').trim());
  check('Launch names one pack, so this is the SIMPLE path', !/\+/.test(go), go);

  console.log('\nTYPE OVER THE VENUE’S LIST');
  const out = await p.evaluate(async (want) => {
    const head = document.querySelector('.lb-pz-head');
    if (!head) return { ok: false, why: 'no prize table' };
    if (head.getAttribute('aria-expanded') !== 'true') head.click();
    await new Promise((r) => setTimeout(r, 400));
    const boxes = [...document.querySelectorAll('.lb-pz-in')];
    if (!boxes.length) return { ok: false, why: 'no boxes' };
    const n = Math.min(boxes.length, want.length);
    for (let i = 0; i < n; i += 1) {
      boxes[i].value = want[i];
      boxes[i].dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('.lb-pz-head').click();
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, used: n, ledger: document.querySelector('.lb-prizes').innerText.replace(/\s+/g, ' ').trim() };
  }, TYPED);
  check(`the table takes it${out.why ? ` (${out.why})` : ''}`, out.ok, true);
  const want = out.ok ? TYPED.slice(0, out.used) : [];
  check('the shut ledger reads back what was typed', want.length > 0 && want.every((t) => out.ledger.includes(t)), out.ledger.slice(0, 110));
  check('and the venue’s own words are GONE from it', !VENUE_LIST.some((v) => out.ledger.includes(v)), out.ledger.slice(0, 110));

  console.log('\nLAUNCH');
  bodies.length = 0;
  await p.locator('.lb-go').click();
  await p.waitForTimeout(3000);
  const sent = bodies.length ? JSON.parse(bodies[bodies.length - 1]) : {};
  /* Wherever this night's shape puts the list — the night-wide field on a
     one-game launch, a segment's own on a mixed one. Asserting the FIELD would
     pin the shape rather than the promise. */
  const onWire = JSON.stringify(sent.rewards || (sent.segments || []).map((x) => x.rewards || []));
  check('the drinks it SENT are the drinks it SHOWED', want.every((t) => onWire.includes(t)), onWire.slice(0, 120));
  const live = await p.evaluate(async () => {
    const lib = await (await fetch('/api/library')).json();
    const code = lib.joinCode || '';
    return (await (await fetch(`/api/state?role=host&g=${encodeURIComponent(code)}`)).json()).rewards || [];
  });
  check('and the ROOM is playing for them', want.every((t) => JSON.stringify(live).includes(t)), JSON.stringify(live));
  check('and NOT for the venue’s list', !VENUE_LIST.some((v) => JSON.stringify(live).includes(v)), JSON.stringify(live));
  /*
   * AND WHAT WAS TYPED FOR A PACK THAT IS GONE MUST NOT REACH THE ROOM — R7 of
   * the 23 September 2026 sweep. A night with NO TILES (a bingo on its own, a
   * quiz picked through the search box) kept its typed drinks on `night`, and
   * nothing cleared them: they won over every tile's own list on whatever was
   * picked next, and the bar showed the venue's list while the wire carried
   * the old typed one. Three ways in, each driven exactly as the sweep found it.
   */
  const again = async ({ venue = true } = {}) => {
    // Launch lands on /host; the next act starts from the console.
    await p.goto(`${BASE}/console`, { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    /* WITH A NIGHT MID-PLAY THE CONSOLE HAS NO LAUNCH BAR — the doorhead is the
       running panel and Unlaunch/Stop is the way back to one, as a human would
       have to do too (rehearse-tonight.mjs). Then the bar is emptied. */
    for (let i = 0; i < 3; i += 1) {
      const pressed = await p.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((n) => /^(unlaunch|stop)$/i.test((n.textContent || '').trim()));
        if (!b) return false;
        b.click();
        return true;
      });
      if (!pressed) break;
      await p.waitForTimeout(1800);
    }
    await p.waitForSelector('.pack-card', { timeout: 20000 });
    for (let i = 0; i < 24; i += 1) {
      const done = await p.evaluate(() => { const x = document.querySelector('.lb-tile.is-pack .lb-tile-off'); if (!x) return true; x.click(); return false; });
      if (done) break;
      await p.waitForTimeout(250);
    }
    if (!venue) return;
    await p.evaluate(async (v) => {
      document.querySelector('.lb-where')?.click();
      await new Promise((r) => setTimeout(r, 400));
      [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes(v))?.click();
    }, VENUE);
    await p.waitForTimeout(900);
  };
  const goSays = () => p.$eval('.lb-go', (n) => ({ text: n.textContent.replace(/\s+/g, ' ').trim(), off: n.disabled }));
  const tab = async (t) => { await p.evaluate((x) => document.querySelector(`[data-tab="${x}"]`)?.click(), t); await p.waitForTimeout(900); };
  const tap = async (id) => {
    const hit = await p.evaluate((x) => { const c = document.querySelector(`.pack-card[data-pack="${x}"]`); if (!c) return false; c.click(); return true; }, id);
    await p.waitForTimeout(1300);
    return hit;
  };
  const typePrizes = (list) => p.evaluate(async (want) => {
    const head = document.querySelector('.lb-pz-head');
    if (!head) return { ok: false, why: 'no prize table' };
    if (head.getAttribute('aria-expanded') !== 'true') head.click();
    await new Promise((r) => setTimeout(r, 400));
    const boxes = [...document.querySelectorAll('.lb-pz-in')];
    const n = Math.min(boxes.length, want.length);
    for (let i = 0; i < n; i += 1) { boxes[i].value = want[i]; boxes[i].dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector('.lb-pz-head').click();
    await new Promise((r) => setTimeout(r, 400));
    return { ok: n > 0, used: n, boxes: boxes.length, ledger: document.querySelector('.lb-prizes').innerText.replace(/\s+/g, ' ').trim() };
  }, list);
  const ledger = () => p.$eval('.lb-prizes', (n) => n.innerText.replace(/\s+/g, ' ').trim());
  const launchAndRead = async () => {
    bodies.length = 0;
    await p.locator('.lb-go').click();
    await p.waitForTimeout(3000);
    const body = bodies.length ? JSON.parse(bodies[bodies.length - 1]) : {};
    const room = await p.evaluate(async () => {
      const lib = await (await fetch('/api/library')).json();
      return (await (await fetch(`/api/state?role=host&g=${encodeURIComponent(lib.joinCode || '')}`)).json()).rewards || [];
    });
    return { body, wire: JSON.stringify(body.rewards || (body.segments || []).map((x) => x.rewards || null)), room: JSON.stringify(room) };
  };
  const STALE = ['STALE ONE', 'STALE TWO', 'STALE THREE', 'STALE FOUR', 'STALE FIVE'];

  console.log('\nA BINGO ON ITS OWN, DRINKS TYPED, TAKEN OUT, A QUIZ TAPPED IN — the bingo\'s drinks must go with it');
  await again();
  await tab('bingo');
  check('a bingo taps in on its own', await tap('disco-funk'));
  const t1 = await typePrizes(STALE);
  check(`the table takes the bingo's drinks (${t1.used} of ${t1.boxes} boxes)`, t1.ok, t1.why || '');
  await p.evaluate(() => document.querySelector('.lb-tile-off')?.click());
  await p.waitForTimeout(700);
  check('the bingo is taken out', (await p.$$eval('.lb-tile.is-pack', (n) => n.length)) === 0);
  await tab('quiz');
  check('a quiz taps in after it', await tap('madonna'));
  const led1 = await ledger();
  check('the table shows the VENUE\'s list for the quiz', VENUE_LIST.every((v) => led1.includes(v)) && !STALE.some((v) => led1.includes(v)), led1.slice(0, 120));
  const r1 = await launchAndRead();
  check('the wire carries none of the bingo\'s drinks', !STALE.some((v) => r1.wire.includes(v)), r1.wire.slice(0, 120));
  check('and the room plays for the venue\'s list', VENUE_LIST.every((v) => r1.room.includes(v)), r1.room);

  console.log('\nA QUIZ THROUGH THE SEARCH BOX, DRINKS TYPED, A BINGO TAPPED IN — the quiz keeps its drinks, the bingo gets the venue\'s');
  await again();
  await tab('quiz');
  // The search box lives in a row the dotted cutout opens — the tap a phone has.
  await p.evaluate(() => document.querySelector('.lb-tile.lb-drop')?.click());
  await p.waitForTimeout(400);
  await p.fill('.lb-text', 'Madonna');
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('.lb-hit')?.click());
  await p.waitForTimeout(1000);
  // A search pick BURSTS like a tap now (Y10) — one tile per round, not one pack tile.
  const picked = await p.$$eval('.lb-tile.is-pack', (n) => n.map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim()));
  check(`the search box picks the quiz and it bursts like a tap (${picked.length} tiles)`, picked.length > 1, picked.join(' | ').slice(0, 80));
  const t2 = await typePrizes(TYPED);
  check(`the table takes the quiz's drinks (${t2.used} boxes)`, t2.ok && t2.used === 3, t2.why || `${t2.used}`);
  await tab('bingo');
  check('a bingo taps in beside it', await tap('disco-funk'));
  const r2 = await launchAndRead();
  const segs = r2.body.segments || [];
  check('the launch is a running order of two parts', segs.length === 2, JSON.stringify(segs).slice(0, 160));
  check('the QUIZ part carries the typed drinks on its own segment', JSON.stringify((segs[0] || {}).rewards || null) === JSON.stringify(TYPED), JSON.stringify(segs[0]).slice(0, 160));
  check('and the BINGO part carries none, so the venue\'s are dealt to it', !('rewards' in (segs[1] || {})), JSON.stringify(segs[1]).slice(0, 160));
  check('the room (on the quiz) plays for the typed drinks', TYPED.every((t) => r2.room.includes(t)), r2.room);

  console.log('\nA 3x3 BINGO WITH ONE DRINK, THEN A QUIZ — the card, the count and the drink stay on the bingo');
  await again();
  await tab('bingo');
  check('a bingo taps in on its own', await tap('disco-funk'));
  const set = await p.evaluate(async () => {
    const shape = document.querySelector('.shape-pick');
    const want = [...shape.options].find((o) => /3.*3/.test(o.textContent) || o.value.includes('"rows":3'));
    if (!want) return { ok: false, why: 'no 3x3 on offer' };
    shape.value = want.value;
    shape.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    const count = document.querySelector('.prize-pick');
    count.value = '1';
    count.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    return { ok: true, shape: shape.value, count: count.value };
  });
  check('a 3x3 card with one prize is chosen', set.ok && set.count === '1', set.why || JSON.stringify(set));
  const t3 = await typePrizes(['THE ONE DRINK']);
  check('the table offers ONE box and takes the drink', t3.ok && t3.boxes === 1, `${t3.boxes} boxes`);
  await tab('quiz');
  check('a quiz taps in after it', await tap('metallica'));
  const r3 = await launchAndRead();
  const b3 = (r3.body.segments || [])[0] || {};
  check('the bingo part goes out as a 3x3 with ONE prize', b3.kind === 'bingo' && b3.shape && b3.shape.rows === 3 && b3.shape.cols === 3 && Number(b3.prizes) === 1, JSON.stringify(b3).slice(0, 160));
  check('paying the drink typed for it', JSON.stringify(b3.rewards || null) === JSON.stringify(['THE ONE DRINK']), JSON.stringify(b3.rewards));
  check('and the quiz part after it carries none', !('rewards' in ((r3.body.segments || [])[1] || {})), JSON.stringify((r3.body.segments || [])[1]).slice(0, 120));
  check('the room (on the bingo) plays for that one drink', r3.room.includes('THE ONE DRINK') && !VENUE_LIST.some((v) => r3.room.includes(v)), r3.room);

  /*
   * A DECK ON ITS OWN IS NOT MUSIC BINGO — the eighth kind test written when
   * there were two games (O7 of the same sweep). `pickedPack()` read "no
   * rounds, therefore bingo", so a deck alone lit the Card and Prizes row at
   * 5x5 / 5, the table listed five line prizes for a one-line game, the full
   * house paid the wrong drink and the running panel said "Card Bingo — Music
   * quiz". And a bingo ALONE (O5): changing Card or Prizes redrew the tile row
   * and never the shut table, which went on listing five drinks while the
   * wire sent two.
   */
  /*
   * EVERY BOX CLEARED IS THE VENUE'S LIST AGAIN (O4). Clearing the three boxes
   * sent `rewards: []` — a game that pays nothing — while the gate fell
   * through to the venue record and said "prizes set", so Launch was live and
   * the room had nobody to pay. A cleared table means the venue's deal now.
   */
  console.log('\nCLEAR EVERY BOX — the venue\'s list comes back, and the wire agrees');
  await again();
  await tab('quiz');
  check('a quiz taps in', await tap('madonna'));
  const cleared = await p.evaluate(async () => {
    const head = document.querySelector('.lb-pz-head');
    if (head.getAttribute('aria-expanded') !== 'true') head.click();
    await new Promise((r) => setTimeout(r, 400));
    for (const box of document.querySelectorAll('.lb-pz-in')) { box.value = ''; box.dispatchEvent(new Event('input', { bubbles: true })); }
    document.querySelector('.lb-pz-head').click();
    await new Promise((r) => setTimeout(r, 400));
    return document.querySelector('.lb-prizes').innerText.replace(/\s+/g, ' ').trim();
  });
  check('the shut table lists the VENUE\'s drinks again', VENUE_LIST.every((v) => cleared.includes(v)) && !/Nothing set/.test(cleared), cleared.slice(0, 120));
  const r5 = await launchAndRead();
  check('the wire carries no list of its own', !('rewards' in r5.body) || r5.body.rewards === undefined, r5.wire);
  check('and the room plays for the venue\'s list, not for nothing', VENUE_LIST.every((v) => r5.room.includes(v)), r5.room);

  /*
   * TYPING THE PRIZE LAUNCH ASKED FOR WAKES IT (Y1). With no venue the button
   * reads "Pick a venue, or type what tonight pays above" — and stayed dead
   * while you typed exactly that, until the table was shut. Nothing repaints
   * on a keystroke (the caret), so only the button changes.
   */
  console.log('\nNO VENUE — typing a prize wakes Launch without shutting the table');
  await again({ venue: false });
  await tab('quiz');
  check('a quiz taps in with no venue picked', await tap('madonna'));
  const hollow = await goSays();
  check('Launch is hollow and asks for a prize', hollow.off && /type what tonight pays/i.test(hollow.text), JSON.stringify(hollow));
  await p.evaluate(async () => {
    const head = document.querySelector('.lb-pz-head');
    if (head.getAttribute('aria-expanded') !== 'true') head.click();
    await new Promise((r) => setTimeout(r, 400));
    const box = document.querySelector('.lb-pz-in');
    box.value = 'A PINT FOR TYPING';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
  });
  const woke = await goSays();
  check('Launch wakes as you type, with the table still open', !woke.off && /^Launch /.test(woke.text) && (await p.$eval('.lb-pz-head', (n) => n.getAttribute('aria-expanded'))) === 'true', JSON.stringify(woke));
  // AND THE WARNING AGREES WITH THE GATE. Shut, the table repaints the bar:
  // a prize typed for tonight is somebody to pay, so nothing may still say
  // "the winners get no voucher" beside a ready line saying "prizes set".
  const said = await p.evaluate(async () => {
    document.querySelector('.lb-pz-head').click();
    await new Promise((r) => setTimeout(r, 400));
    const text = [...document.querySelectorAll('.lb-say')].filter((n) => n.getClientRects().length).map((n) => n.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
    document.querySelector('.lb-pz-head').click();
    await new Promise((r) => setTimeout(r, 400));
    return text;
  });
  check('and no warning says the winners get no voucher once a prize is typed', !/no voucher/i.test(said), said.slice(0, 160));
  await p.evaluate(async () => {
    const box = document.querySelector('.lb-pz-in');
    box.value = '';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
  });
  const hollowAgain = await goSays();
  check('and clears the box: hollow again, same words', hollowAgain.off && /type what tonight pays/i.test(hollowAgain.text), JSON.stringify(hollowAgain));

  console.log('\nA DECK ON ITS OWN — one box, the card row inert, the panel names the game');
  await again();
  await tab('cards');
  check('the deck taps in on its own', await tap('deck'));
  const deckRow = await p.evaluate(() => ({
    card: document.querySelector('.shape-pick')?.disabled, cardSays: document.querySelector('.shape-pick option')?.textContent.trim(),
    prizes: document.querySelector('.prize-pick')?.disabled,
    boxes: (document.querySelector('.lb-prizes')?.innerText.match(/Each game|1st|2nd|3rd|4th|5th|a line|2 lines|full house/gi) || []).length,
    ledger: document.querySelector('.lb-prizes')?.innerText.replace(/\s+/g, ' ').trim() || '',
  }));
  check('Card and Bingo prizes are inert for a deck', deckRow.card === true && deckRow.prizes === true, JSON.stringify(deckRow).slice(0, 160));
  check('and the table has ONE box, not five line prizes', deckRow.boxes === 1 && !/full house|a line/i.test(deckRow.ledger), deckRow.ledger.slice(0, 120));
  const r4 = await launchAndRead();
  check('the wire names the game as cards', r4.body.game === 'cards' || (r4.body.segments || []).some((x) => x.kind === 'cards'), JSON.stringify(r4.body).slice(0, 120));
  await p.goto(`${BASE}/console`, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const panel = await p.evaluate(() => (document.querySelector('.doorhead')?.innerText || '').replace(/\s+/g, ' '));
  check('the running panel calls it card bingo, never a music quiz', /card bingo/i.test(panel) && !/music quiz/i.test(panel), panel.slice(0, 160));

  console.log('\nA BINGO ON ITS OWN — Prizes 5 → 2 redraws the SHUT table');
  await again();
  await tab('bingo');
  check('a bingo taps in on its own', await tap('disco-funk'));
  const before5 = await ledger();
  await p.evaluate(async () => {
    const count = document.querySelector('.prize-pick');
    count.value = '2';
    count.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
  });
  const after2 = await ledger();
  const chips = (after2.match(/\d+ lines|a line|full house/gi) || []).length;
  check('the shut table lists two prizes, not the five it listed a moment ago', chips === 2, `${chips} listed — ${after2.slice(0, 120)} (was: ${before5.slice(0, 60)})`);

  check('nothing threw', errs.length === 0, errs.join(' | '));
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED — the bar and the room disagree about the drinks` : '\nWhat the bar says it pays is what the room plays for.');
process.exit(fails ? 1 : 0);
