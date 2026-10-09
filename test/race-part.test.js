/**
 * PUB PRIX AS A PART OF THE NIGHT — `src/race-game.js`, `LAUNCHERS.race`.
 *
 * Asked for on 9 October 2026: *"what would be good is if it was like a game
 * type — you've got the card bingo and then you've got the music bingo. These
 * are game types that give a free drink."* So a running order can hold a
 * race the way it holds a bingo game. What has to hold:
 *
 *  - a part boundary carries the night through the race — the roster with its
 *    tokens, the teams, the venue, the vouchers — because the next part's
 *    options are read off the RACE's state (`nightWideOpts()`);
 *  - a race pays the part's OWN list from the top, one drink a race, the last
 *    again past the list, and a race nobody started spends nothing;
 *  - the grid is drawn on the track they will race on;
 *  - no player id or token on the projector (rule 3), faces by `faceKey`;
 *  - a night that ENDS on Pub Prix files as the quiz it was.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';
import { RaceGame, RACE_PHASES } from '../src/race-game.js';
import { faceKey } from '../src/engine.js';
import { COUNTDOWN_MS, MAX_RACE_MS } from '../public/assets/race-track.js';

function night() {
  const dir = mkdtempSync(join(tmpdir(), 'race-part-'));
  for (const id of ['quiz-a', 'quiz-b']) {
    writeFileSync(join(dir, `${id}.json`), JSON.stringify({
      id, title: `Quiz ${id}`, questionSeconds: 20,
      rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
        { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
      ] }],
    }));
  }
  const clock = { t: 1_700_000_000_000 };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store: { load: () => null, save: () => {}, flush: () => {}, write: () => {} },
    onPush: () => {},
    now: () => clock.t,
  });
  return { session, clock, dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const ORDER = [
  { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
  { kind: 'race', packId: 'pub-prix' },
  { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
];

/** Run one race in which `who` start their engines, to the server's own end. */
function race(session, clock, who) {
  const opened = session.run('raceOpen');
  assert.equal(opened.ok, true, JSON.stringify(opened));
  clock.t += COUNTDOWN_MS + 500;
  for (const p of who) assert.equal(session.runPlayerAction('race', { playerId: p.id, token: p.token, lane: 1 }).ok, true);
  clock.t += MAX_RACE_MS + 1000;
  assert.equal(session.engine.tickRace(), true, 'the server ends it by itself');
  return session.engine.state.race;
}

test('quiz → Pub Prix → quiz carries the night through the race', () => {
  const it = night();
  try {
    const { session, clock } = it;
    session.launchRunningOrder(ORDER, { venue: 'The Crown', venueId: 'v1', rewards: ['Fizz', 'Pint', 'Crisps'] });
    const ann = session.engine.join({ name: 'Ann' });
    const bob = session.engine.join({ name: 'Bob' });

    session.advanceOrder();
    assert.equal(session.kind, 'race');
    assert.equal(session.engine.state.phase, RACE_PHASES.LOBBY);
    assert.equal(session.engine.state.venue, 'The Crown', 'the race part has the venue');
    assert.deepEqual(session.engine.state.rewards, ['Fizz'], 'a race pays one drink — the venue\'s first, dealt from the top');
    const a = session.engine.state.players[ann.id];
    assert.equal(a.token, ann.token, 'a phone keeps its token across the boundary (rule 3)');

    race(session, clock, [ann]);
    const minted = Object.values(session.engine.state.vouchers).filter((v) => v.race);
    assert.equal(minted.length, 1);
    assert.equal(minted[0].reward, 'Fizz');
    assert.equal(minted[0].winnerId, ann.id, 'the only kart that started won');

    session.advanceOrder();
    assert.equal(session.kind, 'quiz');
    assert.equal(session.engine.state.venue, 'The Crown', 'and the quiz after it still has the venue');
    assert.equal(session.engine.state.venueId, 'v1');
    assert.ok(Object.values(session.engine.state.vouchers).some((v) => v.race && v.reward === 'Fizz'),
      'the race\'s drink is carried into the quiz, still in Ann\'s hand');
    assert.equal(session.engine.state.players[bob.id].token, bob.token, 'and Bob\'s phone is still Bob');
  } finally {
    it.done();
  }
});

test('each race pays the next drink, past the list the last again, and a race nobody started spends nothing', () => {
  const it = night();
  try {
    const { session, clock } = it;
    session.launch('race', 'pub-prix', { rewards: ['Fizz', 'Pint'] });
    const ann = session.engine.join({ name: 'Ann' });
    session.engine.join({ name: 'Bob' });
    assert.equal(session.hostView().nextPrize, 'Fizz');

    race(session, clock, []);
    assert.equal(session.engine.state.race.winner, null, 'nobody started, nobody won');
    assert.equal(session.hostView().nextPrize, 'Fizz', 'so the next race pays the same drink');

    race(session, clock, [ann]);
    assert.equal(session.hostView().nextPrize, 'Pint');
    race(session, clock, [ann]);
    assert.equal(session.hostView().nextPrize, 'Pint', 'past the list, the last drink again');
    race(session, clock, [ann]);
    const rewards = Object.values(session.engine.state.vouchers).map((v) => v.reward);
    assert.deepEqual(rewards, ['Fizz', 'Pint', 'Pint']);
  } finally {
    it.done();
  }
});

test('the grid is the track they race on, and the projector never carries an id or a token', () => {
  const it = night();
  try {
    const { session } = it;
    session.launch('race', 'pub-prix', { rewards: ['Fizz'] });
    const ann = session.engine.join({ name: 'Ann' });
    const bob = session.engine.join({ name: 'Bob' });
    const grid = session.screenView().race;
    assert.equal(grid.phase, 'grid');
    assert.deepEqual(grid.karts.map((k) => k.name), ['Ann', 'Bob']);
    assert.equal(grid.karts[0].face, faceKey(ann.id), 'a kart finds its driver\'s face by faceKey');
    const wire = JSON.stringify(session.screenView());
    for (const p of [ann, bob]) {
      assert.ok(!wire.includes(p.id), 'no player id on the projector (rule 3)');
      assert.ok(!wire.includes(p.token), 'no token on the projector (rule 3)');
    }
    session.run('raceOpen');
    assert.equal(session.screenView().race.seed, grid.seed, 'the grid showed the track they are racing on');
    const racing = JSON.stringify(session.screenView());
    for (const p of [ann, bob]) assert.ok(!racing.includes(p.id) && !racing.includes(p.token));
    assert.equal(session.playerView(ann.id).race.you.n, 0, 'the phone knows its own kart');
  } finally {
    it.done();
  }
});

test('a race part comes back from its saved state as it was (rule 7)', () => {
  const t = 1_700_000_000_000;
  const game = new RaceGame({ now: () => t });
  const ann = game.join({ name: 'Ann' });
  game.join({ name: 'Bob' });
  game.state.rewards = ['Fizz'];
  game.openRace();
  game.steerRace(ann.id, 2);
  const saved = JSON.parse(JSON.stringify(game.state));
  const back = new RaceGame({ state: saved, now: () => t });
  assert.equal(back.state.phase, RACE_PHASES.RACING);
  assert.equal(back.state.race.id, game.state.race.id);
  assert.deepEqual(back.state.race.entrants[0].taps, game.state.race.entrants[0].taps);
  assert.equal(back.state.nextSeed, saved.nextSeed);
});

test('a night that ENDS on Pub Prix files as the quiz it was, with the race named', () => {
  const it = night();
  try {
    const { session, clock, dir } = it;
    session.launchRunningOrder(ORDER.slice(0, 2), { venue: 'The Crown', rewards: ['Fizz', 'Pint', 'Crisps'] });
    const ann = session.engine.join({ name: 'Ann' });
    session.engine.join({ name: 'Bob' });
    session.advanceOrder();
    race(session, clock, [ann]);
    assert.equal(session.run('finish'), true);
    const files = readdirSync(join(dir, 'archive')).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1, 'filed once');
    const record = JSON.parse(readFileSync(join(dir, 'archive', files[0]), 'utf8'));
    assert.equal(record.kind, 'quiz', 'filed as the quiz, so the league can read its scores');
    assert.ok(record.parts.some((p) => p.kind === 'race'), 'with Pub Prix named in its parts');
    assert.ok(record.vouchers.some((v) => v.race && v.reward === 'Fizz'), 'and the race\'s drink on the record');
  } finally {
    it.done();
  }
});

test('a race part refuses what it should, in words', () => {
  const game = new RaceGame({ now: () => 1 });
  game.join({ name: 'Ann' });
  assert.equal(game.openRace().reason, 'too_few', 'one kart is a lap of honour, not a race');
  game.join({ name: 'Bob' });
  assert.equal(game.openRace().ok, true);
  assert.equal(game.openRace().reason, 'racing', 'one race at a time');
  assert.equal(game.arcadeScore().ok, false, 'the race is the game — no lobby game beside it');
  assert.deepEqual(game.removeIdlePlayers(), { ok: true, removed: 2 }, 'nobody started: both idle');
});
