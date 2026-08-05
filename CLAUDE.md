# Project notes for Claude

Read this before changing anything. It records what this is, the rules that
must not be broken, and the decisions already made — so a fresh session does
not undo work by accident or re-ask settled questions.

**Keep this file current.** When you make a decision that a future session
would need to know, add it here in the same turn.

---

## What this is

Live games for pub and club quiz nights, run by a professional host (Mark).
He is hired as the entertainer, never the organiser, so it runs on his kit in
someone else's venue in front of a paying room.

**Reliability beats cleverness everywhere.** If it is flaky on a Wednesday
night with sixty people watching, it is worthless. That single sentence
decides most arguments in this codebase.

Two games so far:

- **Music quiz** — 3 rounds × 10 questions, 20 seconds each, four options.
- **Music bingo** — host plays tracks from a DJ app, phones get cards.

---

## Rules that must not be broken

These have tests. If a change makes one fail, the change is wrong.

### 1. The two-screens rule
The projector and the host's phone show different things. The host reads their
cue off their own screen while the room looks at the projector.

**The answer key, host notes and the round 3 track cue are never in the big
screen's payload.** Not hidden with CSS — the server builds each role's
payload field by field from a whitelist (`screenQuestionExtras` vs
`hostQuestionExtras` in `src/engine.js`). A new sensitive field must be added
to the host view only.

### 2. The server owns the clock
Every timestamp used for scoring comes from an injected `now()`. Phones send
only which option they tapped. Never trust a client timestamp.

### 3. Bingo cards cannot be regenerated
The card is built server-side on join and stored against the player. There is
**no endpoint that issues a new card** and no card-generating code on the
phone. Refresh, reopen, clear the browser, rejoin — same card. Do not add a
"new card" feature; the host asked for this explicitly to stop cheating.
`newRound()` is the only thing that reissues, and it does everyone at once.

### 4. Crash recovery
State is one JSON object written atomically. Anything that **moves a game
forward** flushes to disk immediately (new question, reveal, round change, a
team joining, a bingo track called, a bingo square marked). Only high-frequency
low-stakes things are debounced.

Bingo marks are deliberately immediate: a lost quiz answer is recoverable with
Redo, but nobody can re-tap ten songs they heard half an hour ago.

### 5. Phones never show the question text
Only the four options. Keeps the room looking up, makes googling harder.

---

## Decisions already made — do not relitigate

| Decision | Why |
|---|---|
| **No dependencies at all** | Every dependency is something that can break on a gig night. QR encoding is written out in `src/qrcode.js` rather than installed. |
| **SSE, not websockets** | Ordinary HTTP survives pub wifi, mobile data and venue proxies; browsers reconnect on their own. |
| **No build step** | Plain HTML/CSS/JS. Mark comes back to change this between gigs. |
| **Packs are JSON files** | That is what makes a quiz reusable months later and the editor simple. No database. |
| **No profanity filter on team names** | Explicitly requested. Rude names go on the projector as typed. Only control characters stripped, 28-char cap, HTML escaped — that is anti-breakage, not censorship. **Do not add word filtering.** |
| **Photo uploads will auto-publish** | Host decided; he will handle the room with the mic. Build a manual kill switch, not an approval queue. |
| **No Instagram follow-for-points** | No API can verify a follow. Told the host; he agreed to drop it rather than fake it. |
| **British spelling and UK chart references** | Crowds are Essex, Kent and Surrey. This is in the generation prompts too. |
| **Deploying on Render** | Chosen by the host. Serverless (Vercel/Netlify) is wrong — the app holds a live connection to every phone all night. |
| **Alphabetical bingo call sheet** | Not play order. Half the room is drinking and scanning for "have they done Africa yet?". |

---

## Things the host does not have, and what that blocks

- **No image generation key yet.** Anthropic has no image API, so a Claude key
  cannot make round 2 portraits. Host agreed to OpenAI (~50p/quiz) but has not
  set it up. Round 2 runs on placeholder art until then.
- **Spotify not set up yet.** One-time developer app + `scripts/spotify-login.mjs`.
  Bingo generation works without it, just no playlist.
- **On Render's free tier**, by choice. Connected browser tabs ping `/health`
  every four minutes so the app cannot sleep mid-gig; the host's routine is to
  open the big screen five minutes early. Agreed to move to Starter ($7/mo)
  before the first paying gig.
- **No persistent disk** — Render disks need a paid instance and the host is on
  free. The no-repeats song history therefore survives by being **committed to
  git**: `.gitignore` tracks `data/track-history.json` while ignoring the rest
  of `data/`. The host generates packs at home and commits them.
  **If he reports songs repeating, first check whether he generated on the live
  site instead of locally** — that pack's history entries are lost on the next
  deploy.

---

## Working style he asked for

- Ask before assuming, especially anything costing money or needing an account.
- Explain deployment like he is doing it for the first time, because he is.
- Keep the code readable — he will be editing it between gigs.
- Show screenshots when building screens.
- Presentation matters: projected in a dark room to paying customers. Big type,
  high contrast, readable from the back.

---

## Layout

```
server.js              routing, SSE, static files
src/session.js         which game is running; the server talks only to this
src/engine.js          the quiz state machine and its three views
src/bingo.js           bingo: cards, calls, claims
src/scoring.js         quiz scoring maths, pure
src/store.js           crash recovery
src/quizzes.js         quiz packs: load, validate, save
src/library.js         saved packs, play counts, past nights
src/history.js         no-repeats memory for bingo generation
src/generate-bingo.js  theme -> Claude -> history filter -> Spotify -> pack
src/spotify.js         playlist building
src/qrcode.js          dependency-free QR encoder
public/                the screens; *-bingo.js files hold the bingo variants
quizzes/ bingo/        the library
data/                  live state, history, archived nights (gitignored)
```

### Adding a game
`src/session.js` exposes `screenView()`, `playerView()`, `hostView()`,
`run(action)`. Write an engine with those, add it to `LAUNCHERS`, give the
screens a card set. Nothing else needs to know it exists.

### Adding a quiz round type
1. `ROUND_TYPES` in `src/quizzes.js`
2. a case in `screenQuestionExtras` **and** `hostQuestionExtras` in `src/engine.js`
   — think about which fields are secret
3. a media block in `renderQuestionMedia` + a `.type-x` CSS rule

---

## Checks

```bash
npm test        # 127 tests, no network, injected clocks — must stay green
npm start       # then /console?key=... from the printed log
node scripts/shots.mjs --key KEY       # screenshots of a whole quiz
node scripts/shot-bingo.mjs            # bingo, incl. the card-reload check
```

Beyond the unit tests, these were run by hand and are worth repeating after
anything structural:

- 60 phones with live SSE connections all answering at once
- `SIGKILL` mid-quiz and mid-bingo, checking the right question/track and all
  scores, cards and marks come back
- QR output decoded with a real scanner (OpenCV) across versions 1–10

---

## The host's deployment

- Live app: **https://musicquizapp.onrender.com**
- Render service: `srv-d9pnk0e417fc73bvjdkg` (Frankfurt, free tier)
- Repo: https://github.com/markh1984-spec/MusicQuizApp

Render's newer UI nests the service inside a project. `/project/prj-…` is the
wrong level and its "environment groups" are unrelated to environment
variables; `/web/srv-…` is the right level. This cost the host a lot of
clicking — do not send him to the project page.

---

## Where to push

**There is one branch: `MusicQuizApp`.** It is the default and the only one.
There is no `main`. Render watches it, so anything not pushed there does not
reach the live app.

Push straight to it — the host asked for that rather than merging by hand.

**Do not create or push to `claude/new-session-jzx988` or any other session
branch.** It existed, it was identical, the host deleted it deliberately and
asked for the repo to stay tidy. Pushing a session branch would silently
recreate it.

---

## Current state

All five build stages plus bingo, the console and generation are done, tested
and pushed to `claude/new-session-jzx988`. Nothing is half-finished in the
tree.

Outstanding work is all on the host's side — see **TODO.md**.

Designed for but deliberately not built: photo uploads, filters, semi-automated
social posting, team play, venue branding. The data model and screen layout
already have room for them (rounds are plugins, the big screen is a card
registry, outbound posting is meant to be a queue with adapters).
