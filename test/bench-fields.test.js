/**
 * THE POST GIG BENCH READS THE FIELDS THE SERVER ACTUALLY SENDS.
 *
 * Both faults this file guards were the same shape and neither made anything
 * fail: **a screen reading a field name that is never in the payload.** No
 * error, no 500, no failing test — just a line that silently never draws, or a
 * button permanently stuck on one of its two labels.
 *
 * 1. The bench totted up `g.playerCount`. `mergeGigs()` emits `players`, which
 *    is what the gig row below it has always read. So *"22 played"* never once
 *    appeared on the bench tile: every night on it looked like a night nobody
 *    came to.
 * 2. The bench read `night.published` off the LIST payload, which never had it
 *    — only the per-night route did. So *Put it on the gallery* could never
 *    become *Take it off the gallery*, and every press posted `on: true`. **A
 *    night could be published and never taken down**, on the one control this
 *    app promises a quizmaster can undo while stood there.
 *
 * It is the arcade-board fault again — computed on one side, read on the
 * other, nothing making the two agree — so this asserts the contract rather
 * than either half.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeGigs } from '../src/past-gigs.js';

const CONSOLE = readFileSync(new URL('../public/assets/console.js', import.meta.url), 'utf8');
const SERVER = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

/** A function's source: from its definition to the next top-level one after it.
 *  (Bounding on an arbitrary later string is how the first version of this
 *  silently sliced backwards and asserted against an empty string.) */
function bodyOf(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return '';
  const next = src.indexOf('\nfunction ', at + marker.length);
  return src.slice(at, next < 0 ? src.length : next);
}


test('a merged night names its headcount `players`, and the bench reads that', () => {
  const [night] = mergeGigs([
    // `archivedAt` is epoch milliseconds, and the night rolls over at 6am — so
    // a quiz that finished at ten and the bingo after it are one night.
    { id: 'g1', archivedAt: Date.UTC(2026, 7, 14, 22, 10), kind: 'quiz', title: 'A quiz', playerCount: 22, venue: 'The Crown' },
    { id: 'g2', archivedAt: Date.UTC(2026, 7, 14, 23, 40), kind: 'bingo', title: 'Some bingo', playerCount: 31, venue: 'The Crown' },
  ], []);

  // What the server really emits.
  assert.equal(night.night, '2026-08-14');
  assert.equal(night.games.length, 2);
  assert.equal(night.games[0].players, 22);
  assert.equal(night.games[0].playerCount, undefined,
    'mergeGigs has been changed — the bench and the gig row both read `players`');

  // The MAX across the games, never the sum: a quiz and the bingo after it are
  // the same room. Same rule as src/headcounts.js.
  const heads = Math.max(0, ...night.games.map((g) => g.players || 0));
  assert.equal(heads, 31);

  // And what the bench reads.
  const bench = bodyOf(CONSOLE, 'function nightBenchPanel(');
  assert.doesNotMatch(bench, /g\.playerCount/,
    'the bench is back on `playerCount`, which is not in the payload');
  assert.match(bench, /g\.players/, 'the bench has stopped reading the headcount at all');
});

/*
 * The published half cannot be exercised here — `PHOTO_REPO` is not configured
 * in a test environment, so every repo call fails closed and
 * `publishedNights()` returns []. `test/gallery.test.js` says the same thing
 * about the same limit. What CAN be checked is that the list route sends the
 * field the bench reads, which is the half that was actually missing.
 */
test('the past-gigs LIST carries `published`, not only the per-night route', () => {
  const route = SERVER.slice(
    SERVER.indexOf("route === '/api/past-gigs'"),
    SERVER.indexOf("route.startsWith('/api/past-gigs/')"),
  );
  assert.ok(route.length > 0, 'the past-gigs list route has moved');
  assert.match(route, /publishedNights\(/, 'the list never asks which nights are published');
  assert.match(route, /published: true/, 'and never marks them');
  // One file read for the whole list, not a call per night — the archive can
  // be hundreds of nights long.
  assert.equal([...route.matchAll(/await publishedNights\(/g)].length, 1);
  assert.doesNotMatch(route, /isPublished\(/, 'a per-night lookup has crept into the list route');
});

test('the bench can say both things, so a night can come back down', () => {
  const bench = bodyOf(CONSOLE, 'function nightBenchPanel(');
  assert.match(bench, /Take it off the gallery/, 'no way to unpublish');
  assert.match(bench, /Put it on the gallery/, 'no way to publish');
  assert.match(bench, /on: !night\.published/, 'the toggle does not send the opposite of what it shows');
});
