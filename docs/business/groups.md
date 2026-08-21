# Group accounts, venue accounts, and who may see whose

The management layer: a quiz company with seats, a pub group with venues,
and the scoping rules that keep a parent from becoming the owner.

**Parked strategy — nothing here is scheduled.** Part of
[`../business.md`](../business.md), which is the index. It moved out on 16
August 2026 because that file had reached 170KB with 89% of it under a single
heading, and a session opening it for one answer was paying for all of it.

---

### THE FIRST SLICE SHIPPED ON 20 AUGUST 2026 — read this before the rest of the file

Everything below this note is the design as it stood before any of it was
built, kept verbatim because most of it is still the plan for what comes
next. What actually exists today, in one place, so a session does not have
to reconstruct it from the reasoning below:

- **`parentId` on an account** (`src/accounts.js`) — absent on an ordinary
  account, set on a seat. A parent is DERIVED from having children, never
  its own stored thing: `childrenOf()`/`parentOf()` are the only readers,
  `addChild()`/`removeChild()` the only writers. No nesting — a parent must
  not itself carry a `parentId`.
- **A seat gets its parent's tier, minus streaming** — `accounts.effective()`
  substitutes the parent's `tier`/`status`/`comped`/`trialEndsAt` onto a copy
  of the child before any entitlement check runs, wired in at one choke
  point (`whoIs()` in `server.js`), so `plans.js` and every existing
  `can()`/`featuresFor()` call needed zero changes. `featuresFor()` strips
  `FEATURES.STREAM` whenever `account.parentId` is set — the one thing "a
  seat gets everything" does not mean.
- **Scoped exactly like a room** — `GET /api/group`, `POST
  /api/group/seats`, `DELETE /api/group/seats/<id>` all resolve from
  `whoIs()`, never from an id in the request. `removeChild()` is never
  destructive: the account, its room, its own packs are untouched.
- **A small panel on My account** (`groupPanel()` in `console-account.js`),
  not the group-admin screen sketched further down this file.

**NOT built, on purpose**, and each is a real reason rather than a shortage
of time:

- **Pack sharing between seats.** The obvious next piece, and the one that
  actually needed a companyId and a shared folder — deliberately not built
  in the same pass because it would have meant touching roughly seventeen
  call sites across `readPack()`/`packDir()`, several of them on the
  PROTECTED launch surface (`session.pack = readPack(...)` at launch), for a
  feature with no real users to justify that risk yet. This file's own
  stated order already puts "Rob gets a login" before "company accounts and
  shared packs" — that prerequisite still has not happened.
- **Agency invoicing, venue-account specifics, the hat switch generalising
  to any group admin.** All three are described below and none has changed —
  they are still exactly the open questions this file already recorded.

---

### Venue accounts — the same skeleton, used the other way round

**Asked for on 14 August 2026, and the host got the design right in the
asking:** *"The venue accounts will probably act slightly differently to the QM
accounts, because they're likely to need a main account and then a per-venue
sub-account. So structurally it could function the same way as a QM company
with multiple quizmasters. From my perspective it's probably no different, but
the way they use the accounts would be different — so we'd probably have to
treat them differently even if at this stage they'd be more or less the same."*

**Both halves of that are right and they are worth separating**, because one is
cheap and one is not:

- **Structurally it IS the group account below**: a parent with children, one
  bill, seats. A pub group with four venues and a quiz company with four hosts
  are the same object. Build the group mechanism ONCE.
- **A KIND is not the same as a role, and it has to exist first.** `role` says
  what you may DO; `kind` says what you ARE. A venue and a quizmaster both hold
  the quizmaster role because both run a quiz night, so folding this into
  `role` would give every permission check in the app a third case to get
  wrong, for a distinction that is about USE rather than access.

**`account.kind` is BUILT** (`KINDS` in `plans.js`, defaulting to
`quizmaster`, so nothing on disk had to change) and the owner's People tab
filters on it. That is deliberately all it does: the distinction now exists, so
everything below has something to hang off — and nobody has to guess later
which of a hundred existing accounts was which.

#### What actually differs, and two of them are load-bearing

- **A quizmaster's room follows the PERSON. A venue's room belongs to the
  BUILDING.** Mark's room goes with him to The Crown on Tuesday and The Bell on
  Thursday; The Crown's room stays at The Crown while whoever is on the mic
  changes with the rota. **Those are the same structure inverted**, and it is
  the reason the join code, the photo wall and the night history hang off
  different things in the two cases.
- **Past gigs asks the opposite question.** For a quizmaster it is a PORTFOLIO
  — evidence shown to a venue to win the next booking. For a venue it is *"is
  our Wednesday growing?"* — the headcount-per-venue-over-time item already at
  the top of the SELL list. Same data, opposite use, and the venue version is a
  feature that already wanted building.
- **Invoicing runs backwards.** A quizmaster invoices a venue. A venue invoices
  nobody for the quiz — what they might want is a record of what they PAID a
  hired host. The invoice book as it stands is the wrong shape for them, so it
  is either inverted or absent.
- **The projector's name.** A quizmaster's says "Mark's Quizporium". A venue's
  says "The Crown Quiz" — and when a hired quizmaster runs a night at a venue
  account, whose name goes up? Genuinely open.
- **They are the two SIDES of the marketplace.** A venue account is the buyer,
  a quizmaster account is the seller. "Show me quizmasters near The Crown"
  needs The Crown to be an object, so this is the prerequisite for the
  directory as much as for anything else.

#### Two questions to answer before building the group half

Neither can be assumed, and both change the shape:

1. **Does head office see into each venue's nights?** Almost certainly yes for
   the numbers — that is most of why a group would buy. But **it is a read
   ACROSS ROOMS, which is the one thing the own-packs guarantee forbids in
   general**, and that guarantee is structural rather than a check: no route
   takes a room parameter. A group is a legitimate story for crossing it; the
   mechanism must be built so it can ONLY cross within a group, and never
   become a general "read another room" door. Get this wrong and the promise
   that the owner cannot read a quizmaster's packs goes with it.
2. ~~**When a hired quizmaster runs a night AT a venue account, whose room is
   it?**~~ **ANSWERED, and the answer is better than either option I put up.**

#### A night has TWO ATTRIBUTIONS, and is stored once

The host: *"You could have shared nights. Dave the quizmaster is running a
night at the Dog and Duck — it could be through either account, it doesn't
really matter. What you say is **Dave at the Dog and Duck**, and those outputs
go to both accounts. In the Dog and Duck account it says Dave hosted this
night; in the Dave account it says the Dog and Duck was the venue."*

**That is not two copies of a night, it is ONE night with a host and a venue on
it, read from either end.** Which dissolves the objection rather than trading
against it — I had framed it as "a night must appear in two histories, and this
app is single-room", and the answer is that the night stays single and the
ATTRIBUTION is what is shared.

So the archive entry gains two fields, and Past gigs becomes *"every night I am
named on"*:

| Whose page | What the same night reads as |
|---|---|
| **Dave's** | The Dog and Duck was the venue |
| **The Dog and Duck's** | Dave hosted this night |

**THE ATTRIBUTION IS ALSO THE PERMISSION, and that is the part worth keeping.**
The read-across-rooms worry in question 1 mostly evaporates here: the Dog and
Duck is not reaching into Dave's room, it is reading a night **it is named
on**. So the rule is "you see a night you are on", which is structural in the
way this codebase likes — there is no id anybody can send that reaches a night
they are not named on, and it never becomes a general door into another room.
It also generalises exactly right for the marketplace: a venue sees the nights
a quizmaster ran AT THEIR VENUE, and nothing else of that quizmaster's.

#### And it can ship BEFORE venue accounts exist — which is the useful part

**A venue does not have to be an account.** Almost none of Mark's are, and
almost none ever will be. So the field is a NAME, with an optional link to an
account when there is one:

- **Free text is the common case** — "The Dog and Duck", typed at launch, same
  as the look and the card shape are chosen at launch.
- **A linked venue account is the upgrade**, and it is what makes the night
  appear on their page too.

That means **"a night carries a venue" — the prerequisite sitting at the top of
the SELL list, the one everything else there waits on — can be built this
month, with no venue accounts, no groups and no payment processor.** It
immediately gives:

- **headcount per venue over time**, which is the strongest thing on that list;
- a Past gigs page that says WHERE, which is most of what makes it evidence;
- an invoice that already knows the venue;
- and the object the directory needs, ready before the directory is.

**Do this one first.** It is the cheapest item on the list and the most blocked
behind.

#### THE VENUE ALREADY EXISTS — it is the invoice customer, and that shortens everything

The host, following the chain: *"It makes the invoicing part much easier — you
have a bunch of venues already saved to your account. I did the Dog and Duck on
a Thursday and the Pig and Whistle on a Friday, they're already built into your
calendar, which then automatically invoices them because the venue is already
on your profile."*

**The chain is right, and it is shorter than it looks, because that object is
already built.** `saveCustomer()` in `src/invoices.js` already stores a name, a
contact, an address, an email and **`usualFeePence` — "what you normally charge
them, so the next invoice fills itself in"**. That is a venue. It has been one
for months.

So the whole of what is missing is:

1. **A night pointing at one.** A `venueId` on the archive entry, chosen at
   launch beside the look and the card shape, with free text still allowed for
   a one-off.
2. ~~**A usual night**, optionally, on the customer — "Thursdays" — which is
   what turns the list into a calendar.~~ **DONE.** `usualNight` on the venue
   record, picked on the Venues tab. `tonightsVenue()` reads it, and the launch
   bar, the search card and every pack card now start on tonight's venue —
   which is what closed the missing-prize-QR path, because the two quick-launch
   buttons take no settings and so always launched with none. Two venues on one
   night means neither is offered, rather than guessing; falls back to the
   venue of your last night when nothing is set.
3. **The invoice draft reading the night** instead of being typed from memory.

**DO NOT BUILD A SECOND LIST OF VENUES.** Two lists of the same pubs is two
lists that drift, both of which the host maintains by hand, and it is the exact
mistake this file keeps recording in other places. The invoice customer is the
venue.

**One wording question that followed, and it is SETTLED: Venues, everywhere.**
To a quizmaster that list was VENUES; on an invoice it was CUSTOMERS. Every
venue is a customer, but a corporate Christmas booking is a customer that is
arguably not a venue — so they were not quite the same word, and two words for
one list is the fault this file warns about. Done in the GUI sweep: the invoice
sheet, its heading, its add form and the invoice form's own field all say
venue. The wire is untouched (`/api/invoices/customers`), because a route is
not a label, and an issued invoice is untouched because it carries its own copy
of everything.

**And "automatically invoices them" wants one line drawn: DRAFT, NEVER SEND.**
An invoice raised the moment a night ends, pre-filled with the venue, the date
and the usual fee, and sitting there waiting for one press — that is the whole
value and it is safe. One that goes out on its own is the version that goes
wrong in public: the night that was cancelled, the rate that changed last
month, the headcount that was wrong. Same rule as `reply-draft.js`, which
drafts and never sends, and for the same reason.

**This is also what would build "Your calendar"**, which is on Bronze and
currently reads *"Not built yet"* — the same unbuilt-feature-on-a-tier problem
noted for streaming. Saved venues with usual nights IS the calendar, so this
chain closes that honestly rather than by deleting the line.

**DONE.** The venues' usual nights are projected four weeks forward as
**Coming up**, at the top of a **Gigs** tab that also holds Past gigs — one
tab, because a booked night and a run night are the same object at two points
in its life. One-offs and nights off are typed; everything else derives itself,
so there is nothing to keep up. `FEATURES.CALENDAR` is off the not-built list
and its blurb says what it does. Invoices deliberately stayed a tab of its own
— see CLAUDE.md for the line, and note that `Invoice this` on a past night is
what keeps the booked → run → billed chain one press at each step.

#### The quizmaster's own DRAFT-READ-SEND list, in order of value

The principle is now in CLAUDE.md ("the same rule points at the quizmaster's
admin"). What it actually means to build, cheapest and most valuable first —
and note that **the first three all wait on the same prerequisite**, which is a
night knowing its venue:

> **THE PREREQUISITE IS BUILT.** `state.venue` landed on 14 August 2026 — a
> plain name chosen at launch, carried onto `results()` and into the archive,
> with `venuesUsed()` offering back every venue this room has played. Free
> text, so it needed no venue accounts, no groups and no payment processor.
> **Everything below is now unblocked and none of it is built.**

1. **The invoice, drafted when the night ends.** Venue, date and usual fee are
   all known the moment the game finishes, so this is a draft that writes
   itself and waits. Ninety per cent built already — `saveCustomer` holds the
   fee, `invoices.js` holds the book. **Needs: venue on a night.**
2. **The post-night report to the venue** — how many played, the photos, "same
   time next month?". This is the item already at the top of the SELL list, and
   it is the one that wins the REBOOKING rather than the one that gets you
   paid. **Needs: venue on a night.**
3. ~~**The chase.**~~ **DONE.** An invoice past its terms grows a **Chase it**
   that drafts a polite nudge with the PDF attached, and the Invoices badge
   turns red rather than gaining a second badge beside it. The words threaten
   nothing and give them the out, because the usual reason an invoice is unpaid
   is that somebody forgot — and a stiff letter costs next month's booking to
   get the money a week earlier.

   **Built alongside it, and not on this list because nobody had thought of
   it: NIGHTS YOU HAVE NOT BILLED.** The archive knew every night and the
   invoice book knew every invoice and the two never spoke, so the nights that
   were played and never invoiced were uncounted — money left on the table. A
   past night now carries "Not invoiced" and the count rides on the library
   payload. That is item 1 below approached from the other end: instead of
   drafting an invoice nobody asked for, it says which ones are missing.
4. **A reply to a booking enquiry**, once enquiries arrive through the app at
   all — which waits on the directory.
5. **A caption for the night's photos**, for the Instagram direction. Drafted
   and copied, never posted: posting needs a Business account and Meta review,
   and the honest version is a caption in the clipboard.

**One and two are the same job done twice**, so build them together: the night
ends, and there is an invoice and a thank-you sitting there, each one press
from going. That is "bill them before you leave the car park" and "get asked
back" in one screen.

#### LINKED ACCOUNTS — and "concurrently" is three things, one of them fatal

The host: *"You could have a link accounts feature. If the venue has an account
and the quizmaster has an account, you could have linked accounts that then run
concurrently throughout the evening for that purpose."*

Right, and the word doing the work is "concurrently". It can mean three things
and they are not the same feature:

**1. BOTH CREDITED — the attribution above.** The link is a label applied at
launch; the outputs land on both pages afterwards. Safe, cheap, and already
designed. This is the floor and it is most of the value.

**2. THE VENUE WATCHES, LIVE.** Their console shows the night happening —
"38 in", the photos arriving, which round it is — from behind the bar, without
having to ask the person on the microphone. **This is the good version of
"concurrently"** and it is genuinely useful: a landlord wanting to know whether
tonight is busy currently has to walk over and interrupt. It is also cheap,
because a read-only view of a live game is a thing this app already has three
of.

**3. BOTH DRIVE. DO NOT BUILD THIS.** Two accounts with a Next button on one
game is precisely the failure this file already records under *"a shared login
can end somebody else's night"* — except deliberate, and across two businesses
who will blame each other. The rule stands and it is one of the oldest here:
**ONE PLACE THAT MOVES A QUIZ, and it is the control view.** A linked venue
account watches; it never drives. That has to be built in rather than agreed
informally, because the whole point of linking is that both parties feel
entitled to the night.

So: **build 1, then 2, and refuse 3 by construction** — the venue's live view
should have no host actions available to it at all, in the payload, not merely
undrawn on the page.

#### A LINK NEEDS BOTH SIDES TO AGREE, and that is easy to retrofit badly

Dave must not be able to attach his night to the Dog and Duck's account on his
own say-so, and the Dog and Duck must not be able to claim Dave hosted for
them. Unchecked, both directions pollute two histories with something that did
not happen — and once there is a directory, "I have hosted at forty venues" is
a REPUTATION CLAIM rather than a note, which makes an unverified one worth
something to somebody.

The cheap shape: an invite from either side and an accept from the other,
exactly like support access — theirs to grant, and visible. **Free-text venues
need no consent at all**, because nothing lands on anybody else's page; consent
is only the price of the link, which is what makes the honest version cheap and
the false claim impossible.

Two kinds of link, and they are not the same thing:

- **A STANDING link** — "Dave is our regular quizmaster". A convenience that
  pre-fills the per-night one, nothing more.
- **A PER-NIGHT attribution** — "Dave did the 14th". This is the one that is
  real, and the one Past gigs reads.

#### CAN HEAD OFFICE WATCH A VENUE'S NIGHT LIVE ON VIDEO? Technically yes. Do not.

Asked directly, and asked the right way — *"I don't know what the security
implications of that would be, but we have the technology, so I'm asking the
question."* The technology is not the constraint: a camera in the venue
publishes, head office subscribes, and the free tier covers it many times over.

**Four reasons not to, and the third is the one that would actually blow up.**

- **It is filming customers who have not been asked.** A live feed of a pub
  room is personal data — people's faces, and who they are out with. CCTV is
  lawful in a pub with signage and a stated purpose; **a quiz app streaming the
  room to head office is a different purpose that nobody in the room has been
  told about.** It needs a lawful basis, notices, and almost certainly an
  assessment, and it makes the venue a data controller for something they only
  agreed to as a quiz.
- **AUDIO IS WORSE THAN VIDEO, and a quiz feed would carry it.** Recording
  conversation is treated far more strictly than images, for the obvious
  reason: the table by the speaker is talking about their divorce, their
  health, or their manager. Most pub CCTV deliberately has no microphone. This
  would.
- **It is a camera pointed at the bar staff, and they will read it that way.**
  Head office watching a venue live is not really about the quiz — it is
  employee monitoring, which carries its own transparency and proportionality
  rules and is an industrial-relations problem before it is a legal one.
  **This is the one that ends the relationship with a venue**, and it would be
  the app's fault.
- **And it makes Quizporium the processor for all of it** — a data-protection
  agreement with every group, and the person who gets the complaint.

Two practical points on top: **a quiz night has no camera** (the host's laptop
faces the host, so this is a hardware install in somebody else's building), and
what would be on screen is a dark room where very little happens.

**WHAT HEAD OFFICE ACTUALLY WANTS IS NOT VIDEO.** The questions are "is it busy
tonight", "is it growing" and "is the quiz working here" — and **the numbers
answer those better than a picture does**, instantly, with no legal tail and no
camera. "38 in, up from 24 last week" is the product. That is the live view
already designed above, and it is a stronger feature than the video would be
rather than a consolation for it.

**The one video-shaped thing that is already safe is the PHOTO WALL**, because
people opt into it by taking a picture — consent by construction. Head office
seeing tonight's photos is fine and needs nothing new.

**And if a group genuinely wants eyes on a room, that is CCTV and they already
have it.** Nothing to do with a quiz app, and much better not to be the ones
providing it.

##### The version that IS worth building: a group NIGHT, announced

There is a legitimate live-video product hiding behind the question, and the
consent problem mostly disappears because it is an EVENT rather than
monitoring: **several venues in a group playing the same quiz on the same
night, seeing each other.** A group final, a Christmas league, four pubs on one
scoreboard. Everybody is told because it is the point of the evening, the
camera is aimed at a stage rather than at the room, and it is a reason for a
group to buy rather than a reason for a venue to resent them.

That is a real feature and it uses exactly the media layer already chosen. It
is also a long way down the list — it needs venue accounts, groups, the media
layer and a multi-room scoreboard, none of which exist.

#### One thing left open: who owns the PHOTOS of a shared night

Both should see them — they are pictures of that room on that evening. Less
obvious is who may take one DOWN: the host has the kill switch and the
per-photo bin because they are holding the microphone, and a venue might
reasonably want one of their own customers removed afterwards. Not urgent —
there is no venue account to ask yet — but decide it before one exists rather
than after somebody asks.


### The OWNER/QUIZMASTER shape is the group shape — and "owner" means two things

The host, and it is the most structural thing said about accounts so far:
*"I have an owner account and a quizmaster account. That's the same structure a
venue company would need for its HQ, and the same structure a quiz company
would need for its own QMs. I've got my owner account which tells me
everything, and they'd need owner accounts which wouldn't tell them anything
about my account, but would tell them everything about their quizmasters."*

**Exactly right, and the reason it looks so close is that the app already has a
parent-and-children tree. It just has one node hardcoded at the top.**

**THE WORD "OWNER" IS DOING TWO JOBS, and they have been the same job because
there has only ever been one of them:**

| | What it means | Scope |
|---|---|---|
| **The app owner** | runs Quizporium: writes the catalogue, sees the ledger, sets tiers, reads the inbox | **global** |
| **A group's admin** | runs a pub group or a quiz company: sees everything about THEIR accounts | **their group, and nothing else** |

Today those are one `role: 'owner'`, of which `accounts.create()` allows
exactly one. Splitting them is the actual work, and the split is what makes it
safe: **a group admin must be scoped by construction, never by a check.**

#### It is NOT a third role

Same argument as `kind`: a third entry in `ROLES` gives every permission check
in the app a case to get wrong, forever. A group admin is a QUIZMASTER who
manages a group — the flag lives on the group membership, not on the person.

- `ROLES` stays `['owner', 'quizmaster']`.
- A group has members, and one or more of them is its admin.
- **A group admin's request resolves to THEIR group and never takes a group id
  from the request** — the identical rule to `/api/host/*` taking no room
  parameter, which is what has kept one quizmaster out of another's night since
  rooms were built. It is the only version of this that cannot leak.

#### Most of the SCREEN already exists, and some of it deliberately does not

The owner page is nearly the group-admin page: **People** (their accounts,
tiers, support), **Tonight** (which of their venues is mid-question right now —
which is exactly the head-office live view asked for above, and needs no
camera). Those generalise as they stand, scoped.

**What a group admin must NOT get, and this is where "wouldn't tell them
anything about my account" is enforced:** the Catalogue tab (is what *I* write
worth writing), the AI spend ledger and the budget — those are the app's
business, not theirs — and the Inbox, which is people writing to the app owner.
So it is an overlapping page rather than the same one, and the overlap is
People and Tonight.

#### The hat switch generalises too, and is already built

A quiz company's manager who also hosts wants precisely what Mark has: an admin
hat and a quizmaster hat on one login, with no second password. That is
`ownedBy` plus `hatSwitch()`, both of which exist — what changes is that
`ownedBy` becomes a group relationship rather than a single hardcoded link.
**Do not build a second mechanism for it.**

#### And it answers the head-office question without a camera

"Tonight", scoped to a group, IS what a pub group wants: which venues are
running, how many are in each, right now. See the section above on why the
video version should not be built — this is the feature that request was
reaching for.


### A QUIZMASTER'S OWN PACKS STAY THEIRS INSIDE A COMPANY — and sharing is consented

The host, closing the account design: *"Head office are going to want that
sharing functionality, but also individual quizmasters need their IP guarded,
and that needs to be consent-driven."*

**This cuts against the group's main selling point, so it has to be resolved
rather than assumed.** The Group accounts section calls internal pack
distribution "the real win" — the company writes a quiz once and every host can
run it. Taken carelessly that means a company hoovering up whatever its hosts
write, which is the exact thing `own-packs.js` exists to prevent, one level
down.

**IT ONLY APPLIES TO PACKS THEY WROTE THEMSELVES**, which the host narrowed
correctly: *"If they buy packs from me then that should be shareable in the
group, that's fine. It's only if the QM writes a quiz to their own account that
they should be asked if they want to make it available to the group."*

**And CATALOGUE packs need no sharing mechanism at all** — which is simpler
still than "shareable". A seat gets everything, so every host in a company
already holds the whole catalogue **by entitlement**. There is nothing to pass
around and no consent to ask for: the author is the owner, they have been paid,
and each seat has its own licence.

So the three shelves resolve `own → company → catalogue`, and only the FIRST
has a consent question on it:

| Shelf | Who wrote it | How a seat gets it |
|---|---|---|
| **Their own** | the quizmaster | **theirs alone** unless they choose otherwise |
| **The company's** | the company, or a host who shared one | every seat, by being in the company |
| **The catalogue** | the owner | every seat already, by entitlement — nothing to share |

**NOTHING MOVES OFF THE FIRST SHELF WITHOUT THE AUTHOR DOING IT.** An explicit
"share this with the company" on their own pack card — one action, theirs, and
reversible. No automatic promotion, no "packs written on a company seat belong
to the company" rule, because that rule would be the app quietly taking a
position on somebody's employment terms.

#### The same action is what a MARKETPLACE needs — so build it once, later

The host's own connection, and it is the reason not to build a company-only
version: *"if we're going to have a marketplace where people can sell their own
quiz packs, they're going to need to be able to share on their say-so anyway."*

Quite — **"the author releases this pack" is one action with two
destinations**: to their company, or to the shop. Same consent, same record of
who released what and when, same undo. A company-only sharing button built now
would be half of it and would have to be unpicked.

**NOT NOW.** It needs neither the group nor the marketplace to exist yet, and
building it before either would be guessing at both. When it lands it is one
mechanism with a destination, never two buttons.

**And the app must NOT try to answer who owns a pack written while employed.**
That is a work-for-hire question between them and their employer, it varies by
contract, and an app that decides it silently will be wrong for somebody in a
way that costs them. What the app does instead is **record what was shared and
by whom**, and let the two humans disagree with the facts in front of them.

**A parent cannot read a child's own packs either.** The owner-cannot-read-your-
packs guarantee applies one level down, unchanged and for the same reason: the
only way in is the support door the CHILD opens, which expires and writes down
what was looked at. A pub group reading its venues' data is fine — that is
their own trading information. A quiz company reading its hosts' unshared
quizzes is not.


### PRICING A PARENT: don't. The seats are the product.

The host, thinking it through out loud and arriving at a real tension: *"If Rob
has a quiz company he's going to need a parent account AND a Gold account, and
he's not going to want to pay £50 a month for essentially the same
functionality… so the parent should probably be free, or a lower rate, because
the quiz account is where the value is. Maybe Gold automatically has
sub-accounts. But then it wouldn't make sense for two or three quizmasters to
have Gold within a company, and I want to keep that upsell."*

**The instinct is right and the tension dissolves, because the seat design
below already answers it — as long as the PARENT is not a thing you sell.**

#### 1. A parent is a container. Charging for it charges somebody for the privilege of paying you more.

£50 for "Gold plus the right to have staff" reads as a penalty for growing,
which is the opposite of what it is. **Make it free.** It costs nothing to run
— it is a row in a file — and under the house rule that decides tiers, nothing
that costs nothing per use has to be paid for.

#### 2. But "the parent can't do anything" is not true, and the difference matters

It has no quiz controls, which is what the host meant. What it DOES have is the
thing that makes a company want one at all: **internal pack distribution** —
the company writes a quiz once and every host can run it, which the Group
accounts section below already calls "the real win". Plus one bill instead of
six, and the stats across hosts.

That is why the seat discount is affordable: **the parent is not being given
away, it is being used to sell more seats.**

#### 3. Nobody inside a company buys Gold. They buy SEATS — and that ends the confusion

This is the part that dissolves the worry about "two or three quizmasters on
Gold". **A seat gets EVERYTHING** (already settled below, and this is the
second reason for it): there is no tier inside a company, so nobody has to
decide which host is on which rung, and nobody has a worse night than the host
next to them.

| | | |
|---|---|---|
| Three hosts, three solo Golds | £90 | what they will not do |
| Three hosts, three seats at £20 | **£60** | one bill, shared packs, everybody has everything |
| **What actually happens without seats** | **£30** | one Gold, three people sharing a login — which this file already records as ending somebody's night mid-question |

**The £30 "lost" against three Golds is not lost, because three Golds was never
the alternative.** The real alternative is a shared login, which earns a third
as much AND breaks nights.

#### 4. So the upsell is not Bronze → Gold. It is SOLO → GROUP.

That is the answer to "I want to keep that upsell": it still exists, it is just
a different axis. It fires the day somebody hires a second host — which is
exactly when they can afford it and exactly when a shared login would otherwise
start costing them nights.

#### 5. THE HOLE TO CLOSE: a company of one

At £20 a seat with solo Gold at £30, a single quizmaster forms a "company" of
one and buys Gold for £20. **Minimum two seats**, or price the seat at £25 and
keep the discount smaller. The first is cleaner: a company of one is not a
company, and saying so needs no arithmetic.


### Group accounts — SEATS on a Gold, for a quizmaster company

> **It serves a SECOND market that was not designed for, and that is a feature
> rather than a coincidence — see "What if venues run it themselves?" below.**

Your idea, and the interesting half of it is not the discount.

Rob runs a company (Interrupt the Routine) with more than one host. Today his
only options are three separate Gold accounts at £90 a month, or one account
shared between three people — and the second one breaks a night, badly, see
**A shared login can end somebody else's night** below.

**The real win is INTERNAL PACK DISTRIBUTION, and it dissolves the objection
that blocked pack sharing.** CLAUDE.md says a quizmaster cannot share a pack
with another quizmaster because "anything better needs a story about who owns
the copy afterwards". A company IS that story. Between two independent
quizmasters ownership is ambiguous; inside one company it is not — the company
owns it, and nobody has to agree on anything. So the company writes a quiz once
and every host can run it, in the app, without it ever leaving the company or
passing through the owner.

**Settled, after a long argument about the price. £20 a seat, all-in.**

- **A seat gets EVERYTHING**, not the company's tier passed down. "Every seat
  gets the lot, £20" is a price rather than a rule you have to explain, and it
  is what makes the company pitch true — every host can run this week's topical
  quiz. The only exception is **streaming**, which stays out because egress is
  the one genuinely per-use cost and it scales per head; price it per seat when
  it exists.
- **Per-seat tiers were considered and rejected.** Letting a company buy a
  Bronze seat for a part-timer is attractive — the upsell would then run per
  head, forever — but it breaks on how the work actually flows. **The cheapest
  seat is always the cover host, and the cover host is the person who needs the
  widest library at the shortest notice.** It also makes "every one of our
  hosts runs a current quiz this week" untrue for the cheap seats, which is the
  pitch the whole thing is meant to sell. £3 a month of extra revenue, three
  SKUs to build, and it undermines its own product.
- **A usage-capped "part time" seat was considered and rejected too.** Gold
  functionality at a Bronze price with a limit on nights per month. The fatal
  version is the obvious one: a cap that REFUSES is this codebase's first rule
  broken at the worst possible moment — the cover host, at the venue, on night
  five of four, with sixty people in. The only safe version bills rather than
  blocks, and then it needs a definition of "a night" that survives a crash, a
  redeploy and a quiz-then-bingo evening (a distinct calendar day with at least
  five players joined is the one that would hold), plus variable billing, which
  is strictly harder than the fixed subscriptions that do not exist yet. **The
  trigger to build it: a company tells you they are keeping a host off the
  books because of the price.** Until then it is a solution looking for its
  problem.

#### Why £20 rather than £15 or £10

The number moved twice during the argument, so the reasoning is worth keeping.

**£10 is the only one that is clearly wrong**, and it is arithmetic: for the
seat route to stay dearer than everybody buying Silver separately, a seat has
to cost more than `(20N - 30) / (N-1)` — **£10 at two hosts, £15 at three,
£17.50 at five.** So £10 breaks at the commonest company size, and £20 is the
only price where a seat never undercuts a tier at any headcount. The ladder
then reads cleanly: *a seat is cheaper than a Gold account and dearer than a
Silver one.*

Two arguments that are not arithmetic and still hold:

- **Your cheapest SKU becomes your reference price.** Price a whole working
  quizmaster at £10 and "£10 a head" is what your app costs, whatever the
  website says. That number travels between quizmasters and is very hard to
  walk back.
- **Support is the one genuinely per-seat cost.** Compute and content are
  free at the margin; people are not. Twenty companies at three hosts is sixty
  people who can email you.

And the host's own argument, which is what settled it: **Gold-plus-a-seat is
better value than two Silvers at the same money, which means the price was too
low, not that Silver was being cannibalised.** The revenue is identical either
way (£40 for two people) — so there was never a loss to protect against, and
the right response to "my product beats the alternative at the same price" is
to charge more of the difference.

#### What a seat gets that a separate Silver account does not

The table that actually sells one. Same price, £20 either way:

| | Gold seat | Individual Silver |
|---|---|---|
| Whole evergreen catalogue | yes | yes |
| **The weekly topical quizzes** | **yes** | no |
| **The company's own shared packs** | **yes** | no |
| **Invoicing the company directly** | **yes** (see below) | no |
| Own room, join code, photo wall, branding | yes | yes |
| Packs they write themselves | yes | yes |
| Invoicing, calendar | yes | yes (Bronze now) |
| Advert slides | yes | yes |
| Streaming | no | no |

**Two added, nothing taken away** — and it holds even for a company that writes
nothing of its own, because the seat still carries the topical quizzes, which
is £10 of Gold content at a Silver price.

**What a separate account gives instead is not a feature, it is OWNERSHIP.** It
is theirs: they keep it if they leave, with their packs, their venue history,
their play counts, their invoice book and the join code printed on somebody's
QR card. A seat is revocable by the company the afternoon somebody leaves —
which is exactly why the company wants one and why a genuinely freelance host
might not. When a host insists on independence the answer is "buy your own",
which is a sale either way.

A seat's OWN packs stay private from the company head too, because a seat is a
room and no route takes a room parameter. Keep that: it means contributing to
the company library is a deliberate act rather than a default.

**Edge case worth a line:** a freelancer hosting for two companies needs their
own account or two seats. Two seats works — a seat is an account — it is just
slightly clunky.

#### The shape that keeps the privacy promise structural

This is the part to get right, because it is the first thing that could put a
hole in a guarantee that currently holds by construction rather than by a
check. Today the owner cannot read a quizmaster's packs because a room's packs
live in that room's folder and **no route takes a room parameter**.

So: a company gets its own folder, `packs/<companyId>/`, and resolution goes
**own → company → catalogue**. A seat reads its own folder and its company's.
The owner is not a member of any company, resolves against the house room, and
finds nothing — exactly as now. Do NOT implement this as "which accounts may
read this pack", which is a permission somebody has to remember to write and
therefore a permission somebody will eventually forget.

**The company account writes; seats read.** Same relationship the app already
has between the owner and a subscriber, and it keeps "three people editing them
is how a house style stops being one" true inside a company as well as outside.

#### What a seat still gets on its own

- **Its own room** — its own game, join code, photo wall, state file, and its
  own name and colours on the projector. That already works; a room is a room.
- **Its own suggestion box.** Settled: a seat raises tickets like anybody else,
  for the same reason a Bronze or a Silver does — *"they might have sub-account
  specific frustrations that I can't see"*. Sending is already open to anybody
  signed in and not gated on a tier, so this needs nothing new; do not gate it
  to the company account.

#### Still to decide — two that could bite, three that just need writing down

- **Whose invoice book is whose, and it now contradicts itself.** "The invoice
  book belongs to the company" was settled early; then "a seat invoices the
  company directly" became one of the three things a seat is worth. Both cannot
  be true as stated — a seat billing the company needs a book of its own.
  Probably: the company holds one for billing venues, each seat holds one for
  billing the company. **Note this is a DESIGN, not a feature — it does not
  exist, and it should not go in a sales sentence until it does.**
- **What happens to a seat's own packs when the seat is switched off.** They
  live in that host's room. Does the room survive? Does the person keep their
  own material? "The company revoked my seat and I lost six months of my own
  writing" is a support conversation you only want to have never.
- **Whose support door opens the company folder?** Per account today. Probably
  the company owner's.
- The company head is a working host with their own room. Assumed throughout.
- The company account writes the shared folder; seats read it. Same shape as
  owner-and-subscriber, and it keeps "three people editing them is how a house
  style stops being one" true inside a company as well as outside.
- No seat limit.

#### Why not now — and the useful thing about that

Rob has no login yet, so this is a hypothesis about a customer who has not used
it. `PACKS_REPO` is still not configured, which makes step **B2** above
load-bearing rather than optional the moment anything is shared.

**But seats do NOT need PayPal, and that is worth knowing.** A seat is an
account with a company on it — creatable by hand today. So a company account
could be sold to Rob manually and invoiced **using the app's own invoicing
feature**, and the whole hypothesis tested, with no payment processor in
existence. The only real code is the company folder and own → company →
catalogue resolution.

The order that actually matters:

1. ~~The launch-collision guard~~ — **done**, see below.
2. `PACKS_REPO` — your ten minutes, step B2.
3. **Rob gets a login.** You have never had a second real user, and everything
   here is guesswork until then.
4. ~~The eight starter packs~~ — **done**, 20 August 2026. See
   [`plumbing.md`](plumbing.md).
5. Company accounts and shared packs.


### "What if venues just run it themselves?" — raised, answered, do not re-litigate

Put to the host by somebody outside the project on 12 August 2026: sell software
to quizmasters and venues will notice it and cut the quizmaster out. **His
answer was that he does not mind, and he is right — but the reasons are worth
having written down, because it is the sort of objection that comes back.**

**THE APP WAS NEVER THE MOAT.** This file's first section says it: he is hired
as the ENTERTAINER, never the organiser. A venue that wanted to run its own quiz
could always have done it with a printed sheet and a biro; they hire somebody
because they do not want to be the one holding a room for two hours. Nothing
shipped here changes that calculation.

**The real version of the worry is much milder than the one put to him.** It is
not "venues replace quizmasters" — it is "a venue already running its own quiz
badly now runs it well", which raises the floor that a WEAK quizmaster competes
against. That is pressure on the bottom of the market and none at all on people
who are actually good, which pushes bookings toward the quizmasters worth
booking. Those are the ones who pay for this.

**And a chain is a BETTER customer than an individual on nearly every axis.**
One sale, one relationship, one invoice, ten rooms — and **far lower churn**,
because a pub chain does not quit the business the way somebody with a side
hustle does. Ten venues at Bronze is £100 a month from one conversation.

**It works structurally TODAY with no changes at all.** A room per account means
each venue already gets its own join code, state file, photo wall, invoice book,
archive and advert slides, and no route takes a room parameter, so one venue
cannot reach another's night. The multi-tenancy built for a second quizmaster
turns out to be exactly what a chain needs. The only gap is ONE BILL FOR TEN
ACCOUNTS, which is Group accounts above — along with the company pack folder,
so head office writes a quiz and all ten venues have it.

**Two things to expect before a chain ever signs:**

- **THEY WILL WANT THEIR OWN BRANDING, and a quizmaster does not.** Mark is
  happy being "Mark's Quizporium" because he IS the brand; a pub chain wants
  "Greene King Quiz Night" and may not want the app's name on their projector at
  all. That is white-labelling, listed in CLAUDE.md as deliberately not built,
  and it is a bigger job than seats. It will be the first thing they ask for.
- **A chain is probably underpriced per room.** They get more from it than ten
  individual quizmasters would — a business with a marketing budget rather than
  one person with a laptop. Per-room stays simple and is not metering, so the
  anti-metering rule holds; this is a fine problem to have and one to solve with
  a chain actually on the phone, not in advance.
