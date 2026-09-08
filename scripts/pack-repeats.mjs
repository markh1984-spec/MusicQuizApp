/**
 * DOES ONE NIGHT ASK THE SAME THING TWICE? — `node scripts/pack-repeats.mjs`
 *
 * ---
 *
 * `question-history.js` already refuses a repeated answer ACROSS the
 * catalogue, and its own note says why in the sentence that matters here:
 * *"somebody who heard 'Miley Cyrus' last month feels the repeat however it
 * was phrased."* That is truer inside ONE evening than across two months —
 * and nothing checked it, because that guard runs at generation time and
 * compares a new question against packs already on disk, never a pack
 * against itself.
 *
 * Found on the pack booked for a real Thursday: round one asked which band
 * released 'Silent Alarm', and round two showed Bloc Party's face; round one
 * asked who released 'Rehab', round two showed Amy Winehouse, and round three
 * PLAYED Rehab. Four of the ten intros were named out loud in round one, an
 * hour before they were played.
 *
 * **IT REPORTS. IT NEVER EDITS**, exactly like `pack-shapes.mjs` beside it —
 * which of two questions to drop is a judgement about a night, and the pack
 * is the host's copy to change.
 *
 * Three kinds, in the order they embarrass you:
 *
 *  1. **A SONG NAMED IN A QUESTION AND THEN PLAYED AS AN INTRO.** The worst,
 *     because the earlier question gives the later answer away outright.
 *  2. **ONE ANSWER, TWICE.** `answerKey()` from `question-history.js`, so
 *     "The Killers" and "killers" are one answer, and the rule this file
 *     leans on cannot drift from the one the generator uses.
 *  3. **AN ARTIST ANSWERED, THEN PLAYED.** Softer — a room does not mind
 *     hearing a band twice nearly as much as being asked twice — so it is
 *     printed as a note rather than counted as a repeat.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { listQuizzes, loadQuiz } from '../src/quizzes.js';
import { answerKey, answersOf } from '../src/question-history.js';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

/**
 * Every quoted phrase in a prompt — how a question names a song or an album.
 *
 * **THE POSSESSIVE APOSTROPHE HAS TO GO FIRST, and leaving it in cost this
 * check two of its four real findings.** *"Arctic Monkeys' debut single 'I Bet
 * You Look Good on the Dancefloor' charted in which year?"* has three
 * apostrophes, and a naive pair-match takes the first two — so the "quoted
 * phrase" came out as `debut single` and the song title was never looked at.
 * It found Mr. Brightside and Rehab, whose questions have no possessive, and
 * silently missed the two beside them. A check that finds half of something is
 * worse than one that finds none, because it reads as a clean bill.
 */
const quoted = (text) => (String(text || '')
  .replace(/(\w)['’](?=s\b)/g, '$1')   // Madonna's
  .replace(/(\ws)['’](?=\s)/g, '$1')   // Arctic Monkeys' — a plural possessive
  .match(/['‘’"“”]([^'‘’"“”]{2,})['‘’"“”]/g) || [])
  .map((s) => answerKey(s.replace(/['‘’"“”]/g, '')));

/** Where a question sits, said the way a host reads it off a running order. */
const at = (ri, qi) => `R${ri + 1}Q${qi + 1}`;

/**
 * A YEAR OR A DECADE IS NOT A REPEATED ANSWER.
 *
 * "2008" and "1980s" are the answer to a dozen honest questions about when
 * something happened, and a room does not experience two date questions as
 * the same question. Left in, the Madonna pack alone reported six repeats of
 * which one was real — and a report mostly made of noise is one nobody reads
 * to the bottom of.
 */
const isDate = (key) => /^(19|20)\d\ds?$/.test(key);

/**
 * A PICK-THEM-ALL QUESTION HOLDS FOUR ANSWERS AT ONCE, so it collides with
 * everything and means almost nothing when it does: being asked "which of
 * these six did Madonna appear in" is not being asked the same question as
 * "which film was she in in 1990", even though both answers say Dick Tracy.
 * Reported as a note rather than a repeat.
 */
const isSpread = (round) => round.type === 'multi';

let packsWithProblems = 0;
let totalProblems = 0;

for (const summary of listQuizzes(config.quizDir)) {
  if (only.length && !only.includes(summary.id)) continue;
  let quiz;
  try { quiz = loadQuiz(config.quizDir, summary.id); } catch { continue; }
  const rounds = quiz.rounds || [];
  // A one-round pack cannot repeat itself across rounds, and a component on
  // Music Rounds is not a night — the same exemption `pack-shapes.mjs` makes.
  if (rounds.length < 2) continue;

  const lines = [];

  /* ---- 1. a song named in a question, then played as an intro ---------- */
  const named = [];
  rounds.forEach((r, ri) => r.questions.forEach((q, qi) => {
    for (const phrase of quoted(q.prompt)) named.push({ phrase, where: at(ri, qi), ri });
  }));
  rounds.forEach((r, ri) => {
    if (r.type !== 'intro') return;
    r.questions.forEach((q, qi) => {
      const title = answerKey(q.cue && q.cue.title);
      if (!title) return;
      const said = named.find((n) => n.phrase === title && n.ri < ri);
      if (said) lines.push(`  GIVES IT AWAY  ${at(ri, qi)} plays "${q.cue.title}" — already named in ${said.where}`);
    });
  });

  // Declared before section 2, which now files the softer collisions here too.
  const notes = [];

  /* ---- 2. one answer, twice -------------------------------------------- */
  const seen = new Map();
  rounds.forEach((r, ri) => r.questions.forEach((q, qi) => {
    for (const a of answersOf(q)) {
      const key = answerKey(a);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, { text: a, where: [], spread: [] });
      seen.get(key)[isSpread(r) ? 'spread' : 'where'].push(at(ri, qi));
    }
  }));
  for (const [key, { text, where, spread }] of seen) {
    if (isDate(key)) continue;
    if (where.length > 1) lines.push(`  ANSWERED TWICE ${text} — ${where.join(', ')}`);
    else if (where.length && spread.length) {
      notes.push(`  also in a pick-them-all  ${text} — ${where.join(', ')} and ${spread.join(', ')}`);
    }
  }

  /* ---- 3. an artist answered, then played (a note, not a repeat) -------- */
  const played = new Map();
  rounds.forEach((r, ri) => {
    if (r.type !== 'intro') return;
    r.questions.forEach((q, qi) => {
      const artist = answerKey(q.cue && q.cue.artist);
      if (!artist || !seen.has(artist)) return;
      const earlier = [...seen.get(artist).where, ...seen.get(artist).spread].filter((w) => w !== at(ri, qi));
      if (!earlier.length) return;
      if (!played.has(artist)) played.set(artist, { name: q.cue.artist, where: [], earlier });
      played.get(artist).where.push(at(ri, qi));
    });
  });
  for (const { name, where, earlier } of played.values()) {
    /*
     * A SINGLE-ARTIST PACK IS NOT REPEATING ITSELF — the Metallica quiz played
     * Metallica ten times and printed ten identical lines saying so, which is
     * the report burying its own real finding two screens up. Collapsed to one.
     */
    notes.push(where.length > 2
      ? `  also played  ${name} is ${where.length} of the intros, and the answer to ${earlier.join(', ')}`
      : `  also played  ${where.join(', ')} is ${name}, answered in ${earlier.join(', ')}`);
  }

  if (!lines.length && !notes.length) continue;
  if (lines.length) { packsWithProblems += 1; totalProblems += lines.length; }
  console.log(`\n${quiz.title}  (${summary.id})`);
  for (const line of lines) console.log(line);
  for (const note of notes) console.log(note);
}

console.log(packsWithProblems
  ? `\n${totalProblems} repeat(s) across ${packsWithProblems} pack(s). Nothing was changed.`
  : '\nNo pack asks the same thing twice.');
