/**
 * THE APP ON AN EMPTY DISK, BEHIND A GITHUB THAT ALREADY HOLDS A BACKUP — one
 * helper, two callers (`launch-restores.test.js`, `join-codes-restore.test.js`).
 *
 * `seedRepo(repo, roomId)` writes the backup BEFORE the spawn: it existed
 * before the deploy that lost the disk, which is the shape of every fault
 * these test. The account book is seeded the same way, because `Accounts`
 * reads its file once at boot. `run` gets a signed-in quizmaster's tools and
 * nothing else has been asked of the server — the point being what the
 * server does BEFORE a console page has loaded.
 *
 * A QUIZMASTER, NEVER THE HOST KEY. The host key is the house room, whose
 * restores run at boot — so a test written on it passes with the fix out and
 * fails with it in, because a backup seeded after the boot has already been
 * latched as "nothing backed up yet". The first launch test did exactly that.
 *
 * `withGitHubDown()` adds a flag file the stub refuses every READ for while it
 * exists, and hands `run` a `back()` that deletes it — GitHub answering again.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withServer } from './live-server.mjs';
import { Accounts } from '../../src/accounts.js';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUB = path.join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const EMAIL = 'rob@x.com';
const PASSWORD = 'a-long-restore-password';

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};
export const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

export async function onAnEmptyDisk(run, { seedRepo, env = {} }) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-disk-gh-'));
  try {
    await withServer(async (base, seeded, data) => {
      const res = await fetch(`${base}/api/sign-in`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      assert.equal(res.status, 200, 'could not sign the quizmaster in');
      const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
      const host = (action, body) => fetch(`${base}/api/host/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify(body || {}),
      }).then((r) => r.json().then((json) => ({ status: r.status, json })));
      const hostView = () => fetch(`${base}/api/state?role=host`, { headers: { Cookie: cookie } }).then((r) => r.json());
      const get = (route) => fetch(`${base}${route}`, { headers: { Cookie: cookie } });
      const post = (route, body) => fetch(`${base}${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify(body || {}),
      }).then((r) => r.json().then((json) => ({ status: r.status, json })));
      await run({ repo, data, roomId: seeded.id, host, hostView, get, post });
    }, {
      hostKey: 'empty-disk-key',
      nodeArgs: ['--import', STUB],
      env: { GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub', ...env },
      seed(dir) {
        const accounts = new Accounts(path.join(dir, 'accounts.json'));
        const made = accounts.create({ email: EMAIL, password: PASSWORD, name: 'Rob', role: 'quizmaster', tier: 'gold', status: 'active' });
        accounts.save();
        seedRepo(repo, made.id);
        return { id: made.id };
      },
    });
  } finally {
    fs.rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

export async function withGitHubDown(run, { seedRepo, env = {} }) {
  const flag = path.join(os.tmpdir(), `empty-disk-refuse-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(flag, '');
  try {
    await onAnEmptyDisk((tools) => run({ ...tools, back: () => fs.rmSync(flag, { force: true }) }), {
      env: { GH_STUB_REFUSE_READS: flag, ...env },
      seedRepo,
    });
  } finally {
    fs.rmSync(flag, { force: true });
  }
}
