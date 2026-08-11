/**
 * Not asking the same thing twice, across the whole catalogue.
 *
 * The bingo side has had this since the beginning — `history.js` remembers
 * every track that has gone into a pack and refuses to pick it again for three
 * months. Quizzes never got the equivalent, and the gap was invisible while
 * there were seven packs. Write two eighties quizzes six months apart and they
 * can share half a dozen answers with nothing anywhere saying so, and the first
 * anybody hears of it is a regular at the same pub saying "we had this one".
 *
 * ---
 *
 * **IT KEYS ON THE ANSWER, NOT THE QUESTION. That is the whole design.**
 *
 * A bingo track is a `{title, artist}` pair, so matching the words works. A
 * question is prose, and these two are the same question:
 *
 *     "Who had a number one with Flowers in 2023?"
 *     "Which Miley Cyrus single topped the charts that year?"
 *
 * They share almost no words. Any text comparison finds nothing. The ANSWER is
 * the stable part — and it is also what the room actually experiences: somebody
 * who heard "Miley Cyrus" last month feels the repeat however it was phrased.
 *
 * ---
 *
 * **There is no history FILE, and that is deliberate.** The bingo one exists
 * because Claude in a browser reads it before curating, and because a curated
 * round might be binned before it ever becomes a pack — so what was "used" is
 * not something the packs can tell you. Quizzes have neither problem: the
 * catalogue is on disk, so the packs ARE the record. Reading them means no file
 * to keep in sync, no backfill, no backup, and a deleted pack stops blocking
 * its own answers the moment it goes.
 *
 * **The CATALOGUE only.** Generating is the owner's, and the owner cannot read
 * a quizmaster's own packs — so their answers are not in here, which falls out
 * of the design rather than needing a check.
 */

import fs from 'node:fs';
import path from 'node:path';

import { safeQuizFile } from './quizzes.js';

const DAY = 86400000;

/** Long enough that a venue has cycled through your packs, short enough to keep writing. */
export const DEFAULT_MONTHS = 6;

/**
 * What makes two answers "the same answer".
 *
 * Deliberately loose in the same places `trackKey` is: punctuation and case go,
 * and so does a leading "the"/"a"/"an" — "The Beatles" and "Beatles" are one
 * answer to a room, and the alphabet round already has a hard rule about
 * exactly that ambiguity.
 *
 * A bracketed aside goes too, because a generator writes "Queen (Freddie
 * Mercury)" one week and "Queen" the next and means the same thing.
 */
export function answerKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/^\s*(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * The answer to one question, whatever kind of round it is in.
 *
 * Three shapes: an options list with a right index, an `answer` string (the
 * alphabet round, which has no options at all), and `correctIndexes` for
 * pick-them-all — where the answer is the SET, so every one of them counts.
 * Returned as a list for that reason.
 */
export function answersOf(question = {}) {
  const options = question.options || [];
  if (Array.isArray(question.correctIndexes) && question.correctIndexes.length) {
    return question.correctIndexes.map((i) => options[i]).filter(Boolean);
  }
  if (question.answer !== undefined && !options.length) return [question.answer].filter(Boolean);
  const one = options[question.correctIndex];
  return one ? [one] : [];
}

/**
 * Every answer already in the catalogue, with which pack it came from.
 *
 * A pack with no `createdAt` counts as recent rather than ancient. An undated
 * pack is almost always an OLD one — from before the field existed — so
 * treating it as expired would quietly unblock exactly the questions most
 * likely to have been heard already. Blocking is the cheap mistake here: the
 * generator over-asks, so a wrongly withheld answer costs nothing.
 *
 * @returns {Map<string, {packId: string, title: string, answer: string}>}
 */
export function answersInCatalogue(quizDir, { months = DEFAULT_MONTHS, now = Date.now() } = {}) {
  const since = now - months * 30 * DAY;
  const seen = new Map();

  let files = [];
  try {
    files = fs.readdirSync(quizDir).filter((f) => f.endsWith('.json'));
  } catch {
    return seen;
  }

  for (const file of files) {
    let pack;
    try {
      pack = JSON.parse(fs.readFileSync(path.join(quizDir, file), 'utf8'));
    } catch {
      continue;    // a broken pack is the console's problem, not this one's
    }
    const at = Date.parse(pack.createdAt || '');
    if (Number.isFinite(at) && at < since) continue;

    const packId = pack.id || path.basename(file, '.json');
    for (const round of pack.rounds || []) {
      for (const question of round.questions || []) {
        for (const answer of answersOf(question)) {
          const key = answerKey(answer);
          if (key && !seen.has(key)) seen.set(key, { packId, title: pack.title || packId, answer });
        }
      }
    }
  }
  return seen;
}

/**
 * Drop anything the catalogue has already asked about.
 *
 * Mechanical rather than a plea in the prompt, for the reason every filter in
 * this codebase is: a model told not to repeat itself will do it anyway now and
 * again, and the failure is silent. The writer is told as well — see
 * `avoidAnswers` — but that is to stop the over-ask being wasted, not to be
 * relied on.
 *
 * Also drops duplicates WITHIN the batch, which the model produces more often
 * than you would think when it is asked for twenty of something.
 *
 * @returns {{kept: object[], dropped: Array<{question: object, because: string}>}}
 */
export function filterSeen(existing, questions = []) {
  const kept = [];
  const dropped = [];
  const usedHere = new Set();

  for (const question of questions) {
    const keys = answersOf(question).map(answerKey).filter(Boolean);
    const clash = keys.find((k) => existing.has(k));
    if (clash) {
      const from = existing.get(clash);
      dropped.push({ question, because: `"${from.answer}" is already the answer to a question in ${from.title}` });
      continue;
    }
    const twice = keys.find((k) => usedHere.has(k));
    if (twice) {
      dropped.push({ question, because: 'the same answer twice in one round' });
      continue;
    }
    for (const k of keys) usedHere.add(k);
    kept.push(question);
  }
  return { kept, dropped };
}

/**
 * What to tell the writer, so the over-ask is not spent on questions that are
 * going to be thrown away anyway.
 *
 * Trimmed rather than exhaustive: a catalogue of thirty packs is several
 * hundred answers, and the point is to steer rather than to enumerate. The
 * mechanical filter above is what actually guarantees it.
 */
export function avoidAnswers(existing, limit = 150) {
  return [...existing.values()].slice(0, limit).map((e) => e.answer);
}
