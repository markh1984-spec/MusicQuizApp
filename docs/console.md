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

## THE COMMUNITY DOOR — the people who do the quizzing

Asked for on 23 August 2026 as a fifth pill *"for things like quiz leagues"*,
and extended the same evening: *"photos can actually migrate to community as
well now, and anything else to do with the people who do the quizzing — ask me
as many questions as you need to get this right."*

Four questions were asked and each answer is now a rule.

### Why a fifth door was the honest answer rather than a tenth tab

The four doors sort by a rule: Console, Workshop and Post gig name MOMENTS of a
night — before it, during it, after it — and My account names the one thing
that is not a night at all.

**A league is neither.** It spans nights and belongs to the ROOM rather than to
the quizmaster, which is exactly why it had nowhere good to live and had ended
up as a block on a venue card: visible one venue at a time, behind the Workshop
door, and only if you went looking for it. The same is true of the photographs
and of what the room voted for. Once there were three of them, the door was
obvious.

**It goes fourth and My account stays last** — the night sequence, then the
work that spans nights, then housekeeping, where an account link sits on every
site anybody has used.

### By venue, because a venue IS a community

The Tuesday crowd and the Thursday crowd are different people. A league is
already per venue; grouping the photographs the same way makes every page on
this door something you can show one landlord, which is the *build what helps a
quizmaster SELL* rule falling out of a layout decision for free.

### THE PHOTOS MOVED AND PAST GIGS KEPT ITS GRID — and that is not a duplicate

The alternative was on the table and was rejected for a concrete reason: moving
the pictures off Past gigs entirely would put you two doors away from them
while writing the report that is BUILT out of them.

**The same photographs do two different jobs.** On Past gigs a photo is
evidence, sat beside the headcount, the winner and the report a landlord is
shown. On Community it is the room itself, which is what somebody opens this
door for.

**What is NOT duplicated is the code.** The strip, the bin and its confirm
wording, the "Screen only" badge and the publish control are `nightPhotos()` in
`console-gigs.js` — extracted out of `fillNightDetail()` rather than rewritten,
and called from both. Each of those is a decision with a reason recorded, and a
second copy is a second thing to forget.

**The publish safeguard survives for free**, which is the payoff of extracting
rather than copying: the control is drawn UNDER the photographs it would
publish, so "nobody puts a night in front of the world without having just
looked at what is in it" is true on the new page without anything being
restated.

**A night's photos are fetched when that night is OPENED**, never with the
list. A photo list is a request per night, and a wall that loaded twenty nights
on arrival would spend a pub's wifi on pictures nobody had asked to see.

### A READ-ONLY SUMMARY MAY REPEAT; A QUEUE MAY NOT

This is the line that decided everything else, and it is already this app's
practice rather than a new idea.

**The headcount is a summary, so it repeats.** It joins the head of each league
panel — one line — because those are the landlord's two questions and CLAUDE.md
already pairs them: *the headcount sells the room, the league is what keeps
it*. It also stays on a venue card and on a Past gigs card. None of the three
can disagree, because `library.headcounts` is worked out once on the server.

**"What the room asked for" is a queue, so it moved.** Yes keeps an idea, No
bins it — and a triage list drawn in two places is two lists that disagree
about what has been dealt with, which is what the panel's own note already
said when it insisted on living on one tab.

Its old placement had a good reason — it answers *"what should I write next"*,
so it sat above the quiz generator where that is decided — and it lost to a
better one: this is the players' own voice, three buttons on their phones at
the end of the night, and the players have a door now. **A one-line link stays
on the quiz tab**, silent unless something is actually waiting, which is this
project's own rule that "do it over there" must be a link to there.

### `asksPanel({ whenEmpty })` — one panel, two pages, two right answers

Drawing NOTHING when there is nothing to say was correct above the quiz
generator: a box saying "nobody has asked for anything" on the page you open to
write a quiz is furniture.

On its own tab it is the opposite. A tab whose entire job is that list, showing
a blank page, reads as broken to the person most likely to be checking whether
the feature works at all — and "nothing here" has two very different causes,
because the switch is off unless somebody turns it on. So the empty state says
which, and links to the switch rather than naming it.

One optional argument rather than a second panel, so the triage keeps one
definition.

### YOURS ONLY, FOR NOW — and the room-facing version was offered and parked

The alternative was a public page per venue: the league table, the photographs,
when you are back — with the QR on the last slide already able to send a room
there. It would genuinely help a quizmaster sell, and it was deliberately not
built yet: it is a new PUBLIC surface with its own questions about faces and
team names, and none of what is built here blocks it later.

The only public thing remains the existing gallery link.

### What was NOT moved, and why

**"That one's wrong" reports** — corrections the room sends about a question —
were offered and left alone. They are owner-facing: a quizmaster never sees
what their own room reported, and putting a half-built pipeline on a new door
would have been furniture rather than a feature.

## THE LAUNCH BAR HAS ITS OWN FILE — `docs/console/launch-bar.md`

Tonight, the running order, the pack tiles, the settings row, the break dials
and every fault found while building them moved to
**[`docs/console/launch-bar.md`](console/launch-bar.md)** on 23 August 2026,
when this file crossed its 100,000-byte cap.

Named here so this file still tells you everything the console has, which is
the same rule `TODO.md` follows for `todo/`. What is in there:

- **TONIGHT** — one launch section, and why nothing is chosen for you
- **A TAP PLACES THE PACK** — on either door, and the card never opens again
- **A PACK WEARS ITS OWN SUBJECT** — the tint, the edge, the era word
- **WHAT THIS ROOM HAS ALREADY HEARD** — the shelf ranked per venue
- **WHAT HAPPENS IN THE GAPS** — the break plan, per gap in the night
- **THE GAPS ARE A DIAL ON THE PACK** — and the tile measurement that decided it
- **THE BAND ABOVE LAUNCH IS KEPT CLEAR**, and one row holds the night
- **THE BAR'S OWN TIDY-UP** — and a drag with no tap is a broken control
- **A DROPDOWN IS NARROW SHUT AND WIDE OPEN** — `console-pick.js`
- **A CONTROL IS PRESENT AND INERT, NEVER ABSENT**

## A SHOW IS A SAVED LAUNCH — moved to its own file

A night saved in advance and dragged back onto Tonight — how it is built,
what it stores (and, since 23 August 2026, what it deliberately does NOT:
the venue), the parts editor, the quiz → bingo → quiz running order, and
every fault live verification caught building it.

It was a third of this file and is a subject of its own, so it moved whole
when this file hit the 100,000-byte ceiling its own test sets:
**[`console/shows.md`](console/shows.md)**.
