/**
 * A DECK HAS ONE STAGE, AND IT IS THE WHOLE HAND.
 *
 * Thirteen cards is one line of all thirteen, so a game of card bingo has one
 * prize — *one prize, and more prizes is more ROUNDS* — and the round is OVER
 * the moment a hand is completed. The launch only ever set stages for
 * `kind === 'bingo'`, so a deck kept the default two: the first hand was "a
 * line", the round was not over, the winner's code was HELD, and the host's
 * main button offered *Play on for a full house* — which paid a second pint
 * to the next hand in the same game. Found rehearsing three games of card
 * bingo the day of a gig. Eighth sighting of the kind test written when there
 * were two games; the answer is on the PACK (`everyRoundPays`), not the kind.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BingoGame, TARGETS } from '../src/bingo.js';
import { deckPack } from '../public/assets/deck.js';

function aDeckGame() {
  let t = 1000;
  const game = new BingoGame({ pack: deckPack(), now: () => (t += 1000), random: () => 0.37 });
  game.setRewards(['A pint']);
  game.start();
  return game;
}

/**
 * Turn cards, marking everybody's, until `who` can claim; return the claim.
 *
 * THE CLAIM IS CHECKED BEFORE THE DRAW. Two hands of thirteen come off one
 * deck of fifty-two, so one time in four the first hand completes on the
 * LAST card — at which point the second hand is complete too and the deck is
 * out. Drawing first broke out on the empty deck and never looked at the hand
 * in front of it, which made this file flake at exactly that rate.
 */
function playUntilClaim(game, who, everyone) {
  const markAll = () => {
    for (const id of everyone) {
      for (const sq of game.playerView(id).card || []) {
        if (sq.called && !sq.marked) game.mark({ playerId: id, index: sq.index, marked: true });
      }
    }
  };
  for (let i = 0; i < 60; i += 1) {
    markAll();
    if (game.playerView(who).canClaim) return game.claim(who);
    if (!game.drawNext()) break;
  }
  return null;
}

test('a deck round is one stage — the whole hand — not a line then a full house', () => {
  const game = aDeckGame();
  assert.deepEqual(game.stages, [TARGETS.FULL], `a deck was dealt the stages ${JSON.stringify(game.stages)}`);
  assert.equal(game.state.target, TARGETS.FULL);
});

test('the first completed hand ENDS the round and its code is on the phone at once', () => {
  const game = aDeckGame();
  const a = game.join({ name: 'Beer Pressure' }).id;
  const b = game.join({ name: 'Smarty Pints' }).id;
  const won = playUntilClaim(game, a, [a, b]);
  assert.ok(won && won.valid && !won.reason, `the first hand was not paid: ${JSON.stringify(won)}`);
  assert.equal(game.allPrizesGone, true, 'the round did not end on the first completed hand');
  const phone = game.playerView(a);
  assert.equal((phone.vouchers || []).length, 1, 'the winner\'s code was HELD from their phone');
  assert.equal(phone.vouchers[0].reward, 'A pint');
});

test('and a second hand in the SAME round takes nothing — one game, one pint', () => {
  const game = aDeckGame();
  const a = game.join({ name: 'Beer Pressure' }).id;
  const b = game.join({ name: 'Smarty Pints' }).id;
  playUntilClaim(game, a, [a, b]);
  const second = playUntilClaim(game, b, [a, b]);
  assert.ok(second && second.valid, 'a completed hand was not recognised as right');
  assert.equal(second.prize, false, 'a second hand in the same game of card bingo was PAID');
  assert.equal(Object.keys(game.state.vouchers || {}).length, 1, 'two drinks went out for one game');
  // New round is the way to a second prize, and it pays.
  game.newRound();
  const next = playUntilClaim(game, b, [a, b]);
  assert.ok(next && next.valid && !next.reason, `the next game did not pay: ${JSON.stringify(next)}`);
  assert.equal(Object.keys(game.state.vouchers).length, 2);
});
