/**
 * WHAT THIS ROOM HAS ALREADY HEARD — `playedByVenue()` in `src/heard.js`.
 *
 * Asked for directly: *"that's a good order but it needs to be per venue as
 * well — if you've done a quiz at venue A and not at venue B recently then
 * this needs to be factored in."* The thing worth testing is exactly that
 * sentence: a pack played at A must still read as never-played at B.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { playedByVenue, heardHere } from '../src/heard.js';
import { archiveResults, listArchive } from '../src/library.js';
import { mergeGigs } from '../src/past-gigs.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-heard-'));
}

/** The real road: file nights, read them back, merge them — never a hand-built object. */
function indexOf(records) {
  const dir = tempDir();
  try {
    for (const r of records) archiveResults(dir, r, r.at);
    return playedByVenue(mergeGigs(listArchive(dir), []));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const DAY = 86400000;
const NOW = Date.parse('2026-08-20T21:00:00Z');

test('THE WHOLE POINT: a pack played at one venue is untouched at another', () => {
  const index = indexOf([
    { at: NOW - DAY, packId: 'eighties', kind: 'quiz', venue: 'The Crown' },
  ]);
  assert.ok(heardHere(index, 'the crown', 'eighties') > 0, 'The Crown has heard it');
  assert.equal(heardHere(index, 'the station tap', 'eighties'), 0, 'The Station Tap has not');
});

test('played at the same venue twice, the LATEST is what counts', () => {
  const index = indexOf([
    { at: NOW - 40 * DAY, packId: 'eighties', kind: 'quiz', venue: 'The Crown' },
    { at: NOW - 2 * DAY, packId: 'eighties', kind: 'quiz', venue: 'The Crown' },
  ]);
  const seen = heardHere(index, 'the crown', 'eighties');
  assert.ok(seen > NOW - 3 * DAY, 'the recent one wins, not the old one');
});

test('one venue typed in two cases is one venue', () => {
  // The same rule the headcounts already follow — both key on venueKeyOf().
  const index = indexOf([
    { at: NOW - DAY, packId: 'eighties', kind: 'quiz', venue: 'The CROWN' },
  ]);
  assert.ok(heardHere(index, 'the crown', 'eighties') > 0);
});

test('A NIGHT ANSWERS TO BOTH ITS ID AND ITS NAME, so neither half is lost', () => {
  /*
   * The split `venueHeadcounts()` was already bitten by, in the other
   * direction: pick a venue off the book one week and type the same name
   * freehand the next, and the two nights land under different keys.
   * Filed under both, either question finds it — the id so a RENAME keeps
   * its history, the name so every night from before ids existed does.
   */
  const index = indexOf([
    { at: NOW - DAY, packId: 'eighties', kind: 'quiz', venue: 'Old Name', venueId: 'v1' },
  ]);
  assert.ok(heardHere(index, 'id:v1', 'eighties') > 0, 'found under the id');
  assert.ok(heardHere(index, 'old name', 'eighties') > 0, 'and under the name');
});

test('THE FREEHAND NIGHT AND THE BOOKED ONE ARE ONE VENUE — asked under both keys', () => {
  /*
   * The real case: months of nights typed by hand, then the pub goes in the
   * Venues book and every launch since carries an id. A pack run there
   * fortnightly for a year must not read as never heard.
   *
   * **THE RECONCILING IS THE READER'S JOB, and it has to be** — nothing on a
   * hand-typed night says which book entry it meant, so the index cannot
   * know. Only the Venues book joins a name to an id, and that lives in the
   * console. So `venueKeysNow()` there asks under BOTH keys and takes the
   * later, which is exactly what this asserts.
   */
  const index = indexOf([
    { at: NOW - 30 * DAY, packId: 'eighties', kind: 'quiz', venue: 'The Crown' },
    { at: NOW - DAY, packId: 'nineties', kind: 'quiz', venue: 'The Crown', venueId: 'v1' },
  ]);
  const asTheConsoleAsks = (packId) => Math.max(
    heardHere(index, 'id:v1', packId),
    heardHere(index, 'the crown', packId),
  );
  assert.ok(asTheConsoleAsks('eighties') > 0, 'the hand-typed night is seen');
  assert.ok(asTheConsoleAsks('nineties') > 0, 'and so is the booked one');
  // And the limit, stated rather than hidden: the id ALONE does not see the
  // hand-typed half. That is why the console never asks with one key.
  assert.equal(heardHere(index, 'id:v1', 'eighties'), 0);
});

test('A NIGHT WITH NO VENUE IS SKIPPED, never filed under an empty key', () => {
  // Filing it under "" would make "nowhere" behave like a venue, and every
  // night from before venues existed would then suppress packs somewhere real.
  const index = indexOf([
    { at: NOW - DAY, packId: 'eighties', kind: 'quiz' },
  ]);
  assert.deepEqual(index, {}, 'nothing is attributed to a venue that was never named');
  assert.equal(heardHere(index, '', 'eighties'), 0);
});

test('A MIXED NIGHT COUNTS EVERY PART, not just the one that reached the archive', () => {
  // Quiz -> bingo -> quiz is ONE record naming the last part. Without reading
  // `parts` the bingo in the middle reads as never played here, for ever.
  const index = indexOf([{
    at: NOW - DAY,
    packId: '~tonight',
    kind: 'quiz',
    venue: 'The Crown',
    parts: [
      { kind: 'quiz', id: '~tonight', title: 'Quiz' },
      { kind: 'bingo', id: 'disco-funk', title: 'Disco & Funk' },
    ],
  }]);
  assert.ok(heardHere(index, 'the crown', 'disco-funk') > 0,
    'the bingo interlude counts as heard at this venue');
});

test('heardHere is total — no index, no venue, no pack, all answer 0', () => {
  assert.equal(heardHere(null, 'the crown', 'eighties'), 0);
  assert.equal(heardHere({}, '', 'eighties'), 0);
  assert.equal(heardHere({}, 'the crown', ''), 0);
});
