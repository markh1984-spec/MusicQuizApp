/**
 * TAILBACK — the third lobby game, and the one where you are your own problem.
 *
 * A tail that grows every time you eat, on an open field, steered by tapping
 * where you want to go. The name is the British one for a traffic jam and it
 * is also literally what the game is; it is not the one-word name everybody
 * will say out loud, for the reason `rally.js` sets out and CLAUDE.md records.
 *
 * ---
 *
 * **THE RULES ARE HERE AND THE CANVAS IS IN `lobby-tailback.js`**, the same
 * split as the other two, so a test can play a whole game to its end without a
 * browser. It earns its keep immediately here: the way this game is broken is
 * that the steering routes you into your own tail, and that is a thing you
 * find in ten thousand simulated steps rather than by playing it.
 *
 * **IT IS GRID-BASED, WHICH IS WORTH MORE THAN IT SOUNDS.** Everything moves
 * one cell per `STEP_MS`, so the fixed-timestep problem Rally had to solve does
 * not exist here — there is nothing continuous to accumulate error in, and a
 * 30Hz phone plays precisely the game a 120Hz one does. Maze Mouth is built the
 * same way and for the same reason.
 *
 * **AN OPEN FIELD, NOT A MAZE.** Reusing Maze Mouth's walls was the obvious
 * saving and it is the wrong game: a maze plus a body that grows is boxed in
 * within thirty seconds, and the tension here is meant to be the tail you have
 * made rather than the walls somebody else drew. The only walls are the edges.
 *
 * **WHAT IS ACTUALLY SHARED WITH THE MAZE IS THE IDEA, NOT THE CODE.** Its
 * `stepToward()` walks a static map; this one has to route around a body that
 * moves every step, which is a different function with the same shape. Worth
 * saying plainly rather than claiming a reuse that is not there.
 */

import { seeded } from './seeded.js';

/**
 * Fifteen across, like the maze, so a cell is 20px on a 320px phone — big
 * enough to see, small enough that the field fits without scrolling. 225 cells
 * is also a long way from being filled, so the game ends by mistake rather
 * than by running out of room.
 */
export const COLS = 15;
export const ROWS = 15;

export const STEP_MS = 130;
export const LIVES = 3;

/** How long you start, and how much a pellet is worth in cells and in points. */
const START_LENGTH = 4;
const GROW = 2;
const PELLET = 10;
/*
 * A SMALL BONUS FOR A LONG TAIL, so a score says how far you got rather than
 * only how many you ate. Without it the twentieth pellet is worth exactly what
 * the first was, on a board where the twentieth is enormously harder.
 */
const LENGTH_BONUS = 2;

const key = (c, r) => `${c},${r}`;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Inside the field? The only walls are the edges. */
export function inField(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

/**
 * THE FIRST STEP OF THE SHORTEST WAY THERE, ROUTING AROUND A BODY.
 *
 * This is what lets the game have no control panel: you tap and it goes, the
 * quickest way that is not through itself. **The body has to be blocked or the
 * steering kills you** — a head sent straight through its own tail because the
 * route was shorter is the game taking a life for something the player did not
 * do, which is the difference between a control and a passenger.
 *
 * **The tail END is not blocked**, and that is not a detail: by the time the
 * head arrives that cell has moved on, so treating it as a wall makes the tail
 * refuse gaps it can plainly fit through — which reads as the steering being
 * broken. **Except while it is growing**, when the end stays put and is as
 * solid as the rest — `growing` is that, and getting it wrong is a life lost
 * to a gap that was not there.
 *
 * Recomputed every step, like the maze's. 225 cells is nothing, and doing it
 * fresh is what makes re-tapping instant.
 */
export function stepToward(from, to, body = [], growing = false) {
  if (!from || !to) return null;
  if (from.col === to.col && from.row === to.row) return null;
  const solidCells = growing ? body : body.slice(0, -1);
  const blocked = new Set(solidCells.map((p) => key(p.col, p.row)));
  if (blocked.has(key(to.col, to.row))) return null;

  // Walked OUT from the target, so one pass answers "how far is every cell
  // from where they tapped" and the step is whichever neighbour is nearest.
  const dist = new Map([[key(to.col, to.row), 0]]);
  const queue = [{ col: to.col, row: to.row, d: 0 }];
  while (queue.length) {
    const at = queue.shift();
    if (at.col === from.col && at.row === from.row) break;
    for (const [dc, dr] of DIRS) {
      const col = at.col + dc;
      const row = at.row + dr;
      const k = key(col, row);
      if (!inField(col, row) || blocked.has(k) || dist.has(k)) continue;
      dist.set(k, at.d + 1);
      queue.push({ col, row, d: at.d + 1 });
    }
  }

  let best = null;
  let bestD = Infinity;
  for (const [dc, dr] of DIRS) {
    const d = dist.get(key(from.col + dc, from.row + dr));
    if (d === undefined || d >= bestD) continue;
    bestD = d;
    best = [dc, dr];
  }
  return best;
}

/**
 * WHERE THE NEXT PELLET GOES — off the seed, so the room gets the same run.
 *
 * The candidates come from one seeded stream and the first that is not under
 * the tail is taken. **Two people who play the same way get the same pellets**,
 * which is as fair as this can be made: a pellet's position depends on where
 * the body is, and the body is the player. Anything stricter would mean
 * dropping a pellet under somebody's own tail.
 */
function nextPellet(g) {
  const taken = new Set(g.body.map((p) => key(p.col, p.row)));
  for (let tries = 0; tries < 500; tries++) {
    const col = Math.floor(g.roll() * COLS);
    const row = Math.floor(g.roll() * ROWS);
    if (!taken.has(key(col, row))) return { col, row };
  }
  // The field is essentially full, which is somebody having played extremely
  // well. Anywhere free will do, and if there is nowhere they have won.
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) if (!taken.has(key(col, row))) return { col, row };
  }
  return null;
}

/** A whole game, ready to be stepped. No canvas, no clock, no DOM. */
export function newGame(seed) {
  const g = {
    roll: seeded(seed),
    lives: LIVES,
    score: 0,
    eaten: 0,
    over: false,
    won: false,
  };
  reset(g);
  return g;
}

/** Back to a short tail in the middle, facing right. Score is kept. */
function reset(g) {
  const row = Math.floor(ROWS / 2);
  const col = Math.floor(COLS / 2);
  // Head first, so `body[0]` is always the head and the tail is the end.
  g.body = Array.from({ length: START_LENGTH }, (_, i) => ({ col: col - i, row }));
  g.dir = [1, 0];
  g.target = null;
  g.grow = 0;
  g.pellet = nextPellet(g);
  /*
   * IT WAITS FOR THE FIRST TAP, and that is the same fix Rally's serve pause
   * is. Moving the instant a life is lost means somebody who has just been
   * caught out loses the next one before they have looked up — three lives in
   * under three seconds, measured, on a game whose whole point is that a phone
   * stays in somebody's hand for five minutes.
   *
   * It also teaches the control without a word of instruction: nothing happens
   * until you touch it, and then it goes where you touched.
   */
  g.waiting = true;
}

/** Tap a cell. Off the field is ignored rather than clamped — a tap in the
 *  margin is a miss, and steering somewhere nobody chose is worse than
 *  carrying on. */
export function aim(g, col, row) {
  if (!inField(col, row)) return;
  g.target = { col, row };
  g.waiting = false;
}

/**
 * ONE STEP.
 *
 * @returns {string|null} `'eat'`, `'life'`, `'over'`, `'won'` or null.
 */
export function step(g) {
  if (g.over) return null;

  /*
   * IT NEVER STOPS, and that is the game.
   *
   * A tail that halts when you have not tapped is a puzzle you can think
   * about, and the whole tension here is that the field is filling up while
   * you decide. So: go towards the target if there is a way, otherwise carry
   * straight on, otherwise turn — and if there is nowhere at all, that is what
   * a life is lost for.
   */
  if (g.waiting) return null;

  const head = g.body[0];
  /*
   * THE DANGER IS YOUR OWN TAIL, NEVER THE WALLS — steer if there is a way,
   * carry straight on if not, and follow the edge round rather than die on it.
   *
   * Dying at a wall was tried and is wrong for THIS control. Tapping a
   * destination is not holding a direction: the natural way to play is tap,
   * watch, tap again, and the moment the head reaches the target there is no
   * target left — so a wall killed you for the gap between two taps rather
   * than for a mistake. Measured, a human-paced player got **eight to thirty
   * seconds for three lives**, which is not a game, it is a punishment for
   * blinking.
   *
   * The obvious worry about turning instead — that a phone nobody is touching
   * survives for ever — is real and does not matter, and that was worth
   * measuring rather than assuming: an abandoned game wanders, eats the odd
   * pellet by accident and takes **forty minutes to reach a score a real
   * player passes in under one**. It cannot reach the board, so it does not
   * need killing. And a wandering tail does eventually box itself in, which is
   * the honest ending.
   *
   * What it buys is the shape snake is supposed to have: forgiving while you
   * are short, and tightening entirely because of what you have made.
   */
  let dir = stepToward(head, g.target, g.body, g.grow > 0);
  if (!dir && free(g, g.dir)) dir = g.dir;
  // Deterministic by DIRS order, which matters — every phone in the room has
  // to make the same turn. Reversing into its own neck is not free, so it
  // cannot be picked.
  if (!dir) dir = DIRS.find((d) => free(g, d)) || null;
  if (!dir) {
    // Boxed in by your own tail. The one way this is lost, and always the
    // player's doing — which is exactly why the steering must never be.
    return lose(g);
  }
  g.dir = dir;

  const next = { col: head.col + dir[0], row: head.row + dir[1] };
  g.body.unshift(next);
  if (g.target && next.col === g.target.col && next.row === g.target.row) g.target = null;

  if (g.pellet && next.col === g.pellet.col && next.row === g.pellet.row) {
    g.eaten += 1;
    g.score += PELLET + g.body.length * LENGTH_BONUS;
    /*
     * GROWN BY NOT TRIMMING FOR THE NEXT FEW STEPS, never by stacking copies
     * of the end cell on top of each other.
     *
     * Stacking was the first version and it works, but it puts two cells in
     * one square for a step or two — which means the body list stops being a
     * set of occupied squares, so "the tail never crosses itself" cannot be
     * asserted, the drawing paints the same square twice, and every routing
     * question has to allow for it. Growing a cell per step is what the game
     * looks like anyway.
     */
    g.grow += GROW;
    g.pellet = nextPellet(g);
    if (!g.pellet) { g.over = true; g.won = true; return 'won'; }
    return 'eat';
  }

  // While it is growing the end does NOT move on, so it is a wall this step —
  // see `free()` and `stepToward()`, both of which treat the last cell as
  // clear on the strength of it moving.
  if (g.grow > 0) g.grow -= 1;
  else g.body.pop();
  return null;
}

/**
 * Is the cell that way free — inside the field and not under the tail?
 *
 * The tail END is free, because it moves on as the head arrives — **unless the
 * tail is still growing**, in which case it stays put this step and is as
 * solid as the rest of it.
 */
function free(g, dir) {
  const col = g.body[0].col + dir[0];
  const row = g.body[0].row + dir[1];
  if (!inField(col, row)) return false;
  return !solid(g).some((p) => p.col === col && p.row === row);
}

/** The cells that will still be occupied after this step. */
function solid(g) {
  return g.grow > 0 ? g.body : g.body.slice(0, -1);
}

function lose(g) {
  g.lives -= 1;
  if (g.lives <= 0) { g.over = true; return 'over'; }
  reset(g);
  return 'life';
}

/**
 * PLAY A WHOLE GAME WITHOUT A BROWSER — for the tests, and only for them.
 *
 * `controller(game)` returns `{col, row}` to tap, or null to leave the last
 * tap standing. That is enough to write "somebody who always aims at the
 * pellet" and "somebody who never touches it" in three lines each, which is
 * what turns *can it be lost, can it be scored in, does the steering kill
 * you* into assertions.
 */
export function playOut(seed, controller, maxSteps = 20_000) {
  const g = newGame(seed);
  const events = [];
  let steps = 0;
  while (!g.over && steps < maxSteps) {
    const want = controller(g);
    if (want) aim(g, want.col, want.row);
    const e = step(g);
    if (e) events.push(e);
    steps += 1;
  }
  return { game: g, events, steps, finished: g.over };
}
