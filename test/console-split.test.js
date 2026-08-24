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
 *
 * RAISED TO 2890 THE SAME DAY: the fix above disabled Card and Prizes in
 * mixed mode with a "Set per pack below" placeholder — reported straight
 * back as still wrong, off the same screenshot: "if they can't function on
 * the bench they should be removed." Disabled-and-present was the right
 * call for the ordinary case (a bingo pack landing on this row is one drag
 * away) but the wrong one here — in mixed mode the global pair is not
 * "not yet usable", it is permanently superseded by each tile's own
 * controls, so it is hidden outright instead. Two named wrapper elements
 * (`.lb-set-card`/`.lb-set-prizes`) for `paintSettings()` to toggle.
 *
 * RAISED TO 3020 ON 23 AUGUST 2026, for the settings SPLIT — asked for
 * directly: *"I need the packs clickable when in the bay, and when you click
 * a pack the settings for THAT PACK appear below… settings that only apply
 * to the night as a whole can sit above the packs."* One `.lb-set` becomes
 * two (`.lb-set-night` above the tiles, `.lb-set-pack` below), plus
 * `lbPicked` and the four helpers that resolve it — `pickedPack()`,
 * `packsInBay()`, `pickedShape()`, `setPickedBingo()` — which exist because
 * a picked pack keeps its shape in one of TWO places depending on the shape
 * of night (its own slot in a mixed running order, `night.*` otherwise), and
 * one function per question beats that branch appearing at every call site.
 *
 * RAISED TO 3060 THE SAME DAY, for a REVERSED decision that has to be
 * explained where it is enforced: a saved night no longer carries its VENUE.
 * *"Saving everything INCLUDING the venue is pointless, there's no way you'd
 * want to run the same quiz at the same venue again — but if it could be
 * saved and the venue left open that would be useful."* Both halves of that
 * needed writing down next to the code (`tonightAsShow()` stops storing it,
 * `applyShow()` stops reading it, so shows saved before the change do not
 * drag an old pub in), because the previous rule — the venue stays ON the
 * show, so swapping a part cannot disturb it — is recorded in three other
 * files and would otherwise be put straight back.
 */
/*
 * `console-packs.js` GETS ITS OWN ENTRY AT 1680, on 23 August 2026, for the
 * Workshop shelf's two jobs. Asked for once the search box left the Console:
 * *"the workshop is the place to pin 6 — perhaps make that a drop down,
 * options being 'work on a pack' and 'set your pinned packs'?"* They really
 * are two jobs — choosing what to WORK on wants the recommended six, and
 * choosing what to PIN wants every pack you own on screen, since curating
 * six FROM six is circular. The mode changes the head as well as the grid,
 * so it re-renders rather than repainting, and each half needed saying next
 * to the code that does it.
 */
/*
 * RAISED TO 3150 ON 23 AUGUST 2026, for per-venue play ranking: *"that's a
 * good order but it needs to be per venue as well — if you've done a quiz at
 * venue A and not at venue B recently then this needs to be factored in."*
 * Four small exported functions — `venueTonight()`, `heardHere()`,
 * `heardHereIsLocal()` and `whyFresh()` — plus `venueKeyNow()`, which mirrors
 * the server's `venueKeyOf()` in the browser.
 *
 * They are HERE rather than in a module of their own because three of them
 * read `lbVenue`, which is `launchBar()`'s own closure state and the same
 * thing that has pinned every raise above. The arithmetic they sit on top of
 * is NOT here — that is `src/heard.js`, on the server, where the archive is.
 * What lives in this file is only the browser's half: which venue tonight is,
 * and what that means for one pack.
 */
/*
 * `console-tonight.js` GOES TO 3180 rather than 3150 for the last piece of the
 * same change: `chooseVenue()` now RE-RENDERS instead of repainting, because
 * the shelf below it is ranked on the venue and repainting the bar alone left
 * a grid ordered for the pub before it — silently, with every card real.
 */
/*
 * `console-packs.js` GOES TO 1720 THE SAME DAY, for `playedLine()` — the small
 * line under a pack's name, which now has to say what THIS venue has heard
 * rather than what the diary has. Six lines of code and the rest is the note
 * saying why the local answer LEADS: the two halves can disagree, and a card
 * at the front of the shelf opening "Played 4 times" reads as a bug.
 */
/*
 * RAISED TO 3260 ON 23 AUGUST 2026, for the break strip — *"the while they
 * wait section needs to assign games and/or photo upload per break"*. The
 * strip itself is a module of its own (`console-breaks.js`) and the model is
 * shared with the server (`break-parts.js`); what had to live in this file is
 * `segmentsNow()` and `breakStripNow()`, both of which read `currentPack`,
 * `lbExtra`, `lbOff` and `lbSlots` — `launchBar()`'s own closure state, the
 * same thing that has pinned every raise above it.
 */
/*
 * RAISED TO 3360 ON 23 AUGUST 2026, for `addRoundToTonight()` — the TAP a
 * shelf round dot never had. Reported as *"the drag and drop feature per
 * round doesn't seem to be functional"*: the drag worked and was verified
 * with real mouse events, but the dot carried no `click` at all, so the
 * first thing anybody tries did nothing and a touchscreen had no way in
 * whatsoever. It sits here, with `packWanted`'s twin `roundWanted`, because
 * the pick-up point is inside `launchBar()`'s closure — the same reason
 * every raise above it landed here.
 */
/*
 * RAISED TO 3390 ON 23 AUGUST 2026, for the head row taking over the live
 * line and the Doors chip, and for cutting the info line down to the prizes.
 * Net code is roughly flat — the old four-fact line went out as the new one
 * came in — and what grew is the note saying WHY three of those four facts
 * left: they were settings edited elsewhere that changed nothing about what
 * launches, and the prizes are the one that is read at launch onto a voucher.
 */
/*
 * `console-tonight.js` GOES TO 3480 for the venue sheet becoming a popover —
 * it moved inside the picker's own cell (so it can hang off it) and gained the
 * outside-click and Escape closes it never needed as an inline block. A
 * floating sheet that can only be shut by the control that opened it sits over
 * the settings row and swallows every click aimed at them.
 */
/*
 * `console-tonight.js` WENT TO 3450 EARLIER THE SAME DAY, for the popover
 * pickers — *"all dropdown boxes on the bay must popover… we need to save
 * space."* The component is its own module (`console-pick.js`); what grew
 * here is the shorter labels, the `data-pop` markers, and the note saying why
 * the native `<select>` stays in the DOM: the launch reads it, and this bar is
 * the protected surface.
 */
/*
 * `console-tonight.js` WENT TO 3420 EARLIER THE SAME DAY, for the Playing choice
 * becoming ONE field (`night.playing`) with `teamPlay` and `teamMode` derived
 * from it at the moment of sending — so there is no second copy on the
 * browser side that could drift out of step with the dropdown somebody is
 * looking at.
 */
/*
 * `console-packs.js` GOES TO 1760 ON 23 AUGUST 2026, for the three-way
 * Playing choice — individual, team-they-pick, team-dealt-at-random. The
 * options themselves are three lines; the note is why the labels name the
 * CHOICE rather than the mechanism they used to describe.
 */
/*
 * `console-tonight.js` GOES TO 3660 AND `console-packs.js` TO 1770 for the gap
 * dial — one 44px symbol in each pack tile's corner, cycling what the phones
 * get in that pack's breaks, plus the night-level big-screen picker that had
 * to exist because only ONE control fits in that corner.
 *
 * **This raise BUYS a deletion rather than paying for an addition**, which is
 * the only reason it is not simply growth: the strip of chips it replaces is
 * gone, and `console-breaks.js` went from 234 lines to 195 — the chip, the
 * setter panel, the strip and the doors chip all deleted outright. The
 * console is smaller than it was this morning; this one file is not.
 */
const BUDGET = { 'console-tonight.js': 3660, 'console.js': 2000, 'console-packs.js': 1770 };
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
