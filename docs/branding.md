# Branding — the name on it, and whose colours it wears

The reasoning behind the branding rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## The name on it, and whose colours it wears

`src/branding.js` and `public/assets/schemes.js`. Two settings, one idea: **a
night belongs to one quizmaster, and every screen in that room says so.**

### It was Quiztopia until 12 August 2026, and the rename was about the NAME being crowded

Not a whim and not a legal panic — the two are worth telling apart, because
only one of them is why it moved.

**The legal side was survivable.** `quiztopia.uk` turned out to be a venue in
Liverpool, which is a different service in a different city, and the `.com` has
been parked since 2008. A dormant YouTube channel of the same name has two
subscribers and nothing posted in three years, which is not goodwill anybody
could defend.

**What actually decided it was that the name was CROWDED, and that cost is
permanent.** The `.co.uk` was a £205 registry premium at two registrars, the
`.com` was gone, and a quizmaster hearing the name at a gig and searching for
it landed on somebody else's business — sharing every scrap of SEO, and their
reviews, forever. That is not a risk that might happen; it is a standing tax
for as long as the product exists.

**And it was free exactly once.** Nothing was printed, no QR carried it, Rob
had no login, there were no subscribers and there was no goodwill in the word.
A month later it is reprinting, re-explaining to paying customers, and doing it
under pressure. **If the name ever has to move again, that asymmetry is the
argument — not whether the new name is nicer.**

**Quizporium keeps the mark unchanged, and that was a criterion rather than a
coincidence.** The logo is a question mark inside a microphone: the mic is the
host, the question is what every round is. An *emporium* is a place stuffed
with things — which is what a growing catalogue is, and the whole Silver and
Gold argument — so the name says what is being SOLD while the mark says what
happens on the NIGHT. Neither needed redrawing. A shopfront or an awning would
have said "shop" on a projector, which is the wrong half of the product.

Three rules came out of choosing it, and they are what to apply next time:

- **A name that describes a PERSON puts a second character on the projector.**
  "Mark's Quizzard", "Mark's Quizmaster" — now there are two stars and one of
  them is not the paying customer. A PLACE or a SHOW is safe, because he owns
  or hosts it. This is the test that killed most candidates.
- **It has to spell itself from hearing.** *Quizine* was the most charming
  thing on the shortlist — "Mark's Quizine" casts him as a chef with a craft —
  and it is phonetically identical to "Mark's Cuisine". A name needing "with a
  Q" in every sales call fails the fourth design rule, which is about helping a
  quizmaster SELL.
- **Pun on a WORD, never on a NAME.** A real person's name is a personality-
  rights problem the day you charge for it, and it fails the first rule too.

`APP_NAME` is one variable and `brandWords()` splits on it generically, so the
rename was the constant, the page titles, the docs and the tests — nothing
structural. `BRAND_NAME` still beats all of it, unchanged.

**The domains are `quizporium.co.uk` (£5) and `quizporium.app` (£8).** The
`.com` is parked and is worth buying if the app ever pays for itself, not
before. `.app` is HSTS-preloaded, so browsers refuse plain HTTP on it at all —
which on a QR-scanned join link over pub wifi is a small reliability win rather
than only a badge.

### "Mark's Quizporium", "Rob's Quizporium"

The product is **Quizporium** (`APP_NAME`). What goes on a projector is the
room's host possessive-plus-that — **first names only**, because that is how he
introduces himself on the mic and a surname on a projector reads like a
letterhead. `brandFor()` also copes with the account having no name on it, by
falling back to the local part of the email: `rob@…` is still somebody telling
you they are Rob.

**It is taken from the ROOM, never from whoever is looking at the page.** A
phone that scanned Rob's projector says Rob's Quizporium even while the owner has
the console open in the next tab.

**And the room's host is looked up in the ACCOUNTS BOOK by room id, not read off
the room's `label`.** A label is only set when somebody who knows their own name
touches the room, and the first thing to touch a room after a restart is usually
the projector, which knows nothing. Branding off the label would leave a big
screen saying plain "Quizporium" for the five minutes before a gig. A room id IS
an account id (`roomIdFor`), so the book always knows.

`BRAND_NAME` still beats all of it and is unchanged — it is the documented way
to put one name on the whole app. What DID change is that it no longer *defaults*
to a name: it used to, which meant every room on the server said the same thing
whoever was running it.

### A scheme is a BRAND. A look is a NIGHT.

`SCHEMES` — six of them, stored on the account, changed from "Your colours" at
the bottom of the console. A scheme sets `--hot`, `--hot-2` and the washes
behind everything, so a quizmaster who does not want pink-and-orange does not
have to put somebody else's app on a projector with their own name above it.

**A scheme never touches `--a` to `--f`.** Those are the option colours — how a
player looks up, decides "the pink one, bottom left", and looks back down — and
they belong to `looks.js` and to nothing else. Two features fighting over the
one thing that has to agree between the projector and the phone is the way this
loses somebody points. There is a test.

**A look WINS where they overlap**, which is why the `[data-scheme]` blocks sit
ABOVE the `[data-look]` blocks in `style.css`: both are one attribute selector,
so source order is all that decides. Halloween is orange and black on
everybody's account, because a themed night is about the night rather than about
whose it is. There is a test for the ordering, because moving a block would
silently reverse it.

The ordinary scheme (`sunset`) deliberately has **no block of its own** — it is
whatever `:root` already says. So an account with no scheme, and every page in
the moment before the scheme arrives, looks exactly as the app always did.

**The logo takes the colours too** — the disc it is cut out of, and the app name
under the possessive — through `var(--hot, #ff2e88)` in the gradient stops rather
than bare hex. The fallback is load-bearing rather than belt-and-braces: the same
function is served as `/favicon.svg`, a standalone document with no stylesheet
and therefore no `--hot` at all, and a tab icon that came out transparent is not
a bug anybody would connect to a colour picker.

`PUT /api/me/scheme` is your own account and takes no id, so it cannot repaint
anybody else's projector. It is not behind a feature gate: it costs nothing to
run, which under the host's own tier rule makes it Basic, and the owner wants it
too. Saving pushes the room, so the projector and every phone change where they
stand without anybody reloading anything.

---
