/**
 * WALKIES — a dog running through the park, for one staff login (the host,
 * 3 October 2026: *"can Tabby have a game that is dog themed?"*).
 *
 * One tap jumps, a second tap in the air hops again once; bins, benches,
 * puddles and the odd cat each cost one of three lives, a hanging basket is
 * walked UNDER and a beer garden's tables are run ACROSS, and bones are worth
 * having. The
 * person on the other end of the lead goes where the dog went. **Our own
 * dog, drawn here, nobody famous** — this app is SOLD, the lobby games' legal
 * line, and `test/walkies.test.js` reads this file and its page for the names.
 *
 * This half is the RULES — no page, no canvas — so every one is testable in
 * node, including the one that matters most: **every gap it makes can be
 * jumped.** The test plays a whole walk with a simple timing rule and must
 * still be going a minute and a half later, on several seeds.
 *
 * Units are metres along the path (`x`) and up from the ground (`h`). The dog
 * runs at a fixed spot on the screen; the world comes to meet it.
 */
import { rng } from './blockyard.js';
import { NAMES } from './staff-names.js';

export const DOG = { w: 1.2, h: 0.9 };
const GRAVITY = 40;
const JUMP = 16;
const HOP = 12;
const START_SPEED = 7;
const TOP_SPEED = 15;
const SPEEDS_UP = 0.12;
/** How far ahead things are put down — further than any screen shows. */
const AHEAD = 24;

export const THINGS = {
  bin: { w: 0.8, h: 1.1 },
  bench: { w: 1.8, h: 0.9 },
  puddle: { w: 1.6, h: 0.2 },
  cat: { w: 0.9, h: 0.8 },
};
const KINDS = Object.keys(THINGS);

/**
 * THINGS TO WALK UNDER, AND THINGS TO WALK ACROSS (the host, 6 October 2026:
 * *"objects you have to walk under and other ones you have to jump onto and
 * walk across to avoid the things underneath"*).
 *
 * - A HANGING BASKET hangs over the path at the height a jump goes, and above
 *   anybody walking — so the dog walks under it, and a jump there is a knock.
 *   Nothing on the ground is put close enough to one that you would have to.
 * - THE BEER GARDEN is a run of tables over a patch of NETTLES too long to
 *   clear in a jump and a hop, at any speed: up onto the tables, along the
 *   top, off the far end. Walk underneath and the nettles get you. The tables
 *   are one-way — you land on them from above, and pass under from below.
 */
export const BASKET = { w: 1.0, low: 1.85, h: 2.75 };
export const TABLE_TOP = 1.1;
const NETTLES_H = 0.45;
/** Long enough that a jump and a hop together cannot clear it. */
const gardenLength = (speed) => Math.round(speed * 1.6 + 5);
/** No baskets or gardens in the first stretch: learn the jumping first. */
const SPECIALS_FROM = 60;

/**
 * THE CATS HAVE NAMES — one each, at random (the host, 3 October 2026). The
 * list is `staff-names.js`, shared with Blockyard's zombies.
 */
export const CAT_NAMES = NAMES;

/**
 * WHERE EACH WALK IS GOING — somewhere in Wokingham, picked at random (the
 * host, 3 October 2026: *"can walkies end with various Wokingham locations —
 * station tap, den 42 etc?"*). Real places named as places, nothing more: a
 * list to edit, one line each.
 */
export const PLACES = [
  'The Station Tap', 'Den 42', 'Elms Field', 'Peach Place', 'the Market Place',
  'All Saints Church', 'Howard Palmer Gardens', 'Joel Park', 'Cantley Park', 'Dinton Pastures',
];
/** How far every walk is — about a minute at the pace it builds to. */
export const WALK_LENGTH = 600;
/** What getting there is worth, on top of the metres and the bones. */
export const ARRIVING = 100;

/** A new walk, to anywhere but `notTo` — the last one's destination. */
export function newWalk(seed = 1, { notTo = '' } = {}) {
  const r = rng(seed);
  const choices = PLACES.filter((p) => p !== notTo);
  return {
    seed, r, x: 0, h: 0, vy: 0, onGround: true, hops: 1,
    speed: START_SPEED, t: 0, bones: 0, over: false, started: false, arrived: false,
    lives: LIVES, safeUntil: -Infinity,
    to: choices[Math.floor(r() * choices.length)],
    things: [], treats: [], ledges: [], nextAt: 14, trail: [{ x: 0, h: 0 }],
  };
}

export const metresLeft = (walk) => Math.max(0, Math.ceil(WALK_LENGTH - walk.x));

/**
 * THREE LIVES (the host, 4 October 2026). A knock costs one and the dog runs
 * on through whatever it hit; the third ends the walk. After a knock there is
 * GRACE — a few metres in which nothing else can hurt — so one bin is one life,
 * never three in a row off the same bench.
 */
export const LIVES = 3;
const GRACE = 4;

/** How far behind the dog the walker runs, on the lead. */
export const LEAD = 1.1;

/**
 * THE WALKER'S FEET FOLLOW THE DOG'S, PLACE FOR PLACE — wherever the dog was
 * at this spot on the path, the walker is now. So whatever the dog cleared,
 * the walker clears, and nobody ever runs through a bench. Read off `trail`.
 */
export function walkerHeight(walk) {
  const at = walk.x - LEAD;
  const t = walk.trail;
  for (let i = t.length - 1; i > 0; i--) {
    if (t[i - 1].x <= at && at <= t[i].x) {
      const span = t[i].x - t[i - 1].x || 1;
      return t[i - 1].h + (t[i].h - t[i - 1].h) * ((at - t[i - 1].x) / span);
    }
  }
  return 0;
}

/** Room to land and take off again, growing with the speed. */
const gapFor = (speed) => speed * 0.75 + 2.5;

function lay(walk) {
  // The last stretch is kept clear: nobody trips on the doorstep.
  while (walk.nextAt < walk.x + AHEAD && walk.nextAt < WALK_LENGTH - 12) {
    const gap = gapFor(walk.speed) + walk.r() * walk.speed * 0.8;
    const special = walk.nextAt > SPECIALS_FROM ? walk.r() : 1;
    if (special < 0.14) {
      // A hanging basket: walk under it. No bone near it — a bone at jump
      // height there is a dare to jump into the basket.
      const thing = { kind: 'basket', x: walk.nextAt, ...BASKET };
      walk.things.push(thing);
      walk.nextAt = thing.x + thing.w + gap;
      continue;
    }
    if (special < 0.28 && walk.nextAt + gardenLength(walk.speed) < WALK_LENGTH - 14) {
      // The beer garden: tables over nettles, and two bones along the top.
      const len = gardenLength(walk.speed);
      walk.ledges.push({ x: walk.nextAt, w: len, top: TABLE_TOP });
      walk.things.push({ kind: 'nettles', x: walk.nextAt, w: len, h: NETTLES_H });
      for (const k of [0.35, 0.7]) walk.treats.push({ x: walk.nextAt + len * k, h: TABLE_TOP + 0.9 });
      walk.nextAt += len + gap;
      continue;
    }
    const kind = KINDS[Math.floor(walk.r() * KINDS.length)];
    const thing = { kind, x: walk.nextAt, ...THINGS[kind] };
    if (kind === 'cat') thing.name = CAT_NAMES[Math.floor(walk.r() * CAT_NAMES.length)];
    walk.things.push(thing);
    // A bone in most gaps, up where a jump goes.
    if (walk.r() < 0.6) walk.treats.push({ x: thing.x + thing.w + gap * (0.35 + walk.r() * 0.3), h: 1.1 + walk.r() * 1.7 });
    walk.nextAt = thing.x + thing.w + gap;
  }
}

export function jump(walk) {
  if (walk.over) return false;
  walk.started = true;
  if (walk.onGround) { walk.vy = JUMP; walk.onGround = false; walk.hops = 1; return true; }
  if (walk.hops > 0) { walk.vy = HOP; walk.hops = 0; return true; }
  return false;
}

/** The dog's box, a little inside the drawing — a whisker is not a crash. */
const dogBox = (w) => ({ l: w.x + 0.15, r: w.x + DOG.w - 0.15, b: w.h + 0.05, t: w.h + DOG.h - 0.1 });

export function hitThing(walk) {
  const d = dogBox(walk);
  // Its height runs from `low` (above the ground for a hanging basket) to `h`.
  return walk.things.find((o) => !o.struck && d.r > o.x + 0.05 && d.l < o.x + o.w - 0.05 && d.b < o.h && d.t > (o.low || 0)) || null;
}

/** One tick. Nothing moves until the first tap, and nothing after the last. */
export function step(walk, dt = 1 / 60) {
  if (!walk.started || walk.over) return walk;
  walk.t += dt;
  walk.speed = Math.min(TOP_SPEED, START_SPEED + walk.t * SPEEDS_UP);
  walk.x += walk.speed * dt;
  walk.vy -= GRAVITY * dt;
  const h0 = walk.h;
  walk.h += walk.vy * dt;
  // What is underfoot: the ground, or a table top it came DOWN onto from above.
  const feet = dogBox(walk);
  let floor = 0;
  for (const L of walk.ledges) {
    if (feet.r > L.x && feet.l < L.x + L.w && h0 >= L.top - 1e-6 && walk.h <= L.top) floor = Math.max(floor, L.top);
  }
  if (walk.h <= floor) { walk.h = floor; walk.vy = 0; walk.onGround = true; walk.hops = 1; }
  else walk.onGround = false;
  walk.trail.push({ x: walk.x, h: walk.h });
  while (walk.trail.length > 2 && walk.trail[1].x < walk.x - LEAD - 1) walk.trail.shift();
  lay(walk);
  if (walk.x >= WALK_LENGTH) { walk.over = true; walk.arrived = true; return walk; }
  const hit = walk.x >= walk.safeUntil ? hitThing(walk) : null;
  if (hit) {
    hit.struck = true;
    walk.hit = hit;
    walk.lives -= 1;
    walk.hurtAt = walk.t;
    walk.safeUntil = walk.x + GRACE;
    if (walk.lives <= 0) { walk.over = true; return walk; }
  }
  const d = dogBox(walk);
  walk.treats = walk.treats.filter((b) => {
    const got = d.r > b.x - 0.3 && d.l < b.x + 0.3 && d.b < b.h + 0.25 && d.t > b.h - 0.25;
    if (got) walk.bones += 1;
    return !got;
  });
  walk.things = walk.things.filter((o) => o.x + o.w > walk.x - 8);
  walk.ledges = walk.ledges.filter((L) => L.x + L.w > walk.x - 8);
  walk.treats = walk.treats.filter((b) => b.x > walk.x - 8);
  return walk;
}

/** Metres walked, ten a bone, and a hundred for getting there. */
export const score = (walk) => Math.floor(Math.min(walk.x, WALK_LENGTH)) + walk.bones * 10 + (walk.arrived ? ARRIVING : 0);
