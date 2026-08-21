# History — where the app has got to, and what each night found

The reasoning behind the history rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## Current state

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

**Live as of 20 August 2026, for a gig the following night:** each winning
bingo team now gets a one-use voucher QR the same way the quiz's winners
already did, and a night can now run as several PARTS — quiz, a bingo
interlude, quiz again — with one set of teams and one running score carried
across the interruption, bingo's own prizes still handed out the moment
they're won and the quiz's only at the true end. See "QUIZ → BINGO → QUIZ,
ONE RUNNING SCORE" in CLAUDE.md and the full reasoning in `docs/console.md`.
Merged straight onto `MusicQuizApp` after the full suite, the protected-
surface payload guard and a real Launch smoke test all passed on the merged
tip — see "Where to push" in CLAUDE.md for why that branch is pushed to
directly rather than merged by hand.

**Same day, second deploy:** the Tonight bar itself now builds a mixed night
too — a bingo pack drags straight into the row, a round drags out of its pack
into its own slot around it — asked for directly after the first deploy, once
the host saw what saving-as-a-show could already do and wanted the faster
gesture. Live verification caught and fixed two real bugs before this went
out, one new (a bingo pack dropped on the empty row launched as a quiz) and
one pre-existing (reordering packs could silently delete one) — see "THE
MIXED ROW" in `docs/console.md`.

All five build stages plus bingo, the console, generation, pack import, the
tickable review flags, the alphabet round, per-type question counts and the
picture round's four reveals, invoicing, the seasonal looks and the accounts
foundation are done and tested. Since then: the photo props, the big photo
moment, the double-tap and early-reveal guards, the shared portrait library
with its style and quality settings, the leaving-the-app note, and the fastest
finger's face on the reveal, and **a room per quizmaster** — so a second login
is now safe to hand out, and a permissions sweep run AS a quizmaster has
closed five holes it found.

Most recently, and all of it live: **the Owner | Quizmaster switch** in the top
right of the console and the owner page; **Quizporium**, with each night branded
from the quizmaster whose room it is; and **six colour schemes** on the account,
so a subscriber does not have to put somebody else's pink-and-orange on a
projector with their own name above it; and a **My account** tab, where all
of that now lives, on a **Bronze / Silver / Gold ladder** that the pricing
will hang off — and the owner can look at the console as a subscriber on any
rung of it; **a question mark inside a microphone** with the name stacked under it —
the mic is the host and the question is what every round actually is, which
the vinyl record and the mic-and-note before it both failed to say.

**What a topical pack costs, measured rather than guessed: about £2** (£1.20 to
£3.90 depending on how much the checker thinks). Measured by running the real
generator against a stub that records every request body and pricing it with the
app's own table. Three things fall out of it and all three matter:

- **The CHECKING is 86% of the bill** — eleven Opus batches with thinking, at 6p
  per 1,000 output tokens. Not the web, not the writing.
- **Being topical only adds about 26p.** The same forty questions with no web at
  all are £1.87. Topicality is nearly free; correctness is what you pay for.
- **The prompt caching saves 9p, not the £1.40 first claimed.** The digest is
  only ~1,200 tokens and the checker's cost is output rather than input. The
  warm-the-cache-first fix is still strictly better and costs nothing, so it
  stays — but the saving that was actually worth having came from doing ONE
  search instead of one per batch.

There is a 5× lever nobody should pull: the checker on Sonnet 5 takes a pack to
66p. That is the pass that stops a wrong answer reaching a paying room. The way
to settle the range for good is to **press the button once and read the Money
tab**, which is what the ledger was built for.

Most recently: **the topical quiz** — one button that reads the last month off
the web and writes forty questions from it, 20 news and 10 music from the
month plus 10 evergreen music so it is not all one thing. One digest, shared by
the writer and the checker so they cannot judge against different facts; the
checker's first batch sent alone so the rest can read the cache it writes
instead of six of them paying for the same tokens; and the ledger taught to
price a cached token and a web search, without which none of that would have
shown up as a saving. See **Where a topical pack comes from** above.

Most recent session, all pushed: **generated packs arrive with the answers
already spread across A-D** rather than the host pressing a button to fix a
lean the app had just created; **"Never played" means YOUR nights** and now
survives a deploy, which is why it kept resetting; and three faults on the
intro-round playlist button, the worst of which made **a Spotify refusal look
identical to a success** — it is the reason an evening went on a 403 with
nothing on screen to name it.

And the commercial foundation: **the tier lever is the LIBRARY, not the
buttons.** A starter set of packs runs out on its own in month four while the
host is doing well, where a greyed control would look broken in front of a
room. `packsFor()` filters the library and the launch server-side; every tier
is `'all'` today, so nothing changed for anybody. The account page shows it —
"Quizzes 3 of 7" with the tier that holds the rest — and each feature now
carries the same **On | Off** switch as the hat in the top right, with a `+`
where a tier above yours would be.

**The owner page is five tabs now** — Tonight, People, Money, Catalogue, Inbox
— and two of them answer questions nothing in the app could answer before:
whether anybody is mid-question right now (so a deploy waits), and what the AI
has actually cost, from a ledger written as each call happens. That second one
is the number the whole tier structure rests on and it existed nowhere.

**The ladder has its numbers and its logic now**: Bronze £10 with eight packs,
Silver £20 with the whole EVERGREEN catalogue, Gold £30 adding a topical quiz
every week. **Gold is sellable** — it used to be streaming and nothing else, so
it bought Silver at a £10 markup; now it is the one thing nobody can buy once
and reuse. See **The ladder is CAPEX AND OPEX** above for the arithmetic that
makes the gradient hold, and note the commitment it carries: a weekly
read-through, for as long as one Gold subscription exists. Advert slides moved
to Silver, the one feature up a rung for a reason other than cost: it makes the
QUIZMASTER money, and withholding it cannot make a night look cheap because a
slide is not part of the game.

**A quizmaster now keeps their OWN packs**, and this is the one gate in the app
that runs backwards: the owner cannot read them. Enforced structurally — no
route takes a room parameter, so there is no id anybody can send that reaches
another room's folder — and the only way in is the support-access door they open
themselves, which expires and logs what was looked at. `/api/mine/*` writes
their library, `/api/quiz` and `/api/bingo` still write the catalogue and are
still the owner's, and they still do not generate. They back up to a THIRD
private repo (`PACKS_REPO`), never the one holding the owner's accounts and
invoices; until that is set the console says so in red and every own pack has a
Download button.

All on **`MusicQuizApp`**. 980 tests green.

### What a GUI SWEEP found — thirteen things, all fixed

Run at the host's own asking after the first real night went smoothly:
*"can you do a bug sweep for things like repeated buttons, unnecessary steps
etc."* Every one was reproduced in a real browser before it went on the list
and again after it was fixed. What they have in common is worth more than the
list: **not one of them failed a test, returned a 403 or threw**, and the
payload guard reported 3,210 identical comparisons before and after.

**The one that mattered: THERE WAS NO UNDO ON THE PHOTO SHEET.** Two buttons
carried `.cam-undo`, `querySelector` took the first, and the first lived in the
seasonal row — which is `hidden` on an ordinary night. So the wired one was
invisible and the visible one was never wired, on every night the host has ever
run. Written up in the props row above, including where it will break next.

Four more that were reachable on a gig night:

- **The quick-launch priority did nothing.** `Date.parse()` was being used on
  `lastPlayedAt`, which is epoch MILLISECONDS — `Date.parse(1786…)` is NaN, so
  `|| 0` made every pack sort as 0 and "never played first, then longest ago"
  never happened. The pack played last night could be the first thing offered.
  It also printed **"Last played"** with no date after it. One reader,
  `playedAt()`, now used by the sort and the label so they cannot disagree
  again — and it takes a string too, because an old pack may carry one.
- **The menu was crushed to nothing on the control view.** `flex: 1 1 0` hands
  it whatever is LEFT, and at 320px the logo and the hat slot took the lot: the
  nav was allotted **0 pixels** against 237px of chips, so the first was clipped
  to "Consol" and the other two were gone. A scroll container with no width
  cannot be scrolled. It has a 96px floor now, the brand drops its WORDS on a
  phone so there is room, and `paintNav()` scrolls the lit chip into view like
  the console's own tab bar. Measured at 320/390/430/768/1280 on all four pages.
- **Cancelling a relaunch left a button that would not say what it launched.**
  The restore wrote the literal string "Launch" over a quick pick's two spans.
  Now the markup is captured and put back — and "Launching…" is set in
  `doLaunch` alone, because the three call sites each setting it themselves is
  what destroyed the label before the restore could see it.
- **Deleting a venue asked on one screen and not on the other.** Same record,
  same route; the Venues tab confirmed and the Invoices sheet did not.

Then the repeated controls, which is what he actually asked about:

- **`Big screen` / `Open big screen`** and **`Edit` / `Edit questions`** — both
  pairs on the control view at once, the same act twice in two pairs of words.
  The Setup panel's copies are gone; the BAR keeps them, because it carries
  them at every phase with no question up, including the round boards, where
  Setup does not exist.
- **`Playlist` meant two opposite things** a week apart: a button that BUILDS
  one before it exists, a green link that OPENS Spotify after. They are never
  on screen together, which is what let it survive — a collision separated in
  time is still a collision and is the worse kind. It is **Make playlist** now,
  and the panel's own button matches it. **The two presses were left alone
  deliberately**: that panel is where a missing Spotify login is explained
  before anything is committed, and this writes to the host's real account.
- **`Venue` and `Customer` were one record wearing two nouns.** The Venues tab,
  the launch picker, the pack card and the archive all said venue; the invoice
  sheet said customer, and the Venues tab carried a sentence explaining they
  were the same list — which by the house rule is the tell that it is a design
  problem rather than a copy one. The UI says **venue** throughout. The wire is
  untouched (`/api/invoices/customers`), because a route is not a label.

And three smaller ones: **Back was drawn live in the lobby** where
`Engine.back()` returns false, so it is disabled there now; **`.minor` had no
rule inside the control view's panels**, so Setup's Load and Download results
were drawn by the browser as a grey button and a blue underlined link on a page
that is otherwise entirely this app's; and the prize line the pack card gained
last week is now **also in Setup**, because the two quick-launch buttons take
no settings by design and therefore always launch with no venue — which is the
fastest path in the app and the one that reproduces the missing voucher.

**One finding was deliberately NOT actioned.** Skip and Stop the quiz are both
outlined red on the question screen, which looks like two warnings of very
different weight — but `skipQuestion()` genuinely wipes that question's points
and its history, and Back cannot bring them back. Both are destructive, so both
are red, and the rule holds.

### Three things the FIRST REAL NIGHT found, and all three are fixed

The host ran the app in front of a paying room for the first time and came back
with exactly three things. Each is written up in its own section above; what is
worth seeing together is that **none of them was a crash, a 500 or a failing
test** — two were the app saying nothing where it should have said something,
and the third was a setting that existed and was never set.

- **No prize QR at the end.** The prizes come off the venue record at launch,
  the venue had not matched a record, so there were none — and nothing anywhere
  said so. The pack card now states what tonight is playing for, and states it
  when the answer is nothing.
- **The picture round was ten zooms.** `mix` and its four effects have existed
  since the round was written; the generator never set a reveal at all, so
  every generated pack fell back to the default. One word, and now a test.
- **The same act as a decoy over and over.** A `same-option` count on the
  read-through and a line in the writing brief — the brief so the over-ask is
  not wasted, the count because that is what actually holds.

**The lesson they share is worth more than the fixes.** Two of the three were
invisible from every check this repo has: `npm test` was green, the payloads
were byte-identical, nothing 403'd and nothing looked broken. They were only
findable by a human running a night and noticing the app had not told them
something. That is the same class as *Scores on screen* vs *My scores* (since
renamed — see the sweep notes) — which
is why label collisions are now part of Sweep mode — and it is the argument for
the host wearing a real quizmaster's hat rather than reasoning from the console.

### What landed on 14 August 2026

A long day, and most of it is written up in its own section above. The short
version, in the order it matters:

- **ONLINE MODE, steps 1 to 4** — `state.online`, the question on the player's
  own device, chat with an organisers' back channel, and teams scored on the
  average. All off unless asked for at launch. Step 5, the media layer, needs a
  Cloudflare account.
- **A NIGHT KNOWS WHERE IT WAS** — `state.venue`, a plain name chosen at launch
  and carried into the archive, with previous venues offered back. **Four
  features were stacked behind this one field**: Past gigs that say where,
  headcount per venue, the calendar, and an invoice that fills itself in. None
  of them is built; all of them are now unblocked.
- **`scripts/pub-unchanged.mjs`** — the guard that answers "did I break the pub
  night" with bytes rather than with "the tests pass". It reported 2,150
  identical payloads after every change today.
- **THE ACCOUNT MODEL, settled end to end** and written up above: owner / on
  their own / parent / child; `kind` for what an account IS; stats as a view
  over a set rather than a phantom account; hats only for genuine dual
  identities; the parent free and seats the product; a night carrying two
  attributions; and a quizmaster's own packs staying theirs inside a company.
- **THE GUI RULES** — five roles, and a scheme changing personality but never
  meaning. Wired in: one gradient angle, radius tokens, a field style, red
  outlined Delete, green for the things that make something.
- **The owner page** — the £ badge for where an account stands on money, a
  filterable People list, and the refusal that used to tell the OWNER their
  account runs quiz nights.

**Two things deliberately NOT done**, both noted where they belong: the lit
menu chip coming off gold, and the eight corner radii collapsing to three. Both
cosmetic, both on screens used on a gig day.

### ONLINE MODE — built on 13 August 2026, steps 1 to 4 of 5

**A night now knows where the room is.** `state.online`, set at launch from a
**Where** picker beside Look ("In the room" / "Online — the question goes on
their phones"), living in the game state like the look and the card shape.

What is live:

- **The question on the player's own device**, which is the one place rule 8 is
  deliberately inverted — there is no projector to look up at. It sends
  `screenQuestionExtras` rather than a list of its own, so it can only ever
  show what the big screen already shows in front of a room. **The picture is
  held back**: a round 2 image is zoomed or pixelated for most of its twenty
  seconds and that curve IS the scoring, so the finished image on a phone would
  make the round a giveaway. The fields that drive the effect are sent, so
  porting the animation to `play.js` is one line and an online picture round
  wants the shared window until then.
- **Chat** (`src/chat.js`, `public/assets/chat.js`) — a main room, an
  **organisers'** back channel for the client's contact and their IT person,
  and a room per team. **A sub-room IS a team**, so there is no second concept.
  **Emoji only in the main room while a question is live**, because otherwise
  it is a channel for broadcasting the answer to sixty people at once — worse
  than googling, being instant and social. The organisers' room and team rooms
  are never gagged. **Chat does not exist in a pub at all**, deliberately: a
  pub already has a room and the whole app keeps people looking up.
- **Organisers** are in the back channel and in nobody's scoreboard —
  `answer()` refuses them and `playerList()` filters them out, or the person
  who booked the night wins it. Marking one is a HOST action, because "I am an
  organiser" as a request field would be a way into the back channel chosen by
  whoever fancied it.
- **Teams** — a **Playing** picker at launch, and the score is the **AVERAGE**.
  A member who answers nothing is a ZERO in the mean rather than skipped, or a
  team carries passengers for free and the incentive becomes recruiting rather
  than knowing things. Six chancers score 100 where two who know their stuff
  score 300. Picking a team is a PLAYER action on the waiting screens only, and
  the engine refuses a switch mid-question so nobody watches the tally and hops
  into whichever team is winning.

**Everything above is off unless it is asked for at launch**, and
`scripts/pub-unchanged.mjs` reports **2,150 identical payloads across seven
packs** for a night that uses none of it. See "Online mode is ONE BOOLEAN"
above for the branch budget that keeps that true.

**Step 5, the media layer, is NOT built and needs an account.** Cloudflare
Realtime — per GB rather than per participant-minute, which for one host
broadcasting speech to a room is two orders of magnitude cheaper (about 15
cents a hundred-person night against $48 on a participant-minute provider),
with 1,000 GB a month free. The checklist is in TODO.md. **Do not start it
before the account exists**: a media layer written against a stub has never met
a real ICE negotiation, and it is the first third-party service in the live
path of a night.

### The menu lost its Owner chip

`Console · Control · Packs`, identical for every account including the owner's.
The topbar carried the word "Owner" twice — a menu chip and half the hat switch
four inches away — and the switch keeps it because it is the SIGN as well as
the switch. **The hat switch's Owner half now GOES to `/owner`** rather than
taking the hat off in place, because it is the only route to that page left.

### `scripts/pub-unchanged.mjs` — the guard worth knowing about

Written because the host asked whether a night's work would make his Wednesday
awkward. It runs the engine from a commit you trust side by side with today's,
on one injected clock, with the same teams answering the same options at the
same seconds, through every phase of every pack — and compares the BYTES a
projector and a phone receive. `--ignore` names fields allowed to be new, by
name. Run it before a gig week; "the tests pass" is a weaker claim than the one
anybody wants the night before a gig.

**A second quizmaster CAN now be given a login.** They get their own running
game, their own join code, their own photo wall, their own name and colours on
the projector, read-only access to the pack library — **and a library of their
own, which the owner cannot read**. The invoice book, the night archive and the
advert slides are per room too. See "A room per quizmaster" above.

### The live app is set up now — this is what is actually on Render

Confirmed by reading the environment list on the dashboard:

`HOST_KEY`, `PHOTO_REPO`, `PHOTO_TOKEN`, `GITHUB_REPO`, `GITHUB_TOKEN`,
`ANTHROPIC_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
`SPOTIFY_REFRESH_TOKEN`, `GOOGLE_API_KEY`, `PACKS_REPO`.

**READ IT OFF THE APP RATHER THAN OFF THIS PAGE.** `GET /api/library` reports
`generation` — `claude`, `art`, `google`, `openai`, `spotify`,
`spotifyMissing`, `backupConfigured` — and `ownPacks.repo`. That is the live
answer; this list is a note that goes stale, and on 14 August 2026 it was wrong
about three variables at once, every one of them in the "not set up yet"
direction. If a feature looks unconfigured, check the payload before believing
a document.

As of 14 August 2026 the payload says `art: "google"` (the picture round draws
real portraits), `spotify: true` with nothing missing (intro playlists build),
and own packs backing up to `markh1984-spec/quiztopia-packs`.

**Still absent: `BREVO_API_KEY` and `PUBLIC_URL`**, so the forgotten-password
email is built but not switched on — the sign-in page says so plainly rather
than pretending to send.

**UPDATED 17 August 2026, and the correction is worth more than the fact.**
The Brevo ACCOUNT exists and **`quizporium.co.uk` is Authenticated and
Branded** — seen on Brevo's own domains page. So DKIM, SPF and the DNS work
are done, which is the fiddly half.

**This file said otherwise, and a session believed it.** Working from the note
above plus `todo/marketing-app.md` — which lists Resend and Kit as the accounts
held — I told the host outright that nobody had signed up for Brevo. The docs
were behind reality and were treated as reality. **Read the world, not the
note, before telling somebody what their own deployment looks like.**

**What is still NOT confirmed: whether `BREVO_API_KEY` and `EMAIL_FROM` are set
on Render.** They cannot be checked from a session container — its egress is a
fixed allowlist and the live app is not on it. The app answers the question
itself: *Forgot password* on `/login` replies *"Password reset by email is not
set up on this server yet"* when `emailConfigured()` is false, and *"a link is
on its way"* when it is true. **Confirm it that way rather than writing it down
on anybody's memory, this note included.** **No `BRAND_NAME`** — checked deliberately, because it
overrides the per-quizmaster naming and a leftover value would hide that whole
feature while looking exactly like a failed deploy. `OPENAI_API_KEY` is dead
ground because the account behind it was deactivated.

So the bookmark survives a deploy, and accounts, invoices, reported questions
and play counts all back up to the private repo and come back at boot. The owner
account exists and has survived a redeploy, which is the only real proof any of
it worked.

**Still wiped on every restart**, and worth knowing before somebody reports it
as a bug: `data/photos/` and `room-codes.json` — so another
quizmaster's four-letter join code CHANGES on a deploy. Mark's own printed QR is
safe, because the house room deliberately has no code. What survives is anything
in git (the packs, the adverts, the images, `data/track-history.json`) and
anything in the private repo (accounts, invoices, reports, play counts, the
night archive, and the photos themselves once they have been filed).

**Rob and James have not been added yet** — he has not asked for their emails.
Two minutes each on the owner page when he does. He needs no second account for
himself: the Owner | Quizmaster switch is that.

The host key still works and still beats a signed-in account, unchanged.

**Which feature sits on which TIER is still to be decided** — see the ladder
above. What is there now is a first guess so there was something to look at;
`FEATURE_TIER` is one word per feature. The quickest way to settle it is to wear
the hat on Bronze for a few minutes and see whether it reads as a free tier or a
crippled app.

**If he says the projector still says "Mark's Music Madness"**, check
`BRAND_NAME` on Render before anything else. It beats the per-quizmaster name by
design, so a value left over from before this change would hide the whole
feature and look exactly like it had not deployed.

(An earlier version of this line named `claude/new-session-jzx988`. That branch
is gone — see **Where to push**.)

Outstanding work is all on the host's side — see **TODO.md**. Short version:
an OpenAI key for the round 2 portraits, and finishing the Spotify setup. Both
optional; the app runs a full quiz and a full bingo night without either.

### Where the Spotify setup got to (stopped here, mid-setup)

Done on his side: Node installed on the Mac, the repo unzipped to
`~/Downloads/MusicQuizApp-MusicQuizApp`, a Spotify app created, `spotify:login`
run, and all three `SPOTIFY_*` values plus `ANTHROPIC_API_KEY` set on Render.

**Generation works end to end. Only the playlist step is refused.** Claude
writes the list, all forty tracks resolve on Spotify, and then
`POST /users/djmarkstar/playlists` returns a bare `403 Forbidden`.

What is already ruled out: the login **has** all four scopes
(`playlist-modify-private`, `playlist-modify-public`, `playlist-read-private`,
`playlist-read-collaborative` — `grantedScopes()` reports them), and the
account has been added under **User Management** in the Spotify dashboard.

**Step 1 has now been done and it was NOT the cause.** He re-ran
`npm run spotify:login` and replaced `SPOTIFY_REFRESH_TOKEN` on Render; the
refusal is identical. Worth having done anyway — the new grant picked up the
two playback scopes the autoplay feature needs — but rule it out for good.

The refusal is now reported in words on the console rather than swallowed (see
below), and it says the login holds all four playlist scopes. **So the token is
not the problem and there is no point regenerating it again.**

What is left, both two-minute checks:

1. **Check the dashboard is logged in as the same account that authorised**
   (`djmarkstar`). If the app is owned by a different account, adding
   `djmarkstar` under User Management adds it to an allow-list this token is
   never checked against — which looks exactly like the setting not working.
2. **Check the User Management entry matches** the full name and email on that
   Spotify account exactly. A near-miss silently does nothing, with no error
   anywhere.

**A refresh token does not expire and does not rotate**, so this is not a thing
he has to keep doing. `src/spotify.js` uses the authorization-code flow with a
client secret, not PKCE: the refresh token is swapped for a one-hour access
token as needed and never rewritten. Only a NEW SCOPE, a revoked app or a
rotated client secret invalidates it — and a new scope is the one to warn him
about, because that is a change made here rather than by him.

### The way round it — and it is the host's chosen route now

Claude in a browser has a Spotify connector and can build the playlist. He
tried it, it worked, and he asked for the app to be built around it rather than
waiting on the 403. **Treat this as the main way bingo packs get made**, not a
stopgap: for bingo the playlist and the cards have to be the same forty songs,
so building the playlist first and the cards from it is the right order anyway.

The loop is: **ask Claude for a round → paste the list it prints into Import.**
Nothing is copied out of the app; Claude fetches what it needs itself.

### Who owns what — settled, and the thing most likely to be broken by accident

Claude in the browser has its own skill for this, with its own copy of the
house rules and, until now, **its own `used_songs.json`**. Two files that both
get written drift apart: one thinks a round happened, the other does not. So:

| | Owns | Never |
|---|---|---|
| **Claude in the browser** | the house rules (its `SKILL.md`), picking the songs, building the playlist | writing any song list of its own |
| **This app** | `data/track-history.json`, the cards, the night | telling Claude what its rules are |

**One list, one writer.** Claude READS
`raw.githubusercontent.com/markh1984-spec/MusicQuizApp/MusicQuizApp/data/track-history.json`
before curating and writes nothing back. The app appends when a pack is
imported, and `backUpHistory()` pushes it to git — which is what makes the raw
URL current rather than a snapshot.

**Is the push automatic? Yes, and there is no deploy step.** `putFile()` commits
straight to the branch over the Contents API, so the raw URL is current the
moment the import finishes. It carries `[skip render]` like every other backup,
so filing a pack never bounces the server mid-gig. Two things are NOT automatic
and both are now said out loud in the banner:

- **It needs `GITHUB_TOKEN`.** Without it the history is written here and
  nowhere else, and Claude keeps reading the old list. `historyBackedUp` is
  reported separately from the pack's own `backedUp` because they can differ,
  and it is this one that causes a repeat in front of a room while the pack
  itself looks perfectly fine.
- **`raw.githubusercontent.com` is CDN-cached** for a few minutes. Building two
  rounds back to back is exactly when that bites, so the fetch wants a
  cache-busting query (`?t=<now>`) — that is Claude's side, not the app's.

Recording at IMPORT rather than at curation is deliberate: a round Claude wrote
and the host binned should not burn 42 songs for three months. It also means
the guarantee is "no song appears in two rounds within three months" rather
than "no song is heard twice" — stronger, and simpler to reason about, since a
pack sitting unplayed still holds its songs against the next one.

His `used_songs.json` was deleted rather than merged; he was happy to start
from what the packs themselves say. **Do not add a way for the app to publish
its rules to Claude, or a way for Claude to write the history.** Either one
recreates the two-copies problem this replaced.

**There WAS a "Copy the brief" button, and it is gone. Do not build it again.**
It pasted the house rules and the whole no-repeats list into the clipboard for
handing to Claude, which was the right thing for one day — the day before the
fetch was confirmed. Claude read the raw URL, reported 319 of 319 entries and
the right first three titles, and at that point the button was a second way to
do the same job. A panel with two ways to do one thing is how you end up doing
the old one out of habit, and the old one was a snapshot where the new one is
live. `src/bingo-rules.js` is what is left: `rulesBlock()`, for the in-app
generator's prompt only.

**The paste box is the route, so it is open and first.** It spent a while
folded behind "or paste a track list instead", from when a Spotify playlist
link was the way in. The link box is still there, below it, in smaller words.

**The history had a hole, and it will happen again.** It is written when a pack
is MADE, so a pack that arrives any other way is invisible to it — 119 songs
across three packs were free to come back. `scripts/backfill-history.mjs` walks
`bingo/` and adds anything missing; dry by default, `--write` to commit, safe
to run twice. Run it after adding a pack by hand.

Both prompts are built from **`rulesBlock()` in that one file**, so the in-app
generator and the browser brief cannot drift apart on what makes a good bingo
track. Change it in one place.

The brief is fussy about one thing, and it is not pedantry: **what Claude
prints has to be what actually went into the playlist.** If a track was not
findable and something replaced it, a pack built from the original list puts a
square on somebody's card that can never be marked.

Not `/api/bingo/brief` — `/api/bingo/…` is a catch-all that reads the rest of
the path as a pack id, so that route would have been a pack called "brief".

**Importing writes to the history too, and that now gets backed up.** It did
not, while generating did — invisible right up until importing became the main
way packs are made, at which point the no-repeats memory would have quietly
reset on every restart. `backUpHistory()` in `server.js`, called by both.

**A finished job says so in a banner, not in the panel.** Import and both
generators call `load()` when they finish, which rebuilds the page from the
library and used to take the result with it: you pressed Import, watched it
work, and were left looking at an empty form. `showDone()` / `doneBanner()`
hold it above everything until you dismiss it or start another job.

**The intro playlist button had the same fault, and a THIRD one under it that
made a failure look like a success.** `buildIntroPlaylists()` catches a
per-round problem and returns a null playlist with the reason on it — right,
because one bad round must not lose the others — but the route reported only
the rounds that WORKED. So a Spotify 403 came back as `playlists: []`: a
success envelope with nothing in it, identical to a quiz whose tracks are all
misspelt, and the only account of the cause was a log line the reload tore
down a moment later. `failed` is now carried through with its reason, the
banner says which round and why, and it is red rather than green. There are
tests that a refusal and an empty search do not produce the same message —
they want completely different things doing about them. **This is the
"failure messages have to name the cause" rule; it had been missed here.**

**The same button also hid a SUCCESS.** It
printed the link into its own panel and then called `load()`, which tore the
panel down — from the outside, a button that says "Building…" and then closes
with nothing to show. Worse, a quiz summary did not carry `playlist` at all
(only a bingo pack did), so the card had nowhere to show it either: the
playlist was built, and the only record of it was a log that had already gone.
`listQuizzes()` now surfaces the first intro round's URL, and the banner holds
every one of them. It hangs off the ROUND, not the pack, because a quiz can
hold more than one intro round.

**A pack's read-through can be linked.** `?read=quiz:<id>` on the console, or
`?read=<id>` to look in both libraries — `openRequestedRead()` in `console.js`.
There was no way to link one at all: it only opened from a click on its card,
so "have a look at this pack" meant "open the console, find it, press Read",
which on a phone with the packs three to a row is the difference between
reading a quiz through on the train and not. It fires **once per page load**,
tracked in a flag rather than by tidying the URL — `load()` runs again after
every save, and a link that reopened the sheet each time would trap you in it.
An id that is not there is ignored rather than an error, because a pack can be
renamed between somebody sending a link and somebody opening it, and landing on
the console is the right outcome.

**And "Open the editor" on that banner opens the pack you just made.** It went to
the editor with nothing chosen, which lands on whatever the list happens to put
first — so after waiting several minutes for a round you were shown somebody
else's quiz and had to go and find yours. The banner carries `done.id` into
`?quiz=` / `?bingo=`, and `editor.js` selects it if the list has it. Silently
ignored if it does not, because a deleted pack in a stale link should open the
editor, not an error.

### Asked for, not built yet

In the host's own order of interest:

1. **Draggable stickers — dog ears, clown noses.** Settled: he asked whether
   Snapchat's own could be had via an API. They can — **Snap Camera Kit** has a
   web SDK — but it needs partner approval, costs money above a threshold, and
   loads megabytes onto a stranger's phone over pub wifi. He chose stickers for
   now and wants to revisit Camera Kit later. Detail on why face tracking is
   off the table: NOT what
   `filters.js` does; that is colour grading. He was clear he means the silly
   AR kind. Real face tracking needs a model (MediaPipe/TF.js, megabytes, and
   heavy on an old phone) or `FaceDetector`, which iOS Safari does not have —
   both break **no dependencies** and both fail on somebody's phone in a room.
   Snapchat's own lenses need Camera Kit, a partner programme with approval.
   The buildable version is **draggable stickers**: tap a prop, drag it onto
   the face, pinch to size. No detection, works everywhere, and people
   misplacing them deliberately is funnier anyway. Offered; awaiting his call.
   (Colour filters on the round 2 portraits are still a separate small job.)
2. **Team play — several phones, one team, scores AVERAGED across members.**
   His idea, and a good one: averaging means a big team of chancers cannot beat
   a small team who know their stuff, and it makes a traditional pub quiz work
   without pens and paper. He wants it built even though he will not use it
   immediately.
3. **Instagram posting.** The point is *proving his quiz nights are popular* —
   visual evidence, not automation for its own sake. Full auto-posting needs an
   Instagram Business account, a linked Facebook Page and Meta app review; tell
   him that before building anything that pretends otherwise.
4. **Advertising slides between rounds.** Upgraded by him from "later" to a
   commercial argument: he sells himself to venues on **increasing their other
   revenue** — a pizza, a drink, a night they want to push — not just on
   running a quiz. That makes the slides part of the pitch, so they have to
   look like the venue's, not like an afterthought.

   **Settled: slides live per venue**, reusable across nights, because that is
   how he sells them. Also his own promos, and the one that pays: a **QR to
   ticket sales he takes a cut of**. The big screen is already a card registry
   and `src/qrcode.js` encodes anything, so a slide with a heading, an image
   and a QR is small. Between rounds is the slot, next to the scoreboard.

### Where this is going — read TODO.md before designing anything big

He wants to sell subscriptions to other quiz hosts, with **in-person and online
as two modes on one account**. Two things follow, and both are cheap now and
expensive later:

- **The app runs ONE game at a time** — one state file, one host key, one
  session, one join code. Multi-tenancy is the prerequisite for every
  commercial direction and is much cheaper to do at eight packs and one account
  than at hundreds of both.
- **Online mode must be a mode, never a layer.** A media service having a bad
  day cannot be allowed to touch a Wednesday night in a pub.

**Payments stay processor-agnostic**, and `src/billing.js` is what makes that
structural rather than a good intention. The host is on PayPal at 2.9% and
expects to move to Stripe, so the split is: an adapter translates a processor's
webhooks into **five events** (started, renewed, payment_failed, cancelled,
expired) and knows nothing about accounts; `billing.js` applies those to an
account and knows nothing about the processor. **There is a test that greps the
code for the word "paypal" and fails if it appears outside an adapter.**

Four properties, all tested, and each is there for a reason:

- **A webhook may only ever move a SUBSCRIPTION** — a tier, a status, and an
  opaque reference. Never `comped`, a role, `packs`, an email or a password.
  That endpoint is reachable by anybody who finds the URL and a signature check
  is all that stands in front of it, so a bug there must cost a wrong tier and
  never an account. `accounts.setBilling()` is its own method for the same
  reason `setPrefs()` is.
- **A failed payment moves the STATUS and never the tier** — the lapsed-
  subscription rule, applied. Demoting somebody because a card expired on a
  Tuesday would take their packs away mid-week.
- **An older event can never roll a subscription backwards.** Retries and
  out-of-order delivery are normal; a stale "cancelled" arriving after a fresh
  "started" would close an account that has just been paid for. Same lesson as
  the invoice counter.
- **Nothing throws.** A webhook endpoint that 500s makes the processor retry
  the same bad payload for hours, so a malformed event is reported and answered
  200 — "received and ignored" is the honest reply.

Card details must never reach this server. **The PayPal adapter itself is not
written**: `developer.paypal.com` is blocked by the environment's egress policy
and a payments integration must not be written from memory — see TODO.md.

**A subscriber's own quizzes are private, including from the owner.** Support
access is a switch THEY turn on, it expires, and what was done while inside is
logged for them to read. Other quiz hosts will ask; "only when you let me in,
and here is the log" is a better answer than a promise.

**Round 2 artwork is generated, and that is now a legal decision as well as a
budget one.** UK fair dealing is a closed list and does not cover commercial
entertainment, so a press photo in a pack you SELL is distribution at scale
with your name on it. The on-screen caption "AI-generated illustration — not a
real photograph" is doing legal work; do not quietly drop it. Bigger exposure
still is the music: a venue's PRS/PPL covers a room, and covers nothing online.

And the number that decides the pricing: **sending the host's picture costs
about twenty times what sending their voice costs**. Four 100-person video
nights a month is more egress than a £9.99 subscription covers; audio-first is
under a pound. So audio is the product and video is a small tile — a design
decision that is also the business model. The sums are in TODO.md.

**Karaoke is a wanted direction, and the licensing answer is already settled.**
He asked whether the app could add karaoke tracks once he has a music licence,
streamed for a fee or downloaded in bulk. The conclusion, written up properly in
TODO.md direction 2: **build the show, never the songs.**

TheMusicLicence (PRS/PPL) covers *public performance on premises*. It says
nothing about distributing tracks to other quizmasters — that is reproduction
and making-available, a different right and a different bill. And a karaoke
track is three licensed things stacked up, not one: the backing track is a NEW
recording needing a mechanical licence, **the on-screen lyrics are a separate
reproduction right controlled by the publisher**, and then the performance. That
third layer is the one people miss and it is why the catalogues are licensing
businesses.

So the buildable version is **exactly the shape music bingo already has**: the
host plays the track from KaraFun on their own laptop, and the app is the queue,
the singer rotation, the "Now singing / Up next" projector card and — the part
that makes it a product rather than a karaoke box — the room voting for a
winner. No audio ever touches this server, which also keeps it off pub wifi,
where a stalled backing track in front of a singer is worse than a slow
question.

If tracks ever do belong in the product, the route is a **B2B deal with a
catalogue that already holds the rights** (he is already a KaraFun customer), not
licensing songs directly. The runner above is what a catalogue would bolt onto,
so it is not wasted either way. **Do not propose hosting or streaming the audio.**

Deliberately not built: **venue branding** beyond `BRAND_NAME`, and
**Instagram follow-for-points** (no API can verify a follow — he agreed to drop
it rather than fake it).

---

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
