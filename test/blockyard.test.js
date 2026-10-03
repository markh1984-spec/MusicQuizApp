/**
 * BLOCKYARD — the dig-and-build game on one staff login. The rules are
 * `public/assets/blockyard.js`, pure, so all of them are asked here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AIR, BEDROCK, EARTH, GRASS, H, LOG, PLANKS, STONE, W,
  dig, get, load, make, makeWorld, place, save, set, spawn, step,
} from '../public/assets/blockyard.js';

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
