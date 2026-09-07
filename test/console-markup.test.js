/**
 * THE CONSOLE'S BIG TEMPLATES HAVE BALANCED TAGS.
 *
 * Written on 15 August 2026, minutes after an unbalanced `</div>` took the
 * whole console down — for the second time in one day, by a different
 * mechanism from the stray backtick that `browser-parses.test.js` now catches.
 *
 * **A stray closing tag does not fail `node --check`.** The file parses
 * perfectly: it is a valid template literal containing invalid markup. The
 * browser's HTML parser then closes `.game-section` early, every panel after
 * that point becomes a sibling rather than a child, and the first
 * `el.querySelector('.ask-slot')` returns null. `appendChild` on null throws
 * and the entire tab body renders as "Could not load" — on the page a night is
 * launched from, for every tab that calls the function.
 *
 * So the class of fault is: **valid JavaScript, broken HTML, dead page.**
 * Nothing that reads the file as source can see it, and nothing that runs the
 * unit tests touches it either.
 *
 * This is deliberately crude — it counts `<div>` against `</div>` inside the
 * markup templates of the functions that build a whole panel. It cannot tell
 * you the nesting is *sensible*; it tells you the tags are paired, which is
 * the specific thing that was wrong and the specific thing that kills a page.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { consoleSource } from './console-source.js';

// Every console module: these builders live in three different files now.
const SRC = consoleSource();

/**
 * The panel builders worth checking: each returns a whole section of the
 * console, and each is big enough that a hand-edit can unbalance it.
 */
const BUILDERS = ['function gameSection(', 'function launchBar(', 'function packCard('];

/**
 * THE WHOLE FUNCTION, by matching its braces — not "up to the first DOM
 * query".
 *
 * That was the window this test used, and it stopped at the first
 * `querySelector` after the function's name. `gameSection()` is 14,485
 * characters and the first query lands at 4,974, so **~9,500 characters of the
 * pack shelf were never counted** — and `launchBar()` was checked for 21,151
 * of its 155,851. An unbalanced `<div>` past that point passes all three
 * markup guards and does exactly what this file's own header describes: the
 * section closes early, every later panel becomes a sibling, and the first
 * query for one of them returns null.
 *
 * A window drawn at "where the template probably ends" is a window that moves
 * every time somebody queries the DOM a little earlier.
 *
 * **If a legitimate fragment ever fails this — a helper inside one of these
 * three returning an unclosed wrapper — extract it into its own function
 * rather than adding an exception.** A test that needs a growing list of
 * exceptions has stopped being a test, which is the reason the whole-FILE
 * version of this check was turned down.
 */
function functionBody(src, start) {
  const at = src.indexOf(start);
  if (at < 0) return null;
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (!depth) return src.slice(at, i);
    }
  }
  return src.slice(at);
}

for (const start of BUILDERS) {
  const name = start.replace('function ', '').replace('(', '');
  test(`${name}() builds balanced markup`, () => {
    const body = functionBody(SRC, start);
    assert.ok(body, `${name}() has gone`);
    const chunk = body
      // Comments carry example markup and prose arrows; they are not tags —
      // both kinds, since a JS comment inside the wiring can name one too.
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    const opened = (chunk.match(/<div\b/g) || []).length;
    const closed = (chunk.match(/<\/div>/g) || []).length;
    assert.equal(closed, opened,
      `${name}() opens ${opened} <div> and closes ${closed}. An unbalanced tag does not fail `
      + 'node --check — it closes the section early, every later panel becomes a sibling, and '
      + 'the first querySelector for one of them returns null. The tab renders as "Could not load".');
  });
}
