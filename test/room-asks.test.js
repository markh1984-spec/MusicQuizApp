/**
 * WHAT THE ROOM ASKED FOR.
 *
 * The things worth pinning down are the ones that would turn a round-idea box
 * into a moderation job: one phone flooding it, the same idea counted as one
 * voice when it came from four, and a "no" that comes back tomorrow.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RoomAsks, cleanAsk, askKey, MAX_ASK, MAX_PER_PLAYER } from '../src/room-asks.js';
import { Engine, PHASES } from '../src/engine.js';
import { pickIdeas, ideaLabel, ROUND_IDEAS } from '../src/round-ideas.js';

const box = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asks-'));
  let clock = 1_000;
  return new RoomAsks(path.join(dir, 'room-asks.json'), () => (clock += 1000));
};

test('an ask is tidied like a team name and capped, with no word filtering', () => {
  assert.equal(cleanAsk('  a   reggae    round  '), 'a reggae round');
  assert.equal(cleanAsk('x'.repeat(200)).length, MAX_ASK);
  // Deliberately no filter — the same rule as team names. It is read by one
  // person and never projected.
  assert.equal(cleanAsk('a bloody reggae round'), 'a bloody reggae round');
});

test('ONE PHONE CANNOT FLOOD IT', () => {
  const asks = box();
  for (let i = 0; i < MAX_PER_PLAYER; i++) {
    assert.equal(asks.add({ text: `idea ${i}`, by: 'p1', night: '2026-08-14' }).ok, true);
  }
  const over = asks.add({ text: 'one more', by: 'p1', night: '2026-08-14' });
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'enough');
  // And somebody else is unaffected.
  assert.equal(asks.add({ text: 'a ska round', by: 'p2', night: '2026-08-14' }).ok, true);
});

test('the same phone asking twice is a double tap, not a vote', () => {
  const asks = box();
  asks.add({ text: 'A reggae round', by: 'p1', night: '2026-08-14' });
  const again = asks.add({ text: 'a reggae round!', by: 'p1', night: '2026-08-14' });
  assert.equal(again.already, true);
  assert.equal(asks.all.length, 1);
});

test('FOUR PEOPLE ASKING FOR REGGAE IS ONE ROW WITH A FOUR ON IT', () => {
  // Which is the number that decides whether it is worth writing — a list of
  // four identical lines is not the same fact and is four times the reading.
  const asks = box();
  for (const by of ['p1', 'p2', 'p3', 'p4']) {
    asks.add({ text: 'A reggae round', by, night: '2026-08-14', venue: 'The Crown' });
  }
  asks.add({ text: 'Nineties dance', by: 'p5', night: '2026-08-14', venue: 'The Crown' });
  const groups = asks.grouped();
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 4, 'most asked comes first');
  assert.deepEqual(groups[0].venues, ['The Crown']);
  assert.equal(groups[0].ids.length, 4);
});

test('yes keeps it, no deletes it — and there is no third state to browse', () => {
  const asks = box();
  const a = asks.add({ text: 'A reggae round', by: 'p1', night: '2026-08-14' }).ask;
  const b = asks.add({ text: 'Bagpipe round', by: 'p2', night: '2026-08-14' }).ask;

  asks.keep(a.id);
  assert.deepEqual(asks.kept.map((k) => k.text), ['A reggae round']);
  assert.deepEqual(asks.pending.map((k) => k.text), ['Bagpipe round']);

  assert.equal(asks.drop(b.id), true);
  assert.equal(asks.all.length, 1, 'a no is gone, not filed');
  assert.equal(asks.drop(b.id), false, 'and dropping it again is honest about it');
});

test('it survives a restart, because it is a file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asks-'));
  const file = path.join(dir, 'room-asks.json');
  const first = new RoomAsks(file, () => 1000);
  first.add({ text: 'A reggae round', by: 'p1', night: '2026-08-14' });
  const second = new RoomAsks(file, () => 2000);
  assert.equal(second.all.length, 1);
});

test('grouping ignores punctuation and case, which is how people type', () => {
  assert.equal(askKey('A Reggae Round!'), askKey('a reggae round'));
  assert.notEqual(askKey('a reggae round'), askKey('a ska round'));
});

// ------------------------------------------------------- and in the engine

const quiz = () => ({
  id: 'asks-test',
  title: 'A Test Quiz',
  rounds: [{ title: 'Round One', type: 'text', questions: [
    { prompt: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] }],
});

const IDEAS = [{ id: 'reggae', label: 'A reggae round' }, { id: 'disco', label: 'A disco round' }];

test('THE THREE ARE OFF UNLESS THE NIGHT TURNED THEM ON', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  const id = engine.join({ name: 'Rob' }).id;
  engine.state.phase = PHASES.FINAL;
  engine.state.roundIdeas = IDEAS;
  assert.equal(engine.playerView(id).roundIdeas, undefined);

  engine.state.askForRounds = true;
  assert.deepEqual(engine.playerView(id).roundIdeas, IDEAS);
});

test('and only at the END — never mid-quiz', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.askForRounds = true;
  engine.state.roundIdeas = IDEAS;
  const id = engine.join({ name: 'Rob' }).id;
  engine.start();
  engine.next();
  assert.equal(engine.playerView(id).roundIdeas, undefined, 'a vote mid-question is not what this is');
});

test('nothing to offer means nothing is asked', () => {
  // A library that already has everything: the buttons do not appear at all
  // rather than appearing empty.
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  engine.state.askForRounds = true;
  engine.state.roundIdeas = [];
  const id = engine.join({ name: 'Rob' }).id;
  engine.state.phase = PHASES.FINAL;
  assert.equal(engine.playerView(id).roundIdeas, undefined);
});

test('a game restored from before this existed simply has no box', () => {
  const engine = new Engine({ quiz: quiz(), now: () => 1_000_000 });
  const old = JSON.parse(JSON.stringify(engine.state));
  delete old.askForRounds;
  delete old.roundIdeas;
  const back = new Engine({ quiz: quiz(), state: old, now: () => 1_000_000 });
  const id = back.join({ name: 'Rob' }).id;
  back.state.phase = PHASES.FINAL;
  assert.equal(back.playerView(id).roundIdeas, undefined);
});

// --------------------------------------------------------------- the three

test('THE THREE ARE ONES THE LIBRARY HAS NOT GOT', () => {
  // Offering a Motown round to somebody who owns the Motown quiz wastes one of
  // three slots and makes the app look like it has not read its own shelf.
  const titles = ['The Motown Quiz', 'Reggae and Ska Classics', 'The 1980s Pop Music Quiz'];
  const ideas = pickIdeas(titles, { count: 30, random: () => 0 });
  const ids = ideas.map((i) => i.id);
  assert.ok(!ids.includes('motown'));
  assert.ok(!ids.includes('reggae'));
  assert.ok(!ids.includes('eighties'), 'an 80s pack covers the 80s round');
  assert.ok(ids.includes('disco'), 'and everything else is still on offer');
});

test('it offers three, and the same three for one injected clock', () => {
  const ideas = pickIdeas([], { random: () => 0.5 });
  assert.equal(ideas.length, 3);
  assert.deepEqual(ideas, pickIdeas([], { random: () => 0.5 }));
  // Shape only: an id and a label, because that is all a phone is ever told.
  assert.deepEqual(Object.keys(ideas[0]).sort(), ['id', 'label']);
});

test('a library with everything asks nothing rather than repeating itself', () => {
  const everything = ROUND_IDEAS.flatMap((i) => i.words);
  assert.deepEqual(pickIdeas(everything), []);
});

test('A VOTE CARRIES AN ID, AND THE WORDS COME FROM OUR OWN LIST', () => {
  // Which is the whole reason there is nothing to moderate.
  assert.equal(ideaLabel('reggae'), 'A reggae round');
  assert.equal(ideaLabel('not-a-thing'), '');
});

test('one vote each, and voting again replaces it', () => {
  const asks = box();
  asks.vote({ ideaId: 'reggae', label: 'A reggae round', by: 'p1', night: '2026-08-14' });
  asks.vote({ ideaId: 'disco', label: 'A disco round', by: 'p1', night: '2026-08-14' });
  assert.equal(asks.all.length, 1, 'a change of mind is not a second voice');
  assert.equal(asks.all[0].text, 'A disco round');
  assert.equal(asks.voteBy('p1', '2026-08-14'), 'disco');
  // Somebody else is a second voice.
  asks.vote({ ideaId: 'reggae', label: 'A reggae round', by: 'p2', night: '2026-08-14' });
  assert.equal(asks.grouped().length, 2);
});
