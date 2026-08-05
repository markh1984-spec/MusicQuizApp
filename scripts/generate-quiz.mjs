#!/usr/bin/env node
/**
 * Write a quiz pack with Claude, ahead of the gig.
 *
 * This never runs during a quiz. You run it the day before, it writes a JSON
 * file into /quizzes, and then you open the editor and read every question
 * before anyone sees it. That review step is the point — this script gets you
 * ninety per cent of the way, and you catch the howler.
 *
 * Needs ANTHROPIC_API_KEY. A full three-round pack costs a few pence.
 *
 * Usage:
 *   node scripts/generate-quiz.mjs --decade 1990s
 *   node scripts/generate-quiz.mjs --decade 1980s --id eighties-night-2 --rounds text,image,intro
 *   node scripts/generate-quiz.mjs --decade 2000s --questions 10 --hard
 *
 * Options:
 *   --decade    1970s, 1980s, 1990s, 2000s, 2010s   (default 1990s)
 *   --id        filename to write, without .json     (default from the decade)
 *   --title     quiz title                           (default from the decade)
 *   --rounds    which rounds to write                (default text,image,intro)
 *   --questions how many per round                   (default 10)
 *   --hard      make them harder than a normal pub crowd expects
 *   --model     which Claude model to use
 */

import fs from 'node:fs';
import path from 'node:path';

import { config } from '../src/config.js';
import { normaliseQuiz, validateQuiz } from '../src/quizzes.js';

const MODEL = 'claude-sonnet-4-5';
const API = 'https://api.anthropic.com/v1/messages';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (name, fallback = '') => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const decade = argOf('--decade', '1990s');
const perRound = Number(argOf('--questions', '10'));
const roundTypes = argOf('--rounds', 'text,image,intro').split(',').map((s) => s.trim()).filter(Boolean);
const quizId = argOf('--id', decade.replace(/[^a-z0-9]/gi, '').toLowerCase());
const quizTitle = argOf('--title', `The ${decade} Music Quiz`);
const model = argOf('--model', MODEL);
const hard = has('--hard');

/**
 * The house style. Everything in here exists because of how the room actually
 * behaves: British charts because the crowds are Essex, Kent and Surrey;
 * British spelling because it goes on a big screen; unambiguous answers
 * because an argument at the bar is worse than an easy question.
 */
const HOUSE_STYLE = `
You are writing questions for a live pub music quiz in the south east of England
(Essex, Kent and Surrey). The host is a professional and the room is paying to be
there, so getting a fact wrong is the worst possible outcome.

Rules, all of them important:

- BRITISH throughout. UK chart positions, British spelling ("favourite", "colour"),
  British references. Never use Billboard positions.
- Every question has exactly FOUR options and exactly ONE defensible answer. If a
  question could be argued at the bar, do not write it.
- Only state facts you are confident are correct. If you are unsure of a chart
  position or a date, write a different question rather than guessing. An
  approximately-right answer is a wrong answer in a pub.
- The three wrong options must be plausible to somebody who half-knows the answer:
  same era, same genre, comparable fame. Never pad with something obviously silly.
- Keep each question under about 110 characters so it reads from the back of a room.
- Vary the shape: some artist questions, some song questions, some album questions,
  some chart trivia, some "which of these did NOT..." questions.
- Aim at a general pub crowd who lived through the decade${hard ? ', but pitch these harder than usual — this room knows its stuff' : ''}.
- Include a short "answerNote": one interesting line the host can read out on the
  reveal. Keep it to a single sentence.
`.trim();

const ROUND_BRIEFS = {
  text: `Round type "text": general knowledge about the music of the ${decade}.`,

  image: `Round type "image": each question shows an illustrated portrait of a musician
and asks "Whose face is this?". Pick ${perRound} musicians who were famous in the ${decade}
and whose faces a pub crowd would actually recognise. The four options are four
musician names — the correct one plus three plausible contemporaries.
Also give each question an "imagePrompt": a prompt for an image generator asking for a
bold stylised digital illustration (explicitly a drawing, not a photograph) of that
musician in their ${decade} look, head and shoulders, dramatic lighting, plain dark
background, and no text anywhere in the image.
Set "prompt" to exactly "Whose face is this?" for every question in this round.`,

  intro: `Round type "intro": the host plays the opening seconds of a track from their own
music app, and the screen shows only the question and four possible track titles.
Choose ${perRound} tracks from the ${decade} with intros a pub crowd would recognise within
a few seconds. The four options are four track titles by the SAME artist where possible,
or by very similar artists, so it is not a giveaway.
Set "prompt" to exactly "Which track is this?" for every question in this round.
Give each question a "cue" object with "title", "artist", "from" (a timestamp like "0:00")
and "hint" (a short instruction to the host, e.g. "let the riff run about 6 seconds").
The cue is shown ONLY on the host's private phone and never on the big screen.`,
};

const SCHEMA_NOTE = `
Reply with JSON and nothing else — no preamble, no markdown fence. Shape:

{
  "questions": [
    {
      "prompt": "the question as it appears on the big screen",
      "options": ["one", "two", "three", "four"],
      "correctIndex": 0,
      "answerNote": "one interesting sentence for the host to read out"
      // plus "imagePrompt" for an image round, or "cue" for an intro round
    }
  ]
}

correctIndex is the 0-based position of the right answer. Vary which position it
lands in across the round — do not put the answer in slot A every time.
`.trim();

async function askClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('\nSet ANTHROPIC_API_KEY first:\n  export ANTHROPIC_API_KEY=sk-ant-...\n');
    process.exit(1);
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: HOUSE_STYLE,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude said ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return parseJson(text);
}

/** Models sometimes wrap JSON in a fence however firmly you ask them not to. */
function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Claude did not return usable JSON');
  }
}

const ROUND_TITLES = {
  text: `Round One — The ${decade}`,
  image: 'Round Two — Whose Face Is This?',
  intro: 'Round Three — Name That Intro',
};
const ROUND_BLURBS = {
  text: `Ten questions on the music of the ${decade}`,
  image: 'The picture pulls back as the clock runs down. Guess early, score more.',
  intro: 'Ten intros. You get the first few seconds and nothing else.',
};

async function buildRound(type, index) {
  process.stdout.write(`  round ${index + 1} (${type}) … `);
  const brief = ROUND_BRIEFS[type];
  if (!brief) throw new Error(`Unknown round type "${type}". Use text, image or intro.`);

  const result = await askClaude(
    `Write ${perRound} questions for a ${decade} music quiz.\n\n${brief}\n\n${SCHEMA_NOTE}`,
  );
  const questions = (result.questions || []).slice(0, perRound);
  if (!questions.length) throw new Error('no questions came back');

  process.stdout.write(`${questions.length} questions\n`);

  return {
    id: `r${index + 1}`,
    type,
    title: ROUND_TITLES[type] || `Round ${index + 1}`,
    blurb: ROUND_BLURBS[type] || '',
    ...(type === 'image' ? { imageCaption: 'AI-generated illustration — not a real photograph' } : {}),
    questions: questions.map((q, qi) => ({
      id: `r${index + 1}q${qi + 1}`,
      prompt: String(q.prompt || '').trim(),
      options: (q.options || []).slice(0, 4).map((o) => String(o).trim()),
      correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
      ...(q.answerNote ? { answerNote: String(q.answerNote).trim() } : {}),
      ...(type === 'image'
        ? {
            image: `${quizId}/${slug(q.options?.[q.correctIndex] || 'face-' + (qi + 1))}.png`,
            imagePrompt: q.imagePrompt ? String(q.imagePrompt) : undefined,
            zoomFrom: 6,
          }
        : {}),
      ...(type === 'intro' && q.cue
        ? { cue: { title: q.cue.title || '', artist: q.cue.artist || '', from: q.cue.from || '0:00', hint: q.cue.hint || '' } }
        : {}),
    })),
  };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'face';
}

async function main() {
  console.log(`\nWriting "${quizTitle}" — ${roundTypes.length} rounds of ${perRound}, using ${model}\n`);

  const rounds = [];
  for (let i = 0; i < roundTypes.length; i++) {
    rounds.push(await buildRound(roundTypes[i], i));
  }

  const quiz = normaliseQuiz({
    id: quizId,
    title: quizTitle,
    subtitle: 'Three rounds. Twenty seconds a question. Fastest fingers win.',
    questionSeconds: 20,
    createdAt: new Date().toISOString(),
    notes: `Written by ${model}. NOT YET REVIEWED — read every question in the editor before the gig.`,
    rounds,
  }, quizId);

  const problems = validateQuiz(quiz);
  const file = path.join(config.quizDir, quizId + '.json');
  fs.mkdirSync(config.quizDir, { recursive: true });
  // Written even if there are problems, because fixing them in the editor is
  // easier than regenerating the whole pack.
  fs.writeFileSync(file, JSON.stringify(quiz, null, 2) + '\n', 'utf8');

  console.log(`\nWritten to ${file}`);
  if (problems.length) {
    console.log(`\n${problems.length} thing${problems.length === 1 ? '' : 's'} need${problems.length === 1 ? 's' : ''} fixing before this will play:`);
    for (const p of problems) console.log('  - ' + p);
  }

  console.log(`
NOW READ IT. Start the app and open the editor:

  npm start
  then go to /editor and pick "${quizTitle}"

Check every question. Claude is good at this and still gets things wrong, and
the room will not forgive a wrong answer.
`);

  if (roundTypes.includes('image')) {
    console.log(`Then make the pictures for round 2:

  node scripts/generate-images.mjs --quiz ${quizId} --placeholder     (free stand-ins)
  node scripts/generate-images.mjs --quiz ${quizId} --provider openai (real artwork)
`);
  }
}

main().catch((err) => {
  console.error('\n' + err.message + '\n');
  process.exit(1);
});
