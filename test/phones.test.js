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

test('A PROJECTOR FLAG IS NOT ON THE PHONES, so the prompt keeps describing the phase', () => {
  /*
   * REVERSES THIS TEST, which pinned the wrong half of a true sentence.
   *
   * It read "what is over the top wins, exactly as it does on the projector"
   * and required "The scores" while the scoreboard was up. Measured against a
   * real phone's payload: `playerView()` carries no `scoreboard`, no
   * `leaderboard`, no `advert` and no `photoSlide` — not one of the three ever
   * reaches a phone. They are big-screen features, which is what the control
   * view's own button says: "the scores on the big screen, on demand".
   *
   * So the host read "On their phones: The scores", said "have a look at your
   * phones for the standings", and sixty people were looking at the answer to
   * the last question — the exact fault `phonesAre()` exists to prevent,
   * written into the function and pinned here.
   *
   * The flag still wins on the PROJECTOR; nothing about `screenView()` moved.
   * `test/phones-are.test.js` walks every phase against every flag and reads
   * `playerView()` itself, so the day a flag does reach a phone this becomes
   * wrong out loud rather than quietly.
   */
  const plain = phonesAre({ phase: 'question' });
  assert.equal(phonesAre({ phase: 'question', scoreboard: { on: true } }), plain);
  assert.equal(phonesAre({ phase: 'question', advert: { showing: { packId: 'x' } } }), plain);
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
