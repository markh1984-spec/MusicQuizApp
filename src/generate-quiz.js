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

import { normaliseQuiz, validateQuiz, MULTI_OPTIONS, ROUND_TYPES, answerLetter } from './quizzes.js';
import { cleanTheme, quizTitleFor, themeSlug, titleCase } from './theme.js';
import { spotifyConfigured, findTrack, createPlaylist } from './spotify.js';
import { portraitPath } from './portraits.js';
import { balanceAnswers } from '../public/assets/balance.js';
// Not asking the same thing twice across the catalogue. Keyed on the ANSWER,
// because two questions with the same answer are the same question to a room.
import { answersInCatalogue, filterSeen, avoidAnswers, DEFAULT_MONTHS as ANSWER_MONTHS } from './question-history.js';
// Reading the last month of the actual world. One digest, read once, given to
// the writer AND the checker — see src/research.js for why it must be one.
import { researchDigest, digestBlock, worthCaching, DEFAULT_DAYS as RESEARCH_DAYS } from './research.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * The checking pass uses a stronger model than the writing pass.
 *
 * Writing questions is a fluency job; catching a wrong chart position is a
 * knowledge job, and it is the one that costs you in front of a room. It is one
 * call per round, so the extra is pennies. If the account cannot reach this
 * model we quietly fall back to the writing model rather than failing.
 */
export const CHECKER_MODEL = process.env.CHECKER_MODEL || 'claude-opus-5';

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
- SPREAD THE NAMES ACROSS THE ROUND. No artist, act or title should appear as an
  option in more than two questions — as a wrong option or a right one. "Same era,
  same genre" above is about ONE question; across ten it pulls everything towards
  the same handful of names, and a room notices somebody who keeps coming round
  long before it notices anything else about the writing.
- Keep each question under about 110 characters so it reads from the back of a room.
- Vary the shape: some artist questions, some song questions, some album questions,
  some chart trivia, some "which of these did NOT..." questions.
- Aim at a general pub crowd${hard ? ', but pitch these harder than usual — this room knows its stuff' : ''}.
- Include a short "answerNote": one interesting line the host can read out on the
  reveal. Keep it to a single sentence.

The theme for this quiz is: ${theme}
`.trim();
}

/**
 * How many questions of each type, in order.
 *
 * The generator used to take one number and apply it to every round, which is
 * not how a quiz night is actually shaped: fifteen general knowledge, five
 * pictures and ten of something else is a normal Wednesday, and "ten of
 * everything" is not. So `rounds` may be a list of type names (each gets the
 * fallback count) or a list of `{ type, count }`, and everything downstream
 * works from the plan rather than from a single number.
 *
 * Anything not in ROUND_TYPES is dropped here rather than deeper in, so a
 * typo cannot silently become a round of general knowledge.
 *
 * Three optional things an entry may also carry, all of them added for the
 * topical quiz and all of them useful on their own:
 *
 * - `focus` — what THIS round is about, where the quiz's theme is what the
 *   whole pack is about. A topical night is one round of news and one round of
 *   music, which are two different subjects inside one quiz, and before this
 *   there was no way to say so.
 * - `topical` — this round is written from the news digest rather than from
 *   what the model already knows. Per round, not per pack, because a topical
 *   quiz deliberately ends on an evergreen round.
 * - `label` — what it is called on the projector. Derived from the theme
 *   otherwise, which is right for a quiz about one subject and wrong for a
 *   round that has its own.
 *
 * @param {Array<string|{type: string, count: number, focus?: string, topical?: boolean, label?: string}>} rounds
 * @param {number} fallback  the count for an entry that does not carry one
 */
export function roundPlan(rounds, fallback = 10) {
  const list = Array.isArray(rounds) ? rounds : [];
  const out = [];
  for (const entry of list) {
    const type = typeof entry === 'string' ? entry : String(entry && entry.type || '');
    if (!ROUND_TYPES.includes(type)) continue;
    const opts = typeof entry === 'object' && entry ? entry : {};
    const asked = Number(opts.count);
    const count = Number.isFinite(asked) ? asked : Number(fallback);
    const text = (v, cap) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, cap);
    out.push({
      type,
      // A round of nought is not a round; a round of fifty is a night on its own.
      count: Math.min(30, Math.max(1, Math.round(count) || 1)),
      ...(text(opts.focus, 200) ? { focus: text(opts.focus, 200) } : {}),
      ...(text(opts.label, 60) ? { label: text(opts.label, 60) } : {}),
      ...(opts.topical ? { topical: true } : {}),
    });
  }
  return out;
}

/**
 * The topical quiz — the shape of a week's news as a quiz night.
 *
 * Twenty general knowledge, ten music, then ten music from any era. The last
 * round is the one worth explaining: a quiz made ENTIRELY of the last month is
 * a quiz that punishes anybody who was on holiday, and the room notices about
 * question thirty. It also gives the host somewhere to go if the month was
 * quiet. Evergreen last so the night ends on ground everybody stands on.
 *
 * The split between news and music is twenty to ten because that is roughly
 * how much of either a month actually produces that a pub crowd would have
 * heard about — the other way round and the music round is scraping.
 */
export const TOPICAL_ROUNDS = [
  {
    type: 'text',
    count: 20,
    topical: true,
    label: 'The Month Just Gone',
    focus: 'news, sport, television, film and popular culture from the last month',
  },
  {
    type: 'text',
    count: 10,
    topical: true,
    label: 'Music This Month',
    focus: 'music news from the last month — releases, chart positions, tours, awards and reunions',
  },
  {
    type: 'text',
    count: 10,
    label: 'Music',
    focus: 'music from any era — a general pub music round, nothing to do with the last month',
  },
];

/**
 * How long a topical pack is worth running.
 *
 * A fortnight, not a week. It is written for this week, but the same quiz gets
 * a second outing at another venue seven days later — that is the whole
 * economics of writing one — and after that the news has moved on and the room
 * is being asked about things it has stopped talking about.
 */
export const TOPICAL_DAYS = 14;

/** What a topical pack is called and filed as. Derived from the date, so two in one week do not collide. */
export function topicalNaming(now = Date.now(), { hard = false } = {}) {
  const day = new Date(now).toISOString().slice(0, 10);
  const pretty = new Date(now).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  });
  return {
    id: `topical-${day}${hard ? '-hard' : ''}`,
    title: `The Topical Quiz${hard ? ' — Hard' : ''} — ${pretty}`,
    theme: 'the last month',
  };
}

/** Is there a generation brief for this round type? Used by the tests. */
export function roundBriefsFor(type) {
  return roundBriefs({ theme: 'anything', count: 10 })[type] || null;
}

function roundBriefs({ theme, count, focus = '' }) {
  const perRound = count;
  // What this ROUND is about, which is the quiz's theme unless the round says
  // otherwise. A topical night is one round of news and one of music inside
  // one pack, so the two are no longer the same question.
  const about = focus || theme;
  return {
    text: `Round type "text": general knowledge about ${about}.`,

    image: `Round type "image": each question shows an illustrated portrait of a musician
and asks "Whose face is this?". Pick ${perRound} musicians who fit "${about}" and whose
faces a pub crowd would actually recognise. The four options are four musician names —
the correct one plus three plausible contemporaries.
Also give each question an "imagePrompt": a short description of WHO to draw and what
makes them recognisable — the era, the hair, the clothes, the look they are known for.
Describe the PERSON ONLY. Do not name an artistic style, a medium, or how the picture
should be made: the host chooses that in the app, and naming one here fights with it.
Set "prompt" to exactly "Whose face is this?" for every question in this round.`,

    intro: `Round type "intro": the host plays the opening seconds of a track from their own
music app, and the screen shows only the question and four possible track titles.
Choose ${perRound} tracks fitting "${about}" with intros a pub crowd would recognise within
a few seconds. The four options are four track titles by the SAME artist where possible,
or by very similar artists, so it is not a giveaway.
Set "prompt" to exactly "Which track is this?" for every question in this round.
Give each question a "cue" object with "title", "artist", "from" and "hint" (a short
instruction to the host, e.g. "let the riff run about 6 seconds").
Set "from" to exactly "0:00" on every question. It is how far into the track playback
starts, and only somebody who has LISTENED to the track knows where its audio begins —
a plausible-looking guess would skip real seconds of a real song in front of a room.
The cue is shown ONLY on the host's private phone and never on the big screen.`,

    multi: `Round type "multi": several answers are right and the room has to lock in ALL of
them. Write ${perRound} questions fitting "${about}".

Each question has SIX options and a "correctIndexes" array — NOT a "correctIndex" —
listing the positions (0-5) of every correct one. Use two or three correct answers per
question; vary which, so the room cannot settle into a pattern.

This shape only works when membership of the set is a genuine fact, not a judgement.
Good: "which three of these were UK number ones", "which two of these are on Rumours",
"which three of these were released in 1985". Bad: anything involving "best", "most
famous" or "influential" — with six options and part marks on offer, a fuzzy boundary
is six arguments rather than one.

The wrong options must be as plausible as the right ones and from the same era or act,
so nobody can pick by elimination. Do not let the correct answers be the longest, the
shortest, or all bunched at one end.

Set "prompt" so it states plainly what makes an option correct, e.g. "Which three of
these Blur singles reached the UK top 10?". The screen tells the room how many to pick,
so do not write the number into the option text.

IF YOU NAME A NUMBER IN THE QUESTION, "correctIndexes" MUST HAVE EXACTLY THAT MANY
ENTRIES. "Which three of these..." with two right answers is a broken question, and so
is "which three" with one. Count them before you write the number. If only one option
is genuinely correct, this is not a pick-them-all question at all — write a different
one.`,

    alphabet: `Round type "alphabet": there are NO options. The room is shown the question and
given a keyboard, and all they have to get right is the FIRST LETTER of the answer —
which means spelling does not matter and neither does the rest of the answer.

Write ${perRound} questions fitting "${about}". Give each one an "answer" field with the
answer written out in full, exactly as the host will read it aloud. Do NOT give options,
correctIndex or correctIndexes.

The whole round lives or dies on one thing: THERE MUST BE NO ARGUMENT ABOUT WHICH LETTER
THE ANSWER STARTS WITH. So:

- Never write an answer beginning with "The", "A" or "An". "The Beatles" is B to half a
  room and T to the other half, and both halves are right. Write "Beatles".
- Never write an answer that is commonly known by another name starting with a different
  letter — a stage name and a real name, an abbreviation and what it stands for, a
  British title and an American one. If somebody could reasonably give a different
  correct answer that starts with a different letter, the question is broken.
- Prefer answers that are one word or one name. A long phrase invites somebody to answer
  it a different way round.
- Say clearly in the question what KIND of thing you want back — the artist, the song,
  the city, the instrument — so nobody answers a different question correctly and gets
  the wrong letter for it.

Vary the letter across the round. Do not let half of them start with the same one.`,

    breakout: `Round type "breakout": a laugh, not a question — there is no right answer and
nothing is scored. The room TYPES whatever they like on their own phones, and the host
reads the funniest ones out loud, Blankety Blank style.

Write ${perRound} prompts fitting "${about}" that invite a short, funny, ONE-LINE typed
answer. A fill-in-the-blank ("Complete the lyric in your own words: 'I will always love
___'") and a daft hypothetical ("Write the worst possible name for a tribute act to
${about}") both work — the point is that any answer can be funny, because none is wrong.

Do NOT give an "answer", "options", "correctIndex" or "correctIndexes" — there is nothing
to mark right or wrong on this round. Set only "prompt".

Vary the SHAPE of the prompt from one to the next, so the round does not read as the same
joke six times.`,
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
7. On a question shown with an ANSWER and a first letter and no options: another
   correct answer to the same question starts with a DIFFERENT letter, or the
   answer is commonly known by another name starting with a different letter, or
   it begins with "The", "A" or "An". Any of those and the round is unplayable.

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

/**
 * How many questions go to the checker in one call.
 *
 * Small on purpose. The checker is the longest call in the app — a stronger
 * model, thinking, verifying every option of every question — and one call
 * covering fifteen questions is a single point of failure several minutes
 * long. It is what died on the host and took a whole two-round quiz with it.
 *
 * Small batches, run at the same time, means each call is short, a hang costs
 * one batch instead of the lot, and the wall clock goes down rather than up.
 * A "pick them all" question is the reason this matters: six options is six
 * facts to verify rather than four, so those batches are the slowest.
 */
const CHECK_BATCH = 6;

async function checkQuestions({ questions, apiKey, model, digest = '', log = () => {}, onSpend = () => {} }) {
  if (questions.length <= CHECK_BATCH) {
    return checkBatch({ questions, apiKey, model, digest, log, onSpend });
  }
  const batches = [];
  for (let i = 0; i < questions.length; i += CHECK_BATCH) {
    batches.push(questions.slice(i, i + CHECK_BATCH));
  }

  /*
   * With a news digest attached, the FIRST batch goes on its own.
   *
   * This looks like a pointless delay and is the opposite. The digest is a
   * couple of thousand tokens repeated on every batch, so it is cached — but
   * **concurrent requests cannot share a cache write.** Fire six batches at
   * once and all six arrive before any of them has finished writing the cache,
   * so all six pay full price for the same tokens and the cache is written six
   * times over. Send one, wait for it to land, and the other five read what it
   * wrote at a tenth of the price.
   *
   * Without a digest there is nothing worth caching, so nothing is bought by
   * waiting and the whole lot goes at once, exactly as before.
   */
  const run = (batch) => checkBatch({ questions: batch, apiKey, model, digest, log, onSpend });
  if (digest && batches.length > 1) {
    log(`  (in ${batches.length} batches — one first, then the rest together)`);
    const first = await run(batches[0]);
    const rest = await Promise.all(batches.slice(1).map(run));
    return [first, ...rest].flat();
  }

  log(`  (in ${batches.length} batches, at the same time)`);
  const done = await Promise.all(batches.map(run));
  return done.flat();
}

async function checkBatch({ questions, apiKey, model, digest = '', log = () => {}, onSpend = () => {} }) {
  const listing = questions.map((q, i) => {
    // An alphabet question has no options — what has to be checked is the
    // answer itself and, above all, that its first letter is not arguable.
    const lines = q.answer !== undefined && !(q.options || []).length
      ? [`[${i}] ${q.prompt}`, `    ANSWER > ${q.answer}  (first letter ${answerLetter(q.answer) || '?'})`]
      : [
          `[${i}] ${q.prompt}`,
          ...(q.options || []).map((o, oi) => `    ${oi === q.correctIndex ? 'ANSWER >' : '        '} ${o}`),
        ];
    if (q.answerNote) lines.push(`    fact: ${q.answerNote}`);
    if (q.cue) lines.push(`    plays: ${q.cue.title} by ${q.cue.artist}`);
    return lines.join('\n');
  }).join('\n\n');

  // The news, if this round was written from it. Cached, because every batch
  // of every topical round sends the identical block.
  const evidence = digestBlock(digest);
  const cache = Boolean(evidence) && worthCaching(CHECKER_SYSTEM, evidence);

  let result;
  try {
    result = await askClaude({
      system: CHECKER_SYSTEM,
      prompt: `Check these ${questions.length} questions.\n\n${listing}\n\n${CHECKER_SCHEMA}`,
      apiKey,
      model: CHECKER_MODEL,
      think: true,
      what: 'checked a batch',
      extra: evidence,
      cache,
      onSpend,
    });
  } catch (err) {
    // Most likely the account cannot reach the stronger model. Check with the
    // writing model rather than shipping unchecked questions.
    log(`  (checking with ${model} instead: ${err.message.slice(0, 80)})`);
    try {
      result = await askClaude({
        system: CHECKER_SYSTEM,
        prompt: `Check these ${questions.length} questions.\n\n${listing}\n\n${CHECKER_SCHEMA}`,
        apiKey,
        model,
        think: true,
        what: 'checked a batch (fallback model)',
        extra: evidence,
        cache,
        onSpend,
      });
    } catch (second) {
      /*
       * Both checkers are down, and this generation is minutes deep.
       *
       * Throwing here bins every question already written and paid for — the
       * whole quiz, for a failure in the step that is meant to make it safer.
       * So keep the questions and hand back "not checked" for all of them,
       * which the caller already knows how to be loud about. Unchecked is a
       * worse quiz; no quiz at all is a worse night.
       */
      log(`  COULD NOT CHECK THIS ROUND: ${second.message}`);
      log('  keeping the questions unchecked — read this round especially carefully');
      return questions.map((q) => ({ question: q, ok: true, unchecked: true, reason: '' }));
    }
  }

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

A "multi" round is the exception: it has SIX options and, instead of correctIndex, a
"correctIndexes" array listing every right position, e.g. "correctIndexes": [0, 2, 5].

An "alphabet" round is the other exception: no options and no correctIndex at all, just
"answer" with the answer written out in full.
`.trim();

/**
 * @param {object} opts
 * @param {boolean} [opts.think]  let the model reason before answering
 *
 * Thinking is ON by default on these models, is billed against the same
 * max_tokens as the answer, and returns no visible text — so a long reply can
 * spend its whole budget thinking and come back empty. Writing out questions
 * to a fixed shape does not need it and is turned off; the checking pass is a
 * judgement call, so it keeps thinking and gets the room to do it in.
 */
/**
 * @param {function(object): void} [onSpend]  told what the call actually cost.
 *   Threaded the same way `log` is, and defaulting to nothing, so every test
 *   and every script that calls a generator carries on working with no
 *   accounting attached. See src/spend.js.
 */
/**
 * @param {string} [extra]  a second system block — how the news digest is
 *   carried. It goes in the SYSTEM rather than in the prompt because the
 *   system is the part that stays identical from one call to the next, and a
 *   cache only pays on a prefix that repeats: the questions being checked
 *   change every time, the month's news does not. Its POSITION never changes
 *   either, whether or not it is cached, so the prompt is always the same
 *   shape.
 * @param {boolean} [cache]  put a cache breakpoint on the end of it. A
 *   breakpoint covers everything up to and including its own block, so the
 *   order is standing-instructions, then digest, then the varying prompt.
 *   Off when there is not enough to be worth it — below Anthropic's minimum a
 *   cache write is not free, it is a surcharge on tokens nothing will reuse.
 */
async function askClaude({ system, extra = '', cache = false, prompt, apiKey, model, think = false, what = '', onSpend = () => {} }) {
  const body = {
    model,
    max_tokens: think ? 16000 : 8000,
    system: extra
      ? [
          { type: 'text', text: system },
          { type: 'text', text: extra, ...(cache ? { cache_control: { type: 'ephemeral' } } : {}) },
        ]
      : system,
    messages: [{ role: 'user', content: prompt }],
  };
  if (!think) {
    body.thinking = { type: 'disabled' };
    body.output_config = { effort: 'low' };
  }

  // A call with no timeout can hang for as long as the socket stays open, and
  // the whole generation hangs with it — which from the console looks like the
  // connection dropping for no reason. Fail loudly instead.
  let res;
  try {
    res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(think ? 240_000 : 120_000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`${model} took too long to answer (over ${think ? 4 : 2} minutes)`);
    }
    throw err;
  }

  if (!res.ok) throw new Error(`Claude said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  /*
   * Recorded BEFORE the reply is parsed, on purpose.
   *
   * Anthropic bills for the tokens it generated whether or not what came back
   * was readable, and an unreadable reply is a thing this file expects and
   * retries. Recording after the parse would quietly leave every retry out of
   * the sums and flatter the cost of a difficult theme.
   */
  const usage = data.usage || {};
  onSpend({
    kind: 'claude',
    what,
    model,
    // The three input counts do not overlap: `input_tokens` is the UNCACHED
    // remainder. Adding them up and pricing the total as ordinary input is
    // exactly the mistake that would make caching look like it saved nothing.
    tokensIn: usage.input_tokens || 0,
    tokensOut: (usage.output_tokens || 0),
    cacheRead: usage.cache_read_input_tokens || 0,
    cacheWrite: usage.cache_creation_input_tokens || 0,
  });
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return parseJson(text);
}

/**
 * Read a reply that is MEANT to be JSON, and get the questions out of it
 * whatever state it is in.
 *
 * The bingo generator learned this the hard way and the quiz generator had
 * never been given it: a single malformed reply threw a raw parser message
 * ("Expected double-quoted property name in JSON at position 138") straight
 * through the whole job, binning fifteen questions and several minutes of real
 * money because ONE of three attempts came back untidy.
 *
 * Three passes, worst case:
 *
 *  1. parse it;
 *  2. parse from the first `{` to the last `}`, which handles a preamble or a
 *     fence the model added anyway;
 *  3. pick the question objects out one at a time with a regex. Fourteen whole
 *     ones and a fifteenth cut in half is not valid JSON, but it is fourteen
 *     questions and only ten are needed.
 *
 * @param {string} text
 * @param {string} [want]  the array to salvage — "questions" or "verdicts"
 */
export function parseJson(text, want = 'questions') {
  const cleaned = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');

  try {
    return JSON.parse(cleaned);
  } catch { /* fall through */ }

  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(cleaned.slice(a, b + 1));
    } catch { /* fall through */ }
  }

  // Salvage. Objects one nesting deep are matched too, because a question
  // carries an options array and an intro question carries a cue object.
  const found = [];
  for (const match of cleaned.matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)) {
    try {
      const item = JSON.parse(match[0]);
      if (item && (item.prompt || item.index !== undefined)) found.push(item);
    } catch { /* the half-written one at the end, which is the case this is for */ }
  }
  if (found.length) return { [want]: found };
  // Tagged, so `buildRound` can tell "that reply was gibberish, have another
  // go" apart from "the network went away" or "the call timed out" — the first
  // is worth retrying quietly, the other two the host needs telling about.
  throw Object.assign(new Error('Claude did not return usable JSON'), { unreadable: true });
}

/**
 * A round's own name beats the derived one.
 *
 * Every round used to be named after the quiz, which is right when the whole
 * pack is about one thing and wrong the moment a pack holds two subjects: a
 * topical night is "The Month Just Gone" and then "Music This Month", and
 * calling both of them "Round One — The Last Month" tells the room nothing.
 * The type-specific names still win, because "Whose Face Is This?" says what
 * to do rather than what it is about.
 */
function roundTitle(type, index, theme, label = '') {
  const ordinal = ['One', 'Two', 'Three', 'Four', 'Five'][index] || String(index + 1);
  if (type === 'image') return `Round ${ordinal} — Whose Face Is This?`;
  if (type === 'intro') return `Round ${ordinal} — Name That Intro`;
  if (type === 'multi') return `Round ${ordinal} — Pick Them All`;
  if (type === 'alphabet') return `Round ${ordinal} — First Letter`;
  if (type === 'breakout') return `Round ${ordinal} — Bonus Round`;
  return `Round ${ordinal} — ${label || titleCase(theme)}`;
}

function roundBlurb(type, theme, perRound, label = '') {
  if (type === 'image') return 'The picture pulls back as the clock runs down. Guess early, score more.';
  if (type === 'intro') return `${perRound} intros. You get the first few seconds and nothing else.`;
  if (type === 'multi') return 'More than one answer is right. Lock in every one of them.';
  if (type === 'alphabet') return 'Just the first letter of the answer. Spelling does not count.';
  if (type === 'breakout') return 'Nothing scored — just for laughs. Type your best answer.';
  return `${perRound} questions on ${label ? label.toLowerCase() : theme}`;
}

/**
 * Turn an intro round's cues into a Spotify playlist you can just press play on.
 *
 * Each cue is looked up so the pack ends up pointing at a track that genuinely
 * exists — a title the model invented gets caught here rather than in a pub —
 * and the track's uri is stored on the cue, so the control view can offer a tap
 * to open it.
 *
 * The playlist is in question order, so track one is question one.
 *
 * NOTE: Spotify's API cannot create folders or move playlists into them. That
 * is a gap in their API, not something we can work round. Instead every
 * playlist is named with the same prefix, so they sort together and can be
 * dragged into a folder in one go.
 */
export async function buildIntroPlaylist({ round, quizTitle, log = () => {} }) {
  const prefix = process.env.SPOTIFY_PLAYLIST_PREFIX ?? 'Quiz Intros';
  const name = prefix ? `${prefix} — ${quizTitle}` : quizTitle;

  log(`  looking the intro tracks up on Spotify…`);
  const uris = [];
  let missing = 0;

  for (const q of round.questions) {
    if (!q.cue || !q.cue.title) continue;
    try {
      const found = await findTrack(q.cue.title, q.cue.artist);
      if (!found) {
        missing++;
        log(`    not on Spotify: ${q.cue.title} — ${q.cue.artist}`);
        continue;
      }
      // Trust Spotify's spelling, and keep the uri so the cue can be tapped.
      q.cue.title = found.title;
      q.cue.artist = found.artist;
      q.cue.spotifyUri = found.uri;
      q.cue.spotifyUrl = `https://open.spotify.com/track/${found.id}`;
      uris.push(found.uri);
    } catch (err) {
      missing++;
      log(`    lookup failed for ${q.cue.title}: ${err.message}`);
    }
  }

  if (!uris.length) {
    log(`  no tracks found — no playlist made`);
    return null;
  }

  const playlist = await createPlaylist({
    name,
    description: `Name that intro — ${quizTitle}. In question order.`,
    uris,
  });
  log(`  playlist: ${playlist.url}${missing ? ` (${missing} not found)` : ''}`);
  return { ...playlist, missing };
}

/**
 * Build the playlists for a quiz that already exists.
 *
 * The same job the generator does, but reachable afterwards — because you can
 * have an intro round long before you have a Spotify login, and because a
 * playlist you deleted by accident should not mean regenerating the whole
 * quiz and getting different questions.
 *
 * Mutates the quiz in place: cues gain Spotify's spelling and a uri, the round
 * gains its playlist. The caller saves it.
 *
 * @returns {Promise<Array<{round: string, playlist: object|null, error?: string}>>}
 */
export async function buildIntroPlaylists({ quiz, log = () => {} }) {
  if (!spotifyConfigured()) {
    throw new Error('Spotify is not set up, so no playlist can be made. Run `npm run spotify:login` first.');
  }
  const rounds = (quiz.rounds || []).filter((r) => r.type === 'intro');
  if (!rounds.length) throw new Error('This quiz has no "name that intro" round, so there is nothing to build.');

  const out = [];
  for (const round of rounds) {
    log(`${round.title}`);
    try {
      const playlist = await buildIntroPlaylist({ round, quizTitle: quiz.title, log });
      if (playlist) round.spotifyPlaylist = { id: playlist.id, url: playlist.url, uri: playlist.uri };
      out.push({ round: round.title, playlist: playlist || null });
    } catch (err) {
      log(`  could not build it: ${err.message}`);
      out.push({ round: round.title, playlist: null, error: err.message });
    }
  }
  return out;
}

/**
 * Build one round of exactly `perRound` questions that have passed the check.
 *
 * A round of nine is not acceptable — the host asked for ten and the screen
 * says "question 10 of 10". So when the check throws questions away, we go back
 * and write more rather than making up the shortfall with the ones that just
 * failed. Each attempt is told what has already been written so it does not
 * repeat itself.
 *
 * Only if three attempts still cannot produce enough do we fall back to filling
 * from the rejects — and then the log shouts about it, because at that point
 * you need to read those specific questions.
 */
const MAX_ATTEMPTS = 3;

/**
 * What makes two questions the same question.
 *
 * **NOT the prompt on its own, and that was a guaranteed bug rather than a
 * rare one.** The intro brief says, in as many words, to set the prompt to
 * exactly "Which track is this?" for every question in the round — the track
 * is the question, and it lives in the cue. So all ten came back correctly
 * written and nine were binned as duplicates of the first, every time, and an
 * intro round could only ever contain ONE question. It reported itself as a
 * success because nothing had been rejected: nothing had been *checked*.
 *
 * So the key is the prompt AND whatever actually distinguishes one question
 * from the next — the cue for an intro, the answer otherwise. A quiz where two
 * questions genuinely share both is a quiz with a repeat in it, which is what
 * this is for.
 */
export function questionKey(q) {
  const tidy = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const what = q.cue
    ? `${tidy(q.cue.artist)}${tidy(q.cue.title)}`
    : tidy(q.answer !== undefined ? q.answer : (q.options || [])[q.correctIndex]);
  const prompt = tidy(q.prompt);
  // Either half alone is enough to identify it; both empty means there is
  // nothing here to keep.
  return prompt || what ? `${prompt}|${what}` : '';
}

/**
 * @param {Map} [seenAnswers]  answers already used somewhere in the catalogue.
 *   See question-history.js — keyed on the ANSWER rather than the wording,
 *   because two questions with the same answer are the same question to a room
 *   however differently they are phrased.
 * @param {string} [digest]  the last month, read off the web. Empty on an
 *   ordinary round. When it is there it goes to the writer AND to the checker,
 *   so the two are judging against the same facts — see src/research.js.
 */
async function buildRound({ brief, perRound, check, system, apiKey, model, log, onReject, onUnchecked = () => {}, onShort = () => {}, onSpend = () => {}, seenAnswers = new Map(), onRepeat = () => {}, digest = '' }) {
  const accepted = [];
  const failed = [];
  const seen = new Set();
  // The news, on a topical round. Worth a cache breakpoint only if there is
  // enough of it — every attempt of every topical round sends the same block.
  const evidence = digestBlock(digest);
  const cache = Boolean(evidence) && worthCaching(system, evidence);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && accepted.length < perRound; attempt++) {
    const need = perRound - accepted.length;
    // Ask for more than we need so the check has something to throw away.
    const ask = check ? need + Math.max(3, Math.ceil(need * 0.5)) : need;

    const alreadyWritten = [...accepted, ...failed].map((q) => q.prompt);
    const avoid = alreadyWritten.length
      ? `\n\nYou have already written these — do not repeat them or ask the same thing a different way:\n${alreadyWritten.map((p) => `- ${p}`).join('\n')}`
      : '';
    /*
     * And what the rest of the catalogue has already asked about.
     *
     * Told to the writer so the over-ask is not spent on questions that are
     * going to be dropped anyway — but the guarantee is the mechanical filter
     * below, not this. A model told not to repeat itself will do it now and
     * again, and the failure is silent.
     */
    const used = avoidAnswers(seenAnswers);
    const notThese = used.length
      ? `\n\nThese have been the answer to a question in another quiz recently. Do not write a question whose answer is any of them:\n${used.map((a) => `- ${a}`).join('\n')}`
      : '';

    log(attempt === 1
      ? `  writing ${ask} questions…`
      : `  ${accepted.length} of ${perRound} so far — writing ${ask} more (attempt ${attempt})…`);

    /*
     * A bad reply costs this ATTEMPT, never the round.
     *
     * There are two more goes, and everything accepted so far is already in
     * hand — throwing here binned fifteen questions and several minutes of
     * paid-for work because one reply in three came back untidy.
     */
    let result;
    try {
      result = await askClaude({
        system,
        // The news goes in the second half of the system, not in the prompt:
        // it is identical on every attempt of every topical round, and the
        // prompt is the part that changes.
        extra: evidence,
        cache,
        prompt: `Write ${ask} questions for a music quiz.\n\n${brief}${avoid}${notThese}\n\n${SCHEMA_NOTE}`,
        apiKey,
        model,
        what: 'wrote a round',
        onSpend,
      });
    } catch (err) {
      // Only an unreadable REPLY is worth quietly having another go at. A
      // timeout or a dead connection is something the host has to be told.
      if (!err.unreadable) throw err;
      log(`  that reply could not be read — trying again`);
      continue;
    }

    // Drop anything we have already got before spending a check on it.
    const sameRun = (result.questions || []).filter((q) => {
      const key = questionKey(q);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    /*
     * And anything the CATALOGUE has already asked about — before the checker
     * sees it, because a check on a question that is going to be thrown away
     * is the most expensive call in the job spent on nothing.
     */
    const { kept: fresh, dropped: repeats } = filterSeen(seenAnswers, sameRun);
    for (const r of repeats) {
      onRepeat(r);
      log(`  already asked: ${r.because}`);
    }
    if (!fresh.length) {
      log(`  nothing new came back`);
      continue;
    }

    if (!check) {
      accepted.push(...fresh);
      continue;
    }

    log(`  checking ${fresh.length} with ${CHECKER_MODEL}…`);
    const verdicts = await checkQuestions({ questions: fresh, apiKey, model, digest, log, onSpend });
    if (verdicts.some((v) => v.unchecked)) onUnchecked();
    for (const v of verdicts) {
      if (v.ok) {
        accepted.push(v.question);
      } else {
        failed.push(v.question);
        onReject(v.question, v.reason);
        log(`  binned: ${v.question.prompt.slice(0, 55)}${v.question.prompt.length > 55 ? '…' : ''} — ${v.reason}`);
      }
    }
    log(`  ${accepted.length} of ${perRound} good`);
  }

  if (accepted.length >= perRound) return accepted.slice(0, perRound);

  // Last resort. Never ship a short round quietly, and be loud about why.
  const shortfall = perRound - accepted.length;
  log(`  COULD NOT FIND ${perRound} GOOD QUESTIONS after ${MAX_ATTEMPTS} attempts.`);
  log(`  Filling the last ${shortfall} from the rejects — READ THOSE ONES CAREFULLY.`);
  const out = [...accepted, ...failed.slice(0, shortfall)];
  /*
   * And say so where it cannot be missed.
   *
   * This was only ever a line in a log that scrolls past while you look at
   * something else — so a round that came back with ONE question out of ten
   * was announced as "Written The 2000s Metal Quiz — 1 questions across 1
   * round" on a green banner, which reads as success. The writer had simply
   * stopped producing questions and nothing said so.
   */
  if (out.length < perRound) onShort(out.length, perRound);
  return out;
}

/**
 * @param {object} opts
 * @param {object} opts.config           app config (needs quizDir)
 * @param {string} opts.theme            "the 1990s", "Harry Potter soundtracks", …
 * @param {Array<string|{type: string, count: number}>} [opts.rounds]
 *        which round types, in order, and how many questions each — see roundPlan
 * @param {number} [opts.perRound]       the count for a round that does not name one
 * @param {boolean} [opts.hard]
 * @param {string} [opts.id]             filename, without .json
 * @param {string} [opts.title]
 * @param {function(string): void} [opts.log]
 */
export async function generateQuizPack({
  config,
  theme,
  rounds = ['text', 'image', 'intro'],  // 'multi' is opt-in from the console
  perRound = 10,
  hard = false,
  id,
  title,
  model = DEFAULT_MODEL,
  check = true,
  /*
   * How far back "we have already asked that" reaches, in months.
   *
   * A window rather than forever, for the same reason bingo has one: on the
   * thirtieth pack every common answer would be used and there would be
   * nothing left to write. Six months is roughly how long a venue takes to
   * cycle through a library, which is when a repeat actually gets noticed.
   */
  avoidAnswerMonths = ANSWER_MONTHS,
  /*
   * How long this pack is worth running, in days. 0 is evergreen, which is
   * every ordinary quiz — a question about the 1980s does not go off.
   *
   * Only a pack that says so gets a `freshUntil`, so the console's "past its
   * date" warning means something rather than appearing on the whole library.
   */
  freshDays = 0,
  /*
   * How far back the news digest reads, in days. Only used when a round in the
   * plan is marked topical; there is one digest for the whole job.
   */
  researchDays = RESEARCH_DAYS,
  log = () => {},
  // What each call cost, for the owner's own ledger. Defaults to nothing, so
  // a test or a script gets a generator with no accounting attached rather
  // than one that needs a file on disk. See src/spend.js.
  onSpend = () => {},
  now = () => Date.now(),
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Set ANTHROPIC_API_KEY to write quizzes');
  if (!theme || !theme.trim()) throw new Error('Give it a theme');

  // What you typed may be a request ("can I have a One Direction quiz"), so
  // strip that before naming anything after it.
  const subject = cleanTheme(theme);
  const quizId = id || themeSlug(theme);
  const quizTitle = title || quizTitleFor(theme);
  const system = houseStyle({ theme: subject, hard });

  const plan = roundPlan(rounds, perRound);
  if (!plan.length) throw new Error(`No usable round types. Use ${ROUND_TYPES.join(', ')}.`);

  /*
   * What the catalogue has already asked about.
   *
   * Read ONCE for the whole job rather than per round, because it is a
   * directory of packs and it cannot change while a generation is running.
   * Shared across every round too, so round three does not repeat round one.
   */
  const seenAnswers = answersInCatalogue(config.quizDir, { months: avoidAnswerMonths, now: now() });
  if (seenAnswers.size) log(`${seenAnswers.size} answers already used in the catalogue — not asking those again`);

  /*
   * The last month, if any round in the plan is about it.
   *
   * FIRST, before a penny is spent on questions, and it is allowed to refuse
   * where nothing else in this file is: the failure it prevents is a quiz of
   * forty invented current events, and at this point there is nothing to lose
   * by stopping. Everything downstream in this file keeps going on a failure
   * because by then the job is minutes and real money deep. This one is not.
   */
  let digest = '';
  let research = null;
  if (plan.some((r) => r.topical)) {
    research = await researchDigest({ apiKey, days: researchDays, log, onSpend, now });
    digest = research.digest;
  }

  const built = [];
  const rejected = [];
  const unchecked = [];   // rounds the checking pass could not reach at all
  const repeated = [];    // questions dropped because the catalogue already asks them
  const short = [];       // rounds the WRITER would not fill, which is different

  for (let i = 0; i < plan.length; i++) {
    const { type, count, focus = '', label = '', topical = false } = plan[i];
    // Built per round rather than once, because the brief tells the model how
    // many to write and what it is about, and both of those are now different
    // from one round to the next.
    const brief = roundBriefs({ theme: subject, count, focus })[type];

    log(`round ${i + 1} of ${plan.length} (${type}, ${count} question${count === 1 ? '' : 's'}${topical ? ', from the news' : ''})`);
    const questions = await buildRound({
      // A breakout question has no answer, so there is nothing for the
      // fact-checking pass to check — it is a joke, not a claim. Skipping it
      // is not a shortcut, it is the checker being asked to judge something
      // it was never built to judge.
      brief, perRound: count, check: check && type !== 'breakout', system, apiKey, model, log, onSpend,
      // Only a round that asked for it. The evergreen round of a topical quiz
      // is deliberately written without the news in front of it — otherwise it
      // writes about the news anyway and the pack has no ground in it.
      digest: topical ? digest : '',
      seenAnswers,
      onRepeat: (r) => repeated.push({ round: i + 1, prompt: r.question.prompt, because: r.because }),
      onReject: (q, reason) => rejected.push({ round: i + 1, prompt: q.prompt, reason }),
      onUnchecked: () => { if (!unchecked.includes(i + 1)) unchecked.push(i + 1); },
      onShort: (got, wanted) => short.push({ round: i + 1, type, got, wanted }),
    });

    built.push({
      id: `r${i + 1}`,
      type,
      title: roundTitle(type, i, subject, label),
      // The count the round ACTUALLY has, not the one that was asked for — a
      // round of one saying "10 intros" on the projector is a lie the room can
      // see.
      blurb: roundBlurb(type, subject, questions.length, label),
      /*
       * A GENERATED PICTURE ROUND MIXES THE EFFECTS.
       *
       * `revealMode()` rotates zoom → pixelate → blur → tiles by question
       * POSITION when a round says `mix`, and nothing was setting a reveal at
       * all — so every generated round was ten zooms and the first real night
       * came back "the image round was too samey".
       *
       * Safe by construction rather than a judgement call: the four effects
       * deliberately run on the SAME curve, so the round is worth exactly the
       * same points either way, and rotating by position rather than at random
       * means a Redo hands the room back the effect they were half way through
       * watching. The editor's dropdown still overrides it per round, and a
       * question can still override that.
       */
      ...(type === 'image'
        ? { reveal: 'mix' }
        : {}),
      questions: questions.map((q, qi) => ({
        id: `r${i + 1}q${qi + 1}`,
        prompt: String(q.prompt || '').trim(),
        ...(type === 'alphabet'
          ? { answer: String(q.answer || '').trim() }
          : type === 'breakout'
          ? {}
          : {
              options: (q.options || []).slice(0, type === 'multi' ? MULTI_OPTIONS : 4).map((o) => String(o).trim()),
              correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
              ...(type === 'multi'
                ? { correctIndexes: [...new Set((q.correctIndexes || []).filter(Number.isInteger))].sort((a, b) => a - b) }
                : {}),
            }),
        ...(q.answerNote ? { answerNote: String(q.answerNote).trim() } : {}),
        ...(type === 'image'
          ? {
              // The SHARED library, named after the person rather than this
              // quiz, so the second quiz to want Madonna costs nothing. See
              // src/portraits.js for why the key is the name and not the
              // prompt Claude just wrote.
              image: portraitPath(q.options?.[q.correctIndex] || 'face-' + (qi + 1)),
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

  // Intro rounds get a playlist, so the tracks you have to play are one tap
  // away rather than something to hunt for on the night.
  if (spotifyConfigured()) {
    for (const round of built.filter((r) => r.type === 'intro')) {
      try {
        const playlist = await buildIntroPlaylist({ round, quizTitle, log });
        if (playlist) round.spotifyPlaylist = { id: playlist.id, url: playlist.url, uri: playlist.uri };
      } catch (err) {
        log(`  could not build the intro playlist: ${err.message}`);
      }
    }
  } else if (built.some((r) => r.type === 'intro')) {
    log('Spotify is not set up — no intro playlist made. See DEPLOY.md.');
  }

  const quiz = normaliseQuiz({
    id: quizId,
    title: quizTitle,
    subtitle: `${['One', 'Two', 'Three', 'Four', 'Five', 'Six'][plan.length - 1] || plan.length} round${plan.length === 1 ? '' : 's'}. Twenty seconds a question. Fastest fingers win.`,
    questionSeconds: 20,
    createdAt: new Date(now()).toISOString(),
    // When it stops being current. Only on a pack that IS current — an
    // eighties quiz has no date to go past. See freshness() in quizzes.js.
    ...(freshDays > 0 ? { freshUntil: new Date(now() + freshDays * 86400000).toISOString() } : {}),
    notes: `Written by ${model} for "${subject}". NOT YET REVIEWED — read every question in the editor before the gig.`
      + (research
        ? ` The topical rounds were written from ${research.lines} facts read off the web on ${new Date(now()).toISOString().slice(0, 10)}${research.sources.length ? ` (${research.sources.slice(0, 6).join(', ')})` : ''}.`
        : '')
      + (unchecked.length
        ? ` Round${unchecked.length === 1 ? '' : 's'} ${unchecked.join(', ')} could NOT be checked by the second pass — read ${unchecked.length === 1 ? 'that one' : 'those'} line by line.`
        : ''),
    rounds: built,
  }, quizId);

  /*
   * Spread the right answers across the letters before the pack is ever saved.
   *
   * A generated quiz leans hard on A: Claude writes the true statement first
   * and the decoys after it. That was a warning on the read-through with a
   * button next to it — but a lean is not a judgement call, it is always
   * wrong, so making somebody press a button to fix a fault the app has just
   * created is a step that only existed because of the order things were
   * built in. Every generated pack now arrives even.
   *
   * Safe to do here and nowhere near the words: same options, same right
   * answer, different letter. In particular the picture round's `image` was
   * worked out above from the ANSWER TEXT rather than from its position, so
   * moving the letter cannot point a question at the wrong portrait.
   *
   * The button stays on the read-through for packs written before this and
   * for anything imported, and because a second press deals them again if you
   * do not like what you are looking at.
   */
  const evened = balanceAnswers(quiz);
  if (evened) log(`evened out the answers — ${evened} question${evened === 1 ? '' : 's'} moved`);

  const problems = validateQuiz(quiz);
  // Written even with problems, because fixing them in the editor beats
  // regenerating the whole pack.
  fs.mkdirSync(config.quizDir, { recursive: true });
  const file = path.join(config.quizDir, quizId + '.json');
  fs.writeFileSync(file, JSON.stringify(quiz, null, 2) + '\n', 'utf8');
  log(`saved ${quizId}.json`);

  const needsImages = built.some((r) => r.type === 'image');
  return {
    quiz, problems, file, needsImages, rejected, unchecked, short, repeated, checked: check,
    // What the news cost, so the console can say it out loud. A topical pack
    // is the only kind with a per-pack search bill and it is the number that
    // decides whether writing one every week is worth it.
    searches: research ? research.searches : 0,
    sources: research ? research.sources : [],
    freshUntil: quiz.freshUntil || null,
  };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'quiz';
}
