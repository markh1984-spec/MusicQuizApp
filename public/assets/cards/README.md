# Card artwork — drop a file in, that card wears it

A picture named after a card's own id replaces the **middle** of that card.
Take the file away and the drawn pip comes back. There is no list to edit and
no build step: the server reads this folder, the browser asks it once per
night, and that is the whole interface.

It is the soundboard's arrangement (`public/assets/stings/<id>.mp3`), applied
to the deck, for the same reason — see `public/assets/card-face.js`.

## The names

`<id>.webp`, `.png`, `.jpg` or `.svg`. `.webp` wins where both are present, so
converting a folder later does not mean deleting the originals.

The id is the suit's first letter and the rank, lower case:

|        | Spades | Hearts | Diamonds | Clubs |
|--------|--------|--------|----------|-------|
| Jack   | `sj`   | `hj`   | `dj`     | `cj`  |
| Queen  | `sq`   | `hq`   | `dq`     | `cq`  |
| King   | `sk`   | `hk`   | `dk`     | `ck`  |
| Ace    | `sa`   | `ha`   | `da`     | `ca`  |
| Number | `s2` … | `h10`  | `d7`     | `c10` |

So the Jack of Spades is `sj.png`. All fifty-two work — a seven of hearts with
a picture on it needs no new code.

## Two folders, and the difference matters

- **`cards/`** — a picture for the **middle** of the card. The app draws the
  white card, the rank and the suit around it.
- **`cards/full/`** — the **whole card**: your own ground, your own border. The
  app draws no card under it, and prints only the rank and suit **on top**.

Nothing to rename: the folder you put a file in is the answer. A whole card
wins if the same id is in both.

A full card is assumed **dark** — the rank and suit print light over it — and
it is **clipped to the card's rounded corners**, so whatever is in your file's
four corners never shows.

**A full deck is all fifty-two or none.** Twelve black court cards in a hand of
thirteen white ones reads as broken rather than as a theme.

## What to draw

- For **`cards/`**: **square**, transparent background, around 1024x1024, the
  figure only, no border and no card behind it.
- For **`cards/full/`**: **portrait 5:7**, about 1024x1434, the whole card
  including its border and ground.
- **Never a corner index, in either folder** — the
  app draws the rank, the suit and the white ground around your picture, and
  the corner is the part that is actually read at the 45px a hand card gets on
  a phone. A drawn-in index at that size is a smudge over the one thing
  somebody is scanning for.
- **The right suit and the right colour**, because the pip it replaces was
  carrying that: a red Jack that looks black is a card nobody can play.
- **Original artwork.** This repo is public and the app is sold, so a scanned
  or traced Bicycle / Waddingtons / Hoyle court is somebody's copyright. The
  arrangement of pips is centuries old and free; a modern deck's drawings are
  not.

A picture drawn at any shape is letterboxed rather than cropped, so an odd
ratio loses space instead of losing a head.
