/**
 * EVERY SCORE WRITE IN THE ENGINE GOES THROUGH `bumpScore()` / `setScore()`.
 *
 * The leaderboard is cached until `changed()` runs, and `changed()` is the
 * LAST thing a host action does — so a line that writes `p.score` and then
 * reads the board in the same action reads a board from before the write.
 * Found live: `adjustScore()` at the final scores paid the drinks off the old
 * board, with every test green. The funnel drops the cache as the write lands;
 * this test is what stops a fourth writer growing back beside it.
 *
 * Read as TEXT with the comments stripped, like the console guards — a
 * comment naming `p.score +=` must not satisfy it, and a real write must not
 * hide behind one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withoutComments } from './console-source.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => withoutComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// A write to somebody's score: `x.score = …`, `+=`, `-=`, `++`, `--`.
const WRITE = /\.score\s*(?:[+\-*/]?=(?!=)|\+\+|--)/g;

test('the engine writes a score in exactly two places, and both drop the board', () => {
  const src = read('src/engine.js');
  const lines = src.split('\n');
  const hits = [];
  lines.forEach((line, i) => { if (WRITE.test(line)) hits.push({ n: i + 1, line: line.trim() }); WRITE.lastIndex = 0; });
  // The two funnel bodies, and nothing else.
  const allowed = hits.filter((h) => h.line === 'player.score += delta;' || h.line === 'player.score = value;');
  assert.equal(allowed.length, 2, `expected the two funnel writes, found: ${JSON.stringify(hits)}`);
  assert.deepEqual(hits, allowed,
    `a score is written outside bumpScore()/setScore() — route it through the funnel, or the board it is read off is stale: ${JSON.stringify(hits.filter((h) => !allowed.includes(h)))}`);
  // And each funnel write is followed by the cache drop, in the same method.
  const body = src.slice(src.indexOf('bumpScore(player, delta) {'), src.indexOf('bumpScore(player, delta) {') + 400);
  assert.equal((body.match(/this\.forgetBoard\(\);/g) || []).length, 2, 'both funnel methods must call forgetBoard()');
});

test('nothing outside the engine writes a quiz score behind its back', () => {
  // The session carries a roster across a part boundary and used to poke
  // `p.score` directly; it asks the engine now. Bingo has no score field.
  for (const f of ['src/session.js', 'src/bingo.js', 'server.js']) {
    const src = read(f);
    const hits = src.split('\n').filter((line) => { const hit = WRITE.test(line); WRITE.lastIndex = 0; return hit; });
    assert.deepEqual(hits, [], `${f} writes a score directly: ${JSON.stringify(hits)}`);
  }
});
