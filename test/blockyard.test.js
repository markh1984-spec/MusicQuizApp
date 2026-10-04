/**
 * BLOCKYARD — the dig-and-build game on one staff login. The rules are
 * `public/assets/blockyard.js`, pure, so all of them are asked here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AIR, BEDROCK, EARTH, GRASS, H, LIVES, LOG, PLANKS, STONE, W,
  bop, canReach, dig, get, load, make, makeWorld, newPlay, place, revive, save, set, spawn, step, tick,
} from '../public/assets/blockyard.js';
import { NAMES } from '../public/assets/staff-names.js';

const settle = (world, p, frames = 120) => { for (let i = 0; i < frames; i++) step(world, p); return p; };

/** A flat test world: open air above row 20, stone from there down. */
function flat() {
  const world = { w: W, h: H, seed: 0, cells: new Uint8Array(W * H), surface: Array(W).fill(20) };
  for (let y = 20; y < H; y++) for (let x = 0; x < W; x++) set(world, x, y, y === H - 1 ? BEDROCK : STONE);
  const p = { x: 40.5, y: 20, vx: 0, vy: 0, onGround: true, targetX: null, facing: 1, held: 0 };
  return { world, p };
}

test('one seed is one world, and a different seed is a different one', () => {
  const a = makeWorld(42);
  const b = makeWorld(42);
  const c = makeWorld(43);
  assert.deepEqual(a.cells, b.cells);
  assert.notDeepEqual(a.cells, c.cells);
});

test('the bottom is bedrock all the way across, and the ground never steps more than one block', () => {
  for (const seed of [1, 7, 42, 2026]) {
    const w = makeWorld(seed);
    for (let x = 0; x < W; x++) assert.equal(get(w, x, H - 1), BEDROCK);
    for (let x = 1; x < W; x++) assert.ok(Math.abs(w.surface[x] - w.surface[x - 1]) <= 1, `seed ${seed} column ${x}`);
  }
});

test('the miner starts standing on the ground and stays there', () => {
  const w = makeWorld(7);
  const p = spawn(w);
  const y = p.y;
  settle(w, p);
  assert.equal(p.y, y);
  assert.ok(p.onGround);
});

test('a walk across open ground reaches the far side, hopping the steps and passing the trees', () => {
  for (const seed of [1, 7, 42, 99, 2026]) {
    const w = makeWorld(seed);
    const p = settle(w, spawn(w), 30);
    p.targetX = W - 5.5;
    settle(w, p, 4000);
    assert.ok(Math.abs(p.x - (W - 5.5)) < 0.2, `seed ${seed} stopped at ${p.x}`);
  }
});

test('a wall two blocks high stops a walk, and one block is hopped', () => {
  const { world, p } = flat();
  set(world, 43, 19, STONE);
  p.targetX = 46.5;
  settle(world, p, 400);
  assert.ok(p.x > 44, 'one block is hopped');
  set(world, 49, 19, STONE);
  set(world, 49, 18, STONE);
  p.targetX = 52.5;
  settle(world, p, 600);
  assert.ok(p.x < 49, 'two blocks is a wall');
  assert.equal(p.targetX, null, 'and it stops asking to walk into it');
});

test('digging puts the block in the bag — grass comes up as earth — and bedrock does not dig', () => {
  const { world, p } = flat();
  const bag = {};
  assert.equal(dig(world, bag, p, 40, 20), STONE);
  assert.equal(get(world, 40, 20), AIR);
  assert.equal(bag[STONE], 1);
  set(world, 41, 20, GRASS);
  assert.equal(dig(world, bag, p, 41, 20), EARTH);
  set(world, 39, 20, BEDROCK);
  assert.equal(dig(world, bag, p, 39, 20), null);
  assert.equal(dig(world, bag, p, 60, 20), null, 'too far away');
});

test('a block goes down only from the bag, touching another, and never where the miner stands', () => {
  const { world, p } = flat();
  const bag = { [PLANKS]: 2 };
  assert.equal(place(world, bag, p, 42, 19, STONE), 'none');
  assert.equal(place(world, bag, p, 42, 16, PLANKS), 'float');
  assert.equal(place(world, bag, p, 40, 18, PLANKS), 'you');
  assert.equal(place(world, bag, p, 42, 19, PLANKS), '');
  assert.equal(get(world, 42, 19), PLANKS);
  assert.equal(bag[PLANKS], 1);
  assert.equal(place(world, bag, p, 42, 19, PLANKS), 'full');
  assert.equal(place(world, bag, p, 70, 19, PLANKS), 'far');
});

test('a block put under the miner\'s feet lifts them up one — the way out of a pit', () => {
  const { world, p } = flat();
  const bag = { [STONE]: 3 };
  settle(world, p, 10);
  assert.equal(place(world, bag, p, 40, 19, STONE), '');
  assert.equal(p.y, 19);
  assert.equal(get(world, 40, 19), STONE);
  settle(world, p);
  assert.equal(p.y, 19, 'and they stand on it');
});

test('making things: a log is four planks, and nothing is made from nothing', () => {
  const bag = { [LOG]: 1 };
  assert.ok(make(bag, 'planks'));
  assert.equal(bag[PLANKS], 4);
  assert.equal(bag[LOG], 0);
  assert.equal(make(bag, 'planks'), false);
  assert.equal(make(bag, 'nonsense'), false);
});

test('a world and its bag are kept and brought back exactly, and a broken save is a fresh world', () => {
  const w = makeWorld(5);
  const p = settle(w, spawn(w), 10);
  const bag = { [STONE]: 7 };
  dig(w, bag, p, Math.floor(p.x), Math.floor(p.y));
  const back = load(save(w, bag, p));
  assert.deepEqual(back.world.cells, w.cells);
  assert.deepEqual(back.bag, bag);
  assert.equal(back.p.x, p.x);
  assert.equal(load('not json'), null);
  assert.equal(load(JSON.stringify({ v: 1, w: 3, h: 3, cells: '' })), null);
});

/*
 * OUR OWN GAME — the lobby games' legal line. The genre is free; another
 * game's name, characters and creatures are not, and this app is SOLD.
 */
test('the game names nobody else\'s game, characters or creatures', () => {
  for (const file of ['public/assets/blockyard.js', 'public/assets/blockyard-play.js']) {
    const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /minecraft|mojang|creeper|enderman|\bsteve\b|\bnotch\b|zombie pigman/i, file);
  }
});

/* ---- zombies and lives ---- */

const runFor = (world, p, play, seconds) => { for (let i = 0; i < seconds * 60; i++) tick(world, p, play); };

test('a zombie for every name — "Zombie Rish" — standing on the ground, well away from the miner', () => {
  const w = makeWorld(7);
  const p = spawn(w);
  const play = newPlay(w, p, 7);
  assert.deepEqual(play.zombies.map((z) => z.name), NAMES.map((n) => `Zombie ${n}`));
  assert.equal(play.lives, LIVES);
  assert.equal(LIVES, 3);
  for (const z of play.zombies) {
    assert.ok(Math.abs(z.x - p.x) >= 18, `${z.name} started ${Math.abs(z.x - p.x).toFixed(1)} away`);
    assert.ok(get(w, Math.floor(z.x), z.y) !== AIR, `${z.name} is standing on something`);
  }
});

test('a zombie that sees the miner comes for them, a touch costs ONE life, and then there is grace', () => {
  const { world, p } = flat();
  const play = newPlay(world, p, 1);
  for (const z of play.zombies.slice(1)) z.dead = true, z.backAt = Infinity;
  const z = play.zombies[0];
  Object.assign(z, { x: p.x + 6, y: p.y, targetX: null });
  runFor(world, p, play, 4);
  assert.equal(play.lives, 2, 'it walked over and got them once');
  assert.equal(play.hurtBy, z.name);
  // still on top of them during the grace: no second life
  Object.assign(z, { x: p.x, y: p.y });
  tick(world, p, play);
  assert.equal(play.lives, 2, 'nothing hurts during the grace');
});

test('three touches and StEvie is down, and getting up again is three lives at the start', () => {
  const { world, p } = flat();
  const play = newPlay(world, p, 2);
  for (const z of play.zombies.slice(1)) z.dead = true, z.backAt = Infinity;
  const z = play.zombies[0];
  for (let i = 0; i < 3; i++) {
    Object.assign(z, { x: p.x, y: p.y });
    tick(world, p, play);
    play.safeUntil = 0;
  }
  assert.equal(play.lives, 0);
  assert.equal(play.down, true);
  const before = play.t;
  tick(world, p, play);
  assert.ok(play.t > before && play.down, 'nothing moves while down');
  revive(world, p, play);
  assert.equal(play.lives, 3);
  assert.equal(play.down, false);
  assert.ok(play.zombies.every((zz) => Math.abs(zz.x - p.x) >= 18), 'and the zombies are put well away');
});

test('two bops put a zombie down, out of reach does nothing, and it gets up again later somewhere else', () => {
  const { world, p } = flat();
  const play = newPlay(world, p, 3);
  const z = play.zombies[0];
  Object.assign(z, { x: p.x + 2, y: p.y });
  assert.equal(bop(play, p, z), 'hit');
  Object.assign(z, { x: p.x + 2, y: p.y });
  assert.equal(bop(play, p, z), 'down');
  assert.equal(z.dead, true);
  const far = play.zombies[1];
  Object.assign(far, { x: p.x + 20, y: p.y });
  assert.equal(bop(play, p, far), '', 'too far to reach');
  play.t = z.backAt;
  tick(world, p, play);
  assert.equal(z.dead, false, 'up again');
  assert.ok(Math.abs(z.x - p.x) >= 18, 'somewhere else');
});

test('a zombie hops one block but a wall of two keeps it out — and it can never dig', () => {
  const { world, p } = flat();
  const play = newPlay(world, p, 4);
  for (const z of play.zombies.slice(1)) z.dead = true, z.backAt = Infinity;
  const z = play.zombies[0];
  Object.assign(z, { x: p.x + 8, y: p.y });
  set(world, Math.floor(p.x) + 3, 19, STONE);
  set(world, Math.floor(p.x) + 3, 18, STONE);
  const cells = world.cells.slice();
  runFor(world, p, play, 8);
  assert.equal(play.lives, 3, 'the wall held');
  assert.ok(z.x > p.x + 3, 'it is stuck on the far side');
  assert.deepEqual(world.cells, cells, 'and not a block was moved');
});

/* ---- only what she can actually get at ---- */

test('a block behind a wall cannot be dug, even within reach — the wall can', () => {
  const { world, p } = flat();
  const bag = {};
  set(world, 42, 19, STONE); set(world, 42, 18, STONE); set(world, 42, 17, STONE); // a wall in front of her
  set(world, 43, 19, GRASS); // and something on the far side, within arm's length
  assert.equal(canReach(world, p, 43, 19), false, 'out of sight behind the wall');
  assert.equal(dig(world, bag, p, 43, 19), null);
  assert.equal(get(world, 43, 19), GRASS, 'still there');
  assert.equal(dig(world, bag, p, 42, 19), STONE, 'the wall itself is fine');
  assert.ok(canReach(world, p, 43, 19), 'and with the wall dug, it can be seen');
});

test('a block deep inside the stone cannot be dug from the surface — only the one on top', () => {
  const { world, p } = flat();
  const bag = {};
  assert.equal(dig(world, bag, p, 41, 22), null, 'two blocks down, through stone');
  assert.equal(dig(world, bag, p, 41, 21), null, 'one down and across, through the block above it');
  assert.equal(dig(world, bag, p, 41, 20), STONE, 'the top one, beside her feet');
  assert.equal(dig(world, bag, p, 40, 20), STONE, 'and the one under her feet');
});

test('a block cannot be built round a corner, and a zombie behind stone cannot be hit', () => {
  const { world, p } = flat();
  set(world, 42, 19, STONE); set(world, 42, 18, STONE); set(world, 42, 17, STONE);
  const bag = { [PLANKS]: 1 };
  assert.equal(place(world, bag, p, 43, 19, PLANKS), 'hidden');
  assert.equal(bag[PLANKS], 1, 'nothing spent');
  const play = newPlay(world, p, 9);
  const z = play.zombies[0];
  Object.assign(z, { x: 43.5, y: 20 });
  assert.equal(bop(play, p, z, world), '', 'the wall is in the way');
  set(world, 42, 19, AIR); set(world, 42, 18, AIR);
  assert.equal(bop(play, p, z, world), 'hit', 'with the wall open, she can');
});
