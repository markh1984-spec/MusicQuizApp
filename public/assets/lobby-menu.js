/**
 * THE LOBBY GAME ON A PHONE — which one, and the card it sits behind.
 *
 * **Maze Mouth** before a quiz and **Rally** before the bingo by default, and
 * whatever the quizmaster picked at launch if their tier lets them pick. The
 * host's own split, and the reason is that a bingo night should have a
 * character of its own rather than being the quiz with different content.
 *
 * ---
 *
 * **THE DEFAULT FOLLOWS THE GAME, NOT THE ACCOUNT.** A quizmaster who runs a
 * quiz on Tuesday and bingo on Thursday wants a different game on each, so a
 * remembered per-account preference would be wrong on half their nights. What
 * they choose is a decision about TONIGHT, so it goes where the look and the
 * card shape go — into the game state at launch, and restored after a crash.
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

import { lobbyGameFor, lobbyGameById } from './lobby-games.js';
import { soundButton, wireSoundButton, allowSound } from './lobby-sound.js';

/**
 * WHICH MODULE DRAWS WHICH GAME.
 *
 * The list itself — names, hints, canvas shapes and which tier holds each —
 * is in `lobby-games.js`, because the SERVER reads it too. All that is left
 * here is the one thing a server can have no opinion about: the dynamic
 * `import()` that pulls the game in when somebody presses the button.
 *
 * A loader is a function rather than a path so the import stays a literal,
 * which is what keeps this working with no build step.
 */
const LOADERS = {
  maze: () => import('./lobby-game.js'),
  rally: () => import('./lobby-rally.js'),
  tailback: () => import('./lobby-tailback.js'),
  quickdraw: () => import('./lobby-quickdraw.js'),
  pileup: () => import('./lobby-pileup.js'),
};

/**
 * WHICH GAME THIS NIGHT GETS — what the quizmaster chose at launch if they
 * chose one, otherwise the default for the kind of night it is.
 *
 * The phone honours `s.lobbyGame` rather than deciding for itself, and it does
 * NOT re-check the tier: what a night gets was settled at launch by the
 * server, and a phone second-guessing it would mean a room being handed a
 * different game from the one the console says is on.
 */
export function lobbyGame(s) {
  return lobbyGameFor(s && s.game, s && s.lobbyGame);
}

/**
 * THE GAMES THIS ROOM MAY CHOOSE BETWEEN, or an empty list when the
 * quizmaster pinned one.
 *
 * Read straight off the payload and NOT re-checked against the tier — the
 * launch route resolved this against the account, and a phone second-guessing
 * it is how the console comes to say one thing and the room to be handed
 * another. Ids the phone does not recognise are dropped, so a night launched
 * by a newer server than the browser cannot draw a card with nothing behind
 * it.
 */
export function lobbyGames(s) {
  return ((s && s.lobbyGames) || []).map(lobbyGameById).filter(Boolean);
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
  const choices = lobbyGames(s);
  // What tonight says, before the button draws itself — or a muted room shows
  // a speaker icon that is on.
  allowSound(s.lobbySound !== false);
  /*
   * ONE ROW EITHER WAY, and the choice lives one tap inside it.
   *
   * Rendered against a row per game and a strip of chips before this was
   * chosen: five rows is 423px of menu on a 390px phone and it pushes *Send a
   * photo* off the bottom, which breaks the standing rule not to
   * disincentivise photo uploads. So the lobby keeps the shape it has and the
   * games are what is behind the button — the row simply says how many there
   * are, which is the part somebody needs before deciding to tap.
   */
  const many = choices.length > 1;
  return `
    <div class="arcade" ${s.gameSeed ? '' : 'hidden'}>
      <button class="wait-item arcade-open" type="button">
        <span class="wait-item-icon" aria-hidden="true">🕹️</span>
        <span class="wait-item-what">
          <b>${many ? 'Play a game' : `Play ${game.name}`}</b>
          <span class="tiny">${many
            ? `${choices.length} to choose from — top scores go on the big screen`
            : 'Top scores go on the big screen'}</span>
        </span>
      </button>
      <div class="arcade-box" hidden>
        ${many ? `
        <div class="arcade-pick">
          ${choices.map((g) => `
            <button class="arcade-pick-one" type="button" data-game="${g.id}">
              <span class="arcade-pick-icon" aria-hidden="true">${g.icon}</span>
              <span class="arcade-pick-name">${g.name}</span>
            </button>`).join('')}
        </div>` : ''}
        <div class="arcade-stage">
          <canvas class="arcade-canvas ${game.canvas.klass}" width="${game.canvas.w}" height="${game.canvas.h}"></canvas>
          <!-- The countdown, in the corner of the game. See paintStartsIn:
               somebody head-down in a game is not reading a number above it,
               and a clock lets them play to it rather than merely be told
               when it is over. -->
          <div class="arcade-going" hidden></div>
        </div>
        <!-- SOUND sits in the hint row UNDER the game, not on it.
             On the stage it would land on the score, which every one of these
             games draws in a top corner — and worse, a tap meant for the
             button that missed by a few pixels is a tap on the canvas, which
             on Quick Draw is a shot, and the shot could be the sheriff. Under
             the canvas it cannot overlap a HUD and cannot steal a gesture,
             and it is still ON the game rather than in a settings page
             somewhere: the moment somebody wants sound is the moment they are
             looking at this. -->
        <div class="arcade-under">
          <div class="tiny arcade-said">${game.how}</div>
          ${soundButton()}
        </div>
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
  const choices = lobbyGames(s);
  const stage = el.querySelector('.arcade-stage');
  const shut = choices.length > 1 ? 'Play a game' : `Play ${game.name}`;

  /**
   * START ONE. Called with whichever game the room picked, or with the
   * night's own when the quizmaster pinned it.
   *
   * **`stopArcade()` FIRST, every time.** Switching games is the same hazard
   * as the phase changing: a loop left running on a canvas that has just been
   * resized keeps drawing, keeps a window `keydown` listener, and keeps
   * banking scores under the wrong game. That fault has already cost this app
   * a night's worth of swallowed arrow keys.
   */
  const start = async (pick) => {
    stopArcade();
    /*
     * THE CANVAS IS RESHAPED TO THE GAME. Each one names its own drawing
     * surface and its own aspect class — a maze is square and a tower is 2:3
     * — so switching without this would letterbox one game inside another's
     * frame, or squash it.
     */
    const canvas = box.querySelector('.arcade-canvas');
    canvas.width = pick.canvas.w;
    canvas.height = pick.canvas.h;
    canvas.className = `arcade-canvas ${pick.canvas.klass}`;
    said.textContent = pick.how;
    for (const b of box.querySelectorAll('.arcade-pick-one')) {
      b.classList.toggle('on', b.dataset.game === pick.id);
    }
    const { startGame } = await LOADERS[pick.id]();
    const play = () => {
      running = startGame(canvas, {
        // EVERY PHONE PLAYING THIS GAME PLAYS THE SAME ONE — the seed comes
        // off the game state. It is shared across all of them on purpose:
        // each game derives its own layout from it, so one seed still means
        // two people who chose Pile Up are stacking the same crates.
        seed: s.gameSeed,
        // Banked at each life lost as well as at the end: a game interrupted
        // by the night starting never reaches game over, and by then the phase
        // has moved and a score is rightly refused. So the people who played
        // longest were the ones missing from the board.
        onBank: (score) => { postScore(score, pick.id); },
        onEnd: ({ score, won }) => {
          said.textContent = won ? `Cleared it — ${score}. Tap to play again.` : `${score}. Tap to play again.`;
          // ONE post, at game over. Not a stream of positions: the lobby is
          // exactly when the connection is busiest.
          postScore(score, pick.id);
          canvas.addEventListener('click', play, { once: true });
        },
      });
    };
    play();
  };

  open.addEventListener('click', async () => {
    const label = open.querySelector('b');
    if (!box.hidden) { box.hidden = true; stopArcade(); label.textContent = shut; return; }
    box.hidden = false;
    label.textContent = 'Put it away';
    wireSoundButton(box);
    /*
     * WITH A CHOICE, THE BOX OPENS ON THE CHOOSER AND NOTHING RUNS YET.
     *
     * Auto-starting the first one and letting them switch was the other way
     * round and is worse: it spends somebody's first seconds on a game they
     * did not choose, and on a reaction game it spends a life as well. The
     * stage is hidden until they pick, so the row of games IS the screen.
     */
    if (choices.length > 1) { stage.hidden = true; return; }
    await start(game);
  });

  for (const button of el.querySelectorAll('.arcade-pick-one')) {
    button.addEventListener('click', async () => {
      const pick = choices.find((g) => g.id === button.dataset.game);
      if (!pick) return;
      stage.hidden = false;
      await start(pick);
    });
  }
}
