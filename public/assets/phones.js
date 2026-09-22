/**
 * WHAT THE ROOM IS LOOKING AT — one line, for the host's own screen.
 *
 * Asked for on 15 August 2026: *"just a very, very subtle thing that says what
 * the players are viewing on their phones."*
 *
 * **It is a PERFORMER'S prompt, not a status readout.** A quizmaster behind a
 * microphone cannot see sixty phones, and what is on them decides what they
 * say next — *"there's a game on there while we set up"*, *"get your photos in
 * now"*. That is the whole value, and it is why the wording is what a host
 * would SAY rather than what the code calls it.
 *
 * ---
 *
 * **IT NAMES ITS SUBJECT, because the line above it is about something else.**
 * `whereLabel()` in `host.js` says where the GAME has got to — "R1 Q3 — live".
 * This says what the PHONES have got. Two one-line statuses an inch apart is
 * exactly the collision CLAUDE.md keeps recording, and the fix it already
 * prescribes is to keep the noun and add the audience: so this one is labelled
 * *On their phones* and never stands as a bare sentence.
 *
 * **ONE FUNCTION, so it cannot drift from what a phone actually does.** The
 * phone decides its own screen in `play.js`, and a host telling the room
 * something the phones are not offering is worse than saying nothing — they
 * say it OUT LOUD, on a microphone, and then sixty people go looking for a
 * button that is not there. There is a test that every phase this app has
 * answers here, so a new one cannot silently leave the host with a blank.
 *
 * **It is deliberately not on the projector or on a phone.** It is a note to
 * one person about everybody else, which is the definition of host-only.
 */

/** The photo card is on the phone at these moments — see `play.js`. */
const PHOTOS = new Set(['lobby', 'round_intro', 'round_board', 'final']);

/**
 * @param {object} s the host's own view of the state
 * @returns {string} a few words, or '' when there is nothing worth saying
 */
export function phonesAre(s) {
  if (!s) return '';

  /*
   * THE PROJECTOR'S FLAGS ARE NOT ON THE PHONES, AND THIS USED TO SAY THEY
   * WERE.
   *
   * It read *"what is over the top wins, on the phone exactly as it does on
   * the projector"* and returned "The scores" / "The advert" for the
   * scoreboard and advert flags. Measured against a real phone's payload:
   * `playerView()` carries no `scoreboard`, no `leaderboard`, no `advert` and
   * no `photoSlide` — none of the three ever reaches a phone. They are big
   * screen features, which is what the control view's own button says: *"the
   * scores on the big screen, on demand"*.
   *
   * So with the scoreboard up the host read **"On their phones: The scores"**,
   * said "have a look at your phones for the standings" — and sixty people
   * were looking at the answer to the last question. That is the exact fault
   * this function exists to prevent, written into the function itself.
   *
   * A comment claiming the opposite is where the next bug hides, and this one
   * WAS the bug. The phones are on the phase underneath, so the phase is what
   * gets reported; `whereLabel()` an inch above already says where the GAME
   * is, and the projector is in the room.
   *
   * `test/phones-are.test.js` walks every phase AND every flag against what
   * `playerView()` actually sends, so a field reaching the phone later makes
   * this true again rather than leaving it stale.
   */

  /*
   * A DJ SET, WHERE THE PHONE'S JOB DOES NOT CHANGE ALL NIGHT — there being
   * no phases to move through. It still answers, because a host who says
   * something the phones are not offering has said it out loud to a room.
   */
  if (s.game === 'dj') {
    return s.phase === 'finished'
      ? 'A thank-you — requests are closed'
      : 'The camera, and a box to ask for a song';
  }

  if (s.game === 'bingo' || s.game === 'cards') {
    switch (s.phase) {
      // The one moment a bingo phone has something to do besides its card.
      case 'lobby': return 'Waiting — a game to play';
      case 'won': return 'Someone has called it';
      case 'finished': return 'The final card';
      default: return 'Their bingo card';
    }
  }

  switch (s.phase) {
    /*
     * The lobby is the only phase where the game is the PRIMARY thing, which
     * is the split already recorded: the game before the quiz, photos between
     * the rounds. Said in that order here for the same reason.
     */
    case 'lobby': return 'Waiting — a game and photos';
    case 'rules': return 'The rules';
    case 'round_intro': return 'The round — and photos';
    case 'question': return 'Answering';
    case 'reveal': return 'The answer';
    case 'round_board': return 'The scores — and photos';
    case 'final': return 'Their result — and photos';
    default: return PHOTOS.has(s.phase) ? 'Waiting — and photos' : 'Waiting';
  }
}
