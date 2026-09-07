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
  RANDOM_TEAM_NAMES, RANDOM_TEAM_TARGET, RANDOM_TEAM_MAX, MAX_TEAMS, dealInto,
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

/** Drive an engine to the first question, whatever the phase ladder is. */
function toQuestion(engine) {
  for (let i = 0; i < 6 && engine.state.phase !== 'question'; i += 1) engine.next();
  assert.equal(engine.state.phase, 'question', 'the walk to a question has changed');
}

/*
 * ONE CAUSE, SIX SYMPTOMS — `boardIdFor()` was threaded through the phone's
 * POSITION and nothing else.
 *
 * Every one of these was live for the whole of any team night, and none of
 * them throws: the app draws perfectly and says the wrong thing.
 */

test('THE PROJECTOR COUNTS PHONES IN BOTH HALVES OF "N of M answered"', () => {
  const engine = randomTeams();
  const phones = ['A', 'B', 'C', 'D', 'E'].map((n) => engine.join({ name: n }));
  toQuestion(engine);
  engine.answer({ playerId: phones[0].id, optionIndex: 1 });

  const screen = engine.screenView();
  assert.equal(screen.phoneCount, 5, 'five handsets are in the room');
  assert.ok(screen.playerCount < 5, 'and they are on fewer board rows than that');
  assert.equal(screen.answeredCount, 1);
  // `answeredCount` has always counted phones. Printed beside `playerCount` it
  // said "60 of 6 answered", six feet wide, in a dark pub.
});

test('…and an ordinary night sends no `phoneCount` at all', () => {
  const engine = engineOn();
  engine.join({ name: 'Rob' });
  assert.equal('phoneCount' in engine.screenView(), false,
    'a solo night must send the payload it always sent — pub-unchanged says IDENTICAL');
});

test("A PHONE'S OWN HEADER IS ITS TEAM'S ROW — score, key and position in one unit", () => {
  const engine = randomTeams();
  const a = engine.join({ name: 'Daves iPhone' });
  const b = engine.join({ name: 'Sues Android' });
  assert.equal(engine.state.players[a.id].teamId, engine.state.players[b.id].teamId);
  engine.state.players[a.id].score = 1390;
  engine.state.players[b.id].score = 0;

  const you = engine.playerView(a.id).you;
  const row = engine.leaderboard()[0];
  assert.equal(you.score, row.score, 'the header read 1,390 while the projector said 695');
  assert.equal(you.name, row.name, 'and it named the handset, not the table');
  // The board a phone is SENT, which is where `key` is minted.
  const shown = engine.screenView().leaderboard[0];
  assert.equal(you.key, shown.key,
    'the mini board matches on `key`, so a mismatch drew every phone its own team TWICE');
});

test('and a team score is frozen for the length of a question, like an individual one', () => {
  const engine = randomTeams();
  const a = engine.join({ name: 'A' });
  const b = engine.join({ name: 'B' });
  toQuestion(engine);

  const before = engine.playerView(a.id).you.score;
  engine.answer({ playerId: b.id, optionIndex: 1 });          // B is right
  assert.equal(engine.playerView(a.id).you.score, before,
    "a team average built from LIVE scores tells A that B got it, seconds before the reveal");
  engine.next();                                               // -> REVEAL
  assert.ok(engine.playerView(a.id).you.score > before, 'and the reveal is when it moves');
});

test("THE HOST'S PLAYING PANEL LISTS PHONES, so its controls have something to act on", () => {
  const engine = randomTeams();
  const a = engine.join({ name: 'Dave' });
  const b = engine.join({ name: 'Sue' });
  toQuestion(engine);
  engine.answer({ playerId: a.id, optionIndex: 1 });

  const rows = engine.hostView().players;
  assert.equal(rows.length, 2, 'two handsets, not one team row');
  for (const row of rows) {
    assert.ok(engine.state.players[row.id],
      'a `team:` id here means adjustScore, renamePlayer and removePlayer all answer ok:false in silence');
    assert.equal(row.connected, true, 'teamScores() builds no `connected`, so every team wore an "off" badge');
    assert.ok(row.team, 'and the row names the table, which is what the room knows');
  }
  assert.equal(rows.find((r) => r.id === a.id).answeredThisQuestion, true,
    'answers are keyed by PLAYER, so a team id could never get a tick');
  assert.equal(rows.find((r) => r.id === b.id).answeredThisQuestion, false);
  // The panel's idle count is `!answeredCount` over these rows, and `removeIdle`
  // removes phones — they have to be counting the same things.
  assert.equal(rows.filter((r) => !r.answeredCount).length, 1);
});

test('…and an ordinary night gets exactly the rows it always got', () => {
  const engine = engineOn();
  const rob = engine.join({ name: 'Rob' });
  engine.state.players[rob.id].score = 100;
  const [row] = engine.hostView().players;
  assert.deepEqual(Object.keys(row).sort(), [
    'answeredCount', 'answeredThisQuestion', 'connected', 'id', 'name',
    'position', 'score', 'wanderedCount',
  ], 'no new field on a solo night — a field on a view is a promise something draws it');
});

test('THE HOST IS TOLD WHO THE ROOM KNOWS — the fastest finger, whoPicked and who wandered', () => {
  const engine = randomTeams();
  const a = engine.join({ name: 'Daves iPhone' });
  const b = engine.join({ name: 'Sues Android' });
  toQuestion(engine);
  engine.answer({ playerId: a.id, optionIndex: 1 });           // correct

  const teamName = engine.leaderboard()[0].name;
  const host = engine.hostView();
  assert.equal(host.fastest.name, teamName,
    'the projector names the fastest finger under a board of teams — naming a handset names a stranger');
  assert.ok(host.whoPicked.options[1][0].name.startsWith(teamName),
    'and the mic line has to lead with the name on the wall');
  assert.ok(host.whoPicked.options[1][0].name.includes('Daves iPhone'),
    'with the handset kept, because the counts beside it are per phone');
  assert.ok(host.whoPicked.missing[0].startsWith(teamName));
  assert.equal(host.whoPicked.missing.length, 1, 'one phone let it go by');
  // The face stays the individual's: the slide is a photograph of the person
  // who was quickest, and a team has no face of its own.
  assert.notEqual(host.fastest.faceKey, engine.playerView(a.id).you.key,
    "the board's key is the team's; the fastest finger's is the person who was quickest");
  assert.ok(b.id);
});

/*
 * `makeTeam()` HAD NO GUARDS, AND THE CALLER'S CAME TOO LATE.
 *
 * `session.run('team')` made the team and then joined it, and only the JOIN
 * knew about random mode — so the phone got `{ok:false, reason:'random_teams'}`
 * back while the team it named was already written.
 */
test('A PHONE CANNOT NAME A TEAM ON A RANDOM NIGHT — and the refusal comes before the write', () => {
  const engine = randomTeams();
  engine.join({ name: 'Rob' });                      // one dealt team exists
  const before = Object.keys(engine.state.teams).length;

  const made = engine.makeTeam('Anything At All');
  assert.equal(made.ok, false);
  assert.equal(made.reason, 'random_teams');
  assert.equal(Object.keys(engine.state.teams).length, before,
    'arbitrary unfiltered text reached the projector, on the one screen this app never filters');
  // And an injected team has size 0, so `dealInto()` would put the next honest
  // joiner straight into it.
});

test('and there is a ceiling on how many teams a night may have', () => {
  const engine = engineOn({ teamPlay: true, teamMode: 'assigned' });
  for (let i = 0; i < MAX_TEAMS; i += 1) {
    assert.equal(engine.makeTeam(`Table ${i}`).ok, true, `team ${i} should be allowed`);
  }
  const over = engine.makeTeam('One too many');
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'too_many_teams');
  // Measured with no cap: 1,200 teams in 1.3 seconds from one phone, every SSE
  // payload from 0.7KB to 85KB, a flush to disk on each — at the lobby.
  assert.equal(Object.keys(engine.state.teams).length, MAX_TEAMS);
});

test('and the app can still deal itself a team on a random night', () => {
  const engine = randomTeams();
  const rob = engine.join({ name: 'Rob' });
  assert.ok(engine.state.players[rob.id].teamId, 'the dealer must not be refused by its own guard');
});

/*
 * A TEAM IS SETTLED AT A BOUNDARY — the old rule left three moments open.
 *
 * Scores are AVERAGED, so a table that sheds its weakest phone at the reveal
 * raises its own average and overtakes its rival with no question asked.
 */
test('A PHONE CANNOT CHANGE TEAM ONCE A QUESTION IS IN PLAY', () => {
  const engine = engineOn({ teamPlay: true, teamMode: 'assigned' });
  const rob = engine.join({ name: 'Rob' });
  const made = engine.makeTeam('The Bears');
  assert.equal(engine.joinTeam(rob.id, made.id).ok, true, 'the lobby is a boundary');

  toQuestion(engine);
  assert.equal(engine.joinTeam(rob.id, null).reason, 'mid_question');
  engine.state.question.closed = true;
  assert.equal(engine.joinTeam(rob.id, null).reason, 'mid_question',
    'the clock running out is not the question being over');

  engine.next();                                     // -> REVEAL
  assert.equal(engine.state.phase, 'reveal');
  assert.equal(engine.joinTeam(rob.id, null).reason, 'mid_question',
    'the reveal is exactly when the outcome is known and the average can be gamed');

  while (engine.state.phase !== 'round_board' && engine.state.phase !== 'final') engine.next();
  if (engine.state.phase === 'round_board') {
    assert.equal(engine.joinTeam(rob.id, null).ok, true, 'a round board IS a boundary');
  }
});

test('…and not at the final either, which would reorder a podium the room has watched', () => {
  const engine = engineOn({ teamPlay: true, teamMode: 'assigned' });
  const rob = engine.join({ name: 'Rob' });
  const made = engine.makeTeam('The Bears');
  engine.joinTeam(rob.id, made.id);
  engine.finish();
  assert.equal(engine.state.phase, 'final');
  assert.equal(engine.joinTeam(rob.id, null).reason, 'mid_question');
});
