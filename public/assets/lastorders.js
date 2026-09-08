/**
 * LAST ORDERS — the fifth lobby game. A wall of drinkers comes down the pub
 * towards the bar and you clear them before they reach it.
 *
 * ---
 *
 * **THE NAME CAME FIRST, WHICH IS THIS REPO'S OWN RULE.** *"An unnamed game
 * keeps inviting the wrong name"* — Maze Mouth, Rally and Tailback were each
 * named around somebody's trademark after the fact, and it was expensive
 * enough that the later ones are named before a line is written.
 *
 * **AND THE LEGAL LINE IS DIFFERENT FROM PILE UP'S, WHICH IS WHY THIS ONE IS
 * ALLOWED TO EXIST.** The game this resembles is Taito's, and what Taito owns
 * is the NAME and the specific alien sprites — not the idea of a formation
 * descending on a defender. A fixed shooter is an enormous, ancient, endlessly
 * cloned genre, which is the opposite of the position *Tetris Holding v. Xio*
 * left a falling-block game in: there a court held the specific shapes and the
 * well protectable, and the rights holder enforces it hard. So Pile Up could
 * not be improved into the game it was being compared to, and this one can be
 * built as long as it takes nothing that is actually theirs:
 *
 * - **it is not called Space Invaders**, or anything close to it;
 * - **the drinkers are not their aliens** — no crab, no squid, no octopus, and
 *   no 5x11 formation of them;
 * - **there is no mystery saucer** and no set of four destructible bunkers.
 *
 * Say whatever you like on a mic. Do not print it, and do not draw it.
 *
 * ---
 *
 * **EVERY PHONE PLAYS THE SAME GAME, and this one uses the GRID-AND-FIXED-STEP
 * answer** — the first of the three this codebase allows. The formation lives
 * on integer columns and rows and moves one step per tick, so there is no
 * accumulated float to drift; `tick()` is called a whole number of times and
 * two phones that called it the same number of times are in the same state.
 *
 * The other two answers were considered and are worse fits. A pure schedule
 * (Quick Draw's) cannot work because the player DESTROYS things — the state at
 * time T is not a function of the seed and T once a shot has landed. Rally's
 * accumulator is for continuous motion and this is not continuous.
 *
 * ---
 *
 * **THE CONTROL IS TAP-TO-DESTINATION, the one already proven twice here.**
 * You tap where you want to be and the glass slides there, firing on its own.
 * No fire button — a button plus movement is a control panel, and the standing
 * rule is that a swipe has to be READ and a misread one costs a life.
 *
 * Auto-fire is not a simplification either: it makes POSITIONING the whole
 * game, which is what a fixed shooter is actually about. Tapping to shoot
 * would make it a second Quick Draw.
 */

import { seeded } from './seeded.js';

/**
 * A pub-shaped field: wider than it is deep, because a formation needs room to
 * sweep sideways and the tension comes from how far down it has got.
 */
export const COLS = 9;
export const ROWS = 14;

/** Where the bar is. Anything reaching this row has got to it. */
export const BAR_ROW = ROWS - 1;

/** How many rows of drinkers, and how wide the block starts. */
export const WAVE_ROWS = 3;
export const WAVE_COLS = 7;

export const LIVES = 3;

/**
 * ONE TICK IS ONE STEP OF THE FORMATION, and the clock is the difficulty.
 *
 * It starts slow enough to read and tightens as the room empties — which is
 * the classic behaviour and, better, an EMERGENT one: fewer drinkers left
 * means the same tick budget spread over fewer of them.
 */
export const TICK_MS = 46;

/** How many ticks between formation steps, at the start and at the floor. */
const START_EVERY = 13;
const MIN_EVERY = 3;

/** The glass moves a column every this many ticks — always faster than them. */
const MOVE_EVERY = 2;

/** A shot climbs a row this often. */
const SHOT_EVERY = 1;

/** How often somebody throws one back, in ticks, and the floor. */
const START_THROW = 90;
const MIN_THROW = 28;

const HIT = 20;
/** Clearing the lot is worth more than the sum of it — that is the point. */
const WAVE_BONUS = 250;

/** A fresh game. Nothing moves until the first tap; see `aim()`. */
export function newGame(seed) {
  const g = {
    roll: seeded(seed),
    col: Math.floor(COLS / 2),
    want: null,
    lives: LIVES,
    score: 0,
    wave: 1,
    cleared: 0,
    tick: 0,
    shots: [],
    thrown: [],
    dir: 1,
    stepEvery: START_EVERY,
    throwEvery: START_THROW,
    lastStep: 0,
    lastThrow: 0,
    lastShot: 0,
    waiting: true,
    over: false,
  };
  fillWave(g);
  return g;
}

/**
 * THE FORMATION, as a list of live drinkers.
 *
 * A list rather than a grid because they are removed one at a time and the
 * edges have to be recomputed from whoever is LEFT — which is what makes the
 * formation widen its sweep as it thins out, for free.
 */
function fillWave(g) {
  g.drinkers = [];
  const left = Math.floor((COLS - WAVE_COLS) / 2);
  for (let r = 0; r < WAVE_ROWS; r += 1) {
    for (let c = 0; c < WAVE_COLS; c += 1) {
      // The back row is worth more, so shooting the front off first is a
      // choice rather than the only option.
      g.drinkers.push({ col: left + c, row: r, kind: r === 0 ? 'top' : 'ord' });
    }
  }
}

/** Where the formation currently reaches. Recomputed, never stored. */
export function edges(g) {
  let minC = COLS;
  let maxC = -1;
  let maxR = -1;
  for (const d of g.drinkers) {
    if (d.col < minC) minC = d.col;
    if (d.col > maxC) maxC = d.col;
    if (d.row > maxR) maxR = d.row;
  }
  return { minC, maxC, maxR };
}

/**
 * Tap a column. Outside the field is a MISS rather than a clamp — the same
 * rule Tailback's `aim()` follows, because steering somewhere nobody chose is
 * worse than not moving.
 */
export function aim(g, col) {
  if (g.over) return;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return;
  g.want = col;
  // Nothing moves until the first tap, so a game does not start without the
  // player — and a life is never lost before they have looked at it.
  g.waiting = false;
}

/**
 * ONE TICK. Returns what happened, for the canvas's noises and the tests.
 *
 * @returns {string[]} any of `'fire'`, `'hit'`, `'wave'`, `'life'`, `'over'`.
 */
export function tick(g) {
  const events = [];
  if (g.over || g.waiting) return events;
  g.tick += 1;

  // ---- the glass, which always moves faster than the room ----------------
  if (g.want !== null && g.tick - g.lastShot >= 0 && g.tick % MOVE_EVERY === 0) {
    if (g.col < g.want) g.col += 1;
    else if (g.col > g.want) g.col -= 1;
  }

  // ---- it fires on its own, one in the air at a time ---------------------
  if (g.shots.length === 0 && g.tick - g.lastShot >= 6) {
    g.shots.push({ col: g.col, row: BAR_ROW - 1 });
    g.lastShot = g.tick;
    events.push('fire');
  }

  // ---- shots climb --------------------------------------------------------
  if (g.tick % SHOT_EVERY === 0) {
    for (const s of g.shots) s.row -= 1;
    g.shots = g.shots.filter((s) => s.row >= 0);
    for (const s of g.shots) {
      const i = g.drinkers.findIndex((d) => d.col === s.col && d.row === s.row);
      if (i === -1) continue;
      const gone = g.drinkers.splice(i, 1)[0];
      s.row = -1;
      g.cleared += 1;
      g.score += HIT + (gone.kind === 'top' ? HIT : 0) + g.wave * 2;
      events.push('hit');
      // Fewer of them, so the ones left move sooner. The ramp is the game.
      g.stepEvery = Math.max(MIN_EVERY, g.stepEvery - 0.35);
    }
    g.shots = g.shots.filter((s) => s.row >= 0);
  }

  // ---- the formation steps -----------------------------------------------
  if (g.tick - g.lastStep >= g.stepEvery) {
    g.lastStep = g.tick;
    const { minC, maxC } = edges(g);
    if (g.drinkers.length) {
      const wall = (g.dir > 0 && maxC >= COLS - 1) || (g.dir < 0 && minC <= 0);
      if (wall) {
        g.dir *= -1;
        for (const d of g.drinkers) d.row += 1;
      } else {
        for (const d of g.drinkers) d.col += g.dir;
      }
    }
  }

  // ---- somebody throws one back ------------------------------------------
  if (g.drinkers.length && g.tick - g.lastThrow >= g.throwEvery) {
    g.lastThrow = g.tick;
    // Only from the FRONT of each column, so a thrown glass always comes from
    // somebody you can actually see and shoot.
    const fronts = new Map();
    for (const d of g.drinkers) {
      const at = fronts.get(d.col);
      if (!at || d.row > at.row) fronts.set(d.col, d);
    }
    const list = [...fronts.values()];
    const from = list[Math.floor(g.roll() * list.length)];
    if (from) g.thrown.push({ col: from.col, row: from.row + 1 });
  }
  if (g.tick % 2 === 0) {
    for (const t of g.thrown) t.row += 1;
    for (const t of g.thrown) {
      if (t.row === BAR_ROW && t.col === g.col) {
        t.row = ROWS + 1;
        if (lose(g, events)) return events;
      }
    }
    g.thrown = g.thrown.filter((t) => t.row <= BAR_ROW);
  }

  // ---- have they reached the bar? ----------------------------------------
  const { maxR } = edges(g);
  if (g.drinkers.length && maxR >= BAR_ROW - 1) {
    // Reaching the bar is not one life, it is the end — that is what makes
    // the descent frightening rather than an inconvenience.
    g.lives = 0;
    g.over = true;
    events.push('life', 'over');
    return events;
  }

  // ---- a wave cleared -----------------------------------------------------
  if (!g.drinkers.length) {
    g.score += WAVE_BONUS;
    g.wave += 1;
    g.thrown = [];
    g.shots = [];
    fillWave(g);
    // Each wave starts quicker than the last and throws more often.
    g.stepEvery = Math.max(MIN_EVERY, START_EVERY - g.wave * 1.6);
    g.throwEvery = Math.max(MIN_THROW, START_THROW - g.wave * 9);
    events.push('wave');
  }

  return events;
}

function lose(g, events) {
  g.lives -= 1;
  events.push('life');
  if (g.lives <= 0) { g.over = true; events.push('over'); return true; }
  // Back to the middle, and the glasses in the air are cleared — being hit
  // again while you are still recovering is not a mistake anybody made.
  g.col = Math.floor(COLS / 2);
  g.want = null;
  g.thrown = [];
  g.shots = [];
  return false;
}

/**
 * PLAY A WHOLE GAME WITHOUT A BROWSER — for the tests, and only for them.
 *
 * `controller(game)` returns a column to tap, or null to leave the last tap
 * standing. Enough to write "somebody who tracks the nearest drinker" and
 * "somebody who never touches it" in a couple of lines each.
 */
export function playOut(seed, controller, maxTicks = 40_000) {
  const g = newGame(seed);
  const events = [];
  let ticks = 0;
  while (!g.over && ticks < maxTicks) {
    const want = controller(g);
    if (want !== null && want !== undefined) aim(g, want);
    for (const e of tick(g)) events.push(e);
    ticks += 1;
  }
  return { game: g, events, ticks };
}
