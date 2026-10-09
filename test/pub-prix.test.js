/**
 * PUB PRIX — the race the projector draws, decided on the server.
 *
 * `src/race.js` (who raced, who won, the drink), `public/assets/race-track.js`
 * (the physics, shared by the server, the projector and the phone), and the
 * two engines' wiring. `node scripts/pub-prix.mjs` drives it end to end.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trackLayout, courseFor, kartAt, newKart, stepKart, standings, bendAt, clampSteer, speedOf,
  LAP, RACE, LANES, COUNTDOWN_MS, MIN_TAP_MS, MAX_TAPS, AFTER_WINNER_MS, MAX_RACE_MS,
  BENDS, HALF, WALL, GRASS, STEP_MS,
} from '../public/assets/race-track.js';
import {
  openRace, steerRace, raceIsOver, finishRace, raceForScreen, raceForPlayer, raceTapEvent,
} from '../src/race.js';
import { Engine } from '../src/engine.js';
import { BingoGame } from '../src/bingo.js';

const T0 = 1_800_000_000_000;

// ------------------------------------------------------------- the track

test('the track never blocks every lane — there is always a way through', () => {
  for (let seed = 1; seed < 400; seed += 1) {
    const rows = new Map();
    for (const it of trackLayout(seed)) {
      if (!rows.has(it.p)) rows.set(it.p, new Set());
      if (it.kind === 'spill') rows.get(it.p).add(it.lane);
    }
    for (const lanes of rows.values()) assert.ok(lanes.size < LANES, `seed ${seed} blocks every lane`);
  }
});

test('nothing sits on the line, either side of it', () => {
  for (let seed = 1; seed < 100; seed += 1) {
    for (const it of trackLayout(seed)) assert.ok(it.p > 90 && it.p < LAP - 90, `seed ${seed}: ${it.p}`);
  }
});

test('one seed is one track — the server, the projector and the phone agree', () => {
  assert.deepEqual(trackLayout(42), trackLayout(42));
  assert.notDeepEqual(trackLayout(42), trackLayout(43));
});

// ------------------------------------------------------------- one kart

test('a kart sits on the grid until its phone taps once', () => {
  const course = courseFor(7);
  const still = kartAt(course, [], 1, T0, T0 + 30_000);
  assert.equal(still.d, 0);
  assert.equal(still.startedAt, null);
  const going = kartAt(course, [[T0 - 1000, 1]], 1, T0, T0 + 10_000);
  assert.ok(going.d > 0);
  assert.equal(going.startedAt, T0, 'a tap in the countdown starts it at GO');
});

test('a kart is the same whether it is stepped in one go or frame by frame', () => {
  const course = courseFor(11);
  const taps = [[T0 - 500, -1], [T0 + 4000, 1], [T0 + 9000, 0], [T0 + 15_000, -1], [T0 + 16_500, 0]];
  const once = kartAt(course, taps, 0, T0, T0 + 40_000);
  const frames = newKart(0);
  for (let t = T0; t <= T0 + 40_000; t += 17) stepKart(frames, course, taps, T0, t);
  stepKart(frames, course, taps, T0, T0 + 40_000); // the last frame lands exactly on the end
  assert.equal(frames.d, once.d);
  assert.equal(frames.hits, once.hits);
  assert.equal(frames.boosts, once.boosts);
  assert.equal(frames.x, once.x, 'and in the same place across the road');
});

test('a spilt pint slows a kart that drives through it, and one steered round misses it', () => {
  // On the start straight, before the first bend, so only the thumb moves the kart.
  const course = [{ at: 60, lane: 1, kind: 'spill' }, { at: 80, lane: 2, kind: 'boost' }];
  const through = kartAt(course, [[T0, 0]], 1, T0, T0 + 1800);
  assert.equal(through.hits, 1, 'straight through the middle of it');
  // Hold right from the off: across into the outside line in time for the boost.
  const round = kartAt(course, [[T0, 1], [T0 + 500, 0]], 1, T0, T0 + 1800);
  assert.equal(round.hits, 0, 'steered out of the way');
  assert.equal(round.boosts, 1, 'and onto the boost');
  assert.ok(round.d > through.d, 'which is faster');
});

// ------------------------------------------------------------- the steering

test('a held side moves the kart across; letting go holds the line on a straight', () => {
  const course = [];
  const left = kartAt(course, [[T0, -1]], 1, T0, T0 + 400);
  assert.ok(left.x < -0.8, `held left for 0.4s: ${left.x}`);
  const straight = kartAt(course, [[T0, 0]], 1, T0, T0 + 1500);
  assert.equal(straight.x, 0, 'no thumb, no bend: dead straight');
  assert.equal(clampSteer(-1), -1);
  assert.equal(clampSteer(7), 0, 'anything but left or right is straight');
  assert.equal(clampSteer('1'), 1);
});

test('a bend pushes you WIDE, and holding the inside keeps you on the tarmac', () => {
  const [a, b] = BENDS[0];
  assert.equal(bendAt(a - 1), 0);
  assert.equal(bendAt((a + b) / 2), 1, 'full push mid-bend');
  assert.equal(bendAt(LAP + (a + b) / 2), 1, 'the same bends every lap');
  // Wheel straight through the first bend: out onto the grass.
  const drift = kartAt([], [[T0, 0]], 1, T0, T0 + 6000);
  assert.ok(drift.x > HALF, `let go through a bend and you go wide: x=${drift.x}`);
  // Thumb on the inside for the first part of the bend, then off and on.
  const held = [];
  for (let t = 0; t < 8000; t += 500) held.push([T0 + 2000 + t, t % 1000 === 0 ? -1 : 0]);
  const fought = kartAt([], [[T0, 0], ...held], 1, T0, T0 + 8000);
  assert.ok(Math.abs(fought.x) <= HALF, `held the inside, stayed on: x=${fought.x}`);
  assert.ok(fought.d > drift.d, 'and staying on the tarmac is faster than the grass');
});

test('the grass costs speed and the wall holds you on the track', () => {
  const k = newKart(1);
  k.x = HALF + 0.1;
  assert.equal(speedOf(k, T0), GRASS);
  k.x = 0;
  assert.equal(speedOf(k, T0), 1);
  const wall = kartAt([], [[T0, 1]], 2, T0, T0 + 10_000);
  assert.equal(wall.x, WALL, 'held right for ten seconds: at the wall, never past it');
  assert.ok(wall.d > 0 && wall.d < 10 * 52 * 0.6, 'still moving, but slowly');
});

test('a whole race is the same race stepped at any frame rate', () => {
  const course = courseFor(23);
  const taps = [];
  for (let t = -1000; t < 120_000; t += 700) taps.push([T0 + t, [-1, 0, 1, 0][Math.floor(t / 700 + 2) % 4]]);
  const once = kartAt(course, taps, 0, T0, T0 + 130_000);
  const frames = newKart(0);
  for (let t = T0; t <= T0 + 130_000; t += STEP_MS * 3 + 7) stepKart(frames, course, taps, T0, t);
  stepKart(frames, course, taps, T0, T0 + 130_000);
  assert.deepEqual([frames.d, frames.x, frames.hits, frames.boosts, frames.finishedAt],
    [once.d, once.x, once.hits, once.boosts, once.finishedAt]);
});

test('a kart finishes three laps and is stamped with the exact moment', () => {
  const k = kartAt(courseFor(3), [[T0, 1]], 1, T0, T0 + MAX_RACE_MS);
  assert.equal(k.d, RACE);
  assert.ok(k.finishedAt > T0 && k.finishedAt < T0 + MAX_RACE_MS);
});

test('the running order: home first, then distance, then the grid', () => {
  const rows = [
    { n: 0, tie: 0.5, kart: { finishedAt: null, d: 900, startedAt: T0 } },
    { n: 1, tie: 0.5, kart: { finishedAt: T0 + 50_000, d: RACE, startedAt: T0 } },
    { n: 2, tie: 0.5, kart: { finishedAt: null, d: 0, startedAt: null } },
    { n: 3, tie: 0.5, kart: { finishedAt: T0 + 49_000, d: RACE, startedAt: T0 } },
  ];
  assert.deepEqual(standings(rows).map((r) => r.n), [3, 1, 0, 2]);
});

// ------------------------------------------------------------- the race

function race(players = 3) {
  const state = {};
  const list = Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `Team ${i}` }));
  let r = 0;
  const out = openRace(state, list, { now: T0, random: () => ((r += 0.37) % 1) });
  return { state, out };
}

test('two phones at least — one kart is a lap of honour', () => {
  assert.equal(race(1).out.reason, 'too_few');
  assert.equal(race(2).out.ok, true);
});

test('GO is after the countdown, and the starting lanes spread the grid', () => {
  const { state } = race(4);
  assert.equal(state.race.startsAt, T0 + COUNTDOWN_MS);
  assert.deepEqual(state.race.entrants.map((e) => e.lane), [0, 1, 2, 0]);
});

test('a tap is stamped with the server time, and refused when it should be', () => {
  const { state } = race(2);
  const at = T0 + 1000;
  const ok = steerRace(state, 'p0', 1, at);
  assert.deepEqual(ok, { ok: true, at, steer: 1, index: 0 });
  assert.equal(steerRace(state, 'p0', -1, at + MIN_TAP_MS - 1).reason, 'too_fast');
  assert.equal(steerRace(state, 'p0', 1, at + 500).same, true, 'the same steer again is no change');
  assert.equal(steerRace(state, 'nobody', 1, at).reason, 'not_racing');
  assert.equal(steerRace(state, 'p1', 9, at).steer, 0, 'anything but left or right is straight');
  const e = state.race.entrants[1];
  e.taps = Array.from({ length: MAX_TAPS }, (_, i) => [at + i * 100, i % 3]);
  assert.equal(steerRace(state, 'p1', 0, at + MAX_TAPS * 100 + 1000).reason, 'too_many');
});

test('it is over when every started kart is home, or ten seconds after the first', () => {
  const { state } = race(3);
  steerRace(state, 'p0', 1, T0);
  steerRace(state, 'p1', 1, T0);
  const home = kartAt(courseFor(state.race.seed), [[T0, 1]], 1, state.race.startsAt, T0 + MAX_RACE_MS).finishedAt;
  assert.equal(raceIsOver(state, home - 1000), false);
  assert.equal(raceIsOver(state, home + 100), true, 'both started karts drove the same race and are home');
  // One kart much slower: then the ten seconds after the winner decide it.
  const { state: s2 } = race(3);
  steerRace(s2, 'p0', 1, T0);
  steerRace(s2, 'p1', 1, s2.race.startsAt + 40_000);
  // From p0's OWN starting line — where you start across the road now matters.
  const first = kartAt(courseFor(s2.race.seed), [[T0, 1]], s2.race.entrants[0].lane, s2.race.startsAt, T0 + MAX_RACE_MS).finishedAt;
  assert.equal(raceIsOver(s2, first + AFTER_WINNER_MS - 100), false);
  assert.equal(raceIsOver(s2, first + AFTER_WINNER_MS + 100), true);
});

test('a kart that never started cannot win, and nobody started is nobody won', () => {
  const { state } = race(3);
  const out = finishRace(state, { now: T0 + 30_000, reward: 'A pint', newCode: () => 'CODE1234' });
  assert.equal(out.winner, null);
  assert.equal(state.vouchers, undefined, 'no drink for a race nobody drove');
});

test('the winner gets the drink, minted with no place so no phone says they won the QUIZ', () => {
  const { state } = race(3);
  steerRace(state, 'p2', 0, T0);
  const out = finishRace(state, { now: T0 + 30_000, reward: 'A pint', venue: 'The Flag', newCode: () => 'RACE0001' });
  assert.equal(out.winner.name, 'Team 2');
  const v = state.vouchers.RACE0001;
  assert.equal(v.winnerId, 'p2');
  assert.equal(v.race, true);
  assert.equal(v.place, null);
  assert.equal(v.reward, 'A pint');
  assert.equal(v.round, undefined, 'no round stamp — a bingo night never holds it back');
});

test('no prize on the list, no drink — but still a winner', () => {
  const { state } = race(2);
  steerRace(state, 'p0', 0, T0);
  const out = finishRace(state, { now: T0 + 30_000, reward: '', newCode: () => 'X' });
  assert.equal(out.winner.name, 'Team 0');
  assert.equal(state.vouchers, undefined);
});

test('RULE 3: the projector and every race event carry a kart NUMBER, never a player id', () => {
  const { state } = race(3);
  const tap = steerRace(state, 'p1', 2, T0 + 100);
  const ev = raceTapEvent(state, tap);
  assert.deepEqual(Object.keys(ev).sort(), ['at', 'id', 'n', 'steer']);
  assert.equal(ev.n, 1);
  finishRace(state, { now: T0 + 30_000, reward: 'A pint', newCode: () => 'SECRET01' });
  const wire = JSON.stringify(raceForScreen(state));
  for (const id of ['p0', 'p1', 'p2']) assert.ok(!wire.includes(`"${id}"`), `${id} on the projector`);
  assert.ok(!wire.includes('SECRET01'), 'the drink code never goes on the projector');
});

test('a phone sees its own kart and its own place, nobody else\'s taps', () => {
  const { state } = race(3);
  steerRace(state, 'p0', 2, T0);
  steerRace(state, 'p1', 0, T0);
  const v = raceForPlayer(state, 'p1');
  assert.equal(v.you.n, 1);
  assert.deepEqual(v.you.taps, [[T0, 0]]);
  assert.ok(!JSON.stringify(v).includes('"p0"'));
  finishRace(state, { now: T0 + 30_000 });
  assert.ok(raceForPlayer(state, 'p2').place >= 1);
  assert.equal(raceForPlayer(state, 'late').you, undefined, 'a phone that joined after the start is not in it');
});

// ------------------------------------------------------------- the engines

function quizEngine() {
  const quiz = {
    id: 't', title: 'T', questionSeconds: 20, showRules: false,
    rounds: [1, 2].map((n) => ({
      id: `r${n}`, type: 'text', title: `R${n}`,
      questions: [{ id: `q${n}`, prompt: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 }],
    })),
  };
  const clock = { t: T0 };
  const e = new Engine({ quiz, now: () => clock.t });
  e.state.rewards = ['A bottle', 'A pint'];
  const players = ['Ann', 'Bob', 'Cat'].map((name) => e.join({ name }));
  return { e, clock, players };
}

function toBoard(e) {
  for (let i = 0; i < 20 && e.state.phase !== 'round_board'; i += 1) {
    if (e.state.phase === 'lobby') e.start();
    else if (e.state.phase === 'question') e.reveal();
    else e.next();
  }
}

test('the quiz races at a round board and nowhere else', () => {
  const { e } = quizEngine();
  assert.equal(e.openRace().reason, 'not_a_break');
  toBoard(e);
  assert.equal(e.state.phase, 'round_board');
  assert.equal(e.openRace().ok, true);
  assert.equal(e.openRace().reason, 'racing', 'one race at a time');
});

test('opening a race takes the scoreboard down; the scoreboard takes the race down', () => {
  const { e, players } = quizEngine();
  toBoard(e);
  e.showScoreboard(true);
  e.openRace();
  assert.equal(e.state.scoreboard, false);
  e.steerRace(players[0].id, 1);
  e.showScoreboard(true);
  assert.equal(e.state.race, null, 'two things cannot be on one projector');
});

test('RULE 9: a move pays the leader and takes the race down before the next question', () => {
  const { e, clock, players } = quizEngine();
  toBoard(e);
  e.openRace();
  e.steerRace(players[1].id, 2);
  clock.t += COUNTDOWN_MS + 10_000;
  e.next();
  assert.equal(e.state.race, null);
  const drink = Object.values(e.state.vouchers || {}).find((v) => v.race);
  assert.ok(drink, 'the leader was paid on the way past');
  assert.equal(drink.reward, 'A pint', 'the LAST prize on the list');
  for (let i = 0; i < 4 && e.state.phase !== 'question'; i += 1) e.next();
  assert.equal(e.state.phase, 'question');
  assert.equal(e.screenView().race, undefined);
});

test('a race drink is never taken back by the quiz\'s own prize sums', () => {
  const { e, clock, players } = quizEngine();
  toBoard(e);
  e.openRace();
  e.steerRace(players[2].id, 0);
  clock.t += COUNTDOWN_MS + 5000;
  e.closeRace();
  const code = Object.values(e.state.vouchers).find((v) => v.race).code;
  e.finish();
  assert.ok(e.state.vouchers[code], 'still there after the final prizes are worked out');
  const phone = e.playerView(players[2].id);
  const held = (phone.vouchers || []).find((v) => v.code === code);
  if (held) assert.equal(held.place, null, 'and never reads as first place');
});

test('RULE 9, the photo vote: a SETTLED vote never stays over the next question', () => {
  const { e, players } = quizEngine();
  e.openPhotoVote([
    { id: 'a', url: '/a', teamName: 'Ann', playerId: players[0].id },
    { id: 'b', url: '/b', teamName: 'Bob', playerId: players[1].id },
  ]);
  e.start();
  assert.ok(e.screenView().photoVote, 'the result stays up over the round intro');
  for (let i = 0; i < 4 && e.state.phase !== 'question'; i += 1) e.next();
  assert.equal(e.state.phase, 'question');
  assert.equal(e.screenView().photoVote, undefined, 'and comes down for the question');
});

test('bingo races between rounds — at WON — and a move settles it', () => {
  let t = T0;
  const pack = { id: 'b', title: 'B', cardSize: 3,
    tracks: Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, title: `T${i}`, artist: 'A' })) };
  const g = new BingoGame({ pack, now: () => t, random: () => 0.3 });
  g.setRewards(['A pint']);
  g.state.stages = ['full'];
  g.syncTarget();
  const a = g.join({ name: 'Ann' });
  const b = g.join({ name: 'Bob' });
  g.start();
  assert.equal(g.openRace().reason, 'not_a_break', 'never over a card somebody is marking');
  for (const [i, id] of g.state.players[a.id].card.entries()) {
    g.call(id);
    g.mark({ playerId: a.id, index: i, marked: true });
  }
  g.claim(a.id);
  g.approveClaim(a.id);
  assert.equal(g.state.phase, 'won');
  assert.equal(g.openRace().ok, true);
  g.steerRace(b.id, 1);
  t += COUNTDOWN_MS + 8000;
  g.newRound();
  assert.equal(g.state.race, null);
  const drinks = Object.values(g.state.vouchers).filter((v) => v.race);
  assert.equal(drinks.length, 1);
  assert.equal(drinks[0].winnerId, b.id);
  assert.equal(g.playerView(b.id).vouchers.find((v) => v.race).race, true);
});
