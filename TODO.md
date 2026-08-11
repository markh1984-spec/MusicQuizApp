# Your to-do list

Work down the numbered list below in order. Every step says how long it takes,
what it costs, and what happens if you skip it, with the link you need next to
it. The detailed walkthroughs are further down as **Parts** — you only need them
if a step does not go smoothly.

---

## THE WORDS, AND THE SHOP WINDOW — the biggest thing not yet started

Raised on 11 August 2026 and parked deliberately, because it is a thinking job
rather than a build and it was midnight. It is also the highest-value item on
this list, because everything downstream of it — the pricing page, what an
advertiser is sold, what a subscriber thinks they are buying — is decided by
the words.

### 1. The words are settled INSIDE the app and nowhere else

CLAUDE.md already pins **pack**, **quiz**, **bingo game** and **round**, and
those hold up in the code. What has no name at all is the thing being sold to
a venue: **a night.**

The app has no object called a night. It has games, and it has an archive
entry per evening, and Past gigs merges them with a 6am roll-over — but
nothing in the data model says "this was the Thursday at The Crown". So:

- **An advertiser is buying a NIGHT, not a quiz.** "Your slide, every
  Thursday at The Crown, in front of 60 people" is the sentence that sells.
  The app cannot currently say any part of it.
- **A quizmaster wants to name and edit a night afterwards** — which venue,
  how many were in, how it went. Asked for explicitly. The invoice book
  already holds customers with addresses, so the venue list EXISTS; a night
  should pick from it rather than inventing a second list of venues.
- That one change turns Past gigs from a list of dates into the thing a
  quizmaster shows a venue they are pitching to, which is what it was built
  for in the first place.

**Do the data model before the marketing.** A night with a venue on it is
what makes the advertising pitch true; writing the pitch first means writing
a promise the app cannot keep.

### 2. Advertising is a Silver/Gold economic argument, and it is under-sold

The advert slides sit at Silver on the reasoning that they win the QUIZMASTER
a booking rather than being part of the show. That still holds — but the
commercial size of it has never been worked out, and the host thinks it is
significant. Worth answering properly:

- What does a venue pay for a slide, and who bills it — the quizmaster or the
  owner? Today the quizmaster does, and the app is not in that transaction at
  all.
- Does the owner ever take a cut? The QR-to-ticket-sales idea in CLAUDE.md
  says yes for some slides, which is a different arrangement from a venue
  promoting its own pizza.
- Is "reach" sellable? Nights × players is a number the app already has.

### 3. A website that sells this AS A QUIZMASTER SOLUTION

There is none. There is an app and a login, and the only way in is somebody
being handed an account by hand. What a prospective subscriber needs to see
before they will pay:

- **What a night looks like** — projector, phones, the reveal. Screenshots or
  a thirty-second video, not prose.
- **What they get for the money**, in the ladder's own words: Bronze buys
  packs, Silver includes them, Gold is a fresh topical quiz every week.
- **Proof it is run by somebody who does this for a living**, which is the
  differentiator against a generic quiz app. Past gigs is that proof.
- **The honest limits**, because a quizmaster who buys and then finds out is
  a refund and a bad review: they cannot generate their own packs, and the
  starter set is eight.

Note what this implies and is NOT built: a signup flow, a payment processor
and a public marketing page. See "Pay-per-pack is deliberately NOT built" in
CLAUDE.md — the data model is ready, the money is not.

### Where to start

The words, then the night object, then the page. In that order, because each
one is the input to the next and doing them the other way round means writing
the page twice.

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

## Asked for, not yet specced

### Rewrite the eight starter packs — before anybody pays

**The most important content job there is, and it is yours rather than mine.**

Bronze now starts with four quizzes and four bingo games. Those eight are the
first thing a paying subscriber ever sees, and they decide what somebody thinks
the whole catalogue is worth — but the current library was put together to have
something to test against, and you have said so yourself.

What to aim at, since a starter pack has a different job from a normal one:

- **They have to work in ANY room.** A new subscriber is walking into a venue
  you have never seen. Decades and genres, not artists.
- **They have to be the best in the catalogue, not the average.** Somebody
  deciding whether to buy a ninth pack is deciding on the strength of these.
- **Read every one through.** The review flags on the console catch the
  mechanical faults; the taste is yours.

The eight are listed in `TIER_PACKS.bronze` in `public/assets/plans.js`. Change
the list in the same breath as renaming a pack — a rename silently drops a pack
out of Bronze, and there is a test that fails if an id in that list is not in
the catalogue.

### A marketplace: quizmasters write, you resell, they earn credit

Your idea, and a good one. A subscriber who enjoys writing submits a pack, you
sell it in the catalogue, they get 50% as **credit against their account**
rather than money. Written up here rather than built, because two of the
questions below have to be answered before a line of code.

**The real win is not free content — it is that your time changes job.** The
catalogue has to keep growing or Silver stops being worth paying for, and today
that is your writing hours forever. This does not remove the editorial step and
must not: a badly written pack in your catalogue reflects on YOUR app, because
the buyer sees a Quiztopia pack, not Rob's pack. But **reading three packs
through is far quicker than writing three**, and the read-through machinery
already exists — the review flags, the tickable warnings, the answer-balance
check. So the job becomes "read it, tick the flags, press Accept".

**Credit rather than cash is the right call and worth protecting.** No payouts,
no bank details, no minimum thresholds, no self-assessment questions, no
processor fees on the way out. Credit is a discount on something they already
buy. The moment it becomes money it becomes a finance function.

**Be honest about the size of it.** At £3 a pack and a 50% share, a sale is
£1.50 — so seven sales covers a month of Bronze and fourteen covers Silver. On
a subscriber base of thirty, a good pack might sell a handful of times. That is
**a discount for people who enjoy writing, not a side income**, and pitching it
as the second would disappoint everybody. Pitched as the first it is a genuinely
nice thing to offer.

**Two things to settle BEFORE building anything:**

1. **A one-page agreement.** Who owns the pack once it has sold; whether they
   can sell it elsewhere too (non-exclusive is the sensible answer); what
   happens to it in the catalogue if they leave; and the author warranting it
   is their own work and not copied out of somebody else's quiz. This is a page,
   not a legal project — but the first dispute is unanswerable without it, and
   the first dispute always comes after the money has moved.
2. **What happens to credit if they cancel.** Answer it up front rather than
   the day somebody asks. Rolling over is simplest; letting credit buy PACKS as
   well as subscription time is nicer, because it closes the loop and gives
   somebody who earns more than their subscription costs somewhere to spend it.

**Then the build, and it needs the shop taking money first** — credit is
meaningless until there are purchases to discount.

- **A credit ledger, not a number on an account.** Same rules as the invoice
  book: integer pence, never a float, entries never rewritten. "You have £6" is
  not enough; the first time somebody queries their balance you need to show
  them the four sales it came from.
- **Submitting is publishing, and the page has to say so unmistakably.** Today
  the strongest promise this app makes a subscriber is that you cannot read
  their packs. Submitting one is them opening that door deliberately, which is
  consistent — but it cannot be a button they press by accident, and it cannot
  be quietly undoable, because by then you have read it.
- **Credit the author, and give them their own SECTION and TAG.** Settled.
  It does two jobs at once: the author gets the credit, and a "written by
  quizmasters" shelf keeps your own house style a distinct thing rather than
  something that quietly dilutes as the catalogue fills up. A buyer knows what
  they are getting, which protects you — and your read-through is still what
  puts a pack on that shelf at all, so the quality guarantee is unchanged.
  Same shape as the **Yours** tag on a subscriber's own packs, and the shop
  grid already splits into sections, so neither is new machinery.

One thing it quietly fixes later: if topical content is what sells Silver, other
people writing topical rounds — for their own regions, their own crowds — is
worth more than one person can produce.

### PayPal — the half that is built, and the half that is blocked

**Subscriptions rather than invoices**, on your own reasoning: chasing ten
quizmasters every month is worse than chasing venues, and PayPal charges the
card by itself.

#### Built and tested — `src/billing.js`

The processor-agnostic half, which is the half that matters because **you are
on 2.9% and expect to move to Stripe.** Five events and nothing else — started,
renewed, payment_failed, cancelled, expired — applied to an account by one
function. Four properties, all with tests:

- **A webhook may only ever move a SUBSCRIPTION.** It sets a tier and a status
  and stores an opaque reference. It cannot set `comped`, a role, `packs`, an
  email or a password. That endpoint is reachable by anybody who finds the URL
  and a signature check is the only thing in front of it, so a bug there has to
  cost a wrong tier and never an account.
- **A failed payment moves the STATUS and never the tier**, which is the rule
  this codebase already has tests for: a lapsed subscription never interrupts a
  night. Dropping somebody to Bronze because a card expired on a Tuesday would
  take their packs away mid-week.
- **An older event can never roll a subscription backwards.** Webhooks retry
  and arrive out of order, and a stale "cancelled" landing after a fresh
  "started" would close an account somebody has just paid for. Same lesson the
  invoice counter learned.
- **Nothing outside a processor's own adapter knows which processor it is** —
  there is a test that greps the code for the words. Moving to Stripe is one
  new adapter file and one route, not a search through the codebase.

#### Blocked — the PayPal adapter itself

`developer.paypal.com` is blocked by this environment's network egress policy,
so the API surface cannot be read from here. **The adapter has deliberately NOT
been written from memory.** A wrong webhook-verification path is not a bug, it
is a hole where anybody can POST "subscription activated" and hand themselves
Gold — which is exactly the wall `billing.js` exists to keep narrow.

Two ways to unblock it, either is fine:

1. **Allow `developer.paypal.com` and `api-m.sandbox.paypal.com`** in the
   environment's network settings (see the Claude Code on the web docs), and it
   gets written and tested against the real shapes.
2. **Paste the relevant doc pages in**, or hand over sandbox credentials — the
   sandbox API answers questions about itself.

#### What is needed from you either way — about 5 minutes

On the kids'-party PayPal business account, at developer.paypal.com:

- `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` — **sandbox first**, so nothing
  touches real money until the whole loop is proven
- `PAYPAL_WEBHOOK_ID` — from creating a webhook pointed at
  `https://musicquizapp.onrender.com/api/paypal/webhook`

#### Then, and it is small

- `src/paypal.js` — token, plan creation, webhook signature verification.
- `scripts/paypal-setup.mjs` — creates the product and the three plans **from
  `TIERS` in plans.js**, so the price on the ladder and the price PayPal charges
  cannot drift apart.
- `POST /api/paypal/webhook` — verify, translate to one of the five events,
  hand to `applyBilling`. Nothing else.
- A Subscribe button per rung on the account page. Card details never reach
  this server.

#### One number worth knowing before the pack shop opens

At 2.9% plus a fixed fee, **the fixed fee is what hurts a £3 pack sale and
barely touches a £30 subscription.** Roughly: a £3 pack keeps about 87% after
fees, a £30 subscription keeps about 96%. That is another quiet argument for
the subscription being the business and the pack sale being the on-ramp, which
is what the pricing already assumes — and if pack sales ever become common, it
is an argument for selling three at once rather than one at a time.

### ~~Flooding a game with fake teams~~ — BUILT

`src/joins.js`. A lot of NEW phones at once are **held** rather than refused,
and the host's board says *"288 phones waiting to join — Let them in"*. One tap
lets the lot through. The number is what tells a room from mischief.

A phone that can prove who it is never queues, so a reconnection storm after a
restart is not mistaken for a flood. The threshold errs loose on purpose — a
false hold stops the show, junk teams are one tap to tidy. Per-IP limiting was
considered and rejected: a pub puts the whole room behind one router.

Also built: **"Remove the N who have answered nothing"** on the player board,
which is worth having for tidying a lobby whether or not anybody floods you.

See rule 4 in CLAUDE.md.

### Group accounts — SEATS on a Gold, for a quizmaster company

Your idea, and the interesting half of it is not the discount.

Rob runs a company (Interrupt the Routine) with more than one host. Today his
only options are three separate Gold accounts at £90 a month, or one account
shared between three people — and the second one breaks a night, badly, see
**A shared login can end somebody else's night** below.

**The real win is INTERNAL PACK DISTRIBUTION, and it dissolves the objection
that blocked pack sharing.** CLAUDE.md says a quizmaster cannot share a pack
with another quizmaster because "anything better needs a story about who owns
the copy afterwards". A company IS that story. Between two independent
quizmasters ownership is ambiguous; inside one company it is not — the company
owns it, and nobody has to agree on anything. So the company writes a quiz once
and every host can run it, in the app, without it ever leaving the company or
passing through the owner.

**Settled, after a long argument about the price. £20 a seat, all-in.**

- **A seat gets EVERYTHING**, not the company's tier passed down. "Every seat
  gets the lot, £20" is a price rather than a rule you have to explain, and it
  is what makes the company pitch true — every host can run this week's topical
  quiz. The only exception is **streaming**, which stays out because egress is
  the one genuinely per-use cost and it scales per head; price it per seat when
  it exists.
- **Per-seat tiers were considered and rejected.** Letting a company buy a
  Bronze seat for a part-timer is attractive — the upsell would then run per
  head, forever — but it breaks on how the work actually flows. **The cheapest
  seat is always the cover host, and the cover host is the person who needs the
  widest library at the shortest notice.** It also makes "every one of our
  hosts runs a current quiz this week" untrue for the cheap seats, which is the
  pitch the whole thing is meant to sell. £3 a month of extra revenue, three
  SKUs to build, and it undermines its own product.
- **A usage-capped "part time" seat was considered and rejected too.** Gold
  functionality at a Bronze price with a limit on nights per month. The fatal
  version is the obvious one: a cap that REFUSES is this codebase's first rule
  broken at the worst possible moment — the cover host, at the venue, on night
  five of four, with sixty people in. The only safe version bills rather than
  blocks, and then it needs a definition of "a night" that survives a crash, a
  redeploy and a quiz-then-bingo evening (a distinct calendar day with at least
  five players joined is the one that would hold), plus variable billing, which
  is strictly harder than the fixed subscriptions that do not exist yet. **The
  trigger to build it: a company tells you they are keeping a host off the
  books because of the price.** Until then it is a solution looking for its
  problem.

#### Why £20 rather than £15 or £10

The number moved twice during the argument, so the reasoning is worth keeping.

**£10 is the only one that is clearly wrong**, and it is arithmetic: for the
seat route to stay dearer than everybody buying Silver separately, a seat has
to cost more than `(20N - 30) / (N-1)` — **£10 at two hosts, £15 at three,
£17.50 at five.** So £10 breaks at the commonest company size, and £20 is the
only price where a seat never undercuts a tier at any headcount. The ladder
then reads cleanly: *a seat is cheaper than a Gold account and dearer than a
Silver one.*

Two arguments that are not arithmetic and still hold:

- **Your cheapest SKU becomes your reference price.** Price a whole working
  quizmaster at £10 and "£10 a head" is what your app costs, whatever the
  website says. That number travels between quizmasters and is very hard to
  walk back.
- **Support is the one genuinely per-seat cost.** Compute and content are
  free at the margin; people are not. Twenty companies at three hosts is sixty
  people who can email you.

And the host's own argument, which is what settled it: **Gold-plus-a-seat is
better value than two Silvers at the same money, which means the price was too
low, not that Silver was being cannibalised.** The revenue is identical either
way (£40 for two people) — so there was never a loss to protect against, and
the right response to "my product beats the alternative at the same price" is
to charge more of the difference.

#### What a seat gets that a separate Silver account does not

The table that actually sells one. Same price, £20 either way:

| | Gold seat | Individual Silver |
|---|---|---|
| Whole evergreen catalogue | yes | yes |
| **The weekly topical quizzes** | **yes** | no |
| **The company's own shared packs** | **yes** | no |
| **Invoicing the company directly** | **yes** (see below) | no |
| Own room, join code, photo wall, branding | yes | yes |
| Packs they write themselves | yes | yes |
| Invoicing, calendar | yes | yes (Bronze now) |
| Advert slides | yes | yes |
| Streaming | no | no |

**Two added, nothing taken away** — and it holds even for a company that writes
nothing of its own, because the seat still carries the topical quizzes, which
is £10 of Gold content at a Silver price.

**What a separate account gives instead is not a feature, it is OWNERSHIP.** It
is theirs: they keep it if they leave, with their packs, their venue history,
their play counts, their invoice book and the join code printed on somebody's
QR card. A seat is revocable by the company the afternoon somebody leaves —
which is exactly why the company wants one and why a genuinely freelance host
might not. When a host insists on independence the answer is "buy your own",
which is a sale either way.

A seat's OWN packs stay private from the company head too, because a seat is a
room and no route takes a room parameter. Keep that: it means contributing to
the company library is a deliberate act rather than a default.

**Edge case worth a line:** a freelancer hosting for two companies needs their
own account or two seats. Two seats works — a seat is an account — it is just
slightly clunky.

#### The shape that keeps the privacy promise structural

This is the part to get right, because it is the first thing that could put a
hole in a guarantee that currently holds by construction rather than by a
check. Today the owner cannot read a quizmaster's packs because a room's packs
live in that room's folder and **no route takes a room parameter**.

So: a company gets its own folder, `packs/<companyId>/`, and resolution goes
**own → company → catalogue**. A seat reads its own folder and its company's.
The owner is not a member of any company, resolves against the house room, and
finds nothing — exactly as now. Do NOT implement this as "which accounts may
read this pack", which is a permission somebody has to remember to write and
therefore a permission somebody will eventually forget.

**The company account writes; seats read.** Same relationship the app already
has between the owner and a subscriber, and it keeps "three people editing them
is how a house style stops being one" true inside a company as well as outside.

#### What a seat still gets on its own

- **Its own room** — its own game, join code, photo wall, state file, and its
  own name and colours on the projector. That already works; a room is a room.
- **Its own suggestion box.** Settled: a seat raises tickets like anybody else,
  for the same reason a Bronze or a Silver does — *"they might have sub-account
  specific frustrations that I can't see"*. Sending is already open to anybody
  signed in and not gated on a tier, so this needs nothing new; do not gate it
  to the company account.

#### Still to decide — two that could bite, three that just need writing down

- **Whose invoice book is whose, and it now contradicts itself.** "The invoice
  book belongs to the company" was settled early; then "a seat invoices the
  company directly" became one of the three things a seat is worth. Both cannot
  be true as stated — a seat billing the company needs a book of its own.
  Probably: the company holds one for billing venues, each seat holds one for
  billing the company. **Note this is a DESIGN, not a feature — it does not
  exist, and it should not go in a sales sentence until it does.**
- **What happens to a seat's own packs when the seat is switched off.** They
  live in that host's room. Does the room survive? Does the person keep their
  own material? "The company revoked my seat and I lost six months of my own
  writing" is a support conversation you only want to have never.
- **Whose support door opens the company folder?** Per account today. Probably
  the company owner's.
- The company head is a working host with their own room. Assumed throughout.
- The company account writes the shared folder; seats read it. Same shape as
  owner-and-subscriber, and it keeps "three people editing them is how a house
  style stops being one" true inside a company as well as outside.
- No seat limit.

#### Why not now — and the useful thing about that

Rob has no login yet, so this is a hypothesis about a customer who has not used
it. `PACKS_REPO` is still not configured, which makes step **B2** above
load-bearing rather than optional the moment anything is shared. And the eight
starter packs are not worth selling yet.

**But seats do NOT need PayPal, and that is worth knowing.** A seat is an
account with a company on it — creatable by hand today. So a company account
could be sold to Rob manually and invoiced **using the app's own invoicing
feature**, and the whole hypothesis tested, with no payment processor in
existence. The only real code is the company folder and own → company →
catalogue resolution.

The order that actually matters:

1. ~~The launch-collision guard~~ — **done**, see below.
2. `PACKS_REPO` — your ten minutes, step B2.
3. **Rob gets a login.** You have never had a second real user, and everything
   here is guesswork until then.
4. The eight starter packs, so there is something worth paying for.
5. Company accounts and shared packs.

### ~~A shared login can end somebody else's night~~ — FIXED

Found while thinking about group accounts, and it needs no group account to
happen. `session.launch()` in `src/session.js` builds a fresh game
**unconditionally** — there is no check for a night already in progress.

So if two people share one login and both press Launch, the second one silently
ends the first one's game mid-question: scores gone, every phone thrown into a
new lobby, in front of a paying room. That is this codebase's first rule broken
in the worst possible way, and the person it happens to has no idea why.

Reachable today by password sharing, which is exactly what people do when three
seats cost £90.

**Fixed.** `session.inProgress()` says what a launch is about to destroy, and
`/api/host/launch` answers the first press with a 409 naming the game, the
player count and where it has got to — *"The Madonna Quiz is running right now
— 3 playing, Round One — question 1 of 10."* A second, deliberate press carries
`replace` and goes through, because there are real reasons to launch over a
live game and a control that simply refuses is the mistake this codebase keeps
recording.

**The console already had a check, and it was blind to exactly this case**: it
read `library.running`, a snapshot taken when the page loaded, so a console
opened before the other device launched reported nothing running and went
straight ahead. That check is gone and the server's answer is the only one now
— the same lesson as the tier lever, where a guard that only lived in the
browser turned out to be decoration.

**Any joined player counts, lobby or not.** Forty people who have typed a team
name have something to lose, and "everybody type your name in again" is not a
thing anybody says on a mic. Nobody joined means nothing to protect, which
leaves the ordinary case — wrong pack up, launch again ten seconds later —
completely alone.

### Marketing — for later, but written down now

Neither of these is a code job yet. They are here so they are not lost, because
both are the sort of thing that is obvious once and then forgotten.

**A bundle rate for QM COMPANIES.** An agency running six quizmasters is one
conversation and six subscriptions, and they are the customer who brings you
five more without you doing anything. Two shapes worth thinking about, and they
are different businesses: a **per-seat discount** (six accounts at £15 rather
than £20), or a **company account with rooms under it** — rooms already exist
and are already per quizmaster, so the second is less work than it sounds. The
per-seat version is the one to offer first, because it needs no code at all:
set the tier and comp the difference.

Worth knowing what it fixes as well as what it earns. A host with three pub
residencies runs one pack at all three venues, so the busiest quizmaster hits
the pack ceiling SLOWEST — which is backwards. A company rate is the honest way
to charge for volume without metering anybody's nights.

**Venue relationships, off the back of the advert slides.** The strongest one,
and it is a genuinely different pitch from selling to quizmasters: a venue can
be told that a quizmaster running this software will reliably put their offer
on the projector between rounds — the pizza nobody is shifting, the Thursday
they want busier, a QR to tickets. That is worth something to the VENUE, and it
makes the quizmaster who uses it more likely to be rebooked, which sells the
software twice.

It is also why advert slides moved to Silver: the feature that makes a
subscriber more valuable to their own customer is the one worth paying for.
Nothing needs building for this — the slides work, and the per-venue sets are
already how they are filed. It is a conversation to have, not a feature.

### The pack shop — ✅ THE WINDOW IS BUILT, the money is not

**£3 a pack, and the shop is on the console now** — a pack outside their
library shows as a dashed card with its size and its price, under a heading
saying how many more there are and what Silver would include. **Buy takes no
money and says so.** Go and look at it wearing the hat on Bronze; whether it
reads as fair or as grabby is a wording-and-layout judgement, and it is much
cheaper to change now than after PayPal is wired.

Building it closed a hole worth knowing about: reading a pack you did not hold
was never refused, only launching one — so a starter library could have been
worked around by opening the other packs and copying the questions out. Shut
now, with a test.

Still to do, and it is the money half:

Settled: **£3 a pack** is the recommendation and the reasoning is in CLAUDE.md
under "What a pack costs" — below £2.50 a weekly host never has a reason to
climb to Silver, so the ladder stops being one. Not final; it is one number.

**Gold must be marked as not yet available when this goes in.** Gold is the
online/streaming tier and streaming is not built, so a Gold subscription today
buys Silver at a £10 markup.

What it needs, none of it built:

- A PayPal subscription plan per tier, and one for a pack purchase. Use
  **separate plan ids** from the kids' party business so the two stay apart in
  PayPal's own reporting rather than needing separating afterwards.
- A webhook endpoint. The app already stores a customer reference and a status
  and expects to be told — see "Payments stay processor-agnostic" below. Card
  details must never reach this server.
- A purchase writes the pack id into `packs` on the account, which already
  beats the tier. That is the one-line part.

Worth doing the SHAPE first, with no money in it: a pack card marked not-yours
with a price on it and Launch greyed. Half a day, and it tells you whether the
shop reads right before you commit to a processor.

### A quizmaster's OWN quizzes — and they are private from you — ✅ BUILT

Described properly in CLAUDE.md under "A quizmaster's OWN packs". Left here
because the reasoning is the valuable part, and it is what any change to it has
to keep.

**The only thing outstanding is step B2 above** — a second private repo, so
their packs survive a deploy. Without it the feature works and their work is
temporary, which their console says in red.

The constraint was the important half: **a subscriber writes their own material
and you must not be able to see it unless they let you.** It is their
intellectual property, not stock in your catalogue.

Also settled by the same sentence: **they do not generate with Claude.** That
is your bill and your house style. They write or upload; the app stores.

What that meant, and how each half landed:

- **A second library, per account** — `quizzes/` stays yours and shared. Theirs
  lives under their room, and the pack routes resolve their library first and
  the catalogue second, so a bare pack id still means one thing.
- **The owner cannot read it.** Not "the console does not show it" — the API
  refuses. Enforced structurally rather than by a check somebody has to
  remember: **no route takes a room parameter**, so there is no id you can send
  that reaches another room's folder. There is a test called
  "THE OWNER CANNOT READ A QUIZMASTER'S OWN PACK".
- **Support access is how you ever see one.** They switch it on, it expires, and
  "Opened your pack …" goes in the log they read. This is the first thing that
  actually needed it, and it works end to end.
- **Backup is theirs too** — `PACKS_REPO`, a third repository, with no fallback
  to yours. Step B2 above.
- **Which tier it sits on**: Bronze, under your own rule — writing a JSON file
  costs you nothing per use. One word in `FEATURE_TIER` moves it, but note what
  moving it up would mean: their own work becoming unreachable the month their
  card fails.

They still do NOT generate. That is your bill and your house style. They write
in the editor, or paste a track list into the same importer — with the
no-repeats memory left out of it entirely, since that is your generator's record
of what IT has used.


### Build out the owner admin console — ✅ BUILT

Five tabs, split by the question each answers: **Tonight** (can I deploy?),
**People** (what is going on with one subscriber?), **Money** (is this paying
for itself?), **Catalogue** (is what I write worth writing?) and **Inbox** (who
is waiting to hear back?). Described properly in CLAUDE.md under
"The owner page".

The one worth knowing about is **Money**, because it needed something that did
not exist: a ledger. Every Claude call and every OpenAI picture is now written
down as it happens, with what it cost and which pack it was for — so
"what does a pack cost to make" is a number on a page rather than a guess
against a card statement a month later. It backs up to the private repo like
the invoices.

Two things are deliberately NOT on it, and both were considered:

- **No way to drive a game.** One place moves a quiz and it is the control
  view. A second set of Next/Back buttons polling the library would eventually
  double-advance a room.
- **Nothing about a subscriber's own packs**, not even a count. A count is not
  content, but a page that quietly reported on somebody's private work would
  undercut the promise the rest of that feature makes.

What was on the original list and is still not built:

- **A calendar of who is booked where.** That is a quizmaster tool that exists
  as a tier, not an owner view, and nobody has asked for the owner's version.
- **Payments.** Still processor-agnostic and still unwired — see below.

The original list, for reference:

- **Who is running what, right now** — every room, what is on its projector,
  how many are in. `rooms.summaries()` already returns it and the console shows
  it in a thin strip; it belongs here properly.
- **The catalogue as a product** — which packs exist, which are selling, which
  have never been played, which have open corrections against them.
- **Money** — who is on which tier, who is lapsed, what is owed. The invoice
  book is a quizmaster tool today; the OWNER's view of revenue is a different
  thing and does not exist.
- **What generation has cost** — Claude and OpenAI spend per pack, because that
  is the number the whole tier structure is built on.
- **A subscriber's account, from the outside** — their tier, their room, their
  join code, a way to reset their password, and support access with a log.
- **The song history and the packs**, which are owner-owned but currently live
  on the quizmaster console because that is where they were built first.

---

## Waiting on a decision from you — no rush, nothing is blocked

**Which features sit on which tier, and what the middle two cost.** The ladder
is built and works; where each feature sits is a first guess I made so there was
something to look at. Moving one is a one-line change.

| | Plan | Price | What is on it today |
|---|---|---|---|
| 🥉 **Bronze** | Basic | included | Music Quiz, Music Bingo, the pack library, buying packs, seasonal looks, advert slides, photos from the room |
| 🥈 **Silver** | Elite | £15/mo | Invoicing, your calendar, marketing |
| 🥇 **Gold** | Pro | £30/mo | Online quizzes (streaming) |

The one rule I did NOT guess at, because it is yours: *anything that costs the
owner money every time it is used is not in Bronze.* That is why streaming is at
the top — egress is a real per-use bill — and why a new round type or a new
seasonal look is Bronze the day it is written.

**The quickest way to decide is to look at it.** Put the quizmaster hat on, tap
**B** on the switch in the top right, and sit on Bronze for a few minutes. If it
feels like a crippled app rather than a free tier, something needs moving down.

Two things deliberately NOT on the ladder at any price: generating packs with
Claude, and drawing artwork with OpenAI. Those are yours, on your bill, and the
packs being written for subscribers is the whole arrangement.

---

## What is new since you last read this

### The topical quiz, and the ladder it settled

**One button: "The month just gone."** It reads the last month off the web and
writes forty questions from it — 20 news and 10 music from the month, then 10
music from any era so the pack is not all one thing and does not punish
anybody who was on holiday. Named after the date, marked current for a
fortnight. Tick "Harder than usual" for the second, harder one; the two are
filed separately so they do not collide.

**It costs about £2 a pack** (£1.20 to £3.90 depending on how much the checker
thinks), measured rather than guessed. The checking pass is 86% of that; being
topical only adds about 26p.

**That measurement set Bronze / Silver / Gold**, on your own observation that
the one-off packs and the topical ones are different animals — an evergreen
pack is an asset written once, a topical one is a service written every week.
So Silver is the whole evergreen catalogue and **Gold is the weekly topical
quiz**. Gold is sellable now; it used to be streaming and nothing else, which
made it Silver at a £10 markup.

The arithmetic that makes it a ladder: Silver at £20 plus four topical packs at
£3 is £32, which is **more than Gold at £30** — so a Silver subscriber who
wants topical weekly has an unambiguous reason to climb, and it arrives every
week rather than in month four. There is a test that this holds.

**What it commits you to is a weekly deadline, not money.** The writing is a
button press and £2; the read-through is twenty minutes, every week, for as
long as one Gold subscription exists. That is the only part of the arrangement
that cannot be undone by editing a line in `plans.js`.

### Two things worth reading in this file

- **Group accounts** (below, under "Asked for, not yet specced") — seats on a
  Gold for a quizmaster company, and why the interesting half is internal pack
  distribution rather than the discount.
- **A shared login can end somebody else's night** — a real bug, reachable
  today, small to fix.


- **A "My account" tab** on the console — your name, your colours, what tier you
  are on, every feature laid out by tier with a switch on each, and links to your
  control view, your big screen and your join page all in one place.
- **You can look at the console as a Bronze, Silver or Gold subscriber.** Put
  the quizmaster hat on and the switch grows **All · B · S · G** next to it —
  tap a letter and you see exactly what somebody on that tier sees, tabs missing
  and all. It is a real downgrade, not a preview: the API refuses what that tier
  cannot do, so anything broken for a subscriber breaks for you too. Tap **All**
  to go back to everything. Taking the hat off clears it.
- **Three tiers: Bronze (Basic), Silver (Elite), Gold (Pro)**, and they stack —
  Gold includes Silver includes Bronze. On the owner page each quizmaster now has
  a Bronze / Silver / Gold picker instead of a row of add-ons.
  **⚠️ Which feature sits on which tier is a first guess, and so are the prices**
  (Silver £15, Gold £30). Moving one is a one-line change — tell me where you
  want them and I will shuffle them.
  **What a quizmaster can and cannot do there:** they can switch OFF anything on
  their own tier, which makes it disappear from their console. They cannot switch
  ON anything above it — that is yours to grant from the owner page, and it stays
  that way until payments are wired up.
- **The app is called Quiztopia**, and each night is branded from whoever is
  running it — your projector says **"Mark's Quiztopia"**, Rob's says **"Rob's
  Quiztopia"**. First names only, the way you say it on the mic. ⚠️ If you have
  `BRAND_NAME` set on Render from before, that still wins over all of it and you
  will see the old name — clear it to get this.
- **Your own two colours.** Six of them (Sunset, Orchid, Lagoon, Ember, Citrus,
  Ultraviolet), at the bottom of the console under **Your colours**. Tap one and
  your projector and every phone in your room change straight away. It is on the
  ACCOUNT, so Rob can have his own and yours is untouched. A themed night —
  Halloween, Valentine's — still wins over it, and the four answer colours never
  change, because those are how a player matches the big screen to their phone.
- **An Owner | Quizmaster switch** in the top right of the console and the owner
  page, one tap either way, replacing the button that was buried on the owner
  page. The live half is a solid block of colour so you can never be unsure
  which hat is on. Switching cannot disturb a night that is running — the two
  hats are two separate rooms.
- **A second quizmaster can have a login.** Rob gets his own running game, so
  he cannot launch over your gig — that used to be one shared game and it was
  the reason you could not hand anyone a login. He gets his own join code, his
  own photo wall, and read-only use of your packs.
- **Accounts survive a restart** (as long as the private repo is set up), and
  you can make your first owner account from the Console instead of needing a
  command line.

- **The winner's face on the big screen** — whoever answers first gets their
  picture up next to "Fastest finger" on the reveal. If they have sent a photo
  in tonight it is that; if they have not, it is a little cartoon face drawn
  from their team name, so there is never an empty gap. The same team always
  gets the same face all night.
- **Round 2 pictures cost a lot less.** A portrait is now filed under the
  MUSICIAN rather than under the quiz, so once you have paid for Madonna once
  she is free in every quiz after that. The Pictures panel tells you before you
  press anything: *"6 already in the library, free · 4 to draw — about 16p"*.
- **Picture style and quality** on the same panel. Style is Portrait, Cartoon
  or As a superhero. Quality is low / medium / high — it was never being set at
  all before, so everything was being made at the dearest setting. Medium now.
  Bear in mind each style is a whole separate set of pictures, so a superhero
  round is a fresh bill even for people you already have.
- **Props on the photos** — dog ears, clown nose, party hat, nine of them. Tap
  one, drag it onto the face, pinch to size it. The black-and-white sort of
  filter is still there, folded away under "Change the colour instead".
- **Photos get the middle of the screen** for about three and a half seconds
  before joining the strip along the bottom, which is bigger too.
- **A guard on revealing early** — the same button pressed twice in a blink
  only counts once, and it refuses to reveal in the first three seconds with a
  note saying why. The clock still reveals on its own when it runs out.
- **You can see who keeps leaving the app** mid-question, on your own screen
  only. Nothing on the projector and nothing on their phone. It is a note, not
  an accusation — a phone call looks exactly the same — so it only badges
  somebody from three questions onwards. What you do about it is your call.
- **First letter round** — no options at all: the room gets a keyboard and only
  the first letter of the answer has to be right, so nobody loses a point to
  spelling.
- **A number of questions per round type** — fifteen general knowledge and five
  pictures rather than ten of everything.
- **Four ways for a round 2 picture to give itself away** — zoom out, pixelate,
  come into focus, or tiles coming away. Set per round in the Editor, or `mix`
  for a different one each question. They all get easy at the same rate, so
  which you pick never changes how many points are on offer.
- **Seasonal looks** — a **Look** picker on every pack card next to Launch:
  Halloween, Valentine’s, Christmas, Summer. Changes the colours on the big
  screen and every phone at once. Nothing about how the quiz plays changes.
- **Invoicing** — see step 3 above.
- **Accounts** — see step 2 above.
- **Room for 300 players**, measured rather than guessed, and much faster than
  it was.
- Pictures and Playlist buttons on pack cards, photos from the room, advert
  slides, the rules slide, scores on the big screen, pick-them-all rounds.

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

# Where this might go — four directions, and what each really costs

None of this is being built yet. It is written down so that a change made
today does not quietly make one of them harder tomorrow.

**The thing that used to govern all of it is now done.** The app ran ONE game
at a time — one state file, one host key, one session, one join code — which
was right for you running your own nights and wrong for anybody else using it
at the same time. It is a room per quizmaster now: their own game, their own
join code, their own photo wall. Direction 1 was waiting on that and no longer
is.

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

---

## 2. Karaoke — yes, and cheaper than it sounds IF the tracks stay yours

Your idea: once there is a music licence, add karaoke, with hosts either
streaming the tracks for a fee or downloading the lot in one go.

**The two halves of that sit on opposite sides of a legal line**, and which
side you build on is the difference between a weekend of work and a licensing
business.

### The distinction that decides everything

**Performing** music in a room and **distributing** music to other people are
different rights, licensed by different people, at wildly different prices.

TheMusicLicence — the joint PRS/PPL one — covers *public performance on
premises*. It is what makes playing a track out loud in a pub lawful. It says
nothing at all about sending audio files to another quizmaster, or streaming
them from your server into their venue. That is reproduction and
making-available, and no venue licence touches it.

So:

- **You using karaoke at your own gigs** — the venue's licence covers the
  performance, and your KaraFun subscription covers the tracks. Nothing to
  build, nothing new to license.
- **This app streaming or shipping tracks to subscribers** — that is you
  becoming a music distributor. Different business entirely.

### Karaoke is harder than records, and this is the bit people miss

A karaoke track is three licensed things stacked up:

1. **The backing track** is a NEW recording of somebody else's song — a cover.
   Making one needs a mechanical licence from the publisher.
2. **The lyrics on screen** are a separate reproduction of the words,
   controlled by the publisher independently of the recording. This is the one
   that catches people out.
3. **The performance in the room** — the venue's licence, as above.

That stack is exactly why KaraFun, Sunfly and Zoom are licensing businesses
rather than somebody's side project, and why every one of their subscriptions
forbids passing tracks on. "Download once and keep it on the hard drive" is
fine when THEY sold it to the host and a breach when you did.

*Not legal advice — but it is the shape of the problem, so the conversation
with a solicitor would be short and cheap.*

### What to build: the show, not the songs

**Exactly the same shape as music bingo, which already works this way.** You
play bingo tracks from your own DJ app; the software runs the game around them
and never touches the audio. Karaoke is identical — KaraFun plays the track on
the host's laptop, and this app is the show:

- **Singers join on their phones** with the join code, put in a name and a
  song request. Same join flow, same QR, nothing new to learn.
- **You get the queue on your control view.** Reorder it, bump somebody up,
  mark them done, drop a no-show. One tap each, same as everything else there.
- **The projector shows "Now singing" and "Up next"**, with the join code still
  in the corner for latecomers.
- **Optional: the room votes**, so it is a karaoke CONTEST with a scoreboard —
  which is your product rather than a karaoke box's. A plain karaoke machine
  cannot do that and it is the reason a venue would book you over hiring a box.

Zero licensing exposure beyond what the venue already has. Zero audio over pub
wifi, so nothing can buffer mid-chorus with somebody holding a microphone —
which matters more here than in the quiz, where a slow question is survivable.

### Why NOT to host the tracks, even once licensed

Two reasons on top of the legal one:

- **Egress.** The sums are in direction 1 above: video runs about twenty times
  audio, and four 100-person video nights already exceed what a £9.99
  subscription covers. Karaoke is 3–5 minute tracks, thirty to sixty a night,
  usually with video. That is a serious bandwidth bill per host per night.
- **Reliability, which beats everything else here.** A quiz question arriving
  half a second late is survivable. A backing track stalling in front of a
  singer is not. Files on the host's own machine cannot do that.

### If you ever do want tracks in the product

Do not license songs yourself — that is years and lawyers. Do a **B2B deal with
a catalogue that already holds those rights**. You are already a KaraFun
customer, which makes it the cheapest possible first conversation: *"I sell
quiz software to pub hosts — can we integrate, or resell?"* You would be
selling access to their catalogue, not distributing anything.

**And the runner above is what you would bolt a catalogue onto anyway**, so it
is not wasted work either way.

### Size of the job

Small, for what it is. CLAUDE.md documents adding a game as four places to
touch, and the room work is already done. Roughly: an engine (the queue and
whose turn it is), a card set for the big screen, a panel on the control view,
and one line in the console so it gets a tab. No new dependencies, no build
step, no audio.

### One thing to check before spending on a licence

**Is the music licence even yours to take out?** In most pub gigs it is the
VENUE's obligation — they hold TheMusicLicence and it covers music played on
their premises whoever presses play. Worth confirming before you pay for one
you may already be covered by. It matters for the quiz and bingo you run today,
not just for karaoke.

---

## 3. On the App Store, a few pounds a go — hard, and a different product

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

## 4. Paid TikTok streams with cash prizes — easy to build, hard to be allowed

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
