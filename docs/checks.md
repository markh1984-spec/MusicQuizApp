# The checks — and the guard that answered without looking

The reasoning behind the *Checks* section in CLAUDE.md. **The commands
themselves are in CLAUDE.md**; this is what they are for, what they missed, and
what each fault cost.

**The one sentence to take from it:** a test that never runs the artefact proves
nothing about it, and a tool that cannot fail is a tool nobody checks.

---

**NOTHING IN THIS REPO HAD EVER PARSED THE BROWSER FILES, and on 15 August
2026 a stray backtick took the whole console down.** It was inside an HTML
comment in the template literal `launchBar()` builds its markup from, so it
ended the string early and `console.js` became a syntax error — meaning
`/console` did not load AT ALL, for every quizmaster, on the page a night is
launched from. **The full suite passed.** It always would: every file under
`public/` is a DOM module that no test imports, so the browser half of this app
was never executed by anything in here.

`test/browser-parses.test.js` closes it, and is deliberately the WEAKEST
possible guard: it runs `node --check` over every script under `public/` and
names any HTML comment carrying a backtick. **Parsing is not working** — a file
that parses can still be nonsense. What it catches is the class of fault where
the page cannot load at all, which is the class that ends a night rather than
annoying somebody. Verified by reintroducing the backtick and watching both
cases fail.

**It is the same lesson as the launch route and as the projector's arcade
board, for the third time: a test that never runs the artefact proves nothing
about it.** `node --check` on a file you edited is seven seconds; finding this
in a browser cost a round trip, and finding it in a pub would cost the night.

**`pub-unchanged.mjs` is the one to run before a gig week.** `npm test` says
the tests still pass; this says something stronger and far more useful — that
the actual BYTES a projector and a phone receive, at every phase of every pack
in the library, are identical to a commit you trust. It runs both versions of
the engine side by side on one injected clock, with the same teams answering
the same options at the same seconds. `--ignore` names top-level fields that
are allowed to be NEW, so an additive change can be waved through by name:
*"there is one new field and it is called `online`"* is a claim somebody can
check, where "some things changed" is not. It was written to answer the host
asking whether the online work would make his Wednesday awkward, and the
answer it gave was 2,150 identical payloads across seven packs.

**COMPARE AGAINST THE BRANCH YOU ARE MERGING INTO, NOT `HEAD`.** On a
committed, clean checkout `HEAD` IS the working tree, so the script runs the
same code against itself and can only ever print IDENTICAL. It is not wrong,
it is empty — and it has now been quoted as a pass twice in one day, once by
a session reporting its own finished branch. Use
`node scripts/pub-unchanged.mjs origin/MusicQuizApp` when checking work that
is already committed; `HEAD` is only meaningful while the change is still
uncommitted in the working tree.

**AND IT WAS ANSWERING WITHOUT ANSWERING — every "identical" this file quotes
above was measured with a hole in it.** `Engine.answer()` takes an OBJECT and
the script called it positionally, `a.answer(id, 0)`, so every answer came
back `unknown_player` and was dropped in silence. Every *"after the fast
answer"* comparison was a question with nobody having answered it, which put
**the scoring, the tally, the fastest finger and who-picked-what outside the
one check this repo runs before a gig week** — on a script whose own comment
said those were exactly what it was exercising.

Found on 14 August 2026 by making a deliberate change to a player's
mid-question payload and being told the payloads were identical. Fixed, and
the fix is the lesson: **the answer is now asserted**, so the script throws
rather than reporting a clean run it did not earn. A guard that quietly tests
nothing is worse than no guard, because it is believed. The picks are worked
out per round type as well — "option 0" is not answerable on a pick-them-all
question (refused unless it gets exactly the number asked for) or an alphabet
one, which is the second reason it was doing nothing.

**And a THIRD fault in the same file: it ignored the commit you named.**
`--ignore` is parsed by finding its index, and with no `--ignore` that index
is -1 — so `i !== ignoreAt + 1` read as `i !== 0` and threw away argument
zero, the ref. Every `pub-unchanged.mjs <commit>` ever run in this repo
compared against `HEAD~1` instead, and announced it in a line that looks
exactly like a confirmation. Three faults in one script, none of which made it
fail: **a tool that cannot fail is a tool nobody checks.**

**AND A FOURTH, on 15 August 2026: IT HAD NEVER LOOKED AT THE LOBBY.** The
first `compare()` came AFTER `a.start()`, so every payload this script has ever
checked was from a game already under way — **the join code, the QR, the prize
line, the player strip, the countdown and the lobby game were all outside the
one guard this repo runs before a gig week.** That is the screen a room looks
at while sixty people are joining, which is the busiest moment of the night and
the one path this file says must not stutter. Found the same way as the
answering fault: a field was added to the lobby player payload and the script
said the payloads were identical. There is a `compare('lobby')` before
`start()` now. **Four faults in one script, and every one of them was the tool
answering confidently about something it was not looking at** — when it says
IDENTICAL, the useful question is what it did not compare.

**It also says WHICH FIELD now.** It used to print the first 300 characters of
both payloads — and a payload's first 300 characters are nearly always
identical, so a real difference showed as two lines that looked the same. It
lists the differing paths, how many payloads carry each, and which roles saw
them, so the output is the claim: *"`you.score` and `you.position`, on a
phone, mid-question, and nothing on the projector or the host's screen."*

Beyond the unit tests, these were run by hand and are worth repeating after
anything structural:

- 60 phones with live SSE connections all answering at once
- `SIGKILL` mid-quiz and mid-bingo, checking the right question/track and all
  scores, cards and marks come back
- QR output decoded with a real scanner (OpenCV) across versions 1–10

**A full software audit was run before handing out a second login — see
`AUDIT.md`.** It is the record of what was checked, what it found, what held,
and — the part worth reading before promising anything — **what an audit from a
container cannot tell you**: real iOS Safari, pub wifi, a projector, a phone
camera, and the photo round trip, which has no repository configured here and is
the one shipped feature whose happy path is still unproven.

---


## NOTHING IN THIS REPO PRESSED A CONTROL, and a dead one draws perfectly

The gap dial — the little symbol in each pack tile's corner that says what the
phones do in that gap — died twice inside a week, from two unrelated causes,
and on both occasions every check in this repo passed.

**The first time it was a lost `import`.** A scripted header rewrite of
`console-breaks.js` ate `import { esc, node } from './client.js';`. The file
parsed, the suite stayed green, and the launch bar drew with no dials on it at
all: four swallowed `ReferenceError`s and nothing on screen to say a control
was missing. `test/imports-present.test.js` came out of that.

**The second time it was a moved body.** `setGaps()` was lifted out of
`console-tonight.js` into `console-breaks.js` to keep a line budget honest — a
mechanical move, correct about every line it carried — and its last statement
was `paintOrder()`, which belongs to the launch bar and does not exist in the
module it landed in. The factory it moved into had been given a `repaint`
parameter for exactly that call, and the call was never rewired.

**Both faults are the same shape, and it is a shape this repo keeps meeting:**
a name that is only read when a human presses something. The dial DREW
perfectly both times. The `ReferenceError` fires inside the click handler,
where the handler's own catch eats it. So:

- `node --check` passes — the file is valid JavaScript.
- `browser-parses.test.js` passes — for the same reason.
- The full suite passes — nothing in it constructs a launch bar.
- `pub-unchanged.mjs` says IDENTICAL — no payload changed, and none did.
- `drag-check.mjs` passed — it drove a real browser and never pressed a dial.

That last one is the instructive one. A script that opens a real Chromium and
performs real mouse drags still proved nothing about a button, because it was
never asked to. **"We drive a real browser" is not the same claim as "we press
the controls."**

### What was added

**`drag-check.mjs` presses the dial, twice.** Once proves the handler runs at
all; the second press proves it is STEPPING the dial rather than initialising
it — the same distinction the seconds field turned out to be hiding, where an
empty number input stepped to its `min` and looked like a working arrow.
Verified by putting `paintOrder()` back: three failures, naming the dial that
stuck and the `ReferenceError` behind it.

**`imports-present.test.js` forbids any module but the bar naming a `paint*`.**
The console's paint functions belong to `console-tonight.js` and `console.js`,
they are precisely what a moved body reaches for, and no leaf has business
calling one — a leaf is HANDED a `repaint` callback instead.

### And the general version was written first, and thrown away

The obvious test is *"does any module call a name another module declares,
without importing it?"* It was written, it ran, and it produced sixty findings
of which one was real. It cannot see function parameters, destructured options
bags or callbacks — which is exactly how a leaf module is supposed to receive
these things — so `segmentsNow()`, `repaint()`, `dragging()`, `packOf()`,
`act()` and `minor()` were all flagged for being handed in correctly.

Understanding those needs a real parser. **A test needing a growing exceptions
list has stopped being a test** — which is the conclusion `imports-present.js`
had already written down about itself, and `markup-balance.test.js` about
counting tags, and which had to be reached a third time before it stuck. The
short list that never lies beats the clever one that needs arguing with.

## GitHub gone quiet — `scripts/github-down.mjs`, 18 September 2026

The rule was that nothing on the protected surface waits on GitHub, and it was
true by inspection. Hanging the API behind the real server
(`test/helpers/github-hangs-stub.mjs`, loaded with `--import` through the app
helper's new `nodeArgs`) found four places it was not:

- `fetch()` has no timeout and `restoreFromBackup()` runs before
  `server.listen()`, so a deploy during a bad hour at GitHub never came up.
  Every call now carries `AbortSignal.timeout()` — 8s for a read, 20s for a
  write — and the stub had to hold the event loop open like a real socket does,
  or Node exited mid-boot with "unsettled top-level await" instead of waiting.
- The boot restore was nine reads in a row. They go out together now, and the
  two a night cannot run without (the accounts, the join codes) are read
  through `tryGetFile()` and retried a minute later while they keep failing.
- Sign-in, every invoice write and publishing a night awaited their backup.
  `within()` caps that wait at `BACKUP_WAIT_MS` and answers `ok: false`; the
  write carries on in the background.
- The console's first request after a deploy restored four files one after
  another and then ran the access check. All five go out at once, a failed
  access check is cached for a minute, and a failed restore backs off a minute
  rather than being retried on every request.

The guard measures each request in milliseconds, so the limits are the budgets
by name, not a feeling about "fast".

## The Monday build — `scripts/gig-build.mjs`

One command, one verdict. The suite, `pub-unchanged` against
`origin/MusicQuizApp` (what is LIVE, never HEAD), then every protected-surface
guard by name, each to its own log under `data/gig-build/`. `--full` adds the
slow and cosmetic ones; `--only <name>` runs one. `test/gig-build.test.js`
fails the moment a named guard stops existing.

## Three more guards for the things a gig night actually does — 18 September 2026

- **`two-devices.mjs`** — the host drives a night from a phone AND the laptop.
  Two control views press Next together; the night moves one question. The
  mechanism is `host-cursor.js`: a move carries the cursor it was pressed
  against, the server refuses one whose cursor has moved on and hands back the
  fresh view, and a press with no cursor is never refused.
- **`wifi-blip.mjs`** — Playwright's `setOffline` takes a phone, the projector
  and the control view off the network in turn, mid-question, across the
  reveal, across a Next. Each blipped device has a TWIN that stayed online,
  and the check is that the two agree afterwards — nothing in the guard knows
  what a screen should say, only that two must say the same thing.
- **`long-night.mjs`** — sixty phones with real SSE streams, forty questions,
  everybody answering every one. It measures fan-out to the sixtieth phone
  (single-digit milliseconds), memory from `/health` (`rss`, which the route
  now reports beside `streams`), and that every stream is let go of when the
  phones leave. First run: 97MB with the room in, 125MB at the end of forty
  questions, all sixty streams released within a quarter of a second.

## The ready line is checked by watching it go green — `scripts/ready-light.mjs`

The first build of the launch bar's ready line never polled: its first tick
ran before the caller had attached the node, saw it detached, and cleared its
own interval. Every unit test was green and the route answered when asked
directly; the screenshot agent caught it because the two captures were
byte-identical. The guard opens the real console, watches the line say not
ready with no projector open, opens the projector on the room's own code,
waits for "Ready for tonight" in green, closes the projector and waits for it
to go off again, then rebuilds the bar to prove a fresh line still polls.
Sixth sighting of *a test that the payload is right proves nothing about
whether anybody drew it*.

## The Monday test — what the container cannot prove, done by hand

The guards run Chromium in a container. These are the things only a human at
a real venue-shaped table can check, and they are the checklist for the day
before a gig week:

1. **Real phones on real networks** — your own on mobile data, one other on
   the wifi, iOS Safari and Android. Join, answer, airplane mode for ten
   seconds mid-question, back. `wifi-blip.mjs` on a real handset.
2. **The first minute** — open the console cold and time it. The free tier
   spins down after fifteen idle minutes; an uptime monitor on `/health`
   every five minutes removes the cold start and doubles as the alarm.
3. **The prize path** — a real venue with prizes, a short quiz to the final,
   scan the winner's code with a second phone, see the bar page say redeemed
   and the code leave the winner's phone.
4. **Two devices** — the control view on the phone and the laptop, Next on
   both at once: one question moves, one screen says "Already done".
5. **The ready line** — green once the projector is open and the venue has
   prizes. Red or stuck on "checking the server" is a report, not a shrug.
6. **My account** — no "not being backed up" line, which is the GitHub token
   still working; every deploy restores the accounts through it.

Render settings worth a glance the same day: `HOST_KEY` (or `?key=` bookmarks
die per deploy), `TZ=Europe/London` (belt and braces — the server runs in UTC),
and that the uptime monitor above exists.
