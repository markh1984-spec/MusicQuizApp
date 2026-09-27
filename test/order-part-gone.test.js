/**
 * A BINGO PACK DELETED MID-EVENING IS SAID IN WORDS, NOT AS A FILE PATH.
 *
 * A running order loads every part before anything launches, so a pack gone
 * BEFORE Launch is refused in a sentence. One gone AFTER — a push that
 * removed it, an own pack tidied away mid-quiz — met Continue with the raw
 * loader: `ENOENT: no such file or directory, open '/opt/render/…/mbc-5.json'`
 * as a 500, on the control view, in front of the room. A quiz part already
 * answered in words through `composeQuiz()`; the bingo part did not. O26 of
 * the 23 September 2026 launch-path sweep (the known half).
 *
 * The night stays where it was, so the host can put the pack back and press
 * again — or finish on the quiz.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { withServer } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const EMAIL = 'gone@x.com';
const PASSWORD = 'a-long-gone-password';

test('Continue onto a bingo pack that has since been deleted answers a sentence, never a path', async () => {
  await withServer(async (base, _seeded, dir) => {
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
      replace: true,
      segments: [{ kind: 'quiz', order: [{ packId: '1980s-pop-music', round: 0 }] }, { kind: 'bingo', packId: 'mbc-5' }],
    });
    assert.equal(launched.status, 200, `the running order would not launch: ${JSON.stringify(launched.json)}`);
    const before = await hostView();
    assert.equal(before.runningOrder && before.runningOrder.total, 2);

    // The evening's bingo pack goes, from the catalogue copy this app reads.
    const file = path.join(dir, 'bingo', 'mbc-5.json');
    assert.ok(fs.existsSync(file), 'the test does not know where the catalogue copy is');
    fs.unlinkSync(file);

    const pressed = await host('advanceOrder');
    assert.notEqual(pressed.status, 500, `Continue answered 500: ${JSON.stringify(pressed.json)}`);
    assert.equal(pressed.status, 400, `expected a refusal in words, got ${pressed.status}: ${JSON.stringify(pressed.json)}`);
    assert.doesNotMatch(String(pressed.json.error || ''), /ENOENT|\//, `a file path reached the control view: ${pressed.json.error}`);
    assert.match(String(pressed.json.error || ''), /no bingo pack called mbc-5 any more/i);

    const after = await hostView();
    assert.equal(after.game, 'quiz', 'the night moved off the quiz');
    assert.equal(after.phase, before.phase, 'the night did not stay where it was');
    assert.equal(after.runningOrder && after.runningOrder.pos, 0, 'the order moved on without its part');
  }, {
    seed(dir) {
      const accounts = new Accounts(path.join(dir, 'accounts.json'));
      accounts.create({ email: EMAIL, password: PASSWORD, name: 'Gone', role: 'quizmaster', tier: 'gold', status: 'active' });
      accounts.save();
    },
  });
});
