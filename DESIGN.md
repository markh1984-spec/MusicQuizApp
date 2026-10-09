---
name: Quizporium
description: Live pub and club quiz nights, run by one host from one laptop, read from the back of a dark room.
look: Gig poster (chosen 9 October 2026)
colors:
  ink-black: "#100f0e"
  paper: "#f2ede4"
  ink-dim: "#a8a093"
  panel: "#1a1816"
  raised: "#221f1c"
  panel-line: "rgba(242, 237, 228, 0.12)"
  line-strong: "rgba(242, 237, 228, 0.28)"
  account-hot: "#ff2e88 (the default scheme; each account chooses its own)"
  trophy-gold: "#ffe14d"
  make-green: "#19c37d"
  destructive-red: "#ff4b3e"
  option-a: "#3b82ff"
  option-b: "#ffe14d"
  option-c: "#ff4fa3"
  option-d: "#19c37d"
  option-e: "#ff6c2f"
  option-f: "#9b7bff"
typography:
  display:
    fontFamily: "'Big Shoulders', 'Hanken Grotesk', 'Arial Narrow', sans-serif"
    fontWeight: 800
    note: "variable, optical size follows the font size; self-hosted WOFF2"
  ui:
    fontFamily: "'Hanken Grotesk', 'Segoe UI', -apple-system, Roboto, Arial, sans-serif"
    fontWeight: 400
    note: "variable 100–900; self-hosted WOFF2"
  title: { family: display, fontSize: "22px" }
  head: { family: display, fontSize: "19px" }
  body: { family: ui, fontSize: "14px" }
  note: { family: ui, fontSize: "13px" }
  tag: { family: ui, fontSize: "11px", fontWeight: 800 }
rounded:
  field: "10px"
  card: "14px"
  pill: "999px"
  letter-block: "6–8px"
components:
  button-the-night:
    backgroundColor: "{colors.account-hot}, flat"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.field}"
  button-make-something:
    backgroundColor: "make-green at 14% over raised"
    borderColor: "make-green at 60%"
    textColor: "{colors.make-green}"
  button-ordinary:
    backgroundColor: "{colors.raised}"
    border: "1px panel-line all round"
    underline: "3px account-hot under the words, 5px below them"
    textColor: "{colors.paper}"
  button-destructive:
    backgroundColor: "{colors.raised}"
    border: "1px red at 50% all round"
    underline: "3px red under the words"
    textColor: "{colors.destructive-red}"
---

# Design System: Quizporium

**The skin is `public/assets/look.css`, loaded after `style.css` on every page.
A colour or a font change goes there.** `style.css` still holds the layout,
the type ladder and every rule about what goes where; `look.css` is how it is
printed. This file describes what the two produce together.

## Overview

**Creative North Star: "The Gig poster"**

A venue flyer stapled to a pub noticeboard: off-black and paper-white, a few
flat spot inks, condensed type set big. Chosen on 9 October 2026 from four
directions rendered on the real app, because the old neon-on-black with glows
and two-colour sweeps read as generic — *"a bit AI slop"*. A pub quiz is a gig,
and the night is the show; the poster is the honest way to say so.

Everything still serves one moment — a host, on a laptop, in a dark pub,
running a live game for a room of strangers. Legibility from the back of the
room and not costing the host attention beat any decoration.

**Key characteristics:**
- Flat everywhere. No glows, no washes, no drifting blobs, no gradient fills, no
  gradient text. Depth comes from a raised surface and a line, never a shadow
  under an ordinary control.
- One filled control per screen, maximum — THE NIGHT, in the account's own
  colour, printed flat. Fill still means commitment.
- Gold is the trophy, green makes something, red deletes, on every scheme. A
  quizmaster's scheme changes personality, never meaning.
- Two typefaces, both self-hosted and OFL: a condensed display face for
  anything read from a distance or meant as a headline, a plain grotesk for
  everything you read up close.
- The projector is sized in `vh`, so it holds on whatever the venue plugged in.

## Colors

### Ground and ink
- **Ink black** (`#100f0e`) — the page. One flat colour, not a gradient.
- **Panel** (`#1a1816`) / **Raised** (`#221f1c`) — a card, and a control on it.
- **Paper** (`#f2ede4`) — text, warm rather than blue-white.
- **Ink dim** (`#a8a093`) — secondary lines, what `.tiny` means.
- **Lines** — `rgba(242,237,228,.12)` for a hairline, `.28` for a strong one.

### The account's colour
`--hot` is whatever the quizmaster chose (a `data-scheme` on `<html>`). It
fills THE NIGHT, underlines the words of an ordinary button, the chevron block
on a dropdown, the lit tab and the join-step numbers. **`look.css` never names
`--hot` or `--hot-2`** — that is what keeps every scheme working.

### Fixed meaning
- **Gold** (`#ffe14d`) — winning, points, first place. Nothing else.
- **Green** (`#19c37d`) — right answers, and controls that make something.
- **Red** (`#ff4b3e`) — wrong answers, and destructive controls.
- **Options A–F** — six spot inks, one per answer, the same order on the
  projector and the phone.

Seasonal looks (`data-look`) keep their own palettes: the poster palette sits
under `:root:not([data-look]), [data-look="default"]` so a Christmas night is
still a Christmas night.

## Typography

- **Display — Big Shoulders**, variable, 800–900, optical size following the
  font size. Headlines on the projector (the question, the winner, the round
  intro), the phone's team name and score, panel and tab headings, the top
  menu, pack titles and the sales page's headings. Condensed, so a long
  question fits at a size the back of the room can read.
- **UI — Hanken Grotesk**, variable. Everything else: answers on a phone,
  buttons, fields, body copy.
- **Mono** stays for anything read character by character.
- Both are subset to Latin, served from `/assets/fonts/` and preloaded. No call
  to Google or any other font host — which is why they do not break *no
  dependencies at all*: they are files the server serves, like an image.

The ladder in `style.css` (`--fs-tag` 11px up to `--fs-title` 22px) is
unchanged; `look.css` changes faces and weights, not the sizes a layout was
measured against.

**Capitals are for emphasis, not labelling** — the projector's title cards,
option letters and short badges keep them; ordinary labels are sentence case.

## Layout

Unchanged by the look, deliberately — the choice was *"look first, then
layouts"*. The projector is sized in `vh`; the console is a left column of tabs
from 900px with the work in `minmax(0, 1fr)`; the phone is measured at
320–430px and never shows the question text. Crowded screens are reworked one
at a time from here (see `todo/console.md`).

## Shapes and depth

- Three radii, mechanically: **10px** field, **14px** card, **999px** pill. A
  letter block on an option is 6–8px, a timer segment is square.
- **No glows and no ambient shadow.** A sheet or a menu that sits over the page
  keeps one shadow (`0 18px 50px rgba(0,0,0,.55)`); nothing else floats.
- Panels are framed with a 2px line on the console.

## Components

### Buttons — five roles, a control is exactly one
- **The night** — filled flat in the account's colour, ink-black text. Launch,
  Take control. **One per screen.** Disabled, it is a dashed outline saying
  what it wants.
- **Make something** — dark fill tinted green, green text and edge. Never a
  full green fill, which would out-shout the night.
- **Ordinary** — raised face, hairline all round, and a short straight
  underline in the account's colour under the words — the same mark as the
  lit door and a chosen switch. Never a coloured bottom border: that ran the
  whole width and bent round the corners, and was taken out on 9 October.
  A row of six never becomes a wall of colour.
- **Destructive** — red text, red hairline and a red underline on the raised
  face, never filled, on every scheme.
- **Choose** — a field and a dropdown look alike; the dropdown's chevron sits
  on a small block of the account's colour, the cue that it opens.
- **Switches** (the hat switch, the tier rungs, In the room / Online, On/Off)
  — the chosen half is a raised face with paper type and the account colour
  underlined, exactly like the lit door in the menu. Never a fill: one mark
  means "this one" everywhere. A lit tier rung keeps its metal.

### The projector
- **Options** are black tiles with a thick outline in their own ink and a
  filled letter block; the right answer fills green.
- **The timer** is a segmented level meter, the number beside it in the
  display face.
- **The winner** is a title card: a kicker, the team in gold at poster size,
  the score, then second and third on a podium in their metals.

### The phone
Answer buttons repeat the projector's: black, a 3px outline in the option's
ink, a filled letter block. The timer is the same segmented meter.

## Do and don't

- **Do** put a colour or font change in `look.css`, and check it under at
  least one seasonal look and one non-default scheme.
- **Do** keep one filled control per screen.
- **Do** keep gold, green and red meaning the same thing everywhere.
- **Don't** bring back glows, gradient fills or gradient text — the poster is
  flat, and the old look's tells were exactly those.
- **Don't** name `--hot`/`--hot-2` in `look.css`.
- **Don't** put a coloured bottom border on a control; the account colour is
  an underline under the words. (A pack card's green or purple foot is the
  kind of pack, not a button, and stays.)
- **Don't** add a third typeface, or load a font from anywhere but
  `/assets/fonts/`.
- **Don't** use capitals for an ordinary label.
- **Don't** draw an icon as an emoji in new work; drawn line icons in
  `currentColor` are the direction (see `todo/console.md`).
