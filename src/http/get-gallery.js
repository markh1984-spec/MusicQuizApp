/**
 * GET ROUTES — gallery. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { COVER_PHOTOS, FEATURES, HOUSE, accounts, bookingOf, comeBackText, coverPhotos, galleryNumbers, galleryPhotosOf, isNightFolder, isPublished, leaguesByVenue, leaguesRunning, listArchive, listDirs, mergeGigs, nameDecisions, nextNightAt, photoDecisions, photoFolder, photoKey, photoPins, photosRepoConfigured, publicTable, publishedNights, publishedVenues, readableNight, rooms, safePhotoName, sameVenueSlug, showsOnGallery, teamKey, venueSlug } from './context.js';
import { sendJson } from './plumbing.js';
import { galleryRoomFor, galleryRoomFrom, nightFiles, photoBytes, roomForHost, whoIs, whoseRoom } from './identity.js';
import { allowed } from './gates.js';
import { ensureArchiveRestored } from './helpers.js';

export async function getGallery(req, res, url, route) {
  /*
   * A PUBLIC GALLERY PER QUIZMASTER, NOT ONLY THE OWNER'S OWN.
   *
   * This started as Mark's own tool — `/gallery` with no parameter always
   * meant HIS room — and every function in `src/gallery.js` was already
   * written generically, taking a `roomId`, so the single-tenant behaviour
   * was purely this one hardcoded lookup. `?q=<accountId>` asks for a
   * SPECIFIC quizmaster's gallery instead; account ids are not secret (the
   * referral link already puts one in a public URL — see `/signup?ref=`),
   * and an id that names nothing simply resolves to an empty room with no
   * published nights, never a crash or a 404 that would let somebody probe
   * which ids are real.
   *
   * `/gallery` with NO `?q=` is UNCHANGED — Mark's existing bookmark and any
   * marketing link he has already handed out keeps working exactly as it
   * always has.
   */
  /*
   * TWO VALUES, DELIBERATELY. `galleryAsked` is *was a gallery named*, which is
   * what stands the owner's preview shortcut down (see `galleryPreview()`);
   * `galleryTarget` is *which room that resolves to*. Folding them into one
   * would mean `?q=` naming nothing quietly handed the owner shortcut back.
   */
  const galleryAsked = String(url.searchParams.get('q') || '').trim();
  const galleryTarget = galleryRoomFrom(galleryAsked);
  const galleryRoomId = () => {
    if (galleryTarget) return galleryTarget;
    const owner = accounts.owner;
    const mine = owner ? accounts.ownQuizmasterFor(owner.id) : null;
    return mine ? mine.id : HOUSE;
  };

  /*
   * THE OWNER SEES IT FIRST, ON EITHER HAT — but ONLY ON THEIR OWN GALLERY.
   *
   * One login holds two identities, and which one is worn should not decide
   * whether the preview works on MARK'S OWN gallery — checking the room
   * alone would hide it the moment he switched to the owner hat, on the page
   * he is checking BECAUSE he is the owner. The host key counts for the same
   * reason.
   *
   * **THAT SHORTCUT MUST NOT SURVIVE `?q=`.** Once this page can show any
   * quizmaster's gallery, letting the owner-check apply everywhere would
   * mean the owner previewing EVERY subscriber's unpublished, private
   * photos with nothing consented and nothing logged — precisely the
   * cross-room read the own-packs guarantee refuses elsewhere in this app.
   * So the owner shortcut applies only when nobody asked for anybody else's
   * gallery; asking by id always falls through to the one real rule —
   * "you see the drafts on a room you are actually signed in as."
   */
  const galleryPreview = () => {
    /*
     * `?as=visitor` STANDS THE PREVIEW DOWN — asked for as *"needs to display
     * these photos without signing in otherwise there's no point in it being
     * published at all."*
     *
     * The preview is what makes checking a night before strangers see it
     * possible, and it is also why a quizmaster CANNOT check: their laptop
     * carries the console's cookie, so the page they look at is never the page
     * their customers get. Signing out to find out is a bad answer, and a
     * private window is one nobody thinks of at eleven at night.
     *
     * **IT CAN ONLY EVER TAKE ACCESS AWAY, WHICH IS WHAT MAKES IT SAFE.** It
     * is the first line rather than the last so nothing below can hand it back,
     * and there is no parameter anywhere in this app that adds a permission —
     * see `/api/host/*` and the gallery's own publish route. A stranger typing
     * it gets what they already had.
     *
     * **ON THE SERVER, SO IT IS THE REAL ANSWER.** Filtering the drafts out in
     * the browser would prove the page can hide them, not that the server
     * refuses them — and refusing them is the thing being checked.
     */
    if (url.searchParams.get('as') === 'visitor') return false;
    const who = whoIs(req, url);
    if (!who) return false;
    if (!galleryAsked && (who.role === 'owner' || who.bootstrap)) return true;
    return roomForHost(req, url).id === galleryRoomId();
  };

  /*
   * WHAT THE PUBLIC LEAGUE PAGE IS ALLOWED TO SAY.
   *
   * Every published venue's table for one quizmaster, plus when they are next
   * on. It reuses `galleryRoomId()` and `galleryPreview()` deliberately: the
   * two pages ask the identical question — *whose room, and may I see the
   * drafts* — and a second answer to it is a second thing that can be got
   * wrong, including the trap those functions already record about `?q=` and
   * the owner shortcut.
   *
   * **THE TABLE IS REBUILT HERE RATHER THAN READ OFF THE LIBRARY PAYLOAD**,
   * because a visitor has no account and gets no library. Same function, same
   * archive — `leaguesByVenue()`, exactly as the console's own copy — so the
   * public page and the quizmaster's cannot disagree about who is winning.
   *
   * **AND IT SENDS NAMES, NOT FACES.** `leagueTable()` carries a `faceKey`
   * per team for the console to draw; the fields are listed by name on the
   * way out rather than spread, which is the whitelist rule the engine's own
   * views follow — a spread quietly opts every future field in, and the next
   * one might be a photograph.
   */
  /*
   * WHICH OF MY TABLES ARE UP — asked when the league tab is OPENED, never
   * with the library.
   *
   * This is a GitHub round trip and the library payload is fetched on every
   * console render, including the ones a phone joining a lobby causes; putting
   * it there would spend a network call per push on a fact that changes twice
   * a season. Same rule as a night's photos — fetched when the thing is
   * opened, not up front.
   *
   * **IT IS A GET, SO IT LIVES UP HERE WITH THE OTHER GETs.** It was written
   * beside its own POST first and 404ed, because that half of the file only
   * ever runs for POST — the identical trap the gallery's publish route
   * records, found the same way: by calling it rather than by reading it.
   */
  if (route === '/api/league/published') {
    if (!allowed(req, res, url, FEATURES.LEAGUE)) return true;
    // `galleryRoomFor`, MATCHING THE WRITES — a read and a write that disagree
    // about the room is how the console came to say "not published" about a
    // table it had just published. One function, asked by both sides.
    const lgId = galleryRoomFor(req, url);
    // Both halves of one decision file, in the one round trip it costs.
    return sendJson(res, 200, {
      venues: await publishedVenues(lgId),
      names: await nameDecisions(lgId),
      // WHICH VENUES ACTUALLY RUN A LEAGUE — the third half of one decision
      // file, in the one round trip it already costs.
      running: await leaguesRunning(lgId),
    }), true;
  }

  if (route === '/api/league') {
    const roomId = galleryRoomId();
    const preview = galleryPreview();
    const leagueRoom = rooms.get(roomId);
    await ensureArchiveRestored(leagueRoom);
    const live = await publishedVenues(roomId);
    /*
     * A VENUE THAT DOES NOT RUN A LEAGUE HAS NO PAGE, whatever else is set —
     * *"it might be misleading if this app just had that as standard even in
     * venues that don't have a quiz league."* The table is arithmetic and can
     * always be worked out; a league is a thing somebody runs.
     *
     * It gates the PREVIEW as well, deliberately: the whole point of the owner
     * preview is seeing what a team will see, so a preview that showed a venue
     * the public page never will would be worse than no preview.
     */
    const runs = await leaguesRunning(roomId);
    // The quizmaster's own rulings, which overrule the word list either way.
    const ruled = await nameDecisions(roomId);
    const nights = mergeGigs(listArchive(leagueRoom.paths.archive, { boards: true }), []);
    const byVenue = leaguesByVenue(nights);
    const book = leagueRoom.invoices;
    /*
     * ONE VENUE, WHEN THE PAGE CAME IN ON ITS OWN ADDRESS. Derived from the
     * name rather than looked up, so there is no second record to keep in
     * step — see `public/assets/slugs.js`. A slug that matches nothing returns an empty
     * list, which is the same answer an unpublished venue gives: one refusal
     * for every miss, so nobody can map which pubs exist by trying names.
     */
    const wantVenue = String(url.searchParams.get('venue') || '').trim().toLowerCase();
    const out = [];
    for (const [key, league] of Object.entries(byVenue)) {
      // One pub is one page whichever of its spellings is in the address —
      // `sameVenueSlug()`, the same fold the gallery index uses below.
      if (wantVenue && !sameVenueSlug(venueSlug(league.venue), wantVenue)) continue;
      if (!runs.includes(key)) continue;
      const published = live.includes(key);
      if (!published && !preview) continue;
      /*
       * WHEN THEY ARE NEXT ON — the host's own choice for what a team wants
       * off this page over their own faces, and it writes itself: the venue's
       * usual night through `upcoming()`, the same derivation the projector's
       * comeback slide uses. Silent when there is nothing true to say, which
       * is the rule that slide already follows.
       */
      const next = nextNightAt({
        venue: league.venue, venues: book.customers, bookings: book.bookings, now: Date.now(),
      });
      out.push({
        venue: league.venue,
        nights: league.nights,
        next: next ? comeBackText(next.date).replace(/^Back here /, 'Next quiz ') : '',
        /*
         * NAMES FILTERED ON THE WAY OUT — `clean-names.js`. A rude name goes
         * on the projector as typed and always will; this is the door, not
         * the room. Applied HERE rather than in the browser so a name that
         * cannot be published never leaves the server at all — a filter that
         * ships the word and hides it with CSS is not a filter, which is the
         * same reasoning the two-screens rule is built on.
         */
        // Named fields, never a spread — see the note above.
        table: publicTable(league.table, ruled, teamKey).map((t) => ({
          position: t.position, name: t.name, played: t.played, counted: t.counted,
          wins: t.wins, points: t.points,
        })),
        ...(published ? {} : { preview: true }),
      });
    }
    // Alphabetical, so a quizmaster with four pubs gets a stable page rather
    // than one that reshuffles with whichever venue was played last.
    out.sort((a, b) => a.venue.localeCompare(b.venue));
    // No name in here: the page already asks `/api/brand?q=` for it, which is
    // the one place that answer is worked out. Two sources for one string is
    // how a heading and a title come to disagree.
    return sendJson(res, 200, { leagues: out, preview }), true;
  }

  if (route === '/api/gallery') {
    const preview = galleryPreview();
    const live = await publishedNights(galleryRoomId());
    /*
     * ONE VENUE'S NIGHTS, when the page came in on its own address.
     *
     * The photo repository is foldered by DATE alone — a deliberate choice
     * recorded in `mergeGigs()`, because every route that addresses a night
     * addresses it by its date — so which venue a night belongs to lives in
     * the archive, and this is the join. Only read when a slug was asked for,
     * so the plain `/gallery` costs exactly what it always did.
     */
    const wantVenue = String(url.searchParams.get('venue') || '').trim().toLowerCase();
    /*
     * THE VENUE OF EVERY NIGHT, NOT ONLY WHEN ONE WAS ASKED FOR.
     *
     * This read used to be conditional on `?venue=`, so the plain `/gallery`
     * cost nothing. It is unconditional now because the page GROUPS by pub and
     * names it on every card — *"grouped by pub, newest first"* — so there is
     * no version of this page that does not need the join. It is a local
     * archive read; the one network call in it is the restore, which the
     * console makes on every load anyway.
     */
    const listRoom = rooms.get(galleryRoomId());
    await ensureArchiveRestored(listRoom);
    const venueOfNight = new Map(mergeGigs(listArchive(listRoom.paths.archive), [])
      .map((g) => [g.night, g.venue || '']));
    const atVenue = wantVenue
      ? new Set([...venueOfNight]
        // `sameVenueSlug()` rather than `===`: one pub filed under two
        // spellings had two addresses and each showed only its own half.
        .filter(([, v]) => sameVenueSlug(venueSlug(v), wantVenue)).map(([n]) => n))
      : null;
    const nights = preview
      ? [...new Set([...live, ...(await listDirs(photoFolder(galleryRoomId()), 'photos')).map((f) => f.name).filter(isNightFolder)])]
        .sort().reverse()
      : live;
    const out = [];
    /*
     * THE RULINGS, ONCE FOR THE WHOLE LIST — the same read the night's own
     * page makes below, and it has to be the same QUESTION as well.
     *
     * This counted with `isCameraFile()` alone while the page filtered with
     * `showsOnGallery()`, so the comment underneath — "see the matching filter
     * below" — described a filter that did not match. Switching one photo off
     * by hand left the list saying "12 photos" over a page that opened on 11,
     * and switching every one of them off left a night in the list whose page
     * was the blank space the `if (count)` underneath exists to prevent.
     *
     * That is the drift `showsOnGallery()` was written to make impossible, and
     * it survived because this reader asks a cheaper question one line away
     * from the right one.
     */
    const saidHere = await photoDecisions(galleryRoomId());
    // The pins ride in on the same read as the rulings — one file, one fetch.
    const pinsHere = await photoPins(galleryRoomId());
    /*
     * TOGETHER, NOT ONE AFTER ANOTHER. This loop `await`ed each night's folder
     * listing before starting the next, so a season on the shelf was twenty-one
     * round trips end to end — measured at 3.3 seconds for a page whose whole
     * job is to be the way in.
     */
    const wanted = nights.filter((n) => !atVenue || atVenue.has(n));
    const listings = new Map(await Promise.all(wanted.map(async (n) =>
      [n, await nightFiles(`${photoFolder(galleryRoomId())}/${n}`)])));
    for (const night of wanted) {
      const files = listings.get(night);
      // Only what would actually SHOW once this night is opened — the same
      // one decision, asked the same way. A count that included the ones held
      // back would read "6 photos" over a page that opens on 4.
      const shown = galleryPhotosOf(
        (files || []).map((f) => safePhotoName(f.name)).filter(Boolean),
        night, saidHere, photoKey,
      );
      // A published night with nothing in it is a heading over a blank space.
      if (shown.length) {
        out.push({
          night,
          when: readableNight(night),
          venue: venueOfNight.get(night) || '',
          count: shown.length,
          live: live.includes(night),
          /*
           * THE FEW ON THE CARD, off the SAME filtered list the count is taken
           * from — so a photograph held back cannot appear on the card that
           * advertises the night, pinned or not. `coverPhotos()` puts the
           * human's pins first and spreads the rest across the evening.
           */
          cover: coverPhotos(shown, night, pinsHere[night] || [], COVER_PHOTOS)
            .map((name) => `/gallery-photo/${night}/${encodeURIComponent(name)}`),
        });
      }
    }
    return sendJson(res, 200, { nights: out, preview }), true;
  }

  /*
   * THE NUMBERS AND THE BOOKING LINE — the other two thirds of the public page.
   * The arithmetic and the reasoning are in `src/gallery-about.js`; the two
   * gates are here, because they are about what may be PUBLISHED rather than
   * about sums.
   *
   * **ITS OWN ROUTE RATHER THAN A FIELD ON `/api/brand`.** That endpoint is on
   * the protected surface — the projector and every phone fetch it — and this
   * costs an archive read. One page wants it; four do not.
   *
   * **AND ITS OWN PREFIX, `-about` rather than `/about`.** Under
   * `/api/gallery/` it would have been read as a night called "about" and
   * answered the generic "Nothing here." — a 404 indistinguishable from a
   * working route refusing a bad date, which is the prefix trap the publish
   * route above already records.
   */
  if (route === '/api/gallery-about') {
    const roomId = galleryRoomId();
    const preview = galleryPreview();
    /*
     * THEIR OWN WORDS ARE NOT GATED ON A PUBLISHED NIGHT, and the numbers are.
     *
     * Two rules, each obvious on its own: what the APP worked out about
     * somebody's nights needs a night they chose to make public; what they
     * TYPED needs only them having typed it — they wrote it in order to be
     * read, and a quizmaster who wants to hand the link out before their first
     * photographs go up should be able to.
     */
    const book = bookingOf(whoseRoom(rooms.get(roomId)));
    const live = await publishedNights(roomId);
    const wantVenue = String(url.searchParams.get('venue') || '').trim().toLowerCase();
    let numbers = null;
    if (live.length || preview) {
      const aboutRoom = rooms.get(roomId);
      // Before the archive is read, like every other reader of it — on the
      // free tier `data/` is empty after every deploy, and a page built from
      // it would swear nobody had ever played.
      await ensureArchiveRestored(aboutRoom);
      const nights = mergeGigs(listArchive(aboutRoom.paths.archive), []);
      /*
       * A PUB'S OWN NUMBERS NEED A PUBLISHED NIGHT AT THAT PUB.
       *
       * Without this, typing `/some-pub/gallery` would confirm that this
       * quizmaster works there, with a headcount — and the venue name is the
       * one thing on this page that is somebody ELSE'S business. The index
       * only ever names pubs that already have a night up, so this is the same
       * question that page already answers, asked before any arithmetic.
       *
       * `sameVenueSlug()` rather than `===`: one pub filed under two spellings
       * has two addresses and both are legitimate — see `slugs.js`.
       */
      if (!wantVenue) numbers = galleryNumbers(nights);
      else if (nights.some((n) => (preview || live.includes(n.night))
        && n.venue && sameVenueSlug(venueSlug(n.venue), wantVenue))) {
        numbers = galleryNumbers(nights, { venue: wantVenue });
      }
    }
    // Absent rather than null when there is nothing true to say, so the page
    // can draw nothing without asking twice what an empty object means.
    return sendJson(res, 200, {
      ...(numbers ? { numbers } : {}),
      ...(book ? { book } : {}),
    }), true;
  }

  if (route.startsWith('/api/gallery/')) {
    const night = decodeURIComponent(route.slice('/api/gallery/'.length));
    /*
     * ONE 404 FOR EVERY REFUSAL — not a night, not published, or nothing
     * there all answer the same way, exactly as `/api/voucher` does. Three
     * different messages would let anybody map which dates exist.
     */
    const preview = galleryPreview();
    if (!isNightFolder(night) || !(preview || await isPublished(galleryRoomId(), night))) {
      return sendJson(res, 404, { error: 'Nothing here.' }), true;
    }
    const files = await nightFiles(`${photoFolder(galleryRoomId())}/${night}`);
    const said = await photoDecisions(galleryRoomId());
    /*
     * WHICH PUB THIS WAS, AND WHAT IS EITHER SIDE OF IT AT THE SAME PUB.
     *
     * Asked for on 31 August 2026: *"the galleries should have navigation so
     * you can get to a previous one or a new one on a per-venue, per-QM
     * basis… each gallery should say which QM it's for as well as which room,
     * so scrolling through the galleries should be for the same room."*
     *
     * **THE QUIZMASTER WAS ALREADY THERE and the venue was not** — the page's
     * own header carries the name from `/api/brand`, so this adds the half
     * that was missing rather than both.
     *
     * The photo repository is foldered by DATE alone — the deliberate choice
     * `mergeGigs()` records — so the venue lives in the archive and this is
     * the join, the same one the night LIST makes for `?venue=`. Read here
     * unconditionally because a single night's page needs it either way; the
     * list keeps its conditional read and still costs what it always did.
     *
     * **A NIGHT WITH NO VENUE FALLS BACK TO EVERY NIGHT rather than to
     * none.** Nights filed before venues existed have no pub on them, and
     * navigation that silently disappears on those is worse than navigation
     * that is merely broader than it promised.
     */
    const gRoom = rooms.get(galleryRoomId());
    await ensureArchiveRestored(gRoom);
    const venueOf = new Map(mergeGigs(listArchive(gRoom.paths.archive), [])
      .map((n) => [n.night, n.venue || '']));
    const venue = venueOf.get(night) || '';
    const visible = preview
      ? [...new Set([...(await publishedNights(galleryRoomId())),
        ...(await listDirs(photoFolder(galleryRoomId()), 'photos')).map((f) => f.name).filter(isNightFolder)])]
      : await publishedNights(galleryRoomId());
    const run = visible
      /*
       * AND STEPPING TO THE NIGHT EITHER SIDE ASKS THE SAME QUESTION. This
       * compared the venue STRINGS, so a run of nights at one pub split into
       * two runs the moment its name was typed differently — the arrows would
       * skip a night that is plainly at the same pub, or stop early.
       */
      .filter((n) => (venue ? sameVenueSlug(venueSlug(venueOf.get(n) || ''), venueSlug(venue)) : true))
      .sort().reverse();
    const at = run.indexOf(night);
    // Newest first, so the one BEFORE this in the list is the more recent one.
    const step = (i) => (i >= 0 && i < run.length && run[i] !== night
      ? { night: run[i], when: readableNight(run[i]) } : null);
    return sendJson(res, 200, {
      night,
      when: readableNight(night),
      venue,
      newer: at > -1 ? step(at - 1) : null,
      older: at > -1 ? step(at + 1) : null,
      live: await isPublished(galleryRoomId(), night),
      preview,
      /*
       * ONLY WHAT LOOKED LIKE A CAMERA TOOK IT — asked for directly: a
       * photo picked from the gallery "for a laugh" is fine on the big
       * screen that night, and stays there, but does not belong on the
       * public page shown to a venue afterward. `isCameraFile()` reads the
       * one marker `add()` in photos.js ever wrote — see its own note for
       * why that is a filename rather than a second file to keep in step.
       */
      // THE FILENAME'S GUESS, UNLESS A HUMAN HAS SAID OTHERWISE — the same
      // call the count above makes, so a night cannot advertise a number its
      // own page disagrees with. The single-photo route below and the
      // console's pill ask the same one decision underneath it.
      photos: galleryPhotosOf(
        (files || []).map((f) => safePhotoName(f.name)).filter(Boolean),
        night, said, photoKey,
      ).map((name) => ({ name, url: `/gallery-photo/${night}/${encodeURIComponent(name)}` })),
    }), true;
  }

  /*
   * One photo, proxied. The repo is private, so a direct link is a 404 in
   * anybody's browser — and the published check is repeated HERE rather than
   * trusted from the listing, because a URL can be typed. `isCameraFile` is
   * repeated for the same reason: the listing already leaves a non-camera
   * photo off the page, but its name was on the projector all night and this
   * route must refuse it too, not just decline to advertise it.
   */
  if (route.startsWith('/gallery-photo/')) {
    const parts = route.slice('/gallery-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    /*
     * `isNightFolder` IS A PATH GUARD HERE, and it was the only route without
     * it — every sibling has one. `safePhotoName()` cleans the FILENAME and
     * nothing cleaned the night, `getFile()` encodes with `encodeURI()` which
     * leaves `/` and `.` alone, and GitHub's Contents API resolves `..` and
     * serves the traversed file with a 200. So `night` was a way OUT of this
     * room's photo folder and into another quizmaster's unpublished
     * photographs — and `galleryPreview()` short-circuits the `isPublished()`
     * call that had been doing the validating by accident, so anybody signed in
     * got there. Filenames are deterministic, so a night is enumerable.
     */
    if (parts.length !== 2 || !name || !isNightFolder(night)
      || !(galleryPreview() || await isPublished(galleryRoomId(), night))) {
      return sendJson(res, 404, { error: 'Nothing here.' }), true;
    }
    // RE-CHECKED HERE rather than trusted from the listing, because a URL can
    // be typed and this photo's name was on the projector all night.
    if (!showsOnGallery(name, (await photoDecisions(galleryRoomId()))[photoKey(night, name)])) {
      return sendJson(res, 404, { error: 'Nothing here.' }), true;
    }
    /*
     * THE GATE IS ASKED FIRST AND EVERY TIME; ONLY THE BYTES ARE CACHED.
     * Both checks above ran against `published.json`, so a photograph taken
     * down is refused here whether or not its bytes are still in hand.
     */
    const bytes = await photoBytes(`${photoFolder(galleryRoomId())}/${night}/${name}`);
    if (!bytes) return sendJson(res, 404, { error: 'Nothing here.' }), true;
    res.writeHead(200, {
      'Content-Type': name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
      'Content-Length': bytes.length,
      /*
       * A filed photo is written once and never rewritten, so a page of forty
       * should not fetch forty every time somebody opens it. `immutable` says
       * so outright: within the window a browser does not even revalidate.
       *
       * **THE WINDOW IS NOT LENGTHENED, DELIBERATELY.** A year would be
       * correct for content that never changes and wrong for this one: taking
       * a photograph down is a promise this app makes — *"somebody will want
       * their photo gone"* — and a cache is the one place it cannot reach. A
       * day is the existing trade and it stays.
       */
      'Cache-Control': 'public, max-age=86400, immutable',
      // NOT in a search result. Being findable on Google is speculative
      // marketing value; a stranger's face turning up in a search is a
      // concrete cost, and it lands on the player rather than the business.
      'X-Robots-Tag': 'noindex, noimageindex',
    });
    return res.end(bytes), true;
  }

  if (route.startsWith('/past-photo/')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const parts = route.slice('/past-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (!isNightFolder(night) || !name || parts.length !== 2) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    const bytes = photosRepoConfigured()
      ? await photoBytes(`${photoFolder(galleryRoomFor(req, url))}/${night}/${name}`)
      : null;
    if (!bytes) return sendJson(res, 404, { error: 'No photo there.' }), true;
    res.writeHead(200, {
      'Content-Type': name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
      'Content-Length': bytes.length,
      // A filed photo all but never changes — a quarter turn is the one edit
      // it takes — so a page of forty of them should not fetch forty every
      // time it opens. The console busts its own copy after a turn.
      'Cache-Control': 'private, max-age=86400',
    });
    return res.end(bytes), true;
  }
  return false;
}
