# A DJ set — the photograph is the ticket

`src/dj.js`, `public/assets/play-dj.js`, `host-dj.js`, `dj-door.js`,
`public/dj.html`, `node scripts/dj-set.mjs`.

Asked for on 14 September 2026, in his own words:

> *"I've recently realised that the photo part of Quizporium would be really
> useful as a stand-alone app for my DJing. When I'm DJing I just have a QR
> code on the screen. People upload their photos, and then that unlocks the
> ability for them to give requests."*

And the correction that decided the build:

> *"My DJ app reads off of title rather than Spotify."*

---

## Why it is one codebase and not two

He asked whether it should be standalone, and the honest answer was found by
looking rather than by preference: **photographs live on the ROOM, not on the
game** — `this.photos = new Photos(paths.photos)` in `rooms.js` — and
`POST /api/photo` resolves its room from the join code, reads the player off
`session.engine.state.players` and calls `photos.add()`. **It needed no
change at all.**

So the entire photo half of the product — the camera sheet, the props, the
upload, the compression, the wall on the projector, the gallery, the private
repo, the cache — arrived for nothing. A second app would have re-earned all
of it, and would then have two copies of the one thing in this repo that must
never have two copies.

**The PRODUCT is still standalone**, which is what he actually wanted: its own
address, its own screen, nothing on it about quizzes. `/dj` is that door and
it is deliberately not on the console's game picker.

**Porting it out later is cheap and stays cheap** precisely because of the
seams: the engine is one file behind `LAUNCHERS`, the routes are one prefix,
and the three screens are one module each. The expensive thing to undo would
have been sharing a *database*, and there isn't one.

## The mechanic, and the two numbers in it

- **A photograph is a GATE, not a currency.** `unlocked()` asks whether there
  has ever been one. A second photograph buys nothing, and **no screen may
  say it does** — the phone's copy was written that way first and corrected
  before it shipped.
- **Three requests WAITING, freed as they are played** (`REQUESTS_EACH`).
  Played and binned both free a slot, which is why the phone says *"three
  waiting with the DJ"* rather than *"that's your three"*.
- **`MAX_REQUESTS` is a safety number**, like `MAX_TEAMS` and `MAX_SEATS` —
  not a design one.

## What is never on the big screen

**Rule 1, and its sharpest case in the whole app.** A queue on the wall is a
list of songs the room can watch the DJ not play, and the first rude title
somebody types would be six feet wide in front of everybody — with no filter,
because this app deliberately has none in the room.

`screenView()` does not carry requests at all, so the guarantee is structural
rather than a matter of remembering. `scripts/dj-set.mjs` asserts a real
request's words are absent from the projector's DOM after it lands.

The projector gets the code and the photographs. `PHOTO_PHASES` gained `set`
on both the screen and the phone: there is no question for a photograph to
wait behind, so the wall runs all night.

## Spotify is the fast path; typing is the floor

His DJ software reads off the TITLE, so **a typed request is a first-class one
and not a degraded one** — which is also what keeps the feature working in a
venue whose wifi cannot reach Spotify, or on a night the token has expired.

- **Searching is a POST, and that is about the CREDENTIAL rather than REST.**
  It carries the phone's token, and a token in a query string is a token in a
  log, in browser history and in a `Referer` header.
- **It is behind the same proof as a request, minus the unlock.** Every phone
  in the room searches through the DJ's ONE Spotify token, so a route open to
  anybody is a free Spotify proxy with his name on the bill.
- **Not configured is SAID OUT LOUD** (`configured: false`), never a silent
  empty list — which would read as *"your song is not on Spotify"*, a lie
  about the venue's wifi. `import-intro.js`'s `fellBack` rule wearing another
  hat.
- **`searchTracks()` caches for 30 seconds**, because a room of sixty typing
  "beyonce" is sixty identical calls.

## The desk

**Copy-and-play is the job, and the copy button is the feature** — getting
`Artist — Title` into a search box in somebody else's application with one
press, in a dark booth, with a record running out.

- **The line is worded on the SERVER** (`hostView()`), so the queue, a future
  setlist and anything else that ever prints a request cannot word it two
  ways.
- **`navigator.clipboard` needs a secure context**, which a laptop plugged
  into a venue's screen may not have — so the fallback selects the text and
  **the button says *Selected* rather than *Copied***. A button claiming it
  copied when it has not is this repo's commonest fault.
- **Played and Bin are two buttons with two meanings**, both recorded: one
  frees the asker's slot as a reward, the other as a refusal, and the archive
  of the night is then honest about what was asked for and what went on.
- **The queue is oldest-first and the played list is newest-first.** A queue
  is worked from the top; a history is read from the newest, because it is
  what answers *"did you play mine?"*.
- **No queue position on the phone, deliberately.** The DJ plays what fits the
  floor, so a number would be a promise the app cannot keep — and somebody
  watching it not move is somebody who came to dance and is reading their
  phone.

## What adding a third game found

Every one of these was silent, and none was caught by 1,955 unit tests.

- **`touch()`, which `/api/stream` calls for every phone that connects.**
  Without it the SSE route threw and **every phone got a 500 instead of a
  live connection** — the game completely dead, with every payload correct
  when asked for directly. Found by opening the page in a real browser.
- **`playerList()`, which `inProgress()` counts** before anything may launch
  over a running game — so starting a second set, or launching a QUIZ over
  one, threw on the protected launch path.
- **`perGame` read `quiz ? {…} : {…bingo}`**, so a DJ set inherited bingo's
  whole control view — `call`, `newRound`, `playOn`, each a 500 from a button.
  **Two games is the only arrangement in which "the other one" names
  anything.**
- **The shared host dispatch asked for six more** — `removeIdlePlayers`,
  `setRewards`, `redeemVoucher`, `reinstateVoucher`, `resetAll`,
  `renamePlayer` — plus the phone's `arcadeScore`. Exactly what `bingo.js`
  paid for once.
- **`GAME_KINDS` and `LAUNCHERS` are held equal by a test**, and a DJ set is
  the one deliberate exception: named, and the name itself asserted to be a
  real launcher.
- **The join corner drew itself over the QR panel.** Its exemption list is of
  PHASES and answers *"is there room"*; the question is *"is the code already
  up"*, and a third game is what made the two come apart.
- **The projector printed "Music Quiz"** — the app's oldest fallback, right
  for two years.
- **`.minor` is scoped to `.host` and `.console`**, so on the door an
  `<a class="minor">` rendered as a bare underlined link.

**`test/engine-contract.test.js` is the durable answer**: the shared contract
is written down and asked of all three prototypes, and every `.engine.X(`
call site in `session.js` and `server.js` must be on that list or on a named
per-kind one — so the next one fails a test rather than a projector.

## Its own domain — `DJ_HOST`

Asked for as `dj.pubchampions.co.uk`. **One Render service can answer on
several domains**, so this is not a second service and does not cost a second
$7 — it is a CNAME and a custom-domain entry, plus one environment variable.

- **`DJ_HOST` names the host and nothing else** — no scheme, no path, because
  it is compared against the `Host` header, which carries neither.
  `config.js` strips all three anyway, so a pasted URL still works.
- **ON THAT HOST THE BARE DOMAIN IS THE DJ DOOR**, served rather than
  redirected. Without it, typing the DJ domain redirects to the console or the
  owner page — *a separate product handing you straight to a different one*,
  which is the exact fault the door's own sign-in had and was reported for:
  *"that just signed me into my quiz app."*
- **AND THE VISITOR'S HOST BEATS `PUBLIC_URL` THERE.** That variable pins the
  origin, which is right for a service on ONE domain and silently wrong the
  moment there are two: pinned, the join QR on the DJ screen would send a room
  standing in front of the DJ domain to the QUIZ domain — somebody else's
  branding, and on a phone with no cookie a sign-in page. **The QR is the
  entire product**, so it follows the domain the room is actually looking at.
- **UNSET IS THE NORMAL CASE and changes nothing.** `/dj` works on every
  domain either way, the quiz app's front door is untouched, and
  `pub-unchanged` says IDENTICAL.
- **Compared against the FORWARDED host**, because behind Render's proxy
  `req.headers.host` is the internal one — and **the port is stripped**, or a
  check that only works in production is one nobody can test.

**A second Render service is still the answer to a different question** —
wanting the DJ set to keep running while the quiz app is down, or to sell it
to somebody who must never see Quizporium. Neither is true today.

## Not built, deliberately

- **No pricing and no gate.** `/api/dj/*` asks only that you are signed in.
  What a DJ set costs is a question nobody has answered, and gating it on
  `FEATURES.QUIZ` today would answer it by accident, in the hardest place to
  find later.
- **No name.** `APP_NAME` in `dj-door.js` is one constant, marked as a
  placeholder.
- **Nothing about the set is archived beyond what `results()` returns** —
  `kind: 'dj'`, the headcount and the request counts, with an empty
  leaderboard so `league.js` drops it exactly as it drops a bingo night.
