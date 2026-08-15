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
