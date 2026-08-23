/**
 * THE STYLESHEET'S BRACES BALANCE — and nothing else in this repo was checking.
 *
 * ---
 *
 * **This exists because a single stray `}` reached a real console and broke a
 * control on it**, on 23 August 2026. A scripted edit to `style.css` used
 * `s.index('.lb-tile {')` with no start offset, so it matched an EARLIER
 * occurrence than the one intended; `s[:start] + new + s[end:]` with `end`
 * before `start` then DUPLICATED everything in between. The duplicate carried
 * the tail of a `@media (max-width: 560px)` block, including its closing
 * brace — so the media query ended early and the rule inside it,
 * `.lb-tiles .lb-tile.lb-drop ~ .lb-tile.lb-drop { display: none }`, applied
 * at EVERY width.
 *
 * What that looked like on a laptop: Tonight's six pack slots became one. The
 * markup was right, the JavaScript was right, six `<button>`s were in the DOM,
 * and five of them were invisible.
 *
 * ---
 *
 * **THE REASON IT SURVIVED VERIFICATION IS WORTH MORE THAN THE BUG.** It was
 * checked in a real browser, twice, and the check counted `.lb-tile` ELEMENTS
 * — which `display: none` elements still are. The count came back six every
 * time while the screen showed one. That is this repo's oldest lesson wearing
 * another hat: **a test that measures something adjacent to the thing that
 * matters proves nothing about the thing that matters.** `getClientRects()`
 * is the difference between "it is in the document" and "somebody can see it".
 *
 * `browser-parses.test.js` catches a JavaScript file that will not parse.
 * Nothing caught a stylesheet that parses fine and means something else — CSS
 * has no syntax error to throw here, it just re-scopes silently from the stray
 * brace onwards, and every rule after it is quietly in the wrong place.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CSS_DIR = new URL('../public/assets/', import.meta.url).pathname;

const sheets = () => fs.readdirSync(CSS_DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ name: f, src: fs.readFileSync(path.join(CSS_DIR, f), 'utf8') }));

/**
 * Braces outside comments and strings.
 *
 * Comments are stripped because this file's own prose is full of them — the
 * note above contains `{ display: none }` — and a counter that read those
 * would fail on documentation rather than on code.
 */
function braces(src) {
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  const out = [];
  let depth = 0;
  const lines = clean.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth < 0) out.push({ line: i + 1, text: lines[i].trim() });
      }
    }
  }
  return { depth, negatives: out };
}

test('every stylesheet closes exactly what it opens', () => {
  for (const { name, src } of sheets()) {
    const { depth, negatives } = braces(src);
    assert.deepEqual(negatives, [],
      `${name} has a closing brace with nothing open at line ${negatives[0]?.line}: `
      + `"${negatives[0]?.text}". Everything after it is scoped one level too high — `
      + 'a media query ends early and its rules start applying at every width. '
      + 'CSS throws nothing for this; it just silently means something else.');
    assert.equal(depth, 0,
      `${name} ends with ${depth} unclosed block${Math.abs(depth) === 1 ? '' : 's'}. `
      + 'A missing brace swallows every rule that follows it into the last one open.');
  }
});

test('a media query never opens inside another one', () => {
  /*
   * Not illegal CSS, and not something this app has any use for — but it is
   * the shape a mis-scoped edit produces, and a nested breakpoint is
   * unreadable at a glance in a sheet this size. Cheap to forbid while the
   * answer is still "never".
   */
  for (const { name, src } of sheets()) {
    const clean = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
    let depth = 0;
    const lines = clean.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].includes('@media') && depth > 0) {
        assert.fail(`${name} opens a @media inside another block at line ${i + 1}: `
          + `"${lines[i].trim()}" — which usually means a brace above it is wrong.`);
      }
      for (const ch of lines[i]) {
        if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
      }
    }
  }
});

test('THE PHONE-ONLY SLOT RULE STAYS PHONE-ONLY', () => {
  /*
   * The exact rule that escaped, named. It hides every empty pack slot after
   * the first, which is right on a 390px screen and wrong everywhere else —
   * on a laptop it turns Tonight's six slots into one, silently, with the
   * markup and the JavaScript both correct.
   *
   * Asserting the rule is INSIDE a max-width block rather than asserting the
   * braces balance, because balanced braces in the wrong places would pass the
   * test above and still put this rule on a laptop.
   */
  const css = fs.readFileSync(path.join(CSS_DIR, 'style.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const needle = '.lb-drop ~ .lb-tile.lb-drop';
  let depth = 0;
  let openMedia = null;
  let found = 0;
  for (const line of css.split('\n')) {
    if (line.includes('@media') && line.includes('{') && depth === 0) openMedia = line;
    if (line.includes(needle)) {
      found += 1;
      assert.ok(depth > 0 && openMedia && /max-width/.test(openMedia),
        'the "one empty slot" rule is applying outside a max-width media query, so '
        + 'Tonight shows ONE pack slot on a laptop instead of six. It belongs to the '
        + 'phone layout only.');
    }
    for (const ch of line) {
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) openMedia = null; }
    }
  }
  assert.equal(found, 1, 'the rule should exist exactly once');
});
