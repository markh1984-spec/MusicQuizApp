/**
 * Quiz pack loading, validation and saving.
 *
 * The validation rules exist to catch the mistakes that would actually hurt
 * in front of a room: no correct answer marked, two identical options, a
 * picture question with no picture, an intro question with nothing to play.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateQuiz, normaliseQuiz, safeQuizFile, saveQuiz, loadQuiz, listQuizzes, reviewWarnings } from '../src/quizzes.js';

function goodQuiz() {
  return {
    id: 'good',
    title: 'A Good Quiz',
    rounds: [
      {
        id: 'r1', type: 'text', title: 'Round One',
        questions: [
          { id: 'q1', prompt: 'A question?', options: ['One', 'Two', 'Three', 'Four'], correctIndex: 2 },
        ],
      },
    ],
  };
}

test('a well formed quiz has no problems', () => {
  assert.deepEqual(validateQuiz(goodQuiz()), []);
});

test('a question with no correct answer marked is caught', () => {
  const quiz = goodQuiz();
  delete quiz.rounds[0].questions[0].correctIndex;
  assert.match(validateQuiz(quiz).join(' '), /no correct answer is marked/);
});

test('a correct answer pointing at an option that does not exist is caught', () => {
  const quiz = goodQuiz();
  quiz.rounds[0].questions[0].correctIndex = 7;
  assert.match(validateQuiz(quiz).join(' '), /no correct answer is marked/);
});

test('two identical options are caught, because the reveal would be nonsense', () => {
  const quiz = goodQuiz();
  quiz.rounds[0].questions[0].options = ['One', 'Two', 'Two', 'Four'];
  assert.match(validateQuiz(quiz).join(' '), /two identical options/);
});

test('the wrong number of options is caught', () => {
  const quiz = goodQuiz();
  quiz.rounds[0].questions[0].options = ['One', 'Two', 'Three'];
  assert.match(validateQuiz(quiz).join(' '), /needs exactly 4 options/);
});

test('a blank option or a blank question is caught', () => {
  const quiz = goodQuiz();
  quiz.rounds[0].questions[0].options[1] = '   ';
  quiz.rounds[0].questions[0].prompt = '';
  const problems = validateQuiz(quiz).join(' ');
  assert.match(problems, /blank option/);
  assert.match(problems, /no question text/);
});

test('a picture question with no picture is caught', () => {
  const quiz = goodQuiz();
  quiz.rounds[0].type = 'image';
  assert.match(validateQuiz(quiz).join(' '), /no image file/);
});

test('an intro question with nothing for you to play is caught', () => {
  const quiz = goodQuiz();
  quiz.rounds[0].type = 'intro';
  assert.match(validateQuiz(quiz).join(' '), /no track cue/);
});

test('an unknown round type is caught', () => {
  const quiz = goodQuiz();
  quiz.rounds[0].type = 'karaoke';
  assert.match(validateQuiz(quiz).join(' '), /unknown round type/);
});

test('an empty quiz is caught', () => {
  assert.match(validateQuiz({ title: 'Nothing', rounds: [] }).join(' '), /no rounds/);
});

test('normalising fills in the gaps so the rest of the app can trust the shape', () => {
  const quiz = normaliseQuiz({ rounds: [{ questions: [{ prompt: 'Q', options: ['a', 'b', 'c', 'd'] }] }] }, 'fallback');
  assert.equal(quiz.id, 'fallback');
  assert.equal(quiz.title, 'Music Quiz');
  assert.equal(quiz.questionSeconds, 20);
  assert.equal(quiz.rounds[0].type, 'text');
  assert.equal(quiz.rounds[0].id, 'r1');
  assert.equal(quiz.rounds[0].questions[0].id, 'r1q1');
  assert.equal(quiz.rounds[0].questions[0].correctIndex, 0);
});

test('normalising keeps the round-type extras it is given', () => {
  const quiz = normaliseQuiz({
    rounds: [
      { type: 'image', questions: [{ prompt: 'Q', options: ['a', 'b', 'c', 'd'], image: 'x.png', zoomFrom: 9 }] },
      { type: 'intro', questions: [{ prompt: 'Q', options: ['a', 'b', 'c', 'd'], cue: { title: 'T', artist: 'A' } }] },
    ],
  });
  assert.equal(quiz.rounds[0].questions[0].image, 'x.png');
  assert.equal(quiz.rounds[0].questions[0].zoomFrom, 9);
  assert.deepEqual(quiz.rounds[1].questions[0].cue, { title: 'T', artist: 'A' });
});

test('a quiz id cannot escape the quizzes folder', () => {
  assert.equal(safeQuizFile('eighties'), 'eighties.json');
  assert.equal(safeQuizFile('eighties.json'), 'eighties.json');
  // Slashes are stripped, which leaves a leading dot, which is refused.
  assert.throws(() => safeQuizFile('../../etc/passwd'), /Bad quiz id/);
  assert.throws(() => safeQuizFile('../..'), /Bad quiz id/);
  assert.throws(() => safeQuizFile(''), /Bad quiz id/);
  // An absolute path loses its slashes and lands harmlessly inside the folder.
  assert.equal(safeQuizFile('/etc/hosts'), 'etchosts.json');
  // A sane id with punctuation in it still works.
  assert.equal(safeQuizFile('eighties-night_2'), 'eighties-night_2.json');
});

test('a quiz survives a save and load round trip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-test-'));
  try {
    saveQuiz(dir, 'good', goodQuiz());
    const loaded = loadQuiz(dir, 'good');
    assert.equal(loaded.title, 'A Good Quiz');
    assert.equal(loaded.rounds[0].questions[0].correctIndex, 2);

    const listed = listQuizzes(dir);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].questionCount, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('saving an invalid quiz is refused, so a bad file never reaches a gig', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-test-'));
  try {
    const bad = goodQuiz();
    bad.rounds[0].questions[0].options = ['One', 'One', 'Three', 'Four'];
    assert.throws(() => saveQuiz(dir, 'bad', bad), /not valid/);
    assert.equal(fs.existsSync(path.join(dir, 'bad.json')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the quiz that ships with the app is valid', () => {
  const quiz = loadQuiz(new URL('../quizzes/', import.meta.url).pathname, 'eighties');
  assert.deepEqual(validateQuiz(quiz), []);
  assert.equal(quiz.rounds[0].questions.length, 10);
});

// ---------------------------------------------------------- review warnings
//
// These came out of a real generated quiz. Claude wrote a question asking who
// Justine Frischmann "previously dated", marked Damon Albarn correct, put Brett
// Anderson in as a wrong option, and then wrote a fact saying she had been with
// Brett Anderson. A player picking Brett would be marked wrong and could prove
// they were right from the app's own screen. That is the argument you cannot
// win in front of a room, and it is mechanically detectable.

test('a fact naming one of the wrong options is flagged', () => {
  const quiz = {
    rounds: [{
      type: 'text',
      questions: [{
        prompt: 'Justine Frischmann previously dated which frontman?',
        options: ['Brett Anderson', 'Damon Albarn', 'Jarvis Cocker', 'Liam Gallagher'],
        correctIndex: 1,
        answerNote: "She left Suede, where she'd been with Brett Anderson, and later formed Elastica.",
      }],
    }],
  };
  const warnings = reviewWarnings(quiz);
  assert.ok(warnings.some((w) => w.includes('Brett Anderson') && w.includes('marked wrong')));
});

test('a fact naming the CORRECT option is not flagged', () => {
  const quiz = {
    rounds: [{
      type: 'text',
      questions: [{
        prompt: 'Which band released Definitely Maybe?',
        options: ['Blur', 'Oasis', 'Pulp', 'Suede'],
        correctIndex: 1,
        answerNote: 'Oasis made it the fastest-selling debut album in UK history.',
      }],
    }],
  };
  assert.deepEqual(reviewWarnings(quiz), []);
});

test('slippery words that usually hide a second right answer are flagged', () => {
  const ask = (prompt) => reviewWarnings({
    rounds: [{ type: 'text', questions: [{ prompt, options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] }],
  });
  assert.ok(ask("What was Blur's only UK number one?").some((w) => w.includes('only')));
  assert.ok(ask('Who did she previously date?').some((w) => w.includes('previously')));
  assert.ok(ask('Which was their first UK hit?').some((w) => w.includes('first')));
  // ...but not when the word merely appears inside another word
  assert.deepEqual(ask('Which band recorded Firstborn?'), []);
});

test('an answer that contradicts its own question is flagged', () => {
  const warnings = reviewWarnings({
    rounds: [{
      type: 'text',
      questions: [{
        prompt: 'Anderson and Butler left which band to form Suede?',
        options: ['The Smiths', 'Neither had a previous band', 'Blur', 'Pulp'],
        correctIndex: 1,
      }],
    }],
  });
  assert.ok(warnings.some((w) => w.includes('negative')));
});

test('a clean quiz produces no warnings at all', () => {
  assert.deepEqual(reviewWarnings(goodQuiz()), []);
});

test('very short options are not flagged, or every quiz would cry wolf', () => {
  // "Two" appearing in a sentence means nothing. Flagging it would train you
  // to ignore the warnings, which is worse than not having them.
  const quiz = goodQuiz();
  quiz.rounds[0].questions[0].answerNote = 'It took two years to record.';
  assert.deepEqual(reviewWarnings(quiz), []);
});

test('warnings never block saving — they are advice, not errors', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-test-'));
  try {
    const quiz = goodQuiz();
    // "Four" is a wrong option here, and long enough to be worth flagging.
    quiz.rounds[0].questions[0].answerNote = 'Some say Four is arguable too.';
    assert.ok(reviewWarnings(quiz).length > 0, 'it is flagged');
    assert.doesNotThrow(() => saveQuiz(dir, 'advisory', quiz), 'but it still saves');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
