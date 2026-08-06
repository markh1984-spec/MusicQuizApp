/**
 * The house rules the in-app generator asks for, and the join between the two
 * halves of how a round actually gets made.
 *
 * Claude in a browser picks the songs now and prints them as "Title — Artist".
 * The most valuable test here is the one that reads that back: if the printer
 * and the reader ever disagree, a host pastes a perfectly good round and is
 * told there are no tracks in it, with a gig booked.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { rulesBlock, trackRules } from '../src/bingo-rules.js';
import { parseTrackList } from '../src/import-bingo.js';

test('what it asks Claude to print is what the importer can read', () => {
  // The two ends of the same workflow: if this ever disagrees, a host pastes a
  // perfectly good reply and is told there are no tracks in it.
  const reply = [
    'Billie Jean — Michael Jackson',
    'Take On Me — a-ha',
    'Stand by Me — Ben E. King',
    "Don't Stop Me Now — Queen",
  ].join('\n');
  const tracks = parseTrackList(reply);
  assert.equal(tracks.length, 4);
  assert.deepEqual(tracks[0], { title: 'Billie Jean', artist: 'Michael Jackson' });
  assert.deepEqual(tracks[2], { title: 'Stand by Me', artist: 'Ben E. King' });
});

test('the rules read as one bullet per rule, not one per line', () => {
  const block = rulesBlock();
  const bullets = block.split('\n').filter((l) => l.startsWith('- '));
  assert.equal(bullets.length, trackRules().length);
  // Continuation lines are indented under their bullet rather than dangling.
  for (const line of block.split('\n')) {
    assert.ok(line.startsWith('- ') || line.startsWith('  '), `stray line: ${line}`);
  }
});

test('the chorus rule survives, because it is the one people drop', () => {
  // The host plays one chorus and moves on. A song recognisable only from a
  // long intro is a poor pick however famous — this is the rule that makes the
  // difference between a good round and a quiet one.
  assert.match(rulesBlock(), /THE CHORUS is what gets played/);
  });
