# History — where the app has got to, and what each night found

The reasoning behind the history rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## Current state

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
