/**
 * GET ROUTES — library. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { CARD_SHAPES, FEATURES, LOOKS, MAX_OWN, PACK_PENCE, SCHEMES, artProvider, bookingOf, config, countOwn, defaultPrizes, fullLibrary, githubConfigured, googleConfigured, hub, leaguesByVenue, listAdvertPacks, listArchive, listOwn, maxLineStage, maxPrizes, mergeGigs, minimumTracks, missingGithubConfig, missingSpotifyConfig, openaiConfigured, packsRepoConfigured, packsRepoName, playedByVenue, recentTracks, reports, rewardsByVenue, rewardsUsed, rooms, shapeLabel, spotifyConfigured, stageLabel, stagePlan, suggestions, venueHeadcounts, venuesUsed } from './context.js';
import { sendJson } from './plumbing.js';
import { brandForRoom, fullLibraryTier, onlyTheirPacks, roomForHost, roomIdFor, schemeForRoom, whoIs, withShop } from './identity.js';
import { allowed, showsFor } from './gates.js';
import { backupStatus, ensureAdvertsRestored, ensureArchiveRestored, ensureInvoicesRestored, ensureOwnPacksRestored, markHidden, nowNext, seesTheirLeague, seesTheirNights, unbilledFor } from './helpers.js';

export async function getLibrary(req, res, url, route) {
  // ---- host-only reads
  if (route === '/api/quizzes') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const room = roomForHost(req, url);
    const seen = onlyTheirPacks(fullLibrary(config, room.id, listOwn(room.paths)), whoIs(req, url));
    return sendJson(res, 200, { quizzes: seen.quizzes, loaded: room.session.pack.id }), true;
  }
  // The console's library: every quiz and every bingo pack you have saved.
  /*
   * THE VENUE'S PHOTO OVERLAY, on its own so it never rides in a payload.
   *
   * One venue at a time, asked for by the card that is about to draw it — see
   * `hasOverlay` in the library payload for why it cannot travel with the
   * record.
   *
   * **IN `handleGet`, AND IT WAS WRITTEN INTO `handleWrite` FIRST.** GET and
   * HEAD are dispatched to this function and nothing else is, so a GET defined
   * beside the venue PUTs is dead code that reads as a feature — which is
   * exactly how the gallery publish route 404ed, in the other direction. The
   * dispatch is one `if` at the top of the request handler; read it before
   * putting a route anywhere.
   */
  if (route.startsWith('/api/invoices/customers/') && route.endsWith('/overlay')) {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const id = decodeURIComponent(route.slice('/api/invoices/customers/'.length, -'/overlay'.length));
    const customer = room.invoices.customers.find((c) => c.id === id);
    if (!customer) return sendJson(res, 404, { error: 'No such venue.' }), true;
    return sendJson(res, 200, { overlay: customer.overlay || '' }), true;
  }

  /*
   * IS TONIGHT READY — the facts only the server holds.
   *
   * The launch bar's ready line names three things a quizmaster checks at
   * seven o'clock with the room filling up: the server is answering, a
   * projector is open on THIS room, and the venue has prizes on it. The third
   * the console already knows; the first is this request coming back at all;
   * the second is here, because only the hub knows which streams are open.
   * Counted by ROOM, never overall — somebody else's projector is no comfort.
   *
   * Polled, so it is on `SUPPORT_QUIET`, and it carries nothing a phone could
   * not already see: counts, not names. It never gates anything — a light
   * that is wrong must not stop a night, so the console draws it and draws
   * nothing else off it.
   */
  if (route === '/api/host/ready') {
    if (!whoIs(req, url)) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const room = roomForHost(req, url);
    let screens = 0;
    let phones = 0;
    for (const c of hub.clients) {
      if (c.room !== room) continue;
      if (c.role === 'screen') screens += 1;
      else if (c.role === 'player') phones += 1;
    }
    return sendJson(res, 200, { screens, phones }), true;
  }

  if (route === '/api/library') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const libRoom = roomForHost(req, url);
    /*
     * THE INVOICE BOOK HAS TO BE BACK BEFORE THE VENUES ARE READ OFF IT.
     *
     * Rooms are made lazily and `data/` is empty after every deploy, so the
     * book only exists once it has been restored from the private repo — and
     * that used to be triggered by the invoice routes alone. The Venues tab
     * reads `venueRecords` out of this payload, so a console opened after a
     * deploy showed "no venues yet" until somebody happened to visit the
     * Invoices tab, at which point they reappeared. Somebody's venues looking
     * deleted is not a thing to leave to a lucky click.
     */
    //
    // Their own packs come back from the backup the first time they look, on a
    // host that wipes its disk every deploy. Awaited, because a library drawn
    // without them looks exactly like a library that has lost them. Their past
    // nights and their venue slides (the packs repository, under their own
    // room) for the same reason and by the same rule.
    //
    // ALL FOUR AT ONCE. They are four files in different repositories with
    // nothing between them, and awaited one after another the console after a
    // deploy waited four GitHub round trips — or, with GitHub gone quiet, four
    // deadlines in a row before it drew anything. `scripts/github-down.mjs`.
    const [, , , , backup] = await Promise.all([
      ensureInvoicesRestored(libRoom),
      ensureOwnPacksRestored(libRoom),
      ensureArchiveRestored(libRoom),
      ensureAdvertsRestored(libRoom),
      // And whether the backup works at all, which is its own round trip.
      backupStatus(),
    ]);
    const everything = fullLibrary(config, libRoom.id, listOwn(libRoom.paths, { imageDir: config.imageDir }));
    // The console sees the whole catalogue: theirs to play, the rest to buy.
    // Everything they do not hold comes back stripped — see withShop.
    const library = withShop(everything, whoIs(req, url));
    /*
     * How big the whole catalogue is, so the account page can say "3 of 20".
     *
     * Sent always and compared in the browser, rather than the server deciding
     * whether somebody is missing anything: the console already has its own
     * count, and one side working it out from two numbers cannot disagree with
     * the other about what those numbers are.
     */
    const catalogue = {
      // The CATALOGUE's size, so "3 of 7" counts what is for sale. Packs they
      // wrote themselves are not part of what a tier holds, so they are not
      // part of what a tier is measured against either.
      quizzes: (everything.quizzes || []).filter((p) => !p.mine).length,
      bingo: (everything.bingo || []).filter((p) => !p.mine).length,
      blurb: fullLibraryTier(whoIs(req, url)),
    };
    const { session } = roomForHost(req, url);
    const me = whoIs(req, url);
    /*
     * THE NIGHTS, READ ONCE.
     *
     * Three things in this payload are worked out from the archive — how many
     * nights there are, how many are unbilled, and the headcounts — and each
     * used to walk the whole folder and parse every night for itself. On a
     * quizmaster with two years of Thursdays that is three full reads of the
     * archive for one console load, and they must agree with each other
     * anyway, because a badge saying 40 above a panel that summarises 39 is a
     * page nobody trusts.
     */
    /*
     * WITH the leaderboards: the league is worked out here, on the server, and
     * only the finished table is sent. `/api/past-gigs` asks without them, so
     * the list of nights the Gigs tab draws stays the size it always was.
     */
    const gigNights = mergeGigs(listArchive(libRoom.paths.archive, { boards: true }), []);
    return sendJson(res, 200, {
      brand: brandForRoom(roomForHost(req, url)),
      appName: config.appName,
      scheme: schemeForRoom(roomForHost(req, url)),
      // What this account has chosen to look at. Cosmetic, and read ONLY by
      // the browser — nothing here decides what anybody is allowed to do.
      prefs: (me && me.prefs) || {},
      /*
       * AND WHAT A STRANGER WILL ACTUALLY SEE OF IT.
       *
       * `prefs` carries what was TYPED; this is what `bookingOf()` will put on
       * the public page, which is not the same thing — a link the server cannot
       * read is stored and then silently absent from a page the quizmaster is
       * not looking at. The account panel echoes this back, the way the intro
       * round's editor echoes the cue offset it understood.
       *
       * Sent from here rather than recomputed in the browser, so there is one
       * definition of what is publishable — a second copy in `console-*.js`
       * would be a rule that can disagree with the page it describes.
       */
      booking: bookingOf(me),
      // Every colour on offer, so the console can draw the picker without
      // keeping its own copy of the list and drifting from the stylesheet.
      schemes: SCHEMES,
      ...library,
      // How big the whole catalogue is, next to what this account can reach.
      // The account page says "3 of 20" from these two, and stays quiet when
      // they match.
      catalogue,
      // What one costs, so the shop card never keeps its own copy of the price
      // and cannot drift from what a purchase would actually charge.
      packPence: PACK_PENCE,
      /*
       * Their own library, and whether it survives a restart.
       *
       * Said out loud rather than left to be discovered, because on a host with
       * no permanent disk the difference between "backed up" and "here for now"
       * is the difference between a quiz they wrote and a quiz they wrote once.
       * Same shape as the invoice book's warning and there for the same reason.
       */
      ownPacks: {
        count: countOwn(libRoom.paths),
        max: MAX_OWN,
        backedUp: packsRepoConfigured(),
        repo: packsRepoName(),
      },
      adverts: listAdvertPacks(roomForHost(req, url).paths.adverts),
      // How many tracks each card size wants, straight from the rule itself so
      // the console can size a pasted list without keeping its own copy of the
      // sum and drifting from it.
      // The card shapes on offer, with what each needs, straight from the rules
      // themselves so the console keeps no copy of the sum to drift from.
      cardShapes: CARD_SHAPES.map((shape) => ({
        ...shape,
        label: shapeLabel(shape),
        minimum: minimumTracks(shape),
        // How many prizes this shape can carry, and what each of them is, so
        // the console can offer the right ones without doing the sums itself.
        maxPrizes: maxPrizes(shape),
        // And where it STARTS — a number per shape, not the maximum. See
        // `defaultPrizes()`: a 3x3 stopped four times before a full house is a
        // card that is over before the room has settled.
        prizes: defaultPrizes(shape),
        plans: Array.from({ length: maxPrizes(shape) }, (_, i) => stagePlan(i + 1).map(stageLabel)),
        // The most lines a line prize can ask for on this card before it is
        // the full house — the ceiling on the picker for which lines pay.
        maxLine: maxLineStage(shape),
      })),
      /*
       * Your room's code, whether or not a game is running.
       *
       * It used to ride on `running` only — so before a launch the console had
       * no idea which room it was, and every "Big screen" link fell back to the
       * HOUSE room's projector. A quizmaster opening the big screen five
       * minutes early, which is the documented routine, got somebody else's
       * game. The house room has no code and that is still correct for it.
       */
      joinCode: roomForHost(req, url).code,
      // Your own room, and only ever your own — Stop and Take control on this
      // panel must never reach somebody else's night.
      running: {
        room: roomIdFor(me),
        joinCode: roomForHost(req, url).code,
        game: session.kind,
        packId: session.pack.id,
        title: session.pack.title,
        /*
         * DID SOMEBODY PUT THIS UP, or is it just the pack the server loaded
         * at boot? A room always has a game built, so `title` alone said a
         * quiz was on the big screen from the moment the process started and
         * kept saying it after Unlaunch. See `freshState()` in engine.js.
         *
         * `!== false` rather than a truth test: a state written before the
         * field existed is on disk only because it WAS launched, so absent has
         * to read as launched or a redeploy mid-round tells the host the
         * projector is idle.
         */
        launched: session.engine.state.launched !== false,
        /*
         * WHERE tonight is, as the running night itself understands it.
         *
         * Read off the game state rather than off the console's own picker,
         * because those are two different questions — the picker says what the
         * next launch would use and this says what the night that is actually
         * up was launched with. The control view's advert picker uses it to
         * put this venue's slides at the top: standing in the Dog & Duck,
         * scrolling past the Sheep & Hound's pizza deal to find yours, mid-gig
         * and in the dark, is the friction it removes.
         */
        venue: session.engine.state?.venue || '',
        // What is on the projector and what is next — see `nowNext` above.
        onScreen: nowNext(session),
        phase: session.engine.state.phase,
        // Optional on an engine — a new game that has not written one still
        // shows up in the console, it just says less about itself.
        at: typeof session.engine.where === 'function' ? session.engine.where() : '',
        playerCount: session.engine.playerList().length,
        // The console offers to invoice for a night that has actually ended,
        // and only then — an invoice raised in the middle of round two is a
        // mis-tap, not a decision.
        finished: session.engine.state.phase === 'final' || Boolean(session.engine.state.finishedAt),
      },
      // What every OTHER room is doing, owner only. Not so it can be driven
      // from here — it cannot, and deliberately — but so the owner can see at a
      // glance that somebody is mid-question before deploying over them.
      otherRooms: me && me.role === 'owner'
        ? rooms.summaries().filter((r) => r.id !== roomIdFor(me))
        : [],
      /*
       * How many NIGHTS, for the Past gigs badge — not how many games.
       *
       * A quiz and the bingo after it are one evening's work, so counting games
       * puts a 5 on the tab above a list of four rows. Worked out here, with
       * the same roll-over the page itself uses, rather than in the browser
       * from a list it would have to group a second way.
       */
      archiveNights: gigNights.length,
      /*
       * NIGHTS YOU HAVE RUN AND NOT BILLED — money left on the table.
       *
       * Worked out on the SERVER because it is the only side holding both
       * halves: the archive knows the nights and the invoice book knows the
       * invoices, and until now the two never spoke. Sent as a count rather
       * than a list, because the Gigs tab marks the rows itself and a number
       * is all anything else needs.
       *
       * Only when they actually hold invoicing — a quizmaster who does not
       * bill through the app has no unbilled nights, only nights.
       */
      unbilled: unbilledFor(libRoom, req, url, gigNights),
      /*
       * HOW MANY PLAYED AT EACH VENUE, and which way it is going.
       *
       * *"The Crown went from 22 to 58"* — the evidence that wins the next
       * booking and saves a residency in January. Nothing new is collected:
       * this is the count the archive has written down since the app was
       * written, added up per venue for the first time.
       *
       * ONE record, read by BOTH tabs. The Venues tab opens a place and shows
       * its own history; the Gigs tab shows every venue at once. Sent rather
       * than fetched separately so the two cannot disagree, and so a venue
       * card draws its numbers with no second request.
       *
       * Only for somebody who holds Past gigs — this is their record of what
       * they have run, read from the same archive that page is built from.
       */
      headcounts: seesTheirNights(req, url)
        ? venueHeadcounts(gigNights)
        : { venues: [], unplaced: 0 },
      /*
       * WHAT EACH VENUE HAS ALREADY HEARD — the last time it got each pack.
       *
       * Off the SAME `gigNights` the headcounts are, so the two cannot
       * disagree about which nights happened or where. It rides with the
       * library rather than being fetched when a venue is picked, because
       * the shelf re-ranks on every venue change and a fetch per change is a
       * spinner on the one panel that has to feel instant.
       *
       * Small: one timestamp per pack per venue actually played, so a busy
       * year of one residency is a few dozen numbers.
       */
      playedByVenue: seesTheirNights(req, url) ? playedByVenue(gigNights) : {},
      /*
       * THE QUIZ LEAGUE, per venue — who keeps coming back and who is winning
       * the season. Same record, same gate and the same reason as the
       * headcounts above: sent with the library so a venue card draws its
       * table with no second request, and so one calculation feeds every
       * place that shows it.
       *
       * The TABLE only. The leaderboards it was built from stay on the server.
       */
      /*
       * THE CONSOLE SEES THE REAL NAMES — it is the room's own view, and the
       * quizmaster was there. What it also gets is `nameHidden` per row, so
       * the table can say which names will not go on a public page without
       * the console having to run the filter itself and reach a different
       * answer from the server. One filter, asked once.
       */
      leagues: seesTheirLeague(req, url) ? markHidden(leaguesByVenue(gigNights)) : {},
      /*
       * Venues this room has played before, so the launch box offers them back
       * rather than asking for the same six words every week. A field you
       * retype gets left blank by the third week, and then the record is
       * holes — which is the whole point of having it.
       */
      venues: venuesUsed(roomForHost(req, url).paths.archive),
      // And what was given away, offered back the same way — plus what each
      // VENUE puts up, because the venue buys the prize.
      rewards: rewardsUsed(roomForHost(req, url).paths.archive),
      venueRewards: rewardsByVenue(roomForHost(req, url).paths.archive),
      // Offered on every pack card, so a night can be dressed up without
      // editing anything.
      looks: LOOKS.map(({ id, label, blurb, season }) => ({ id, label, blurb, season })),
      // Just the totals, so the Invoices tab can wear a badge saying how many
      // are still unpaid. The invoices themselves are never in this payload.
      invoicing: roomForHost(req, url).invoices.summary(),
      /*
       * THE VENUES, which are the invoice book's customers.
       *
       * One record rather than a second list: that book's own comment already
       * calls them "the venues you work for", and it holds the name, the
       * contact, the address and the usual fee. A separate venue store would
       * have to be reconciled with it forever.
       *
       * Only what a launch needs — the name and what they put up. The address,
       * the email and the fee stay on the Invoices side, because a pack card
       * has no business carrying somebody's postal address.
       */
      venueRecords: roomForHost(req, url).invoices.customers
        .map((c) => ({
          id: c.id,
          name: c.name,
          rewards: Array.isArray(c.rewards) ? c.rewards : [],
          // Which night they have you, so the console can work out whose night
          // tonight is without a second request — see `tonightsVenue()`.
          usualNight: c.usualNight || '',
          // Where the last slide of the night sends the room, drawn as a QR on
          // the projector. Here so the Venues tab can edit it; the launch
          // resolves it server-side and the browser never has to.
          link: c.link || '',
          /*
           * Their logo, so the Venues tab can show what is set and offer to
           * change it. It is capped at 64KB by `cleanLogo` on the way in,
           * which is what makes carrying it in this payload affordable — and
           * why it goes no further than the console: the winner's phone gets
           * it inside the voucher and the PROJECTOR never gets it at all, or
           * it would ride in every state push at a lobby.
           */
          logo: c.logo || '',
          /*
           * WHETHER there is a photo overlay, never the overlay itself.
           *
           * It is up to 512KB against the logo's 64, and this record rides in
           * every console payload — the logo's own note in `invoices.js` says
           * that is exactly what makes a full-size image unaffordable here. So
           * the Venues tab learns there is one from a boolean and fetches the
           * picture from `/api/invoices/customers/<id>/overlay` only when it
           * actually draws it.
           */
          hasOverlay: Boolean(c.overlay),
        })),
      /*
       * The diary's exceptions: one-offs and nights off.
       *
       * The RECURRING half is not sent because it is not stored — it comes out
       * of the usual nights above, projected forward in the browser. That is
       * the whole point of the design: a residency needs nothing typed and
       * nothing kept, so there is nothing here to go stale.
       */
      bookings: roomForHost(req, url).invoices.bookings,
      /*
       * THE NIGHTS THEY HAVE BUILT IN ADVANCE — see `src/shows.js`.
       *
       * In the library payload rather than behind a route of its own because
       * the console draws them on the same page as everything else here, and a
       * second fetch on the tab a gig starts from is a second thing that can
       * be slow on pub wifi. They are small: a show is references and
       * settings, never a question or a track.
       */
      shows: showsFor(roomForHost(req, url)),
      /*
       * Enough to draw "Ask for a pack" BEFORE somebody types into it: whether
       * they may, where they are in the queue, and which Monday it lands on.
       * Being refused after writing three sentences is the version that
       * annoys; being told the deal up front is the version somebody plans
       * around.
       */
      packRequest: me ? suggestions.packRequestStatus(me.id || '') : null,
      // Only a count here. The reports themselves are owner-only and come from
      // their own route.
      reports: me && me.role === 'owner' ? reports.summary() : { open: 0, total: 0 },
      generation: {
        claude: Boolean(process.env.ANTHROPIC_API_KEY),
        // `art` is the one that decides whether a button works; the two named
        // flags are only so a warning can say WHICH key is missing.
        art: artProvider(),
        openai: openaiConfigured(),
        google: googleConfigured(),
        spotify: spotifyConfigured(),
        spotifyMissing: missingSpotifyConfig(),
        recentCount: recentTracks(config.dataDir, 3).length,
        backup: backup.ok,
        backupConfigured: githubConfigured(),
        backupError: backup.ok ? null : backup.error,
        backupRepo: backup.repo || null,
        backupMissing: missingGithubConfig(),
      },
    }), true;
  }
  return false;
}
