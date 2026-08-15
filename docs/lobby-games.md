# The lobby games — what a phone does while the room fills up

The reasoning behind the lobby-game rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## MAZE MOUTH — THE LOBBY GAME, AND IT IS NEVER CALLED PAC-MAN

`public/assets/maze.js`, `lobby-game.js`, `state.gameSeed`, `state.arcade`.
Asked for as *"a little game to play on their phones while they're waiting…
like an old school video game like tennis or pac-man"*, and the host's own
line once it was built: *"I'm going to call it Pac Man but obviously the app
won't do that."* That is exactly the right split and it is worth writing down,
because **the app currently gives the game no name at all — and an empty name
is an invitation.** The strings are "Play while you wait", "Put it away" and
"Tap where you want to go"; the next session to touch this will feel the gap
and the obvious word to fill it with is the one that cannot be used.

**IT IS A LEGAL LINE, NOT A TASTE ONE.** The name, the maze, the characters
and the sounds are Namco's, and this app is SOLD — the same reasoning already
recorded for photoreal pictures of living musicians, where UK fair dealing
does not cover commercial entertainment. Our maze, our chasers, our words.
Say it on a mic all you like; do not print it.

**EVERY PHONE PLAYS THE SAME GAME, and that is what makes the scoreboard mean
anything.** The host's catch: *"the game has to be consistent or else the
scoreboard makes no sense."* The chasers wobble one turn in four, so two
people who faced different wobbles were not comparable and the higher score
might only have been the luckier one. `gameSeed` is set at launch and lives in
the state, so it is the same for everybody and survives a restart — the
arrangement `roundIdeas` and the prize draw already use, for the same reason.

**IT CANNOT REACH A QUIZ, and there are tests for each half.** The seed is in
the phone's payload at the LOBBY only, a score is refused at any other phase,
and the board is on the projector at the lobby only. A game still running
while question one is read is the single way this could make a night worse
rather than better.

**BEHIND A BUTTON, BELOW THE PHOTO CARD** — *"don't want to disincentivise
photo uploads"*. The photos are what reach the projector and what a night is
remembered by; a game opening over them would quietly cost the quizmaster the
feature this app is actually for. The module is imported only when the button
is pressed, so nobody who never plays pays for it on pub wifi.

**NO CONTROL PANEL: you tap the maze and it walks there**, shortest route,
recomputed every step. A swipe has to be READ — was that up, or
left-and-a-bit-up — and a misread swipe costs a life; a destination cannot be
misread. Frantic tapping replaces the target rather than queueing it, so there
is no backlog. **`touch-action: none` on the canvas is load-bearing**: rapid
tapping fires mobile Safari's double-tap zoom, so without it the keenest
players are the ones who zoom the page instead of moving.

**ONE POST LEAVES A PHONE, at game over.** Never a stream of positions — the
lobby is precisely when sixty people are joining, which is the one path in
this app that must not stutter.

**IT IS CALLED MAZE MOUTH**, named by the host, and that closes the gap this
section was written to flag: an unnamed thing keeps inviting the wrong name.
It is on the button a player presses and in the file headers, so there is a
right answer to hand.

**EACH MOMENT HAS A PRIMARY: MAZE MOUTH BEFORE THE QUIZ, PHOTOS BETWEEN THE
ROUNDS.** The host's own split, and it is better than offering both equally
everywhere. The lobby is dead time with nothing on the projector, which is
exactly what a game is for; a round board is when the room is already looking
up and a photo can have its moment on the big screen. So the waiting screen
leads with the game and carries the photo underneath it, and everywhere else
the game does not exist at all.

**The photo is not REMOVED from the lobby, only quietened.** Somebody
arriving with their mates takes the group photo as they sit down, and that is
the upload this app most wants — *"don't want to disincentivise photo
uploads"*. It simply stops being the loud one for those few minutes. **And
the floating camera button stands down in the lobby** while the menu offers
the same thing, because two controls for one job is how somebody uses the
worse one out of habit — and the floating one is the worse one here, an icon
with no words against a row that says what it does and what happens next.

**Between rounds was asked about and left at the lobby.** At a round board the
host is talking and the scores are up, and somebody mid-game is somebody not
looking up at the moment the room is wanted; in the lobby there is nothing to
compete with. It is one constant to change if a real night says otherwise.

---

## RALLY — the bingo night's game, and it is not called Pong

Built on 15 August 2026, the second lobby game and the first one that had to
answer *"which game does this night get?"*. Asked for as *"we can add tennis as
well — tennis before the music bingo games and maze mouth before the quiz?"*

**The point of a second game is that a bingo night stops being the quiz with
different content in it.** The lobby is the emptiest screen in the app on a
bingo night in particular — three lines of reassurance about a card that has
not appeared yet — and it is the screen people leave. A phone that leaves is an
SSE connection that has to come back at the moment sixty of them would, which
is the reliability half of this feature and the reason it is not sold away from
the bottom tier.

### The name was chosen before a line was written

CLAUDE.md already records that Maze Mouth went unnamed for a while and that
**an empty name is an invitation** — the obvious word to fill the gap with is
always the one that cannot be used. So this one was named first. It is
**Rally**: what tennis players call the thing you are actually doing, one word,
and nobody's trademark. Pong and Breakout are Atari's, this app is SOLD, and UK
fair dealing does not cover commercial entertainment — the same reasoning
`portraits.js` already carries about photoreal pictures of living musicians.

There is a test that neither word appears outside a comment in any of the three
files, because the paragraph above is exactly the kind of thing a future
session reads, agrees with, and then forgets while naming a variable.

### A FIXED TIMESTEP IS A FAIRNESS RULE, NOT A PERFORMANCE ONE

This is the one genuinely new problem the second game brought, and it would
have been invisible.

Maze Mouth moves on a 150ms grid, so it is the same game on any handset without
anybody having had to think about it. A ball is not: advanced by the frame
delta, a 120Hz phone and a tired 30Hz one accumulate floating-point error
differently, take their bounces on different sides of a wall, and end up
playing measurably different games. **Seeding the serve would not have saved
it** — two people on one leaderboard would still have been comparing their
handsets, which is precisely the unfairness the seed exists to remove, arriving
through a door nobody was watching.

So `tick()` in `rally.js` advances exactly one `TICK_MS` and knows nothing
about real time; `lobby-rally.js` accumulates real milliseconds and spends them
as whole ticks, carrying the remainder. Same seed and same taps means the same
game on any phone in the room.

**And the accumulator is CAPPED, which is a pub problem rather than a
theoretical one.** Somebody puts their phone face down on the table, the tab is
backgrounded, `requestAnimationFrame` stops, and two minutes later they pick it
up and the loop is handed a single 120,000ms step. Spent honestly that is every
remaining life lost before the screen has repainted once, on a game nobody was
playing. `MAX_CATCH_UP_MS` means the game simply misses the time, which is the
truthful outcome.

### The control, and why it is one axis

The rule for any lobby game is **a control with no precision in it**. Maze
Mouth is tap-where-you-want-to-go because a swipe has to be READ — was that up,
or left-and-a-bit-up? — and a misread swipe costs a life. A bat only needs one
axis, so here there is nothing to read at all: the bat is wherever your thumb
is along the bottom.

**It is ABSOLUTE, not a drag.** Relative dragging means the bat is wherever you
last left it plus however far you have moved since, which after two frantic
returns is nowhere you can predict. Putting your thumb somewhere and having the
bat BE there is a thing you can do without looking at your hand.

**And the bat is not on the bottom edge.** Sixteen units of court below it is
where a thumb rests, so the hand is off the thing it is aiming. That is the one
real cost the maze has to live with — *"a finger held on the maze covers the
thing you are trying to look at"* — and with one axis it can simply be designed
out rather than worked around.

### Playable is a thing that has to be TESTED, not looked at

The three ways a bat-and-ball game is broken are that it cannot be lost, cannot
be won, or never ends — and **not one of them shows up in a screenshot**. So
`rally.js` holds the rules with no canvas in them at all and exports
`playOut(seed, controller)`, which plays a whole game headlessly; the tests then
write "a perfect bot", "somebody who never touches it" and "a thumb" in four
lines each and assert the game sits between them.

That found two real faults before anybody played it:

- **Three lives went in four and a half seconds** for somebody who never
  touched the screen, because the ball left the middle of the court the instant
  a life was lost. There is a beat before each serve now, and a test that names
  the number.
- **The other bat never missed on the first rally**, because its aiming error
  was drawn in `restart()` and the first serve never goes through `restart()`.

The opponent's aim is the same trick as the chasers' one-turn-in-four: a bat
that tracks the ball exactly can only ever be drawn with, so the score would
be "how long before you slipped", which is a stopwatch rather than a game.

### What the second game changed underneath both of them

- **`src/arcade.js`** — the clamp, the best-not-latest rule, the refusal
  outside the lobby and the five-name board, now one copy called by both
  engines. Copying it into `bingo.js` would have been two rules, and the day
  one of them is fixed is the day a bingo lobby accepts a score a quiz lobby
  refuses.
- **`seeded.js`** — the same, for the generator. Two mulberry32s is two
  generators, and the day one is "improved" is the day two games seeded from
  the same number stop being comparable.
- **`lobby-menu.js`** — which game, the card, and the wiring, because the quiz's
  waiting screen and the bingo lobby are files that share nothing else and a
  card built twice says two different things about one feature within a month.
- **The `arcade` route is no longer quiz-only** in `session.js`. Each engine
  decides for itself which phase counts as waiting, so there is nothing there
  to keep in step.

### Two faults it turned up on the way

**The board was computed and never drawn.** Both engines put `arcade` in the
screen payload at the lobby, there was a test asserting it was there, CLAUDE.md
said *"the board is on the projector at the lobby only"* — and no projector file
ever read the field, while the phone's own button promised *"Top scores go on
the big screen"*. The test was not wrong; the payload really did contain the
board. **Nothing checks that anybody drew it.** It is now `lobby-board.js`, one
file for both projectors, inside the white QR panel and under the code — under,
because the QR is the one control that lets somebody into the game and this app
already learned the hard way that nothing may dim it.

**And the game was never stopped.** `stopArcade()` was called only from inside
`wireArcade`, which runs only while the waiting screen is being built — so the
moment the phase moved to a question the canvas was thrown away and the loop
was not. It ran for the rest of the night on a detached canvas, held a window
`keydown` listener that swallowed the arrow keys, and posted a score at every
life lost into a server that rightly refused it. Nothing showed on screen,
which is why it survived, and the comment above it stated plainly that it could
not happen. It is stopped in `buildScreen()` now: **a teardown belongs where
every phase change passes, not where the thing being torn down is built.**
