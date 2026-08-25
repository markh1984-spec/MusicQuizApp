# History — where the app has got to, and what each night found

The reasoning behind the history rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## Current state

**Also live on 24 August 2026 — the settings row stopped moving:**

Three asks off one screenshot: *"if we can have the drop down menus actually
fill the space there instead of the arrows appearing sort of half way"*,
*"'look' needs to say 'appearance'"*, and *"also would be good if those
dropdowns don't change size at all regardless of what's selected."*

The third corrects the worse half of this bar's own oldest rule. Sizing a face
to the CURRENT value was a real saving on the open MENU and a moving target on
the closed FACE — choose Halloween and every control to the right of Look
shifted. **Every option's short name is now drawn into the same grid cell and
all but the chosen one is `visibility: hidden`**, so the browser reserves the
width: no measuring, no font guessing, and nothing to keep in step when a pack
changes what the options are. Verified by walking every option of every picker
through a real `change` and watching the cell width — one value each.

Two consequences, both improvements: a face that reserves its widest option
pays for it every night, so **"Summer — in season now" and the two team modes
got `data-short`**, and **the pack is named on the first of Card/Prizes rather
than on both** — 286px spent saying one thing twice. `flex-shrink` could not
keep the row on one line on its own, because **a wrapping flex row wraps first
and shrinks per line afterwards**; `flex-wrap: nowrap` above 1150px is what
lets the shrink work, with headings ellipsising rather than wrapping.

**"Look" is "Appearance"** — both name the same thing and only one is a noun on
sight. And **the Secs per Q arrows move by five**: nobody has ever wanted
twenty-one seconds a question, and twelve presses to get from 20 to 30 makes
the arrows decoration. Typing still takes any number in range — nothing calls
`checkValidity()` and the field is in no form.

**The first press then still gave 5**, reported straight back, because the 20
on that field is a PLACEHOLDER and a browser steps an empty number input to its
`min` — both arrows gave 5, which is the tell that nothing was being stepped.
**Blank is not nothing**, so the fix is not prefilling 20: an empty field means
*leave each quiz at its own pace*, and writing 20 over that would override a
pack author's choice on every night. The field seeds itself with the number it
is already SHOWING at the moment somebody deliberately reaches for it — a
`pointerdown`, or an arrow key — and never on a tab through. Measured with a
real mouse on the real spinner: 25 up, 30 on the next, 15 down, and the launch
sends 25 on the wire. `state.questionSeconds` had no unit test until this gave
it a reason to; all three rungs of its fallback are pinned now.

**Live as of 24 August 2026 — the hole in slot 2, and three faults under one
sentence:**

Reported off a screenshot of a real running order — a bingo game, an empty
slot, another bingo game, a quiz — as *"now I can't drag into slot 2 as an
empty slot?"* None of the three threw, and the first two left the console
describing a night it was not going to launch.

- **A descriptor is not the thing it describes.** `packDrag` is `{ id, kind }`
  — what is in flight — and the empty slot's own drop handed it to
  `addPackToNight()` as though it were the pack. With no `rounds` on it,
  `addQuizPackSlot()` found nothing to place and returned the row unchanged:
  the slot lit up, the drop was accepted, and nothing appeared. A bingo slot
  needs only the id, which is why it read as an intermittent fault. Every
  other call site already resolved through `packOnShelf()`.
- **A kind that disagrees with the night's own is a mixed night.** The test
  was `kind === 'bingo' || lbSlots`, so a quiz pack added to a bingo night
  took the ordinary path into `lbExtra` — ids that `packOf()` resolves against
  `gameOf()` alone, so it could never be found again. `lbPacks()` filtered it
  straight back out, the row kept showing one tile and Launch kept naming the
  bingo. **The state was perfectly self-consistent; it was the reader that
  could not resolve it**, which is the shape no test catches.
- **The shelf ghosting never survived a tab change.** `paintInTonight()`
  walked the document at the end of every paint — but `render()` assembles the
  page OFF the document, so it found the previous page's cards. A card asks
  for itself now (`packIsInTonight()`, called by `packCard()` as it builds),
  and the duplicate check stopped refusing drops the card said were free.

Verified with real mouse drags in a real browser, on his exact layout: all
four things you can drop into a hole — a bingo pack card, a quiz pack card, a
round off the shelf and a round out of a tile — now land in the slot they were
aimed at, and a mixed night launched to a projector afterwards. `npm test`
1,516 green, `pub-unchanged` IDENTICAL, `drag-check` clean.

**The budgets were paid rather than raised where there was a seam:** the break
plumbing (`doorsSlot`, `screenOfPlan`, `setGaps`, `breakSetFor`) moved out of
`console-tonight.js` into `console-breaks.js` behind `breakPlumbing()`, and
the drag reasoning moved out of `docs/console/launch-bar.md` into
`docs/console/drag.md` when that file crossed its cap.

**Live as of 24 August 2026 — the pack tiles tidied up, and the doors moved
into the running order:**

Reported off a screenshot — *"we're getting there - think the top left numbers
can go once there's a pack in the slot and there's a slight overlap with the
cross and the game selector"* — then three more in the same sitting. Every one
was MEASURED before it was changed, and one was a fault nobody had reported.

- **The slot number goes when a pack lands in it**, measured overlapping the
  title by 18 x 8px. It stays on an EMPTY slot, where it is the whole label —
  "Add pack 3" is what says where a dragged card would land; on a full slot the
  order is already visible from position.
- **The tile is 90px because 30 + 44 does not fit in 76.** The × overlapped the
  gap dial by 28 x 12px. Moving the × to the top left puts "remove this" where
  the eye lands first; moving the dial undoes what was asked for. Nothing
  moves — the tile grew instead, and the row is one line.
- **A TILE IS NOT A PART, and half the row had no dial.** Not reported, found
  while measuring: several quiz packs weld into ONE quiz, so tile 1's dial
  silently owned every gap in the evening and tile 2 had none at all. Nothing
  threw; the second tile just had an empty corner. `gapsOfPack()` reads the
  part's `order`, where the gap after round *i* belongs to whichever pack
  contributed it.
- **The era word is gone from a Tonight tile.** Shifting it left of the dial
  was tried and measured — it then overlapped the round ticks by 52 x 18px.
  There is no third place, so the decoration goes; the wash and the coloured
  edge still carry the subject, and the word stays on the shelf card.
- **`:has()` out-specified the phone layout.** `.lb-tiles:has(.lb-doors-slot)`
  is more specific than `.lb-tiles`, so it beat the 560px rule from outside the
  media query: 390 came out as four ~50px columns with the dial wider than its
  tile. The same specificity trap as the `border` shorthand on the pack tile,
  wearing `:has()`. Nothing throws — the phone just gets the laptop's grid.

**THE DOORS ARE A MINI SLOT AT THE HEAD OF THE ROW** — *"a little mini pack
slot at the start of the packs to define what shows on big and phone screens
pre-launch."* Same argument every other dial won: a gap is drawn on the thing
it follows, and the doors follow nothing, so they belong at position zero of
the running order rather than up in the head. Half width, no number, never a
drop target. **The big screen half is deliberately NOT built**: the lobby's
projector is the join code and nothing in this app may dim it, so offering a
screen setting there means first deciding what an advert does beside a join
code — a change to the protected surface rather than a control to add.

**THE BINGO CARD/PRIZES ROW LEFT THE BAND ABOVE LAUNCH** — *"music bingo breaks
the rule of having nothing between launch button and packs."* It sits above the
running order now rather than floating under its own tile, and that is a SAFETY
call: a sheet there would cover Launch. And it is **present and greyed, never
absent** — *"maybe just have a section for it pre-loaded and greyed out"* —
which reverses an exception carved out for this row days earlier. The app's own
rule wins: a control that comes and goes is one you cannot learn the position
of. The caption carries the reason it is off, and the pickers get a `—`
placeholder, because an empty select reads as failed rather than waiting.

**AND THREE MORE OFF THE SAME BAR, same day:**

- **A REAL BUG: *"added a bingo game and the bingo section is greyed out."***
  The Card/Prizes row keyed off the PICKED tile, so with the quiz picked it
  told him to add a thing already on the screen. `bingoToSet()` serves the
  picked pack when that IS a bingo and otherwise the first one in the order —
  and **the three WRITES had to move with the read**, or the row would have
  shown one pack's card and saved it onto another, on the path Launch reads.
- **📵 rather than a dot** for "nothing on the phones", asked outright — *"what
  does this mean? the . ?"* That question IS the answer: a control that needs
  explaining is wrong, and the other three states are pictures. Punctuation on
  a button reads as a control that failed to load.
- **The round ticks are rounded squares at 28px with a hover you can see.**
  The old hover was `filter: brightness(1.25)` on a faint 22px dot — a change
  you cannot find with a mouse. It lifts, rings in the account colour and casts
  a shadow now, in both renderers. A four-round pack wraps to two rows, which
  is free: the grid stretches every tile to the tallest.

**AND THE DRAG THAT NEVER WORKED ON A PLAIN QUIZ NIGHT:** *"I still can't drag
a round onto a fresh slot — it seems to default to dragging the entire pack.
Can we have it so the pack is dragged from the top and the rounds are dragged
from the squares they occupy?"*

It was doing exactly that, and the cause is one line of HTML: a drag starts on
the nearest DRAGGABLE ANCESTOR, and an ordinary row's round tick carried a
`mousedown` and a `click` and nothing else — so the browser walked past it to
the tile. The mixed row had been right all along, which is why it only bit on a
night with no bingo game in it.

**A `draggable` child stops the walk**, and the tile now REFUSES a `dragstart`
that did not begin on `.lb-tile-head` — the smallest drag handle there is, with
no flag to arm and disarm. The ordinary tile had no head at all while the mixed
one had a grip; it gained the same one, so the grip finally points at the only
place a pack lifts from.

**And a child's `dragend` bubbles into the tile's, which removes the pack** —
so dragging a round out took the whole pack with it and emptied Tonight. Found
by driving it rather than reading it. The round's own drag travels the SHELF's
channel deliberately: `moveRoundToSlot()` takes a round out of wherever it sits
before placing it, so one already in Tonight moves rather than duplicating.

Proved with real drag events in both renderers: a round out of a four-round
pack leaves three and puts one in its own slot; the tile refuses its face and
accepts its grip; reordering, dragging a pack out and clicking a tick off all
still work.

**AND AN EMPTY SLOT NOW TAKES A ROUND AND SAYS SO:** *"it looks as though it
won't drag to another slot unless there is a pack there."* Two faults at once —
an empty slot in the ordinary row had no `dragover` of its own, so nothing lit
up as the cursor crossed it, and `orderEl`'s drop APPENDS, so a round let go
over slot 5 turned up in slot 2. Each slot now lights with the same
`.drop-here` the mixed row already used and places the round at ITS index.

**The test from the round before had said this already worked, and it was
measuring the wrong thing.** It dispatched `drop` on the target directly — and
a browser fires no `drop` at all unless `dragover` called `preventDefault()`.
The honest probe is `defaultPrevented` on the dragover plus where the round
actually lands. Same family as every other entry here: a synthetic event that
skips the browser's own precondition is not running the artefact.

**AND A PACK TILE LIGHTS UP TOO, only where the drop will be taken:** *"can we
make it so the pack being dragged to has a slight highlight effect."* The rule
that matters is not the glow but what it promises — `moveRoundToSlot()` refuses
a bingo game or a DIFFERENT pack, so the highlight asks exactly the question the
drop asks and a tile that would refuse stays dark. A refusal STOPS the event
too, or it bubbles to the row and the round lands where the pointer never was.

**Two wirings on one tile raced to set the same class.** A filled mixed tile
gets both `wireSlotDrag` and `wireDropTarget`; putting the round branch in both
meant the listener registered LAST won, which is how a bingo tile lit up for a
round it would refuse. One handler decides now and the other stands down.

**And the inset ring was invisible where it mattered** — the picked tile
already wears a full outline in the same colour, so on the tile you are most
likely to be dragging within, "accepting" and "picked" were one picture. It
takes a wash and a lift as well now.

**AND EVERY NIGHT SETTING IS ON ONE ROW NOW:** *"can we have all of these on
the same lines, and also line up the headings with the boxes — it's ok for the
boxes to be wider than the headings but when the headings are wider than the
boxes it looks messy."*

The labels already sat above their controls so a cell comes out as wide as the
WIDER of the two. What was wrong was `justify-items: start`, which left the
narrower of the pair floating in the space the wider one made — "SECS PER Q"
over a two-digit box. `stretch` makes the BOX the wider one every time, and it
does not undo *narrow shut, wide open*: the cell is still only as wide as the
longer of the value and the word above it.

**Card and Prizes joined that row and their own row is gone.** Both needed
`data-short` first — with the full option text on the face, Card was 303px and
pushed the row onto a second line by itself. It reads "5×5" shut and the whole
sentence open. The caption that used to name the pack went with the row, so the
reason a control is off moved INTO the control ("Add a bingo game"), and the
pack's name rejoins the label only when a night holds two bingo games.

One row at 1400 and 1280, four at 390, and a launch made through the popovers
still sends `shape: {rows:3, cols:3}` and `prizes: 1` — the skin never held the
value, so shortening its face could not change what Launch reads.

**AND A WHOLE PACK LANDS IN THE SLOT IT WAS DROPPED ON:** *"I tried dragging
the music bingo onto slot 2 and it populated on slot 4 instead."* The rounds
bug again, one function along and the third sighting of the shape in a week —
the slot lit up and accepted, then `addBingoSlot()` appended and never read the
index it had been handed.

`placeAt()` answers it for both adders, and three lines of it were decisions:
`at` is honoured only when that slot is genuinely EMPTY (dropping onto a full
tile appends rather than overwriting — a slot you can destroy by letting go
over it is a hazard); the list widens with nulls so positions do not shift; and
**no target still means "the next free slot"**, a promise that had quietly gone
untrue, because with holes in the row that is the first hole rather than the end
of the array.

**AND THEN THE PACK DRAGS STOPPED STICKING, from one line that looked like
housekeeping.** Giving the empty slots their own `dragover` set
`dropEffect = 'move'` — but a pack CARD starts its drag with
`effectAllowed = 'copy'`, and a `dropEffect` the source did not allow makes the
browser treat the target as REFUSING, so **no `drop` fires at all**. Rounds kept
working because their `effectAllowed` happened to match. Every pack drop onto a
slot was dead.

**A synthesised `DragEvent` enforces none of the browser's preconditions**, and
this bar has now been bitten by two in three days: no drop without
`preventDefault()` on the dragover, and no drop with an effect the source
forbids. So `scripts/drag-check.mjs` exists — its own server, its own port, a
real Chromium and real mouse drags, asserting the running order's shape after
each. It cannot live in `npm test` (no dependencies here; Playwright is a
container tool), so it sits beside `pub-unchanged.mjs` as a thing you run after
touching a drag handler. **Verified by reintroducing the fault.**

Its own first draft grabbed the card it had just placed — a pack in the running
order stays on the shelf as a ghost and is deliberately refused a second time —
so it was measuring that refusal rather than the drop. A guard aimed at the
wrong element proves nothing.

Verified at 1400, 1280 and 390: no overflow, no console errors, no overlaps
anywhere, and nothing between the running order and Launch.


**Live as of 24 August 2026 — the Community door now holds the people:**

*"Photos can actually migrate to community as well now, and anything else to do
with the people who do the quizzing — ask me as many questions as you need to
get this right."* Four questions, four answers, each now a rule.

**BY VENUE, BECAUSE A VENUE IS A COMMUNITY.** The Tuesday crowd and the
Thursday crowd are different people; a league was already per venue, and
grouping the photographs the same way makes every page on this door something
you can show one landlord.

**THE PHOTOS MOVED AND PAST GIGS KEPT ITS GRID — not a duplicate.** The same
pictures do two jobs: there a photo is EVIDENCE, beside the headcount, the
winner and the report; here it is the room itself. Moving them off Past gigs
entirely was the alternative and would have put you two doors from the pictures
while writing the report built out of them. **What is not duplicated is the
code** — the strip, the bin and its confirm wording, the "Screen only" badge
and the publish control are `nightPhotos()`, extracted out of
`fillNightDetail()` and called from both. The publish safeguard survives for
free: the control is drawn UNDER the photographs it would publish wherever it
is called, so "nobody publishes a night without having just looked at what is
in it" needed no restating.

**A READ-ONLY SUMMARY MAY REPEAT; A QUEUE MAY NOT.** That is the line, and it
decided both halves. The headcount is a summary, so it joins the head of each
league panel — the landlord's two questions together — and still sits on a
venue card and a Past gigs card, all from one server-side figure that cannot
disagree with itself. **"What the room asked for" is a queue — Yes keeps it, No
bins it — so it MOVED off the Music Quiz tab** rather than being copied, leaving
a one-line link that is silent unless something is waiting.

**`asksPanel({ whenEmpty })` — one panel, two pages, two right answers.**
Drawing nothing was correct above the quiz generator and is wrong on a tab whose
whole job is that list: a blank page reads as broken to the person checking
whether the feature works, and "nothing here" has two causes because the switch
is off unless somebody turns it on. The empty state says which and links to the
switch.

**IT IS YOURS ONLY, FOR NOW.** A room-facing page per venue — the table on a
wall, a link the regulars check between nights — was offered and deliberately
parked: a new public surface with its own questions about faces and team names.
Nothing built here blocks it. The only public thing is still the gallery link.

**Not moved:** the "that one's wrong" reports, which are owner-facing — a
quizmaster never sees what their own room reported, and a half-built pipeline
on a new door would be furniture.

Verified in a real browser at 1280 and 390 on all five doors: no overflow, no
console errors, the strip drawing five photos with five bins, the Screen-only
badge and the publish control under them. **The photo BYTES were stubbed and
nothing else was** — photos live in a separate private repository that needs
`GITHUB_TOKEN`, which the build container has not got, so `hasPhotos` is false
for every night there; the two routes were answered with real-shaped payloads
and every line of grouping, rendering, binning and publishing exercised was the
app's own.


**Live as of 23 August 2026 — what happens in the gaps is a dial on the pack,
and there is a fifth door:**

The break strip lasted one day. Reported off a screenshot: *"'doors' and
'after round 1' both fill the same function, don't really need both — and the
after round 1 needs to perhaps be a little dropdown on a per slot basis."*

**THE DUPLICATION WAS REAL.** Doors sat in the head and every other gap sat in
a strip, drawn by the same `chip()` from the same plan, opening the same
setter — one control in two places, neither beside the thing it acted on.
That is the label collision Sweep mode is told to hunt and that no test, no
500 and no visual defect will ever show.

**"AT THE END OF THAT SLOT" WAS RIGHT WITH ONE CORRECTION**, and it decided the
shape: a gap is NOT at the end of a slot. A two-round quiz owns the gap inside
it as well as the one at its end, so a control meaning "the end of this slot"
can only address a pack's last gap. A tile's corner owns *every gap that pack
creates*, and one dial sets them together — said out loud rather than hidden.

**THE TILE'S SIZE DECIDED EVERYTHING ELSE, AND IT WAS MEASURED FIRST.** A tile
is 179 x 76, its round ticks are 22px along the bottom-left, and a four-round
pack leaves exactly **58px** clear in the corner. That is ONE 44px control —
the touch floor — and never two. So the dial is the PHONES (which genuinely
differ pack to pack: a game before the bingo, photos between quiz rounds) and
the big screen became a night-level picker in the settings row, because *"show
my adverts in the breaks"* is the venue paying for a screen, which is a fact
about the evening. **The plan on disk did not change at all** — the picker
writes the same `screen` to every gap that has one, so `break-parts.js`, the
engine and the projector are untouched and `pub-unchanged` still says
IDENTICAL.

**A DIAL RATHER THAN A MENU, asked for in those words**, and it is safe here in
a way cycling controls usually are not: every state is a real answer, so there
is no invalid position to spin past, and the order is a SCALE — photos, the
game, both, nothing — rather than an enum to memorise. The lit "you changed
this" edge had to be made honest to go with it: `cleanPlan()` now runs on the
way OUT of the dial, so a gap cycled back to its default stops claiming it was
changed.

**The strip, the chip, the setter and the doors chip are all deleted** —
`console-breaks.js` went 234 lines to 195 — and the bar is **59px shorter** on
every night. The era word moved 52px left, which is two deliberate rules
colliding: *a pack wears its own subject* put it in that corner on purpose, and
**the control wins while the decoration moves** rather than being dropped.

**AND A LOST `import` DREW A LAUNCH BAR WITH NO DIALS ON IT WHILE EVERY CHECK
PASSED.** A scripted header rewrite of `console-breaks.js` replaced everything
above the first `import` — and the first import was `{ esc, node }`. Four
`ReferenceError`s swallowed by the paint, `node --check` happy, the full suite
green, and nothing on screen to say a control was missing. **That is the same
fault that shipped a broken Launch to the live app**, only quieter.
`test/imports-present.test.js` closes it: every browser module that CALLS a
shared helper must import or declare it. Verified by deleting the import again
and watching `node --check` pass while the test failed.

**THE FIFTH DOOR IS COMMUNITY**, asked for the same evening: *"a fifth menu
pill at the top entitled 'community', which is for things like quiz leagues,
and all the controls for that functionality will live there."* It goes fourth
in the row and My account stays last. A league belongs to the ROOM over a
season rather than to the quizmaster on a night, which is exactly why it fitted
under none of the other four and had been living as a block on a venue card —
one venue at a time, behind the Workshop door, found only by going looking.
**Nothing new is collected or stored**: `src/league.js` has built these tables
out of the archive all along and `library.leagues` was already in the payload.
The bay says how many seasons are running and who leads each; the tab holds
every venue's table in full. Built to the same shape as the other four —
bay, sub-menu column, main section — and checked at 1280 and 390 on all five
doors with no overflow and no console errors.

**`docs/console.md` crossed its 100,000-byte cap and was split** on a real
subject boundary: the launch bar's half is `docs/console/launch-bar.md`,
moved whole by line number with nothing retyped.


**Live as of 23 August 2026 — the launch bar's dropdowns are narrow shut and
wide open:**

Five space savings asked for in one message, and four of them were only
possible because of the fifth: *"the venue dropdown box and all dropdown boxes
on the bay must popover… 'look — the usual' needs to only be as wide as the
pre-filled value, popovers can pop out wider but we need to save space."*

**A NATIVE `<select>` CANNOT BE NARROW AND WIDE AT THE SAME TIME.** A browser
sizes the open list to the control, so a select narrow enough to say "The
usual" opens a list that clips "Halloween — in season now" — and the bar was
paying for its longest option on all five pickers, on every night, whether or
not anybody ever opened one. They were 215px each; the values in them are 66px
to 142px.

**`console-pick.js` IS A SKIN, AND THE REAL SELECT STAYS THE TRUTH.** It draws
a button and a floating menu beside the native control and does nothing else,
so every `.value` read, every `innerHTML` rebuild and every `change` listener
goes on working and **the launch reads exactly what it always read**. That is a
decision about the protected surface, not a shortcut: five of the fields the
launch payload is built from live on this bar, and a skin over the real control
cannot lose a value because it never holds one. Choosing an option has to fire
a real `change` by hand — setting `.value` from script fires nothing, and
without it the picker would look like it worked while the launch sent the value
from before.

**THE FACE SHOWS THE SHORT NAME AND THE MENU SHOWS THE WHOLE THING**, which is
how the explainer the host asked to delete survived: "👻 Maze Mouth" shut,
"👻 Maze Mouth — a maze chase" open. It moved to the moment you are actually
choosing, which is the only moment it was ever any use. Which way a menu opens
is MEASURED on open, or the rightmost one hangs off the side of the console.

**THE VENUE SHEET NOW FLOATS**, so the bar is the same height open and shut —
and both faults that caused were structural and silent. The move left
`.lb-what` unclosed and an orphan `</div>` behind, and the head row collapsed
with the venue button, Save and the mode switch drawn on top of one another;
`node --check` is happy, because a template literal holding broken HTML is a
perfectly good string. Then the floating sheet swallowed clicks on the settings
underneath it, which Playwright named outright. `test/markup-balance.test.js`
counts `<div>` against `</div>` in the `launchBar()` template — the markup's
half of what `style-structure.test.js` does for braces, written the same day
for the same reason. **A whole-file sweep was tried first and turned down**:
this app builds markup out of concatenated fragments, so `console-venues.js`
comes out nine divs short and is completely correct, and a test needing a
growing list of exceptions has stopped being a test.

Also in the same pass: *"add a pack…"* on the keep button is now just **Save**
with the reason on its tooltip, *"While they wait"* is **Game**, and *"Seconds
per question"* is **Secs per Q** in a 72px box.

**Proved rather than looked at:** a launch made entirely through the new
pickers — every value chosen by clicking a popover, nothing set by script —
sent `lobbyGame=rally lobbySound=false teamMode=random teamPlay=true
seconds=35`. 1,515 tests green and `pub-unchanged` IDENTICAL.


**FIXED, same day — Tonight's six pack slots were showing as ONE, and it was
a stray brace in the stylesheet:**

Reported twice — *"why is it loading like this?"*, then *"still there"* after
a redeploy proved it was not a cache. The markup was right, the JavaScript was
right, and six `<button>`s were in the DOM.

**A SCRIPTED EDIT TO `style.css` USED `s.index(needle)` WITH NO START
OFFSET**, matched an earlier occurrence than intended, and
`s[:start] + new + s[end:]` with `end` before `start` DUPLICATED everything
between them — including the closing brace of a `@media (max-width: 560px)`
block. The media query then ended early, and the phone-only rule inside it
(`.lb-drop ~ .lb-drop { display: none }`, which leaves exactly one "add a
pack" affordance) started applying at every width. CSS throws nothing for
this; it re-scopes silently from the stray brace onwards. The duplicate also
left the OLD `.lb-say` block after the new one, where it won on cascade order.

**AND THE VERIFICATION FAILED IN THE MOST INSTRUCTIVE WAY POSSIBLE.** It was
checked in a real browser, twice, at four widths — and the check counted
`.lb-tile` ELEMENTS, which `display: none` elements still are. Six came back
every time while the screen showed one. **Measure `getClientRects()`, not
`querySelectorAll().length`.** "It is in the document" and "somebody can see
it" are different questions, and this project has now been bitten by that
distinction three times: the arcade board that was computed and never drawn,
the publish route that worked and had no caller, and this.

`test/style-structure.test.js` closes the hole `browser-parses.test.js` left:
brace balance per stylesheet, no `@media` nested inside another block, and the
escaped rule named explicitly so a balanced-but-misplaced copy is caught too.
Verified by reintroducing both faults and watching it fail.

**Live as of 23 August 2026, same day again — three ways to play a night:**

*"Can we make the phones say 'individual, team random and team assigned' —
there may be some nights where people play as a team and other nights it's
just more fun to be random."* Two of the three already existed and had no
names of their own: the bar offered *"One phone each"* and *"Teams — several
phones, scores averaged"*, which describes the engine rather than the choice.

**`teamPlay` STAYS A BOOLEAN AND STAYS THE GATE.** Six places in the engine
read it and every one asks "is this a team night", which is true of both team
modes — so the mode sits beside it in `state.teamMode` rather than replacing
it, and a solo night keeps the path it has always had. The console holds the
opposite arrangement for the same reason: ONE field, with both launch fields
derived at the moment of sending, so a dropdown and a launch cannot disagree.

**DEALT AT JOIN, AND NOBODY IS EVER MOVED** — re-dealing mid-night takes a
score away from the people somebody has been sitting with, and re-dealing at
kick-off means the team you were told at the door is not the one you end on.
The teams GROW WITH THE ROOM (smallest wins, ties broken at random, four to a
team, six teams max), because nobody knows at launch how many will turn up.
**A team of one is not unfair** — scores are averaged — which is what makes
the lopsided moment acceptable and is why no shuffle is needed.

Proven live with eleven real phones joining one at a time: told Reds, Reds,
Reds, Reds, Blues, Blues, Blues, Blues, Greens, Greens, Greens — 4/4/3.
Individual draws no team card at all, "they pick their own" draws the picker,
and a dealt phone gets a statement it cannot argue with. `pub-unchanged`
IDENTICAL, 1,511 tests green.

**Live as of 23 August 2026, same day again — the band above Launch is clear
and the head holds the whole night:**

*"The doors button and the 'on the big screen now' and unlaunch buttons can
all go right at the top to save space… can we also standardise the buttons to
look the same"*, then *"either way that space between packs and launch button
needs to be clear, space is at a premium."*

**THE HEAD NOW HOLDS EVERY QUESTION THAT IS TRUE OF THE EVENING** rather than
of a pack — and Doors going up there is the coherent split rather than merely
the tidier one: `p0:lobby` is the gap BEFORE the night starts. Every other
break, including a later part's own lobby, happens inside the running order
and stays beside it. The head also stopped being a grid: at six items of
wildly different widths every breakpoint wanted its own placement, and the
last thing added auto-placed into an empty cell and came out in the wrong
order.

**ONE HEIGHT FOR EVERY CONTROL IN THAT ROW — 44px, and 44 because it is the
FLOOR.** The head held four heights before; levelling DOWN would have broken
the one control a touch-target audit had already fixed. The shapes still
differ, because the radius encodes what a control IS.

**AND A DESTRUCTIVE BUTTON HAD SILENTLY LOST ITS EDGE.** The one global
`.danger` rule — the one whose own comment says *"it was written out four
times and had already drifted; this is the one rule"* — uses the `border`
SHORTHAND, so it overwrote the 2px bottom and the top-lit face that every
ordinary console button wears. **The shorthand-beats-longhand trap, hit inside
the rule that calls itself the one rule.**

**NOTHING SITS BETWEEN THE RUNNING ORDER AND LAUNCH NOW.** The break strip
moved above the tiles; the pack settings row only exists when it holds a
control (every quiz night carried a labelled row containing one caption); and
the four-fact info line went. **The host was right about that line** — *"this
is all venue settings stuff that can be done in the workshop?"* The venue name
duplicated the picker, *one-off* is `usualNight` on the venue record, and
*start when you like* is the app reporting a blank diary field. The prizes
were the honest exception, being read at launch onto a voucher — so the
positive case is now silent and only the warning survives, in the head, on a
line of its own so it never shoves the controls in front of it.

Both games still launch, `pub-unchanged` IDENTICAL, no horizontal overflow at
1900 / 1280 / 900 / 390, 1,510 tests green.

**Live as of 23 August 2026, same day again — the launch bar tidied up, and
a drag that had no tap:**

*"Starting to look a bit messy — can we utilise space where possible."* Four
placements: **Stop became Unlaunch** and now sits 10px from the sentence it
undoes rather than at the far right of a 1900px bar; **Save moved into the
head beside the venue**, where the other night-level questions live;
**"Nothing in Tonight to keep yet" became "Add a pack to save this night"**,
on the button rather than beside it; and the **five night settings fit one
even row above 1150px** with their labels above their controls, because side
by side two of the five wrapped and three did not. The bar is 377px tall
where it was well over 700.

**AND THE ONE THAT WAS A REAL BUG: a shelf round dot had no `click` at all.**
Reported as *"the drag and drop feature per round doesn't seem to be
functional"* — and the drag was fine, verified end to end with real mouse
events. What was missing is the thing anybody tries first, and the only thing
that works on a touchscreen, since **HTML5 drag never fires on touch**. This
repo already has the rule (*"every drag has a way round it"*) and every other
drag on the page already had its tap; this control was built without one and
the gap was invisible because the mechanism it lacked is the one nobody
thinks to test. **A feature reported as "not working" may be working exactly
as built and missing its most obvious entry point.**

**Two traps on the way through, both caught by measuring rather than
looking.** Growing the pack tile's × to a real 30px target put it UNDER the
pack name (`z-index: 1`, later in the DOM), so half the button silently did
nothing — *a bigger target is not the same as a hittable one*. And
`.lb-set .pack-shape-wide { grid-column: span 2 }` sits fourteen lines below
the override at identical specificity, so the span survived and "Playing" sat
alone on a row with four empty cells beside it.

Both games still launch, `pub-unchanged` IDENTICAL, no horizontal overflow at
1900 / 1280 / 900 / 390, 1,510 tests green.

**Live as of 23 August 2026, same day again — WHAT HAPPENS IN THE GAPS is
now a decision per break:**

*"The while they wait section needs to assign games and/or photo upload per
break… and the screen itself needs to be able to show ads as well."* Three
shapes were rendered from the real stylesheet before he chose; he took the
one where **the breaks are drawn where they happen**, and added *"I also have
to be able to put nothing on the screen if I want to."*

**TWO OF THE THREE THINGS ASKED FOR ALREADY EXISTED**, which decided what got
built: photos have always run at every break, the game ran at the lobby only
— and that was **his own decision**, recorded in `play.js` verbatim
(*"between rounds it should be photos and before the start of the quiz it's
Maze Mouth"*), so he was told he was reversing himself before choosing. The
genuinely new thing is **an advert that goes up without anybody pressing a
button**, which is the half that pays.

**A BREAK IS A PLACE, NOT A NUMBER.** He counted "4 rounds and a bingo, so 5
breaks" — right for that night and wrong as a model, since a switched-off
round removes one. `p0:lobby` / `p0:r2` are derived from state that already
exists and already survives a restart, so nothing has to be kept in step;
the console's strip runs the same arithmetic over the **same segments Launch
sends**.

**THE THREE LOBBY-ONLY GUARDS CHANGED SUBJECT RATHER THAN GOING AWAY** — the
seed in the payload and the refusal at the score route now read "a break that
offers a game", and outside a break there is no break, so a question is as
unreachable as ever. **The arcade BOARD deliberately did not move**: it draws
inside the lobby's QR panel, and a round board already has the board the room
looked up for. Three separate assertions, each verified by breaking it.

**AND THE LIVE CHECK EARNED ITS KEEP TWICE.** `runningShowSegments` was
nested inside `pick()`, so the new caller could not see it — valid syntax,
`node --check` happy, and the whole console dead on load. Then
`listAdvertPacks()` turned out to return a **summary** whose slides have no
body, link or image: a heading over an empty card, nothing thrown, the count
right and the screen wrong. **That is the third sighting of the picks-fields
trap this month** — `mergeGigs()` records it twice and `listArchive()` once.

Proven live end to end on one seeded night: the strip goes from 3 chips to 2
when a round is switched off, the projector holds the scores for 20 seconds
then rotates two of The Crown's slides (offer QR and code intact) and comes
back, the phone at that break shows the scores with photos big and the game
underneath, and the same break set to *Nothing* leaves a screen carrying only
the round's name. Both games still launch, `pub-unchanged` IDENTICAL with
only the new `gap` field allowed, 1,510 tests green.

**Live as of 23 August 2026, same day again — the shelf is ranked PER
VENUE:**

*"That's a good order but it needs to be per venue as well — if you've done a
quiz at venue A and not at venue B recently then this needs to be factored
in."* **The code already admitted the gap in its own words:** `quickPicks()`
carried a comment saying the app *"cannot know which venue tonight is (a
night does not carry one yet)"*, which stopped being true on 17 August and
nobody went back to it — while `library.js`'s note on the play counts had
been stating the real purpose the whole time: *"the whole use of this line is
deciding what not to run at the same venue again."*

**Nothing new is collected, and the join was one field away.** The archive
has held the venue and the pack of every filed night for months —
`listArchive()` and `mergeGigs()` both PICK fields rather than spreading, and
`packId` was simply not on either list. That is the same trap `mergeGigs()`
already records against `rewards` and the league boards, **hit a third time**.
`src/heard.js` is then the same shape as `headcounts.js`: one function over a
SET of nights, taking what `mergeGigs()` returns, so the 6am roll-over and
"a quiz and the bingo after it are one night" come free.

**A NIGHT IS FILED UNDER ITS ID *AND* ITS NAME** — the split
`venueHeadcounts()` was already bitten by, in the other direction: a venue
picked off the book lands under `id:xyz` and the same pub typed freehand under
`the crown`, and every night from before venue ids is in the second group.
**The reconciling has to be the reader's job** — nothing on a hand-typed night
says which book entry it meant, and only the Venues book joins the two — so
the console asks under both keys and `test/heard.test.js` states the limit
outright rather than hiding it.

**AND CHANGING THE VENUE HAD TO RE-RENDER THE SHELF, found in live
verification.** `chooseVenue()` repainted the bar and left the grid below
ordered for the pub before it: nothing threw, every card was real, and the
only tell was a pack you ran there last week sitting at the front.

Proven live at two venues on the same seeded archive: at The Station Tap
every bingo card reads *"Played here 5 weeks ago"* in longest-ago-first order,
and at The Crown the identical packs read *"Never played"* with Motown Soul —
heard at the Tap two days earlier — back on the shelf. The launch bar's why
line says *"Last played here July"* and *"Never played here"* for one pack at
the two venues. Both games still launch after a venue pick (protected
surface), `pub-unchanged` IDENTICAL, 1,497 tests green.

**Live as of 23 August 2026, same day again — the Console shelf lost its
search box, and the Workshop shelf gained two jobs:**

*"Search bar can go — the place to fix the pins for this is the workshop."*
**This reverses "SEARCH STAYS AND HAS TO"**, and the pins are why that rule
expired rather than being wrong: it was written when the six were chosen by
the app's own ranking, so search was the only way to reach the seventh pack
and removing it would have stranded the rest. Pinning changed the premise —
the six are CURATED now, so a shelf you chose does not need searching. The
Workshop keeps its search and its pin arranger, so nothing is unreachable;
it is one door away, which is where the choosing happens anyway.

**A REAL TRAP CAUGHT ON THE WAY:** `packQuery` is module state keyed by
KIND, not by door, so a search typed on the Workshop shelf was still in it
when the Console rendered — which after this change would have silently
filtered a shelf with no visible box to explain why half the packs had gone.
A filter you cannot see is worse than one you did not want. The Console now
ignores the query entirely, proven live: searching nonsense in the Workshop
drops it to 0 cards while the Console still shows its 6.

**And the Workshop shelf is now two jobs behind a dropdown** — *"perhaps
make that a drop down, options being 'work on a pack' and 'set your pinned
packs'?"* They were quietly fighting before: choosing what to WORK on wants
the recommended six and a tap that opens the bench, while choosing what to
PIN wants every pack you own on screen, since **curating six FROM six is
circular**. So *Set your pinned packs* lifts the six-cap and shows the lot,
brings up the order arranger (with a line saying what to do when there are
fewer than two pins), and stands Compact and the editor link down. Per
device, like the benches and Compact. Verified signed in as a real account —
the dropdown is correctly absent in bootstrap (host-key-only) mode, because
`canPin()` is false there by design.

**Live as of 23 August 2026, same day again — a saved night no longer keeps
its venue, and the bingo card label speaks English:**

**THE VENUE IS NEITHER SAVED NOR RESTORED, reversing the original design.**
*"Saving everything INCLUDING the venue is pointless, there's no way you'd
want to run the same quiz at the same venue again — but if it could be saved
and the venue left open that would be useful."* The mistake was a category
one: **a saved night is a TEMPLATE, not a RECORD** — the archive already
holds what happened where. A show is reached for precisely when you are
somewhere new, so carrying the old venue in files tonight under last month's
pub — and the prizes and the voucher follow the venue, so a stale one is
somebody refused a drink at the bar. **Both halves were needed**
(`tonightAsShow()` stops storing, `applyShow()` stops reading), or shows
saved before the change would still drag a pub in; that also means **no
migration**. Three things followed it out: the name suggestion (it offered
"Thursday at The Crown" — a name pointing at a pub the show will not load;
it names the packs now), the venue on the show card, and the explainer copy
promising it was kept. `src/shows.js` still accepts and normalises a `venue`
field deliberately, so older shows do not fail validation.

**"63% of calls hit your card" now counts songs.** Reported as awkward:
*"can we clarify this and simplify it as well for the reading QM."* Three
faults, all fixed by counting — *"your card"* is ambiguous on a screen only
the quizmaster reads (it is the PLAYER's), a percentage has to be converted
before it means anything, and the actual decision was left to be derived. It
reads "25 of 40 songs on a card" now, and under half the pack it says
`drags` in words. The boundary is inclusive — half does not drag, the line
the host drew himself (*"not even getting a song fifty percent of the
time"*) — with a test on each side of it.

**AND A LATENT BUG THE FIRST CHANGE EXPOSED.** `chooseVenue()` repainted the
picker but never the line under the tiles, so picking a venue left that line
describing the one before it. Caught live, with the picker reading "The
Station Tap" over a line still saying "No venue yet". Latent before and
load-bearing now: since the venue there stopped being a second picker, that
line is the only place its prizes and usual-night facts appear.

**`docs/console.md` WAS SPLIT, because it hit the ceiling its own test
sets.** The shows material was a third of the file and a subject of its own,
so it moved whole — by line number, the mechanical transform this repo
prefers — to `docs/console/shows.md`, leaving a pointer. Verified by diffing
the extracted body against the original: the only differences are the
stale-text corrections made deliberately beforehand. `docs/console.md` is
65KB with real headroom again.

**Live as of 23 August 2026, same day again — one venue picker that looks
like a picker, a Stop that actually shows, and a button that says what it
does:**

**"Keep this ready" is now "Save for another night".** Asked what it meant
TWICE — which is this file's own rule failing out loud: *a control that
needs explaining is the wrong control*. A tooltip was tried after the first
ask and did not fix it, because a tooltip is not read at a glance and does
not exist on a phone at all. The LABEL answers the question now.

**The Stop beside "On the big screen now" shows whenever that line does.**
Asked for a second time, with a screenshot of the line reading in RED (the
projector on one quiz, the bar set to another) and no button next to it. It
was gated on `aNightIsOn()` — the stricter test the running panel uses,
which is false while a game sits in the lobby with nobody joined — so it
hid at exactly the moment it was most wanted. **The two controls are about
different things, which is why they can differ:** the running panel is
about a night in progress, and this is about the SCREEN, which is showing
something whenever there is a title to name.

**ONE venue selector, and it looks like every other dropdown.** *"There's
two places to select venue, and neither of them conform to the drop down
aesthetic."* Both halves were true. The second selector — the venue in the
info line under the tiles — is now plain text, and the one at the head of
the bar takes the app's own dropdown treatment: identical height, fill,
border and radius to a `<select>`, with the gradient chevron block that
means "this opens" (measured against `.look-pick` afterward: 33px, 10px
radius, same fill, same chevron). It was deliberately understated before,
so a box would not compete with Launch — the wrong trade, because it made
the one control deciding the prizes, the voucher and the filing look like a
caption, which is *why* a second way in had to exist beside it. The
keystroke search was already there and already focuses on open; it was just
behind a control nobody could see was a control.

**And that removed a real collision.** As a button, the info-line venue
carried an invisible 15px-tall tap overlay above and below itself
(`::before { inset: -15px -3px }`) reaching into the lines either side —
visible in the report's own screenshot as the pack-settings line running
into the venue line. As plain text it needs no overlay. The pack row also
had a measured 0px gap above it, so two same-sized dim lines were touching
and read as one wrapped paragraph; now 12px.

**Live as of 23 August 2026, same day — four changes to the launch bay,
reported off two screenshots:**

**1. The Venue/Online switch is the same object in both modes.** *"The button
need to be the same for both regardless of which mode you're in."* Measured
before changing anything: the widths and heights were already within 2.4px
(just the extra character in "Online"), so the real difference was the LIT
TREATMENT — a flat grey for Venue, the full account gradient for Online. That
made the control read as two different objects depending on the mode, on a
switch whose message is the same either way. **Both halves now take the
lit-chip tint**, the app's own established "you are here" language, and
neither takes the gradient — Launch keeps that, per the one-gradient rule
this bar exists to hold. The halves were also equalised (`flex: 1 1 0`) so
the pill stops changing shape as it is switched. This REVERSES the recorded
"only the ONLINE half wears the gradient" decision, which is why it had to
be rewritten in CLAUDE.md rather than moved to a doc: a session reading the
old line would put the gradient back.

**2. Six slots always, whatever is in the bay.** *"When you add a quiz and
then a music bingo you STILL get restricted slots — I need 6 regardless."*
The mixed row drew only what was filled plus one, which reads as a limit
that grows as you use it; the ordinary row separately capped a bingo night
at exactly ONE slot. That bingo rule was stale rather than wrong — it dated
from before quiz → bingo → quiz existed, when a track list genuinely could
not be composed with anything. Both now fill to six.

**3. Packs are clickable in the bay, and 4. the settings split in two.**
*"When you click a pack the settings for THAT PACK appear below… settings
that only apply to the night as a whole can sit above the packs."* Built as
asked: `.lb-set-night` above the tiles (Look, Seconds per question, While
they wait, Game sound, Playing) and `.lb-set-pack` below (Card and Prizes,
for whichever tile is picked, named). A tap on a tile is a SELECTION and
changes nothing about the night — everything on a tile that acts (the ×, a
round dot) stops the event itself, so what is left to tap is its face.

**This replaced the controls that used to live INSIDE a bingo tile** — two
native `<select>`s in a 146px square that clipped their own option text
mid-word and covered the area a drag starts from. The tile now SAYS what it
is set to ("5×5 · 2 prizes") and the row below is where it is changed, which
also scales: a third pack-specific setting costs nothing there and had
nowhere to go before. The first version of the row was itself too narrow and
clipped the same text, which was the fault moving rather than being fixed;
the controls now grow into the row with a cap.

**Seconds per question stayed NIGHT-WIDE deliberately** — `doLaunchOrder()`
sends one value for the whole running order, so a per-pack control would
promise something the server cannot keep.

Four helpers carry the split — `pickedPack()`, `packsInBay()`,
`pickedShape()`, `setPickedBingo()` — because a picked pack keeps its shape
in one of two places depending on the shape of night (its own slot in a
mixed running order, `night.*` otherwise), and one function per question
beats that branch appearing at every call site. `pickedPack()` is
bounds-checked rather than reset, so removing the picked pack leaves the row
saying nothing instead of silently re-pointing at whatever slid into that
position.

Live-verified against the real protected launch path, both shapes of night:
an ordinary quiz launch carried `look` and `questionSeconds` set on the row
ABOVE the packs, and a mixed `launchOrder` carried
`shape: {rows:3, cols:3}` on its bingo segment — the shape set on the picked
tile via the row BELOW. Six tiles in every state, no overflow at 1280 or
390, no console errors.

**Live as of 23 August 2026 — the public gallery now only holds photos that
looked like a camera took them; the projector still takes anything:** asked
for directly — uploads "for a bit of a laugh" are fine on the big screen,
not on the page shown to a venue afterward. Detected client-side, on the
raw file, from the EXIF `Make` tag before the upload's own canvas redraw
strips it — a dependency-free JPEG/EXIF reader in `filters.js`, verified
against real PIL-generated JPEGs as well as hand-built buffers. Best-effort
by design (a photo re-shared through WhatsApp/Instagram often loses its
EXIF before it reaches this app, so this can under-count but never
over-count) and never a gate on the projector, which never asks. The flag
rides in the filename (`NOT_CAMERA_SUFFIX`/`isCameraFile()` in photos.js)
rather than a second manifest file, to avoid a read-modify-write race
against concurrent uploads. The public gallery route filters twice (the
listing and the direct photo proxy, same reason `isPublished` is checked
twice); the host's own Past gigs review is deliberately NOT filtered —
every photo is shown, with a quiet "Screen only" badge on the ones that
will not reach the public page, so nobody is surprised later. No per-photo
override built yet — see `docs/gigs.md` for that tradeoff. `CLAUDE.md`'s
byte budget raised 140,000 → 140,100 for the one index line this needed.

**Live as of 21 August 2026, same day, next deploy again — three faults
reported off one screenshot of a mixed quiz-plus-bingo night, and a real CSS
bug found chasing the third:**

**1a. CORRECTED THE SAME DAY: present-and-inert was still the wrong answer
for Card and Prizes in mixed mode.** The fix below (1) left them disabled
with "Set per pack below" — reported straight back, off the same
screenshot: *"if they can't function on the bench they should be removed."*
Right call: in mixed mode they are not "not yet usable" (the case
present-and-inert actually fits, and still governs Seconds and, outside
mixed mode, Card/Prizes themselves), they are PERMANENTLY superseded by
each bingo tile's own controls for as long as the row stays mixed —
disabled-and-present read as broken rather than deferred. Now hidden
outright in mixed mode, via two named wrapper elements (`.lb-set-card`/
`.lb-set-prizes`) `paintSettings()` toggles alongside everything else.
Live-verified: the settings row reads Look / Seconds / While they wait /
Game sound / Playing with no dead controls once a second (bingo) tile
joins the row, and the sticky-drag CSS fix below still holds.

**1. Card and Prizes read "Bingo only" beside a bingo TILE that already had
its own working shape/prize dropdowns.** `paintSettings()` decided bingo-ness
from `currentPack` alone, which in a MIXED running order (`lbSlots` truthy,
`renderSlots()`'s numbered tiles on screen) is only ever slot 1 and may not
be bingo at all — the exact scenario in the report, a quiz pack in slot 1
and a bingo pack in slot 2. Now asks `lbSlots` too: in mixed mode Card and
Prizes are ALWAYS inert, because every bingo tile carries its own controls
and there can be more than one, but the label now says **"Set per pack
below"** rather than the misleading "Bingo only". Seconds per question got
the matching fix the other way — inert only when NO quiz slot exists at
all, not just when `currentPack` happens not to be one — and While They
Wait now reads the FIRST slot's kind rather than asking "is there any bingo
anywhere", so a quiz-opening mixed night still gets Maze Mouth in the
lobby. The scattered per-call-site repaints (four different functions each
remembering to call `paintSettings()`) were collapsed into one call inside
`paintOrder()` itself — the single seam every `lbSlots` mutation already
passes through via `renderSlots()`'s own `onChange` — because that is
exactly the kind of duplication that misses a call site, and had: the
mixed row's own tile-swap and round-drag never repainted the settings row
at all until this pass.

**2. "What does 'Keep this ready' mean?"** Added a hover tooltip explaining
it in one line — save the pack, venue and settings so the whole night can
be dragged back onto Tonight later from Prepare a night — matching the
pattern every other button on this bar already uses (`.stop-running`,
`.lb-unlaunch`).

**3. The pack shelf visually overlapped the settings row and Launch button
after interacting with the mixed row.** This is a REAL, PRE-EXISTING CSS
bug, not something the settings migration introduced — found by measuring
`getComputedStyle('.launchbar').position` during a simulated drag and
getting `relative` instead of the `sticky` the rule at `body.is-dragging-card
.launchbar` asks for. `body.console .panel { position: relative }` (the
scroll-rod styling, dated the same day) targets the SAME element — the
markup is always `class="panel launchbar"` — at EQUAL specificity (two
classes on `body`'s selector, either way), so whichever rule sits LATER in
`style.css` wins the `position` property regardless of which class name
looks more specific to a reader. The panel-rod rule sits later, so
`position: relative` silently won on every drag since that CSS landed —
the sticky pin has never actually engaged. That alone would just mean the
panel scrolls away during a drag rather than staying reachable (the
original bug `pinTonightWhereItIs()` was written to fix); the OVERLAP came
from `top: var(--lb-pin)` on the same rule having no competing declaration
and applying anyway, as a plain relative offset with nothing reserving the
space it shifted the panel into — and if a drag never reaches its own
`dragend` (window focus lost mid-drag, browser chrome swallowing the
release — a real failure mode neither of two independent live
investigations could force through a headless browser, since a scripted
`dragstart`→`dragover`→`drop`→`dragend` sequence always completes cleanly),
`is-dragging-card` stays on the body and that stale shift never lifts,
sitting the panel down over whatever follows it in the document. Fixed by
naming `.launchbar.panel` in the sticky rule — costs nothing since the
markup always carries both — which makes it the more specific selector and
wins outright rather than by source order, the same trap this file already
carries a note about for `border` further down the sheet. Verified two
ways: the computed `position` is now `sticky` even in a forced stuck-drag
state, and the pack shelf sits cleanly below the bar with no overlap in
that same state.

**On the two remaining reports — drag-and-drop for reordering tiles and for
moving individual quiz rounds between slots — the underlying code checks
out.** Two independent live investigations, driving the real
`dragstart`/`dragover`/`drop`/`dragend` listeners `wireSlotDrag()` and
`wireRoundDots()` (`console-tonight-mix-ui.js`) actually register, both
confirm a tile swap and a round move complete correctly end to end, and the
tap-to-toggle fallback for touch works too. The CSS fix above removes one
concrete way a real drag could leave the page visually broken partway
through a session, which may be enough on its own; if dragging still fails
after this ships, it is not explained by anything either investigation
could reproduce and needs a fresh report with more detail — which part of
a tile was pressed, and whether the browser window lost focus mid-gesture.

**Live as of 21 August 2026, same day, next deploy again — Tonight's
settings moved off their own tab and onto the launch bar, and the tab is
gone:** asked for directly off a screenshot of the tab (Look / Seconds per
question / While they wait / Playing): "these four options should be on the
launch bay really, tonight's settings might be defunkt." Clarified with two
questions rather than guessed at, because both answers changed the shape of
the work: "one compact row, always visible" (not a fold — no hiding it
behind another tap) and "everything — kill the tab" (Card shape and Prizes,
bingo-only, and the Keep this ready save button move too, not just the four
named fields).

`tonightSettingsPanel()` — a whole separate exported function with its own
`<h2>` and explainer, rendered fresh only when the tab was opened — is
deleted outright. Its markup becomes `.lb-set` inside `launchBar()` itself,
positioned directly above Launch, the same place the tab sat relative to it
in the door order. The `id: 'setup'` TABS entry and its import go with it.

**Reads and writes the same `night` object the tab always did** — nothing
about how a setting is HELD changed, only where the controls that write to
it are drawn. But the tab was rebuilt from scratch every time it was opened,
which is what let it get away with baking pack-dependent options straight
into a template string; a bar that stays mounted while packs are dragged in
and out cannot do that, so a new `paintSettings()` repaints Card, Prizes,
Seconds and While They Wait's options at every place `currentPack` changes —
the same "read state, redraw" shape `paintLive()` already used for the
live-drift line.

**Card and Prizes are BINGO-ONLY and Seconds is QUIZ-ONLY, and both stay
PRESENT AND INERT rather than appearing and disappearing with the pack** —
the rule this bar already keeps for Launch itself and for Keep this ready:
disabled, with a plain "Bingo only" placeholder, rather than absent. The
original tab did the opposite (conditionally omitted them from the markup
entirely), which was safe there because the whole panel was rebuilt on
every open; on an always-mounted bar that would have made the row change
height depending on what was dragged in, the exact fault "present and
inert" exists to prevent.

Every stale reference to a "Tonight's settings" tab or a "Set it up" fold
was found and reworded: the Workshop bench's own "Prepare a night" empty
state (`console-shows.js`, which used to send two separate links to two
separate places and now sends one, since both actions live in the same spot
now), a pack editor comment, and three places in `CLAUDE.md` itself
(`test/claude-md-budget.test.js`'s ceiling left the fixes at a net three
bytes UNDER where they started, by trimming words the rewrite no longer
needed rather than only adding new ones). `test/console-split.test.js`'s
line budget for `console-tonight.js` raised 2820 → 2860 — the repaint
wiring a tab never needed, not the settings themselves, which moved rather
than grew.

Live-tested against the real console: the tab list now reads Music Quiz ·
Music Bingo · Prepare a night · Venues with no fifth entry; Card and Prizes
render disabled with no pack and with a quiz pack, and enabled with real
shape/prize options the moment a bingo pack is chosen, with Seconds per
question flipping the opposite way; Keep this ready is disabled with
"Nothing in Tonight to keep yet." until a pack is chosen; a changed Look and
Seconds per question were confirmed in the actual `POST /api/host/launch`
body and in the session afterward. No overflow at 1280px or 390px, no
console errors.

**Live as of 21 August 2026, same day, next deploy again — a Stop sits
beside "On the big screen now":** asked for directly off a screenshot of
that exact line. It reads the same `stopRunningNight()` the running panel's
own Stop button now shares — that panel's copy of the confirm wording and
the `/api/host/resetAll` call was deleted and both buttons call the one
function, so a future change to the confirm text or the endpoint cannot
update one and miss the other. Shown only when `aNightIsOn()` is true — the
same stricter test the running panel already uses to decide it has anything
to stop — not the looser "a title exists" check the line's own text uses,
or the button would offer to stop the default boot-time pack nobody ever
launched. **The button only exists where the text it sits beside exists**:
`launchBar()` itself is swapped for nothing on the Console door the moment a
game is actively mid-question (`live` true), so in that state only the
separate running panel's own Stop is on screen — unchanged, and correct,
because the whole row this button lives on is not there either. Live-tested
against the real `/api/host/launch` and `/api/join` routes: hidden on a
fresh boot, hidden immediately after Launch until a phone actually joins,
visible once one has, and pressing it genuinely clears the session
(`playerCount` back to 0, phase back to `lobby`) with the right pluralised
kicked-phones count in the confirm text. No overflow at 1280px or 390px, no
console errors. `test/console-split.test.js`'s line budget for
`console-tonight.js` raised 2790 → 2820 for the button, its visibility
wiring and the doc comments explaining the `aNightIsOn` choice.

**Live as of 21 August 2026, same day, next deploy again — "Shows" is now
"Prepare a night":** asked for directly, and "Prep a gig" was turned down —
it shares a root word with Past gigs, the exact confusion the tab had just
been fixed for. Offered alternatives clear of both "gig" and "night" (Set
list, Templates, Ready-made); the host picked none of them and chose
"Prepare a night" instead, knowingly reusing a word the original naming
already avoided for a stated reason, to judge once it was actually on
screen. **Display text only** — every visible string was checked and
changed (the tab label on both doors, the heading, the always-on explainer,
the empty state, the save button, both `prompt()` dialogs, the success
toast, the parts editor's remove-label and its own note), while the code,
the files, the data field and the API route underneath all still say
`show`/`shows`, deliberately: an internal name and a displayed one are
allowed to differ, and renaming the former would have been a large, separate
risk for no visible benefit. All nine spots verified live with the exact
wording read back off the DOM, zero console errors. See "AND THEN THE TAB
ITSELF WAS RENAMED" in `docs/console.md`.

**Live as of 21 August 2026, same day, next deploy again — Shows explains
itself even when empty, and the Workshop bench points at it:** reported
live, a guess that the empty Shows tab was Past gigs under another name —
the two are opposites (evidence versus organisation), but nothing on an
empty Shows tab said what the finished thing actually IS. The "a whole
evening kept as one thing" sentence used to hide specifically when the
shelf was empty, on the theory it repeated the empty-state line below —
backwards, since the first empty visit is exactly when that sentence is
needed most. It now shows on Workshop always.

Asked for directly in the same breath: *"give the workshop bench a place to
save so it goes into a show."* The bench cannot honestly build one itself —
it holds one pack, a show also needs the venue/prizes/look, and inventing a
save button there would either leave those blank or become the "second
composer" this app already refuses. So the bench got a bridge instead: a
**Take it to Tonight** link that hands the pack to Console in the URL
(`?tonightPack=<id>&tonightKind=...`), read at boot before the page's data
loads — the same pattern `?night=` already uses for the Post Gig bench —
landing the pack on Tonight ready for the existing **Keep this as a show**
button. Verified live: the Shows explainer reads correctly on an empty
shelf, the bench's link carries the right pack id and kind, and clicking it
genuinely lands the pack on Tonight rather than leaving the URL unconsumed.
See "SHOWS WAS MISTAKEN FOR PAST GIGS" in `docs/console.md`.

**Live as of 21 August 2026, same day, next deploy again — the cursor's
index finger now presses on click:** asked for directly after the quill's
removal — *"the grabby hand is great but I think the normal hand needs a
longer index finger that looks like its pressing on click."* Four lengths
were rendered side by side, judged at 32px (the only size a cursor is ever
seen at), and the answer was *"D for the unclick and A on click"* — the
longest reaches out as the ordinary hover cursor, and the original length
comes back the instant something is actually pressed, via a new
`body.console *:active` rule sitting between the default and the closed
fist a real drag still shows. Verified live: an ordinary button's cursor
holds the long finger until a real mousedown, switches to the short one
while held, and a draggable pack card's mousedown still shows the fist
throughout — the click state never leaks into a drag. See the gauntlet
cursor entry in `docs/decisions.md`.

**Live as of 21 August 2026, same day, next deploy again — an honest
attempt at the fist during an actual drag:** asked directly whether the
fist really does vanish mid-drag, and it does — a real browser limitation,
confirmed: once a native HTML5 drag begins, every browser takes cursor
rendering away from the page for as long as it lasts, ignoring CSS
entirely, and there is no reliable cross-browser fix. Given the honest
choice, the host chose to try the one unreliable workaround anyway:
`dragging()` now also sets the fist as an inline `style.cursor` on
`<body>`, which Chrome sometimes honours where a class is not. The
MECHANISM is verified live (set on drag start, cleared on drag end, no
regression to the sticky-panel toggle); whether it changes what a person
actually sees could not be — a screenshot cannot capture the OS's own
cursor bitmap. See the gauntlet cursor entry in `docs/decisions.md`.

**Live as of 21 August 2026, same day, next deploy again — a bingo card
defaults to its best fit, and a photo no longer covers the lobby's join
code:** two more reports from real gigs, both live-verified against real
packs/uploads rather than fixtures.

A 40-track bingo pack was defaulting to a 4×4 card — 16 of the 40 songs on a
given player's card, well under half of every call meaning anything to them,
which read as the round dragging even at a normal clock speed. Reported in
the host's own words: *"forty songs on a four by four... they're not even
getting a song fifty percent of the time... when there's forty songs it
should be a five by five grid."* `minimumTracks()` in `src/bingo.js` already
enforced the OTHER end (a pool at least 1.5× the squares); `bestBingoShape()`
in `public/assets/client.js` is that same rule read forwards — the shape with
the MOST squares among the ones a pack's track count can still fill — and
for 40 tracks it lands on 5×5, exactly the host's own answer. Every shape
option now states its own pacing too ("5×5 — line of 5 · 63% of calls hit
your card"), so picking anything else is still an informed choice rather
than a guess, and nothing is locked — every viable shape stays on the list.
Found and fixed a latent bug on the way: `slotsFromSimple()` mislabelled a
bingo pack as an empty quiz slot when converting to Tonight's mixed row,
unreachable before the round-drag feature, reachable since. See "A CARD
SHAPE DEFAULTS TO ITS BEST FIT" in `docs/console.md`.

Separately: the existing "a big photo never dims the join code" fix
(`beside-join` in `screen.js`) had only ever been tuned against the ROUND
BOARD's small corner code — the LOBBY carries a much bigger QR panel
instead, which the fix never checked for, so a photo shown while people were
still joining sat over the only code they could scan. `photoClearance()`
now measures whichever of the two is actually on screen and reserves exactly
that much room, rather than a fixed number tuned for only one of them.
Verified live: a real photo uploaded through the actual phone route, on both
the lobby (100px clear) and a round board reached by playing through nine
real questions (235px clear). See "A PHOTO STILL COVERED IT ON THE LOBBY" in
`docs/screens.md`.

**Live as of 21 August 2026, same day, next deploy again — dragging tile 1
onto tile 3 now swaps them, and a single round can be dragged straight off
the shelf:** reported live: *"when I drag pack 1 to pack 3, they should swap
but they don't. What happens is pack 1 goes to tile 3, tile 3 goes to tile 2
and tile 2 goes to tile 1."* `moveSlot()` was an insert-and-shift, correct
for the ordinary Tonight row (a genuine reorderable list) and wrong for the
mixed row's numbered tiles (fixed slots) — the two only ever agreed when the
dragged tiles happened to be adjacent, which is why the adjacent case had
already tested clean. Replaced with a real `swapSlots(slots, i, j)`; verified
live that tile 2 stays untouched dragging tile 1 onto tile 3.

Asked for directly, in the same session: every quiz pack's shelf card now
carries its own small row of draggable round dots, so a single round can go
straight into Tonight without placing the whole pack first — landing on one
specific tile places it exactly there (`moveRoundToSlot()`, unchanged, the
same function a round already dragged between tiles in Tonight uses);
landing anywhere else on Tonight starts the night with just that round, none
of its siblings, via a new `addRoundToNight()`. Found and fixed on the way: a
latent bug in `slotsFromSimple()` that mapped every pack to `kind: 'quiz'`
unconditionally, wrong the moment a night converting to the mixed row had a
BINGO pack as `currentPack` (no `.rounds` at all, by design) — unreachable
before this feature, reachable now. All three drag cases (start a night from
one round, merge onto a specific tile, silently refuse a different pack)
verified live with zero console errors. See "A SINGLE ROUND CAN NOW BE
DRAGGED STRAIGHT OFF THE SHELF" and the swap-fix entry just above it in
`docs/console.md`.

**Live as of 21 August 2026, same day, next deploy again — the quill is
gone, and Tonight's mixed row stopped losing tiles mid-drag:** three fixes in
one push, all live-verified with real HTML5 drags rather than read off the
code.

The quill cursor was dropped outright — the host's own call after living
with it for a session: *"I'm happy with the open hand and then the grabby
hand when grabbing stuff."* The OPEN gauntlet is now the one default cursor
on `body.console`, at the same `!important` weight the quill held; the
closed fist keeps its one job on `:active`/`.dragging`. See the renamed entry
in `docs/decisions.md`, *"The console wears a gauntlet cursor…"*.

Two drag bugs in the mixed row (`console-tonight-mix-ui.js`), reported as
tiles vanishing mid-drag with drag dying after a couple of goes, and a bingo
tile that could not be dragged anywhere at all, turned out to be unrelated:

- **The vanishing/dying bug** was `console-tonight.js`'s own `dragging()`
  toggle never clearing. It is meant to always fire on `dragend`, but
  dropping one Tonight tile onto another commits synchronously, which
  rebuilds the WHOLE row — detaching the dragged element from the document
  before the browser gets to dispatch `dragend` on it, and a `dragend` whose
  source has already been removed does not fire at all. The stuck class pins
  the launch bar `position: sticky` at a stale offset forever, which is what
  read as tiles disappearing under the topbar on an ordinary scroll. Fixed by
  calling `dragging(false)` explicitly in both drop handlers, before the row
  is rebuilt, rather than trusting the native event. Verified live by
  deliberately reproducing the worst case — a drop with `dragend` suppressed
  on purpose — across five successive drags: the class cleared every time,
  every tile stayed fully visible, nothing degraded.
- **The bingo tile** had a real cause of its own, found by a diagnostic agent
  driving real drags: its two `<select>`s (card shape, prize plan) sit as one
  unbroken row spanning ~99% of the tile's width and ~26% of its height — a
  native `<select>` intercepts a mousedown for its own dropdown before any
  HTML5 drag can start, which no `stopPropagation` reaches, so nothing under
  the title was ever reachable. Fixed with a small `.drag-grip` — this
  codebase's existing pack-editor pattern for exactly this problem — placed
  in normal flow next to every tile's title, quiz and bingo alike, so there
  is one rule rather than a bingo-only special case. Verified live: a real
  mousedown on the grip reaches `dragstart`; the same gesture on the selects
  never does.

**Live as of 21 August 2026, same day, next deploy again — the pack editor
loses "Look", Tonight gains a real timer:** "Look" is gone from both the
quiz and bingo pack editors — it only ever set a default Tonight's own
picker already overrode at every launch, the same redundancy prizes never
had. "Seconds per question" is different: it had no launch-time override
anywhere, so a genuine one was built — a control on Tonight's settings
(quiz packs only), threaded through `session.launch()` into
`engine.state.questionSeconds`, read by `engine.js questionSeconds()` behind
a round's own override, which still wins. Verified against the real scoring
clock rather than the code that sets it: launched with 35 and again with 47
via the actual console UI, read the live question's `endsAt - startedAt`
back off `/api/state?role=host` both times and got exact matches; an
ordinary launch with nothing set still comes back 20000ms. See "THE PACK
EDITOR LOST 'LOOK'..." in `docs/console.md`.

**Live as of 21 August 2026, same day, next deploy — a tap places the pack
on Workshop too:** clicking a pack card no longer opens it in place; it goes
straight to the bench, the same way a Console tap has gone straight to
Tonight for a while. That meant moving the five actions the caret used to
reveal (Rename, Playlist, Download, Pictures, Delete) off the card and onto
the bench, since the bench is the one surface that already knows which pack
is current — `packActionsMarkup()`/`wirePackActions()` in
`console-packs.js`, called from `workBench()` in `console.js`. The now-dead
caret CSS, the `openPack` toggle and a stale doc comment on `putOnBench()`
(copied from `putNightOnBench`, wrongly calling it a night) all went with it
rather than being left disabled. Verified live across all six library packs
to confirm the gated buttons match each pack's own rounds and ownership, and
the Console door's tap-to-Tonight path checked as an explicit regression.
See "A TAP PLACES THE PACK" in `docs/console.md`.

**Live as of 21 August 2026 — the console wears its retro dress:** the
quill-and-ink pass landed across seven deploys in one evening, each screenshot
sent to the host and each tuned on his eye before the next. The console (and
only the console — never the projector or a phone) now carries: a barbed gold
quill cursor with the hotspot on its nib; a gauntlet pair on drag — open hand
and closed fist, both drawn from the QM's side of the hand, the fingers
separating through the fist's own knuckle grooves, fingertips level with the
middle 10% longer and the pinky a touch shorter, tuned to that wording, and the
quill's own orientation flipped so its nib clicks from the top-left like an
ordinary pointer rather than a hand-drawn quill's natural bottom-left; a
soft scroll curl-shadow on every card; and turned scroll rods capping every
panel, dark-stained along the roll with the account's own two colours held in
the grooved knob finials. All of it is CSS on `body.console` — no payload,
no engine, no phone or projector file was touched, and `pub-unchanged`
printed IDENTICAL before every one of the seven pushes. The rules and the
render-variants-judge-at-real-size method are in the decisions table under
*"The console wears a quill cursor…"*.

**Older than 21 August 2026 — every entry back to the beginning is in
[`docs/history/shipped.md`](history/shipped.md).** Split off on 23 August 2026
when this file crossed its 100,000-byte cap; nothing was summarised and nothing
was dropped.


## From TODO.md

## What is new since you last read this

### The topical quiz, and the ladder it settled

**One button: "The month just gone."** It reads the last month off the web and
writes forty questions from it — 20 news and 10 music from the month, then 10
music from any era so the pack is not all one thing and does not punish
anybody who was on holiday. Named after the date, marked current for a
fortnight. Tick "Harder than usual" for the second, harder one; the two are
filed separately so they do not collide.

**It costs about £2 a pack** (£1.20 to £3.90 depending on how much the checker
thinks), measured rather than guessed. The checking pass is 86% of that; being
topical only adds about 26p.

**That measurement set Bronze / Silver / Gold**, on your own observation that
the one-off packs and the topical ones are different animals — an evergreen
pack is an asset written once, a topical one is a service written every week.
So Silver is the whole evergreen catalogue and **Gold is the weekly topical
quiz**. Gold is sellable now; it used to be streaming and nothing else, which
made it Silver at a £10 markup.

The arithmetic that makes it a ladder: Silver at £20 plus four topical packs at
£3 is £32, which is **more than Gold at £30** — so a Silver subscriber who
wants topical weekly has an unambiguous reason to climb, and it arrives every
week rather than in month four. There is a test that this holds.

**What it commits you to is a weekly deadline, not money.** The writing is a
button press and £2; the read-through is twenty minutes, every week, for as
long as one Gold subscription exists. That is the only part of the arrangement
that cannot be undone by editing a line in `plans.js`.

### Two things worth reading in this file

- **Group accounts** (below, under "Asked for, not yet specced") — seats on a
  Gold for a quizmaster company, and why the interesting half is internal pack
  distribution rather than the discount.
- **A shared login can end somebody else's night** — a real bug, reachable
  today, small to fix.


- **A "My account" tab** on the console — your name, your colours, what tier you
  are on, every feature laid out by tier with a switch on each, and links to your
  control view, your big screen and your join page all in one place.
- **You can look at the console as a Bronze, Silver or Gold subscriber.** Put
  the quizmaster hat on and the switch grows **All · B · S · G** next to it —
  tap a letter and you see exactly what somebody on that tier sees, tabs missing
  and all. It is a real downgrade, not a preview: the API refuses what that tier
  cannot do, so anything broken for a subscriber breaks for you too. Tap **All**
  to go back to everything. Taking the hat off clears it.
- **Three tiers: Bronze (Basic), Silver (Elite), Gold (Pro)**, and they stack —
  Gold includes Silver includes Bronze. On the owner page each quizmaster now has
  a Bronze / Silver / Gold picker instead of a row of add-ons.
  **⚠️ Which feature sits on which tier is a first guess, and so are the prices**
  (Silver £15, Gold £30). Moving one is a one-line change — tell me where you
  want them and I will shuffle them.
  **What a quizmaster can and cannot do there:** they can switch OFF anything on
  their own tier, which makes it disappear from their console. They cannot switch
  ON anything above it — that is yours to grant from the owner page, and it stays
  that way until payments are wired up.
- **The app is called Quizporium**, and each night is branded from whoever is
  running it — your projector says **"Mark's Quizporium"**, Rob's says **"Rob's
  Quizporium"**. First names only, the way you say it on the mic. ⚠️ If you have
  `BRAND_NAME` set on Render from before, that still wins over all of it and you
  will see the old name — clear it to get this.
- **Your own two colours.** Six of them (Sunset, Orchid, Lagoon, Ember, Citrus,
  Ultraviolet), at the bottom of the console under **Your colours**. Tap one and
  your projector and every phone in your room change straight away. It is on the
  ACCOUNT, so Rob can have his own and yours is untouched. A themed night —
  Halloween, Valentine's — still wins over it, and the four answer colours never
  change, because those are how a player matches the big screen to their phone.
- **An Owner | Quizmaster switch** in the top right of the console and the owner
  page, one tap either way, replacing the button that was buried on the owner
  page. The live half is a solid block of colour so you can never be unsure
  which hat is on. Switching cannot disturb a night that is running — the two
  hats are two separate rooms.
- **A second quizmaster can have a login.** Rob gets his own running game, so
  he cannot launch over your gig — that used to be one shared game and it was
  the reason you could not hand anyone a login. He gets his own join code, his
  own photo wall, and read-only use of your packs.
- **Accounts survive a restart** (as long as the private repo is set up), and
  you can make your first owner account from the Console instead of needing a
  command line.

- **The winner's face on the big screen** — whoever answers first gets their
  picture up next to "Fastest finger" on the reveal. If they have sent a photo
  in tonight it is that; if they have not, it is a little cartoon face drawn
  from their team name, so there is never an empty gap. The same team always
  gets the same face all night.
- **Round 2 pictures cost a lot less.** A portrait is now filed under the
  MUSICIAN rather than under the quiz, so once you have paid for Madonna once
  she is free in every quiz after that. The Pictures panel tells you before you
  press anything: *"6 already in the library, free · 4 to draw — about 16p"*.
- **Picture style and quality** on the same panel. Style is Portrait, Cartoon
  or As a superhero. Quality is low / medium / high — it was never being set at
  all before, so everything was being made at the dearest setting. Medium now.
  Bear in mind each style is a whole separate set of pictures, so a superhero
  round is a fresh bill even for people you already have.
- **Props on the photos** — dog ears, clown nose, party hat, nine of them. Tap
  one, drag it onto the face, pinch to size it. The black-and-white sort of
  filter is still there, folded away under "Change the colour instead".
- **Photos get the middle of the screen** for about three and a half seconds
  before joining the strip along the bottom, which is bigger too.
- **A guard on revealing early** — the same button pressed twice in a blink
  only counts once, and it refuses to reveal in the first three seconds with a
  note saying why. The clock still reveals on its own when it runs out.
- **You can see who keeps leaving the app** mid-question, on your own screen
  only. Nothing on the projector and nothing on their phone. It is a note, not
  an accusation — a phone call looks exactly the same — so it only badges
  somebody from three questions onwards. What you do about it is your call.
- **First letter round** — no options at all: the room gets a keyboard and only
  the first letter of the answer has to be right, so nobody loses a point to
  spelling.
- **A number of questions per round type** — fifteen general knowledge and five
  pictures rather than ten of everything.
- **Four ways for a round 2 picture to give itself away** — zoom out, pixelate,
  come into focus, or tiles coming away. Set per round in the Editor, or `mix`
  for a different one each question. They all get easy at the same rate, so
  which you pick never changes how many points are on offer.
- **Seasonal looks** — a **Look** picker on every pack card next to Launch:
  Halloween, Valentine’s, Christmas, Summer. Changes the colours on the big
  screen and every phone at once. Nothing about how the quiz plays changes.
- **Invoicing** — see step 3 above.
- **Accounts** — see step 2 above.
- **Room for 300 players**, measured rather than guessed, and much faster than
  it was.
- Pictures and Playlist buttons on pack cards, photos from the room, advert
  slides, the rules slide, scores on the big screen, pick-them-all rounds.

---
