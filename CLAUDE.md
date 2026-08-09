# Project notes for Claude

Read this before changing anything. It records what this is, the rules that
must not be broken, and the decisions already made — so a fresh session does
not undo work by accident or re-ask settled questions.

**Keep this file current.** When you make a decision that a future session
would need to know, add it here in the same turn.

---

## What this is

Live games for pub and club quiz nights, run by a professional host (Mark).
He is hired as the entertainer, never the organiser, so it runs on his kit in
someone else's venue in front of a paying room.

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

### 3. Only a real removal throws a phone out

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

### 4. Bingo cards cannot be regenerated
The card is built server-side on join and stored against the player. There is
**no endpoint that issues a new card** and no card-generating code on the
phone. Refresh, reopen, clear the browser, rejoin — same card. Do not add a
"new card" feature; the host asked for this explicitly to stop cheating.
`newRound()` is the only thing that reissues, and it does everyone at once.

### 5. Crash recovery
State is one JSON object written atomically. Anything that **moves a game
forward** flushes to disk immediately (new question, reveal, round change, a
team joining, a bingo track called, a bingo square marked). Only high-frequency
low-stakes things are debounced.

Bingo marks are deliberately immediate: a lost quiz answer is recoverable with
Redo, but nobody can re-tap ten songs they heard half an hour ago.

### 6. Phones never show the question text
Only the options. Keeps the room looking up, makes googling harder.

### 7. The scoreboard and adverts are flags, never phases
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

### 8. "Pick them all" tells the room HOW MANY, never which
A `multi` question shows six options with 2–3 correct. The screen and the phone
get `pickCount`; `correctIndexes` is host-only, like every other answer key.

Part marks — the share you got right, applied to the base AND the seconds left,
so a fast mostly-wrong answer cannot out-earn a slower right one. The
first-correct bonus needs the **whole** set. Exactly N picks is enforced server
side and refused rather than trimmed, or somebody covers the board and scores.

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
| **The looks are shown, not named** | Each filter is a thumbnail of *their own photo* with it applied, all seven on screen at once. They were a scrolling row of named grey pills and the host went through the whole flow on his own phone without noticing they existed — three of the seven were off the right-hand edge with nothing to say so. Same `drawFiltered()` as the preview and the upload, just at `maxSide` 120. |
| **"Filters" means PROPS first, colour second** | `public/assets/stickers.js` — dog ears, a clown nose, a party hat, nine of them, drawn like the seasonal motifs and for the same reason. The host asked for "clown noses, dog ears etc." and found colour grading, which is what `filters.js` does; that is now folded away behind "Change the colour instead". **No face detection anywhere**: a model is megabytes on a stranger's phone over pub wifi and `FaceDetector` does not exist on iOS Safari — both break *no dependencies* and both fail on somebody's handset in a room. So a prop is tapped, dragged and pinched, which works everywhere and is funnier put on wrong. Positions are stored as a **fraction** of the canvas, never pixels, or the nose is on the chin at 320px and the ear at 1280. The prop tiles have a mid-grey fill: half the props are nearly black and on the page's own dark panel they read as empty squares. |
| **A photo gets the MIDDLE of the screen, not a thumbnail** | `showBigPhoto()` in `screen.js` — 66vh, centred, name under it, fades in and away over about three and a half seconds, then it joins the strip (which is 18vh now, not 13). One at a time and queued: three people sending at once is three moments in a row, not three pictures fighting. **The first paint of a page shows none of them.** A projector opened an hour in, or reconnecting after the laptop slept, would otherwise replay the whole night one picture at a time — two minutes of slideshow over whatever the quiz was doing. `seenPhotos` is keyed by id rather than "the strip has not got one", because the strip is torn down whenever the phase has no room for it and a photo does not become new again because the scoreboard went up and came down. |
| **"Filters" means PROPS first, colour second** | `public/assets/stickers.js` — dog ears, a clown nose, a party hat, nine of them, drawn like the seasonal motifs and for the same reason. The host asked for "clown noses, dog ears etc." and found colour grading, which is what `filters.js` does; that is now folded away behind "Change the colour instead". **No face detection anywhere**: a model is megabytes on a stranger's phone over pub wifi and `FaceDetector` does not exist on iOS Safari — both break *no dependencies* and both fail on somebody's handset in a room. So a prop is tapped, dragged and pinched, which works everywhere and is funnier put on wrong. Positions are stored as a **fraction** of the canvas, never pixels, or the nose is on the chin at 320px and the ear at 1280. The prop tiles have a mid-grey fill: half the props are nearly black and on the page's own dark panel they read as empty squares. |
| **A photo gets the MIDDLE of the screen, not a thumbnail** | `showBigPhoto()` in `screen.js` — 66vh, centred, name under it, fades in and away over about three and a half seconds, then it joins the strip (18vh now, not 13). One at a time and queued: three people sending at once is three moments in a row, not three pictures fighting. **The first paint of a page shows none of them.** A projector opened an hour in, or reconnecting after the laptop slept, would otherwise replay the whole night one picture at a time — two minutes of slideshow over whatever the quiz was doing. `seenPhotos` is keyed by id rather than "the strip has not got one", because the strip is torn down whenever the phase has no room for it and a photo does not become new again because the scoreboard went up and came down. |
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
| **Launch is the last thing on a pack card, and full width** | Read / Rename / Delete sit in a row above it, sharing ONE rule rather than four near-identical ones that had already drifted on size. Launch is the biggest thing on the card and nothing sits under it, so it cannot be hit on the way to something else. |
| **The tab icon and the logo are one drawing** | `public/assets/brandmark.js`, imported by `client.js` in the browser AND by `server.js` for `/favicon.svg`. Two copies of a logo is one that gets changed in one place and not the other and goes unnoticed for a month. SVG rather than `.ico` because there is no build step to make one; a browser too old for SVG favicons just shows its default, as it did before. The tab version has thicker grooves — at 16px a 1.6-wide stroke on a 40 viewBox is two thirds of a pixel and turns to mush. There are tests that the two agree. |
| **Native controls are told the page is dark** | `color-scheme: dark` on `:root`. Without it the browser draws tickboxes, radios, scrollbars and the open list of a dropdown for a white page, and they arrive as white slabs — the console's dropdowns were the loudest thing on a pack card, louder than Launch. A `<select>` also gets `appearance: none`, the page's own fill, and a drawn chevron on a gradient block so it reads as part of the app without competing with the button underneath it. |
| **A pack still says `cardSize`** | `cardShape()` reads `cardSize` OR `cardRows`/`cardCols`, so no pack on disk had to be rewritten and an older deploy still reads a newer pack. `shapeFields()` writes both when it is square. |
| **The card is sized from the list, not from a default** | A round of 42 is a 5x5 round. Import always said 4x4, so 42 songs quietly became sixteen squares — a line lands early and most of the round never reaches a card. The dropdown moves itself to the biggest card the pasted list carries and says so, and stops the moment you touch it. `cardSizes` comes from `minimumTracks()` over the library payload so the console keeps no copy of the sum. |
| **Card type scales with the grid** | `.bingo-grid.cols-5` in `style.css`. At the 4x4 sizes, a 5x5 cell clipped "Bootylicious" to "Bootyliciou" — a square you cannot read is a square you cannot mark, and that is somebody missing a full house. Four lines rather than three at 5x5: the words matter more than the tidiness of the grid. Checked down to a 320px iPhone SE, where all 25 now fit without scrolling. |
| **A generated pack keeps its playlist** | `pack.spotifyPlaylist`, surfaced by `listBingoPacks()` and shown as a green Playlist button on the pack card. The link used to appear once in the generator's log and then you had to go and find it in Spotify on the night. |

---

## The rules slide

`PHASES.RULES` is the first slide of every quiz, between the lobby and round
one. `rulesView()` builds it **from the scoring constants themselves** — never
written out by hand, because a rules slide that disagrees with the scoring is
worse than none: the room will hold you to what it said. A pack can opt out
with `showRules: false`.

It is two things and nothing else: **the points on the left, the join code
filling the whole right half.** This slide is up while the room is still
filling, so it is the most valuable place on the night for a code.

Each row is the number in orange with `PTS` after it, and what it is for in
smaller white underneath. There was also a numbered how-it-works list, and a
line per round type the quiz contained. **The host took both off** — he says
all of that on the mic while the room is getting a drink in, and a slide full
of small text is a slide nobody reads. If a future round type needs explaining
on the projector, that is a new decision, not a bug to fix.

**Nothing on this slide says "team".** The quiz is played by individuals for
now, and the same goes for the lobby steps, the phone's join screen and the
topbar count ("6 playing"). When team play lands, that is the wording to
revisit. There is a test that fails if "team" comes back to the rules slide.

---

## The join code is on more than the lobby

The big QR used to be drawn in exactly one place, `renderLobby()`, so it
vanished the moment the quiz started and a latecomer had nothing to scan. That
was true from the beginning; the rules slide only made it obvious.

Now: the lobby and the rules slide carry a **big** code, and every other slide
where somebody could still walk in carries a small one in the top right
(`paintJoinCorner`, an overlay on `.stage` like the photo strip, so no card has
to know about it).

**Never during a question or a reveal.** Twenty seconds with four options wants
the whole projector. Also never over the scoreboard or an advert. That list is
`NO_JOIN_CORNER` in `public/assets/screen.js`.

**No card ever waits for the join address.** The QR image is drawn by the
server at a fixed URL, so it can go up the instant a card is built; the
written-out address is fetched at boot and can easily arrive after a slide is
already on screen. Cards mark the slot with `data-join-url` and `paintJoinUrls()`
fills every one of them in whenever it lands. Gating the whole code on that
fetch — which is what it did at first — put a rules slide on the projector with
an empty half, and it never came back, because the card only rebuilds on a
phase change.

---

## A mis-tap must not reveal an answer

He revealed one early at a gig — not a disaster, but the room saw it. Two
guards, both in `public/assets/host.js`, and neither of them a confirm dialog:
a host with a mic in one hand is not reading "are you sure?" on a phone.

- **Every host action is deaf to a repeat of itself for 900ms** (`DOUBLE_TAP_MS`
  in `act()`). A double-tap — the thing a laggy phone on pub wifi invites, because
  the first press looks like it did nothing — sends once. It is keyed on the
  action, so Next-then-Back still works instantly; it is only the *same* button
  twice in a blink that is ignored.
- **The primary button refuses to reveal in the first three seconds** of a
  question (`TOO_SOON_MS`), with a toast saying why. Nobody has answered three
  seconds in, so there is no honest reason to press it, and the palm-of-the-hand
  press as the question goes up is exactly how this happened.

**The button is not the only way an answer appears, and that is the point.**
`session.js` reveals on its own when the clock expires, so the button means
"everybody has answered, get on with it" — which is why refusing it early costs
nothing at all.

---

## Stopping a quiz early

`Engine.finish()` jumps to `PHASES.FINAL` from wherever the quiz is. The Setup
panel — with "Clear everything" — only appears in the lobby and at the end, so
before this there was no way to end a night early except pressing onwards
through every remaining question.

It keeps every score and clears the scoreboard and advert flags, and `back()`
from FINAL returns to the round board — so a mis-tap on the host's phone is one
press to undo. That is why it is not a reset.

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

---

## Generated questions are checked, not trusted

`src/generate-quiz.js` runs two passes:

1. **Write** — asks for `perRound + 4` questions, so there is slack.
2. **Check** — a separate call, framed as checking somebody else's work, told
   to assume there are mistakes. It only ever REJECTS; it never rewrites,
   because a rewrite would itself be unchecked. Failures are discarded and the
   survivors kept.

A question the checker does not mention is treated as **unchecked, not passed**
— silence is not approval.

**The checker works in small batches, run at the same time.** `CHECK_BATCH`
is 6. It used to send a whole round in one call — the longest call in the app,
a stronger model with thinking, several minutes of single point of failure, and
the thing that died on the host. Batching makes each call short, limits a hang
to one batch, and cuts the wall clock rather than adding to it. A `multi`
question is six options to verify rather than four, so those batches are the
slowest — which is why the answer to "the multi round is slow" is smaller
batches, not fewer options. Six options with 2–3 correct is the round type; four
would make it a giveaway.

**But a checker that cannot be reached must not lose the quiz.** By the time
the second pass runs, the generation is minutes and real money deep. If both
the checker model and the fallback fail, the questions are kept, the round is
recorded in `unchecked`, and that is said in the pack's own notes and in the
console — read those rounds line by line. Throwing there once binned a whole
two-round Metallica quiz on the last call of the job. Every Claude call also
carries a timeout now (4 minutes when thinking, 2 without); without one a hung
call hangs the whole generation, which from the console looks exactly like the
connection dropping for no reason.

On top of that, `reviewWarnings()` in `src/quizzes.js` catches the mechanical
version of the same faults with no API call, and is shown when reading a pack.
Each flag can be ticked off as the host reads through it; the tick is stored as
`question.checked` in the pack itself, so it survives a restart, a backup and a
different device. Flag ids are built from the kind of warning and what set it
off — never from the question's position — so a tick outlives renaming and
reordering rounds. Rewrite the question and the old flag stops applying while
any new one arrives unticked, which is the point: a tick means "I read this
wording", not "leave me alone about this question".

All of this exists because the first generated quiz shipped a question where a
wrong-marked option was defensible AND the fact printed on screen proved it.
Do not remove or weaken these without understanding that.

**Ticking a review flag is annotating, not editing.** `saveQuiz` refuses to
write a quiz that does not validate, which is right for the editor and wrong
for the review list — one broken question in round 2 locked every flag in the
quiz, and all it said was "Quiz is not valid". The `/checked` route passes
`{ allowProblems: true }`. The read-through also shows validation problems
above the hunches, in red, so you can see *which* question is at fault.

### A complaint on screen needs something to press

The read-through said "answers land A×15 B×10 C×5 D×1 — lopsided" and then
left you looking at it: the only way to move an answer was the editor, four
options at a time, twenty times. **Even out the answers** is on the end of
that same line now — `balanceAnswers()` in `public/assets/balance.js`.

It deals the right answers into the least-loaded letters, ties broken at
random, which beats a plain shuffle: on twenty questions a plain shuffle
leaves a visible lean about as often as not, and the lean is the thing being
fixed. It shuffles first and then does a **stable** sort by load, so equally
loaded letters keep their random order and the answer cannot settle into
A, B, C, D, A, B, C, D — which is as recognisable from the floor as a lean.

**It never touches a word.** Same options, same right answer, different letter
— which is why it is safe on a pack you have already read through: review flag
ids are built from option TEXT, so every tick survives it. There is a test.

Two refusals, both deliberate:

- **Not while that quiz is live.** Saving a quiz reloads it in the running
  game, so this would swap the options under a room mid-question. The button
  is shown greyed with the reason rather than hidden — one that vanishes
  mid-gig just looks broken. It comes back when the game ends.
- **A broken question is left alone.** Nothing marked correct, or everything
  marked correct, is the editor's job; rearranging a question whose answer
  nobody knows only makes the fix harder.

It rearranges and lights Save rather than writing straight away, so you can
look at what it did, press again if you do not like it, and close without
saving. The file lives in `public/assets/` rather than `src/` because the
console imports it in the browser and the test imports it in node.

### Reading a reply is its own job

`readTracks()` in `src/generate-bingo.js`, and it has tests. A generation died
on the host with nothing but "Claude did not return usable JSON" on a theme
that had worked minutes before. Three things keep that from happening:

- 8000 max tokens, because sixty-odd tracks is a long reply and one that runs
  out mid-track is not JSON at all;
- and if it still will not parse, the individual track objects are picked out
  with a regex. Fifty-five whole ones and a fifty-sixth cut in half is not
  valid JSON, but it is fifty-five tracks and only forty are needed.

**Thinking is ON by default on these models, and it is billed against the same
`max_tokens` as the answer.** That is what actually broke the first generation:
the whole budget went on thinking and the reply came back empty, on a theme that
had worked minutes earlier. Writing a list of songs to a fixed shape does not
need it, so both generators send `thinking: { type: 'disabled' }` with
`output_config: { effort: 'low' }`. The quiz **checker** is the exception — that
one is a judgement call, so it keeps thinking and gets 16000 tokens to do it in.

**Do not reach for an assistant prefill** to stop the reply being chatty. It is
the obvious fix and `claude-sonnet-5` rejects it outright — *"This model does
not support assistant message prefill. The conversation must end with a user
message."* Reading the reply properly is the answer instead.

**A Spotify problem never costs you the pack.** The playlist is the last and
least important step in `generateBingoPack()`, and it used to throw — losing
sixty candidates and forty resolved lookups because the optional bit failed. It
is caught, reported as `playlistError`, and the pack is saved regardless. There
is a test.

**A long job has to keep talking.** `progressStream()` in `server.js` sends a
`PING` every fifteen seconds while a generator is inside a Claude call, because
a minute of silence is long enough for something between the app and the
browser to hang up. The console skips `PING` lines, and — the other half of the
same bug — treats a stream that ends with **neither** a result nor an error as
"the connection dropped, it may still have finished, go and look". It used to
read `done.problems` off a null and show *"Cannot read properties of null"*,
which told the host nothing about a generation that was probably still running.

**Failure messages have to name the cause.** Both of these were mysteries at
midnight before they were fixed: this one, and Spotify's bare 403 `Forbidden`
on creating a playlist, which is now told apart by asking the token which
scopes it was actually granted (`grantedScopes()` / `explain403()` in
`src/spotify.js`) — a missing write scope and an account not admitted to a
Development-mode app look identical otherwise.

---

## The portrait library — one picture per musician, shared by every quiz

`src/portraits.js`. Artwork used to be filed per quiz — `images/eighties/
madonna.png` — so Madonna in the 80s quiz and Madonna in the Pop Divas quiz
were two files, drawn twice and **paid for twice**. Across a few hundred
musicians that was the largest avoidable cost in the app. A picture is now
named after the PERSON: `portraits/madonna.png`.

**The key is the musician's name and the style, and NOTHING else. That is the
load-bearing decision and it was arrived at by getting it wrong first.** The
obvious design keys off the question's own `imagePrompt` — but those are
written by *Claude* during quiz generation, so two quizzes wanting Madonna get
two slightly different sentences, two keys and two bills. The host never typed
either sentence, so he could not know it had happened, and the saving would
quietly evaporate looking exactly like success. A question's `imagePrompt`
still shapes the drawing, but **only on the first draw of that person in that
style**; every later pack reuses whatever is there.

So **a second version of somebody only ever comes from the host doing something
deliberate** — picking a different style, or asking for a redraw. Never from
Claude's wording. There is no numeric cap and no "2 versions per person" rule,
because a cap is the mess: it means deleting one the day you want a third, and
nothing on screen says which of the two you are looking at.

`generateImages()` **repoints a pack as it goes** and returns `repointed`; the
server saves the quiz when it is non-empty (`allowProblems: true`, same reason
ticking a review flag has it). So a pack written before the library existed
moves onto it the next time its pictures are made, and pays nothing to do so.

`imagePlan()` says what a press would cost **before** anything is spent —
"6 already in the library, free · 4 to draw — about 16p". That number is the
whole point of sharing, so it is read first rather than reported afterwards.

### Three styles, and there is deliberately no photoreal one

`STYLES`: **Portrait** (painted, true to life — the default and the easiest to
recognise), **Cartoon**, **As a superhero**. The host's choice always beats
whatever Claude wrote, or picking "as a superhero" would silently do nothing on
the many questions where the generator wrote a prompt of its own, and would
read as a broken setting.

**Every style is a whole second library of the same people**, so five styles is
five times the bill for the same musicians — which hands straight back what
sharing just saved. Adding one is a line in that file; do it because a night
needs it, not for the sake of choice. `--<style>` is the filename suffix and
the default has none, so a library built before styles existed still fits.

**There is no photoreal option on purpose, and that is a legal decision.** The
on-screen caption "AI-generated illustration — not a real photograph" is doing
real work: UK fair dealing is a closed list and does not cover commercial
entertainment, so a convincing fake photograph of a real living musician in a
pack that is SOLD is the one version worth not having. `promptFor()` appends
"must clearly be an illustration and not a photograph" whatever the style says,
and there is a test that every style does. There is also a test that no style
id contains "photo" or "real".

### Quality is a console setting, and it never was one

`gpt-image-1` was called with **no `quality` parameter at all**, so every
picture ever made used OpenAI's own default — the expensive end. It is now
`low`/`medium`/`high` on the Pictures panel, **medium by default**, and the
panel prices the press before you make it. Low is defensible: the picture is
zoomed, pixelated, blurred or behind tiles for most of its twenty seconds and
is then looked at from the back of a pub.

---

## The fastest finger gets their face on the projector

`renderRevealBanner()` in `screen.js` and `faceFor()` in
`public/assets/avatar.js`. On the reveal, beside "Fastest finger", the winner's
picture: **their own photo if they sent one tonight** (the most recent — people
send several and the latest is the one they meant), otherwise a cartoon face
drawn from their team name.

**There is always a face, and that is the load-bearing bit.** Most of the room
will never open the camera, so a slot that is sometimes a person and sometimes
a gap reads as a fault rather than a feature. The drawn fallback means it works
from the first question of the first night with nothing to set up — no upload
step bolted onto a join that is meant to take ten seconds.

**Matched on `playerId`, never on the name.** Two teams picking the same name
is a thing that happens — there is deliberately no name filter — and the wrong
person's photograph six feet wide is not a small mistake. `forScreen()`
therefore carries `playerId`; that is not new information on that payload,
since the name is already printed beside the picture.

**The drawn face is deterministic** — the same name always draws the same face,
so a team is recognisable all night, across a restart and on a projector that
reconnected. A random face each time would be worse than none, because the room
would assume it meant something. Drawn rather than emoji, same rule as
everything else, and deliberately a cartoon: it sits next to real photographs
of real people and must never read as a guess at what somebody looks like.

---

## A mis-tap must not reveal an answer

He revealed one early at a gig — not a disaster, but the room saw it. Two
guards, both in `public/assets/host.js`, and neither of them a confirm dialog:
a host with a mic in one hand is not reading "are you sure?" on a phone.

- **Every host action is deaf to a repeat of itself for 900ms**
  (`DOUBLE_TAP_MS` in `act()`). A double-tap — the thing a laggy phone on pub
  wifi invites, because the first press looks like it did nothing — sends once.
  It is keyed on the action, so Next-then-Back still works instantly.
- **The primary button refuses to reveal in the first three seconds** of a
  question (`TOO_SOON_MS`), with a toast saying why. Nobody has answered three
  seconds in, so there is no honest reason to press it, and the palm-of-the-hand
  press as the question goes up is exactly how this happened.

**The button is not the only way an answer appears, and that is the point.**
`session.js` reveals on its own when the clock expires, so the button means
"everybody has answered, get on with it" — which is why refusing it early costs
nothing at all.

---

## Leaving the app mid-question

`Engine.wandered()`, `wanderedNow()`, and the `/api/wandered` a phone posts on
`visibilitychange`. **It is a note for the host, never a penalty, and never on
the projector or a phone** — host view only, like the answer key, with tests
for all three.

**You cannot lock a browser out of its other tabs**, and the phone in somebody's
other hand is beyond anything running here. Anything claiming otherwise is
theatre that fails in front of a room. What the app *can* see is a phone going
to the background while a question is up.

**Once means nothing** — a call coming in, a notification and the screen locking
are indistinguishable from this. So: counted **once per player per question**
(a tab flicking in and out five times is one person who left, not five
offences), and the badge on the host's board only appears from **three**
(`WANDER_WORTH_SAYING`). A badge against half the room on the first
notification of the night is noise you learn to skip, which is the same as not
having it. It is gold rather than red and says "away x4", because the app knows
the screen went dark and does not know anybody cheated.

**Deducting points automatically would punish somebody whose mum rang**, which
on a Wednesday night is worse than a cheat getting away with it. The host reads
the pattern and decides.

The phone says nothing about any of this: a warning would make the innocent
95% of the room feel policed to catch the rest, and announcing the check is how
you teach people to beat it. `wandered()` deliberately does **not** call
`changed()` — a screen going dark is not news to push to the room — so the host
sees it on the next ordinary push, which during a question is the next answer.

What already does most of the anti-cheating work, and none of it is new:
twenty seconds; points for speed, so a googled answer at 18s scores far below a
known one at 4s; **phones never showing the question text** (rule 6), so it has
to be retyped from memory off the projector; and the picture, intro and
pick-them-all rounds being poor search targets.

---

## Things the host does not have, and what that blocks

- **No image generation key yet.** Anthropic has no image API, so a Claude key
  cannot make round 2 portraits. Host agreed to OpenAI (~50p/quiz) but has not
  set it up. Round 2 runs on placeholder art until then.
- **Spotify not set up yet.** One-time developer app + `scripts/spotify-login.mjs`.
  Bingo generation works without it, just no playlist.
- **On Render's free tier**, by choice. Connected browser tabs ping `/health`
  every four minutes so the app cannot sleep mid-gig; the host's routine is to
  open the big screen five minutes early. Agreed to move to Starter ($7/mo)
  before the first paying gig.
- **No persistent disk** — Render disks need a paid instance and the host is on
  free. The no-repeats song history therefore survives by being **committed to
  git**: `.gitignore` tracks `data/track-history.json` while ignoring the rest
  of `data/`. The host generates packs at home and commits them.
  **If he reports songs repeating, first check whether he generated on the live
  site instead of locally** — that pack's history entries are lost on the next
  deploy.

---

## Working style he asked for

- Ask before assuming, especially anything costing money or needing an account.
- Explain deployment like he is doing it for the first time, because he is.
- Keep the code readable — he will be editing it between gigs.
- Show screenshots when building screens.
- Presentation matters: projected in a dark room to paying customers. Big type,
  high contrast, readable from the back.

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
src/generate-bingo.js  theme -> Claude -> history filter -> Spotify -> pack
src/bingo-rules.js     what makes a good bingo track, for the in-app generator
src/spotify.js         playlist building
src/qrcode.js          dependency-free QR encoder
src/photos.js          photos from the room: store, kill switch, bin
src/adverts.js         venue advertising slides, per venue
src/generate-images.js round 2 artwork (placeholder or OpenAI)
src/portraits.js       the shared portrait library: one picture per musician
public/                the screens; *-bingo.js files hold the bingo variants
  assets/brandmark.js  the record logo, shared with the server as the favicon
  assets/avatar.js     a drawn face per team, for anyone who sent no photo
  assets/stickers.js   props to drag onto a photo: dog ears, a clown nose
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

### The alphabet round — no options at all

`type: 'alphabet'`. The question is asked on the projector, the phone shows a
keyboard, and **only the first letter of the answer has to be right**. Spelling
is irrelevant, which is the whole point — nobody types an answer on a phone in
a dark pub against a clock.

A question is `{ prompt, answer }` and nothing else. The twenty-six letters are
**not written into the pack** — `optionsFor()` puts them back, so the file stays
readable and a question is two lines rather than twenty-eight. Everything
downstream then treats a letter as an option index like any other: `answer()`,
the tally, `whoPicked()`, the fastest finger and the scoring are all untouched.

**"The Beatles" is B to half a room and T to the other half, and both halves are
right.** That is the one way this round breaks in front of people, and there is
no clever fix — so an answer beginning with "The", "A" or "An" is a **hard
validation error**, not a hunch. The editor says so as you type, the generator's
brief forbids it, and the checking pass has a rule about it. Do not soften this
into a warning; a round that produces an argument the host loses in public is
worse than no round.

`answerText()` is why the reveal says "Fleetwood Mac" and not "F". A lit-up
letter is not an answer, and on this round the words are the single most
important thing on the screen — they go **under the question**, in their own
slot, not in with the fastest finger at the bottom, where they landed on top of
the last row of letters.

The host's answer key shows the answer in full and then **only the letters
somebody actually pressed**, plus the right one. Twenty-six rows on a phone,
most of them empty, is not a thing anyone reads on a mic.

**The phone is five letters across where the projector is nine.** This is the
one place the two screens are deliberately a different shape, and it is a thumb
problem: nine across a 320px phone is 28 pixels a key. The ORDER is the same,
and that is what matters — a player looking for F is not matching a position on
the big screen, they already know which letter they want. A to Z rather than
QWERTY for the same reason: QWERTY is muscle memory for typing words, and
nobody is typing a word.

### The picture round's four reveals

`REVEAL_MODES` in `src/quizzes.js`: **zoom** (the original, still the default),
**pixelate**, **blur**, **tiles**. A round names one, a question can override
it, and `mix` rotates through all four **by position, not at random** — so a
Redo mid-gig hands the room back the effect they were half way through
watching rather than a fresh scramble. There is a test for exactly that.

**They all run on the same curve, and that is a SCORING decision, not a styling
one.** You score more the earlier you answer, so how fast a picture becomes
guessable is how many points are on offer. Give one mode a curve of its own and
that round is quietly worth more or less than the others, for the same crowd and
the same question — which nobody will ever attribute to the animation.

This bit is the whole lesson, and it was wrong first time: **pixelate ramps its
resolution GEOMETRICALLY, not in equal steps.** 11 pixels across to 22 gives
away half the face; 260 to 520 gives away nothing anybody can see. Ramped
linearly on the same `easeOut`, the picture was solved about two seconds in and
that round was a giveaway next to a zoom round. `PIX_FROM * (PIX_TO/PIX_FROM) **
shown` in `public/assets/screen.js`. Same curve does not mean same arithmetic.

None of it needs a library: pixelate is one `drawImage` a frame into a canvas of
at most a few hundred pixels, blown up by the browser with
`image-rendering: pixelated`; blur is one CSS filter; tiles is a grid of opaque
panels. **No `ctx.filter`** — the same old-iOS trap `filters.js` exists to
avoid. The `image-rendering` fallbacks are ordered least-known-last on purpose;
the other way round and the projector smooths the blocks into mush.

A misspelt mode is a **validation problem**, not a silent fall back to zoom —
otherwise you find out by watching the wrong effect in front of a room. The
editor hides "Starting zoom" on a question that does not zoom, because a knob
that does nothing reads as a knob you have to set.

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

## Looks — dressing a night up

`public/assets/looks.js` (the list and the shapes) and the `[data-look="…"]`
blocks in `style.css` (the palettes). Halloween, Valentine's, Christmas and
Summer so far. **Nothing about how a round plays changes** — it is a palette
and some drawn shapes.

**The palette changes on the projector AND the phones, or neither.** This is
the load-bearing rule. A player looks up, decides "the pink one, bottom left",
and looks back down; if the big screen went orange and the phone stayed pink,
the theme has cost somebody points. Both pages carry `data-look` on the root
element and the option colours `--a` to `--f` are set in the same block. There
are tests that every look sets all six and that no two are the same colour.

**The shapes are DRAWN, never emoji** — same rule as the bin icon, and there is
a test that greps `looks.js` for emoji. Some phones render a skull as something
cheerful.

**They go behind everything and the panels are opaque on a themed night.**
`--panel` is normally translucent, which let a ghost show faintly through
option C; each look sets it to a solid tint instead. The layer starts 64px down
so nothing sits behind the logo or the countdown, runs 8%–88% of the height so
nothing lands in a corner, and spreads evenly down each side — scattering them
by arithmetic put four in a heap in one corner and left the rest bare, which
reads as a fault rather than as decoration. The big text also gets a
`text-shadow` on a themed night so the question is never in the argument.

**The look lives in the GAME STATE**, set by `session.launch()`. Same lesson
the bingo card shape taught: a `SIGKILL` mid-round would otherwise bring the
game back wearing whatever the pack file said, and a room that was black and
orange five minutes ago would suddenly be pink. Tested.

**A pack carries a default, the launch overrides it** — the picker is on the
pack card next to the card shape and the prizes, for the same reason: "it is
the fourteenth of February" is a fact about tonight, not about the pack. A
misspelt look is a validation problem rather than a silent fall back to the
ordinary one.

The two corner washes and the drifting blobs behind everything are variables
now (`--glow-1`, `--glow-2`, `--drift-1`, `--drift-2`). They were written out
as hex, which meant changing `--bg` for Halloween moved almost nothing.

---

## Accounts, and who is allowed to do what

`src/accounts.js` (who is signed in) and `public/assets/plans.js` (what they may
do). Plans lives under `public/assets/` for the same reason `looks.js` does: the
browser needs the same list and two copies drift. **Enforcement is entirely
server-side** — `allowed()` in `server.js`; the browser copy only decides what
to draw.

**Two kinds of account, and they are not the same shape.** One **owner** — the
app dev. Writes and generates the packs, sells them, manages subscribers, and
runs no nights at all. Then a **quizmaster** per subscriber. The owner's own
quizmaster account is a separate login, marked `comped`: everything, for
nothing.

### The rule that decides which tier something goes in

The host's own, and it settles arguments before they start: **anything that
costs the owner money every time it is used is not in Basic.** Not "is it
impressive" — does a subscriber using it put a line on the owner's bill?

So a new round type, a new game, a new look and a new picture effect are Basic
the day they are written. Generating with Claude and artwork with OpenAI are
**owner-only** (a quizmaster never generates — the packs are written for them
and sold, which is the whole arrangement). Streaming is a paid add-on because
egress is a real per-use cost. There is a test that fails if any of the three
ever lands in Basic.

### A lapsed subscription never interrupts a night

**This is the load-bearing rule and it has tests.** Cards expire on a Tuesday
and banks get cautious at the worst moment. So `allowed(..., { live: true })`
is asked by everything a running game touches — the control view, `/api/host/*`,
the SSE stream, the state poll — and it says yes even when the subscription has
lapsed. `mayStartSomething` is the real gate.

The one host action that is NOT exempt is `launch`: starting a brand new night
is a beginning, not an interruption, and it is exactly where "sort the payment
out" belongs. That was a bug first time round — the broad `live` gate let a
lapsed account launch — and it is now checked on the action itself.

### Accounts survive a restart now, and they did not before

`accounts.restore()` and `restoreFromBackup()` in `server.js`, with `getFile()`
in `src/github.js` — which simply did not exist. The accounts were backed up to
the private repo faithfully and **nothing ever read them back**, which on a host
with no permanent disk is the same as not backing them up at all: the login you
made last week quietly stopped existing and the only clue was being asked to
sign in again.

**Only ever into an EMPTY file.** Reading a backup over live data would sign
everybody out and could roll a password change back to the one before it, so a
disk that already has accounts on it always wins. Not fatal either: a missing
backup is the normal first boot, and a GitHub having a bad morning must not stop
a quiz night — the host key still works regardless.

### The invoice book comes back too, and the counter is rebuilt not trusted

`invoices.restore()`, the same shape as the accounts: only into an empty book,
only at boot, a corrupt backup refused rather than believed.

**The care it needs is invoice NUMBERS, and it is not where you would expect.**
They are sequential and never reused. A backup can easily be a few minutes
stale — written before the last invoice went out — so believing its
`nextNumber` would hand out a number that is already on somebody's invoice. Two
customers holding invoice 7 is the one mistake in this area that an accountant
asks about.

So the counter is **rebuilt from the invoices themselves**: one past the highest
number actually present, or the file's own value, whichever is HIGHER. It can
only ever move forwards. There is a test called
"A STALE BACKUP CAN NEVER REISSUE A NUMBER" that issues two, restores a backup
claiming the counter is back at 1, and checks the next one issued is 3.

The prefix is read off the end of the number with a digit match rather than by
splitting on the prefix, because the prefix may well have been changed since —
`renaming the prefix later cannot renumber anything already issued` is already a
rule in that file.

### The first owner is made from the Console, with the host key

Making an owner needed the command line and Render's free tier has no shell, so
there was **no way to create the first login on the live app at all**. A "set up
the first owner" page open to the world is the thing this file rules out, and
rightly. Gated on the HOST KEY it is neither: the key already grants every
feature, so it hands out nothing that holding it did not already give you. The
panel only appears when there are zero accounts and the door closes behind you —
everything after that is owner-only.

### Passwords and sessions

scrypt from node's own crypto, salted per account, compared timing-safe. **The
password is never stored**, so the owner genuinely cannot read a subscriber's —
which is the honest version of "your account is private from me". Only the
SHA-256 of a session token is stored, so a copy of the file is not a set of
live logins. A wrong password and an unknown address give the identical message,
or the page cheerfully confirms who has an account here.

### The host key BEATS a signed-in account, and that ordering is load-bearing

`whoIs()` checks the key first. It looks like a detail and it is the difference
between a gig running and not.

The owner account has no quiz controls at all — that is the design, the owner
writes and sells packs and does not run nights. But Mark is one person with two
hats and **one laptop**. The evening he first makes an owner account, that
browser holds an owner cookie; opening the `?key=` console bookmark that has run
quiz nights for months would then bounce him to the owner page, which has no
Launch button anywhere. Minutes before a gig, with no way back except working
out that he had to sign out.

It gives nothing away: the key already grants every feature, so preferring it
cannot widen what its holder can do. It only means the way in that predates
accounts keeps working whatever else is going on in the browser — which is the
whole reason it is still here.

Two matching rules on the browser side, and the second was found by testing the
first: the console does not redirect an owner to `/owner` **if a key is
present**, and it asks `/api/me` **with the key on it**. Without that second one
the API would happily launch while the page drew no Launch buttons at all,
because the browser copy of `plans.js` had been told it was the owner. There
are tests that the owner cannot run a night and that the host-key identity can.

### The host key still works, and that is deliberate

There are gigs in the diary and `?key=…` on somebody's phone, so the day
accounts arrived could not be the day the old way stopped. A request carrying
`HOST_KEY` is treated as every hat at once — `BOOTSTRAP` in `server.js`, one
branch in `allowed()`. Retiring it later is deleting those two places.

The first accounts are made from the command line (`npm run accounts`), not
from a web page: a "create the first owner" route is a door that only ever
needs opening once and can be walked through by whoever finds it first.

**It backs up to the PRIVATE repo**, like the invoices, and for a stronger
reason — email addresses and password hashes.

### A room per quizmaster — how a second login became safe

`src/rooms.js`. Everything that belongs to ONE NIGHT hangs off a room: the
session, its own state file, its own photo wall and its own join code. Before
this, `session`, `store` and `photos` were module-level singletons — which is
exactly what made a second login dangerous. Rob pressing Launch would have
ended Mark's night mid-question, and a photo Rob's tester sent would have gone
six feet wide onto Mark's projector. There is a test for both.

**A room is decided by WHO YOU ARE, never by anything a request carries.**
`/api/host/*` takes no room parameter on purpose: a control view that could be
pointed at somebody else's night is the whole thing this prevents. Phones are
the other way round — they are told a code off the projector.

**The house room keeps the original file locations, and that is not tidiness.**
`data/state.json` and `data/photos/`, exactly where the single-game version put
them. There are gigs in the diary and Mark may deploy between rounds; moving
the state file would bring the app back with no game, no scores and an empty
photo wall in front of sixty people. Only additional rooms get a folder.

**The house room has no join code**, so `/play` with nothing after it still
works — which is what every printed card, every bookmark and every QR scanned
at a gig says. Nothing had to be reprinted. Other rooms are `/play?g=CODE`, and
a phone REMEMBERS the code next to its player id, for the same reason it
remembers the id: a locked phone that comes back must land in the same game
rather than somewhere else with no score.

Codes leave out vowels and O/0/I/1/L — no code can spell a word, and none of
the pairs people mistype off a projector are in it. A code that does not match
finds **nothing**, never a near miss: sending somebody into the wrong
quizmaster's game is far worse than telling them to look again.

**Still shared on purpose:** the pack library and the portrait library. The
owner writes the quizzes and sells them; a quizmaster plays them and never
generates. One library read by everybody IS the product. Whether you may EDIT
one is a `plans.js` question, not a rooms question. Saving a pack reloads it in
**every** room playing it (`reloadPackEverywhere`) — missing one would leave
that quizmaster running the version from before the edit.

### What this does NOT do yet

- **The invoice book is still SHARED between quizmasters.** It does survive a
  deploy now (see below), but Rob would see Mark's customers. Nobody has the
  admin add-on yet, so nothing is exposed today — but scope it before anybody
  does.
- **Past nights and the archive are shared.**
- **Advert slides are shared.**
- Nothing stops two quizmasters launching the same pack at once, which is fine
  and probably useful.

---

## Invoicing

`src/invoices.js` (what an invoice is), `src/invoice-pdf.js` (what it looks
like) and `src/pdf.js` (a small dependency-free PDF writer, written out for the
same reason `qrcode.js` was). Split three ways so changing the look can never
change the arithmetic, which is the only part a customer argues about.

**Three rules, all of them about not being embarrassed by somebody about to pay
you:**

1. **Money is integer pence, never a float.** Pounds exist only where a human
   types or reads a number. There is a test named after 0.1 + 0.2.
2. **An issued invoice never changes.** It carries its own copy of your details,
   the customer's details, the VAT position, the terms and the bank details, so
   correcting your address next month does not rewrite what somebody was sent in
   August. Only the status moves. Registering for VAT does not add a VAT line to
   last year's invoices, and there is a test for that.
3. **Numbers are sequential and never reused.** A number is handed out when an
   invoice is ISSUED, never when a draft is started, so an abandoned draft
   leaves no hole. Cancelling keeps the number and the record rather than
   deleting it — a missing number is a question you have to answer later.

**VAT is off, and while it is off the invoice does not contain the word.**
Charging VAT, or looking like you are, when you are not registered is an
offence. The fields all exist behind `settings.vat.registered`. The host is not
registered and does not know whether he will be; this is the ground prepared,
not a feature waiting to be switched on for fun.

**It backs up to the PRIVATE repo, never the main one.** The main repo is
public and this file has customer addresses and the host's own sort code and
account number in it. `putFile(..., 'private')` — the same repo as the photos,
under a second name, because one private repo is easier to explain than two.
Without it configured an invoice survives until the next deploy, so the tab says
so in red. That warning is the same shape as the song history's and exists for
the same reason.

**Sending is the phone's own share sheet, not the app emailing.** It goes out
from the host's address, so replies reach him and it does not land in spam
addressed from nobody. On a laptop there is no share sheet, so it opens the PDF
and a pre-written email draft instead. The app's job is the RECORD — who was
invoiced, who has paid — which it keeps whether the sending happened here or
not. Do not add an email service without asking: it costs money, needs an
account, and sends from an address nobody replies to.

**Dates are formatted in Europe/London and assembled by hand.** A quiz that ends
at half past midnight in August is 23:30 the previous day in UTC, which is what
the server's clock says — and the invoice has to agree with the person who ran
the quiz. The pieces come from `formatToParts` rather than `toLocaleDateString`
so punctuation cannot change under a different ICU build. Same reasoning for the
thousands separator in `formatPence`.

**A charge with no description is refused.** It is the one line that gets an
invoice queried. A £0 line that explains itself ("Prizes — included") is fine.

---

## How many people can play

**Say 300. That is the documented number and it is deliberately below what the
app can do**, because the host has never seen a room bigger than that and a
promise you cannot keep on a Wednesday is worth less than one you can.

The measured cost of one state push — a payload built and sent to every
connected phone — after the fan-out fix:

| Phones | One push | A whole 20-second question, worst case | Data |
|---|---|---|---|
| 100 | 0.6 ms | 0.1 s of CPU | 8 MB |
| 200 | 1.1 ms | 0.2 s | 32 MB |
| 400 | 1.9 ms | 0.8 s | 128 MB |

**It grows in a straight line now. It used to grow with the square of the
crowd** — `playerView()` sorted the entire room from scratch to find one
player's position, so two hundred phones meant two hundred sorts of two hundred
people for a single answer landing, and the number of pushes grew with the room
as well. 200 phones was 11.5ms a push, of which 7.3ms was that. See
`leaderboard()` in `src/engine.js`: the board is worked out once per change and
thrown away by `changed()`.

**The next ceiling is the state file, and it is a long way off.** The whole
live state is one JSON object rewritten as the night goes on. A 20-question
round leaves 0.9 MB at 200 players, 4.3 MB at 1000 — and at 1000 it takes 33ms
to serialise, several times a second. If a room that size ever turns up, that
is the thing to fix (write what changed rather than the lot), not the fan-out.

**What actually goes wrong in a big room is not capacity.** It is a corporate
proxy holding the event stream in a buffer, which freezes every phone at once.
`X-Accel-Buffering: no` in `src/sse.js` handles the common ones. Test on the
venue's own network days before, never on the night.

---

## Checks

```bash
npm test        # 494 tests, no network, injected clocks — must stay green
npm start       # then /console?key=... from the printed log
node scripts/shots.mjs --key KEY       # screenshots of a whole quiz
node scripts/shot-bingo.mjs            # bingo, incl. the card-reload check
```

Beyond the unit tests, these were run by hand and are worth repeating after
anything structural:

- 60 phones with live SSE connections all answering at once
- `SIGKILL` mid-quiz and mid-bingo, checking the right question/track and all
  scores, cards and marks come back
- QR output decoded with a real scanner (OpenCV) across versions 1–10

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

All five build stages plus bingo, the console, generation, pack import, the
tickable review flags, the alphabet round, per-type question counts and the
picture round's four reveals, invoicing, the seasonal looks and the accounts
foundation are done and tested. Since then: the photo props, the big photo
moment, the double-tap and early-reveal guards, the shared portrait library
with its style and quality settings, the leaving-the-app note, and the fastest
finger's face on the reveal, and **a room per quizmaster** — so a second login
is now safe to hand out. All on **`MusicQuizApp`**. 494 tests green.

**A second quizmaster CAN now be given a login.** They get their own running
game, their own join code, their own photo wall and read-only access to the
pack library. Still shared, and still to do: the invoice book (which also does
not survive a deploy yet), the night archive and the advert slides. See "A room
per quizmaster" above.

**Nobody has actually made an account yet.** He started on his phone, got as far
as the console asking for a host key, and stopped to do it on the MacBook. Three
things have to happen in this order, and they are the first thing in TODO.md:
set `HOST_KEY` on Render (or he is locked out again after the next deploy), set
up the private repo (or the accounts are wiped by it), then make the owner
account from the Console panel and add quizmasters for himself and Rob. Until
then the host key is the only way in, and it still works.

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

Next things to try, in order:

1. **Re-run `npm run spotify:login`** and replace only `SPOTIFY_REFRESH_TOKEN`
   on Render. A Spotify grant is per app-and-user, and his was authorised
   *before* the account was added to User Management.
2. **Check the dashboard is logged in as the same account that authorised**
   (`djmarkstar`). An app owned by a different account is the obvious mismatch.
3. **Check the User Management email matches** the one on that Spotify account
   exactly. A near-miss silently does nothing.

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

### Asked for, not built yet

In the host's own order of interest:

1. **Getting the photos off after a night.** The only thing that leaves a
   shipped feature incomplete — they sit in `data/photos/`, which is wiped on
   every restart, and there is no way to download them.

   What he actually wants: a **Photos tab in the console, foldered by night**,
   where he bins the duds and shares the rest to Instagram — without tapping
   each one and without them going near an inbox. KaraFun emails him and he
   finds that clunky.

   Two things settle the design:
   - **`navigator.share({ files })`** puts Instagram in the native share sheet
     straight from the console on his phone, so nothing has to touch the camera
     roll. Test on his actual phone before promising multi-image.
   - **The photos repo cannot be this one — it is PUBLIC** (checked). Pictures
     of the public, kept in git history forever, is not acceptable. A separate
     **private** repo would work, is free and persistent, and reuses the token
     he already has. The alternative is a Render persistent disk, which needs
     the paid instance. His call.
2. **Draggable stickers — dog ears, clown noses.** Settled: he asked whether
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
3. **Team play — several phones, one team, scores AVERAGED across members.**
   His idea, and a good one: averaging means a big team of chancers cannot beat
   a small team who know their stuff, and it makes a traditional pub quiz work
   without pens and paper. He wants it built even though he will not use it
   immediately.
4. **Instagram posting.** The point is *proving his quiz nights are popular* —
   visual evidence, not automation for its own sake. Full auto-posting needs an
   Instagram Business account, a linked Facebook Page and Meta app review; tell
   him that before building anything that pretends otherwise.
5. **Advertising slides between rounds.** Upgraded by him from "later" to a
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

**Payments stay processor-agnostic**: the app stores a customer id and a status
and listens for a webhook, nothing more, so Stripe / PayPal / a merchant of
record can be swapped without a redesign. Card details must never reach this
server.

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

Deliberately not built: **venue branding** beyond `BRAND_NAME`, and
**Instagram follow-for-points** (no API can verify a follow — he agreed to drop
it rather than fake it).
