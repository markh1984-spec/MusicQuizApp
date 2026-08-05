# Putting the quiz on the internet

Written assuming you have never deployed anything before. Follow it top to
bottom and you will end up with a web address you can point a QR code at.

You need to do this **once**. After that, updating is one `git push`.

Total time: about twenty minutes. Cost: free to start, £5–6 a month if you want
it to be instant on gig night (recommended — see "The sleeping problem").

---

## Before you start

You need:

1. **A GitHub account** — free, at [github.com](https://github.com). This is
   where your code lives.
2. **A Render account** — free, at [render.com](https://render.com). Sign up
   *with your GitHub account* when it offers, it saves a step later.

That is it. No credit card needed for the free tier.

---

## Step 1 — make sure GitHub has a `main` branch

The code is already on GitHub, but on a branch with an awkward name, and
Render expects `main`. Rename it — it takes three clicks and loses nothing:

1. Go to https://github.com/markh1984-spec/MusicQuizApp/branches
2. Click the **pencil icon** next to `claude/new-session-jzx988`
3. Type `main` and click **Rename branch**

If you are working from a copy on your own computer, push any changes first:

```bash
git add -A
git commit -m "My changes"
git push
```

If GitHub asks for a password, it wants a **personal access token**, not your
account password. GitHub's own prompt links to where you make one.

---

## Step 2 — create the web service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) and log in.
2. Click the blue **New +** button, top right, and choose **Web Service**.
3. It shows a list of your GitHub repositories. Find **MusicQuizApp** and click
   **Connect**. (If you do not see it, click *Configure account* and give
   Render permission to see your repositories.)
4. Now a settings form. Most of it is already right. Set these:

   | Field | What to put |
   |---|---|
   | **Name** | `musicquiz` — this becomes your web address, so pick something you would not mind reading out |
   | **Region** | **Frankfurt** — closest to the UK, so the lowest lag on the night |
   | **Branch** | `main` |
   | **Runtime** | Node |
   | **Build Command** | leave it as `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | **Free** to try it, **Starter** ($7/mo) for real gigs — see below |

5. Scroll down to **Environment Variables** and click **Add Environment
   Variable**. Add one:

   | Key | Value |
   |---|---|
   | `HOST_KEY` | a phrase only you know, e.g. `blue-tractor-42` |

   This is the password for your control view. Anyone who has it can run your
   quiz, so do not put it on the big screen. If you skip this the app makes one
   up and prints it in the logs, which works but is more faff to find.

6. Click **Create Web Service**.

Render now builds and starts it. Watch the log window; after a minute or two
you will see the app's startup banner. At the top of the page is your address,
something like:

```
https://musicquiz.onrender.com
```

**That is your quiz.** Write it down.

---

## Step 3 — check it works

Open these in a browser:

| What | Address |
|---|---|
| Console (start here) | `https://musicquiz.onrender.com/console?key=YOUR_HOST_KEY` |
| Big screen | `https://musicquiz.onrender.com/screen` |
| Player phone | `https://musicquiz.onrender.com/play` |
| Your control view | `https://musicquiz.onrender.com/host?key=YOUR_HOST_KEY` |
| Editor | `https://musicquiz.onrender.com/editor?key=YOUR_HOST_KEY` |

Open the big screen, scan the QR code with your own phone, join as a team, then
open the control view on another device and press **Start the quiz**. If the
question appears on both, you are done.

**Bookmark the console address on your phone now**, with the key in it. In a
dark venue you do not want to be typing it — and everything else is one tap
from there.

If you want the AI generation, add one more environment variable while you are
in there: `ANTHROPIC_API_KEY`, set to your Anthropic key. Spotify needs three
more — see below.

---

## The sleeping problem (read this one)

On Render's **free** tier, a service that has had no visitors for **15 minutes**
goes to sleep. The next visitor wakes it, which takes **30 to 60 seconds** of
blank screen.

That is fine while you are building. It is not fine when sixty people are
scanning a QR code at once.

Two ways round it:

- **Recommended: pay for the Starter tier, $7/month.** It never sleeps.
  In Render: your service → **Settings** → **Instance Type** → **Starter**.
  Roughly £5.50 a month, which is less than a round.
- **Free workaround:** open the big screen on your laptop **five minutes before
  the room fills up** and leave the tab open. The app stays awake as long as
  something is connected to it. Set a reminder — if you forget, your first
  scanners get a blank page and you look daft.

---

## Something important about files

Render gives your app a **fresh, empty filesystem every time it redeploys**.

What that means in practice:

- **Packs you edit or generate on the live site are lost on the next deploy.**
  The editor has a **Download** button for exactly this reason. Edit, download
  the `.json`, drop it in your local `quizzes/` or `bingo/` folder, `git push`.
  Now it is permanent.
- **The "no repeats for 3 months" memory resets too.** This one is easy to
  miss, because nothing breaks — the generator just quietly starts allowing
  songs it should be blocking.
- **Scores survive a crash, but not a redeploy.** If the app process falls over
  mid-game it comes straight back with every team and score intact — that is
  what the crash recovery is for. But do not push a code change during a gig.

### If you want the song history to actually stick

Two options. Pick one:

**Option A — a Render Disk (recommended if you generate on the live site).**
Service → **Settings** → **Disks** → **Add Disk**. Mount path
`/opt/render/project/src/data`, size 1 GB. About £0.20/month, but it needs a
paid instance. Everything in `data/` then survives deploys: song history,
archived results, play counts.

**Option B — generate on your own laptop.** Run the app locally, use the
console's **Build it** button there, then commit the new pack:

```bash
git add bingo/ data/track-history.json
git commit -m "New bingo round"
git push
```

The history file lives in `data/`, which is gitignored by default. If you go
this route, remove the `data/` line from `.gitignore` so the history travels
with your repo.

---

## Spotify, for the bingo playlists

Optional. Without it the app still builds bingo packs — you just do not get a
playlist made for you.

Spotify will not let an app touch your account without your say-so, so there is
a one-time setup. Do it on your own laptop; it takes about five minutes.

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   and log in with your **normal Spotify account** — the same one your DJ app
   uses.
2. Click **Create app**. Name it anything, "Music Quiz" is fine.
3. **Redirect URI** must be exactly:
   ```
   http://127.0.0.1:8888/callback
   ```
   Tick **Web API**. Save.
4. Open the app's **Settings** and copy the **Client ID** and **Client Secret**.
5. In your project folder, run:
   ```bash
   node scripts/spotify-login.mjs
   ```
   Paste the two values when asked. It opens a Spotify page, you click Agree,
   and it prints three lines.
6. Put those three lines into Render: your service → **Environment** → **Add
   Environment Variable**, one each for `SPOTIFY_CLIENT_ID`,
   `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`.

That is it — they do not expire.

**Keep the secret and the refresh token private.** Between them they can create
and edit playlists in your Spotify account. They are fine in Render's
environment variables; do not commit them to GitHub.

Playlists it creates are **private** and belong to you, so they show up in your
DJ app's playlist list like any other.

---

## Updating the app later

```bash
git add -A
git commit -m "New questions for Friday"
git push
```

Render notices the push and redeploys on its own, in about a minute. Nothing
else to do.

---

## Putting your own domain on it, later

You do not need this. The QR code hides the address anyway. But when you want
it:

1. **Buy a domain.** [Namecheap](https://namecheap.com) or
   [Gandi](https://gandi.net) are fine. A `.co.uk` is about £10 a year. Say you
   buy `markhquizzes.co.uk`.
2. In Render: your service → **Settings** → **Custom Domains** → **Add Custom
   Domain**. Type `quiz.markhquizzes.co.uk`.
3. Render shows you a **CNAME record** to create. Go to wherever you bought the
   domain, find **DNS settings**, and add:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `quiz` | whatever Render showed you |

4. Wait. It can take a few minutes or a few hours. Render's page shows a green
   tick when it has worked, and sorts out the https certificate itself.

**Then tell the app about it** so the QR code points at the new address: in
Render, add an environment variable `PUBLIC_URL` = `https://quiz.markhquizzes.co.uk`.
Without that the QR still works, it just shows the old address underneath.

---

## If something goes wrong

**The page will not load at all.**
Render dashboard → your service → **Logs**. Errors are in there in plain
English. If it says "port already in use" or similar, click **Manual Deploy** →
**Clear build cache & deploy**.

**Phones connect but nothing updates.**
Almost always the venue's wifi. Tell people to turn wifi off and use mobile
data — the app is built for that. It is one small connection per phone, not
video; a bar or two of 4G is plenty.

**"Wrong host key".**
The key in your address does not match `HOST_KEY` in Render. Check Render →
**Environment**. If you never set one, look in the startup log for
`Host key:` and use that.

**The QR code shows the wrong address.**
You have set `PUBLIC_URL` to something stale. Remove it, or correct it.

**Everything is fine but slow to start.**
That is the free tier waking up. See "The sleeping problem".

---

## The other two hosts, briefly

If you would rather not use Render:

- **Railway** ([railway.app](https://railway.app)) — never sleeps, about $5/mo
  usage-based, deploys are quicker. New Project → Deploy from GitHub repo →
  pick the repo. Set `HOST_KEY` under Variables. Railway works out the start
  command by itself.
- **Fly.io** ([fly.io](https://fly.io)) — runs in London, so the lowest latency
  of the three, but you install a command-line tool and it wants a card on
  file. `fly launch`, then `fly secrets set HOST_KEY=...`, then `fly deploy`.

The app needs nothing special from any of them: Node 20 or newer, and a `PORT`
environment variable, which all three set for you.

**Do not use Vercel or Netlify.** They are built for sites that answer a request
and stop. This app holds a live connection open to every phone in the room for
the whole night, which is exactly the thing they are worst at.
