#!/usr/bin/env node
/**
 * IS A DRINK THIS PHONE HAS WON EVER MORE THAN A GLANCE AWAY?
 *
 *   node scripts/drinks-in-your-pocket.mjs
 *
 * ---
 *
 * Asked for on 11 September 2026: *"What would be AMAZING is if the app can
 * give them drinks that they keep in their account on their phone so they can
 * redeem them throughout the night whenever they fancy it."*
 *
 * **AND THE ANSWER WAS THAT IT ALREADY DOES** — which is not a thing you can
 * establish by reading, because it is spread over two engines and five
 * screens. A wallet chip was built for this: a standing button in the corner
 * that opened every code the phone was holding. Then this probe walked a whole
 * quiz-and-bingo night asking, at every phase, *is a code held and NOT on the
 * screen* — and the answer was never once yes. The chip would have been a
 * control with no moment to exist in, which *as little clutter as possible*
 * says to delete rather than ship, so it was deleted.
 *
 * What is left is this, which is the useful half: the promise stated as an
 * assertion, walking both engines and a part boundary.
 *
 *   - **A code is never withheld from the phone that owns it while a screen
 *     has room for it.** The server decides when there is room — `view.vouchers`
 *     is absent over a live question and at the reveal, deliberately — so this
 *     never asserts that a code SHOULD be there. It asserts the one direction
 *     that can go wrong silently: the server sent one and nobody drew it.
 *
 *   - **That is exactly the fault this repo keeps shipping.** *A test that the
 *     payload is right proves nothing about whether anybody drew it* — the
 *     arcade board, the join queue on a bingo night, the end-of-round banner
 *     and the quizmaster's own message were all four of them correct on the
 *     wire and invisible in the room.
 *
 * Both halves of the night, because the two engines draw these in two
 * different places — `wallet()` in `play.js` and `paintVouchers()` in
 * `play-bingo.js` — and *a decision taken for both engines needs an assertion
 * in both.*
 */

import { createRequire } from 'node:module';
import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'drinks-in-your-pocket';
const { base: BASE, stop } = await startApp({ key: KEY });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const act = (a, b = {}) => fetch(`${BASE}/api/host/${a}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  body: JSON.stringify(b),
}).then((r) => r.json());
const asHost = (r) => fetch(`${BASE}${r}`, { headers: { 'X-Host-Key': KEY } }).then((x) => x.json());
const post = (r, b) => fetch(`${BASE}${r}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
}).then((x) => x.json());

const browser = await chromium.launch();
const gaps = [];
try {
  const lib = await asHost('/api/library');
  const bingoPack = (lib.bingo || lib.bingoPacks || [])[0];
  const quizPack = (lib.quizzes || [])[0];
  if (!bingoPack || !quizPack) throw new Error('the fixture library needs a quiz and a bingo pack');

  /* A running order, because a code won in the bingo and carried into the quiz
     is the case the phone gets wrong — and the one a real night has. */
  await act('launchOrder', {
    segments: [
      { kind: 'bingo', packId: bingoPack.id, shape: { rows: 4, cols: 4 }, prizes: 2 },
      { kind: 'quiz', order: [{ packId: quizPack.id, round: 0 }] },
    ],
    venue: 'The Guard Dog',
    rewards: ['A bottle of house red', 'Two pints of anything on tap', 'A packet of crisps'],
    replace: true,
  });
  const jc = ((await asHost('/api/library')).running || {}).joinCode || '';
  const q = jc ? `&g=${jc}` : '';

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/play${jc ? `?g=${jc}` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.fill('#nameInput', 'Quizteam Aguilera');
  await page.click('#joinBtn');
  await wait(500);
  const me = await page.evaluate(() => JSON.parse(localStorage.getItem('musicquiz.player') || '{}'));
  await act('start');
  await wait(500);

  const mine = () => fetch(
    `${BASE}/api/state?role=player&playerId=${me.id}&token=${encodeURIComponent(me.token)}${q}`,
  ).then((r) => r.json());

  /*
   * PUT A FINGER ON IT. Not `querySelectorAll().length` — a `display: none`
   * card is still in the document, and *"in the document" and "somebody can
   * see it" are different questions*. So every card is measured and the first
   * one is asked whether it is genuinely the thing under its own middle.
   */
  const onScreen = () => page.evaluate(() => {
    const cards = [...document.getElementById('body').querySelectorAll('.win-card')];
    const seen = cards.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!seen.length) return { count: 0 };
    const el = seen[0];
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { count: seen.length, pressable: Boolean(hit && el.contains(hit)) };
  });

  const look = async (where) => {
    await wait(700);
    const s = await mine();
    const held = (s.vouchers || []).length;
    const shown = await onScreen();
    const line = `${where} — phase ${s.phase}, holding ${held}, drawn ${shown.count}`;
    if (held > 0 && shown.count === 0) gaps.push(line);
    if (held > 0 && shown.count > 0 && shown.pressable === false) {
      gaps.push(`${line} (drawn but painted over)`);
    }
    return { s, held, shown, line };
  };

  await look('the bingo, before anybody has won');

  const hv = await asHost(`/api/state?role=host${q}`);
  const ids = new Map((hv.tracks || []).map((t) => [t.title, t.id]));
  const s0 = await mine();
  for (const [i, sq] of (s0.card || []).entries()) {
    await act('call', { trackId: ids.get(sq.title) });
    await post('/api/mark', { playerId: me.id, token: me.token, index: i, marked: true, joinCode: jc });
  }
  await post('/api/claim', { playerId: me.id, token: me.token, joinCode: jc });

  const won = await look('the moment the line lands');
  /* THE HOLD IS DELIBERATE AND IS ASSERTED AS SUCH, or a later change that
     released the codes early would slip through as an improvement. */
  check('a code is HELD until the round is over — not a gap, a decision',
    won.held === 0 && won.shown.count === 0, won.line);

  await act('newRound');
  const next = await look('the next bingo round');
  check("and last round's code is on the phone once the round has turned over",
    next.held > 0 && next.shown.count > 0, next.line);

  await act('advanceOrder');
  const carried = await look('the quiz, after "Continue to the quiz"');
  check('IT SURVIVES THE PART BOUNDARY AND IS STILL DRAWN',
    carried.held > 0 && carried.shown.count > 0, carried.line);

  /* Every phase the quiz has, in order, which is where a payload-only check
     would stop and this one does not. */
  let hitQuestion = false;
  for (let i = 0; i < 40; i += 1) {
    const st = await asHost(`/api/state?role=host${q}`);
    if (st.phase === 'final') break;
    await act('next');
    const at = await look(`the quiz at ${st.phase}`);
    if (at.s.phase === 'question') hitQuestion = true;
  }
  check('a question was actually asked, or the next check proves nothing', hitQuestion);

  const final = await look('the final scores');
  check('and it is there at the end of the night',
    final.held > 0 && final.shown.count > 0, final.line);

  check('A HELD CODE IS NEVER OFF THE PHONE — at any phase of either game',
    gaps.length === 0, gaps.join(' | '));
} finally {
  await browser.close();
  stop();
}

console.log(failures
  ? `\n${failures} FAILED`
  : '\nevery drink they won is in their pocket all night');
process.exit(failures ? 1 : 0);
