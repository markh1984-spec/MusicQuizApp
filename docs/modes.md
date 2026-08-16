# The two modes — GSD and Sweep

The reasoning behind the mode rules in CLAUDE.md.

**Read this when he types `GSD mode` or `Sweep mode`, and not before.** They
are ~5.5KB of instructions that apply to a minority of sessions, which is
exactly the shape of thing that should not be in the file every session loads.
The trigger and what the mode IS stay in CLAUDE.md; how to run it is here.

---

### "GSD mode" — Get Shit Done

**If he types `GSD mode`, switch to it and STAY in it until the to-do list is
done or he says otherwise.** It means he is at the laptop knocking through a
list, not thinking something over, and every extra word is in the way.

**ALWAYS OPEN WITH THE TO-DO LIST.** The first thing out of GSD mode is the
list itself — numbered, in the order to do them, URLs verbatim. Not a question,
not a preamble, not "shall I". If the list is not obvious from the conversation,
work it out from TODO.md and the current state and give it anyway; he will
correct it faster than he will answer a question about it.

- **Minimum context.** No reasoning, no background, no options, no "worth
  knowing". He has the context; he wrote it.
- **URLs, ALWAYS AS LINKS.** Never a bare path or a "go to Settings" when a URL
  exists — he is clicking them, not reading about them. Deep-link as far in as
  the site allows, and give the full `https://…` so it is clickable in a
  terminal.
- **A LINK BEATS A QUESTION.** If the next step depends on which service he
  uses, do not ask — list the likely ones WITH their deep links and let him
  click the right one. Asking costs a round trip; a five-line list costs him
  one glance.
- **Very succinct.** A step is a line. A list is a list.
- **YES or NO where a yes or no is possible.** Do not soften it into a
  paragraph, and do not add the caveat unless acting on it would break
  something.
- **Answer the step he is on**, not the two after it.

It is a MODE, not a personality change: the rules that stop things going wrong
still apply. If something is about to cost money, destroy a night or push to the
wrong place, say so — in one line. **Argue in normal mode, not in GSD mode**;
if a proposal needs pushing back on, note it in a sentence and raise it properly
when the list is done.


---

### "Sweep mode" — find everything, change nothing

**If he types `Sweep mode`, run a full sweep and REPORT. Do not action any of
it.** He decides what gets fixed; the output is a list he can work through and
dismiss from.

Four things at once, because they hide in each other:

- **Contradictions** — the docs against the code, and the code against itself.
  A rule stated in CLAUDE.md that the code no longer honours is the one that
  costs a future session a day.
- **Bugs** — including ones only reachable in a state nobody tests: mid-round, a
  redeploy, a lapsed subscription, a second login.
- **Vulnerabilities** — from BOTH sides. Signed in as a quizmaster reaching for
  what is the owner's, and the owner reaching into what is a quizmaster's. The
  second is the gate that runs backwards and is easy to forget.
- **LABEL COLLISIONS — two controls on one screen using one word for two
  different things.** See below; added 14 August 2026 at the host's own
  instruction, after finding one on the control view.

#### The fourth kind: one word, two meanings, side by side

**The exemplar WAS `Scores on screen` and `My scores`, next to each other on
the control view — and it is fixed, so the buttons now read `Scores to the
room` and `Scores, just me`.** One puts the scoreboard on the PROJECTOR for
the room; the other shows them to the HOST alone. Both said "scores", neither
said who was looking, and "My scores" read like the host's own score in the
quiz. The host's own test of it: *"if it's not obvious to me what it does, a
fresh QM will have no idea."*

**The fix is the shape to copy: keep the noun, add the AUDIENCE.** Renaming one
of the two would have left the other still saying only "scores" and put the
burden on remembering which was which; saying who sees it makes each label
complete on its own. It is worth nothing else on that bar, because nothing else
on it comes in two audiences.

**It is a CONTRADICTION rather than a wording preference**, which is why it
belongs in this sweep rather than on a tidy-up list: the design rules already
say *if two things on one screen use the same word for different sets, one of
them is renamed*, and *if a control needs explaining, the control is wrong*.
So a collision is the code disagreeing with a stated rule — exactly what the
first bullet is for — it simply lives in a `<button>` rather than in a
function.

**It hides from every other check there is.** It has no failing test, no 500,
no 403 and no visual defect; the page looks perfectly tidy. The only thing
that finds it is reading every control on one screen TOGETHER and asking what
a stranger would think each one did. That is the sweep's job and nothing
else's.

What to look for, and each has been seen in this app:

- **the same noun for two different sets** — "scores" for the room's and for
  yours; "packs" for the catalogue and for a quizmaster's own (solved by
  naming them **My packs** and **Quizporium packs**);
- **a label that describes the TOOL rather than the act** — "The pack editor"
  on the link somebody presses to write something; "Redo" for a button that
  wipes a question's points and asks it again;
- **a verb with no object** — "Back", "Skip", "Advert": fine when the object
  is obvious, a collision the moment two of them could take different objects;
- **a control whose only explanation is a `title`.** There are no tooltips on
  a phone, and half these screens are driven from one. A tooltip is a bonus;
  if it is carrying the meaning, the label is wrong.

**REPORT THE PAIR, NOT THE BUTTON.** A collision is a relationship between two
controls, so "rename My scores" was half a finding — the fix turned out to be
the third option, saying WHO SEES IT on both. Give the pair, what a stranger would
guess each does, and what they actually do.

**Testing is allowed; leaving anything behind is not.** Start servers, seed
throwaway data, sign in as a made-up account, probe every route — then kill it,
delete the temp directories, and leave `git status` clean. **If a probe breaks
something, fix it in the same turn and say so.**

**VERIFY BEFORE REPORTING, because the last sweep produced four "findings" that
were the sweep's own mistakes** — a route called with the wrong field name, a
parameter that is correctly ignored, a tier limit working exactly as designed.
A false finding costs him time and teaches him to skim the next report. When a
thing looks wrong, reproduce it deliberately before it goes on the list.

**Say what HELD as well as what failed.** "Rooms held against every attempt to
reach another quizmaster's night" is worth as much as a bug, because it is the
part he cannot check himself.

---

