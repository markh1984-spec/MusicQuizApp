# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**A professional quiz host, running the app on their own laptop, in someone else's venue, in front of a paying room.** Hired as the entertainer, never the organiser — the app is their kit, not a service the venue operates. Two audiences on the same screen at once: the host driving from a phone or laptop, and the room reading a projector six feet wide from the back of a dark pub.

Two further roles sit around that core one, both *inferred from the account model in CLAUDE.md rather than confirmed in an interview*: a **parent account** (a pub group's head office, a small quiz company) that manages other accounts without necessarily running nights itself, and the **app owner** — one account, always, who sees every subscriber, the catalogue and the AI ledger.

## Product Purpose

Live pub and club quiz nights (music quiz) and music bingo, run by one host on one laptop. It exists to make that host's night reliable — the room never sees an error, a stutter or a stale board — while giving the host the admin tools (invoicing, past-gig evidence, marketing) that turn one gig into a repeat booking.

## Positioning

*Inferred from CLAUDE.md's stated design priorities rather than a direct claim in the repository.* A generic quiz app optimises for content variety or player engagement. This one optimises for **the host's Wednesday night going right** — the single sentence CLAUDE.md gives as the rule that decides most arguments: *"If it is flaky on a Wednesday night with sixty people watching, it is worthless."* That shows up as concrete, unusual choices a features-first competitor would not make: no build step and no dependencies (nothing to break on a gig night), a join-flood guard tuned to the actual arrival rate of a pub room rather than a generic rate limit, and a server-owned clock so no phone's timestamp can be trusted for scoring.

## Operating Context

- **The room**: a pub or club, projector plugged into the host's laptop, phones joining over pub wifi via a join code read out on the mic.
- **The host's own screen** (phone or laptop) shows what the room's screen must never show — the answer key, who answered what, the round 3 track cue — enforced field-by-field on the server, not with CSS.
- **Reliability constraints that shape the product**: pub wifi is unreliable, a redeploy or restart can happen mid-game with no permanent disk (Render's free tier), and a phone can rejoin after a crash and must land back exactly where it left off — same question, same score.
- **The host's actual week**: three businesses and one admin day (Monday) for replies, the topical pack, and app changes. Product decisions are explicitly weighed against "the admin it creates on a Monday," not just the code to build it.

## Capabilities and Constraints

- Two games: **music quiz** (rounds of timed questions, five round types) and **music bingo** (a host-played track list, cards on phones).
- **No dependencies, no build step, no database** — packs are JSON files, QR codes and PDFs are hand-written rather than installed, and the whole app is plain HTML/CSS/JS the host can edit between gigs.
- **SSE, not websockets** — chosen because ordinary HTTP survives pub wifi and browsers reconnect on their own without custom logic.
- A phone proves who it is with a server-issued token, never its own id — closes a sabotage path found by testing the app adversarially against itself.
- A join flood is *held at the door* and shown to the host as a number and a judgement call, never silently rate-limited — the host, not an algorithm, decides whether 288 phones is a big room or an attack.
- Deployed on Render specifically because the app holds a live connection to every phone all night; serverless platforms are explicitly ruled out for that reason.

## Brand Commitments

- **App name: Quizporium.**
- **"As soft and friendly as possible."** Capitals are for emphasis only, never for labelling — a stated brand decision, not a style guide default, made explicitly because the host reads shouted capitals as unfriendly.
- **A quizmaster's own colour scheme changes personality, never meaning** — their own two-colour gradient runs the Launch button and the logo; gold always means points/winning, green always means "makes something," red always means destructive, regardless of scheme.
- A five-role control system already governs every button in the app (the night / make something / ordinary / destructive / choose), with one gradient angle and three corner radii used everywhere — this is an existing, deliberate design system, not a gap to fill.

## Evidence on Hand

None recorded — no testimonials, press or case studies exist in the repository, and this file states that absence so later work does not invent any.

## Product Principles

1. **Reliability beats cleverness everywhere.** The single sentence that settles most feature arguments in this codebase.
2. **Clarity beats everything.** A control that needs explaining is the wrong control.
3. **As little clutter as possible.** A control nobody uses is clutter even if it is a good one.
4. **The common job is the fast one.** On the pack shelf that is "find tonight's pack and press Launch" — not browsing, comparing, or tidying.
5. **Build what helps a quizmaster sell.** Between two features of equal build cost, the one that wins or keeps a booking outranks the one that only makes the app cleverer.

## Accessibility & Inclusion

No formal accessibility standard is recorded as a requirement. The de facto standard already applied throughout the product is legibility under real gig conditions: large type and high contrast on the projector (sized in `vh` so it scales to any screen), and phones tested against real handsets over real pub wifi rather than only in a simulator.
