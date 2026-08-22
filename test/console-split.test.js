/**
 * THE CONSOLE IS TWELVE FILES, AND THESE ARE THE THREE THINGS THAT KEEPS IT.
 *
 * `console.js` was 11,222 lines on 16 August 2026 and was split by line number
 * into a shell plus eleven modules — one per door or tab. The split itself was
 * mechanical and is not what needs guarding. What needs guarding is the three
 * properties that make the result work, because each fails silently.
 *
 * ---
 *
 * **1. NOTHING ASSIGNS TO A NAME IT IMPORTS, and this is the one that would
 * end a night.** An ES import is a read-only view of the exporting module's
 * binding: `import { library }` then `library = x` throws
 * *"Assignment to constant variable"* — **at the moment that line runs, not
 * when the file loads.** So the console loads perfectly, every tab draws, and
 * then a drag, a launch or a save throws in a pub.
 *
 * Neither existing guard sees it. `node --check` passes the file (verified —
 * it is valid syntax), so `browser-parses.test.js` passes it too, and no unit
 * test imports a DOM module. That is the same hole this repo has now recorded
 * four times: **a test that never runs the artefact proves nothing about it.**
 *
 * The fix in the code is `console-state.js`: the thirteen bindings that more
 * than one module writes live there with a setter each. Reads never needed
 * one — a live binding reads fine from anywhere, which is why ~350 read sites
 * did not have to change and only 39 assignments did.
 *
 * **2. `console-state.js` IMPORTS NOTHING.** It is the one leaf in the
 * console's graph. Every other module imports from it, and several import each
 * other, so the graph has cycles by design — that is fine for function
 * declarations, which are hoisted, and fatal for state, which is not. A state
 * module that reached back into a cycle could be read half-initialised, and
 * the symptom would be an empty library on a slow morning and a full one on a
 * fast one. One import into this file is how that starts.
 *
 * **3. NO MODULE GROWS BACK.** The reason for the split was that the file cost
 * a session most of its context before any work began, and a written rule to
 * keep a file short has already failed twice in this repo — which is why
 * `claude-md-budget.test.js` exists and why this does. Raise a budget
 * deliberately when a module genuinely has to carry more; the diff will then
 * say that is what you did.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { consoleFiles } from './console-source.js';

/** Comments mention names without using them; strings are left alone. */
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

test('no console module assigns to a name it imports', () => {
  for (const { name, src } of consoleFiles()) {
    const imported = [];
    for (const line of src.split('\n')) {
      const m = line.match(/^import \{([^}]*)\} from/);
      if (m) imported.push(...m[1].split(',').map((s) => s.trim()).filter(Boolean));
    }
    const body = noComments(src);
    for (const n of imported) {
      // An assignment, not a comparison, not an arrow, and not a fresh local
      // declaration that happens to shadow the import — shadowing is legal.
      const bad = new RegExp(`(?<![-.\\w$])(?<!\\b(?:const|let|var)\\s)${n}\\s*(?:=(?![=>])|\\+=|-=|\\+\\+|--)`);
      const setter = `set${n[0].toUpperCase()}${n.slice(1)}`;
      assert.ok(!bad.test(body),
        `${name} assigns to ${n}, which it imports. An import is read-only, so that throws `
        + '"Assignment to constant variable" WHEN THE LINE RUNS — the page loads, every tab '
        + `draws, and then a launch or a drag dies in a pub. Move ${n} into console-state.js `
        + `and call ${setter}() instead.`);
    }
  }
});

test('console-state.js imports nothing, so state cannot be caught half-built', () => {
  const state = consoleFiles().find((f) => f.name === 'console-state.js');
  assert.ok(state, 'the console has lost its state module');
  assert.ok(!/^import /m.test(state.src),
    'console-state.js has grown an import. It is the one leaf in the console graph — the moment '
    + 'it joins a cycle, a binding can be read before it is initialised, and the symptom is a '
    + 'value that is right on a fast machine and empty on a slow one.');
});

/**
 * A line budget per module. `console-tonight.js` is the big one because
 * `launchBar()` alone is 1,700 lines — that is the next seam to take, and it
 * is a real split rather than a move, so it waits for a reason.
 *
 * RAISED TO 2650 ON 20 AUGUST 2026, deliberately, for the mixed-row wiring —
 * bingo joining an existing night, and a round split apart from its
 * siblings. The rendering itself lives in the new `console-tonight-mix.js` /
 * `console-tonight-mix-ui.js` (each well inside `DEFAULT_BUDGET`); what grew
 * here is the glue that has to live inside `launchBar()`'s own closure —
 * `addPackToNight()`, the three drop handlers, `paintOrder()`'s branch — none
 * of which can be pulled out without also pulling out the closure state
 * (`currentPack`, `lbExtra`, `lbOff`, `packOf`) they read and write.
 *
 * RAISED AGAIN TO 2680 THE SAME DAY, for two bug fixes live verification of
 * the above caught before it ever reached a real gig: a bingo pack dropped
 * on the empty tiles row launched as a quiz (the picker's own kind was never
 * synced on that one entry point), and `movePack()` promoting a different
 * pack to slot 1 silently DELETED the pack it displaced — `pick()`'s "a
 * different pack starts the night again" rule firing on a reorder that had
 * already computed the right `lbExtra` itself. Both fixes are a few lines;
 * the comments explaining why are not.
 *
 * RAISED TO 2760 ON 21 AUGUST 2026, for a single round dragged straight off
 * the shelf onto Tonight — `addRoundToNight()`, and the three drop zones
 * (the strip, the section round it, the window's own dragend) that all now
 * have to check `shelfRoundDrag` alongside `packDrag`. Same reason as the
 * two raises above: this is glue reading and writing the closure's own
 * `currentPack`/`lbExtra`/`lbOff`/`lbSlots`, which is exactly the state that
 * cannot be pulled out without pulling the whole bar out with it.
 *
 * RAISED TO 2790 THE SAME DAY, for a pack handed over in the URL from the
 * Workshop bench — `wantPackFromUrl()`, and the `packWanted` doc comment
 * explaining why it cannot render before `load()` has fetched anything, the
 * same boot-order fault `?night=` already exists to avoid.
 *
 * RAISED TO 2820 THE SAME DAY, for the unlaunch button beside the live-drift
 * warning — asked for directly, off a screenshot of that line. The new
 * `stopRunningNight()` is shared with the running panel's own Stop button
 * (whose own copy of the same logic was deleted), so the net line cost is
 * the new button's markup, its `aNightIsOn`-gated visibility inside
 * `paintLive()`, and the doc comments explaining why it reads that rather
 * than the line's own looser title check.
 *
 * RAISED TO 2860 THE SAME DAY, for Tonight's settings — asked for directly,
 * off a screenshot of that tab: "these four options should be on the launch
 * bay really", and, once asked which parts, "everything — kill the tab".
 * `tonightSettingsPanel()` (a whole separate exported function, deleted
 * outright) becomes `.lb-set` inside `launchBar()` itself, a `paintSettings()`
 * that repaints it wherever `currentPack` changes (the tab was rebuilt from
 * scratch on every visit; this bar is not, so the pack-dependent parts —
 * Card, Prizes, Seconds, Look, While they wait — need painting by hand at
 * every place that used to just work), and the `id: 'setup'` TABS entry
 * along with it in `console.js`. Card and Prizes stay PRESENT AND INERT on a
 * quiz pack rather than disappearing, the same rule this bar already keeps
 * for Launch — so the net line cost is not the settings themselves, which
 * moved rather than grew, but the repaint wiring a tab never needed.
 *
 * RAISED TO 2870 THE SAME DAY, for the mixed running order — reported live,
 * off a screenshot: Card and Prizes read "Bingo only" beside a bingo TILE
 * that already had its own working shape/prize dropdowns, because
 * `paintSettings()` only ever asked `currentPack`, which in a mixed night is
 * just slot 1 and may not be bingo at all. Now asks `lbSlots` too, and moved
 * the scattered per-call-site repaints into one call inside `paintOrder()`
 * itself — the seam every `lbSlots` mutation already passes through.
 */
const BUDGET = { 'console-tonight.js': 2870, 'console.js': 2000 };
const DEFAULT_BUDGET = 1600;

test('no console module has grown back', () => {
  for (const { name, src } of consoleFiles()) {
    const lines = src.split('\n').length;
    const cap = BUDGET[name] || DEFAULT_BUDGET;
    assert.ok(lines <= cap,
      `${name} is ${lines} lines, over its ${cap}. The console was split because one file of `
      + '11,222 lines cost every session most of its context before any work started. Take a '
      + 'seam out of it, or raise the budget in this test deliberately.');
  }
});
