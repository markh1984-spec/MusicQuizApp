# A quizmaster directory — venues hire a host through the site

The biggest single idea in here, and the one that changes what the app IS:
venues finding a quizmaster rather than a quizmaster finding venues.

**Parked strategy — nothing here is scheduled.** Part of
[`../business.md`](../business.md), which is the index. It moved out on 16
August 2026 because that file had reached 170KB with 89% of it under a single
heading, and a session opening it for one answer was paying for all of it.

---

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
