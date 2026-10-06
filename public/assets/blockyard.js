/**
 * BLOCKYARD — a side-on block world to dig through and build in, for one
 * staff login (the host, 3 October 2026: a little blocky dig-and-build game in
 * Evie's account).
 *
 * **OUR OWN GAME, OUR OWN DRAWINGS, OUR OWN NAME.** The genre — a grid of
 * blocks you dig up and put back — belongs to nobody; somebody else's name,
 * characters and block artwork do. This app is SOLD, which is the lobby
 * games' legal line exactly, and `test/blockyard.test.js` reads this file and
 * its page for the words that would cross it.
 *
 * This half is the RULES and nothing else — no page, no canvas, no storage —
 * so every one of them is testable in node: the world it makes from a seed,
 * what digging gives you, where a block may go, how the miner walks, falls and
 * hops up a step. `blockyard-play.js` draws it and takes the taps.
 *
 * Coordinates are in BLOCKS, `x` to the right and `y` DOWN (a row number). The
 * miner stands with their feet at `p.y`; their box is 0.6 wide and 1.8 tall.
 */
import { NAMES } from './staff-names.js';

export const W = 96;
export const H = 48;

export const AIR = 0;
export const BLOCKS = [
  { id: 0, name: 'Air' },
  { id: 1, name: 'Grass', drops: 2 },
  { id: 2, name: 'Earth' },
  { id: 3, name: 'Stone' },
  { id: 4, name: 'Log', passable: true },
  { id: 5, name: 'Leaves', passable: true },
  { id: 6, name: 'Sand' },
  { id: 7, name: 'Coal' },
  { id: 8, name: 'Gold' },
  { id: 9, name: 'Gem' },
  { id: 10, name: 'Planks' },
  { id: 11, name: 'Glass' },
  { id: 12, name: 'Brick' },
  { id: 13, name: 'Bedrock', fixed: true },
];
export const GRASS = 1;
export const EARTH = 2;
export const STONE = 3;
export const LOG = 4;
export const LEAVES = 5;
export const SAND = 6;
export const COAL = 7;
export const GOLD = 8;
export const GEM = 9;
export const PLANKS = 10;
export const GLASS = 11;
export const BRICK = 12;
export const BEDROCK = 13;

/** What can be made from what — one tap each, nothing to learn. */
export const RECIPES = [
  { id: 'planks', makes: PLANKS, count: 4, from: LOG, need: 1, label: '1 log → 4 planks' },
  { id: 'glass', makes: GLASS, count: 1, from: SAND, need: 1, label: '1 sand → 1 glass' },
  { id: 'brick', makes: BRICK, count: 1, from: STONE, need: 2, label: '2 stone → 1 brick' },
];

export const REACH = 4.5;
const HALF = 0.3;
const TALL = 1.8;
const GRAVITY = 30;
const FALL_MAX = 20;
const WALK = 4.5;
/** A jump clears a step of one block and not two: v²/2g = 1.5 blocks. */
const JUMP = Math.sqrt(2 * GRAVITY * 1.5);
const EPS = 1e-4;

/** A small seeded generator, so one seed is one world on every phone. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function get(world, x, y) {
  if (x < 0 || x >= world.w) return BEDROCK;
  if (y < 0) return AIR;
  if (y >= world.h) return BEDROCK;
  return world.cells[y * world.w + x];
}

export function set(world, x, y, id) {
  if (x < 0 || x >= world.w || y < 0 || y >= world.h) return;
  world.cells[y * world.w + x] = id;
}

/**
 * What the miner cannot walk through. A TREE IS WALKED PAST, NOT INTO: side
 * on, a trunk is a wall five blocks high across the only path there is, and
 * the first thing anybody does is walk left. So a log and its leaves are
 * scenery to the feet — still dug, still built against.
 */
export const solid = (id) => id !== AIR && !BLOCKS[id].passable;

/** Rolling ground from a seed: a few points joined smoothly, a little roughness on top. */
function heights(r, w) {
  const knots = Array.from({ length: Math.ceil(w / 8) + 2 }, () => r());
  const bumps = Array.from({ length: Math.ceil(w / 3) + 2 }, () => r());
  const smooth = (pts, step, x) => {
    const i = Math.floor(x / step);
    const f = (x / step) - i;
    const k = (1 - Math.cos(f * Math.PI)) / 2;
    return pts[i] * (1 - k) + pts[i + 1] * k;
  };
  const h = Array.from({ length: w }, (_, x) => {
    const n = (smooth(knots, 8, x) - 0.5) * 12 + (smooth(bumps, 3, x) - 0.5) * 3;
    return Math.max(9, Math.min(25, Math.round(16 + n)));
  });
  // NEVER MORE THAN ONE BLOCK BETWEEN NEIGHBOURS — the miner hops one and a
  // walk across open ground must never stop at a cliff nobody dug.
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 1; x < w; x++) h[x] = Math.max(h[x - 1] - 1, Math.min(h[x - 1] + 1, h[x]));
    for (let x = w - 2; x >= 0; x--) h[x] = Math.max(h[x + 1] - 1, Math.min(h[x + 1] + 1, h[x]));
  }
  return h;
}

/**
 * A whole world from a seed — the same seed is always the same world.
 * `surface[x]` is the row the ground starts on, kept so the picture can tell
 * open sky from a cave.
 */
export function makeWorld(seed = 1) {
  const r = rng(seed);
  const world = { w: W, h: H, seed, cells: new Uint8Array(W * H) };
  const surface = heights(r, W);
  for (let x = 0; x < W; x++) {
    const top = surface[x];
    const beach = top >= 22;
    for (let y = top; y < H; y++) {
      let id = STONE;
      if (y === top) id = beach ? SAND : GRASS;
      else if (y <= top + 3) id = beach && y <= top + 1 ? SAND : EARTH;
      set(world, x, y, id);
    }
    set(world, x, H - 1, BEDROCK);
    if (r() < 0.5) set(world, x, H - 2, BEDROCK);
  }
  // Caves: a few wandering tunnels, never through the bedrock.
  for (let n = 0; n < 7; n++) {
    let cx = 4 + r() * (W - 8);
    let cy = surface[Math.floor(cx)] + 7 + r() * 14;
    let dir = r() * Math.PI * 2;
    for (let s = 0; s < 45; s++) {
      const rad = 0.8 + r() * 0.9;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
        for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
          if (y >= H - 3 || y < 0 || (x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
          if (y > surface[Math.max(0, Math.min(W - 1, x))] + 3) set(world, x, y, AIR);
        }
      }
      dir += (r() - 0.5) * 0.9;
      cx = Math.max(2, Math.min(W - 3, cx + Math.cos(dir)));
      cy = Math.max(surface[Math.floor(cx)] + 5, Math.min(H - 5, cy + Math.sin(dir) * 0.6));
    }
  }
  // What is worth digging for — rarer the deeper it gets.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (get(world, x, y) !== STONE) continue;
      const deep = y - surface[x];
      const roll = r();
      if (deep > 22 && roll < 0.012) set(world, x, y, GEM);
      else if (deep > 14 && roll < 0.03) set(world, x, y, GOLD);
      else if (deep > 4 && roll < 0.07) set(world, x, y, COAL);
    }
  }
  // Trees on the grass, never two on top of each other.
  let last = -10;
  for (let x = 3; x < W - 3; x++) {
    const top = surface[x];
    if (get(world, x, top) !== GRASS || x - last < 5 || r() > 0.2) continue;
    last = x;
    const tall = 4 + Math.floor(r() * 2);
    for (let i = 1; i <= tall; i++) set(world, x, top - i, LOG);
    const crown = top - tall;
    for (let y = crown - 2; y <= crown + 1; y++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && (y === crown - 2 || y === crown + 1)) continue;
        if (get(world, x + dx, y) === AIR) set(world, x + dx, y, LEAVES);
      }
    }
  }
  world.surface = surface;
  return world;
}

/** The miner, standing on the ground in the middle of the world. */
export function spawn(world) {
  const x = Math.floor(world.w / 2);
  const top = (col) => { let y = 0; while (y < world.h && !solid(get(world, col, y))) y++; return y; };
  return { x: x + 0.5, y: top(x), vx: 0, vy: 0, onGround: true, targetX: null, facing: 1, held: 0 };
}

function hits(world, left, top, right, bottom) {
  for (let y = Math.floor(top); y <= Math.floor(bottom - EPS); y++) {
    for (let x = Math.floor(left); x <= Math.floor(right - EPS); x++) {
      if (solid(get(world, x, y))) return true;
    }
  }
  return false;
}

const boxHits = (world, p, dx = 0, dy = 0) => hits(world, p.x - HALF + dx, p.y - TALL + dy, p.x + HALF + dx, p.y + dy);

export const overlapsPlayer = (p, x, y) =>
  x + 1 > p.x - HALF && x < p.x + HALF && y + 1 > p.y - TALL && y < p.y;

/** Is the middle of block (x, y) within arm's length of the miner? */
export function inReach(p, x, y) {
  const dx = x + 0.5 - p.x;
  const dy = y + 0.5 - (p.y - TALL / 2);
  return dx * dx + dy * dy <= REACH * REACH;
}

/**
 * CAN SHE ACTUALLY GET AT IT — in reach AND in sight. The host, 4 October
 * 2026, off a screenshot of holes dug in the far side of solid stone: *"she
 * should only be able to click squares that are reachable."* A straight line
 * from her eyes, her middle or her feet to the middle of the target may pass
 * through nothing solid but the target itself. Trees are scenery to the feet,
 * so they are scenery to the eye too.
 */
export function inSight(world, fromX, fromY, toX, toY, target = null) {
  const steps = Math.ceil(Math.hypot(toX - fromX, toY - fromY) / 0.15);
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    const cx = Math.floor(fromX + (toX - fromX) * k);
    const cy = Math.floor(fromY + (toY - fromY) * k);
    if (target && cx === target.x && cy === target.y) continue;
    if (solid(get(world, cx, cy))) return false;
  }
  return true;
}

const EYES = [TALL - 0.3, TALL / 2, 0.3];

export function canReach(world, p, x, y) {
  if (!inReach(p, x, y)) return false;
  return EYES.some((up) => inSight(world, p.x, p.y - up, x + 0.5, y + 0.5, { x, y }));
}

export function jump(p) {
  if (p.onGround && !p.flying) { p.vy = -JUMP; p.onGround = false; }
}

/**
 * FLYING (the host, 6 October 2026: *"a fly feature when you double jump"*).
 * A double jump takes off and another lands. In the air there is no gravity:
 * `p.lift` (-1 up, 1 down, held keys) or `p.targetY` (a tapped spot) moves
 * her up and down, and walking moves her across as it always did. Blocks
 * still stop her — flying is through the air, never through the stone — and
 * the zombies stay on the ground, which is rather the point.
 */
const FLY = 5;
export function toggleFly(p) {
  p.flying = !p.flying;
  p.vy = 0;
  p.lift = 0;
  p.targetY = null;
  return p.flying;
}

/**
 * One tick of the miner. Walks towards `targetX`, hops a one-block step on its
 * own, stops at a wall of two, falls, lands. Pure in the world and the miner.
 */
export function step(world, p, dt = 1 / 60) {
  const pace = p.pace || WALK;  // a zombie carries its own, slower
  if (p.held) {
    // A key held down on a laptop: walk while it is held.
    p.vx = p.held * pace;
    p.facing = p.held;
    p.targetX = null;
  } else if (p.targetX !== null && p.targetX !== undefined) {
    const dx = p.targetX - p.x;
    if (Math.abs(dx) < 0.08) { p.vx = 0; p.targetX = null; }
    else { p.vx = Math.sign(dx) * pace; p.facing = Math.sign(dx); }
  } else p.vx = 0;

  // A step up of one block is hopped; two is a wall.
  if (p.vx !== 0 && p.onGround && !p.flying) {
    const ahead = Math.sign(p.vx) * 0.12;
    if (boxHits(world, p, ahead, 0) && !boxHits(world, p, ahead, -1.05) && !boxHits(world, p, 0, -1.05)) jump(p);
  }

  if (p.flying) {
    // In the air: up or down only when asked, hovering otherwise.
    if (p.lift) { p.vy = p.lift * FLY; p.targetY = null; }
    else if (p.targetY !== null && p.targetY !== undefined) {
      const dy = p.targetY - p.y;
      // The last step lands exactly on the spot, rather than stopping short.
      if (Math.abs(dy) <= FLY * dt) { p.vy = dy / dt; p.targetY = null; } else p.vy = Math.sign(dy) * FLY;
    } else p.vy = 0;
  } else p.vy = Math.min(FALL_MAX, p.vy + GRAVITY * dt);

  const x0 = p.x;
  p.x = Math.max(HALF, Math.min(world.w - HALF, p.x + p.vx * dt));
  if (boxHits(world, p)) {
    p.x = x0;
    // Still on the ground means it did not hop this: a wall, so stop asking.
    if (p.onGround) p.targetX = null;
    p.vx = 0;
  }

  const y0 = p.y;
  p.y += p.vy * dt;
  if (boxHits(world, p)) {
    if (p.vy > 0) p.y = Math.floor(p.y);
    else p.y = Math.floor(p.y - TALL) + 1 + TALL;
    if (boxHits(world, p)) p.y = y0;
    p.vy = 0;
    if (p.flying) p.targetY = null;
  }
  p.onGround = boxHits(world, p, 0, 0.02);
  if (p.y > world.h) { p.y = world.h; p.vy = 0; }
  return p;
}

/** Dig a block out, into the bag. Answers what was got, or null. */
export function dig(world, bag, p, x, y) {
  const id = get(world, x, y);
  if (id === AIR || BLOCKS[id].fixed || !canReach(world, p, x, y)) return null;
  set(world, x, y, AIR);
  const got = BLOCKS[id].drops || id;
  bag[got] = (bag[got] || 0) + 1;
  return got;
}

/**
 * Put a block from the bag down. It needs an empty space within reach, touching
 * another block (nothing floats), and not where the miner is standing — except
 * straight underneath them, which lifts them up a block: the way out of a pit.
 * Answers why not, or '' when it went down.
 */
export function place(world, bag, p, x, y, id) {
  if (!(bag[id] > 0)) return 'none';
  if (x < 0 || x >= world.w || y < 0 || y >= world.h) return 'edge';
  if (get(world, x, y) !== AIR) return 'full';
  if (!inReach(p, x, y)) return 'far';
  if (overlapsPlayer(p, x, y)) {
    const under = Math.floor(p.y) - 1;
    if (y !== under || !p.onGround || boxHits(world, p, 0, -1)) return 'you';
    set(world, x, y, id);
    p.y -= 1;
    p.vy = 0;
    if (boxHits(world, p)) { set(world, x, y, AIR); p.y += 1; return 'you'; }
    bag[id] -= 1;
    return '';
  }
  if (!canReach(world, p, x, y)) return 'hidden';
  const touching = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(world, x + dx, y + dy) !== AIR);
  if (!touching) return 'float';
  set(world, x, y, id);
  bag[id] -= 1;
  return '';
}

export function make(bag, recipeId) {
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r || !((bag[r.from] || 0) >= r.need)) return false;
  bag[r.from] -= r.need;
  bag[r.makes] = (bag[r.makes] || 0) + r.count;
  return true;
}

/** A world and a bag as one string, for `localStorage`. */
export function save(world, bag, p) {
  let bin = '';
  for (let i = 0; i < world.cells.length; i++) bin += String.fromCharCode(world.cells[i]);
  return JSON.stringify({ v: 1, seed: world.seed, w: world.w, h: world.h, surface: world.surface, cells: btoa(bin), bag, at: { x: p.x, y: p.y } });
}

/** The other way. A file that will not read answers null — a fresh world, not a crash. */
export function load(text) {
  try {
    const d = JSON.parse(text);
    if (d.v !== 1 || d.w !== W || d.h !== H) return null;
    const bin = atob(d.cells);
    if (bin.length !== W * H) return null;
    const cells = new Uint8Array(W * H);
    for (let i = 0; i < cells.length; i++) cells[i] = Math.min(BLOCKS.length - 1, bin.charCodeAt(i));
    const world = { w: W, h: H, seed: d.seed, cells, surface: Array.isArray(d.surface) ? d.surface : Array(W).fill(16) };
    const bag = {};
    for (const [k, v] of Object.entries(d.bag || {})) if (BLOCKS[k] && v > 0) bag[k] = Math.floor(v);
    const p = { x: Number(d.at && d.at.x) || W / 2, y: Number(d.at && d.at.y) || 0, vx: 0, vy: 0, onGround: false, targetX: null, facing: 1, held: 0 };
    return { world, bag, p };
  } catch {
    return null;
  }
}

/* ---- zombies, and the three lives they cost ---- */

/**
 * ZOMBIES, NAMED OFF THE STAFF LIST — "Zombie Rish" (the host, 4 October
 * 2026), and THREE LIVES for the miner, a zombie's touch costing one. Ours:
 * a generic shambler drawn in `blockyard-play.js`, nobody else's creature.
 *
 * They walk the miner's own physics at a slower pace, so they hop a one-block
 * step, are stopped by a wall of two and can never dig: **a wall is a defence
 * and a hole is a trap**, which is the whole game they add. After a touch
 * there is GRACE — nothing can hurt for a moment — and the miner is knocked
 * back, so one zombie is one life, never three in a heartbeat. Tap one to bop
 * it; two bops puts it down, and it gets up again later, somewhere else.
 */
export const LIVES = 3;
/*
 * MORE AGGRESSIVE, ON REQUEST (the host, 6 October 2026: *"they should come to
 * get you faster"*): two-thirds of her pace, so she can still outrun one but
 * only just; they spot her from twice as far; out of sight they drift her way
 * rather than wander anywhere; and they are back up sooner. They WAKE UP a few
 * seconds in, so a game never opens with a zombie already on top of her.
 */
const ZOMBIE_PACE = 3.0;
const ZOMBIE_HP = 2;
/** How near before a zombie comes for you, in blocks across and down. */
const SEES_ACROSS = 24;
const SEES_DOWN = 10;
/** Seconds before the zombies wake and come for her — time to read the rules. */
export const WAKES_AT = 6;
/** Seconds of grace after a touch. */
const SAFE_FOR = 1.5;
/** Seconds before a bopped zombie gets up again, somewhere else. */
const BACK_IN = 15;
/** Never closer than this to the miner when one gets up. */
const SPAWN_CLEAR = 18;

const groundAt = (world, x) => { let y = 0; while (y < world.h && !solid(get(world, x, y))) y++; return y; };

/** Stand a zombie on the ground somewhere well away from the miner. */
export function placeZombie(world, z, p, r) {
  let x = null;
  for (let tries = 0; tries < 60 && x === null; tries++) {
    const at = 2 + Math.floor(r() * (world.w - 4));
    if (Math.abs(at + 0.5 - p.x) >= SPAWN_CLEAR) x = at;
  }
  if (x === null) x = p.x < world.w / 2 ? world.w - 3 : 2;
  Object.assign(z, { x: x + 0.5, y: groundAt(world, x), vx: 0, vy: 0, onGround: true, targetX: null, held: 0, hp: ZOMBIE_HP, dead: false });
  return z;
}

/** A fresh round of play: three lives and a zombie for every name. */
export function newPlay(world, p, seed = 1) {
  const r = rng(seed ^ 0x5eed);
  const zombies = NAMES.map((n) => placeZombie(world, { name: `Zombie ${n}`, pace: ZOMBIE_PACE, facing: -1 }, p, r));
  return { lives: LIVES, t: 0, safeUntil: 0, down: false, hurtBy: '', r, zombies };
}

/** Are two standing bodies touching? Both are 0.6 wide and 1.8 tall. */
export const touching = (a, b) => Math.abs(a.x - b.x) < HALF * 2 && a.y - TALL < b.y && b.y - TALL < a.y;

/** Within arm's length of the miner — what a bop needs. */
/** In reach and in sight — a zombie behind stone cannot be hit. */
export const canBop = (p, z, world = null) => !z.dead && Math.hypot(z.x - p.x, z.y - p.y) <= REACH
  && (!world || EYES.some((up) => inSight(world, p.x, p.y - up, z.x, z.y - TALL / 2)));

/**
 * One tick of play: the miner, then every zombie, then whether one has got
 * them. Answers the zombie that did, or null.
 */
export function tick(world, p, play, dt = 1 / 60) {
  play.t += dt;
  if (play.down) return null;
  step(world, p, dt);
  let got = null;
  for (const z of play.zombies) {
    if (z.dead) {
      if (play.t >= z.backAt) placeZombie(world, z, p, play.r);
      continue;
    }
    const awake = play.t >= WAKES_AT;
    if (awake && Math.abs(p.x - z.x) < SEES_ACROSS && Math.abs(p.y - z.y) < SEES_DOWN) z.targetX = p.x;
    else if (z.targetX === null && play.r() < 0.02) {
      // Out of sight: awake, it drifts her way; asleep, it only shuffles.
      const toward = awake ? Math.sign(p.x - z.x || 1) * (2 + play.r() * 6) : (play.r() - 0.5) * 6;
      z.targetX = Math.max(1, Math.min(world.w - 1, z.x + toward));
    }
    step(world, z, dt);
    if (!got && play.t >= play.safeUntil && touching(z, p)) {
      got = z;
      play.lives -= 1;
      play.safeUntil = play.t + SAFE_FOR;
      play.hurtBy = z.name;
      // Knocked back, away from it, with a hop.
      p.targetX = Math.max(HALF, Math.min(world.w - HALF, p.x + Math.sign(p.x - z.x || 1) * 1.6));
      jump(p);
      if (play.lives <= 0) play.down = true;
    }
  }
  return got;
}

/** A bop: answers 'down' when it put the zombie down, 'hit' when not yet, or '' out of reach. */
export function bop(play, p, z, world = null) {
  if (!canBop(p, z, world)) return '';
  z.hp -= 1;
  z.targetX = z.x + Math.sign(z.x - p.x || 1) * 2;
  if (z.hp > 0) return 'hit';
  z.dead = true;
  z.backAt = play.t + BACK_IN;
  return 'down';
}

/** Back on your feet: three lives, at the start, the zombies well away. */
export function revive(world, p, play) {
  Object.assign(p, spawn(world));
  play.lives = LIVES;
  play.down = false;
  play.safeUntil = play.t + SAFE_FOR;
  for (const z of play.zombies) placeZombie(world, z, p, play.r);
  return play;
}
