# A show — the whole evening, built in advance

Split out of `docs/console.md` on 23 August 2026, when that file hit the
100,000-byte ceiling `test/docs-index.test.js` sets. This was a third of
it and is a subject of its own — everything about a night SAVED, as
against the bar you launch one from. Moved whole, by line number, so
nothing was retyped and nothing could be reworded on the way through.

**The rules are in `CLAUDE.md`; this is the reasoning.** The bar itself,
the tiles, the settings rows and the drag work stay in
[`../console.md`](../console.md).

---

## A SHOW IS A SAVED LAUNCH — the whole evening, built in advance

The rules are in `CLAUDE.md`. This is the reasoning behind them.

### What was actually wrong

Raised by the host on 16 August 2026, and the diagnosis is his: *"maybe I'm
being silly — the launch bar is launching nights, but we're frankensteining
nights instead of having a nights section. You build a night in advance and
then just drag it in onto the launch console."*

He is not being silly, and the word *frankensteining* is exact. Tonight is a
composer: you drag a pack in, drag a second one in, switch rounds off with the
ticks, choose the venue, and set the look, the lobby game, the card shape and
the prizes. **Every one of those is a decision made
at the moment of launching**, which is ten minutes before a gig, in a pub, on a
phone, with a room sitting down. It is the worst time in the week to be
composing anything, and it is the one time the app forces it.

Worse, none of it survives. The composition exists only as module state in one
browser tab — so the same six drags happen again next Thursday, at the same
venue, for the same night.

### Why it was small: the payload already was the night

`doLaunch()` has always sent ONE object:

```
{ game, packId, order, venue, look, lobbyGame, lobbySound, teamPlay,
  online, shape, prizes }
```

That is the whole evening. What is played, in what order, where, what it looks
like, what the phones do while the room fills up, what the winner gets. Nothing
about "a show" had to be invented at the data layer — a show is that object
with a name on it, and `tonightAsShow()` builds it by reading the same
module-level state `doLaunch` reads.

**That last point is the one worth defending.** Reading the settings off the
DOM, or keeping a second copy for shows, would allow a saved show and the night
that would have been launched to differ — which is the only way this feature
could be worse than not existing. One source, read twice.

### References, never copies — and why that is rule 11 again

A show holds pack IDS and round INDEXES. It does not hold a question, an
answer, a prompt or a track, and there is a test that reads the file off disk
and fails if a question ever appears in it.

This is the same argument `running-order.js` is built on and the same argument
rule 11 makes about the catalogue: **a hundred copies plus a sync is a hundred
chances for one to miss an update, and the failure is silent and lands in front
of a paying room months later.** A show built in March and launched in August
reads today's packs, so a correction saved in between is simply in it.

The cost is that a show can go broken — the pack it names gets deleted — and
the answer is the answer this codebase always gives: **say so, by name, in
advance.** `composeQuiz()` already refuses to launch a night whose pack has
gone, which is correct but arrives in the venue. `showProblems()` asks the same
question on the card, days earlier, using the same existence check the launch
will use. Two different checks would be a card that says a night is ready and a
launch that then says it is not.

### THE VENUE IS NOT SAVED, AND THAT REVERSES THE ORIGINAL DESIGN

The venue used to ride along with everything else, and this file argued for
it: a show is a whole EVENING, and an evening happens somewhere. The host
killed that on 23 August 2026 with the case it never survives:

> *"Saving everything INCLUDING the venue is pointless, there's no way you'd
> want to run the same quiz at the same venue again — but if it could be
> saved and the venue left open that would be useful."*

He is right, and the mistake was a category one: **a saved night is a
TEMPLATE, not a RECORD.** The archive already holds what happened where —
that is Past gigs, and it is the file's own "Gigs is evidence, Calendar is
organisation" test applied one step further. A show is reached for precisely
when you are somewhere NEW and want a running order that worked, so carrying
the old venue in means the first thing it does on landing is file tonight
under last month's pub.

**And the venue is not an inert label — the prizes and the voucher follow
it.** A wrong one is somebody refused a drink at the bar, which this file
already records as the expensive half of a venue mix-up, arriving now by
default rather than by mistake.

**Both halves were needed.** `tonightAsShow()` stops storing it AND
`applyShow()` stops reading it — the second is what makes shows saved before
the change behave like new ones instead of still dragging a pub in. **So
there is no migration**, which is the same reasoning `itemsOf()` uses for the
one-game shape: a rewrite over everybody's file is a one-shot script on a
disk that is wiped every deploy.

Three things followed it out: the name suggestion (it offered *"Thursday at
The Crown"*, a name pointing at a pub the show will not load — it names the
packs now), the venue on the show card, and the explainer copy that promised
the venue was kept. `src/shows.js` still ACCEPTS and normalises a `venue`
field, deliberately: refusing it would make every show saved before this
fail validation, and an ignored field costs nothing.

### It is not a gate, and that is the security point

Nothing in a show records that saving it was permitted. There is no `tier`, no
`entitled`, no `allowed`, and a test asserts that no field with any of those
words ever appears.

The launch route re-checks everything it always did: the feature for the game,
**every pack in the running order** (not just the one in `packId` — a Bronze
account could otherwise borrow one round from a Gold quiz and play it), the
lobby game against the tier, and the 409 that stops a running night being
wiped. A show built on Gold and launched after a downgrade is refused exactly
as a fresh launch would be.

**The opposite is the obvious shortcut and it is a gate running backwards.**
*"It was allowed when they saved it"* is how a subscription gets walked round
by a file somebody wrote last month, and it is the same shape as every other
cached-permission fault: a check that was true once, written down, and believed
later.

### The name, and the collision it was chosen to avoid

Three candidates were rendered as cards before choosing, because the host's own
objection killed the first two: *"set list and running order only imply the
activity and not the venue and prizes — I need a word that encapsulates all
four."* He is right; both name what is played and neither carries where, or
what the winner gets.

**"Night" was his own word and it was turned down for a collision.** The app
already has two nights: the BOOKING (the pub's night — Calendar) and the
archived record (the night that happened — Gigs). `TODO.md` says in as many
words *"do not invent a third concept"*, and a third **Nights** tab would be
one word for three sets on three adjacent doors — precisely the label collision
the sweep rules exist to find.

**Show** is the performer's word for the whole evening at a venue, it collides
with nothing in the app, and this app's user is hired as the entertainer rather
than the organiser. It is already the language.

### Why the order is rebuilt rather than stored a third way

The bar holds a night as two things: `lbExtra` (the packs after the first) and
`lbOff` (a Set of `packId:roundIndex` that are switched off). `nightOrder()`
derives the running order from those and nothing else.

So loading a show turns its `order` back into exactly those two — the packs in
first-appearance order, and every round the order leaves out marked off. The
mapping is lossless because rounds always play in their pack's own order.

**The alternative was a third piece of state saying "a show is loaded", and it
would have been a trap.** A loaded show has to be editable — you dropped last
Thursday in and tonight you want the picture round off — and a separate mode
means either the ticks stop working or there are two ways to express one night
that can drift apart. Rebuilt into the bar's own state, a loaded show is
indistinguishable from a night built by hand, which is what makes it safe to
edit.

### Where it is built, and why not in the Workshop

The natural reading of *"a nights section in the workshop"* is a builder over
there. It was not built, and the reason is the one above: **a second composer
is a second surface that could disagree with the launch.**

Everything a show holds is already on the bar. So a show is made by setting a
night up and pressing *Save for another night* under the settings — the last
thing you do, which is where it belongs in the sequence anyway. The Prepare a
night tab is where you take one back off the shelf.

That also keeps the door rule honest. On the Console door the Shows tab is a
shelf you drag off and nothing else; in the Workshop it grows Rename and
Delete. Same function, same cards, exactly the split the Venues tab uses.

### It never launches, and there is a tap as well as a drag

Dropping a show onto Tonight fills the bar and stops. That is the same promise
dragging a pack makes, and it matters more here because a show carries a whole
running order — a drop that launched would put an entire evening on the
projector from one imprecise gesture.

The card is also clickable, because **HTML5 drag events are never delivered on
touch** and half of this console is driven from a phone. Every drag in this app
has a way round it for the same reason.

### SHOWS WAS MISTAKEN FOR PAST GIGS, AND THE WORKSHOP BENCH NOW POINTS AT IT

Reported live: an empty Shows tab on Workshop read as Past gigs under
another name — the two are opposites (`docs/gigs.md`'s own
EVIDENCE-versus-ORGANISATION test), but a short line about *making* one,
with nothing saying what the finished thing IS, gives no way to tell them
apart.

**THE CONCEPT SENTENCE NOW SHOWS ON WORKSHOP WHETHER THE SHELF IS EMPTY OR
NOT** — it used to hide specifically when empty, on the theory that it
repeated the empty-state line below it (*"the general explainer only shows
once a show exists to make it worth explaining what one IS"*), which reads
exactly backwards once you say it in those words: the moment you most need
to be told what a Show is is the FIRST time you open the tab and find
nothing there, which is precisely when it was hidden. The empty-state line
still does its own job — HOW to make one, with links straight to Tonight and
its settings — the two were never actually saying the same sentence.

**THE WORKSHOP BENCH GOT A BRIDGE INTO IT, NOT A SECOND WAY TO BUILD ONE** —
asked for directly: *"give the workshop bench a place to save so it goes
into a show."* The honest answer is that the bench cannot honestly build a
show: it holds one pack, and a show also needs the look, the lobby game and
the rest of the running order, none of which exist on the bench — a save
button there would either leave those blank (a broken show) or invent a
SECOND composer for them, which is the exact fault this section's first
paragraph already refuses. So **Take it to Tonight**, a plain link next to
the bench's other actions, sends the pack to the ONE place a show is
actually built instead: `/console?tonightPack=<id>&tonightKind=quiz|bingo`,
read at boot in `console.js` — before `load()`, mirroring exactly how
`?night=` already hands a night to the Post Gig bench — so the pack lands on
Tonight the instant the page draws, ready for the same **Keep this ready**
button that was already there. `wantPackFromUrl()` in `console-tonight.js`
sets state ONLY and does not render, for the identical boot-order reason
`?night=` does not call `putNightOnBench()` directly: the library has not
been fetched yet, and a render that early throws on `library.brand`.

**AND THEN THE TAB ITSELF WAS RENAMED, THE SAME DAY** — *"change 'shows' to
'prep a gig' so the section is more obvious."* Turned down: it shares its
root word with **Past gigs**, the exact confusion just fixed. Offered
alternatives clear of "gig" AND "night" (Set list, Templates, Ready-made);
the host picked none of them — *"go with 'Prepare a night' for now and I'll
see if it makes sense"* — knowingly reusing the word the naming comment in
`console.js` originally avoided (Calendar's things are bookings, Gigs' are
the archive), as a phrase rather than a bare noun, to judge live.

**DISPLAY TEXT ONLY — THE CODE STILL SAYS `show`/`shows` EVERYWHERE**
(`src/shows.js`, `console-shows.js`, `library.shows`, `/api/shows`,
`.show-card`, `showsSection()`…). Renaming all of that too would touch the
API and the stored field for zero visible benefit. Nine strings changed —
the tab label on both doors, the `<h2>`, the always-on explainer, the empty
state, the **Keep this ready** button, both `prompt()` dialogs ("What is
this called?"), the success toast, and the parts editor's remove-label and
note — each checked live against the exact wording.

### A show is an EVENING, not one game

The first version held ONE game, and the host killed it in a sentence:
*"defeats the point — you need to be able to save a show with all of the
rounds, venue info and drop it onto the launch. Say you want to swap out the
music bingo after, you need to be able to do that independent of removing the
venue or other rounds."*

He is right and the failure is exact: **a "whole evening" that cannot hold the
bingo that follows the quiz is not the whole evening, it is the first half of
one.** His own Thursday is a quiz, then bingo, then karaoke — it is the shape
of his actual work, and the model did not fit it.

**The fix is one field: `items`, a list of what is played, in order.** And the
half that answers his second sentence is what is NOT in that list — the venue,
the prizes, the look, the lobby game and whether it is online all stay on the
SHOW. Swapping the bingo cannot disturb them, because they are not in the
object being swapped. There is no arrangement of the editor that could lose
them.

#### One reader, in a file both runtimes import

`itemsOf()` lives in `public/assets/show-parts.js`, imported by `src/shows.js`
and by `console.js` — the same arrangement `plans.js`, `schemes.js` and
`diary.js` already use.

It is there rather than copied because there are five callers across two
runtimes: the server validates and stores, and the console draws the parts on
a card, in the editor, and when a show is dropped onto Tonight. A private copy
in each is five chances for the console to disagree with the launch about what
a night contains — which is the console-and-projector disagreement this
codebase keeps recording, one step earlier.

#### No migration step, deliberately

Shows written before this exist, including on the host's live disk, with
`kind` and `packId` at the top level and no list at all. `itemsOf()` reads
both shapes and `normalise()` accepts both.

**A rewrite over everybody's shows file would be a one-shot script that either
runs or does not** — on a free tier whose disk is wiped on every deploy, where
"did the migration run on this instance" is a question with no good way to
answer it. Reading both shapes is a function, and a function cannot half-run.
The old shape stops appearing on its own as shows are re-saved.

The first item is also written at the top level on every save, derived rather
than duplicated, so everything written against the one-game shape keeps working
— including a console that has not been reloaded since the last deploy.

#### The bar plays one part and says what follows

`session.launch()` builds one game and the projector shows one game. So the
launch bar opens on the part you are about to play, and `paintThen()` names the
next one with a button that loads it.

**That is the honest shape rather than a compromise.** A combo night's bingo
starts when the quiz has finished, the scores are up and the prizes are handed
out — a moment only the person on the mic can identify. Auto-advancing would
take that decision off them, in front of a room, on the protected path.

The button LOADS rather than launches, for the same reason dropping a show in
does not launch: it fills the bar and leaves the finger on the button.

`showRunning` is cleared the moment somebody picks a pack by hand. A *"Then:
the bingo"* line left over from a show nobody is running is the console
describing a night that is not happening.

#### Swapping a part drops its running order

Changing the pack in a row clears that part's `order` rather than carrying the
round indexes across. Round 3 of the quiz you just swapped out is not round 3
of this one, and keeping the numbers would play a night nobody chose —
silently, because the indexes still fit.

#### A select per part, not a drag

Swapping one is choosing a different pack, which is what a select is for. And
HTML5 drag events are never delivered on touch, so a drag-only editor would not
exist on the device half this console is driven from — the same reason the
round ticks replaced dragging rounds between packs. The arrows do the ordering.

### THE MIXED-KIND NIGHT — quiz, a bingo interlude, quiz again, one score

Built on 20 August 2026 for a gig the following night, from the request in
those words: *"run a split quiz where the quiz is broken up by two music
bingos and the quiz prizes are only given out at the end."*

#### Why this was ever expensive

`Session` holds exactly ONE engine at a time, and `launch()` throws the old one
away unconditionally — `this.build(kind, normalised, null)`, state hardcoded
null. That is right for an ordinary night and wrong for this one: quiz → bingo
→ quiz means ending a game and starting another while the room, its teams and
its running score carry on, and nothing in the engine or the session had ever
had to do that.

**The fix touches NEITHER `engine.js` NOR `bingo.js`, and that is the whole
design.** The boundary between two parts is the same natural pause every night
already has:

- A composed quiz sits at `ROUND_BOARD` after its last round and does **not**
  advance to `FINAL` until `next()` is pressed again — see `isLastRound` in
  `engine.js`'s `next()`. Nothing had to be added; the pause already existed,
  the console simply never offered anything at that exact moment except the
  ordinary "Show the winner".
- Bingo sits at `WON`/`PLAYING` until the host explicitly presses Finish —
  `finish()` is never automatic, even after the last configured prize is won.

So an intermediate part simply never reaches its own real ending. The console
offers **"Continue to the bingo/quiz"** there instead of next/finish — a new
`Session.advanceOrder()` action, not a change to what makes a quiz or a bingo
game actually end. Which means, for free: an intermediate part is never
archived, a quiz part's prizes never go out early, and the true end — whichever
part is last — behaves exactly as an ordinary night's ending always has.

#### How the roster and the score actually carry

`Session.seedCarriedPlayers()`, called after the next part's engine is built.
For every player carried in: `this.engine.join({playerId, name})` on the FRESH
engine — reusing the real join path, so a bingo player gets a properly-dealt
card and a quiz player gets properly-initialised per-round fields — then two
fields `join()` cannot be told are patched directly onto the result:

- **The TOKEN.** `join()` always mints a fresh one for what it sees as a brand
  new player, which is right for an honest new phone and wrong here: this
  player already proved who they are earlier tonight, and a silently changed
  token is exactly the "phone that cannot prove itself" case rule 3 exists to
  stop — the phone's own stored token would stop matching and it would be
  treated as a stranger on its next request.
- **The SCORE, into a quiz part only.** Bingo has no equivalent to carry — a
  line or a house is its own separate prize, not points — so
  `Session.advanceOrder()` keeps the last known quiz tally in
  `this.carriedScores`, refreshed only when a QUIZ part is the one ending, and
  simply carries it forward unchanged through a bingo interlude that has
  nothing of its own to update it with. Written onto `engine.state` alongside
  the running-order plan itself, so a crash mid-interlude does not lose either.

#### The plan survives a restart the same way everything else on the night does

`state.runningOrder` (the parts) and `state.orderPos` (how far through) are
written onto the CURRENT part's engine state at every `startOrderSegment()` —
the same place the venue, the prizes and the look already live — so `boot()`
restores them exactly the way it restores those. No second recovery path, no
separate file.

#### Every pack in every part is loaded before ANY of them launches

`Session.launchRunningOrder()` calls `composeQuiz()` (for a quiz part) or the
bingo loader (for a bingo part) on EVERY part up front, throwing away the
result — purely to prove each one can actually be built. Without this, a pack
deleted between building tonight's order and pressing Launch would launch part
one happily and throw when the host reached part two hours later, in front of
the room. Found by testing the failure path directly, not assumed safe.

#### The lobby game re-resolves per part — do not carry it forward

Found by the live verification run before this shipped: a bingo interlude
showed Maze Mouth, the QUIZ default, instead of Rally. `nightWideOpts()` — the
function that reads what should stay true across every part (venue, prizes,
look…) off the part that is ending — was carrying `state.lobbyGame` forward
too, and `lobbyGameFor(kind, chosen, tier)` has no way to tell a *resolved
default* apart from an *explicit choice*: it only ever sees an id. So the quiz
part's own default became a permanent override the moment it reached the
bingo part. Fixed by leaving `lobbyGame` out of `nightWideOpts()` entirely, so
every part re-resolves to its own kind's default — exactly what "THE DEFAULT
FOLLOWS THE GAME" already promises for an ordinary launch.

#### Two ways to build one: a saved SHOW, and the Tonight row itself

**First built via a saved SHOW.** Composing a mixed night went via Workshop
→ Shows: `itemsOf(show)` already had the right shape (`{kind, packId,
order?}`), and the show editor already let a host "Add a bingo game" / "Add
a quiz" and reorder with arrows — built for a different reason months
earlier, and it turned out to already be the composing UI this needed.
Pressing Launch on part 0 of a 2+-item show calls `doLaunchOrder()` (in
`console-packs.js`, sharing the same 409-and-replace dance as an ordinary
launch via a new `sendLaunch()` helper) instead of an ordinary single-pack
launch; every later part loads through the control view's "Continue" button
and `/api/host/advanceOrder`, never back through the console.

**Then, the same day, the Tonight bar's own row learned to do it directly** —
asked for in exactly these words: *"you've got the rounds inside the quiz
pack that you can drag out of it into a second slot — you could either leave
three rounds inside the quiz pack, or drag round three out into another
slot."* The two `if (!packDrag || packDrag.kind === 'bingo') return;` guards
in `console-tonight.js`'s drop handlers are gone; a bingo pack can now join
an existing quiz night in the row, and a round is an individually draggable
numbered dot that can be pulled OUT of its pack tile into a new position.
See "THE MIXED ROW" below for how.

Both roads produce the same `segments` shape and go through the same
`session.launchRunningOrder()`/`advanceOrder()` backend — there is only ever
one way OUT, whichever way a host builds the night.

### THE MIXED ROW — a round pulled out of its pack, a bingo pack in the row

`public/assets/console-tonight-mix.js` (pure data, no DOM — tested directly
under plain Node, like `plans.test.js` tests its own browser module) and
`console-tonight-mix-ui.js` (the DOM/drag half, split out because the state
module reads `localStorage` at load and cannot be imported outside a
browser). `console-tonight.js` only holds the wiring that has to live inside
`launchBar()`'s own closure — `addPackToNight()`, the drop handlers,
`paintOrder()`'s branch to `paintMixedOrder()`.

**A SLOT is a pack's rounds (any subset) or a bingo game — never both.**
`{kind:'quiz', packId, rounds:[...]}` or `{kind:'bingo', packId, shape,
prizes}`. Two slots may name the SAME pack — that is exactly how "round 1
here, round 3 over there" is represented. **CONSECUTIVE quiz slots compile
into ONE segment**, whatever packs they name — the same "a run of quiz items
is one quiz" rule `composeQuiz()` already applies to an ordinary multi-pack
night, so two quiz slots with no bingo between them play straight through
with no "Continue" prompt. Only a bingo slot is a real break.

**`lbSlots` is `null` for every ordinary night**, exactly like `lbExtra`
being empty — the existing single-pack and multi-pack-quiz paths are
completely untouched, and `pub-unchanged.mjs` confirms byte-identical
payloads. Entered the moment a bingo pack joins the row or a round is
genuinely split apart; from then on it is the truth for what launches,
`lbExtra`/`lbOff` having stopped being updated.

**POSITIONS DO NOT SHIFT under a drag.** A slot left with no rounds becomes
an empty gap (`null`) IN PLACE rather than the list compacting round it — a
round dragged out from under slot 2 must not silently turn slot 3 into slot
2 while a thumb is still moving. Explicit removal (a slot's own × button)
is a different, deliberate act and DOES compact the list.

**TAP TOGGLES A ROUND OFF/ON — the touch fallback**, since HTML5 drag never
fires on a phone. An off round shows dimmed/red, same language `lbOff`'s own
ticks already use, and reappears in the pack's HOME slot (the first one
naming it) when tapped back on — never wherever else that pack might also
appear in the row, or a round would seem to belong to two places at once.
Repositioning WHICH slot a round plays in stays drag-only, the same
precedent whole-pack reordering already sets.

**EACH BINGO SLOT CARRIES ITS OWN PRIZE COUNT AND CARD SHAPE**, independent
of every other bingo interlude in the same night. Set on the pack-settings
row under the tiles — tap a tile to pick it — rather than on the tile: at
146px a pair of native selects clipped their own option text mid-word and
covered the area a drag starts from. The tile says what it is set to
("5×5 · 2 prizes"); the row is where it changes.

**BUGS LIVE VERIFICATION CAUGHT, ALL FIXED** — this started as two and kept
finding more, which is the argument for verifying live rather than trusting
the code, said once here rather than repeated at every entry below:

- **A bingo pack dropped on the EMPTY Tonight row launched as a quiz.**
  `addPackToNight()`'s "nothing chosen yet" branch called `pick()` without
  syncing the game-kind picker first, unlike every other entry point into
  that function — `pick()` derives its kind from the picker rather than
  trusting what it is handed. 400: file not found, quiz kind, bingo id.
- **Reordering packs by dragging one past another silently DELETED one of
  them — pre-existing, not new, found while testing the above.** `movePack()`
  computes the reordered `lbExtra` itself, then calls `pick()` to update
  which pack is "first" — and `pick()`'s own "a different pack means start
  the night again, wipe everything" rule fired on that call, overwriting the
  very `lbExtra` `movePack()` had just computed. `pick()` now takes a
  `keepOrder` option; `movePack()` passes it.
- **TILES WENT ON DISAPPEARING UNDER THE TOPBAR, AND DRAG DIED AFTER A
  COUPLE OF GOES — found live, some time later, on a real night's worth of
  packs.** `console-tonight.js`'s `dragging()` toggles a body class that pins
  the launch bar `position: sticky` for the length of a drag, and is meant to
  ALWAYS clear on `dragend` — a global `window` listener exists specifically
  because `dragend` "always fires on the source, whatever happened to the
  drop." That is true right up until the drop handler is the thing that
  removes the source from the document: dropping one Tonight tile onto
  another calls `commit()`, which rebuilds the WHOLE row via
  `replaceChildren` — synchronously, inside the `drop` handler, before the
  browser gets to dispatch `dragend`. A `dragend` whose source node has
  already left the document does not fire at all, so the class stuck, and
  the launch bar stayed sticky-pinned at whatever offset the LAST drag
  happened to start at, for good — which reads as tiles vanishing under the
  topbar on an ordinary scroll, and as drag "dying" once the bar stopped
  tracking the page. Fixed by calling `dragging(false)` explicitly, in both
  of `wireDropTarget`'s and `wireSlotDrag`'s own `drop` handlers, BEFORE
  `commit()` rebuilds the row — costs nothing on the runs where `dragend`
  still fires (a plain idempotent toggle), fixes the runs where it does not.
  Verified live by deliberately reproducing the worst case — dispatching a
  drop with `dragend` suppressed on purpose — across five successive drags:
  the class cleared every time, every tile stayed fully visible.
- **A BINGO TILE COULD NOT BE DRAGGED AT ALL — a genuinely different bug,
  found live by a diagnostic agent while chasing the one above.** Its own two
  `<select>`s (card shape, prize plan) sit in one unbroken row spanning
  roughly 99% of the tile's width and 26% of its height — almost the entire
  lower half, exactly where a hand reaches for a card. A native `<select>`
  intercepts a mousedown for its own dropdown before any HTML5 drag gesture
  can begin, which is a hard browser behaviour that no `stopPropagation`
  reaches, so nothing under the title was ever going to be a drag start point
  on one. Fixed the same way the pack editor's own round/question rows
  already solve this exact conflict — a small `.drag-grip` (the same icon,
  the same class) placed in the title's own row, in normal document flow
  rather than floated over the top corner, so it never has to guess how much
  blank space a two-line title left. Given to EVERY tile, quiz and bingo
  alike, rather than only the ones that needed it — one rule instead of
  "quiz tiles grab anywhere, bingo tiles grab here." Verified live: a real
  mousedown on the grip reaches `dragstart`; the identical gesture on the
  `<select>` never does.
- **DRAGGING TILE 1 ONTO TILE 3 DID NOT SWAP THEM — reported live, in his own
  words: "pack 1 goes to tile 3, tile 3 goes to tile 2 and tile 2 goes to
  tile 1."** `moveSlot()` was an insert-and-shift, `list.splice(from,1)` then
  re-inserted at `to` — the standard reorder-a-list move, and the SAME move as
  a swap when the two tiles are adjacent, which is exactly why the adjacent
  case had already tested clean. Once they are not adjacent the two diverge:
  a shift drags everything BETWEEN the two dragged tiles along by one, so
  tile 3 ends up with what had been tile 2, never with tile 1. **A numbered
  tile reads as a fixed slot, not a list item**, so the fix is a genuine
  `swapSlots(slots, i, j)` — `[list[i], list[j]] = [list[j], list[i]]` — and
  nothing else moves. The ordinary (non-mixed) Tonight row and the pack
  editor's own round/question lists keep the old insert-and-shift
  deliberately: those are genuinely reorderable LISTS, not a fixed set of
  numbered positions, so they are not the same interaction and were not
  changed. Verified live: dragging tile 1 onto tile 3 now leaves tile 2
  completely untouched, both for a fresh drag and immediately after another
  swap, with no console errors.

**A SINGLE ROUND CAN NOW BE DRAGGED STRAIGHT OFF THE SHELF, never the whole
pack.** Asked for directly. Every quiz pack's shelf card (`packCard()` in
`console-packs.js`) grew its own small row of numbered, individually
draggable round dots — the same `.lb-rd` pill already used everywhere else a
round is shown, so a round looks the same wherever it is drawn. Bingo cards
get none (bingo has no rounds); the compact/"dense" grid hides the row too,
the same trade it already makes for the size/play-count line, because a
search across eighty packs is asking to see more packs, not more to grab.

- **A NEW PIECE OF SHARED DRAG STATE, `shelfRoundDrag` in
  `console-state.js`** — `{packId, round, title}` — kept separate from
  `packDrag` rather than folded into it: a whole pack lands anywhere on
  Tonight and adds every round, a single round has to land on one slot and
  only ever adds that one, which is two different shapes of drop rather than
  one value that means something different depending on a field inside it.
- **LANDING ON ONE SPECIFIC TILE REUSES `moveRoundToSlot()` UNCHANGED** — the
  exact function a round dragged BETWEEN tiles already in Tonight uses, since
  a round arriving from the shelf has never been placed anywhere, so its
  "clear it from wherever else it sat" pass is simply a no-op. The same
  refusal rules apply for free: a slot already holding a different pack, or a
  bingo game, is left alone rather than mixed.
- **LANDING ANYWHERE ELSE ON TONIGHT CALLS A NEW `addRoundToNight()`.** With
  nothing chosen yet, this is what STARTS the night — `pick()` runs first,
  exactly `addPackToNight()`'s existing "nothing chosen yet" branch, for the
  title, the venue defaults and the Launch button — and then `lbSlots` is set
  DIRECTLY to just the one round rather than through `slotsFromSimple()`,
  which would otherwise bring in every other round of that pack too: dragging
  round 2 on its own must not quietly bring rounds 1 and 3 with it. With
  something already chosen, it converts to the mixed row if not there
  already and appends the round as a new trailing slot.
- **A LATENT BUG FOUND ON THE WAY, FIXED BEFORE IT COULD BITE**:
  `slotsFromSimple()` mapped every pack to `kind: 'quiz'` unconditionally,
  which is right for `lbExtra` (quiz-pack ids only, always) but wrong for
  `currentPack` if the ordinary night in progress was actually BINGO — a
  bingo pack has no `.rounds` at all, by design, so the result was a
  `{kind:'quiz', rounds: []}` slot standing in for the real game. Unreachable
  before this feature (nothing else converted an ordinary BINGO night to the
  mixed row from a bare `currentPack`), reachable now: drag a quiz round onto
  Tonight while an ordinary bingo night is chosen, and this is exactly the
  conversion that runs. Fixed by checking `Array.isArray(currentPack.rounds)`
  first and emitting a real `{kind:'bingo', ...}` slot when it is not.
- **VERIFIED LIVE, THREE CASES**: dragging a round onto an empty Tonight
  starts the night with just that round, none of its siblings; dragging a
  different round directly onto an existing tile merges into it without
  touching any other tile; dragging a round onto a tile holding a different
  pack is silently refused, byte-identical state before and after.

#### Fixed on 20 August 2026: the archived record now keeps every part

Was: a mixed night's Past gigs entry read as if it were just the closing part
— score, prizes and timing were all correct, but the earlier quiz part and any
bingo interlude left no trace in the filed record.

`archiveResults()` only ever sees `engine.results()`, which knows about
whichever engine is `this.engine` the instant the night truly ends — the last
part, and only the last part. `Session.describeOrderParts(this.runningOrder)`
closes the gap by resolving **every** segment fresh at archive time (bingo via
`LAUNCHERS.bingo.load()`, quiz via `composeQuiz()` — the same loaders the
night itself used to launch each part), rather than trusting anything cached
from when a part launched. A pack deleted mid-evening is named as missing
(`{ title: null }`) rather than dropped from the list or thrown.

The result rides as `parts` on the archived record — absent entirely on an
ordinary single-game night, so nothing about a normal filed night changes.
Two more places had to be taught to carry it rather than drop it, because both
build a picked SUBSET of the record rather than spreading it, on purpose (rule
1's whitelist reasoning, applied to a filed night instead of a live payload):
`listArchive()` in `library.js`, and `mergeGigs()` in `past-gigs.js`, which is
where a running-order night's several archived-looking parts collapse to the
ONE record it actually is (only the last part ever reaches FINAL/FINISHED, so
only one file is ever written). `console-gigs.js`'s `gameLabel()` then joins
`parts` with "→" wherever a game's title is shown, collapsed row and expanded
view alike, falling back to the plain single title when there is no `parts`
at all.

#### Verified live, in real browsers, before this shipped

Two real "phones" (separate browser contexts, so `localStorage` could not be
shared between them), a real 3-part night driven end to end: identity and
token unchanged across both switches with no rejoin prompt, the score additive
across the interruption (760 after part one, 1520 at the true final), no
premature archiving, no host-only field ever reaching the projector's payload,
zero console errors. Caught the lobby-game bug above, which no unit test would
have — nothing short of watching a real bingo lobby render was going to show
Maze Mouth where Rally belonged.
