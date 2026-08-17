# The console's outstanding UI work

Doors, benches, the popover editor, the running order, and the seams left in
the console — the work that lands on the page a night is launched from.

**This is part of [`../TODO.md`](../TODO.md)** — the live list. It moved out on
16 August 2026 because every session opens TODO.md and this is not what most of
them need. **A finished item is DELETED from here, never ticked**, exactly as in
the parent file.

---

### THE CONSOLE IS FOR LAUNCHING — two remnants left

**ONE OF THE TWO IS BUILT.** A pin now keeps its ORDER — `pinRank()` replaced
the boolean sort — so ignore any line below saying the arrangement is thrown
away. **What is left: no drag-to-arrange, and the Console shelf still has no
route to the Workshop** (that second one was deliberately left; see the note in
`TODO.md`).

**THE MOVE ITSELF IS DONE**: the doors are built, the writing panels are off
the Console, and the shelf is stripped there. **Two sub-parts are not**, and
they are all that is left of this entry:

- **Choosing the six from the Workshop.** Pins are stored (`prefs.pinnedPacks`)
  but the sort at `console-packs.js:214` is a boolean — `isPinned(b) -
  isPinned(a)` — so the pinned list's ORDER is thrown away. No drag-to-arrange.
- **No route to the Workshop from the Console shelf.** The quiet
  *"Write, buy or edit packs →"* line exists at `console-packs.js:117` but is
  drawn on every door EXCEPT the Console, which is the one place the entry said
  had to have it.

The reasoning below is kept because it is what settled the split.

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

### TONIGHT IS A RUNNING ORDER — the mixed-kind night is what is left

**MOST OF THIS IS BUILT**: six numbered slots (`PACK_SLOTS`), the drag and
`movePack()`, the round ticks, the 12-round guard, and `composeQuiz()` wired
through `session.js` — a multi-pack quiz genuinely plays. Do not rebuild any of
it. **What is left is the expensive half the entry already named:**

- **A bingo pack cannot enter the running order.** One line, twice:
  `if (!packDrag || packDrag.kind === 'bingo') return;` at
  `console-tonight.js:1859` and `:1915`.
- **The order does not live on the room.** It is module state (`lbExtra`), so a
  reload loses a mixed evening — only a saved SHOW persists one.
- A slot is a bare pack id rather than `{ kind, packId }`, and nothing marks a
  slot as played. *"Next: X"* exists for shows only.

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

