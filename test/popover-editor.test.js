/**
 * THE POPOVER EDITOR IS REACHABLE, AND IT IS THE EDITOR.
 *
 * **This file is source-reading and it says so.** CLAUDE.md's own rule is that
 * a test which never runs the artefact proves nothing about it — the arcade
 * board was in the payload for months with no projector drawing it, the
 * gallery route worked with nothing calling it, and `/console` went down while
 * 1,150 tests passed. What this can honestly check is the class of fault those
 * three shared: **the wiring going missing while the feature still looks
 * built.** A button that stops being wired, an import that goes away, a bench
 * that quietly links back out to `/editor`.
 *
 * The behaviour — a draft surviving a reload, an unsaved draft NOT reaching the
 * pack — is checked two other ways: `test/pack-draft.test.js` runs the storage
 * module for real, and a browser is driven through the whole round trip by
 * hand. See the popover section in CLAUDE.md.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CONSOLE = readFileSync(new URL('../public/assets/console.js', import.meta.url), 'utf8');
const EDITOR = readFileSync(new URL('../public/assets/editor.js', import.meta.url), 'utf8');

test('the editor is mountable, so there is one of it rather than two', () => {
  assert.match(EDITOR, /export function mountEditor\(/,
    'editor.js must export a mount, or the popover has to reimplement saving');
  assert.match(CONSOLE, /await import\('\.\/editor\.js'\)/,
    'the console must mount the real editor, not a copy of it');
  assert.match(CONSOLE, /mountEditor\(\{/, 'nothing calls the mount');
});

/*
 * IMPORTED WHEN THE BUTTON IS PRESSED, not at the top of the console. The
 * console loads on a gig day; the editor is a Workshop thing. Same rule the
 * lobby games follow.
 */
test('the editor is not in the bytes a launch waits for', () => {
  const imports = CONSOLE.slice(0, CONSOLE.indexOf('\n\n/**'));
  assert.doesNotMatch(imports, /from '\.\/editor\.js'/,
    'editor.js must be a dynamic import, not a static one');
});

test('the bench opens the popover instead of leaving the page', () => {
  assert.match(CONSOLE, /class="go bench-go role-make bench-edit"/, 'the bench has no edit button');
  assert.match(CONSOLE, /\.bench-edit'\)\?\.addEventListener\('click', \(\) => editSheet\(/,
    'the edit button is not wired to the popover');
  const bench = CONSOLE.slice(CONSOLE.indexOf('function workBench('), CONSOLE.indexOf('function nightBenchPanel('));
  assert.doesNotMatch(bench, /href="\$\{esc\(editHref\)\}"/,
    'the bench is still linking out to /editor to edit');
});

test('reading a pack through leads into editing it without a navigation', () => {
  assert.match(CONSOLE, /id="sheetEdit"/, 'the read-through sheet lost its way into the editor');
  assert.match(CONSOLE, /#sheetEdit'\)\?\.addEventListener\('click'/, 'and nothing wired it');
});

/*
 * THE LOAD-BEARING ONE.
 *
 * `reloadPackEverywhere()` pushes a saved pack into any game currently running
 * it, on purpose — so anything that writes a pack automatically would put a
 * half-typed question on a projector mid-quiz. The draft goes to the device;
 * only `save()` goes to the pack.
 */
test('the draft never writes a pack, and nothing but save() does', () => {
  assert.match(EDITOR, /const DRAFT_DEBOUNCE_MS/, 'the draft has stopped being debounced');
  const drafting = EDITOR.slice(EDITOR.indexOf('function keepDraft('), EDITOR.indexOf('function forgetThisDraft('));
  assert.doesNotMatch(drafting, /api\(|fetch\(/, 'the draft path is talking to the server');
  // The pack is written in exactly one place, and it is the one behind a press.
  const writes = [...EDITOR.matchAll(/api\(saveTo\(\)/g)];
  assert.equal(writes.length, 1, 'a pack is written from somewhere other than save()');
  assert.match(EDITOR, /savedJson = JSON\.stringify\(quiz\);\n    forgetThisDraft\(\);/,
    'a save must clear the draft it just wrote');
});

test('reopening with a draft offers carry on and throw away', () => {
  assert.match(EDITOR, /class="small draft-keep"/, 'no way to carry on');
  assert.match(EDITOR, /class="small danger draft-bin"/, 'no way to throw it away');
  assert.match(EDITOR, /quiz = JSON\.parse\(savedJson\)/,
    'throwing a draft away must put the SAVED pack back, not an empty one');
});

/*
 * THE POPOVER MUST NOT TAKE THE CONSOLE DOWN.
 *
 * `editor.js` is now imported by a page that has none of /editor's elements.
 * Looking one up at the top level would throw on load — the exact fault that
 * killed `/console` on 15 August 2026, which `node --check` was happy with.
 */
test('the editor page wiring runs only where the page is', () => {
  assert.match(EDITOR, /if \(document\.getElementById\('quizPick'\)\) bootPage\(\);/,
    'the page boot is not behind a test for the page');
  const beforeBoot = EDITOR.slice(0, EDITOR.indexOf('function bootPage('));
  assert.doesNotMatch(beforeBoot, /document\.getElementById\('(quizPick|save|check|dirtyFlag|newQuiz|download|upload)/,
    'a page element is looked up at module level, which throws on the console');
});

test('the bench says when there is unsaved work waiting on it', () => {
  assert.match(CONSOLE, /readDraft\(bench\.kind, on\.id\)/, 'the bench does not ask about drafts');
  assert.match(CONSOLE, /part way through this/, 'and it does not say so');
});

/*
 * THE CLEAR-ON-DONE — "when it's done it's saved and removed from the section".
 * Without it the bench becomes a third shelf of stale things, which is the one
 * thing it exists to prevent.
 */
test('both benches clear through one named action, and only one', () => {
  assert.match(CONSOLE, /class="minor bench-done"/, 'no Done on the bench');
  assert.match(CONSOLE, /\.bench-done'\)\?\.addEventListener\('click', \(\) => putOnBench\(null\)\)/,
    'the Workshop bench does not clear');
  assert.match(CONSOLE, /\.bench-done'\)\?\.addEventListener\('click', \(\) => putNightOnBench\(''\)\)/,
    'the Post gig bench does not clear');
  // The unnamed × did the same job in a corner. Two controls for one job on a
  // panel with three buttons is the clutter rule, and the × was the weaker one.
  const benches = CONSOLE.slice(CONSOLE.indexOf('function workBench('), CONSOLE.indexOf('const found ='));
  assert.doesNotMatch(benches, /lb-tile-off/, 'a bench tile has grown its × back');
});

/*
 * AND THE THING THAT KEEPS "AN EMPTY BENCH MEANS NOTHING IS HALF-FINISHED"
 * FROM BEING A SLOGAN.
 *
 * Done clears the bench without destroying anything — a draft is keyed to the
 * PACK, so it outlives the bench. Which means that without a marker on the
 * shelf, pressing Done strands somebody's half-written round on the device
 * with nothing anywhere pointing at it: exactly the hidden stale state the
 * bench abolishes, reintroduced by the button that abolishes it.
 */
test('unsaved work stays visible on the shelf after the bench is cleared', () => {
  assert.match(CONSOLE, /readDraft\(kind, pack\.id\) \? '<div class="tiny pack-draft">Unsaved changes<\/div>'/,
    'a pack card does not say when it has unsaved work on it');
});
