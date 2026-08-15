/**
 * RALLY — a bat and a ball, for the five minutes before the bingo starts.
 *
 * The second lobby game, and the one a BINGO night gets. Asked for as *"we can
 * add tennis as well — tennis before the music bingo games and maze mouth
 * before the quiz"*, so that a bingo night has its own character rather than
 * being the quiz with different content.
 *
 * ---
 *
 * **IT IS NOT PONG AND IT IS NOT BREAKOUT, and that is the same legal line
 * Maze Mouth is drawn along.** Both names are Atari's, this app is SOLD, and
 * UK fair dealing does not cover commercial entertainment — the reasoning
 * already written into `portraits.js` about photoreal pictures of living
 * musicians. **So it has a name of its own: RALLY.** That matters more than it
 * sounds: CLAUDE.md already records that Maze Mouth went unnamed for a while
 * and *an empty name is an invitation* — the obvious word to fill the gap with
 * is always the one that cannot be used. Say whatever you like on the mic.
 *
 * **THE RULES ARE HERE AND THE CANVAS IS IN `lobby-rally.js`**, the same split
 * as `maze.js` and `lobby-game.js` and for the same reason: a test can play a
 * whole game to its end without a browser. That is worth more here than it was
 * for the maze, because the thing most likely to be wrong with a bat-and-ball
 * game is that it is unwinnable, unloseable, or never ends — and none of those
 * three shows up in a screenshot.
 *
 * **A FIXED TIMESTEP, NEVER A FRAME DELTA — and this is the whole fairness
 * argument.** Maze Mouth moves on a 150ms grid, so it is the same game on any
 * handset without anybody having to think about it. A ball advanced by
 * `dt` is not: a 120Hz phone and a tired 30Hz one accumulate floating-point
 * error differently, take their bounces on different sides of a wall, and end
 * up playing measurably different games. Seeding the serve would not save it —
 * two people would still be comparing frame rates on a projector. So `tick()`
 * advances exactly one `TICK_MS` and the canvas layer is left to accumulate
 * real time into whole ticks and drop the remainder.
 *
 * **AND A TICK BUDGET, because a pub phone goes to sleep.** Somebody puts
 * their phone down, the tab is backgrounded, `requestAnimationFrame` stops,
 * and two minutes later they pick it up to a single frame worth 120,000ms.
 * Spent honestly that is every life lost before the screen has repainted. The
 * canvas layer caps what one frame may spend (`MAX_CATCH_UP_MS`); the game
 * simply misses the time, which is the truthful outcome — they were not
 * playing it.
 */

import { seeded } from './seeded.js';

/**
 * The court, in court units rather than pixels. Roughly the proportions of a
 * phone held upright, so the drawing is a scale and never a squash — 100 wide
 * keeps every constant below readable as a percentage of the width.
 */
export const COURT = { w: 100, h: 150 };

/**
 * Yours along the bottom, theirs along the top.
 *
 * Yours is not ON the bottom edge, and the gap is the whole reason the control
 * works: a thumb is about a centimetre across and it has to rest SOMEWHERE.
 * Sixteen units of court below the bat is where it rests, so the hand is off
 * the thing it is aiming. That is the same fault the maze has to live with —
 * *"a finger held on the maze covers the thing you are trying to look at"* —
 * except a bat only needs one axis, so here it can simply be designed out.
 */
export const BAT = { w: 22, h: 3, you: 134, them: 10 };
export const BALL = { r: 2.5 };

export const TICK_MS = 16;
export const LIVES = 3;

/** Units per tick. Slow enough to reach, fast enough not to be a chore. */
const START_SPEED = 1.15;
const MAX_SPEED = 2.6;
/** Every bat hit makes it a little quicker, which is what ends a game. */
const SPEEDUP = 1.035;

/** How far the other bat may move in one tick. Slower than the ball, or it
 *  never misses and a game cannot be won. */
const THEM_SPEED = 0.62;

const HIT = 10;      // touching the ball back
const POINT = 100;   // getting it past them

/** Ticks the ball hangs in the middle of the court before each serve. */
const SERVE_PAUSE = 45;

/**
 * WHERE A SERVE GOES — seeded, so the whole room gets the same one.
 *
 * The host's catch about the maze applies exactly: a ball that serves
 * differently for two people is a leaderboard comparing luck rather than
 * skill. Every serve of the night comes off `state.gameSeed`.
 *
 * It always serves TOWARDS the player. Serving away gives a free point to
 * whoever happened to be looking, which is not a score anybody earned — and on
 * a board beside a join code, an unearned hundred is the one thing that would
 * make the whole thing feel arbitrary.
 */
export function serve(roll) {
  // Never dead straight and never nearly flat: straight down is a ball you
  // return without moving, and a flat one crosses the court eight times before
  // it arrives, which is not a rally, it is a wait.
  const lean = 0.35 + roll() * 0.45;        // how much of the speed goes sideways
  const dir = roll() < 0.5 ? -1 : 1;
  return {
    x: COURT.w / 2,
    y: COURT.h / 2,
    vx: START_SPEED * lean * dir,
    vy: START_SPEED * (1 - lean * 0.5),      // downwards: towards you
    speed: START_SPEED,
  };
}

/**
 * A whole game, ready to be ticked. No canvas, no clock, no DOM.
 *
 * `batX` is the middle of your bat and is the only thing the outside world
 * ever sets — see the note in `lobby-rally.js` about why the control is one
 * axis and nothing else.
 */
export function newGame(seed) {
  const roll = seeded(seed);
  const g = {
    roll,
    ball: serve(roll),
    batX: COURT.w / 2,
    themX: COURT.w / 2,
    /*
     * A BEAT BEFORE EACH SERVE, and it is not decoration.
     *
     * Without it the ball leaves the middle of the court the instant a life is
     * lost, and somebody whose bat is at the wrong end has already lost the
     * next one — three lives gone in four and a half seconds, measured, which
     * is a game that ends before anybody has understood what they are looking
     * at. Long enough to get the bat across, short enough not to be a wait.
     */
    wait: SERVE_PAUSE,
    /*
     * HOW BADLY THEY AIM, redrawn every rally.
     *
     * A bat that tracks the ball exactly never misses, so the game can only
     * ever be lost — and the score would then be "how long before you slipped",
     * which is a stopwatch rather than a game. A seeded error per rally is the
     * same trick as the chasers' one-turn-in-four: it makes the opponent feel
     * like somebody rather than a machine, and every phone gets the identical
     * somebody.
     */
    themOff: 0,
    lives: LIVES,
    score: 0,
    rallies: 0,
    over: false,
    won: false,
  };
  // Drawn here as well as in `restart()`, or the very first rally of every
  // game in the room is the one the other bat never misses.
  aimThem(g);
  return g;
}

/** Clamp, because a bat is not allowed off the end of the court. */
const hold = (x) => Math.max(BAT.w / 2, Math.min(COURT.w - BAT.w / 2, x));

/**
 * ONE TICK. Everything that moves, moves here.
 *
 * @returns {string|null} what just happened — `'hit'`, `'wall'`, `'point'`,
 *   `'life'`, `'over'` — or null. The canvas layer uses it for a flash and a
 *   noise; the tests use it to prove a game can be both won and lost.
 */
export function tick(g) {
  if (g.over) return null;
  const b = g.ball;

  // Waiting to serve. Their bat still drifts back to the middle and yours
  // still moves, so the pause is a moment to get set rather than a freeze.
  if (g.wait > 0) {
    g.wait -= 1;
    const home = (COURT.w / 2 - g.themX);
    g.themX += Math.abs(home) < THEM_SPEED ? home : Math.sign(home) * THEM_SPEED;
    return g.wait === 0 ? 'serve' : null;
  }

  /* ------------------------------------------------------------- their bat */
  // They aim at where the ball IS, not where it is going — a bat that leads
  // the ball is unbeatable, and the wrongness is most of the character.
  const want = hold(b.x + g.themOff);
  const gap = want - g.themX;
  g.themX += Math.abs(gap) < THEM_SPEED ? gap : Math.sign(gap) * THEM_SPEED;

  /* ---------------------------------------------------------------- the ball */
  b.x += b.vx;
  b.y += b.vy;

  let event = null;

  // The side walls. Reflected AND pushed back inside, or a ball that arrives
  // fast enough to overshoot the wall in one tick sticks to it, flipping its
  // direction every tick for the rest of the game.
  if (b.x < BALL.r) { b.x = BALL.r; b.vx = Math.abs(b.vx); event = 'wall'; }
  if (b.x > COURT.w - BALL.r) { b.x = COURT.w - BALL.r; b.vx = -Math.abs(b.vx); event = 'wall'; }

  const faster = () => {
    b.speed = Math.min(MAX_SPEED, b.speed * SPEEDUP);
    const now = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / now) * b.speed;
    b.vy = (b.vy / now) * b.speed;
  };

  /*
   * THE BATS.
   *
   * Tested against the bat's PLANE rather than its box, and only while the
   * ball is travelling towards it. Both halves are load-bearing: a box test
   * misses a fast ball that stepped straight over the bat in one tick, and
   * without the direction check a ball that has just been hit is "inside" the
   * bat for another tick or two and bounces back and forth on the spot.
   */
  if (b.vy > 0 && b.y + BALL.r >= BAT.you && b.y + BALL.r - b.vy < BAT.you) {
    if (Math.abs(b.x - g.batX) <= BAT.w / 2 + BALL.r) {
      b.y = BAT.you - BALL.r;
      b.vy = -Math.abs(b.vy);
      /*
       * WHERE ON THE BAT YOU HIT IT IS THE WHOLE SKILL OF THE GAME.
       *
       * Off the middle it comes straight back and the other bat is already
       * there; off the edge it goes across the court and has to be chased.
       * Without this there is nothing to be good at and the score is a measure
       * of patience.
       */
      const off = (b.x - g.batX) / (BAT.w / 2);
      b.vx += off * 0.55;
      faster();
      g.score += HIT;
      g.rallies += 1;
      event = 'hit';
    }
  }

  if (b.vy < 0 && b.y - BALL.r <= BAT.them && b.y - BALL.r - b.vy > BAT.them) {
    if (Math.abs(b.x - g.themX) <= BAT.w / 2 + BALL.r) {
      b.y = BAT.them + BALL.r;
      b.vy = Math.abs(b.vy);
      b.vx += ((b.x - g.themX) / (BAT.w / 2)) * 0.4;
      faster();
      event = 'hit';
    }
  }

  /* --------------------------------------------------------------- the ends */
  if (b.y - BALL.r > COURT.h) {
    g.lives -= 1;
    if (g.lives <= 0) { g.over = true; return 'over'; }
    restart(g);
    return 'life';
  }

  if (b.y + BALL.r < 0) {
    g.score += POINT;
    restart(g);
    return 'point';
  }

  return event;
}

/**
 * A fresh serve after a point either way — and a fresh aiming error with it,
 * so the next rally is a different opponent from the last one rather than the
 * same miss repeating until the game ends.
 */
function restart(g) {
  g.ball = serve(g.roll);
  g.wait = SERVE_PAUSE;
  aimThem(g);
}

/**
 * How badly they aim at THIS rally — up to most of a bat out, either way.
 * Beyond that they visibly are not trying, which reads as broken rather than
 * as beatable.
 */
function aimThem(g) {
  g.themOff = (g.roll() * 2 - 1) * BAT.w * 0.8;
}

/** Your bat, clamped. The only thing a player ever changes. */
export function moveBat(g, x) {
  g.batX = hold(x);
}

/**
 * PLAY A WHOLE GAME WITHOUT A BROWSER — for the tests, and only for them.
 *
 * `controller(game)` is handed the game each tick and returns where the bat
 * should be. That is enough to write "a perfect player" and "somebody who
 * never touches it" as four lines each, which is what turns *is it winnable,
 * is it loseable, does it end* from three things nobody checks into three
 * assertions.
 *
 * `maxTicks` is a backstop rather than a rule: a game that has not finished in
 * ten minutes of ticks has a ball stuck to a wall, and a test that hangs is a
 * test nobody runs.
 */
export function playOut(seed, controller, maxTicks = 40_000) {
  const g = newGame(seed);
  const events = [];
  let ticks = 0;
  while (!g.over && ticks < maxTicks) {
    moveBat(g, controller(g));
    const e = tick(g);
    if (e && e !== 'wall') events.push(e);
    ticks += 1;
  }
  return { game: g, events, ticks, finished: g.over };
}
