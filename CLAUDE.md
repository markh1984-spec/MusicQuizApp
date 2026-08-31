# Project notes for Claude

Read this before changing anything. It records what this is, the rules that
must not be broken, and the decisions already made — so a fresh session does
not undo work by accident or re-ask settled questions.

**Keep this file current.** When you make a decision that a future session
would need to know, add it here in the same turn.

## THE OUTSTANDING WORK IS IN `TODO.md`. READ IT FIRST.

**Only this file loads on its own, so `TODO.md` has to be opened
deliberately** — and it is the live list of what is actually left to build,
with the decisions already taken written into each entry.

So when the host names a feature and nothing else — *"headcount per venue"* —
**that is not a thin brief, it is a pointer.** Find the entry, read the
decisions recorded under it, and build what it says. Asking him to re-explain
something already written down there is the failure this arrangement exists to
prevent.

**A finished item is DELETED from `TODO.md`, never ticked.** Its reasoning
lives here instead. A build plan left behind for a thing that already exists
is a trap, and it has caught a session once: the picture-drawing step was
nearly rebuilt because the plan for it was still sitting in the list.

**`TODO.md` IS THE LIVE LIST AND THREE AREAS SIT BESIDE IT IN `todo/`** —
marketing, the gallery, the console's UI work. Each is named with one line in
`TODO.md`, so **reading `TODO.md` still tells you everything that is
outstanding**; it is 31KB rather than 124KB, and you open the one area your
job is in. That is the same rule as `docs/`, applied to the list.

**And the reasoning behind everything here is in `docs/`** — see *Where the
reasoning lives* below. Open the one you are touching; do not read them all.

**THE CONTEXT BUDGET, and it is why all of this is split.** `CLAUDE.md` loads
in full every session and `TODO.md` is opened by every session, so those two
are what a session pays before it does anything. They are held near 138KB and
40KB by `test/claude-md-budget.test.js` and `test/todo-budget.test.js` —
raise a budget deliberately, and expect the diff to say so. Everything else is
**read on demand**: open the `docs/` page you are touching, the `todo/` area
your job is in, and the console module named for the tab. **Use the agents in
`.claude/agents/` for anything that means reading widely** — `locator` to find
where something lives, `sweeper` to audit, `gig-guard` to run the checks,
`screenshotter` to measure a screen. An agent's context is not yours, so a
question answered by an agent costs a paragraph instead of a file.

---

## What this is

**The app is called Quizporium.** Live games for pub and club quiz nights, run
by a professional host (Mark). He is hired as the entertainer, never the
organiser, so it runs on his kit in someone else's venue in front of a paying
room.

**Reliability beats cleverness everywhere.** If it is flaky on a Wednesday
night with sixty people watching, it is worthless. That single sentence
decides most arguments in this codebase.

Two games so far:

- **Music quiz** — rounds of 20 seconds a question, as many questions per round
  as you ask for. Five round types: text, image, intro, **multi** ("pick them
  all") and **alphabet** ("first letter only").
- **Music bingo** — host plays tracks from a DJ app, phones get cards. **He
  plays one chorus and moves on**, which is why the generation prompt asks for
  tracks whose chorus lands on its own — a song recognisable only from a long
  intro or a riff is a poor pick however famous.

---

## The words: OWNER, PARENT, CHILD — and owner is not a synonym for parent

Settled on 14 August 2026, because the host proposed a shared vocabulary and
one word in it would have undone the distinction drawn the message before:
*"parent accounts are owner accounts and child accounts are sub-accounts."*

**Parent and owner must stay different words, and this is the whole reason the
group work is safe.** "Owner" already means the APP owner — one account,
global, sees every subscriber, the catalogue and the AI ledger. A pub group's
head office is not that and must never be able to become it. Calling both of
them "owner" is how a scoped power quietly turns into an unscoped one, six
months later, in a route somebody wrote in a hurry.

| Word | What it is | What it can see |
|---|---|---|
| **Owner** | the app owner. Exactly one, for ever | **everything** — every account, the catalogue, the ledger |
| **On their own** | a quizmaster with no company: no parent, no children. **The default, and almost everybody** | **itself** |
| **Parent** | an account that manages other accounts: a pub group's HQ, a quiz company | **its own children, and nothing outside them** |
| **Child** (sub-account) | an account managed by a parent: a venue, a company's quizmaster | **itself** |

**THE STATS ARE A VIEW, NOT AN ACCOUNT — and that is what makes the uniformity
free.** Proposed, reasonably: *"every entity has one parent and one child…
because even a solo quizmaster wants stats."*

**The goal is right and it should be one mechanism.** What does not follow is a
second ACCOUNT per person. A solo quizmaster wanting headcounts needs a PAGE,
and they already have one: Past gigs. Giving them a parent as well means a
second login or a hat switch for one person, a bill question about an account
that buys nothing, and an entity invented at every sign-up whose only job is to
look at its owner's own data.

So put the generalisation in the QUERY, where it costs nothing:

> **One function takes a SET of accounts and returns the nights across them. A
> solo's set is themselves; a parent's set is its children.** Same code, same
> page, N of one or N of five.

That is the uniformity being asked for, and it arrives without a phantom
account. Build the aggregation that way FROM THE START — the real risk here is
shipping "past gigs for one person" and later "stats across venues" as two
features that then drift.

**AND THEREFORE THE HAT DOES NOT BECOME UNIVERSAL.** **A hat switches between
IDENTITIES, not between pages** — if the stats are a view, a solo quizmaster
has one identity with an extra tab on it, and a switch offering nothing on the
other side is the fault this file keeps recording. It would also break the
host's own hard rule that the switch must never appear on anybody else's
account.

A hat is right when one login genuinely holds TWO identities with different
powers and different rooms. That is:

- **the owner**, who is the app owner and a quizmaster — built, and the reason
  the switch exists;
- **a quiz company's playing manager**, who manages the company and also hosts
  on Fridays. Two identities, so the same mechanism, unchanged.

And nobody else: not a solo quizmaster, not a pub group's head office that
never hosts, not a venue running its own night. **One identity, no switch.**

**"ON THEIR OWN" IS A CASE, NOT A GROUP OF ONE.** A solo quizmaster is not a
child of anything. If the model requires a group, every subscriber needs one
invented at sign-up and every query goes through a pointless join. **`parentId`
is simply absent on an ordinary account** — the rule this file follows
everywhere: the common case costs nothing.

**A PARENT MANAGES; A CHILD RUNS.** That is the host's "parent is the stats and
the data, the child actually runs the quiz", and it is right as the common
case — HQ reads numbers, venues run nights.

**But it is a tendency rather than a rule.** A small quiz company's manager
hosts on Fridays. **A person who does both has two hats, which this app already
has** — `hatSwitch()`, one login. So a parent MAY run nights; it usually does
not. Do not model "parent" as "cannot run a quiz", or the first company that
promotes a host breaks.

Two smaller notes, both worth having before anybody builds this:

- **A child has exactly one parent.** A venue in two pub groups, or a
  quizmaster employed by two companies, is a real thing in the world and a mess
  in the data — resolve it as one parent plus an ordinary marketplace booking
  for the second, which the attribution model already covers.
- **Nesting is not needed and should not be built** until somebody asks. A pub
  group with regions is a parent of parents; it is a fair thing to want and it
  doubles every scoping question, so it waits for a customer rather than an
  imagination.

### THE FIRST SLICE IS BUILT — accounts, entitlements, scoping. Not invoicing, not venue specifics.

Built 20 August 2026. **A parent is DERIVED, never stored** — `parentId` on
the child is the only new field, so any quizmaster becomes one the moment they
add a first seat and stops the moment the last is removed. No nesting,
enforced at creation: a parent must not carry a `parentId`.

**A seat gets its parent's tier, minus streaming — `accounts.effective()`.**
`plans.js` only ever sees one account and cannot look another one up, so the
substitution happens in `accounts.js`, the one place that has both, at a SINGLE
choke point: `whoIs()` wraps every real account through `effective()`, so every
`can()` / `featuresFor()` call downstream needed no changes. `parentId`
survives the substitution purely so `featuresFor()` has something to ask when
withholding `FEATURES.STREAM`.

**Scoped exactly like a room**: `/api/group` resolves from `whoIs()`, never
from an id in the request — the rule `/api/host/*` already follows.
`removeChild()` is never destructive: the account, its room and its own packs
are untouched.

**Reachable from My account, as a small panel** (`groupPanel()` in
`console-account.js`) — and this IS the group-admin screen, not a stand-in.
Each seat's row carries a `Running` badge and the note says how many are live
now — the scoped "Tonight" view, on the page a group admin already hosts
from.

**THE HAT SWITCH DOES NOT NEED TO GENERALISE — resolved, not parked.** It
exists for the owner because `/owner` and `/console` are separate routes; a
group admin has no second route to switch into. Do not build one without a
real second destination first.

**NOT built, deliberately parked**: pack sharing (~17 call sites on the
protected launch path, zero real users yet), agency invoicing, venue-account
specifics. Full reasoning:
**[`docs/business/groups.md`](docs/business/groups.md)**.

## The words: a quiz is a product, a round is part of one

Settled deliberately, because the two were used interchangeably for months and
it stopped being harmless the moment packs became something to sell.

| | The whole product | A part of it |
|---|---|---|
| **Music quiz** | a **quiz** — a night's worth, several rounds of questions | a **round** — ten general knowledge questions, *or* five pictures. All one type |
| **Music bingo** | a **bingo game** — one theme, forty-odd tracks, the cards built from them | a **round** — `newRound()`, fresh cards, played until the last prize goes |

And a third word, because the code leans on it: a **pack** is either of those
as a file on disk — `quizzes/eighties.json` and `bingo/disco-funk.json` are both
packs. It is the umbrella term for "a whole product, whichever game it is", and
it is what `packId`, `packCard()` and `loadBingoPack()` all mean. Use it when a
sentence has to cover both; use "quiz" or "bingo game" when it does not.

**A round is all one type.** `round.type` is a single string, not a list — so
"fifteen general knowledge and five pictures" is TWO rounds, not one mixed one.
That is what `roundPlan()` produces: one round per `{ type, count }` you ask
for. There is no such thing as a round with a couple of pictures in the middle
of it.

**A bingo pack has no rounds inside it on disk** — it is a title and a track
list. The rounds are a thing that happens while it is being played. That is
exactly why the console used to say "New bingo round" on a button that makes a
whole game, which is the confusion this section exists to end.

**What is bought and sold is a QUIZ or a BINGO GAME, never a round.** Pricing,
the catalogue and anything a subscriber's library shows are in whole products.
There is no such thing as buying round two of somebody else's quiz.

### What each AI actually makes

Precision here matters because it decides who pays for what:

- **Claude writes a whole quiz** — every round in it, questions and answers,
  then checks its own work. Owner only.
- **Claude writes a whole bingo game** — the track list. Owner only, and these
  days usually done in a browser and pasted into Import.
- **OpenAI draws pictures for the picture ROUND of a quiz.** It writes nothing.
  It does not generate a round and it certainly does not generate a quiz — it
  takes questions that already exist and draws a portrait for each. That is why
  it is `owner.artwork` and priced separately from `owner.generate`.

---

## Rules that must not be broken

These have tests. If a change makes one fail, the change is wrong.

### 1. The two-screens rule
The projector and the host's phone show different things. The host reads their
cue off their own screen while the room looks at the projector.

**The answer key, host notes and the round 3 track cue are never in the big
screen's payload.** Not hidden with CSS — the server builds each role's
payload field by field from a whitelist (`screenQuestionExtras` vs
`hostQuestionExtras` in `src/engine.js`). A new sensitive field must be added
to the host view only.

**Who answered what is host-only too.** `whoPicked` in `hostView()` names every
team under the option they chose, plus who let it go by — the counts said four
got it wrong, this says which four, which is what the host reads off the mic.
It is not in `screenView()` or `playerView()`, and there are tests for both.

It shows **live as well as on the reveal**, folded away behind the count with a
caret. The first version hid it during the question in case a mirrored control
view gave the popular answer away — but the COUNTS are already on that screen
and give it away first, so hiding the names bought nothing. Closed by default
while the clock runs so it is not a moving list to read, open by default on the
reveal, which is when you are talking about it.

The open ones are remembered in a module-level Map in `host.js`, keyed by
**phase**, round, question and option. It has to be outside the render: this
panel is rebuilt on every state push, which during a question is every time
somebody answers, so a list you had just opened would shut itself the moment the
next team pressed a button. The phase is in the key because the first attempt
stored "the opposite of the default" — and since the default flips at the
reveal, the list you had opened closed itself and one you had never touched
sprang open.

### 2. The server owns the clock
Every timestamp used for scoring comes from an injected `now()`. Phones send
only which option they tapped. Never trust a client timestamp.

### 3. A phone proves who it is with a TOKEN, never with its id

`newToken()` / `ownsPlayer()` in `src/engine.js`. There is no login for a
phone, so something has to be the proof — and it used to be the player id,
which meant **anything that learned an id could act as that player**: answer as
them (the wrong answer lands first, and their real one comes back "already
answered", costing them the question) and rename them, which puts arbitrary
words on the projector where there is deliberately no filter.

It was fully reachable from the back table: the join code is on the big screen
and read out on the mic, and `/api/state?role=screen&g=CODE` published the
fastest finger's id. **The person WINNING was the person the room could
sabotage.** Found by joining a game as two phones and playing one against the
other.

So: a token is issued at join, kept on the player, saved in the state file, and
sent in exactly one place — that player's own join reply. Every player action
carries it. `faceKey()` is what the projector gets instead, so a photo still
finds its person.

**A player with no token yet is trusted once and then bound.** Phones that
joined before this existed hold an id and nothing else, and a redeploy
mid-season must not lock a room out of its own game — the same reasoning as
rule 5 below.

**A request that cannot prove itself is not refused with an error — it gets a
team of its own**, which is what an honest new phone gets anyway. The attacker
gains nothing and nobody legitimate is ever turned away.

### 4. A flood is HELD at the door, never refused

`src/joins.js`. The join code is on the projector and read out on the mic, so
everybody in the room has it — and joining is an ordinary web request, so
anybody bored can fire a few hundred from a phone browser. Measured against a
running server: **300 joins landed in half a second.**

Over the threshold, new phones are asked to wait rather than turned away, and
the host's board says **"288 phones waiting to join — Let them in"**. One tap
lets the lot through and holds the door open for a minute.

**The NUMBER is what tells the host which it is.** Eighteen is a room; two
hundred and eighty-eight is somebody messing about. That judgement takes a
human a second, which is why it is not automated.

**A PHONE THAT CAN PROVE WHO IT IS NEVER QUEUES.** Only joins that would create
a NEW player are counted; a rejoin carries a token (rule 3), so it is provably
somebody already in the game. That matters because a redeploy, a restart on a
host with no disk or a wifi blip sends the whole room back at once — two
hundred reconnects in a few seconds looks exactly like a flood, and holding
them would be a self-inflicted outage mid-quiz.

**The threshold errs LOOSE, and the asymmetry is the whole reason.** The first
version was tight, on the theory that a wrong guess costs one tap. It does not:
too tight and a real room gets a "just a moment" screen while the host is on a
mic and not looking at their phone, which is the show stopping and this app's
fault. Too loose and some junk teams reach the scoreboard — which no player
sees, and which "remove the ones who answered nothing" clears in one tap. One
of those is a gig going wrong and the other is tidying up.

The gap makes that free: a pub peaks at two to six joins a second (people have
to find the camera and type a name), two hundred people online clicking a link
is five to ten, and a script does six hundred. The threshold is twelve.

**Per-IP limiting is the obvious answer and it is wrong**: a pub puts the whole
room behind one router, so it refuses the actual customers first. An office
does the same online. One rule that holds in both modes beats two that each
work in one.

### 5. Only a real removal throws a phone out

A phone whose id the server does not recognise is asked to **rejoin silently**
(`view.rejoin`). It is told it was removed (`view.kicked`) **only** if the host
actually removed it — which is why removals are written into `state.removed`
rather than inferred from the player being absent.

Absent has many causes and only one of them is a kick: a redeploy, a restart on
a host with no permanent disk, a fresh game launched over a full lobby. Those
used to throw the whole room out mid-question and wipe their team names.
`kicked` wipes localStorage on the phone, so getting this wrong is not
cosmetic. Do not reintroduce "no player found, therefore kicked".

Related, and the thing that made it recur: a `Live` carries the player id in
its URL, so replacing one **must** call `live.stop()` first. It used to only
close the stream and leave the keep-alive timer running, which reopened the
old stream under the old id forty seconds later. Every rejoin left another one
behind, all of them claiming to be someone the server no longer had.

### 6. Bingo cards cannot be regenerated
The card is built server-side on join and stored against the player. There is
**no endpoint that issues a new card** and no card-generating code on the
phone. Refresh, reopen, clear the browser, rejoin — same card. Do not add a
"new card" feature; the host asked for this explicitly to stop cheating.
`newRound()` is the only thing that reissues, and it does everyone at once.

### 7. Crash recovery
State is one JSON object written atomically. Anything that **moves a game
forward** flushes to disk immediately (new question, reveal, round change, a
team joining, a bingo track called, a bingo square marked). Only high-frequency
low-stakes things are debounced.

Bingo marks are deliberately immediate: a lost quiz answer is recoverable with
Redo, but nobody can re-tap ten songs they heard half an hour ago.

### 8. Phones never show the question text
Only the options. Keeps the room looking up, makes googling harder.

### 9. The scoreboard and adverts are flags, never phases
`state.scoreboard` and `state.advert` put something over whatever the quiz is
doing without moving it. A phase change would have to be undone to get back,
which is the one mistake that loses everybody's place mid-round.

Both are refused over a live question and cleared by any move, so a question
can never appear behind either. They also clear each other — two things cannot
be on one projector.

An advert's **words are looked up when a view is built**, not copied into
state, so correcting a price on a venue's slide changes the projector without
taking it down and putting it back. The host's mic line (`say`) is host-view
only, like a round 3 cue.

### 10. "Pick them all" tells the room HOW MANY, never which
A `multi` question shows six options with 2–3 correct. The screen and the phone
get `pickCount`; `correctIndexes` is host-only, like every other answer key.

Part marks — the share you got right, applied to the base AND the seconds left,
so a fast mostly-wrong answer cannot out-earn a slower right one. The
first-correct bonus needs the **whole** set. Exactly N picks is enforced server
side and refused rather than trimmed, or somebody covers the board and scores.

### 11. A CORRECTION TO A DISTRIBUTED PACK REACHES EVERY COPY — because there are no copies

Stated by the host on 14 August 2026 as a standing rule for everything he
generates: *"if someone tells me a question is wrong or the answer is wrong it
must update the library and all copies everywhere"*, and *"I must maintain high
standards for the things I am distributing to them."*

**It already holds, and the reason it holds is that nothing is ever copied.**
There is exactly ONE file per catalogue pack, in `quizzes/` or `bingo/`, and
every quizmaster's console reads that same file. `packDir()` in `own-packs.js`
resolves own-first and falls through to the catalogue, so a subscriber is not
handed a duplicate at any point — there is no per-account copy to go stale.

**Nothing is cached, so there is nothing to refresh.** `listQuizzes()` reads
the directory and every file on each call and `loadQuiz()` reads the file — so
a pack that is not being played is read off disk at the moment it is launched
and is therefore always current.

**WHICH LEAVES EXACTLY ONE COPY IN THE WHOLE SYSTEM: `session.pack`, held in
memory by a game that is running**, because the engine needs it every second
and re-reading a file per state push would be daft. That single copy is the
only thing in the app that can go stale against a correction, and it is
precisely what `reloadPackEverywhere()` in `server.js` exists to replace — it
walks every room, re-reads the pack and pushes the new state, so a fix saved at
nine o'clock reaches a quiz already on question four.

Worth holding both halves at once, because stated separately they sound like a
contradiction — *"read when it is loaded"* and *"corrected instantly"*. They
are the same fact seen from either side of the one in-memory copy.

**DO NOT REPLACE THIS WITH MASTER-AND-SLAVE COPIES, however natural the words
are.** A hundred copies plus a sync is a hundred chances for one to miss an
update, and the failure is silent and lands in front of a paying room months
later. One file cannot miss it. The host's model is right; the implementation
that satisfies it is fewer copies rather than better syncing.

**Which means an own-pack must never be able to SHADOW a catalogue id**, or
that quizmaster silently stops receiving corrections for ever. `saveOwn()`
refuses it — *"There is already a pack called … in the catalogue. Give yours a
different name."* That error is load-bearing, not a nicety: it is the only
thing standing between this rule and a fork nobody knows exists.

**And the rule is one-directional, deliberately.** The owner maintains what the
owner distributes; a quizmaster's own packs are their IP and the owner cannot
read or correct them — enforced by there being **no room parameter on any
route**, so an owner's id resolves against the house room and finds nothing.
See `own-packs.js`. High standards on what is sold, hands off what they wrote.

**If mix-and-match packs are ever built** — pulling rounds from two catalogue
packs into a quizmaster's own — that creates the first thing this rule does not
cover, because the new pack is theirs rather than a copy of a master. Decide
then whether a borrowed question stays linked to its source; do not let it be
settled by accident in the first implementation.

---

## Decisions already made — do not relitigate

**The decisions themselves are below; the reasoning for each is in**
**[`docs/decisions.md`](docs/decisions.md).** Every prohibition is kept here
verbatim, because a rule that stops a bad change has to be readable without
opening a second file.

- **No dependencies at all**
- **SSE, not websockets**
- **No build step**
- **Packs are JSON files**
- **The console wears a gauntlet cursor — open hand, closed fist while dragging — and scroll rods on its panels, console only** — never the projector or a phone.
- **No profanity filter on team names** — **in the ROOM. Do not add word
  filtering to the projector, the phones or the console.** The public league
  page and the landlord's report are the one exception, and it is a SCOPE
  rather than a reversal — see *filtered at the door, never in the room*.
- **Photo uploads auto-publish** — Do not add one.
- **Photos go in a SEPARATE PRIVATE repo** — Never the main repo: it is public (checked), and git history is forever.
- **Filters are pixel maths, not `ctx.filter`**
- **"Filters" means PROPS, and the colour grading is GONE** — positions are a **fraction** of the canvas, never pixels.
- **THE PHOTO CAN BE MIRRORED, and it is a BUTTON rather than a detection**
- **THE PHONE MUST NOT SAY "look up" WHILE A QUESTION IS ON** — `PHOTO_PHASES` in `screen.js`: photos at the lobby, a round board and the end only, because twenty seconds and four options wants the whole screen.
- **A VENUE'S LOGO GOES ON THE WINNER'S VOUCHER, and nowhere else** — **THE WORDS STAY THE PRIZE**, in text underneath. **Never an image with the prize written inside it.** **NOT on the projector, and that is BYTES rather than secrecy.**
- **The room is told what it is playing for**
- **SECOND AND THIRD ARE A PODIUM, not a caption**
- **A BIG PHOTO NEVER DIMS THE JOIN CODE** — the corner sits ABOVE the photo, and the photo centres in the space BESIDE it (`padding-right` on the grid).
- **A photo gets the MIDDLE of the screen, not a thumbnail** — **the tilt never lands near straight**: a side is picked, 2.5° to 7° off it.
- **Speed scoring is FLAT — 10 points a second, and it stays that way** — **Do not re-propose this.**
- **The phone shows the answers as the projector does**
- **…except the alphabet round, which is 5 across on the phone and 9 on the projector**
- **An alphabet answer may never begin with "The", "A" or "An"** — **Do not soften it to a warning.**
- **The picture round's effects all run on one curve**
- **A seasonal look is a palette and some shapes, never a change to the game**
- **Anything that deletes shows a bin**
- **No Instagram follow-for-points**
- **British spelling and UK chart references**
- **Deploying on Render** — serverless is wrong: the app holds a live connection to every phone all night.
- **Alphabetical bingo call sheet**
- **The call sheet is a grid, not a list**
- **The chosen shape lives in the GAME STATE**
- **The card shape is chosen at LAUNCH, not stored on the pack** — `session.launch()` overrides it for that game and never writes it back.
- **How many prizes is chosen at launch too**
- **"You got it" means the prize ON THE TABLE**
- **A strip wins the long way only**
- **Launch is the last thing on a pack card, and full width** — superseded; the rule moved to TONIGHT.
- **The tab icon and the logo are one drawing**
- **A QUESTION MARK INSIDE A MICROPHONE**
- **The sound arcs are built but OFF** — **the app never draws this mark above 30px.**
- **The name stacks — the possessive above, the app underlining it** — **it splits on the APP NAME, never on the last word.**
- **One type ladder, ten steps, named for the JOB**
- **ONE MENU, built in one place, on every page a quizmaster drives**

## The GUI rules — what a control looks like is decided by what it DOES

Settled on 14 August 2026, because the host was about to design the interface
once per feature: *"I want to make sure that when I build future features, I'm
not designing the GUI after every feature."* Right to stop and do it once —
measured before the conversation, the same primary gradient appeared **72
times at four different angles**, and there were **eight different corner
radii**. The system existed in his head and drifted on screen.

### Five roles, and every control is exactly one of them

| Role | What it looks like | Where |
|---|---|---|
| **The night** | filled, the account's own gradient, rounded | Launch, Take control. **One per screen, maximum** |
| **Make something** | filled green | Write it, Import, Make the pictures |
| **Ordinary** | outlined, no fill | Read, Rename, Save, Send |
| **Destructive** | outlined **red**, never filled | Delete, Close, Stop |
| **Choose** | a quiet field, no gradient at all | dropdowns, text boxes |

**FILL MEANS COMMITMENT.** That is why destructive is outlined rather than
filled: a filled red Delete is as loud as Launch, next to Launch, on a card
somebody is tapping in a dark pub. It is also why there is only ever one filled
gradient on a screen — the moment there are two, neither is the thing to press.

**A text box and a dropdown look identical** — same height, fill, border,
radius — which is why the venue box looked wrong beside three styled selects:
it was a bare `<input>` with no rule at all.

**With ONE deliberate difference: the dropdown's chevron sits on a small block
of the account's own gradient.** Taken off once, on the reasoning that three
gradient tabs beside a Launch button compete with it, and the host looked at
both and put it back — *"adds a splash of colour but is obviously different
from the other button that has a full gradient"*. He is right, and the reason
is SIZE: a 27px tab and a full-width filled button are not mistakable for each
other, where two full-width filled buttons would be. **It is also not
decoration — it is the affordance that says "this opens"**, which is exactly
where the two controls should differ, because it is where they behave
differently.

**A hairline gradient on every dropdown was a separate proposal and was turned
down.** That works on the photo card because it is ONE card framing an
explanation; as an outline round every field it is decoration with no job.

### A SCHEME CHANGES PERSONALITY, NEVER MEANING

The line, and the host's own example is the test: *"a quizmaster who likes pink
and purple wants the logo pink and purple, and the Launch button pink and
purple. But when she deletes a quiz pack, she doesn't want that pink and
purple. She wants red."*

| Follows their colours | Fixed, for everybody |
|---|---|
| **The night** — Launch, Take control | **Gold** — points, winning, first place |
| The logo and the wordmark | **Green** — good, paying, makes something |
| The washes and glows behind everything | **Red** — wrong, destructive |
| Highlights and focus | **`--a` to `--f`** — the option colours |

**The most frequent colour is the one that follows them**, which is the host's
own rule and is already true: `--hot`/`--hot-2` is used 72 times to gold's 55,
so changing scheme genuinely changes the place rather than tinting two buttons.

**GOLD IS THE TROPHY COLOUR, not a navigation one** — found by counting where
its 55 uses are: the winner, the score, the points, the top row of the board,
the bonus pill, "you" on the mini board, the reveal banner. First place is gold
everywhere in the world, so an account setting that changed it would be like a
scheme that made red mean go.

**Which leaves one known oddity, deliberately not fixed yet:** the lit menu chip
is the only navigational use of gold — it borrows the trophy colour for a job
that is not winning, and on the **Citrus** scheme (lime into gold) it sits next
to a gold-ish Launch button and muddles. The fix is to make "you are here"
neutral rather than to move gold. Left alone for now because it is on a screen
used on a gig day.

### One angle, three radii

`120deg` for every gradient, and **10px / 14px / 999px** — a field, a card, a
pill. Nothing else. Purely mechanical, no judgement calls, and it is most of
why things looked slightly off.

**THE NUMBERS MOVED TO MATCH THE APP, not the other way round.** They were
written as 6/12/999 and the app never followed it — measured on 14 August
2026, the sheet used **10px fifty times, 14px twenty-two, 12px twenty-three,
6px five**, plus twenty-three strays at 2, 4, 7, 8, 9, 11, 16, 18, 20 and 26.
So `--r-field: 6px` was a token almost nothing used and cards were split
between two values. That is not a system with exceptions; it is a rule nobody
was applying.

Both fixes were rendered side by side on the real controls before choosing —
tightening every field to 6px makes the buttons visibly harder than the cards
holding them, which is the wrong direction for an app whose stated brand is
soft and friendly. Adopting 10/14 is also the smaller change, because it is
already what most of the app is.

### NOTHING CLICKABLE IS A FLAT GREY BOX, AND NOTHING IS SQUARE

Two constraints, set by the host on 14 August 2026 in his own words: *"I
absolutely hate square corners… reasonably rounded so it doesn't appear square
or too sharp"*, and *"I never want anything that's being clicked to just be a
boring grey box."*

The corners are the radius rule above — 10 / 14 / 999, nothing sharp anywhere.

**An ordinary button gets DEPTH plus an EDGE, and that pairing is the whole
answer.** The face is a top-lit surface rather than a flat swatch, so it reads
as an object you press; the account's own colour is the bottom border. Three
tinted options were rendered first and all three were turned down with the
second constraint that makes this work: ***"don't want a wall of red either"***
— a row of six buttons filled with the account colour is as wrong as a row of
six grey ones, in the other direction.

So the colour is on the EDGE and never on the face. One button says whose app
this is; six of them in a row still say it once.

**The underline is a boxed control's bottom border, not a bar under a bare
label** — which is how the tab bar marks the tab you are on. Same colour,
different object. It was raised as a collision before he chose this and chosen
anyway; if the two ever end up side by side, this is the note.

**Destructive keeps RED on its edge in every scheme**, like everywhere else: a
quizmaster's colours change the app's personality, never what red means.

**AND THE LIT MENU CHIP FOLLOWS THE SCHEME NOW, so gold is the trophy colour
and nothing else.** It was solid `--gold`, which this file already flagged as
the one navigational use of a colour that means first place everywhere. It is
a tint of `--hot` with its own outline — on-scheme, obviously "you are here",
and deliberately NOT the full gradient, which means "press this" and would be
the loudest thing in the app sitting on the one control there is no point
pressing. A `rgba` fallback is declared before the `color-mix`, or a projector
too old for it loses the fill entirely.

**The hat switch already followed the scheme** and was left alone. The B/S/G
rungs keep the metals, because there the colour IS the meaning — and they are
only ever drawn for the owner: `/api/me` sends `tiers: []` to a real
quizmaster, so the control does not exist on anybody else's account.

### GIGS IS EVIDENCE. CALENDAR IS ORGANISATION.

The host's own framing, reasoned aloud on 14 August 2026 while working out
whether the two tabs should be one: *"Gigs is where you would store
information on what happened in the past… it's gonna store statistics and
photographs and all this other stuff you can send. So Gigs is all about
EVIDENCE, and Calendar is all about ORGANISATION. They're actually
fundamentally different."*

**Keep this as the test, because it decides where a new thing goes without
re-arguing it.** Anything that is proof of work belongs to Gigs — headcounts,
photos, who won, the post-night report, what a landlord is shown. Anything
that is a plan belongs to Calendar — residencies, one-offs, nights off, what
is on next Thursday.

It also explains why merging them felt wrong the moment he tried it: **one is
a record you SHOW somebody, the other is a list you ACT on.** Those are read
at different moments, by a different half of the brain, and a tab that does
both is a tab you scroll past looking for the half you wanted.

**This replaced a weaker reason of mine** — "the evening runs left to right,
so booked comes before run" — which is true and orders the tabs correctly but
predicts nothing. His version is a rule; mine was an observation.

**Invoices stays its own tab and is the honest edge case**: billing is
past-facing like evidence, chasing is organisation. It is separate for a third
reason already recorded above — on a Monday it is a destination you want to
land on rather than scroll to, and its badge counts what you are still owed.

### THE MONTH IS ON THE LEFT AND WHAT YOU DO ABOUT A DATE IS ON THE RIGHT

`diarySection()` in `console-diary.js`, `.cal-wrap` / `.cal-side` in `style.css`.
Two columns from 900px, the month left and what you do about a date right;
below that the panel goes underneath and the picker scrolls it into view. The
panel is **the diary when no date is picked and that date when one is**. There
is **one place a night is added and it is the date you picked** — *Book a quiz*
opens the whole form against the date in the heading, which is never a field. A
start time is **optional** and written **floating** (no `Z`, no `TZID`), with a
stated two-hour default and an end date that moves with the clock. **"Not on
this week"** writes one week of a residency off and **"Delete this booking"**
removes a one-off — two labels, never one; a written-off night is **shown on its
own date with Put it back**. A row in the coming-up list is something you READ:
no buttons on it, and the whole row picks that date. The month is **sticky** at
900px and up. **Invoice for this date goes to the Invoices tab**, not to a form
over the calendar.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### THE CONSOLE IS TWELVE FILES, AND THE STATE MODULE IS WHY IT WORKS

`console.js` was 11,222 lines. It is now a shell plus a module per door or tab,
moved **by line number** — the same mechanical transform as the `CLAUDE.md`
split, so not one body changed.

- **`console-state.js` HOLDS THE BINDINGS MORE THAN ONE MODULE WRITES, and it
  imports NOTHING.** An ES import is a read-only view: `import { library }` then
  `library = x` throws **when that line runs**, not when the file loads — so the
  page draws and then a launch dies in a pub. The thirteen shared bindings live
  there with a setter each; **only 39 assignments had to change, and ~350 reads
  did not**, because a live binding reads fine from anywhere. State that ONE
  module writes stays with that module.
- **THE BOOT CALL MUST BE THE LAST THING IN `console.js`.** `load()` sat at line
  10,161 — after every declaration. Moved with its neighbours it landed in a
  module `console.js` IMPORTS, so it ran before `console.js` initialised its own
  bindings, `rights = menuRights(who)` threw on a `let` in its temporal dead
  zone, **its own catch swallowed it, and the console drew perfectly with the
  Workshop door missing from the nav.** Nothing else looked wrong.
- **`node --check` CANNOT SEE EITHER FAULT** — both are valid syntax — so
  `browser-parses.test.js` passes them. `test/console-split.test.js` is the
  guard: no module assigns to a name it imports, the state module stays a leaf,
  and no module grows back. Verified by breaking each one.
- **ANYTHING READING THE CONSOLE AS TEXT READS ALL TWELVE** —
  `test/console-source.js`. Five checks were pointed at the one file; three
  failed loudly, which was luck. A grep aimed at the wrong file proves nothing,
  which is this repo's oldest lesson wearing another hat.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### CHANGING TAB DOES NOT MOVE THE PAGE

`renderKeepingPlace()` in `console.js`. Tabs are one page with the middle
swapped, and jumping to the top on every press makes them feel like nine
separate pages.

**It must HOLD the scroll, not merely decline to change it**, which looks like
a one-line deletion and is not: `render()` replaces the whole of `mainEl`, so
for an instant the document is short, the browser clamps `scrollY`, and putting
the content back does not put the scroll back. Read the offset before, write it
after. **A shorter tab still clamps and that is correct.**

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### THE INVOICE BOOK IS NOT ENCRYPTED, AND THAT IS THE DECISION

Settled on 14 August 2026 after the host asked whether personal details in the
invoice book should be encrypted. The answer is no, and the reasoning is worth
keeping because the instinct to revisit it will come back.

**The bank details are the quizmaster's OWN, and they are printed on every
invoice they send.** A sort code and an account number exist to be given to the
venue. Every pub they have ever invoiced already has them. Encrypting data
whose entire purpose is to be handed out is theatre.

**The venue records are BUSINESS contact details** — a pub name, an address, a
landlord's email. The same information is on the pub's own website. This is not
consumer personal data and the stakes are correspondingly low.

**No card details are stored and none ever will be.** When payments are wired
in the processor holds those; the app never sees a card number. That is the
real answer to *"people put their bank account into apps all the time"* —
those apps mostly do not store it either.

**Server-side encryption where the SERVER holds the key buys almost nothing.**
The server has to decrypt to draft an invoice, so the key and the data sit on
one machine. It helps in exactly one case: the private-repo backup, the only
copy that can leak without the server.

**And the cost of that is severe in a shape this app has already been bitten
by.** On Render's free tier the disk is wiped on every deploy, so the backup IS
the data. Encrypt it and losing the key makes the invoice book landfill — and
the host has already lost his own console once when `HOST_KEY` rotated on a
deploy. Encryption converts *"GitHub suffers a breach"*, which is unlikely and
their problem, into *"I lose an environment variable"*, which is likely and
entirely his.

**AND THE HOST'S OWN CLINCHER: INVOICING IS OPTIONAL.** *"You can invoice them
personally if you want, or you can invoice through the software if you want.
Nobody is being forced to use this."* A quizmaster who would rather use their
own accounts package simply never fills the tab in, so the data is there
because somebody chose to put it there.

**NEVER CLAIM IT CANNOT BE READ.** That would be a lie, and it is the same rule
this file already sets for own-packs: the honest pitch is *"the app will not
let me in unless you let me, and here is the log"*, never *"I cannot see it"*.
Say plainly what is stored and where.

**What to do instead of encrypting**, and it is worth more: **do not store what
is not needed.** A venue needs a name, an address and one email. It does not
need a phone number nobody dials.

### THE CONSOLE'S THEME — one surface, one heading ladder, a bar that stays

**ONE SURFACE, TINTED WITH THE ACCOUNT'S OWN COLOUR** — `--surf-1`, `--surf-2`,
`--surf-line`, applied by overriding `--panel` and `--panel-line` **for
`body.console` alone**. One override is one decision; editing the twenty-nine
rules that say `var(--panel)` is twenty-nine chances to drift again. **The
surfaces are OPAQUE**, which is load-bearing: translucent, the same pack card
comes out a different colour depending on which wash it lands over. The console
keeps the corner washes and the drift every other surface has — it was the one
page in the app with its ambience switched off.

**THREE HEADING STEPS, AND THE TAB'S OWN IS DRAWN IN ONE PLACE.** `tabBody()`
prints the tab's own label as the heading, in the account gradient at
`--fs-title`, and a section under it drops to `--fs-head` and stays white. In
`tabBody()` rather than in nine render functions, because a heading each is
exactly the arrangement that let four of them go missing. **Behind an
`@supports`**: gradient text is transparent text.

**THE TABS ARE A COLUMN DOWN THE LEFT, AND THE SAME COLUMN ON A PHONE** —
`.consolecols`, 190px and sticky from 900px, full width below it. The
horizontal bar needed `overflow-x`, a wrap rule and a `showActiveTab()` that
scrolled the lit chip back into view; **a vertical list has every tab visible,
so all of that is deleted rather than ported.** The lit marker is the LEFT
edge, because under a stacked list a bottom border reads as a rule between two
tabs. `minmax(0, 1fr)` on the content column is load-bearing — a grid child
defaults to `min-width: auto` and the pack grid would push the page sideways.
**`.game-head .row` is a flex row** with a gap, wrapping, `align-items:
stretch`. The account-coloured underline on ordinary buttons stays.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### THE HOST'S SCREEN SAYS WHAT THE ROOM IS LOOKING AT

`phonesAre()` in `public/assets/phones.js`, under the status line on the
control view. **A performer's prompt, not a status readout** — a quizmaster
behind a microphone cannot see sixty phones, and what is on them decides what
they say next.

- **IT NAMES ITS SUBJECT.** `whereLabel()` an inch above says where the GAME
  has got to; this says what the PHONES have got. Two bare one-line statuses
  side by side is the label collision this file keeps recording, and the fix it
  already prescribes is to keep the noun and add the audience — so it always
  reads *"On their phones: …"* and never stands alone.
- **ONE FUNCTION, and every phase must answer.** A host who says something the
  phones are not offering has said it OUT LOUD to sixty people who then go
  looking for a button that is not there. There is a test walking `PHASES` and
  `BINGO_PHASES` themselves rather than a typed list, so a new phase cannot
  silently leave the line blank.
- **WHAT IS OVER THE TOP WINS**, exactly as on the projector: a scoreboard or
  an advert is a flag rather than a phase, so the quiz underneath carries on —
  but it is not what anybody is holding.
- **Derived on the CLIENT from state the host already has**, so no payload
  changed and the guard stayed byte-identical. It is host-only by construction:
  a note to one person about everybody else.

### THE CONSOLE'S POLISH PASS — three rules from one sweep, 25 August 2026

- **`main` IS A FLEX COLUMN — never give it a row template.** Its
  `auto minmax(0,1fr)` grid assumed exactly two children, so ANY banner above
  the doorhead (the no-accounts maker, Workshop's backup warning) pushed the
  doorhead into the `1fr` row — STRETCHED, ~160px of nothing under the launch
  bar — and dropped the columns into an implicit row, quietly turning the
  fixed frame back into a scrolling page. Flex takes any number of banners;
  only `.consolecols` grows.
- **THE SHELF IS SIX ACROSS, BY DECISION — it mirrors the six bays above
  it.** *"The packs have to be 6 in the section below the bays and not 5."*
  An auto-fill floor lasted a day. What actually made the 146px poster hold
  its content was never width: the meta's two-line clamp, dropping the
  "· N rounds" text that duplicated the round squares beneath it, and the
  title getting back the 44px a stale pin-clearance rule stole — which is
  what had sliced titles mid-word and pushed one card's NAME off the top,
  silently. **Do not "fix" a squeezed card by dropping a column.**
- **THE FINISH LAYER at the foot of `style.css` owns selection, caret,
  `:focus-visible` and the card hover** — one named block, so the next
  control gets finished there rather than growing its own scattered rules.
  `::selection` follows `--hot` (rgba fallback first); reduced-motion keeps
  the border answer and drops the lift.

### THE LOBBY GAMES — AND NONE OF THEM IS NAMED AFTER THE ONE YOU ARE THINKING OF

`public/assets/maze.js` + `lobby-game.js` (Maze Mouth), `rally.js` +
`lobby-rally.js` (Rally), `tailback.js` + `lobby-tailback.js` (Tailback),
`lobby-games.js` (the list and the tiers, read by the SERVER and the browser),
`lobby-menu.js` (the card and the loaders), `lobby-board.js` (the projector's
board), `src/arcade.js` (the scores, shared by both engines),
`state.gameSeed`, `state.arcade`, `state.lobbyGame`.

- **THE DEFAULT FOLLOWS THE GAME RATHER THAN THE ACCOUNT: Maze Mouth before a
  quiz, Rally before the bingo.** A bingo night should have a character of its
  own rather than being the quiz with different content in it, and a remembered
  per-account preference would be wrong on half the nights of anybody who runs
  both.
- **WHICH GAME IS A DECISION ABOUT TONIGHT**, so it goes where the look and the
  card shape go — chosen on the launch bar, written into `state.lobbyGame` at
  launch, restored after a crash. **THE TIER IS CHECKED AT THE ROUTE, never in
  the console**, and a game above the tier is **dropped in favour of the
  default rather than refused**: losing a choice costs a game nobody has seen
  yet, where refusing the launch costs the night. **The phone honours
  `s.lobbyGame` and re-checks nothing**, or the console and the room disagree.
- **THE TIER GATES HOW MANY GAMES, NOT WHETHER THERE IS ONE.** Bronze holds the
  two that ship and they are also the two defaults; higher tiers hold what is
  added after. **Do not sell the game itself away from the bottom tier** — a
  phone with a game on it stays in the FOREGROUND, so sixty connections do not
  all come back at the moment the join gate is busiest. That is a RELIABILITY
  feature dressed as a toy. **Locked games are SHOWN, not filtered out.**
- **THEY ARE CALLED MAZE MOUTH, RALLY, TAILBACK AND QUICK DRAW.** The names,
  mazes and characters of the things the first three resemble are Namco's and
  Atari's, and this app is SOLD — a legal line, not a taste one. Say whatever
  you like on a mic; do not print it. **An unnamed game keeps inviting the
  wrong name**, which is why the later ones were named before they were
  written. (Quick Draw is the exception that proves it: a shooting gallery is
  a fairground stall older than video games, so the honest name was also the
  safe one.)
- **THERE ARE THREE WAYS A GAME IS MADE THE SAME ON EVERY PHONE, and a new one
  must use one of them:** a GRID with a fixed step (Maze Mouth, Tailback),
  an ACCUMULATOR of whole ticks with the catch-up capped (Rally), or a
  SCHEDULE where the state at time T is a pure function of the seed and T
  (Quick Draw — the cleanest, because nothing accumulates so nothing drifts).
  **A frame delta is none of them and is always wrong here.** And note the one
  limit that cannot be engineered away: a REACTION game makes input latency
  part of the score, so its windows have to stay generous enough that eighty
  milliseconds of handset is noise.
- **ONE SCOREBOARD FOR BOTH, in `src/arcade.js`** — the same clamp, the same
  best-not-latest rule and the same refusal outside the lobby, called by both
  engines. Two copies is two rules, and the day one is fixed is the day a bingo
  lobby accepts a score a quiz lobby refuses.
- **RALLY RUNS ON A FIXED TIMESTEP, NEVER A FRAME DELTA**, and that is the same
  fairness argument as the seed rather than a performance one: advanced by
  `dt`, a 120Hz phone and a tired 30Hz one play measurably different games, so
  two people on one board would be comparing handsets. `tick()` advances
  exactly one `TICK_MS` and the canvas accumulates real time into whole ticks —
  **capped**, or a phone that was face down on a table for two minutes wakes up
  and spends the whole gap at once, losing every life before it repaints.
- **EVERY PHONE PLAYS THE SAME GAME**, seeded from `state.gameSeed`, set at
  launch and living in the state — or the scoreboard compares two different
  games and means nothing.
- **IT CANNOT REACH A QUIZ**, and there are tests for each half: the seed is in
  the phone's payload at the LOBBY only, a score is refused at any other phase,
  and the board is on the projector at the lobby only.
- **Behind a button, below the photo card** — *"don't want to disincentivise
  photo uploads"*. The module is imported only when the button is pressed.
- **No control panel: you tap and it walks there.** A swipe has to be READ and a
  misread one costs a life. `touch-action: none` on the canvas is load-bearing.
- **ONE POST LEAVES A PHONE, at game over and at each life lost.** Never a
  stream of positions — the lobby is exactly when sixty people are joining.
  Banking at each life is what puts the people who played LONGEST on the board:
  a game interrupted by the night starting never reaches game over, and by then
  the phase has moved and a score is rightly refused.
- **THE GAME IS STOPPED IN `buildScreen()`, ON EVERY REBUILD.** It used to be
  torn down only inside `wireArcade`, which runs only while the WAITING screen
  is being built — so a game open when the quiz started had its canvas thrown
  away and its loop left running for the rest of the night, on a detached
  canvas, holding a window `keydown` listener that swallowed the arrow keys.
  Nothing showed on screen, and the comment above it claimed it could not
  happen. **A teardown belongs where every phase change passes, not where the
  thing being torn down is built.**
- **Each moment has a primary: the game before the quiz, photos between the
  rounds.** The floating camera button stands down in the lobby.
- **SOUND IS SYNTHESISED, ON BY DEFAULT, AND NEVER ON A TIMER.**
  `lobby-sound.js` — Web Audio, no files, like everything else here is drawn.
  **It shipped OFF and that was wrong**, on a worry about phones making noises
  over the host's mic: the game only exists in the LOBBY, so a noise during a
  question is not unlikely but impossible, by three mechanisms that each have
  tests. **What makes on-by-default safe is that the HOST can switch it off** —
  *Game sound* on the launch bar, into `state.lobbySound` at launch, because a
  quiet gastropub and a rowdy Friday are not the same room. **The host's switch
  wins and does not wipe the phone's own**; both default to on wherever the
  field could be absent. **Every noise is tied to something the player DID**
  — nothing on a timer, or it is sixty phones chirping at nobody. It never
  carries information: a phone on a pub table is on silent and iOS mutes Web
  Audio outright, so every game stays playable in silence. **There is no yeehaw
  and that is deliberate** — a synthesised whoop is a kazoo and a recorded one
  is an asset; shipping one is a decision to break the no-assets rule on
  purpose. The toggle is UNDER the canvas: on it, a tap that missed by a few
  pixels is a shot, and the shot could be the sheriff.
- **THE BOARD IS ON THE PROJECTOR AT THE LOBBY ONLY** — `lobby-board.js`, one
  file for both projectors, inside the white QR panel and UNDER the code, which
  nothing in this app may dim. **It was computed and never drawn for as long as
  the feature existed**: both engines put it in the payload, there was a test
  asserting the payload had it, this file said it was on screen, and no
  projector ever read the field — while the phone's own button promised *"Top
  scores go on the big screen"*. **A test that the payload is right proves
  nothing about whether anybody drew it.**

Full reasoning: **[`docs/lobby-games.md`](docs/lobby-games.md)**.

### A DROPDOWN IS NARROW SHUT AND WIDE OPEN — `console-pick.js`

*"All dropdown boxes on the bay must popover… 'look — the usual' needs to only
be as wide as the pre-filled value, popovers can pop out wider but we need to
save space."* A native `<select>` cannot: the browser sizes the open list to
the CONTROL, so one narrow enough for "The usual" clips "Halloween — in season
now".

- **THE NATIVE `<select>` STAYS IN THE DOM AND STAYS THE TRUTH.** The popover
  is a skin: every `.value` read, every `innerHTML = options(…)` rebuild and
  every `change` listener goes on working, and **the LAUNCH still reads what it
  always read**. This bar is the protected surface, and **a skin cannot lose a
  value, because it never holds one.**
- **SO IT MUST BE REPAINTED WHEN THE SELECT CHANGES UNDERNEATH IT** —
  `refreshPicks()` at the end of `paintSettings()`, because `.value = x` fires
  no event and nothing else would tell the face it is stale.
- **CHOOSING DISPATCHES A REAL `change`.** Setting `.value` from script fires
  nothing, so the picker would look like it worked and the launch would send
  the value from before.
- **ONE DOCUMENT LISTENER FOR ALL OF THEM, not one per picker** — the bar is
  rebuilt on every state push, so per-render listeners leak with the room.
- **WHICH WAY A MENU OPENS IS MEASURED**, or the rightmost hangs off the edge.
- **A FLOATING SHEET NEEDS AN OUTSIDE-CLICK CLOSE IT DID NOT NEED INLINE.**
  Left open, the venue sheet sits over the settings and swallows every click
  aimed at them. A popover only its own button can close is a trap.
- **A FACE RESERVES ITS WIDEST OPTION, so it never moves when you choose
  something** — *"dropdowns don't change size at all regardless of what's
  selected."* Every option's SHORT name goes into one grid cell, all but the
  chosen one hidden, so the BROWSER reserves the width. **`visibility`, never
  `display: none`** — a hidden item still sizes the grid. It does not undo
  *narrow shut*: the ghosts are short names.
- **THE ROW MAY NOT WRAP ABOVE 1150px, AND `flex-shrink` ALONE CANNOT HOLD
  IT** — a wrapping flex row WRAPS FIRST and shrinks per line after, so a row
  twenty pixels over drops a control onto a second line rather than taking two
  pixels off eight. `flex-wrap: nowrap`, and **a heading ellipsises rather than
  wraps**. It still wraps below 1150px.
- **A LONG OPTION EARNS A `data-short`, or it costs that width for ever**, and
  **the pack is named on the first of Card/Prizes, not both.**
- Labels shortened with it: **Secs per Q**, **Game**, and Save is just
  **Save**. **"Look" became "Appearance"** — it read as an instruction first.

### THE MARKUP GUARD IS THE MARKUP'S HALF OF THE BRACE RULE

`test/markup-balance.test.js`. Same cause as the stylesheet one: a scripted
move left `.lb-what` unclosed, and **the head row collapsed — the venue button,
Save and the mode switch drew on top of one another.**

- **`node --check` PASSES BROKEN HTML.** A template literal holding it is a
  perfectly good string, and the browser silently re-nests whatever it is
  given: the page renders, it just renders wrong.
- **A WHOLE-FILE TAG COUNT WAS TRIED AND TURNED DOWN.** This app builds markup
  from concatenated fragments — a ternary contributing a `<div>` on one branch,
  a helper returning a wrapper — so `console-venues.js` is nine divs "short"
  and entirely correct. **A test needing a growing exceptions list has stopped
  being a test.** What is left is the launch bar's own template, checked
  precisely, and verified by reintroducing the fault.
- **`play.js` genuinely leaves two `<div>`s and a `<label>` open** in the
  camera sheet. Harmless — the browser closes them at the fragment end — and
  deliberately not fixed blind, because re-nesting a screen nobody reported a
  problem with is how you cause the next fault.

### A STRAY BRACE IN THE STYLESHEET IS SILENT, AND IT REACHED A REAL CONSOLE

`test/style-structure.test.js`. Reported as *"why is it loading like this?"* —
Tonight's six pack slots showing as ONE on a laptop, twice, with the markup
and the JavaScript both correct and six `<button>`s in the DOM.

- **A SCRIPTED EDIT WITH `s.index(needle)` AND NO START OFFSET DUPLICATES
  TEXT.** It matched an earlier occurrence than intended, so
  `s[:start] + new + s[end:]` with `end` BEFORE `start` copied everything
  between them — including the closing brace of a `@media (max-width: 560px)`
  block. **Always pass the start offset**, and check the brace balance after
  any scripted CSS edit.
- **THE MEDIA QUERY THEN ENDED EARLY and its phone-only rule applied at every
  width** — `.lb-drop ~ .lb-drop { display: none }`, which hides every empty
  pack slot after the first. CSS throws nothing for this. It re-scopes
  silently from the stray brace onwards.
- **AND THE OLD BLOCK SURVIVED AFTER THE NEW ONE, so the old rules won.** A
  duplicated region does not just add text; it puts a second copy LATER in the
  cascade.
- **THE VERIFICATION FAILED IN THE MOST INSTRUCTIVE WAY: it counted `.lb-tile`
  ELEMENTS, which `display: none` elements still are.** Six came back every
  time while the screen showed one. **Measure `getClientRects()`, not
  `querySelectorAll().length`** — "it is in the document" and "somebody can
  see it" are different questions, and this repo has now been bitten by that
  distinction three times (the arcade board nobody drew, the publish route
  nobody called, this).
- `browser-parses.test.js` catches a JS file that will not parse; nothing
  caught a stylesheet that parses fine and means something else. Now something
  does — brace balance, no nested `@media`, and the escaped rule named
  explicitly. Verified by reintroducing both faults.

### THREE WAYS TO PLAY A NIGHT — individual, they pick, dealt at random

`src/teams.js`, `state.teamMode`, `night.playing` on the console. Asked for:
*"individual, team random and team assigned — there may be some nights where
people play as a team and other nights it's just more fun to be random."*

- **`teamPlay` STAYS A BOOLEAN AND STAYS THE GATE.** Six places in the engine
  read it and every one means "is this a team night", which is true of both
  team modes; a second value would have touched all six for a question none of
  them asks. The mode lives beside it in `state.teamMode`, both set from ONE
  choice at launch, so **a solo night takes the path it always took** — and
  `pub-unchanged` still says IDENTICAL.
- **ONE FIELD ON THE CONSOLE (`night.playing`)**, with `teamPlay`/`teamMode`
  derived at the moment of sending. Two copies on the browser side is how a
  dropdown and a launch come to disagree.
- **DEALT AT JOIN, AND NOBODY IS EVER MOVED.** Re-dealing mid-night would take
  a score away from the people somebody has been sitting with; re-dealing at
  kick-off would mean the team you were told at the door is not the one you
  end on. It also survives a restart for free.
- **THE TEAMS GROW WITH THE ROOM** — smallest team wins, **ties broken at
  RANDOM** so the deal is not just a queue and two friends joining together
  are not reliably put together. Four to a team (a pub table), six teams max
  (a readable board). Constants with a note, not settings.
- **A TEAM OF ONE IS NOT UNFAIR, which is why the lopsided moment is allowed.**
  Scores are AVERAGED, so a lone player is on the same scale as a four. Without
  averaging this dealing would need a shuffle at kick-off, and a shuffle would
  break the rule above it.
- **A DEALT TEAM CANNOT BE SWAPPED** — `joinTeam` refuses outright in random
  mode. The phone draws no picker, and the first thing two friends would do is
  find each other again.
- **THE LABELS NAME THE CHOICE, NOT THE MECHANISM.** They read *"One phone
  each"* and *"Teams — several phones, scores averaged"*, which describes the
  engine; from the player's side the question is who you are playing WITH.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### THE BAND ABOVE LAUNCH IS KEPT CLEAR, and one row holds the night

*"That space between packs and launch button needs to be clear, space is at a
premium."* Nothing sits between the running order and Launch now, by rule.
What was there and where it went:

- **The break strip moved ABOVE the tiles.** It describes the gaps between
  them either way, and above it does not stand between the order and the one
  filled gradient on the panel.
- **The pack settings row only exists when it HOLDS a control** — a bingo pack
  picked. Every quiz night carried a labelled row above Launch containing one
  caption and nothing else. That is not the present-and-inert rule being
  broken: that rule is about a control coming and going as you work, and Card
  and Prizes already do not exist for a quiz pack.
- **The four-fact info line is gone, and the host was right about why** —
  *"this is all venue settings stuff that can be done in the workshop?"* The
  venue name duplicated the picker, *one-off* is `usualNight` on the venue
  record, and *start when you like* is the app reporting a blank diary field.
  **The prizes were the real exception** — read at launch onto the winner's
  voucher — so what survives is the WARNING only: a venue with no prize on it,
  said in the head, silent whenever there is nothing wrong.
- **DOORS, THE LIVE LINE AND UNLAUNCH ALL LIVE IN THE HEAD.** Asked for
  directly. `p0:lobby` is the one break that belongs up there and that is what
  makes the split coherent rather than merely tidier: it is the gap BEFORE the
  night starts, so it is a fact about the evening like the venue. Every other
  break — including a later part's own lobby — happens inside the running
  order and stays beside it. **The setter still opens in the strip**, so a
  break is edited in one place wherever its chip was tapped.
- **ONE HEIGHT FOR EVERY CONTROL IN THAT ROW — 44px, the touch floor.** The
  head held four heights before. **44 because it is the FLOOR, not because it
  is the biggest**: levelling down would have broken the one control a
  touch-target audit had already fixed. **The shapes still differ** — a field
  for actions, a pill for the switch and the fold — because the radius encodes
  what a control IS, and flattening that would undo the GUI rules.
- **A DESTRUCTIVE BUTTON KEEPS THE FACE AND THE 2px EDGE.** The one global
  `.danger` rule uses the `border` SHORTHAND, which overwrote all four sides
  and left Unlaunch and Delete structurally different objects from the buttons
  beside them — **the shorthand-beats-longhand trap, hit inside the rule that
  calls itself "the one rule"**. Outlined-never-filled is about FILL and is
  untouched.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### THE BAR'S OWN TIDY-UP — and a drag with no tap is a broken control

Reported off a screenshot: *"starting to look a bit messy — can we utilise
space where possible."* Four placements and one real bug:

- **A CONTROL SITS WITH WHAT IT ACTS ON.** *Stop* was at the far right of a
  1900px bar, an inch from the line naming what it would stop, so it read as a
  control over the whole panel. It is **Unlaunch** now — the word pairs with
  Launch without being told — and it sits 10px from that sentence.
- **KEEPING A NIGHT IS A NIGHT-LEVEL QUESTION, so it moved into the head**
  beside the venue, which is where the other three live. **The label has to
  outrank the adjacency**: a show never keeps the venue, so "Save" alone next
  to a venue picker would say the opposite of what it does — the words stay
  *"for another night"*.
- **THE REASON A CONTROL IS OFF GOES ON THE CONTROL.** *"Nothing in Tonight
  to keep yet"* was a sentence about the app's own state floating beside a
  greyed button. The button says **"Add a pack to save this night"**, the
  shape Launch already uses.
- **A BIGGER TARGET IS NOT THE SAME AS A HITTABLE ONE.** The pack tile's ×
  went from ~18px to 30px and the pack NAME then painted over it —
  `.lb-tile-head` carries `z-index: 1` and comes later in the DOM, so half the
  button silently did nothing. It needs `z-index` AND `padding-right` on the
  title.
- **EVERY DRAG NEEDS ITS TAP, and a shelf round dot never had one.** Reported
  as *"the drag and drop feature per round doesn't seem to be functional"* —
  the drag worked and was proved with real mouse events, but the dot carried
  `mousedown`, `dragstart` and `dragend` and **no `click` at all**. So the
  first thing anybody tries did nothing, and on a touchscreen there was no way
  in whatsoever, because HTML5 drag never fires on touch. `addRoundToTonight()`
  is that tap, through the same path as the drop.
- **FIVE SETTINGS ON ONE ROW ABOVE 1150px, LABELS ABOVE THEIR CONTROLS.** Side
  by side at a fifth of the bar, two of the five labels wrapped and three did
  not — five cells of five different shapes, which was most of the mess.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### WHAT HAPPENS IN THE GAPS — a break plan, per gap in the night

`public/assets/break-parts.js` (the model, imported by the SERVER like
`show-parts.js`), `console-breaks.js` (the dials), `state.breakPlan`,
`view.gap` on a phone, `view.breakAdverts` on the projector. Asked for
directly: *"the while they wait section needs to assign games and/or photo
upload per break… and the screen itself needs to be able to show ads as
well."*

- **TWO OF THE THREE THINGS ASKED FOR ALREADY EXISTED.** Photos always ran at
  every break (`PHOTO_PHASES`), so that half is making something SWITCHABLE
  rather than adding it; the game ran at the lobby only. **An advert only ever
  went up because somebody pressed a button** — that is the genuinely new
  capability, and the one that pays.
- **A BREAK IS A PLACE, NOT A NUMBER** — `p0:lobby`, `p1:r2`. Derived from the
  part index and round index already on the state, so nothing has to be kept
  in step and a restart resolves it for free. **A stored list of five breaks
  would be wrong the first time a round was switched off**, silently, with
  every row still looking real.
- **THE PLAN IS SPARSE AND EMPTY MEANS "AS IT WAS".** `DEFAULTS` reproduces
  the app exactly as it behaved before breaks existed — `cleanPlan()` drops
  anything that only restates one, which is what lets `pub-unchanged.mjs`
  still say IDENTICAL.
- **THE THREE LOBBY-ONLY GUARDS CHANGED SUBJECT, THEY DID NOT GO AWAY.** The
  seed in the payload and the refusal at the score route now read "a break
  that offers a game"; outside a break `breakNow()` is null, so **a question
  is as unreachable as it ever was** and there is a test saying so. **The
  arcade BOARD deliberately stayed lobby-only** — it draws inside the white QR
  panel, and a round board already carries the board the room looked up for.
- **THE FINAL IS NOT A BREAK, AND THE LOBBY HAS NO SCREEN CHOICE.** A plan
  that could hide the winner would take away the moment the night is built
  towards; the lobby's screen belongs to the join code, which nothing may dim.
- **SCORES FIRST, THEN THE SLIDES ROTATE** — the host's own choice: the room
  gets what it looked up for, and the venue gets the screen once it has.
  **THE PROJECTOR ROTATES, NOT THE ENGINE** — an engine timer would push state
  to every phone on each change and need restoring mid-cycle. **The teardown
  lives in `draw()`**, where every card change passes, which is the lobby
  game's own expensive lesson applied before it could recur.
- **NOTHING IS A REAL ANSWER**, asked for by name — the round still names
  itself, because a projector with literally nothing on it reads as broken.
- **`listAdvertPacks()` RETURNS A SUMMARY, NOT THE PACK.** Its slides have no
  body, link or image; building a projector slide from them gives a heading
  over an empty card, and nothing throws. The third sighting of the
  picks-fields trap this month.

Full reasoning: **[`docs/console/launch-bar.md`](docs/console/launch-bar.md)**.

### THE GAPS ARE A DIAL ON THE PACK, NOT A STRIP UNDER IT

`gapDial()` / `gapsOfPart()` in `console-breaks.js`, the `In the gaps` picker
on the settings row. The strip of chips lasted a day: *"'doors' and 'after
round 1' both fill the same function, don't really need both"*, then *"it
could just be a symbol you click to cycle… and this would live in the bottom
right of the pack ONCE LOADED."*

- **THE DUPLICATION WAS REAL** — one `chip()`, one plan, one setter, drawn in
  two places and neither beside the thing it acted on. The label collision
  Sweep mode hunts, which nothing had caught.
- **A GAP IS NOT AT THE END OF A SLOT.** A two-round quiz owns the gap INSIDE
  it as well as the one at its end, so "the end of this slot" can only ever
  address a pack's LAST gap. A tile's corner owns **every gap that pack
  creates**, and one dial sets them together — stated, not hidden.
- **THE TILE'S SIZE DECIDED THE SHAPE, MEASURED FIRST**: 179 x 76, ticks 22px
  bottom-left, **58px clear** in the corner on a four-round pack. That is ONE
  44px control and never two — so the dial is the PHONES and the big screen
  became a night-level picker. **The plan on disk is unchanged**; the picker
  writes one `screen` to every gap that has one, and `pub-unchanged` still
  says IDENTICAL.
- **A DIAL IS SAFE HERE because every state is a real answer** — no invalid
  position to spin past — **and the order is a SCALE**: photos, game, both,
  nothing. A dial whose steps are not on a scale has to be memorised.
- **THE LIT EDGE HAD TO BE MADE HONEST** — `cleanPlan()` now runs on the way
  OUT of the dial too, or a gap cycled back to its default still claims it was
  changed.
- **DOORS KEEPS A DIAL because it is the one gap with no tile** — it happens
  before the first pack. Same control, word beside it, phone-only because the
  join code owns the lobby's screen.
- **THE ERA WORD MOVED 52px LEFT.** *A pack wears its own subject* put it in
  that corner deliberately, so this is two rules colliding: **the control wins
  and the decoration moves**, shifted rather than dropped.
- **A LOST `import` DREW A BAR WITH NO DIALS AND EVERY CHECK PASSED** — a
  scripted header rewrite ate `import { esc, node }`. Four swallowed
  `ReferenceError`s, `node --check` happy, 1,516 tests green. The same fault
  that shipped a broken Launch. **`test/imports-present.test.js`** now asserts
  every module imports the shared helpers it calls.
- **A TILE IS NOT A PART** — several quiz packs are welded into ONE quiz, so
  mapping a tile to a part gave tile 1 every gap in the night and tile 2 no
  dial at all. `gapsOfPack()` reads the part's `order`, where the gap after
  round *i* belongs to whichever pack contributed it.
- **THE SLOT NUMBER GOES WHEN A PACK LANDS IN IT** — it overlapped the title by
  18 x 8px, and on a full slot the ORDER is already visible from position. It
  stays on an EMPTY slot, where it is the whole label.
- **THE TILE IS 90px BECAUSE 30 + 44 DOES NOT FIT IN 76** — the × and the dial
  are both on the right edge; measured overlap was 28 x 12. Moving the × to
  the left puts "remove this" where the eye lands first, and moving the dial
  undoes what was asked for, so the tile grew instead. **On a phone the
  `is-pack` tiles keep that height and empty slots stay short.**
- **THE ERA WORD IS GONE FROM A TONIGHT TILE.** Shifting it left of the dial
  was tried and measured: it then overlapped the round ticks by 52 x 18. There
  is no third place, so the decoration goes and the wash plus the coloured
  edge carry the subject. It stays on the shelf CARD.
- **`.lb-tiles:has(.lb-doors-slot)` OUT-SPECIFIED THE PHONE RULE** — a class
  more specific than `.lb-tiles` beat the 560px layout, and 390 came out as
  four 50px columns with the dial wider than its tile. The specificity trap
  this file already records, wearing `:has()` instead of a `border` shorthand.
- **DOORS IS A MINI SLOT AT THE HEAD OF THE ROW** — *"a little mini pack slot
  at the start of the packs"*. The gap before the first pack, drawn where it
  happens; half width, no number, never a drop target. **The big screen is not
  offered there**: the lobby's projector is the join code and nothing may dim
  it, so that is a change to the protected surface rather than a control.
- **EVERY NIGHT SETTING IS ON ONE ROW, AND A BOX IS NEVER NARROWER THAN ITS
  OWN HEADING.** *"It's ok for the boxes to be wider than the headings but when
  the headings are wider than the boxes it looks messy."* Stacked, a cell is
  already as wide as the wider of the two — `justify-items: stretch` makes the
  BOX the wider one every time. **It does not undo *narrow shut, wide open***:
  the cell is still only as wide as the longer of the value and the word above
  it. Card and Prizes joined that row, so the separate bingo row is GONE, and
  both needed `data-short` — one option was 303px and pushed the row onto a
  second line on its own. **The reason a control is off went into the control**
  (*"Add a bingo game"*), because the caption beside it went with the row.
- **THE ROW SERVES ANY BINGO PACK IN TONIGHT, NOT ONLY A PICKED ONE.** Reported
  as *"added a bingo game and the bingo section is greyed out"* — it keyed off
  the PICKED tile, so with the quiz picked the app told him to add a thing that
  was already on screen. `bingoToSet()`: the picked pack when it is a bingo,
  otherwise the first one in the order. **The three WRITES had to move with the
  read**, or the row would show one pack's card and save it onto another.
- **📵 RATHER THAN A DOT for "nothing on the phones".** Asked outright — *"what
  does this mean? the . ?"* — which is the *clarity beats everything* test
  failing. The other three states are pictures; punctuation on a button reads
  as a control that failed to load.
- **THE PACK LIFTS FROM ITS GRIP; A ROUND LIFTS FROM ITS OWN SQUARE.** Reported
  as *"I still can't drag a round onto a fresh slot — it seems to default to
  dragging the entire pack"*, and that is literally what happened: an ordinary
  row's tick carried NO drag handlers, so the browser walked up to the nearest
  draggable ancestor. **A `draggable` child is what stops the walk.** The tile
  then refuses a `dragstart` that did not begin on `.lb-tile-head`, which is
  the smallest drag handle there is — no flag to arm and disarm, nothing left
  behind if a pointer is lost. The ordinary tile had no head at all and gained
  the same one the mixed row draws.
- **A `dropEffect` THE SOURCE DID NOT ALLOW KILLS THE DROP SILENTLY.** A pack
  card starts its drag `effectAllowed = 'copy'` and a round tick `'move'`; set
  the wrong one and the browser treats the target as REFUSING, so **no `drop`
  fires at all**. Hard-coding `'move'` in a handler serving both broke every
  pack drop onto a slot while rounds kept working. **A synthesised `DragEvent`
  does not enforce it** — `node scripts/drag-check.mjs` drives the real mouse,
  and is the only thing that can see this or the `preventDefault` rule.
- **THE SLOT YOU DROP ON IS THE SLOT IT GOES IN — for a whole PACK too.**
  Reported as *"I tried dragging the music bingo onto slot 2 and it populated
  on slot 4 instead"*. The target was never the problem: the slot lit up and
  accepted, and then `addBingoSlot()` appended and ignored the index it was
  handed. **The same fault the rounds had two days earlier, one function
  along.** `at` is honoured only when that slot is genuinely EMPTY — dropping
  onto a full tile appends rather than overwriting, because a slot you can
  destroy by letting go over it is a hazard, not a slot. **A drop that MISSES
  every square still means "the next free slot"**, which with holes in the row
  is the first hole rather than the end of the array.
- **A DESCRIPTOR IS NOT THE THING IT DESCRIBES.** *"Now I can't drag into
  slot 2 as an empty slot"*: `packDrag` is `{ id, kind }` and the empty slot's
  drop handed it on as the pack. With no `rounds`, `addQuizPackSlot()` gave
  the row back unchanged — **the slot lit, the drop was taken, nothing
  appeared.** A bingo slot needs only the id, so it read as quiz-only.
- **A KIND THAT DISAGREES WITH THE NIGHT'S OWN IS A MIXED NIGHT** — the test
  was `kind === 'bingo' || lbSlots`, so a quiz pack added to a bingo night
  went into `lbExtra`, whose ids `packOf()` resolves against `gameOf()` alone.
  It was never found again: `lbPacks()` filtered it out and the row kept
  showing one tile. **Nothing threw — the state was consistent and the READER
  could not resolve it.**
- **A PACK CARD ASKS WHETHER IT IS IN TONIGHT; IT IS NOT PAINTED AFTERWARDS.**
  `packIsInTonight()`, called by `packCard()` as it builds. `render()`
  assembles the page OFF the document, so `paintInTonight()` finds the
  PREVIOUS page's cards — **every tab change drew a shelf with no ghosting**,
  and the duplicate check then refused a drop the card said was free.
- **THE BREAK PLUMBING MOVED INTO `console-breaks.js`** rather than the line
  budget being raised a fifth time — `breakPlumbing({ night, segmentsNow,
  repaint })`, handed what it needs so the module stays a leaf. **Destructured
  ABOVE every reader**: a `const` in its temporal dead zone throws when the
  line RUNS, and the catch swallows it. **A moved body keeps the names of the
  home it left** — this one still called `paintOrder()`; see *Checks*.
- **A PACK TILE LIGHTS UP TOO — AND ONLY WHERE THE DROP WILL BE TAKEN.**
  `moveRoundToSlot()` refuses a bingo game or a DIFFERENT pack, so a tile that
  lit and then did nothing would be worse than one that never lit: it promised.
  A refusal also STOPS the event, or it bubbles to the row and the round lands
  somewhere the pointer never was. **The inset ring alone was invisible** next
  to the picked tile's own outline in the same colour — it takes a wash and a
  lift as well.
- **A FILLED MIXED TILE HAS TWO WIRINGS AND THEY RACED.** `wireSlotDrag` and
  `wireDropTarget` both set `drop-here`; the one registered LAST won, so a
  bingo tile lit for a round it would refuse. **One handler decides**
  (`takesRound()` in `wireDropTarget`) and the other stands down.
- **AN EMPTY SLOT TAKES A ROUND AND LIGHTS UP WHILE YOU ARE OVER IT.** Reported
  as *"it won't drag to another slot unless there is a pack there"* — two
  faults at once: an empty slot had no `dragover` of its own, so **nothing lit
  up** and an inert square reads as one that refuses; and `orderEl`'s drop
  APPENDS, so a round let go over slot 5 appeared in slot 2. `stopPropagation`
  on the slot's own handlers is what makes its answer the one that counts.
- **AND MY OWN TEST HAD MISSED IT** by dispatching `drop` directly — a browser
  fires no `drop` unless `dragover` called `preventDefault()`. Measure
  `defaultPrevented` on the dragover, not the outcome of a synthetic drop.
- **A CHILD'S `dragend` BUBBLES TO THE TILE, and the tile's removes the pack.**
  Dragging a round out took the whole pack with it — measured, it emptied
  Tonight. `if (ev.target !== tile) return;` — the `mousedown` trap one level
  up, and the round's own drag travels the SHELF channel so
  `moveRoundToSlot()` MOVES it rather than duplicating it.
- **A ROUND IS A ROUNDED SQUARE AT 28px, AND ITS HOVER LIFTS.** *"Square shaped
  with round edges… I need to see when mousing over them."* `--r-field` only
  reads as a square on a box with sides — at 22px it is nearly a circle. The
  old hover was `filter: brightness(1.25)`, which on a faint 22px dot is a
  change you cannot find. **A four-round pack wraps to two rows and that is
  fine** — the grid stretches every tile to the tallest, so none ends up out of
  line.

Full reasoning: **[`docs/console/launch-bar.md`](docs/console/launch-bar.md)**.

### FIVE DOORS: CONSOLE · WORKSHOP · POST GIG · COMMUNITY · MY ACCOUNT

`DOORS`, `navMenu()`, `doors` on every `TABS` entry. The first three name
MOMENTS of a night; **Community names the thing that SPANS nights**; **My
account names the one thing that is not a night at all**, so it stays on the
end rather than in the sequence.

**COMMUNITY IS THE FIFTH, and it holds THE PEOPLE — the league, the photos and
what the room voted for.** Asked for directly:
*"a fifth menu pill at the top entitled 'community', which is for things like
quiz leagues, and all the controls for that functionality will live there."*
A league belongs to the ROOM over a season rather than to the quizmaster on a
night, which is exactly why it fitted under none of the other four and had
been living as a block on a venue card — one venue at a time, behind the
Workshop door, found only by going looking. **Nothing new is collected**:
`src/league.js` has built these out of the archive all along and
`library.leagues` was already in the payload. `console-community.js` is a
PLACE to read them. **The bay answers "is anything running" and the tab
answers "who is winning"** — the same head/section split every other door has.
**Ungated door, gated tab** (`needs: FEATURES.LEAGUE`), so somebody can see
what they could buy; a door that vanishes sells nothing.

**AND THEN EVERYTHING ELSE ABOUT THE PLAYERS FOLLOWED, on 23 August 2026** —
*"photos can actually migrate to community as well now, and anything else to do
with the people who do the quizzing."* Three tabs: **Quiz league**, **Photos**,
**What they asked for**. Settled by asking, and each answer is a rule:

- **ORGANISED BY VENUE, because a venue IS a community.** The Tuesday crowd and
  the Thursday crowd are different people, a league is already per venue, and
  every page then happens to be something you can show one landlord.
- **THE PHOTOS MOVED AND PAST GIGS KEPT ITS GRID — that is not a duplicate.**
  The same pictures do two jobs: on Past gigs a photo is EVIDENCE, beside the
  headcount, the winner and the report; on Community it is the room itself.
  **What is not duplicated is the CODE** — the strip, the bin, the "Screen
  only" badge and the publish control are `nightPhotos()` in `console-gigs.js`,
  called from both, so the confirm wording and the safeguard have one
  definition. **The publish control keeps its safeguard for free**, because it
  is drawn UNDER the photographs it would publish wherever it is called.
- **A READ-ONLY SUMMARY MAY REPEAT; A QUEUE MAY NOT.** That is the line, and it
  decides both halves: the headcount is a summary, so it joins the league
  panel's head (the landlord's two questions, together) and still sits on a
  venue card and a Past gigs card, all from one server-side figure. **"What the
  room asked for" is a QUEUE — Yes keeps it, No bins it — so it MOVED off the
  Music Quiz tab rather than being copied**, leaving a one-line link that shows
  only when something is waiting.
- **A NIGHT'S PHOTOS ARE FETCHED WHEN THE NIGHT IS OPENED, never up front.** A
  photo list is a request per night; a wall that loaded twenty on arrival would
  spend a pub's wifi on pictures nobody asked to see.
- **`asksPanel({ whenEmpty })` — the same panel answers two pages.** Drawing
  NOTHING was right above the quiz generator and is wrong on a tab whose whole
  job is the list: a blank page reads as broken to the person checking whether
  the feature works. One optional argument, so the triage keeps one definition.
- **AND ONE POINT FOR EVERY NIGHT PLAYED, ON TOP OF THE BEST SIX.** Under
  best-six alone a seventh night outside your six is worth NOTHING, so a team
  finishing near the bottom stops gaining anything after six weeks — a
  retention hole in the feature built for retention. **THE LADDER THEREFORE
  PAYS NOTHING BELOW SEVENTH**: it used to floor at 1, and keeping that too
  would pay one point twice under two names. Eighth is still worth exactly 1,
  as the attendance point. A fortnight away costs 2 rather than 20.
- **A TEAM'S BEST SIX NIGHTS COUNT — a running total is not the league.**
  *"So there's incentive to come every week but also doesn't make it pointless
  to come if you had to miss 1-2 weeks for holiday."* A cumulative table
  punishes absence ABSOLUTELY: a fortnight away is twenty points nobody can
  make up, so the team works out the season is gone and stops coming — the
  retention argument this feature exists for, running backwards.
  **AND A PLAIN AVERAGE BREAKS THE OTHER HALF, which is why it was offered and
  not taken**: mean points per night puts a team that played ONCE AND WON above
  one that won five of ten. On a real archive it moved the team who missed two
  weeks from third and twelve behind to level at the top.
  **SUMMED, NOT DIVIDED, AND THE TWO ARE THE SAME TABLE**: dividing
  by a fixed six scales every number equally and changes no position, while
  dividing by nights PLAYED is the average again with its one-hit problem back.
  `COUNTING_NIGHTS = 6` is a constant with a note, like the season.
- **A NAME IS FILTERED AT THE DOOR, NEVER IN THE ROOM** — `clean-names.js`,
  off a live table with a racial slur ninth in it. The projector, the phones
  and the console are UNCHANGED and `cleanTeamName()` is untouched; only the
  public page and the report mask anything. **ON THE SERVER, so the word never
  reaches the wire** — hiding it in the browser is not hiding it. **MASKED,
  NEVER DROPPED** ("Name hidden"): dropping the row moves everybody up a place
  and lies about the season. Points and identity are untouched, so it is a
  VIEW, like the two-screens rule. **IT ERRS STRICT** — a false positive hides
  one name and the console says so; a false negative is a slur under his brand
  in public. **WHOLE WORDS FOR ORDINARY PROFANITY**, or it eats Scunthorpe and
  "assassin"; the SLUR list is matched AGAIN with the spaces stripped, which is
  what catches `n i g g a` — **never do that pass on the ordinary list.**
  **THE CONSOLE SHOWS THE REAL NAME AND MARKS IT**, or a name vanishes off a
  published table with no way to tell which.
- **AND A HUMAN OVERRULES THE LIST, IN BOTH DIRECTIONS** — *"so we're erring
  on the side of caution but I can override it."* A word list guesses at
  intent and the quizmaster was in the room. **BOTH directions, because it is
  wrong both ways**: it hides "The Pen Is Mightier" and publishes a spoonerism
  it cannot see. Keyed by `teamKey()`, so a ruling follows the team all season.
  **A RULING THAT ONLY RESTATES THE FILTER IS CLEARED, NOT STORED**, or a
  later change to the word list silently cannot reach that name — the gap
  dial's `cleanPlan()` rule again. **ONE CONTROL PER TABLE, FOLDED**, never a
  button per row: thirty toggles on a page whose job is being read is the
  clutter rule exactly. **THE ROW'S KEY TRAVELS WITH THE ROW** so the console
  can combine the filter's verdict with the rulings without a second copy of
  `teamKey()` in the browser — and the library stays free of the GitHub read.
- **THE LEAGUE IS EXPORTED TO TWO AUDIENCES AND THEY WANTED DIFFERENT THINGS**
  — *"can that be exported to the landlord and the quiz teams to view?"* The
  landlord wants EVIDENCE, so the season table joined the post-night report he
  already receives; the teams want the table on a WALL, so `/league` is a
  public page per quizmaster. Building one thing for both would have served
  neither.
  - **A REPORT SAYS WHAT THE ROOM SAW THAT NIGHT, not what is true today** —
    `leagueAfter()` winds the night list AND the season window back to that
    evening; a snapshot that has moved on is not evidence. One function, one
    clock argument, many questions.
  - **A PUBLIC PAGE IS A PUBLISH, PER VENUE, FAILING CLOSED** —
    `league-publish.js`, the gallery's shape exactly, in the private repo
    because `data/` is wiped on every deploy. **NAMES AND POINTS, NEVER
    FACES**: the fields are named on the way out rather than spread, or the
    next one added is a photograph on a public page.
  - **THE NEXT QUIZ DATE IS THE LOUDEST THING UNDER THE TABLE** — a team lying
    fourth wants to know when it can do something about it. It writes itself
    from the venue's usual night, like the comeback slide.
  - **AN ASYNC PAINT LOOKS WHERE THE THING IS, NOT WHERE IT WAS MADE.** The
    publish control queried the `DocumentFragment` it was built in, which
    `render()` had already emptied into the page — two tables drew with no
    control on them and nothing threw.

### EVERY DOOR'S BAY IS THE LAUNCH BAY'S SIZE

`--bay-h` in `style.css`, on `.doorhead > .panel.bench`, from 900px up. A hard
rule: *"the bay at the top ALWAYS has the same dimensions as the launch bay,
this must be consistent across sections."* It was 386px on the Console, 194 on
Workshop and Post gig, and whatever the data came to on Community — so the top
of the page changed shape on every door press, and under a fixed frame that
moves the tab column and everything below it.

- **THE VALUE IS THE LAUNCH BAR'S OWN OPEN PANEL HEIGHT, MEASURED** — the panel
  rather than the doorhead round it, which adds a margin. Two values, because
  the bar's settings row wraps below 1150px and the bar gets taller.
- **THE BAR ITSELF IS NOT GIVEN THE HEIGHT.** It is the REFERENCE, it folds to
  a line on purpose, and clipping the one panel on the protected launch path to
  a number in a stylesheet is not a trade worth making. `community-bay.mjs`
  asserts the two agree, so the bar growing fails a check rather than silently
  making every other door the wrong size.
- **BELOW 900px THERE IS NO RULE**, because there is no fixed frame — and the
  launch bar is 745px on a phone, which as a floor would be a screen of empty
  panel on every door.
- **A FIXED BOX IS WHAT LETS THE CONTENT STOP WORRYING.** A wall of any size
  and a league of any length SCROLL INSIDE IT, so nothing needs a row cap or an
  "and N more" line — which is the opposite of the answer `.night-strip` needed
  when the bay sized to its content.

### EVERY BAY IS A RAIL AND WHAT IT PICKED — `console-bay.js`

*"The way this is presented is perfect — content taking up the bulk to the
right, controls on the left. How can we utilise this for all of the
sections?"* `bayRail()` / `bayColumns()` / `bayHead()`, drawn by Workshop
(your packs), Post gig (your nights) and Community (venues, and the nights
with photographs).

- **THE CONSOLE DOOR IS THE EXCEPTION, DELIBERATELY.** Its bay is the launch
  bar — the protected surface, and the REFERENCE every other bay is sized
  against. It is not a list of things to look at, it is the one thing you came
  to do. **Do not give it a rail.**
- **ONE DEFINITION, because each door had already invented its own.** A pack
  tile you drag onto, a night you drag up, a venue you scroll to find: three
  answers to one question, which is the label collision this file keeps
  recording. The rail is the TAB COLUMN one region higher — same 190px, same
  stack, same lit left edge.
- **A RAIL PICKS; IT NEVER ACTS.** Nothing in it deletes, publishes or
  launches, so the worst a mis-tap does is show you something else.
- **COMPARTMENTALISED BY PUB, AND THE PUB FOLDS** — *"can this section be
  collapsible?"* **Group by the pub FIRST, then order within it**: printing the
  venue whenever it changed in date order drew "The Crown" twice with another
  pub between, which reads as two pubs of one name. **FOUR TO A GROUP, the rest
  named as being below** — the rail is the night you are thinking about; the
  tab body is the archive.
- **WHAT IS REMEMBERED WINS, ALWAYS — the first build had it the other way and
  the control was DEAD.** It FORCED a group open whenever it held the picked
  row, so once a night was open, pressing its heading set the flag, re-rendered
  and the override put it straight back: *"the section needs to collapse on
  click and expand on click"* — it did neither, and nothing threw. **A control
  that does nothing when pressed is worse than the problem it was avoiding**,
  so `holdsPicked` is a DEFAULT and the case it guarded is answered by SHOWING:
  a shut group holding what you are looking at wears the lit edge. **With
  nothing picked the FIRST group opens.** **The folds live in a module Map
  keyed by rail AND group** — the bay is rebuilt on every push, and "The Crown"
  is a group on two doors.
- **NO `title` ANYWHERE IN THE RAIL — the names WRAP to two lines instead.** A
  native tooltip is an unstyled box that lands over the rows beneath it, and it
  was only there because the name was ellipsised. The heading drops a rung in
  size too: level with the rows, the two read as one undivided list.
- **`.bay-rail > * { flex: 0 0 auto }` IS LOAD-BEARING.** A flex column shrinks
  its children when the content overflows, and the rail always overflows — it
  scrolls. The rows survived on `min-height: 44px`; the pub headings had no
  floor and rendered at **2px with their text in the DOM**, so a perfectly
  compartmentalised rail drew as one undivided list and nothing threw. Found by
  measuring `getClientRects()`, not by counting elements.
- **THE DRAGS SURVIVED because they were on the PANEL, not on a slot inside
  it** — and each empty state keeps its drop zone, since an empty rail still
  has to say what the panel is for.

### ONE PUB IS ONE LEAGUE — the id key and the typed name are the same room

`leaguesByVenue()` in `src/league.js`. Reported off a live console: **"The
Station Tap, Wokingham" in the rail twice**, 17 teams and 20. Pick the venue
off the Venues list some weeks and type it freehand others, and `venueKeyOf()`
files the nights under `id:xyz` and `the station tap` — **the season cut in
half**, every team's best-six from part of their record, on a public page.

- **THE SECOND PASS ALREADY EXISTED IN `venueHeadcounts()`**, with the same
  reasoning. Two readers of one archive disagreeing about what counts as one
  venue is the collision; the fix is the existing answer applied.
- **THIS REVERSES A PINNED TEST, deliberately.** The old one asserted the
  split, and the asymmetry was indefensible on its own terms: two freehand
  nights at one pub have always merged, so the old rule said that ADDING an id
  to one of them made the answer worse.
- **THE KEY KEPT IS THE `id:` ONE.** Whether a table is published and every
  ruling on a team name are stored against it, so folding onto the bare name
  would silently unpublish a table and drop every override.
- **THE COST, ACCEPTED KNOWINGLY:** two genuinely different pubs sharing a name
  merge. Already true on the name-only path, and why venue names carry a town.

### THE COMMUNITY BAY IS THE TAB YOU ARE ON — a wall, or a venue rail

`communityBench(active)` in `console-community.js`. *"Anything that loads
should load onto the top bar bit — the photos in a 3 x 6 grid, and quiz league
up there too."*

- **THE BOTTOM IS CONTROLS AND OPTIONS. IT NEVER DISPLAYS THE THING.** *"If a
  quiz league appears at the top it shouldn't be at the bottom — so you click
  the thing at the bottom to reveal it at the top."* The league tab draws no
  table and the Photos tab draws no photographs.
- **THE SAFEGUARDS SURVIVED THE MOVE, and that was the thing to check.** Nobody
  publishes a night or a table without having just looked at it — kept by
  drawing the button UNDER the thing. In a fixed frame the bay is on screen
  while the button is pressed, so it still is. The publish control is drawn
  ONLY for the night that is showing; a button on a row nobody has opened
  breaks it.
- **ONE PRESS PUTS IT IN THE BAY, THE NEXT TAKES IT OUT** — and *"when you
  click into a photo another click should go back again"*: wall → one night →
  one picture, each step reversed by pressing the same thing.
- **A PICTURE IS AN OVERLAY, NOT A REPLACEMENT — which keeps the wall's
  place.** *"It seems to reload the entire gallery at the top"*: nothing
  reloaded, the bay was REBUILT and a fresh element scrolls at 0. Opening one
  is a local DOM change, no render. **`renderKeepingPlace()` holds every
  scroller in the frame**, by class. **AND THE OVERLAY HANGS ON THE COLUMN,
  NEVER ON THE SCROLLING GRID INSIDE IT** — `inset: 0` anchors to the padding
  box, which in a scrolled container starts at the top of the CONTENT, so it
  drew exactly one scroll offset too high with thumbnails round it.
- **ONE REQUEST PER NIGHT, NOT TWO.** `nightPhotos()` fetches the pictures and
  the published flag together, so the control is BUILT in the bay and HUNG in
  the tab body — safe because `render()` evaluates the doorhead before the tab
  body.
- **THE WALL IS FETCHED ONCE PER PAGE LOAD AND STOPS ASKING** — a photo list is
  a request per night, so it walks the newest until eighteen are in hand and
  never past `WALL_NIGHTS`. Held in a module binding: the bay is rebuilt on
  every push, at a lobby every join.
- **`node scripts/community-bay.mjs` IS THE GUARD, and it measures GEOMETRY** —
  every door's bay against the launch bar's, that each has a rail whose
  headings are not squashed, what is left for the columns, whether the page
  scrolls, that no control is in the bay and no table or photo is at the
  bottom, and that pressing a rail button, a night and a picture each actually
  change what is drawn. Nothing in `npm test` can see any of it.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

- **A fact is on ACCOUNT, a switch is on SETTINGS, a price is in the SHOP** —
  or Settings becomes a bin.
- **THE SHOP SELLS PACKS AND TIERS IN ONE ROOM**, both games in one grid,
  because there you are shopping rather than launching. **It left the pack
  shelf**, which put a till at the bottom of a working page.
- **HELP KEEPS ITS OWN TAB, NO `needs`, LAST**, and the door is ungated: it is
  where you go when what is wrong is your subscription.

### A PAGE SCROLLS. THE PROJECTOR IS THE ONE THAT DOES NOT

`body { overflow: auto }`, with `body.screen { overflow: hidden }` naming the
exception. It was the other way round for two years and **Terms, Privacy,
Refunds and the sign-up form could not be scrolled at all** — 2,528px of terms
in a 900px window, and a real wheel moved nothing.

- **`body`'s overflow PROPAGATES TO THE VIEWPORT** when `html` is `visible`, so
  `hidden` there does not clip a box, it switches off the document. **A default
  six pages must escape is how two of them come to be missed** — name the
  exception instead.
- **A PROGRAMMATIC SCROLL IS NOT A SCROLL.** `scrollTo(0, 220)` succeeds on a
  hidden viewport and `scrollY` reads back 220, so a check written that way
  reports a page scrolling while a finger does nothing. **Turn the real wheel**
  — `node scripts/pages-scroll.mjs`, which asserts the projector is PINNED
  rather than merely still.
- **THE PROJECTOR MUST NEVER GAIN IT**: a stray scroll in a dark pub takes the
  question off the top of the room's screen.

### CAPITALS ARE FOR EMPHASIS, NOT FOR LABELLING

Set by the host on 14 August 2026, and it is a BRAND decision rather than a
taste one: *"the way I'm building this app, it needs to be as soft and
friendly as possible… some people interpret capital letters as shouting."*

**A heading is told apart by BRIGHTNESS, not by being shouted.** Full `--ink`
against `--ink-dim` body text, one rung up the ladder, heavy. Capitals plus
dim grey was doing that job with the two weakest tools available — and the
tell was what the headings actually said: *"Nothing here is being saved
permanently"* is a sentence, and a sentence in capitals is somebody raising
their voice at you about your own backups.

**Where something genuinely IS the emphasis, capitals are right and stay** —
his own example, and he is correct: *"tonight's winner, I think, is all
capitals, and that's totally fine."* The three that keep them:

- **the PROJECTOR**, where every rule is sized in `vh`. "WINNER" in gold at
  3vh with half an em of tracking, read from the back of a dark pub, is a
  title card and nobody experiences it as a raised voice;
- **the option letters A–F and the alphabet keyboard**, which have no choice;
- **small one-word BADGES** — BRONZE, GOLD, PAID, YOURS. A four-letter pill
  is a shape you recognise rather than a word you read, and those already
  carry their meaning in colour, which is the substitute being asked for.

**The test is whether the capitals are doing the emphasising or the
labelling.** "Tonight" at the top of a panel is a label and does not need
them; the name of the team that just won a quiz in front of a room is the
emphasis and does.

Set deliberately on 12 August 2026, and they outrank preference — including
his own. His framing: *"I have no ego whatsoever about this being my app, my
rules — if I have to make changes to make the app as good as possible for the
customers I will."*

**That sentence is load-bearing.** It means a proposal of his that hurts
clarity should be argued with rather than built, and that "the host asked for
it" is not on its own a reason. He would rather be told.

Four rules, in order:

### 1. Clarity beats everything

If a control needs explaining, the control is wrong. If two things on one
screen use the same word for different sets, one of them is renamed. A
quizmaster ten minutes before a gig, in a dark pub, on their phone, should
never have to work anything out.

### 2. As little clutter as possible

**A control nobody uses is clutter, even a good one.** Every switch, filter,
badge and note has to earn the pixels — and "it might be handy" is not
earning them. When in doubt, leave it out and wait for somebody to miss it.

This is the rule that decides most arguments about adding something, and it
cuts against the instinct to be helpful: a page with an answer to every
question is a page nobody can scan.

### 3. Ease of use

The common job is the fast one. On a pack tab that is *find tonight's pack and
press Launch* — not browsing, not tidying, not comparing. Anything that makes
the common job slower to make a rare job easier is the wrong way round.

### 4. Build what helps a quizmaster SELL

The one that sets priorities rather than settling arguments. This app has two
kinds of feature: things that run a night, and things that win the next
booking. The second kind is the differentiator against a generic quiz app, and
it is what somebody is really buying.

It promotes, in order:

- **Past gigs** — the evidence somebody shows a venue. Already built and
  currently thin: it should carry the venue, the numbers and the photos.
- **A night as a real object, with a venue on it.** Nothing else on this list
  works properly without it. See the terminology section in TODO.md.
- **Advert slides** — the quizmaster's own revenue, and the reason a venue
  books them over somebody cheaper.
- **Invoicing** — getting paid without leaving the car park.

And it demotes anything that only makes the app cleverer.

### The fifth constraint: MONDAY, and what a feature actually costs

**He runs three businesses and has one admin day a week.** Monday is when the
inbox is read, the replies go out, the topical pack is generated and read
through, and app changes get made.

**It is a boundary that BUYS the turnaround rather than costing it** — *"it's
not a function of laziness. It's a function of wanting to be as good as
possible."* What makes it keepable is not working harder on Monday; it is
Monday not being swamped.

So the rule that falls out, and it is the one to apply when weighing anything
new:

> **A feature's real price is the ADMIN IT CREATES ON A MONDAY, not the code it
> takes to write.**

That is the thread through a lot of what is already built — the draft-reply
button, the inbox that gets shorter when you answer something, the queue
position on pack requests, the been-opened receipt, the "one open request at a
time" limit, the refusal to add an email service. **Every one is a Monday-load
reducer.**

Two things follow:

- **Anything needing DAILY attention is a bad fit for this business**, however
  good the idea. The weekly topical pack fits because its cadence already IS
  Monday's. An emergency support channel does not — see the suggestion-box
  notes, where that was argued and turned down.
- **A feature that generates a QUEUE somebody has to work is expensive; one
  that serves itself is cheap.** When a new proposal creates a pile, the first
  question is whether the pile can be made to shrink on its own.

### And the same rule points at the QUIZMASTER'S admin, not only the owner's

Stated by the host on 14 August 2026, and it is the generalisation of
everything above: *"semi-automated is always going to be better, because they
could just read through, click send, read through, click send. It takes the
admin burden off. It's essentially applying what I'm doing from within the app
to them as a quizmaster on their side as well."*

**Every Monday-load reducer in this file was built for the OWNER. A quizmaster
has the identical problem and nobody has built it for them.** They finish at
half eleven and owe a venue an invoice, a thank-you and a nudge about next
month — and none of it happens, because the blank page is the expensive part
rather than the sending.

**THE SHAPE IS ALWAYS THE SAME AND IT IS THE ONE `reply-draft.js` ALREADY
USES: the app prepares, the human reads, the human sends.** Four reasons:

- **The blank page is where the time goes**, not the pressing of send.
- **The human stays accountable for what goes out**, so nothing goes publicly
  wrong in their name — the whole reason `reply-draft.js` drafts and never
  sends.
- **It needs no email service**: the share sheet and the clipboard are already
  how invoices leave this app.
- **It is dual-purpose**, which is the guard rail below.

**Do not build a send that skips the reading.** An invoice or a thank-you that
goes out unread is the one that names the wrong headcount, or bills a night
that was cancelled — and it lands on the relationship the quizmaster is being
paid to keep.

**AND THE GUARD RAIL, which keeps the rule honest: every one of those is
dual-purpose, and an admin reducer that makes the customer's experience worse
is the WRONG reducer.** They exist to make the admin burden as small as
possible *and* to give the customer the most value, not one at the expense of
the other. Each is two-ended: the draft reply means a thirty-second answer AND
that they get an answer at all; the queue position means not being chased AND
knowing when; "one open at a time" protects the time AND replaces a silent
refusal with a stated rule.

**The load comes down by making the work FASTER AND MORE CERTAIN, never by
doing less of it.** That is the line between this and a software company nobody
can get hold of.

---

## The two shelves have names now: **My packs** and **Quizporium packs**

A quizmaster sees two libraries and they were called things that described
where the code keeps them rather than whose they are: "Your saved quizzes"
above, "The rest of the catalogue" below, and the way into the editor was
"The pack editor" — the name of a TOOL, on a link somebody presses when they
want to write something.

- **My packs** — the ones they write. The panel, the link into the editor and
  the button on every pack tab all say it, so the concept has one name.
- **Quizporium packs** — the ones written for them and sold. Says who wrote it
  and therefore why it costs money, which "the catalogue" never did.

The grid on a pack tab is everything you can RUN tonight — your own packs and
the Quizporium ones you hold, mixed. **What you do NOT hold is not on it**: the
shop is its own tab, so a padlocked card can never appear among the ones you
are choosing between ten minutes before a gig.

## House style for labels: say what it is, then one line

The rule, and it applies to every blurb, panel note, tab description and
feature row in the app:

> **A title that names the thing, and one short line that finishes the sentence
> "this gives me…" in a breath. Anything longer needs a reason.**

It came from looking at the ladder: fourteen features, each with two or three
sentences under it, is a wall — and a wall gets scrolled past, so the page
whose entire job is to say what you get was saying nothing at all. The same
had happened to the account page, the suggestion box and the own-packs panel,
each of which had grown an explanation of itself.

**"Invoicing — bill a venue before you leave the car park"** is the shape.
Not *"Bill for a night before you have left the car park, with your own
details and the venue's kept from last time, and a PDF you can send from your
phone"*, which is three facts nobody asked for yet.

Three things fall out of it, and they are what make it a rule rather than a
preference:

- **If the line will not fit, the NAME is wrong.** A feature needing two
  sentences to be understood is usually one that has not been named properly —
  "Your calendar" needs no explaining, "Marketing" needs a paragraph, which is
  the tell.
- **The detail goes in an FAQ, not on the control.** That is written up in
  TODO.md and is the same content a sales page needs, so it gets written once
  rather than scattered as helpful paragraphs next to switches.
- **The exceptions are warnings and money.** "Your own packs are not being
  backed up", the lapsed-subscription note, the launch-over-a-live-game
  warning: these are read once, at a moment that matters, and being short
  there costs somebody something real. Everything else is furniture.

**"DO IT OVER THERE" MUST BE A LINK TO THERE** — `goTo()`. Naming another tab
and leaving somebody to find it is a control that needs explaining, split over
two screens. **EMPTY STATES ARE WHERE IT HAPPENS.**

**A control that needs a paragraph is a design problem, not a copy problem.**
When the urge to explain arrives, the first question is whether the thing
itself is wrong.

---

## Where the reasoning lives

**A THIRD SPLIT ON 15 AUGUST 2026, and this time with a test on it.** The
decisions TABLE alone was 43,034 bytes, a quarter of everything loaded before
any work could start; it moved whole to
**[`docs/decisions.md`](docs/decisions.md)**, leaving every decision NAME and
every sentence that FORBIDS something, verbatim.

**A WRITTEN RULE TO KEEP THIS FILE SHORT HAS NOW FAILED TWICE**, so
`test/claude-md-budget.test.js` asserts the byte count, that every `docs/` link
resolves, and that no decision exists in the doc without being named here.
**Pay for a new rule by trimming an old one to its prohibition** before raising
the budget; the diff will then say which you did. **And the index below names
only what is NOT already a heading here** — 27 lines restated a section this
file carries, with its own *Full reasoning* link at the foot of it.

**And a mechanical split is only safe where the boundary is STRUCTURAL.** Moving
table rows worked — a row is a row. The same script pointed at prose, keeping
"the heading and the first paragraph", quietly threw away the Owner/Parent/Child
table and every rule under the lobby-games heading: in this file the first
paragraph is often the CONTEXT and the rule is below it. **If more has to come
out, move whole named sections by hand and read what is left.**

**Every RULE is in this file. The WHY is in `docs/`.** Split on 14 August 2026
because this file had reached ~90,000 tokens and loaded in full at the start of
every session, and **again on 15 August 2026** the same way, having grown back
to ~50,000 as each new feature landed with its full reasoning inline.

Nothing was deleted and nothing was summarised — whole sections moved
verbatim, by line number, so nothing was retyped and nothing could be quietly
reworded on the way through. **Each one left its RULE behind, plus a link.**
Open the one you are touching; do not read them all.

**[`docs/engine.md`](docs/engine.md)** — phases, scoring, and what each screen is told

- Stopping a quiz early
- Leaving the app mid-question
- How many people can play

**[`docs/screens.md`](docs/screens.md)** — the projector, the phone, the moments on them

- The rules slide
- The join code is on more than the lobby
- The countdown before kick-off
- A mis-tap must not reveal an answer
- The fastest finger gets their face on the projector
- Looks — dressing a night up

**[`docs/console.md`](docs/console.md)** — launching a night and driving it,
plus **[`docs/console/launch-bar.md`](docs/console/launch-bar.md)**, which is
the launch bar's own half: Tonight, the running order, the pack tiles, the
settings row and the break dials, and
**[`docs/console/drag.md`](docs/console/drag.md)**, the drags. Both split off
when the file above them crossed its 100,000-byte cap. **Read the second
before touching a drag handler.**

- A launch must say what it is about to destroy
- The restart notice, and the one state that made it a lie
- TONIGHT — one launch section, and it PINS WHERE IT ALREADY IS on a drag
- FIVE DOORS, and why Community is the fifth
- WHAT MOVES TO COMMUNITY — a summary may repeat, a queue may not
- A CONTROL IS PRESENT AND INERT, NEVER ABSENT

**[`docs/gigs.md`](docs/gigs.md)** — venues, prizes, the diary, past nights,
getting paid; **[`docs/gigs/photos.md`](docs/gigs/photos.md)** is the
photographs' own half, split off at the 100,000-byte cap.

- The winner's prize, on their phone
- The diary — a calendar that maintains itself
- Past gigs — the record of somebody's work, and who may take it away
- Invoicing
- Getting paid: what you have not billed, and who has not paid
- THE LEAGUE, EXPORTED — evidence for the landlord, a wall for the teams
- **THE GALLERY READS THE OWNER'S OWN QUIZMASTER ROOM, never `HOUSE`** — photos
  are filed per room, and reading the wrong one showed a full night as an empty
  page. A deleted photo leaves the repo but NOT git history — never imply
  otherwise.
- AND THE PREVIEW DID NOT WORK ON THE HOST KEY
- THE GALLERY ONLY HOLDS WHAT LOOKED LIKE A CAMERA TOOK IT — **tested now,
  because it fails silently**: `camera` defaults FALSE, and it never keeps a
  photo off the projector
- **A LAMP PER PHOTO SAYS WHETHER IT IS ON THE GALLERY, AND IT IS A SWITCH** —
  *"an on off button with green for on and red for off, no text needed but it
  must be clickable."* **NO WORDS, and eighteen of them is the argument**: a
  label repeated across a grid becomes furniture; a colour is read at a glance.
  **FILLED, which is not a break of outlined-never-filled** — a lamp, not a
  button that destroys, and with no text the fill IS the message. **So `title`
  and `aria-label` are load-bearing**, the 18px dot gets a 44px hit area from a
  `::after`, and `.cphoto`'s own open must ignore a press on it. **It REPLACED
  the grey "Screen only" badge** — two badges saying overlapping things is a
  label collision. **`showsOnGallery()` is the ONE decision and all FOUR
  readers ask it** — the night LIST, a night's page, the single-photo route and
  this lamp — or a photo is on a page the console swears is private. **A ruling
  that only restates the guess is CLEARED, not stored**
- **THE COUNT AND THE PAGE ARE ONE QUESTION — `galleryPhotosOf()`.** The night
  list counted on the filename alone while the page it counted for asked the
  ruling too, so one photo switched off said *"12 photos"* over a page opening
  on 11. **The guard sliced from `/api/gallery/` — with the slash, the night's
  PAGE** — so the list was never a reader it checked. **AND WITH THE FAULT PUT
  BACK IT STILL PASSED: it had matched the COMMENT explaining the fix.** A
  source check strips comments first, or it goes green the better a file is
  documented
- **IT FLIPS NOW AND SAVES LATER** — *"the 1-2 second load on clicking
  green/red is annoying."* The colour is the local truth and `saved` is the
  server's, so a failed write puts the lamp BACK and says why on the count
  line — never an `alert` for something that happened in the background, and
  never a silent revert. **It settles before it sends** (600ms): two taps that
  end where they started write nothing at all. **AND EVERY GALLERY WRITE GOES
  THROUGH ONE PROMISE CHAIN** — they all rewrite the same `published.json`
  against a sha, so three at once is a 409 at best and the last one home
  quietly undoing the other two at worst
- **THE LEAGUE BAY IS A VENUE THAT FOLDS INTO ITS NIGHTS** — *"the summary is
  what displays when you click venue, and then you can click each night to see
  who won."* **The pub's own row is `The table`, INSIDE the fold, never the
  heading** — a heading that both folds and picks is one control doing two
  jobs. **A night row is the DATE and nothing else** (*"save space here by just
  putting the dates"*): *Won by …* under it wrapped to two lines on a long team
  name, so four nights filled the bay — and the winner is the first row of the
  night, one press away. **`evenings` rides in the payload, capped at
  `NIGHT_ROWS`**, built where `leagueTable()` already has the evening's order —
  **and it carries the POINTS**, so the browser needs no second copy of the
  ladder. **A board with no `position` scores nobody**, and it fails quietly: a
  night view with headers and an empty body
- **`node()` KEEPS THE FIRST ELEMENT AND DROPS THE REST, SILENTLY** — it had
  cost the gallery's *"All nights"* link and My account's whole list of sent
  suggestions. A grep cannot find these (nested template literals), so `node()`
  now `console.error`s when it drops one.
- **A VENUE HAS ITS OWN ADDRESS** — *"URLs conveniently reachable, so something
  like quizporium.co.uk/station-tap-wokingham/gallery/20-august and
  /station-tap-wokingham/quiz-league."* `public/assets/slugs.js`, shared by the
  server and the page like `schemes.js`, because two implementations of one
  slug is a link that works in the browser and 404s on the server. **DERIVED,
  never stored** — so a rename changes the address rather than leaving a stale
  one that lies. **The SAME FILE is served**; the page reads its own path.
  **A ONE-SEGMENT PREFIX AT THE ROOT IS A CATCH-ALL AND THE FIRST VERSION ATE
  `/api/gallery`** — two segments, the second one `gallery`. Naming the second
  segment is not enough: `RESERVED` refuses the first, and
  `test/slugs.test.js` walks `server.js` for every literal top-level route so a
  route added next year cannot be shadowed. It found six I had missed.
  **`ownAddress` on `/api/me` says whether the pretty form works** — the server
  knows which room the public pages fall back to; `role === 'owner'` in the
  browser was wrong in BOTH directions. **An address is not a key**: it names a
  venue, and the league switch and published list still decide whether that
  venue has a page at all

- **A LEAGUE IS A THING YOU RUN, AND IT IS OFF UNTIL SOMEBODY SAYS SO** —
  *"quiz leagues should be turn on and offable… it might be misleading if this
  app just had that as standard even in venues that don't have a quiz league."*
  **The table is ARITHMETIC; a league is a DECISION** — every venue with two
  filed nights has a table, and printing one in the report of a pub that never
  mentioned a league is the app asserting something about somebody else's
  night. **It gates what LEAVES and nothing the quizmaster sees**: the console
  draws every table either way. **Switching it off takes the public page down
  with it**, or the app disagrees with itself in public. **The controls under
  it are ABSENT, not greyed** — the one deliberate exception to *present and
  inert*, because publishing a league at a pub that runs none is not a disabled
  action, it is a question that does not arise. **The report asks under BOTH
  venue keys** (`leagueRunsAt()`), like every other reader of that split
- **THE QUIZMASTER ADDS THEIR OWN ROOM PHOTOS** — the room's camera is sixty
  phones pointed at each other and none at the ROOM, which is the one shot that
  sells the night. `POST /api/past-photo/<night>`, **filed against the night in
  the URL and never against today** — the live store dates a picture by the
  clock, so a Friday upload files a Thursday quiz under Friday.
  **Camera-eligible by definition** (no `-picked`): these ARE the promo shots.
  Scaled in the browser, `square: false` — a room is a room. **A POST written
  beside GETs is the 404 this repo already shipped once**, so the test asserts
  against the 404, not the 400

**[`docs/lobby-games.md`](docs/lobby-games.md)** — what a phone does while the room fills up

- MAZE MOUTH — THE LOBBY GAME, AND IT IS NEVER CALLED PAC-MAN
- RALLY — the bingo night's game, and it is not called Pong
- TAILBACK — a tail that grows, and the first game behind the picker
- QUICK DRAW — a shooting gallery, and the third answer to one fairness problem
- SOUND — synthesised, the host's to switch off, and never on a timer
- THE PICKER, AND WHAT A TIER ACTUALLY BUYS

**[`docs/accounts.md`](docs/accounts.md)** — hats, tiers, rooms, gates, own packs

- My account — and the line that page is built along
- Accounts, and who is allowed to do what
- Read-only packs, and the other half of that

**[`docs/generation.md`](docs/generation.md)** — writing quizzes, checking them, what they cost

- Generated questions are checked, not trusted

**[`docs/owner.md`](docs/owner.md)** — the business — five tabs

- The owner page — five questions, five tabs

**[`docs/branding.md`](docs/branding.md)** — the name on it, and whose colours it wears

- The name on it, and whose colours it wears

**[`docs/deployment.md`](docs/deployment.md)** — what the host has, and what that blocks

**[`docs/modes.md`](docs/modes.md)** — GSD mode and Sweep mode in full. **Open
it when he types one of them**, not before.

**[`docs/checks.md`](docs/checks.md)** — what the checks are for, and the four
separate faults that let one guard report a clean run it had not earned.

- Things the host does not have, and what that blocks

Also: **[`docs/artwork.md`](docs/artwork.md)** — the shared portrait library
(its rules are kept in full below, under *Artwork*);
**[`docs/business.md`](docs/business.md)** — pricing and the subscription,
and the INDEX to `docs/business/`: the quizmaster directory, group and venue
accounts, the marketplace and referrals, karaoke, the money plumbing;
**[`docs/setup.md`](docs/setup.md)** — the step-by-step deployment and account
setup, which is the one to open with the host rather than to read;
**[`docs/history.md`](docs/history.md)** — what each real night found, the
sweeps, and the live deployment state; and
**[`docs/SPLIT-PLAN.md`](docs/SPLIT-PLAN.md)**, which is how this was done.

---
## Artwork — the shared portrait library

Full reasoning: **[`docs/artwork.md`](docs/artwork.md)**. The rules:

- **A picture is keyed on the MUSICIAN and the STYLE, and nothing else.**
  Never on the question's `imagePrompt` — those are written by Claude, so two
  quizzes wanting Madonna would produce two keys and two bills, and the host
  could not know it had happened.
- **A second version of somebody only ever comes from a deliberate act** — a
  different style, or a redraw. Never from Claude's wording.
- **ONE style, `Cartoon`.** Two of the three written have been REFUSED by the
  supplier, so **adding a style is a line in the file and a minute in
  Google's playground FIRST** — a style that gets refused is a control that
  does nothing.
- **There is no photoreal option and there must never be one.** It is a legal
  decision: UK fair dealing does not cover commercial entertainment, so a
  convincing fake photograph of a real living musician in a pack that is SOLD
  is the one version worth not having. Every prompt says "cartoon drawing,
  not a photograph", and there are tests for it.
- **Moving the default style is a RENAME JOB, not a one-word edit.** The
  default has no filename suffix, so changing it silently changes what every
  unsuffixed file means. It was free exactly once, when the folder was empty.
- **Round 2 runs on GOOGLE** — Imagen 4 on `GOOGLE_API_KEY`, through the AI
  Studio door rather than Vertex. `personGeneration: 'allow_adult'` and
  `includeRaiReason: true` are both load-bearing: without the first every
  picture is refused, without the second a refusal is indistinguishable from
  a network problem.
- **Image prices are PER SUPPLIER**, and the Claude row is $5/$25 for Opus 5
  — it said $15/$75 for months and inflated every figure the Money tab showed
  by three.
- **Quality is a console setting, medium by default.** It was unset for
  months, which meant every picture ever made used the expensive end.

## Working style he asked for

- Ask before assuming, especially anything costing money or needing an account.
- Explain deployment like he is doing it for the first time, because he is.
- Keep the code readable — he will be editing it between gigs.
- **KEEP EVERYTHING IN THE CHAT. Do not send him somewhere else to read
  something.** Set on 14 August 2026, on a phone, and stated plainly: *"I want
  everything where possible to take place in this chat, so I don't have to go
  elsewhere."* A link is a context switch, and on a phone it is a bad one.
- **A prompt he has to paste gets a COPY BUTTON**, which in practice means a
  fenced code block in the reply — most clients put one on automatically. The
  rule came from *"the prompt must ALWAYS have a copy button"*, and the first
  version of it was wrong: it said publish an artifact, which satisfied the
  copy button and broke the rule above. **He wanted the button, not the
  page.** Only build an artifact when he asks for one, or when the thing
  genuinely needs to be a page. Never hide a prompt behind a URL.
- **OFFER UI CHOICES AS OPTIONS HE CAN TAP, never as prose.** Set on 14 August
  2026 in his own words: *"I love the fact that you give me four different
  options based on a UI change — I'm on my phone, and being able to make quick
  decisions on UI increases my productivity massively."* So when a UI decision
  has real forks, put them up as options with a small mock-up of each rather
  than describing them in a paragraph and asking what he thinks. He is usually
  on a phone; a paragraph costs him a round trip and a tap costs him nothing.
  Recommend one and say why — this is not a way of avoiding a view, it is a way
  of making his answer cheap.
- **RENDER THE OPTIONS BEFORE ASKING HIM TO CHOOSE.** Set on 14 August 2026 in
  his own words: *"before asking me to make general decisions about UI, can
  you render examples to make my choice more informed"*. So a UI question
  arrives WITH a picture of each option built from the app's own stylesheet —
  not an ASCII sketch and not a description. It cost a few minutes on the
  corner-radius decision and turned an argument about which numbers are
  "correct" into a glance at four blocks. Build the mock from the real
  `style.css` and the real markup, or the comparison is of something else.
- **SEND THE SCREENSHOT; DO NOT OPEN IT.** Set on 15 August 2026 after a
  session ran short: *"can the screenshots be delivered to me, and then that
  context reclaimed immediately after? It's usually just a UI decision that I
  then action and move on from."* **Context cannot be reclaimed** — an image is
  in the window for the rest of the session once it is read — but it never has
  to go in: `SendUserFile` costs one line of text, `Read` on a full-page
  screenshot costs 2–4k tokens. So an agent MEASURES, the file is SENT, and it
  is opened **only when the judgement is Claude's own**: *"do these figures
  read at 200px"* needs eyes, *"does this look right to you"* does not. Twelve
  screenshots read in one session is most of a feature's worth of context spent
  on pictures somebody else was going to decide about.
- **SHOW A SCREENSHOT FOR EVERY UI CHANGE. This is a rule, not a nicety** —
  set by the host on 14 August 2026: *"whenever you change the UI of anything
  in this app you MUST show me, since the UI of this app is extremely
  important."* Not "when building screens" and not only for new ones: a
  one-line CSS change counts, because that is exactly the size of change that
  looks fine in a diff and wrong on a projector. **A before AND an after where
  something was broken**, so the fault is visible rather than described — the
  join-corner fix below is the shape to copy. Screenshot at the size the thing
  is actually used at: 1280x720 for the projector, 320-430px for a phone.
- Presentation matters: projected in a dark room to paying customers. Big type,
  high contrast, readable from the back.

### BUILD IT, DO NOT LIST IT — and configure it afterwards

Set by the host on 17 August 2026, and it is a correction to how this repo had
been working: *"I realised adding too many things to the to-do list was
actually the reason that everything got so big. So what we need to do is just
build things, and then if we don't need them, we just delete them later."*

**He is right, and the evidence is in this repo's own history.** `TODO.md` had
reached 124KB, `docs/business.md` 170KB with 89% of it under one heading, and
the single largest entry in either — a 66KB quizmaster directory — is a thing
nobody has ever built. **A list is where ideas go to be paid for repeatedly**:
every session loads it, every session reads past it, and an entry costs
context on every one of them until somebody either builds it or deletes it.

So, for anything the host asks for directly:

- **BUILD IT. Do not add an entry for it first.** A written plan for a small
  feature is most of the cost of the feature and none of the value.
- **The simplest version that works. Configure it later** — *"we can configure
  these things later on"*. A number that might want to be a setting is a
  constant with a comment saying so, not a settings panel nobody has asked
  for. The league shipped with a twelve-week season written into the code for
  exactly this reason.
- **If it turns out to be wrong, DELETE IT.** Git history is the record. A
  feature removed cleanly costs less than a plan that sat in a list for four
  months.
- **The entry, if there is one, goes when the thing lands** — which
  `test/todo-budget.test.js` now enforces.

**WHAT STILL BELONGS IN `TODO.md`:** work that is genuinely blocked on a
decision only the host can make, work waiting on something else to land, and
anything with a reason recorded that would otherwise be re-litigated. **Not
ideas.** An idea nobody is building this month belongs in `docs/`, or nowhere.

### Which accounts a change is FOR — the words to take literally

Set by the host on 14 August 2026, so a request never has to say it twice.
**Take these literally**, and note that the fourth is the one most changes
actually mean:

| He says | It applies to |
|---|---|
| **"the owner account"** | HIS account alone. One exists and one always will |
| **"parent accounts"** | the management layer only — a quiz company, a pub group's HQ |
| **"child accounts"** | accounts INSIDE a group, *because* they are in one |
| **"quizmasters"** | **everybody who runs nights — on their own AND children.** The big population, and the default reading when a change is about running a quiz |
| **"venues"** | accounts with `kind: 'venue'`, parent or child |

**THE TRAP IS THAT "CHILD" AND "QUIZMASTER" ARE DIFFERENT AXES**, and mixing
them silently builds the right feature for the wrong people:

- **what you ARE** is the `kind` — quizmaster or venue;
- **how you are ORGANISED** is on your own, a parent, or a child.

So "change the child accounts" means *change something about being in a group*,
which is rare — while "change what a quizmaster sees" is almost always solo
accounts AND children together, because both run nights and both get the same
app. Build the first when he means the second and the change lands on a handful
of people; build the second when he means the first and it lands on everybody.

**His own quizmaster account is ON ITS OWN, not a child.** It is linked to the
owner account by `ownedBy` — one login, two hats — and it has no parent,
because he is not a company. So "my child accounts" describes nothing that
exists today, and a change described that way is worth one question before it
is built.

**When it is genuinely ambiguous, ASK WHICH POPULATION.** It is one line, and
the alternative is a feature that appears for five per cent of accounts or for
all of them when it should not.

### What Claude may do on its own — four categories

Set by the host on 14 August 2026, about CLAUDE'S OWN self-directed work —
tooling, agents, process — not about product features, which are asked for in
the ordinary way.

| | Do what? |
|---|---|
| **1. Benefits Claude, benefits the host** | just do it |
| **2. Benefits Claude, does not affect the host** | just do it |
| **3. Benefits Claude, negatively affects the host** | **ask first** |
| **4. Does not benefit Claude** | do not do it |

**"Negatively affects the host" means** it touches his data or the live app's
behaviour, restructures something he relies on, costs him time or attention,
or reduces his oversight of what is being done.

**AND THE TEST THAT MAKES IT WORK, in his own words: *"if you are
rationalising a 3 into a 2 then it's probably a 3 and just ask."*** That is
the whole rule, because the failure mode is not confusion about the
categories — it is a large upside making a 3 feel like a 2. The effort spent
arguing that something is really a 2 IS the signal.

**It caught its first case the moment it was written.** Splitting this file up
to save context was classified as a 1 — genuine benefit both ways — when
"restructures something you rely on" is sitting in the definition of a 3.

Category 4 is worth its own line: **inventing a small job to round a session
off is a 4.** Doing nothing and saying so is correct.

### Prefer the MECHANICAL transform to the model-mediated one

Learned on 14 August 2026, splitting this file, and it generalises well past
documentation.

The split was called impossible in one session and then done in one session.
The wrong assumption was not about SIZE — it was that every section had to be
read and written out again, which would have been ~50,000 tokens of output.
What actually did it was a script moving whole sections **by line number**,
never touching the prose. **A 4,000-line move costs the same as a 40-line one
when nothing reads the content.**

So when a job looks too big, the question to ask first is not "can I do half
of it" but **"is there a version of this that a script does and I only
supervise?"** Moving, renaming, reordering, extracting, counting and checking
are all in that category. Judgement — which rule matters, what a control
should be called — is not, and should stay slow.

It has a safety side too, which is the better argument: a script cannot
quietly reword something on the way through. The hand-written half of that
split was both the expensive part AND the only part that could have lost a
rule.

**And a cleanup frees nothing in the session that performs it.** This file was
already loaded before the split began; that cost was spent and unrecoverable.
The saving lands on the NEXT session. Tidying compounds across sessions, never
within one — so "clean up a bit to make room" does not work, and the reason to
do it is the sessions after this one.

### "GSD mode" — Get Shit Done

**If he types `GSD mode`, switch to it and STAY in it until the to-do list is
done or he says otherwise.** He is at the laptop knocking through a list, not
thinking something over, and every extra word is in the way: **open with the
numbered to-do list itself**, minimum context, **URLs always as clickable
links**, a link rather than a question, YES or NO where possible, one line per
step. **Argue in normal mode, not in GSD mode** — but the rules that stop things
going wrong still apply, in one line.

**The full mode is in [`docs/modes.md`](docs/modes.md) — open it when he types
it.** It is there rather than here because it governs a minority of sessions
and every session was paying for it.

### THE PROTECTED SURFACE — what must not break, and what may

Stated by the host on 14 August 2026, on a gig day: *"The thing that needs to
be stable and definitely working is the quiz launch capability for pubs.
Everything else that changes doesn't affect me tonight."*

**This is as useful for what it FREES as for what it protects.** Without it
every change gets treated as equally dangerous, which is slow and, worse,
spreads the care thinly over things that cannot end a night.

**PROTECTED — the path from "the room is sitting down" to "the quiz is
running":**

1. The console loads, the pack cards draw, **Tonight's Launch works**
2. The projector shows the game and the join code
3. Phones join and answer
4. Next / Reveal / Back on the control view
5. Crash recovery brings the same question and every score back

**Everything else may move**, and on a gig day that is most of the app: the
owner page, the editor, Past gigs, invoices, adverts, the shop, chat, teams,
online mode, the account work. None of them is reachable from a pub night, and
breaking one costs a Monday rather than an evening.

**THE TWO GUARDS COVER EXACTLY THAT PATH, and both should run before anything
lands on a gig day:**

- **`node scripts/pub-unchanged.mjs <commit> --ignore <new fields>`** — the
  engine half. Every payload a projector and a phone receive, at every phase of
  every pack, against a commit you trust.
- **Press Launch in a real browser** and check a game is actually running
  afterwards — for a quiz AND for a bingo pack, which take different fields.
  The engine is rarely the hazard; **the console's launch form is**, and no
  unit test presses a button.

The second one is the one that gets skipped, and it is the one that would stop
a night. A `node --check` passing means the file parses, not that Launch still
launches.

**AND ON 15 AUGUST 2026 IT WAS SKIPPED, AND LAUNCH WENT TO THE LIVE APP
BROKEN FOR EVERY GAME.** A function was called in `server.js` and never
imported. `node --check` was happy, because a missing import is a
ReferenceError at the moment the line runs rather than a syntax error. **1,150
tests passed**, because every one of them either calls `session.launch()`
directly or reads `server.js` as TEXT — **nothing in this repo had ever
executed the file.** It was found by a browser agent clicking the button, which
is precisely what the paragraph above says to do and what had not been done.

`test/launch-route.test.js` is that advice with an assertion on it: it starts
the real server on its own port and its own `DATA_DIR`, posts a real launch,
and checks the projector has a quiz on it afterwards. It was verified by
removing the import again and watching all three of its cases fail. **Keep it
shallow** — it guards the protected surface, not the feature, and a slow suite
is one people stop running before a gig.

**The general lesson is bigger than the import: A TEST THAT NEVER RUNS THE
ARTEFACT PROVES NOTHING ABOUT IT.** Reading `server.js` as a string to check a
route exists is the same class of mistake as `screenView()` computing a board
no projector ever drew — both were tested, both were wrong, and in both cases
the test was measuring something adjacent to the thing that mattered.

### "Sweep mode" — find everything, change nothing

**If he types `Sweep mode`, run a full sweep and REPORT. Do not action any of
it.** He decides what gets fixed. Four kinds at once, because they hide in each
other: **contradictions** (the docs against the code), **bugs**,
**vulnerabilities from BOTH sides** (a quizmaster reaching for the owner's, and
the owner reaching into a quizmaster's), and **label collisions** — two controls
on one screen using one word for two different things, which no test, no 500 and
no visual defect will ever show you. **REPORT THE PAIR, NOT THE BUTTON.**

**Testing is allowed; leaving anything behind is not.** And **verify before
reporting** — a false finding costs him time and teaches him to skim the next
report. **Say what HELD as well as what failed.**

**The full mode is in [`docs/modes.md`](docs/modes.md) — open it when he types
it.** `.claude/agents/sweeper.md` runs it in its own context, which is where a
read-heavy job belongs.

## Layout

```
server.js              routing, SSE, static files
src/rooms.js           a room per quizmaster: their game, photos and join code
src/session.js         which game is running; the server talks only to this
src/engine.js          the quiz state machine and its three views
src/bingo.js           bingo: cards, calls, claims
src/scoring.js         quiz scoring maths, pure
src/store.js           crash recovery
src/quizzes.js         quiz packs: load, validate, save
src/library.js         saved packs, play counts, past nights
src/history.js         no-repeats memory for bingo generation
src/question-history.js  the same, for quiz ANSWERS — read off the packs, not a file
src/generate-bingo.js  theme -> Claude -> history filter -> Spotify -> pack
src/bingo-rules.js     what makes a good bingo track, for the in-app generator
src/spotify.js         playlist building
src/qrcode.js          dependency-free QR encoder
src/photos.js          photos from the room: store, kill switch, bin
src/past-gigs.js       the nights already run, and where their photos are filed
src/headcounts.js      how many played, per venue — "22 → 58", out of the archive
src/comeback.js        the last slide: "Back here Thursday 20th", derived at launch
src/room-asks.js       what the ROOM asked for next time — yes keeps it, no bins it
src/reports.js         "that one's wrong" — corrections from a night
src/adverts.js         venue advertising slides, per venue
src/generate-images.js round 2 artwork (placeholder or OpenAI)
src/portraits.js       the shared portrait library: one picture per musician
src/branding.js        "Mark's Quizporium" — the app name and whose night it is
src/gates.js           which routes are the owner's, as two testable lists
src/own-packs.js       a quizmaster's own packs — theirs, and private from the owner
src/spend.js           what Claude and OpenAI have actually cost, written down as it happens
src/chat.js            online chat: what a room is, who is in it, what may be said mid-question
public/                the screens; *-bingo.js files hold the bingo variants
  assets/console*.js   the console: a shell plus one module per door or tab
  assets/brandmark.js  the question-in-a-mic logo, shared with the server as the favicon
  assets/avatar.js     a drawn face per team, for anyone who sent no photo
  assets/stickers.js   props to drag onto a photo: dog ears, a clown nose
  assets/schemes.js    a quizmaster's own two colours, shared with the server
  assets/break-parts.js  what happens in each gap of a night, shared with the server
  assets/console-breaks.js  the gap dial in each pack tile's corner
  assets/console-community.js  the Community door: leagues, photos, what they asked for
  assets/console-pick.js   a dropdown that is narrow shut and wide open
  assets/diary.js      what is on and when — residencies projected, one-offs typed
  assets/chat.js       the chat sheet on a player's phone, online nights only
quizzes/ bingo/        the library
data/                  live state, history, archived nights (gitignored)
```

### Adding a game
1. Write an engine exposing `screenView()`, `playerView()`, `hostView()`,
   `join()`, `results()` — see `src/bingo.js` for the shape
2. Add it to `LAUNCHERS` in `src/session.js`
3. Add a card set for the big screen and a branch in `play.js` / `host.js`,
   following the `*-bingo.js` files
4. Add one entry to `TABS` in `public/assets/console.js` — the tab list is
   still the shell's; the section it names lives in its own module. That gives it a tab,
   a generator slot and a pack grid with nothing else to write

Nothing outside those four places needs to know it exists.

### Adding a quiz round type
1. `ROUND_TYPES` in `src/quizzes.js`, plus any per-type validation
2. a case in `screenQuestionExtras` **and** `hostQuestionExtras` in `src/engine.js`
   — think about which fields are secret
3. a media block in `renderQuestionMedia` + a `.type-x` CSS rule
4. a brief in `roundBriefs()` in `src/generate-quiz.js`, an entry in
   `QUIZ_ROUNDS` in `public/assets/console.js`, and one in `ROUND_TYPES` in
   `public/assets/editor.js`

**Everything that is not per-type works on indexes into a list.** The clock, the
scoring, the tally, the fastest finger and who-picked-what never ask what kind
of round they are in — they take a list of options and a set of right ones. The
three places that decide those are `optionsFor()`, `correctSet()` and
`answerText()` in `src/engine.js`. A round type that fits through those needs
almost nothing else; one that does not is a bigger job than it looks.

**A type that changes the answering mechanic touches more than that.** `multi`
needed `answer()` to take a set, `session.runPlayerAction` to forward it (it
silently dropped the new field at first), a scoring function, and the editor to
switch from radios to tickboxes.

**And check for hardcoded lists of round types.** `/api/generate/quiz` had its
own `['text', 'image', 'intro']` whitelist, so ticking "pick them all" in the
console sent `multi`, the server filtered it out, and the quiz came back
without the round and without an error. Whitelisting is `roundPlan()`'s job
now, against `ROUND_TYPES`, and a test generates one round of every type so a
sixth one cannot repeat this. It has already earned its keep: adding
`alphabet` failed that test before a line of the round was written.

### Online mode is ONE BOOLEAN, and the branch count is a budget

`state.online`, set at launch and living in the game state like the look and the
card shape. **Almost nothing reads it, and that is what keeps the promise that
the core engine is the same.** Five places: `freshState()` declares it,
`session.launch()` sets it, the launch route reads it off the body,
`playerView()` reports it and holds **the one real branch** in the engine, and
`play.js` renders the question **if it was sent**. The phone deliberately
branches on `s.prompt` rather than on `s.online`, so a payload that forgot the
prompt degrades to the pub layout rather than to an empty box.

**Anything added for online mode must not raise that count** without a reason
worth writing down. **The video is meant to be NATIVE, on Cloudflare — not Zoom,
not Teams — and NONE of it is built**: no `getUserMedia`, no WebRTC, no
Cloudflare call anywhere. The switch is built and the transport is not.
**Prove it with bytes**: `node scripts/pub-unchanged.mjs <base> --ignore online`.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### The alphabet round — no options at all

`type: 'alphabet'`. A question is `{ prompt, answer }` and nothing else — the
twenty-six letters are **not written into the pack**, `optionsFor()` puts them
back, so everything downstream treats a letter as an ordinary option index.
**Only the first letter has to be right**; spelling is irrelevant, which is the
whole point. **An answer beginning with "The", "A" or "An" is a hard validation
error** — see the decisions table. `answerText()` is why the reveal says
"Fleetwood Mac" and not "F", in its own slot under the question. The host's key
shows the answer in full and **only the letters somebody actually pressed**. The
phone is **five across where the projector is nine** — a thumb problem, not a
matching one — same order, A to Z rather than QWERTY.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### The intro round skips the dead air, and that is a SCORING fix

`public/assets/cue.js`, `cue.from`, `position_ms` on the Spotify play call, and
**Skip the dead air** in the editor. **It is SCORING, not polish**: the clock
starts when the question goes up, so two seconds of silence at the front of a
track takes two seconds of score off everybody for a reason that has nothing to
do with whether they knew it — the same argument as the picture round's four
reveals running on one curve. **What is trimmed is silence; how quickly a track
becomes recognisable is the question's difficulty and must never be trimmed.**

- **An unreadable offset plays from the START** — `cueOffsetMs()` returns `null`
  for prose, a negative, `1:75` or anything past ten minutes, and the server
  then sends no `position_ms` at all. A typo costs the old behaviour, never a
  silent jump into the middle of a song in front of a room.
- **Every pack on disk says `0:00`**, and a test walks `quizzes/` and fails if a
  cue ever arrives with an offset on it. The generator is told to write exactly
  `0:00`, because only somebody who has LISTENED knows where the audio begins.
- **The editor echoes what it understood on every keystroke**, repainted in
  place. The control view prints the offset only when there IS one.
- **DO NOT "fix" this by giving the intro round a longer clock** — a longer
  round is a round worth MORE points, which is the same fault deliberately.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### The breakout round — a laugh, not a question, and it scores nothing

`type: 'breakout'`. A Blankety-Blank-style round inside an ordinary composed
quiz via `composeQuiz()` — nothing loads, nothing ends, so it can sit anywhere
in a night with no effect on scores, teams or tokens.

- **Phones TYPE.** `answerBreakout()`/`/api/answer-breakout`, a separate
  action from `answer()`. Text is cleaned with `cleanTeamName()`, exactly as
  team names are — no profanity filter, no approve step.
- **NO SCORE, EVER** — `correctSet()`/`answerText()` return empty;
  `fastestFinger()`/`whoPicked()`/`optionTally()` fall through safely.
- **ANSWERS ARE HOST-ONLY, NEVER THE PROJECTOR** — `view.breakoutAnswers` in
  `hostView()`, and no `reveal` at all in `screenView()`/`playerView()`.
- **THE COUNT IS WHAT SCORES** — `scoringRoundNumber()`/`scoringRoundCount()`
  exclude it, so "Round 2 of 2" stays true with a breakout between them; every
  screen says "Bonus round" instead. `roundIndex`/`roundCount` are UNCHANGED —
  only what a screen SAYS moved.
- Claude can write these too (`roundBriefsFor('breakout')`), checking pass
  skipped — there is no answer for a fact-checker to check.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### The draw from the bottom half — a retention feature, not a raffle

`drawLuckyDip()` and `state.luckyDip` in `src/engine.js`, the band under the
podium in `screen.js`. A table that works out by round three that it cannot win
has nothing left to stay for, and a room that thins out at nine is worth less to
the pub. **Eligibility is answering the LAST QUESTION THE NIGHT ENDED ON** —
not "the final round", which on a one-round night collapses to "answered
anything at all". **The same prize as third place.** All tested:

- **Nobody wins twice** — anybody already holding a voucher is out of the hat.
- **Two in the hat minimum.** One eligible person is a gift, not a draw.
- **Decided ONCE, in the state**, like the vouchers: `Back` and forward again
  must not name a different person to a room that heard the first.
- **The ENGINE draws, never a phone**, and `random` is injected like `now()`.
- **The projector gets the NAME and never the code.**
- **A draw voucher has NO PLACE** — `place: mine.place || 1` would tell somebody
  who finished eleventh they had won the quiz.

A band BELOW the podium, never on it, with the count printed. Entry is FREE, so
there is nothing to work around; **if a venue ever charges per team this needs
looking at again.**

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### The tabs run ALONG a quizmaster's evening, behind their door

`TABS`, **filtered by DOOR and stacked down the left**. The ORDER runs along
the evening: Console is Music Quiz · Music Bingo · Prepare a night · Venues —
what you will PLAY, then where. Tonight's settings moved OFF this list on 21
August 2026, onto the launch bar as an always-visible row — see
`docs/console.md`. **Rarely-touched goes last** wherever it lands.

**A reorder is the cheapest change and the easiest to get wrong silently** —
nothing fails, a tab simply stops being where a thumb expects it. Open every
door in a browser at 390 and 1280 afterwards and measure for overflow.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### What the room asked for — THREE BUTTONS, not a box

`src/round-ideas.js`, `src/room-asks.js`, the card on the phone's final screen,
the panel above the quiz generator, and the switch on My account.

- **THREE BUTTONS, NEVER A TEXT BOX.** The ideas come from `ROUND_IDEAS` on the
  SERVER and a phone sends back an `ideaId` — so **nothing a stranger types ever
  reaches the quizmaster**, there is no moderation question, and what comes back
  is a VOTE, which can be counted.
- **Only what is not already on the shelf.** An idea whose `words` match a pack
  title is dropped; a library holding everything asks NOTHING rather than
  repeating itself.
- **The same three all night**, chosen at LAUNCH into the game state with an
  injected `random`, so the numbers add up and a restart brings back the same
  question. **One vote each, and voting again REPLACES it.**
- **A switch on My account, OFF unless turned on** (`prefs.askRounds`), read at
  launch — **but the panel that answers it is UNGATED.** A switch whose answer
  is invisible to the person who pressed it is worse than no switch.
- **YES or NO, and NO is a delete.** There is deliberately no "rejected" state.
- **Grouped by idea, most-asked first**, kept list included.
- **The free-text path in `room-asks.js` is left deliberately** — it reads nights
  filed before the vote existed. **Do not wire a text box back onto it.**

Full reasoning: **[`docs/generation.md`](docs/generation.md)**.

### DRAG AND DROP — the console is the laptop with the HDMI in it

`gripIcon()` / `dragRow()` in `editor.js`, `packDrag` in `console-state.js`. The
console IS the laptop with the HDMI in it, so a mouse is an input it has to
serve. **HTML5 drag events never fire on touch, so the taps and the arrow
buttons STAY** — drag is the fast way and every drag has a way round it.

- **What can be dragged:** a round by its HEAD onto another round's head; a
  question onto another question or onto a round's head; a **pack card up to
  Tonight** (carrying the game, so a bingo pack switches the bar over); a
  **shut venue card up to Tonight**; and the chosen pack back OFF Tonight,
  which un-chooses it and nothing else.
- **ADVERTS ARE DELIBERATELY NOT DRAGGABLE.** A slide belongs to a VENUE, not to
  a night, so dropping the venue in brings its adverts with it.
- **Changing the venue re-resolves a night that is up but EMPTY** —
  `chooseVenue()` relaunches through the same `switchIfFree` guard, and once it
  cannot, the bar says so. The prizes and the voucher are read at launch.
- **A ROUND IS SWITCHED OFF WITH A TICK, NOT DRAGGED OUT** — a tap works on both
  a laptop and a phone. **ANY round can be switched off, including the last**; a
  pack with all of them off is simply an empty pack, and Launch is hollow.
  **BUT A BINGO PACK HAS NO ROUNDS AT ALL, and reading that as "all of them are
  off" disabled Launch for ever the moment one was dragged in** — `hasRounds()`
  is the distinction, and the two states are not the same thing. It survived
  because nothing threw and the pack card's own Launch still worked, so it only
  ever showed on the drag path.
  Switching one off makes it a COMPOSED night even with one pack, and the Launch
  button names what will be PLAYED. Keyed by pack AND index, never by title.
- **`stopPropagation` on the tick's mousedown as well as its click**, or a press
  on a tick drags the pack.
- **Mixing rounds from two packs belongs to the NIGHT, not the editor, and is
  deliberately NOT BUILT.** If it is picked up, start from Tonight.
- **TONIGHT PINS WHERE IT ALREADY IS WHEN A DRAG STARTS, never at a fixed
  line.** It goes sticky so the drop target cannot scroll away — but pinning at
  `--topbar-h` only ever MOVES a panel that has already scrolled past it, and it
  always has, because you scroll DOWN to reach the library. So the panel lurched
  90px the instant a card was picked up and the tiles slid out from under the
  cursor. **A sticky top may be NEGATIVE**: `pinTonightWhereItIs()` measures at
  `dragstart` and freezes it where the eye last saw it. The floor asks for
  ENOUGH of the drop row (`KEEP_OF_DROP_ROW`), not all of it — demanding all of
  it left a safe zone narrower than the scroll people actually do. **The topbar
  is measured, never written out**: it wraps on a phone.
- **`moveWithin()` must allow for the source already being removed**, and the
  drop marker is ABOVE or BELOW depending on which half of the row you are in.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### TONIGHT — one launch section, on the Console door

`launchBar()`, above the running panel on the Console door. *"Sometimes you
just don't want to think, you want to get in and go and know it will work."*

- **NOTHING IS CHOSEN FOR YOU** — a bar that guesses guesses wrongly the moment
  a pack is launched, and then the console and the projector name different
  quizzes. **Night settings sit above the packs, a picked pack's below** — tap
  a tile to pick it.
- **ONE gradient button on the whole console.** There were three on this bar
  alone, and a Launch on every pack card besides.
- **THE CONSOLE AND THE BIG SCREEN MUST AGREE, ALWAYS.** A choice STICKS, and
  `paintLive()` prints what is actually on the projector in gold when it
  differs from what the bar is set to.
- **Picking a pack puts it on the big screen when nothing would be lost.** THE
  SERVER decides which — the launch call without `replace` answers 409 when
  `session.inProgress()`. A 409 is SILENT here. A re-render is not somebody
  choosing a pack (`quiet`), and what is running is READ BACK.
- **IN THE ROOM / ONLINE is a switch in the head** — a setting whose wrong
  value ruins the night belongs where it is read. **BOTH halves wear the same
  lit treatment**, never the gradient (Launch keeps that): the
  gradient-on-Online-only version was a different object per mode. Shut, the
  line still says "Online".
- **The venue is chosen HERE and on the Venues shelf, nowhere else** — both go
  through `chooseVenue()`. **Neither the venue nor online is remembered on the
  device**: both are facts about one evening, and a remembered one files next
  Tuesday under last Thursday's pub.
- **Whose night it is, RANKED**: a date you typed, then whose usual night, then
  where you played last. **Two claims are NAMED, never left blank**
  (`clashTonight()`), in gold — a decision only the human can make.
- **It folds to a thin line that still says what it is set to**, in
  `localStorage`; one row, no wrap, the middle ellipsised, the whole row the
  target. **The heading does not move when it folds** — a three-cell grid and a
  fold that says HIDE and SHOW at a fixed width.
- **THE PACK CARDS NO LONGER LAUNCH; TONIGHT IS THE ONLY WAY IN** — *"this
  whole expandable section is pointless now."* Every field on it was a decision
  about TONIGHT, which Tonight owns. **The guarantee was never a Launch on
  every card, it was that launching is one predictable move away.** A card
  keeps what is true of the PACK — Read, Rename, Delete, Pictures — behind the
  Workshop door, and **on the Console a tap puts it in Tonight**, same path as
  a drop, no caret, because there is nothing to open.
- **A CONTROL NEVER APPEARS OUT OF NOTHING.** Launch goes hollow saying what it
  wants; *Keep this as a show* goes disabled. Both were built appearing and
  disappearing and both were reported as clunky in the same words: a control
  that comes and goes is one you cannot learn the position of, driven with a
  thumb in a dark pub. **Build the next one present-and-inert, not absent.**

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### A SHOW IS AN EVENING, SAVED — built in advance, dragged onto Tonight

`src/shows.js`, `public/assets/show-parts.js`, `tonightAsShow()` / `loadShow()`
/ `showsSection()` in `console-shows.js`. *"We're frankensteining nights instead of
having a nights section."*

- **A SHOW IS `items` — A LIST of what is played, in order.** It held one game
  for one commit and that was wrong: *"say you want to swap out the music bingo
  after, you need to be able to do that independent of removing the venue or
  other rounds."* **The prizes, look and lobby game stay on the SHOW**, which
  is what makes a swap unable to touch them.
- **THE VENUE IS NEVER SAVED, AND NEVER RESTORED** — *"there's no way you'd
  want to run the same quiz at the same venue again."* A show is a TEMPLATE,
  not a record; the prizes and the voucher follow the venue, so a stale one
  is somebody refused a drink. `tonightAsShow()` does not store it and
  `applyShow()` does not read it — **both halves**, or an old show still
  drags a pub in. Do not put it back.
- **`itemsOf()` IN `show-parts.js` IS THE ONE READER**, server and browser. The
  one-game shape reads as a list of one: **there is no migration step and there
  must not be one** — a rewrite over everybody's file is a one-shot script on a
  disk wiped every deploy.
- **IT IS THE LAUNCH PAYLOAD WITH A NAME ON IT** — `tonightAsShow()` reads the
  SAME state the launch reads, or a show plays something other than what was on
  the bar when it was saved.
- **THE BAR PLAYS ONE PART AND SAYS WHAT FOLLOWS** (`paintThen()`), because
  `session.launch()` builds one game. **The next part LOADS, never launches** —
  only the person on the mic knows when the quiz is done. **Picking a pack by
  hand clears `showRunning`**, or the bar describes a night nobody is running.
- **IT STORES REFERENCES AND NEVER COPIES** — rule 11. Tested.
- **IT IS NOT A GATE AND MUST NEVER BECOME ONE.** The launch re-checks the
  tier, every pack and the lobby game.
- **CALLED A SHOW BECAUSE "NIGHT" IS TAKEN TWICE** — Calendar's are bookings,
  Gigs' are the archive. *Set list* and *running order* name the activity and
  carry neither the venue nor the prizes.
- **THE ORDER IS REBUILT INTO `lbExtra` AND `lbOff`, never held a third way.**
  **A BROKEN SHOW IS NAMED ON THE CARD, DAYS EARLY** — every part.
- **KEEPING A NIGHT IS ON TONIGHT'S SETTINGS; WHAT IT PLAYS IS EDITED ON THE
  CARD, WORKSHOP ONLY** — no second composer to disagree with the launch.
- **DROPPING ONE IN NEVER LAUNCHES**, and there is a TAP as well as a drag,
  because HTML5 drag never fires on touch. Reasoning:
  **[`docs/console.md`](docs/console.md)**.

### QUIZ → BINGO → QUIZ, ONE RUNNING SCORE — a saved show, or dragged straight onto Tonight

`Session.launchRunningOrder()`/`advanceOrder()` in `src/session.js`. **NO
`engine.js` OR `bingo.js` CHANGES.** The boundary between parts is the pause
every night already has — a composed quiz's own `ROUND_BOARD` after its last
round, bingo's own `WON` — so the control view offers **"Continue to the
bingo/quiz"** there instead of next/finish, and an intermediate part simply
never reaches FINAL/FINISHED: never archived, quiz prizes never issued early.
**Roster carries via a real `join()` on the fresh engine** (a bingo player
gets a real card, a quiz player real fields), with the TOKEN patched on
afterwards — `join()` always mints a fresh one, which would silently strand
the phone's own stored token — and the SCORE patched in for a quiz part only,
held in `this.carriedScores` across a bingo interlude that has no score field
of its own. **THE LOBBY GAME MUST NOT CARRY FORWARD** — found live: it must
re-resolve per part, or a resolved default from part one becomes a permanent
override the moment a kind changes. Every pack in every part is loaded before
ANY of them launches, or a deleted pack in part three throws in front of the
room hours later. Two ways in: a saved SHOW's "Add a bingo game"/"Add a quiz"
editor, or — the Tonight row itself, since 20 August 2026 — a bingo pack
dragged straight in and a round dot dragged OUT of its pack into its own
slot (`console-tonight-mix.js`/`-ui.js`; `lbSlots`, `null` on every ordinary
night). Reasoning: **[`docs/console.md`](docs/console.md)**.

### A PACK WEARS ITS OWN SUBJECT

`public/assets/pack-look.js`, `.pack-card.tinted` / `.lb-tile.tinted`. A pack's
background is derived from its title — a decade, a genre, Christmas — and
anything unrecognised gets a quiet colour of its own, so no card looks
half-built beside a dressed one. **The job is SCANNING**: find tonight's pack and press
Launch, and nine identical cards make that a reading task.

- **It DERIVES, never stores** — nothing in a pack file.
- **Genre beats decade beats nothing; seasonal beats both.** A decade-first
  order gives every 2000s pack one colour, the failure this exists to avoid.
  **"Pop" is deliberately not a subject** — nearly every pack here is one. **A
  word only earns a place if it tells two packs APART.**
- **Whole words only** — "rock" must not match "Rocky". Punctuation is stripped
  so "R'n'B" and "RnB" are one thing, **which is also what splits them**, so
  the spaced forms are listed too.

- **A WASH, NEVER A FILL AND NEVER A BORDER**, capped low — which is why it can
  coexist with gold/green/red meaning winning/good/destructive: a Christmas
  pack IS red and green, and `broken` is a BORDER, so the two never speak in
  the same place. There is a test on the alpha.
- **The same colours and the same trimmed name on the card and in the Tonight
  slot**, from one function — a pack that changed appearance on being dragged
  in undoes the reason the two match.
- **The same pack is the same colour on every device and reload.** A shelf that
  reshuffles is worse than one with no colour.
- **THE EDGE IS THE KIND OF PACK; THE BACKGROUND IS THE ERA.** Two channels,
  two questions, one glance. Quiz green, bingo purple, **adding a kind is one
  line** in `KIND_EDGE`. **The Tonight tile takes its kind from the PACK, not
  the tab** — Tonight holds both at once. **One collision, accepted
  knowingly**: green already means good/paying. Teal is a one-line change if it
  ever reads muddy.
- **A SHUT CARD IS A SQUARE POSTER — the era fills it, the name on a dark fade
  at the bottom.** Chosen from four rendered at the real width.
  **`aspect-ratio` is on `.shut` ALONE**, or the shape decides what an open
  card may carry. **The fade is a `::before`, never a wrapper**, so no markup
  differs between open and shut.
- **THE DRAWN TITLE IS TRIMMED AND THE STORED ONE IS NOT** (`shortTitle()`) —
  a leading "The", a trailing Quiz/Bingo; the card says the kind three times
  already. **Nothing writes anything — SEARCH LOOKS INSIDE TITLES.**
  **Falls back to the full title when the trim empties it.** Three sizes by
  length, calibrated to the REAL 146px card: **a design measured against
  invented content is measured against nothing**, and the first ones were —
  they clipped two real names with an ellipsis.
- **THE ERA IN THE CORNER RAN THROUGH THE TITLES** — a corner has no room, so
  the word tucked under the text. Centred under a fade it cannot; the Tonight
  tile keeps the corner. **Only printed when short enough to read**: a decade is three characters, a genre five, "CHRISTMAS" gets
  nothing, and there is a test on the length. Gradient text behind an
  `@supports` with a SOLID colour first, or a browser without `background-clip`
  prints nothing. It needed `position: relative` on `.pack-card`, missing until
  then — the **Yours** badge had been positioning against the wrong ancestor.
- **THE EDGE IS THE KIND AND THE WASH IS THE ERA; the difference in strength is
  the job.** The wash must stay faint, which makes the hue hard to name; three
  pixels with nothing over them says it outright. **On the bottom because an
  ordinary button already carries the account colour there** — a stripe down
  the LEFT was rendered beside it and turned down. **`:not(.broken)` is
  load-bearing**: the tint rule comes later in the sheet and would overwrite
  the red on a card with something wrong with it. **And the TILE needs
  `.lb-tile.is-pack` named in its rule** — `.is-pack` sets the SHORTHAND
  `border` three thousand lines further down at equal specificity, so it won
  and reset all four sides. **A shorthand `border` lower in the sheet beats a
  longhand `border-bottom` higher up at equal specificity — that is the trap,
  and nothing throws.**
- **CARTOON FIGURES WERE TRIED AND DO NOT READ — do not re-propose them
  without new evidence.** At the real card size a whole person is a blob, and
  two hats at 52px are the same hat. **And never a named person** — this app is
  sold, and a decoration is a far weaker case for a likeness than a picture
  round, where the musician IS the question.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### The last slide of the night — "Back here Thursday 20th"

`src/comeback.js`, `state.comeBack`, `comeBackBand()` in `client.js`, and **Where
to send them** on the Venues tab. **IT WRITES ITSELF** — the date is derived from
the venue's usual night through `upcoming()`, so there is nothing to type at the
moment the host is most rushed and it cannot go stale; a night written off and a
one-off both win for free. Load-bearing, all tested:

- **Resolved at LAUNCH, on the server, into the game state**, like the prizes.
- **UNDER the winner and the podium, never over them**, and **at the FINAL and
  nowhere else** — never over a round board or a bingo call sheet.
- **The host sees it from the LOBBY on**, because a wrong date is worse than no
  slide and they are the only person who knows.
- **A QR may only ever carry http(s)** (`safeLink`); a missing scheme is assumed
  https rather than thrown away.
- **Silence when there is nothing true to say.**
- **It is NOT on anybody's phone.** The link lives on the VENUE record.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### Headcount per venue — the app finally says a number it always knew

`src/headcounts.js`, `library.headcounts`, the `heads-*` block on a venue card
and on Gigs. Nothing new is collected — this is arithmetic over the archive.
**ONE FUNCTION TAKES A SET OF NIGHTS AND RETURNS THE NUMBERS ACROSS THEM**, so
one venue and all of them cannot disagree; it takes what `mergeGigs()` returns,
which buys the 6am roll-over for nothing. Tested:

- **A night's headcount is the MAX across its games, never the sum** — a quiz
  and the bingo after it are the same room.
- **A night nobody played is left out**, or an abandoned launch puts a 0 in the
  middle of somebody's trend.
- **A night with no venue is COUNTED AND SAID**, in a line under the panel.
- **One venue typed in two cases is one venue**, keyed lowercase.
- **No red for a night that went down.** The app does not editorialise about
  somebody's own work.
- The bars are `aria-hidden` and not a gradient; the library payload reads the
  archive ONCE for the badge, the unbilled count and these.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### WHAT THIS ROOM HAS ALREADY HEARD — the shelf is ranked PER VENUE

`src/heard.js`, `library.playedByVenue`, `heardHere()` / `whyFresh()` in
`console-tonight.js`, `playedLine()` in `console-packs.js`. Asked for against
the existing ranking: *"that's a good order but it needs to be per venue as
well — if you've done a quiz at venue A and not at venue B recently then this
needs to be factored in."* Nothing new is collected; the archive has held the
venue and the pack of every filed night for months and nothing joined them.

- **A GLOBAL "last played" ANSWERS THE WRONG QUESTION.** It says *have I run
  this lately*, which is a fact about the diary. The shelf is for *will this
  room have heard it*, which is a fact about one venue — so the 80s quiz run
  at The Crown on Tuesday is completely fresh at The Station Tap on Thursday,
  and the old ranking buried it at both.
- **NEVER PLAYED HERE READS AS NEVER PLAYED, FULL STOP** — 0, not the global
  date, or the feature does nothing.
- **WITH NO VENUE CHOSEN IT FALLS BACK TO THE GLOBAL DATE.** Nothing is known
  about where tonight is, so the old question is the best one left — and that
  night behaves exactly as it always did.
- **A NIGHT IS FILED UNDER ITS ID *AND* ITS NAME, and the reader asks under
  both.** This is the split `venueHeadcounts()` was already bitten by: a venue
  picked off the book lands under `id:xyz` and the same pub typed freehand
  under `the crown`. Every night from before venue ids is in the second group.
  **The reconciling has to be the READER's job** — nothing on a hand-typed
  night says which book entry it meant, and only the Venues book joins the two.
- **THE ORDER AND ITS EXPLANATION COME FROM ONE PLACE.** `whyFresh()` says
  "Never played here" where it ranked on "here"; `playedLine()` LEADS with the
  local answer and lets the count follow, because *"Played 4 times"* over a
  card at the FRONT of the shelf reads as a bug. **The two halves must never
  contradict**: "Never played · here 2 days ago" is a sentence this app should
  not be able to print.
- **CHANGING THE VENUE RE-RENDERS THE SHELF.** `chooseVenue()` repainted the
  bar alone, which left a grid ordered for the pub before it — silently, with
  every card real and nothing thrown.
- **The arithmetic is on the SERVER and the venue question is in the BROWSER.**
  `src/heard.js` takes what `mergeGigs()` returns — same input as the
  headcounts, so the 6am roll-over and "a quiz and the bingo after it are one
  night" come free — and rides with the library rather than being fetched per
  venue change, because the shelf re-ranks on every one of them.
- **A MIXED NIGHT COUNTS EVERY PART**, not just the one whose ending reached
  the archive, or a bingo interlude reads as never played here for ever.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### A NIGHT GOES ON THE PUBLIC GALLERY FROM UNDER ITS OWN PHOTOS

`galleryToggle()` in `console-gigs.js`, `/api/past-gigs/publish`. **The route
existed from the day the gallery was built and nothing ever called it** — the
gate was perfect and had no handle, which is the arcade-board fault again: a
test that the route works proves nothing about whether anybody can reach it.
`test/gallery.test.js` now asserts a caller exists.

- **AND WHEN A CALLER WAS WIRED UP, THE ROUTE 404ED.** It was defined inside
  `handleGet`, which only ever runs for GET and HEAD, so every POST fell through
  to the generic 404. **A route in the wrong handler is dead code that reads as
  a feature.** The test POSTs over real HTTP and asserts against the 404 rather
  than for the 400 — that difference is the bug.
- **The control sits UNDER the photographs, inside a night you have opened** —
  so nobody publishes a night without having just looked at what is in it. A
  button on the collapsed row would be one tap from a stranger's face going
  public.
- **It says what publishing means in one line** — *"Anyone with the link can
  see these."* A warning is the exception to the short-label rule. Not red: it
  is read BEFORE pressing, and red would say a mistake had been made.
- **Taking it down is as prominent as putting it up**, outlined red. Somebody
  will ask, and the honest answer is a quizmaster who can do it while stood
  there.
- **THE OWNER PREVIEW NEEDS THE KEY AND WAS NOT SENDING IT.** `/gallery` shows
  unpublished nights to whoever is signed in — but the page sent nothing on a
  `?key=` link, so the preview silently failed on the identity most likely to
  be checking. Read **from the URL, never from localStorage** (the remembered-key
  rule), and put on the IMAGES too, because the photo route re-checks for
  itself.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### A prize taken at the bar has to reach the filed night

`updateArchivedNight()` in `src/library.js`, and `state.archivedAs`. A night is
archived the instant it reaches the final scores and the bar scans the QR
minutes later. An UPDATE rather than a second archive, compared against what was
last filed before writing, and **pushed to the backup again**. **The flag that
stops a night being filed twice is `state.archivedAs`, not a field on the
Session** — the old one was cleared by `build()`, which runs on boot, so a
restart on the final scores filed the whole evening again.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### CHECKING THE PHOTOS IS THE NEXT PRESS

`buildActions()` in `host.js`; `?night=` / `nightToOpen` in the console.

- **IT DOES NOT PUBLISH AND MUST NOT BE MADE TO** — `PHOTO_PHASES` includes
  `final`, so the room is still sending. **Nor back to a console prompt.**
- **The night rides in the URL on the 6am key**, never `host.js` writing the
  console's store. **The bench is set WITHOUT rendering**: a render at boot
  beats `load()`, so `library` is null and the paint throws.
- **ARRIVING OPENS THE ROW**, via the row's own head. One shot.
- **THE BENCH'S PUBLISH BUTTON OPENS THE PHOTOGRAPHS, not publishes** — it was
  a way round the safeguard under the photos.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### THE POST-NIGHT REPORT — a PDF, off the archive, out the share sheet

`src/report-pdf.js`, `/api/past-gigs/<night>/report.pdf`. Nothing new
collected. **The route sits above the generic `/api/past-gigs/<night>` match**,
the same prefix trap the publish route guards against, and needs
`listArchive({ boards: true })` for the podium.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### THE ADVERT SLIDE EDITOR HOLDS THE OFFER, AND READS ITS OWN COUNT BACK

`slideEditor()` in `console-venues.js` collects `offerCode`/`offerWhen`.
`/api/advert/<id>` embeds `room.offers.forPack(id)` on the same fetch, so the
count cannot drift from the pack; the editor keeps it OUT of the object it PUTs
back. Silent until there is a code, and until anything has scanned it.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### THE APP SENDS THE MONEY EMAILS, AND NOTHING ELSE

`receiptEmail()`/`cardFailedEmail()` in `src/email.js`, `billingEmail()` in
`src/billing.js` — kept OUT of `applyBilling()`, which stays a pure translation
with no network call. Only `started`/`renewed` and `payment_failed` say
anything. **Not wired to a live route**, waiting on the webhook. A card-failed
notice must never say a night is at risk.

Full reasoning: **[`docs/business/plumbing.md`](docs/business/plumbing.md)**.

### A phone must not say you were right before the projector does

`scoreBefore` on an answer, `positionsAtStart` on the question, and
`scoreToShow()` / `positionToShow()` in `src/engine.js`. Tap the right answer and
the running total at the top of your own phone used to jump instantly — so you
knew several seconds before the reveal, and so did the next table.

**THE FIX IS NOT TO SCORE AT REVEAL TIME.** Points come off the clock at the
moment of answering and the first-correct bonus depends on the order answers
land; the engine scores exactly as it did, and only what a PHONE is told changes.

- **The score** is held at `scoreBefore`, and **the position too**, or it is the
  same leak wearing a different hat. `positionsAtStart` is snapshotted once at
  `askQuestion()`, never worked out per push.
- **Somebody who has NOT answered sees their real total**, or a stale number
  becomes a tell in the other direction.
- **The host sees it live** and the projector cannot leak to a phone; both read
  `player.score` unchanged, with a test each.
- An answer recorded before this existed degrades to the live figure.
- **`hostView()` lists its clock fields by name rather than spreading
  `s.question`** — a whitelist is supposed to BE the decision (rule 1), and a
  spread quietly opts every future field in.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### The picture round's four reveals

`REVEAL_MODES` in `src/quizzes.js`: **zoom** (the fallback), **pixelate**,
**blur**, **tiles**. A round names one, a question can override it, and `mix`
rotates through all four **by position, not at random**, so a Redo mid-gig hands
the room back the effect they were half way through. **A GENERATED picture round
is `mix`** — it was not for two years of packs, and there is a test on it now,
because nothing else would notice it going missing.

**They all run on the same curve, and that is a SCORING decision** — see the
decisions table. Which is why **pixelate ramps its resolution GEOMETRICALLY**:
`PIX_FROM * (PIX_TO/PIX_FROM) ** shown`. Ramped linearly it solved about two
seconds in. **No `ctx.filter`** — the old-iOS trap `filters.js` exists to avoid —
and the `image-rendering` fallbacks are ordered least-known-last on purpose. **A
misspelt mode is a validation error**, never a silent fall back to zoom.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### How many questions of each type

`roundPlan()` in `src/generate-quiz.js`. `rounds` is a list of `{ type, count }`
— or bare type names, which take the fallback — so "fifteen general knowledge,
five pictures and ten first-letter" is one call. It used to be one number
applied to every round, which is not the shape of a quiz night.

The console has a count next to each round's tickbox. Unticking greys the
number rather than hiding it, so what you typed is still there when you tick it
back on. `roundPlan` is also the whitelist and the clamp, in one place, so a
typo is dropped rather than quietly becoming a round of general knowledge.

---

## Checks

```bash
npm test        # 1,571 tests, no network, injected clocks — must stay green
npm start       # then /console?key=... from the printed log
node scripts/shots.mjs --key KEY       # screenshots of a whole quiz
node scripts/shot-bingo.mjs            # bingo, incl. the card-reload check
node scripts/pub-unchanged.mjs HEAD~1 --ignore online   # did I break the pub night?
node scripts/drag-check.mjs             # Tonight's drags, with a REAL browser drag
node scripts/community-bay.mjs          # does the Community bay still fit the frame?
node scripts/pages-scroll.mjs           # can a person actually scroll each page?
```

**The rules these commands run on, and each was learned expensively — the full
account is in [`docs/checks.md`](docs/checks.md):**

- **`node --check` every browser file you edit.** Nothing in this repo executed
  `public/` for two years; a stray backtick in an HTML comment made
  `console.js` a syntax error and `/console` did not load AT ALL, for every
  quizmaster, with the full suite green. `browser-parses.test.js` closes it.
- **`pub-unchanged.mjs` is the one to run before a gig week**, and **compare
  against the branch you are merging into, not `HEAD`** — on a committed clean
  checkout `HEAD` IS the working tree, so it can only ever print IDENTICAL. It
  has been quoted as a pass twice while proving nothing.
- **When it says IDENTICAL, ask what it did not compare.** Four separate faults
  in that one script each made it answer confidently about something it was not
  looking at: it never sent a valid answer, it ignored the commit you named, it
  never looked at the lobby, and it printed the first 300 characters of two
  payloads that are nearly always identical. **A guard that quietly tests
  nothing is worse than no guard, because it is believed.**
- **A SYNTHESISED `DragEvent` IS NOT A DRAG.** The browser's own preconditions
  are where this bar keeps breaking: no `drop` fires unless `dragover` called
  `preventDefault()`, and none fires if `dropEffect` is one the source's
  `effectAllowed` forbids. A dispatched event enforces neither, so a test built
  from them passes while every pack drop is dead. `scripts/drag-check.mjs`
  drives the real mouse; run it after touching a drag handler.
- **A TEST THAT NEVER RUNS THE ARTEFACT PROVES NOTHING ABOUT IT.** Reading
  `server.js` as a string to check a route exists is how a broken Launch
  reached the live app with 1,150 tests passing.
- **NOTHING IN THIS REPO PRESSED A CONTROL, and a dead one draws perfectly.**
  A gap dial died twice in a week — a lost `import`, then a moved body calling
  the bar's `paintOrder()` from a module without one. Both are a
  `ReferenceError` on the PRESS, eaten by the click handler's catch, so every
  check passed. **`drag-check.mjs` presses the dial TWICE** — once proves the
  handler runs, twice proves it steps rather than initialises — and
  `imports-present.test.js` forbids any module but the bar naming a `paint*`.
  **A general "every call resolves" test was thrown away**: it cannot see
  parameters or destructured callbacks, which is how a leaf is MEANT to be
  handed these, so it found sixty falsehoods and one truth.
- **IMPORTING FROM A PAGE'S OWN MODULE RUNS THAT PAGE'S OWN BOOT CODE.**
  `console-packs.js` importing three helpers from `editor.js` ran `editor.js`'s
  top-level `#quizPick` listener on `/console`, where it does not exist — the
  whole console hung on "Loading your library…", for every account, and
  `node --check` saw nothing wrong. Shared code belongs in `client.js`, which
  has no page and no boot code, never in a file with a page of its own.

Beyond the unit tests, these were run by hand and are worth repeating after
anything structural: 60 phones with live SSE connections all answering at once;
`SIGKILL` mid-quiz and mid-bingo, checking the right question and every score,
card and mark comes back; and QR output decoded with a real scanner across
versions 1–10.

**A full software audit was run before handing out a second login — see
`AUDIT.md`**, which also records what an audit from a container CANNOT tell
you: real iOS Safari, pub wifi, a projector, and the photo round trip.

## The host key rotates on every deploy unless HOST_KEY is set

This locked him out of his own console, on his phone, the first time he went to
make an account — so it is worth knowing before anything else on the live app.

`hostKey()` in `src/config.js` uses `HOST_KEY` when it is set, and otherwise
**invents one and writes it to `data/`** — which on Render's free tier is empty
again after every deploy. So each deploy silently hands out a different key and
every bookmark stops working, with nothing on screen explaining why. The startup
banner now says so (`hostKeyIsTemporary()`), because "failure messages have to
name the cause" applies to setup as much as to generation.

**If he says his bookmark stopped working, this is why.** The current key is in
the Render startup banner on the `Host key:` line. The fix is one environment
variable and it is step A of TODO.md.

---

## The host's deployment

- Live app: **https://musicquizapp.onrender.com**
- Render service: `srv-d9pnk0e417fc73bvjdkg` (Frankfurt, free tier)
- Repo: https://github.com/markh1984-spec/MusicQuizApp

Render's newer UI nests the service inside a project. `/project/prj-…` is the
wrong level and its "environment groups" are unrelated to environment
variables; `/web/srv-…` is the right level. This cost the host a lot of
clicking — do not send him to the project page.

---

## Where to push

**There is one branch: `MusicQuizApp`.** It is the default and the only one.
There is no `main`. Render watches it, so anything not pushed there does not
reach the live app.

Push straight to it — the host asked for that rather than merging by hand.

**Do not create or push to `claude/new-session-jzx988` or any other session
branch.** It existed, it was identical, the host deleted it deliberately and
asked for the repo to stay tidy. Pushing a session branch would silently
recreate it.

---

## Current state

Moved to **[`docs/history.md`](docs/history.md)**.
