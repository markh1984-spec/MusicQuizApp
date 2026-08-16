# The other directions — marketing, the App Store, TikTok, what to avoid

Ideas raised and answered, plus the marketing notes written down for later.
Each is here so it does not get raised again from scratch.

**Parked strategy — nothing here is scheduled.** Part of
[`../business.md`](../business.md), which is the index. It moved out on 16
August 2026 because that file had reached 170KB with 89% of it under a single
heading, and a session opening it for one answer was paying for all of it.

---

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
