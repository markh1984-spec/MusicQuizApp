/**
 * SETTING THE PRIZES AFTER THE NIGHT HAS STARTED.
 *
 * Written after a real gig on 13 August 2026: the winners told the host at the
 * bar that no QR code had arrived. **Nothing was broken.** The prize is read
 * off the VENUE'S record at launch, so a night launched with no venue, with a
 * venue typed as free text, or with a venue whose record carries no prizes,
 * gets `rewards: []` — and `issueVouchers()` returns immediately.
 *
 * Frozen at launch that was unrecoverable: by the time anybody finds out, the
 * final scores are up and the only fix is running the night again. So prizes
 * can now be set from the control view, and at the final the codes mint where
 * the host is standing.
 *
 * The engine half is exercised for real here. The two halves that a unit test
 * cannot reach — the push that tells the phone, and the phone redrawing — were
 * driven in a browser, and BOTH were broken on the first attempt: the codes
 * minted and no phone was ever told, then the phone was told and kept the
 * board it already had. See `screenKey()` in play.js.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Engine, PHASES } from '../src/engine.js';
import { tidyRewards } from '../src/session.js';

const SESSION = readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
const PLAY = readFileSync(new URL('../public/assets/play.js', import.meta.url), 'utf8');
const HOST = readFileSync(new URL('../public/assets/host.js', import.meta.url), 'utf8');

const QUIZ = {
  id: 'test', title: 'A quiz', questionSeconds: 20,
  rounds: [{
    id: 'r1', type: 'text', title: 'One',
    questions: [{ id: 'q1', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }],
  }],
};

/** A night played to the final by one team, with whatever prizes were set. */
function nightAtFinal({ rewards = [] } = {}) {
  let t = 1000;
  const e = new Engine({ quiz: QUIZ, now: () => t });
  e.state.rewards = rewards;
  // `join()` returns the PLAYER, and its id field is `id`.
  const { id: playerId } = e.join({ name: 'The Winners' });
  e.start();
  e.next();
  t += 3000;
  e.answer({ playerId, option: 0 });
  while (e.state.phase !== PHASES.FINAL) e.next();
  return { e, playerId };
}

test('THE THURSDAY NIGHT — no prizes means no voucher and no QR', () => {
  const { e, playerId } = nightAtFinal();
  assert.equal(Object.keys(e.state.vouchers || {}).length, 0);
  assert.equal(e.playerView(playerId).voucher, undefined,
    'a phone was offered a voucher on a night that had no prizes');
});

/*
 * THE RESCUE. This is the whole feature: the scores are up, nobody has a code,
 * and the host types the prizes in.
 */
test('prizes set AT the final mint the codes there and then', () => {
  const { e, playerId } = nightAtFinal();
  e.state.rewards = tidyRewards(['A bottle of wine', 'Two pints']);
  e.issueVouchers();

  const codes = Object.values(e.state.vouchers);
  assert.equal(codes.length, 1, 'one team, one prize awarded');
  assert.equal(codes[0].reward, 'A bottle of wine');
  assert.equal(codes[0].place, 1);

  const view = e.playerView(playerId);
  assert.ok(view.voucher, 'THE WINNER WAS NOT TOLD — this is the whole bug');
  assert.equal(view.voucher.reward, 'A bottle of wine');
  assert.equal(view.voucher.code, codes[0].code);
});

test('pressing save twice does not mint a second code for the same winner', () => {
  const { e } = nightAtFinal();
  e.state.rewards = ['A bottle of wine'];
  e.issueVouchers();
  const first = Object.keys(e.state.vouchers)[0];
  e.issueVouchers();
  e.state.rewards = ['Something else entirely'];
  e.issueVouchers();
  const all = Object.keys(e.state.vouchers);
  assert.deepEqual(all, [first], 'a winner ended up holding two codes');
  /*
   * AND WHAT IS ALREADY ISSUED KEEPS ITS OWN WORDS. A voucher copies its
   * reward when it is made, so somebody holding a phone that says "a bottle of
   * wine" is never quietly re-pointed at something cheaper.
   */
  assert.equal(e.state.vouchers[first].reward, 'A bottle of wine');
});

test('prizes set BEFORE the final still work the ordinary way', () => {
  const { e, playerId } = nightAtFinal({ rewards: ['A bottle of wine'] });
  assert.ok(e.playerView(playerId).voucher, 'the normal path broke');
});

test('the prizes are tidied the same way whichever door they come in by', () => {
  assert.deepEqual(tidyRewards(['  A bottle   of wine  ']), ['A bottle of wine']);
  // Control characters out, and NO word filtering.
  assert.deepEqual(tidyRewards(['a\u0000b']), ['a b']);
  // MAX_REWARDS, shared with the venue record that authors them. The UI
  // offers three boxes; the cap itself is higher.
  assert.equal(tidyRewards(['1', '2', '3', '4']).length, 4);
  assert.equal(tidyRewards('one prize')[0], 'one prize');
  // A hyphen is not a control character — the first version of this helper
  // ate them and would have turned "Two-for-one" into "Two for one".
  assert.deepEqual(tidyRewards(['Two-for-one']), ['Two-for-one']);
});

/*
 * THE THREE HALVES A UNIT TEST CANNOT RUN, guarded as wiring.
 *
 * Each was broken when first written and each was found in a browser, not
 * here — which is why they are asserted at all rather than assumed.
 */
test('the action tells the phones and writes to disk', () => {
  const at = SESSION.indexOf('setPrizes: () => {');
  assert.ok(at > 0, 'the action has gone');
  const body = SESSION.slice(at, SESSION.indexOf('},', at));
  assert.match(body, /this\.engine\.changed\(\)/,
    'nothing pushes — the codes mint and no phone is ever told');
  assert.match(body, /this\.store\.flush\(\)/,
    'nothing flushes — the quiz milestone does not move when a voucher is minted at '
    + 'the final, so a restart would leave somebody holding a code the server has lost');
  assert.match(body, /PHASES\.FINAL.*issueVouchers/s, 'it does not mint at the final');
});

test('the phone REBUILDS when a voucher arrives without a phase change', () => {
  const at = PLAY.indexOf('function screenKey(');
  const body = PLAY.slice(at, PLAY.indexOf('\nfunction ', at + 10));
  assert.match(body, /s\.voucher/,
    'a voucher arriving mid-final is not in the key, so the board is not rebuilt and '
    + 'the QR never draws — the winner is at the bar with an empty screen');
  assert.match(body, /redeemedAt/,
    'a voucher being spent is also a rebuild with no phase change behind it');
});

test('the control view says it, all night, and can fix it', () => {
  assert.match(HOST, /function prizePanel\(/, 'no panel');
  assert.match(HOST, /\.\.\.prizePanel\(state\)/, 'the panel is built and never drawn');
  assert.match(HOST, /act\('setPrizes'/, 'the panel cannot save');
  // Bingo has no vouchers, so it must not grow a prize panel.
  const panel = HOST.slice(HOST.indexOf('function prizePanel('), HOST.indexOf('function voucherPanel('));
  assert.match(panel, /s\.game === 'bingo'\) return \[\]/, 'bingo would draw a panel it cannot use');
});
