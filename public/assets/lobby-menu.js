/**
 * THE LOBBY GAME ON A PHONE — which one, and the card it sits behind.
 *
 * There are two now: **Maze Mouth** before a quiz and **Rally** before the
 * bingo. The host's own split, and the reason is that a bingo night should
 * have a character of its own rather than being the quiz with different
 * content in it.
 *
 * ---
 *
 * **THE DEFAULT FOLLOWS THE GAME, NOT THE ACCOUNT.** A quizmaster who runs a
 * quiz on Tuesday and bingo on Thursday wants a different game on each, so a
 * remembered preference would be wrong on half their nights. The phone already
 * knows which night it is on (`s.game`), so it costs exactly one branch and
 * nothing has to be chosen or stored.
 *
 * **IT LIVES HERE RATHER THAN IN `play.js`, because two screens want it.** The
 * quiz's waiting card and the bingo lobby are different files that share
 * nothing else, and a card built twice is a card that says two different
 * things about the same feature within a month — which is the fault CLAUDE.md
 * records against `plans.js` and `looks.js` and solves the same way.
 *
 * **NOBODY WHO NEVER PRESSES THE BUTTON PAYS FOR A GAME.** The module is
 * imported when the button is pressed and not before, which matters on pub
 * wifi, on the one page sixty people are opening at the same moment.
 */

/**
 * The two games, and everything that differs between them.
 *
 * `load` is a function rather than a path so the bundler-free import is still
 * a plain dynamic `import()` of a literal — the same shape `play.js` used when
 * there was only one game.
 */
const GAMES = {
  maze: {
    name: 'Maze Mouth',
    /*
     * THE CANVAS IS THE SHAPE OF THE GAME, not one shape for both.
     *
     * The maze is square because the maze is square. Rally's court is 2:3, and
     * drawn into a square canvas it letterboxes — a third of the width left
     * empty down both sides and every bat, ball and pip a third smaller for
     * it, on a phone. The drawing scales to whatever it is given, so this is
     * the one number that decides how big the game is.
     */
    canvas: { w: 600, h: 600, klass: '' },
    /*
     * WHAT TO DO, said in the fewest words that are still true. Not a
     * paragraph: this is the house rule about labels — a title that names the
     * thing and one line that finishes "this gives me…" in a breath.
     */
    how: 'Tap where you want to go',
    load: () => import('./lobby-game.js'),
  },
  rally: {
    name: 'Rally',
    how: 'Slide your thumb along the bottom',
    // 2:3, the court's own proportions and roughly a phone held upright.
    // `.tall` is where the height is bounded — see the note in style.css.
    canvas: { w: 600, h: 900, klass: 'tall' },
    load: () => import('./lobby-rally.js'),
  },
};

/**
 * WHICH GAME THIS NIGHT GETS. Bingo gets Rally, everything else gets the maze.
 *
 * Written as "bingo or not" rather than a lookup by `s.game`, so a third game
 * type added to `LAUNCHERS` gets a lobby game rather than an empty card — the
 * failure that would otherwise be silent, on a screen nobody tests.
 */
export function lobbyGame(s) {
  return s && s.game === 'bingo' ? GAMES.rally : GAMES.maze;
}

/**
 * The card, as markup, for whichever screen is putting it up.
 *
 * Hidden rather than absent when there is no seed: a night launched by an
 * older deploy has none, and an empty gap is better than a button that does
 * nothing when pressed.
 */
export function arcadeCard(s) {
  const game = lobbyGame(s);
  return `
    <div class="arcade" ${s.gameSeed ? '' : 'hidden'}>
      <button class="wait-item arcade-open" type="button">
        <span class="wait-item-icon" aria-hidden="true">🕹️</span>
        <span class="wait-item-what">
          <b>Play ${game.name}</b>
          <span class="tiny">Top scores go on the big screen</span>
        </span>
      </button>
      <div class="arcade-box" hidden>
        <div class="arcade-stage">
          <canvas class="arcade-canvas ${game.canvas.klass}" width="${game.canvas.w}" height="${game.canvas.h}"></canvas>
          <!-- The countdown, in the corner of the game. See paintStartsIn:
               somebody head-down in a game is not reading a number above it,
               and a clock lets them play to it rather than merely be told
               when it is over. -->
          <div class="arcade-going" hidden></div>
        </div>
        <div class="tiny arcade-said">${game.how}</div>
      </div>
    </div>`;
}

/**
 * THE RUNNING GAME, and there is only ever one.
 *
 * Module-level rather than per-card because the card is rebuilt on phase
 * changes and a second game started over the first would leave the first
 * looping for the rest of the night — which is precisely the fault this
 * paragraph used to describe and the code did not actually prevent.
 */
let running = null;

/**
 * STOP EVERYTHING, and it is safe to call when nothing is running.
 *
 * **CALL THIS ON EVERY REBUILD, not only when the lobby card is being put
 * up.** It used to be called from inside `wireArcade` alone — which is only
 * reached while the waiting screen is being built — so the moment the phase
 * moved to a question the canvas was thrown away and the loop was NOT: it ran
 * for the rest of the night on a detached canvas, kept a `keydown` listener on
 * the window swallowing the arrow keys, and posted a score at every life lost
 * into a server that rightly refused it. Nothing showed on screen, which is
 * why it survived; the comment above it claimed it could not happen.
 */
export function stopArcade() {
  if (!running) return;
  running.stop();
  running = null;
}

/**
 * Wire the card up. `postScore` is passed in rather than built here, because
 * the two screens hold their own player identity and this file has no business
 * knowing about either.
 */
export function wireArcade(el, s, postScore) {
  stopArcade();
  const box = el.querySelector('.arcade-box');
  const open = el.querySelector('.arcade-open');
  if (!box || !open || !s.gameSeed) return;
  const game = lobbyGame(s);
  const said = el.querySelector('.arcade-said');
  open.addEventListener('click', async () => {
    const label = open.querySelector('b');
    if (!box.hidden) { box.hidden = true; stopArcade(); label.textContent = `Play ${game.name}`; return; }
    box.hidden = false;
    label.textContent = 'Put it away';
    const { startGame } = await game.load();
    const play = () => {
      running = startGame(box.querySelector('.arcade-canvas'), {
        // EVERY PHONE IN THE ROOM PLAYS THE SAME GAME — the seed comes off the
        // game state, which is what makes the scoreboard mean anything.
        seed: s.gameSeed,
        // Banked at each life lost as well as at the end: a game interrupted
        // by the night starting never reaches game over, and by then the phase
        // has moved and a score is rightly refused. So the people who played
        // longest were the ones missing from the board.
        onBank: (score) => { postScore(score); },
        onEnd: ({ score, won }) => {
          said.textContent = won ? `Cleared it — ${score}. Tap to play again.` : `${score}. Tap to play again.`;
          // ONE post, at game over. Not a stream of positions: the lobby is
          // exactly when the connection is busiest.
          postScore(score);
          box.querySelector('.arcade-canvas').addEventListener('click', play, { once: true });
        },
      });
    };
    play();
  });
}
