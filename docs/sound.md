# Sound — the soundboard, and the one audio layer underneath it

`public/assets/audio-kit.js` (the primitives), `public/assets/stings.js` (the
six noises), `public/assets/lobby-sound.js` (the lobby games' own), the
`Sounds` panel in `host.js`, `POST /api/host/sting`, `room.sting`, and
`scripts/soundboard.mjs`.

Asked for on 11 September 2026:

> *"A little sound board that I can access as the quiz master. So for instance,
> if someone puts an answer that's a bit silly, I can have a comedy wrong
> answer sound… and then maybe a crowd's clapping sound, a few other things…
> that I could access while running a quiz and music bingo."*

## It plays on the PROJECTOR, and that is the whole design

The question that decided the build was *which speaker*, and his own answer
settled it: *"my sound outputs via my dj decks which is picked up as a sound
card on my laptop."*

So the laptop with the HDMI in it is also the machine wired to the PA. A page
on that laptop plays to the system's default output device, which is the DJ
interface, which is the PA — the same path the music takes, with no extra
wiring and no new hardware.

The alternative was the host's phone, and it is worse in three ways: a phone
speaker is quiet in a pub, holding it to a microphone feeds back, and it puts
the host's hand where the mic should be.

**The one thing to check on a given rig** is exclusivity. On macOS CoreAudio the
device is shared and the browser gets it. On Windows, DJ software holding the
interface in ASIO *exclusive* mode can lock other applications out entirely —
in which case the browser is silent and nothing reports an error.

## Synthesised, never shipped

No `.mp3`, no `.wav`, no library. The same rule `qrcode.js`, `brandmark.js`,
`stickers.js` and `lobby-sound.js` already follow, for the same three reasons:
nothing to 404 on a venue's wifi, no bytes over the one connection that must
not stutter, and no dependency that can break on a gig night.

A sad trombone is four descending sawtooth notes through a low-pass with
vibrato on the last; applause is a bed of band-passed noise with two hundred
random clap bursts on top. Both are a dozen lines of Web Audio.

**And that is why there is no boo and no laughter.** A convincing human crowd
noise cannot be synthesised — what comes out is a kazoo, which is the lesson
`lobby-sound.js` already learned about the yeehaw. Applause is the exception
only because it genuinely *is* filtered noise: hundreds of uncorrelated claps
with no pitch in them. Anything needing a human voice is an asset, and an asset
is the thing this avoids.

## One audio layer, two policies

`audio-kit.js` was extracted when the second set of sounds arrived, because
**two copies of an audio layer is two layers that get fixed once** — the same
argument `src/arcade.js` exists for. The kit holds the context, the envelope
and the noise source. What stayed with each caller is policy, and the two have
opposite policy:

| | `lobby-sound.js` | `stings.js` |
|---|---|---|
| Where | sixty phones | one laptop, into a PA |
| Gate | this phone's preference AND the host's switch | none — the press *is* the decision |
| Length | under 0.2s, garnish | 1–2.5s, has to carry a room |
| Volume | 0.18 | 0.5, with headroom for the mixer |

## It is an event, not a flag and not a phase

A sting changes no phase, no score and nothing in `state.json`. It lives in
`room.sting` in memory — exactly the shape `room.introPlay` already uses — and
is spread into the **screen** view only.

Writing it to the game state would put an event into a crash-recovery file, and
a restart would then replay a noise from an hour ago into a quiet room.

It rides the ordinary state push rather than a channel of its own, because that
stream already carries the question clock and is therefore the fastest thing
this app has. **A comedy sting that lands two seconds after the laugh is worse
than no sting at all**, which is also why `draw()` plays it before it draws
anything.

**And it expires.** `STING_TTL_MS` is four seconds, so a projector opened late
or reconnecting after a blip never blasts a sting the room has forgotten. The
projector *also* remembers the last press time it played, so the two halves
together mean exactly one noise per press however many pushes carry it.

**The id is validated against `stings.js`'s own list** — it arrives as one word
in a request body, which is the shape of trap already recorded for `packId` and
`wantedTier`. The list the browser draws from IS the list the route checks.

## The arm chip, and why it has to exist

Every browser starts an `AudioContext` suspended until the page has had a real
user gesture, and **a context made without one is silent for ever and reports
no error whatsoever**. Without an arm, the soundboard would be six buttons that
do nothing with nothing on either screen saying why.

So the projector draws a small "Tap for sound" chip, bottom LEFT — nowhere near
the join code, which nothing may dim — and it removes itself on the first
press. Any click anywhere on the page arms it too, so a host who clicks the
projector window to focus it has already done the job without reading anything.

## What the guard measures, and the two faults it caught

`scripts/soundboard.mjs` splices an analyser onto the page's audio output and
samples the peak. **Silence and a working sound look identical from the DOM** —
nothing is drawn, no class changes, no element appears — so sampling the signal
is the only honest check, and it is the audio version of *a test that the
payload is right proves nothing about whether anybody drew it*.

It caught two real faults and one of its own:

1. **A clipping ding.** It measured 1.27 where everything else sat near 0.3.
   Through a PA that is a crack, not a chime, and on a laptop speaker that
   cannot reach 1.0 it sounds perfectly fine — so only a ceiling finds it. The
   cause was not the gain: the second oscillator started 10ms *before* its
   envelope, and **a `GainNode` defaults to 1.0 until something writes to it**,
   so it played those 10ms at full volume. Turning its gain down threefold
   barely moved the number, which is what gave it away.
2. **`--autoplay-policy=no-user-gesture-required` in the guard's own launch
   flags**, which switched off the exact browser behaviour the arm chip exists
   to work around — so the chip correctly did not appear and the guard called
   a working feature broken.
3. **Stings fired 150ms apart** while applause (2.4s) was still ringing, so
   every peak was a measurement of the sum. A peak measured over somebody
   else's sound is not a measurement of anything.

---

## The boo came back, and one of them is a voice

*"Can you add a 'your mum' sound and a boo?"*

The header of `stings.js` said there would be no boo, on this reasoning: *a
convincing human crowd noise cannot be synthesised — what comes out is a
kazoo.* That was written about **laughter** and applied to a boo by assumption,
and the two are not the same problem.

A laugh is a fast train of sharp, pitched transients with articulation in every
one of them. That is exactly what synthesises badly, and it is why the original
note was right about laughter. A boo is the opposite: one long, low, almost
unchanging vowel, held by a lot of people slightly out of tune with each other.
Nothing about that is hard.

So `boo()` is six sawtooth voices, and the two things that make it a crowd
rather than a synth chord are that **they start at different moments** —
spread over about a fifth of a second — and that **each sags by a different
amount** as it runs out of breath. The vowel is a lowpass: bright for 90ms so
there is something like a "b", then closed down to 330Hz, which is roughly
where "oo" lives. A little band-passed noise underneath stops it sounding like
it was recorded in an anechoic chamber.

The gain is divided by the voice count. Six overlapping envelopes at full
strength is the `GainNode` lesson this file already records, arriving as a sum
rather than as one node — it measures at 0.23 against applause's 0.26, well
under the 0.95 ceiling.

**Whether it is good enough for a real room is the host's judgement.** It is a
synthesised crowd and it will never be a recording of one.

### "Your mum" is the browser's own voice

A sentence cannot be made out of oscillators, so the choice was an audio file
or `speechSynthesis`. A file breaks the rule at the top of `stings.js` for the
reasons written there — bytes in a public repo, a fetch on a venue's wifi,
something to 404 mid-gig.

`speechSynthesis` is neither a file nor a dependency. It is in the browser
already, ships nothing, fetches nothing, and comes out of the same sound card
as everything else — so on the projector laptop it goes down the decks with the
rest of the soundboard. It is set deliberately slow and low, because the joke
is the deadpan delivery; a cartoon voice would be the kazoo problem again.

A browser with no voice is a silent no-op rather than a throw. The soundboard
is pressed mid-gig, and a control that takes the page down with it is worse
than one that does nothing.

### What the guard cannot tell you about it

Every other sting runs through the `AudioContext` that `soundboard.mjs` splices
an analyser onto, so the guard can measure whether a noise actually happened
and how loud it was. `speechSynthesis` does not: it is handed to the platform
and comes out somewhere the page cannot see. The peak reads a flat zero however
well it works.

So the guard asserts the press reached the right function and the platform was
asked to say the right words — and nothing more than that. Asserting on the
peak would have been a guard confidently answering a question it was not
looking at, which is the fault this repo records against `pub-unchanged` five
times over. **That it makes an audible noise on a given laptop is something a
person has to hear.**
