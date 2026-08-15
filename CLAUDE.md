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

**And the reasoning behind everything here is in `docs/`** — see *Where the
reasoning lives* below. Open the one you are touching; do not read them all.

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
free.** Proposed, reasonably: *"every entity has one parent and one child, and
you add extra children — because even a solo quizmaster wants stats. Head
office wants stats across five children, a solo wants his own."*

**The goal is right and it should be one mechanism.** What does not follow is a
second ACCOUNT per person. A solo quizmaster wanting headcounts needs a PAGE,
and they already have one: Past gigs is their own history on their own account.
Giving them a parent as well means a second login or a hat switch for one
person, a bill question about an account that buys nothing, and an entity
invented at every sign-up whose only job is to look at its owner's own data.

So put the generalisation in the QUERY, where it costs nothing:

> **One function takes a SET of accounts and returns the nights across them. A
> solo's set is themselves; a parent's set is its children.** Same code, same
> page, N of one or N of five.

That is the uniformity being asked for, and it arrives without a phantom
account. Build the aggregation that way FROM THE START — the real risk here is
shipping "past gigs for one person" and later "stats across venues" as two
features that then drift.

**What a parent-for-everybody would actually cost, concretely:** the owner's
People tab doubles in length with empty parents nobody signed up for, and every
one of them raises a question with no good answer — what tier is it, does it
have a login, does it count in "4 accounts · 3 paying", what happens when the
quizmaster cancels. None of those questions exist if the stats are a view.

**AND THEREFORE THE HAT DOES NOT BECOME UNIVERSAL.** Asked directly, and the
answer is no. **A hat switches between IDENTITIES, not between pages** — if the
stats are a view, a solo quizmaster has one identity with an extra tab on it,
and a switch offering nothing on the other side is the fault this file keeps
recording. It would also break the host's own hard rule that the switch must
never appear on anybody else's account.

A hat is right when one login genuinely holds TWO identities with different
powers and different rooms. That is:

- **the owner**, who is the app owner and a quizmaster — built, and the reason
  the switch exists;
- **a quiz company's playing manager**, who manages the company and also hosts
  on Fridays. Two identities, so the same mechanism, unchanged.

And nobody else: not a solo quizmaster, not a pub group's head office that
never hosts, not a venue running its own night. **One identity, no switch.**

**"ON THEIR OWN" IS A CASE, NOT A GROUP OF ONE, and getting that wrong is
expensive.** A solo quizmaster is not a child of anything — Rob with no company
has no parent and needs none. If the model requires a group, then every
subscriber needs one invented for them at sign-up, every query goes through a
join that is pointless for almost every account, and a concept that serves a
handful of companies is paid for by everybody. **`parentId` is simply absent on
an ordinary account**, exactly as `kind` defaults and `teams` is empty — the
same rule this file follows everywhere: the common case costs nothing.

**A PARENT MANAGES; A CHILD RUNS.** That is the host's "parent is the stats and
the data, the child actually runs the quiz", and it is right as the common
case — HQ reads numbers, venues run nights.

**But it is a tendency rather than a rule, and building it as a rule would be
wrong.** A small quiz company's manager hosts on Fridays; a landlord runs their
own quiz on the weeks nobody is booked. **A person who does both has two hats,
which is a thing this app already has** — `hatSwitch()`, one login, no second
password. So a parent MAY run nights; it simply usually does not. Do not model
"parent" as "cannot run a quiz", or the first company that promotes a host
breaks.

Two smaller notes, both worth having before anybody builds this:

- **A child has exactly one parent.** A venue in two pub groups, or a
  quizmaster employed by two companies, is a real thing in the world and a mess
  in the data — resolve it as one parent plus an ordinary marketplace booking
  for the second, which the attribution model already covers.
- **Nesting is not needed and should not be built** until somebody asks. A pub
  group with regions is a parent of parents; it is a fair thing to want and it
  doubles every scoping question, so it waits for a customer rather than an
  imagination.

## The words: a quiz is a product, a round is part of one

Settled deliberately, because the two were used interchangeably for months and
it stopped being harmless the moment packs became something to sell.

| | The whole product | A part of it |
|---|---|---|
| **Music quiz** | a **quiz** — a night's worth, several rounds of questions | a **round** — ten general knowledge questions, *or* five pictures. All one type |
| **Music bingo** | a **bingo game** — one theme, forty-odd tracks, the cards built from them | a **round** — `newRound()`, fresh cards to everybody, played until the last prize goes |

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

| Decision | Why |
|---|---|
| **No dependencies at all** | Every dependency is something that can break on a gig night. QR encoding is written out in `src/qrcode.js` rather than installed. |
| **SSE, not websockets** | Ordinary HTTP survives pub wifi, mobile data and venue proxies; browsers reconnect on their own. |
| **No build step** | Plain HTML/CSS/JS. Mark comes back to change this between gigs. |
| **Packs are JSON files** | That is what makes a quiz reusable months later and the editor simple. No database. |
| **No profanity filter on team names** | Explicitly requested. Rude names go on the projector as typed. Only control characters stripped, 28-char cap, HTML escaped — that is anti-breakage, not censorship. **Do not add word filtering.** |
| **Photo uploads auto-publish** | Host decided; he will handle the room with the mic. There is a kill switch and a per-photo bin in `src/photos.js` and **no approve step anywhere**. Do not add one. |
| **Photos go in a SEPARATE PRIVATE repo** | `PHOTO_REPO`, filed as `photos/<night>/<file>` as they arrive. Never the main repo: it is public (checked), and git history is forever. `src/github.js` takes a `which` argument for this. |
| **Filters are pixel maths, not `ctx.filter`** | `public/assets/filters.js`. Older iOS does not implement `ctx.filter`, and a filter that silently does nothing on a third of the room is worse than none. The preview and the upload go through the same function so they cannot drift. |
| **"Filters" means PROPS, and the colour grading is GONE** | `public/assets/stickers.js` — sixty-odd of them now, drawn like the seasonal motifs and for the same reason. The host asked for "clown noses, dog ears etc." and found colour grading, which is what `filters.js` does; that was folded away behind "Change the colour instead" and is now **deleted from the panel entirely** — *"I want funny props to be the focus"*. `drawFiltered(…, 'none')` stays as the DRAW path, because it is the one place the sizing is worked out and the preview and the upload go through it so they cannot drift. **No face detection anywhere**: a model is megabytes on a stranger's phone over pub wifi and `FaceDetector` does not exist on iOS Safari — both break *no dependencies* and both fail on somebody's handset in a room. **A prop is dragged off its tile after a short HOLD** (`HOLD_MS`, 200ms), not immediately: dragging straight away was asked for and built, and it took the SCROLL with it — the tray is three dozen tiles, so almost everything under the thumb was a tile and there was nothing left to scroll the sheet with. `touch-action: pan-y` keeps vertical scrolling; a flick scrolls, a hold lifts, a tap centres. Move/up listen on the WINDOW so one gesture crosses two elements. **Double-tap a prop to delete it** (`DOUBLE_TAP_MS`), and **the bin is gone** — it lived bottom right, which the square 1:1 crop turned into a corner people want to put things in, and it only ever removed what was in the air. Undo still takes off the last one added; it used to say "Take it off", which was a lie the moment there were two. **THERE IS EXACTLY ONE UNDO AND IT IS IN THE "STICK SOMETHING ON" HEADING.** There were two — a second in the seasonal row — and that meant `sheet.querySelector('.cam-undo')` wired the seasonal one, which sits in a container that is `hidden` on an ordinary night. So the only working Undo lived inside a hidden box and the visible one was never unhidden: **there was no Undo at all on a normal night**, on the feature the props exist for, and nothing threw. Identical to the fault the `.cam-props:not(.cam-props-season)` selector already records — the seasonal row carries the same classes as the main one *because it wants the same layout*, so a bare selector matches the wrong one. **If a seasonal twin is ever added again, `querySelector` in this file is where it breaks.** Undo takes off the last prop whichever tray it came from, so there was only ever one job. Positions are stored as a **fraction** of the canvas, never pixels. Tiles are mid-grey on a GRADIENT (half the props are nearly black, and a flat tile can be matched exactly by a flat prop — the viking helmet vanished into it) and **named as well as drawn** — unlike the colour looks, which were shown rather than named because a name told you nothing; at 50px a monobrow and a moustache are the same dark smear. **Send it up sits under the PHOTO**, above the tray: last on the sheet it meant scrolling back past three dozen tiles to send, which is the same fault that put the gesture hint above the tray rather than below it. That hint is a 2×2 block of four CHIPS rather than a sentence, so it cannot break "pinch to size and turn" in half — equal columns and equal rows, because sized to their own content the chips came out four different widths and read as four objects rather than one block. It carries its own font size too: `.tiny` has never had one on the phone, so it was coming out as big as the question text. **The heading and the chips are ONE CARD** (`.cam-guide`) — apart, the heading was a fifth loose object floating above them. It is a **HAIRLINE of the app's own red-into-orange and nothing inside it**, and the distinction between a line and a fill is the whole decision. A filled slab of that gradient was tried and is wrong for the reason Buy in the shop is not that colour: it is the app's one "press this", Send it up is directly above, and a second block of it doing nothing when pressed costs the real button its meaning. One pixel of it draws the boundary and leaves the weight to the button. `--hot`/`--hot-2` rather than a colour written out, so it follows the quizmaster's own scheme and every seasonal look — the same reason a hardcoded gold would have been wrong. A gradient cannot go in `border-color`, so it is a gradient box with its middle masked out, **behind an `@supports`**: without mask compositing that pseudo-element paints as a solid gradient slab, which is precisely the thing it must not be, so a plain hairline is the default and the gradient is added only where it can be drawn as a ring. **All five texts run that same gradient**, painted with `background-clip: text` — and the four chips take a QUADRANT of it each (`background-size: 200% 200%`, a corner apiece) so the block reads as one sweep across the card rather than four small rainbows repeating the same two colours. That `@supports` guard is not optional either: gradient text means transparent text, so a browser without it would draw five INVISIBLE labels. It also forced the chip's own fill and border onto a pseudo-element, because `background-clip: text` clips EVERY background on the element and the chip would otherwise be cut to the shape of its own words. **The heading fills the card**, justified out to both edges with wider tracking — at the ordinary tracking justification opened two great holes in the middle and it read as three headings. Two columns rather than the centred three, so the heading takes whatever Undo is not using; absolute positioning was tried and collided at 320px once the row lost the card's padding. The SEASONAL row above stays centred and gold: its name is one short word, and justifying it prints H A L L O W E E N. |
| **THE PHOTO CAN BE MIRRORED, and it is a BUTTON rather than a detection** | `flip` on `drawFiltered()` and the **Flip** control on the photo sheet. iOS mirrors the live preview while somebody frames a selfie and then saves the picture the other way round — so what arrives is flipped relative to what they were looking at, which is what the host reported. A photo comes in through a plain file input, so the phone's own camera app takes it and we are never told which lens was used. There is no reliable way to find out, and guessing wrong would mirror a picture that was already right. So it is one control: same reasoning as dragging the props by hand rather than face-detecting, and it fixes the other case too — a back camera pointed at a mirror, which is how half the group photos in a pub get taken. **It lives INSIDE `drawFiltered` because the preview draws at 900 and the upload draws again at 1080 from the same source**, and that function exists so the two cannot drift; a flip applied at one call site is a photo that looks right on the phone and wrong six feet wide. Checked by sending a deliberately lopsided picture through the whole path and reading the pixels of the file the PROJECTOR receives, not just the preview. **The props are not mirrored with it**, deliberately: they are drawn on afterwards in canvas coordinates, so flipping them would move a nose to the other cheek — and the three band shirts have words on them, which a mirror would print backwards. |
| **THE PHONE MUST NOT SAY "look up" WHILE A QUESTION IS ON** | `PHOTO_PHASES` in `screen.js` — the projector only carries photos in the lobby, at a round board and at the end, because twenty seconds and four options wants the whole screen (the same reason the join code is never drawn over a question). A photo sent mid-round is kept and gets its full moment at the next break. **The phone said "It is on the screen — have a look up" regardless**, which is a flat lie told to somebody staring at a question, and the sheet's own warning said "It goes straight up" — which meant *no approval step* and reads as *immediately*. Both now say which it is: **"Sent — it goes up on the big screen at the next break"** when the projector cannot show it yet. `PHOTO_PHASES_PHONE` is written out in `play.js` rather than imported, because the two files share nothing else and a phone guessing differently from the big screen would promise the room something it cannot see. **Flip lives under the PHOTO, not in the props heading** — it was next to Undo, which reads as a corner it was pushed into, because the two do different jobs to different things: Undo takes a prop off, Flip mirrors the picture underneath them. Not overlaid on the photo either, tempting as that is: the canvas carries the drag handlers and a button on it would swallow the gesture. |
| **A VENUE'S LOGO GOES ON THE WINNER'S VOUCHER, and nowhere else** | `logo` on the venue record, `state.venueLogo`, `view.voucher.logo`, `.win-logo`. Proposed as *"an image render"* for prizes, and the half worth building is the venue's own mark rather than a picture per prize: a voucher is a credential **a stranger behind the bar has to decide whether to honour**, and until now it was a code and some words in the quiz app's colours. The pub's mark at the top is what makes it read as something the pub issued. A picture PER PRIZE was the other half and was left: three per venue to maintain, and most prizes are "a £30 bar tab" — a photograph of which is a photograph of nothing. Wait for a venue to ask. **THE WORDS STAY THE PRIZE.** `reward` is directly underneath in text, so a logo that never loads, was never set, or is on a phone with no signal costs nothing at the bar — and `onerror` removes it rather than leaving a broken-image icon on the one screen somebody is holding up to be served. **Never an image with the prize written inside it.** **It is NOT on the projector, and that is about BYTES rather than secrecy**: a logo in the screen payload rides in every state push, which at a lobby is every time somebody joins — sixty joins is sixty copies over pub wifi, on the one connection that must not stutter. There is a test that no `base64` reaches `screenView()`. If the big screen ever wants it, it wants a URL it can cache. **Stored as a data URL on the venue record, shrunk to 128px IN THE BROWSER** before it is sent (`shrinkLogo`, the same canvas approach `filters.js` uses for photos) — which is what lets it need no upload endpoint, no file store and no new backup path, and is only affordable because it is small. A 900px wordmark comes out at 3KB. PNG rather than JPEG: a logo is flat colour with hard edges, and transparency has to survive. **Data URLs only — a remote URL is refused**, because a logo on the venue's own server is a 404 on the one night it matters, with the winner stood at the bar. **Too big is DROPPED, never thrown**: losing decoration costs nothing, where failing the save would cost somebody the prizes they were editing. **ONE COPY, on the state rather than on each voucher** — three prizes plus a draw would otherwise carry four copies of the same base64 into the archive for ever. It saves on picking the file rather than waiting for **Save it**, because choosing a file is a finished act and a second button for it only exists to be forgotten. |
| **The room is told what it is playing for** | `view.rewards` at the LOBBY and the rules slide, `.lobby-prize` in `style.css`. The prize is why half the room bothers, and it was said once on the mic and then not seen again until the winner's phone lit up. It is not secret — the host announces it — so it belongs on the screen everybody is looking at while they settle down. **The WORDS only: the voucher code is the credential** and goes to one phone, exactly like the draw's, because this payload is public to anybody holding the join code. Not on a question, ever: a standing advert for the prize under a question is two things on one projector. |
| **SECOND AND THIRD ARE A PODIUM, not a caption** | `.winner .runners` in `style.css`, `renderWinner()` in `screen.js`. They were one dim 2.6vh line reading *"2. Norfolk & Chance — 2,870"*, which from the back of a pub is unreadable — so the only result the room could actually see was first place, and everybody who came second went unnamed. **Being on the podium is most of what a quiz night gives the people who did not win it**, which is the whole reason this is worth pixels. Named cards now, 4vh, with the position in a medal-tinted pill. **Gold stays first place's alone** — it is the trophy colour everywhere in this app and the winner's own name already runs the account gradient — so silver and bronze are what tell 2nd from 3rd, which is the one place a metal genuinely carries the meaning rather than decorating. **SECOND AND THIRD SHARE THE ROW, HALF EACH** (14 August 2026), at the host's own reading: they were three equal cards in a line — 2nd, 3rd and 4th, all the same size — so the podium read as three also-rans of one weight and coming second looked like coming fourth. Given the width between them they go to 5.4vh and are readable from the back; the winner is untouched at 13vh and stays alone, because that is the result the night is about. `grid-auto-flow: column` rather than a fixed pair, so a TIE for second gets three equal cells instead of one dropping onto a line of its own. **A fourth is a LINE, not a card**: it is context rather than a placing, and dressing it like one is exactly what cost second and third their meaning. **`overflow-wrap: anywhere` on the winner and on both podium names**, because a team name has no spaces in it if somebody decides it does not — there is deliberately no filtering and the 28-character cap is the only limit, so a solid 28-character name ran out of its card and across the one beside it. Found by rendering the widest legal name rather than a plausible one. |
| **A BIG PHOTO NEVER DIMS THE JOIN CODE** | `.join-corner { z-index: 4 }` and `.photo-big.beside-join`. Reported from a real night — *"it covers the QR code on the right and that prevents people joining"*. `.photo-big` is a full-stage scrim at `z-index: 3` and the join corner had no z-index at all, so for the four and a half seconds a photo was up the whole card went grey and the QR went grey-on-grey: **not merely ugly, unscannable**, on the one control that lets somebody into the game. It is the ROUND BOARD that collides, and only that — the one phase in `PHOTO_PHASES` that is not in `NO_JOIN_CORNER` — which is also exactly where a latecomer is looking for the code. Two halves, and both are wanted: the corner sits ABOVE the photo so it can never be dimmed whatever else changes, and the photo centres in the space BESIDE it (`padding-right` on the grid, so it is properly centred in what is left rather than nudged off the middle). The class is set in JS rather than with `:has()`, which is one more thing a projector's browser has to be new enough for. It is also **kept in step as the phase changes**: a photo lasts four and a half seconds and a round board arriving puts the code up under it, so `paintJoinCorner()` toggles the class on any photo already on screen — set once when the photo went up, a picture would sit shifted with nothing beside it, or slide back under a code that had just appeared. |
| **A photo gets the MIDDLE of the screen, not a thumbnail** | `showBigPhoto()` in `screen.js` — a POLAROID: white all round, a deep lip at the bottom with the name written in it, and tilted. It fades in and away over about four and a half seconds, then joins the strip (18vh now, not 13). **The tilt never lands near straight**: a plain `random() * 12 - 6` gives half a degree often enough, and half a degree does not read as scrapbook, it reads as a projector nobody levelled. A side is picked and the angle is 2.5° to 7° off it — always obviously deliberate, never far enough to cost the picture height on the one screen where filling the height is the point. Every keyframe has to carry `--tilt` or the photo snaps square halfway through the animation. One at a time and queued: three people sending at once is three moments in a row, not three pictures fighting. **The first paint of a page shows none of them.** A projector opened an hour in, or reconnecting after the laptop slept, would otherwise replay the whole night one picture at a time — two minutes of slideshow over whatever the quiz was doing. `seenPhotos` is keyed by id rather than "the strip has not got one", because the strip is torn down whenever the phase has no room for it and a photo does not become new again because the scoreboard went up and came down. |
| **Speed scoring is FLAT — 10 points a second, and it stays that way** | Offered a curve where the early seconds are worth disproportionately more (a squared ramp: 1s→180, 10s→50, 15s→12). The host turned it down — *"10 points per second is actually fine, simplicity wins here"*. He is right, and there is a second reason to leave it: the rules slide is generated from the scoring constants and currently prints a number the room can hold you to. Under a curve there is no per-second number, only "up to 200, the quicker the more" — vaguer, on the one slide that is up while the room is filling. **Do not re-propose this.** |
| **The phone shows the answers as the projector does** | Same 2×2 (or 2×3) arrangement, same letters, same colours. A player looks up, decides "the pink one, bottom left", and looks down — so the phone has to be the same picture or they re-read four options against a clock. It was a single column, which made the two screens different arrangements of the same four answers. The letter sits ABOVE the text on the phone: beside it costs 42 of the ~140 pixels a half-width cell has on a 320px phone, which was enough to break "Christmas" across two lines mid-word. |
| **…except the alphabet round, which is 5 across on the phone and 9 on the projector** | The row above is about options with WORDS on them, where a player is matching a position they picked out from the back of the room. A letter needs no matching — you already know you want F. What the phone has instead is a thumb problem: nine keys across a 320px phone is 28 pixels each. Same order, different number of columns, and A to Z rather than QWERTY because QWERTY is muscle memory for typing words and nobody is typing a word. |
| **An alphabet answer may never begin with "The", "A" or "An"** | "The Beatles" is B to half a room and T to the other half, and both halves are right — the exact argument the house style exists to prevent. It is a hard validation error, said in the editor as you type, forbidden in the generator's brief and listed as a rejection reason for the checking pass. **Do not soften it to a warning.** |
| **The picture round's effects all run on one curve** | Zoom, pixelate, blur and tiles are four looks, not four difficulties. You score more the earlier you answer, so the reveal curve IS how many points a question is worth — a mode with a curve of its own makes that round quietly worth more or less than the rest, and nobody would ever blame the animation. Pixelate needs a GEOMETRIC resolution ramp to sit on that curve; linear made it a giveaway. |
| **A seasonal look is a palette and some shapes, never a change to the game** | Skulls for Halloween, hearts for Valentine's. The rounds, the scoring and the timings are identical — so a themed night cannot play differently from a normal one, and there is nothing extra to test before a gig. |
| **Anything that deletes shows a bin** | `binIcon()` in `client.js`, drawn rather than an emoji (every phone draws the emoji one differently, and some of them as a cheerful basket). The host's photo grid used to delete a picture when you tapped it, with nothing on screen saying so. |
| **No Instagram follow-for-points** | No API can verify a follow. Told the host; he agreed to drop it rather than fake it. |
| **British spelling and UK chart references** | Crowds are Essex, Kent and Surrey. This is in the generation prompts too. |
| **Deploying on Render** | Chosen by the host. Serverless (Vercel/Netlify) is wrong — the app holds a live connection to every phone all night. |
| **Alphabetical bingo call sheet** | Not play order — on the big screen AND on the host's own sheet. Half the room is drinking and scanning for "have they done Africa yet?", and so is the host, with a record running. |
| **The call sheet is a grid, not a list** | Forty tracks one per row is three screenfuls with the middle of every row empty. `.trackgrid` wraps to fit — seven across a laptop, two across a phone — and the host page widens to 1280px for bingo only (`body.host.bingo`). Called tracks stay put and go green; a sheet that reorders itself under your thumb mid-gig is how you tap the wrong song. |
| **The chosen shape lives in the GAME STATE** | `freshState()` copies it in. It lived only on the in-memory pack for one afternoon, and a `SIGKILL` mid-round brought the game back as whatever the file said — 24 squares on every phone, a 4×4's idea of a line on the server, and a player handed a win they had not got. The state is the record of the night; the pack is only the default it started from. Tested. |
| **The card shape is chosen at LAUNCH, not stored on the pack** | The same forty-two songs are a quick game on a 3×3 and a long one on a strip, and which you want depends on how much of the evening is left — a decision about tonight, not about the pack. `session.launch(kind, id, { shape })` overrides the pack's own shape for that game and never writes it back. The picker is on the pack card next to Launch, and only offers shapes the track list can fill. |
| **How many prizes is chosen at launch too** | Next to the card shape, and for the same reason — it is a decision about tonight. `state.stages` is the list, `[1, 'full']` by default, which is exactly what every round did before. Three prizes is `[1, 2, 'full']`: traditional pub bingo, counting up and ending in a full house. Predictable beats clever — the room already knows how bingo works and the host has to say it on the mic. Only offered as many as the card has lines for: a 3-across strip has three lines and finishing all three IS a full house, so two line prizes is its limit. |
| **"You got it" means the prize ON THE TABLE** | With three prizes the first winner keeps playing, and `view.won` used to stay true for the rest of the round — so the one person who had proved they were paying attention was the only one who could no longer see how close they were. It is now "won the prize currently being shown", and `yourPrizes` keeps a note of what they have already taken. |
| **A strip wins the long way only** | `cardLines()` in `src/bingo.js`. A card can be 3 across and 8 down — the shape of a paper bingo ticket and of a phone. Every winning line must be the SAME LENGTH or the game is not fair: on a strip somebody would call on a row of three while everyone else needed eight. So a square keeps rows, columns and both diagonals; anything else uses the long axis only, and the phone says which way it runs ("Get a full column — 8 down") because a player looking at three across will otherwise mark the three and shout. There are tests for all of it. |
| **Launch is the last thing on a pack card, and full width** | Read / Rename / Delete sit in a row above it, sharing ONE rule rather than four near-identical ones that had already drifted on size. Launch is the biggest thing on the card and nothing sits under it, so it cannot be hit on the way to something else. **That row is a GRID, not a wrapping flex row** — it was `flex: 1 1 auto`, which is fine on the three most cards carry and wrong the moment a fourth appears: on a pack with an intro round, Playlist pushed Delete onto a line of its own, where being the only item stretched it full width. The destructive button became the biggest target on the card, directly above Launch — the exact thing this rule exists to prevent. `repeat(auto-fit, minmax(84px, 1fr))` wraps a fourth button into the next cell at the same size as the rest. |
| **The tab icon and the logo are one drawing** | `public/assets/brandmark.js`, imported by `client.js` in the browser AND by `server.js` for `/favicon.svg`. Two copies of a logo is one that gets changed in one place and not the other and goes unnoticed for a month. SVG rather than `.ico` because there is no build step to make one; a browser too old for SVG favicons just shows its default, as it did before. The tab version has thicker strokes — at 16px a 1.6-wide stroke on a 40 viewBox is two thirds of a pixel and turns to mush. There are tests that the two agree. |
| **A QUESTION MARK INSIDE A MICROPHONE** | `quizMark()`. It was a vinyl record, then a mic-and-note in a disc, and neither said what the app is: this runs general knowledge, first-letter, picture and bingo rounds as well as music, and every one of them is a QUESTION. The mic is the host. Three things were arrived at by getting them wrong first. **The question mark's tail sweeps INWARD to a stem centred under the hook** — the first version dropped it straight down off the arc, which reads as a hook with a leg rather than a "?". **The head needs a COLLAR**: a capsule floating above an arc reads as an egg in a bowl, and the short neck joining head to cradle is the one detail that makes the eye see a microphone. **The question FILLS the head rather than sitting in it** — when the mic was big and the glyph small, the question was the first thing to vanish as it shrank, which is backwards, because it is the half that says what the app does. |
| **The sound arcs are built but OFF** | `waves` in `quizMark()`. Two arcs coming off the side, and they genuinely look better — at 64px and up. **The app never draws this mark above 30px**: 22 on a phone, 26 on the projector and the owner page, 30 on the console and login, 16 in the tab. At those sizes the arcs stop being character and become fuzz round the edge. So they are one word away for a flyer, a poster or a social avatar, and off everywhere the app itself draws. Checked by rendering at every size the code actually asks for rather than at the size it was designed at. |
| **The name stacks — the possessive above, the app underlining it** | `brandWords()` in `client.js`. "Mark's" small and tilted 5° above **Quizporium** in the account's own gradient, so the app name reads as the thing and whose night it is reads as the label on it. **It splits on the APP NAME, never on the last word** — so `BRAND_NAME="The Crown Quiz League"` stays one line instead of being guessed at and broken in the wrong place. A name that does not end in the app name is not stacked at all. **The possessive went up 20% (0.58em to 0.70em) on 14 August 2026**, at the host's own reading: it is the half a quizmaster is actually selling — the app name is the product, their name is the act — and at 0.58 it read as a superscript on somebody else's brand. Still clearly the smaller of the two, because the stack only works while one of them is the label. The projector's own override moved with it. |
| **One type ladder, ten steps, named for the JOB** | `--fs-tag` (11) through `--fs-title` (22) in `:root`. Every font size on a PAGE comes from one of them. It was twenty-eight different numbers, six of them halves — 12.5 beside 13, 13.5 beside 14, 11.5 beside 11 — which is not a scale, it is the same decision taken separately twenty-eight times. **The tell was the On/Off switch**: the one in the top right was 11px and the identical one on every feature row was 11.5px, on two controls this file already says are meant to be the same shape *so they are recognised rather than read*. Snapping the strays moved 23 declarations, none by more than 2px. **Two things are deliberately NOT on the ladder and folding them in would be a bug.** The **bingo cell ramp** (`.bingo-cell .bt`/`.ba` down through cols-3, 4 and 5) — those halves are tuned so 25 squares still fit a 320px phone with the words readable, and a square you cannot read is somebody missing a full house; `.cam-prop-name` is the same, it has to fit a 66px tile. And the **projector**, which is sized in `vh` throughout: a big screen's type has to grow with the screen, and pinning it to pixels would make the question small in a hall and huge on a laptop. Above 22px the sizes are display type — a result, a room code, a countdown — one per surface and written out. Verified by screenshotting every page before and after: the projector and the editor came out pixel-identical. |
| **ONE MENU, built in one place, on every page a quizmaster drives** | `navMenu()` in `client.js` — **Console · Control · Packs**, on the console, the control view, the editor and the owner page, and **identical for every account including the owner's**. **The projector and the join page were on it and came OFF**, at the host's own reading and he is right: the big screen is opened once for a specific night and belongs on the running panel where the night is, and the join page is for CUSTOMERS with a QR code — a quizmaster has no reason to go there at all. **THE WHOLE TOPBAR IS THE SAME ON EVERY PAGE**, at the host's own instruction —
menu on the left, hat switch and Sign out on the right, drawn by `paintNav()`
and `paintIdentity()` in `client.js`. Both were written once inside
`console.js`, so the console had them and the control view, the editor and the
owner page each had some subset of neither: *"the top section changes every
time all over the place"*. Three separate causes, all fixed: the OWNER held no
quiz features so Control vanished and the row shuffled left (it is always
there now, and **changes hat on the way through** — the mirror of Owner doing
it in the other direction, because an owner pressing Control has a control
view, it is just behind the hat); the control view's bar sat in a centred
720px column while every other page's was full width; and the logo was drawn
three different ways. The control view's own **yellow "wearing your quizmaster
hat" bar is GONE** — it was an indicator beside a switch that was somewhere
else, and now the switch is there too it would be a second way to do one job.
Measured on every page and both hats: logo at the same pixel, menu at the same
pixel, same four doors in the same order. **A real quizmaster gets the same
menu and NO hat switch**, checked signed in as one.

**The menu sits BESIDE the hat switch and replaces none of it** — Owner | Quizmaster | All · B · S · G stays exactly where it was, in the top right, and is still the one control in every state. Checked at every width from 390 to 1440 that adding the menu does not push it off the edge. **And there are THREE ways to be the owner, only the first obvious**: `role`, `alsoSignedIn` (the host key, where the server answers as the bootstrap identity), and **`actingAs` — the owner WEARING the quizmaster hat**, which is the one that went missing. The whole point of the hat is that your role becomes quizmaster, so a check on `role` alone hides the way back on exactly the account that needs it. **THE MENU'S OWN OWNER CHIP IS GONE**, at the host's reading of his own console: *"only my account has two owner links now — defunct. The other QMs don't need any owner links, so I'll keep the top right one and lose the menu one."* He is right, and it is the rule this file keeps recording — two controls with the same word on them means using the worse one out of habit. The switch keeps it because it is the SIGN as well as the switch: it says which hat is ON, which a chip in a row of pages cannot. So the menu no longer depends at all on who is reading it, which is what "the same menu for every quizmaster" was always meant to mean. **The hat switch's Owner half now GOES to `/owner`** rather than taking the hat off in place — it has to, because it is the only route to that page left. Quizmaster still leaves you where you are, and the asymmetry is honest: the quizmaster side is three pages with no single home, the owner side is exactly one. That behaviour was already written out on the control view alone as an `onSwitch`; it is the default everywhere now, so there is one copy of it. `menuRights()` still reports `owner` and `acting`, because **Control** uses them to know whether to put the hat ON on the way through. Nothing lights in the menu on the owner page, and that is right rather than a miss: the menu carries the three quizmaster pages and `/owner` is not one of them. **Every page asks `menuRights()` rather than deciding for itself**, and that is what stopped the chips jumping: the console read its own feature list, the editor guessed from whether it held the catalogue and the control view simply assumed, so one account got a different row on every page. The order never changes either, so a chip does not move when the item beside it is missing. On the control view the row is `flex-start` and not `space-between` — pushed right, the menu sat somewhere different from every other page, which is the exact complaint a menu exists to answer. And the editor's menu is `flex: 0 0 auto`: as a shrinkable item among that page's own six controls it was squeezed to nothing and simply was not there. It lives in `client.js` rather than on any one page for the same reason `plans.js` and `looks.js` do: four copies of a menu is four menus that disagree within a month. Each page passes only what it can honestly know about itself; the order and the labels are decided once. **The page you are on is LIT rather than dropped** — inverted, filled in `var(--gold)` so it follows every seasonal look and the quizmaster's own scheme — because a menu with a hole where you are standing makes you count the items to work out where that is. Gold and not the hot gradient: that gradient means "press this", and the page you are already on is the one thing in the row there is no point pressing. **The projector and a player's phone deliberately have none.** One is pointed at a room and the other belongs to somebody in it; neither has any business carrying a door into the quizmaster's console. **The key is passed IN, never read inside `navMenu`** — a menu that quietly appended a remembered key would put it back in the address bar on every page at once, which is the thing that was just taken out. |
| **ON THE BARE HOST KEY THE TOPBAR SAYS WHICH ROOM YOU ARE IN** | `.mode-chip`, drawn by `paintIdentity()` only when `hatSwitch()` returned nothing and `who.bootstrap` is true. The switch is the SIGN as well as the switch — but on the bare key it draws nothing, and Sign out is hidden too, so the topbar went silent on the one identity that looks least like the others. The host lost ten minutes to exactly that: *"where's my hat selector?"*, on a console that was working perfectly and was simply somewhere else. **It names the ROOM, not the credential** — "Host key · the house room" — because the room is the half that decides whether the people in front of you can join: the house room is the plain `/play` one with no code. On a phone it drops to just "the house room", the same shape as the hat switch's own narrow rule: lose the padding, then lose the least useful words. **Not on the owner page as well**, at the host's own narrowing — the switch already says "Owner" there, and a chip repeating it is the two-controls-one-word fault this file keeps recording. It also found a real layout bug it did not cause: the phone media query's `.topnav { order: 9; flex: 1 1 100% }` was **unscoped**, so it reached the control view — whose bar is deliberately `nowrap` with a scrolling rule of its own — and sent the menu past the hat slot to the far right, squeezed to a 60px sliver. The one page where the menu has to be beside the logo was the one where it was not, and it was invisible on the key only because the hat slot had been empty. Scoped to `.console` and `.editor`, which is what its own comment already described. |
| **The other screens live in the TOPBAR, and "Take control" stays where it is** | It replaced an **"Everything else"** panel at the bottom of My account — the right list in the wrong place, four taps and a scroll away on the tab you visit least, when you want it five minutes before a gig. **The way back from the control view existed all along and was invisible**: the logo has always linked to the console, with the reason in a `title` — and a `title` is a tooltip, on the one page only ever used on a phone. Same fault as "Control view" being a small grey link: the control existed and the label did not. **What the bar deliberately does NOT replace is "Take control" on the running panel.** That is not navigation — it only exists when a night is on, it is the primary button, and it is the thing the host reported missing twice for being small. A chip is "go there"; that button is "your night is running, take it". The bar is quiet on purpose for the same reason: the page's own loud things — Launch, Take control, Write it — have to stay the loudest. On a phone it takes a line of its own and SCROLLS sideways rather than wrapping, because the topbar is sticky and a bar that grew a row would eat the top of every tab all night. |
| **A REMEMBERED key never goes back into the address bar** | `linkTo()` in `console.js`, `withKey()` in `host.js`. `keyed()` appends the key to everything, which is right for an API call — the server has to be told who is asking — and wrong for a link, because a link puts it on screen, in browser history and over anybody's shoulder. So a page link carries the key **only if THIS visit arrived with one**; a key that was merely remembered from localStorage does not spread. Nothing is lost, because the console, the control view and the editor all read the remembered key on their way in — a `?key=` bookmark works exactly as it did. **It was self-sustaining, which is the part that made it worth fixing**: `load()` only forgets a remembered key when there is NOT one in the URL, so following a keyed link is precisely what stopped it being forgotten. Keyed on the URL rather than on "is anybody signed in", because **`/api/me` answers as the BOOTSTRAP identity when a key is in play** — so `me` is truthy on the key too and cannot tell the two apart. Checked in a browser both ways round. |
| **A grid or flex child's default minimum is its MIN-CONTENT** | Which is how one stubborn element drags a whole page sideways, and it had done in two places for months. On the control view `.host .wrap` is a grid and the Setup panel's pack dropdown sizes itself to its longest pack NAME — so on a 320px iPhone SE every panel came out 342px and the sticky bar 366px, putting the clock, the right-hand end of every answer row and the "..." that opens a player off the side of the host's own screen. On the console the generator's theme box would not go below its own placeholder and pushed **Write it** off the edge. `min-width: 0` on the children in both, and a `<select>` needs `max-width: 100%` as well because it will not go below its longest option on its own. **And a THIRD, found the day the mode chip went in: the editor's `.opt-row` held an option box with `flex: 1 1 auto` and no `min-width`, which dragged that page 313px off the side of a 320px phone** — so the one page for fixing a question was unusable on the device somebody would fix it from. Its options go to one column below 560px as well, because two boxes plus a tickbox each is about 150px a side. **Measure the page's `scrollWidth` against `clientWidth` at 320px after anything structural** — nothing else tells you, and on a phone it just reads as "the app is a bit broken". |
| **Native controls are told the page is dark** | `color-scheme: dark` on `:root`. Without it the browser draws tickboxes, radios, scrollbars and the open list of a dropdown for a white page, and they arrive as white slabs — the console's dropdowns were the loudest thing on a pack card, louder than Launch. A `<select>` also gets `appearance: none`, the page's own fill, and a drawn chevron on a gradient block so it reads as part of the app without competing with the button underneath it. |
| **A pack still says `cardSize`** | `cardShape()` reads `cardSize` OR `cardRows`/`cardCols`, so no pack on disk had to be rewritten and an older deploy still reads a newer pack. `shapeFields()` writes both when it is square. |
| **The card is sized from the list, not from a default** | A round of 42 is a 5x5 round. Import always said 4x4, so 42 songs quietly became sixteen squares — a line lands early and most of the round never reaches a card. The dropdown moves itself to the biggest card the pasted list carries and says so, and stops the moment you touch it. `cardSizes` comes from `minimumTracks()` over the library payload so the console keeps no copy of the sum. |
| **Card type scales with the grid** | `.bingo-grid.cols-5` in `style.css`. At the 4x4 sizes, a 5x5 cell clipped "Bootylicious" to "Bootyliciou" — a square you cannot read is a square you cannot mark, and that is somebody missing a full house. Four lines rather than three at 5x5: the words matter more than the tidiness of the grid. Checked down to a 320px iPhone SE, where all 25 now fit without scrolling. |
| **A generated pack keeps its playlist** | `pack.spotifyPlaylist`, surfaced by `listBingoPacks()` and shown as a green Playlist button on the pack card. The link used to appear once in the generator's log and then you had to go and find it in Spotify on the night. |

---

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

`diarySection()` in `console.js`, `.cal-wrap` / `.cal-side` in `style.css`.
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

### PRESSING A TAB PUTS THE TAB BAR AT THE TOP OF THE SCREEN

`showTabBar()` in `console.js`. Not `top: 0` — that puts **Tonight** back on
screen every time you change tab, so the thing you pressed for starts a section
and a half down. Every tab opens at its own first line and Tonight is exactly
one flick UP, in the same place on every tab. **Measured off the sticky topbar
rather than a written-out number**, because that bar wraps on a phone — and
measured after `render()`, since the bar is rebuilt on every one.

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

**The tab bar wraps rather than scrolling on a laptop** — a tab cut in half at
the edge with no scrollbar is a tab that does not exist — and is **sticky from
860px**, which is what removed the reserved `min-height` under short tabs.
`showTabBar()` **measures the tab BODY, not the bar**: a sticky element lies
about where it is. **`.game-head .row` is a flex row** with a gap, wrapping,
`align-items: stretch`. The account-coloured underline on ordinary buttons
stays.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

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
  card shape go — chosen under **Set it up**, written into `state.lobbyGame` at
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
- **THE BOARD IS ON THE PROJECTOR AT THE LOBBY ONLY** — `lobby-board.js`, one
  file for both projectors, inside the white QR panel and UNDER the code, which
  nothing in this app may dim. **It was computed and never drawn for as long as
  the feature existed**: both engines put it in the payload, there was a test
  asserting the payload had it, this file said it was on screen, and no
  projector ever read the field — while the phone's own button promised *"Top
  scores go on the big screen"*. **A test that the payload is right proves
  nothing about whether anybody drew it.**

Full reasoning: **[`docs/lobby-games.md`](docs/lobby-games.md)**.

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

Stated by the host on 12 August 2026 and it is context every design decision
here sits inside. **He runs three businesses and has one admin day a week.**
Monday is when the inbox is read, the replies go out, the topical pack is
generated and read through, and app changes get made.

**It is a boundary that BUYS the turnaround rather than costing it**, and that
is his own framing: *"it's actually not a function of laziness. It's a function
of wanting to be as good as possible."* A week is fast for software — most
companies take three — and a stated weekly cadence that is kept beats an
unstated "when we get to it" by a distance. What makes it keepable is not
working harder on Monday; it is Monday not being swamped.

So the rule that falls out, and it is the one to apply when weighing anything
new:

> **A feature's real price is the ADMIN IT CREATES ON A MONDAY, not the code it
> takes to write.**

That is the thread running through a lot of what is already built, and it is
worth seeing them as one system rather than as separate conveniences: the
draft-reply button, the inbox that gets shorter when you answer something, the
queue position on pack requests, the been-opened receipt, the "one open request
at a time" limit, the refusal to add an email service. **Every one of them is a
Monday-load reducer.**

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
half eleven, drive home, and owe a venue an invoice, a thank-you and a nudge
about next month — and none of that happens, because the blank page is the
expensive part rather than the sending.

**THE SHAPE IS ALWAYS THE SAME AND IT IS THE ONE `reply-draft.js` ALREADY
USES: the app prepares, the human reads, the human sends.** Four reasons it is
the right shape everywhere rather than a compromise:

- **The blank page is where the time goes**, not the pressing of send. Removing
  it is most of the saving available.
- **The human stays accountable for what goes out**, so nothing goes publicly
  wrong in their name — which is the whole reason `reply-draft.js` drafts and
  never sends.
- **It needs no email service**, because the share sheet and the clipboard are
  already how invoices leave this app. So it is not blocked on anything.
- **It is dual-purpose**, which is the guard rail below: the venue gets a
  faster reply AND a better one, rather than the quizmaster simply doing less.

**Do not build a send that skips the reading**, however much it looks like the
obvious next step. An invoice or a thank-you that goes out unread is the
version that names the wrong headcount, or bills a night that was cancelled —
and it lands on the relationship the quizmaster is being paid to keep.

**AND THE GUARD RAIL, which is what keeps the rule honest: every one of those
is dual-purpose, and an admin reducer that makes the customer's experience
worse is the WRONG reducer.** The host's own framing — they exist to make the
admin burden as small as possible *and* to give the customer the most value,
not one at the expense of the other. Each is genuinely two-ended: the draft
reply means a thirty-second answer AND that they get an answer at all; the
queue position means not being chased AND that they know when; the receipt
means knowing it landed AND that they know it was seen; "one open at a time"
protects the time AND replaces a silent refusal with a stated rule.

The distinction matters because "reduce the admin" would otherwise justify the
opposite of all of it — ignoring the inbox, sending replies unread, hiding the
way to get in touch. **The load comes down by making the work FASTER AND MORE
CERTAIN, never by doing less of it.** That is the line between this and a
software company nobody can get hold of, and it is why `reply-draft.js` drafts
and never sends.

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

The grid at the top of a pack tab stays **Your quizzes** / **Your bingo
games**, because it is neither of those two things: it is everything you can
RUN tonight, which is your own packs and the Quizporium ones you hold, mixed.
That distinction is the reason the shop sits under its own heading rather than
in the same grid — see the shop notes below.

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

**A control that needs a paragraph is a design problem, not a copy problem.**
When the urge to explain arrives, the first question is whether the thing
itself is wrong.

---

## Where the reasoning lives

**Every RULE is in this file. The WHY is in `docs/`.** Split on 14 August
2026 because this file had reached ~90,000 tokens and loaded in full at the
start of every session, which left little room to do any work in. **Split
again on 15 August 2026**, the same way and for the same reason — it had
grown back to ~50,000 as the console theme, the calendar layout, the lobby
game, Tonight and the drag work each landed with their full reasoning inline.

Nothing was deleted and nothing was summarised — whole sections moved
verbatim, by line number, so nothing was retyped and nothing could be quietly
reworded on the way through. **Each one left its RULE behind, plus a link.**
Open the one you are touching; do not read them all.

**[`docs/engine.md`](docs/engine.md)** — phases, scoring, and what each screen is told

- Stopping a quiz early
- Leaving the app mid-question
- How many people can play
- Online mode is ONE BOOLEAN, and the branch count is a budget
- The alphabet round — no options at all
- The intro round skips the dead air, and that is a SCORING fix
- The draw from the bottom half — a retention feature, not a raffle
- A phone must not say you were right before the projector does
- The picture round's four reveals

**[`docs/screens.md`](docs/screens.md)** — the projector, the phone, the moments on them

- The rules slide
- The join code is on more than the lobby
- The countdown before kick-off
- A mis-tap must not reveal an answer
- The fastest finger gets their face on the projector
- A mis-tap must not reveal an answer
- Looks — dressing a night up

**[`docs/console.md`](docs/console.md)** — launching a night and driving it

- A launch must say what it is about to destroy
- The restart notice, and the one state that made it a lie
- PRESSING A TAB PUTS THE TAB BAR AT THE TOP OF THE SCREEN
- THE CONSOLE'S THEME — one surface, one heading ladder, a bar that stays
- The tabs run LEFT TO RIGHT along a quizmaster's evening
- DRAG AND DROP — the console is the laptop with the HDMI in it
- TONIGHT — one launch section, at the top of every tab

**[`docs/gigs.md`](docs/gigs.md)** — venues, prizes, the diary, past nights, getting paid

- The winner's prize, on their phone
- The diary — a calendar that maintains itself
- Past gigs — the record of somebody's work, and who may take it away
- Invoicing
- Getting paid: what you have not billed, and who has not paid
- THE MONTH IS ON THE LEFT AND WHAT YOU DO ABOUT A DATE IS ON THE RIGHT
- The last slide of the night — "Back here Thursday 20th"
- Headcount per venue — the app finally says a number it always knew
- A prize taken at the bar has to reach the filed night

**[`docs/lobby-games.md`](docs/lobby-games.md)** — what a phone does while the room fills up

- MAZE MOUTH — THE LOBBY GAME, AND IT IS NEVER CALLED PAC-MAN
- RALLY — the bingo night's game, and it is not called Pong
- TAILBACK — a tail that grows, and the first game behind the picker
- QUICK DRAW — a shooting gallery, and the third answer to one fairness problem
- THE PICKER, AND WHAT A TIER ACTUALLY BUYS

**[`docs/accounts.md`](docs/accounts.md)** — hats, tiers, rooms, gates, own packs

- My account — and the line that page is built along
- Accounts, and who is allowed to do what
- Read-only packs, and the other half of that

**[`docs/generation.md`](docs/generation.md)** — writing quizzes, checking them, what they cost

- Generated questions are checked, not trusted
- What the room asked for — THREE BUTTONS, not a box

**[`docs/owner.md`](docs/owner.md)** — the business — five tabs

- The owner page — five questions, five tabs

**[`docs/branding.md`](docs/branding.md)** — the name on it, and whose colours it wears

- The name on it, and whose colours it wears

**[`docs/deployment.md`](docs/deployment.md)** — what the host has, and what that blocks

- Things the host does not have, and what that blocks

Also: **[`docs/artwork.md`](docs/artwork.md)** — the shared portrait library
(its rules are kept in full below, under *Artwork*);
**[`docs/business.md`](docs/business.md)** — pricing, the ladder, the shop,
the marketplace, referrals, group accounts;
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
done or he says otherwise.** It means he is at the laptop knocking through a
list, not thinking something over, and every extra word is in the way.

**ALWAYS OPEN WITH THE TO-DO LIST.** The first thing out of GSD mode is the
list itself — numbered, in the order to do them, URLs verbatim. Not a question,
not a preamble, not "shall I". If the list is not obvious from the conversation,
work it out from TODO.md and the current state and give it anyway; he will
correct it faster than he will answer a question about it.

- **Minimum context.** No reasoning, no background, no options, no "worth
  knowing". He has the context; he wrote it.
- **URLs, ALWAYS AS LINKS.** Never a bare path or a "go to Settings" when a URL
  exists — he is clicking them, not reading about them. Deep-link as far in as
  the site allows, and give the full `https://…` so it is clickable in a
  terminal.
- **A LINK BEATS A QUESTION.** If the next step depends on which service he
  uses, do not ask — list the likely ones WITH their deep links and let him
  click the right one. Asking costs a round trip; a five-line list costs him
  one glance.
- **Very succinct.** A step is a line. A list is a list.
- **YES or NO where a yes or no is possible.** Do not soften it into a
  paragraph, and do not add the caveat unless acting on it would break
  something.
- **Answer the step he is on**, not the two after it.

It is a MODE, not a personality change: the rules that stop things going wrong
still apply. If something is about to cost money, destroy a night or push to the
wrong place, say so — in one line. **Argue in normal mode, not in GSD mode**;
if a proposal needs pushing back on, note it in a sentence and raise it properly
when the list is done.

### THE PROTECTED SURFACE — what must not break, and what may

Stated by the host on 14 August 2026, on a gig day: *"The thing that needs to
be stable and definitely working is the quiz launch capability for pubs.
Everything else that changes doesn't affect me tonight."*

**This is as useful for what it FREES as for what it protects.** Without it
every change gets treated as equally dangerous, which is slow and, worse,
spreads the care thinly over things that cannot end a night.

**PROTECTED — the path from "the room is sitting down" to "the quiz is
running":**

1. The console loads, the pack cards draw, **Launch works**
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
- **Press Launch in a real browser**, on the quick-launch bar AND a pack card,
  and check a game is actually running afterwards. The engine is rarely the
  hazard; **the console's launch form is**, and no unit test presses a button.

The second one is the one that gets skipped, and it is the one that would stop
a night. A `node --check` passing means the file parses, not that Launch still
launches.

### "Sweep mode" — find everything, change nothing

**If he types `Sweep mode`, run a full sweep and REPORT. Do not action any of
it.** He decides what gets fixed; the output is a list he can work through and
dismiss from.

Four things at once, because they hide in each other:

- **Contradictions** — the docs against the code, and the code against itself.
  A rule stated in CLAUDE.md that the code no longer honours is the one that
  costs a future session a day.
- **Bugs** — including ones only reachable in a state nobody tests: mid-round, a
  redeploy, a lapsed subscription, a second login.
- **Vulnerabilities** — from BOTH sides. Signed in as a quizmaster reaching for
  what is the owner's, and the owner reaching into what is a quizmaster's. The
  second is the gate that runs backwards and is easy to forget.
- **LABEL COLLISIONS — two controls on one screen using one word for two
  different things.** See below; added 14 August 2026 at the host's own
  instruction, after finding one on the control view.

#### The fourth kind: one word, two meanings, side by side

**The exemplar WAS `Scores on screen` and `My scores`, next to each other on
the control view — and it is fixed, so the buttons now read `Scores to the
room` and `Scores, just me`.** One puts the scoreboard on the PROJECTOR for
the room; the other shows them to the HOST alone. Both said "scores", neither
said who was looking, and "My scores" read like the host's own score in the
quiz. The host's own test of it: *"if it's not obvious to me what it does, a
fresh QM will have no idea."*

**The fix is the shape to copy: keep the noun, add the AUDIENCE.** Renaming one
of the two would have left the other still saying only "scores" and put the
burden on remembering which was which; saying who sees it makes each label
complete on its own. It is worth nothing else on that bar, because nothing else
on it comes in two audiences.

**It is a CONTRADICTION rather than a wording preference**, which is why it
belongs in this sweep rather than on a tidy-up list: the design rules already
say *if two things on one screen use the same word for different sets, one of
them is renamed*, and *if a control needs explaining, the control is wrong*.
So a collision is the code disagreeing with a stated rule — exactly what the
first bullet is for — it simply lives in a `<button>` rather than in a
function.

**It hides from every other check there is.** It has no failing test, no 500,
no 403 and no visual defect; the page looks perfectly tidy. The only thing
that finds it is reading every control on one screen TOGETHER and asking what
a stranger would think each one did. That is the sweep's job and nothing
else's.

What to look for, and each has been seen in this app:

- **the same noun for two different sets** — "scores" for the room's and for
  yours; "packs" for the catalogue and for a quizmaster's own (solved by
  naming them **My packs** and **Quizporium packs**);
- **a label that describes the TOOL rather than the act** — "The pack editor"
  on the link somebody presses to write something; "Redo" for a button that
  wipes a question's points and asks it again;
- **a verb with no object** — "Back", "Skip", "Advert": fine when the object
  is obvious, a collision the moment two of them could take different objects;
- **a control whose only explanation is a `title`.** There are no tooltips on
  a phone, and half these screens are driven from one. A tooltip is a bonus;
  if it is carrying the meaning, the label is wrong.

**REPORT THE PAIR, NOT THE BUTTON.** A collision is a relationship between two
controls, so "rename My scores" was half a finding — the fix turned out to be
the third option, saying WHO SEES IT on both. Give the pair, what a stranger would
guess each does, and what they actually do.

**Testing is allowed; leaving anything behind is not.** Start servers, seed
throwaway data, sign in as a made-up account, probe every route — then kill it,
delete the temp directories, and leave `git status` clean. **If a probe breaks
something, fix it in the same turn and say so.**

**VERIFY BEFORE REPORTING, because the last sweep produced four "findings" that
were the sweep's own mistakes** — a route called with the wrong field name, a
parameter that is correctly ignored, a tier limit working exactly as designed.
A false finding costs him time and teaches him to skim the next report. When a
thing looks wrong, reproduce it deliberately before it goes on the list.

**Say what HELD as well as what failed.** "Rooms held against every attempt to
reach another quizmaster's night" is worth as much as a bug, because it is the
part he cannot check himself.

---

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
  assets/brandmark.js  the question-in-a-mic logo, shared with the server as the favicon
  assets/avatar.js     a drawn face per team, for anyone who sent no photo
  assets/stickers.js   props to drag onto a photo: dog ears, a clown nose
  assets/schemes.js    a quizmaster's own two colours, shared with the server
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
4. Add one entry to `TABS` in `public/assets/console.js` — that gives it a tab,
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

### The tabs run LEFT TO RIGHT along a quizmaster's evening

`TABS` in `console.js`. **Music Quiz · Music Bingo · Adverts · Gigs · Invoices ·
Venues · Help · My account**, with **Tonight** above all of them. The bar reads
as an evening: what you will PLAY, what goes between the rounds, the NIGHT
itself, getting PAID for it, the standing arrangements behind all of it, then
the two you touch twice a year. **Rarely-touched goes right** — My account keeps
its name rather than becoming Settings. Gigs sits at both ends of the journey
and stays whole rather than becoming a tenth tab.

**A reorder is the cheapest change in the app and the easiest to get wrong
silently** — nothing fails, a tab simply stops being where somebody's thumb
expects it. Open every tab in a browser at 390 and 1280 afterwards and measure
the page for overflow.

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

`gripIcon()` / `dragRow()` in `editor.js`, `packDrag` in `console.js`. The
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
  Switching one off makes it a COMPOSED night even with one pack, and the Launch
  button names what will be PLAYED. Keyed by pack AND index, never by title.
- **`stopPropagation` on the tick's mousedown as well as its click**, or a press
  on a tick drags the pack.
- **Mixing rounds from two packs belongs to the NIGHT, not the editor, and is
  deliberately NOT BUILT.** If it is picked up, start from Tonight.
- **`moveWithin()` must allow for the source already being removed**, and the
  drop marker is ABOVE or BELOW depending on which half of the row you are in.

Full reasoning: **[`docs/console.md`](docs/console.md)**.

### TONIGHT — one launch section, at the top of every tab

`launchBar()` in `console.js`, drawn above the running panel on every tab.
*"Wherever he is, he can launch from there, and it needs to be fully featured.
Sometimes you just don't want to think, you want to get in and go and know it
will work."*

- **Tonight's pack is already chosen** (`quickPicks()`), the venue is printed at
  the top, and **Set it up** holds the rest — shut by default, one tap away.
- **ONE gradient button on the section.** There were three.
- **THE CONSOLE AND THE BIG SCREEN MUST AGREE, ALWAYS.** A choice STICKS — the
  auto-pick is the empty state and nothing else — and with nothing chosen the
  bar starts on **what is running** (`running.packId`). `paintLive()` prints
  what is on the projector off `library.running`, in gold when it differs.
- **Picking a pack puts it on the big screen when nothing would be lost.** THE
  SERVER decides which: the ordinary launch call without `replace` already
  answers 409 when `session.inProgress()`. A 409 is SILENT here. A re-render is
  not somebody choosing a pack (`quiet`), and what is running is READ BACK.
- **IN THE ROOM / ONLINE is a switch in the head, beside the venue** — a setting
  whose wrong value ruins the night belongs where it is read. Only the ONLINE
  half wears the gradient, and shut, the line still says "Online". **Not
  remembered on the device.**
- **The venue is chosen HERE and nowhere else** — searchable, drawn from the
  Venues tab and from where you have played, with **Somewhere else…** for a
  one-off. Not remembered on the device either.
- **Whose night it is, RANKED**: a date you typed, then whose usual night it is,
  then where you played last. **Two claims for one night are NAMED, never left
  blank** (`clashTonight()`), in gold — nothing is broken, it is a decision only
  the human can make.
- **It folds to a thin line that still says what it is set to**, kept in
  `localStorage`; one row, no wrap, the middle ellipsised, and the whole row is
  the target. **The heading does not move when it folds** — a three-cell grid
  with all three children placed explicitly, and the fold control says HIDE and
  SHOW at a fixed width.
- The pack cards keep their own Launch for now: this is the protected surface.

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

### A prize taken at the bar has to reach the filed night

`updateArchivedNight()` in `src/library.js`, and `state.archivedAs`. A night is
archived the instant it reaches the final scores and the bar scans the winner's
QR minutes later — so every filed night said the prize was never taken. An
UPDATE rather than a second archive, compared against what was last filed before
writing (or a game sitting on the final scores rewrites the file on every push),
and **pushed to the backup again**, or the fix reaches this disk and nothing
else. **The flag that stops a night being filed twice is `state.archivedAs`, not
a field on the Session** — the old one was cleared by `build()`, which runs on
boot, so a restart on the final scores filed the whole evening a second time.

Full reasoning: **[`docs/gigs.md`](docs/gigs.md)**.

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
npm test        # 980 tests, no network, injected clocks — must stay green
npm start       # then /console?key=... from the printed log
node scripts/shots.mjs --key KEY       # screenshots of a whole quiz
node scripts/shot-bingo.mjs            # bingo, incl. the card-reload check
node scripts/pub-unchanged.mjs HEAD~1 --ignore online   # did I break the pub night?
```

**`pub-unchanged.mjs` is the one to run before a gig week.** `npm test` says
the tests still pass; this says something stronger and far more useful — that
the actual BYTES a projector and a phone receive, at every phase of every pack
in the library, are identical to a commit you trust. It runs both versions of
the engine side by side on one injected clock, with the same teams answering
the same options at the same seconds. `--ignore` names top-level fields that
are allowed to be NEW, so an additive change can be waved through by name:
*"there is one new field and it is called `online`"* is a claim somebody can
check, where "some things changed" is not. It was written to answer the host
asking whether the online work would make his Wednesday awkward, and the
answer it gave was 2,150 identical payloads across seven packs.

**COMPARE AGAINST THE BRANCH YOU ARE MERGING INTO, NOT `HEAD`.** On a
committed, clean checkout `HEAD` IS the working tree, so the script runs the
same code against itself and can only ever print IDENTICAL. It is not wrong,
it is empty — and it has now been quoted as a pass twice in one day, once by
a session reporting its own finished branch. Use
`node scripts/pub-unchanged.mjs origin/MusicQuizApp` when checking work that
is already committed; `HEAD` is only meaningful while the change is still
uncommitted in the working tree.

**AND IT WAS ANSWERING WITHOUT ANSWERING — every "identical" this file quotes
above was measured with a hole in it.** `Engine.answer()` takes an OBJECT and
the script called it positionally, `a.answer(id, 0)`, so every answer came
back `unknown_player` and was dropped in silence. Every *"after the fast
answer"* comparison was a question with nobody having answered it, which put
**the scoring, the tally, the fastest finger and who-picked-what outside the
one check this repo runs before a gig week** — on a script whose own comment
said those were exactly what it was exercising.

Found on 14 August 2026 by making a deliberate change to a player's
mid-question payload and being told the payloads were identical. Fixed, and
the fix is the lesson: **the answer is now asserted**, so the script throws
rather than reporting a clean run it did not earn. A guard that quietly tests
nothing is worse than no guard, because it is believed. The picks are worked
out per round type as well — "option 0" is not answerable on a pick-them-all
question (refused unless it gets exactly the number asked for) or an alphabet
one, which is the second reason it was doing nothing.

**And a THIRD fault in the same file: it ignored the commit you named.**
`--ignore` is parsed by finding its index, and with no `--ignore` that index
is -1 — so `i !== ignoreAt + 1` read as `i !== 0` and threw away argument
zero, the ref. Every `pub-unchanged.mjs <commit>` ever run in this repo
compared against `HEAD~1` instead, and announced it in a line that looks
exactly like a confirmation. Three faults in one script, none of which made it
fail: **a tool that cannot fail is a tool nobody checks.**

**AND A FOURTH, on 15 August 2026: IT HAD NEVER LOOKED AT THE LOBBY.** The
first `compare()` came AFTER `a.start()`, so every payload this script has ever
checked was from a game already under way — **the join code, the QR, the prize
line, the player strip, the countdown and the lobby game were all outside the
one guard this repo runs before a gig week.** That is the screen a room looks
at while sixty people are joining, which is the busiest moment of the night and
the one path this file says must not stutter. Found the same way as the
answering fault: a field was added to the lobby player payload and the script
said the payloads were identical. There is a `compare('lobby')` before
`start()` now. **Four faults in one script, and every one of them was the tool
answering confidently about something it was not looking at** — when it says
IDENTICAL, the useful question is what it did not compare.

**It also says WHICH FIELD now.** It used to print the first 300 characters of
both payloads — and a payload's first 300 characters are nearly always
identical, so a real difference showed as two lines that looked the same. It
lists the differing paths, how many payloads carry each, and which roles saw
them, so the output is the claim: *"`you.score` and `you.position`, on a
phone, mid-question, and nothing on the projector or the host's screen."*

Beyond the unit tests, these were run by hand and are worth repeating after
anything structural:

- 60 phones with live SSE connections all answering at once
- `SIGKILL` mid-quiz and mid-bingo, checking the right question/track and all
  scores, cards and marks come back
- QR output decoded with a real scanner (OpenCV) across versions 1–10

**A full software audit was run before handing out a second login — see
`AUDIT.md`.** It is the record of what was checked, what it found, what held,
and — the part worth reading before promising anything — **what an audit from a
container cannot tell you**: real iOS Safari, pub wifi, a projector, a phone
camera, and the photo round trip, which has no repository configured here and is
the one shipped feature whose happy path is still unproven.

---

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
