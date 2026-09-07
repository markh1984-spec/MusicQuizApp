/**
 * A PLAYLIST BECOMES AN INTRO ROUND WHOSE ANSWER CANNOT DISAGREE WITH THE SONG.
 *
 * The assertion that matters most is the boring one: for every question, the
 * option marked correct is the same string as the cue that plays. That is a
 * property of how the round is BUILT rather than something checked afterwards,
 * so the test is here to stop somebody making it typed again.
 *
 * Spotify and Claude are both INJECTED, like every clock in this codebase, so
 * no network is touched and the good reply, the failure and the no-key path
 * are all ordinary test cases rather than mocks.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { importIntroRound, sameSong, decoysFromPlaylist, optionsFor, MAX_QUESTIONS } from '../src/import-intro.js';

/* ---- the pure halves, which need nothing stubbed ---------------------- */

test('sameSong sees through a remaster suffix, a feature credit and punctuation', () => {
  assert.equal(sameSong('Duality', 'Duality - 2008 Remaster'), true);
  assert.equal(sameSong('Chop Suey!', 'Chop Suey'), true);
  assert.equal(sameSong('Crazy In Love', 'Crazy in Love (feat. JAY-Z)'), true);
  assert.equal(sameSong('Duality', 'Psychosocial'), false);
  // An empty title matches nothing, or every blank decoy reads as the answer
  // and gets thrown away for the wrong reason.
  assert.equal(sameSong('', ''), false);
  assert.equal(sameSong('', 'Duality'), false);
});

const TRACKS = [
  { title: 'Psychosocial', artist: 'Slipknot', spotifyUri: 'spotify:track:a1' },
  { title: 'Duality', artist: 'Slipknot', spotifyUri: 'spotify:track:a2' },
  { title: 'Before I Forget', artist: 'Slipknot', spotifyUri: 'spotify:track:a3' },
  { title: 'Chop Suey!', artist: 'System of a Down', spotifyUri: 'spotify:track:a4' },
];

test('the playlist fallback prefers the same artist and never offers the answer back', () => {
  const out = decoysFromPlaylist(TRACKS, 0, 3, () => 0.5);
  assert.equal(out.length, 3);
  assert.equal(out.includes('Psychosocial'), false);
  // Two Slipknot tracks exist besides the answer, so both lead.
  assert.deepEqual(out.slice(0, 2).sort(), ['Before I Forget', 'Duality']);
});

test('a decoy that is really the answer is dropped, however it is spelt', () => {
  const { options, correctIndex } = optionsFor(TRACKS, 1, [
    'Duality - 2008 Remaster',  // the answer wearing a suffix
    'Wait and Bleed',
    'Wait And Bleed',           // the same decoy twice
    'Left Behind',
  ]);
  assert.equal(options[correctIndex], 'Duality');
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map((o) => o.toLowerCase())).size, 4);
  assert.deepEqual(options.slice(1), ['Wait and Bleed', 'Left Behind']
    .concat(options.slice(3)));
});

test('too few usable decoys are topped up from the playlist rather than left short', () => {
  const { options, short } = optionsFor(TRACKS, 0, ['Psychosocial', '', '   ']);
  assert.equal(options.length, 4, 'a question must never reach the room with two options');
  assert.equal(short, false);
  assert.equal(options.filter((o) => sameSong(o, 'Psychosocial')).length, 1);
});

test('a playlist too small to fill four options says so rather than repeating one', () => {
  const two = TRACKS.slice(0, 2);
  const { options, short } = optionsFor(two, 0, []);
  assert.equal(short, true);
  assert.equal(new Set(options).size, options.length);
});

/* ---- the whole import ------------------------------------------------- */

/**
 * Spotify is INJECTED, not stubbed.
 *
 * The first version of this reached for the module registry and could not have
 * worked: an ES module namespace is read-only, so `defineProperty` on it
 * throws. `recueQuiz` had already answered this — it takes its `lookup` and
 * `configured` as arguments for exactly this reason — so `importIntroRound`
 * does the same, and the test hands in a playlist rather than a network.
 */
const playlistOf = (tracks) => async () => ({
  name: 'Thursday Intros',
  url: 'https://open.spotify.com/playlist/xyz',
  uri: 'spotify:playlist:xyz',
  tracks,
});
const spotify = (tracks) => ({ readPlaylist: playlistOf(tracks), configured: () => true });

test('every question plays the song its answer key names', async () => {
    const { quiz, count, playlist } = await importIntroRound({
      playlistUrl: 'https://open.spotify.com/playlist/xyz',
      ...spotify(TRACKS),
      ask: null,
      now: () => 0,
      rand: () => 0.5,
    });
    const round = quiz.rounds[0];
    assert.equal(round.type, 'intro');
    assert.equal(count, TRACKS.length);

    for (const q of round.questions) {
      // THE WHOLE POINT OF THE FILE, in one line.
      assert.equal(q.options[q.correctIndex], q.cue.title,
        `"${q.cue.title}" plays but the answer key says "${q.options[q.correctIndex]}"`);
      assert.ok(q.cue.spotifyUri, 'every cue carries the uri it came in with');
      assert.equal(q.cue.from, '0:00', 'a start offset is never guessed');
      assert.equal(q.prompt, 'Which track is this?');
    }

    // THE PLAYLIST IS THE ONE THAT WAS READ. Building a second one is the
    // two-copies-that-drift problem this file exists to remove.
    assert.equal(round.spotifyPlaylist.url, playlist.url);
    assert.equal(round.spotifyPlaylist.uri, 'spotify:playlist:xyz');
});

test('Claude writes the wrong answers and never the right one', async () => {
    let asked = 0;
    const { quiz, fellBack } = await importIntroRound({
      playlistUrl: 'x',
      ...spotify(TRACKS),
      // A reply that tries to make question one's answer "Duality" — which is
      // question two's answer, and would be a decoy that is another question's
      // truth. The right answer is not Claude's to set, so it survives.
      ask: async () => {
        asked += 1;
        return { decoys: TRACKS.map((_, i) => ({ n: i + 1, wrong: ['Duality', 'Snuff', 'Vermilion'] })) };
      },
      now: () => 0,
      rand: () => 0.5,
    });
    assert.equal(asked, 1, 'one call for the whole round, not one per question');
    assert.equal(fellBack, 0);
    for (const q of quiz.rounds[0].questions) {
      assert.equal(q.options[q.correctIndex], q.cue.title);
      assert.equal(q.options.length, 4);
    }
    // Question two's own answer IS "Duality", so the suggestion collided and
    // had to be dropped and topped up — it must not appear twice on that board.
    const two = quiz.rounds[0].questions.find((q) => q.cue.title === 'Duality');
    assert.equal(two.options.filter((o) => sameSong(o, 'Duality')).length, 1);
});

test('Claude failing costs the decoys and never the round', async () => {
    const said = [];
    const { quiz, fellBack } = await importIntroRound({
      playlistUrl: 'x',
      ...spotify(TRACKS),
      ask: async () => { throw new Error('Claude said 529'); },
      log: (line) => said.push(line),
      now: () => 0,
      rand: () => 0.5,
    });
    assert.equal(fellBack, TRACKS.length);
    assert.equal(quiz.rounds[0].questions.length, TRACKS.length);
    for (const q of quiz.rounds[0].questions) {
      assert.equal(q.options[q.correctIndex], q.cue.title);
      assert.equal(q.options.length, 4);
    }
    // SAID OUT LOUD. A round whose decoys all came from the playlist is a
    // different round to read through, and silence about it is the failure
    // this repo keeps recording.
    assert.ok(said.some((l) => /could not get decoys/.test(l)), said.join('\n'));
});

test('the round is trimmed to what was asked for, and capped', async () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    title: `Track ${i + 1}`, artist: 'Someone', spotifyUri: `spotify:track:t${i}`,
  }));
  const ten = await importIntroRound({ playlistUrl: 'x', ...spotify(many), ask: null, now: () => 0, rand: () => 0.5 });
  assert.equal(ten.count, 10, 'ten is what a pub round is');
  const capped = await importIntroRound({ playlistUrl: 'x', ...spotify(many), count: 99, ask: null, now: () => 0, rand: () => 0.5 });
  assert.equal(capped.count, MAX_QUESTIONS, 'a round, not an evening');
});

test('a playlist with nothing playable in it is refused in words', async () => {
  await assert.rejects(
    () => importIntroRound({
      playlistUrl: 'x',
      ...spotify([{ title: 'Only One', artist: 'X', spotifyUri: 'spotify:track:z' }]),
      ask: null,
    }),
    /fewer than two playable tracks/,
  );
});

test('the pack validates, so it can be launched rather than only saved', async () => {
  const { problems } = await importIntroRound({ playlistUrl: 'x', ...spotify(TRACKS), ask: null, now: () => 0, rand: () => 0.5 });
  assert.deepEqual(problems, []);
});
