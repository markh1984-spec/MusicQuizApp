/**
 * THE PROJECTOR IS TOLD WHERE THE PICTURE IS ASKED, NEVER WHAT IT IS CALLED.
 *
 * A picture-round portrait is a file named after its answer —
 * `portraits/chris-martin.png` — and that path was in the projector's payload
 * and its `<img src>` while the room was still watching the zoom. Anybody
 * holding the join code, which is on the wall and read out on the mic, could
 * read every picture answer by name while the room guessed. Rule 1, broken for
 * every picture round: R2 of the 23 September 2026 launch-path sweep.
 *
 * So the payload names the question's POSITION (`/quiz-images/q/<round>/<q>`)
 * and the server answers only for a question the room has been asked — the
 * one live or revealed now, or one already in the recap. The next picture, a
 * wrong code and the house room all get 404, so nothing can be read ahead.
 * Over real HTTP, as a signed-in quizmaster with a join code, reading the RAW
 * payload for the answer's slug rather than one named field.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { withServer } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const EMAIL = 'qm@x.com';
const PASSWORD = 'a-long-picture-password';
const PACK = '2000-2010-pop-indie-and-rock';
const pack = JSON.parse(fs.readFileSync(new URL(`../quizzes/${PACK}.json`, import.meta.url), 'utf8'));
const RI = pack.rounds.findIndex((r) => r.type === 'image');
const FILE = String(pack.rounds[RI].questions[0].image || '');
const SLUG = path.basename(FILE, path.extname(FILE));

test('the picture round names a position on the wire, and serves the picture only once it has been asked', async () => {
  assert.ok(RI >= 0 && FILE, `${PACK} has no picture round to test with`);
  await withServer(async (base) => {
    const signIn = await fetch(`${base}/api/sign-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    assert.equal(signIn.status, 200);
    const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
    const host = (action, body) => fetch(`${base}/api/host/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(body || {}),
    }).then((r) => r.json().then((json) => ({ status: r.status, json })));
    const hostView = () => fetch(`${base}/api/state?role=host`, { headers: { Cookie: cookie } }).then((r) => r.json());

    assert.equal((await host('launch', { game: 'quiz', packId: PACK })).status, 200);
    const lib = await (await fetch(`${base}/api/library`, { headers: { Cookie: cookie } })).json();
    const code = lib.joinCode;
    assert.ok(code, 'the room has no join code');
    const picture = (qi, g = code) => fetch(`${base}/quiz-images/q/${RI}/${qi}${g ? `?g=${encodeURIComponent(g)}` : ''}`);

    // Before the round: nothing has been asked, nothing is served.
    assert.equal((await picture(0)).status, 404, 'a picture was served before its question was asked');

    await host('start', {});
    for (let i = 0; i < 120; i += 1) {
      const v = await hostView();
      if (v.roundIndex === RI && v.phase === 'question') break;
      await host('next', {});
    }
    const at = await hostView();
    assert.equal(at.roundIndex, RI);
    assert.equal(at.phase, 'question');

    const raw = await (await fetch(`${base}/api/state?role=screen&g=${encodeURIComponent(code)}`)).text();
    const screen = JSON.parse(raw);
    assert.equal(screen.question.image, `/quiz-images/q/${RI}/0`);
    assert.ok(!raw.includes(SLUG) && !raw.includes('portraits/'),
      `the projector payload names the answer: ${raw.slice(0, 240)}`);
    // The phone never sees the question at all (rule 8) — and so never the picture.
    const phone = await (await fetch(`${base}/api/state?role=player&g=${encodeURIComponent(code)}`)).text();
    assert.ok(!phone.includes('/quiz-images/') && !phone.includes(SLUG), 'the phone was given the picture');

    // The picture itself is served for the question that is up…
    const now = await picture(0);
    assert.equal(now.status, 200);
    assert.match(now.headers.get('content-type') || '', /^image\//);
    assert.match(now.headers.get('cache-control') || '', /no-cache/, 'the same address is a different picture on another night');
    // …and not for the next one, nor with another code, nor for the house room.
    assert.equal((await picture(1)).status, 404, 'the NEXT picture could be read ahead');
    assert.equal((await picture(0, 'ZZZZ')).status, 404);
    assert.equal((await picture(0, '')).status, 404, 'the house room served a picture it was never asked');

    // A revealed picture stays readable after the night moves on — the room has seen it.
    await host('next', {});   // reveal
    await host('next', {});   // the next question
    assert.equal((await hostView()).questionIndex, 1);
    assert.equal((await picture(0)).status, 200, 'a picture the room has already seen went missing');
    assert.equal((await picture(1)).status, 200);
    assert.equal((await picture(2)).status, 404);
  }, {
    hostKey: 'picture-key',
    seed(dir) {
      const accounts = new Accounts(path.join(dir, 'accounts.json'));
      accounts.create({ email: EMAIL, password: PASSWORD, name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
      accounts.save();
    },
  });
});
