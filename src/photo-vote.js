/**
 * THE FUNNIEST PHOTOGRAPH OF THE NIGHT — one copy, shared by both engines.
 *
 * Asked for on 16 September 2026, as the second half of a conversation about
 * getting more photographs out of a room: *"the funniest photo of the night
 * getting a free drink is actually a really good idea, perhaps you could let
 * the crowd vote on their favourite as well to get a free drink?"* — and then
 * the shape, chosen off four options: **the host shortlists four at the
 * break.**
 *
 * ---
 *
 * **THE SHORTLIST IS A HUMAN'S, AND THAT IS THE WHOLE DESIGN.** A vote over
 * everything the room sent is forty thumbnails on a projector nobody can read
 * and a scroll on a phone; worse, it is the app putting every photograph up
 * for judgement, including the one somebody sent of their mate looking rough.
 * Four is a screen, a glance and one tap. The same judgement the join flood
 * asks for (rule 4) and for the same reason: it takes a person a second and it
 * cannot be automated without being wrong in front of a room.
 *
 * **IT IS A FLAG, NOT A PHASE — rule 9.** It goes over whatever the night is
 * doing without moving it, it is refused over a live question, and it clears
 * the scoreboard, the advert and the photos slide exactly as they clear each
 * other. The quiz does not know it happened.
 *
 * **AND ANY MOVE CLOSES IT RATHER THAN DISCARDING IT.** That is the one place
 * this differs from the other three flags, deliberately: a scoreboard taken
 * down has lost nothing, and a vote taken down has thrown away what forty
 * people just did. So `askQuestion()` tallies it, names the winner and mints
 * the drink on its way past — the host pressing on is not a reason for a room's
 * vote to evaporate.
 *
 * **THE COUNTS ARE HOST-ONLY WHILE IT IS OPEN.** Rule 1's own shape: a running
 * tally six feet wide turns a vote into a bandwagon, and the last twenty people
 * to look up would be voting on what is winning rather than what is funny. The
 * numbers go up at the reveal, with the winner, where they are the story
 * instead of an instruction.
 *
 * **NOBODY'S PLAYER ID GOES ON A WIRE.** The sender is needed for exactly one
 * thing — minting the drink — and that happens here, on the server, so the
 * shortlist the projector and the phones are sent carries a photo id, a URL and
 * a team name and nothing else. Rule 3: a player id is a bearer credential and
 * the projector's payload reaches anybody holding the join code.
 *
 * **A SHARED FILE RATHER THAN A COPY IN EACH ENGINE — `notes.js`'s shape, and
 * `arcade.js`'s before it.** A break happens on a bingo night too, and two
 * copies of this is one rule that gets fixed once. State in, result out:
 * neither engine's `changed()` is called from here, because when to flush is
 * the engine's business.
 */

/**
 * How many go up.
 *
 * FOUR because it is what was asked for, and because it is the largest number
 * that is still one glance: four photographs fill a projector at a readable
 * size and fit a phone screen two-by-two with a thumb-sized target each. Five
 * is a scroll on a phone and a squint on the wall.
 *
 * A constant with a note rather than a setting, per this repo's own rule.
 */
export const MAX_SHORTLIST = 4;

/**
 * The fewest that is still a vote.
 *
 * Two, and it is the lucky dip's own rule wearing another hat: one photograph
 * put to the room is not a vote, it is an announcement, and calling it a vote
 * in front of people who can count is a lie they can see.
 */
export const MIN_SHORTLIST = 2;

/** What the vote is worth, in words, when the venue has put nothing up. */
const NO_PRIZE = '';

/**
 * Put four photographs to the room.
 *
 * The list arrives already resolved — `{ id, url, teamName, playerId }` — from
 * the server, because photographs belong to the ROOM rather than to the game
 * (see `viewFor()`), and the engine has never known they exist. That is also
 * why this takes a plain list rather than a store: it is the same reason
 * `notes.js` takes `state` instead of an engine.
 *
 * **REFUSED RATHER THAN TRIMMED WHEN IT IS WRONG.** Rule 10's own decision:
 * silently dropping the fifth photograph would put a vote on the wall that is
 * not the vote the host thought he had set up, and he is on a microphone.
 */
export function openVote(state, photos, now) {
  const list = (Array.isArray(photos) ? photos : [])
    .filter((p) => p && p.id)
    .map((p) => ({
      id: String(p.id),
      url: String(p.url || ''),
      teamName: String(p.teamName || ''),
      // Server-side only. Stripped by every view builder below.
      playerId: String(p.playerId || ''),
    }));
  if (list.length < MIN_SHORTLIST) return { ok: false, reason: 'too_few' };
  if (list.length > MAX_SHORTLIST) return { ok: false, reason: 'too_many' };
  const seen = new Set();
  for (const p of list) {
    if (seen.has(p.id)) return { ok: false, reason: 'duplicate' };
    seen.add(p.id);
  }
  state.photoVote = { open: true, photos: list, votes: {}, openedAt: now, winner: null };
  return { ok: true, count: list.length };
}

/**
 * A phone picks one.
 *
 * **VOTING AGAIN REPLACES**, which is `room-asks.js`'s rule and the same
 * reasoning: somebody changing their mind is not a second person, and a vote
 * that cannot be changed is one people ask the host about.
 *
 * Keyed by the id the caller hands over, which for a team night is the BOARD
 * row — one entity per row everywhere (see `boardIdFor()`), or a table of four
 * outvotes a table of one four times over.
 *
 * A pick that names nothing on the shortlist is REFUSED rather than ignored: a
 * button reporting success it did not have is this repo's commonest fault.
 */
export function castVote(state, voterId, photoId) {
  const v = state.photoVote;
  if (!v || !v.open) return { ok: false, reason: 'closed' };
  const id = String(voterId || '');
  if (!id) return { ok: false, reason: 'unknown_player' };
  const pick = String(photoId || '');
  if (!v.photos.some((p) => p.id === pick)) return { ok: false, reason: 'unknown_photo' };
  v.votes[id] = pick;
  return { ok: true, picked: pick };
}

/** The tally, newest state always — never stored, so it cannot go stale. */
function tally(v) {
  const counts = new Map(v.photos.map((p) => [p.id, 0]));
  for (const pick of Object.values(v.votes || {})) {
    if (counts.has(pick)) counts.set(pick, counts.get(pick) + 1);
  }
  return counts;
}

/**
 * Close it, name the winner and mint the drink.
 *
 * **DECIDED ONCE AND WRITTEN INTO THE STATE**, exactly like the lucky dip and
 * for the identical reason: closing twice — which a flaky connection, a second
 * press or a restart will all do — must not name a different photograph to a
 * room that has already heard the first one.
 *
 * **A TIE IS BROKEN AT RANDOM, BY THE ENGINE.** Four photographs and forty
 * voters ties often enough to need an answer, and every alternative is worse:
 * "the earliest" rewards being quick rather than funny, and asking the host to
 * pick turns the room's vote into his. `random` is injected like `now()`, so it
 * is testable and a browser never decides it. The counts go up with the winner,
 * so a room that sees 12–12 can see why it was close.
 *
 * **NOBODY VOTING IS NOT SOMEBODY WINNING.** An empty vote closes with no
 * winner and mints nothing, rather than handing a drink to whichever photograph
 * happened to be first — the same floor `issueVouchers()` keeps for a row that
 * scored zero.
 *
 * **AND NO PRIZE ON THE TABLE IS STILL A VOTE.** The room gets its winner named
 * on the projector and no voucher is minted, because a code for a drink the
 * venue never put up is the app writing a cheque somebody behind a bar has to
 * bounce. Silence beats a promise with a hole in it.
 */
export function closeVote(state, { now, random = Math.random, reward = NO_PRIZE, venue = '', newCode = null } = {}) {
  const v = state.photoVote;
  if (!v) return { ok: false, reason: 'no_vote' };
  if (!v.open) return { ok: true, winner: v.winner };

  v.open = false;
  v.closedAt = now;

  const counts = tally(v);
  const cast = Object.keys(v.votes || {}).length;
  const top = Math.max(0, ...counts.values());
  if (!cast || !top) {
    v.winner = null;
    v.counts = Object.fromEntries(counts);
    return { ok: true, winner: null, cast: 0 };
  }

  const level = v.photos.filter((p) => counts.get(p.id) === top);
  const pick = level[Math.floor(random() * level.length)] || level[0];

  v.counts = Object.fromEntries(counts);
  v.winner = {
    photoId: pick.id,
    url: pick.url,
    teamName: pick.teamName,
    votes: top,
    cast,
    // How many were level on the top count. One means it was won outright;
    // more means the app broke a tie, and the projector says so rather than
    // presenting a coin toss as a landslide.
    tied: level.length,
  };

  /*
   * THE DRINK, MINTED HERE AND NOWHERE ELSE.
   *
   * `newCode` is injected rather than imported because `newVoucherCode()` lives
   * in `engine.js`, which imports this file — and a circular import that works
   * today is one that stops working the day somebody moves a line. Both engines
   * hand it in, so there is still exactly one code generator.
   */
  if (pick.playerId && reward && typeof newCode === 'function') {
    if (!state.vouchers) state.vouchers = {};
    let code = newCode();
    while (state.vouchers[code]) code = newCode();
    state.vouchers[code] = {
      code,
      winnerId: pick.playerId,
      name: pick.teamName,
      /*
       * NO PLACE, like the draw's — this person came nowhere near the podium
       * and `place || 1` downstream would tell them they had won the quiz, in
       * a room that is about to watch somebody else win it.
       */
      place: null,
      funny: true,
      reward,
      venue,
      /*
       * DELIBERATELY NO `round` STAMP, on a bingo night.
       *
       * Bingo holds a code back until its round ends, so every prize appears
       * together — which is right for a prize won ON the card and wrong for
       * this one. A voucher with no `round` reads as "not this round" and
       * SHOWS, which is `issueVoucher()`'s own documented safe direction, and
       * here it is the behaviour that is actually wanted: the room has just
       * voted and the drink should be on the phone before the laugh dies.
       */
      issuedAt: now,
      redeemedAt: null,
      reinstated: 0,
      history: [],
    };
    v.winner.code = code;
  }

  return { ok: true, winner: v.winner };
}

/**
 * Take it down without deciding anything.
 *
 * The host's own escape hatch — he shortlisted the wrong four, or somebody has
 * asked for their photograph to come off the wall. **It is not what a move
 * does**: pressing on closes and pays out (see the head of this file). This is
 * a deliberate act with its own button, and it is the only thing in here that
 * can throw a vote away.
 */
export function dropVote(state) {
  if (!state.photoVote) return { ok: true };
  state.photoVote = null;
  return { ok: true };
}

/**
 * WHAT THE PROJECTOR IS TOLD — the four, and the winner once there is one.
 *
 * This function IS the whitelist, which is rule 1's own pattern: the payload is
 * built field by field here rather than spread from the state, so `playerId`
 * cannot reach a screen anybody in the room can read, and neither can the live
 * counts.
 */
export function voteForScreen(state) {
  const v = state.photoVote;
  if (!v) return null;
  const out = {
    open: Boolean(v.open),
    photos: v.photos.map((p) => ({ id: p.id, url: p.url, teamName: p.teamName })),
  };
  if (!v.open) {
    out.counts = v.counts || {};
    out.winner = v.winner
      ? {
        photoId: v.winner.photoId,
        url: v.winner.url,
        teamName: v.winner.teamName,
        votes: v.winner.votes,
        cast: v.winner.cast,
        tied: v.winner.tied,
        // The CODE never goes on the projector. It is a bearer token for a
        // drink and the big screen is the one place in this app that is read
        // by everybody at once — the same reasoning that keeps the draw's code
        // off it. The winner's own phone is told, and nobody else.
      }
      : null;
  }
  return out;
}

/**
 * WHAT A PHONE IS TOLD — the four, and which one this phone picked.
 *
 * No counts at all, open or closed: the phone's job is to tap one, and the
 * result is the projector's moment. Once it is closed the phone is told the
 * winner so somebody looking down rather than up still finds out.
 */
export function voteForPlayer(state, voterId) {
  const v = state.photoVote;
  if (!v) return null;
  const out = {
    open: Boolean(v.open),
    photos: v.photos.map((p) => ({ id: p.id, url: p.url, teamName: p.teamName })),
  };
  const mine = (v.votes || {})[String(voterId || '')];
  if (mine) out.picked = mine;
  if (!v.open && v.winner) {
    out.winner = { photoId: v.winner.photoId, teamName: v.winner.teamName, votes: v.winner.votes };
  }
  return out;
}

/**
 * WHAT THE HOST IS TOLD — everything, because he is the one working it.
 *
 * The live counts are here and only here while the vote is open, which is
 * `whoPicked()`'s own arrangement: the room gets the result, the person on the
 * microphone gets the numbers, because what he says next depends on them.
 *
 * `playerId` stays out even here. The host has no use for it — the voucher is
 * already minted and his own panel lists it by code — and a field on a view is
 * a promise that something draws it.
 */
export function voteForHost(state) {
  const v = state.photoVote;
  if (!v) return null;
  const counts = tally(v);
  return {
    open: Boolean(v.open),
    photos: v.photos.map((p) => ({
      id: p.id, url: p.url, teamName: p.teamName, votes: counts.get(p.id) || 0,
    })),
    cast: Object.keys(v.votes || {}).length,
    openedAt: v.openedAt,
    winner: v.winner ? { ...v.winner } : null,
  };
}
