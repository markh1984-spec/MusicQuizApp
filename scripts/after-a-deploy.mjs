#!/usr/bin/env node
/**
 * AFTER A DEPLOY, CAN THE HOST STILL LAUNCH? — the check that was missing.
 *
 * ---
 *
 * On 17 September 2026 a gig was lost to this, and every guard in the repo was
 * green while it happened. The sequence is nine lines long and every step is
 * ordinary:
 *
 *  1. a push deploys, the server restarts, and Render's free tier wipes
 *     `data/`;
 *  2. `boot()` always builds a game so the projector is never blank, so the
 *     room comes back around `pickPack()`'s first pack — *2006 Intros*, top of
 *     the list by title — with `launched: false`, a lobby and a join code;
 *  3. the pub joins it, because the code is on the wall and the QR is printed;
 *  4. `inProgress()` counts the phones, does not ask whether anybody launched,
 *     and reports a night in progress;
 *  5. every tap on the launch bar fires `switchIfFree()`, which sends no
 *     `replace`, so the route answers 409 — and the quiet launch swallows it
 *     BY DESIGN;
 *  6. so nothing moves, nothing is said, and the live line goes on naming a
 *     quiz nobody chose: *"every single one is launching 2006 intros… the
 *     console isn't changing state."*
 *
 * Every existing guard starts from a room it launched itself, so none of them
 * has ever been in the state a deploy leaves behind. **This one starts where a
 * deploy starts: a cold room, phones in it, and a host who needs to launch.**
 *
 *   node scripts/after-a-deploy.mjs
 */

import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';

const KEY = 'after-a-deploy-key';
const { base: B, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy Rascal', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

let fails = 0;
const check = (name, ok, note = '') => {
  if (!ok) fails += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${note ? `\n        ${note}` : ''}`);
};
/*
 * A REAL SIGNED-IN QUIZMASTER, NOT THE HOST KEY — and that is not fussiness.
 *
 * The first version of this guard used the key, which is the HOUSE room, and
 * the house room has no join code: every phone it sent `g: ''` to landed there
 * by the documented *no code at all is still the house room* fallback, so the
 * check passed while proving nothing about the room a gig runs in. This repo's
 * oldest lesson, wearing the newest hat.
 *
 * And the field is `joinCode`, which is what `play.js` actually posts. A phone
 * sending anything else is a phone with no code on it.
 */
let cookie = '';
const H = () => ({ 'content-type': 'application/json', cookie });
const call = async (route, opts) => {
  const res = await fetch(B + route, opts);
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};
const running = async () => (await call('/api/library', { headers: H() })).body.running;
const joinAs = (name, code) => call('/api/join', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name, joinCode: code }),
});

try {
  console.log('\nA ROOM THE WAY A DEPLOY LEAVES IT\n');

  const signIn = await fetch(B + '/api/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }),
  });
  cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  check('a quizmaster can sign in at all', signIn.status === 200 && !!cookie);

  const cold = await running();
  check('the projector is never blank — a pack is loaded', !!cold.packId, `loaded "${cold.title}"`);
  check('…and it is NOT a night, because nobody launched it', cold.launched === false);

  /*
   * THE PUB JOINS IT. This is not a contrived step: the join code is on the
   * projector and read out on the mic, so a room that walks in during the gap
   * between a deploy and a launch joins whatever is up.
   */
  check('…and it is showing a join code, so the room can get in', !!cold.joinCode);
  for (const name of ['Dave', 'The Quizzinators', 'Table Six']) await joinAs(name, cold.joinCode);
  const filled = await running();
  check('three phones are in the lobby nobody launched', filled.playerCount === 3, `${filled.playerCount} in the room`);

  /*
   * AND NOW THE PROTECTED SURFACE: a tap on a pack tile. It carries no
   * `replace` and its 409 is swallowed, so a refusal here is silent — which is
   * exactly why this has to be asserted on the STATUS and not on the screen.
   */
  const tap = await call('/api/host/launch', {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ game: 'bingo', packId: 'mbc-5', venue: 'The Station Tap, Wokingham', shape: { rows: 5, cols: 5 }, prizes: 5, breakPlan: {} }),
  });
  check('tapping a pack puts it on the big screen', tap.status === 200,
    tap.status === 409 ? `409 — ${(tap.body || {}).error}` : `status ${tap.status}`);
  const after = await running();
  check('…and the room really is on it now', after.packId === 'mbc-5' && after.launched === true,
    `room is on "${after.title}", launched ${after.launched}`);

  /*
   * THE OTHER HALF, which must not be lost to the fix: once somebody HAS
   * launched a night and there are phones in it, a second launch still has to
   * say what it is about to destroy.
   */
  for (const name of ['Dave', 'The Quizzinators']) await joinAs(name, after.joinCode);
  check('…and the phones are still in the room it replaced the lobby with',
    (await running()).playerCount === 2, `${(await running()).playerCount} in the room`);
  const over = await call('/api/host/launch', {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ game: 'bingo', packId: 'mbc-4', venue: 'The Station Tap, Wokingham', prizes: 5, breakPlan: {} }),
  });
  check('a night somebody DID launch still says what would be lost', over.status === 409,
    `status ${over.status}`);
  check('…and the refusal names the night and the count', over.status === 409
    && /MBC 5/.test((over.body || {}).error || '') && /2 playing/.test((over.body || {}).error || ''),
    (over.body || {}).error);

  const replaced = await call('/api/host/launch', {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ game: 'bingo', packId: 'mbc-4', replace: true, venue: 'The Station Tap, Wokingham', prizes: 5, breakPlan: {} }),
  });
  check('…and a second, deliberate press still gets through', replaced.status === 200);

  console.log(fails
    ? `\n${fails} thing${fails === 1 ? '' : 's'} a deploy would still cost you.\n`
    : '\nA deploy no longer stands between the host and a launch.\n');
} finally {
  stop();
}
process.exit(fails ? 1 : 0);
