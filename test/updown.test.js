/**
 * UP OR DOWN — higher or lower, the last one standing gets a drink.
 * `src/updown.js`, `public/assets/updown-rules.js`. Picked 9 October 2026.
 *
 * What has to hold:
 *  - wrong is out, and so is a phone that never said;
 *  - nobody goes out on a pair, and the whole room cannot go out at once — so
 *    a game always ends with exactly one winner, holding the part's drink;
 *  - a vote is the SERVER's to time (rule 2) and a phone's own (rule 3);
 *  - the projector says how many have voted, never which way, until the turn;
 *  - it carries the night through, like Pub Prix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { UpDownGame, UPDOWN_PHASES } from '../src/updown.js';
import { Session } from '../src/session.js';
import { compare, rankOf, shuffled, cardAt, VOTE_MS } from '../public/assets/updown-rules.js';

const T0 = 1_800_000_000_000;

function game(names = ['Ann', 'Bob', 'Cat']) {
  const clock = { t: T0 };
  const g = new UpDownGame({ now: () => clock.t, random: () => 0.42 });
  const players = names.map((name) => g.join({ name }));
  g.state.rewards = ['A pint', 'A half'];
  return { g, clock, players };
}

/** The way the next card will go, read off the state — what a cheat would want. */
function truth(g) {
  const s = g.state.game;
  return compare(cardAt(s.order, s.at), cardAt(s.order, s.at + 1));
}

test('the rules: Ace low, King high, a pair is a pair', () => {
  assert.equal(rankOf('A♠'), 1);
  assert.equal(rankOf('K♥'), 13);
  assert.equal(compare({ rank: '7' }, { rank: '9' }), 'higher');
  assert.equal(compare({ rank: 'Q' }, { rank: '2' }), 'lower');
  assert.equal(compare({ rank: '5' }, { rank: '5' }), 'same');
  assert.deepEqual(shuffled(9), shuffled(9), 'one seed, one deck — a restart deals the same');
  assert.equal(new Set(shuffled(9)).size, 52);
});

test('wrong is out, and so is a phone that never said', () => {
  const { g, players: [ann, bob, cat] } = game();
  assert.equal(g.startUpDown().ok, true);
  let way = truth(g);
  // Skip pairs so the test is about right and wrong.
  while (way === 'same') { g.turnCard(); g.nextCard(); way = truth(g); }
  const right = way === 'higher' ? 'up' : 'down';
  const wrong = right === 'up' ? 'down' : 'up';
  g.voteUpDown(ann.id, right);
  g.voteUpDown(bob.id, wrong);
  // Cat says nothing.
  const out = g.turnCard();
  assert.equal(out.ok, true);
  assert.deepEqual(g.state.game.alive, [ann.id], 'Ann was right; Bob was wrong; Cat never said');
  assert.equal(g.state.phase, UPDOWN_PHASES.DONE, 'one left is a winner');
  assert.equal(g.state.game.winner.name, 'Ann');
});

test('the winner holds the part\'s drink, marked so no phone says they won the quiz', () => {
  const { g, players: [ann, bob] } = game(['Ann', 'Bob']);
  g.startUpDown();
  while (truth(g) === 'same') { g.turnCard(); g.nextCard(); }
  const right = truth(g) === 'higher' ? 'up' : 'down';
  g.voteUpDown(ann.id, right);
  g.voteUpDown(bob.id, right === 'up' ? 'down' : 'up');
  g.turnCard();
  const v = Object.values(g.state.vouchers)[0];
  assert.equal(v.winnerId, ann.id);
  assert.equal(v.reward, 'A pint');
  assert.equal(v.updown, true);
  assert.equal(v.place, null);
  assert.equal(g.hostView().nextPrize, 'A half', 'the next game pays the next drink');
  assert.ok(g.playerView(ann.id).vouchers.some((x) => x.updown && x.reward === 'A pint'));
});

test('nobody goes out on a pair, and the whole room cannot go out at once', () => {
  const { g, players } = game();
  g.startUpDown();
  // Force a pair: the next card has the same rank as this one.
  const s = g.state.game;
  const rank = cardAt(s.order, s.at).rank;
  const twin = s.order.findIndex((i, n) => n > s.at + 1 && cardAt(s.order, n).rank === rank);
  [s.order[s.at + 1], s.order[twin]] = [s.order[twin], s.order[s.at + 1]];
  g.voteUpDown(players[0].id, 'up');
  g.turnCard();
  assert.equal(g.state.game.alive.length, 3, 'a pair: everybody stays');
  assert.equal(g.state.game.last.pair, true);
  g.nextCard();
  while (truth(g) === 'same') { g.turnCard(); g.nextCard(); }
  const wrong = truth(g) === 'higher' ? 'down' : 'up';
  for (const p of players) g.voteUpDown(p.id, wrong);
  g.turnCard();
  assert.equal(g.state.game.alive.length, 3, 'everybody wrong: nobody goes');
  assert.equal(g.state.game.last.everyoneWrong, true);
});

test('a vote is the server\'s to time, and only a phone still in may cast one', () => {
  const { g, clock, players: [ann, bob] } = game();
  g.startUpDown();
  assert.equal(g.voteUpDown(ann.id, 'sideways').reason, 'bad_choice');
  assert.equal(g.voteUpDown('nobody', 'up').reason, 'not_in');
  assert.equal(g.voteUpDown(ann.id, 'up').ok, true);
  assert.equal(g.voteUpDown(ann.id, 'down').vote, 'down', 'a mind may change before the clock runs out');
  clock.t += VOTE_MS + 1;
  assert.equal(g.voteUpDown(bob.id, 'up').reason, 'too_late', 'the server\'s clock closes it (rule 2)');
});

test('the projector says how many have voted, never which way, and carries no id', () => {
  const { g, players } = game();
  g.startUpDown();
  g.voteUpDown(players[0].id, 'up');
  g.voteUpDown(players[1].id, 'up');
  const wire = g.screenView();
  assert.equal(wire.updown.voted, 2);
  assert.equal(wire.updown.up, undefined, 'no split while the clock runs');
  assert.equal(wire.updown.down, undefined);
  assert.equal(g.hostView().updown.up, 2, 'the host sees the split');
  const text = JSON.stringify(wire);
  for (const p of players) {
    assert.ok(!text.includes(p.id), 'no player id on the projector (rule 3)');
    assert.ok(!text.includes(p.token), 'no token on the projector (rule 3)');
  }
  assert.equal(JSON.stringify(g.screenView()).includes('"next"'), false, 'the next card is not on the wire before the turn');
});

test('a phone that joins mid-game watches, and plays the next one', () => {
  const { g } = game();
  g.startUpDown();
  const late = g.join({ name: 'Late' });
  assert.equal(g.playerView(late.id).updown.status, 'watching');
  assert.equal(g.voteUpDown(late.id, 'up').reason, 'not_in');
});

test('a game comes back from its saved state as it was (rule 7)', () => {
  const { g, players } = game();
  g.startUpDown();
  g.voteUpDown(players[0].id, 'up');
  const saved = JSON.parse(JSON.stringify(g.state));
  const back = new UpDownGame({ state: saved, now: () => T0 });
  assert.equal(back.state.phase, UPDOWN_PHASES.GUESSING);
  assert.deepEqual(back.state.game.votes, saved.game.votes);
  assert.equal(back.screenView().updown.card, g.screenView().updown.card);
});

test('quiz → Up or Down → quiz: the night and the drink come through', () => {
  const dir = mkdtempSync(join(tmpdir(), 'updown-'));
  try {
    for (const id of ['quiz-a', 'quiz-b']) {
      writeFileSync(join(dir, `${id}.json`), JSON.stringify({
        id, title: id, questionSeconds: 20,
        rounds: [{ id: 'r1', type: 'text', title: 'R', questions: [{ id: 'q1', prompt: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] }],
      }));
    }
    const session = new Session({
      config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
      store: { load: () => null, save: () => {}, flush: () => {}, write: () => {} },
      onPush: () => {},
      now: () => T0,
    });
    session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'updown', packId: 'up-or-down' },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ], { venue: 'The Crown', rewards: ['Fizz', 'Pint', 'Crisps'] });
    const ann = session.engine.join({ name: 'Ann' });
    const bob = session.engine.join({ name: 'Bob' });
    session.advanceOrder();
    assert.equal(session.kind, 'updown');
    assert.equal(session.engine.state.phase, 'lobby', 'its waiting room is called lobby, like every game\'s');
    assert.deepEqual(session.engine.state.rewards, ['Fizz'], 'one drink a game, the venue\'s first');
    assert.equal(session.run('updownStart').ok, true);
    const g = session.engine;
    while (truth(g) === 'same') { session.run('updownTurn'); session.run('updownNext'); }
    const right = truth(g) === 'higher' ? 'up' : 'down';
    assert.equal(session.runPlayerAction('updown', { playerId: ann.id, token: ann.token, choice: right }).ok, true);
    assert.equal(session.runPlayerAction('updown', { playerId: bob.id, token: 'not-bobs', choice: right }).reason, 'not_yours',
      'a vote proves its phone (rule 3)');
    session.runPlayerAction('updown', { playerId: bob.id, token: bob.token, choice: right === 'up' ? 'down' : 'up' });
    session.run('updownTurn');
    assert.equal(g.state.phase, 'done');
    session.advanceOrder();
    assert.equal(session.kind, 'quiz');
    assert.equal(session.engine.state.venue, 'The Crown');
    const carried = Object.values(session.engine.state.vouchers).find((v) => v.updown);
    assert.equal(carried && carried.reward, 'Fizz', 'Ann\'s drink comes through');
    const phone = session.playerView(ann.id);
    const shown = (phone.vouchers || []).find((v) => v.updown);
    assert.ok(shown && shown.place === null, 'and her phone never says she won the QUIZ with it');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
