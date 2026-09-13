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

### The money path audited, 13 September 2026 — five faults, none of them config

Run once Stripe was wired, asking the narrow question *"what stands between a
quizmaster arriving and money arriving repeatedly"*. The plumbing held; what
did not was everything around it, and **not one of these would have been fixed
by setting the environment variables.**

#### 1. An expired trial could not buy the rung it was on

`tierRow()` decided which rung was "yours" from RANK alone — `i <= mine` — and
never asked whether anybody was paying. So an account on Bronze whose trial had
run out, every capability switched off, standing at the exact moment it had
decided to subscribe, read **"Bronze: this is the one you are on"** with no
Subscribe button. Silver and Gold were buyable. The rung it wanted was not.

That is the path *every* expired trial takes, so the ladder's one job failed for
the people furthest down the funnel. `cancelled` hit the same wall, and so did
anybody mid-trial who simply wanted to commit early.

**A live trial gets the button too, and that is deliberate**: it is the
conversion moment rather than an error. The wording changes rather than the
control — *"Yours for the rest of your trial"*, not a pretence that money has
arrived.

**But somebody who has PAID BEFORE is sent to the portal, never to a second
Checkout.** A `past_due` account already has a subscription at Stripe; another
Checkout opens a second one and bills them twice. `hasBilling` is true the
moment a webhook has stored a customer, and `subscribeSlot()` already draws the
portal link on exactly that condition — so the way back in was on the page for
them all along.

`scripts/buy-your-own-rung.mjs` drives five standings through a real browser and
presses the rung. A unit test cannot see any of it: `tierRow()` builds DOM, the
button is conditional on `/api/me`, and the fault lived in a boolean nobody had
written down.

#### 2. The Money tab counted free trials as revenue

`moneyTab()`'s `paying` folded `trialing` in with `active`, so **"£X a month
coming in" was inflated by every trial** — and so was the "more than is coming
in" flag under it, which is the one question the page exists to answer. Worst at
the only moment it matters: the month a tier goes on sale and a dozen people
start trials, the page says the business turned a corner.

Three parts to the fix, and the second is the interesting one:

- **`earning` is `active` and not comped.** "Where it comes from" multiplies by a
  price, so it takes the same set.
- **The trial line carries a COUNT and no figure.** A first version printed *"£X
  a month if every one of them subscribes"* — a forecast, and the note above that
  panel says *everything here is what HAS happened, never a forecast*. That rule
  is why the page is worth reading, so the projection went rather than the rule.
- **A trial that has RUN OUT is named as a job, not a statistic.** Nothing tells
  those people their trial ended, so the owner page is the only place it shows —
  and it is now also the list of people who can, since fault 1, actually pay.

And the People tab said **"3 paying"** where a comped account was counted as
paying AND as on-the-house, two words apart, in one sentence that did not add
up. Paying, on trial and on the house are three counts.

`scripts/owner-money.mjs` does the arithmetic in a browser against a fixture
book whose right answer nobody could reach by accident: two paying (£20 + £30),
three trials, one comped, one cancelled.

#### 3. `wantedTier` was collected since the sales page and drawn by nothing

The rung somebody presses on `/home` rides through signup as `wantedTier` — a
note of intent that must never become `tier` — and it reaches the owner page
inside `subscriberList()`. **No row printed it.** Before payments existed it was
the only signal about what people actually want, thrown away at the one moment
it was cheapest to read: *a field on a view is a promise that something draws
it*.

**It shows only where it DIFFERS from the rung they are on** — somebody who
pressed Bronze and is on Bronze tells you nothing; somebody sitting on Bronze
who pressed Gold is a conversation.

**And `findTier()` FALLS BACK TO BRONZE for an unknown id**, so reading it
directly printed *"wanted Bronze"* against **five** fixture accounts that had
pressed nothing at all — a fact invented out of an empty field, on the page
decisions get made from. Caught before it shipped by the guard above, which is
the value of a fixture with a known answer.

#### 4. `refunds.html` named a control that does not exist

*"Cancel from your account settings"* — and cancelling is Stripe's portal by
decision, reached through one button on My account that is only drawn after a
first payment. **The page somebody opens in order to stop paying sent them to a
screen with nothing on it.** A never-paid account found nothing at all.

That is the *"do it over there" must be a link to there* rule failing in its
worst place, and a LABEL COLLISION of the kind a sweep exists to find: no test,
no 500, no visual defect.

`test/legal-pages.test.js` is the first thing ever to read these three pages. It
asserts four things, each verified by putting the fault back:

- every legal page links to the other two;
- **an unfinished `[placeholder]` is always inside an `ld-legal-todo` span** —
  the bracketed form is what a human notices while writing, the span is what a
  grep finds six weeks later, and the marking was a convention nothing enforced;
- **the cancel sentence names the control as the app actually labels it**, read
  out of `console-subscribe.js` and `client.js` rather than typed into the test,
  so a rename fails here instead of silently making a legal page lie. Whitespace
  is collapsed first: the page wraps at eighty columns, so a four-word label is
  split across two lines and an exact `includes()` on the raw file fails for the
  wrong reason;
- **no legal page states a price of its own** — the prices are `TIERS` and
  nothing else, or terms can disagree with what Stripe charges, which is the
  argument you cannot win with a customer.

It deliberately does **not** fail while a placeholder is unfilled. That is
information only the host can supply, and a suite left red until he does is one
people learn to ignore — which this project already records as worse than a slow
one.

#### 5. Signup was unbounded, and handed the password link out in the body

Account creation had no limit at all, and each signup fires two emails off the
owner's provider quota. A script could fill the accounts book, burn the quota,
and **reserve email addresses it does not own** — `create()` throws on a
duplicate, so a reserved address is one a real customer then cannot use.

**The asymmetry is the opposite of the join gate's, and that is why a refusal is
right here and wrong there.** A phone joining is standing in a room with the
host on a mic, so being asked to wait stops a show — rule 4 holds it rather than
turning it away. Nobody signing up is mid-gig: *"try again shortly"* costs a
stranger a minute and costs the business nothing.

`SIGNUPS_PER_HOUR` is **5**, a SAFETY number like `MAX_TEAMS` and `MAX_SEATS`
rather than a design one: far above the busiest honest case (a quiz company
signing its own hosts up one at a time, which is a handful over a Monday) and
far below what a script does. In memory on purpose — a restart forgiving
everybody is the right failure for a courtesy limit. **It refuses before it
writes**, which is the whole point: the address is not reserved either.

**What it does not cover is said rather than implied**: a flood from many
addresses. That wants the provider's own limits and a captcha, neither worth
adding before there is a first subscriber.

And the other half. `/api/signup` returned the password-setup link in its own
response body whenever no mail provider was configured — **including on the
deployed app**, where the magic link is the only thing standing in for verifying
an address. So anybody could create *and activate* an account on an address they
do not own. `signup.js`'s own comment said this was *"not something the live app
hands out in the response body"*, which is the fourth sighting in this codebase
of a comment claiming the opposite of the code.

**`isLocalRequest()` is the test rather than an environment variable**: a
deployed app has a proxy in front of it, so a forwarding header means this is
not local, and an env var somebody forgets to set fails in the insecure
direction. When there is no provider and the request is not local the account is
still MADE — losing it would reserve the address with nothing to show for it —
and `noEmail` tells them to get in touch instead of leaving them watching an
inbox for a message nobody sent.

#### What was found and deliberately NOT changed

- **Pack sales are an `alert()`.** `shopCard()`'s Buy button says there is no way
  to pay, and there is no route that grants a pack at all — only the owner, by
  hand. The £3 on-ramp is Bronze's whole reason to exist and it is a build, not a
  fix.
- **Gold's only live exclusive is `packs.request`** — `MARKETING` and `STREAM`
  are both in `NOT_BUILT`. Worth knowing before anybody prices it again.
- **A trial ends in silence.** No email, no warning; the only sign is a line on
  My account. An expired trial also gets no grace night, which is correct — a
  grace there would be a free gig for anyone who signs up and walks away.
- **`referralCredit()` is computed and never deducted**, which `accounts.js`
  already says out loud. `checkoutSession()` passes no coupon.
- **`invoice.paid`'s price is read from `lines.data[0].price.id`**, and recent
  Stripe API versions moved that to `lines.data[0].pricing.price_details.price`.
  Harmless for a plain renewal, since an unknown price leaves the tier alone; it
  would silently break a tier CHANGE delivered that way. **Not verified from
  here** — `docs.stripe.com` is blocked by this environment's egress proxy, so it
  wants checking against the endpoint's own API version in the dashboard.

### Pack sales — the £3 on-ramp, wired 13 September 2026

*Bronze buys packs, Silver includes them* is the whole ladder, and the Buy button
in the Shop was an `alert()` saying there was no way to pay. It is a one-off
Stripe Checkout now. Four decisions in it are worth not re-arguing.

#### A bought pack goes in `account.bought`, NEVER in `account.packs`

`packs` is the owner's OVERRIDE: `packsFor()` returns it **instead of** the
tier's scope. So writing a bought id there would have taken a Bronze account's
eight starter packs away and left it holding the one it had just paid for — and
worse, a literal list keeps winning after an UPGRADE, so **paying £20 for Silver
would have handed somebody fewer packs than the £10 rung.**

The note above `packsFor()` had anticipated a shop and assumed the whole resolved
list would be written. That works and it freezes the tier; a second field that
only ever ADDS cannot get either wrong. `boughtBy()` is the one reader and
`packFilter()` the one place either field is consulted, so "may this account play
this pack" keeps one answer.

**Which also means there is something to sell SILVER**: its scope is
`'evergreen'`, so a topical pack is the one thing it cannot play — and the one
somebody wants the week it is news. The evergreen branch of `packFilter()` takes
the bought union too, or that sale would have been impossible.

#### A £3 pack must not buy somebody back into good standing

The hazard, and the reason this is a separate branch rather than a new billing
event: a one-off purchase arrives as the **same** webhook event type as a new
subscription — `checkout.session.completed` — carrying a price this app does not
know as a tier. Through `toBillingEvent()` that returned
`{ kind: 'started', tier: '' }`, which `applyBilling()` turns into
`status: 'active'` with the tier left alone. **A cancelled account would have
bought itself back into good standing for three pounds.**

`mode` is what tells them apart. `toBillingEvent()` takes only
`mode: 'subscription'`; `toPackPurchase()` takes only `mode: 'payment'`. **A
session with NO mode at all still reads as a subscription**, deliberately — every
one this app creates sets it, but a replay from before this existed must not stop
granting a tier somebody paid for.

And the grant does **not** go through `applyBilling()`. That function is a pure
translation of a billing event into a status and a tier, with a hard rule that it
writes nothing else and a test pinning the list — so a one-off purchase gets its
own door rather than a hole in the one thing keeping the webhook safe to leave
open. **`accounts.grantPack()` is the only writer of `bought`**, it is idempotent
(Stripe retries anything it did not get a 200 for), and a paid session the app
cannot attribute is logged as `PAID BUT NOT GRANTED` rather than swallowed.

#### The price is built from `PACK_PENCE`, not from a fourth Stripe price

`price_data` with a `unit_amount`, so the number lives in `plans.js` beside the
reasoning for why it is £3, the shop card prints the same one, and there is no
object in the dashboard that can disagree with what the customer was shown. It
also means selling packs needs no setup beyond the secret key.

**And the pack id is validated against the real CATALOGUE before anybody is
charged** — `fullLibrary(config, HOUSE)`, not their own shelf. `onlyTheirPacks()`
and `withShop()` both hide or strip what somebody cannot play, so resolving
against either would have refused the very packs this route exists to sell: the
shelf-is-not-the-library trap that emptied Tonight once. A pack somebody can
already play is refused outright, and so is one they wrote.

#### The button is present and inert where there is no way to pay

`me.canBuy` is the server's answer and is the same field the tier rungs read, so
the shop and the ladder cannot disagree about whether this app can take money.
Disabled and saying *"Not on sale yet"*, never absent and never an `alert()`: a
control that comes and goes is one you cannot learn the position of. A refusal
lands **on the card** rather than in a dialog — *"You already have that one"* and
Stripe's own words are both sentences somebody can act on.

`shopCard()` moved to its own `console-shop.js` rather than the line budget being
raised, which is `console-breaks.js`'s shape: buying is not launching, and it is
the one thing on that shelf that talks to a processor.

#### What the guards see, and what only one of them can

- `test/stripe.test.js` — the mode split both ways, the purchase fields, and the
  Checkout body through an injected fetch.
- `test/stripe-route.test.js` — the webhook writing to the accounts book over
  real HTTP, a retry not buying twice, and the route's three refusals. Verified by
  putting each fault back.
- **`node scripts/buy-a-pack.mjs` presses the button in a real browser** and reads
  the request body the server receives, because the click handler's catch would
  swallow a `ReferenceError` exactly as a gap dial's did twice in one week — and
  because *a test that the payload is right proves nothing about whether anybody
  drew it*. It also checks the button is genuinely pressable rather than merely in
  the DOM, and that the no-keys server draws it disabled.
