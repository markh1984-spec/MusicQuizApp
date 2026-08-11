/**
 * A face for everybody.
 *
 * The big screen shows the fastest finger's face on the reveal. Most of the
 * room never opens the camera, so the thing that has to be true is that there
 * is ALWAYS a face — and that it is the same face for the same team all night.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { avatarSvg, avatarUrl, faceFor } from '../public/assets/avatar.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('everybody gets a face, whatever they called themselves', () => {
  for (const name of ['Sofa King Good', 'Quiz Akabusi', 'a', '', 'Les Quizérables']) {
    const svg = avatarSvg(name);
    assert.ok(svg.startsWith('<svg'), `no face for "${name}"`);
    assert.match(svg, /viewBox="0 0 100 100"/);
  }
});

test('the same team is the same face every time', () => {
  // Not decoration: a face that changed between the reveal and the restart
  // would make the room think it meant something.
  assert.equal(avatarSvg('Sofa King Good'), avatarSvg('Sofa King Good'));
  assert.equal(avatarUrl('Quiz Akabusi'), avatarUrl('Quiz Akabusi'));
});

test('different teams get different faces', () => {
  const names = [
    'Sofa King Good', 'Quiz Akabusi', 'Les Quizerables', 'Menage a Trivia',
    'The Quizzly Bears', 'Norfolk and Chance', 'Agatha Quiztie', 'E=MC Hammer',
  ];
  const faces = new Set(names.map((n) => avatarSvg(n)));
  assert.equal(faces.size, names.length, 'two teams drew the same face');
});

test('a team name cannot inject markup into the projector', () => {
  // Rude names go up as typed — that is settled — but a name is not allowed to
  // be a tag. This one ends up in an aria-label on a six-foot screen.
  const svg = avatarSvg('<script>alert(1)</script>');
  assert.doesNotMatch(svg, /<script/);
  assert.match(svg, /&lt;script&gt;/);
});

test('the faces are drawn, never emoji', () => {
  // Same rule as the bin icon, the seasonal shapes and the photo props.
  const source = fs.readFileSync(path.join(ROOT, 'public/assets/avatar.js'), 'utf8');
  const emoji = source.match(/\p{Extended_Pictographic}/gu);
  assert.equal(emoji, null, `avatar.js contains emoji: ${emoji && emoji.join(' ')}`);
});

/*
 * Which face goes beside the fastest finger.
 *
 * The failure that matters is putting the WRONG person's photograph six feet
 * wide in front of a room, so matching is on identity and never on the name.
 *
 * The handle is `faceKey`, NOT the player id, and that is a security fix
 * rather than a rename: a player id is a bearer credential, and this payload
 * goes to anybody holding the join code — which is printed on the projector.
 */
const drawn = (url) => url.startsWith('data:');

test('somebody who sent a photo gets their own face', () => {
  const photos = [{ faceKey: 'k1', url: '/photos/a.jpg', at: 10 }];
  assert.equal(faceFor(photos, { faceKey: 'k1', name: 'Sofa King Good' }), '/photos/a.jpg');
});

test('the most recent one, because people send several', () => {
  const photos = [
    { faceKey: 'k1', url: '/photos/early.jpg', at: 10 },
    { faceKey: 'k1', url: '/photos/late.jpg', at: 99 },
    { faceKey: 'k1', url: '/photos/middle.jpg', at: 50 },
  ];
  assert.equal(faceFor(photos, { faceKey: 'k1', name: 'Sofa King Good' }), '/photos/late.jpg');
});

test('TWO TEAMS, ONE NAME: never matched on the name', () => {
  // Two teams picking the same name happens on a real night, and the app does
  // not filter names. Matching on it would put a stranger's photograph on the
  // projector under somebody else's name.
  const photos = [{ faceKey: 'k1', teamName: 'Sofa King Good', url: '/photos/them.jpg', at: 10 }];
  const face = faceFor(photos, { faceKey: 'k2', name: 'Sofa King Good' });
  assert.notEqual(face, '/photos/them.jpg');
  assert.ok(drawn(face), 'it should have fallen back to a drawn face');
});

test('somebody who never opened the camera still gets a face', () => {
  assert.ok(drawn(faceFor([], { faceKey: 'k1', name: 'Quiz Akabusi' })));
  assert.ok(drawn(faceFor(null, { faceKey: 'k1', name: 'Quiz Akabusi' })));
  assert.ok(drawn(faceFor(undefined, {})));
});

test('a photo with no id attached matches nobody', () => {
  const photos = [{ url: '/photos/orphan.jpg', at: 10 }];
  assert.ok(drawn(faceFor(photos, { faceKey: 'k1', name: 'Quiz Akabusi' })));
  // …and an empty player id does not match an empty photo id either.
  assert.ok(drawn(faceFor(photos, { playerId: '', name: 'Quiz Akabusi' })));
});

test('it is a data URL, so nothing is fetched and nothing can fail to load', () => {
  const url = avatarUrl('Sofa King Good');
  assert.ok(url.startsWith('data:image/svg+xml;'));
  assert.ok(!url.includes('\n'), 'a raw newline breaks the attribute');
});
