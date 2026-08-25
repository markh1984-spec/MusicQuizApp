# The launch bar — Tonight, the running order, and what happens in the gaps

The half of `docs/console.md` that is about ONE panel: the bar a quizmaster
drives ten minutes before a gig. Split off on 23 August 2026 when that file
crossed the 100,000-byte cap in `test/docs-index.test.js`.

**Split by SUBJECT, because there is an honest one here.** `docs/console.md`
is about the console as a place — how it was split into modules, its theme,
its doors, its tabs, how a tab is drawn. Everything below is about the launch
bar: what goes in it, what it sends, and every fault live verification found
while building it. That is the panel this project calls the protected surface,
so it is also the one somebody opens most often with a specific question.

**Moved WHOLE and by line number, nothing retyped** — the mechanical
transform, for the reason `CLAUDE.md` gives: a script cannot quietly reword a
decision on the way through.

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

## THE BAND ABOVE LAUNCH IS KEPT CLEAR, and one row holds the night

Reported on 23 August 2026, in two messages a few minutes apart: *"the doors
button and the 'on the big screen now' and unlaunch buttons can all go right
at the top to save space… can we also standardise the buttons to look the
same"*, then, looking at what was left, *"either way that space between packs
and launch button needs to be clear, space is at a premium."*

### The head became the night's own row

It already held where the night is, whether it is in a room or online, and
whether the panel is open. It now also holds whether to keep the night, what
is on the projector right now, and what the phones get before it starts —
which is every question that is true of the EVENING rather than of a pack.

The live line cost a whole row of its own for one short sentence and one small
button, on a bar with nothing to spare.

**Doors going up is the coherent split, not merely the tidier one.**
`p0:lobby` is the gap BEFORE the night starts, so it is a fact about the
evening like the venue beside it. Every other break — including a later part's
own lobby, *"Before the bingo"* — happens INSIDE the running order and belongs
beside the order it happens in. The SETTER still opens down in the strip
wherever the chip was tapped, so a break is edited in one place rather than
two.

The head also stopped being a grid. It was three explicitly-placed cells; at
six items of wildly different widths — a pub name, a five-word button, a
sentence, a chip and two pills — every breakpoint wanted its own placement, and
the last thing added auto-placed into an empty cell and came out in the wrong
order. A wrapping flex row puts them in DOM order at every width, with one
`margin-left: auto` pushing the pills to the end.

### Standardising the buttons

Measured before the change, the head held four different heights: 36px for the
mode switch, 38px for Save and Unlaunch, 44px for the fold, and a chip of its
own size again. Six controls, four heights, no two edges lining up.

**44px because that is the FLOOR, not because it is the biggest.** A
touch-target audit had already forced the fold up to it and left everything
beside it underneath; levelling down would have taken the one control that
passed and broken it.

**The shapes still differ, deliberately.** The radius rule is a field, a card
or a pill, and it encodes what a control IS: Save, Unlaunch and Doors are
actions and stay fields; the venue is a dropdown; the mode switch and the fold
are pills. Standardising the SIZE is what was asked for — flattening the roles
would undo the system the GUI rules are built on.

Three controls also had bespoke faces that simply had no reason to exist:
`.lb-unlaunch` carried `padding: 2px 10px; font-size: 0.8em`, which gave the
row a third text size nobody chose; `.brk-done` was a hand-rolled copy of
`.minor`; and the break chips were invented in isolation and looked it. All
three now take the console's own button face.

**And a destructive button in the console had silently lost its edge.** The
one global rule — the one whose own comment says *"it was written out four
times in four places and had already drifted; this is the one rule"* — sets
`border: 1px solid …`, a SHORTHAND, which overwrites all four sides. So
`.console button.minor.danger`'s 2px bottom became 1px and its top-lit face
was blanked, leaving Unlaunch and Delete structurally different objects from
Save and Rename beside them. **That is the shorthand-beats-longhand trap this
repo already records about the pack tile's border, hit again inside the rule
that calls itself the one rule.** CLAUDE.md settles which way to fix it:
*"Destructive keeps RED on its edge in every scheme, like everywhere else."*
An edge, not a different shape. Outlined-never-filled is about FILL and is
untouched.

### Nothing between the running order and Launch

Three things were in that band and all three had somewhere better to be.

**The break strip moved above the tiles.** It describes the gaps between them
either way, and above it does not stand between the order and the one filled
gradient on the panel.

**The pack settings row now only exists when it holds a control.** It stood
down only when the bay was empty, so every quiz night carried a labelled row
directly above Launch containing one caption and nothing else: *"1980s Pop —
rounds are the dots on the pack"* — a sentence explaining a control already
visible on the tile. This does not contradict *"a control is present and
inert, never absent"*: that rule is about a control coming and going as you
work, so you cannot learn where it is, and Card and Prizes already do not
exist for a quiz pack — settled earlier in the host's own words, *"if they
can't function on the bench they should be removed"*. What is hidden here is
an empty box, not a control.

**The four-fact info line went, and the host's question about it was right.**
*"This is all venue settings stuff that can be done in the workshop?"* Three
quarters of it, yes: the venue NAME duplicated the picker two controls away —
and this bar had already lost a second venue CONTROL for that same reason;
*one-off / your usual night* is `usualNight` on the venue record; and *start
when you like* is the app reporting that a diary field is blank, which is a
sentence about nothing. None of the three changes what launches, and all three
are edited elsewhere.

**The prizes were the honest exception.** They are read at LAUNCH into the game
state and printed on the winner's voucher, which somebody carries to a bar —
so this was the last moment before the night starts that a wrong one could be
caught, and being wrong costs a real person a drink in front of the room.

But space is at a premium, and **a night whose prizes are right gains nothing
from being told so**. So the positive case is silent — the same rule the
come-back slide already follows — and only the case worth interrupting for
survives: a venue picked with no prize on it, said in the head, on a line of
its own so it never shoves the mode switch and the fold in front of it. A
warning should be the thing that moves, not the controls whose position people
learn.

## THE BAR'S OWN TIDY-UP — and a drag with no tap is a broken control

Reported on 23 August 2026 off a screenshot of the bar with a game running and
an empty bay: *"starting to look a bit messy — can we utilise space where
possible."* Four of the five items were placement; the fifth was a real bug
that had been sitting there since the round drag was built.

### A control sits with the thing it acts on

*Stop* sat at the far right of a 1900px bar. The sentence it belonged to — *"On
the big screen now: The 2000s Metal Quiz"* — was at the far left, an inch of
empty space away, because `.lb-live-row` was `justify-content: space-between`
and the row is as wide as the panel. At that distance it stops reading as a
control over one game and starts reading as a control over the whole section,
which is the one thing it must not be mistaken for on a gig night.

It is **Unlaunch** now, and it hugs the sentence. The word was chosen so it
pairs with the button underneath it without anybody having to be told: Launch
put it up, Unlaunch takes it down.

### Keeping a night is a night-level question

*Save for another night* was floating between the tiles and Launch, in the one
strip of the bar that answered no question at all, with a note beside it nobody
could parse. It moved into the head, which is where the other three
night-level questions already live: where it is, whether it is in a room or
online, and whether the panel is open.

**The label has to outrank the adjacency, and that is the interesting part.**
A show deliberately never keeps the venue — *"there's no way you'd want to run
the same quiz at the same venue again"* — so a button reading just "Save" sat
immediately beside a venue picker would state the opposite of what it does.
The words stay *"for another night"*, which is the fact that matters, and the
tooltip carries the rest.

It also went in WRONG the first time, in a way worth recording: the head's
columns are placed explicitly (there is a note there saying why), and they were
pinned around an `h3` that no longer exists — so the new child auto-placed into
the empty first cell and rendered to the LEFT of the venue. Adjacent, but in
the wrong order; the venue is the identity of the night and reads first.

### The reason a control is off goes on the control

*"Nothing in Tonight to keep yet"* was reported directly: *"not sure what that
means."* Two faults in one line. It named "Tonight" as though that were a place
you might have put something, and it described a condition rather than telling
anybody what to do about it — a sentence about the app's own state, floating
next to a greyed-out button.

The button now says **"Add a pack to save this night"** when it is disabled,
which is exactly the shape Launch already uses ("Drag a pack in to launch"):
one control, one sentence, no second line to read.

### A bigger target is not the same as a hittable one

*"The packs need a larger clickable x to get rid of them from the grid."* True
— it was a 4px-padded glyph, about 18px square, invisible until hovered, on a
control used in a dark pub with a thumb. It is 30px now, a quiet disc that only
turns red under the cursor (a filled red × on every tile is the "wall of red"
the GUI rules already turn down).

**And growing it broke it.** `.lb-tile-head` carries `position: relative;
z-index: 1` and comes later in the DOM, so the pack NAME painted over the
button and swallowed every click aimed at its lower half. Nothing throws, the
button is plainly visible, and about half of it does nothing. It was caught by
a click reporting *"<b class=lb-tile-name> intercepts pointer events"*, which
is the only way this ever shows up. The fix is `z-index` on the button AND
`padding-right` on the title, so the two do not overlap in the first place.

### EVERY DRAG NEEDS ITS TAP — and a shelf round dot never had one

*"The drag and drop feature per round doesn't seem to be functional yet?"*

**The drag was fine.** It was verified end to end with real mouse events — press
on a round dot on a shelf card, twelve moves, release over slot one, and the
round lands in Tonight as its own tile. What was missing is the thing anybody
tries FIRST: the dot carried `mousedown`, `dragstart` and `dragend` and **no
`click` handler at all**. Tapping one produced silence, and nothing on screen
said why.

On a touchscreen it was worse than silent — it was impossible. **HTML5 drag
events do not fire on touch at all**, which this repo already knows and already
has a rule about: *"the taps and the arrow buttons STAY — drag is the fast way
and every drag has a way round it."* Every other drag on this page has its tap.
This one control was built without one, and the gap was invisible because the
mechanism it was missing is the one nobody thinks to test.

`addRoundToTonight()` is that tap, and it goes through the same
`addRoundToNight()` the drop uses, so a tap and a drag cannot come to mean
different things. It rides on `roundWanted`, the round-sized twin of
`packWanted`, for the same reason that exists: the click happens in
`console-packs.js`, which cannot reach into `launchBar()`'s closure.

**The general lesson is bigger than this control: a feature reported as "not
working" may be working exactly as built and missing its most obvious entry
point.** Testing the mechanism proves nothing about whether anybody can reach
it — the same sentence this repo already has written down about the arcade
board that was computed and never drawn.

### Five settings, one row, labels above

`auto-fit` with a 240px floor gave four columns, and "While they wait" spanned
two of them — so the five night settings landed as three plus two with a third
of the second row empty. Above 1150px there is room for five side by side.

Two details, both found by measuring rather than by looking:

- **`.lb-set .pack-shape-wide { grid-column: span 2 }` sits fourteen lines
  further down the sheet at the identical specificity**, so a single-class
  override loses on source order alone and the span survives — which put
  "Playing" on a row of its own with four empty cells beside it, and nothing
  thrown. Same shape of trap as the pack tile's `border` shorthand. The fix is
  to out-specify it rather than depend on which line came last.
- **The labels go ABOVE their controls in that row.** Side by side at a fifth
  of the bar, "Seconds per question" wrapped to two lines and "While they
  wait" to three while "Look" and "On" sat on one — five cells of five
  different shapes, which was most of what read as mess. Stacked, every cell
  is the same two lines and the controls line up along one edge.

## A DROPDOWN IS NARROW SHUT AND WIDE OPEN — `console-pick.js`

Asked for on 23 August 2026, as five separate space savings on one bar:

> *"'add a pack…' is now just 'save' / the venue dropdown box and all dropdown
> boxes on the bay must popover / 'while they wait' can be changed to 'game'
> and the explainer can go, just have 'Maze Mouth' and a symbol to show what it
> is / 'look — the usual' needs to only be as wide as the pre-filled value,
> popovers can pop out wider but we need to save space, same with the others /
> Seconds per question can be abbreviated to 'secs per Q' and made narrower."*

Four of the five are wording and widths. The middle one is a component, and it
is the only reason the other four are possible.

### A NATIVE `<select>` CANNOT BE NARROW AND WIDE AT THE SAME TIME

That is the whole problem in one line. A browser sizes the open list to the
CONTROL, so a select narrow enough to say "The usual" opens a list that clips
"Halloween — in season now". The bar was therefore paying for its longest
option on all five pickers, on every night, whether or not anybody ever opened
one — five controls at 215px each where the values in them are 66px to 142px.

Measured after: `The usual` 109px, `👻 Maze Mouth` 142px, `On` 66px,
`Individual` 109px. The game menu opens at 265px over a 142px face, which is
the feature working — nearly twice its own width, and the explainer the host
asked to delete is still there, just only while you are choosing.

### THE NATIVE SELECT STAYS IN THE DOM AND STAYS THE TRUTH

`console-pick.js` draws a button and a floating menu BESIDE the real select and
does nothing else. Every `.value` read, every `innerHTML = options(…)` rebuild
and every `change` listener in the console goes on working untouched, and the
launch reads exactly what it always read.

**That is a decision about the protected surface rather than a shortcut.** This
bar is the path from "the room is sitting down" to "the quiz is running", and
five of the fields the launch payload is built from live on it. Replacing them
with a hand-written component would put every one of those reads at risk for
what is, in the end, a layout change. **A skin over the real control cannot
lose a value, because it never holds one.**

Three consequences, each of which is a line of code that looks optional and is
not:

- **Setting `.value` from script fires nothing**, so choosing an option has to
  `dispatchEvent(new Event('change', { bubbles: true }))` by hand. Without it
  the picker would look like it worked and the launch would send the value from
  before — the worst available failure, because it is silent and it is on the
  launch.
- **The face has to be repainted when the select changes underneath it.**
  `paintSettings()` sets `.value` and rebuilds `.innerHTML` directly in several
  places and neither fires an event, so `refreshPicks(el)` is called at the end
  of it — the one seam every one of those writes already passes through.
- **One document-level listener for closing, not one per picker.** The bar is
  rebuilt on every state push, which during a lobby is every time somebody
  joins; a listener added per picker per render is a leak that grows with the
  room.

### THE FACE SHOWS THE SHORT NAME, THE MENU SHOWS THE WHOLE THING

`data-short` on an `<option>`. Without one the face uses the option's own text,
so nothing has to be annotated unless it wants to be.

That split is what buys the space, and it is also what let the host's third
request be granted without losing anything: **"Maze Mouth" shut, "👻 Maze Mouth
— a maze chase" open.** The explainer he asked to delete is not deleted — it
moved to the moment you are actually choosing, which is the only moment it was
ever any use.

**The symbol lives on the game, in `lobby-games.js`** — 👻 🏓 🐍 🤠 — beside the
name rather than instead of it. An icon alone is a rebus; an icon in front of a
name is something you find again next week without reading.

### WHICH WAY IT OPENS IS MEASURED, NOT ASSUMED

The rightmost picker on the bar sits a few pixels from the edge of the panel,
and a menu WIDER than its button — which is the entire point of this — would
otherwise hang off the side of the console. So the menu is shown, measured, and
flipped to `.to-left` if its right edge is past the viewport.

Measured at open rather than at build, because the bar's width changes with the
window and with how much is in it, and a class decided once would be wrong the
first time anybody resized anything.

### THE VENUE SHEET FLOATS, AND THAT NEEDED TWO FIXES NOTHING WOULD HAVE THROWN

The venue picker was already a bespoke sheet rather than a select, so it did
not need the component — it needed to stop pushing the bar around. Moving it
inside `.lb-what` and making it `position: absolute` did that: the bar is 348px
tall open and 348px tall shut.

Both faults it caused were structural and silent:

- **The move left `.lb-what` unclosed and an orphan `</div>` behind.** The head
  row collapsed and the venue button, Save and the mode switch drew on top of
  one another. `node --check` is perfectly happy — a template literal holding
  broken HTML is a good string, and the browser silently re-nests whatever it
  is given. Diagnosed by asking the head row what its CHILDREN were, which
  listed things that should have been its siblings.
- **A floating sheet swallows clicks on whatever is now underneath it.**
  Playwright named it exactly: *"`<button class="lb-venue-hit">The Crown</button>`
  … intercepts pointer events"*. It needed an outside-click close and an
  Escape, which a sheet that pushed the page down had never wanted.

`test/markup-balance.test.js` is the first of those with an assertion on it: it
counts `<div>` against `</div>` in the `launchBar()` template alone. **A
whole-file sweep was tried first and turned down** — this app builds markup out
of concatenated fragments, so `console-venues.js` comes out nine divs short and
is completely correct. A test that needs a growing list of exceptions has
stopped being a test.

It is the markup's half of what `test/style-structure.test.js` does for braces,
written on the same day for the same reason: two structural faults an hour
apart, both from an edit taking one delimiter too many or too few, and neither
one a syntax error in anything.

### WHAT WAS PROVED, RATHER THAN LOOKED AT

A launch made entirely through the new pickers — every value chosen by clicking
a popover, nothing set by script — sent
`lobbyGame=rally lobbySound=false teamMode=random teamPlay=true seconds=35`.
That is the only check that matters here: the component is a skin, and the
question is whether the thing underneath still says what you told it.

## THE GAPS ARE A DIAL ON THE PACK, NOT A STRIP UNDER IT

Reported the day after the break strip shipped, off a screenshot:

> *"'doors' and 'after round 1' both fill the same function, don't really need
> both — and the after round 1 needs to perhaps be a little dropdown on a per
> slot basis, as it's defining what happens at the end of that slot?"*

Then, when the options were rendered:

> *"It could just be a symbol you click to cycle through an internal menu? So
> for e.g. there's a photo symbol and you click and it becomes a maze mouth
> symbol and you click again and it shows an infinity symbol (they get every
> option) etc., and this would live in the bottom right of the pack ONCE
> LOADED."*

### The duplication was real, and it was the label collision this repo already hunts

Doors sat in the head and every other gap sat in a strip under the running
order — drawn by the SAME `chip()` from the SAME plan, opening the SAME setter.
One control, two places, and neither of them beside the thing it acted on. That
is precisely what Sweep mode is told to look for and what nothing had caught,
because no test, no 500 and no visual defect will ever show it.

### "At the end of that slot" is the right instinct with one correction

**A gap is not at the end of a slot.** A two-round quiz owns the gap INSIDE it
— after round one — as well as the one at its end, so a control meaning "the
end of this slot" can only ever address the last gap a pack has. What a tile's
corner CAN honestly own is *every gap this pack creates*, and that is what it
owns.

The consequence is stated rather than hidden: **one dial sets all of that
pack's gaps at once.** Wanting photos after round one and a game after round
two of the same quiz is not a thing anybody has asked for, and if it ever is,
the plan underneath is still per-break and can grow a second control.

### THE SHAPE CAME FROM MEASURING THE TILE, NOT FROM PICKING A DRAWING

Before a line was written: a tile is **179 x 76**, its round ticks are **22px**
along the bottom-left, and a four-round pack leaves exactly **58px** clear in
the bottom-right corner.

That is **one 44px control** — the touch floor every other control on this bar
is already held to — and it is **never two**, at any spacing. Everything else
follows from that number:

- **The dial is the PHONES**, because what a phone offers genuinely differs
  pack by pack: a game before the bingo, photos between quiz rounds.
- **The big screen became a night-level picker** in the settings row, because
  it is the half that is a fact about the EVENING — *"show my adverts in the
  breaks"* is the venue paying for a screen — where "photos or the game"
  changes between a quiz and a bingo.
- **The plan on disk did not change at all.** The picker writes the same
  `screen` value to every gap that has one; `break-parts.js`, the engine and
  the projector are untouched, and `pub-unchanged.mjs` still says IDENTICAL.

### A dial is safe here in a way cycling controls usually are not

Cycling is normally a poor control: you cannot jump to a value and you cannot
see what else there is. Two things make it right in this corner:

- **Every state is a real answer.** There is no invalid position to land on
  while spinning past it, so the worst a mis-tap costs is one more tap.
- **The order is a scale, not an enum.** Photos, then the game, then both, then
  nothing — each step gives the phones MORE than the last until the last one
  takes it all away. A dial whose steps are not on a scale has to be memorised;
  this one can be reasoned about after one press.

**The lit edge had to be made honest to go with it.** A dial cycled all the way
back to its default was still wearing the "you changed this" edge, because the
plan held an entry that merely restated a default. `cleanPlan()` — which the
server already ran on the way in — now runs on the way out of the dial too, so
the plan stays genuinely sparse and the edge means what it says.

### Doors keeps a dial because it is the one gap with no tile

It happens before the first pack rather than after anything, so it stays in the
head — but as the same control, with the word *Doors* beside it, since every
other dial is sitting on the pack that says which gap it means. The lobby has
no big-screen choice at all (the join code owns that screen and nothing may dim
it), so a phone-only dial is the WHOLE setting there rather than half of one —
the neatest fit of any gap in a night.

### What it cost and what it bought

The strip, `chip()`, the setter panel and `doorsChip()` are all deleted:
`console-breaks.js` went from 234 lines to 195. The bar is **59px shorter** on
every night, and there is no longer a row of five near-identical chips saying
"everything is normal".

### AND THE ERA WORD MOVED, WHICH IS A COLLISION BETWEEN TWO DELIBERATE RULES

*A pack wears its own subject* puts the decade or genre in the tile's
bottom-right on purpose — *"the Tonight tile keeps the corner"*. That is now
the corner a control lives in.

**The control wins and the decoration moves 52px left.** The word is a wash
saying which era a pack is; the dial is something you press in a dark pub. It
is shifted rather than dropped, because a tile with no subject on it is exactly
what that rule exists to prevent.

### A LOST `import` DREW A BAR WITH NO DIALS ON IT, AND EVERY CHECK PASSED

Rewriting the header comment of `console-breaks.js` with a script replaced
everything above the first `import` — and the first import was
`import { esc, node } from './client.js';`.

The file still parsed. `node --check` was happy. The full suite stayed green.
The console drew a launch bar with **no gap dials at all**: four
`ReferenceError: node is not defined`, swallowed by the paint, with nothing on
screen to say a control was missing.

**That is the same fault that shipped a broken Launch to the live app** — a
function called and never imported is a ReferenceError when the line RUNS, so
every static check in this repo waves it through. The difference was only how
loud it was.

`test/imports-present.test.js` closes it: every browser module that CALLS one
of the shared helpers must import or declare it. It checks a named list rather
than trying to be a linter, for the reason `markup-balance.test.js` reached
about counting tags — a short check that never lies beats a clever one that
needs an exceptions file. Verified by deleting the import again and watching
`node --check` pass while the test failed.

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

---

## THE TILE'S OWN TIDY-UP — three collisions, all measured

Reported off a screenshot on 24 August 2026: *"we're getting there - think the
top left numbers can go once there's a pack in the slot and there's a slight
overlap with the cross and the game selector"*, then three more in the same
sitting. Every one was measured before it was changed, and one of them was a
fault nobody had reported.

### The slot number goes when a pack lands in it

Measured: the badge overlapped the pack's own title by **18 x 8px**, so a long
name read as "22000s Pop, R&B and Chart".

He is right beyond the collision. On an EMPTY slot the number is the whole
label — *"Add pack 3"* is what tells you where a dragged card would land. On a
full one the order is already visible from where the tile IS, so the badge was
telling you something the position had said, on top of the one thing you
actually read.

### The tile is 90px because 30 + 44 does not fit in 76

Measured: the × overlapped the gap dial by **28 x 12px**. The × is 30px at the
top right, the dial is 44px at the bottom right, and 74px of controls plus
their padding does not fit in 76.

Three ways out, and this is the least surprising:

- **Move the × to the top left** — puts "remove this" where the eye lands
  first, and the top left is where the drag grip already is.
- **Move the dial off the bottom right** — undoes the thing that was asked for.
- **Make the tile tall enough to hold what is on it** — nothing moves, so
  nothing anybody has learned changes position.

The row is one line, and deleting the break strip an hour earlier gave 59px
back. On a PHONE the same applies to a tile holding a pack, while an empty slot
stays short: a slot with a number and a plus on it has no controls to fit, and
giving them one height would spend a third of a phone screen on empty slots.

### A tile is not a part — and half the row had no dial

Not reported, found while measuring. Several quiz packs are welded into ONE
quiz by `composeQuiz()`, so a two-pack night has one part — which meant tile
1's dial silently owned every gap in the evening, including the ones pack 2's
rounds create, and **tile 2 had no dial at all**. Nothing threw and nothing
looked broken; the second tile just had an empty corner.

`gapsOfPack()` reads the part's `order` instead: the gap `p{n}:r{i}` is the
board after round `i`, so it belongs to whichever pack contributed that round.
That is exactly the promise the dial makes, and it holds however the night is
built — a composed quiz, a mixed row, or a saved show.

### The era word has nowhere left to go on a tile

*A pack wears its own subject* put the decade in the tile's bottom-right on
purpose, and that was written when the corner was empty. Shifting it 52px left
of the dial was tried first and measured: on a 166px tile it then overlapped
the round ticks by **52 x 18px**. It had moved out of one collision into
another, and there is no third place — the top is the title and the ×, the
bottom left is the ticks, the bottom right is the dial.

So the decoration goes, on TONIGHT TILES ONLY. It costs less than it sounds:
the wash across the whole tile and the coloured bottom edge still say what the
pack is, and the word stays on the shelf CARD where the corner is free and
where you are scanning nine of them at once.

The ticks also needed **40px** of clearance rather than 46 — measured, because
at 46 a four-round pack on a 166px tile had 98px for 100px of ticks and wrapped
its fourth onto a second row, making that one tile taller than the rest of the
running order.

### `:has()` OUT-SPECIFIED THE PHONE LAYOUT

`.lb-tiles:has(.lb-doors-slot)` is a class more specific than `.lb-tiles`, so
the seven-column rule beat the 560px two-column rule from outside the media
query. Measured at 390: two packs and the doors came out as **four ~50px
columns**, the round ticks stacked one per row, and the gap dial was wider than
the tile holding it.

This is the specificity trap this repo already records — a `border` shorthand
beating a `border-bottom` longhand on the pack tile — wearing `:has()` this
time. **Nothing throws; the phone simply gets the laptop's grid.** On a phone
the doors now take a full-width row of their own, which is the better shape
anyway: they are the first thing in the evening, and a row says that more
clearly than a squeezed column.

## THE DOORS ARE A MINI SLOT AT THE HEAD OF THE ROW

Asked for directly: *"we might need a little mini pack slot at the start of the
packs to define what shows on big and phone screens pre-launch."*

**It is the same argument every other dial already won.** A gap is drawn on the
thing it follows — and the doors follow nothing, they come BEFORE the first
pack. So the honest place is position zero of the running order, which is
exactly where they happen. Up in the head they were a control about the evening
sitting in a row of controls about the app.

Half width, no number, and **not a drop target**: nothing is dragged in and
nothing is taken out, so it can never be mistaken for a slot with a pack
missing out of it.

**THE BIG SCREEN IS DELIBERATELY NOT OFFERED THERE, and that half of the
request is not built.** The lobby's projector is the join code, and nothing in
this app may dim it — the same rule that keeps a big photo beside the code
rather than over it, and the code off a question. Giving the doors a screen
setting means first deciding what an advert does BESIDE a join code, which is a
change to the protected surface rather than a control to add. Worth doing
deliberately, with the projector in front of you.

## THE BINGO ROW LEFT THE BAND ABOVE LAUNCH

Reported: *"music bingo breaks the rule of having nothing between launch button
and packs - can these options go elsewhere"*. It did break it — a bingo night
put a labelled strip of two dropdowns in the one band that is meant to stay
clear.

**Above the running order, not floating under its own tile — and that is a
safety decision rather than a tidiness one.** A sheet hanging off the bingo
tile reads better and would cover the LAUNCH BUTTON, which is the one control
on this panel that must never have anything over it. The break strip moved
above the tiles for exactly this reason and the precedent was already recorded.

### And it is present and greyed, never absent

Asked for in the same sitting: *"maybe just have a section for it pre-loaded and
greyed out until a music bingo pack is added? same with the current quiz
options?"*

**This reverses a decision made days earlier, and he is right to reverse it.**
The row used to hide whenever a bingo pack was not picked, and the note here
argued that was fine because "what is hidden is an empty box, not a control".
That does not survive contact with this app's own rule: a control that comes
and goes is one you cannot learn the position of, and this bar is driven with a
thumb in a dark pub. Launch and *Keep this as a show* were both fixed the same
way, on the same panel, for the same reason.

What made hiding it tempting was WHERE it was. That is solved by the move, so
the reason to hide it has gone and the rule simply applies.

**The caption carries the reason it is off** — *"Add a bingo game to set its
card and prizes"* — the shape Launch already uses, because a greyed control
beside a blank label is a control with no explanation. And the two pickers get
a `—` placeholder, because an EMPTY select renders as a stub the width of its
own caret, which reads as a control that failed to load rather than one that is
waiting.

**The quiz half, said plainly: a quiz pack has no pack-level settings today.**
Its rounds are the ticks on its own tile and everything else about the night is
the row above. So "the same for the quiz options" lands as: the row is always
there, always says Card and Prizes, and tells you what it is waiting for rather
than vanishing. A quiz-specific setting, if one is ever added, has a row to go
in.

## THREE MORE OFF THE SAME BAR — a lie, a dot, and a dot that was a button

### "Added a bingo game and the bingo section is greyed out"

A real bug, and the worst kind: **the app was telling him to add a thing that
was already on the screen.** The Card and Prizes row keyed off which tile was
PICKED, and the picked tile was the quiz beside the bingo pack, so the row read
*"Add a bingo game to set its card and prizes"* with a bingo game two inches to
the left.

`bingoToSet()` is the fix: the picked pack when that IS a bingo — which is how
a night with two bingo games says which one it means — and otherwise the first
bingo pack in the running order. The row names the pack it is setting, so
there is nothing to guess either way, and it is greyed only when there
genuinely is no bingo game in Tonight at all.

**The three WRITES had to move with the read**, and that is the part worth
remembering: the shape handler, the prize handler and the prize repaint were
all still asking `pickedPack()`. Left alone they would have been the worse half
of the same bug — the row showing one pack's card and quietly saving it onto
another, or onto nothing, on the path Launch reads.

### "What does this mean? the . ?"

The gap dial's fourth state — nothing on the phones — was a `·`.

That question IS the answer. This project's first rule is that a control which
needs explaining is wrong, and a dot needed explaining. The other three states
are PICTURES of what the phones get: a camera, a joystick, both. "Nothing" had
no picture, so it got punctuation — and punctuation on a button reads as a
control that failed to load rather than as a state somebody chose.

📵 is the one symbol that says "nothing on the phones" without a caption.

### The round ticks were dots that did not look like buttons

*"Can you change the green ticks on the packs to be square shaped with round
edges, perhaps stacked on top of one another, and I need to see when mousing
over them as well so it's easier to click on/off and also drag the individual
elements."*

- **Rounded squares, at 28px rather than 22.** Two reasons pulling the same
  way: bigger is easier to hit, and `--r-field` only READS as a rounded square
  on a box big enough to have sides — at 22px a 10px radius is very nearly the
  circle being moved away from.
- **The hover was `filter: brightness(1.25)`**, which on a faint 22px dot is a
  change you cannot find with a mouse. It now lifts 2px, takes a ring in the
  account's own colour and casts a shadow, so the one under the cursor is
  unmistakable in a row of five. A lift and a shadow rather than a size change,
  because growing a control on hover moves the ones beside it and makes a row
  squirm under the pointer.
- **Both renderers got it**, `.lb-rd` on an ordinary tile and `.mix-rd` in the
  mixed row — the same idea drawn in two places, and a pill in one and a square
  in the other is exactly the drift the GUI rules exist to stop. In the mixed
  row the lift does double duty, because those genuinely drag.
- **"Stacked" arrives on its own for a pack that needs it.** At 28px a
  four-round pack wraps to two rows, and that is fine rather than a compromise:
  the grid stretches every tile to the tallest, so no one tile ends up out of
  line with the rest of the running order. A forced column for every pack would
  cost the row ~40px of height on nights that do not need it.

## ONE ROW FOR EVERY NIGHT SETTING — and a box is never narrower than its heading

*"Can we have all of these on the same lines, and also line up the headings
with the boxes — it's ok for the boxes to be wider than the headings but when
the headings are wider than the boxes it looks messy."*

Two asks, and the second is a rule worth keeping.

### The heading rule, and why stacking alone did not deliver it

The labels already sit ABOVE their controls, which was done so that a cell
comes out as wide as the WIDER of the two rather than the sum. That half was
right. What was wrong was `justify-items: start`: the narrower of the pair then
floated at the left of the space the wider one had made, so "SECS PER Q" sat
over a two-digit box and "GAME SOUND" over "On".

`justify-items: stretch` makes the control fill the cell its label defined —
so the box is the wider of the two, every time, which is exactly the rule he
stated.

**It does not undo *narrow shut, wide open*.** The cell is still only ever as
wide as the longer of the value and the word above it, and the open menu is
still free to be wider than both. What changed is which of the two grows to
meet the other.

### Card and Prizes join the row, and the separate one goes

They had a row of their own above the running order — one row spent on two
controls that are off on most nights. They sit at the END of the shared row now,
after everything about the evening, which is the honest ordering: they are the
only PACK-specific settings on a bar of night-level ones.

**Two things had to move with them.**

- **`data-short` on both.** With the full option text on the face, Card came
  out **303px** and Prizes **219px** — that one control pushed the row onto a
  second line by itself. It reads "5×5" and "2" shut, and "5×5 — line of 5 · 25
  of 40 songs on a card" open. The rule the pickers were built for, applied to
  the widest thing on the bar.
- **The reason a control is off went INTO the control.** The caption that used
  to name the pack beside them went with the row, so the card picker reads
  *"Add a bingo game"* when there is none — the shape Launch already uses. The
  pack's name comes back into the LABEL only when a night holds more than one
  bingo game, which is the only time it disambiguates anything.

Measured at 1400 and 1280: one row, eight cells, every box at least as wide as
its own heading, no overflow. At 390 it wraps to four, which is a phone. And a
launch made through the popovers still sends `shape: {rows:3, cols:3}` and
`prizes: 1` — the skin never held the value, so shortening its face could not
change what Launch reads.


## A PICKER NEVER CHANGES SIZE, AND THE ROW NEVER WRAPS

Three asks in one sitting, off a screenshot of the settings row: *"if we can
have the drop down menus actually fill the space there instead of the arrows
appearing sort of half way that would be great"*, *"'look' needs to say
'appearance'"*, and then *"also would be good if those dropdowns don't change
size at all regardless of what's selected."*

The third one is the interesting one, because it corrects the worse half of
this bar's own oldest rule.

### The original rule was right about the MENU and wrong about the FACE

*"'Look — the usual' needs to only be as wide as the pre-filled value"* bought
a genuine saving: a native `<select>` sizes its open list to the control, so a
bar of five selects was paying for its longest option five times over on every
night whether or not anybody opened anything. Splitting the face from the menu
fixed that and still does.

**But sizing the face to the CURRENT value made the whole row a moving
target.** Choose *Halloween* and Look grew by sixty pixels; every control to
the right of it shifted. On a bar somebody drives with a thumb, in a dark pub,
ten minutes before a gig, a control that is not where it was last time is a
control you have to look for.

### The width is reserved by the OPTIONS, and the browser does the reserving

Every option's short name is drawn into the same grid cell as the chosen one
and all but that one is `visibility: hidden`. The browser then sizes the button
to the widest of them — for ever, whatever is selected.

**`visibility: hidden`, never `display: none`.** That is the whole trick: a
hidden item still takes part in sizing, a removed one does not.

It needs no font measuring, no canvas, no `ch` guessing against a proportional
face, and — the part that matters most — **nothing to keep in step**. The
options change when the picked pack changes; the ghosts are rebuilt from the
same list in the same function that paints the face, so there is no second
source of truth to go stale.

**It does not undo *narrow shut, wide open*.** The ghosts are the SHORT names,
so Game reserves "👻 Maze Mouth" and not "👻 Maze Mouth — a maze chase", which
is still the sentence only the open menu carries.

### And that made two long options expensive, so they got short names

A face that reserves its widest option pays for that option on every night of
the year. Two were not carrying their weight:

- **"Summer — in season now"** was the widest thing on the whole row. The
  suffix is a nudge to read while you are CHOOSING and it is noise on the face
  afterwards, so `data-short` is now the name alone. Eleven months of the year
  it said nothing at all and still cost 100px.
- **"Team — they pick their own"** and **"Team — dealt at random"** got
  `data-short` for the first time.

The screen picker's *"· Nothing"* became **"⬛ Nothing"** at the same time —
the same objection he had already raised about the gap dial's dot, on the
sibling control. Punctuation on a button reads as a control that failed to
load.

### `flex-shrink` alone could not keep the row on one line

With the faces reserving their widest options the row was about eighty pixels
over its width, and it wrapped. Allowing the cells to shrink did nothing, and
the reason is a flexbox rule worth remembering:

> **A wrapping flex row WRAPS FIRST and shrinks afterwards, within each line.**

So a row twenty pixels too wide drops a whole control onto a second line rather
than taking two pixels off each of eight. `flex-wrap: nowrap` above 1150px —
the width at which this row is meant to read as one row — is what lets the
shrink do its job. Below that it still wraps, because eight controls on one
line of a phone is eight controls nobody can read.

**A heading ellipsises rather than wrapping**, which needed each one lifted out
of a bare text node into its own `<span class="set-word">`: a text node cannot
carry `text-overflow`, and a heading that wraps to a second line drags the
whole row down with it. Measured with the longest bingo title in the library:
nothing clips at 1500 or 1280, and at exactly 1150 two headings ellipsise —
which is the designed give.

### And the pack is named once, not twice

"Card · Disco & Funk" beside "Prizes · Disco & Funk" was 286px of a row that
has to hold eight controls, spent saying one thing twice. They are the two
settings of ONE picked bingo game and they sit side by side, so the name on the
first says whose both are. That alone bought most of the eighty pixels back.

### The seconds arrows move by five

*"Can we make the up and down arrows on Secs per Q change it by 5 instead of
by 1."* `step="5"` on the field, and it is the difference between a control
that works and one worth using: nobody has ever wanted twenty-one seconds a
question, and twelve presses to get from 20 to 30 means the arrows are decoration
and the number gets typed instead.

`min="5"` means the steps land on 5, 10, 15, 20 — measured, along with the
clamp at both ends: 115 up gives 120 and stays there, 10 down gives 5 and stays
there.

#### And then the first press still gave 5, because the 20 is a placeholder

Reported straight back: *"that same field displays 20 but on first click it
goes to 5 — it should go to 25 on an up click and 15 on a down."* The field is
genuinely EMPTY and the 20 is its placeholder, and a browser steps an empty
number input to its `min`. Both arrows gave 5, which is the tell: nothing was
being stepped at all, it was being initialised.

**Blank is not nothing, which is why the fix is not prefilling 20.** An empty
field means *leave each quiz at its own pace* — `engine.questionSeconds()`
falls through to the pack's own number — and a bar that quietly wrote 20 over
that would be overriding a pack author's choice on every night without anybody
asking it to. (A ROUND authored with its own clock beats both either way, and
must: a longer round is a round worth more points.)

So the field seeds itself with **the number it is already showing**, at the
moment somebody deliberately reaches for it and not before — a `pointerdown`
on the control, or an arrow key while it has focus. `pointerdown` rather than
`focus` for two reasons: it lands before the browser steps the value, which
`focus` on some engines does not, and it means tabbing through the bar never
commits a number to the night.

Measured with a real mouse on the real spinner, from a fresh console showing
the placeholder: **first up click 25, second 30, first down click 15**, the
keyboard the same, focus-then-Tab leaves it empty, and clearing it back to
blank still means the pack's own pace. The launch then sends
`questionSeconds: 25`, watched on the wire.

`state.questionSeconds` had no unit test at all until this change gave the
field a reason to write one — `test/engine.test.js` now pins all three rungs
of that fallback, including that 0 means blank rather than a zero-second
question.

**Typing still takes any number in range.** A hand-typed 22 sets
`validity.stepMismatch`, which would matter if anything called
`checkValidity()` — nothing does, the field is in no `<form>`, and the value is
read straight off `.value` by the field's own `input` listener. So the arrows
are a coarse control and the keyboard is the fine one, which is the right way
round for a bar somebody drives with a thumb.

### "Appearance", not "Look"

Both name the same thing and only one of them is a noun on sight. "Look" reads
as an instruction for a moment before it reads as a label — a word doing two
jobs, on the row where clarity beats everything.

## And the drags have a page of their own

Picking a pack up, dropping it on a slot, dragging a round out of
one — and the browser's own preconditions, which is where this bar
keeps breaking — moved to **[`drag.md`](drag.md)** when this file
crossed its 100,000-byte cap. Whole sections, by line number.