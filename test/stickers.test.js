/**
 * Props on a photo: dog ears, a clown nose, a party hat.
 *
 * The tests here are not about the drawings being good. They are about the two
 * ways this feature does damage in front of a room: a prop that lands somewhere
 * different on the projector than it did on the phone, and a shape that turns
 * up on somebody's handset as an emoji nobody chose.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { STICKERS, stickerSvg, placed, stickerAt } from '../public/assets/stickers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every prop offered can actually be drawn', () => {
  for (const s of STICKERS) {
    const svg = stickerSvg(s.id);
    assert.ok(svg.startsWith('<svg'), `${s.id} has no artwork`);
    assert.match(svg, /viewBox="0 0 100 100"/, `${s.id} is not on the 100x100 grid`);
    assert.ok(s.label && s.label.length <= 12, `${s.id} needs a short label`);
  }
});

test('a prop nobody has is nothing, not a broken tag', () => {
  assert.equal(stickerSvg('nonsense'), '');
});

test('the shapes are drawn, never emoji', () => {
  // Same rule as the bin icon and the seasonal looks. Some phones render a
  // clown as something upsetting and a skull as something cheerful.
  const source = fs.readFileSync(path.join(ROOT, 'public/assets/stickers.js'), 'utf8');
  const emoji = source.match(/\p{Extended_Pictographic}/gu);
  assert.equal(emoji, null, `stickers.js contains emoji: ${emoji && emoji.join(' ')}`);
});

test('a placed prop is stored as a FRACTION of the picture, never in pixels', () => {
  // This is the whole bug this guards against: the preview is a few hundred
  // pixels across on a phone and the picture sent up is 1280. Store the nose at
  // x=160 and it is on the phone's chin and the projector's ear.
  const item = placed('clown-nose', { x: 0.4, y: 0.3, size: 0.2 });
  for (const key of ['x', 'y', 'size']) {
    assert.ok(item[key] > 0 && item[key] <= 1, `${key} is not a fraction: ${item[key]}`);
  }
});

test('two of the same prop are told apart', () => {
  // Two dog ears is a legitimate thing to want, and dragging one must not drag
  // the other — so the key is per-placement, not per-prop.
  const a = placed('dog-ears');
  const b = placed('dog-ears');
  assert.notEqual(a.key, b.key);
  assert.equal(a.id, b.id);
});

test('a tap picks the prop you can see, not the one underneath', () => {
  const canvas = { width: 400, height: 400 };
  const under = placed('crown', { x: 0.5, y: 0.5, size: 0.3 });
  const over = placed('clown-nose', { x: 0.5, y: 0.5, size: 0.3 });
  assert.equal(stickerAt([under, over], 0.5, 0.5, canvas).key, over.key);
});

test('a tap on bare photo picks nothing', () => {
  const canvas = { width: 400, height: 400 };
  const item = placed('crown', { x: 0.2, y: 0.2, size: 0.1 });
  assert.equal(stickerAt([item], 0.9, 0.9, canvas), null);
});
