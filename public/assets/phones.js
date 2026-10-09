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
 *
 * ---
 *
 * **THE PROJECTOR'S FLAGS ARE NOT ON THE PHONES, AND THIS USED TO SAY THEY
 * WERE.** It read *"what is over the top wins, on the phone exactly as it does
 * on the projector"* and returned "The scores" / "The advert" for the
 * scoreboard and advert flags. Measured against a real phone's payload:
 * `playerView()` carries no `scoreboard`, no `leaderboard`, no `advert` and no
 * `photoSlide` — none of the three ever reaches a phone. So with the
 * scoreboard up the host read **"On their phones: The scores"**, said "have a
 * look at your phones for the standings" — and sixty people were looking at
 * the answer to the last question. The exact fault this function exists to
 * prevent, written into the function itself.
 *
 * **AND IT GUESSED THE CAMERA, TWICE OVER** (launch-path sweep, 23 September
 * 2026). It said *"The rules"* at the rules slide, where the phones read
 * *"You're in — Hang tight"* over a Send-a-photo row; and it said *"…and
 * photos"* with photos switched OFF — the one switch on the control view that
 * exists for something having gone up that should not have. The camera and
 * the game are offered by the kill switch and the break plan, and `play.js`'s
 * `gapWants()` reads exactly those; this reads the same two facts off the
 * host's own view (`photos.enabled`, and `gap`, which both engines now put
 * on the host view from the same `breakNow()` the phone reads).
 *
 * `test/phones-are.test.js` walks every phase AND every flag against what
 * `playerView()` actually sends, so a field reaching the phone later makes
 * this true again rather than leaving it stale.
 */

/**
 * What the phones are OFFERED right now — `gapWants()` in `play.js`, read off
 * the host's view. Photos need the kill switch on AND a break that has not
 * turned them off; a break absent from the payload (the rules, a round intro,
 * the final) is not a break, and the phone then offers the camera alone.
 */
function offers(s) {
  const photosOn = Boolean(s.photos && s.photos.enabled);
  const gap = s.gap;
  return {
    photos: photosOn && (!gap || gap.photos !== false),
    // The game needs a seed, and a seed is only sent for a break that offers
    // one — so outside a break there is no game whatever the plan says.
    game: Boolean(gap && gap.game),
  };
}

/** "The scores — a game and photos", or just "The scores". */
function withOffers(base, { photos, game }) {
  if (game && photos) return `${base} — a game and photos`;
  if (game) return `${base} — a game`;
  if (photos) return `${base} — and photos`;
  return base;
}

/**
 * @param {object} s the host's own view of the state
 * @returns {string} a few words, or '' when there is nothing worth saying
 */
export function phonesAre(s) {
  if (!s) return '';

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

  /*
   * THE FUNNIEST PHOTOGRAPH, WHILE THE ROOM IS VOTING. Drawn on every phone
   * with room for it — a waiting screen, a reveal, a board, a bingo card —
   * and never over a live question, which the engine refuses to open it
   * over. It is the thing the host has just asked the room out loud to do,
   * so it is the thing to say.
   */
  // Pub Prix takes the whole phone while it runs (`race-phone.js`).
  if (s.race && s.race.phase === 'racing') return 'Pub Prix — steering their karts';
  if (s.photoVote && s.photoVote.open && s.phase !== 'question') {
    return 'Voting for the funniest photo';
  }

  const have = offers(s);

  // A Pub Prix PART between races: their kart and a selfie, or the result.
  if (s.game === 'race') {
    if (s.phase === 'done') return 'The race result';
    if (s.phase === 'finished') return 'The end of Pub Prix';
    return 'Their kart on the grid — and a selfie for it';
  }

  if (s.game === 'bingo' || s.game === 'cards') {
    switch (s.phase) {
      // The one moment a bingo phone has something to do besides its card —
      // and the bingo lobby offers the game alone, never a photo row.
      case 'lobby': return have.game ? 'Waiting — a game' : 'Waiting';
      // The gap after a round's last prize offers the game too — `breakIdNow()`.
      case 'won': return withOffers('Someone has called it', have);
      case 'finished': return withOffers('The final card', { photos: have.photos });
      default: return withOffers('Their bingo card', { photos: have.photos });
    }
  }

  switch (s.phase) {
    /*
     * The lobby is the only phase where the game is the PRIMARY thing, which
     * is the split already recorded: the game before the quiz, photos between
     * the rounds. Said in that order here for the same reason.
     */
    case 'lobby': return withOffers('Waiting', have);
    // The phones do not show the rules. They read "You're in — Hang tight",
    // with the camera under it if there is one.
    case 'rules': return withOffers('Waiting', { photos: have.photos });
    case 'round_intro': return withOffers('The round', { photos: have.photos });
    case 'question': return 'Answering';
    case 'reveal': return withOffers('The answer', { photos: have.photos });
    case 'round_board': return withOffers('The scores', have);
    case 'final': return withOffers('Their result', { photos: have.photos });
    default: return withOffers('Waiting', have);
  }
}
