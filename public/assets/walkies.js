/**
 * WALKIES — a dog running through the park, for one staff login (the host,
 * 3 October 2026: *"can Tabby have a game that is dog themed?"*).
 *
 * One tap jumps, a second tap in the air hops again once; bins, benches,
 * puddles and the odd cat end the walk, and bones are worth having. The
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
    to: choices[Math.floor(r() * choices.length)],
    things: [], treats: [], nextAt: 14, trail: [{ x: 0, h: 0 }],
  };
}

export const metresLeft = (walk) => Math.max(0, Math.ceil(WALK_LENGTH - walk.x));

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
    const kind = KINDS[Math.floor(walk.r() * KINDS.length)];
    const thing = { kind, x: walk.nextAt, ...THINGS[kind] };
    walk.things.push(thing);
    const gap = gapFor(walk.speed) + walk.r() * walk.speed * 0.8;
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
  return walk.things.find((o) => d.r > o.x + 0.05 && d.l < o.x + o.w - 0.05 && d.b < o.h) || null;
}

/** One tick. Nothing moves until the first tap, and nothing after the last. */
export function step(walk, dt = 1 / 60) {
  if (!walk.started || walk.over) return walk;
  walk.t += dt;
  walk.speed = Math.min(TOP_SPEED, START_SPEED + walk.t * SPEEDS_UP);
  walk.x += walk.speed * dt;
  walk.vy -= GRAVITY * dt;
  walk.h += walk.vy * dt;
  if (walk.h <= 0) { walk.h = 0; walk.vy = 0; walk.onGround = true; walk.hops = 1; }
  walk.trail.push({ x: walk.x, h: walk.h });
  while (walk.trail.length > 2 && walk.trail[1].x < walk.x - LEAD - 1) walk.trail.shift();
  lay(walk);
  if (walk.x >= WALK_LENGTH) { walk.over = true; walk.arrived = true; return walk; }
  if (hitThing(walk)) { walk.over = true; return walk; }
  const d = dogBox(walk);
  walk.treats = walk.treats.filter((b) => {
    const got = d.r > b.x - 0.3 && d.l < b.x + 0.3 && d.b < b.h + 0.25 && d.t > b.h - 0.25;
    if (got) walk.bones += 1;
    return !got;
  });
  walk.things = walk.things.filter((o) => o.x + o.w > walk.x - 8);
  walk.treats = walk.treats.filter((b) => b.x > walk.x - 8);
  return walk;
}

/** Metres walked, ten a bone, and a hundred for getting there. */
export const score = (walk) => Math.floor(Math.min(walk.x, WALK_LENGTH)) + walk.bones * 10 + (walk.arrived ? ARRIVING : 0);
