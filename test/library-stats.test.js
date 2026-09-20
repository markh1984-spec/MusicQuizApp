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

import { recordLaunch, readStats, statsFor, statsReadable, HOUSE_ROOM } from '../src/library.js';
import { HOUSE } from '../src/rooms.js';
import { withoutComments } from './console-source.js';

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

/*
 * ------------------------------------------------------------------ WHOLE
 *
 * THE COUNTS FILE COULD DESTROY ITSELF, PERMANENTLY AND IN SILENCE, and the
 * damage was not the truncation — it was everything that happened next.
 *
 * A bare `writeFileSync` truncates before it writes, so a crash, a full disk
 * or a deploy landing mid-write leaves half a file. Then `readStats()` catches
 * the parse error and returns `{}` saying nothing; the NEXT launch writes that
 * `{}` back over the wreck, so the history is destroyed rather than merely
 * unreadable; the backup push carries the empty one to the private repository;
 * and the boot restore skips the good copy for ever, because its guard was
 * `existsSync` and a truncated file exists.
 *
 * What is lost is every play count and every `lastPlayedAt` — so the shelf's
 * ranking and the whole *heard here* answer read as never-played at a venue
 * that heard the pack last Thursday, which is the app confidently telling the
 * host the opposite of the truth.
 */

test('A TRUNCATED COUNTS FILE IS NOT "ALREADY HERE" — `existsSync` said it was', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-whole-'));
  const file = path.join(dir, 'library-stats.json');

  assert.equal(statsReadable(dir), false, 'a missing file is not readable either');

  // Exactly what a half-finished write leaves behind.
  fs.writeFileSync(file, '{"rooms":{"house":{"quiz:eighties":{"playCount":7', 'utf8');
  assert.equal(fs.existsSync(file), true, 'the old guard is satisfied by this');
  assert.equal(statsReadable(dir), false, 'and the new one is not');
  assert.deepEqual(readStats(dir), {}, 'the reader still fails soft, which is why it was silent');

  fs.writeFileSync(file, JSON.stringify({ rooms: { [HOUSE_ROOM]: {} } }), 'utf8');
  assert.equal(statsReadable(dir), true);

  fs.rmSync(dir, { recursive: true, force: true });
});

/*
 * READ AS TEXT, because atomicity is not observable from outside a write that
 * SUCCEEDS — and a test that cannot tell the two implementations apart is
 * worse than none, since it reports the fault as fixed. The first version of
 * this asserted only that no `.tmp` file survived, which is true of the bare
 * `writeFileSync` as well: it passed with the fault put back.
 *
 * `score-writes.test.js` reads the engine the same way and for the same
 * reason. It is aimed at the two files that were WRONG rather than at every
 * write in the module — a broad scan here needs a growing exceptions list
 * (per-pack and per-night files are fine half-written; they are one night
 * nobody has filed, not a ledger overwritten), and a test needing one of
 * those has stopped being a test.
 */
test('the two ledgers that read themselves back are written whole', () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const read = (f) => withoutComments(fs.readFileSync(path.join(here, '..', f), 'utf8'));

  const library = read('src/library.js');
  assert.match(library, /writeWhole\(statsPath\(dataDir\)/,
    'the play counts must go through the atomic writer');
  assert.doesNotMatch(library, /fs\.writeFileSync\(statsPath\(/,
    'the play counts are written bare again — a crash mid-write destroys them '
    + 'and the boot restore will not rescue a file that exists');

  const offers = read('src/offers.js');
  assert.match(offers, /renameSync\(/,
    'offer-opens.json is written bare again — same fault, same silence');
});

test('a launch leaves no temporary file behind, and counts on', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-atomic-'));

  recordLaunch(dir, 'quiz', 'eighties', 1000, HOUSE_ROOM);
  assert.equal(statsReadable(dir), true, 'the file it just wrote must parse');

  /*
   * THE TEMPORARY FILE IS NOT LEFT LYING ABOUT — a rename that never happened
   * would leave `.tmp` in the data directory for ever. This does NOT prove
   * the write is atomic: a successful bare write leaves no `.tmp` either,
   * which is why the source check above exists.
   */
  const left = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(left, [], `a temporary file survived the write: ${left.join(', ')}`);

  recordLaunch(dir, 'quiz', 'eighties', 2000, HOUSE_ROOM);
  assert.equal(statsFor(readStats(dir), HOUSE_ROOM)['quiz:eighties'].playCount, 2,
    'and it still counts');

  fs.rmSync(dir, { recursive: true, force: true });
});
