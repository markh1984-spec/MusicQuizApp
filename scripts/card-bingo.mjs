/**
 * CARD BINGO — does a deck actually reach a room, and does it end?
 *
 * ---
 *
 * Asked for as *"each person gets 13 playing cards and the console calls one at
 * a time until we have a winner"*, and built as a separate GAME on the SAME
 * engine as music bingo. That sharing is the whole design and it is also the
 * whole risk: every screen that draws a card was written when bingo was the
 * only game with one, so the failure this guard exists to catch is not an
 * exception anywhere — it is a `s.game === 'bingo'` that quietly answers false,
 * a phone that gets the QUIZ layout, and nothing thrown.
 *
 * **THE UNIT TESTS CANNOT SEE ANY OF THAT.** They can say `drawNext()` returns
 * a card and `cardLines()` gives one line of thirteen — both of which were true
 * while the game was unreachable. So this drives the real server over HTTP:
 * launch, join, deal the deck down, and check the phone's own payload the whole
 * way.
 *
 *     node scripts/card-bingo.mjs
 */

import path from 'node:path';

import { startApp } from './helpers/live-app.mjs';
import { HAND, DECK } from '../public/assets/deck.js';

const KEY = 'card-bingo';
const OWNER = { email: 'cards@example.com', password: 'card-bingo-password' };

const { Accounts } = await import('../src/accounts.js');
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Card Check', role: 'owner' });

const { base: BASE, stop } = await startApp({ key: KEY, seed: seedOwner });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const host = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const act = (action, body = {}) => host(`/api/host/${action}`, body);
const phone = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

try {
  /* ---------------------------------------------------- it is its own game */

  const library = (await host('/api/library')).body;
  check('the deck is on its own shelf, not the bingo one',
    (library.cards || []).length === 1
    && !(library.bingo || []).some((p) => p.id === 'deck'),
    `cards: ${(library.cards || []).length}`);

  const launch = await act('launch', { game: 'cards', packId: 'deck', replace: true, venue: 'The Guard Dog' });
  check('a card game launches at all', launch.status === 200,
    `${launch.status} ${JSON.stringify((launch.body && launch.body.error) || '')}`);

  const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';
  const alpha = (await phone(`/api/join${g}`, { name: 'Alpha' })).body;
  const bravo = (await phone(`/api/join${g}`, { name: 'Bravo' })).body;
  await act('start');

  const stateFor = async (who) => (await phone(
    `/api/state?role=player&playerId=${who.playerId || who.id}&token=${encodeURIComponent(who.token)}${joinCode ? `&g=${joinCode}` : ''}`,
  )).body;

  /* ------------------------------------------------------ thirteen, in order */

  const mine = await stateFor(alpha);
  check('the phone is told it is on a card game', mine.game === 'cards', `game: ${mine.game}`);
  check(`a hand is ${HAND} cards`, (mine.card || []).length === HAND, `got ${(mine.card || []).length}`);

  const faces = (mine.card || []).map((sq) => sq.title);
  const order = DECK.map((c) => c.title);
  const sorted = [...faces].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  check('the hand is DEALT in suit and rank order, not shuffled into the layout',
    faces.join(' ') === sorted.join(' '), faces.join(' '));
  check('every card in the hand is a real playing card',
    faces.every((f) => order.includes(f)) && new Set(faces).size === HAND);

  const theirs = await stateFor(bravo);
  check('two phones get different hands',
    (theirs.card || []).map((s) => s.title).join() !== faces.join());

  /* ------------------------------------------- the artwork drop-in answers */

  /*
   * A picture named after a card's id replaces the middle of that card. The
   * route is what makes it possible to find out WITHOUT fifty-two speculative
   * 404s from every phone in the room, so it has to answer even with the
   * folder empty — which is its ordinary state, and the one a unit test would
   * be least likely to notice going wrong.
   */
  const art = await phone('/api/card-art');
  check('the artwork manifest answers, empty folder or not',
    art.status === 200 && art.body && typeof art.body.art === 'object',
    `${art.status} ${JSON.stringify(art.body)}`);
  check('and it names nothing that is not a real card',
    Object.keys((art.body || {}).art || {}).every((id) => DECK.some((c) => c.id === id)),
    JSON.stringify((art.body || {}).art));

  /* ------------------------------------- the console deals, one at a time */

  const one = await act('draw');
  check('the console can turn a card', one.status === 200, `${one.status}`);
  const afterOne = (await host('/api/host/state')).body || (await stateFor(alpha));
  check('exactly one card is turned by one press',
    ((await stateFor(alpha)).calledCount ?? afterOne.calledCount) === 1,
    `calledCount: ${(await stateFor(alpha)).calledCount}`);

  // Deal the rest of the deck down, marking as we go, and stop at the winner.
  let turned = 1;
  let winnerAt = 0;
  for (let i = 0; i < 60 && !winnerAt; i += 1) {
    for (const who of [alpha, bravo]) {
      const s = await stateFor(who);
      for (const sq of s.card || []) {
        if (sq.called && !sq.marked) {
          await phone('/api/mark', {
            playerId: who.playerId || who.id, token: who.token, index: sq.index, marked: true,
            ...(joinCode ? { joinCode } : {}),
          });
        }
      }
      const after = await stateFor(who);
      if ((after.you || {}).squaresAway === 0) { winnerAt = turned; break; }
    }
    if (winnerAt) break;
    const more = await act('draw');
    if (more.status !== 200 || more.body === null) break;
    turned += 1;
  }

  check('somebody completes a hand before the deck runs out', winnerAt > 0 && winnerAt <= 52,
    `after ${winnerAt} cards`);
  check('and it took a realistic number of cards, not two and not all fifty-two',
    winnerAt >= 13 && winnerAt <= 52, `${winnerAt} cards turned`);

  /* --------------------------------------- the deck cannot deal past itself */

  let guard = 0;
  while (guard < 70) {
    const r = await act('draw');
    if (r.status !== 200 || r.body === null || r.body === false) break;
    guard += 1;
  }
  const finalState = await stateFor(alpha);
  check('the deck never deals more than fifty-two',
    (finalState.calledCount || 0) <= 52, `calledCount: ${finalState.calledCount}`);
  check('and no card is ever turned twice',
    new Set(((await host('/api/state?role=host')).body.called || []).map((c) => c.id)).size
      === ((await host('/api/state?role=host')).body.called || []).length);

  /* ------------------------------- music bingo did NOT gain a randomiser */

  const bingoPack = (library.bingo || [])[0];
  if (bingoPack) {
    await act('launch', { game: 'bingo', packId: bingoPack.id, replace: true });
    const drew = await act('draw');
    check('music bingo has no Draw — there the host chooses the record',
      !(drew.status === 200 && drew.body && drew.body.ok !== false && drew.body !== true),
      `answered ${drew.status} ${JSON.stringify(drew.body)}`);
  }
} finally {
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
