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

## THE POLISH PASS — one sweep, 25 August 2026

Asked for as *"can we try and pretty up the console… as slick and nice as
possible and keeping current functionality?"* The sweep was a batched
screenshot round of all five doors at 1500 and 390, and it found two real
layout bugs before it found anything cosmetic — which is the right order to
fix them in.

### `main` is a flex column, because a two-row grid assumed two children

The fixed frame (`.console .wrap` at 100dvh, only `.tabbody` scrolling) gave
`main` a `grid-template-rows: auto minmax(0, 1fr)` — doorhead, then columns.
But `render()` puts BANNERS above the doorhead when there are banners to put:
the no-accounts maker on a fresh install, the backup warning on every door but
the Console. With three children, the banner took the `auto` row, **the
doorhead landed in the `1fr` row and was stretched** — ~160px of nothing
under the launch bar, on every door, for anyone with a banner showing — and
the columns fell into an implicit row, so the fixed frame quietly became a
scrolling page again. The one-scroller design broke without a single visual
"error": everything drew, just wrongly.

Flex column, `.consolecols { flex: 1 1 0; min-height: 0 }`, everything else
`flex: 0 0 auto`. Any number of banners; nothing stretches but the columns.

### The shelf is six across — and the poster was fixed by content, not width

`repeat(6, minmax(0, 1fr))` beside the 190px tab rail makes every shut card
146px square. That held until the round squares grew to 28px (asked for, for
dragging) — then the poster could no longer contain its own stack: titles
sliced mid-word, the meta wrapped to three lines, the dots clipped, and
because `justify-content: flex-end` spills overflow off the TOP, the
worst-case card ("Last Ten Years") lost its **name** — the one thing a shelf
card exists to show — with nothing thrown anywhere.

An auto-fill floor (five across at ~178px) lasted a day: *"the packs have to
be 6 in the section below the bays and not 5"* — the shelf mirrors the six
bays, and that correspondence outranks card size. So the fix moved to the
CONTENT, where it should have started, and three thefts came back:

- **the title's own width** — a stale `padding-left: 44px` "to clear the pin"
  survived from when the title lived at the TOP of the card; on the poster it
  anchors to the bottom, the pin is hover-only, and the rule was costing
  every name a third of its line for a collision that cannot happen;
- **the meta's second line** — a two-line clamp, the title's own last-resort
  argument;
- **the line itself** — "· 3 rounds" was printed 20px above three numbered
  round squares that say exactly that. The duplication rule in miniature,
  and dropping it is what lets "Never played" arrive whole instead of as
  "Never…". A bingo card keeps its track count: it has no squares to say it.

Result, measured: six across at 146px, every title whole, meta two clean
lines, dots inside the card, at 1500 and 1280 — and on a phone, where the
"clamped" flag is a false positive from the invisible 44px tap-target pseudo
inflating `scrollHeight`, the text itself fits its box on every card.

### The finish layer — browser surfaces, drawn on purpose

One named block at the foot of `style.css`, so "finished" has one definition
rather than a rule per control:

- **`::selection`** follows the account's `--hot` (rgba fallback first, the
  lit-chip pattern) — the default blue was the one colour this app never
  uses anywhere else.
- **`caret-color`** in fields matches.
- **`:focus-visible`** — the 2px hot outline the pack pin and `.lb-hit`
  already had, extended to the nav chips, the minor buttons, the popover
  faces, the gap dial and the pack title. `:focus-visible`, never `:focus`,
  so a mouse press paints nothing on a gig night.
- **The shut card answers the hand**: a 2px lift, a brightened hairline and a
  real shadow (offset + blur) on hover — the same language the round squares
  already speak. Reduced motion keeps the border answer and drops the lift.

Verified: doorhead dead space 0 on Console and Workshop, page no longer
scrolls (only `.tabbody` does), every card title visible and unclamped at
1500/1280/390, no horizontal overflow anywhere, drag-check green including
the dial presses — the frame change moved drop geometry, so the real-mouse
run was the load-bearing check.

---

## EVERY DOOR'S BAY IS THE LAUNCH BAY'S SIZE — 29 August 2026

> *"Also a hard rule is that the bay at the top ALWAYS has the same dimensions
> as the launch bay, this must be consistent across sections."*

`--bay-h` in `style.css`, applied to `.doorhead > .panel.bench` from 900px up.

### What it was before, and why that was worse than it looked

Measured across the doors on the day the rule was set:

| Door | bay |
|---|---|
| Console (the launch bar) | 386px |
| Workshop | 194px |
| Post gig | 194px |
| Community | 122–455px, depending on the tab and the data |

So the top of the page changed shape every time a door was pressed, and the
tab column and everything under it moved with it. Under the fixed frame that is
not a cosmetic wobble: the columns are given whatever is left, so pressing
Workshop after Console handed the tab body 190px more and pressing back took it
away again. The console had five sections each deciding its own version of one
thing, which is the same fault a heading per render function was.

### Why the launch bar is the reference and not a follower

It would be tidier to give every bay including the launch bar a single height
and be done. That is not worth doing:

- **The launch bar is on the protected surface.** Clipping the one panel that
  gets a night started to a number in a stylesheet is a bad trade for symmetry.
- **It folds to a line on purpose**, remembered in `localStorage`. A fixed
  height would either fight that or have to know about it.
- **Its own height is the honest standard.** Every other bay is being asked to
  match the busiest, most-used panel in the app, which is the one that earned
  its size.

So `--bay-h` is the launch bar's own OPEN PANEL height — the panel, not the
doorhead round it, which adds a 24px margin, so that every bay comes out the
same on screen. **362px above 1150 and 425px between 900 and 1150**, because
the bar's settings row wraps below 1150 and the bar gets taller.

`scripts/community-bay.mjs` measures the launch bar at each width and asserts
every other door matches it. That is what keeps this a rule rather than a
sentence: if the bar grows, a check fails and the token is updated
deliberately, rather than every other door quietly being the wrong size.

### Below 900px there is no rule, and that is not an exception

There is no fixed frame below 900px — the page scrolls, exactly as it always
did. And the launch bar is **745px** on a 390px phone, so applying the rule
there would put most of a screen of empty panel at the top of every door. The
rule exists to stop the frame moving, and below 900 there is no frame to move.

### What a fixed box buys, which is more than consistency

The version of the Community bay built the day before this rule had to be
*bounded by construction*: a fixed three rows of photographs, a fixed eight
rows of table, and the remainder said in a line rather than drawn — because
`.doorhead` sized to its content and a bay that grew pushed the tab column off
the bottom of the screen.

Given a fixed box instead, the content can simply **scroll inside it**. So the
caps came off: the wall shows what it has and a league shows every team, and
neither needs an "and N more" line pointing at somewhere they are not. The
constraint that looked like a restriction is what removed two of them.

---

## THE COMMUNITY BAY IS THE TAB YOU ARE ON — 29 August 2026

Asked for in one message, off a screenshot of the Community door:

> *"I would like anything that loads to load onto the top bar bit, so if I
> click photos I want the photos to load perhaps in a 3 x 6 grid at the top
> there? Quiz league should also load up there with options perhaps on the left
> hand side going down like the menu below it."*

`communityBench(active)` in `console-community.js`; `console.js` hands it the
tab it is already handing `tabBar()` and `tabBody()`. The rules are in
`CLAUDE.md`; this is the reasoning behind them.

### The other four doors already worked this way, and this one did not

Post gig's bay is the night you opened. Workshop's is the pack you picked.
Console's is tonight — the thing the whole door exists to start. Community's
was a fixed summary that said *"2 leagues running · 35 teams across 2 nights"*
whichever of its three tabs you were on.

That is the one region the fixed frame guarantees is on screen, and it was
spending itself on a sentence you had read the first time. Meanwhile the thing
you had just pressed a tab to look at was below the fold, inside the only part
of the page that scrolls. **The door was arranged backwards** — and the fix is
not a new pattern, it is the pattern the other four already follow.

### The bottom is controls and options. It never displays the thing.

The first version put the content in the bay and left the tab underneath as it
was — the full tables, the photographs, and the controls mixed in with them.
That was reported immediately and correctly:

> *"If a quiz league appears at the top it shouldn't be at the bottom — the
> bottom is for controls and options etc., not for displaying the actual thing
> — so you click the thing at the bottom to reveal it at the top."*

So the split is not "summary above, detail below". It is **the thing above, and
what you do about it below**:

| | The bay | The tab |
|---|---|---|
| **Photos** | the wall, or one night, or one picture | venues → nights, and the publish control for the night showing |
| **Quiz league** | the venue rail and that venue's whole table | the scoring note, *Check the names*, and *Put this table up* |
| **What they asked for** | what is running, in a line | the queue itself |

`scripts/community-bay.mjs` asserts both halves: no publish control and no name
review inside `.doorhead`, and **no `.lg-table` and no `.cphoto` inside
`.tabbody`** on this door. The second assertion is the one that would have
caught the first version.

### The safeguards survived the move, and that was the thing to check

Every safeguard on this door is the same mechanism: a control drawn UNDER the
thing it acts on, so nobody publishes a pub's team names or a room's
photographs without having just looked at them.

Moving the display up and the control down sounds like exactly what breaks
that. It does not, for one specific reason: **the frame is fixed, so the bay is
on screen while the control is pressed** — the pictures are literally above the
button, in a region that cannot scroll away. What the rule actually forbids is
a control on a screen the thing is not on, and there isn't one.

The load-bearing detail is that **the publish control is drawn only for the
night that is SHOWING**. A button on every row would be exactly the fault: one
tap from a stranger's face going public, on a night nobody had opened.

### One press puts it in the bay, the next takes it out

Three states on the Photos tab, and every step is reversed by pressing the same
thing again — including *"when you click into a photo another click should go
back again"*:

```
the wall  →  press a night in the list  →  that night's photographs
                    ↑                                  ↓
              press it again              press a picture / press it again
                                                       ↓
                                                  one picture
```

The night list marks the one showing (`is-showing`, the same held colour the
Post gig bench uses) and its label says *"Showing above — press to close"*, so
the way back is on the thing that got you here rather than on a separate
control in the bay.

### One request per night, not two

`nightPhotos()` fetches a night's pictures and its published flag in the same
request. The pictures belong in the bay and the control belongs in the tab, so
the control is **built where the request is made and hung where it is read**:
`photoWall()` creates the container and `photosSection()` appends it.

That is safe because `render()` evaluates its arguments in order — the doorhead
is built before the tab body, so the element exists by the time the row wants
it. Asking twice would be a second request per night for a boolean the first
one already carried, and two answers that could disagree.

### Six across, because everything else on this console is six across

The pack shelf is six by decision and the Tonight bays are six by decision, and
the wall sits two inches from both. A grid that mirrors them reads as the same
app.

It is also the half of "3 x 6" that costs less: three across and six down is
the same eighteen pictures and twice the height, which is exactly what the
doorhead cannot afford. On a phone it drops to three across — the page scrolls
there anyway, and six 52px thumbnails is a contact sheet nobody can see.

**The cells are 96px tall with `object-position: center 30%`.** A fixed cell
height means a night with thirty pictures scrolls inside the bay rather than
changing its size; the crop is biased above centre because a wide crop of a
portrait photo taken on a phone otherwise lands on torsos, and a pub photograph
is people.

### The rail is the same object as the tab column under it

190px, stacked, lit on the left edge, `role="tablist"` — the tab column's own
markup and the tab column's own CSS idiom, because it is doing the tab column's
own job one region higher. *"Options perhaps on the left hand side going down
like the menu below it"* is literally that, and a second way of saying "pick
one of these" on one screen is the label collision this repo keeps finding.

The lit marker is the LEFT edge for the same reason the tabs' is: under a
stacked list a bottom border reads as a rule between two rows rather than as a
mark on one.

### The wall is fetched once per page load, and stops asking

A photo list is one request per night — the reason the tab below fetches a
night's pictures on the press rather than up front. A wall built by asking
every night in the archive would spend a pub's wifi on twenty requests to draw
eighteen thumbnails.

So `loadWall()` walks the newest nights and stops the moment eighteen are in
hand, and never asks more than `WALL_NIGHTS` of them. An ordinary night carries
more than eighteen photographs on its own, so the usual cost is **one request**.

The result is held in a module binding rather than refetched, because the bay
is rebuilt on every state push — which during a lobby is every time somebody
joins, on the one connection that must not stutter. A photograph that arrives
after that is caught the next time the console is opened, which is the right
trade for a wall.

### `scripts/community-bay.mjs` — and what it measures is geometry

Nothing in this repo can see any of the above. `node --check` passes a bay that
crushes the frame; a unit test reading the module as text proves nothing about
its height; and a dead rail button draws perfectly, because the click handler's
own catch swallows the `ReferenceError`.

So the guard is a real browser with a viewport, like `drag-check.mjs`, and what
it asserts is:

- **every door's bay is the launch bay's height**, measured from the launch bar
  itself rather than from the token, on Console, Workshop, Post gig and all
  three Community tabs — and still is with a night open in it;
- the page itself still does not scroll at 1500x900 and 1280x720;
- enough is left for the tab column, and every tab in it is reachable;
- nothing overflows sideways at any of the three widths;
- **no control is in the bay**, and **no table or photograph is at the bottom**;
- the wall stops at eighteen, six across (three on a phone);
- every venue is on the rail and every team is in the table;
- **pressing a rail button actually changes the table**, not merely lights up;
- **pressing a night puts its photographs in the bay** and its publish control
  under its row, and pressing it again returns to the wall;
- **pressing a picture opens it and pressing it again goes back**;
- no console errors.

It seeds its own archive of two venues' league nights and stands in for the
private photo repository with `page.route()`, so the console's own fetching and
layout code is the real thing throughout and only the network behind it is a
fixture.

Two fixture traps it is worth not rediscovering: the HOUSE room's archive is
`DATA_DIR/archive`, not `DATA_DIR/rooms/HOUSE/archive`; and **two venues seeded
on the same dates produce no leagues at all**, because `mergeGigs` folds them
into one night, marks it `venueMixed` and drops the venue.
