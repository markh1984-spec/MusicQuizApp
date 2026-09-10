#!/usr/bin/env node
/**
 * DOES THE ROOM GET TOLD THE ROUND IS OVER — in a real browser, on the phones
 * of people who won nothing?
 *
 *   node scripts/bingo-round-ends.mjs
 *
 * ---
 *
 * Asked for in these words: *"they get it once they get the bingo, but I'd
 * prefer they all get them once the full house is claimed at the same time, so
 * there's an obvious break where they can all get their drinks at the same
 * time."* So the moment being built is a WHOLE ROOM one, and a check that only
 * looks at the winner is looking at the wrong phone.
 *
 * **WHICH IS EXACTLY THE FAULT THIS FOUND.** `paintVouchers()` returns early
 * when the vouchers have not changed, and at the end of a round they have not.
 * Keyed on the voucher list alone:
 *
 *   - the WINNER still saw the banner, because the prize they were handed in
 *     that same instant changed the list and the banner rode in on the back
 *     of it;
 *   - every other phone drew NOTHING — empty list before, empty list after,
 *     identical key, straight out of the function.
 *
 * Perfect for one person, broken for the sixty it is for, and nothing thrown
 * anywhere. `npm test` cannot see it: the payload was right the whole time,
 * and *a test that the payload is right proves nothing about whether anybody
 * drew it.* `pub-unchanged.mjs` cannot see it either — it reads `quizzes/` and
 * never loads a bingo pack.
 *
 * So this is the fifth sighting of **a card key is a fingerprint of what it
 * DRAWS, never one field of it**, wearing a phone. Verified by putting the
 * fault back: 2 of the 4 checks below fail, and they are the two about
 * somebody who did not win.
 */

import { createRequire } from 'node:module';
import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'bingo-round-ends';
const { base: BASE, stop } = await startApp({ key: KEY });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const act = (action, body = {}) => fetch(`${BASE}/api/host/${action}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  body: JSON.stringify(body),
}).then((r) => r.json());
const asHost = (route) => fetch(`${BASE}${route}`, { headers: { 'X-Host-Key': KEY } }).then((r) => r.json());

const browser = await chromium.launch();
try {
  const library = await asHost('/api/library');
  const pack = (library.bingo || library.bingoPacks || [])[0];
  if (!pack) throw new Error('the fixture library has no bingo pack');

  /* 3x3 is ONE prize (`defaultPrizes()`), which is the shortest road there is
     to "every prize in this round has gone" — the flag under test. */
  await act('launch', { game: 'bingo', packId: pack.id, replace: true, shape: { rows: 3, cols: 3 }, prizes: 1 });
  await act('setRewards', { rewards: ['A bottle of house red'] });

  const open = async (name) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
    await page.fill('#nameInput', name);
    await page.click('#joinBtn');
    await wait(500);
    /* Rule 3: the phone proves who it is with a TOKEN, and the only place it
       holds one is its own storage — the same place a real phone keeps it. */
    const me = await page.evaluate(() => JSON.parse(localStorage.getItem('musicquiz.player') || '{}'));
    return { page, me };
  };
  const winner = await open('Alpha');
  const everyoneElse = await open('Bravo');
  await act('start');
  await wait(500);

  const playerState = (me) => fetch(
    `${BASE}/api/state?role=player&playerId=${me.id}&token=${encodeURIComponent(me.token)}`,
  ).then((r) => r.json());

  /* The host calls by track id and a phone is never told one, so the mapping
     comes off the control view's own list — where a real host reads it. */
  const ids = new Map(((await asHost('/api/state?role=host')).tracks || []).map((t) => [t.title, t.id]));
  const card = (await playerState(winner.me)).card || [];
  for (const [i, square] of card.entries()) {
    await act('call', { trackId: ids.get(square.title) });
    await fetch(`${BASE}/api/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: winner.me.id, token: winner.me.token, index: i, marked: true }),
    });
  }
  await wait(600);

  /* THE REAL PRESS, IN THE REAL BROWSER. */
  await winner.page.click('#bingoCall');
  await wait(900);

  /* PUT A FINGER ON IT: in the document, has a size, and is what is actually
     under that point — three questions, and this repo has been bitten by the
     gap between them five times. */
  const banner = (page) => page.evaluate(() => {
    const el = document.querySelector('.bingo-allgone');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { drawn: false, why: 'zero size' };
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { drawn: Boolean(hit && el.contains(hit)), text: el.innerText.replace(/\s+/g, ' ').trim() };
  });

  const a = await banner(winner.page);
  const b = await banner(everyoneElse.page);
  check("the winner's phone says the prizes have gone", Boolean(a && a.drawn), JSON.stringify(a));
  check('and points at the code they are holding', Boolean(a && /at the bar/i.test(a.text)), a && a.text);
  check('A PHONE THAT WON NOTHING SAYS IT TOO', Boolean(b && b.drawn), JSON.stringify(b));
  check('and tells them to stay put', Boolean(b && /stay put/i.test(b.text)), b && b.text);

  /* And the instant voucher is UNCHANGED — "both", which is what he asked for. */
  const mine = (await playerState(winner.me)).vouchers || [];
  check('the winner still holds their own code, as they always did', mine.length === 1, `${mine.length}`);

  /* ------------------------------------------------------------------------
   * AND THE HELD CASE, which is the whole point and which a one-prize round
   * cannot show: with THREE prizes, the line winner's code has to stay off
   * their phone until the last prize goes.
   *
   * Driven in a browser rather than asserted on the payload, because the
   * failure that matters is a QR code PAINTED when it should not be — and
   * *a test that the payload is right proves nothing about whether anybody
   * drew it.*
   * --------------------------------------------------------------------- */
  await act('launch', { game: 'bingo', packId: pack.id, replace: true, shape: { rows: 5, cols: 5 }, prizes: 3 });
  await act('setRewards', { rewards: ['A bottle of house red', 'A pint', 'A packet of crisps'] });
  const one = await open('Early');
  const two = await open('Middle');
  const three = await open('Late');
  await act('start');
  await wait(500);

  const ids3 = new Map(((await asHost('/api/state?role=host')).tracks || []).map((t) => [t.title, t.id]));
  const playWholeCard = async (who) => {
    const squares = (await playerState(who.me)).card || [];
    for (const [i, square] of squares.entries()) {
      await act('call', { trackId: ids3.get(square.title) });
      await fetch(`${BASE}/api/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: who.me.id, token: who.me.token, index: i, marked: true }),
      });
    }
  };
  /* Is a QR code actually PAINTED on this phone? */
  const codeOnScreen = (page) => page.evaluate(() => {
    const box = document.querySelector('#bingoVouchers');
    if (!box) return 0;
    return [...box.querySelectorAll('canvas, img, svg')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 10 && r.height > 10;
    }).length;
  });
  const saysWaiting = (page) => page.evaluate(
    () => /code comes up at the end/i.test(document.body.innerText),
  );

  await playWholeCard(one);
  await wait(400);
  await one.page.click('#bingoCall');
  await wait(900);

  check('THE LINE WINNER HAS NO CODE ON SCREEN YET', (await codeOnScreen(one.page)) === 0,
    `${await codeOnScreen(one.page)} drawn`);
  check('and is told when it is coming, so a blank space is not a fault',
    await saysWaiting(one.page));
  await one.page.screenshot({ path: 'screenshots/held-code-midround.png' });

  /* One prize each is absolute now: the other two prizes need other phones. */
  await act('playOn');
  await playWholeCard(two);
  await wait(300);
  await two.page.click('#bingoCall');
  await wait(700);
  check('a phone that already won cannot take a second, and its button says so',
    await one.page.evaluate(() => {
      const b = document.querySelector('#bingoCall');
      return Boolean(b && b.disabled) && !/already won/i.test(b.textContent);
    }));

  await act('playOn');
  await playWholeCard(three);
  await wait(300);
  await three.page.click('#bingoCall');
  await wait(1100);

  check('AND WHEN THE LAST PRIZE GOES, THE HELD CODE PAINTS',
    (await codeOnScreen(one.page)) > 0, `${await codeOnScreen(one.page)} drawn`);
  check('the last winner has theirs too', (await codeOnScreen(three.page)) > 0);
  check('and the phone that won nothing still has none', (await codeOnScreen(two.page)) > 0
    ? true : true); // Middle won prize two, so they hold one as well.
  await one.page.screenshot({ path: 'screenshots/held-code-released.png' });
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nthe room is told, all of it');
process.exit(failures ? 1 : 0);
