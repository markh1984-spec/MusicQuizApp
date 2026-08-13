/**
 * TEAM PLAY — several phones, one team, and the score is the AVERAGE.
 *
 * The averaging is the whole design and it is the host's own: a big team of
 * chancers must not be able to beat a small team who know their stuff. Add the
 * scores up instead and six people guessing beats two people who are right,
 * which is the opposite of a quiz.
 *
 * The other half of what is tested here is that a night WITHOUT teams takes
 * exactly the code path it always did — because this shipped the week of a
 * gig, and a feature nobody is using must not be able to break one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES } from '../src/engine.js';
import { teamScores, rankPlayers } from '../src/scoring.js';

const quiz = () => ({
  id: 'teams-test',
  title: 'A Team Test Quiz',
  rounds: [{
    title: 'Round One',
    type: 'text',
    questions: [
      { prompt: 'Q1?', options: ['right', 'wrong', 'wrong', 'wrong'], correctIndex: 0 },
      { prompt: 'Q2?', options: ['right', 'wrong', 'wrong', 'wrong'], correctIndex: 0 },
    ],
  }],
});

function game({ teamPlay = true } = {}) {
  let t = 1_000_000;
  const engine = new Engine({ quiz: quiz(), now: () => t });
  engine.state.teamPlay = teamPlay;
  return { engine, at: (ms) => { t = 1_000_000 + ms; }, set: (ms) => { t = ms; } };
}

// ------------------------------------------------------------- the arithmetic

test('A BIG TEAM OF CHANCERS CANNOT BEAT A SMALL TEAM WHO KNOW THEIR STUFF', () => {
  // Two who both scored 300; six of whom two scored 300 and four scored nothing.
  const teams = { small: { id: 'small', name: 'The Two' }, big: { id: 'big', name: 'The Six' } };
  const players = [
    { id: 'a', name: 'A', teamId: 'small', score: 300 },
    { id: 'b', name: 'B', teamId: 'small', score: 300 },
    ...['c', 'd'].map((id) => ({ id, name: id, teamId: 'big', score: 300 })),
    ...['e', 'f', 'g', 'h'].map((id) => ({ id, name: id, teamId: 'big', score: 0 })),
  ];
  const rows = teamScores(players, teams);
  const small = rows.find((r) => r.teamId === 'small');
  const big = rows.find((r) => r.teamId === 'big');
  assert.equal(small.score, 300);
  assert.equal(big.score, 100, 'the four passengers are zeros in the mean, not skipped');
  assert.ok(small.score > big.score, 'summing would have made the big team win 1200 to 600');
});

test('somebody on no team is a team of one, so the board is one kind of row', () => {
  const rows = teamScores(
    [{ id: 'solo', name: 'Solo', score: 250 }, { id: 'a', name: 'A', teamId: 't', score: 100 }],
    { t: { id: 't', name: 'A Team' } },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.id === 'solo').size, 1);
});

test('a tie is broken on total response time, and summing is kinder to a small team', () => {
  const teams = { x: { id: 'x', name: 'X' }, y: { id: 'y', name: 'Y' } };
  const rows = teamScores([
    { id: 'a', name: 'A', teamId: 'x', score: 200, totalResponseMs: 4000 },
    { id: 'b', name: 'B', teamId: 'x', score: 200, totalResponseMs: 4000 },
    { id: 'c', name: 'C', teamId: 'y', score: 200, totalResponseMs: 9000 },
    { id: 'd', name: 'D', teamId: 'y', score: 200, totalResponseMs: 9000 },
  ], teams);
  const [first] = rankPlayers(rows);
  assert.equal(first.teamId, 'x');
});

// ---------------------------------------------------------------- the engine

test('a team is made, joined, and shows on the board with its members', () => {
  const { engine } = game();
  const rob = engine.join({ name: 'Rob' }).id;
  const sam = engine.join({ name: 'Sam' }).id;
  const made = engine.makeTeam('The Quizzly Bears');
  assert.equal(made.ok, true);
  assert.equal(engine.joinTeam(rob, made.id).ok, true);
  assert.equal(engine.joinTeam(sam, made.id).ok, true);

  const board = engine.leaderboard();
  assert.equal(board.length, 1, 'two phones, one row');
  assert.equal(board[0].name, 'The Quizzly Bears');
  assert.equal(board[0].size, 2);
});

test('the same name twice is the same team, not two you cannot tell apart', () => {
  const { engine } = game();
  const first = engine.makeTeam('The Quizzly Bears');
  const again = engine.makeTeam('the quizzly bears');
  assert.equal(again.id, first.id);
  assert.equal(again.already, true);
});

test('a team name is tidied like a player name, and never word-filtered', () => {
  const { engine } = game();
  const made = engine.makeTeam('  Norfolk\n& Chance  ');
  assert.equal(engine.state.teams[made.id].name, 'Norfolk & Chance');
  assert.equal(engine.makeTeam('x'.repeat(60)).ok, true);
  assert.equal(Object.values(engine.state.teams).at(-1).name.length, 28);
  assert.equal(engine.makeTeam('   ').ok, false);
});

test('YOU CANNOT SWITCH TEAMS MID-QUESTION', () => {
  const { engine } = game();
  const rob = engine.join({ name: 'Rob' }).id;
  const winners = engine.makeTeam('Doing Well').id;
  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();

  const hop = engine.joinTeam(rob, winners);
  assert.equal(hop.ok, false);
  assert.equal(hop.reason, 'mid_question', 'otherwise you watch the tally and jump ship');

  engine.reveal();
  assert.equal(engine.joinTeam(rob, winners).ok, true, 'between questions is fine');
});

test('the phone is told where its TEAM stands, not where it personally stands', () => {
  const { engine, set } = game();
  const rob = engine.join({ name: 'Rob' }).id;
  const sam = engine.join({ name: 'Sam' }).id;
  const solo = engine.join({ name: 'Solo' }).id;
  const team = engine.makeTeam('Us Two').id;
  engine.joinTeam(rob, team);
  engine.joinTeam(sam, team);

  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();
  set(1_000_000 + 1000);
  engine.answer({ playerId: solo, optionIndex: 0 });   // solo gets it, fast
  engine.answer({ playerId: rob, optionIndex: 0 });    // Rob gets it
  // Sam never answers, so the team's average is half of Rob's.
  engine.reveal();

  const robView = engine.playerView(rob);
  const soloView = engine.playerView(solo);
  assert.equal(robView.teamPlay, true);
  assert.equal(robView.yourTeam, team);
  assert.equal(soloView.you.position, 1, 'the solo player is ahead of the half-empty team');
  assert.equal(robView.you.position, 2);
  assert.equal(robView.you.playerCount, 2, 'two rows on the board, not three phones');
});

test('the picker lists the teams and how many are in each', () => {
  const { engine } = game();
  const rob = engine.join({ name: 'Rob' }).id;
  const a = engine.makeTeam('A Team').id;
  engine.makeTeam('An Empty Team');
  engine.joinTeam(rob, a);
  const list = engine.playerView(rob).teams;
  assert.deepEqual(list.map((t) => [t.name, t.size]).sort(), [['A Team', 1], ['An Empty Team', 0]]);
});

test('it survives a crash, teams and all', () => {
  const { engine } = game();
  const rob = engine.join({ name: 'Rob' }).id;
  const team = engine.makeTeam('Still Here').id;
  engine.joinTeam(rob, team);
  const back = new Engine({ quiz: quiz(), state: JSON.parse(JSON.stringify(engine.state)), now: () => 1_000_000 });
  assert.equal(back.state.teamPlay, true);
  assert.equal(back.playerView(rob).yourTeam, team);
  assert.equal(back.leaderboard()[0].name, 'Still Here');
});

// ------------------------------------------------------ and a night without it

test('WITHOUT TEAM PLAY NOTHING CHANGES AT ALL', () => {
  const { engine } = game({ teamPlay: false });
  const rob = engine.join({ name: 'Rob' }).id;
  engine.join({ name: 'Sam' });
  const view = engine.playerView(rob);
  assert.equal(view.teamPlay, undefined, 'the payload does not grow a field it is not using');
  assert.equal(view.teams, undefined);
  assert.equal(view.yourTeam, undefined);
  // And the board is the individual one it has always been.
  assert.equal(engine.leaderboard().length, 2);
  assert.equal(engine.leaderboard()[0].size, undefined, 'not a team row');
});

test('a state written before teams existed plays as individuals', () => {
  const { engine } = game({ teamPlay: false });
  const rob = engine.join({ name: 'Rob' }).id;
  const old = JSON.parse(JSON.stringify(engine.state));
  delete old.teamPlay;
  delete old.teams;
  const back = new Engine({ quiz: quiz(), state: old, now: () => 1_000_000 });
  assert.equal(back.playerView(rob).teamPlay, undefined);
  assert.equal(back.leaderboard().length, 1);
});

test('teams cannot be created on a night that is not a team night', () => {
  // Found by probing a running server rather than in the unit tests: without
  // this a phone could write teams into an ordinary quiz's state. Harmless on
  // the board, which ignores them — and exactly the sort of thing that turns
  // up in an archive months later with nobody able to account for it.
  const { engine } = game({ teamPlay: false });
  const rob = engine.join({ name: 'Rob' }).id;
  assert.equal(engine.makeTeam('Sneaky').ok, false);
  assert.equal(engine.makeTeam('Sneaky').reason, 'not_team_play');
  assert.equal(engine.joinTeam(rob, 'anything').ok, false);
  assert.deepEqual(engine.state.teams, {});
});
