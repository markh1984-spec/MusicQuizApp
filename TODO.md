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

**Which features sit on which tier, and what the middle two cost.** The ladder
is built and works; where each feature sits is a first guess I made so there was
something to look at. Moving one is a one-line change.

| | Plan | Price | What is on it today |
|---|---|---|---|
| 🥉 **Bronze** | Basic | included | Music Quiz, Music Bingo, the pack library, buying packs, seasonal looks, advert slides, photos from the room |
| 🥈 **Silver** | Elite | £15/mo | Invoicing, your calendar, marketing |
| 🥇 **Gold** | Pro | £30/mo | Online quizzes (streaming) |

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
