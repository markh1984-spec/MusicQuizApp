/**
 * WHERE THE NIGHT WAS.
 *
 * A Past gigs page that cannot say where is a list of dates, and four other
 * features — headcount per venue, the calendar, the invoice that fills itself
 * in, the directory — are all waiting on this one field.
 *
 * It is a plain NAME rather than an id, because almost no venue is a
 * Quizporium account and almost none ever will be. Free text is the common
 * case, so it has to be the cheap one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';

const quiz = () => ({
  id: 'venue-test',
  title: 'A Venue Test Quiz',
  rounds: [{ title: 'Round One', type: 'text', questions: [
    { prompt: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] }],
});

test('a night with no venue is still a night', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  assert.equal(engine.state.venue, '');
  assert.equal(engine.results().venue, '');
});

test('the venue rides on the results, which is what gets archived', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.venue = 'The Station Tap';
  assert.equal(engine.results().venue, 'The Station Tap');
});

test('IT SURVIVES A CRASH — a night that came back without its venue is filed under nothing', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.venue = 'The Dog and Duck';
  const back = new Engine({ quiz: quiz(), state: JSON.parse(JSON.stringify(engine.state)), now: () => 1_000_000 });
  assert.equal(back.state.venue, 'The Dog and Duck');
  assert.equal(back.results().venue, 'The Dog and Duck');
});

test('a state written before venues existed reads as no venue, not as undefined', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  const old = JSON.parse(JSON.stringify(engine.state));
  delete old.venue;
  const back = new Engine({ quiz: quiz(), state: old, now: () => 1_000_000 });
  assert.equal(back.results().venue, '');
});

test('IT IS NOT IN ANY PLAYER OR SCREEN PAYLOAD', () => {
  // Not secret, but not theirs either — the room is standing in the venue and
  // does not need telling which one. Kept out so the payload does not grow a
  // field for nobody, and so nothing downstream starts depending on it.
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.venue = 'The Dog and Duck';
  const id = engine.join({ name: 'Rob' }).id;
  assert.ok(!JSON.stringify(engine.playerView(id)).includes('Dog and Duck'));
  assert.ok(!JSON.stringify(engine.screenView()).includes('Dog and Duck'));
});
