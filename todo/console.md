# The console's outstanding UI work

Doors, benches, the popover editor, the running order, and the seams left in
the console — the work that lands on the page a night is launched from.

**This is part of [`../TODO.md`](../TODO.md)** — the live list. It moved out on
16 August 2026 because every session opens TODO.md and this is not what most of
them need. **A finished item is DELETED from here, never ticked**, exactly as in
the parent file.

---

## THE CONSOLE SCROLLS SIDEWAYS AT 320px — small, real, and old

Measured on 15 August 2026 and confirmed **pre-existing**: identical 32px of
horizontal overflow on that day's work and on the commit before it, so nothing
recent caused it. Everything at 390px and up measures clean.

Eleven offenders, all the same shape — **things that neither wrap nor shrink**:

- **eight `.tab` buttons**, running to x=999 in a 320px viewport. The bar is
  meant to scroll sideways below 860px, but it is pushing the DOCUMENT rather
  than scrolling inside itself, which is the actual fault;
- **`.pack-tools` / `.pack-search`**, right edge at 352 against a 320 viewport —
  the search box has a floor it will not go under;
- one `a.minor` link in the same row.

**It is a tidy-up rather than a fire**: 320px is the narrowest phone anybody
still carries, and the console is driven at 390 and up in practice. But it is
the seventh instance of the min-content fault this file records, and the fix is
the same each time — `min-width: 0` on the flex children, `max-width: 100%` on
the input, and let the bar clip inside itself instead of pushing the page.

**Measure `scrollWidth` against `clientWidth` at 320 after anything
structural**; nothing else finds it.

### A FEATURE THAT MOVES UP A TIER DOES NOT LEAVE THE PEOPLE WHO HAD IT

Settled on 15 August 2026, and it is the decision that unblocks the tier
buckets — the drag-features-into-bronze/silver/gold arranger the host asked
for. **It is a business rule rather than a UI one, which is why it had to be
answered before the drag exists rather than after.**

**Anybody who already holds a feature keeps it for as long as they stay
subscribed. The new tier applies to new sign-ups.** Nobody loses something they
were already using.

The alternative — losing it at renewal — is cleaner data, because a tier then
means exactly what it says. It was turned down for a better reason than
kindness: **a quizmaster finds out on a gig night**, not when they read the
email. Something they used last Thursday is missing this Thursday, in a pub,
with a room in. That is the app breaking its own first rule, and no amount of
tidy data is worth it.

**What this means for the build**: entitlement cannot be computed from the tier
table alone. An account needs to carry what it was GRANTED, and the tier table
decides only what a NEW account gets. That is a real difference and it is
cheaper to build in from the start than to retrofit — `entitlements` already
distinguishes `entitled` from `features`, which is most of the shape.

**And the arranger has to say so on screen.** Dragging a feature from bronze to
gold must not silently imply that bronze accounts lose it — the panel should
state that existing holders keep it, at the moment of the drag.

### TONIGHT'S SETTINGS IS A TAB, NOT A PANEL ON THE BAR

Asked on 15 August 2026: *"not sure what the point of the Set it up bit on the
console is, can this be done in the workshop?"* — and then answered better by
the host himself: ***"perhaps a fourth tab that says Tonight's settings?"***

**That is the right shape, and it beats both options that were put up.** The
settings ARE about tonight, and the Console door IS about tonight, so they
belong on a tab inside it. What was wrong was never the settings — it was them
hanging off the launch bar as a fold, which is furniture between the bar and
the packs and breaks the rule that nothing comes between those two.

So the Console door becomes: **Music Quiz · Music Bingo · Venues · Tonight's
settings**, and `Set it up` disappears from the bar.

#### What is in it

Look, While they wait (the lobby game), Game sound, Playing (teams or one phone
each), and for bingo the Card shape and how many Prizes.

#### THE WORK IS THE STATE, NOT THE MARKUP

**The panel is built inside `launchBar()` and reads that function's own
`currentPack`** — bingo's card shape and prize list come off whichever pack is
in slot 1, and the options are generated from it. A tab cannot see any of that,
so the chosen pack has to be lifted out of the launch bar's closure to
somewhere both can read. That is the whole job; the markup moves for nothing
once it is done.

#### It composes with per-venue defaults, later

Four of the six are really VENUE decisions rather than night ones — The Crown is
always rowdy, the gastropub is always quiet, and you would give the same answer
every time you played there. A venue record could supply the starting values the
way it already supplies the prizes and the voucher, with the tab as the place to
override them for one night. **Not decided, and it does not need to be**: the
tab is where you set it either way, so building the tab first cannot be wrong.

### CONSOLE · WORKSHOP · POST GIG — the three doors, ordered by the gig

Proposed on 15 August 2026, and it supersedes the smaller console/workshop
split below it: *"perhaps a better order is three sections, one dedicated to
preparing for gigs, one dedicated to the gig night, and one dedicated to what
happens after, and then each one gets tabs below."*

**IT IS THE AXIS THIS APP ALREADY USES, PROMOTED TO THE TOP LEVEL.** The tab
bar is already ordered *left to right along a quizmaster's evening*, and
*"Gigs is EVIDENCE, Calendar is ORGANISATION"* is already recorded as the test
for where a new thing goes. Both are the same before/after distinction, decided
locally, twice. Three doors make it one rule that answers every future "where
does this live" without re-arguing it.

It also fixes a real problem rather than only tidying: **nine tabs is too many
to scan**, and three sections of three or four is not.

**The allocation, given by the host on 15 August 2026 and not to be
re-derived:**

**THE NAMES ARE THE HOST'S AND THEY ARE BETTER THAN "BEFORE / DURING /
AFTER"** — given on 15 August 2026: *"this section needs to say Console,
Workshop and Post gig and function like that."* **Console keeps its name and
means the night**, which is what makes the launch guarantee survive: everybody
already knows Console is where you go to start a quiz, so nothing has to be
re-learned.

| Door | What it is for | Tabs under it |
|---|---|---|
| **Console** | the gig itself | the launch bar, the Recommended six, the control view |
| **Workshop** | preparing, before the night | Music Quiz and Music Bingo (each with its writing, buying and asking panels), **Adverts**, **Calendar**, Venues |
| **Post gig** | evidence and admin | **Past gigs**, **Invoices**, photos & the gallery |

**CONTROL STOPS BEING A DOOR** and lives inside Console. The route back to it
must stay short from anywhere — two predictable taps (Console → Take control)
is acceptable; hunting is not, and relaunching is catastrophic.

#### How to build it: a `door` on each tab, one page, a filtered bar

`TABS` in `console.js` already drives the whole tab system. Give each entry a
`door` and filter the bar by the door in the address — `/console?door=workshop`
— and the three sections fall out of the structure that already exists rather
than needing three pages.

**That also solves the panel move for free.** Music Quiz appears under Console
as the shelf and under Workshop as the writing panels: same tab id, different
door, different body. Nothing has to be extracted into a shared module, which
was the expensive part of the earlier plan.

**The Tonight bar renders on the Console door only.** It is furniture in the
wrong room everywhere else, and that is the whole reason for doing this.

**WHICH PANELS MOVE, NAMED — so nobody has to guess from a screenshot:**

- **To the workshop, under Music Bingo:** *Ask for a bingo game*, and *Make a
  bingo game of your own* (the paste-a-track-list panel).
- **To the workshop, under Music Quiz:** *Ask for a quiz*, and *My packs* (the
  scaffold panel, whose button is now **Write it myself**).
- The Quizporium shop goes with them. **Nothing that writes, buys or asks for a
  pack stays on the launch page.**

#### One thing left to settle BEFORE building it

- ~~Help and My Account are not on the timeline~~ — **SETTLED: they go behind
  the ACCOUNT CHIP, top right**, beside the hat switch and Sign out, which is
  where settings and help live on every other website. They are not before,
  during or after a gig — they are always — and leaving them under Workshop
  made that door a lie, since nobody prepares for a gig by reading Help. **This
  keeps the three doors honestly about the gig and nothing else**, which is the
  whole reason they exist.
- ~~It reverses "Tonight at the top of every tab"~~ — **SETTLED, and it is not
  a reversal.** The host's own resolution: *"as long as people know they can
  click Console they know they can launch quickly from there — it's the same
  decision, tidied up into a single console area."*

  **The decision was never "a launch panel on every tab".** It was *launching
  is always one predictable move away, and you never have to think about where
  it is* — and Tonight-everywhere was how that was achieved while nine tabs
  were a jumble and you might be sat on Venues when you decided to go. Once the
  night has a door of its own, **one tap IS that guarantee**, and it costs a
  launch bar that was furniture in the wrong room on Invoices and Venues.

  So the property to preserve is the GUARANTEE, not the panel. Whatever the
  night door ends up being called, pressing it must land on the launch bar with
  nothing in front of it.

#### What it settles for free

**CONTROL STOPS BEING ITS OWN DOOR** and becomes part of the night. That is
more honest than a top-level item: driving the quiz is something done DURING,
not a different kind of tool. It also answers the *"is the Control menu item
pointless"* question — the door is not pointless, it is in the wrong place.

**But keep a route back to the controls from everywhere**, whatever the shape.
Mid-quiz, going to another section and needing to return has to be one tap; the
only alternative is relaunching, which destroys a running game in front of a
room.

#### This replaces the smaller split below

The console/workshop entry that follows is the same idea at half the size. If
the three doors are built, that entry is done by definition — do not build
both.

### THE CONSOLE IS FOR LAUNCHING. THE PACKS PAGE IS THE WORKSHOP.

Proposed on 15 August 2026: *"perhaps the console menu item itself needs to be
geared towards this (so you click Console and are ONLY given sections that help
you launch a quiz ASAP) and then you click the next bit and it's more geared to
in depth stuff like writing, buying packs etc."*

**THE SPLIT ALREADY EXISTS AND NOTHING NEW HAS TO BE INVENTED.** `navMenu()`
gives every quizmaster three doors — **Console · Control · Packs** — and Packs
already points at `/editor`. Run tonight, drive the game, work on packs.

**What went wrong is that the workshop crept onto the Console's pack tabs.**
Four jobs that are not launching now sit under the thing that is used ten
minutes before a gig: the AI generator, *Lay it out empty*, the Quizporium
shop, and *Ask for a quiz*. That is also why the shelf needed capping at six to
feel calm — the tab was carrying four panels it should never have had.

**So this is a MOVE, not a new section**, which makes it far smaller than it
sounds and means no second navigation system to learn.

#### CHOOSING THE SIX, from the workshop

Added on 15 August 2026: *"even in the workshop you can drag and drop which 6
items appear in the quick pick section for the console, for each game type — or
if they leave it, it just defaults to pinned + recommended. In fact, call it a
Recommended section!"*

**The name is done and it is the honest one.** The shelf says **Recommended**
at rest and **Your library** the moment it stops being a shortlist — when See
all is pressed or a search is typed. A row of six labelled "your library" when
somebody owns twenty-three is the app quietly lying about what it is showing.

**The drag-to-choose is the PIN with an order on it, and it needs no new
storage.** `prefs.pinnedPacks` already holds an ordered list per account;
dragging six tiles into an arrangement in the workshop is simply a nicer way to
write that list than tapping six pins on six cards. Which means the two cannot
disagree — there is one piece of state and two ways in.

- **PER GAME TYPE.** Quiz and bingo have their own shelves and their own six.
  A list that mixed them would be wrong on every night.
- **EMPTY IS THE DEFAULT AND MUST STAY MEANINGFUL** — pinned first, then the
  ranking. Somebody who never opens the workshop still gets a sensible six,
  which is what makes this an enhancement rather than a setup step.
- **A PARTIAL ARRANGEMENT FILLS FROM THE RANKING.** Two dragged in means two
  fixed and four suggested, not two and four holes. Same rule the pin already
  follows.
- **IT BELONGS IN THE WORKSHOP, NOT THE CONSOLE.** Choosing what is on the
  shelf is preparation; the console is for the night. Putting the arranger on
  the launch tab would be the fifth panel to creep onto it.

#### What stays on the Console

Tonight, the six packs, the search, and nothing else. **Not even the shop** —
a shop on the launch screen is the plainest possible breach of *the common job
is the fast one*.

#### What moves to Packs

The generator, the scaffold, the shop and the ask-for-a-quiz panel. None of
them changes behaviour or gating on the way; the owner-only generator stays
owner-only.

#### The one thing to get right

**Somebody looking for "write a quiz" will go to the Music Quiz tab first**,
because that is where it has always been. The answer is ONE QUIET LINE under
the shelf — *"Write, buy or edit packs →"* — a link, not a panel. **If it grows
into a panel the whole move has been undone**, which is exactly how the four
panels got there in the first place.

#### Do it as its own piece of work

It touches the tab every gig starts from, so it wants its own screenshots at
1280 and 390, and a real Launch pressed in a browser afterwards — the protected
surface, not a diff review.

### SPLIT `launchBar()` — the next seam, and the only one left

**The console split is DONE and is not in this list.** `console.js` is a shell
of ~1,750 lines plus eleven modules named for a door or a tab; the rules are in
CLAUDE.md and the reasoning in [`docs/console.md`](docs/console.md). What is
left is one function.

**`launchBar()` is 1,700 lines on its own**, which is most of why
`console-tonight.js` is still ~2,460 — the largest module by a distance and the
only one over its default budget.

**It is NOT the same job as the split was, and that is the decision to record.**
The split was a move by line number: nothing was read, so nothing could be
reworded. Taking `launchBar()` apart means deciding what its parts ARE — the
venue head, the running order slots, the settings line, the Launch button and
its guards — and that is judgement, on the one control this app cannot afford to
break. `pub-unchanged.mjs` does not cover it either: the launch bar is browser
code, so the only proof is pressing Launch for a quiz AND a bingo pack in a real
browser and comparing the rendered markup before and after, which is what the
split itself did.

**So it waits for a reason beyond tidiness.** Do it when something genuinely
needs changing in there, not as a chore — and if it is done, do it the same way:
markup diffed on all 34 views, both launches pressed.

### EDITING HAPPENS IN A POPOVER, AND THE DRAFT IS NEVER LOST

Asked for on 16 August 2026 against the Workshop bench: *"both of these
functions should open a popover where you can edit this — if you accidentally
click off or if there is a crash it should keep your work saved to the latest
version."*

**THE ONE DECISION IN IT IS WHAT "SAVED" MEANS, and only one answer is safe.**

Saving to the PACK as you type is the obvious reading and it is dangerous:
`reloadPackEverywhere()` pushes a saved pack into any game currently running
it, on purpose, because that is how a correction reaches a quiz already on
question four. So autosaving a half-typed question would put it on a projector
between rounds — rule 11 working exactly as designed, aimed at the wrong thing.

**So: a DRAFT kept locally as you type, written to the pack only on an explicit
Save.** Crash-proof, survives clicking off, survives a reload, and nothing
reaches a room until somebody says so. Reopening offers to carry on or throw it
away, which is the same shape the editor's `dirty` flag already has.

**THE DRAFT IS KEYED PER PACK, not one scratch slot.** Otherwise editing the
80s quiz, switching to Motown and coming back hands you the wrong unsaved
changes — which is a worse failure than losing them, because it looks like your
work and you would save it.

That also settles the click-off behaviour without a "are you sure" dialog:
**closing costs nothing when the draft is already on disk**, so clicking off
simply closes it. A confirm on every stray click is the control that trains
people to dismiss confirms.

Worth doing properly rather than at the end of a session: the editor is a whole
page (`editor.js`) today, and a popover version that half-works on the one door
somebody would use it from is worse than the link that is there now.

**WHERE IT PLUGS IN**, so a fresh session does not have to find it: the two
buttons are `.bench-go` (Edit the questions) and `.bench-read` (Read it
through) in `workBench()` in `console.js`, which today link to
`/editor?quiz=<id>` and call `preview()`. The pack itself is read and written
through the same routes `editor.js` uses. **Read `editor.js` before deciding
whether the popover reuses it or is a smaller thing beside it** — it already
has a `dirty` flag and a confirm-on-leave, which is most of the draft
behaviour, and reusing it would keep one definition of what saving a pack
means.

### EVERY DOOR GETS A BENCH — the same drop zone, doing that door's job

Proposed on 16 August 2026: *"I think perhaps the workshop and post gig should
have the same launch area but for their own respective functions — so you drag
and drop whatever you need into the workshop to fix it (writing a quiz, music
bingo etc.), then when it's done it's saved and removed from the section. Post
gig works as well for other reasons. The GUI will be unusual but work imo."*

**It is right, and the reason it is right is that the doors already ARE this
shape and only one of them has the panel.** Tonight is not a launch widget —
it is *the thing this door is currently working on*, pinned above the tabs,
fed by dragging, with the door's one big button at the bottom of it. Console's
happens to end in Launch. There is no reason Workshop's cannot end in Save and
Post gig's in Send.

**The unusual GUI he flags is the honest part: this is a WORKBENCH, and a
workbench holds what you are in the middle of.** That is a different idea from
a form, and it earns its space for the same reason Tonight does — you can see
both ends of the drag.

**AND THE CONSOLE'S HALF OF THIS IS NOW BUILT, as SHOWS** — a whole evening
kept as one thing and dragged back onto Tonight, which is the bench's
clear-and-reload mechanic arriving from the other direction. Read the Shows
section in CLAUDE.md before building the Workshop's, because two of its
decisions apply unchanged: **the thing on the bench stores references and never
copies**, and **it is not a gate**.

| Door | What goes on the bench | What the button at the bottom says |
|---|---|---|
| **Console** | tonight's packs, tonight's venue — or a whole **show** | **Launch** — built |
| **Workshop** | a pack you are writing or fixing, a round pulled out of another pack, a venue you are setting up | **Save it**, and the bench clears |
| **Post gig** | the night just run, the photos worth keeping, the venue to bill | **File it** / **Invoice** — one night at a time |

**THE CLEAR-ON-DONE IS THE WHOLE MECHANIC AND IT MUST BE BUILT IN FROM THE
START.** *"When it's done it's saved and removed from the section"* is what
stops the bench becoming a third shelf of stale things. An empty bench means
nothing is half-finished; a bench with something on it is a to-do you cannot
miss, in the one place you look first. That is a Monday-load reducer wearing a
drop zone.

Four things to settle before building, none of them blocking:

- **DOES THE BENCH SURVIVE A RELOAD?** Tonight's does — it is game state. A
  workshop bench holding an unsaved pack is a draft, and a draft that
  disappears on a refresh is worse than no bench. Likely `prefs`, per door, per
  account. Decide before writing, not after.
- **ONE ITEM OR SEVERAL?** Console holds a running order of several. Writing
  a quiz is one pack at a time; post gig is one night at a time. Probably: the
  bench holds a LIST where the job is composition and ONE where the job is
  editing. Do not force uniformity on this.
- **WHAT DOES "SAVED AND REMOVED" DO TO A HALF-FINISHED PACK?** Save has to be
  allowed to leave it on the bench — the natural move is *Save* keeps it and
  *Done* clears it, rather than one button doing both silently.
- **THE POST GIG CASE IS THE LEAST WORKED OUT and should probably be built
  last.** Console and Workshop have obvious cargo; Post gig's is a night, and a
  night is only just becoming a real object. Build the two that are clear and
  let the third follow the night.

**AND ONE THING THIS MUST NOT DO: put a second gradient button on a screen.**
The GUI rules allow exactly one *"the night"* control per screen, and the bench
is the place it lives. On Workshop that button is green (*make something*), on
Console it is the account gradient (*the night*) — which is the existing rule
working, not an exception to it.

### SIX PACKS IN REACH — a shortlist, because a drag needs to SEE both ends

Raised on 15 August 2026 as a crowding problem — *"if the packs section gets
too many packs it will start to look crowded, can we just have a 'highlighted
packs' section"* — and then reframed by the host into something better:
***"6 is perfect because it's not just about crowding but also what can be seen
to be dragged and dropped."***

**That is the real justification and it changes what the feature is.** Drag and
drop only works while the card AND the slot are both on screen. It is why
`pinTonightWhereItIs()` had to be written at all: the drop target kept
scrolling away from the hand. Six packs is ONE ROW sitting directly under the
Tonight bar, which means the common gesture needs no scrolling at either end.
**The shortlist is not tidying. It is what makes the gesture possible.**

So it is not a curation feature and should not be built as one:

- **THE SIX SIT AT THE TOP OF THE LIBRARY, nearest the bar**, and *See all N*
  expands underneath. The packs you can reach without scrolling are the ones
  the app thinks you want.
- **CHOSEN AUTOMATICALLY, NEVER STARRED BY HAND.** `quickPicks()` already ranks
  by what the room is least likely to have heard — never played first, then
  longest since — and that is not a proxy for *what should I play tonight*, it
  IS that question. A hand-picked six is a preference that goes stale (starred
  in March, still showing in October) and a Monday job per pack, which is the
  cost this app measures features by.
- **EXCLUDE WHAT IS ALREADY IN TONIGHT'S SLOTS**, or the six things you are
  most likely to want are partly things you have already picked.
- **SEARCH SCANS EVERYTHING AND SHOWS SIX — into the same six positions.**
  Corrected by the host immediately after the above was written: *"that's also
  why search needs to discard packs from the 6 so they're easily drag and
  droppable."* **The six are a fixed WINDOW onto the library and only their
  CONTENTS change** — at rest the automatic picks, while searching the top six
  matches. A pack you searched for is then exactly as reachable as one the app
  suggested, which is the whole point; results appearing in a list somewhere
  further down the page would put the thing you were looking for out of reach
  of the slot you want it in.
  **It also keeps the row a constant piece of furniture**, which is the rule
  this bar already follows: Launch is always there and goes hollow, Set it up
  is always there and goes disabled. A results list that appears out of nothing
  somewhere else is the exact fault those two exist to avoid.
- **A PIN ON TOP OF THE AUTOMATIC SIX** — *"a pin feature could be cool, just
  a little pin in the corner that comes on and off."* It composes cleanly and
  that is the whole reason to build it this way round: **pinned packs take the
  first positions and the automation fills what is left**, so one pin still
  leaves five suggestions and the ranking is only lost if somebody pins all
  six, which is then their choice rather than a side effect. Automatic first
  then manual on top is the cheap direction; manual first is not.
  - **TOP LEFT, because the other corners are taken.** An own-pack carries its
    *Yours* badge top right and the era word sits bottom right. Top left is
    also where the eye starts, so a pin there reads as a status rather than a
    decoration.
  - **THE STATE IS THE WORK, not the icon.** A pin is per-account, like
    `prefs.askRounds` — it has to be stored, restored and scoped to the room,
    and it must survive a deploy. The drawing is an afternoon; the persistence
    is the feature.
  - **A pin is not a launch.** It changes what is in reach, nothing else — it
    must not put a pack in a slot, or the two gestures start competing on the
    one screen where a mis-tap costs setup work.

**Not urgent at seventeen packs** — nine quiz and eight bingo is two rows, and
building a curation layer against a shelf neither of us has seen is designing
blind. It earns its place when the library is long, or sooner if the reaching
turns out to be the annoying part rather than the scrolling.

### TONIGHT IS A RUNNING ORDER — slot 1 is the first thing the app plays

Decided on 15 August 2026: *"I think it should be running order so the first
drop zone is the first thing the app plays, that makes sense."* Three slots,
each taking ANY pack type, played in the order they sit in.

**This is the NIGHT object again, arriving from a third direction** — after the
gallery's publish trigger and the two-nights distinction. Three separate roads
now end at the same piece, which is about as strong a signal as this list gives
that it is the right thing to build next.

#### AN ITEM IS A PACK, OR THE PART OF ONE YOU PICKED

Asked, and the answer was better than the three options offered: *"can't we
have it so the QM decides what he does with each pack and sub pack? So if he
wants a whole quiz pack and then half a second one followed by music bingo he
should be able to."*

**That dissolves the question rather than answering it.** Composition is not a
rule about types that the app applies — it is the quizmaster deciding, per pack
and per round, and the app doing what the row says:

| In the row | What plays |
|---|---|
| Quiz pack A, whole | its rounds |
| Quiz pack B, three rounds ticked off | the rounds left on |
| A bingo pack | a bingo game |

**A run of quiz items is ONE quiz.** `composeQuiz()` already does exactly this
— merges chosen rounds from several packs into one game and titles it for the
evening — so "a whole pack then half of another" is built and working today.
**A bingo item is its own game**, because bingo is not rounds and cannot be
merged into a quiz.

So the running order is really about **where one GAME ends and the next
begins**, and the answer falls out with nothing to decide: a game ends where
the kind changes. Everything else is the round ticks, which already exist.

**Which makes this smaller than it looked.** No new composition, no merge
control, no behaviour taken away — what is new is that the row may hold more
than one KIND, and that the app remembers what comes after the one playing.

#### What has to be built

- **The order lives on the ROOM, not in the game state.** `state` belongs to
  one game and is replaced when the next launches, so a list that has to
  survive game one ending cannot live there. Per-room, persisted, restored on
  boot like everything else that must survive a crash.
- **Each slot is `{ kind, packId }`** — the game-type dropdown at the top of
  the bar stops being a mode and becomes, at most, a filter on the search box.
  Dropping a bingo pack must no longer switch the whole bar over.
- **Launch fires slot 1** and marks it played. **"Next: <pack 2>"** then has to
  appear somewhere the host will see it at eleven o'clock with a room in front
  of them — the running panel, not a tab they would have to go and find.
- **A played slot is not deleted.** The order is the record of the evening
  while it is happening, and it is what the night object will be filed from.

#### What NOT to do

- ~~**Do not make it four or five slots.**~~ **SUPERSEDED on 15 August 2026 —
  it is SIX** (*"need 6 pack slots imo"*). The original reasoning was about
  PACKS — three being a quiz, a bingo and one spare — and the night has since
  stopped being made of packs: it is a running order of ELEMENTS, and a quiz
  split either side of a breakout is three items before a bingo game is
  anywhere near it. **The worry behind the old rule still stands and is
  answered by the WIDTH instead of the count**: a row that needs reordering and
  scrolling is the thing to avoid, so the tiles came down to 160px, which puts
  six on one laptop row inside the space three took at 200.
- **Do not auto-launch the next one.** The gap between games is the host on a
  microphone, and software deciding when that ends is the one thing guaranteed
  to be wrong in a real room.

#### WHAT IS ACTUALLY LEFT, measured on 15 August 2026

Worth writing down, because the entry above reads as though none of it exists
and most of it does:

- **A multi-pack QUIZ night is BUILT AND WORKING.** `composeQuiz()` merges
  chosen rounds from several packs into one game, the three slots draw, the
  round ticks work, packs reorder by drag, and Launch says *"Launch tonight —
  2 packs, 3 rounds"*.
- **What is NOT built is a night that CHANGES KIND partway.** One line does it:
  `if (!packDrag || packDrag.kind === 'bingo') return;` on the running order's
  drop handler — a bingo pack cannot be dropped in at all today.

**So the expensive half of this entry is the mixed-kind night**, and it is
expensive for a reason worth naming: the session runs ONE game, so quiz → bingo
→ quiz means ending a game and starting another while the room, its teams and
its scores carry on. That is the piece to cost carefully, not the slots.

---

