/**
 * PUB PRIX — the race, as one pure function of the steering.
 *
 * Asked for on 9 October 2026: *"something like Mario Kart… each player is
 * racing around a track but the track is on the main screen."* It began with
 * karts that drove themselves and a phone that only said which LANE to be in;
 * the same evening the host reversed that: *"can we make it instead of lanes
 * its actual steering with the phones? its meant to be hard."* So the phone
 * STEERS — hold the left or right of the screen — and the track fights back:
 * every bend pushes you wide, the grass costs you speed, and a spilt pint is
 * something you steer round rather than a lane you leave.
 *
 * **THE NAME IS PUB PRIX, NEVER A PLAY ON MARIO KART.** The host's first name
 * for it was one, and this app is SOLD: Nintendo's marks are the one line the
 * lobby games already refuse to go near (Maze Mouth, Rally, Tailback). Kart
 * racing as a genre is free; a plumber, item boxes, shells and bananas are
 * not, and none of them is here.
 *
 * **THE LAG IS PART OF THE GAME, AND IT IS THE SAME LAG FOR THE WINNER.** Pub
 * wifi puts a quarter of a second between a thumb and the server — the reason
 * the first version did not steer at all. Steering through it is HARD, which
 * is what was asked for. Two things keep it honest: the server stamps every
 * input (rule 2), and the phone draws its kart half a round trip AHEAD
 * (`race-phone.js`), so what the thumb sees is what the server will decide.
 * Nothing on the track hits harder than the grass — a late correction costs
 * speed, never the race in one blow.
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

/**
 * THE ROAD, ACROSS: three lane-widths of tarmac, `x` from -1.5 (the INSIDE,
 * left on the phone — the karts turn left) to +1.5, then grass to the wall at
 * ±1.9. The pints and boosts sit on the three lines `x = -1, 0, 1`.
 */
export const LANES = 3;
export const HALF = 1.5;
export const WALL = 1.9;
/** How fast a held side moves you across, lane-widths a second. */
export const STEER = 2.4;
/**
 * How hard a bend pushes you WIDE at cruising speed, lane-widths a second —
 * just over half of STEER, so a bend is held by keeping a thumb on the inside
 * for about half of it. Faster is wider: a boost through a bend is a fight.
 */
export const DRIFT = 1.25;
/** Off the tarmac: under half speed until you steer back on. */
export const GRASS = 0.45;
/** How close, centre to centre, a kart must pass a pint or a boost to hit it. */
export const HIT = 0.5;
/**
 * The two left-hand bends, as stretches of the lap — the same stretches the
 * projector draws as its turns, so a push on the phone is a bend on the wall.
 * The lap starts mid-way along the bottom straight, heading right.
 */
export const BENDS = [[100, 400], [600, 900]];
/** A bend's push ramps in and out over this much track, never a jolt. */
export const BEND_RAMP = 40;
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
/** The fewest milliseconds between two steering changes the server takes. */
export const MIN_TAP_MS = 90;
/**
 * The most steering changes one kart may make in a race — a SAFETY number. A
 * thumb pressing and lifting three times a second for two and a half minutes
 * is 900; this is a script, not a driver.
 */
export const MAX_TAPS = 1500;

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

/** A kart on the grid, before a single step — on its starting line, wheel straight. */
export function newKart(lane = 0) {
  return {
    d: 0,
    at: null,
    x: clampLane(lane) - 1,
    steer: 0,
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

/** Left (-1), straight (0) or right (+1) — anything else is straight. */
export function clampSteer(v) {
  const n = Math.round(Number(v));
  return n === -1 || n === 1 ? n : 0;
}

/** How hard the track is pushing you wide here: 0 on a straight, 1 mid-bend. */
export function bendAt(d) {
  const p = ((d % LAP) + LAP) % LAP;
  for (const [a, b] of BENDS) {
    if (p >= a && p <= b) return Math.min(1, (p - a) / BEND_RAMP, (b - p) / BEND_RAMP);
  }
  return 0;
}

/** Is this kart off the tarmac? */
export const onGrass = (kart) => Math.abs(kart.x) > HALF;

/**
 * Walk one kart forward to `untilT`, a fixed step at a time.
 *
 * `taps` is that kart's steering, `[time, steer]` — -1 left, 0 straight, +1
 * right — oldest first, in SERVER time. **A KART SITS ON THE GRID UNTIL ITS
 * PHONE TOUCHES THE SCREEN ONCE** — a phone face down on the table is not
 * racing, and a kart nobody is driving must not be able to cross the line
 * first and take a drink. A press during the countdown starts it at GO.
 *
 * Mutates and returns `kart`, so the projector can carry a kart forward frame
 * by frame instead of re-running the whole race sixty times a second.
 */
export function stepKart(kart, course, taps, startsAt, untilT) {
  if (kart.at === null) kart.at = startsAt;
  const list = Array.isArray(taps) ? taps : [];
  const dt = STEP_MS / 1000;
  while (kart.finishedAt === null && kart.at + STEP_MS <= untilT) {
    const ts = kart.at;
    while (kart.ci < list.length && list[kart.ci][0] <= ts) {
      kart.steer = clampSteer(list[kart.ci][1]);
      kart.ci += 1;
    }
    if (kart.ci > 0) {
      if (kart.startedAt === null) kart.startedAt = ts;
      const mult = speedOf(kart, ts);
      const next = kart.d + SPEED * mult * dt;
      // Across: the thumb, and the bend pushing you wide — harder the faster.
      kart.x = Math.max(-WALL, Math.min(WALL, kart.x + (kart.steer * STEER + bendAt(kart.d) * DRIFT * mult) * dt));
      while (kart.ii < course.length && course[kart.ii].at <= next) {
        const it = course[kart.ii];
        if (it.at > kart.d && Math.abs(kart.x - (it.lane - 1)) < HIT) {
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

/** How fast a kart is going at `ts`, as a multiple of cruising speed. */
export function speedOf(kart, ts) {
  const base = ts < kart.slowUntil ? SLOW : ts < kart.boostUntil ? BOOST : 1;
  return onGrass(kart) ? base * GRASS : base;
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

/**
 * PUB PRIX AS A GAME OF ITS OWN — the "pack" a night's running order names
 * when Pub Prix is one of its parts (`LAUNCHERS.race` in `session.js`).
 *
 * **THERE IS NO FILE, LIKE THE DECK.** A race is a track drawn from a seed, so
 * there is nothing to write, nothing to own and nothing to correct — and
 * generating it keeps it off every pack validator on the launch path. Shared
 * by the server and the console so the card on the shelf and the part the
 * room plays are one object.
 */
export function pubPrixPack() {
  return {
    id: 'pub-prix',
    kind: 'race',
    title: 'Pub Prix',
    subtitle: 'A kart race on the big screen. Phones steer by tapping a lane; the winner gets a drink.',
  };
}

/*
 * ============================================================ TILT TO STEER
 *
 * *"if they tip the phone right they steer right on the game? LOL that's
 * amazing"* — so it does (9 October 2026), and holding the screen stays as
 * the backup for a phone that says no.
 *
 * **HOW FAR THE PHONE IS TIPPED IS GRAVITY ACROSS THE SCREEN**, worked out
 * from the orientation angles: the left-right component of "down", from -1
 * (tipped hard left) to +1. Computed from the whole rotation rather than read
 * off one angle, because `gamma` alone means a different thing on a phone
 * held upright (like a wheel) and one held flat (like a tray) — gravity across
 * the screen is the same answer in both. And it follows the SCREEN, so a
 * phone turned on its side still steers the way it looks.
 */
export function tiltAmount(beta, gamma, angle = 0) {
  const b = (Number(beta) || 0) * Math.PI / 180;
  const g = (Number(gamma) || 0) * Math.PI / 180;
  const gx = Math.cos(b) * Math.sin(g);   // gravity along the device's x
  const gy = -Math.sin(b);                // …and its y
  const a = ((Math.round(Number(angle) / 90) * 90) % 360 + 360) % 360;
  if (a === 90) return -gy;
  if (a === 180) return -gx;
  if (a === 270) return gy;
  return gx;
}

/** Tipped past here, the wheel turns; back inside the smaller one, it centres. */
export const TILT_ON = 0.26;   // about 15 degrees
export const TILT_OFF = 0.14;  // about 8 — the gap stops a wobbling hand flickering

/** The wheel a tilt asks for, given what it is now: -1, 0 or +1. */
export function tiltToSteer(amount, now = 0) {
  const x = Number(amount) || 0;
  if (now !== 0 && Math.sign(x) === now && Math.abs(x) > TILT_OFF) return now;
  if (x > TILT_ON) return 1;
  if (x < -TILT_ON) return -1;
  return 0;
}
