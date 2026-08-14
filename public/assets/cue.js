/**
 * Where an intro track actually starts.
 *
 * `cue.from` has existed on every intro question since the round was written,
 * with a `0:00` placeholder, and it was only ever a NOTE the host read off
 * their own control view. This turns it into the thing that plays.
 *
 * **It is a scoring fix rather than a polish one, and that is the whole
 * reason it is worth the file.** The clock starts when the question goes up
 * and the track starts at the same moment — so a track with two seconds of
 * silence or fade-in at the front costs everybody two seconds of score on that
 * question, for reasons that have nothing to do with whether they knew it.
 * Ten questions, ten different amounts of dead air, and the round scores
 * inconsistently with nothing on screen to blame.
 *
 * That is the same argument this codebase already makes about the picture
 * round's four reveals running on ONE curve: how fast a question becomes
 * answerable IS how many points it is worth, so anything that varies it per
 * question quietly changes the scoring and nobody can attribute it.
 *
 * **What must NOT be trimmed is how quickly a track becomes recognisable.**
 * That is the question's difficulty and it is the round. A famous four-note
 * opening should be answerable faster than a track that takes a bar to
 * declare itself. This trims silence, never character.
 *
 * It lives in `public/assets/` for the same reason `diary.js`, `balance.js`
 * and `plans.js` do: the editor imports it in the browser and the server
 * imports it in node, and two copies of one parser is two answers to "where
 * does this track start".
 */

/**
 * The longest offset that can be an intro cue rather than a typo.
 *
 * Ten minutes is far past anything real — an intro cue trims a fade-in, it
 * does not jump to the last chorus of a prog epic — so beyond this the host
 * has mistyped and being told is worth more than being obeyed.
 */
export const MAX_OFFSET_MS = 10 * 60 * 1000;

/**
 * Read a "start from" as milliseconds into the track.
 *
 * Returns **null** for anything it cannot read, which the caller treats as
 * "play from the beginning" — exactly what happened before this existed. So
 * the failure mode of a typo is the old behaviour rather than a silent jump
 * into the middle of a song. `0` and `null` therefore do the same thing at
 * playback; they differ only to the EDITOR, which says "not a time" for one
 * and nothing at all for the other.
 *
 * Accepts what a host would actually type with a room waiting:
 *
 *   ''  '0:00'          -> 0        the start, which is nearly every track
 *   '2'  '2s'  '2.5'    -> 2000     plain seconds, which is how dead air reads
 *   '0:02'  '1:05'      -> 2000     the way a music player writes it
 *
 * Refuses, rather than guessing: a negative, `1:75` (sixty-plus seconds in the
 * seconds half is a slip, not an intention), anything past MAX_OFFSET_MS, and
 * prose. A pack written before this said `0:00`, so it reads as 0 and nothing
 * on disk changes behaviour.
 *
 * @param {unknown} from
 * @returns {number|null} milliseconds, or null if it is not a time
 */
export function cueOffsetMs(from) {
  if (typeof from !== 'string' && typeof from !== 'number') return null;
  // A trailing "s" is what somebody types when they mean seconds and it can
  // only mean that, so it costs nothing to accept.
  const said = String(from).trim().toLowerCase().replace(/\s*(s|secs?|seconds?)$/, '');
  if (!said) return null;

  const clock = said.match(/^(\d{1,3}):([0-5]\d(?:\.\d+)?)$/);
  const plain = said.match(/^(\d{1,4}(?:\.\d+)?)$/);
  let seconds = null;
  if (clock) seconds = Number(clock[1]) * 60 + Number(clock[2]);
  else if (plain) seconds = Number(plain[1]);
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;

  const ms = Math.round(seconds * 1000);
  return ms > MAX_OFFSET_MS ? null : ms;
}

/**
 * What to print back at whoever typed it, so a typo reads as a typo.
 *
 * **The echo is the point of the field, not a nicety.** An offset that is
 * silently ignored is a track that plays from the top while the editor shows
 * a number that looks accepted — the same fault as a cue whose title was
 * corrected and whose URI was not, which is the other half of this job. So:
 * an empty box says nothing (nobody is being nagged for leaving the default),
 * and anything unreadable says so and says what will happen instead.
 *
 * @param {unknown} from
 * @returns {string} '' when there is nothing worth saying
 */
export function cueOffsetSays(from) {
  const said = String(from ?? '').trim();
  if (!said) return '';
  const ms = cueOffsetMs(said);
  if (ms === null) return 'Not a time — it will play from the very start.';
  if (ms === 0) return 'Plays from the very start.';
  return `Skips the first ${formatOffset(ms)}.`;
}

/**
 * Milliseconds as something to read. Whole seconds where it is whole, one
 * decimal where it is not — dead air is often half a second, and rounding it
 * away would make the box look like it had ignored what was typed.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatOffset(ms) {
  const seconds = ms / 1000;
  const said = Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
  return `${said} ${said === '1' ? 'second' : 'seconds'}`;
}
