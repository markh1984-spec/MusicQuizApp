#!/usr/bin/env node
/**
 * Make the round 2 pictures from the command line.
 *
 * The work itself lives in src/generate-images.js so the console can do the
 * same job with a button. This is the version for when you are at your own
 * machine, which is where you should be generating anything you want to keep.
 *
 * Usage:
 *   node scripts/generate-images.mjs --quiz eighties --placeholder
 *   node scripts/generate-images.mjs --quiz eighties --provider openai
 *   node scripts/generate-images.mjs --quiz eighties --provider openai --only r2q3 --force
 *   node scripts/generate-images.mjs --quiz eighties --provider openai --style cartoon --quality low
 *
 * Pictures are shared between quizzes — filed under the musician, not the pack
 * — so anyone already drawn costs nothing. This SAVES the quiz when that moves
 * a question onto the library, so commit quizzes/ as well as images/.
 */

import { config } from '../src/config.js';
import { loadQuiz, saveQuiz } from '../src/quizzes.js';
import { generateImages } from '../src/generate-images.js';
import { STYLES, QUALITIES, DEFAULT_STYLE, DEFAULT_QUALITY } from '../src/portraits.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const argOf = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

async function main() {
  const quizId = argOf('--quiz', 'eighties');
  const quiz = loadQuiz(config.quizDir, quizId);

  const { made, skipped, failed, repointed } = await generateImages({
    quiz,
    imageDir: config.imageDir,
    provider: has('--placeholder') ? 'placeholder' : argOf('--provider', 'placeholder'),
    only: argOf('--only', ''),
    force: has('--force'),
    style: argOf('--style', DEFAULT_STYLE),
    quality: argOf('--quality', DEFAULT_QUALITY),
    log: (line) => console.log(line),
  });

  /*
   * Write the pack back when pictures moved onto the shared library.
   *
   * `generateImages` repoints each question at `portraits/<musician>.png` as it
   * goes, and that only counts for anything if it is saved — otherwise the
   * files are filed under the new names and the pack still asks for the old
   * ones, so the round shows nothing. The console does this too; the two must
   * agree, because generating at home and committing is the normal route.
   *
   * `allowProblems` for the same reason the console has it: a bad question
   * somewhere else in the quiz must not stop the pictures being filed.
   */
  if (repointed.length) {
    saveQuiz(config.quizDir, quiz.id, quiz, { allowProblems: true });
    console.log(`\n${repointed.length} question${repointed.length === 1 ? '' : 's'} moved onto the shared picture library.`);
  }

  console.log(`\nDone. ${made.length} made, ${skipped.length} already there${failed.length ? `, ${failed.length} failed` : ''}.`);
  console.log(`Files are in ${config.imageDir}\n`);
  if (made.length || repointed.length) {
    console.log('Commit them, or the live app will not have them:');
    console.log('  git add images/ quizzes/ && git commit -m "Round 2 pictures" && git push\n');
  }
}

main().catch((err) => {
  console.error('\n' + err.message + '\n');
  process.exit(1);
});
