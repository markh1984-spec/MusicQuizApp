/**
 * A SEED IS FINISHED BEFORE THE APP BOOTS — in both spawners.
 *
 * `withServer()` and `startApp()` promise that `seed(dir)` runs BEFORE the
 * spawn, because `Accounts` reads its file once at boot. Neither awaited it:
 * an async seed (twenty-one guards pass one) had its file written while the
 * server was already reading an empty folder, and every sign-in answered 401
 * — a load-dependent flake that named a feature which works. A yellow of the
 * 23 September 2026 launch-path sweep.
 *
 * The seed here waits on purpose, so the race is lost every time rather than
 * one run in nine.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { withServer } from './helpers/live-server.mjs';
import { startApp } from '../scripts/helpers/live-app.mjs';
import { Accounts } from '../src/accounts.js';

const EMAIL = 'late@x.com';
const PASSWORD = 'a-long-late-seed-password';
const seed = async (dir) => {
  await new Promise((r) => setTimeout(r, 400));
  const book = new Accounts(path.join(dir, 'accounts.json'));
  book.create({ email: EMAIL, password: PASSWORD, name: 'Late', role: 'quizmaster', tier: 'gold', status: 'active' });
  book.save();
  return { seeded: true };
};
const signIn = (base) => fetch(`${base}/api/sign-in`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.status);

test('withServer() waits for an async seed before the app boots', async () => {
  await withServer(async (base, seeded) => {
    assert.deepEqual(seeded, { seeded: true }, 'the seed\'s own answer was not waited for');
    assert.equal(await signIn(base), 200, 'the account seeded before the spawn does not exist to the running app');
  }, { seed });
});

test('startApp() waits for an async seed before the app boots', async () => {
  const app = await startApp({ key: 'seed-awaited-key', seed });
  try {
    assert.deepEqual(app.seeded, { seeded: true }, 'the seed\'s own answer was not waited for');
    assert.equal(await signIn(app.base), 200, 'the account seeded before the spawn does not exist to the running app');
  } finally {
    await app.stopAndWait();
  }
});
