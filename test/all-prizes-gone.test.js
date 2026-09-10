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

test('…and the code WAITS for the end of the round, then arrives', () => {
  /*
   * THIS REVERSES WHAT THIS TEST FIRST ASSERTED, and the reversal is the ask.
   * The first build sent the code the instant it was won and put the banner
   * on top of it, on an answer of "both" given before anybody had seen it.
   * One live night later: *"the QR codes should all appear at the end."*
   *
   * So the code is MINTED at the win — losing that would be the original
   * "my bingo winners didn't receive a QR code" complaint — and HELD from the
   * phone until the round is over. Both halves are checked here, because a
   * test that only looked at the phone could not tell "held" from "lost".
   */
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  const b = game.join({ name: 'Table Two' });
  const c = game.join({ name: 'Table Three' });
  game.start();
  winLine(game, a);
  game.claim(a.id);

  assert.equal(Object.values(game.state.vouchers).length, 1, 'the code was never minted');
  assert.equal(game.playerView(a.id).vouchers, undefined,
    'the code went up while two prizes were still to play for');
  assert.equal(game.hostView().vouchers.length, 1,
    'the host must still see it — they are who a blank phone asks');

  // Play the round out: the other two prizes go to the other two tables.
  game.playOn();
  winHouse(game, b);
  game.claim(b.id);
  game.playOn();
  winHouse(game, c);
  game.claim(c.id);

  assert.equal(game.allPrizesGone, true);
  const view = game.playerView(a.id);
  assert.equal((view.vouchers || []).length, 1, 'the held code never arrived');
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

  // Stage three needs a THIRD table: one prize each per round is absolute, so
  // b is out of the running having taken stage two.
  const c = game.join({ name: 'Table Three' });
  winHouse(game, c);
  assert.equal(game.claim(c.id).valid, true);
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
  const b = game.join({ name: 'Table Two' });
  const c = game.join({ name: 'Table Three' });
  game.start();
  // Three prizes now means three different tables — one each, absolutely.
  winHouse(game, a); game.claim(a.id); game.playOn();
  winHouse(game, b); game.claim(b.id); game.playOn();
  winHouse(game, c); game.claim(c.id);
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

/*
 * ONE PRIZE EACH PER ROUND, ABSOLUTELY — and the three ways a held code still
 * reaches the person holding it.
 *
 * Both were asked for off a live night: *"it needs to be so that the cards
 * don't give a more than one prize to any single phone, right now a single
 * person can win but it has weird block midway through"*, and *"the QR codes
 * should all appear at the end."*
 *
 * The second is the dangerous one. Holding a code back is one line; every one
 * of these is a way the round can END that is not the last prize landing, and
 * each is somebody standing at a bar with nothing to show if it is missed.
 */

test('the rule never lifts, however small the room', () => {
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  const b = game.join({ name: 'Table Two' });
  game.start();

  winHouse(game, a);
  game.claim(a.id);
  game.playOn();
  winHouse(game, b);
  game.claim(b.id);
  game.playOn();

  // Everybody in the room now holds a prize. The rule USED to lift here.
  const third = game.claim(a.id);
  assert.equal(third.valid, true, 'the call was right and must be recorded as right');
  assert.equal(third.prize, false, 'a second prize went to a phone that already had one');
  assert.equal(game.state.prizeWinners.length, 2);

  // And the phone is told which of the two stand-downs it is, so it can say
  // something other than a dead button.
  assert.equal(game.playerView(a.id).tookOne, true);
  assert.equal(game.playerView(b.id).tookOne, true);

  // The host is told the prize cannot be won at all — its own flag, because
  // "play on" is the wrong advice here and wrong advice is worse than none.
  assert.equal(game.hostView().noneLeft, true);
});

test('a code held back still arrives when the host FINISHES the round', () => {
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  game.start();
  winLine(game, a);
  game.claim(a.id);
  assert.equal(game.playerView(a.id).vouchers, undefined, 'held, correctly');

  game.finish();
  assert.equal((game.playerView(a.id).vouchers || []).length, 1,
    'finishing on an unwinnable round took a real drink off somebody');
});

test('a code held back still arrives once a NEW ROUND has started', () => {
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  game.start();
  winLine(game, a);
  game.claim(a.id);
  assert.equal(game.playerView(a.id).vouchers, undefined);

  // `newRound()` deliberately does not clear vouchers — so without the round
  // stamp on each one, round two would hold round one's code back for ever.
  game.newRound();
  assert.equal((game.playerView(a.id).vouchers || []).length, 1,
    'round two swallowed round one’s prize');
});

test('a voucher written before the round stamp existed still shows', () => {
  // The safe direction: every unsure case shows, because a held code is a
  // prize somebody standing at a bar cannot prove.
  const game = threePrizeGame();
  const a = game.join({ name: 'Table One' });
  game.start();
  winLine(game, a);
  game.claim(a.id);
  for (const v of Object.values(game.state.vouchers)) delete v.round;
  assert.equal((game.playerView(a.id).vouchers || []).length, 1,
    'an older state file lost its winner their code');
});
