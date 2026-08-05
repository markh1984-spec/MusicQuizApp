/**
 * Writing a quiz with Claude.
 *
 * Used by both the console's "New quiz" button and the command-line script, so
 * there is one house style and one set of rules rather than two that drift
 * apart.
 *
 * This never runs during a gig. You run it beforehand, it writes a JSON file
 * into /quizzes, and then you read every question in the editor. That review
 * step is the point — this gets you ninety per cent of the way and you catch
 * the howler.
 */

import fs from 'node:fs';
import path from 'node:path';

import { normaliseQuiz, validateQuiz } from './quizzes.js';

export const DEFAULT_MODEL = 'claude-sonnet-4-5';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

/**
 * The house style.
 *
 * Everything in here exists because of how the room actually behaves: British
 * charts because the crowds are Essex, Kent and Surrey; British spelling
 * because it goes on a big screen; unambiguous answers because an argument at
 * the bar is worse than an easy question.
 */
export function houseStyle({ theme, hard }) {
  return `
You are writing questions for a live pub music quiz in the south east of England
(Essex, Kent and Surrey). The host is a professional and the room is paying to be
there, so getting a fact wrong is the worst possible outcome.

Rules, all of them important:

- BRITISH throughout. UK chart positions, British spelling ("favourite", "colour"),
  British references. Never use Billboard positions.
- Every question has exactly FOUR options and exactly ONE defensible answer.

- CHECK THE THREE WRONG OPTIONS ONE AT A TIME. For each, ask "could somebody who
  knows this subject well argue that this is also correct?" If the answer is yes
  for any of them, replace that option or write a different question. A player who
  is marked wrong while being right will argue in front of the room, and they will
  be correct. This is the single worst thing that can happen.

  Be especially careful with: relationships and who-dated-whom; anything using the
  words "only", "first", "last" or "previously"; and superlatives like
  "biggest-selling". These almost always have a second defensible answer.

- THE FACT YOU READ OUT MUST NOT UNDERMINE THE ANSWER. If the "answerNote"
  mentions one of the other three options in a way that makes it sound correct
  too, the question is broken. Write the note first if it helps, then check the
  options against it.

- NEVER write a question whose correct answer contradicts its own premise. If the
  question asks "which band did they leave", the answer cannot be "they were never
  in a band". Rewrite the question so the premise is true.

- Only state facts you are confident are correct. If you are unsure of a chart
  position, a date, or whether something actually reached number one, write a
  different question rather than guessing. "Number two" and "number one" are not
  close enough. An approximately-right answer is a wrong answer in a pub.

- The three wrong options must be plausible to somebody who half-knows the answer:
  same era, same genre, comparable fame. Never pad with something obviously silly.
- Keep each question under about 110 characters so it reads from the back of a room.
- Vary the shape: some artist questions, some song questions, some album questions,
  some chart trivia, some "which of these did NOT..." questions.
- Aim at a general pub crowd${hard ? ', but pitch these harder than usual — this room knows its stuff' : ''}.
- Include a short "answerNote": one interesting line the host can read out on the
  reveal. Keep it to a single sentence.

The theme for this quiz is: ${theme}
`.trim();
}

function roundBriefs({ theme, perRound }) {
  return {
    text: `Round type "text": general knowledge about ${theme}.`,

    image: `Round type "image": each question shows an illustrated portrait of a musician
and asks "Whose face is this?". Pick ${perRound} musicians who fit "${theme}" and whose
faces a pub crowd would actually recognise. The four options are four musician names —
the correct one plus three plausible contemporaries.
Also give each question an "imagePrompt": a prompt for an image generator asking for a
bold stylised digital illustration (explicitly a drawing, not a photograph) of that
musician, head and shoulders, dramatic lighting, plain dark background, and no text
anywhere in the image.
Set "prompt" to exactly "Whose face is this?" for every question in this round.`,

    intro: `Round type "intro": the host plays the opening seconds of a track from their own
music app, and the screen shows only the question and four possible track titles.
Choose ${perRound} tracks fitting "${theme}" with intros a pub crowd would recognise within
a few seconds. The four options are four track titles by the SAME artist where possible,
or by very similar artists, so it is not a giveaway.
Set "prompt" to exactly "Which track is this?" for every question in this round.
Give each question a "cue" object with "title", "artist", "from" (a timestamp like "0:00")
and "hint" (a short instruction to the host, e.g. "let the riff run about 6 seconds").
The cue is shown ONLY on the host's private phone and never on the big screen.`,
  };
}

/**
 * The checking pass.
 *
 * A second call, framed as somebody else's job: checking another writer's work
 * rather than admiring your own. That framing matters — a model asked "is this
 * good?" says yes, and a model told "find the errors, there are some" actually
 * looks.
 *
 * It only ever REJECTS. It never rewrites, because a rewrite would itself be
 * unchecked. We over-ask for questions, throw away the ones that fail, and keep
 * the survivors — so the output is questions that two separate passes agreed
 * were sound.
 */
const CHECKER_SYSTEM = `
You are checking a music quiz written by somebody else, before it is used by a
professional host in a paying room. Your job is to find what is wrong with it.

Assume there ARE mistakes — there usually are. You are not being polite, and you
are not grading effort. A question that reaches the room with a fault in it
causes an argument the host loses in public.

Reject a question if ANY of these is true:

1. The marked answer is factually wrong.
2. Any of the other three options could ALSO be defended as correct by somebody
   who knows the subject. Check each of the three separately.
3. You are not confident the fact is true. "Probably right" is a rejection. Chart
   positions, release years and "number one" claims are the usual culprits —
   number two is not number one.
4. The question contradicts its own answer, or the answer makes the question
   nonsense.
5. The "answerNote" mentions one of the wrong options in a way that makes it look
   correct.
6. The question is ambiguous about which time period, chart, or release it means.

Do NOT reject a question merely for being easy, or obscure, or not to your taste.
Only correctness and ambiguity.
`.trim();

const CHECKER_SCHEMA = `
Reply with JSON and nothing else — no preamble, no markdown fence:

{
  "verdicts": [
    { "index": 0, "ok": true },
    { "index": 1, "ok": false, "reason": "Moseley Shoals reached number two, not number one" }
  ]
}

One verdict per question, using the index shown. Give a reason of at most 20
words for every rejection. Be specific about what is wrong.
`.trim();

async function checkQuestions({ questions, apiKey, model, log }) {
  const listing = questions.map((q, i) => {
    const lines = [
      `[${i}] ${q.prompt}`,
      ...q.options.map((o, oi) => `    ${oi === q.correctIndex ? 'ANSWER >' : '        '} ${o}`),
    ];
    if (q.answerNote) lines.push(`    fact: ${q.answerNote}`);
    if (q.cue) lines.push(`    plays: ${q.cue.title} by ${q.cue.artist}`);
    return lines.join('\n');
  }).join('\n\n');

  const result = await askClaude({
    system: CHECKER_SYSTEM,
    prompt: `Check these ${questions.length} questions.\n\n${listing}\n\n${CHECKER_SCHEMA}`,
    apiKey,
    model,
  });

  const verdicts = new Map();
  for (const v of result.verdicts || []) {
    if (Number.isInteger(v.index)) verdicts.set(v.index, v);
  }
  // A question the checker forgot to mention is treated as unchecked, not as
  // passed. Silence is not approval.
  return questions.map((q, i) => {
    const v = verdicts.get(i);
    if (!v) return { question: q, ok: false, reason: 'the check did not cover this one' };
    return { question: q, ok: v.ok !== false, reason: v.reason || '' };
  });
}

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

async function askClaude({ system, prompt, apiKey, model }) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!res.ok) throw new Error(`Claude said ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
    const a = cleaned.indexOf('{');
    const b = cleaned.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error('Claude did not return usable JSON');
  }
}

function roundTitle(type, index, theme) {
  const ordinal = ['One', 'Two', 'Three', 'Four', 'Five'][index] || String(index + 1);
  if (type === 'image') return `Round ${ordinal} — Whose Face Is This?`;
  if (type === 'intro') return `Round ${ordinal} — Name That Intro`;
  return `Round ${ordinal} — ${titleCase(theme)}`;
}

function roundBlurb(type, theme, perRound) {
  if (type === 'image') return 'The picture pulls back as the clock runs down. Guess early, score more.';
  if (type === 'intro') return `${perRound} intros. You get the first few seconds and nothing else.`;
  return `${perRound} questions on ${theme}`;
}

/**
 * @param {object} opts
 * @param {object} opts.config           app config (needs quizDir)
 * @param {string} opts.theme            "the 1990s", "Harry Potter soundtracks", …
 * @param {string[]} [opts.rounds]       which round types, in order
 * @param {number} [opts.perRound]       questions per round
 * @param {boolean} [opts.hard]
 * @param {string} [opts.id]             filename, without .json
 * @param {string} [opts.title]
 * @param {function(string): void} [opts.log]
 */
export async function generateQuizPack({
  config,
  theme,
  rounds = ['text', 'image', 'intro'],
  perRound = 10,
  hard = false,
  id,
  title,
  model = DEFAULT_MODEL,
  check = true,
  log = () => {},
  now = () => Date.now(),
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Set ANTHROPIC_API_KEY to write quizzes');
  if (!theme || !theme.trim()) throw new Error('Give it a theme');

  const quizId = id || slug(theme);
  const quizTitle = title || `The ${titleCase(theme)} Music Quiz`;
  const system = houseStyle({ theme, hard });
  const briefs = roundBriefs({ theme, perRound });

  const built = [];
  const rejected = [];

  for (let i = 0; i < rounds.length; i++) {
    const type = rounds[i];
    const brief = briefs[type];
    if (!brief) throw new Error(`Unknown round type "${type}". Use text, image or intro.`);

    // Ask for extra when we are going to check, because checking throws some
    // away and coming up short would mean a round of nine.
    const ask = check ? perRound + 4 : perRound;

    log(`round ${i + 1} of ${rounds.length} (${type}) — writing ${ask} questions…`);
    const result = await askClaude({
      system,
      prompt: `Write ${ask} questions for a music quiz.\n\n${brief}\n\n${SCHEMA_NOTE}`,
      apiKey,
      model,
    });

    let questions = (result.questions || []);
    if (!questions.length) throw new Error(`round ${i + 1} came back empty`);
    log(`  got ${questions.length}`);

    if (check) {
      log(`  checking them…`);
      const verdicts = await checkQuestions({ questions: questions.slice(0, ask), apiKey, model, log });
      const good = verdicts.filter((v) => v.ok).map((v) => v.question);
      const bad = verdicts.filter((v) => !v.ok);

      for (const b of bad) {
        rejected.push({ round: i + 1, prompt: b.question.prompt, reason: b.reason });
        log(`  rejected: ${b.question.prompt.slice(0, 60)}${b.question.prompt.length > 60 ? '…' : ''} — ${b.reason}`);
      }

      if (good.length >= perRound) {
        questions = good;
        log(`  ${good.length} passed, keeping ${perRound}`);
      } else {
        // Rather than a short round, top up with the ones that failed and say
        // so loudly — a round of six is useless, and you are reading it anyway.
        const topUp = bad.slice(0, perRound - good.length).map((b) => b.question);
        questions = [...good, ...topUp];
        log(`  only ${good.length} passed — keeping ${topUp.length} that did not, READ THESE CAREFULLY`);
      }
    }

    questions = questions.slice(0, perRound);

    built.push({
      id: `r${i + 1}`,
      type,
      title: roundTitle(type, i, theme),
      blurb: roundBlurb(type, theme, perRound),
      ...(type === 'image' ? { imageCaption: 'AI-generated illustration — not a real photograph' } : {}),
      questions: questions.map((q, qi) => ({
        id: `r${i + 1}q${qi + 1}`,
        prompt: String(q.prompt || '').trim(),
        options: (q.options || []).slice(0, 4).map((o) => String(o).trim()),
        correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
        ...(q.answerNote ? { answerNote: String(q.answerNote).trim() } : {}),
        ...(type === 'image'
          ? {
              image: `${quizId}/${slug(q.options?.[q.correctIndex] || 'face-' + (qi + 1))}.png`,
              ...(q.imagePrompt ? { imagePrompt: String(q.imagePrompt) } : {}),
              zoomFrom: 6,
            }
          : {}),
        ...(type === 'intro' && q.cue
          ? { cue: { title: q.cue.title || '', artist: q.cue.artist || '', from: q.cue.from || '0:00', hint: q.cue.hint || '' } }
          : {}),
      })),
    });
  }

  const quiz = normaliseQuiz({
    id: quizId,
    title: quizTitle,
    subtitle: 'Three rounds. Twenty seconds a question. Fastest fingers win.',
    questionSeconds: 20,
    createdAt: new Date(now()).toISOString(),
    notes: `Written by ${model} for "${theme}". NOT YET REVIEWED — read every question in the editor before the gig.`,
    rounds: built,
  }, quizId);

  const problems = validateQuiz(quiz);
  // Written even with problems, because fixing them in the editor beats
  // regenerating the whole pack.
  fs.mkdirSync(config.quizDir, { recursive: true });
  const file = path.join(config.quizDir, quizId + '.json');
  fs.writeFileSync(file, JSON.stringify(quiz, null, 2) + '\n', 'utf8');
  log(`saved ${quizId}.json`);

  const needsImages = built.some((r) => r.type === 'image');
  return { quiz, problems, file, needsImages, rejected, checked: check };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'quiz';
}

function titleCase(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}
