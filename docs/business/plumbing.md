# Plumbing the money and the photos will eventually need

PayPal and object storage for photos — small, real, and not scheduled.

**Parked strategy — nothing here is scheduled.** Part of
[`../business.md`](../business.md), which is the index. It moved out on 16
August 2026 because that file had reached 170KB with 89% of it under a single
heading, and a session opening it for one answer was paying for all of it.

---

### The eight starter packs were rewritten on 20 August 2026

The four quizzes (`madonna`, `1980s-pop-music`, `2000s-pop-rnb-and-chart`,
`2000s-metal`) each went from one thin round to two or three, in a mix of
round types — the bingo four were checked against the house rules (real,
recognisable, chorus-forward tracks) and were already sound, so they were left
alone. **Read them through before a paying subscriber sees them** — the
mechanical checks catch faults, not taste, and that half is still yours.


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


### Stripe — wired, 9 September 2026

**Subscriptions rather than invoices**, on your own reasoning: chasing ten
quizmasters every month is worse than chasing venues, and the processor charges
the card by itself.

**PayPal was the plan and never happened.** `billing.js` was written
processor-agnostic against the day a PayPal adapter would land; the adapter
never got written because `developer.paypal.com` was blocked by this
environment's egress policy and writing a webhook-verification path from memory
is not a bug, it is a hole where anybody can POST "subscription activated" and
hand themselves Gold. Stripe is cheaper anyway, and its docs are reachable. The
agnosticism was still worth having: wiring Stripe up touched no line of
`billing.js`.

#### ONE STRIPE ACCOUNT PER BUSINESS, GROUPED BY AN ORGANIZATION

Asked as *"can I set up a new business in the Stripe account"*, then, on
hearing there would be four of them — a mobile booking app, this, kids parties
and mobile DJ services — *"would it not be better to have a single account with
multiple sub accounts?"*

**The grouping instinct is right and the mechanism is an ORGANIZATION, not
Connect.** Stripe's own line is that *"a Connect platform extends its Stripe
integration to third parties, while an organization centralizes the management
of multiple accounts under common ownership"* — so Connect is for paying out to
OTHER people's businesses, and using it to hold your own turns four businesses
into a platform with onboarding flows and platform compliance obligations for
no gain. Stripe only points at Connect for many entities or automatic
provisioning; four is not that.

**AN ORGANIZATION IS A CONTAINER, NOT A MERGE — this is the part worth being
clear about.** Underneath it there is still one account per business, each with
its own keys, prices, statement descriptor, payouts and risk profile. What the
org adds on top is one login across the lot, consolidated reporting and
downloadable unified reports across currencies, central team management and
SSO, and Sigma SQL across every account.

**So the structure this app needs is identical either way**, which is what
makes the decision safe to defer: Quizporium points at ITS OWN account's key,
prices and webhook secret. An account can be created now and put in an
organization later without touching a line here.

**AND SEPARATE LEGAL ENTITIES HAVE NO CHOICE.** Stripe: *"If you operate
multiple businesses that have separate tax ID information (for example,
separate legal entities), you must create additional accounts for each."* Same
sole trader or one Ltd across all four is the only case where a single account
would even have been possible.

Five reasons the accounts stay separate rather than one account with four
products in it:

- **The statement descriptor is per account.** A subscriber's bank statement
  would otherwise carry the kids'-party name — a support email every month from
  somebody who does not recognise a charge, which is a Monday-load creator for
  a cosmetic reason.
- **Checkout branding, receipt emails and the customer portal are all per
  account.** All three are things a paying quizmaster sees.
- **Payouts and bookkeeping stay apart**, which is what makes the two
  businesses' numbers answerable separately.
- **Products and prices live in an account**, so the three tiers cannot end up
  in a list beside party packages.
- **AND RISK IS ASSESSED PER ACCOUNT, which is the strongest of the five.**
  Parties and DJ bookings are cancellation-prone and therefore chargeback-prone;
  a subscription business sharing an account with them inherits that dispute
  rate, and Stripe's answer to a bad one is a reserve or a hold. Keeping the
  recurring revenue in its own account is what stops a cancelled party in
  December putting a quizmaster's Friday night at risk.

**THE ONE REAL COST, and an organization does not fix it: customers are not
shared across accounts.** Somebody who books a party AND subscribes here is two
customers with two saved cards. For four businesses with almost no overlapping
audience that is a price worth paying; if the audiences ever do overlap, it is
the thing to look at again.

**NOT VERIFIED FROM HERE:** whether creating an organization needs Stripe to
enable it, and what it costs. `docs.stripe.com` is blocked by this
environment's egress proxy, so the quotes above come from search results rather
than from the pages themselves. **Check it in the dashboard before relying on
it** — the account-per-business half is solid either way.

#### What is needed from you — five environment variables

All on the Render service (`/web/srv-…`, never the project page). **Test mode
first**: every key below has a test twin, nothing touches real money, and the
whole loop is provable before anything goes live.

- `STRIPE_SECRET_KEY` — Developers → API keys. `sk_test_…` first.
- `STRIPE_PRICE_BRONZE`, `STRIPE_PRICE_SILVER`, `STRIPE_PRICE_GOLD` — one
  recurring monthly Price each, £10 / £20 / £30, matching `TIERS` in
  `plans.js`. The ids look like `price_1AbC…`.
- `STRIPE_WEBHOOK_SECRET` — from adding an endpoint at
  `https://musicquizapp.onrender.com/api/stripe/webhook`, subscribed to
  `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed` and
  `customer.subscription.deleted`. The signing secret looks like `whsec_…`.

**The three prices are read from the environment rather than created by a
script**, which is the one difference from the plan written for PayPal. A
script that mints prices is a script that can mint the wrong one on a rerun,
and there are three of them, made once, in a form that shows you what you are
charging before you save it.

#### What is built

- **`src/stripe.js`** — the adapter, and the only file that knows the word
  Stripe. Signature verification, the translation to the five events, Checkout
  and the billing portal.
- **`POST /api/stripe/webhook`** — the only thing in the app that can move a
  tier.
- **`POST /api/subscribe`** — turns a rung into a Checkout session.
- **`POST /api/billing/portal`** — Stripe's own portal, where a card is changed
  and a subscription is cancelled.
- **`console-subscribe.js`** — the Subscribe button on each rung, and the link
  into the portal.

#### The decisions worth not re-arguing

- **NO SDK.** The no-dependencies rule holds and costs almost nothing here:
  Stripe's API is form-encoded HTTP and the webhook signature is an HMAC node's
  own `crypto` computes. The SDK is ~40 transitive packages on the one server
  holding a live connection to every phone in a pub.
- **CHECKOUT RATHER THAN A FORM ON THIS APP**, and it is a decision about
  liability rather than effort: a card number that never touches this server is
  one this server can never leak. It is the same reasoning as the invoice
  book's *no card details are stored and none ever will be*.
- **THE ACCOUNT ID TRAVELS ON THE SUBSCRIPTION, not only the session.** It goes
  on the Checkout session as `client_reference_id` AND into
  `subscription_data.metadata.accountId`, because a renewal months later has no
  session on it at all. Getting that wrong means the first payment lands and
  every renewal after it is an event the app cannot attribute to anybody.
- **THE TIER IS READ OFF THE PRICE, never off the request.** `wantedTier` must
  never become `tier`: the browser names a rung, the server turns that into one
  of three price ids it holds, and what an account is granted comes back off
  whatever Stripe says was paid for.
- **AN UNKNOWN PRICE GRANTS NOTHING.** A plan made in the dashboard that this
  app has never heard of leaves the tier where it is rather than guessing one.
- **THE WEBHOOK ANSWERS 200 TO ALMOST EVERYTHING.** Stripe sends dozens of
  event types and this app acts on five things. An endpoint that errors on one
  it does not care about makes Stripe retry for hours and eventually disable
  the endpoint — the whole subscription plumbing going quiet with nothing on
  screen to say so. 400 is reserved for a body that fails the signature.
- **`customer.subscription.updated` IS DELIBERATELY NOT HANDLED.** It fires for
  every trivial change — a card updated, a proration recalculated — and acting
  on it would move somebody's status for reasons that are not about whether
  they have paid.
- **CANCELLING IS STRIPE'S PORTAL AND NOT A BUTTON HERE.** A cancel button on
  this app would be a second place a subscription can end, and the two would
  disagree the first time one of them failed. It also makes the honest answer
  to "how do I stop paying" a link rather than an email to somebody with one
  admin day a week.
- **A GROUP SEAT CANNOT SUBSCRIBE.** Its standing is its parent's through
  `effective()`; billing it separately would take money for something it
  already holds.
- **`billingEmail()` IS CALLED FROM THE ROUTE, never from `applyBilling()`** —
  a receipt on `started`/`renewed`, a card-failed notice on `payment_failed`,
  both from Quizporium; `cancelled` and `expired` stay silent on purpose.

#### The tests, and what each is for

- `test/stripe.test.js` — the signature (a changed body, the wrong secret, a
  replay, a rotation with two `v1`s, a wrong-LENGTH signature that used to
  throw rather than return false), the translation, and the tier mapping both
  ways.
- `test/stripe-route.test.js` — the same over real HTTP, because the raw-bytes
  requirement cannot be seen any other way. **The fixture bodies are
  pretty-printed on purpose**: a body built with `JSON.stringify(x)` survives
  parse-and-restringify unchanged, so the first version of that file passed
  with the fault deliberately put back. Two spaces of indentation is what makes
  it a real check.
