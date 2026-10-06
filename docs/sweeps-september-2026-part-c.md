# The September 2026 sweeps — Part C

The four sweeps of 5–6 September 2026, moved out of
[`sweeps-september-2026.md`](sweeps-september-2026.md) when that file reached its
size cap. **The working note at the foot of that file is about these** — read
it before fixing any of them.

# PART C — the four sweeps of 5–6 September 2026

Written up from the sweeps' own reports. The sixteen lenses in Part A were
handed this list and told to push past it, so **these are mostly NOT repeated
above** — read both parts.

Marked **[mine]** where the fault was introduced or half-fixed by the batch of
fixes made on the night of 5 September. That distinction matters: it is the
evidence for the working note at the foot of this file.

### AND FIXED THE SAME NIGHT, 6 OCTOBER 2026 — every live and partly one

One fix, one check that failed first, one commit each — the working note's
rule. **#7** a latecomer keeps their dealt team (`latecomer-keeps-team.test.js`);
**#4** the advert QR carries the room's join code, `/o/<code>/<pack>/<slide>`
(`advert-qr-room.test.js`); **#16** a trialist is judged by their own rung when a
feature moves up (`tier-buckets.test.js`); **#3** a ceiling for everybody,
`SIGNUPS_EVERYWHERE_PER_HOUR` (`signup-flood.test.js`); **#8** the console and
`/league` both read every room the owner's nights are in, and **#21** `/league`
restores the venue book first (`league-both-rooms.test.js`); **#26** a typed
name compares on its address, `venueNameKey()` (`league.test.js`); **#30** the
£ asks (`owner-money.mjs`); **#10** an account's `?q=` names its real room and
the reserved room is never a row (`no-phantom-rooms.test.js`); **#17** the
owner's view goes through `effective()` (`groups.test.js`); **#24** a draft
photo is `private, no-store` (`gallery-publish-loop.test.js`); **#9** the league
cache holds the promise (read, not reproduced); **#22** no route names a path
on a miss — and five DELETEs did too (`no-paths-in-errors.test.js`); **#23** the
editor's poll is quiet and publishing is said in words
(`support-access.test.js`); **#25** every way out of the preview unhooks its
key; **#34** *End the night* mid-order; **#29** *Remove seat* in words, and a
confirm that tells the truth; **#32** switching off a public league asks;
**#36** one editor link on the shelf, and *Write a new one* opens a new quiz;
**#35** *Big screen in the gaps*; **#27** twin tiles say which round. The UI
ones were photographed before and after on a real account.

### RE-VERIFIED 6 OCTOBER 2026 — 15 fixed, 7 partly, 14 still live, NONE on the protected surface

Checked against the code by the `sweeper` agent, each live one reproduced
unless marked. Line numbers are 6 October's. **Read this table before the
bullets below — most of them are now history.**

| # | Finding | Now | Where |
|---|---|---|---|
| 1 | Acting branch leaks the hash | FIXED | `identity.js` through `safe()`; `support-access.test.js` |
| 2 | Sign-in stalls the projector | FIXED | off the thread, 8-at-once; 1.8ms under 30 sign-ins |
| 3 | Signup has no throttle | PARTLY | 5/hour per caller, but the caller is the FIRST `X-Forwarded-For` entry — rotating it bypassed the limit (12 for 12). Whether Render passes a client's header through first is unknown |
| 4 | A subscriber's advert QR is dead | **LIVE** | `/o/<pack>/<slide>` carries no room; `offerRoomId()` → the owner's. A subscriber's 404s, or serves the owner's slide |
| 5 | `archivedAs` across a part boundary | FIXED | vouchers and the last part both survive; voucher half untested |
| 6 | `winners` resets on a mixed night | FIXED | `nightWinners`; `winners-carry.test.js` |
| 7 | Latecomer in a bingo interlude loses their team | **LIVE** | `session.js` ~1965 — plays the next quiz as a lone row beside dealt teams. Closest to the protected surface |
| 8 | League room move | PARTLY | publish and rulings agree now; the console's table is `roomForHost()`, `/api/league` the quizmaster room — a host-key night publishes and never shows |
| 9 | League cache re-poisons after a takedown | **LIVE** (read, not reproduced) | `league-publish.js` caches the value after its await; `gallery.js` caches the promise |
| 10 | `?q=` mints phantom rooms | **LIVE** | two permanent idle rows on the owner's overview from anonymous GETs |
| 11 | `Bingo prizes` label overwritten | FIXED | `bingo-prizes-label.test.js` |
| 12 | Hide does not fold the bar | FIXED | |
| 13 | `.console .wrap` overflow reset | FIXED | |
| 14 | HOUSE photos filed where nothing reads | FIXED | `galleryRoomOf()` |
| 15 | Five controls lie after a show loads | FIXED (code read) | `paintNightPicks()` after `applyShow()` |
| 16 | Moving a feature up grandfathers trialists | **LIVE** | no status check in the grandfathering — a Bronze trialist kept Adverts after paying Bronze. A revenue leak |
| 17 | Owner's list misreports a group seat | **LIVE** | `helpers.js` passes the raw account: bronze/11 on the list, gold/14 on the seat |
| 18 | `Load` on Setup 404s | FIXED | removed |
| 19 | `removeIdle` 500s on bingo | FIXED | |
| 20 | `phonesAre()` ignores the break plan | FIXED | `view.gap` on both host views |
| 21 | `/api/league` never restores the invoice book | **LIVE** | the public page's next-quiz line goes after a wipe until a console opens |
| 22 | `/api/images` 404 shows the absolute path | **LIVE** | `get-packs.js` |
| 23 | Support log floods and under-records | **LIVE** | `/api/playing` not quiet, polled every 8s by the editor |
| 24 | Draft photo cached publicly | **LIVE** (header) | `public, max-age=86400, immutable`, no `Vary`, preview path too |
| 25 | Preview sheet leaks a keydown listener | **LIVE**, trivial | |
| 26 | One pub, two league tables | PARTLY | case folds now; "Station Tap Wokingham" vs the booked name still splits, while `sameVenueSlug()` calls them one |
| 27 | Identical tiles | PARTLY | type line added; two same-type, same-title rounds still match (no shipped pack) |
| 28 | Launch reads "1 part" | FIXED | names the pack |
| 29 | The bin that only unlinks | PARTLY | still icon-only; its confirm now says nothing is deleted |
| 30 | `£` / `Close` on a subscriber row | **LIVE** | `£` flips comped in one click, no confirm |
| 31 | Photo lamp vs "Put these on the gallery" | FIXED | lamp says *once you publish this night* |
| 32 | "This pub does not run a league" | **LIVE** | no confirm, never says it takes the public table down; *Take this table down* has none either |
| 33 | `Prizes` / `The prizes` on bingo | FIXED | *Change the prizes* |
| 34 | `Continue … now` / `Finish` | PARTLY | Finish arms first and says *ends the whole night*; at rest still two bare labels |
| 35 | `In the gaps` / the corner dials | **LIVE** | audiences in tooltips only |
| 36 | Three links to `/editor` | **LIVE** | *Write a new one*, *Pack editor*, *Write, buy or edit packs →* |

**Worst first, of what is live:** #7, #4, #16, #3, #8 with #26, #21, #30, #10,
#17, then the collisions (#32, #35, #36, #34, #29), then #24, #9, #23, #22,
#25, #27. **The host picks** — and the working note at the foot of this file
still applies: one fix, one check that fails first, one push.

## Still live and serious

- **`whoIs()`'s acting branch leaks a subscriber's password hash** —
  `server.js:487` uses `accounts.find(actingId)` raw and spreads it, while every
  other path goes through `fromToken()` → `safe()`. During a support session
  `/api/me` returns `hash`, `salt`, `scrypt` and `calendarKey`; the calendar key
  was pulled out and used to fetch that person's whole diary with no cookie, and
  it keeps working after support access is closed. The hash leak is
  **pre-existing**; the calendar key half is **[mine]** — `safe()` was tightened
  on the ordinary path and this one was missed, so the note now claims a
  protection that has a hole. One-line fix: `safe(accounts.find(actingId))`.
- **`POST /api/sign-in` stalls the projector** — `scryptSync` on the main
  thread, and it hashes even for an unknown address. Measured: projector
  `/api/state` 2ms idle, **median 1,154ms** under 30 concurrent sign-ins.
  Protected surface items 2, 3 and 4.
- **`/api/signup` has no throttle and backs up `accounts.json` whole per
  signup** — 25 unauthenticated signups made 25 accounts in 1.18s. At scale it
  exhausts the GitHub quota that also serves the gallery, the archive and the
  invoice backups, and `backUpAccounts()` then fails silently.
- **Every subscriber's advert QR is dead** — `/o/<pack>/<slide>` carries no
  room and `offerRoomId()` always resolves to the owner's own quizmaster room.
  Reproduced: a subscriber's slide 404s, and once the owner has a set with the
  same id, the URL on the subscriber's projector serves the **owner's** slide
  with the scan counted against the owner's room.

## Regressions from the 5 September batch — all [mine]

- **`archivedAs` carried across a part boundary corrupts the archive.** The
  first push of the new part hits the `else if (state.archivedAs)` branch,
  compares `"{}"` against a null `filedVouchers` and writes
  `updateArchivedNight(…, { vouchers: [] })` — erasing the filed night's
  vouchers — and then `isOver && !archivedAs` is false so the last part is never
  filed. **Worse than the double-filing it replaced. Revert candidate.**
- **`winners` still resets to 3 on a mixed night.** `state.winners` means the
  quiz's podium depth (a number) *and* bingo's winner-id lists
  (`{line, full}`); `winnersOf()` reads the wrong one and `Number({})` is NaN.
  Verified: `winnersOf({winners: {line: [], full: []}})` → `3`. So the fix
  covers quiz→quiz and misses the case running orders exist for.
- **A phone joining during a bingo interlude loses its team** —
  `session.js:1194`, `else if (!rec.teamId) delete p.teamId;`. Bingo has no team
  code, so a latecomer carries `teamId: ''`, the next quiz part deals them one,
  and that line deletes it. They finish the night as a lone row against averaged
  teams, and `dealInto` leaves a phantom empty team behind.
- **The league room move orphaned existing rulings.** Writes went to
  `photoFolder(HOUSE)` = the flat `photos/` folder before 6 September and now go
  to `photos/<owner's quizmaster room>/`. Nothing reads the old path, so every
  published table and manual name override made before the change is invisible.
  Owner only. And the disagreement **moved rather than closed**: decisions now
  come from `galleryRoomFor` while `library.leagues` still comes from
  `roomForHost`, so the console can publish a table the public page cannot
  build.
- **The `inOrder()` cache can re-poison itself after a takedown.**
  `readDecisions()` sets the cache *after* its `await`, so a read in flight
  across a write survives `forget()`. `gallery.js` caches the **promise** and is
  immune — and the comment claiming this is "the exact shape of `gallery.js` one
  door along" is the bug.
- **`?q=` still mints a phantom room** for any id that passes `accounts.find()`
  but is not a room — in practice the owner's account id, which is what the
  console prints in its own public link. `GALLERY_NONE` also rides into
  `rooms.summaries()`, so one anonymous GET puts a permanent nameless row on the
  owner's console.
- **`paintSettings()` overwrites the `Bingo prizes` label** with `Prizes` on
  every paint, so that rename never reached the screen.
- **The `.lb-set` tuck-list edit was never applied** — a scripted edit aborted
  on a later assertion and the file was never written, so "Hide" still does not
  fold the bar. Both the commit message and CLAUDE.md record it as fixed.
- **`.console .wrap`'s `overflow: hidden`** sits three lines under the
  `overflow-y: auto` added to fix the clipping frame, and resets it. See A1 —
  the sixteen-lens sweep found this independently and it is the more serious
  sighting.

## Pre-existing, found by the four sweeps

- **Photos filed by the HOUSE room are written where nothing reads** —
  `fileAway()` uses `photoFolder(room.id)` while all ten readers use
  `galleryRoomFor`. Any night run on the host key or the owner hat loses its
  photographs from every screen.
- **Five controls lie after a saved show is loaded** — Secs per Q, Game sound,
  Playing, Winners and In the gaps are assigned in the `launchBar()` body,
  before `applyShow()` runs. Read off the wire: the bar says *Individual, Top 3,
  blank seconds*; the launch sends `teamPlay: true, teamMode: random,
  winners: 1, questionSeconds: 35`. **Playing is the worst — teams are dealt at
  join and nobody is ever moved.**
- **Moving a feature up a rung permanently grandfathers everyone mid-trial** — a
  live trial runs at the top of the ladder, so every trialist reads as holding
  everything and keeps it after converting to Bronze.
- **The owner's Quizmasters list misreports a group seat** — `view()` calls
  `entitlements()` on the raw account; the same seat reads gold/14 features on
  its own `/api/me` and bronze/11 on the owner's list.
- **`Load` on the host's Setup panel 404s** — `host.js:998` posts `loadQuiz`
  and `session.run()` has no handler. Dead since at least 15 August, and drawn
  at the lobby.
- **`removeIdle` 500s on a bingo night** — it is in the `shared` action map and
  `BingoGame` has no `removeIdlePlayers()`. Not reachable from the UI.
- **`phonesAre()` has never heard of the break plan** — the host view carries no
  `gap`, so with the phones switched off in a break the host's own screen still
  reads "a game and photos".
- **`/api/league` never calls `ensureInvoicesRestored()`** — the public page
  loses its next-quiz line after every deploy until somebody opens the console.
  Found independently by two sweeps.
- **`/api/images/<id>` returns the absolute filesystem path** in its 404. Third
  sighting of that class; its two neighbours carry comments about it.
- **The support log floods and under-records** — the editor's 8-second poll
  writes a raw `GET /api/playing/…` line each time against a rolling 500, while
  publishing photographs, publishing a league table and ruling on a team name
  are all logged as raw HTTP.
- **A draft photograph is served `public, max-age=86400, immutable` with no
  `Vary`** — one URL, two answers by cookie, marked publicly cacheable for a
  day.
- **A keydown listener leaks** every time the pack preview sheet is closed with
  the ✕ or the backdrop; its two sibling sheets unhook correctly.
- **One pub still becomes two league tables** when the freehand spelling differs
  from the booked one — `leaguesByVenue()` folds on exact lowercase name while
  the gallery uses `sameVenueSlug()` and the report uses `sameVenue()`.
- **A pack whose rounds are titled after the pack draws two identical tiles.**
- **The Launch button stopped naming what will be played for every quiz night** —
  since packs burst it reads "Launch tonight — 1 part".

## Label collisions

Each is two controls on one screen sharing a word for different sets. Renaming
one is the fix; the pair is what makes it a fault.

- **The bin that destroys / the bin that does not** — every bin in the app
  destroys except the one on a group seat row, which unlinks and touches
  nothing. Icon-only, meaning in a `title`, on a phone.
- **`£` / `Close` on the owner's subscriber row** — `£` toggles `comped` with
  one click and **no confirmation** (starts or stops charging somebody); `Close`
  cancels a subscription and **does** ask. The risk is inverted.
- **The wordless photo lamp / "Put these on the gallery"** — both say "the
  gallery" for different sets, and *these* reads as the green ones. On an
  unpublished night the lamps are green with a title reading "On the public
  gallery" while the page 404s.
- **"This pub does not run a league"** silently takes the live public table
  down, with no confirm — the only takedown on that door without one.
- **`Prizes` / `The prizes`** on the bingo control view — the quiz's was renamed
  to `Change the prizes` for exactly this reason and bingo was not.
- **`Continue to the quiz now` / `Finish`** side by side mid-order — one ends a
  part, the other ends the evening.
- **`In the gaps` / the corner dials** — one is the big screen night-wide, the
  other the phones per pack; neither names its audience anywhere visible.
- **Three links to `/editor` on one screen** with three different words.
