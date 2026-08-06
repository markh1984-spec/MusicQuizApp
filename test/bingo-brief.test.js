/**
 * The brief handed to Claude in a browser.
 *
 * This exists because the app cannot create a Spotify playlist and Claude in a
 * browser can. The risk in moving that step out of the app is that the house
 * rules go with it — especially "do not use anything I have played in the last
 * three months", which is the only reason a regular at a Tuesday night does not
 * hear the same forty songs twice in a season.
 *
 * So: the brief must carry the avoid list, it must ask for the list back in the
 * one shape the importer reads, and it must say the same things about a good
 * bingo track that the in-app generator says.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { bingoBrief, rulesBlock, trackRules } from '../src/bingo-brief.js';
import { parseTrackList } from '../src/import-bingo.js';

const AVOID = [
  { title: 'Billie Jean', artist: 'Michael Jackson' },
  { title: 'Take On Me', artist: 'a-ha' },
];

test('the brief names every song to avoid', () => {
  const text = bingoBrief({ theme: '1980s pop', avoid: AVOID });
  assert.match(text, /Billie Jean — Michael Jackson/);
  assert.match(text, /Take On Me — a-ha/);
  assert.match(text, /played them in the last 3 months/);
});

test('the count of songs to avoid is stated, so a short list is obvious', () => {
  const text = bingoBrief({ theme: '1980s pop', avoid: AVOID });
  assert.match(text, /any of these 2\b/);
});

test('an empty history leaves the avoid section out rather than saying "avoid: none"', () => {
  const text = bingoBrief({ theme: '1980s pop', avoid: [] });
  assert.equal(text.includes('Do not use any of these'), false);
  assert.match(text, /Theme: 1980s pop/);
});

test('it asks for the theme cleaned up, not the way it was typed', () => {
  const text = bingoBrief({ theme: 'can I have a 90s dance bingo round please' });
  assert.match(text, /^Theme: 90s dance$/m);
  // ...and the playlist is not called "90s Dance Bingo Bingo".
  assert.match(text, /playlist called "90s Dance Bingo"/);
});

test('it asks for both halves of the job: the playlist and the list', () => {
  const text = bingoBrief({ theme: 'Motown', count: 40 });
  assert.match(text, /private Spotify playlist/);
  assert.match(text, /one track per line/);
  assert.match(text, /"Title — Artist"/);
  assert.match(text, /code block/);
  assert.match(text, /40 tracks/);
});

test('it insists the printed list is what actually went into the playlist', () => {
  // A pack built from the wished-for list rather than the real one puts a
  // square on somebody's card that can never be marked.
  const text = bingoBrief({ theme: 'Motown' });
  assert.match(text, /print the replacement/);
});

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
  assert.match(bingoBrief({ theme: 'anything' }), /THE CHORUS is what gets played/);
});
