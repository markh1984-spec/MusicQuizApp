/**
 * RE-POINT AN INTRO CUE WHEN ITS TRACK IS EDITED.
 *
 * **This is the worst class of bug this app has: it looks right and plays
 * wrong, in front of a room.**
 *
 * An intro question holds a `cue` — a title, an artist and a `spotifyUri`. The
 * generator writes all three. The EDITOR only ever wrote the first two: fix a
 * typo in a track name, or swap the song entirely, and the pack reads
 * perfectly on every screen while `spotifyUri` still points at the old
 * recording. The host presses play and the room hears a different song from
 * the one the answer key is about — and the only person who finds out is
 * standing at a microphone.
 *
 * So a save re-resolves the cue.
 *
 * ---
 *
 * **ONLY WHAT CHANGED.** A pack with twelve intro questions would otherwise
 * make twelve Spotify calls every time somebody fixes a comma in an unrelated
 * round. A cue is re-resolved when its title or artist differs from what is
 * on disk, or when it has no `spotifyUri` at all — the second case is what
 * repairs a pack that was written by hand or imported without one.
 *
 * **IT NEVER FAILS A SAVE.** Spotify being down, unconfigured, or simply not
 * having the track must not stand between a quizmaster and their own edit at
 * five to eight. Every lookup is caught; a cue that cannot be resolved keeps
 * the words that were typed and loses its stale uri, which is the honest
 * outcome — **a cue with no uri plays nothing, where a cue with the WRONG uri
 * plays the wrong song.** Silence is a problem the host can see coming; the
 * wrong song is one they find out about with the room.
 *
 * **AND IT SAYS WHAT IT MATCHED.** The list comes back with the save so the
 * editor can show it. Spotify's search is a guess — *"Crazy"* by anybody is
 * four different records — so the one thing that makes this safe is the person
 * who typed it seeing what came back, before the gig rather than during it.
 */

import { findTrack, spotifyConfigured } from './spotify.js';

/** Every intro cue in a quiz, with where it lives, so a match can be written back. */
function cuesOf(quiz) {
  const out = [];
  (quiz.rounds || []).forEach((round, ri) => {
    if (round.type !== 'intro') return;
    (round.questions || []).forEach((q, qi) => {
      if (q && q.cue) out.push({ round: ri, question: qi, cue: q.cue });
    });
  });
  return out;
}

/** The same cue on the version already on disk, if there is one. */
function cueBefore(previous, at) {
  const round = ((previous || {}).rounds || [])[at.round];
  const q = ((round || {}).questions || [])[at.question];
  return q && q.cue ? q.cue : null;
}

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * Re-point the cues that need it. Mutates `quiz` and returns what happened.
 *
 * The lookup is INJECTED, like the clock and the random source everywhere else
 * in this codebase — so the tests that pin the failure behaviour never touch
 * the network, and an ES module's read-only exports never have to be mocked.
 *
 * @param {object} quiz      the quiz about to be saved
 * @param {object} previous  the version on disk, or null for a new pack
 * @param {object} [deps]    `lookup` and `configured`, for tests
 * @returns {Promise<{checked: number, matched: Array, missed: Array, skipped: string}>}
 */
export async function recueQuiz(quiz, previous = null, { lookup = findTrack, configured = spotifyConfigured } = {}) {
  const wanted = cuesOf(quiz).filter((at) => {
    const was = cueBefore(previous, at);
    // No uri at all — a hand-written or imported cue that has never been
    // resolved. Worth a lookup even when nothing was edited.
    if (!at.cue.spotifyUri) return true;
    if (!was) return true;
    return !same(was.title, at.cue.title) || !same(was.artist, at.cue.artist);
  });

  if (!wanted.length) return { checked: 0, matched: [], missed: [], skipped: '' };
  if (!configured()) {
    /*
     * Not an error, and it must not read as one. Plenty of quizmasters will
     * never connect Spotify — they play the track off their own DJ software,
     * which is what the cue's WORDS are for. Say it once and save the pack.
     */
    return { checked: wanted.length, matched: [], missed: [], skipped: 'no-spotify' };
  }

  const matched = [];
  const missed = [];
  for (const at of wanted) {
    try {
      const found = await lookup(at.cue.title, at.cue.artist);
      if (found) {
        // Spotify's spelling wins, exactly as it does in the generator — so a
        // pack ends up naming the record rather than the typo.
        at.cue.title = found.title;
        at.cue.artist = found.artist;
        at.cue.spotifyUri = found.uri;
        at.cue.spotifyUrl = `https://open.spotify.com/track/${found.id}`;
        matched.push({ round: at.round, question: at.question, title: found.title, artist: found.artist });
      } else {
        // The stale uri GOES. See the note at the top: nothing beats the wrong
        // song, and the host can see silence coming.
        delete at.cue.spotifyUri;
        delete at.cue.spotifyUrl;
        missed.push({ round: at.round, question: at.question, title: at.cue.title, artist: at.cue.artist });
      }
    } catch {
      // A lookup that threw tells us nothing about the track, so the cue is
      // left exactly as the person typed it — including any uri it already
      // had. Only a definite "not found" is worth clearing one for.
      missed.push({ round: at.round, question: at.question, title: at.cue.title, artist: at.cue.artist });
    }
  }
  return { checked: wanted.length, matched, missed, skipped: '' };
}
