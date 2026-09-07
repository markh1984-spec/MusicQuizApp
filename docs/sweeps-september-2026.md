# The September 2026 sweeps — a worked list

**This is a findings list, not a plan.** Nothing in it has been actioned unless
it says so. It exists because the analysis behind it cost two days and lived
only in a chat window, and a session that starts without it re-derives it at
full price or, worse, half-derives it.

## How to read it

- **[P]** marks the protected surface: the console loads and Launch works, the
  projector shows the game and the join code, phones join and answer,
  Next/Reveal/Back, and crash recovery. Those outrank everything else here.
- **Confirmed by both** means two independent adversarial verifiers — one
  trying to reproduce it from scratch, one trying to refute it as intended
  behaviour — both failed to kill it. Anything weaker is marked.
- **A finding is not a decision.** Several of these are things this codebase
  decided deliberately and wrote up; the verifiers were told to kill those and
  mostly did, but the host is the one who says what gets changed.

## Where it came from

Two passes, both report-only:

- **5-6 September** — four sweeps by area (engine/session, routes/accounts, the
  console modules, and everything that leaves the app). Part C below.
- **6-7 September** — sixteen lenses with two adversarial verifiers each, a
  dedupe pass and a completeness critic: 50 agents, 139 verified findings, 120
  confirmed by both, 50 on the protected surface. Parts A and B.

## What has already been actioned

Only two things, both at the host's explicit request, both verified:

- **Save works again** (`a1cff11`, `8fe7b72`). `tonightAsShow()` was module
  scope and called `segmentsNow()` from inside `launchBar()` — a
  `ReferenceError` before the `try`, so the one control that creates a show did
  nothing at all for a day. `scripts/save-a-night.mjs` is the guard: 8 of 8
  green on the fix, 6 failures with the fault put back.
- Nothing else. The rest of this file is untouched.

## What is verified BY HAND, over and above the two verifiers

Spot-checked directly against the source before this file was written:

- A1 — `.console .wrap` really does end its block with `overflow: hidden` three
  lines under `overflow-y: auto` (`style.css:3146`).
- A2 — `roomForPhone()` really is `rooms.byCode(code) || rooms.get(HOUSE)`
  (`server.js:918`).
- A3 — `pickPack()` really returns `launcher.empty` with no fallback to
  `available[0]`, which is in scope two lines up (`session.js:340`).

---

# PART A — the sixteen-lens sweep, 7 September 2026

# Sweep report — sixteen lenses

139 verified findings, deduped to 118 distinct faults. Every one below survived two adversarial verifiers unless marked **[one verifier]**. **[P]** means it sits on the protected surface: console loads and Launch works, projector shows the game and the code, phones join and answer, Next/Reveal/Back, crash recovery.

Where two or more lenses found the same thing from different angles, that is said — independent sightings are the strongest evidence in here, and three of the worst faults were found twice.

---

## The twelve that matter most

### 1. A composed night does not survive a restart — the projector comes back reading "No quiz loaded" **[P]**
`src/session.js:340` · crash-recovery · reproduced three times end to end

Every night launched from a saved show, and every night where a single round was unticked or two packs were mixed, is composed — `packId` is the reserved `~tonight`. On boot `pickPack()` cannot load that file, returns `launcher.empty`, and `boot()` throws the whole saved state away: scores, team names, the lot. The `order` is never written to disk, so the night is architecturally unrecoverable, and the first reconnecting phone overwrites `state.json` with `packId: 'empty'` within seconds, so it cannot be rescued by hand either. Same two lines have a second trigger: delete the pack an ordinary night is running on, and the documented "boot() falls back to the first pack it can find" never happens.

On Render every push is a restart. A docs change pushed mid-quiz on a show night ends the night.

**Fix:** fall back to `available[0]` in `pickPack()`, and persist `state.order` at launch so `composeQuiz()` can rebuild it on boot (a running order already has `runningOrder` + `orderPos` on disk and needs no new field).

### 2. The console frame clips instead of scrolling — three packs in Tonight and the tab column and whole pack shelf are unreachable **[P]**
`public/assets/style.css:3146` · stylesheet

`.console .wrap` ends its block with `overflow: hidden`, which wipes the `overflow-y: auto` five lines above it. Measured at 1500x900: five packs in Tonight → 161px of overflow, Music Bingo, Prepare a night and Venues all off the bottom, six of six pack cards gone, and a real wheel moves nothing. Re-stating the declaration at runtime fixed it in the same session. The comment directly above the wiped line is an essay saying "a clipped overflow is worse than a scrolling one… nothing is ever cut off". The fourth sighting of shorthand-beats-longhand, this time inside one declaration block; `padding-bottom: 0` sitting between the two is the tell that the new pair was inserted above the old line instead of replacing it.

This is the fault reported twice as "the sub menu is still missing from the console". The fix that was written for it has never been in effect. No fixed minimum height can save it either — the row is designed to grow to two and three rows.

**Fix:** delete the trailing `overflow: hidden`.

### 3. An unrecognised join code silently drops the phone — and the whole room — into the owner's house room **[P]**
`server.js:918` · found independently by **crash-recovery and rooms-scoping**

`roomForPhone()` is `rooms.byCode(code) || rooms.get(HOUSE)`. Driven in a real browser: `/play?g=ZZZZ` says "You're in" under **Mark's Quizporium** branding, `POST /api/join` returns a real id and token, and the player appears in the owner's room. `/api/join-url?g=ZZZZ` hands back the owner's own join QR; `/api/state?role=screen&g=ZZZZ` serves the owner's loaded quiz. Nothing 404s, nothing logs. `rooms.get()` already refuses exactly this for room ids, with a comment saying a house fallback is "the same fault wearing a friendlier face".

- **The trigger is real: `room-codes.json` backups race and reissue codes across a deploy.** `src/rooms.js:250` — one page load of the Subscribers tab fires N concurrent unawaited PUTs of the same file, each carrying a non-cumulative snapshot; reproduced with a sha-conflict stub: six codes minted, two backed up, and after a wipe-and-restart **four of six quizmasters' printed QR codes had changed**. Errors are swallowed by `.catch(() => {})`.

Together: a subscriber's printed QR stops working after a push, and every phone that scans it joins the owner's game and is told it is in.

**Fix:** refuse a code that was sent and does not resolve (keep the no-code → HOUSE fallback). Order the code backups the way `gallery.js` orders `published.json`, re-read at PUT time rather than sending a snapshot, and stop swallowing the result.

### 4. A big photo keeps playing full-screen over a live question, and the host's photo kill switch does not take it down **[P]**
`public/assets/screen.js:244` · phones-projector

`showBigPhoto()` queues photos with `setTimeout` chains and no phase check and no way to clear the queue. Six photos posted at a round board were still on screen at +5s, +10s, +15s and +20s of the next question — the stage scrimmed to 72% black with the prompt and all four options greyed under a tilted polaroid, clock running. `pointer-events: none` means `elementFromPoint` reports the options as visible; only looking at the render finds it. Then `photosOn {on:false}`: the strip vanished, `photos: []` server-side, and the polaroid was still up in 9 of 9 samples over 17 seconds. Any joined phone can queue up to forty.

5.3 seconds per photo of a 20-second question the room cannot read — everybody scores worse for a reason unrelated to the question — and the one control for "take that down" does not reach it.

**Fix:** clear `bigQueue` and remove `#photoBig` in `draw()` whenever `PHOTO_PHASES` does not hold, and again when `s.photos` comes back empty — the same place `stopBreakCycle()` already lives.

### 5. A final where nobody scored mints a first-place voucher for every phone in the room **[P]**
`src/engine.js:1363` · engine-scoring

Eight phones joined, nobody answered, host pressed "Stop the quiz": **eight vouchers, every one "place 1 → A pint on the house", each with its own live code**, and every phone showing it. `rankPlayers()` correctly gives equal scores the same position, so an all-zero board is everybody at position 1, and `issueVouchers()` pays by position. Also reproduces 100% of the time on a breakout-only pack — a supported pack shape whose rounds score nothing by design. Three ordinary routes in: wrong pack and Stop early, projector never connected so nobody answered, or any breakout-only night at a venue with prizes on file.

The bar honours all of them; `redeemVoucher` only refuses a code already spent.

**Fix:** refuse to pay a position nobody earned — skip a row scoring zero, and treat a tie spanning the whole board as no result. `drawLuckyDip()` already has this shape of floor.

### 6. A round switched off on a loaded show is still played — the button says "2 rounds" and the wire sends 3 **[P]**
`public/assets/console-tonight.js:2632` · launch-bar · request body read off the wire

Two-part show loaded, tick pressed, ticks re-measured `["0:on","1:off","2:on"]`, Launch re-labelled itself "2 rounds" — and `launchOrder` carried all three rounds. `runningShowSegments()` builds from `item.order` on the show and never reads `lbOff`, while the tick and the button label read `lbOff` and nothing else. Only bites shows of two or more parts.

He drops a round on the night to make time, the tick goes red, the button agrees, and the room plays it.

**Fix:** filter `runningShowSegments()`'s order through `lbOff`, or have `applyShow()` write the show's order into `lbSlots` so there is one truth.

### 7. The Card picker's shape is never sent — the bar says 5x5 and the room gets a 4x4 with five prize stages **[P]**
`public/assets/console-tonight.js:1866` · launch-bar

Bingo pack dragged in: Card face reads "5x5 — 25 of 40 songs on a card", Prizes reads 5, the tile reads "5x5". Launch body: `"shape": null, "prizes": 5`. Projector: `cardRows 4, cardCols 4`, five stages. Choosing a shape by hand works, so only the **default** is lost — which is every bingo night where he does not open the picker. `shapeOptions()` marks the best shape selected but nothing writes it into `night.shape`, while `paintPrizes()` reads the displayed shape and does write `night.prizes`.

He tells the room twenty-five songs and they get sixteen, and a 4x4 runs five prize stops where the table says two.

**Fix:** write the displayed default back where it is displayed, before `paintPrizes()`. The same line fixes the mixed row and `bingoSaid()`.

### 8. "New quiz" in the editor silently adopts an existing pack's file, and one Save replaces it with a one-question stub
`public/assets/editor.js:403` · console-doors · reproduced against a copy of `quizzes/`

Press New quiz, type "1980s Pop Music", fill the blank question, press Save — no confirm, no warning — and the 3-round, 20-question distributed pack on disk becomes 1 round, 1 question. Same for a quizmaster's own pack. The Workshop door offers three links straight to this page.

Rule 11 says there is exactly one file per catalogue pack and every subscriber reads it, with `reloadPackEverywhere()` pushing changes into games already running. A title typed at the wrong moment destroys a distributed quiz for everyone holding it, with no undo.

**Fix:** `newQuiz()` already has the id list from `loadQuizList()` — check it and refuse with the wording `saveOwn()` uses. Belt and braces, make `POST /api/quiz` refuse to create over an existing id without a replace flag.

### 9. A second BINGO press replaces the winner's name on the projector while the prize stays with the first
`src/bingo.js:539` · bingo · real browser, two phones

Alpha claimed a line: projector "Alpha", voucher to Alpha. Bravo's button stayed enabled (Bravo holds no prize, so `standDown` is false). Bravo pressed it: the stage was already taken so no prize moved — but `state.lastWin` is overwritten unconditionally and Bravo is pushed into `state.winners.line`. Measured after: projector winner **"Bravo"**, Alpha's phone reverted to "Get a full line | Press BINGO!", Bravo's says "You got it. Well done." with zero vouchers, host panel says Bravo verified, and `results()` marks both as won — so the filed night, Past gigs and the landlord's report record two winners.

Needs no cheating: a second table with a legitimate line shouting a beat later is the normal thing that happens.

**Fix:** do the "has this stage been taken" check before the winner is recorded, and return the third outcome the phone already has wording for ("Correct — that one has gone"). Stand the button down for everybody once a stage is claimed.

### 10. Bingo vouchers are destroyed the instant the host presses "Continue to the quiz"
`src/session.js:118` · found independently by **bingo and session-order**, both reproduced over real HTTP

Line winner's code returns 200 from `/api/voucher` before the press and **404 "That code is not a voucher here."** after it — redeem too, and the host's own voucher panel is empty. `nightWideOpts()` carries venue, rewards, comeBack, winners and breakPlan but not `vouchers` or `prizeWinners`, and `startOrderSegment()` builds a fresh state. Worst on the sharpest press: the primary button advances automatically when the last bingo prize is claimed, and its confirm says "Nobody's scores or cards are lost." The interlude's voucher never reaches the archive either, so "a prize taken at the bar has to reach the filed night" cannot work for it.

This is the live complaint already in CLAUDE.md — "my quiz and bingo winners on thursday didn't receive a QR code" — reachable again by a different route.

**Fix:** carry `vouchers` and `prizeWinners` across the boundary and seed `filedVouchers` from them. Until then, change the confirm wording.

### 11. Team nights: `boardIdFor()` was threaded through position and nothing else **[P]**
`src/engine.js` (2566, 2970, 1004, 1987, 2447) and `public/assets/host.js:802` · found independently by **engine-scoring and engine-views**, both driven in real browsers

One cause, six symptoms, all live for the whole of any team night:

- **The projector prints "60 of 6 answered"** (`engine.js:1004` / `screen.js:950`). `playerCount` is board rows, `answeredCount` is phones, and they are printed in one sentence. Six feet wide in a dark pub. The pill saying "6 playing" for sixty people is the other half.
- **The phone and the projector disagree about the score, and every phone lists its own team twice.** `you.score` is the individual's raw score while `you.position`/`playerCount` are the team's; `you.key` is `faceKey(playerId)` where board rows are keyed on `faceKey('team:…')`, so play.js's fallback appends a duplicate "you" row every time. Measured: header 1,390, projector 695, mini board showing "1 Quizzly Bears 695" and "1 Daves iPhone 1,390". The docstring above `boardIdFor()` names this exact fault as the one it fixes.
- **Every control in the host's Playing panel is dead.** `hostView().players` rows carry `team:…` ids; `adjustScore`, `renamePlayer` and `removePlayer` all look them up in `state.players` and answer `{ok:false}` in silence — the menu closes either way, so the host believes it worked.
- **Every team wears an "off" badge all night and no team ever gets a tick.** `teamScores()` does not build `connected`/`correctCount`/`lastSeenAt`, and `answeredThisQuestion` asks the answer map for a team id that is never a key. The one signal for "has that table dropped off my wifi" is inverted, permanently.
- **The idle count is computed from team rows** while `removeIdle` removes phones — 12 phones in 3 teams, 3 answered, panel computed 0 idle and drew no button while the underlying call would have removed 9.
- **The fastest finger names a phone that is on no board, with points in different units from the board beside it**, and **whoPicked / "who let it go by" name phones** — so the host's mic line names somebody the room has never heard of, and `missing` lists a player whose team answered. **[one verifier on these last two]**

**Fix:** resolve `you.score`/`you.key`, the fastest finger, `whoPicked` and `wanderedNow` through `boardIdFor()`; build `connected`/`correctCount`/`answeredThisQuestion` per team in `teamScores()`; give the host's row actions a real target; send a separate `phoneCount` for the answered line.

### 12. One transient GitHub error permanently empties the league, Past gigs and the gallery
`server.js:3463` and `server.js:865` · public-exports · both reproduced with a one-shot 403 stub

Same root cause in two places: `getFile()` returns `null` and `listDir()` returns `[]` for a 403, a 500 or a dropped connection — indistinguishable from "there is nothing there".

- **`ensureArchiveRestored()` latches before it awaits.** One 403 on the first read after a deploy and the room is marked restored with nothing restored: public league `[]`, `report.pdf` 404, console leagues `[]`, Past gigs 0 nights — for the whole process lifetime, with the backup intact and nothing logged. The same add-before-await is in `ensureAdvertsRestored`, `ensureInvoicesRestored` and `ensureOwnPacksRestored`.
- **The photo-cache caches the failure with no TTL.** One 403 on the first visit to a published night and every visitor after them gets `photos: []`; the index then drops the night entirely, so it does not look thin, it vanishes. Only a restart clears it. The burst that produces the 403 is exactly the burst the cache was built for.

He reads the gallery QR out to sixty people. If one of the first arrivals lands in a rate-limited moment, everybody after them sees nothing.

**Fix:** latch on success, hold an in-flight promise per room, and give both `getFile()` and `listDir()` a way to say "I could not read this" separately from "it is empty". Add a TTL to `cachedNight`.

---

## Everything else, grouped

### Scoring, teams and vouchers **[P] unless noted**

- **Back from a live question keeps that question's points and locks those phones out when it is re-asked.** `engine.js:1621`. One over-press of Next, then the button the host is told is safe: two tables keep points and the first-correct bonus for a question the room never played, and answer `already_answered` on the replay while everybody else plays for 100 points less. `skipQuestion()` and `redoQuestion()` both call `clearQuestionScores()`; `back()` does not.
- **`makeTeam()` has no guards, and the refusal in the caller comes too late.** `engine.js:874-879`. Two consequences from one hole: (a) on a random-teams night any phone can put unfiltered text on the projector with its own token — `/api/team` answers `{ok:false, reason:'random_teams'}` while the team is already written, and honest joiners are then dealt into the injected teams because they have size 0; (b) 1,200 teams created in 1.3 seconds with no cap, taking every SSE payload from 0.7KB to 85KB and flushing state to disk on each one, at the lobby. Fix: refuse in `makeTeam()`, and cap at `RANDOM_TEAM_MAX`.
- **Leaving a team between questions raises the team's average and reorders the projector.** `engine.js:916`. A table sheds its weakest phone at the reveal and overtakes its rival with no question asked. `joinTeam()` refuses mid-question for precisely this reason; the reveal is one beat later. **[one verifier]**
- **A phone is told it was right several seconds before the reveal, via `you.correctCount`.** `engine.js:2567`. Score and position are properly frozen; `correctCount`, three lines below in the same object, is live — and nothing in the app draws it.
- **Replaying a question after the final leaves beaten teams holding live top-prize vouchers.** `engine.js:1341`. Back, Back, Ask again, replay: three live pint vouchers for a night with two winners, one of them with a team the room watched come last. `issueVouchers()` tops up and never reconciles.
- **Reset scores keeps the whole prize ledger.** `engine.js:1747` (not protected). Two shorter quizzes for one room — the case the winners setting was built for — and the second game's genuine runner-up gets nothing, night one's first-place voucher is still live at the bar, and the draw never runs.
- **Stopping the quiz at a round intro silently cancels the prize draw.** `engine.js:1459` (not protected). `answeredTheLastQuestion()` reads the current pointer, which for a round nobody has started is empty.

### Bingo

- **The BINGO button reads "BINGO!" and is enabled on one line when the prize needs two, three or four.** `bingo.js:932`. On the default 5x5/5-prize settings every 40-track pack ships with, every phone lights up the moment one line lands — measured **223.9 false calls per round** at 60 players — and each press books the player a public "honourable mention for the false alarm" on the win card, and poisons `falseCalls`, the only number the host has for telling a chancer from a mistake. Only the 4x4 two-stage default escapes.
- **Rule 4 does not exist on a bingo night, in both halves** — found independently by **bingo and session-order**. `host.js:428` / `session.js:1302`. `joinsWaiting` is computed and delivered (80 held phones confirmed) and nothing draws it: no "Let them in", no number, while every held phone reads "The host is letting everybody in". And the other remedy throws: `POST /api/host/removeIdle` on a bingo night is a 500, `this.engine.removeIdlePlayers is not a function`. Sharing the join-queue panel between the engines makes the 500 reachable, so both halves want fixing together.
- **Bingo's red Finish is drawn while another part is queued.** `host-bingo.js:80`. One press files the evening as bingo-only and permanently blocks the real end from reaching Past gigs — the quiz's scores, podium, league contribution and vouchers all vanish, with the archived record still claiming `parts: ["bingo","quiz"]`. The quiz hides its Stop for exactly this reason; `continuing` is already computed two lines above.
- **Label collision: "Continue to the quiz" and "Continue to the quiz now" are drawn side by side and both call `advanceOrder`.** `host-bingo.js:76`. Four controls about what happens next, two of them the same control twice.
- **Correcting a prize after it has been won never reaches the voucher already in the winner's hand.** `bingo.js:612`. `payWinnersOwed()` decides "paid" from winner + place + time and never compares the reward text, so the bar reads out a prize the venue is no longer giving, and pressing Prizes again does nothing. **[one verifier]**
- **The last prize can go unawarded while the app has watched somebody complete the card.** `bingo.js:521`. Small rooms and interrupted rounds; the end-of-night card silently shows one prize where the night was set up for two. **[one verifier]**
- **Bingo's voucher payload is a raw spread** — `bingo.js:966`, the only voucher in the app not built field by field. Leaks nothing today; the next field added to a stored voucher rides out to a phone without anybody deciding it should.

### Running orders and part boundaries

- **A running order that ends on a bingo throws the whole quiz's scores away.** `session.js:476`. "Quiz then finish with the bingo while they drink up" is an ordinary evening: the filed leaderboard has no positions and no scores, the league table comes back `[]`, the report has no podium, and the quiz's vouchers are never issued. Identical night with the bingo in the middle files correctly.
- **The server does not refuse "finish" mid running order, though `host.js` says it does.** `session.js:1364`. `moreToCome()` does not exist. Any stale or backgrounded control view still draws "Stop the quiz", and the server takes it: night filed two hours early, real voucher to whoever led after round one, and the order stranded on FINAL with two parts queued.
- **A phone the host removed walks back in at a part boundary.** `session.js:1119`. `state.removed` is not carried, so the phone is told `rejoin` rather than `kicked` and `silentRejoin()` puts it back with the same name and, on a bingo part, a live card — the one thing a host can do about a name that cannot go on a projector, undone by pressing Continue.
- **Organisers are dropped at a boundary and silently rejoin as contestants.** `session.js:1063`. The carry is built from `playerList()`, which filters organisers out by design. The client's contact lands on the leaderboard and the projector, and loses the back channel mid-event.
- **A pinned lobby game is lost from part two onward** (`session.js:777`) and **"Let them choose" leads with the wrong game after part one** (`session.js:155`) — found independently by **session-order and lobby-games**. A Gold account that pinned Quick Draw for a corporate booking gets Maze Mouth for the rest of the night while the bar still reads Tailback; and the bingo interlude's chooser opens on the quiz's default. Fix: keep the host's *request* as `lobbyGameWanted` and carry that; rotate the carried list so the kind's own default leads.
- **`describeOrderParts()` throws away `composeQuiz`'s `sources`**, `session.js:1109`, so every quiz pack in a running order files under `~tonight` and reads as "Never played here" next week — the app confidently telling him a room has not heard something it heard last Thursday.
- **Unlaunch mid running order leaves the order live in memory.** `session.js:1294`. `resetAll()` wipes the state but not `this.runningOrder`, so a later Continue relaunches the night with venue, prizes, look, clock, teams and break plan all gone, and `launched` reading true again.
- **The venue's prize list is paid out once per part**, `session.js:121`, so a three-part night asks the venue for five drinks against a list of three, with the same words on two vouchers. Masked today by the voucher loss above — fixing that makes this visible at the bar. **[one verifier]** and possibly intended; worth a decision rather than inheritance.
- **A pack deleted mid-evening gives the host a raw ENOENT with the server's absolute path** — found independently by **session-order (`session.js:1121`) and rooms-scoping (`server.js:6691`)**. `launchRunningOrder` pre-loads every pack precisely so this cannot happen and has friendly wording; `startOrderSegment` and the launch route's catch pass `err.message` straight through, on a 2.2-second toast, in a dark pub. For an own pack the path names the room.

### Crash recovery and stored data

- **`state.archivedAs` and `state.league` are assigned after the flush that would have saved them.** `session.js:499` **[P]**. A restart on the final scores files the night twice (confirmed: one archive file became two after a single phone reconnected) and takes the season table off the last slide. `mergeGigs()` folds the duplicate, so the damage is a junk archive file, a duplicate backup push, and a guard everyone believes is in place that is not.
- **`library-stats.json` and `offer-opens.json` are the only two data files written without temp+rename**, `library.js:191` / `offers.js:85` — and a truncated stats file permanently blocks its own restore, because the boot guard tests `existsSync`. The shelf's freshness ranking resets to never-played, for good.
- **`offerLobbyGames()` says "in memory only, deliberately — no flush" and the value reaches `state.json` anyway.** `session.js:275`. `Store.save()` holds the object by reference. A stale tier's list serves the fallback lobby until the next host request.

### Accounts, tiers and access

- **A hand-set `mmm_acting` cookie walks past the "their game is up" refusal and past the "came in" log line.** `server.js:506`. Both guards live on the act-as route; the identity is granted by `whoIs()`. The owner sitting on a subscriber's live control view mid-question, with nothing in the support log. **[one verifier]**
- **The owner (and anyone with `?key=`) can take over any account with no grant and no log — and it signs them out of a live console mid-night.** `server.js:6361`. Password reset, status change and close all drop every session and write nothing to the subscriber's support log; act-as refuses exactly this with a 409. **[one verifier]**
- **The tier and subscription check is only on Launch.** `server.js:6428`. Run a Gold pack once, redeploy, and `boot()` re-arms it from disk: a Bronze account drove the whole Gold pack with the answer key. A cancelled account, refused at Launch, ran a complete night on whatever its room last held.
- **Any account — including a cancelled one — mints unlimited permanent `status:'active'` Bronze accounts through `/api/group/seats`** — found independently by **routes-auth and accounts-tiers**. `server.js:5316`. No gate, no cap, no charge; `addChild()` hard-codes active with no trial clock, and `removeChild()` only deletes `parentId`, so add-then-remove is a free-account generator indistinguishable from a real signup. One £10 subscription runs a whole pub group.
- **Three controls ask the raw account instead of the effective one.** One cause, three failures: the owner's tier/comp/Close on a **seat row** all report success and change nothing (`accounts.js:965` — Close said "cancelled" and the seat then signed in and launched a quiz); a **seat cannot switch off** the features it holds through its parent, the switch flips back On with no error (`accounts.js:589`); and **`view.mayAdvert`** asks `accounts.find(room.id)`, so a seat entitled to adverts gets no Advert button on the control view while every other route allows it (`server.js:214`). Fix in each case is `effective()` / `whoIs()`, which `canInvoice()` already documents.
- **The tier preview upgrades inside a support session.** `server.js:555`. "Only ever a downgrade" holds for the owner's own account and is false on the invited branch: inside a Bronze subscriber's account the owner held Gold and wrote an advert set that then rotates on that subscriber's projector for ever.
- **Advert slides are not enforced on the break-plan path.** `server.js:6685`. Every gate says no (PUT 403, `mayAdvert` false) and a Bronze account's `breakPlan: {"p0:r0":{"screen":"adverts"}}` puts the slides on the big screen. The console offers the two advert options with no lock. Silver's only capability, walked round. **The stale comment that made it invisible:** `gates.js:51` says advert sets are "Basic anyway", where `plans.js` puts them on Silver — fourth sighting of a comment claiming the opposite.
- **`accounts.update({status:'trialing'})` grants an unlimited Gold trial** — `accounts.js:400` never writes `trialEndsAt`, and `trialExpired()` reads an absent field as false. "Have another two weeks" becomes permanent free Gold, including STREAM. **[one verifier]**
- **The Money tab counts group seats and dead trials as income, and an expired trial never appears on the lapsed list.** `owner.js:608`. £70/month reported against £50 real, and the row that needs chasing is on neither list, labelled "Trial — it turns green on its own".
- **A grandfathered feature leaks out of a group**, `accounts.js:552`: a seat added after a move up does not get what the rest of the group kept, and `removeChild()` leaves an unbilled Bronze account holding a Gold feature permanently.

### Privacy and the owner boundary

- **The owner's console prints a subscriber's private pack title, its id and its round title.** `server.js:1957`. `/api/library` as owner returns `otherRooms` with `pack`, `packId` and `where` unmasked; `/api/owner/overview` masks the first two and not `where`, directly under a comment saying "a room playing one of their own says so and names nothing". No grant, no consent, no log line. The leak is `Room.summary()` carrying `engine.where()`, built from `round.title`. **`/api/playing/<kind>/<id>` is the same promise broken again** (`server.js:3183`): room scoping applies only when the pack is the asker's own, so a stranger can confirm another subscriber's private pack id, that they are working tonight, and which question they are on — under a comment saying it "can never leak across accounts either". Fix at the source: mask in `Room.summary()`, and split `engine.where()` into a room-safe form.
- **A support session downloads a subscriber's photographs with no log entry.** `server.js:1195`. `supportGuard` returns early for anything outside `/api/`, so `/past-photo/`, `/gallery-photo/` and `/photos/` are silent — while `supportWords()` carries "Looked at your photos" for `/api/photos`, a route that does not exist. The gap has looked closed since the day it was written. ("Did you look at my photos" is the question the log exists to answer.)
- **Photo filenames are not unique across rooms**, `photos.js:325`, and `/photos/<name>` serves the first room that matches under a comment claiming the name is unique. Two rooms whose Nth photo lands in the same millisecond collide — a member of the public's face from one pub on another quizmaster's screen. Narrow coincidence; the comment is what stops anybody checking.
- **`pathsFor()` has no `offers` entry for any non-house room.** `rooms.js:349`. `new Offers(undefined)` throws into a `catch {}`, so every subscriber's advert-scan count is correct until the process restarts and then reads zero. The count *is* the feature Silver is sold on. Third whitelist in the repo that dropped what it did not name.
- **`/api/brand?q=` confirms which account ids are real**, `server.js:1751`, and returns the holder's trading name — undoing the anti-probing property `galleryRoomFrom()` goes out of its way to keep on the sibling route. **[one verifier]**

### Public pages and exports

- **The landlord's report silently drops the season table for any night typed freehand at a pub whose league is on.** `server.js:4097`. `leagueRunsAt()` asks under the entry's own keys; the switch is stored under the *folded group's* `id:` key. The two most recent nights — the ones a landlord is actually sent — are the ones missing the table, while the public page is correct.
- **`?as=visitor` is honoured by `/api/league` and the league page never sends it.** `league-page.js:61`. He learned the trick on the gallery, applies it to the league to check the table is really up, sees the table, and tells the Tuesday crowd about a page that is empty. No server change needed — port the gallery's three pieces.
- **Deleting a pinned photograph leaves a ghost pin**, `gallery.js:388`, and the pin control then refuses with an error he can see is false ("Three is the most a card can show" with one pin on screen), with no control anywhere that can clear it.
- **A green lamp says "On the public gallery" on every photo of a night that is not published**, `console-gigs.js:888`, four inches above the button offering to publish it. In one direction it makes the publish press read as tidying something already public; in the other he sees green on an unpublished night and starts switching lamps off in a hurry over nothing. **[one verifier]**
- **The calendar feed folds lines by UTF-16 units**, `ics.js:51`, so an emoji straddling the fold arrives as two replacement characters, and lines run to 79 octets against a stated 75.

### The console

- **The editor's Check button is refused for the owner, and reports "All good" anyway.** Two findings, one press. `/api/quiz/__validate` and `/api/bingo/__validate` fall to the broad quizmaster gate, which an owner does not hold — found independently by **routes-auth and routes-shape**, both reproduced as a 403 with a signed-in owner and a 200 as a quizmaster. `gates.test.js` pins the exclusion, so the cause is asserted and the consequence has never been fired. And `editor.js:345` reads `data.problems` without ever checking `res.ok`, so **any** failed response — 403, 401 after a deploy, 500 — prints "All good". The one control whose job is "is this pack fit to sell" is switched off for the only account that writes the packs, and reports a pass. `save()` one function above handles this correctly.
- **A lapsed or expired-trial console is eight words and a Sign out button.** `console.js:435`. No doors, no Help tab, no My account, no tier ladder — the page says "get in touch" and gives no way to. This is every signup that has not converted in fourteen days. `tabBody()` already has the "Nothing to show" branch; `load()` bails before it.
- **Renaming a prepared night to the same slug deletes it.** `console-shows.js:288`. "Friday Night" → "Friday night" saves under the same id and then DELETEs it: the packs, running order, ticks, prizes, look, lobby game and break plan, gone, no confirm, both calls 200. The pack rename beside it does this correctly.
- **The "What you use" switches are one-way, and switching a second feature off switches the first back on.** `console-account.js:103`. `switchPanel()` builds rows from what is ON rather than what the tier includes, so a switched-off feature loses its own switch — the Invoices tab, with the venue records and bank details behind it, out of the console with no way back. The panel's own copy promises the opposite.
- **Arriving on a link that carries `?tab=` kills every tab button on that door.** `console.js:1167`. `currentTab()` reads the query first; the tab handler only writes localStorage. The app puts him there itself — six `goTo()` links, including "add one on the Venues tab" from the Console door. `goToTab()` in `console-diary.js` documents the hazard verbatim and works around it; the tab bar never got the fix.
- **Publishing a league table looks right for one paint and then the console says the opposite of the truth.** `console-community.js:1216`. `leagueToggle()` never updates the held `published` binding, so the next repaint reads false: the button that says "Put this table up" republishes it, and there is no way to take it down without reloading. `runningToggle()` twelve lines up does it correctly.
- **After changing colour scheme, the swatch for the one you started on is dead.** `console-account.js:1415` — a stale `const mine` read at build time, on the one control whose job is trying colours.
- **A Bronze quizmaster is never shown the locked "Quiz league" tab**, `plans.js:1091`, because LEAGUE is filtered out of `missing[]` as an owner feature. "A door that vanishes sells nothing" — the Adverts tab beside it draws locked correctly.
- **The control view's Setup panel has a Load button that posts to `/api/host/loadQuiz`, which no handler answers.** `host.js:998` **[P]**. Measured pressable at 430x900; the confirm promises to clear the scores and players, then the toast reads "Failed: Unknown action: loadQuiz". Drawn at the lobby and at the end — exactly when a host reaches for it. `dead-controls.mjs` cannot see it (console only, and it answers every confirm no).

### The launch bar

- **The quiet launch sends five fields out of twelve.** `console-tonight.js:1364` **[P]**. Set Appearance, Playing, Game sound and Winners, then tap a pack in: the POST carries game, packId, venue, online and lobbyGame only. Halloween night on the default look, Game sound Off ignored by sixty phones, "dealt at random" dealing nobody — with the live line asserting agreement. The `lobbyGame` half of this exact fault is already recorded as fixed; the fix went on one field. And once anybody has joined, the only control that can apply the bar answers 409 and offers to wipe the room.
- **Changing the Card shape leaves the Prizes face and its whole menu stale**, `console-tonight.js:2068` **[P]** — pressing an option that no longer exists blanks the control and launches `prizes: 0`. `paintPrizes()` rewrites the select and never calls `refreshPicks()`, the rule the file itself states.
- **"In the gaps" only writes the gaps that existed when it was pressed.** `console-tonight.js:2148`. Add a second pack and the venue's adverts stop half way through the night while the face still says "Your adverts" — the quizmaster's own revenue, and the venue is who notices.
- **A mixed night's bingo shape and prize count are dropped when it is kept as a show.** `console-tonight.js:3753`. A 3x3 one-prize interlude prepared on Monday comes back Thursday as the pack's 4x4, two prizes.
- **Loading a saved show from the Workshop door does nothing at all.** `console-tonight.js:470`. Tap and drag are both dead there — `showWanted` is module state and the door chips are full page loads — and Workshop is where CLAUDE.md says the show editor lives. On a phone it is the only way in.
- **"In the gaps" is enabled and pressable on a bingo-only night and changes nothing**, `console-breaks.js:179` — the launch sends an empty break plan. Present, live and ignored, where the rule is present and inert with the reason on the control.
- **A 13-round night launches as 12 with nothing said** `[P]`, `console-tonight.js:3298` — the console's own "at most 12" alert is unreachable for any pack drop, and `server.js:6713` slices instead of refusing, where `running-order.js` throws.
- **A burst pack draws one gap dial per round tile and all of them set the same gaps** — `console-tonight.js:2591`, pressing the last tile's dial changes the first. The duplication the chip strip was killed for.
- **An empty running-order slot announces itself as a button**, `console-tonight-mix-ui.js:334` — `role="button"`, focusable, 167x90, inert on click and on Enter, and by construction inert on touch.
- **`isMixed()` is imported, never called, its comment claims it decides the launch route, and it now answers true for every ordinary night.** `console-tonight-mix.js:328`. The pinned test asserts a shape the row stopped building.
- **Secs per Q shows the number you typed and launches a different one** — `console-tonight.js:2129`, the clamp is never written back to the field.

### The projector and the phones

- **An answer POST that fails leaves the phone permanently disabled saying "Locked in".** `play.js:1515` **[P]**. One dropped request on pub wifi costs that team the whole question, and the phone tells them they answered. The comment above the catch says the buttons come back on the next update; nothing re-enables them. Bingo's `toggle()` reverts its optimistic paint correctly — the quiz path is the outlier.
- **The winner slide and the round board never re-render**, `screen.js:70` **[P]**, so a score fixed in front of the room never reaches the projector: measured, Bob at 9,999 on the host's screen and "1 Ann 390" on the wall, and at the final the wrong team is announced in gold while the voucher goes to the engine's winner. The scoreboard *flag* follows correctly, on the same page — it has an `update`.
- **A question corrected mid-quiz reaches the wire and not the screen.** `screen.js:57` **[P]**. He confirms the 409 that exists for this, the PUT returns 200, `reloadPackEverywhere()` runs, and the projector and every phone keep the old prompt and options — the card key is `q:round:question`, which a correction does not change. Worse when the answer moves: the reveal lights the new index against the old option list. Rule 11 states the opposite.
- **The advert card is keyed on the slide's heading alone**, `screen.js:54`, so a corrected price never reaches the projector and two slides sharing a heading do not switch — with a paying advertiser on the other end. Rule 9 states the opposite. The break rotation's key carries only `breakAdverts.length`, which is not identity either.
- **`boot()` does not check the join gate's 202**, `play.js:1896` **[P]** — reopening a held phone writes `{waiting:true,…}` over its stored id, token and team name and shows a bare join box with no message. `showJoin()` and `silentRejoin()` both check `waiting`; `boot()` is the one that does not.
- **A big photo dims the lobby's join QR.** `style.css:396` **[P]**. Measured: white modules drop 255 → 162, mean 161 → 79, for 4.4 seconds per photo. The `z-index: 4` guarantee was applied to the round board's corner code only — and the comment on it is about a busy lobby. **[one verifier]** (dimming measured; scannability not).
- **Chat freezes on every phone once a room has had 60 messages**, `chat.js:173` — `KEEP_PER_ROOM` saturates the length the redraw guard compares, so the transcript stops and the unread badge stops counting, including the organisers' back channel.
- **A removed player keeps a live camera button and chat button over the "you were removed" screen**, `play.js:809`, plus a green "Connected" light with no stream.
- **The scoreboard and an advert do not clear the photos slide.** `engine.js:1122` **[P]**. `showPhotoSlide()` clears the other two; neither clears it back. The host's button stays lit describing what the room is seeing wrongly, and pressing it does nothing. Rule 9 says the flags clear each other.
- **A break that offers the lobby game promises "Top scores go on the big screen" and the projector never shows them**, `engine.js:2181`. The three lobby-only guards were generalised to "a break that offers a game" when breaks landed; the board was deliberately left lobby-only and the phone's wording was not changed.
- **Label collision on the control view: "Big screen" is the only control naming the projector that does not act on it**, `host.js:1192`, and the only button on the bar with no `title` — it opens a second window, on a phone. "Edit" beside it is a bare verb whose object lives in a tooltip a phone will never show. **[one verifier]**

### Lobby games

- **Pile Up banks an object where every other game banks a number**, `lobby-pileup.js:78`, so every per-life score records as zero — and per-life banking is precisely what puts the people still playing when the host starts on the board. Silent: the POST returns 200. All 93 lobby tests pass with it in.
- **The Top Scores board adds a fourth child to a three-column grid**, `style.css:440` **[P]**, so on a mixed board the score wraps to its own line and three of five rows are below the fold on a `overflow: hidden` projector. "Let them choose" is the selected default, so a mixed board is the normal case.
- **The "tap to play again" listener is never removed**, `lobby-menu.js:235` **[P]** — measured 180 rAF callbacks/sec, i.e. two game loops, with scores posted under a game nobody chose, and one loop plus a window `keydown` surviving into the question. The exact fault CLAUDE.md records as fixed, back through a different door.
- **Closing the game box while its module is still loading leaves a full game running behind a shut card**, `lobby-menu.js:219` — only on a slow connection, which is the moment the lazy import exists for.
- **Maze Mouth's step is gated on the frame clock with no accumulator**, `lobby-game.js:225` — at 40Hz the player slows 12% while the chasers do not; two phones on the same seed, same taps: 860 vs 570, 1210 vs 1140, 930 vs 700. iOS Low Power Mode caps rAF at 30fps, so the throttled handsets are systematically pushed down the board. Tailback has the same gate. Two docstrings claim grid games are frame-rate independent.
- **`lobbyGameOptions(kind)` ignores its argument**, `console-packs.js:838`, and the launch bar computes `firstKind` for nothing; the docstring states the opposite of what it does.

### The stylesheet

- **The lobby's QR panel has no `vh` cap** `[P]`, `style.css:405` — on 21:9 the typed-URL fallback is off screen; past ~3:1 the code itself is cut, on a page with no scrollbar. The rules slide's identical panel is capped and fits everywhere.
- **`.pack-card.shut`'s `aspect-ratio` plus `min-height: 118px` gives every card a 118px minimum width** `[P]`, `style.css:2467`, which a six-column grid cannot honour: between 561 and ~790px the pack cards overlap by up to 28px and the console scrolls sideways. An iPad in portrait is 768px. `console-frame.mjs` never looks between 561 and 900.
- **The owner's hat switch and tier rungs do not shrink far enough, on two pages** `[P]` — `style.css:6229`. `/host` scrolls sideways 161px at 390, 191 at 360, 231 at 320 (owner cookie + key, i.e. his actual bookmark), and `/console` still runs 53px off at 320 and 13px at 360 with the Gold rung cut in half. Quizmaster accounts are clean at every width. `console-frame.mjs`'s only phone size is 390.
- **"Secs per Q" and "Game sound" are ellipsised at every desktop width including 1900px** `[P]`, `style.css:6730` — the row is 1px over its own content and the two cells sized by their label are the only ones with no slack. Three pixels of gap fixes it.
- **With a night running the Console doorhead is 573px and the other three are 386**, `style.css:3201` — the equal-bay rule's own symptom, on the only night it happens. `community-bay.mjs` measures its reference with no night running, so it agrees with a number he never sees. **[one verifier]**
- **`.host .panel button.minor.danger` declares `border-color` after `border-bottom-color`**, `style.css:1491`, so the control view's four red buttons lose the full-strength red edge the console's identical rule keeps.
- **Two rules read `var(--dim)` and `var(--muted)`, which have never existed**, `style.css:3534` and `6611` — so an expired topical pack's label draws brighter than a fresh one, and the "Show N cleared" toggle has no hover feedback at all.

### The guards themselves

This group is its own risk: several of these report green while the app is broken.

- **`pub-unchanged.mjs` never boots the server.** `scripts/pub-unchanged.mjs:58`. Deleting `view.joinCode` from every payload → "IDENTICAL". Making `src/session.js` throw on import so the app cannot start → "IDENTICAL". It compares `engine.js` only; the nine fields `viewFor()` adds — including the join code — and the whole of `session.js` are outside it, while the header claims it compares "the actual BYTES a projector and a phone receive". This is the guard named as the one to run before a gig week. **[one verifier]**
- **`support-access.test.js` and `gates.test.js` make zero requests.** Every server-side claim is a regex over `server.js`. Driven for real, an acting session's `/api/me` returned the subscriber's **password hash, salt and scrypt params** — 99 tests green. And deleting the entitlement gate on `/api/past-gigs`, replacing it with a comment containing the words `FEATURES.PAST_GIGS`, left `gates.test.js` 22/22 green.
- **`final-fits.mjs` never loads `screen.js`** — it measures a hand-written replica and a retyped copy of `fitWinner()`, under a comment saying it runs the real one. Deleting the projector's real `fitWinner()` and renaming `.endband` left all 18 checks green.
- **`shot-bingo.mjs`'s anti-cheat check passes vacuously** — renaming one class turns rule 6's only browser guard into `[] === []`, and it exits 0 saying "card identical: YES".
- **`save-a-night.mjs` asks for `GET /api/shows`, which does not exist**, so its only server-side assertion never runs and it prints `threw: … "Not found" is not valid JSON` on a healthy app. Shows are read back off `/api/library`, which works.
- **Four browser guards can never exit** — `save-a-night`, `dead-controls`, `gig-path`, `visual-qa` set `process.exitCode` and never call `stop()`; cleanup is on `process.on('exit')`, which cannot fire while the spawned server holds the loop. A live witness on this box: `save-a-night.mjs` at 3h22m with its chromium children up and its temp DATA_DIR still on disk. They cannot be chained, and each run leaks a server and a data dir.
- **Three guards take a fixed port with no free-port check** (`drag-check` 48771, `save-a-night` 48991, `final-fits` 8971, the last with no `PORT` override at all), so an orphan from the point above silently hands the next run somebody else's server. `dead-controls.mjs` hard-stops on exactly this and says it has already happened. **[confirmed by inspection, not driven]**
- **`dead-controls.mjs` walks an idle console**, so eleven launch-bar controls are never pressed — including **Save**, which was dead for a day with everything green, and all four **gap dials**, which have died twice in a week. Three lines fix it: tap a pack card first.
- **`console-split.test.js`'s "and something actually draws it" greps raw source** — commenting out the only caller of `tierRow()` keeps it green, which is the whole subscriber upsell disappearing silently. Two tests above it in the same file the author writes that comments must be stripped first. Same in `gallery.test.js:158`.
- **`console-markup.test.js` stops counting at the first `querySelector`**, leaving ~9,500 characters of `gameSection()` — the pack shelf — unchecked; an unbalanced `<div>` there passes all three markup guards. **[one verifier]**
- **The console is twenty-one modules, not twelve** — `console-source.js`, `console-split.test.js` and CLAUDE.md all say twelve. The enumeration is dynamic, which is why it drifted; say "one file per door or tab" rather than a number.

### Dead code, unread fields and stale comments

- **Four fields built on every push that nothing draws, two of them with comments claiming they are drawn** — `correctCount` (on the projector's leaderboard, every phone's mini board and the host rows), `lastSeenAt`, `joinedDuringQuiz`, and `arcadeBest`, whose comment says "so the phone can say 'your best: 70'". Also `you.falseCalls` on a bingo phone. `engine.js:3097`, `arcade.js:126`, `bingo.js:915`.
- **Two GET routes with no caller anywhere:** `/api/archive/<night>` and `/api/results.json` (its sibling `.csv` is the one that is wired). `server.js:2346`. Plus `supportWords()`'s `/api/mine/` read branches, which can never be written. **[one verifier]**

### Known issues re-found independently

- The **`archivedAs` carry wiping the filed night's vouchers** was re-confirmed live over HTTP by the session-order lens (filed vouchers went from two codes to `[]` on part two's first push), and finding 25 above gives it a reachable trigger: bingo's Finish, drawn while a part is queued, is the only thing that sets `archivedAs` early on a running order.
- The **lobby-game-not-carried-in-`switchIfFree`** fault, recorded as fixed for one field, is the same hole as the quiet launch sending five of twelve fields.
- `winnersOf(state)` on a bingo state and the `delete p.teamId` strip were confirmed still as recorded and are not re-reported.

---

## Patterns worth naming

Five causes account for about half of the list. Each one is cheaper to fix as a rule than as N bugs:

1. **A whitelist drops what it does not name, silently.** `nightWideOpts` (vouchers, prizeWinners, removed, organisers, the lobby-game request), `pathsFor()` (offers), `Accounts.restore()`, `doLaunch()`. Every one fails with nothing thrown.
2. **The raw account is asked where the effective one is meant.** Three controls on the owner page, the seat's own switches, `mayAdvert`, grandfathering. `whoIs()` exists as the single choke point and is bypassed at each site.
3. **A comment claims the opposite of what the code does.** `moreToCome()`, `gates.js` on advert tiers, `offerLobbyGames`, `/api/playing`, `photos.js` on unique names, `isMixed`, `arcadeBest`, `lobby-game.js` on frame rates, the console's "twelve files", and the essay above the wiped `overflow` line. Every one is where a later session stopped checking.
4. **A control reports success it did not have.** The editor's Check, the owner's Close on a seat, the feature switches, the league publish toggle, the phone's "Locked in", the host's per-player menu. A press that answers `{ok:false}` and closes the sheet is invisible to every test in the repo.
5. **A guard that never runs the artefact.** `pub-unchanged` (no server), `support-access`/`gates` (greps), `final-fits` (a replica), `shot-bingo` (a selector that matches nothing), `dead-controls` (an idle console), `console-markup` (a truncated slice). The repo's oldest recorded lesson, sitting unapplied in the checks written to enforce it.

---

## What held

This is as much of the report as the ranked list. Almost everything the app promises about secrecy, isolation and money held under direct attack.

**The two-screens rule held completely.** A six-round quiz — one round of every type — was walked through every phase with sentinel strings planted in every host-only field and the three payloads diffed key by key. Nothing sensitive reached the projector or a phone: not `note`, not the round-3 cue (title, artist, hint, Spotify uri), not `spotifyPlaylist`, not an advert's `say` line, not `correctIndexes` before the reveal, not `whoPicked`, not `wandered`, not `upcoming`, not `breakoutAnswers`. `hostView().clock` is still a named whitelist rather than a spread. `advertsForVenue()` still strips the mic cue from `breakAdverts`.

**No player id or token leaks anywhere, on either engine.** Every snapshot of both games was searched for the real ids: the projector, the phones, the lobby list, the photo wall, the fastest finger, the archive and chat are all `faceKey`. Tokens appear in no payload at all, host included. Voucher codes never reach the projector, and each phone sees only its own. The role gate held from both sides: `HOST`, `hOsT`, `" host"` and `host%00` all fall through to `screenView()`.

**The token gate held on every phone action.** `/api/claim`, `/api/mark` and `/api/arcade` with no token, and with another player's token, all answer `not_yours` — `runPlayerAction` checks `ownsPlayer` before it dispatches, and there is no second route in. Rejoining with the right token returns the same player and a byte-identical bingo card; rejoining with a wrong token mints a new player, so rule 6 and rule 3 agree with each other.

**The scoring arithmetic is sound.** A 400-seed randomised walk (every round type plus breakout, with answer/next/back/skip/redo/goTo/finish/resetScores/removePlayer/rejoin interleaved) found no invariant failure: every score always equalled the sum of that player's recorded answer points, and `answeredCount`/`correctCount`/`totalResponseMs` always matched. No NaN, no Infinity, no negative score without a host's own adjustment. Part marks, the first-correct bonus and exactly-N picks all behave as documented. Every pack on disk validates.

**The `scoreBefore` / `positionsAtStart` freeze works** — a correct answer moves neither the phone's score nor its position before the reveal (`correctCount` is the one leak, reported).

**Crash recovery is solid for everything except a composed night.** An ordinary single-pack quiz came back byte-identical after SIGKILL. Bingo is the strongest part of the app: killed with no wait at all, calls, marks, cards, stage plan and both players all survived — the per-tap flush is real. `state.removed` survives, so rule 5 holds across a restart. Running-order state survives at a bingo part. A truncated state file is quarantined to `.broken`; an array, a bare number, a future phase word and out-of-range pointers all boot cleanly. SIGINT/SIGTERM flush every room.

**Room isolation held against everything thrown at it.** No `/api/host/*` route takes a room parameter — two quizmasters driving simultaneously never touched each other's rooms, including with `g=`, `q=`, `room=`, `roomId=` in the query and in the body. `?q=` was validated against `..`, `%2e%2e`, null bytes, zero-width spaces, 300-character strings and wrong-case ids: all landed on the reserved empty-gallery room, minting no directory and persisting no code. Own packs stayed private from every direction except the two summary routes reported. The join gate is per room.

**Path handling held everywhere.** Nineteen traversal shapes against every photo, archive, invoice, gallery, pack and static route, encoded and double-encoded and with `--path-as-is`: every one answered with a written sentence, and no response body anywhere contained the data dir or `/home/user` — except the two launch/advance catches reported.

**Route shape is clean.** All 108 distinct route shapes the browser can send were fired as owner, as quizmaster and with the host key: not one fell through to the generic 404, no generic prefix shadows a later exact route, the one-segment venue catch-all's RESERVED list is complete, and forty-four POST routes fuzzed with wrong-typed bodies produced **zero 500s**. Every host action both control views send is answered by the right engine (`loadQuiz` was the only orphan).

**The pack paywall and the self-grant refusals held.** A Bronze account's library strips locked packs to `{locked, pence}`; reading or launching one is 403. `PUT /api/owner/accounts/<self>` with tier, comped, packs or status is 403; `PUT /api/me/prefs` can only ever subtract; forging `mmm_tier=gold` as a quizmaster does nothing, because `whoIs()` reads that cookie only for the owner. `effective()` correctly withholds STREAM from a seat.

**The support model held everywhere except the two holes reported.** act-as refuses an account with no grant, refuses one mid-night with a 409, and a non-owner setting `mmm_acting` gets nothing. Closing support ends the session on the very next request. `SUPPORT_NEVER` held on every path including the hand-set cookie. A grant cannot extend itself. `safe()` strips hash, salt, scrypt, calendarKey and reset from `/api/me` and `/api/library`.

**The public surface held.** The gallery and league preview rules refused every angle — another quizmaster, the owner, the host key — and `?as=visitor` genuinely subtracts on the server for both. Unpublishing reaches the very next request with the bytes still in the LRU. Every filter twin agreed immediately across six readers. Name filtering masked correctly on both the public page and inside the PDF, including the podium and the winner, with positions untouched. No faces, codes or credentials in any public payload. Calendar auth refuses an empty, blank, wrong or absent key with a 404 rather than a 401. Every `putFile` goes to the right repo, and it fails closed when one is unconfigured.

**Lobby games: the fairness machinery is right.** The tier gate held at every tier and every junk value. Scores are refused at rules, round intro, question and reveal — the only way one reached a question was through the leaked loop, and even then the server refused it. The seed is genuinely shared across rejoins and late joiners. Rally's accumulator, Quick Draw's and Pile Up's schedules all behave as documented, and Pile Up's touch handling is clean on a real iPhone emulation. `stopArcade()` is called from `buildScreen` on every rebuild, including the bingo path.

**The stylesheet's structure and the brand rules held.** Braces balance, no nested `@media`, the phone-only slot rule is correctly scoped. All ten seasonal looks were sampled with `elementFromPoint` over 200 points of the middle of the projector at three sizes: zero motif hits — the rule is honoured. All twelve schemes pass WCAG AA on the filled-gradient buttons (worst case 4.81:1). The phone is clean at 320–430 in every phase, as are `/signup`, `/gallery`, `/league` and `/reset` from 320 to 1900. `pages-scroll.mjs` and `community-bay.mjs` both pass.

**Some guards are genuinely good and worth copying.** `console-frame.mjs` launches a quiz, joins two phones, hit-tests with `elementFromPoint` at six real thresholds, plants its own banner rather than hoping for one, and exits cleanly — and its frame numbers match `community-bay.mjs` and `style.css` exactly. `drag-check.mjs` drives the real mouse, presses the gap dial twice, and has the `finally { stop(); }` the four hanging scripts lack. `browser-parses.test.js` refuses to pass on fewer than 20 files, which is the anti-vacuous-pass assertion the rest of the repo needs. `markup-balance.test.js`'s launch-bar slice was measured and does cover the whole template.

**And one thing measured that looked like a finding and was not:** the bay rail's Post-gig rows appear painted over by the tab bar, and are not — the rail is `overflow-y: auto` and scrolling brings them to the top of `elementFromPoint`. It clips nothing.

---

# PART B — what the sixteen lenses did NOT look at

A completeness critic was asked one question: what fell between the lenses.

Read the repo, ran nothing destructive, tree is clean (`git status --porcelain` empty).

# WHAT THE SIXTEEN LENSES DID NOT LOOK AT

The sixteen names describe **the path from a room sitting down to a quiz running, plus the console that starts it**. Everything that happens *before* Monday's pack is written, *after* the room goes home, or *underneath* the process is outside all sixteen. Specifics below; claims marked (verified) I reproduced.

---

## 1. The backup layer — `src/github.js` and ~90 `backUp*()` call sites

No lens. `putFile()` **never throws — it returns `{ok:false, error}`** (github.js:241-310), and `backUpAccounts()` catches and returns the same shape (server.js:3584). **16 of the 19 `await backUpAccounts()` call sites discard the result** (verified: 3242, 4890, 4968, 4989, 5003, 5030, 5160, 5338, 5369, 5423, 5442, 5468, 5480, 6235, 6255, 6285 — only 6321/6368/6381 read it). `grep -rn "lastBackup\|backedUpAt\|backupHealth"` across `server.js`, `src/`, `public/assets/` returns **nothing** (verified) — no page anywhere says when the last successful push was. github.js has a careful 409 branch and **no 429 / secondary-rate-limit branch at all** (verified).

**Cost:** on Render's free tier `data/` is wiped on every deploy, so the backup *is* the data. A rotated token, a full repo or a secondary rate limit makes every write fail silently for a week; the loss surfaces at the next deploy, and it is accounts, sessions, the invoice book, the archive, own-packs and the league. This is the one failure in the repo that is total, irreversible, and invisible until it has already happened — and it is the exact shape CLAUDE.md refuses encryption over ("losing the key makes the invoice book landfill").

## 2. CPU on the one thread that also runs the quiz

No lens owns "what blocks the event loop"; `routes-auth` asks whether a gate is *correct*, never what the gate *costs*.

`/api/sign-in` (server.js:4853) has **no throttle** (verified — no rate limiter at the top of `handleWrite`, and `joins.js` guards the join path only). It calls `accounts.signIn()`, which runs `crypto.scryptSync` at `N=16384` — **measured 44ms per call on this box** — and **burns a hash even for an unknown email** (accounts.js:762-766), deliberately, to equalise timing. Node is single-threaded. ~23 req/s saturates it.

**Cost:** the join URL is on the projector and read out on the mic. Anyone in the room can hold the loop down: the projector's SSE stalls, phone answers stop landing, Next/Reveal hang. A protected-surface outage, no credentials, from a URL the host reads aloud. Same class, unexamined: synchronous `report-pdf`/`invoice-pdf` generation and `sniffType` on a 12MP upload, all on the quiz's thread.

## 3. Scale — nothing has ever run against a season's data

Every guard builds its own empty `DATA_DIR` (visual-qa.mjs says so in its header); the largest fixture in the suite is 60 players in one room (`test/bingo.test.js:99`). The repo currently holds **12 quiz packs, 144K** (verified).

`/api/library` — protected-surface item 1, "the console loads, the pack cards draw" — walks the archive repeatedly: `rewardsUsed()` (library.js:462), `rewardsByVenue()` (495) and `venuesUsed()` (506) **each call `listArchive(dir)` independently**, and `listArchive` is `readdirSync` + read + `JSON.parse` of *every night file*, synchronously (library.js:347-350), plus headcounts and heard on the same payload. CLAUDE.md claims it "reads the archive ONCE"; it does not (verified).

**Cost:** free today at 12 nights. At 200 nights it is ~1,000 synchronous file reads per console render, on the thread running the quiz. The console gets slower every week of a season and nobody finds out until a Thursday.

## 4. Photo capture and drawing on the phone

`public/assets/stickers.js` (66KB — the third-largest browser file), `filters.js`, `avatar.js`, and the camera sheet in `play.js`. `phones-projector` is a payload lens; none of this is payload.

Specific hazard: play.js:714-722 calls `createImageBitmap(file)` with **no `imageOrientation` option**, while the `theSlowWay` fallback (play.js:699) uses an `<img>` element, which browsers *do* orient from EXIF. `grep -rn "imageOrientation" public/assets/ src/` returns **nothing anywhere in the repo** (verified). The two paths can therefore disagree about rotation on the same handset.

**Cost:** a portrait photo lands 90° sideways on the projector in front of the room, on some phones only, with nothing in any test or guard that could see it.

## 5. Device geometries nobody measures

Verified viewports: `console-frame.mjs` 1280x800 / 1280x640 / 390x844; `visual-qa.mjs` 390 / 820 / 1440; `pages-scroll.mjs` 1280x900 / 390x844; `shots.mjs` 1920x1080 and 390/430. So:

- **320px is measured nowhere.** `style.css`'s smallest split is `@media (max-width: 430px)` / `(min-width: 431px)` — an iPhone SE or a cheap Android falls in one unchecked bucket. Sixty strangers' handsets are the least controlled hardware in the building.
- **4:3 is measured for exactly one slide.** `final-fits.mjs` does 1024x768; nothing else does. A ceiling-mounted pub projector is very often 4:3 and the whole projector is sized in `vh`. The **question slide**, the round board and the bingo call sheet at 1024x768 are unexamined — the thing on screen for twenty seconds, sixty times a night, on a page that by rule cannot scroll.
- No tablet-as-control-view, no landscape phone.

## 6. The money subsystem

`src/invoices.js` (34KB), `invoice-pdf.js`, `pdf.js`, `billing.js`, `offers.js`, `spend.js`, `public/assets/console-invoices.js` (30KB), and `owner.js`'s `moneyTab`/`budgetPanel`. No lens. `totals()` (invoices.js:177) does the VAT/deposit arithmetic; `toPence()` (135) parses freehand money; `escapeText()` (pdf.js:176) maps anything outside Latin-1 to `?` — a venue with `ł` or an emoji in its name prints as `?`. `describeEvent`/`dueDate`/`longDate` are date maths nobody swept.

**Cost:** a wrong figure goes to a landlord under the quizmaster's name, or a PDF Outlook will not open with no error to tell them. Rule 4 says the sell half is what somebody is actually buying, and this is it.

## 7. The generation pipeline

`src/generate-quiz.js` (**57KB — the largest src file after engine/session/bingo**), `generate-bingo.js`, `generate-images.js`, `portraits.js`, `research.js`, `question-history.js`, `history.js`, `import-bingo.js`, `recue.js`, `console-generate.js`. Owner-only, so no identity or room lens reaches it.

**Cost:** the only path that spends real money per call, and `spend.js` is the ledger the entire tier structure is priced off — a double-count or a miss is invisible until the month's Money tab is wrong. `roundPlan()` is also the documented place a round type silently vanishes (CLAUDE.md records `['text','image','intro']` swallowing `multi`); nothing re-checks it for `breakout` and `alphabet`.

## 8. The pack editor

`public/assets/editor.js`, `pack-editor.js`, `console-editor-popover.js`, and the save/validate half of `src/quizzes.js`. `launch-bar` covers Tonight, `console-doors` covers navigation; nobody looked at the screen where a pack is **written**.

**Cost:** rule 11 means there is exactly one file per pack and every console reads it — a bad save corrupts the copy for everybody, mid-season. `saveOwn()`'s catalogue-shadow refusal is named in CLAUDE.md as "the only thing standing between this rule and a fork nobody knows exists", and no lens re-verified it.

## 9. The diary, ICS and the calendar key

`src/ics.js`, `public/assets/diary.js`, `console-diary.js` (27KB). Two different day-boundary implementations exist: `src/past-gigs.js:61` shifts by 6h and reads a **UTC** day; `public/assets/diary.js:80` shifts by 6h and reads **local** parts (verified). They agree for pub hours under BST and diverge at the edges. `ics.js:129` writes floating times deliberately, and `ics.js:148` builds an end date with `new Date(y, mo-1, d, h+2, m)` across DST.

**Cost:** a night filed on the wrong date is a headcount on the wrong pub's trend and an invoice for a night that "didn't happen". Also: `calendarKey` is a bearer credential in a URL fetched with no cookie; `safe()` strips it today, but nothing checks that the *next* field added cannot ride out the same way.

## 10. Chat — the only place a stranger's text reaches other players

`src/chat.js` and `public/assets/chat.js` reach the app through `engine.js:29` and `play.js:22`, **not through any named route** (`grep -c chat server.js` → **0**, verified), so a routes lens cannot see it. `mayPost()`, `cleanMessage()`, `MAX_LENGTH` and `visibleTo()` are the entire moderation and privacy surface, under a standing decision of *no profanity filter in the room*. Online mode only, which is why it is easy to miss.

**Cost:** a slur on sixty phones under the quizmaster's brand, or one team's room leaking to another.

## 11. Concurrency between rooms and between the host's own devices

Per-room `Store` is right (rooms.js:127), but `github.js` keeps a module-level `lastSha` Map shared by every room, and nothing tests two rooms writing at once. Nor two control views on one night: the host's phone and the laptop both open, and `/api/host/next` (server.js:6428) has **no idempotency key**.

**Cost:** a double-press across two devices skips a question the room never sees, mid-round, with no error.

## 12. Public pages that are not the gallery or the league

`public/voucher.html` + `voucher.js`, `home.html`, `signup.html` / `login.html` / `reset.html`, `terms/privacy/refunds.html`. The voucher page is the one a **third party** uses — a barman, once, under time pressure, on their own phone.

**Cost:** a winner who cannot get their drink at the exact moment the night is meant to land well.

## 13. The owner page as a page

`public/assets/owner.js` (69KB): `peopleTab`, `personPanel`, `subscriberRow`, `moneyTab`, `budgetPanel`, `catalogueTab`, `suggestPassword`. `routes-auth` covers whether `/api/owner/*` is gated; nothing looked at the screen that can change every other account's tier, status and password. There is one owner, so there is no second pair of eyes.

## 14. Accessibility and forced colours

`grep -c "forced-colors\|prefers-contrast" public/assets/style.css` → **0** (verified). Reduced-motion is handled well (11 blocks). Nothing examines contrast ratios, focus order, or what Windows High Contrast does to a projector page whose meaning is carried by colour — the `--a`…`--f` option letters, the green/red gallery lamp, the B/S/G metals.

## 15. The Monday-load reducers

`src/suggestions.js` (17KB), `reply-draft.js`, `reports.js`, `room-asks.js`, `round-ideas.js`. Not an outage class — a queue that stops shrinking, which CLAUDE.md names as the one cost this business cannot absorb.

## 16. Smaller unswept items, named so they are not lost

`src/sse.js` (**zero test files import it** — verified; no backpressure handling, `res.write` return value ignored, so a stalled projector socket buffers unboundedly), `src/joins.js`, `src/teams.js`, `src/clean-names.js`, `src/photo-cache.js` (the 48MB LRU on a 512MB box), `src/comeback.js`, `src/spotify.js`, `public/assets/looks.js` (seasonal painting that runs *on the projector* during a live night), `console-account.js` (71KB), `console-gigs.js` (57KB), `console-venues.js` (46KB), `render.yaml` and `DEPLOY.md`.

---

## What held, worth saying

Vouchers, QR encoding, the PDF writer's WinAnsi escaping, scrypt/session/reset-token handling, cookie flags (`HttpOnly`/`SameSite=Lax`/conditional `Secure`), the `readJson` non-object hardening, per-room `Store`, and the `[skip render]` commit trailer are all carefully built and, where tested, tested at the right level. `/api/host/*` is deliberately **not** feature-gated (server.js:6428), so a subscription lapsing mid-night cannot stop a running quiz — that is correct and I checked it.

---

# THE THREE MOST WORTH A FOLLOW-UP PASS

**1. The backup layer (`src/github.js` + the ~90 `backUp*` call sites).**
Highest consequence, silent by construction, and the only gap where the loss is unrecoverable. 16 of 19 `backUpAccounts()` results are discarded, there is no 429 branch, and no page in the app says when the last successful push was. On a host that wipes `data/` every deploy, "the backup quietly stopped working" and "everything is gone" are the same event separated only by time. This is also the thing the host cannot check himself.

**2. Event-loop cost on the protected path (`/api/sign-in` scrypt; `/api/library`'s repeated `listArchive`).**
The only gap that can take a live night down, reachable with no credentials from a URL on the big screen, and structurally invisible to an auth or route-shape lens — the gating is correct; the *cost* of the gating is the weapon. Pair it with the scale question, since both surface as "the projector froze" rather than as an error.

**3. The photo pipeline and the geometries nobody measures (`stickers.js`/`filters.js`/the camera sheet; 320px; 4:3).**
The missing `imageOrientation` is a concrete, repo-wide-verified hole, and 320px and a 4:3 question slide are measured by no script that exists. This is where the app's visible quality lives, it is the half CLAUDE.md insists must always be screenshotted, and it is the one gap whose defects are seen by sixty paying customers rather than by the host.

Runner-up, and close: **the money subsystem** (§6) — the pillar rule 4 says people are actually buying, and the only unswept code that puts a number in front of a landlord.

---

# PART C — the four sweeps of 5–6 September 2026

Written up from the sweeps' own reports. The sixteen lenses in Part A were
handed this list and told to push past it, so **these are mostly NOT repeated
above** — read both parts.

Marked **[mine]** where the fault was introduced or half-fixed by the batch of
fixes made on the night of 5 September. That distinction matters: it is the
evidence for the working note at the foot of this file.

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

---

# A working note, and the reason this file exists

The four sweeps found about forty faults. Fixing them in one fast sitting on
5 September closed roughly twenty and introduced or half-closed **ten**, in
three recognisable shapes:

1. **Fixed the symptom, not the neighbour** — `archivedAs`, `winners`,
   `sameVenue`.
2. **Fixed one path and missed the parallel one** — `safe()` against the acting
   hat, `codeFor()` against `summaries()`.
3. **Believed the diff instead of the screen** — a lost tuck-list edit, a label
   clobbered at runtime, and a completely dead Save button that passed 1,684
   unit tests and five browser guards.

The third is the one that matters, because it means the verification was
theatre. `scripts/save-a-night.mjs` is the first guard in this repo written the
other way round: it was watched failing on the fault before it was trusted
passing on the fix — and in the course of that it produced **two false passes of
its own** (talking to a stale server on a busy port, and reading a POST-only
route), both of which are now refused rather than papered over.

**The rule this file would like the next session to take from it:** fix one
thing, prove it with a check that fails first, push it alone. Twenty fixes in a
night is how ten of these got here.
