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
 * @param {Array<string|{type: string, count: number}>} rounds
 * @param {number} fallback  the count for an entry that does not carry one
 * @returns {Array<{type: string, count: number}>}
 */
export function roundPlan(rounds, fallback = 10) {
  const list = Array.isArray(rounds) ? rounds : [];
  const out = [];
  for (const entry of list) {
    const type = typeof entry === 'string' ? entry : String(entry && entry.type || '');
    if (!ROUND_TYPES.includes(type)) continue;
    const asked = typeof entry === 'object' && entry ? Number(entry.count) : NaN;
    const count = Number.isFinite(asked) ? asked : Number(fallback);
    // A round of nought is not a round; a round of fifty is a night on its own.
    out.push({ type, count: Math.min(30, Math.max(1, Math.round(count) || 1)) });
  }
  return out;
}

/** Is there a generation brief for this round type? Used by the tests. */
export function roundBriefsFor(type) {
  return roundBriefs({ theme: 'anything', count: 10 })[type] || null;
}

function roundBriefs({ theme, count }) {
  const perRound = count;
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

    multi: `Round type "multi": several answers are right and the room has to lock in ALL of
them. Write ${perRound} questions fitting "${theme}".

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

Write ${perRound} questions fitting "${theme}". Give each one an "answer" field with the
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

async function checkQuestions({ questions, apiKey, model, log = () => {} }) {
  if (questions.length <= CHECK_BATCH) {
    return checkBatch({ questions, apiKey, model, log });
  }
  const batches = [];
  for (let i = 0; i < questions.length; i += CHECK_BATCH) {
    batches.push(questions.slice(i, i + CHECK_BATCH));
  }
  log(`  (in ${batches.length} batches, at the same time)`);
  const done = await Promise.all(
    batches.map((batch) => checkBatch({ questions: batch, apiKey, model, log })),
  );
  return done.flat();
}

async function checkBatch({ questions, apiKey, model, log = () => {} }) {
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

  let result;
  try {
    result = await askClaude({
      system: CHECKER_SYSTEM,
      prompt: `Check these ${questions.length} questions.\n\n${listing}\n\n${CHECKER_SCHEMA}`,
      apiKey,
      model: CHECKER_MODEL,
      think: true,
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
async function askClaude({ system, prompt, apiKey, model, think = false }) {
  const body = {
    model,
    max_tokens: think ? 16000 : 8000,
    system,
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
  if (type === 'multi') return `Round ${ordinal} — Pick Them All`;
  if (type === 'alphabet') return `Round ${ordinal} — First Letter`;
  return `Round ${ordinal} — ${titleCase(theme)}`;
}

function roundBlurb(type, theme, perRound) {
  if (type === 'image') return 'The picture pulls back as the clock runs down. Guess early, score more.';
  if (type === 'intro') return `${perRound} intros. You get the first few seconds and nothing else.`;
  if (type === 'multi') return 'More than one answer is right. Lock in every one of them.';
  if (type === 'alphabet') return 'Just the first letter of the answer. Spelling does not count.';
  return `${perRound} questions on ${theme}`;
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

async function buildRound({ brief, perRound, check, system, apiKey, model, log, onReject, onUnchecked = () => {} }) {
  const accepted = [];
  const failed = [];
  const seen = new Set();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && accepted.length < perRound; attempt++) {
    const need = perRound - accepted.length;
    // Ask for more than we need so the check has something to throw away.
    const ask = check ? need + Math.max(3, Math.ceil(need * 0.5)) : need;

    const alreadyWritten = [...accepted, ...failed].map((q) => q.prompt);
    const avoid = alreadyWritten.length
      ? `\n\nYou have already written these — do not repeat them or ask the same thing a different way:\n${alreadyWritten.map((p) => `- ${p}`).join('\n')}`
      : '';

    log(attempt === 1
      ? `  writing ${ask} questions…`
      : `  ${accepted.length} of ${perRound} so far — writing ${ask} more (attempt ${attempt})…`);

    const result = await askClaude({
      system,
      prompt: `Write ${ask} questions for a music quiz.\n\n${brief}${avoid}\n\n${SCHEMA_NOTE}`,
      apiKey,
      model,
    });

    // Drop anything we have already got before spending a check on it.
    const fresh = (result.questions || []).filter((q) => {
      const key = String(q.prompt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!fresh.length) {
      log(`  nothing new came back`);
      continue;
    }

    if (!check) {
      accepted.push(...fresh);
      continue;
    }

    log(`  checking ${fresh.length} with ${CHECKER_MODEL}…`);
    const verdicts = await checkQuestions({ questions: fresh, apiKey, model, log });
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

  // Last resort. Never ship a short round, but be loud about why.
  const shortfall = perRound - accepted.length;
  log(`  COULD NOT FIND ${perRound} GOOD QUESTIONS after ${MAX_ATTEMPTS} attempts.`);
  log(`  Filling the last ${shortfall} from the rejects — READ THOSE ONES CAREFULLY.`);
  return [...accepted, ...failed.slice(0, shortfall)];
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
  log = () => {},
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

  const built = [];
  const rejected = [];
  const unchecked = [];   // rounds the checking pass could not reach at all

  for (let i = 0; i < plan.length; i++) {
    const { type, count } = plan[i];
    // Built per round rather than once, because the brief tells the model how
    // many to write and that is now different from one round to the next.
    const brief = roundBriefs({ theme: subject, count })[type];

    log(`round ${i + 1} of ${plan.length} (${type}, ${count} question${count === 1 ? '' : 's'})`);
    const questions = await buildRound({
      brief, perRound: count, check, system, apiKey, model, log,
      onReject: (q, reason) => rejected.push({ round: i + 1, prompt: q.prompt, reason }),
      onUnchecked: () => { if (!unchecked.includes(i + 1)) unchecked.push(i + 1); },
    });

    built.push({
      id: `r${i + 1}`,
      type,
      title: roundTitle(type, i, subject),
      blurb: roundBlurb(type, subject, count),
      ...(type === 'image' ? { imageCaption: 'AI-generated illustration — not a real photograph' } : {}),
      questions: questions.map((q, qi) => ({
        id: `r${i + 1}q${qi + 1}`,
        prompt: String(q.prompt || '').trim(),
        ...(type === 'alphabet'
          ? { answer: String(q.answer || '').trim() }
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
    notes: `Written by ${model} for "${subject}". NOT YET REVIEWED — read every question in the editor before the gig.`
      + (unchecked.length
        ? ` Round${unchecked.length === 1 ? '' : 's'} ${unchecked.join(', ')} could NOT be checked by the second pass — read ${unchecked.length === 1 ? 'that one' : 'those'} line by line.`
        : ''),
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
  return { quiz, problems, file, needsImages, rejected, unchecked, checked: check };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'quiz';
}
