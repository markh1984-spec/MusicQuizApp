# Music Quiz & Bingo

Live pub games run from your laptop. The big screen goes on a projector,
players join with their own phones by scanning a QR code, and you run
everything from a private control view only you can see.

Two games so far:

- **Music Quiz** — three rounds of ten, twenty seconds a question, fastest
  fingers win.
- **Music Bingo** — you play the tracks from your DJ app, every phone gets its
  own card, and the big screen keeps a call sheet of what has gone.

Built to be boring and reliable: plain Node, **no dependencies**, no build step,
no database. Everything you save is a JSON file you can read and edit.

---

## The night, in short

1. Laptop into the projector. Open **`/screen`**.
2. On your phone, open **`/console?key=…`** and launch a game.
3. Room scans the QR code and types a team name.
4. Run it from **`/host?key=…`**.

---

## Running it on your own laptop

You need [Node.js](https://nodejs.org) 20 or newer. Nothing else to install —
there are no packages to download.

```bash
npm start
```

It prints four addresses, including your host key:

```
Big screen   http://localhost:3000/screen
Players      http://localhost:3000/play
Your control http://localhost:3000/host?key=amber-jukebox-marble-47
Editor       http://localhost:3000/editor?key=amber-jukebox-marble-47
```

To put it on the internet so people's phones can reach it, see **[DEPLOY.md](DEPLOY.md)**.

---

## The four screens

| Screen | Who sees it | What is on it |
|---|---|---|
| **`/console?key=…`** | you | Launch a game, your whole library, past nights, the generator |
| **`/screen`** | the room | Join QR, the game itself, leaderboard or call sheet |
| **`/play`** | each player's phone | Four options, or their own bingo card |
| **`/host?key=…`** | you, and only you | Answer key, the round 3 cue, the bingo track list, all the controls |
| **`/editor?key=…`** | you | Read and fix every question and track list before the gig |

### Why the phones do not show the question

The question is on the big screen. That keeps the room looking up at you rather
than down at their laps, and makes googling an answer that bit more awkward.

### The two-screens rule

Round 3 is "name that intro" — you play the track from your own music app while
looking at your control view for the cue. The room is looking at the same
projector you are. So **the track title and artist are never sent to the big
screen at all**. Not hidden with CSS — the server builds a different payload for
each connection and the big screen's simply does not contain those fields.

There are tests that check this, in `test/engine.test.js`.

---

## Scoring

- **100** for a correct answer
- **+10** for every whole second left on the clock
- **+100** for the first *correct* answer of the question

So a correct answer with fourteen seconds left is **240**, or **340** if you got
there first. A fast wrong answer never takes the bonus, so button-mashing does
not pay.

The server times everything. Phones send only which option they tapped.

---

## During a gig

Everything is on the control view, with one big button that always does the
obvious next thing.

- **Skip** — bin the current question entirely. Any points it awarded are taken
  back. For when a question turns out to be wrong.
- **Redo** — run it again from the top with a fresh clock. For when the PA cut
  out or the projector dropped.
- **Back** — step backwards if you overshoot.
- **Tap any team name** — adjust their score, rename them, or remove them.

**If the server restarts mid-quiz**, everything comes back: teams, scores, and
the question you were on. You do not restart from question one.

**If a phone drops off**, they reopen the link and are back as the same team
with the same score. Latecomers can join partway through.

---

## Building a quiz

### Write it with Claude

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node scripts/generate-quiz.mjs --decade 1990s
```

Writes `quizzes/1990s.json`. Costs a few pence. British charts and British
spelling are baked into the prompt.

Options: `--decade`, `--id`, `--title`, `--rounds text,image,intro`,
`--questions 10`, `--hard`.

### Then read every word of it

```
/editor?key=…
```

**This is not optional.** Claude is good at this and still gets things wrong,
and a wrong answer in front of a paying room is the worst thing that can happen
in this project. The editor lets you fix wording, move the correct answer, bin
a question and write your own.

The editor writes the same JSON files the app plays from — there is no import
step. Press **Check** to catch the mistakes that actually hurt: no correct
answer marked, two identical options, a picture question with no picture.

> On a host like Render the filesystem is wiped on redeploy. Use the editor's
> **Download** button, drop the file in your local `quizzes/`, and commit it.

### Pictures for round 2

```bash
# free stand-ins, no API key, works immediately
node scripts/generate-images.mjs --quiz 1990s --placeholder

# real artwork (needs OPENAI_API_KEY, roughly 3-4p an image)
node scripts/generate-images.mjs --quiz 1990s --provider openai
```

Anthropic has no image generation API, so a Claude key cannot make these —
Claude writes the *prompts*, something else draws them. The app does not care
where the files came from: drop your own pictures into `images/` with the right
filenames and they just work.


---

## Music bingo

You play the tracks from your own DJ app. The app hands out the cards, keeps
the call sheet on the big screen, and checks the claims.

**Running it:** launch a bingo pack from the console, then tap each track in
your control view as you play it. That is the whole job. The big screen shows
what you just played, and an **alphabetical call sheet** of everything so far —
alphabetical rather than in play order, because half a pub is there for a
drink and is scanning for "have they done Africa yet?".

**Players** tap a square when they hear it. A square they have marked turns
**green** once you have actually played that track, and **amber** if you have
not — so a team that taps the wrong thing can see it before they shout.

**Winning:** the BINGO button lights up when they have marked a full line. The
server then checks it against what you genuinely played. A line with a track
you never played is a false alarm, recorded as one, and the game carries on.
After a line you can play on for a full house.

### Cards cannot be regenerated

This is deliberate and it is enforced on the server, not in the phone:

- A card is built **when the phone joins** and stored against that player.
- Refreshing, reopening the link, clearing the browser or rejoining all return
  **the identical card**.
- There is **no endpoint that issues a new card**, and no card-generating code
  on the phone at all.
- Every card in the room is different.

A new round (your "New round" button) is the only thing that reissues cards,
and it does it for everybody at once.

---

## Building a bingo round with one button

In the console, type a theme and press **Build it**. Then:

1. Claude picks the songs, and is told what you have played recently so it
   does not suggest it.
2. Anything that slips through is filtered out against your history file.
3. Each track is looked up **on Spotify**, so what ends up on the cards is what
   your DJ app can actually play — not a title a model invented.
4. A private Spotify playlist is created and filled, ready to open.
5. The pack lands in your library, and every track goes into the history.

Needs `ANTHROPIC_API_KEY`. Spotify is optional — without it you get the pack
but no playlist. Setting Spotify up is a one-off:

```bash
node scripts/spotify-login.mjs
```

It walks you through making a free Spotify app and prints three values to put
in your host's settings. See [DEPLOY.md](DEPLOY.md#spotify-for-the-bingo-playlists).

### No repeats

Every generated track is recorded with the date, and the generator refuses to
reuse anything inside your chosen window (three months by default, adjustable
from no limit to a year). Matching is loose, so *Take On Me*, *take on me* and
*Take On Me (Remastered 2017)* all count as the same record.

> **This memory lives in the `data/` folder, which most hosts wipe on every
> deploy.** If you want it to survive, either add a Render Disk mounted at
> `data/` (about 20p a month, needs a paid instance) or generate your packs on
> your own laptop, where the file stays put. Without one of those the
> no-repeats rule silently resets to nothing every time you push a change.
> See [DEPLOY.md](DEPLOY.md#something-important-about-files).

---

## Your library

Everything you have ever saved is on the console, with how many times you have
run it and when you last did. A Harry Potter quiz written in March is one tap
away in November — that is the whole reason packs are files rather than
something typed in fresh each time.

Finished games are archived under **Past nights** with the final scores.

---

## Seeing the screens without running a quiz

```bash
npm start                                    # in one terminal
node scripts/shots.mjs --key YOUR_HOST_KEY   # in another
```

Drives a headless browser through a whole quiz — teams join, answer at
different speeds, you advance — and saves a screenshot of every screen at every
stage into `screenshots/`. Needs Playwright (`npm i -g playwright`), which is a
tool for you, not part of the app.

`scripts/shot-rounds.mjs` does the same for rounds 2 and 3 specifically,
including the zoom part-way through.

---

## Tests

```bash
npm test
```

127 tests, no network, no waiting on clocks — every timestamp is injected, so
a "twenty second question" runs instantly and identically every time. They
cover the scoring maths, the question state machine, crash recovery, the rule
that nothing sensitive reaches the big screen, the bingo card anti-cheat
guarantees, and the no-repeats history.

---

## How it is put together

```
server.js              routing, SSE, static files
src/session.js         which game is running; the server talks only to this
src/engine.js          the quiz: phases, players, answers, the three views
src/bingo.js           bingo: cards, calls, claims
src/scoring.js         the quiz scoring maths, pure and testable
src/store.js           crash recovery — atomic JSON snapshot
src/quizzes.js         loading, validating and saving quiz packs
src/library.js         your saved packs, play counts and past nights
src/history.js         what you have played, so the generator stops repeating
src/generate-bingo.js  theme in, playable pack out
src/spotify.js         playlist building
src/qrcode.js          QR encoder, written out so there are no dependencies
src/sse.js             the live connection to every screen and phone
public/                the screens: plain HTML, CSS and JS, no build step
quizzes/*.json         one file per quiz
bingo/*.json           one file per bingo pack
images/                round 2 pictures
data/                  live state, play history, archived nights
```

### Adding another game

`src/session.js` holds whichever game is running and gives the server one
shape to talk to: `screenView()`, `playerView()`, `hostView()`, `run(action)`.
A new game means writing an engine with those methods, adding it to
`LAUNCHERS`, and giving the screens a set of cards. Nothing else needs to know
it exists.

**Server-sent events, not websockets.** SSE is ordinary HTTP, so it survives pub
wifi, mobile data and whatever proxy a venue has in front of it, and browsers
reconnect on their own when a phone comes back from being locked.

### Quiz pack shape

```jsonc
{
  "id": "eighties",
  "title": "The 1980s Music Quiz",
  "questionSeconds": 20,
  "rounds": [
    {
      "type": "text",              // text | image | intro
      "title": "Round One — The Eighties",
      "questions": [
        {
          "prompt": "Which band released the 1985 album 'Brothers in Arms'?",
          "options": ["Dire Straits", "Simple Minds", "Tears for Fears", "Genesis"],
          "correctIndex": 0,       // 0-based
          "answerNote": "The first album to sell a million copies on CD.",
          "note": "host-only note",

          // picture rounds
          "image": "eighties/madonna.png",
          "imagePrompt": "…for the image generator",
          "zoomFrom": 6,

          // intro rounds — never sent to the big screen
          "cue": { "title": "Billie Jean", "artist": "Michael Jackson",
                   "from": "0:00", "hint": "let the intro run 8 seconds" }
        }
      ]
    }
  ]
}
```

### Adding a round type

A round is a plugin. To add one:

1. Add its name to `ROUND_TYPES` in `src/quizzes.js`.
2. Add a case to `screenQuestionExtras` (what the room sees) and
   `hostQuestionExtras` (what only you see) in `src/engine.js`.
3. Add a media block in `renderQuestionMedia` in `public/assets/screen.js` and a
   `.type-yourtype` rule in the stylesheet.

Nothing else needs to know about it.

### Settings

All optional — it runs with none of them set.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | 3000 | |
| `HOST_KEY` | generated once, kept in `data/` | Password for the control view and editor |
| `PUBLIC_URL` | worked out from the request | Only needed if you put your own domain in front |
| `QUIZ_ID` | first quiz found | Which quiz loads on a cold start |
| `QUIZ_DIR` / `BINGO_DIR` / `DATA_DIR` / `IMAGE_DIR` | `./quizzes`, `./bingo`, `./data`, `./images` | |
| `ANTHROPIC_API_KEY` | — | Needed to generate quizzes and bingo rounds |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REFRESH_TOKEN` | — | Needed to build Spotify playlists. `scripts/spotify-login.mjs` gets you these |

---

## What it deliberately does not do

- **No profanity filter on team names.** Rude names go on the big screen exactly
  as typed — that is half the fun of a pub quiz. Names are only trimmed to 28
  characters so one team cannot blow up the leaderboard, stripped of invisible
  control characters, and escaped so nobody can inject markup into the projector.
- **No accounts, no logins, no cookies.** A player id in the phone's local
  storage, and that is the lot.
- **No analytics, nothing phoning home.**
