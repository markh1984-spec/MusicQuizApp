# The public gallery page — its address, its index, and what a stranger sees

Split out of [`photos.md`](photos.md) on 2 September 2026, when that file
crossed the 100,000-byte cap `test/docs-index.test.js` holds every `docs/` page
to. Split by SUBJECT, not by size: the photographs and the page they land on
are two stories, and only one of them is read by somebody with no account.

**What is here:** the page a customer opens, how a night is addressed, how the
index decides what to list, what serving it costs, the preview a signed-in
quizmaster gets instead, and the slide at the end of the night that sends
sixty people to it.

**What is NOT here** and stays in [`photos.md`](photos.md): where a photograph
comes from, which ones may ever be shown, the lamp, the pins, and publishing a
night from the console.

Moved **by line number**, so nothing was retyped and nothing could be quietly
reworded on the way through — the same mechanical transform as every split
before it.

---

## ONE PHOTOGRAPH, FILLING THE SCREEN — 31 August 2026

Asked for directly: *"can we make it so the gallery page is clickable to
enlarge a specific photo?"*

`wireBigPicture()` in `public/assets/gallery.js`, `.gal-big` in `style.css`.

### A button, not a figure

Each thumbnail was a `<figure>`. It is a `<button>` now, with `data-at` and an
`aria-label` naming its position — *"Enlarge photo 4 of 14"*. Nothing in this
app that is pressed is left as a bare element with a click handler on it: a
button is what a keyboard reaches and what a screen reader announces, and the
CSS reset that follows means the wall looks exactly as it did.

One delegated listener on the grid rather than fourteen on the pictures, because
the grid is rebuilt whenever the night changes and per-element listeners would
go with it.

### An overlay, never a replacement

The grid underneath is untouched, so closing the picture puts somebody back
exactly where they were rather than at the top of a wall of fourteen. That is
the same fault, and the same fix, as the console's own photo bay.

`position: fixed` rather than `absolute` — here it covers the WINDOW rather
than a panel, which is the opposite of the console's case and for the opposite
reason: the console's bay does not scroll and this page does.

`object-fit: contain`, because this is the moment somebody is actually looking
at it. A crop is right on a wall of thumbnails and wrong here. Opaque, or the
thumbnails show through the letterboxing.

### Three ways out, and no visible control

Click the picture, press Escape, or press the browser's back button. The whole
photograph is the way back, which is what was asked for and what nobody has to
be told — a close button in a corner would be one more thing on top of a
photograph, on a page whose entire job is the photographs.

The Escape listener is one on the document rather than one per picture, for the
same reason as the grid's.

**No arrows and no counter, deliberately.** They were not asked for, and a
gallery of fourteen is closed and reopened without effort. Leave it out and
wait for somebody to miss it.

### The wall behind it does not move — and the first version of that was a lie

`body.gal-zoomed { overflow: hidden }`, so a flick meant for the photograph does
not scroll the wall somebody is about to come back to.

**It was written first and did nothing at all**, because the base rule was
already `body { overflow: hidden }` — the projector's, propagated to every page
in the app. Adding a class that set it again changed nothing, and the check
written for it read `locked: true` before AND after, which is a measurement that
cannot fail. See *A PAGE SCROLLS* in `CLAUDE.md`: fixing the base is what made
this rule real, and it is verified by taking the class away again and watching a
phone's wall slide 315 → 815 under an open picture.

## OTHER NIGHTS AT THE SAME PUB — 31 August 2026

Asked for: *"the galleries should have navigation so you can get to a previous
one or a new one on a per-venue, per-QM basis… each gallery should say which QM
it's for as well as which room, so scrolling through the galleries should be
for the same room."*

- **The quizmaster was already there.** The page header carries the name from
  `/api/brand`; what was missing was the venue, so that is what was added —
  one line under the date, beside the count, silent when a night has no venue.
- **The neighbours are worked out on the server.** The photo repository is
  foldered by DATE alone — the choice `mergeGigs()` records — so which pub a
  night was at lives in the archive, and only the server has it. The browser
  draws what it is handed and computes nothing, which is also why the page and
  the night list cannot disagree.
- **A night with no venue falls back to every night**, rather than to none.
  Nights filed before venues existed have no pub on them, and navigation that
  silently vanishes on those is worse than navigation that is broader than it
  promised.
- **An end of the run is an absent link, not a greyed one.** This is the one
  place *a control is present and inert, never absent* does not apply: that
  rule is about a control whose position has to be learnable on a page somebody
  drives every week, and this is a page a stranger sees once. A greyed arrow
  there is a question; nothing at all is simply the end of the pub's nights.
- **Three grid cells, not a flex row.** "All nights" has to stay in the middle
  whether there are neighbours on both sides, one, or neither — a flex row
  would slide it about as the ends came and went. The empty span holds its
  column open. It stacks to a column below 560px.
- **And the gallery wears the app's gauntlet cursor now** — asked for in the
  same breath. Still never the projector and never a phone, which is the
  decision's own prohibition: the gallery is neither, and on a touch screen it
  costs nothing because there is no cursor to draw.

## THE GALLERY INDEX IS A SHELF OF NIGHTS — 31 August 2026

Asked for: *"would like this to be a sort of gallery box selection — so it has
the date and perhaps a mix of 2-3 of the photos from the gallery itself in the
image for that sub-gallery."* Four questions were put and answered:

| | Chosen |
|---|---|
| The picture | **a stacked/fanned pile** of up to three |
| The words | **date and venue** |
| The order | **grouped by pub, newest first** |
| Which photos | **a random spread, plus pins he can set** |

### The venue became the heading rather than a line on every card

The answer was "date and venue" and both are on screen — but under a pub
heading, printing the pub on twelve cards is the clutter rule exactly, and on a
venue's own address every card would repeat the same eight words. So the pub is
the group heading and the card is the date. **If that reads as too bare, the
venue goes back on the card and the headings come off** — it is one line either
way, and the choice was mine rather than his.

A night with no venue still gets a group of its own: nights filed before venues
existed have none, and dropping them would quietly shorten the archive.

### The fan

Three fixed angles, never random — a random tilt would change on every visit and
make a page of twelve cards restless. The first photograph is on TOP, which is
the pinned one if any are pinned, so the choice actually shows.

The pictures are absolutely positioned inside a fixed-ratio box, so a night with
one photo and a night with three are the same shape on the shelf. The pile is
measured against its own card in `galindex` driving: at a tighter offset the
back two showed about a sixth of themselves and read as edges rather than
photographs, and at a wider one they hung 22px over the card. 56% wide with the
outer two at ±28% is the pair that fits at both card widths.

### `coverPhotos()` — pins first, then one from each slice of the night

- **A SPREAD, NOT THE FIRST THREE.** The first three photographs of a night are
  usually one table within a minute, so "the first three" is three pictures of
  one moment.
- **Two simpler versions were tried and both broke on real data.** Stepping by
  `length / need` from zero never reaches the last photograph, so a four-photo
  night was always its first three. Adding a seeded offset and wrapping modulo
  the length fixed that and destroyed the chronology instead — a forty-photo
  night picked 36, 16 and 35, two of them adjacent, which is the original fault
  again. Cutting the night into as many slices as the card wants and taking one
  from each keeps the picks in order AND apart, and the seed still varies which
  one inside each slice.
- **Stable**, seeded from the night's own date rather than a random number — the
  same rule the pack colours follow. A shelf that reshuffles is worse than one
  with no colour on it.
- **IT ONLY EVER DRAWS FROM WHAT THE NIGHT'S PAGE WOULD SHOW.** The caller hands
  in the already-filtered list, so a photograph held off the gallery cannot
  reach the card that advertises it — **including a pinned one**. A pin is a
  preference about which of the public photos to lead with, never a way round
  the decision about whether it is public.

### The pin

*"A little icon bottom left on each photo where I can pin up to 3, so if I
dislike one of the random photos I can remove the pin from that one and give it
to something else."*

- **BOTTOM LEFT, opposite the bin**, so the control that chooses and the control
  that destroys are never adjacent under a thumb. The lamp keeps top right.
- **It does not borrow the lamp's green and red.** Those mean public and not
  public, which is the lamp's question; saying it twice in the same colours is
  the label collision this app has a rule against. Off is quiet, on is the
  account's own `--hot` — the colour that follows a scheme, which is what a
  preference should wear.
- **Filled on, outlined off**, because at 15px an outline-only difference is not
  a difference.
- **THE CAP IS THE SERVER'S ANSWER, not a count in the browser.** Counting pins
  in the console would be a second copy of a rule `setPhotoPin()` owns, and the
  two would disagree the first time two tabs were open. A fourth press comes
  back 400 with the reason and the pin goes back off, so the refusal is visible.
- **Refused rather than trimmed.** Silently keeping three would look exactly
  like a press that did not register — the same reasoning as refusing an
  over-full `multi` answer.
- **It is never work anybody has to do.** A night with no pins still gets a
  card; the spread picks three. The pin exists for the night where the random
  three happen to be three pictures of the same table.
- **`scripts/community-bay.mjs` presses it**, because nothing in this repo
  presses a control and a dead one draws perfectly — the handler's own catch
  eats a `ReferenceError` and the mark never moves. Pressed against what it WAS
  rather than a state assumed from the fixture, and checked for the
  not-also-opening guard the lamp needs, since it sits on the photograph too.

### Three writers now share one file

`published.json` holds the nights, the rulings and the pins. Every writer has to
carry the halves it is not changing, and the third half is exactly when that
gets forgotten — `test/gallery-pins.test.js` publishes a night with a pin and a
ruling on it and checks all three survive, in both directions.

## "NO PHOTOS ARE UP YET" WAS TRUE FOR A CUSTOMER AND FALSE FOR THE OWNER

Reported the same day the badge came off, with a screenshot of the plain
`/gallery` on a phone: *"I'm seeing this when I should be seeing the main
gallery page."*

**The page was right and the sentence was wrong.** With no key on the link
there is no preview, so a stranger correctly sees only published nights — and
there were none in the room the gallery reads. But it then says *"No photos are
up yet. They go up after the night"*, which to the person who filed a dozen
nights is simply untrue, and reads as the page being broken rather than as the
publishing step not having been taken.

The route itself was checked before concluding that, because it had been edited
that day — an archive read and a cover-photo step were both added to it. Driven
against a stubbed private repo it lists six nights for a stranger when they are
published, zero when they are not, and all six marked `live: false` on the host
key. The venue filter was checked too.

**So one line, in preview only:** *"Not on the public page yet. Put them up in
the console."* — with a link to the tab that does it.

- **It is the badge's information said ONCE for the page rather than eighteen
  times down it.** That is the clutter rule rather than a reversal of the
  removal: what was asked for was the end of a per-night badge that had been
  wrong twice, not the end of knowing.
- **Preview only, by construction.** A customer never receives an unpublished
  night, so there is nothing for them to be told about.
- **It links to where the switch is.** Naming another page and leaving somebody
  to find it is the split-over-two-screens fault this app has a rule against.
- **The key on that link comes from THIS visit's address**, never localStorage —
  a remembered key must not spread itself onto new pages and into history.

## "THESE PHOTOS TAKE A WHILE TO LOAD" — three calls per photograph, two of them the same file

Reported on 31 August 2026. Measured before anything was changed, against a
stubbed repository that counts:

```
the night's LISTING : 5 GitHub calls
30 PHOTOGRAPHS      : 90 GitHub calls (3.0 per photo)
   of which         : 60 x published.json (the same small file), 30 photographs
```

**Serving ONE photograph asks `published.json` twice** — *is this night
published* and *has a human overruled the camera guess on this picture* —
before it fetches the picture itself.

**AND IT IS NOT ACTUALLY A SPEED PROBLEM.** A night of ninety-nine costs about
**297 calls every time the page is opened**, against a limit of **5,000 an
hour**. That is roughly **seventeen visits before the gallery stops working
altogether** — a landlord opening the link a few times on a Friday could do it.

### One read, cached per room

```
the night's LISTING : 2 GitHub calls
30 PHOTOGRAPHS      : 30 GitHub calls (1.0 per photo)
AT NINETY-NINE      : about 99 calls per page open.
```

- **THE INVALIDATION IS EXACT, WHICH IS THE ONLY REASON A CACHE IS DEFENSIBLE
  HERE.** This file decides what is public, so a stale answer means a
  photograph somebody asked to have taken down still being served. That is not
  a trade worth a faster page. Every write already goes through `inOrder()`, so
  there is exactly one place to drop it from — **on the way IN and on the way
  OUT**: in, because the job is about to read a file it must not read a copy of
  from before the write it is queued behind; out, because what it just wrote is
  the truth and the next request has to see it.
- **THE TTL IS A BACKSTOP, NOT THE MECHANISM.** Thirty seconds, for the one
  case `inOrder()` cannot see: a hand-edit in GitHub's own web editor, which
  the validation on the way out already exists because of.
- **IT CACHES THE PROMISE, NOT THE ANSWER**, and that is the difference between
  a cache that helps and one that does nothing on the only burst that matters.
  Caching the resolved value fills only after the first read RETURNS, so
  ninety-nine photographs arriving at once all miss together. **Found by a test
  that expected one fetch for forty readers and got twenty** — the first
  version of this was written the obvious way and was nearly useless.
- **A rejection is never cached.** `readAllNow()` fails closed rather than
  throwing, but a badly settled promise must not become the answer for the next
  thirty seconds.

### And the small ones

- `Cache-Control: … immutable` on a filed photograph — within the window a
  browser does not even revalidate. **The window is NOT lengthened**: a year
  would be right for content that never changes and wrong for this, because
  taking a photograph down is a promise this app makes and a cache is the one
  place it cannot reach.
- `decoding="async"` on the console's grids, which the public gallery already
  had — decoding a phone photo off the main thread while eighteen more arrive.

### "Even at 5,000, 99 photos stops working" — and the arithmetic is worse

He is right, and it is worse than he said: 5,000 ÷ 99 is about **fifty page
opens an hour**, not five hundred. And the traffic a gallery actually gets is
the WORST shape for that — a link sent to a pub full of people who were all
there on the same evening, so it is the SAME night opened by many different
people.

**The browser's own day-long cache never helped that case.** It covers somebody
coming back; it does nothing for the fiftieth different person opening a night
for the first time.

### So the bytes are held on the SERVER, where everybody shares them

`src/photo-cache.js`. Measured:

```
30 PHOTOGRAPHS      : 30 GitHub calls (1.0 per photo), 298ms
20 DIFFERENT PEOPLE : 0 GitHub calls for 600 photo requests
```

**A night is paid for ONCE.** The first person through the door costs 99 calls
and everybody after them costs nothing, so the ceiling is now *different nights
an hour* rather than *visitors an hour* — which is a number nobody will reach,
because a quizmaster files a couple of nights a week.

- **A FILED PHOTOGRAPH IS IMMUTABLE BY NAME.** `add()` issues a fresh id per
  picture and nothing rewrites one, so there is no staleness to reason about.
  **The only event that can make an entry wrong is a DELETION**, and `dropPhoto()`
  is called there — somebody asking for theirs to come down must not be served
  it a moment later out of memory. There is a test, verified by taking the drop
  out again.
- **NOTHING THAT DECIDES WHO MAY SEE IT IS CACHED WITH THE BYTES.** Whether the
  night is published and whether this picture is on the gallery are asked on
  every single request, against `published.json` behind its own short cache with
  exact invalidation. A photograph switched off is refused whether or not its
  bytes are still in hand.
- **THE CAP IS THE POINT, not the caching.** 48MB, `PHOTO_CACHE_MB` to change
  it, least-recently-used out first. This process also runs live quizzes for
  sixty phones on a 512MB instance, and *reliability beats cleverness* decides
  it: a cache that makes a gallery quick and a Wednesday night flaky is a bad
  trade. **A picture bigger than the whole cap is not kept at all** — it would
  evict everything to hold one.
- **LEAST RECENTLY USED, not oldest kept**, so the night everybody is looking at
  survives somebody opening an old one.
- **It empties on a redeploy**, which is correct and costs one page open.

### What is left, and it is BYTES rather than calls

A filed photograph is scaled to 1600px on upload, so a night of ninety-nine is
tens of megabytes for a grid of 150px thumbnails. Every grid already lazy-loads,
so only what is on screen is fetched — but the visible ones are still full-size.

**The fix would be a thumbnail written beside each photograph at UPLOAD time**,
in the browser, since there is no dependency-free resize on the server. It is
not built: it doubles the files in the private repository and helps only nights
filed AFTER it ships, which makes it a decision about somebody's storage rather
than a tidy-up. Raised with the host rather than done quietly.

## THE EFFICIENCY SWEEP — 31 August 2026

Asked for: *"can we run an efficiency sweep on all photos and photo related
stuff to make sure we're not doing a lot more than we have to."* Everything
below was measured against a stubbed repository that counts GitHub calls, not
reasoned about.

### The worst one was the way in

The gallery INDEX listed every night's folder **one after another**, because the
loop `await`ed each listing before starting the next:

```
the INDEX (21 nights): 22 GitHub calls, 3341ms
```

Three and a third seconds, every time anybody opened the page whose whole job is
to be the way in. Running them together and holding the answers:

```
the INDEX (21 nights): 22 GitHub calls, 324ms      (first person)
the INDEX again      : 0 GitHub calls,    4ms      (everybody else)
the night's LISTING  : 0 GitHub calls,    2ms
```

**A NIGHT'S FOLDER CHANGES IN EXACTLY THREE PLACES** — a photograph arriving
from the room, the quizmaster adding one, and one being deleted — and all three
call `dropNight()`. That is the whole safety argument, and it is tested over
real HTTP rather than against the cache's own functions: what matters is that
the ROUTES drop it, not that the module can. Take the two invalidations out and
both cases fail.

### The whole tally

| | Was | Now |
|---|---|---|
| The index, 21 nights | 22 calls, 3341ms | 22 calls 324ms, then **0 calls, 4ms** |
| A night's page | 2 calls | **0**, once warm |
| One photograph | 3 calls | 1, then **0** for everybody after |
| 20 people, one night | ~1,800 calls | **0** |
| Publishing from the rail | 3 full page rebuilds | **none** |

### What HELD — checked and left alone

A sweep says what held as well as what failed, or it teaches you to skim it.

- **The console wall fetches nights serially, and that is correct.** It stops as
  soon as eighteen pictures are in hand, so serial-with-an-early-exit does LESS
  work than parallel-everything. Parallelising it would fetch `WALL_NIGHTS`
  regardless to save latency that the caches have now removed anyway.
- **`ensureAdvertsRestored()` and `ensureOwnPacksRestored()` are serial and
  fine.** They are the PACKS repo rather than photos, they run once per room per
  boot behind a `Set`, and only when the disk is empty after a redeploy. Nobody
  is waiting on them in a hot loop.
- **`/api/past-gigs` is one `listDirs` call** for the whole archive, not one per
  night.
- **Every grid already lazy-loads**, and `decoding="async"` is now on all of
  them rather than only the public gallery.
- **The 24-hour browser cache is right and is NOT lengthened.** Taking a
  photograph down is a promise, and a cache is the one place it cannot reach.

### What is left is BYTES, and it is a decision rather than a bug

A filed photograph is 1600px and a grid shows it at about 150. Lazy loading
means only what is on screen is fetched, but the visible ones are full size.

The fix is a thumbnail written beside each photograph at UPLOAD time, in the
browser, since there is no dependency-free resize on the server. **Not built:**
it doubles the files in the private repository and helps only nights filed after
it ships, which makes it a decision about somebody's storage rather than a
tidy-up.

## The last slide of the night points at the photographs — 1 September 2026

Asked as a question: *"at the end of a quiz is it possible for the quiz itself
to show the link to the gallery for that evening?"* It is, and two things
decided how.

### The address exists before the photographs do

`galleryPath()` in `public/assets/slugs.js`, resolved at LAUNCH into
`state.photoLink` exactly as `comeBack` is, and for the same three reasons: it
needs the venue record and the room the engine cannot see, it must survive a
restart at half eleven, and the state is the record of the night.

**That the address is DERIVED rather than stored is what makes the whole
feature possible.** Publishing is deliberately something the quizmaster does
afterwards, having looked at what is in the pictures — so at the moment the QR
goes on the projector, the gallery is still private. Because the link is built
from the pub and the date, the code sixty people photograph at eleven o'clock
is the same code that opens a real gallery on Tuesday.

**The builder moved into `slugs.js` rather than being written a second time.**
The console already prints this address under a night's photographs; two
implementations of one URL is a link that works in the browser and 404s on the
server, which is the fault that file exists to prevent. It takes what each
caller knows — `pretty` (whether this room is the one the public pages fall
back to, which only the server can answer) and `room`.

### There was no room on the final, and that was already true

The obvious answer was a fifth band under the podium. Measured first, at
1280x720 and again at 1920x1080:

```
podium only          fits
+ 4th                fits
+ comeback           fits
+ draw               fits
+ draw + comeback    CLIPPED 50px top / 50px bottom
```

**So on any night with both a draw and a comeback slide, the final was already
losing "Tonight's winner" off the top and half the comeback QR off the
bottom** — at every resolution, because everything on the projector is sized in
`vh` and `.winner` centres what it holds while `body.screen` hides the
overflow. That is a live defect nobody had reported, found by measuring for
something else, and it is why a band was the wrong answer: it would have made a
bad slide worse and given the code nowhere to be big.

A slide of its own also gives the QR the one thing it needs. **The comeback
band's 14vh code came out 86px across at 720p** — sized to sit beside a line of
text, which is a fine job for the second thing on a slide and hopeless for the
only thing. It is 34vh here, with the words above rather than beside, and
measured back at 225px. The job is harder than the join code's: that one is
read by people sitting at a table, this one by people standing up with their
coats on.

### A flag at the final, like the scoreboard

`showPhotoSlide()` in `src/engine.js`, `state.photoSlide`. Rule 9's shape
exactly — it puts something over the final without moving the quiz, so pressing
again gives the room the winner back and any move takes it down.

- **The FINAL only, refused everywhere else.** That makes it unreachable from a
  live question by construction rather than by a guard that has to stay right.
- **Refused with no address**, the comeback slide's own rule: a QR that goes
  nowhere in front of sixty people is worse than no QR, so silence wins.
- **The phones are never told.** Same as the comeback band — it is a projector
  slide, and the link lives on the night rather than in anybody's pocket.
- **The host sees it from the lobby on**, so the button exists before it is
  pressed and the address can be checked while there is still time.

### `view.photos` was already taken, and it cost the button

The first version put the host's half on `view.photos`. **`server.js` sets that
same field to the room's own photographs, on the host AND the screen, after the
engine has built the view** — so the field existed, held somebody else's data,
and the button it fed was never drawn. Nothing threw and no test failed.

It was found by pressing the button in a real browser, which is the only thing
that could have found it, and it is the same lesson this repo keeps paying for:
a name collision on a payload is silent, and a control that is never drawn
looks exactly like one that has not been built yet. It is `view.photoSlide`
now, with a test asserting it does not squat on `photos`.

### And the label says who it is for

The primary button at the final already says *"Check the photos"* and opens the
console. A second control saying "photos" and meaning the projector is the
label collision this app has a rule against — so it is **"Photos to the
room"**, which is the fix `Scores to the room` one line above already uses.

### What a phone gets if somebody scans early

**"Not up yet — try again in the morning."** The change is the WORDING and
nothing else, which is what makes it safe: the server still answers ONE 404 for
every refusal — not a night, not published, or empty — so this page says
exactly the same thing to somebody guessing a date at random as to somebody
holding a real link. Nothing new can be mapped because nothing new is known.

The alternative was a `pending` state on the server, and it was turned down for
precisely that: it would have leaked which dates exist. Verified live — a night
that never happened and a real unpublished one give the identical page.

It promises the morning rather than a time. The app cannot know when somebody
will get round to publishing, and a deadline it does not control is one it
would break.

## And the final slide fits now — 2 September 2026

The clipping found while measuring for the photos slide was left standing that
day, because fixing it meant deciding what gives. Measured properly it was
worse than first reported, because it grows with the night:

```
                            1280x720   1920x1080   1024x768
  draw + comeback              72px       104px       75px
  draw + league + comeback    142px       212px      151px
```

Cut at **both ends**, because `.winner` is a grid with `place-content: center`
inside a fixed-height card and `body.screen` hides the overflow. What went was
**"Tonight's winner"** off the top and the foot of the comeback band — with its
QR sliced in half — off the bottom. Proportional, so every projector lost the
same share, and a 4:3 one lost slightly more.

### Tightening the margins is not a fix

`.dip` and `.comeback` both carry `margin-top: 4.5vh`, so the obvious first
move is to take some back. Measured: still clipping **120px** on a league
night. It is a plaster the next feature undoes, and this slide has now grown
four things (the podium, fourth place, the draw, the league) since it was
designed for one.

### Two parts, and each does a different job

**The draw and the comeback go side by side** — `.endband`. There is plenty of
width going spare; both bands are centred and narrow, and stacking them was
most of the overflow. It costs nothing: everything stays visible, no behaviour
changes, no press.

**`fitWinner()` shrinks to fit as a backstop.** After the card draws, the
content's real extent is measured against the room and `--fit` is set to the
ratio, never above 1.

Together, measured across every combination a real night produces at three
screen shapes:

- an ordinary 16:9 night with a draw and a comeback now fits at **scale 1.00** —
  the layout change alone does it, and nothing shrinks;
- the worst case (draw + league + comeback on 4:3) scales to **0.65** with
  everything on screen;
- the comeback QR ends up **larger on most nights than it is today**, because
  today it is clipped.

**Why both.** The side-by-side is what keeps the slide full size on an ordinary
night; the backstop is what makes it impossible to regress. Either alone is
half a fix — with only the backstop, a full night quietly shrinks to 0.86 and
takes the QR with it; with only the layout, the next band added clips again.

### `scrollHeight` clamps, and it clamps in the worst direction

The first backstop used `w.scrollHeight`. On a grid with `place-content:
center` that value **clamps to the container**, so it under-reports precisely
when the content is too tall — which is the only moment the function is asked
anything. It computed 0.84 where 0.70 was needed and the slide still clipped.

It measures the children's bounding rects now, and `--fit` is reset to 1 before
measuring, or each pass would measure an already-shrunk box and creep towards
nothing.

### The guard, and the blind spot it started with

`node scripts/final-fits.mjs` builds the winner card from the real stylesheet,
runs the real fit, and measures. Six combinations, three screen shapes.
Verified by removing each half in turn: without the backstop, eight failures;
without the side-by-side, the "needed no shrinking" assertion fails.

**It also checks the QR actually PAINTS.** Every other measurement is about
position — where the box is, how big, whether it is inside the card — and a QR
that is perfectly placed and blank passes all of them. `toSvg()` returns an SVG
with a viewBox and no intrinsic size, so `naturalWidth` reads 0 even when it is
fine; the only honest test is to draw it into a canvas and count the dark
pixels. That is *"it is in the document" versus "somebody can see it"* for the
fourth time in this repo, so it is now checked rather than assumed. The page is
served rather than `setContent`-ed for that one reason: an `about:blank`
document taints the canvas.

## "Photos are definitely published" — and the gallery said none were

Reported with a screenshot of `/gallery` reading **"No photos are up yet"**,
from somebody who had just published a night. Both statements were true, and
the chain between them was working exactly as written.

### What actually happens

A photograph only reaches the public page if `showsOnGallery()` allows it —
camera-taken, or ruled ON by hand with the green lamp. A picture a player chose
from their camera roll carries `-picked` and is held back by default; that is
the rule, and it is the right one.

The index then does this, deliberately:

```js
// A published night with nothing in it is a heading over a blank space.
if (shown.length) { out.push({ … }); }
```

So a night whose whole set is held back **is published, answers 200 on its own
address, and is invisible on the index**. If that is the only published night,
the way in is an empty page saying nothing is up.

Reproduced against the stubbed private repository — two published nights, one
of camera photos and one of `-picked`:

```
published in the file: 2026-09-01 (camera) and 2026-08-25 (uploaded)
the index shows      : ["2026-09-01 (2)"]
```

### Nothing was broken; nothing said anything

That is the whole finding, and it is worth keeping as a shape. The publish
worked. The filter worked. Dropping the empty night from the index is a
deliberate decision with a comment on it. Each lamp knew its own answer.

**What was missing was any line that added the lamps up.** The console counted
`data.photos.length` — every photograph filed against the night — which answers
*"how many are there"* when the question on that screen is *"how many will
anybody see"*.

**A number that is right about the wrong question is how a working app looks
broken.** It is the same family as the arcade board nobody drew and the publish
route nobody called: every part correct, no part joined up, and no error
anywhere to notice.

### The line tells the truth now

- all showing → **"12 photos"**, unchanged, which is the ordinary night;
- some held back → **"12 photos · 4 on the gallery"**;
- none showing → **"12 photos · none on the gallery — the green dots decide"**.

It follows the lamp rather than the page load: flicking one green writes the
local truth back onto `p.onGallery` and repaints the line, or it would sit
saying "none on the gallery" over a grid of green dots — the same untruth in
the other direction.

**It is silent when they all show.** This is the count line, not a warning that
has taken up residence in it.

`community-bay.mjs` asserts both halves — that the line names how many will
show, and that pressing a lamp moves the number. Verified by flattening the
line back to a plain count and watching both fail.

## "On my phone it's showing nothing, on my laptop it's showing two" — 2 September 2026

Reported the day after the count line above, and it is the same family again:
both devices were correct, they were answering different questions, and
nothing anywhere said so loudly enough to notice.

### The phone was right and the laptop was a preview

`galleryPreview()` in `server.js` shows **unpublished** nights to whoever is
signed in. A laptop that has the console open carries the session cookie, so
`whoIs()` resolves it to an account and the page adds the drafts. A phone
opening the same link cold carries nothing, resolves to nobody, and gets the
published list — which was empty.

Reproduced exactly, against the stubbed private repository:

```
published.json says: NOTHING is published
PHONE  (no cookie) : [] | preview: false
LAPTOP (signed in) : ["2026-09-01","2026-08-25"] | preview: true
  of those, live   : ["2026-09-01: false","2026-08-25: false"]
```

**So the two nights were drafts.** Almost certainly because the `GitHub 409`
screenshotted a few hours earlier *was* the publish write failing — that retry
is deployed now, so pressing the lamp again sticks.

### The preview is right and must stay

It is what makes checking a night before strangers see it possible at all, and
the whole reason `?key=` was wired onto the images. **Do not "fix" this by
making the page identical for everybody** — that would take away the preview
to solve a labelling problem.

### What was actually wrong was how quietly it said so

The page did say it. In `--fs-note` at `--ink-dim`, one centred line, above a
wall of large photographs — **this app's two weakest tools, at the one moment
they are least affordable.** The person reading that line is the person
checking whether publishing worked, and they are the one person who cannot
tell by looking, because the drafts are on their screen.

The cost of getting it wrong is telling a pub their photographs are up when
nobody outside the building can open them.

So the banner is a panel now: full-strength ink, a surface of its own, and it
says three things a note could not — how many, why this device differs from
everybody else's, and where the switch is. **A warning is the stated exception
to the short-label rule.** It is **not red**: nothing has gone wrong, and red
would say a mistake had been made.

### And the cards say WHICH — the server had been sending it all along

`live` has been on every entry in the index payload since the day this page was
written, and **no card ever drew it**. Two drafts sat among three live nights
looking identical, so the count in the banner could not be matched to anything
on screen.

A `.gal-draft-tag` reading **"Only you"** in the corner, and the fan behind it
dimmed. Same fault as the arcade board, the publish route, the hidden pack
slots and the QR checked for position rather than paint: **the field was in the
payload and nobody drew it.** That is now five sightings, and the lesson has
not changed — *a test that the payload is right proves nothing about whether
anybody drew it.*

Verified in a real browser at both sizes:

```
laptop-signed-in {cards: 2, drafts: 1, tags: ["Only you"], banner: "1 of these
  is only visible to you. You are signed in, so this page is showing you drafts
  — on anyone else's phone it is missing. Put it up in the console"}
phone-stranger   {cards: 1, drafts: 0, tags: [], banner: ""}
```

**The grammar is written out rather than templated** — `is`/`are`, `it`/`them`,
`it is missing`/`they are missing`, and a different sentence entirely when
every night on the page is a draft. A page whose whole job is to be believed
cannot open with *"1 of these are only visible to you."*

## Seeing it as a visitor — 2 September 2026

*"So this is the public gallery and needs to display these photos without
signing in otherwise there's no point in it being published at all."*

**It already did, for a published night.** What it did not do was let the one
person who needs to know check it.

### The person who cannot check is the person who has to

`/gallery` shows drafts to whoever is signed in, and the browser a quizmaster
checks in is the browser signed into the console. **So the one device they will
reach for is the one device guaranteed to show them the wrong page** — every
draft on it, looking exactly like the real thing. The answers available before
today were "sign out" and "open a private window", and neither is a thing
anybody does at eleven at night with a pub emptying around them.

That is why the previous fix — a loud banner and an "Only you" tag — was
necessary and not sufficient. **It told him. It did not show him.**

### `?as=visitor`, and it can only ever take access away

One line, first in `galleryPreview()`, before anything can hand the preview
back:

```js
if (url.searchParams.get('as') === 'visitor') return false;
```

- **ON THE SERVER, which is the whole point.** Filtering the drafts out in the
  browser would prove the page can hide them, not that the server refuses them
  — and refusing them is the thing being checked. The test asserts on the JSON
  and on the 404s, not on what the page drew.
- **IT SUBTRACTS, NEVER ADDS.** There is no parameter anywhere in this app that
  grants a permission — `/api/host/*` and the gallery's own publish route both
  resolve the room from who you are, with no id in the request. This one is the
  same rule pointing the other way, and being subtractive is what makes it safe
  to have no gate on it at all: a stranger typing it gets what they already had.
- **IT RIDES ON EVERY REQUEST AND EVERY LINK**, like `key` and `?q=` — or the
  second page in is quietly the preview again, which is the failure the whole
  thing exists to prevent. It reaches the night's own page and each photograph,
  both of which re-check for themselves.

### The control is present and inert, and the way back is drawn on the dead end

**Drawn for the signed-in person whether or not anything is a draft**, because
*"is it really up?"* is asked most often when everything looks fine. A control
that appears only when there is a problem is one nobody can find when they want
to prove there is not.

**Two strengths, one control.** Offering the check is a quiet aside on a page
that is working; BEING in visitor mode gets the account's colour on its edge
and full ink, because a deliberately reduced page must not be mistaken for the
real one. Not red either way — standing the preview down is the app telling the
truth on request, not a fault.

**AND IT IS DRAWN BEFORE THE EARLY RETURN ON "Not up yet".** The honest visitor
view of an unpublished night is a dead end, and that is precisely the page the
check lands on. Without the way back it strands somebody on the one screen
where they most need to be told they are still signed in.

**`body.replaceChildren(grid)` became `appendChild`** — the switch is put in
before the photographs are built, and replacing dropped it. Same shape as the
`node()` fault that cost this page its "All nights" link.

### Verified by pressing it, and by putting the fault back

A real browser against a real server on the stubbed repository, one night
published and one not:

```
SIGNED IN (preview)     cards 2, tags ["Only you"], "See it as a visitor"
AFTER PRESSING SWITCH   cards 1, tags [],           "This is exactly what a visitor sees"
A NIGHT, AS A VISITOR   /gallery?n=2026-08-20&as=visitor — 4 photos, 200s
BACK TO PREVIEW         cards 2
page errors: none
```

Pressed as a link rather than typed as a URL, because a control nobody can
click is not a control — this repo's own repeated lesson. Deleting the one line
in `galleryPreview()` fails the new test, which is the only reason to believe
it.

**The images read `naturalWidth === 0` and that is the FIXTURE, not the
switch** — the stub writes 64 bytes of `1`, which is not a decodable JPEG.
Established by measuring the same night in preview, where they are equally
"broken". A number that looks like a regression has to be compared against a
control before it is reported as one.

## One pub, two addresses, half a pub each — 2 September 2026

Reported as *"quizporium.co.uk/station-tap/gallery is still showing no photos,
only when I tap the quiz podium logo do the photos load."*

**The logo goes to the plain `/gallery`, which filters by nothing.** So the
symptom was precise and the diagnosis was in it: everything worked except the
venue filter.

### The third sighting of one split

A night filed as "The Station Tap, Wokingham" slugs to `station-tap-wokingham`.
The same pub typed freehand as "The Station Tap" slugs to `station-tap`. The
index compared them with `===`:

```js
.filter(([, v]) => venueSlug(v) === wantVenue)
```

so each address showed only its own half of the pub, and if every night carried
the town, `/station-tap/gallery` showed **nothing**. Reproduced on a real
server before a line was changed:

```
/gallery                        both nights
/station-tap/gallery            only "The Station Tap"
/station-tap-wokingham/gallery  only "The Station Tap, Wokingham"
```

**`venueHeadcounts()` and `leaguesByVenue()` were both already fixed for this
exact split** — an `id:` key against a lowercased name, reconciled by the
reader. This is the same defect arriving a third time wearing a URL, and a
public address has no id, so the reconciling has to happen on the slugs.

### `sameVenueSlug()`, and the two things that make it a fix

- **IT FOLDS SYMMETRICALLY.** Matching only "the shorter is a prefix of the
  longer" would make `/station-tap` show everything while
  `/station-tap-wokingham` still showed half — two addresses for one pub that
  disagree, which is the original fault restated. Either being a prefix of the
  other counts.
- **IT BREAKS ON A HYPHEN, NEVER MID-WORD.** `crown` must not match `crownley`.
  A slug is hyphen-separated, so the boundary is free.
- **An empty slug matches nothing, including another empty one**, or a night
  with no venue on it is swept onto every pub's page.

**The cost is the one already accepted knowingly** under *one pub is one
league*: two genuinely different pubs whose names nest — "The Bell" and "The
Bell Inn" — merge. That was already true of the name-only path and is why venue
names carry a town. The alternative on offer was a quizmaster's own link
showing a stranger nothing.

### THREE call sites, and the third was found by grepping the PATTERN

The gallery index and the public league page were the two anybody would look
for. The third is the night page's own **prev/next arrows**, which compared the
venue STRINGS — so a run of nights at one pub split into two runs the moment
its name was typed differently, and the arrows skipped a night plainly at the
same pub or stopped early. Nothing reported it, because a missing arrow reads
as the end of the run.

`test/slugs.test.js` now asserts there is **no bare `venueSlug(x) === y` left
in `server.js` at all** — the pattern rather than the symptom, which is what
would have caught the arrows on the first pass. Verified by putting each fault
back in turn: the one-directional fold fails two tests, dropping the hyphen
boundary fails one, and restoring `===` at any call site fails the source
check.
