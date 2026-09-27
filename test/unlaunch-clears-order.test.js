/**
 * UNLAUNCH ENDS THE WHOLE EVENING, NOT ONLY ITS CURRENT PART.
 *
 * Unlaunch is `resetAll`: the engine goes back to a fresh lobby with
 * `launched: false`. But the session kept `runningOrder`, `orderPos` and the
 * carried scores in memory, so the control view went on offering "Continue to
 * the bingo" over a night nobody was running — and pressing it launched part
 * two off the fresh state's night-wide facts: no venue, no prizes, no look.
 * O26 of the 23 September 2026 launch-path sweep (the known half).
 *
 * A plain launch already clears the order for exactly this reason; Unlaunch
 * is the other way a night ends by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { withServer } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const EMAIL = 'undo@x.com';
const PASSWORD = 'a-long-unlaunch-password';

test('Unlaunch mid-order leaves no part queued and no venue to lose', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/sign-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    assert.equal(res.status, 200, 'could not sign the quizmaster in');
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    const host = (action, body) => fetch(`${base}/api/host/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body || {}),
    }).then((r) => r.json().then((json) => ({ status: r.status, json })));
    const hostView = () => fetch(`${base}/api/state?role=host`, { headers: { Cookie: cookie } }).then((r) => r.json());

    const launched = await host('launchOrder', {
      replace: true, venue: 'The Undo Arms', rewards: ['A pint'],
      segments: [{ kind: 'quiz', order: [{ packId: '1980s-pop-music', round: 0 }] }, { kind: 'bingo', packId: 'mbc-5' }],
    });
    assert.equal(launched.status, 200, `the running order would not launch: ${JSON.stringify(launched.json)}`);
    assert.equal((await hostView()).runningOrder.total, 2);

    const stopped = await host('resetAll');
    assert.equal(stopped.status, 200);
    const view = await hostView();
    assert.equal(view.runningOrder, null, 'Unlaunch left the running order queued: the control view still offers Continue');

    const pressed = await host('advanceOrder');
    assert.ok(pressed.json.ok && pressed.json.ok.ok === false && pressed.json.ok.reason === 'no_more_parts',
      `Continue after Unlaunch launched a part of a night nobody is running: ${JSON.stringify(pressed.json).slice(0, 200)}`);
    assert.equal((await hostView()).game, 'quiz', 'the bingo part was launched after Unlaunch');
  }, {
    seed(dir) {
      const accounts = new Accounts(path.join(dir, 'accounts.json'));
      accounts.create({ email: EMAIL, password: PASSWORD, name: 'Undo', role: 'quizmaster', tier: 'gold', status: 'active' });
      accounts.save();
    },
  });
});
