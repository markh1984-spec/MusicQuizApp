#!/usr/bin/env node
/**
 * Write a quiz pack with Claude, from the command line.
 *
 * The console has a button that does the same thing — this is here for when
 * you would rather type, or want to script a batch of them.
 *
 * Needs ANTHROPIC_API_KEY. A full three-round pack costs a few pence.
 *
 * Usage:
 *   npm run generate:quiz -- --theme "the 1990s"
 *   npm run generate:quiz -- --theme "Motown" --id motown-night --rounds text,intro
 *   npm run generate:quiz -- --theme "the 2000s" --rounds text:15,image:5,alphabet:10
 *
 * Options:
 *   --theme      what the quiz is about (default "the 1990s")
 *   --decade     same thing, kept so older notes still work
 *   --id         filename to write, without .json
 *   --title      quiz title
 *   --rounds     which rounds, in order (default text,image,intro). Put a count
 *                on any of them with a colon — "text:15,image:5" — and the rest
 *                fall back to --questions.
 *   --questions  how many per round for rounds that do not name a count (default 10)
 *   --hard       pitch it at a room that knows its stuff
 *   --no-check   skip the second pass that checks the answers (faster, worse)
 *   --model      which Claude model to use
 */

import { config } from '../src/config.js';
import { generateQuizPack, DEFAULT_MODEL, roundPlan } from '../src/generate-quiz.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const theme = argOf('--theme', argOf('--decade', 'the 1990s'));
const perRound = Number(argOf('--questions', '10'));
// "text:15" is fifteen general knowledge; a bare "text" takes --questions.
const rounds = argOf('--rounds', 'text,image,intro')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [type, count] = s.split(':');
    return count ? { type: type.trim(), count: Number(count) } : type;
  });

async function main() {
  const plan = roundPlan(rounds, perRound);
  if (!plan.length) throw new Error(`No usable round types in "${argOf('--rounds', '')}".`);
  console.log(`\nWriting a quiz about "${theme}" — ${plan.map((r) => `${r.count} ${r.type}`).join(', ')}\n`);

  const { quiz, problems, file, needsImages, rejected } = await generateQuizPack({
    config,
    theme,
    rounds,
    perRound,
    hard: has('--hard'),
    check: !has('--no-check'),
    id: argOf('--id', ''),
    title: argOf('--title', ''),
    model: argOf('--model', DEFAULT_MODEL),
    log: (line) => console.log('  ' + line),
  });

  console.log(`\nWritten to ${file}`);

  if (rejected.length) {
    console.log(`\nThe check threw out ${rejected.length}:`);
    for (const r of rejected) console.log(`  - ${r.prompt}\n      ${r.reason}`);
  }

  if (problems.length) {
    console.log(`\n${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before this will play:`);
    for (const p of problems) console.log('  - ' + p);
  }

  console.log(`
NOW READ IT. Start the app and open the editor:

  npm start
  then go to /editor and pick "${quiz.title}"

Check every question. Claude is good at this and still gets things wrong, and
the room will not forgive a wrong answer.
`);

  if (needsImages) {
    console.log(`Then make the pictures for the face round:

  npm run generate:images -- --quiz ${quiz.id} --placeholder      (free stand-ins)
  npm run generate:images -- --quiz ${quiz.id} --provider openai  (real artwork)
`);
  }
}

main().catch((err) => {
  console.error('\n' + err.message + '\n');
  process.exit(1);
});
