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
