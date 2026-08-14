# Accounts — hats, tiers, rooms, gates and own packs

The reasoning behind the accounts rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## My account — and the line that page is built along

A tab on the console: your name, your colours, what you are subscribed to,
which tabs you want on screen, and links to everything else. It exists because
those were scattered — the colour picker sat at the bottom of every tab, and
the join link, the big screen and the control view were on three different
panels.

### The ladder is CAPEX AND OPEX, not a pack count

Settled after measuring what a pack actually costs, and it is the host's own
observation: the one-off packs and the topical ones **are different animals**.

- An **evergreen pack is an ASSET.** About £1.90 of API to write, once, and
  then it sells to every subscriber for ever. How much of that library somebody
  gets is a fair thing to meter, because the pile is finite and writing more is
  optional.
- A **topical pack is a SERVICE.** "The month just gone" has to be written every
  week or it is not topical — the **only recurring cost in the whole product**,
  about £18 a month for the two of them, for as long as anybody holds the tier.
  It is also the one thing that cannot be bought once and reused, which is what
  makes it the strongest subscription argument there is.

So: **the evergreen catalogue is the Bronze-to-Silver axis, and topical is what
Gold IS.** `TIER_PACKS.silver` is `'evergreen'`, `gold` is `'all'`.

**The gradient is arithmetic rather than a judgement call**, and there is a test
that it holds:

| | | |
|---|---|---|
| Bronze £10 + four topical at £3 | £22 | Gold is £8 more and adds the whole catalogue — a step, not a cliff |
| Silver £20 + four topical at £3 | **£32** | **more than Gold**, so a Silver subscriber who wants topical weekly has an unambiguous reason to climb |
| Gold £30 | | covers the whole weekly programme on its own |

**It is a FIXED cost, not a per-use one, and that is why the house rule does not
reach it.** A topical pack costs the same whether one subscriber runs it or a
hundred do, because generating is per-WRITE and not per-play. **One Gold
subscriber pays for the entire weekly programme** and every one after that is
nearly all margin.

**What this commits the owner to is a WEEKLY DEADLINE, not money.** The writing
is a button press and about £2; the read-through is twenty minutes, every week,
for as long as one Gold subscription exists. Miss a week and a Gold subscriber
notices immediately. That is this codebase's first rule pointed at the business
rather than at the app, and it is the one part of the arrangement that cannot be
undone by editing a line in `plans.js`.

**A dated pack is told apart by its `freshUntil`, never by its id.** A topical
pack is named after the day it was written, so a gate reading the name would
work today and open the moment somebody renamed one. `isTopical()` and
`packFilter()` in `plans.js`.

### The ladder: Bronze, Silver, Gold, and they STACK

`TIERS` in `plans.js`. Gold includes Silver includes Bronze — one ordered list
with a `rank`, and **`rank` is what the code compares, never the label and never
the price.** Adding a fourth tier is one entry with a rank between two existing
ones and nothing else in the app has to know. `FEATURE_TIER` says which rung
each feature is on.

**The tiers are the structure; where each feature sits is PROVISIONAL** and so
are the prices. Moving one is a one-word edit in `FEATURE_TIER`. What is not
provisional is the rule that decides it, which is the host's own: *anything that
costs the owner money every time it is used is not in Bronze.*

**Owner-only features are deliberately NOT on the ladder at all.** They are not
for sale at any price, so putting one on a rung would be offering to sell it.
There is a test.

The account page draws a section per tier from `ladderFor()`: yours are marked
and switchable, the ones above show their price and have nothing to press —
something you can see and cannot use is a thing you might buy.

**A tab has three states, and telling the last two apart is the point.** On;
above your tier, so greyed with a `+`; or switched off by you, so gone
completely. A `+` on the third would be the shop trying to sell somebody the
thing they just put away.

**Each feature carries the SAME switch as the hat in the top right** — an
On | Off pill, the live half in the app's own red-into-orange. It was a tick
box, which reads as a form you fill in rather than something you operate; one
control shape for "is this on" across the whole app is recognised instead of
read. A feature on a tier ABOVE yours gets the tab bar's `+` in a dashed circle
rather than a switch showing Off: you did not turn it off, you do not have it,
and keeping those apart is the whole point of the three states.

### The upsell lever is CONTENT, not capability

`TIER_PACKS` and `packsFor()` in `plans.js`; `onlyTheirPacks()` and the launch
check in `server.js`.

**Bronze is the whole machine and a starter library.** Every capability you
withhold is something that looks broken in front of a room — and a Bronze host
running a venue's Christmas party is the shop window, so a thinner projector is
the PRODUCT looking cheap rather than the tier looking cheap. It also cuts
against rule one: nothing surprising on a Wednesday night, and a control that
refuses is a small version of exactly that.

Content pressure grows with success instead, which is what makes it implicit: a
host with three quizzes hits the ceiling in month four when the room has heard
them, while doing well, and never mid-question.

So **picture rounds and intro rounds stay in Bronze.** They are what makes a
night feel produced, and crippling the demo is the opposite of an upsell.
Portraits are also the wrong thing to charge for — they are keyed to the
musician and SHARED, so the second eighties pack wanting Madonna costs nothing.
That bill amortises towards zero; pricing it as premium prices a cost that is
disappearing.

**The host has since settled WHY the generator stays owner-only, and it is a
commercial reason rather than only a cost one.** In his words: *"the restriction
from using Claude to generate quizzes is necessary. It's what makes the bronze
buying packs and the silver getting them for free a delineation worth upgrading
for."* So the ladder is meant to read: **Bronze buys packs, Silver gets them
included.** That is a stronger reason than the bill — if a subscriber could
generate, there would be nothing on the ladder worth paying to climb. Do not
propose giving quizmasters the generator as a paid add-on; it is the thing the
tiers are built out of.

Note what it implies and what is NOT built: Bronze buying a pack needs a payment
flow and a purchase record, and there is none — see "Pay-per-pack is deliberately
NOT built" below. The data model is ready for it (`packs` on an account), so this
is a decision waiting on a processor rather than a redesign.

**The lever is switched on now: Bronze is EIGHT PACKS, four quizzes and four
bingo games.** Silver is the whole EVERGREEN catalogue; Gold adds the weekly
topical quizzes on top — see **The ladder is CAPEX AND OPEX** above. A weekly host gets one
to two months out of eight, which is the intended shape — the ceiling arrives
while they are doing well and never mid-question.

**Which eight is deliberate.** The starter set is the packs that work in ANY
room, decades and genres, because a new subscriber has to be able to walk into
any venue with them. The artist packs are held back: those are the ones you
pick for a specific night, which is exactly when somebody will buy one.

**But the eight THEMSELVES need rewriting before anybody pays for them.** The
host's own assessment: the current library was thrown together to have
something to test against, and a starter set is the first thing a paying
subscriber sees — it is the whole impression of what the catalogue is worth. Do
not treat the current ids as settled content. See TODO.md.

It is a list of pack IDS, so a new pack does not join Bronze on its own — that
is the point, because Silver's promise is "and every new one as it is written".
The cost is that **renaming a starter pack silently drops it out of Bronze**, so
change the list in the same breath as a rename. There is a test that every id in
it is really in the catalogue.

### Topical packs: a DATE, not a second class of pack

Rounds tied to a week — "the week that just went past" — alongside the
evergreen catalogue. `freshness()` in `quizzes.js`, and the same shape read in
the browser by `console.js` to sort and label.

**They are the same price, and the reason is that a topical pack is worth MORE
in its week, not less.** Pricing it lower would say the opposite of what is
true. And its real job is not to be a cheap line in the shop: writing one every
week is the strongest argument for a subscription there is, because it is the
one thing that cannot be bought once and reused. A weekly host buying them at
£3 spends £12 a month on top of Bronze, against £20 for Silver — so topical
content pushes people up the ladder **weekly**, rather than in month four when
the starter set runs dry. That is the pressure arriving more often and more
gently, which is the whole design.

**It is `freshUntil`, a DATE — not `topical: true`.** A boolean says a pack is
dated but not whether it is STALE, and stale is the only part anybody needs
telling about. So:

- the console sorts fresh ones to the top and expired ones to the bottom,
  **without hiding them** — a pack that vanished reads as lost work, and last
  month's news round is a fine thing to run on purpose;
- launching an expired one **warns and does not refuse**. A control that
  refuses in front of a room is the mistake this codebase keeps recording;
- **the `ages-out` review flags are switched off for a dated pack.** Every
  question in a news round trips them — "this week", "the latest", "most
  recent" is what a news round is made of — and a review list forty flags long
  is one you stop reading, which would cost you the flags that matter on the
  rounds that are NOT topical. The expiry date is a better warning anyway: it
  says WHEN rather than merely that it might;
- the owner's Catalogue tab drops expired topical packs out of "never played by
  ANYBODY", because a pack that was meant to expire and did is not evidence
  about the writing;
- **a misspelt date is a validation problem**, not something quietly ignored.
  Ignored, a topical pack silently becomes evergreen — no expiry warning AND
  the ages-out flags off, which is the worst of both;
- a pack with no date is evergreen, so **nothing on disk had to change** and
  every pack written before this is already correct.

The reason to build it at all is reliability rather than commerce: a "week that
just went past" quiz run three months late is a quizmaster looking foolish in
front of a paying room, which is the thing `ages-out` in `reviewWarnings()`
already exists to prevent. This is that hazard made deliberate, so it needs the
same care.

### Where a topical pack comes from — the one thing here that reads the web

`src/research.js`, and the **"The month just gone"** button on the console next
to "Write it". Forty questions: **20 general knowledge and 10 music from the
last month, then 10 music from any era.** Named after the date, marked current
for a fortnight.

**ONE digest, read ONCE, given to the WRITER and to the CHECKER.** That is the
load-bearing decision and it has two separate reasons. If the two search
separately they are working from different facts, so the checker rejects true
questions and the log fills with rejections nobody can account for — checking
only means anything against the same evidence the question was written from.
And the checker runs in batches, several at a time, so a search each would read
the same month of news ten times over at 0.8p a search plus every token it
drags in.

**Every line of the digest carries a DATE and a SOURCE**, because the checker's
whole job is "are you sure" and it cannot be sure of a bare assertion.
`tidyDigest()` throws away anything without a date — which also drops the
opening sentence a model that has just done twelve searches cannot resist, and
which would otherwise sit in the cached prefix being paid for over and over.

**The last round is deliberately NOT topical.** A quiz made entirely of the
last month punishes anybody who was on holiday, and the room notices about
question thirty. That round's writer is not given the digest at all — handed
it, it writes about the news anyway and the pack has no ground in it.

**This is the ONE place in the app where a failure refuses the job.** Every
other fallback here leans the other way — a checker that cannot be reached
keeps the questions, because by then the generation is minutes and real money
deep. The research call is the FIRST call, before a penny is spent, and what
carrying on would produce is forty confidently invented current events. There
is nothing to lose by stopping and everything to lose by not.

**`web_search_20260209`, not the older `_20250305`.** The newer one filters
results before they reach the context rather than after, which on "what
happened last month" is the difference between reading the news and reading a
page of search-engine furniture. And the server's own search loop stops after
ten goes and hands back `stop_reason: 'pause_turn'` rather than an answer —
resuming is the same conversation with the assistant's half appended and **no
extra instruction**, because a "continue" message reads as a new request. Not
resuming looks exactly like a quiet month: a short digest and no error.

#### The checker's FIRST batch goes on its own, and that is not a delay

The digest is a couple of thousand tokens sent identically on every batch, so
it is cached — `cache_control: {type: 'ephemeral'}` on a second system block,
after the standing instructions and before the varying prompt, because a
breakpoint covers everything up to and including its own block.

**But concurrent requests cannot share a cache WRITE.** The checker used to
fire every batch at once with `Promise.all`, and under that shape all six
arrive before any of them has finished writing — so all six pay full price for
the same tokens and the cache is written six times over. One batch first,
awaited, then the rest together: they read what it wrote at a tenth of the
price. Without a digest there is nothing worth caching, so nothing is bought by
waiting and the whole lot still goes at once, exactly as before.

A breakpoint is only added when there is enough to be worth one
(`worthCaching()`). Below Anthropic's minimum a cache write is not free — it is
a quarter MORE than cold — so marking a small prompt for caching is a surcharge
on tokens nothing will ever reuse. The digest's position never changes either
way, so the prompt is always the same shape.

**The ledger had to learn three new numbers or none of this would show up.**
`cacheRead`, `cacheWrite` and `searches` in `src/spend.js`. The API reports the
three input counts separately and they do NOT overlap — `input_tokens` is the
uncached remainder — so adding them up and pricing the total as ordinary input
is exactly what would make caching look like it saved nothing, on the one page
whose job is to say what the AI actually costs. Searches get their own line in
the summary because that is the only figure that grows with how TOPICAL the
writing is rather than with how much of it there is.

#### A round can now say what it is about

`roundPlan()` entries carry three optional things, all added for this and all
useful on their own: **`focus`** (what THIS round is about, where the theme is
what the whole pack is about), **`topical`** (write it from the digest), and
**`label`** (what it is called on the projector). Before this a pack could only
be about one subject, so "twenty of the news and ten of music" had no way to be
said. `TOPICAL_ROUNDS` and `topicalNaming()` live in `src/generate-quiz.js`
rather than in the browser, so a curl call and a button press produce the same
pack and there is one thing to test.

Two topical quizzes on one day do not collide — the hard one is
`topical-<date>-hard` — which is exactly what the host asked for: one of
average difficulty and one pitched harder, every week.

**GOLD IS SELLABLE NOW, and this is what changed.** It used to be the
online/streaming tier and nothing else — so a Gold subscription bought Silver at
a £10 markup, which would have been a refund rather than an upsell, and the note
here said it must not be offered. **The weekly topical quiz is what Gold is
now**, it is built and tested, and it is worth more than £10 a month to a weekly
host by a wide margin. Streaming joins Gold when it exists rather than being
what justifies it.

The one honesty requirement: **`FEATURE_META` for streaming says "Not built
yet"**, on the tier's own card, so nobody on Gold is waiting for something that
is not coming this month.

**Usage is deliberately NOT metered, and the reasoning matters because the
obvious objection is a fair one.** A host running twelve nights a month earns
several times what a fortnightly host earns and pays the same. Three reasons to
leave it:

- **Metering is what makes software hateful to run a business on.** A per-night
  charge means a quizmaster doing sums before accepting a booking, which is the
  opposite of this codebase's first rule.
- **The heavy user is the advocate.** They are the reference customer and the
  one who tells other quizmasters about it. Charging them more punishes exactly
  the behaviour the business needs.
- **Scale beats extraction at this size.** A hundred subscribers at £20 is
  better business than thirty at £50 with a meter, and far easier to sell.

Worth knowing what the pack lever does and does not capture: it tracks how much
VARIETY somebody needs, not how many nights they run. A host with three pub
residencies can run one pack at all three, so eight packs lasts them three
months while a one-venue host burns through it in one — the busiest host hits
the ceiling slowest, which is backwards. The play counts are per room and now
survive a deploy, so the honest answer is to WATCH it: if somebody is genuinely
running twenty nights a month, that is a conversation about a multi-venue
arrangement (rooms already exist), not a metered tier.

**There is NO FREE TIER, and that is a structural decision rather than a price
one.** Bronze is £10, Silver £20, Gold £30 — the machine is identical at every
level, so a £0 rung is somebody running paying gigs on it forever. A month on
the house is `status: 'trialing'`, which already exists and is treated as
paying. **Do not add a fourth tier at £0 to get a trial** — that is a permanent
hole in the ladder to solve a temporary problem. There is a test that no rung
is free.

**The trial's shape was settled on 12 August 2026: ONE MONTH, FREE, CARD UP
FRONT.** Not built — it waits on the payment processor like everything else
touching billing — but the mechanism is `status: 'trialing'`, which already
exists, is the default on `accounts.create()` and is already treated as paying
by `can()`. So it stays a STATUS and never becomes a tier.

Three things decided with it, each against a specific alternative:

- **A MONTH, not a week and not three.** The unit of value here is a GIG, not a
  day — a quizmaster runs one or two nights a week, so a seven-day trial can
  contain no night at all if their next booking is on day nine, and they would
  cancel having seen nothing. A month is four nights for a weekly host and two
  for a fortnightly one, which settles it either way. Three months gives away a
  quarter of a year of the catalogue and the topical packs, and somebody not
  convinced by night four will not be by night twelve.
- **FREE with a card, rather than half price.** A card on file does most of what
  a paid trial was for — it filters people who were never going to buy and it
  converts on its own at the end — while keeping *free*, which is the strongest
  word a referrer has when asking a mate for a favour. Half price also anchors
  them low, so the first full bill reads as a price RISE rather than the normal
  price, which is a self-inflicted churn moment.
- **No signup discount on top, for referrals or anything else.** Two overlapping
  offers is two things to explain doing one job, and the trial is the better of
  the two: it proves the app rather than discounting it.

An account-level `packs` list still beats the tier, which is what makes
pay-per-pack a one-line change rather than a redesign.

**`packs` is an ENTITLEMENT, so it is `accounts.update()` and never
`setPrefs()`** — the same wall that stops a preferences payload handing out a
tier. `null` clears it back to the tier; an empty ARRAY means none, and the two
must not be confused. There are tests for both.

**The server filters, not just the console.** A library trimmed only in the
browser is decoration — the tier-preview work already proved how fast a page
and its API drift apart. `/api/host/launch` checks the pack id from the request
body, because that is exactly the shape of the hole `POST /api/quiz` had.

**The account page shows it, as a statement and never a shop.** `libraryPanel()`
in `console.js` — "Quizzes 3 of 7", with the line underneath naming the lowest
tier ABOVE this one that holds the whole catalogue. The ladder below it lists
capabilities, every one of which is already Bronze's, so before this the page
had nothing on it saying what a higher tier would actually get you.

Two things it gets right, both found by looking at it rather than by reasoning:

- **It only names a tier ABOVE the reader's own.** The first version named the
  lowest tier holding everything, which today is Bronze — so a Bronze
  subscriber on a starter list was told "Bronze includes every pack" while
  looking at three of seven. That reads as a fault in their account rather than
  as an offer. If their own tier already holds everything, the limit is an
  explicit list rather than the ladder and it says nothing about tiers at all.
- **It is silent when the whole catalogue is in reach**, which is everybody
  today. A page that congratulates you on owning everything is one you learn to
  skip, and the line has to still be worth reading on the day it changes.

### What a pack costs, and why the number is not about the pack

**A pack is priced to make the UPGRADE obvious, not to make money.** The
recurring subscription is the business; a pack sale is the on-ramp. So the only
question the price has to answer is *at what point should somebody stop buying
and move to Silver*, and that makes it arithmetic rather than a judgement call:

| A pack at | A weekly host (4 a month) pays | vs Silver at £20 |
|---|---|---|
| £2 | £10 + £8 = £18 | Bronze wins — **the ladder does not work** |
| £3 | £10 + £12 = £22 | Silver wins, clearly |
| £5 | £10 + £20 = £30 | Silver wins by a mile, and the pack looks dear |

The floor is £10 ÷ 4 = **£2.50**: below that a weekly host never has a reason
to climb, and the whole Bronze-buys / Silver-includes structure quietly stops
being a ladder. So £2 is the one number in that range that cannot be used.

The ceiling is about how it READS rather than what it is worth. A quizmaster
charges a venue well over £100 a night, so £5 is about 3% of one fee and
objectively trivial — but it is half their monthly subscription for one night's
content, and that ratio is what somebody reacts to. **£3 is the recommendation:
the lowest price that still makes Silver right for a weekly host, and a fifth
rather than a half of the subscription.**

It also lands the fortnightly host in the right place — two packs is £6, so
buying stays cheaper than upgrading, which is correct. They should not be
pushed up a rung they would not use.

**And the IP is not what is being sold.** The packs are AI-written and only run
in this app, so a copied pack is worth nothing to anybody without a
subscription. Two things follow and both save work: **do not build DRM,
per-pack licensing checks or watermarking** — there is nothing to protect and
the effort would be spent defending a thing that cannot be stolen usefully. And
since convenience is the entire product, the price has to be a convenience
price. That argues for the lower number too.

### Rounds are still not sold, and the reason is the build rather than the principle

`£1 for a single round` was raised and is worth holding rather than dropping —
a quizmaster who writes their own packs now has a real use for "I want your
picture round in my quiz".

It is not built, and should not be first. Every pack card, play count, review
flag and launch in this app is per PACK; rounds as products needs a second kind
of object, a way to assemble a night out of bought rounds, and a library to keep
them in. That is a bigger job than the shop itself, and it would be guessing
twice — build the pack shop, then look at what people actually buy. The
arithmetic is also awkward: four rounds at £1 is more than a whole pack at £3,
so the à-la-carte price has to sit above the bundle to make sense, and a
"cheaper" option that is dearer confuses the page.

### The shop — built as a WINDOW, with no money in it

`withShop()` and `mayReadPack()` in `server.js`, `shopCard()` in `console.js`,
`PACK_PENCE` in `plans.js`. A pack outside your library is shown as a dashed
card with its title, its size and £3 on it, and **Buy takes no money and says
so.** It exists so the shop can be LOOKED at before a processor is committed
to: whether it reads as fair or as grabby is a judgement about wording and
layout, and that is far cheaper to change now than after the money is plumbed.

**Building it closed a hole the tier lever had opened, and that is the part
worth remembering.** Launching a pack outside your library was refused from the
day the lever was built — but READING one was not, and a pack read hands over
every question and every answer. So a starter library could have been worked
around by opening the other packs and copying them out. It was invisible for as
long as every tier was `'all'`, which is exactly how this kind of hole survives.
`mayReadPack()` now guards `/api/quiz/<id>`, `/api/bingo/<id>` and
`/api/images/<id>` (that last one reports every question's ANSWER, so it is a
pack read whatever else it is). There is a test naming all three.

**A locked summary is STRIPPED on the server, not hidden in the browser.** A
pack summary carries `search` — every question, answer, artist and track title
blobbed together for the search box — and a bingo summary carries a Spotify
link to the whole track list. A padlock drawn over a payload that still held
either would be decoration. Tested.

**Yours above, the shop below, with a heading between.** One mixed grid was the
first attempt and it is wrong: a padlocked card three rows down among ones you
can launch reads as a fault in your account rather than as a shelf. Separated,
everything you can actually run tonight is above the fold, which is what
somebody opening the console ten minutes before a gig came for.

**The tab badge counts what you can RUN, never the shelf.** "Music Quiz 7" to
somebody holding four reads as a fault rather than as an offer.

**Buy is deliberately not the app's own red-into-orange.** That gradient is
Launch, and one shape and one colour for "start the night" is worth more than a
loud shop.

**Pay-per-pack is deliberately NOT built.** A shop needs a payment flow, a
purchase record and a story for a card that fails mid-month — a week of work,
spent building something that competes with the upgrade you want people to
take. The data model is the same either way: whether an id lands in `packs`
because of a tier or because somebody bought it is one line, so this is not a
dead end.

### NOTHING ON THAT PAGE GRANTS ANYTHING

"Which features do I want" is two questions wearing one coat, and they must
never share a switch:

| | What it is | Who sets it | Where it lives |
|---|---|---|---|
| **What you have** | the tier, and the subscription status | the OWNER | `tier` / `status`, via `accounts.update()` |
| **What you have ON** | which of your tier's features you use | you | `prefs.featuresOff`, via `accounts.setPrefs()` |

The page shows the first as a **statement** and offers the second as a
**switch**, drawn differently on purpose — a tick box that turned invoicing on
would be the paywall handed to the customer, and there is no payment processor
wired up to charge for it.

**A switch only ever SUBTRACTS.** `setPrefs()` is a separate method from
`update()`: it writes only under `prefs`, it ignores anything shaped like an
entitlement, and it will not even store a feature above the account's tier.
`featuresFor()` is entitlement; `activeFeatures()` is that minus the switches,
and is what the console draws from. There are tests that switching everything
off changes nothing `can()` answers, that a `prefs` payload carrying `tier`,
`comped` or `role` hands out none of them, and that ON is always a subset of
ENTITLED.

**`can()` — and therefore `allowed()` on the server — reads entitlement only.**
Switching something off does not make the API refuse it. That is deliberate: a
switch on your own account page is about tidiness, and one that could 403 you in
the middle of a gig is a reliability risk for no benefit, because nobody needs
protecting from themselves. The console hides it; the server does not slam a
door on it.

**The My account tab can never be switched off.** It is where the others are
turned back on, so it has no feature gating it at all.

**An account written before the ladder still reads correctly.** `tierFor()`
falls back to the old `plan`+`addons` shape — `admin` was Silver, `stream` was
Gold — because a subscriber silently dropping to Bronze because a field was
renamed is not a migration, it is a bug with a bill attached. Moving a tier
deletes the old fields, so an account never carries two answers to one question.

Two things this found, both of which had been there a while:

- **`tabBar()` assumed every tab had `packs()` or `count()`.** A tab with
  neither took the whole console down with `tab.packs is not a function`.
- **`load().catch()` swallowed the error and drew the host-key box**, so a bug
  anywhere on the page looked exactly like a wrong key. It logs the cause now
  and says so on screen. That is the rule about failure messages naming the
  cause, applied to the console itself.

**The lit tab is scrolled into view after every render** (`showActiveTab()`).
The bar scrolls sideways on a phone and the tabs on the end were off the right
of it, so tapping one changed the page while the tab you pressed stayed out of
sight — which reads as "did that work?" and gets tapped again. It moves the
BAR's own `scrollLeft`, never `scrollIntoView`, which would jump the whole page
down to the tab bar on every render.

---

## Accounts, and who is allowed to do what

`src/accounts.js` (who is signed in) and `public/assets/plans.js` (what they may
do). Plans lives under `public/assets/` for the same reason `looks.js` does: the
browser needs the same list and two copies drift. **Enforcement is entirely
server-side** — `allowed()` in `server.js`; the browser copy only decides what
to draw.

**Two kinds of account, and they are not the same shape.** One **owner** — the
app dev. Writes and generates the packs, sells them, manages subscribers, and
runs no nights at all. Then a **quizmaster** per subscriber. The owner's own
quizmaster account is a separate login, marked `comped`: everything, for
nothing.

### The rule that decides which tier something goes in

The host's own, and it settles arguments before they start: **anything that
costs the owner money every time it is used is not in Basic.** Not "is it
impressive" — does a subscriber using it put a line on the owner's bill?

**And a second rule, added later, which decides everything the first one does
not: the tiers separate on QUIZ-APP FUNCTIONALITY, never on business tools.**
Invoicing, the calendar and marketing were a paid add-on and are now Bronze.
Withholding the thing that helps a quizmaster get paid creates no upgrade
pressure — it just makes the app less useful to the person you most want
recommending it.

**Advert slides stay at SILVER, and the reason had to be rewritten twice.** The
original — "it makes the quizmaster money" — is dead, because that is precisely
the argument that was made and rejected for invoicing. The second attempt, "a
slide is part of the show", is wrong the other way: the host's own correction is
that **the quiz app functions identically without it**, so it is not quiz
functionality at all.

What actually keeps it there is the test this whole section is built on:
**does withholding it degrade the SHOW?** Every other capability held back is
something a room can see is missing. An advert slide is not — a room that never
sees one does not know it was possible. It is a lever for winning the BOOKING,
which is a business outcome for the quizmaster rather than part of the night.
That is what makes it safe to price. And Silver needs it: without it Silver is
content and nothing else, and a rung with no capability of its own is a harder
thing to sell.

So a new round type, a new game, a new look and a new picture effect are Basic
the day they are written. Generating with Claude and artwork with OpenAI are
**owner-only** (a quizmaster never generates — the packs are written for them
and sold, which is the whole arrangement). Streaming is a paid add-on because
egress is a real per-use cost. There is a test that fails if any of the three
ever lands in Basic.

### A lapsed subscription never interrupts a night

**This is the load-bearing rule and it has tests.** Cards expire on a Tuesday
and banks get cautious at the worst moment. So `allowed(..., { live: true })`
is asked by everything a running game touches — the control view, `/api/host/*`,
the SSE stream, the state poll — and it says yes even when the subscription has
lapsed. `mayStartSomething` is the real gate.

The one host action that is NOT exempt is `launch`: starting a brand new night
is a beginning, not an interruption, and it is exactly where "sort the payment
out" belongs. That was a bug first time round — the broad `live` gate let a
lapsed account launch — and it is now checked on the action itself.

### Accounts survive a restart now, and they did not before

`accounts.restore()` and `restoreFromBackup()` in `server.js`, with `getFile()`
in `src/github.js` — which simply did not exist. The accounts were backed up to
the private repo faithfully and **nothing ever read them back**, which on a host
with no permanent disk is the same as not backing them up at all: the login you
made last week quietly stopped existing and the only clue was being asked to
sign in again.

**Only ever into an EMPTY file.** Reading a backup over live data would sign
everybody out and could roll a password change back to the one before it, so a
disk that already has accounts on it always wins. Not fatal either: a missing
backup is the normal first boot, and a GitHub having a bad morning must not stop
a quiz night — the host key still works regardless.

## Read-only packs, and the other half of that

A quizmaster cannot edit or generate a pack. That is the arrangement — the
packs are written to a house style and sold, and three people editing them is
how that style stops being one.

**So they need a way to tell you a question is wrong, or the whole thing just
routes round you by text message.** `src/reports.js`, and it is one tap on the
control view: "Something wrong with this one?" at the bottom of the answer key.
No typing, no dialog, no confirm — the room has just said a question is wrong
and sixty people are waiting, and anything more than a tap does not get used.
The server reads the question off the RUNNING GAME rather than trusting the
browser, so a stale page cannot mis-report.

**A report carries a COPY of the question, not a pointer to it.** By the time it
is read the pack may have been edited or reordered, and "round 2 question 7"
against a changed quiz sends you confidently to the wrong question. The copy is
what was actually on the projector.

The same person reporting the same question twice is ONE report with a later
timestamp — same reasoning as the double-tap guard. Two DIFFERENT people
reporting it is two, because that is evidence rather than noise. When the file
fills, the ones already dealt with go first: an open report is somebody waiting.

Global rather than per-room, deliberately: the packs are shared, so a fault Rob
finds is a fault in the owner's pack. The list is owner-only — a quizmaster
seeing everybody else's corrections is the same mistake as a shared invoice
book — and it sits at the top of `/owner`, above the quizmaster list, because it
is the only thing on that page somebody is waiting on.

**`/api/reports/` had to go in `OWNER_ONLY`.** The broad `FEATURES.QUIZ` gate in
`handleWrite` catches everything that is not exempt, and the owner has no quiz
features to pass it with — so the owner got a 403 dealing with a report on their
own pack. That trap has now bitten twice (generation was the first). Anything
new that only an owner does belongs in that list.

### A SIGN-IN IS A THING TO BACK UP, and it was the one write that was not

Found on a gig day, live, by a deploy landing between Launch and the first
press on the control view. Every button came back **"Wrong host key"** on a
night that was running perfectly.

A session is the SHA-256 of a token sitting in somebody's cookie, and it lives
in `data/accounts.json` — which on a host with no permanent disk is empty
again after every deploy. `restore()` keeps sessions on purpose, and its own
comment says why: dropping them would sign the whole room out on every
restart. **But nothing pushed a backup when somebody signed IN**, so the file
in the private repo was the one written the last time an ACCOUNT changed —
weeks earlier, with `"sessions": []` in it. The accounts came back and the
logins did not, which is the same thing as not keeping them.

So `/api/sign-in` and `/api/sign-out` now `await backUpAccounts()` before they
reply, and the ORDER is the point: the session has to be in the repository
before the browser has the cookie. It can never throw — `backUpAccounts()`
catches everything and reports — so GitHub having a bad morning makes a
sign-in slower and never refuses one. There are three tests: that a backup
taken BEFORE a sign-in cannot carry it, that one taken after can, and a grep
on both routes that fails if the backup ever moves below the reply.

**The message was the second half of it, and it is why ten minutes went on the
wrong thing.** `act()` in `host.js` said "Wrong host key" on every 401 — which
is only ever right when there IS a key. A signed-in quizmaster has never been
given one, so the one screen you drive a gig from sent the host looking for a
credential that does not exist and had nothing to do with it. `whyRefused()`
now tells the three cases apart, because they want three different things
doing about them: retype the key, sign in again, or nothing at all.

**The general rule, and it is worth applying to the next thing that stores
state: on this host, "written to `data/`" means "gone at the next deploy".**
Anything that has to outlive one has to be pushed at the moment it is created,
not at the next unrelated write.

### The invoice book comes back too, and the counter is rebuilt not trusted

`invoices.restore()`, the same shape as the accounts: only into an empty book,
only at boot, a corrupt backup refused rather than believed.

**The care it needs is invoice NUMBERS, and it is not where you would expect.**
They are sequential and never reused. A backup can easily be a few minutes
stale — written before the last invoice went out — so believing its
`nextNumber` would hand out a number that is already on somebody's invoice. Two
customers holding invoice 7 is the one mistake in this area that an accountant
asks about.

So the counter is **rebuilt from the invoices themselves**: one past the highest
number actually present, or the file's own value, whichever is HIGHER. It can
only ever move forwards. There is a test called
"A STALE BACKUP CAN NEVER REISSUE A NUMBER" that issues two, restores a backup
claiming the counter is back at 1, and checks the next one issued is 3.

The prefix is read off the end of the number with a digit match rather than by
splitting on the prefix, because the prefix may well have been changed since —
`renaming the prefix later cannot renumber anything already issued` is already a
rule in that file.

### The first owner is made from the Console, with the host key

Making an owner needed the command line and Render's free tier has no shell, so
there was **no way to create the first login on the live app at all**. A "set up
the first owner" page open to the world is the thing this file rules out, and
rightly. Gated on the HOST KEY it is neither: the key already grants every
feature, so it hands out nothing that holding it did not already give you. The
panel only appears when there are zero accounts and the door closes behind you —
everything after that is owner-only.

### A forgotten password has a way back now — one email, Resend

`src/email.js`, `startReset()` / `whoseReset()` / `useReset()` in
`src/accounts.js`, the three `/api/reset/*` routes and `/reset`.

**It was built because there was NO WAY BACK IN**, and that is worth stating
because it reads like a convenience and is not. A password is only ever a
scrypt hash, so nobody can be told what theirs was. The owner's reset route
takes an account ID — and an owner's own account is deliberately not in the
subscriber list, so even the host key cannot find the id to use it. Render's
free tier has no shell. So a forgotten owner password was a locked door with
nothing behind it, which is exactly the shape of the problem the "make the
first owner from the console" panel was built to solve.

**BREVO or Resend, over plain `fetch`.** No SDK either way, for the reason
nothing else here has one — it is one POST with one header. **Nobody picks a
provider on a button**, the same rule `artProvider()` follows for the picture
round: whichever key is set is the one used, and Brevo wins if both are.

**Brevo is the default because of what a second domain COSTS.** Resend's free
tier allows one sending domain and the host already spends it on another
project; a second is $20 a month, which is a great deal of money for the five
password resets a year this actually sends. Brevo is 300 a day free with
unlimited domains, so `no-reply@quizporium.co.uk` costs nothing — and a reset
link arriving from an unrelated domain is the one place a wrong-looking sender
genuinely matters.

The two APIs disagree about almost everything and that is why `fromAddress()`
returns the name and the address APART: Brevo wants `sender: {name, email}`
and recipients as objects, Resend wants one `"Name <addr>"` string and plain
strings. Both shapes are pinned by tests. `EMAIL_FROM` is the one to set;
`RESEND_FROM` is still read because a live server may have it and quietly
ignoring it would be a silent outage on the one feature whose whole job is
getting somebody back in.

**Without a key it is a STATE, not a failure** — the page says so plainly
rather than offering a button that cannot work, because "check your inbox" for
an email that will never arrive is the worst possible answer to somebody
locked out.

**This is for resetting a password and NOTHING ELSE.** Not notifications, not
reminders, not marketing — those are parked in TODO.md, they want a different
sending domain, and a surprise email from the app somebody runs their
livelihood on is not a small thing.

Six properties, all tested, and each is there because a reset link is a
password sitting in an inbox:

- **Only the HASH is stored**, exactly like a session token, so a copy of the
  accounts file is not a bag of live links.
- **A link works ONCE**, or it sits in an inbox for ever one forwarded email
  away from being somebody else's way in. Thirty minutes, and asking again
  replaces the last one rather than leaving a trail.
- **THE PASSWORD IS CHECKED BEFORE THE LINK IS SPENT.** The obvious order —
  clear the token, then set the password — burns the only way back into the
  account on a typo. Found by its own test.
- **An unknown address is never told it is unknown.** Same sentence either way,
  the same care the sign-in error takes.
- **A held-down button cannot post somebody a hundred emails** at the owner's
  expense: one a minute per account.
- **The token lives ON THE ACCOUNT**, so it survives a restart. Anywhere else
  and it would die on precisely the deploy that is quite likely to be why
  somebody is signing in again.

**THE KEY IS KEPT ALIVE, and that is not fussiness.** Brevo expires an API key
after **90 days of INACTIVITY** whatever expiry date was chosen for it — and
this app sends about five password resets a year, so the key would go ninety
days idle and die quietly, to be discovered on the one evening somebody is
locked out and in a hurry. `keepKeyAlive()` makes one `GET /v3/account` at boot
and weekly: authenticated activity, no email, nothing created. `unref()`'d so
it can never hold the process open, never awaited and never reported, because a
mail provider having a bad morning has nothing to do with whether a quiz runs
tonight. Brevo does not document exactly which calls reset the idle clock, so
this is the best available guess rather than a guarantee — the real backstop is
that the reset page names the cause if the key has gone anyway.

**Setting a password does not sign you in.** Every session is dropped when it
changes — which is what somebody worried enough to reset one wants — and a
link in an inbox should not be a way to be signed in by clicking it.

**One weighed trade-off, written up at the route:** while the mail service is
broken, a known address answers `ok: false` and an unknown one `ok: true`, so
the two can be told apart. Kept, because the person asking is already locked
out and a silent failure costs them the evening. If the account list ever gets
big enough for enumeration to matter, report send failures to the owner's
console rather than hiding them from everybody.

### Passwords and sessions

scrypt from node's own crypto, salted per account, compared timing-safe. **The
password is never stored**, so the owner genuinely cannot read a subscriber's —
which is the honest version of "your account is private from me". Only the
SHA-256 of a session token is stored, so a copy of the file is not a set of
live logins. A wrong password and an unknown address give the identical message,
or the page cheerfully confirms who has an account here.

### One login, two hats — and it is how the quizmaster's bugs get found

`ACTING_COOKIE` in `server.js`, `ownQuizmasterFor()` in `accounts.js`, and
`hatSwitch()` in `client.js`.

**The switch is a tab in the top right — Owner | Quizmaster, plus the rungs —
and it is the SIGN as well as the switch.** ONE MENU IN EVERY STATE: the same
control on the owner page, the console and behind the host key, so it is never a
different shape depending where you are. Tapping a rung with the hat off means
"put it on and show me that tier", because that is what pressing B actually
means — making somebody press Quizmaster first was a step that existed only
because of how the code was arranged.

**Two colour languages would be one too many, so there is one.** Whichever half
is live wears the app's own red-into-orange, whatever it is; the rungs beside it
carry the metals, because there the colour IS the meaning. Which hat is on stays
unmissable through the gold hairline under the topbar. The topbar is sticky, so unlike
the bar it replaced it never scrolls away, and the body picks up a gold hairline
while the hat is on so even a screenshot of the middle of the console says which
hat it was taken in.

It replaced a "Become a quizmaster" panel on `/owner` AND a bar across the top
of everything. Two ways to do one job is how you end up using the worse one out
of habit, and the worse one was the panel — it only existed on the owner page,
so getting back meant finding a bar at the top of a different one.

**Only an owner ever sees it, and only their own two hats.** A real quizmaster
has nothing to switch to.

**Stated by the host as a HARD RULE and now pinned by tests** (`test/hat-switch.test.js`):
it is on every one of HIS accounts for ever — the owner account and the linked
quizmaster one, wherever he is — and it must **never** appear on anybody
else's. That second half is a leak rather than a layout preference: a real
quizmaster who could see Owner | Quizmaster would be looking at a control
saying somebody else's account exists and is reachable from theirs. The tests
cover the refusals, including the trap that **the host key alone is not an
owner** — on the key the server answers as the bootstrap identity, whose role
is "quizmaster", so the switch appears only when the same browser is also
signed in as the owner underneath. A `previewTier` in the payload conjures
nothing either: it is a drawing hint, not an identity.

**A remembered key is dropped the moment a signed-in owner turns up.** A key
typed once used to be kept for good, so a browser that had ever touched a
`?key=` link stayed on the key — and the switch showed a third position long
after there was any reason for it, which reads as a bug nobody can account for.
The check is on `alsoSignedIn`, NOT on `me.role`: with a key in play the server
answers as the bootstrap identity, whose role is "quizmaster". Using a `?key=`
link deliberately still puts you on the key for that visit.

**On the HOST KEY it grows a third position — Host key | Owner | Quizmaster.**
The key beats the cookie on the server and that ordering stays exactly as it
was, but it used to mean the switch vanished the moment a browser had seen
`?key=…` — so the one laptop that is both the dev machine and the gig machine
could never look at the quizmaster side at all. `/api/me` now reports
`alsoSignedIn` when a bootstrap request also carries an owner cookie, and
picking a hat FORGETS the remembered key (localStorage and the `?key=` in the
address bar, or it would win again on the next load and the switch would look
broken). The bookmark still works, because the key lives in its URL — so this
is a way out, never a lock-out. Saying "Host key" out loud matters too: it is
why that console looks nothing like what a subscriber sees.

### …and as a Bronze, Silver or Gold subscriber

`TIER_COOKIE` in server.js, `tierPreview()` in client.js. With the hat on, the
switch grows a second half — **All · B · S · G** — and picking a rung shows the
console exactly as a subscriber on that tier sees it.

**This is the other half of the problem the hat was built for.** The hat exists
because every irritation a real quizmaster hits is invisible from behind the
host key. But the linked quizmaster account is **comped**, so wearing the hat
has only ever shown the TOP of the ladder — and every irritation a Bronze
subscriber hits is invisible from there for exactly the same reason. "Rob says
the Invoices tab has gone" is not a question answerable from an account that has
everything.

**It is a genuine downgrade, gate included.** The console draws as that tier and
`/api/invoices` returns 403 for a Bronze preview — because the whole value is
catching the places where the page and the API disagree, which is precisely what
the permissions sweep found five of. A preview that only changed the drawing
would hide the bug it exists to find.

**`comped` MUST be cleared when a tier is previewed**, or the tier is
decoration: a comped account holds the whole ladder whatever tier it says. There
is a test named after that failure.

**Only ever a downgrade, and only the owner's own account.** There is no rung
above the top of the ladder and the linked account already holds all of it, so
this cannot widen anything. A real quizmaster is sent no picker to draw and gets
a 403 asking for one directly — both checked in a browser.

Taking the hat off clears the preview cookie as well as the acting one. A tier
left behind would silently apply the next time the hat went on, which is how you
end up hunting for a bug in the app that is really in your own session.

**Switching cannot disturb a night in progress**, which is why there is no
confirm step: the two hats are two ROOMS, and a room keeps its own game, its own
phones and its own state file. The worst a mis-tap does is show you the other
room until you tap back. `actingBar()` survives on the control view only, where
it is the indicator and not a switch — you change hats where you administer, not
while driving a night.

Mark is the app dev AND a quizmaster, on one laptop. Two logins meant two
passwords and signing in and out; the host key meant every hat at once, which
is worse for a different reason — **behind the host key, every irritation a real
quizmaster hits is invisible.** So the owner switches into their own linked
quizmaster account and gets exactly what a subscriber gets: their own room,
their own join code, read-only packs, no generator, owner routes 403.

**It is only ever a DOWNGRADE, and only ever into the owner's OWN account.**
The linked account carries `ownedBy: <ownerId>` and `whoIs()` checks that
against the book rather than trusting the cookie. Acting as somebody ELSE's
quizmaster is support access — theirs to grant, and logged — which is a
different feature and deliberately not this one.

The linked account has a long random password nobody ever sees: it is never
signed into directly, which is what makes "one login" true and means there is
no second password to lose.

**This paid for itself immediately.** The first time the hat went on it showed a
signed-in quizmaster could DELETE one of the owner's quizzes — see below.

### Writing to the pack library is the owner's alone

**`src/gates.js`** — `changesTheLibrary()` and `OWNER_ONLY`, imported by
`server.js`. Reading the library is `FEATURES.LIBRARY`, which every quizmaster
has — they play the packs, that is the arrangement. Saving, deleting, renaming,
importing, annotating and the playlist step are `FEATURES.CATALOGUE`, owner only.

Before this, every pack-write route was gated only by the broad `FEATURES.QUIZ`
check, which every quizmaster passes. **A signed-in subscriber could have
deleted a quiz an hour before a gig** — and far more likely by mis-tapping a
Delete button the console was drawing for them than by meaning to. It is a
prefix test rather than a check on each route precisely so the next
pack-writing route somebody adds is covered without anybody remembering to.

Note the ordering trap, which has now caught something **four** times: the
owner has no quiz features, so anything only an owner may do must skip the broad
gate as well as pass its own. The fourth was **Import** — the main way bingo
packs are made — where the owner got a 403 on his own console.

**It lives in its own file because a rule you cannot import is a rule you cannot
write a test for**, and this one was wrong twice. `test/gates.test.js` asserts
the bare path AND the prefix for every pack route, and that every owner-only
route is on one list or the other, which is the thing that fails when somebody
adds a fifth.

### What a sweep as a quizmaster actually found

**The burglar is called RoboRob, and he is not Rob.** Rob is a real person who
is going to be handed a login, and he is the innocent second quizmaster in every
other example in this file — the one who presses Launch, finds a wrong question,
and needs his own room. **RoboRob is a throwaway test account** signed in and
pointed at every route a subscriber should not reach. Where this file says a
quizmaster "could have deleted a quiz", that is a statement about what the
SOFTWARE allowed, never about anybody's intentions. Keep the two apart in
anything written down: a repo is read by the people in it.

Five things worked, and the shape of each is worth keeping:

- **`POST /api/quiz` took the id in the BODY**, so `startsWith('/api/quiz/')` —
  with the trailing slash — never matched it. DELETE and PUT were shut and this
  was wide open: the Madonna pack came back titled "ROBOROB WAS HERE". `POST
  /api/bingo` was identical. **Match the bare path as well as the prefix.**
- **Import, the playlist builder and `history/forget` were open**, because none
  of them looks like "saving a pack". Forgetting the history wiped all 319
  entries — the failure nobody sees for three months, when a song comes back in
  front of a room.
- **Three routes on the Invoices tab asked for `FEATURES.LIBRARY`**, which every
  quizmaster has, rather than the admin add-on: the PDF, the status change and
  deleting a customer. A subscriber with no add-on at all downloaded an invoice
  carrying the host's own sort code. There is a test that reads `server.js` and
  fails if any `/api/invoices` route is gated on the library — the same trick
  `looks.test.js` uses for emoji.

**What held:** rooms. Every attempt to reach another quizmaster's night —
`?g=CODE`, `room`, `roomId`, `joinCode` in the body — landed in the attacker's
own room, because `/api/host/*` works out the room from WHO YOU ARE and takes no
room parameter. The other game carried on untouched. Also held: the account
routes, the corrections book, generation, path traversal on every static route,
and the screen payload, which carries no answer key to an unauthenticated fetch.

**And the console has to agree with the server.** Every one of these was fixed
in `server.js` first and then in `console.js`, because a Delete button that
returns 403 is worse than no Delete button. A quizmaster's pack card is **Read
and Launch** and nothing else; the read-through shows the questions, the answers
and the review flags with nothing to press.

### The host key was showing itself the shop

Found by the same sweep, and it was live: `allowed()` in `server.js`
short-circuits on `account.bootstrap` and grants everything, but the BROWSER
copy of `plans.js` scored the host key as a basic quizmaster with two add-ons.
So `/api/me` reported no `owner.*` features and the console drew a page for
somebody who cannot generate — **"have a look in the shop" where the generator
goes, shown to the man who writes the packs.**

`can()` and `featuresFor()` now say yes to everything for a bootstrap account,
which cannot widen anything: the key already grants the lot server-side. This is
the third time the two copies have disagreed, after the launch buttons and the
`keyed('/api/me')` fetch. **If a control is missing on the host key, suspect
this before building it again.**

### The console is the CATALOGUE, and the catalogue is the owner's

An owner used to be bounced from `/console` straight to `/owner`, which left
nowhere at all to generate or import a pack: the generator lives on the console
and the owner page had only subscribers and reported questions on it. So the
only way to write a quiz was the HOST KEY — an account was strictly worse than
the thing it replaced, and that is what the host reported.

So the split is by JOB rather than by page:

- **`/owner` is the business** — who subscribes, what tier, what they reported.
- **`/console` is the product** — every pack, the generators, Import, the
  read-through, the editor.

Both pages carry the hat switch, and there is one link between them.

The pack tabs therefore ask for `FEATURES.LIBRARY` rather than for the game
features: reading and writing the catalogue is not the same question as running
a night. What an owner still cannot do on the console is LAUNCH — the Launch
buttons and the whole running panel are gated on `QUIZ`/`BINGO`, which an owner
deliberately has none of, so their room can never be driven from there.

**An owner is never sold anything.** `visibleTabs()` drops a tab they do not
hold rather than greying it with a price — the upsell is for subscribers, and
the owner is not a customer.

### The control view no longer needs a key at all

A quizmaster who signed in and opened `/host` was asked for a host key they have
never been given and no way to get — so Rob could launch a game from his console
and then not drive it. Their cookie already says who they are and which room is
theirs; that is enough, and `/host` now asks the server before deciding.

The key still works and still wins where both are present, for the same reason
it wins on the server.

### The host key BEATS a signed-in account, and that ordering is load-bearing

`whoIs()` checks the key first. It looks like a detail and it is the difference
between a gig running and not.

The owner account has no quiz controls at all — that is the design, the owner
writes and sells packs and does not run nights. But Mark is one person with two
hats and **one laptop**. The evening he first makes an owner account, that
browser holds an owner cookie; opening the `?key=` console bookmark that has run
quiz nights for months would then bounce him to the owner page, which has no
Launch button anywhere. Minutes before a gig, with no way back except working
out that he had to sign out.

It gives nothing away: the key already grants every feature, so preferring it
cannot widen what its holder can do. It only means the way in that predates
accounts keeps working whatever else is going on in the browser — which is the
whole reason it is still here.

Two matching rules on the browser side, and the second was found by testing the
first: the console does not redirect an owner to `/owner` **if a key is
present**, and it asks `/api/me` **with the key on it**. Without that second one
the API would happily launch while the page drew no Launch buttons at all,
because the browser copy of `plans.js` had been told it was the owner. There
are tests that the owner cannot run a night and that the host-key identity can.

### The host key still works, and that is deliberate

There are gigs in the diary and `?key=…` on somebody's phone, so the day
accounts arrived could not be the day the old way stopped. A request carrying
`HOST_KEY` is treated as every hat at once — `BOOTSTRAP` in `server.js`, one
branch in `allowed()`. Retiring it later is deleting those two places.

The first accounts are made from the command line (`npm run accounts`), not
from a web page: a "create the first owner" route is a door that only ever
needs opening once and can be walked through by whoever finds it first.

**It backs up to the PRIVATE repo**, like the invoices, and for a stronger
reason — email addresses and password hashes.

### A room per quizmaster — how a second login became safe

`src/rooms.js`. Everything that belongs to ONE NIGHT hangs off a room: the
session, its own state file, its own photo wall and its own join code. Before
this, `session`, `store` and `photos` were module-level singletons — which is
exactly what made a second login dangerous. Rob pressing Launch would have
ended Mark's night mid-question, and a photo Rob's tester sent would have gone
six feet wide onto Mark's projector. There is a test for both.

**A room is decided by WHO YOU ARE, never by anything a request carries.**
`/api/host/*` takes no room parameter on purpose: a control view that could be
pointed at somebody else's night is the whole thing this prevents. Phones are
the other way round — they are told a code off the projector.

**The house room keeps the original file locations, and that is not tidiness.**
`data/state.json` and `data/photos/`, exactly where the single-game version put
them. There are gigs in the diary and Mark may deploy between rounds; moving
the state file would bring the app back with no game, no scores and an empty
photo wall in front of sixty people. Only additional rooms get a folder.

**The house room has no join code**, so `/play` with nothing after it still
works — which is what every printed card, every bookmark and every QR scanned
at a gig says. Nothing had to be reprinted. Other rooms are `/play?g=CODE`, and
a phone REMEMBERS the code next to its player id, for the same reason it
remembers the id: a locked phone that comes back must land in the same game
rather than somewhere else with no score.

Codes leave out vowels and O/0/I/1/L — no code can spell a word, and none of
the pairs people mistype off a projector are in it. A code that does not match
finds **nothing**, never a near miss: sending somebody into the wrong
quizmaster's game is far worse than telling them to look again.

**Still shared on purpose:** the pack library and the portrait library. The
owner writes the quizzes and sells them; a quizmaster plays them and never
generates. One library read by everybody IS the product. Whether you may EDIT
one is a `plans.js` question, not a rooms question. Saving a pack reloads it in
**every** room playing it (`reloadPackEverywhere`) — missing one would leave
that quizmaster running the version from before the edit.

### "Never played" means YOUR nights

`library-stats.json`, keyed by room — `statsFor()` and `recordLaunch()` in
`src/library.js`. The pack library is shared, but how often you have run
something is a fact about your nights rather than about the file. Counted
globally it would tell Rob that a quiz he has never opened was played twice
last week, which is worse than no count at all: the only use of that line is
deciding what not to run at the same venue again.

One file rather than one per room, so it is one thing to back up.

**It was the only thing in `data/` with no backup at all**, which is why the
host reported packs saying "Never played" after playing them — every deploy
reset the lot, and nothing on screen tells "never" apart from "forgotten". It
goes to the PRIVATE repo like the accounts and the invoices: it is a record of
somebody's nights, not of the packs, which are the public repo's. Restored only
into an absent file, same rule as everything else — a disk with counts on it is
ahead of any backup.

**The flat shape from before rooms is read as the HOUSE's**, because back then
there was only one game and all of it was Mark's. Reading it as anybody's would
hand a brand new quizmaster somebody else's history; throwing it away would
reset the counts it is the point of. It is folded into the house on the next
launch so the file never holds two answers to one question. Tested.

`HOUSE` in `rooms.js` is now `HOUSE_ROOM` re-exported from `library.js` rather
than the same string written out twice — if those two ever disagreed, launches
would be filed under a room nothing reads and the count would silently stay on
zero. There is a test that they are one string.

### The suggestion box — ideas, irritations and bugs

`src/suggestions.js`, `suggestionPanel()` in `console.js`, `suggestionsPanel()`
in `owner.js`.

**Deliberately NOT the same list as `reports.js`.** A report says "this
question is wrong", which is a fault in a pack and is answered by editing the
pack. A suggestion is about the APP. One pile of both is a page you skim rather
than work through.

**Why a box and not a support hour.** The host asked about a weekly Q&A window.
A scheduled hour only works at a scale that does not exist yet — with two
subscribers it is a phone call — and it asks somebody to REMEMBER at 7pm on a
Tuesday what annoyed them at 9:40pm mid-gig. The good ones do not survive that
trip. This is the same shape as "Something wrong with this one?" on the answer
key and works for the same reason: it catches the thought as it happens. It is
asynchronous on purpose, so nobody is ever on call.

**Three kinds** — an idea, something that got in the way, something broken —
because they want completely different things doing about them and because
three is what somebody can pick from without reading.

**A fourth kind is a PACK REQUEST, and it is the one that is gated.** "There is
no One Direction quiz and I want one." It lives in this box rather than in a
subsystem of its own because what it needs is exactly what a suggestion needs —
somebody to read it, decide, and say yes or no in words — and the inbox, the
reply that clears it, the draft button and the been-opened receipt all already
exist. A second list would be a second place to forget to look.

**The reason it is Gold is NOT the per-use rule**, and getting that straight
matters for the next feature: a request costs nothing until the owner agrees to
it, so no bill is ever automatic. What it spends is the **owner's writing
time** — about £2 and twenty minutes of reading, for one person — which is the
one genuinely scarce thing in this business. And that is the same thing Gold
already sells: **Silver buys the owner's BACK CATALOGUE, Gold buys the owner's
TIME.** A weekly topical quiz, and now a pack written to order.

**Two limits, and only one of them is about the subscriber.** One open request
at a time AND one a month per account, both in `suggestions.js` — without the
second, "one open at a time" means ask Monday, receive Monday, ask again
Tuesday, and fifty-two packs a year from one person.

**The constraint that actually binds is the OWNER'S MONDAY**, and that is
handled by a QUEUE POSITION rather than a cap. A global weekly limit would
refuse somebody who asked on Sunday night because three others got there first,
which reads as "Gold, but be quick" — and a control that refuses is the mistake
this file keeps recording. A queue never says no, it says when.

**Saying WHICH DAY is worth more than the limit is.** The host does his admin
on Mondays, so that is when the inbox is read and the generator pressed.
`PACK_DAY` and `nextPackDay()`; the panel says *"Written on Mondays — ask
before then and it is in your library on 17 August"*. A request with no stated
turnaround is a promise broken by silence: the subscriber does not know whether
it is coming on Thursday or at all, so they chase, or they quietly stop
believing in the feature.

**MONDAY IS THE ADMIN DAY FOR THE APP ITSELF, not only for packs.** Stated by
the host on 12 August 2026: changes people ask for get made on Mondays and not
before. That is the same promise the pack panel already makes and it should be
said in the suggestion box too, which currently states no turnaround at all —
so somebody reporting something on a Tuesday has no idea whether it is Thursday
or never, which is the exact failure the paragraph above describes.

**ONE LINE FOR ALL THREE KINDS. There is deliberately no emergency channel, and
that was argued and settled rather than overlooked.** The obvious refinement is
to say "Monday" over an idea and something faster over "something broken" —
proposed, and turned down by the host for three reasons, each of which is
sufficient on its own:

- **It designs for a failure the app is committed to preventing.** The whole
  codebase is organised around not breaking a Wednesday night, and it has to be
  that stable before anybody is charged. An escape hatch for "the app ruined my
  gig" is planning for the thing that must not happen.
- **An emergency button gets pressed for non-emergencies**, not maliciously —
  "urgent to me" is not the same as urgent. Then it means nothing, and the one
  real emergency is buried among the ones about a confusing button. Exactly the
  reasoning that keeps a second badge off the owner's tabs: a second badge costs
  the first one its meaning.
- **It advertises that the app breaks quiz nights.** A subscriber reading it
  concludes this is expected, which is the opposite of what is being sold.

And at two subscribers the emergency channel is a phone number. Building one
into the app is premature and would need staffing behind it to be real. **If it
ever comes back it is a support function with hours, not a button.**

**The whole state is sent BEFORE anybody types** (`packRequestStatus()`, on the
library payload). Being refused after writing three sentences is the version
that annoys; "that is this month's, the next is from the 1st" is a sentence
somebody can plan around. Once asked, the panel becomes the queue position
rather than an empty box.

**The owner's inbox gives pack requests their own pile**, because they are a
different JOB — everything else there needs a decision and a reply, this needs
the generator pressed and twenty minutes of reading, and it all happens on one
admin day. A list where those are scattered among the ideas is one you work
through twice.

**Gated on the SERVER**, where the kind is received — not left to the console
not drawing the option. A kind is one word in a request body, which is exactly
the shape of the hole `POST /api/quiz` had. There is a test that reads
`server.js` and fails if the check goes missing.

The entry point is under the SHOP on the pack tabs rather than in this panel,
because that is where the want actually arrives: you have scrolled the
catalogue, you have scrolled the shelf, and neither has the thing. A rung below
Gold sees the offer rather than nothing — same as the tab bar's `+`.

**Sending is open to anybody signed in and NOT gated on a tier.** The people
most worth hearing from are the ones having the worst time, who are the least
likely to be on the top rung. Reading the list is owner-only, same reasoning as
the corrections book: a quizmaster seeing everybody else's complaints is the
shared-invoice-book mistake again.

**It carries which tab they were on**, sent by the browser rather than guessed.
That is the difference between "the editor is confusing" being actionable and
being a shrug.

**It is an INBOX, not a list.** `suggestionsPanel()` in `owner.js` shows two
piles — "To deal with" and "Cleared" — and **replying clears it by default**,
because the point of the list is that it gets shorter. An inbox where answering
something leaves it sitting in the pile is one you stop trusting to tell you
what is left, and then you stop reading it. Reopening is one tap.

**Each message is signed with a first name and a short reference** (`#FAMQ`),
taken from the account id rather than stored. Not secrecy — the owner can see
email addresses elsewhere — but an inbox reads better as "Rob · #FAMQ" than as
an address, and a reference can be quoted back at somebody without spelling out
their email.

**Draft a reply, never send one.** `src/reply-draft.js` asks Claude for three
or four sentences and puts them in the box; Send is still a separate, deliberate
press. A reply that goes out unread is the one that goes publicly wrong —
apologising for something that did not happen, or promising a feature that is
not being built. The brief carries what the app is and the house rules for
writing (British English, no marketing voice, **never promise a date, a feature
or a refund**, and ask one specific question rather than guessing). It is NOT
the generator's `askClaude`: that parses JSON, and this wants prose.

**Three things go into a draft beyond the message, and each answers a
different question.** None of them is training — there is no learning loop
anywhere, and it is worth saying that plainly to anybody who asks:

- **The house notes** (`suggestions.house`, edited on the owner page) are what
  the OWNER has taught it. This is the only way the drafts get corrected: a
  draft says something wrong, a line goes in, it stops saying it. They are
  followed where they disagree with the brief — **except** the rule about never
  promising a date, a feature or a refund, which outranks them, or a careless
  note would turn the button into a liability. There is a test.
- **The facts** (`factsFor()`) are who it is talking TO: their tier, how long
  they have subscribed, whether they have written in before and whether those
  were answered. Deliberately NOT their email or anything from their invoice
  book — a reply needs to know who it is addressing, not everything about them.
- **The voice** (`voiceFrom()`) is how the owner has answered before, newest
  six. **This is the only part that improves on its own**: every reply sent is
  another example. Given as STYLE and never as facts to reuse, because a past
  reply may carry a promise made to one person about one thing and a model told
  to be consistent would repeat it to somebody else.

**AND IT MUST NOT LEARN FROM ITSELF.** The host spotted this before it was
built: press Draft, send it barely edited, and that reply becomes an example
for the next draft — so it imitates its own output, drifting a little more
generic each time and quietly amplifying any phrase the owner would never use,
because it keeps coming back as evidence of how they write.

So `mostlyMine()` compares what was SENT against the draft that was offered,
and anything largely unedited is stored `machine: true` and kept out of the
examples. Measured on WORDS, because fixing a typo is not writing it yourself
and rewriting a sentence is — a character diff cannot tell those apart. **The
threshold leans towards calling it machine on purpose**: wrongly excluding one
costs nothing, while wrongly including one poisons the examples, which is the
whole problem. With nothing but machine replies there are simply no examples
and the draft falls back to the written brief — no voice beats a voice made of
its own echoes.

**The button only appears when there is a key.** `canDraft` comes back with the
list, so a missing `ANTHROPIC_API_KEY` is a button that is not there rather than
one that errors when pressed.

**A reply says whether it has been OPENED.** `markSeen()` stamps a reply the
first time that quizmaster's console draws their own threads — so the label is
"opened", never "read", because their console rendering it is all any read
receipt has ever meant. Only ever fills a blank: the FIRST time is the useful
fact, and rewriting it on every page load would turn a receipt into a "they
were looking a second ago" ticker. The owner refreshing their own inbox marks
nothing, and a second reply is unopened again even though the first was seen.

**The quizmaster sees their own thread and the replies to it.** Without that
the box is one-way — you send something into the dark and never learn whether
it landed, which is how a feedback route stops being used after the second time.

**The routes answer BEFORE the broad `FEATURES.QUIZ` gate**, or the owner would
get a 403 on their own suggestion box — the trap that has now caught something
six times. That works because of where they sit in the file, which is fragile,
so `test/gates.test.js` pins the ORDERING rather than the behaviour.

### Support access — their door, their log

`openSupport()` / `closeSupport()` / `supportOpen()` / `noteSupport()` in
`src/accounts.js`, the second branch of `whoIs()` and `supportGuard()` in
`server.js`, `supportPanel()` in `console.js`.

**A quizmaster's own material is their work**, and other quizmasters will assume
the worst about a competitor who can read it. So the answer is not a promise
not to look: the app refuses until they open the door, it shuts itself again,
and everything done inside is written down where they can read it.

**It is a SWITCH, not a duration to pick.** Choosing "1 hour or 8 or 24" is a
decision at the worst possible moment — they do not yet know how long the
problem takes. On, then off the second it is sorted, and off is instant.

**And it runs on a DEAD MAN'S SWITCH.** Half an hour at a time; the panel
counts down, asks "still need help?" with five minutes left, and one tap resets
it. Nobody has to remember to close anything — walking away IS closing it,
which is the right outcome for somebody called away mid-conversation. Reopening
costs one tap, so being shut out early is cheap while being left open for a
week is impossible. `openedAt` is when they FIRST let you in and is not
rewritten by a confirmation, or the log would misreport when the session
started. The countdown is a plain local timer, because the console holds no
live connection and a clock is something a browser can do on its own.

**Checked on every request, not once on the way in.** Otherwise a session
outlives the window, which is the whole guarantee undone by a cookie.

**The acting flag is `inSupport`, and it must NEVER be the account's own
`support` object.** It was `support: true` — which collides with the name of
the GRANT that every subscriber who switches access on carries. So
`supportGuard` read a truthy `support` on Rob-signed-in-as-Rob and treated him
as the owner inside his own account: every `/api/host/*` route 403'd with
"support access cannot run a night", **so a quizmaster who left the door open
could not run their own quiz**, and his own Next and Reveal went into the log
as though somebody else had tried them. Two meanings on one field name, found
by signing in as the owner and probing a live server.

**In the console the grant is `me.support`, because `me` IS the account**
(`me = who.signedIn ? who.account : null`). `/api/me` answers
`{ signedIn, account, … }`, so reading the raw payload makes that look wrong
and invites a "correction" one level deeper — which is undefined, and silently
empties the log without breaking anything else on the page. There is a test
pinning it both ways.

**Three refusals, each a different failure:** no grant or an expired one; their
room is BUSY, because going in mid-round is one mis-tap from ending somebody's
night; and host actions are blocked for the whole session, in case a game
starts while somebody is already inside.

`busy` rather than `live` matters: `live` means "past the lobby", so forty
people sitting in a lobby with their team names typed in did not count and the
owner was let straight in. `busy` means what the launch guard already means —
anybody joined counts — and two guards with two definitions of "a night in
progress" is how one of them quietly becomes wrong. The owner also cannot open the door
from within a session — one grant extending itself for ever is the expiry
undone in one line.

**The host key cannot act as anybody, grant or no grant.** `whoIs()` returns
`BOOTSTRAP` for a key and never reads the acting cookie, so holding the key
does not open a subscriber's account either. There is a test asserting that
ORDER, because flipping it would silently make the key a way into every
account.

**The log is what the OWNER did, never what the subscriber did.** It answers
"what did you do in my account", not "here is a diary of your own use" — a
quizmaster scrolling their own launches and pack-opens back would learn nothing
about the owner and would have to pick their activity out of it to find the
entries that matter, which is the same as not having it. The whole guarantee is
one early return in `supportGuard`, and it has a test of its own because the
flag could be named right and this could still break by somebody moving the
logging call above the return.

**Reads are logged as well as writes.** "Did you look at my quizzes" is the
question the log exists to answer, and a writes-only log is silent about
exactly that. The noise that would drown it — the state poll, the live stream,
health, `/api/me` — is skipped. Entries are written in WORDS (`supportWords()`)
rather than route paths: this is read by somebody deciding whether they trust
you, so "Looked at your pack library" beats "GET /api/library". Anything
unmapped falls back to the raw route, because an ugly line beats a missing one.

**And looking has to be told apart from changing on their OWN packs, not just
the catalogue.** `read` was worked out and then ignored for `/api/mine/*`, so
opening one of their quizzes was written down as *"Changed your own pack"* and
listing them as *"Saved one of your own packs"*. On the one log whose whole job
is saying what was done to somebody's material, an entry that accuses you of
altering their work when you only looked is worse than a missing one — because
they will believe it.

**What this cannot promise, and do not overstate it to a subscriber:** the owner
runs the server, the disk and the backups, and the server has to be able to
read a quiz to put it on a projector — so end-to-end encryption is impossible
here by construction. This is access control and an audit trail, which is what
every hosted service has. The honest pitch is "the app will not let me in
unless you let me, and here is the log", not "I cannot see it".

### The invoice book, the archive and the advert slides are per room now

They were the three things rooms left behind, and each was a different problem
waiting for the day a second login existed. `pathsFor()` in `rooms.js` decides
where they live; nothing else had to learn that rooms exist, because all three
already took a path.

- **The invoice book** holds a quizmaster's own customers, their addresses and
  their own sort code. Rob would have seen Mark's, and a guessed invoice number
  would have downloaded Mark's PDF.
- **The archive** is a record of somebody's own nights.
- **The advert slides** were the loud one: one folder meant a second quizmaster
  tidying what looked like their own venue list would delete The Crown's set off
  Mark's projector.

**The house room keeps every original location** — `data/invoicing.json`,
`data/archive/`, the top-level `adverts/` — for exactly the reason the state
file did: a deploy mid-season must not bring the app back with an empty invoice
book. Only an additional room gets a folder. Tested.

**Invoice NUMBERS are per book, and two quizmasters both starting at 1 is
correct.** They are separate businesses issuing their own invoices, not two
people sharing a pad. Each book backs up under its own name in the private repo
— the house keeps `invoicing.json` so the backup Mark already has carries on
working — and a room's book is restored the first time that quizmaster opens
the tab, because rooms are made lazily and the boot restore runs once.

**`/api/advert` came OFF `changesTheLibrary()`**, which this file promised would
happen the day they were scoped per room. Watch the trap, because it has now
caught something FIVE times: taking a route off that list drops it into the
broad `FEATURES.QUIZ` gate, which the OWNER fails by design. Advert writes
therefore have an explicit `FEATURES.ADVERTS` gate of their own, and there is a
test that reads `server.js` and fails if it goes missing. An owner still cannot
write one, and that is consistent rather than an oversight — an owner runs no
nights, so they have no projector to put a slide on.

**A missing advert set says "No advert set with that name."** It used to pass
`err.message` through, which on a miss is an ENOENT carrying the server's
absolute path — telling an unknown caller the directory layout and the room id
it had just looked in.

### A quizmaster's OWN packs — and the one rule that runs backwards

`src/own-packs.js`, `paths.ownQuizzes` / `paths.ownBingo` in `rooms.js`, and
the `/api/mine/*` routes. A subscriber writes their own quizzes and bingo games
alongside the catalogue's, marked **Yours** on the pack card.

**Every other gate in this app asks "has this account paid for that". This one
asks the opposite: the OWNER must not be able to read them.** It is their
intellectual property, not stock in somebody else's shop, and every other
quizmaster will assume the worst about a competitor who can read their
questions.

**The enforcement is structural, not a check somebody has to remember to
write.** No route takes a room parameter — every one works the room out from
who you are — and a room's own packs live under that room's own folder. So
there is no pack id and no query string that reaches another room's folder,
which is the same property that already stops one quizmaster driving another's
game. An owner asking by id resolves against the house room, finds nothing, and
falls through to the catalogue. The one way in is **support access**, which they
switch on, which expires on its own, and which writes "Opened your pack …" into
the log they can read. This is the first feature that genuinely needed it.

**Be honest about what that is.** The owner runs the server, the disk and the
backups, and the server has to be able to read a quiz to put it on a projector,
so it cannot be encrypted from the person hosting it. This is access control and
an audit trail — "the app will not let me in unless you let me, and here is the
log", never "I cannot see it".

**Two prefixes, because a path test cannot look inside a request.**
`changesTheLibrary()` in `gates.js` is what keeps subscribers out of the
catalogue, and it matches on the route alone — it cannot tell which of two
libraries a pack id belongs to. So `/api/quiz` and `/api/bingo` write the
CATALOGUE and stay the owner's, and `/api/mine/*` writes the room's own folder
and can never touch the catalogue. Sharing one route would have meant either
loosening the tested rule or writing a second copy of it with no test on it.
There is a test that every `/api/mine` route asks for `OWN_PACKS` by name.

**Reading is ONE route for both**, resolved own-library-first
(`readPack`). That is what lets every existing route carry on taking a bare
pack id rather than growing a "which library" parameter somebody would
eventually pass from a request body.

**They still do not generate.** No Claude call exists anywhere under
`/api/mine/`. That is the owner's bill and the owner's house style, and it is
the arrangement. What they get instead is the editor and the same track-list
importer, pointed at their own folder — with the **no-repeats memory left out
in both directions**, because that is the owner's generator's record of what IT
has used: reading it would silently drop songs out of a list a subscriber pasted
deliberately, and writing to it would make the owner's next generated pack avoid
tracks it has never played.

**A tier can never take a pack they wrote away from them.** The tier lever is
the owner's catalogue — a starter set that runs out in month four. Applying it
to their own work would mean their quiz disappearing off their own console
because of what they pay the owner, which is not an upsell. `onlyTheirPacks()`
spares anything marked `mine`, and there is a test.

**Their own pack may not take a catalogue id.** Resolution looks in their folder
first, so it would SHADOW it — Launch would quietly play a different quiz from
the one everybody else sees under that name. Refused with words, because
renaming is one field and a silently shadowed pack is a mystery nobody would
think to look for.

**On Bronze**, under the host's own rule: writing a JSON file costs nothing per
use. Worth knowing what moving it up would mean, though — a subscriber's own
work becoming unreachable the month their card fails.

#### Where they are kept, and it is a THIRD repository

`PACKS_REPO`, `PACKS_TOKEN` (falls back to `GITHUB_TOKEN`), filed as
`packs/<roomId>/<kind>/<id>.json` — one folder per room, so "these are Rob's,
and only Rob's" is something you can see rather than something you have to
trust.

Not the public repo, obviously. **And not the owner's private one either**: that
holds the owner's accounts, invoices and customer records, and mixing somebody
else's work in with the owner's business records is the wrong boundary however
careful everybody is. `packsRepoConfigured()` deliberately has **no fallback**
to `PHOTO_REPO`, because falling back would put a subscriber's quiz in there
quietly on the day the variable was missing, with nothing on screen saying so.
There is a test that greps for exactly that.

Restored **once per room per boot, only into an empty folder** — the same rule
as the accounts and the invoice book, because a disk with packs on it is ahead
of any backup. Rooms are made lazily, so it happens the first time that
quizmaster opens their console, and it is awaited there: a library drawn while
it was still running would show them an empty shelf, which looks exactly like
their work having been lost. `listDir()` in `github.js` is new and exists for
this — every other restore reads one file at a known name; a folder of unknown
names needs a listing.

**Without it configured the console says so in red**, in the panel where they
write one, and every own pack card carries **Download**. That button is not a
nicety: whatever happens to the app, the backup or the subscription, the file is
a file and they can hold it. It is also the honest answer to "what if I leave".

Two things this found on the way, both pre-existing: the owner's
**"nothing here is being saved permanently"** banner was being shown to
subscribers — it talks about generating packs and names two environment
variables only the owner can set — and `GET /api/quiz/<id>` **passed `err.message`
through on a miss**, which is an ENOENT carrying the server's absolute path.
Both are the same faults this file already records for the tab bar and the
advert sets, in new places.

### What this does NOT do yet

- Nothing stops two quizmasters launching the same pack at once, which is fine
  and probably useful.
- **A quizmaster cannot share one of their own packs with another quizmaster.**
  Download and re-upload is the whole mechanism today, which is deliberate:
  anything better needs a story about who owns the copy afterwards.

  **A COMPANY is that story, and that is the shape sharing will eventually
  take.** Between two independent quizmasters ownership is ambiguous; inside
  one company it is not. So the answer is a company folder
  (`packs/<companyId>/`) resolved **own → company → catalogue**, never a
  "which accounts may read this pack" permission — the owner is in no company,
  so they still resolve against the house room and find nothing, and the
  guarantee stays structural rather than becoming a check somebody has to
  remember to write. Written up in TODO.md under **Group accounts**; not built.
- **`session.launch()` does not check for a night already in progress**, so two
  people sharing one login can end each other's games mid-question. See TODO.md
  — the fix is the running panel saying what a launch is about to destroy,
  which is a small job and worth doing before anything else here.

---
