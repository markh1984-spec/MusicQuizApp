/**
 * Reading a track list out of whatever Claude sends back.
 *
 * This exists because a real generation failed on the night with nothing but
 * "Claude did not return usable JSON" to go on. A reply that is a bit chatty,
 * or one that ran out of room halfway through the fifty-sixth track, is still
 * worth having — we ask for sixty-odd and only need forty.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readTracks } from '../src/generate-bingo.js';

const OPENING = '{"tracks":[';

test('a clean reply reads straight through', () => {
  const tracks = readTracks(`${OPENING}{"title":"Billie Jean","artist":"Michael Jackson"},{"title":"Take On Me","artist":"a-ha"}]}`);
  assert.deepEqual(tracks, [
    { title: 'Billie Jean', artist: 'Michael Jackson' },
    { title: 'Take On Me', artist: 'a-ha' },
  ]);
});

test('a reply cut off mid-track keeps every whole one before it', () => {
  // What a max_tokens truncation actually looks like: no closing bracket, and
  // a final object that stops in the middle of a word.
  const cut = `${OPENING}{"title":"Billie Jean","artist":"Michael Jackson"},`
    + `{"title":"Take On Me","artist":"a-ha"},`
    + `{"title":"Blue Mon`;
  const tracks = readTracks(cut);
  assert.equal(tracks.length, 2, 'the two complete ones survive');
  assert.equal(tracks[1].title, 'Take On Me');
});

test('a chatty reply still gives up its tracks', () => {
  const chatty = `Here are forty songs for you:

\`\`\`json
{"tracks":[{"title":"Blue Monday","artist":"New Order"}]}
\`\`\`

Hope that helps!`;
  assert.deepEqual(readTracks(chatty), [{ title: 'Blue Monday', artist: 'New Order' }]);
});

test('a bare array works as well as the wrapped shape', () => {
  assert.deepEqual(
    readTracks('[{"title":"Africa","artist":"Toto"}]'),
    [{ title: 'Africa', artist: 'Toto' }],
  );
});

test('anything with no tracks in it reads as none, rather than throwing', () => {
  assert.deepEqual(readTracks('I cannot help with that.'), []);
  assert.deepEqual(readTracks(''), []);
  assert.deepEqual(readTracks(null), []);
});

test('a track with no artist is kept — Spotify can usually still find it', () => {
  assert.deepEqual(readTracks('[{"title":"Africa"}]'), [{ title: 'Africa', artist: '' }]);
});
