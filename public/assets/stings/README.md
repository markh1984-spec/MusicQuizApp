# The soundboard's recordings

**Drop an `.mp3` in here named after the sting's id and it replaces the
synthesised one.** Take it away and the oscillators come back. There is no list
to edit and no build step.

| File | The button it replaces |
|---|---|
| `trombone.mp3` | Sad trombone |
| `rimshot.mp3` | Ba-dum-tss |
| `boo.mp3` | Boo |
| `yourmum.mp3` | Your mum |
| `applause.mp3` | Applause |
| `ding.mp3` | Ding |
| `drumroll.mp3` | Drum roll |
| `fanfare.mp3` | Fanfare |

The ids are `STINGS` in `public/assets/stings.js`; a new sound is one line
there plus a file here.

## What a good one is

- **Short.** A sting runs while the host is holding a room. A second and a half
  to three seconds; applause can go longer because it is a bed rather than a
  punchline.
- **Topped and tailed.** No silence at the front — the clock in somebody's head
  starts when the button is pressed, and dead air at the start reads as the app
  not working. The intro round's own cue rule, applied to a noise.
- **Levelled against each other.** They are played through one gain, so a file
  mastered hot arrives twice as loud as the ding beside it over a PA. Normalise
  the set, do not normalise each file on its own.
- **Mono is fine** and halves the bytes. A pub PA is not a listening room.
- **Small.** 96–128kbps is plenty for a two-second effect. Keep each under
  ~60KB so the whole set is a couple of hundred kilobytes.

## Before you add one

**This repository is PUBLIC and the app is SOLD.** A sound effect off a
free-downloads site is the same legal shape as naming a lobby game after
somebody else's arcade cabinet — the licence has to cover commercial use and
redistribution, not just personal use. Your own recordings, something you have
bought a commercial licence for, or genuine CC0 are the safe ones.

**`yourmum.mp3` is worth recording yourself.** It is funnier in the voice of
the person holding the microphone than in any stock read, and it settles the
licence question outright.
