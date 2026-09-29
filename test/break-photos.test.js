/**
 * THE CAMERA IS IN EVERY BREAK — the dial chooses whether the lobby game
 * comes WITH it, and nothing else.
 *
 * The host, 29 September 2026: *"between rounds people were uploading photos
 * — I want between rounds the photo upload to continue, as that's a key part
 * of the marketing process going forward."* It was the default already, but
 * two of the dial's four states took it away — 🕹️ (the game only) and 📵
 * (nothing) — so one stray press on a gap dial silently stopped the photos a
 * night's marketing is built from. Those two states are gone; a plan or a
 * saved show that still says them reads as the nearest state that keeps the
 * camera: 'game' as photos AND the game, 'nothing' as photos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PHONE, DEFAULTS, breakFor, cleanPlan, offersGame, offersPhotos } from '../public/assets/break-parts.js';
import { Engine, PHASES } from '../src/engine.js';

test('every break offers the camera, whatever its plan says', () => {
  for (const phone of [...Object.values(PHONE), 'game', 'nothing', 'rubbish', undefined]) {
    assert.equal(offersPhotos(breakFor({ 'p0:r0': { phone } }, 'p0:r0')), true, `a round board set to ${phone}`);
    assert.equal(offersPhotos(breakFor({ 'p0:lobby': { phone } }, 'p0:lobby')), true, `a lobby set to ${phone}`);
  }
});

test('the dial has two answers: photos, or photos and the game', () => {
  assert.deepEqual(Object.values(PHONE).sort(), ['both', 'photos']);
  assert.equal(DEFAULTS.round.phone, 'photos');
  assert.equal(DEFAULTS.lobby.phone, 'both');
});

test('an old plan saying "game only" keeps its game AND gets the camera; "nothing" gets the camera', () => {
  assert.equal(breakFor({ 'p0:r1': { phone: 'game' } }, 'p0:r1').phone, 'both');
  assert.equal(offersGame(breakFor({ 'p0:r1': { phone: 'game' } }, 'p0:r1')), true);
  assert.equal(breakFor({ 'p0:r1': { phone: 'nothing' } }, 'p0:r1').phone, 'photos');
  assert.deepEqual(cleanPlan({ 'p0:r1': { phone: 'game', screen: 'scores' } }), { 'p0:r1': { phone: 'both', screen: 'scores' } });
  assert.deepEqual(cleanPlan({ 'p0:r1': { phone: 'nothing', screen: 'scores' } }), {}, 'photos is the round default, so it is not stored');
});

test('a running game with an old "nothing" break still hands the phones the camera', () => {
  const quiz = {
    id: 'gap', title: 'Gap', questionSeconds: 20,
    rounds: [
      { id: 'r1', type: 'text', title: 'One', questions: [{ id: 'q1', prompt: '?', options: ['a', 'b'], correctIndex: 0 }] },
      { id: 'r2', type: 'text', title: 'Two', questions: [{ id: 'q2', prompt: '?', options: ['a', 'b'], correctIndex: 0 }] },
    ],
  };
  const engine = new Engine({ quiz, now: () => 1_700_000_000_000 });
  engine.state.breakPlan = { 'p0:r0': { phone: 'nothing', screen: 'scores' } };
  const p = engine.join({ name: 'Rob' });
  engine.start();
  while (engine.state.phase !== PHASES.ROUND_BOARD) engine.next();
  assert.equal(engine.playerView(p.id).gap.photos, true);
});

test('the console dial offers only the two', async () => {
  const { PHONE_SAYS } = await import('../public/assets/console-breaks.js');
  assert.deepEqual(Object.keys(PHONE_SAYS).sort(), ['both', 'photos']);
});
