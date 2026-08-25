/**
 * A BROWSER MODULE IMPORTS THE HELPERS IT CALLS — and nothing else could see
 * that it had stopped.
 *
 * ---
 *
 * **This exists because a scripted edit ate an `import` line and every check
 * in the repo passed.** Rewriting the header comment of `console-breaks.js`
 * on 23 August 2026 replaced everything above the first `import` — and the
 * first import was `import { esc, node } from './client.js';`. The file still
 * parsed perfectly, `node --check` was happy, the full suite stayed green,
 * and the console drew a launch bar with **no gap dials on it at all**: four
 * `ReferenceError: node is not defined`, swallowed by the paint, nothing on
 * screen to say a control was missing.
 *
 * **That is the same fault that shipped a broken Launch to the live app**,
 * recorded in CLAUDE.md: a function called and never imported is a
 * ReferenceError at the moment the line RUNS, not a syntax error, so every
 * static check in this repo waves it through. The difference is only how loud
 * it was — Launch died in front of everyone, this one just quietly drew
 * fewer controls than it should have.
 *
 * ---
 *
 * **IT CHECKS A NAMED LIST RATHER THAN TRYING TO BE A LINTER.** A general
 * "every identifier resolves" pass over hand-written browser code needs a real
 * parser and a globals list, and would spend its life being argued with. What
 * actually goes missing is the shared helpers — the ones every module imports
 * from `client.js` and nothing declares for itself — so those are the ones
 * named here. A short list that never lies beats a clever one that needs an
 * exceptions file, which is the same conclusion `markup-balance.test.js`
 * reached about counting tags.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = new URL('../public/assets/', import.meta.url).pathname;

/**
 * The shared helpers. Each is exported by `client.js`, used across most of
 * the console, and declared by none of its callers — which is exactly what
 * makes a lost import invisible.
 */
const SHARED = ['node', 'esc', 'postJson', 'linkTo', 'goTo'];

/** Source with comments and their prose stripped — a comment naming `node()`
 *  is not a call, and this file's own notes are full of them. */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/** Every name this file pulls in, from any module. */
function imported(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  for (const m of src.matchAll(/import\s+(\w+)\s+from/g)) names.add(m[1]);
  return names;
}

/** Or declares for itself, which is a perfectly good answer too. */
function declared(src, name) {
  return new RegExp(`(?:function|const|let|var|class)\\s+${name}\\b`).test(src)
    || new RegExp(`\\b${name}\\s*=\\s*(?:function|\\()`).test(src);
}

const modules = () => fs.readdirSync(DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, src: fs.readFileSync(path.join(DIR, f), 'utf8') }));

test('EVERY SHARED HELPER A MODULE CALLS IS ONE IT IMPORTS', () => {
  const missing = [];
  for (const { name, src } of modules()) {
    const body = code(src);
    const has = imported(src);
    for (const helper of SHARED) {
      // A call, not a mention: `node(` and `esc(`, wherever they appear —
      // including inside the template literals this app builds its markup
      // from, which is where most of them genuinely are.
      if (!new RegExp(`(?<![\\w.$])${helper}\\s*\\(`).test(body)) continue;
      if (has.has(helper) || declared(body, helper)) continue;
      missing.push(`${name} calls ${helper}() and neither imports nor declares it`);
    }
  }
  assert.deepEqual(missing, [],
    `${missing.join('; ')}. A missing import is a ReferenceError when the line RUNS, `
    + 'so it parses fine, passes node --check and draws a page with a control silently '
    + 'absent from it — which is how a broken Launch once reached the live app.');
});

/**
 * AND A MOVED BODY MUST NOT CALL THE PAINT FUNCTION IT LEFT BEHIND.
 *
 * ---
 *
 * The same class of fault as above in a different disguise, found on
 * 24 August 2026 and reported as *"the change what appears on the phones at
 * the end of each segment click has died again"*.
 *
 * `setGaps()` was moved out of `console-tonight.js` into `console-breaks.js`
 * — a mechanical move, right about every line it carried — and its last line
 * said `paintOrder()`, which belongs to the launch bar and does not exist in
 * the module it landed in. The factory it moved into had been given a
 * `repaint` parameter for precisely that call, and the call was never
 * rewired.
 *
 * **Nothing threw at load.** The name is only read when somebody presses the
 * dial, the click handler's own catch swallowed the `ReferenceError`, and
 * every dial in the bar drew perfectly and did nothing. `node --check`,
 * `browser-parses`, the full suite, `pub-unchanged` and `drag-check` all
 * passed — not one of them presses a dial.
 *
 * ---
 *
 * **A GENERAL VERSION OF THIS WAS WRITTEN FIRST AND THROWN AWAY.** "Does any
 * module call a name another module declares without importing it" produced
 * sixty findings and one true one: it cannot see function parameters,
 * destructured options bags or callbacks, which is exactly how a leaf module
 * is supposed to receive these. Understanding those needs a real parser, and
 * a test needing an exceptions list has stopped being a test — which is the
 * conclusion the check above it and `markup-balance.test.js` both already
 * reached, and which I had to reach again.
 *
 * So this is the SHORT LIST THAT NEVER LIES: the console's paint functions
 * are owned by the launch bar and the shell, they are what a moved body
 * reaches for, and no other module has any business naming one.
 */
const PAINTERS = ['paintOrder', 'paintSettings', 'paintGaps', 'paintGo', 'paintLive', 'paintThen', 'paintInTonight', 'paintMixedOrder'];
const PAINTERS_LIVE_IN = new Set(['console-tonight.js', 'console.js']);

test('ONLY THE BAR ITSELF CALLS THE BAR\'S PAINT FUNCTIONS', () => {
  const strays = [];
  for (const { name, src } of modules()) {
    if (PAINTERS_LIVE_IN.has(name)) continue;
    const body = code(src);
    for (const painter of PAINTERS) {
      if (!new RegExp(`(?<![\\w.$])${painter}\\s*\\(`).test(body)) continue;
      strays.push(`${name} calls ${painter}() — that belongs to the launch bar`);
    }
  }
  assert.deepEqual(strays, [],
    `${strays.join('; ')}. A body moved between modules keeps the names of the one it `
    + 'left: the file still parses, the page still draws, and the control does nothing '
    + 'the first time somebody presses it. Take a `repaint` callback instead.');
});
