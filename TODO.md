# Your to-do list

Every step has the link you need next to it. Work down it in order.

**Parts 1–3 are the ones that matter. Everything after that is optional.**

---

## Quick links — the ones you will use constantly

| What | Link |
|---|---|
| Your repository | https://github.com/markh1984-spec/MusicQuizApp |
| Render dashboard | https://dashboard.render.com |
| Anthropic billing | https://console.anthropic.com/settings/billing |
| OpenAI API keys | https://platform.openai.com/api-keys |
| Spotify dashboard | https://developer.spotify.com/dashboard |

### How to get a direct link to any Render page

Render's own addresses contain a service id it invents, so I cannot write them
out for you in advance. But once you have clicked into your service, the
address bar shows something like:

```
https://dashboard.render.com/web/srv-d1abc2de3fg4h5i6j7k8
```

**Copy that once and keep it.** Every page of your service is that address with
one word on the end:

| Page | Add to the end |
|---|---|
| Environment variables | `/env` |
| Settings | `/settings` |
| Logs | `/logs` |
| Deploy history | `/deploys` |

So your environment variables page is permanently:
`https://dashboard.render.com/web/srv-YOURID/env`

Worth writing that one down — it is the page you will come back to most.

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

🔗 **https://dashboard.render.com** → click your service → **Environment** in
the left sidebar (or add `/env` to the address as described above)

On that page look for the section headed **Environment Variables** — *not*
**Environment Groups**, which is a different feature for sharing variables
between several services and is not what you want. The variables section is
usually above it.

Click **+ Add Environment Variable** and fill in:

| Key | Value |
|---|---|
| `HOST_KEY` | three unrelated words and a number, e.g. `amber-tractor-cider-42` |

Then **Save changes**. Render redeploys itself, about a minute.

> **Cannot find the section?** Try the Settings page instead —
> `https://dashboard.render.com/web/srv-YOURID/settings` — and scroll to
> **Environment Variables**. Same effect.

> **Choosing the key:** not the venue name, not your Instagram handle, not
> "quiz". Three unrelated words is memorable, typeable one-handed in the dark,
> and not guessable by a bored punter.

## 2b. Write down your four addresses

Your web address is at the top of the Render service page — something like
`https://musicquiz.onrender.com`.

Take it and make these four, swapping in the key you just set:

| What it is | Address |
|---|---|
| **Console** — start here every time | `https://musicquiz.onrender.com/console?key=YOURKEY` |
| **Big screen** — goes on the projector | `https://musicquiz.onrender.com/screen` |
| **Control view** — your phone | `https://musicquiz.onrender.com/host?key=YOURKEY` |
| **Editor** — checking questions | `https://musicquiz.onrender.com/editor?key=YOURKEY` |

- [ ] **Bookmark the Console link on your phone.** Everything else is one tap
      from it, and you do not want to be typing that in a dark pub.

## 2c. Test it end to end

- [ ] Open the **Big screen** link on your laptop — you should get a lobby with
      a QR code
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

🔗 Your Editor link — `https://musicquiz.onrender.com/editor?key=YOURKEY`

- [ ] Read all 30 questions. The correct answer is the green one.
- [ ] Press **Check** — it catches structural mistakes (no answer marked, two
      identical options), but **not** factual ones. Only you can do those.
- [ ] Fix anything you disagree with. Click **Save** when done.
- [ ] Anything you change on the live site is lost the next time the app
      redeploys, so also press **Download** and keep the file. See Part 7 for
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

- [ ] Open the Console address it prints, type a theme into **New bingo round**,
      press **Build it**. You will watch it work line by line.

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

1. Type a theme into **New bingo round**
2. Press **Build it**
3. Open the **Editor** and read through it
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
      `https://dashboard.render.com/web/srv-YOURID/settings` → **Instance
      Type** → **Starter** ($7/mo). A dropdown, applies instantly, switch back
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
🔗 `https://dashboard.render.com/web/srv-YOURID/env`

**Phones join but nothing updates**
Venue wifi. Tell people to turn wifi off and use mobile data — the app is built
for exactly that and uses barely any.

**A question turns out to be wrong mid-quiz**
**Skip** on your Control view. It takes back any points it awarded.

**Everything has gone wrong**
Console → the game you want → **Launch**. Starts completely fresh. Teams rejoin
in ten seconds.

**Still stuck**
🔗 `https://dashboard.render.com/web/srv-YOURID/logs` — errors are in plain
English.
