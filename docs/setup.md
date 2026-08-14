# Setting the app up — the host's own steps

Step-by-step setup, moved out of TODO.md. **Nearly all of this is done** —
kept because it is the record of how, and what to redo if a key is lost.

---

## WHEN YOU GET BACK — in order

Setup is finished. `HOST_KEY`, the private repo, your owner account and the
backups are all done and confirmed live, so nothing below can lock you out or
lose work. What is left is proving it on your own kit and two decisions.

### 1 · Prove it end to end — 10 minutes, and this is the one that matters

Everything else has been tested by me on a copy. This is the only test on YOUR
Render instance with YOUR data.

🔗 https://musicquizapp.onrender.com/login → sign in, then tap **Quizmaster**
on the switch top right.

- [ ] Launch a quiz from your quizmaster console
- [ ] Note the **4-letter join code** it shows you
- [ ] Big screen at `…/screen?g=YOURCODE` — check the QR is there
- [ ] Join from your phone at `…/play?g=YOURCODE`, answer one question
- [ ] Launch a bingo game, mark a square
- [ ] **Then redeploy** (Manual Deploy on Render) **and sign in again.** This
      is the only real proof the backup works — everything above passes just as
      happily on a disk about to be wiped.
- [ ] Check the quiz you launched now says **"Played 1 time"** and not
      "Never played". That is the fix from this session; if it says never, tell
      me, because it means the restore is not firing.

**Fallback on the night:** your host key still works and still beats a signed-in
account. 🔗 https://musicquizapp.onrender.com/console?key=…

### 2 · Read Thursday's quiz through — 20 minutes

The one thing no amount of code protects you from is a wrong answer in front of
a paying room. Open the pack, press **Read**, and work down the review flags —
each tick is stored in the pack itself, so it survives a restart and you can
stop halfway.

- [ ] Pick which pack you are running Thursday
- [ ] Read it through and tick the flags off

### 3 · Dry run on mobile data — 15 minutes

The one failure a home test cannot find: a venue's network holding the event
stream in a buffer, which freezes every phone at once. Turn your laptop's wifi
off, tether it to your phone, and run a few questions with a second phone
joined.

- [ ] Works on mobile data
- [ ] Ideally: test at the venue itself, days before, never on the night

### 4 · Spotify — 5 minutes, optional

**Not the token.** That was regenerated and it changed nothing; the console now
confirms the login holds all four playlist scopes. Two checks left, both in
🔗 https://developer.spotify.com/dashboard

- [ ] Is the dashboard signed in as **djmarkstar** — the account that
      authorised? If the app is owned by a different account, adding
      `djmarkstar` under User Management adds it to a list your token is never
      checked against, which looks exactly like the setting not working.
- [ ] Does the **User Management** entry match the full name AND email on that
      Spotify account exactly? A near-miss silently does nothing.

If neither is it, stop. The browser route works and is the better order for
bingo anyway. Round 3 cues already carry Spotify links from the two builds you
ran, so the control view can tap through to each track regardless.

### 5 · Have a look at what changed while you were out — 5 minutes

All live, all safe: **nothing anybody can see has changed unless you switch it
on.**

🔗 https://musicquizapp.onrender.com/console?tab=account (put the Quizmaster hat
on first, or the page has no ladder to draw)

- [ ] **Each feature is now an On | Off switch**, the same control as the
      Owner | Quizmaster tab in the top right, rather than a tick box. A tier
      above yours shows a **+** instead — you did not switch it off, you do not
      have it, and those needed telling apart.
- [ ] **A "Your library" panel** above the ladder. It says how many packs you
      can reach and, only when something is out of reach, which tier holds the
      rest. Silent today, because everybody can reach everything.
- [ ] **Deep links to a read-through**, which is the phone job:
      `…/console?read=quiz:metallica`

**What is underneath it, and what is NOT switched on:** every tier can still
reach every pack. The mechanism to give Bronze a starter set is in and tested,
but `TIER_PACKS` says `'all'` for all three, so no library changed. Switching
it on later is one line — or a `packs` list on one account, which beats the
tier.

### 6 · Two decisions I am waiting on — no rush, nothing is blocked

- [ ] **Which features sit on which tier, and the prices.** `FEATURE_TIER` is
      one word per feature. The quickest way to settle it is to put the hat on,
      pick **Bronze** on the switch, and spend two minutes seeing whether it
      reads as a free tier or a crippled app.
- [ ] **What goes in the Bronze starter set** — which packs, and how many.
      That is the whole upsell now, so it is worth more thought than the
      feature list. One line in `TIER_PACKS` when you decide.
- [ ] **Two bits of wording that stop being true the day you switch it on:**
      the Bronze blurb says "read and play every quiz and bingo game in the
      shop", and there is a **Buying packs** feature listed that nothing
      implements. Both are on the account page a subscriber reads.
- [ ] **Advert slides: owner-only, or per quizmaster?** They are shared today,
      which means a second quizmaster tidying up what looks like their own venue
      list would delete The Crown's set off your projector. Nobody else has a
      login yet, so it is safe — but it needs deciding before Rob gets one.

### 7 · Costs money — before the first PAYING gig, not before Thursday

- [ ] **Render Starter, $7/month.** Stops the app sleeping between gigs. Your
      current routine (open the big screen five minutes early) covers the free
      tier, but it is one less thing to remember.
      🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/settings
- [ ] **OpenAI key, ~£8 then pennies.** Round 2 runs on placeholder art until
      then. Everything else works without it.

### 8 · When you have their emails

- [ ] Add **Rob**, and **James** if he is in — two minutes each on
      🔗 https://musicquizapp.onrender.com/owner
      They get their own game, join code, photo wall, name and colours, and
      read-only packs. You need no second account for yourself.

---

## The full list, with A-C now done

Nine things. Tick them off as you go — each one says how long, what it costs,
and what happens if you skip it.

| | What | How long | Cost | If you skip it |
|---|---|---|---|---|
| A | Set `HOST_KEY` on Render | 2 min | free | ✅ **DONE** |
| B | Make a private repo | 10 min | free | ✅ **DONE** — accounts, invoices, reports and play counts all back up |
| C | Make your accounts | 5 min | free | ✅ **DONE** — owner account made and survived a redeploy. Rob and James still to add |
| D | Fill in your invoice details | 5 min | free | invoices have no bank details, so nobody can pay them |
| E | Read a quiz through before a gig | 20 min | free | a wrong answer in front of a paying room |
| F | Dry run on mobile data | 15 min | free | the one failure a home test cannot find |
| G | Move to the $7 Render tier | 5 min | $7/mo | the app sleeps between gigs |
| H | Finish Spotify | 10 min | free | ⚠️ token ruled out — two dashboard checks left, see step 4 above |
| B2 | Make a **second** private repo, for subscribers' own packs | 10 min | free | a quizmaster writes their own quiz and loses it on the next deploy |
| I | OpenAI key | 20 min | ~£8 then pennies | round 2 uses placeholder drawings |

**A, B and C are done and confirmed live.** The sections below are kept for
reference and for when something goes wrong, not as work outstanding.

**Rob and James can have logins.** Each gets their own running game — they
cannot launch over the top of your night — their own join code and their own
photo wall, and read-only use of your packs.

**They cannot edit or generate your packs**, on purpose. What they CAN do is tap
**"Something wrong with this one?"** at the bottom of the answer key on their
control view. One tap, no typing, mid-gig. It lands on your owner page with the
question, the answer, which pack, and who reported it — so corrections reach you
without anybody being able to change a word of a pack.

---

### A. Set your host key on Render — 2 minutes, free, DO THIS FIRST

**This is the one that locked you out of your own console.**

If `HOST_KEY` is not set, the app invents a new key on startup and keeps it in
`data/` — which Render's free tier wipes on every deploy. So every single deploy
invents a different key and every bookmark you have stops working, with nothing
on screen saying why. The app now prints a warning about this in its startup log,
but the fix is thirty seconds.

- [ ] 🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env
      Look for `HOST_KEY`. If it is not there, add it with any long phrase you
      will not forget — `mark-quiz-night-2026` is fine. Save.
- [ ] Check: the warning is gone from the startup log, and your bookmark works
      after the redeploy.

**If you are locked out right now**, the current key is in the startup banner:
🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/logs — scroll to
the box with your brand name in it and read the `Host key:` line. Paste that
into the console's key box, then do the above so it never happens again.

Detail: **Part 2a** below.

---

### B. Make a private repo — 10 minutes, free

Your app has no permanent hard disk. Anything it saves is wiped every time it
redeploys. Your quizzes are safe because they live in your public repo, but
**invoices, accounts and photos cannot go there** — that repo is public and
git history is forever, and those files have customer addresses, your bank
details and password hashes in them.

So they need a second, private repo. Once set up, everything files itself.

- [ ] Make it. 🔗 https://github.com/new
      Name it `mmm-private`, tick **Private**, tick **Add a README**, Create.
- [ ] Check your token can reach it. 🔗 https://github.com/settings/tokens
      Open the token you already made. If it says **All repositories**, you are
      done. If it lists repos, add `mmm-private` and Save.
- [ ] Tell the app. 🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env
      Add one variable: `PHOTO_REPO` = `markh1984-spec/mmm-private`
      (use your own GitHub username if it differs). Save — it redeploys itself.
- [ ] Check. Open the Invoices tab. The red "not being backed up" warning
      should be gone. 🔗 https://musicquizapp.onrender.com/console

Full detail if you get stuck: **Part 7f** below.

---

### B2. A second private repo — for THEIR packs, not yours — 10 minutes, free

A quizmaster can now write their own quizzes and bingo games. Those are **their
work, not yours**, and the app enforces that: you cannot read one unless they
switch on support access, and when they do, what you looked at goes in a log
they can read.

Which is exactly why they cannot go in `mmm-private`. That one holds your
accounts, your invoices and your customers' addresses. Somebody else's material
does not belong in with your business records, and there is deliberately no
fallback in the code — if this variable is missing the app says so in red on
their console rather than quietly filing their quiz next to your sort code.

Until you do this, their packs work perfectly and vanish on the next deploy.
Their console tells them so and every pack of theirs has a **Download** button,
so nothing is lost silently — but it is not somewhere you want a paying
subscriber to be.

- [ ] Make it. 🔗 https://github.com/new
      Name it `mmm-packs`, tick **Private**, tick **Add a README**, Create.
- [ ] Check your token can reach it. 🔗 https://github.com/settings/tokens
      If it says **All repositories**, you are done. If it lists repos, add
      `mmm-packs` and Save.
- [ ] Tell the app. 🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env
      Add one variable: `PACKS_REPO` = `markh1984-spec/mmm-packs`. Save.
- [ ] Check. Wear the quizmaster hat, open the Music Quiz tab, and the red
      "Not backed up" line under **Write your own** should be gone.

> **Worth knowing, and worth saying to a subscriber honestly if they ask.**
> This is not encryption and nobody should tell them it is. You run the server
> and the backups, and the server has to be able to read a quiz to put it on a
> projector. What the app promises is that it will not let you in unless they
> let you, and that there is a log. That is what every hosted service offers,
> and it is a better answer than a promise.

---

### C. Make your accounts — 5 minutes, free

You now get two accounts, deliberately kept apart:

- **the owner** — you the app dev. Manages quizmasters, writes and generates
  packs. No quiz controls anywhere near it.
- **the quizmaster** — you on a Wednesday night. Runs the games.

**Make the first one from the Console — no terminal needed.**

- [ ] Open 🔗 https://musicquizapp.onrender.com/console with your key
- [ ] There is a **"No accounts yet — make yours"** panel at the top. Name,
      email, a password of at least 10 characters, press the button. That is
      your owner account. The panel disappears once it has worked.
- [ ] Sign in 🔗 https://musicquizapp.onrender.com/login — you land on the
      owner page.
- [ ] On the owner page, **Add a quizmaster** for your own Wednesday-night
      login (tick comped — free, everything on), and another for Rob.

A short sentence makes a better password than punctuation and is easier to
remember.

Still available from a terminal on the Mac if you prefer:

```bash
npm run accounts -- add-owner --email you@example.com
npm run accounts -- list
```

You land on the right page automatically. Signing in as the owner takes you to
the subscriber list; as the quizmaster, to the usual console.

**Your `?key=…` bookmarks still work exactly as before.** Nothing about tonight
changes. The key stays until you are happy with the logins.

*Note:* accounts made on your Mac are on your Mac. Make the live ones on the
live site. **And do step B first** — without the private repo they are wiped on
the next deploy, because Render gives the free tier no permanent disk. With it,
they back themselves up and come back on their own.

---

### D. Fill in your invoice details — 5 minutes, free

Do this before you try to invoice anybody, or the PDF goes out with no bank
details on it.

- [ ] Open the **Invoices** tab 🔗 https://musicquizapp.onrender.com/console
- [ ] Press **Your details**. Fill in your trading name, address, and the
      account name, sort code and account number people should pay into.
- [ ] Press **Customers** and add a venue or two — name, contact, address, and
      what you usually charge them. The fee then fills itself in.
- [ ] Leave VAT switched off unless you are actually registered.

Then billing a night is: finish the quiz → **Invoice this** on the console →
check the number → **Issue and send**.

### E. Read a quiz through before you run it — 20 minutes, free

The generator is good and still gets things wrong. Every pack gets read once
before a room sees it.

- [ ] Open the console, press **Read** on the pack you plan to run
      🔗 https://musicquizapp.onrender.com/console
- [ ] Work down the flags at the top and tick each one off as you read it
- [ ] If it says the answers are lopsided, press **Even out the answers**

Detail: **Part 3** below.

---

### F. Dry run on mobile data — 15 minutes, free

The one failure you cannot find at home is a venue's wifi or a company's
firewall. Test on the network you will actually be on.

- [ ] Open the big screen, launch a quiz, join with two phones **with wifi
      switched off** so they are on mobile data
- [ ] Answer a couple of questions, check the scores look right
- [ ] Kill the browser tab on one phone and reopen it — the score should come back

**For a corporate booking, do this on THEIR network a few days before.** If it
works for one person on their wifi it will work for three hundred. What their
IT team needs to allow is in README.md under "How many people can play" — it is
a short list and does not include websockets, which is usually the thing they
say no to.

---

### G. Move to the $7 Render tier — 5 minutes, $7/month

The free tier goes to sleep and gets a small slice of a processor. Agreed before
the first paying gig.

- [ ] 🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/settings
      Find **Instance Type**, change Free to **Starter**.

This also removes the need to open the big screen five minutes early to wake it.

---

### H. Finish Spotify — 10 minutes, free, optional

Everything works except the very last step: creating the playlist is refused
with a bare "Forbidden". Three things to try, in order. Stop when one works.

- [ ] **Re-run the login.** In a terminal, in that folder:
      ```bash
      cd ~/Downloads/MusicQuizApp-MusicQuizApp
      npm run spotify:login
      ```
      Same Client ID and Secret, click **Agree**. On Render replace **only**
      `SPOTIFY_REFRESH_TOKEN` — leave the other two alone.
      🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env

      *Why first:* Spotify grants permission per app-and-user, and yours was
      granted before that account was added to User Management.

- [ ] **Check which account the dashboard is logged in as** — top right.
      🔗 https://developer.spotify.com/dashboard
      An app owned by a different account from the one you authorised is the
      obvious mismatch.

- [ ] **Check the User Management email matches exactly** the email on that
      Spotify account. A near-miss silently does nothing.

**You are not blocked meanwhile.** Ask Claude in your browser for a round, paste
what it prints into the **Import** box in the console. That is now the quickest
way to build a bingo game anyway, and it is described just below.

---

### I. OpenAI key for round 2 portraits — 20 minutes, ~£8 then a few pence a quiz, optional

Round 2 uses obvious placeholder drawings until this is done. They work; they
are just not real portraits.

**It is much cheaper than the 50p a quiz you were quoted.** Two things changed.
Pictures are now filed under the musician rather than under the quiz, so the
second quiz that wants Madonna reuses the one you already paid for — on a full
library most of a round costs nothing. And the quality setting was never being
sent at all, so every picture was made at OpenAI's dearest setting; it is
medium now, and low is worth trying. Roughly, per picture: low about 1p, medium
about 4p, high about 14p. The Pictures panel prices the press before you make
it.

- [ ] Make an account 🔗 https://platform.openai.com/signup
- [ ] Put £8 of credit on 🔗 https://platform.openai.com/settings/organization/billing/overview
- [ ] Make a key 🔗 https://platform.openai.com/api-keys
- [ ] Add it on Render as `OPENAI_API_KEY`
      🔗 https://dashboard.render.com/web/srv-d9pnk0e417fc73bvjdkg/env
- [ ] Press **Pictures** on any quiz with a face round

Detail: **Part 6** below.

---

## Building a bingo game, from now on

**Two steps, and this is the quickest route even once Spotify is fixed.**

1. **Ask Claude in your browser for the round.** It reads your no-repeats list
   straight off this repository, so it already knows every song you have used
   in the last three months and will not pick one. It builds the private
   Spotify playlist and then prints the tracks in a code block.
2. **Paste that block into the Import panel** in the console and press
   **Import**. Nothing to fill in first; the box is the first thing on the
   panel.

You get a pack whose cards are exactly the songs in the playlist, and every one
of them goes into the no-repeats list — which the app pushes back to GitHub
straight away, so next week Claude already knows about them.

**Import on the live site** 🔗 https://musicquizapp.onrender.com/console —
not a copy on the laptop. That is where the GitHub token lives, and the push is
what keeps Claude's list current.

**Then glance at the banner.** Green means those songs reached the list. Amber
means they did not — the round is still fine, but Claude will not know about
them, so import it again.

---

## Giving Rob a login — the short version

1. Open your Console with your key, as usual.
2. If you have never made an account, there is now a **"No accounts yet — make
   yours"** panel at the top. Put your name, your email and a password in it and
   press the button. That makes YOUR owner account.
3. Sign in properly at 🔗 https://musicquizapp.onrender.com/login
4. You land on the owner page. Press **Add a quizmaster**, put Rob's email in,
   and it gives you a password to send him. (Your own second hat is the
   **Owner | Quizmaster** switch in the top right — no extra account needed.)
5. Rob signs in at the same `/login`. He gets **his own everything**: his own
   game, his own join code, his own photo wall, and your whole pack library to
   play with (he cannot edit or generate — that is yours).

**Rob's players use a different link from yours.** His console shows a four
letter join code, and his projector's QR has it built in. His phones go to
`/play?g=XXXX`; yours still go to plain `/play`, so nothing you have printed or
bookmarked changes.

⚠️ **Two things to do first, or this does not work.** Set `HOST_KEY` (step A) or
you cannot get into the Console at all after a deploy — that is what stopped you
on the phone. Then set up the private repo (step B) BEFORE you
create Rob's account — otherwise it works today and is gone at the next deploy.
The Console says so in red if it is not set up.

---

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

Type "1990s indie" and get a whole quiz or bingo game built.

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
      Potter soundtracks`), tick which rounds you want, **put a number next to
      each one**, press **Write it**. Takes about a minute for three rounds.

      There are **five** round types to tick, each with its own count — so
      fifteen general knowledge, five pictures and ten first-letter is one job
      rather than ten of everything:

      *General knowledge*, *Whose face*, *Name that intro*,
      **Pick them all** — several answers are right and the room locks in all
      of them, six options, part marks — and
      **First letter** — no options at all: the room gets a keyboard and only
      the first letter of the answer has to be right. Spelling never costs
      anybody a point, which is the whole idea. The last two are off by
      default; tick them to try.

      One thing to know about the first-letter round before you write your own:
      **an answer can never start with "The", "A" or "An".** "The Beatles" is B
      to half a room and T to the other half, and both halves are right. The
      app refuses to save one, the editor tells you as you type, and the
      generator is told not to write one.
- [ ] **New bingo game** — type a theme, press **Build it**.

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
- **Make real portraits** — tells you the total first and asks before spending.
  Disabled until `OPENAI_API_KEY` is set.

Neither replaces a picture already there unless you tick *replace ones already
there*, so a portrait you have paid for cannot be overwritten by accident.

### The line above the buttons is the one to read

> **6 already in the library, free · 4 to draw — about 16p**

Pictures are filed under the **musician**, not under the quiz. So the first
time a quiz wants Madonna you pay for her; every quiz after that gets her for
nothing, automatically, with nothing to remember. On a library you have been
building for a while most of a round will say "free".

### Two settings next to those buttons

**Style** — *Portrait* (painted, true to life, the default and the easiest for
a room to recognise), *Cartoon*, or *As a superhero*.

⚠️ **Each style is a whole separate library of the same people.** A superhero
Madonna is a different picture from a portrait Madonna, so switching style
means paying for everybody again. The line above the buttons tells you: pick
superhero and the "free" part disappears. Worth it for a themed night, not
worth flicking between.

There is deliberately no photo-realistic option. The caption on screen says
"AI-generated illustration — not a real photograph", and that line is doing
legal work in a pack you sell — a convincing fake photo of a living musician is
the one version worth not having.

**Quality** — low, medium or high. This was never being set at all before, so
everything you have made so far was at OpenAI's dearest setting. Roughly 1p, 4p
and 14p a picture. **Medium is the default.** The round shows the picture
zoomed, pixelated or behind tiles for most of its twenty seconds, to a room
several metres from a projector — so try low on one round and see whether you
can tell from the back of the pub. If you cannot, that is your setting.

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

Optional. Without it bingo games still generate, you just build the playlist
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

You do not have to generate every bingo game from a blank box. On the **Music
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

1. Type a theme into **New bingo game** and press **Build it** — or paste a
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
- **Scores to the room** — put the leaderboard on the projector whenever you
  like, roughly every five questions. Press it again to hide, or just press the
  big pink button and it goes away as the quiz carries on. Greyed out while a
  question is live, because the room cannot answer what it cannot see.
  Your control view header says *Scores on the big screen* so you never have to
  turn round to check what they are looking at.
- **Scores, just me** is different — that is your own copy, on your phone.

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

# Where this might go — four directions, and what each really costs

None of this is being built yet. It is written down so that a change made
today does not quietly make one of them harder tomorrow.

**The thing that used to govern all of it is now done.** The app ran ONE game
at a time — one state file, one host key, one session, one join code — which
was right for you running your own nights and wrong for anybody else using it
at the same time. It is a room per quizmaster now: their own game, their own
join code, their own photo wall. Direction 1 was waiting on that and no longer
is.
