/**
 * PUB PRIX — the race, as one pure function of the taps.
 *
 * Asked for on 9 October 2026: *"something like Mario Kart… each player is
 * racing around a track but the track is on the main screen."* Chosen off
 * three options: karts that DRIVE THEMSELVES, and a phone that only ever says
 * which LANE to be in — dodge the spilt pints, hit the boosts.
 *
 * **THE NAME IS PUB PRIX, NEVER A PLAY ON MARIO KART.** The host's first name
 * for it was one, and this app is SOLD: Nintendo's marks are the one line the
 * lobby games already refuse to go near (Maze Mouth, Rally, Tailback). Kart
 * racing as a genre is free; a plumber, item boxes, shells and bananas are
 * not, and none of them is here.
 *
 * **WHY NOBODY STEERS.** Pub wifi puts a quarter to half a second between a
 * thumb and the projector. A kart steered through that crashes into the wall
 * the player already turned away from, sixty times, in front of everybody. A
 * LANE is a decision made a second or two ahead of the thing it avoids, so the
 * same delay costs nothing — the hazards are on the phone three seconds before
 * they arrive.
 *
 * **ONE FILE, IMPORTED BY THE SERVER, THE PROJECTOR AND THE PHONE** — the
 * `break-parts.js` arrangement. The server decides who won (rule 2: the server
 * owns the clock), the projector draws everybody, and each phone draws its own
 * kart; all three run THIS code over the same taps, so they cannot disagree
 * about where anybody is. Two copies of a physics step is two races.
 *
 * **KARTS NEVER TOUCH EACH OTHER**, deliberately: each kart is a function of
 * the track (from the seed) and its OWN taps, and nothing else. That is what
 * lets the projector redraw one kart when one late tap arrives, and what makes
 * a restart rebuild the race exactly from the taps on disk.
 *
 * **A FIXED STEP, NEVER A FRAME DELTA** — the lobby games' own rule. A 120Hz
 * projector and a 30Hz phone must step the same kart through the same fifty
 * milliseconds, or they draw two different races.
 */
import { seeded } from './seeded.js';

/** Three lanes: wide enough to dodge, narrow enough to read on a phone. */
export const LANES = 3;
export const LAPS = 3;
/** One lap, in track units. Everything below is measured in these. */
export const LAP = 1000;
export const RACE = LAPS * LAP;
export const STEP_MS = 50;
/** Cruising speed, units a second: three clean laps take just under a minute. */
export const SPEED = 52;
/** A boost: sixty per cent faster for a little over a second. */
export const BOOST = 1.6;
export const BOOST_MS = 1300;
/** A spilt pint: a third of the speed for a little over a second. */
export const SLOW = 0.35;
export const SPILL_MS = 1200;
/** "3, 2, 1, GO" on the projector — and long enough for every phone to arrive. */
export const COUNTDOWN_MS = 5000;
/**
 * Nothing on the track this close to the line, either side of it, so the
 * start is a clean get-away and the finish is a straight run in.
 */
export const GRACE = 90;
/** After the first kart home, the rest have this long to finish. */
export const AFTER_WINNER_MS = 10000;
/**
 * The longest a race may run after GO. A room where every kart spends the
 * race in a puddle still ends, and the leader then wins.
 */
export const MAX_RACE_MS = 150000;
/** The fewest milliseconds between two lane changes the server takes. */
export const MIN_TAP_MS = 90;
/** The most lane changes one kart may make in a race — a SAFETY number. */
export const MAX_TAPS = 600;

/**
 * Twelve kart colours, kept clear of the three that MEAN something here: gold
 * (the winner), green (a boost) and the amber of a spilt pint. A number on
 * every kart carries it past twelve.
 */
export const KART_COLOURS = [
  '#4bd8ff', '#ff5fd2', '#ff8a3d', '#a98bff', '#f4f4f4', '#7fb2ff',
  '#ff7a7a', '#2fd6c6', '#ffb3d1', '#d7a6ff', '#ffb38a', '#bdf3ff',
];
export const kartColour = (index) => KART_COLOURS[Math.abs(Number(index) || 0) % KART_COLOURS.length];

/**
 * The track: rows of spilt pints and boosts, the same on every lap so a room
 * can learn it — and the same for everybody, from one seed in the state.
 *
 * **NEVER ALL THREE LANES** — at most two spills share a row, so there is
 * always a way through. A row with a boost may hide a spill beside it.
 */
export function trackLayout(seed) {
  const rand = seeded(seed);
  const items = [];
  let p = GRACE + 40;
  while (p < LAP - GRACE) {
    const lanes = [0, 1, 2];
    for (let i = lanes.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const roll = rand();
    if (roll < 0.3) {
      items.push({ p, lane: lanes[0], kind: 'spill' }, { p, lane: lanes[1], kind: 'spill' });
    } else if (roll < 0.72) {
      items.push({ p, lane: lanes[0], kind: 'spill' });
    } else {
      items.push({ p, lane: lanes[0], kind: 'boost' });
      if (rand() < 0.5) items.push({ p, lane: lanes[1], kind: 'spill' });
    }
    p += 70 + Math.floor(rand() * 45);
  }
  return items.sort((a, b) => a.p - b.p || a.lane - b.lane);
}

/**
 * The whole course, every lap laid end to end, so a kart only ever walks
 * forward through one list. Built once per race and handed to every kart.
 */
export function courseFor(seed) {
  const layout = trackLayout(seed);
  const course = [];
  for (let lap = 0; lap < LAPS; lap += 1) {
    for (const it of layout) course.push({ at: it.p + lap * LAP, lane: it.lane, kind: it.kind });
  }
  return course;
}

/** A kart on the grid, before a single step. */
export function newKart(lane = 0) {
  return {
    d: 0,
    at: null,
    lane: clampLane(lane),
    slowUntil: 0,
    boostUntil: 0,
    finishedAt: null,
    startedAt: null,
    hits: 0,
    boosts: 0,
    ci: 0,
    ii: 0,
  };
}

export function clampLane(lane) {
  const n = Math.round(Number(lane));
  return Number.isFinite(n) ? Math.max(0, Math.min(LANES - 1, n)) : 1;
}

/**
 * Walk one kart forward to `untilT`, a fixed step at a time.
 *
 * `taps` is that kart's lane changes, `[time, lane]`, oldest first, in SERVER
 * time. **A KART SITS ON THE GRID UNTIL ITS PHONE TAPS ONCE** — a phone face
 * down on the table is not racing, and a kart nobody is driving must not be
 * able to cross the line first and take a drink. A tap during the countdown
 * starts it at GO.
 *
 * Mutates and returns `kart`, so the projector can carry a kart forward frame
 * by frame instead of re-running the whole race sixty times a second.
 */
export function stepKart(kart, course, taps, startsAt, untilT) {
  if (kart.at === null) kart.at = startsAt;
  const list = Array.isArray(taps) ? taps : [];
  while (kart.finishedAt === null && kart.at + STEP_MS <= untilT) {
    const ts = kart.at;
    while (kart.ci < list.length && list[kart.ci][0] <= ts) {
      kart.lane = clampLane(list[kart.ci][1]);
      kart.ci += 1;
    }
    if (kart.ci > 0) {
      if (kart.startedAt === null) kart.startedAt = ts;
      const mult = ts < kart.slowUntil ? SLOW : ts < kart.boostUntil ? BOOST : 1;
      const next = kart.d + (SPEED * mult * STEP_MS) / 1000;
      while (kart.ii < course.length && course[kart.ii].at <= next) {
        const it = course[kart.ii];
        if (it.at > kart.d && it.lane === kart.lane) {
          if (it.kind === 'spill') {
            kart.slowUntil = ts + SPILL_MS;
            kart.boostUntil = 0;
            kart.hits += 1;
          } else {
            kart.boostUntil = ts + BOOST_MS;
            kart.slowUntil = 0;
            kart.boosts += 1;
          }
        }
        kart.ii += 1;
      }
      if (next >= RACE) {
        // The exact moment it crossed, between two steps — so two karts that
        // finish in the same step are still told apart honestly.
        kart.finishedAt = ts + (STEP_MS * (RACE - kart.d)) / (next - kart.d);
        kart.d = RACE;
      } else {
        kart.d = next;
      }
    }
    kart.at += STEP_MS;
  }
  return kart;
}

/** One kart, from the grid, to `untilT`. */
export function kartAt(course, taps, startLane, startsAt, untilT) {
  return stepKart(newKart(startLane), course, taps, startsAt, untilT);
}

/** Which lap a kart is on, one-based, never past the last. */
export function lapOf(d) {
  return Math.min(LAPS, Math.floor(Math.max(0, d) / LAP) + 1);
}

/**
 * The running order: home first by the moment they crossed, then everybody
 * else by distance, then the karts still on the grid. `tie` is a number drawn
 * ONCE at the start and kept in the state, so a dead heat is broken the same
 * way on every screen and after a restart.
 */
export function standings(rows) {
  return [...rows].sort((a, b) => {
    const af = a.kart.finishedAt; const bf = b.kart.finishedAt;
    if (af !== null && bf !== null) return af - bf || a.tie - b.tie;
    if (af !== null) return -1;
    if (bf !== null) return 1;
    return b.kart.d - a.kart.d || a.tie - b.tie;
  });
}
