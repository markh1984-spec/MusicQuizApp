# Photographs on the night — the ask, the vote, the second screen

**The other half of the photographs is in
[`photos.md`](photos.md)** — where they are stored, how they are published, the
lamps, the pins and the gallery. **This file is what a photograph DOES on the
evening it is taken**, which is a different subject and had grown to a third of
that file.

The boundary is the one Gigs and Calendar already run on: `photos.md` is the
RECORD — what survives the night and who may see it — and this is the NIGHT
itself, the screens in the room and the phones in it.

---

## One camera photo starts the night — the gate, and the way past it

*"I think one photo as a cost to enter the night's entertainment is fair, no?
Not per game or per round, one single photo at the start to kick things off.
The first 10 mins before the first game is ample time."* Then, after an
argument: *"they're not paying customers — it's free entry lol. Yeah make it
awkward to join without taking a camera photo."*

**THIS REVERSES `sending it is the consent`, AND THE REVERSAL WAS ARGUED WITH
FIRST.** Twice. The objection put was the strong one rather than the taste one:
consent is not freely given if refusing costs you the thing you came for, a
recognisable face is personal data, these go on a public gallery, and the app
is SOLD — so whatever ships here becomes every other quizmaster's risk too. The
answer that carried it was that **entry is free**, which is a fact about this
business the argument had assumed the other way round. Recorded because the
next session will find the old rule and needs to know it was overturned
knowingly rather than forgotten.

### What "awkward" turned into

- **THE CAMERA IS FILLED AND THE WAY PAST IS A PLAIN LINE UNDER IT.** That is
  the whole of it. A skip that is hidden, delayed or buried is a dark pattern,
  and the people it would catch are not the ones being aimed at: a phone with
  no working camera, somebody who does not want to be findable, somebody
  helping a mate who cannot see the screen. **The skip keeps the 44px touch
  floor** — it is a smaller decision, not a smaller target, and the person
  reaching for it usually has the least reason to be made to fight a screen in
  a dark pub.
- **IT OWNS THE LOBBY AND NOTHING ELSE.** At kick-off it is gone and everybody
  plays, sent one or not. That is *"ten minutes is ample"* read literally and
  it is the version that cannot cost somebody the night. **Do not extend it
  past the lobby** without deciding, out loud, that a phone may be locked out
  of a question.
- **NEVER DRAWN WHERE IT WOULD BE A LIE.** No camera on this night —
  `photosOpen` false, or the host's kill switch pressed — and there is nothing
  to ask for, so there is no gate. A control that cannot be satisfied is worse
  than no control.
- **IT REPLACES THE LOBBY MENU RATHER THAN SITTING ABOVE IT.** Both at once is
  two primaries, and the game wins: it is the one that does something the
  instant you press it.

### The camera test, and which way it errs

**`looksCameraTaken()` ALREADY EXISTED** and reads the EXIF `Make` tag off the
raw file before the upload's own canvas strips it. Its own note is what makes
it right for this: **it can UNDER-count and cannot OVER-count** — nothing
manufactures a `Make` tag, but a photograph forwarded through WhatsApp has had
its EXIF removed by WhatsApp. A fresh snap keeps it. So "camera, not an upload"
is exactly the line it draws, and the direction it errs in is the one the way
past exists for.

**AND IT IS THE PHONE'S ASSERTION, not proof.** `camera=1` on the upload is set
by the phone. A determined person could lie; this is a pub, and it is the same
trust the whole app runs on. **Never claim otherwise** — the `capture`
attribute is a hint too, honoured on iOS, varying on Android and ignored on a
laptop.

### Where each half of the answer lives

- **THE ANSWER IS THE SERVER'S — `photoDone`, from `photos.cameraShotBy()`.** A
  phone that reloads mid-lobby (a wifi blip, a backgrounded tab) must not be
  asked again for something it has already done, and a flag it kept itself
  would be gone. **Spread in only when true**, so a night where nobody has sent
  one is byte-for-byte the payload it always was.
- **ON THE ROOM, NEVER IN AN ENGINE.** It sits beside `photosOpen` in
  `viewFor()`. Photographs belong to the room — that is why the DJ set got the
  camera, the wall and the gallery for free — so a fact about them cannot be
  one engine's to answer, and putting it in one engine is how a rule ends up
  living in one of two.
- **THE SKIP IS THE PHONE'S**, a module binding. It is a decision about this
  screen, and a re-render on every state push would put the gate back over
  somebody who had just stood it down.
- **AND IT IS IN THE LOBBY'S CARD KEY.** *A card key is a fingerprint of what
  it draws, never one field of it* — **fifth sighting.** The gate replaces the
  whole lobby menu, so a key naming only the phase said nothing had changed
  when it cleared: the skip drew, the flag flipped, and `draw()` declined to
  rebuild. **Pressing it did nothing**, and nothing threw.
- **AND THE CAMERA SHEET SAYS WHICH IT WAS.** A camera-roll pick is still kept
  and still goes up — the wall has never cared where a picture came from — but
  it does not answer the ask, and the one moment somebody will read that is on
  the screen that just told them it sent. Finding out by going back and seeing
  the same question still up reads as the app being broken.

### The guard, and the false pass it started with

`node scripts/photo-to-start.mjs` drives real phones over HTTP and a real
browser: the gate draws, the camera button can be pressed
(`elementFromPoint`), the skip is a real 44px target, an upload does **not**
clear it, a `camera=1` post does, pressing the skip stands it down and brings
the lobby back, and at kick-off it is gone. Each half verified by putting the
fault back.

**ITS FIRST RUN PASSED A CHECK ON AN EMPTY PAGE.** The join selectors were
wrong, so the phone never joined — and *"the lobby game is not offered while
the gate is up"* was satisfied by there being no lobby at all. A guard that is
satisfied by nothing having happened is this repo's oldest fault; that check
now asserts the gate is present in the same breath.

---

## THE FUNNIEST PHOTOGRAPH OF THE NIGHT — the host shortlists four, the room votes

`src/photo-vote.js`, `photoVoteCard()` / `photoVotePanel()` in `client.js`,
`cards.photoVote` in `screen.js`, `state.photoVote`, `node
scripts/funniest-photo.mjs`.

Asked for on 16 September 2026, as the second half of a conversation about
getting more photographs out of a room: *"the funniest photo of the night
getting a free drink is actually a really good idea, perhaps you could let the
crowd vote on their favourite as well to get a free drink?"* — and then the
shape, chosen off four options: **you shortlist four at the break.**

### Why a human picks the four

A vote over everything the room sent is forty thumbnails on a projector nobody
can read and a scroll on a phone. Worse than unusable, it is the app putting
**every** photograph up for public judgement, including the one somebody sent of
their mate looking rough at half nine.

Four is a screen, a glance and one tap. And the judgement it takes — which four
are actually funny — is a second's work for a person on a microphone and cannot
be automated without being confidently wrong in front of a room. That is rule
4's own arrangement: *the NUMBER is what tells the host which it is*, here
wearing photographs.

**The second judgement is deliberately his too.** A row belonging to somebody
who is already holding a live voucher is MARKED with a 🍺 rather than removed.
Removing it would be the app overruling a vote the room has not yet cast;
marking it puts the fact in front of the one person who can weigh it.

### It is a flag, not a phase — with one difference from the other three

Rule 9, and it behaves exactly as the scoreboard, the advert and the photos
slide do: over the top of whatever the night is doing, nothing to undo, refused
over a live question, and it clears the other three as they clear each other.

**The one difference is what a MOVE does to it, and it is deliberate.** A
scoreboard cleared by pressing Next has lost nothing — press it again. A vote
cleared by pressing Next has thrown away what forty people just did, silently,
and there is no putting it back. So every move **settles** it instead: the
tally is taken, the winner is named, the drink is minted, and the quiz carries
on. `settlePhotoVote()` on all three engines.

**`start()` was the one that got missed** — added only because
`funniest-photo.mjs` failed on it. The break this was built for is the ten
minutes BEFORE the first question, so *Start* is the button that most often
ends one, and it was the single move without the call. `next()`, `back()`,
`finish()` and `askQuestion()` all had it. A reasoned list of "the moves" had
the important one missing from it.

### What each screen is told, and why they differ

| | the four | the live counts | the winner | the code |
|---|---|---|---|---|
| **projector** | yes | **never** | yes, with the count | **never** |
| **phone** | yes | never | yes, no count | winner's own only |
| **control view** | yes | **yes** | yes, with the code | yes |

- **NO RUNNING TALLY ON THE WALL.** A count six feet wide turns the vote into a
  bandwagon — the last twenty people to look up would be voting on what is
  winning rather than on what is funny. It is `whoPicked()`'s own arrangement:
  the room gets the result, the person on the microphone gets the numbers,
  because what he says next depends on them. **Structural, not a rule this file
  has to keep**: `voteForScreen()` does not build the field at all.
- **THE CODE IS NEVER ON THE PROJECTOR.** It is a bearer token for a drink and
  that is the one screen in the app sixty people read at once — the draw's own
  rule, and `funniest-photo.mjs` asserts it.
- **AND NO SENDER'S PLAYER ID GOES ON ANY WIRE.** The shortlist has to carry the
  sender or the drink cannot find anybody, so `Photos.shortlist()` puts it into
  `state.photoVote` and every view builder strips it out again. Rule 3: a player
  id is a bearer credential and the projector's payload goes to anybody holding
  the join code. **The guard sweeps the WHOLE payload for every real id** rather
  than naming `photos[].playerId` — a named check only ever catches the field
  somebody thought of. Verified by putting the leak back.

### The prize is the last one on the table, and it is NAMED on the button

`photoVotePrize()`. The lucky dip's own choice and the same argument: the last
prize is the smallest, and the smallest is what a raffle prize actually is.

**What is deliberately NOT copied is that draw's floor of three prizes**, and
the difference is how each is reached. A draw happens by itself at the final,
where nobody can see what it is about to give away, so it needs a rule. This
happens because a host pressed a button — so the button says *"Put 4 to the
room — winner gets: A pint"*, and a night with nothing on the venue's list says
so and mints nothing.

**A human reading the prize beats a rule guessing at it.** On a three-prize
night this offers third place's drink, which on some nights is exactly right and
on others is a round the venue did not budget for. The person who knows which is
the one holding the microphone.

### A tie is broken at random, once, by the engine

Four photographs and forty voters ties often enough to need an answer, and every
alternative is worse: *earliest* rewards being quick rather than funny, and
asking the host to pick turns the room's vote into his. `random` is injected
like `now()`.

**Decided ONCE and written into the state**, exactly like the lucky dip: closing
twice — which a flaky connection, a second press and a restart all do — must not
name a different photograph to a room that has already heard the first. And the
counts go up **with** the winner, so a room that watched 12–12 resolve is told
that is what happened rather than shown a landslide.

**Nobody voting is not somebody winning.** An empty vote closes with no winner
and mints nothing, rather than handing a drink to whichever photograph happened
to be first — the floor `issueVouchers()` already keeps for a row that scored
zero.

### One file for three engines, and the contract test made that decision

`photo-vote.js` is `notes.js`'s shape exactly: state in, result out, neither
engine's `changed()` called from inside. Two copies would be two rules, and the
day one is fixed is the day a bingo night behaves differently from a quiz night
for no reason anybody chose.

**`test/engine-contract.test.js` failed the moment the methods were written**,
which is what forced the real decision: shared, or behind a `kind` check. It is
shared — a break happens on a bingo night too, and **on a DJ set a photograph is
not a side-show but the entire currency of the game**, a request being gated on
sending one. Gating this on `kind` would have been *a kind test written when
there were two games* for the fourth time.

**A DJ set gets no voucher**, and that is the documented degrade rather than a
special case: there is no reward list to read, so `closeVote()` names a winner
and mints nothing.

### The voucher

- **`funny: true` and `place: null`.** Without the marker the card downstream
  reads `place || 1` and tells somebody who came eleventh that they won the quiz
  — the app contradicting the projector on the one screen they are about to hold
  up at a bar.
- **`withdrawVouchersNoLongerOwed()` SKIPS IT.** That pass reads the scoreboard,
  which has nothing whatever to say about whose photograph was funniest, and
  without the exemption it would delete a live code the moment the final scores
  went up.
- **NO `round` STAMP, which is what lets it show on a bingo night.** Bingo holds
  a code back until its round ends so the prizes appear together — right for a
  prize won on the card, wrong for this one. A voucher with no `round` reads as
  "not this round" and shows, which `issueVoucher()` already calls the safe
  direction; here it is also the wanted one.
- **AND A PART BOUNDARY SETTLES IT FIRST.** `advanceOrder()` builds a fresh
  engine with `photoVote: null`, so a vote cast at the break before *Continue to
  the bingo* would have evaporated — every vote lost, no winner, no drink, and
  nothing thrown. The tenth entry on the list of things a part boundary did not
  carry, caught before it was one.

### The guard, and what it caught

`node scripts/funniest-photo.mjs` — three phones, a projector and a control
view over real HTTP, plus a REAL BROWSER leg because *a test that the payload is
right proves nothing about whether anybody drew it.*

**`pub-unchanged.mjs` says IDENTICAL on all of this and says it confidently.**
It never posts a photograph, never opens a vote and never mints a voucher — the
fifth time this repo has had to write that sentence down.

Five real findings on its first runs, all silent:

- **the missing `start()` settle**, above;
- **the host route wraps a session action as `{ ok, view }`**, so a check
  reading `body.winner` was `undefined === undefined` — a guard passing by
  looking in the wrong place, which is worse than one that fails;
- **a vote run at a REVEAL leaves the winner's phone empty**, because
  `VOUCHER_PHASES` has no reveal in it. The app was right and the guard was
  walking a path a host never walks;
- **`act()` on the control view swallowed its own answer**, so a panel had no
  way to put its button back or say what to do instead. It hands the result
  back now;
- **the id sweep flagged a phone's OWN id** on its own payload, which is what
  `you.id` has always been.

Verified by reintroducing three faults — the leak, the missing settle, and the
tap that lights nothing — and watching each one fail.

---

## THE SECOND SCREEN — `/wall`, a code and the photographs, and nothing else

`wallView()` in `server.js`, `public/assets/wall.js`, `public/wall.html`, the
**Second screen** button on the control view, `node scripts/second-screen.mjs`.

Asked for on 16 September 2026: *"if I'm doing karaoke, then the karaoke screen
requires use of one of the output screens. But then if I'm trying to get photo
uploads during the night as well, I would need a second screen for that second
QR code and photo uploads. I wonder if it's possible for the app to have
multiple outputs."*

### Why this was small, and it is not the obvious reason

The obvious reading is "multiple outputs" — a hard problem about one app driving
two displays differently. It is not what this needed, because of a decision
taken months earlier for something else entirely:

> **Photographs live on the ROOM, not on the game.**

That is what gave a DJ set the camera, the wall, the gallery and the private
repo for no code at all. It also means a screen that wants only the join code
and the pictures needs **no engine, no phase and no game** — so the second output
is a page reading the room, not a second view of the quiz.

### It cannot show the quiz, and that is structural

`wallView()` returns `{ kind, open, photos }`. There is no question in it, no
answer, no scoreboard, no phase — **because that function does not build them**,
not because anything hides them.

That matters more than it first looks. A second output is exactly the screen
that ends up somewhere the host is not standing: a telly behind the bar, a stand
by the door, a monitor facing the other half of a long room. *The projector and
the host's phone show different things* has to hold for a third screen from the
moment one exists, and the cheapest way to hold it is to never build the payload.

**`second-screen.mjs` asserts it by SWEEPING rather than naming fields.** It
diffs the wall's payload against the *projector's* — the list of everything a
screen could ever be told — so a game field arriving here fails whatever it is
called. And it checks the projector still has eighteen such fields, or the sweep
would pass by comparing against nothing.

### A page, not a second `/screen`

Every `role=screen` client in a room gets the identical `screenView()` and
always has. That is correct — two projectors at one night must agree — and it is
precisely why a second output cannot be one of them: opening `/screen` twice
mirrors it.

**A route rather than `/screen?wall=1`**, because the two are opened side by side
on one laptop and dragged to separate displays, and a query string is the first
thing lost to a bookmark.

### What it draws

The DJ screen's layout, which was already 90% of this: the code on the left
holding a fixed share of the width, the photographs filling the right as they
land. Chosen off three options — the alternative of a bare QR is right for a
small telly, and a version carrying a corner of the game was turned down for
making this screen care about the quiz, which is the whole thing that keeps it
simple.

- **THE CODE IS THE ONE THING THAT MUST NOT SHRINK** — `min(100%, 46vh)`, the
  lobby panel's own lesson, where a square QR on a wide short display came out
  at 166px. Everything else on this screen gives ground first, and the guard
  measures the rendered width rather than trusting the rule.
- **THE ADDRESS IS PRINTED IN WORDS UNDER IT.** A camera that will not focus in
  a dark pub leaves somebody typing it, and this screen has the room.
- **THE FRAME IS BUILT ONCE AND REFILLED.** A photograph arriving every few
  seconds all night would otherwise rebuild the QR each time, and a code that
  flickers while somebody is pointing a camera at it is the one thing here that
  has to be still.
- **THE EMPTY SIDE SAYS SO.** Ten minutes before anybody has sent one, the right
  half is the biggest thing on the display — blank, it reads as a screen that
  failed to load, which is the projector's own *nothing is a real answer* rule.
- **TWENTY-FOUR SHOWN, NEWEST FIRST.** `forScreen()` already caps at forty; this
  cap is about what can be SEEN, since nothing clears this screen all night and
  past about two dozen each picture is a stamp.
- **ONE COLUMN BELOW 900px** — a second output is often a telly in portrait or a
  tablet on a stand, and two columns there gives a QR nobody can scan.
- **AND IT TAKES NO SOUND.** `room.sting` is `role === 'screen'` only, so the
  soundboard still comes out of the one laptop wired to the PA. A second screen
  joining in would double every press — and on a karaoke night the main output
  is not even this app's.

### The photographs are NOT the projector's painter

`paintShots()` is its own thing and deliberately not lifted out of `screen.js`.
The projector's is a strip plus a moment in the middle of a quiz, torn down
whenever a phase has no room for it; this is a grid beside a code that stands all
night. **Two different jobs that happen to draw photographs** — sharing them
would put both sets of rules in one function, and the projector is protected
surface, which is a bad thing to refactor for a screen it will never draw.

`screen.js` is a page module and could not have been imported anyway.

### Three things the guards caught

- **The wall was falling into the PHONE's branch of `viewFor()`** and being
  handed `photosOpen` and `photoDone` — facts about a handset that has joined a
  game. Harmless on the day, and exactly the shape that stops being harmless:
  the `else` is where the next field lands by default, and this is the role
  meant to be told *less* than every other one.
- **`test/slugs.test.js` failed the hour the route was written** — a venue
  called *The Wall* slugs to `wall` and would have shadowed it. That list is a
  test rather than a habit for this exact reason, and this is the second time it
  has paid.
- **The guard's own join-code check was wrong**, not the code: the host key runs
  the HOUSE room, which has no join code by design. It asserts the wall and the
  projector agree about the room instead — a property that is true of every
  room rather than most of them.

### The loose end, stated rather than guessed at

On a pure karaoke night there is no quiz running, so a phone scanning this code
lands in a lobby that says the quiz starts shortly. Nothing is broken — the room
is real, the camera works, the photographs arrive — but the words are a quiz's.
**Not fixed blind**: the phone's lobby wording is on the protected surface and
the right change depends on whether these nights are quiz nights with karaoke in
them or karaoke nights with a camera, which is a question for the host.

---

## THE QUIZMASTER'S OWN CAMERA — `POST /api/host/photo`, and no new app

Asked for on 16 September 2026, the morning after the one-bucket conversation:
*"Another thing I'd absolutely love to be able to do is have, say, like an app
on my phone, or even just be able to bring up a PWA on my phone, that I take
photos and it goes into that same bucket from that same evening."*

### There is no new app, and that is the answer rather than a shortcut

An app and a PWA are both guesses at a MECHANISM. The requirement underneath
them is *take a photograph on my own phone, during the night, into tonight's
pile* — and the thing already in his hand all night, signed in, pointed at his
own room, open behind a microphone, is the control view.

A separate page would need its own install, its own sign-in and its own way of
knowing which room it is looking at, in exchange for a button the page already
had room for. Three new ways to be wrong at the moment there is least capacity
to notice, for nothing the existing page could not do.

**So it is a control in the panel headed *Photos on the big screen*, beside
the switch that already governs them** — `myCameraRow()` in `host.js`.

### It could NOT be a join, and that is the interesting half

The obvious build is: join your own room on your phone like anybody else, and
`POST /api/photo` takes the picture. It even nearly works — that route asks
only that the player exists.

What it costs is a row on the leaderboard and a team on the projector. The app
already has a word for somebody in the room who is not a contestant —
`setOrganiser()` in `engine.js`, written for *"the client's own contact and
their IT person"* — and its own comment says why it exists: *"the person who
booked you ends up winning their own event, which is a story that gets told."*
The quizmaster joining his own quiz to take a photograph is that fault reached
from the other direction, and `setOrganiser` is a quiz-only action with no
control on any screen, so it is not a way in either.

**The room comes from WHO IS SIGNED IN**, the rule every `/api/host/*` route
follows. No player, no token, no team, no row.

### Why it is its own route rather than a host action

Everything under `/api/host/*` begins `const body = await readJson(req)`, which
consumes the body — a photograph threaded through there arrives as a parse
failure. So `POST /api/host/photo` sits immediately ABOVE that block and reads
raw bytes, the same arrangement the Stripe webhook needs one layer up.

It is still behind the broad *"everything below this line needs an account"*
gate, so it gained no surface of its own.

### One bucket, which was the whole ask a day earlier

It goes through `photos.add()` and nothing else. That means it is on the
projector's strip, on `/wall`, in the host's grid with a bin on it, and filed
into the night's folder in the private repo by the same background write as
every other photograph. **There is no second store and nothing downstream knows
where a picture came from.** One bin press takes it off all three, which is what
`my-own-camera.mjs` actually measures.

**The existing `POST /api/past-photo/<night>` is the other half and is
untouched** — that one files against a NAMED night, straight to the repo, for
the car park and the Monday. This one is tonight's live room. They meet in the
same folder.

### The decisions inside it

- **NO CAPTION.** `teamName` is empty, and the screen only draws a
  `<figcaption>` when there is one. A picture of the room captioned with the
  name of the person who took it is not a caption anybody wanted six feet wide.
- **NO `capture` ATTRIBUTE ON THE INPUT.** Forcing the camera takes away the
  sheet iOS already offers, whose first entry is the camera anyway — so one
  control covers both *photograph the room now* and *send the three good ones
  from earlier*. Which it was is read off the raw file's EXIF by
  `looksCameraTaken()` and only ever decides gallery eligibility.
- **THE KILL SWITCH APPLIES; THE BREAK PLAN DOES NOT.** `photosWanted()` also
  answers *is the camera being offered to PHONES right now*, which is a question
  about the gaps in the night and nothing to do with the person driving it.
  `photos.add()`'s own `enabled` check does apply, because a photograph accepted
  into a store the screen is ignoring is one that vanishes with no explanation.
- **THE REASON IT IS OFF OUTRANKS WHATEVER HAPPENED LAST.** Written the other
  way round first and the guard caught it: after one successful upload the row
  said *"Added — it is on the screen now"* for ever, so switching the room's
  photographs off left the one control that would tell you why still reporting a
  success from ten minutes earlier. **A status line that cannot be overtaken by
  the current state is a control that lies.**
- **IT SITS UNDER THE PANEL'S OWN LINE, NOT ABOVE IT.** Put above it first and
  the screenshot said why not: that sentence describes the whole panel, so a
  control wedged in front of it left the description reading as a note about
  the button — two dim grey lines stacked, the second explaining the thing
  three rows up. The resting words were cut with it: the panel already says
  photographs go straight to the screen, so his line only has to say the one
  thing that is different about his, which is *"Yours goes in with the
  room's."*
- **THE STATUS LINE IS A MODULE BINDING.** This panel is rebuilt on every state
  push — and a photograph landing IS a state push — so a line written into the
  element would be wiped by the very success it was reporting. The vouchers
  fold's rule, again.
- **IT IS ON THE SHARED RENDER LINE**, so it draws on the bingo desk and the DJ
  desk too, and on a karaoke night with no game loaded — which is the night it
  is most wanted on. Photographs belong to the ROOM, not to any engine.
- **`shrinkPhoto()` MOVED INTO `filters.js`** rather than being copied. The
  Community door's batch had the numbers inline (1600, `square: false`, 0.85)
  and this wants the identical ones; two copies is one that gets a number
  changed.

### The PWA half, deliberately not built

Installing `/host` to a home screen wants a `manifest.webmanifest` and an
`apple-touch-icon`, and **iOS wants that icon as a PNG**. This app draws its
mark as SVG (`brandmark.js`) and has no dependencies, so producing a PNG is a
small separate job — and a manifest with no icon is worse than none, because
iOS then uses a screenshot of the page.

**"Add to Home Screen" already works on `/host` today** without any of it. It
gets a screenshot for an icon and opens in a browser tab rather than standalone,
which is a cosmetic loss, not a functional one.

**Do not add a service worker for this.** Every push is a deploy, and a service
worker that has cached `host.js` is a control view running last week's code in
front of a room — the one failure mode this app cannot afford, bought for an
offline mode nobody needs in a pub with the wifi working well enough to upload
photographs.
