#!/usr/bin/env node
/**
 * PUT A SPOTIFY TRACK BEHIND EVERY INTRO CUE IN THE LIBRARY.
 *
 * `startIntroTrack()` in `server.js` is what makes pressing Next also press
 * play: the question goes up, the clock starts, and the track begins at the
 * cue's own offset. It is guarded by one line —
 *
 *     if (!uri || !spotifyConfigured()) return;
 *
 * — so **a cue with words but no `spotifyUri` plays nothing, silently.** Every
 * intro round in this repository was written by hand or by Claude, and none of
 * them carries a uri, so the auto-play has never once fired on a catalogue
 * pack. Nothing throws; the host just presses Next and hears silence.
 *
 * **THIS IS NOT A SECOND LOOKUP PATH.** It walks the packs through
 * `recueQuiz()` — the same function every editor save already runs, with the
 * same rules: only cues that need it, artist-preferring search, Spotify's own
 * spelling written back, and a cue that cannot be resolved keeping its words
 * and losing any stale uri. A second implementation of "find the track" is how
 * the console and the room come to disagree about which record is playing.
 *
 * **IT IS NOT AUTOMATIC, AND IT SHOULD NOT BE.** Spotify's search is a guess —
 * "Crazy" by anybody is four different records — so the misses are printed for
 * a human to look at before a gig rather than after one. That is the shape
 * this app uses everywhere: the app prepares, the human reads.
 *
 *   node scripts/recue-all.mjs           # write the uris in
 *   node scripts/recue-all.mjs --dry     # say what it would do, change nothing
 */

import fs from 'node:fs';
import path from 'node:path';

import { config } from '../src/config.js';
import { recueQuiz } from '../src/recue.js';
import { spotifyConfigured, missingSpotifyConfig } from '../src/spotify.js';

const dry = process.argv.includes('--dry');
const dir = config.quizDir;

if (!spotifyConfigured()) {
  console.error('Spotify is not set up, so there is nothing to look a track up with.');
  console.error('Missing:', missingSpotifyConfig().join(', '));
  console.error('Run `npm run spotify:login` and put the refresh token in your environment.');
  process.exit(1);
}

/** Every intro cue that has no track behind it yet. */
function unresolved(quiz) {
  let n = 0;
  for (const round of quiz.rounds || []) {
    if (round.type !== 'intro') continue;
    for (const q of round.questions || []) if (q.cue && !q.cue.spotifyUri) n += 1;
  }
  return n;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
let looked = 0;
let found = 0;
const stillMissing = [];

for (const file of files) {
  const at = path.join(dir, file);
  let quiz;
  try {
    quiz = JSON.parse(fs.readFileSync(at, 'utf8'));
  } catch (err) {
    console.log(`  BROKEN ${file} — ${err.message}`);
    continue;
  }
  const want = unresolved(quiz);
  if (!want) continue;

  /*
   * The version on disk is handed in as `previous`, which is what makes this
   * only ever fill in the GAPS: `recueQuiz` re-resolves a cue whose words have
   * changed or that has no uri, and a cue already pointing at a track with the
   * same words is left alone. Passing null instead would re-look-up the whole
   * library on every run, for nothing.
   */
  const before = JSON.parse(JSON.stringify(quiz));
  const out = await recueQuiz(quiz, before);
  looked += out.checked;
  found += out.matched.length;

  console.log(`${quiz.id || file}: ${out.matched.length} of ${out.checked} resolved`);
  for (const m of out.missed) {
    stillMissing.push(`${quiz.id || file} — ${m.title} / ${m.artist}`);
  }

  if (out.matched.length && !dry) {
    fs.writeFileSync(at, `${JSON.stringify(quiz, null, 2)}\n`);
  }
}

console.log('');
console.log(`${found} of ${looked} intro cues now have a track behind them${dry ? ' (dry run — nothing written)' : ''}.`);
if (stillMissing.length) {
  // Named rather than counted. A count goes stale in silence; a list is
  // something somebody can actually fix before a Thursday.
  console.log('');
  console.log('Spotify could not find these — check the spelling in the editor:');
  for (const line of stillMissing) console.log(`  ${line}`);
}
