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

- **Music quiz** — rounds of 10 questions, 20 seconds each. Four round types:
  text, image, intro, and **multi** ("pick them all").
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

### 3. Only a real removal throws a phone out

A phone whose id the server does not recognise is asked to **rejoin silently**
(`view.rejoin`). It is told it was removed (`view.kicked`) **only** if the host
actually removed it — which is why removals are written into `state.removed`
rather than inferred from the player being absent.

Absent has many causes and only one of them is a kick: a redeploy, a restart on
a host with no permanent disk, a fresh game launched over a full lobby. Those
used to throw the whole room out mid-question and wipe their team names.
`kicked` wipes localStorage on the phone, so getting this wrong is not
cosmetic. Do not reintroduce "no player found, therefore kicked".

Related, and the thing that made it recur: a `Live` carries the player id in
its URL, so replacing one **must** call `live.stop()` first. It used to only
close the stream and leave the keep-alive timer running, which reopened the
old stream under the old id forty seconds later. Every rejoin left another one
behind, all of them claiming to be someone the server no longer had.

### 4. Bingo cards cannot be regenerated
The card is built server-side on join and stored against the player. There is
**no endpoint that issues a new card** and no card-generating code on the
phone. Refresh, reopen, clear the browser, rejoin — same card. Do not add a
"new card" feature; the host asked for this explicitly to stop cheating.
`newRound()` is the only thing that reissues, and it does everyone at once.

### 5. Crash recovery
State is one JSON object written atomically. Anything that **moves a game
forward** flushes to disk immediately (new question, reveal, round change, a
team joining, a bingo track called, a bingo square marked). Only high-frequency
low-stakes things are debounced.

Bingo marks are deliberately immediate: a lost quiz answer is recoverable with
Redo, but nobody can re-tap ten songs they heard half an hour ago.

### 6. Phones never show the question text
Only the options. Keeps the room looking up, makes googling harder.

### 7. "Pick them all" tells the room HOW MANY, never which
A `multi` question shows six options with 2–3 correct. The screen and the phone
get `pickCount`; `correctIndexes` is host-only, like every other answer key.

Part marks — the share you got right, applied to the base AND the seconds left,
so a fast mostly-wrong answer cannot out-earn a slower right one. The
first-correct bonus needs the **whole** set. Exactly N picks is enforced server
side and refused rather than trimmed, or somebody covers the board and scores.

---

## Decisions already made — do not relitigate

| Decision | Why |
|---|---|
| **No dependencies at all** | Every dependency is something that can break on a gig night. QR encoding is written out in `src/qrcode.js` rather than installed. |
| **SSE, not websockets** | Ordinary HTTP survives pub wifi, mobile data and venue proxies; browsers reconnect on their own. |
| **No build step** | Plain HTML/CSS/JS. Mark comes back to change this between gigs. |
| **Packs are JSON files** | That is what makes a quiz reusable months later and the editor simple. No database. |
| **No profanity filter on team names** | Explicitly requested. Rude names go on the projector as typed. Only control characters stripped, 28-char cap, HTML escaped — that is anti-breakage, not censorship. **Do not add word filtering.** |
| **Photo uploads auto-publish** | Host decided; he will handle the room with the mic. There is a kill switch and a per-photo bin in `src/photos.js` and **no approve step anywhere**. Do not add one. |
| **Photos are never backed up to git** | Everything else saved is a pack worth having in six months. These are pictures of members of the public and the repo is not the place for them. They live for the night. |
| **Filters are pixel maths, not `ctx.filter`** | `public/assets/filters.js`. Older iOS does not implement `ctx.filter`, and a filter that silently does nothing on a third of the room is worse than none. The preview and the upload go through the same function so they cannot drift. |
| **No Instagram follow-for-points** | No API can verify a follow. Told the host; he agreed to drop it rather than fake it. |
| **British spelling and UK chart references** | Crowds are Essex, Kent and Surrey. This is in the generation prompts too. |
| **Deploying on Render** | Chosen by the host. Serverless (Vercel/Netlify) is wrong — the app holds a live connection to every phone all night. |
| **Alphabetical bingo call sheet** | Not play order. Half the room is drinking and scanning for "have they done Africa yet?". |

---

## Generated questions are checked, not trusted

`src/generate-quiz.js` runs two passes:

1. **Write** — asks for `perRound + 4` questions, so there is slack.
2. **Check** — a separate call, framed as checking somebody else's work, told
   to assume there are mistakes. It only ever REJECTS; it never rewrites,
   because a rewrite would itself be unchecked. Failures are discarded and the
   survivors kept.

A question the checker does not mention is treated as **unchecked, not passed**
— silence is not approval.

On top of that, `reviewWarnings()` in `src/quizzes.js` catches the mechanical
version of the same faults with no API call, and is shown when reading a pack.
Each flag can be ticked off as the host reads through it; the tick is stored as
`question.checked` in the pack itself, so it survives a restart, a backup and a
different device. Flag ids are built from the kind of warning and what set it
off — never from the question's position — so a tick outlives renaming and
reordering rounds. Rewrite the question and the old flag stops applying while
any new one arrives unticked, which is the point: a tick means "I read this
wording", not "leave me alone about this question".

All of this exists because the first generated quiz shipped a question where a
wrong-marked option was defensible AND the fact printed on screen proved it.
Do not remove or weaken these without understanding that.

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
src/photos.js          photos from the room: store, kill switch, bin
src/generate-images.js round 2 artwork (placeholder or OpenAI)
public/                the screens; *-bingo.js files hold the bingo variants
quizzes/ bingo/        the library
data/                  live state, history, archived nights (gitignored)
```

### Adding a game
1. Write an engine exposing `screenView()`, `playerView()`, `hostView()`,
   `join()`, `results()` — see `src/bingo.js` for the shape
2. Add it to `LAUNCHERS` in `src/session.js`
3. Add a card set for the big screen and a branch in `play.js` / `host.js`,
   following the `*-bingo.js` files
4. Add one entry to `TABS` in `public/assets/console.js` — that gives it a tab,
   a generator slot and a pack grid with nothing else to write

Nothing outside those four places needs to know it exists.

### Adding a quiz round type
1. `ROUND_TYPES` in `src/quizzes.js`, plus any per-type validation
2. a case in `screenQuestionExtras` **and** `hostQuestionExtras` in `src/engine.js`
   — think about which fields are secret
3. a media block in `renderQuestionMedia` + a `.type-x` CSS rule
4. a brief in `roundBriefs()` in `src/generate-quiz.js`, a checkbox in the
   console generator, and an entry in `ROUND_TYPES` in `public/assets/editor.js`

**A type that changes the answering mechanic touches more than that.** `multi`
needed `answer()` to take a set, `session.runPlayerAction` to forward it (it
silently dropped the new field at first), a scoring function, and the editor to
switch from radios to tickboxes.

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

All five build stages plus bingo, the console, generation, pack import and the
tickable review flags are done, tested and pushed to **`MusicQuizApp`**.
Nothing is half-finished in the tree. 176 tests green.

(An earlier version of this line named `claude/new-session-jzx988`. That branch
is gone — see **Where to push**.)

Outstanding work is all on the host's side — see **TODO.md**. Short version:
an OpenAI key for the round 2 portraits, and the one-time Spotify login. Both
optional; the app runs a full quiz and a full bingo night without either.

Designed for but deliberately not built: photo uploads, filters, semi-automated
social posting, team play, venue branding. The data model and screen layout
already have room for them (rounds are plugins, the big screen is a card
registry, outbound posting is meant to be a queue with adapters).
