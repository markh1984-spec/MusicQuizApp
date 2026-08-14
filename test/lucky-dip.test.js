/**
 * The draw from the bottom half.
 *
 * **It is a retention feature and every test here is really about that.** A
 * table that works out by round three it cannot win has nothing left to stay
 * for, and a room that thins out at nine is worth less to the pub than one
 * that stays till eleven. So the thing being protected is not "a random
 * person wins something" — it is that the prize goes to somebody who was
 * STILL ANSWERING at the end, because that is the behaviour being paid for
 * and it is also what stops a name being called to a silent room.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES } from '../src/engine.js';

/** Ten questions in one round, so "answered in the last round" means something. */
const QUIZ = {
  id: 'q', title: 'A Quiz', questionSeconds: 20,
  rounds: [{
    id: 'r1', type: 'text', title: 'Round One',
    questions: Array.from({ length: 3 }, (_, i) => ({
      id: `q${i}`, prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0,
    })),
  }],
};

const PRIZES = ['A bar tab', 'A bottle of wine', 'A free drink at the bar'];

/**
 * `random` is injected like the clock so a draw can be asserted at all —
 * "it picked the right person" is not a thing you can check against
 * Math.random. 0 takes the first in the hat.
 */
function withGame({ rewards = PRIZES, pick = 0 } = {}) {
  let at = Date.parse('2026-08-14T21:00:00.000Z');
  const engine = new Engine({ quiz: QUIZ, now: () => at, random: () => pick });
  engine.state.rewards = rewards;
  return { engine, tick: (ms) => { at += ms; } };
}

/** Six players, so the bottom half is a real hat rather than one person. */
function joinSix(engine) {
  return ['Aguilera', 'Norfolk', 'Quizzly', 'Quizerables', 'Sofa King', 'Chance']
    .map((name) => engine.join({ name }));
}

/**
 * Play the round out. `stayers` answer every question; everybody else answers
 * the first one and then stops, which is exactly the table that gave up.
 */
function playIt(engine, tick, players, stayers) {
  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();
  for (let q = 0; q < 3; q++) {
    if (engine.state.phase !== PHASES.QUESTION) engine.next();
    tick(1000);
    for (const p of players) {
      const stayed = stayers.includes(p) || q === 0;
      // The top scorers answer correctly and early; the rest get it wrong.
      if (stayed) engine.answer({ playerId: p.id, optionIndex: players.indexOf(p) < 3 ? 0 : 1 });
    }
    engine.reveal();
    engine.next();
  }
  while (engine.state.phase !== PHASES.FINAL) engine.next();
}

test('THE DRAW ONLY REACHES SOMEBODY STILL ANSWERING AT THE END', () => {
  const { engine, tick } = withGame();
  const players = joinSix(engine);
  // The two at the bottom who stayed to the last question. Everybody else
  // answered question 1 and then gave up, which is the table this feature
  // exists to keep in the room.
  const stayed = [players[4], players[5]];
  playIt(engine, tick, players, stayed);

  const drawn = engine.state.luckyDip;
  assert.ok(drawn, 'no draw happened at all');
  const names = stayed.map((p) => p.name);
  assert.ok(names.includes(drawn.name),
    `drew ${drawn.name}, who had stopped answering — the whole point is that they stayed`);
});

test('it is the BOTTOM half — the winner can never be drawn', () => {
  const { engine, tick } = withGame();
  const players = joinSix(engine);
  playIt(engine, tick, players, players);          // everybody stays in

  const board = engine.leaderboard();
  const drawnRow = board.find((r) => r.name === engine.state.luckyDip.name);
  assert.ok(drawnRow.position > Math.ceil(board.length / 2),
    `drew ${drawnRow.name} at position ${drawnRow.position} of ${board.length}`);
});

test('NOBODY WINS TWICE — a prize already in your hand takes you out of the hat', () => {
  const { engine, tick } = withGame();
  const players = joinSix(engine);
  playIt(engine, tick, players, players);

  const winners = Object.values(engine.state.vouchers).map((v) => v.winnerId);
  assert.equal(new Set(winners).size, winners.length, 'somebody holds two codes');
});

test('the draw gets a real voucher the bar can scan, and it is NOT a placing', () => {
  const { engine, tick } = withGame();
  const players = joinSix(engine);
  playIt(engine, tick, players, players);

  const v = Object.values(engine.state.vouchers).find((x) => x.draw);
  assert.ok(v, 'the draw won nothing anybody could redeem');
  assert.equal(v.reward, PRIZES[2], 'the draw wins the third-place prize');
  assert.equal(v.place, null, 'a draw is not a position and must not read as one');

  // …and their own phone says so rather than calling them the winner.
  const mine = engine.playerView(v.winnerId);
  assert.equal(mine.voucher.draw, true);
  assert.equal(mine.voucher.place, null);
});

test('THE PROJECTOR GETS THE NAME AND NEVER THE CODE', () => {
  const { engine, tick } = withGame();
  const players = joinSix(engine);
  playIt(engine, tick, players, players);

  const screen = engine.screenView();
  assert.equal(screen.luckyDip.name, engine.state.luckyDip.name);
  // The code is the credential — the same rule as every other voucher.
  const said = JSON.stringify(screen);
  for (const v of Object.values(engine.state.vouchers)) {
    assert.ok(!said.includes(v.code), 'a voucher code reached the big screen');
  }
});

test('no third prize means no draw — nothing to give away', () => {
  const { engine, tick } = withGame({ rewards: ['A bar tab'] });
  const players = joinSix(engine);
  playIt(engine, tick, players, players);
  assert.equal(engine.state.luckyDip, undefined);
  assert.equal(engine.screenView().luckyDip, undefined, 'an ordinary night gained a field');
});

test('TWO IN THE HAT MINIMUM — one person is a gift, not a draw', () => {
  const { engine, tick } = withGame();
  const players = joinSix(engine).slice(0, 4);
  // Only the very last player stays in, so the hat holds one.
  playIt(engine, tick, players, [players[3]]);
  assert.equal(engine.state.luckyDip, undefined,
    'called it a draw in front of a room that could see there was one name in it');
});

test('DRAWN ONCE — Back off the final and forward again keeps the same name', () => {
  // A host will do this, and a second roll would name a different person to a
  // room that already heard the first.
  const { engine, tick } = withGame();
  const players = joinSix(engine);
  playIt(engine, tick, players, players);

  const first = { ...engine.state.luckyDip };
  const codes = Object.keys(engine.state.vouchers).length;
  engine.back();
  engine.next();

  assert.deepEqual(engine.state.luckyDip, first);
  assert.equal(Object.keys(engine.state.vouchers).length, codes, 'a second code was minted');
});

test('a night stopped early still runs its draw', () => {
  // finish() ends a night wherever it is — the people who stayed to the end
  // still stayed to the end, whenever the host decided the end was.
  const { engine, tick } = withGame();
  const players = joinSix(engine);
  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();
  tick(1000);
  for (const p of players) engine.answer({ playerId: p.id, optionIndex: players.indexOf(p) < 3 ? 0 : 1 });
  engine.finish();
  assert.ok(engine.state.luckyDip, 'a night stopped early ran no draw');
});

test('AN ORDINARY NIGHT GAINS NOTHING — no prizes, no draw, no new fields', () => {
  const { engine, tick } = withGame({ rewards: [] });
  const players = joinSix(engine);
  playIt(engine, tick, players, players);
  assert.equal(engine.state.luckyDip, undefined);
  assert.deepEqual(engine.state.vouchers, {});
  assert.equal('luckyDip' in engine.screenView(), false);
  assert.equal('luckyDip' in engine.playerView(players[0].id), false);
});
