# Business — pricing, and the directions not being built yet

Parked strategy, moved out of TODO.md. **Nothing here is scheduled.** It is
kept because each section records reasoning that was argued through once and
should not be re-argued from scratch.

---

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


## Where the rest of it went

**Split on 16 August 2026.** This file was 169,962 bytes and 89% of it sat
under one heading, because every new idea landed under whatever heading was
last — so the quizmaster directory, venue accounts and karaoke were all filed
as *"Asked for, not yet specced"*. **Open the one you need.**

- **[`business/directory.md`](business/directory.md)** — venues hire a host
  through the site. The biggest idea in here.
- **[`business/groups.md`](business/groups.md)** — group and venue accounts,
  seats, and who may see whose.
- **[`business/marketplace.md`](business/marketplace.md)** — quizmasters write
  and you resell; referrals; the pack shop.
- **[`business/karaoke.md`](business/karaoke.md)** — the second product, and
  why the tracks must not be yours.
- **[`business/plumbing.md`](business/plumbing.md)** — PayPal, photo storage,
  the starter packs.
- **[`business/other-directions.md`](business/other-directions.md)** — marketing
  notes for later, the App Store, TikTok, and what to avoid meanwhile.

**AND THREE SECTIONS WERE DELETED RATHER THAN MOVED**, because each was
finished: flooding a game with fake teams, a shared login ending somebody's
night, and own packs staying private.

**TWO MORE SAID `✅ BUILT` AND WERE NOT, which is why a delete is read rather
than matched on a marker.** *"The pack shop — ✅ THE WINDOW IS BUILT, the money
is not"* is mostly unbuilt — the PayPal plan ids, the webhook, the purchase
write, and a live instruction that **Gold must be marked not yet available**
when it ships; it is in `business/marketplace.md`. And the owner admin console
carries a still-not-built list, kept below. **A build plan left behind for a
thing that already exists is a trap** — CLAUDE.md records one nearly causing
the picture-drawing step to be rebuilt. Their reasoning is in CLAUDE.md, where
finished work is recorded, and git history holds the text.

**PUT A NEW IDEA UNDER THE HEADING IT BELONGS TO**, and if there is not one,
start a file. That is the whole reason this needed splitting.

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

### A FREE TRIAL RUNS AT THE TOP OF THE LADDER — capabilities, never the catalogue

Asked for directly on 3 September 2026: *"On signup if they're getting a free
trial they should be allowed to preview in whichever mode they want? Run an
online quiz once is fine as well I want them to want that tier."*

**He is right, and the old arrangement argued against itself.** A trial opened
at Bronze, because `featuresFor()` read `tierFor()` and a trialist's tier is
whatever they picked on the sign-up page. `FEATURE_TIER` gates adverts and the
league at Silver and pack requests and streaming at Gold — so the four things a
trialist might ever climb FOR were the exact four they never saw. **A fortnight
of Bronze sells Bronze.**

**THE STATUS GRANTS IT, NEVER THE TIER, and that is what keeps *"there is no
free tier"* true.** `trialPreview()` in `plans.js` is the one definition;
`featuresFor()` asks it to hand over the whole ladder and `entitlements()`
reports it as `previewing`. `account.tier` is untouched, so every price,
invoice and downgrade still reads what they signed up on — and there is still
no £0 rung, which is the thing that note has always been guarding against.

**It stops on its own.** `trialExpired()` is checked one line above the grant,
so the day the clock runs out the account falls to nothing exactly as it did
before. Nothing has to remember to take it away, and there is no scheduled job
to fail quietly.

**It is the same expression `comped` uses**, deliberately — "everything on the
ladder" now has one definition rather than two that can drift apart.

**A GROUP SEAT IS STILL STRIPPED OF STREAMING.** `strip()` is applied to the
trial grant too: egress is a real per-use cost and a group was never priced for
it. A trial widens what somebody may try; it does not change what a seat is.

#### The catalogue is deliberately NOT part of it

`packsFor()` reads `tierFor()`, so a trialist keeps whatever packs their rung
holds — eight to start, on Bronze.

**That is a decision, and this file's own reasoning is what settles it:** *"the
upsell is deliberately not a greyed-out button… so the lever is the library."*
The ladder works because content is the thing being climbed for. Handing over
every pack for a fortnight sells the packs and then takes them away, which is
churn dressed up as generosity — and it is the one half of a trial that would
be genuinely expensive to reverse, because somebody who has run four catalogue
nights has already had the value.

What he asked to be previewable is the MODES, and modes are capabilities. The
two halves are separable and they have been separated.

#### And the end of it has to be said BEFORE it happens

A fortnight of everything that simply stops one morning, with four features
missing and no explanation, is the exact thing this app must never do to
somebody on a gig day. Money and warnings are the stated exceptions to the
one-short-line rule, so the account panel says plainly what is switched on, how
many days are left, which rung they land on, and that the packs were never part
of it.

**A CELL IN THE TIERS TABLE DESCRIBES THE RUNG, NEVER THE ACCOUNT — and the
trial very nearly broke that.** The first build printed "on trial" wherever a
rung above yours held a capability. Rendered at 1280, it read as nonsense: the
BRONZE column claimed adverts were on trial, which says something untrue about
Bronze, while Silver and Gold kept a plain tick that now looked like "yours".
What the ACCOUNT holds is already carried by the shading and by the `yours`
label; what a RUNG holds is what those cells are for, and a trialist is not on
a different ladder. **Said once, in the line under the table**, where it is a
fact about them rather than about the tiers. Found by rendering it, which is
the whole reason that rule exists.

**When streaming actually bills, this wants a cap** — *"run an online quiz once
is fine as well"*. There is no video behind the switch yet, so an online night
costs nothing today and a counter would be machinery guarding a bill that does
not exist. The moment Cloudflare is wired it becomes a real per-use cost on an
account that has paid nothing, which is precisely the shape the join-flood rule
exists for: **hold it at a stated number rather than discovering it on an
invoice.** The note is in `featuresFor()`, beside the grant.

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

## The sales page — one argument, both audiences, 3 September 2026

`public/home.html`, and `/` now leads to it.

### A shop with its lights on and the door round the back

`/` sent anybody not signed in to `/login` — a password box for an account they
do not have — while the page that sells the thing sat at `/home`, reachable only
by knowing to type it. **That was the single biggest thing wrong with "there is
no website":** there was one, and nothing pointed at it. Signed in is unchanged
(console for a quizmaster, owner page for the owner), so nobody who works here
walks past the marketing, and signing in is one press from the header.

### The argument is the host's own, and it is why one page serves two audiences

*"You can sell it as a QM who uses this software could be a better option as a
host as well."*

That is sharper than the three options it was chosen from, and it dissolves the
problem with selling to quizmasters and venues at once. It is **one argument,
not two**: a quizmaster buys this to become the host venues rebook, and the
evidence half — headcount per venue, the post-night report, the public gallery,
the league, the comeback slide, advert scans that count — is simultaneously the
demo to a quizmaster and the proof to a venue. A split landing page would have
given each half a weaker pitch; this gives both the same strong one.

So the page leads on **"Be the quizmaster they book again"** rather than "run
the whole night from one laptop", which was true and sold an operations tool.

### Real screens, because a drawn mock is the one thing a buyer cannot check

The hero was `.ld-mock` — a hand-drawn CSS impression of a question screen. It
is five real screenshots now, which is what this entry asked for in the first
place. The mock was also quietly WRONG: four flat chips and a bare clock, where
the real screen carries the countdown bar, the answered count and the round
pills.

**They are fixture teams, never a real room** — no player's face or name goes in
the public repo. **WebP at 1200px: 4.6MB of PNG became 180KB**, which matters on
the wifi a quizmaster reads this on. **Under `/assets/`** rather than a new
top-level `/site/` route — a one-segment prefix at the root is a catch-all, and
this repo has already had one eat `/api/gallery`.

**The declared `width`/`height` are the files' real dimensions, checked rather
than assumed.** The console shot was declared 1200x750 and is 1200x675, which
would have made the page jump as it loaded — found by measuring the files.

### A rung with no button is a price list

Each tier now has a real button (`/signup?tier=bronze|silver|gold`), and the
rung rides through signup exactly like `?ref=` already did.

**IT IS RECORDED AS `wantedTier` AND MUST NEVER BECOME `tier`.** `tier` is what
the app grants; this is only what somebody pressed. Reading a rung out of a
request body and granting it hands anybody Gold for nothing — a stranger types
`?tier=gold` as easily as pressing it, the same shape as the pack id that had to
be re-checked at the launch route rather than trusted to the console not drawing
a button. The route validates against the real `TIERS` ladder, so junk arrives
as an empty string and the spread drops it.

Before payments exist it is the only signal about which price people actually
want; after they exist it is what to offer rather than ask again.

### `create()` DROPS WHAT IT DOES NOT DESTRUCTURE, SILENTLY

`accounts.create()` takes a fixed parameter list, so `wantedTier` went in and
vanished with nothing thrown — the quiet-loss shape this repo keeps meeting. It
is in the signature and on the account now, absent unless a rung was pressed.

### ADDING A 113th TEST FILE MADE THE SUITE FLAKY

The tests were written as `test/signup-tier.test.js` and the suite started
failing **a different test each run** — the breakout HTTP test once, two offers
tests the next — each passing in isolation.

**It was the file, not the code.** `npm test` is `node --test test/*.test.js`,
one process per file at CPU concurrency; the 113th tipped the server-spawning
tests into contending. Attributed properly by stashing **including untracked
files** — the first attempt stashed only tracked ones, so my new tests ran
against stashed-out source and the control proved nothing. Clean tree: green
twice. My tree: flaky twice.

Folded into `test/signup-route.test.js`, which already starts a real server —
so the tier round trip is now asserted over real HTTP against the account file
the route actually writes, which is stronger than the unit test it replaced.
Green twice after.

**A flaky suite is worse than a slow one.** A slow one gets skipped before a
gig; a flaky one teaches you to ignore red, which is the same failure with more
steps.
