/**
 * A BINGO PRESS WAITS FOR THE HOST, AND HIS YES DROPS THE CODE ON THE PHONE.
 *
 * Asked for on 25 September 2026: *"a bingo button needs to crop up or already
 * be there when they have a bingo, but it's a one press button per game and I
 * then validate my end or approve, on an approved bingo press the QR code for
 * the free drink is then dropped into their phone. They can win multiple free
 * drinks in an evening and if they win 2, these need to be separate QR codes
 * that they can redeem whenever they like."*
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

// One prize a round — the host's 3x3 night.
function night() {
  let now = 1_700_000_000_000;
  const game = new BingoGame({ pack: makePack(), now: () => (now += 1000), random: () => 0.41 });
  game.setRewards(['A pint']);
  game.state.stages = ['full'];
  game.syncTarget();
  game.start();
  return game;
}

function markWholeCard(game, player, { callIt = true } = {}) {
  for (const [i, id] of game.state.players[player.id].card.entries()) {
    if (callIt && !game.state.called.includes(id)) game.call(id);
    game.mark({ playerId: player.id, index: i, marked: true });
  }
}

test('a press pays nothing on its own — it waits for the host, and the phone says so', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  markWholeCard(game, a);
  assert.deepEqual(game.claim(a.id), { ok: true, pending: true });
  assert.equal(Object.keys(game.state.vouchers || {}).length, 0, 'no drink before the host says yes');
  assert.ok(!game.state.lastWin, 'and no winner on the projector');
  assert.equal(game.playerView(a.id).claimWaiting, true);
  const waiting = game.hostView().claimsWaiting;
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].name, 'Archie');
  assert.equal(waiting[0].checksOut, true);
});

test('ONE PRESS: pressing again while it waits adds nothing', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  markWholeCard(game, a);
  game.claim(a.id);
  assert.equal(game.claim(a.id).reason, 'waiting');
  assert.equal(game.state.claims.length, 1);
});

test('approved: the win is on the board and the code is on the phone AT ONCE', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  game.join({ name: 'Someone Else' });
  markWholeCard(game, a);
  game.claim(a.id);
  const r = game.approveClaim(a.id);
  assert.equal(r.valid, true);
  assert.equal(game.state.lastWin.name, 'Archie');
  const mine = game.playerView(a.id).vouchers;
  assert.equal(mine.length, 1, 'the code went to the phone the moment he approved');
  assert.equal(mine[0].reward, 'A pint');
  assert.equal(game.playerView(a.id).claimWaiting, undefined);
  assert.equal(game.hostView().claimsWaiting, undefined, 'nothing left for the host to decide');
});

test('turned down: a false call, sat out for the round, and Back in undoes it', () => {
  const game = night();
  const a = game.join({ name: 'Chancer' });
  markWholeCard(game, a, { callIt: false }); // marked, never played
  game.claim(a.id);
  const waiting = game.hostView().claimsWaiting[0];
  assert.equal(waiting.checksOut, false);
  assert.equal(waiting.unplayed.length, 9, 'the host is told which marked squares were never played');
  assert.equal(game.rejectClaim(a.id).valid, false);
  assert.equal(game.state.players[a.id].falseCalls, 1);
  const view = game.playerView(a.id);
  assert.equal(view.satOut, true, 'one press per round');
  assert.equal(view.claimRejected, true);
  assert.equal(game.claim(a.id).reason, 'sat_out');
  assert.equal(game.screenView().falseAlarm.name, 'Chancer', 'the room still gets its false alarm');
  game.sitIn(a.id);
  markWholeCard(game, a);
  assert.equal(game.claim(a.id).pending, true, 'back in, the press is live again');
});

test('the app\'s doubt is advice: the host may approve a card it cannot confirm', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  markWholeCard(game, a, { callIt: false }); // played off the DJ app, never tapped
  game.claim(a.id);
  assert.equal(game.approveClaim(a.id).valid, true);
  assert.equal(game.playerView(a.id).vouchers.length, 1);
});

test('nothing waiting is not an approval — a stale second press does nothing', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  assert.equal(game.approveClaim(a.id).reason, 'no_claim');
  assert.equal(game.rejectClaim(a.id).reason, 'no_claim');
});

test('two waiting on one prize: approving one tells the other it has gone', () => {
  const game = night();
  const a = game.join({ name: 'First' });
  const b = game.join({ name: 'Second' });
  markWholeCard(game, a);
  markWholeCard(game, b);
  game.claim(a.id);
  game.claim(b.id);
  assert.equal(game.hostView().claimsWaiting.length, 2);
  game.approveClaim(b.id);
  assert.equal(game.hostView().claimsWaiting, undefined);
  const late = game.state.claims.find((c) => c.playerId === a.id);
  assert.equal(late.tooLate, true);
  assert.equal(Object.keys(game.state.vouchers).length, 1, 'one prize, one drink');
});

test('RULE 1: a claim waiting on the host never reaches the projector', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  markWholeCard(game, a, { callIt: false });
  game.claim(a.id);
  const screen = game.screenView();
  assert.equal(screen.claimsWaiting, undefined);
  assert.equal(screen.falseAlarm, undefined, 'not a false alarm until the host says so');
  assert.equal(game.playerView(game.join({ name: 'Other' }).id).claimsWaiting, undefined);
});

test('TWO DRINKS IN AN EVENING ARE TWO SEPARATE CODES, both live until scanned', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  markWholeCard(game, a);
  game.claim(a.id);
  game.approveClaim(a.id);
  game.newRound();
  markWholeCard(game, a);
  game.claim(a.id);
  game.approveClaim(a.id);
  const mine = game.playerView(a.id).vouchers;
  assert.equal(mine.length, 2);
  assert.notEqual(mine[0].code, mine[1].code, 'each drink has its own QR');
  game.redeemVoucher(mine[0].code);
  const after = game.playerView(a.id).vouchers.filter((v) => !v.redeemedAt);
  assert.equal(after.length, 1, 'spending one leaves the other to spend whenever they like');
  assert.equal(after[0].code, mine[1].code);
});

test('Finish takes a waiting claim with it — it cannot reopen a finished night', () => {
  const game = night();
  const a = game.join({ name: 'Archie' });
  markWholeCard(game, a);
  game.claim(a.id);
  game.finish();
  assert.equal(game.hostView().claimsWaiting, undefined);
  assert.equal(game.approveClaim(a.id).ok, false);
  assert.equal(game.state.phase, 'finished');
});
