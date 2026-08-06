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

import { generateQuizPack, roundBriefsFor } from '../src/generate-quiz.js';
import { ROUND_TYPES } from '../src/quizzes.js';

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
