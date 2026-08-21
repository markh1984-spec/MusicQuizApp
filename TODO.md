# Your to-do list

Work down the numbered list below in order. Every step says how long it takes,
what it costs, and what happens if you skip it, with the link you need next to
it. The detailed walkthroughs are further down as **Parts** — you only need them
if a step does not go smoothly.

---

## DO THESE IN THIS ORDER — smallest job first

Set on 16 August 2026 after checking every entry against the code. **Ordered by
SIZE** — the point is to keep striking things off. Each item says WHAT THE FIX
IS, so it can be started without working anything out, and whether it needs a
decision from the host first.

**DELETE AN ITEM FROM HERE THE MOMENT IT IS BUILT.**
`test/todo-budget.test.js` fails if anything left in the list claims to be done.


**AND ONE CORRECTION, because the old entry asked for the wrong thing.** It
said to give a night "a real end time instead of the `+2 hours` default
`ics.js` applies". A filed night has carried `finishedAt` all along — the +2
hours is applied to future **bookings**, which have a start time and no
duration. Giving those a real end means a length typed when booking, which is
the same admin question the game picker lost on. Left alone deliberately.

Everything else — the website, the FAQ, print on demand, the nudity check,
breakout rounds, online video, splitting `launchBar()` — is bigger, parked, or
waiting on a decision. It is in the three lists below and in `todo/`.

---

# The three marketing lists, in priority order

Set on 12 August 2026. **One, two, three — and the order is deliberate.**

1. **Mark getting work as a quizmaster.** It pays the bills this month, and
   everything else is downstream of it: a founder who is not running nights
   cannot demo the product, cannot test a feature against a real room, and has
   nothing to show a venue or a subscriber.
2. **Selling the app to quizmasters.** No subscribers, no business.
3. **Features that help quizmasters sell to venues.** The thing that keeps
   subscribers once they are here, which is a problem you have to earn.

**This does NOT contradict design rule 4** ("build what helps a quizmaster
sell"). That rule orders FEATURES against each other inside the app. This
orders where the effort goes. A feature from list 3 still beats a feature that
only makes the app cleverer.

**And the top item of list 3 served list 1 anyway, which is why it is already
built.** Headcount per venue — "The Crown went from 22 to 58" — is how MARK
proves his own worth to a landlord, before it is ever a selling point for
anybody else. It got built because he needed it rather than because a
subscriber asked, which is the dogfooding argument working as intended, and
the same route is the one to use on anything else from list 3 that he needs
himself.

---

## 1 · MARKETING **MARK, THE JOBBING QUIZMASTER**

Winning and keeping his OWN venue bookings, and **the first of the three**.
Set up on 12 August 2026 after an argument I lost: I said this was the same job
the app does for any subscriber and should be served by the quizmaster list. It
is not, for three reasons.

**Most of it is not software.** Walking into pubs, the local Facebook groups,
what he charges, his own socials, who he knows. A feature list cannot hold any
of that, and filing it under one means it never gets done.

**It runs on a different clock.** His own bookings pay the bills this month.
The subscriber features are a longer game. Two things with different urgency
in one list means the urgent one eats the important one, or the other way
round — and either is bad.

**And the real reason: it keeps the conflict of interest visible.** He is both
the app's owner and its first customer, so anything built "for a quizmaster"
can quietly turn out to be built for HIM. That has already happened once and he
caught it himself — *"I only want the photos export feature on my account,
perhaps in future if I want features that only I use put them in the owner
console"*. A separate list is what makes that visible next time: if an item
only ever appears here, it is not a product feature.

### What belongs here

- **Where his own bookings come from**, and which of them repeat. Nothing in
  the app knows this today.
- **What he charges**, and how that compares to what a venue makes on the
  night. The advert-QR count feeds this argument directly.
- **His own socials and word of mouth** — the parts no feature touches.
- **Being the first user of everything on the quizmaster marketing list.** He
  is the only person who can find out whether "The Crown went from 22 to 58"
  actually wins a booking, before it is sold to anybody as a reason to
  subscribe.

### The test that keeps the lists apart

**If it only ever helps Mark, it belongs here and probably not in the app. If
it would help Rob, it belongs on the quizmaster list and should be built as a
feature.** Anything that lands here twice and turns out to be general is a
product feature that was wearing a disguise.

---

## 2 · MARKETING **FOR THE APP** — the words, and the shop window

The words, the website, the FAQ, email, and the venue-object work behind them — **[`todo/marketing-app.md`](todo/marketing-app.md)**.

## 3 · MARKETING **FOR QUIZMASTERS** — features that help THEM sell

**Third of the three, and that is not the same as unimportant.** This is what
keeps subscribers once they are here — a problem you have to earn by getting
some.

Design rule 4 says build what helps a quizmaster win the next booking. This is
that list, in the order it should be built, worked out on 12 August 2026.

**The first four items are BUILT**, all written up in CLAUDE.md:

- **Headcount per venue** — "The Crown went from 22 to 58", on the venue's own
  card and on the Gigs tab, out of one record. It also settles what the rest of
  this list was blocked on, which was a night that knows which venue it was at.
- **The last slide of the night** — "Back here Thursday 20th" with a QR to the
  venue's page, on the big screen at the final scores. It is DERIVED from the
  venue's usual night and the diary rather than typed at launch, which is the
  one part of the plan below that changed: the Venues tab did not exist when
  that entry was written, and a box typed weekly is a box that is blank by the
  third week.
- **An advert QR that counts** — the offer page, the shared word-code, and the
  opens read back on the slide editor itself: *"41 opens, 12 on the 14th"*.
- **The post-night report for the venue** — a PDF through the share sheet,
  reusing `src/pdf.js` — headcount, podium, photo count, advert opens.

### 1. A public page per quizmaster — and the consent line

A shareable link, no login: nights, numbers, and "book me". The thing that goes
in an Instagram bio or a cold email.

**THE GALLERY HALF IS BUILT, 20 August 2026.** `/gallery` was single-tenant —
hardcoded to the owner's own room, because it was built when Mark was the only
real subscriber. `?q=<accountId>` now asks for any quizmaster's — the
underlying `src/gallery.js` was already written generically, so this was a
matter of removing the hardcoding rather than a rebuild. **The owner-preview
shortcut does NOT extend to `?q=`** — it would otherwise have let the owner
preview every subscriber's unpublished, private photos with nothing consented
and nothing logged, which is exactly the cross-room read the own-packs
guarantee refuses everywhere else. Tested at the route level: an unrelated
account gets `preview: false` on somebody else's gallery even by naming their
id directly; the host key does too.

**Still open, and this is genuinely the rest of the feature:** the "numbers"
(headcount/nights aggregate — reusing `headcounts.js`) and "book me" (a
contact line) halves of the page, plus the sender's own photo-consent tick
described below — none of that is built, only the photo-viewing mechanism
underneath it.

**This is where photo consent actually starts to matter, and the line is
narrower than it looks.** The projector is fine exactly as it is: the room can
see the screen, they chose to send it, and it is gone in three seconds — which
is why the no-approve-step rule is right and should not be touched. Publishing
to the internet is a different act: permanent, indexable, and reaching people
who were never in the room.

So: **the consent question belongs at the PUBLISH boundary, not the send
boundary.** A tick at the moment of sending adds friction to the common job
for a page that does not exist yet. When the page exists: photos private by
default, publishing is the quizmaster's deliberate act, and the sender's tick
is one line — "happy for this to go on my page too?", off by default.

**The bit no tick box solves: group shots — and they are NOT to be avoided.**
They are the good photos and they are most of them. The point is narrower than
"selfies only": a tick from the sender does not cover the four people in frame
with them, so the tick is not what protects anybody. What does is the
quizmaster choosing what gets published and taking something down quickly if
asked — the per-photo bin, which already exists.

So do not build a consent flow that pretends to solve it. **One tick at the
moment of sending, off by default, remembered for the night so nobody is asked
twice.** That is about as light as real consent gets; less is not consent and
more is a grind, and the host's constraint is explicit: tick the legal boxes
without making the app a grind to use.

Another app doing none of this is not a defence — it means they are carrying
the risk too.

---


### 7. ONLINE MODE'S VIDEO — native, on Cloudflare. **Parked, not started**

The switch is built (`state.online`, the In the room / Online control in
Tonight). **The video underneath it is not, and nothing about it exists in the
code** — no `getUserMedia`, no WebRTC, no Cloudflare call. Parked deliberately
on 14 August 2026; this entry exists so the decisions taken that day are not
taken again.

**NATIVE, NEVER ZOOM OR TEAMS.** The host's own words: *"not using Teams or
Zoom, it needs to be native to the app."* A quizmaster running a night inside
somebody else's meeting app is not selling this app, and half the features —
the join code, the reveal, the podium, the come-back slide — have nowhere to
live in it.

**THE BIG SCREEN IS NOT VIDEO, and this is the decision that pays for
everything else.** Questions, the QR, the scoreboard, the podium and the
come-back slide already render natively on every device from the SSE payload.
Keep that. Streaming the screen as pixels would be the expensive mistake AND
the worse product: a QR re-encoded as video at 200 kbps is a QR that will not
scan, on the one control that lets somebody into the game. **Only the FACE is
video.**

**TWO SHAPES, AND THEY ARE TWO DIFFERENT CLOUDFLARE PRODUCTS** — not two
settings of one:

| Room | Shape | What runs it |
|---|---|---|
| up to ~16 | **meeting** — everyone on camera | Cloudflare Realtime, the SFU (WebRTC, sub-second) |
| 16 and up | **broadcast** — the host out, chat back | Cloudflare Stream Live (one-way HLS, seconds behind) |

**Sixteen, not fifty.** The host's first instinct was *"200+ is a broadcast,
under 50 is a meeting"* — right in kind, and the boundary is much lower than
it looks, because it is set by **what a screen can show, not by cost**. A
meeting is only meaningful while everybody can actually be seen: about 12–16
tiles on a laptop and about six on a phone. At fifty people nobody can see
anybody, so you have paid the expensive price for a wall of thumbnails and got
the broadcast experience anyway. There is no 50–200 middle to build.

**BROADCAST IS ONLY ALLOWED BECAUSE THE CLOCK IS SERVER-SIDE.** Rule 2 — a
phone sends which option it tapped and the server timestamps it — so several
seconds of video latency costs nobody a point. If scoring lived on the phone,
HLS would be ruled out entirely and the cheap shape would not exist. Worth
knowing before anybody "optimises" the clock.

**The money, so it is not guessed at again.** Cloudflare gives **1,000 GB
egress free a month, then $0.05/GB**. Egress is per viewer, per stream
received — so the bill is **viewers × bitrate**, and the room size is the
variable that drives it.

| What goes out | 30 players, 2-hour night | Nights inside the free tier |
|---|---|---|
| the host's face, corner-sized (~200 kbps) | 5.4 GB | ~185 |
| the host's face, 480p (~500 kbps) | 13.5 GB | ~74 |
| **audio only** (~32 kbps) | 0.8 GB | ~1,190 |
| 20 people all on camera (~300 kbps each) | 102 GB | ~9 |

**The everyone-on-camera row is QUADRATIC, and that is the one thing here that
can actually hurt.** Every extra person is another publisher *and* another
viewer of everyone else: 20 people is ~102 GB a night (~$5 once past free), and
**100 people all on camera is ~1.3 TB an hour, about $67 an hour**. So a
publisher cap is a hard requirement rather than a warning — a dozen or so on
camera, everyone else audio and chat.

**AND IT ADAPTS WITHIN THE NIGHT, PER PHASE — which is DERIVED, not clever.**
The host's own framing and it is the better half of the idea: *"pre round I'd
need my face to take up the entire screen, while I'm describing a round I'd
need to be in the corner, and during the round I'd need to be audio only."*
Three moments, all inside one two-hour night.

**The app already knows which one it is in.** `state.phase` drives every screen
in the room and is pushed to every device on every change, so the video profile
is a lookup table on the phase — the same shape as `PHOTO_PHASES` in
`screen.js`, which is how the projector already decides when a photo may go up.
Nothing to configure, nothing to guess, and it cannot fall out of step with the
quiz because it IS the quiz's own state.

| Phase | The host is | What goes out |
|---|---|---|
| `lobby`, `rules`, `final` | welcoming, explaining, celebrating | **full screen**, ~1000 kbps |
| `round_intro`, `round_board`, `reveal` | describing a round, reading the board | **corner**, ~200 kbps |
| `question` | quiet, the clock is running | **audio only**, ~32 kbps |

**The bottom row is the two-screens rule, not a saving.** While a question is up
the room must be looking at the question — that is rule 8 and it is why the
phone does not carry the question text in a pub, and why a photo sent
mid-round waits for the next break. A talking head next to a 20-second clock is
the same mistake in a new place. It being the cheapest rung as well is a
coincidence worth enjoying rather than the reason.

**What it costs, on a realistic split of a 2-hour night** (20 min full, 40 min
corner, 60 min question): **~224 MB per viewer**, so 30 players is **~6.7 GB a
night** — against ~27 GB for a full-screen face throughout. **Four times
cheaper AND the better product**, which is the test every admin reducer in this
codebase has to pass.

**Do not tear the stream down between rungs.** On the SFU, stopping and
restarting the video track is cheap. On a broadcast it is not — so "audio only"
there means **audio plus a frozen branded still**, which H.264 encodes at
almost nothing because the frame never changes. Same bill, no reconnect, and
the room sees the quizmaster's own logo rather than a black hole.

**IT ADAPTS TO THE HEADCOUNT AS WELL, NOT TO THE NETWORK — and it says which
rung it is on.** WebRTC already adapts to each viewer's connection, silently and
per-person; leave that alone. What it cannot know is that there are two hundred
people and a bill, so that is the rung this app picks. **But on a stated
ladder, visible to the host**, for the same reason the join flood shows a number
instead of deciding on its own: a stream that quietly degrades mid-night is
indistinguishable from an app that is breaking, and a host on a mic cannot tell
which. Note that audio-only is CHEAPER than the smallest video, so the ladder
saves most exactly where the cost would otherwise run away.

**Before any of this is built:** it needs a Cloudflare account and an API
token, and it is the first thing in this app with a per-use bill that is not
Claude or OpenAI — so it wants the same treatment `spend.js` gives those,
written down as it happens rather than discovered on an invoice.

---

## Where the rest of this went

**This file is the LIVE list. Everything else moved on 14 August 2026**, so
that opening it shows work that is actually outstanding rather than a plan
for something that already exists.

- **[`docs/setup.md`](docs/setup.md)** — the step-by-step host setup:
  keys, repos, Spotify, OpenAI, the four addresses. Nearly all of it done.
- **[`docs/business.md`](docs/business.md)** — parked strategy, now an index
  to `docs/business/`: the directory, group and venue accounts, the
  marketplace, referrals, karaoke, PayPal. Nothing here is scheduled.
- **[`docs/history.md`](docs/history.md)** — what has changed and when.

**AND THREE AREAS MOVED INTO `todo/` ON 16 AUGUST 2026 — still outstanding
work, still this list, simply not in this file.** They are 94KB of the 124KB
this file had become, and every session was paying for all of it to reach one
entry. Each leaves its name and one line above, so nothing is hidden:

- **[`todo/marketing-app.md`](todo/marketing-app.md)** — list 2: the words, the
  website, the FAQ, email.
- **[`todo/gallery.md`](todo/gallery.md)** — photos after the night, print on
  demand, the rude-photo problem.
- **[`todo/console.md`](todo/console.md)** — the console's UI work: doors,
  benches, the popover editor, the seams left.

**The 65KB "photo gallery" section was the tell.** Every new entry had been
landing in whatever heading was last, so it had come to hold the console doors
and the `launchBar()` split — work with no photograph in it. **Put a new entry
under the heading it BELONGS to**, and if there is not one, start one.

**A finished item is DELETED from this file, not ticked.** Its reasoning is
in CLAUDE.md; a build plan left behind for a thing that exists is a trap —
it caught a session on 14 August, which nearly rebuilt the picture-drawing
step because the plan for it was still sitting here.

## Waiting on a decision from you — no rush, nothing is blocked

**THE PRICES ARE SETTLED AND THIS TABLE WAS STALE.** It said Silver was £15
until 15 August 2026, which contradicted both the code (`TIERS` in `plans.js`:
`pence` 1000 / 2000 / 3000) and the reasoning in `docs/business.md`, which
argues the Bronze-to-Gold step is **£20 a month** and that Gold is worth **£10
more than Silver**. The code and business.md agreed with each other; only this
list was wrong, and it got quoted back at the host as an open question.

**Read the price off `plans.js`, never off here.**

| | Plan | Price | What is on it today |
|---|---|---|---|
| 🥉 **Bronze** | Basic | **£10/mo** | Music Quiz, Music Bingo, the pack library, buying packs, seasonal looks, advert slides, photos from the room, two lobby games |
| 🥈 **Silver** | Elite | **£20/mo** | Invoicing, your calendar, marketing, Tailback |
| 🥇 **Gold** | Pro | **£30/mo** | Online quizzes (streaming), Quick Draw |

**What is still open is WHICH FEATURE SITS WHERE**, not what a tier costs.
Moving one is a one-line change.

The one rule I did NOT guess at, because it is yours: *anything that costs the
owner money every time it is used is not in Bronze.* That is why streaming is at
the top — egress is a real per-use bill — and why a new round type or a new
seasonal look is Bronze the day it is written.

**The quickest way to decide is to look at it.** Put the quizmaster hat on, tap
**B** on the switch in the top right, and sit on Bronze for a few minutes. If it
feels like a crippled app rather than a free tier, something needs moving down.

Two things deliberately NOT on the ladder at any price: generating packs with
Claude, and drawing artwork with OpenAI. Those are yours, on your bill, and the
packs being written for subscribers is the whole arrangement.

---

## Quick links — the ones you will use constantly

| What | Link |
|---|---|
| **Your live app** | https://musicquizapp.onrender.com |
| Your repository | https://github.com/markh1984-spec/MusicQuizApp |
| Render dashboard | https://dashboard.render.com |
| **Your service — environment variables** | https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env |
| **Your service — settings** | https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/settings |
| **Your service — logs** | https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/logs |
| Anthropic billing | https://console.anthropic.com/settings/billing |
| OpenAI API keys | https://platform.openai.com/api-keys |
| Spotify dashboard | https://developer.spotify.com/dashboard |

### Two levels in Render, and why it is confusing

Render wraps your service inside a **project**, and the two look similar:

| Address starts with | What it is |
|---|---|
| `/project/prj-…` | the **project** — wrong level. Its "environments" and "environment groups" are a different feature and not what you want. |
| `/web/srv-…` | the **service** — right level. This is where environment variables live. |

Your service is **`srv-d9pnk0e417fc73bvjdkg`**, and the links in the table above
go straight to it, so you never have to click through the project again.

Lost? Press **Ctrl+K** (or **Cmd+K** on a Mac) anywhere in the Render dashboard
and type `musicquiz`.

---

# PART 1 — GitHub ✅ done

Your branch is **`MusicQuizApp`** — it is the only one, and it is the default.
Wherever a guide online says `main`, yours says `MusicQuizApp`.

Nothing to do. 🔗 https://github.com/markh1984-spec/MusicQuizApp/branches

---

# PART 2 — Render ✅ mostly done

Service is created, in Frankfurt, on the free tier.

## Lobby games — what is left

**BUILT, AND DELETED FROM THIS LIST: the four games, the picker and the tier
ladder.** Maze Mouth and Rally on Bronze (and the two defaults), Tailback on
Silver, Quick Draw on Gold; the picker sits under **Set it up**
on both launch routes; the tier is checked at the route rather than in the
console; locked games are shown rather than hidden. The reasoning has moved to
[`docs/lobby-games.md`](docs/lobby-games.md) — **read the fixed-timestep note
there before adding a fourth**, because anything with continuous motion in it
has a fairness problem the grid games do not, and it is invisible.

What a fourth game costs now: one rules file, one canvas file, one line in
`LOBBY_GAMES` and one in `LOADERS`. The seed, the score, the board, the refusal
outside the lobby, the teardown and the picker are all shared.

### Still open

- **A FIFTH GAME**, if the ladder wants more to sell. The two still worth
  having, in the order they were argued on 15 August 2026: **Pile Up** — drop
  sliding blocks, overhang trimmed, tower narrows; one tap, no chasing, and the
  most genuinely different feel left, since another variation on chasing
  something is worth much less than a different thing to do. And a **letter
  game** — the same rack for the whole room, longest words in ninety seconds,
  which is the best leaderboard available here and the only idea that looks
  like it belongs in a QUIZ app rather than an arcade.
- **The letter game needs a dictionary, and that is its real cost.** A decent
  UK word list is 200KB–1MB downloading at the exact moment sixty people are
  joining, which is the one path that must not stutter; a curated 5,000-word
  list gets it to ~40KB but then rejects words people know are real, in public,
  which is an argument the host loses on the mic. **Its own decision, not a
  third game smuggled in.**
- **Rhythm and memory games were considered and turned down.** A lane-tapping
  rhythm game wants SOUND, in a room where the host is talking over it; a
  Simon-style memory game is thirty seconds long, so it does not keep a phone
  in the foreground, which is the whole reliability argument for the feature.
  Both fail on the job rather than on taste.
- **A luck-based game cannot work here at all**, and it is worth writing down
  so it is not re-proposed: the seed means everybody gets the identical game,
  so anything push-your-luck — cards, dice, cash-out-or-keep-going — collapses
  into either a tie at the same optimum or a coin flip nobody earned. **The
  skill has to be in execution or in knowledge, never in decisions under
  uncertainty.**

---

## The photo gallery, and print on demand

Who may see a night’s photos, what may be printed, and the rude-photo problem — **[`todo/gallery.md`](todo/gallery.md)**.

## The console's outstanding UI work

Doors, benches, the popover editor, and the seams left — **[`todo/console.md`](todo/console.md)**.

