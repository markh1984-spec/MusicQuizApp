/**
 * Reading the last month, and the three ways that goes wrong.
 *
 * No network anywhere — `fetch` is injected, the same way the clock is
 * everywhere else in this codebase. What is actually being pinned here is not
 * "does a search work" but the shape of the call and, more importantly, the
 * shape of the refusal: a topical quiz written from no news at all is forty
 * confidently invented current events, which is the worst thing this app can
 * put in front of a room.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  researchDigest, digestBrief, digestBlock, tidyDigest, worthCaching,
  SEARCH_TOOL, DEFAULT_DAYS,
} from '../src/research.js';

import { roundPlan, TOPICAL_ROUNDS, TOPICAL_DAYS, topicalNaming } from '../src/generate-quiz.js';

const AUGUST = Date.parse('2026-08-11T10:00:00Z');

/** A reply as the API sends one back. */
function reply({ text, searches = 3, stop = 'end_turn', urls = [] }) {
  return {
    ok: true,
    json: async () => ({
      stop_reason: stop,
      usage: {
        input_tokens: 1200,
        output_tokens: 900,
        server_tool_use: { web_search_requests: searches },
      },
      content: [
        ...(urls.length
          ? [{ type: 'web_search_tool_result', content: urls.map((url) => ({ url, title: 'a page' })) }]
          : []),
        { type: 'text', text },
      ],
    }),
  };
}

const FACTS = Array.from({ length: 10 }, (_, i) =>
  `2026-08-0${(i % 9) + 1} — Somebody did thing number ${i} in front of ${i * 1000} people. (bbc.co.uk)`).join('\n');

// ============================================================== the ordinary case

test('it comes back with the facts, the searches and where it looked', async () => {
  const calls = [];
  const spent = [];
  const got = await researchDigest({
    apiKey: 'k',
    now: () => AUGUST,
    onSpend: (row) => spent.push(row),
    fetchImpl: async (url, opts) => {
      calls.push(JSON.parse(opts.body));
      return reply({ text: FACTS, searches: 7, urls: ['https://www.bbc.co.uk/news/1', 'https://theguardian.com/x'] });
    },
  });

  assert.equal(got.lines, 10);
  assert.equal(got.searches, 7);
  assert.deepEqual(got.sources.sort(), ['bbc.co.uk', 'theguardian.com']);

  // One call, carrying the search tool.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tools[0].type, SEARCH_TOOL, 'the wrong web search tool version');

  // And it was written down, INCLUDING the searches — which is the one line on
  // the bill that grows with how topical the writing is rather than how much.
  assert.equal(spent.length, 1);
  assert.equal(spent[0].searches, 7);
  assert.equal(spent[0].tokensOut, 900);
});

/*
 * The date is passed in rather than left to the model. It does not reliably
 * know what day it is, and a briefing about the wrong month looks exactly like
 * a briefing about the right one.
 */
test('the brief names today and the day it reaches back to', () => {
  const brief = digestBrief({ days: 31, today: '2026-08-11' });
  assert.match(brief, /Today is 2026-08-11/);
  assert.match(brief, /2026-07-11/);
});

// ================================================================ the refusal

/*
 * The one place in this codebase where a failure stops the job. Everything
 * else keeps going because by the time it fails the generation is minutes and
 * real money deep — this is the FIRST call, so there is nothing to lose, and
 * what carrying on would produce is a quiz of invented news.
 */
test('too little news refuses rather than writing from nothing', async () => {
  await assert.rejects(
    researchDigest({
      apiKey: 'k',
      now: () => AUGUST,
      fetchImpl: async () => reply({ text: '2026-08-01 — One thing happened. (bbc.co.uk)' }),
    }),
    /not enough to write a topical quiz from/,
  );
});

test('a refusal from the API is passed on with its reason, not swallowed', async () => {
  await assert.rejects(
    researchDigest({
      apiKey: 'k',
      now: () => AUGUST,
      fetchImpl: async () => ({ ok: false, status: 429, text: async () => 'rate limited' }),
    }),
    /429/,
  );
});

// ============================================================ the paused loop

/*
 * The server runs its own search loop and stops it after ten goes, handing
 * back `pause_turn` instead of an answer. Not resuming looks exactly like a
 * quiet month: a short digest and no error anywhere.
 */
test('a paused search loop is resumed, and every leg is paid for', async () => {
  const bodies = [];
  const spent = [];
  const got = await researchDigest({
    apiKey: 'k',
    now: () => AUGUST,
    onSpend: (row) => spent.push(row),
    fetchImpl: async (url, opts) => {
      bodies.push(JSON.parse(opts.body));
      return bodies.length === 1
        ? reply({ text: '2026-08-01 — half a thought. (bbc.co.uk)', stop: 'pause_turn', searches: 10 })
        : reply({ text: FACTS, searches: 2 });
    },
  });

  assert.equal(bodies.length, 2, 'it did not resume');
  // Resuming is the same conversation with the assistant's half appended and
  // NO extra instruction — an added "continue" reads as a new request.
  assert.equal(bodies[1].messages.length, 2);
  assert.equal(bodies[1].messages[1].role, 'assistant');
  assert.equal(got.searches, 12, 'the paused leg\'s searches were not counted');
  assert.equal(spent.length, 2, 'only one of the two calls was written down');
});

// ============================================================ tidying the reply

/*
 * A model that has just done twelve searches usually cannot resist an opening
 * sentence, and that sentence would then sit in the cached prefix and in every
 * writing call, paid for over and over. A line with no date is also a line the
 * checker has no way to check.
 */
test('anything without a date is not a fact', () => {
  const tidied = tidyDigest(`
Here is a summary of the last month:

- 2026-08-02 — A thing happened. (bbc.co.uk)
Generally, it was a busy month for music.
* 2026-08-05 — Another thing. (nme.com)

Let me know if you would like more.`);
  assert.deepEqual(tidied.split('\n'), [
    '2026-08-02 — A thing happened. (bbc.co.uk)',
    '2026-08-05 — Another thing. (nme.com)',
  ]);
});

test('the digest is handed over as the only thing known about recent events', () => {
  const block = digestBlock('2026-08-02 — A thing. (bbc.co.uk)');
  assert.match(block, /ONLY THING YOU KNOW/);
  assert.match(block, /A thing/);
  assert.equal(digestBlock(''), '', 'an empty digest should add nothing to a prompt');
});

// ================================================================== caching

/*
 * A cache breakpoint below Anthropic's minimum is not free — a write costs a
 * quarter more than the same tokens cold — so a small prompt marked for
 * caching is a surcharge on tokens that were never going to be reused.
 */
test('a small prompt is not worth a cache breakpoint', () => {
  assert.equal(worthCaching('a short instruction'), false);
  assert.equal(worthCaching('x'.repeat(4000), 'x'.repeat(1000)), true);
});

// ============================================================== the round plan

test('a round can say what it is about, what it is called and that it is topical', () => {
  const plan = roundPlan([
    { type: 'text', count: 20, topical: true, label: 'The Month Just Gone', focus: 'news from the last month' },
    { type: 'text', count: 10 },
  ]);
  assert.deepEqual(plan[0], {
    type: 'text', count: 20, focus: 'news from the last month', label: 'The Month Just Gone', topical: true,
  });
  // And an ordinary round carries none of it, so nothing else has to learn
  // that topical rounds exist.
  assert.deepEqual(plan[1], { type: 'text', count: 10 });
});

test('the topical quiz is 40 questions and ends on an evergreen round', () => {
  const plan = roundPlan(TOPICAL_ROUNDS);
  assert.equal(plan.reduce((n, r) => n + r.count, 0), 40);
  assert.equal(plan.filter((r) => r.topical).length, 2);
  assert.ok(!plan[plan.length - 1].topical, 'the last round must not be topical — see TOPICAL_ROUNDS');
});

/*
 * Two in one week must not overwrite each other, which is exactly what the
 * host asked for: one of average difficulty and one pitched harder.
 */
test('an average and a hard topical quiz on the same day are two packs', () => {
  const easy = topicalNaming(AUGUST);
  const hard = topicalNaming(AUGUST, { hard: true });
  assert.equal(easy.id, 'topical-2026-08-11');
  assert.notEqual(easy.id, hard.id);
  assert.match(hard.title, /Hard/);
  assert.match(easy.title, /11 August 2026/);
});

test('a fortnight, not a week — the same quiz gets a second venue', () => {
  assert.ok(TOPICAL_DAYS >= 14, 'a topical pack has to survive a second outing');
  assert.equal(DEFAULT_DAYS >= 28, true, 'a week is not enough material for thirty questions');
});
