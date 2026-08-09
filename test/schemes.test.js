import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCHEMES, DEFAULT_SCHEME, findScheme } from '../public/assets/schemes.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(ROOT, 'public/assets/style.css'), 'utf8');

test('every scheme has an id, a label and a blurb', () => {
  for (const s of SCHEMES) {
    assert.ok(s.id, 'a scheme with no id');
    assert.ok(s.label, `${s.id} has no label`);
    assert.ok(s.blurb, `${s.id} has no blurb`);
  }
  assert.equal(new Set(SCHEMES.map((s) => s.id)).size, SCHEMES.length, 'two schemes share an id');
});

/*
 * The ordinary one is what `:root` already says, so it needs no block — which
 * is what makes an account with no scheme, and every page before the scheme has
 * arrived, look exactly as the app always did.
 */
test('the default scheme is the palette the app already had', () => {
  assert.equal(DEFAULT_SCHEME, 'sunset');
  assert.ok(!css.includes('[data-scheme="sunset"]'),
    'sunset has a block of its own — it should be whatever :root says');
});

// A scheme with no palette would silently be the ordinary one under a new name.
test('every other scheme has a palette in the stylesheet', () => {
  for (const s of SCHEMES.filter((x) => x.id !== DEFAULT_SCHEME)) {
    assert.ok(css.includes(`[data-scheme="${s.id}"]`), `${s.id} has no palette in style.css`);
    assert.ok(css.includes(`[data-swatch="${s.id}"]`), `${s.id} has no swatch on the picker`);
  }
});

/*
 * A SCHEME IS A BRAND; A LOOK IS A NIGHT.
 *
 * The option colours are how a player looks up, decides "the pink one, bottom
 * left", and looks back down. They belong to looks.js and to nothing else — a
 * scheme touching them would mean two features fighting over the one thing on
 * the screen that has to agree between the projector and the phone.
 */
test('a scheme never touches the option colours', () => {
  const blocks = css.match(/\[data-scheme="[^"]+"\][^}]*}/g) || [];
  assert.ok(blocks.length, 'no scheme blocks found at all');
  for (const block of blocks) {
    for (const v of ['--a', '--b', '--c', '--d', '--e', '--f']) {
      assert.ok(!new RegExp(`${v}\\s*:`).test(block),
        `a scheme sets ${v}, which belongs to the looks:\n${block.slice(0, 80)}`);
    }
  }
});

/*
 * Both are a single attribute selector, so they have the same specificity and
 * SOURCE ORDER is what decides. Halloween has to be orange and black on
 * everybody's account — a themed night is about the night, not about whose it
 * is. Put a scheme block below the looks and it would silently start winning.
 */
test('the schemes sit above the looks, or a themed night stops winning', () => {
  const firstScheme = css.indexOf('[data-scheme="');
  const firstLook = css.indexOf('[data-look="');
  assert.ok(firstScheme > -1 && firstLook > -1);
  assert.ok(firstScheme < firstLook,
    'a [data-scheme] block comes after a [data-look] block — the scheme would beat the look');
  const lastScheme = css.lastIndexOf('[data-scheme="');
  assert.ok(lastScheme < firstLook,
    'a [data-scheme] block is mixed in among the looks');
});

// Every scheme has to change something, or it is the same app with a new name
// on the button.
test('every scheme actually sets the two dominant colours', () => {
  for (const s of SCHEMES.filter((x) => x.id !== DEFAULT_SCHEME)) {
    const block = css.match(new RegExp(`\\[data-scheme="${s.id}"\\][^}]*}`))[0];
    assert.ok(/--hot\s*:/.test(block), `${s.id} does not set --hot`);
    assert.ok(/--hot-2\s*:/.test(block), `${s.id} does not set --hot-2`);
  }
});

// It comes off an account and out of a dropdown, so anything unexpected lands
// on the ordinary one rather than leaving a page with no colours at all.
test('an unknown scheme falls back rather than breaking a projector', () => {
  assert.equal(findScheme('nonsense'), DEFAULT_SCHEME);
  assert.equal(findScheme(''), DEFAULT_SCHEME);
  assert.equal(findScheme(undefined), DEFAULT_SCHEME);
  assert.equal(findScheme('orchid'), 'orchid');
});
