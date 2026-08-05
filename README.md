# Music Quiz

A live interactive music quiz for pubs and clubs. You put the big screen on a
projector, players join with their own phones by scanning a QR code, and you
run the whole thing from a private control view that only you can see.

Built to be boring and reliable: plain Node, **no dependencies**, no build step,
no database. Quizzes are JSON files you can read and edit.

---

## The night, in short

1. Laptop into the projector. Open **`/screen`**.
2. Control view open on your phone: **`/host?key=…`**.
3. Room scans the QR code, types a team name, and plays.
4. Three rounds of ten. Twenty seconds a question. Leaderboard, then a winner.

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
| **`/screen`** | the room | Join QR, question, options, timer, reveal, leaderboard, winner |
| **`/play`** | each player's phone | The four options only — never the question text |
| **`/host?key=…`** | you, and only you | Answer key, the round 3 track cue, start/reveal/next, skip, redo, team fixes |
| **`/editor?key=…`** | you | Read and fix every question before the gig |

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

84 tests, no network, no waiting on clocks — every timestamp is injected, so
a "twenty second question" runs instantly and identically every time. They
cover the scoring maths, the question state machine, crash recovery, and the
rule that nothing sensitive reaches the big screen.

---

## How it is put together

```
server.js              routing, SSE, static files
src/engine.js          the state machine: phases, players, answers, the three views
src/scoring.js         the scoring maths, pure and testable
src/store.js           crash recovery — atomic JSON snapshot
src/quizzes.js         loading, validating and saving quiz packs
src/qrcode.js          QR encoder, written out so there are no dependencies
src/sse.js             the live connection to every screen and phone
public/                the four screens: plain HTML, CSS and JS, no build step
quizzes/*.json         one file per quiz
images/                round 2 pictures
data/state.json        the live quiz, rewritten as it runs
```

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
| `QUIZ_DIR` / `DATA_DIR` / `IMAGE_DIR` | `./quizzes`, `./data`, `./images` | |

---

## What it deliberately does not do

- **No profanity filter on team names.** Rude names go on the big screen exactly
  as typed — that is half the fun of a pub quiz. Names are only trimmed to 28
  characters so one team cannot blow up the leaderboard, stripped of invisible
  control characters, and escaped so nobody can inject markup into the projector.
- **No accounts, no logins, no cookies.** A player id in the phone's local
  storage, and that is the lot.
- **No analytics, nothing phoning home.**
