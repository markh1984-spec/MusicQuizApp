---
name: Quizporium
description: Live pub and club quiz nights, run by one host from one laptop, read from the back of a dark room.
colors:
  ink: "#f7f7fb"
  ink-dim: "#a7a7c2"
  bg-void: "#07070e"
  bg-deep: "#10101f"
  panel-glass: "rgba(255, 255, 255, 0.06)"
  panel-line: "rgba(255, 255, 255, 0.14)"
  account-hot: "#ff2e88"
  account-hot-2: "#ff8a3d"
  account-cool: "#4bd8ff"
  trophy-gold: "#ffd23f"
  make-green: "#2fe07a"
  destructive-red: "#ff4d5e"
  option-a: "#4bd8ff"
  option-b: "#ffd23f"
  option-c: "#ff6bd6"
  option-d: "#7cf76b"
  option-e: "#ff9d5c"
  option-f: "#b48cff"
typography:
  title:
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 800
  head:
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 800
  body:
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  note:
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  tag:
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 900
    letterSpacing: "0.05em"
rounded:
  field: "10px"
  card: "14px"
  pill: "999px"
spacing:
  sm: "9px"
  md: "14px"
  lg: "16px"
  xl: "24px"
components:
  button-the-night:
    backgroundColor: "linear-gradient(120deg, {colors.account-hot}, {colors.account-hot-2})"
    textColor: "#12000c"
    rounded: "{rounded.field}"
    padding: "11px 20px"
  button-make-something:
    backgroundColor: "linear-gradient(120deg, rgba(47,224,122,0.18), rgba(255,210,63,0.14))"
    textColor: "{colors.make-green}"
    rounded: "{rounded.field}"
    padding: "9px 14px"
  button-ordinary:
    backgroundColor: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 13px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.destructive-red}"
    rounded: "{rounded.field}"
    padding: "9px 13px"
  button-destructive-hover:
    backgroundColor: "rgba(255,77,94,0.12)"
---

# Design System: Quizporium

## Overview

**Creative North Star: "The Night"**

The name is not invented for this file — it is the term of art the codebase already uses for the one loud, committed control on any screen (Launch, Take Control), and it is the right lens for the whole system: everything here is built to survive one specific, high-stakes moment — a host, on a laptop, in a dark pub, running a live game for a room of strangers. Nothing in the interface is decoration for its own sake; every visual decision traces back to either *legibility from the back of the room* or *not costing the host attention they need for the mic*.

The system is deliberately **soft rather than shouted**. Capitals are reserved for the few places emphasis is the actual content — a winner's name, an option letter, a four-letter badge — never for ordinary labelling; a stated brand decision (documented in `CLAUDE.md`) that capitals read as unfriendly, not as "clean." Colour carries meaning with total consistency: gold always means winning, green always means "this makes something," red always means destructive, regardless of which of the seven seasonal/account palettes is active. What changes with a quizmaster's own scheme is *personality* — their two-colour gradient runs the Launch button and the logo — never *meaning*.

**Key Characteristics:**
- One filled gradient control per screen, maximum — fill means commitment, so two competing commitments is a screen with neither
- Colour that means something (gold, green, red) is fixed across every account scheme; colour that expresses personality (the account gradient) is the only thing schemes change
- Flat backgrounds, warm depth on buttons — nothing genuinely floats
- Sized in `vh` on the projector screen so it scales correctly to whatever the venue actually has plugged in
- No custom webfont — the system stack only, consistent with the project's stated "no dependencies at all" rule

## Colors

Two families that never trade places: colours that follow the quizmaster's own scheme, and colours whose meaning is fixed everywhere in the app regardless of scheme.

**A note for anything that scans this file for literal hex values against the codebase:** the primary tokens below (`account-hot`, `account-hot-2`, `account-cool`, `trophy-gold`, `panel`) are each overridden with different literal hex values inside roughly seven seasonal/account palette blocks in `style.css` — the SAME custom-property names, reassigned per scheme, exactly as CSS custom properties are meant to be used. A static scan that does not resolve `var()` reassignment will read every one of those overrides as an "undocumented" colour; it is not drift, it is the theming system working as designed. Two further legitimate, deliberately out-of-band colours: the podium's silver (`#d6dae2`) and bronze (`#cd8c58`), fixed real-world medal colours that intentionally do not follow any scheme (see the decisions table in `CLAUDE.md`); and the per-pack tint computed by `pack-look.js`, which derives a colour from a pack's own title text and is by definition not a fixed token.

### Primary (follows the account's own scheme)
- **The Night** (`#ff2e88` → `#ff8a3d`, a 120° gradient): the account's own identity colour. Runs Launch, Take Control, and the logo. Never used for anything the account did not choose.
- **Account Cool** (`#4bd8ff`): the paired accent inside the same scheme — highlights, focus rings, the secondary half of a two-colour gradient.

### Neutral
- **Ink** (`#f7f7fb`): primary text on the app's dark ground.
- **Ink Dim** (`#a7a7c2`): secondary text — the `.tiny` line under a heading, a closed pack card's detail line.
- **Void** (`#07070e`) / **Deep** (`#10101f`): the base background, a two-stop near-black gradient rather than a flat fill.
- **Panel Glass** (`rgba(255,255,255,0.06)`) / **Panel Line** (`rgba(255,255,255,0.14)`): the translucent card surface and its hairline border used everywhere except the console, which opts into an opaque, account-tinted surface instead (see Elevation & Depth).

### Named Rules
**The Trophy Rule.** Gold (`#ffd23f`) means winning, points, first place — everywhere, on every scheme, with one flagged exception (the lit menu tab currently borrows it for "you are here," a known inconsistency the project has chosen not to fix yet rather than move gold).

**The Fixed-Meaning Rule.** Green (`#2fe07a`) always means "this makes something" (Write it, Import, Save); red (`#ff4d5e`) always means destructive (Delete, Close, Stop). A quizmaster's own scheme never touches either — changing a scheme changes the app's personality, never what a colour means.

## Typography

**Display/Body/Note/Mini/Tag:** `'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif` — the system stack only, for every ordinary role. No webfont is loaded anywhere in the app.

**Mono:** `ui-monospace, SFMono-Regular, Menlo, monospace` — join codes and anything meant to be read character-by-character.

**Seasonal:** `Segoe Print` (with a system fallback) appears once, inside a seasonal look, and is the one deliberate departure from the system stack — used exactly the way the seasonal-look rule in `CLAUDE.md` describes: a palette and some shapes, never a change to the game itself.

**Character:** Plain and utilitarian by design — the point is never the typeface, it is that eleven fixed sizes exist so nothing is ever guessed per-screen.

### Hierarchy
- **Title** (800, 22px): the tab's own heading, drawn once per view.
- **Head** (800, 19px): a panel heading below it.
- **Sub** (20px) / **Lead** (17px): a card's title, the lead line of a panel.
- **Body** (400, 14px): ordinary panel copy — sized as a floor, since anything smaller here is a warning that must not go quiet.
- **Field** (16px): text inputs specifically — the floor that stops iOS zooming a form on focus.
- **Control** (15px): buttons and selects.
- **Note** (13px): secondary lines — what `.tiny` means throughout the app.
- **Mini** (12px) / **Tag** (11px, 900 weight, tracked): dense chrome — switches, small buttons, and over-line badges (BRONZE, GOLD, PAID).

### Named Rules
**The Emphasis-Not-Labelling Rule.** Capitals distinguish a heading by brightness against dimmed body text, never by being shouted — the one deliberate exception is the projector, sized in `vh` and read from six feet back, where "WINNER" in gold is a title card rather than a raised voice.

## Layout

Two structurally different surfaces, not one responsive layout stretched two ways:

- **The projector** (`screen.js`) is sized entirely in `vh`, because it has to read correctly on whatever the venue has plugged in — a phone-sized preview and a six-foot screen use the identical rule set.
- **The console** (`console.js` and its per-tab modules) is the host's own working surface: a sticky left-hand column of tabs from 900px up, collapsing to a full-width stack below it, with the working area taking `minmax(0, 1fr)` so a wide grid cannot push the page sideways.
- **The phone** (`play.js`) is measured at 320–430px and deliberately shows less than the projector: no question text, ever — only the options — which keeps the room looking up rather than at their hands.

Spacing runs on the same fixed scale as everything else here: no ad hoc padding, nine steps used throughout from a tight 9px control pad up to a 24px panel margin.

## Elevation & Depth

Flat by default; the console is the one deliberate exception. Everywhere else uses a translucent glass panel (`rgba(255,255,255,0.06)` on a hairline border) that lets each surface's background wash show through. The console instead opts into an **opaque**, account-tinted surface — load-bearing rather than decorative: a translucent panel over different background washes would render the same pack card a different colour depending on where it sat, so the one page a host works from all night gets one flat, predictable surface instead.

Buttons are the one place real depth exists, and it is restrained: a subtle top-lit gradient (`180deg`, white fading from 12% to 4%) rather than a drop shadow, so a control reads as an object you press without competing with the page's own glow.

### Shadow Vocabulary
- **Panel Shadow** (`0 18px 60px rgba(0,0,0,0.55)`): the one shadow value in the system, used for the rare panel that needs to sit visibly above the page (an open sheet, a dragged card).

### Named Rules
**The No Wall Rule.** Never six identically-filled buttons in a row — colour on the object's *edge*, not its whole face, is what keeps a row of controls from reading as either a grey wall or a shouting one.

## Shapes

Three radii, used mechanically everywhere and nowhere else: a **field** (10px) for inputs and ordinary buttons, a **card** (14px) for panels and pack tiles, and a **pill** (999px) for badges and chips. Every gradient in the system runs at the same fixed 120° angle — the two rules together are why nothing in this app reads as slightly off, once applied consistently.

### Named Rules
**The Nothing-Sharp Rule.** No square corners anywhere in the interface — a stated brand constraint, not a default.

## Components

### Buttons — five roles, and a control is exactly one of them
Role is chosen by what the button *does*, never by preference.

- **The Night** — filled, the account's own 120° gradient, dark text. Launch, Take Control. **One per screen, maximum.**
- **Make Something** — filled green, but darkened: a gradient of green-into-gold at low opacity with the *text* carrying the bright green, not the fill — full-saturation green next to The Night would out-shout it. Write it, Import, Save.
- **Ordinary** — depth without colour: a soft top-lit white gradient with a plain border, and the account's own colour on the *bottom edge only*. Read, Rename, Send.
- **Destructive** — outlined red, never filled. Filled red beside a filled gradient Launch button on a dark pack card is the two loudest things on the screen; outlined keeps it a deliberate second step. Delete, Close, Stop.
- **Choose** — a quiet field with no gradient at all; the one deliberate exception is a dropdown's own chevron, which carries a small block of the account's gradient as the one visual cue that says "this opens."

### Cards / Containers
- **Corner Style:** 14px (`{rounded.card}`)
- **Background:** the translucent glass panel described in Elevation & Depth, opaque and account-tinted specifically inside the console
- **Border:** 1px hairline, `panel-line`

### Inputs / Fields
- **Style:** the same quiet field as a dropdown — no gradient, 10px corners, a hairline border
- **Focus:** a 2px outline in the account's own hot colour

## Do's and Don'ts

### Do:
- **Do** keep exactly one filled gradient control on any given screen — fill means commitment, and a second one competing with Launch means neither reads as the thing to press.
- **Do** keep gold, green and red meaning the same thing on every account scheme — only the account's own two-colour gradient is personality.
- **Do** use the fixed three-radius system (10px field / 14px card / 999px pill) for any new control; nothing else.
- **Do** size the projector in `vh` — it has to hold up on whatever screen a venue has, sight unseen.

### Don't:
- **Don't** fill a destructive control. Delete stays outlined red everywhere in the app, on principle, not by omission.
- **Don't** add a custom webfont. The system stack is deliberate — see the project's "no dependencies at all" rule, which this typography choice is a direct consequence of.
- **Don't** use capitals for an ordinary label. Reserve them for genuine emphasis: the projector's own headlines, option letters, and short one-word badges.
- **Don't** invent a fourth gradient angle or a new radius value. There is exactly one angle (120°) and exactly three radii, applied mechanically.
