# Karaoke — a second product, and why the tracks must not be yours

Yes, and cheaper than it sounds IF the tracks stay somebody else’s. What to
build is the SHOW, not the songs.

**Parked strategy — nothing here is scheduled.** Part of
[`../business.md`](../business.md), which is the index. It moved out on 16
August 2026 because that file had reached 170KB with 89% of it under a single
heading, and a session opening it for one answer was paying for all of it.

---

## 2. Karaoke — yes, and cheaper than it sounds IF the tracks stay yours

Your idea: once there is a music licence, add karaoke, with hosts either
streaming the tracks for a fee or downloading the lot in one go.

**The two halves of that sit on opposite sides of a legal line**, and which
side you build on is the difference between a weekend of work and a licensing
business.

### The distinction that decides everything

**Performing** music in a room and **distributing** music to other people are
different rights, licensed by different people, at wildly different prices.

TheMusicLicence — the joint PRS/PPL one — covers *public performance on
premises*. It is what makes playing a track out loud in a pub lawful. It says
nothing at all about sending audio files to another quizmaster, or streaming
them from your server into their venue. That is reproduction and
making-available, and no venue licence touches it.

So:

- **You using karaoke at your own gigs** — the venue's licence covers the
  performance, and your KaraFun subscription covers the tracks. Nothing to
  build, nothing new to license.
- **This app streaming or shipping tracks to subscribers** — that is you
  becoming a music distributor. Different business entirely.

### Karaoke is harder than records, and this is the bit people miss

A karaoke track is three licensed things stacked up:

1. **The backing track** is a NEW recording of somebody else's song — a cover.
   Making one needs a mechanical licence from the publisher.
2. **The lyrics on screen** are a separate reproduction of the words,
   controlled by the publisher independently of the recording. This is the one
   that catches people out.
3. **The performance in the room** — the venue's licence, as above.

That stack is exactly why KaraFun, Sunfly and Zoom are licensing businesses
rather than somebody's side project, and why every one of their subscriptions
forbids passing tracks on. "Download once and keep it on the hard drive" is
fine when THEY sold it to the host and a breach when you did.

*Not legal advice — but it is the shape of the problem, so the conversation
with a solicitor would be short and cheap.*

### What to build: the show, not the songs

**Exactly the same shape as music bingo, which already works this way.** You
play bingo tracks from your own DJ app; the software runs the game around them
and never touches the audio. Karaoke is identical — KaraFun plays the track on
the host's laptop, and this app is the show:

- **Singers join on their phones** with the join code, put in a name and a
  song request. Same join flow, same QR, nothing new to learn.
- **You get the queue on your control view.** Reorder it, bump somebody up,
  mark them done, drop a no-show. One tap each, same as everything else there.
- **The projector shows "Now singing" and "Up next"**, with the join code still
  in the corner for latecomers.
- **Optional: the room votes**, so it is a karaoke CONTEST with a scoreboard —
  which is your product rather than a karaoke box's. A plain karaoke machine
  cannot do that and it is the reason a venue would book you over hiring a box.

Zero licensing exposure beyond what the venue already has. Zero audio over pub
wifi, so nothing can buffer mid-chorus with somebody holding a microphone —
which matters more here than in the quiz, where a slow question is survivable.

### Why NOT to host the tracks, even once licensed

Two reasons on top of the legal one:

- **Egress.** The sums are in direction 1 above: video runs about twenty times
  audio, and four 100-person video nights already exceed what a £9.99
  subscription covers. Karaoke is 3–5 minute tracks, thirty to sixty a night,
  usually with video. That is a serious bandwidth bill per host per night.
- **Reliability, which beats everything else here.** A quiz question arriving
  half a second late is survivable. A backing track stalling in front of a
  singer is not. Files on the host's own machine cannot do that.

### If you ever do want tracks in the product

Do not license songs yourself — that is years and lawyers. Do a **B2B deal with
a catalogue that already holds those rights**. You are already a KaraFun
customer, which makes it the cheapest possible first conversation: *"I sell
quiz software to pub hosts — can we integrate, or resell?"* You would be
selling access to their catalogue, not distributing anything.

**And the runner above is what you would bolt a catalogue onto anyway**, so it
is not wasted work either way.

### Size of the job

Small, for what it is. CLAUDE.md documents adding a game as four places to
touch, and the room work is already done. Roughly: an engine (the queue and
whose turn it is), a card set for the big screen, a panel on the control view,
and one line in the console so it gets a tab. No new dependencies, no build
step, no audio.

### One thing to check before spending on a licence

**Is the music licence even yours to take out?** In most pub gigs it is the
VENUE's obligation — they hold TheMusicLicence and it covers music played on
their premises whoever presses play. Worth confirming before you pay for one
you may already be covered by. It matters for the quiz and bingo you run today,
not just for karaoke.

---
