/**
 * A COMPOSED NIGHT IS NOT INVISIBLE TO THE PACK CHECKS — rule 11 holds live
 * for a night with a round unticked, two packs mixed, or a saved show.
 *
 * `packInUse()`, `reloadPackEverywhere()` and `changesTheLiveQuestion()` all
 * asked `session.pack.id === id`, and a composed night's id is `~tonight`,
 * which is not a file. So on most nights this app runs: a source pack could
 * be deleted under the live night with no warning (the next restart could
 * not rebuild the order and threw the night away), and a correction saved
 * mid-quiz never reached the room — the wrong answer stayed on the wall while
 * the host believed rule 11 had delivered the fix. O20 of the 23 September
 * 2026 launch-path sweep.
 *
 * A session names its sources now (`usesPack()`, `liveQuestionIn()`,
 * `reloadPack()` in session.js): a composed room is recomposed through the
 * SAME loader the boot uses and pushed, and a source is as protected from
 * deletion as a pack played whole. Over HTTP, in a quizmaster's room, with
 * the owner editing the catalogue through the host key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { withServer } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const EMAIL = 'mix@x.com';
const PASSWORD = 'a-long-mixing-password';
const KEY = 'live-test-key';

const pack = (id, first, second) => ({
  id, title: `Tiny ${id}`, questionSeconds: 20, showRules: false,
  rounds: [{ id: 'r1', type: 'text', title: `Round of ${id}`, questions: [
    { id: 'q1', prompt: `First of ${id}?`, options: first, correctIndex: 0 },
    { id: 'q2', prompt: `Second of ${id}?`, options: second, correctIndex: 1 },
  ] }],
});
const A = pack('tiny-a', ['Bowie', 'Prince', 'Madonna', 'Cher'], ['Abba', 'Blondie', 'Queen', 'Wham']);
const B = pack('tiny-b', ['Oasis', 'Blur', 'Pulp', 'Suede'], ['Elastica', 'Ash', 'Feeder', 'Bush']);

test('a correction to a source pack reaches a live composed night, and a source cannot be deleted under it', async () => {
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
    const asOwner = (method, route, body) => fetch(`${base}${route}?key=${KEY}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json().catch(() => ({})).then((json) => ({ status: r.status, json })));

    // Round one of A then round one of B: a composed night, `pack.id` `~tonight`.
    const launched = await host('launch', {
      game: 'quiz', packId: 'tiny-a', replace: true,
      order: [{ packId: 'tiny-a', round: 0 }, { packId: 'tiny-b', round: 0 }],
    });
    assert.equal(launched.status, 200, `the composed night would not launch: ${JSON.stringify(launched.json)}`);
    const library = await (await fetch(`${base}/api/library`, { headers: { Cookie: cookie } })).json();
    const code = library.running && library.running.joinCode;
    assert.ok(code, 'the room has no join code');
    const wall = () => fetch(`${base}/api/state?role=screen&g=${encodeURIComponent(code)}`).then((r) => r.json());

    await host('start');
    for (let i = 0; i < 6 && (await hostView()).phase !== 'question'; i += 1) await host('next');
    assert.equal((await hostView()).phase, 'question', 'never reached a question');
    assert.deepEqual((await wall()).question.options, A.rounds[0].questions[0].options, 'the wall is not on A\'s first question');

    // THE CORRECTION. The question on the wall, confirmed as such — the editor's second press.
    const corrected = JSON.parse(JSON.stringify(A));
    corrected.rounds[0].questions[0].options[0] = 'David Bowie';
    const saved = await asOwner('PUT', '/api/quiz/tiny-a', { ...corrected, confirmLive: true });
    assert.equal(saved.status, 200, `the correction was refused: ${JSON.stringify(saved.json)}`);
    assert.equal((await wall()).question.options[0], 'David Bowie',
      'a correction saved to a source pack never reached the live composed night — rule 11 does not hold');
    assert.equal((await hostView()).question.options[0], 'David Bowie', 'the host view did not get it either');

    // THE ON-SCREEN CHECK, in the SOURCE pack's own coordinates: the live question
    // is round 0 of tiny-a, so a change to it without `confirmLive` is a 409,
    // and a change to the question after it saves straight through.
    const again = JSON.parse(JSON.stringify(corrected));
    again.rounds[0].questions[0].prompt = 'First of tiny-a, reworded?';
    const clash = await asOwner('PUT', '/api/quiz/tiny-a', again);
    assert.equal(clash.status, 409, `editing the question on the wall was not asked about: ${JSON.stringify(clash.json)}`);
    assert.equal(clash.json.error, 'onScreenNow');
    assert.deepEqual({ r: clash.json.live.roundIndex, q: clash.json.live.questionIndex }, { r: 0, q: 0 },
      'the clash names the wrong question of the source pack');
    const later = JSON.parse(JSON.stringify(corrected));
    later.rounds[0].questions[1].prompt = 'Second of tiny-a, reworded?';
    assert.equal((await asOwner('PUT', '/api/quiz/tiny-a', later)).status, 200, 'a question not on the wall must save straight through');

    // THE DELETE. B is not on the wall yet; it is still part of tonight.
    const gone = await asOwner('DELETE', '/api/quiz/tiny-b');
    assert.equal(gone.status, 400, `a source of the live night was deleted from under it: ${JSON.stringify(gone.json)}`);
    assert.match(String(gone.json.error || ''), /loaded in a game right now/);
  }, {
    hostKey: KEY,
    seed(dir) {
      const accounts = new Accounts(path.join(dir, 'accounts.json'));
      accounts.create({ email: EMAIL, password: PASSWORD, name: 'Mix', role: 'quizmaster', tier: 'gold', status: 'active' });
      accounts.save();
      // Two tiny packs beside the catalogue's copy — `safeEnv()` copies the
      // shipped packs INTO this folder, and leaves what is already there.
      fs.mkdirSync(path.join(dir, 'quizzes'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'quizzes', 'tiny-a.json'), JSON.stringify(A));
      fs.writeFileSync(path.join(dir, 'quizzes', 'tiny-b.json'), JSON.stringify(B));
    },
  });
});
