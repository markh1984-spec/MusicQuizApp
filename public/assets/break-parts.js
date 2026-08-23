/**
 * WHAT HAPPENS IN THE GAPS — the break plan for one night.
 *
 * ---
 *
 * Asked for on 23 August 2026: *"The while they wait section needs to assign
 * games and/or photo upload per break perhaps? So for e.g. if I have a quiz
 * pack with 4 rounds and a music bingo, there's 5 breaks — the phones will
 * have an activity (each game and/or photo uploads), and the screen itself
 * needs to be able to show ads as well."*
 *
 * **Two of the three things he asked for already existed and one did not**,
 * which is worth writing down because it decides what this file is actually
 * for:
 *
 * - **Photos already ran at every break.** `PHOTO_PHASES` on the projector and
 *   `PHOTO_PHASES_PHONE` on the phone have always included `round_board`. So
 *   the photo half of this is making something SWITCHABLE that was always on,
 *   not adding it.
 * - **The game ran at the lobby only**, by three separate mechanisms with a
 *   test each — the seed is in the phone's payload at the lobby, a score is
 *   refused at any other phase, and the board draws at the lobby. That was a
 *   deliberate decision of the host's own: *"between rounds it should be
 *   photos and before the start of the quiz it's Maze Mouth"*. This reverses
 *   it, so the guards generalise from "the lobby" to "a break that offers a
 *   game" — they do not go away, and there is a test that they have not.
 * - **An advert only ever went up because somebody pressed a button.**
 *   `showAdvert()` is host-driven and any move clears it. Nothing in the app
 *   put one up on its own. That is the genuinely new capability here, and it
 *   is the one that pays — advert slides are the quizmaster's own revenue.
 *
 * ---
 *
 * **A BREAK IS A PLACE IN THE NIGHT, NOT A NUMBER.** The host counted "4
 * rounds and a bingo, so 5 breaks", and the count is right for that night and
 * wrong as a model: a round can be switched off on the launch bar, a pack can
 * gain one, and a running order adds a lobby per part. A stored list of five
 * would be wrong the first time any of those happened, silently, with every
 * entry still looking real — the failure this repo keeps recording.
 *
 * So a break is identified by WHERE it is: `p0:lobby`, `p0:r2`, `p1:lobby`.
 * Part index and round index are both already on the engine state and both
 * already survive a restart, so the id can be recomputed at any moment from
 * state that is already there — nothing to keep in step, and nothing to
 * migrate.
 *
 * **THE PLAN IS SPARSE, AND THAT IS LOAD-BEARING.** Only breaks that were
 * changed appear in it. A night nobody touched has an empty plan, every break
 * resolves to `DEFAULTS`, and `DEFAULTS` is exactly what the app did before
 * this file existed — so `pub-unchanged.mjs` can still say IDENTICAL, and a
 * night restored from an older state file behaves as it always did rather
 * than as whatever an empty object would have meant.
 *
 * **THE FINAL IS NOT A BREAK.** It is the end of the night — the winner, the
 * podium, the draw and the come-back slide, each of which this app has a rule
 * about. A break plan that could put an advert over the winner would be able
 * to take away the moment the whole evening is built towards, and no setting
 * is worth that. The gaps are each part's lobby and each round board.
 *
 * **IT LIVES IN `public/assets/` AND IS IMPORTED BY THE SERVER**, exactly as
 * `show-parts.js` and `lobby-games.js` are, and for the identical reason: the
 * console has to draw a chip per break and label it, and the engine has to
 * resolve which break the night is in. Two definitions of what a break is —
 * one for the strip and one for the payload — is how the console comes to
 * describe a night the projector is not running. It has NO boot code of its
 * own, which is the condition that makes importing it from a page safe.
 *
 * **AND THE LOBBY HAS NO SCREEN CHOICE.** The join code lives there and
 * nothing in this app may dim it — the same rule that keeps a big photo from
 * covering it and that keeps the code off a question. So the lobby break sets
 * what the PHONES do and the projector goes on saying how to join.
 */

/** What the phones are offered in a gap. */
export const PHONE = {
  /** The camera only — what a round board has always done. */
  PHOTOS: 'photos',
  /** The arcade game only. */
  GAME: 'game',
  /** Both, photos first — what the lobby has always done. */
  BOTH: 'both',
  /** Neither. A phone in a pocket is a room looking up. */
  NOTHING: 'nothing',
};

/** What the projector shows in a gap. Never at the lobby — see above. */
export const SCREEN = {
  /** The scores after that round, as it has always been. */
  SCORES: 'scores',
  /** This venue's slides, rotating. */
  ADVERTS: 'adverts',
  /**
   * The scores, then the slides — the host's own choice, and the right
   * default for a paid slide: the room gets the thing it looked up FOR, and
   * the venue gets the screen once it has.
   */
  SCORES_THEN_ADVERTS: 'scores+adverts',
  /**
   * Nothing at all. Asked for directly — *"I also have to be able to put
   * nothing on the screen if I want to"* — and it is not the same as picking
   * neither of the others: a break where the host wants the room talking to
   * each other rather than reading a projector is a real thing to want, and
   * an empty screen is the only way to say it.
   */
  NOTHING: 'nothing',
};

/**
 * WHAT A BREAK DOES WHEN NOBODY HAS SAID — and these values are not a taste
 * decision, they are the app's existing behaviour written down.
 *
 * The lobby offered a game and the camera; a round board offered the camera
 * and put the scores up. Change either of these and every night that was
 * launched without touching the plan changes with it.
 */
export const DEFAULTS = {
  lobby: { phone: PHONE.BOTH, screen: SCREEN.SCORES },
  round: { phone: PHONE.PHOTOS, screen: SCREEN.SCORES },
};

/** Whether a break's phone setting offers the arcade game. */
export function offersGame(brk) {
  const want = (brk || {}).phone;
  return want === PHONE.GAME || want === PHONE.BOTH;
}

/** Whether a break's phone setting offers the camera. */
export function offersPhotos(brk) {
  const want = (brk || {}).phone;
  return want === PHONE.PHOTOS || want === PHONE.BOTH;
}

/** Whether a break's screen setting shows the scores. */
export function showsScores(brk) {
  const want = (brk || {}).screen;
  return want === SCREEN.SCORES || want === SCREEN.SCORES_THEN_ADVERTS;
}

/** Whether a break's screen setting shows this venue's slides. */
export function showsAdverts(brk) {
  const want = (brk || {}).screen;
  return want === SCREEN.ADVERTS || want === SCREEN.SCORES_THEN_ADVERTS;
}

/**
 * THE ID OF THE BREAK THE NIGHT IS IN RIGHT NOW, or `''` when it is not in
 * one.
 *
 * **Derived, never stored.** Both numbers it needs — which part of a running
 * order this is, and which round the board belongs to — are already on the
 * engine state and already survive a restart, so there is nothing here that
 * can drift out of step with where the night actually is. That is the same
 * reasoning `state.archivedAs` records from the other direction: a flag kept
 * beside the truth is a flag that can disagree with it.
 *
 * A bingo part has no rounds, so its only break is its lobby — which is
 * exactly right, since a bingo game is played straight through.
 */
export function breakIdNow(state) {
  if (!state) return '';
  const part = Number(state.orderPos) || 0;
  if (state.phase === 'lobby') return `p${part}:lobby`;
  if (state.phase === 'round_board') return `p${part}:r${Number(state.roundIndex) || 0}`;
  return '';
}

/**
 * WHAT THAT BREAK CARRIES — the plan's entry, or the default for its kind.
 *
 * Total by construction: an unknown id, a missing plan and a plan holding
 * rubbish all resolve to a default rather than to `undefined`. A projector
 * reading `brk.screen` off nothing is one throw away from a black screen in
 * front of a room, and this is the only place that can be prevented once.
 */
export function breakNow(state) {
  const id = breakIdNow(state);
  if (!id) return null;
  return breakFor(state && state.breakPlan, id);
}

/** One break out of a plan, defaulted by its kind. */
export function breakFor(plan, id) {
  const base = id.endsWith(':lobby') ? DEFAULTS.lobby : DEFAULTS.round;
  const set = (plan && typeof plan === 'object' && plan[id]) || null;
  if (!set) return { ...base, id };
  return {
    id,
    phone: Object.values(PHONE).includes(set.phone) ? set.phone : base.phone,
    screen: Object.values(SCREEN).includes(set.screen) ? set.screen : base.screen,
  };
}

/**
 * A PLAN CLEANED UP ON ITS WAY IN, and reduced to what actually differs.
 *
 * It arrives from a browser, so nothing in it is trusted — and it is stored on
 * the game state, which is written to disk on every move, so an entry that
 * says the same thing as the default is a byte in every save for the rest of
 * the night that changes nothing. Dropping those is also what keeps a night
 * nobody configured genuinely empty, which is what lets the payload guard
 * still prove a pub night is unchanged.
 */
export function cleanPlan(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, set] of Object.entries(raw)) {
    if (!/^p\d{1,2}:(lobby|r\d{1,2})$/.test(id)) continue;
    if (!set || typeof set !== 'object') continue;
    const base = id.endsWith(':lobby') ? DEFAULTS.lobby : DEFAULTS.round;
    const phone = Object.values(PHONE).includes(set.phone) ? set.phone : base.phone;
    const screen = Object.values(SCREEN).includes(set.screen) ? set.screen : base.screen;
    if (phone === base.phone && screen === base.screen) continue;
    out[id] = { phone, screen };
  }
  return out;
}

/**
 * EVERY BREAK IN A NIGHT, IN ORDER — what the console draws a chip for.
 *
 * Takes the running order the launch bar has built (`[{ kind, packId, order
 * }]`, one entry per part) plus a way to count a quiz part's rounds, and
 * returns the gaps that will actually happen. **Derived from the same list
 * Launch is about to send**, so the strip cannot describe a night other than
 * the one that is about to run — the identical rule `tonightAsShow()` follows
 * for the same reason.
 *
 * The LAST round board of the last part is left out: that one is the final,
 * which is the end of the night rather than a gap in it.
 *
 * @param {Array} parts   `[{ kind, packId, order?: [{ packId, round }] }]`
 * @param {function} roundsIn  part -> how many rounds it will play
 */
export function breakSlots(parts = [], roundsIn = () => 0) {
  const out = [];
  const list = Array.isArray(parts) ? parts : [];
  list.forEach((part, at) => {
    out.push({
      id: `p${at}:lobby`,
      part: at,
      kind: 'lobby',
      // "Doors" for the first part, because that is when it is; a later part's
      // lobby is the gap while the host sets the next thing up.
      label: at === 0 ? 'Doors' : `Before the ${part.kind === 'bingo' ? 'bingo' : 'quiz'}`,
    });
    if (part.kind === 'bingo') return;
    const rounds = Math.max(0, Number(roundsIn(part, at)) || 0);
    // The board after the LAST round of the LAST part is the final.
    const boards = at === list.length - 1 ? rounds - 1 : rounds;
    for (let r = 0; r < boards; r += 1) {
      out.push({ id: `p${at}:r${r}`, part: at, kind: 'round', label: `After round ${r + 1}` });
    }
  });
  return out;
}
