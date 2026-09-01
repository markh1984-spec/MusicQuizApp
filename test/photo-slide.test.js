/**
 * TONIGHT'S PHOTOGRAPHS ON THE BIG SCREEN — the slide, and everything it is
 * refused at.
 *
 * Asked for on 1 September 2026: *"at the end of a quiz is it possible for the
 * quiz itself to show the link to the gallery for that evening?"* It is, and
 * the two things that decide the design are both tested here: the address
 * exists BEFORE the photographs are published, and the slide is a flag at the
 * FINAL rather than anything that could reach a question.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, PHASES } from '../src/engine.js';
import { galleryPath } from '../public/assets/slugs.js';

const START = 1_700_000_000_000;

function makeQuiz() {
  return {
    id: 'test', title: 'Test Quiz', questionSeconds: 20,
    rounds: [{
      id: 'r1', type: 'text', title: 'Round One',
      questions: [{ id: 'q1', prompt: 'A?', options: ['A', 'B'], correctIndex: 0 }],
    }],
  };
}

/** An engine sitting on the final scores, with a gallery address for tonight. */
function atFinal({ link = '/crown/gallery/20-august' } = {}) {
  const time = { now: START };
  const engine = new Engine({ quiz: makeQuiz(), now: () => time.now });
  engine.state.photoLink = link;
  engine.state.venue = 'The Crown';
  const p = engine.join({ name: 'Sofa King Good' });
  engine.finish();
  return { engine, player: p };
}

test('THE ADDRESS IS KNOWN BEFORE ANYTHING IS PUBLISHED', () => {
  // The whole mechanism: derived from the pub and the date, so the QR can go
  // up at eleven and the same link works once the night is published.
  assert.equal(
    galleryPath('2026-08-20', 'The Crown', { pretty: true }),
    // The leading "The" is dropped by `venueSlug`, deliberately.
    '/crown/gallery/20-august',
  );
  // Without the pretty form it still resolves — never an error, never empty.
  assert.equal(
    galleryPath('2026-08-20', 'The Crown', { pretty: false, room: 'r1' }),
    '/gallery?n=2026-08-20&q=r1',
  );
  // A night with no venue has no pretty form and must not invent one.
  assert.match(galleryPath('2026-08-20', '', { pretty: true }), /^\/gallery\?/);
});

test('THE SLIDE IS THE FINAL ONLY — it can never reach a question', () => {
  const e = new Engine({ quiz: makeQuiz(), now: () => START });
  e.state.photoLink = '/x/gallery/1-may';
  e.join({ name: 'Team' });
  assert.deepEqual(e.showPhotoSlide(true), { ok: false, reason: 'not_final' });
  e.start();
  e.askQuestion();
  assert.equal(e.state.phase, PHASES.QUESTION);
  assert.deepEqual(e.showPhotoSlide(true), { ok: false, reason: 'not_final' });
  assert.equal(e.state.photoSlide, false);
  // And nothing about a live question moved.
  assert.equal(e.screenView().phase, PHASES.QUESTION);
  assert.equal(e.screenView().photoSlide, undefined);
});

test('WITH NO ADDRESS IT IS REFUSED — a QR that goes nowhere is worse than none', () => {
  const { engine: e } = atFinal({ link: null });
  assert.deepEqual(e.showPhotoSlide(true), { ok: false, reason: 'no_gallery' });
  assert.equal(e.screenView().photoSlide, undefined);
});

test('UP, AND THE PROJECTOR CARRIES THE LINK AND THE PUB', () => {
  const { engine: e } = atFinal();
  assert.deepEqual(e.showPhotoSlide(true), { ok: true, photoSlide: true });
  const view = e.screenView();
  assert.deepEqual(view.photoSlide, {
    link: '/crown/gallery/20-august',
    venue: 'The Crown',
  });
  // The winner is still underneath it — this is a flag, not a phase.
  assert.equal(view.phase, PHASES.FINAL);
});

test('IT IS A FLAG: pressing again gives the room the winner back', () => {
  const { engine: e } = atFinal();
  e.showPhotoSlide(true);
  assert.deepEqual(e.showPhotoSlide(false), { ok: true, photoSlide: false });
  assert.equal(e.screenView().photoSlide, undefined);
  assert.equal(e.state.phase, PHASES.FINAL, 'the quiz has not moved');
});

test('TWO THINGS CANNOT BE ON ONE PROJECTOR', () => {
  const { engine: e } = atFinal();
  e.showScoreboard(true);
  assert.equal(e.state.scoreboard, true);
  e.showPhotoSlide(true);
  assert.equal(e.state.scoreboard, false, 'the scoreboard stood down');
  assert.equal(e.state.photoSlide, true);
});

test('A MOVE TAKES IT DOWN — the same rule the scoreboard follows', () => {
  const { engine: e } = atFinal();
  e.showPhotoSlide(true);
  e.back();
  assert.equal(e.state.photoSlide, false);
  assert.notEqual(e.state.phase, PHASES.FINAL);
  // And it cannot be left up over a question by going forward again.
  e.next();
  assert.equal(e.state.photoSlide, false);
});

test('THE PHONES ARE NEVER TOLD — the same rule as the comeback slide', () => {
  const { engine: e, player } = atFinal();
  e.showPhotoSlide(true);
  const p = e.playerView(player.id);
  assert.equal(p.photoSlide, undefined);
  assert.equal(p.photoLink, undefined);
  assert.equal(JSON.stringify(p).includes('gallery'), false);
});

test('THE HOST FIELD IS NOT `photos` — that name is already taken', () => {
  /*
   * `server.js` sets `view.photos` to the room's own photographs, on the host
   * AND the screen, AFTER the engine has built the view. The first version of
   * this feature used that name and was silently overwritten — the button it
   * fed never appeared and nothing threw.
   */
  const { engine: e } = atFinal();
  const host = e.hostView();
  assert.ok(host.photoSlide, 'the slide is on its own field');
  assert.equal(host.photos, undefined, 'and does not squat on the room photographs');
});

test('THE HOST SEES IT WHETHER IT IS UP OR NOT, so the button can exist', () => {
  const { engine: e } = atFinal();
  assert.deepEqual(e.hostView().photoSlide, { up: false, link: '/crown/gallery/20-august' });
  e.showPhotoSlide(true);
  assert.deepEqual(e.hostView().photoSlide, { up: true, link: '/crown/gallery/20-august' });
});

test('IT SURVIVES A RESTART, because it is in the state', () => {
  const { engine: e } = atFinal();
  e.showPhotoSlide(true);
  const saved = JSON.parse(JSON.stringify(e.state));
  const back = new Engine({ quiz: makeQuiz(), now: () => START });
  back.state = saved;
  assert.equal(back.screenView().photoSlide.link, '/crown/gallery/20-august');
});
