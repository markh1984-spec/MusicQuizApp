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

**A NIGHT IS NOW A REAL OBJECT, so the strongest claim below is out of date.**
It carries a venue, a `venueId`, `finishedAt`, a headcount, a winner, the prizes
and how many were taken. **What is still missing is a WRITE path** — no way to
name or edit a night afterwards, which is the same gap as *"Add a past gig"*.

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

**THE DUPLICATE-DATALIST FAULT IS GONE** — there is no `venuesUsed` or
`rewardsUsed` datalist left in `public/assets` at all, so ignore any paragraph
below describing it. Adverts appear on the venue card and tonight's venue sorts
to the front of the control view. **What is left is one thing: an advert set is
still matched by venue NAME rather than by `venueId`.**

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

**THREE OF THE FOUR STEPS ARE BUILT (17 August 2026).** Step 1 — the invoice
customer IS the venue record. **Step 2 — a night carries `venueId` as well as
the name**, written at launch and joined by `venueKeyOf()`, which the league and
the headcounts both use. Step 4 — the launch reads the venue's prizes.
**Only the ADVERT half of step 3 is left: slides still join on the lowercased
NAME**, not on `venueId`.

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

### 1d. WHERE REDEMPTIONS ARE VISIBLE — and the snapshot that misses them

**BOTH HALVES ARE NOW BUILT (17 August 2026) — one line is left.** The bug half
was fixed earlier; the DECISION half shipped too: `rewardsTaken` rides on the
filed night (`src/library.js`) and Gigs prints *"3 prizes · 2 taken"* beside the
headcount (`console-gigs.js`). **What is left is only the REINSTATE count** — a
voucher the quizmaster put back is in the record and nothing surfaces it.

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
