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
the venue, the prizes, the look and the lobby game across the swap, and is
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
line of 5 · 63% of calls hit your card" — because "line of N" was already
telling you how long a WIN takes and this is the other half of the same
decision, how often a call means anything to a given player. Reading every
option is then an informed override rather than a guess, which is worth more
than refusing a small card outright: a strip shape might still be exactly
what a phone-heavy room wants, and the threshold for "too small" is a taste
call, not a rule to enforce.

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

## A SHOW IS A SAVED LAUNCH — the whole evening, built in advance

The rules are in `CLAUDE.md`. This is the reasoning behind them.

### What was actually wrong

Raised by the host on 16 August 2026, and the diagnosis is his: *"maybe I'm
being silly — the launch bar is launching nights, but we're frankensteining
nights instead of having a nights section. You build a night in advance and
then just drag it in onto the launch console."*

He is not being silly, and the word *frankensteining* is exact. Tonight is a
composer: you drag a pack in, drag a second one in, switch rounds off with the
ticks, choose the venue, open Tonight's settings and pick the look, the lobby
game, the card shape and the prizes. **Every one of those is a decision made
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

Everything a show holds is already on the bar and on Tonight's settings. So a
show is made by setting a night up and pressing *Keep this as a show* at the
bottom of the settings — the last thing you do, after the look and the prizes,
which is where it belongs in the sequence anyway. The Shows tab is where you
take one back off the shelf.

That also keeps the door rule honest. On the Console door the Shows tab is a
shelf you drag off and nothing else; in the Workshop it grows Rename and
Delete. Same function, same cards, exactly the split the Venues tab uses.

### It never launches, and there is a tap as well as a drag

Dropping a show onto Tonight fills the bar and stops. That is the same promise
dragging a pack makes, and it matters more here because a show carries a venue
and a set of prizes — a drop that launched would put a whole evening on the
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
show: it holds one pack, and a show also needs the venue, the prizes, the
look and the lobby game, none of which exist on the bench — inventing a save
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
of every other bingo interlude in the same night — a small inline pair of
selects on the tile itself, reusing `library.cardShapes` the same way the
Set-it-up tab's own shape/prize pickers already do.

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
