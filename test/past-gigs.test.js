/**
 * Past gigs — the record of what somebody has actually run.
 *
 * What the tests are for here is not the layout, which will move. It is the
 * four things that make the page trustworthy: two quizmasters' photographs are
 * never in one folder, one evening is one row however late it finished, a night
 * survives a deploy, and a restore can never write over a disk that already has
 * history on it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { photoFolder, isNightFolder, nightOfGig, mergeGigs, safePhotoName } from '../src/past-gigs.js';
import { archiveResults, serialiseArchive, restoreArchive, listArchive, HOUSE_ROOM } from '../src/library.js';
import { nightOf } from '../src/photos.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gigs-'));
}

// --------------------------------------------------------------- the folders

test('the house keeps the flat photo folder it has always used', () => {
  // Mark already has nights filed under photos/<date>/. Moving them would make
  // his own history disappear off the page that exists to show it.
  assert.equal(photoFolder(HOUSE_ROOM), 'photos');
  assert.equal(photoFolder(), 'photos');
});

test('every other quizmaster gets a folder of their own', () => {
  assert.equal(photoFolder('acc_rob'), 'photos/acc_rob');
  assert.notEqual(photoFolder('acc_rob'), photoFolder('acc_james'));
});

test('only something shaped like a date counts as a night', () => {
  assert.ok(isNightFolder('2026-08-11'));
  assert.ok(!isNightFolder('notes'));
  assert.ok(!isNightFolder('..'));
  assert.ok(!isNightFolder('2026-08'));
});

test('a photo name has to be one this app issued', () => {
  assert.equal(safePhotoName('pm1a2b30.jpg'), 'pm1a2b30.jpg');
  assert.equal(safePhotoName('a.png'), 'a.png');
  // The names come back through a listing, so they are checked before they are
  // used to build a path rather than trusted because they started out as ours.
  assert.equal(safePhotoName('../../accounts.json'), '');
  assert.equal(safePhotoName('shell.sh'), '');
  assert.equal(safePhotoName('a b.jpg'), '');
});

// ------------------------------------------------------- one evening, one row

test('a gig that finishes after midnight is filed under the night it started', () => {
  // 00:30 on the 12th is still Tuesday the 11th's gig. It HAS to match the
  // photos' own roll-over or one evening appears twice on the page — half the
  // games under one date and all the pictures under another.
  const halfTwelve = Date.parse('2026-08-12T00:30:00Z');
  assert.equal(nightOfGig(halfTwelve), '2026-08-11');
  assert.equal(nightOfGig(halfTwelve), nightOf(halfTwelve));
});

test('a quiz and the bingo after it are one night with two games', () => {
  const at = Date.parse('2026-08-11T21:00:00Z');
  const nights = mergeGigs([
    { id: 'a', kind: 'quiz', title: 'The Eighties', archivedAt: at, playerCount: 31, winner: 'Quizteama' },
    { id: 'b', kind: 'bingo', title: 'Disco Funk', archivedAt: at + 40 * 60 * 1000, playerCount: 28, winner: 'Bingo Wings' },
  ], []);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].games.length, 2);
  assert.deepEqual(nights[0].games.map((g) => g.title), ['The Eighties', 'Disco Funk']);
});

test('a night with photos and no saved results still appears', () => {
  // The archive only started being kept permanently recently, and somebody can
  // finish a night by launching something else. Photographs are evidence the
  // gig happened; dropping the night because the results are missing would
  // hide real work.
  const nights = mergeGigs([], ['2026-07-04']);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].hasPhotos, true);
  assert.deepEqual(nights[0].games, []);
});

test('nights come back newest first', () => {
  const nights = mergeGigs([], ['2025-12-31', '2026-08-11', '2026-01-02']);
  assert.deepEqual(nights.map((n) => n.night), ['2026-08-11', '2026-01-02', '2025-12-31']);
});

test('a stray folder that is not a date is not a gig', () => {
  assert.deepEqual(mergeGigs([], ['README', 'thumbs']), []);
});

// ------------------------------------------------------- surviving a deploy

test('the whole archive goes out and comes back', () => {
  const from = tempDir();
  archiveResults(from, { packId: 'eighties', title: 'The Eighties', kind: 'quiz', leaderboard: [{ name: 'Quizteama' }] }, Date.parse('2026-08-11T21:30:00Z'));
  archiveResults(from, { packId: 'disco', title: 'Disco Funk', kind: 'bingo', leaderboard: [] }, Date.parse('2026-08-04T21:30:00Z'));

  const serialised = serialiseArchive(from);
  const to = tempDir();
  const result = restoreArchive(to, serialised);

  assert.equal(result.ok, true);
  assert.equal(result.nights, 2);
  assert.deepEqual(listArchive(to).map((n) => n.title), listArchive(from).map((n) => n.title));
});

test('a disk that already has nights on it is ahead of any backup', () => {
  // The same rule as the accounts, the invoice book and the play counts.
  // Reading a backup over the top would either duplicate a night or lose one.
  const dir = tempDir();
  archiveResults(dir, { packId: 'tonight', title: 'Tonight', kind: 'quiz' }, Date.now());
  const result = restoreArchive(dir, JSON.stringify({ nights: [{ id: '2020-01-01-old', title: 'Old' }] }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'already_have_some');
  assert.equal(listArchive(dir).length, 1);
  assert.equal(listArchive(dir)[0].title, 'Tonight');
});

test('a corrupt backup is refused rather than believed', () => {
  const dir = tempDir();
  assert.equal(restoreArchive(dir, 'not json at all').ok, false);
  assert.equal(restoreArchive(dir, JSON.stringify({ something: 'else' })).reason, 'nothing_in_it');
  assert.deepEqual(listArchive(dir), []);
});

test('a night in a backup cannot write outside the archive folder', () => {
  const dir = tempDir();
  const result = restoreArchive(dir, JSON.stringify({ nights: [{ id: '../../escaped', title: 'Nope' }, { id: 'ok-night', title: 'Fine' }] }));
  assert.equal(result.ok, true);
  assert.equal(result.nights, 1);
  assert.deepEqual(fs.readdirSync(dir), ['ok-night.json']);
});

test('serialising a folder that is not there is empty rather than a throw', () => {
  // The normal first boot. A quizmaster who has finished no nights yet must not
  // take a backup down with them.
  const serialised = serialiseArchive(path.join(tempDir(), 'never-made'));
  assert.deepEqual(JSON.parse(serialised), { nights: [] });
});
