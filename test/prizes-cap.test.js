/**
 * HOW MANY PRIZES A BINGO NIGHT MAY CARRY IS ONE NUMBER, IMPORTED.
 *
 * The launch route clamped `prizes` to 0..5 and the running-order path in
 * `session.js` to 0..5 again, each with its own literal — and `shows.js`
 * wrote it twice more and `maxPrizes()` once. Five copies of a number agree
 * until somebody edits one, and the one that drifts is the one nobody is
 * looking at. `MAX_PRIZES` in `prize-parts.js` is the number now, and
 * `prizesAsked()` the clamp both server paths (and the console) go through.
 *
 * The second half asks over HTTP: a plain launch and a one-part running
 * order handed the same `prizes` must leave the same number of stages on the
 * night, for values in range, past it and nonsense.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { MAX_PRIZES, prizesAsked } from '../public/assets/prize-parts.js';
import { maxPrizes } from '../src/bingo.js';
import { Accounts } from '../src/accounts.js';
import { withServer } from './helpers/live-server.mjs';
import { codeOnly } from './scope.js';

const ROOT = new URL('..', import.meta.url).pathname;

test('prizesAsked() clamps every shape of input the same way', () => {
  assert.equal(MAX_PRIZES, 5);
  const table = [
    [7, MAX_PRIZES], [99, MAX_PRIZES], [Infinity, MAX_PRIZES], [5, 5], [1, 1], [2.7, 2], ['3', 3],
    [0, 0], [-3, 0], ['abc', 0], [NaN, 0], [null, 0], [undefined, 0],
  ];
  for (const [given, want] of table) assert.equal(prizesAsked(given), want, `prizesAsked(${String(given)})`);
  // The card's own cap is the same number: a 5x5 holds twelve lines, so the
  // app's ceiling is what stops it.
  assert.equal(maxPrizes({ rows: 5, cols: 5 }), MAX_PRIZES);
});

test('every server clamp imports the number rather than writing it', () => {
  for (const file of ['src/http/write-host.js', 'src/session.js', 'src/shows.js']) {
    const code = codeOnly(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    assert.doesNotMatch(code, /Math\.min\(\s*5\s*,/, `${file} still clamps prizes with a literal 5`);
    assert.match(code, /prizesAsked/, `${file} does not use prizesAsked()`);
  }
  const bingo = codeOnly(fs.readFileSync(path.join(ROOT, 'src/bingo.js'), 'utf8'));
  assert.match(bingo, /MAX_PRIZES/, 'maxPrizes() does not read MAX_PRIZES');
  assert.doesNotMatch(bingo, /Math\.min\(\s*5\s*,/, 'bingo.js still caps with a literal 5');
});

function seed(dir) {
  const book = new Accounts(path.join(dir, 'accounts.json'));
  const qm = book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
  book.save();
  return { qm };
}

test('a plain launch and a running order accept and refuse the same prize counts', async () => {
  await withServer(async (base, { qm }, dir) => {
    const signIn = await fetch(`${base}/api/sign-in`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }),
    });
    const cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
    assert.equal(signIn.status, 200);
    const H = { 'content-type': 'application/json', cookie };
    const shape = { rows: 5, cols: 5 };
    const stateFile = path.join(dir, 'rooms', qm.id, 'state.json');
    const stagesOnDisk = () => JSON.parse(fs.readFileSync(stateFile, 'utf8')).stages.length;

    for (const prizes of [7, 99, 5, 3, 1, 2.7, 'abc', -2]) {
      const plain = await fetch(`${base}/api/host/launch`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ game: 'bingo', packId: 'mbc-5', shape, prizes, replace: true, venue: 'The Crown', breakPlan: {} }),
      });
      assert.equal(plain.status, 200, `launch with prizes ${prizes}: ${await plain.text()}`);
      const viaLaunch = stagesOnDisk();

      const order = await fetch(`${base}/api/host/launchOrder`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ segments: [{ kind: 'bingo', packId: 'mbc-5', shape, prizes }], replace: true, venue: 'The Crown', breakPlan: {} }),
      });
      assert.equal(order.status, 200, `running order with prizes ${prizes}: ${await order.text()}`);
      const viaOrder = stagesOnDisk();

      assert.equal(viaLaunch, viaOrder, `prizes ${prizes}: the launch route gave ${viaLaunch} stages, the running order ${viaOrder}`);
      const asked = prizesAsked(prizes);
      if (asked) assert.equal(viaLaunch, asked, `prizes ${prizes} should reach the room as ${asked} stages`);
    }
  }, { seed });
});
