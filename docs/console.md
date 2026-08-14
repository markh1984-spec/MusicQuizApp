# The console and the control view — launching and driving a night

The reasoning behind the the console and the control view rules in CLAUDE.md.

**The rules themselves live in CLAUDE.md and are the short version.**
This is the why: what was tried, what it cost, and what must not be
unpicked. Read the relevant part before changing anything here.

---

## A launch must say what it is about to destroy

`session.inProgress()` and the 409 on `/api/host/launch`.

`launch()` builds a fresh game unconditionally, and that used to be the whole
story — so two people on one login could end each other's night mid-question:
scores gone, every phone back in a lobby, in front of a paying room, with
nothing anywhere saying why. Reachable today by password sharing, which is
exactly what happens the moment somebody decides three subscriptions are too
many.

**It names what is live rather than refusing.** The first press comes back with
the game, the player count and where it has got to — *"The Madonna Quiz is
running right now — 3 playing, Round One — question 1 of 10"* — and a second,
deliberate press carries `replace` and goes through. There are real reasons to
launch over a live game (the wrong pack went up; the night genuinely restarts),
and a control that simply says no is the mistake this file keeps recording.

**ANY joined player counts, lobby or not.** The obvious version guards a game
past the lobby, but forty people who have typed a team name have something to
lose too, and "everybody type your name in again" is not a thing anybody says
on a mic. Nobody joined means nothing to protect, which leaves the ordinary
case — wrong pack up, launch again ten seconds later — completely alone.

**The console had a check and it was blind to the case that matters.** It read
`library.running`, a snapshot taken when the page loaded, so a console opened
before the other device launched reported nothing running and went straight
ahead. It is gone; the server's answer is the only one. Same lesson as the tier
lever: a guard that only lives in the browser is decoration.

## The restart notice, and the one state that made it a lie

`restartNotice()` in `host.js`, fed by `server` in `hostView()`. After a
restart the control view says so plainly — *"the app restarted 5 minutes ago,
scores from before then are gone, 1 phone put itself back in, tap a name to
put their points back"* — because on a host with no permanent disk the only
clue from the front of the room is that everybody is suddenly on nothing,
which looks like a scoring bug rather than what it is.

**It only appears when a phone has turned up holding an id this process never
issued**, which is proof a game was lost rather than a warning on every
startup that you would learn to ignore.

**And a DELIBERATE LAUNCH now clears it, which it did not.** The notice ran on
a twenty-minute timer alone, so launching a fresh night after a restart left
it sitting across the top of the control view telling a game that was running
perfectly that it had lost scores it never had — and offering to put back
points belonging to a game that no longer exists. Seen on a gig day, on the
one screen the host reads with a mic in the other hand.

`joinPlayer()`'s own docstring already said it — *"a game the host launched
deliberately is not a lost one"* — so this was a stated intention that was
never written down in code.

**THE FIX IS A FLAG, NOT A RESET, and getting that wrong first is the lesson.**
Clearing `strandedPhones` inside `launch()` looks right and does nothing: the
phones come back a few SECONDS AFTER the launch, not before, so the count was
zeroed and then immediately counted back to one by the very rejoin the launch
was meant to account for. It was deployed, watched still failing on a live
server, and fixed properly. `launch()` sets `launchedSinceBoot`, and
`joinPlayer()` reads it — so a phone returning to a night that was started on
purpose is never stranded in the first place.

The flag is set in `launch()` and never in `build()`, because `build()` runs
on boot too: a session always has a pack loaded so the projector is never
blank, and **a loaded pack is not a night** — the same distinction
`aNightIsOn()` draws on the console.

Four tests, and the one that matters drives the events in the order they
really happen rather than the tidy one. Both cases were also run against a
live server: a crash with the host touching nothing still shows the notice; a
deploy followed by a deliberate launch does not.
