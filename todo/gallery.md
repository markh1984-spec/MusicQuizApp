# The photo gallery, print on demand, and the rude-photo problem

Photographs after the night: who may see them, what may be printed on them,
and what happens when one of them should not be on a wall.

**This is part of [`../TODO.md`](../TODO.md)** — the live list. It moved out on
16 August 2026 because every session opens TODO.md and this is not what most of
them need. **A finished item is DELETED from here, never ticked**, exactly as in
the parent file.

---

## The photo gallery, and print on demand

**Decided on 15 August 2026: Instagram posting is OFF the list.** Two better
reasons than the API pain that was already blocking it — *"I think it would be
better for the app itself to have a gallery section containing previous
nights"*, and the photos should reach the people in them.

**Dropping it costs almost nothing, which is worth knowing before anybody
reconsiders.** Posting was never built: it needed an Instagram Business
account, a linked Facebook Page and Meta app review (see `docs/history.md`).
What exists today is a share sheet, and that can stay.

### Two galleries, not one

- **The quizmaster's**, inside the console, hanging off **Past gigs** — the
  evidence half of Gigs, which is where photos already belong by the rule in
  CLAUDE.md.
- **The room's**, outward-facing, so the people who took the photos can see
  them. The host's own argument and it is the strong one: *"if we're asking
  for their permission to store their photos, they should actually be able to
  see them once they're up."* That is close to a legal expectation as well as
  a fair one — a right of access is not satisfied by "it was on a projector
  for four seconds".

### Print on demand — mugs, t-shirts, from a specific photo

The pitch is real and it is unique: **the props only exist inside this app**,
so a photo taken at one of these nights cannot be recreated anywhere else.
The host wants a cut, which is what decides most of the design below.

### WHAT CANNOT WORK AS ASKED, and what to do instead

**"Stop them downloading it" is not achievable and must not be claimed.** The
photo has to be decoded by the browser to be looked at; a right-click can be
blocked and a screenshot cannot, and on a phone that is two buttons. Any claim
otherwise is the same lie CLAUDE.md already forbids about the invoice book —
*never claim it cannot be read*.

**The version that works is not DRM, it is not publishing the valuable copy.**
A screenshot yields a phone-sized, recompressed image that is useless for
print. So:

- **the DISPLAY copy** — modest resolution, discreet watermark, that is what
  the gallery serves and what a screenshot can ever capture;
- **the PRINT MASTER** — full resolution, unwatermarked, never served to a
  browser at all, and handed straight to the print provider on an order.

Nobody is prevented from keeping a souvenir, and nobody can print a t-shirt
from what they kept. That is the honest shape of it.

### AND 1080 PIXELS WILL NOT PRINT A T-SHIRT — measure this before selling one

`filters.js` uploads a **square 1080 JPEG at quality 0.85**. In print terms:

| At | Usable size |
|---|---|
| 300 dpi (proper) | **3.6 inches** |
| 150 dpi (the usual floor) | **7.2 inches** |

**A mug panel is fine. A t-shirt front wants ten to twelve inches and would be
printed at about 90 dpi — visibly soft, on a thing somebody paid for.** So the
upload has to go up, probably to 1600–2048 square, and that costs bytes on pub
wifi. It is a real tension with the rule that the join path must not stutter,
and it is cheaper to settle now than after somebody has been sold a blurry
shirt. **A print master could be sent as a SECOND upload** so the display path
keeps its current size and the big one goes straight to the private repo.

### THE CONSENT WE HAVE DOES NOT COVER THIS

Today the phone says the photo **"goes on the big screen"**. That is not
permission to put it on a public web page, and it is certainly not permission
to sell merchandise made from it. Three separate things, and the gap matters
more here than usual because a pub quiz has families in it.

- **The gallery should be a PER-NIGHT UNLISTED LINK, not a browsable public
  index** — reached by a QR on the last slide, `noindex`, no directory of
  strangers' faces for anybody to walk. It satisfies "they can see their
  photos" completely and avoids the category change.
- **The wording at upload has to say what actually happens**, including that
  prints can be ordered. It stays one short line — see the house style.

### THE MONDAY PROBLEM, and it is the one that decides whether this is worth it

**Print orders create customer service: wrong size, never arrived, "it came
out blurry", refunds.** That is DAILY-cadence work, and CLAUDE.md is explicit
that anything needing daily attention is a bad fit for a business with one
admin day a week.

**So the provider must be the merchant of record.** They take the order, the
money, the support and the refunds; the app hands over a print master and a
product choice and takes a margin or a referral fee. **The app never becomes a
shop.** If the only available deal makes the host the seller, the honest answer
is that the revenue is probably not worth the Monday.

### What to build, in order — each step useful on its own

1. **The per-night gallery**, unlisted link, display copies only. This is the
   fair thing and it owes nothing to the rest.
2. **The consent wording**, shipped with or before it. Not after.
3. **Past gigs links to it**, which is one line once the gallery exists.
4. **Raise the resolution / add the print master.** Needed before any print
   offer is credible, and pointless before there is one.
5. **Print on demand**, once a provider and a merchant model are chosen.

### Still open

- Which provider, and **who is the merchant of record** — the whole Monday
  question above hangs on it.
- Whether the gallery lives per night only, or a venue ever gets a standing
  page of its own.
- Serving: photos are in a **separate private repo**, so the app proxies them
  (`/photos/<file>`). A public gallery makes the server a media server, on a
  free tier that sleeps. Worth measuring before it is promised to anybody.

### Checking photos for nudity — and where the check belongs

Asked for on 15 August 2026: *"sometimes people just post silly photos, and
some of them show nakedness… we're not a porn site, we're a quiz company."*
Right, and the timing is right too: the risk changes completely the moment
photos stop being four seconds on a projector and become a public page and a
printed t-shirt.

#### IT DOES NOT CONTRADICT "no approve step", because it goes somewhere else

CLAUDE.md says photo uploads **auto-publish**, with a kill switch and a bin and
**no approve step anywhere**. That decision was made about a PROJECTOR, in a
room the host is standing in with a microphone — and on those terms it is still
right. A gallery is not those terms:

| | Projector | Gallery and merchandise |
|---|---|---|
| Who sees it | the room, for 4.5 seconds | anyone with the link, indefinitely |
| The remedy | the host, on the mic, plus the kill switch | there is none once it is out |

**So the check gates the GALLERY, not the room.** The projector path is
untouched — no latency added on a gig night, no approve step, nothing about
tonight changes. Nothing reaches the outward-facing gallery or a print master
until it has been looked at. That honours both rules rather than trading one
for the other.

#### NO MODEL SHIPS TO A PHONE, AND NONE RUNS ON THE SERVER

The obvious build is a browser NSFW classifier and it is out on rules this file
already applies to face detection: *a model is megabytes on a stranger's phone
over pub wifi*, and it breaks **no dependencies**. Server-side is no better —
same dependency problem, on a free tier that sleeps with 512MB.

**A hosted moderation API is the fit**, and it is the shape this codebase
already uses for Claude, OpenAI and Imagen: a plain HTTPS POST, no package.
Google Cloud Vision **SafeSearch** returns adult/racy/violence likelihoods and
costs about **£1.20 per thousand images** — a busy night is fifty photos, so
roughly 6p. **It goes in `src/spend.js` like every other supplier**, or the
Money tab quietly stops being the whole picture.

**A skin-tone pixel heuristic is the tempting no-API answer and it is worse
than nothing** — it fires on close-ups of faces, and its error rate varies with
skin colour, which is a bias this app should not ship.

#### The rules for it

- **FLAG, NEVER DELETE.** A machine silently destroying somebody's photo is
  wrong, and the host has to be able to see what was caught and why.
- **ERR TOWARDS FLAGGING.** The two mistakes are not equal: a false positive
  costs a holiday snap sitting in a review list for a day; a false negative is
  explicit material on a public URL with the quiz's name on it.
- **THE QUEUE ONLY FILLS WHEN SOMETHING IS WRONG**, so it does not break the
  Monday rule — most nights it is empty, and an empty queue costs nothing.
- **A failed check is not a pass.** If the API is down or the key is missing,
  the photo is held rather than published — the gallery is the conservative
  side by design.
- **It protects the gallery and the merchandise, not the room.** Only the kill
  switch does that, and it is already built. Say so plainly rather than letting
  anybody think the projector is now safe.

#### Still open

- **Whether it should also gate the PROJECTOR.** It may be nearly free:
  photos already queue for a break (`PHOTO_PHASES`), so a sub-second check
  could fit inside a wait that happens anyway. Worth measuring — if it fits, a
  nude never reaches the big screen either, which is the thing the mic
  currently has to handle.
- **The provider.** Vision is a different API from the Imagen one already in
  use, so `GOOGLE_API_KEY` may or may not cover it — needs a Cloud project with
  the Vision API enabled. Check before promising it.

### THE GALLERY PUBLISHES WHEN THE NIGHT ENDS — the automatic trigger is what is left

**THE GATE AND THE HANDLE ARE BUILT**: `src/gallery.js` holds
`publishedNights`/`isPublished`/`setPublished`, it fails closed, the list lives
in the private repo, the route is `server.js:3507` and `galleryToggle()` in
`console-gigs.js` calls it. Publishing works — as ONE TAP.

**What does not exist is the automatic part this entry is named after.** No
auto-publish, no `published` flag or end moment on a night, and no "never
before the last game ended" floor. It needs a real booked end time first, which
is the night-object job.

(The old *"there may be no previous nights to show"* blocker was deleted on 16
August 2026: the gallery reads the private REPO rather than the disk, so the
fault it described cannot happen.)

Decided on 15 August 2026, and it is a better answer than the unlisted link I
proposed: *"the gallery link doesn't get published until the quizmaster
publishes it, or on a date basis… you've got a quiz that'll take in all the
photos, and then you might do a music bingo after that. Once the quiz and the
music bingo are done, then the night is done, and then the gallery page gets
published."*

**It beats an unlisted link on three counts at once**, which is why it wins:

- **Nothing is ever public while the room is still in it.** The window a
  half-cut photo could embarrass somebody in is closed by construction rather
  than by a rule.
- **It makes the moderation check FREE.** There is now a gap between the last
  game ending and the page appearing, so SafeSearch runs in it — no latency on
  a gig night, no queue anybody waits on, and nothing unchecked is ever
  reachable. The thing I had proposed to bolt on becomes a consequence.
- **It is a deliberate act**, which is what consent for an outward-facing page
  actually needs. Auto-publish is right for a projector and wrong for a
  website, and this is the line between them.

#### AND IT IS THE SAME "NIGHT" THIS FILE HAS BEEN ASKING FOR

Section 2 above already says the app has no object called a **night** — *"an
advertiser is buying a NIGHT, not a quiz… the app cannot currently say any part
of it."* The host has arrived at the identical conclusion from the other end,
and that is the strongest signal there is that it is the right object:

> **A quiz, then the bingo after it, are ONE night. The night ends when the
> last of them does, and that is when the gallery publishes.**

**What partly exists already:** `nightOf()` and `nightOfGig()` group by date
with a 6am roll-over, and `mergeGigs()` already joins archived games to photo
folders per night. So a night is DERIVED today. What is missing is an explicit
END and a published flag.

**And the end is already a real moment** — the host's own point: *"the end of
the quiz is defined anyway because it gives out who is the winner."* `FINAL`
for a quiz, `FINISHED` for bingo.

#### How "done" should be decided — belt and braces, because forgetting is normal

**Publish at the BOOKED END TIME from the calendar, and let the host publish
early with one tap once every game that night has finished.** Neither alone is
enough:

- **Time alone** publishes at 10pm whether or not the bingo overran, and
  whether or not anybody pressed anything. That is the safety net, and it is
  the one that works when the host has packed up and driven home.
- **The last game finishing alone** is wrong on a night with two games — a
  quiz reaching its winner at half nine would publish before the bingo had
  started.

So: **never before the last game of that night has ended; automatically once
the booked end time has passed; immediately if the host taps Publish.** A night
with no booking falls back to the tap, or to a fixed delay after the last game.

#### The address

**`quizporium.co.uk/gallery`**, broken down by quizmaster and by date.

**Not connected yet** — the app answers on `musicquizapp.onrender.com`. A
custom domain on Render is DNS plus a setting, and it is worth doing before any
QR is printed on a slide, because the URL on that slide is permanent in a way
the app is not.

#### WHAT I WOULD STILL PUSH ON, having lost the unlisted argument fairly

**The publish gate fixes WHEN, not WHETHER, and the consent still does not
cover it.** The phone says a photo *"goes on the big screen"*. A browsable page
at a clean domain, listed by quizmaster and date, is a different thing, and a
pub quiz has families in it. Two cheap mitigations, neither of which costs the
feature anything:

- **Say it at upload**, in one line, per the house style. This is not optional
  and it should ship with the gallery.
- **`noindex` at least to begin with.** Being findable on Google is speculative
  marketing value; a stranger's face and team name turning up in a search is a
  concrete cost, and it lands on the player rather than on the business. One
  header to change later if it turns out to matter.

**And a removal path.** Somebody will want their photo down, and "email the
quizmaster" is not one on a page with no contact on it.

#### Badging the winners in the gallery — half of it joins exactly, half of it does not

Asked for on 15 August 2026: highlight the photos from teams that won or did
well.

**It is the TEAM we know, not the device.** A photo carries `playerId` and
`teamName` (`src/photos.js:147`) — the app's own handle for whoever uploaded
it. There is no device identity anywhere in this app and there must not be:
fingerprinting a stranger's phone in a pub is not something to add for a badge.
The team is the better key anyway, because it is the thing worth printing.

**THE WINNER JOINS EXACTLY. "DID WELL" DOES NOT.**

- `vouchers[]` is in the archived night and carries `winnerId`, so the winning
  photo can be identified by id — no guessing.
- **The archived `leaderboard[]` has `position`, `name`, `score` and no ID**
  (`src/engine.js:2474`). So anything below first place would have to join on
  the TEAM NAME, and that is fuzzy in two ways that both end badly: **nothing
  makes a team name unique** (28 characters and no filter is the whole rule),
  and **a team can rename mid-game**, which leaves the photo holding the old
  name while the leaderboard holds the new one.

Either would badge **the wrong table's photo, in public, on a page they can
order a mug from**. The fix is one field: **put the player id on the archived
leaderboard.** Additive, invisible to every payload — the archive is not a
view — and it makes the join exact instead of hopeful.

#### BADGE, DO NOT RANK — and this follows from a rule already in CLAUDE.md

A small gold mark on the winners is worth having. **Ordering the gallery by
score is not**, and the reason is already written down twice:

- *"Being on the podium is most of what a quiz night gives the people who did
  not win it"* — recognition is the point, and a grid where the winners are
  bigger takes it away from everybody else.
- *"No red for a night that went down. The app does not editorialise about
  somebody's own work."*

A gallery is a scrapbook of the night, not a second leaderboard — and in a
leaderboard most of the room loses. **Same size, same grid, same order; the
winners get a mark and nobody gets demoted.**

**And it is the strongest thing on a mug.** *"We won the quiz at The Crown"*
is a far better product than a photograph, which is a real point in favour of
the print idea rather than a decoration on it.

### TWO NIGHTS, AND THEY ARE NOT THE SAME NIGHT

Settled on 15 August 2026, and it corrects the section above rather than adding
to it. The host runs *"a quiz, music bingo and karaoke combo night on a
Thursday — and the karaoke isn't part of the quiz."*

| | What it is | What it knows |
|---|---|---|
| **The booking** | the PUB's night — The Station Tap, Thursday, 9 till 1, quiz + bingo + karaoke | everything, including what the app never runs |
| **The games** | the APP's night — a quiz, then the bingo | only itself |

**DO NOT INVENT A THIRD CONCEPT. BOTH ALREADY EXIST.** A booking is
`{ date, venue, off, note }` (`public/assets/diary.js:106`) and the games are
the archived records `mergeGigs()` already groups by date. What is missing is
the JOIN between them and the words to tell them apart.

**And the app already gets this wrong in a place anybody can see:**
`src/ics.js:161` writes `SUMMARY: Quiz — <venue>` into the calendar export, so
a combo night appears in the host's own diary as "Quiz". That is the same
mistake in miniature and it is already shipped.

#### THE GALLERY HEADING COMES FROM THE BOOKING, NEVER FROM THE GAMES

*"Quiz, Music Bingo & Karaoke at The Station Tap, 9 till 1"* is the line a
customer reads. **Derived from what the app ran it would say "Quiz & Music
Bingo" and silently drop the karaoke** — wrong, on the one line the page is
judged by, and wrong in a way nobody would notice because it looks complete.

So the heading is written by the host, not computed. **`note` already exists on
a booking** and is the cheapest home for it; whether it deserves a field of its
own is a question for when somebody fills one in.

**The app never learns what karaoke is**, and must not. It records that the
night contained something it did not run, in the host's own words, and stops
there. Anything more is a karaoke module nobody asked for.

#### AND THIS BREAKS THE PUBLISH TRIGGER I PROPOSED — usefully

The section above says publish *"once the last game has ended, or at the booked
end time."* **On a combo night the last GAME ends at eleven and the room is
still there until one.** Publishing then puts the gallery out while the pub is
full of the people in it, which is exactly what the publish gate existed to
prevent.

**So the booked END TIME is the trigger, and "the last game finished" is only a
floor — never a trigger on its own.** Never before the games are done, and not
until the booking says the night is over.

**Which makes the booking's end time load-bearing, and today it is a guess.**
CLAUDE.md records a *stated two-hour default*: a 9pm start becomes 11pm, so a
combo night would publish two hours early, mid-karaoke. **A night whose gallery
publishes on it needs a real end time**, not a default — and that is a small
change to the booking form with a real consequence behind it.

### FLAG A RUDE PHOTO FOR REVIEW — and only then, maybe, cover it

**FLAGGING IS THE FEATURE. CENSORING IS THE GARNISH**, settled on 15 August
2026 when the host asked *"perhaps any potential nudity is flagged to me?"*
right after calling the censored card a nice-to-have and the bin a
need-to-have. He is right, and the reason is worth keeping because it inverts
the difficulty:

**A FALSE POSITIVE COSTS NOTHING IF IT IS ONLY FLAGGED.** He glances, sees an
ordinary face, moves on. That was the ONE real failure mode of the censoring
version — a CENSORED card over somebody's face on the projector, live, in front
of a paying room — and flagging removes it completely. A miss costs nothing new
either: it is exactly today, and nothing reaches the gallery unpublished.

So every hard requirement disappears with it: **no bounding boxes** (the
expensive part), **nothing baked into an image**, and **no latency in the live
path** — score in the background after `fileAway`, the way the photo already
reaches the repository after the phone has had its answer.

#### What to build

- **A score per photo, taken when it is filed.** A likelihood-only check is
  enough — the `GOOGLE_API_KEY` that draws round-2 artwork already exists, but
  **SafeSearch is a separate API that has to be enabled on the project**, which
  is a setup step for the host rather than a code change.
- **Kept in a sidecar beside the photos**, `photos/<room>/<night>/flags.json`,
  exactly like `published.json` — the disk is wiped on deploy, the repo is not,
  and the list of which pictures are questionable belongs with them.
- **FLAGGED PHOTOS SORT TO THE FRONT OF THE NIGHT, marked.** That is the whole
  value: a review of 102 photographs becomes a look at the three worth looking
  at. It composes with what already exists — flag, then the bin, then the
  publish button, which is a flow the host already has.
- **BUILD IT SO IT WORKS WITH NO KEY AT ALL**: unscored is simply unflagged,
  the column stays empty, and nothing about the night changes. Then enabling
  the API switches it on without a deploy.

#### And only after that, the joke

### "NICE TRY" — catching a rude photo and covering it, as a JOKE

Asked for on 15 August 2026, and then reframed by the host in a way that
changes the whole build: *"this isn't really about protecting me as I can just
delete them from the gallery after, it's more of a 'lol you tried to be rude
and got caught' type thing."*

**THAT REFRAME IS THE DESIGN.** As a safeguard this is expensive and can never
be trusted; as a gag it is cheap and does not have to be. Three things fall out
of it and every one of them makes the job smaller:

- **IT FAILS OPEN.** If the check times out, the photo goes up as it does
  today. That cannot be a regression, because today there is no check at all —
  where holding photos back on a bad-wifi night would be a NEW way for the
  photo wall to break, in the lobby, which is the busiest moment there is.
- **IT DOES NOT NEED TO KNOW WHERE.** Bounding boxes are the expensive
  requirement — a specialist service, a separate account, several times the
  price. **Covering the WHOLE photo with a comedy card is funnier anyway** and
  works with a likelihood-only check on the `GOOGLE_API_KEY` that already
  exists for round-2 artwork.
- **ACCURACY BARELY MATTERS IN ONE DIRECTION.** A miss is fine — the host
  deletes it later, and nothing reaches the public gallery without him
  publishing that night. **A FALSE POSITIVE IS THE REAL COST**: covering
  somebody's ordinary face on the projector in front of a room is the failure
  worth tuning against.

#### It must be baked in, not drawn over

A CSS overlay is peeled off with the inspector in four seconds, and both the
projector and the phone would have to draw it. **The card goes into the stored
image on the server**; the original never leaves it. That is also what makes
the joke land everywhere at once.

#### A DRY RUN FIRST, because a threshold cannot be guessed

The host asked to see it working before choosing, and he is right to. **Score
every photo, record the score, censor nothing.** Point it at a real night — the
102 photographs from 13 August are the obvious set — and look at what scored
high and what scored low. Only then pick the line.

**Stock test images prove nothing here.** The question is how a detector
behaves on phone photos taken at arm's length in a dark pub, which is exactly
the input that makes skin-tone heuristics useless.

#### What NOT to do

- **NO SKIN-TONE HEURISTIC IN PLAIN JS**, however tempting the no-dependency
  version is. A night is a hundred close-up faces; that is precisely what such
  a check false-positives on. It would flag half the wall and miss the thing it
  was built for.
- **NO BUNDLED MODEL.** Tens of megabytes of asset, against a codebase whose
  logo, avatars and props are all drawn rather than shipped.
- **DO NOT PUT IT IN THE WAY OF THE PHOTO REACHING THE WALL** any longer than
  the score takes. Auto-publish is a settled decision; this is a filter on the
  way past, not a queue.

