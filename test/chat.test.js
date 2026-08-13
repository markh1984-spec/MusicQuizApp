/**
 * CHAT — the rooms, and the two ways it could go badly wrong.
 *
 * The first is a LEAK: a team's messages reaching another team, or the
 * organisers' back channel reaching a player. That is worse than an answer-key
 * leak, because an answer is something the room was going to be told in twenty
 * seconds anyway and somebody's private conversation is not.
 *
 * The second is CHEATING: the main room, during a live question, is a channel
 * for broadcasting the answer to sixty people at once — instant and social,
 * and far worse than googling. Emoji only while the clock runs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES } from '../src/engine.js';
import { isJustEmoji, cleanMessage, roomsFor, MAIN, ORGANISERS, teamRoom, KEEP_PER_ROOM } from '../src/chat.js';

const quiz = () => ({
  id: 'chat-test',
  title: 'A Chat Test Quiz',
  rounds: [{
    title: 'Round One',
    type: 'text',
    questions: [
      { prompt: 'Who sang Wuthering Heights?', options: ['Kate Bush', 'Bjork', 'Sia', 'Enya'], correctIndex: 0 },
      { prompt: 'And Cloudbusting?', options: ['Kate Bush', 'Bjork', 'Sia', 'Enya'], correctIndex: 0 },
    ],
  }],
});

/** An online game with two teams and one organiser, sitting in the lobby. */
function room() {
  let t = 1_000_000;
  const engine = new Engine({ quiz: quiz(), now: () => t });
  engine.state.online = true;
  const rob = engine.join({ name: 'Rob' }).id;
  const sam = engine.join({ name: 'Sam' }).id;
  const it = engine.join({ name: 'Their IT person' }).id;
  engine.setOrganiser(it, true);
  return { engine, rob, sam, it, tick: (ms) => { t += ms; } };
}

/** Push it to a live question. */
function toQuestion(engine) {
  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();
}

// ------------------------------------------------------------- the primitives

test('emoji is emoji, and words are words', () => {
  for (const yes of ['🎉', '😂😂😂', '👏 👏', '🎉️', '🤦‍♂️', '👍🏽']) {
    assert.equal(isJustEmoji(yes), true, `${yes} should count as a reaction`);
  }
  for (const no of ['kate bush', 'A', '3', 'it is A 🎉', 'A!', '', '   ']) {
    assert.equal(isJustEmoji(no), false, `${JSON.stringify(no)} should count as words`);
  }
});

test('a message is tidied like a team name, and never filtered for words', () => {
  assert.equal(cleanMessage('  hello   there  '), 'hello there');
  assert.equal(cleanMessage('two\nlines\ttabbed'), 'two lines tabbed');
  assert.equal(cleanMessage('x'.repeat(500)).length, 240);
  // The host asked for no filtering on names and the same holds here. The
  // control is that he sees every room and can remove somebody.
  assert.equal(cleanMessage('bloody hell'), 'bloody hell');
});

test('who is in which room', () => {
  assert.deepEqual(roomsFor({ name: 'Rob' }), [MAIN]);
  assert.deepEqual(roomsFor({ name: 'IT', organiser: true }), [MAIN, ORGANISERS]);
  assert.deepEqual(roomsFor({ name: 'Rob', teamId: 't1' }), [MAIN, teamRoom('t1')]);
  assert.deepEqual(roomsFor(null), []);
});

// ------------------------------------------------------------------ the leaks

test('A PLAYER NEVER SEES THE ORGANISERS ROOM', () => {
  const { engine, rob, it } = room();
  engine.say(it, ORGANISERS, 'The projector has frozen, stall them');

  const theirs = engine.playerView(rob);
  assert.deepEqual(Object.keys(theirs.chat), [MAIN], 'only the room they are in');
  assert.ok(!JSON.stringify(theirs).includes('stall them'), 'the back channel leaked to a player');

  // And the screen — pointed at nobody in particular — carries none of it.
  assert.ok(!JSON.stringify(engine.screenView()).includes('stall them'));
});

test('the organiser DOES see their own room, and the main one', () => {
  const { engine, it } = room();
  engine.say(it, ORGANISERS, 'The projector has frozen, stall them');
  const view = engine.playerView(it);
  assert.deepEqual(Object.keys(view.chat).sort(), [MAIN, ORGANISERS].sort());
  assert.equal(view.chat[ORGANISERS][0].text, 'The projector has frozen, stall them');
});

test('THE HOST SEES EVERY ROOM — that is the whole moderation story', () => {
  const { engine, rob, it } = room();
  engine.say(it, ORGANISERS, 'back channel');
  engine.say(rob, MAIN, 'hello everybody');
  const host = engine.hostView();
  assert.equal(host.chat[ORGANISERS][0].text, 'back channel');
  assert.equal(host.chat[MAIN][0].text, 'hello everybody');
});

test('a message carries a faceKey, never a player id', () => {
  const { engine, rob } = room();
  engine.say(rob, MAIN, 'hello');
  const message = engine.hostView().chat[MAIN][0];
  assert.ok(message.by && message.by !== rob, 'a player id is a bearer credential');
  assert.ok(!JSON.stringify(engine.playerView(rob).chat).includes(rob));
});

test('you cannot post into a room you are not in', () => {
  const { engine, rob } = room();
  const out = engine.say(rob, ORGANISERS, 'let me in');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'not_your_room');
  assert.equal(engine.hostView().chat[ORGANISERS], undefined, 'nothing was written');
});

// ---------------------------------------------------------------- the cheating

test('THE MAIN ROOM IS EMOJI ONLY WHILE A QUESTION IS LIVE', () => {
  const { engine, rob } = room();
  toQuestion(engine);

  const words = engine.say(rob, MAIN, 'the answer is Kate Bush');
  assert.equal(words.ok, false);
  assert.equal(words.reason, 'emoji_only');
  assert.ok(!JSON.stringify(engine.hostView().chat).includes('Kate Bush'), 'it must not be stored either');

  const cheer = engine.say(rob, MAIN, '😱');
  assert.equal(cheer.ok, true, 'the atmosphere is the point of the room');
});

test('…and words come back the moment the answer is up', () => {
  const { engine, rob } = room();
  toQuestion(engine);
  assert.equal(engine.say(rob, MAIN, 'knew it').ok, false);
  engine.reveal();
  assert.equal(engine.say(rob, MAIN, 'knew it').ok, true);
});

test('the ORGANISERS room is never gagged — that is when they need it', () => {
  const { engine, it } = room();
  toQuestion(engine);
  const out = engine.say(it, ORGANISERS, 'Nobody can hear you, your mic is muted');
  assert.equal(out.ok, true, 'the back channel is the one that matters mid-question');
});

test('a team room is never gagged either, because conferring is the point', () => {
  const { engine, rob } = room();
  engine.state.players[rob].teamId = 't1';
  toQuestion(engine);
  assert.equal(engine.say(rob, teamRoom('t1'), 'I reckon it is the first one').ok, true);
});

// ------------------------------------------------------------- the organiser

test('AN ORGANISER CANNOT ANSWER AND IS NOT ON THE SCOREBOARD', () => {
  const { engine, rob, it } = room();
  toQuestion(engine);
  const tried = engine.answer({ playerId: it, optionIndex: 0 });
  assert.equal(tried.ok, false);
  assert.equal(tried.reason, 'organiser', 'the person who booked you must not win their own night');

  engine.answer({ playerId: rob, optionIndex: 0 });
  const board = engine.leaderboard();
  assert.ok(board.every((p) => p.id !== it), 'an organiser is not a contestant');
  assert.ok(board.some((p) => p.id === rob));
});

// -------------------------------------------------------------- a pub night

test('CHAT DOES NOT EXIST IN A PUB, and that is deliberate', () => {
  let t = 1_000_000;
  const engine = new Engine({ quiz: quiz(), now: () => t });   // online is false
  const rob = engine.join({ name: 'Rob' }).id;
  const out = engine.say(rob, MAIN, 'hello');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'not_online', 'a pub already has a room, and the app keeps people looking up');
  assert.deepEqual(engine.playerView(rob).chat, {});
  assert.deepEqual(engine.hostView().chat, {});
});

// ------------------------------------------------------------------ the size

test('a room keeps the last N and no more — the state file is the next ceiling', () => {
  const { engine, rob } = room();
  for (let i = 0; i < KEEP_PER_ROOM + 25; i++) engine.say(rob, MAIN, `message ${i}`);
  const kept = engine.hostView().chat[MAIN];
  assert.equal(kept.length, KEEP_PER_ROOM);
  assert.equal(kept.at(-1).text, `message ${KEEP_PER_ROOM + 24}`, 'the newest survive');
  assert.equal(kept[0].text, 'message 25', 'the oldest are dropped');
});

test('it survives a crash, because it is in the state like everything else', () => {
  const { engine, rob } = room();
  engine.say(rob, MAIN, 'still here?');
  const onDisk = JSON.parse(JSON.stringify(engine.state));
  const back = new Engine({ quiz: quiz(), state: onDisk, now: () => 1_000_000 });
  assert.equal(back.playerView(rob).chat[MAIN][0].text, 'still here?');
});
