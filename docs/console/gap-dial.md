# The gap dial, and the Tonight tile's own shape

`gapDial()` / `gapsOfPart()` / `gapIdsOfSlot()` in `console-breaks.js`, the
`In the gaps` picker on the settings row, and the tile it sits in.

Moved out of `CLAUDE.md` on 14 September 2026 to pay for the DJ set's section,
under that file's own standing instruction: *"THE NEXT ONE HAS TO COME OUT OF
`docs/` MOVES, NOT A RAISE."* Every prohibition below is still named there;
what came out is how each was found and measured.

It is a file of its own rather than an append to
[`launch-bar.md`](launch-bar.md), which was already 99KB — *put a new section
under the heading it belongs to rather than under whichever one is last*, and
the dial is its own subject.

The strip of chips it replaced lasted a day: *"it could just be a symbol you
click to cycle… in the bottom right of the pack ONCE LOADED."*

- **THE TILE'S SIZE DECIDED THE SHAPE, MEASURED FIRST**: 179 x 76 with 58px
  clear — ONE 44px control and never two, so the dial is the PHONES and the big
  screen became a night-level picker. **The plan on disk is unchanged.**
- **A DIAL IS SAFE HERE because every state is a real answer and the order is a
  SCALE** — one whose steps are not has to be memorised.
- **THE LIT EDGE HAD TO BE MADE HONEST** — `cleanPlan()` runs on the way OUT
  too, or a gap back at its default still claims a change.
- **DOORS KEEPS A DIAL, the one gap with no tile** — phone-only, the join code
  owning the lobby's screen.
- **A LOST `import` DREW A BAR WITH NO DIALS AND EVERY CHECK PASSED** — a
  swallowed `ReferenceError`, `node --check` happy, the suite green.
  **`test/imports-present.test.js`** asserts every module imports what it
  calls.
- **A TILE IS NOT A PART** — several quiz packs are welded into ONE quiz, so
  `gapsOfPack()` reads the part's `order`.
- **THE SLOT NUMBER GOES WHEN A PACK LANDS IN IT**; **it stays on an EMPTY
  slot**, its label.
- **THE TILE IS 90px BECAUSE 30 + 44 DOES NOT FIT IN 76** — moving the × puts
  "remove this" where the eye lands first.
- **THE ERA WORD IS GONE FROM A TONIGHT TILE** — it overlapped the round ticks
  and there is no third place: **the control wins and the decoration moves.**
  **It stays on the shelf CARD.**
- **`.lb-tiles:has(.lb-doors-slot)` OUT-SPECIFIED THE PHONE RULE** — a class
  more specific than `.lb-tiles` beat the 560px layout and 390 came out as four
  50px columns. The specificity trap wearing `:has()`.
- **DOORS IS A MINI SLOT AT THE HEAD OF THE ROW** — half width, no number, never
  a drop target. **The big screen is not offered there**: the lobby's projector
  is the join code and nothing may dim it.

