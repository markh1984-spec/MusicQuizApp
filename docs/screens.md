# The screens — projector, phone, looks and the moments on them

The reasoning behind the the screens rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

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

**A PHOTO STILL COVERED IT ON THE LOBBY, AND THIS SECTION IS WHY THE FIRST FIX
DID NOT CATCH THAT.** Reported live, from a real night: a Polaroid popping up
mid-lobby sat over the join code. `photoClearance()` in `screen.js` had been
tuned once, against the SMALL corner code above — a box a few percent of the
screen wide — and never re-checked against the lobby's own code, which this
section says plainly is a **big** one, most of a grid column. A fixed
`padding-right` correct for the small box left the big one wide open.

Fixed by measuring instead of guessing: `photoClearance()` finds whichever of
`#joinCorner` or the lobby's `.qr-panel` is actually on screen and reads its
real position, so one function serves both sizes without needing two tuned
numbers that could drift apart the next time either layout changes. Two CSS
custom properties carry the result — `--photo-clear` (how much of the right
side of the screen to leave alone) and `--photo-max-w` (a cap on the `<img>`
itself, so a wide landscape photo cannot outgrow the reserved gap the way a
narrow portrait one naturally would not). Both fall back to the original
tuned values if nothing can be measured, so a projector that skips the
measurement is no worse off than before this fix, never unconstrained.

Verified live against a real quiz: a real photo uploaded through the actual
phone route, watched arrive over real SSE, on both the lobby (100px clear of
the `.qr-panel`) and a round board reached by playing nine real questions
(235px clear of `#joinCorner`) — not a fixture standing in for either.

---

## The countdown before kick-off

`state.startsAt`, `setStartsIn()` in `src/engine.js`, and the **Tell the room**
row in the control view's Setup panel. The code goes up at ten to and the quiz
kicks off at nine; this is what fills that gap. The projector and every phone
carry the same number off the same server clock.

**IT CANNOT ALERT A LOCKED PHONE AND DELIBERATELY DOES NOT TRY.** A real
notification needs Web Push, and on iOS Safari that only works once somebody
has added the site to their home screen — which nobody in a pub is doing, so it
would reach about half a room at best. Sound is blocked without a gesture and
dies on the silent switch; `navigator.vibrate()` has never existed on iOS.

**And it does not need to, which is the host's own point and it changed the
design rather than excusing it:** *"some people will tell other people, and
so they'll be like, oh, the quiz is starting soon, and then they'll all come
together."* Five phones out of thirty is a room that tells itself. So this is
built to be **unmissable when somebody looks** and to give the room something
to point at — never as a notification, and no effort is spent chasing one.

**MINUTES FROM NOW, NEVER A WALL-CLOCK TIME.** "Nine o'clock" on a projector is
a commitment the app has made on the host's behalf: run four minutes late and
the big screen has told sixty people so. A duration is an intention, and
pressing 10 again pushes it back with one tap. Nothing on screen ever names a
time that can be missed.

**AT ZERO IT SAYS "ANY MOMENT NOW" AND STOPS.** It never counts up. A countdown
is a promise, and the app must not be the thing that tells a room the host is
behind.

**IT NEVER STARTS THE QUIZ.** The host presses the button, exactly as before —
a quiz that began on a timer would begin while they were at the bar getting a
drink in. Same shape as the budget ceiling that warns and never refuses. There
is a test that the phase is still `lobby` long after the countdown expired.

Four smaller things, each with a reason:

- **An ordinary night gains NOTHING.** `startsExtra()` spreads the field in
  only when there is one, so `pub-unchanged.mjs` reports 3,210 identical
  payloads with no `--ignore` at all. Same discipline as the vouchers.
- **Lobby only, as well as cleared by `start()`.** Belt and braces: a stale
  timestamp over a question would be a countdown to something that has already
  happened, on the one screen that must carry nothing but the question.
- **It ticks in the animation loop, not on a state push.** Nothing pushes while
  a lobby sits there with nobody joining, so a countdown painted only on
  `updateLobby` would freeze and then jump when the next person arrived.
  Recomputed from the server's timestamp every frame like the question clock,
  so a phone and the projector can never drift apart.
- **The countdown REPLACES "hang tight" on the phone**, and that had to be done
  in the painter rather than when the card is built — the card is only rebuilt
  when the PHASE changes, and a countdown set while everybody is already in the
  lobby changes nothing about the phase. Both lines were on screen at once the
  first time it ran.

**The quiet second value is that a phone with something ticking on it stays in
the FOREGROUND.** "Hang tight" gave nobody a reason to stay on the page, so
they switched away, the tab backgrounded and the stream had to reconnect when
the quiz began. That is arguably worth more than the countdown itself.

Three presets and Off rather than a number to type: this is set with one thumb
while holding a microphone, and five, ten or fifteen minutes covers every
version of "we are nearly ready".

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
