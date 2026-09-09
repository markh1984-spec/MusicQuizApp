/**
 * A TAB ID IS NOT A GAME KIND.
 *
 * The launch bar's game dropdown was built from every `TABS` entry carrying
 * `packs` + `needs` — quiz and bingo until the round tabs landed, and then
 * five. So the picker offered General Knowledge, Image Rounds and Music
 * Intros, sent `gameOf().id` to `/api/host/launch` as `game`, and the launch
 * answered `400 Unknown game: text`. Three of five entries dead, on the
 * protected surface, from a change to a tab list.
 *
 * `GAME_KINDS` in `console.js` is the browser's half and `LAUNCHERS` in
 * `session.js` is the server's. **They are two lists that mean one thing**,
 * so a third game adds a line to both — and this fails the moment one moves
 * without the other, which is the whole reason to write it down twice rather
 * than derive one from the other across a wire.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Session } from '../src/session.js';

/*
 * READ AS TEXT, because `console.js` is a browser module — it touches
 * `localStorage` at import time and cannot be loaded in node. So the LIST is
 * a string here, but the CLAIM is fired: each kind goes through the real
 * `session.launch()`, which is the function that produced the 400.
 */
const consoleSrc = fs.readFileSync(new URL('../public/assets/console.js', import.meta.url), 'utf8');
const declared = consoleSrc.match(/export const GAME_KINDS = \[([^\]]*)\]/);
const GAME_KINDS = declared ? [...declared[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];

test('GAME_KINDS is there at all, or every check below is measuring nothing', () => {
  assert.ok(GAME_KINDS.length, 'could not find GAME_KINDS in console.js');
});

test('every GAME_KINDS entry is a kind the server can actually launch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-kinds-'));
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store,
    onPush: () => {},
    paths: { archive: dir },
  });
  for (const kind of GAME_KINDS) {
    // `launch()` throws `Unknown game: x` for anything not in LAUNCHERS, which
    // is the exact 400 the console was producing. Asked of the artefact rather
    // than of a string in a file.
    assert.doesNotThrow(
      () => { try { session.launch(kind, 'no-such-pack'); } catch (err) { if (/Unknown game/.test(err.message)) throw err; } },
      `the console offers "${kind}", which the server refuses as a game`,
    );
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('and the server can launch every kind the console offers — both ways', () => {
  const src = fs.readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const LAUNCHERS = {'));
  const kinds = [...block.slice(0, block.indexOf('\n};')).matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]);
  assert.ok(kinds.length, 'could not read LAUNCHERS at all — this guard is measuring nothing');
  assert.deepEqual(
    [...kinds].sort(),
    [...GAME_KINDS].sort(),
    'LAUNCHERS and GAME_KINDS disagree: a game the console cannot offer, or one it offers and the server refuses',
  );
});

test('a round tab is NOT offered as a game, however much it looks like one', () => {
  for (const id of ['text', 'images', 'intro']) {
    // It still LOOKS like one — `packs` and `needs`, which is exactly what the
    // old filter asked for. If that stops being true this guard has gone stale
    // rather than passing.
    assert.match(consoleSrc, new RegExp(`id: '${id}',`), `${id} is no longer a tab, so this guard is stale`);
    assert.ok(!GAME_KINDS.includes(id), `${id} is a round shelf, not a game`);
  }
});
