/**
 * A ROUND CARRIES ITS OWN SECONDS AND PICTURE REVEAL FOR TONIGHT — with the
 * settings row as the default for every round that says nothing.
 *
 * The host, 29 September 2026: *"each round should carry its own settings but
 * there should be defaults so you're only changing them if you need to."*
 * Set in the "Each round" fold beside *What they win*; carried on the round's
 * reference in the running order (`{ packId, round, questionSeconds, reveal }`)
 * — the ONE place a round is named on its way to the room, so the launch, a
 * saved show and the crash recovery all carry it without a second copy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRoundSet, roundKey, withRoundSet, ROUND_REVEALS } from '../public/assets/round-set.js';
import { composeQuiz } from '../src/running-order.js';
import { REVEAL_MODES, revealMode } from '../src/quizzes.js';
import { normalise } from '../src/shows.js';
import { Engine, PHASES } from '../src/engine.js';

const PACK = {
  id: 'p', title: 'P', questionSeconds: 20,
  rounds: [
    { id: 'r1', type: 'text', title: 'Words', questions: [{ id: 'q1', prompt: 'A?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] },
    { id: 'r2', type: 'image', title: 'Faces', reveal: 'mix', questions: [
      { id: 'q2', prompt: 'Who?', image: 'x.png', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
      { id: 'q3', prompt: 'Who?', image: 'y.png', reveal: 'blur', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] },
  ],
};
const load = () => JSON.parse(JSON.stringify(PACK));

test('only a real clock and a real reveal survive the trip', () => {
  assert.deepEqual(cleanRoundSet({ questionSeconds: 30, reveal: 'Pixelate' }), { questionSeconds: 30, reveal: 'pixelate' });
  assert.deepEqual(cleanRoundSet({ questionSeconds: 2, reveal: 'melt' }), {}, 'the route\'s own clamp, and no invented reveal');
  assert.deepEqual(cleanRoundSet({ questionSeconds: 500 }), {});
  assert.deepEqual(cleanRoundSet(null), {});
  assert.deepEqual([...ROUND_REVEALS].sort(), [...REVEAL_MODES, 'mix'].sort(), 'the bar offers exactly what a pack may say');
});

test('tonight\'s settings join the round references at one seam, keyed by pack AND round', () => {
  const set = { [roundKey('p', 1)]: { reveal: 'pixelate' }, [roundKey('p', 0)]: { questionSeconds: 30 }, [roundKey('q', 0)]: { questionSeconds: 45 } };
  assert.deepEqual(withRoundSet([{ packId: 'p', round: 0 }, { packId: 'p', round: 1 }], set),
    [{ packId: 'p', round: 0, questionSeconds: 30 }, { packId: 'p', round: 1, reveal: 'pixelate' }]);
  assert.deepEqual(withRoundSet([{ packId: 'p', round: 0, questionSeconds: 60 }], {}), [{ packId: 'p', round: 0 }],
    'the bar\'s map is the truth: a setting taken off is taken off');
});

test('the composed quiz plays the round\'s own clock and reveal — over the pack\'s, and over a question\'s', () => {
  const quiz = composeQuiz([{ packId: 'p', round: 0, questionSeconds: 30 }, { packId: 'p', round: 1, reveal: 'pixelate' }], load);
  assert.equal(quiz.rounds[0].questionSeconds, 30);
  assert.equal(revealMode(quiz.rounds[1], quiz.rounds[1].questions[0], 0), 'pixelate');
  assert.equal(revealMode(quiz.rounds[1], quiz.rounds[1].questions[1], 1), 'pixelate', 'a question\'s own reveal would beat the host\'s choice');
  const plain = composeQuiz([{ packId: 'p', round: 1 }], load);
  assert.equal(revealMode(plain.rounds[0], plain.rounds[0].questions[1], 1), 'blur', 'with no setting the pack plays as written');
});

test('a round\'s clock beats the night\'s Secs per Q, in a real game', () => {
  const quiz = composeQuiz([{ packId: 'p', round: 0, questionSeconds: 30 }], load);
  const engine = new Engine({ quiz, now: () => 1_700_000_000_000 });
  engine.state.questionSeconds = 15;
  engine.join({ name: 'Alpha' });
  engine.start();
  let guard = 0;
  while (engine.state.phase !== PHASES.QUESTION && guard++ < 10) engine.next();
  assert.equal(engine.state.question.seconds, 30);
});

test('a saved show keeps them', () => {
  const show = normalise({ name: 'Thursday', items: [{ kind: 'quiz', packId: 'p', order: [
    { packId: 'p', round: 0, questionSeconds: 30 }, { packId: 'p', round: 1, reveal: 'tiles', junk: 'x' },
  ] }] });
  assert.deepEqual(show.items[0].order, [{ packId: 'p', round: 0, questionSeconds: 30 }, { packId: 'p', round: 1, reveal: 'tiles' }]);
});
