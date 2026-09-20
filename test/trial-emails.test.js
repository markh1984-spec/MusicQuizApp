/**
 * DOES THE TRIAL SWEEP ACTUALLY SEND ANYTHING?
 *
 * ---
 *
 * `test/trials.test.js` pins WHO is due what. This is the other half, and it is
 * the half that cannot be seen any other way: the sweep runs at BOOT, inside
 * `server.js`, against the real accounts book and a real mail provider call.
 *
 * **Checking the marks alone would not do it.** A sweep that stamped every
 * account and sent nothing passes that, which is this repo's oldest fault —
 * *a test that never runs the artefact proves nothing about it*. So the server is
 * the real one, spawned with `--import`, and only the network behind it is a
 * fixture: every send lands in a JSONL file this test reads.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { freePort, stopped } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'mail-stub.mjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

/**
 * Spawn the real app with the accounts book already written — `Accounts` reads
 * its file once at boot, so a book written afterwards is one the server has never
 * heard of. Returns what left, and the book as it stands after.
 */
async function withApp(seed, run) {
  const data = mkdtempSync(join(tmpdir(), 'trialmail-'));
  const outbox = join(data, 'sent.jsonl');
  writeFileSync(outbox, '');
  const file = join(data, 'accounts.json');
  const book = new Accounts(file);
  seed(book);
  book.save();

  const port = await freePort();
  const child = spawn(process.execPath, ['--import', STUB, 'server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: data,
      HOST_KEY: 'trial-mail-key',
      MAIL_STUB_FILE: outbox,
      // A provider and a from-address, or `emailConfigured()` is false and the
      // sweep declines to do anything at all — which is itself a case below.
      BREVO_API_KEY: 'stub-key',
      EMAIL_FROM: 'Quizporium <no-reply@example.com>',
      PUBLIC_URL: `http://127.0.0.1:${port}`,
    },
    stdio: 'ignore',
  });
  child.unref();
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) {
    if (child.exitCode !== null) break;
    try { await fetch(base); break; } catch { await wait(100); }
  }
  // The sweep is fired at boot and nothing awaits it, so give the outbound calls
  // a moment to land in the fixture.
  await wait(700);

  const sent = () => (existsSync(outbox) ? readFileSync(outbox, 'utf8') : '')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const now = () => JSON.parse(readFileSync(file, 'utf8')).accounts;

  try {
    await run({ base, sent, now, restart: async () => {
      child.kill('SIGKILL');
      await wait(300);
      const again = spawn(process.execPath, ['--import', STUB, 'server.js'], {
        cwd: ROOT,
        env: {
          ...process.env,
          PORT: String(port), DATA_DIR: data, HOST_KEY: 'trial-mail-key',
          MAIL_STUB_FILE: outbox, BREVO_API_KEY: 'stub-key',
          EMAIL_FROM: 'Quizporium <no-reply@example.com>',
          PUBLIC_URL: base,
        },
        stdio: 'ignore',
      });
      again.unref();
      for (let i = 0; i < 120; i += 1) {
        try { await fetch(base); break; } catch { await wait(100); }
      }
      await wait(700);
      return () => again.kill('SIGKILL');
    } });
  } finally {
    /*
     * GONE, THEN DELETED — `stopped()` is `test/helpers/live-server.mjs`'s.
     * `kill()` sends a signal and waits for nothing, so deleting the data
     * directory on the next line races a server still flushing `state.json`
     * into it: ENOTEMPTY out of this `finally`, every assertion already
     * passed, naming a feature that works.
     */
    await stopped(child, 'SIGKILL');
    rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

const quizmaster = (book, email, over = {}) => {
  const made = book.create({
    email, password: 'a long enough passphrase', name: email.split('@')[0],
    role: 'quizmaster', tier: 'bronze', status: 'trialing',
  });
  Object.assign(book.find(made.id), over);
  return made;
};

test('a trial three days out gets an email that names the day', async () => {
  await withApp((book) => {
    quizmaster(book, 'soon@example.com', { trialEndsAt: inDays(2) });
    quizmaster(book, 'later@example.com', { trialEndsAt: inDays(11) });
  }, async ({ sent, now }) => {
    const out = sent();
    assert.equal(out.length, 1, 'only the one inside the window');
    assert.equal(out[0].to, 'soon@example.com');
    assert.match(out[0].subject, /trial ends in 2 days/i);
    /*
     * IT MAY SAY A NIGHT IS AT RISK, WHERE A CARD-FAILED NOTICE MAY NOT — an
     * expired trial gets no grace night, by decision, so a gig on the Friday
     * genuinely will not launch. Softening that is the app being reassuring about
     * the one thing it is about to do.
     */
    assert.match(out[0].text, /will not launch/i);
    assert.match(out[0].text, /nothing is deleted/i, 'and what is safe is said too');
    assert.match(out[0].text, /\/console\?door=account&tab=account/,
      'straight to the ladder, which is where a plan is picked');

    const marked = now().find((a) => a.email === 'soon@example.com');
    assert.ok(marked.trialWarnedAt, 'and the mark goes on the account, not in memory');
    assert.equal(now().find((a) => a.email === 'later@example.com').trialWarnedAt, undefined);
  });
});

test('a trial that has run out is told, and told what still works', async () => {
  await withApp((book) => {
    quizmaster(book, 'gone@example.com', { trialEndsAt: inDays(-2) });
  }, async ({ sent, now }) => {
    const out = sent();
    assert.equal(out.length, 1);
    assert.match(out[0].subject, /trial has ended/i);
    // IT LEADS WITH WHAT IS SAFE. An email that opens with a refusal reads as an
    // account being closed, and nothing here is.
    assert.match(out[0].text, /still there/i);
    assert.match(out[0].text, /nothing has been deleted/i);
    assert.match(out[0].text, /nothing to cancel/i, 'and it lets them walk away politely');
    assert.ok(now().find((a) => a.email === 'gone@example.com').trialEndedAt);
  });
});

test('A RESTART DOES NOT SEND IT AGAIN — every push is a deploy and every deploy is a boot', async () => {
  await withApp((book) => {
    quizmaster(book, 'once@example.com', { trialEndsAt: inDays(1) });
  }, async ({ sent, restart }) => {
    assert.equal(sent().length, 1, 'the first boot sends it');
    const stop = await restart();
    try {
      assert.equal(sent().length, 1,
        'and the second must not — without the mark on the account a busy Monday '
        + 'sends one notice per push');
    } finally { stop(); }
  });
});

test('the owner, a payer, a comped account and a GROUP SEAT are all left alone', async () => {
  await withApp((book) => {
    book.create({
      email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner',
      role: 'owner', status: 'active',
    });
    quizmaster(book, 'paid@example.com', { status: 'active', trialEndsAt: inDays(-1) });
    quizmaster(book, 'house@example.com', { comped: true, trialEndsAt: inDays(-1) });
    const parent = quizmaster(book, 'hq@example.com', { status: 'active', trialEndsAt: '' });
    quizmaster(book, 'seat@example.com', { parentId: parent.id, trialEndsAt: inDays(-1) });
  }, async ({ sent }) => {
    assert.deepEqual(sent(), [],
      'a seat holds its parent’s standing, so warning it sends a notice to '
      + 'somebody who cannot act on it');
  });
});

test('and with no mail provider the sweep does nothing at all, quietly', async () => {
  /*
   * NOT CONFIGURED IS A STATE, NOT A FAILURE — `src/email.js`'s own rule. It must
   * not stamp accounts either: doing so would burn the notice, so the day a key is
   * finally set nobody gets told anything.
   */
  const data = mkdtempSync(join(tmpdir(), 'trialnomail-'));
  const outbox = join(data, 'sent.jsonl');
  writeFileSync(outbox, '');
  const file = join(data, 'accounts.json');
  const book = new Accounts(file);
  quizmaster(book, 'nobody@example.com', { trialEndsAt: inDays(1) });
  book.save();
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', STUB, 'server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port), DATA_DIR: data, HOST_KEY: 'k', MAIL_STUB_FILE: outbox,
      BREVO_API_KEY: '', RESEND_API_KEY: '', EMAIL_FROM: '', PUBLIC_URL: '',
    },
    stdio: 'ignore',
  });
  child.unref();
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) {
    try { await fetch(base); break; } catch { await wait(100); }
  }
  await wait(700);
  try {
    assert.equal(readFileSync(outbox, 'utf8'), '', 'nothing sent');
    const after = JSON.parse(readFileSync(file, 'utf8')).accounts
      .find((a) => a.email === 'nobody@example.com');
    assert.equal(after.trialWarnedAt, undefined,
      'and the notice is NOT burned — the day a key is set, they still get told');
  } finally {
    /*
     * GONE, THEN DELETED — `stopped()` is `test/helpers/live-server.mjs`'s.
     * `kill()` sends a signal and waits for nothing, so deleting the data
     * directory on the next line races a server still flushing `state.json`
     * into it: ENOTEMPTY out of this `finally`, every assertion already
     * passed, naming a feature that works.
     */
    await stopped(child, 'SIGKILL');
    rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
