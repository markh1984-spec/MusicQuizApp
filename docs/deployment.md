# Deployment — what the host has, and what that blocks

The reasoning behind the deployment rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## Things the host does not have, and what that blocks

- **Round 2 portraits are on GOOGLE now, not OpenAI.** Anthropic has no image
  API, so a Claude key cannot make them. OpenAI was the plan for months and
  then **the host's OpenAI account was deactivated**, with no route back — so
  the provider is Imagen 4 on `GOOGLE_API_KEY`, and the OpenAI code stays only
  because it costs nothing to keep. See **The picture round runs on Google**
  below. Round 2 is placeholder art until the key is on Render.
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
