# Business — pricing, and the directions not being built yet

Parked strategy, moved out of TODO.md. **Nothing here is scheduled.** It is
kept because each section records reasoning that was argued through once and
should not be re-argued from scratch.

---

## Asked for, not yet specced

### The software does not compete with the quizmaster — it CREATES work for one

**Settled on 13 August 2026, and it corrects a wrong reading of mine.** I put it
to the host that a pub seeing "£10 a month" next to "£150 a night" was channel
conflict, and that a venue might run the software instead of hiring him.

**It is not, and the reason is one sentence: a quiz night does not host
itself.** The software writes the questions and does the marking, which was
never the expensive half. What a venue still has to find is somebody to hold a
microphone for two hours, work a room, bring the speakers and deal with the
table that thinks question six was wrong. Every venue running Quizporium is a
venue that needs a host, and the host is usually not the landlord — his own
words: *"QMs still need to be paid and will often bring in their own audio gear
etc."*

So the four ways a night can happen, and every one of them wants this software
underneath it:

- **Mark hosts it.** Essex, Kent and Surrey, and the reason the venues page
  exists.
- **A quizmaster the venue already uses hosts it**, on their own subscription
  or the venue's.
- **Bar staff host it.** The realistic one for a small pub with no budget for
  an entertainer, and the one the app's "clarity beats everything" rule was
  written for.
- **A quizmaster hired THROUGH Quizporium hosts it.** ← the interesting one.

### A quizmaster directory — venues hire a host through the site

The host's own idea and worth its own entry: *"or even if we have QMs on the
site that they can hire through us…all possibilities."*

**What makes it plausible rather than a nice thought is that the hard part is
already built.** A subscribed quizmaster already has an account, a room, a
history of nights they have run, the photos from them and an invoice book —
which is exactly the profile a venue wants to see before booking somebody, and
exactly what **Past gigs** was built to be. `FEATURES.PAST_GIGS` is already
Bronze specifically because it is the evidence somebody shows a venue.

**It also turns the out-of-area problem into revenue rather than a redirect.**
A pub in Manchester cannot have Mark. Today the site tells them to run it
themselves; with a directory it tells them to hire Dave, who subscribes.

**Not built, not specced, and deliberately not on the site.** It needs a
decision about money (a cut? a listing fee? free, to sell subscriptions?), a
decision about vetting — the whole value is that a venue trusts the
recommendation, which means the owner is putting their name to somebody else's
night — and it wants the payment processor that does not exist yet. **Do not
put it on the sales page before it exists**, for the same reason nothing else
unbuilt is on there.

The one thing worth doing NOW is not narrowing the door: the site should not
say anything that implies "run it yourself" is the only alternative to booking
Mark.

#### Vetting: the ROOM rates the night, and that rating must not set anybody's pay

The host's proposal: *"vetting could be taken care of via an in-app Uber-style
rating system, and their pay is based on their rating"* — *"they host a job, the
average rating comes to my owner console, then they get paid more if their
average rating is higher."*

**The rating half is a good idea and the app is unusually well placed to do
it.** Sixty phones are already connected and already looking at a final
scoreboard. One tap at `PHASES.FINAL`, no signup, no email — which is the one
rating channel in this business with real volume. A venue rates you four times
a year; a room rates you sixty times a night. Nothing else about a quizmaster
can be measured that often.

**The PAY half should not be built, and there are three reasons in order of
severity.**

**1. It probably makes Quizporium the quizmaster's employer.** Setting somebody
else's rate, taking a cut, and controlling their quality with a score is the
exact fact pattern the UK Supreme Court used to find Uber's drivers were
workers rather than self-employed (*Uber BV v Aslam*, 2021) — control over pay
plus control over performance. Today a quizmaster is a CUSTOMER who pays a
subscription; the day their income is calculated by the owner's console they
look a great deal like staff, with holiday pay and minimum wage attached. **Get
an accountant's view before building any version of this**, whatever the
mechanism. A directory where each quizmaster sets their OWN rate has none of
this exposure.

**2. It pays them for things they do not control, and one of those things is
this app.** A room's rating is mostly the pack, the crowd, the venue's sound,
how busy it is, and whether they won — the host's performance is a minority
share of it. So a quizmaster handed a weak pack, or a night where pub wifi
wobbles, earns less. That is the owner's risk and the venue's risk, priced onto
the host's wages. It is also backwards for the business: the hardest rooms —
the dead Tuesday that most needs a good host — would pay the least, so the best
quizmasters would learn to avoid exactly the venues that need them.

**3. It creates the one kind of admin that does not scale.** Money plus a
disputed score means the owner adjudicating. "The pub was half empty", "a team
that came last stuffed the ratings", "the projector bulb went" — every one of
those lands on a Monday, and there are more of them every month as subscribers
grow. That is the ceiling described in the section above, rebuilt out of
arguments about wages.

And a mechanical problem that has to be solved even for the harmless version:
**a phone has no identity by design** (rule 3 — there is no login, and the join
code is on the projector and read out on the mic). One person with three phones
is three ratings, and a rejoin is another. That is survivable for a display
figure and not survivable for a payment.

**Anonymous is the right call and it is also the thing that closes the door on
pay.** The host's own instruction — *"average rating from the quiz customers,
made anonymously"* — is correct for the rating itself: a player who has to put
their name to it rates the host they can see rather than the night they had,
and half the room is drinking with the person on the mic in a small pub.
**But anonymous and unverified are the same thing here**, because there is no
account behind a phone to be anonymous FROM. So a disputed score can never be
investigated: there is nobody to ask, no way to tell a stuffed ballot from a
bad night, and nothing the quizmaster can appeal against. That is fine for a
number on a profile and it is not a basis on which to pay somebody less.
The honest version of this rule: **an anonymous rating may inform a decision a
human makes; it may not BE the decision.**

**What to build instead — and it gets the host what he actually wants.** The
rating already pays a good quizmaster more, without anybody setting a wage:

- **The room rates the NIGHT, one tap on the final screen**, and it is shown as
  evidence on the directory profile beside Past gigs. Rated the night, labelled
  as the night — not "how good is this host", which it cannot honestly measure.
- **Each quizmaster sets their own fee.** The owner takes a flat cut or a
  listing fee, which is the same money with none of the employment question.
- **A high rating earns more through BOOKINGS, not through an algorithm.** A
  4.9 with forty nights of photos gets picked more often and raises their own
  price. Market, not payroll.
- **The strongest signal is one nobody can stuff, and it costs no UI at all:
  did the venue book them AGAIN?** "Booked back by 9 of 11 venues" beats any
  star average, and it falls out for free once a night carries a venue — which
  is already the prerequisite sitting at the top of the SELL list.
- **Vetting itself stays a phone call for years.** At tens of quizmasters the
  owner reads their Past gigs page and talks to them once. That is a Monday job
  that stays the same size, because it happens once per quizmaster rather than
  once per gig.

Prerequisites either way, and neither exists: **a night has to carry a venue**,
and there has to be a payment processor.

#### Being cut out: the answer is that it does not cost what it looks like it costs

The host's question, and it is the right one to ask before building a
marketplace: *"how do I stop them cutting me out and just using my software?"*

**Start with what is actually lost, because it is much less than it feels.** In
an ordinary marketplace the transaction fee IS the business, so a booking taken
offline is the whole loss. Here it is not: the quizmaster pays a subscription
whatever happens, and the venue may be paying one too. A quizmaster who meets a
venue through the site and then books them direct for ever **is still a paying
subscriber, gained at the cost of one introduction.** So:

> **The marketplace is not a revenue line. It is customer acquisition that
> happens to pay for itself.** Judged that way, going direct is not a leak — it
> is a sale that only paid once.

That reframing decides the pricing, and it argues against the obvious design:

- **A per-booking cut creates the incentive to hide bookings**, and then a
  policing problem, and then a Monday spent policing. A flat fee per gig is
  better than a percentage and still has the same shape.
- **A LISTING fee has nothing to evade.** You pay to be listed, you are listed,
  and where the work came from is nobody's business. No reporting, no audit, no
  argument.
- **Best of all, put the listing on the LADDER.** Being in the directory is a
  Silver or Gold feature, so "cutting the owner out" means dropping to Bronze
  and losing the whole catalogue. That uses a mechanism that already exists,
  bills through a subscription that already exists, and needs no enforcement of
  any kind — the incentive does the work.

**THE RECOMMENDATION, AND IT IS GOLD RATHER THAN SILVER.** There is a real
tension to resolve first, because this file already contains a rule that points
the other way: *the tiers separate on quiz-app functionality, never on business
tools* — which is why invoicing and the calendar sit in Bronze. A directory
listing is about as businessy as a business tool gets, so by that rule it
belongs in Bronze too.

**It does not, because a listing is not a FEATURE — it is the owner's time and
the owner's name.** Somebody being in that directory means the owner has
vetted them and is, in front of a venue, standing behind them. That is exactly
what the other rule already says the top rung sells: **Silver buys the owner's
BACK CATALOGUE, Gold buys the owner's TIME.** A pack written to order is on
Gold for precisely this reason. A recommendation to a venue is the same
purchase.

It is also the tier that most needs another argument, and the price works:
Bronze to Gold is £20 a month, and **one booking at £150 covers seven months of
the difference.** Nobody who gets a single gig out of it has to think about it.

The arithmetic against a per-gig fee is not close, once evasion is priced in:

| | A month | What it costs to run |
|---|---|---|
| **£10 a gig**, 30 listed quizmasters, ~15 marketplace bookings | £150 | reporting, chasing, disputes, and an incentive to hide every booking |
| **Listing on Gold**, of whom 10 climb from Bronze to be listed | £200 | nothing at all — it bills through a subscription that already exists |

And the second number is RECURRING and does not care whether anybody booked
anything that month, which is the whole point of the section above.

**Later, and only if venues use it heavily: a one-off INTRODUCTION fee.**
Not per gig — charged once, when a venue and a quizmaster are actually put
together. It cannot be evaded, because the introduction happens on the site by
definition; a venue that then books the same person for two years pays once,
which is correct, because what was sold was the introduction. Do not build this
until the directory has enough people in it to be worth paying for.

##### …and on reflection, PARKED. Free introductions are the better business

The host's own second look, and it is right: *"perhaps the intro fee is just me
being greedy and risking a lot for not much benefit."* Not greedy — every
marketplace on earth charges one, and 15% is normal where this was proposing
about 4% of a first year. It is simply **the wrong fee for this business**, and
there are four reasons, of which the last is his own.

- **The subscription is worth more and costs nothing to collect.** A listed
  quizmaster on Gold is £360 a year, recurring, billed by machinery that has to
  exist anyway. An introduction is a one-off £150 with a payments build, a
  refund policy and a dispute process behind it. **One listed subscriber for a
  year beats two and a half introductions**, and arrives with no new code at
  all.
- **The fee taxes the exact thing the business needs to happen.** A cold
  marketplace's whole problem is getting the first few matches to occur; a
  charge at the moment of introduction suppresses introductions, which makes
  the directory look thin, which is what sells Gold. It is a tax on its own
  funnel.
- **Free introductions are the best sales line the top rung could have.**
  *"Get listed, get booked, and I take nothing out of the booking"* is
  genuinely different from every marketplace a quizmaster has ever dealt with,
  all of which take ten to twenty per cent. That is worth more as a pitch than
  the fee is as revenue.
- **And it drags the owner back INTO a contract he deliberately stayed out
  of.** His own design was that the arrangement is between the venue and the
  quizmaster: *"the contract is with them and not with me."* Taking money at
  the point of booking makes him a party to it — which is the same thread as
  the employment-status question, pulled tighter.

**So: the directory is free to use, and being IN it is what Gold buys.** One
price, one thing to explain, nothing to enforce, and the whole section below on
collecting a fee becomes moot.

**AND THE ARGUMENT CLOSES ITSELF AT BOTH ENDS, which is what makes this a
decision rather than a maybe.** The host: *"if I have 200 people paying me £30
a month I don't need £150 occasionally anyway."* Quite — that is £72,000 a
year, against which an occasional introduction is a rounding error. The obvious
objection is that 200 is the destination and the first year is five to twenty,
where £150 is proportionally worth far more.

**But early is exactly when a fee does the most damage**, because a cold
marketplace's entire problem is getting the first matches to happen at all, and
those first matches are the only evidence that the directory works. So the fee
is **harmful when it would be meaningful and meaningless when it would be
harmless**. There is no size of business at which it is the right thing to
charge, which is a stronger conclusion than "not yet".

**Kept below rather than deleted**, because the reasoning is worth having if a
venue-side charge ever makes sense — and note the one thing that gets harder by
waiting: adding a fee to something that was free is a much worse conversation
than having charged from the start. At a handful of quizmasters he knows
personally that is a phone call rather than a policy change, which is what
makes parking it cheap today and expensive at two hundred.

##### Which means STREAMING can come off the Gold card until it is built

Raised in the same breath: *"Gold also gets online streaming tbf, but it
should offer way more value than Silver anyway."* Both halves are true and
together they argue for taking it off.

`FEATURE_META[FEATURES.STREAM]` currently reads **"Online quizzes — Run a night
for a room that is not there. Not built yet."** That honesty note was the right
call when it was written, because **streaming was the only thing making Gold
worth £10 more than Silver** — this file used to say Gold was unsellable for
exactly that reason.

It is not carrying that weight any more, and **the tiers STACK, which is the
part to keep hold of**: Gold is everything Silver has — the whole evergreen
catalogue and the advert slides — and then **three real things on top**: the
weekly topical quiz, a pack written to order, and being in the directory.

That is what makes the £10 step easy to justify: a rung only has to earn its
DELTA, not its whole price. And the gradient already holds on those three
alone — Silver at £20 plus four topical packs at £3 is £32, which is more than
Gold — so the unbuilt line is not load-bearing any more.

**And an unbuilt feature on a tier stops being free the moment somebody pays
for it.** Today nobody does, so it costs nothing. The day the first Gold
subscription is taken, "not built yet" on the card they just bought is a
promise with a date attached in their head that nobody ever said out loud. It
is also clutter by the app's own second rule — a control nobody uses has to
earn its pixels, and a line nobody CAN use is worse than one nobody wants.

So: **take it off before the first paying Gold subscriber**, not necessarily
before Thursday. One line in `FEATURE_TIER` and one in `FEATURE_META`. When
streaming ships it goes back on as an announcement — *"Gold now includes
online quizzes"* — which is worth something, where paying off a debt is worth
nothing.

##### A PLATINUM rung for it? No — an ADD-ON, and the difference is not pedantry

Asked: *"maybe we could have a platinum tier for streaming? Or perhaps Gold+?"*

**The instinct is right — streaming does need its own price — but a rung is the
wrong shape for it, and the reason is what the ladder is made of.** The host
got there himself in the next breath, and it is the cleanest statement of the
rule there is: *"streaming will be expensive and something only certain QMs
need."*

> **THE TEST, and it is worth applying to everything that comes after this: a
> TIER is for what everybody on that rung uses. An ADD-ON is for what is
> expensive and only some people want.** Put an expensive minority feature on a
> rung and everybody on it pays for something most of them never open; put it
> beside the ladder and the people who want it pay for it and nobody else is
> taxed.

That test also explains the ladder as it stands. Advert slides are on Silver
because *every* Silver subscriber can use them and they cost nothing per use.
Topical packs are on Gold because every Gold subscriber gets one every week.
Streaming is neither: expensive per use, and wanted by a minority.

Bronze, Silver and Gold are three amounts of the SAME thing: content, and the
owner's time to make it. That is why they stack, why the gradient can be
checked with arithmetic, and why each rung only has to earn its delta.
**Streaming is not more of that. It is a different way of running a night**,
and one with a per-use cost attached.

Three things follow, and the middle one is the strongest:

- **It cannot be priced yet, and the price is the whole question.** This file
  already records the measurement that matters: sending the host's PICTURE
  costs about twenty times sending their VOICE, and four 100-person video
  nights a month is more egress than a £9.99 subscription covers. So the
  difference between a rung that makes money and one that quietly loses it is a
  number nobody has yet. Naming a tier before knowing it is guessing at the one
  figure that decides whether it works.
- **A fourth RUNG forces somebody to buy content they do not want.** Online
  quizzing is a different USE, not a higher grade of the same use — a corporate
  host who runs nights over video may have no interest at all in forty pub
  packs. Stacked above Gold, streaming is only reachable by buying the entire
  catalogue first, which is the wrong way round and would lose exactly the
  customer the feature is for. **An add-on sits beside the ladder and is
  available on any rung**, which is what streaming used to be before the ladder
  was built (`addons: ['stream']`, still read by `tierFor()` for old accounts).
- **A tier named after an unbuilt feature is worse than a line about one.** A
  dead line on a card is clutter; a dead RUNG is a hole in the pricing page and
  a thing to explain on every sales call.

**And "Gold+" is the weaker of the two names anyway.** It reads as "the tier
you already have, but the proper version" — which says the rung below it is
incomplete, on the tier that is meant to be the best thing on offer. Platinum
at least reads as its own thing. Neither is worth a fourth column on a pricing
page for a product with no subscribers yet; **as little clutter as possible**
applies to the price list as much as to a screen.

**Nothing is lost by waiting.** `TIERS` takes a fourth entry with a `rank`
between two existing ones and nothing else in the app has to change — that is
already written down and tested. So the decision can be made when there are
real egress figures and somebody actually asking for it, which is the same rule
the shop and the payment processor are following.

##### THE CONCLUSION: sell ONLINE NIGHTS, by the night

The shape above says what streaming is not. This is what it IS, because
"an add-on, priced later" is not an offer anybody can be sold.

> **Streaming is switched on for free on any tier, and charged PER ONLINE
> NIGHT.** Nothing monthly, nothing to commit to, nothing to cancel.

**The billing unit is the night because that is how the quizmaster SELLS it.**
An online quiz is nearly always a corporate booking quoted as a fixed price for
an event — £300 to £500 is normal — so a £12 or £15 cost per night is a
rounding error inside a number they are already quoting. Matching your unit to
theirs is the same insight that made "one night's fee" the right unit for an
introduction: **price in the thing the customer is already counting.**

**Yes, that is metering, and the rule against it does not reach here.** This
file says plainly that metering is what makes software hateful to run a
business on, because *"a per-night charge means a quizmaster doing sums before
accepting a booking"*. That is about PUB nights — the core product, booked
weekly, at a fee they cannot change. An online corporate night is a quote they
write themselves, for a client with an events budget, where they are doing sums
anyway. The rule holds exactly where it was written and does not apply to this.

**Why not a monthly add-on**, which is the obvious alternative: most
quizmasters will do two or three online nights a YEAR. Nobody pays £15 a month
for that, so the add-on never sells and the feature earns nothing. Per night
they pay £30 for the year without thinking about it, against £900 of their own
revenue. **A per-use cost wants a per-use price**, and the ladder stays clean.

It also has no unbounded exposure and no fair-use band to police: every night
carries its own cost, so a quizmaster doing forty online nights is a good
customer rather than a problem.

**Audio is the product; video is a small tile.** Already decided, and it is a
business decision as much as a design one — the host's picture costs about
twenty times their voice, which is the difference between a night that costs
pennies and one that eats the fee.

**Recording it needs nothing new.** `src/spend.js` already exists to write down
what a thing actually COST as it happens, in pence, per job — an online night
is another row in it, and the invoice book raises the charge. Same pattern, no
new subsystem.

**Do not put a price on it until one real night has been measured.** The whole
reason streaming is awkward is that the number is unknown, and an advertised
price that turns out to be under cost is far worse than no price. Run the first
few at cost, deliberately, and read the ledger — which is exactly what the
ledger was built for.

**And the one thing that has to be said out loud: THIS IS THE FIRST DEPENDENCY.**
Live audio to a hundred phones cannot be written out the way `qrcode.js` was;
it needs an SFU or a managed WebRTC provider, and that is a third-party service
in the live path of a night for the first time in this codebase. Which is why
this file already says **online mode must be a MODE and never a layer**: a
media provider having a bad morning must not be able to touch a Wednesday in a
pub. Any build starts there, not with the pricing.

##### What it would actually cost — and the answer that costs NOTHING

###### The finding first: an online quiz works TODAY, with no streaming at all

**The client already has Zoom or Teams, and that is the transport.** A remote
player joins this app exactly as a pub player does — it is a URL and a code,
and neither cares which room anybody is in. The host shares the projector view
in the call, talks over it, and plays the music through "share computer audio".
The quiz, the scoring, the clock, the fastest finger and the bingo cards all
work unchanged, because none of them ever knew where anybody was sitting.

So **the honest first answer to "how do I offer streaming" is that for a
corporate booking you probably do not have to.** No egress, no provider, no
dependency, no build, and it can be sold this Monday. Latency on a video call
is a few hundred milliseconds, which is nothing against a twenty-second clock.

What building it in would actually buy is **not having to ask the client to
host a call** — real, but a convenience rather than a capability, and worth far
less than it looks when every client already runs Teams. **Sell one online
night over the client's own call before building anything**, and find out what
is genuinely missing rather than guessing.

###### The bandwidth arithmetic, which is firm

Opus speech audio at 32 kbps over a two-hour night is **29 MB per listener**,
so a hundred people is **about 3 GB a night**. It is one-way — a room listens
to a host, nobody publishes back — which is broadcast rather than a conference
and is the cheap shape.

A small 360p video tile at ~600 kbps is **540 MB per viewer**, so the same
night is **54 GB**. That is the "about twenty times" already recorded in this
file, arrived at independently, which is a good sign it is right.

###### The money — CHECKED against three providers, August 2026

**The earlier estimate in this section was wrong, and wrong in a way worth
recording: the PRICING MODEL matters three hundred times more than the rate.**

| Provider | Model | Free every month | 100 people, 2 hours of audio |
|---|---|---|---|
| **Cloudflare Realtime** (SFU) | **per GB** — $0.05 | **1,000 GB** | **about 15 CENTS** |
| **Daily.co** | per participant-minute — $0.00099 audio-only | 10,000 participant-min | about **$12** |
| **LiveKit Cloud** | per track-minute — $0.004 audio | 5,000 participant-min | about **$48** |

Same night, same audio, **fifteen cents against forty-eight dollars.** The
reason is what this app happens to be doing: **one host publishing 32 kbps of
speech to a hundred silent listeners.** Per-GB pricing charges for what that
actually is — 3 GB of a very thin stream. Per-participant-minute pricing
charges nearly the same for a low-bitrate audio listener as for somebody on
video, so a broadcast of speech is the worst possible shape to buy that way.

> **Choose the MODEL, then the provider. For broadcast audio the per-GB model
> wins by two orders of magnitude, and it is not close.**

**The free tiers alone cover this business for years.** Cloudflare's 1,000 GB a
month is roughly **330 hundred-person audio nights**; even Daily's 10,000
participant-minutes is one 40-person night a month for nothing. At the volume
in the sums below — a handful of online nights a year — **the data cost is
zero**, and stays zero long after it stops being a hobby.

**Which means the premise this file has repeated has to be corrected: streaming
is NOT expensive.** The old note — *"egress is a real per-use cost"*, the
reason streaming was ever a paid add-on — was written from the video figure and
before anybody looked at a per-GB provider. Video is still ~19× audio, but on
Cloudflare's model that is **$2.70 a night rather than $48**, and 18 video
nights a month still fit inside the free tier.

**So cost is not the constraint. The BUILD is, and so is the dependency.**
Nothing above changes the fact that this is the first third-party service in
the live path of a night.

**Do not self-host an SFU** even though the egress is pennies either way: it
means the host IS the media service having a bad morning, on one admin day a
week — worse than the thing this file is trying to avoid.

Sources, and they move — re-check before committing:
[Cloudflare Realtime SFU pricing](https://developers.cloudflare.com/realtime/sfu/pricing),
[Daily.co pricing](https://www.daily.co/pricing/video-sdk/),
[LiveKit pricing](https://livekit.io/pricing).

**And do NOT reach for the cheap broadcast option.** HLS and its low-latency
variant are far cheaper per gigabyte and land 2–20 seconds behind, which on a
twenty-second question is the entire round. Latency is why this has to be
WebRTC, and therefore why it costs what it costs.

###### "Would £10 per online quiz cover the data costs?"

**For the size these things actually are, yes — comfortably. At a hundred-plus
it gets thin, and with video it does not cover it at all.**

The sum is small enough to do yourself with any provider's price list, and
that is better than trusting the estimate above:

> **participants × minutes × the per-participant-minute rate**

A typical corporate online quiz is 20 to 50 people, not a hundred. So:

| The night | Participant-minutes | Cost at $0.001/min | £10 leaves |
|---|---|---|---|
| 30 people, 2 hours | 3,600 | ~$3.60 | a good margin |
| 50 people, 2 hours | 6,000 | ~$6 | fine |
| 100 people, 2 hours | 12,000 | ~$12 | **under water** |
| 100 people **with video** | 12,000 | ~$48 | nowhere near |

**The one number that decides it is the provider's audio rate, and it spans
about four to one** across the managed services ($0.0005 to $0.002 per
participant-minute). At the cheap end £10 covers a hundred people twice over;
at the dear end it stops paying at fifty. **So check two current price lists
before committing to a number** — the bandwidth arithmetic above is solid, the
rate is the part that moves.

**The safe version of £10 is £10 WITH A SIZE ON IT** — "£10 an online night up
to 50 players" — which is honest, quotable, and covers the shape almost every
booking actually takes. Above that it is a conversation rather than a refusal,
which is the rule everywhere else in this app.

###### THE ANSWER: everything online EXCEPT audio and video

The host, and this is the version to build: *"is there a way to API connect —
remember how I was talking about chat rooms etc. — maybe provide all the online
features EXCEPT audio and video?"*

**Yes, and it is better than the streaming version in every direction.** The
client's own Teams or Zoom carries the voice, the face and the music, which it
already does well and has already been paid for. The app carries the QUIZ. No
media provider, no egress, no first dependency in the live path, no beta risk
on a corporate booking — and it can be sold before it is finished, because the
scoring half already works from anywhere.

**Do NOT build a Zoom or Teams integration either.** Both have app platforms
that would embed this in their client, and both would cost an app review, a
second build for the other one, and precisely the dependency being avoided —
to save somebody opening a second tab, which is what everybody on an online
quiz already does. **Two windows is the normal shape of this and needs no
integration at all.**

**And not YOUTUBE LIVE, which is the tempting one.** Asked, and the instinct is
right — it is free, it is infinitely scalable, Google pays the egress and the
Live Streaming API really would let the app create a broadcast and embed the
player. Two things kill it, and the second is decisive:

- **Latency.** YouTube Live is 30–60 seconds normally and 2–5 even on
  ultra-low. The app's own clock is unaffected — questions arrive over SSE in
  milliseconds — so scoring stays fair, but the HOST is then five to sixty
  seconds behind the question everybody is already answering. That is a
  different job on the microphone rather than an impossible one, but it is a
  real cost.
- **CONTENT ID, and this is the one that ends it.** This is a MUSIC quiz. A
  live broadcast playing commercial recordings is exactly what YouTube's
  automated matching exists to catch, and it can mute or terminate a stream
  mid-broadcast. Running a paid corporate night on a platform that might cut
  the host off in the middle of round three for playing eight seconds of
  Madonna is precisely the Wednesday-night failure this codebase is organised
  around — and it would be somebody else's automated decision, with no appeal
  inside the hour.

A private video call has neither problem: sub-second, and nobody is scanning
it. The client's own Teams is free, scalable and already paid for, which is
everything YouTube was attractive for and none of what makes it unusable.

###### SETTLED: the app hosts the audio and video. Cloudflare Realtime.

**I argued for running it over the client's own Teams and the host overruled
it, correctly:** *"the whole point of an online capability is that we host the
video and audio, otherwise we may as well not bother."*

**And it is settled by EXPERIENCE rather than by argument, which outranks
everything above:** *"already run plenty of quizzes with Frankenstein's Quiz
Ecosystem and it's a nightmare."* He has run these nights on a cobbled-together
stack and knows what it costs; I was reasoning about a thing he has actually
done. **That is the same rule as "if he says a control is missing, check what
is deployed before building it again"** — when the host reports from a real
night, the report wins.

**He is right, and the reason is the one this file already gives about the
packs: convenience IS the product.** A quizmaster who has to say *"set up a
Teams call and send me a link and I will join it"* has not sold an online quiz
night, they have asked the client to do the hard half. And it cannot be sold to
other quizmasters either — *"Quizporium runs online nights"* is a capability
you can put on a page; *"Quizporium works if your client organises a video
call"* is an instruction. One link that the host sends and everybody clicks is
the whole thing being bought.

**And my counter-argument was mostly aimed at the wrong device.** I raised iOS
Safari — no audio without a user gesture, and backgrounding or locking the
screen stopping it — which is real, and it is a PUB-mode worry applied to a
room that is not in a pub. **A corporate online quiz is played on laptops**, at
desks, by people who are already on video calls all day. What survives of it is
small and has answers: one "join the audio" tap at the start (there is already
a join and a team name to type), and on a phone the audio may drop when the
screen locks — which costs the host's banter and never the question, because
the question, the clock and the options are all in the app over SSE.

So the design, and the economics are no longer a constraint at all:

- **Cloudflare Realtime**, per GB, with the free tier covering years of this.
- **The HOST publishes; players receive.** That is a broadcast, which is what a
  quiz is — one person at the front and a room watching — and it is the cheap
  shape. Players talking to each other is a video conference, which is a
  different product and out of scope.
- **Video of the host is IN**, not just audio. The old audio-first decision was
  made on egress at £0.09/GB-ish; on this model a hundred people watching a
  small tile for two hours is about **$2.70**, and a disembodied voice is a
  worse night. Audio stays the thing that must never drop; video is allowed to
  be the first thing sacrificed on a bad connection.
- **The Teams fallback survives as a SAFETY NET, never as the product.** If the
  media layer has a bad evening the host says "join the link in the invite" and
  the quiz carries on with every score intact — which is what *a mode, never a
  layer* actually means. **Build that fallback first.**
- **Gated to two accounts** while the bugs come out, per the section below.

**What has NOT changed** is everything in "what online mode actually needs":
the question on the player's own screen, chat and reactions for the room feel,
and teams. Those are still the difference between an online night that is fun
and one that is a spreadsheet, and none of them arrive with the audio.

###### The build order, and why the media layer is LAST rather than least

Every step below leaves a working product on the floor, which is the only way
to build something this size around one admin day a week:

1. **`state.online`, set at LAUNCH.** Same shape as the look, the card shape
   and the prizes — a fact about tonight, copied into the game state so a
   `SIGKILL` mid-round cannot bring the night back as the wrong kind. The
   picker goes on the pack card next to the others.
2. **The question on the player's own device while online.** The rule 8
   inversion, and the single biggest unlock — it is what turns "the scoring
   works from anywhere" into "you can actually play from anywhere". Touches
   `playerView()` and `play.js` and needs no media at all. **At the end of this
   step he can run a real online night** with the client's call carrying the
   voice, which is not the product but IS strictly better than the
   Frankenstein stack, and can be sold and learned from immediately.
3. **Chat and reactions.** The room feel, and the thing that decides whether an
   online night is fun. Ordinary work, no dependency. **Designed below.**
4. **Teams — several phones, one team, averaged.** Wanted anyway, worth more
   online.
5. **The media layer.** Cloudflare Realtime, host publishes, players receive,
   gated to two accounts. **NOT BUILT — it needs an account, and that is a
   Monday job** (his own words). The checklist is below.

**Steps 1 to 4 are BUILT, tested and live.** `state.online` and the Where
picker; the question on the player's own phone; chat with a main room, a back
channel and emoji-only while a question is live; and teams scored on the
average. Every one of them is off unless it is asked for at launch, and
`scripts/pub-unchanged.mjs` reports 2,150 identical payloads for a night that
does not use them.

###### Step 5, when there is a Monday for it

Nothing here can be done without an account, so it is written out rather than
half-built:

1. **Sign up at [Cloudflare](https://dash.cloudflare.com/sign-up)** — free, no
   card for the free tier. The product is **Realtime** (it was called Calls);
   the SFU is the part that matters.
2. **Take the App ID and the App Secret** from the Realtime dashboard. They go
   on Render as `REALTIME_APP_ID` and `REALTIME_APP_SECRET`, alongside
   everything else — never in the repo, which is public.
3. **Check the free tier is still 1,000 GB a month** at
   [the pricing page](https://developers.cloudflare.com/realtime/sfu/pricing).
   That is roughly 330 hundred-person audio nights, so it wants checking once
   rather than watching.
4. Then the build: the host publishes one audio track and one small video
   track, every player subscribes, and **nothing about the quiz depends on
   either**. The fallback is the app with this switched off, which is what
   steps 1–4 already are.

**Do not start the build before the account exists.** A media layer written
against a stub is a media layer that has never met a real ICE negotiation, and
this is the first third-party service in the live path of a night.

###### And at +£15 a month the margin is roughly 100%

The host, on seeing the free tier: *"so that makes the pricing model of, say,
£15 pcm for online quizzing very profitable for the product."* It does, and
the number that settles it is this one:

> **A subscriber would have to run SEVENTEEN online nights a month before £15
> stopped covering the data.**

A realistic corporate online quiz is 30–50 people for two hours. Audio is about
1.5 GB of that and the host's video tile is the rest — call it **22 GB a
night**. The free tier is 1,000 GB, so **about 45 nights a month cost nothing
at all**, and past it the overage is $0.05/GB, which is **roughly 90p a
night**. £15 buys about seventeen of those.

**One thing to be exact about: the free tier is per CLOUDFLARE ACCOUNT, not per
subscriber.** It is one pot of 1,000 GB shared by everybody using the feature,
so it scales with total NIGHTS rather than with how many people are paying. At
twenty subscribers running two online nights each that is 880 GB — just inside
it — and the month it tips over, the whole overspend is under £20 against £300
of revenue. There is no version of this that stops being profitable.

**Which means the price is a VALUE decision and should stay one.** Costing
pennies is not a reason to charge pennies: this is what lets a quizmaster take
a corporate booking at £300–500 that they currently cannot serve at all, so
£15 is trivial to them and the margin is the reward for building it. Pricing it
at cost would be giving away the one capability that opens a new market.

###### THE POINT OF ONLINE MODE, in the host's own words

> *"You'd use two or three and be kind of forcing them together. **I want this
> to be the opposite.**"*

**That is the whole brief for this feature and it is worth putting above
everything else in this section**, because it is a test that can be applied to
any proposal without argument:

> **Does this reduce the number of things being forced together, or add one?**

Not "is it a good service", not "is it cheap", not "is it what everybody else
uses". Every one of those questions can be answered yes about a thing that
makes the night worse, and that is precisely how somebody ends up hosting a
quiz out of four browser tabs. The opposite of a mish-mash is not a better
mish-mash; it is ONE thing that was built for this.

It also means the bar for online mode is not "as good as the alternatives". The
alternatives are general-purpose tools bent into a shape they were not made
for, so matching them is not the achievement — **being the only one that was
designed for a quiz night is.**

###### The firefight was INTEGRATION, not any one thing breaking

Asked what actually went wrong, and the answer reframes the whole feature:

> *"It's usually just because there were a mish-mash of different softwares and
> each one needed managing, crashed at different times, didn't have full
> features, was being kind of shoehorned in for a use case it wasn't designed
> for."*

**That is a cause, where the table below is a list of symptoms.** The problem
was never that a microphone failed — it is that a night was assembled out of
four tools that did not know about each other, so every one of them had its own
failure, its own settings, its own moment of needing attention, and none of
them could cover for another. One person cannot host a room and operate four
things at once, which is why it reads as firefighting rather than as a bug.

**Three things follow, and the first is the important one.**

**1. IT RETROSPECTIVELY SETTLES THE "SHOULD WE HOST THE MEDIA" ARGUMENT, and
the host was right.** I argued for running online nights over the client's own
Teams. Under this diagnosis that answer is the disease: it makes an online
night *the app PLUS somebody else's video call* — two things to manage, two
things that crash separately, and the quizmaster in the middle of both. *"We
may as well not bother"* was exactly right and I had the wrong end of it.

**2. So the measure to design against is THE NUMBER OF SEPARATE THINGS THAT
HAVE TO WORK.** Today an online night is two (this app, plus their call). With
the media layer it is one. That number is the feature — not the audio quality,
not the video tile — and it is what a quizmaster is actually buying. **Any
future proposal that adds a fifth service to a night is answering the wrong
question**, however good the service is.

**…and the examples make it sharper still: they were the WRONG tools, not just
too many of them.** *"The chat rooms were designed for an office, not for a
quiz. The software was for surveys, not for a quiz."* Each one arrives carrying
the assumptions of its own trade, and those assumptions are not neutral — they
are actively wrong here:

- **Office chat assumes everyone should be able to talk at any time.** That is
  the whole point of it, and it is exactly what must not happen for twenty
  seconds while a question is up. No amount of configuration gets Teams to gag
  a room at the moment a clock starts, because to Teams that is not a thing
  that exists. It is the reason `mayPost()` refuses words mid-question in
  fifteen lines, and the reason it could never have been bought in.
- **Survey software has no concept of a RIGHT ANSWER**, let alone of being
  right QUICKLY. A survey collects opinions: order does not matter, nothing is
  scored, nothing is revealed, nobody is first. So the thing this whole app is
  built around — ten points a second, the fastest finger, the reveal — is not a
  missing feature in a survey tool, it is a category the tool does not have.

> **One line for the sales page and for every future build decision: a survey
> tool has no idea what a right answer is, and an office chat has no idea that
> there are moments when nobody should speak. A quiz is made of both of those.**

**3. "Didn't have full features" and "shoehorned in" are a warning about
THIS app too.** A quiz app that does online badly is another tool being pushed
into a use case it was not designed for — which is why online mode is a MODE
with a branch budget written down, rather than a layer bolted on the side. The
thing that stops this becoming part of somebody else's mish-mash is that the
same engine runs both kinds of night.

The symptom list below is still worth building, but as **what the ONE app owes
somebody when a night wobbles** rather than as glue between tools. Ask him
which of these he actually hit.

| The firefight | What the app should do instead |
|---|---|
| *"I can't read the question"* | **ALREADY FIXED** — it is on their own phone now |
| *"We can't hear the music"* | share-computer-audio not ticked: a pre-flight check before going live |
| *"I can't hear you at all"* | a **"can everyone hear me?"** tap that puts a yes/no on every phone and shows the count |
| *"I've dropped out"* | the phone says *"rejoin the call — the quiz is still running and your score is safe"* rather than looking broken |
| *"Nothing is happening"* | the host cannot tell who is connected: **38 in, 2 dropped** on the control view |
| a corporate firewall | TURN handles most of it; the rest need a fallback that says so plainly |
| somebody refreshes | already solved — the phone comes back with its score, same as in a pub |

**The one to build FIRST is the connected/dropped count**, because it turns
"is it me or is it them?" into a number — which is the question underneath most
of the firefighting. It needs no media layer at all: the app already knows who
is holding a live connection.

**THE REAL COST OF ONLINE QUIZZING IS NOT DATA, IT IS SUPPORT.** An online
night has more that can go wrong than a pub one and none of it is in the room:
somebody's microphone, somebody's corporate firewall, somebody's laptop
muting itself. Those questions land on the owner, and they land during
somebody's event rather than on a Monday. That is the fifth constraint pointed
straight at this feature — **a feature's real price is the admin it creates**
— and it is the thing to watch when this ships, not the gigabytes. Build the
"if the audio dies, here is the fallback" path so well that it answers most of
them without a message being sent.

**The media layer is last because everything above it must work without it.**
That is not a way of putting it off — it is the only version of *a mode, never
a layer* that survives contact with an evening where the provider is unwell.
Built in this order the fallback is not a feature anybody has to remember to
write: it is simply the app with step 5 switched off.

###### Chat: one main room, and sub-rooms — the design

The host's shape, and it is right: *"a main room and sub rooms — the first sub
room would be quizmaster + IT support + the person who hired you, and the other
sub rooms would be the teams, but everyone is in the main room as well. Just
basic text and emoji, don't need more than that."*

**A SUB-ROOM IS A TEAM. Do not build "rooms" as a second concept.** Step 4 puts
teams in the engine anyway; a team's chat is simply its members, so the two
features are one object and there is nothing to keep in sync. The only special
case is the organisers' room, which is a team nobody scores.

| Room | Who is in it | What it is for |
|---|---|---|
| **Main** | everybody | the pub. Banter, groans, the atmosphere a room supplies for free and a video call does not |
| **Organisers** | host + whoever hired you + their IT person | "the projector has frozen", "we are two minutes late", "Dave cannot hear you" — the things you cannot say to 60 people |
| **A team** | that team's phones | conferring, which is what a table in a pub is |

**The organisers' room needs a person who is NOT a player**, and that role does
not exist yet. The client's contact and their IT person do not want a team name
or a score — they want the back channel. Simplest honest shape: they join like
anybody else and the host marks them as organisers, which keeps one join path
and needs no second door. **Their answers must then be kept off the
scoreboard**, or the person who booked you wins their own quiz.

**Two-screens applies to chat, and it is the whole risk.** A team's messages
must never reach another team; the organisers' room must never reach a player.
That is per-role payload building again, exactly like `whoPicked` — and it
wants tests of the same shape, because a chat leak is worse than an answer key
leak: it is somebody's private conversation.

**THE MAIN ROOM MUST BE THROTTLED WHILE A QUESTION IS LIVE, and this is the
part that is easy to miss.** In a pub a table confers quietly and nobody hears
them. Online, a main room during a question is **a channel for broadcasting the
answer to everybody** — far worse than googling, because it is instant and
social. **Emoji only while the clock runs** is the answer: the atmosphere is
kept, the answer-sharing is not, and nobody has to be told a rule. Team rooms
stay fully open the whole time, because conferring is what a team is FOR.

Four smaller decisions, each following a rule this file already holds:

- **No word filtering**, same as team names — but the host can already remove
  somebody, and every message is visible to the host. That is the control.
- **Debounced to disk, and capped.** Chat is the definition of high-frequency
  and low-stakes under rule 7, and the state file is the next scaling ceiling —
  so keep the last N per room rather than the night's whole transcript.
- **It rides the SSE stream that already exists.** No new transport, no
  dependency, and it reconnects on its own like everything else.
- **Text and emoji, nothing else.** No images (that is the photo wall, which
  already has a kill switch), no files, no links worth previewing.

###### And the pricing for it: "+" rather than Platinum

Also asked: *"the Platinum model, or perhaps just a + model — could have
Bronze+ or Silver+, which just adds online streaming, and comes at a later date
when Rob and I are happy with the product."*

**The "+" is the better of the two and it is the same thing as an add-on,
better named.** Platinum would be a fourth RUNG, which forces somebody who only
runs online nights to buy the whole pub catalogue first — the objection above.
A suffix is a MODIFIER: it keeps "available at any rung", which was the entire
point, and **"Silver+" reads better on an invoice than "Silver plus the online
add-on"**.

So: **one entitlement in the code, three display names in the shop.** Nothing
goes into `TIERS`, so `rank` comparisons are untouched and the whole ladder is
undisturbed — which is what makes this a naming decision rather than a
restructure.

**The price wants to avoid a COLLISION more than it wants to be exact.** At
+£10 a month, Bronze+ is £20 — which is Silver's price, and two different
things at one number on a price list is the sort of thing somebody asks about
on a sales call. **+£15 is the clean one:** Bronze+ £25, Silver+ £35, Gold+
£45, and no figure appears twice. Provisional like every other price here, and
easily worth it against a corporate booking at £300–500.

**And it arrives when Rob and Mark are happy with it, not before** — which is
what the two-account entitlement above is for.

###### What online mode ACTUALLY needs, and none of it is media

**1. The question on the player's own screen — and it inverts rule 8.** This is
the big one and it is easy to miss. Rule 8 says *phones never show the question
text, only the options* — which keeps a pub looking UP at the projector and
makes googling harder. **Online there is nothing to look up at.** The host is
sharing a screen in a video call at whatever size the client's laptop decided,
possibly behind somebody's face. So an online player needs the question, the
picture and the reveal on their own device.

That is a MODE-SPECIFIC EXCEPTION and must never leak into a pub night — rule 8
stays exactly as written for in-person, where it is load-bearing. Two
consequences to design for, both honest: googling gets easier online (shorter
clocks, or simply accept it, because a corporate Christmas quiz is not the
world championship), and the projector view stops being the only place the
question exists, which is a real change to how `screenView()` and
`playerView()` divide up.

**2. Something that makes it feel like a ROOM.** A pub supplies the atmosphere
for nothing; online, silence is the product's problem. Chat, reactions, a
"who's here" list — cheap to build, no dependency, and the thing that decides
whether an online night is fun or a spreadsheet. This is what the host meant by
chat rooms and it is the genuinely missing feature.

**3. Teams — several phones, one team, scores averaged.** Already on the wanted
list as item 2 and worth more online than in a pub: a household on one sofa is
one team on three phones, and a corporate table is people in four different
houses.

**None of those need a media provider, and all of them are ordinary app work in
this codebase.** Which makes online mode a much better project than streaming
was: cheaper, no dependency, no per-use cost, and it is the part that is
actually missing.

###### Build it for YOURSELF first, and gate it to two accounts

The host's plan, and it is the right one: *"I wanted to add online quizzing to
my own offering, and then sell it because I already have it"* — *"maybe build
it and only allow myself and Rob to use it for now, until we've worked out the
bugs."*

**That is how this entire app was built** — for his own gigs, then sold — and
it is the reason it is any good. It also changes the arithmetic that said
online was not worth building: it is not £750 a year of subscriber revenue, it
is **his own corporate bookings at £300–500 each**, which one of pays for the
whole build.

**The gate wants a per-account ENTITLEMENT, and one does not quite exist yet.**
The shapes already here:

- `FEATURE_TIER` puts a feature on a rung — wrong, this must not be for sale
  yet;
- `OWNER_FEATURES` is owner-only and deliberately off the ladder — right for
  the owner, but Rob is not an owner;
- `prefs.featuresOff` only ever SUBTRACTS, by design, and must stay that way;
- **`packs` on an account is the pattern to copy** — an explicit list that
  beats the tier, set by `accounts.update()` and never by `setPrefs()`.

So: **an additive `features` list on the account**, owner-set, same wall as
`packs`. Two accounts on it and nobody else, no tier involvement at all, and it
is the mechanism every future beta wants rather than something built once for
this. `activeFeatures()` unions it in; `setPrefs()` ignores it like every other
entitlement, and there should be a test saying so.

**And the one hard constraint, which falls straight out of rule one: THE QUIZ
MUST NOT DEPEND ON THE AUDIO.** An online night has to run identically with the
streaming layer switched off — because that is what "online is a MODE and never
a LAYER" actually means when the media provider is having a bad evening. If the
audio dies mid-round in front of a paying corporate client, the host says "join
the Teams link in the invite" and the quiz carries on with every score intact.
**Build the fallback first and the streaming second**, or the beta is a
reliability risk on exactly the kind of booking that is worth the most.

Which is also why **one online night should be run over the client's own Teams
BEFORE any of it is built.** It is this week rather than a build, it wins a
booking either way, and it is the only honest way to find out what is actually
missing — which may turn out to be nothing more than a way for the room to hear
the music.

###### And if it is priced as one flat number instead

Cost around £10 at a hundred people, so **£25 a night** — one price, any size up
to a hundred, about 60% margin, and trivial inside a fee they are already
quoting. A 300-person night is a conversation rather than a formula.

But the honest sum: **ten quizmasters doing three online nights a year each is
thirty nights — £750 of revenue and £300 of cost.** That is not a business
line, and pretending otherwise would put a dependency into a live quiz night
for £450 a year. **The reason to build it eventually is that it opens CORPORATE
work for a quizmaster, which makes the subscription worth more** — not the
margin on the night. Which is another argument for selling it over the client's
own call first and building it only when somebody has actually hit the limit.

##### The version that was proposed: ONE NIGHT'S FEE, taken as a fee not a free gig

The host's idea, and the PRICE in it is the good part: *"the intro fee can be
the cost of a gig. The QM does a freebie (I get paid), the venue gets an intro
for the regular price and the QM potentially picks up a weekly gig forever."*

**"One night's fee" is the right unit and it is better than a number.** It
indexes itself — a quizmaster charging £250 in London pays £250 and one
charging £120 pays £120 — so there is no percentage to calculate, no earnings
to report, nothing to audit, and no price list to keep up to date. And the
arithmetic is obviously fine for the person paying it: a weekly residency is
about £7,800 a year, so one night's fee is **two per cent of the first year**.

**Change the DIRECTION of the money, though, and keep everything else.** The
version described — the venue pays Quizporium and the quizmaster works for
nothing — should be turned round so that **the venue pays the QUIZMASTER as
normal, and the quizmaster pays the introduction fee.** The money ends in the
same two places and the quizmaster's first night still nets zero. Three reasons
it has to be that way round:

- **It is a finder's fee between two businesses rather than free labour
  arranged by a platform.** The other shape is Quizporium supplying somebody's
  work to a venue, taking the whole fee and paying the worker nothing, which is
  a worse version of the employment-status question raised above.
- **"Do a free gig and you might get regular work" is the one offer
  entertainers are famously angry about**, and entertainers are the customer.
  The economics are identical; only one of the two is sayable out loud on a
  sales page.
- **It uses the invoicing that already exists.** The quizmaster raises a normal
  invoice to the venue on their own letterhead, which is what a real booking
  looks like from the venue's side — and the venue never sees anything unusual
  about the arrangement at all.

The two prices then stack the way marketplace pricing normally does and neither
can be dodged: **Gold gets you LISTED, an introduction costs a night.** Access
and conversion.

One risk to hold on to: the venue is paying full price for somebody they have
not seen, on the owner's recommendation. If it goes badly it is the owner's
name on it — which is the whole reason the vetting question below matters.

##### Collecting it: the LISTING is the enforcement, not the card

Asked: *"how would I enforce this? Just take it as a payment from the card they
have on file upon completion?"*

**At the scale this will be at for a good while, do not build a payment for it
at all.** A handful of introductions a month is an INVOICE — and this app
already raises invoices. Somebody who does not pay it comes off the directory,
and that is the whole of the enforcement: they are a Gold subscriber precisely
because they want to be listed, so the leverage is the listing rather than the
card. Zero build, no dispute process, and it can start the day the first
introduction happens.

**Whenever it does become a card charge, charge at ACCEPTANCE and not on
completion.** "On completion" sounds safer and is the harder of the two in
every direction:

- **The app would have to know the gig happened, and know it was THAT gig.**
  That needs bookings as objects and a venue on every night — neither exists —
  and even then a night run off-platform looks like a night that never
  happened.
- **It puts the money after the point where somebody would rather it did not
  happen**, so it invites exactly the reporting problem the whole flat-fee
  design was chosen to avoid.
- **The introduction is the thing being SOLD.** It is a discrete event on the
  site with a button on it, so charging there is un-evadable by construction —
  no detection, no verification, nothing to argue about.

So: the venue proposes a date, the quizmaster accepts, and **the acceptance
carries the fee in words on the button** — "Accept this booking · £150
introduction fee". If the venue then cancels before the date, refund it; that
is rare and it is a Monday, where a monthly reconciliation of who really worked
would be a Monday every week.

Four mechanical things to know before building any of it, because they are the
ones that bite:

- **A stored card charged later is a merchant-initiated, off-session payment**,
  and under SCA it only clears without the cardholder present if there was an
  authentication when the card was stored AND an agreement on file that it can
  be charged this way. That has to be set up at SIGN-UP, so it is a decision
  about the subscription flow rather than something to bolt on afterwards.
- **Keep it OFF the subscription's own billing.** A surprise £150 on a card
  that has been quietly taking £30 is a chargeback and a lost customer. It is a
  separate charge, separately agreed, separately shown.
- **A timestamped in-app acceptance IS the evidence** if it is ever disputed.
  Card networks side with the cardholder without one. So the acceptance record
  — who, what, when, how much, and the wording they pressed — is not audit
  furniture, it is the thing that decides a chargeback.
- **Authorise-now-capture-later does not stretch far enough.** An
  authorisation lapses in about a week; gigs are booked a month or more out.
  Charge, and refund if it falls through.

And do the first several **by hand, deliberately** — a phone call, an invoice,
and a note of what actually got argued about. That is how the rules get written
by the business rather than guessed at in advance, which is the same reason the
shop was built as a window with no money in it.

##### Ranking on the rating cannot do the vetting, and it is the wrong shape

Proposed: *"make it so the QMs are ranked by average rating and only the top
ones rank — so the vetting process takes care of itself."*

**It does not take care of itself, because a rating and a vet are different
jobs.** A vet is a GATE — are they insured, will they turn up, do they own
speakers, are they safe on a microphone in front of somebody's customers. A
rating is a REAR-VIEW MIRROR: it can only tell you after a bad night at a venue
the owner personally introduced them to. Public liability insurance is the
clearest case — no average of anybody's scores will ever tell you whether they
hold any, and a venue will ask.

Four more things go wrong with ranking on it specifically:

- **A new quizmaster has no ratings, so they never appear, so they never get a
  booking, so they never get a rating.** Whoever is listed first stays listed
  for ever. Every marketplace hits this and every one of them has to solve it
  deliberately rather than letting it emerge.
- **Small samples rank noise.** One night at 5.0 outranks forty nights at 4.8,
  and the first of those tells you nothing. If there is ever a ranking it wants
  a confidence-weighted average — pull every score towards the overall mean
  until there is a real sample behind it — which is a few lines of arithmetic
  and not a judgement call.
- **Ratings compress.** Everybody lands between about 4.5 and 4.9, so sorting
  on the average is sorting on the third decimal place of a number made mostly
  of how busy the room was.
- **It caps the owner's own revenue.** Every listed quizmaster is a Gold
  subscription. Hiding the bottom half means half of them stop seeing what they
  pay for and drop a rung.

**What ratings ARE good for is a FLOOR.** Below a threshold, after enough rated
nights to mean something, you come off the directory and it is a conversation.
That is what Uber actually does with its number — it deactivates on it, and it
does **not** dispatch on it. Delisting is a job a rating can do honestly;
ordering is not.

**So: vet at the door, sort on facts, show the rating.** The gate is a phone
call, proof of insurance and a read of their Past gigs — once per quizmaster,
not once per gig, so it stays the same size as the business grows. The order a
venue sees is distance, whether they are free on the date, and how many nights
they have run — all facts rather than opinions, and all of them what a venue
actually needs. The rating sits on the card where the venue can see it and make
up their own mind.

**What actually retains people is switching cost, and it is already built.**
None of it is a lock-in trick; it is all things they would genuinely miss:
their pack library and the weekly topical quizzes, their invoice book, and
above all **Past gigs — their portfolio, their photos and their numbers.** That
is the evidence they show the next venue, and it lives here. Add the rating and
the profile to it and the marketplace stays worth being on for the NEXT
booking, however this one was arranged.

**And the venue side keeps needing it after the first introduction.** A venue
that books one quizmaster direct still needs cover when that person is ill, on
holiday or double-booked. That recurring need is what makes a directory sticky
without a contract doing it.

**Do NOT build anti-circumvention into this.** Non-circumvention clauses are
hard to enforce at all against small operators and absurd to pursue over a
booking fee, and the marketplaces that leaned on them taught everybody to take
the relationship offline on day one. The rule that works is the one this
codebase already follows everywhere else: **make staying easier than leaving.**
An invoice raised automatically, the venue paying by card, no chasing — that is
worth a fee, and it is the invoicing feature that already exists pointed at a
booking.

The one measurement worth taking when it exists: not how many bookings went
direct, but **how many subscribers the directory brought in and how long they
stayed.** That is the number the whole thing is for.

### And a £30 subscription beats a £150 gig, because of what it does NOT cost

The host's own point, and it is the one that settles what this business
actually is: *"selling a pub a £30 sub is better for me anyway — it's £30 a
month I don't have to give up a premium slot to earn, vs £150 where I have to
give up a night… they're both a win, but the first is a bigger win"* — **"and
scales indefinitely."**

Be precise about it, because the headline numbers say the opposite: a weekly
residency at £150 is £600 a month and a subscription is £30. **Per venue the
gig wins by twenty to one. Per HOUR it loses, and per hour is the number that
runs out.** A night is four hours plus the drive, the setup and the pack
read-through, and there are only so many Thursdays, Fridays and Saturdays in a
week — call it four or five sellable slots, ever, at any price. Gig income has
a hard ceiling made of evenings. Subscription income has none.

So the two are not competing offers, they are **a capped business and an
uncapped one sharing a code base**, and the uncapped one is the reason any of
this is worth building:

- **The gigs are the proof and the R&D.** They are what makes the app good,
  they are the Past gigs page, and they are what a venue is buying when they
  book Mark rather than somebody cheaper. They also pay today, which the
  subscriptions do not.
- **The subscriptions are the business.** Twenty subscribers is £600 a month
  for no evenings at all — one residency's income, with every Friday still
  free to sell at £150.
- **A venue can be BOTH**, which is the bit the "conflict" framing missed
  entirely. A pub that books Mark monthly and runs its own quiz the other three
  weeks pays a fee AND a subscription, and neither replaces the other.

**The caveat is the one this codebase already knows about, and it is the whole
of "scales indefinitely".** A subscription only scales if a new subscriber
costs no time. Every feature that needs the owner to do something per
subscriber — approving a thing, answering a thing, writing a thing to order —
puts a ceiling back on it made of Mondays. That is why the draft-reply button,
the queue position, the been-opened receipt and "one open request at a time"
exist, and it is why the next feature that creates a pile has to be asked the
same question: **does this get bigger as subscribers do?** See the fifth
constraint in CLAUDE.md.

What it changes NOW: nothing on the site, which already leads with the software
for out-of-area venues and sends in-area ones to the booking page. What it
changes LATER is the order of the roadmap — anything that removes owner admin
per subscriber is worth more than a feature, because it is what makes the
uncapped half actually uncapped.

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
  hand to `applyBilling`. Nothing else.
- A Subscribe button per rung on the account page. Card details never reach
  this server.

#### One number worth knowing before the pack shop opens

At 2.9% plus a fixed fee, **the fixed fee is what hurts a £3 pack sale and
barely touches a £30 subscription.** Roughly: a £3 pack keeps about 87% after
fees, a £30 subscription keeps about 96%. That is another quiet argument for
the subscription being the business and the pack sale being the on-ramp, which
is what the pricing already assumes — and if pack sales ever become common, it
is an argument for selling three at once rather than one at a time.

### ~~Flooding a game with fake teams~~ — BUILT

`src/joins.js`. A lot of NEW phones at once are **held** rather than refused,
and the host's board says *"288 phones waiting to join — Let them in"*. One tap
lets the lot through. The number is what tells a room from mischief.

A phone that can prove who it is never queues, so a reconnection storm after a
restart is not mistaken for a flood. The threshold errs loose on purpose — a
false hold stops the show, junk teams are one tap to tidy. Per-IP limiting was
considered and rejected: a pub puts the whole room behind one router.

Also built: **"Remove the N who have answered nothing"** on the player board,
which is worth having for tidying a lobby whether or not anybody floods you.

See rule 4 in CLAUDE.md.

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
load-bearing rather than optional the moment anything is shared. And the eight
starter packs are not worth selling yet.

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
4. The eight starter packs, so there is something worth paying for.
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

### ~~A shared login can end somebody else's night~~ — FIXED

Found while thinking about group accounts, and it needs no group account to
happen. `session.launch()` in `src/session.js` builds a fresh game
**unconditionally** — there is no check for a night already in progress.

So if two people share one login and both press Launch, the second one silently
ends the first one's game mid-question: scores gone, every phone thrown into a
new lobby, in front of a paying room. That is this codebase's first rule broken
in the worst possible way, and the person it happens to has no idea why.

Reachable today by password sharing, which is exactly what people do when three
seats cost £90.

**Fixed.** `session.inProgress()` says what a launch is about to destroy, and
`/api/host/launch` answers the first press with a 409 naming the game, the
player count and where it has got to — *"The Madonna Quiz is running right now
— 3 playing, Round One — question 1 of 10."* A second, deliberate press carries
`replace` and goes through, because there are real reasons to launch over a
live game and a control that simply refuses is the mistake this codebase keeps
recording.

**The console already had a check, and it was blind to exactly this case**: it
read `library.running`, a snapshot taken when the page loaded, so a console
opened before the other device launched reported nothing running and went
straight ahead. That check is gone and the server's answer is the only one now
— the same lesson as the tier lever, where a guard that only lived in the
browser turned out to be decoration.

**Any joined player counts, lobby or not.** Forty people who have typed a team
name have something to lose, and "everybody type your name in again" is not a
thing anybody says on a mic. Nobody joined means nothing to protect, which
leaves the ordinary case — wrong pack up, launch again ten seconds later —
completely alone.

### Marketing — for later, but written down now

Neither of these is a code job yet. They are here so they are not lost, because
both are the sort of thing that is obvious once and then forgotten.

**A bundle rate for QM COMPANIES.** An agency running six quizmasters is one
conversation and six subscriptions, and they are the customer who brings you
five more without you doing anything. Two shapes worth thinking about, and they
are different businesses: a **per-seat discount** (six accounts at £15 rather
than £20), or a **company account with rooms under it** — rooms already exist
and are already per quizmaster, so the second is less work than it sounds. The
per-seat version is the one to offer first, because it needs no code at all:
set the tier and comp the difference.

Worth knowing what it fixes as well as what it earns. A host with three pub
residencies runs one pack at all three venues, so the busiest quizmaster hits
the pack ceiling SLOWEST — which is backwards. A company rate is the honest way
to charge for volume without metering anybody's nights.

**Venue relationships, off the back of the advert slides.** The strongest one,
and it is a genuinely different pitch from selling to quizmasters: a venue can
be told that a quizmaster running this software will reliably put their offer
on the projector between rounds — the pizza nobody is shifting, the Thursday
they want busier, a QR to tickets. That is worth something to the VENUE, and it
makes the quizmaster who uses it more likely to be rebooked, which sells the
software twice.

It is also why advert slides moved to Silver: the feature that makes a
subscriber more valuable to their own customer is the one worth paying for.
Nothing needs building for this — the slides work, and the per-venue sets are
already how they are filed. It is a conversation to have, not a feature.

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

### A quizmaster's OWN quizzes — and they are private from you — ✅ BUILT

Described properly in CLAUDE.md under "A quizmaster's OWN packs". Left here
because the reasoning is the valuable part, and it is what any change to it has
to keep.

**The only thing outstanding is step B2 above** — a second private repo, so
their packs survive a deploy. Without it the feature works and their work is
temporary, which their console says in red.

The constraint was the important half: **a subscriber writes their own material
and you must not be able to see it unless they let you.** It is their
intellectual property, not stock in your catalogue.

Also settled by the same sentence: **they do not generate with Claude.** That
is your bill and your house style. They write or upload; the app stores.

What that meant, and how each half landed:

- **A second library, per account** — `quizzes/` stays yours and shared. Theirs
  lives under their room, and the pack routes resolve their library first and
  the catalogue second, so a bare pack id still means one thing.
- **The owner cannot read it.** Not "the console does not show it" — the API
  refuses. Enforced structurally rather than by a check somebody has to
  remember: **no route takes a room parameter**, so there is no id you can send
  that reaches another room's folder. There is a test called
  "THE OWNER CANNOT READ A QUIZMASTER'S OWN PACK".
- **Support access is how you ever see one.** They switch it on, it expires, and
  "Opened your pack …" goes in the log they read. This is the first thing that
  actually needed it, and it works end to end.
- **Backup is theirs too** — `PACKS_REPO`, a third repository, with no fallback
  to yours. Step B2 above.
- **Which tier it sits on**: Bronze, under your own rule — writing a JSON file
  costs you nothing per use. One word in `FEATURE_TIER` moves it, but note what
  moving it up would mean: their own work becoming unreachable the month their
  card fails.

They still do NOT generate. That is your bill and your house style. They write
in the editor, or paste a track list into the same importer — with the
no-repeats memory left out of it entirely, since that is your generator's record
of what IT has used.


### Build out the owner admin console — ✅ BUILT

Five tabs, split by the question each answers: **Tonight** (can I deploy?),
**People** (what is going on with one subscriber?), **Money** (is this paying
for itself?), **Catalogue** (is what I write worth writing?) and **Inbox** (who
is waiting to hear back?). Described properly in CLAUDE.md under
"The owner page".

The one worth knowing about is **Money**, because it needed something that did
not exist: a ledger. Every Claude call and every OpenAI picture is now written
down as it happens, with what it cost and which pack it was for — so
"what does a pack cost to make" is a number on a page rather than a guess
against a card statement a month later. It backs up to the private repo like
the invoices.

Two things are deliberately NOT on it, and both were considered:

- **No way to drive a game.** One place moves a quiz and it is the control
  view. A second set of Next/Back buttons polling the library would eventually
  double-advance a room.
- **Nothing about a subscriber's own packs**, not even a count. A count is not
  content, but a page that quietly reported on somebody's private work would
  undercut the promise the rest of that feature makes.

What was on the original list and is still not built:

- **A calendar of who is booked where.** That is a quizmaster tool that exists
  as a tier, not an owner view, and nobody has asked for the owner's version.
- **Payments.** Still processor-agnostic and still unwired — see below.

The original list, for reference:

- **Who is running what, right now** — every room, what is on its projector,
  how many are in. `rooms.summaries()` already returns it and the console shows
  it in a thin strip; it belongs here properly.
- **The catalogue as a product** — which packs exist, which are selling, which
  have never been played, which have open corrections against them.
- **Money** — who is on which tier, who is lapsed, what is owed. The invoice
  book is a quizmaster tool today; the OWNER's view of revenue is a different
  thing and does not exist.
- **What generation has cost** — Claude and OpenAI spend per pack, because that
  is the number the whole tier structure is built on.
- **A subscriber's account, from the outside** — their tier, their room, their
  join code, a way to reset their password, and support access with a log.
- **The song history and the packs**, which are owner-owned but currently live
  on the quizmaster console because that is where they were built first.

---

## 1. Selling other quiz masters a subscription — doable

They log in, use quizzes you have written, cannot write their own. Around
£9.99 a month.

The work, in order of size:

- **Multi-tenancy.** Concurrent games, per-account state, room codes so two
  nights do not collide on one join URL. The engines are already classes with
  injected state so several can exist at once; it is `server.js`, the store and
  the live connections that assume one of everything.
- **Accounts.** Real ones, hashed passwords, sessions — where today there is
  one shared key.
- **Payments.** Stripe Checkout and a webhook. Can be done over plain HTTP with
  no library, so it does not break the no-dependencies rule.
- **Hosting.** Ten hosts times sixty phones is six hundred connections held
  open all evening. That is off the free tier for real.

Worth saying plainly: **"they cannot make their own" is a content commitment.**
A subscription means owing them new quizzes every month, not just software.

### In-person and online as two modes on one account

The plan: a subscriber flicks between **in-person** (projector, phones as
buzzers — what exists) and **online** (one link, quiz and host and chat in one
page). Two modes is a higher tier, and rightly so, because online genuinely
costs you money per event where in-person costs you nothing.

**The number that decides the tier.** Sending the host's picture to a room
costs about twenty times what sending their voice costs. For a 90-minute quiz
with a hundred people, at a typical five cents a gigabyte:

| What is sent | Per viewer | For 100 | Four events a month |
|---|---|---|---|
| Video, 1 Mbps | 675 MB | 67.5 GB | **$13.50 per subscriber** |
| Video, 500 kbps | 338 MB | 33.8 GB | $6.75 |
| Audio only, 48 kbps | 32 MB | 3.2 GB | **$0.65** |

A £9.99 subscriber running four full-video nights a month is **underwater
before anything else is paid for**. The same subscriber on audio-first costs
under a pound. Check the provider's current rate before committing, but the
ratio is arithmetic and will not move.

So audio-first is not only the right design — the quiz should own the screen,
and audio survives bad home wifi — it is what makes the subscription work at
all. Video is a small tile, off by default, and **any account that leaves it on
all night needs metering or a higher tier**. Decide that before the first
subscriber, not after the first invoice.

**Keep the online path OFF the in-person path.** A media service having a bad
day must never be able to affect a Wednesday night in a pub. That is nearly
free to guarantee if the modes are separate from the start and close to
impossible to retrofit — which is the whole reason it is written here.

**Build order, whichever way the video goes:**

1. **The combined player view** — question and answers on one device. Needed
   for any remote quiz at all, and it is what keeps the speed scoring honest
   when every viewer is a different number of seconds behind. Worth building on
   its own merits.
2. **Audio broadcast** from the console, host to players, one way.
3. **The camera tile**, small by default.
4. **Chat** — only worth building once the app IS the meeting. If a subscriber
   is on Teams or Zoom, their people are already chatting there and a second
   chat is a room nobody stands in.

**Not building it inside Teams or Zoom**, despite their meeting-app SDKs being
neat: two builds and two app reviews, corporate IT blocks third-party meeting
apps by default, and a product that only exists inside somebody else's meeting
is a feature of their platform rather than a business of yours.

### How the subscription actually works — settled enough to build against

**Accounts.** Email and a password hashed with scrypt, which is in Node's own
standard library, so no dependency. Each account owns everything it makes:
quizzes, bingo packs, adverts, photos, its no-repeats history and its running
game. The single `HOST_KEY` becomes one key per account.

A hashed password means **you cannot see theirs even if you wanted to**. That
is structural, not a promise, and it is worth saying out loud when you sell it.

**Payments are deliberately processor-agnostic.** The app stores two fields —
a customer id and a status — and listens for a webhook that says paid, lapsed
or cancelled. Nothing else about billing lives here, and card details never
touch this server at all. That means the processor can be swapped later without
redesigning anything:

| | Worth knowing |
|---|---|
| **Stripe** | Best developer experience. Being awkward at the moment. |
| **PayPal** | Does subscriptions and one-offs. Clunkier API, less pleasant checkout, but perfectly workable. |
| **Paddle / Lemon Squeezy** | **Merchant of record** — they are legally the seller, so they handle UK and EU VAT on digital goods for you. For a one-man band selling quiz packs across borders this is probably the right answer, and it removes the tax question below entirely. |

**Support access, and why it is a selling point.** Other quiz hosts are not
exactly competitors, but they will still wonder whether you can read the
quizzes they wrote. Two different kinds of sensitive:

- **Impossible for you to see:** their password (hashed) and their card (at the
  processor). Nothing to design.
- **Possible, because you own the database:** their quizzes, their player
  names, their venues. No code changes that. What code CAN do is make it
  consented and visible — support access is a switch THEY turn on, it expires
  on its own, and every action taken while inside is written to a log they can
  read.

Answering "can you read my quizzes?" with "only when you let me in, and here is
the list of everything I did" is a better answer than "I promise I do not".

**The library.** Two kinds of pack in one place:

- **Theirs** — written or uploaded, owned by their account, invisible to
  everyone including you unless support access is on.
- **Yours** — a shop. Buying grants a LICENCE, a row saying this account may
  use this quiz, rather than copying the file. So when you fix a wrong answer
  every subscriber gets the fix. Never delete a sold quiz; archive it.
- **"Make my own version"** forks a bought quiz into their account as a copy.
  They will ask for this within a week.
- Bundles and promotions are a pricing decision, not a code one — the licence
  row is the same however it was paid for.

**Serving packs costs nothing worth charging for.** Measured: a quiz pack is
4–11 KB. Two hundred subscribers taking four each a month is 6 MB. The only
line that grows is artwork — real portraits are a few hundred KB each, so the
same subscribers cost about 2 GB a month, still pennies, and a CDN removes even
that. **Charge per quiz because your time writing it is worth money, not
because serving it costs anything.**

### Pictures in a quiz — the bit that changes when you start selling

**"Fair use" is American. The UK has "fair dealing", and it is much narrower.**
It is a closed list — research and private study, criticism and review,
quotation, parody, news reporting. Commercial entertainment is not on it.
**There is no "it is only a quiz" exception.** A press photograph on a
projector at a paid gig is, strictly, copying and communicating somebody's
copyright work to the public.

On its own that is a small practical risk. It stops being small the moment
packs are SOLD, because at that point they are being distributed at scale, with
your name on them and revenue attached — which is a different order of
exposure from using one picture on your own projector on a Tuesday.

**So the instinct to generate the artwork was right**, and for a stronger
reason than the one it was chosen for. Keep it. Points to hold on to:

- **OpenAI's terms assign the output to you**, including commercial use, so
  there is a contract behind the packs you sell.
- **The caption already on screen — "AI-generated illustration, not a real
  photograph" — is doing legal work as well as honest work.** It is a plain
  statement that nobody is being passed off. Do not quietly drop it.
- **Likeness is a separate question from copyright.** Using a recognisable face
  AS THE SUBJECT of "whose face is this?" is much safer than using one to
  suggest an endorsement, which is what passing off actually protects against.
  Do not generate anything unflattering, and be more careful with the living
  than the dead.
- Alternatives if a generated picture will not do: **public domain**, or
  Creative Commons with the attribution shown on screen — but share-alike
  licences are awkward in a pack you sell. Licensed editorial stock costs real
  money per image per use.

**And the bigger exposure is the music, not the pictures.** In a venue, the
venue's PRS and PPL licences cover what you play. **Online they do not.** A
corporate quiz streamed to a hundred remote people is a public performance with
nobody's licence behind it — worth an hour of an actual solicitor's time before
the online mode is sold, not after.

None of the above is legal advice. It is the shape of the problem, so the
conversation with somebody qualified is short and cheap.

---

## 2. Karaoke — yes, and cheaper than it sounds IF the tracks stay yours

Your idea: once there is a music licence, add karaoke, with hosts either
streaming the tracks for a fee or downloading the lot in one go.

**The two halves of that sit on opposite sides of a legal line**, and which
side you build on is the difference between a weekend of work and a licensing
business.

### The distinction that decides everything

**Performing** music in a room and **distributing** music to other people are
different rights, licensed by different people, at wildly different prices.

TheMusicLicence — the joint PRS/PPL one — covers *public performance on
premises*. It is what makes playing a track out loud in a pub lawful. It says
nothing at all about sending audio files to another quizmaster, or streaming
them from your server into their venue. That is reproduction and
making-available, and no venue licence touches it.

So:

- **You using karaoke at your own gigs** — the venue's licence covers the
  performance, and your KaraFun subscription covers the tracks. Nothing to
  build, nothing new to license.
- **This app streaming or shipping tracks to subscribers** — that is you
  becoming a music distributor. Different business entirely.

### Karaoke is harder than records, and this is the bit people miss

A karaoke track is three licensed things stacked up:

1. **The backing track** is a NEW recording of somebody else's song — a cover.
   Making one needs a mechanical licence from the publisher.
2. **The lyrics on screen** are a separate reproduction of the words,
   controlled by the publisher independently of the recording. This is the one
   that catches people out.
3. **The performance in the room** — the venue's licence, as above.

That stack is exactly why KaraFun, Sunfly and Zoom are licensing businesses
rather than somebody's side project, and why every one of their subscriptions
forbids passing tracks on. "Download once and keep it on the hard drive" is
fine when THEY sold it to the host and a breach when you did.

*Not legal advice — but it is the shape of the problem, so the conversation
with a solicitor would be short and cheap.*

### What to build: the show, not the songs

**Exactly the same shape as music bingo, which already works this way.** You
play bingo tracks from your own DJ app; the software runs the game around them
and never touches the audio. Karaoke is identical — KaraFun plays the track on
the host's laptop, and this app is the show:

- **Singers join on their phones** with the join code, put in a name and a
  song request. Same join flow, same QR, nothing new to learn.
- **You get the queue on your control view.** Reorder it, bump somebody up,
  mark them done, drop a no-show. One tap each, same as everything else there.
- **The projector shows "Now singing" and "Up next"**, with the join code still
  in the corner for latecomers.
- **Optional: the room votes**, so it is a karaoke CONTEST with a scoreboard —
  which is your product rather than a karaoke box's. A plain karaoke machine
  cannot do that and it is the reason a venue would book you over hiring a box.

Zero licensing exposure beyond what the venue already has. Zero audio over pub
wifi, so nothing can buffer mid-chorus with somebody holding a microphone —
which matters more here than in the quiz, where a slow question is survivable.

### Why NOT to host the tracks, even once licensed

Two reasons on top of the legal one:

- **Egress.** The sums are in direction 1 above: video runs about twenty times
  audio, and four 100-person video nights already exceed what a £9.99
  subscription covers. Karaoke is 3–5 minute tracks, thirty to sixty a night,
  usually with video. That is a serious bandwidth bill per host per night.
- **Reliability, which beats everything else here.** A quiz question arriving
  half a second late is survivable. A backing track stalling in front of a
  singer is not. Files on the host's own machine cannot do that.

### If you ever do want tracks in the product

Do not license songs yourself — that is years and lawyers. Do a **B2B deal with
a catalogue that already holds those rights**. You are already a KaraFun
customer, which makes it the cheapest possible first conversation: *"I sell
quiz software to pub hosts — can we integrate, or resell?"* You would be
selling access to their catalogue, not distributing anything.

**And the runner above is what you would bolt a catalogue onto anyway**, so it
is not wasted work either way.

### Size of the job

Small, for what it is. CLAUDE.md documents adding a game as four places to
touch, and the room work is already done. Roughly: an engine (the queue and
whose turn it is), a card set for the big screen, a panel on the control view,
and one line in the console so it gets a tab. No new dependencies, no build
step, no audio.

### One thing to check before spending on a licence

**Is the music licence even yours to take out?** In most pub gigs it is the
VENUE's obligation — they hold TheMusicLicence and it covers music played on
their premises whoever presses play. Worth confirming before you pay for one
you may already be covered by. It matters for the quiz and bingo you run today,
not just for karaoke.

---

## 3. On the App Store, a few pounds a go — hard, and a different product

Not a port of this. This app is one host driving a projector with phones as
buzzers. "Friends competing on their phones" has no host to press Next and no
big screen — it is a second game that happens to reuse the scoring.

Three things to know before spending anything:

- **Music licensing is the real blocker.** Today YOU play the music, in a
  venue, under that venue's PRS/PPL cover. An app that plays clips to consumers
  has no such cover, and licensing recorded music for an app is slow and
  expensive. Without audio it is a text quiz, which is a far weaker product
  than the one you actually run.
- **Apple takes 15–30%** and requires in-app purchase for digital goods.
- **Apple rejects thin web wrappers** (guideline 4.2), so it needs to be
  genuinely native — which ends the no-build-step rule, and adds $99 a year and
  an app review queue.

Cheaper first step: sell it as a **paid web app**. Same price, Stripe, no
review, no wrapper. If people pay, then decide whether native is worth it.

## 4. Paid TikTok streams with cash prizes — easy to build, hard to be allowed

The smallest code change of the three: QR joining, live scoring and a winner
all exist. Bolting a payment onto the join screen is a week.

The problems are not technical:

- **Taking entry money and paying out prizes is regulated.** Done wrong it is
  an unlicensed lottery. A quiz can be a lawful prize competition under the
  Gambling Act 2005, but only if the skill genuinely deters a significant
  proportion of entrants — a legal test, not a design preference. Take advice
  before accepting a single payment.
- **You become a payment intermediary**, paying money to strangers. Stripe
  Connect can do it but contests need explicit approval and identity checks on
  the people being paid.
- **Stream delay breaks the scoring.** TikTok Live runs 5–20 seconds behind,
  and by a different amount for each viewer. Points here are "correct answer
  plus seconds left on the clock" — the thing that makes this quiz good is
  exactly the thing that does not survive a stream. That format needs a
  different scoring model, not a tweak.

## What to avoid doing in the meantime

- Do not add anything that assumes a single global game, a single host key, or
  a single set of packs, without at least leaving a note here.
- Keep the engines free of the filesystem and the clock, the way they are now.
  That is what makes running several at once possible at all.
- Keep packs as files with ids. Per-account packs are a folder per account
  before they are a database.

---

# If something goes wrong

**Blank page when you first open it**
Free tier waking up. Wait 60 seconds, do not keep refreshing.

**"Wrong host key"**
The key in your address does not match `HOST_KEY` in Render.
🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env

**Phones join but nothing updates**
Venue wifi. Tell people to turn wifi off and use mobile data — the app is built
for exactly that and uses barely any.

**A question turns out to be wrong mid-quiz**
**Skip** on your Control view. It takes back any points it awarded.

**Everything has gone wrong**
Console → the game you want → **Launch**. Starts completely fresh. Teams rejoin
in ten seconds.

**Still stuck**
🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/logs — errors are
in plain English.
