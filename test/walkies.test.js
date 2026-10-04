/**
 * WALKIES — the dog game on one staff login. The rules are
 * `public/assets/walkies.js`, pure, so all of them are asked here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ARRIVING, CAT_NAMES, DOG, LEAD, LIVES, PLACES, THINGS, WALK_LENGTH, hitThing, jump, metresLeft, newWalk, score, step, walkerHeight } from '../public/assets/walkies.js';

/** A player with a simple rule: jump when the next thing is this many seconds away. */
function playFor(seed, seconds, lead) {
  const w = newWalk(seed);
  w.started = true;
  for (let i = 0; i < seconds * 60; i++) {
    const ahead = w.things.find((o) => o.x + o.w > w.x);
    if (ahead && w.onGround && ahead.x - (w.x + DOG.w) < w.speed * lead + 0.2) jump(w);
    step(w);
    if (w.over) break;
  }
  return w;
}

test('nothing moves until the first tap', () => {
  const w = newWalk(3);
  for (let i = 0; i < 120; i++) step(w);
  assert.equal(w.x, 0);
  assert.equal(w.over, false);
  jump(w);
  for (let i = 0; i < 30; i++) step(w);
  assert.ok(w.x > 0, 'the tap starts the walk');
});

test('one seed is one walk', () => {
  const a = playFor(9, 20, 0.1);
  const b = playFor(9, 20, 0.1);
  assert.deepEqual(a.things.map((o) => [o.kind, o.x]), b.things.map((o) => [o.kind, o.x]));
});

test('EVERY GAP CAN BE JUMPED — steady timing gets all the way there, on every seed', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 42, 2026]) {
    for (const lead of [0.06, 0.12, 0.18]) {
      const w = playFor(seed, 90, lead);
      assert.ok(w.arrived, `seed ${seed}, jumping ${lead}s out, hit a ${hitThing(w) && hitThing(w).kind} at ${Math.floor(w.x)}m on the way to ${w.to}`);
    }
  }
});

test('every walk goes somewhere in Wokingham, never twice running, and getting there is worth a hundred', () => {
  const w = newWalk(11);
  assert.ok(PLACES.includes(w.to));
  for (let s = 0; s < 40; s++) assert.notEqual(newWalk(s, { notTo: 'Den 42' }).to, 'Den 42');
  assert.equal(metresLeft(w), WALK_LENGTH);
  const done = playFor(3, 90, 0.12);
  assert.ok(done.arrived && done.over);
  assert.equal(metresLeft(done), 0);
  assert.equal(score(done), WALK_LENGTH + done.bones * 10 + ARRIVING);
  assert.equal(done.things.some((o) => o.x > WALK_LENGTH - 12), false, 'the doorstep is clear');
});

test('a dog that never jumps does not get far — three knocks and the walk is over', () => {
  const w = newWalk(5);
  jump(w);
  w.vy = 0;
  for (let i = 0; i < 60 * 40 && !w.over; i++) step(w);
  assert.ok(w.over && !w.arrived, 'it ran out of lives');
  assert.equal(w.lives, 0);
  assert.ok(w.x < 150, `but only after ${Math.floor(w.x)}m`);
});

test('a knock costs ONE life, the dog runs on through, and one bin cannot take two', () => {
  const w = newWalk(1);
  w.started = true;
  w.nextAt = Infinity;
  w.things = [{ kind: 'bench', x: 3, w: 1.8, h: 0.9 }, { kind: 'bin', x: 5.5, w: 0.8, h: 1.1 }, { kind: 'bin', x: 12, w: 0.8, h: 1.1 }];
  for (let i = 0; i < 60 * 3 && !w.over; i++) step(w);
  assert.equal(LIVES, 3);
  assert.equal(w.over, false, 'still walking');
  assert.equal(w.lives, 1, 'the bench cost one, the bin straight after was in the grace, the next bin cost one');
  assert.equal(w.hit.kind, 'bin');
  assert.ok(w.x > 13, 'and it ran on past them');
});

test('one hop in the air, and no more until it lands', () => {
  const w = newWalk(1);
  w.nextAt = Infinity; // an empty park: this is about the jumping, not the bins
  assert.ok(jump(w), 'the jump');
  step(w);
  assert.ok(jump(w), 'one hop');
  step(w);
  assert.equal(jump(w), false, 'not a third');
  for (let i = 0; i < 120; i++) step(w);
  assert.ok(w.onGround);
  assert.ok(jump(w), 'and again once it has landed');
});

test('a bone is ten, a metre is one, and the walk speeds up', () => {
  const w = playFor(7, 30, 0.12);
  assert.equal(score(w), Math.floor(w.x) + w.bones * 10);
  assert.ok(w.speed > 7, `speed ${w.speed}`);
});

/*
 * OUR OWN DOG — the lobby games' legal line. This app is SOLD, and a famous
 * dog's name or look is somebody else's.
 */
test('the game names nobody else\'s dog or game', () => {
  for (const file of ['public/assets/walkies.js', 'public/assets/walkies-play.js']) {
    const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /snoopy|scooby|pluto|gromit|bluey|paw patrol|nintendogs|lassie|clifford|goofy|\bodie\b|minecraft|mojang/i, file);
  }
});

test('the walker on the lead goes where the dog went, so never through a bench', () => {
  for (const seed of [1, 4, 42]) {
    const w = newWalk(seed);
    w.started = true;
    let lowest = Infinity;
    for (let i = 0; i < 60 * 40; i++) {
      const ahead = w.things.find((o) => o.x + o.w > w.x);
      if (ahead && w.onGround && ahead.x - (w.x + DOG.w) < w.speed * 0.12 + 0.2) jump(w);
      step(w);
      // the walker's feet, a little narrower than the dog's box, against every thing
      const feet = { l: w.x - LEAD + 0.3, r: w.x - LEAD + 0.75, b: walkerHeight(w) };
      for (const o of w.things) {
        if (feet.r > o.x + 0.05 && feet.l < o.x + o.w - 0.05) lowest = Math.min(lowest, feet.b - o.h);
      }
    }
    assert.equal(w.over, false);
    assert.ok(lowest > -0.05, `seed ${seed}: the walker's feet went ${lowest.toFixed(2)} into something`);
  }
  assert.ok(THINGS.bench.h > 0);
});

test('every cat has a name off the list, picked at random, and a crash into one says who', () => {
  const w = playFor(6, 90, 0.12);
  // Float over a few whole parks and collect every cat met, before it is tidied away.
  const seen = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const walk = newWalk(seed);
    walk.started = true;
    for (let i = 0; i < 60 * 40; i++) {
      walk.h = 3;
      walk.vy = 0;
      step(walk);
      for (const o of walk.things) if (o.kind === 'cat') seen.add(o);
    }
  }
  const all = [...seen];
  assert.ok(all.length > 5, `${all.length} cats`);
  assert.ok(all.every((c) => CAT_NAMES.includes(c.name)), 'every cat is named off the list');
  assert.ok(new Set(all.map((c) => c.name)).size >= 3, 'and not all the same name');
  assert.equal(w.things.filter((o) => o.kind !== 'cat').some((o) => o.name), false, 'only cats have names');
  // walk straight into the first cat
  const crash = newWalk(1);
  crash.started = true;
  crash.things = [{ kind: 'cat', x: 3, w: 0.9, h: 0.8, name: 'April' }];
  crash.nextAt = Infinity;
  for (let i = 0; i < 120 && !crash.hit; i++) step(crash);
  assert.equal(crash.hit && crash.hit.name, 'April');
  assert.equal(crash.lives, LIVES - 1, 'a life, not the walk');
});
