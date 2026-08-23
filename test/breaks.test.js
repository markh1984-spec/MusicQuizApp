/**
 * WHAT HAPPENS IN THE GAPS — `public/assets/break-parts.js` and the three
 * guards that used to say "the lobby" and now say "a break that offers a
 * game".
 *
 * **The guards are the reason this file exists.** The lobby game was kept out
 * of a live quiz by three separate mechanisms — the seed in the phone's
 * payload, the refusal at the score route, and the board on the projector —
 * and two of the three had to change subject at once. If one had been missed
 * it would have become the real rule by accident, and the symptom is a phone
 * quietly playing a game through a question.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PHONE, SCREEN, DEFAULTS, breakIdNow, breakNow, breakFor, breakSlots, cleanPlan,
  offersGame, offersPhotos, showsScores, showsAdverts,
} from '../public/assets/break-parts.js';
import { Engine } from '../src/engine.js';

/** A real engine driven by hand — never a state object built by this file. */
function engineOn(extra = {}) {
  const quiz = {
    id: 'test',
    title: 'Test Quiz',
    questionSeconds: 20,
    rounds: [
      {
        id: 'r1',
        type: 'text',
        title: 'Round One',
        questions: [
          { id: 'q1', prompt: 'First?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
        ],
      },
      {
        id: 'r2',
        type: 'text',
        title: 'Round Two',
        questions: [
          { id: 'q2', prompt: 'Second?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
        ],
      },
    ],
  };
  const engine = new Engine({ quiz, now: () => 1_700_000_000_000 });
  Object.assign(engine.state, extra);
  return engine;
}

// ---------------------------------------------------------------- the model

test('a default plan is exactly what the app did before breaks existed', () => {
  // If this ever changes, every night launched without touching the strip
  // changes with it — which is what the payload guard is there to catch.
  assert.deepEqual(DEFAULTS.lobby, { phone: PHONE.BOTH, screen: SCREEN.SCORES });
  assert.deepEqual(DEFAULTS.round, { phone: PHONE.PHOTOS, screen: SCREEN.SCORES });
  assert.equal(offersGame(DEFAULTS.lobby), true, 'the lobby offered a game');
  assert.equal(offersGame(DEFAULTS.round), false, 'a round board did not');
  assert.equal(offersPhotos(DEFAULTS.round), true, 'a round board offered the camera');
  assert.equal(showsScores(DEFAULTS.round), true, 'and put the scores up');
  assert.equal(showsAdverts(DEFAULTS.round), false, 'and no slides, ever, unasked');
});

test('a break is named by WHERE it is, so nothing has to be kept in step', () => {
  assert.equal(breakIdNow({ phase: 'lobby' }), 'p0:lobby');
  assert.equal(breakIdNow({ phase: 'lobby', orderPos: 2 }), 'p2:lobby');
  assert.equal(breakIdNow({ phase: 'round_board', roundIndex: 3 }), 'p0:r3');
  assert.equal(breakIdNow({ phase: 'round_board', orderPos: 1, roundIndex: 0 }), 'p1:r0');
});

test('A QUESTION IS NOT A BREAK, and neither is the final', () => {
  // The half of the old rule that was never negotiable.
  for (const phase of ['question', 'reveal', 'round_intro', 'rules', 'final']) {
    assert.equal(breakIdNow({ phase }), '', `${phase} must not be a break`);
    assert.equal(breakNow({ phase }), null);
    assert.equal(offersGame(breakNow({ phase })), false);
  }
});

test('breakFor is total — rubbish, gaps and missing plans all resolve', () => {
  assert.deepEqual(breakFor(null, 'p0:r1'), { ...DEFAULTS.round, id: 'p0:r1' });
  assert.deepEqual(breakFor({}, 'p0:lobby'), { ...DEFAULTS.lobby, id: 'p0:lobby' });
  // A half-set entry keeps the default for the half it does not name.
  assert.deepEqual(breakFor({ 'p0:r1': { phone: PHONE.NOTHING } }, 'p0:r1'),
    { id: 'p0:r1', phone: PHONE.NOTHING, screen: DEFAULTS.round.screen });
  // And a value that is not one of ours is not honoured.
  assert.equal(breakFor({ 'p0:r1': { screen: 'sudo' } }, 'p0:r1').screen, DEFAULTS.round.screen);
});

test('cleanPlan drops rubbish ids AND anything that only restates a default', () => {
  /*
   * The second half is what keeps a night nobody configured genuinely empty,
   * which is what lets `pub-unchanged.mjs` still prove a pub night is what it
   * was. An entry saying "the default, again" would be a byte in every save
   * for the rest of the night that changes nothing.
   */
  const plan = cleanPlan({
    'p0:lobby': { phone: PHONE.BOTH, screen: SCREEN.SCORES },
    'p0:r1': { phone: PHONE.GAME, screen: SCREEN.ADVERTS },
    'drop table': { phone: PHONE.GAME },
    'p99999:r0': { phone: PHONE.GAME },
  });
  assert.deepEqual(plan, { 'p0:r1': { phone: PHONE.GAME, screen: SCREEN.ADVERTS } });
  assert.deepEqual(cleanPlan(null), {});
  assert.deepEqual(cleanPlan('nope'), {});
});

test('the breaks of a night are DERIVED, and the last board is the final', () => {
  const parts = [{ kind: 'quiz' }, { kind: 'bingo' }, { kind: 'quiz' }];
  const ids = breakSlots(parts, (p) => (p.kind === 'quiz' ? 3 : 0)).map((b) => b.id);
  assert.deepEqual(ids, [
    'p0:lobby', 'p0:r0', 'p0:r1', 'p0:r2',
    // A bingo part has no rounds, so its only gap is its own lobby.
    'p1:lobby',
    // The last part loses its last board: that one is the final.
    'p2:lobby', 'p2:r0', 'p2:r1',
  ]);
});

test('switching a round off removes the break after it', () => {
  // The reason the strip is arithmetic rather than a stored list of five.
  const four = breakSlots([{ kind: 'quiz' }], () => 4).map((b) => b.id);
  const three = breakSlots([{ kind: 'quiz' }], () => 3).map((b) => b.id);
  assert.deepEqual(four, ['p0:lobby', 'p0:r0', 'p0:r1', 'p0:r2']);
  assert.deepEqual(three, ['p0:lobby', 'p0:r0', 'p0:r1']);
});

// ------------------------------------------------------- the engine's guards

test('THE PAYLOAD GUARD: a seed reaches a phone only at a break that offers a game', () => {
  const engine = engineOn();
  const player = engine.join({ name: 'Team A' });

  // The lobby, unconfigured — a seed, exactly as before.
  assert.ok(engine.playerView(player.id).gameSeed, 'the lobby still hands out a seed');

  // A round board, unconfigured — no seed, exactly as before.
  engine.state.phase = 'round_board';
  assert.equal(engine.playerView(player.id).gameSeed, undefined,
    'a round board does not, unless it was asked to');

  // A round board that WAS asked to.
  engine.state.breakPlan = { 'p0:r0': { phone: PHONE.GAME, screen: SCREEN.SCORES } };
  assert.ok(engine.playerView(player.id).gameSeed, 'and does when the break says so');

  // A question, whatever the plan says. This is the one that matters.
  engine.state.phase = 'question';
  assert.equal(engine.playerView(player.id).gameSeed, undefined,
    'A QUESTION NEVER HANDS OUT A SEED, whatever is in the plan');
});

test('THE SCORE GUARD: a score is refused anywhere that is not a break offering a game', () => {
  const engine = engineOn();
  const player = engine.join({ name: 'Team A' });

  assert.equal(engine.arcadeScore(player.id, 40).ok, true, 'the lobby takes one');

  engine.state.phase = 'round_board';
  assert.equal(engine.arcadeScore(player.id, 90).ok, false, 'a plain round board does not');

  engine.state.breakPlan = { 'p0:r0': { phone: PHONE.BOTH, screen: SCREEN.SCORES } };
  assert.equal(engine.arcadeScore(player.id, 90).ok, true, 'one that offers a game does');

  engine.state.phase = 'question';
  const refused = engine.arcadeScore(player.id, 5000);
  assert.equal(refused.ok, false, 'A QUESTION REFUSES A SCORE, whatever is in the plan');
  assert.equal(refused.reason, 'not_waiting');
});

test('THE BOARD GUARD DID NOT MOVE — the arcade board stays at the lobby', () => {
  /*
   * Deliberately NOT generalised with the other two. It is drawn inside the
   * white QR panel under the join code, and that panel only exists at the
   * lobby; a round board already carries the board the room looked up for,
   * and two leaderboards on one projector is what this app refuses everywhere.
   */
  const engine = engineOn();
  const player = engine.join({ name: 'Team A' });
  engine.arcadeScore(player.id, 40);
  assert.ok((engine.screenView().arcade || []).length, 'the lobby draws it');

  engine.state.phase = 'round_board';
  engine.state.breakPlan = { 'p0:r0': { phone: PHONE.GAME, screen: SCREEN.SCORES } };
  assert.equal(engine.screenView().arcade, undefined,
    'a break with a game on it still does not put the arcade board on the projector');
});

// ------------------------------------------------------------ the projector

test('the scores are the break\'s decision at a ROUND BOARD and nowhere else', () => {
  const engine = engineOn();
  engine.join({ name: 'Team A' });
  engine.state.phase = 'round_board';
  assert.ok(Array.isArray(engine.screenView().leaderboard), 'unconfigured, they show');

  engine.state.breakPlan = { 'p0:r0': { phone: PHONE.PHOTOS, screen: SCREEN.NOTHING } };
  assert.equal(engine.screenView().leaderboard, undefined, 'and a quiet break hides them');

  /*
   * THE FINAL IS NOT A BREAK. A plan that could hide the winner would be able
   * to take away the moment the whole night is built towards, and no setting
   * is worth that.
   */
  engine.state.phase = 'final';
  engine.state.breakPlan = { 'p0:r0': { phone: PHONE.NOTHING, screen: SCREEN.NOTHING } };
  assert.ok(Array.isArray(engine.screenView().leaderboard), 'the final always shows them');
});

test('a venue\'s slides reach the projector only at a break that asked', () => {
  const engine = engineOn();
  engine.state.venue = 'The Crown';
  engine.advertsForVenue = (venue) => (venue === 'The Crown'
    ? [{ heading: 'Pizza', body: 'Two for one' }] : []);
  engine.join({ name: 'Team A' });

  engine.state.phase = 'round_board';
  assert.equal(engine.screenView().breakAdverts, undefined, 'not unasked');

  engine.state.breakPlan = { 'p0:r0': { phone: PHONE.PHOTOS, screen: SCREEN.SCORES_THEN_ADVERTS } };
  const view = engine.screenView();
  assert.equal(view.breakAdverts.length, 1, 'and does when the break asked');
  assert.ok(Array.isArray(view.leaderboard), 'with the scores still there — they go first');

  // A question can never carry one, which is the same rule `showAdvert()` has
  // always had about a live question.
  engine.state.phase = 'question';
  assert.equal(engine.screenView().breakAdverts, undefined);
});

test('the answer key is still never on the projector at a break', () => {
  // Rule 1, re-checked because this change added a new field to `screenView()`
  // and the whole point of a whitelist is that it is checked rather than
  // trusted to have stayed one.
  const engine = engineOn();
  engine.join({ name: 'Team A' });
  engine.state.phase = 'round_board';
  engine.state.breakPlan = { 'p0:r0': { phone: PHONE.BOTH, screen: SCREEN.SCORES_THEN_ADVERTS } };
  const text = JSON.stringify(engine.screenView());
  assert.ok(!text.includes('correctIndex'), 'no answer key');
  assert.ok(!text.includes('hostNotes'), 'no host notes');
});
