# Tonight's drags — the mouse, the browser's own rules, and what they cost

Split out of `launch-bar.md` on 24 August 2026 when that file crossed its
100,000-byte cap. It is the same reasoning, moved whole and by line number:
everything about picking a pack up and letting it go.

**The one thing to read before touching a drag handler** is that the browser
has preconditions of its own — a `drop` that never fires because `dragover`
did not `preventDefault()`, or because `dropEffect` was one the source's
`effectAllowed` forbids — and a synthesised `DragEvent` enforces neither. Run
`node scripts/drag-check.mjs`, which drives the real mouse.

## THE PACK LIFTS FROM ITS GRIP; A ROUND LIFTS FROM ITS OWN SQUARE

Reported on 24 August 2026: *"I still can't drag a round onto a fresh slot — it
seems to default to dragging the entire pack. Can we have it so the pack is
dragged from the top and the rounds are dragged from the squares they occupy?"*

**It was doing exactly what he described, and the reason is one line of HTML.**
A drag starts on the nearest DRAGGABLE ANCESTOR of whatever the pointer went
down on. In the ordinary row the round ticks carried a `mousedown` and a
`click` and nothing else — no `draggable`, no `dragstart` — so the browser
walked up past them to the tile and dragged the whole pack. The mixed row had
been right all along, which is why this only ever bit on a plain quiz night.

**A `draggable` child is what stops the walk.** The tick is draggable itself
now, and that alone fixes the reported half.

### And the pack gets a handle, which is what he actually asked for

The tile stays `draggable="true"` in the markup and simply REFUSES a
`dragstart` that did not begin inside `.lb-tile-head`. That is the smallest
version of a drag handle: no `mousedown` dance arming and disarming a flag, and
nothing left in a wrong state if a pointer is lost out of the window.

**The ordinary tile had no head at all** — no grip, no wrapper — while the
mixed row's tile had both. Two renderers drawing one idea two ways is the drift
the GUI rules exist to stop, so the ordinary tile gained the same head. The
grip was previously a promise only the mixed row kept; now it is true in both,
and it points at the only place a pack lifts from.

### A child's `dragend` bubbles to the tile, and the tile's removes the pack

Found by driving it rather than by reading it. The tile's `dragend` is what
implements *dragged back out* — let go of a pack outside the panel and it
leaves the night. A round chip's `dragend` fires on the CHIP and bubbles
straight into that listener, so **dragging a round out of a pack took the whole
pack with it, and emptied Tonight completely.**

`if (ev.target !== tile) return;` is the fix, and it is the same trap as the
tick's own `mousedown` one level up: a child that starts its own gesture still
hands you every event on the way back.

### The round travels the shelf's channel on purpose

A round dragged out of a pack in Tonight uses the same `shelfRoundDrag` path a
round dragged off a shelf card uses. That looks like a shortcut and is the
opposite: `addRoundToNight()` ends in `moveRoundToSlot()`, which TAKES a round
out of wherever it currently sits before placing it — so a round already in
Tonight moves rather than being duplicated, and a round arriving from the shelf
is simply one that was nowhere. One path, two origins, no second set of rules
to keep in step.

Proved end to end with real drag events: dragging round 2 out of a four-round
pack leaves that pack with three and puts one in a slot of its own; the tile
refuses to lift from its face and accepts from its grip; reordering by the grip
still works; dragging a pack out still removes it; and a plain click on a tick
still switches its round off.

### An empty slot takes a round — and says so while you are over it

*"It looks as though it won't drag to another slot unless there is a pack there
— is it possible to do this, and if so how?"*

It was possible and it was half-wired. The row was doing two things wrong at
once, one visible and one not:

- **NO FEEDBACK.** An empty slot in the ordinary row had no `dragover` handler
  of its own, so nothing lit up as the cursor crossed it. The drop was in fact
  accepted further up by `orderEl` — but from the outside an inert square is a
  square that refuses what you are holding, whatever some ancestor would have
  done with it.
- **AND IT IGNORED WHICH SLOT.** `orderEl`'s drop appends at the END of the
  running order, so a round let go over slot 5 appeared in slot 2. That is the
  same complaint wearing a different hat: you aimed at one place and it went to
  another, which reads as the aim being refused.

Each empty slot now has its own `dragover` / `dragleave` / `drop`, lights with
the same `.drop-here` the mixed row's empty slots already used, and places the
round at ITS index through `moveRoundToSlot()`. `stopPropagation` is what makes
the slot's own answer the one that counts — without it the slot handles the
drop and then `orderEl` handles it again and appends a second copy.

`moveRoundToSlot()` widens the list to reach an index past the end, so dropping
into slot 5 of a one-pack night leaves real gaps between. That is the mixed
row's own model rather than a special case: *positions do not shift*, so an
empty slot stays where it is instead of the row closing up behind your thumb.

### AND THE TEST THAT SAID IT ALREADY WORKED WAS MEASURING THE WRONG THING

The previous round of this work "proved" a round could be dropped on an empty
slot. It could not. The test dispatched `drop` on the target directly — and **a
browser fires no `drop` at all unless `dragover` called `preventDefault()`**.
Synthesising the drop skipped the only question that mattered.

The honest probe is `defaultPrevented` on the dragover: hold the drag over each
candidate target and ask whether anything accepted it. Done that way the
ordinary row's empty slots answered `true` for the wrong reason (an ancestor,
not the slot) and the outcome — which slot the round actually landed in —
answered the rest.

This is the same family as every other entry in this file: *a test that never
runs the artefact proves nothing about it*, and a synthetic event that skips
the browser's own precondition is not running the artefact.

### A pack tile lights up too — and only where the drop will be taken

*"Can we make it so the pack being dragged to has a slight highlight effect or
something to make it known that it's active and accepting the drag."*

The empty slots had gained that a round earlier; the FILLED tiles had not, so
the one place a round most obviously belongs — back on its own pack — was the
one place nothing happened.

**The rule that matters is not the glow, it is what the glow promises.**
`moveRoundToSlot()` refuses a slot holding a bingo game or a DIFFERENT pack: a
slot is one pack's rounds or one bingo game, never a mix. So the highlight asks
exactly the question the drop asks, and a tile that would refuse stays dark.
A tile that lit and then did nothing would be worse than one that never lit,
because it made a promise.

A refusal also STOPS the event rather than letting it bubble. Without that it
reaches the row, which appends to the end — so releasing over the wrong pack
would quietly put the round somewhere else entirely, which is the complaint the
empty slots were fixed for one round earlier.

### Two wirings on one tile, racing to set the same class

A filled tile in the mixed row gets BOTH `wireSlotDrag` (reordering) and
`wireDropTarget` (things arriving). The first attempt put the round branch in
`wireSlotDrag` as well — so two `dragover` listeners were setting `drop-here`,
and **the one registered last won**. That is how a bingo tile came to light up
for a round it would then refuse: the conditional one ran, and the
unconditional one ran after it.

`takesRound()` lives in `wireDropTarget` alone now and `wireSlotDrag` stands
down whenever a round is in flight. One question, one answer, one place.

### And the inset ring was invisible where it mattered most

`.lb-tile.is-pack.drop-here` was an inset ring in the account colour — and the
PICKED tile already wears a full outline in that same colour. On the tile you
are most likely to be dragging within, "accepting" and "picked" were the same
picture. It takes a wash and a small lift as well now, so the answer is legible
whether or not the tile underneath happens to be the chosen one.

Deliberately not the account GRADIENT: that means "press this", and the one
control wearing it on this panel is Launch.

Measured, both renderers, holding a round of pack A: its own tile lit and
accepted; a different pack's tile stayed dark and refused; a bingo tile stayed
dark and refused; an empty slot lit and accepted. And the outcomes match — a
round dropped on the wrong pack leaves the running order byte-identical, and
one dropped back on its own tile merges in.

## THE SLOT YOU DROP ON IS THE SLOT IT GOES IN — for a whole pack too

*"I tried dragging the music bingo onto slot 2 and it populated on slot 4
instead — thoughts?"*

**It is the rounds bug again, one function along, and the third sighting of the
same shape in a week.** The target was never wrong: the empty slot accepted the
drop and lit up correctly. Then `addBingoSlot()` — and `addQuizPackSlot()`
beside it — appended to the end of the list and never read the index the drop
handler had passed them. A highlight that promises a position and a placer that
does not read it.

`placeAt()` is the one answer for both, and it draws three lines that are worth
stating because each was a decision:

- **`at` is honoured only when that slot is genuinely EMPTY.** Dropping onto a
  tile that already holds something appends instead of overwriting: a slot you
  can silently destroy by letting go over it is not a slot, it is a hazard.
- **The list widens with `null`s to reach an index past the end**, exactly as
  `moveRoundToSlot()` does. *Positions do not shift* — slot 5 stays slot 5
  rather than the row closing up behind your hand.
- **No target still means "the next free slot"**, which is what the panel's own
  drop has promised in those words since it was written. That promise had
  quietly become untrue: with holes in the row, "the end of the array" and "the
  next free slot" are different places, so a pack let go on the panel with slots
  3 and 4 empty was landing in slot 6. It fills the first hole now.

The ordinary row's empty slots claim a pack drop the same way, so the rule holds
whichever renderer is on screen — and `addPackToNight()` takes the index only as
an option, so every existing caller that had nowhere in particular in mind
behaves exactly as it did.

Measured: a bingo aimed at slot 2 lands in slot 2; a second aimed at slot 5
lands in slot 5 leaving 3 and 4 empty; and one let go on the panel rather than a
square fills slot 3, the first hole. The round drags, the grip-only pack lift
and the truthful highlight all still hold.

## A `dropEffect` THE SOURCE DID NOT ALLOW KILLS THE DROP SILENTLY

Reported straight after the last change: *"now the pack drags aren't sticking
at all?"*

They were not. Giving the ordinary row's empty slots a `dragover` of their own
included one line that looked like housekeeping:

```js
ev.dataTransfer.dropEffect = 'move';
```

**A pack CARD starts its drag with `effectAllowed = 'copy'`.** A `dropEffect`
the source did not allow makes the browser treat that target as REFUSING — so
**no `drop` event fires at all**. Rounds kept working, because a round tick
starts its drag with `'move'` and the hard-coded value happened to match. Every
pack drop onto a slot was dead.

`shelfRoundDrag ? 'move' : 'copy'` is the whole fix. What matters is why it got
through.

### The test could not have caught it, and neither could the last one

**A synthesised `DragEvent` enforces none of the browser's own preconditions.**
This bar has now been bitten by two of them in three days:

- no `drop` fires unless `dragover` called `preventDefault()`;
- no `drop` fires if `dropEffect` is one the source's `effectAllowed` forbids.

Dispatching `drop` by hand skips both. The check written two changes ago —
which measured `defaultPrevented`, and was a genuine improvement — still could
not see this one, because it never asked the browser to carry anything.

### So there is a script now, and it drives the mouse

`scripts/drag-check.mjs` starts its own server on its own port with its own
`DATA_DIR`, opens a real Chromium, and performs real mouse drags: a pack card
onto the row, a pack card onto an empty slot, and a round out to a later slot.
It asserts the shape of the running order after each and fails loudly.

It cannot live in `npm test` — this repo has no dependencies and Playwright is
a container tool rather than a project one — so it sits beside
`pub-unchanged.mjs` as a thing you RUN after touching a drag handler.

**Verified by reintroducing the fault**: with `'move'` hard-coded it reports two
failures and names the shape it wanted; with the fix it passes. Which is the
only reason to believe it.

### One more thing it caught about itself

Its first draft grabbed `.pack-card[data-pack]` for the second drag — the same
card it had just placed. A pack already in the running order stays on the shelf
as a dashed ghost and is deliberately refused a second time, so the check was
measuring that refusal rather than the drop. `:not(.in-tonight)` fixed it. A
guard aimed at the wrong element proves nothing, which is this repo's oldest
lesson and apparently still worth relearning.

## THE HOLE IN SLOT 2 — three faults, one report

Reported off a screenshot of a real running order — a bingo game, an empty
slot, another bingo game, a quiz — as *"now I can't drag into slot 2 as an
empty slot?"* One sentence, three separate faults under it, and none of them
threw.

### 1. A descriptor is not the thing it describes

`packDrag` is `{ id, kind }`: a note about what is in flight, not the pack.
Every call site resolved it through `packOnShelf()` before handing it on —
except the empty slot's own drop, which was written later and passed it
straight to `addPackToNight()`. The object had an id and no `rounds`, so
`addQuizPackSlot()` found nothing to place and returned the row unchanged.

**The slot lit up, the drop was accepted, and nothing appeared.** A bingo slot
needs only the id, so a bingo landed and a quiz did not — which is why it read
as an intermittent fault rather than a missing lookup.

### 2. A kind that disagrees with the night's own is a mixed night

The test for the mixed row was `kind === 'bingo' || lbSlots`. So a quiz pack
added to a night whose game was bingo took the ORDINARY path and was pushed
into `lbExtra` — which holds IDS that `packOf()` resolves against `gameOf()`
alone. Against a bingo game a quiz id resolves to nothing, `lbPacks()` filtered
it straight back out, the row went on showing one tile and Launch went on
naming the bingo.

**Nothing threw and no test could have seen it**, because the state was
perfectly self-consistent — it was the READER that could not resolve it. The
condition now asks whether the incoming kind differs from the night's own.

### 3. The shelf ghosting never survived a tab change

`paintInTonight()` walked `document.querySelectorAll('.pack-card')` at the end
of every paint. But `render()` assembles the whole page OFF the document and
attaches it in one go, so a walk run while the bar is building finds the
PREVIOUS page's cards. Every tab change therefore drew a fresh shelf with the
ghosting gone — the pack was in the night and its card said it was free, and
the duplicate check then refused a drop the card had promised.

**A card asks for itself now.** `packIsInTonight()` is exported from
`console-tonight.js` and `packCard()` calls it as it builds; the repaint stays
for a drop, which changes the night without rebuilding the page.

### And the budget was paid rather than raised

The fix put `console-tonight.js` 34 lines over its 3,900. Instead of a fifth
raise, `doorsSlot()`, `screenOfPlan()`, `setGaps()` and `breakSetFor()` moved
into `console-breaks.js` behind `breakPlumbing({ night, segmentsNow, repaint
})` — break-plan work, in the module named for it, handed what it needs so
that module is still a leaf. **The destructuring sits above every paint
function that reads it**: a `const` read in its temporal dead zone throws when
the line RUNS, and the console's own catch swallows it.
