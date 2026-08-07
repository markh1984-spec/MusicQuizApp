/**
 * A room per quizmaster.
 *
 * The tests here are the ones that decide whether a second login is safe to
 * hand out. Everything else about rooms is plumbing; these four are the reason
 * the feature exists:
 *
 *   - two quizmasters cannot end up in the same game
 *   - a phone with no code still reaches the game that has always been there
 *   - a room is decided by WHO YOU ARE, never by anything a request carries
 *   - the house room keeps the old file locations, so deploying mid-season
 *     does not lose a night that is being played
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Rooms, HOUSE, newCode, tidyCode } from '../src/rooms.js';
import { config as appConfig, paths as appPaths } from '../src/config.js';

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-'));
  const config = { ...appConfig, dataDir: dir };
  const paths = { state: path.join(dir, 'state.json'), photos: path.join(dir, 'photos') };
  const rooms = new Rooms({ config, paths, onPush: () => {} });
  return { dir, rooms, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('two quizmasters get two different games', () => {
  // The whole point. Rob pressing Launch must not reach Mark's night.
  const { rooms, cleanup } = sandbox();
  try {
    const mark = rooms.get(HOUSE);
    const rob = rooms.get('acct-rob');
    assert.notEqual(mark.session, rob.session);
    assert.notEqual(mark.store, rob.store);
    assert.notEqual(mark.photos, rob.photos);
    assert.notEqual(mark.session.engine, rob.session.engine);
  } finally {
    cleanup();
  }
});

test('the same quizmaster always gets the same game back', () => {
  const { rooms, cleanup } = sandbox();
  try {
    assert.equal(rooms.get('acct-rob'), rooms.get('acct-rob'));
  } finally {
    cleanup();
  }
});

test('the house room keeps the file locations it has always had', () => {
  // Not tidiness: there are gigs in the diary and Mark may deploy between
  // rounds. Moving the state file would bring the app back with no game, no
  // scores and an empty photo wall in front of a room of sixty people.
  const { dir, rooms, cleanup } = sandbox();
  try {
    assert.equal(rooms.pathsFor(HOUSE).state, path.join(dir, 'state.json'));
    assert.equal(rooms.pathsFor(HOUSE).photos, path.join(dir, 'photos'));
    // Anyone else is filed away under their own id.
    assert.match(rooms.pathsFor('acct-rob').state, /rooms[/\\]acct-rob[/\\]state\.json$/);
  } finally {
    cleanup();
  }
});

test('the house room has no join code, so every printed QR still works', () => {
  const { rooms, cleanup } = sandbox();
  try {
    assert.equal(rooms.get(HOUSE).code, '');
    assert.ok(rooms.get('acct-rob').code.length >= 4);
  } finally {
    cleanup();
  }
});

test('a phone with no code lands in the house game', () => {
  const { rooms, cleanup } = sandbox();
  try {
    assert.equal(rooms.byCode(''), null);       // nothing to look up…
    assert.equal(rooms.byCode('   '), null);    // …and the caller falls back to the house
  } finally {
    cleanup();
  }
});

test('a code finds its room, and a wrong one finds nothing at all', () => {
  // Nothing rather than a guess. Sending somebody to the wrong quizmaster's
  // game because two codes look alike is far worse than telling them to look
  // at the screen again.
  const { rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    assert.equal(rooms.byCode(rob.code).id, 'acct-rob');
    assert.equal(rooms.byCode(rob.code.toLowerCase()).id, 'acct-rob', 'typed in lower case');
    assert.equal(rooms.byCode('ZZZZ' + rob.code), null);
    assert.equal(rooms.byCode('nonsense'), null);
  } finally {
    cleanup();
  }
});

test('a code survives a restart', () => {
  // A join code changing under a room that is already scanning it is the one
  // failure this feature cannot have.
  const { dir, rooms, cleanup } = sandbox();
  try {
    const first = rooms.get('acct-rob').code;
    const again = new Rooms({
      config: { ...appConfig, dataDir: dir },
      paths: { state: path.join(dir, 'state.json'), photos: path.join(dir, 'photos') },
      onPush: () => {},
    });
    assert.equal(again.get('acct-rob').code, first);
  } finally {
    cleanup();
  }
});

test('codes never collide', () => {
  const { rooms, cleanup } = sandbox();
  try {
    const codes = new Set();
    for (let i = 0; i < 40; i++) codes.add(rooms.get(`acct-${i}`).code);
    assert.equal(codes.size, 40);
  } finally {
    cleanup();
  }
});

test('the alphabet leaves out everything people misread off a projector', () => {
  // No vowels, so a code cannot spell a word; no O/0 or I/1/L, which are the
  // pairs somebody at the back of a pub types wrong.
  for (let i = 0; i < 200; i++) {
    assert.doesNotMatch(newCode(6), /[AEIOU01L]/, 'a confusable character got in');
  }
});

test('a typed code is tidied but never guessed at', () => {
  assert.equal(tidyCode(' nv7f '), 'NV7F');
  assert.equal(tidyCode('NV-7F'), 'NV7F');
  // An O is not in the alphabet, so it is a misreading. It is kept, so the
  // lookup fails and they are told, rather than silently mapped onto something
  // that might be somebody else's game.
  assert.equal(tidyCode('NO7F'), 'NO7F');
});

test('a room says whether a game is actually being played', () => {
  // The owner's overview uses this to say "Rob is mid-question" before anybody
  // deploys over him.
  const { rooms, cleanup } = sandbox();
  try {
    const room = rooms.get('acct-rob');
    room.session.engine.state.phase = 'lobby';
    assert.equal(room.live, false);
    room.session.engine.state.phase = 'question';
    assert.equal(room.live, true);
    room.session.engine.state.phase = 'final';
    assert.equal(room.live, false);
    // Bingo finishes under a different word, and both count as not live.
    room.session.engine.state.phase = 'finished';
    assert.equal(room.live, false);
  } finally {
    cleanup();
  }
});
