# Bingo — the prizes, the button, and what a part boundary carries

`CLAUDE.md` carries every RULE from this page. This is the reasoning behind
them, and the measurements, so the next session weighing one of these does not
have to re-derive it.

---

## One prize each per round, while anybody is still without one

Reported off a live night: *"I had one person win three of the four music bingo
prizes yesterday… it looks really bad on me if one guy wins all the prizes."*

**It is not luck going wrong — it is the shape of the game.** The person
holding the best card wins the line, and that same card is then nearest to two
lines and nearest to the house. Whoever takes the first prize is the FAVOURITE
for every prize after it.

### Why the cards cannot fix this on their own

Asked for twice: *"I want the cards to be produced with different winners at
source."* They cannot, and the reason is worth keeping.

A card is dealt at JOIN, and who wins is decided by **the order the host plays
the tracks in** — which the app never sees, because the host is playing them
off a DJ app in another window. So there is no moment at which the dealing
could know who is about to win.

What IS in the cards is the real cause: **the stages are NESTED.** A line ⊂ two
lines ⊂ three lines ⊂ a full house, so the first winner already holds part of
every prize after it.

Measured over 400 simulated rounds at 60 players:

| | somebody wins 2+ of 4 | 3+ of 4 |
|---|---|---|
| as it stands (nested stages) | **100%** | 19% |
| disjoint patterns (rows 1-2, 3-4, 5-6, house) | **11%** | — |
| two rounds of two prizes each | **15%** | — |

Both alternatives were offered and the rig was chosen: *"just rig it that way
bro, it's meant to be a bit of fun and it's not fun if one person wins
everything."*

### The three things that make the rig safe

- **The claim is still right, and is recorded as right.** No false call, no
  telling-off — the prize simply passes to somebody who has not had one. A room
  that hears a shout and sees the app call it a mistake is worse than the
  problem this fixes, which is why the control view has THREE outcomes rather
  than two.
- **It lifts the moment everybody has one.** Four prizes and three players, and
  the fourth is open to all of them again. The test is *"is anybody left
  without"*, never a count of prizes, so it holds at any room size.
- **No sentence on a phone says "you have already won".** Asked for in those
  words, and the first build was reverted off the live app for it. The button
  says *"Playing on"* and a forced press says *"Correct — that one has gone"*.
  Same fact; the difference is whether the app is describing the night or
  telling somebody off for winning.

---

## A second correct BINGO used to replace the winner's name on the projector

Found in the September 2026 sweep, driving two phones.

Alpha claims the line: the projector says "Alpha", the voucher is Alpha's.
Bravo's button stays live, because `standDown` only asked *"do you hold a prize
while somebody else does not"* and Bravo holds nothing. Bravo has a genuine
line a beat later — **which is the ordinary thing that happens in a pub, not
cheating** — and presses.

The guard inside `claim()` stopped the second VOUCHER and let everything after
it run. `state.lastWin` was overwritten unconditionally and Bravo was pushed
into `state.winners.line`. Measured after the press:

- projector winner: **"Bravo"**
- Alpha's phone: back to *"Get a full line | Press BINGO!"*
- Bravo's phone: *"You got it. Well done."* — with zero vouchers
- host panel: Bravo verified
- `results()`: **both** marked as won, so the filed night, Past gigs and the
  landlord's report all record two winners of one prize

**The fix is to ask before recording, not after.** `stageTaken()` is checked
first, and the answer is the third outcome the phone already had wording for.

Two details:

- **The button stands down for everybody** once a stage is taken, not only for
  the people holding a prize. A live BINGO button on a prize that has gone is a
  promise the app cannot keep.
- **`tooLate` is a separate flag from `standDown`.** The host's claim list said
  *"GOOD — had one"*, which is a fact about the PLAYER and is simply untrue of
  somebody beaten to a stage by a beat. It says *"GOOD — just missed it"*.

---

## The BINGO button lit up on one line when the prize needed two

`hasMarkedPattern()` asked for a single marked line whatever the stage was,
while `evaluate()` — the thing that actually decides a claim — required
`done.length >= stage`. Two definitions of the same prize, in one file.

Every 40-track pack ships as 5x5, and `defaultPrizes()` gives a 5x5 card five
prizes: a line, two lines, three, four, then the house. So for four of the five
stages **every phone in the room read "BINGO!" the moment one line landed.**
Simulated at sixty players: **223.9 false calls a round.**

Each press is recorded against the player, each one earns a public "honourable
mention for the false alarm" on the win card, and all of them poison
`falseCalls` — the only number the host has for telling a chancer from somebody
who miscounted. Only the 4x4 two-stage default escaped it, which is why it
survived so long: that is the shape most test fixtures use.

**The split between the two functions is deliberate and stays**: the button
reads MARKS so it lights up on what the player believes, and the claim is then
checked against what was actually CALLED. What was wrong is that they disagreed
about what the prize was.

---

## "Continue to the quiz" destroyed the bingo's vouchers

`startOrderSegment()` builds a fresh engine for each part, and bingo mints its
vouchers the instant a prize is claimed rather than at a final scoreboard. So
the press that moves a running order on threw them away.

Reproduced over real HTTP: the line winner's code answered **200** from
`/api/voucher` before the press and **404 "That code is not a voucher here."**
after it. Redeeming at the bar failed the same way, and the host's own voucher
panel came back empty.

It is worst on the sharpest press, because the primary button advances
**automatically** the moment the last bingo prize is claimed — and its confirm
says *"Nobody's scores or cards are lost."*

It is also why the interlude's prize never reached Past gigs: the archive reads
`results().vouchers` off the LAST part's engine, which had never seen them.
This is the live complaint already recorded in `CLAUDE.md` — *"my quiz and
bingo winners on thursday didn't receive a QR code"* — arriving again by a
different route.

### Why the `carried` flag is load-bearing

`issueVouchers()` refuses to pay anybody already holding one. That is what
makes `Back` off the final and forward again safe — it must not mint a second
code for the same winner while the first is still in somebody's hand.

Across a part boundary that reasoning inverts. The table that won the bingo
line has not won anything in THIS quiz, and blocking them would be the app
taking a prize away for having already had one — which is a bingo-round rule,
deliberately, and not a rule about the night.

So carried vouchers are marked, and:

- the **idempotency check** sees this part's only;
- the **lookup**, the **redeem**, the **host panel** and the **archive** see
  all of them;
- the phone's final card prefers a voucher from THIS part, so a table holding
  two live codes is shown the quiz's on the slide about the quiz.

**`prizeWinners` deliberately does not carry.** It is a fact about one bingo
ROUND — `stageIndex` starts again at 0 in a new part — so a carried list would
make `stageTaken()` true for a prize nobody has played for yet.

---

## Two controls that said the same thing

- **`Continue to the quiz` was drawn twice.** At the last stage with a win on
  the board the primary button said *"Continue to the quiz"* and a minor button
  three inches below said *"Continue to the quiz now"*, both calling
  `advanceOrder`. Not two things sharing a word — one thing drawn twice. The
  minor is the EARLY exit, and now exists only when the primary is not already
  offering it.
- **Bingo's `Finish` stays, and says what it costs.** It is a deliberate escape
  hatch and `CLAUDE.md` says so, so it is not hidden the way the quiz's *Stop*
  is. What it must not be is silent: pressing it mid-order files the evening on
  the bingo's results alone and leaves the rest of the night out of Past gigs,
  the league and the landlord's report. The quiz hides its own Stop because
  that confirm promised Back would undo it and Back does not undo an archive;
  this one has no such promise to break, so the honest fix is to say what
  happens rather than to take the hatch away.

---

## And nothing in `npm test` or `pub-unchanged` could see any of it

`pub-unchanged.mjs` reads `quizzes/` and never loads a bingo pack, so IDENTICAL
on a bingo change is the guard answering confidently about something it is not
looking at — this repo's oldest trap.

`node scripts/bingo-prizes.mjs` is what can: it starts the app, joins three
phones, wins a prize, has a second phone shout a beat late, walks the stages,
and then runs a two-part night and looks the voucher up over HTTP on both sides
of the boundary. Every one of the faults above was verified by putting it back
and watching the script go red.

---

## The card shape chooses the prize count — a number per shape, not a formula

`defaultPrizes()` and the `prizes` field on `CARD_SHAPES`: 3x3 → 1, 4x4 → 2,
5x5 → 5, 4x6 → 4, 3x8 → 3.

**It was a formula for one commit and that was wrong.** The first three shapes
named were each exactly `maxPrizes()`, so *"the most that card can carry"*
looked like the one rule behind them — and then *"3 x 3 should give one prize
for a full house and 4 x 4 should give 2"* arrived, where the maximum is five.
A 3x3 stopped four times before a full house is over before the room has
settled.

**The table lives BESIDE the shape, never in the console** — like `plans` and
`minimum`, so a sixth shape has to name its own default in the line that adds
it rather than inherit an answer nobody chose. It is clamped, so it can never
promise a prize the geometry cannot pay.

It also ended a disagreement with the launch: the picker showed one prize while
a falsy count launched the pack's own two. **The picker clamps too**, or a
count carried onto a smaller card names an option that no longer exists and the
select goes silently blank.

---

## The rule became absolute, and the codes now wait for the end of the round

Both asked for after a live night on 10 September 2026, and both REVERSE
something this repo had deliberately built. The reversals are recorded here so
nobody re-derives the old answer from first principles and puts it back.

### `stillWithoutAPrize()` is deleted

The one-prize-each rule used to lift the moment every phone in the room held a
prize. The reasoning was sound on paper — by then the rule had done its job,
and the alternative is a prize nobody can win. It was still wrong, and the
reason is not in the logic at all:

> *"Right now a single person can win but it has weird block midway through
> and its not as smooth as I'd like."*

From the room's side the valve is a BINGO button that goes **live, then dead,
then live again**, with nothing on screen explaining either change. Nobody in a
pub is tracking how many other tables hold a prize, so the second transition
arrives from nowhere. A rule that is correct and unreadable is a rule that
reads as the app being broken.

So it is absolute: win once and you are out of the running for the rest of that
round. One state change per phone, forwards only.

**The cost is real and is deliberately not automated away.** Five prizes among
three phones now leaves prizes four and five unwinnable for ever. Lifting the
rule automatically to fix that is the rig running backwards — it takes back
something the room was told a minute earlier, which is the exact fault this
whole area exists to avoid. What the app owes the host instead is *knowing*:

- **`view.stalled`** — everybody who has completed the card already holds a
  prize. Playing on may still turn up a new card, so the advice is "play on,
  new round, or hand it over".
- **`view.noneLeft`** — every phone in the room holds a prize. Nothing can
  ever land. The advice is "new round or finish", and **it must not say play
  on**: that would be a quizmaster calling songs at a room that cannot answer.

Two flags rather than one, because the wrong advice is worse than none.

### The codes are held until the round is over

> *"The QR codes should all appear at the end."*

This reverses an answer of *"both — now and again at the end"* given before he
had seen it working. A trickle of people getting up as each prize lands is the
thing the shared break was meant to replace, so a code won at the line now
waits for the last prize of that round.

**Minted at the win, held from the phone.** Losing the mint would be the
original *"my bingo winners didn't receive a QR code"* complaint rebuilt from
scratch, so `issueVoucher()` is untouched and only `playerView()` filters.

**Three ways a held code is released, and all three are load-bearing:**

| Way out | Why it has to be there |
|---|---|
| `allPrizesGone` | the ordinary path — the round finished |
| phase `FINISHED` | a host pressing *Finish* on a round that can never pay out its last prize must not take a real drink off somebody |
| an earlier `round`, or `carried` | `newRound()` bumps `state.round` and deliberately does NOT clear `vouchers`, and a part boundary carries them — without the stamp, round two would hold round one's code back for ever |

A voucher written before the `round` stamp existed has no `round` and is
treated as an earlier one, so it shows. **Every unsure case shows**: a held
code is a prize somebody standing at a bar cannot prove.

**The host's own panel is never held.** They are the person a phone with
nothing on it asks, and they need the code in front of them to answer.

### And the phone has to say the code is coming

Otherwise a winner sees a blank where a QR used to be, which is the very
complaint that started all of this. The sentence rides on the line that already
names what they hold — a clause, not a panel — and it goes the moment the
banner says it better.

**It was missed on the `won` branch, and only a real browser found it.** That
branch replaces the whole status line, so the clause never reached the screen
at the one moment it matters: the beat straight after somebody wins. The
payload was correct throughout. `scripts/bingo-round-ends.mjs` drives three
phones through a three-prize round and asserts a QR is **painted** — not
present, painted — before and after the last prize.

## The scope widened to the game, and the codes stopped vanishing

Asked for on 11 September 2026, after a quiz-and-bingo night:

> *"Need to make it so when I run, say, a quiz and a music bingo that the same
> person can't win multiple prizes per quiz or music bingo, also need the QR
> codes to all appear at the end and not disappear until the bar has scanned
> them — that's the whole point!"*

### One prize per phone per GAME

One prize each was scoped to the ROUND, and `newRound()` clears
`prizeWinners` — so the table that took round one's line was fully eligible
again in round two with a fresh card. Over an evening of three rounds that is
the same person hoovering up prizes, which is the exact complaint this whole
area was built for, arriving one level up.

`state.wonThisGame` is the game-long list. **`newRound()` must never clear
it** — that single line puts the fault straight back, and it looks like
tidying. `resetAll()` builds a fresh state and therefore starts empty, which
is right: that is a new game. A fresh bingo PART is likewise a fresh game,
which is what *"per music bingo"* says.

`prizeWinners` is still consulted by `holdsAPrize()`, for states written
before `wonThisGame` existed: the safe direction is to remember a win rather
than forget one.

### A code stays until the bar scans it

Three things were wrong on a quiz-and-bingo night, none visible from the
console:

1. **The quiz engine gated vouchers on `phase === FINAL`.** A code won in the
   bingo went off the phone the instant *Continue to the quiz* was pressed and
   came back only at the final scores — with the break, which is when somebody
   actually walks to the bar, in the gap.
2. **`view.voucher` is singular.** A table holding a bingo line code and then
   a quiz prize saw one card; the other drink was unprovable all night.
3. **There was nowhere to draw a second one**, because `voucherCard(s)` reads
   `s.voucher`.

So `view.vouchers` carries every live code, at every phase with room for it,
and `wallet()` in `play.js` draws them. Never over a live QUESTION: twenty
seconds and four options, and a QR over them is the room looking down.

**A redeemed code is kept and drawn as a receipt**, which is what the bingo
card has always done — *"Collected. Already redeemed. If that is wrong, ask
the quizmaster."* One that vanishes the moment a barman scans it leaves the
one person who needs to query it with nothing to point at. The two engines may
not disagree about this.

### Neither guard could see any of it

`pub-unchanged.mjs` sets no venue and no rewards, so **no voucher is ever
minted in its walk**. Its IDENTICAL is a true statement about a night with no
prizes in it and says nothing whatever about vouchers — the sixth time in this
repo that guard has answered confidently about something outside its view.

And the first browser probe written for it looked inside `#bingoVouchers`,
which the quiz page does not have: it read 0 on a quiz screen whatever was
drawn there, and called a working feature broken. `scripts/bingo-prizes.mjs`
now asks the phone's own payload across the boundary, and
`scripts/bingo-round-ends.mjs` drives a real bingo-then-quiz order and checks
a QR is still **painted** after the part changes.

---

# CARD BINGO — a separate game on this same engine

Asked for on 15 September 2026: *"is it possible to add a bingo round based on
playing cards? So each person gets 13 playing cards and the console calls one at
a time until we have a winner?"* — and then, when the shape was put to him, the
half that decided the architecture: ***"I like 13, you can just have a row of 7
and a row of 6, it's a separate game to music bingo."***

`public/assets/deck.js`, `LAUNCHERS.cards` in `src/session.js`, `drawNext()` in
`src/bingo.js`, `dealerPanel()` in `host-bingo.js`, `node scripts/card-bingo.mjs`.

## The maths came first, and it is what made the answer yes

Every player holds an independent random 13 of 52, so the arithmetic is exact:
`P(one player done by call k) = C(k,13)/C(52,13)`, and the first winner is the
minimum over the room. Computed before a line was written:

| hand | room of 10 | room of 30 | room of 60 |
|---|---|---|---|
| 13 cards | 43.5 calls | 40.6 | 38.9 |
| 16 (4×4) | 45.3 | 42.9 | 41.5 |
| 25 (5×5) | 48.3 | 46.9 | 46.0 |

**Forty calls sounds fatal and is not, and the reason is the whole product.** On
music bingo a call is a chorus — thirty to forty seconds — so forty calls is
twenty-five minutes and a headline event. Here a call is *"seven of hearts"*,
about three seconds, so the same forty calls is **under three minutes**. Card
Bingo is a filler, and it is a filler precisely because it has no music in it.

The other number worth keeping: at the median call, **about five people in a
room of sixty are one card away**. `onesAway()` already existed, so the tension
the game needs was already computed and already on the control view.

## Thirteen is prime, and that decided the prizes

There is no rows×cols for 13, so a hand cannot be a grid, so it cannot have
lines — and the engine's own rule (`cardLines()`) says a card whose lines are
different lengths is not a fair game, which is exactly what a row of 7 and a row
of 6 would be if they were lines. So:

- **the shape is `{ rows: 1, cols: 13 }`** — `cardLines()` returns ONE line of
  all thirteen, `maxPrizes()` answers 1 by itself, and the only way to win is
  the full house;
- **the seven-over-six is a WRAP, not a shape.** The stylesheet lays the same
  thirteen on fourteen columns, each card spanning two, with the eighth starting
  at column 2 so the second row centres. **The server and every phone still
  agree that a line means all thirteen**, so this is not the disagreement that
  once had a 5×5's idea of a line running against a 4×4's;
- **one prize per round.** More prizes is more rounds — `newRound()` reissues
  everyone and already does exactly that.

## One engine, and the three places that had to learn a third game

`LAUNCHERS.cards` builds a `BingoGame`. That is not a shortcut: the state is
music bingo's exactly, so rule 6 (a card cannot be regenerated), the
one-prize-per-game rule, the held vouchers, the part-boundary carry and crash
recovery all arrive already true and already tested. A second engine would have
been six rules kept in step by hand.

**What sharing costs is that every `kind === 'bingo'` written when bingo was the
only game with a card is now wrong.** This app has form here — `perGame` in
`session.js` once read `quiz ? … : bingo`, so the DJ set inherited bingo's whole
control view and every button was a 500. Three more of the same shape:

1. **`runPlayerAction` gated `mark` and `claim` on `kind === 'bingo'`** — so
   **the game was completely unplayable**. Every screen drew perfectly, the deck
   counted up, and every tap on a square answered
   `{ok: false, reason: 'not_available'}`. Nothing threw, nothing was logged,
   and all 1,982 unit tests were green, because they call `engine.mark()`
   directly and that was never what was broken. **Found by `card-bingo.mjs`
   driving a real phone over HTTP, on its first run.**
2. **`s.game === 'bingo'` on the phone, the projector and the control view** —
   nine sites. Left alone, a card night would have got the QUIZ layout: no card
   at all, and again nothing thrown. They ask `playsACard()` in `client.js` now,
   so a fourth game with a card is one word rather than nine bugs.
3. **`perGame` itself** — `cards` is named beside `bingo` and `draw` is spread
   in only for `cards`, so `/api/host/draw` on a music night is a 404. That is
   asserted, because it is the half somebody would "fix" by accident.

## The console deals — the one genuinely new capability

`drawNext()` picks uniformly from what is left and goes through `call()`, so the
phase change, the timestamp and the flush are the ones every other call gets.
`random` is injected like `now()`, the precedent being `drawLuckyDip()`.

**There is no pre-shuffled order on the state, deliberately.** `state.called` is
already the order, already flushes on every call (rule 7) and already survives a
restart; a stored deck order would be a second record of the same fact, and the
two disagreeing is a card turned over twice in front of a room.

**Music bingo must never gain this.** There the host chooses the record and the
app writes down which — the opposite direction of travel, which is also why the
dealer's panel is a different panel rather than a button added to the caller's.

## Smaller decisions worth not undoing

- **The hand is DEALT sorted, not sorted at render** (`sortCard` on the pack).
  `marks[i]` is keyed by position, so re-ordering on the phone would leave every
  tick attached to a different card. Sorting is the one real advantage a deck
  has over a track list: thirteen cards in suit-and-rank order can be checked
  against a call at a glance.
- **The card's name is its title**, so `A♠` reaches a phone with no new field on
  any view, no whitelist edited and nothing for `pub-unchanged` to report.
  Whether it is red is DERIVED from the title by `isRed()`, so there is one
  definition of a red suit and both sides read it.
- **Red is its own colour, never `--bad`.** A scheme changes personality and
  never meaning; red on a playing card means hearts or diamonds, and borrowing
  the colour that means WRONG would say a team had mismarked half their hand.
- **There is no pack file.** A deck is fifty-two cards for ever, so a JSON file
  would be a copy of something that cannot change — and generating it keeps the
  deck out of `validateBingoPack()`, which sits on the protected launch path.
- **Its own tab, Console door only, no generator and no editor** — there is
  nothing about a deck to write, so those controls are absent rather than
  present and inert.
- **It is not sold and not gated beyond `FEATURES.LIBRARY`** — pricing is a
  question nobody has answered, and gating it on a guess answers it by accident.

## The cards are DRAWN — `public/assets/card-face.js`

Asked for the day after Card Bingo shipped with each square showing the text
`K♣`: *"would it be possible to actually draw the face cards?"*

**SVG, like the brandmark and the photo props**, because one drawing has to
serve a 45px hand square on a 390px phone and the projector's turned card six
feet wide. A canvas needs a raster per size and is soft at one of them; a
`viewBox` is exact at both, and `currentColor` means the stylesheet decides what
red is rather than the drawing carrying a second definition of it.

### It also fixed something already shipped

`♠♥♦♣` live in Unicode's Miscellaneous Symbols, and **a phone is entitled to
render them as emoji** — a colour heart, and worse a blue-and-orange diamond
that is not a red suit at all. That is the rule this app already sets for the
bin icon, the seasonal shapes and the avatars: *drawn, never emoji*, because
some phones and some projectors render a character as something else entirely
and this one is six feet wide. The engine still *names* the card `7♥` — that is
its `title`, unchanged, which is why nothing in any payload moved — but nothing
draws that character any more. `test/card-face.test.js` pins it.

### Two things the render caught that no unit test would have

- **Every pip below the middle was flying off the card.** A lower pip is turned
  over the way a real card does it, and the first version wrote
  `rotate(180 x y)` inside a transform list that had **already translated the
  origin to that point** — SVG reads the centre in the new local system, so the
  pip landed twice as far out. A seven drew four pips, a two drew one, the Ace
  drew none. Nothing threw and all fifty-two cards rendered. It was visible only
  by drawing the whole deck and **counting**, which is now what the test does.
- **The index came out smaller than the text it replaced** — a real 7px rank on
  a 45px card, where the plain `K♣` it replaced had been 20px in the middle.
  Prettier and harder to read is the wrong trade on the one screen somebody
  scans against *"seven of hearts"*. It is about **16px** now, which is **still
  a loss against 20** — and what pays for it is the pips, a second channel for
  the same fact that the plain text never had. A seven is read off its pattern
  without the corner being read at all.
- **And then the enlarged index collided with the top-left pip**, on every card
  that has one there. A real deck avoids this with a SMALL index in the corner
  margin; this one cannot, because small is unreadable at 45px. **So the pip
  field gives way instead** — it runs 0.30 to 0.84 rather than 0.19 to 0.81,
  which is why its middle is 0.57 and why **what turns over is everything below
  THAT rather than below the card's own middle.**

### The court cards do not get a figure, and that was measured

Three designs were drawn at the real 45px: a crowned figure over a collar, then
three deliberately different silhouettes, then a tilted cap with a plume. **All
three came out as the same dome-and-bar blob** — indistinguishable from each
other and reading as kitchenware.

That is the pack cards' own lesson arriving again — *cartoon figures were tried
and do not read; at the real card size a whole person is a blob* — and the rule
there says not to re-propose them without new evidence. **This is the evidence,
and it says no.** A Jack, Queen and King are drawn the way an Ace is: one large
suit pip under a rank letter big enough to read across a table, which is also
how anybody reads a court card in a fanned hand — off the index, never off the
picture.

**A real figure would work at the dealer's 120px and on the projector**, and
that is the one place worth spending the drawing. Deliberately not built: a card
that is a portrait on one screen and a letter on another is two drawings to keep
in step, and nobody has asked for the big one.

### Smaller decisions

- **There is ONE index where a real card has two.** The second, upside down in
  the far corner, exists so a physical hand can be fanned from either end — a
  screen has no other end, so it was thirteen little rotated numbers of noise.
  Dropping it is what paid for the size of the one that is left.
- **The pip LAYOUT is the standard Anglo-American arrangement**, which is
  centuries old and belongs to nobody — but **the shapes are drawn here** rather
  than taken from any modern deck, because this app is SOLD and a published
  deck's artwork is somebody's copyright even where the arrangement is not.
- **`cf-plain` against `cf-solid`** is why the caller says which it wants: on a
  phone the square already has a dark ground so a black suit must be LIGHT; on
  the dealer's panel and the projector the card prints its own white ground so
  the same suit must be DARK. One drawing, two grounds, decided in the
  stylesheet rather than by passing colours in.
