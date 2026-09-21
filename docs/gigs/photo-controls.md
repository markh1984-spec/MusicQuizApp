# THE CONTROLS ON A PHOTOGRAPH — the lamp, the star, and putting a night up

Split out of [`photos.md`](photos.md) on 20 September 2026, whole named sections
at a time, when that file went past its 100KB cap. **The boundary is a subject
rather than a size**: this is everything a quizmaster PRESSES on a night's
photographs between the gig and the page a landlord sees — the green/red lamp,
the showcase star, the P on the rail and the publish control under the grid.

What stayed in `photos.md` is where the bytes live, how a night is filed, which
room reads them, and how the grid is SORTED — the sort is the lamp's consequence
rather than one of its controls.

---

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


## The pin is a showcase star now, top-left — 18 September 2026

Reverses the section below, deliberately. The host asked for the free
top-left corner to *"select showcase photos for the gallery"* — for the
control that already did exactly that: `coverPhotos()` takes the pinned three
first, and the socials export uses the same three. What was wrong was the
words (*"on the night's card"*) and the shape (a pin says "keep", not
"lead with"). Two options were rendered from the real stylesheet and he chose
the star in the top-left. **ONE control, still** — a second one in another
corner for the same three is the collision this app has a rule against. The
class, the route and the storage keep the name `pin`.


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


## A STAR MEANS PUBLIC — 18 September 2026

Reported off a live console, and it is the clearest kind of bug report there
is: *"I just saw a photo that had a star on it but with a red dot, which
doesn't make any sense."*

It did not. Two controls sat on one tile saying opposite things:

- the **star** means *this is one of the three photographs the night's card
  leads with*, and the socials export uses the same three;
- the **red lamp** means *this photograph never goes on the public gallery*.

Both were stored, both were drawn, and nothing anywhere refused the pair. The
app resolved it in silence: `coverPhotos()` only ever draws from the list a
night's page would actually show, so a starred-but-hidden photograph was
filtered out and the star did nothing at all.

**That filter was right and it was the whole problem.** It is defence in depth
against a hand-edited `published.json`, not a design. What it produced on
screen was a control present, lit, and ignored — which is precisely what
*present and inert* exists to refuse, and which the app has no way to explain
to somebody looking at it.

### One decision with an order to it

Three fixes were possible and only one of them leaves nothing to work out:

1. **Warn.** A line saying "this one is hidden, so the star does nothing". That
   is a control that needs explaining, which rule 1 says is a control that is
   wrong.
2. **Disable the star on a hidden photograph.** Better, and still makes
   somebody discover a rule by finding a dead button — and the obvious next
   move (switch it green, then star it) is two presses for one intent.
3. **Make the pair impossible.** Starring publishes; hiding unstars.

Three is what was built, and the asymmetry is deliberate:

> **Starring one PUBLISHES it. Hiding one UNSTARS it. Un-starring one does
> NOT hide it.**

The last clause matters. A star is a preference about which of the public
photographs to lead with; taking it off says nothing about whether the
photograph should be public, and a control that quietly pulled a picture off a
page would be far worse than the contradiction it replaced.

### It is enforced in the writers, not in the browser

`setPhotoPin()` and `setPhotoDecision()` are the only two writers of
`published.json` and they already share one queue per room — so that is the one
place both halves can move together and the one place a second open tab cannot
get between them. Putting the rule in `console-gigs.js` would have been a
second copy of it, and the two would disagree the first time somebody had the
console open twice.

**The browser only keeps up.** Both controls already flip optimistically and
settle against the reply — the lamp has done since *"the 1-2 second load on
clicking green/red is annoying"* — so each press now moves its sibling on
screen straight away and then takes the server's answer for both. The two
routes report the paired state back (`pinned` on the ruling route, `onGallery`
on the pin route) rather than letting the console assume what a write did.

### Two smaller things that are easy to get wrong

**Starring a photograph that is public by default writes no ruling.** The rule
this file already carries — *a ruling that only restates the DEFAULT is
CLEARED, not stored* — applies here in a form that looks like a shortcut and is
not: starring a house photograph whose lamp had been switched red must DELETE
that `'off'`, never stack an `'on'` over it. Storing `'on'` would pin the
photograph to today's default for ever, and a later change to how the default
is decided could never reach it again. So the pin writer asks
`showsByDefault()`, exactly as the ruling route does.

**A refused fourth star publishes nothing.** The cap is refused rather than
trimmed, and the refusal has to take the publish with it — otherwise a press
that visibly did nothing would still have put a photograph the room sent onto a
public page. The check runs before anything is written, and the browser puts
both controls back when the 400 arrives.

### What proves it

`test/gallery-pins.test.js` pins the rule in the writers, including the
direction that does *not* hold and the refused-fourth-star case.
`node scripts/star-means-public.mjs` presses both controls in a real browser,
reads the classes off the screen, checks the server agrees, and reloads the
page — because *a test that the payload is right proves nothing about whether
anybody drew it*, and the half that was reported was the half on screen.

`coverPhotos()` still filters, and that stays: `published.json` lives in a repo
a human can edit, so the READ must go on refusing what the writers can no
longer produce.

---

## NOTHING CLICKABLE SITS UNDER THE SCROLLBAR

Reported off a screenshot of a night open in the Community bay: *"slight issue
here I can't select the two right sided controls because the scroller gets in
the way."* The two on the right of a tile are the lamp (top) and the bin
(bottom), and on the **last tile of every row** neither could be pressed.

Measured, with the bay holding thirty-six photographs so it genuinely scrolled:
the lamp's right edge was **6px** from the inside edge of `.bay-body`, and the
bin's **7px**. A macOS or iOS **overlay** scrollbar is about 9px across at rest
and about 15px the moment the pointer is near it, and it takes **no width from
the box** — it is painted over the content. So the strip the bar lives in is
exactly the strip those two controls were in.

### It could not have been found by putting a finger on it

Every guard in this repo that asks *can this be pressed* uses
`elementFromPoint()` at the control's middle, and **a scrollbar is not an
element**. It answers no hit test at all. `console-frame.mjs`,
`console-controls.mjs`, `dead-controls.mjs` and `community-bay.mjs` all said
the lamp was pressable, and a finger slid the box instead of flipping it.

So the question had to change shape: **how far is the control's right edge from
the inside edge of the box that SCROLLS**, against the widest that box's bar
ever gets. That is `clientWidth` on the scroller, not `offsetWidth` — the
difference between the two is the gutter a *classic* bar takes, and an overlay
bar's is zero, which is the whole fault in one number.

The nearest scrolling box is found the way `console-frame.mjs` finds one: walk
up through `auto`/`scroll` ancestors, never `hidden`, never `body`.

### `scrollbar-gutter: stable` is the obvious answer and does nothing

It reserves space for a classic scrollbar. Where the bar is an overlay it
reserves nothing, by specification — which is every Mac and every iPhone, and
therefore every device this was reported from. It is a plain `padding-right`,
from one token so the places using it cannot drift: **`--scroll-gutter`, 14px**.

### The gutter is on the SCROLLER, never on the grid

Putting it on `.community-wall` would have fixed the photographs and left the
same edge on the rail's own **P** lamp, which is the last thing in a row inside
`.bay-rail` — another scroller — and on anything the league table ever grows on
its right-hand end. One rule on the four boxes that scroll inside a bay covers
all of them, and a fifth scroller added later inherits it by being named there
rather than by somebody remembering.

**Below 900px there is no gutter and none is needed** — the bay does not scroll
there, the page does, and the page already has `.wrap`'s 16px side gutter
between the last tile and the window's own bar.

`community-bay.mjs` asserts it at all four widths, and the assertion was
verified by taking the padding out again: four failures, one per width, naming
the 6px.

## EMPTYING THE BOTTOM OF THE PILE — `.photo-sweep`

*"Can I have a button that deletes all the non-gallery photos?"*

The bands turned the grid into an inbox: the greens and the starred sit at the
top, and you work down the reds promoting whatever is worth keeping. What was
missing was the last step. Ninety photographs from a busy Thursday is ninety
confirms otherwise, one at a time, on a Monday — which is exactly the admin
this app exists to take off a Monday, and the reason a bulk control here is
worth the pixels where most bulk controls are not.

### It acts on the red lamps and nothing else

Not the source, not the flag, not a date. `p.onGallery` is the one question
this page is about, and by the time somebody presses this they have just spent
five minutes answering it photograph by photograph. A flagged photo left red
goes with the rest — it is red *because* nobody kept it, and the flag is a
prompt to look rather than a verdict either way.

The count is on the button (*"Bin the 27 not on the gallery"*) and it repaints
wherever the bands do, off the same list: one lamp press changes the grid and
the button together. The confirm names the number **and what survives** —
*"The 9 green ones are untouched"* — because the fear this control has to
answer is not "will it delete" but "will it delete the ones I just saved".

### Present and inert, and first in the controls on both doors

A destructive control that comes and goes as you press lamps is one you cannot
learn the position of, and this one's whole context is a grid that re-arranges
under you. So it is always drawn, disabled and saying why when there is nothing
off the gallery.

It is inserted FIRST in the controls container rather than appended, and that
is a real fix rather than a preference: on Community the container already
holds the venue picker and the post kit by the time this runs, because
`onData` fires the moment the payload lands; on Post gig it is empty, because
there the showcase is built after `nightPhotos()` resolves. Appended, one
control sat in two different places on two doors.

Outlined red with the drawn bin, like everything else here that deletes —
never filled, which would make it as loud as a Launch button.

### One at a time, and it stops rather than ploughing on

Every delete is a write against the private store, and firing ninety at once is
the read-modify-write race `galleryQueue()` exists for one door along. The
button counts up as it goes, so a slow store reads as work rather than a dead
press. A failure stops the sweep, re-lays the grid out first so the button and
the photographs agree about what is left, and then says how many went before it
stopped.

Each photograph leaves `data.photos` as well as the DOM — the bands, the count
line and the button all read that list, exactly as the single bin does.

`scripts/photo-sweep.mjs` presses the real button in a real browser and then
reads the stub repository's own folder. That second half is the point: a grid
that drops three tiles without the bytes leaving is the control-reports-success
fault this repo keeps catching, and the next reload would bring them all back.

## THE FRAMED SHOWCASE STRIP IS DELETED

It drew the three the night leads with, framed with the venue's overlay and the
quizmaster's mark, under the photographs — asked for so the frame could be
judged without saving three files to look at them. Then the grid above grew a
**Showcase** band of its own, and: *"There's a showcase bit at the top which
makes the showcase bit at the bottom defunct, and they disagree anyway."*

Both halves of that are right. Two displays of one thing is the collision this
app renames controls over — and they genuinely parted, for a reason neither
could see from its own side:

- the **band** draws what is **starred**, live, including a star pressed a
  second ago and not yet saved;
- the **strip** drew `cover`, and `coverPhotos()` puts the pins first and then
  **fans out** to three whatever you starred.

So one star showed one tile up in the bay and three framed pictures down here,
two of which nobody had chosen.

**What stays is the post kit** — the caption, the one press that saves the
three framed, and the mark saying it has gone out. Those are not a display of
the showcase; they are the workflow, and the save still composites the venue's
frame and says which pub had one.

**The cost, accepted: the frame is no longer previewed anywhere.** If that is
missed, the strip belongs *beside the band* rather than below it, reading the
same starred list — putting it back under the post kit returns the
disagreement.

## A TILE ENLARGES ON A PRESS — `openBigPhoto()`

*"Can I have a click enlarge the photo and another click un-enlarge it? I'm
generally going through these photos trying to decide if I want them on the
gallery or showcase and sometimes they're not big enough to decide."*

That is the whole case, and it is the bands' own case: the grid is a decision
queue, and a 96px thumbnail of a dark pub will not settle a lamp or a star. The
lamps and the stars are the work; being able to see what you are ruling on is
the precondition for doing it.

### Post gig had no opener at all

`nightPhotos()` took an `onOpen` and Community passed one. Post gig called it
as `{ wall: true, controlsInto: under, onData }` and passed none — so
`if (onOpen)` was false, the tile never got `is-openable`, and on the door
whose entire subject is *evidence* the photographs could only be squinted at.
Nothing threw, every test passed, and no guard in the repo asked whether a tile
opens.

So the opener is now the grid's own default and a caller only supplies one to
do something extra: `const openOne = onOpen || ((shot) => openBigPhoto(...))`.
Community still supplies one, and it is four lines of bookkeeping round the
same builder — it remembers which picture was open so a state push that rebuilds
the bay brings it back rather than closing it mid-look.

### It hangs on `.bay-side`, never on the grid inside it

`position: absolute; inset: 0` anchors to the padding box of the nearest
POSITIONED ancestor — and for a SCROLLED container that box starts at the top
of the CONTENT, not at the top of what you can see. Hung on the grid, the
picture drew exactly one scroll offset too high with thumbnails showing round
it; that was reported once, measured at 90px high and 30px short, and the note
on `.community-big` in the stylesheet still carries it. `.bay-side` does not
scroll — it is `overflow: hidden` with the grid scrolling inside it — which is
what makes it the honest anchor, and it already carries `position: relative`.

### An overlay, not a replacement

Nothing underneath is destroyed, so closing the picture puts you back exactly
where you were in a bay that may be ninety photographs long. `contain` rather
than `cover`, because this is the moment somebody is actually looking at it: a
crop is right on a wall of thumbnails and wrong here. The whole picture is the
button back, so the press that opened it is the press that closes it.

`photo-sweep.mjs` opens a tile and presses it again, on **both** doors — and
the Post gig half was verified by putting the fault back, which failed it while
Community stayed green.

---

## A lamp may not claim a page the night has not got

Reported by the September sweep and confirmed against the code on 21 September
2026: every lamp on a night's grid drew green and said **"On the public
gallery for this night"**, four inches above the button offering to *publish
that night*. Both halves were individually correct and together they said
opposite things.

**The lamp is one gate and the night's publish state is another above it.**
`showsOnGallery()` decides whether a photograph would be on the page;
`published.json`'s night list decides whether the page exists at all. A green
lamp on an unpublished night means *this one would show* — which is a useful
thing to know and not what the words said.

It reads wrongly in both directions, which is what makes it worth the change
rather than worth explaining:

- pressing **Publish** underneath looks like tidying up something already
  public, so the one control that carries the consent decision reads as a
  formality;
- and seeing green on a night he knows is down, the reflex is to start
  flicking lamps off in a hurry — undoing the per-photo decisions that are the
  expensive part, over a night that was never up.

**The lamp's JOB is unchanged. Only what it CLAIMS moved.** `live` is still
the photograph's own answer and the press still does exactly what it did; the
night's gate goes into the sentence:

> *"Ready for the gallery, once you publish this night. Click to hold it
> back."*

The room-sent variant keeps its own half (*"the room sent this one and you put
it up"*), because *off has two reasons* and so does on — a photograph the room
sent and a human passed is a different fact from one the house camera took,
and that distinction is the whole reason `p.source` comes off the SERVER
rather than being re-read from the filename in the browser.

**`data.published` is already on the payload** — `nightPhotos()` fetches the
pictures and the published flag together, which is the *one request per night,
not two* rule — so this cost no round trip and no new field.
