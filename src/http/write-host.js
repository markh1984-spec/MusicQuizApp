/**
 * WRITE ROUTES — host. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { ANY_LOBBY_GAME, FEATURES, HOST_MOVES, MAX_ROUNDS, accounts, canPlayPack, comeBackFor, config, entitlements, flight, fullLibrary, hostCursor, isOwnPack, isSting, listOwn, lobbyGameFor, lobbyGamesFor, packlessKind, photosRepoConfigured, pickIdeas, reports, wholePackKind } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { packDating, photoLinkFor, roomForHost, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { pushState, startIntroTrack } from './views.js';
import { backUpLibraryStats, backUpReports, fileAway, seesTheirLeague } from './helpers.js';

export async function writeHost(req, res, url, route) {
  if (route.startsWith('/api/host/') && req.method === 'POST') {
    const action = route.slice('/api/host/'.length);
    const body = await readJson(req);
    // Always your own room, worked out from who you are signed in as. There is
    // no room parameter on any of these on purpose: a control view that could
    // be pointed at somebody else's night is the whole thing rooms exist to
    // prevent.
    const room = roomForHost(req, url);
    const { session, photos } = room;
    // So a refusal from here down is filed under this night — see `sendJson`.
    res.flightRoom = room.id;

    // Launching a different game is the one action that replaces the engine.
    if (action === 'launch') {
      /*
       * The one host action a lapsed subscription DOES stop.
       *
       * Everything else under /api/host/ is asked with `live` set, because a
       * card that failed on Tuesday must not take the Next button away from
       * somebody mid-round on Wednesday. Starting a brand new night is the
       * other side of that line: it is not an interruption, it is a beginning,
       * and it is exactly where "you need to sort the payment out" belongs.
       */
      // A quiz needs QUIZ; every other kind is a bingo of some sort and needs
      // BINGO. This read `=== 'bingo'`, so Card Bingo was gated on QUIZ.
      const wanted = String(body.game || 'quiz') === 'quiz' ? FEATURES.QUIZ : FEATURES.BINGO;
      const launcher = allowed(req, res, url, wanted);
      if (!launcher) return true;
      /*
       * And it has to be a pack they actually hold.
       *
       * Checked here rather than trusted to the console not drawing a Launch
       * button, because a pack id is one word in a request body — the same
       * hole `POST /api/quiz` had, where the id was in the body and the route
       * prefix never matched it. Refused as a 403 with the reason in words
       * rather than a bare no: on a starter library "that one is not in your
       * library" is a sentence somebody can act on, and a silent failure at
       * launch is the worst possible moment for one.
       */
      const launchKind = String(body.game || 'quiz');
      /*
       * EVERY PACK IN THE RUNNING ORDER IS CHECKED, not just the one in
       * `packId` — and getting this wrong would be a gate that runs backwards.
       * A night composed of rounds is still a night made of packs, so a Bronze
       * account could otherwise borrow one round from a Gold quiz and play it,
       * which is the whole subscription walked round in a drag.
       *
       * `order` is only honoured for a quiz: a bingo game is a track list with
       * no rounds in it on disk, so there is nothing to take one of.
       */
      const wantedOrder = (launchKind === 'quiz' && Array.isArray(body.order))
        ? body.order.slice(0, MAX_ROUNDS)
        : null;
      // The deck is built in — nothing to own, so nothing to check.
      const needed = packlessKind(launchKind) ? []
        : wantedOrder && wantedOrder.length
          ? [...new Set(wantedOrder.map((r) => String((r && r.packId) || '')))]
          : [String(body.packId)];
      for (const id of needed) {
        if (isOwnPack(launchKind, id, room.paths)) continue;
        if (canPlayPack(whoIs(req, url), id, packDating(launchKind, id, room))) continue;
        return sendJson(res, 403, {
          error: needed.length > 1
            ? `${id} is not in your library, so it cannot be part of tonight.`
            : 'That pack is not in your library.',
          upgrade: true,
        }), true;
      }
      /*
       * And it must not end a night somebody is in the middle of.
       *
       * `session.launch()` builds a fresh game unconditionally, so before this
       * two people on one login could wipe each other's game mid-question —
       * reachable today by password sharing, which is what happens the moment
       * anybody decides three subscriptions are too many.
       *
       * **It says what it is about to destroy rather than refusing outright.**
       * A control that simply says no in front of a room is the mistake this
       * codebase keeps recording, and there are real reasons to launch over a
       * live game — the wrong pack went up, or the night genuinely restarts.
       * So the first press comes back with the game, the player count and
       * where it has got to, and a second deliberate press carries `replace`.
       * Nobody does that by accident.
       */
      const live = session.inProgress();
      if (live && !body.replace) {
        return sendJson(res, 409, {
          error: `"${live.title}" is running right now — ${live.players} playing${live.at ? `, ${live.at}` : ''}.`
            + ' Launching something else ends it and wipes the scores.',
          live,
          replace: true,
        }), true;
      }

      try {
        // The card shape is chosen at launch, not stored on the pack: the same
        // forty-two songs are a quick game on a 3x3 and a long one on a strip,
        // and which you want is a decision about tonight.
        const shape = body.shape && Number(body.shape.rows) && Number(body.shape.cols)
          ? { rows: Number(body.shape.rows), cols: Number(body.shape.cols) }
          : null;
        const prizes = Math.max(0, Math.min(5, Number(body.prizes) || 0));
        /*
         * How many places tonight recognises. 0 means the console did not ask,
         * which leaves the engine's default of three — so an old console, or a
         * saved show from before this existed, launches exactly as it did.
         * `session.launch()` clamps it again; this is the door, not the rule.
         */
        const winners = Math.max(0, Math.min(3, Number(body.winners) || 0));
        // How it looks tonight. Same reasoning as the card shape: the pack
        // carries a default, and "it is the fourteenth of February" is a fact
        // about this evening rather than about the pack.
        const look = String(body.look || '');
        // How long each question runs tonight, if the host chose to change
        // it — the pack editor no longer offers this at all (Tonight is the
        // only place it is set, exactly like Look). 0 means "as the pack
        // says". Clamped to the same 5-120 range the editor's own field used
        // to enforce, so a stray value from a curl call cannot hand the room
        // a one-second question or a five-minute one.
        const questionSeconds = body.questionSeconds
          ? Math.max(5, Math.min(120, Number(body.questionSeconds) || 0)) : 0;
        /*
         * WHICH LOBBY GAME, and the TIER IS CHECKED HERE because this is where
         * the account is known. A console cannot be the gate — it is the thing
         * somebody would edit — so a game above this tier is dropped and the
         * night falls back to the default for its kind rather than being
         * refused. Losing a choice costs a game nobody has seen yet; refusing
         * the launch costs the night.
         */
        const tierNow = (entitlements(whoIs(req, url) || {}) || {}).tierInUse || '';
        const lobbyGame = lobbyGameFor(
          String(body.game || 'quiz'),
          String(body.lobbyGame || ''),
          tierNow,
        ).id;
        /*
         * AND "LET THEM CHOOSE" IS A LIST, RESOLVED IN THE SAME BREATH.
         *
         * The tier is read once, here, where the account is known — so the
         * list a room is handed is the list that account holds, and the phone
         * honours it without re-checking, exactly as it honours the single
         * choice above. A console that sent the sentinel while holding
         * nothing gets an empty list and the night falls back to one game,
         * which is what every night did before this existed.
         */
        const lobbyGames = String(body.lobbyGame || '') === ANY_LOBBY_GAME
          ? lobbyGamesFor(String(body.game || 'quiz'), tierNow)
          : [];

        /*
         * WHETHER TONIGHT ENDS ON A LEAGUE TABLE, decided HERE.
         *
         * The tier is checked at the route and never in the console — the same
         * rule the lobby game above follows, and for the same reason: the
         * console can be reloaded, edited or simply stale, and a projector
         * showing a Silver feature to a Bronze account is a gate that runs
         * backwards.
         *
         * Losing it costs a slide at the end of the night, never the launch.
         */
        const league = seesTheirLeague(req, url);
        // Whether the phones may make a noise. Defaults to yes, so a console
        // that has not been reloaded since this landed does not mute the room.
        const lobbySound = body.lobbySound !== false;
        // Whether anybody is in the room. Same shape of decision again: the
        // pack does not know, and tonight does.
        const online = Boolean(body.online);
        // Several phones, one team, scores averaged. Also a fact about tonight.
        const teamPlay = Boolean(body.teamPlay);
        // Cleaned inside `session.launch()`, where the ordinary launch cleans
        // it too — one definition of what the word means.
        const teamMode = String(body.teamMode || '');
        // Where tonight is — a name, so it works before venue accounts exist.
        const venue = String(body.venue || '');
        /*
         * WHAT FIRST, SECOND AND THIRD GET — READ OFF THE VENUE, not sent.
         *
         * A prize is the VENUE'S standing arrangement rather than a decision
         * about tonight: the same drink every week at one pub and something
         * else entirely at another. So it is set once on the Venues tab and
         * the launch form does not carry it at all — which is why there is no
         * "What they win" box on a pack card. Look, Where and Playing are
         * facts about the evening; this is not.
         *
         * Resolved HERE rather than in the browser so there is one source of
         * truth and a stale console cannot launch a night playing for
         * something the venue never agreed to. A body that carries `rewards`
         * still wins, so a curl call and every test keep working.
         */
        const named = String(body.venue || '').trim().toLowerCase();
        const record = named
          ? (room.invoices.customers.find((c) => String(c.name || '').trim().toLowerCase() === named) || {})
          : {};
        /*
         * THE VENUE'S ID, WRITTEN ONTO THE NIGHT BESIDE ITS NAME.
         *
         * Everything that groups nights by venue has matched on the NAME
         * lowercased — the adverts, the headcounts, the league. That works
         * until a pub is renamed or typed differently, and then one venue
         * silently becomes two half-histories with no way to notice.
         *
         * The record is already resolved here for the prizes and the logo, so
         * the id costs nothing to carry. **The name stays** and is still
         * written: every night filed before today has only a name, and a join
         * that could not read those would throw away the entire history it
         * exists to keep together.
         */
        const venueId = String(record.id || '');
        const onFile = record.rewards || null;
        const rewards = Array.isArray(body.rewards) ? body.rewards.map(String)
          : (body.reward ? [String(body.reward)] : (Array.isArray(onFile) ? onFile : []));
        /*
         * The venue's logo, read off the same record as the prizes and for the
         * identical reason: it is the venue's standing arrangement rather than
         * a decision about tonight, so it is never sent by the console. It
         * ends up on the winner's phone above the code, so the voucher reads
         * as something the pub issued rather than a string.
         */
        const venueLogo = String(record.logo || '');
        /*
         * WHEN THE NEXT ONE IS — WORKED OUT HERE, not sent, exactly like the
         * prizes above and for the same reason.
         *
         * The last slide of the night says "Back here Thursday 20th", and the
         * date comes from the venue's usual night and the diary rather than
         * from a box somebody types at the moment they are most rushed. A
         * night written off in the diary is skipped and a one-off wins over a
         * residency, because `upcoming()` already decides all of that — see
         * src/comeback.js.
         *
         * Resolved on the SERVER so a stale console cannot promise a room a
         * date that was cancelled this morning.
         */
        const comeBack = comeBackFor({
          venue,
          venues: room.invoices.customers,
          bookings: room.invoices.bookings,
          now: Date.now(),
        });
        /*
         * DOES THIS ROOM ASK WHAT THEY WANT NEXT TIME?
         *
         * A SWITCH on My account rather than a gate on a tier, at the host's
         * own reading: it decides whether three buttons appear on a phone at
         * the end of a night, which is a preference about how somebody runs a
         * room. Off unless turned on — a quizmaster who has never heard of it
         * should not have their room asked anything.
         *
         * Resolved here and written into the state at launch, exactly like the
         * prizes: a phone must never be able to ask on a night that did not
         * turn it on, whatever the setting says by the time it taps.
         */
        const asker = whoIs(req, url);
        const askForRounds = Boolean(asker && asker.prefs && asker.prefs.askRounds);
        /*
         * The three on offer — from what this room's library has NOT got, so
         * a Madonna round is never suggested to somebody who owns the Madonna
         * quiz. Picked once, here, so every phone votes on the same three.
         */
        const askIdeas = askForRounds
          ? pickIdeas((fullLibrary(config, room.id, listOwn(room.paths)).quizzes || [])
            .map((q) => q.title))
          : [];
        const started = session.launch(String(body.game || 'quiz'), String(body.packId), { shape, prizes, winners, look, questionSeconds, lobbyGame, lobbyGames, lobbySound, league, online, teamPlay, teamMode, venue, venueId, rewards, venueLogo, comeBack, photoLink: photoLinkFor(req, url, venue), askForRounds, roundIdeas: askIdeas, order: wantedOrder, breakPlan: body.breakPlan || {} });
        /*
         * AND IF A LAPSED SUBSCRIPTION GOT THROUGH, THIS IS THE NIGHT IT
         * SPENDS — stamped AFTER the launch, never before it.
         *
         * `mayStartSomething()` allows one more app-day of launching after a
         * subscription lapses (see `lastNightLeft()`), and the day is stamped
         * on the LAUNCH ROUTES rather than inside that check, because the
         * check runs on every gated route and opening the console on a
         * Wednesday must not spend the Thursday.
         *
         * **It has to be the last thing, not the first.** Stamped before the
         * pack check and the 409 it was spent by launches that never
         * happened: a pack since deleted, a "that would end the live game"
         * prompt somebody cancelled — and worst, `switchIfFree()` fires a
         * real launch and swallows the 409, so merely TAPPING a pack tile on
         * a Wednesday silently spent the Thursday. That is exactly the nasty
         * shock this grace exists to prevent.
         *
         * Idempotent within a day, so the bingo after the quiz is the same
         * night.
         */
        accounts.useLastNight(launcher);
        // Never awaited: a host pressing Launch with a room waiting does not
        // care whether GitHub is having a good day.
        backUpLibraryStats();
        flight.note('launch', `Launched ${session.kind} "${session.pack && session.pack.title || session.pack && session.pack.id || '?'}"`, { room: room.id });
        return sendJson(res, 200, { ok: true, started, view: session.hostView() }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }

    /*
     * TONIGHT AS MORE THAN ONE GAME — quiz, a bingo interlude, quiz again,
     * with the same teams and one running score across the interruption. A
     * SEPARATE action from `launch` above rather than a flag on it, so the
     * ordinary single-pack path above — the one `launch-route.test.js`
     * guards as protected surface — is not touched by any of this.
     *
     * Every check `launch` makes, this makes too: the feature gate per kind
     * actually used, every referenced pack owned or licensed (not just the
     * first one), and the same "here is what you are about to destroy"
     * guard before replacing a live game.
     */
    if (action === 'launchOrder') {
      const rawSegments = Array.isArray(body.segments) ? body.segments : [];
      const segments = rawSegments.map((s) => {
        /*
         * WHAT THIS PART PAYS — carried through, cleaned in
         * `normaliseSegments()` where the rest of a segment is cleaned.
         *
         * THIS OBJECT IS A WHITELIST AND A FIELD MISSING FROM IT IS DROPPED
         * IN SILENCE — the trap `winners` fell into, wired through the bar,
         * the night, both payload builders, the route and the session, and
         * still arriving null because nobody named it in a literal like this
         * one. Nothing throws; the night just pays the wrong thing.
         *
         * `undefined` when the host never opened *What they win* for this
         * part, which `normaliseSegments()` reads as *use the night's list*
         * — the venue's, exactly as before. An ordinary night sends nothing
         * here and is unchanged.
         */
        const rewards = Array.isArray(s && s.rewards) ? s.rewards.map(String) : undefined;
        // Every whole-pack kind keeps its own — see `wholePackKind()`.
        if (s && wholePackKind(s.kind)) {
          return { kind: s.kind, packId: String((s && s.packId) || ''), shape: s.shape, prizes: s.prizes, rewards };
        }
        const order = Array.isArray(s && s.order) ? s.order.slice(0, MAX_ROUNDS) : [];
        return { kind: 'quiz', order, rewards };
      }).filter((s) => (s.kind !== 'quiz' ? s.packId : s.order.length));

      // Every pack in every part, checked the same way `launch` checks its
      // one pack (or its own single-kind running order) — a Bronze account
      // must not be able to smuggle a Gold pack in as part 3 of a night.
      const neededQuiz = new Set();
      const neededBingo = new Set();
      let neededGame = false;
      for (const s of segments) {
        if (s.kind === 'quiz') for (const r of s.order) neededQuiz.add(String((r && r.packId) || ''));
        else {
          neededGame = true;
          if (!packlessKind(s.kind)) neededBingo.add(s.packId);
        }
      }
      for (const id of neededQuiz) {
        if (isOwnPack('quiz', id, room.paths)) continue;
        if (canPlayPack(whoIs(req, url), id, packDating('quiz', id, room))) continue;
        return sendJson(res, 403, { error: `${id} is not in your library, so it cannot be part of tonight.`, upgrade: true }), true;
      }
      for (const id of neededBingo) {
        if (isOwnPack('bingo', id, room.paths)) continue;
        if (canPlayPack(whoIs(req, url), id, packDating('bingo', id, room))) continue;
        return sendJson(res, 403, { error: `${id} is not in your library, so it cannot be part of tonight.`, upgrade: true }), true;
      }
      // Gate on whichever kinds tonight actually uses — a quiz-only account
      // running a quiz-only running order must not be asked about bingo.
      if (neededQuiz.size && !allowed(req, res, url, FEATURES.QUIZ)) return true;
      if (neededGame && !allowed(req, res, url, FEATURES.BINGO)) return true;
      const live = session.inProgress();
      if (live && !body.replace) {
        return sendJson(res, 409, {
          error: `"${live.title}" is running right now — ${live.players} playing${live.at ? `, ${live.at}` : ''}.`
            + ' Launching something else ends it and wipes the scores.',
          live,
          replace: true,
        }), true;
      }

      try {
        // The FIRST part decides the lobby default — Maze Mouth before a
        // quiz, Rally before bingo — exactly like an ordinary launch.
        const firstKind = segments[0] && segments[0].kind === 'bingo' ? 'bingo' : 'quiz';
        const look = String(body.look || '');
        // Same clamp as an ordinary launch — one number for the whole night,
        // applied to every quiz part; see nightWideOpts() for how it carries
        // across a bingo interlude untouched.
        const questionSeconds = body.questionSeconds
          ? Math.max(5, Math.min(120, Number(body.questionSeconds) || 0)) : 0;
        const tierNow = (entitlements(whoIs(req, url) || {}) || {}).tierInUse || '';
        const lobbyGame = lobbyGameFor(
          firstKind,
          String(body.lobbyGame || ''),
          tierNow,
        ).id;
        /*
         * AND "LET THEM CHOOSE" IS A LIST, RESOLVED IN THE SAME BREATH.
         *
         * The tier is read once, here, where the account is known — so the
         * list a room is handed is the list that account holds, and the phone
         * honours it without re-checking, exactly as it honours the single
         * choice above. A console that sent the sentinel while holding
         * nothing gets an empty list and the night falls back to one game,
         * which is what every night did before this existed.
         */
        const lobbyGames = String(body.lobbyGame || '') === ANY_LOBBY_GAME
          ? lobbyGamesFor(firstKind, tierNow)
          : [];

        const league = seesTheirLeague(req, url);
        const lobbySound = body.lobbySound !== false;
        const online = Boolean(body.online);
        const teamPlay = Boolean(body.teamPlay);
        // Cleaned inside `session.launch()`, where the ordinary launch cleans
        // it too — one definition of what the word means.
        const teamMode = String(body.teamMode || '');
        const venue = String(body.venue || '');
        const named = String(body.venue || '').trim().toLowerCase();
        const record = named
          ? (room.invoices.customers.find((c) => String(c.name || '').trim().toLowerCase() === named) || {})
          : {};
        const venueId = String(record.id || '');
        const onFile = record.rewards || null;
        const rewards = Array.isArray(body.rewards) ? body.rewards.map(String)
          : (body.reward ? [String(body.reward)] : (Array.isArray(onFile) ? onFile : []));
        const venueLogo = String(record.logo || '');
        const comeBack = comeBackFor({
          venue,
          venues: room.invoices.customers,
          bookings: room.invoices.bookings,
          now: Date.now(),
        });
        const asker = whoIs(req, url);
        const askForRounds = Boolean(asker && asker.prefs && asker.prefs.askRounds);
        const askIdeas = askForRounds
          ? pickIdeas((fullLibrary(config, room.id, listOwn(room.paths)).quizzes || [])
            .map((q) => q.title))
          : [];
        /*
         * How many places the night recognises, on the mixed path too. A
         * running order reaches ONE final, so this is a fact about the whole
         * evening exactly as it is on the ordinary launch.
         */
        const winners = Math.max(0, Math.min(3, Number(body.winners) || 0));
        const started = session.launchRunningOrder(segments, {
          look, questionSeconds, lobbyGame, lobbyGames, lobbySound, league, online, teamPlay, teamMode, winners, venue, venueId,
          rewards, venueLogo, comeBack, photoLink: photoLinkFor(req, url, venue),
          askForRounds, roundIdeas: askIdeas,
          /*
           * WHAT HAPPENS IN THE GAPS — passed straight through and cleaned
           * inside `session.launch()`, exactly where the ordinary launch
           * cleans it, so a plan cannot be valid on one route and not the
           * other. `|| {}` rather than leaving it undefined: a launch that
           * sends no plan must CLEAR the previous night's, not inherit it.
           */
          breakPlan: body.breakPlan || {},
        });
        // A running order is a night like any other — see `launch` above.
        // Both routes spend it, or the composed half hands out an endless
        // grace; and both spend it only once the night is actually on.
        accounts.useLastNight(whoIs(req, url));
        backUpLibraryStats();
        flight.note('launch', `Launched ${session.kind} "${session.pack && session.pack.title || session.pack && session.pack.id || '?'}"`, { room: room.id });
        return sendJson(res, 200, { ok: true, started, view: session.hostView() }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }

    /*
     * "That one's wrong."
     *
     * One tap, no typing, no dialog. The room has just told the host a question
     * is wrong and there are sixty people waiting — anything more than a tap
     * does not get used, and a correction that does not get reported is a
     * correction that reaches nobody.
     *
     * What is reported is read off the RUNNING GAME rather than sent by the
     * browser, so there is nothing to get out of step and nothing a stale page
     * can mis-report.
     */
    if (action === 'reportQuestion') {
      const engine = session.engine;
      const q = typeof engine.question === 'function' ? engine.question() : null;
      const round = typeof engine.round === 'function' ? engine.round() : null;
      if (!q) return sendJson(res, 200, { ok: false, reason: 'no_question' }), true;
      const me = whoIs(req, url);
      const result = reports.add({
        packId: session.pack?.id || '',
        packKind: session.kind,
        roundIndex: engine.state.roundIndex,
        questionIndex: engine.state.questionIndex,
        questionId: q.id || '',
        prompt: q.prompt || '',
        answer: typeof engine.answerText === 'function' ? engine.answerText(q, round) : '',
        note: String(body.note || ''),
        by: (me && (me.name || me.email)) || 'Host key',
      });
      if (result.ok) backUpReports();
      return sendJson(res, 200, result), true;
    }

    /*
     * THE SOUNDBOARD. One press, one noise, out of the projector laptop.
     *
     * **THE ID IS VALIDATED AGAINST `stings.js`'S OWN LIST**, not trusted: it
     * arrives as one word in a request body, which is exactly the shape of
     * `packId` and `wantedTier`. An unknown one is refused rather than
     * ignored, because a button that reports success it did not have is this
     * repo's commonest fault.
     *
     * **NOT GATED ON A SUBSCRIPTION FEATURE.** It is asked with `live` like
     * every other control on this view — a card that failed on Tuesday must
     * not take a noise away from somebody mid-round on Wednesday — and it is
     * a garnish rather than a thing to sell.
     *
     * It writes to the ROOM and never to the game state (see `viewFor`), so
     * nothing here can move a quiz, and a restart replays nothing.
     */
    if (action === 'sting') {
      const id = String(body.id || '');
      if (!isSting(id)) return sendJson(res, 400, { error: 'Unknown sound: ' + id }), true;
      room.sting = { id, at: Date.now() };
      pushState(room);
      return sendJson(res, 200, { ok: true, id }), true;
    }

    // The photo controls: the switch, and the bin. Deliberately as immediate
    // as every other button on that view — something on the projector that
    // should not be there is not a moment for a confirmation dialog.
    if (action === 'photosOn') {
      photos.setEnabled(body.on !== false);
      pushState(room);
      return sendJson(res, 200, { ok: true, enabled: photos.enabled }), true;
    }
    if (action === 'photoRemove') {
      const removed = photos.remove(String(body.id || ''));
      if (removed) pushState(room);
      return sendJson(res, 200, { ok: removed }), true;
    }
    // File everything that has not made it to the private repo yet. Used at
    // the end of a night, or after a spell where GitHub was unreachable.
    if (action === 'photosFile') {
      if (!photosRepoConfigured()) {
        return sendJson(res, 200, { ok: false, reason: 'no_repo' }), true;
      }
      const todo = photos.unfiled();
      let filed = 0;
      for (const photo of todo) {
        const result = await fileAway(room, photo);
        if (result.ok) filed++;
      }
      return sendJson(res, 200, { ok: true, filed, failed: todo.length - filed }), true;
    }
    /*
     * THE FUNNIEST PHOTOGRAPH, PUT TO THE ROOM — `src/photo-vote.js`.
     *
     * IT LIVES HERE RATHER THAN IN `session.run()` because the photographs
     * belong to the ROOM and neither engine has ever known they exist — the
     * same reason `photosOn` and `photoRemove` are up here. The ids are
     * resolved against the store and what goes into the game state is four
     * plain objects, so nothing downstream can reach a photograph it was not
     * handed.
     *
     * **THE IDS ARE VALIDATED AGAINST THE STORE, NEVER TRUSTED** — the
     * `packId` trap wearing a photograph. An id naming nothing is dropped by
     * `shortlist()` and the short list is then refused, which is the honest
     * answer rather than a vote with a hole in it.
     */
    if (action === 'photoVoteOpen') {
      const list = photos.shortlist(body.ids);
      const out = session.openPhotoVote(list);
      if (out.ok) pushState(room);
      return sendJson(res, out.ok ? 200 : 400, out), true;
    }
    if (action === 'photosClear') {
      const n = photos.clear();
      pushState(room);
      return sendJson(res, 200, { ok: true, cleared: n }), true;
    }

    /*
     * TWO DEVICES, ONE QUIZ — see `host-cursor.js`. A move that names the
     * cursor it was pressed against is refused when that cursor has already
     * moved on, with the FRESH view in the reply so the device repaints to
     * what the other one did. Only when `seen` is sent: every guard, every
     * fuzz and any older client that does not send it is untouched.
     */
    if (typeof body.seen === 'string' && HOST_MOVES.has(action)) {
      const now = hostCursor(session.hostView());
      if (body.seen !== now) {
        return sendJson(res, 409, { ok: false, stale: true, error: 'Already done on another device', view: session.hostView() }), true;
      }
    }
    const ok = session.run(action, body);
    if (ok === undefined) return sendJson(res, 404, { error: 'Unknown action: ' + action }), true;
    // A press the engine turned down, said out loud: "reveal refused:
    // not_a_question" on a night is exactly the line that explains a host
    // pressing a button that did nothing.
    if (ok === false || (ok && typeof ok === 'object' && ok.ok === false)) {
      flight.note('press', `${action} refused${ok && ok.reason ? `: ${ok.reason}` : ''}`, { room: room.id, level: 'warn' });
    }
    const view = session.hostView();
    // Start the track for an intro question, without making anybody wait for
    // it. The reply goes back first and the question is already on the
    // projector — see `startIntroTrack`.
    startIntroTrack(room, view);
    return sendJson(res, 200, { ok, view }), true;
  }

  return false;
}
