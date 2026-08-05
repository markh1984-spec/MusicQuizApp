/**
 * The question state machine and everything hanging off it.
 *
 * The clock is injected, so a "twenty second question" here takes no time at
 * all and the results are identical every run.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES, cleanTeamName } from '../src/engine.js';

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

function joinThree(engine) {
  return [
    engine.join({ name: 'Sofa King Good' }),
    engine.join({ name: 'Quizteama Aguilera' }),
    engine.join({ name: 'The Quizzly Bears' }),
  ];
}

// -------------------------------------------------------------- transitions

test('a quiz walks lobby -> intro -> question -> reveal -> board -> next round', () => {
  const { engine } = makeEngine();
  assert.equal(engine.state.phase, PHASES.LOBBY);

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

test('the clock is set from the server, not from anything a phone sends', () => {
  const { engine, at } = makeEngine();
  at(5_000);
  engine.start();
  engine.next();
  assert.equal(engine.state.question.startedAt, START + 5_000);
  assert.equal(engine.state.question.endsAt, START + 25_000);
  at(9_000);
  assert.equal(engine.msRemaining(), 16_000);
});

test('a question that has run out of time reports itself as expired', () => {
  const { engine, at } = makeEngine();
  engine.start();
  engine.next();
  at(19_999);
  assert.equal(engine.isExpired(), false);
  at(20_000);
  assert.equal(engine.isExpired(), true);
});

// ------------------------------------------------------------------ scoring

test('the first correct answer takes the bonus, a faster wrong one does not', () => {
  const { engine, at } = makeEngine();
  const [fast, slower] = joinThree(engine);
  engine.start();
  engine.next();

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
  engine.start();
  engine.next();

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
  engine.start();
  engine.next();

  at(1_000);
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 0 }).ok, true);
  at(2_000);
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'already_answered' });
  assert.equal(engine.state.players[a.id].score, 0);
});

test('answers are refused once the clock has run out', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  engine.start();
  engine.next();
  at(20_001);
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'too_late' });
});

test('answers are refused when no question is open', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'not_open' });
  engine.start();
  engine.next();
  engine.reveal();
  assert.deepEqual(engine.answer({ playerId: a.id, optionIndex: 1 }), { ok: false, reason: 'not_open' });
});

test('nonsense from a phone is rejected rather than scored', () => {
  const { engine } = makeEngine();
  const [a] = joinThree(engine);
  engine.start();
  engine.next();
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 9 }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: a.id, optionIndex: -1 }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 'one' }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: a.id, optionIndex: 1.5 }).reason, 'bad_option');
  assert.equal(engine.answer({ playerId: 'nobody', optionIndex: 1 }).reason, 'unknown_player');
});

test('the fastest finger is the first CORRECT answer, not the first answer', () => {
  const { engine, at } = makeEngine();
  const [wrongFast, rightSlower] = joinThree(engine);
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 0 });
  engine.reveal();
  assert.equal(engine.fastestFinger(), null);
});

// -------------------------------------------------------- skip / redo / back

test('skipping a question takes back every point it awarded', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
  engine.next(); // reveal q1
  engine.next(); // q2
  engine.skipQuestion();
  assert.equal(engine.state.phase, PHASES.ROUND_BOARD);
});

test('going back from a reveal reopens the same question, cleared', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  engine.start();
  engine.next();
  at(1_000);
  engine.answer({ playerId: a.id, optionIndex: 1 });
  engine.reveal();
  engine.back();
  assert.equal(engine.state.phase, PHASES.QUESTION);
  assert.equal(engine.state.questionIndex, 0);
  assert.equal(engine.state.players[a.id].score, 0);
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
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
  const late = engine.join({ name: 'Just Arrived' });
  assert.equal(late.joinedDuringQuiz, true);
  assert.equal(late.score, 0);
});

test('removing a team takes their answers with them', () => {
  const { engine, at } = makeEngine();
  const [a, b] = joinThree(engine);
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
  const view = engine.playerView(a.id);
  assert.deepEqual(view.options, ['A', 'B', 'C', 'D']);
  assert.equal(JSON.stringify(view).includes('First question?'), false);
  assert.equal(view.reveal, undefined);
});

test('a phone is not told whether it was right until the reveal', () => {
  const { engine, at } = makeEngine();
  const [a] = joinThree(engine);
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
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
  engine.start();
  engine.next();
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
