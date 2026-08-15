/**
 * THE LOBBY GAME'S SCOREBOARD — one copy, shared by both engines.
 *
 * A quiz night gets Maze Mouth and a bingo night gets Rally, but a score is a
 * score: the same clamp, the same best-not-latest rule, the same refusal
 * outside the lobby, the same five names on the projector. **This lived in
 * `engine.js` alone until the second game arrived, and copying it into
 * `bingo.js` would have been the mistake this file exists to avoid** — two
 * copies of a rule is two rules, and the day one of them is fixed is the day a
 * bingo night starts accepting a score a quiz night refuses.
 *
 * It is deliberately state-in, result-out: neither engine's `changed()` is
 * called from here, because when to flush to disk is the engine's business and
 * not this file's.
 */

/** Nothing on a projector is worth a bigger number than this. */
export const MAX_ARCADE_SCORE = 99999;

/**
 * A SCORE FROM A PHONE.
 *
 * **NOT OUTSIDE THE LOBBY.** A score arriving at any other phase means a phone
 * still playing while the room is being read a question or a track — the one
 * way this feature could make a night worse rather than better. Refused rather
 * than ignored, so a phone that has somehow kept a game alive finds out.
 *
 * **THE BEST, NOT THE LATEST.** A board that took whatever came last would
 * show somebody's worst attempt because they had one more go while the host
 * was talking.
 *
 * **CLAMPED RATHER THAN TRUSTED.** Nothing here is worth cheating for and
 * there is no prize on it — but it goes on a projector in front of a room, and
 * a phone can send whatever it likes.
 *
 * **AND IT DEGRADES RATHER THAN THROWING.** A night restored from before this
 * existed has no `arcade` at all, which is the ordinary case on a host with no
 * permanent disk — a redeploy mid-season brings back a state file written by
 * the old code, and a phone posting into it would have taken the request down.
 * Found by a test rather than by a room.
 *
 * @returns {{ok: boolean, reason?: string, best?: number, changed?: boolean}}
 *   `changed` is whether anything actually moved — the caller flushes only
 *   then, or a phone posting a worse score writes the whole state to disk.
 */
export function recordArcadeScore(state, playerId, score, { waiting }) {
  const player = state.players[String(playerId || '')];
  if (!player) return { ok: false, reason: 'unknown_player' };
  if (!waiting) return { ok: false, reason: 'not_waiting' };
  if (!state.arcade) state.arcade = {};
  const got = Math.max(0, Math.min(MAX_ARCADE_SCORE, Math.floor(Number(score) || 0)));
  const best = state.arcade[player.id] || 0;
  if (got <= best) return { ok: true, best, changed: false };
  state.arcade[player.id] = got;
  return { ok: true, best: got, changed: true };
}

/**
 * WHO IS WINNING AT IT — names and scores, best first.
 *
 * Built here rather than on the projector, so the big screen and the host
 * cannot disagree about it. Five, because it is a band beside a join code
 * rather than a leaderboard anybody is studying — and a score whose player has
 * left is dropped, because a number with nobody attached is a puzzle.
 */
export function arcadeBoard(state, top = 5) {
  return Object.entries(state.arcade || {})
    .map(([id, score]) => ({ name: (state.players[id] || {}).name || '', score }))
    .filter((row) => row.name)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

/**
 * THE TWO NUMBERS A PHONE IS TOLD, and only ever these two.
 *
 * The SEED is what makes every phone play the same game, which is the only
 * thing that makes a scoreboard of it fair. `arcadeBest` is their own top
 * score, so the phone can say "your best: 70" without keeping its own tally
 * that a rejoin would lose.
 *
 * Sent at the lobby and nowhere else, by both engines. A phone that still has
 * a seed at question one is a phone that could still be playing, and the whole
 * design of this app is a room looking UP.
 */
export function arcadeFields(state, playerId) {
  return {
    gameSeed: state.gameSeed || 1,
    arcadeBest: (state.arcade || {})[playerId] || 0,
    /*
     * WHICH GAME TONIGHT, resolved at launch and read from the state — never
     * worked out on the phone.
     *
     * The tier was checked at the launch route, where the account is known, so
     * by the time it reaches a phone the decision is made and the phone's job
     * is only to honour it. A phone deciding for itself would mean the console
     * saying one game is on and the room being handed another, which is the
     * console-and-projector disagreement this app refuses everywhere else.
     *
     * A night launched before this existed has no `lobbyGame`, and the phone's
     * own `lobbyGameFor` then falls back to the default for the kind of night
     * it is — which is exactly what it used to do.
     */
    lobbyGame: state.lobbyGame || '',
    /*
     * Whether the phones may make a noise tonight — the host's switch. A night
     * saved before this existed has no field, and `!== false` means it plays,
     * which is what such a night did.
     */
    lobbySound: state.lobbySound !== false,
  };
}
