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

import { lobbyGameById } from '../public/assets/lobby-games.js';

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
export function recordArcadeScore(state, playerId, score, { waiting, game = '' } = {}) {
  const player = state.players[String(playerId || '')];
  if (!player) return { ok: false, reason: 'unknown_player' };
  if (!waiting) return { ok: false, reason: 'not_waiting' };
  if (!state.arcade) state.arcade = {};
  const got = Math.max(0, Math.min(MAX_ARCADE_SCORE, Math.floor(Number(score) || 0)));
  const best = state.arcade[player.id] || 0;
  if (got <= best) return { ok: true, best, changed: false };
  state.arcade[player.id] = got;
  /*
   * WHICH GAME IT WAS SET ON — in a map BESIDE the scores, never folded into
   * them.
   *
   * `state.arcade` is `{ id: number }` and is on disk in every state file and
   * every backup there is; turning a number into an object would need a
   * migration on a host whose disk is wiped every deploy, which this app has
   * a standing rule against. A parallel map costs nothing and an old state
   * simply has none — those rows draw without an icon, which is honest,
   * because nothing recorded what they were playing.
   *
   * It matters at all because the room can now pick its own game: a maze
   * score and a crate-stacking score are not comparable, so a board that did
   * not say which was quietly inventing a league table out of five different
   * sports.
   */
  // CHECKED AGAINST THE REAL LIST, because it comes off a phone and lands on
  // a projector. Nothing is granted by it, so an unknown id is simply dropped
  // rather than refused — the row then draws with no icon, which is what a
  // score from before this existed does anyway.
  if (lobbyGameById(game)) {
    if (!state.arcadeGame) state.arcadeGame = {};
    state.arcadeGame[player.id] = String(game);
  }
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
    .map(([id, score]) => ({
      name: (state.players[id] || {}).name || '',
      score,
      /*
       * The game it was set on — SPREAD IN ONLY WHEN THERE IS ONE, so a night
       * with a pinned game sends the exact two-field row it has always sent
       * and nothing downstream has to learn a new shape. A score banked before
       * the room could choose has none, and the projector draws that row as it
       * always did.
       */
      ...((state.arcadeGame || {})[id] ? { game: state.arcadeGame[id] } : {}),
    }))
    .filter((row) => row.name)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

/**
 * WHAT A PHONE IS TOLD ABOUT THE LOBBY GAME.
 *
 * The SEED is what makes every phone play the same game, which is the only
 * thing that makes a scoreboard of it fair.
 *
 * **`arcadeBest` USED TO BE HERE AND NOTHING EVER DREW IT.** The comment above
 * it said it was there "so the phone can say 'your best: 70'", which was never
 * true of any build — the same shape as the arcade board that sat in a payload
 * for as long as the feature existed with no projector reading it. A field on a
 * view is a promise that something draws it, so it is gone rather than left. If
 * a phone ever wants its own best back, add it here and draw it in the same
 * commit.
 *
 * Sent at the lobby and nowhere else, by both engines. A phone that still has
 * a seed at question one is a phone that could still be playing, and the whole
 * design of this app is a room looking UP.
 */
export function arcadeFields(state) {
  return {
    gameSeed: state.gameSeed || 1,
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
     * AND THE LIST, when the quizmaster left the choice to the room.
     *
     * **Spread in only when there IS one**, like `winners` and the comeback
     * band — a night with a pinned game sends exactly the payload it sent
     * before this existed, so `pub-unchanged` can still say IDENTICAL about
     * every ordinary gig. The phone draws its plain card whenever this is
     * absent, which is also what a state restored from an older deploy gives
     * it.
     */
    ...(Array.isArray(state.lobbyGames) && state.lobbyGames.length > 1
      ? { lobbyGames: state.lobbyGames.slice() } : {}),
    /*
     * Whether the phones may make a noise tonight — the host's switch. A night
     * saved before this existed has no field, and `!== false` means it plays,
     * which is what such a night did.
     */
    lobbySound: state.lobbySound !== false,
  };
}
