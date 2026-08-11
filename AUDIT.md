# Software audit — before a second quizmaster gets a login

Run on 11 August 2026, against the code on `MusicQuizApp`, because handing Rob
an account changes what the failures cost. Up to now every bug has been Mark's
own problem on Mark's own night. From the moment somebody else is in, a fault
in the second-login machinery is somebody else's gig going wrong, in front of
somebody else's room, with Mark's name on the app.

So this pass deliberately favoured **the parts that only exist because there is
more than one of you** — rooms, backups, per-room paths, the owner/quizmaster
line — over the parts a year of Mark's own gigs has already exercised.

**Everything found is fixed and pushed.** The scripts that found it are in the
session scratchpad rather than the repo: they are throwaway probes against a
running server, and the properties worth keeping are in `test/` as real tests.

---

## What was actually run

| Pass | What it did | Result |
|---|---|---|
| **Wiring** | Every `putFile` in `server.js` paired against a `getFile` | **2 found** |
| **Two screens** | A quiz with one round of every type, walked at every phase, both public payloads inspected | **1 found** |
| **Crash** | `SIGKILL` mid-quiz and mid-bingo, twice | clean |
| **Load** | 60 phones, live SSE each, all answering at once | clean |
| **Permissions** | 22 routes × owner / quizmaster / anonymous / host key | clean |
| **Fuzz** | 158 malformed bodies at the five open phone routes, plus the new paths | clean |
| **Flood** | 300 joins in one go | clean, with one caveat below |
| **Bingo** | A whole 5×5 game to three prizes | clean |
| **Render** | Projector and phone after the payload change | **1 found** |

`npm test` is **800 green**, up from 776.

---

## The four findings

### 1. A venue's slides were still shared, in the backup

**The worst of them, and it was live.** Advert sets were moved to a folder per
room when rooms were built — CLAUDE.md records why: one folder meant a second
quizmaster tidying what looked like their own venue list would delete The
Crown's set off Mark's projector. **The disk was fixed. The backup was not.**

Every room wrote to `adverts/<id>.json` in the **main** repository, with no room
anywhere in the path. The moment Rob saved a set whose id matched one of Mark's:

- it overwrote Mark's file in the repository;
- deleting his deleted Mark's;
- and Rob's venue's offers and their ticket-sales QR went into a **public** repo,
  where git history is forever.

Fixed: the house keeps `adverts/<id>.json` in the main repo — those are Mark's,
committed on purpose, and the live app builds from git. Everybody else goes to
the packs repository under `adverts/<roomId>/`, the same boundary as their own
quizzes. Restored once per room, only into an empty folder.

### 2. The projector was publishing every player's id

The fastest finger was moved onto `faceKey` when it turned out that a player id
is a bearer credential. **`publicPlayer()` was not** — and that is what builds
the LEADERBOARD, which is in the screen payload at the round board, at the
final, whenever the scoreboard flag is up, and in the lobby list.

So `/api/state?role=screen&g=CODE` — a payload anybody holding the code off the
projector can fetch — published an id for **every player in the room, all
night**, rather than for one of them for twenty seconds. Every phone's own
payload carried everybody else's too.

How much it was worth is smaller than it was before tokens landed: a phone now
proves itself with a token, so an id alone no longer lets you answer as
somebody. It still should not be there, and the rule this app already has is
that no public payload carries one at all.

**The test that was supposed to catch this only looked at the reveal**, which is
where the first one was found. It walks every phase now, plus the lobby and the
scoreboard flag.

### 3. A second quizmaster's join code changed on every deploy

`room-codes.json` lives in `data/`, which on Render's free tier is empty again
after every push, and nothing backed it up. So an additional quizmaster's four
letters were silently reissued on every deploy, and a printed card would send a
room to a game that does not exist.

**It could sit there unnoticed precisely because the house room has no code.**
Mark's own printed QR was always safe. The only person it would ever have broken
is the second login — which is exactly the shape of thing this audit was for.

Fixed, and restored **at boot** rather than lazily: a phone scanning a card is
often the first thing to touch a room after a restart, and by then it is too
late to discover the code should have been something else.

### 4. A projector opened after people had joined showed an empty lobby

The card registry rendered a card and then only called its `update` on the
**next** state push, so a card was drawn empty and filled in by whatever
happened afterwards. On the lobby that is the player strip: a big screen opened
once a few people had already scanned — or one reconnecting after the laptop
slept, which is the case that actually bites — showed nobody until the next
person joined.

Same shape as the join address never arriving on a rules slide, and the same
fix.

---

## What held

Worth listing, because "we checked and it was fine" is a result:

- **Crash recovery, both games.** `SIGKILL` mid-question came back on the same
  question, with every score intact, and all three phones came back as
  themselves without rejoining. A phone holding a stolen id and no token got a
  team of its own. `SIGKILL` mid-bingo came back on the same track with the same
  card and all its marks.
- **Sixty phones.** All sixty joined in 85 ms, all sixty held a live stream, all
  sixty answers landed in 166 ms, the projector's tally added up, and **zero**
  answers were attributed to the wrong phone.
- **The two-screens rule, on all five round types.** Thirty steps through a
  quiz containing text, image, intro, multi and alphabet rounds. No answer key,
  no host note, no round-3 track cue, no `whoPicked`, no question text on a
  phone, and no player ids — and the host still gets all of it.
- **The permissions line.** Twenty-two routes across four identities, every
  answer as intended. The owner is refused the control view and the invoice
  book; a quizmaster is refused the catalogue, the generator, the reports and
  the new photo-export tab; an anonymous caller gets 401 everywhere.
- **Malformed input.** 158 junk bodies at the open phone routes — nulls, arrays,
  huge strings, prototype-pollution payloads, truncated JSON — and the new
  past-gigs paths with traversal attempts. Zero 500s, zero dropped connections,
  no pollution, server still up.
- **A whole bingo night.** 5×5, three prizes, four cards all different, prizes
  at 16, 21 and 38 tracks, no card reissued at any point, and no route that
  could reissue one.
- **Every backup now has a restore.** Accounts, invoices, reports, suggestions,
  the spend ledger, play counts, their own packs, the night archive, the join
  codes, and the photos themselves.

### One measured caveat, deliberately left alone

The join gate's waiting count keys on a `tryId` the phone keeps in
localStorage, so ten retries by one phone are one person. A caller that sends
none — a script — collapses with others: **300 joins fired at once showed the
host about 40 waiting, not 180.**

Left as it is on purpose, because it errs the way the whole file errs. An
inflated number makes a host hesitate over a real room while they are on a mic,
which is the show stopping; a deflated one lets some junk teams through, which
is one tap of tidying up afterwards. Real phones send a `tryId` — it is how they
remember who they are at all — so a genuine room counts correctly and it is only
a script that reads low. The comment in `src/joins.js` now says so.

---

## What this audit CANNOT tell you

Every one of these needs a real device, a real venue or a real account, and
none of them can be faked from here. They are the honest gap.

**Needs a real phone**

- **iOS Safari, on an old handset.** Everything here ran in Chromium. The photo
  filters exist as pixel maths precisely because old iOS does not implement
  `ctx.filter`, and that class of difference is invisible from this side.
- **The share sheet with several images.** `navigator.share({ files })` is the
  whole point of the photo tab and its multi-image behaviour varies by phone and
  by OS version. Test it on Mark's own phone before promising it.
- **The camera, the props and the pinch-to-size.** Touch gestures, camera
  permission prompts and how a prop lands on a real face.
- **A phone locking, a call coming in, and the app coming back.** The wandered
  note and the SSE reconnection both behave differently on a real handset than
  on an aborted fetch.

**Needs a real venue**

- **Pub wifi, and a venue proxy.** `X-Accel-Buffering: no` handles the common
  ones, and the failure mode — an event stream held in a buffer, freezing every
  phone at once — cannot be reproduced on localhost. Test on the venue's own
  network days before, never on the night.
- **A projector.** Contrast, type size from the back of a room, and whether the
  seasonal looks read as intended on a bulb rather than a laptop panel.
- **Sixty real phones on one router.** Sixty simulated connections on one
  machine share none of the radio contention that actually decides this.

**Needs an account or a key**

- **The photo round trip.** Filing to `PHOTO_REPO` and reading it back for Past
  gigs is unit-tested at the edges and probed for its refusals, but the full
  loop has never run — there is no photo repo configured here. **This is the
  one shipped-today feature whose happy path is unproven.** It will run the
  first time a photo is taken on the live app.
- **`PACKS_REPO`.** Not set on Render, so a quizmaster's own packs — and now
  their venue slides — are saved but not permanent. The console says so in red.
- **OpenAI.** Round 2 runs on placeholder art.
- **PayPal.** `developer.paypal.com` is blocked by this environment's egress
  policy, so the adapter is unwritten and the five billing events have never
  seen a real webhook.
- **Spotify's playlist step.** Still a bare 403; the two remaining checks are in
  CLAUDE.md and both are on Mark's side.

**Not covered because it does not exist yet**

- Team play, group accounts, streaming, the monthly AI pass over ageing
  questions.

---

## Before Rob gets a login

In order, and only the first is a blocker:

1. **Set `PACKS_REPO`** to a new private repository, plus `PACKS_TOKEN` (or let
   it fall back to `GITHUB_TOKEN`). Without it Rob's own packs and his venue
   slides are saved but not permanent. One repo, one environment variable.
2. **Take one photo on the live app** and check it appears in the photo repo
   under `photos/<roomId>/<night>/` and comes back on Past gigs. That is the one
   unproven path.
3. **Rewrite the eight Bronze starter packs.** Mark's own assessment: the
   current library was thrown together to have something to test against, and a
   starter set is the whole first impression of what the catalogue is worth.
4. **Run one night on the venue's own wifi** with the big screen open, before
   the first gig anybody else is running.
