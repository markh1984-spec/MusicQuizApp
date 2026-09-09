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
everybody in the room has it, and joining is an ordinary web request. Measured
against a running server: **300 joins landed in half a second.**

Over the threshold, new phones are asked to wait rather than turned away, and
the host's board says **"288 phones waiting to join — Let them in"**. One tap
lets the lot through and holds the door open.

**The NUMBER is what tells the host which it is.** Eighteen is a room; 288 is
somebody messing about. That judgement takes a human a second, which is why it
is not automated.

**AND IT EXISTS ON A BINGO NIGHT TOO — `joinQueuePanel()` in `client.js`.** The
count was delivered in every payload and **nothing drew it**: no number, no
button, while every held phone read *"The host is letting everybody in"*. The
other remedy threw — `removeIdle` is one dispatch for both engines and
`bingo.js` had no `removeIdlePlayers()`, so it was a **500**. **The panel is
SHARED, never copied**, in `client.js` because a page module may not be
imported by another page.

**A PHONE THAT CAN PROVE WHO IT IS NEVER QUEUES.** Only joins that would create
a NEW player are counted; a rejoin carries a token (rule 3). A redeploy or a
wifi blip sends the whole room back at once — two hundred reconnects in a few
seconds looks exactly like a flood, and holding them would be a self-inflicted
outage mid-quiz.

**The threshold errs LOOSE, and the asymmetry is the whole reason.** Too tight
and a real room gets a "just a moment" screen while the host is on a mic and
not looking at their phone, which is the show stopping and this app's fault.
Too loose and some junk teams reach the scoreboard — which no player sees, and
which "remove the ones who answered nothing" clears in one tap.

The gap makes that free: a pub peaks at two to six joins a second, two hundred
people online clicking a link is five to ten, and a script does six hundred.
The threshold is twelve.

**Per-IP limiting is the obvious answer and it is wrong**: a pub puts the whole
room behind one router, so it refuses the actual customers first. One rule that
holds in both modes beats two that each work in one.

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

**AND `boot()` MUST CHECK THE JOIN GATE'S 202 LIKE THE OTHER TWO DO.**
Reopening a held phone did `saveMe({ waiting: true, … })` — **over its stored
id, token and team name** — then opened a stream on an id the server never
issued. A bare join box with the name gone reads as being thrown out, which is
this rule exactly.

**AND AN ANSWER THAT DID NOT SEND PUTS THE BUTTONS BACK — `paintUnlocked()`.**
The catch's comment said the buttons come back on the next update; nothing did
that, `updateScreen()` only ever PAINTING a choice. One dropped POST cost that
team the whole question **and told them they had answered it**. A `.picked`
tick is left alone on a multi round, so one tap re-sends.

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

**AND A COMPOSED NIGHT CARRIES ITS OWN ORDER — `state.order`, written at
launch.** Every night from a saved show, and every night with a round unticked
or two packs mixed, has `pack.id === '~tonight'`, which is not a file: so
`boot()` judged the saved state to belong to another pack and threw the whole
night away — scores, team names, the lot — while the projector read "No quiz
loaded", and the first reconnecting phone wrote `packId: 'empty'` over
`state.json` within seconds. **The order was never on disk, so it was
architecturally unrecoverable.** On Render every push is a restart, so a docs
change mid-quiz ended a show night. It recomposes through the SAME loader, so
rule 11 is untouched.

**AND `boot()`'S DOCUMENTED FALLBACK NOW HAPPENS.** *"always builds a game so
the projector is never blank"* is written three times in `session.js` and was
not true: an id that would not load went straight to `launcher.empty`, so
deleting the pack a night was running on left the projector blank beside a
shelf full of packs. **A DIFFERENT pack, and one with something IN it** —
retrying the id that just threw is the same failure twice, and an empty pack
is `launcher.empty` wearing a name.

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

**AND THE THIRD FLAG IS THE PHOTOS SLIDE, WHICH ONLY CLEARED ONE WAY** — so
the room looked at the photographs while the host's button said the scores were
up, and pressing it did nothing.

**AND A CARD KEY IS A FINGERPRINT OF WHAT IT DRAWS, NEVER ONE FIELD OF IT.**
A key is STABLE on purpose, so naming one field — or nothing at all — lets
everything else change unseen. Four sightings, all silent, all with the PAYLOAD
correct: `ad:${heading}`; the break rotation on `breakAdverts.length`;
`q:round:question`, so **a question corrected mid-quiz never reached the room**
and a moved ANSWER lit the new index against the old options, against rule 11;
and `final` with no `update` at all — **a score fixed in front of the room
announced the wrong team in gold at 13vh** while the voucher went to the
engine's winner. **`view.question` is the static half**, the clock and the
reveal banner being siblings, so this cannot rebuild a card mid-answer.
`reaches-the-wall.mjs` drives all of it.

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

**AND A CREATE MAY NOT LAND ON A PACK THAT ALREADY EXISTS.** The editor's *New
quiz* slugs the title into an id, so typing one that was already there opened
that pack with a one-question stub in hand and one Save wrote it over — this
rule running backwards, `reloadPackEverywhere()` pushing the wreck into a game
already running. The browser refuses it and `POST /api/quiz` answers 409, **in
`saveOwn()`'s own words**. **`PUT /api/quiz/<id>` is the edit** and is
untouched.

**AND A TEST MAY NOT WRITE THE SHIPPED CATALOGUE.** `QUIZ_DIR`/`BINGO_DIR`
default to the repository's own folders, so `live-server.mjs` hands every live
test a COPY. Verifying the refusal above meant taking it out for one run, and
that run replaced `1980s-pop-music.json` with the stub in the working tree.
**A guard that can damage the thing it guards is one nobody should have to
remember to be careful around.**

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
- **The console wears a gauntlet cursor — open hand, closed fist while dragging — and scroll rods on its panels, console only** — and the public gallery since 31 August 2026. Never the projector or a phone.
- **No profanity filter on team names** — **in the ROOM. Do not add word
  filtering to the projector, the phones or the console.** The public league
  page and the landlord's report are the one exception, and it is a SCOPE
  rather than a reversal — see *filtered at the door, never in the room*.
- **Photo uploads auto-publish** — Do not add one.
- **Photos go in a SEPARATE PRIVATE repo** — Never the main repo: it is public (checked), and git history is forever.
- **Filters are pixel maths, not `ctx.filter`**
- **"Filters" means PROPS, and the colour grading is GONE** — positions are a **fraction** of the canvas, never pixels.
- **THE PHOTO CAN BE MIRRORED, and it is a BUTTON rather than a detection**
- **THE PHONE MUST NOT SAY "look up" WHILE A QUESTION IS ON** — `PHOTO_PHASES` in `screen.js`: photos at the lobby, a round board and the end only, because twenty seconds and four options wants the whole screen. **AND A BIG PHOTO COMES DOWN THE MOMENT THE PHASE HAS NO ROOM FOR IT — `stopBigPhotos()` in `draw()`.** The queue chained `setTimeout`s nothing could reach, so photos posted at a round board went on landing through the next question, and the host's kill switch could not take them down. `pointer-events: none` means `elementFromPoint()` reports the options visible, so only the render finds it. **In `draw()`, never in `paintPhotos()`**, which is where the strip is BUILT.
- **A VENUE'S LOGO GOES ON THE WINNER'S VOUCHER, and nowhere else** — **THE WORDS STAY THE PRIZE**, in text underneath. **Never an image with the prize written inside it.** **NOT on the projector, and that is BYTES rather than secrecy.**
- **The room is told what it is playing for**
- **SECOND AND THIRD ARE A PODIUM, not a caption** — **and the podium is the TOP THREE. Do not put a fourth back.**
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

### THE METALS ARE THREE TOKENS AND A SHEEN — `--metal-*` in `style.css`

Bronze / Silver / Gold mean a TIER, and second and third on the podium.
**`--gold` is a different job** — the trophy colour — so they stay separate
tokens even though the hex matches: two jobs, not one colour.

- **THEY WERE WRITTEN OUT SIX TIMES WITH SEVEN VALUES** (bronze was `#cd7f32`,
  `#cd895a`, `#e0a066` and `#cd8c58`) — a rule nobody was applying, exactly
  like the radii below. **Add a metal surface by naming the token, never a
  hex.**
- **A HIGHLIGHT IN THE TOP CORNER PLUS A SHADOW IN THE FAR ONE**
  (`--metal-sheen`). Rendered against a plain 120deg sweep first: the sweep is
  louder and says nothing extra, and **the corner pair still reads at the 24px
  chips**, where a sweep is only a lighter dot. It is a POSITION, not an angle,
  so the rule below stands — and it is ONE position everywhere, which is that
  rule's own discipline.
- **FILLS ONLY. METAL TEXT STAYS SOLID** — rendered at 11, 17 and 26px, a
  gradient on text is indistinguishable from flat at every size this app uses.
  **The sheen LAYERS OVER the flat colour**, so the metal stays one token and
  is still readable as a `color` by `color-mix` and by text.
- **A `background` SHORTHAND RESETS `background-clip`** — the `border` trap
  this file records, wearing another property.

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

### THE CONSOLE IS ONE FILE PER DOOR OR TAB, AND THE STATE MODULE IS WHY IT WORKS

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
- **ANYTHING READING THE CONSOLE AS TEXT READS THEM ALL** —
  `test/console-source.js`. Five checks were pointed at the one file; three
  failed loudly, which was luck. A grep aimed at the wrong file proves nothing,
  which is this repo's oldest lesson wearing another hat. **Named rather than
  counted: a COUNT goes stale silently** — three places said twelve when there
  were twenty-one.

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

Settled on 14 August 2026. **The bank details are the quizmaster's OWN,
printed on every invoice they send**, and the venue records are BUSINESS
contact details already on the pub's own website — encrypting data whose whole
purpose is to be handed out is theatre. **No card details are stored and none
ever will be.** Server-side encryption where the SERVER holds the key buys
almost nothing and costs everything in the one shape this app has been bitten
by: the free tier wipes the disk every deploy, so the backup IS the data, and
losing the key makes the invoice book landfill. **AND INVOICING IS OPTIONAL**,
which is the host's own clincher — the data is there because somebody chose to
put it there.

**NEVER CLAIM IT CANNOT BE READ.** That would be a lie, and it is the rule
this file already sets for own-packs: the honest pitch is *"the app will not
let me in unless you let me, and here is the log"*, never *"I cannot see it"*.
**Instead of encrypting, do not store what is not needed** — a venue needs a
name, an address and one email, not a phone number nobody dials.

Full reasoning: **[`docs/business.md`](docs/business.md)**.

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

### THE CONSOLE'S POLISH PASS — the rules from one sweep, 25 August 2026

Full reasoning, with the measurements: **[`docs/console.md`](docs/console.md)**.

- **THE CONSOLE'S TOPBAR IS A GRID ITEM, AND A GRID ITEM DEFAULTS TO
  `min-width: auto` TOO** — **a clipped overflow is worse than a scrolling
  one**: nothing throws and the control is unreachable.
- **…AND CONSTRAINING IT MOVED THE OVERFLOW ONTO THE MENU**, so **My account
  was not there**. **A door you cannot see does not exist**, and **a fix that
  relieves pressure has to be followed to wherever the pressure went.**
- **THE DIET HAS NO UPPER BOUND, BECAUSE `.console .wrap` CAPS THE BAR AT
  1180px** — **a media query on the window is the wrong tool the moment a
  CONTAINER caps what you are protecting.**
- **WHAT IS PLAYING NOW IS WORDED IN ONE PLACE — `nowPlaying()`.** There were
  THREE. **The SHORT form is a different job, not an abbreviation**, and
  **under 1050px the live line stands down.**
- **THE BAR GOES ON A DIET; WRAPPING IS ONLY THE FALLBACK** — two rows read as
  a second bar. **Scoped with `:has(.hat-switch)` to the OWNER's bar**: a fix
  for one account must not land on everybody. **AND IT NEVER TAKES THE
  POSSESSIVE** — it hid the stacked wordmark, so the one bar this rule reaches
  lost its own name off its own console. **THE WHOLE WORDMARK SHOWS AT 1180px
  AND UP** — *"the whole point is to have [QM's] Quizporium"* — **and that
  number is the CONTAINER's, which is what makes a media query right here**.
  **Below it the product name gives way and the possessive stays.** **BELOW THE
  CAP THE BAR WRAPS AT 960 AND THE WORDMARK IS NOT WHY** — `#hatSlot` drops.
  **KEEP THE GATE AT THE CONTAINER'S NUMBER**: the switch measures 310px or
  387px depending on whether a host KEY is in use, moving any bisected
  threshold by ~77px.
- **AND `setViewportSize()` IN A LOOP IS NON-DETERMINISTIC HERE** — the same
  sweep read the wrap at 1090 then 960, a recalculation race against `:has()`.
  **Navigate fresh per width and poll twice 250ms apart until two readings
  agree**, or the threshold is whatever the timing gave you.
- **AND NOTHING RESTATES `overflow` AFTER `.console .wrap`'S PAIR.** A trailing
  `overflow: hidden` wiped the `overflow-y: auto` five lines above, so the frame
  CLIPPED and a real wheel moved nothing — the fix written for it had never
  once been in effect. FOURTH sighting of shorthand-beats-longhand, inside ONE
  block. **`console-frame.mjs` turns a REAL wheel** — a programmatic scroll
  succeeds on a clipped box.
- **THE FIXED FRAME NEEDS A MINIMUM HEIGHT. LETTING THE BAY SHRINK INSTEAD WAS
  TRIED AND IS WORSE** — it painted over the tab column. **The numbers said
  fixed and the render said broken**, which is why the screenshot is the
  check.
- **AND THE FRAME'S MINIMUM HEIGHT IS TWO NUMBERS, BECAUSE THE DOORHEAD IS TWO
  HEIGHTS. Do not collapse it to one**: one either takes the frame off a
  1500x900 laptop that fits it, or keeps it at 960x760 where it does not.
- **THE EQUAL-BAY RULE ONLY EXISTS BECAUSE OF THE FRAME**, so
  `community-bay.mjs` checks it only where the frame is on. **Both scripts
  carry the frame's two numbers; they move together.**
- **TWO COLUMNS IS A WIDTH DECISION; THE PINNED FRAME IS A HEIGHT ONE.** Gating
  it on height took the SIDEBAR away too — the rail holds at every height and
  only the pinning goes. **A media query is two decisions the moment it names
  two axes.**
- **`main` IS A FLEX COLUMN — never give it a row template.** Its
  `auto minmax(0,1fr)` grid assumed two children, so a banner above the doorhead
  turned the fixed frame back into a scrolling page.
- **THE SHELF IS SIX ACROSS, BY DECISION — it mirrors the six bays above it.
  Do not "fix" a squeezed card by dropping a column** — where six cannot be
  honoured, both grids move together (see below).
- **THE FINISH LAYER at the foot of `style.css` owns selection, caret,
  `:focus-visible` and the card hover** — one named block, so the next control
  is finished there rather than in scattered rules.

### THREE THINGS THAT DID NOT FIT, AND THE SIZES NOBODY MEASURED

Every one lived in a band no guard looked at.

- **THE LOBBY'S JOIN PANEL IS CAPPED BY THE SCREEN'S HEIGHT** — `min(100%,
  72vh)`. A QR code is square, so on a WIDE, SHORT projector **the code was
  166px off**, on a page that does not scroll. **72vh is measured, not
  chosen.**
- **THREE ACROSS BETWEEN 561 AND 779px, AND BOTH GRIDS MOVE TOGETHER.** Six
  across needs 768px inside the panel, and a shut pack card is a square with a
  118px floor — **`aspect-ratio` plus `min-height` propagates to a minimum
  WIDTH**. At 561 the cards **overlapped by 28px**. **This is not six-across
  being dropped.**
- **`#hatSlot` IS A BARE `<span>`, SO IT HAD `min-width: auto`** — third
  sighting on this bar. The span would not give ground, so **`/host` scrolled
  sideways 161px at 390 and 231 at 320**. **The switch itself shrinks below 560
  too** — a label losing its tail is what this bar can afford; a door off the
  screen is not.
- **AND `console-frame.mjs` NOW LOOKS AT 768 AND 320** — its sizes ran 390 then
  960, leaving the 561-899 band unmeasured. **Its one-row rule moved from 431px
  to 900px.**

### A ROOM ID IS A PATH, AND `?q=` NAMES AN ACCOUNT OR NOBODY

`isRoomId()` / `GALLERY_NONE` in `src/rooms.js`, `galleryRoomFrom()` in
`server.js`. Found by a sweep and reproduced end to end with no cookie and no
key.

- **A ROOM'S FILES ARE `path.join(dataDir, 'rooms', roomId)`, so `..` WALKS
  OUT** — and `..` alone resolves to `dataDir` ITSELF, which is the HOUSE
  room's own `state.json`. `GET /api/brand?q=..` minted a shadow room over the
  projector's crash-recovery file, `POST /api/join` wrote a player into it, and
  the next restart booted the room from a stranger's state. **That is protected
  surface item 5, from two unauthenticated GETs.**
- **REFUSED, NEVER QUIETLY SWAPPED FOR THE HOUSE ROOM.** `get()` throws a
  `badRequest` on anything outside the alphabet this app actually mints. Falling
  back to HOUSE is the same fault wearing a friendlier face — it hands somebody
  else's room to a caller who asked for nonsense.
- **AN UNKNOWN `?q=` STILL ANSWERS AS AN EMPTY GALLERY**, deliberately: a 404
  would let anybody probe which account ids are real. It lands on ONE reserved
  room now instead of minting a room, a join code and a backup push per junk
  string — `rooms.get()` never evicts and `codeFor()` persists, so an open URL
  was a memory leak and a GitHub-quota leak at once.
- **AND A JOIN CODE IS REFUSED THE SAME WAY — `roomForPhone()`.** It fell back
  to HOUSE, so `/play?g=ZZZZ` said *"You're in"* under the owner's branding,
  minted a real id and token in the OWNER'S room, and served his loaded quiz to
  anybody on `?role=screen`. **The trigger is real**: the join-code backup
  raced, so a printed QR could stop resolving after a deploy and the whole room
  joined the owner's game. **NO CODE AT ALL is still the house room** — his own
  projector, and every card printed before rooms existed.
- **AND THE CODE BOOK IS WRITTEN ONE AT A TIME, NEWEST BOOK WINS.** One page
  load fired N concurrent unawaited PUTs of the same file, each carrying the
  snapshot taken when it was queued: **four of six quizmasters' printed QR
  codes changed across a restart.** Coalescing to the latest is safe precisely
  because each is the WHOLE book. **A failure is said out loud** — a silent one
  is a printed QR found dead by a room in front of a projector.
- **`galleryAsked` AND `galleryTarget` ARE TWO VALUES.** One is *was a gallery
  named* (which stands the owner's preview shortcut down); the other is *which
  room that resolves to*. Folding them hands the shortcut back on a junk `?q=`.
- **AND THE RULE IN `own-packs.js` NEEDS READING WITH THIS**: "no room parameter
  on any route" is now "no room parameter on any route that reads or writes a
  room's CONTENTS". `?q=` names a gallery and is validated against the accounts
  book. The packs guarantee itself is unchanged and still holds.

### A DECISION TAKEN FOR BOTH ENGINES NEEDS AN ASSERTION IN BOTH

`engine.js` closed the player-id leak, wrote up why, and grew a test walking
every phase of a quiz. **None of it reached `bingo.js`**, whose lobby list went
on sending `{ id, name }` for months.

- **AND READS TAKE NO TOKEN**, by design — so one id off the projector returned
  that player's whole card, every mark on it, and their voucher CODE once they
  won. Rule 3 held for ACTIONS; this was read access, and on bingo the cards ARE
  the game.
- **The bingo test is the quiz test's TWIN, not a spot check** — same walk, same
  assertion, verified by putting the fault back. Same argument `src/arcade.js`
  exists for: two copies of one rule is one rule that gets fixed once.

### WHAT A PART BOUNDARY CARRIES — `nightWideOpts()`, and nine things it did not

A running order builds a FRESH engine per part, so anything night-wide has to
be handed over explicitly. Every one of these failed silently.

- **`winners`** — vouchers are only issued by the LAST part, the one that never
  received it, so the picker was 100% inert: asked for one winner, three drinks
  went out.
- **`lobbyGames`** — *"Let them choose"* switched itself off after part one.
- **THE TEAMS, AND THE MAP GOES ON BEFORE ANYBODY IS SEEDED.** `join()` deals a
  random-mode player the moment it is called, so seeding first re-deals the
  room — which `teams.js` forbids.
- **`archivedAs`, so an evening files ONCE.** The flag stopping a second
  archive lived on a state the boundary throws away: two rows in Past gigs and
  two league contributions, for one night.
- **THE VOUCHERS, MARKED `carried`** — see the bingo section above.
- **THE QUIZ'S OWN RESULTS — `state.quizSoFar`, so a night that ENDS ON THE
  BINGO still files its scores.** The archive reads the LAST part's engine, and
  `bingo.results()` has no positions and no scores — so `league.js` dropped the
  night for having `kind: 'bingo'` and the report had no podium. **The night is
  filed as the QUIZ it was, with the bingo named in `parts`**: `kind` moves
  with the board, or the league holds a quiz's scores and refuses to read
  them.
- **`state.removed`, which IS rule 5.** A fresh engine starts with an empty
  list, so the phone the host threw out was told `rejoin` rather than `kicked`
  and walked back in with the same name and a live card.
- **THE ORGANISERS — `everyone()`, never `playerList()`**, which filters them
  out by design. The client's own contact rejoined as a contestant: on the
  leaderboard, on the projector, back channel gone mid-event. **Put back after
  `join()`, like the token.**
- **THE HOST'S REQUEST, NEVER THE RESOLUTION — `lobbyGameWanted`.**
  `state.lobbyGame` is a resolved id indistinguishable from a choice, so
  carrying THAT turns "no preference" into a permanent override; leaving it out
  lost a PINNED game from part two while the bar still named it. **And the list
  is ROTATED so the kind's own default leads** — a bingo interlude's chooser
  opened on Maze Mouth, the quiz's default.
- **AND A COMPOSED PART NAMES ITS `sources`.** `~tonight` matches no pack on
  any shelf, so a quiz played inside a running order read as **"Never played
  here"** at the venue that had just heard it.

**AND `moreToCome()` EXISTS NOW.** `host.js` had said *"the server refuses it
as well"* since running orders were built and there was no such function — **a
comment that claims the opposite is where the next bug hides.** Any stale
control view still draws *Stop the quiz*: night filed two hours early, a real
voucher to whoever led after round one. **Bingo's `Finish` is deliberately NOT
guarded** — it is the stated escape hatch and its confirm names what it costs.

### EVERY READER AND WRITER OF `leagues-published.json` USES `galleryRoomFor`

- **A READ AND A WRITE THAT DISAGREE ABOUT THE ROOM IS INVISIBLE.** The league's
  three writers used `roomForHost` (HOUSE for the owner and the host key) while
  the public page reads the owner's own quizmaster room, so a table could be
  published, be told it worked, and read back as *"Not published"*. No change for
  an ordinary quizmaster — their room id is never HOUSE.
- **`inOrder()` PER ROOM, like `gallery.js`** — three callers each read the file
  whole and write it back, so a name ruling overlapping a publish put the old
  value back and silently un-published the table.
- **A FOLD MUST RESTORE THE ORDER IT DEPENDS ON.** `leagueTable()` says "newest
  first" three times and leans on it for the season start, for which spelling of
  a name wins, and for `evenings`. Two sorted runs concatenated are not one
  sorted run.
- **AND THE REPORT MASKS THE WINNER, not just the table** — it printed the
  podium raw three lines above a masked season table, in one document. The filter
  is `publicName()` at the ROUTE, so it keeps one definition and the PDF stays a
  layout.
- **AND THE THIRD SIGHTING IS PAST GIGS' OWN JOIN — `gigRoomsFor()`.** It
  joins the archive from `roomForHost()` to photo folders from
  `galleryRoomFor()`, TWO ROOMS for the owner and the host key: a night hosted
  under one hat and photographed under the other found no record for its date
  and came out **with no pub on it**. **The archives are UNIONED, never
  swapped** — both are his, and picking one moves his history. **The photo
  folders are deliberately NOT unioned**: the per-night read, the lamps, the
  pins and the published flag are ONE room, so a listed night the opener cannot
  fill is a row that lies. **The guard is on the SHAPE**, and **skips the five
  calls passing `[]`** or it needs an exceptions list.
- **AND FOUR THINGS PUT A ROW IN "No venue on these", ALL SILENT —
  `whyNoVenue()`.** That miss, a night that never reached its final scores, no
  venue picked, and two venues on one date. **"No results saved" is Post gig's
  own wording**, not a second phrase for one fact.

### ONE PUB IS ONE PUB — `sameVenue()` in `past-gigs.js`

Fourth sighting of the id-versus-typed-name split, so it is a function now. **An
id beats a name; a name matches a name; an EMPTY venue matches nothing**, or a
night with no pub lands in every pub's season. The report and the projector's
league band both compared venue STRINGS, and one did not even trim.

### THE SUPPORT LOG IS MATCHED EXACTLY, NEVER BY PREFIX

`SUPPORT_QUIET` in `server.js`. It was wrong in both directions: `/api/me` on
the quiet list covered every `/api/me/*` WRITE, so changing somebody's colour
scheme — what their projector and sixty phones wear — left no line; and
`/api/live` is not a route in this app, so every SSE reconnect wrote one and
evicted real entries from a 500-line log. **A route belongs on that list when a
LINE would be noise, never when the ACT is dull.**

**AND `safe()` STRIPS `calendarKey` AND `reset`.** The calendar key IS a
credential — one GET with no cookie returns somebody's whole diary — and it rode
out on every `/api/me`. `/api/calendar/link` is the route that exists to hand it
over.

### TWO MORE WHITELISTS THAT DROPPED WHAT THEY DID NOT NAME

The trap this file already records for `accounts.create()`, `shows.js` and
`doLaunch()`, found twice more:

- **`Accounts.restore()` DROPPED `tiers` AND THEN SAVED THE LOSS** — and it runs
  whenever the disk is empty, which on Render's free tier is every deploy. The
  note above `tiers` says storing them in that file exists to prevent exactly
  that. Nothing 403s, so nobody notices.
- **`shows.js` DROPPED `questionSeconds`**, so a night saved at thirty seconds
  came back at the pack's own pace.
- **AND GRANDFATHERING ASKED THE RAW ACCOUNT.** A group seat holds its PARENT'S
  tier, so `featuresFor(a)` rather than `featuresFor(effective(a))` made every
  seat lose a feature in the same second its parent was grandfathered — and the
  "N accounts kept it" line under-counted, so nobody would know. Seats run nights.

### A COMMENT THAT CLAIMS THE OPPOSITE IS WHERE THE NEXT BUG HIDES

Third sighting, and the clearest yet. `tonightAsShow()` carried *"read off the
SAME module-level state the launch reads, deliberately, so a saved show and the
night that would have been launched cannot differ"* — while reading
`currentPack`/`lbExtra`, which stopped being the truth the day packs began
BURSTING into a tile per round. A bar holding five tiles across two packs saved
a show with one pack in it. **It is built from `segmentsNow()` now, which is
literally the call the launch makes.**

### THE LABELS THE SWEEP RENAMED — do not rename them back

Each was two controls on one screen sharing a word for different sets, which
rule 1 says is a rename rather than an argument:

- **`Lobby game`**, not `Game` — it named the arcade toy 73px above the
  unlabelled control that picks quiz-or-bingo. That one has an `aria-label` now.
- **`Bingo prizes`**, not `Prizes`, and the warning says **"No VENUE prizes
  set"** — the bar could read *Prizes 5* under *No prizes set*. One is the
  card's stopping points, the other the venue's list of what is on the table.
- **`In the room` / `Online`** on the mode switch, not `Venue` — which was
  chosen so it would "read as one question with two answers" with the venue
  button beside it. That is the collision, stated as the reason. The project
  notes had said IN THE ROOM all along.
- **`Pack editor`**, not `My packs` — the panel under it means the packs you
  WROTE; the link opens an editor listing the whole catalogue.
- **`Photo link to the room`**, not `Photos to the room` — it puts up a QR and
  no photographs, four inches under a panel headed *Photos on the big screen*.
- **`Open the projector`**, not `Big screen`, and **`Edit this pack`**, not
  `Edit` — the first was the only control naming the projector that does not
  ACT on it, six inches from *Scores to the room* which does; the second was a
  bare verb whose object lived in a tooltip a phone never shows.
- **`Change the prizes`**, and its tooltip no longer says *"takes effect from
  the next prize onward"* — that was true once and is the reason both engines
  were changed to pay anybody already owed. It told a host looking at a blank
  winner's phone that the one control which fixes it would not help.
- **AND THE NINE LAUNCH-BAR LABELS ARE NOT SHOUTED.** `text-transform:
  uppercase` on `.pack-shape` fought sentence-case markup, so the diff looked
  right on either side. Capitals are for emphasis; the rule names three
  exceptions and nine multi-word labels are none of them.

### A FIELD ON A VIEW IS A PROMISE THAT SOMETHING DRAWS IT

`canStart`, `msRemaining` and `rounds` were built on every host push and read by
nothing — `rounds` mapped the whole pack each time, and during a question a host
push is every time a team answers. `teamScores()`'s `members` list was the same,
with a `key` that was always `undefined`. **Removed rather than left**: the
arcade board sat in a payload for as long as the feature existed with nobody
drawing it. If the control view wants a round list, draw one.

### THE LOBBY GAMES — AND NONE OF THEM IS NAMED AFTER THE ONE YOU ARE THINKING OF

`public/assets/maze.js` + `lobby-game.js` (Maze Mouth), `rally.js` +
`lobby-rally.js` (Rally), `tailback.js` + `lobby-tailback.js` (Tailback),
`lobby-games.js` (the list and the tiers, read by the SERVER and the browser),
`lobby-menu.js` (the card and the loaders), `lobby-board.js` (the projector's
board), `src/arcade.js` (the scores, shared by both engines),
`state.gameSeed`, `state.arcade`, `state.lobbyGame`.

- **THE ROOM PICKS, AND THAT IS THE DEFAULT — `lobbyGamesFor()`.**
  **`ANY_LOBBY_GAME` is a SENTINEL, never an empty string** — empty already
  means *"nobody said"*. **Resolved at the LAUNCH ROUTE against `tierInUse`**;
  **the phone honours the list and re-checks nothing**. **`null` rather than
  `[]`, SPREAD in only when it exists**, so `pub-unchanged` still says
  IDENTICAL. **A list of ONE is dropped.**
- **THE QUIET LAUNCH SENDS THE WHOLE NIGHT — `nightOpts()`.** Tapping a pack
  sent FIVE of Launch's twelve fields. **One `nightOpts()`, spread into all
  three launches**, with a test that fails if a fourth writes its own.
- **ONE ROW EITHER WAY, AND THE CHOICE IS ONE TAP INSIDE IT** — a row per game
  is **423px of menu** at 390px. **The box opens on the CHOOSER and nothing
  runs yet.** **Switching calls `stopArcade()` first and RESHAPES the canvas**,
  or a loop banks under the wrong game.
- **NO PHOTO GATE, AND ONE WAS PROPOSED AND TURNED DOWN** — **it prices
  consent**; *sending it is the consent*.
- **THE BOARD SAYS WHICH GAME EACH SCORE WAS ON — `state.arcadeGame`, a map
  BESIDE the scores. Never folded into `state.arcade`** — that is
  `{id: number}` in every state file there is. **The id is a LABEL.**
- **QUICK DRAW'S OUTLAW RAISES ITS GUN** — *how close is this one to shooting
  me* was information the schedule held and the canvas never drew. **It changes
  what the game IS**: without it the winning move is to tap the instant
  anything appears.
- **THE DEFAULT FOLLOWS THE GAME, NOT THE ACCOUNT: Maze Mouth before a quiz,
  Rally before the bingo.** A remembered preference is wrong on half the nights
  of anybody running both.
- **WHICH GAME IS A DECISION ABOUT TONIGHT**, chosen on the launch bar and
  written into `state.lobbyGame`. **THE TIER IS CHECKED AT THE ROUTE, never in
  the console**, and a game above the tier is **dropped in favour of the
  default rather than refused**: losing a choice costs a game nobody has seen,
  refusing the launch costs the night.
- **THE TIER GATES HOW MANY GAMES, NOT WHETHER THERE IS ONE. THE ONLY THING
  GATED BY TIER RANK RATHER THAN A `FEATURES` FLAG, so they ask `tierInUse()`
  and never `tierFor()`** — a comped account holds every FEATURE while `tier`
  still reads `bronze`, and **nothing threw because the console agreed with the
  room, both wrong the same way.** **Do not sell the game itself away from the
  bottom tier** — a phone with a game on it stays in the FOREGROUND. **Locked
  games are SHOWN.**
- **THEY ARE CALLED MAZE MOUTH, RALLY, TAILBACK, QUICK DRAW AND LAST ORDERS.**
  The names and characters the first three resemble are Namco's and Atari's and
  this app is SOLD — a legal line, not a taste one. **An unnamed game keeps
  inviting the wrong name.**
- **PILE UP IS DELETED, AND TETRIS IS STILL THE REASON.** **The shapes were
  not the only thing held protectable in *Tetris Holding v. Xio*** — the well
  and the piece behaviour went with them, and this app is SOLD; **and triangles
  do not tile a square grid**. **Do not rebuild it.**
- **LAST ORDERS REPLACED IT, and its legal line is a DIFFERENT one.** Taito
  owns the NAME and the specific sprites, **not** a formation descending on a
  defender. So: **not called Space Invaders, no crab/squid/octopus, no 5x11, no
  saucer, no bunkers**, with a test on the words. **Tap-to-destination and it
  fires itself** — auto-fire makes POSITIONING the game. **Reaching the bar
  ends it outright.**
- **THREE WAYS A GAME IS MADE THE SAME ON EVERY PHONE, and a new one must use
  one:** a fixed-step GRID, a capped ACCUMULATOR of whole ticks, or a SCHEDULE
  pure in the seed and T. **A frame delta is none of them and is always wrong
  here.** A REACTION game makes input latency part of the score, so its
  windows stay generous.
- **ONE SCOREBOARD FOR BOTH, in `src/arcade.js`** — the same clamp, the
  best-not-latest rule and the refusal outside the lobby. Two copies is two
  rules and one gets fixed.
- **RALLY RUNS ON A FIXED TIMESTEP, NEVER A FRAME DELTA** — advanced by `dt` a
  120Hz phone and a 30Hz one play different games. **Capped**, or a phone face
  down for two minutes spends the gap in one frame.
- **EVERY PHONE PLAYS THE SAME GAME**, seeded from `state.gameSeed` at launch,
  or the board compares two different games.
- **IT CANNOT REACH A QUIZ**, tested each half: the seed is in the phone's
  payload at the LOBBY only, and a score is refused at any other phase.
- **Behind a button, below the photo card** — *"don't want to disincentivise
  photo uploads"*; imported only when pressed.
- **No control panel: you tap and it walks there** — a swipe has to be READ
  and a misread one costs a life. `touch-action: none` is load-bearing. **A
  fire button plus movement is a control panel too.**
- **A TURN PRESSED EARLY IS REMEMBERED** — a HEADING plus a buffered WANT, and
  **a wall stops you facing it and never picks a direction for you**. **The
  rule lives in `maze.js`, not the canvas file.**
- **TAILBACK'S TAIL IS FATAL AND ITS WALLS ARE NOT, and that split is the
  whole game.** `stepToward()` is GREEDY — **it still never returns a cell
  inside the body**, so a life is never taken for a route the player did not
  choose. **Six lives at 170ms, not the four asked for.**
- **THE BIG SCREEN IS ONLY PROMISED WHERE THE BOARD DRAWS** — generalising to
  *a break that offers a game* moved the guards and not the phone's line, so a
  break told sixty people *"Top scores go on the big screen"*.
- **ONE POST LEAVES A PHONE, at game over and at each life lost** — never a
  stream of positions, and banking per life puts the people who played LONGEST
  on the board.
- **THE GAME IS STOPPED IN `buildScreen()`, ON EVERY REBUILD** — torn down
  inside `wireArcade` it survived the quiz starting. **A teardown belongs where
  every phase change passes.**
- **Each moment has a primary: the game before the quiz, photos between the
  rounds** — the camera button stands down at the lobby.
- **MAZE MOUTH'S DEATH IS A GULP — NOT the unfurl-and-spin**, which is
  Namco's and this app is sold. **NOTHING MOVES while it runs**; **the score
  is banked at the CATCH.**
- **SOUND IS SYNTHESISED, ON BY DEFAULT, AND NEVER ON A TIMER.** **The HOST
  can switch it off; the host's switch wins and does not wipe the phone's
  own.** **Every noise is tied to something the player DID**, and it never
  carries information, a pub phone being on silent.
- **THE BOARD IS ON THE PROJECTOR AT THE LOBBY ONLY** — inside the white QR
  panel and UNDER the code, which nothing may dim. **It was computed and never
  drawn for as long as the feature existed**, and **a test that the payload is
  right proves nothing about whether anybody drew it.**

Full reasoning: **[`docs/lobby-games.md`](docs/lobby-games.md)**.

### A DROPDOWN IS NARROW SHUT AND WIDE OPEN — `console-pick.js`

*"All dropdown boxes on the bay must popover… 'look — the usual' needs to only
be as wide as the pre-filled value, popovers can pop out wider but we need to
save space."* A native `<select>` cannot: the browser sizes the open list to
the CONTROL, so one narrow enough for "The usual" clips "Halloween — in season
now".

- **THE NATIVE `<select>` STAYS IN THE DOM AND STAYS THE TRUTH.** The popover
  is a skin: every `.value` read, every rebuild and every `change` listener goes
  on working, and **the LAUNCH still reads what it always read**. **A skin
  cannot lose a value, because it never holds one.**
- **SO IT MUST BE REPAINTED WHEN THE SELECT CHANGES UNDERNEATH IT** —
  `refreshPicks()` at the end of `paintSettings()`: `.value = x` fires no event
  and nothing else would tell the face it is stale.
- **CHOOSING DISPATCHES A REAL `change`.** Setting `.value` from script fires
  nothing: the picker looks like it worked and the launch sends the old value.
- **ONE DOCUMENT LISTENER FOR ALL OF THEM** — the bar is rebuilt on every
  state push, so per-render listeners leak with the room.
- **WHICH WAY A MENU OPENS IS MEASURED**, or the rightmost hangs off.
- **A FLOATING SHEET NEEDS AN OUTSIDE-CLICK CLOSE IT DID NOT NEED INLINE.**
  Left open, the venue sheet sits over the settings and swallows every click
  aimed at them. A popover only its own button can close is a trap.
- **A FACE RESERVES ITS WIDEST OPTION, so it never moves when you choose
  something** — *"dropdowns don't change size at all regardless of what's
  selected."* Every option's SHORT name goes into one grid cell, all but the
  chosen one hidden, so the BROWSER reserves the width. **`visibility`, never
  `display: none`** — a hidden item still sizes the grid.
- **THE ROW MAY NOT WRAP ABOVE 1150px, AND `flex-shrink` ALONE CANNOT HOLD
  IT** — a wrapping flex row WRAPS FIRST and shrinks per line after, so a row
  twenty pixels over drops a control onto a second line rather than taking two
  pixels off eight. `flex-wrap: nowrap`, and **a heading ellipsises rather than
  wraps**. Still wraps below 1150px.
- **A LONG OPTION EARNS A `data-short`**, and **the pack is named on the first
  of Card/Prizes, not both.**
- Labels shortened with it: **Secs per Q**, **Game**, **Save**. **"Look" became
  "Appearance"** — it read as an instruction first.

### THE MARKUP GUARD IS THE MARKUP'S HALF OF THE BRACE RULE

`test/markup-balance.test.js`. Same cause as the stylesheet one: a scripted
move left `.lb-what` unclosed, and **the head row collapsed — the venue button,
Save and the mode switch drew on top of one another.**

- **`node --check` PASSES BROKEN HTML.** A template literal holding it is a
  good string, and the browser silently re-nests it: the page renders wrong.
- **A WHOLE-FILE TAG COUNT WAS TRIED AND TURNED DOWN.** This app builds markup
  from fragments, so `console-venues.js` is nine divs "short" and correct. **A
  test needing a growing exceptions list has stopped being a test.** What is
  left is the launch bar's own template, checked precisely.
- **AND `console-markup.test.js` COUNTS THE WHOLE BUILDER, by matching its
  braces.** It stopped at the first `querySelector`, so an unbalanced `<div>`
  past that point passed all three markup guards. **A window drawn at "where
  the template probably ends" moves every time somebody queries the DOM a
  little earlier.**
- **`play.js` genuinely leaves two `<div>`s and a `<label>` open** in the
  camera sheet. **Deliberately not fixed blind**: re-nesting a screen nobody
  reported a problem with is how you cause the next fault.

### A STRAY BRACE IN THE STYLESHEET IS SILENT, AND IT REACHED A REAL CONSOLE

`test/style-structure.test.js`. Reported as *"why is it loading like this?"* —
Tonight's six pack slots showing as ONE on a laptop, twice, with the markup
and the JavaScript both correct and six `<button>`s in the DOM.

- **A SCRIPTED EDIT WITH `s.index(needle)` AND NO START OFFSET DUPLICATES
  TEXT.** **Always pass the start offset**, and check the brace balance after
  any scripted CSS edit.
- **THE MEDIA QUERY THEN ENDED EARLY and its phone-only rule applied at every
  width.** CSS throws nothing; it re-scopes silently from the stray brace on.
- **AND THE OLD BLOCK SURVIVED AFTER THE NEW ONE, so the old rules won** — a
  duplicated region puts a second copy LATER in the cascade.
- **MEASURE `getClientRects()`, NOT `querySelectorAll().length`** — the
  verification counted `.lb-tile` ELEMENTS, which `display: none` elements still
  are. "In the document" and "somebody can see it" are different questions, and
  this repo has been bitten by it four times.
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
  averaging, the dealing would need a shuffle at kick-off — which breaks the
  rule above it.
- **A DEALT TEAM CANNOT BE SWAPPED** — `joinTeam` refuses outright in random
  mode. The phone draws no picker, and the first thing two friends would do is
  find each other again.
- **THE LABELS NAME THE CHOICE, NOT THE MECHANISM** — *"One phone each"* and
  *"Teams — several phones, scores averaged"*: from the player's side the
  question is who you are playing WITH.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### THE BAND ABOVE LAUNCH IS KEPT CLEAR, and one row holds the night

*"That space between packs and launch button needs to be clear, space is at a
premium."* Nothing sits between the running order and Launch now, by rule.
What was there and where it went:

- **The break strip moved ABOVE the tiles**, where it does not stand between
  the order and Launch.
- **The pack settings row only exists when it HOLDS a control** — a bingo pack
  picked. Every quiz night carried a labelled row above Launch holding one
  caption and nothing else. **Not the present-and-inert rule being broken**:
  that rule is about a control coming and going as you work, and Card and
  Prizes already do not exist for a quiz pack.
- **The four-fact info line is gone, and the host was right about why** —
  *"this is all venue settings stuff that can be done in the workshop?"* The
  venue name duplicated the picker and *start when you like* was the app
  reporting a blank diary field. **The prizes were the real exception** — read
  at launch onto the winner's voucher — so what survives is the WARNING only,
  silent whenever there is nothing wrong.
- **DOORS, THE LIVE LINE AND UNLAUNCH ALL LIVE IN THE HEAD.** `p0:lobby` is
  the one break that belongs up there: it is the gap BEFORE the night starts,
  so it is a fact about the evening like the venue. Every other break —
  including a later part's own lobby — stays beside the running order. **The
  setter still opens in the strip**, so a break is edited in one place.
- **ONE HEIGHT FOR EVERY CONTROL IN THAT ROW — 44px, the touch floor.** **44
  because it is the FLOOR, not because it is the biggest**: levelling down
  would have broken the one control a touch-target audit had already fixed.
  **The shapes still differ** — the radius encodes what a control IS, and
  flattening that would undo the GUI rules.
- **A DESTRUCTIVE BUTTON KEEPS THE FACE AND THE 2px EDGE.** The one global
  `.danger` rule uses the `border` SHORTHAND, which overwrote all four sides —
  **the shorthand-beats-longhand trap, hit inside the rule that calls itself
  "the one rule"**. Outlined-never-filled is about FILL and is untouched.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### THE BAR'S OWN TIDY-UP — and a drag with no tap is a broken control

Reported off a screenshot: *"starting to look a bit messy — can we utilise
space where possible."* Four placements and one real bug:

- **A CONTROL SITS WITH WHAT IT ACTS ON.** *Stop* read as a control over the
  whole panel. It is **Unlaunch**, beside the sentence naming what it stops.
- **THE HEAD MAY NOT WRAP ABOVE 1150px EITHER — `flex-wrap: nowrap`.** The
  control below moved the threshold from ~1050 to 1150, measured against the
  previous commit at seven widths, dropping the mode switch a row. **What gives
  ground is the SENTENCE, never a control**: `.lb-live` ellipsises.
- **AND `.lb-warn-slot` HAD TO LEAVE THE HEAD FIRST.** `flex: 1 0 100%` got it
  a line only because the head WRAPPED, so under `nowrap` it took the whole
  row and **every control in the head collapsed to zero width** — all in the
  DOM, all unclickable, nothing thrown, and only on a night with a warning up.
  **A block that depends on its parent wrapping is borrowing a line, not owning
  one.**
- **AND THE WAY BACK IN SITS THERE TOO** — *"a button next to the explainer at
  the top saying what quiz was loaded."* The line said a night was on the big
  screen and **the only control beside it ENDED the night**. **ORDINARY, never
  the gradient**: the panel below wears the account's fill, and two on a screen
  means neither is the one to press. **Same words as the panel**
  (`nowPlaying()`), or one destination has two names. **Before Unlaunch.**
- **AND THE PANEL NO LONGER PRINTS ITS HEADING TWICE** — `running.at` repeats
  the `h3` at the lobby, so it is dropped when it only repeats.
- **KEEPING A NIGHT IS A NIGHT-LEVEL QUESTION, so it moved into the head**
  beside the venue. **The label has to outrank the adjacency**: a show never
  keeps the venue, so "Save" alone beside a venue picker says the opposite of
  what it does — the words stay *"for another night"*. **IN TENSION WITH THE
  SHORTENING RULE ABOVE, BOTH HIS**: he asked for the bare verb when the row
  ran out of room, then asked *"what is the save button even for?"* — this rule
  coming true. **The label is written by `paintSettings()`, not the markup**;
  editing the template changes nothing and was shipped once. **Left as "Save".**
- **THE REASON A CONTROL IS OFF GOES ON THE CONTROL** — *"Nothing in Tonight
  to keep yet"* floated beside a greyed button; it is on the button now.
- **A BIGGER TARGET IS NOT A HITTABLE ONE.** The tile's × grew to 30px and the
  pack NAME painted over it: `z-index` AND `padding-right`.
- **EVERY DRAG NEEDS ITS TAP, and a shelf round dot never had one** — the
  first thing anybody tries did nothing and a touchscreen had no way in.
  `addRoundToTonight()` is that tap, through the drop's own path.
- **FIVE SETTINGS ON ONE ROW ABOVE 1150px, LABELS ABOVE THEIR CONTROLS.** Side
  by side, two of five labels wrapped and three did not.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### WHAT HAPPENS IN THE GAPS — a break plan, per gap in the night

`public/assets/break-parts.js` (the model, imported by the SERVER like
`show-parts.js`), `console-breaks.js` (the dials), `state.breakPlan`,
`view.gap` on a phone, `view.breakAdverts` on the projector. Asked for
directly: *"the while they wait section needs to assign games and/or photo
upload per break… and the screen itself needs to be able to show ads as
well."*

- **TWO OF THE THREE THINGS ASKED FOR ALREADY EXISTED.** Photos always ran at
  every break, so that half is making something SWITCHABLE rather than adding
  it; the game ran at the lobby only. **An advert only ever went up because
  somebody pressed a button** — the genuinely new capability, and the one that
  pays.
- **A BREAK IS A PLACE, NOT A NUMBER** — `p0:lobby`, `p1:r2`. Derived from the
  part and round indexes already on the state, so a restart resolves it for
  free. **A stored list of five breaks would be wrong the first time a round was
  switched off**, silently, with every row still looking real.
- **THE PLAN IS SPARSE AND EMPTY MEANS "AS IT WAS".** `DEFAULTS` reproduces the
  app as it behaved before breaks existed — `cleanPlan()` drops anything that
  only restates one, which is what lets `pub-unchanged.mjs` say IDENTICAL.
- **THE THREE LOBBY-ONLY GUARDS CHANGED SUBJECT, THEY DID NOT GO AWAY.** The
  seed in the payload and the refusal at the score route now read "a break that
  offers a game"; outside a break `breakNow()` is null, so **a question is as
  unreachable as it ever was**. **The arcade BOARD deliberately stayed
  lobby-only** — it draws inside the white QR panel.
- **THE FINAL IS NOT A BREAK, AND THE LOBBY HAS NO SCREEN CHOICE.** A plan
  that could hide the winner would take away the moment the night is built
  towards; the lobby's screen belongs to the join code, which nothing may dim.
- **SCORES FIRST, THEN THE SLIDES ROTATE** — the room gets what it looked up
  for, and the venue gets the screen once it has. **THE PROJECTOR ROTATES, NOT
  THE ENGINE** — an engine timer would push state to every phone on each change
  and need restoring mid-cycle. **The teardown lives in `draw()`**, where every
  card change passes.
- **NOTHING IS A REAL ANSWER**, asked for by name — the round still names
  itself, because a projector with literally nothing on it reads as broken.
- **`listAdvertPacks()` RETURNS A SUMMARY, NOT THE PACK.** Its slides have no
  body, link or image; a projector slide built from them is a heading over an
  empty card, and nothing throws. Third sighting of the picks-fields trap.

Full reasoning: **[`docs/console/launch-bar.md`](docs/console/launch-bar.md)**.

### THE GAPS ARE A DIAL ON THE PACK, NOT A STRIP UNDER IT

`gapDial()` / `gapsOfPart()` in `console-breaks.js`, the `In the gaps` picker
on the settings row. The strip of chips lasted a day: *"'doors' and 'after
round 1' both fill the same function, don't really need both"*, then *"it
could just be a symbol you click to cycle… and this would live in the bottom
right of the pack ONCE LOADED."*

- **THE DUPLICATION WAS REAL** — one `chip()`, one plan, one setter, drawn
  twice and neither beside the thing it acted on.
- **A TILE'S DIAL OWNS THE GAP AFTER ITS OWN ROUND — `gapIdsOfSlot()`.** It
  owned *every gap the pack makes*, so **pressing the last tile's dial changed
  the first.** A BINGO slot owns the gap BEFORE it, never `p0:lobby`; **the
  FINAL is not a gap.** **`drag-check` asserts ONE face moved** — **a guard
  aimed at whatever happens to be first is measuring the shelf, not the row.**
- **THE TILE'S SIZE DECIDED THE SHAPE, MEASURED FIRST**: 179 x 76 with 58px
  clear. That is ONE 44px control and never two — so the dial is the PHONES and
  the big screen became a night-level picker. **The plan on disk is
  unchanged.**
- **A DIAL IS SAFE HERE because every state is a real answer, and the order is
  a SCALE**: photos, game, both, nothing. A dial whose steps are not on a scale
  has to be memorised.
- **THE LIT EDGE HAD TO BE MADE HONEST** — `cleanPlan()` runs on the way OUT
  too, or a gap cycled back to its default still claims a change.
- **DOORS KEEPS A DIAL, the one gap with no tile.** Phone-only: the join code
  owns the lobby's screen.
- **THE ERA WORD MOVED 52px LEFT** — **the control wins and the decoration
  moves.**
- **A LOST `import` DREW A BAR WITH NO DIALS AND EVERY CHECK PASSED** —
  swallowed `ReferenceError`s, `node --check` happy, the suite green.
  **`test/imports-present.test.js`** asserts every module imports the shared
  helpers it calls.
- **A TILE IS NOT A PART** — several quiz packs are welded into ONE quiz, so
  mapping a tile to a part gave tile 1 every gap in the night and tile 2 no
  dial. `gapsOfPack()` reads the part's `order`.
- **THE SLOT NUMBER GOES WHEN A PACK LANDS IN IT**; **it stays on an EMPTY
  slot**, where it is the whole label.
- **THE TILE IS 90px BECAUSE 30 + 44 DOES NOT FIT IN 76** — moving the × puts
  "remove this" where the eye lands first.
- **THE ERA WORD IS GONE FROM A TONIGHT TILE** — it overlapped the round ticks
  and there is no third place. **It stays on the shelf CARD.**
- **`.lb-tiles:has(.lb-doors-slot)` OUT-SPECIFIED THE PHONE RULE** — a class
  more specific than `.lb-tiles` beat the 560px layout, and 390 came out as four
  50px columns. The specificity trap wearing `:has()`.
- **DOORS IS A MINI SLOT AT THE HEAD OF THE ROW** — half width, no number,
  never a drop target. **The big screen is not offered there**: the lobby's
  projector is the join code and nothing may dim it.
- **EVERY NIGHT SETTING IS ON ONE ROW, AND A BOX IS NEVER NARROWER THAN ITS
  OWN HEADING.** `justify-items: stretch` makes the BOX the wider one every
  time. **It does not undo *narrow shut, wide open***: the cell is still only as
  wide as the longer of the value and the word above it. Card and Prizes joined
  that row, so the separate bingo row is GONE. **The reason a control is off
  went into the control** (*"Add a bingo game"*).
- **THE ROW SERVES ANY BINGO PACK IN TONIGHT, NOT ONLY A PICKED ONE** — it
  keyed off the PICKED tile, so with the quiz picked the app said to add a thing
  already on screen. **The three WRITES had to move with the read**, or the row
  shows one pack's card and saves it onto another.
- **THE CARD'S DISPLAYED DEFAULT IS WRITTEN BACK WHERE IT IS DISPLAYED.** The
  bar read *"5x5 — 25 of 40 songs on a card"* and the launch sent
  `shape: null`: **the room got a 4x4 running five prize stops.** Only the
  DEFAULT was lost — every bingo night nobody opens the picker on. **`pub-
  unchanged` cannot see it: it reads `quizzes/` and never loads a bingo pack.**
  `bar-reaches-the-room.mjs` can.
- **A ROUND SWITCHED OFF ON A LOADED SHOW IS NOT PLAYED.**
  `runningShowSegments()` read the SHOW's order and never `lbOff`, so the tick
  went red, Launch said *"2 rounds"* and the wire carried three. **One answer
  to "what is being played tonight."**
- **"IN THE GAPS" IS INERT ON A NIGHT WITH NO GAP.** A bingo game contributes
  only its own lobby, whose screen is the join code — so the picker was live,
  took any of four choices and the launch sent an empty plan.
  **Present, live and IGNORED is what *present and inert* exists to refuse**,
  so the reason goes on the control (*"Add a quiz round"*).
- **THE ROUND CEILING IS CHECKED ON THE ROW THE NIGHT IS BUILT ON.** A
  thirteen-round night launched as twelve with **nothing said anywhere**.
  Measured against the SEGMENTS (`longestQuiz()`), never the tiles. **The
  server still slices** — a refusal costs the night.
- **📵 RATHER THAN A DOT for "nothing on the phones".** Asked outright — *"what
  does this mean? the . ?"* — which is the *clarity beats everything* test
  failing. The other three states are pictures; punctuation on a button reads
  as a control that failed to load.
- **THE PACK LIFTS FROM ITS GRIP; A ROUND LIFTS FROM ITS OWN SQUARE.** A tick
  with no drag handlers lets the browser walk up to the nearest draggable
  ancestor and take the whole pack; **a `draggable` child stops the walk.** The
  tile refuses a `dragstart` that did not begin on `.lb-tile-head`.
- **A `dropEffect` THE SOURCE DID NOT ALLOW KILLS THE DROP SILENTLY.** Set the
  wrong one and the browser treats the target as REFUSING, so **no `drop` fires
  at all** — hard-coding `'move'` in a handler serving both killed every pack
  drop while rounds kept working. **A synthesised `DragEvent` does not enforce
  it**: `drag-check.mjs` drives the real mouse.
- **THE SLOT YOU DROP ON IS THE SLOT IT GOES IN — for a whole PACK too.** `at`
  is honoured only when that slot is genuinely EMPTY: **a slot you can destroy
  by letting go over it is a hazard**, so a drop onto a full tile appends. **A
  drop that MISSES every square means "the next free slot".**
- **A DESCRIPTOR IS NOT THE THING IT DESCRIBES.** `packDrag` is `{ id, kind }`
  and the empty slot's drop handed it on as the pack — **the slot lit, the drop
  was taken, nothing appeared.**
- **A KIND THAT DISAGREES WITH THE NIGHT'S OWN IS A MIXED NIGHT** — a quiz pack
  added to a bingo night went into `lbExtra` and was never found again.
  **Nothing threw — the state was consistent and the READER could not resolve
  it.**
- **A PACK CARD ASKS WHETHER IT IS IN TONIGHT; IT IS NOT PAINTED AFTERWARDS.**
  `render()` assembles the page OFF the document, so a later paint finds the
  PREVIOUS page's cards.
- **THE BREAK PLUMBING MOVED INTO `console-breaks.js`** rather than the line
  budget being raised a fifth time. **Destructured ABOVE every reader**: a
  `const` in its temporal dead zone throws when the line RUNS and the catch
  swallows it. **A moved body keeps the names of the home it left.**
- **A PACK TILE LIGHTS UP TOO — AND ONLY WHERE THE DROP WILL BE TAKEN.** One
  that lit and did nothing promised. A refusal also STOPS the event, or the
  round lands somewhere the pointer never was. **The inset ring alone was
  invisible.**
- **A FILLED MIXED TILE HAS TWO WIRINGS AND THEY RACED.** The one registered
  LAST won, so a bingo tile lit for a round it would refuse. **One handler
  decides and the other stands down.**
- **AN EMPTY SLOT TAKES A ROUND AND LIGHTS UP WHILE YOU ARE OVER IT** — with
  no `dragover` of its own **nothing lit up**, and an inert square reads as one
  that refuses; `orderEl`'s drop APPENDS, so a round let go over slot 5 landed
  in slot 2. `stopPropagation` makes the slot's answer count.
- **AND MY OWN TEST HAD MISSED IT** by dispatching `drop` directly — a browser
  fires no `drop` unless `dragover` called `preventDefault()`. **Measure
  `defaultPrevented` on the dragover.**
- **A CHILD'S `dragend` BUBBLES TO THE TILE, and the tile's removes the pack**
  — dragging a round out emptied Tonight. The round's drag travels the SHELF
  channel so `moveRoundToSlot()` MOVES rather than duplicates.
- **A ROUND IS A ROUNDED SQUARE AT 28px ON A TONIGHT TILE, AND ITS HOVER
  LIFTS.** *"Square shaped with round edges… I need to see when mousing over
  them."* `--r-field` only reads as a square on a box with sides — at 22px it
  is nearly a circle — and `filter: brightness(1.25)` is a change you cannot
  find on a faint dot.

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

- **ORGANISED BY VENUE, because a venue IS a community.** The Tuesday and
  Thursday crowds are different people, and the page is then something you can
  show one landlord.
- **THE PHOTOS MOVED AND PAST GIGS KEPT ITS GRID — not a duplicate.** On Past
  gigs a photo is EVIDENCE; on Community it is the room itself. **What is not
  duplicated is the CODE** — `nightPhotos()`, from both, so **the publish
  control keeps its safeguard for free.**
- **A READ-ONLY SUMMARY MAY REPEAT; A QUEUE MAY NOT.** The headcount sits on
  three pages from one server-side figure. **"What the room asked for" is a
  QUEUE — Yes keeps it, No bins it — so it MOVED off the Music Quiz tab rather
  than being copied**, leaving a link that shows only when something waits.
- **A night's photos are fetched when the night is OPENED.**
- **`asksPanel({ whenEmpty })` — the same panel answers two pages.** Drawing
  NOTHING was right above the quiz generator and wrong on a tab whose job is
  the list. One argument, so the triage keeps one definition.
- **AND ONE POINT FOR EVERY NIGHT PLAYED, ON TOP OF THE BEST SIX.** Under
  best-six alone a team near the bottom stops gaining anything after six weeks
  — a retention hole in the feature built for retention. **THE LADDER
  THEREFORE PAYS NOTHING BELOW SEVENTH**, or one point is paid twice under two
  names.
- **A TEAM'S BEST SIX NIGHTS COUNT — a running total is not the league.** A
  cumulative table punishes absence ABSOLUTELY, so the team works out the season
  is gone and stops coming. **AND A PLAIN AVERAGE BREAKS THE OTHER HALF**: mean
  points per night puts a team that played ONCE AND WON above one that won five
  of ten. **SUMMED, NOT DIVIDED.** `COUNTING_NIGHTS = 6` is a constant with a
  note, like the season.
- **A NAME IS FILTERED AT THE DOOR, NEVER IN THE ROOM** — `clean-names.js`,
  off a live table with a racial slur ninth in it. The projector, the phones
  and the console are UNCHANGED; only the public page and the report mask
  anything. **ON THE SERVER, so the word never reaches the wire.** **MASKED,
  NEVER DROPPED** ("Name hidden"): dropping the row moves everybody up a place
  and lies about the season. **IT ERRS STRICT.** **WHOLE WORDS FOR ORDINARY
  PROFANITY**, or it eats Scunthorpe; the SLUR list is matched AGAIN with the
  spaces stripped — **never do that pass on the ordinary list.** **THE CONSOLE
  SHOWS THE REAL NAME AND MARKS IT**, or a name vanishes off a published table
  with no way to tell which.
- **AND A HUMAN OVERRULES THE LIST, IN BOTH DIRECTIONS** — it hides "The Pen
  Is Mightier" and publishes a spoonerism it cannot see. Keyed by `teamKey()`,
  so a ruling follows the team all season. **A RULING THAT ONLY RESTATES THE
  FILTER IS CLEARED, NOT STORED**, or a later change to the word list silently
  cannot reach that name. **ONE CONTROL PER TABLE, FOLDED.** **THE ROW'S KEY
  TRAVELS WITH THE ROW.**
- **ONE ROOM FOR THE WHOLE PHOTO STORY — `galleryRoomFor()`.** The gallery
  reads the OWNER'S OWN QUIZMASTER ROOM, never `HOUSE`; the console wrote
  through `roomForHost()`, so a night could be published into a folder the page
  never looks at, be told it worked, and read back as *"Not published"*. **The
  hazard was written down above `galleryRoomId()` and left** — which is how a
  noted hazard becomes a bug report.
- **THE PRIVATE REPO IS TESTABLE NOW** — `photo-repo-stub.mjs`: real server,
  fixture network. **Publishing lived behind a token the suite must never
  need.**
- **`published.json` HAS ONE WRITER AT A TIME, PER ROOM — `inOrder()` in
  `src/gallery.js`.** Two callers each read the file whole and write it back,
  so a lamp write begun before a publish finished **silently un-published the
  night**. **THE BROWSER'S QUEUE CANNOT COVER IT** — order it where the FILE
  is
- **A READ THAT FAILED IS NOT AN EMPTY FOLDER — `tryGetFile()` /
  `tryListDir()`.** `getFile()`/`listDir()` answer `null`/`[]` for a 404, a 403
  and a dropped connection alike — right for ninety callers, **data loss for the
  four that LATCH**: one 403 after a deploy marked a room restored with nothing
  restored, nothing logged. **A 404 is an ANSWER; anything else is a failure to
  LOOK.** `restoreOnce()` latches on the way OUT. **ONE IMPLEMENTATION.** A
  failed listing is not cached; **no TTL, which would serve the wrong answer for
  its length.**
- **A READ-BACK SHA CAN BE STALE — `GitHub 409` reached a live console.** The
  Contents API is served from a replica, so a `GET` after a 200 `PUT` can hand
  back the version before it. **The sha a `PUT` HANDS BACK cannot be served
  stale**, so `putFile()` remembers it. **It is a CACHE, so it must be able to
  be wrong**: forgotten, re-read past the caches, retried once, said in WORDS
- **A NIGHT IS A CARD WITH ITS PHOTOGRAPHS FANNED ON IT, GROUPED BY PUB** —
  `coverPhotos()`. **Pins lead, the rest is a SPREAD**, seeded off the date.
  **BUILT FROM THE SAME FILTERED LIST THE NIGHT'S PAGE SHOWS.** **A pin is a
  PREFERENCE; the lamp is the GATE.**
- **A GALLERY IS PAID FOR ONCE — not per photo, not per visitor. Nothing
  deciding who may see a photo is cached with it**; **the browser window is NOT
  lengthened past a day.**
- **EVERY WRITER OF `published.json` CARRIES THE HALVES IT IS NOT CHANGING** —
  nights, rulings, pins; a test walks them.
- **A NIGHT NAMES ITS PUB AND STEPS TO THE ONE EITHER SIDE AT THAT PUB**,
  **decided on the SERVER**. **An end of the run is an ABSENT link, not a dead
  one**: the one place *present and inert* does not apply, that rule being
  about a page driven weekly rather than one a stranger sees once.
- **THE LEAGUE IS EXPORTED TO TWO AUDIENCES AND THEY WANTED DIFFERENT THINGS**
  — the landlord wants EVIDENCE, so the season table joined the post-night
  report he already receives; the teams want the table on a WALL, so `/league`
  is a public page per quizmaster. One thing for both would serve neither.
  - **A REPORT SAYS WHAT THE ROOM SAW THAT NIGHT, not what is true today** —
    `leagueAfter()` winds the night list AND the season window back.
  - **A PUBLIC PAGE IS A PUBLISH, PER VENUE, FAILING CLOSED** —
    `league-publish.js`, the gallery's shape exactly, in the private repo
    because `data/` is wiped on every deploy. **NAMES AND POINTS, NEVER
    FACES**: the fields are named on the way out rather than spread, or the
    next one added is a photograph on a public page.
  - **THE NEXT QUIZ DATE IS THE LOUDEST THING UNDER THE TABLE.**
  - **AN ASYNC PAINT LOOKS WHERE THE THING IS, NOT WHERE IT WAS MADE.** The
    publish control queried the `DocumentFragment` it was built in, which
    `render()` had emptied into the page — nothing drew, nothing threw.

### EVERY DOOR'S BAY IS THE LAUNCH BAY'S SIZE

`--bay-h` in `style.css`, on `.doorhead > .panel.bench`, from 900px up. A hard
rule: *"the bay at the top ALWAYS has the same dimensions as the launch bay,
this must be consistent across sections."* It was 386px on the Console, 194 on
Workshop and Post gig, and whatever the data came to on Community — so the top
of the page changed shape on every door press, and under a fixed frame that
moves the tab column and everything below it.

- **THE VALUE IS THE LAUNCH BAR'S OWN OPEN PANEL HEIGHT, MEASURED** — the
  panel, not the doorhead. Two values: the row wraps below 1150px..
- **AND THE RULE IS ABOUT THE BAY, NOT THE DOORHEAD.** With a night running the
  Console's doorhead is **573px and the other three 386**, carrying a SECOND
  panel. **Every BAY is 362px on every door. DO NOT RAISE `--bay-h` TO 549 TO
  EVEN THEM UP**: it spends 187px of tab column on three doors PERMANENTLY,
  leaving **234px against the frame's own 200px floor**. **Nor put the running
  panel on the other doors.**
- **AND THE GUARD MEASURED IT IDLE, so both sides read 386 and it agreed with
  itself.** It launches a quiz and lets two phones in, and **names the
  Console's two panels** so a third is looked at.
- **THE BAR ITSELF IS NOT GIVEN THE HEIGHT.** It is the REFERENCE, it folds to
  a line on purpose, and clipping the one panel on the protected launch path to
  a stylesheet number is not a trade worth making.
- **BELOW 900px THERE IS NO RULE**, there being no frame — the bar is 745px on
  a phone.
- **A FIXED BOX LETS THE CONTENT STOP WORRYING** — anything SCROLLS INSIDE IT,
  so nothing needs a row cap or an "and N more".

### EVERY BAY IS A RAIL AND WHAT IT PICKED — `console-bay.js`

*"The way this is presented is perfect — content taking up the bulk to the
right, controls on the left. How can we utilise this for all of the
sections?"* `bayRail()` / `bayColumns()` / `bayHead()`, drawn by Post gig
(your nights) and Community (venues, and the nights with photographs).

- **THE CONSOLE DOOR IS THE EXCEPTION, DELIBERATELY.** Its bay is the launch
  bar — the protected surface, and the REFERENCE every other bay is sized
  against. **Do not give it a rail.**
- **AND THE WORKSHOP IS THE SECOND EXCEPTION — it had a rail for a fortnight
  and that was the mistake.** *"The workshop bench is literally only meant to be
  for whatever you drag to it to be currently worked on — not sure why there is
  a dropdown list of different things, they're selected from the bottom, dragged
  or clicked to the top."* **The shelf below IS the picker**, so a rail beside
  the bench was a second answer to one question on the one door where the first
  answer is the whole bottom half of the page — and the two disagreed, the rail
  listing every pack while the shelf showed six. **The rule is not reversed, its
  scope is.** **Do not put one back on the Workshop**; `community-bay.mjs`
  asserts it in BOTH directions.
- **ONE DEFINITION, because each door had invented its own.** The rail is the
  TAB COLUMN one region higher: same 190px, same stack, same lit edge.
- **A RAIL PICKS; IT NEVER ACTS — with ONE lamp as the stated exception.**
  **The Photos rail's P publishes a night in one press**, and **the reason the
  rule existed is kept by the lamp also PICKING** — the photographs land in the
  bay as it goes public, so nobody publishes strangers' faces unseen. **Opt-in
  per item**, and **the tab body's panel GOES**. **The night's address is in
  the bay HEAD, from one `galleryAddress()`.**
- **COMPARTMENTALISED BY PUB, AND THE PUB FOLDS. Group by the pub FIRST, then
  order within it**, or "The Crown" prints twice with another pub between.
  **FOUR TO A GROUP.**
- **WHAT IS REMEMBERED WINS, ALWAYS — the first build had it the other way and
  the control was DEAD.** Forcing a group open whenever it held the picked row
  meant pressing its heading put it straight back. **A control that does
  nothing when pressed is worse than the problem it was avoiding**, so
  `holdsPicked` is a DEFAULT. **The folds live in a module Map keyed by rail
  AND group** — the bay is rebuilt on every push.
- **NO `title` ANYWHERE IN THE RAIL — the names WRAP instead.** A native
  tooltip is an unstyled box landing over the rows beneath it.
- **`.bay-rail > * { flex: 0 0 auto }` IS LOAD-BEARING.** A flex column shrinks
  its children and the rail always overflows. The rows survived on
  `min-height: 44px`; the pub headings had no floor and rendered at **2px with
  their text in the DOM**.
- **THE DRAGS SURVIVED because they were on the PANEL, not a slot inside it**
  — and each empty state keeps its drop zone.

### ONE PUB IS ONE LEAGUE — the id key and the typed name are the same room

`leaguesByVenue()` in `src/league.js`. Reported off a live console: **"The
Station Tap, Wokingham" in the rail twice**, 17 teams and 20. Pick the venue
off the Venues list some weeks and type it freehand others and `venueKeyOf()`
files the nights under `id:xyz` and `the station tap` — **the season cut in
half**, on a public page.

- **THE SECOND PASS ALREADY EXISTED IN `venueHeadcounts()`** — two readers of
  one archive disagreeing about what one venue is.
- **THIS REVERSES A PINNED TEST, deliberately.** Two freehand nights at one pub
  have always merged, so the old rule said ADDING an id made the answer
  worse.
- **THE KEY KEPT IS THE `id:` ONE.** Whether a table is published and every
  ruling on a team name are stored against it, so folding onto the bare name
  unpublishes a table and drops every override.
- **THE COST, ACCEPTED KNOWINGLY:** two pubs sharing a name merge — already
  true on the name-only path, and why venue names carry a town.
- **AND A THIRD TIME, WEARING A URL — `sameVenueSlug()` in `slugs.js`.** One
  pub slugged `station-tap-wokingham` and `station-tap`, filtered with `===`,
  so each address showed half of it. A public address has no id, so **the fold
  happens on the SLUGS**: **SYMMETRICALLY**, and **on a HYPHEN, never mid-word**
  (`crown` must not match `crownley`); an EMPTY slug matches nothing. **THREE
  call sites and the third was the night page's own PREV/NEXT ARROWS.**
  `test/slugs.test.js` forbids a bare `venueSlug(x) === y` in `server.js` —
  **the pattern, not the symptom**, which is what finds the third one

### THE COMMUNITY BAY IS THE TAB YOU ARE ON — a wall, or a venue rail

`communityBench(active)` in `console-community.js`. *"Anything that loads
should load onto the top bar bit — the photos in a 3 x 6 grid, and quiz league
up there too."*

- **THE BOTTOM IS CONTROLS AND OPTIONS. IT NEVER DISPLAYS THE THING** — *"you
  click the thing at the bottom to reveal it at the top."* The league tab draws
  no table, the Photos tab no photographs.
- **THE SAFEGUARDS SURVIVED THE MOVE** — the button is UNDER the thing, **drawn
  ONLY for the night showing**.
- **ONE PRESS PUTS IT IN THE BAY, THE NEXT TAKES IT OUT** — wall → night →
  picture, each step reversed by pressing the same thing.
- **A PICTURE IS AN OVERLAY, NOT A REPLACEMENT — which keeps the wall's
  place.** **`renderKeepingPlace()` holds every scroller in the frame**, by
  class. **AND THE OVERLAY HANGS ON THE COLUMN, NEVER ON THE SCROLLING GRID
  INSIDE IT** — `inset: 0` anchors to the padding box, which in a scrolled
  container starts at the top of the CONTENT.
- **ONE REQUEST PER NIGHT, NOT TWO.** `nightPhotos()` fetches the pictures and
  the published flag together, so the control is BUILT in the bay and HUNG in
  the tab body — safe because `render()` evaluates the doorhead first.
- **THE WALL IS FETCHED ONCE PER PAGE LOAD AND STOPS ASKING** — newest first
  until eighteen, never past `WALL_NIGHTS`. In a module binding: the bay is
  rebuilt on every push.
- **`node scripts/community-bay.mjs` IS THE GUARD, and it measures GEOMETRY** —
  every door's bay against the launch bar's, squashed rail headings, whether the
  page scrolls, and that pressing a rail button, a night and a picture each
  change what is drawn.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### THE SALES PAGE — one argument, both audiences, and `/` leads to it

`public/home.html`. Full reasoning: **[`docs/business.md`](docs/business.md)**.

- **`/` NOW LEADS TO THE SHOP WINDOW.** It sent anybody not signed in to
  `/login` — a password box for an account they do not have — while the page
  selling the thing sat at `/home`, reachable only by typing it. Signed in is
  UNCHANGED, so nobody who works here walks past the marketing.
- **ONE ARGUMENT, NOT TWO — the host's own**: *"you can sell it as a QM who
  uses this software could be a better option as a host as well."* A split
  landing gives each half a weaker pitch; this gives both the same one, because
  the evidence half (headcounts, the report, the gallery, the league, the
  comeback slide, advert scans) is the DEMO to a quizmaster and the PROOF to a
  venue. It leads on *"Be the quizmaster they book again"*, not "run the night
  from one laptop" — true, and it sold an operations tool.
- **REAL SCREENS, because a drawn mock is the one thing a buyer cannot check** —
  and the one there was also quietly WRONG. **Fixture teams only, never a real
  face or name in the public repo.** WebP: 4.6MB → 180KB. **Under `/assets/`,
  never a new top-level prefix** — one of those ate `/api/gallery`.
  **`width`/`height` are MEASURED**, or the page jumps as it loads.
- **A RUNG WITH NO BUTTON IS A PRICE LIST.** Each tier goes to
  `/signup?tier=…`, riding through as `?ref=` already did — recorded as
  **`wantedTier`, which MUST NEVER BECOME `tier`**: a rung read out of a request
  body and granted hands anybody Gold for nothing, the pack-id trap wearing a
  price. Validated against `TIERS`.
- **`accounts.create()` DROPS WHAT IT DOES NOT DESTRUCTURE, SILENTLY.**
- **A 113th TEST FILE MADE THE SUITE FLAKY — a different test each run**, each
  passing alone. **Attribute a flake by stashing INCLUDING UNTRACKED FILES**, or
  the control proves nothing. **A flaky suite is worse than a slow one**: slow
  gets skipped, flaky teaches you to ignore red.

- **A fact is on ACCOUNT, a switch is on SETTINGS, a price is in the SHOP** —
  or Settings becomes a bin.
- **THE SHOP SELLS PACKS AND TIERS IN ONE ROOM**, both games in one grid,
  because there you are shopping rather than launching. **It left the pack
  shelf**, which put a till at the bottom of a working page.
- **HELP KEEPS ITS OWN TAB, NO `needs`, LAST**, and the door is ungated: it is
  where you go when what is wrong is your subscription.

### WHAT IT COSTS TO RUN IS THE AI *PLUS* THE HOSTING

`hostingPence` in `src/spend.js`, `PUT /api/owner/hosting`, `hostingPanel()` on
the owner's Money tab, which compared revenue against the AI bill ALONE — so
*"more than is coming in"* flattered itself by the hosting fee, worst in a
quiet month, when the AI is cheap and the server is not.

- **TYPED, NOT FETCHED**, and **NOT A LEDGER ROW** — the ledger records what a
  JOB cost, so folding hosting in lands it in *what the money went on* and in
  the per-pack average, which would then move when a server is resized.
- **NAMED IN THE TOTAL** — a total silently absorbing a number you set months
  ago is one you stop trusting.
- **`restore()` NAMES IT — the whitelist trap for the FOURTH time.** It runs at
  boot, so on the free tier a field in `contents()` but not `restore()` is
  written, read back, dropped and saved as dropped, every deploy, in silence.
  A figure on disk WINS over the backup.
- **ABSENT WHEN UNSET**, like the budget: an older ledger is byte-identical.
- **The owner's Money tab, NOT My account**, which every quizmaster sees.

Full reasoning: **[`docs/business.md`](docs/business.md)**.

### A PHOTOGRAPH IS READ FROM MEMORY, THEN DISK, THEN GITHUB

`photoBytes()` in `server.js`, the disk half of `src/photo-cache.js`. The
memory cache is empty after every deploy — and every push is a deploy — so the
first fifty people to open a gallery after one each spent a GitHub call against
5,000 an hour SHARED with the packs, the accounts book and every backup.

- **A PAID INSTANCE DOES NOT GIVE YOU A DISK.** Render's filesystem is
  ephemeral on EVERY tier; only an attached disk changes it. The $7 Starter
  bought no SLEEP, not a surviving `data/`. **`DATA_DIR` is the whole wiring.**
- **AND A DISK REMOVES ZERO-DOWNTIME DEPLOYS**, single instance only. Worth it:
  today's overlap hands over an EMPTY `data/` that must restore from GitHub.
- **IT IS A CACHE OF WHAT GITHUB HAS, NEVER A SECOND STORE** — losing the disk
  costs speed and nothing else.
- **THE KEY MAPPING MUST BE INJECTIVE, AND THE FIRST ONE WAS NOT.** `/` → `~`
  put `a/b/c.jpg` and `a/b~c.jpg` on ONE file — **one photograph served in place
  of another**. `encodeURIComponent`, hashed past 200 chars. **Do not lean on
  `safePhotoName()`**: a guarantee held elsewhere is how it comes back.
- **A `..` MAY NOT WALK OUT.** The test writes a sentinel OUTSIDE the
  folder.
- **NOTHING DECIDING WHO MAY SEE A PHOTO IS CACHED WITH IT**, as before.
- **A DELETED PHOTO STILL LEAVES GIT HISTORY BEHIND. Unchanged** — that is what
  moving to object storage would fix, and the reason to consider it.

### THE CONTENTS API SENDS ZERO BYTES FOR A FILE OVER 1MB, AND CALLS IT 200

`tryGetFile()` / `rawGet()` in `src/github.js`. Above the inline limit GitHub
answers 200 with `content: ''` — a perfectly good string, so the type check
passed and `Buffer.from('', 'base64')` returned an **empty buffer as a
success**: a broken photograph with `ok: true`, nothing logged, nothing
retried. **`size` tells them apart**, and the raw media type has no ceiling, so
it asks AGAIN rather than giving up; a failure there is `ok: false`, a failure
to LOOK. Both uploads shrink first, so it is unlikely — **but `MAX_BYTES` is
3MB and a crowded pub is the densest thing you can hand a JPEG encoder.**

Full reasoning: **[`docs/gigs/photos.md`](docs/gigs/photos.md)**.

### THE RUNGS ON A SUBSCRIBER'S ACCOUNT SELL; THEY MUST NEVER GRANT

`console-tiers.js`, on My account. Bronze / Silver / Gold, yours lit in its
metal, the ones above locked; pressing one opens a card naming what it holds.

- **IT IS SHAPED LIKE THE OWNER'S AND IS THE OPPOSITE OF IT.** `tierPreview()`
  DOWNGRADES; this one only sells, so **pressing Gold on a Bronze account must
  stay inert**, or Gold is free. The owner sees both, so his keeps INITIALS and
  this spells WORDS.
- **A LOCKED RUNG IS PRESSABLE** — `disabled` swallows the press and the sell
  is the point. **NOT A NATIVE `title`**: a card, outside-click close, one
  listener for all rows.
- **THE OWNER'S OWN RUNGS ARE 30 x 34 WITH 5px BETWEEN THEM**, the hat switch
  beside them 34px, and **the 560px diet must take BOTH down together** — it
  shrank the switch and not the rungs, and the owner's bar ran off a 390px
  screen. **Not the 44px touch floor**: a mouse presses this.
- **BUILT FROM `ladderFor()`, never written out**, and **`NOT_BUILT` says "not
  yet"**. **NO SUBSCRIBE BUTTON UNTIL THERE IS A PROCESSOR.**
- **`.tier-row` WAS ALREADY `owner.js`'S** and won at equal specificity from
  3,300 lines lower, silently. It is `.rung-row`.

Full reasoning: **[`docs/business.md`](docs/business.md)**.

### HOW MANY WINNERS A NIGHT HAS — `winners`, chosen at launch

`DEFAULT_WINNERS`/`winnersOf()` in `engine.js`, the **Winners** picker on the
launch bar. *"I want to be able to define how many winners there are for a
specific quiz — tonight I want two shorter quizzes and only a single winner
for each."* One winner draws no podium and issues one voucher.

- **THREE IS THE DEFAULT AND IS EXACTLY WHAT THE APP DID BEFORE.** The field
  is spread into the projector's payload ONLY when it is not three, like the
  draw and the comeback band, so `pub-unchanged` says IDENTICAL with no
  `--ignore`.
- **IT CAN ONLY EVER SUBTRACT** — `rewards[position - 1]` still has to find a
  prize, so a generous setting cannot conjure one.
- **A STATE OR A SHOW WRITTEN BEFORE THIS EXISTED READS AS THREE**, never as
  zero: a redeploy mid-season must not change what a running night pays out.
- **NOBODY SCORED IS NOT EVERYBODY WON.** Equal scores share a position, so an
  all-zero board is EVERYBODY at position 1 — and paying by position handed **a
  first-place voucher with a live code to every phone in the room**, which the
  bar honours. Three ways in: the wrong pack and Stop early, the projector
  never connecting, and any breakout-only night. **A row scoring zero is
  skipped** — a FLOOR, so it can only issue fewer.
- **A TIE FOR FIRST IS STILL PAID IN FULL** — the cap is on POSITION, not on
  how many rows have been paid.
- **`doLaunch()`/`doLaunchOrder()` IN `console-packs.js` DESTRUCTURE A
  WHITELIST, AND A FIELD MISSING FROM IT IS DROPPED IN SILENCE.** `winners` was
  wired through the bar, `night`, both payload builders, the route,
  `session.launch()` and the show — and still arrived null, unnamed there.
  Nothing threw; the night paid three places. **Prove a new launch field by
  reading the request body out of a real browser, not the diff.**

### A PRIZE TYPED IN LATE STILL REACHES THE WINNER — and the card shape says how many

`setRewards()` in `engine.js` and `bingo.js`, `paintPrizes()` and
`prizeWarning()` in `console-tonight.js`. Off a live night: *"my quiz and
bingo winners on thursday didn't receive a QR code"*.

- **PRIZES ARE READ OFF THE VENUE RECORD AT LAUNCH AND NOWHERE ELSE.** No
  venue mints no voucher and the winner's phone is blank, which reads as the
  app being broken. **The warning names the CONSEQUENCE and draws with no venue
  too**: it began `if (!name) return null`, switched off in the case it was for.
- **SO PRESSING *Prizes* AFTERWARDS PAYS ANYBODY ALREADY OWED.** Both engines
  said the change "takes effect for the NEXT prize onwards", which was true and
  was the bug: the obvious thing a host does about a blank phone did nothing at
  all, for ever. **Both catch-ups are IDEMPOTENT**, which is what makes
  replaying them safe rather than a second live code in one hand.
- **BINGO KEYS ON THE WIN'S OWN TIMESTAMP, NEVER THE STAGE ALONE** —
  `newRound()` clears `prizeWinners` and deliberately does NOT clear
  `vouchers`, so *"is stage 1 paid"* alone refuses round two's line winner.
  **AND "PAID" NOW COMPARES THE WORDS.** It asked winner + place + time only,
  so a prize CHANGED after it was won never reached the code in somebody's
  hand: the phone showed the old one and the bar read it out. **Updated in
  place, never a second voucher** — two live codes in one hand is what the
  idempotency exists to prevent — and **a REDEEMED one is left alone**, because
  rewriting a spent voucher is editing history.
- **THE CARD SHAPE CHOOSES THE PRIZE COUNT, AND IT IS A NUMBER PER SHAPE
  RATHER THAN A FORMULA** — `defaultPrizes()`: 3x3 → 1, 4x4 → 2, 5x5 → 5,
  4x6 → 4, 3x8 → 3. **The table lives BESIDE the shape, never in the console**,
  so a sixth shape must name its own default in the line that adds it rather
  than inherit an answer nobody chose. **Clamped**, so it can never promise a
  prize the geometry cannot pay — and **the picker CLAMPS too**, or a count
  carried onto a smaller card names an option that no longer exists and the
  select goes silently blank. Why it is not a formula:
  **[`docs/bingo.md`](docs/bingo.md)**.

### ONE PRIZE EACH PER BINGO ROUND, WHILE ANYBODY IS STILL WITHOUT ONE

`claim()` / `holdsAPrize()` / `stillWithoutAPrize()` in `src/bingo.js`,
`view.standDown`. Off a live night: *"I had one person win three of the four
music bingo prizes yesterday… it looks really bad on me if one guy wins all
the prizes."*

- **IT IS THE SHAPE OF THE GAME, NOT LUCK.** The best card wins the line and is
  then nearest to two lines and to the house — so **whoever takes the first
  prize is the favourite for every prize after it.**
- **THE CLAIM IS STILL RIGHT AND IS RECORDED AS RIGHT** — no false call, no
  telling-off, so the control view has THREE outcomes rather than two. **AND NO
  SENTENCE ON A PHONE MAY SAY "you have already won"** — the first build was
  reverted off the live app for it. **The wording is about the PRIZE, never
  about the person.**
- **THE CARDS CANNOT DO THIS ON THEIR OWN, and that was asked for twice.** A
  card is dealt at JOIN and who wins is decided by **the order the host plays
  the tracks in**, which the app never sees. **Read `docs/bingo.md` before
  re-proposing dealing as the fix.**
- **IT LIFTS THE MOMENT EVERYBODY HAS ONE.** **The test is "is anybody left
  without", never a count of prizes**, so it holds at any room size.
- **THE BUTTON STAYS AND SAYS WHY** (`standDown`), present and inert.
- **NO SETTING.** It is one line to invert if anybody ever asks.
- **AND A STAGE CAN ONLY BE TAKEN ONCE — `stageTaken()`, checked BEFORE
  anything is recorded.** A second GENUINE line a beat later — the ordinary
  thing that happens in a pub — stopped the second voucher and let everything
  after it run: **the projector changed the winner's name while the prize
  stayed with the first**, and `results()` filed BOTH into Past gigs and the
  landlord's report. **The button stands down for EVERYBODY** while a prize is
  taken. **`tooLate` is a separate flag**: the host's list says *"just missed
  it"*, because *"had one"* is a fact about the player and is untrue here.
- **AND THE BUTTON WAITS FOR THE STAGE, NOT FOR ONE LINE.** It asked for one
  line whatever the prize needed, so on the settings every 40-track pack ships
  with, **every phone lit up the moment one line landed**. It is `evaluate()`'s
  shape on MARKS; **the two may not disagree about what the prize IS.**
- **AND A VOUCHER SURVIVES A PART BOUNDARY — `carried` in
  `startOrderSegment()`.** *Continue to the quiz* built a fresh engine and
  destroyed them: 200 from `/api/voucher` before the press, **404 after** — the
  live *"my bingo winners didn't receive a QR code"* complaint by another
  route. **The flag is load-bearing**: the idempotency check sees THIS part's
  only, while the lookup, the redeem, the host panel and the archive see all of
  them. **`prizeWinners` does NOT carry** — `stageIndex` restarts, so a carried
  list makes `stageTaken()` true for a prize nobody has played for.
- **`Continue to the quiz` IS DRAWN ONCE**, and **bingo's `Finish` STAYS AND
  SAYS WHAT IT COSTS** — a deliberate escape hatch, so it is not hidden the way
  the quiz's *Stop* is, but its confirm names what filing on the bingo alone
  leaves out.
- **AND THE ROUND CAN STALL, SO THE CONTROL VIEW SAYS SO — `view.stalled`.**
  If everyone who has completed the card already holds a prize, the round waits
  for a card that may never land. **The rule is NOT lifted** — the host already
  has *Play on*, *New round* and *Finish*. What was missing is being told.
- **`pub-unchanged.mjs` SAYS NOTHING ABOUT ANY OF THIS — it reads `quizzes/`
  only.** IDENTICAL on a bingo change is the guard answering confidently about
  something it is not looking at. `node scripts/bingo-prizes.mjs` drives three
  phones over real HTTP instead.

Full reasoning, with the measurements: **[`docs/bingo.md`](docs/bingo.md)**.

### FOUR WAYS A NIGHT'S SCORES AND PRIZES CAME APART

All four are ordinary presses, none of them throws, and each is on the path a
gig actually takes.

- **BACK WIPES THE QUESTION IT IS LEAVING**, exactly as `Skip` and `Ask again`
  do — one act from three directions, and Back was the one that did not. Two
  tables kept points AND the bonus for a question never played, then answered
  `already_answered` on the replay.
- **A PRIZE NO LONGER OWED IS TAKEN BACK — unless it has been SPENT.**
  `issueVouchers()` only topped up, so four ordinary presses left **three live
  top-prize codes on a night with two winners**. **A redeemed, `draw` or
  `carried` one stays.**
- **RESET SCORES HANDS THE NEXT GAME A CLEAN LEDGER, and destroys nothing.** It
  kept `luckyDip`, so **the draw never ran again**, and kept game one's vouchers
  in the paid set, so game two's winner got nothing. **Marked `carried`, never
  deleted.**
- **AND THE DRAW READS THE LAST QUESTION PLAYED, not the pointer.** Stopping at
  a round intro — when a room is thinning out, which is what the draw is FOR —
  left it reading a question nobody had been asked.

### A TEAM'S SEATS ARE SETTLED AT A BOUNDARY, AND A PHONE MAY NOT MINT ONE

- **`makeTeam()` REFUSES BEFORE IT WRITES.** The caller made the team and then
  joined it, and only the JOIN knew about random mode — so a phone was refused
  **while the team it named was already in the state**: arbitrary unfiltered
  text on the projector, which is the one screen this app never filters. An
  injected team has size 0, so `dealInto()` puts the next honest joiner into
  it. `dealt: true` is the app's own way in.
- **AND THERE IS A CEILING — `MAX_TEAMS`.** There was none: **1,200 teams in
  1.3 seconds** from one phone. **Forty, not `RANDOM_TEAM_MAX`** — six is a
  DESIGN number for what the app deals; this is a SAFETY number.
- **A TEAM MAY ONLY CHANGE AT A BOUNDARY — `TEAM_CHANGE_PHASES`.** The rule was
  `QUESTION && !closed`, leaving the seconds after the clock runs out, the whole
  REVEAL and the FINAL open. **Scores are AVERAGED**, so a table that sheds its
  weakest phone at the reveal overtakes its rival with no question asked.

Full reasoning for both: **[`docs/engine.md`](docs/engine.md)**.

### A TEAM NIGHT IS ONE ENTITY PER BOARD ROW, EVERYWHERE — `boardIdFor()`

It was threaded through the phone's POSITION and nothing else, so one cause had
six symptoms, all live for the whole of any team night and none of them
throwing.

- **`playerCount` IS BOARD ROWS AND `answeredCount` IS PHONES, AND THEY WERE
  PRINTED IN ONE SENTENCE** — *"60 of 6 answered"*, six feet wide in a dark
  pub, beside a pill saying *"6 playing"* to a room of sixty. **`phoneCount` is
  a SECOND field, spread in only when the two differ**, so an ordinary night's
  payload is byte-for-byte what it was.
- **A PHONE'S OWN HEADER IS ITS TEAM'S ROW — score, key, name and position in
  one unit.** It read **1,390** while the projector said **695**, and `you.key`
  never matched a board row, so `play.js`'s fallback drew **every phone its own
  team twice**. **AND THE TEAM'S SCORE IS FROZEN FOR THE LENGTH OF A QUESTION
  TOO**: an average built from live scores moves the instant a team-mate
  answers, which is the `scoreBefore` leak arriving through the average.
- **THE HOST'S PLAYING PANEL LISTS PHONES, because that is what its controls
  act on.** Built from `leaderboard()`, every row carried a `team:` id and
  `adjustScore`/`renamePlayer`/`removePlayer` answered `{ok:false}` **in
  silence**. Same line gave every team an **"off" badge all night**, no team a
  **tick**, and an idle count of **0** where the button would have removed
  nine. **The ordinary night's rows are untouched, with a test pinning the
  field list.**
- **AND THE HOST IS TOLD WHO THE ROOM KNOWS — `whoIsThat()`.** The fastest
  finger, `whoPicked` and `wanderedNow` named handsets under a board of teams.
  **The handset is KEPT beside the team, not folded away** — the tally counts
  PICKS, so deduplicating would leave the names disagreeing with the number
  above them. **The fastest finger's `faceKey` stays the INDIVIDUAL'S**: a team
  has no face.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

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

They were named for where the code keeps them rather than whose they are.

- **My packs** — the ones they write. The panel, the link into the editor and
  the button on every pack tab all say it, so the concept has one name.
- **Quizporium packs** — the ones written for them and sold. Says who wrote it
  and therefore why it costs money, which "the catalogue" never did.

The grid on a pack tab is everything you can RUN tonight, mixed. **What you do
NOT hold is not on it**: the shop is its own tab, so a padlocked card can never
appear among the ones you are choosing between ten minutes before a gig.

### AND THE WORKSHOP SAYS WHOSE — the rail groups on it, the bench badges it

*"The workshop needs to distinguish between packs that I made for the QM and
packs the QM made for himself."* `p.mine` carried it; only a small `Yours` note
on a rail row ever said so.

- **WHOSE IT IS DECIDES WHAT MAY BE DONE TO IT, WHICH IS THE WORKSHOP'S WHOLE
  SUBJECT.** **Yours leads**, as the pack shelf has always had it. **A note
  restating its own heading cost the row half its width.**
- **AND THE GREEN BUTTON WAS PROMISING AN EDIT THE SERVER REFUSES** (rule 11):
  every question was editable and Save answered *"There is already a pack
  called … Give yours a different name"* — an error about an id, on a screen
  with no way to change one, after the work. **Present and inert with the
  reason ON the button**, hollow like Launch. **Gated on
  `can(FEATURES.CATALOGUE)`** — the entitlement the server itself checks, never
  a hat or an account kind.
- **THE BADGE NEVER TAKES GOLD.** Gold is the trophy colour; *Yours* wears
  `--hot`, the one colour that follows a quizmaster's own scheme, and
  Quizporium stays neutral. It rides in the head line so it survives the fold.
- **TAKING YOUR OWN COPY OF A QUIZPORIUM PACK IS NOT BUILT** — forking one is
  a decision about rule 11 rather than a missing button. **Do not add it
  without deciding what a borrowed question stays linked to.**

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

**Every RULE is in this file. The WHY is in `docs/`.** Split three times —
14 and 15 August 2026 — because it had reached ~90,000 tokens and loaded in
full at the start of every session, and grew back to ~50,000 as each feature
landed with its reasoning inline. The decisions TABLE alone was 43,034 bytes
and moved whole to **[`docs/decisions.md`](docs/decisions.md)**, leaving every
decision NAME and every sentence that FORBIDS something, verbatim. Nothing was
summarised: whole sections moved by line number, so nothing could be quietly
reworded on the way through. Open the one you are touching; do not read them
all.

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

**[`docs/gigs.md`](docs/gigs.md)** — venues, prizes, the diary, past nights,
getting paid; **[`docs/gigs/photos.md`](docs/gigs/photos.md)** is the
photographs' own half, and
**[`docs/gigs/gallery-page.md`](docs/gigs/gallery-page.md)** the public
page's — its address, its index, what a stranger sees and what serving it
costs. Both split off at the 100,000-byte cap.

- The winner's prize, on their phone
- The diary — a calendar that maintains itself
- Past gigs — the record of somebody's work, and who may take it away
- Invoicing
- Getting paid: what you have not billed, and who has not paid
- **A deleted photo leaves the repo but NOT git history — never imply
  otherwise.**
- AND THE PREVIEW DID NOT WORK ON THE HOST KEY
- **THE CAMERA GATE IS GONE — every photograph is on the gallery unless a
  human switches it off** (`showsByDefault()`). The EXIF check failed on EVERY
  photograph of a real night, and the index drops a published night with
  nothing showing, so the gallery was empty and silent. `isCameraFile()`
  survives as a NOTE on the lamp, **never a gate**. **THE DEFAULT IS WRITTEN
  OUT ONCE** — a second copy in `/api/gallery-photo/` made a RED lamp put the
  photo straight back on. **The projector is untouched**
- **A LAMP PER PHOTO SAYS WHETHER IT IS ON THE GALLERY, AND IT IS A SWITCH** —
  *"green for on and red for off, no text needed but it must be clickable."*
  **NO WORDS**, so `title` and `aria-label` are load-bearing and the 18px dot
  gets a 44px hit area. **FILLED, which is not a break of
  outlined-never-filled** — a lamp, not a button that destroys.
  **`showsOnGallery()` is the ONE decision and all FOUR readers ask it.** **A
  ruling that only restates the DEFAULT is CLEARED, not stored**
- **SENDING IT IS THE CONSENT. THERE IS NO PER-PHOTO OPT-OUT AND ONE WAS BUILT
  AND REMOVED** — *"I simply shouldn't have access to photos if there's no
  consent behind them in the first place."* A flag the quizmaster has to
  respect is a rule he has to REMEMBER, on a Monday, about a photograph he did
  not take. **Do not rebuild a sender-side switch.** The gate that exists is
  the publish control drawn UNDER the photographs, and the lamp is the
  quizmaster's own.
- **THE COUNT AND THE PAGE ARE ONE QUESTION — `galleryPhotosOf()`.** **AND
  WITH THE FAULT PUT BACK THE GUARD STILL PASSED: it matched the COMMENT
  explaining the fix.** A source check strips comments first, or it goes green
  the better a file is documented
- **IT FLIPS NOW AND SAVES LATER.** A failed write puts the lamp BACK and says
  why on the count line — never an `alert` for something that happened in the
  background, never a silent revert. **It settles before it sends** (600ms)
- **THE PUBLISH LAMP ASKS FIRST, AND THE QUESTION NAMES THE NIGHT** — the
  browser's own `confirm()`, like the other twelve here: **a second kind of
  dialog is the label collision wearing a dialog**, so it reads OK/Cancel, not
  Yes/No. **It says the CONSEQUENCE**, which a coloured P cannot. **AND SAYING
  NO MUST CHANGE NOTHING** — the guard answers NO before yes
- **A ROW READS ITS STATE WHEN BUILT, AND THIS RAIL IS NEVER REBUILT** — the
  press must ask AGAIN (`upNow()`), never close over `up`, or every press after
  the first re-sends *publish*. **The FIRST press was right, which is why only
  pressing twice sees it**
- **THE PIN IS A DRAWING PIN, NEVER A MAP PIN**: a map pin says *location*
- **THE LAST SLIDE POINTS AT THE PHOTOGRAPHS, AND THE ADDRESS EXISTS BEFORE
  THEY DO** — `galleryPath()` in `slugs.js`, one builder, both sides.
  **DERIVED, not stored**: publishing happens afterwards, so the code sixty
  people photograph at eleven opens a real gallery on Tuesday.
- **A SLIDE OF ITS OWN, BECAUSE THE FINAL WAS ALREADY CLIPPING.** **The band's
  QR is 86px at 720p**, hopeless as the only thing on a slide; 34vh here. **A
  flag at the FINAL only** (rule 9), refused with no address, never on a phone.
- **AND THE FINAL FITS NOW, IN TWO PARTS — `.endband` AND `fitWinner()`.**
  **The draw and the comeback go SIDE BY SIDE**; **`fitWinner()` shrinks to fit
  as a backstop**, and **it measures the CHILDREN, not `scrollHeight`**, which
  clamps to the container and under-reports exactly when the content is too
  tall. **`final-fits.mjs`** checks the QR **actually paints**, not that it is
  placed
- **`view.photos` WAS ALREADY TAKEN, AND IT COST THE BUTTON** — the field
  existed, held somebody else's data, the control was never drawn, nothing
  threw. **Found by pressing it in a real browser.**
- **A PHONE THAT SCANS EARLY IS TOLD "not up yet", AND THE WORDING IS THE ONLY
  CHANGE** — the server still answers ONE 404 for every refusal, so a night
  that never happened reads identically to a real unpublished one. **A
  `pending` state leaks which dates exist and was turned down for that**
- **THE COUNT SAYS HOW MANY WILL SHOW, NOT HOW MANY THERE ARE** — the INDEX
  drops a night whose whole set is held back. **A number right about the wrong
  question is how a working app looks broken.** Silent when they all show
- **`/gallery` SHOWS DRAFTS TO WHOEVER IS SIGNED IN, AND THE PAGE HAS TO SAY
  SO LOUDLY** — *"on my phone it's showing nothing but on my laptop it's
  showing two"*, both right: `whoIs()` reads a COOKIE. **THE PREVIEW STAYS** —
  do not level the page for everybody. A panel, full ink, **not red** (nothing
  has gone wrong). **A banner says how many, only a card says WHICH**
  (*"Only you"*)
- **AND `?as=visitor` STANDS THE PREVIEW DOWN, so the check is possible at
  all.** **ON THE SERVER**: a browser-side filter proves the page can hide a
  draft, not that the server refuses one. **IT ONLY EVER SUBTRACTS, which is
  why it needs no gate** — nothing in this app grants a permission from a query
  string. **It rides on every request and link**, or the next page in is the
  preview again. **PRESENT AND INERT**
- **THE LEAGUE BAY IS A VENUE THAT FOLDS INTO ITS NIGHTS** — **the pub's own
  row is `The table`, INSIDE the fold, never the heading**: a heading that both
  folds and picks is one control doing two jobs. **A night row is the DATE and
  nothing else.** `evenings` **carries the POINTS**, so the browser needs no
  second copy of the ladder. **A board with no `position` scores nobody**
- **`node()` KEEPS THE FIRST ELEMENT AND DROPS THE REST, SILENTLY** — a grep
  cannot find these, so `node()` `console.error`s when it drops one.
- **A VENUE HAS ITS OWN ADDRESS** — `/station-tap-wokingham/gallery/20-august`,
  from `public/assets/slugs.js`, **shared by the server and the page**: two
  implementations of one slug is a link that works in the browser and 404s on
  the server. **DERIVED, never stored.** **A ONE-SEGMENT PREFIX AT THE ROOT IS
  A CATCH-ALL AND THE FIRST VERSION ATE `/api/gallery`** — two segments,
  `RESERVED` refuses the first, and `test/slugs.test.js` walks `server.js` for
  every literal top-level route. **An address is not a key**
- **A LEAGUE IS A THING YOU RUN, AND IT IS OFF UNTIL SOMEBODY SAYS SO.** **The
  table is ARITHMETIC; a league is a DECISION** — printing one in the report of
  a pub that never mentioned a league is the app asserting something about
  somebody else's night. **It gates what LEAVES and nothing the quizmaster
  sees.** **Switching it off takes the public page down with it.** **The
  controls under it are ABSENT, not greyed** — the one deliberate exception to
  *present and inert*. **The report asks under BOTH venue keys**
  (`leagueRunsAt()`)
- **THE QUIZMASTER ADDS THEIR OWN ROOM PHOTOS** — `POST
  /api/past-photo/<night>`, **filed against the night in the URL and never
  against today**: the live store dates a picture by the clock, so a Friday
  upload files a Thursday quiz under Friday. **A POST written beside GETs is
  the 404 this repo already shipped once**, so the test asserts against the
  404, not the 400
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
- **SEND THE SCREENSHOT; DO NOT OPEN IT.** *"Can the screenshots be delivered
  to me, and then that context reclaimed immediately after? It's usually just a
  UI decision that I then action and move on from."* **Context cannot be
  reclaimed** — an image is in the window for the rest of the session once it
  is read — but it never has to go in: `SendUserFile` costs one line of text,
  `Read` on a full-page screenshot costs 2–4k tokens. So an agent MEASURES, the
  file is SENT, and it is opened **only when the judgement is Claude's own**:
  *"do these figures read at 200px"* needs eyes, *"does this look right to
  you"* does not.
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

- **`node scripts/pub-unchanged.mjs <commit> --ignore <new fields>`** — every
  payload a projector and a phone receive, at every phase of every pack,
  against a commit you trust, plus one night over HTTP on both apps.
- **Press Launch in a real browser** and check a game is actually running
  afterwards — for a quiz AND for a bingo pack, which take different fields.
  The engine is rarely the hazard; **the console's launch form is**, and no
  unit test presses a button.

The second gets skipped, and it is the one that would stop a night. A
`node --check` passing means the file parses, not that Launch still launches.

**AND ON 15 AUGUST 2026 IT WAS SKIPPED, AND LAUNCH WENT TO THE LIVE APP
BROKEN FOR EVERY GAME.** A function was called in `server.js` and never
imported — a ReferenceError when the line runs, so `node --check` was happy.
**1,150 tests passed**, because every one of them either calls
`session.launch()` directly or reads `server.js` as TEXT: **nothing here had
ever executed the file.** Found by a browser agent clicking the button, which
is what the paragraph above says to do and what had not been done.

`test/launch-route.test.js` is that advice with an assertion on it: the real
server on its own port, a real launch, a projector with a quiz on it after.
**Keep it shallow** — it guards the protected surface, not the feature, and a
slow suite is one people stop running before a gig.

**The general lesson is bigger than the import: A TEST THAT NEVER RUNS THE
ARTEFACT PROVES NOTHING ABOUT IT** — see *Checks*.

### A PUSH IS A DEPLOY, AND A DEPLOY ON A GIG NIGHT IS AN OUTAGE

Render watches `MusicQuizApp`, so **every push restarts the server and wipes
`data/`** — the projector loses its stream, the code in `data/room-codes.json`
stops resolving, and a tab left open shows a lobby that no longer exists.
**A docs file is as dangerous as an engine rewrite when the cost is the
restart rather than the diff.**

**PUSH AS SOON AS IT IS READY. HE SAYS WHEN NOT TO** — set by the host on 5
September 2026 in his own words: *"can you please just always push ASAP I'll
let you know otherwise."* **This REVERSES the ask-first rule that stood here
before it**, and it is his call to make: he is the only person who knows
whether a room is sitting down, and asking every time put a question in front
of him on every change instead of the two that mattered.

**What does NOT change is why a deploy is the risk.** Say it in one line when
a push could land badly — a lobby open on his phone, a gig in an hour — and
push anyway unless he says hold. **The note is the value, not the delay**: he
restarts a lobby in ten seconds knowing that is what happened, and cannot
diagnose it at all if nobody said.

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
  assets/pileup.js     Pile Up — the fifth lobby game: stack the crates
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

- **An unreadable offset plays from the START** — `cueOffsetMs()` returns
  `null` for prose, a negative, `1:75` or anything past ten minutes, so a typo
  costs the old behaviour rather than a silent jump into the middle of a song
  in front of a room.
- **Every pack on disk says `0:00`**, and a test walks `quizzes/` and fails if a
  cue ever arrives with an offset on it. The generator is told to write exactly
  `0:00`, because only somebody who has LISTENED knows where the audio begins.
- **The editor echoes what it understood on every keystroke.** The control
  view prints the offset only when there IS one.
- **DO NOT "fix" this by giving the intro round a longer clock** — a longer
  round is a round worth MORE points, which is the same fault deliberately.
- **AND A QUESTION WITH NO `spotifyUri` MUST CLEAR THE LAST ONE'S FAILURE
  NOTICE.** `room.introPlay` was only ever written inside the play's own
  `then()`, so a cue with no uri returned before it and left the previous
  question's words standing: *"Did not start on its own — tap below"* over a
  track that was never going to start, the reason belonging to another song,
  and NO link underneath to tap. Every catalogue intro round has uri-less cues
  in it. **Only on a question not already spoken about**, or a real failure is
  wiped off the screen of the question it happened on.

Full reasoning: **[`docs/engine.md`](docs/engine.md)**.

### A PLAYLIST BECOMES AN INTRO ROUND, AND THE ANSWER CANNOT DISAGREE WITH THE SONG

`src/import-intro.js`, `POST /api/import/intro`, `introImportPanel()` on the
Workshop door. An intro question holds the song TWICE — `cue.title`, which
plays, and the option the room is marked against — and **nothing compared
them**: validation only asked that a cue existed, so "Duality" could play
against a board marking "Psychosocial" right, and nothing threw.

- **THE ALIGNMENT IS STRUCTURAL, NOT CHECKED** — both are written from ONE
  Spotify track and never typed, so there is no state in which they differ.
  **Do not add a second place the song is typed.** `recue.js` fixes the wrong
  RECORDING; this is the wrong SONG.
- **THE PLAYLIST IS READ, NEVER CREATED** — `round.spotifyPlaylist` is the one
  you already have. A second built from the round is the two-copies-that-drift
  problem on purpose.
- **CLAUDE ONLY EVER WRITES THE WRONG ANSWERS**, in ONE call, the right one
  being off Spotify before it is asked — so a bad reply costs a decoy, never an
  answer key. **`claudeAsker()` returns null with no key** rather than throwing,
  and **the decoys then come from the playlist, SAID OUT LOUD** (`fellBack`).
- **A DECOY THAT IS THE ANSWER IS DROPPED, HOWEVER SPELT** — `sameSong()` only
  ever REJECTS. Short questions are topped up: one may never reach the room
  with two options.
- **`from` IS ALWAYS `0:00`, NEVER GUESSED**, and **an id that exists is
  REFUSED** — importing twice lands on one file and `reloadPackEverywhere()`
  pushes the replacement into a running game.
- **IT MAKES A ONE-ROUND PACK**, which lives on Music Rounds and which
  Tonight bursts into a tile — no new composing UI.
- **THE SPOTIFY HALF IS INJECTED** (`readPlaylist`/`configured`): **an ES
  module namespace is READ-ONLY**, so a test cannot stub the import.
- **AND THE GENERATED PATH GETS THE SAME GUARANTEE — THE CUE WINS.**
  `buildIntroPlaylist` resolved the CUE and left the option as Claude typed it.
  It compares them with `sameSong()` now and rewrites the option to the cue on
  a REAL disagreement, **saying which**. **Only a real one**: this string is on
  the PROJECTOR, and canonicalising every option puts *"Duality - 2008
  Remaster"* six feet wide in front of a room. The checking pass prints
  `ANSWER >` above `plays:` and **is never asked to compare them**.

Full reasoning: **[`docs/generation.md`](docs/generation.md)**.

### EVERY INTRO CUE IN THE LIBRARY HAD NO `spotifyUri`, SO THE AUTO-PLAY HAD NEVER FIRED

`scripts/recue-all.mjs`. `startIntroTrack()` returns early on a cue with no
uri, so **270 cues across every catalogue pack put the question up and played
silence** — nothing thrown, nothing logged. **IT WALKS THE PACKS THROUGH
`recueQuiz()` — do not write a second "find the track"**, or the console and
the room disagree about which record is playing. **Handed the version on disk
as `previous`**, so it only ever fills GAPS. **RUN IT LOCALLY AND COMMIT** —
`quizDir` is the repository's own folder, so a write on Render is gone at the
next deploy. **The misses are NAMED**, for a human, before a gig.

### THE PICTURES BUTTON SAYS HOW MUCH OF ROUND 2 IS DRAWN

`pictureLabel()` in `console-packs.js`, off `art` from `imageStatus()`. The
answer existed and cost a press per pack. **`imageDir` IS AN OPTIONAL ARGUMENT
TO `listQuizzes()` AND THE LAUNCH PATH MUST NOT PASS ONE** — a stat per picture
question is work on the protected surface bought for a badge on a shelf. **The
reason a control is ON goes on the control**, so it is the existing button
saying more rather than a second badge. **A placeholder counts as NOT drawn.**

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
  a pack is launched. **Night settings sit above the packs, a picked pack's
  below** — tap a tile to pick it.
- **ONE gradient button on the whole console.** There were three on this bar
  alone, and a Launch on every pack card besides.
- **THE CONSOLE AND THE BIG SCREEN MUST AGREE, ALWAYS.** A choice STICKS, and
  `paintLive()` prints what is on the projector in gold when it differs from
  what the bar is set to.
- **A LOADED PACK IS NOT A NIGHT — `state.launched`, and Unlaunch is what it
  was for.** A room ALWAYS has a game built, so the live line named a quiz on a
  console nobody had touched and `resetAll()` built another lobby around the
  SAME pack. `false` in both `freshState()`s, `true` in `session.launch()`
  alone. **Written EXPLICITLY, so ABSENT can mean launched** — a state on disk
  from before the field existed is there because somebody launched it. **Not
  `launchedSinceBoot`**, which answers a different question in MEMORY.
- **Picking a pack puts it on the big screen when nothing would be lost.** THE
  SERVER decides — the launch call without `replace` answers 409 when
  `session.inProgress()`. A 409 is SILENT here. A re-render is not somebody
  choosing a pack (`quiet`), and what is running is READ BACK.
- **IN THE ROOM / ONLINE is a switch in the head** — a setting whose wrong
  value ruins the night belongs where it is read. **BOTH halves wear the same
  lit treatment**, never the gradient (Launch keeps that). Shut, the line still
  says "Online".
- **The venue is chosen HERE and on the Venues shelf, nowhere else** — both go
  through `chooseVenue()`. **Neither the venue nor online is remembered on the
  device**: both are facts about one evening, and a remembered one files next
  Tuesday under last Thursday's pub.
- **Whose night it is, RANKED**: a date you typed, then whose usual night, then
  where you played last. **Two claims are NAMED, never left blank**
  (`clashTonight()`).
- **It folds to a thin line that still says what it is set to**, in
  `localStorage`; one row, no wrap, the middle ellipsised. **The heading does
  not move when it folds** — a three-cell grid and a fold that says HIDE and
  SHOW at a fixed width.
- **THE PACK CARDS NO LONGER LAUNCH; TONIGHT IS THE ONLY WAY IN.** **The
  guarantee was never a Launch on every card, it was that launching is one
  predictable move away.** A card keeps what is true of the PACK behind the
  Workshop door, and **on the Console a tap puts it in Tonight**, same path as
  a drop.
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

- **A SHOW IS `items` — A LIST of what is played, in order.** **The prizes,
  look and lobby game stay on the SHOW**, which is what makes swapping one part
  out unable to touch them.
- **THE VENUE IS NEVER SAVED, AND NEVER RESTORED.** A show is a TEMPLATE, not
  a record; the prizes and the voucher follow the venue, so a stale one is
  somebody refused a drink. `tonightAsShow()` does not store it and
  `applyShow()` does not read it — **both halves**, or an old show still drags
  a pub in. Do not put it back.
- **`itemsOf()` IN `show-parts.js` IS THE ONE READER**, server and browser; the
  one-game shape reads as a list of one. **There is no migration step and there
  must not be one** — a rewrite over everybody's file is a one-shot script on a
  disk wiped every deploy.
- **IT IS THE LAUNCH PAYLOAD WITH A NAME ON IT** — `tonightAsShow()` reads the
  SAME state the launch reads, or a show plays something other than what was on
  the bar.
- **THE BAR PLAYS ONE PART AND SAYS WHAT FOLLOWS** (`paintThen()`). **The next
  part LOADS, never launches** — only the person on the mic knows when the quiz
  is done. **Picking a pack by hand clears `showRunning`**, or the bar describes
  a night nobody is running.
- **IT STORES REFERENCES AND NEVER COPIES** — rule 11.
- **IT IS NOT A GATE AND MUST NEVER BECOME ONE.** The launch re-checks the
  tier, the packs and the lobby game.
- **CALLED A SHOW BECAUSE "NIGHT" IS TAKEN TWICE** — Calendar's are bookings,
  Gigs' the archive.
- **THE ORDER IS REBUILT INTO `lbExtra` AND `lbOff`, never held a third way**,
  and **a BROKEN SHOW IS NAMED ON THE CARD, DAYS EARLY.**
- **A BINGO PART CARRIES ITS OWN CARD AND PRIZE COUNT**, beside the show's own
  pair rather than instead of it. **The part's own beats the show's and the
  show's is the fallback**, so every one-game night and every older show reads
  as it did. `normaliseItem()` had dropped both — **the whitelist trap, for the
  fifth time.**
- **DROPPING ONE IN FROM ANOTHER DOOR GOES TO THE CONSOLE DOOR — `goToDoor()`.**
  Tonight is only built on the CONSOLE door, so a show tapped on the Workshop
  shelf re-rendered a page with nothing that reads it: **nothing threw and
  nothing moved**. **`history.replaceState` and a re-render, never a door
  chip's `location.href`** — a reload throws `showWanted` away.
- **KEEPING A NIGHT IS ON TONIGHT'S SETTINGS; WHAT IT PLAYS IS EDITED ON THE
  CARD, WORKSHOP ONLY** — no second composer to disagree with the launch.
- **DROPPING ONE IN NEVER LAUNCHES**, and there is a TAP as well as a drag,
  because HTML5 drag never fires on touch.
  **[`docs/console.md`](docs/console.md)**.

### QUIZ → BINGO → QUIZ, ONE RUNNING SCORE — a saved show, or dragged straight onto Tonight

`Session.launchRunningOrder()`/`advanceOrder()` in `src/session.js`. **NO
`engine.js` OR `bingo.js` CHANGES.** The boundary between parts is the pause
every night already has — a composed quiz's own `ROUND_BOARD`, bingo's own
`WON` — so the control view offers **"Continue to the bingo/quiz"** there, and
an intermediate part never reaches FINAL/FINISHED: never archived, quiz prizes
never issued early. **Roster carries via a real `join()` on the fresh engine**,
with the TOKEN patched on afterwards — `join()` mints a fresh one, which would
strand the phone's own — and the SCORE patched in for a quiz part only, held in
`this.carriedScores` across a bingo interlude that has no score field. Every
pack in every part is loaded before ANY of them launches, or a deleted pack in
part three throws in front of the room hours later. Two ways in: a saved
SHOW's editor, or the Tonight row itself (`console-tonight-mix.js`/`-ui.js`;
`lbSlots`, `null` on every ordinary night).
**[`docs/console.md`](docs/console.md)**.

### A PACK ARRIVES AS ITS ROUNDS — one tile each, and the launch collapses back

`addQuizPackSlot()` / `slotsFromSimple()` / **`simpleNight()`** in
`console-tonight-mix.js`. *"The packs shouldn't be dragged in as packs… the
pack will be dragged onto the bay and then all of the rounds go into separate
slots."*

- **NOTHING IS COPIED.** A slot has always held `packId` plus round INDEXES, so
  a burst tile still points at the one file on disk.
- **THE ROW CHANGED AND THE NIGHT DID NOT** — `segmentsFromSlots()` merges
  consecutive quiz slots into ONE segment, so three tiles compile to what one
  compiled to. Tested `deepEqual`.
- **AND `simpleNight()` IS WHAT KEEPS EVERY GIG OFF THE RUNNING-ORDER ROUTE.**
  `lbSlots` alone sent a night down `/api/host/launchOrder`, moving the
  protected path for every booking in exchange for a LAYOUT change. The row
  bursts and the launch collapses: one pack, rounds ascending, no `order` at
  all — **verified by reading the request body out of a real browser**.
- **THE ROW GROWS A WHOLE ROW AT A TIME**, six then twelve, capped at
  eighteen.
- **A TILE NAMES THE ROUND, AND ITS SECOND LINE SAYS WHAT KIND OF ROUND** — a
  row of tiles all reading "1980s Pop" says nothing about the order of the
  evening, and neither does a row of subs. **The "Round One — " is trimmed
  off**, or the distinguishing half is what gets clipped.
- **MOVING A ROUND IS MOVING ITS TILE NOW** — the tile's own grip is the
  handle. `drag-check.mjs` COUNTS tiles rather than pinning a round count.

### A QUIZ PACK IS 20 GK, 10 PICTURES, 10 INTROS — REPORTED, NEVER ENFORCED

`STANDARD_ROUNDS` / `shapeGaps()` in `src/quizzes.js`, `node
scripts/pack-shapes.mjs`. Set 8 September 2026: *"a quiz pack needs a GK round
of 20 questions, a 10 question image round and a 10 question intros round."*

- **A STANDARD, NOT A VALIDATION.** `validateQuiz()` blocks saving; this must
  never — a pack half-written on a Monday is normal, and a rule refusing to
  save one makes the standard an obstacle to reaching it.
- **AT LEAST, NOT EXACTLY** — a `multi` or `alphabet` round on top is a longer
  night. **Do not delete rounds to fit the shape.**
- **COUNTED BY TYPE ACROSS THE PACK, not per round** — twenty GK in two rounds
  of ten is the same night, and half the library is written that way.
- **A ONE-ROUND PACK IS EXEMPT** — a component on Music Rounds; holding it to
  the shape of a night is the round/product confusion again.
- **AN INTRO CUE NEEDS ONLY A TITLE OR ARTIST** — no Spotify URI — so an intro
  round is writable by hand and played off the DJ app. **A PICTURE QUESTION
  NEEDS ITS `image` FILE**, so that round cannot be written ahead of the
  artwork: it costs money and waits to be asked for.

### QUIZ PACKS, THEN ONE TAB PER ROUND TYPE — and a round tick wears a glyph

`onARoundTab()` in `console.js`, the `text` / `images` / `intro` entries in
`TABS`, `isOneRound()` / `roundGlyph()` in `pack-look.js`. *"Can we rename
'music quiz' tab to 'quiz packs' and then each tab below is a round so General
Knowledge, image, music intro and music bingo?"* **Music Rounds is deleted** —
the tab, not the rules under it.

- **THE PACK IS THE PRODUCT; THE ROUND IS THE UNIT.** Twenty-four one-round
  packs took the whole quiz shelf and pushed every actual quiz off the one the
  Console launches from, which is why they are not on it.
- **THE AXIS RULE IS NOT REVERSED, ITS SCOPE IS.** *The axis is round count,
  not round type* decides which shelf a PACK goes on and still does — seven of
  eight multi-round quizzes MIX types, so a single-TYPE rule pulls a whole quiz
  onto the wrong shelf. These three tabs list ROUNDS, so a mixed quiz gives its
  GK round to one and its intro round to another. Derived, never declared.
- **SO MUSIC ROUNDS IS DELETED RATHER THAN KEPT BESIDE THEM** — every one of
  its twenty-four one-round packs is now a card on the tab for its own type,
  and keeping it lists the same twenty-four twice under two questions.
- **A ONE-ROUND PACK WITH NO TAB OF ITS OWN STAYS ON QUIZ PACKS.** There are
  none today, and a lone `multi` or `alphabet` round saved as a pack would
  otherwise be on NO shelf at all — nothing throws, the file is fine, and the
  pack is simply unreachable.
- **A TAB ID IS NOT A GAME KIND, and conflating them is silent.** `kind` builds
  the card, the edge colour and the `{id, kind}` a drag carries, which
  `packOf()` resolves against `gameOf()` — a tab id there resolves to NOTHING,
  state consistent and the reader lost. So `TABS` carries `kind: 'quiz'`.
- **"IMAGE ROUNDS" KEEPS THE WORD ITS TWO SIBLINGS DROP** — "Image" alone
  reads as a media library, and Photos is a tab behind the Community door.
- **THE ROUND TYPE IS A GLYPH OR A WORD, NEVER A COLOUR.** Asked for as a
  colour code twice — on the ticks, then on the Tonight tiles: a tick is a
  SWITCH carrying *is this round played tonight*, and on a tile the EDGE
  already means the kind of pack, which a mixed night needs most. **Green, pink
  and purple are each already spoken for.** So it is the glyph plus `title` on
  a tick, and **`typeLine()` in WORDS on a burst Tonight tile** — which takes
  the sub's line rather than a third one, and **keeps the pack name only when
  the night holds more than one pack**, a row of four subs all reading "2000s
  Metal" being the same emptiness the tile's own naming rule already forbids.
- **AND THE SEVENTH TAB MAKES `console-frame.mjs`'S KNOWN BANNER-STATE FAILURE
  ONE TAB WORSE AGAIN** — see the foot of the section below.

### IMAGE ROUNDS IS A VIEW OF ROUNDS, NEVER A COPY OF THEM — `console-rounds.js`

*"We'll need to add an image rounds tab"*, then the model behind it: *"a quiz
pack is theoretically just an amalgamation of the other three."*

- **COUNTED FIRST, AND THE COUNT DECIDED THE BUILD** — **three** picture rounds
  in all, every one INSIDE a full quiz, so a tab of one-round `image` packs
  would have been an empty shelf.
- **COPYING THEM OUT IS RULE 11 RUNNING BACKWARDS**, so nothing is extracted. **A
  card is a VIEW** — `packId` plus a round INDEX, what a Tonight slot and a
  pack card's round tick already hold. Nothing written, nothing stale.
- **IT TRAVELS THE ROUND CHANNEL** — `addRoundToTonight()` and
  `shelfRoundDrag`, never `packDrag`: a synthesised id like `2006#1` resolves
  to NOTHING through `packOf()`.
- **THE PACK NAME IS THE TITLE AND THE ROUND'S IS THE SUB — the opposite of a
  Tonight tile.** A tile tells one pack's rounds apart; this tells packs apart,
  and every picture round here is called *"Whose Face Is This?"*
- **`tab.section` AND `tab.count` ARE THE TWO HOOKS.** Without the second the
  badge read **33** over a shelf of three. **`gameSection()` is not reused**:
  its pin, search, mode dropdown and editor link all act on a FILE.
- **THESE ARE NOT PRODUCTS** — no rename, no delete, no price. **If the
  amalgamation model is taken all the way**, a quiz pack REFERENCES three round
  files rather than holding their questions, and this shelf then lists real
  packs unchanged. **Do not start that on a gig week**: it moves `loadQuiz()`.
- **AND A PICTURE ROUND IS DRAWN FROM HERE, THROUGH THE PACK CARD'S OWN
  PANEL.** *"If that can't be done here I need an empty pack added to the image
  tab so I can generate it in there."* **There is nothing to add: the round is
  already on this shelf** — `QUIZ_ROUNDS` ticks `image`, so a generated quiz
  arrives WITH its picture round and without the pictures, drawing being a
  press that spends money and waits to be asked for. **An empty pack invented
  to hold them is a second file for a round that exists — rule 11 backwards.**
  So it is `picturePanel()`, EXPORTED rather than copied, hung under the grid
  with the pack NAMED, **one open at a time**. **Workshop door and
  `FEATURES.CATALOGUE` only** — the pack card's own gate, and on the Console a
  tap means *put this in Tonight*.
- **THE EMPTY STATE NAMES THE TYPE**, or General Knowledge tells an empty
  library it holds no PICTURES.
- **AND A TARGET HAS TO ANSWER BOTH CHANNELS.** The bench asked for `packDrag`
  alone, so a round in the hand fired no `drop` at all and nothing lit up.
  **The payload is not changed to suit the target** — a round card carrying a
  PACK would be a descriptor that lies about what is in your hand. The bench
  learns `shelfRoundDrag` and benches the round's PACK, which is what its TAP
  already does.
- **AND EACH NEW TAB MAKES A KNOWN FRAME FAULT ONE TAB WORSE.**
  `console-frame.mjs` already failed *"every tab is still reachable with one
  up"* at 1500x900 **with a banner above the doorhead**: `.consolecols` clamps
  to its 200px floor, is `overflow: visible`, and the tab column is not
  constrained to it, so the overflow escapes the frame with no scroller to
  reach it. **No-accounts state only.**

### A TAB ID IS NOT A GAME KIND, AND A SHELF IS NOT THE LIBRARY

`GAME_KINDS` in `console.js`, `shelvesFor()` in `console-tonight.js`. Two
faults from ONE change to the tab list, both silent, both on the protected
surface, and `npm test` could see neither.

- **THE GAME PICKER IS BUILT FROM `GAME_KINDS`, never "every tab with a
  shelf"** — the old filter grew from two entries to five, so it offered Image
  Rounds and sent `gameOf().id` as `game`: **`400 Unknown game: text`**.
  **NAMED, never derived from a row's shape.** `LAUNCHERS` is the server's
  half; `game-kinds.test.js` fails the moment they part.
- **WHAT IS DRAWN IS A SHELF QUESTION; WHAT A NIGHT MAY REFER TO IS THE
  LIBRARY.** Quiz Packs hides the one-round packs, so `applyShow()` resolving
  against THAT shelf left **Tonight empty with nothing said**.
- **BUT `games[].packs` STAYS THE TAB'S OWN** — `quickPicks()` ranks
  never-played first, so widening the DRAWN shelf auto-fills Tonight with an
  intro round. Resolution widens; ranking does not.
- **`node scripts/tonight-resolves.mjs`** opens the real console.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### THE PACK SHELF SHOWS EVERY PACK YOU HOLD, ON BOTH DOORS

*"Limiting to 6 seemed like a good idea at the time but it actually isn't now
I think about it."* The reason written for the cap had expired twice over.

- **THE CAP WAS THE DRAG'S, AND THE DRAG IS NEITHER THE ONLY WAY IN NOR STILL
  CONSTRAINED** — **a TAP places a pack** through the drop's own path, and the
  fixed frame keeps the doorhead on screen from 900px.
- **A CAP WITH NO WAY PAST IT IS THE ONLY KIND THIS APP MUST NOT HAVE.** The
  Console has no search box by decision, so six of thirty-three left the rest
  reachable only by pinning in the Workshop and coming back — and that shelf is
  now the ONLY way onto the bench. **`PACK_SHELF` is deleted, not left at 6.**
- **PINS STILL RANK IT**, and **there is still no See all**: a shelf that is
  sometimes two rows is what makes a drag target unlearnable.
- **AND THE LABELS NAME THE TAP.** *"Drag a pack in to launch"* named the one
  input a phone does not have. **The drag stays the fast path and is not
  advertised** — it is found by trying it, which is how a drag always is.

### THE WORKSHOP BENCH FILLS ITS BAY — one pack, big, and what you do to it

Taking the rail off left the bench 142px of content in a 362px bay.

- **THE PACK IS A SQUARE POSTER, AND THE SQUARE COMES FROM A COLUMN WIDTH.** A
  bench drawing the thing you are working on at 92px with 220px of nothing
  under it has the emphasis backwards. **`--bench-poster`, two numbers like
  `--bay-h`** — each is the bay less the head, the pack-actions row and the gap.
- **NEITHER `auto` NOR THE ROW'S HEIGHT MAY DECIDE IT.** An `auto` track sizes
  to MAX-CONTENT — the pack's NAME — so a long title made a tall square;
  height-first needs a definite height, which only exists under the FIXED
  FRAME. **Width-first has one answer at every size.**
- **THE BUTTONS KEEP THEIR OWN SIZE**, **never one 800px-wide button**: *a
  button's width should say how big the action is*. **As many columns as there
  are buttons**, or the packs with no picture round leave a hole.

### A PACK WEARS ITS OWN SUBJECT

`public/assets/pack-look.js`, `.pack-card.tinted` / `.lb-tile.tinted`. A pack's
background is derived from its title — a decade, a genre, Christmas — and
anything unrecognised gets a quiet colour of its own, so no card looks
half-built beside a dressed one. **The job is SCANNING**: find tonight's pack and press
Launch, and nine identical cards make that a reading task.

- **It DERIVES, never stores** — nothing in a pack file.
- **Genre beats decade beats nothing; seasonal beats both.** **"Pop" is
  deliberately not a subject** — nearly every pack here is one. **A word only
  earns a place if it tells two packs APART.**
- **Whole words only** — "rock" must not match "Rocky". Punctuation is
  stripped so "R'n'B" and "RnB" are one thing, so the spaced forms are listed
  too.

- **A WASH, NEVER A FILL AND NEVER A BORDER**, capped low — which is why it can
  coexist with gold/green/red: a Christmas pack IS red and green, and `broken`
  is a BORDER, so the two never speak in the same place. Test on the alpha.
- **The same colours and the same trimmed name on the card and in the Tonight
  slot**, from one function. **The same pack is the same colour on every device
  and reload** — a shelf that reshuffles is worse than one with no colour.
- **THE EDGE IS THE KIND OF PACK; THE BACKGROUND IS THE ERA.** Two channels,
  two questions, one glance. Quiz green, bingo purple, **adding a kind is one
  line** in `KIND_EDGE`. **The Tonight tile takes its kind from the PACK, not
  the tab** — Tonight holds both at once, and two TABS can share one kind.
- **A SHUT CARD IS A SQUARE POSTER — the era fills it, the name on a dark fade
  at the bottom.** **`aspect-ratio` is on `.shut` ALONE**, or the shape decides
  what an open card may carry. **The fade is a `::before`, never a wrapper.**
- **THE DRAWN TITLE IS TRIMMED AND THE STORED ONE IS NOT** (`shortTitle()`).
  **Nothing writes anything — SEARCH LOOKS INSIDE TITLES.** **Falls back to the
  full title when the trim empties it.** Three sizes by length, calibrated to
  the REAL 146px card: **a design measured against invented content is measured
  against nothing**, and the first ones clipped two real names.
- **THE ERA IN THE CORNER RAN THROUGH THE TITLES** — centred under a fade it
  cannot; the Tonight tile keeps the corner. **Only printed when short enough to
  read**, with a test on the length. Gradient text behind an `@supports` with a
  SOLID colour first. It needed `position: relative` on `.pack-card` — the
  **Yours** badge had been positioning against the wrong ancestor.
- **THE EDGE IS THE KIND AND THE WASH IS THE ERA; the difference in strength is
  the job.** **On the bottom because an ordinary button already carries the
  account colour there** — a stripe down the LEFT was rendered and turned down.
  **`:not(.broken)` is load-bearing**: the tint rule comes later in the sheet
  and would overwrite the red on a broken card. **And the TILE needs `.lb-tile.is-pack` named in its rule**: **a shorthand
  `border` lower in the sheet beats a longhand `border-bottom` higher up at
  equal specificity, and nothing throws.**
- **CARTOON FIGURES WERE TRIED AND DO NOT READ — do not re-propose them
  without new evidence.** At the real card size a whole person is a blob.
  **And never a named person** — this app is sold, and a decoration is a far
  weaker case for a likeness than a picture round.

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

- **A night's headcount is the MAX across its games, never the sum.**
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
  this lately*; the shelf is for *will this room have heard it* — so the 80s
  quiz run at The Crown on Tuesday is fresh at The Station Tap on Thursday, and
  the old ranking buried it at both.
- **NEVER PLAYED HERE READS AS NEVER PLAYED** — 0, not the global date, or the
  feature does nothing.
- **WITH NO VENUE CHOSEN IT FALLS BACK TO THE GLOBAL DATE**, so that night
  behaves exactly as it always did.
- **A NIGHT IS FILED UNDER ITS ID *AND* ITS NAME, and the reader asks under
  both** — nothing on a hand-typed night says which book entry it meant.
- **THE ORDER AND ITS EXPLANATION COME FROM ONE PLACE.** `playedLine()` LEADS
  with the local answer, because *"Played 4 times"* over a card at the FRONT of
  the shelf reads as a bug. **The two halves must never contradict**: "Never
  played · here 2 days ago" is a sentence this app cannot print.
- **CHANGING THE VENUE RE-RENDERS THE SHELF.** `chooseVenue()` repainted the
  bar alone, leaving a grid ordered for the pub before it — silently.
- **The arithmetic is on the SERVER and the venue question is in the BROWSER.**
  `src/heard.js` rides with the library rather than being fetched per venue
  change, because the shelf re-ranks on every one.
- **A MIXED NIGHT COUNTS EVERY PART**, or a bingo interlude reads as never
  played here.

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
  a button on the collapsed row is one tap from a stranger's face going
  public.
- **It says what publishing means in one line** — *"Anyone with the link can
  see these."* A warning is the exception to the short-label rule. Not red: it
  is read BEFORE pressing, and red would say a mistake had been made.
- **Taking it down is as prominent as putting it up**, outlined red — the
  honest answer to somebody asking is a quizmaster who can do it stood
  there.
- **THE OWNER PREVIEW NEEDS THE KEY AND WAS NOT SENDING IT.** `/gallery` shows
  unpublished nights to whoever is signed in — but the page sent nothing on a
  `?key=` link, so the preview silently failed on the identity most likely to
  be checking. Read **from the URL, never from localStorage** (the remembered-key
  rule), and put on the IMAGES too, because the photo route re-checks for
  itself.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

### WHERE A PAST NIGHT WAS IS SAID AFTERWARDS — `console-night-venue.js`

**A venue is the one fact a host can still supply**; everything else in a filed
night is what the app watched, and letting a human edit that makes the evidence
worth less. **Both ways in live in ONE module** — a night dragged under a pub's
heading in the rail, and a picker under the photographs, because HTML5 drag
never fires on touch AND the rail only draws pubs that already have
photographed nights.

- **IT PATCHES EVERY RECORD FOR THAT DATE, ACROSS BOTH `gigRoomsFor()` ROOMS** —
  one date can hold a quiz and the bingo after it, and naming one of them folds
  the evening straight back to `venueMixed`.
- **A NIGHT WITH NOTHING FILED GETS A `kind: 'note'`, AND A NOTE IS NOT A
  GAME** — `mergeGigs()` skips it, so no phantom nought-player quiz reaches the
  headcounts, the league or *heard here*, and *"No results saved"* stays true of
  a night that genuinely has none.
- **"No venue on these" IS A CARD LIKE ANY OTHER** — it was left out of the
  auto-open, so the night somebody opened in order to SAY where it was kept its
  controls folded away.
- **A ROW WITH NO GROUP IS NOT DRAGGABLE** — *The wall* belongs to no pub, so
  dragging it would light a heading that then did nothing.

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

### A LAPSED SUBSCRIPTION GETS ONE MORE NIGHT — `lastNightLeft()` in `accounts.js`

*"I don't want someone to get a nasty shock if they haven't paid — I know what
it's like struggling for money. I want them to be able to run the nights they
thought they were gonna run, but it warns them: this will be the last night you
can run. Then it cuts them off at midnight."* **This REVERSES the pinned test
that said no new night starts on a lapse**, on his reasoning: *"it seems a bit
unnecessarily harsh, and if they like the software the chances are they'll
pay."*

- **IT IS A DAY, NOT A COUNT.** A quiz and the bingo after it are ONE night —
  charging the second takes away the half a host is standing in front of.
  `useLastNight()` is idempotent per day.
- **AND THE DAY ROLLS AT 6am, NOT MIDNIGHT** — `nightDay()`, the boundary Past
  gigs, the photos, the league and the headcounts already use. He said midnight
  and meant *"not the next day"*; 6am is that sentence as this app already
  defines a day, and the only version that cannot refuse a second game at ten
  past twelve to somebody still in the pub.
- **STAMPED BY THE LAUNCH ROUTES ALONE, never by the check** —
  `mayStartSomething()` runs on every gated route, so spending it there burns
  Thursday by opening the console on Wednesday. **Both launch routes spend it**
  or the composed half hands out an endless grace.
- **A GROUP'S LAST NIGHT BELONGS TO THE PARENT** — five seats on one unpaid
  subscription get one night between them. **AN EXPIRED TRIAL GETS NOTHING**:
  a grace there is a free gig for anyone who signs up and walks away.
- **PAYING AGAIN CLEARS IT — a CONSEQUENCE of the status, never a field a
  webhook may name.** A processor able to write `lastNight` could hand out a
  night by naming tomorrow.
- **AND THE WARNING IS THE HALF THE GATE CANNOT DO** — `lastNightWarning()`.
  A refusal arriving when the button stops working IS the shock. **The SERVER
  answers whether** (`me.lastNightLeft`): re-derived from `status` it would
  warn a seat whose parent had already spent the night. **It names what still
  works FIRST**, and **it is not red** — tonight runs.
- **`console-warnings.js` IS A SEAM, TAKEN RATHER THAN A FIFTH PAYMENT ON THE
  LINE CAP** — `console-breaks.js`'s shape. A leaf, handed what it needs.
- **AND THE CONSOLE'S OWN GATE HAS TO AGREE WITH THE ROUTE'S —
  `entitlements(account, { asIfPaying })`.** The route allowed the night and
  every test passed, while `can()` reads `entitlements.features`, EMPTY on a
  lapse — so `launchBar()` returned an empty div and **the console drew no
  launch bar at all**. A grace nobody can press reads as the app being broken.
  **Only `held` and `on` take the substitute**: status and every `whyNot()`
  reason read the REAL account, so capabilities open and the standing is told
  straight. **Found by a browser agent taking the screenshot** — *a test that
  the payload is right proves nothing about whether anybody drew it.*
- **AND THE STAMP IS THE LAST THING ON THE ROUTE, NEVER THE FIRST.** Spent
  before the pack check and the 409 it was spent by launches that never
  happened — a pack since deleted, a prompt somebody cancelled, and worst
  `switchIfFree()`, which fires a real launch and swallows the 409: **tapping
  a pack tile on a Wednesday silently spent the Thursday**, which is exactly
  the nasty shock this exists to prevent.
- **AND A SEAT IS A PAID THING — `POST /api/group/seats` HAD NO GATE AND NO
  CAP, WHICH WAS A WAY ROUND THE WHOLE SUBSCRIPTION.** A lapsed account added
  a seat, read the reset link out of the reply, removed it — leaving an
  ordinary `active` account — and launched. So the route asks for good
  standing, and **`removeChild()` leaves `cancelled`**: a seat never paid for
  anything, its standing was the parent's. It still destroys nothing and gets
  the grace night like any lapse. **NOT a `FEATURES` flag** — which tier may
  run a group is a pricing question nobody has answered. **`MAX_SEATS` is 50,
  a SAFETY number like `MAX_TEAMS`.** See
  **[`docs/business/groups.md`](docs/business/groups.md)**.
- **NONE OF IT CAN HAPPEN UNTIL A PROCESSOR IS WIRED.** `applyBilling()` alone
  sets `past_due` and nothing calls it, so this is groundwork and
  `test/last-night.test.js` seeds the state and asks over HTTP — the unit tests
  only ask the BOOK, and the STAMP is the half they cannot see.

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

`roundPlan()` in `src/generate-quiz.js` — `rounds` is a list of
`{ type, count }`, so "fifteen general knowledge, five pictures and ten
first-letter" is one call. **It is also the whitelist and the clamp, in ONE
place**, so a typo is dropped rather than quietly becoming a round of general
knowledge. **Unticking a round GREYS its count rather than hiding it**, so what
you typed is still there when you tick it back on.

---

## Checks

```bash
npm test        # no network, injected clocks — must stay green
npm start       # then /console?key=... from the printed log
node scripts/shots.mjs --key KEY       # screenshots of a whole quiz
node scripts/shot-bingo.mjs            # bingo, incl. card-reload
node scripts/bingo-prizes.mjs          # does a bingo prize reach who won it?
node scripts/pub-unchanged.mjs HEAD~1 --ignore online   # did I break a pub night?
node scripts/drag-check.mjs             # Tonight's drags, with a REAL browser drag
node scripts/tonight-resolves.mjs       # does the bar offer real games, and find every pack?
node scripts/community-bay.mjs          # does the Community bay still fit the frame?
node scripts/console-frame.mjs          # is every Console control reachable?
node scripts/console-controls.mjs       # and does pressing one do what it says?
node scripts/dead-controls.mjs --door console   # and is anything inert? (25min for all)
node scripts/pages-scroll.mjs           # can a person actually scroll each page?
node scripts/final-fits.mjs             # is the last slide of the night all on screen?
node scripts/advert-on-the-wall.mjs     # does a corrected slide reach the room?
node scripts/bar-reaches-the-room.mjs   # does the bar's card reach the room?
node scripts/reaches-the-wall.mjs       # does a correction reach the projector?
node scripts/lobby-games-play.mjs       # do the five games draw, run and score?
node scripts/pack-shapes.mjs            # which quiz packs are short?
node scripts/pack-repeats.mjs           # does one night ask the same thing twice?
node scripts/phone-holds-up.mjs         # what a phone does when a request fails
```

**The rules these commands run on, and each was learned expensively — the full
account is in [`docs/checks.md`](docs/checks.md):**

- **`node --check` every browser file you edit.** Nothing here executed
  `public/` for two years; a stray backtick in an HTML comment made
  `console.js` a syntax error and `/console` did not load at all, with the
  suite green. `browser-parses.test.js` closes it.
- **PUT A FINGER ON IT — `console-frame.mjs`.** Three bugs in one week were one
  bug: a control in the DOM, with a size, passing every test, not on the
  screen. **`elementFromPoint()` at a control's middle sees clipped, off-screen
  and painted-over at once** — *in the document*, *has a size* and *can be
  pressed* are three questions, and the gap has bitten five times. **It may
  only scroll what a FINGER could** — `auto`/`scroll`, never `hidden`, never
  `body` (its overflow propagates to the viewport). **It launches a quiz and
  puts a banner up**: an idle bar is narrower than the one that broke. Six
  sizes; verified by reintroducing four real faults.
- **`pub-unchanged.mjs` is the one to run before a gig week**, and **compare
  against the branch you are merging into, not `HEAD`** — on a clean checkout
  `HEAD` IS the working tree, so it can only print IDENTICAL. Quoted as a pass
  twice while proving nothing.
- **When it says IDENTICAL, ask what it did not compare.** Five separate faults
  in that one script each made it answer confidently about something it was not
  looking at — in `docs/checks.md`. **A guard that quietly tests nothing is
  worse than no guard, because it is believed.** The fifth was the biggest: it
  only ever ran `engine.js`, so `viewFor()` in `server.js` and the whole of
  `session.js` were outside it — deleting `view.joinCode` said IDENTICAL.
  **It starts both apps and drives a night over HTTP now.**
- **A SYNTHESISED `DragEvent` IS NOT A DRAG.** The browser's own preconditions
  are where this bar keeps breaking: no `drop` fires unless `dragover` called
  `preventDefault()`, and none fires if `dropEffect` is one the source's
  `effectAllowed` forbids. A dispatched event enforces neither, so a test built
  from them passes while every pack drop is dead. `scripts/drag-check.mjs`
  drives the real mouse; run it after touching a drag handler.
- **THE MIDDLE OF A PACK CARD WAS A ROUND SQUARE — the cause was WRAPPING.**
  `drag-check.mjs` drags from the CENTRE of `.pack-card`, and
  `elementFromPoint()` there returned `button.lb-rd`: it lifted ONE ROUND and
  asserted a pack had burst, so it called a working bar broken. Four 28px
  ticks with 4px gaps are 124px in 114px of inner width and wrap to a row
  whose top edge is y=67 against a centre of y=73. **ONE ROW, NEVER WRAPPING**
  — bottom-anchoring two rows reaches y=70 against 73, which is not a fix. So
  **24px on the SHELF card only**; the 28px rule is the Tonight tile's, where
  a tick is a SWITCH, and is untouched. Verified by clicking every card's
  centre at five widths — 45/45.
- **A TEST THAT NEVER RUNS THE ARTEFACT PROVES NOTHING ABOUT IT.** Reading
  `server.js` as a string to check a route exists is how a broken Launch reached
  the live app, 1,150 tests green.
- **A GREP WITH THE COMMENTS LEFT IN GOES GREEN THE BETTER A FILE IS
  DOCUMENTED.** Deleting the `/api/past-gigs` gate and leaving a comment saying
  `FEATURES.PAST_GIGS` kept `gates.test.js` 22/22. Every such search goes
  through `withoutComments()` now, and the claims that matter are FIRED too.
- **EVERY GUARD AND EVERY TEST THAT SPAWNS THE APP GOES THROUGH THE HELPERS —
  `scripts/helpers/live-app.mjs`, `test/helpers/live-server.mjs`.** A guessed
  port fails to bind SILENTLY, so every measurement is then about somebody
  else's process — and a fixed one made the suite flaky, a different file each
  run, all passing alone. `unref()` is why four guards could exit at all.
  `live-server.mjs` seeds the accounts book BEFORE the spawn — `Accounts`
  reads it once.
- **A CONTROL THAT REPORTS SUCCESS IT DID NOT HAVE is this repo's commonest
  fault, and `console-controls.mjs` presses one.** Five at once, all green
  under every other guard — including a rename that DELETED the night. **It
  makes its own accounts rather than driving the host key.**
- **AND 94 UNIT TESTS ACROSS THE FIVE LOBBY GAMES HAD NEVER DRAWN A PIXEL** —
  `lobby-games-play.mjs`. **PAINTED AND MOVING ARE TWO QUESTIONS and a canvas
  answers neither by existing**: sample the pixels twice with input between,
  or a blank canvas and a FROZEN one look identical. **Reach each game by
  SWITCHING to it**, the path that can leak a loop.
- **NOTHING HERE PRESSED A CONTROL, and a dead one draws perfectly.** A gap
  dial died twice in a week — a lost `import`, then a moved body calling the
  bar's `paintOrder()` from a module without one. Both a `ReferenceError` on
  the PRESS, eaten by the click handler's catch. **`drag-check.mjs` presses the
  dial TWICE** — once proves the handler runs, twice proves it steps — and
  `imports-present.test.js` forbids any module but the bar naming a `paint*`.
  **A general "every call resolves" test was thrown away**: it cannot see
  destructured callbacks, so it found sixty falsehoods and one truth.
- **IMPORTING FROM A PAGE'S OWN MODULE RUNS THAT PAGE'S OWN BOOT CODE.**
  `console-packs.js` importing helpers from `editor.js` ran its top-level
  `#quizPick` listener on `/console`, where it does not exist — the console
  hung on "Loading your library…" for every account, and `node --check` saw
  nothing. Shared code belongs in `client.js`, which has no page of its own.

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
