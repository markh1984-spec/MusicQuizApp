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
 */

import { config } from '../src/config.js';
import { loadQuiz } from '../src/quizzes.js';
import { generateImages } from '../src/generate-images.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const argOf = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

async function main() {
  const quizId = argOf('--quiz', 'eighties');
  const quiz = loadQuiz(config.quizDir, quizId);

  const { made, skipped, failed } = await generateImages({
    quiz,
    imageDir: config.imageDir,
    provider: has('--placeholder') ? 'placeholder' : argOf('--provider', 'placeholder'),
    only: argOf('--only', ''),
    force: has('--force'),
    log: (line) => console.log(line),
  });

  console.log(`\nDone. ${made.length} made, ${skipped.length} skipped${failed.length ? `, ${failed.length} failed` : ''}.`);
  console.log(`Files are in ${config.imageDir}\n`);
  if (made.length) {
    console.log('Commit them, or the live app will not have them:');
    console.log('  git add images/ && git commit -m "Round 2 pictures" && git push\n');
  }
}

main().catch((err) => {
  console.error('\n' + err.message + '\n');
  process.exit(1);
});
