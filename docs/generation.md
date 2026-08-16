# Generation — writing quizzes, checking them, and what it costs

The reasoning behind the generation rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

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

### The read-through shows the PICTURES

A picture round cannot be checked by reading it. The whole question is "whose
face is this", so four names with no face above them says nothing about the one
part that can be wrong — and the drawing is the half made by a different
supplier, costing money, that occasionally comes back as somebody else
entirely. `pictureFor()` in `console.js` puts it above the options, small, with
a link to the full size: judging a likeness at 120px is not judging it.

**It does not try to say whether a picture is real or a placeholder**, and that
is deliberate rather than lazy. `/quiz-images/` falls back to an SVG of the
same name when the artwork has not been made — that is what makes a pack
rehearsable before a penny is spent — so the URL is identical either way and
any guess in the browser would be a guess. The Pictures panel on the pack card
answers that properly, by counting them, and a placeholder is obvious on sight
anyway: it is a lettered card rather than a face.

A question whose file is missing entirely says "No picture for this one yet"
rather than showing a broken image, which is an `onerror` on the tag because
the browser cannot know until it has tried.

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

### The same name in half the questions — *"I saw Adele far too many times"*

`same-option` in `reviewWarnings()`, and a line in the writing brief. Reported
by the host after the first real night, about a general knowledge round where
one act was an option in four questions out of six.

**It is the SAME SHAPE as the answer history above and it exists because that
one cannot see this.** `question-history.js` keys on the ANSWER, deliberately —
so a name that is never right and always on screen is invisible to it. The
generation brief is the other half of the cause: *"the three wrong options must
be plausible… same era, same genre, comparable fame"* is right for ONE question
and pulls everything at the same handful of names across ten.

So both ends are done, and the split is the one this file keeps recording:
**the brief stops the over-ask being wasted, and the mechanical count is what
actually holds**, because a model asked not to repeat itself does it anyway and
the failure is silent. No API call, and it catches it every time.

Four details, each there for a reason:

- **One flag per NAME per round**, not one per question. The complaint is about
  the round and the fix is to rewrite several questions; ten flags saying one
  thing is a panel you stop reading.
- **But it is hung on the first QUESTION carrying the name**, because a tick
  lives in `question.checked` and `setWarningChecked()` finds the question by
  id. A flag with no question is one the tick silently does nothing to — it
  lights, the reload puts it back, and the host learns the panel lies. Every
  other flag in that file is per question and this one had to be too.
- **And the tick is read across the WHOLE round**, which was wrong first time
  and was caught by its own test. Reorder the round and the first question
  carrying the name is a different one, so a tick read off that one alone
  springs back open on a flag somebody has already read. The id is
  `same-option:<slug of the name>` for the same reason: never a position.
- **A third of the round, and never fewer than three.** Two in ten is ordinary;
  two in four is not worth saying either, which is what the floor is for. A
  name repeated inside ONE question's options is a different fault and is
  counted once.

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

---

## What the room asked for — THREE BUTTONS, not a box

`src/round-ideas.js`, `src/room-asks.js`, the card on the phone's final
screen, the panel above the quiz generator, and the switch on My account.

*"A customer finishes a quiz and thinks 'wouldn't it be great if there was a
reggae round' — they can just drop it into the suggestion box."* It is the
cheapest market research a quizmaster will ever get: from the people who were
there, on the night, answering the one question that decides what to write
next.

**IT WAS A TEXT BOX FOR A DAY AND THE HOST REPLACED IT, correctly:** *"maybe
instead of an open text box, can it have three randomly generated ideas based
on rounds I don't have in the library?"* Everything below about sixty
characters and grievances was the OLD design defending itself against typing;
the new one removes the typing.

**NOTHING A STRANGER TYPES EVER REACHES THE QUIZMASTER.** The three come from
`ROUND_IDEAS` on the SERVER; a phone sends back an `ideaId` and the label is
looked up here. So there is no moderation question to manage, no word filter
to argue about, no "durrr I was bored", and nobody has to read anything to
find out whether it was worth reading. That is a stronger guarantee than any
length cap, and it is why the cap stopped being the interesting part.

**It is also better DATA.** A box collects opinions of wildly varying quality
from whoever could be bothered to type; three buttons collect a VOTE, and a
vote can be counted — *"fourteen of the twenty who answered wanted reggae"* is
a sentence that decides what to write next. Typing on a phone in a pub is a
wall most people will not climb; tapping one of three is not.

**ONLY WHAT IS NOT ALREADY ON THE SHELF.** Each idea carries the `words` that
would give it away in a pack title, and any idea matching one is dropped
before the three are picked — offering a Motown round to somebody who owns the
Motown quiz wastes one of three slots and makes the app look like it has not
read its own library. A library holding everything asks NOTHING rather than
repeating itself: `roundIdeas` comes back empty and the card does not appear.

**THE SAME THREE ALL NIGHT, and that is what makes it countable.** Chosen once
at LAUNCH and written into the game state like the look, the card shape and
the prizes — so every phone in the room votes on the same three, the numbers
add up to something, and a restart at half eleven brings back the same
question rather than a fresh one. `random` is injected exactly like the prize
draw's, because "it offered three the library has not got" is not a thing you
can assert against `Math.random`.

**One vote each, and voting again REPLACES it.** A room reading three options
out loud to each other changes its mind, and a button that stops working is a
button somebody taps four times. Keeping both would count one person twice and
make the number a lie.

**A SWITCH ON MY ACCOUNT, OFF UNLESS TURNED ON** — the host's own call: *"this
is the sort of feature that should have an on/off button in the QM's settings
tab."* `prefs.askRounds`, read at LAUNCH, which is why the panel says *"it
takes effect on the next night you launch"* — a switch that appears to do
nothing tonight looks broken. It is a PREFERENCE and not a tier gate: it
grants nothing, it decides whether three buttons appear on a phone.

**AND THE PANEL THAT ANSWERS IT IS UNGATED.** It was gated on
`owner.generate` for a day, which meant a quizmaster could turn the switch on,
have their room vote all night, and never be shown a single number — **a
switch whose answer is invisible to the person who pressed it is worse than no
switch.** Generating is the owner's; wanting to know what the room asked for
is everybody's, and what they do about it — write their own, buy one, request
one — is not this panel's business. It draws nothing when there is nothing to
say, so an account that never turns it on never sees it.

**A SEPARATE BOX FROM THE QUIZMASTERS' ONE.** `suggestions.js` is subscribers
writing to the owner, read on a Monday as a work queue with somebody waiting
for a reply. Strangers' one-liners from a pub would bury it.

**IT COMES OFF THE PHONE, NOT A QR** — and the QR was what was asked for, so
the reason matters: the projector's one QR belongs to the VENUE (the
come-back slide), and a second one competes with it for the same cameras.
Everybody who played already has the app open on the results screen, so a box
there costs no scanning and no screen. The token does three jobs at once —
it proves they played, it makes anonymous flooding impossible without joining
first, and it tags every ask with the NIGHT and the VENUE for free.

**YES OR NO, AND NO IS A DELETE.** The host's own shape, and it is this
file's Monday rule: a queue that shrinks as you work it costs a fraction of
one that only grows. There is deliberately no "rejected" state — a list of
things you have already said no to is a list you read twice.

**AND IT IS A ROUND IDEA VOTE, NOT FEEDBACK BY THE BACKDOOR**, which was the
host's own worry: *"'durrr I was bored' is not useful or relevant."* Three
things keep it that way, and none of them is a filter:

- **There is nowhere to type.** The strongest of the three, and the reason the
  other two matter less than they did.
- **It only exists at the END**, on a phone that played. There is no comment
  box open all evening and there never was.
- **No still costs one tap.** The worst case is a second of somebody's Monday
  rather than a moderation queue.

**The free-text path is still in `room-asks.js` (`add()`, `MAX_ASK`,
`cleanAsk()`) and nothing calls it from the app.** Left deliberately: it is
what reads a night filed before the vote existed, and `cleanAsk()` is what
tidies the label on the way in. **Do not wire a text box back onto it** without
reopening the paragraph above.

**Grouped by idea, most-asked first** — four people wanting reggae is a
different fact from one person asking four times, and it is the number that
decides whether it is worth a pack. The kept list is grouped too, or one idea
four people asked for looks like four jobs.


---

## How many questions of each type


`roundPlan()` in `src/generate-quiz.js`. `rounds` is a list of `{ type, count }`
— or bare type names, which take the fallback — so "fifteen general knowledge,
five pictures and ten first-letter" is one call. It used to be one number
applied to every round, which is not the shape of a quiz night.

The console has a count next to each round's tickbox. Unticking greys the
number rather than hiding it, so what you typed is still there when you tick it
back on. `roundPlan` is also the whitelist and the clamp, in one place, so a
typo is dropped rather than quietly becoming a round of general knowledge.

---
