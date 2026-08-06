/**
 * The question state machine and everything hanging off it.
 *
 * The clock is injected, so a "twenty second question" here takes no time at
 * all and the results are identical every run.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES, cleanTeamName } from '../src/engine.js';
import { POINTS_CORRECT, POINTS_PER_WHOLE_SECOND, POINTS_FIRST_CORRECT } from '../src/scoring.js';

const START = 1_700_000_000_000;

function makeQuiz() {
  return {
    id: 'test',
    title: 'Test Quiz',
    questionSeconds: 20,
    rounds: [
      {
        id: 'r1', type: 'text', title: 'Round One',
        questions: [
          { id: 'q1', prompt: 'First question?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
          { id: 'q2', prompt: 'Second question?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
        ],
      },
      {
        id: 'r2', type: 'image', title: 'Round Two',
        questions: [
          { id: 'q3', prompt: 'Whose face?', options: ['W', 'X', 'Y', 'Z'], correctIndex: 0, image: 'face.png' },
        ],
      },
      {
        id: 'r3', type: 'intro', title: 'Round Three',
        questions: [
          {
            id: 'q4', prompt: 'Name that intro', options: ['P', 'Q', 'R', 'S'], correctIndex: 3,
            cue: { title: 'Blue Monday', artist: 'New Order', from: '0:00' },
          },
        ],
      },
    ],
  };
}

/** An engine whose clock we drive by hand. */
function makeEngine(quiz = makeQuiz()) {
  const time = { now: START };
  const engine = new Engine({ quiz, now: () => time.now });
  return {
    engine,
    time,
    advance(ms) { time.now += ms; },
    at(ms) { time.now = START + ms; },
  };
}

/**
 * Straight to the first question, however many slides come before it.
 *
 * Written as a loop rather than a fixed number of next() calls so that adding
 * a slide to the front of a quiz — the rules, one day a sponsor card — does
 * not break every test that just wants a question open.
 */
function toFirstQuestion(engine) {
  engine.start();
  for (let i = 0; i < 10 && engine.state.phase !== PHASES.QUESTION; i++) engine.next();
  if (engine.state.phase !== PHASES.QUESTION) throw new Error('never reached a question');
}

function joinThree(engine) {
  return [
    engine.join({ name: 'Sofa King Good' }),
    engine.join({ name: 'Quizteama Aguilera' }),
    engine.join({ name: 'The Quizzly Bears' }),
  ];
}

// -------------------------------------------------------------- transitions

test('a quiz walks lobby -> rules -> intro -> question -> reveal -> board -> next round', () => {
  const { engine } = makeEngine();
  assert.equal(engine.state.phase, PHASES.LOBBY);

  // The rules are the first slide of every quiz, before any round.
  engine.next();
  assert.equal(engine.state.phase, PHASES.RULES);

  engine.next();
  assert.equal(engine.state.phase, PHASES.ROUND_INTRO);

  engine.next();
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.questionIndex, 0);

  engine.next();
  assert.equal(engine.state.phase, PHASES.REVEAL);

  engine.next();
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.questionIndex, 1);

  engine.next(); // reveal
  engine.next(); // last question of the round -> board
  assert.equal(engine.state.phase, PHASES.ROUND_BOARD);

  engine.next();
  assert.equal(engine.state.phase, PHASES.ROUND_INTRO);
  assert.equal(engine.state.roundIndex, 1);
});

test('the last round board leads to the final results, and stops there', () => {
  const { engine } = makeEngine();
  for (let i = 0; i < 40; i++) engine.next();
  assert.equal(engine.state.phase, PHASES.FINAL);
  assert.equal(engine.next(), false);
  assert.equal(engine.state.phase, PHASES.FINAL);
});

test('the quiz can be stopped mid-round, with the scores intact and Back to undo it', () => {
  const { engine } = makeEngine();
  const [a, b] = joinThree(engine);
  toFirstQuestion(engine);
  engine.answer({ playerId: a.id, optionIndex: 1 });   // right
  engine.answer({ playerId: b.id, optionIndex: 0 });   // wrong
  const scoreBefore = engine.state.players[a.id].score;
  assert.ok(scoreBefore > 0);

  assert.equal(engine.finish(), true);
  assert.equal(engine.state.phase, PHASES.FINAL);
  assert.equal(engine.state.question, null);
  assert.equal(engine.state.players[a.id].score, scoreBefore);
  assert.equal(engine.screenView().leaderboard[0].id, a.id);

  // Stopping twice does nothing, and Back is the way out of a mis-tap.
  assert.equal(engine.finish(), false);
  assert.equal(engine.back(), true);
  assert.equal(engine.state.phase, PHASES.ROUND_BOARD);
  assert.equal(engine.state.players[a.id].score, scoreBefore);
});

test('stopping the quiz takes the scoreboard and any advert down with it', () => {
  const { engine } = makeEngine();
  joinThree(engine);
  engine.start();
  engine.showScoreboard(true);
  assert.equal(engine.state.scoreboard, true);

  engine.finish();
  assert.equal(engine.state.scoreboard, false);
  assert.equal(engine.state.advert, null);
  assert.equal(engine.screenView().phase, PHASES.FINAL);
});

test('the clock is set from the server, not from anything a phone sends', () => {
  const { engine, at } = makeEngine();
  at(5_000);
  toFirstQuestion(engine);
  assert.equal(engine.state.question.startedAt, START + 5_000);
  assert.equal(engine.state.question.endsAt, START + 25_000);
  at(9_000);
  assert.equal(engine.msRemaining(), 16_000);
});

test('a question that has run out of time reports itself as expired', () => {
  const { engine, at } = makeEngine();
  toFirstQuestion(engine);
  at(19_999);
  assert.equal(engine.isExpired(), false);
  at(20_000);
  assert.equal(engine.isExpired(), true);
});

// ------------------------------------------------------------------ scoring

test('the first correct answer takes the bonus, a faster wrong one does not', () => {
  const { engine, at } = makeEngine();
  const [fast, slower] = joinThree(engine);
  toFirstQuestion(engine);

  // The button-masher is in first, but wrong.
  at(300);
  assert.deepEqual(engine.answer({ playerId: fast.id, optionIndex: 0 }), { ok: true, points: 0, correct: false, isFirstCorrect: false });

  // The team that actually knew answers three seconds later.
  at(3_000);
  const good = engine.answer({ playerId: slower.id, optionIndex: 1 });
  assert.equal(good.correct, true);
  assert.equal(good.isFirstCorrect, true);
  // 17 whole seconds left: 100 + 170 + 100
  assert.equal(good.points, 370);

  assert.equal(engine.state.players[fast.id].score, 0);
  assert.equal(engine.state.players[slower.id].score, 370);
});

test('only the first correct answer of the question gets the bonus', () => {
  const { engine, at } = makeEngine();
  const [a, b] = joinThree(engine);
  toFirstQuestion(engine);

  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  at(2_000);
  const second = engine.answer({ playerId: b.id, optionIndex: 1 });
  assert.equal(second.isFirstCorrect, false);
  assert.equal(second.points, 280); // 100 + 18 whole seconds, no bonus
});

test('a team gets one answer per question and cannot change its mind', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);

  at(1_000);
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 0 }).ok, true);
  at(2_000);
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'already_answered' });
  assert.equal(engine.state.players[a.id].score, 0);
});

test('answers are refused once the clock has run out', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(20_001);
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'too_late' });
});

test('answers are refused when no question is open', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'not_open' });
  toFirstQuestion(engine);
  engine.reveal();
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'not_open' });
});

test('nonsense from a phone is rejected rather than scored', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 9 }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: a.id, optionIndex: -1 }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 'one' }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 1.5 }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: 'nobody', optionIndex: 1 }).reason, 'unknown_player');
});

test('the fastest finger is the first CORRECT answer, not the first answer', () => {
  const { engine, at } = makeEngine();
  const [wrongFast, rightSlower] = joinThree(engine);
  toFirstQuestion(engine);
  at(500);
  engine.answer({ playerId: wrongFast.id, optionIndex: 3 });
  at(2_800);
  engine.answer({ playerId: rightSlower.id, optionIndex: 1 });
  engine.reveal();

  const fastest = engine.fastestFinger();
  assert.equal(fastest.name, 'Quizteama Aguilera');
  assert.equal(fastest.seconds, 2.8);
  assert.equal(fastest.points, 370);
});

test('with nobody correct there is no fastest finger', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 0 });
  engine.reveal();
  assert.equal(engine.fastestFinger(), null);
});

// -------------------------------------------------------- skip / redo / back

test('skipping a question takes back every point it awarded', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  assert.equal(engine.state.players[a.id].score, 390);

  engine.skipQuestion();
  assert.equal(engine.state.players[a.id].score, 0);
  assert.equal(engine.state.players[a.id].correctCount, 0);
  assert.equal(engine.state.players[a.id].answeredCount, 0);
  assert.equal(engine.state.questionIndex, 1);
  assert.equal(engine.state.phase, PHASES.QUESTION);
});

test('redoing a question wipes its points and starts the clock again', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();

  at(30_000);
  engine.redoQuestion();
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.questionIndex, 0);
  assert.equal(engine.state.players[a.id].score, 0);
  assert.equal(engine.state.question.startedAt, START + 30_000);
  // and they can answer it again
  at(31_000);
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 1 }).ok, true);
});

test('skipping the last question of a round goes to the round board', () => {
  const { engine } = makeEngine();
  toFirstQuestion(engine);
  engine.next(); // reveal q1
  engine.next(); // q2
  engine.skipQuestion();
  assert.equal(engine.state.phase, PHASES.ROUND_BOARD);
});

test('going back from a reveal reopens the same question, cleared', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();
  engine.back();
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.questionIndex, 0);
  assert.equal(engine.state.players[a.id].score, 0);
});

test('going back from a question returns to the previous reveal, scores intact', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine); // q1
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.next(); // reveal q1
  engine.next(); // q2 — one press too many

  engine.back();
  assert.equal(engine.state.phase, PHASES.REVEAL);
  assert.equal(engine.state.questionIndex, 0);
  // The points that question awarded are still there.
  assert.equal(engine.state.players[a.id].score, 390);
  assert.equal(engine.fastestFinger().name, 'Sofa King Good');
  // And the clock reads as finished rather than counting down again.
  assert.equal(engine.state.question.closed, true);
  assert.equal(engine.msRemaining(), null);
});

test('going back from the first question of a round returns to the round intro', () => {
  const { engine } = makeEngine();
  toFirstQuestion(engine); // q1
  engine.back();
  assert.equal(engine.state.phase, PHASES.ROUND_INTRO);
});

test('the host can jump straight to any question', () => {
  const { engine } = makeEngine();
  assert.equal(engine.goTo(2, 0), true);
  assert.equal(engine.state.roundIndex, 2);
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.goTo(9, 0), false);
  assert.equal(engine.goTo(0, 9), false);
});

// ------------------------------------------------------------------ players

test('rejoining with the same id keeps the score', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  const scoreBefore = engine.state.players[a.id].score;

  // Phone locks, browser reloads, they come back with the stored id.
  const back = engine.join({ playerId: a.id, name: 'Sofa King Good' });
  assert.equal(back.id, a.id);
  assert.equal(back.score, scoreBefore);
  assert.equal(engine.playerList().length, 3);
});

test('rejoining with a blank name keeps the name they had', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  engine.join({ playerId: a.id, name: '' });
  assert.equal(engine.state.players[a.id].name, 'Sofa King Good');
});

test('a team can rename itself by rejoining with a new name', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  engine.join({ playerId: a.id, name: 'New Name' });
  assert.equal(engine.state.players[a.id].name, 'New Name');
});

test('an unknown id is treated as a new team, not an error', () => {
  const { engine } = makeEngine();
  const player = engine.join({ playerId: 'not-a-real-id-at-all', name: 'Latecomers' });
  assert.equal(player.name, 'Latecomers');
  assert.equal(engine.playerList().length, 1);
});

test('latecomers can join partway through and are marked as such', () => {
  const { engine } = makeEngine();
  toFirstQuestion(engine);
  const late = engine.join({ name: 'Just Arrived' });
  assert.equal(late.joinedDuringQuiz, true);
  assert.equal(late.score, 0);
});

test('removing a team takes their answers with them', () => {
  const { engine, at } = makeEngine();
  const [a, b] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.answer({ playerId: b.id, optionIndex: 1 });

  engine.removePlayer(a.id);
  assert.equal(engine.state.players[a.id], undefined);
  assert.equal(engine.answersFor()[a.id], undefined);
  // and the team that is left keeps theirs
  assert.ok(engine.answersFor()[b.id]);
  assert.equal(engine.removePlayer('nobody'), false);
});

test('the host can nudge a score by hand', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  assert.equal(engine.adjustScore(a.id, 100), true);
  assert.equal(engine.state.players[a.id].score, 100);
  engine.adjustScore(a.id, -250);
  assert.equal(engine.state.players[a.id].score, -150);
  assert.equal(engine.adjustScore(a.id, 'lots'), false);
  assert.equal(engine.adjustScore('nobody', 100), false);
});

test('resetting scores keeps the teams but zeroes everything', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.resetScores();
  assert.equal(engine.state.players[a.id].score, 0);
  assert.equal(engine.playerList().length, 3);
  assert.deepEqual(engine.state.answers, {});
});

test('team names are tidied but never censored', () => {
  assert.equal(cleanTeamName('  Sofa   King   Good  '), 'Sofa King Good');
  assert.equal(cleanTeamName('a'.repeat(80)).length, 28);
  assert.equal(cleanTeamName(null), '');
  // Rude is fine. That is the point of a pub quiz.
  assert.equal(cleanTeamName('Norfolk & Chance'), 'Norfolk & Chance');
});

// -------------------------------------------------------------------- views
//
// These are the tests that matter most: the two-screens rule.

test('the big screen never receives the answer key before the reveal', () => {
  const { engine } = makeEngine();
  toFirstQuestion(engine);
  const view = engine.screenView();
  const asText = JSON.stringify(view);

  assert.equal(view.reveal, undefined);
  assert.equal(view.question.correctIndex, undefined);
  assert.equal(asText.includes('correctIndex'), false);
  assert.equal(asText.includes('correctText'), false);
});

test('ROUND 3: the track title and artist never reach the big screen', () => {
  const { engine } = makeEngine();
  engine.goTo(2, 0); // the intro round
  const question = engine.screenView();
  const reveal = (engine.reveal(), engine.screenView());
  const board = (engine.next(), engine.screenView());

  for (const [label, view] of [['question', question], ['reveal', reveal], ['board', board]]) {
    const asText = JSON.stringify(view);
    assert.equal(asText.includes('Blue Monday'), false, `track title leaked into the ${label} screen`);
    assert.equal(asText.includes('New Order'), false, `artist leaked into the ${label} screen`);
    assert.equal(asText.includes('cue'), false, `the cue object leaked into the ${label} screen`);
  }
});

test('ROUND 3: a Spotify link on the cue is host-only, like the rest of it', () => {
  const quiz = makeQuiz();
  const introRound = quiz.rounds[2];
  introRound.spotifyPlaylist = { id: 'pl1', url: 'https://open.spotify.com/playlist/pl1', uri: 'spotify:playlist:pl1' };
  introRound.questions[0].cue.spotifyUri = 'spotify:track:abc123';
  introRound.questions[0].cue.spotifyUrl = 'https://open.spotify.com/track/abc123';

  const engine = new Engine({ quiz, now: () => START });
  engine.goTo(2, 0);

  const screen = JSON.stringify(engine.screenView());
  assert.equal(screen.includes('spotify'), false, 'no spotify link reached the big screen');
  assert.equal(screen.includes('abc123'), false);
  assert.equal(screen.includes('pl1'), false);

  const host = engine.hostView();
  assert.equal(host.question.cue.spotifyUri, 'spotify:track:abc123');
  assert.equal(host.question.playlist.url, 'https://open.spotify.com/playlist/pl1');
});

test('ROUND 3: the host DOES get the cue, because that is the whole point', () => {
  const { engine } = makeEngine();
  engine.goTo(2, 0);
  const view = engine.hostView();
  assert.equal(view.question.cue.title, 'Blue Monday');
  assert.equal(view.question.cue.artist, 'New Order');
  assert.equal(view.question.correctIndex, 3);
});

test('the host can read ahead to the next question and its cue', () => {
  const { engine } = makeEngine();
  engine.goTo(1, 0); // last question of round 2
  const view = engine.hostView();
  assert.equal(view.upcoming.roundIndex, 2);
  assert.equal(view.upcoming.cue.title, 'Blue Monday');
});

test('phones get the options but never the question text', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  const view = engine.playerView(a.id);
  assert.deepEqual(view.options, ['A', 'B', 'C', 'D']);
  assert.equal(JSON.stringify(view).includes('First question?'), false);
  assert.equal(view.reveal, undefined);
});

test('a phone is not told whether it was right until the reveal', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });

  const during = engine.playerView(a.id);
  assert.equal(during.yourAnswer.optionIndex, 1);
  assert.equal(during.yourAnswer.correct, undefined);
  assert.equal(during.yourAnswer.points, undefined);

  engine.reveal();
  const after = engine.playerView(a.id);
  assert.equal(after.yourAnswer.correct, true);
  assert.equal(after.yourAnswer.points, 390);
});

test('a removed team is told, so their phone can start again', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  engine.removePlayer(a.id);
  assert.equal(engine.playerView(a.id).kicked, true);
});

// ---- Being forgotten is not the same as being thrown out.
//
// Both used to send `kicked`, which wipes the team name off the phone and puts
// up "you were removed from the quiz". That is right when the host removed
// somebody and wrong every other time — and every other time is a lost game:
// a redeploy, a restart on a host with no permanent disk, or a fresh game
// launched over the top of a full lobby. A room being told it was thrown out
// mid-question, sixty phones at once, is the failure this prevents.

test('a phone the server has never heard of is asked to rejoin, not thrown out', () => {
  const { engine } = makeEngine();
  joinThree(engine);
  const view = engine.playerView('abcdef123456');
  assert.equal(view.kicked, undefined);
  assert.equal(view.rejoin, true);
});

test('a game that lost its memory asks everyone back rather than kicking them', () => {
  // What a restart with no saved state looks like: same phones, new engine.
  const first = makeEngine().engine;
  const [a, b] = joinThree(first);

  const fresh = makeEngine().engine;
  for (const id of [a.id, b.id]) {
    const view = fresh.playerView(id);
    assert.equal(view.rejoin, true, 'asked back');
    assert.equal(view.kicked, undefined, 'not told they were removed');
  }
});

test('rejoining after being forgotten keeps the team name', () => {
  const first = makeEngine().engine;
  const [a] = joinThree(first);

  const fresh = makeEngine().engine;
  const back = fresh.join({ playerId: a.id, name: a.name });
  assert.equal(back.id, a.id, 'same phone, same id');
  assert.equal(back.name, a.name);
  assert.equal(fresh.playerView(a.id).rejoin, undefined);
});

test('a removal survives a reload, so a removed team is not silently let back in', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  engine.removePlayer(a.id);

  // The removal is part of the saved state, not something held in memory.
  const onDisk = JSON.parse(JSON.stringify(engine.state));
  const reloaded = new Engine({ quiz: makeQuiz(), state: onDisk, now: () => START });
  assert.equal(reloaded.playerView(a.id).kicked, true);
});

test('a removed team that joins again is a team again, not permanently barred', () => {
  // Removing is for tidying up a duplicate or a name thought better of. It is
  // not a ban, and the same phone has to be able to come back.
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  engine.removePlayer(a.id);
  assert.equal(engine.playerView(a.id).kicked, true);

  engine.join({ playerId: a.id, name: 'Back Again' });
  const view = engine.playerView(a.id);
  assert.equal(view.kicked, undefined);
  assert.equal(view.you.name, 'Back Again');
});

test('the removed list cannot grow without bound over a long night', () => {
  const { engine } = makeEngine();
  for (let i = 0; i < 260; i++) {
    const p = engine.join({ name: `Team ${i}` });
    engine.removePlayer(p.id);
  }
  assert.ok(engine.state.removed.length <= 200, engine.state.removed.length);
  // The most recent removals are the ones that still matter.
  const last = engine.join({ name: 'Last' });
  engine.removePlayer(last.id);
  assert.equal(engine.playerView(last.id).kicked, true);
});

test('the picture round tells the screen how to zoom, and captions itself', () => {
  const { engine } = makeEngine();
  engine.goTo(1, 0);
  const view = engine.screenView();
  assert.equal(view.question.image, '/quiz-images/face.png');
  assert.match(view.question.imageCaption, /illustration/i);
  assert.ok(view.question.zoomFrom > view.question.zoomTo);
});

test('the reveal tally shows how the room voted', () => {
  const { engine, at } = makeEngine();
  const [a, b, c] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.answer({ playerId: b.id, optionIndex: 1 });
  engine.answer({ playerId: c.id, optionIndex: 3 });
  engine.reveal();
  assert.deepEqual(engine.screenView().reveal.tally, [0, 2, 0, 1]);
});

// -------------------------------------------------------------- persistence

test('a crash mid-quiz comes back with the scores and the players intact', () => {
  const { engine, at } = makeEngine();
  const [a, b] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.answer({ playerId: b.id, optionIndex: 0 });
  engine.reveal();
  engine.next(); // on to question two

  // The process dies here. All we have is what was written to disk.
  const onDisk = JSON.parse(JSON.stringify(engine.state));
  const revived = new Engine({ quiz: makeQuiz(), state: onDisk, now: () => START + 5_000 });

  assert.equal(revived.state.phase, PHASES.QUESTION);
  assert.equal(revived.state.questionIndex, 1);
  assert.equal(revived.playerList().length, 3);
  assert.equal(revived.state.players[a.id].score, 390);
  assert.equal(revived.state.players[a.id].name, 'Sofa King Good');
  // and the quiz carries on rather than restarting
  assert.equal(revived.answer({ playerId: b.id, optionIndex: 2 }).ok, true);
});

test('a restored state pointing at a question that has since been deleted is clamped', () => {
  const quiz = makeQuiz();
  const state = Engine.freshState(quiz);
  state.roundIndex = 7;
  state.questionIndex = 42;
  const engine = new Engine({ quiz, state });
  assert.equal(engine.state.roundIndex, 2);
  assert.equal(engine.state.questionIndex, 0);
});

test('every change bumps the version, so clients can spot a missed update', () => {
  const { engine } = makeEngine();
  const before = engine.state.version;
  engine.join({ name: 'Someone' });
  assert.ok(engine.state.version > before);
});

test('the results export has the leaderboard and the questions asked', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();

  const results = engine.results();
  assert.equal(results.quizTitle, 'Test Quiz');
  assert.equal(results.leaderboard[0].name, 'Sofa King Good');
  assert.equal(results.leaderboard[0].score, 390);
  assert.equal(results.questions.length, 1);
  assert.equal(results.questions[0].correctCount, 1);
});

// ============================================================ pick-them-all
//
// The fourth round type: several answers are right and you lock in all of
// them. Part marks, but you must pick exactly as many as the room was told,
// so nobody can cover the board and still score.

function multiQuiz() {
  return {
    id: 'multi', title: 'Multi Quiz',
    rounds: [{
      id: 'r1', type: 'multi', title: 'Pick them all',
      questions: [{
        id: 'm1',
        prompt: 'Which three were UK number ones?',
        options: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
        correctIndexes: [0, 2, 4],
        answerNote: 'Three of them topped the chart.',
      }],
    }],
  };
}

function multiEngine() {
  const made = makeEngine(multiQuiz());
  toFirstQuestion(made.engine);
  return made;
}

test('locking in every right answer scores the lot', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(3_000);
  const r = engine.answer({ playerId: a.id, optionIndexes: [4, 0, 2] });
  assert.equal(r.ok, true);
  assert.equal(r.correct, true);
  assert.equal(r.gotRight, 3);
  assert.equal(r.isFirstCorrect, true);
  // 17 whole seconds left: 100 + 170, all of it, plus the 100 bonus.
  assert.equal(r.points, 370);
});

test('part marks: two of three is two thirds of what it was worth', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(3_000);
  const r = engine.answer({ playerId: a.id, optionIndexes: [0, 2, 1] });
  assert.equal(r.correct, false, 'not a complete answer');
  assert.equal(r.gotRight, 2);
  // Two thirds of (100 + 170), and no bonus for a partial answer.
  assert.equal(r.points, Math.round((2 / 3) * 270));
});

test('a partial answer never takes the bonus off somebody who knew them all', () => {
  const { engine, at } = multiEngine();
  const [fast, slower] = joinThree(engine);

  at(500);
  const partial = engine.answer({ playerId: fast.id, optionIndexes: [0, 2, 1] });
  assert.equal(partial.isFirstCorrect, false);

  at(4_000);
  const full = engine.answer({ playerId: slower.id, optionIndexes: [0, 2, 4] });
  assert.equal(full.isFirstCorrect, true, 'the bonus waits for a complete answer');
});

test('picking none of them scores nothing', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(3_000);
  const r = engine.answer({ playerId: a.id, optionIndexes: [1, 3, 5] });
  assert.equal(r.points, 0);
  assert.equal(r.correct, false);
});

test('you cannot cover the board — it has to be exactly the number asked for', () => {
  const { engine, at } = multiEngine();
  const [a, b] = joinThree(engine);
  at(1_000);

  // All six would contain every right answer. Refused.
  const all = engine.answer({ playerId: a.id, optionIndexes: [0, 1, 2, 3, 4, 5] });
  assert.equal(all.ok, false);
  assert.equal(all.reason, 'wrong_count');
  assert.equal(all.wanted, 3);

  // Too few is refused as well — you commit to three or you do not answer.
  assert.equal(engine.answer({ playerId: b.id, optionIndexes: [0] }).reason, 'wrong_count');
  assert.equal(engine.state.players[a.id].score, 0);
});

test('the same option twice does not count as two picks', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(1_000);
  // Three entries, but only two distinct — that is a two-pick answer.
  assert.equal(engine.answer({ playerId: a.id, optionIndexes: [0, 0, 2] }).reason, 'wrong_count');
});

test('an option that does not exist is refused', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(1_000);
  assert.equal(engine.answer({ playerId: a.id, optionIndexes: [0, 2, 99] }).reason, 'bad_option');
});

test('still one answer per team, and no changing your mind', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(1_000);
  assert.equal(engine.answer({ playerId: a.id, optionIndexes: [0, 2, 4] }).ok, true);
  at(2_000);
  assert.equal(engine.answer({ playerId: a.id, optionIndexes: [1, 3, 5] }).reason, 'already_answered');
});

test('THE TWO-SCREENS RULE HOLDS: the projector is told how many, never which', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndexes: [0, 2, 4] });

  const screen = engine.screenView();
  assert.equal(screen.question.pickCount, 3, 'the room is told to pick three');
  assert.equal(screen.question.correctIndexes, undefined);
  assert.equal(screen.question.correctIndex, undefined);
  assert.equal(JSON.stringify(screen).includes('correctIndexes'), false);

  // The host has the answer key, as they must.
  const host = engine.hostView();
  assert.deepEqual(host.question.correctIndexes, [0, 2, 4]);
  assert.equal(host.question.correctText, 'One, Three, Five');
  assert.equal(host.question.pickCount, 3);
});

test('a phone is told how many to pick, and not which', () => {
  const { engine } = multiEngine();
  const [a] = joinThree(engine);
  const view = engine.playerView(a.id);
  assert.equal(view.pickCount, 3);
  assert.equal(view.multi, true);
  assert.equal(view.options.length, 6);
  assert.equal(view.prompt, undefined, 'still no question text on the phone');
  assert.equal(JSON.stringify(view).includes('correctIndexes'), false);
});

test('the reveal names every right answer, on both screens', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndexes: [0, 2, 1] });
  engine.reveal();

  const screen = engine.screenView();
  assert.deepEqual(screen.reveal.correctIndexes, [0, 2, 4]);
  assert.equal(screen.reveal.correctText, 'One, Three, Five');

  // And the player is told how they did, in part-marks terms.
  const mine = engine.playerView(a.id);
  assert.equal(mine.yourAnswer.gotRight, 2);
  assert.equal(mine.yourAnswer.outOf, 3);
  assert.deepEqual(mine.reveal.correctIndexes, [0, 2, 4]);
});

test('the tally counts every pick, not every player', () => {
  const { engine, at } = multiEngine();
  const [a, b] = joinThree(engine);
  at(1_000);
  engine.answer({ playerId: a.id, optionIndexes: [0, 2, 4] });
  engine.answer({ playerId: b.id, optionIndexes: [0, 1, 2] });
  engine.reveal();

  const tally = engine.screenView().reveal.tally;
  assert.equal(tally[0], 2, 'both picked One');
  assert.equal(tally[1], 1);
  assert.equal(tally[2], 2);
  assert.equal(tally[4], 1);
  assert.equal(tally.reduce((n, x) => n + x, 0), 6, 'two teams, three picks each');
});

test('a pick-them-all round survives a crash with its answers intact', () => {
  const { engine, at } = multiEngine();
  const [a] = joinThree(engine);
  at(2_000);
  engine.answer({ playerId: a.id, optionIndexes: [0, 2, 4] });
  const score = engine.state.players[a.id].score;

  const onDisk = JSON.parse(JSON.stringify(engine.state));
  const revived = new Engine({ quiz: multiQuiz(), state: onDisk, now: () => START + 5_000 });
  assert.equal(revived.state.players[a.id].score, score);
  revived.reveal();
  assert.deepEqual(revived.screenView().reveal.correctIndexes, [0, 2, 4]);
});

// ================================================== the rules, and the scores
//
// Two things the host asked for that must not disturb the quiz: a rules slide
// at the front, and a leaderboard he can throw up mid-round every few
// questions without losing his place.

test('the rules are the first slide, before any round', () => {
  const { engine } = makeEngine();
  engine.start();
  assert.equal(engine.state.phase, PHASES.RULES);

  const view = engine.screenView();
  assert.ok(view.rules, 'the screen gets something to draw');
  assert.equal(view.rules.title, 'Test Quiz');

  engine.next();
  assert.equal(engine.state.phase, PHASES.ROUND_INTRO);
  assert.equal(engine.state.roundIndex, 0);
});

test('the rules quote the real scoring, so the screen cannot promise a lie', () => {
  const { engine } = makeEngine();
  engine.start();
  const { scoring } = engine.screenView().rules;
  // Straight from scoring.js, never typed out by hand.
  assert.deepEqual(scoring.map((r) => r.big), [
    String(POINTS_CORRECT),
    `+${POINTS_PER_WHOLE_SECOND}`,
    `+${POINTS_FIRST_CORRECT}`,
  ]);
});

test('the rules only mention rounds this quiz actually has', () => {
  const { engine } = makeEngine();
  engine.start();
  const how = engine.screenView().rules.how.join(' ');
  assert.match(how, /picture round/i, 'this quiz has one');
  assert.match(how, /intro/i);
  assert.equal(/pick them all/i.test(how), false, 'and no pick-them-all round to mention');

  // A quiz with one gets told about it.
  const multi = makeEngine(multiQuiz()).engine;
  multi.start();
  assert.match(multi.screenView().rules.how.join(' '), /pick them all/i);
});

test('a pack can turn the rules off', () => {
  const quiz = makeQuiz();
  quiz.showRules = false;
  const { engine } = makeEngine(quiz);
  engine.start();
  assert.equal(engine.state.phase, PHASES.ROUND_INTRO, 'straight to round one');
});

test('back from the first round returns to the rules', () => {
  const { engine } = makeEngine();
  engine.start();
  engine.next();
  assert.equal(engine.state.phase, PHASES.ROUND_INTRO);
  engine.back();
  assert.equal(engine.state.phase, PHASES.RULES);
  engine.back();
  assert.equal(engine.state.phase, PHASES.LOBBY);
});

test('the scoreboard goes up without moving the quiz an inch', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(2_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();

  const where = { phase: engine.state.phase, round: engine.state.roundIndex, question: engine.state.questionIndex };

  assert.deepEqual(engine.showScoreboard(true), { ok: true, scoreboard: true });
  assert.equal(engine.screenView().scoreboard, true);
  assert.ok(engine.screenView().leaderboard.length, 'and something to show');
  // Nothing about the quiz moved.
  assert.deepEqual(
    { phase: engine.state.phase, round: engine.state.roundIndex, question: engine.state.questionIndex },
    where,
  );

  engine.showScoreboard(false);
  assert.equal(engine.screenView().scoreboard, false);
  assert.deepEqual(
    { phase: engine.state.phase, round: engine.state.roundIndex, question: engine.state.questionIndex },
    where,
    'and it comes back to exactly where it was',
  );
});

test('the scoreboard is refused over a live question', () => {
  const { engine } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  const result = engine.showScoreboard(true);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'question_live');
  assert.equal(engine.screenView().scoreboard, false, 'the question stays on screen');

  // Once revealed it is fine — that is when it gets used.
  engine.reveal();
  assert.equal(engine.showScoreboard(true).ok, true);
});

test('moving on takes the scoreboard down — a question can never hide behind it', () => {
  const { engine, at } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.reveal();
  engine.showScoreboard(true);
  assert.equal(engine.state.scoreboard, true);

  engine.next(); // on to the next question
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.scoreboard, false, 'down automatically');
  assert.equal(engine.screenView().scoreboard, false);
});

test('the host can see whether the scoreboard is up, and whether it is allowed', () => {
  const { engine } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  assert.deepEqual(engine.hostView().scoreboard, { on: false, allowed: false }, 'not over a live question');

  engine.reveal();
  assert.deepEqual(engine.hostView().scoreboard, { on: false, allowed: true });
  engine.showScoreboard(true);
  assert.deepEqual(engine.hostView().scoreboard, { on: true, allowed: true });
});

test('the scoreboard survives a crash, because it is part of the state', () => {
  const { engine, at } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.reveal();
  engine.showScoreboard(true);

  const onDisk = JSON.parse(JSON.stringify(engine.state));
  const revived = new Engine({ quiz: makeQuiz(), state: onDisk, now: () => START + 2_000 });
  assert.equal(revived.screenView().scoreboard, true);
});

test('THE TWO-SCREENS RULE HOLDS on the rules slide too', () => {
  // It is the first thing on the projector, so it is worth being sure it
  // carries nothing from the questions with it.
  const { engine } = makeEngine();
  engine.start();
  const screen = JSON.stringify(engine.screenView());
  assert.equal(screen.includes('correctIndex'), false);
  assert.equal(screen.includes('Blue Monday'), false, 'no round 3 cue');
});

// ---- Advertising slides, over the quiz but never moving it.

test('an advert goes up without moving the quiz, and comes down on its own', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  toFirstQuestion(engine);
  at(2_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();

  // The engine holds only which slide is up; the words are looked up when a
  // view is built, so editing a venue's offer changes the screen at once.
  engine.advertLookup = () => ({
    pack: { venue: 'The Crown' },
    slide: { heading: 'PIZZA — 2 FOR 1', body: 'Till 10.', say: 'Mention the pizza' },
  });

  const where = { phase: engine.state.phase, round: engine.state.roundIndex, question: engine.state.questionIndex };
  assert.equal(engine.showAdvert({ packId: 'the-crown', slideId: 's1' }).ok, true);

  const screen = engine.screenView();
  assert.equal(screen.advert.heading, 'PIZZA — 2 FOR 1');
  assert.equal(screen.advert.venue, 'The Crown');
  assert.deepEqual(
    { phase: engine.state.phase, round: engine.state.roundIndex, question: engine.state.questionIndex },
    where,
    'the quiz has not moved',
  );

  engine.next();
  assert.equal(engine.state.advert, null, 'onwards takes it down');
  assert.equal(engine.screenView().advert, undefined);
});

test('THE TWO-SCREENS RULE: the host gets the mic line, the projector does not', () => {
  const { engine, at } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.reveal();
  engine.advertLookup = () => ({
    pack: { venue: 'The Crown' },
    slide: { heading: 'PIZZA', body: 'Till 10.', say: 'Push the pizza deal, mention the kitchen closes at ten' },
  });
  engine.showAdvert({ packId: 'the-crown', slideId: 's1' });

  const screen = JSON.stringify(engine.screenView());
  assert.equal(screen.includes('Push the pizza deal'), false, 'the mic line is not on the projector');

  const host = engine.hostView();
  assert.match(host.advert.say, /Push the pizza deal/);
});

test('an advert is refused over a live question', () => {
  const { engine } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  const result = engine.showAdvert({ packId: 'the-crown', slideId: 's1' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'question_live');
  assert.ok(!engine.state.advert, 'nothing went up');
});

test('the scoreboard and an advert are never both up', () => {
  const { engine, at } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.reveal();
  engine.advertLookup = () => ({ pack: {}, slide: { heading: 'PIZZA' } });

  engine.showAdvert({ packId: 'p', slideId: 's1' });
  engine.showScoreboard(true);
  assert.equal(engine.state.advert, null, 'the scores replace the advert');

  engine.showAdvert({ packId: 'p', slideId: 's1' });
  assert.equal(engine.state.scoreboard, false, 'and the advert replaces the scores');
});

test('a slide deleted while it is on screen does not break the projector', () => {
  const { engine, at } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.reveal();
  engine.advertLookup = () => null; // the set was deleted underneath it
  engine.showAdvert({ packId: 'gone', slideId: 's1' });

  assert.doesNotThrow(() => engine.screenView());
  assert.equal(engine.screenView().advert, undefined, 'it simply shows the quiz');
});

test('taking the advert down needs no arguments', () => {
  const { engine, at } = makeEngine();
  joinThree(engine);
  toFirstQuestion(engine);
  at(1_000);
  engine.reveal();
  engine.advertLookup = () => ({ pack: {}, slide: { heading: 'PIZZA' } });
  engine.showAdvert({ packId: 'p', slideId: 's1' });
  assert.equal(engine.showAdvert(null).ok, true);
  assert.equal(engine.state.advert, null);
});
