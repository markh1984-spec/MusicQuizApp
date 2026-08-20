/**
 * The Session's action dispatcher — `run(action, body)` — which is what every
 * button on the control view actually reaches.
 *
 * Found by a live browser run, not a unit test: `bingo.js`'s own
 * `redeemVoucher`/`reinstateVoucher` worked fine when called directly, and
 * every bingo test called them that way — so nothing caught that `run()`'s
 * `perGame` object only defined the two actions on the QUIZ branch. A bingo
 * night's "Put it back" button posted `reinstateVoucher` and got back
 * `{"error":"Unknown action: reinstateVoucher"}`, live, in front of the host.
 * That is the class of bug a test which never goes through the dispatcher
 * cannot see — see CLAUDE.md's "a test that never runs the artefact proves
 * nothing about it".
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Session } from '../src/session.js';

const START = 1_700_000_000_000;

function bingoPack(trackCount = 40) {
  return {
    id: 'test-bingo',
    title: 'Test Bingo',
    cardSize: 4,
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: `t${i + 1}`,
      title: `Track ${i + 1}`,
      artist: `Artist ${i + 1}`,
    })),
  };
}

/** A Session with a store that does nothing, like the other Session tests. */
function withSession() {
  let at = START;
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: '/tmp', quizDir: '/tmp', bingoDir: '/tmp', advertDir: '/tmp' },
    store,
    onPush: () => {},
    now: () => at,
  });
  return { session, tick: (ms) => { at += ms; } };
}

test('a bingo night can redeem and reinstate a voucher through run(), same as the quiz', () => {
  const { session } = withSession();
  session.build('bingo', bingoPack());
  session.engine.state.rewards = ['A round of drinks', 'A bottle of wine'];
  const p = session.engine.join({ name: 'Quizteam Aguilera' });
  const line = session.engine.lines()[0];
  for (const i of line) {
    session.engine.call(p.card[i]);
    session.engine.mark({ playerId: p.id, index: i, marked: true });
  }
  session.engine.claim(p.id);
  const [code] = Object.keys(session.engine.state.vouchers);
  assert.ok(code, 'the test needs a real voucher to check the dispatcher against');

  const redeemed = session.run('redeemVoucher', { code });
  assert.notEqual(redeemed, undefined, 'the host\'s "Mark it used" button reached "Unknown action"');
  assert.ok(session.engine.state.vouchers[code].redeemedAt);

  const reinstated = session.run('reinstateVoucher', { code });
  assert.notEqual(reinstated, undefined, 'the host\'s "Put it back" button reached "Unknown action"');
  assert.equal(session.engine.state.vouchers[code].redeemedAt, null);
});

test('the quiz keeps the same two actions through run(), unchanged by the move', () => {
  const quiz = {
    id: 'q', title: 'A Quiz', questionSeconds: 20,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  };
  const { session } = withSession();
  session.build('quiz', quiz);
  session.engine.state.rewards = ['A free drink'];
  const p = session.engine.join({ name: 'Quizteam Aguilera' });
  session.engine.start();
  session.engine.finish();
  const [code] = Object.keys(session.engine.state.vouchers);
  assert.ok(code);

  assert.notEqual(session.run('redeemVoucher', { code }), undefined);
  assert.ok(session.engine.state.vouchers[code].redeemedAt);
  assert.notEqual(session.run('reinstateVoucher', { code }), undefined);
  assert.equal(session.engine.state.vouchers[code].redeemedAt, null);
});
