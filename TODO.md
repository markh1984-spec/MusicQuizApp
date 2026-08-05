# Your to-do list

Everything that needs you rather than the code. Roughly in order.

Nothing here is urgent except section 1 — the app runs right now on your
laptop with `npm start`.

---

## 1. Get it online (about 20 minutes, do this first)

Full walkthrough in **[DEPLOY.md](DEPLOY.md)** — it assumes you have never
deployed anything.

- [ ] Make a **GitHub** account if you have not got one
- [ ] Make a **Render** account (sign up *with* GitHub, saves a step)
- [ ] Push this code to GitHub
- [ ] Create the Render web service — region **Frankfurt**, start command `npm start`
- [ ] Set the environment variable **`HOST_KEY`** to a phrase you can type in
      the dark, e.g. `blue-tractor-42`
- [ ] Open `https://YOURNAME.onrender.com/console?key=YOUR_HOST_KEY` and
      **bookmark it on your phone** — everything else is one tap from there

**DECIDED: free tier**, waking it up before each gig.

The free tier sleeps after 15 minutes with no traffic and takes 30–60 seconds
to wake. Your routine on the night:

- [ ] Open the big screen **five minutes before** the room starts filling, and
      leave the tab open. Once a screen or phone is connected the app pings the
      server every four minutes on its own, so it will not drop off mid-quiz.
- [ ] If you get a blank page, that is it waking up — wait a minute, do not
      refresh repeatedly.

- [ ] **Before your first paying gig, switch to Starter ($7/mo).** Free is fine
      for testing at home. What the money buys is removing the "arrived late,
      forgot to open the screen early, sixty people scanned into a blank page"
      failure — which is a human risk, not a technical one, and it lands on the
      night you are already flustered. About 3% of one night's fee.
      Render → Settings → Instance Type → Starter. It is a dropdown, takes
      effect immediately, and you can switch back any time.

While you are on free: **shut the laptop when you leave.** While a browser tab
is open on the app it pings the server to keep it awake, and a laptop left
running for days with the quiz tab open would eat the 750 free instance-hours a
month. Closing the lid is enough — the browser suspends, the pings stop, and
the app sleeps 15 minutes later as intended.

(Nothing to do with the HDMI cable — the server has no idea whether a projector
is plugged in. It only sees the browser tab. Players' phones do not count
either: phone browsers suspend background tabs as soon as the screen locks.)

---

## 2. Before you run it in front of anyone

- [ ] **Read the 1980s quiz.** Open `/editor`, go through all 30 questions. I
      wrote them and I am confident in them, but you are the one standing there
      when one is wrong. Press **Check** as well — it catches structural
      mistakes, not factual ones.
- [ ] **Do a dry run at home.** Big screen on the laptop, two or three phones,
      play a few questions. Try it once on **mobile data with wifi off**, since
      that is what your room will be on.
- [ ] **Test round 3 properly** — have your music app open and check the cue on
      your phone tells you what to play while the big screen gives nothing away.
- [ ] Decide what you do if the projector dies mid-question (answer: **Redo**
      on your control view, it wipes the points and restarts the clock).

---

## 3. Round 2 pictures — needs an OpenAI key

Round 2 currently uses obvious placeholder drawings. They work, they are just
clearly stand-ins.

- [ ] Make an account at [platform.openai.com](https://platform.openai.com)
- [ ] Add a payment method and about **£5 of credit** (that is roughly ten
      quizzes' worth of portraits)
- [ ] Copy your API key
- [ ] Generate the real artwork:
      ```bash
      export OPENAI_API_KEY=sk-...
      node scripts/generate-images.mjs --quiz eighties --provider openai --force
      ```
- [ ] Look at all ten. Regenerate any that are unrecognisable:
      ```bash
      node scripts/generate-images.mjs --quiz eighties --provider openai --only r2q4 --force
      ```
- [ ] **Commit them** — `git add images/ && git commit && git push`. Render
      builds from git, so anything not committed does not exist on the
      deployed app.

Roughly 3–4p an image, so about 40p per quiz.

---

## 4. AI generation — needs your Anthropic key

Lets you build a whole new quiz or bingo round from a theme.

- [ ] Get an API key from [console.anthropic.com](https://console.anthropic.com)
      (this is separate from any Claude subscription — it needs its own credit,
      £5 goes a very long way)
- [ ] Add **`ANTHROPIC_API_KEY`** in Render → your service → Environment
- [ ] Also put it in your shell at home if you want to generate on the laptop
- [ ] Try it: console → type a theme → **Build it**
- [ ] **Then read every question in the editor.** Not optional.

---

## 5. Spotify playlists — one-time setup, ~5 minutes

Optional. Without it, bingo packs still generate; you just do not get a
playlist made for you.

- [ ] Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
      log in with the **same Spotify account your DJ app uses**
- [ ] **Create app** — any name. Redirect URI must be exactly
      `http://127.0.0.1:8888/callback`. Tick **Web API**. Save.
- [ ] Copy the Client ID and Client Secret from the app's Settings
- [ ] Run `node scripts/spotify-login.mjs` and follow it
- [ ] Put the three printed values into Render → Environment:
      `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`

Never expires. Keep the secret and refresh token private — do not commit them.

---

## 6. The "no repeats for 3 months" memory — a real decision

This one matters and is easy to miss, because **nothing breaks when it goes
wrong**. The history lives in the `data/` folder, and Render wipes that on
every deploy. The generator just quietly stops blocking songs it should block.

**DECIDED: generate at home and commit.** Render disks need a paid instance,
so on the free tier this is the only way the memory survives.

`.gitignore` is already set up for it — `data/track-history.json` is tracked
while the rest of `data/` is not. So the routine is:

- [ ] Build packs on your laptop (`npm start`, then the console's **Build it**)
- [ ] Commit the pack and the history together:
      ```bash
      git add bingo/ quizzes/ data/track-history.json
      git commit -m "New bingo round"
      git push
      ```

Generating on the **live** site still works, but that pack and its history
entries vanish on the next deploy. Do it at home.

---

## 7. When you fancy it

- [ ] **Your own domain.** ~£10/year for a `.co.uk`. Steps are in DEPLOY.md,
      including the `PUBLIC_URL` setting so the QR code points at it.
- [ ] **Build a themed quiz** — Harry Potter, Christmas, a decade night. It
      stays in your library forever once saved.
- [ ] **Export results** after a gig from the control view, or find them under
      **Past nights** in the console.

---

## Still open, for when you want to talk about it

Things we discussed that are designed for but not built:

- **Photo uploads to the big screen**, auto-published with a kill switch for
  you. Needs a decision on where photos are stored and how they reach your
  inbox.
- **Filters on those photos.** Snapchat's Camera Kit needs a Snap business
  account and app review; our own WebGL filters work day one. Worth starting
  with ours.
- **Filters on the round 2 portraits** — nearly free, it is just a different
  generation prompt. Say the word.
- **Semi-automated social posting** — app bundles the night's photos, you tap
  post. Full automation later needs Meta app review.
- **Instagram follow for points** — not built, and will not be: no API can
  verify a follow. An honour-system button or you awarding it by hand are the
  only honest options.
- **Team play** (several phones, one score) and **venue branding**.

---

## Things you do not need to do

- No dependencies to install or keep updated
- No database to set up or back up
- No build step
- Updating the app is `git push` and Render does the rest
