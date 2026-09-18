# History — where the app has got to, and what each night found

The reasoning behind the history rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## Current state

**Live as of 18 September 2026 — the stability week, in two deploys:**

Set off by the gig on 17 September, lost to KaraFun because the room a deploy
leaves behind blocked every launch. The host's brief afterwards: *"once it's
running I want it to be flawless and never fail in the night"* — and *"I'm
not doing anything till next Thursday now but everything must be perfect by
then."* Eight structural changes were proposed with their costs; he declined
one and parked one:

- **Declined: Auto-Deploy off and a Render disk** (*"don't see the need for
  1 at all"*). So a push is still a deploy that wipes `data/`, and the
  discipline is the release train instead.
- **Parked: the laptop as the server** — he will look once the rest is done,
  and doubts a quizmaster he sells to would go to that effort. Right: the
  answer for a customer is the platform being reliable, which is the other
  seven.

What went live, all guarded:

- **Prizes** (`prizes-fuzz.mjs`): a bingo round's prize is the NEXT on the
  table, not the stage's slot; a score fixed at the final moves the drinks;
  the draw takes the LAST prize on the table (the code always did — the
  notes had said third).
- **The Monday build** (`gig-build.mjs`): the suite, `pub-unchanged` against
  what is LIVE, and every protected-surface guard by name, one verdict in
  about six minutes. Nothing is pushed without it.
- **GitHub off the hot path** (`github-down.mjs`): every call has a deadline,
  the boot restore runs together and retries, a request waits three seconds
  for its backup and no more, the console's first load costs one deadline.
- **The score-write funnel**, **the ready line** (a light, never a gate — and
  its first build never polled, caught by the screenshot), **two devices, one
  quiz** (a move carries its cursor), **the wifi-blip and long-night guards**.
- **`server.js` is a shell** — forty modules in `src/http/`, cut on line
  numbers, `test/server-split.test.js` holding it there. Done the same day
  it was mapped because the window to Thursday was open.
- **The flight recorder and the boot self-test** (`flight-recorder.mjs`),
  asked for last: *"literally anything that goes wrong, you can have a report
  so you can action it straight away."* The server writes down every refusal
  with its reason, every phase a night reaches, every warning it prints and
  everything a phone or a console saw throw, per room; it plays a night
  against itself a second after every boot and puts the verdict on
  `/health`; and the Help tab reads it all back under *What the app saw
  tonight* with a Copy button. The pasted text is the bug report.
- **The owner reads any account's flight record** (`/api/flight?account=…`,
  the picker on the owner's Tonight tab), so a quizmaster's launch problem is
  read from the owner console — the host's standing rule that a fix for his own
  account is reachable for every other one.
- **A Render disk — the host reversed the 18 Sept decline**, so a deploy no
  longer wipes the running night. `DATA_DIR` is the whole wiring, no code
  change; the GitHub backup stays the source of truth, and Auto-Deploy stays
  off via the release train. His to switch on (the steps are on record).
- **The rude-photo check** (`rude-photo.mjs`), asked for: *"at the end of each
  night, any nakedness needs to be flagged so I can quickly delete the topless
  photos."* Google Cloud Vision SafeSearch scores each photo as it is filed,
  flagged ones sort to the front of the night's grid with a "Review" pill, and
  the bin is one tap. It flags, never deletes; it is inert until the host
  enables the Vision API. The three-showcase-with-overlay export he also asked
  for was already built (`showcaseSaveInto`).
- **The UI redesign is on the list** (`todo/console.md`), blocked on his visual
  direction: the dated look is neon-on-black, the fix is mostly a token
  re-skin of the console and sales page, and the projector stays a dark stage.

Both deploys were confirmed live by `/health` answering with the new
`streams` and `rss` fields.

**Everything from 25 August 2026 back is in
[`docs/history/august-2026.md`](history/august-2026.md)**, moved whole on 18
September when this file passed its bucket limit — newest first, unchanged.

## From TODO.md

## What is new since you last read this

### The topical quiz, and the ladder it settled

**One button: "The month just gone."** It reads the last month off the web and
writes forty questions from it — 20 news and 10 music from the month, then 10
music from any era so the pack is not all one thing and does not punish
anybody who was on holiday. Named after the date, marked current for a
fortnight. Tick "Harder than usual" for the second, harder one; the two are
filed separately so they do not collide.

**It costs about £2 a pack** (£1.20 to £3.90 depending on how much the checker
thinks), measured rather than guessed. The checking pass is 86% of that; being
topical only adds about 26p.

**That measurement set Bronze / Silver / Gold**, on your own observation that
the one-off packs and the topical ones are different animals — an evergreen
pack is an asset written once, a topical one is a service written every week.
So Silver is the whole evergreen catalogue and **Gold is the weekly topical
quiz**. Gold is sellable now; it used to be streaming and nothing else, which
made it Silver at a £10 markup.

The arithmetic that makes it a ladder: Silver at £20 plus four topical packs at
£3 is £32, which is **more than Gold at £30** — so a Silver subscriber who
wants topical weekly has an unambiguous reason to climb, and it arrives every
week rather than in month four. There is a test that this holds.

**What it commits you to is a weekly deadline, not money.** The writing is a
button press and £2; the read-through is twenty minutes, every week, for as
long as one Gold subscription exists. That is the only part of the arrangement
that cannot be undone by editing a line in `plans.js`.

### Two things worth reading in this file

- **Group accounts** (below, under "Asked for, not yet specced") — seats on a
  Gold for a quizmaster company, and why the interesting half is internal pack
  distribution rather than the discount.
- **A shared login can end somebody else's night** — a real bug, reachable
  today, small to fix.


- **A "My account" tab** on the console — your name, your colours, what tier you
  are on, every feature laid out by tier with a switch on each, and links to your
  control view, your big screen and your join page all in one place.
- **You can look at the console as a Bronze, Silver or Gold subscriber.** Put
  the quizmaster hat on and the switch grows **All · B · S · G** next to it —
  tap a letter and you see exactly what somebody on that tier sees, tabs missing
  and all. It is a real downgrade, not a preview: the API refuses what that tier
  cannot do, so anything broken for a subscriber breaks for you too. Tap **All**
  to go back to everything. Taking the hat off clears it.
- **Three tiers: Bronze (Basic), Silver (Elite), Gold (Pro)**, and they stack —
  Gold includes Silver includes Bronze. On the owner page each quizmaster now has
  a Bronze / Silver / Gold picker instead of a row of add-ons.
  **⚠️ Which feature sits on which tier is a first guess, and so are the prices**
  (Silver £15, Gold £30). Moving one is a one-line change — tell me where you
  want them and I will shuffle them.
  **What a quizmaster can and cannot do there:** they can switch OFF anything on
  their own tier, which makes it disappear from their console. They cannot switch
  ON anything above it — that is yours to grant from the owner page, and it stays
  that way until payments are wired up.
- **The app is called Quizporium**, and each night is branded from whoever is
  running it — your projector says **"Mark's Quizporium"**, Rob's says **"Rob's
  Quizporium"**. First names only, the way you say it on the mic. ⚠️ If you have
  `BRAND_NAME` set on Render from before, that still wins over all of it and you
  will see the old name — clear it to get this.
- **Your own two colours.** Six of them (Sunset, Orchid, Lagoon, Ember, Citrus,
  Ultraviolet), at the bottom of the console under **Your colours**. Tap one and
  your projector and every phone in your room change straight away. It is on the
  ACCOUNT, so Rob can have his own and yours is untouched. A themed night —
  Halloween, Valentine's — still wins over it, and the four answer colours never
  change, because those are how a player matches the big screen to their phone.
- **An Owner | Quizmaster switch** in the top right of the console and the owner
  page, one tap either way, replacing the button that was buried on the owner
  page. The live half is a solid block of colour so you can never be unsure
  which hat is on. Switching cannot disturb a night that is running — the two
  hats are two separate rooms.
- **A second quizmaster can have a login.** Rob gets his own running game, so
  he cannot launch over your gig — that used to be one shared game and it was
  the reason you could not hand anyone a login. He gets his own join code, his
  own photo wall, and read-only use of your packs.
- **Accounts survive a restart** (as long as the private repo is set up), and
  you can make your first owner account from the Console instead of needing a
  command line.

- **The winner's face on the big screen** — whoever answers first gets their
  picture up next to "Fastest finger" on the reveal. If they have sent a photo
  in tonight it is that; if they have not, it is a little cartoon face drawn
  from their team name, so there is never an empty gap. The same team always
  gets the same face all night.
- **Round 2 pictures cost a lot less.** A portrait is now filed under the
  MUSICIAN rather than under the quiz, so once you have paid for Madonna once
  she is free in every quiz after that. The Pictures panel tells you before you
  press anything: *"6 already in the library, free · 4 to draw — about 16p"*.
- **Picture style and quality** on the same panel. Style is Portrait, Cartoon
  or As a superhero. Quality is low / medium / high — it was never being set at
  all before, so everything was being made at the dearest setting. Medium now.
  Bear in mind each style is a whole separate set of pictures, so a superhero
  round is a fresh bill even for people you already have.
- **Props on the photos** — dog ears, clown nose, party hat, nine of them. Tap
  one, drag it onto the face, pinch to size it. The black-and-white sort of
  filter is still there, folded away under "Change the colour instead".
- **Photos get the middle of the screen** for about three and a half seconds
  before joining the strip along the bottom, which is bigger too.
- **A guard on revealing early** — the same button pressed twice in a blink
  only counts once, and it refuses to reveal in the first three seconds with a
  note saying why. The clock still reveals on its own when it runs out.
- **You can see who keeps leaving the app** mid-question, on your own screen
  only. Nothing on the projector and nothing on their phone. It is a note, not
  an accusation — a phone call looks exactly the same — so it only badges
  somebody from three questions onwards. What you do about it is your call.
- **First letter round** — no options at all: the room gets a keyboard and only
  the first letter of the answer has to be right, so nobody loses a point to
  spelling.
- **A number of questions per round type** — fifteen general knowledge and five
  pictures rather than ten of everything.
- **Four ways for a round 2 picture to give itself away** — zoom out, pixelate,
  come into focus, or tiles coming away. Set per round in the Editor, or `mix`
  for a different one each question. They all get easy at the same rate, so
  which you pick never changes how many points are on offer.
- **Seasonal looks** — a **Look** picker on every pack card next to Launch:
  Halloween, Valentine’s, Christmas, Summer. Changes the colours on the big
  screen and every phone at once. Nothing about how the quiz plays changes.
- **Invoicing** — see step 3 above.
- **Accounts** — see step 2 above.
- **Room for 300 players**, measured rather than guessed, and much faster than
  it was.
- Pictures and Playlist buttons on pack cards, photos from the room, advert
  slides, the rules slide, scores on the big screen, pick-them-all rounds.

---
