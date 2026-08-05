# Your to-do list

Every step has the link you need next to it. Work down it in order.

**Parts 1–3 are the ones that matter. Everything after that is optional.**

---

## Where the project is right now

The app is finished and pushed. Nothing is half-built, and nothing is waiting
on me. Everything left is on your side, and only two things cost money:

| | What | Where | Costs |
|---|---|---|---|
| 1 | Set your own `HOST_KEY` so bookmarks stop breaking | Part 2a | free |
| 2 | Read the questions before anyone else does | Part 3 | free |
| 3 | OpenAI key, so round 2 stops using placeholder drawings | Part 6 | ~£8 once, ~50p a quiz |
| 4 | Spotify login, so bingo builds its own playlist | Part 7 | free |
| 5 | Move to the $7 tier before the first paying gig | Part 10 | $7/mo |

3 and 4 are genuinely optional — the app runs a whole quiz night and a whole
bingo night without either. Round 2 just looks like placeholder art, and you
build the bingo playlist by hand.

**Newest since you last looked:**

- **Flags you can tick off** as you read a quiz through — Part 3a. This is the
  one that changes your evening.
- **Import a track list you already have** into a bingo pack, from a Spotify
  link or pasted text — Part 7e. Means your existing Claude-in-the-browser way
  of building rounds still works.

---

## Quick links — the ones you will use constantly

| What | Link |
|---|---|
| **Your live app** | https://musicquizapp.onrender.com |
| Your repository | https://github.com/markh1984-spec/MusicQuizApp |
| Render dashboard | https://dashboard.render.com |
| **Your service — environment variables** | https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env |
| **Your service — settings** | https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/settings |
| **Your service — logs** | https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/logs |
| Anthropic billing | https://console.anthropic.com/settings/billing |
| OpenAI API keys | https://platform.openai.com/api-keys |
| Spotify dashboard | https://developer.spotify.com/dashboard |

### Two levels in Render, and why it is confusing

Render wraps your service inside a **project**, and the two look similar:

| Address starts with | What it is |
|---|---|
| `/project/prj-…` | the **project** — wrong level. Its "environments" and "environment groups" are a different feature and not what you want. |
| `/web/srv-…` | the **service** — right level. This is where environment variables live. |

Your service is **`srv-d9pnk0e417fc73bvjdkg`**, and the links in the table above
go straight to it, so you never have to click through the project again.

Lost? Press **Ctrl+K** (or **Cmd+K** on a Mac) anywhere in the Render dashboard
and type `musicquiz`.

---

# PART 1 — GitHub ✅ done

Your branch is **`MusicQuizApp`** — it is the only one, and it is the default.
Wherever a guide online says `main`, yours says `MusicQuizApp`.

Nothing to do. 🔗 https://github.com/markh1984-spec/MusicQuizApp/branches

---

# PART 2 — Render ✅ mostly done

Service is created, in Frankfurt, on the free tier.

## 2a. Set your host key — DO THIS ONE NEXT

This is the password for your control view, console and editor. Anyone who has
it can see every answer, so it is worth choosing properly.

Right now the app has invented one for you, but a generated key **changes every
time the app redeploys**, so bookmarks break. Set your own and it stays put.

🔗 **https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env**

On that page find the section headed **Environment Variables** — *not*
**Environment Groups**, which is a different feature for sharing variables
between several services.

Click **+ Add Environment Variable** and fill in:

| Key | Value |
|---|---|
| `HOST_KEY` | three unrelated words and a number, e.g. `amber-tractor-cider-42` |

Then **Save changes**. Render redeploys itself, about a minute.

> **Cannot find the section?** Try the Settings page instead —
> https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/settings — and
> scroll to **Environment Variables**. Same effect.

> **Choosing the key:** not the venue name, not your Instagram handle, not
> "quiz". Three unrelated words is memorable, typeable one-handed in the dark,
> and not guessable by a bored punter.

## 2b. Your four addresses

Your app lives at **https://musicquizapp.onrender.com**

Swap `YOURKEY` for the host key you set in 2a:

| What it is | Address |
|---|---|
| **Console** — start here every time | `https://musicquizapp.onrender.com/console?key=YOURKEY` |
| **Big screen** — goes on the projector | https://musicquizapp.onrender.com/screen |
| **Control view** — your phone | `https://musicquizapp.onrender.com/host?key=YOURKEY` |
| **Editor** — checking questions | `https://musicquizapp.onrender.com/editor?key=YOURKEY` |

The big screen needs no key — it is meant to be looked at by a room. The other
three do, because they show the answers.

### Bookmark it so you never type a key again

The key is remembered on each device the first time you arrive with it in the
address. So do this once per device:

1. Visit **`https://musicquizapp.onrender.com/console?key=YOURKEY`** — the full
   version, with the key
2. Then **bookmark the plain version**, no key on the end:
   **https://musicquizapp.onrender.com/console**

From then on that bookmark just opens. Same trick works for
`/host` and `/editor`.

- [ ] Do this on your phone
- [ ] Do it on your laptop too

If a key ever stops being accepted, the page gives you a box to type the new
one in rather than an error you cannot get past.

## 2c. Keep what you make on the live site — you have already done this

**Already set up.** Written down because nothing else records it, and if you
ever rebuild the service you will need it again.

The live app has no permanent disk on the free tier. Anything generated or
edited there is wiped on the next redeploy, and a redeploy happens every time
you push. So instead the app **commits packs back to your repository**.

Three variables on 🔗
https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env :

| Key | Value |
|---|---|
| `GITHUB_TOKEN` | a fine-grained token, below |
| `GITHUB_REPO` | `markh1984-spec/MusicQuizApp` |
| `GITHUB_BRANCH` | `MusicQuizApp` — optional, that is already the default |

The token comes from 🔗 https://github.com/settings/personal-access-tokens —
**Generate new token**, repository access **Only select repositories** →
`MusicQuizApp`, and exactly two permissions:

- **Contents**: Read and write
- **Metadata**: Read-only (it adds this itself)

Its commit messages end in `[skip render]` so filing a pack does **not**
restart the app — which matters if it ever happens mid-gig.

You will know it is working: the yellow "nothing here is being saved
permanently" banner at the top of the Console disappears, and generating a pack
says *backed up* rather than *saved here only*.

> Still safer to generate at home (Part 8). The backup covers the pack, but a
> pack generated on the live site loses its song history on the next deploy —
> which is what makes bingo repeat itself. **If songs start repeating, that is
> the first thing to check.**

## 2d. Test it end to end

- [ ] Open https://musicquizapp.onrender.com/screen on your laptop — you should
      get a lobby with a QR code
- [ ] Scan it with your phone, type a team name, tap **Join**
- [ ] Your team name appears on the laptop within about a second
- [ ] Open the **Console** on your phone, tap **Launch** under
      *The 1980s Music Quiz*
- [ ] Tap the big pink button, play two or three questions, answering on your
      phone
- [ ] On the reveal, check you see **Fastest finger** with your team name and a
      time

- [ ] Now try bingo: Console → **Launch** under *1980s Music Bingo*. Tap a few
      tracks in your control view and watch them fill the call sheet on the big
      screen. Tap squares on your phone — **green** means you have played it,
      **amber** means you have marked something that has not been played.

If all that works, the hard part is done and you have a usable quiz.

---

# PART 3 — Read the questions ⚠️ do before anyone sees it

The one job I genuinely cannot do for you.

## 3a. Work through the flags

Start in the **Console**, not the Editor — press **Read** on a pack and the
suspicious questions are listed at the top, before the questions themselves.

🔗 `https://musicquizapp.onrender.com/console?key=YOURKEY`

These are hunches, not errors. The app cannot tell whether a fact is true; it
can only spot the shapes that usually hide a second defensible answer — a fact
that names one of the wrong options, words like "only" or "first", a correct
answer that is a negative.

- [ ] Read each flag, decide, and press **Checked**
- [ ] It drops off the list, so what is left is only what you have not looked
      at yet. When the last one goes the panel turns green.
- [ ] Ticked one by mistake? **Show N you have checked** → **Undo**

The ticks are saved on the question, not in the browser — so you can start on
the laptop and finish on your phone. Rewrite the wording a flag was about and
the flag comes back, on purpose: a tick means "I read this wording", not "stop
bothering me about this question".

You can also rename the quiz and its rounds from this same panel. That needs
**Save**; the flag ticks save themselves as you press them.

## 3b. Read the rest

The flags only catch the mechanical faults. A question can be perfectly shaped
and still wrong.

🔗 `https://musicquizapp.onrender.com/editor?key=YOURKEY`

- [ ] Read all 30 questions. The correct answer is the green one.
- [ ] Press **Check** — it catches structural mistakes (no answer marked, two
      identical options), but **not** factual ones. Only you can do those.
- [ ] Fix anything you disagree with. Click **Save** when done.
- [ ] Anything you change on the live site is lost the next time the app
      redeploys, so also press **Download** and keep the file. See Part 8 for
      how to make changes permanent.

---

# PART 4 — Get it onto your own computer

Only needed for parts 5–8. Skip if you just want to run the quiz as it is.

## 4a. Install two tools

- [ ] **Node** 🔗 https://nodejs.org — click the big green **LTS** button,
      install with the defaults
- [ ] **Git**
      - Mac: open Terminal, type `git --version`, and if it offers developer
        tools, say yes
      - Windows 🔗 https://git-scm.com/download/win — install with all defaults

## 4b. Download the code

Open **Terminal** (Mac) or **Git Bash** (Windows) and run these one at a time:

```bash
git clone https://github.com/markh1984-spec/MusicQuizApp.git
cd MusicQuizApp
npm install
```

## 4c. Make your keys file

```bash
cp .env.example .env
```

Open the file `.env` inside the MusicQuizApp folder with any text editor —
TextEdit, Notepad, VS Code, anything. Keys go in here in the next parts, and it
is never uploaded to GitHub.

- [ ] Put your host key in it too, so the app behaves the same at home:
      ```
      HOST_KEY=amber-tractor-cider-42
      ```

## 4d. Check it runs

```bash
npm start
```

It prints four addresses. Open the Console one. Press `Ctrl` and `C` together
in the terminal to stop it.

---

# PART 5 — AI generation (you already have the key)

Type "1990s indie" and get a whole quiz or bingo round built.

## 5a. Put the key in your file

- [ ] Open `.env`, find `# ANTHROPIC_API_KEY=sk-ant-...`, delete the `# ` from
      the start, and put your real key after the `=`:
      ```
      ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
      ```

## 5b. Check you have credit

An API key bills separately from any Claude subscription.

- [ ] 🔗 https://console.anthropic.com/settings/billing — if the balance is
      zero, add £5. That is a very large number of quizzes.

## 5c. Try it

```bash
npm start
```

The Console has two generators at the top:

- [ ] **New quiz** — type a theme (`the 1990s`, `Motown`, `Britpop`, `Harry
      Potter soundtracks`), tick which rounds you want, press **Write it**.
      Takes about a minute for three rounds.
- [ ] **New bingo round** — type a theme, press **Build it**.

Both stream their progress so you can see what they are doing.

**Then read what they wrote in the Editor.** Neither is finished until you
have.

---

# PART 6 — Round 2 pictures (about £8, 20 minutes)

The "whose face is this?" round currently uses obvious placeholder drawings.

## 6a. Get an OpenAI key

- [ ] 🔗 https://platform.openai.com/signup — make an account
- [ ] 🔗 https://platform.openai.com/settings/organization/billing/overview —
      **Add payment details**, then add **$10** of credit (OpenAI will not let
      you use the API on a zero balance)
- [ ] 🔗 https://platform.openai.com/api-keys — **Create new secret key**, name
      it `musicquiz`, **Create**
- [ ] **Copy it immediately** — it is only shown once

## 6b. Put it in your keys file

- [ ] In `.env`:
      ```
      OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
      ```

## 6c. Make the pictures

```bash
npm run generate:images -- --quiz eighties --provider openai --force
```

Couple of minutes, about 40p.

## 6d. Check them

- [ ] Open the `images/eighties/` folder and look at all ten
- [ ] Redo any that are not recognisable — the `r2q4` is the question id, which
      you can see in the Editor:
      ```bash
      npm run generate:images -- --quiz eighties --only r2q4 --provider openai --force
      ```

## 6e. Send them to the live app

```bash
git add images/
git commit -m "Round 2 portraits"
git push
```

**Not optional** — the live app builds from GitHub, so a picture you have not
pushed does not exist on it. Render redeploys in about a minute.

---

# PART 7 — Spotify playlists (10 minutes, once ever)

Optional. Without it bingo rounds still generate, you just build the playlist
yourself.

## 7a. Make a Spotify app

- [ ] 🔗 https://developer.spotify.com/dashboard — log in with **the same
      Spotify account your DJ app uses**
- [ ] Click **Create app** and fill in:
      - **App name**: `Music Quiz`
      - **App description**: `Bingo playlists`
      - **Redirect URI**: type this exactly, then click **Add**:
        ```
        http://127.0.0.1:8888/callback
        ```
      - Tick **Web API**, tick the terms box
- [ ] **Save**

## 7b. Copy your two values

- [ ] On the app page click **Settings** (top right)
- [ ] Copy the **Client ID**
- [ ] Click **View client secret**, copy that too

## 7c. Run the login helper

```bash
npm run spotify:login
```

- [ ] Paste the Client ID, Enter
- [ ] Paste the Client Secret, Enter
- [ ] It prints a long URL — open it in your browser, click **Agree**
- [ ] The page says "Done — you can close this"

## 7d. Save the three lines it printed

- [ ] Copy all three into `.env`, replacing the commented-out versions:
      ```
      SPOTIFY_CLIENT_ID=...
      SPOTIFY_CLIENT_SECRET=...
      SPOTIFY_REFRESH_TOKEN=...
      ```

They never expire. **Keep them private** — do not paste them into a message and
do not commit them.

> **If you set Spotify up before today, run `npm run spotify:login` again.**
> Reading your own private playlists needs a permission the original setup did
> not ask for. Without it, importing a private playlist fails with "does not
> exist" — which is Spotify's unhelpful way of saying "you did not ask for
> permission". Same steps, takes two minutes, and it replaces the three lines
> in `.env`.

## 7e. Bringing in a list you already have

You do not have to generate every bingo round from a blank box. On the **Music
Bingo** tab, under the generator, there is **Or bring in a list you already
have**. It takes either:

- **a Spotify playlist link** — one you built yourself, or one Claude built for
  you in your browser. Paste the link, press **Import**.
- **a pasted track list** — click *or paste a track list instead*. One track
  per line. It copes with numbered lists, bullets, bold, `Title — Artist`,
  `Title by Artist`, and a year on the end.

With Spotify connected it looks each track up so the pack matches what your DJ
app will actually play. Without it, the pack keeps the names as you typed them,
which is fine — you are the one playing the tracks.

A 4×4 card needs **at least 24 tracks**, not 16. Sixteen would fill every card
with the same sixteen songs and the whole room would finish at once.

**Skip songs played recently** is off by default here, because an imported list
is usually one you chose on purpose. Tick it if you want the no-repeats rule
applied.

---

# PART 8 — Making new rounds from now on

**Always build at home, never on the live site.** Anything generated on the
live site is wiped the next time the app redeploys, including its record of
which songs it used.

```bash
cd MusicQuizApp
git pull
npm start
```

Then in the Console:

1. Type a theme into **New bingo round** and press **Build it** — or paste a
   list you already have into **Or bring in a list you already have** (7e)
2. Press **Read** on the new pack and work through the flags (Part 3a)
3. Open the **Editor** if you want to change any wording
4. Stop the app with `Ctrl` and `C`

Then send it to the live app:

```bash
git add bingo/ quizzes/ images/ data/track-history.json
git commit -m "New round for Friday"
git push
```

That last file — `data/track-history.json` — remembers which songs you have
used so the generator stops repeating them for three months. It only works if
you commit it.

---

# PART 9 — Your routine on the night

**Before you leave the house**
- [ ] Console — check the right pack is loaded
- [ ] Phone charged, Control view bookmarked

**At the venue, before people arrive**
- [ ] Laptop on, HDMI in
- [ ] Open the **Big screen** address **five minutes before** the room fills
- [ ] Blank page? That is the free tier waking up. Wait a minute, do not keep
      refreshing.
- [ ] Open the **Control view** on your phone
- [ ] Scan your own QR code, join as a test team, then remove it from your
      Control view

**During**
- **Skip** — bin a question entirely, takes its points back
- **Redo** — run it again with a fresh clock, if the PA or projector dropped
- **Back** — if you press onwards once too often
- Tap any team name to fix a score, rename them or remove them

**Afterwards**
- [ ] Download the results from the Control view if you want them
- [ ] Unplug HDMI, **shut the laptop**. That is all — it sleeps on its own.

---

# PART 10 — Before your first paid gig

- [ ] **Full dry run at home** — big screen, two or three phones, a whole round.
      Do it once with **wifi off on the phones and mobile data on**, because
      that is what your room will be using.
- [ ] **Test round 3 properly** — music app open, check your phone tells you
      what to play while the big screen gives nothing away.
- [ ] **Switch to the paid tier.** 🔗
      https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/settings →
      **Instance Type** → **Starter** ($7/mo). A dropdown, applies instantly, switch back
      any time. What it buys is removing the "arrived late, forgot to open the
      screen early, sixty people scanned into a blank page" problem. About 3%
      of one night's fee.

While on the free tier: **shut the laptop when you leave.** While a browser tab
is open on the app it pings the server to keep it awake, and a laptop left
running for days with that tab open would use up the free monthly allowance.
Closing the lid is enough.

(Nothing to do with the HDMI cable — the server has no idea whether a projector
is plugged in, it only sees the browser tab. Players' phones do not count
either: phone browsers suspend background tabs the moment the screen locks.)

---

# Later in the project

Talked about and designed for, not built:

- **Photo uploads to the big screen**, published straight away with a kill
  switch for you
- **Filters on those photos** — ours work day one; Snapchat's need a business
  account and their approval
- **Filters on the round 2 portraits** — nearly free, just a different prompt
- **Semi-automated social posting** — the app bundles the night's photos, you
  tap post
- **Team play** (several phones, one score) and **venue branding**
- **Your own domain** — about £10/year, steps in DEPLOY.md

Not building: **Instagram follow for points.** No API can verify that somebody
followed you, so it would be a button that lies. Awarding it by hand from your
Control view works and is honest.

---

# If something goes wrong

**Blank page when you first open it**
Free tier waking up. Wait 60 seconds, do not keep refreshing.

**"Wrong host key"**
The key in your address does not match `HOST_KEY` in Render.
🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env

**Phones join but nothing updates**
Venue wifi. Tell people to turn wifi off and use mobile data — the app is built
for exactly that and uses barely any.

**A question turns out to be wrong mid-quiz**
**Skip** on your Control view. It takes back any points it awarded.

**Everything has gone wrong**
Console → the game you want → **Launch**. Starts completely fresh. Teams rejoin
in ten seconds.

**Still stuck**
🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/logs — errors are
in plain English.
