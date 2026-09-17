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

/*
 * AND ONE GAME IS DELIBERATELY NOT ON THE QUIZ CONSOLE'S PICKER.
 *
 * A DJ set is a launcher with its own front door: the quizmaster's game
 * dropdown picks what tonight's PACK is played as, and there is no DJ pack to
 * play — offering it there would put a third option on the protected launch
 * path that nobody at a pub quiz wants.
 *
 * So the two lists are still checked in BOTH directions, with the exception
 * NAMED rather than the equality dropped — and the name is itself asserted,
 * so an entry that stops being a real launcher fails here rather than sitting
 * in a list excusing nothing. **One named entry with a reason is not an
 * exceptions list**; a second one arriving is the moment to ask whether the
 * console's picker and the server's launchers have genuinely come apart.
 */
const NOT_ON_THE_CONSOLE = ['dj'];

test('and the server can launch every kind the console offers — both ways', () => {
  const src = fs.readFileSync(new URL('../src/session.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const LAUNCHERS = {'));
  const kinds = [...block.slice(0, block.indexOf('\n};')).matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]);
  assert.ok(kinds.length, 'could not read LAUNCHERS at all — this guard is measuring nothing');

  for (const kind of NOT_ON_THE_CONSOLE) {
    assert.ok(kinds.includes(kind), `${kind} is excused from the console's picker and is not a launcher at all`);
    assert.ok(!GAME_KINDS.includes(kind), `${kind} is on the console's picker, so it needs no excusing`);
  }

  assert.deepEqual(
    kinds.filter((k) => !NOT_ON_THE_CONSOLE.includes(k)).sort(),
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

/*
 * AND EVERY GAME KIND HAS A SHELF TO RESOLVE AGAINST.
 *
 * `shelfOf()` was `kind === 'bingo' ? library.bingo : library.quizzes` in two
 * modules — the kind test written when there were two games, fifth sighting.
 * Card Bingo fell into the `else` and resolved against the QUIZZES, where a
 * deck has never been, so Tonight decided the pack was not there and threw it
 * out again. By drag and by tap, silently, with the card still looking
 * draggable — and Tonight is the only way to launch, so the whole game was
 * unreachable from the console while every screen drew correctly.
 */
/*
 * `console-state.js` READS `localStorage` AT MODULE LOAD, being a browser file
 * — so node needs the shim before the import, not after. It is the smallest
 * stand-in that satisfies the two calls that run, deliberately: a fuller fake
 * would be a second implementation of the browser to keep correct.
 */
function withLocalStorage() {
  if (!globalThis.localStorage) {
    const box = new Map();
    globalThis.localStorage = {
      getItem: (k) => (box.has(k) ? box.get(k) : null),
      setItem: (k, v) => box.set(k, String(v)),
      removeItem: (k) => box.delete(k),
    };
  }
  return import('../public/assets/console-state.js');
}

test('every kind on GAME_KINDS resolves to its OWN shelf, never the quizzes', async () => {
  const state = await withLocalStorage();
  state.setLibrary({
    quizzes: [{ id: 'a-quiz' }],
    bingo: [{ id: 'a-bingo' }],
    cards: [{ id: 'deck' }],
  });
  assert.deepEqual(state.shelfOf('quiz').map((p) => p.id), ['a-quiz']);
  assert.deepEqual(state.shelfOf('bingo').map((p) => p.id), ['a-bingo']);
  assert.deepEqual(state.shelfOf('cards').map((p) => p.id), ['deck'],
    'a deck comes off the CARDS shelf — this is the bug that made Card Bingo unlaunchable');
  assert.deepEqual(state.shelfOf('made-up'), [],
    'an unknown kind gets nothing rather than quietly borrowing the quizzes');
});

test('GAME_KINDS and shelfOf cannot part company', async () => {
  const shell = fs.readFileSync(new URL('../public/assets/console.js', import.meta.url), 'utf8');
  const kinds = JSON.parse((shell.match(/GAME_KINDS = (\[[^\]]*\])/) || [])[1].replace(/'/g, '"'));
  const state = await withLocalStorage();
  state.setLibrary({ quizzes: [{ id: 'q' }], bingo: [{ id: 'b' }], cards: [{ id: 'c' }] });
  for (const k of kinds) {
    assert.equal(state.shelfOf(k).length, 1, `${k} is on GAME_KINDS but has no shelf in shelfOf()`);
  }
});
