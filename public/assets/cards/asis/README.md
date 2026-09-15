# Cards exactly as you drew them

A file here is used **as it is**. The app draws nothing over it — no rank, no
suit, no card behind it. This is the folder for a deck design that already has
its own corner index.

`cards/full/` is the other choice: the same whole card, but with the app's own
big rank and suit printed on top. That reads at the 45px a hand card gets on a
phone; a designed index at that size usually does not. **Neither is right for
everybody, which is why it is a folder rather than a setting.** Put the files
where you want them and nothing else changes.

Named after the card's id: `sk.png` is the King of Spades, `h10.png` the ten of
hearts. Portrait, and as large as you have — on a projector a card is 245px
tall and up.

**One file in either folder dresses the whole deck**: every card you have not
supplied takes a dark ground, a gold edge and gold pips so it matches.

## You do not have to cut a sheet up by hand

    node scripts/cut-a-deck.mjs <sheet.png> --cols 11 --rows 4 --into asis \
      --order "-,sa,s2,s3,s4,s6,s9,s10,sj,sq,sk|..."

`--order` is the grid read left to right, top to bottom; `-` skips a cell. It
writes `screenshots/deck-cut.png` so you can check every card landed under the
right name — nothing in the script can tell a 6 from a 9.
