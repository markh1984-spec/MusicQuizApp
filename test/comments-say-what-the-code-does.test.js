/**
 * A COMMENT THAT CLAIMS THE OPPOSITE IS WHERE THE NEXT BUG HIDES — fourth
 * sighting in CLAUDE.md, and the launch-path sweep of 23 September 2026 found
 * three more. Each claim here is pinned to the CODE it describes, so a change
 * to either half fails loudly rather than leaving the words to drift:
 *
 *  - `offerLobbyGames()` said "in memory only — no flush"; it writes onto the
 *    state the store flushes, so the next write carries it to disk.
 *  - `filedVouchers` read as if it held what was last filed; after a restart
 *    it is null, and the first change on a filed night writes one update
 *    whether or not a voucher moved.
 *  - `state.version` said clients spot a missed update by it and the screen
 *    re-keys animations on it; no browser file reads it at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Session } from '../src/session.js';
import { Store } from '../src/store.js';
import { config } from '../src/config.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** The comment block immediately above a line matching `at` (whatever `/* … *\/` or `//` run precedes it). */
function commentAbove(src, at) {
  const i = src.search(at);
  assert.ok(i >= 0, `${at} not found`);
  const before = src.slice(0, i);
  const block = before.match(/(?:\/\*[\s\S]*?\*\/|(?:[ \t]*\/\/[^\n]*\n?)+)\s*$/);
  return block ? block[0] : '';
}

function freshSession() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'comments-'));
  const store = new Store(path.join(tmp, 'state.json'));
  const session = new Session({
    config: { ...config, dataDir: tmp }, store, onPush: () => {}, quiet: true,
    paths: { archive: path.join(tmp, 'archive') },
  });
  session.boot();
  return { session, store, tmp };
}

test('offerLobbyGames() writes onto the state the store flushes, and its comment says so', () => {
  const { session, store, tmp } = freshSession();
  session.offerLobbyGames(['maze', 'rally']);
  store.save(session.engine.state);
  store.flush();
  const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, 'state.json'), 'utf8'));
  assert.deepEqual(onDisk.lobbyGames, ['maze', 'rally'], 'the offer never reached the state file');
  const words = commentAbove(read('src/session.js'), /\n  offerLobbyGames\(ids\) \{/);
  assert.doesNotMatch(words, /in memory only/i, 'the comment still says the offer stays in memory');
  assert.match(words, /disk/i, 'the comment does not say the offer rides to disk with the next write');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('filedVouchers is null after a boot, and its comment says it is not restored', () => {
  const { session, tmp } = freshSession();
  session.filedVouchers = '{"held":true}';
  session.build(session.kind, session.pack, session.engine.state);   // what boot() does with a restored state
  assert.equal(session.filedVouchers, null, 'build() kept filedVouchers across a rebuild');
  const words = commentAbove(read('src/session.js'), /\n    this\.filedVouchers = null;\n  \}/);
  assert.match(words, /not restored|null after a restart|null on a restart/i,
    'the comment does not say filedVouchers comes back null after a restart');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('no browser file reads state.version, and the comment on it claims no reader', () => {
  const readers = fs.readdirSync(path.join(ROOT, 'public/assets'))
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /[.\s]version\b(?!\s*[:=(])/.test(read(`public/assets/${f}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')) && /\.version\b/.test(read(`public/assets/${f}`)));
  assert.deepEqual(readers, [], `a browser file reads .version now — the comment in engine.js needs the reader named`);
  const words = commentAbove(read('src/engine.js'), /\n      version: 0,/);
  assert.doesNotMatch(words, /clients can spot|re-key/i, 'the comment still credits clients with reading version');
  assert.match(words, /nothing in the browser|no browser|reads it/i, 'the comment does not say what actually reads it');
});
