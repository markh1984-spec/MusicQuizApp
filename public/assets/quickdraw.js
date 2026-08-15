/**
 * QUICK DRAW — the fourth lobby game. Outlaws pop up over a wall; shoot them
 * before they shoot you, and do not shoot the sheriff.
 *
 * ---
 *
 * **THE NAME IS FREE, WHICH IS A FIRST HERE.** Maze Mouth, Rally and Tailback
 * all had to be named around somebody's trademark. A shooting gallery is a
 * fairground stall a century older than video games and "quick draw" is an
 * ordinary English phrase, so for once the honest name is also the safe one.
 *
 * **THE CONTROL IS THE ONE ALREADY PROVEN: you tap the thing you want.** That
 * is the maze's tap-a-destination with the destination made obvious — no
 * reticle to drag, no aim to hold, nothing that can be misread. It is the best
 * fit of the four, and it is why this idea was worth taking.
 *
 * **AND IT IS NOT A THUMB-SPEED TEST, because of the sheriff.** An outlaw pops
 * up and you shoot it; the sheriff and the barmaid pop up too and shooting one
 * costs a life. That single addition turns "how fast can you tap" into "did
 * you look before you fired", which is a far better thing to put a leaderboard
 * under — and it is what makes mashing every slot lose rather than win. **The
 * anti-cheat here is the game rather than a rule**: nobody had to write "you
 * may not tap wildly", because tapping wildly shoots the sheriff.
 *
 * ---
 *
 * **A SCHEDULE, NOT AN ACCUMULATOR — the third answer this codebase has given
 * to the same fairness problem, and the cleanest.**
 *
 * Every phone in the room has to play the identical game or the board compares
 * luck. Maze Mouth and Tailback get that from a grid and a fixed step; Rally
 * needed a whole accumulator because a ball is continuous. This needs neither:
 * the pop-ups are generated as a SCHEDULE off the seed — who, where, up at
 * this millisecond, down at that one — and **the state of the game at time T
 * is a pure function of the schedule and T**.
 *
 * So it does not matter whether a phone samples the clock every 8ms or every
 * 40, or misses a second entirely while the browser is busy: it lands in the
 * same place. There is nothing to drift, because nothing accumulates. There is
 * a test that plays one game at three different frame rates and asserts the
 * results are identical.
 *
 * **A REACTION GAME MAKES INPUT LATENCY PART OF THE SCORE, and that cannot be
 * engineered away** — a tired handset with a slow touch digitiser really is at
 * a disadvantage, in a way it is not on a grid. What can be done is make the
 * windows generous enough that the difference is noise: about a second to
 * react at the start, and never below `MIN_UP_MS`. Eighty milliseconds of
 * handset should not decide a pub leaderboard.
 */

import { seeded } from './seeded.js';

/**
 * Six holes in the wall, two across and three down — the shape of a phone held
 * upright, and big targets. Fewer would be dull; more makes each one small
 * enough that a fat thumb is the game.
 */
export const COLS = 2;
export const ROWS = 3;
export const SLOTS = COLS * ROWS;

export const LIVES = 3;

/** Who is behind the wall. */
export const OUTLAW = 'outlaw';
export const FRIEND = 'friend';

/*
 * HOW LONG SOMEBODY STAYS UP, and it is the difficulty.
 *
 * A second at the start, tightening towards `MIN_UP_MS` as the game goes on,
 * which is what gives it an ending. It never goes below that floor: past about
 * half a second the game stops being reaction and starts being whose phone
 * reports a touch soonest, which is not a thing anybody earned.
 */
const START_UP_MS = 1100;
const MIN_UP_MS = 620;
const UP_TIGHTEN = 0.975;

/** The gap between one appearing and the next. */
const START_GAP_MS = 950;
const MIN_GAP_MS = 380;
const GAP_TIGHTEN = 0.972;

/** A beat before the first one, so the game does not open mid-shot. */
const FIRST_GAP_MS = 900;

/** Roughly one in four is somebody you must not shoot. */
const FRIEND_CHANCE = 0.27;

const HIT = 25;
/** The rest of the points are for being quick, out of the window you had. */
const SPEED = 75;

/**
 * A whole game, ready to be run to any point in time. No canvas, no clock.
 *
 * `at` is game time in milliseconds since it started — the caller owns the
 * clock, and this file only ever asks what time it is now.
 */
export function newGame(seed) {
  return {
    roll: seeded(seed),
    at: 0,
    /** Everyone currently up or already dealt with, newest last. */
    pops: [],
    nextId: 1,
    nextAt: FIRST_GAP_MS,
    upMs: START_UP_MS,
    gapMs: START_GAP_MS,
    lives: LIVES,
    score: 0,
    shot: 0,
    over: false,
    won: false,
  };
}

/** Everyone visible right now. The canvas draws exactly this. */
export function showing(g) {
  return g.pops.filter((p) => !p.done && p.upAt <= g.at && g.at < p.downAt);
}

/**
 * RUN THE GAME FORWARD TO `t`.
 *
 * Spawns everybody due, and resolves everybody whose moment has passed. Safe
 * to call with any `t` at or after the current one, however far — which is the
 * whole point: a phone that was busy for a second lands in the same state as
 * one that was not.
 *
 * @returns {string[]} what happened on the way — `'up'`, `'drew'`, `'gone'`,
 *   `'life'`, `'over'`. The canvas uses them for a flash; the tests use them
 *   to prove an outlaw left alone really does shoot back.
 */
export function runTo(g, t) {
  const events = [];
  if (g.over) return events;

  /*
   * ONE POP AT A TIME, IN ORDER, rather than jumping straight to `t`.
   *
   * A phone that lost a second to the browser must not be allowed to skip the
   * three outlaws that appeared during it — they drew on somebody who was
   * looking at a frozen screen, but they DID draw, and pretending otherwise
   * would mean a stuttering handset quietly played an easier game.
   */
  while (!g.over) {
    const nextSpawn = g.nextAt;
    const nextResolve = g.pops.reduce(
      (soonest, p) => (!p.done && p.downAt < soonest ? p.downAt : soonest), Infinity,
    );
    const when = Math.min(nextSpawn, nextResolve);
    if (when > t) break;
    g.at = when;

    if (nextResolve === when) {
      for (const p of g.pops) {
        if (p.done || p.downAt > when) continue;
        p.done = true;
        if (p.kind === OUTLAW) {
          /*
           * HE DREW FIRST. The reason to hurry, and the reason this is a game
           * rather than a patience test: leaving an outlaw alone is not
           * neutral, it costs you.
           */
          events.push('drew');
          if (loseLife(g, events)) return events;
        } else {
          // The sheriff ducks back down. Nothing happens, which is the point.
          events.push('gone');
        }
      }
    }

    if (nextSpawn === when) {
      spawn(g);
      events.push('up');
    }
  }

  if (!g.over) g.at = Math.max(g.at, t);
  return events;
}

function spawn(g) {
  /*
   * NEVER INTO A SLOT THAT IS ALREADY BUSY. Two figures in one hole is a tap
   * that could mean either, which on a game where one of them costs a life is
   * the app taking the life rather than the player losing it.
   */
  const busy = new Set(showing(g).map((p) => p.slot));
  const free = [];
  for (let i = 0; i < SLOTS; i++) if (!busy.has(i)) free.push(i);
  if (free.length) {
    const slot = free[Math.floor(g.roll() * free.length)];
    const kind = g.roll() < FRIEND_CHANCE ? FRIEND : OUTLAW;
    g.pops.push({
      id: g.nextId++, slot, kind, upAt: g.at, downAt: g.at + g.upMs, done: false, hit: false,
    });
  }
  g.nextAt = g.at + g.gapMs;
  g.upMs = Math.max(MIN_UP_MS, g.upMs * UP_TIGHTEN);
  g.gapMs = Math.max(MIN_GAP_MS, g.gapMs * GAP_TIGHTEN);
}

function loseLife(g, events) {
  g.lives -= 1;
  events.push('life');
  if (g.lives <= 0) { g.over = true; events.push('over'); return true; }
  return false;
}

/**
 * A SHOT AT A SLOT.
 *
 * Call `runTo(g, t)` first so the game is at the moment of the tap — a shot
 * resolved against a stale picture is a shot at somebody who had already
 * ducked, which the player would rightly call a bug.
 *
 * @returns {string} `'hit'`, `'sheriff'`, `'air'` or `'ignored'`
 */
export function shoot(g, slot) {
  if (g.over) return 'ignored';
  const target = showing(g).find((p) => p.slot === slot);
  /*
   * A SHOT AT AN EMPTY HOLE COSTS NOTHING, and it does not need to.
   *
   * Punishing it was considered and is unnecessary: the thing it would be
   * guarding against is somebody tapping all six slots as fast as they can,
   * and that already loses badly, because a quarter of everyone who pops up is
   * the sheriff. **The game is its own anti-cheat**, which is worth more than
   * a penalty nobody can see the reason for.
   */
  if (!target) return 'air';
  target.done = true;
  if (target.kind === FRIEND) {
    target.hit = true;
    loseLife(g, []);
    return 'sheriff';
  }
  target.hit = true;
  g.shot += 1;
  /*
   * QUICKER IS WORTH MORE, out of the window you actually had — never out of a
   * fixed number of milliseconds. The window tightens as the game goes on, so
   * a flat scale would quietly make the late, harder shots worth less than the
   * early easy ones, which is the reveal-curve fault this app already records
   * against the picture round.
   */
  const took = g.at - target.upAt;
  const share = Math.max(0, 1 - took / (target.downAt - target.upAt));
  g.score += HIT + Math.round(SPEED * share);
  return 'hit';
}

/**
 * PLAY A WHOLE GAME WITHOUT A BROWSER — for the tests, and only for them.
 *
 * `frameMs` is how often the caller looks at the clock, and it is a parameter
 * precisely so a test can prove it does not matter: the same player at 8ms,
 * 16ms and 40ms must finish with the same score.
 *
 * `controller(game, showing)` returns a slot to shoot, or null.
 */
export function playOut(seed, controller, { frameMs = 16, maxMs = 600_000 } = {}) {
  const g = newGame(seed);
  const events = [];
  for (let t = 0; t <= maxMs && !g.over; t += frameMs) {
    events.push(...runTo(g, t));
    if (g.over) break;
    const slot = controller(g, showing(g));
    if (slot !== null && slot !== undefined) events.push(shoot(g, slot));
  }
  return { game: g, events, finished: g.over };
}
