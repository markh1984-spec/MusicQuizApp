/**
 * THE MONDAY BUILD NAMES ITS GUARDS, AND EVERY NAME HAS TO EXIST.
 *
 * `scripts/gig-build.mjs` is the release train's one command. A guard renamed
 * or deleted would otherwise fail inside it as "no such file" — which the
 * runner reports as a failure, correctly, but on a Monday morning with a
 * deploy waiting rather than the day the rename happened.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GUARDS } from '../scripts/gig-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every guard the Monday build names is a script that exists', () => {
  const missing = GUARDS.filter((g) => !fs.existsSync(path.join(ROOT, 'scripts', `${g.name}.mjs`)));
  assert.deepEqual(missing.map((g) => g.name), [], 'named in gig-build.mjs but not in scripts/');
});

test('the core set covers the protected surface by name', () => {
  const core = new Set(GUARDS.filter((g) => g.core).map((g) => g.name));
  for (const must of ['gig-path', 'after-a-deploy', 'github-down', 'every-game', 'prizes-fuzz', 'drag-check', 'console-frame']) {
    assert.ok(core.has(must), `${must} is not in the Monday build's core set`);
  }
});

test('no guard is listed twice', () => {
  const names = GUARDS.map((g) => g.name);
  assert.equal(new Set(names).size, names.length);
});
