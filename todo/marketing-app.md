# 2 · MARKETING FOR THE APP — the words, and the shop window

The second of the three priority lists: what the app SAYS about itself, and
the shop window it says it in.

**This is part of [`../TODO.md`](../TODO.md)** — the live list. It moved out on
16 August 2026 because every session opens TODO.md and this is not what most of
them need. **A finished item is DELETED from here, never ticked**, exactly as in
the parent file.

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

### 5. Four things raised on the console — two are built, two are not

**(a) the launch tab and (b) what a night records are BUILT** — (a) shipped as
Tonight plus the *Tonight's settings* tab, and (b) as the venue, headcount,
winner and unbilled figures on Gigs. **(d) "Got in my way" is built** as the
suggestion box. **What is left is (c): agency invoicing**, and it is still
blocked on the same thing — there is no `parentId` and no children anywhere in
`src/accounts.js`, so there is no group to invoice for.

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

### 5f. EDITING A TRACK DOES NOT REPOINT WHAT ACTUALLY PLAYS

One of two faults found by the host on 14 August 2026 while asking whether a
wrong track is easy to fix. **The other half — dead air at the front of a
track, which was a scoring bug — is built** and its rules are in CLAUDE.md
under *"The intro round skips the dead air"*. This is what is left.

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

### 6. Email — THE TRANSPORT IS BUILT; the uses are what is left

**Do not rebuild the sending.** `src/email.js` is 224 lines and live:
`emailConfigured`, `fromAddress`, `sendEmail`, `keepKeyAlive`, `resetEmail`,
with **two providers** behind one interface. Password reset by magic link is
fully wired (`server.js:3573-3600` plus `/reset`).

**The whole remainder is CALLERS.** `sendEmail` has exactly one caller in the
app — the password reset. Invoices still leave by share sheet and `mailto`;
there is no suggestion-reply email, no billing email, nothing venue-facing.
Each is a template and a trigger, not infrastructure.

**And the table below is stale in one respect:** it names Resend only. Brevo
has since been added and `emailProvider()` chooses between them.

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
