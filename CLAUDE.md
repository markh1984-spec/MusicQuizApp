# Project notes for Claude

Read this before changing anything. It records what this is, the rules that
must not be broken, and the decisions already made — so a fresh session does
not undo work by accident or re-ask settled questions.

**Keep this file current.** When you make a decision that a future session
would need to know, add it here in the same turn.

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
| **"Filters" means PROPS, and the colour grading is GONE** | `public/assets/stickers.js` — sixty-odd of them now, drawn like the seasonal motifs and for the same reason. The host asked for "clown noses, dog ears etc." and found colour grading, which is what `filters.js` does; that was folded away behind "Change the colour instead" and is now **deleted from the panel entirely** — *"I want funny props to be the focus"*. `drawFiltered(…, 'none')` stays as the DRAW path, because it is the one place the sizing is worked out and the preview and the upload go through it so they cannot drift. **No face detection anywhere**: a model is megabytes on a stranger's phone over pub wifi and `FaceDetector` does not exist on iOS Safari — both break *no dependencies* and both fail on somebody's handset in a room. **A prop is dragged off its tile after a short HOLD** (`HOLD_MS`, 200ms), not immediately: dragging straight away was asked for and built, and it took the SCROLL with it — the tray is three dozen tiles, so almost everything under the thumb was a tile and there was nothing left to scroll the sheet with. `touch-action: pan-y` keeps vertical scrolling; a flick scrolls, a hold lifts, a tap centres. Move/up listen on the WINDOW so one gesture crosses two elements. **Double-tap a prop to delete it** (`DOUBLE_TAP_MS`), and **the bin is gone** — it lived bottom right, which the square 1:1 crop turned into a corner people want to put things in, and it only ever removed what was in the air. Undo still takes off the last one added; it used to say "Take it off", which was a lie the moment there were two. Positions are stored as a **fraction** of the canvas, never pixels. Tiles are mid-grey on a GRADIENT (half the props are nearly black, and a flat tile can be matched exactly by a flat prop — the viking helmet vanished into it) and **named as well as drawn** — unlike the colour looks, which were shown rather than named because a name told you nothing; at 50px a monobrow and a moustache are the same dark smear. **Send it up sits under the PHOTO**, above the tray: last on the sheet it meant scrolling back past three dozen tiles to send, which is the same fault that put the gesture hint above the tray rather than below it. That hint is a 2×2 block of four CHIPS rather than a sentence, so it cannot break "pinch to size and turn" in half — equal columns and equal rows, because sized to their own content the chips came out four different widths and read as four objects rather than one block. It carries its own font size too: `.tiny` has never had one on the phone, so it was coming out as big as the question text. **The heading and the chips are ONE CARD** (`.cam-guide`), tinted in the same gold the heading is written in — apart, the heading was a fifth loose object floating above them. That tint is two pseudo-elements over `var(--gold)` rather than a colour written out, because **every seasonal look redefines `--gold`, eleven times in `style.css`** — a hardcoded gold would be the one thing on a Halloween phone still wearing the ordinary night's palette. **NOT the red-into-orange of the button above it**, which was the other idea and is the same call as Buy in the shop: that gradient is the app's one "press this", and two of them stacked with the lower one doing nothing costs the real button its meaning. The heading is centred on a `1fr auto 1fr` grid rather than an absolutely-placed Undo — absolute collided at 320px once the row lost the card's padding, and a grid moves the words rather than printing one thing on top of another. |
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
| **The name stacks — the possessive above, the app underlining it** | `brandWords()` in `client.js`. "Mark's" small and tilted 5° above **Quizporium** in the account's own gradient, so the app name reads as the thing and whose night it is reads as the label on it. **It splits on the APP NAME, never on the last word** — so `BRAND_NAME="The Crown Quiz League"` stays one line instead of being guessed at and broken in the wrong place. A name that does not end in the app name is not stacked at all. |
| **Native controls are told the page is dark** | `color-scheme: dark` on `:root`. Without it the browser draws tickboxes, radios, scrollbars and the open list of a dropdown for a white page, and they arrive as white slabs — the console's dropdowns were the loudest thing on a pack card, louder than Launch. A `<select>` also gets `appearance: none`, the page's own fill, and a drawn chevron on a gradient block so it reads as part of the app without competing with the button underneath it. |
| **A pack still says `cardSize`** | `cardShape()` reads `cardSize` OR `cardRows`/`cardCols`, so no pack on disk had to be rewritten and an older deploy still reads a newer pack. `shapeFields()` writes both when it is square. |
| **The card is sized from the list, not from a default** | A round of 42 is a 5x5 round. Import always said 4x4, so 42 songs quietly became sixteen squares — a line lands early and most of the round never reaches a card. The dropdown moves itself to the biggest card the pasted list carries and says so, and stops the moment you touch it. `cardSizes` comes from `minimumTracks()` over the library payload so the console keeps no copy of the sum. |
| **Card type scales with the grid** | `.bingo-grid.cols-5` in `style.css`. At the 4x4 sizes, a 5x5 cell clipped "Bootylicious" to "Bootyliciou" — a square you cannot read is a square you cannot mark, and that is somebody missing a full house. Four lines rather than three at 5x5: the words matter more than the tidiness of the grid. Checked down to a 320px iPhone SE, where all 25 now fit without scrolling. |
| **A generated pack keeps its playlist** | `pack.spotifyPlaylist`, surfaced by `listBingoPacks()` and shown as a green Playlist button on the pack card. The link used to appear once in the generator's log and then you had to go and find it in Spotify on the night. |

---

## The design rules, in the host's own words

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

## A launch must say what it is about to destroy

`session.inProgress()` and the 409 on `/api/host/launch`.

`launch()` builds a fresh game unconditionally, and that used to be the whole
story — so two people on one login could end each other's night mid-question:
scores gone, every phone back in a lobby, in front of a paying room, with
nothing anywhere saying why. Reachable today by password sharing, which is
exactly what happens the moment somebody decides three subscriptions are too
many.

**It names what is live rather than refusing.** The first press comes back with
the game, the player count and where it has got to — *"The Madonna Quiz is
running right now — 3 playing, Round One — question 1 of 10"* — and a second,
deliberate press carries `replace` and goes through. There are real reasons to
launch over a live game (the wrong pack went up; the night genuinely restarts),
and a control that simply says no is the mistake this file keeps recording.

**ANY joined player counts, lobby or not.** The obvious version guards a game
past the lobby, but forty people who have typed a team name have something to
lose too, and "everybody type your name in again" is not a thing anybody says
on a mic. Nobody joined means nothing to protect, which leaves the ordinary
case — wrong pack up, launch again ten seconds later — completely alone.

**The console had a check and it was blind to the case that matters.** It read
`library.running`, a snapshot taken when the page loaded, so a console opened
before the other device launched reported nothing running and went straight
ahead. It is gone; the server's answer is the only one. Same lesson as the tier
lever: a guard that only lives in the browser is decoration.

## Stopping a quiz early

`Engine.finish()` jumps to `PHASES.FINAL` from wherever the quiz is. The Setup
panel — with "Clear everything" — only appears in the lobby and at the end, so
before this there was no way to end a night early except pressing onwards
through every remaining question.

It keeps every score and clears the scoreboard and advert flags, and `back()`
from FINAL returns to the round board — so a mis-tap on the host's phone is one
press to undo. That is why it is not a reset.

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

### Not asking the same thing twice, across the catalogue

`src/question-history.js`. The bingo side has had this from the beginning —
`history.js` remembers every track and refuses it for three months. Quizzes
never got the equivalent, and the gap was invisible at seven packs:
`questionKey()` dedupes within one generation run and each round is told what
the earlier rounds wrote, but pack twenty had no idea what was in packs one to
nineteen. Two eighties quizzes six months apart could share half a dozen
answers, and the first anybody hears is a regular saying "we had this one".

**IT KEYS ON THE ANSWER, NOT THE WORDING, and that is the whole design.** A
bingo track is a `{title, artist}` pair so matching the words works. A question
is prose, and these are the same question:

> *"Who had a number one with Flowers in 2023?"*
> *"Which Miley Cyrus single topped the charts that year?"*

Almost no shared words. Any text comparison finds nothing. The answer is the
stable part — and it is what the room experiences: somebody who heard "Miley
Cyrus" last month feels the repeat however it was phrased.

**There is no history FILE, deliberately.** The bingo one exists because Claude
in a browser reads it before curating, and because a curated round can be
binned before it becomes a pack — so "what was used" is not something the packs
can tell you. Quizzes have neither problem: the catalogue is on disk, so **the
packs ARE the record.** No file to keep in sync, no backfill, no backup, and a
deleted pack stops blocking its own answers the moment it goes.

**The CATALOGUE only**, which falls out rather than needing a check: generating
is the owner's, and the owner cannot read a quizmaster's own packs.

Four details that are each there for a reason:

- **A window, not forever** (six months). On the thirtieth pack every common
  answer would be used and there would be nothing left to write. Six months is
  roughly how long a venue takes to cycle through a library, which is when a
  repeat is actually noticed.
- **An undated pack counts as RECENT.** It is almost always an OLD one, from
  before `createdAt` existed — so treating it as expired would quietly unblock
  exactly the answers most likely to have been heard. Blocking is the cheap
  mistake: the generator over-asks, so a wrongly withheld answer costs nothing.
- **Dropped BEFORE the checker sees it.** The check is the most expensive call
  in the job and a doomed question is the worst place to spend one. There is a
  test.
- **The writer is told as well, but that is not the guarantee.** It stops the
  over-ask being wasted; the mechanical filter is what actually holds, because
  a model asked not to repeat itself will do it now and again and the failure
  is silent.

A pick-them-all question counts EVERY right option, not just the first —
otherwise a later question could reuse one of them unnoticed.

### A question that goes out of date on its own

`ages-out` in `reviewWarnings()`. "How old is Harry Styles" is right for a year
and wrong for ever after; so is "their most recent studio album", which the
host's own Metallica pack contains and which breaks the day Metallica release
another one. Unlike every other fault in that file, this one **gets worse while
nobody is looking**, and a pack is written once and then run for months and sold
on.

**Most of it is visible in the WORDING, so it is caught mechanically and free.**
Two lists, and the split between them is the whole design:

- **Now-words** (`currently`, `as of`, `to date`, `the latest`, `most recent`…)
  are checked in the question AND in the fact read out afterwards, because a
  note saying "as of 2019 it had sold 3.8 million" is read aloud and can be
  wrong.
- **Moving records** (`of all time`, `how old`, `still`, `highest-grossing`,
  `youngest ever`…) are checked in the QUESTION ONLY. In the fact afterwards
  they are almost always historical — "one of the highest-grossing tours of that
  year" is pinned to that year and cannot age. That was the single false alarm
  in ninety questions of the real library, and it is exactly the kind that
  teaches a host to skip the whole panel.

Two of ninety flagged, both genuine. That ratio is the point.

**The monthly AI pass is the other half and is NOT built.** Written up in
TODO.md. The important part of the design is that it runs *after* this one, on
the questions this cannot see — a fact that has quietly changed with no
tell-tale wording, like a band member leaving. Doing it the other way round
means paying a model to re-read ninety settled questions every month.

### The answers are evened out before a pack is ever saved

`balanceAnswers()` in `public/assets/balance.js`, called by
`generateQuizPack()` just before the file is written.

**A lean is never a judgement call, so it is not a decision to put in front of
anybody.** The model writes the true statement first and the decoys after it,
so a generated quiz lands on A far more often than it should. That used to be a
warning on the read-through with a button beside it — which meant the host
pressing a button to fix a fault the app had just created. Doing it at
generation is the same work with the step taken out.

Two things this must not break, both pinned by tests:

- **The picture round's portrait follows the ANSWER TEXT, not the position**
  (`portraitPath(q.options[q.correctIndex])` is worked out before the deal), so
  moving a right answer to another letter cannot show somebody else's face.
- **An alphabet question has no options in the pack at all** — the letters are
  put back by `optionsFor()` — so there is nothing to deal and it is skipped
  rather than handed an empty array.

### The button is still there, for the packs this cannot reach

The read-through said "answers land A×15 B×10 C×5 D×1 — lopsided" and then
left you looking at it: the only way to move an answer was the editor, four
options at a time, twenty times. **Even out the answers** is on the end of
that same line. It stays because a generated pack is not the only kind there
is — anything imported, anything written by hand and anything made before this
still leans — and because a second press deals them again if you do not like
what you are looking at.

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

## Past gigs — the record of somebody's work, and who may take it away

`src/past-gigs.js`, the `/api/past-gigs` routes, and the **Past gigs** tab on
the console. Every night already run: the date, what was played, how many were
in, who won, and the photographs from it.

**It is a record of somebody's WORK rather than a feature of the game**, which
is the host's own framing: a quizmaster pitching for a Thursday at a new venue
gets asked what they have done, and one page with two years of nights, the
packs and the pictures answers it. Both halves were already being written down
— the archive when a game ends, the photos as they arrive — and neither was
being shown to anybody. The tab that existed was "Past nights", a list of
titles, gated on the invoicing add-on because that is where it happened to
live.

### Neither half survived a deploy, and that was the real job

Found before building any of it, and it is the reason the page is worth
anything: **the night archive and the photo files both live in `data/`**, which
on a host with no permanent disk is empty again after every push. A Past gigs
page built on top of that would have gone blank every time the app was
deployed, which on the one feature whose point is "here is my history" is worse
than not having it.

So, before the page:

- **The archive backs up to the private repo** (`archive.json` for the house,
  `archive-<roomId>.json` for everybody else) and is restored **only into an
  empty folder** — the same rule as the accounts, the invoice book and the play
  counts, because a disk that already has nights on it is ahead of any backup.
  A night in a backup whose id is not plain letters, digits and hyphens is
  **refused rather than scrubbed**: stripping the bad characters out would
  quietly invent a filename rather than saying no to something that has no
  business being in a backup.
- **A room TELLS somebody a night has been filed** — `onArchive`, defaulting to
  nothing, exactly like `onSpend` on the generators. `session.js` has no
  business knowing that GitHub exists, and every test and script that builds a
  Session carries on working.
- **Photos are read from the REPOSITORY, never from the disk**, and served back
  through this server because that repo is private and a browser cannot fetch
  from it. Listing the folders in it is what the night list is made of, so
  there is no photo index to keep in sync — the same reasoning that makes the
  packs the record for `question-history.js`.

### They are foldered per ROOM now, and were not

`photos/<roomId>/<night>/<file>`. **The house keeps the flat `photos/<night>/`
it has always used**, for the same reason every other house path is unchanged:
Mark already has nights filed under it and moving them would make his own
history disappear off the page that exists to show it. Without the room in the
path two quizmasters' nights land in one folder — on the one feature whose
whole point is "this is my work", showing somebody else's pictures is about as
wrong as it gets.

### Looking is Bronze. Getting them OUT is the owner's

Asked for explicitly: *"I only want the photos export feature on my account
please, perhaps in future if I want features that only I use put them in the
owner console and not the QM console."*

So the Photos tab — file the lot away, bin the duds, hand them to the phone's
share sheet — **moved off the console and onto `/owner`**, as
`public/assets/photos-tab.js` and `FEATURES.PHOTO_EXPORT`, which is owner-only
and therefore deliberately not on the ladder. What a quizmaster gets instead is
Past gigs, **read only**: no bin, no download, no share sheet.

Two things that makes true, and neither is a compromise:

- **A quizmaster loses nothing operationally.** The kill switch and the
  per-photo bin are on the CONTROL VIEW, which is where they are wanted — with
  a mic in one hand, while the thing is on the projector. A page is the wrong
  place for that and always was.
- **Filing still happens for everybody.** A photo is pushed to the repo as it
  arrives, and `photosFile` (the retry, for when GitHub was having a bad
  evening) is still a host action. If it were the owner's, every subscriber's
  past gigs would be empty.

Be honest about what read-only means: there is no bin and no share button, and
a browser can still save an image. The point is that this is a shelf to look
along rather than an export tool, not that the pixels are locked up.

**`FEATURES.PAST_GIGS` is Bronze**, and the second reason matters as much as
the per-use rule: this is what a quizmaster shows a venue they are pitching to,
and withholding the evidence that somebody is good at their job from the rung
where they are still building the business is the wrong way round.

**The owner holds `PAST_GIGS` too** — listed in `OWNER_FEATURES`, not special
cased in `allowed()`. The owner runs gigs, on the host key, in the house room,
so the record of them is theirs to read. That is the sixth-time trap avoided
rather than hit: an owner holds no quiz features by design, so anything reached
from the owner's own page must be on that list or it 403s.

### Two smaller things it turned up

- **`[hidden]` did not hide.** `.minor { display: inline-block }` beats the
  browser's own `[hidden] { display: none }` on specificity, so "File the rest
  away" and "Clear all" sat there on a night with no photos at all, and both
  would have failed if pressed. One `[hidden] { display: none !important }` at
  the top of the stylesheet rather than remembering it at every call site.
- **`GET /api/archive/<id>` passed `err.message` through on a miss**, which is
  an ENOENT carrying the server's absolute path — naming the directory layout
  and the room id it had just looked in. The same fault this file already
  records for the advert sets and `GET /api/quiz/<id>`, in a third place.

**The tab badge counts NIGHTS, not games.** A quiz and the bingo after it are
one evening's work, so counting games put a 5 on the tab above a list of four
rows. Worked out on the server (`archiveNights`) with the same 6am roll-over
the page uses — and the roll-over has to match the photos' own, or a gig that
finished at half past midnight appears twice: the games under one date and all
the pictures under another.

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

### ONE style, and that is a measured result

`STYLES`: **Cartoon**, and nothing else. The host's choice always beats
whatever Claude wrote, or choosing a style would silently do nothing on the
many questions where the generator wrote a prompt of its own, and would read as
a broken setting.

**Two of the three styles written have been refused by the supplier.**
`portrait` (painted, true to life) and `As a superhero` both came back with
*"the model could not generate the image based on the prompt provided"* in
Google's own playground. Putting a real musician into an invented costume is
apparently a step past a caricature of them, whatever register the words are
in. Both were deleted rather than reworded, on the host's own rule: do not ship
a setting that pretends we can do something we cannot.

So **adding a style is a line in the file and a minute in the playground
FIRST**, and the hit rate so far is one in three. Candidates worth trying, all
of which keep the person looking as they actually look: pop-art halftone,
black-and-white comic inking, cut-paper collage, 8-bit pixel art.

**Every style is a whole second library of the same people**, so five styles is
five times the bill for the same musicians — which hands straight back what
sharing just saved. Adding one is a line in that file; do it because a night
needs it, not for the sake of choice. `--<style>` is the filename suffix and
the default has none, so a library built before styles existed still fits.

**There is no photoreal option on purpose, and that is a legal decision.** The
on-screen caption "AI-generated illustration — not a real photograph" is doing
real work: UK fair dealing is a closed list and does not cover commercial
entertainment, so a convincing fake photograph of a real living musician in a
pack that is SOLD is the one version worth not having. `promptFor()` rules out
a photograph whatever the style says, and there is a test that every style
does. There is also a test that no style id contains "photo" or "real".

**There used to be a third, `portrait` — painted, true to life, and the
DEFAULT — and it is gone because the supplier will not draw it.** Tested by
hand in Google's own playground: *"do me a Michael Jackson cartoon"* is drawn,
and asking for an *illustration* of the same person is refused. The line is how
real the picture is trying to look, not who is in it. The host's call was:
**if we cannot do the realistic end, do not ship a setting that pretends we
can** — so it was deleted rather than reworded, and every remaining style is in
the cartoon register.

**And the refused word was in the prompt EVERY style sends.** `promptFor()`
appended *"It must clearly be an illustration and not a photograph"* — so all
three would have been refused, on every question, and from the console that
looks exactly like a bad key. It now says "It is a cartoon drawing, not a
photograph": same guarantee, and it leads with what IS wanted rather than with
what is not. There is a test that no prompt contains the word "illustration"
and that every one says "cartoon".

**Adding a style is a line in the file and a minute in the playground FIRST.**
A style that gets refused is a control that does nothing, which is the fault
this file keeps recording. Candidates worth trying, roughly in order of how
likely they are to be allowed: pop-art halftone, black-and-white comic inking,
cut-paper collage, 8-bit pixel art.

### Moving the default style was free exactly once

The default has no filename suffix — `portraits/madonna.png` — so changing
which style is the default silently changes what every unsuffixed file MEANS.
`images/portraits/` was empty when this happened (there has never been an image
key on this app), so there was nothing to rename and nothing to orphan.

Do it after a library exists and every painted picture quietly becomes "the
cartoon of that person", while every `--cartoon` file already on disk is
orphaned and paid for twice. **If the default ever moves again it is a rename
job, not a one-word edit.**

### The picture round runs on GOOGLE

`src/generate-images.js`. Imagen 4 on `GOOGLE_API_KEY`, via the plain Gemini
API. The host's OpenAI account was deactivated with no route back, and
Anthropic has no image API — so this is the only working supplier, not a
preference. The OpenAI code stays because it works and costs nothing to keep.

**The AI Studio door rather than Vertex AI, and that is the no-dependencies
rule deciding it.** Vertex authenticates with a service-account JWT that has to
be signed and refreshed hourly; this is one header on one POST. Same models,
same prices, same Google Cloud project, a tenth of the code.

**Nobody picks a supplier on a button.** `artProvider()` returns whichever key
is set, cheapest first, and the console has one "Make real portraits" press.
The console used to send the literal string `"openai"` in the request body — a
request body choosing who gets billed, which is the same shape of hole
`POST /api/quiz` had, and it would have gone on calling a dead account after
the switch. The server works it out now and the old value still maps through,
so a stale page in somebody's tab keeps working.

**Imagen's three tiers ARE the quality setting.** Fast, Standard and Ultra
against low, medium and high — so there was no second control to build and no
new word for the host to learn. About 2p, 4p and 5p a picture, so a ten-picture
round is 16p to 50p.

Two request fields are load-bearing and neither is obvious:

- **`personGeneration: 'allow_adult'`.** Left unset it defaults to blocking
  people — and the round is "whose face is this", so every picture would come
  back refused and it would read as a bad key.
- **`includeRaiReason: true`.** Without it a refusal arrives as an empty
  prediction list, indistinguishable from a network problem. With it the reason
  is said in words and the message adds "try a different style", because a
  refusal is nearly always the STYLE and that is only obvious if somebody says
  so. Same rule as the Spotify 403.

**None of it could be checked from the container it was written in** — the
egress policy blocks Google — so the request shape is pinned against a stubbed
`fetch` instead: the model per quality, the header, both parameters above, and
that a refusal is reported per question while the rest of the round carries on.

### The prices were three times too high, and it was Claude's row

`PRICES.claude['claude-opus-5']` said `{ in: 1.2, out: 6.0 }` per 1,000 tokens,
which is a $15/$75 model. Opus 5 is $5/$25, so at the 80p-to-the-dollar rate
every other row in that table already used, it is `{ in: 0.4, out: 2.0 }`.

**Every Claude figure the Money tab ever showed was inflated by three**,
including the "about £2 a topical pack" the tier arithmetic was sanity-checked
against — the real number is nearer 70p. Rows already written keep their stored
pence, which is the point of storing them, so the history stays true to what
was reported at the time.

The image prices are **per supplier** now, because Imagen and gpt-image-1 are
nothing like each other at the top of the range (5p against 14p) and one table
would have reported whichever supplier you were not using. Note it is not
"Google is cheaper everywhere" — gpt-image-1's bottom tier is genuinely under
Imagen Fast — and there is a test that says so, because the first version of it
asserted the tidier thing and was wrong.

**The console had its own copy of the price table**, which is exactly the drift
the ledger's own comment says it prevents. The prices come down with the
payload now.

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

**Matched on identity, never on the name.** Two teams picking the same name is
a thing that happens — there is deliberately no name filter — and the wrong
person's photograph six feet wide is not a small mistake.

**The handle is `faceKey`, NOT the player id, and that is a security fix rather
than a naming preference.** A PLAYER ID IS A BEARER CREDENTIAL: there is no
login for a phone, so holding the id is enough to answer as that player —
locking out their real answer with a deliberately wrong one — and to rename
them to anything on the projector by rejoining with it. The join code is
printed on the big screen and read out on the mic, so
`/api/state?role=screen&g=CODE` is a payload anybody in the room can fetch, and
it used to carry the fastest finger's real id. **The person WINNING was the
person the back table could sabotage.** Found by joining a game as two phones
and playing one against the other.

`faceKey()` in `engine.js` derives a stable handle one way from the id: the
same player always gives the same key, a photo still finds its person, and the
key gives nothing back. The host view keeps the real id, because removing or
renaming somebody needs it and the control view is not public. There is a test
that no screen or player payload contains a player id at all.

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
known one at 4s; **phones never showing the question text** (rule 8), so it has
to be retyped from memory off the projector; and the picture, intro and
pick-them-all rounds being poor search targets.

---

## Things the host does not have, and what that blocks

- **Round 2 portraits are on GOOGLE now, not OpenAI.** Anthropic has no image
  API, so a Claude key cannot make them. OpenAI was the plan for months and
  then **the host's OpenAI account was deactivated**, with no route back — so
  the provider is Imagen 4 on `GOOGLE_API_KEY`, and the OpenAI code stays only
  because it costs nothing to keep. See **The picture round runs on Google**
  below. Round 2 is placeholder art until the key is on Render.
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

### "Sweep mode" — find everything, change nothing

**If he types `Sweep mode`, run a full sweep and REPORT. Do not action any of
it.** He decides what gets fixed; the output is a list he can work through and
dismiss from.

Three things at once, because they hide in each other:

- **Contradictions** — the docs against the code, and the code against itself.
  A rule stated in CLAUDE.md that the code no longer honours is the one that
  costs a future session a day.
- **Bugs** — including ones only reachable in a state nobody tests: mid-round, a
  redeploy, a lapsed subscription, a second login.
- **Vulnerabilities** — from BOTH sides. Signed in as a quizmaster reaching for
  what is the owner's, and the owner reaching into what is a quizmaster's. The
  second is the gate that runs backwards and is easy to forget.

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
src/reports.js         "that one's wrong" — corrections from a night
src/adverts.js         venue advertising slides, per venue
src/generate-images.js round 2 artwork (placeholder or OpenAI)
src/portraits.js       the shared portrait library: one picture per musician
src/branding.js        "Mark's Quizporium" — the app name and whose night it is
src/gates.js           which routes are the owner's, as two testable lists
src/own-packs.js       a quizmaster's own packs — theirs, and private from the owner
src/spend.js           what Claude and OpenAI have actually cost, written down as it happens
public/                the screens; *-bingo.js files hold the bingo variants
  assets/brandmark.js  the question-in-a-mic logo, shared with the server as the favicon
  assets/avatar.js     a drawn face per team, for anyone who sent no photo
  assets/stickers.js   props to drag onto a photo: dog ears, a clown nose
  assets/schemes.js    a quizmaster's own two colours, shared with the server
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

## My account — and the line that page is built along

A tab on the console: your name, your colours, what you are subscribed to,
which tabs you want on screen, and links to everything else. It exists because
those were scattered — the colour picker sat at the bottom of every tab, and
the join link, the big screen and the control view were on three different
panels.

### The ladder is CAPEX AND OPEX, not a pack count

Settled after measuring what a pack actually costs, and it is the host's own
observation: the one-off packs and the topical ones **are different animals**.

- An **evergreen pack is an ASSET.** About £1.90 of API to write, once, and
  then it sells to every subscriber for ever. How much of that library somebody
  gets is a fair thing to meter, because the pile is finite and writing more is
  optional.
- A **topical pack is a SERVICE.** "The month just gone" has to be written every
  week or it is not topical — the **only recurring cost in the whole product**,
  about £18 a month for the two of them, for as long as anybody holds the tier.
  It is also the one thing that cannot be bought once and reused, which is what
  makes it the strongest subscription argument there is.

So: **the evergreen catalogue is the Bronze-to-Silver axis, and topical is what
Gold IS.** `TIER_PACKS.silver` is `'evergreen'`, `gold` is `'all'`.

**The gradient is arithmetic rather than a judgement call**, and there is a test
that it holds:

| | | |
|---|---|---|
| Bronze £10 + four topical at £3 | £22 | Gold is £8 more and adds the whole catalogue — a step, not a cliff |
| Silver £20 + four topical at £3 | **£32** | **more than Gold**, so a Silver subscriber who wants topical weekly has an unambiguous reason to climb |
| Gold £30 | | covers the whole weekly programme on its own |

**It is a FIXED cost, not a per-use one, and that is why the house rule does not
reach it.** A topical pack costs the same whether one subscriber runs it or a
hundred do, because generating is per-WRITE and not per-play. **One Gold
subscriber pays for the entire weekly programme** and every one after that is
nearly all margin.

**What this commits the owner to is a WEEKLY DEADLINE, not money.** The writing
is a button press and about £2; the read-through is twenty minutes, every week,
for as long as one Gold subscription exists. Miss a week and a Gold subscriber
notices immediately. That is this codebase's first rule pointed at the business
rather than at the app, and it is the one part of the arrangement that cannot be
undone by editing a line in `plans.js`.

**A dated pack is told apart by its `freshUntil`, never by its id.** A topical
pack is named after the day it was written, so a gate reading the name would
work today and open the moment somebody renamed one. `isTopical()` and
`packFilter()` in `plans.js`.

### The ladder: Bronze, Silver, Gold, and they STACK

`TIERS` in `plans.js`. Gold includes Silver includes Bronze — one ordered list
with a `rank`, and **`rank` is what the code compares, never the label and never
the price.** Adding a fourth tier is one entry with a rank between two existing
ones and nothing else in the app has to know. `FEATURE_TIER` says which rung
each feature is on.

**The tiers are the structure; where each feature sits is PROVISIONAL** and so
are the prices. Moving one is a one-word edit in `FEATURE_TIER`. What is not
provisional is the rule that decides it, which is the host's own: *anything that
costs the owner money every time it is used is not in Bronze.*

**Owner-only features are deliberately NOT on the ladder at all.** They are not
for sale at any price, so putting one on a rung would be offering to sell it.
There is a test.

The account page draws a section per tier from `ladderFor()`: yours are marked
and switchable, the ones above show their price and have nothing to press —
something you can see and cannot use is a thing you might buy.

**A tab has three states, and telling the last two apart is the point.** On;
above your tier, so greyed with a `+`; or switched off by you, so gone
completely. A `+` on the third would be the shop trying to sell somebody the
thing they just put away.

**Each feature carries the SAME switch as the hat in the top right** — an
On | Off pill, the live half in the app's own red-into-orange. It was a tick
box, which reads as a form you fill in rather than something you operate; one
control shape for "is this on" across the whole app is recognised instead of
read. A feature on a tier ABOVE yours gets the tab bar's `+` in a dashed circle
rather than a switch showing Off: you did not turn it off, you do not have it,
and keeping those apart is the whole point of the three states.

### The upsell lever is CONTENT, not capability

`TIER_PACKS` and `packsFor()` in `plans.js`; `onlyTheirPacks()` and the launch
check in `server.js`.

**Bronze is the whole machine and a starter library.** Every capability you
withhold is something that looks broken in front of a room — and a Bronze host
running a venue's Christmas party is the shop window, so a thinner projector is
the PRODUCT looking cheap rather than the tier looking cheap. It also cuts
against rule one: nothing surprising on a Wednesday night, and a control that
refuses is a small version of exactly that.

Content pressure grows with success instead, which is what makes it implicit: a
host with three quizzes hits the ceiling in month four when the room has heard
them, while doing well, and never mid-question.

So **picture rounds and intro rounds stay in Bronze.** They are what makes a
night feel produced, and crippling the demo is the opposite of an upsell.
Portraits are also the wrong thing to charge for — they are keyed to the
musician and SHARED, so the second eighties pack wanting Madonna costs nothing.
That bill amortises towards zero; pricing it as premium prices a cost that is
disappearing.

**The host has since settled WHY the generator stays owner-only, and it is a
commercial reason rather than only a cost one.** In his words: *"the restriction
from using Claude to generate quizzes is necessary. It's what makes the bronze
buying packs and the silver getting them for free a delineation worth upgrading
for."* So the ladder is meant to read: **Bronze buys packs, Silver gets them
included.** That is a stronger reason than the bill — if a subscriber could
generate, there would be nothing on the ladder worth paying to climb. Do not
propose giving quizmasters the generator as a paid add-on; it is the thing the
tiers are built out of.

Note what it implies and what is NOT built: Bronze buying a pack needs a payment
flow and a purchase record, and there is none — see "Pay-per-pack is deliberately
NOT built" below. The data model is ready for it (`packs` on an account), so this
is a decision waiting on a processor rather than a redesign.

**The lever is switched on now: Bronze is EIGHT PACKS, four quizzes and four
bingo games.** Silver is the whole EVERGREEN catalogue; Gold adds the weekly
topical quizzes on top — see **The ladder is CAPEX AND OPEX** above. A weekly host gets one
to two months out of eight, which is the intended shape — the ceiling arrives
while they are doing well and never mid-question.

**Which eight is deliberate.** The starter set is the packs that work in ANY
room, decades and genres, because a new subscriber has to be able to walk into
any venue with them. The artist packs are held back: those are the ones you
pick for a specific night, which is exactly when somebody will buy one.

**But the eight THEMSELVES need rewriting before anybody pays for them.** The
host's own assessment: the current library was thrown together to have
something to test against, and a starter set is the first thing a paying
subscriber sees — it is the whole impression of what the catalogue is worth. Do
not treat the current ids as settled content. See TODO.md.

It is a list of pack IDS, so a new pack does not join Bronze on its own — that
is the point, because Silver's promise is "and every new one as it is written".
The cost is that **renaming a starter pack silently drops it out of Bronze**, so
change the list in the same breath as a rename. There is a test that every id in
it is really in the catalogue.

### Topical packs: a DATE, not a second class of pack

Rounds tied to a week — "the week that just went past" — alongside the
evergreen catalogue. `freshness()` in `quizzes.js`, and the same shape read in
the browser by `console.js` to sort and label.

**They are the same price, and the reason is that a topical pack is worth MORE
in its week, not less.** Pricing it lower would say the opposite of what is
true. And its real job is not to be a cheap line in the shop: writing one every
week is the strongest argument for a subscription there is, because it is the
one thing that cannot be bought once and reused. A weekly host buying them at
£3 spends £12 a month on top of Bronze, against £20 for Silver — so topical
content pushes people up the ladder **weekly**, rather than in month four when
the starter set runs dry. That is the pressure arriving more often and more
gently, which is the whole design.

**It is `freshUntil`, a DATE — not `topical: true`.** A boolean says a pack is
dated but not whether it is STALE, and stale is the only part anybody needs
telling about. So:

- the console sorts fresh ones to the top and expired ones to the bottom,
  **without hiding them** — a pack that vanished reads as lost work, and last
  month's news round is a fine thing to run on purpose;
- launching an expired one **warns and does not refuse**. A control that
  refuses in front of a room is the mistake this codebase keeps recording;
- **the `ages-out` review flags are switched off for a dated pack.** Every
  question in a news round trips them — "this week", "the latest", "most
  recent" is what a news round is made of — and a review list forty flags long
  is one you stop reading, which would cost you the flags that matter on the
  rounds that are NOT topical. The expiry date is a better warning anyway: it
  says WHEN rather than merely that it might;
- the owner's Catalogue tab drops expired topical packs out of "never played by
  ANYBODY", because a pack that was meant to expire and did is not evidence
  about the writing;
- **a misspelt date is a validation problem**, not something quietly ignored.
  Ignored, a topical pack silently becomes evergreen — no expiry warning AND
  the ages-out flags off, which is the worst of both;
- a pack with no date is evergreen, so **nothing on disk had to change** and
  every pack written before this is already correct.

The reason to build it at all is reliability rather than commerce: a "week that
just went past" quiz run three months late is a quizmaster looking foolish in
front of a paying room, which is the thing `ages-out` in `reviewWarnings()`
already exists to prevent. This is that hazard made deliberate, so it needs the
same care.

### Where a topical pack comes from — the one thing here that reads the web

`src/research.js`, and the **"The month just gone"** button on the console next
to "Write it". Forty questions: **20 general knowledge and 10 music from the
last month, then 10 music from any era.** Named after the date, marked current
for a fortnight.

**ONE digest, read ONCE, given to the WRITER and to the CHECKER.** That is the
load-bearing decision and it has two separate reasons. If the two search
separately they are working from different facts, so the checker rejects true
questions and the log fills with rejections nobody can account for — checking
only means anything against the same evidence the question was written from.
And the checker runs in batches, several at a time, so a search each would read
the same month of news ten times over at 0.8p a search plus every token it
drags in.

**Every line of the digest carries a DATE and a SOURCE**, because the checker's
whole job is "are you sure" and it cannot be sure of a bare assertion.
`tidyDigest()` throws away anything without a date — which also drops the
opening sentence a model that has just done twelve searches cannot resist, and
which would otherwise sit in the cached prefix being paid for over and over.

**The last round is deliberately NOT topical.** A quiz made entirely of the
last month punishes anybody who was on holiday, and the room notices about
question thirty. That round's writer is not given the digest at all — handed
it, it writes about the news anyway and the pack has no ground in it.

**This is the ONE place in the app where a failure refuses the job.** Every
other fallback here leans the other way — a checker that cannot be reached
keeps the questions, because by then the generation is minutes and real money
deep. The research call is the FIRST call, before a penny is spent, and what
carrying on would produce is forty confidently invented current events. There
is nothing to lose by stopping and everything to lose by not.

**`web_search_20260209`, not the older `_20250305`.** The newer one filters
results before they reach the context rather than after, which on "what
happened last month" is the difference between reading the news and reading a
page of search-engine furniture. And the server's own search loop stops after
ten goes and hands back `stop_reason: 'pause_turn'` rather than an answer —
resuming is the same conversation with the assistant's half appended and **no
extra instruction**, because a "continue" message reads as a new request. Not
resuming looks exactly like a quiet month: a short digest and no error.

#### The checker's FIRST batch goes on its own, and that is not a delay

The digest is a couple of thousand tokens sent identically on every batch, so
it is cached — `cache_control: {type: 'ephemeral'}` on a second system block,
after the standing instructions and before the varying prompt, because a
breakpoint covers everything up to and including its own block.

**But concurrent requests cannot share a cache WRITE.** The checker used to
fire every batch at once with `Promise.all`, and under that shape all six
arrive before any of them has finished writing — so all six pay full price for
the same tokens and the cache is written six times over. One batch first,
awaited, then the rest together: they read what it wrote at a tenth of the
price. Without a digest there is nothing worth caching, so nothing is bought by
waiting and the whole lot still goes at once, exactly as before.

A breakpoint is only added when there is enough to be worth one
(`worthCaching()`). Below Anthropic's minimum a cache write is not free — it is
a quarter MORE than cold — so marking a small prompt for caching is a surcharge
on tokens nothing will ever reuse. The digest's position never changes either
way, so the prompt is always the same shape.

**The ledger had to learn three new numbers or none of this would show up.**
`cacheRead`, `cacheWrite` and `searches` in `src/spend.js`. The API reports the
three input counts separately and they do NOT overlap — `input_tokens` is the
uncached remainder — so adding them up and pricing the total as ordinary input
is exactly what would make caching look like it saved nothing, on the one page
whose job is to say what the AI actually costs. Searches get their own line in
the summary because that is the only figure that grows with how TOPICAL the
writing is rather than with how much of it there is.

#### A round can now say what it is about

`roundPlan()` entries carry three optional things, all added for this and all
useful on their own: **`focus`** (what THIS round is about, where the theme is
what the whole pack is about), **`topical`** (write it from the digest), and
**`label`** (what it is called on the projector). Before this a pack could only
be about one subject, so "twenty of the news and ten of music" had no way to be
said. `TOPICAL_ROUNDS` and `topicalNaming()` live in `src/generate-quiz.js`
rather than in the browser, so a curl call and a button press produce the same
pack and there is one thing to test.

Two topical quizzes on one day do not collide — the hard one is
`topical-<date>-hard` — which is exactly what the host asked for: one of
average difficulty and one pitched harder, every week.

**GOLD IS SELLABLE NOW, and this is what changed.** It used to be the
online/streaming tier and nothing else — so a Gold subscription bought Silver at
a £10 markup, which would have been a refund rather than an upsell, and the note
here said it must not be offered. **The weekly topical quiz is what Gold is
now**, it is built and tested, and it is worth more than £10 a month to a weekly
host by a wide margin. Streaming joins Gold when it exists rather than being
what justifies it.

The one honesty requirement: **`FEATURE_META` for streaming says "Not built
yet"**, on the tier's own card, so nobody on Gold is waiting for something that
is not coming this month.

**Usage is deliberately NOT metered, and the reasoning matters because the
obvious objection is a fair one.** A host running twelve nights a month earns
several times what a fortnightly host earns and pays the same. Three reasons to
leave it:

- **Metering is what makes software hateful to run a business on.** A per-night
  charge means a quizmaster doing sums before accepting a booking, which is the
  opposite of this codebase's first rule.
- **The heavy user is the advocate.** They are the reference customer and the
  one who tells other quizmasters about it. Charging them more punishes exactly
  the behaviour the business needs.
- **Scale beats extraction at this size.** A hundred subscribers at £20 is
  better business than thirty at £50 with a meter, and far easier to sell.

Worth knowing what the pack lever does and does not capture: it tracks how much
VARIETY somebody needs, not how many nights they run. A host with three pub
residencies can run one pack at all three, so eight packs lasts them three
months while a one-venue host burns through it in one — the busiest host hits
the ceiling slowest, which is backwards. The play counts are per room and now
survive a deploy, so the honest answer is to WATCH it: if somebody is genuinely
running twenty nights a month, that is a conversation about a multi-venue
arrangement (rooms already exist), not a metered tier.

**There is NO FREE TIER, and that is a structural decision rather than a price
one.** Bronze is £10, Silver £20, Gold £30 — the machine is identical at every
level, so a £0 rung is somebody running paying gigs on it forever. A month on
the house is `status: 'trialing'`, which already exists and is treated as
paying. **Do not add a fourth tier at £0 to get a trial** — that is a permanent
hole in the ladder to solve a temporary problem. There is a test that no rung
is free.

**The trial's shape was settled on 12 August 2026: ONE MONTH, FREE, CARD UP
FRONT.** Not built — it waits on the payment processor like everything else
touching billing — but the mechanism is `status: 'trialing'`, which already
exists, is the default on `accounts.create()` and is already treated as paying
by `can()`. So it stays a STATUS and never becomes a tier.

Three things decided with it, each against a specific alternative:

- **A MONTH, not a week and not three.** The unit of value here is a GIG, not a
  day — a quizmaster runs one or two nights a week, so a seven-day trial can
  contain no night at all if their next booking is on day nine, and they would
  cancel having seen nothing. A month is four nights for a weekly host and two
  for a fortnightly one, which settles it either way. Three months gives away a
  quarter of a year of the catalogue and the topical packs, and somebody not
  convinced by night four will not be by night twelve.
- **FREE with a card, rather than half price.** A card on file does most of what
  a paid trial was for — it filters people who were never going to buy and it
  converts on its own at the end — while keeping *free*, which is the strongest
  word a referrer has when asking a mate for a favour. Half price also anchors
  them low, so the first full bill reads as a price RISE rather than the normal
  price, which is a self-inflicted churn moment.
- **No signup discount on top, for referrals or anything else.** Two overlapping
  offers is two things to explain doing one job, and the trial is the better of
  the two: it proves the app rather than discounting it.

An account-level `packs` list still beats the tier, which is what makes
pay-per-pack a one-line change rather than a redesign.

**`packs` is an ENTITLEMENT, so it is `accounts.update()` and never
`setPrefs()`** — the same wall that stops a preferences payload handing out a
tier. `null` clears it back to the tier; an empty ARRAY means none, and the two
must not be confused. There are tests for both.

**The server filters, not just the console.** A library trimmed only in the
browser is decoration — the tier-preview work already proved how fast a page
and its API drift apart. `/api/host/launch` checks the pack id from the request
body, because that is exactly the shape of the hole `POST /api/quiz` had.

**The account page shows it, as a statement and never a shop.** `libraryPanel()`
in `console.js` — "Quizzes 3 of 7", with the line underneath naming the lowest
tier ABOVE this one that holds the whole catalogue. The ladder below it lists
capabilities, every one of which is already Bronze's, so before this the page
had nothing on it saying what a higher tier would actually get you.

Two things it gets right, both found by looking at it rather than by reasoning:

- **It only names a tier ABOVE the reader's own.** The first version named the
  lowest tier holding everything, which today is Bronze — so a Bronze
  subscriber on a starter list was told "Bronze includes every pack" while
  looking at three of seven. That reads as a fault in their account rather than
  as an offer. If their own tier already holds everything, the limit is an
  explicit list rather than the ladder and it says nothing about tiers at all.
- **It is silent when the whole catalogue is in reach**, which is everybody
  today. A page that congratulates you on owning everything is one you learn to
  skip, and the line has to still be worth reading on the day it changes.

### What a pack costs, and why the number is not about the pack

**A pack is priced to make the UPGRADE obvious, not to make money.** The
recurring subscription is the business; a pack sale is the on-ramp. So the only
question the price has to answer is *at what point should somebody stop buying
and move to Silver*, and that makes it arithmetic rather than a judgement call:

| A pack at | A weekly host (4 a month) pays | vs Silver at £20 |
|---|---|---|
| £2 | £10 + £8 = £18 | Bronze wins — **the ladder does not work** |
| £3 | £10 + £12 = £22 | Silver wins, clearly |
| £5 | £10 + £20 = £30 | Silver wins by a mile, and the pack looks dear |

The floor is £10 ÷ 4 = **£2.50**: below that a weekly host never has a reason
to climb, and the whole Bronze-buys / Silver-includes structure quietly stops
being a ladder. So £2 is the one number in that range that cannot be used.

The ceiling is about how it READS rather than what it is worth. A quizmaster
charges a venue well over £100 a night, so £5 is about 3% of one fee and
objectively trivial — but it is half their monthly subscription for one night's
content, and that ratio is what somebody reacts to. **£3 is the recommendation:
the lowest price that still makes Silver right for a weekly host, and a fifth
rather than a half of the subscription.**

It also lands the fortnightly host in the right place — two packs is £6, so
buying stays cheaper than upgrading, which is correct. They should not be
pushed up a rung they would not use.

**And the IP is not what is being sold.** The packs are AI-written and only run
in this app, so a copied pack is worth nothing to anybody without a
subscription. Two things follow and both save work: **do not build DRM,
per-pack licensing checks or watermarking** — there is nothing to protect and
the effort would be spent defending a thing that cannot be stolen usefully. And
since convenience is the entire product, the price has to be a convenience
price. That argues for the lower number too.

### Rounds are still not sold, and the reason is the build rather than the principle

`£1 for a single round` was raised and is worth holding rather than dropping —
a quizmaster who writes their own packs now has a real use for "I want your
picture round in my quiz".

It is not built, and should not be first. Every pack card, play count, review
flag and launch in this app is per PACK; rounds as products needs a second kind
of object, a way to assemble a night out of bought rounds, and a library to keep
them in. That is a bigger job than the shop itself, and it would be guessing
twice — build the pack shop, then look at what people actually buy. The
arithmetic is also awkward: four rounds at £1 is more than a whole pack at £3,
so the à-la-carte price has to sit above the bundle to make sense, and a
"cheaper" option that is dearer confuses the page.

### The shop — built as a WINDOW, with no money in it

`withShop()` and `mayReadPack()` in `server.js`, `shopCard()` in `console.js`,
`PACK_PENCE` in `plans.js`. A pack outside your library is shown as a dashed
card with its title, its size and £3 on it, and **Buy takes no money and says
so.** It exists so the shop can be LOOKED at before a processor is committed
to: whether it reads as fair or as grabby is a judgement about wording and
layout, and that is far cheaper to change now than after the money is plumbed.

**Building it closed a hole the tier lever had opened, and that is the part
worth remembering.** Launching a pack outside your library was refused from the
day the lever was built — but READING one was not, and a pack read hands over
every question and every answer. So a starter library could have been worked
around by opening the other packs and copying them out. It was invisible for as
long as every tier was `'all'`, which is exactly how this kind of hole survives.
`mayReadPack()` now guards `/api/quiz/<id>`, `/api/bingo/<id>` and
`/api/images/<id>` (that last one reports every question's ANSWER, so it is a
pack read whatever else it is). There is a test naming all three.

**A locked summary is STRIPPED on the server, not hidden in the browser.** A
pack summary carries `search` — every question, answer, artist and track title
blobbed together for the search box — and a bingo summary carries a Spotify
link to the whole track list. A padlock drawn over a payload that still held
either would be decoration. Tested.

**Yours above, the shop below, with a heading between.** One mixed grid was the
first attempt and it is wrong: a padlocked card three rows down among ones you
can launch reads as a fault in your account rather than as a shelf. Separated,
everything you can actually run tonight is above the fold, which is what
somebody opening the console ten minutes before a gig came for.

**The tab badge counts what you can RUN, never the shelf.** "Music Quiz 7" to
somebody holding four reads as a fault rather than as an offer.

**Buy is deliberately not the app's own red-into-orange.** That gradient is
Launch, and one shape and one colour for "start the night" is worth more than a
loud shop.

**Pay-per-pack is deliberately NOT built.** A shop needs a payment flow, a
purchase record and a story for a card that fails mid-month — a week of work,
spent building something that competes with the upgrade you want people to
take. The data model is the same either way: whether an id lands in `packs`
because of a tier or because somebody bought it is one line, so this is not a
dead end.

### NOTHING ON THAT PAGE GRANTS ANYTHING

"Which features do I want" is two questions wearing one coat, and they must
never share a switch:

| | What it is | Who sets it | Where it lives |
|---|---|---|---|
| **What you have** | the tier, and the subscription status | the OWNER | `tier` / `status`, via `accounts.update()` |
| **What you have ON** | which of your tier's features you use | you | `prefs.featuresOff`, via `accounts.setPrefs()` |

The page shows the first as a **statement** and offers the second as a
**switch**, drawn differently on purpose — a tick box that turned invoicing on
would be the paywall handed to the customer, and there is no payment processor
wired up to charge for it.

**A switch only ever SUBTRACTS.** `setPrefs()` is a separate method from
`update()`: it writes only under `prefs`, it ignores anything shaped like an
entitlement, and it will not even store a feature above the account's tier.
`featuresFor()` is entitlement; `activeFeatures()` is that minus the switches,
and is what the console draws from. There are tests that switching everything
off changes nothing `can()` answers, that a `prefs` payload carrying `tier`,
`comped` or `role` hands out none of them, and that ON is always a subset of
ENTITLED.

**`can()` — and therefore `allowed()` on the server — reads entitlement only.**
Switching something off does not make the API refuse it. That is deliberate: a
switch on your own account page is about tidiness, and one that could 403 you in
the middle of a gig is a reliability risk for no benefit, because nobody needs
protecting from themselves. The console hides it; the server does not slam a
door on it.

**The My account tab can never be switched off.** It is where the others are
turned back on, so it has no feature gating it at all.

**An account written before the ladder still reads correctly.** `tierFor()`
falls back to the old `plan`+`addons` shape — `admin` was Silver, `stream` was
Gold — because a subscriber silently dropping to Bronze because a field was
renamed is not a migration, it is a bug with a bill attached. Moving a tier
deletes the old fields, so an account never carries two answers to one question.

Two things this found, both of which had been there a while:

- **`tabBar()` assumed every tab had `packs()` or `count()`.** A tab with
  neither took the whole console down with `tab.packs is not a function`.
- **`load().catch()` swallowed the error and drew the host-key box**, so a bug
  anywhere on the page looked exactly like a wrong key. It logs the cause now
  and says so on screen. That is the rule about failure messages naming the
  cause, applied to the console itself.

**The lit tab is scrolled into view after every render** (`showActiveTab()`).
The bar scrolls sideways on a phone and the tabs on the end were off the right
of it, so tapping one changed the page while the tab you pressed stayed out of
sight — which reads as "did that work?" and gets tapped again. It moves the
BAR's own `scrollLeft`, never `scrollIntoView`, which would jump the whole page
down to the tab bar on every render.

---

## The name on it, and whose colours it wears

`src/branding.js` and `public/assets/schemes.js`. Two settings, one idea: **a
night belongs to one quizmaster, and every screen in that room says so.**

### It was Quiztopia until 12 August 2026, and the rename was about the NAME being crowded

Not a whim and not a legal panic — the two are worth telling apart, because
only one of them is why it moved.

**The legal side was survivable.** `quiztopia.uk` turned out to be a venue in
Liverpool, which is a different service in a different city, and the `.com` has
been parked since 2008. A dormant YouTube channel of the same name has two
subscribers and nothing posted in three years, which is not goodwill anybody
could defend.

**What actually decided it was that the name was CROWDED, and that cost is
permanent.** The `.co.uk` was a £205 registry premium at two registrars, the
`.com` was gone, and a quizmaster hearing the name at a gig and searching for
it landed on somebody else's business — sharing every scrap of SEO, and their
reviews, forever. That is not a risk that might happen; it is a standing tax
for as long as the product exists.

**And it was free exactly once.** Nothing was printed, no QR carried it, Rob
had no login, there were no subscribers and there was no goodwill in the word.
A month later it is reprinting, re-explaining to paying customers, and doing it
under pressure. **If the name ever has to move again, that asymmetry is the
argument — not whether the new name is nicer.**

**Quizporium keeps the mark unchanged, and that was a criterion rather than a
coincidence.** The logo is a question mark inside a microphone: the mic is the
host, the question is what every round is. An *emporium* is a place stuffed
with things — which is what a growing catalogue is, and the whole Silver and
Gold argument — so the name says what is being SOLD while the mark says what
happens on the NIGHT. Neither needed redrawing. A shopfront or an awning would
have said "shop" on a projector, which is the wrong half of the product.

Three rules came out of choosing it, and they are what to apply next time:

- **A name that describes a PERSON puts a second character on the projector.**
  "Mark's Quizzard", "Mark's Quizmaster" — now there are two stars and one of
  them is not the paying customer. A PLACE or a SHOW is safe, because he owns
  or hosts it. This is the test that killed most candidates.
- **It has to spell itself from hearing.** *Quizine* was the most charming
  thing on the shortlist — "Mark's Quizine" casts him as a chef with a craft —
  and it is phonetically identical to "Mark's Cuisine". A name needing "with a
  Q" in every sales call fails the fourth design rule, which is about helping a
  quizmaster SELL.
- **Pun on a WORD, never on a NAME.** A real person's name is a personality-
  rights problem the day you charge for it, and it fails the first rule too.

`APP_NAME` is one variable and `brandWords()` splits on it generically, so the
rename was the constant, the page titles, the docs and the tests — nothing
structural. `BRAND_NAME` still beats all of it, unchanged.

**The domains are `quizporium.co.uk` (£5) and `quizporium.app` (£8).** The
`.com` is parked and is worth buying if the app ever pays for itself, not
before. `.app` is HSTS-preloaded, so browsers refuse plain HTTP on it at all —
which on a QR-scanned join link over pub wifi is a small reliability win rather
than only a badge.

### "Mark's Quizporium", "Rob's Quizporium"

The product is **Quizporium** (`APP_NAME`). What goes on a projector is the
room's host possessive-plus-that — **first names only**, because that is how he
introduces himself on the mic and a surname on a projector reads like a
letterhead. `brandFor()` also copes with the account having no name on it, by
falling back to the local part of the email: `rob@…` is still somebody telling
you they are Rob.

**It is taken from the ROOM, never from whoever is looking at the page.** A
phone that scanned Rob's projector says Rob's Quizporium even while the owner has
the console open in the next tab.

**And the room's host is looked up in the ACCOUNTS BOOK by room id, not read off
the room's `label`.** A label is only set when somebody who knows their own name
touches the room, and the first thing to touch a room after a restart is usually
the projector, which knows nothing. Branding off the label would leave a big
screen saying plain "Quizporium" for the five minutes before a gig. A room id IS
an account id (`roomIdFor`), so the book always knows.

`BRAND_NAME` still beats all of it and is unchanged — it is the documented way
to put one name on the whole app. What DID change is that it no longer *defaults*
to a name: it used to, which meant every room on the server said the same thing
whoever was running it.

### A scheme is a BRAND. A look is a NIGHT.

`SCHEMES` — six of them, stored on the account, changed from "Your colours" at
the bottom of the console. A scheme sets `--hot`, `--hot-2` and the washes
behind everything, so a quizmaster who does not want pink-and-orange does not
have to put somebody else's app on a projector with their own name above it.

**A scheme never touches `--a` to `--f`.** Those are the option colours — how a
player looks up, decides "the pink one, bottom left", and looks back down — and
they belong to `looks.js` and to nothing else. Two features fighting over the
one thing that has to agree between the projector and the phone is the way this
loses somebody points. There is a test.

**A look WINS where they overlap**, which is why the `[data-scheme]` blocks sit
ABOVE the `[data-look]` blocks in `style.css`: both are one attribute selector,
so source order is all that decides. Halloween is orange and black on
everybody's account, because a themed night is about the night rather than about
whose it is. There is a test for the ordering, because moving a block would
silently reverse it.

The ordinary scheme (`sunset`) deliberately has **no block of its own** — it is
whatever `:root` already says. So an account with no scheme, and every page in
the moment before the scheme arrives, looks exactly as the app always did.

**The logo takes the colours too** — the disc it is cut out of, and the app name
under the possessive — through `var(--hot, #ff2e88)` in the gradient stops rather
than bare hex. The fallback is load-bearing rather than belt-and-braces: the same
function is served as `/favicon.svg`, a standalone document with no stylesheet
and therefore no `--hot` at all, and a tab icon that came out transparent is not
a bug anybody would connect to a colour picker.

`PUT /api/me/scheme` is your own account and takes no id, so it cannot repaint
anybody else's projector. It is not behind a feature gate: it costs nothing to
run, which under the host's own tier rule makes it Basic, and the owner wants it
too. Saving pushes the room, so the projector and every phone change where they
stand without anybody reloading anything.

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

**And a second rule, added later, which decides everything the first one does
not: the tiers separate on QUIZ-APP FUNCTIONALITY, never on business tools.**
Invoicing, the calendar and marketing were a paid add-on and are now Bronze.
Withholding the thing that helps a quizmaster get paid creates no upgrade
pressure — it just makes the app less useful to the person you most want
recommending it.

**Advert slides stay at SILVER, and the reason had to be rewritten twice.** The
original — "it makes the quizmaster money" — is dead, because that is precisely
the argument that was made and rejected for invoicing. The second attempt, "a
slide is part of the show", is wrong the other way: the host's own correction is
that **the quiz app functions identically without it**, so it is not quiz
functionality at all.

What actually keeps it there is the test this whole section is built on:
**does withholding it degrade the SHOW?** Every other capability held back is
something a room can see is missing. An advert slide is not — a room that never
sees one does not know it was possible. It is a lever for winning the BOOKING,
which is a business outcome for the quizmaster rather than part of the night.
That is what makes it safe to price. And Silver needs it: without it Silver is
content and nothing else, and a rung with no capability of its own is a harder
thing to sell.

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

## Read-only packs, and the other half of that

A quizmaster cannot edit or generate a pack. That is the arrangement — the
packs are written to a house style and sold, and three people editing them is
how that style stops being one.

**So they need a way to tell you a question is wrong, or the whole thing just
routes round you by text message.** `src/reports.js`, and it is one tap on the
control view: "Something wrong with this one?" at the bottom of the answer key.
No typing, no dialog, no confirm — the room has just said a question is wrong
and sixty people are waiting, and anything more than a tap does not get used.
The server reads the question off the RUNNING GAME rather than trusting the
browser, so a stale page cannot mis-report.

**A report carries a COPY of the question, not a pointer to it.** By the time it
is read the pack may have been edited or reordered, and "round 2 question 7"
against a changed quiz sends you confidently to the wrong question. The copy is
what was actually on the projector.

The same person reporting the same question twice is ONE report with a later
timestamp — same reasoning as the double-tap guard. Two DIFFERENT people
reporting it is two, because that is evidence rather than noise. When the file
fills, the ones already dealt with go first: an open report is somebody waiting.

Global rather than per-room, deliberately: the packs are shared, so a fault Rob
finds is a fault in the owner's pack. The list is owner-only — a quizmaster
seeing everybody else's corrections is the same mistake as a shared invoice
book — and it sits at the top of `/owner`, above the quizmaster list, because it
is the only thing on that page somebody is waiting on.

**`/api/reports/` had to go in `OWNER_ONLY`.** The broad `FEATURES.QUIZ` gate in
`handleWrite` catches everything that is not exempt, and the owner has no quiz
features to pass it with — so the owner got a 403 dealing with a report on their
own pack. That trap has now bitten twice (generation was the first). Anything
new that only an owner does belongs in that list.

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

### One login, two hats — and it is how the quizmaster's bugs get found

`ACTING_COOKIE` in `server.js`, `ownQuizmasterFor()` in `accounts.js`, and
`hatSwitch()` in `client.js`.

**The switch is a tab in the top right — Owner | Quizmaster, plus the rungs —
and it is the SIGN as well as the switch.** ONE MENU IN EVERY STATE: the same
control on the owner page, the console and behind the host key, so it is never a
different shape depending where you are. Tapping a rung with the hat off means
"put it on and show me that tier", because that is what pressing B actually
means — making somebody press Quizmaster first was a step that existed only
because of how the code was arranged.

**Two colour languages would be one too many, so there is one.** Whichever half
is live wears the app's own red-into-orange, whatever it is; the rungs beside it
carry the metals, because there the colour IS the meaning. Which hat is on stays
unmissable through the gold hairline under the topbar. The topbar is sticky, so unlike
the bar it replaced it never scrolls away, and the body picks up a gold hairline
while the hat is on so even a screenshot of the middle of the console says which
hat it was taken in.

It replaced a "Become a quizmaster" panel on `/owner` AND a bar across the top
of everything. Two ways to do one job is how you end up using the worse one out
of habit, and the worse one was the panel — it only existed on the owner page,
so getting back meant finding a bar at the top of a different one.

**Only an owner ever sees it, and only their own two hats.** A real quizmaster
has nothing to switch to.

**A remembered key is dropped the moment a signed-in owner turns up.** A key
typed once used to be kept for good, so a browser that had ever touched a
`?key=` link stayed on the key — and the switch showed a third position long
after there was any reason for it, which reads as a bug nobody can account for.
The check is on `alsoSignedIn`, NOT on `me.role`: with a key in play the server
answers as the bootstrap identity, whose role is "quizmaster". Using a `?key=`
link deliberately still puts you on the key for that visit.

**On the HOST KEY it grows a third position — Host key | Owner | Quizmaster.**
The key beats the cookie on the server and that ordering stays exactly as it
was, but it used to mean the switch vanished the moment a browser had seen
`?key=…` — so the one laptop that is both the dev machine and the gig machine
could never look at the quizmaster side at all. `/api/me` now reports
`alsoSignedIn` when a bootstrap request also carries an owner cookie, and
picking a hat FORGETS the remembered key (localStorage and the `?key=` in the
address bar, or it would win again on the next load and the switch would look
broken). The bookmark still works, because the key lives in its URL — so this
is a way out, never a lock-out. Saying "Host key" out loud matters too: it is
why that console looks nothing like what a subscriber sees.

### …and as a Bronze, Silver or Gold subscriber

`TIER_COOKIE` in server.js, `tierPreview()` in client.js. With the hat on, the
switch grows a second half — **All · B · S · G** — and picking a rung shows the
console exactly as a subscriber on that tier sees it.

**This is the other half of the problem the hat was built for.** The hat exists
because every irritation a real quizmaster hits is invisible from behind the
host key. But the linked quizmaster account is **comped**, so wearing the hat
has only ever shown the TOP of the ladder — and every irritation a Bronze
subscriber hits is invisible from there for exactly the same reason. "Rob says
the Invoices tab has gone" is not a question answerable from an account that has
everything.

**It is a genuine downgrade, gate included.** The console draws as that tier and
`/api/invoices` returns 403 for a Bronze preview — because the whole value is
catching the places where the page and the API disagree, which is precisely what
the permissions sweep found five of. A preview that only changed the drawing
would hide the bug it exists to find.

**`comped` MUST be cleared when a tier is previewed**, or the tier is
decoration: a comped account holds the whole ladder whatever tier it says. There
is a test named after that failure.

**Only ever a downgrade, and only the owner's own account.** There is no rung
above the top of the ladder and the linked account already holds all of it, so
this cannot widen anything. A real quizmaster is sent no picker to draw and gets
a 403 asking for one directly — both checked in a browser.

Taking the hat off clears the preview cookie as well as the acting one. A tier
left behind would silently apply the next time the hat went on, which is how you
end up hunting for a bug in the app that is really in your own session.

**Switching cannot disturb a night in progress**, which is why there is no
confirm step: the two hats are two ROOMS, and a room keeps its own game, its own
phones and its own state file. The worst a mis-tap does is show you the other
room until you tap back. `actingBar()` survives on the control view only, where
it is the indicator and not a switch — you change hats where you administer, not
while driving a night.

Mark is the app dev AND a quizmaster, on one laptop. Two logins meant two
passwords and signing in and out; the host key meant every hat at once, which
is worse for a different reason — **behind the host key, every irritation a real
quizmaster hits is invisible.** So the owner switches into their own linked
quizmaster account and gets exactly what a subscriber gets: their own room,
their own join code, read-only packs, no generator, owner routes 403.

**It is only ever a DOWNGRADE, and only ever into the owner's OWN account.**
The linked account carries `ownedBy: <ownerId>` and `whoIs()` checks that
against the book rather than trusting the cookie. Acting as somebody ELSE's
quizmaster is support access — theirs to grant, and logged — which is a
different feature and deliberately not this one.

The linked account has a long random password nobody ever sees: it is never
signed into directly, which is what makes "one login" true and means there is
no second password to lose.

**This paid for itself immediately.** The first time the hat went on it showed a
signed-in quizmaster could DELETE one of the owner's quizzes — see below.

### Writing to the pack library is the owner's alone

**`src/gates.js`** — `changesTheLibrary()` and `OWNER_ONLY`, imported by
`server.js`. Reading the library is `FEATURES.LIBRARY`, which every quizmaster
has — they play the packs, that is the arrangement. Saving, deleting, renaming,
importing, annotating and the playlist step are `FEATURES.CATALOGUE`, owner only.

Before this, every pack-write route was gated only by the broad `FEATURES.QUIZ`
check, which every quizmaster passes. **A signed-in subscriber could have
deleted a quiz an hour before a gig** — and far more likely by mis-tapping a
Delete button the console was drawing for them than by meaning to. It is a
prefix test rather than a check on each route precisely so the next
pack-writing route somebody adds is covered without anybody remembering to.

Note the ordering trap, which has now caught something **four** times: the
owner has no quiz features, so anything only an owner may do must skip the broad
gate as well as pass its own. The fourth was **Import** — the main way bingo
packs are made — where the owner got a 403 on his own console.

**It lives in its own file because a rule you cannot import is a rule you cannot
write a test for**, and this one was wrong twice. `test/gates.test.js` asserts
the bare path AND the prefix for every pack route, and that every owner-only
route is on one list or the other, which is the thing that fails when somebody
adds a fifth.

### What a sweep as a quizmaster actually found

**The burglar is called RoboRob, and he is not Rob.** Rob is a real person who
is going to be handed a login, and he is the innocent second quizmaster in every
other example in this file — the one who presses Launch, finds a wrong question,
and needs his own room. **RoboRob is a throwaway test account** signed in and
pointed at every route a subscriber should not reach. Where this file says a
quizmaster "could have deleted a quiz", that is a statement about what the
SOFTWARE allowed, never about anybody's intentions. Keep the two apart in
anything written down: a repo is read by the people in it.

Five things worked, and the shape of each is worth keeping:

- **`POST /api/quiz` took the id in the BODY**, so `startsWith('/api/quiz/')` —
  with the trailing slash — never matched it. DELETE and PUT were shut and this
  was wide open: the Madonna pack came back titled "ROBOROB WAS HERE". `POST
  /api/bingo` was identical. **Match the bare path as well as the prefix.**
- **Import, the playlist builder and `history/forget` were open**, because none
  of them looks like "saving a pack". Forgetting the history wiped all 319
  entries — the failure nobody sees for three months, when a song comes back in
  front of a room.
- **Three routes on the Invoices tab asked for `FEATURES.LIBRARY`**, which every
  quizmaster has, rather than the admin add-on: the PDF, the status change and
  deleting a customer. A subscriber with no add-on at all downloaded an invoice
  carrying the host's own sort code. There is a test that reads `server.js` and
  fails if any `/api/invoices` route is gated on the library — the same trick
  `looks.test.js` uses for emoji.

**What held:** rooms. Every attempt to reach another quizmaster's night —
`?g=CODE`, `room`, `roomId`, `joinCode` in the body — landed in the attacker's
own room, because `/api/host/*` works out the room from WHO YOU ARE and takes no
room parameter. The other game carried on untouched. Also held: the account
routes, the corrections book, generation, path traversal on every static route,
and the screen payload, which carries no answer key to an unauthenticated fetch.

**And the console has to agree with the server.** Every one of these was fixed
in `server.js` first and then in `console.js`, because a Delete button that
returns 403 is worse than no Delete button. A quizmaster's pack card is **Read
and Launch** and nothing else; the read-through shows the questions, the answers
and the review flags with nothing to press.

### The host key was showing itself the shop

Found by the same sweep, and it was live: `allowed()` in `server.js`
short-circuits on `account.bootstrap` and grants everything, but the BROWSER
copy of `plans.js` scored the host key as a basic quizmaster with two add-ons.
So `/api/me` reported no `owner.*` features and the console drew a page for
somebody who cannot generate — **"have a look in the shop" where the generator
goes, shown to the man who writes the packs.**

`can()` and `featuresFor()` now say yes to everything for a bootstrap account,
which cannot widen anything: the key already grants the lot server-side. This is
the third time the two copies have disagreed, after the launch buttons and the
`keyed('/api/me')` fetch. **If a control is missing on the host key, suspect
this before building it again.**

### The console is the CATALOGUE, and the catalogue is the owner's

An owner used to be bounced from `/console` straight to `/owner`, which left
nowhere at all to generate or import a pack: the generator lives on the console
and the owner page had only subscribers and reported questions on it. So the
only way to write a quiz was the HOST KEY — an account was strictly worse than
the thing it replaced, and that is what the host reported.

So the split is by JOB rather than by page:

- **`/owner` is the business** — who subscribes, what tier, what they reported.
- **`/console` is the product** — every pack, the generators, Import, the
  read-through, the editor.

Both pages carry the hat switch, and there is one link between them.

The pack tabs therefore ask for `FEATURES.LIBRARY` rather than for the game
features: reading and writing the catalogue is not the same question as running
a night. What an owner still cannot do on the console is LAUNCH — the Launch
buttons and the whole running panel are gated on `QUIZ`/`BINGO`, which an owner
deliberately has none of, so their room can never be driven from there.

**An owner is never sold anything.** `visibleTabs()` drops a tab they do not
hold rather than greying it with a price — the upsell is for subscribers, and
the owner is not a customer.

### The control view no longer needs a key at all

A quizmaster who signed in and opened `/host` was asked for a host key they have
never been given and no way to get — so Rob could launch a game from his console
and then not drive it. Their cookie already says who they are and which room is
theirs; that is enough, and `/host` now asks the server before deciding.

The key still works and still wins where both are present, for the same reason
it wins on the server.

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

### "Never played" means YOUR nights

`library-stats.json`, keyed by room — `statsFor()` and `recordLaunch()` in
`src/library.js`. The pack library is shared, but how often you have run
something is a fact about your nights rather than about the file. Counted
globally it would tell Rob that a quiz he has never opened was played twice
last week, which is worse than no count at all: the only use of that line is
deciding what not to run at the same venue again.

One file rather than one per room, so it is one thing to back up.

**It was the only thing in `data/` with no backup at all**, which is why the
host reported packs saying "Never played" after playing them — every deploy
reset the lot, and nothing on screen tells "never" apart from "forgotten". It
goes to the PRIVATE repo like the accounts and the invoices: it is a record of
somebody's nights, not of the packs, which are the public repo's. Restored only
into an absent file, same rule as everything else — a disk with counts on it is
ahead of any backup.

**The flat shape from before rooms is read as the HOUSE's**, because back then
there was only one game and all of it was Mark's. Reading it as anybody's would
hand a brand new quizmaster somebody else's history; throwing it away would
reset the counts it is the point of. It is folded into the house on the next
launch so the file never holds two answers to one question. Tested.

`HOUSE` in `rooms.js` is now `HOUSE_ROOM` re-exported from `library.js` rather
than the same string written out twice — if those two ever disagreed, launches
would be filed under a room nothing reads and the count would silently stay on
zero. There is a test that they are one string.

### The suggestion box — ideas, irritations and bugs

`src/suggestions.js`, `suggestionPanel()` in `console.js`, `suggestionsPanel()`
in `owner.js`.

**Deliberately NOT the same list as `reports.js`.** A report says "this
question is wrong", which is a fault in a pack and is answered by editing the
pack. A suggestion is about the APP. One pile of both is a page you skim rather
than work through.

**Why a box and not a support hour.** The host asked about a weekly Q&A window.
A scheduled hour only works at a scale that does not exist yet — with two
subscribers it is a phone call — and it asks somebody to REMEMBER at 7pm on a
Tuesday what annoyed them at 9:40pm mid-gig. The good ones do not survive that
trip. This is the same shape as "Something wrong with this one?" on the answer
key and works for the same reason: it catches the thought as it happens. It is
asynchronous on purpose, so nobody is ever on call.

**Three kinds** — an idea, something that got in the way, something broken —
because they want completely different things doing about them and because
three is what somebody can pick from without reading.

**A fourth kind is a PACK REQUEST, and it is the one that is gated.** "There is
no One Direction quiz and I want one." It lives in this box rather than in a
subsystem of its own because what it needs is exactly what a suggestion needs —
somebody to read it, decide, and say yes or no in words — and the inbox, the
reply that clears it, the draft button and the been-opened receipt all already
exist. A second list would be a second place to forget to look.

**The reason it is Gold is NOT the per-use rule**, and getting that straight
matters for the next feature: a request costs nothing until the owner agrees to
it, so no bill is ever automatic. What it spends is the **owner's writing
time** — about £2 and twenty minutes of reading, for one person — which is the
one genuinely scarce thing in this business. And that is the same thing Gold
already sells: **Silver buys the owner's BACK CATALOGUE, Gold buys the owner's
TIME.** A weekly topical quiz, and now a pack written to order.

**Two limits, and only one of them is about the subscriber.** One open request
at a time AND one a month per account, both in `suggestions.js` — without the
second, "one open at a time" means ask Monday, receive Monday, ask again
Tuesday, and fifty-two packs a year from one person.

**The constraint that actually binds is the OWNER'S MONDAY**, and that is
handled by a QUEUE POSITION rather than a cap. A global weekly limit would
refuse somebody who asked on Sunday night because three others got there first,
which reads as "Gold, but be quick" — and a control that refuses is the mistake
this file keeps recording. A queue never says no, it says when.

**Saying WHICH DAY is worth more than the limit is.** The host does his admin
on Mondays, so that is when the inbox is read and the generator pressed.
`PACK_DAY` and `nextPackDay()`; the panel says *"Written on Mondays — ask
before then and it is in your library on 17 August"*. A request with no stated
turnaround is a promise broken by silence: the subscriber does not know whether
it is coming on Thursday or at all, so they chase, or they quietly stop
believing in the feature.

**MONDAY IS THE ADMIN DAY FOR THE APP ITSELF, not only for packs.** Stated by
the host on 12 August 2026: changes people ask for get made on Mondays and not
before. That is the same promise the pack panel already makes and it should be
said in the suggestion box too, which currently states no turnaround at all —
so somebody reporting something on a Tuesday has no idea whether it is Thursday
or never, which is the exact failure the paragraph above describes.

**ONE LINE FOR ALL THREE KINDS. There is deliberately no emergency channel, and
that was argued and settled rather than overlooked.** The obvious refinement is
to say "Monday" over an idea and something faster over "something broken" —
proposed, and turned down by the host for three reasons, each of which is
sufficient on its own:

- **It designs for a failure the app is committed to preventing.** The whole
  codebase is organised around not breaking a Wednesday night, and it has to be
  that stable before anybody is charged. An escape hatch for "the app ruined my
  gig" is planning for the thing that must not happen.
- **An emergency button gets pressed for non-emergencies**, not maliciously —
  "urgent to me" is not the same as urgent. Then it means nothing, and the one
  real emergency is buried among the ones about a confusing button. Exactly the
  reasoning that keeps a second badge off the owner's tabs: a second badge costs
  the first one its meaning.
- **It advertises that the app breaks quiz nights.** A subscriber reading it
  concludes this is expected, which is the opposite of what is being sold.

And at two subscribers the emergency channel is a phone number. Building one
into the app is premature and would need staffing behind it to be real. **If it
ever comes back it is a support function with hours, not a button.**

**The whole state is sent BEFORE anybody types** (`packRequestStatus()`, on the
library payload). Being refused after writing three sentences is the version
that annoys; "that is this month's, the next is from the 1st" is a sentence
somebody can plan around. Once asked, the panel becomes the queue position
rather than an empty box.

**The owner's inbox gives pack requests their own pile**, because they are a
different JOB — everything else there needs a decision and a reply, this needs
the generator pressed and twenty minutes of reading, and it all happens on one
admin day. A list where those are scattered among the ideas is one you work
through twice.

**Gated on the SERVER**, where the kind is received — not left to the console
not drawing the option. A kind is one word in a request body, which is exactly
the shape of the hole `POST /api/quiz` had. There is a test that reads
`server.js` and fails if the check goes missing.

The entry point is under the SHOP on the pack tabs rather than in this panel,
because that is where the want actually arrives: you have scrolled the
catalogue, you have scrolled the shelf, and neither has the thing. A rung below
Gold sees the offer rather than nothing — same as the tab bar's `+`.

**Sending is open to anybody signed in and NOT gated on a tier.** The people
most worth hearing from are the ones having the worst time, who are the least
likely to be on the top rung. Reading the list is owner-only, same reasoning as
the corrections book: a quizmaster seeing everybody else's complaints is the
shared-invoice-book mistake again.

**It carries which tab they were on**, sent by the browser rather than guessed.
That is the difference between "the editor is confusing" being actionable and
being a shrug.

**It is an INBOX, not a list.** `suggestionsPanel()` in `owner.js` shows two
piles — "To deal with" and "Cleared" — and **replying clears it by default**,
because the point of the list is that it gets shorter. An inbox where answering
something leaves it sitting in the pile is one you stop trusting to tell you
what is left, and then you stop reading it. Reopening is one tap.

**Each message is signed with a first name and a short reference** (`#FAMQ`),
taken from the account id rather than stored. Not secrecy — the owner can see
email addresses elsewhere — but an inbox reads better as "Rob · #FAMQ" than as
an address, and a reference can be quoted back at somebody without spelling out
their email.

**Draft a reply, never send one.** `src/reply-draft.js` asks Claude for three
or four sentences and puts them in the box; Send is still a separate, deliberate
press. A reply that goes out unread is the one that goes publicly wrong —
apologising for something that did not happen, or promising a feature that is
not being built. The brief carries what the app is and the house rules for
writing (British English, no marketing voice, **never promise a date, a feature
or a refund**, and ask one specific question rather than guessing). It is NOT
the generator's `askClaude`: that parses JSON, and this wants prose.

**Three things go into a draft beyond the message, and each answers a
different question.** None of them is training — there is no learning loop
anywhere, and it is worth saying that plainly to anybody who asks:

- **The house notes** (`suggestions.house`, edited on the owner page) are what
  the OWNER has taught it. This is the only way the drafts get corrected: a
  draft says something wrong, a line goes in, it stops saying it. They are
  followed where they disagree with the brief — **except** the rule about never
  promising a date, a feature or a refund, which outranks them, or a careless
  note would turn the button into a liability. There is a test.
- **The facts** (`factsFor()`) are who it is talking TO: their tier, how long
  they have subscribed, whether they have written in before and whether those
  were answered. Deliberately NOT their email or anything from their invoice
  book — a reply needs to know who it is addressing, not everything about them.
- **The voice** (`voiceFrom()`) is how the owner has answered before, newest
  six. **This is the only part that improves on its own**: every reply sent is
  another example. Given as STYLE and never as facts to reuse, because a past
  reply may carry a promise made to one person about one thing and a model told
  to be consistent would repeat it to somebody else.

**AND IT MUST NOT LEARN FROM ITSELF.** The host spotted this before it was
built: press Draft, send it barely edited, and that reply becomes an example
for the next draft — so it imitates its own output, drifting a little more
generic each time and quietly amplifying any phrase the owner would never use,
because it keeps coming back as evidence of how they write.

So `mostlyMine()` compares what was SENT against the draft that was offered,
and anything largely unedited is stored `machine: true` and kept out of the
examples. Measured on WORDS, because fixing a typo is not writing it yourself
and rewriting a sentence is — a character diff cannot tell those apart. **The
threshold leans towards calling it machine on purpose**: wrongly excluding one
costs nothing, while wrongly including one poisons the examples, which is the
whole problem. With nothing but machine replies there are simply no examples
and the draft falls back to the written brief — no voice beats a voice made of
its own echoes.

**The button only appears when there is a key.** `canDraft` comes back with the
list, so a missing `ANTHROPIC_API_KEY` is a button that is not there rather than
one that errors when pressed.

**A reply says whether it has been OPENED.** `markSeen()` stamps a reply the
first time that quizmaster's console draws their own threads — so the label is
"opened", never "read", because their console rendering it is all any read
receipt has ever meant. Only ever fills a blank: the FIRST time is the useful
fact, and rewriting it on every page load would turn a receipt into a "they
were looking a second ago" ticker. The owner refreshing their own inbox marks
nothing, and a second reply is unopened again even though the first was seen.

**The quizmaster sees their own thread and the replies to it.** Without that
the box is one-way — you send something into the dark and never learn whether
it landed, which is how a feedback route stops being used after the second time.

**The routes answer BEFORE the broad `FEATURES.QUIZ` gate**, or the owner would
get a 403 on their own suggestion box — the trap that has now caught something
six times. That works because of where they sit in the file, which is fragile,
so `test/gates.test.js` pins the ORDERING rather than the behaviour.

### Support access — their door, their log

`openSupport()` / `closeSupport()` / `supportOpen()` / `noteSupport()` in
`src/accounts.js`, the second branch of `whoIs()` and `supportGuard()` in
`server.js`, `supportPanel()` in `console.js`.

**A quizmaster's own material is their work**, and other quizmasters will assume
the worst about a competitor who can read it. So the answer is not a promise
not to look: the app refuses until they open the door, it shuts itself again,
and everything done inside is written down where they can read it.

**It is a SWITCH, not a duration to pick.** Choosing "1 hour or 8 or 24" is a
decision at the worst possible moment — they do not yet know how long the
problem takes. On, then off the second it is sorted, and off is instant.

**And it runs on a DEAD MAN'S SWITCH.** Half an hour at a time; the panel
counts down, asks "still need help?" with five minutes left, and one tap resets
it. Nobody has to remember to close anything — walking away IS closing it,
which is the right outcome for somebody called away mid-conversation. Reopening
costs one tap, so being shut out early is cheap while being left open for a
week is impossible. `openedAt` is when they FIRST let you in and is not
rewritten by a confirmation, or the log would misreport when the session
started. The countdown is a plain local timer, because the console holds no
live connection and a clock is something a browser can do on its own.

**Checked on every request, not once on the way in.** Otherwise a session
outlives the window, which is the whole guarantee undone by a cookie.

**The acting flag is `inSupport`, and it must NEVER be the account's own
`support` object.** It was `support: true` — which collides with the name of
the GRANT that every subscriber who switches access on carries. So
`supportGuard` read a truthy `support` on Rob-signed-in-as-Rob and treated him
as the owner inside his own account: every `/api/host/*` route 403'd with
"support access cannot run a night", **so a quizmaster who left the door open
could not run their own quiz**, and his own Next and Reveal went into the log
as though somebody else had tried them. Two meanings on one field name, found
by signing in as the owner and probing a live server.

**In the console the grant is `me.support`, because `me` IS the account**
(`me = who.signedIn ? who.account : null`). `/api/me` answers
`{ signedIn, account, … }`, so reading the raw payload makes that look wrong
and invites a "correction" one level deeper — which is undefined, and silently
empties the log without breaking anything else on the page. There is a test
pinning it both ways.

**Three refusals, each a different failure:** no grant or an expired one; their
room is BUSY, because going in mid-round is one mis-tap from ending somebody's
night; and host actions are blocked for the whole session, in case a game
starts while somebody is already inside.

`busy` rather than `live` matters: `live` means "past the lobby", so forty
people sitting in a lobby with their team names typed in did not count and the
owner was let straight in. `busy` means what the launch guard already means —
anybody joined counts — and two guards with two definitions of "a night in
progress" is how one of them quietly becomes wrong. The owner also cannot open the door
from within a session — one grant extending itself for ever is the expiry
undone in one line.

**The host key cannot act as anybody, grant or no grant.** `whoIs()` returns
`BOOTSTRAP` for a key and never reads the acting cookie, so holding the key
does not open a subscriber's account either. There is a test asserting that
ORDER, because flipping it would silently make the key a way into every
account.

**The log is what the OWNER did, never what the subscriber did.** It answers
"what did you do in my account", not "here is a diary of your own use" — a
quizmaster scrolling their own launches and pack-opens back would learn nothing
about the owner and would have to pick their activity out of it to find the
entries that matter, which is the same as not having it. The whole guarantee is
one early return in `supportGuard`, and it has a test of its own because the
flag could be named right and this could still break by somebody moving the
logging call above the return.

**Reads are logged as well as writes.** "Did you look at my quizzes" is the
question the log exists to answer, and a writes-only log is silent about
exactly that. The noise that would drown it — the state poll, the live stream,
health, `/api/me` — is skipped. Entries are written in WORDS (`supportWords()`)
rather than route paths: this is read by somebody deciding whether they trust
you, so "Looked at your pack library" beats "GET /api/library". Anything
unmapped falls back to the raw route, because an ugly line beats a missing one.

**And looking has to be told apart from changing on their OWN packs, not just
the catalogue.** `read` was worked out and then ignored for `/api/mine/*`, so
opening one of their quizzes was written down as *"Changed your own pack"* and
listing them as *"Saved one of your own packs"*. On the one log whose whole job
is saying what was done to somebody's material, an entry that accuses you of
altering their work when you only looked is worse than a missing one — because
they will believe it.

**What this cannot promise, and do not overstate it to a subscriber:** the owner
runs the server, the disk and the backups, and the server has to be able to
read a quiz to put it on a projector — so end-to-end encryption is impossible
here by construction. This is access control and an audit trail, which is what
every hosted service has. The honest pitch is "the app will not let me in
unless you let me, and here is the log", not "I cannot see it".

### The invoice book, the archive and the advert slides are per room now

They were the three things rooms left behind, and each was a different problem
waiting for the day a second login existed. `pathsFor()` in `rooms.js` decides
where they live; nothing else had to learn that rooms exist, because all three
already took a path.

- **The invoice book** holds a quizmaster's own customers, their addresses and
  their own sort code. Rob would have seen Mark's, and a guessed invoice number
  would have downloaded Mark's PDF.
- **The archive** is a record of somebody's own nights.
- **The advert slides** were the loud one: one folder meant a second quizmaster
  tidying what looked like their own venue list would delete The Crown's set off
  Mark's projector.

**The house room keeps every original location** — `data/invoicing.json`,
`data/archive/`, the top-level `adverts/` — for exactly the reason the state
file did: a deploy mid-season must not bring the app back with an empty invoice
book. Only an additional room gets a folder. Tested.

**Invoice NUMBERS are per book, and two quizmasters both starting at 1 is
correct.** They are separate businesses issuing their own invoices, not two
people sharing a pad. Each book backs up under its own name in the private repo
— the house keeps `invoicing.json` so the backup Mark already has carries on
working — and a room's book is restored the first time that quizmaster opens
the tab, because rooms are made lazily and the boot restore runs once.

**`/api/advert` came OFF `changesTheLibrary()`**, which this file promised would
happen the day they were scoped per room. Watch the trap, because it has now
caught something FIVE times: taking a route off that list drops it into the
broad `FEATURES.QUIZ` gate, which the OWNER fails by design. Advert writes
therefore have an explicit `FEATURES.ADVERTS` gate of their own, and there is a
test that reads `server.js` and fails if it goes missing. An owner still cannot
write one, and that is consistent rather than an oversight — an owner runs no
nights, so they have no projector to put a slide on.

**A missing advert set says "No advert set with that name."** It used to pass
`err.message` through, which on a miss is an ENOENT carrying the server's
absolute path — telling an unknown caller the directory layout and the room id
it had just looked in.

### A quizmaster's OWN packs — and the one rule that runs backwards

`src/own-packs.js`, `paths.ownQuizzes` / `paths.ownBingo` in `rooms.js`, and
the `/api/mine/*` routes. A subscriber writes their own quizzes and bingo games
alongside the catalogue's, marked **Yours** on the pack card.

**Every other gate in this app asks "has this account paid for that". This one
asks the opposite: the OWNER must not be able to read them.** It is their
intellectual property, not stock in somebody else's shop, and every other
quizmaster will assume the worst about a competitor who can read their
questions.

**The enforcement is structural, not a check somebody has to remember to
write.** No route takes a room parameter — every one works the room out from
who you are — and a room's own packs live under that room's own folder. So
there is no pack id and no query string that reaches another room's folder,
which is the same property that already stops one quizmaster driving another's
game. An owner asking by id resolves against the house room, finds nothing, and
falls through to the catalogue. The one way in is **support access**, which they
switch on, which expires on its own, and which writes "Opened your pack …" into
the log they can read. This is the first feature that genuinely needed it.

**Be honest about what that is.** The owner runs the server, the disk and the
backups, and the server has to be able to read a quiz to put it on a projector,
so it cannot be encrypted from the person hosting it. This is access control and
an audit trail — "the app will not let me in unless you let me, and here is the
log", never "I cannot see it".

**Two prefixes, because a path test cannot look inside a request.**
`changesTheLibrary()` in `gates.js` is what keeps subscribers out of the
catalogue, and it matches on the route alone — it cannot tell which of two
libraries a pack id belongs to. So `/api/quiz` and `/api/bingo` write the
CATALOGUE and stay the owner's, and `/api/mine/*` writes the room's own folder
and can never touch the catalogue. Sharing one route would have meant either
loosening the tested rule or writing a second copy of it with no test on it.
There is a test that every `/api/mine` route asks for `OWN_PACKS` by name.

**Reading is ONE route for both**, resolved own-library-first
(`readPack`). That is what lets every existing route carry on taking a bare
pack id rather than growing a "which library" parameter somebody would
eventually pass from a request body.

**They still do not generate.** No Claude call exists anywhere under
`/api/mine/`. That is the owner's bill and the owner's house style, and it is
the arrangement. What they get instead is the editor and the same track-list
importer, pointed at their own folder — with the **no-repeats memory left out
in both directions**, because that is the owner's generator's record of what IT
has used: reading it would silently drop songs out of a list a subscriber pasted
deliberately, and writing to it would make the owner's next generated pack avoid
tracks it has never played.

**A tier can never take a pack they wrote away from them.** The tier lever is
the owner's catalogue — a starter set that runs out in month four. Applying it
to their own work would mean their quiz disappearing off their own console
because of what they pay the owner, which is not an upsell. `onlyTheirPacks()`
spares anything marked `mine`, and there is a test.

**Their own pack may not take a catalogue id.** Resolution looks in their folder
first, so it would SHADOW it — Launch would quietly play a different quiz from
the one everybody else sees under that name. Refused with words, because
renaming is one field and a silently shadowed pack is a mystery nobody would
think to look for.

**On Bronze**, under the host's own rule: writing a JSON file costs nothing per
use. Worth knowing what moving it up would mean, though — a subscriber's own
work becoming unreachable the month their card fails.

#### Where they are kept, and it is a THIRD repository

`PACKS_REPO`, `PACKS_TOKEN` (falls back to `GITHUB_TOKEN`), filed as
`packs/<roomId>/<kind>/<id>.json` — one folder per room, so "these are Rob's,
and only Rob's" is something you can see rather than something you have to
trust.

Not the public repo, obviously. **And not the owner's private one either**: that
holds the owner's accounts, invoices and customer records, and mixing somebody
else's work in with the owner's business records is the wrong boundary however
careful everybody is. `packsRepoConfigured()` deliberately has **no fallback**
to `PHOTO_REPO`, because falling back would put a subscriber's quiz in there
quietly on the day the variable was missing, with nothing on screen saying so.
There is a test that greps for exactly that.

Restored **once per room per boot, only into an empty folder** — the same rule
as the accounts and the invoice book, because a disk with packs on it is ahead
of any backup. Rooms are made lazily, so it happens the first time that
quizmaster opens their console, and it is awaited there: a library drawn while
it was still running would show them an empty shelf, which looks exactly like
their work having been lost. `listDir()` in `github.js` is new and exists for
this — every other restore reads one file at a known name; a folder of unknown
names needs a listing.

**Without it configured the console says so in red**, in the panel where they
write one, and every own pack card carries **Download**. That button is not a
nicety: whatever happens to the app, the backup or the subscription, the file is
a file and they can hold it. It is also the honest answer to "what if I leave".

Two things this found on the way, both pre-existing: the owner's
**"nothing here is being saved permanently"** banner was being shown to
subscribers — it talks about generating packs and names two environment
variables only the owner can set — and `GET /api/quiz/<id>` **passed `err.message`
through on a miss**, which is an ENOENT carrying the server's absolute path.
Both are the same faults this file already records for the tab bar and the
advert sets, in new places.

### What this does NOT do yet

- Nothing stops two quizmasters launching the same pack at once, which is fine
  and probably useful.
- **A quizmaster cannot share one of their own packs with another quizmaster.**
  Download and re-upload is the whole mechanism today, which is deliberate:
  anything better needs a story about who owns the copy afterwards.

  **A COMPANY is that story, and that is the shape sharing will eventually
  take.** Between two independent quizmasters ownership is ambiguous; inside
  one company it is not. So the answer is a company folder
  (`packs/<companyId>/`) resolved **own → company → catalogue**, never a
  "which accounts may read this pack" permission — the owner is in no company,
  so they still resolve against the house room and find nothing, and the
  guarantee stays structural rather than becoming a check somebody has to
  remember to write. Written up in TODO.md under **Group accounts**; not built.
- **`session.launch()` does not check for a night already in progress**, so two
  people sharing one login can end each other's games mid-question. See TODO.md
  — the fix is the running panel saying what a launch is about to destroy,
  which is a small job and worth doing before anything else here.

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
npm test        # 800 tests, no network, injected clocks — must stay green
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

All on **`MusicQuizApp`**. 800 tests green.

**A second quizmaster CAN now be given a login.** They get their own running
game, their own join code, their own photo wall, their own name and colours on
the projector, read-only access to the pack library — **and a library of their
own, which the owner cannot read**. The invoice book, the night archive and the
advert slides are per room too. See "A room per quizmaster" above.

### The live app is set up now — this is what is actually on Render

Confirmed by reading the environment list on the dashboard:

`HOST_KEY`, `PHOTO_REPO`, `PHOTO_TOKEN`, `GITHUB_REPO`, `GITHUB_TOKEN`,
`ANTHROPIC_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
`SPOTIFY_REFRESH_TOKEN`. **No `PACKS_REPO`**, so a quizmaster's own packs are
saved but not permanent — their console says so in red and offers Download. One
more private repo and one variable fixes it; see TODO.md. **No `BRAND_NAME`** — checked deliberately, because it
overrides the per-quizmaster naming and a leftover value would hide that whole
feature while looking exactly like a failed deploy. **No `GOOGLE_API_KEY`**, so
round 2 is still placeholder art — that is the one variable the picture round
now waits on, and `OPENAI_API_KEY` is dead ground because the account behind it
was deactivated.

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
