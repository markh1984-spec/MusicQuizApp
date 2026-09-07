/**
 * A SPOTIFY PLAYLIST BECOMES AN INTRO ROUND, AND THE ANSWER CANNOT DISAGREE
 * WITH THE SONG.
 *
 * ---
 *
 * An intro question holds the same song twice: once as `cue.title`, which is
 * what plays, and once as the correct option, which is what the room is
 * marked against. Nothing checked they were the same song — so a typo, or
 * changing your mind about one question and not the other, produced a pack
 * that reads perfectly, builds a perfectly consistent playlist, and marks the
 * room wrong on a track it just played. The first person to find out is the
 * one holding the microphone.
 *
 * `src/recue.js` already fixed the neighbouring fault — *the cue points at the
 * wrong RECORDING* — and could not touch this one, because it has no opinion
 * about what the answer says.
 *
 * **So the answer and the cue are written from ONE Spotify track object and
 * are never typed at all.** That is the whole point of this file: the
 * alignment is structural rather than checked. There is no state in which they
 * differ, so there is nothing to validate and nothing to remember.
 *
 * ---
 *
 * **THE PLAYLIST IS READ, NEVER CREATED.** You already have the playlist —
 * that is where the round came from — so `round.spotifyPlaylist` points at
 * THAT one. Building a second playlist from the round would recreate, on
 * purpose, exactly the two-copies-that-can-drift problem this file exists to
 * remove. Which is rule 11's argument in miniature: fewer copies, not better
 * syncing.
 *
 * **CLAUDE ONLY EVER WRITES THE WRONG ANSWERS.** It is never shown a
 * question to answer and never asked which track is which — the right answer
 * comes off Spotify before Claude is called at all. So the worst a bad reply
 * can do is give you a weak decoy, which you can see in the editor. Compare
 * that with generating an intro round outright, where a confident wrong
 * answer key is one of the things that can come back.
 *
 * **AND IT WORKS WITH NO CLAUDE KEY AT ALL.** The fallback fills the decoys
 * from the OTHER tracks in the same playlist — always available, obviously
 * on-theme, and it says so in the log rather than pretending. A round you can
 * build on a train with no API key beats a better round you cannot build.
 */

import { normaliseQuiz, validateQuiz } from './quizzes.js';
import { spotifyConfigured, playlistTracks } from './spotify.js';
import { titleCase, themeSlug } from './theme.js';
import { balanceAnswers } from '../public/assets/balance.js';

/** How many questions a round gets when nobody says. A pub round is ten. */
export const DEFAULT_QUESTIONS = 10;

/** Never more than this from one playlist — a round, not an evening. */
export const MAX_QUESTIONS = 20;

/**
 * The same title written two ways is the same title.
 *
 * Spotify's own spelling carries remaster suffixes, feature credits and
 * punctuation a person would not type — "Chop Suey!" against "Chop Suey",
 * "Duality - 2008 Remaster" against "Duality". A decoy that is really the
 * answer wearing different punctuation is a question with two right answers on
 * the board, so the comparison has to be looser than `===` and is deliberately
 * only ever used to REJECT a decoy, never to accept one.
 */
export function sameSong(a, b) {
  const flat = (s) => String(s || '')
    .toLowerCase()
    // Anything after a dash or in brackets is a version, not a song:
    // "- 2011 Remaster", "(feat. Someone)", "[Live]".
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s*[([{].*?[)\]}]\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  const x = flat(a);
  return Boolean(x) && x === flat(b);
}

/**
 * What Claude is asked, and why it is one call rather than ten.
 *
 * Ten calls is ten chances to fail and ten lots of latency for a job whose
 * whole input fits in one message. It also lets the model see the WHOLE round
 * at once, which is what makes it possible to ask for decoys that do not
 * collide with another question's answer.
 */
function decoyPrompt(tracks) {
  const list = tracks
    .map((t, i) => `${i + 1}. "${t.title}" — ${t.artist}`)
    .join('\n');
  return `Here are ${tracks.length} tracks that will be played, one per question, in a pub quiz "name that intro" round:

${list}

For EACH track, give me three wrong answers — three other track TITLES that could plausibly sit beside it on screen.

Rules:
- By the SAME artist wherever that artist has three other reasonably known tracks. That makes the question "which song is this" rather than "who is this", which is the harder and better question.
- Where they do not, use tracks by a very similar artist from the same era and style. Never a wildly different genre: an obvious outlier is a free elimination.
- Titles only. No artist names, no years, no quotation marks.
- NEVER repeat the track's own title, in any spelling or with any remaster or live suffix.
- NEVER use a title that appears anywhere in the numbered list above — those are other questions' answers and would tell the room something.
- Three distinct titles per track. Do not repeat a title within one question.

Reply with JSON and nothing else, in exactly this shape:

{"decoys": [{"n": 1, "wrong": ["...", "...", "..."]}, {"n": 2, "wrong": ["...", "...", "..."]}]}`;
}

const SYSTEM = `You write pub quiz material for a professional quizmaster in the UK.
British spelling, UK chart references. You are writing WRONG answers only — plausible
decoys that a room has to think about. Reply with JSON and no other text.`;

/**
 * Decoys from the playlist itself, for when Claude is not available.
 *
 * Same artist first, because that is the better question; then anything else
 * in the playlist. It can only ever offer OTHER answers in the round, which is
 * the compromise being accepted knowingly and said out loud — with ten tracks
 * from one theme it is a perfectly playable round, and it is the difference
 * between having one on Thursday and not.
 */
export function decoysFromPlaylist(tracks, at, want = 3, rand = Math.random) {
  const me = tracks[at];
  const pool = tracks.filter((t, i) => i !== at && !sameSong(t.title, me.title));
  const mine = pool.filter((t) => String(t.artist || '').toLowerCase() === String(me.artist || '').toLowerCase());
  const rest = pool.filter((t) => !mine.includes(t));
  const shuffled = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const out = [];
  for (const t of [...shuffled(mine), ...shuffled(rest)]) {
    if (out.length >= want) break;
    if (out.some((w) => sameSong(w, t.title))) continue;
    out.push(t.title);
  }
  return out;
}

/**
 * Put a question's four options together, and refuse anything unsafe.
 *
 * The correct answer goes in at index 0 and `balanceAnswers` moves it
 * afterwards — the same order the generator uses, for the same reason: the
 * letter is decided once, evenly, across the whole pack.
 *
 * A decoy is dropped when it is the answer again, when it repeats another
 * decoy, or when it is empty. Whatever is left short is topped up from the
 * playlist, so a question can never arrive with two options on it.
 */
export function optionsFor(tracks, at, suggested = []) {
  const answer = tracks[at].title;
  const wrong = [];
  for (const raw of suggested) {
    const t = String(raw || '').trim();
    if (!t) continue;
    if (sameSong(t, answer)) continue;
    if (wrong.some((w) => sameSong(w, t))) continue;
    wrong.push(t);
    if (wrong.length >= 3) break;
  }
  if (wrong.length < 3) {
    for (const t of decoysFromPlaylist(tracks, at, 3)) {
      if (wrong.length >= 3) break;
      if (sameSong(t, answer) || wrong.some((w) => sameSong(w, t))) continue;
      wrong.push(t);
    }
  }
  return { options: [answer, ...wrong], correctIndex: 0, short: wrong.length < 3 };
}

/**
 * Read a playlist and turn it into a quiz pack holding one intro round.
 *
 * A PACK rather than a round appended to something, because Tonight bursts a
 * pack into a tile per round: a one-round pack IS a round you can drag in
 * beside two others. Building it as a pack means no new composing UI and no
 * second answer to "what is being played tonight".
 *
 * @param {object}   o
 * @param {string}   o.playlistUrl
 * @param {number}  [o.count]        how many questions. Trimmed from the top.
 * @param {string}  [o.title]        pack title. Defaults to the playlist's name.
 * @param {function}[o.ask]          the Claude call, INJECTED like every clock
 *   here — null means do not ask, and the playlist fills the decoys.
 * @param {function}[o.readPlaylist] and @param {function}[o.configured] — the
 *   Spotify half, injected for the same reason `recueQuiz` injects its lookup:
 *   an ES module namespace is READ-ONLY, so a test cannot stub the import and
 *   the only honest way to run this without a network is to hand it in.
 * @param {function}[o.log]
 * @param {function}[o.now]
 * @param {function}[o.rand]
 */
export async function importIntroRound({
  playlistUrl = '',
  count = DEFAULT_QUESTIONS,
  title = '',
  ask = null,
  readPlaylist = playlistTracks,
  configured = spotifyConfigured,
  log = () => {},
  now = () => Date.now(),
  rand = Math.random,
} = {}) {
  if (!playlistUrl.trim()) throw new Error('Give it a Spotify playlist link.');
  if (!configured()) {
    throw new Error('Spotify is not set up, so a playlist link cannot be read. Run `npm run spotify:login` first.');
  }

  log('reading the playlist from Spotify…');
  const found = await readPlaylist(playlistUrl);
  const all = found.tracks.filter((t) => t.title && t.spotifyUri);
  log(`  "${found.name}" — ${all.length} track${all.length === 1 ? '' : 's'}`);
  if (all.length < 2) {
    throw new Error('That playlist has fewer than two playable tracks in it, so there is no round to make.');
  }

  const wanted = Math.max(1, Math.min(MAX_QUESTIONS, Number(count) || DEFAULT_QUESTIONS));
  const tracks = all.slice(0, wanted);
  if (all.length > tracks.length) log(`  taking the first ${tracks.length} — the rest are left in the playlist`);

  /*
   * ASKED FOR ALL OF THEM AT ONCE, AND A FAILURE IS NOT FATAL.
   *
   * The round is already complete and correct at this point — every cue and
   * every right answer came off Spotify. Claude is an improvement to the
   * decoys and nothing more, so it is wrapped and the fallback is the
   * ordinary path rather than an emergency one.
   */
  let suggested = new Map();
  if (ask) {
    log(`asking for three wrong answers each…`);
    try {
      const reply = await ask({ system: SYSTEM, prompt: decoyPrompt(tracks) });
      for (const row of (reply && reply.decoys) || []) {
        const n = Number(row && row.n);
        if (!Number.isInteger(n) || n < 1 || n > tracks.length) continue;
        suggested.set(n - 1, Array.isArray(row.wrong) ? row.wrong : []);
      }
      log(`  got decoys for ${suggested.size} of ${tracks.length}`);
    } catch (err) {
      log(`  could not get decoys (${err.message}) — using other tracks from the playlist instead`);
      suggested = new Map();
    }
  } else {
    log('no Claude key, so the wrong answers come from the other tracks in the playlist');
  }

  let fellBack = 0;
  let short = 0;
  const questions = tracks.map((t, i) => {
    const picked = suggested.get(i) || [];
    if (!picked.length) fellBack += 1;
    const { options, correctIndex, short: thin } = optionsFor(tracks, i, picked);
    if (thin) short += 1;
    return {
      id: `r1q${i + 1}`,
      prompt: 'Which track is this?',
      options,
      correctIndex,
      cue: {
        title: t.title,
        artist: t.artist || '',
        /*
         * ALWAYS "0:00", NEVER A GUESS.
         *
         * The generator carries the same rule in as many words: how far into a
         * track its audio actually begins is something only somebody who has
         * LISTENED knows, and a plausible-looking guess skips real seconds of a
         * real song in front of a room. The editor is where you set it, after
         * you have heard it.
         */
        from: '0:00',
        hint: '',
        spotifyUri: t.spotifyUri,
        spotifyUrl: `https://open.spotify.com/track/${String(t.spotifyUri).split(':').pop()}`,
      },
    };
  });

  if (fellBack && ask) log(`  ${fellBack} question${fellBack === 1 ? '' : 's'} fell back to other tracks in the playlist`);
  if (short) log(`  ${short} question${short === 1 ? ' has' : 's have'} fewer than four options — the playlist is small. Add some in the editor.`);

  const packTitle = titleCase(String(title || found.name || 'Name That Intro').trim());
  const id = themeSlug(packTitle);

  const quiz = normaliseQuiz({
    id,
    title: packTitle,
    subtitle: 'One round. Twenty seconds a question. Fastest fingers win.',
    questionSeconds: 20,
    createdAt: new Date(now()).toISOString(),
    notes: `Built from the Spotify playlist "${found.name}". Every right answer and every cue came off `
      + `that playlist, so the track that plays and the answer key cannot disagree. `
      + `The WRONG answers were ${ask ? 'suggested by Claude' : 'taken from the other tracks in the playlist'} `
      + `— read them before the gig. Set each cue's start offset in the editor once you have heard the track.`,
    rounds: [{
      id: 'r1',
      type: 'intro',
      title: 'Round One — Name That Intro',
      blurb: `${questions.length} intro${questions.length === 1 ? '' : 's'}. You get the first few seconds and nothing else.`,
      // THE PLAYLIST YOU ALREADY HAVE. Nothing is created, so there is no
      // second copy to go out of step with the round.
      spotifyPlaylist: { url: found.url, uri: found.uri },
      questions,
    }],
  }, id);

  const evened = balanceAnswers(quiz, rand);
  if (evened) log(`evened out the answers — ${evened} question${evened === 1 ? '' : 's'} moved`);

  return {
    quiz,
    id,
    problems: validateQuiz(quiz),
    playlist: { name: found.name, url: found.url, uri: found.uri },
    count: questions.length,
    fellBack,
    short,
  };
}
