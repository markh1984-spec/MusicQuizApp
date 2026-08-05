# Your to-do list

Written to be followed literally. Every URL, every button name, every command
you can copy and paste.

**Do parts 1 and 2. Everything after that is optional and can wait.**

---

# PART 1 — GitHub (done)

Your branch is called **`MusicQuizApp`**. That is the one Render should watch,
and the one all changes get pushed to.

Most guides online say `main` — yours is not called that, and it does not
matter. Wherever a guide says `main`, use `MusicQuizApp`.

One branch, and it is the default. Nothing else to do here.

---

# PART 2 — Put it on the internet (20 minutes)

## 2a. Make a Render account

1. Go to **https://render.com**
2. Click **Get Started** (top right)
3. Choose **GitHub** to sign up — this saves connecting it later
4. Allow Render to see your GitHub repositories when it asks

## 2b. Create the service

1. Go to **https://dashboard.render.com**
2. Click the blue **New +** button, top right
3. Choose **Web Service**
4. Find **MusicQuizApp** in the list and click **Connect**
   - Not there? Click **Configure account** and give Render access to it
5. Fill in the form. Most of it is already right — set these:

| Field | What to put |
|---|---|
| **Name** | `musicquiz` (this becomes your web address) |
| **Region** | `Frankfurt (EU Central)` |
| **Branch** | `MusicQuizApp` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

6. Scroll down to **Environment Variables** and click **Add Environment
   Variable**:

| Key | Value |
|---|---|
| `HOST_KEY` | a phrase only you know, e.g. `blue-tractor-42` |

   This is your password. Anyone who has it can control your quiz, so do not
   put it on the big screen.

7. Click **Create Web Service** at the bottom
8. Wait 2–3 minutes, watching the black log window. You are done when you see:

```
Music Quiz & Bingo is running
```

## 2c. Write down your four addresses

At the top of the Render page is your web address, something like
`https://musicquiz.onrender.com`.

Make yourself these four links, putting **your own** `HOST_KEY` where it says
`YOURKEY`:

| What it is | Address |
|---|---|
| **Console** — start here every time | `https://musicquiz.onrender.com/console?key=YOURKEY` |
| **Big screen** — goes on the projector | `https://musicquiz.onrender.com/screen` |
| **Control view** — your phone | `https://musicquiz.onrender.com/host?key=YOURKEY` |
| **Editor** — checking questions | `https://musicquiz.onrender.com/editor?key=YOURKEY` |

**Bookmark the Console link on your phone now.** Everything else is one tap
from it, and you do not want to be typing that in a dark pub.

## 2d. Check it works

1. Open the **Big screen** link on your laptop
2. Scan the QR code with your phone, type a team name, tap **Join**
3. Your team name should appear on the laptop within a second
4. Open the **Console** link on your phone, tap **Launch** under the 1980s quiz
5. Tap the big pink button and play a couple of questions

If that works, you have a working quiz.

---

# PART 3 — Get it onto your own computer

Only needed for parts 4–7 (new quizzes, pictures, Spotify). Skip if you only
want to run the quiz that is already there.

## 3a. Install two tools

- **Node** — **https://nodejs.org** — click the big green **LTS** button and
  install it with the defaults
- **Git**
  - **Mac**: open Terminal, type `git --version`, and if it offers to install
    developer tools, say yes
  - **Windows**: **https://git-scm.com/download/win** — install with all defaults

## 3b. Download the code

Open **Terminal** (Mac) or **Git Bash** (Windows) and run these one at a time:

```bash
git clone https://github.com/markh1984-spec/MusicQuizApp.git
cd MusicQuizApp
npm install
```

## 3c. Make your keys file

```bash
cp .env.example .env
```

Now open the file called `.env` inside the MusicQuizApp folder using any text
editor — TextEdit, Notepad, VS Code, anything. Keys go in here in the next
parts. It is never uploaded to GitHub.

## 3d. Check it runs

```bash
npm start
```

It prints four addresses. Open the Console one in your browser to confirm.
Press `Ctrl` and `C` together in the terminal to stop it.

---

# PART 4 — Turn on AI generation (you already have this key)

Lets you type "1990s indie" and get a whole quiz or bingo round built.

## 4a. Put the key in your file

1. Open `.env`
2. Find the line `# ANTHROPIC_API_KEY=sk-ant-...`
3. Delete the `# ` from the start and put your real key after the `=`, so it
   reads:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
   ```
4. Save the file

## 4b. Check you have credit

An API key bills separately from any Claude subscription you may have.

1. Go to **https://console.anthropic.com/settings/billing**
2. If the balance is zero, add £5 — that is a very large number of quizzes

## 4c. Try it

```bash
npm start
```

Open the Console address it prints, type a theme into the **New bingo round**
box and press **Build it**. You will watch it work, line by line.

---

# PART 5 — Round 2 pictures (about £5 in credit, 20 minutes)

The "whose face is this?" round currently uses obvious placeholder drawings.
This replaces them with proper artwork.

## 5a. Get an OpenAI key

1. Sign up at **https://platform.openai.com/signup**
2. Go to **https://platform.openai.com/settings/organization/billing/overview**
3. Click **Add payment details** and put **$10** of credit on it
   (OpenAI will not let you use the API with a zero balance)
4. Go to **https://platform.openai.com/api-keys**
5. Click **Create new secret key**, name it `musicquiz`, click **Create**
6. **Copy it straight away** — it is only ever shown once

## 5b. Put it in your keys file

In `.env`, uncomment that line and fill it in:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
```

## 5c. Make the pictures

```bash
npm run generate:images -- --quiz eighties --provider openai --force
```

Takes a couple of minutes and costs about 40p.

## 5d. Look at all ten

Open the `images/eighties/` folder and check each one is recognisable. If one
is not, redo just that one. The `r2q4` part is the question id, which you can
see in the Editor:

```bash
npm run generate:images -- --quiz eighties --only r2q4 --provider openai --force
```

## 5e. Send them to the live app

```bash
git add images/
git commit -m "Round 2 portraits"
git push
```

Render redeploys itself in about a minute. **This step is not optional** — the
live app builds from GitHub, so a picture you have not pushed does not exist
on it.

---

# PART 6 — Spotify playlists (10 minutes, once ever)

Optional. Without it, bingo rounds still generate — you just make the playlist
yourself instead of the app making it for you.

## 6a. Make a Spotify app

1. Go to **https://developer.spotify.com/dashboard**
2. Log in with **the same Spotify account your DJ app uses**
3. Click **Create app**
4. Fill it in:
   - **App name**: `Music Quiz`
   - **App description**: `Bingo playlists`
   - **Redirect URI**: type this exactly, then click **Add**:
     ```
     http://127.0.0.1:8888/callback
     ```
   - Tick **Web API**
   - Tick the terms box
5. Click **Save**

## 6b. Copy your two values

1. On the app page click **Settings**, top right
2. Copy the **Client ID**
3. Click **View client secret** and copy that too

## 6c. Run the login helper

```bash
npm run spotify:login
```

- Paste the Client ID when it asks, press Enter
- Paste the Client Secret when it asks, press Enter
- It prints a long URL — copy it into your browser and go there
- Click **Agree**
- The page says "Done — you can close this"

## 6d. Save the three lines it prints

Copy all three into your `.env` file, replacing the commented-out versions:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REFRESH_TOKEN=...
```

They never expire. **Keep them private** — do not put them in a message and do
not commit them to GitHub.

---

# PART 7 — Making new rounds from now on

**Always build new rounds on your own computer, never on the live site.**
Anything generated on the live site is wiped the next time you push a change —
including its record of which songs it used.

```bash
cd MusicQuizApp
git pull
npm start
```

Then in the Console:

1. Type a theme into **New bingo round**
2. Press **Build it**
3. When it finishes, open the **Editor** and read through it
4. Stop the app with `Ctrl` and `C`

Then send it to the live app:

```bash
git add bingo/ quizzes/ images/ data/track-history.json
git commit -m "New round for Friday"
git push
```

That last file — `data/track-history.json` — is the one that remembers which
songs you have already used, so the generator stops repeating them for three
months. It only works if you commit it.

---

# PART 8 — Your routine on the night

**Before you leave the house**
- [ ] Open the Console and check the right pack is loaded
- [ ] Phone charged, Control view bookmarked

**At the venue, before people arrive**
- [ ] Laptop on, HDMI in
- [ ] Open the **Big screen** address **five minutes before** the room fills
- [ ] Blank page? That is the free tier waking up. Wait a minute. Do not keep
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
- [ ] Unplug HDMI and **shut the laptop**. That is all — it puts itself to
      sleep on its own.

---

# PART 9 — Before your first paid gig

- [ ] **Read all 30 questions** in the Editor. I wrote them and I am confident
      in them, but you are the one standing there if one is wrong.
- [ ] **Full dry run at home** — big screen, two or three phones, play a whole
      round. Do it once with **wifi off on the phones and mobile data on**,
      because that is what your room will be using.
- [ ] **Test round 3 properly** — music app open, and check your phone tells
      you what to play while the big screen gives nothing away.
- [ ] **Switch to the paid tier.** Render → your service → **Settings** →
      **Instance Type** → **Starter** ($7/mo). It is a dropdown, applies
      instantly, and you can switch back any time. What it buys is removing the
      "arrived late, forgot to open the screen early, sixty people scanned into
      a blank page" problem. About 3% of one night's fee.

While you are on the free tier: **shut the laptop when you leave.** While a
browser tab is open on the app it pings the server to keep it awake, and a
laptop left running for days with that tab open would use up the free monthly
allowance. Closing the lid is enough.

(Nothing to do with the HDMI cable — the server has no idea whether a projector
is plugged in, it only sees the browser tab. Players' phones do not count
either: phone browsers suspend background tabs the moment the screen locks.)

---

# Later in the project

Talked about and designed for, but not built:

- **Photo uploads to the big screen**, published straight away with a kill
  switch for you
- **Filters on those photos** — ours work on day one; Snapchat's need a
  business account and their approval
- **Filters on the round 2 portraits** — nearly free, just a different prompt
- **Semi-automated social posting** — the app bundles the night's photos, you
  tap post
- **Team play** (several phones, one score) and **venue branding**
- **Your own domain** — about £10/year, steps are in DEPLOY.md

Not building: **Instagram follow for points.** No API can verify that somebody
followed you, so it would be a button that lies. Awarding it by hand from your
Control view works and is honest.

---

# If something goes wrong

**Blank page when you first open it**
The free tier waking up. Wait 60 seconds. Do not keep refreshing.

**"Wrong host key"**
The key in your address does not match `HOST_KEY` in Render. Check it at
**https://dashboard.render.com** → your service → **Environment**.

**Phones join but nothing updates**
Venue wifi. Tell people to turn wifi off and use mobile data — the app is built
for exactly that and uses barely any.

**A question turns out to be wrong mid-quiz**
**Skip** on your Control view. It takes back any points it awarded.

**Everything has gone wrong**
Console → the game you want → **Launch**. That starts it completely fresh.
Teams have to rejoin, but that takes them ten seconds.

**Still stuck**
Render dashboard → your service → **Logs**. The errors are in plain English.
