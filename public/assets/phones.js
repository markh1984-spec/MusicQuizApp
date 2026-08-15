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
   * WHAT IS OVER THE TOP WINS, on the phone exactly as it does on the
   * projector. A scoreboard or an advert is a flag rather than a phase, so the
   * quiz underneath carries on — but it is not what anybody is looking at.
   */
  if (s.advert && s.advert.showing) return 'The advert';
  if (s.scoreboard && s.scoreboard.on) return 'The scores';

  if (s.game === 'bingo') {
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
