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

