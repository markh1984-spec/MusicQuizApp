/**
 * Evening out where the right answers sit.
 *
 * The thing that must never break: the words. Rearranging the options is only
 * safe if every question still has the same right answer afterwards — get that
 * wrong and a quiz that read fine in the console marks the room wrong in front
 * of sixty people.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { balanceAnswers } from '../public/assets/balance.js';
import { validateQuiz, normaliseQuiz, reviewWarnings } from '../src/quizzes.js';

/** Deterministic — the same reason every clock in this app is injected. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** A lopsided quiz: the answer is always A, which is what Claude writes. */
function lopsidedQuiz(count = 20) {
  return {
    id: 'lop',
    title: 'Lopsided',
    rounds: [{
      id: 'r1', type: 'text', title: 'Round One',
      questions: Array.from({ length: count }, (_, i) => ({
        id: `q${i + 1}`,
        prompt: `Question ${i + 1}?`,
        options: [`right${i}`, `wrong${i}a`, `wrong${i}b`, `wrong${i}c`],
        correctIndex: 0,
      })),
    }],
  };
}

function multiQuiz(count = 10) {
  return {
    id: 'multi',
    title: 'Pick them all',
    rounds: [{
      id: 'r1', type: 'multi', title: 'Pick them all',
      questions: Array.from({ length: count }, (_, i) => ({
        id: `q${i + 1}`,
        prompt: `Which two of these, number ${i + 1}?`,
        options: [`yes${i}a`, `yes${i}b`, `no${i}a`, `no${i}b`, `no${i}c`, `no${i}d`],
        correctIndex: 0,
        correctIndexes: [0, 1],
      })),
    }],
  };
}

/** What every question said before, so it can be compared with after. */
function answersOf(quiz) {
  return quiz.rounds.flatMap((round) => round.questions.map((q) => {
    const right = q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex];
    return {
      id: q.id,
      right: right.map((i) => q.options[i]).slice().sort(),
      all: q.options.slice().sort(),
    };
  }));
}

function spreadOf(quiz) {
  const all = quiz.rounds.flatMap((r) => r.questions);
  const width = Math.max(4, ...all.map((q) => q.options.length));
  const spread = new Array(width).fill(0);
  for (const q of all) {
    const right = q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex];
    for (const i of right) spread[i]++;
  }
  return spread;
}

test('the same question has the same right answer afterwards', () => {
  const quiz = lopsidedQuiz();
  const before = answersOf(quiz);
  balanceAnswers(quiz, seeded());
  assert.deepEqual(answersOf(quiz), before);
});

test('an all-A quiz comes out spread across every letter', () => {
  const quiz = lopsidedQuiz(20);
  assert.deepEqual(spreadOf(quiz), [20, 0, 0, 0]);
  balanceAnswers(quiz, seeded());
  const spread = spreadOf(quiz);
  assert.deepEqual(spread.reduce((a, b) => a + b, 0), 20, 'still twenty answers');
  // Twenty questions over four letters is five each. Least-loaded-first should
  // hit that exactly; the read-through's own test is "no letter over half".
  for (const n of spread) assert.equal(n, 5);
});

test('it does not settle into A B C D A B C D', () => {
  const quiz = lopsidedQuiz(20);
  balanceAnswers(quiz, seeded(7));
  const letters = quiz.rounds[0].questions.map((q) => q.correctIndex);
  const cycling = letters.every((n, i) => i === 0 || n === (letters[i - 1] + 1) % 4);
  assert.equal(cycling, false, 'a predictable cycle is as bad as a lean');
});

test('a pick-them-all question keeps all of its right answers', () => {
  const quiz = multiQuiz(10);
  const before = answersOf(quiz);
  balanceAnswers(quiz, seeded(3));
  assert.deepEqual(answersOf(quiz), before);
  for (const q of quiz.rounds[0].questions) {
    assert.equal(q.correctIndexes.length, 2);
    // Sorted, because the reveal reads left to right — and normaliseQuiz would
    // sort them anyway, so an unsorted answer here would silently disagree
    // with what lands on disk.
    assert.deepEqual(q.correctIndexes, [...q.correctIndexes].sort((a, b) => a - b));
    assert.ok(q.correctIndexes.includes(q.correctIndex), 'correctIndex points at a right answer');
  }
  const spread = spreadOf(quiz);
  assert.equal(spread.length, 6);
  for (const n of spread) assert.ok(n >= 3 && n <= 4, `each of six letters gets its share, got ${spread}`);
});

test('a quiz mixing four options and six fills E and F from the wider round', () => {
  const quiz = lopsidedQuiz(12);
  quiz.rounds.push(multiQuiz(8).rounds[0]);
  quiz.rounds[1].id = 'r2';
  balanceAnswers(quiz, seeded(5));
  const spread = spreadOf(quiz);
  assert.ok(spread[4] > 0 && spread[5] > 0, `E and F should be used, got ${spread}`);
  const total = 12 + 16;
  assert.equal(spread.reduce((a, b) => a + b, 0), total);
  for (const n of spread) assert.ok(n <= total * 0.5, 'nothing left lopsided');
});

test('a balanced quiz still validates and survives being saved', () => {
  const quiz = lopsidedQuiz(8);
  quiz.rounds.push(multiQuiz(6).rounds[0]);
  quiz.rounds[1].id = 'r2';
  balanceAnswers(quiz, seeded(11));
  assert.deepEqual(validateQuiz(quiz), []);
  const saved = normaliseQuiz(quiz, quiz.id);
  assert.deepEqual(answersOf(saved), answersOf(quiz), 'normalising does not move an answer');
});

test('a broken question is left exactly as it was', () => {
  const quiz = lopsidedQuiz(2);
  // Nothing marked right, and everything marked right: the editor's job, not
  // this one's. Rearranging a question whose answer nobody knows would only
  // make the fix harder.
  quiz.rounds[0].questions[0].correctIndex = 9;
  quiz.rounds[0].questions[1].correctIndexes = [0, 1, 2, 3];
  const before = JSON.parse(JSON.stringify(quiz));
  balanceAnswers(quiz, seeded());
  assert.deepEqual(quiz, before);
});

test('the review ticks you have already made survive it', () => {
  // Flag ids are built from option TEXT, never position — which is the whole
  // reason this is safe to run on a pack you have already read through.
  const quiz = {
    id: 'ticked',
    title: 'Ticked',
    rounds: [{
      id: 'r1', type: 'text', title: 'One',
      questions: [
        {
          id: 'q1',
          prompt: 'Who had the first UK number one?',
          options: ['Blondie', 'Abba', 'Queen', 'Wings'],
          correctIndex: 0,
          answerNote: 'Abba were bigger overall.',
          checked: ['slippery-wording:first', 'note-names-wrong-option:abba'],
        },
      ],
    }],
  };
  const before = reviewWarnings(quiz);
  assert.ok(before.length >= 2);
  assert.ok(before.every((w) => w.cleared), 'both ticked to start with');

  balanceAnswers(quiz, seeded(2));
  const after = reviewWarnings(quiz);
  assert.deepEqual(after.map((w) => w.id).sort(), before.map((w) => w.id).sort());
  assert.ok(after.every((w) => w.cleared), 'still ticked after rearranging');
});

test('it reports how many questions it actually moved', () => {
  const quiz = lopsidedQuiz(6);
  assert.equal(balanceAnswers(quiz, seeded()) > 0, true);
  // Nothing to move: one question, already the only arrangement it can have.
  const tiny = { rounds: [{ questions: [{ options: ['a'], correctIndex: 0 }] }] };
  assert.equal(balanceAnswers(tiny, seeded()), 0);
});
