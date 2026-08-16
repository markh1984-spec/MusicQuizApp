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

for (const start of BUILDERS) {
  const name = start.replace('function ', '').replace('(', '');
  test(`${name}() builds balanced markup`, () => {
    const at = SRC.indexOf(start);
    assert.ok(at > 0, `${name}() has gone`);
    // The markup is everything up to the first DOM query — past that it is
    // wiring rather than template.
    const until = SRC.indexOf('querySelector', at);
    const chunk = SRC.slice(at, until > at ? until : at + 6000)
      // Comments carry example markup and prose arrows; they are not tags.
      .replace(/<!--[\s\S]*?-->/g, '');
    const opened = (chunk.match(/<div\b/g) || []).length;
    const closed = (chunk.match(/<\/div>/g) || []).length;
    assert.equal(closed, opened,
      `${name}() opens ${opened} <div> and closes ${closed}. An unbalanced tag does not fail `
      + 'node --check — it closes the section early, every later panel becomes a sibling, and '
      + 'the first querySelector for one of them returns null. The tab renders as "Could not load".');
  });
}
