# Splitting CLAUDE.md — the plan, to be executed in a fresh session

**Why:** `CLAUDE.md` is 5,674 lines and about **90,000 tokens**, and it loads
in full at the start of every session. `TODO.md` is another ~73,000. Together
that is ~163,000 tokens of a ~200,000 window gone before a single file is
read — which is why sessions run out part-way through the second feature.

**What it is NOT:** deleting anything. The reasoning in that file is the most
valuable thing in this repo; it is why the same mistakes do not recur. This
moves it, it does not thin it.

Agreed with the host on 14 August 2026 as a **category 3** — it restructures
something he relies on — so it was asked for and approved rather than assumed.

---

## The principle: a RULE stays, an EXPLANATION moves

One file is doing two jobs and only one of them is needed every session.

| | Stays in CLAUDE.md | Moves to `docs/` |
|---|---|---|
| **What** | the rule, in one or two lines | why it exists, what it cost to learn, where it bit |
| **Needed** | every session | only when touching that area |
| **Example** | *"The answer key is never in the screen payload — `docs/engine.md`"* | the six places it has bitten and the whitelist design |

**The rule is what prevents the mistake. The explanation is what stops
somebody unpicking it.** So the rule must survive the move intact and the
pointer must be next to it.

---

## Target shape

```
CLAUDE.md            ~600 lines — always loaded
  What this is
  The words: OWNER / PARENT / CHILD, quiz / round / pack
  The rules that must not be broken (all ten, short, each with a pointer)
  Decisions already made — do not relitigate (the table, trimmed to one
    line each with pointers)
  The design rules, in the host's own words
  The GUI rules — five roles, one angle, three radii
  What Claude may do on its own — the four categories
  GSD mode / Sweep mode
  The protected surface
  Where to push
  Layout, and the map of docs/ below
  Checks

docs/engine.md       the two-screens rule, scoring, the clock, phases,
                     round types, online mode, teams, crash recovery,
                     the score/position leak, the draw
docs/screens.md      the projector, the phone, photos and props, looks,
                     the brandmark, the join corner, the podium
docs/console.md      tabs, pack cards, the launch bar, the editor,
                     navigation, the type ladder, the min-width trap
docs/accounts.md     owner/parent/child, hats, tiers, rooms, gates,
                     support access, own packs, passwords and email
docs/gigs.md         venues, prizes and vouchers, invoicing, past gigs,
                     the diary, adverts
docs/generation.md   Claude, Google/Imagen, the checker, question history,
                     portraits, the spend ledger, Spotify
docs/business.md     pricing, the ladder, Monday, the shop, marketplace,
                     referrals, group accounts, karaoke
docs/history.md      what each real night found, the sweeps, the live
                     deployment state, what is still absent
```

`TODO.md` gets the same treatment afterwards, and separately: the live list
stays, the parked strategy (marketplace, group accounts, referrals,
directory) moves to `docs/business.md` beside the pricing it belongs with.

---

## How to execute it

Work **one destination file at a time**, committing each. A half-done split
is worse than none, so each commit must leave the repo consistent: sections
either still in CLAUDE.md, or moved with a pointer left behind. Never both,
never neither.

1. Create `docs/<area>.md` with a one-paragraph opener saying what is in it.
2. Move whole sections across **verbatim** — do not rewrite, summarise or
   "improve" the prose. It is the host's voice and its length is usually
   load-bearing.
3. In CLAUDE.md, leave the RULE plus a pointer.
4. Commit. Repeat.

**Do not touch a line of application code during this.** No test can catch a
mistake here, so the change has to be provably documentation-only:
`git diff --stat` should name nothing outside `CLAUDE.md`, `TODO.md` and
`docs/`.

---

## The check, because prose has no test suite

There are **382 lines** in the current file matching
`never|must not|do not|does not|always`, and **80 table rows** in the
decisions table. Those are the things that must not go missing.

Before and after, run:

```bash
grep -inE "never|must not|do not|does not|always" CLAUDE.md | wc -l
grep -c "^| \*\*" CLAUDE.md
```

Then, for the real check, produce the list of every rule sentence from the
OLD file (git has it) and confirm each one appears either in the new
CLAUDE.md or in the doc its pointer names. Hand that list to the host — it is
the only review that can catch a dropped rule, and it is his call whether
anything looks thin.

**Reversible throughout:** the old file is in git, and every step is a
separate commit.

---

## What "done" looks like

- CLAUDE.md under ~800 lines and still answering, on its own, every "may I do
  this" question a session has
- every one of the ten numbered rules present, with a pointer
- every decision-table row present as at least one line
- the docs map near the top, so a session knows what to open
- `git diff` touching no code
- the rule-count check reported to the host

**The map at the top of the new CLAUDE.md doubles as the feature inventory
the host asked for** — "what can this app do, and where does it live" is the
same question, answered once.
