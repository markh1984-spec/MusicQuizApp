/**
 * GET ROUTES — past-gigs. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { COVER_PHOTOS, FEATURES, MAX_PINS, coverPhotos, isNightFolder, isPublished, leagueAfter, listAdvertPacks, listArchive, listDirs, mergeGigs, nameDecisions, nightHeadcount, nightReportFilename, nightReportPdf, photoDecisions, photoFolder, photoKey, photoPins, photosRepoConfigured, publicName, publicTable, publishedNights, safePhotoName, sameVenue, showsOnGallery, teamKey, totals, photoFlags, flagKey } from './context.js';
import { send, sendJson } from './plumbing.js';
import { galleryRoomFor, gigRoomsFor, nightFiles } from './identity.js';
import { allowed } from './gates.js';
import { billsThroughTheApp, ensureArchiveRestored, ensureInvoicesRestored, leagueRunsAt, seesTheirLeague } from './helpers.js';

export async function getPastGigs(req, res, url, route) {
  /*
   * PAST GIGS — the nights, the packs and the pictures, in one list.
   *
   * Two records joined up: the archive on disk (what was played, by how many,
   * who won) and the photo repository (what the room sent). The photos are read
   * from the REPO rather than from `data/photos/`, because that folder is wiped
   * on every deploy — a page built from it would show tonight and swear nothing
   * else had ever happened.
   *
   * Which room's gigs these are comes from WHO YOU ARE, like every other host
   * route. There is no night, id or folder anybody can send that reaches
   * another quizmaster's history.
   */
  if (route === '/api/past-gigs') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const gigRooms = gigRoomsFor(req, url);
    const gigRoom = gigRooms[0];
    // Both, when there are two — see `gigRoomsFor()`. The backup has to be
    // back before either archive is read, or a night reads as unfiled.
    for (const room of gigRooms) await ensureArchiveRestored(room);
    // The gallery's room, like every other photo read — see `galleryRoomFor()`.
    const folders = photosRepoConfigured()
      ? await listDirs(photoFolder(galleryRoomFor(req, url)), 'photos')
      : [];
    const nights = mergeGigs(
      gigRooms.flatMap((room) => listArchive(room.paths.archive)),
      folders.map((f) => f.name),
    );
    /*
     * WHICH OF THEM HAVE NOT BEEN BILLED.
     *
     * Marked here rather than worked out in the browser, because the answer
     * needs the invoice book and the page holds only the nights — and because
     * a room that has not opened the Invoices tab this boot has no book in
     * memory until `ensureInvoicesRestored` has run. Doing it in the browser
     * would mean shipping every invoice to a page that has no other use for
     * them.
     *
     * Only for somebody who actually bills through the app. A quizmaster
     * without invoicing has no unbilled nights, only nights.
     */
    let unbilled = new Set();
    if (billsThroughTheApp(req, url)) {
      await ensureInvoicesRestored(gigRoom);
      unbilled = new Set(gigRoom.invoices.unbilledNights(nights).map((n) => n.night));
    }
    /*
     * AND WHICH ARE ON THE PUBLIC GALLERY — one read of one file for the whole
     * list, so the rail can carry a lamp per night without a request each.
     *
     * From `galleryRoomFor()` like every other photo read, or the lamp would
     * report a different room's publishing from the button that sets it.
     */
    const up = photosRepoConfigured()
      ? new Set(await publishedNights(galleryRoomFor(req, url)))
      : new Set();
    return sendJson(res, 200, {
      nights: nights.map((n) => ({
        ...n,
        ...(unbilled.has(n.night) ? { unbilled: true } : {}),
        published: up.has(n.night),
      })),
      // So the page can say why there are no pictures against an old night,
      // rather than implying nobody took any.
      photosKept: photosRepoConfigured(),
    }), true;
  }

  /*
   * THE POST-NIGHT REPORT — a PDF for the venue, built from what the archive
   * and the photo repository already know.
   *
   * **IT HAS TO SIT ABOVE `/api/past-gigs/<night>`**, same trap as the
   * publish route below: that one matches any path under the prefix, and
   * would answer "that is not a night" to the word `report.pdf`.
   *
   * `{ boards: true }` is what makes the podium possible — every other read
   * of Past gigs asks `listArchive` without it, because the page has never
   * needed second and third place before.
   */
  if (route.startsWith('/api/past-gigs/') && route.endsWith('/report.pdf')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/past-gigs/'.length, -'/report.pdf'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    const gigRooms = gigRoomsFor(req, url);
    const gigRoom = gigRooms[0];
    for (const room of gigRooms) await ensureArchiveRestored(room);
    const folders = photosRepoConfigured() ? await listDirs(photoFolder(galleryRoomFor(req, url)), 'photos') : [];
    // The same union the listing uses, or the report of a night hosted under
    // the other hat has no venue, no podium and no headcount on it.
    const nights = mergeGigs(
      gigRooms.flatMap((room) => listArchive(room.paths.archive, { boards: true })),
      folders.map((f) => f.name),
    );
    const entry = nights.find((n) => n.night === night);
    if (!entry) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    const photoFiles = photosRepoConfigured()
      ? await nightFiles(`${photoFolder(galleryRoomFor(req, url))}/${night}`)
      : [];
    const photoCount = photoFiles.map((f) => safePhotoName(f.name)).filter(Boolean).length;
    /*
     * ADVERT OPENS FOR THE VENUE, matched by NAME — the same free-text join
     * every other venue read uses, because an advert pack has no venueId.
     * All-time rather than "on this night": an offer belongs to the venue,
     * not to one evening, so there is no per-night count to read.
     */
    let opens = 0;
    let hasOffer = false;
    if (entry.venue) {
      const want = entry.venue.trim().toLowerCase();
      const packs = listAdvertPacks(gigRoom.paths.adverts).filter((p) => String(p.venue || '').trim().toLowerCase() === want);
      for (const pack of packs) {
        if (!pack.slides.some((s) => s.offerCode)) continue;
        hasOffer = true;
        const totals = gigRoom.offers.forPack(pack.id);
        for (const slideId of Object.keys(totals)) opens += totals[slideId].total;
      }
    }
    /*
     * THE SEASON, AS IT STOOD AFTER THIS NIGHT — not as it stands today.
     *
     * A report for the 14th handed over in March has to say what the room was
     * looking at on the 14th, or it is a snapshot that has moved on rather
     * than evidence. `leagueAfter()` winds both the night list and the season
     * window back to that evening.
     *
     * Gated exactly like the library's own copy (`seesTheirLeague`): a Bronze
     * account's report simply has no table on it, which is silence rather
     * than a locked panel — the same rule the projector band follows.
     */
    let league = null;
    /*
     * AND ONLY WHERE A LEAGUE IS ACTUALLY RUN. A season table in the report of
     * a pub that has never heard of a league is the app asserting something
     * about somebody else's night — worse than saying nothing, which is what
     * this does instead.
     */
    /*
     * READ ONCE, FOR BOTH HALVES OF THE DOCUMENT. The rulings decide the league
     * table AND the winner's name below, and a report that masked one and not
     * the other is exactly what this hoist fixes. From the gallery room, like
     * every other read of `leagues-published.json`.
     */
    const ruled = await nameDecisions(galleryRoomFor(req, url));
    if (entry.venue && seesTheirLeague(req, url) && await leagueRunsAt(galleryRoomFor(req, url), entry)) {
      // `sameVenue()`, not a string compare — see the note on it. A pub booked
      // off the book one week and typed freehand the next split the season on
      // the one document a landlord forwards to a brewery.
      const here = nights.filter((n) => sameVenue(n, entry));
      const season = leagueAfter(here, night);
      // One night is not a league — it is tonight's scoreboard printed twice,
      // which is the rule `session.js` already applies to the projector band.
      /*
       * AND THE SAME FILTER ON THE REPORT. A landlord was in the room, but
       * the report is a document he can forward to a brewery or an area
       * manager who was not — so it is the far side of the same door.
       */
      if (season.nights > 1 && season.table.length) {
        league = { ...season, table: publicTable(season.table, ruled, teamKey), teams: season.table.length };
      }
    }
    /*
     * AND THE WINNER'S NAME IS FILTERED TOO, which it was not.
     *
     * The season table was masked and the podium three lines above it printed
     * raw, in one document — so the rule's own stated scope ("the public league
     * page and the landlord's report") held for half of the report. The name
     * that goes largest, in gold, at the top, was the one that got through.
     *
     * Masked HERE rather than in `report-pdf.js`, so the filter keeps one
     * definition and the PDF stays a layout: `publicName()` is the same call
     * `publicTable()` makes per row, with the same rulings, which is what lets
     * a human overrule it in both directions on the report as well.
     */
    const named = {
      ...entry,
      games: (entry.games || []).map((g) => ({
        ...g,
        winner: g.winner ? publicName(g.winner, ruled, teamKey) : g.winner,
        leaderboard: (g.leaderboard || []).map((r) => ({ ...r, name: publicName(r.name, ruled, teamKey) })),
      })),
    };
    const pdf = nightReportPdf(named, { headcount: nightHeadcount(entry), photoCount, opens, hasOffer, league });
    return send(res, 200, pdf, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nightReportFilename(entry)}"`,
    }), true;
  }

  /*
   * PUBLISH A NIGHT, or take it back down.
   *
   * Behind the same gate as the rest of Past gigs, and the room comes from WHO
   * YOU ARE — there is no room parameter, so this can only ever publish the
   * asker's own nights.
   *
   * **Taking it down matters as much as putting it up.** Somebody will ask for
   * their photo to be removed, and on a page with no contact details the only
   * honest answer is a quizmaster who can unpublish in one tap.
   *
   * **IT HAS TO SIT ABOVE `/api/past-gigs/<night>`**, which matches any path
   * under it and would answer "that is not a night" to the word `publish` —
   * a 404 that looks exactly like a working route refusing a bad date.
   */
  if (route.startsWith('/api/past-gigs/')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/past-gigs/'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    // THE ROOM THE PUBLIC PAGE READS — see `galleryRoomFor()`. The photos, the
    // lamps and the published flag all have to come from ONE room, or the
    // console describes a page it is not the one publishing to.
    const gigRoomId = galleryRoomFor(req, url);
    const files = photosRepoConfigured()
      ? await nightFiles(`${photoFolder(gigRoomId)}/${night}`)
      : [];
    const rulings = photosRepoConfigured() ? await photoDecisions(gigRoomId) : {};
    // Which ones a human chose for this night's card on the public index.
    const pinnedHere = photosRepoConfigured() ? (await photoPins(gigRoomId))[night] || [] : [];
    // Which ones the rude-photo check flagged, so the console can sort them to
    // the front — see `src/moderation.js`. Empty when nothing is set up.
    const flags = photosRepoConfigured() ? await photoFlags(gigRoomId) : {};
    return sendJson(res, 200, {
      night,
      // Whether this night is on the public gallery, so the control that puts
      // it there can say which way round it is. On THIS call rather than a
      // second one: it is already made the moment a night is opened, and a
      // button that has to fetch before it knows its own label is a button
      // that flickers.
      published: await isPublished(gigRoomId, night),
      maxPins: MAX_PINS,
      /*
       * THE SHOWCASE — the same three the public index fans out on this
       * night's card, so the console and the gallery cannot disagree about
       * which photographs lead.
       *
       * *"It should be the same three showcase photos that are used for this
       * purpose."* He is right, and the way to hold it is to SEND the answer
       * rather than let the browser work one out: `coverPhotos()` is pins
       * first and then a spread to fill, and a second implementation of that
       * in the console is a second thing to drift. It is the same call and the
       * same constant the index itself uses, a few hundred lines down.
       */
      cover: coverPhotos(
        files.map((f) => safePhotoName(f.name)).filter(Boolean)
          .filter((name) => showsOnGallery(name, rulings[photoKey(night, name)])),
        night,
        pinnedHere,
        COVER_PHOTOS,
      ),
      photos: files
        .map((f) => safePhotoName(f.name))
        .filter(Boolean)
        // Served back through this server, because the photo repository is
        // private and a browser cannot fetch from it.
        .map((name) => ({
          name,
          url: `/past-photo/${night}/${name}`,
          /*
           * WHETHER THIS ONE IS ON THE PUBLIC GALLERY, worked out HERE and
           * sent, rather than guessed in the browser from the filename.
           *
           * The console draws a pill per photo — *"a little green pill to show
           * it's on the public gallery for this night and a red one to show it
           * isn't"* — and the one thing that pill must never do is disagree
           * with the page it describes. `showsOnGallery()` is the single
           * function all three readers ask, so it cannot.
           */
          onGallery: showsOnGallery(name, rulings[photoKey(night, name)]),
          /*
           * PINNED TO THE NIGHT'S CARD — worked out here for the same reason
           * `onGallery` is: the browser must not hold a second copy of a rule
           * the server already owns. The cap rides along so the console can say
           * why a fourth press was refused without hardcoding a number.
           */
          pinned: pinnedHere.includes(name),
          // WHY it is off, when nobody has ruled: so the pill can say the
          // difference between "we thought you uploaded this" and "you turned
          // it off", which are different things to want to change.
          ruled: rulings[photoKey(night, name)] || '',
          /*
           * FLAGGED FOR REVIEW by the rude-photo check — 'adult' / 'racy' / ''.
           * The console sorts these to the front and marks them, so a review
           * of ninety photographs becomes a look at the three worth looking
           * at. Empty unless the Vision key is set and the check fired.
           */
          flagged: flags[flagKey(night, name)] || '',
        })),
    }), true;
  }


  return false;
}
