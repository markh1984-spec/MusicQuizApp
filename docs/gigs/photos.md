# The photographs — the room's, yours, and what reaches the public gallery

Split out of `docs/gigs.md` on 29 August 2026, when that file crossed the
100,000-byte cap `test/docs-index.test.js` holds every `docs/` page to. Split by
SUBJECT rather than by size: the photographs are one story, from the phone that
takes them to the page a venue is shown, and they had grown to a third of a file
about venues, invoices and the diary.

Moved **by line number**, so nothing was retyped and nothing could be quietly
reworded on the way through — the same mechanical transform as every split
before it.

---

## PUTTING A NIGHT ON THE PUBLIC GALLERY

`galleryToggle()` in `console.js`, `/api/past-gigs/publish`, `src/gallery.js`.

**THE ROUTE EXISTED FROM THE DAY THE GALLERY WAS BUILT AND NOTHING EVER CALLED
IT.** A night could be published only by hand, which in practice means not at
all — on the feature whose entire purpose is putting a night up. The gate was
perfect and the gate had no handle.

That is the same class of miss as the projector's arcade board and the launch
route: the server was ready, the page was ready, the tests passed, and no
control joined them together. **A test that the route works proves nothing
about whether anybody can reach it**, so `test/gallery.test.js` now also
asserts that something under `public/` calls it. A text search is a weak check
and is the right weight, because the fault was not a broken caller — it was the
total absence of one.

**AND WHEN A CALLER WAS FINALLY WIRED UP, THE ROUTE 404ED.** It was defined
inside `handleGet`, which is only ever called for GET and HEAD — every POST
goes to `handleWrite` — so a POST to it fell through to the generic 404 and had
done since the day it was written. **Dead code that read as a working
feature**: the gate was tested, the page was built, this file described it, and
the one call that puts a night up could never have been answered.

Found by a browser agent posting to it and getting *"Not found"* where the
honest answer is *"there is nowhere to record this"*. The test now POSTs over
real HTTP and **asserts against the 404 rather than for the 400** — that
difference IS the bug, and it is invisible to anything that does not make the
request. Verified by putting the handler back in `handleGet` and watching it
fail.

**IT SITS UNDER THE PHOTOGRAPHS, AND THAT PLACEMENT IS THE SAFEGUARD.** It is
inside a night that has to be opened, below the pictures it would publish — so
nobody can put a night in front of the world without having just looked at
what is in it. A button on the collapsed row would be one tap from a stranger's
face going public, taken on a phone whose only promise was that it *"goes on
the big screen"*.

**IT SAYS WHAT PUBLISHING MEANS, in one line** — *"Anyone with the link can see
these."* The house style says a control gets a title and one short line, and
that warnings are the exception because they are read once at a moment that
matters. This is one, and it costs somebody something real if it is not said.
Not styled as a warning and not red: it is a plain statement read BEFORE
pressing, and red would say a mistake had already been made.

**TAKING IT DOWN IS AS PROMINENT AS PUTTING IT UP.** Somebody will ask for
their photograph to be removed, and the only honest answer on a page with no
contact details is a quizmaster who can do it in one tap while they are stood
there. Destructive-styled — outlined red, never filled.

**The published state rides on the call that is already made.** `/api/past-gigs/
<night>` carries `published`, rather than a second request: a button that has
to fetch before it knows its own label is a button that flickers.

## CHECKING THE PHOTOS IS THE NEXT PRESS, NOT A PAGE YOU GO AND FIND

Asked for on 17 August 2026, and the wording is the design: *"at the end of the
quiz it's showing the winner on the scoreboard, you do your well dones etc, and
then the next click takes you to a huge CHECK PHOTOS link that you can't dodge
— it's part of the flow."*

**It replaced two weaker answers, and both are worth knowing about because the
instinct to go back to them will return.**

The first was to publish the night automatically when the scoreboard went up.
That fails on a fact in the code rather than on taste: `PHOTO_PHASES` in
`screen.js` includes `final`, `won` and `finished`, and photo uploads are not
phase-gated at all — so the room is still sending pictures at the moment the
scoreboard appears. Auto-publishing there publishes a night that is not
finished arriving.

The second was a prompt on the console: finish the night, and the console
suggests checking the photos. **That is a page you go and find.** At half past
eleven, with the room emptying and kit to pack, a suggestion on another screen
is a suggestion that loses. What makes this happen at all is that it is the
next press in a sequence the host has been making all evening, in the same
position, at full size.

**AND IT IS THE LAST MOMENT THE ROOM IS STILL THERE.** Somebody who wants their
photograph out is stood in front of you now; on a Monday they are a message you
cannot answer with a bin. That is the argument for tonight rather than for a
tidier time.

### What the button actually did before

`buildActions()` set the primary at `final` to *Finished*, `disabled`. **A dead
control, in the one place the thumb has been all night, at the exact moment
there is still work to do.** This repo already has a rule about controls that
appear and disappear — *build the next one present and inert* — and this is its
other half: a control that is present and inert when there IS a next thing is
the same waste wearing the opposite hat.

### It opens the night. It does not publish it.

The press lands on Post gig → Past gigs with the night on the bench and **its
row already open**. The publish control is where it always was, underneath the
photographs, and it is still a deliberate press — the safeguard is that nobody
puts a night in front of the world without having just looked at what is in it,
and a button that arrives having skipped the looking would remove exactly that.

**Opening the row was the second half of the job and it is not cosmetic.**
Landing on the bench alone left an *Open its photos* button between the host
and the pictures, which is the tap that does not get made. It goes through the
row's own head — the same call the bench's own button makes — so there is one
implementation of "show me this night". A second one would drift, and the way
it would drift is into a gallery with no bin on the pictures.

### The two joins, and why each is where it is

**The night rides in the URL** (`?night=YYYY-MM-DD`) rather than `host.js`
writing the console's `localStorage` directly. Two pages writing one key is how
a contract drifts silently — the console is free to change how it remembers a
bench, and would take the control view down with it. A link can also be
followed twice, shared or bookmarked, which a storage write cannot.

**The key is the 6am roll-over**, identical to `nightOfGig()` and
`photos.nightOf()`. A quiz that ends at half past midnight would otherwise open
tomorrow, with nothing under it, on the one night the host most wants the thing
to just work.

**And the console sets the bench WITHOUT rendering.** `putNightOnBench()`
renders, and at boot that runs before `load()` has fetched anything — `library`
is still null and the first paint throws on `library.brand`. That is the third
boot-order fault of this work, after the moved `load()` call and `offerRoomId`:
**a thing that is entirely right once the page is up, run one step too early.**
The pattern is worth naming, because `node --check` cannot see any of them.

### THE BENCH'S PUBLISH BUTTON OPENS THE PHOTOGRAPHS, IT DOES NOT PUBLISH

Decided 19 August 2026, as one of a batch of decisions taken up front rather
than asked mid-build — the host answered by picking an option in a menu, and
the reasoning is worth keeping so the choice is not re-litigated.

**The bench's own "Put it on the gallery" button was a second door onto the
same route, and it skipped the safeguard the first door was built for.** The
control under the photographs works because it is inside a night you have
opened, below the pictures it would publish — nobody puts a stranger's face
in front of the world without having just looked at what is in it. The bench
does not have to be opened to reach its own copy of that button, so pressing
it published directly, with nothing looked at.

Three ways out were on the table: take the bench button off, make it open the
photographs first, or leave it on the theory that the bench only ever holds a
night you deliberately put there. **The middle one was chosen, because it
keeps the shortcut and cannot skip the looking.** The button now does exactly
what *Open its photos* next to it does — clicks the row's own head, through
the one implementation of "show me this night" that already exists rather
than a second one that could drift from it.

**Taking a night OFF the gallery stays direct, deliberately.** The safeguard
exists for publishing, not for withdrawing — removing a photograph from public
view is never the risky direction, and somebody asking for their photo down
while stood at the bar deserves the fast path, not an extra screen.

---

## AND THE PREVIEW DID NOT WORK ON THE HOST KEY

The owner sees unpublished nights on `/gallery`, marked — asked for directly,
so the whole path can be proved before a single photograph becomes public. It
hangs on the server knowing who is asking, and **the page never sent the host
key with its own requests**. A signed-in account sends a cookie and needs
nothing; somebody arriving on a `?key=` link sent nothing at all, so the
preview silently did not work and the page looked empty — on the identity most
likely to be checking it.

The key is read **from the URL, never from localStorage**, which is the rule
this app already follows for links: a remembered key must not spread itself
onto new pages and into browser history. This one is already in the address bar
of the visit that is happening, so nothing new is exposed. A customer's link
carries no key and it is a no-op for them.

**It goes on the IMAGES as well as the listing**, because the photo route
re-checks for itself rather than trusting that the listing let you through —
without it a preview would be a page of broken pictures.

---

## AUTO-PUBLISHING THE GALLERY WAS REPLACED BY A STEP — and that is better

Settled with the host on 17 August 2026, after three answers were tried and two
were wrong.

**The question was when a night counts as "over" so the gallery could publish
itself.** The calendar cannot say: a booking has a date and an optional start
and **no duration at all**, so "when the calendar thinks it is over" means
"start plus a made-up two hours". The host's own answer was better and matched
what the app already believes — *"the night is probably over once the
scoreboard goes up"* — and it is right: `isOver(state)` at the final phase is
exactly when a night is archived and `finishedAt` stamped.

**But publishing at that moment would have gone out too early**, for a reason
that only shows up in the code: **photo uploads are not phase-gated.**
`/api/photo` checks whether photos are switched on, not what phase the game is
in, and `PHOTO_PHASES` deliberately keeps photos on the projector at `final`,
`won` and `finished` — **the winner announcement is peak photo time.** So an
auto-publish at the scoreboard would publish a night before its last
photographs arrived, and those would land on an already-public page with
nobody having looked at them. That is the safeguard this file already records
— the publish control sits UNDER the photographs so nobody publishes a night
without having just seen what is in it — failing silently.

**So the host replaced the whole idea:** *"perhaps there should be an extra
step — you finish the night on the console, do your well dones and thank yous,
and the console prompts you to check the photos as the very next step?"*

That is the shape CLAUDE.md argues for everywhere: **the app prepares, the
human presses.** It keeps the looking and makes the app ASK for it, at the one
moment the room is still there to be asked about a picture. `runningPanel()`
shows it once `running.finished`, and it puts the night on the Post gig bench —
keyed by the same 6am roll-over as the photos, so a quiz that ended at half
past midnight lands on its own night rather than on tomorrow with nothing
under it.

**Do not re-propose auto-publishing** without answering the upload window
first.

---

## THE GALLERY ONLY HOLDS WHAT LOOKED LIKE A CAMERA TOOK IT

Asked for directly on 23 August 2026: *"if people upload photos for a bit of
a laugh on the night, I don't necessarily want those going into the gallery
for the night, but them appearing on the screen can be fun."* **Two things
were being asked for, not one, and the whole feature is keeping them
separate rather than tightening the upload itself.** The projector stays
exactly as loose as it always was — any image, camera or gallery, still goes
up between questions the moment somebody sends it. Only the PUBLIC page,
built afterward from the private repo, gets pickier.

**The obvious tool — EXIF's `Make`/`Model` tags — turned out to be
unreachable from where it looks reachable.** A camera photo carries that
metadata; a screenshot (near-universally PNG) or a downloaded meme almost
never does. But the upload in `play.js` redraws the chosen file onto a
canvas before it ever leaves the phone — filters, stickers, the square 1080
crop — and `canvas.toBlob`/`toDataURL` strips every byte of EXIF on the way
through. By the time bytes reach `/api/photo` there is nothing left to
read, camera or not. **The one moment the original file still has it is
between the file input's `change` event and the first `createImageBitmap`
call** — so `looksCameraTaken()` in `filters.js` runs there, on the raw
`File`, and the result travels to the server as `&camera=1` on the upload
URL rather than being re-derived from bytes that no longer carry the
answer.

**A DEPENDENCY-FREE JPEG/EXIF READER, in the spirit of `qrcode.js`.** It
walks the marker sequence from the SOI, stops at APP1 (`0xFFE1`), checks for
the `"Exif\0\0"` signature, parses the TIFF header (byte order, the 0x002A
sanity word, the IFD0 offset) and looks for tag `0x010F` (`Make`) in IFD0.
Nothing more elaborate: `Make` alone is what a phone's own camera app
writes essentially every time, and reading the whole EXIF tree for one tag
would be effort spent on precision this signal cannot actually offer — see
the false-negative paragraph below. Verified against real files, not only
hand-built byte arrays: a genuine PIL-generated JPEG with `Make: Apple` in
its EXIF reads `true`; the same image saved with no EXIF, and a plain PNG,
both read `false` — and the marker walk correctly steps past a real JFIF
APP0 segment to reach APP1, which a synthetic buffer alone would not have
proven.

**BEST-EFFORT, NEVER A GATE, and the asymmetry is deliberate.** A photo
forwarded through WhatsApp, Instagram or Messages very often has its EXIF
stripped by that app before it ever reaches a phone's camera roll — so this
can UNDER-count (a real photograph, once shared, reading as "not a
camera"), but it cannot OVER-count: nothing manufactures a `Make` tag that
was never there. The projector never asks the question at all — every
photo still goes up regardless of the answer — and a corrupt or
unrecognised file falls through to `false` rather than blocking an upload
the guess was never meant to hold up.

**THE FLAG RIDES IN THE FILENAME, not a second file beside it.** The
private photo repository has no structured per-photo metadata today — a
photo is a name and the git commit message that filed it — and the gallery
route only ever reads a night's own directory listing. A separate manifest
(one JSON file per night, read-modify-written on every upload) would race
against itself the moment two people upload within the same second, which a
pub quiz does constantly, the same shape of problem `published.json`
avoids by being written once per publish tap rather than once per photo.
The filename cannot race: `photos.js`'s `add()` decides it once, at the
moment the id is minted, and appends `NOT_CAMERA_SUFFIX` (`-picked`) before
the extension when the photo was not camera-taken. Every later reader —
`isCameraFile()`, the gallery filter, the console's own badge — just looks
at the name it already has. `past-gigs.js`'s `safePhotoName()` was widened
by exactly one optional group, `(-picked)?`, to keep matching only names
this app itself could have issued — not an open door for arbitrary
hyphens, checked by a test that an unrelated hyphenated name still refuses.

**CHECKED TWICE ON THE WAY OUT, same reason `isPublished` is.**
`/api/gallery/<night>` filters the listing so a non-camera photo is never
offered a link; `/gallery-photo/<night>/<name>` refuses one directly too,
because its name was on the projector all night and a URL can be typed
without ever having seen the listing. The NIGHT-LEVEL photo count
(`/api/gallery`) filters the same way, or a night would say "6 photos" and
open on 4 — the exact "count says one thing, the page says another" fault
this file's own gallery-preview section already exists to avoid.

**THE HOST STILL SEES EVERYTHING, WITH A BADGE, before publishing.**
`/api/past-gigs/<night>` — the host's OWN review, gated by the host key,
completely separate from the public route — is deliberately NOT filtered:
every photo the night held is shown, and one that will not reach the public
gallery carries a quiet "Screen only" tag in the same corner `not filed`
already uses. Never hidden, because the whole point of reviewing photos
before publishing is not being surprised later by one that quietly is not
on the page. **No override was built** — there is no per-photo "include
anyway" toggle. The false-negative case (a genuine photo, re-shared and
therefore stripped of its EXIF before it reached this app) has no recovery
path beyond re-uploading through a fresh camera capture; if that turns out
to matter in practice, add the toggle then rather than guessing at it now.

---

## THE QUIZMASTER'S OWN ROOM PHOTOGRAPHS — 29 August 2026

> *"Would be good to be able to add room photos to the gallery that everyone
> sees, that I take from my own phone?"*

`POST /api/past-photo/<night>` in `server.js`, `myPhotos()` in
`console-community.js`, under the night showing in the Community bay.

### The room's camera is sixty phones pointed at each other

Every photograph the gallery has ever held arrived through a PLAYER's phone,
and a player's phone is pointed at their own table. What a venue actually wants
to be shown is the place full — the bar three deep, forty heads turned towards
a projector — and that picture can only be taken by the person standing at the
front.

So the one shot that genuinely sells the night was the one shot with no way in.
That is the gap, and it is a *Build what helps a quizmaster SELL* feature
rather than a convenience: the gallery is the evidence, and it was missing its
best exhibit.

### It is filed against the night in the URL, never against today

This is the load-bearing detail. `photos.add()` dates a picture by the clock at
the moment it lands — right for a phone in the room, and wrong for everything
else. A photograph sent on the Friday would file itself under the Friday: a
Thursday quiz, and a picture of it in a folder for a night that did not happen,
which the gallery would then show under the wrong date to a venue.

Naming the night in the URL is what makes the feature usable at all — in the
car park, on the drive home, or on the Monday with the rest of the admin.

It also means the write goes **straight into the private repository**, past the
room's live photo store. There is nothing to keep in step, because there is no
second copy.

### Camera-eligible by definition

The `-picked` marker exists to keep a meme somebody pulled off their camera
roll off a venue's public page. These are the opposite: the promotional
photographs, taken by the person whose name is at the top of that page.

So they carry no marker and `isCameraFile()` lets them straight through. The
one thing they must never do is arrive marked and then silently not appear —
which is exactly what would have happened if this had reused the player upload
path, since `camera` defaults to FALSE there and a phone's own share sheet
often strips the EXIF that would say otherwise.

The filename starts `mine`, so a photograph the quizmaster added is tellable
from one the room sent — for a bin, for a count, and for whatever wants to know
later.

### Scaled down in the browser, and not cropped square

A modern phone photograph is five to eight megabytes; the route caps at three,
and this is a quizmaster on pub wifi, which is the connection this app protects
above every other. So `drawFiltered()` redraws it to 1600px before it is sent —
1600 rather than a player's 1280, because this one is meant to be looked at on
a laptop.

**`square: false`, unlike a player's photo.** A picture of a room IS the room,
and cropping it to a square for a wall of thumbnails would throw away the half
that shows how full it was.

They are sent **one at a time, in order**, with the count going up as they
land: six at once is six writes racing on one folder, and a progress line that
only moves at the end reads as a page that has hung.

### The test asserts against the 404, not the 400

A new POST written beside its GET neighbours is the exact shape of a fault this
repo has already shipped: the gallery publish route lived inside `handleGet`,
which only ever runs for GET and HEAD, so every POST fell through to the
generic 404. It read as a working feature for months — the gate perfect, and no
handle on it.

So `test/own-photos-route.test.js` posts over real HTTP and asserts the answer
is **not 404**. A test written for the 400 would pass against a route that does
not exist. It was verified by renaming the route and watching it fail.

What it cannot reach is the write itself, which needs a repository token this
suite does not have and must not need — so the deepest assertion is that an
unconfigured repo is refused with a message that NAMES the missing thing. That
is the branch a fresh deployment actually hits, and a generic "could not save
that" would send somebody hunting through the app for a fault in an env var.

### A pill per photo, and it is a switch

> *"Can each photo have a little pill in the corner just so I can visually see
> which ones are showing in the gallery for this collection of photos? There
> may be some that were uploaded but are appropriate for a public gallery that
> I can switch on… maybe a little green pill to show it's on the public gallery
> for this night and a red one to show it isn't, and I can click one for each
> purpose."*

**This is the team-name override wearing different clothes**, and the reasoning
transfers exactly: a machine guess decides by default, and a human who was in
the room can overrule it — **in both directions, because the guess is wrong
both ways**. `looksCameraTaken()` misses a real photograph whose EXIF a share
sheet stripped, and it passes a screenshot somebody took with their own camera
app. One override with two values answers both; a one-way "allow" control would
have left the second with no answer at all.

**It replaced the grey "Screen only" badge rather than joining it.** That badge
said what the camera guess *thought*; the pill says what will actually
*happen*, which is the same fact once a human can overrule it. Two badges on
one photograph saying overlapping things is the label collision this app has a
standing rule against — so the reason lives in the pill's own title, where the
difference between "we thought you uploaded this" and "you turned it off" is
worth having and is not worth a second badge.

**Green and red, which is one of the few places they are allowed to mean this.**
The app's fixed colours are good/paying and wrong/destructive, and "on a public
page" versus "not" is exactly that pair — read at a glance across eighteen
thumbnails, which is the whole point of a lamp over a list.

**And no words on it at all**, which was the correction after the first
version shipped with "On the gallery" / "Not on it" written on each one:

> *"I need the 'on the gallery' to just be an on off button with green for on
> and red for off, no text needed but it must be clickable."*

Right, and eighteen of them is the argument. A label repeated across a grid
stops being read and becomes furniture — the clutter rule exactly — while the
colour was already doing the whole job on its own. It is **filled** rather than
outlined, which is not a break of *destructive is outlined, never filled*: this
is a lamp, not a button that destroys something, and with no text the fill IS
the message. A dark ring keeps it legible over a sunlit wall or a red curtain.

Three things follow, and each is checked:

- **The `title` and the `aria-label` become load-bearing rather than a nicety.**
  A wordless control has to say what it is somewhere, a screen reader gets
  nothing from a colour, and the reason a photo is off — the camera guess, or a
  ruling — is worth having on hover. This is the one place a native tooltip
  earns itself: it sits on a picture rather than over a list, which is where
  the last one was a nuisance.
- **The dot is 18px and the target is 44px**, from a `::after` that pushes the
  hit area out without the lamp growing. Small enough to read across a grid,
  big enough for a thumb.
- **The figure's own click has to ignore a press on it.** The picture opens on
  click and the lamp sits on top of it with a target bigger than it looks —
  without the guard, switching a photo off the gallery also blew it up to fill
  the bay.

**`showsOnGallery()` is the one decision, and all three readers ask it.** The
gallery listing, the single-photo route (which re-checks, because a URL can be
typed and that photo's name was on the projector all night) and the console's
own pill. The day one of them answers differently is the day a photograph is on
a page the console swears is private, or missing from one it says is public —
so the test asserts all three call it by name.

**A ruling that only restates the guess is cleared, not stored** — the gap
dial's rule and the team-name override's. Otherwise a later change to how the
guess is made could never reach that photo again.

It rides in the **same file** as the published nights, for the same reason the
league's rulings ride with its published venues: one question ("what does this
room publish"), asked at one moment, and two files would be two GitHub round
trips on a page that already waits for one. `setPublished()` carries the
rulings through untouched — writing only the nights would wipe every one, which
is the shape of bug that shows up weeks later when somebody notices a photo has
come back.

### It flips now and saves later

> *"The 1-2 second load on clicking green/red is annoying, can it not just load
> in the background perhaps at a later time?"*

The write goes to GitHub — about a second on a good connection and longer on a
pub's. Waiting for it before moving the colour made a lamp feel like a form
submission, on a control whose whole job is being flicked across a grid of
eighteen.

**The colour is the local truth and `saved` is the server's**, which is what
makes this honest rather than a lie. If the write fails the lamp goes back to
what the server actually holds and says why on the line that counts the
photographs — **never an `alert`**, which is a modal interruption for something
that happened in the background, and **never a silent revert**, which reads as
a lamp with a mind of its own. Nothing is ever left claiming a state that was
not recorded.

**It settles before it sends** — 600ms after the last press. Somebody deciding
about a photograph often presses twice, and two taps that end where they
started need no write at all, while two that do not need ONE rather than two
racing.

**And every gallery write goes through one promise chain.** They all rewrite
the same `published.json` — it holds the published nights and every per-photo
ruling together — and a GitHub content write is read-modify-write against a
sha. Fire three at once and two are working from a sha that is already stale:
at best a 409, at worst the last one home quietly undoes the other two. The
chain costs nothing that matters, because the flip is already instant.

### The league bay is a venue that folds into its nights

> *"Quiz league also needs a similar drop down for each night and also a
> summary at the top? Perhaps the summary (i.e. the actual quiz league table)
> is the one that displays when you click venue, and then you can click each
> night to see who won and when on any given night."*

The same rail as the Photos bay, which is the point: one shape, learned once.

**The pub's own row is `The table`, inside the fold, and never the heading
itself.** The heading is the FOLD; a heading that both folds and picks is one
control doing two jobs, which is the collision this app has a standing rule
against. Pressing the pub opens it; pressing *The table* shows the season.

Each night's row carries **Won by …**, so the rail answers most of the question
before anything is pressed — which is what a rail is for.

**`evenings` rides in the library payload, built where `leagueTable()` already
has it.** The night walk assembles `tonight` — the evening's finishing order —
one line before it starts scoring, so emitting a summary from there is free,
where working it out afterwards would mean carrying every leaderboard through
to the caller.

Two things keep it cheap and honest:

- **It is capped at `NIGHT_ROWS`.** A season is twelve weeks and a quizmaster
  may have four venues, so uncapped this is thousands of rows for a panel that
  shows the top of the night. Eight is the podium and its neighbours, which is
  what "who won" means; the count says how many there were.
- **It carries the POINTS**, worked out on the server from `pointsFor()`. The
  first version had a copy of the ladder in the browser, which is exactly the
  duplication this repo keeps paying for — two implementations of one sum, on a
  number a team can add up themselves.

The field is `evenings` rather than `nights` because **`nights` is already read
as a COUNT** in a dozen places — the venue card, the bay's heading, the public
page, the report. Reusing the name for a list would have been a label collision
on a field that is everywhere.

**A board with no `position` on it scores nobody**, which is worth knowing
because it fails quietly: the night view draws its headers and an empty body. A
fixture written without positions was testing a shape the app never sees, and
the check now asserts the table has rows in it rather than merely columns.


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


## PHOTOGRAPHS FILED BEFORE THE CAMERA FLAG STAY SHOWN BY DEFAULT — 31 August 2026

Reported off a live gallery: *"on that 13th August there are clearly photos that
were uploaded instead of taken on the night? the big lemon for e.g. — that needs
to be hidden from the public gallery since I want (mostly) photos that were
either taken on the night or look as though they were."*

**It is not a fault in the filter.** `NOT_CAMERA_SUFFIX` shipped on 23 August
2026; the night is ten days older, so those files carry no marker because the
marker did not exist, and `isCameraFile()` reads "no marker" as "a camera took
it". The app has no evidence either way for anything filed before that date.

**Three answers were put up and the host took the third: leave the default and
switch them off by hand.** The lamp already works on an old night and reaches
the public page the moment it is pressed, and there are few enough of these to
be worth nobody's code.

The two that were turned down, so they are not re-proposed:

- **Defaulting pre-23-August nights to OFF.** Strict in the same direction as
  the team-name filter, and wrong here for a reason that filter does not have:
  it would empty every already-published historical gallery — the genuine room
  photographs included — on live public pages, all at once, to catch a handful
  of jokes.
- **A "hide them all on this night" control.** A real convenience and not worth
  a control: the clutter rule says leave it out and wait for somebody to miss
  it, and the set it would serve is a fixed, shrinking list of nights from
  before August.

**If it comes back, the trigger to watch for is volume** — this is cheap while
the pre-flag nights are a handful and stops being cheap if a season of them ever
needs curating.


## "IT SAYS NOT PUBLISHED, BUT IT IS" — a lost update on `published.json`

Reported off a live gallery on 31 August 2026, with a screenshot: the night's
page read *"28 photos · Not published"* on a night the console had published
and been told it had.

### One file, two halves, two callers

`published.json` holds **which nights are up** and **the per-photo rulings**
behind the green and red lamps. `setPublished()` and `setPhotoDecision()` each
read the whole file, change their own half, and write the whole thing back.

Nothing ordered them. So a lamp write that *began* before a publish finished
wrote the nights back exactly as they were before it — un-publishing the night
somebody had just published. The photographs still showed to the owner, because
the preview does not depend on the flag; a stranger with the link saw nothing.

### And nothing could report it

**GitHub cannot refuse the second write.** `putFile()` fetches a fresh sha
immediately before writing, so the write is never *against* the version its
content was built from. The API sees an ordinary update and answers 200. Both
callers are told they succeeded, and there is no error anywhere.

**The browser's own queue cannot cover it either.** `galleryQueue()` serialises
the console's own calls — but the lamp deliberately settles for 600ms before
sending, which means the press that overlaps a publish is precisely the one
that queue has not started yet. Ordering had to go where the file is.

### The fix, and why it is per room

`inOrder()` in `src/gallery.js` — a promise chain keyed by room, with the READ
inside it as well as the write. Reading outside the queue would buy nothing:
it is reading a version somebody else is about to replace that loses the
update, not the writing.

A chain per room rather than one global, because two quizmasters write
different files and have no reason to wait for each other. The chain swallows
rejections, so one failed write cannot wedge a room for ever, and every caller
still gets its own result back.

`test/gallery-writes-serialise.test.js` puts the private repo behind a stubbed
`fetch` — a Map, with a delay on the read so the interleaving is deterministic
rather than lucky — and covers the publish-then-lamp order, the lamp-then-
publish order, four lamps at once, and unpublishing. All four failed before the
fix.

### The one that was NOT the cause, but is real

While chasing this, a second way to get the same symptom was reproduced:
publishing on the **host key** writes the flag into the HOUSE room, while the
public gallery reads the owner's own quizmaster room, so the night is published
into a folder the page never looks at — with a 200 and no error. The comment
above `galleryRoomId()` in `server.js` had already predicted this in as many
words and left it, which is how a written-down hazard becomes a bug.

It is left alone deliberately for now: routing the write to the gallery's room
would publish nights whose photographs are in the *other* room, which is a
worse silence than the one it fixes. The real answer is for the console's photo
pages and the publish route to agree on one room, and that is a bigger change
than the fault reported.

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


## THE PRIVATE REPOSITORY IS RUNNABLE BY THE SUITE NOW

`test/helpers/photo-repo-stub.mjs`, loaded with `node --import`, answering the
GitHub Contents API out of a temporary directory.

**Everything about a night going public lived behind a token the suite has no
business needing** — the published flag, the per-photo rulings, the card pins,
and which ROOM any of it lands in. So those routes were only ever read as text,
and this repo already knows what that is worth: a test that never runs the
artefact proves nothing about it. Two silent live bugs came out of that gap in
one day.

`test/gallery-publish-loop.test.js` walks the whole thing over real HTTP: sign
up, set a password, sign in, see your own unpublished night, publish it, and
check a stranger can now see it with three photographs on its card. Taking it
down is a case of its own, because somebody asking for their photograph to come
off is the one request that must never quietly fail.

**IT SIGNS IN WITH A PASSWORD RATHER THAN THE HOST KEY, and that is the point
rather than a detail.** The key resolves to the house room — which is precisely
the room the gallery does NOT read — so a test written on the key would have
exercised the identity that hides this whole class of fault. A quizmaster with
a password is both the ordinary case and the one a customer's experience
depends on.

Verified by putting the room bug back: two of the three cases fail, naming the
folder.

**It is deliberately dumb** — no shas, no conflicts, no rate limits. What it is
for is proving that a write lands where the next read looks.


## A P ON THE NIGHT ROW — publishing in one press

Asked for on 31 August 2026, looking at the two-step control:
*"put a red P here by default and a click to put it to green publishes the
gallery, and another click unpublishes it and makes it red."*

### It overrules two written rules, and both were argued before building

- ***A rail picks; it never acts*** — written so the worst a mis-tap in the
  rail can do is show you something else.
- **The publish control sits UNDER the photographs** — *"so nobody publishes a
  night without having just looked at what is in it. A button on the collapsed
  row would be one tap from a stranger's face going public."*

Both were about the same thing: not publishing a set of faces blind. **So the
lamp keeps the reason and drops the two presses** — pressing P also PICKS the
row, so the night's photographs load into the bay at the same moment it goes
public. You are looking at what you just published, and one more press takes it
down. The old control bought that by refusing to draw until you had opened the
night; this buys it by opening the night for you.

### The shape

- **Opt-in per item.** `bayRail()` draws a lamp only for an item carrying one,
  so the league and pack rails cannot grow one by accident.
- **A SIBLING of the row, not a child.** A button inside a button is invalid
  HTML — the browser re-nests it and the inner one silently stops receiving
  clicks, which is the class of fault `markup-balance.test.js` exists for.
- **Green for on, red for off**, the same words the per-photo lamp uses, so the
  two controls on this door agree about what a colour means. It carries the
  letter **P** rather than being a bare dot: a night row is read rather than
  scanned like a grid of eighteen, and a lone dot beside a date has nothing
  near it to say what it is about.
- **It flips now and saves later, with NO settle delay** — unlike the photo
  lamp, which waits 600ms because it is flicked across a grid and often changed
  twice. A night is published once and the press is a decision; delaying it
  only delays the page somebody is about to go and check.
- **A failed write puts the lamp back and says why**, under the rail. Never an
  alert for something that happened in the background, never a silent revert.
- **The list is corrected in place** rather than re-fetched — a whole archive
  read to learn one boolean the browser already knows is a request nobody
  needs.

### And the old button goes, because two controls for one job is the collision

`nightPhotos()` on Community no longer draws *Put these on the gallery*. **The
read-only half stays**: a published night still prints its public address,
which is what somebody actually wants off that panel, and an unpublished one
now says where the switch is. *A read-only summary may repeat; a control may
not.*

**Past gigs keeps its button.** It is a different door with no rail, and the
control there is not a duplicate of anything on screen.

### The guard presses it

`scripts/community-bay.mjs` — nothing in this repo presses a control and a dead
one draws perfectly. It checks every night row has a lamp, that there is
exactly one per row, that **the wall row has none** (there is no night behind
it), that pressing it changes the colour, that pressing it **also opens that
night's photographs**, that a wordless colour still says what it is, and that
nothing went wrong writing it.


## THE NIGHT'S ADDRESS MOVED INTO THE HEAD OF THE BAY

Asked for the same day, pointing at the empty half of that line: *"this is a
bit of space where you could link to the live gallery?"*

He is right — the bay's head is a wide row with a date at one end and nothing
at the other, sitting directly above the photographs it is the address of.

- **IT MOVED, IT WAS NOT ADDED.** The address was printed in the panel
  underneath, and that panel had already lost its button to the P lamp. Two
  copies of one URL is how a link comes to work in one place and 404 in the
  other, so `galleryAddress()` in `console-gigs.js` is now the single builder
  and the panel draws nothing at all on this door. **Past gigs keeps both** —
  no rail and no bay head there, so nothing is duplicated.
- **IT SAYS WHICH KIND OF LINK IT IS.** Published, it reads *"On the gallery —
  see it"* in the good colour. Unpublished, the same page is still reachable by
  the owner — the gallery shows them their drafts — so it is offered as
  *"Preview this gallery"* rather than hidden: checking what a night looks like
  before putting it up is the whole reason that preview exists, and saying "see
  it live" over a page nobody else can open would be the app lying about its
  own state.
- **`target="_blank"`**, because this is somebody checking a page mid-job.
  Losing the console to go and look would cost them the night they had open.
- **`bayHead()` takes an ELEMENT, never a string** — it is a leaf that knows
  what a bay looks like and nothing about galleries, so the door hands it a
  node rather than the file learning about URLs.
- **`margin-left: auto` rather than a spacer**, so it sits at the end whatever
  is beside it and the head needed no layout change.

The guard checks the href, that it points at a gallery, that it opens in its
own tab, that it stays inside the head, and **that the words match whether the
night is actually public** — the two states being the entire point of it.


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


## PUBLISHING MUST NOT REBUILD THE GALLERY TO CHANGE A COLOUR

Reported on 31 August 2026: *"publishing or unpublishing the gallery here
shouldn't need to reload the gallery each time?"*

It should not, and it was doing it **three times a press** — once for the pick,
once for the optimistic flip and once for the answer — each throwing away the
whole bay and rebuilding a grid of thirty `<img>` elements to change the colour
of a 30px button.

**THIS IS THE PER-PHOTO LAMP'S OWN RULE ARRIVING LATE.** That one paints itself
and never re-renders, for exactly this reason. The publish lamp reached for
`renderKeepingPlace()` because it also had to update the head's link, and the
big hammer was easier than finding two elements. Two elements is the right
answer — `paintPublish()`, which moves the lamp, the head link and the error
line where they stand.

- **The lamp is found by `data-lamp`**, so it repaints whether or not that night
  is the one showing — the rail carries one per night and only one is open.
- **Picking what is already open is not a change either.** The P picks before it
  acts, so pressing it on the night already showing rebuilt the bay for nothing.
- **The error line is written AND removed in place**, or a stale failure sits
  under a lamp that is now working.

### The guard measures identity, not count

A photograph in the grid is stamped before the press and checked for afterwards:
if the bay was rebuilt, that exact element is no longer in the document.
**Counting the images would say thirty either way** — the same "in the document"
versus "the one I had" distinction that has bitten this repo three times. Put
the render back and all three sizes fail with *"the photographs were thrown away
and redrawn"*.


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


## THE LIVE LINK LOOKS LIKE A BUTTON NOW

*"The live link is great but it needs a mouseover and click animation so it's
obvious it's a button."*

**THE SHAPE WAS HALF OF WHY.** It was a flat outlined PILL, and in this app a
pill is what BADGES wear — BRONZE, GOLD, PAID, YOURS. So it was saying "label"
before anybody got near it. `--r-field` is what a button wears here.

The other half is the app's own ordinary-button face, which the GUI rules
already settle: a top-lit surface rather than a flat swatch, with the account's
colour arriving as the bottom EDGE only. Never a flat grey box, never a wall of
colour.

- **THE LIFT AND THE PRESS ARE BOTH NEEDED.** Hover raises it 1px with a
  shadow; the press puts it 1px BELOW where it started and thins the bottom edge
  to 1px, so the whole control shortens under the finger the way a real button
  does. **A hover-only control still reads as a label that happens to glow.**
- **LIVE WEARS GREEN ON THE EDGE** — the account's colour says *yours*, green
  says *it is actually up*. The face is untouched, so it stays the same object
  in both states.
- **Reduced motion keeps the ANSWER and drops the movement** — the finish
  layer's own rule: hover and press still change the surface, they just do not
  move it.

### The guard drives a real pointer

A `:hover` rule cannot be seen any other way — a class can be asserted in a unit
test and still paint nothing, and this app has shipped a dead hover before
(`filter: brightness(1.25)` on a 22px dot, a change you could not find). So
`community-bay.mjs` hovers, holds the mouse DOWN, and measures the rendered box:

```
the link LIFTS under the pointer  — 100.0 -> 99.0
and it presses DOWN past where it started — hover 99.0 -> press 101.0
its edge thins under the finger  — 1px
```

## The publish lamp asks first — 1 September 2026

Asked for the day after the lamp shipped: *"can you have a little warning pop up
when someone clicks the red green at the gallery level saying 'you are about to
publish this gallery, proceed?' and 'you are about to unpublish this gallery,
proceed?' with a yes/no option, so its clear what they're about to do."*

He is right, and the reason is the thing that made the lamp good in the first
place. It is a **wordless** control — a coloured letter — which is exactly what
`docs` argued for on a grid of eighteen photographs, where a repeated label
becomes furniture. But this one is not on a grid of eighteen. It is on a rail of
a dozen dates, one press away from a stranger's face going onto a page anyone
with the link can open, and there is no undo that reaches somebody who has
already looked. A colour that carries all of its meaning is the right control
for a photograph and half a control for a publish.

### It is the browser's own `confirm()`, deliberately

He asked for *"a yes/no option"* and a native dialog renders **OK/Cancel**. A
literal Yes/No means drawing a dialog, and this app has never had one: twelve
confirmations in the console — the photo bin, deleting a pack, removing a seat,
writing off a night — are all native.

**So a drawn one here would put two kinds of confirmation on one door**, and the
photo bin's is a few inches below this button. That is the label collision this
repo keeps recording, wearing a dialog instead of a word: one question asked two
ways, and the day one of them grows a habit the other has not is the day
somebody presses the wrong thing quickly. The clarity he is asking for lives in
the SENTENCE, which is entirely ours to write, rather than in two button labels
the browser owns.

If a drawn dialog is ever built, it should be built once and then take all
thirteen, never one.

### The sentence names the night and says the consequence

The confirm rule this app already follows — set by the photo bin — is that a
confirmation says what it is about to do to WHICH thing, never *"are you sure"*.
A lamp pressed on a rail of a dozen dates is precisely where the wrong row gets
hit, and the date plus the pub is what tells you it is the row you meant:

> You are about to publish this gallery — Thu, 27 Aug — The Crown.
>
> Anyone with the link will be able to see these photos.
>
> Proceed?

and, the other way:

> You are about to unpublish this gallery — Thu, 27 Aug — The Crown.
>
> The link stops working and nobody but you can see these photos.
>
> Proceed?

**The second line is the half that matters**, and it is the half a coloured P
cannot carry however well it is drawn. Publishing is not "turning something on";
it is handing out a link. Unpublishing is not "turning it off"; it is a link
somebody may already have going dead.

### Saying no must change nothing — and that is the half the guard checks first

A confirmation in front of a press that happens anyway is worse than no
confirmation at all: it looks identical from the outside, and it teaches
somebody that the question is a formality to be clicked through. It is also the
half that can rot silently — the yes path is exercised every time anybody uses
the feature, and the no path is exercised by nobody until it matters.

So `scripts/community-bay.mjs` answers **no** first and asserts the lamp did not
move, then answers yes. The harness holds the answer in a variable rather than a
constant for exactly that reason.

### What the guard found: the row's state was captured, and the rail is never rebuilt

Walking the *other* branch of the wording — pressing the lamp a second time to
put the fixture back, and checking the question said *unpublish* — failed. It
said *publish* again.

**The cause is older than the confirm and had nothing to do with it.**
`photoRail()` reads whether a night is up when it builds the row, and closes
over that value:

```js
const up = pubLive.has(night.night) ? pubLive.get(night.night) : Boolean(night.published);
…
onPress: () => togglePublish(night.night, !up),   // stale from the first press onwards
```

That is fine on any rail that is redrawn after a press — and this one is
deliberately the opposite. `paintPublish()` exists precisely so that flipping a
colour does not throw away a grid of thirty photographs, so nothing rebuilds the
row and `up` stays at whatever it was when the page was drawn. Every press after
the first therefore sent `on: true` again.

**It was invisible for three reasons at once**, which is why it is written down:

- **The first press was right**, and the first press is what anybody checks.
- **Nothing threw and nothing went red.** The write succeeded; the server was
  told to publish a night that was already published, which is a no-op.
- **A state push fixes it.** The bay is rebuilt on every push, so at a console
  with a game running the row is refreshed within seconds and the second press
  works. It only fails on a quiet console — which is exactly when somebody is
  doing their photographs.

The fix is to ask again at the moment of the press. `upNow(night, fallback)` is
the one place that question is answered, because the rail, the press and the
repaint all need the same answer at three different moments.

**And the general shape is one this file has recorded before**: a value read
when a control is BUILT is a bug waiting for the first thing that stops
rebuilding. The gap dial, the pack card's *in Tonight* ghosting and this are the
same fault three times.

## The pin looks like a pin now — 1 September 2026

*"Love the tooltip for this but can the actual symbol be more obviously like a
pin."* It was a filled circle with an arc over it and a line beneath — which is
a map pin's skeleton, and at 18px on a dark thumbnail it read as a lollipop or a
magnifying glass.

Five candidates were rendered at the real 18px, in the real 30px dot, on both
the plain and the gradient state, before choosing:

- **The old one** — the lollipop.
- **A stroked thumbtack** — recognisable, but thin and weak beside its neighbours.
- **A filled thumbtack** — cap bar, filled body, stroked needle. **Chosen.**
- **An angled thumbtack** (the Lucide shape) — reads as a pin, but the diagonal
  muddies at 18px and it points off-axis inside a round button.
- **A map pin** — rejected on MEANING rather than looks: it says *location*, and
  what this button says is *this one goes on the night's card*.

**The mix of fill and stroke is the thing that makes it work at that size.** An
all-stroke pin at 18px is a smudge and an all-filled one is a blob; a filled
body with a stroked cap and needle keeps the silhouette. `fill="currentColor"`
means one drawing serves both states, so there is no second icon to keep in step
when the button turns pink.

## `GitHub 409` — the sha we read back was a lie

Reported off a live console, in red across the top of a night's photographs:

```
GitHub 409: {"message":"photos/…/published.json does not match 50979a2a…"}
```

Two things were wrong at once, and the second is the interesting one.

### It should have been impossible by this file's own reasoning

The note above `inOrder()` said, in as many words, that **GitHub cannot refuse
one of these**: every write reads a fresh sha immediately before sending, so a
write is never against the version its content was built from.

The first thing to check was whether the serialising had a hole in it — a
fourth writer of `published.json` outside `inOrder()`, which is exactly the
shape of the bug that mechanism was built for. It does not: `setPublished`,
`setPhotoDecision` and `setPhotoPin` are the only three, all three go through
the chain, and nothing else in the codebase names the file.

**So the sha was never RACED. It was STALE.**

### The Contents API is not read-after-write consistent

`GET /repos/…/contents/…` is served from a replica and through a cache. A read
moments after a `PUT` that has *already answered 200* can hand back the version
before it — and there is no header on our request telling anything not to.

The shape that hits this is precisely what the P lamp and the photo lamps
produce: writes to one small file, back to back, with the serialising chain
guaranteeing there is no gap between them at all. The thing that made the
writes safe from each other is the thing that made them fast enough to outrun
GitHub's own replicas.

### The fix is to stop reading it back

**A `PUT` returns the file's new sha in its own response.** That is the one
copy of it that nothing can serve stale, because it is not a read. So
`putFile()` remembers it, per repository and path, and the next write to that
path sends it with no read in front of it at all.

That is also **a call cheaper**, on an API this app spent a day fitting inside
5,000 an hour — a write through the Contents API was two round trips and is now
one.

### But it is a cache, so it has to be able to be wrong

Anything editing the file from outside this process moves the sha underneath
us, and `published.json` positively invites that: it is a small readable JSON
file in a repository the host owns, and GitHub's web editor is one click away.
The note above `readAll()` already flags a hand-edit as something the app
cannot see.

So a 409 is **forgotten, re-read past the caches, and retried exactly once**:

- **Forgotten**, because whatever we remember is now demonstrably wrong.
- **Past the caches** — `Cache-Control: no-cache` and a cache-busting
  parameter. Without it the retry reads the same cached body, sends the same
  sha and fails the same way, which is a retry that only doubles the bill.
- **Once.** A file genuinely being written by two people wants to be
  *reported*, not fought over in a loop.

### Each of the three halves is needed, and each fails on its own

That is the part worth writing down, because it is where this kind of guard
usually rots. With all three in, everything passes; the memory alone leaves the
outside-editor case broken; the retry alone leaves every rapid write spending a
409 and two extra calls to recover; and the retry without the fresh read fails
identically twice.

`test/github-sha.test.js` models a repository that keeps **real shas**, refuses
a write carrying the wrong one, and can be told to answer ordinary reads from
one version behind. Each half was removed in turn and the case that proves it
watched to fail. **The first version of the stale-read case passed with either
half removed** — it asserted only that the write eventually landed, which a
working retry delivers while the memory rots away behind it. It asserts
`conflicts === 0` now: not "recovered from", but *never sent a stale sha at
all*.

### And a 409 is said in words

GitHub's own answer is a sha and a documentation URL. On the console's error
line that is a wall of JSON naming no cause and suggesting no action — which is
exactly how it appeared in the report. A conflict that survives the retry now
reads *"That file was changed by something else a moment ago. Try again."*

### The link says "gallery" on both sides of the switch

*"See this gallery live."* It read *"On the gallery — see it"*, which is a
sentence with the verb at the end and the subject implied, on a control that is
only ever a few words wide.

The half worth noting is the other label. The two are **one link in two
states** — one replaces the other in place, with no re-render — so
*"Preview this night"* against *"See this gallery live"* would be a single
thing wearing two nouns, which is the label collision this file keeps
recording, in the smallest form it comes in. It is **"Preview this gallery"**
now: the noun is fixed and the word that VARIES is the one carrying the
meaning, which is whether anybody else can open it.

They are named as constants because `paintPublish()` repaints this link without
re-rendering, so the same words are written in two places and would otherwise
drift apart the first time one was edited.

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
