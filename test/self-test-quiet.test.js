/**
 * THE SELF-TEST'S OWN BOOT IS NOT A NIGHT, so it may not say one was lost.
 *
 * `Session.boot()` warns "STARTED FRESH — … scores and teams are gone" when
 * it finds no saved game, which is the line worth having: on a real room it
 * is the first anybody hears that a deploy ate the evening. The self-test
 * builds a throwaway Session on an empty temp disk at EVERY boot, so every
 * boot's log and flight record carried that warning about a room nobody was
 * in — beside the real one, and indistinguishable from it. A recorder that
 * cries wolf once per deploy is one the host stops reading.
 *
 * Three claims, and the third makes the request: the self-test prints no
 * such line; a real Session booting on an empty disk still does; and a real
 * boot's flight record carries the house room's line and not a second.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runSelfTest } from '../src/self-test.js';
import { Session } from '../src/session.js';
import { Store } from '../src/store.js';
import { config } from '../src/config.js';
import { withServer } from './helpers/live-server.mjs';

const FRESH = /STARTED FRESH/;

/** Run `fn` with `console.warn` captured; return the lines it printed. */
async function warnsDuring(fn) {
  const lines = [];
  const original = console.warn;
  console.warn = (...args) => { lines.push(args.map(String).join(' ')); };
  try { await fn(); } finally { console.warn = original; }
  return lines;
}

test('the self-test does not warn that a night was lost', async () => {
  const lines = await warnsDuring(() => runSelfTest({ config }));
  assert.deepEqual(lines.filter((l) => FRESH.test(l)), [],
    'the self-test\'s throwaway room warned as if a real night had been lost');
});

test('a real room booting on an empty disk still says so', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-room-'));
  const session = new Session({
    config: { ...config, dataDir: tmp },
    store: new Store(path.join(tmp, 'state.json')),
    onPush: () => {},
    paths: { archive: path.join(tmp, 'archive') },
  });
  const lines = await warnsDuring(() => { session.boot(); });
  assert.equal(lines.filter((l) => FRESH.test(l)).length, 1, `a real fresh boot said: ${JSON.stringify(lines)}`);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('a real boot\'s flight record carries the house room\'s line, never the self-test\'s', async () => {
  await withServer(async (base, _seeded, dir) => {
    // The self-test runs a second after listen and files its verdict last, so
    // once that verdict is in the mirror every line it would have caused is too.
    const file = path.join(dir, 'flight.jsonl');
    let text = '';
    for (let i = 0; i < 100 && !/"kind":"selftest"/.test(text); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      try { text = fs.readFileSync(file, 'utf8'); } catch { text = ''; }
    }
    assert.match(text, /"kind":"selftest"/, 'the self-test never filed its verdict');
    const fresh = text.split('\n').filter((l) => FRESH.test(l));
    // ONE: the house room, which genuinely booted on an empty disk. A second
    // is the self-test's throwaway room, which is no room at all.
    assert.equal(fresh.length, 1, `expected the house room's line alone, got:\n${fresh.join('\n')}`);
  });
});
