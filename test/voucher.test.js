/**
 * The winner's prize, on their phone.
 *
 * Four things are worth being certain about, and only one of them is that it
 * works: the code must never reach the projector, a copy of it must be
 * worthless, an ordinary night must gain nothing at all, and the host must be
 * able to undo whatever the bar did.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES } from '../src/engine.js';

const QUIZ = {
  id: 'q', title: 'A Quiz', questionSeconds: 20,
  rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
    { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] }],
};

function withGame({ reward = '', teamPlay = false } = {}) {
  let at = Date.parse('2026-08-14T21:00:00.000Z');
  const engine = new Engine({ quiz: QUIZ, now: () => at });
  engine.state.reward = reward;
  engine.state.teamPlay = teamPlay;
  return { engine, tick: (ms) => { at += ms; } };
}

test('an ordinary night — no reward — issues nothing at all', () => {
  const { engine } = withGame();
  const p = engine.join({ name: 'Rob' });
  engine.finish();
  assert.deepEqual(engine.state.vouchers, {}, 'a night with no prize grew a voucher');
  assert.equal(engine.playerView(p.id).voucher, undefined,
    'a phone on an ordinary night gained a field it has never had');
});

test('the winner gets one, and it carries what the room was told', () => {
  const { engine } = withGame({ reward: 'A free drink at the bar' });
  engine.state.venue = 'The Station Tap';
  const rob = engine.join({ name: 'Rob' });
  engine.finish();
  const view = engine.playerView(rob.id);
  assert.ok(view.voucher, 'the winner was told nothing');
  assert.equal(view.voucher.reward, 'A free drink at the bar');
  assert.equal(view.voucher.venue, 'The Station Tap');
  assert.equal(view.voucher.name, 'Rob', 'a voucher with no name on it is not a voucher');
  assert.match(view.voucher.code, /^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/,
    'the code can spell a word or contains a character people mistype');
});

/*
 * THE CODE IS A CREDENTIAL — the bar has no login, so holding it is the whole
 * proof. That puts it in the same class as the answer key, and it follows the
 * same rule: one role's payload, built field by field.
 */
test('THE CODE IS NEVER ON THE PROJECTOR, AND NEVER ON ANYBODY ELSE"S PHONE', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  const rob = engine.join({ name: 'Rob' });
  const jo = engine.join({ name: 'Jo' });
  // Rob wins on the tie-break of having answered; force it plainly instead.
  engine.state.players[rob.id].score = 100;
  engine.finish();

  const screen = JSON.stringify(engine.screenView());
  const code = Object.values(engine.state.vouchers)[0].code;
  assert.ok(!screen.includes(code), 'the projector is showing the code to the whole room');
  assert.equal(engine.screenView().voucher, undefined);
  assert.equal(engine.playerView(jo.id).voucher, undefined,
    'somebody who did not win can read the winner’s code');
  assert.ok(engine.playerView(rob.id).voucher, 'the winner cannot see their own');
});

test('a copy of the code is worthless — the FIRST redeem wins', () => {
  const { engine, tick } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const code = Object.values(engine.state.vouchers)[0].code;

  const first = engine.redeemVoucher(code);
  assert.equal(first.ok, true);
  tick(60000);
  // The screenshot, arriving a minute later at the same endpoint.
  const second = engine.redeemVoucher(code);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already');
  assert.equal(second.voucher.redeemedAt, first.voucher.redeemedAt,
    'the second attempt moved the time, so the bar cannot tell when it really went');
});

test('the host can put it back, and it is counted', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const code = Object.values(engine.state.vouchers)[0].code;

  engine.redeemVoucher(code);
  assert.equal(engine.reinstateVoucher(code).ok, true);
  const v = engine.state.vouchers[code];
  assert.equal(v.redeemedAt, null, 'it is still spent after being put back');
  assert.equal(v.reinstated, 1);
  assert.equal(v.history.length, 2, 'the history has to survive for a queried bar tab');
  // And it works again afterwards, or putting it back achieved nothing.
  assert.equal(engine.redeemVoucher(code).ok, true);
  // Reinstating one that was never spent is a no-op rather than a crash.
  engine.reinstateVoucher(code);
  assert.equal(engine.reinstateVoucher(code).reason, 'not_redeemed');
});

test('an unknown code is refused without saying anything about the night', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const out = engine.redeemVoucher('ZZZZZZZZ');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'unknown');
  assert.equal(out.voucher, undefined);
});

/*
 * Back off the final and forward again is one press each way and a host will
 * do it. A second code minted for the same winner leaves the first one in
 * somebody's hand looking perfectly valid.
 */
test('going back and forward again does not mint a second code', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const first = Object.keys(engine.state.vouchers);
  engine.back();
  engine.finish();
  assert.deepEqual(Object.keys(engine.state.vouchers), first,
    'the winner is holding a code that is no longer the live one');
});

test('a TEAM gets one voucher between them, not one each', () => {
  const { engine } = withGame({ reward: 'A £50 bar tab', teamPlay: true });
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  const made = engine.makeTeam('The Quizzards');
  assert.equal(made.ok, true, 'the team was not made');
  const teamId = made.id;
  assert.equal(engine.joinTeam(a.id, teamId).ok, true);
  assert.equal(engine.joinTeam(b.id, teamId).ok, true);
  engine.finish();

  assert.equal(Object.keys(engine.state.vouchers).length, 1,
    'a team of six would redeem six drinks');
  const one = engine.playerView(a.id).voucher;
  const two = engine.playerView(b.id).voucher;
  assert.ok(one && two, 'somebody on the winning team was shown nothing');
  assert.equal(one.code, two.code, 'the team was handed two different codes');
});

test('a TIE gets one each, because the room watched it happen', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  engine.state.players[a.id].score = 100;
  engine.state.players[b.id].score = 100;
  engine.finish();
  assert.equal(Object.keys(engine.state.vouchers).length, 2,
    'the app picked a winner the projector did not');
});
