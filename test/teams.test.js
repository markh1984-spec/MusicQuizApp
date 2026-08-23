/**
 * THE THREE WAYS TO PLAY A NIGHT — `src/teams.js` and the dealing the engine
 * does at join.
 *
 * The one that needs guarding hardest is the boundary: `solo` must keep the
 * code path it has always had, and `random` must not leave a door open for a
 * phone to change its own team afterwards, which would undo the whole mode.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RANDOM_TEAM_NAMES, RANDOM_TEAM_TARGET, RANDOM_TEAM_MAX, dealInto,
} from '../src/teams.js';
import { Engine } from '../src/engine.js';

function quiz() {
  return {
    id: 'test',
    title: 'Test Quiz',
    questionSeconds: 20,
    rounds: [{
      id: 'r1',
      type: 'text',
      title: 'Round One',
      questions: [{ id: 'q1', prompt: 'First?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 }],
    }],
  };
}

/** An engine with the clock and the randomness both pinned. */
function engineOn(state = {}, random = () => 0) {
  const engine = new Engine({ quiz: quiz(), now: () => 1_700_000_000_000, random });
  Object.assign(engine.state, state);
  return engine;
}

const randomTeams = (extra = {}) => engineOn({ teamPlay: true, teamMode: 'random', ...extra });

// ----------------------------------------------------------------- dealing

test('the first phone makes the first team', () => {
  assert.deepEqual(dealInto([]), { create: RANDOM_TEAM_NAMES[0] });
});

test('a team is filled to the target before another is started', () => {
  const one = [{ id: 'a', size: RANDOM_TEAM_TARGET - 1 }];
  assert.deepEqual(dealInto(one), { join: 'a' }, 'still room in it');
  const full = [{ id: 'a', size: RANDOM_TEAM_TARGET }];
  assert.deepEqual(dealInto(full), { create: RANDOM_TEAM_NAMES[1] }, 'full, so the Blues start');
});

test('THE SMALLEST TEAM WINS, which is what keeps them even', () => {
  const teams = [{ id: 'a', size: 3 }, { id: 'b', size: 1 }, { id: 'c', size: 2 }];
  assert.deepEqual(dealInto(teams), { join: 'b' });
});

test('a tie is broken at RANDOM, or the deal is just a queue', () => {
  // Two empty teams and a random that always picks the last candidate.
  const teams = [{ id: 'a', size: 1 }, { id: 'b', size: 1 }];
  assert.deepEqual(dealInto(teams, () => 0.99), { join: 'b' });
  assert.deepEqual(dealInto(teams, () => 0), { join: 'a' });
});

test('THE BOARD IS CAPPED — a big room fills the teams it has', () => {
  // Every team full and the maximum reached: nobody starts a seventh.
  const teams = RANDOM_TEAM_NAMES.map((n, i) => ({ id: `t${i}`, size: 40 }));
  assert.equal(teams.length, RANDOM_TEAM_MAX);
  assert.ok(dealInto(teams, () => 0).join, 'joins rather than creating');
});

test('a room grows into even teams', () => {
  const teams = [];
  for (let i = 0; i < 14; i += 1) {
    const d = dealInto(teams, () => 0);
    if (d.create) teams.push({ id: `t${teams.length}`, name: d.create, size: 1 });
    else teams.find((t) => t.id === d.join).size += 1;
  }
  assert.deepEqual(teams.map((t) => t.size), [4, 4, 4, 2]);
  assert.deepEqual(teams.map((t) => t.name), RANDOM_TEAM_NAMES.slice(0, 4));
});

// ------------------------------------------------------------ in the engine

test('SOLO IS UNTOUCHED — no teams, no team fields, nothing dealt', () => {
  /*
   * The rule the leaderboard's own note states: an ordinary pub night must
   * not take a new code path because a feature it is not using exists.
   */
  const engine = engineOn();
  const player = engine.join({ name: 'Team A' });
  assert.equal(player.teamId, undefined, 'nobody is dealt anywhere');
  // `teams` is declared empty in `freshState` and stays that way — nothing
  // ever writes into it on a solo night, which `makeTeam()`'s own guard is for.
  assert.deepEqual(engine.state.teams || {}, {});
  const view = engine.playerView(player.id);
  assert.equal(view.teamPlay, undefined);
  assert.equal(view.teamMode, undefined);
});

test('ASSIGNED still lets a phone name and join a team', () => {
  const engine = engineOn({ teamPlay: true, teamMode: 'assigned' });
  const player = engine.join({ name: 'Rob' });
  assert.equal(player.teamId, undefined, 'nothing is dealt in this mode');
  const made = engine.makeTeam('The Quizzly Bears');
  assert.equal(made.ok, true);
  assert.equal(engine.joinTeam(player.id, made.id).ok, true);
  assert.equal(engine.state.players[player.id].teamId, made.id);
  assert.equal(engine.playerView(player.id).teamMode, 'assigned');
});

test('RANDOM deals every phone as it joins, and says so on its payload', () => {
  const engine = randomTeams();
  const a = engine.join({ name: 'Rob' });
  assert.ok(a.teamId, 'dealt at the moment of joining');
  const team = engine.state.teams[a.teamId];
  assert.equal(team.name, RANDOM_TEAM_NAMES[0]);
  const view = engine.playerView(a.id);
  assert.equal(view.teamMode, 'random');
  assert.equal(view.yourTeam, a.teamId);
});

test('A DEALT TEAM CANNOT BE SWAPPED — the mode would be pointless otherwise', () => {
  const engine = randomTeams();
  const a = engine.join({ name: 'Rob' });
  // Fill the first team so a second one exists to try to hop into.
  for (let i = 0; i < RANDOM_TEAM_TARGET; i += 1) engine.join({ name: `P${i}` });
  const others = Object.keys(engine.state.teams).filter((id) => id !== a.teamId);
  assert.ok(others.length, 'a second team exists');
  const tried = engine.joinTeam(a.id, others[0]);
  assert.equal(tried.ok, false);
  assert.equal(tried.reason, 'random_teams');
  assert.equal(engine.state.players[a.id].teamId, a.teamId, 'still where they were put');
});

test('the room ends up in even teams, through the real join path', () => {
  const engine = randomTeams();
  for (let i = 0; i < 9; i += 1) engine.join({ name: `P${i}` });
  const sizes = engine.teamList().map((t) => t.size).sort((x, y) => y - x);
  assert.deepEqual(sizes, [4, 4, 1]);
});

test('A LATECOMER IS STILL DEALT — joining at question four lands somewhere', () => {
  const engine = randomTeams();
  engine.join({ name: 'Early' });
  engine.state.phase = 'question';
  const late = engine.join({ name: 'Late' });
  assert.ok(late.teamId, 'a phone joining mid-quiz is on a team');
});

test('the board is by TEAM on a random night, and averaged', () => {
  const engine = randomTeams();
  const a = engine.join({ name: 'A' });
  const b = engine.join({ name: 'B' });
  assert.equal(engine.state.players[a.id].teamId, engine.state.players[b.id].teamId,
    'the first two share a team');
  engine.state.players[a.id].score = 100;
  engine.state.players[b.id].score = 0;
  const board = engine.leaderboard();
  assert.equal(board.length, 1, 'one row for the team, not two for the people');
  assert.equal(board[0].score, 50, 'averaged, as a team night always has been');
  assert.equal(board[0].name, RANDOM_TEAM_NAMES[0]);
});

test('a night restored from before this existed reads as assigned', () => {
  // No `teamMode` at all, which is every night saved before today.
  const engine = engineOn({ teamPlay: true });
  delete engine.state.teamMode;
  const player = engine.join({ name: 'Rob' });
  assert.equal(player.teamId, undefined, 'nothing is dealt');
  assert.equal(engine.playerView(player.id).teamMode, 'assigned');
  assert.equal(engine.joinTeam(player.id, null).ok, true, 'and the picker still works');
});
