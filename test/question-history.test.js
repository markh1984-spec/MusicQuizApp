/**
 * Not asking the same thing twice, across the whole catalogue.
 *
 * The gap this fills was invisible while there were seven packs: `questionKey`
 * dedupes within one generation run, and each round is told what the earlier
 * rounds wrote — but pack twenty had no idea what was in packs one to nineteen.
 * Two eighties quizzes six months apart could share half a dozen answers with
 * nothing anywhere saying so, and the first anybody heard of it was a regular
 * at the same pub saying "we had this one".
 *
 * The load-bearing decision is that it keys on the ANSWER rather than the
 * wording, and most of these tests are about that.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  answerKey, answersOf, answersInCatalogue, filterSeen, avoidAnswers, DEFAULT_MONTHS,
} from '../src/question-history.js';

function catalogue(packs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qhist-'));
  for (const pack of packs) {
    fs.writeFileSync(path.join(dir, `${pack.id}.json`), JSON.stringify(pack), 'utf8');
  }
  return dir;
}

const ask = (answer, prompt = 'Who?') => ({
  prompt, options: [answer, 'Wrong one', 'Wrong two', 'Wrong three'], correctIndex: 0,
});

const pack = (id, answers, createdAt = null) => ({
  id,
  title: `The ${id} Quiz`,
  ...(createdAt ? { createdAt } : {}),
  rounds: [{ id: 'r1', type: 'text', questions: answers.map((a) => ask(a)) }],
});

// ================================================== the same answer, said differently

/*
 * The whole reason this keys on the answer. These two are the same question to
 * a room and share almost no words, so any comparison of the WORDING finds
 * nothing at all.
 */
test('two questions with the same answer are the same question', () => {
  const dir = catalogue([pack('eighties', ['Miley Cyrus'])]);
  const seen = answersInCatalogue(dir);

  const { kept, dropped } = filterSeen(seen, [
    { prompt: 'Which Miley Cyrus single topped the charts that year?', options: ['Miley Cyrus', 'a', 'b', 'c'], correctIndex: 0 },
  ]);
  assert.equal(kept.length, 0, 'a question with an answer already used got through');
  assert.match(dropped[0].because, /already the answer/);
  assert.match(dropped[0].because, /The eighties Quiz/, 'it does not say which pack it clashes with');
});

test('a leading "the" is not a different answer', () => {
  assert.equal(answerKey('The Beatles'), answerKey('Beatles'));
  assert.equal(answerKey('A Tribe Called Quest'), answerKey('Tribe Called Quest'));
});

test('punctuation, case and a bracketed aside are not different answers', () => {
  assert.equal(answerKey('Queen (Freddie Mercury)'), answerKey('queen'));
  assert.equal(answerKey("Guns N' Roses"), answerKey('GUNS N ROSES'));
});

test('different answers stay different', () => {
  assert.notEqual(answerKey('Blur'), answerKey('Oasis'));
  assert.notEqual(answerKey(''), 'x');
});

// ============================================== every kind of round has an answer

/*
 * Three shapes, because the round types answer differently. Pick-them-all is
 * the one worth pinning: the answer is the SET, so every one of them counts —
 * otherwise a later question could reuse one of the right options and nothing
 * would notice.
 */
test('an ordinary question answers with its right option', () => {
  assert.deepEqual(answersOf(ask('Kate Bush')), ['Kate Bush']);
});

test('an alphabet question has no options at all, and still has an answer', () => {
  assert.deepEqual(answersOf({ prompt: 'Who?', answer: 'Fleetwood Mac' }), ['Fleetwood Mac']);
});

test('a pick-them-all question answers with every one of them', () => {
  assert.deepEqual(
    answersOf({ options: ['A', 'B', 'C', 'D', 'E', 'F'], correctIndexes: [0, 2, 4] }),
    ['A', 'C', 'E'],
  );
});

// ==================================================================== the window

/*
 * A window rather than forever, for the same reason bingo has one: on the
 * thirtieth pack every common answer would be used and there would be nothing
 * left to write.
 */
test('a pack older than the window stops blocking its answers', () => {
  const now = Date.parse('2026-08-11T00:00:00Z');
  const old = new Date(now - 400 * 86400000).toISOString();
  const dir = catalogue([pack('ancient', ['Madonna'], old)]);

  assert.equal(answersInCatalogue(dir, { months: DEFAULT_MONTHS, now }).size, 0);
  assert.equal(answersInCatalogue(dir, { months: 24, now }).size, 1, 'a wider window still sees it');
});

/*
 * An undated pack counts as RECENT rather than ancient. An undated pack is
 * almost always an old one — from before the field existed — so treating it as
 * expired would quietly unblock exactly the answers most likely to have been
 * heard already. Blocking is the cheap mistake: the generator over-asks, so a
 * wrongly withheld answer costs nothing.
 */
test('a pack with no date is treated as recent, not as ancient', () => {
  const dir = catalogue([pack('undated', ['Prince'])]);
  assert.equal(answersInCatalogue(dir, { months: 1 }).size, 1);
});

// ================================================================ within a round

test('the same answer twice in one batch is caught too', () => {
  const { kept, dropped } = filterSeen(new Map(), [ask('Blondie'), ask('Blondie', 'Asked another way?')]);
  assert.equal(kept.length, 1);
  assert.match(dropped[0].because, /twice in one round/);
});

// ================================================================== robustness

test('a broken pack in the folder does not take the whole thing down', () => {
  const dir = catalogue([pack('good', ['Abba'])]);
  fs.writeFileSync(path.join(dir, 'broken.json'), '{ not json', 'utf8');
  assert.equal(answersInCatalogue(dir).size, 1);
});

test('no catalogue at all is an empty answer set, not a crash', () => {
  assert.equal(answersInCatalogue('/no/such/place/at/all').size, 0);
});

test('nothing to compare against lets everything through', () => {
  const questions = [ask('Blur'), ask('Oasis'), ask('Pulp')];
  assert.equal(filterSeen(new Map(), questions).kept.length, 3);
});

/*
 * What the WRITER is told is trimmed rather than exhaustive — a catalogue of
 * thirty packs is several hundred answers, and the point is to steer the
 * over-ask rather than to enumerate. `filterSeen` is what actually guarantees
 * it, which is why this one can be lossy without that mattering.
 */
test('the writer is given a steer, not the whole list', () => {
  const many = Array.from({ length: 400 }, (_, i) => `Answer ${i}`);
  const dir = catalogue([pack('big', many)]);
  const seen = answersInCatalogue(dir);
  assert.equal(seen.size, 400);
  assert.equal(avoidAnswers(seen).length, 150);
  assert.ok(avoidAnswers(seen).every((a) => typeof a === 'string' && a.length));
});
