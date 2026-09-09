# The console's chrome — the topbar, the frame, and the sizes nobody measured

Moved here from `docs/console.md` on 9 September 2026, which had crossed its
own 100,000-byte cap, and into that file from `CLAUDE.md` the same day to pay
for the Stripe section. **Moved whole, by section, never reworded** — so
nothing could be quietly changed on the way through.

`CLAUDE.md` keeps every sentence that FORBIDS something and points here for the
numbers. **Read this before touching the topbar, the fixed frame or the bay
heights**: every finding below lived in a band no guard was looking at.

### The sweep of 25 August 2026, finding by finding

- **THE CONSOLE'S TOPBAR IS A GRID ITEM, AND A GRID ITEM DEFAULTS TO
  `min-width: auto` TOO** — **a clipped overflow is worse than a scrolling
  one**: nothing throws and the control is unreachable.
- **…AND CONSTRAINING IT MOVED THE OVERFLOW ONTO THE MENU**, so **My account
  was not there**. **A door you cannot see does not exist**, and **a fix that
  relieves pressure has to be followed to wherever the pressure went.**
- **THE DIET HAS NO UPPER BOUND, BECAUSE `.console .wrap` CAPS THE BAR AT
  1180px** — **a media query on the window is the wrong tool the moment a
  CONTAINER caps what you are protecting.**
- **WHAT IS PLAYING NOW IS WORDED IN ONE PLACE — `nowPlaying()`.** There were
  THREE. **The SHORT form is a different job, not an abbreviation**, and
  **under 1050px the live line stands down.**
- **THE BAR GOES ON A DIET; WRAPPING IS ONLY THE FALLBACK** — two rows read as
  a second bar. **Scoped with `:has(.hat-switch)` to the OWNER's bar**: a fix
  for one account must not land on everybody. **AND IT NEVER TAKES THE
  POSSESSIVE** — it hid the stacked wordmark, so the one bar this rule reaches
  lost its own name off its own console. **THE WHOLE WORDMARK SHOWS AT 1180px
  AND UP** — *"the whole point is to have [QM's] Quizporium"* — **and that
  number is the CONTAINER's, which is what makes a media query right here**.
  **Below it the product name gives way and the possessive stays.** **BELOW THE
  CAP THE BAR WRAPS AT 960 AND THE WORDMARK IS NOT WHY** — `#hatSlot` drops.
  **KEEP THE GATE AT THE CONTAINER'S NUMBER**: the switch measures 310px or
  387px depending on whether a host KEY is in use, moving any bisected
  threshold by ~77px.
- **AND `setViewportSize()` IN A LOOP IS NON-DETERMINISTIC HERE** — the same
  sweep read the wrap at 1090 then 960, a recalculation race against `:has()`.
  **Navigate fresh per width and poll twice 250ms apart until two readings
  agree**, or the threshold is whatever the timing gave you.
- **AND NOTHING RESTATES `overflow` AFTER `.console .wrap`'S PAIR.** A trailing
  `overflow: hidden` wiped the `overflow-y: auto` five lines above, so the frame
  CLIPPED and a real wheel moved nothing — the fix written for it had never
  once been in effect. FOURTH sighting of shorthand-beats-longhand, inside ONE
  block. **`console-frame.mjs` turns a REAL wheel** — a programmatic scroll
  succeeds on a clipped box.
- **THE FIXED FRAME NEEDS A MINIMUM HEIGHT. LETTING THE BAY SHRINK INSTEAD WAS
  TRIED AND IS WORSE** — it painted over the tab column. **The numbers said
  fixed and the render said broken**, which is why the screenshot is the
  check.
- **AND THE FRAME'S MINIMUM HEIGHT IS TWO NUMBERS, BECAUSE THE DOORHEAD IS TWO
  HEIGHTS. Do not collapse it to one**: one either takes the frame off a
  1500x900 laptop that fits it, or keeps it at 960x760 where it does not.
- **THE EQUAL-BAY RULE ONLY EXISTS BECAUSE OF THE FRAME**, so
  `community-bay.mjs` checks it only where the frame is on. **Both scripts
  carry the frame's two numbers; they move together.**
- **TWO COLUMNS IS A WIDTH DECISION; THE PINNED FRAME IS A HEIGHT ONE.** Gating
  it on height took the SIDEBAR away too — the rail holds at every height and
  only the pinning goes. **A media query is two decisions the moment it names
  two axes.**
- **`main` IS A FLEX COLUMN — never give it a row template.** Its
  `auto minmax(0,1fr)` grid assumed two children, so a banner above the doorhead
  turned the fixed frame back into a scrolling page.
- **THE SHELF IS SIX ACROSS, BY DECISION — it mirrors the six bays above it.
  Do not "fix" a squeezed card by dropping a column** — where six cannot be
  honoured, both grids move together (see below).
- **THE FINISH LAYER at the foot of `style.css` owns selection, caret,
  `:focus-visible` and the card hover** — one named block, so the next control
  is finished there rather than in scattered rules.


### The three that did not fit — the measurements


Every one lived in a band no guard looked at.

- **THE LOBBY'S JOIN PANEL IS CAPPED BY THE SCREEN'S HEIGHT** — `min(100%,
  72vh)`. A QR code is square, so on a WIDE, SHORT projector **the code was
  166px off**, on a page that does not scroll. **72vh is measured, not
  chosen.**
- **THREE ACROSS BETWEEN 561 AND 779px, AND BOTH GRIDS MOVE TOGETHER.** Six
  across needs 768px inside the panel, and a shut pack card is a square with a
  118px floor — **`aspect-ratio` plus `min-height` propagates to a minimum
  WIDTH**. At 561 the cards **overlapped by 28px**. **This is not six-across
  being dropped.**
- **`#hatSlot` IS A BARE `<span>`, SO IT HAD `min-width: auto`** — third
  sighting on this bar. The span would not give ground, so **`/host` scrolled
  sideways 161px at 390 and 231 at 320**. **The switch itself shrinks below 560
  too** — a label losing its tail is what this bar can afford; a door off the
  screen is not.
- **AND `console-frame.mjs` NOW LOOKS AT 768 AND 320** — its sizes ran 390 then
  960, leaving the 561-899 band unmeasured. **Its one-row rule moved from 431px
  to 900px.**
