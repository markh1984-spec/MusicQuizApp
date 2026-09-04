/**
 * Prizes, changed mid-game — a landlord changing what's on the bar, or a
 * host who typed the wrong thing at launch, should not have to wait for the
 * pack to be relaunched. `setRewards()` on either engine just overwrites
 * `state.rewards`, and that is provably safe because a voucher is only ever
 * minted by reading `rewardList()` at the moment a prize is actually won —
 * there is no separate frozen-at-launch copy anywhere to go stale.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine } from '../src/engine.js';
import { BingoGame } from '../src/bingo.js';
import { Session } from '../src/session.js';

const QUIZ = {
  id: 'q', title: 'A Quiz', questionSeconds: 20,
  rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
    { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] }],
};

function makeBingoPack(trackCount = 40, cardSize = 4) {
  return {
    id: 'test-bingo', title: 'Test Bingo', cardSize,
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}`,
    })),
  };
}

test('setRewards changes what a voucher issued AFTER it says', () => {
  const engine = new Engine({ quiz: QUIZ, now: () => Date.parse('2026-08-20T21:00:00.000Z') });
  engine.state.rewards = ['A bottle of wine'];
  const rob = engine.join({ name: 'Rob' });

  assert.equal(engine.setRewards(['A £20 bar tab']), true);
  assert.deepEqual(engine.state.rewards, ['A £20 bar tab']);

  engine.finish();
  const voucher = engine.playerView(rob.id).voucher;
  assert.equal(voucher.reward, 'A £20 bar tab', 'the voucher should carry the CHANGED prize, not the launch-time one');
});

test('a voucher already issued is not rewritten by a later change', () => {
  const engine = new Engine({ quiz: QUIZ, now: () => Date.parse('2026-08-20T21:00:00.000Z') });
  engine.state.rewards = ['A bottle of wine'];
  const rob = engine.join({ name: 'Rob' });
  engine.finish();
  const before = engine.playerView(rob.id).voucher.reward;

  engine.setRewards(['Something else entirely']);

  const after = engine.playerView(rob.id).voucher.reward;
  assert.equal(before, 'A bottle of wine');
  assert.equal(after, 'A bottle of wine', 'an already-issued voucher must not change under somebody holding it');
});

test('setRewards rejects non-array input rather than corrupting state', () => {
  const engine = new Engine({ quiz: QUIZ, now: () => Date.now() });
  engine.state.rewards = ['Something'];
  assert.equal(engine.setRewards('not a list'), false);
  assert.deepEqual(engine.state.rewards, ['Something'], 'a bad call must leave the existing list untouched');
});

test('setRewards caps entries and trims each one, same discipline as launch', () => {
  const engine = new Engine({ quiz: QUIZ, now: () => Date.now() });
  const long = 'x'.repeat(500);
  const many = Array.from({ length: 20 }, (_, i) => `  prize ${i}  `);
  engine.setRewards([...many, long]);
  assert.equal(engine.state.rewards.length, 10, 'capped at 10, same as the console ever offers labels for');
  assert.equal(engine.state.rewards[0], 'prize 0', 'trimmed, like every other text field in this app');
});

test('the bingo engine has the identical method, for the identical reason', () => {
  const game = new BingoGame({ pack: makeBingoPack(), now: () => Date.now() });
  game.state.rewards = ['A round of drinks'];
  const p = game.join({ name: 'Sharon' });
  game.start();

  game.setRewards(['A bar tab instead']);
  assert.deepEqual(game.state.rewards, ['A bar tab instead']);
  assert.ok(p, 'sanity: the player actually joined');
});

function withSession() {
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  return new Session({
    config: { dataDir: '/tmp', quizDir: '/tmp', bingoDir: '/tmp', advertDir: '/tmp' },
    store,
    onPush: () => {},
    now: () => Date.now(),
  });
}

test('session.run("setRewards") reaches whichever engine is loaded, quiz or bingo', () => {
  const quizSession = withSession();
  quizSession.build('quiz', QUIZ);
  const quizResult = quizSession.run('setRewards', { rewards: ['A quiz prize'] });
  assert.equal(quizResult, true);
  assert.deepEqual(quizSession.engine.state.rewards, ['A quiz prize']);

  const bingoSession = withSession();
  bingoSession.build('bingo', makeBingoPack());
  const bingoResult = bingoSession.run('setRewards', { rewards: ['A bingo prize'] });
  assert.equal(bingoResult, true);
  assert.deepEqual(bingoSession.engine.state.rewards, ['A bingo prize']);
});

/*
 * THE READ PATH, NOT JUST THE WRITE PATH — found by a live browser run, not
 * this file. `setRewards()` writing `state.rewards` correctly says nothing
 * about whether `hostView()` — the payload the Prizes popover actually reads
 * to fill in its fields — carries that field at all. It did not, for bingo:
 * the popover's own fallback to one blank row when `s.rewards` is empty made
 * a MISSING field look identical to an ordinary night with nothing set yet,
 * so it never threw and no existing test caught it. A host opening Prizes on
 * a real bingo night to fix one typo would press Save and silently wipe
 * every other prize that night was playing for. Exactly the "tested the
 * write, never checked the read" shape as the arcade board fault.
 */
test('hostView() carries rewards for BOTH games, not just the quiz', () => {
  const engine = new Engine({ quiz: QUIZ, now: () => Date.now() });
  engine.state.rewards = ['A bottle of wine', 'A bar tab'];
  assert.deepEqual(engine.hostView().rewards, ['A bottle of wine', 'A bar tab']);

  const game = new BingoGame({ pack: makeBingoPack(), now: () => Date.now() });
  game.state.rewards = ['Bingo line prize', 'Bingo full house prize'];
  game.join({ name: 'Sharon' });
  game.start();
  assert.deepEqual(game.hostView().rewards, ['Bingo line prize', 'Bingo full house prize'],
    'a bingo control view with no rewards field is what made the Prizes popover show an empty box and Save wipe every existing prize');
});

/*
 * ---- A PRIZE TYPED IN AFTER SOMEBODY HAS ALREADY WON IT ------------------
 *
 * Reported off a live night: *"my quiz and bingo winners on thursday didn't
 * receive a QR code"*. The whole chain is silent. A night launched with no
 * prize on the venue record issues no vouchers at all — `issueVouchers()`
 * returns on an empty list — so the winner's phone simply has no card on it,
 * which reads as the app being broken rather than as a setting nobody filled
 * in. The obvious thing a host does about that is press **Prizes** on the
 * control view and type them in. That did nothing, for ever, because both
 * `setRewards()` methods were written for the case where the prize changes
 * BEFORE anybody has won it — and both said so in a comment, which is how it
 * survived two engines and every test in this file.
 *
 * Verified by reintroducing the fault in each engine: drop the catch-up and
 * the two "gets it now" assertions fail while everything else stays green.
 */

test('a quiz prize typed in AT the final scores still reaches the winner', () => {
  const engine = new Engine({ quiz: QUIZ, now: () => Date.parse('2026-09-03T22:30:00.000Z') });
  const rob = engine.join({ name: 'Rob' });
  engine.start();
  while (engine.state.phase !== 'final') engine.next();

  // The night as it was launched: nothing on the venue, so nothing minted.
  assert.deepEqual(Object.values(engine.state.vouchers), [],
    'a night with no prizes set should mint nothing at all');
  assert.equal(engine.playerView(rob.id).voucher, undefined);

  // The host notices, presses Prizes, types one in.
  engine.setRewards(['A free drink']);
  const mine = engine.playerView(rob.id).voucher;
  assert.ok(mine, 'the winner got no voucher when the prize was typed in after the final scores');
  assert.equal(mine.reward, 'A free drink');
  assert.equal(mine.place, 1);

  // Pressing Save again must not mint a second code for the same hand.
  engine.setRewards(['A free drink']);
  assert.equal(Object.values(engine.state.vouchers).length, 1);
});

test('a bingo prize typed in after a line is won still reaches that winner', () => {
  const game = new BingoGame({ pack: makeBingoPack(), now: () => Date.parse('2026-09-03T21:00:00.000Z') });
  const sharon = game.join({ name: 'Sharon' });
  game.start();
  // Play every track on her card, mark them all, and claim the line.
  const player = game.state.players[sharon.id];
  player.card.forEach((trackId, i) => {
    game.call(trackId);
    game.mark({ playerId: sharon.id, index: i, marked: true });
  });
  assert.equal(game.claim(sharon.id).valid, true);
  assert.deepEqual(Object.values(game.state.vouchers || {}), [],
    'a bingo night with no prizes set should mint nothing at all');

  game.setRewards(['A free drink', 'A bottle of wine']);
  const mine = game.playerView(sharon.id).vouchers;
  assert.ok(mine && mine.length, 'the line winner got no voucher when the prize was typed in afterwards');
  assert.equal(mine[0].reward, 'A free drink');

  // Twice, and then with the wording corrected: still exactly one code.
  game.setRewards(['A free drink', 'A bottle of wine']);
  game.setRewards(['Two free drinks', 'A bottle of wine']);
  assert.equal(Object.values(game.state.vouchers).length, 1,
    'saving the prizes again minted a second code for a prize already in somebody hand');
});

/*
 * THE ROUND IS WHAT TELLS TWO LINE WINS APART. `newRound()` clears
 * `prizeWinners` and `stageIndex` and deliberately does NOT clear `vouchers`
 * — round one's line prize is still live at the bar — so a catch-up that
 * asked only "is there a voucher for stage 1" would refuse to pay round two.
 */
test('a second bingo round still pays its own line winner', () => {
  let clock = Date.parse('2026-09-03T21:00:00.000Z');
  const game = new BingoGame({ pack: makeBingoPack(), now: () => clock });
  const sharon = game.join({ name: 'Sharon' });
  game.state.rewards = ['A free drink', 'A bottle of wine'];

  const winALine = () => {
    game.start();
    const player = game.state.players[sharon.id];
    player.card.forEach((trackId, i) => {
      game.call(trackId);
      game.mark({ playerId: sharon.id, index: i, marked: true });
    });
    assert.equal(game.claim(sharon.id).valid, true);
  };

  winALine();
  assert.equal(Object.values(game.state.vouchers).length, 1);

  clock += 60 * 60 * 1000;
  game.newRound();
  winALine();
  assert.equal(Object.values(game.state.vouchers).length, 2,
    'the second round line winner was refused because round one had already been paid for stage 1');

  // And a Save in the middle of round two must still not duplicate either.
  game.setRewards(['A free drink', 'A bottle of wine']);
  assert.equal(Object.values(game.state.vouchers).length, 2);
});
