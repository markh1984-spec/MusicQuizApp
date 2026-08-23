# The console and the control view — launching and driving a night

The reasoning behind the the console and the control view rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## A launch must say what it is about to destroy

`session.inProgress()` and the 409 on `/api/host/launch`.

`launch()` builds a fresh game unconditionally, and that used to be the whole
story — so two people on one login could end each other's night mid-question:
scores gone, every phone back in a lobby, in front of a paying room, with
nothing anywhere saying why. Reachable today by password sharing, which is
exactly what happens the moment somebody decides three subscriptions are too
many.

**It names what is live rather than refusing.** The first press comes back with
the game, the player count and where it has got to — *"The Madonna Quiz is
running right now — 3 playing, Round One — question 1 of 10"* — and a second,
deliberate press carries `replace` and goes through. There are real reasons to
launch over a live game (the wrong pack went up; the night genuinely restarts),
and a control that simply says no is the mistake this file keeps recording.

**ANY joined player counts, lobby or not.** The obvious version guards a game
past the lobby, but forty people who have typed a team name have something to
lose too, and "everybody type your name in again" is not a thing anybody says
on a mic. Nobody joined means nothing to protect, which leaves the ordinary
case — wrong pack up, launch again ten seconds later — completely alone.

**The console had a check and it was blind to the case that matters.** It read
`library.running`, a snapshot taken when the page loaded, so a console opened
before the other device launched reported nothing running and went straight
ahead. It is gone; the server's answer is the only one. Same lesson as the tier
lever: a guard that only lives in the browser is decoration.

## The restart notice, and the one state that made it a lie

`restartNotice()` in `host.js`, fed by `server` in `hostView()`. After a
restart the control view says so plainly — *"the app restarted 5 minutes ago,
scores from before then are gone, 1 phone put itself back in, tap a name to
put their points back"* — because on a host with no permanent disk the only
clue from the front of the room is that everybody is suddenly on nothing,
which looks like a scoring bug rather than what it is.

**It only appears when a phone has turned up holding an id this process never
issued**, which is proof a game was lost rather than a warning on every
startup that you would learn to ignore.

**And a DELIBERATE LAUNCH now clears it, which it did not.** The notice ran on
a twenty-minute timer alone, so launching a fresh night after a restart left
it sitting across the top of the control view telling a game that was running
perfectly that it had lost scores it never had — and offering to put back
points belonging to a game that no longer exists. Seen on a gig day, on the
one screen the host reads with a mic in the other hand.

`joinPlayer()`'s own docstring already said it — *"a game the host launched
deliberately is not a lost one"* — so this was a stated intention that was
never written down in code.

**THE FIX IS A FLAG, NOT A RESET, and getting that wrong first is the lesson.**
Clearing `strandedPhones` inside `launch()` looks right and does nothing: the
phones come back a few SECONDS AFTER the launch, not before, so the count was
zeroed and then immediately counted back to one by the very rejoin the launch
was meant to account for. It was deployed, watched still failing on a live
server, and fixed properly. `launch()` sets `launchedSinceBoot`, and
`joinPlayer()` reads it — so a phone returning to a night that was started on
purpose is never stranded in the first place.

The flag is set in `launch()` and never in `build()`, because `build()` runs
on boot too: a session always has a pack loaded so the projector is never
blank, and **a loaded pack is not a night** — the same distinction
`aNightIsOn()` draws on the console.

Four tests, and the one that matters drives the events in the order they
really happen rather than the tidy one. Both cases were also run against a
live server: a crash with the host touching nothing still shows the notice; a
deploy followed by a deliberate launch does not.

---

## THE RUNNING ORDER IS QUIZ-ONLY, AND A SHOW IS WHY

Decided on 17 August 2026, closing an entry rather than building it.

Tonight's running order takes six packs and `composeQuiz()` welds them into one
quiz. A bingo pack is refused at the door — one line, twice, in
`console-tonight.js` — and the obvious reading is that the guard is the bug.

**It is not, because a SHOW already plays a quiz and then a bingo game**, keeps
the look and the lobby game across the swap, and is
built and tested. Making the running order do it too would mean a second way to
compose the same evening, and **two composers that can disagree is the exact
fault Tonight was built to end** — the console and the projector naming
different nights.

So the split is: **a RUNNING ORDER is rounds within one quiz; a SHOW is games
within one evening.** Those are different jobs and the words are already right.

If it is ever picked up anyway, the work is not the guard: a slot is a bare
pack id, so it would need `{ kind, packId }` and a launch that walks the slots
rather than handing the lot to `composeQuiz()`.

## FOUR PLACES THE CONSOLE DELIBERATELY DIFFERS FROM ITS BUILD PLAN

Recorded on 16 August 2026 while deleting the finished entries out of
`todo/console.md`. Each of these was settled as a plan, built differently on
purpose, and the reasoning would have gone in the bin with the entry.

- **My account is a FOURTH DOOR, not an account chip top-right.** The plan
  settled on a chip; the pill reads better beside the other three and keeps one
  navigation idea instead of two. Calendar sits behind it rather than behind
  Workshop — organisation, not preparation.
- **The tier arranger is a dropdown per row, not a drag.** The business rule it
  existed to serve — *a feature moving up a tier does not take it away from
  people who had it* — is what mattered, and `setFeatureTier()` computes the
  holders BEFORE the table changes and writes `kept` to each. The gesture was
  never the point.
- **A pack already in Tonight stays on the shelf as a dashed ghost** rather
  than being removed from the six. The card visibly LEFT, which is the thing a
  quizmaster needs to see; a card that silently vanishes reads as lost.
- **The benches are per-DEVICE (`localStorage`), not per-account `prefs`.**
  What you were half way through editing is a fact about the machine you were
  editing on, and it is the same reasoning that keeps the venue and the online
  switch off the device: a fact about one evening is not a setting.

## THE CONSOLE IS TWELVE FILES — how it was split, and the two faults it found

`console.js` reached **11,222 lines**, and the cost was not readability: it was
that opening the console at all spent most of a session's context before any
work could start. That is the same argument that split `CLAUDE.md` twice, and
the method is the one that split learned.

### It is a MOVE BY LINE NUMBER, and that is the whole safety argument

A script tiles the original file into spans and writes each span into a new
file. **Nothing reads the content, so nothing can quietly reword it** — a
4,000-line move costs the same as a 40-line one, and a script cannot get bored
half way and paraphrase a function. The plan asserts it tiles exactly: every
line of the original is claimed by exactly one destination, and the total is
checked against the file length. Content preservation was then proved by
sorting every line of the twelve files against every line of the original — the
**only** differences are the module headers, the setter calls, and the import
and `export` lines.

The seams are doors and tabs, because that is what the console already is:

| | lines |
|---|---|
| `console.js` — the shell: keys, `load()`, `TABS`, `render()`, the tab bar | ~1,750 |
| `console-tonight.js` — the launch bar, what is running, tonight's settings | ~2,460 |
| `console-packs.js` — the shelf, a pack card, the pictures, `doLaunch` | ~1,480 |
| `console-account.js` — account, shop, settings, support, help | ~1,280 |
| `console-venues.js` · `console-gigs.js` · `console-invoices.js` | ~640–900 each |
| `console-generate.js` · `console-diary.js` · `console-preview.js` · `console-shows.js` | ~280–620 each |
| `console-state.js` — the shared bindings | ~155 |

### THE MODULE STATE WAS THE HARD PART, AND THE ANSWER IS SMALLER THAN IT LOOKS

The functions move mechanically. The `let`s do not, and this is the part to
understand before moving a line.

**An ES import is a read-only view of the exporting module's binding.** So
`import { library }` followed by `library = x` is not a mistake the tools catch
— it throws *"Assignment to constant variable"* **at the moment the line runs**.
The page loads, every tab draws, and then a drag or a launch dies.

The instinct is to put all the state in one object and rewrite every reference
to `S.library`. **That is the expensive answer and it is unnecessary**, because
**reads are fine**: a live binding reads the current value from anywhere. Only
WRITES are the problem. So the question was asked per binding — *how many
modules write this?* — by scanning every assignment site before anything moved:

- **written by one module → it stays with that module.** `currentPack`,
  `lbExtra`, `lbOff`, `lbVenue`, `lbOnline`, `lbGame`, `tonightOpen`,
  `showWanted`, `showRunning`, `venueWanted`, `packWanted`, `roundDrag`,
  `offDrag` are all written inside the launch bar and never outside it, so they
  live in `console-tonight.js` and need nothing.
- **written by two or more → `console-state.js`, with a setter.** Thirteen:
  `library`, `me`, `lastDone`, `accountsExist`, `bench`, `nightBench`,
  `gigsSeen`, `packDrag`, `venueDrag`, `showDrag`, `nightDrag`,
  `pendingInvoice`, `book`.

**That is 39 assignment lines changed against ~350 read sites left alone**, and
it is the reason the split stayed a move. Every one of the 39 was printed and
read; 38 fitted one rule (`x = <expr>;` becomes `setX(<expr>);`) and the
thirty-ninth was an object literal over five lines, done by hand.

**`console-state.js` imports NOTHING, deliberately.** Every other module imports
from it and several import each other, so the graph has cycles by design —
which is fine for function declarations, because they are hoisted, and fatal for
state, which is not. A leaf cannot be caught half-initialised.

### THE TWO FAULTS, AND NEITHER IS VISIBLE TO ANYTHING THIS REPO ALREADY RAN

**1. A spread is not a property access.** The script that worked out who needs
which import treated `...firstOwnerPanel()` as `.firstOwnerPanel` — a member
access, not a use — so `console.js` never imported it. The console went down
with a `ReferenceError` on the first render. Found in a browser, and only in a
browser: it parses, the tests pass, and a stub-DOM load in Node died on the stub
before it ever reached that line.

**2. The boot call has to be last, and moving it broke the nav silently.**
`load()` runs at the top level and sat at line 10,161 of the original — after
every declaration in the page. Carried along with its neighbours it landed in
`console-gigs.js`, which `console.js` imports, so it ran BEFORE `console.js`
had initialised any of its own bindings. `rights = menuRights(who)` then threw
on a `let` in its temporal dead zone, **`load()`'s own catch swallowed the
error**, `render()` ran with the default `rights` — all false — and the console
drew perfectly, correctly, on every tab, **with the Workshop door missing from
the nav**. No error on screen, no failing test, no visual defect anywhere else.

Worth sitting with, because it is the more instructive of the two: a catch that
exists to name failures hid one, and the symptom was a single missing link in a
menu. The fix is that the boot block is carved out by line number and appended
to the end of `console.js`, which is where it already was.

### WHAT PROVED IT, and why the screenshots were the wrong instrument

The claim a refactor has to support is *nothing changed*. Pixels turned out to
be the wrong evidence — the console's washes drift on a timer, so two runs
freeze at different points and **all 34 screenshots differed** while being
visually identical. The right instrument is the MARKUP: the rendered
`body.innerHTML` of every tab on every door at 1280 and 390, dumped from the
original and from the split and compared as text. **34 of 34 byte-identical**,
signed in as a real quizmaster so every gated tab actually rendered — on the
host key most of them never draw, and a missing import only throws when the
function RUNS.

Both launches were then pressed in the browser for real, which is what
`CLAUDE.md` has said to do since the day an unimported function shipped a broken
Launch: a quiz and a bingo pack, each ending with the projector at
`phase=lobby`. And `pub-unchanged.mjs` against `HEAD` says the engine is
byte-for-byte what it was, which it should be — nothing outside `public/` and
`test/` was touched.

### The guard, and what is left

`test/console-split.test.js` asserts the three properties that fail silently: no
module assigns to a name it imports, `console-state.js` imports nothing, and no
module grows back past its budget. Each was verified by breaking it and watching
it fail. `test/console-source.js` is the other half — five checks in the suite
grep the console as TEXT and were all pointed at the single file; they read all
twelve now, because a grep aimed at the wrong file proves nothing.

**The next seam is `launchBar()`, which is 1,700 lines on its own** and most of
why `console-tonight.js` is still the big module. That one is a real split
rather than a move — it would mean deciding what the bar's parts are — so it
waits for a reason beyond tidiness.

## CHANGING TAB DOES NOT MOVE THE PAGE

`renderKeepingPlace()` in `console.js`. Asked for on 15 August 2026: *"can
clicking across the tabs keep the page in place? So if I'm scrolled 100 pixels
down on one tab I click into another tab and it loads scrolled 100 pixels
down."*

**This is the third arrangement of one behaviour, and the two below are kept
because each was right about the console it was written for.** What retires
both is that they MOVE THE PAGE, and moving the page is only worth it if there
is something to get away from — there is not any more. Tabs are one page with
the middle swapped, and jumping to the top on every press makes them feel like
nine separate pages.

**It has to HOLD the scroll rather than merely decline to change it**, which is
the part that looks like a one-line deletion and would not work. `render()`
replaces the whole of `mainEl`, so for an instant the document is short, the
browser clamps `scrollY` to the new maximum, and putting the content back does
NOT put the scroll back. Read the offset before, write it after. A shorter tab
still clamps, and that is correct rather than a case to handle: there is
nowhere else for it to go.

### What it replaced, and why each was right at the time

The host's own words the first time: *"would be good if a click on a tab made
the tabs appear to be the top of the page, so you can always just scroll up
from there to get to the launch bit."*

It jumped to `top: 0`, which puts **Tonight** back on screen every time you
change tab — so the thing you actually pressed for starts a section and a half
down, and you scroll past the launch panel to reach it. The other way round,
every tab opens at its own first line and Tonight is exactly one flick UP, **in
the same place on every tab**, which is the whole reason that panel sits above
the bar rather than inside one.

**Measured off the sticky topbar rather than a written-out number**: that bar
WRAPS on a phone, so it is 54px on a laptop and a good deal more with the doors
on a line of their own — a constant would hide the tabs underneath it on the
device this is most often held on. Measured after `render()`, because the bar
is rebuilt on every one.

---

## THE CONSOLE'S THEME — one surface, one heading ladder, a bar that stays

Settled on 14 August 2026, after the host looked at the tabs together and
said: *"we REALLY need to look at UI, stuff is all over the place and the
colours are not singing at all"*, then *"there's tons of different colours,
fonts, font sizes etc. — we need a general theme that everything sticks to"*
and *"the menu should wrap to the screen on a laptop"*. Four options were
rendered against the real page before he chose; the pictures were the
argument, not the paragraphs.

**THE CONSOLE WAS THE ONE SURFACE IN THIS APP WITH ITS AMBIENCE SWITCHED
OFF.** `body.console` painted a flat `#0b0b14` and `body.console::after {
display: none }` killed the drift — so the corner washes and the two blobs
that set the mood on the projector, the phone and the join page were off on
the page a quizmaster spends the most time in. Flat near-black, grey cards,
the account's colours reaching **one button a screen**, and the most
saturated thing on the page the destructive red. That inversion is what "the
colours are not singing" was: the loudest colour belonged to the control you
least want pressed.

**ONE SURFACE, TINTED WITH THE ACCOUNT'S OWN COLOUR** — `--surf-1`,
`--surf-2`, `--surf-line`, applied by overriding `--panel` and `--panel-line`
**for `body.console` alone**. That last part is the point: twenty-nine rules
said `background: var(--panel)` and four more had written their own grey out
by hand, which is how four slightly different greys existed with nobody
having chosen any of them. One override is one decision; twenty-nine edits
are twenty-nine chances to drift again.

**AND THE SURFACES ARE OPAQUE, WHICH IS LOAD-BEARING RATHER THAN
INCIDENTAL.** Turning the washes on with the cards left translucent was
rendered as its own option and is WRONG: a card sitting over the pink blob
comes out pink and one over black comes out grey, so the same pack card is a
different colour depending on where it lands in the grid. That is the "all
over the place" complaint wearing a coat, and it is only visible in a render
— which is why the options are rendered. Opaque, the background can be as
alive as it likes.

**THREE HEADING STEPS, AND THE TAB'S OWN IS DRAWN IN ONE PLACE.** The top of
the page used to change shape as you moved along the bar: Music Quiz gave one
22px heading and two small ones inside cards, Calendar and Gigs opened with a
22px heading, and **Venues, Adverts, Help and My account had none at all**.
So `tabBody()` now prints the tab's own label as the heading — in the account
gradient, at `--fs-title` — and a section under it drops to `--fs-head` and
stays white.

- **In `tabBody()` rather than in nine render functions**, because a heading
  each is exactly the arrangement that let four of them go missing. It reads
  the tab's own label, so the heading and the lit chip cannot disagree.
- **It repeats the lit tab deliberately.** A chip in a row of nine says which
  is on; a heading says what the page IS, at the size everything below it is
  measured against. Without one, the first thing on four tabs was a small
  bold word inside a card — a subheading of nothing.
- **The demotion is not optional**: left at one size, Gigs printed "Gigs",
  "Headcount" and "Past gigs" identically, which is three tabs as far as the
  eye is concerned.
- **The gradient is safe on a heading where it would not be on a button**,
  because a heading is not something you press — which is the whole reason
  that fill is otherwise rationed to one control a screen. Behind an
  `@supports`: gradient text is TRANSPARENT text, so a browser without
  `background-clip` would draw the heading on every tab invisible.

**THE TAB BAR WRAPS, THEN STOPPED NEEDING TO.** Nine tabs came to about 993px
against the console column's 968, and `overflow-x: auto` **cut "My account"
in half at the right-hand edge with no scrollbar drawn to say it could be
reached** — a tab you cannot see is a tab that does not exist. Wrapping fixed
it and cost a second row; tightening the tabs' side padding from 18px to 14px
fits all nine on one, which matters because of the next paragraph.

**AND IT IS STICKY FROM 860px, WHICH IS WHAT REMOVED THE RESERVED HEIGHT.**
The host asked for a tab press to leave the bar at the top of the screen so
Tonight is one flick up. The first answer was `min-height: 78vh` on
`.tabbody`, because a short tab had nowhere left to scroll — and that is why
it *"worked on some tabs and not others"*: Adverts, Gigs, Invoices and Venues
were simply too short, and the ones that FETCH are a heading and "Loading…"
at the instant of the scroll. It worked and it left most of a screen of black
under a nearly-empty tab. Sticky, there is nothing to scroll TO and nothing
to reserve. Below 860px it scrolls sideways as before, because nine tabs
would be three rows on a phone and a sticky three-row bar would eat the top
of every tab all night.

**THE OLD SCROLLING MEASURED THE TAB BODY, NOT THE BAR** — kept here because
it is a trap rather than a rule about tabs. A sticky element lies about where
it is: once pinned its `top` is the pin position rather than its place in the
document, so "scroll until the bar is at the top" is a no-op the second time
and jitters by the gap the first. The body underneath is never sticky, so its
rectangle is the honest one. Nothing measures anything here now, because
changing tab no longer moves the page.

**A HEADING'S BUTTONS ARE A ROW, AND `.game-head .row` WAS NEVER TOLD TO BE
ONE.** `.host .row` and `.panel.pics .row` are both `display: flex` with a gap
and wrapping; this one had `margin-left: auto` and nothing else — so its
children were loose inline-blocks that broke onto a second line at whatever
width each happened to be. That is Adverts' "New set" hanging under the end of
"Bring in a picture", and Invoices' three buttons at three heights.
`align-items: stretch` rather than `center`, because two of them are a
`<label>` and a `<button>` with different padding: centred they share a
midline and still read as two different sizes.

**THE ACCOUNT-COLOURED UNDERLINE ON ORDINARY BUTTONS STAYS**, put to the host
with the alternatives and kept. It is the decision this file already records —
colour on the EDGE, never the face, so one button says whose app this is and
six in a row still say it once — and now that the surfaces carry the same
colour it reads as of a piece rather than as a stray line.

---

## The tabs run LEFT TO RIGHT along a quizmaster's evening

`TABS` in `console.js`. **Music Quiz · Music Bingo · Adverts · Gigs ·
Invoices · Venues · Help · My account**, with **Tonight** above all of them.

The host's framing, on 14 August 2026: *"I want the flow to go from left to
right, because some sections hand over to each other. When a quizmaster has
done a job, that job goes into his past gigs — and from past gigs he goes to
invoices, because you don't have an invoice for a gig you haven't done yet."*

So the bar reads as an evening: what you will PLAY, what goes between the
rounds, the NIGHT itself, getting PAID for it, the standing arrangements
behind all of it, then the two you touch twice a year.

**VENUES MOVED RIGHT, past Invoices, and it is the one that looks wrong.**
Everything downstream depends on that record, which makes it feel like a
starting point — but **dependency is not sequence**: a venue is set up once and
then not opened for months, which is exactly what the right-hand end is for.
What made it feel early is that you used to have to go there before launching,
and Tonight removed that — the venue, its prizes and its usual night now arrive
in the launch bar without going anywhere. **This is the one to move back if a
real week says otherwise; it is a line in an array.**

**GIGS SITS AT BOTH ENDS OF THE JOURNEY** and is the one tab a timeline cannot
place: it holds Coming up as well as Past gigs. Splitting it would make the
order honest and add a tenth tab to a bar that already scrolls sideways on a
phone, so it stays whole and sits where the night is.

**Rarely-touched goes right, and that is the host's own rule** — "the farthest
right needs to be settings, because it is something he would rarely touch but
needs to know where it is". My account keeps its name rather than becoming
Settings: it holds the subscription, the tier and the brand, which is whose
account rather than the app's options, and this file's naming rule is to say
what the thing IS.

**A reorder is the cheapest change in the app and the easiest to get wrong
silently** — nothing fails, a tab simply stops being where somebody's thumb
expects it. Every tab was opened in a browser afterwards at 390 and 1280, and
the page measured for overflow after visiting all eight.

---

## DRAG AND DROP — the console is the laptop with the HDMI in it

`gripIcon()` / `dragRow()` in `editor.js`, `packDrag` in `console.js`.

**Argued against and then overruled, correctly.** The case against drag is
touch: this codebase already learned it once, when the props tray's
drag-to-move ate the scroll and had to grow a 200ms hold. The host's answer
settles it — *"this app needs to function from a laptop really, otherwise how
are you going to HDMI into a large screen?"* The console IS the laptop. A
mouse is the input it has to serve.

**The taps and the arrow buttons STAY, and that is not hedging.** HTML5 drag
events do not fire on touch at all, and this file's own rule has the console
measured at 320px — so a control that exists only as a drag is a control that
does not exist on a phone. Drag is the fast way; every drag has a way round it.

What can be dragged:

- **A round, by its head, onto another round's head.** The head rather than
  the block, because a round block is mostly question cards and those refuse a
  round — so a drag aimed at the middle of a round quietly did nothing.
- **A question onto another question**, in the same round or a different one,
  and onto a ROUND'S HEAD to land at the end of it — which is the only way to
  reach an empty round.
- **A pack card up to Tonight.** It carries the game as well as the id, so a
  bingo pack dropped on a bar set to Music Quiz switches the bar over rather
  than being silently refused.
- **A VENUE card up to Tonight**, from the Venues tab — the same gesture and
  the same target, because those are the two facts that place a night: which
  room, and what is being played in it. Only a SHUT card is draggable; an open
  one is full of prize boxes, and `draggable` on their container stops you
  selecting a word to retype it, which is why a pack is dragged by a grip.
- **And the chosen pack back OFF Tonight**, which un-chooses it and NOTHING
  else — the pack is untouched on disk and still on its shelf. *"Say you drag
  the wrong quiz pack, you can just drag it off again."*

**ADVERTS ARE DELIBERATELY NOT DRAGGABLE, and it was asked for directly.** The
scenario was: the pack is wrong, the venue is wrong, and the advert is wrong,
so drag all three in. The first two are right; the third dissolves on contact
with how adverts already work, for three reasons:

- **A slide belongs to a VENUE, not to a night** (`src/adverts.js`), and that
  is a sales decision — *"your Tuesday pizza deal goes up between every round,
  every week."* So dropping the venue in brings its adverts with it and there
  is nothing left to drag.
- **There is no "tonight's advert" to drop into.** A slide is chosen LIVE on
  the control view between rounds (`state.advert`), not at launch. Building
  the drag would mean inventing the concept first.
- **Dragging one venue's advert onto another venue's night is a mistake with a
  room in front of it** — the Sheep & Hound's offer in front of the Dog &
  Duck's customers.

**What was actually awkward is fixed where it happens.** The control view's
picker loaded every set, so standing in one pub you scrolled past seven others'
offers mid-gig. It now puts tonight's venue first under its own name, with
**Everything else** below — sorted rather than FILTERED, because a slide with
no venue on it ("follow me on Facebook", a sponsor, a charity night) is a real
thing somebody wants anywhere, and a filter would hide it.

**CHANGING THE VENUE RE-RESOLVES A NIGHT THAT IS UP BUT EMPTY — and not doing
so was a silent fault the auto-launch introduced.** The prizes, the voucher and
the come-back slide are read off the venue AT LAUNCH and copied into the state.
So the sequence somebody would actually use — drag the pack in, notice the
venue is last week's, drag the right one in — launched the night under the
wrong pub and left it there: the bar said The Dog & Duck and the winner's phone
would have shown the Sheep & Hound's voucher. `chooseVenue()` now relaunches
quietly through the same `switchIfFree` guard, so it fixes itself while nobody
has joined and does nothing at all the instant somebody has.

**And once it CANNOT re-resolve, the bar says so** — *"On the big screen now —
this one, but filed under The Dog & Duck. Launch again to move it."* Without
it the bar would show the new venue's prizes while the room was being shown the
old venue's, which is the console-and-projector disagreement this section
exists to end wearing a different hat. A wrong pack name is embarrassing; a
wrong prize is somebody being refused a drink at the bar.

**TONIGHT PINS ITSELF WHILE ANYTHING IS BEING DRAGGED** (`body.is-dragging-card`).
The section is at the top of the tab and a venue card can be most of a page
below it; HTML5 drag has no dependable auto-scroll, so without this the gesture
is "pick the card up, find the target off-screen, give up" — worse again on a
trackpad. **It also accepts a drop while SHUT and springs open on the way**,
because collapsed is exactly the state somebody is in when they arrive at a
venue and start setting up.

**A ROUND IS SWITCHED OFF WITH A TICK, NOT DRAGGED OUT.** The host's own
design once the pack tiles existed: *"have the rounds in the quiz pack with a
green tick each, and to turn one off you click the green tick and it turns
into a cross — removes the need to drag and drop sections of a quiz pack."*

**It is better than the round-level drag it replaced, and the reason is
bigger than tidiness: a drag is a LAPTOP-ONLY gesture.** HTML5 drag events are
never delivered on touch, so round-dragging did not exist on a phone at all —
on a console this file has measured at 320px. A tick is a tap, so the same job
now works on both, with no second way of doing it to keep in step.

Four things that are load-bearing:

- **ANY round can be switched off, including the last** — and a pack with all
  of them off is simply an empty pack. It was built refusing the last tick,
  which guarded something real (the server will not launch a night with no
  rounds) in the wrong place; the host's own fix was *"the launch console
  should just treat a pack with all red crosses as an empty pack."* Better for
  two reasons: **a tick that will not toggle is a control that ignores you**,
  and the constraint already had a home — Launch is hollow when there is
  nothing to launch, so "every round is off" is another way of having nothing,
  said in the one place built to say it. The spent pack stays in the row,
  dimmed and dashed like the empty slots beside it, because it is one tap from
  being back and making somebody find it on the shelf again would be the app
  punishing a change of mind.
- **Switching one off makes it a COMPOSED night even with one pack**, so
  `nightOrder()` asks whether anything is off rather than only counting packs.
  Miss that and the ticks look like they work and change nothing.
- **The Launch button names what will be PLAYED.** "Launch The 1980s Pop Music
  Quiz" over a pack with two of its three rounds off is the console and the
  projector disagreeing before the night has started, which is the fault this
  bar exists to end.
- **`stopPropagation` on the tick's mousedown as well as its click**, because
  the tile itself is draggable — without it a press on a tick starts dragging
  the pack instead of switching a round off.

Keyed by pack AND index rather than by round title: two packs can both have a
round called "Round one", and a title is a thing somebody renames.

**MIXING ROUNDS FROM TWO PACKS BELONGS TO THE NIGHT, NOT TO THE EDITOR — and
that is why it is not built.** It was asked for as *"mix and match 1980s A and
1980s B without affecting the master copies"*, and two editor layouts were
rendered for it. The host then reframed it and the reframing is better than
either: *"the only reason you would drag a round out of one quiz into another
is so that you can launch the night — so I think that happens in the night
section."*

He is right, and it changes what the feature IS. In the editor it is
pack-authoring, which needs copy-on-write, a naming decision and an answer to
whether a borrowed question stays linked to its source (see rule 11). In
Tonight it is **building this evening's running order out of pieces**, which
touches no master at all and may not need to be saved as a pack in the first
place.

**Left unbuilt deliberately**, at his own call — *"if people want that advanced
functionality later on we can add it later"*. If it is picked up, start from
the night rather than from the editor.

**A question changing rounds is reshaped on arrival**, exactly as when a
round's own type is changed: a text question dropped into a pick-them-all
round needs six options rather than four, and nothing typed is thrown away.

**Two bugs worth remembering.** `moveWithin()` has to allow for the source
already being removed from the list — the classic off-by-one that makes a drag
"not move" when you drop it one place down. And the drop marker has to be
ABOVE or BELOW depending on which half of the row the cursor is in, or a list
can only ever be reordered in one direction and the last position is
unreachable.

**The grip is drawn and the card is not draggable as a whole**, because a card
is full of text boxes and `draggable` on their container stops you selecting a
word to retype it.

---

## TONIGHT — one launch section, at the top of every tab

`launchBar()` in `console.js`, drawn above the running panel on every tab.

**It was called "Quick launch", which said how FAST it is rather than what it
is for** — and it behaved that way: two shortcut buttons that deliberately took
no settings, with the look, the card shape, the prizes and the venue living
somewhere else entirely, on a pack card, in a grid, further down whichever tab
you happened to be on. The fast path and the fully-featured path were two
different controls in two different places and you had to know which one you
were in.

The host's brief, on 14 August 2026: *"the second he gets to his console it
should be very obvious that the top of every page is a launch section —
wherever he is, he can launch from there, and it needs to be fully featured.
Sometimes you just don't want to think, you want to get in and go and know it
will work."*

- **Tonight's pack is already chosen** — the same `quickPicks()` the two
  shortcut buttons used, in a box you can type over. Nothing to find, no
  typing, one press. The runner-up is a CHIP beside it rather than a second
  gradient button.
- **Tonight's venue is printed at the top**, because it decides the prizes, the
  voucher and what the night is filed under. It was previously visible only as
  small print on a shortcut button.
- **Set it up** opens the rest — look, card shape, prizes, teams, online,
  venue. **Shut by default**, because a dropdown on the panic control defeats
  the panic control; **one tap away**, because "it is somewhere else" is
  exactly what was wrong before. Its open state is remembered outside the
  render, like every other panel here: this one is rebuilt every time a phone
  joins.
- **ONE gradient button on the section.** There were two shortcut cards and a
  pack card's Launch, all wearing the account's gradient on one screen, which
  is the GUI rule broken three ways.

**WHOSE NIGHT IT IS, RANKED — and the ranking was wrong.** `tonight()` in
`diary.js` merged the diary and the residencies into one list of claims and
treated them as EQUALS, so a one-off typed for tonight at The Anchor and a
live Thursday at The Crown cancelled each other out and the bar went blank.
That threw away the one answer somebody had actually stated. The order is: **a
date you typed, then whose usual night it is, then where you played last** —
which is the rule `upcoming()` already followed when a booking landed on the
residency's own venue, and it simply never applied across venues. Ranked by
asking `bookings` rather than by the `why` label, because a booking on the
venue's own usual night is deliberately reported as `usual` so the line reads
"your usual night here" rather than announcing a diary entry for a Thursday you
always do.

**TWO ANSWERS FOR ONE NIGHT ARE NAMED, not left blank — and the words matter
here.** It is NOT a double booking: one quizmaster is in one room, so at most
one of the two is where they actually are. What has gone wrong is the APP's
understanding, not the diary. Two typed dates, or two residencies on one
weekday, cannot be told apart by anything the app knows —
picking whichever sorted first would put one pub's prizes in front of another
pub's room. So nothing is chosen, and `clashTonight()` says which two: *"The
Anchor and The Crown both claim tonight — pick one under Set it up."* In gold
rather than red, like "not invoiced": nothing is broken, it is a decision only
the human can make. A silent blank on the field that decides the prizes, the
voucher and what the night is filed under looks exactly like an app that is
working.

**IT FOLDS TO A THIN LINE, AND THE LINE STILL SAYS WHAT IT IS SET TO.** The
host's own sequence is the spec: *"I get to the venue and it is right there. I
don't need it yet — the venue wants the prizes changed, so I collapse it, go to
the Venues tab and do my thing, then open it again when I am ready."* So the
state is kept in `localStorage` rather than a variable: changing tab re-renders
the whole page, and the point is that it survives that AND the next visit. Open
is the default, because being the first thing you see is what it is for.

Shut it is ONE ROW — *"Tonight · The Crown · The 1980s Pop Quiz"* and a way
back in — and it has to stay one row: collapsed that takes three lines on a
phone is not collapsed, it is smaller. It does not wrap, the middle
ellipsises, and below 560px the venue drops rather than the pack, because the
pack is what the button would launch. **The whole row is the target when it is
shut**, not just the chevron: one small control on the end of a bar is a thing
you miss with a thumb in a dark pub.

**THE CONSOLE AND THE BIG SCREEN MUST AGREE, ALWAYS — reported from a real
night.** *"The quiz in the launch bit after I pressed launch didn't say what
the big screen said."* Two separate causes, both fixed:

- **The bar re-picked itself on every render**, and `render()` runs on every
  state push. Worse, launching a pack gives it a play time, so `quickPicks()`
  sorts it away and the box starts offering a DIFFERENT quiz from the one the
  room is looking at. A choice now STICKS: the auto-pick is the empty state and
  nothing else.
- **With nothing chosen, it now starts on WHAT IS RUNNING** (`running.packId`)
  rather than on `quickPicks[0]`. That is what a page reload produced — come
  back to the console after launching and the panel named a pack nobody had
  chosen, one press away from replacing a live night with it.

**AND PICKING A PACK NOW PUTS IT ON THE BIG SCREEN — when nothing would be
lost.** The host's own conclusion after the two disagreed on a real night:
*"changing quiz packs should change the console and the big screen."* Right,
and the two should agree every time it is possible for them to.

**But picking is not launching when there is a night to lose.** A tap on a
search result that silently ended a running quiz and wiped every score would
be the most dangerous control in the app, on the protected path, in a dark
pub. So: switch instantly when it costs nothing, stage it when it would cost
somebody their night.

**THE SERVER DECIDES WHICH, and there is no new rule.** It is the ordinary
launch call without `replace`, which already answers 409 when
`session.inProgress()` — a guard this file already records as one that cannot
live in the browser. A 200 means it was free to switch; a 409 means it was
not. No second definition of "in progress" exists to drift.

**A 409 is SILENT here — no dialog.** Pressing Launch is what asks that
question and still does, with the warning it always gave. All a 409 means at
this point is that the choice stays staged and the red line says the
projector is showing something else.

Two things the build had to get right, both of which would have been silent
faults:

- **A re-render is not somebody choosing a pack.** `startOn()` calls `pick()`
  on every state push to keep the box filled, so it passes `quiet` — without
  it the bar would relaunch the projector every time a phone joined.
- **What is running afterwards is READ BACK from the server**, never assumed.
  Filling that line in from our own optimism would be the original fault
  wearing a new hat.

**And where they still differ, the bar SAYS SO.** `paintLive()` prints *"On
the big screen now: The 2000s Pop Rnb and Chart Quiz"* off `library.running` —
the server's own view of the session, so it cannot drift — in gold when it is
not what the box says, which is exactly the moment somebody is about to be
surprised. When they match it says *"On the big screen now — this one"*. A
chooser answers "what would the next press start"; that is a different
question from "what is on the projector", and they are only ever the same by
luck.

**IN THE ROOM / ONLINE IS A SWITCH IN THE HEAD, beside the venue** — `lbOnline`
and `.lb-mode`. It was a `<select>` behind Set it up, filed with the look and
the card shape, and it is not that kind of decision: getting the look wrong
costs a night some colours, and getting THIS wrong puts the question on sixty
phones in a pub, which breaks rule 8 in front of a paying room and cannot be
undone mid-question. **A setting whose wrong value ruins the night belongs
where it is read, not where it is hunted for.** It is also the one control here
with exactly two answers, and a dropdown for two answers hides one of them.

Four things, all measured at 1280, 390 and 320:

- **The venue says which room; this says whether there is one.** They are the
  two facts that place a night, so they sit together.
- **Only the ONLINE half wears the gradient.** "In the room" is very nearly
  every night, and a permanently filled gradient sitting directly above Launch
  would be a second "press this" on the one section allowed exactly one. Off is
  silent, on is unmissable — the same argument that keeps Delete outlined.
- **SHUT, THE LINE STILL SAYS "Online"**, and that is most of why it was worth
  moving: folded away is exactly the state somebody launches from without
  opening the panel. "In the room" adds nothing to that line, because a label
  that is always there is a label nobody reads. At 320 the pack title
  ellipsises hard behind it — accepted, because it was already truncated to
  "The 198…" at that width and the dangerous fact is the one worth the pixels.
- **It is gone from Set it up rather than kept as a second way in**, exactly
  like the venue picker before it. Two controls for one field is how a night
  gets launched with the setting the other one was showing.

**Not remembered on the device**, unlike the fold: online is a fact about one
evening, and a remembered one would put a pub's question on sixty phones
because of a Zoom quiz three weeks ago.

**THE VENUE IS A CONTROL AT THE TOP, not a caption and not a dropdown buried
in Set it up.** It decides the prizes, the voucher and what the night is filed
under, so it is read nine times out of ten and changed on the tenth — covering
somebody else's Tuesday, or a monthly somewhere different. Tapping the line
opens a SEARCHABLE list drawn from the Venues tab and from where you have
actually played (either list alone leaves somebody hunting a pub they know is
there), with **Somewhere else…** for a one-off — which must never need a
record made for it first, the promise the night's free-text venue was built on
— and a link to the Venues tab for a pub worth keeping.

**It is the ONLY place a venue is chosen now.** The picker inside Set it up is
gone rather than kept as a second way in: two controls for one field is how a
night ends up filed under the pub you were at last week. The prize line moved
up with it, because a statement of what tonight plays for, three taps away
from the name it belongs to, is a line nobody reads.

**Not remembered on the device**, unlike the fold state: `lbVenue` starts
`null`, meaning "nobody has said", which is what lets the app keep offering
tonight's own answer until somebody overrides it. A remembered venue would
file next Tuesday under last Thursday's pub.

**THE HEADING DOES NOT MOVE WHEN IT FOLDS, and getting that right took a
grid.** The head row was a wrapping flex row, so on a phone the venue pushed
the fold button onto a second line when the section was open and onto the
first when it was shut — "Tonight" sat six pixels lower in one state than the
other, which reads as the whole page re-laying itself around the control you
just pressed. It is a three-cell grid now with **all three children placed
explicitly**: left to auto-placement, moving the middle cell to a second line
on a phone let the button fall into column 2, the third column collapsed to
nothing, and the button sat 10px shy of the right edge. Measured rather than
eyeballed — the heading's and the button's bounding boxes are compared open
against shut, at 390 and 1280.

**And the fold control says HIDE and SHOW.** It said "Hide" open and "Launch a
night" shut, which answer two different questions — what the button does to the
panel, and what the panel is for. It also needs a fixed width, or the two words
shuffle it sideways as you press it; that rule has to out-specify the head's
own `min-width: 0`, which was quietly winning and is what made the button 96px
open and 78px shut.

**The two small buttons share a row** — the runner-up pack and Set it up, which
are both "not this one" and "not like this". Launch keeps the full width under
them: it is the one press-this on the section, and a primary button squeezed in
beside two minor ones stops looking like one.

**The pack cards keep their own Launch for now**, deliberately: this is the
protected surface, and swapping a working control for "loads it into the bar"
on the same day as the redesign is two changes to one path. That is the next
step, not this one.

**And it found the seventh instance of the min-content fault.** `.lb-set` was a
wrapping flex row, and a `<select>` will not go below the width of its longest
option — "Online — the question goes on their phones" dragged the whole console
90px off the side of a 320px phone. Grid, `min-width: 0` on the children,
`max-width: 100%` on the selects. **Measure `scrollWidth` against
`clientWidth` after anything structural**; nothing else finds it.

### A CARD SHAPE DEFAULTS TO ITS BEST FIT, NOT WHATEVER THE PACK WAS GENERATED WITH

`bestBingoShape()`/`bingoShapeLabel()` in `public/assets/client.js`, used by
`shapeOptions()` (`console-packs.js`, the Set-it-up tab) and
`packOwnShape()`/`shapeOptionsFor()` (`console-tonight-mix-ui.js`, a bingo
tile in the mixed row). Reported live, from a real gig: *"forty songs on a
four by four... from the bingoer's perspective, they're not even getting a
song fifty percent of the time."*

**THE MATH WAS ALREADY IN THE APP, JUST POINTING THE OTHER WAY.**
`minimumTracks()` in `src/bingo.js` refuses a card shape until the pool is at
least 1.5× its squares — the rule that stops two cards looking alike. Nobody
had asked the same question forwards: given how many tracks a pack actually
has, which of the shapes that are still valid uses the MOST of them.
`bestBingoShape()` is that one line — the shape with the most squares among
the ones `trackCount >= minimum` — and for the reported case (40 tracks) it
lands on 5×5, exactly the host's own answer, because 5×5 is the biggest
shape `minimumTracks()` still allows a 40-track pool to fill.

**PACKED INTO THE LABEL ITSELF RATHER THAN A SEPARATE WARNING** — "5×5 —
line of 5 · 25 of 40 songs on a card" — because "line of N" already tells
you how long a WIN takes and this is the other half of the same decision,
how much of the pack a player actually holds. Reading every option is then
an informed override rather than a guess, which beats refusing a small card
outright: a strip might be exactly what a phone-heavy room wants, and "too
small" is a taste call rather than a rule to enforce.

**IT COUNTS SONGS RATHER THAN QUOTING A PERCENTAGE, AND SAYS "DRAGS" IN
WORDS.** *"63% of calls hit your card"* was reported as awkward: *"your
card"* is ambiguous on a screen only the quizmaster reads, and a percentage
has to be converted before it means anything. Under half the pack it now
says `drags` — boundary inclusive. Full reasoning on `bingoShapeLabel()`.

**THE DEFAULT NO LONGER TRUSTS `pack.cardRows`/`cardCols`** — what a pack
happened to be generated or imported with, not a decision anyone made about
tonight. "THE CARD SHAPE IS CHOSEN AT LAUNCH, not stored on the pack" was
already the rule; the default just was not living up to it. **Both pickers
were carrying the SAME logic in two slightly different shapes before this**
— `shapeOptions()`'s own fallback chain and `packOwnShape()`'s, found while
fixing one and about to be the exact kind of drift this app keeps a rule
against, so both now call the one shared function in `client.js` rather than
each keeping its own copy.

**A LATENT BUG FOUND ON THE SAME PASS**: `packOwnShape()`'s old ultimate
fallback (nothing stored, nothing fits) was `shapes[shapes.length - 1]` — the
LAST shape in `CARD_SHAPES`, an 8×3 strip needing 36 tracks, handed out
regardless of whether the pack actually had that many. `bestBingoShape()`'s
own fallback is the FIRST shape (3×3, the smallest, hardest to outgrow)
instead — safer when the track count is not known to be enough for anything.

Verified live against real 40-track packs from the catalogue
(`motown-soul.json`, `pub-floor-fillers.json`, `rock-anthems.json`): the
Set-it-up Card picker defaults to 5×5, every option states its own
percentage, Prizes stays in sync when the shape is changed, and a bingo tile
in the mixed row defaults the same way.

---

## A TAP PLACES THE PACK — ON EITHER DOOR, AND THE CARD NEVER OPENS AGAIN

`packCard()`, `packActionsMarkup()`, `wirePackActions()` in `console-packs.js`;
`workBench()` in `console.js`. Asked for directly, on 21 August 2026: *"when
you click a quiz pack here it needs to open up in the bench."*

**The card's own inline expand was the last thing standing between this and
the Console door's own rule.** A tap on the Console had already put a pack
straight into Tonight for a while — "a caret that expands to an empty panel
is the same fault as the venue name that looked pressable and did nothing,"
recorded when Tonight took the settings off the card. But Workshop's cards
still opened in place, because they still had something real behind the
caret: Read, Rename, Delete, Pictures, Playlist. Moving the click meant
moving those five first, or the tap would place the pack and strand the only
way to manage it.

**So they moved to the bench, not to a popover or a second panel.** The bench
already held one pack for editing — "ONE pack, not a list… a bench with six
slots would be inviting a job nobody does" — and it is the one surface on
Workshop that already knows which pack is current. `packActionsMarkup(kind,
pack)` builds the row (Rename, Playlist/Rebuild/Make playlist, Download,
Pictures, Delete, each gated exactly as before — `mine`, `ownPack`,
`ownersJob`, `hasPictureRound`, `hasIntroRound`); `wirePackActions(el, kind,
pack)` wires it, called only when a pack is actually on the bench, so the row
appears and disappears with the tile above it rather than sitting there
disabled. Read stays off the list — the bench already has "Read it through"
beside "Edit the questions", and a second button with the same job is the
exact collision `packWord()`'s own history warns about.

**Its own class, `.bench-pack-actions`, not the Post gig bench's
`.bench-actions`.** The two names are close and mean different things —
`.bench-actions` is already "one row flexed to fit"; reusing it here would
have fought `.pack-actions`'s own grid for the same property, which is the
label-collision fault Sweep mode exists to catch, self-inflicted instead of
caught.

**The click handler is now three lines, one branch per door**: `addToTonight`
on Console, `putOnBench` on Workshop, no third case, because there is nothing
left for a card to open on either one. The `openPack` Map, the `open`/`shut`
class toggle, the caret glyph and its console-only suppression, and the
tinted-open background all went with it — not left disabled, deleted,
because a rule that can never fire is worse than no rule: it is a comment
above dead CSS telling the next session something true about a state that
can no longer exist. `putOnBench()`'s own doc comment was wrong too, copied
from `putNightOnBench` and never corrected — it said "a night," and the
function has only ever benched a pack.

**Verified live, not just read**: a real browser cycling all six packs in the
library through the bench, confirming the gated buttons match `hasPictureRound`/
`hasIntroRound`/`ownPack` per pack, confirming Rename's `prompt()` fires and a
cancel leaves the bench untouched, confirming the "×" clears the actions row
along with the tile, and confirming the Console door's tap still lands in
Tonight with no caret anywhere. The check incidentally triggered a real quiet
launch on the test server (Tonight's own documented behaviour — a pick lands
on the big screen when nothing would be lost) and restored the original quiz
afterwards rather than leaving the test server's state altered.

---

## THE PACK EDITOR LOST "LOOK", AND TONIGHT GAINED A TIMER

`console-tonight.js`'s `tonightSettingsPanel()`, `pack-editor.js`'s
`quizHeader()`/`bingoHeader()`, `session.js`'s `launch()`, `engine.js`'s
`questionSeconds()`. Two small changes asked for in the same breath, on 21
August 2026, while looking at the editor's own header bar: *"these settings
(as well as prizes etc.) are exactly what should appear on the bench instead
of inside the packs."*

**"Look" WAS ALREADY REDUNDANT — it just had not been noticed.** The pack
kept a default and Tonight already overrode it at every launch, exactly the
way prizes work: the editor's copy only ever set a fallback nobody needed to
set, because Tonight's own picker resolves it every time regardless. Two
controls for one field is the exact fault Tonight itself exists to close —
*"Two controls for one field is how a night gets launched with the setting
the other one was showing."* Deleted from both headers rather than left
disabled; the now-unused `lookOptions()` in `pack-editor.js` went with it
(a second, separate function of the same name still lives in
`console-packs.js` for Tonight's own picker — the two were never the same
function, just the same idea, twice).

**"Seconds per question" is a different animal, and was NOT already
redundant — a real feature had to be built.** Unlike Look, it had no
launch-time override anywhere: it is read live by the scoring clock
(`engine.js questionSeconds()`), and `docs/engine.md` already carries a
standing warning against casually changing it — *"scoring is the base plus
seconds-remaining times ten, so a longer round is a round worth MORE
points."* That warning is about giving ONE round a longer clock to paper
over a different problem (the intro round's dead air); it says nothing
against a host deliberately choosing the pace for a whole night, which is
what was actually asked for and built.

**A ROUND'S OWN OVERRIDE STILL WINS OVER THE NIGHT'S.** `questionSeconds(ri)`
checks the round first, then `state.questionSeconds` (the host's choice,
written into the state at launch exactly like Look — a SIGKILL must bring
back the number the room was already playing on, not whatever the file
says), then the pack's own default, then 20. A pack author's deliberate
per-round pace is never silently overruled by a blanket night setting; only
the pack's own baseline is replaced.

**QUIZ ONLY, and the control is absent rather than disabled for bingo** —
bingo calls tracks, it has no timed question to set a pace on. Carried
across a running order's own parts by `nightWideOpts()`, same as Look, so a
bingo interlude does not lose the number when the night returns to a quiz.

**VERIFIED AGAINST THE REAL SCORING CLOCK, not just the code that sets it**:
launched with `questionSeconds: 35` via a direct API call and again with `47`
through the real console UI and a real Launch press, then read
`/api/state?role=host` after advancing to a live question both times —
`endsAt - startedAt` came back exactly 35000ms and 47000ms. An ordinary
launch with nothing set was checked the same way and still comes back 20000ms,
the pack's own default, untouched.

---

## A PACK WEARS ITS OWN SUBJECT

`public/assets/pack-look.js`, `.pack-card.tinted` / `.lb-tile.tinted` in
`style.css`. Asked for on 15 August 2026 in one line: *"can the packs have
backgrounds that are relative to the contents?"*

**The job is scanning, not decoration**, and that is what decides every detail
below. The common job on a pack tab is *find tonight's pack and press Launch*
— and a shelf of nine identical cards makes that a reading task: you check nine
titles to find the one whose shape you already know. A colour you recognise
turns it into a glance. If it did not make the shelf faster to read it would be
clutter, which this app's own rules say to leave out.

**Four arrangements were rendered from the real stylesheet before choosing**,
per the standing rule about UI decisions, and the choice between them turned on
one thing:

- **the whole card coloured** — most distinct, but nine strong colours on one
  shelf fights the quizmaster's own scheme and makes the grid loud. It is the
  *"wall of red"* fault this file already records, in nine directions at once;
- **a spine down the edge** — quietest, still scannable, but the colour comes
  from the NAME rather than the contents, which is not what was asked for;
- **recognised subjects only** — honest, but a shelf where four packs are
  dressed and five are plain reads as half-built;
- **recognised subjects, everything else a colour of its own** — chosen. The
  shelf stays even, and a pack the list does not know still belongs on it.

### What it derives from, and what it refuses to

**It derives, it never stores.** Nothing is written into a pack file and there
is nothing to set. A pack from the generator, from Import or from a
quizmaster's own editor is coloured the moment it appears — where a field
somebody fills in would be a Monday job per pack, which is the cost this app
measures features by.

**Genre beats decade, and that ordering is doing real work.** This library is
decade-heavy, so if the decade won, *The 2000s Metal Quiz* and *The 2000s Pop
R'n'B and Chart Quiz* would be the same colour and the shelf would be no faster
to read than it was. Genre is the axis that separates packs WITHIN a decade.
Seasonal beats both, being the least ambiguous thing a title can say.

**"Pop" is deliberately not a subject.** Nearly every pack here is a pop quiz
of some kind, so matching it would colour most of the shelf one colour — the
exact failure the feature exists to avoid. **A word only earns a place on that
list if it tells two packs APART**, which is the test to apply when adding one.

**A word is matched whole, never inside a longer one** — "rock" inside "Rocky",
"rap" inside "rapture". A substring match would colour a film quiz as a rock
quiz and nobody would ever work out why. Punctuation is stripped first, so
"R'n'B", "RnB" and "R n B" are one thing — **which is also what splits them**,
so the spaced forms have to be listed as well. Found by a test, not by reading.

**The same pack is the same colour on every device and every reload** (FNV-1a
over the title). The entire value is recognising a card you have seen before,
so a shelf that reshuffles its colours is worse than one with no colours at all.

### Why it can coexist with the app's colour language

Gold means winning, green means good, red means destructive — everywhere, in
every scheme. **A Christmas pack is red and green.** Two things keep that from
colliding, and both are load-bearing:

- **it is a WASH BEHIND the card, never a fill and never a border.** `broken`
  is a border, so the two say their piece in different places and the only red
  that means anything is still the only red on the border;
- **every colour is capped well below full strength** (`TINT` in the module,
  with a test asserting the alpha), because a saturated card reads as a control
  that has already been pressed.

It is a pseudo-element rather than a background on the card, so it layers OVER
`--panel` — the console's scheme-tinted surface — rather than replacing it. The
quizmaster's own colours still come through underneath, which is what stops
nine packs turning the shelf into somebody else's palette.

**The open card takes half the strength.** It is a panel of dropdowns rather
than a tile, and at full strength the wash sits behind a Look picker and a
Launch button and starts competing with the one thing on the card meant to be
pressed. It keeps some, so a pack does not change colour when you open it.

**Two patterns only** — scan lines and a diagonal, shared by every subject that
wants one. A texture per subject would be a stylesheet that grows every time a
word is added to a list, and at 200px wide nobody can tell fifteen textures
apart. They are white at very low alpha, so one rule works over every tint.

### The pack carries its colour into the hole

`packLookAttrs()` is called by the shelf card AND by the Tonight tile, so a
pack cannot look like one thing on the card and another in the slot — which
would undo the reason the two were made the same shape in the first place. With
three slots filled it also says what is in each one without reading three
titles. There is a test that the two get identical colours.

**Nothing a human typed reaches the style attribute.** Every value is built
from numbers, so a pack titled `"><script>` cannot put anything into the
markup — worth a test rather than a comment, because this is generated markup
dropped into an inline style, which is exactly where an injection goes
unnoticed.

---

## WHAT THIS ROOM HAS ALREADY HEARD — the shelf ranked per venue

Asked for on 23 August 2026, against the ranking that had just been put on the
shelf: *"that's a good order but it needs to be per venue as well — if you've
done a quiz at venue A and not at venue B recently then this needs to be
factored in."*

**He is right, and the code already admitted the gap in its own words.**
`quickPicks()` carried this comment: *"The app cannot know which venue tonight
is (a night does not carry one yet), so 'not played recently' is the closest
honest answer to 'will not be a repeat'."* That was true when it was written.
A night carries a venue now — it has since 17 August — so the closest honest
answer stopped being the best one and nobody went back to it. And
`src/library.js`'s own note on the play counts had been saying the real
purpose out loud the whole time: *"the whole use of this line is deciding what
not to run at the same venue again."*

**The two questions are genuinely different, and that difference is the entire
value of the ranking.** A global "last played" answers *have I run this
lately*, which is a fact about the quizmaster's diary. What the shelf is for
is *will this room have heard it*, which is a fact about one venue. Somebody
running four residencies plays a good pack four times in a fortnight and it is
brand new to every one of those rooms; under the old ranking it sank to the
bottom of all four, and the six packs on display were the six he had been
avoiding.

### Nothing new is collected, and the join was one field away

The archive has recorded the venue and the pack of every filed night for
months. What it did not do was hand both to anybody: **`listArchive()` and
`mergeGigs()` both PICK fields rather than spreading**, deliberately, so a new
field on a filed night cannot appear in a payload nobody meant to grow — and
`packId` was simply not on either list. That is the same trap `mergeGigs()`
already records against `rewards` and the league boards, hit a third time. Two
one-line additions made the question answerable.

`src/heard.js` then does what `headcounts.js` does, for the same reasons:
**one function takes a SET of nights and returns the answer across them**, and
it takes what `mergeGigs()` returns rather than the raw archive — which buys
the 6am roll-over and "a quiz and the bingo after it are one night" for
nothing. A mixed night counts **every part**, not just the one whose ending
reached the archive, or the bingo in the middle of a quiz-bingo-quiz evening
reads as never played here however many times it has been.

### A night answers to its ID *and* its name — and the reader reconciles them

This is the split `venueHeadcounts()` was already bitten by, and its own note
is the clearest statement of it: *"pick 'The Station Tap' off the Venues list
one week and type the same name freehand the next, and the two nights land
under `id:xyz` and `the station tap` respectively — two half-histories under
one name."* Every night filed before venue ids existed is in the second group,
and that is most of anybody's history — precisely the half that says a pack
has been heard before.

So a night is filed under **both** keys. `venueKeyOf()` is still asked first,
because it does the one thing a name key cannot: catch a **rename**, where two
different names share one id.

**The reconciling has to happen on the READER's side, and that is a real
limit rather than an implementation choice.** Nothing on a hand-typed night
says which book entry it meant; only the Venues book joins a name to an id,
and the book lives with the console. So `venueKeysNow()` asks under both keys
and takes the later of the two, and `test/heard.test.js` states the limit
outright — the id alone does not see the hand-typed half, which is why the
console never asks with one key.

The headcounts fold the two together in a second pass instead, because they
are BUILDING a list of venues and must end with one row each. Nothing is being
listed here; this is a lookup, so double-filing is the cheaper shape of the
same fix.

### The order and its explanation come from one place

Once the rank is per venue, **a line saying "Never played" over a pack you ran
at another pub last week is simply wrong**, and the reader has no way to tell
which question was asked. This app has been bitten by an order and its own
explanation drifting apart before — the launch bar's whole live-drift line
exists for that — so both come from `heardHere()`.

- `whyFresh()` on the launch bar says **"Never played here"** and **"Last
  played here July"**. The word "here" is doing real work.
- `playedLine()` on a pack card **leads with the local answer** once there is
  a venue, and lets the global count follow. That order is not a preference:
  the two can disagree — a pack run four times down the road and never here —
  and a line opening *"Played 4 times"* over a card sitting at the FRONT of
  the shelf reads as a bug.
- **And the two halves must never contradict.** *"Never played · here 2 days
  ago"* is a sentence this app should not be capable of printing, which is why
  the line was rewritten rather than having a clause bolted onto it.

### Changing the venue re-renders the shelf

Found in live verification, and it is the kind of fault this repo keeps
recording: `chooseVenue()` repainted the bar and left the grid below ordered
for the pub before it. Nothing threw, every card was real, and the only tell
was a pack you had run there last week sitting at the front.

`renderKeepingPlace()` rather than a repaint, because the grid is built by
`console-packs.js` and not by anything in the bar's closure — the same call
`chooseVenueFromTab()` has always made for the same reason. The scroll is
held and the picker has already shut, so there is nothing on screen to lose.

**Note what this does NOT do: it does not remember the venue.** That rule
stands — a venue is a fact about one evening, and a remembered one files next
Tuesday under last Thursday's pub. So a door change is a page load and the
shelf reverts to ranking on the derived default venue, which is the right
answer when nobody has said otherwise.

## WHAT HAPPENS IN THE GAPS — a break plan, per gap in the night

Asked for on 23 August 2026: *"The while they wait section needs to assign
games and/or photo upload per break perhaps? So for e.g. if I have a quiz pack
with 4 rounds and a music bingo, there's 5 breaks — the phones will have an
activity (each game and/or photo uploads), and the screen itself needs to be
able to show ads as well."*

### Two of the three things asked for already existed

Worth establishing first, because it decides what was actually built:

- **Photos already ran at every break.** `PHOTO_PHASES` on the projector and
  `PHOTO_PHASES_PHONE` on the phone have always included `round_board`. That
  half is making something SWITCHABLE that was always on.
- **The game ran at the lobby only**, by three separate mechanisms with a test
  each. And that was the host's own decision, recorded in `play.js` in his own
  words: *"between rounds it should be photos and before the start of the quiz
  it's Maze Mouth."* This request reverses it, which he was told before
  choosing.
- **An advert only ever went up because somebody pressed a button.**
  `showAdvert()` is host-driven and any move clears it. Nothing put one up on
  its own. **That is the genuinely new capability, and the one that pays** —
  advert slides are the quizmaster's own revenue, which rule 4 names.

### A break is a PLACE, not a number

The host counted "4 rounds and a bingo, so 5 breaks". Right for that night and
wrong as a model: a round can be switched off on the launch bar, a pack can
gain one, a part can be dragged out, and a running order adds a lobby per
part. **A stored list of five would be wrong the first time any of that
happened, silently, with every entry still looking real** — this repo's
signature failure.

So a break is `p0:lobby`, `p0:r2`, `p1:lobby`: the part index and the round
index, both of which are already on the engine state and already survive a
restart. `breakIdNow()` recomputes it from what is there rather than storing
anything beside it, so there is nothing that can drift out of step with where
the night actually is.

The console's strip is the same arithmetic run forwards, over the SAME
segments Launch is about to send — `segmentsNow()` puts a simple night through
`slotsFromSimple()` and then the same `segmentsFromSlots()` the mixed row
uses. The strip cannot count a night one way while the launch builds it
another.

### Sparse, and empty means "exactly as it was"

`DEFAULTS` is not a taste decision — it is the app's existing behaviour
written down: the lobby offered a game and the camera, a round board offered
the camera and put the scores up. `cleanPlan()` drops any entry that only
restates a default, so a night nobody configured has a genuinely empty plan
and sends byte-for-byte what it always sent. That is what lets
`pub-unchanged.mjs` still say IDENTICAL with only `gap` allowed through.

### The three guards changed SUBJECT; they did not go away

The lobby game was kept out of a live quiz three ways, and two had to move
together — if one had been missed it would have become the real rule by
accident, and the symptom is a phone quietly playing a game through a
question.

1. **The seed in the phone's payload** — now `offersGame(breakNow(s))`.
2. **The refusal at the score route** — `waiting` is now the same test.
3. **The arcade board on the projector** — **deliberately NOT moved.** It is
   drawn inside the white QR panel under the join code, and that panel only
   exists at the lobby. A round board already carries the board the room
   looked up for, and two leaderboards on one projector is what this app
   refuses everywhere else. A break can put a game on the phones; where the
   score goes is still the lobby's answer.

Outside a break `breakNow()` returns null, so a question is as unreachable as
it ever was. `test/breaks.test.js` asserts each of those three separately,
including that a question refuses a score *whatever is in the plan*.

### Two things a plan may never touch

- **The FINAL is not a break.** It is the end of the night — the winner, the
  podium, the draw, the come-back slide, each of which has a rule of its own.
  A setting that could hide the winner would be able to take away the moment
  the whole evening is built towards.
- **The LOBBY has no screen choice.** The join code lives there and nothing in
  this app may dim it. The setter says so in a line rather than leaving a
  missing dropdown, because an absent control reads as a bug.

### Scores first, then the slides rotate — and the projector does the rotating

The host's own choice off three options, and the right one for a paid slide:
the room gets the thing it looked up FOR, and the venue gets the screen once
it has. A slide that arrived before the scores is a slide people wait through.

**The engine does not run a timer.** One would need restoring mid-cycle after
a crash and would push state to every phone in the room on each change. The
engine sends `breakAdverts` — looked up at view-build time, like
`state.advert`, so a corrected price reaches the projector without anybody
taking a slide down — and `screen.js` counts for itself.

**The teardown lives in `draw()`, where every card change passes.** That is
the phone's own expensive lesson applied before it could recur here: its lobby
game was stopped inside the function that BUILT the lobby, so a game open when
the quiz started kept its loop running on a detached canvas all night. A
break's advert timer left running into a question would swap the projector's
card out from under a live question.

`BREAK_SCORES_MS` and `BREAK_SLIDE_MS` are constants with a note saying they
might want to be settings one day — the simplest version that works, which is
the standing instruction for anything not asked for.

### Nothing is a real answer

Asked for by name: *"I also have to be able to put nothing on the screen if I
want to."* It is not the same as picking neither of the others by accident — a
host who wants the room talking to each other rather than reading a projector
is a real thing to want. The round still names itself, because a projector
with literally nothing on it reads as broken from the back of a room rather
than as deliberate.

### The strip is under the tiles, not between them

The one place this departs from the picture that was chosen. The tiles are a
six-column grid, and a break lives between two ROUNDS — which are dots inside
a 146px tile with no room for anything between them. A row directly underneath
keeps everything the choice was actually about: same order, same count, one
chip per real gap, tap it to set it. It wraps rather than scrolling, because
the console's tab bar already had to be rescued from a sideways scroll nobody
knew was there.

A chip says what it is SET to, not what it could be, and only a changed one is
lit — with the account colour on the EDGE, like every other ordinary control
in this console. A strip where everything shouts says nothing.

### Two bugs the live check found that no test would have

- **`runningShowSegments` was nested inside `pick()`**, so `segmentsNow()` at
  the bar's own level could not see it. `node --check` passes it — it is valid
  syntax — and the whole console died on load with *"runningShowSegments is
  not defined"*. Exactly the fault `test/console-split.test.js` exists for,
  in a shape it does not cover; the fix was to hoist the declaration to the
  scope its two callers share.
- **`listAdvertPacks()` returns a SUMMARY, not the pack.** Its `slides` are
  `{ id, heading, hasImage, hasLink, offerCode }` — no body, no link, no
  image. Building a projector slide out of those gives a heading over an empty
  card: nothing throws, the count is right, and the screen is wrong. **This is
  the third sighting of the picks-fields trap this month** — `mergeGigs()`
  records it twice and `listArchive()` once.

## A CONTROL IS PRESENT AND INERT, NEVER ABSENT

Reported on 15 August 2026: *"slightly clunky how the Set it up appears only
after the drag"*.

It was created `hidden` and unhidden by `pick()`, so dragging a pack in made a
button appear out of nothing and everything below it moved. **That is the same
fault Launch was already fixed for, three lines further down the same
template** — where the comment reads *"it used to be created and destroyed with
the chosen pack, so the bar changed height the moment anything was dragged in
or out and everything below it jumped — reported as clunky"*. The fix that
worked there is the fix here: **the control stays and changes state.**

A control that comes and goes is a control you cannot learn the position of,
and this bar is driven with a thumb in a dark pub.

**Disabled rather than working-with-nothing**, because the panel behind it is
genuinely about a pack — the card shape and the look are read off the one you
chose. Launch directly underneath is the thing that says what the bar is
waiting for, so this does not have to say it twice.

**And clearing the night puts it back to disabled rather than hidden**, so the
row does not change height on the way out any more than on the way in.


---

## A SHOW IS A SAVED LAUNCH — moved to its own file

A night saved in advance and dragged back onto Tonight — how it is built,
what it stores (and, since 23 August 2026, what it deliberately does NOT:
the venue), the parts editor, the quiz → bingo → quiz running order, and
every fault live verification caught building it.

It was a third of this file and is a subject of its own, so it moved whole
when this file hit the 100,000-byte ceiling its own test sets:
**[`console/shows.md`](console/shows.md)**.
