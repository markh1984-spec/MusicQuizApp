/**
 * "Never played" has to mean YOUR nights.
 *
 * The pack library is shared — the owner writes the quizzes and everybody runs
 * them — but how many times a pack has been played is a fact about a
 * quizmaster's own nights, not about the file. Counted globally it would tell
 * Rob that a quiz he has never opened was played twice last week, which is
 * worse than no count at all: the only use of that line is deciding what not
 * to run at the same venue again.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { recordLaunch, readStats, statsFor, HOUSE_ROOM } from '../src/library.js';
import { HOUSE } from '../src/rooms.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-stats-'));
}

test('two quizmasters running the same pack keep separate counts', () => {
  const dir = tmp();
  recordLaunch(dir, 'quiz', 'eighties', 1000, HOUSE_ROOM);
  recordLaunch(dir, 'quiz', 'eighties', 2000, HOUSE_ROOM);
  recordLaunch(dir, 'quiz', 'eighties', 3000, 'rob');

  const stats = readStats(dir);
  assert.equal(statsFor(stats, HOUSE_ROOM)['quiz:eighties'].playCount, 2);
  assert.equal(statsFor(stats, 'rob')['quiz:eighties'].playCount, 1);
  assert.equal(statsFor(stats, 'rob')['quiz:eighties'].lastPlayedAt, 3000);
});

test('a pack somebody else has played still reads as never played to you', () => {
  const dir = tmp();
  recordLaunch(dir, 'quiz', 'madonna', 1000, 'rob');
  assert.equal(statsFor(readStats(dir), 'james')['quiz:madonna'], undefined);
});

/*
 * This file was flat — `{"quiz:eighties": {...}}` — before rooms existed, and
 * back then there was only one game, so everything in it was the house's.
 * Reading it as anybody's would hand a brand new quizmaster somebody else's
 * history; throwing it away would reset the counts it is the point of.
 */
test('counts recorded before rooms existed belong to the house', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'library-stats.json'), JSON.stringify({
    'quiz:eighties': { playCount: 7, lastPlayedAt: 500 },
  }), 'utf8');

  const stats = readStats(dir);
  assert.equal(statsFor(stats, HOUSE_ROOM)['quiz:eighties'].playCount, 7, 'the house keeps them');
  assert.equal(statsFor(stats, 'rob')['quiz:eighties'], undefined, 'and nobody else inherits them');
});

test('the old flat shape is folded into the house on the next launch, not doubled', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'library-stats.json'), JSON.stringify({
    'quiz:eighties': { playCount: 7, lastPlayedAt: 500 },
  }), 'utf8');

  recordLaunch(dir, 'quiz', 'eighties', 9000, HOUSE_ROOM);

  const stats = readStats(dir);
  assert.equal(stats['quiz:eighties'], undefined, 'the flat key is gone');
  assert.equal(stats.rooms[HOUSE_ROOM]['quiz:eighties'].playCount, 8, 'and it counted on from 7');
  assert.equal(statsFor(stats, HOUSE_ROOM)['quiz:eighties'].playCount, 8, 'read back once, not twice');
});

/*
 * Two constants holding the same string in two files is the drift this
 * codebase keeps getting bitten by. If they ever disagree, launches are filed
 * under a room nothing reads and the count silently stays on zero.
 */
test('the house room is one string, not two that happen to match', () => {
  assert.equal(HOUSE, HOUSE_ROOM);
});
