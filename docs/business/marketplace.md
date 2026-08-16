# The marketplace, referrals, and the pack shop

Other people writing packs you resell, and quizmasters bringing quizmasters —
the two ways the catalogue and the subscriber list grow without you.

**Parked strategy — nothing here is scheduled.** Part of
[`../business.md`](../business.md), which is the index. It moved out on 16
August 2026 because that file had reached 170KB with 89% of it under a single
heading, and a session opening it for one answer was paying for all of it.

---

### A marketplace: quizmasters write, you resell, they earn credit

> **PARKED, AND DELIBERATELY SO. Not structural, not foundational, and quite
> possibly never built.** Nothing else in this app waits on it and nothing else
> is shaped around it — the data model already supports it either way, because
> whether a pack id lands in an account's `packs` because of a tier or because
> somebody bought it is one line. It needs the payment processor first, and it
> needs enough subscribers that a shop is not empty. **Do not build any of it
> ahead of demand, and do not let it influence a decision about anything else.**
> It is written up at this length because the thinking was done and thinking is
> the expensive part — not because it is queued.

Your idea, and a good one. A subscriber who enjoys writing submits a pack, you
sell it in the catalogue, they get 50% as **credit against their account**
rather than money. Written up here rather than built, because two of the
questions below have to be answered before a line of code.

**The real win is not free content — it is that your time changes job.** The
catalogue has to keep growing or Silver stops being worth paying for, and today
that is your writing hours forever. This does not remove the editorial step and
must not: a badly written pack in your catalogue reflects on YOUR app, because
the buyer sees a Quizporium pack, not Rob's pack. But **reading three packs
through is far quicker than writing three**, and the read-through machinery
already exists — the review flags, the tickable warnings, the answer-balance
check. So the job becomes "read it, tick the flags, press Accept".

**Credit rather than cash is the right call and worth protecting.** No payouts,
no bank details, no minimum thresholds, no self-assessment questions, no
processor fees on the way out. Credit is a discount on something they already
buy. The moment it becomes money it becomes a finance function.

**Be honest about the size of it.** At £3 a pack and a 50% share, a sale is
£1.50 — so seven sales covers a month of Bronze and fourteen covers Silver. On
a subscriber base of thirty, a good pack might sell a handful of times. That is
**a discount for people who enjoy writing, not a side income**, and pitching it
as the second would disappoint everybody. Pitched as the first it is a genuinely
nice thing to offer.

**Two things to settle BEFORE building anything:**

1. **A one-page agreement.** Who owns the pack once it has sold; whether they
   can sell it elsewhere too (non-exclusive is the sensible answer); what
   happens to it in the catalogue if they leave; and the author warranting it
   is their own work and not copied out of somebody else's quiz. This is a page,
   not a legal project — but the first dispute is unanswerable without it, and
   the first dispute always comes after the money has moved.
2. **What happens to credit if they cancel.** Answer it up front rather than
   the day somebody asks. Rolling over is simplest; letting credit buy PACKS as
   well as subscription time is nicer, because it closes the loop and gives
   somebody who earns more than their subscription costs somewhere to spend it.

**Then the build, and it needs the shop taking money first** — credit is
meaningless until there are purchases to discount.

- **A credit ledger, not a number on an account.** Same rules as the invoice
  book: integer pence, never a float, entries never rewritten. "You have £6" is
  not enough; the first time somebody queries their balance you need to show
  them the four sales it came from.
- **Submitting is publishing, and the page has to say so unmistakably.** Today
  the strongest promise this app makes a subscriber is that you cannot read
  their packs. Submitting one is them opening that door deliberately, which is
  consistent — but it cannot be a button they press by accident, and it cannot
  be quietly undoable, because by then you have read it.
- **Credit the author, and give them their own SECTION and TAG.** Settled.
  It does two jobs at once: the author gets the credit, and a "written by
  quizmasters" shelf keeps your own house style a distinct thing rather than
  something that quietly dilutes as the catalogue fills up. A buyer knows what
  they are getting, which protects you — and your read-through is still what
  puts a pack on that shelf at all, so the quality guarantee is unchanged.
  Same shape as the **Yours** tag on a subscriber's own packs, and the shop
  grid already splits into sections, so neither is new machinery.

One thing it quietly fixes later: if topical content is what sells Silver, other
people writing topical rounds — for their own regions, their own crowds — is
worth more than one person can produce.

#### Revisited 12 August 2026 — the pricing, and the bug in it

Raised again with a specific shape: **Bronze pays the full £3, Silver and Gold
pay half, and the owner takes no cut on a discounted sale** — the reasoning
being that a subscriber is already paying, so taking a second bite is
double-dipping.

**The tiered price is right and should be kept.** It is a reason to climb the
ladder that does not rot as the shelf grows, and it answers the objection that
a marketplace erodes Silver: Silver stops being "everything included" and
becomes "my catalogue included, everything else half price", which is honest,
sayable, and still worth £20.

**But "no cut from subscribers" as stated means the WRITER funds the discount.**
At a 50% share, Rob keeps £1.50 from a Bronze sale and £0.75 from a Silver one —
so he earns half as much from the buyer the owner is working hardest to create,
over a pricing decision he had no say in and cannot see. It degrades as the
business succeeds: the better the upsell works, the less writers earn per sale.
A good writer works that out, and the programme is then hard to defend.

**Fix: fix the WRITER's amount per sale and let the owner's cut absorb the
discount.** Rob gets the same whoever buys; Bronze leaves the owner a margin,
Silver leaves none. That is exactly the intent — no second bite from a
subscriber — with the arithmetic pointed the right way.

| Buyer | Pays | Owner keeps | Writer keeps |
|---|---|---|---|
| Bronze | £3.00 | £1.50 | £1.50 |
| Silver / Gold | £1.50 | £0.00 | £1.50 |

**And note what per-sale accounting did within two messages of being proposed:
it produced a fairness rule that had to be decided.** Next are co-authors,
withdrawal, a Christmas discount, and a ledger that has to stay right for people
who have left. **A flat fee per ACCEPTED PACK avoids all of it** — pricing stays
entirely the owner's business, the writer has certainty on the day they press
Release, and there is nothing to maintain. At this scale the difference is
pocket change: a pack selling twenty copies is £30. Start flat; revisit per-sale
only if a writer asks for the upside.

**Credit versus cash is a SEPARATE axis from flat versus per-sale**, and the
argument for credit above still stands — no payouts, no bank details, no
self-assessment, no processor fees outbound. Its one limit is saturation: a
prolific writer earns more credit than their subscription costs and it stops
motivating. So: **credit first, cash only when somebody actually saturates**,
which defers the finance function until there is evidence it is needed.

**PRIVATE BY DEFAULT, RELEASED ONLY BY THE AUTHOR — and that framing is the
best part of the proposal.** A quizmaster writes for themselves and keeps the
lot; releasing a pack is a deliberate act by the person who wrote it. This does
not weaken the structural privacy at all (no route takes a room parameter, so
no id reaches another room's folder) — it adds a door the author opens from
their own side, which is the same shape as support access.

Two things to say at the button rather than in terms:

- **Release is one-way, and it goes to competitors.** A released pack is sold to
  every subscriber, including quizmasters working the same towns. That has to be
  on screen at the moment of pressing, not buried.
- **Once accepted it cannot be quietly withdrawn**, because by then it has been
  read and possibly bought.

**A company account is a DIFFERENT FEATURE and was bundled into the same
sentence.** "£70 a month, two sub-accounts" is seats and shared billing — see
**Group accounts** below, which already has the resolution order worked out. It
touches billing and therefore the unbuilt payment processor. **The writer
programme touches none of that**: the money flows OUT, which is a bank transfer
against an invoice, and the invoicing already exists. So the writer programme is
buildable first and independently. Rob can be a solo Gold subscriber and still
write for the catalogue.

On the £70 itself: two seats at £35 against two Golds at £60 charges £10 for the
company layer. Arithmetically fine, thin as a pitch on its own — revisit once it
is known what a two-person quiz company actually wants shared.

**The ratio to keep an eye on.** Half price fixes most of the Silver erosion but
not all of it. If quizmaster-written packs ever substantially outnumber the
owner's own, a Silver subscriber is looking at a shelf where most things still
cost money. Reword the Silver pitch before somebody notices, not after.

#### And that is what turns the marketplace from a THREAT to Silver into a LEVER

The thing the tiered price actually buys, and it is worth more than the margin:
**the dynamics reverse.** Priced flat, every pack added to the marketplace made
Silver slightly worse — the shelf grew and the included share shrank, so the
tier's pitch decayed on its own while the feature succeeded. Priced at half for
subscribers, every pack added makes Silver slightly BETTER, because there is
more on the shelf at half price. Marketplace growth and Silver's pitch now point
the same way, which means the marketplace can get as big as it likes without the
ladder having to be rewritten.

**Be precise about the size of it, because it is easy to oversell.** Bronze is
`10 + 3n`, Silver is `20 + 1.5n`, so the discount alone breaks even at **n ≈ 7
packs a month** — which nobody buys. The upgrade case is still carried by the
INCLUDED CATALOGUE; the marketplace discount is a top-up to it, never a
replacement for it. Do not lean the sales page on the wrong half.

**A structural side effect worth keeping.** At Silver the owner's own packs are
free and marketplace packs are £1.50, so a subscriber's default is always the
house catalogue and the marketplace is the long tail they reach for when it has
not got the thing. The house style stays the centre of gravity and the margin
stays on the packs the owner already owns.

**And the two rules are one rule.** "No second bite from somebody already paying
a subscription" and "make the marketplace a reason to climb" are the same lever
seen from two ends: the bigger the pass-through to subscribers, the stronger the
upgrade incentive. Anything that claws back a cut from a Silver sale weakens
both at once.


### Referrals: a quizmaster brings a quizmaster, and keeps 20% for as long as they stay

> **PARKED like the marketplace. Blocked on the payment processor** — a
> recurring discount needs billing. Nothing waits on it. Written up because the
> thinking is done, not because it is queued.

Raised 12 August 2026. A subscriber refers another; **20% of what the new member
pays comes off the referrer's own bill every month, for as long as they stay.**
Gold at £30 refers a Silver at £20 → £4 a month off. They cancel, it stops.

**Recurring rather than a one-off bounty, and that is the load-bearing choice.**
A bounty pays for the introduction; this pays for them STAYING, so the referrer
keeps an interest in their mate being happy and supported. That is informal
advocacy no signup fee ever buys.

**The arithmetic is cheap.** Gold referring a Silver nets £46 instead of £50 —
8% of combined revenue, for an acquisition that would otherwise cost advertising
money whether it worked or not. And nothing is paid until somebody actually
subscribes.

**NO CAP, and somebody using the app free is a good outcome, not a leak.** The
host's own call and it is right: a member who has referred eight people costs
£30 a month and brings in £160. Most schemes get squeamish here and cap it,
which kills the incentive exactly where it is working.

**Four rules, and each closes a specific failure:**

1. **It floors at ZERO and never goes negative.** The moment a balance can go
   below zero it is a payout — bank details, thresholds, self-assessment, the
   whole finance function avoided everywhere else. Overflow becomes CREDIT
   instead (below).
2. **SINGLE LEVEL.** A refers B, A earns from B, and that is the end of the
   loop — A gets nothing from anybody B refers. Written down explicitly because
   "20% of what the new member pays" can be misread as compounding, and a
   multi-level scheme is a different and much uglier thing to be running.
3. **A MONTH IN ARREARS.** 20% of a payment RECEIVED is credited against next
   month's bill, so the discount is only ever backed by money already banked. A
   failed card, a refund or a mate who cancels on the third can never leave the
   owner having discounted against revenue that never arrived. It kills the
   clawback case, which is what makes most referral schemes horrible to run —
   same instinct as the invoice counter being rebuilt rather than trusted.
   **The page has to SAY "next month"**, or somebody who signed a mate up on
   the 2nd reads an unchanged bill as broken.
4. **DERIVE the discount, never store it.** It is 20% of what that member pays
   right now, so a Silver→Bronze downgrade takes £4 to £2 on its own. Stored, it
   goes quietly stale.

**Self-referral needs no rule at all**: 20% of X always costs X, so a fake
second account is unprofitable by construction. It is the first objection
anybody raises and the answer is arithmetic.

**Overflow is ONE BALANCE against whatever the account owes — subscription
first, then packs — not packs only.** Packs-only was the first shape and it is
worth least to the person who earns most: overflow is only reachable by somebody
who has zeroed a Gold bill, and Gold already includes the whole catalogue, so
their credit could buy nothing but marketplace packs — which do not exist, may
never, and are half price to them anyway. One balance is never worthless
whatever tier they are on, and it **self-smooths across churn**: a referral drops
off in March, the bill goes back up, and the balance covers the gap instead of a
nasty month. It is also the SAME LEDGER as the writer credit — one balance, two
ways to earn, one thing to build and one thing to explain.

**ONE-SIDED, and that was decided rather than left out.** A two-sided version
was proposed — give the new member a discount too, so the pitch reads generous
rather than self-interested — and turned down, because **the free trial already
does that job better**. Two overlapping offers is two things to explain doing
one thing, and a signup discount anchors them low so the first full bill reads
as a price rise. See the trial's shape in CLAUDE.md under "no free tier": one
month, free, card up front.

So the referrer's pitch is *"try it free for a month"*, which is a better
sentence to say to a mate than *"use my code and we both save a fiver"* — and
the referrer's 20% is the engine while the trial is what removes the newcomer's
risk. Two mechanisms, two jobs, no overlap.

**THE REFERRER'S CLOCK STARTS WHEN THE TRIAL CONVERTS**, and the page has to
say so — *"you will start earning when Rob's trial ends"*. A trial pays nothing,
so 20% of it is nothing, and a referrer watching £0 for a month with no
explanation concludes the scheme is broken.

**Making the trial half price to fix that was proposed and does not survive the
arithmetic.** On a member who stays two years the referrer earns £92 with a free
trial and £94 with a half-price one — £2 over a lifetime, which nobody notices
and nobody calculates. What half price actually does is put £10 in the OWNER's
pocket during the trial, which is a fair thing to want but is a revenue argument
rather than a referral one, and it loses *free* — the strongest word the
referrer has — to buy it.

**THE TRIAL IS AT BRONZE, and it works because of a decision already made
elsewhere: the tier lever is CONTENT, not capability.** Every control, every
round type and every look is Bronze's, so a trial shows the whole machine with
nothing greyed out and nothing looking broken. Had the lever been put on
features, a trial would be a crippled demo and none of this would work.

**But the upgrade will NOT come from running out, and it is worth being right
about why.** Bronze is eight packs and a weekly host runs four nights a month,
so the content ceiling is designed to bite around month four — never inside a
trial. What actually drives an upgrade in week two is the SHOP: padlocked cards
with titles and prices under their own library, and the topical packs visible as
the thing Gold has. That is already built and is doing exactly this job.

**Upgrading mid-trial ENDS the trial and starts billing.** They have chosen to
buy, so taking the money then is honest, and it avoids inventing a
free-Silver-trial state that nothing else in the app understands.

Which closes the loop, and it is the reason the recurring model was chosen in
the first place: they upgrade early → the owner is paid earlier → the referrer
starts earning earlier → **and earns £4 rather than £2, because it is 20% of
what they ACTUALLY pay.** So the referrer has a standing interest in their mate
getting on well with the app and moving up the ladder.

**Three lines are what the referrer has to be told, and no more** — house style,
say what it is:

> **You earn when they start paying** — not during their free month.
> **20% of whatever they pay**, every month.
> **It stops if they leave.**

**Attribution is a CODE, not "who told you about us?"** on a signup form — that
last one is unverifiable and generates disputes, which is a Monday job. The code
alphabet in `rooms.js` already leaves out vowels and O/0/I/1/L so no code can
spell a word or be mistyped off a screen.

**It passes the Monday test cleanly**, which is more than most of what has been
floated here: a code, an attribution at signup, an automatic discount. No pile
for anybody to work.


### The pack shop — ✅ THE WINDOW IS BUILT, the money is not

**£3 a pack, and the shop is on the console now** — a pack outside their
library shows as a dashed card with its size and its price, under a heading
saying how many more there are and what Silver would include. **Buy takes no
money and says so.** Go and look at it wearing the hat on Bronze; whether it
reads as fair or as grabby is a wording-and-layout judgement, and it is much
cheaper to change now than after PayPal is wired.

Building it closed a hole worth knowing about: reading a pack you did not hold
was never refused, only launching one — so a starter library could have been
worked around by opening the other packs and copying the questions out. Shut
now, with a test.

Still to do, and it is the money half:

Settled: **£3 a pack** is the recommendation and the reasoning is in CLAUDE.md
under "What a pack costs" — below £2.50 a weekly host never has a reason to
climb to Silver, so the ladder stops being one. Not final; it is one number.

**Gold must be marked as not yet available when this goes in.** Gold is the
online/streaming tier and streaming is not built, so a Gold subscription today
buys Silver at a £10 markup.

What it needs, none of it built:

- A PayPal subscription plan per tier, and one for a pack purchase. Use
  **separate plan ids** from the kids' party business so the two stay apart in
  PayPal's own reporting rather than needing separating afterwards.
- A webhook endpoint. The app already stores a customer reference and a status
  and expects to be told — see "Payments stay processor-agnostic" below. Card
  details must never reach this server.
- A purchase writes the pack id into `packs` on the account, which already
  beats the tier. That is the one-line part.

Worth doing the SHAPE first, with no money in it: a pack card marked not-yours
with a price on it and Launch greyed. Half a day, and it tells you whether the
shop reads right before you commit to a processor.
