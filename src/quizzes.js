/**
 * Quiz packs: plain JSON files, one per quiz, in /quizzes.
 *
 * Keeping them as ordinary files on disk means you can keep a library of them,
 * copy one between gigs, open one in any text editor, and the browser editor
 * is just something that reads and writes these same files.
 */

import fs from 'node:fs';
import path from 'node:path';

export const ROUND_TYPES = ['text', 'image', 'intro'];

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

export function saveQuiz(dir, id, quiz) {
  const problems = validateQuiz(quiz);
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
    createdAt: quiz.createdAt || null,
    notes: quiz.notes || '',
    rounds: (quiz.rounds || []).map((round, ri) => ({
      id: round.id || `r${ri + 1}`,
      type: ROUND_TYPES.includes(round.type) ? round.type : 'text',
      title: round.title || `Round ${ri + 1}`,
      blurb: round.blurb || '',
      ...(round.questionSeconds ? { questionSeconds: round.questionSeconds } : {}),
      ...(round.imageCaption ? { imageCaption: round.imageCaption } : {}),
      ...(round.spotifyPlaylist ? { spotifyPlaylist: round.spotifyPlaylist } : {}),
      questions: (round.questions || []).map((q, qi) => ({
        id: q.id || `${round.id || 'r' + (ri + 1)}q${qi + 1}`,
        prompt: q.prompt || '',
        options: (q.options || []).map((o) => String(o)),
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
        ...(q.note ? { note: q.note } : {}),
        ...(q.answerNote ? { answerNote: q.answerNote } : {}),
        ...(q.image ? { image: q.image } : {}),
        ...(q.imageCaption ? { imageCaption: q.imageCaption } : {}),
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
    })),
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
      const correct = options[q.correctIndex];
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
          if (oi === q.correctIndex) return;
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

      // An answer that contradicts the question it is answering.
      if (/^(neither|none|no one|nobody|they (were|had) n)/i.test(String(correct || ''))) {
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
  if (!Array.isArray(quiz.rounds) || quiz.rounds.length === 0) problems.push('The quiz has no rounds.');

  (quiz.rounds || []).forEach((round, ri) => {
    const where = `Round ${ri + 1}`;
    if (!ROUND_TYPES.includes(round.type)) {
      problems.push(`${where}: unknown round type "${round.type}". Use text, image or intro.`);
    }
    if (!Array.isArray(round.questions) || round.questions.length === 0) {
      problems.push(`${where}: no questions.`);
      return;
    }
    round.questions.forEach((q, qi) => {
      const at = `${where} question ${qi + 1}`;
      if (!q.prompt || !String(q.prompt).trim()) problems.push(`${at}: no question text.`);
      const options = q.options || [];
      if (options.length !== 4) problems.push(`${at}: needs exactly 4 options (it has ${options.length}).`);
      if (options.some((o) => !String(o).trim())) problems.push(`${at}: has a blank option.`);
      const seen = new Set(options.map((o) => String(o).trim().toLowerCase()));
      if (seen.size !== options.length) problems.push(`${at}: has two identical options.`);
      if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= options.length) {
        problems.push(`${at}: no correct answer is marked.`);
      }
      if (round.type === 'image' && !q.image) problems.push(`${at}: picture round question has no image file.`);
      if (round.type === 'intro' && !(q.cue && (q.cue.title || q.cue.artist))) {
        problems.push(`${at}: intro round question has no track cue for you to play.`);
      }
    });
  });
  return problems;
}
