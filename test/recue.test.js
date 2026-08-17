/**
 * RE-POINTING AN EDITED INTRO CUE.
 *
 * The bug this closes is the worst shape this app has: the pack reads right on
 * every screen and plays the wrong song, and the person who finds out is
 * standing at a microphone. The rules worth pinning are about what happens
 * when the lookup does NOT go well, because those are the ones that decide
 * whether a bad save is recoverable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { recueQuiz } from '../src/recue.js';

const quizWith = (cues) => ({
  id: 'q', title: 'Q',
  rounds: [{
    name: 'Intros', type: 'intro',
    questions: cues.map((cue) => ({ prompt: 'Name it', options: ['a', 'b'], correctIndex: 0, cue })),
  }],
});

/**
 * The lookup is injected, so no test here touches the network. That is the
 * same reason the clock is injected everywhere else in this codebase.
 */
const withSpotify = ({ configured = true, find = async () => null }) => ({
  recueQuiz: (quiz, previous) => recueQuiz(quiz, previous, { lookup: find, configured: () => configured }),
});

test('a cue whose words changed is looked up again, and Spotify spelling wins', async () => {
  const { recueQuiz } = withSpotify({
    find: async () => ({ title: 'Like a Prayer', artist: 'Madonna', uri: 'spotify:track:NEW', id: 'NEW' }),
  });

  const before = quizWith([{ title: 'Like a Prayr', artist: 'Madona', spotifyUri: 'spotify:track:OLD' }]);
  const after = quizWith([{ title: 'Like a Prayer', artist: 'Madonna', spotifyUri: 'spotify:track:OLD' }]);

  const out = await recueQuiz(after, before);
  const cue = after.rounds[0].questions[0].cue;
  assert.equal(cue.spotifyUri, 'spotify:track:NEW', 'the uri still pointed at the old recording');
  assert.equal(cue.title, 'Like a Prayer');
  assert.equal(out.matched.length, 1);
});

test('a cue nobody touched is NOT looked up', async () => {
  let calls = 0;
  const { recueQuiz } = withSpotify({
    find: async () => { calls++; return null; },
  });

  const cue = { title: 'Like a Prayer', artist: 'Madonna', spotifyUri: 'spotify:track:OLD' };
  const out = await recueQuiz(quizWith([{ ...cue }]), quizWith([{ ...cue }]));
  assert.equal(calls, 0, 'a comma fixed in another round must not cost twelve Spotify calls');
  assert.equal(out.checked, 0);
});

test('a cue with no uri at all is looked up, even unedited', async () => {
  const { recueQuiz } = withSpotify({
    find: async () => ({ title: 'Vogue', artist: 'Madonna', uri: 'spotify:track:V', id: 'V' }),
  });
  // This is what repairs a pack written by hand or imported without one.
  const q = quizWith([{ title: 'Vogue', artist: 'Madonna' }]);
  const out = await recueQuiz(q, q);
  assert.equal(q.rounds[0].questions[0].cue.spotifyUri, 'spotify:track:V');
  assert.equal(out.matched.length, 1);
});

test('a track Spotify cannot find LOSES its stale uri', async () => {
  const { recueQuiz } = withSpotify({ find: async () => null });

  const before = quizWith([{ title: 'Old Song', artist: 'Old', spotifyUri: 'spotify:track:OLD' }]);
  const after = quizWith([{ title: 'Something Else Entirely', artist: 'Somebody', spotifyUri: 'spotify:track:OLD' }]);

  const out = await recueQuiz(after, before);
  const cue = after.rounds[0].questions[0].cue;
  assert.equal(cue.spotifyUri, undefined,
    'a cue with the WRONG uri plays the wrong song; a cue with none plays nothing, and the '
    + 'host can see silence coming');
  assert.equal(cue.title, 'Something Else Entirely', 'the words they typed are kept');
  assert.equal(out.missed.length, 1);
});

test('a lookup that THREW keeps the cue exactly as it was', async () => {
  const { recueQuiz } = withSpotify({
    find: async () => { throw new Error('spotify is having an evening'); },
  });

  const before = quizWith([{ title: 'A', artist: 'B', spotifyUri: 'spotify:track:OLD' }]);
  const after = quizWith([{ title: 'A2', artist: 'B', spotifyUri: 'spotify:track:OLD' }]);

  const out = await recueQuiz(after, before);
  assert.equal(after.rounds[0].questions[0].cue.spotifyUri, 'spotify:track:OLD',
    'an error tells us nothing about the track — only a definite "not found" clears a uri');
  assert.equal(out.missed.length, 1);
});

test('no Spotify configured is not an error, and saves nothing away', async () => {
  const { recueQuiz } = withSpotify({ configured: false });

  const before = quizWith([{ title: 'A', artist: 'B', spotifyUri: 'spotify:track:OLD' }]);
  const after = quizWith([{ title: 'A2', artist: 'B', spotifyUri: 'spotify:track:OLD' }]);

  const out = await recueQuiz(after, before);
  assert.equal(out.skipped, 'no-spotify');
  assert.equal(after.rounds[0].questions[0].cue.spotifyUri, 'spotify:track:OLD',
    'plenty of quizmasters play the track off their own DJ software and never connect Spotify');
});

test('only INTRO rounds are touched', async () => {
  let calls = 0;
  const { recueQuiz } = withSpotify({ find: async () => { calls++; return null; } });
  const quiz = {
    id: 'q', title: 'Q',
    rounds: [{ name: 'Text', type: 'text', questions: [{ prompt: 'x', options: ['a'], correctIndex: 0, cue: { title: 'Nope' } }] }],
  };
  const out = await recueQuiz(quiz, null);
  assert.equal(calls, 0);
  assert.equal(out.checked, 0);
});
