# The owner page — the business, five tabs

The reasoning behind the the owner page rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## The owner page — five questions, five tabs

`/owner` was one scroll: reported questions, the suggestion box, a link, the
quizmaster list. That was the minimum it needed to exist rather than what it
should be, and four sections down one page is a page you scroll past rather
than work through.

**Split by QUESTION, not by data**, the same principle that put the catalogue
on the console and the business here:

| Tab | The question it answers |
|---|---|
| **Tonight** | can I deploy? is anybody mid-question? |
| **People** | what is going on with one subscriber? |
| **Money** | is this paying for itself? |
| **Catalogue** | is what I write worth writing? |
| **Inbox** | who is waiting to hear back from me? |

Only Inbox wears a badge, because it is the only tab where somebody is waiting.
The reports and the suggestions stay TWO panels on it — they want different
things doing about them — but "how many people am I keeping waiting" is one
number.

**The accounts-not-backed-up warning stays ABOVE the tabs.** Every password
disappearing on the next redeploy is not a fact about one tab, and a warning
you have to be on the right tab to see is one you find out about afterwards.

### Tonight wakes every room before it answers

Rooms are made lazily, so after a restart only the house room is in memory —
and "nothing is running, safe to deploy" would have been a confident lie told
at exactly the moment it matters most, because a quizmaster's phones have not
reconnected yet. So the route reads each subscriber's state file first, which
is what happens the second they do reconnect. One file read per subscriber.

Only accounts that still exist, and only ones with something saved: a closed
account must not come back as a room, and somebody who has never run a night
should not appear as idle.

**It says NOTHING about a pack somebody wrote themselves beyond that it is one
of theirs** — and the ID is masked as well as the title, which is not fussiness:
a pack id is the title slugged, so leaving it would print `robs-secret-quiz` on
the owner's page directly under a feature promising they cannot read it. Tested.

**Nothing on this page drives a game**, and deliberately: one place that moves a
quiz, and it is the control view. This is for looking before you deploy.

### Money — and the ledger that did not exist

`src/spend.js`. The rule that decides which tier a feature goes in is *anything
that costs the owner money every time it is used is not in Bronze* — and it was
being applied from memory, against a bill that arrives a month later with no
idea which pack it was for.

Every Claude call and every OpenAI picture is now written down as it happens:
what it was, which pack, how many tokens, and **what it cost in pence**.

Four things that are load-bearing:

- **It records what was SPENT, never an estimate.** The console already
  estimates before you press a button ("4 to draw — about 16p"); that is a
  warning, this is a record. Same price table so the two cannot disagree.
- **A failed call still costs.** Both suppliers bill for tokens they generated
  whether or not the reply parsed, so the row is written from the reported
  usage BEFORE the parse — which is why retries on a difficult theme show up.
  A ledger that quietly left them out would flatter every sum on the page.
- **The pence are STORED, not recomputed.** A price rise would otherwise
  silently rewrite what last year cost, and "what did I actually pay" is the
  one question this exists to answer. An unknown model is priced as the dearest
  there is, so a new model name can only ever make the sums look worse than
  they are — the other way round is a bill nobody saw coming.
- **Never fatal.** A generation that died of a bookkeeping error would be the
  tail wagging the dog: minutes and real money lost. Every write is wrapped and
  the worst case is a missing row.

Generators take an `onSpend` callback rather than the ledger itself, defaulting
to nothing — so `src/generate-*.js` never learns that a ledger exists and every
test and script that calls one carries on working. The server is the only place
the two are joined up, and it pushes the backup **once at the end of a job**
rather than per call: a quiz is twenty-odd calls and that would be twenty
commits for one press of one button.

Backed up to the PRIVATE repo, like the invoices — it is a business record.
Restored only into an empty ledger, same rule as everything else.

The tab puts monthly recurring next to it, because the comparison is the whole
point: the ladder exists to cover the second number with the first. **Nothing
on it is a forecast** — recurring is what the tiers say today's paying accounts
are worth, not annualised and not what the lapsed ones would be worth back. A
number on that page that turned out to be a projection is one nobody would
trust again.

### A ceiling for the month, which warns and never refuses

`setBudget()` / `budgetState()` in `src/spend.js`, `PUT /api/owner/budget`, and
the panel on the Money tab. One number: what a calendar month of AI is allowed
to cost.

**It is the only place both suppliers are added up.** Google's own budget alerts
see the pictures and nothing else; Anthropic's see the writing and nothing else.
Neither can tell you what a pack cost, which is the question that decides
pricing — so a budget that lives in either supplier's console is answering a
different question from the one being asked.

**NOTHING READS IT TO REFUSE ANYTHING**, and that is the design rather than an
unfinished edge. A ceiling that stopped a generation would stop it halfway,
when the money is already spent and the only thing left to lose is the pack —
the same reasoning that makes launching an expired topical pack warn and go
ahead. There is a test that the ledger carries on recording well past the
ceiling.

**No email, either.** That needs an account and costs money, and this file says
not to add one without asking. The alert is on the page.

Three smaller things, each there for a reason:

- **The warning sits ABOVE the tabs**, like the accounts-not-backed-up one.
  Being over for the month is a fact about the business rather than about the
  Money tab, and one you would find out about afterwards if you had to go
  looking. It is deliberately **not a badge**: only Inbox wears one, because
  Inbox is the only tab where somebody is waiting, and a second badge costs the
  first one its meaning.
- **A month is a LONDON month.** `monthKey()` rather than
  `toISOString().slice(0, 7)`, which is UTC — the host generates in the evening,
  so a pack written at half past midnight would land in the previous month's
  total, which is the one number the budget is compared against. Same rule and
  the same `formatToParts` approach as the invoice dates. It fixed the by-month
  report as well, which had the same fault.
- **Three states, not a sliding colour.** Fine, past 80%, and over are the only
  three things anybody acts on, and a bar that shaded gradually would want
  reading rather than glancing at. 80% is not a second setting to get wrong.

**A budget already set here beats one in a backup.** Restores only run into an
empty ledger, so in practice there is none — but "the disk is ahead of the
backup" is the rule everywhere else, and a ceiling quietly reverting to last
week's number is exactly what nobody would think to check. A ledger with no
budget on it writes byte-for-byte the file it wrote before budgets existed.

`/api/owner/` was already on `OWNER_ONLY`, so this needed no list of its own —
which is the trap that has caught six routes going the other way.

### "What the money went on" — the cut that says what to DO

`jobs` in `summary()`. Every row has carried a `what` since the ledger was
written — "checked a batch", "wrote a round", "a portrait", "read the last
month", "picked bingo tracks", "drafted a reply" — and **nothing ever showed
it**, so the only way to answer "what is the money actually going on" was to
read the file by hand. Which is exactly how the 86%-is-checking figure in this
document was arrived at.

Three cuts now, and they answer three different questions: **by pack** is which
quiz was dear, **by month** is whether it is going up, and **by job** is why.

**The SHARE is the point, not the pence.** "Checking is 72% of it" is a
sentence you can act on; "checking cost £2.70" needs the total held in your
head first. It is worked out on the server so the page cannot divide it
differently from anything else that reads the ledger.

A row with no label is filed under "something else" rather than dropped —
otherwise the shares would quietly add up to less than the total with nothing
on screen saying so. There is a test.

### The owner page redrew itself with the backup warning switched off

Found while screenshotting the budget panel. `draw()` took the backup state as
an argument, and **every redraw except the first passed `backupReady: true` as
a literal** — six call sites. So "accounts are not being backed up" appeared on
the first paint and vanished the moment you touched a tab, answered a
suggestion or added a subscriber.

That is a worse version of the fault its own comment describes: the warning was
moved above the tabs so you could not miss it by being on the wrong one, and
then it disappeared on any interaction at all. It is module state now, like the
tab and the overview, and `redraw()` takes no arguments so there is nothing to
pass wrongly.

### Catalogue — "never played by ANYBODY"

The line that could not be drawn before. A quizmaster's console says "never
played" meaning THEY have not played it, which is the right question for
deciding what to run tonight; this means nobody has, which is a fact about the
pack and is what decides whether it was worth writing. The play counts are
deliberately per room (see `library.js`), so this is the only place they are
ever added up. **Only the catalogue** — a quizmaster's own packs are not the
owner's product and there is a test that they are not counted.

### People — one subscriber, opened up

Tapping a name opens everything else about them underneath: their join code,
what they have written in, the support door and the log of what was done in
there. It was spread over three panels, so "what is going on with Rob" meant
reading the whole page and holding it in your head.

**Go in moved off the row and into the panel.** It was in both places, and the
one on the row had no log beside it — so it was the worse of two ways to do one
job, which is the mistake this file already records for the "Become a
quizmaster" panel.

**Resetting a password is its own route**, not a field on `accounts.update()`.
That method is what a payment webhook talks to, and a webhook payload that
could carry a password is a door nobody meant to leave open. The owner cannot
READ a password — only a scrypt hash is stored — so setting a new one and
saying what it is is the only help there is.

**It says nothing about their own packs, not even how many.** A count is not
content, but a page that quietly reported on somebody's private work would
undercut the promise the rest of that feature makes.

---

### The console's running panel is the way in

**Stopping and driving a game both live on that panel** — `runningPanel()` in
`console.js`. Stop calls `/api/host/resetAll`; **Take control** goes to `/host`.
The host reported having neither, twice, while both were on the panel: the
first time Stop genuinely was not built, the second time "Control view" was a
small grey link sitting between "Big screen" and "Stop", which reads as a
caption rather than as the way you run the night. It is the primary button now.
**If he says a control is missing, check what is deployed before building it
again** — and check the label says what it does.

The panel also shows where the game has got to, from `engine.where()` — "Round
Two — question 4 of 10", "Round 1 — 12 of 40 played". Both engines have one and
the server calls it defensively (`typeof … === 'function'`), so it is optional
for a new game rather than a fifth thing the contract demands.

**Navigation itself is deliberately NOT duplicated in the console.** The
control view drives the game over SSE with the engine's version; a second set
of Next/Back buttons polling the library would eventually double-advance a
room. One place that moves a quiz, one tap away.

**But a LOADED PACK IS NOT A NIGHT, and the panel used to think it was.**
`aNightIsOn()` in `console.js`, asked by the topbar and by the panel. A session
always has a pack — `boot()` falls back to one so the projector is never blank
— so the very first thing a brand new quizmaster read on their very first
sign-in was *"Now: The 1980s Pop Music Quiz (0 in)"* across the top and a panel
underneath saying **Loaded, nobody playing** with a **Stop** button, about a
quiz they had never launched. On the one page whose job is "find tonight's pack
and press Launch", the top of it was a game that did not exist.

A night is on once it is LIVE, or once anybody has joined — the same test the
launch guard uses, for the same reason (forty people who have typed a name have
something to lose). One function used in both places, because the topbar and
the panel disagreeing about whether anything is happening is worse than either
of them being wrong on its own.

### What a quizmaster's console puts FIRST

Found by walking the whole app signed in as a real Bronze subscriber rather
than reasoning about it. Three things were in the way of the common job, and
all three came from the page being laid out for the person who WRITES packs:

- **The generator slot goes below the shelf for anybody who does not write.**
  `tabBody()` asks `can(GENERATE) || can(CATALOGUE)`. For the owner the job of
  that tab is writing, so the generator belongs above the library. For a
  quizmaster the job is Launch, and everything between the tabs and the packs
  is in front of it.
- **`shopNote()` is gone.** It was a panel above the library explaining that
  packs are written for them rather than generated here — a paragraph, at the
  top of the page, saying what the app does NOT do. Its one useful claim
  ("every question read through twice") moved into the shop heading, where it
  is next to a price and is therefore doing some work. Different words on the
  bingo tab, because a bingo pack is a track list and "read through twice" is
  a promise about questions.
- **The join code is on the CONTROL VIEW.** It was on the projector behind the
  host and two taps away on My account, and nowhere on the one screen in their
  hand — so "what's the code?" from the back of the room meant turning round to
  read their own big screen. It sits next to the player count. The house room
  has no code, so Mark's own control view is unchanged.

### ONE PACK IS OPEN AT A TIME, and the rest are just names

Asked for after the first weeks of real use: *"we don't need all the options
for launch on every pack in the list — just the selected one, the rest can be
compacted into a card with their name only."* Right, and it is the third design
rule doing the work — the common job on this tab is **find tonight's pack and
press Launch**, and nine cards each carrying four dropdowns, a prize line, five
buttons and a Launch is a wall you read rather than a shelf you scan.

**The settings are per-night decisions about ONE pack**, so they belong to the
one you have chosen and nowhere else. Closed, a card is its name and one line
of what it is.

- **`openPack` is a module-level Map keyed by TAB**, outside the render, for
  the same reason the control view keeps its open answer panels there: this
  grid is rebuilt whenever anything on the page changes, and a selection stored
  inside the render would close itself the moment you touched the card you had
  just opened. Keyed by tab so a bingo pack and a quiz can each stay where you
  left them.
- **The open card SPANS THE WHOLE ROW** rather than growing inside its column.
  At 240px a row of dropdowns is a tall single file and the grid reflows around
  a card three times the height of its neighbours; full width it reads as a
  panel about the pack you picked, which is what it is.
- **It is not quite "the name only".** The size and when it was last played
  stay, in one small line, because they are what you choose BY — "never played"
  and "last played 3 days ago" is how you avoid running the same quiz at the
  same venue two weeks running, and it is the exact signal the quick-launch
  priority is built out of. Dropping them would make the grid tidier and the
  choice harder, on the tab whose job is choosing.
- **WARNINGS ALWAYS STAY, open or closed.** A broken pack, a question to fix
  and an expired topical one are read once at a moment that matters, and the
  house style makes those the exception to being short. A pack that looked fine
  closed and turned out to be broken when opened would be the app saying
  nothing again.
- **The title opens the card; Read moved into the row below.** It used to open
  the read-through, which was the only thing it could sensibly do when every
  card was already fully open. The first thing you want from a pack is "set
  tonight up and launch it", so that is what the biggest target does — and its
  hover stopped being a link, which after a click had left the heading of the
  open card sitting there blue and underlined.
- **Compact still exists and its own note was rewritten.** It said it kept
  "every control" and that the launch-time pickers stayed, which stopped being
  true the day a card only carries them when open. It tightens the grid and the
  closed cards; the open one is untouched, because that is the one you are
  working with.

### The launch bar's empty state is two packs, not an empty box

`quickPicks()` in `console.js`. A search box does nothing until you type, and
the whole point of that panel is the quizmaster who walked in with the room
already sitting down — who does not want to type, they want to see the thing
and hit it. So with the box empty it offers up to two packs ready to go, and
they disappear the moment a key is pressed, because at that point you are
browsing and they are in the way.

**A PRIORITY LIST RATHER THAN TWO FIXED SLOTS, and that is the load-bearing
bit.** The obvious design is "the latest topical one and an evergreen one" —
but topical packs are what GOLD IS, so a Bronze or Silver subscriber has none
at all and that slot would be permanently empty for most of the ladder. Filling
two slots from an order degrades on its own: Gold gets the dated one and a
fresh one, everybody else gets two fresh ones, and nobody is shown a gap where
a feature they do not hold would be.

The order, and each has a reason:

1. **The dated pack, soonest to expire** — the only thing on the shelf that is
   worth LESS tomorrow, so it is the one to spend first.
2. **The one this room is least likely to have heard** — never played first,
   then longest ago. The app cannot know which venue tonight is (a night does
   not carry one yet), so "not played recently" is the closest honest answer to
   "will not be a repeat".

**An expired topical pack is never offered here.** Running a "week that just
went past" quiz three months late is the exact hazard `freshUntil` exists to
flag, and doing it by accident on the FAST path is the worst possible way to do
it. It stays in the library, sorted to the bottom with its warning, where
launching it is a deliberate act.

**No settings on these two buttons.** Look, card shape and prizes are what the
pack card is for; a dropdown on the panic control defeats the panic control. It
launches on the pack's own defaults.

**A tab called "Quick launch" was the other idea and it is slower.** The launch
bar sits ABOVE the tab bar, so it is on screen from the moment the page loads
with no taps at all; a tab is one tap plus finding it, and the tab bar scrolls
sideways on a phone where the tabs on the end are off the right-hand edge. That
would move the fastest control in the app behind a tap.

**And the Advert button is drawn only where there are adverts.** `view.mayAdvert`
in `viewFor()`, from `can(accounts.find(room.id), FEATURES.ADVERTS)` — worked
out on the server, because a room id IS an account id and the browser should
not be told something it can be lied about. Adverts are Silver; on Bronze that
button's only outcome was a picker saying "make some on the Adverts tab" — a
tab greyed out with a `+` on it. A control that can never do anything, pointing
at a locked door.

---
