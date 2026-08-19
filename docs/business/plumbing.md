# Plumbing the money and the photos will eventually need

PayPal, object storage for photos, and the starter packs — small, real, and
not scheduled.

**Parked strategy — nothing here is scheduled.** Part of
[`../business.md`](../business.md), which is the index. It moved out on 16
August 2026 because that file had reached 170KB with 89% of it under a single
heading, and a session opening it for one answer was paying for all of it.

---

### Rewrite the eight starter packs — before anybody pays

**The most important content job there is, and it is yours rather than mine.**

Bronze now starts with four quizzes and four bingo games. Those eight are the
first thing a paying subscriber ever sees, and they decide what somebody thinks
the whole catalogue is worth — but the current library was put together to have
something to test against, and you have said so yourself.

What to aim at, since a starter pack has a different job from a normal one:

- **They have to work in ANY room.** A new subscriber is walking into a venue
  you have never seen. Decades and genres, not artists.
- **They have to be the best in the catalogue, not the average.** Somebody
  deciding whether to buy a ninth pack is deciding on the strength of these.
- **Read every one through.** The review flags on the console catch the
  mechanical faults; the taste is yours.

The eight are listed in `TIER_PACKS.bronze` in `public/assets/plans.js`. Change
the list in the same breath as renaming a pack — a rename silently drops a pack
out of Bronze, and there is a test that fails if an id in that list is not in
the catalogue.


### Photos will outgrow a git repo — move them to object storage

> **Not urgent. The trigger is the REPO SIZE, not the subscriber count: act
> around 2GB.**

Photos are filed into the private repo (`photos/<roomId>/<night>/`). At 1080
square and quality 0.85 a photo is roughly 200KB, so a busy night is ~6MB and
a six-night month is ~36MB — **about 430MB a year for one quizmaster.**

GitHub's soft limit is 1GB and it discourages anything past 5GB, and **git
never shrinks**: deleting photos does not reclaim the space without rewriting
history. So one quizmaster has roughly two years; ten have well under one.

**IT IS NOT A COST PROBLEM AND WILL NEVER BECOME ONE.** Cloudflare R2 is free
to about 10GB and pennies past it — at a hundred quizmasters it is a couple of
pounds a month against four figures of revenue. It is a WRONG-TOOL problem: a
code host used as a blob store, which fails on limits rather than on price.

**The second reason is serving, and it bites sooner.** The repo is private, so
a browser cannot fetch from it and every photo on a Past gigs page is proxied
through this server. That is bandwidth and CPU on the smallest Render instance,
for a page whose whole job is showing a venue a lot of pictures. Object storage
serves them directly and takes that off the app entirely.

**What NOT to do:** prune old photos (Past gigs is "here is my work" — deleting
the evidence defeats it), or make a repo per room (it spreads the bytes and
creates a repo to make per subscriber, which fails the Monday test).


### PayPal — the half that is built, and the half that is blocked

**Subscriptions rather than invoices**, on your own reasoning: chasing ten
quizmasters every month is worse than chasing venues, and PayPal charges the
card by itself.

#### Built and tested — `src/billing.js`

The processor-agnostic half, which is the half that matters because **you are
on 2.9% and expect to move to Stripe.** Five events and nothing else — started,
renewed, payment_failed, cancelled, expired — applied to an account by one
function. Four properties, all with tests:

- **A webhook may only ever move a SUBSCRIPTION.** It sets a tier and a status
  and stores an opaque reference. It cannot set `comped`, a role, `packs`, an
  email or a password. That endpoint is reachable by anybody who finds the URL
  and a signature check is the only thing in front of it, so a bug there has to
  cost a wrong tier and never an account.
- **A failed payment moves the STATUS and never the tier**, which is the rule
  this codebase already has tests for: a lapsed subscription never interrupts a
  night. Dropping somebody to Bronze because a card expired on a Tuesday would
  take their packs away mid-week.
- **An older event can never roll a subscription backwards.** Webhooks retry
  and arrive out of order, and a stale "cancelled" landing after a fresh
  "started" would close an account somebody has just paid for. Same lesson the
  invoice counter learned.
- **Nothing outside a processor's own adapter knows which processor it is** —
  there is a test that greps the code for the words. Moving to Stripe is one
  new adapter file and one route, not a search through the codebase.

#### Blocked — the PayPal adapter itself

`developer.paypal.com` is blocked by this environment's network egress policy,
so the API surface cannot be read from here. **The adapter has deliberately NOT
been written from memory.** A wrong webhook-verification path is not a bug, it
is a hole where anybody can POST "subscription activated" and hand themselves
Gold — which is exactly the wall `billing.js` exists to keep narrow.

Two ways to unblock it, either is fine:

1. **Allow `developer.paypal.com` and `api-m.sandbox.paypal.com`** in the
   environment's network settings (see the Claude Code on the web docs), and it
   gets written and tested against the real shapes.
2. **Paste the relevant doc pages in**, or hand over sandbox credentials — the
   sandbox API answers questions about itself.

#### What is needed from you either way — about 5 minutes

On the kids'-party PayPal business account, at developer.paypal.com:

- `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` — **sandbox first**, so nothing
  touches real money until the whole loop is proven
- `PAYPAL_WEBHOOK_ID` — from creating a webhook pointed at
  `https://musicquizapp.onrender.com/api/paypal/webhook`

#### Then, and it is small

- `src/paypal.js` — token, plan creation, webhook signature verification.
- `scripts/paypal-setup.mjs` — creates the product and the three plans **from
  `TIERS` in plans.js**, so the price on the ladder and the price PayPal charges
  cannot drift apart.
- `POST /api/paypal/webhook` — verify, translate to one of the five events,
  hand to `applyBilling`. **Then `billingEmail(result, accounts.find(...))`,
  and `sendEmail()` it if it returns one** — built and tested on 19 August
  2026 (`src/billing.js`, `src/email.js`), waiting only for a route to call
  it from. A receipt on `started`/`renewed`, a card-failed notice on
  `payment_failed`, both from Quizporium; `cancelled` and `expired` stay
  silent on purpose.
- A Subscribe button per rung on the account page. Card details never reach
  this server.

#### The two money emails, decided and built ahead of the route that fires them

Decided 19 August 2026, one of a batch of decisions asked and answered up
front rather than mid-build. `src/email.js` had one email in it — the
password reset — and its own doc comment said in as many words not to grow
it into notifications without a decision. The decision arrived and named two,
and no more: **a receipt when a payment lands, a notice when one does not.**
Both from Quizporium, because the app took the money — the mirror image of
invoicing, which drafts from the quizmaster's own address because that money
is theirs, never the app's.

**Kept OUT of `applyBilling()` itself, on purpose.** That function's whole
design is a small, pure translation from a processor event to an account
patch — no network call, easy to reason about, easy to test without a
server. Putting a `sendEmail()` call inside it would make every future test
of the account logic a test of email delivery too. So `billingEmail(result,
account)` in `src/billing.js` is the connector a route calls SECOND, once
`applyBilling()` has already succeeded:

```js
const result = applyBilling(accounts, raw);
if (result.ok) {
  const mail = billingEmail(result, accounts.find(raw.accountId));
  if (mail) sendEmail(mail);
}
```

**Only two of the five events say anything.** `started` and `renewed` are a
payment landing, so both get the receipt — not only the first one, because a
quizmaster paying for the third month running deserves to know it went
through as much as the first time did. `payment_failed` gets the other half.
`cancelled` and `expired` are silent: a quizmaster who has just left is not
somebody this app should be emailing, and the leaving was already their own
action — an email about it would be the app narrating a decision back at the
person who made it.

**The card-failed notice must never say a night is at risk, because it never
is.** `applyBilling()`'s own rule is that a failed payment moves the status
and never the tier — the same "a lapsed subscription never interrupts a
night" this codebase already has tests for elsewhere. An email that implied
otherwise would be the app frightening somebody about a game that was never
in danger, over a card that will very often just be a bank's own fraud check
having a slow day.

**It is genuinely built and tested, and genuinely not reachable yet — both
true at once, and worth holding together rather than picking one.** There is
no webhook route to call it from, because there is no PayPal adapter, because
`developer.paypal.com` is blocked by this environment's network egress — see
above. Building the sender ahead of the trigger is the same shape as
`billing.js` itself: correct and tested against invented event shapes now,
proven against real ones the day the network access lands.

#### One number worth knowing before the pack shop opens

At 2.9% plus a fixed fee, **the fixed fee is what hurts a £3 pack sale and
barely touches a £30 subscription.** Roughly: a £3 pack keeps about 87% after
fees, a £30 subscription keeps about 96%. That is another quiet argument for
the subscription being the business and the pack sale being the on-ramp, which
is what the pricing already assumes — and if pack sales ever become common, it
is an argument for selling three at once rather than one at a time.
