/**
 * WHAT THE ROOM IS LOOKING AT — the host's own line.
 *
 * The fault worth guarding against is not a wrong word, it is a BLANK: a new
 * phase gets added, nobody thinks about this line, and the host's screen goes
 * quiet at exactly the moment they were about to say something out loud. So
 * the test walks every phase the two engines actually declare rather than a
 * list somebody typed here — a list would rot the same way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PHASES } from '../src/engine.js';
import { BINGO_PHASES } from '../src/bingo.js';
import { phonesAre } from '../public/assets/phones.js';

test('EVERY QUIZ PHASE SAYS SOMETHING', () => {
  for (const phase of Object.values(PHASES)) {
    const said = phonesAre({ phase });
    assert.ok(said, `the host is told nothing while the phase is "${phase}"`);
    assert.ok(said.length < 40, `"${said}" is too long for a corner of the bar`);
  }
});

test('EVERY BINGO PHASE SAYS SOMETHING', () => {
  for (const phase of Object.values(BINGO_PHASES)) {
    const said = phonesAre({ game: 'bingo', phase });
    assert.ok(said, `the host is told nothing while bingo is "${phase}"`);
    assert.ok(said.length < 40, `"${said}" is too long`);
  }
});

test('a quiz phase and the same-named bingo phase do not say the same thing', () => {
  // They are genuinely different rooms: one is holding a card all night, the
  // other is answering four options. A line that said "Waiting" for both would
  // be true and useless.
  assert.notEqual(phonesAre({ phase: 'lobby' }), phonesAre({ game: 'bingo', phase: 'lobby' }));
});

test('WHAT IS OVER THE TOP WINS, exactly as it does on the projector', () => {
  /*
   * The scoreboard and an advert are flags rather than phases, so the quiz
   * underneath carries on — but it is not what anybody is holding. A host told
   * "Answering" while the scores are up would chase a room that is not there.
   */
  assert.equal(phonesAre({ phase: 'question', scoreboard: { on: true } }), 'The scores');
  assert.equal(phonesAre({ phase: 'question', advert: { showing: { packId: 'x' } } }), 'The advert');
});

test('the lobby says there is a game, because that is the thing worth saying', () => {
  // The one phase where the game is the PRIMARY thing on a phone — the same
  // split already recorded: the game before the quiz, photos between rounds.
  assert.match(phonesAre({ phase: 'lobby' }), /game/i);
  assert.match(phonesAre({ game: 'bingo', phase: 'lobby' }), /game/i);
});

test('the phases that carry the photo card say so, and the others do not', () => {
  /*
   * This is the half a host says out loud — "get your photos in now" — so it
   * has to match what the phone is really offering. A question is the one
   * moment the app deliberately keeps the room looking UP.
   */
  for (const phase of ['round_intro', 'round_board', 'final']) {
    assert.match(phonesAre({ phase }), /photos/i, `${phase} did not mention photos`);
  }
  assert.doesNotMatch(phonesAre({ phase: 'question' }), /photos/i,
    'the host was told to ask for photos during a question');
  assert.doesNotMatch(phonesAre({ phase: 'reveal' }), /photos/i);
});

test('it says nothing rather than guessing when there is no state', () => {
  assert.equal(phonesAre(null), '');
  assert.equal(phonesAre(undefined), '');
});

test('an unknown phase still answers', () => {
  // A night restored from a newer deploy, or a phase added and forgotten.
  assert.ok(phonesAre({ phase: 'something_new' }));
});
