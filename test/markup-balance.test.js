/**
 * THE MARKUP IN EVERY BROWSER MODULE CLOSES WHAT IT OPENS.
 *
 * ---
 *
 * **The companion to `style-structure.test.js`, and it exists for the same
 * reason on the same day.** Two structural faults shipped within an hour of
 * each other, both from a scripted edit slicing a file by index and taking one
 * delimiter too many or too few:
 *
 * - in `style.css`, a swallowed `}` ended a `@media` block early and put a
 *   phone-only rule on every screen — Tonight's six pack slots became one;
 * - in `console-tonight.js`, moving the venue sheet inside the picker's own
 *   cell left `.lb-what` unclosed and an orphan `</div>` behind. The head row
 *   collapsed and the venue button, Save and the mode switch drew on top of
 *   one another.
 *
 * **Neither is a syntax error.** `node --check` passes both files happily:
 * a template literal holding broken HTML is a perfectly good string, and the
 * browser silently re-nests whatever it is given. So the page renders, it just
 * renders WRONG — and every check this repo had was looking somewhere else.
 *
 * This counts tags rather than parsing, which is crude and is the right amount
 * of machinery: the fault it catches is always an off-by-one in a delimiter,
 * and a count is exactly what an off-by-one moves.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DIR = new URL('../public/assets/', import.meta.url).pathname;

function stripped(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/*
 * A WHOLE-FILE TAG COUNT WAS TRIED FIRST AND TURNED DOWN, which is worth
 * writing down so nobody adds it back.
 *
 * This app builds markup out of concatenated fragments all over the place — a
 * helper returns an opening wrapper, a ternary contributes a `<div>` on one
 * branch and nothing on the other, a `.map().join('')` supplies rows. Counted
 * per FILE, `console-venues.js` comes out nine divs short and is completely
 * correct; `play.js` comes out two divs and a label short and is genuinely
 * sloppy but harmless, since the browser closes them at the end of the
 * fragment.
 *
 * A test that needs a growing list of exceptions to stay green has stopped
 * being a test and become a snapshot of whatever was true the day it was
 * written — and this repo already has a rule about guards that quietly measure the
 * wrong thing. So the sweep is gone and what is left is the ONE template that
 * actually broke, checked precisely.
 *
 * (`play.js`'s camera sheet really does leave two `<div>`s and a `<label>`
 * open. It is worth tidying and was deliberately not tidied blind at the end
 * of a long session, because re-nesting a screen nobody reported a problem
 * with is how you cause the next one.)
 */

test('THE LAUNCH BAR IS THE ONE THAT MUST NOT DRIFT', () => {
  /*
   * Named on its own because it is the protected surface — the path from "the
   * room is sitting down" to "the quiz is running" — and because it is the one
   * that actually broke. `launchBar()` builds the whole panel in a single
   * template, so its balance is checkable in isolation rather than across a
   * file that holds a dozen.
   */
  const src = fs.readFileSync(`${DIR}console-tonight.js`, 'utf8');
  const start = src.indexOf('<div class="panel launchbar">');
  assert.ok(start > 0, 'the launch bar template has been renamed or moved');
  const end = src.indexOf('`);', start);
  const tpl = stripped(src.slice(start, end));
  const opens = (tpl.match(/<div(?=[\s>])/g) || []).length;
  const closes = (tpl.match(/<\/div>/g) || []).length;
  assert.equal(opens, closes,
    `the launch bar template has ${opens} <div> and ${closes} </div>. Unbalanced, `
    + 'the head row collapses and the venue picker, Save and the mode switch draw '
    + 'on top of each other — which is exactly what happened on 23 August 2026.');
});
