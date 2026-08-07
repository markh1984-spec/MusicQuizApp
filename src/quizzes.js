/**
 * Quiz packs: plain JSON files, one per quiz, in /quizzes.
 *
 * Keeping them as ordinary files on disk means you can keep a library of them,
 * copy one between gigs, open one in any text editor, and the browser editor
 * is just something that reads and writes these same files.
 */

import fs from 'node:fs';
import path from 'node:path';

// Shared with the browser so the list of looks cannot drift between what a
// pack is allowed to ask for and what the screens can draw.
import { LOOKS } from '../public/assets/looks.js';

export const ROUND_TYPES = ['text', 'image', 'intro', 'multi', 'alphabet'];

/**
 * A "pick exactly N" round shows six options rather than four.
 *
 * Four options with two right leaves only six possible answers, which a room
 * guesses its way through. Six with two or three right is a real question, and
 * a 2x3 grid still reads from the back of a pub.
 */
export const MULTI_OPTIONS = 6;

/**
 * The alphabet round: no options at all, just the first letter.
 *
 * The question is asked out loud and on the projector, the phone shows a
 * keyboard, and getting the FIRST LETTER of the answer right is the whole job.
 * Nobody is marked wrong for spelling "Fleetwood Mac" with one word or two, and
 * nobody has to type an answer on a phone in a dark pub against a clock.
 *
 * Mechanically it is still "pick one of a list of options" — the list is these
 * twenty-six — so scoring, the tally, the fastest finger and who-picked-what
 * all work without knowing this round type exists.
 */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * How a picture round gives itself away.
 *
 * The round has always pulled back from a close crop. These are the same idea
 * done four ways, and the reason they are worth having is that ten questions
 * of one effect is ten questions of one effect — the room stops watching.
 *
 * They all run on the SAME curve (`easeOut` in `public/assets/screen.js`), and
 * that is not decoration. You score more the earlier you answer, so how fast a
 * picture becomes guessable is how many points are on offer. A steady
 * unpixelate would hold the face back until second fifteen and quietly make
 * that round worth half of a zoom round, for the same crowd and the same
 * question. Same curve is the closest this gets to fair; do not give one mode
 * a curve of its own without knowing that is what you are changing.
 */
export const REVEAL_MODES = ['zoom', 'pixelate', 'blur', 'tiles'];
export const DEFAULT_REVEAL = 'zoom';

/**
 * Which reveal one question uses.
 *
 * A round names one for all of its questions, a question can override it, and
 * `mix` rotates through all four **by position, not at random** — so the same
 * pack plays the same way twice, and a Redo mid-gig does not hand the room a
 * different effect from the one they were half way through.
 */
export function revealMode(round = {}, q = {}, questionIndex = 0) {
  const asked = String(q.reveal || round.reveal || DEFAULT_REVEAL).toLowerCase();
  if (asked === 'mix') return REVEAL_MODES[questionIndex % REVEAL_MODES.length];
  return REVEAL_MODES.includes(asked) ? asked : DEFAULT_REVEAL;
}

/** The letter an answer starts with, or '' if it does not start with one. */
export function answerLetter(answer) {
  const found = String(answer || '').trim().match(/[a-z]/i);
  return found ? found[0].toUpperCase() : '';
}

/** Where that letter sits in the keyboard, or -1. */
export function answerLetterIndex(answer) {
  return ALPHABET.indexOf(answerLetter(answer));
}

/**
 * "The Beatles" is B to half a room and T to the other half.
 *
 * This is the one way an alphabet question can go wrong in front of people, and
 * there is no clever fix — the answer has to be written without the article, or
 * the question has to be a different question. So it is a hard validation
 * error rather than a hunch: a quiz containing one does not save.
 */
export const LEADING_ARTICLE = /^(the|a|an)\s+/i;

export function listQuizzes(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    try {
      const quiz = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      out.push({
        id: quiz.id || path.basename(file, '.json'),
        file,
        title: quiz.title || path.basename(file, '.json'),
        rounds: (quiz.rounds || []).map((r) => ({
          title: r.title,
          type: r.type,
          questionCount: (r.questions || []).length,
        })),
        questionCount: (quiz.rounds || []).reduce((n, r) => n + (r.questions || []).length, 0),
        // Only the default. The look is chosen when you launch it, so a normal
        // pack can be dressed up for a Valentine's night without being edited.
        look: quiz.look || 'default',
      });
    } catch (err) {
      out.push({ id: path.basename(file, '.json'), file, title: file, broken: err.message, rounds: [] });
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

export function loadQuiz(dir, id) {
  const file = path.join(dir, safeQuizFile(id));
  const quiz = JSON.parse(fs.readFileSync(file, 'utf8'));
  return normaliseQuiz(quiz, id);
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.allowProblems]  write it even if it does not validate
 *
 * The gate is right for editing: a quiz that cannot be played should never
 * reach the disk from the editor. It is wrong for annotating. Ticking "I have
 * read this one" on the review list is a note about the reading, not a change
 * to the quiz — and refusing it because some *other* question is broken locks
 * you out of the review flow exactly when you need it most. That is what
 * happened: one bad pick-them-all question in round 2 meant no flag anywhere
 * in the quiz could be ticked, and the only thing said was "Quiz is not valid".
 */
export function saveQuiz(dir, id, quiz, { allowProblems = false } = {}) {
  const problems = allowProblems ? [] : validateQuiz(quiz);
  if (problems.length) {
    const err = new Error('Quiz is not valid');
    err.problems = problems;
    throw err;
  }
  const file = path.join(dir, safeQuizFile(id));
  const tmp = file + '.tmp';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(normaliseQuiz(quiz, id), null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return true;
}

export function deleteQuiz(dir, id) {
  fs.unlinkSync(path.join(dir, safeQuizFile(id)));
  return true;
}

/** No path traversal: an id is a filename, not a path. */
export function safeQuizFile(id) {
  const clean = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!clean || clean.startsWith('.')) throw new Error('Bad quiz id: ' + id);
  return clean.endsWith('.json') ? clean : clean + '.json';
}

/**
 * Fill in the gaps so the rest of the app can assume a consistent shape:
 * every round has a type and an id, every question has an id and four options.
 */
export function normaliseQuiz(quiz, fallbackId = 'quiz') {
  const id = quiz.id || fallbackId;
  return {
    id,
    title: quiz.title || 'Music Quiz',
    subtitle: quiz.subtitle || '',
    questionSeconds: quiz.questionSeconds || 20,
    ...(quiz.look ? { look: quiz.look } : {}),
    createdAt: quiz.createdAt || null,
    notes: quiz.notes || '',
    rounds: (quiz.rounds || []).map((round, ri) => {
      const type = ROUND_TYPES.includes(round.type) ? round.type : 'text';
      return {
      id: round.id || `r${ri + 1}`,
      type,
      title: round.title || `Round ${ri + 1}`,
      blurb: round.blurb || '',
      ...(round.questionSeconds ? { questionSeconds: round.questionSeconds } : {}),
      ...(round.imageCaption ? { imageCaption: round.imageCaption } : {}),
      ...(round.reveal ? { reveal: round.reveal } : {}),
      ...(round.spotifyPlaylist ? { spotifyPlaylist: round.spotifyPlaylist } : {}),
      questions: (round.questions || []).map((q, qi) => ({
        id: q.id || `${round.id || 'r' + (ri + 1)}q${qi + 1}`,
        prompt: q.prompt || '',
        // An alphabet question has no options to store — the keyboard is the
        // same twenty-six every time, so writing them into every question would
        // be 26 lines of noise per question in a file meant to be readable.
        // The answer is written out in full because the host reads it aloud;
        // the letter is worked out from it wherever it is needed.
        ...(type === 'alphabet'
          ? { answer: String(q.answer || '').trim() }
          : {
              options: (q.options || []).map((o) => String(o)),
              correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
              // Sorted and de-duplicated so the reveal always reads left to right
              // and "how many to pick" cannot be inflated by a repeat.
              ...(Array.isArray(q.correctIndexes)
                ? { correctIndexes: [...new Set(q.correctIndexes.filter(Number.isInteger))].sort((a, b) => a - b) }
                : {}),
            }),
        ...(q.note ? { note: q.note } : {}),
        ...(q.answerNote ? { answerNote: q.answerNote } : {}),
        ...(q.image ? { image: q.image } : {}),
        ...(q.imageCaption ? { imageCaption: q.imageCaption } : {}),
        ...(q.reveal ? { reveal: q.reveal } : {}),
        ...(q.imagePrompt ? { imagePrompt: q.imagePrompt } : {}),
        ...(Number.isFinite(q.zoomFrom) ? { zoomFrom: q.zoomFrom } : {}),
        ...(Number.isFinite(q.zoomTo) ? { zoomTo: q.zoomTo } : {}),
        ...(Number.isFinite(q.zoomOriginX) ? { zoomOriginX: q.zoomOriginX } : {}),
        ...(Number.isFinite(q.zoomOriginY) ? { zoomOriginY: q.zoomOriginY } : {}),
        ...(q.cue ? { cue: q.cue } : {}),
        // Which flags you have read and decided about. Kept on the question so
        // it travels with the pack — you might read a quiz through on the
        // laptop and glance at it again on your phone in the car park.
        ...(Array.isArray(q.checked) && q.checked.length
          ? { checked: [...new Set(q.checked.map(String))] }
          : {}),
      })),
      };
    }),
  };
}

/**
 * Advisory warnings — things that are probably wrong rather than definitely.
 *
 * Kept separate from validateQuiz because these are judgement calls and must
 * never block you saving. They are shown when you read a quiz through, so the
 * suspicious ones are the first you look at.
 *
 * The one that matters most: a fact that names one of the WRONG options. That
 * is how you get a question where a knowledgeable player picks the wrong-marked
 * option, is told they are wrong, and can then point at your own screen to
 * prove they were right. It happened on the first generated quiz, and it is
 * exactly the argument you cannot win in front of a room.
 *
 * Each warning carries an id so it can be ticked off once you have looked at
 * it. Working through twenty flags is a lot easier when the ones you have
 * already read stop staring back at you. The id is built from the kind of
 * warning and what triggered it, NOT from where the question sits — rounds get
 * renamed and reordered, and a tick should survive that.
 */
export function reviewWarnings(quiz) {
  const warnings = [];

  (quiz.rounds || []).forEach((round, ri) => {
    (round.questions || []).forEach((q, qi) => {
      const at = `Round ${ri + 1} question ${qi + 1}`;
      const options = q.options || [];
      // A pick-them-all question has a set of right answers, not one. Without
      // this the check below would flag every correct option as a wrong one
      // being named, and twenty false flags is how a host learns to ignore
      // the panel entirely.
      const rightSet = round.type === 'multi'
        ? new Set(q.correctIndexes || [])
        : new Set([q.correctIndex]);
      const correct = round.type === 'multi'
        ? (q.correctIndexes || []).map((i) => options[i]).join(', ')
        : round.type === 'alphabet'
          ? q.answer
          : options[q.correctIndex];
      const ticked = new Set((q.checked || []).map(String));
      const questionId = q.id || `r${ri + 1}q${qi + 1}`;

      const flag = (kind, detail, text) => {
        const id = detail ? `${kind}:${slugFor(detail)}` : kind;
        warnings.push({
          id,
          questionId,
          roundIndex: ri,
          questionIndex: qi,
          where: at,
          kind,
          text: `${at}: ${text}`,
          cleared: ticked.has(id),
        });
      };

      // A fact that names a wrong option usually means two answers are defensible.
      const note = String(q.answerNote || '');
      if (note) {
        options.forEach((option, oi) => {
          if (rightSet.has(oi)) return;
          const text = String(option || '').trim();
          if (text.length < 4) return;
          if (note.toLowerCase().includes(text.toLowerCase())) {
            flag('note-names-wrong-option', text,
              `the fact you read out mentions "${text}", which is marked wrong. Check it is not also a correct answer.`);
          }
        });
      }

      // Words that almost always hide a second defensible answer.
      const prompt = String(q.prompt || '');
      const slippery = ['only', 'first', 'last', 'previously', 'biggest', 'best-selling', 'biggest-selling'];
      const found = slippery.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(prompt));
      if (found.length) {
        flag('slippery-wording', found.join('-'),
          `uses "${found.join('", "')}" — worth checking no other option also fits.`);
      }

      // "Which THREE of these..." with two right answers marked. The room is
      // told how many to pick from correctIndexes, so the number in the words
      // and the number in the key have to agree — otherwise the screen asks
      // for three and the answer key wants two, and there is no version of
      // that which ends well. This is a real error, not a hunch, but it is
      // flagged rather than blocked so a half-written quiz still saves.
      if (round.type === 'multi') {
        const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
        const said = String(q.prompt || '').match(/\b(one|two|three|four|five|[1-5])\b/i);
        if (said) {
          const wanted = NUMBERS[said[1].toLowerCase()] ?? Number(said[1]);
          const marked = (q.correctIndexes || []).length;
          if (wanted !== marked) {
            flag('count-mismatch', `${wanted}-${marked}`,
              `the question says "${said[1]}" but ${marked} answer${marked === 1 ? ' is' : 's are'} marked correct. One of them is wrong.`);
          }
        }
      }

      // An answer that contradicts the question it is answering. Single-answer
      // questions only — a negative reads differently in a list of three.
      if (round.type !== 'multi' && /^(neither|none|no one|nobody|they (were|had) n)/i.test(String(correct || ''))) {
        flag('negative-answer', '',
          `the correct answer is a negative ("${correct}"), which often contradicts the question. Read it back.`);
      }
    });
  });

  return warnings;
}

function slugFor(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

/**
 * Tick a flag off, or put it back.
 *
 * Finds the question by its id rather than its position, so this still lands on
 * the right question if a round was reordered since the list was drawn.
 * Returns false if there is no such question, which the caller should treat as
 * "your page is out of date" rather than quietly succeeding.
 */
export function setWarningChecked(quiz, questionId, warningId, checked = true) {
  for (const round of quiz.rounds || []) {
    for (const q of round.questions || []) {
      if (q.id !== questionId) continue;
      const ticked = new Set((q.checked || []).map(String));
      if (checked) ticked.add(String(warningId));
      else ticked.delete(String(warningId));
      if (ticked.size) q.checked = [...ticked];
      else delete q.checked;
      return true;
    }
  }
  return false;
}

/**
 * Catch the mistakes that would ruin a question in front of a room: no correct
 * answer marked, duplicate options, a missing option. Returns a list of plain
 * English problems for the editor to show. These DO block saving.
 */
export function validateQuiz(quiz) {
  const problems = [];
  if (!quiz || typeof quiz !== 'object') return ['That is not a quiz.'];
  if (!quiz.title) problems.push('The quiz needs a title.');
  // A misspelt look would quietly come up as the ordinary one, and you would
  // find out by watching an undressed Halloween quiz go up in front of a room.
  if (quiz.look && !LOOKS.some((l) => l.id === quiz.look)) {
    problems.push(`"${quiz.look}" is not a look. Use ${LOOKS.map((l) => l.id).join(', ')}.`);
  }
  if (!Array.isArray(quiz.rounds) || quiz.rounds.length === 0) problems.push('The quiz has no rounds.');

  (quiz.rounds || []).forEach((round, ri) => {
    const where = `Round ${ri + 1}`;
    if (!ROUND_TYPES.includes(round.type)) {
      problems.push(`${where}: unknown round type "${round.type}". Use ${ROUND_TYPES.join(', ')}.`);
    }
    if (round.reveal && !REVEAL_MODES.includes(String(round.reveal).toLowerCase()) && String(round.reveal).toLowerCase() !== 'mix') {
      problems.push(`${where}: "${round.reveal}" is not a reveal. Use ${REVEAL_MODES.join(', ')} or mix.`);
    }
    if (!Array.isArray(round.questions) || round.questions.length === 0) {
      problems.push(`${where}: no questions.`);
      return;
    }
    round.questions.forEach((q, qi) => {
      const at = `${where} question ${qi + 1}`;
      if (!q.prompt || !String(q.prompt).trim()) problems.push(`${at}: no question text.`);

      // An alphabet question has no options to check. What it has instead is
      // one answer that has to begin with a letter nobody can argue about.
      if (round.type === 'alphabet') {
        const answer = String(q.answer || '').trim();
        if (!answer) {
          problems.push(`${at}: no answer, so there is no letter to be right about.`);
        } else if (!answerLetter(answer)) {
          problems.push(`${at}: the answer "${answer}" does not start with a letter.`);
        } else if (LEADING_ARTICLE.test(answer)) {
          problems.push(`${at}: "${answer}" starts with "${answer.split(/\s+/)[0]}", so half the room will press ${answerLetter(answer)} and half will press ${answerLetter(answer.replace(LEADING_ARTICLE, ''))}. Write it without the article.`);
        }
        return;
      }

      const options = q.options || [];
      const wanted = round.type === 'multi' ? MULTI_OPTIONS : 4;
      if (options.length !== wanted) problems.push(`${at}: needs exactly ${wanted} options (it has ${options.length}).`);
      if (options.some((o) => !String(o).trim())) problems.push(`${at}: has a blank option.`);
      const seen = new Set(options.map((o) => String(o).trim().toLowerCase()));
      if (seen.size !== options.length) problems.push(`${at}: has two identical options.`);

      if (round.type === 'multi') {
        const picks = q.correctIndexes;
        if (!Array.isArray(picks) || picks.length < 2) {
          problems.push(`${at}: a pick-them-all question needs at least 2 correct answers marked.`);
        } else if (picks.length >= options.length) {
          problems.push(`${at}: every option is marked correct, so there is nothing to work out.`);
        } else if (picks.some((i) => !Number.isInteger(i) || i < 0 || i >= options.length)) {
          problems.push(`${at}: a correct answer points at an option that does not exist.`);
        } else if (new Set(picks).size !== picks.length) {
          problems.push(`${at}: the same correct answer is marked twice.`);
        }
      } else if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= options.length) {
        problems.push(`${at}: no correct answer is marked.`);
      }
      if (round.type === 'image' && !q.image) problems.push(`${at}: picture round question has no image file.`);
      // A misspelt mode would silently fall back to a zoom, and you would find
      // out by watching the wrong effect in front of a room.
      if (q.reveal && !REVEAL_MODES.includes(String(q.reveal).toLowerCase()) && String(q.reveal).toLowerCase() !== 'mix') {
        problems.push(`${at}: "${q.reveal}" is not a reveal. Use ${REVEAL_MODES.join(', ')} or mix.`);
      }
      if (round.type === 'intro' && !(q.cue && (q.cue.title || q.cue.artist))) {
        problems.push(`${at}: intro round question has no track cue for you to play.`);
      }
    });
  });
  return problems;
}
