/**
 * PILE UP — the fifth lobby game. A crate swings across the top of the screen;
 * tap to drop it on the stack. What hangs over the edge shears off, so the
 * tower narrows every time you are slightly out.
 *
 * ---
 *
 * **THE NAME AND THE MECHANIC ARE BOTH DELIBERATELY NOT THE FALLING-BLOCKS
 * ONE.** That is the same legal line the first three games were named around,
 * and here it decided the GAME rather than only its title: the seven
 * tetromino shapes, the playfield proportions and the way they are coloured
 * were held to be protectable expression in *Tetris Holding v. Xio* (2012),
 * and this app is SOLD. A stacker has none of that — no rotation, no shapes,
 * no line clears, no well. Stacking crates is a fairground game, like Quick
 * Draw's shooting gallery, so once again the honest design was also the safe
 * one. **Do not "improve" this into a falling-blocks game.**
 *
 * **THE CONTROL IS ONE TAP AND NOTHING ELSE**, which is the strongest reason
 * to build this one. Maze Mouth and Tailback take a destination, Quick Draw
 * takes a target; this takes a moment. There is nothing to aim, nothing to
 * hold and nothing to drag, so there is nothing a fat thumb or a tired
 * digitiser can misread — it is the most forgiving control of the five, and
 * the only one with no spatial accuracy in it at all.
 *
 * ---
 *
 * **A SCHEDULE, LIKE QUICK DRAW — the cleanest of the three answers this
 * codebase gives to the fairness problem.**
 *
 * Every phone in the room plays the identical game or the board compares
 * handsets. The crate's position is a TRIANGLE WAVE of game time: at any
 * moment `t`, where it is, is a pure function of `t` and the tower so far.
 * Nothing accumulates, so nothing can drift — a phone that samples every 8ms
 * and one that misses a whole second land in exactly the same place, and a
 * drop resolves against the crate's true position at the instant of the tap
 * rather than against whatever the last frame happened to draw.
 *
 * That last part is what makes it fair on a slow handset: the swing is
 * continuous, so resolving a tap a frame late would cost real width on a
 * 30Hz phone and none on a 120Hz one. `dropAt(g, t)` takes the moment.
 *
 * **AND IT IS NOT A REACTION TEST**, which is the one limit Quick Draw could
 * not engineer away. There is no window to hit — a late tap is a narrower
 * crate rather than a miss — so eighty milliseconds of handset costs a sliver
 * of width instead of a life. It degrades smoothly where a reaction game
 * cannot.
 */

import { seeded } from './seeded.js';

/** The playfield, in its own units. The canvas scales to it. */
export const W = 600;
export const H = 900;

export const LIVES = 3;

/** How wide the first crate is — a third of the screen, so nobody misses it. */
const START_W = W / 3;

/** How tall each crate is. Twelve fit on screen before the view scrolls. */
export const CRATE_H = H / 12;

/**
 * Narrower than this and there is nothing left to aim at, so the tower falls.
 *
 * It is a floor on the GAME rather than on the drawing: below about this the
 * next crate cannot be placed accurately enough by anybody, on any handset,
 * and a game that becomes impossible rather than hard is one people think is
 * broken.
 */
const MIN_W = 14;

/** How fast the crate swings, and how much faster each row makes it. */
const START_SPEED = 0.16;      // playfield units per millisecond
const SPEED_STEP = 0.006;
const MAX_SPEED = 0.62;

/**
 * A drop within this of dead centre counts as clean: nothing is lost and it
 * scores double.
 *
 * **It is a REWARD, never a requirement** — the tower still narrows normally
 * when you miss it, so this only ever adds. A tolerance that had to be hit
 * would turn a forgiving game into the reaction test this one exists not to
 * be.
 */
const PERFECT = 4;

const PLACED = 10;
const PERFECT_BONUS = 15;

/**
 * A whole game, ready to be run to any point in time. No canvas, no clock.
 *
 * The stack is bottom-up. The first crate is placed for you, centred, so the
 * game opens with something to aim at rather than with a decision.
 */
export function newGame(seed) {
  const roll = seeded(seed);
  return {
    roll,
    at: 0,
    /** Bottom-up: `{ x, w }`, x being the left edge in playfield units. */
    stack: [{ x: (W - START_W) / 2, w: START_W }],
    /**
     * When the crate now swinging started its sweep, and which way it set off.
     * The seed decides the side so every phone swings together, and it is the
     * only randomness in the game — everything else is the player.
     */
    sweepFrom: 0,
    dir: roll() < 0.5 ? 1 : -1,
    lives: LIVES,
    score: 0,
    placed: 0,
    perfects: 0,
    over: false,
    won: false,
  };
}

/** The crate on top of the pile — what the next one has to land on. */
export function top(g) {
  return g.stack[g.stack.length - 1];
}

/** How fast the crate is swinging now. Faster the higher you get. */
export function speed(g) {
  return Math.min(MAX_SPEED, START_SPEED + g.placed * SPEED_STEP);
}

/**
 * WHERE THE CRATE IS AT TIME `t` — a triangle wave, and the whole reason this
 * game cannot drift.
 *
 * It bounces between the two walls, so the travel is `W - w` each way and the
 * period is twice that. `t` is game time in milliseconds since the game began;
 * the caller owns the clock and this file only ever asks what time it is.
 */
export function crateAt(g, t) {
  const w = top(g).w;
  const travel = Math.max(1, W - w);
  const elapsed = Math.max(0, t - g.sweepFrom) * speed(g);
  const period = travel * 2;
  const phase = elapsed % period;
  const along = phase <= travel ? phase : period - phase;
  const x = g.dir === 1 ? along : travel - along;
  return { x, w };
}

/**
 * DROP IT, at the moment the finger landed.
 *
 * `t` is the tap's own moment rather than the last frame's — see the note at
 * the top. The overlap with the crate below is what survives; the overhang
 * shears off and the tower gets narrower, which is the whole game.
 *
 * @returns {string[]} what happened — `'placed'`, `'perfect'`, `'missed'`,
 *   `'life'`, `'over'`. The canvas uses them for a noise and a flash; the
 *   tests use them to prove a miss really does cost a life.
 */
export function dropAt(g, t) {
  const events = [];
  if (g.over) return events;
  g.at = Math.max(g.at, t);

  const crate = crateAt(g, t);
  const under = top(g);
  const left = Math.max(crate.x, under.x);
  const right = Math.min(crate.x + crate.w, under.x + under.w);
  const overlap = right - left;

  /*
   * OFF THE END ENTIRELY, or what is left is too thin to aim at. Both are the
   * same thing from the player's side: there is no tower any more.
   */
  if (overlap < MIN_W) {
    events.push('missed');
    g.lives -= 1;
    events.push('life');
    if (g.lives <= 0) {
      g.over = true;
      events.push('over');
      return events;
    }
    /*
     * A LIFE COSTS THE TOP OF THE TOWER — IT FALLS OFF, it is not replaced.
     *
     * Starting again from one crate would make the second life worth nothing:
     * you would be re-earning what you already had rather than carrying on,
     * and this game banks a score at every life lost, so a reset would make
     * those banks meaningless too.
     *
     * **BUT THE FIRST VERSION PUSHED A WIDER CRATE ON TOP, AND IT LOOKED LIKE
     * A BUG.** Seen on a real phone: a full-width crate balanced on a sliver,
     * which is the one thing a player can tell at a glance is wrong. The
     * stack only ever narrows going up, so the wider part of the tower is
     * already there — POP back down to it. It reads as the top of your tower
     * toppling, which is exactly what the screen has just said, and it can
     * never reach nothing because the base crate is `START_W`.
     */
    const floorW = Math.min(START_W, Math.max(START_W / 2, under.w * 2));
    while (g.stack.length > 1 && top(g).w < floorW) g.stack.pop();
    g.sweepFrom = t;
    g.dir = g.roll() < 0.5 ? 1 : -1;
    return events;
  }

  const clean = Math.abs(crate.x - under.x) <= PERFECT;
  /*
   * A CLEAN DROP KEEPS THE FULL WIDTH, which is what stops a long game
   * becoming a sliver by attrition. Without it the tower only ever narrows and
   * every game ends the same way at about the same height, whoever is playing.
   */
  const placedCrate = clean ? { x: under.x, w: under.w } : { x: left, w: overlap };
  g.stack.push(placedCrate);
  g.placed += 1;
  g.score += PLACED + (clean ? PERFECT_BONUS : 0);
  if (clean) g.perfects += 1;
  events.push('placed');
  if (clean) events.push('perfect');

  g.sweepFrom = t;
  g.dir = g.roll() < 0.5 ? 1 : -1;
  return events;
}

/**
 * Run the clock forward with nothing being dropped.
 *
 * There is nothing to resolve — the crate swings and that is all — so this
 * only moves `at`. It exists so the canvas has one thing to call per frame and
 * so a test can advance time without pretending to tap.
 */
export function runTo(g, t) {
  if (!g.over && t > g.at) g.at = t;
  return [];
}

/**
 * Play a whole game headlessly, for the tests.
 *
 * `controller(g, t)` returns true to drop at that moment. Same shape as the
 * other four games' own, so the frame-rate-independence test can drive any of
 * them the same way.
 */
export function playOut(seed, controller, { frameMs = 16, maxMs = 600_000 } = {}) {
  const g = newGame(seed);
  for (let t = 0; t <= maxMs && !g.over; t += frameMs) {
    runTo(g, t);
    if (controller(g, t)) dropAt(g, t);
  }
  return g;
}
