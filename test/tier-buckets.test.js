/**
 * THE TIER BUCKETS — which rung each feature is sold on, and who keeps what
 * when one moves.
 *
 * Until this existed, moving a feature between Bronze, Silver and Gold was a
 * one-word edit in `plans.js` and a deploy. The control is the easy half; the
 * half worth testing is the rule that was settled before it was built:
 *
 *   **Anybody who already holds a feature keeps it for as long as they stay
 *   subscribed. The new tier applies to new sign-ups.**
 *
 * Losing it at renewal is cleaner data and was turned down for a better reason
 * than kindness: a quizmaster finds out on a GIG NIGHT. Something they used
 * last Thursday is missing this Thursday, in a pub, with a room in.
 *
 * Every test below is that sentence in one form or another.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import {
  FEATURES, FEATURE_TIER, featuresAt, tierOf, setTierOverrides, tierOverridesNow, entitlements,
} from '../public/assets/plans.js';

function store() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-'));
  return new Accounts(path.join(dir, 'accounts.json'));
}

/** A paying subscriber on a named tier. */
function subscriber(accounts, email, tier) {
  const made = accounts.create({ email, password: 'hunter2hunter2', name: email });
  accounts.update(made.id, { tier, status: 'active' });
  return accounts.find(made.id);
}

test.afterEach(() => setTierOverrides({}));

test('with nothing moved, the ladder is exactly what the code ships', () => {
  setTierOverrides({});
  assert.equal(tierOf(FEATURES.ADVERTS), FEATURE_TIER[FEATURES.ADVERTS]);
  assert.deepEqual(tierOverridesNow(), {});
});

test('moving a feature changes which tier reaches it', () => {
  const accounts = store();
  assert.ok(featuresAt('bronze').includes(FEATURES.PHOTOS), 'photos start on bronze');
  accounts.setFeatureTier(FEATURES.PHOTOS, 'gold');
  assert.equal(tierOf(FEATURES.PHOTOS), 'gold');
  assert.ok(!featuresAt('bronze').includes(FEATURES.PHOTOS));
  assert.ok(!featuresAt('silver').includes(FEATURES.PHOTOS));
  assert.ok(featuresAt('gold').includes(FEATURES.PHOTOS));
});

test('MOVING ONE UP DOES NOT TAKE IT OFF THE PEOPLE USING IT', () => {
  /*
   * The rule, tested the way it will actually be met: a bronze subscriber is
   * using photos on Tuesday, the owner moves photos to gold on Wednesday, and
   * on Thursday — in a pub — that subscriber still has photos.
   */
  const accounts = store();
  const rob = subscriber(accounts, 'rob@example.com', 'bronze');
  assert.ok(entitlements(rob).features.includes(FEATURES.PHOTOS));

  const moved = accounts.setFeatureTier(FEATURES.PHOTOS, 'gold');
  assert.equal(moved.kept, 1, 'it should say how many people it protected');

  const after = accounts.find(rob.id);
  assert.ok(after.kept.includes(FEATURES.PHOTOS), 'the grant is written on the account');
  assert.ok(entitlements(after).features.includes(FEATURES.PHOTOS),
    'a bronze account that HAD photos still has photos');
});

test('…AND A NEW SIGN-UP ON THE SAME TIER DOES NOT GET IT', () => {
  // The other half of the same sentence, and the half that makes the move
  // worth anything: the new tier applies to new sign-ups.
  const accounts = store();
  subscriber(accounts, 'rob@example.com', 'bronze');
  accounts.setFeatureTier(FEATURES.PHOTOS, 'gold');

  const newcomer = subscriber(accounts, 'new@example.com', 'bronze');
  assert.ok(!entitlements(newcomer).features.includes(FEATURES.PHOTOS));
});

test('MOVING ONE DOWN GRANDFATHERS NOBODY, because there is nobody to protect', () => {
  /*
   * Moving a feature down gives it to MORE people. Writing `kept` anyway would
   * slowly fill every account with a list of things its own tier already
   * includes — a lie waiting to be believed the next time something moves.
   */
  const accounts = store();
  const rob = subscriber(accounts, 'rob@example.com', 'gold');
  const moved = accounts.setFeatureTier(FEATURES.STREAM, 'bronze');
  assert.equal(moved.kept, 0);
  assert.equal(accounts.find(rob.id).kept, undefined);
});

test('a move back to the shipped tier REMOVES the override rather than storing it', () => {
  // A stored entry saying "bronze, same as the default" is a difference that
  // is not a difference, and it is what turns a small overrides file into a
  // frozen copy of the whole table.
  const accounts = store();
  accounts.setFeatureTier(FEATURES.PHOTOS, 'gold');
  assert.deepEqual(tierOverridesNow(), { [FEATURES.PHOTOS]: 'gold' });
  accounts.setFeatureTier(FEATURES.PHOTOS, FEATURE_TIER[FEATURES.PHOTOS]);
  assert.deepEqual(tierOverridesNow(), {}, 'back to the default is no override at all');
});

test('THE ARRANGEMENT SURVIVES A RESTART — and a fresh boot applies it', () => {
  /*
   * `plans.js` holds the live ladder in a module-level value that starts
   * empty, so without the boot-time apply the whole app would run on the
   * SHIPPED tiers until the owner next moved something. Nothing would look
   * broken; the ladder would simply not be theirs.
   */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-'));
  const file = path.join(dir, 'accounts.json');
  const first = new Accounts(file);
  first.setFeatureTier(FEATURES.ADVERTS, 'gold');

  setTierOverrides({});                       // as a fresh process starts
  assert.equal(tierOf(FEATURES.ADVERTS), FEATURE_TIER[FEATURES.ADVERTS]);

  const second = new Accounts(file); // boot
  assert.equal(tierOf(FEATURES.ADVERTS), 'gold');
  assert.deepEqual(second.featureTiers(), { [FEATURES.ADVERTS]: 'gold' });
});

test('IT IS STORED BESIDE THE ACCOUNTS, so the backup already covers it', () => {
  // On a host whose disk is wiped by every deploy, a tiers file that was not
  // backed up would silently revert the ladder while every login survived.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-'));
  const file = path.join(dir, 'accounts.json');
  new Accounts(file).setFeatureTier(FEATURES.ADVERTS, 'gold');
  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(onDisk.tiers, { [FEATURES.ADVERTS]: 'gold' });
  assert.ok(Array.isArray(onDisk.accounts) && Array.isArray(onDisk.sessions));
});

test('a feature or a tier that does not exist is refused by name', () => {
  const accounts = store();
  assert.throws(() => accounts.setFeatureTier('nonsense', 'gold'), /no feature called nonsense/);
  assert.throws(() => accounts.setFeatureTier(FEATURES.PHOTOS, 'platinum'), /no tier called platinum/);
});

test('a stale override for a deleted feature is ignored rather than honoured', () => {
  // It would otherwise put a name nobody recognises into the ladder the page
  // draws, months after the feature was removed.
  setTierOverrides({ 'a-feature-that-was-deleted': 'gold', [FEATURES.PHOTOS]: 'silver' });
  assert.deepEqual(tierOverridesNow(), { [FEATURES.PHOTOS]: 'silver' });
});

test('KEPT CANNOT REACH A FEATURE THAT DOES NOT EXIST', () => {
  // `kept` is read back off a stored account, so it is input like any other.
  const accounts = store();
  const rob = subscriber(accounts, 'rob@example.com', 'bronze');
  accounts.update(rob.id, { kept: ['made-up-feature'] });
  const on = entitlements(accounts.find(rob.id)).features;
  assert.ok(!on.includes('made-up-feature'));
});

test('a LAPSED account keeps nothing, grandfathered or not', () => {
  /*
   * "For as long as they stay subscribed" is the actual rule. `kept` records
   * what they were using, not a permanent licence — and entitlement is refused
   * at the status check long before it gets here.
   */
  const accounts = store();
  const rob = subscriber(accounts, 'rob@example.com', 'bronze');
  accounts.setFeatureTier(FEATURES.PHOTOS, 'gold');
  accounts.update(rob.id, { status: 'cancelled' });
  assert.deepEqual(entitlements(accounts.find(rob.id)).features, []);
});

/* ---- AND THE PAYLOAD ACTUALLY CARRIES IT
 *
 * Everything above tests the STORE. None of it could see the fault that made
 * the whole feature invisible in a browser: `/api/me`'s response literal
 * already had a `tiers` key — the rungs the hat switch draws — so the feature
 * map was added under the same name and the later one silently won. JavaScript
 * does not warn about a duplicate key in an object literal. The server stored
 * the owner's ladder correctly, said it was sending it, and sent an array of
 * rungs instead; every page carried on drawing the shipped tiers.
 *
 * Nothing that reads source could catch that, and nothing that tests the store
 * goes near it. **A test that never runs the artefact proves nothing about
 * it** — so this one boots the real server and reads the real payload.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'tier-payload-test-key';

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'tier-route-'));
  // Off the pid like the launch-route test, so two suites cannot collide.
  const port = 4900 + (process.pid % 800);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: KEY },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try { await fetch(`${base}/api/state?role=screen`); up = true; } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(up, 'the server never came up');
    await run(base);
  } finally {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

test('THE LADDER REACHES THE BROWSER — /api/me carries a feature map, not rungs', async () => {
  await withServer(async (base) => {
    const move = await fetch(`${base}/api/owner/tiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ feature: FEATURES.PHOTOS, tier: 'gold' }),
    });
    assert.equal(move.status, 200, `the move answered ${move.status}`);

    const me = await (await fetch(`${base}/api/me?key=${KEY}`)).json();
    /*
     * A MAP OF FEATURE TO TIER, and specifically NOT an array. That single
     * assertion is the one the duplicate key would have failed: `tiers` there
     * is a list of rungs, and this has to be something else entirely.
     */
    assert.ok(me.featureTiers && typeof me.featureTiers === 'object', 'no featureTiers on /api/me');
    assert.ok(!Array.isArray(me.featureTiers), 'featureTiers must be a map, not the hat switch rungs');
    assert.equal(me.featureTiers[FEATURES.PHOTOS], 'gold', 'the move never reached the payload');
  });
});
