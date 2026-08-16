/**
 * BINGO PAYS OUT, AND IT PAYS BY STAGE.
 *
 * *"Bingo should get prizes as well — as defined by the venue. My 5x5 rounds
 * usually give a prize for 1, 3 and 5 lines but this should be customisable."*
 *
 * **The engine never needed changing and that was checked before anything was
 * built**: `state.stages` has always been an arbitrary list, and `stagePlan(n)`
 * is only the DEFAULT generator — it is the thing that made stages consecutive
 * (1, 2, 3), which is exactly why 1, 3, 5 could not be expressed.
 *
 * What is new is the paying out. The two games differ in one way that matters
 * and is asserted here: **a quiz issues to a board ROW and bingo issues per
 * STAGE.** A quiz team of six gets one drink between them; a bingo player who
 * takes a line early and the full house later has won two prizes, on purpose.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BingoGame, stageLabel, cardLines } from '../src/bingo.js';
import { mintVoucher, redeemVoucher, reinstateVoucher } from '../src/vouchers.js';

const BINGO = readFileSync(new URL('../src/bingo.js', import.meta.url), 'utf8');
const PLAY_BINGO = readFileSync(new URL('../public/assets/play-bingo.js', import.meta.url), 'utf8');

const pack = () => ({
  id: 'p', title: 'A pack', cardSize: 5,
  tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, title: `Song ${i}`, artist: `A${i}` })),
});

/** A 5x5 game paying at 1, 3 and a full house, with one player marked up. */
function nightWithPrizes({ stages = [1, 3, 'full'], stagePrizes = ['A bottle of wine', 'Two pints', 'A £20 tab'] } = {}) {
  const g = new BingoGame({ pack: pack(), now: () => 1000 });
  g.state.stages = stages;
  g.state.stagePrizes = stagePrizes;
  g.state.stageIndex = 0;
  g.state.venue = 'The Bingo Arms';
  g.syncTarget();
  const { id } = g.join({ name: 'Team Bingo' });
  g.start();
  // Call everything and mark the whole card, so any stage is winnable.
  for (const t of g.tracks) g.call(t.id);
  const p = g.state.players[id];
  p.marks = p.card.map(() => true);
  return { g, id };
}

test('THE HOST\'S OWN EXAMPLE — a 5x5 pays at 1, 3 and a full house', () => {
  const { g } = nightWithPrizes();
  assert.equal(cardLines({ rows: 5, cols: 5 }).length, 12, 'a 5x5 has 12 lines, so 5 lines is not a full house');
  assert.deepEqual(g.stages.map(stageLabel), ['a line', '3 lines', 'a full house']);
});

test('winning a stage mints a voucher carrying THAT stage\'s prize', () => {
  const { g, id } = nightWithPrizes();
  g.claim(id);
  const [v] = Object.values(g.state.vouchers);
  assert.ok(v, 'no voucher — bingo did not pay out');
  assert.equal(v.reward, 'A bottle of wine');
  assert.equal(v.venue, 'The Bingo Arms');
  // The place is a PHRASE, not a number: "1st" would be a lie on a full house
  // won after two other prizes.
  assert.equal(v.place, 'a line');
});

test('the winner\'s phone is told, and nobody else\'s is', () => {
  const { g, id } = nightWithPrizes();
  g.claim(id);
  const { id: other } = g.join({ name: 'Somebody Else' });
  const mine = g.playerView(id);
  assert.ok(mine.voucher, 'THE WINNER WAS NOT TOLD');
  assert.equal(mine.voucher.reward, 'A bottle of wine');
  assert.equal(g.playerView(other).voucher, undefined, 'somebody else was offered the code');
  // And never on the projector — it is a credential, and the bar has no login.
  assert.ok(!JSON.stringify(g.screenView()).includes(mine.voucher.code));
});

/*
 * THE DIFFERENCE FROM THE QUIZ, and the reason the idempotency key is not the
 * player: a line early and the full house later is TWO prizes to one person.
 */
test('one player can win more than one stage in a round', () => {
  const { g, id } = nightWithPrizes();
  g.claim(id);
  g.playOn();
  g.claim(id);
  const codes = Object.values(g.state.vouchers);
  assert.equal(codes.length, 2, 'the second prize was swallowed');
  assert.deepEqual(codes.map((v) => v.reward), ['A bottle of wine', 'Two pints']);
  // The phone shows the most recent — it is a thing you hold up NOW.
  assert.equal(g.playerView(id).voucher.reward, 'Two pints');
});

test('claiming the same stage twice does not mint a second code', () => {
  const { g, id } = nightWithPrizes();
  g.claim(id);
  g.claim(id);
  assert.equal(Object.values(g.state.vouchers).length, 1);
});

test('a stage with no prize on it issues nothing at all', () => {
  const { g, id } = nightWithPrizes({ stagePrizes: ['', '', ''] });
  g.claim(id);
  assert.equal(Object.keys(g.state.vouchers || {}).length, 0,
    'an ordinary bingo night gained a voucher it should not have');
  assert.equal(g.playerView(id).voucher, undefined);
});

test('the host can see the codes, to redeem one by hand', () => {
  const { g, id } = nightWithPrizes();
  g.claim(id);
  const view = g.hostView();
  assert.equal((view.vouchers || []).length, 1,
    'the control view cannot see them, so a bar phone that will not scan is a dead end');
});

/*
 * THE SAME TWO CALLS THE QUIZ MAKES. The redeem route and the /v page call
 * `session.engine.redeemVoucher()` and have never asked which game is running.
 */
test('redeeming works the same way it does on a quiz night', () => {
  const { g, id } = nightWithPrizes();
  g.claim(id);
  const code = Object.keys(g.state.vouchers)[0];
  assert.equal(g.redeemVoucher(code, { by: 'scan' }).ok, true);
  assert.equal(g.redeemVoucher(code, { by: 'scan' }).reason, 'already', 'a copy of the code was worth something');
  assert.equal(g.reinstateVoucher(code).ok, true);
  assert.equal(g.state.vouchers[code].reinstated, 1);
  assert.equal(g.redeemVoucher('NOTACODE').reason, 'unknown');
});

test('the shared module is what both engines use', () => {
  assert.match(BINGO, /from '\.\/vouchers\.js'/, 'bingo has its own copy of the voucher rules');
  // A pure check of the shared half, so the module is exercised and not just
  // imported: two copies is two rules, and the day one is fixed is the day a
  // bar scans a code that works on one night and not the other.
  const state = {};
  const v = mintVoucher(state, { key: 'k', winnerId: 'w', name: 'N', reward: 'R', at: 1 });
  assert.equal(mintVoucher(state, { key: 'k', winnerId: 'w', name: 'N', reward: 'R', at: 2 }), null);
  assert.equal(redeemVoucher(state, v.code, { at: 2 }).ok, true);
  assert.equal(reinstateVoucher(state, v.code, { at: 3 }).ok, true);
});

/*
 * AND THE HALF A UNIT TEST CANNOT RUN. Both were broken on the quiz side when
 * first written and both were found in a browser: a payload with a voucher in
 * it that nothing draws, and a screen that is never rebuilt to draw it.
 */
test('the bingo phone actually draws the card, and rebuilds for it', () => {
  assert.match(PLAY_BINGO, /\$\{voucherCard\(s\)\}/,
    'the voucher is in the payload and no bingo phone draws it');
  const key = PLAY_BINGO.slice(PLAY_BINGO.indexOf('export function bingoKey('), PLAY_BINGO.indexOf('\n}', PLAY_BINGO.indexOf('export function bingoKey(')));
  assert.match(key, /s\.voucher/,
    'a code arriving does not change the key, so the screen is never rebuilt and the QR never draws');
});
