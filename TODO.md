# Your to-do list

Work down the numbered list below in order. Every step says how long it takes,
what it costs, and what happens if you skip it, with the link you need next to
it. The detailed walkthroughs are further down as **Parts** — you only need them
if a step does not go smoothly.

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

**Second of the three.** Selling Quizporium to quizmasters: what the words
mean, what a night is, and the page somebody reads before they pay. No
subscribers, no business — but it comes after Mark has nights to point at,
because a founder who is not running quizzes has nothing to show.

(The third list is **MARKETING MARK, THE JOBBING QUIZMASTER**, below.)

Raised on 11 August 2026 and parked deliberately, because it is a thinking job
rather than a build and it was midnight. It is also the highest-value item on
this list, because everything downstream of it — the pricing page, what an
advertiser is sold, what a subscriber thinks they are buying — is decided by
the words.

### 1. The words are settled INSIDE the app and nowhere else

CLAUDE.md already pins **pack**, **quiz**, **bingo game** and **round**, and
those hold up in the code. What has no name at all is the thing being sold to
a venue: **a night.**

The app has no object called a night. It has games, and it has an archive
entry per evening, and Past gigs merges them with a 6am roll-over — but
nothing in the data model says "this was the Thursday at The Crown". So:

- **An advertiser is buying a NIGHT, not a quiz.** "Your slide, every
  Thursday at The Crown, in front of 60 people" is the sentence that sells.
  The app cannot currently say any part of it.
- **A quizmaster wants to name and edit a night afterwards** — which venue,
  how many were in, how it went. Asked for explicitly. The invoice book
  already holds customers with addresses, so the venue list EXISTS; a night
  should pick from it rather than inventing a second list of venues.
- That one change turns Past gigs from a list of dates into the thing a
  quizmaster shows a venue they are pitching to, which is what it was built
  for in the first place.

**Do the data model before the marketing.** A night with a venue on it is
what makes the advertising pitch true; writing the pitch first means writing
a promise the app cannot keep.

### 2. Advertising is a Silver/Gold economic argument, and it is under-sold

The advert slides sit at Silver on the reasoning that they win the QUIZMASTER
a booking rather than being part of the show. That still holds — but the
commercial size of it has never been worked out, and the host thinks it is
significant. Worth answering properly:

- What does a venue pay for a slide, and who bills it — the quizmaster or the
  owner? Today the quizmaster does, and the app is not in that transaction at
  all.
- Does the owner ever take a cut? The QR-to-ticket-sales idea in CLAUDE.md
  says yes for some slides, which is a different arrangement from a venue
  promoting its own pizza.
- Is "reach" sellable? Nights × players is a number the app already has.

### 3. A website that sells this AS A QUIZMASTER SOLUTION

There is none. There is an app and a login, and the only way in is somebody
being handed an account by hand. What a prospective subscriber needs to see
before they will pay:

- **What a night looks like** — projector, phones, the reveal. Screenshots or
  a thirty-second video, not prose.
- **What they get for the money**, in the ladder's own words: Bronze buys
  packs, Silver includes them, Gold is a fresh topical quiz every week.
- **Proof it is run by somebody who does this for a living**, which is the
  differentiator against a generic quiz app. Past gigs is that proof.
- **The honest limits**, because a quizmaster who buys and then finds out is
  a refund and a bad review: they cannot generate their own packs, and the
  starter set is eight.

Note what this implies and is NOT built: a signup flow, a payment processor
and a public marketing page. See "Pay-per-pack is deliberately NOT built" in
CLAUDE.md — the data model is ready, the money is not.

### 4. An FAQ, so the app can stay short

Every blurb in the app is now one line — "Invoicing: bill a venue before you
leave the car park" — because fourteen of them at two sentences each is a wall
nobody reads, and a ladder nobody reads is a ladder that sells nothing.

That only works if the detail lives somewhere. It does not yet. An FAQ is
where "what happens to my packs if I cancel", "can you read my quizzes",
"what does a pack cost and why" and "what is a night" get answered properly —
and it is the same content the sales site needs, so write it once.

Note what it is NOT: a manual. The app should not need one. It is the page
somebody reads before they pay, and the page they are pointed at when a
one-line blurb was not enough.

### 5. Four things raised on the console, none of them built

Parked together because each is a design decision rather than a tweak, and
three of the four are really about what a NIGHT is — which is item 1 above.

- **A "Launch" tab.** Everything needed to run a night in one place: pick the
  pack, the look, the card shape, the prizes, the big screen, the control
  view. Today those are spread across a pack card, a running panel and the
  links panel. Worth doing — the case against is that a tab you use once an
  evening sits in the bar all week, and the running panel already appears at
  the top of every tab when something is live. Decide after a few real nights.

- **Past gigs: what should a night actually record?** Today it is the date,
  the packs played and the photos. Obvious additions, in order of value to a
  quizmaster pitching for work: the VENUE, how many played, who won, and what
  it was invoiced for. All of it exists somewhere in the app already — the
  player count is in the archive, the invoice is in the invoice book — so
  this is mostly a joining-up job once a night is a real object.

- **Invoicing, two directions.** Today it is quizmaster → venue. The other
  shape is a pub or a quiz company that has hired a quizmaster per gig, where
  the sub-account invoices the main account. That is an AGENCY model and it
  needs a relationship between accounts that does not exist — it is the same
  object as the company folder sketched under Group accounts. Do not build the
  invoicing half before the accounts half.

- **"Got in my way" as a suggestion kind.** Questioned, and worth keeping:
  friction is the most useful feedback there is and the least likely to be
  sent, because nobody files a bug about something that merely annoyed them.
  Naming it as a category is what gives somebody permission. Revisit if it
  turns out nobody ever picks it.

### 5d. Two band shirts went in — the pattern for adding more

**Added 14 August 2026**: `shirt-1d` and `shirt-bmth` in `stickers.js`. Worth
recording as a recipe, because more will be asked for and each one is about
ten minutes:

1. One `ART` entry, 100x100, with the die-cut white border every other prop
   has (`fill="#fff" stroke="#fff" stroke-width="11"`), then the colour, then
   the dark outline.
2. **Letters as PATHS, never `<text>`.** A prop renders from a data: URL into
   an `<img>`, which picks up whatever the handset calls "sans-serif" — so
   spacing and weight would differ on every phone in the room, and this ends
   up six feet wide on a projector.
3. Keep everything inside the shirt body, which is **x 30–70, y 46–86**. Both
   of these were drawn once with the `D` and the `H` hanging off the side, and
   the only thing that showed it was rendering them.
4. **No `♥` in the label** — U+2665 takes emoji presentation on some handsets,
   and the no-emoji test catches it. "1D shirt" says what it is.
5. Render at **66, 120 and 240** on a light AND a dark ground before believing
   it: a prop lands on a photograph of unknown brightness, and 66 is the tile.

The obvious next ones, if a room asks: a plain band tee with no name on it, a
football shirt, and a hi-vis. Each is another tile in a tray somebody has to
scan, so add them when a night needs one rather than for the sake of it.

### 0b. A VENUE IS ONE OBJECT — the tab is built; adverts are the piece left

**Built on 14 August 2026.** A **Venues** tab on the console, editing the
INVOICE BOOK's own customer record rather than a store of its own — that book's
comment already calls them "the venues you work for" and it holds the name, the
contact, the address and the usual fee. A separate venue list would have had to
be reconciled with it forever, and there were already three notions of a venue
before this one.

What it does: name and three prizes per venue, and picking that venue at launch
fills the prizes in. `setRewards()` is its own narrow method — `saveCustomer`
writes the whole record every time, so a call carrying only a name and prizes
would silently blank the address and the fee on the record every invoice is
drafted from. Same reasoning as `setPrefs()` being separate from
`accounts.update()`.

**Order of preference when filling a launch**: the venue RECORD first, the
archive second. What somebody typed on the Venues tab is a stated arrangement;
what the archive holds is merely what happened last time, so the stated one
wins when they disagree.

**STILL TO DO — the advert set.** Slides are still a folder per venue name,
unaware of the record. That is the third notion of a venue and the one left:
moving it means moving files on disk, which is a bigger job than a field. Once
it is done, picking a venue at launch brings its prizes AND its slides.

**A duplicate-id fault worth fixing while nearby.** Every pack card renders its
own `<datalist id="venuesUsed">` and `<datalist id="rewardsUsed">`, so a
console with seven packs has seven of each. Duplicate ids are invalid and every
input binds to the FIRST one — which works today only because all seven hold
identical content. Render each list ONCE per page instead.

### 0c. The venue notions that are NOT unified yet

**Asked for on 14 August 2026** as "a venues tab where you add the prizes, and
the launch loads them". The idea is right. What makes it worth more than a tab
is what turned up while checking where to put it: **the app already holds three
separate notions of a venue**, none of which is aware of the others.

| Where | What it holds | Called |
|---|---|---|
| The invoice book | name, contact, address, email, usual fee | `customers` — the code's own comment says *"the venues you work for"* |
| `adverts/` | a slide set per venue, reused every week | an advert set |
| A night | a plain NAME, typed at launch | `state.venue` |

**A venues tab holding only prizes would be a FOURTH.** That is the duplication
this file warns about everywhere else — two lists of one real-world thing
disagree within a month, and here it would be four.

**The job is one venue record that the others hang off.** Then picking The
Station Tap at launch brings its prizes, its advert slides and its invoice
details in one go, and the invoice after the night fills itself in. Four
things collapse into one object rather than one more being added.

Order to do it in, and the first step is the only one that is awkward:

1. **Decide the invoice customer IS the venue.** It already has the richest
   record and it is already backed up per room. A separate venue store would
   have to be reconciled with it forever.
2. **A night keeps its plain NAME as well as a link.** `state.venue` is free
   text on purpose — almost no venue is an account and the common case has to
   stay cheap — so a link is an addition, never a replacement, and a night at a
   venue that was later deleted must still say where it was.
3. **Prizes and the advert set move onto that record**, which is what was
   actually asked for.
4. **Then the launch form reads them**, which is the part already half-built:
   `rewardsByVenue()` does it today off the archive, and would simply read the
   record instead.

Until then the archive-based version is live and does the same job with no new
tab: pick a venue, and what it put up last time fills in.

### 4b. "Add a past gig" — filing a night the app did not record

**Asked for on 14 August 2026** and parked the same day, because it turned out
to be a data-model decision rather than a form. The archive is only ever
written by the engine when a game ends; `/api/archive` and `/api/past-gigs` are
read-only, so there is no way to file a night run on paper, run before the app
existed, or lost to a crash.

**THE NIGHT WAITING TO BE FILED, in the host's own words** — do not re-ask him
for this:

> The Station Tap, Wokingham · Wednesday 6 August 2026 · 21:00–01:00 ·
> around 20 players · 3 rounds, two won by **Caitlyn** and one by an account
> named **Chica** · the One Direction Quiz pack, which may since have been
> deleted.

Two things have to be settled before a form is worth drawing, and both are
about not writing down something untrue:

- **THREE ROUND-WINNERS IS NOT ONE NIGHT'S RECORD.** A record holds one game
  with one final leaderboard. Two wins for Caitlyn and one for Chica is either
  three archived games or one night whose per-round winners the model has
  nowhere to keep. Worth knowing which the host actually ran before choosing —
  and worth noticing that per-round winners may be how he runs a night, in
  which case the archive is missing something real rather than needing a
  workaround.
- **"AROUND 20" CANNOT BE STORED HONESTLY TODAY.** `listArchive()` derives the
  headcount from `leaderboard.length`, so writing 20 means inventing eighteen
  team names — on the one page whose whole job is being evidence shown to a
  venue. A hand-filed night needs an explicit `playerCount` on the record and
  `listArchive` taught to prefer it when it is there. That is the actual work.

A deleted pack is NOT a problem: a record keeps the title it was played under,
not a live reference, which is the same reason a report carries a copy of the
question rather than a pointer to it.

**Mark it as hand-filed** (`enteredByHand: true`) and say so on the row. A
record somebody typed from memory and one the engine wrote are different kinds
of evidence, and quietly mixing them is how a page stops being trustworthy.
It also keeps hand-filed nights out of anything that draws conclusions — the
play counts and "never played by anybody" should ignore them.

### 1e. The demo prize card, personalised to the venue you are pitching to

**Raised on 14 August 2026, parked deliberately.** `/v?c=DEMO` currently says
"Give them A free drink at the bar" to "Quizteam Aguilera" — generic, which is
right for a demo and means it is not obviously about the pub you are sitting
in. Landing on their own name would sell it harder.

Cheap to do: the demo is built from a literal in `voucher.js` and never touches
the server, so it is a matter of reading a name off the URL —
`/v?c=DEMO&at=The%20Crown` — and putting it in the card. The QR panel on My
account would offer a venue picker beside it, filled from the Venues tab.

**Two things to get right, or it stops being a demo:**

- **It must still take no server state.** The whole value is that it works with
  no game running, on bad wifi, an unlimited number of times. A personalised
  one that needed a lookup would be a worse version of the real thing.
- **It must not read as a real voucher.** Somebody's bar staff seeing their own
  pub's name on a card saying "Give them a free drink" could act on it. The
  demo already differs (the code is literally `DEMO`), but with a venue name on
  it that is thinner cover — it probably wants a visible "demonstration" mark
  on the card once it is personalised.

### 1d. WHERE REDEMPTIONS ARE VISIBLE — and the snapshot that misses them

**A SEPARATE FAULT ON THE SAME FEATURE WAS FIXED ON 16 AUGUST 2026, after a
real gig.** The winners of the 13 August night said no QR code had arrived —
and nothing was broken: the night had no prizes, because prizes are read off
the VENUE'S record at launch and none was picked. The app said so once, quietly,
on Tonight, and nowhere at all after that. Now it is a gold line on Tonight, a
panel on the control view all night, and **prizes can be set mid-night, minting
the codes at the final where the host is standing.** See CLAUDE.md and
`docs/gigs.md`.

**THIS ENTRY IS STILL OPEN.** It is about the RECORD afterwards — showing on
Past gigs which prizes were actually taken — not about the codes going out.
`GET /api/archive/<id>` is the only source of a filed night's vouchers with
`redeemedAt`, and nothing in any browser calls it.


**THE BUG HALF IS FIXED (14 August 2026)** — a voucher moving after the
night is filed now updates the filed record, and the backup with it. Building
it found and fixed a duplicate night after a restart on the final scores.
**What is left is a DECISION: showing it on Past gigs**, which is the
venue-facing half — see below.

**Asked for on 14 August 2026, for two reasons the host gave and both are
right:** evidence if somebody is being cheeky, and evidence that the night is
popular and people win things. The second is the one that earns money — *"we
gave out eighteen drinks across six nights"* is the sentence a venue responds
to, and it is the only mechanism in this app that could ever say it.

**Today it is live-only.** The **The prizes** panel on the control view updates
the instant the bar presses Given — the row goes from "Not used yet" to "Used
at 22:47", the card goes quiet, the button flips to Put it back. Pushed over
the same connection that drives the quiz, so nothing needs refreshing. But it
is a panel that CHANGES, not a notification: you notice if you look.

**THE ACTUAL BUG: the archive snapshots too early.** `results()` carries
`vouchers` with their whole history, so the record is being kept — but
`session.js` files the night the moment it reaches `FINAL`, and the drinks are
redeemed at the bar several minutes later. So every archived night says
`redeemedAt: null` for all of them, for ever. The live panel is right and the
permanent record is wrong, which is the worst way round.

The fix is to update the filed night when a voucher moves after the night has
been archived. Note `archivedThisGame` deliberately guards against filing
twice, so this is an UPDATE to an existing record rather than a second archive
— and it has to survive the room being reloaded from disk, because the bar may
scan after a restart.

**Then show it in two places, and they answer different questions:**

- **Past gigs, per night** — "3 prizes, 3 taken" against the date and the
  venue. This is the venue-facing evidence and belongs next to the headcount
  and the photos.
- **The control view, during the night** — already there. Add nothing; a host
  running a quiz does not want an alert every time somebody gets a drink.

**For "somebody being cheeky", the reinstate count is the signal**, not the
redemption. A voucher redeemed once is the system working; one put back three
times is either a bar that cannot reach us or somebody working it. That count
already exists and already shows above zero — it just needs to reach the
archive with everything else.

### 1g. Making the pictures stopped at 7 of 10 and had to be pressed again — ✅ FIXED

**Done on 14 August 2026.** It was the commit per picture, as suspected:
`putFile` is TWO sequential round trips, so ten portraits was twenty GitHub
calls threaded in between ten Google ones. `putFiles()` in `src/github.js`
sends the blobs in parallel and lands ONE commit, and the files are collected
during the draw rather than pushed inside it.

**Seen on 14 August 2026, on the first real run against Google.** Ten portraits
asked for, seven drawn, then it stopped. Pressing again finished the other
three and cost nothing for the seven — which is the shared portrait library
working exactly as intended, and the only reason this was an annoyance rather
than money.

**Not the keep-alive.** `progressStream` pings on a plain interval, so it talks
through image calls as well as Claude ones. Ruled out by reading it.

**Two candidates, in order of suspicion:**

- **The GitHub commit per picture.** `onFile` pushes each image as it is drawn,
  sequentially — so ten pictures is ten Google calls AND ten commits to the
  repo. That is the slowest job in the app by a distance and the most likely
  thing to be cut. If so the fix is to collect the files and push them in ONE
  commit at the end, which is what the generators already do for the ledger:
  "a quiz is twenty-odd calls and that would be twenty commits for one press of
  one button" is already written down about `onSpend`, and this is the same
  mistake in a different place.
- **Google refusing or rate-limiting.** That would be reported per question and
  the loop would carry on, so it does not fit "stopped at seven" — unless the
  refusal was of a kind that throws rather than returning a reason.

**How to tell them apart:** the console log. A per-question failure names the
question; a cut stream ends mid-sentence and the console says "the connection
dropped before it finished". Ask for the screenshot next time rather than
guessing.

**Worth fixing before item 1f**, because making the pictures automatic means
this failure would silently truncate a round rather than being obvious.

### 1f. Draw the pictures as part of writing the quiz — ✅ BUILT

**Shipped earlier on 14 August 2026** — the pack is saved before a single
picture is attempted, exactly as specced below. Left here because the
reasoning is what stops it being unpicked.

**Asked for on 14 August 2026.** Today `Write it` produces the pack and the
portraits are a second, separate press on the pack card. For a picture round
that is two jobs where the host wants one — and the read-through is useless
until the second one has been done, so it is a step you cannot skip anyway.

**Why it is separate today, and which half of that reasoning still holds.** It
was split because drawing costs money per picture and the console prices the
press before you make it ("6 already in the library, free · 4 to draw — about
16p"). That estimate is worth keeping. What is NOT worth keeping is making it a
second manual act: the same information can be shown before `Write it` — the
round counts are known, so the generator can say "…and about 40p of pictures"
in the same breath as everything else.

**The shape:**

- **A tick box on the generator, default ON** — "and draw the pictures". Still a
  decision, still visible, but not a second trip.
- **THE PACK IS SAVED BEFORE A SINGLE PICTURE IS ATTEMPTED.** This is the whole
  design and it is the same rule the checker already follows: by the time the
  images run, the generation is minutes and real money deep, so a failure there
  must cost the pictures and never the quiz. Save, then draw, then save again
  with the repointed paths.
- **A failure is per-question and never fatal.** `generateImages` already
  reports `failed` with a reason per question and carries on; the log should
  name which ones and the pack keeps its placeholders, which are playable.
- **It streams into the same progress panel.** The write already takes minutes
  and talks as it goes; the pictures are just more of the same job. Watch the
  PING — the stream has to keep talking through the image calls too, or a long
  round of portraits looks exactly like the connection dropping.

**The ledger and the budget need nothing new**: `onSpend` already records each
picture and the ceiling already warns rather than refuses. But this makes it
much easier to spend without noticing, so the estimate before the press matters
more than it did, not less.

**One thing to decide rather than assume:** whether the tick box remembers.
Defaulting ON every time is right for the owner writing picture rounds weekly;
it would be wrong if anybody else ever generated, which today nobody does.

### 1c. THE PHONE'S OWN SCORE GIVES THE ANSWER AWAY BEFORE THE REVEAL — ✅ BUILT

**Done on 14 August 2026**, and it turned out to be TWO fields: the score
and the position. Written up in CLAUDE.md. Building it also found that
`pub-unchanged.mjs` had never recorded a single answer — see below.

**Found by the host on 14 August 2026, mid-test.** Tap the right answer and the
running total at the top of your phone goes from 0 to 360 immediately — so you
know you were right several seconds before the projector says so, and before
anybody who answered later has finished.

**Everything else is already correct, which is what makes this worth writing
down.** `playerView()` withholds `correct`, `points`, `isFirstCorrect` and the
part-marks until `PHASES.REVEAL`, and has a comment saying exactly that. The
leak is one line away in `answer()`:

```
player.score += points;   // engine.js, at ANSWER time
```

…and `view.you.score` reads that total. So the secret is kept in the field
built to keep it and given away by the header beside it.

**Why it matters beyond tidiness:** somebody who answers at three seconds knows
the answer at three seconds. In a pub that is a table telling the next table;
online it is a message in the chat. It also spoils the reveal for the person
themselves, which is most of what the reveal is for.

**The fix is NOT to score at reveal time.** Points are worked out from the
clock at the moment of answering and the first-correct bonus depends on the
order answers land — moving the arithmetic would change the scoring, which is
the one thing that must not move. Instead the ENGINE keeps scoring exactly as
it does and the PLAYER'S VIEW reports the total as it stood before this
question, until the reveal.

Roughly: hold `scoreBefore` on the answer record when it is written, and have
`playerView` report that instead of `player.score` while the phase is
`QUESTION`. The board, the projector and the host view are unaffected — the
host is *supposed* to see it live, and the room cannot see a phone.

**Check the round board and the mini-board too**: `view.leaderboard` is only
sent at `ROUND_BOARD` and `FINAL`, so it is probably clean, but "probably" is
not the standard for the thing that leaks an answer. And `pub-unchanged.mjs`
will flag this as a payload change — it is a legitimate one, and the diff
should be exactly the score field on a phone mid-question.

### 5f. THE INTRO ROUND'S CUE IS HALF-WIRED — and one half is a scoring bug

Two faults in one place, found by the host on 14 August 2026 while asking
whether a wrong track is easy to fix. Both live in `cue` on an intro question,
and they want doing as one job.

#### a. Editing a track does NOT repoint what actually plays

The editor offers **Title, Artist, From and Hint** and writes them straight
onto `q.cue`. It does not touch `cue.spotifyUri`, which is what
`startIntroTrack()` hands to Spotify.

So correcting a wrong track leaves the control view saying the RIGHT thing and
the speakers playing the WRONG one — and you would reasonably believe it was
fixed. **That is worse than not editing it**, and it is only discoverable with
a room listening. A cue added by hand is the same fault from the other end:
`q.cue = { title, artist, from, hint }` has no URI at all, so a question you
wrote yourself silently never autoplays.

The fix: **re-resolve on edit, and SHOW the match.** Change the title or the
artist and the app looks it up and repoints, printing what it matched — a
wrong match then reads as wrong instead of being invisible. Never silent
either way: no match found has to say so, because a cue with no URI is a
question that will not play.

#### b. Dead air at the front of a track is a SCORING bug — **BUILT**

**Done on 14 August 2026** — `public/assets/cue.js`, `position_ms` on the play
call, **Skip the dead air** in the editor, and the generator told to write
exactly `0:00` because only somebody who has listened knows where the audio
starts. Written up properly in CLAUDE.md. The reasoning below is kept because
it is what stops somebody "simplifying" it later; **(a) above is still open.**


The host's own point, and it is the sharper of the two: *"for a music intro
round I would want a more consistent timing as each answer is also timed."*

The clock starts when the question goes up and the track starts at the same
moment. **A track with two seconds of silence or fade-in before the audio
arrives costs everybody two seconds of score on that question, for reasons
that have nothing to do with whether they knew it.** Ten questions, ten
different amounts of dead air, and the round scores inconsistently with
nothing on screen to blame.

**This is exactly the argument this repo already makes about the picture
round's four reveals** — they run on one curve because how fast a picture
becomes guessable IS how many points the question is worth, and a mode with
its own curve makes a round quietly worth more with nobody able to attribute
it. Same fault, different round, and it went unnoticed because the cause is in
the audio rather than in the code.

Two things that look alike and must be told apart:

- **Dead air before the audio starts** — pure noise. Penalises nobody's
  knowledge, and should be trimmed so every track starts at the same point in
  the clock. THIS is the bug.
- **How quickly a track becomes recognisable** — that IS the question's
  difficulty and must stay. A famous four-note opening should be worth
  answering faster than a track that takes a bar to declare itself.

**The fix is small and the field already exists.** `cue.from` is on every intro
cue with a `0:00` placeholder and is currently only a note the host reads.
Wire it to `position_ms` on the `PUT /me/player/play` call, surface it as a
seconds box in the editor, and the audio and the clock start together on all
ten.

**DO NOT "fix" this by giving the intro round a longer clock.**
`questionSeconds` is overridable per round, and 25 seconds would look like it
absorbs the dead air. It does not: scoring is base plus seconds-remaining times
ten, so a longer round is a round worth MORE points. That is the reveal-curve
fault again, introduced deliberately.

**The offsets have to be set by ear, and that is the honest cost.** Spotify's
Audio Analysis gives exactly this (`track.end_of_fade_in`) and is **deprecated
for apps created after November 2024** — this app's is new, so expect a 403.
Confirm against the real app before designing around it, but do not count on
it. Ten quick listens per pack, once, stored in the pack for ever.

### 5a. Launch opens the big screen in a second tab

**Asked for on 14 August 2026, mid-gig-day, and parked for that reason.** The
host presses Launch and then goes and finds the projector tab himself, every
night. Two clicks that are always the same two clicks.

Small, and worth doing. The wrinkle is the one thing that makes it a real job
rather than a line: **a popup blocker only allows `window.open` inside the
click itself**, so opening it after the launch request returns is blocked in
Safari. Opening it synchronously before the request means a projector tab for
a launch that then 409s over a live game — which is the guard working and a
stray tab anyway.

The likely answer is to open the tab in the click and CLOSE it if the launch
comes back refused, but that is a thing to prove in a real browser rather
than reason about. **It is on the protected surface** (console loads, pack
cards draw, Launch works), so it does not go in on a gig day.

### 5b. The console and the editor ON A PHONE, from a quizmaster's side

**Parked deliberately on 14 August 2026.** The host runs from a LAPTOP, so
nothing here is on a gig-night path for him — but a subscriber may well not,
and the console is the page you open ten minutes before a room sits down.

Three faults have already been fixed by measuring `scrollWidth` against
`clientWidth` at 320px, which is the only thing that reveals them: the
control view's menu ending up on the far right, the editor 313px off the
side, and Duplicate/Delete hanging 8px over. Every page is inside 320px now.

What has NOT been done is walking the console as a quizmaster on a phone and
asking whether it is usable rather than merely unbroken. In particular:

- the pack grid at three across on a 390px screen, where Launch is the only
  thing that matters and is the smallest thing on the card;
- the launch bar and the tab bar competing for the top of a sticky page;
- the editor, which is a phone-sized job (fix one question) on a page laid
  out for a desk.

**Do this by wearing the hat on Bronze at 390px**, not by reasoning about it
— the same method that found the other three.

### 6. Email — the one dependency several other things are waiting on

**Raised 12 August 2026 while a password could not be reset.** CLAUDE.md says
do not add an email service without asking; he asked, and the answer is that it
belongs HERE rather than in the app's plumbing, because the reason to buy it is
mostly commercial.

**What it unblocks, and only the first is what prompted it:**

- **Password reset by magic link.** Today the only route is the owner setting a
  new one by hand and telling them — which is a Monday job, on the one thing
  somebody needs at the moment they are locked out.
- **Invoices sent from the app.** They currently go via the phone's share sheet
  because there is nothing to send them with. That works and was the right call
  without email; with it, "bill a venue before you leave the car park" gets
  shorter still.
- **A reply to a suggestion arriving where they will see it.** `reply-draft.js`
  drafts and the console shows the thread, but somebody who has not opened the
  console does not know they have been answered.
- **Trial ending, card failed, receipt.** All of billing's polite half, which is
  currently silent.
- **Anything sent to a VENUE**, which is why it sits in this list — a post-night
  report, a headcount summary, an invoice. Those are the things that win the
  next booking, and none of them can be delivered today.

**What it costs:** a transactional provider (Resend, Postmark, SES) at roughly
£0–15 a month at this volume, plus SPF, DKIM and DMARC records on
`quizporium.co.uk` — the same Namecheap panel the domain was wired up in.
**Send from the app's own domain**: a free tier that sends from the provider's
domain lands in spam, which is worse than no email because it fails silently.

#### TWO PROVIDERS, TWO JOBS — and both accounts already exist

Settled 12 August 2026. **Resend and Kit are not alternatives to each other;
they do different jobs and using either for the other's is the mistake.**

| | Job | Tool |
|---|---|---|
| **Transactional** | password reset, invoice, receipt, trial ending, card failed | **Resend** |
| **Marketing** | sales-site signups, quizmaster newsletter, new-pack announcements | **Kit** |

**The split is not a preference.** Transactional is instant, per-event,
one-to-one, sent to somebody who is not on a list and must NOT carry an
unsubscribe footer — a password reset that waits in a broadcast queue is
useless, and marketing platforms generally do not want that traffic on them at
all. Marketing is the opposite: list-based, scheduled, and legally required to
carry an unsubscribe.

**Both accounts are already held** — Resend, and Kit for another project — so
this costs nothing extra. Kit is free under 10k subscribers, which covers list 2
entirely.

**ONE domain setup serves both.** SPF, DKIM and DMARC go on `quizporium.co.uk`
once, in the Namecheap Advanced DNS panel the domain was wired up in, and both
providers authenticate against it. Do that first — sending from a provider's own
domain lands in spam, and spam failure is SILENT, which is the worst kind.

**Never send transactional through Kit or marketing through Resend.** The first
is slow and may breach their terms; the second builds no list, has no
unsubscribe handling and puts marketing complaints against the reputation of the
domain your password resets depend on.

**About half a day.** The token half is nearly free — `newToken()` already
exists, and a reset token wants the same treatment as a session token: stored
as a hash, single use, short expiry.

**And it does NOT change the "no email service" rule for AUTOMATIC sending.**
`reply-draft.js` drafts and never sends, and that stays true — the reason was
never that there was no transport, it was that a reply going out unread is the
one that goes publicly wrong. Email gives a Send button somewhere to send TO;
it does not earn the right to press it on the owner's behalf.

### Where to start

The words, then the night object, then the page and the FAQ together. In that
order, because each one is the input to the next and doing them the other way
round means writing the page twice.

Email is separate from that chain and can be done whenever a Monday has half a
day in it — but it wants doing before the first venue-facing thing on list 3,
because those all need something to arrive in an inbox.

---
## 3 · MARKETING **FOR QUIZMASTERS** — features that help THEM sell

**Third of the three, and that is not the same as unimportant.** This is what
keeps subscribers once they are here — a problem you have to earn by getting
some.

Design rule 4 says build what helps a quizmaster win the next booking. This is
that list, in the order it should be built, worked out on 12 August 2026.

**The first two items are BUILT** (14 August 2026), both written up in
CLAUDE.md:

- **Headcount per venue** — "The Crown went from 22 to 58", on the venue's own
  card and on the Gigs tab, out of one record. It also settles what the rest of
  this list was blocked on, which was a night that knows which venue it was at.
- **The last slide of the night** — "Back here Thursday 20th" with a QR to the
  venue's page, on the big screen at the final scores. It is DERIVED from the
  venue's usual night and the diary rather than typed at launch, which is the
  one part of the plan below that changed: the Venues tab did not exist when
  that entry was written, and a box typed weekly is a box that is blank by the
  third week.

### 1. An advert QR that COUNTS

Advert slides already take a heading, an image and a QR, and `src/qrcode.js`
encodes anything. What is missing is what the QR points at.

Serve the offer page from this app — *"Show this at the bar: QUIZ40"* — and it
can count how many people opened it. **The count is the feature, not the
discount.** A slide is an act of faith today; with a number the morning after
it is a media buy with a report, which is what gets it sold, renewed and
priced. It is also the first thing that makes Silver's advert slides
demonstrably worth money.

**Food is the obvious use and TICKETS are the better one.** "£5 off your NYE
ticket" against "£2 off a pizza" — a ticket is £25 where a pizza is £8, and
tickets are the case where the quizmaster can reasonably take a cut, which is
the arrangement CLAUDE.md already sketches for a QR to ticket sales.

**How to know whether an open became a sale, without integrating with
anything.** Do not try to track the money — no till, no EPOS, no per-venue
plumbing. Put a tag on the end of the venue's own link (`?ref=quiz`) and their
ordering system counts it. Then:

- **The quizmaster reports OPENS.** Honest, immediate, theirs.
- **The venue reports ORDERS**, from their own analytics.

That is better than tracking it here, because the number arrives from the
person being convinced rather than from the person doing the convincing. Opens
must still never be presented as conversion on their own — the landlord checks
the till and the quizmaster loses the argument.

**One shared code on the screen, not one per person.** Per-person codes are a
voucher system — issuance, uniqueness, fraud, staff training — and the failure
mode is an argument at the bar. With a shared code that argument is the
venue's, not the quizmaster's, though the room will remember it was at the
quiz, so the wording is worth agreeing with the landlord rather than inventing.

**The redemption should be a WORD as well as a scan.** Staff can hear
"QUIZ40". A phone held up in a dark bar at 10pm is a slower transaction than
the discount is worth.

### 2. The post-night report for the venue

The night ends and the landlord gets: how many played, how that compares, how
often their slide was up, and the photos. Two things happen — the quizmaster
looks like a supplier with data rather than somebody with a laptop, and **the
venue posts the photos themselves**, which reaches their regulars rather than
the quizmaster's followers.

**Not an email.** That needs an account and a monthly bill, and this file says
not to add one without asking. It is a PDF through the share sheet, reusing
`src/pdf.js` — the same dependency-free writer the invoices use.

### 3. A public page per quizmaster — and the consent line

A shareable link, no login: nights, numbers, and "book me". The thing that goes
in an Instagram bio or a cold email.

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
- **[`docs/business.md`](docs/business.md)** — parked strategy: the
  marketplace, referrals, group and venue accounts, the directory, PayPal,
  karaoke, and the other directions. Nothing here is scheduled.
- **[`docs/history.md`](docs/history.md)** — what has changed and when.

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

- **Nothing on the projector says WHICH game is on.** The board says "Top
  scores" whichever it is. Fine with one game a night; confusing the moment
  somebody asks what the numbers are for.
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

**Decided on 15 August 2026: Instagram posting is OFF the list.** Two better
reasons than the API pain that was already blocking it — *"I think it would be
better for the app itself to have a gallery section containing previous
nights"*, and the photos should reach the people in them.

**Dropping it costs almost nothing, which is worth knowing before anybody
reconsiders.** Posting was never built: it needed an Instagram Business
account, a linked Facebook Page and Meta app review (see `docs/history.md`).
What exists today is a share sheet, and that can stay.

### Two galleries, not one

- **The quizmaster's**, inside the console, hanging off **Past gigs** — the
  evidence half of Gigs, which is where photos already belong by the rule in
  CLAUDE.md.
- **The room's**, outward-facing, so the people who took the photos can see
  them. The host's own argument and it is the strong one: *"if we're asking
  for their permission to store their photos, they should actually be able to
  see them once they're up."* That is close to a legal expectation as well as
  a fair one — a right of access is not satisfied by "it was on a projector
  for four seconds".

### Print on demand — mugs, t-shirts, from a specific photo

The pitch is real and it is unique: **the props only exist inside this app**,
so a photo taken at one of these nights cannot be recreated anywhere else.
The host wants a cut, which is what decides most of the design below.

### WHAT CANNOT WORK AS ASKED, and what to do instead

**"Stop them downloading it" is not achievable and must not be claimed.** The
photo has to be decoded by the browser to be looked at; a right-click can be
blocked and a screenshot cannot, and on a phone that is two buttons. Any claim
otherwise is the same lie CLAUDE.md already forbids about the invoice book —
*never claim it cannot be read*.

**The version that works is not DRM, it is not publishing the valuable copy.**
A screenshot yields a phone-sized, recompressed image that is useless for
print. So:

- **the DISPLAY copy** — modest resolution, discreet watermark, that is what
  the gallery serves and what a screenshot can ever capture;
- **the PRINT MASTER** — full resolution, unwatermarked, never served to a
  browser at all, and handed straight to the print provider on an order.

Nobody is prevented from keeping a souvenir, and nobody can print a t-shirt
from what they kept. That is the honest shape of it.

### AND 1080 PIXELS WILL NOT PRINT A T-SHIRT — measure this before selling one

`filters.js` uploads a **square 1080 JPEG at quality 0.85**. In print terms:

| At | Usable size |
|---|---|
| 300 dpi (proper) | **3.6 inches** |
| 150 dpi (the usual floor) | **7.2 inches** |

**A mug panel is fine. A t-shirt front wants ten to twelve inches and would be
printed at about 90 dpi — visibly soft, on a thing somebody paid for.** So the
upload has to go up, probably to 1600–2048 square, and that costs bytes on pub
wifi. It is a real tension with the rule that the join path must not stutter,
and it is cheaper to settle now than after somebody has been sold a blurry
shirt. **A print master could be sent as a SECOND upload** so the display path
keeps its current size and the big one goes straight to the private repo.

### THE CONSENT WE HAVE DOES NOT COVER THIS

Today the phone says the photo **"goes on the big screen"**. That is not
permission to put it on a public web page, and it is certainly not permission
to sell merchandise made from it. Three separate things, and the gap matters
more here than usual because a pub quiz has families in it.

- **The gallery should be a PER-NIGHT UNLISTED LINK, not a browsable public
  index** — reached by a QR on the last slide, `noindex`, no directory of
  strangers' faces for anybody to walk. It satisfies "they can see their
  photos" completely and avoids the category change.
- **The wording at upload has to say what actually happens**, including that
  prints can be ordered. It stays one short line — see the house style.

### THE MONDAY PROBLEM, and it is the one that decides whether this is worth it

**Print orders create customer service: wrong size, never arrived, "it came
out blurry", refunds.** That is DAILY-cadence work, and CLAUDE.md is explicit
that anything needing daily attention is a bad fit for a business with one
admin day a week.

**So the provider must be the merchant of record.** They take the order, the
money, the support and the refunds; the app hands over a print master and a
product choice and takes a margin or a referral fee. **The app never becomes a
shop.** If the only available deal makes the host the seller, the honest answer
is that the revenue is probably not worth the Monday.

### What to build, in order — each step useful on its own

1. **The per-night gallery**, unlisted link, display copies only. This is the
   fair thing and it owes nothing to the rest.
2. **The consent wording**, shipped with or before it. Not after.
3. **Past gigs links to it**, which is one line once the gallery exists.
4. **Raise the resolution / add the print master.** Needed before any print
   offer is credible, and pointless before there is one.
5. **Print on demand**, once a provider and a merchant model are chosen.

### Still open

- Which provider, and **who is the merchant of record** — the whole Monday
  question above hangs on it.
- Whether the gallery lives per night only, or a venue ever gets a standing
  page of its own.
- Serving: photos are in a **separate private repo**, so the app proxies them
  (`/photos/<file>`). A public gallery makes the server a media server, on a
  free tier that sleeps. Worth measuring before it is promised to anybody.

### Checking photos for nudity — and where the check belongs

Asked for on 15 August 2026: *"sometimes people just post silly photos, and
some of them show nakedness… we're not a porn site, we're a quiz company."*
Right, and the timing is right too: the risk changes completely the moment
photos stop being four seconds on a projector and become a public page and a
printed t-shirt.

#### IT DOES NOT CONTRADICT "no approve step", because it goes somewhere else

CLAUDE.md says photo uploads **auto-publish**, with a kill switch and a bin and
**no approve step anywhere**. That decision was made about a PROJECTOR, in a
room the host is standing in with a microphone — and on those terms it is still
right. A gallery is not those terms:

| | Projector | Gallery and merchandise |
|---|---|---|
| Who sees it | the room, for 4.5 seconds | anyone with the link, indefinitely |
| The remedy | the host, on the mic, plus the kill switch | there is none once it is out |

**So the check gates the GALLERY, not the room.** The projector path is
untouched — no latency added on a gig night, no approve step, nothing about
tonight changes. Nothing reaches the outward-facing gallery or a print master
until it has been looked at. That honours both rules rather than trading one
for the other.

#### NO MODEL SHIPS TO A PHONE, AND NONE RUNS ON THE SERVER

The obvious build is a browser NSFW classifier and it is out on rules this file
already applies to face detection: *a model is megabytes on a stranger's phone
over pub wifi*, and it breaks **no dependencies**. Server-side is no better —
same dependency problem, on a free tier that sleeps with 512MB.

**A hosted moderation API is the fit**, and it is the shape this codebase
already uses for Claude, OpenAI and Imagen: a plain HTTPS POST, no package.
Google Cloud Vision **SafeSearch** returns adult/racy/violence likelihoods and
costs about **£1.20 per thousand images** — a busy night is fifty photos, so
roughly 6p. **It goes in `src/spend.js` like every other supplier**, or the
Money tab quietly stops being the whole picture.

**A skin-tone pixel heuristic is the tempting no-API answer and it is worse
than nothing** — it fires on close-ups of faces, and its error rate varies with
skin colour, which is a bias this app should not ship.

#### The rules for it

- **FLAG, NEVER DELETE.** A machine silently destroying somebody's photo is
  wrong, and the host has to be able to see what was caught and why.
- **ERR TOWARDS FLAGGING.** The two mistakes are not equal: a false positive
  costs a holiday snap sitting in a review list for a day; a false negative is
  explicit material on a public URL with the quiz's name on it.
- **THE QUEUE ONLY FILLS WHEN SOMETHING IS WRONG**, so it does not break the
  Monday rule — most nights it is empty, and an empty queue costs nothing.
- **A failed check is not a pass.** If the API is down or the key is missing,
  the photo is held rather than published — the gallery is the conservative
  side by design.
- **It protects the gallery and the merchandise, not the room.** Only the kill
  switch does that, and it is already built. Say so plainly rather than letting
  anybody think the projector is now safe.

#### Still open

- **Whether it should also gate the PROJECTOR.** It may be nearly free:
  photos already queue for a break (`PHOTO_PHASES`), so a sub-second check
  could fit inside a wait that happens anyway. Worth measuring — if it fits, a
  nude never reaches the big screen either, which is the thing the mic
  currently has to handle.
- **The provider.** Vision is a different API from the Imagen one already in
  use, so `GOOGLE_API_KEY` may or may not cover it — needs a Cloud project with
  the Vision API enabled. Check before promising it.

#### THE BLOCKER, found before building: THERE MAY BE NO PREVIOUS NIGHTS TO SHOW

Checked on 15 August 2026 before writing a line of the gallery, and it stops
the feature until it is fixed.

**`/photos/<file>` reads the LOCAL DISK** (`server.js:1073`, via
`room.photos.fileFor`). On Render's free tier **the disk is wiped on every
deploy** — this file already says so about the invoice book, and it applies
identically here. So a gallery served through that route shows nothing older
than the last deploy, which on a day like today is a few hours.

**The photos survive in the PRIVATE REPO, and only there.** `photoFolder()`
files them as `photos/<roomId>/<night>/`, and the owner's export tab already
reads them back (`server.js:1899`, `:1934`, `:1964`). **So the gallery must
read from the repo, not from `/photos/`** — the pattern exists and it is
`getFile(..., 'photos')`.

##### AND THE "PHOTO_REPO IS NOT SET" CLAIM WAS WRONG — read this before repeating it

**It IS set on Render.** `docs/history.md` lists it under *"The live app is set
up now — this is what is actually on Render"*, alongside `PHOTO_TOKEN`,
`HOST_KEY` and the rest.

**The mistake was measuring the wrong machine.** `process.env.PHOTO_REPO` was
read inside the development container, which has no relationship to the live
service's environment at all — and that was then used to tell the host the
whole gallery was blocked. It was not.

**And the page that lists it says exactly how not to make this mistake:**
*"READ IT OFF THE APP RATHER THAN OFF THIS PAGE. `GET /api/library` reports
`generation` … If a feature looks unconfigured, check the payload before
believing a document."* Neither the document nor the payload was consulted; a
local environment variable was.

**So the storage is there and the gallery is NOT blocked on it.** What is still
genuinely unproven is the ROUND TRIP — AUDIT.md lists the photo path as the one
shipped feature whose happy path has never been confirmed end to end. That is a
thing to verify, not a blocker to assume:

1. Take one photo on a phone at a real night.
2. Confirm it appears in the private repo under `photos/<room>/<night>/`.
3. Check `GET /api/library` reports `backupConfigured` — the live answer, which
   beats both this list and `history.md`.

##### And then two design consequences that follow from reading the repo

- **The server becomes an image proxy.** Every gallery view is authenticated
  GitHub fetches on a free tier that sleeps. It needs caching and it needs
  measuring before anybody is told to scan a QR at the end of a night.
- **The night id is a plain `YYYY-MM-DD`**, so a link keyed on it is
  guessable and "unlisted" would be a fiction. An opaque token has to be
  stored against the archived night (`updateArchivedNight`) or derived from a
  stable secret — and NOT from `HOST_KEY`, which rotates on deploy and would
  break every gallery link ever handed out.

### THE GALLERY PUBLISHES WHEN THE NIGHT ENDS — and that is what finally forces a NIGHT to exist

Decided on 15 August 2026, and it is a better answer than the unlisted link I
proposed: *"the gallery link doesn't get published until the quizmaster
publishes it, or on a date basis… you've got a quiz that'll take in all the
photos, and then you might do a music bingo after that. Once the quiz and the
music bingo are done, then the night is done, and then the gallery page gets
published."*

**It beats an unlisted link on three counts at once**, which is why it wins:

- **Nothing is ever public while the room is still in it.** The window a
  half-cut photo could embarrass somebody in is closed by construction rather
  than by a rule.
- **It makes the moderation check FREE.** There is now a gap between the last
  game ending and the page appearing, so SafeSearch runs in it — no latency on
  a gig night, no queue anybody waits on, and nothing unchecked is ever
  reachable. The thing I had proposed to bolt on becomes a consequence.
- **It is a deliberate act**, which is what consent for an outward-facing page
  actually needs. Auto-publish is right for a projector and wrong for a
  website, and this is the line between them.

#### AND IT IS THE SAME "NIGHT" THIS FILE HAS BEEN ASKING FOR

Section 2 above already says the app has no object called a **night** — *"an
advertiser is buying a NIGHT, not a quiz… the app cannot currently say any part
of it."* The host has arrived at the identical conclusion from the other end,
and that is the strongest signal there is that it is the right object:

> **A quiz, then the bingo after it, are ONE night. The night ends when the
> last of them does, and that is when the gallery publishes.**

**What partly exists already:** `nightOf()` and `nightOfGig()` group by date
with a 6am roll-over, and `mergeGigs()` already joins archived games to photo
folders per night. So a night is DERIVED today. What is missing is an explicit
END and a published flag.

**And the end is already a real moment** — the host's own point: *"the end of
the quiz is defined anyway because it gives out who is the winner."* `FINAL`
for a quiz, `FINISHED` for bingo.

#### How "done" should be decided — belt and braces, because forgetting is normal

**Publish at the BOOKED END TIME from the calendar, and let the host publish
early with one tap once every game that night has finished.** Neither alone is
enough:

- **Time alone** publishes at 10pm whether or not the bingo overran, and
  whether or not anybody pressed anything. That is the safety net, and it is
  the one that works when the host has packed up and driven home.
- **The last game finishing alone** is wrong on a night with two games — a
  quiz reaching its winner at half nine would publish before the bingo had
  started.

So: **never before the last game of that night has ended; automatically once
the booked end time has passed; immediately if the host taps Publish.** A night
with no booking falls back to the tap, or to a fixed delay after the last game.

#### The address

**`quizporium.co.uk/gallery`**, broken down by quizmaster and by date.

**Not connected yet** — the app answers on `musicquizapp.onrender.com`. A
custom domain on Render is DNS plus a setting, and it is worth doing before any
QR is printed on a slide, because the URL on that slide is permanent in a way
the app is not.

#### WHAT I WOULD STILL PUSH ON, having lost the unlisted argument fairly

**The publish gate fixes WHEN, not WHETHER, and the consent still does not
cover it.** The phone says a photo *"goes on the big screen"*. A browsable page
at a clean domain, listed by quizmaster and date, is a different thing, and a
pub quiz has families in it. Two cheap mitigations, neither of which costs the
feature anything:

- **Say it at upload**, in one line, per the house style. This is not optional
  and it should ship with the gallery.
- **`noindex` at least to begin with.** Being findable on Google is speculative
  marketing value; a stranger's face and team name turning up in a search is a
  concrete cost, and it lands on the player rather than on the business. One
  header to change later if it turns out to matter.

**And a removal path.** Somebody will want their photo down, and "email the
quizmaster" is not one on a page with no contact on it.

#### Badging the winners in the gallery — half of it joins exactly, half of it does not

Asked for on 15 August 2026: highlight the photos from teams that won or did
well.

**It is the TEAM we know, not the device.** A photo carries `playerId` and
`teamName` (`src/photos.js:147`) — the app's own handle for whoever uploaded
it. There is no device identity anywhere in this app and there must not be:
fingerprinting a stranger's phone in a pub is not something to add for a badge.
The team is the better key anyway, because it is the thing worth printing.

**THE WINNER JOINS EXACTLY. "DID WELL" DOES NOT.**

- `vouchers[]` is in the archived night and carries `winnerId`, so the winning
  photo can be identified by id — no guessing.
- **The archived `leaderboard[]` has `position`, `name`, `score` and no ID**
  (`src/engine.js:2474`). So anything below first place would have to join on
  the TEAM NAME, and that is fuzzy in two ways that both end badly: **nothing
  makes a team name unique** (28 characters and no filter is the whole rule),
  and **a team can rename mid-game**, which leaves the photo holding the old
  name while the leaderboard holds the new one.

Either would badge **the wrong table's photo, in public, on a page they can
order a mug from**. The fix is one field: **put the player id on the archived
leaderboard.** Additive, invisible to every payload — the archive is not a
view — and it makes the join exact instead of hopeful.

#### BADGE, DO NOT RANK — and this follows from a rule already in CLAUDE.md

A small gold mark on the winners is worth having. **Ordering the gallery by
score is not**, and the reason is already written down twice:

- *"Being on the podium is most of what a quiz night gives the people who did
  not win it"* — recognition is the point, and a grid where the winners are
  bigger takes it away from everybody else.
- *"No red for a night that went down. The app does not editorialise about
  somebody's own work."*

A gallery is a scrapbook of the night, not a second leaderboard — and in a
leaderboard most of the room loses. **Same size, same grid, same order; the
winners get a mark and nobody gets demoted.**

**And it is the strongest thing on a mug.** *"We won the quiz at The Crown"*
is a far better product than a photograph, which is a real point in favour of
the print idea rather than a decoration on it.

### TWO NIGHTS, AND THEY ARE NOT THE SAME NIGHT

Settled on 15 August 2026, and it corrects the section above rather than adding
to it. The host runs *"a quiz, music bingo and karaoke combo night on a
Thursday — and the karaoke isn't part of the quiz."*

| | What it is | What it knows |
|---|---|---|
| **The booking** | the PUB's night — The Station Tap, Thursday, 9 till 1, quiz + bingo + karaoke | everything, including what the app never runs |
| **The games** | the APP's night — a quiz, then the bingo | only itself |

**DO NOT INVENT A THIRD CONCEPT. BOTH ALREADY EXIST.** A booking is
`{ date, venue, off, note }` (`public/assets/diary.js:106`) and the games are
the archived records `mergeGigs()` already groups by date. What is missing is
the JOIN between them and the words to tell them apart.

**And the app already gets this wrong in a place anybody can see:**
`src/ics.js:161` writes `SUMMARY: Quiz — <venue>` into the calendar export, so
a combo night appears in the host's own diary as "Quiz". That is the same
mistake in miniature and it is already shipped.

#### THE GALLERY HEADING COMES FROM THE BOOKING, NEVER FROM THE GAMES

*"Quiz, Music Bingo & Karaoke at The Station Tap, 9 till 1"* is the line a
customer reads. **Derived from what the app ran it would say "Quiz & Music
Bingo" and silently drop the karaoke** — wrong, on the one line the page is
judged by, and wrong in a way nobody would notice because it looks complete.

So the heading is written by the host, not computed. **`note` already exists on
a booking** and is the cheapest home for it; whether it deserves a field of its
own is a question for when somebody fills one in.

**The app never learns what karaoke is**, and must not. It records that the
night contained something it did not run, in the host's own words, and stops
there. Anything more is a karaoke module nobody asked for.

#### AND THIS BREAKS THE PUBLISH TRIGGER I PROPOSED — usefully

The section above says publish *"once the last game has ended, or at the booked
end time."* **On a combo night the last GAME ends at eleven and the room is
still there until one.** Publishing then puts the gallery out while the pub is
full of the people in it, which is exactly what the publish gate existed to
prevent.

**So the booked END TIME is the trigger, and "the last game finished" is only a
floor — never a trigger on its own.** Never before the games are done, and not
until the booking says the night is over.

**Which makes the booking's end time load-bearing, and today it is a guess.**
CLAUDE.md records a *stated two-hour default*: a 9pm start becomes 11pm, so a
combo night would publish two hours early, mid-karaoke. **A night whose gallery
publishes on it needs a real end time**, not a default — and that is a small
change to the booking form with a real consequence behind it.

### FLAG A RUDE PHOTO FOR REVIEW — and only then, maybe, cover it

**FLAGGING IS THE FEATURE. CENSORING IS THE GARNISH**, settled on 15 August
2026 when the host asked *"perhaps any potential nudity is flagged to me?"*
right after calling the censored card a nice-to-have and the bin a
need-to-have. He is right, and the reason is worth keeping because it inverts
the difficulty:

**A FALSE POSITIVE COSTS NOTHING IF IT IS ONLY FLAGGED.** He glances, sees an
ordinary face, moves on. That was the ONE real failure mode of the censoring
version — a CENSORED card over somebody's face on the projector, live, in front
of a paying room — and flagging removes it completely. A miss costs nothing new
either: it is exactly today, and nothing reaches the gallery unpublished.

So every hard requirement disappears with it: **no bounding boxes** (the
expensive part), **nothing baked into an image**, and **no latency in the live
path** — score in the background after `fileAway`, the way the photo already
reaches the repository after the phone has had its answer.

#### What to build

- **A score per photo, taken when it is filed.** A likelihood-only check is
  enough — the `GOOGLE_API_KEY` that draws round-2 artwork already exists, but
  **SafeSearch is a separate API that has to be enabled on the project**, which
  is a setup step for the host rather than a code change.
- **Kept in a sidecar beside the photos**, `photos/<room>/<night>/flags.json`,
  exactly like `published.json` — the disk is wiped on deploy, the repo is not,
  and the list of which pictures are questionable belongs with them.
- **FLAGGED PHOTOS SORT TO THE FRONT OF THE NIGHT, marked.** That is the whole
  value: a review of 102 photographs becomes a look at the three worth looking
  at. It composes with what already exists — flag, then the bin, then the
  publish button, which is a flow the host already has.
- **BUILD IT SO IT WORKS WITH NO KEY AT ALL**: unscored is simply unflagged,
  the column stays empty, and nothing about the night changes. Then enabling
  the API switches it on without a deploy.

#### And only after that, the joke

### "NICE TRY" — catching a rude photo and covering it, as a JOKE

Asked for on 15 August 2026, and then reframed by the host in a way that
changes the whole build: *"this isn't really about protecting me as I can just
delete them from the gallery after, it's more of a 'lol you tried to be rude
and got caught' type thing."*

**THAT REFRAME IS THE DESIGN.** As a safeguard this is expensive and can never
be trusted; as a gag it is cheap and does not have to be. Three things fall out
of it and every one of them makes the job smaller:

- **IT FAILS OPEN.** If the check times out, the photo goes up as it does
  today. That cannot be a regression, because today there is no check at all —
  where holding photos back on a bad-wifi night would be a NEW way for the
  photo wall to break, in the lobby, which is the busiest moment there is.
- **IT DOES NOT NEED TO KNOW WHERE.** Bounding boxes are the expensive
  requirement — a specialist service, a separate account, several times the
  price. **Covering the WHOLE photo with a comedy card is funnier anyway** and
  works with a likelihood-only check on the `GOOGLE_API_KEY` that already
  exists for round-2 artwork.
- **ACCURACY BARELY MATTERS IN ONE DIRECTION.** A miss is fine — the host
  deletes it later, and nothing reaches the public gallery without him
  publishing that night. **A FALSE POSITIVE IS THE REAL COST**: covering
  somebody's ordinary face on the projector in front of a room is the failure
  worth tuning against.

#### It must be baked in, not drawn over

A CSS overlay is peeled off with the inspector in four seconds, and both the
projector and the phone would have to draw it. **The card goes into the stored
image on the server**; the original never leaves it. That is also what makes
the joke land everywhere at once.

#### A DRY RUN FIRST, because a threshold cannot be guessed

The host asked to see it working before choosing, and he is right to. **Score
every photo, record the score, censor nothing.** Point it at a real night — the
102 photographs from 13 August are the obvious set — and look at what scored
high and what scored low. Only then pick the line.

**Stock test images prove nothing here.** The question is how a detector
behaves on phone photos taken at arm's length in a dark pub, which is exactly
the input that makes skin-tone heuristics useless.

#### What NOT to do

- **NO SKIN-TONE HEURISTIC IN PLAIN JS**, however tempting the no-dependency
  version is. A night is a hundred close-up faces; that is precisely what such
  a check false-positives on. It would flag half the wall and miss the thing it
  was built for.
- **NO BUNDLED MODEL.** Tens of megabytes of asset, against a codebase whose
  logo, avatars and props are all drawn rather than shipped.
- **DO NOT PUT IT IN THE WAY OF THE PHOTO REACHING THE WALL** any longer than
  the score takes. Auto-publish is a settled decision; this is a filter on the
  way past, not a queue.

### THE CONSOLE SCROLLS SIDEWAYS AT 320px — small, real, and old

Measured on 15 August 2026 and confirmed **pre-existing**: identical 32px of
horizontal overflow on that day's work and on the commit before it, so nothing
recent caused it. Everything at 390px and up measures clean.

Eleven offenders, all the same shape — **things that neither wrap nor shrink**:

- **eight `.tab` buttons**, running to x=999 in a 320px viewport. The bar is
  meant to scroll sideways below 860px, but it is pushing the DOCUMENT rather
  than scrolling inside itself, which is the actual fault;
- **`.pack-tools` / `.pack-search`**, right edge at 352 against a 320 viewport —
  the search box has a floor it will not go under;
- one `a.minor` link in the same row.

**It is a tidy-up rather than a fire**: 320px is the narrowest phone anybody
still carries, and the console is driven at 390 and up in practice. But it is
the seventh instance of the min-content fault this file records, and the fix is
the same each time — `min-width: 0` on the flex children, `max-width: 100%` on
the input, and let the bar clip inside itself instead of pushing the page.

**Measure `scrollWidth` against `clientWidth` at 320 after anything
structural**; nothing else finds it.

### A FEATURE THAT MOVES UP A TIER DOES NOT LEAVE THE PEOPLE WHO HAD IT

Settled on 15 August 2026, and it is the decision that unblocks the tier
buckets — the drag-features-into-bronze/silver/gold arranger the host asked
for. **It is a business rule rather than a UI one, which is why it had to be
answered before the drag exists rather than after.**

**Anybody who already holds a feature keeps it for as long as they stay
subscribed. The new tier applies to new sign-ups.** Nobody loses something they
were already using.

The alternative — losing it at renewal — is cleaner data, because a tier then
means exactly what it says. It was turned down for a better reason than
kindness: **a quizmaster finds out on a gig night**, not when they read the
email. Something they used last Thursday is missing this Thursday, in a pub,
with a room in. That is the app breaking its own first rule, and no amount of
tidy data is worth it.

**What this means for the build**: entitlement cannot be computed from the tier
table alone. An account needs to carry what it was GRANTED, and the tier table
decides only what a NEW account gets. That is a real difference and it is
cheaper to build in from the start than to retrofit — `entitlements` already
distinguishes `entitled` from `features`, which is most of the shape.

**And the arranger has to say so on screen.** Dragging a feature from bronze to
gold must not silently imply that bronze accounts lose it — the panel should
state that existing holders keep it, at the moment of the drag.

### TONIGHT'S SETTINGS IS A TAB, NOT A PANEL ON THE BAR

Asked on 15 August 2026: *"not sure what the point of the Set it up bit on the
console is, can this be done in the workshop?"* — and then answered better by
the host himself: ***"perhaps a fourth tab that says Tonight's settings?"***

**That is the right shape, and it beats both options that were put up.** The
settings ARE about tonight, and the Console door IS about tonight, so they
belong on a tab inside it. What was wrong was never the settings — it was them
hanging off the launch bar as a fold, which is furniture between the bar and
the packs and breaks the rule that nothing comes between those two.

So the Console door becomes: **Music Quiz · Music Bingo · Venues · Tonight's
settings**, and `Set it up` disappears from the bar.

#### What is in it

Look, While they wait (the lobby game), Game sound, Playing (teams or one phone
each), and for bingo the Card shape and how many Prizes.

#### THE WORK IS THE STATE, NOT THE MARKUP

**The panel is built inside `launchBar()` and reads that function's own
`currentPack`** — bingo's card shape and prize list come off whichever pack is
in slot 1, and the options are generated from it. A tab cannot see any of that,
so the chosen pack has to be lifted out of the launch bar's closure to
somewhere both can read. That is the whole job; the markup moves for nothing
once it is done.

#### It composes with per-venue defaults, later

Four of the six are really VENUE decisions rather than night ones — The Crown is
always rowdy, the gastropub is always quiet, and you would give the same answer
every time you played there. A venue record could supply the starting values the
way it already supplies the prizes and the voucher, with the tab as the place to
override them for one night. **Not decided, and it does not need to be**: the
tab is where you set it either way, so building the tab first cannot be wrong.

### CONSOLE · WORKSHOP · POST GIG — the three doors, ordered by the gig

Proposed on 15 August 2026, and it supersedes the smaller console/workshop
split below it: *"perhaps a better order is three sections, one dedicated to
preparing for gigs, one dedicated to the gig night, and one dedicated to what
happens after, and then each one gets tabs below."*

**IT IS THE AXIS THIS APP ALREADY USES, PROMOTED TO THE TOP LEVEL.** The tab
bar is already ordered *left to right along a quizmaster's evening*, and
*"Gigs is EVIDENCE, Calendar is ORGANISATION"* is already recorded as the test
for where a new thing goes. Both are the same before/after distinction, decided
locally, twice. Three doors make it one rule that answers every future "where
does this live" without re-arguing it.

It also fixes a real problem rather than only tidying: **nine tabs is too many
to scan**, and three sections of three or four is not.

**The allocation, given by the host on 15 August 2026 and not to be
re-derived:**

**THE NAMES ARE THE HOST'S AND THEY ARE BETTER THAN "BEFORE / DURING /
AFTER"** — given on 15 August 2026: *"this section needs to say Console,
Workshop and Post gig and function like that."* **Console keeps its name and
means the night**, which is what makes the launch guarantee survive: everybody
already knows Console is where you go to start a quiz, so nothing has to be
re-learned.

| Door | What it is for | Tabs under it |
|---|---|---|
| **Console** | the gig itself | the launch bar, the Recommended six, the control view |
| **Workshop** | preparing, before the night | Music Quiz and Music Bingo (each with its writing, buying and asking panels), **Adverts**, **Calendar**, Venues |
| **Post gig** | evidence and admin | **Past gigs**, **Invoices**, photos & the gallery |

**CONTROL STOPS BEING A DOOR** and lives inside Console. The route back to it
must stay short from anywhere — two predictable taps (Console → Take control)
is acceptable; hunting is not, and relaunching is catastrophic.

#### How to build it: a `door` on each tab, one page, a filtered bar

`TABS` in `console.js` already drives the whole tab system. Give each entry a
`door` and filter the bar by the door in the address — `/console?door=workshop`
— and the three sections fall out of the structure that already exists rather
than needing three pages.

**That also solves the panel move for free.** Music Quiz appears under Console
as the shelf and under Workshop as the writing panels: same tab id, different
door, different body. Nothing has to be extracted into a shared module, which
was the expensive part of the earlier plan.

**The Tonight bar renders on the Console door only.** It is furniture in the
wrong room everywhere else, and that is the whole reason for doing this.

**WHICH PANELS MOVE, NAMED — so nobody has to guess from a screenshot:**

- **To the workshop, under Music Bingo:** *Ask for a bingo game*, and *Make a
  bingo game of your own* (the paste-a-track-list panel).
- **To the workshop, under Music Quiz:** *Ask for a quiz*, and *My packs* (the
  scaffold panel, whose button is now **Write it myself**).
- The Quizporium shop goes with them. **Nothing that writes, buys or asks for a
  pack stays on the launch page.**

#### One thing left to settle BEFORE building it

- ~~Help and My Account are not on the timeline~~ — **SETTLED: they go behind
  the ACCOUNT CHIP, top right**, beside the hat switch and Sign out, which is
  where settings and help live on every other website. They are not before,
  during or after a gig — they are always — and leaving them under Workshop
  made that door a lie, since nobody prepares for a gig by reading Help. **This
  keeps the three doors honestly about the gig and nothing else**, which is the
  whole reason they exist.
- ~~It reverses "Tonight at the top of every tab"~~ — **SETTLED, and it is not
  a reversal.** The host's own resolution: *"as long as people know they can
  click Console they know they can launch quickly from there — it's the same
  decision, tidied up into a single console area."*

  **The decision was never "a launch panel on every tab".** It was *launching
  is always one predictable move away, and you never have to think about where
  it is* — and Tonight-everywhere was how that was achieved while nine tabs
  were a jumble and you might be sat on Venues when you decided to go. Once the
  night has a door of its own, **one tap IS that guarantee**, and it costs a
  launch bar that was furniture in the wrong room on Invoices and Venues.

  So the property to preserve is the GUARANTEE, not the panel. Whatever the
  night door ends up being called, pressing it must land on the launch bar with
  nothing in front of it.

#### What it settles for free

**CONTROL STOPS BEING ITS OWN DOOR** and becomes part of the night. That is
more honest than a top-level item: driving the quiz is something done DURING,
not a different kind of tool. It also answers the *"is the Control menu item
pointless"* question — the door is not pointless, it is in the wrong place.

**But keep a route back to the controls from everywhere**, whatever the shape.
Mid-quiz, going to another section and needing to return has to be one tap; the
only alternative is relaunching, which destroys a running game in front of a
room.

#### This replaces the smaller split below

The console/workshop entry that follows is the same idea at half the size. If
the three doors are built, that entry is done by definition — do not build
both.

### THE CONSOLE IS FOR LAUNCHING. THE PACKS PAGE IS THE WORKSHOP.

Proposed on 15 August 2026: *"perhaps the console menu item itself needs to be
geared towards this (so you click Console and are ONLY given sections that help
you launch a quiz ASAP) and then you click the next bit and it's more geared to
in depth stuff like writing, buying packs etc."*

**THE SPLIT ALREADY EXISTS AND NOTHING NEW HAS TO BE INVENTED.** `navMenu()`
gives every quizmaster three doors — **Console · Control · Packs** — and Packs
already points at `/editor`. Run tonight, drive the game, work on packs.

**What went wrong is that the workshop crept onto the Console's pack tabs.**
Four jobs that are not launching now sit under the thing that is used ten
minutes before a gig: the AI generator, *Lay it out empty*, the Quizporium
shop, and *Ask for a quiz*. That is also why the shelf needed capping at six to
feel calm — the tab was carrying four panels it should never have had.

**So this is a MOVE, not a new section**, which makes it far smaller than it
sounds and means no second navigation system to learn.

#### CHOOSING THE SIX, from the workshop

Added on 15 August 2026: *"even in the workshop you can drag and drop which 6
items appear in the quick pick section for the console, for each game type — or
if they leave it, it just defaults to pinned + recommended. In fact, call it a
Recommended section!"*

**The name is done and it is the honest one.** The shelf says **Recommended**
at rest and **Your library** the moment it stops being a shortlist — when See
all is pressed or a search is typed. A row of six labelled "your library" when
somebody owns twenty-three is the app quietly lying about what it is showing.

**The drag-to-choose is the PIN with an order on it, and it needs no new
storage.** `prefs.pinnedPacks` already holds an ordered list per account;
dragging six tiles into an arrangement in the workshop is simply a nicer way to
write that list than tapping six pins on six cards. Which means the two cannot
disagree — there is one piece of state and two ways in.

- **PER GAME TYPE.** Quiz and bingo have their own shelves and their own six.
  A list that mixed them would be wrong on every night.
- **EMPTY IS THE DEFAULT AND MUST STAY MEANINGFUL** — pinned first, then the
  ranking. Somebody who never opens the workshop still gets a sensible six,
  which is what makes this an enhancement rather than a setup step.
- **A PARTIAL ARRANGEMENT FILLS FROM THE RANKING.** Two dragged in means two
  fixed and four suggested, not two and four holes. Same rule the pin already
  follows.
- **IT BELONGS IN THE WORKSHOP, NOT THE CONSOLE.** Choosing what is on the
  shelf is preparation; the console is for the night. Putting the arranger on
  the launch tab would be the fifth panel to creep onto it.

#### What stays on the Console

Tonight, the six packs, the search, and nothing else. **Not even the shop** —
a shop on the launch screen is the plainest possible breach of *the common job
is the fast one*.

#### What moves to Packs

The generator, the scaffold, the shop and the ask-for-a-quiz panel. None of
them changes behaviour or gating on the way; the owner-only generator stays
owner-only.

#### The one thing to get right

**Somebody looking for "write a quiz" will go to the Music Quiz tab first**,
because that is where it has always been. The answer is ONE QUIET LINE under
the shelf — *"Write, buy or edit packs →"* — a link, not a panel. **If it grows
into a panel the whole move has been undone**, which is exactly how the four
panels got there in the first place.

#### Do it as its own piece of work

It touches the tab every gig starts from, so it wants its own screenshots at
1280 and 390, and a real Launch pressed in a browser afterwards — the protected
surface, not a diff review.

### BINGO PAYS OUT TOO — prizes per STAGE, defined by the venue

Asked for on 16 August 2026: *"bingo should get prizes as well — as defined by
the venue. My 5x5 rounds usually give a prize for 1, 3 and 5 lines but this
should be customisable."*

**THE ENGINE ALREADY DOES THE HARD PART, and that was checked rather than
assumed.** `state.stages` is an arbitrary LIST — `stagePlan(n)` is only the
DEFAULT generator, and it is the thing that produces consecutive stages
(`stagePlan(3)` is 1, **2**, full house). Set `state.stages = [1, 3, 5]`
directly and everything downstream is already correct: `evaluate()` tests
`done.length < stage`, `squaresAway()` searches combinations for N lines,
`stageLabel()` says *"3 lines"*, `syncTarget()` keeps the old `line`/`full`
field honest. Verified by running a 5x5 game with `[1, 3, 5]` on it — 12 lines
available, right labels, right targets, `onLastStage` right.

**So this is plumbing, not a rewrite of the bingo loop.** What is missing:

1. **The venue record carries bingo prizes as PAIRS** — `{ stage, reward }`,
   e.g. `1 → a bottle of wine`, `3 → two pints`, `5 → a £20 tab`. Its own field
   beside `rewards` (which is the quiz's 1st/2nd/3rd), because the SHAPE is
   different: a quiz pays by PLACE, bingo pays by STAGE. **Do not try to reuse
   one list for both.** The stage and its prize are one decision, so they are
   stored together — that is why the stages live on the venue rather than at
   launch.
2. **The launch reads them off the venue** exactly as the quiz's do, in the
   same place in `server.js`, and writes `state.stages` plus the prizes.
   **`prizes` as a COUNT stops being the input** — it stays readable for games
   saved before this, the same way `state.reward` still reads.
3. **Bingo issues real vouchers** — the same card, the same QR, the same
   scan-at-the-bar, the same landing in the filed night. `src/bingo.js` has the
   word "voucher" in it zero times today. Reuse the quiz's: a voucher is minted
   per stage win, to the winning player, carrying `stageLabel()` as its place.
4. **A switch at launch: every round pays the full set, or the set is for the
   whole night.** His answer, and it belongs under *Set it up* with the card
   shape and the lobby game — a decision about tonight. `newRound()` reissues
   everything, so per-round is the natural default; per-night means a table
   that wins in round one has nothing left to play for, which is the same
   argument the lucky dip is built on.
5. **The cap** — `maxPrizes(shape)` is how many STAGES a shape can carry and it
   is capped at 5 and at the number of lines. A 4x4 cannot pay at 5 lines, so
   the venue's pairs have to be filtered against tonight's shape at launch
   rather than refused: **losing a stage costs one prize, refusing the launch
   costs the night** — the same rule the lobby game tier check follows.

**AND IT INHERITS THE THURSDAY LESSON.** A bingo night whose venue has no
prizes must say so on Tonight and on the control view, and must be fixable
mid-night, exactly as the quiz now is — see *A night that cannot pay out says
so* in CLAUDE.md. `prizePanel()` in `host.js` returns `[]` for bingo today.

### EVERY DOOR GETS A BENCH — the same drop zone, doing that door's job

**BOTH BENCHES ARE BUILT — `workBench()` and `nightBenchPanel()` in
`console.js` — so read the rest of this as what is LEFT, not as a build plan.**
Settled by building them: each survives a reload on the device, each holds ONE
thing, and the Workshop's two buttons now open popovers rather than navigating
(see *Editing is a popover* in CLAUDE.md).

Two things are genuinely outstanding — the clear-on-done is built (*Done with
it* on both benches; see CLAUDE.md):

- **The Post gig bench's *Put it on the gallery* still wants one check on the
  live app.** The 400 in a sandbox is an environment limit — `setPublished()`
  refuses when no photo repo is configured — but **that diagnosis was recorded
  here as the whole story and it was not.** There was a real bug underneath it:
  the LIST payload never carried `published`, only the per-night route did, so
  the button was permanently labelled *Put it on the gallery* and permanently
  posted `on: true`. **A night could be published and never taken down.**
  Fixed, with `test/bench-fields.test.js` on it. The publish round trip itself
  still cannot be exercised without a repo, which is the part that needs a live
  check — and the lesson is the one this file keeps recording: **the loud
  failure was hiding the real one.**
- **The Post gig bench is still the least worked out**, as this entry predicted.

Proposed on 16 August 2026: *"I think perhaps the workshop and post gig should
have the same launch area but for their own respective functions — so you drag
and drop whatever you need into the workshop to fix it (writing a quiz, music
bingo etc.), then when it's done it's saved and removed from the section. Post
gig works as well for other reasons. The GUI will be unusual but work imo."*

**It is right, and the reason it is right is that the doors already ARE this
shape and only one of them has the panel.** Tonight is not a launch widget —
it is *the thing this door is currently working on*, pinned above the tabs,
fed by dragging, with the door's one big button at the bottom of it. Console's
happens to end in Launch. There is no reason Workshop's cannot end in Save and
Post gig's in Send.

**The unusual GUI he flags is the honest part: this is a WORKBENCH, and a
workbench holds what you are in the middle of.** That is a different idea from
a form, and it earns its space for the same reason Tonight does — you can see
both ends of the drag.

**AND THE CONSOLE'S HALF OF THIS IS NOW BUILT, as SHOWS** — a whole evening
kept as one thing and dragged back onto Tonight, which is the bench's
clear-and-reload mechanic arriving from the other direction. Read the Shows
section in CLAUDE.md before building the Workshop's, because two of its
decisions apply unchanged: **the thing on the bench stores references and never
copies**, and **it is not a gate**.

| Door | What goes on the bench | What the button at the bottom says |
|---|---|---|
| **Console** | tonight's packs, tonight's venue — or a whole **show** | **Launch** — built |
| **Workshop** | a pack you are writing or fixing, a round pulled out of another pack, a venue you are setting up | **Save it**, and the bench clears |
| **Post gig** | the night just run, the photos worth keeping, the venue to bill | **File it** / **Invoice** — one night at a time |

**THE CLEAR-ON-DONE IS THE WHOLE MECHANIC AND IT MUST BE BUILT IN FROM THE
START.** *"When it's done it's saved and removed from the section"* is what
stops the bench becoming a third shelf of stale things. An empty bench means
nothing is half-finished; a bench with something on it is a to-do you cannot
miss, in the one place you look first. That is a Monday-load reducer wearing a
drop zone.

Four things to settle before building, none of them blocking:

- **DOES THE BENCH SURVIVE A RELOAD?** Tonight's does — it is game state. A
  workshop bench holding an unsaved pack is a draft, and a draft that
  disappears on a refresh is worse than no bench. Likely `prefs`, per door, per
  account. Decide before writing, not after.
- **ONE ITEM OR SEVERAL?** Console holds a running order of several. Writing
  a quiz is one pack at a time; post gig is one night at a time. Probably: the
  bench holds a LIST where the job is composition and ONE where the job is
  editing. Do not force uniformity on this.
- **WHAT DOES "SAVED AND REMOVED" DO TO A HALF-FINISHED PACK?** Save has to be
  allowed to leave it on the bench — the natural move is *Save* keeps it and
  *Done* clears it, rather than one button doing both silently.
- **THE POST GIG CASE IS THE LEAST WORKED OUT and should probably be built
  last.** Console and Workshop have obvious cargo; Post gig's is a night, and a
  night is only just becoming a real object. Build the two that are clear and
  let the third follow the night.

**AND ONE THING THIS MUST NOT DO: put a second gradient button on a screen.**
The GUI rules allow exactly one *"the night"* control per screen, and the bench
is the place it lives. On Workshop that button is green (*make something*), on
Console it is the account gradient (*the night*) — which is the existing rule
working, not an exception to it.

### SIX PACKS IN REACH — a shortlist, because a drag needs to SEE both ends

Raised on 15 August 2026 as a crowding problem — *"if the packs section gets
too many packs it will start to look crowded, can we just have a 'highlighted
packs' section"* — and then reframed by the host into something better:
***"6 is perfect because it's not just about crowding but also what can be seen
to be dragged and dropped."***

**That is the real justification and it changes what the feature is.** Drag and
drop only works while the card AND the slot are both on screen. It is why
`pinTonightWhereItIs()` had to be written at all: the drop target kept
scrolling away from the hand. Six packs is ONE ROW sitting directly under the
Tonight bar, which means the common gesture needs no scrolling at either end.
**The shortlist is not tidying. It is what makes the gesture possible.**

So it is not a curation feature and should not be built as one:

- **THE SIX SIT AT THE TOP OF THE LIBRARY, nearest the bar**, and *See all N*
  expands underneath. The packs you can reach without scrolling are the ones
  the app thinks you want.
- **CHOSEN AUTOMATICALLY, NEVER STARRED BY HAND.** `quickPicks()` already ranks
  by what the room is least likely to have heard — never played first, then
  longest since — and that is not a proxy for *what should I play tonight*, it
  IS that question. A hand-picked six is a preference that goes stale (starred
  in March, still showing in October) and a Monday job per pack, which is the
  cost this app measures features by.
- **EXCLUDE WHAT IS ALREADY IN TONIGHT'S SLOTS**, or the six things you are
  most likely to want are partly things you have already picked.
- **SEARCH SCANS EVERYTHING AND SHOWS SIX — into the same six positions.**
  Corrected by the host immediately after the above was written: *"that's also
  why search needs to discard packs from the 6 so they're easily drag and
  droppable."* **The six are a fixed WINDOW onto the library and only their
  CONTENTS change** — at rest the automatic picks, while searching the top six
  matches. A pack you searched for is then exactly as reachable as one the app
  suggested, which is the whole point; results appearing in a list somewhere
  further down the page would put the thing you were looking for out of reach
  of the slot you want it in.
  **It also keeps the row a constant piece of furniture**, which is the rule
  this bar already follows: Launch is always there and goes hollow, Set it up
  is always there and goes disabled. A results list that appears out of nothing
  somewhere else is the exact fault those two exist to avoid.
- **A PIN ON TOP OF THE AUTOMATIC SIX** — *"a pin feature could be cool, just
  a little pin in the corner that comes on and off."* It composes cleanly and
  that is the whole reason to build it this way round: **pinned packs take the
  first positions and the automation fills what is left**, so one pin still
  leaves five suggestions and the ranking is only lost if somebody pins all
  six, which is then their choice rather than a side effect. Automatic first
  then manual on top is the cheap direction; manual first is not.
  - **TOP LEFT, because the other corners are taken.** An own-pack carries its
    *Yours* badge top right and the era word sits bottom right. Top left is
    also where the eye starts, so a pin there reads as a status rather than a
    decoration.
  - **THE STATE IS THE WORK, not the icon.** A pin is per-account, like
    `prefs.askRounds` — it has to be stored, restored and scoped to the room,
    and it must survive a deploy. The drawing is an afternoon; the persistence
    is the feature.
  - **A pin is not a launch.** It changes what is in reach, nothing else — it
    must not put a pack in a slot, or the two gestures start competing on the
    one screen where a mis-tap costs setup work.

**Not urgent at seventeen packs** — nine quiz and eight bingo is two rows, and
building a curation layer against a shelf neither of us has seen is designing
blind. It earns its place when the library is long, or sooner if the reaching
turns out to be the annoying part rather than the scrolling.

### TONIGHT IS A RUNNING ORDER — slot 1 is the first thing the app plays

Decided on 15 August 2026: *"I think it should be running order so the first
drop zone is the first thing the app plays, that makes sense."* Three slots,
each taking ANY pack type, played in the order they sit in.

**This is the NIGHT object again, arriving from a third direction** — after the
gallery's publish trigger and the two-nights distinction. Three separate roads
now end at the same piece, which is about as strong a signal as this list gives
that it is the right thing to build next.

#### AN ITEM IS A PACK, OR THE PART OF ONE YOU PICKED

Asked, and the answer was better than the three options offered: *"can't we
have it so the QM decides what he does with each pack and sub pack? So if he
wants a whole quiz pack and then half a second one followed by music bingo he
should be able to."*

**That dissolves the question rather than answering it.** Composition is not a
rule about types that the app applies — it is the quizmaster deciding, per pack
and per round, and the app doing what the row says:

| In the row | What plays |
|---|---|
| Quiz pack A, whole | its rounds |
| Quiz pack B, three rounds ticked off | the rounds left on |
| A bingo pack | a bingo game |

**A run of quiz items is ONE quiz.** `composeQuiz()` already does exactly this
— merges chosen rounds from several packs into one game and titles it for the
evening — so "a whole pack then half of another" is built and working today.
**A bingo item is its own game**, because bingo is not rounds and cannot be
merged into a quiz.

So the running order is really about **where one GAME ends and the next
begins**, and the answer falls out with nothing to decide: a game ends where
the kind changes. Everything else is the round ticks, which already exist.

**Which makes this smaller than it looked.** No new composition, no merge
control, no behaviour taken away — what is new is that the row may hold more
than one KIND, and that the app remembers what comes after the one playing.

#### What has to be built

- **The order lives on the ROOM, not in the game state.** `state` belongs to
  one game and is replaced when the next launches, so a list that has to
  survive game one ending cannot live there. Per-room, persisted, restored on
  boot like everything else that must survive a crash.
- **Each slot is `{ kind, packId }`** — the game-type dropdown at the top of
  the bar stops being a mode and becomes, at most, a filter on the search box.
  Dropping a bingo pack must no longer switch the whole bar over.
- **Launch fires slot 1** and marks it played. **"Next: <pack 2>"** then has to
  appear somewhere the host will see it at eleven o'clock with a room in front
  of them — the running panel, not a tab they would have to go and find.
- **A played slot is not deleted.** The order is the record of the evening
  while it is happening, and it is what the night object will be filed from.

#### What NOT to do

- ~~**Do not make it four or five slots.**~~ **SUPERSEDED on 15 August 2026 —
  it is SIX** (*"need 6 pack slots imo"*). The original reasoning was about
  PACKS — three being a quiz, a bingo and one spare — and the night has since
  stopped being made of packs: it is a running order of ELEMENTS, and a quiz
  split either side of a breakout is three items before a bingo game is
  anywhere near it. **The worry behind the old rule still stands and is
  answered by the WIDTH instead of the count**: a row that needs reordering and
  scrolling is the thing to avoid, so the tiles came down to 160px, which puts
  six on one laptop row inside the space three took at 200.
- **Do not auto-launch the next one.** The gap between games is the host on a
  microphone, and software deciding when that ends is the one thing guaranteed
  to be wrong in a real room.

#### WHAT IS ACTUALLY LEFT, measured on 15 August 2026

Worth writing down, because the entry above reads as though none of it exists
and most of it does:

- **A multi-pack QUIZ night is BUILT AND WORKING.** `composeQuiz()` merges
  chosen rounds from several packs into one game, the three slots draw, the
  round ticks work, packs reorder by drag, and Launch says *"Launch tonight —
  2 packs, 3 rounds"*.
- **What is NOT built is a night that CHANGES KIND partway.** One line does it:
  `if (!packDrag || packDrag.kind === 'bingo') return;` on the running order's
  drop handler — a bingo pack cannot be dropped in at all today.

**So the expensive half of this entry is the mixed-kind night**, and it is
expensive for a reason worth naming: the session runs ONE game, so quiz → bingo
→ quiz means ending a game and starting another while the room, its teams and
its scores carry on. That is the piece to cost carefully, not the slots.

---

### BREAKOUT GAMES — a round that plays for laughs and scores nothing

Asked on 15 August 2026: *"the third thing to add to a night will be breakout
games that aren't part of the quiz points — for e.g. Blankety Blank style
stuff, so pack 1 — quiz round that contributes to the score, breakout game,
quiz round 2 that contributes to the score etc… the breakout games would be
orange."*

#### THE RUNNING ORDER IS DELIVERY ORDER. SCORING IS A PROPERTY OF THE ELEMENT.

The host's own framing, and it is better than the entry above it: *"the running
order of the night is the order in which the elements are delivered to the
crowd, but not all of them will contribute to the quiz score."*

**Take it literally, because it separates two axes this list had tangled.** The
row is what the ROOM experiences, in order. Whether a thing feeds the quiz
total is a property of that thing, not of what KIND it is — and bingo already
proves the point, since it is delivered and does not contribute to quiz points
either.

Two consequences, both of which make the build smaller:

- **`scores: true/false` is a flag on a round, never inferred from its type.**
  The tally, the fastest finger and the first-correct bonus ask that one
  question instead of each carrying a list of types that do and do not count.
  Every future element is then free — a fun "guess the year", a picture round
  played for laughs.
- ~~A decision is waiting in the round numbering~~ — **SETTLED on 15 August
  2026: THE COUNT IS WHAT SCORES.** Quiz, breakout, quiz reads "Round 2 of 2"
  and the breakout is played but unnumbered. **The number is a scoring
  promise**: a team working out "one round left to catch up" is doing
  arithmetic the count must not lie about, and a round that cannot change the
  scores is not one of the rounds they are counting. The breakout still
  announces itself — it simply is not numbered.

#### IT IS A ROUND TYPE, NOT A GAME KIND, AND THAT IS THE WHOLE DESIGN

**The scores have to survive it, and that decides everything else.** A night is
already ONE quiz — `composeQuiz()` builds it in memory from rounds across
several packs — so a breakout sitting between round one and round two is
naturally another round in that list. Teams, scores, tokens and phones carry
through by construction, with nothing to suspend and nothing to hand back.

**Built as a separate GAME it would end the quiz.** Launching one replaces the
session, the scores go with it, and round two would start from zero in front of
a room. That is the expensive wrong turn, and it is the obvious-looking one,
because a breakout FEELS like a different game.

**And therefore it does not depend on the mixed-kind running order** — which is
the opposite of how it was sequenced when it was asked for. Multi-pack quiz
composition already works, so a breakout round could ship before a bingo pack
can be dropped into a slot. Worth re-checking with the host before starting the
harder thing first.

#### A BREAKOUT PACK IN A SLOT, AND A BREAKOUT ROUND, ARE THE SAME THING

The host's model, stated on 15 August 2026: *"pack 1 will load first and pack 2
will load second, but if pack 2 is a breakout game it doesn't contribute to the
score on the main quiz."*

**That and "it is a round type" are the same design from either end, and saying
so is what stops the next session building two of them.** You drop a breakout
PACK into slot 2; `composeQuiz()` merges its rounds into the same composed
quiz, in slot order. The night is pack 1's rounds, then the breakout round,
then pack 3's rounds — one continuous quiz.

**Which is exactly why the scores survive: nothing LOADS, because nothing
ends.** The night carries on into the breakout and out the other side with
every total untouched. That is the whole difference between this and dropping a
BINGO pack into slot 2, which genuinely does end the quiz and start another
game — the expensive case, and still the unbuilt one.

**A PACK IS A BREAKOUT PACK IF EVERY ROUND IN IT SCORES NOTHING.** Derived, not
declared, for the reason every other look in this app is derived: one source of
truth that cannot disagree with itself, and nothing to set. It matters
immediately for the orange edge — the Tonight tile works its kind out from
`rounds ? 'quiz' : 'bingo'`, and a breakout pack HAS rounds, so it would come
out quiz green without this.

#### The phones TYPE, and that is a new mechanic

Chosen over multiple choice and over nothing-at-all: *"type an answer"*. **The
laugh is in what people write**, and offering six pre-written options takes away
the entire reason for the round.

Which makes it the second round type to change the ANSWERING mechanic rather
than just the media — `multi` was the first, and that one needed `answer()` to
take a set, `session.runPlayerAction` to forward the new field (it silently
dropped it at first), a scoring function, and the editor to switch controls. A
typed answer needs the same class of work:

- `answer()` accepting a STRING, and `runPlayerAction` forwarding it — check
  that field is not dropped, because it was last time and nothing threw;
- **no scoring at all** — the round contributes zero, which is the point. Make
  sure the tally, the fastest finger and the first-correct bonus all sit this
  round out rather than dividing by nothing;
- **a HOST screen that lists every answer by team**, because reading them out
  is the entire feature. This is the only new screen. **SETTLED on 15 August
  2026: the host's screen ONLY, never the projector.** A person reading the
  good ones out beats a wall of text the room has to look up at — and it means
  nothing a stranger types ever reaches the big screen unread, which is the
  moderation question answered by the design rather than by a filter;
- a 28-character-ish cap and control characters stripped, exactly as team names
  are — anti-breakage, not censorship;
- the editor needs a prompt-and-nothing-else round, like `alphabet`.

#### THE ANSWERS ARE FREE TEXT FROM STRANGERS, AND THE RULE ALREADY EXISTS

**Do not add a profanity filter, and do not add an approve step.** This app has
already settled both, for team names and for photographs: rude things go up as
typed and the host handles the room with the mic. A breakout round is the same
decision arriving a third time, and answering it differently here would be the
inconsistency rather than the safety.

**But it is worth deciding whether typed answers go on the PROJECTOR at all.**
Team names are 28 characters chosen once; breakout answers are a fresh sentence
from sixty phones every question. The safe default is the host's screen only —
they read the good ones out — and that is also the funnier version, because a
person reading it beats a wall of text nobody looks up at. **Start there.**

#### Orange, and one line

`KIND_EDGE` in `pack-look.js` takes a new entry. The mechanism was built for
exactly this: *"when I add further round types they can have new highlights."*
An unknown kind already falls back to an edge rather than none, so nothing
looks broken in between.
