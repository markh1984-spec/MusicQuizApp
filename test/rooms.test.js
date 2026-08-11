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

// ================================================ launching over a live night

/**
 * **The collision a shared login makes, and the guard that names it.**
 *
 * `session.launch()` builds a fresh game unconditionally — so before this,
 * two people on one login could end each other's night mid-question: scores
 * gone, every phone thrown back into a lobby, in front of a paying room, with
 * nothing anywhere saying why. Reachable today by password sharing, which is
 * exactly what happens when somebody decides three subscriptions are too many.
 *
 * The console had a check, and it was blind to precisely that case: it read a
 * snapshot taken when the page loaded, so a console opened before the other
 * device launched reported nothing running and went straight ahead. Same
 * lesson as the tier lever — a guard that only lives in the browser is
 * decoration.
 */
function withGame(fn) {
  const { rooms, cleanup } = sandbox();
  try {
    return fn(rooms.get('acct-rob').session);
  } finally {
    cleanup();
  }
}

test('an empty game is not something a launch has to protect', () => {
  withGame((session) => {
    // The ordinary case this must never get in the way of: the wrong pack went
    // up and it is being replaced ten seconds later, with nobody in the room.
    assert.equal(session.inProgress(), null);
  });
});

test('a launch says what it is about to destroy, with the player count in it', () => {
  withGame((session) => {
    session.engine.join('Team One');
    session.engine.join('Team Two');

    const live = session.inProgress();
    assert.ok(live, 'a game with players in it reported nothing to lose');
    assert.equal(live.players, 2);
    assert.ok(live.title, 'nothing to name in the warning');
    // `where()` is optional on an engine, so this must not be assumed.
    assert.equal(typeof live.at, 'string');
  });
});

/*
 * ANY joined player counts, lobby or not.
 *
 * The obvious version guards a game that is past the lobby — but forty people
 * who have typed a team name and are waiting for the first question have
 * something to lose too, and "everybody type your name in again" is not a
 * thing anybody says on a mic.
 */
test('somebody waiting in the lobby counts as somebody with something to lose', () => {
  withGame((session) => {
    assert.equal(session.engine.state.phase, 'lobby');
    session.engine.join('Only Me');
    assert.equal(session.inProgress().players, 1);
  });
});

test('the guard is only advisory — a deliberate launch still replaces the game', () => {
  withGame((session) => {
    session.engine.join('Team One');
    const before = session.pack.id;
    // The server refuses the FIRST press and lets a second one through; the
    // session itself must stay willing, or there would be no way to restart a
    // night that genuinely needs restarting.
    session.launch(session.kind, before);
    assert.equal(session.inProgress(), null, 'the new game kept the old players');
  });
});

/*
 * And the guard has to be on the SERVER.
 *
 * The console had one and it was blind to the case that matters, because it
 * read a snapshot taken when the page loaded. This pins the route, because a
 * guard that quietly went missing would look exactly like it working — the
 * failure only shows up when two people are launching at once, which is
 * never on the machine anybody is testing on.
 */
test('the launch route asks the session what is live, and offers a second press', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const at = server.indexOf("if (action === 'launch')");
  assert.ok(at > 0, 'the launch route has moved');
  const route = server.slice(at, at + 3000);

  assert.match(route, /session\.inProgress\(\)/, 'the launch route no longer checks for a night in progress');
  assert.match(route, /409/, 'a collision is not reported as a conflict');
  // Advisory, never a wall: there are real reasons to launch over a live game
  // and a control that simply refuses is the mistake this codebase records.
  assert.match(route, /body\.replace/, 'there is no way to launch over a live game deliberately');
});

/*
 * A night that ends has to be KEPT.
 *
 * The archive lives in `data/`, which on a host with no permanent disk is empty
 * again after every deploy — so before this a quizmaster's whole history
 * vanished whenever anybody pushed a commit, and the only clue was a Past gigs
 * page that used to have things on it and now did not.
 *
 * The room tells somebody else; it does not do the backing up itself. Same
 * shape as `onSpend` on the generators, and for the same reason — this file has
 * no business knowing that GitHub exists.
 */
test('a room says when a night has been archived, so it can be backed up', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-'));
  try {
    const config = { ...appConfig, dataDir: dir };
    const paths = { state: path.join(dir, 'state.json'), photos: path.join(dir, 'photos') };
    const told = [];
    const rooms = new Rooms({ config, paths, onPush: () => {}, onArchive: (room) => told.push(room.id) });

    const rob = rooms.get('acct-rob');
    rob.session.run('finish', {});

    assert.deepEqual(told, ['acct-rob'], 'nobody was told the night had been filed');
    // And which room it was has to travel with it, or a backup would have no
    // way of knowing whose history it was writing.
    assert.equal(fs.readdirSync(rob.paths.archive).filter((f) => f.endsWith('.json')).length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a restored join code is the SAME code, and a disk with codes on it wins', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-'));
  try {
    const config = { ...appConfig, dataDir: dir };
    const paths = { state: path.join(dir, 'state.json'), photos: path.join(dir, 'photos') };
    const kept = [];
    const rooms = new Rooms({ config, paths, onPush: () => {}, onCodes: (s) => kept.push(s) });

    const code = rooms.codeFor('acct-rob');
    assert.match(code, /^[0-9A-Z]{4,8}$/);
    assert.ok(kept.length, 'nothing was told the code had been minted');

    // A fresh server, no disk — the printed QR still has to work.
    fs.rmSync(path.join(dir, 'room-codes.json'), { force: true });
    const after = new Rooms({ config, paths, onPush: () => {} });
    assert.equal(after.restoreCodes(kept[kept.length - 1]).ok, true);
    assert.equal(after.codeFor('acct-rob'), code, 'a deploy reissued a code that is already on a printed card');

    // …and a disk that already has codes on it is ahead of any backup.
    assert.equal(after.restoreCodes(JSON.stringify({ 'acct-rob': 'ZZZZ' })).reason, 'already_have_some');
    assert.equal(after.codeFor('acct-rob'), code);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
