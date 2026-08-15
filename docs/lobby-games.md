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

---

## TAILBACK — a tail that grows, and the first game behind the picker

The third, built on 15 August 2026, and the first that could not simply be
handed to a night: with two games each night type had a natural default, and a
third needs somebody to choose it or it is dead code — which is exactly the
fault the projector board had been sitting in for months.

**It is not called the one-word name everybody will say out loud**, for the
reason `rally.js` sets out. Tailback is the British word for a traffic jam and
is also literally what the game is.

### An open field, not the maze

Reusing Maze Mouth's walls was the obvious saving and is the wrong game: a maze
plus a body that grows is boxed in inside thirty seconds, and the tension is
meant to be **the tail you have made** rather than the walls somebody else
drew. The only walls are the edges.

**And what is actually shared with the maze is the idea rather than the code.**
Its `stepToward()` walks a static map; this one routes around a body that moves
every step, which is a different function with the same shape. Worth saying
plainly rather than claiming a reuse that is not there.

### THE STEERING MUST NEVER BE WHAT KILLS YOU

The one way this game can be badly broken. The head is routed to where you
tapped, and if that route goes through the tail then the game has taken a life
for something the player did not do — the difference between a control and a
passenger, which is the same line Maze Mouth's tap-to-walk is drawn along.

**The tail END is not blocked, except while it is growing.** By the time the
head arrives that cell has normally moved on, so treating it as a wall makes
the tail refuse gaps it can plainly fit through — which reads as the steering
being broken. While it is growing the end stays put and is as solid as the
rest. Getting that one case wrong is a life lost to a gap that was not there.

It is checked over tens of thousands of simulated steps rather than by playing
it, because it is rare enough that five minutes with a thumb would not find it.

### The walls do not kill you, and that was measured before it was allowed

Dying at a wall is what a snake normally does, and it is **wrong for this
control**. Tapping a destination is not holding a direction: the natural way to
play is tap, watch, tap again, and the moment the head reaches the target there
is no target left — so a wall killed you for the gap between two taps rather
than for a mistake. Measured, a human-paced player got **eight to thirty
seconds for three lives**, which is not a game, it is a punishment for blinking.

So the tail follows the edge round instead, and the only danger is itself. The
obvious objection — that a phone nobody is touching then survives for ever — is
real and does not matter, and it was **measured rather than assumed**: an
abandoned game wanders, eats the odd pellet by accident and takes **forty-three
minutes to reach a score a real player passes in under two**. It cannot reach
the board, so it does not need killing. There is a test that says so.

What it buys is the shape the game is supposed to have: forgiving while you are
short, and tightening entirely because of what you have made.

### Two smaller things the tests forced

- **It waits for the first tap**, on every life. Moving the instant a life is
  lost means somebody who has just been caught out loses the next one before
  they have looked up. Same fix as Rally's serve pause, arrived at the same
  way. It also teaches the control without a word of instruction.
- **Growth is "do not trim for a few steps", never "stack copies of the end
  cell".** Stacking works, but it puts two cells in one square for a step or
  two — so the body stops being a set of occupied squares, "the tail never
  crosses itself" cannot be asserted at all, and every routing question has to
  allow for it. The weaker test was the tell that the model was wrong.

**Beelining at every pellet is NOT the ceiling**, which the first version of
the balance test wrongly assumed. Going straight at the food is a known way to
trap yourself, so a bot doing it sometimes loses to a slower player — a point
in the game's favour: the score rewards thinking about the tail rather than
reaction speed.

---

## THE PICKER, AND WHAT A TIER ACTUALLY BUYS

`public/assets/lobby-games.js` — the list, read by the SERVER and the browser,
one copy for the same reason `LOOKS` is one copy: two would be a console
offering a game the server then refused, silently, as somebody pressed Launch.

**THE TIER GATES HOW MANY GAMES, NOT WHETHER THERE IS ONE.** The host's line:
*"bronze just gets 2 games and silver/gold get more"*. The two that shipped are
Bronze's and are also the two defaults, one per game type; anything added
afterwards is what a higher tier buys.

**Do not sell the game itself away from the bottom tier.** Its biggest value is
not entertainment — a phone with a game on it stays in the FOREGROUND, so sixty
connections do not all have to come back at the moment the join gate is
busiest. That is a reliability feature dressed as a toy, and selling
reliability to the top tier only makes a Wednesday worse for the people paying
least.

**The locked ones are SHOWN, not filtered out** — the same subtle upsell the
Adverts tab uses. Somebody who cannot have a game should still know it exists,
and on this ladder the locked entries are the whole argument for moving up.

### Where the decision lives, and where it is checked

- **It is a decision about TONIGHT**, so it goes where the look and the card
  shape go: chosen at launch, written into the game state, restored after a
  crash. Not a per-account preference — a quiz night and a bingo night want
  different games, which is the host's own point.
- **THE TIER IS CHECKED AT THE ROUTE, never in the console.** The console is
  the thing somebody would edit. A game above the tier is **dropped and
  replaced by the default rather than refused**: losing a choice costs a game
  nobody has seen yet, where refusing the launch costs the night.
- **The phone honours `s.lobbyGame` and does not re-check anything.** A phone
  second-guessing the tier would mean the console saying one game is on and the
  room being handed another.
- **Both launch routes carry it** — the Tonight bar and a pack card's own
  Launch. A setting that exists on one route and not the other is a night that
  comes out different depending on which button was nearer.

### What a fourth game costs

One rules file, one canvas file, one line in `LOBBY_GAMES` and one in
`LOADERS`. The seed, the score, the board, the refusal outside the lobby, the
teardown and the picker are all shared.

**Read the fixed-timestep note above first**: anything with continuous motion
has a fairness problem the grid games do not, and it is invisible.

---

## QUICK DRAW — a shooting gallery, and the third answer to one fairness problem

The fourth game, built on 15 August 2026 at the host's own suggestion: *"a
western where you, you know, there's, like, bad guys, and they pop up from
behind a wall to shoot you, and then you have to shoot them first"*.

**The name is free, which is a first here.** Maze Mouth, Rally and Tailback all
had to be named around somebody's trademark. A shooting gallery is a fairground
stall a century older than video games and "quick draw" is an ordinary English
phrase, so for once the honest name is also the safe one.

**The control is the one already proven.** Tapping the thing you want to shoot
IS the maze's tap-a-destination with the destination made obvious — no reticle
to drag, no aim to hold, nothing that can be misread. Of the four games it is
the best fit to the rule, which is why the idea was worth taking.

### THE SHERIFF IS WHAT MAKES IT A GAME

An outlaw pops up and you shoot it; the sheriff and the barmaid pop up too and
shooting one costs a life. That single addition does two jobs, and both matter
more than they look:

- **It turns "how fast can you tap" into "did you look before you fired"**,
  which is a far better thing to put a leaderboard under. Pure reaction speed
  is a stopwatch.
- **IT IS THE ANTI-CHEAT, AND IT IS THE GAME RATHER THAN A RULE.** The obvious
  exploit is tapping all six holes as fast as you can. Nobody had to forbid it
  and no penalty had to be invented for shooting an empty hole: roughly a
  quarter of everyone who appears is somebody you must not shoot, so a masher
  loses in seconds and scores a tenth of what a player does. There is a test
  that says so rather than a paragraph asking you to believe it.

**A shot at an empty hole therefore costs nothing**, deliberately. Punishing it
was considered and is unnecessary, and a penalty a player cannot see the reason
for is worse than none.

### A SCHEDULE, NOT AN ACCUMULATOR

This is the third answer this codebase has given to the same fairness problem
and it is the cleanest of the three:

| Game | How every phone plays the same one |
|---|---|
| Maze Mouth, Tailback | a grid and a fixed step — nothing continuous to drift |
| Rally | an accumulator: whole ticks only, remainder carried, catch-up capped |
| Quick Draw | **a schedule** — the state at time T is a pure function of the seed and T |

Nothing accumulates, so there is nothing to drift. A phone sampling the clock
every 8ms and one managing 120ms land in **exactly** the same state — tested at
five frame rates, and the death times match to the fractional millisecond
rather than approximately.

**And a phone that froze does not get an easier game.** `runTo()` walks the
schedule one event at a time rather than jumping to `t`: a handset that lost a
second to the browser really did have three outlaws draw on it, and skipping
them would mean a stuttering phone quietly played an easier round.

### THE LIMIT THAT CANNOT BE ENGINEERED AWAY, and it is worth stating plainly

**A reaction game makes input latency part of the score.** A tired handset with
a slow touch digitiser genuinely is at a disadvantage, in a way it is not on a
grid, and no amount of scheduling fixes it — the schedule is identical, but the
tap lands later.

What can be done is make the windows generous enough that the difference is
noise: about **1.1 seconds** to react at the start, tightening as the game goes
on but **never below `MIN_UP_MS` (620ms)**. Past about half a second the game
stops being reaction and starts being whose phone reports a touch soonest,
which is not a thing anybody earned. Eighty milliseconds of handset should not
decide a pub leaderboard.

There is a test for the half that CAN hold: the same shots at the same moments
give the same score at any sampling rate.

### Two smaller things

- **Quicker is worth more, measured against the window you actually had** —
  never against a fixed number of milliseconds. The window tightens as the game
  goes on, so a flat scale would quietly make the late hard shots worth less
  than the early easy ones, which is the reveal-curve fault this app already
  records against the picture round.
- **Two figures never share a hole.** A tap that could mean either is the app
  taking the life rather than the player losing it — and one of the two costs a
  life.

### What it looks like, and what it deliberately is not

Silhouettes: a wide-brim hat, a body, and then **colour and shape doing the
work** — red with a dark bandana across the face, or gold with a star on the
chest. You have eight-tenths of a second to decide, in a dark pub, at arm's
length, so the two must never differ by one small detail. **Telling them apart
is not meant to be the hard part; deciding fast enough is.**

It stays a fairground stall: no brand of firearm, nobody real, nothing that
reads as anything but the Wild West — the same instinct that keeps photoreal
pictures of living musicians out of `portraits.js`. There is a test on the
words.

---

## SOUND — synthesised, off by default, and never on a timer

`public/assets/lobby-sound.js`. Asked for on 15 August 2026 for Quick Draw:
*"when you shoot an outlaw there's, like, a sound, and then, like, random
yeehaws and that kind of stuff."*

### It is synthesised, exactly as everything else here is drawn

No `.mp3`, no `.wav`, no audio library — the same reasoning as `qrcode.js`,
`brandmark.js`, `avatar.js` and `stickers.js`, and for the same three reasons:
nothing to 404 on a venue's wifi, no bytes over the one connection that must
not stutter, and no dependency that can break on a gig night. A gunshot is a
burst of noise through a low-pass that shuts as it decays; a ricochet is a
frequency sweep. Both are a dozen lines of Web Audio, which every browser this
app supports already has.

### AND THAT IS WHY THERE IS NO YEEHAW

The one thing asked for that is not built, and it is worth being straight about
rather than quietly dropping.

**A convincing human whoop cannot be synthesised** — what comes out of an
oscillator is a kazoo, and a bad one is worse than none. **A recorded one is an
asset**, which is the thing this file exists to avoid: a file to ship, to
cache, to 404, and to pay for over pub wifi at the exact moment sixty people
are joining.

So the western noises here are the ones that ARE a waveform: the ricochet
*pee-yow*, a jaw-harp twang for the wrong one, and a saloon-piano plink. **The
ricochet is the sound people actually picture when they think of a western**
and it is a pure downward sweep, so it is the one that synthesises best.

If a real yeehaw is ever wanted it is a deliberate decision to ship an audio
asset, and it should be taken as that — one small file, one place, and a note
here saying the no-assets rule was broken on purpose.

### OFF BY DEFAULT, and that is not timidity

**Sixty phones making noises in a pub while the host is on a microphone is this
app talking over its own quizmaster's show**, in front of a paying room, with
no way for him to fix it from the stage. The two failure modes are not
symmetrical — the same asymmetry the join-flood threshold is set by:

| Default | What goes wrong |
|---|---|
| **On** | the show is disrupted, in the room, and the host cannot stop it |
| **Off** | somebody does not notice there is sound |

One of those is a gig going wrong and the other is a missed garnish.

**Remembered on the DEVICE, not in the night.** The look, the card shape and
which game tonight are facts about the evening and live in the game state.
Whether this particular phone makes a noise is a fact about the phone and the
person holding it, so it is `localStorage` — the same split the fold state
already sits on the other side of.

### NOTHING IS EVER ON A TIMER

*"Random yeehaws"* is the version that annoys: sixty phones chirping at nobody,
forever, whether or not anyone is playing. **Every noise is tied to something
the player DID**, which self-limits beautifully — only somebody actually
playing makes any, a phone in a pocket is silent, and a phone left on a table
goes quiet on its own.

The ricochet in particular is kept for a STREAK rather than for every hit: a
noise that happens every single time is wallpaper within twenty seconds, and
one that means *"you are on a run"* is a reward.

### It never carries information, because most of the room is muted

A phone on a pub table is usually on silent, and on iOS the hardware switch
mutes Web Audio in Safari outright. So every game here stays completely
playable in silence: a sound may confirm something the screen already said and
may never be the only way to know it.

**The context is woken inside a real tap**, never on load — a browser will not
make a sound before a gesture and on iOS will not even build the context.

### The button is UNDER the canvas, not on it

Two reasons, and the second is the one that decided it. Every one of these
games draws its score in a top corner, so a button on the stage lands on a HUD.
And **a tap that missed the button by a few pixels would land on the game —
which on Quick Draw is a shot, and the shot could be the sheriff.** Under the
canvas it can overlap nothing and steal no gesture, and it is still on the game
rather than in a settings page: the moment somebody wants sound is the moment
they are looking at this.
