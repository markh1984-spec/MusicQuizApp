# The console's outstanding UI work

Doors, benches, the popover editor, the running order, and the seams left in
the console — the work that lands on the page a night is launched from.

**This is part of [`../TODO.md`](../TODO.md)** — the live list. It moved out on
16 August 2026 because every session opens TODO.md and this is not what most of
them need. **A finished item is DELETED from here, never ticked**, exactly as in
the parent file.

---

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

### THE MIXED-KIND NIGHT IS BUILT — quiz → bingo → quiz, one running score

Built and live-verified on 20 August 2026, for the exact request that named
it: *"run a split quiz where the quiz is broken up by two music bingos and the
quiz prizes are only given out at the end."* The expensive half this entry used
to describe — **the session runs ONE game, so a kind change mid-evening means
ending one and starting another while the room, its teams and its scores carry
on** — is done: `session.launchRunningOrder()` / `session.advanceOrder()` in
`src/session.js`, the `/api/host/launchOrder` route in `server.js`, and the
"Continue to the bingo/quiz" button on the control view
(`host.js`/`host-bingo.js`) replacing next/finish at exactly the moment those
would otherwise end a part for real. No `engine.js`/`bingo.js` changes at all —
the boundary is the natural pause every night already has (a composed quiz's
own `ROUND_BOARD` after its last round, bingo's own `WON`).

**BUILT A DIFFERENT ROAD THAN THIS ENTRY PLANNED, DELIBERATELY, ON A GIG-DAY
BUDGET.** The plan below was to extend the Tonight bar's own row (`lbExtra`,
`PACK_SLOTS`) to accept a bingo pack directly. What shipped instead composes
the running order from a SAVED SHOW — `itemsOf(show)` already has exactly the
right shape (`{kind, packId, order?}`), and the Shows editor already lets a
host "Add a bingo game" / "Add a quiz" and reorder with arrows, so no new
composing UI had to be built or trusted the night before it mattered. Pressing
Launch on part 0 of a 2+-item show now goes through `doLaunchOrder()` instead
of an ordinary launch; every later part loads through the control view's
"Continue" button, never back through the console.

**WHAT THIS MEANS THE TONIGHT BAR'S OWN ROW STILL CANNOT DO**, and it is the
one thing genuinely left: `if (!packDrag || packDrag.kind === 'bingo') return;`
still guards `console-tonight.js`'s own drop handlers (currently around lines
1905 and 1961), so a bingo pack still cannot be dragged straight into the
Tonight bar's row — a host wants a mixed night, they go via Workshop → Shows
first. **This is now a UI convenience, not a risk to cost carefully** — the
hard part (session-level pause/resume, roster and score carry, no premature
archiving) is done and tested, so wiring the Tonight row up to the same
`launchRunningOrder`/`advanceOrder` machinery is a much smaller job than this
entry used to describe, whenever it is worth the taps saved.

**ONE KNOWN GAP, left alone deliberately on the same budget**: the archived
record for a mixed night keeps only the LAST part's own data — a 3-part
night's Past gigs entry reads as if it were just the closing quiz. Score,
prizes and timing are all correct; it is specifically the evidence side (see
*Gigs is evidence* below) that is thin for a mixed night. Worth fixing before
this is leaned on for a venue-facing report, not before then.

Full reasoning, including the two bugs live verification caught (a bingo
lobby-game default not resetting across the switch, and the voucher
dispatcher gap): **[`docs/console.md`](../docs/console.md)**.

---

