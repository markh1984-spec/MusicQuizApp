/**
 * THE LOBBY GAME'S SCOREBOARD, ON THE PROJECTOR.
 *
 * **It was computed and never drawn, for as long as the feature has existed.**
 * Both engines put `arcade` in the screen payload at the lobby, there is a
 * test asserting it is there, CLAUDE.md says *"the board is on the projector
 * at the lobby only"* — and no projector file ever read the field. The phone
 * meanwhile promised the room *"Top scores go on the big screen"*, which was
 * simply not true. Found while adding the second game.
 *
 * That is the shape of fault a test cannot catch, because the test was right:
 * the payload really did contain the board. Nothing checks that anybody drew
 * it.
 *
 * ---
 *
 * **ONE FILE FOR BOTH PROJECTORS**, like the board itself is one function for
 * both engines — a quiz lobby and a bingo lobby showing the same numbers in
 * two different shapes is the kind of drift this codebase keeps recording.
 *
 * **IT SITS UNDER THE JOIN CODE AND NEVER OVER IT.** The QR is the one control
 * that lets somebody into the game, and the rule this app already learned the
 * hard way is that nothing may dim it — a photo did once, and it made the code
 * unscannable for four and a half seconds. A board below the panel cannot.
 *
 * **NOTHING AT ALL UNTIL SOMEBODY HAS PLAYED.** An empty "Top scores" card
 * with nothing under it is a hole on the one screen the whole room is looking
 * at while they settle down, and it would be up for the entire ten minutes
 * before the first person opens the game.
 */

import { esc, node } from './client.js';
import { lobbyGameById } from './lobby-games.js';

/** The slot, empty. Put it in the lobby's right-hand column, under the QR. */
export function arcadeSlot() {
  return '<div class="arcade-board" id="arcadeBoard" hidden></div>';
}

/**
 * Fill it in, on every state push.
 *
 * Repainted in place rather than rebuilt with the card, because the lobby is
 * rendered once and scores arrive for the whole ten minutes afterwards — the
 * same reason the player strip and the countdown are painted here.
 */
export function paintArcadeBoard(s) {
  const box = document.getElementById('arcadeBoard');
  if (!box) return;
  const rows = (s && s.arcade) || [];
  box.hidden = rows.length === 0;
  if (!rows.length) { box.replaceChildren(); return; }
  /*
   * IT NAMES THE GAME, because a bare "Top scores" is a scoreboard for
   * something the room has to guess at.
   *
   * The projector is the one screen everybody can see and the only place the
   * game is ever named out loud — a phone shows the game itself and needs no
   * label, and the host says whatever they like on the mic. Naming it here is
   * also what makes the board readable to somebody who has not opened it yet:
   * *"Top scores · Maze Mouth"* tells them there is a game and what it is, in
   * the ten minutes when the alternative is looking at a join code.
   *
   * **Falls back to the bare heading rather than guessing.** A night launched
   * before `lobbyGame` was stored sends no id, and the resolver that would
   * fill one in lives on the phone, where the tier is known. Naming the wrong
   * game on the big screen is worse than naming none.
   */
  const game = lobbyGameById(s && s.lobbyGame);
  box.replaceChildren(node(`
    <div>
      <div class="ab-head">Top scores${game ? ` · ${esc(game.name)}` : ''}</div>
      ${rows.map((r, i) => `
        <div class="ab-row">
          <span class="ab-pos">${i + 1}</span>
          <span class="ab-name">${esc(r.name)}</span>
          <span class="ab-score">${Number(r.score).toLocaleString('en-GB')}</span>
        </div>`).join('')}
    </div>`));
}
