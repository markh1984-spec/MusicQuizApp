# Next

## Waiting on Mark

- **Deploy on Render again — Manual Deploy, then "Deploy latest commit"**. Brings Pub Prix as its own game type, with faces on the karts and real steering in Pub Prix live; the Gig poster look and the first Pub Prix are live already. A deploy restarts the live server, so not during a gig (9 Oct 2026).
- **Try Pub Prix with two phones before using it at a gig** — it steers now: hold the left or right of the screen; it is meant to be hard, so say if it is too hard or too easy. Two ways to start it (9 Oct 2026):
  - At a quiz's round scores, or once a bingo round's prize has gone, press "Start Pub Prix" on the control view.
  - Or put it in the night itself: tap the Pub Prix card on the Console, then put its tile between two rounds on Tonight.
- **Yes or no: a real 3D head on the karts**. Today each kart shows a flat photo of the player's face. A 3D head would need a paid image-to-3D service. Offered 9 Oct 2026.
- **Hub income link: set `HUB_INCOME_TOKEN` in Render and the matching token in the hub** — lets the hub read your paid gig-invoice totals per month (totals only, nothing per venue). Live from 9 Oct 2026; until the token is set, `/api/hub/income` answers 503 not_configured. Steps in DEPLOY.md, "Your hub's income page".
- **Run the Cowork prompt for the MBC playlists** — renames the eight a/b playlists to MBC 10–17 and makes MBC 18–23; prompt is in the chat (8 Oct 2026).
- **Send the Story frame artwork** — the square frame and the two logos, so Story exports get a frame of their own (since 2 Oct 2026).
- **Decide: do phone videos ever go on the big screen?** — "ask me tomorrow" (since 1 Oct 2026).
- **Yes or no: a "Make the Spotify playlist" button on bingo packs** — offered 2 Oct 2026.

## Waiting on someone else

- Nothing.

## Next up

1. Blockyard and Walkies as the lobby games in place of the five, with a boss called Ed in each (twice as tall, more health) — asked 9 Oct; another thread is building it, not on GitHub yet. Don't start a second copy. Whether they also become drink games of the night (Pub Prix's shape) is Mark's to say.
2. Build Up or Down, which Mark picked from the five drink-game ideas (9 Oct): higher or lower, wrong guesses out, last one standing gets a drink.
3. Once deployed, watch the first real Pub Prix: how many karts; whether the faces read from the back of the room; whether the three seconds of road on the phone is enough; whether the steering is the right kind of hard (two numbers in `race-track.js`: how hard the bends push you wide, and how much the grass slows you).
4. The Gig poster layouts, one screen at a time — the Tonight bar first — and drawn line icons in place of the emoji (todo/console.md). The Tonight bar is ~490px tall at 1150px+ while every other door's bay is 389px (`--bay-h`): community-bay.mjs fails on it, and it already failed before the redesign (488px).
5. Paper bingo cards — parked by Mark, "not now" (8 Oct). The plan if it comes back: one numbered sheet per bingo game, printed before the night; a paper card stays the same through that game's rounds; a paper winner is checked by typing the card number.
6. Re-check the ~30 open findings in docs/sweeps-september-2026.md (22–23 Sept table) and fix what is live, the 7 on the protected surface first — offered, not yet asked for.

## Updated

9 October 2026 — Pub Prix: a kart race on the projector, steered by tapping a lane on every phone; and a settled funniest-photo vote no longer sits over the next question.
9 October 2026, evening — the Gig poster's missed bits: the switches, the editor, the control view's links, the intro round's equaliser.
9 October 2026, late — every ordinary button (Sign out included) wears the short underline under its words instead of the curved bottom edge.
9 October 2026 — the hub income link: `GET /api/hub/income`, Mark's paid gig invoices as monthly totals for his hub (branch `claude/seo-2026-10-09-qz-hub-income`).
9 October 2026, night — deployed everything on GitHub: the Gig poster look, Pub Prix, the hub income link and browsers kept on https (HSTS).
9 October 2026, night — Pub Prix is its own game type (a tab, a Tonight tile, one drink a race), each kart carries its driver's face, and the offer page wears the Gig poster colours.
9 October 2026, night — Pub Prix steers: hold a side of the phone; the bends push you wide and the grass slows you.
