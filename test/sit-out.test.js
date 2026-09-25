/**
 * SAT OUT — the host takes a phone out of the running for one round.
 *
 * *"If someone doesn't claim their bingo I need to be able to exclude them
 * from the running."* A card completes and nobody presses BINGO; three
 * tracks later that line is still a valid claim and would take the prize off
 * whoever genuinely just completed. Pub bingo's rule is that a bingo not
 * called before the next number is lost; here it is the HOST's call, one
 * press on the row, never automated. Per round, undone by Back in, and not a
 * prize — the drink stays on the table.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BingoGame } from '../src/bingo.js';
import { claimNow } from './helpers/claim-now.js';

function makePack(trackCount = 40, cardSize = 4) {
  return {
    id: 'test-bingo', title: 'Test Bingo', cardSize,
    tracks: Array.from({ length: trackCount }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` })),
  };
}
function makeGame() {
  let now = 1_700_000_000_000;
  return new BingoGame({ pack: makePack(), now: () => (now += 1000) });
}
/** Call every track on a player's first line for them, and mark it. */
function winLine(game, player) {
  for (const i of game.lines()[0]) {
    game.call(player.card[i]);
    game.mark({ playerId: player.id, index: i, marked: true });
  }
}

test('a phone sat out cannot claim, is told so, and the host row says so', () => {
  const game = makeGame();
  const a = game.join({ name: 'Face Down' });
  const b = game.join({ name: 'Paying Attention' });
  game.start();
  winLine(game, a);
  assert.equal(game.playerView(a.id).canClaim, true, 'the line is genuinely there');
  assert.deepEqual(game.sitOut(a.id), { ok: true });
  assert.equal(game.playerView(a.id).satOut, true, 'the phone is told');
  assert.equal(game.playerView(b.id).satOut, undefined, 'and only that phone');
  const row = game.hostView().players.find((p) => p.id === a.id);
  assert.equal(row.satOut, true, 'the control view marks the row');
  assert.equal(game.hostView().players.find((p) => p.id === b.id).satOut, undefined);
  const refused = claimNow(game, a.id);
  assert.deepEqual(refused, { ok: false, reason: 'sat_out' });
  assert.equal(game.state.claims.length, 0, 'nothing is recorded — no shout was made');
  assert.equal(game.holdsAPrize(a.id), false, 'sat out is not a prize');
});

test('Back in undoes it, and the claim then pays', () => {
  const game = makeGame();
  const a = game.join({ name: 'Face Down' });
  game.start();
  winLine(game, a);
  game.sitOut(a.id);
  assert.deepEqual(game.sitIn(a.id), { ok: true });
  assert.equal(game.playerView(a.id).satOut, undefined);
  const won = claimNow(game, a.id);
  assert.equal(won.valid, true);
  assert.notEqual(won.prize, false, 'paid');
});

test('it is for ONE round: a new round puts everybody back in', () => {
  const game = makeGame();
  const a = game.join({ name: 'Face Down' });
  game.start();
  game.sitOut(a.id);
  game.newRound();
  assert.equal(game.playerView(a.id).satOut, undefined);
  assert.equal(game.isSatOut(a.id), false);
});

test('a sat-out completed card counts as stuck, so the host is told the round has stalled', () => {
  const game = makeGame();
  const a = game.join({ name: 'Face Down' });
  const b = game.join({ name: 'Still Going' });
  game.start();
  winLine(game, a);
  assert.equal(game.hostView().stalled, undefined, 'a live completed card is not a stall');
  game.sitOut(a.id);
  assert.equal(game.hostView().stalled, 1, 'the one completed card cannot claim');
  assert.equal(game.hostView().noneLeft, undefined, 'b can still win');
  game.sitOut(b.id);
  assert.equal(game.hostView().noneLeft, true, 'nobody left at all');
});

test('an unknown phone is refused, and a state written before this existed reads as nobody sat out', () => {
  const game = makeGame();
  assert.equal(game.sitOut('nobody').ok, false);
  assert.equal(game.sitIn('nobody').ok, false);
  const a = game.join({ name: 'Old' });
  delete game.state.satOut;
  assert.equal(game.isSatOut(a.id), false);
  assert.equal(game.playerView(a.id).satOut, undefined);
});
