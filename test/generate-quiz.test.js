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

import { generateQuizPack, roundBriefsFor, roundPlan } from '../src/generate-quiz.js';
import { ROUND_TYPES, validateQuiz } from '../src/quizzes.js';

/**
 * Stand in for the Anthropic API.
 *
 * @param {object} opts
 * @param {function(number): number} opts.rejectHowMany  given the batch size, how many to fail
 */
function stubClaude({ rejectHowMany = () => 0 } = {}) {
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
            correctIndex: written % 4,
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
          questions: Array.from({ length: asked }, (_, i) => ({
            prompt: `Stub ${calls}-${i}?`,
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 1,
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
        options: ['a', 'b', 'c', 'd'],
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
