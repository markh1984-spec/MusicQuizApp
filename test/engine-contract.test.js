/**
 * WHAT EVERY ENGINE MUST HAVE — because four of them went missing in one day.
 *
 * ---
 *
 * `session.js` and `server.js` reach into `this.engine` by name. Most of
 * those calls sit behind `this.kind === 'quiz'` or a `bingo` branch and are
 * unreachable elsewhere; the rest are SHARED, and a shared call into an
 * engine that does not have the method is a **500 from a button** — which is
 * exactly what `bingo.js` paid for once, when `removeIdle` was one dispatch
 * for both engines and `removeIdlePlayers()` did not exist on it.
 *
 * Adding a third game found four more in an afternoon, and one of them was
 * not a button at all:
 *
 *  - **`touch()`, which `/api/stream` calls for every phone that connects.**
 *    Without it the SSE route threw and every phone on a DJ set got a 500
 *    instead of a live connection — the game completely dead, in silence,
 *    with every payload correct when asked for directly. `npm test` was
 *    green. It was found by opening the page in a real browser.
 *  - **`playerList()`, which `inProgress()` counts** before anything may
 *    launch over a running game — so starting a second set, or launching a
 *    QUIZ over one, threw on the protected launch path.
 *  - `removeIdlePlayers()`, `setRewards()` and four more off the shared host
 *    dispatch, reachable from a quiz control view left open in another tab.
 *
 * **SO THE CONTRACT IS WRITTEN DOWN AND CHECKED, rather than discovered.**
 * The list below is the one a new engine has to satisfy, and the second half
 * of this file is what keeps the list honest: every name `session.js` and
 * `server.js` actually reach for must be either in the contract or in the
 * per-kind list, so a new call site fails HERE and forces the decision —
 * two lists that mean one thing, the pattern `GAME_KINDS`/`LAUNCHERS`
 * already runs on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Engine } from '../src/engine.js';
import { BingoGame } from '../src/bingo.js';
import { DjSet } from '../src/dj.js';

/** Every engine answers all of these, whatever game it is. */
const CONTRACT = [
  // the three views and the record
  'screenView', 'playerView', 'hostView', 'results',
  // the room
  'join', 'touch', 'playerList', 'everyone', 'removePlayer', 'renamePlayer',
  'removeIdlePlayers', 'resetAll', 'changed',
  // the shared host dispatch — see `run()` in session.js
  'setRewards', 'redeemVoucher', 'reinstateVoucher',
  // a phone's shared actions — see `runPlayerAction()`
  'arcadeScore',
];

/**
 * ONLY EVER REACHED BEHIND A `kind` CHECK. Each of these is named rather than
 * counted, so a call that escapes its branch shows up as a name missing from
 * both lists rather than as a 500 on a Thursday.
 */
const PER_KIND = {
  quiz: ['start', 'next', 'back', 'reveal', 'skipQuestion', 'redoQuestion', 'goTo',
    'setStartsIn', 'showScoreboard', 'showPhotoSlide', 'showAdvert', 'setOrganiser',
    'joinTeam', 'makeTeam', 'adjustScore', 'resetScores', 'finish', 'answer',
    'answerBreakout', 'wandered', 'msRemaining', 'isExpired', 'clampPointers', 'say'],
  bingo: ['start', 'call', 'uncall', 'undoLastCall', 'playOn', 'newRound', 'finish',
    'mark', 'claim', 'syncTarget'],
  /*
   * CARD BINGO IS MUSIC BINGO'S LIST PLUS EXACTLY ONE CALL.
   *
   * The two kinds run the SAME engine — `LAUNCHERS.cards` builds a
   * `BingoGame` — so spelling the shared half out again would be two lists
   * that have to be kept in step by hand, which is the fault this whole file
   * exists to catch. It is built from bingo's, and the ONE addition is named:
   * `drawNext`, the console turning a card over, which music bingo must never
   * gain because there the host chooses the record.
   */
  cards: null,   // filled in below, from bingo's
  dj: ['finish', 'notePhoto', 'request', 'played', 'bin', 'where'],
};
PER_KIND.cards = [...PER_KIND.bingo, 'drawNext'];

const ENGINES = {
  quiz: Engine.prototype,
  bingo: BingoGame.prototype,
  /*
   * The same prototype as bingo, deliberately — so every shared contract check
   * above runs against it a second time under its own name. If the two kinds
   * ever stop sharing an engine, this line is the one that has to change and
   * the checks carry on meaning what they meant.
   */
  cards: BingoGame.prototype,
  dj: DjSet.prototype,
};

for (const [kind, proto] of Object.entries(ENGINES)) {
  test(`${kind} answers every shared engine call`, () => {
    for (const name of CONTRACT) {
      assert.equal(typeof proto[name], 'function',
        `${kind} has no ${name}() — a shared call into it is a 500 from a button`);
    }
  });
}

test('every engine call in session.js and server.js is one of the two lists', () => {
  /*
   * READ AS TEXT, because the CLAIM is fired above — each name in `CONTRACT`
   * is asked of the real prototype. What this half catches is a NEW call site
   * appearing: `session.engine.somethingNew()` written into a shared path
   * with no entry anywhere, which is how all four of today's got in.
   */
  const src = fs.readFileSync(new URL('../src/session.js', import.meta.url), 'utf8')
    + fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const called = new Set([...src.matchAll(/\.engine\.(\w+)\s*\(/g)].map((m) => m[1]));
  assert.ok(called.size > 20, 'found almost no engine calls — this guard is measuring nothing');

  const known = new Set([...CONTRACT, ...Object.values(PER_KIND).flat()]);
  const strays = [...called].filter((name) => !known.has(name));
  assert.deepEqual(strays, [],
    'an engine method is called and is on neither list — is it shared, or behind a kind check?');
});

test('nothing is in BOTH lists, or the per-kind one is excusing nothing', () => {
  for (const [kind, names] of Object.entries(PER_KIND)) {
    for (const name of names) {
      assert.ok(!CONTRACT.includes(name),
        `${name} is in the contract and in ${kind}'s list — one of them is wrong`);
    }
  }
});
