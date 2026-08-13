/**
 * Generation, with the network stubbed out.
 *
 * The guarantee under test: a round always ends up with exactly the number of
 * questions asked for. The screen says "question 10 of 10", so a round of nine
 * is a bug, and the checking pass throwing questions away must not be allowed
 * to cause one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generateQuizPack, roundBriefsFor, roundPlan, questionKey, parseJson } from '../src/generate-quiz.js';
import { ROUND_TYPES, validateQuiz } from '../src/quizzes.js';
import { portraitPath } from '../src/portraits.js';

/**
 * Stand in for the Anthropic API.
 *
 * @param {object} opts
 * @param {function(number): number} opts.rejectHowMany  given the batch size, how many to fail
 * @param {boolean} opts.lean  put every right answer at A, which is what the
 *   real model does: it writes the true statement first and the decoys after.
 */
function stubClaude({ rejectHowMany = () => 0, lean = false } = {}) {
  const calls = { write: 0, check: 0, asked: [] };
  let written = 0;

  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    const prompt = body.messages[0].content;
    const isCheck = prompt.startsWith('Check these');

    let payload;
    if (isCheck) {
      calls.check++;
      // Count the questions we were handed by their [n] markers.
      const count = (prompt.match(/^\[\d+\]/gm) || []).length;
      const fail = Math.min(count, rejectHowMany(count));
      payload = {
        verdicts: Array.from({ length: count }, (_, i) => (
          i < fail
            ? { index: i, ok: false, reason: 'stubbed rejection' }
            : { index: i, ok: true }
        )),
      };
    } else {
      calls.write++;
      const asked = Number((prompt.match(/^Write (\d+) questions/) || [])[1] || 0);
      calls.asked.push(asked);
      payload = {
        questions: Array.from({ length: asked }, () => {
          written++;
          return {
            prompt: `Stub question ${written}?`,
            options: [`A${written}`, `B${written}`, `C${written}`, `D${written}`],
            correctIndex: lean ? 0 : written % 4,
            // An alphabet round takes this and ignores the options; every
            // other round takes the options and ignores this.
            answer: `${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[written % 26]}nswer ${written}`,
            answerNote: `Fact ${written}.`,
          };
        }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] }),
      text: async () => '',
    };
  };
  return calls;
}

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-gen-'));
  try {
    return fn({ quizDir: dir });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

test('a round has exactly the number of questions asked for', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  stubClaude();
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 10 });
    assert.equal(quiz.rounds[0].questions.length, 10);
  });
});

test('it writes MORE when the check throws some away, rather than shipping a short round', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  // Fail two thirds of every batch — one pass can never be enough.
  const calls = stubClaude({ rejectHowMany: (n) => Math.floor(n * 0.67) });

  await withTmpDir(async (config) => {
    const lines = [];
    const { quiz, rejected } = await generateQuizPack({
      config, theme: 'test', rounds: ['text'], perRound: 10, log: (l) => lines.push(l),
    });

    assert.equal(quiz.rounds[0].questions.length, 10, 'still exactly ten');
    assert.ok(calls.write > 1, `went back for more (wrote ${calls.write} times)`);
    assert.ok(rejected.length > 0, 'and reported what it binned');
    assert.ok(lines.some((l) => /more \(attempt 2\)/.test(l)), 'and said so in the log');
  });
});

test('every question in a full round is one that passed the check', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  stubClaude({ rejectHowMany: (n) => Math.floor(n / 2) });

  await withTmpDir(async (config) => {
    const { quiz, rejected } = await generateQuizPack({
      config, theme: 'test', rounds: ['text'], perRound: 10,
    });
    const kept = quiz.rounds[0].questions.map((q) => q.prompt);
    const binned = rejected.map((r) => r.prompt);
    for (const p of kept) {
      assert.equal(binned.includes(p), false, `${p} was binned but kept anyway`);
    }
  });
});

test('when it genuinely cannot find enough, it still fills the round and shouts', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  // Reject everything, forever.
  stubClaude({ rejectHowMany: (n) => n });

  await withTmpDir(async (config) => {
    const lines = [];
    const { quiz } = await generateQuizPack({
      config, theme: 'test', rounds: ['text'], perRound: 10, log: (l) => lines.push(l),
    });
    assert.equal(quiz.rounds[0].questions.length, 10, 'the round is never short');
    assert.ok(lines.some((l) => l.includes('COULD NOT FIND')), 'and it is loud about why');
    assert.ok(lines.some((l) => l.includes('READ THOSE ONES CAREFULLY')));
  });
});

test('it gives up rather than looping forever', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  const calls = stubClaude({ rejectHowMany: (n) => n });

  await withTmpDir(async (config) => {
    await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 10 });
    assert.ok(calls.write <= 3, `stopped after ${calls.write} attempts`);
  });
});

test('later attempts tell the model what has already been written', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  const prompts = [];
  const inner = stubClaude({ rejectHowMany: (n) => Math.floor(n * 0.8) });
  const stubbed = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    prompts.push(JSON.parse(options.body).messages[0].content);
    return stubbed(url, options);
  };

  await withTmpDir(async (config) => {
    await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 10 });
    const writes = prompts.filter((p) => p.startsWith('Write '));
    assert.ok(writes.length > 1);
    assert.match(writes[1], /already written these/i);
    assert.match(writes[1], /Stub question 1\?/);
  });
});

test('three rounds all come out full', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  stubClaude({ rejectHowMany: (n) => Math.floor(n / 3) });

  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({
      config, theme: 'test', rounds: ['text', 'image', 'intro'], perRound: 10,
    });
    assert.equal(quiz.rounds.length, 3);
    for (const round of quiz.rounds) {
      assert.equal(round.questions.length, 10, `${round.type} round is short`);
    }
  });
});

test('the same question is never used twice in a round', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  stubClaude({ rejectHowMany: (n) => Math.floor(n * 0.6) });

  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 10 });
    const prompts = quiz.rounds[0].questions.map((q) => q.prompt);
    assert.equal(new Set(prompts).size, prompts.length);
  });
});


/**
 * The bug this catches: the console offered "pick them all", sent it, and the
 * server's own hardcoded whitelist — written when there were three round types
 * — silently dropped it. The quiz came back without the round and nothing said
 * why.
 *
 * So: every round type the app knows about must be generatable end to end.
 * Adding a fifth type without a brief now fails here rather than on a Tuesday.
 */
test('every round type the app offers can actually be generated', async () => {
  for (const type of ROUND_TYPES) {
    assert.ok(roundBriefsFor(type), `no generation brief for round type "${type}"`);
  }

  const calls = stubClaude();
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: [...ROUND_TYPES], perRound: 4 });
    assert.deepEqual(quiz.rounds.map((r) => r.type), [...ROUND_TYPES], 'one round per type, in order');
    for (const round of quiz.rounds) {
      assert.equal(round.questions.length, 4, `${round.type} came up short`);
    }
    assert.ok(calls.write > 0);
  });
});


/*
 * The model leans on A — it writes the true statement first and the decoys
 * after it. That was a warning on the read-through with a button beside it,
 * which made the host fix a fault the app had just created. A lean is never a
 * judgement call, so it is dealt out before the pack is ever saved.
 */
test('a generated pack arrives with the answers spread across the letters', async () => {
  stubClaude({ lean: true });
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 20 });

    const tally = [0, 0, 0, 0];
    for (const q of quiz.rounds[0].questions) tally[q.correctIndex]++;
    assert.deepEqual(tally, [5, 5, 5, 5], `still lopsided: ${tally.join('/')}`);

    // What is saved to disk is what was balanced, not the pre-balance version.
    const onDisk = JSON.parse(fs.readFileSync(path.join(config.quizDir, quiz.id + '.json'), 'utf8'));
    assert.deepEqual(onDisk.rounds[0].questions.map((q) => q.correctIndex),
      quiz.rounds[0].questions.map((q) => q.correctIndex));
  });
});

/*
 * The picture round's portrait is worked out from the ANSWER TEXT rather than
 * from its position, so moving the right answer to another letter cannot point
 * a question at somebody else's face. This is the one way balancing a pack
 * could quietly break it, so it is pinned.
 */
test('evening out the answers never separates a portrait from its musician', async () => {
  stubClaude({ lean: true });
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['image'], perRound: 8 });
    for (const q of quiz.rounds[0].questions) {
      assert.equal(q.image, portraitPath(q.options[q.correctIndex]),
        `${q.prompt} shows the wrong person`);
    }
  });
});

/*
 * An alphabet question has no options in the pack at all — the letters are put
 * back by optionsFor(). There is nothing to deal out, so it must be left
 * exactly as written rather than handed an empty options array.
 */
test('an alphabet round is left alone by the balancing', async () => {
  stubClaude({ lean: true });
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['alphabet'], perRound: 6 });
    for (const q of quiz.rounds[0].questions) {
      assert.ok(q.answer, 'the answer survived');
      assert.equal(q.options, undefined, 'and no options were invented for it');
    }
  });
});


/**
 * A generation is minutes and real money deep by the time the second pass
 * runs. If the checker is unreachable, throwing away every question already
 * written is the wrong trade — the step meant to make the quiz safer would be
 * the step that loses it. Keep the questions, say plainly they were not
 * checked, and let the host decide.
 */
test('a checker that cannot be reached keeps the quiz, and says so', async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    const prompt = body.messages[0].content;
    calls++;
    if (prompt.startsWith('Check these')) throw new Error('network is down');
    const asked = Number((prompt.match(/^Write (\d+) questions/) || [])[1] || 0);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({
          // Every question needs a DIFFERENT right answer, or the catalogue's
          // answer dedupe drops them as repeats and it does so correctly — see
          // question-history.js. Real questions do not all answer "B".
          questions: Array.from({ length: asked }, (_, i) => ({
            prompt: `Stub ${calls}-${i}?`,
            options: [`Right ${calls}-${i}`, 'Wrong one', 'Wrong two', 'Wrong three'],
            correctIndex: 0,
            answerNote: 'A fact.',
          })),
        }) }],
      }),
      text: async () => '',
    };
  };

  await withTmpDir(async (config) => {
    const result = await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 5 });
    assert.equal(result.quiz.rounds[0].questions.length, 5, 'the questions survived');
    assert.deepEqual(result.unchecked, [1], 'and round 1 is flagged as unchecked');
    assert.match(result.quiz.notes, /could NOT be checked/i, 'the pack itself says so');
  });
});

test('a Claude call that times out says so in words, and carries a real deadline', async () => {
  let sawSignal = null;
  globalThis.fetch = async (url, options) => {
    sawSignal = options.signal;
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  };

  await withTmpDir(async (config) => {
    await assert.rejects(
      generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 3 }),
      /took too long to answer/,
      'the host is told what happened, not handed a raw abort',
    );
  });
  assert.ok(sawSignal, 'a deadline was actually attached to the request');
  assert.equal(typeof sawSignal.aborted, 'boolean');
});


/**
 * The checker is the longest call in the app, and it used to be one call
 * covering the whole round — several minutes of single point of failure. That
 * is what died on the host and took a two-round quiz with it.
 */
test('the checker works in small batches, at the same time', async () => {
  const sizes = [];
  let concurrent = 0;
  let peak = 0;
  globalThis.fetch = async (url, options) => {
    const prompt = JSON.parse(options.body).messages[0].content;
    const reply = (payload) => ({
      ok: true, status: 200, text: async () => '',
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] }),
    });

    if (prompt.startsWith('Check these')) {
      const n = Number(prompt.match(/^Check these (\d+)/)[1]);
      sizes.push(n);
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent--;
      return reply({ verdicts: Array.from({ length: n }, (_, i) => ({ index: i, ok: true })) });
    }

    const asked = Number(prompt.match(/^Write (\d+) questions/)[1]);
    return reply({
      questions: Array.from({ length: asked }, (_, i) => ({
        prompt: `Q${sizes.length}-${i}-${Math.random()}?`,
        // Distinct right answers, for the reason above.
        options: [`right-${sizes.length}-${i}-${Math.random()}`, 'b', 'c', 'd'],
        correctIndex: 0,
        answerNote: 'x',
      })),
    });
  };

  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 10 });
    assert.equal(quiz.rounds[0].questions.length, 10);
  });

  assert.ok(sizes.length > 1, 'the round was split across several checker calls');
  assert.ok(Math.max(...sizes) <= 6, `no batch bigger than 6, got ${sizes.join(', ')}`);
  assert.ok(peak > 1, 'and they ran at the same time rather than one after another');
});

/* ------------------------------------------------------------------------
 * How many of each.
 *
 * The generator used to take one number and apply it to every round, which is
 * not the shape of a quiz night — fifteen general knowledge and five pictures
 * is normal, ten of everything is not.
 */

test('a plan can be plain type names, and they all take the fallback', () => {
  assert.deepEqual(roundPlan(['text', 'image'], 12), [
    { type: 'text', count: 12 },
    { type: 'image', count: 12 },
  ]);
});

test('a plan can name a count per round, in the order given', () => {
  assert.deepEqual(roundPlan([
    { type: 'text', count: 15 },
    { type: 'image', count: 5 },
    { type: 'multi', count: 10 },
    { type: 'alphabet', count: 10 },
  ]), [
    { type: 'text', count: 15 },
    { type: 'image', count: 5 },
    { type: 'multi', count: 10 },
    { type: 'alphabet', count: 10 },
  ]);
});

test('a plan can mix the two, and a missing count falls back', () => {
  assert.deepEqual(roundPlan(['text', { type: 'alphabet', count: 20 }], 6), [
    { type: 'text', count: 6 },
    { type: 'alphabet', count: 20 },
  ]);
});

test('a round type nobody has heard of is dropped rather than turned into text', () => {
  assert.deepEqual(roundPlan(['text', 'karaoke', { type: 'nonsense', count: 4 }], 10), [
    { type: 'text', count: 10 },
  ]);
  assert.deepEqual(roundPlan(null), []);
  assert.deepEqual(roundPlan(['nope']), []);
});

test('a count is clamped rather than trusted', () => {
  assert.deepEqual(roundPlan([
    { type: 'text', count: 0 },
    { type: 'image', count: -4 },
    { type: 'intro', count: 500 },
    { type: 'multi', count: 'lots' },
  ], 7), [
    { type: 'text', count: 1 },
    { type: 'image', count: 1 },
    { type: 'intro', count: 30 },
    { type: 'multi', count: 7 },
  ]);
});

test('each round comes back with its own number of questions', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  stubClaude();
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({
      config,
      theme: 'test',
      rounds: [
        { type: 'text', count: 15 },
        { type: 'image', count: 5 },
        { type: 'multi', count: 3 },
        { type: 'alphabet', count: 8 },
      ],
    });
    assert.deepEqual(quiz.rounds.map((r) => r.questions.length), [15, 5, 3, 8]);
  });
});

test('a generated alphabet round is answers, not options, and it validates', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  stubClaude();
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['alphabet'], perRound: 5 });
    const round = quiz.rounds[0];
    assert.equal(round.type, 'alphabet');
    for (const q of round.questions) {
      assert.ok(q.answer, 'every question has an answer written out');
      assert.equal(q.options, undefined, 'and no options at all');
    }
    assert.deepEqual(validateQuiz(quiz), []);
  });
});

/*
 * Every intro question in a round has the SAME prompt — the brief says to set
 * it to exactly "Which track is this?", because the track is the question and
 * the track lives in the cue.
 *
 * De-duplicating on the prompt alone therefore threw away nine questions out
 * of ten, every single time, and reported it as a success because nothing had
 * been rejected — nothing had been checked. An intro round could only ever
 * come out with one question in it.
 */
test('two intro questions with the same prompt are different questions', () => {
  const a = { prompt: 'Which track is this?', cue: { artist: 'Slipknot', title: 'Duality' } };
  const b = { prompt: 'Which track is this?', cue: { artist: 'Korn', title: 'Freak on a Leash' } };
  assert.notEqual(questionKey(a), questionKey(b), 'the whole intro round would collapse to one');
  // The same track twice IS the same question, which is what the check is for.
  const again = { prompt: 'Which track is this?', cue: { artist: 'slipknot', title: 'DUALITY' } };
  assert.equal(questionKey(a), questionKey(again));
});

test('an ordinary question is told apart by its prompt and its answer', () => {
  const one = { prompt: 'Who sang this?', options: ['Abba', 'Blondie'], correctIndex: 0 };
  const two = { prompt: 'Who sang this?', options: ['Abba', 'Blondie'], correctIndex: 1 };
  assert.notEqual(questionKey(one), questionKey(two));
  assert.equal(questionKey(one), questionKey({ ...one }));
});

test('a first-letter question is told apart by its answer', () => {
  const a = { prompt: 'Name the band', answer: 'Fleetwood Mac' };
  const b = { prompt: 'Name the band', answer: 'Blondie' };
  assert.notEqual(questionKey(a), questionKey(b));
});

/*
 * A reply that is not quite JSON must not cost the whole job.
 *
 * Seen live: three attempts into a round, one reply came back untidy and the
 * raw parser message — "Expected double-quoted property name in JSON at
 * position 138" — went straight through the generation, binning fifteen
 * questions and several minutes of paid-for work. The bingo generator had
 * learned this and the quiz generator never had.
 */
test('a fenced or chatty reply is still read', () => {
  const wrapped = '```json\n{"questions":[{"prompt":"a","options":["x"],"correctIndex":0}]}\n```';
  assert.equal(parseJson(wrapped).questions.length, 1);
  const chatty = 'Here you go!\n{"questions":[{"prompt":"a"}]}\nHope that helps.';
  assert.equal(parseJson(chatty).questions.length, 1);
});

test('whole questions are salvaged from a reply that was cut off mid-write', () => {
  // Two complete, a third half-written — not valid JSON, but two questions.
  const truncated = '{"questions":[{"prompt":"one","options":["a","b"],"correctIndex":0},'
    + '{"prompt":"two","options":["c","d"],"correctIndex":1},{"prompt":"three","opt';
  const got = parseJson(truncated);
  assert.equal(got.questions.length, 2, 'the two whole ones should survive');
  assert.equal(got.questions[0].prompt, 'one');
});

// An intro question carries a nested `cue`, so the salvage has to match one
// level of nesting or it would skip every question in an intro round.
test('an intro question survives the salvage, cue and all', () => {
  const truncated = '{"questions":[{"prompt":"Which track is this?","options":["a","b"],'
    + '"correctIndex":0,"cue":{"title":"Duality","artist":"Slipknot"}},{"prompt":"cut';
  const got = parseJson(truncated);
  assert.equal(got.questions.length, 1);
  assert.equal(got.questions[0].cue.artist, 'Slipknot');
});

test('a reply with nothing usable in it still says so plainly', () => {
  assert.throws(() => parseJson('I am afraid I cannot help with that.'), /did not return usable JSON/);
  // …and is tagged, so one bad reply costs an attempt rather than the round.
  try {
    parseJson('nonsense');
  } catch (err) {
    assert.equal(err.unreadable, true);
  }
});

/*
 * The catalogue-wide answer check, end to end.
 *
 * The unit tests for it are in question-history.test.js; this one is about the
 * WIRING — that a generation actually reads the packs already on disk, tells
 * the writer about them, and drops a repeat before spending a checker call on
 * it. That last part matters: the check is the most expensive call in the job,
 * and running one on a question that is going to be thrown away is the worst
 * possible place to spend it.
 */
test('a question the catalogue already asks is dropped before it is checked', async () => {
  const checked = [];
  let told = '';
  globalThis.fetch = async (url, options) => {
    const prompt = JSON.parse(options.body).messages[0].content;
    const reply = (payload) => ({
      ok: true, status: 200, text: async () => '',
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] }),
    });
    if (prompt.startsWith('Check these')) {
      checked.push(prompt);
      const n = Number(prompt.match(/^Check these (\d+)/)[1]);
      return reply({ verdicts: Array.from({ length: n }, (_, i) => ({ index: i, ok: true })) });
    }
    told = prompt;
    // One answer is already in the catalogue below; the rest are new.
    return reply({
      questions: [
        { prompt: 'Asked a different way entirely?', options: ['Kate Bush', 'x', 'y', 'z'], correctIndex: 0, answerNote: 'f' },
        { prompt: 'Something new?', options: ['Blondie', 'x', 'y', 'z'], correctIndex: 0, answerNote: 'f' },
        { prompt: 'Something else new?', options: ['Squeeze', 'x', 'y', 'z'], correctIndex: 0, answerNote: 'f' },
      ],
    });
  };

  await withTmpDir(async (config) => {
    fs.writeFileSync(path.join(config.quizDir, 'already.json'), JSON.stringify({
      id: 'already',
      title: 'The Existing Quiz',
      rounds: [{ id: 'r1', type: 'text', questions: [
        { prompt: 'Who sang Wuthering Heights?', options: ['Kate Bush', 'a', 'b', 'c'], correctIndex: 0 },
      ] }],
    }), 'utf8');

    const result = await generateQuizPack({ config, theme: 'test', rounds: ['text'], perRound: 2 });

    const answers = result.quiz.rounds[0].questions.map((q) => q.options[q.correctIndex]);
    assert.ok(!answers.includes('Kate Bush'), 'an answer already in the catalogue got through');
    assert.equal(result.repeated.length, 1, 'the repeat was not reported');
    assert.match(result.repeated[0].because, /The Existing Quiz/);

    // Told to the writer as well, so the over-ask is not wasted on it.
    assert.match(told, /Kate Bush/, 'the writer was never told what to avoid');

    // And never checked — the expensive call must not be spent on a discard.
    assert.ok(!checked.some((c) => c.includes('Kate Bush')), 'a doomed question was sent to the checker');
  });
});

// ===================================================================== topical

/*
 * A quiz about the last month, which is the only kind that reads the web.
 *
 * The three things under test are the three that would cost money and be
 * invisible: one digest rather than one per round, the same digest going to
 * the writer AND the checker, and the checker's first batch going on its own
 * so the rest can read the cache it writes instead of all paying for it.
 */
const NEWS = Array.from({ length: 40 }, (_, i) =>
  `2026-08-${String((i % 28) + 1).padStart(2, '0')} — Fact number ${i}, in which somebody did a specific thing `
  + `in front of a named number of people, namely ${i * 137}, and it was reported at the time. (bbc.co.uk)`,
).join('\n');

function stubTopical({ slowChecks = false } = {}) {
  const seen = { research: 0, writes: [], checks: [], concurrent: 0, mostAtOnce: 0 };
  let written = 0;

  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    const system = Array.isArray(body.system) ? body.system.map((b) => b.text).join('\n') : body.system;
    const prompt = body.messages[0].content;

    if (body.tools) {
      seen.research++;
      return {
        ok: true,
        json: async () => ({
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 100, server_tool_use: { web_search_requests: 5 } },
          content: [{ type: 'text', text: NEWS }],
        }),
      };
    }

    const reply = (payload) => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] }),
      text: async () => '',
    });

    if (prompt.startsWith('Check these')) {
      seen.checks.push({ system, cached: (body.system || []).some?.((b) => b.cache_control) || false });
      seen.concurrent++;
      seen.mostAtOnce = Math.max(seen.mostAtOnce, seen.concurrent);
      if (slowChecks) await new Promise((r) => setTimeout(r, 20));
      seen.concurrent--;
      const n = Number(prompt.match(/^Check these (\d+)/)[1]);
      return reply({ verdicts: Array.from({ length: n }, (_, i) => ({ index: i, ok: true })) });
    }

    seen.writes.push({ system, prompt });
    const asked = Number(prompt.match(/^Write (\d+) questions/)[1]);
    return reply({
      questions: Array.from({ length: asked }, () => {
        written++;
        return {
          prompt: `Topical question ${written}?`,
          options: [`One ${written}`, `Two ${written}`, `Three ${written}`, `Four ${written}`],
          correctIndex: written % 4,
          answerNote: `Fact ${written}.`,
        };
      }),
    });
  };
  return seen;
}

test('the news is read ONCE, and only the topical rounds are written from it', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  const seen = stubTopical();

  await withTmpDir(async (config) => {
    const result = await generateQuizPack({
      config,
      theme: 'the last month',
      freshDays: 14,
      rounds: [
        { type: 'text', count: 4, topical: true, label: 'The Month Just Gone', focus: 'news from the last month' },
        { type: 'text', count: 4, label: 'Music', focus: 'music from any era' },
      ],
    });

    assert.equal(seen.research, 1, 'the web was read more than once for one quiz');

    // The topical round's writer saw the news; the evergreen round's did not —
    // otherwise it writes about the news anyway and the pack has no ground in it.
    const withNews = seen.writes.filter((w) => w.system.includes('Fact number 1,'));
    assert.ok(withNews.length >= 1, 'the topical round was written without the news');
    assert.ok(
      seen.writes.some((w) => !w.system.includes('Fact number 1,')),
      'the evergreen round was handed the news as well',
    );

    // And the checker was given the same facts, or it is judging questions
    // against a different set of them and rejects true ones.
    assert.ok(seen.checks.some((c) => c.system.includes('Fact number 1,')), 'the checker never saw the news');
    assert.ok(seen.checks.some((c) => c.cached), 'the digest was sent to the checker uncached, on every batch');

    // A pack that says when it stops being current.
    assert.ok(result.quiz.freshUntil, 'no freshUntil on a topical pack');
    assert.equal(result.searches, 5);
    assert.equal(result.quiz.rounds[0].title, 'Round One — The Month Just Gone');
    assert.equal(result.quiz.rounds[1].title, 'Round Two — Music');
  });
});

/*
 * The cache-warming rule, and it is the whole reason caching pays here.
 *
 * Concurrent requests cannot share a cache WRITE. Fire six batches at once and
 * all six arrive before any has finished writing, so all six pay full price
 * for the same couple of thousand tokens. One first, then the rest.
 */
test('with news attached, the first checker batch goes on its own', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  const seen = stubTopical({ slowChecks: true });

  await withTmpDir(async (config) => {
    await generateQuizPack({
      config,
      theme: 'the last month',
      rounds: [{ type: 'text', count: 18, topical: true, focus: 'news from the last month' }],
    });
    assert.ok(seen.checks.length > 2, 'not enough batches to tell anything from');
    // If they had all gone at once, the most in flight would be the batch count.
    assert.ok(seen.mostAtOnce < seen.checks.length, 'every batch went at once — nothing can read the cache');
  });
});

test('an ordinary quiz never reads the web at all', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  const seen = stubTopical();

  await withTmpDir(async (config) => {
    const result = await generateQuizPack({ config, theme: 'the 1980s', rounds: ['text'], perRound: 4 });
    assert.equal(seen.research, 0, 'an evergreen quiz paid for a web search');
    assert.equal(result.quiz.freshUntil, undefined, 'an evergreen quiz should have no date to go past');
    assert.equal(result.searches, 0);
  });
});

/*
 * ONE PLACE DECIDES HOW A PICTURE LOOKS, AND IT IS NOT THE QUESTION.
 *
 * The image round's brief used to ask Claude for "a bold stylised digital
 * illustration" — word for word the `portrait` style that was deleted because
 * Google refuses it. That sentence was written into every question's
 * `imagePrompt` and then embedded verbatim in the prompt, so every picture was
 * asked for as a cartoon caricature AND as a stylised digital illustration at
 * the same time, with the refused word in the middle.
 *
 * It happened to draw anyway — the leading style won — which is exactly why
 * this is a test rather than a note: it is one model update from refusing, and
 * nothing on screen would say why.
 *
 * The split: the STYLE is the host's setting and says how it looks; the
 * imagePrompt is Claude's job and says who is in it.
 */
test('the picture-round brief describes the person, never the style', () => {
  const brief = roundBriefsFor('image');
  assert.ok(brief, 'there is no image-round brief any more');

  for (const word of ['illustration', 'photograph', 'painting', 'watercolour', 'oil painting']) {
    assert.doesNotMatch(brief.replace(/illustrated portrait/g, ''), new RegExp(word, 'i'),
      `the brief asks Claude for "${word}", which fights with the style the host picked`);
  }
  assert.match(brief, /PERSON ONLY|person only/i, 'the brief no longer says to describe the person only');
});

/*
 * A GENERATED PICTURE ROUND MIXES THE EFFECTS.
 *
 * Reported after the first real night: *"the image round was too samey."* It
 * was ten zooms, because `mix` existed and nothing ever set it — `revealMode()`
 * falls back to zoom when a round names nothing, so the four effects were only
 * ever reachable by editing a pack by hand.
 *
 * Safe by construction rather than a judgement call: the four deliberately run
 * on the SAME curve, so the round is worth the same points either way. Pinned
 * because it is one word in an object literal and there is nothing else
 * anywhere that would notice it going missing.
 */
test('a generated picture round rotates the four reveals', async () => {
  process.env.ANTHROPIC_API_KEY = 'stub';
  stubClaude();
  await withTmpDir(async (config) => {
    const { quiz } = await generateQuizPack({ config, theme: 'test', rounds: ['image', 'text'], perRound: 4 });
    const [pics, words] = quiz.rounds;
    assert.equal(pics.reveal, 'mix', 'a generated picture round came back as ten zooms');
    // Every OTHER round type has no business carrying one — a reveal on a text
    // round is a setting that does nothing, which is the fault this codebase
    // keeps recording.
    assert.ok(!('reveal' in words), 'a text round grew a picture setting');
    // And it has to survive being written and read back, or the pack on disk
    // is the one that plays.
    const onDisk = JSON.parse(fs.readFileSync(path.join(config.quizDir, `${quiz.id}.json`), 'utf8'));
    assert.equal(onDisk.rounds[0].reveal, 'mix');
  });
});
