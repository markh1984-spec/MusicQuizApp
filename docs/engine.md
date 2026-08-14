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
