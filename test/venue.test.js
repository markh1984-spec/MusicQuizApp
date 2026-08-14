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

/*
 * WHAT THEY ARE PLAYING FOR, on the opening screen — and nowhere else.
 *
 * The prize is not a secret: the host says it on the mic and it is the reason
 * half the room bothers. The voucher CODE is a different thing entirely, and
 * that must never reach a screen the whole pub can see.
 */
test('the lobby tells the room what it is playing for', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.rewards = ['A free drink at the bar', 'A packet of crisps'];
  assert.deepEqual(engine.screenView().rewards, ['A free drink at the bar', 'A packet of crisps']);
});

test('but a question never carries it — one thing on a projector', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.rewards = ['A free drink at the bar'];
  engine.start();
  engine.next();
  assert.equal(engine.screenView().rewards, undefined);
});

test('a night with no prizes gains no field at all', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  assert.equal(engine.screenView().rewards, undefined);
});

test('AND THE VOUCHER CODE IS NEVER ON THE BIG SCREEN', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.rewards = ['A free drink at the bar'];
  const id = engine.join({ name: 'Rob' }).id;
  engine.start();
  engine.next();
  engine.answer({ playerId: id, optionIndex: 0 });
  engine.reveal();
  engine.finish();
  const codes = Object.values(engine.state.vouchers || {}).map((v) => v.code);
  const payload = JSON.stringify(engine.screenView());
  for (const code of codes) assert.ok(!payload.includes(code), 'a voucher code reached the projector');
});
