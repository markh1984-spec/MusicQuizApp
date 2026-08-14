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
