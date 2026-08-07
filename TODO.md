# Your to-do list

Every step has the link you need next to it. Work down it in order.

**Parts 1–3 are the ones that matter. Everything after that is optional.**

---

## Where the project is right now

Everything talked about is now built except the four at the bottom under
**Still to build**. Nothing is half-finished in the tree.

Your list, shortest first. Only two of these cost anything:

| | What | Where | Costs | Blocks what |
|---|---|---|---|---|
| 1 | Check your `HOST_KEY` is set on Render | Part 2a | free | bookmarks breaking on every deploy |
| 2 | Read the questions and tick the flags | Part 3 | free | nothing — but do it before a room does |
| 3 | Dry run with wifi off on the phones | Part 10 | free | the one failure a home test cannot find |
| 4 | OpenAI key | Part 6 | ~£8 once, ~50p a quiz | round 2 portraits — placeholders until then |
| 5 | **Finish Spotify** — re-run the login, one thing left | *Where we stopped*, just below | free | playlists building themselves (everything else works) |
| 6 | Move to the $7 tier | Part 10 | $7/mo | before the first paying gig, not before that |

4 and 5 are genuinely optional. The app runs a full quiz night and a full bingo
night without either — round 2 just uses placeholder drawings, and you build
playlists by hand.

### Where we stopped last night — read this first

Spotify is **nearly** done. Node is installed, the app is created, the login
ran, and all three `SPOTIFY_*` values are on Render alongside your Claude key.

Generation works: Claude writes the list, all forty tracks are found on
Spotify, and then the very last step — creating the playlist — is refused with
a bare "Forbidden". The login definitely has permission (it reports all four
scopes back), and you have already added the account under User Management.

**Three things to try, in this order.** Stop as soon as one works.

- [ ] **Re-run the login.** In a terminal, in that folder:
      ```bash
      cd ~/Downloads/MusicQuizApp-MusicQuizApp
      npm run spotify:login
      ```
      Same Client ID and Secret, click **Agree**. Then on Render replace
      **only** `SPOTIFY_REFRESH_TOKEN` with the new one — leave the other two
      alone. 🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env

      *Why this first:* Spotify grants permission per app-and-user, and yours
      was granted before that account was added to User Management.

- [ ] **Check which account the dashboard is logged in as.** Top right of
      developer.spotify.com. If the app was created by a different account
      from the one you authorised, that is the mismatch.

- [ ] **Check the User Management email is exactly right** — it must match the
      email on that Spotify account (spotify.com → Account → Profile). A
      near-miss does nothing and says nothing.

**You are not blocked, and this is now the quickest way to build a round
anyway — two steps.**

1. **Ask Claude in your browser for the round.** It reads your no-repeats list
   straight off this repository, so it already knows every song you have used
   in the last three months and will not pick one. It builds the private
   Spotify playlist and then prints the tracks in a code block.
2. **Paste that block into the Import panel** in the console and press
   **Import**. Nothing to fill in first; the box is the first thing on the
   panel.

You get a pack whose cards are exactly the songs in the playlist, and every one
of them goes into the no-repeats list — which the app pushes back to GitHub
straight away, so next week Claude already knows about them. You keep track of
nothing.

**Import on the live site**, musicquizapp.onrender.com/console, rather than a
copy on the laptop. That is where the GitHub token lives, and the push is what
keeps Claude's list current.

**Then glance at the banner.** Green means those songs reached the list. Amber
means they did not — the round is still fine, but Claude will not know about
them, so import it again. It says so in those words.

If you would rather have the playlist read straight off Spotify, pasting its
**link** into the smaller box still works: reading a playlist is a different
permission from creating one, and yours has it.

Nothing else is outstanding. A generation that cannot make a playlist now saves
the pack anyway and tells you why, so you always get a playable bingo round.

### New since you last read this

- **Pictures from the console** — a Pictures button on any quiz with a face
  round. Draw free stand-ins, or real portraits once your OpenAI key is in.
  Part 6c.
- **A Playlist button** on any quiz with an intro round, so a playlist can be
  built long after the quiz was written. Part 7e.
- **Photos from the room onto the big screen**, with filters, a kill switch and
  a bin. Part 9b.
- **Pick them all** — a fourth round type where several answers are right.
  Part 5c.
- **The rules as the first slide** of every quiz, and **scores on the big
  screen** whenever you want them. Part 9a.
- **Advert slides between rounds**, one set per venue, with a QR to ticket
  sales. Its own console tab; put one up from your control view.
- **A Photos tab**, foldered by night, filed into a private repo so a restart
  cannot lose them. Needs Part 7f setting up once.

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
      There are now **four** round types to tick:
      *General knowledge*, *Whose face*, *Name that intro*, and
      **Pick them all** — several answers are right and the room locks in all
      of them, six options, part marks. It is off by default; tick it to try.
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

## 6c. Make the pictures — from the Console now

Easiest way: open the Console, find a quiz with a face round, press
**Pictures**. It tells you how many are real and how many are still stand-ins,
then gives you two buttons:

- **Draw stand-ins** — free, instant, no key. Use it to rehearse the round.
- **Make real portraits** — about 4p each, tells you the total first and asks
  before spending. Disabled until `OPENAI_API_KEY` is set.

Neither replaces a picture already there unless you tick *replace ones already
there*, so a portrait you have paid for cannot be overwritten by accident.

Still works from the command line if you prefer:

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

# PART 7 — Spotify playlists (nearly done — see 7f)

Optional. Without it bingo rounds still generate, you just build the playlist
yourself.

**What you get when this is done.** In the console, Music Bingo tab: type a
theme, press **Build it**, and one press gives you

- forty tracks chosen for a British pub crowd, nothing you have played in the
  last three months,
- every one of them looked up on Spotify so the pack has the real title and
  artist rather than something invented,
- **a private Spotify playlist in play order**, ready for your DJ app,
- the pack saved and committed to your repo so it survives a restart,
- and every track written into the no-repeats history.

Two keys make that work: `ANTHROPIC_API_KEY` (Part 2b) writes the track list,
and the three Spotify values below build the playlist. With the Claude key but
no Spotify you still get the pack and the call sheet — just no playlist.

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

## 7d. Save the three lines it printed — in BOTH places

The helper prints three lines. They go in two places, and it matters which:

**On your laptop**, so generating at home works:

- [ ] Copy all three into `.env`, replacing the commented-out versions:
      ```
      SPOTIFY_CLIENT_ID=...
      SPOTIFY_CLIENT_SECRET=...
      SPOTIFY_REFRESH_TOKEN=...
      ```

**On Render**, so the Build it button works from the live console — which is
where you will actually press it:

- [ ] 🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env
- [ ] **+ Add Environment Variable**, three times, one per line above
- [ ] While you are there, check **ANTHROPIC_API_KEY** is set too — without it
      the Build it button is greyed out
- [ ] **Save changes**. Render redeploys, about a minute

Then open the console's **Music Bingo** tab. If it still says anything about
missing Spotify values, the deploy has not finished — give it another minute
and reload.

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

# PART 7f — A second repo, for the photos (10 minutes, once ever)

Photos of the public must not go in your main repository — it is **public**,
and git keeps everything forever, so deleting a photo would not really delete
it. A second, **private** repo fixes that and costs nothing.

It also fixes a real problem: right now the live app has no permanent disk, so
a night's photos are wiped when the app restarts. Once this is set up they are
filed away as they arrive.

## 7f.1 — Make the repo

- [ ] 🔗 **https://github.com/new**
- [ ] **Repository name**: `MusicQuizPhotos`
- [ ] **Description**: anything, or leave it
- [ ] Choose **Private** ← the important one. Do not leave it on Public.
- [ ] Tick **Add a README file** ← also important. A completely empty repo has
      no branch yet, and the app cannot file anything into a repo with no
      branch. The README gives it one.
- [ ] **Create repository**

## 7f.2 — Note the branch name

New GitHub repos call their branch **`main`**. Your quiz repo is the odd one
out at `MusicQuizApp`, so do not assume they match — look at the top left of
the new repo's page and note what it says. It will almost certainly be `main`.

## 7f.3 — Let your existing token reach it

Your token is currently allowed to touch `MusicQuizApp` and nothing else, which
is exactly right — so it has to be told about the new one.

- [ ] 🔗 **https://github.com/settings/personal-access-tokens**
- [ ] Click the token you made for the quiz app
- [ ] Under **Repository access** → **Only select repositories** → **Select
      repositories** → tick **`MusicQuizPhotos`** as well as `MusicQuizApp`
- [ ] Check **Permissions → Repository permissions** still shows
      **Contents: Read and write**
- [ ] **Update token** at the bottom

> You do not get a new token and nothing you have already set up changes. The
> same token now reaches both repos.

> **Rather keep them separate?** Make a second token instead, scoped only to
> `MusicQuizPhotos`, and set `PHOTO_TOKEN` on Render as well. The app will use
> that one for photos if it is there, and fall back to `GITHUB_TOKEN` if not.

## 7f.4 — Tell the app about it

🔗 **https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env**

| Key | Value |
|---|---|
| `PHOTO_REPO` | `markh1984-spec/MusicQuizPhotos` |
| `PHOTO_BRANCH` | `main` — only needed if step 7f.2 said something else |

- [ ] **Save changes**. Render redeploys, about a minute.

## 7f.5 — Check it worked

- [ ] Open the **Photos** tab in the console. It should say photos are being
      filed to `MusicQuizPhotos` rather than warning you they are temporary.
- [ ] Join on your phone, send a photo, and refresh
      🔗 https://github.com/markh1984-spec/MusicQuizPhotos — there should be a
      dated folder with it in.

> **Doing this on your own machine too?** Put the same two lines in `.env`.
> Not required — it only matters on the live app, which is the one that wipes
> itself.

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

### 9a. The two screens you can call up

- **The rules** come up on their own as the first slide, right after you press
  *Start the quiz*. Read them out or let the room read them; press onwards when
  you are ready. **Back** returns to them if somebody walks in late and asks.
- **Scores on screen** — put the leaderboard on the projector whenever you
  like, roughly every five questions. Press it again to hide, or just press the
  big pink button and it goes away as the quiz carries on. Greyed out while a
  question is live, because the room cannot answer what it cannot see.
  Your control view header says *Scores on the big screen* so you never have to
  turn round to check what they are looking at.
- **My scores** is different — that is your own copy, on your phone.

### 9b. Photos from the room

A camera button appears on every joined phone (hidden while a question is
live). They pick or take a photo, choose a filter, and it is on the projector
in about a second with their team name under it.

**There is no approval step**, by your own decision — say "no naughtiness" over
the mic. What you have instead, on your control view:

- **Switch off** — stops new ones AND takes the existing ones off the screen.
  You can still see them, so you can bin the offending one.
- **Tap any photo** to bin just that one.
- **Clear all photos** when the night is over.

> Photos are filed into your **private** `MusicQuizPhotos` repo as they arrive
> — never the main one, which is public and would keep them forever. See the
> **Photos** tab in the console: foldered by night, with **Share** on each one
> and on the whole night, which opens your phone's share sheet with Instagram
> in it. Set up in Part 7f.

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

# Still to build

Four things, in the order I would do them. Say the word on any of them.

### 1. Draggable stickers on the photos
Dog ears, clown noses, silly hats — tap a prop, drag it onto a face, pinch to
size. No face detection, so it works on every phone in the room.

Not the same as Snapchat's own lenses, which need **Snap Camera Kit**: partner
approval, money above a threshold, and megabytes of SDK on a stranger's phone
over pub wifi. Parked, not forgotten.
*Medium. No decisions needed.*

### 2. Filters on the round 2 portraits
The same filters the room gets on their own photos, applied to the generated
portraits — an eighties duotone face round looks like a different game. Nearly
free, because the pictures are already made and the filters already exist.
*Small. No decisions needed.*

### 3. Team play — several phones, one score
Two or three people at a table on one team, so a group of friends is not forced
to compete with each other. Needs a decision from you: does the first person to
answer lock it in for the table, or does the table vote and the majority count?
*Medium. Needs one decision.*

### 4. Semi-automated social posting
The app bundles the night's photos and results into a post you tap to publish.
Needs decisions on which platform first and whether you want captions written
for you.
*Bigger. Needs a conversation before I start.*

### 5. Advertising slides between rounds — your idea, parked for later
Two audiences: the venue (drinks offers, a band playing at the end of the
month) and you. The pull is a **QR code to ticket sales you take a cut of**, so
this is a revenue feature rather than decoration.

Cheap to build when you want it — the big screen is already a registry of
slides and the app already writes its own QR codes. The part worth thinking
about first is where the slides live: one set per venue you can reuse, or a
fresh one each night? Between rounds is the obvious slot, next to the
scoreboard button.

### Also possible, not on the list unless you want it
- **Venue branding** — a venue's name and colours on the big screen.
- **Your own domain** — about £10/year, steps in DEPLOY.md. Your job, not mine.

Not building: **Instagram follow for points.** No API can verify that somebody
followed you, so it would be a button that lies. Awarding it by hand from your
control view works and is honest.

---

# Where this might go — three directions, and what each really costs

None of this is being built yet. It is written down so that a change made
today does not quietly make one of them harder tomorrow.

**The one thing that governs all of it: the app runs ONE game at a time.** One
state file, one host key, one session, one join code. That is the right design
for you running your own nights and the wrong one for anybody else using it at
the same time as you. Directions 1 and 2 both need that undone first, and it is
much cheaper to do while there are eight packs and one account than when there
are hundreds of both.

## 1. Selling other quiz masters a subscription — doable

They log in, use quizzes you have written, cannot write their own. Around
£9.99 a month.

The work, in order of size:

- **Multi-tenancy.** Concurrent games, per-account state, room codes so two
  nights do not collide on one join URL. The engines are already classes with
  injected state so several can exist at once; it is `server.js`, the store and
  the live connections that assume one of everything.
- **Accounts.** Real ones, hashed passwords, sessions — where today there is
  one shared key.
- **Payments.** Stripe Checkout and a webhook. Can be done over plain HTTP with
  no library, so it does not break the no-dependencies rule.
- **Hosting.** Ten hosts times sixty phones is six hundred connections held
  open all evening. That is off the free tier for real.

Worth saying plainly: **"they cannot make their own" is a content commitment.**
A subscription means owing them new quizzes every month, not just software.

### In-person and online as two modes on one account

The plan: a subscriber flicks between **in-person** (projector, phones as
buzzers — what exists) and **online** (one link, quiz and host and chat in one
page). Two modes is a higher tier, and rightly so, because online genuinely
costs you money per event where in-person costs you nothing.

**The number that decides the tier.** Sending the host's picture to a room
costs about twenty times what sending their voice costs. For a 90-minute quiz
with a hundred people, at a typical five cents a gigabyte:

| What is sent | Per viewer | For 100 | Four events a month |
|---|---|---|---|
| Video, 1 Mbps | 675 MB | 67.5 GB | **$13.50 per subscriber** |
| Video, 500 kbps | 338 MB | 33.8 GB | $6.75 |
| Audio only, 48 kbps | 32 MB | 3.2 GB | **$0.65** |

A £9.99 subscriber running four full-video nights a month is **underwater
before anything else is paid for**. The same subscriber on audio-first costs
under a pound. Check the provider's current rate before committing, but the
ratio is arithmetic and will not move.

So audio-first is not only the right design — the quiz should own the screen,
and audio survives bad home wifi — it is what makes the subscription work at
all. Video is a small tile, off by default, and **any account that leaves it on
all night needs metering or a higher tier**. Decide that before the first
subscriber, not after the first invoice.

**Keep the online path OFF the in-person path.** A media service having a bad
day must never be able to affect a Wednesday night in a pub. That is nearly
free to guarantee if the modes are separate from the start and close to
impossible to retrofit — which is the whole reason it is written here.

**Build order, whichever way the video goes:**

1. **The combined player view** — question and answers on one device. Needed
   for any remote quiz at all, and it is what keeps the speed scoring honest
   when every viewer is a different number of seconds behind. Worth building on
   its own merits.
2. **Audio broadcast** from the console, host to players, one way.
3. **The camera tile**, small by default.
4. **Chat** — only worth building once the app IS the meeting. If a subscriber
   is on Teams or Zoom, their people are already chatting there and a second
   chat is a room nobody stands in.

**Not building it inside Teams or Zoom**, despite their meeting-app SDKs being
neat: two builds and two app reviews, corporate IT blocks third-party meeting
apps by default, and a product that only exists inside somebody else's meeting
is a feature of their platform rather than a business of yours.

### How the subscription actually works — settled enough to build against

**Accounts.** Email and a password hashed with scrypt, which is in Node's own
standard library, so no dependency. Each account owns everything it makes:
quizzes, bingo packs, adverts, photos, its no-repeats history and its running
game. The single `HOST_KEY` becomes one key per account.

A hashed password means **you cannot see theirs even if you wanted to**. That
is structural, not a promise, and it is worth saying out loud when you sell it.

**Payments are deliberately processor-agnostic.** The app stores two fields —
a customer id and a status — and listens for a webhook that says paid, lapsed
or cancelled. Nothing else about billing lives here, and card details never
touch this server at all. That means the processor can be swapped later without
redesigning anything:

| | Worth knowing |
|---|---|
| **Stripe** | Best developer experience. Being awkward at the moment. |
| **PayPal** | Does subscriptions and one-offs. Clunkier API, less pleasant checkout, but perfectly workable. |
| **Paddle / Lemon Squeezy** | **Merchant of record** — they are legally the seller, so they handle UK and EU VAT on digital goods for you. For a one-man band selling quiz packs across borders this is probably the right answer, and it removes the tax question below entirely. |

**Support access, and why it is a selling point.** Other quiz hosts are not
exactly competitors, but they will still wonder whether you can read the
quizzes they wrote. Two different kinds of sensitive:

- **Impossible for you to see:** their password (hashed) and their card (at the
  processor). Nothing to design.
- **Possible, because you own the database:** their quizzes, their player
  names, their venues. No code changes that. What code CAN do is make it
  consented and visible — support access is a switch THEY turn on, it expires
  on its own, and every action taken while inside is written to a log they can
  read.

Answering "can you read my quizzes?" with "only when you let me in, and here is
the list of everything I did" is a better answer than "I promise I do not".

**The library.** Two kinds of pack in one place:

- **Theirs** — written or uploaded, owned by their account, invisible to
  everyone including you unless support access is on.
- **Yours** — a shop. Buying grants a LICENCE, a row saying this account may
  use this quiz, rather than copying the file. So when you fix a wrong answer
  every subscriber gets the fix. Never delete a sold quiz; archive it.
- **"Make my own version"** forks a bought quiz into their account as a copy.
  They will ask for this within a week.
- Bundles and promotions are a pricing decision, not a code one — the licence
  row is the same however it was paid for.

**Serving packs costs nothing worth charging for.** Measured: a quiz pack is
4–11 KB. Two hundred subscribers taking four each a month is 6 MB. The only
line that grows is artwork — real portraits are a few hundred KB each, so the
same subscribers cost about 2 GB a month, still pennies, and a CDN removes even
that. **Charge per quiz because your time writing it is worth money, not
because serving it costs anything.**

### Pictures in a quiz — the bit that changes when you start selling

**"Fair use" is American. The UK has "fair dealing", and it is much narrower.**
It is a closed list — research and private study, criticism and review,
quotation, parody, news reporting. Commercial entertainment is not on it.
**There is no "it is only a quiz" exception.** A press photograph on a
projector at a paid gig is, strictly, copying and communicating somebody's
copyright work to the public.

On its own that is a small practical risk. It stops being small the moment
packs are SOLD, because at that point they are being distributed at scale, with
your name on them and revenue attached — which is a different order of
exposure from using one picture on your own projector on a Tuesday.

**So the instinct to generate the artwork was right**, and for a stronger
reason than the one it was chosen for. Keep it. Points to hold on to:

- **OpenAI's terms assign the output to you**, including commercial use, so
  there is a contract behind the packs you sell.
- **The caption already on screen — "AI-generated illustration, not a real
  photograph" — is doing legal work as well as honest work.** It is a plain
  statement that nobody is being passed off. Do not quietly drop it.
- **Likeness is a separate question from copyright.** Using a recognisable face
  AS THE SUBJECT of "whose face is this?" is much safer than using one to
  suggest an endorsement, which is what passing off actually protects against.
  Do not generate anything unflattering, and be more careful with the living
  than the dead.
- Alternatives if a generated picture will not do: **public domain**, or
  Creative Commons with the attribution shown on screen — but share-alike
  licences are awkward in a pack you sell. Licensed editorial stock costs real
  money per image per use.

**And the bigger exposure is the music, not the pictures.** In a venue, the
venue's PRS and PPL licences cover what you play. **Online they do not.** A
corporate quiz streamed to a hundred remote people is a public performance with
nobody's licence behind it — worth an hour of an actual solicitor's time before
the online mode is sold, not after.

None of the above is legal advice. It is the shape of the problem, so the
conversation with somebody qualified is short and cheap.

## 2. On the App Store, a few pounds a go — hard, and a different product

Not a port of this. This app is one host driving a projector with phones as
buzzers. "Friends competing on their phones" has no host to press Next and no
big screen — it is a second game that happens to reuse the scoring.

Three things to know before spending anything:

- **Music licensing is the real blocker.** Today YOU play the music, in a
  venue, under that venue's PRS/PPL cover. An app that plays clips to consumers
  has no such cover, and licensing recorded music for an app is slow and
  expensive. Without audio it is a text quiz, which is a far weaker product
  than the one you actually run.
- **Apple takes 15–30%** and requires in-app purchase for digital goods.
- **Apple rejects thin web wrappers** (guideline 4.2), so it needs to be
  genuinely native — which ends the no-build-step rule, and adds $99 a year and
  an app review queue.

Cheaper first step: sell it as a **paid web app**. Same price, Stripe, no
review, no wrapper. If people pay, then decide whether native is worth it.

## 3. Paid TikTok streams with cash prizes — easy to build, hard to be allowed

The smallest code change of the three: QR joining, live scoring and a winner
all exist. Bolting a payment onto the join screen is a week.

The problems are not technical:

- **Taking entry money and paying out prizes is regulated.** Done wrong it is
  an unlicensed lottery. A quiz can be a lawful prize competition under the
  Gambling Act 2005, but only if the skill genuinely deters a significant
  proportion of entrants — a legal test, not a design preference. Take advice
  before accepting a single payment.
- **You become a payment intermediary**, paying money to strangers. Stripe
  Connect can do it but contests need explicit approval and identity checks on
  the people being paid.
- **Stream delay breaks the scoring.** TikTok Live runs 5–20 seconds behind,
  and by a different amount for each viewer. Points here are "correct answer
  plus seconds left on the clock" — the thing that makes this quiz good is
  exactly the thing that does not survive a stream. That format needs a
  different scoring model, not a tweak.

## What to avoid doing in the meantime

- Do not add anything that assumes a single global game, a single host key, or
  a single set of packs, without at least leaving a note here.
- Keep the engines free of the filesystem and the clock, the way they are now.
  That is what makes running several at once possible at all.
- Keep packs as files with ids. Per-account packs are a folder per account
  before they are a database.

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
