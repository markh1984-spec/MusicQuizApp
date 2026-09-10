/**
 * ALL THE PRIZES ARE GONE — one break the room reaches together.
 *
 * Asked for in these words: *"they get it once they get the bingo, but I'd
 * prefer they all get them once the full house is claimed at the same time,
 * so there's an obvious break where they can all get their drinks at the same
 * time."*
 *
 * **THE TRAP THIS FILE EXISTS FOR is that `WON` is not the end of a round.**
 * That phase is set by EVERY successful claim, so a phone keying off it would
 * announce the break after the first line — twice too early on a three-prize
 * round, sending the room to the bar mid-game. The flag has to mean "the LAST
 * stage has been taken", which is two facts and neither on its own.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BingoGame, BINGO_PHASES, stagePlan, shapeFields } from '../src/bingo.js';

const START = Date.parse('2026-09-10T20:00:00.000Z');

const makePack = () => ({
  id: 'test-bingo',
  title: 'Test Bingo',
  tracks: Array.from({ length: 40 }, (_, i) => ({
    id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}`,
  })),
});

/**
 * A game set up the way tonight is: three prizes on a 5x5, at a venue that
 * actually put three drinks on the bar.
 *
 * **THE REWARDS ARE NOT OPTIONAL SCAFFOLDING.** `issueVoucher()` refuses to
 * mint a code for a prize the venue never offered, so a fixture without them
 * runs the whole round and hands out nothing — which is a real behaviour and
 * was mistaken for a broken test once already.
 */
function gameWith(prizes, shape = { rows: 5, cols: 5 }) {
  const pack = { ...makePack(), ...shapeFields(shape) };
  const game = new BingoGame({ pack, now: () => START });
  game.state.stages = stagePlan(prizes);
  game.setRewards(['A bottle of house red', 'A pint', 'A packet of crisps'].slice(0, prizes));
  return game;
}

const threePrizeGame = () => gameWith(3);

/** Play and mark every square in one of this player's lines. */
function winLine(game, player, lineIndex = 0) {
  for (const i of game.lines()[lineIndex]) {
    game.call(player.card[i]);
    game.mark({ playerId: player.id, index: i, marked: true });
  }
}

/** Play and mark this player's whole card. */
function winHouse(game, player) {
  player.card.forEach((id, i) => {
    game.call(id);
    game.mark({ playerId: player.id, index: i, marked: true });
  });
}

test('THE FIRST LINE DOES NOT END THE ROUND, however much the phase says WON', () => {
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  const b = game.join({ name: 'Table Two' });
  game.start();

  winLine(game, a);
  assert.equal(game.claim(a.id).valid, true);
  // The phase IS won — which is exactly why nothing may key off it.
  assert.equal(game.state.phase, BINGO_PHASES.WON);
  assert.equal(game.allPrizesGone, false, 'the break fired on the first line');
  assert.equal(game.playerView(a.id).prizesAllGone, undefined,
    'a winner was told to go to the bar with two prizes still to play for');
  assert.equal(game.playerView(b.id).prizesAllGone, undefined);
});

test('…and the winner still gets their code the instant they win it', () => {
  // The half that must NOT change: nobody loses their proof at the bar, and
  // "you got it" goes on meaning the prize on the table.
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  game.start();
  winLine(game, a);
  game.claim(a.id);
  const view = game.playerView(a.id);
  assert.equal((view.vouchers || []).length, 1, 'the instant voucher was lost');
  assert.ok(view.vouchers[0].code, 'a voucher with no code');
});

test('ONLY THE LAST PRIZE TURNS IT ON', () => {
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  const b = game.join({ name: 'Table Two' });
  game.start();

  // Stage one: a line.
  winLine(game, a);
  game.claim(a.id);
  assert.equal(game.allPrizesGone, false);
  game.playOn();

  // Stage two: two lines. Winning the whole card satisfies any stage.
  winHouse(game, b);
  game.claim(b.id);
  assert.equal(game.allPrizesGone, false, 'the break fired on the second of three');
  game.playOn();

  // Stage three: the full house, and the round is done.
  assert.equal(game.claim(b.id).valid, true);
  assert.equal(game.allPrizesGone, true, 'the last prize went and nothing said so');
});

test('AND EVERY PHONE IS TOLD, not only the winners\u2019', () => {
  /*
   * A room where half the phones say the round is over and the rest say
   * nothing does not get up together, which is the whole thing being asked
   * for. The flag is on the VIEW, so a player who won nothing still gets it.
   *
   * **THREE DIFFERENT WINNERS, because one player cannot take all three.**
   * `stillWithoutAPrize()` stands a holder down while anybody is still empty
   * handed — the rule that stops one good card winning the lot — so a fixture
   * where one table wins everything never reaches the last stage at all.
   */
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  const b = game.join({ name: 'Table Two' });
  const c = game.join({ name: 'Table Three' });
  const d = game.join({ name: 'Never Won A Thing' });
  game.start();

  for (const winner of [a, b, c]) {
    winHouse(game, winner);
    assert.equal(game.claim(winner.id).valid, true, `${winner.name} could not win`);
    if (winner !== c) game.playOn();
  }

  assert.equal(game.allPrizesGone, true, 'three prizes went and the round did not end');
  assert.equal(game.playerView(a.id).prizesAllGone, true, 'a winner was not told');
  assert.equal(game.playerView(d.id).prizesAllGone, true, 'the rest of the room was not told');
  // …and somebody who won nothing is not handed a voucher by the flag.
  assert.equal(game.playerView(d.id).vouchers, undefined);
});

test('A ONE-PRIZE ROUND ENDS ON ITS ONLY PRIZE', () => {
  // The edge the two-facts condition has to get right: on a single-prize game
  // the first stage IS the last one, so the break lands on the first claim.
  const game = gameWith(1, { rows: 3, cols: 3 });
  const a = game.join({ name: 'Only Table' });
  game.start();
  assert.equal(game.allPrizesGone, false, 'it was over before anybody played');
  winHouse(game, a);
  assert.equal(game.claim(a.id).valid, true);
  assert.equal(game.allPrizesGone, true);
});

test('a fresh round turns it back off', () => {
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  game.start();
  winHouse(game, a);
  game.claim(a.id); game.playOn();
  game.claim(a.id); game.playOn();
  game.claim(a.id);
  assert.equal(game.allPrizesGone, true);

  game.newRound();
  assert.equal(game.allPrizesGone, false, 'round two opened on "all the prizes have gone"');
  assert.equal(game.playerView(a.id).prizesAllGone, undefined);
});

test('an ordinary payload is untouched while the round is being played', () => {
  // Spread in only when true, like the draw and the comeback band — so a
  // phone's payload during play is byte-for-byte what it was.
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  game.start();
  assert.equal('prizesAllGone' in game.playerView(a.id), false);
});
