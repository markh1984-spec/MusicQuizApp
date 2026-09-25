/**
 * A ROUND IS A GAME: ONE PRIZE PER PHONE PER ROUND, AND A NEW ROUND PUTS
 * EVERYBODY BACK IN — for music bingo as well as card bingo.
 *
 * Chosen by the host on 24 September 2026: *"I might just simplify it for
 * now — one prize per round and 9 songs on a bingo card, then as many rounds
 * as necessary."* This REVERSES the 22 September widening that made
 * `wonThisGame` game-long. That rule was built for a four-prize round, where
 * the best card is the favourite for every prize after the first; a one-prize
 * round has no "after the first". WITHIN a round the rule is unchanged, and
 * `bingo.test.js` still pins it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BingoGame } from '../src/bingo.js';
import { claimNow } from './helpers/claim-now.js';

function makePack() {
  return {
    id: 'test-bingo', title: 'Test Bingo', cardSize: 3,
    tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` })),
  };
}
function winWholeCard(game, player) {
  for (const [i, id] of player.card.entries()) {
    game.call(id);
    game.mark({ playerId: player.id, index: i, marked: true });
  }
}

test('on music bingo the table that won round one can win round two', () => {
  let now = 1_700_000_000_000;
  const game = new BingoGame({ pack: makePack(), now: () => (now += 1000), random: () => 0.37 });
  game.setRewards(['A pint']);
  game.start();
  const a = game.join({ name: 'Face Down' });
  game.join({ name: 'Paying Attention' });
  winWholeCard(game, a);
  const first = claimNow(game, a.id);
  assert.equal(first.valid, true);
  assert.notEqual(first.prize, false, 'round one paid');
  assert.equal(game.holdsAPrize(a.id), true, 'and within the round they stand down');
  game.newRound();
  assert.equal(game.holdsAPrize(a.id), false, 'a new round is a fresh game');
  const fresh = game.state.players[a.id];
  winWholeCard(game, fresh);
  const second = claimNow(game, a.id);
  assert.equal(second.valid, true);
  assert.notEqual(second.prize, false, 'round two paid the same table');
  assert.equal(Object.keys(game.state.vouchers).length, 2, 'two drinks, one per round');
});
