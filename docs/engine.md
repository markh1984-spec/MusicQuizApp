# The engine — phases, scoring and what each screen is told

The reasoning behind the the engine rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## Stopping a quiz early

`Engine.finish()` jumps to `PHASES.FINAL` from wherever the quiz is. The Setup
panel — with "Clear everything" — only appears in the lobby and at the end, so
before this there was no way to end a night early except pressing onwards
through every remaining question.

It keeps every score and clears the scoreboard and advert flags, and `back()`
from FINAL returns to the round board — so a mis-tap on the host's phone is one
press to undo. That is why it is not a reset.

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

---

## Online mode is ONE BOOLEAN, and the branch count is a budget

`state.online`, set at launch and living in the game state like the look and
the card shape. The host's own summary of what it is meant to be — *"so is the
idea that we just flick a tab and boom you're in online mode, but the core quiz
engine is exactly the same?"* — is exactly right, and it is a promise that has
to be actively defended rather than something that stays true on its own.

**The way it stays true is that almost nothing reads it.** Every place that
branches on the mode is a place a Wednesday in a pub can break, so the number
of them is a budget rather than an incidental detail. As built:

| Where | What it does |
|---|---|
| `freshState()` | declares it `false` |
| `session.launch()` | sets it from Tonight's own switch |
| the launch route | reads it off the body |
| `playerView()` | reports it, and **the one real branch** — the prompt and the screen's own extras |
| `play.js` | renders the question **if it was sent** |

**ONE branch in the engine.** The scoring, the clock, the phases, the tally,
the fastest finger, the reveal, crash recovery, the projector, the host's
control view, bingo and every pack are untouched and cannot tell the
difference — which is why the same pack runs in a pub on Wednesday and over a
video call on Thursday with no second version of anything.

**The phone deliberately branches on `s.prompt` rather than on `s.online`.** It
renders what it was given instead of deciding for itself what kind of night it
is, so the decision lives in exactly one place — and a payload that forgot to
send the prompt degrades to the pub layout rather than to an empty box.

**Anything added for online mode must not raise that count without a reason
worth writing down here.** Chat, teams and the media layer all hang off the
same flag; if one of them needs a second branch inside the engine, that is a
design decision to argue about rather than a line to slip in.

**THE VIDEO IS MEANT TO BE NATIVE, ON CLOUDFLARE — not Zoom, not Teams.** The
host's own words on 14 August 2026: *"no online mode needs to have Cloudflare
wired in"*, *"not using Teams or Zoom, it needs to be native to the app"*.
Written down here because it was settled in a chat and existed nowhere in the
repository, so a fresh session reading the code would have concluded the
opposite — as one did, out loud, the same afternoon. **NONE OF IT IS BUILT
YET**: there is no `getUserMedia`, no WebRTC, no Cloudflare call anywhere, and
the media layer is the honest gap rather than a thing that half exists. What
online mode does today is the two rows above — the prompt goes to the phone
and chat turns on — and that is all it does.

It is worth being precise about which half is which, because the pricing
already depends on it: `FEATURES.STREAM` is sold as the thing that pays for
itself per use, and the per-use cost IS the video. The boolean is free; the
faces are not.

**The SWITCH is built and the transport is not**, and that is deliberate
rather than an oversight — the flag decides what a phone is told, which is
engine work and testable today, and it will not change shape when the video
arrives underneath it.

**And prove it with bytes, not with tests.** `node scripts/pub-unchanged.mjs
HEAD~1 --ignore online` runs the old engine and the new one side by side over
every pack and compares every payload. Adding online mode came out at 2,150
identical comparisons with one new field. Run it after every step of this
work; "the tests pass" is a weaker claim than the one anybody actually wants
the night before a gig.

---

## The alphabet round — no options at all

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

---

## The intro round skips the dead air, and that is a SCORING fix

`public/assets/cue.js`, `cue.from` on an intro question, `position_ms` on the
Spotify play call, and **Skip the dead air** in the editor.

`from` has existed on every intro cue since the round was written, with a
`0:00` placeholder, and it was only ever **a note the host read**. It plays
now.

**IT IS SCORING, NOT POLISH, and that is the whole reason it was worth
building.** The twenty-second clock starts when the question goes up and the
track starts at the same moment — so a track with two seconds of silence or
fade-in at the front takes two seconds of score off **everybody**, for a
reason that has nothing to do with whether they knew it. Ten questions, ten
different amounts of dead air, and the round scores inconsistently with
nothing on screen to blame it on.

**That is the same argument this file already makes about the picture round's
four reveals running on ONE curve** — how fast a question becomes answerable
IS how many points it is worth, so anything varying it per question quietly
changes the scoring and nobody can attribute it. Same fault, different round,
and it went unnoticed for as long as it did because the cause is in the AUDIO
rather than in any code.

**What is trimmed is silence; what must NEVER be trimmed is how quickly a
track becomes recognisable.** That is the question's difficulty and it is the
round. A famous four-note opening should be answerable faster than a track
that takes a bar to declare itself.

**DO NOT "fix" this by giving the intro round a longer clock.**
`questionSeconds` is overridable per round and 25 seconds looks like it
absorbs the dead air. It does not: scoring is the base plus seconds-remaining
times ten, so a longer round is a round worth MORE points — the reveal-curve
fault again, introduced deliberately this time.

Five things that are load-bearing:

- **An unreadable offset plays from the START, which is what happened before
  this existed.** `cueOffsetMs()` returns `null` for prose, a negative, `1:75`
  (sixty-plus in the seconds half is a slip rather than an intention) and
  anything past ten minutes — and the server then sends no `position_ms` at
  all. So the cost of a typo is the old behaviour, never a silent jump into
  the middle of a song in front of a room.
- **EVERY PACK ON DISK SAYS `0:00`**, so nothing already written moves and
  this was safe to deploy mid-season. There is a test that walks `quizzes/`
  and fails if a cue ever arrives with an offset on it — which is also what
  would catch a generated pack inventing one.
- **The generator is now told to write exactly `0:00`**, because only somebody
  who has LISTENED knows where a track's audio begins. The brief used to say
  "a timestamp like 0:00", which was an example rather than an instruction —
  fine while the field was a note, and a plausible-looking guess the moment it
  drives playback.
- **The editor ECHOES what it understood, on every keystroke.** An offset
  typed wrong and quietly ignored is a track playing from the top while the
  box looks accepted — the same fault as a cue whose title was corrected and
  whose URI was not. So it says "Skips the first 2.5 seconds", or "Not a time
  — it will play from the very start", and says nothing at all for an empty
  box because nobody is being nagged for leaving the default. Repainted in
  place rather than by re-rendering, or the focus leaves the box mid-number.
- **The control view prints it only when there IS one.** It used to print
  "From 0:00" on every intro question in the app, which is a line that says
  nothing. It is still worth printing when set, and the reason is the failure
  case directly under it: auto-play starts at the offset, but **Open this
  track** opens at the top of the file, so that line is the instruction for
  the night Spotify is asleep.

**The offsets have to be set by ear, and that is the honest cost** — ten quick
listens per pack, once, stored in the pack for ever. Spotify's Audio Analysis
gives exactly this (`track.end_of_fade_in`) and is **deprecated for apps
created after November 2024**; this app's is new, so expect a 403. Do not
design around it without confirming against the real app first.

**The other half of `cue` is still not built** and is filed in TODO.md as 5f:
editing a track's title or artist does not repoint `cue.spotifyUri`, so a
corrected cue reads right on the control view and plays the wrong track
through the speakers.

---

## The draw from the bottom half — a retention feature, not a raffle

`drawLuckyDip()` and `state.luckyDip` in `src/engine.js`, the band under the
podium in `screen.js`.

Asked for by the host on 14 August 2026 and his reasoning is the design: **a
table that works out by round three that it cannot win has nothing left to
stay for**, and a room that thins out at nine is worth less to the pub than
one that stays till eleven. This is the reason to keep answering after the
scoreboard has stopped being interesting.

**STILL PLAYING AT THE END IS THE POINT.** Eligibility is answering the LAST
QUESTION THE NIGHT ENDED ON — exactly the behaviour being paid for, and also
what stops the failure it would otherwise have: drawing somebody who left at
half nine, calling their name on the mic, and getting silence from a room
that then watches the prize go nowhere.

**"Answered in the final ROUND" was the first version and it was far too
loose** — most nights this app runs are one round, so it collapsed to
"answered anything at all", which every phone that ever joined satisfies.
Caught by its own test drawing a table that had stopped after question one.
The last QUESTION is the only definition that means the same thing on a
one-round night and a five-round one, and it is sayable on a microphone:
**you had to still be in it at the last question.**

**The same prize as third place**, at the host's own instruction — so a venue
putting up three prizes runs a draw and one putting up fewer does not, with
nothing extra to set up and nothing extra for the pub to agree to.

Six things that are load-bearing, all tested:

- **Nobody wins twice.** With five players the bottom half reaches third
  place, who is already holding a voucher, so anybody with one is out of the
  hat. A second code in one hand is one of them looking valid and not being.
- **TWO IN THE HAT MINIMUM.** One eligible person is a gift, not a draw, and
  calling it a draw is a lie the room can see.
- **Decided ONCE, in the state**, exactly like the vouchers. `Back` off the
  final and forward again is one press each way and a host will do it; a
  second roll would name a different person to a room that heard the first.
- **The ENGINE draws, never a phone**, and `random` is injected like `now()`
  so the draw is testable at all — "it picked the right person" is not
  something you can assert against `Math.random`.
- **The projector gets the NAME and never the code.** The name is the moment;
  the code is the credential and goes to one phone, like every other voucher.
- **A draw voucher has NO PLACE.** `place: mine.place || 1` would have given
  it first — telling somebody who finished eleventh that they had won the
  quiz, in a room that had just watched somebody else win it.

**On screen it is a band BELOW the podium and deliberately not on it.**
Somebody who came eleventh has not beaten anybody, and a medal would say they
had. The count is printed — *"drawn from 9 still playing at the last
question"* — because that is what makes it obviously fair to the eight who
did not win, and it is the sentence that gets people to stay in next week.

**The legal question was asked and answered: entry is FREE.** The pubs are
paying for a full room on a dead night, not selling tickets — so a free-entry
draw is exempt and there is nothing to work around. **If a venue ever charges
per team, this needs looking at again before the prize gets big**, because a
paid-entry draw is a different thing in law.

---

## A phone must not say you were right before the projector does

`scoreBefore` on an answer, `positionsAtStart` on the question, and
`scoreToShow()` / `positionToShow()` in `src/engine.js`.

Found by the host mid-test: tap the right answer and the running total at the
top of your own phone went from 0 to 360 **instantly** — so you knew several
seconds before the reveal and before anybody slower had finished. In a pub
that is one table telling the next; online it is a message in the chat. It
also spoils the reveal for the person themselves, which is most of what a
reveal is for.

**Everything built to keep that secret was already correct, which is what
makes it worth writing down.** `playerView()` withholds `correct`, `points`,
`isFirstCorrect` and the part marks until the reveal, with a comment saying
exactly that — and the header beside them gave it away anyway. The two fields
nobody thought of as secret were the leak.

**THE FIX IS NOT TO SCORE AT REVEAL TIME.** Points come off the clock at the
moment of answering and the first-correct bonus depends on the order answers
land, so moving the arithmetic would move the SCORING — the one thing that
must not move. The engine scores exactly as it did; only what a PHONE is told
changes. There is a test that the player object and the board carry the points
immediately.

- **The score** is held at what it was before this question, read off
  `scoreBefore` on their own answer record.
- **The position too, or it is the same leak wearing a different hat** — hold
  the total alone and a phone still says "0 points, 2nd of 12" the instant you
  tap something right. Snapshotted once at `askQuestion()` rather than worked
  out per push: the board is rebuilt whenever anything changes, which during a
  question is every time somebody answers, and a second board per push is the
  quadratic shape `leaderboard()` was rewritten to remove.
- **Somebody who has NOT answered sees their real total**, which is the same
  number either way — otherwise the field becomes a tell in the other
  direction: *"my number went stale, so my answer must have registered"*.
- **The host sees it live**, because that is what their board is for, and the
  projector cannot leak to a phone. `leaderboard()`, `hostView()` and
  `screenView()` read `player.score` unchanged, with a test each.
- **A game running through a redeploy degrades to the live figure** rather
  than throwing: an answer recorded before this existed has no `scoreBefore`,
  and their own total is what they were looking at a second ago.

**It also found a blanket spread that should never have been there.**
`hostView()` built its clock as `{ ...s.question }`, so `positionsAtStart`
joined every host payload the moment it was added — a map of every player id,
on every push, because nobody decided it should be there. The other two views
already listed the four clock fields by name; this one does now. **A whitelist
is supposed to BE the decision**, which is the whole of rule 1, and a spread
quietly opts every future field in.

---

## The picture round's four reveals

`REVEAL_MODES` in `src/quizzes.js`: **zoom** (the original, and still what a
round naming nothing falls back to), **pixelate**, **blur**, **tiles**. A round
names one, a question can override it, and `mix` rotates through all four **by
position, not at random** — so a Redo mid-gig hands the room back the effect
they were half way through watching rather than a fresh scramble. There is a
test for exactly that.

**A GENERATED picture round is `mix`, and for two years of packs it was not.**
The mode existed, the four effects existed, and `generateQuizPack()` never set
a reveal at all — so every generated round fell back to zoom and the first real
night came back *"the image round was too samey"*. The fix is one word in an
object literal, which is exactly why there is now a test on it: nothing else
anywhere would notice it going missing. Safe by construction rather than a
judgement call, because of the paragraph below — all four run on the same
curve, so the round is worth the same points whichever it draws.

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


---

## The picture round's four reveals — the full note


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


---

## The intro round's cue — the full note


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
