/**
 * THE HOST PAYS A CARD FROM ITS ROW, AND PAYS A TIE.
 *
 * Off a live night, 8 October 2026: two phones finished on the same song,
 * both rows read ✓, and *"two people won the prize at the same time and I
 * wasn't able to assign it by the looks of things?"* A ✓ only ever said the
 * card was complete — there was no way to pay one nobody pressed BINGO on,
 * and once one was approved the other was told the prize had gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BingoGame } from '../src/bingo.js';

function makePack() {
  return {
    id: 'test-bingo', title: 'Test Bingo', cardSize: 3,
    tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` })),
  };
}

function night({ rewards = ['A pint'], stages = ['full'] } = {}) {
  let now = 1_700_000_000_000;
  const game = new BingoGame({ pack: makePack(), now: () => (now += 1000), random: () => 0.41 });
  game.setRewards(rewards);
  game.state.stages = stages;
  game.syncTarget();
  game.start();
  return game;
}

// Marks every square; calls only the ones not called yet, in card order.
function completeCard(game, player) {
  for (const [i, id] of game.state.players[player.id].card.entries()) {
    if (!game.state.called.includes(id)) game.call(id);
    game.mark({ playerId: player.id, index: i, marked: true });
  }
}

// Two cards both complete by the time the first is paid — every song on
// either card called, both marked. What the host saw: two ✓ at once.
function twoOnOneSong(game, a, b) {
  const cardA = game.state.players[a.id].card;
  const cardB = game.state.players[b.id].card;
  for (const id of new Set([...cardA, ...cardB])) game.call(id);
  for (const p of [a, b]) {
    game.state.players[p.id].card.forEach((_, i) => game.mark({ playerId: p.id, index: i, marked: true }));
  }
}

test('a complete card nobody called is paid from its row', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  game.join({ name: 'Bea' });
  completeCard(game, a);
  assert.equal(game.hostView().players.find((p) => p.id === a.id).away, 0);
  const r = game.payCard(a.id);
  assert.equal(r.ok, true);
  assert.equal(game.state.lastWin.name, 'Archie');
  assert.equal(game.playerView(a.id).vouchers.length, 1, 'the code is on their phone');
  assert.equal(game.playerView(a.id).vouchers[0].reward, 'A pint');
});

test('a card that is not complete cannot be paid from its row', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  assert.equal(game.payCard(a.id).reason, 'not_complete');
  assert.equal(Object.keys(game.state.vouchers || {}).length, 0);
  assert.equal(game.payCard('nobody').reason, 'unknown_player');
});

test('a card waiting on the host is paid as an approval — one claim, not two', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  completeCard(game, a);
  game.claim(a.id);
  assert.equal(game.payCard(a.id).ok, true);
  assert.equal(game.state.claims.length, 1);
  assert.equal(game.hostView().claimsWaiting, undefined);
});

test('TWO ON ONE SONG: the host is offered the other card, and paying it is a second drink', () => {
  const game = night();
  const a = game.join({ name: 'First' });
  const b = game.join({ name: 'Second' });
  twoOnOneSong(game, a, b);
  game.claim(a.id);
  game.claim(b.id);
  game.approveClaim(a.id);
  const host = game.hostView();
  assert.deepEqual(host.tieCandidates.map((t) => t.name), ['Second'], 'the other card is named');
  assert.equal(game.state.claims.find((c) => c.playerId === b.id).tooLate, true, 'before the host pays it');

  const r = game.payCard(b.id);
  assert.equal(r.ok, true);
  assert.equal(r.tie, true);
  const codes = Object.values(game.state.vouchers);
  assert.equal(codes.length, 2, 'both phones hold a code');
  assert.deepEqual(codes.map((v) => v.reward), ['A pint', 'A pint'], 'the same drink for both');
  assert.deepEqual(codes.map((v) => v.place), [1, 1], 'both won the FIRST prize');
  assert.equal(game.playerView(b.id).won, true, 'the second phone is told it won');
  assert.equal(game.screenView().win.name, 'First & Second', 'the room sees both names');
  assert.equal(game.screenView().prizes[0].winner, 'First & Second');
  const late = game.state.claims.find((c) => c.playerId === b.id);
  assert.equal(late.tooLate, false);
  assert.equal(late.tie, true);
  assert.equal(game.hostView().tieCandidates, undefined, 'nobody left to offer');
  assert.ok(game.results().leaderboard.filter((r) => r.won).length === 2, 'both are filed as winners');
});

test('a tie does not move the NEXT prize along the list', () => {
  const game = night({ rewards: ['A pint', 'A half'], stages: ['full', 'full'] });
  const a = game.join({ name: 'First' });
  const b = game.join({ name: 'Second' });
  twoOnOneSong(game, a, b);
  game.payCard(a.id);
  game.payCard(b.id);
  assert.equal(game.state.prizesGiven, 1, 'a tie shares the prize, it does not use up the next one');
  game.playOn();
  const c = game.join({ name: 'Third' });
  completeCard(game, c);
  assert.equal(game.payCard(c.id).ok, true);
  const third = Object.values(game.state.vouchers).find((v) => v.winnerId === c.id);
  assert.equal(third.reward, 'A half', 'the next prize is still the next drink');
});

test('a card finished AFTER the prize went is not a tie', () => {
  const game = night();
  const a = game.join({ name: 'First' });
  const b = game.join({ name: 'Later' });
  completeCard(game, a);
  game.payCard(a.id);
  completeCard(game, b); // needed songs called after the win
  assert.equal(game.hostView().tieCandidates, undefined, 'not offered');
  assert.equal(game.payCard(b.id).reason, 'not_a_tie');
  assert.equal(Object.keys(game.state.vouchers).length, 1);
});

test('a tie is refused to a phone sat out, and gone once the host plays on', () => {
  const game = night({ rewards: ['A pint', 'A half'], stages: ['full', 'full'] });
  const a = game.join({ name: 'First' });
  const b = game.join({ name: 'Second' });
  twoOnOneSong(game, a, b);
  game.payCard(a.id);
  game.sitOut(b.id);
  assert.equal(game.hostView().tieCandidates, undefined);
  assert.equal(game.payCard(b.id).reason, 'sat_out');
  game.sitIn(b.id);
  assert.equal(game.hostView().tieCandidates.length, 1);
  game.playOn();
  assert.equal(game.hostView().tieCandidates, undefined, 'the stage has moved on');
});

test('RULE 1: who else had it complete is the host\'s alone', () => {
  const game = night();
  const a = game.join({ name: 'First' });
  const b = game.join({ name: 'Second' });
  twoOnOneSong(game, a, b);
  game.payCard(a.id);
  assert.equal(game.screenView().tieCandidates, undefined);
  assert.equal(game.playerView(b.id).tieCandidates, undefined);
  assert.equal(game.playerView(a.id).tieCandidates, undefined);
});
