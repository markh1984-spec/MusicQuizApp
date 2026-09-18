/**
 * WRITE ROUTES — players. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { CHECKS_ONLY, FEATURES, MAX_BYTES, OWNER_ONLY, changesTheLibrary, flight, ideaLabel, nightOfGig, ownsPlayer, propUse, searchTracks, spotifyConfigured, tidyCode } from './context.js';
import { readBody, readJson, sendJson } from './plumbing.js';
import { roomForHost, roomForPhone, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { photosWanted, pushState } from './views.js';
import { backUpAsks, backUpPropUse, fileAway } from './helpers.js';

export async function writePlayers(req, res, url, route) {
  // ---- players (open to anyone with the join link)
  /*
   * ---- A DJ SET'S TWO PHONE ROUTES ----------------------------------------
   *
   * **UP HERE WITH `/api/join`, AND THAT PLACEMENT IS THE WHOLE POINT.** Every
   * write below line 6887 goes through the broad `FEATURES.QUIZ` gate, so
   * written beside the desk routes these answered *"Sign in first"* to a phone
   * in a room — which is the route-in-the-wrong-place trap this file already
   * records for the gallery publish route, wearing a gate instead of a verb.
   *
   * Found by driving the path over HTTP rather than by reading the diff.
   */
  if (route.startsWith('/api/dj/') && req.method === 'POST'
      && (route === '/api/dj/request' || route === '/api/dj/search')) {
    /*
     * THE BODY IS READ FIRST SO THE ROOM CAN BE RESOLVED FROM IT.
     *
     * `roomForPhone(req, url)` with no body falls back to the HOUSE room, so
     * a phone at somebody else's DJ set would have searched and requested
     * into the owner's room — which is the join-code half of *a room id is a
     * path*. The phone sends `joinCode` on every one of these, the same way
     * `/api/join` does.
     */
    const body = await readJson(req);
    const room = roomForPhone(req, url, body);
    const { session } = room;
    if (session.kind !== 'dj') return sendJson(res, 409, { error: 'No DJ set is running.' }), true;
    const player = session.engine.state.players[String(body.playerId || '')];

    /*
     * SEARCHING IS A POST, AND THAT IS ABOUT THE CREDENTIAL rather than about
     * REST. It carries the phone's token, and a token in a query string is a
     * token in a log, in browser history and in a `Referer` header.
     *
     * **BEHIND THE SAME PROOF AS A REQUEST, minus the unlock.** Every phone in
     * the room searches through the DJ's ONE Spotify token, so a route open to
     * anybody is a free Spotify proxy with his name on the bill — and the box
     * is drawn present-and-inert before a photo lands, so gating the SEARCH on
     * the unlock too would only mean a control that looks live and refuses.
     */
    if (route === '/api/dj/search') {
      if (!player || !ownsPlayer(player, String(body.token || ''))) {
        return sendJson(res, 200, { ok: false, reason: 'not_you', tracks: [] }), true;
      }
      if (!spotifyConfigured()) {
        // SAID OUT LOUD, never a silent empty list — the phone falls back to
        // typing and needs to know that is what happened, which is
        // `import-intro.js`'s `fellBack` rule wearing another hat.
        return sendJson(res, 200, { ok: true, configured: false, tracks: [] }), true;
      }
      return sendJson(res, 200, {
        ok: true, configured: true, tracks: await searchTracks(String(body.q || '')),
      }), true;
    }

    // The engine flushes and pushes through `onChange`; this is the phone's
    // own answer, and a refusal carries its reason in one word so the box can
    // say which of the four it was.
    return sendJson(res, 200, session.engine.request({
      playerId: String(body.playerId || ''),
      token: String(body.token || ''),
      artist: body.artist,
      title: body.title,
      source: body.source,
    })), true;
  }

  /*
   * ---- WHAT A BROWSER SAW GO WRONG — `src/flight.js` -----------------------
   *
   * Open, like every phone route: a phone has no login, and a phone that
   * cannot report a failure is the one whose failure takes an hour to find.
   * It files under the room the join code names, or the signed-in
   * quizmaster's own room for a console page. The body is capped and every
   * field is cut to a line by the recorder, so the worst a stranger can do
   * with it is write a short sentence into a log they cannot read.
   */
  if (route === '/api/flight' && req.method === 'POST') {
    const body = await readJson(req, 4096);
    const room = whoIs(req, url) ? roomForHost(req, url) : roomForPhone(req, url, body);
    const kind = String(body.kind || 'browser').slice(0, 24);
    flight.note(kind, `${String(body.page || '')} ${String(body.msg || '')}`.trim(), {
      room: room.id, level: body.level === 'warn' ? 'warn' : 'fail', data: body.data ?? null,
    });
    return sendJson(res, 200, { ok: true }), true;
  }

  if (route === '/api/join' && req.method === 'POST') {
    const body = await readJson(req);
    const room = roomForPhone(req, url, body);
    res.flightRoom = room.id;
    const player = room.session.joinPlayer({ playerId: body.playerId, token: body.token, name: body.name, tryId: body.tryId });
    // A game that will not hold any more phones. Says so rather than handing
    // back an empty team, which the phone would draw as a joined player with
    // no name — see MAX_PLAYERS.
    if (player.full) {
      return sendJson(res, 503, { error: 'This game is full.', full: true }), true;
    }
    /*
     * Held at the door, not refused. A lot of NEW phones are arriving at once,
     * so the host is being asked whether it is a room or somebody messing
     * about — see src/joins.js. 202 rather than an error: nothing has gone
     * wrong, it just has not happened yet, and the phone waits and asks again.
     */
    if (player.waiting) {
      return sendJson(res, 202, {
        waiting: true, ahead: player.ahead,
        error: 'Waiting for the host to let everybody in.',
      }), true;
    }
    /*
     * The code goes back with the player so the phone can keep hold of it and
     * reconnect to the same game after a lock, a refresh or a lost signal —
     * the same reason it keeps the player id.
     *
     * And the TOKEN, which is the only place it is ever sent. It is the proof
     * this phone is that player: without it here the phone cannot answer at
     * all, and with it anywhere else a player id becomes a credential again.
     */
    return sendJson(res, 200, {
      id: player.id, token: player.token || '', name: player.name, score: player.score ?? 0,
      game: room.session.kind, joinCode: room.code,
    }), true;
  }

  /*
   * A photo from somebody's phone, straight onto the big screen.
   *
   * There is no approval step, on purpose and by the host's explicit decision:
   * the fun is that it is theirs to do, and he handles the room with the mic.
   * What he has instead is a switch that stops the lot and a bin for one, both
   * on his control view and both one tap.
   *
   * The body is the image itself rather than a form or base64. A phone photo
   * is already scaled down before it is sent; wrapping it in base64 would add
   * a third again for nothing, on the worst wifi in the building.
   */
  if (route === '/api/photo' && req.method === 'POST') {
    const room = roomForPhone(req, url);
    const { photos, session } = room;
    if (!photosWanted(room)) return sendJson(res, 200, { ok: false, reason: 'off' }), true;

    const playerId = String(url.searchParams.get('playerId') || '');
    const player = session.engine.state.players[playerId];
    // Joined phones only. Not a security boundary — it stops a stray request
    // putting an unattributed picture on a projector.
    if (!player) return sendJson(res, 200, { ok: false, reason: 'not_playing' }), true;

    let bytes;
    try {
      bytes = await readBody(req, MAX_BYTES);
    } catch {
      return sendJson(res, 200, { ok: false, reason: 'too_big' }), true;
    }

    const result = photos.add(bytes, {
      contentType: req.headers['content-type'],
      playerId,
      teamName: player.name,
      filter: String(url.searchParams.get('filter') || ''),
      // Read client-side, from the raw file before it was redrawn onto a
      // canvas — see looksCameraTaken() in filters.js. Best-effort, never a
      // gate: every photo still goes up regardless, this only decides
      // whether it is eligible for the public gallery later.
      camera: url.searchParams.get('camera') === '1',
    });
    /*
     * WHICH PROPS THE TRAY OFFERED AND WHICH GOT STUCK ON — see
     * `src/prop-use.js`. On the upload that already happens rather than a
     * route of its own: a phone in a pub should not make a second request to
     * tell the server something the first one could have carried.
     *
     * OUTSIDE the `result.ok` branch and never able to fail the photo. The
     * bookkeeping rule this repo already has for the spend ledger: a picture
     * lost to a counter would be the tail wagging the dog. It is also
     * deliberately recorded for a REFUSED photo — a prop somebody chose is a
     * prop somebody wanted, whether or not the JPEG survived the trip.
     */
    try {
      propUse.record({
        shown: String(url.searchParams.get('shown') || '').split(',').filter(Boolean),
        used: String(url.searchParams.get('used') || '').split(',').filter(Boolean),
      });
      backUpPropUse();
    } catch { /* never fatal */ }
    if (result.ok) {
      /*
       * A PHOTOGRAPH IS THE KEY ON A DJ SET — see `src/dj.js`.
       *
       * **A CAPABILITY CHECK, NEVER A BRANCH ON THE GAME KIND.** `engine.js`
       * and `bingo.js` have no `notePhoto` and are therefore untouched by
       * this line — a pub night's payload stays byte-for-byte what it was,
       * and a third game that wants the same unlock gets it by having the
       * method rather than by this route learning its name.
       *
       * Only on `result.ok`: a refused upload must not unlock anything, or
       * the lock is one a big enough file walks through.
       */
      if (typeof session.engine.notePhoto === 'function') {
        session.engine.notePhoto(playerId);
      }
      pushState(room);
      // File it away in the background. The phone gets its answer first —
      // nobody should watch a spinner while GitHub thinks about it — and the
      // photo is on screen either way. This is only about surviving the
      // restart that would otherwise wipe it.
      fileAway(room, result.photo);
    }
    return sendJson(res, 200, result.ok ? { ok: true, id: result.photo.id } : result), true;
  }

  // What a phone is allowed to do: answer a question, mark a bingo square and
  // call house, tap away a message the host sent it, vote for the funniest
  // photograph of the night, and — on an online night — say something in one
  // of its own rooms. Nothing else, and nothing that could hand out a new card.
  if (['/api/answer', '/api/answer-breakout', '/api/mark', '/api/claim', '/api/wandered', '/api/say', '/api/team', '/api/arcade', '/api/note-read', '/api/photo-vote'].includes(route) && req.method === 'POST') {
    const body = await readJson(req);
    const action = route.slice('/api/'.length);
    const room = roomForPhone(req, url, body);
    res.flightRoom = room.id;
    const result = room.session.runPlayerAction(action, body);
    // 200 either way: the phone shows its own feedback, and a rejected action
    // is a normal thing (too late, already answered), not an error.
    return sendJson(res, 200, result), true;
  }

  /*
   * ---- A PHOTOGRAPH FROM SOMEBODY WORKING THE ROOM ----------------------
   *
   * Asked for as *"one of the bar staff could also get access to this… and
   * then they all go into one like shared bucket."*
   *
   * **IT IS THE ROOM'S OWN JOIN CODE AND NOTHING ELSE**, which was a decision
   * rather than the easy option. A revocable staff key was the alternative and
   * it buys nothing here: anybody holding the code can already upload by
   * joining the room, so a key would be a lock on a door standing beside an
   * open one — and it would need a store that survives a deploy, which on this
   * host means the private repo and a new way for a Thursday to go wrong.
   *
   * **NO PLAYER, SO NO ROW ON THE BOARD** — the whole point. `POST /api/photo`
   * needs a joined phone and would put the bar on the leaderboard and the
   * projector; here the photograph lands with an empty `teamName`, exactly as
   * the quizmaster's own does, and the screen only draws a caption when there
   * is one.
   *
   * **IT ADDS NO REACH THAT THE JOIN CODE DID NOT ALREADY CARRY.** The same
   * store, the same cap, the same kill switch and the same bin. What it
   * removes is the team, which is the only thing anybody wanted removed.
   *
   * **THE KILL SWITCH APPLIES; THE BREAK PLAN DOES NOT** — the control view's
   * own camera made this call first. `photosWanted()` also answers *is a
   * camera being offered to PHONES right now*, which is a question about the
   * gaps in the night; somebody carrying glasses is not on that clock.
   */
  if (route === '/api/snap' && req.method === 'POST') {
    /*
     * NO CODE AT ALL IS AN ERROR HERE, AND THE ROUTE HAS TO SAY SO ITSELF.
     *
     * `roomForPhone()` hands back the HOUSE room when no code is given, which
     * is right for `/api/photo` and `/api/join` — his own projector, and every
     * card printed before rooms existed. It is wrong for this one, and the
     * page, the console panel and CLAUDE.md all said it could not happen while
     * the route did it: a bare `POST /api/snap` with no code, no cookie and no
     * key returned `{ok:true}` and put a photograph on the house room's
     * projector. That is an unauthenticated write, reachable by guessing a
     * short path.
     *
     * A junk code was already refused; it was the ABSENT one that fell
     * through, which is the shape `roomForPhone()` itself records — *falling
     * back to HOUSE is the same fault wearing a friendlier face*.
     *
     * Refused BEFORE the body is read, so a flood costs nothing.
     */
    if (!tidyCode(url.searchParams.get('g') || '')) {
      return sendJson(res, 400, { error: 'That link is missing its room.' }), true;
    }
    // Refuses a junk code outright rather than handing back the house room —
    // see `roomForPhone()`. A link given out broken must read as broken.
    const room = roomForPhone(req, url);

    let bytes;
    try {
      bytes = await readBody(req, MAX_BYTES);
    } catch {
      return sendJson(res, 200, { ok: false, reason: 'too_big' }), true;
    }

    const result = room.photos.add(bytes, {
      contentType: req.headers['content-type'],
      playerId: '',
      teamName: '',
      // Read on the raw file in the browser before the shrink's canvas stripped
      // the EXIF. Never a gate, and it no longer decides the gallery either:
      // this route carries no playerId, which is what marks it as the HOUSE
      // camera's own — see ROOM_SUFFIX in photos.js.
      camera: url.searchParams.get('camera') !== '0',
    });
    /*
     * AND THE PROPS ARE COUNTED HERE TOO — `src/prop-use.js`.
     *
     * This page shows the same tray as a player's phone now, so a route that
     * did not read the tally would make the numbers a sample of the room and
     * not of the app, silently, and the whole point of that table is deciding
     * which drawings to delete. **A guard that answers confidently about
     * something it is not looking at** is what the `shown` half exists to
     * prevent in the first place.
     *
     * Same shape as `/api/photo`'s: outside the `result.ok` branch, never able
     * to fail the photograph, and deliberately recorded for a refused one — a
     * prop somebody chose is a prop somebody wanted.
     */
    try {
      propUse.record({
        shown: String(url.searchParams.get('shown') || '').split(',').filter(Boolean),
        used: String(url.searchParams.get('used') || '').split(',').filter(Boolean),
      });
      backUpPropUse();
    } catch { /* never fatal */ }
    if (result.ok) {
      pushState(room);
      /*
       * AND IT IS FILED AWAY, THE SAME AS A PLAYER'S — which this route did
       * not do, so a photograph the BAR took lived on the projector and
       * `/wall` and nowhere else.
       *
       * `data/` is wiped by every deploy and every push is a deploy, so
       * "nowhere else" meant gone by the next docs change. Past gigs and the
       * gallery are both served out of the private repo (`photoBytes()`), so
       * the bar's pictures were missing from the night's folder, from the
       * evidence shown to a landlord and from anything published afterwards —
       * silently, and worst on exactly the night somebody handed the camera
       * round the most.
       *
       * **IT BREAKS "ONE BUCKET" FROM THE OTHER END.** That rule is written as
       * *one bin press clears the projector, `/wall`, the grid and the night's
       * folder together* — true of the bin, and the reason nobody noticed is
       * that the folder half was never filled. `photos.add()` really was the
       * one door in; `fileAway()` is the one door out, and only one of the two
       * routes through it was calling it.
       *
       * Fire-and-forget behind the reply, exactly as `/api/photo` does it: the
       * phone gets its answer first and the picture is on screen either way,
       * because this is only ever about surviving the restart.
       */
      fileAway(room, result.photo);
    }
    return sendJson(res, 200, result), true;
  }

  /*
   * ASK FOR A ROUND — from a phone that played, at the end of the night.
   *
   * Its own route rather than a player action, because what is typed goes to
   * the ROOM'S box on disk and never into the game state: a quiz engine has no
   * business holding somebody's shopping list, and a state file that grew with
   * every request would be rewritten on every save all night.
   *
   * The TOKEN is the whole gate. It proves the sender was in this game, which
   * is what makes an open text endpoint safe to have at all — and it is the
   * same proof rule 3 uses for answering, so nothing new is trusted here.
   */
  if (route === '/api/ask' && req.method === 'POST') {
    const body = await readJson(req);
    const room = roomForPhone(req, url, body);
    const engine = room.session.engine;
    const state = engine && engine.state;
    // Off unless the night turned it on, and only once the night is over.
    if (!state || !state.askForRounds || state.phase !== 'final') {
      return sendJson(res, 200, { ok: false, reason: 'closed' }), true;
    }
    const player = state.players && state.players[String(body.playerId || '')];
    if (!ownsPlayer(player, body.token)) {
      return sendJson(res, 200, { ok: false, reason: 'unknown' }), true;
    }
    /*
     * AN ID, NEVER WORDS. The label is looked up from the server's own list,
     * so nothing a stranger types can reach the quizmaster — which is what
     * removes the moderation question rather than managing it.
     */
    const offered = (state.roundIdeas || []).some((i) => i.id === String(body.ideaId || ''));
    const label = offered ? ideaLabel(String(body.ideaId || '')) : '';
    if (!label) return sendJson(res, 200, { ok: false, reason: 'unknown' }), true;
    const saved = room.asks.vote({
      ideaId: String(body.ideaId),
      label,
      by: player.id,
      name: player.name,
      night: nightOfGig(Date.now()) || '',
      venue: state.venue || '',
    });
    if (saved.ok) backUpAsks(room);
    return sendJson(res, 200, saved.ok ? { ok: true } : saved), true;
  }

  /*
   * ---- everything below this line needs an account
   *
   * A broad gate first, so nothing new can be added below it and accidentally
   * be public. The routes that need MORE than "is a quizmaster" ask for it
   * themselves underneath — generating, in particular, is the owner's alone
   * because it spends the owner's money.
   *
   * Asked with `live` set: this covers /api/host/*, which is the control view,
   * and a failed payment must never take the Next button away in the middle of
   * a round. A new night cannot be launched on a lapsed subscription — that is
   * checked on `launch` itself, below.
   */
  //
  // Both lists live in `src/gates.js` — a rule you cannot import is a rule you
  // cannot write a test for, and this one has been wrong twice. Read the
  // comments there before adding a route to either.
  const changesLibrary = changesTheLibrary(route, req.method);
  if (changesLibrary) {
    if (!allowed(req, res, url, FEATURES.CATALOGUE)) return true;
  }

  /*
   * Advert sets have their own gate now that they are per room.
   *
   * They used to be owner-only, purely because one shared folder meant a
   * second quizmaster tidying their venue list could delete somebody else's
   * slides. That is fixed, and under the host's own tier rule a slide costs
   * nothing to run — so writing them is a quizmaster's, on their own set.
   *
   * Asked EXPLICITLY rather than left to the broad quiz gate below, so the
   * refusal names adverts instead of talking about quiz features. The owner
   * still cannot write one, and that is consistent rather than an oversight:
   * an owner runs no nights, so they have no projector to put a slide on.
   */
  const advertRoute = route === '/api/advert' || route.startsWith('/api/advert/');
  if (advertRoute && !changesLibrary) {
    if (!allowed(req, res, url, FEATURES.ADVERTS, { live: true })) return true;
  }

  /*
   * CHECKING A PACK IS BEHIND "SIGNED IN" AND NOTHING ELSE — see CHECKS_ONLY.
   *
   * It validates whatever arrived in the body: no room, no disk, no library.
   * Left to the broad quiz gate it was refused for the OWNER, who holds no
   * quiz features and writes every pack in the catalogue — so the one control
   * whose job is "is this pack fit to sell" was switched off for the only
   * account that sells any.
   */
  const checkRoute = CHECKS_ONLY.includes(route);
  if (checkRoute && !whoIs(req, url)) {
    return sendJson(res, 401, { error: 'Sign in first', signIn: '/login' }), true;
  }

  /*
   * A DJ SET IS NOT A QUIZ FEATURE — see `/api/dj/*` below.
   *
   * Left to the broad gate the desk would be behind `FEATURES.QUIZ`, which
   * would decide what a DJ set costs by accident, in the hardest place to find
   * it later. Signed in is the whole check, and the pricing decision stays
   * un-taken until somebody takes it.
   */
  const djRoute = route.startsWith('/api/dj/');
  if (djRoute && !whoIs(req, url)) {
    return sendJson(res, 401, { error: 'Sign in first', signIn: '/login' }), true;
  }

  // The owner has no quiz features by design, so anything they alone may do has
  // to skip the broad gate below — the third time that has caught something.
  if (!changesLibrary && !advertRoute && !checkRoute && !djRoute
      && !OWNER_ONLY.some((prefix) => route.startsWith(prefix))) {
    if (!allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
  }

  return false;
}
