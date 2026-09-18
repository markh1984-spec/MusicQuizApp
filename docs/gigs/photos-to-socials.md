# Photographs out to socials

**Split out of [`photos.md`](photos.md) on 18 September 2026**, when that file
crossed the 100KB ceiling `test/docs-index.test.js` holds — the same split, for
the same reason, that put the night's own half in
[`photos-on-the-night.md`](photos-on-the-night.md) two days earlier. Sections
were moved whole and nothing was reworded.

**The boundary is a real one rather than a byte count.** `photos.md` is where a
photograph LIVES: the store, what it costs to serve, who may see it, how a
night is published. [`photos-on-the-night.md`](photos-on-the-night.md) is what
it DOES on the evening: the ask at the door, the vote at the break, the screens
it lands on. This file is what happens to it AFTERWARDS, on a Monday — which
three of the app's rules turn on: *build what helps a quizmaster SELL*, *the
app prepares, the human reads, the human sends*, and *a feature's real price is
the admin it creates on a Monday*.

## THE SHOWCASE IS THE SOCIALS POST — 18 September 2026

*"Going forward I want to use the showcase photos as the photos I post to
Instagram, I want a quick workflow for this purpose."*

Half of it already existed: the three starred photographs, framed with the
venue's overlay, and a button that saves them. What was missing was everything
either side — the words, and knowing which nights were still to do.

### What is not possible, said first

**There is no way for this app to post to Instagram, and there should not be.**
Meta's content-publishing API needs an Instagram Business or Creator account
linked to a Facebook Page plus an app review — a dependency on Meta, a pile of
Monday admin, and a permanent obligation to keep up with their deprecations,
for a button. It is also the wrong shape by this project's own rule: *do not
build a send that skips the reading.* A caption naming the wrong pub, the wrong
headcount or a date that moved lands on the relationship the quizmaster is paid
to keep.

So the goal is not "post for you". It is **from a finished gig to a posted grid
in under a minute, with no blank page to fill** — `reply-draft.js`'s shape for
the third time in this codebase: the app prepares, the human reads, the human
sends.

### Why it ends on the laptop, not the phone

The first design was a QR off the console onto the phone, on the assumption
that posting to Instagram means posting from the phone. Two things killed it:

- **A web page cannot hand images to Instagram's composer.** The
  `instagram://` scheme has no documented action that takes media, and the
  Stories variant needs native pasteboard access — a real app with the
  Facebook SDK, not mobile Safari. The best a page can do is
  `navigator.share({ files })`, which drops the caption when files are present
  and is [documented as unreliable with files on iOS
  Safari](https://developer.apple.com/forums/thread/665812) — sharing the text
  instead of the image.
- **instagram.com takes a carousel.** Since 2021 the desktop web uploader
  accepts drag-and-drop of multiple files — [up to 20 in one
  carousel](https://www.hopperhq.com/blog/how-to-post-to-instagram-from-desktop/)
  — plus Reels and Stories. All three showcase exports are already 1080
  squares, so the one real carousel trap (mixed aspect ratios being cropped to
  a shared orientation) cannot bite.

He does his admin on a laptop. So the workflow stays on the laptop: **press
once, drag three files into instagram.com, paste.**

### One press, two halves

`Copy the caption & save the three` does both, because either alone is
useless — three files in Downloads with no words, or words with no pictures.

**The clipboard write goes first, inside the gesture.** A browser only permits
one while it still believes a person is pressing something, and three
photographs and a frame composite later it does not. **A refused clipboard
selects the text instead and the photographs still go**: losing the caption is
a ⌘C away from fixed, and a press that did nothing because of a permission
prompt would be the control-reports-success-it-did-not-have fault wearing a new
hat.

The caption sits **above** the button, in a real editable box. That is the
reading, and it is the whole point of the shape.

### The caption collects nothing new

Every line is something the app already holds:

- the **venue** off the night;
- the **headcount**, which is the **max across the night's games, never the
  sum** — `headcounts.js` has held that rule for months, because a quiz and the
  bingo after it are the same forty people;
- the **next date at that pub**, from `upcoming()` — the same projection the
  calendar draws and the comeback slide reads, so the caption cannot disagree
  with either. It is filtered to *this* venue: a caption under photographs of
  The Station Tap saying "back Tuesday" about The Crown reads as carelessness
  to the pub it names;
- the **gallery address**, from `galleryAddress()` — **passed in** rather than
  rebuilt, because that function lives in `console-gigs.js`, which imports the
  export module, and two copies of one URL is a link that works in one place
  and 404s in the other;
- and a **town hashtag**, off the end of the venue name (venue names carry a
  town, which is why *one pub is one league* works at all).

**Silence where there is nothing true to say** — the comeback band's own rule.
No venue, no venue line. Nothing in the diary, no "back on" line; a guessed
date is worse than no date, because he will paste it without re-reading the
part he did not ask for.

### The winning team is deliberately left out

Two reasons, either sufficient:

- **A team's name in a caption HE posts is a public naming they never agreed
  to.** The public league page masks names for exactly this, and the gallery's
  own rule is *names and points, never faces* — a caption is louder than a
  table.
- **`clean-names.js` lives on the server by design**, so the word never reaches
  the wire. The browser therefore holds the real team name and has no safe way
  to judge it, and a second copy of that word list in a browser module is the
  thing this repo refuses everywhere else.

He reads the caption before it goes. If he wants to name them, he knows them.
**Do not add the winner without masking it on the server first.**

### `posted` is a mark, and it must never become a gate

The photographs and the words are the easy half. The half that costs a Monday
is remembering which nights are still to do — so the app keeps that instead of
the person, as a fourth list in `published.json` beside the published nights,
the per-photo rulings and the card pins.

**Nothing reads it to refuse anything.** A night marked posted can be posted
again; one that is not is never nagged about. It exists so the rail can say
what is outstanding and the pile shrinks on its own, which is this project's
standing rule about queues: *a feature that generates a queue somebody has to
work is expensive; one that serves itself is cheap.* The moment it starts
refusing, hiding or chasing, it has become the thing it was built to remove.

**It lives beside the other three rather than in a file of its own.**
`published.json` is already read once per page for the lamps, so this rides in
free. The rude-photo flags went the other way for a reason that does not apply
here: those are written by a background robot, which must never race a human's
publish. This is only ever written by a person pressing a button, through the
same per-room queue as everything else in the file — and **every writer carries
the three halves it is not changing**, which a fourth is exactly the moment to
forget. There is a test walking all four.

---

## *ADD YOUR OWN PHOTOS* MOVED TO THE BAY HEAD — 18 September 2026

*"If that already exists can we put it in a more obvious place."*

It did exist, and it had for weeks: **Add your own photos**, on Community →
Photos, inside an opened night. It was also effectively invisible, and the
reason is worth writing down because the placement was *correct by the rule*
and wrong in practice.

### Why a rule-abiding control could not be found

The Community bay obeys *the bottom is controls and options; it never displays
the thing* — you press something in the tab body and it appears in the bay
above. So the upload control was filed with the other controls: in the opened
night's row, in the list **underneath** the bay.

That is a **different region of the page from the photographs it adds to**. To
reach it you had to look away from the grid you were staring at, scroll past
the bay, find the open night in the list below, and look inside its row. Every
step defensible; the sum unfindable.

### The exception, and what keeps it honest

It is in the **bay head** now — the line carrying the night's date, its venue
and its public address — beside the live-gallery link.

**That is a stated exception to the bottom-is-controls rule, and it is the rail
lamp's exception again.** `bayRail` says *a rail picks; it never acts*, with
the Photos rail's publish lamp as the one allowed breach — and what made that
breach safe was that the lamp also **picked**, so the photographs landed in the
bay as it acted and nobody published strangers' faces unseen.

The same thing keeps this one honest: **what this button adds appears in the
bay directly underneath it.** Nothing happens out of sight.

Two limits hold the exception where it is:

- **One control beside the one link.** The head is a short identity line, not a
  toolbar. A second action up there starts a collection, and at that point the
  rule has gone rather than bent — which is exactly how the bottom half came to
  be the only place controls lived in the first place.
- **It moved; it was not copied.** Two controls meaning "add a photo" on one
  screen is the collision rule 1 refuses, and a move that leaves the old one
  behind is the commonest way to cause one. `community-bay.mjs` asserts the
  head has exactly one and the tab body none.

### `compact`, and why the label is the status line

In the panel the control was a button plus a separate line of small text. The
bay head is a baseline flex row, so a status line in it would drop the head
onto two lines the moment it said *"Sending 2 of 6…"* — and a head that changes
height mid-upload moves the whole bay under a fixed frame.

So `compact` renders one button that carries its own progress in its label, and
goes back to saying **Add photos** three seconds after it finishes. The wordy
form still exists for a panel that wants it.

One trap worth recording: the label **wraps the file input**, so the progress
text is written to `label.firstChild.nodeValue` rather than by replacing the
label's contents. Replacing them takes the input out with it, and a control
that eats its own input on the first press is one that works exactly once.

### It is a leaf now

`console-community.js` hit its line budget on this change, which is the budget
working as intended. `myPhotos()` and its `shrink()` came out into
`console-my-photos.js` — no page, no state, no room: the caller hands it a
night, says whether it is drawing compact, and is told when something landed.

**`wallShots` did not come with it.** That binding is the Community door's own
cache of the photo wall, and a leaf reaching back into the page that imports it
is the import cycle this repo keeps rediscovering — `console-packs.js` pulling
from `editor.js` ran a different page's boot code and hung the console for
every account. So the caller passes `onAdded` and drops its own wall. That is
also the honest shape, because Past gigs would have a different thing to
forget — and it can have this control the moment somebody asks for it there,
which it could not while the function lived inside the Community door.
