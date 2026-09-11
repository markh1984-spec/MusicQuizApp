#!/usr/bin/env node
/**
 * DOES A BINGO PRIZE ACTUALLY REACH THE PERSON WHO WON IT — over real HTTP,
 * with two phones, and across a part boundary?
 *
 * ---
 *
 * **`pub-unchanged.mjs` says nothing about any of this.** It reads `quizzes/`
 * and never loads a bingo pack, so an IDENTICAL on a bingo change is the guard
 * answering confidently about something it is not looking at — this repo's
 * oldest trap. `CLAUDE.md` says what to do instead in as many words: *drive two
 * real phones*.
 *
 * The three faults it was written for, all found in the September 2026 sweep
 * and all of them things a room sees:
 *
 *   1. **A second correct BINGO replaced the winner's name on the projector**
 *      while the prize stayed with the first. Bravo holds no prize, so nothing
 *      stood Bravo's button down; Bravo genuinely had a line a beat later,
 *      which is the ordinary thing that happens in a pub. `state.lastWin` was
 *      overwritten unconditionally, so the wall said "Bravo", Alpha's phone
 *      went back to "Press BINGO!", and `results()` filed both as winners.
 *   2. **The button lit up on ONE line when the prize needed two.** Every
 *      40-track pack ships 5x5 with five prizes, so this was every phone in
 *      the room, every round — 223.9 false calls a round at sixty players.
 *   3. **Pressing "Continue to the quiz" destroyed the bingo's vouchers.**
 *      `startOrderSegment()` builds a fresh engine; the code answered 200 from
 *      `/api/voucher` before the press and 404 after it, the bar could not
 *      redeem it, and the prize never reached Past gigs.
 *
 * Each one passes `npm test` on its own terms, and each one is only visible
 * from outside — which is what this script is: the app's own HTTP, the same
 * calls the phones and the control view make.
 *
 *   node scripts/bingo-prizes.mjs
 */

import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';

const KEY = 'bingo-prizes';
const OWNER = { email: 'prizes@example.com', password: 'bingo-prizes-password' };

const { Accounts } = await import('../src/accounts.js');
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Prize Check', role: 'owner' });

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

/* The control view's own path: `POST /api/host/<action>`, exactly as `act()`
   in `host.js` sends it. */
const act = (action, body = {}) => host(`/api/host/${action}`, body);

const phone = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

try {
  const library = (await host('/api/library')).body;
  const bingoPack = (library.bingo || library.bingoPacks || [])[0];
  const quizPack = (library.quizzes || [])[0];
  if (!bingoPack || !quizPack) throw new Error('the fixture library has no bingo or no quiz pack');

  /* ------------------------------------------------ a bingo, two prizes deep */

  const rewards = ['A bottle of wine', 'A pint on the house'];
  await act('launch', {
    game: 'bingo', packId: bingoPack.id, replace: true,
    // A line, then TWO lines, then the house — the middle stage is the one the
    // button used to light up for far too early, and 5x5 with several prizes
    // is what every 40-track pack ships as.
    shape: { rows: 5, cols: 5 }, prizes: 3, venue: 'The Guard Dog',
  });
  await act('setRewards', { rewards });

  const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';
  const alpha = (await phone(`/api/join${g}`, { name: 'Alpha' })).body;
  const bravo = (await phone(`/api/join${g}`, { name: 'Bravo' })).body;
  const chris = (await phone(`/api/join${g}`, { name: 'Chris' })).body;
  await act('start');

  const stateFor = async (who) => (await phone(
    `/api/state?role=player&playerId=${who.playerId || who.id}&token=${encodeURIComponent(who.token)}${joinCode ? `&g=${joinCode}` : ''}`,
  )).body;
  const screen = async () => (await phone(`/api/state?role=screen${joinCode ? `&g=${joinCode}` : ''}`)).body;
  const hostState = async () => (await host(`/api/state?role=host${joinCode ? `&g=${joinCode}` : ''}`)).body;

  const mark = (who, index) => phone('/api/mark', {
    playerId: who.playerId || who.id, token: who.token, index, marked: true, joinCode,
  });
  /*
   * THE HOST CALLS BY TRACK ID AND THE PHONE IS NEVER TOLD ONE — that is rule
   * 3's shape on a bingo card, so the mapping has to come off the control
   * view's own track list, which is exactly where a real host reads it.
   */
  const idsByTitle = new Map(((await hostState()).tracks || []).map((t) => [t.title, t.id]));
  const callSquare = (square) => act('call', { trackId: idsByTitle.get(square.title) });
  const claim = (who) => phone('/api/claim', {
    playerId: who.playerId || who.id, token: who.token, joinCode,
  });

  /*
   * PLAY A WHOLE CARD FOR EACH OF THEM. The host calls every track on it, so
   * both hold every line there is — which is exactly the situation the first
   * two faults live in and is not remotely unusual by the end of a round.
   */
  const playWholeCard = async (who) => {
    const s = await stateFor(who);
    for (const [i, square] of (s.card || []).entries()) {
      await callSquare(square);
      await mark(who, i);
    }
    return s;
  };

  await playWholeCard(alpha);
  const ready = await stateFor(alpha);
  check('a full line IS the first prize, and the button says so', ready.canClaim === true);
  const won = await claim(alpha);
  check('Alpha wins the first prize', Boolean(won.body && won.body.valid && won.body.prize !== false),
    JSON.stringify(won.body));

  const wall = await screen();
  check('the projector names Alpha', wall.win && wall.win.name === 'Alpha', JSON.stringify(wall.win || null));

  /* ------------------------------ and a second correct shout changes nothing */

  await playWholeCard(bravo);
  const late = await claim(bravo);
  check('Bravo really did have it — not a false alarm', Boolean(late.body && late.body.valid));
  check('but the prize had gone', late.body && late.body.prize === false, JSON.stringify(late.body));

  const wallAfter = await screen();
  check('THE PROJECTOR STILL NAMES ALPHA', wallAfter.win && wallAfter.win.name === 'Alpha',
    JSON.stringify(wallAfter.win || null));
  const alphaAfter = await stateFor(alpha);
  check("Alpha's own phone still says they got it", alphaAfter.won === true);
  const bravoAfter = await stateFor(bravo);
  check('and Bravo is not told they got it while holding nothing', bravoAfter.won === false);
  check('the button stands down for everybody while the prize is taken', bravoAfter.standDown === true);

  const hostNow = await hostState();
  const vouchers = hostNow.vouchers || [];
  check('exactly one voucher exists for the prize', vouchers.length === 1, `${vouchers.length}`);
  const code = vouchers[0] && vouchers[0].code;
  check('and it belongs to Alpha', vouchers[0] && vouchers[0].name === 'Alpha');

  /* ------------- and the button waits for the stage, not for one line ------- */

  /*
   * Prize two on this night is TWO lines. Chris has one — which is the state
   * every phone in a real room is in for most of a round — and the button used
   * to read "BINGO!" for all of them, because `hasMarkedPattern()` asked for
   * one line whatever the stage was. Simulated at sixty players: 223.9 false
   * calls a round, each one recorded against the player who made it.
   */
  await act('playOn');
  const stageTwo = await stateFor(chris);
  check('the night has moved on to the two-line prize',
    stageTwo.stage && stageTwo.stage.needs === 2, JSON.stringify(stageTwo.stage || null));

  const chrisCard = stageTwo.card || [];
  const cols = stageTwo.cardCols || 5;
  for (let i = 0; i < cols; i += 1) {
    await callSquare(chrisCard[i]);
    await mark(chris, i);
  }
  const oneLine = await stateFor(chris);
  check('ONE LINE IS NOT TWO: the BINGO button stays down', oneLine.canClaim === false,
    `canClaim ${oneLine.canClaim}, going for ${oneLine.stage && oneLine.stage.needs}`);
  const early = await claim(chris);
  check('and an early press is refused rather than banked',
    Boolean(early.body && early.body.valid === false), JSON.stringify(early.body));

  await playWholeCard(chris);
  const twoLines = await stateFor(chris);
  check('two lines IS the prize', twoLines.canClaim === true);

  /* ------------------------------------ the voucher survives a part boundary */

  const before = await phone(`/api/voucher?c=${code}${joinCode ? `&g=${joinCode}` : ''}`);
  check('the bar can look the code up while the bingo is on', before.status === 200);

  const orderLaunch = await act('launchOrder', {
    segments: [
      { kind: 'bingo', packId: bingoPack.id, shape: { rows: 5, cols: 5 }, prizes: 2 },
      // A round in a running order is `{ packId, round }` — one entry per
      // round, which is what `composeQuiz()` reads.
      { kind: 'quiz', order: [{ packId: quizPack.id, round: 0 }] },
    ],
    venue: 'The Guard Dog', rewards, replace: true,
  });
  const onOrder = (await host('/api/state?role=host')).body;
  check('a two-part night is actually running', Boolean(onOrder.runningOrder),
    `launchOrder answered ${orderLaunch.status} ${JSON.stringify(orderLaunch.body && orderLaunch.body.error || '')}`);

  const code2 = await (async () => {
    const jc = ((await host('/api/library')).body.running || {}).joinCode || '';
    const g2 = jc ? `?g=${jc}` : '';
    const a = (await phone(`/api/join${g2}`, { name: 'Alpha' })).body;
    await act('start');
    const hv0 = (await host(`/api/state?role=host${jc ? `&g=${jc}` : ''}`)).body;
    const idsByTitle2 = new Map((hv0.tracks || []).map((t) => [t.title, t.id]));
    const s = (await phone(`/api/state?role=player&playerId=${a.playerId || a.id}&token=${encodeURIComponent(a.token)}${jc ? `&g=${jc}` : ''}`)).body;
    for (const [i, sq] of (s.card || []).entries()) {
      await act('call', { trackId: idsByTitle2.get(sq.title) });
      await phone('/api/mark', { playerId: a.playerId || a.id, token: a.token, index: i, marked: true, joinCode: jc });
    }
    await phone('/api/claim', { playerId: a.playerId || a.id, token: a.token, joinCode: jc });
    const hv = (await host(`/api/state?role=host${jc ? `&g=${jc}` : ''}`)).body;
    return { code: (hv.vouchers || [])[0] && (hv.vouchers || [])[0].code, jc, who: a };
  })();

  check('the interlude issued a voucher', Boolean(code2.code));
  const g3 = code2.jc ? `&g=${code2.jc}` : '';
  const stillThere = await phone(`/api/voucher?c=${code2.code}${g3}`);
  check('…and it resolves before the host presses on', stillThere.status === 200, `${stillThere.status}`);

  const moved = await act('advanceOrder');
  const nowQuiz = (await host(`/api/state?role=host${g3}`)).body;
  check('the host really did move on to the quiz', nowQuiz.game === 'quiz',
    `${nowQuiz.game}, advanceOrder said ${JSON.stringify((moved.body || {}).ok)}`);

  const after = await phone(`/api/voucher?c=${code2.code}${g3}`);
  check('AND IT IS STILL A VOUCHER AFTER "Continue to the quiz"', after.status === 200,
    `${after.status} ${JSON.stringify(after.body)}`);
  const hostAfter = (await host(`/api/state?role=host${g3}`)).body;
  check("and the host's own voucher panel is not empty", (hostAfter.vouchers || []).length >= 1,
    `${(hostAfter.vouchers || []).length}`);

  /* ------------------------------------------------------------------------
   * AND THE PHONE CAN STILL SHOW IT — which is a different question from the
   * bar being able to scan it, and the one that was broken.
   *
   * `/api/voucher` resolving proves the CODE survived the part boundary. It
   * says nothing about whether the person holding the phone can produce it:
   * the quiz engine sent vouchers at `phase === FINAL` only, so a code won in
   * the bingo went off the screen the moment *Continue to the quiz* was
   * pressed and did not come back until the final scores — with the break, the
   * moment somebody actually walks to the bar, in the gap.
   *
   * Reported in these words: *"need the QR codes to all appear at the end and
   * not disappear until the bar has scanned them — that's the whole point!"*
   * --------------------------------------------------------------------- */
  const mePath = (extra = '') => `/api/state?role=player&playerId=${
    code2.who.playerId || code2.who.id}&token=${encodeURIComponent(code2.who.token)}${g3}${extra}`;
  const onPhone = (await phone(mePath())).body || {};
  check('THE WINNER CAN STILL SEE THEIR CODE ONCE THE QUIZ HAS STARTED',
    (onPhone.vouchers || []).length >= 1,
    `phase ${onPhone.phase}, ${(onPhone.vouchers || []).length} on the phone`);
  check('and it is the one the bar would scan',
    (onPhone.vouchers || []).some((v) => v.code === code2.code),
    JSON.stringify((onPhone.vouchers || []).map((v) => v.code)));

  /* A live question is the one screen it must NOT be on: twenty seconds and
     four options, and a QR code over them is the room looking down. */
  let midQuestion = {};
  for (let i = 0; i < 6 && midQuestion.phase !== 'question'; i += 1) {
    await act('next');
    midQuestion = (await phone(mePath())).body || {};
  }
  check('a question is actually up, or the next check proves nothing',
    midQuestion.phase === 'question', `stuck at ${midQuestion.phase}`);
  check('but NOT over a live question', !(midQuestion.vouchers || []).length,
    `phase ${midQuestion.phase}, ${(midQuestion.vouchers || []).length} drawn`);
} finally {
  stop();
}

console.log(failures ? `\n${failures} failed` : '\nthe bingo prize path holds, over real HTTP');
process.exit(failures ? 1 : 0);
