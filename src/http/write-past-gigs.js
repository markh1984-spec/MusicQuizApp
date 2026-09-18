/**
 * WRITE ROUTES — past-gigs. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, isNightFolder, isVenueKey, noteNightVenue, setLeagueRunning, setNameDecision, setNightVenue, setPosted, setPublished, setVenuePublished } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { galleryRoomFor, gigRoomsFor } from './identity.js';
import { allowed } from './gates.js';
import { backUpArchive, ensureArchiveRestored } from './helpers.js';

export async function writePastGigs(req, res, url, route) {
  /*
   * WHERE A PAST NIGHT WAS — set afterwards, when nobody typed it at launch.
   *
   * Behind PAST_GIGS and scoped to WHO YOU ARE, like every other route on this
   * door: there is no room parameter, so this can only ever name a pub on your
   * own night.
   *
   * **IT WRITES INTO BOTH OF `gigRoomsFor()`'S ROOMS**, for the reason that
   * function exists — the owner's nights are filed under one hat and
   * photographed under the other, so a route that patched only the room it
   * happens to resolve to would report success and leave the night in exactly
   * the state it was reported in. A read and a write that disagree about the
   * room is invisible, which is this app's own most expensive lesson.
   */
  if (route === '/api/past-gigs/venue' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const body = await readJson(req);
    const night = String(body.night || '');
    const venue = String(body.venue || '').trim();
    const venueId = String(body.venueId || '').trim();
    if (!isNightFolder(night)) return sendJson(res, 400, { error: 'That is not a night.' }), true;
    if (!venue) return sendJson(res, 400, { error: 'Name the venue.' }), true;
    const venueRooms = gigRoomsFor(req, url);
    // The backup has to be back before the archive is read, or a night that is
    // simply not on this disk yet gets a NOTE filed over the top of the record
    // it already has.
    for (const room of venueRooms) await ensureArchiveRestored(room);
    let changed = 0;
    for (const room of venueRooms) changed += setNightVenue(room.paths.archive, night, { venue, venueId }).changed;
    // Nothing filed for that date at all — see `noteNightVenue()`.
    const noted = changed ? null : noteNightVenue(venueRooms[0].paths.archive, night, { venue, venueId });
    if (!changed && !noted) return sendJson(res, 400, { error: 'Could not save that.' }), true;
    /*
     * AND THE BACKUP, AWAITED — unlike the one when a night ends. Nobody is
     * watching a projector here, and the whole value of the change is that it
     * survives the next deploy: `data/` is wiped on every one, so an
     * unbacked-up patch is a change that undoes itself within the week.
     */
    for (const room of venueRooms) await backUpArchive(room);
    return sendJson(res, 200, { ok: true, changed: changed || 1, noted: Boolean(noted) }), true;
  }

  if (route === '/api/past-gigs/publish' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const body = await readJson(req);
    const done = await setPublished(galleryRoomFor(req, url), String(body.night || ''), body.on !== false);
    return sendJson(res, done.ok ? 200 : 400, done), true;
  }

  /*
   * MARK A NIGHT AS POSTED TO SOCIALS, or take the mark off.
   *
   * The publish route's twin, deliberately — same gate, same room, same file,
   * same shape — because it answers the same KIND of question about a night
   * and the two are read side by side in the rail. **It is a mark and never a
   * gate**: nothing refuses anything because of it, so there is no way for
   * this to stop somebody posting a night twice if they want to.
   */
  if (route === '/api/past-gigs/posted' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const body = await readJson(req);
    const done = await setPosted(galleryRoomFor(req, url), String(body.night || ''), body.on !== false);
    return sendJson(res, done.ok ? 200 : 400, done), true;
  }

  /*
   * PUT A VENUE'S LEAGUE TABLE UP, or take it back down.
   *
   * Behind the LEAGUE gate rather than PAST_GIGS — it publishes a league —
   * and the room comes from WHO YOU ARE, so this can only ever publish your
   * own tables. There is no room parameter on purpose, the identical rule
   * `/api/host/*` and the gallery's own publish route both follow.
   *
   * The key is `venueKeyOf()`'s — an id where the nights have one, a
   * lowercased name where they do not — because that is what the table is
   * grouped by. Publishing by display name would put the wrong pub up the day
   * somebody renamed one.
   */
  /*
   * OVERRULE THE FILTER ON ONE NAME — in either direction.
   *
   * *"Can I get a manual override so we're erring on the side of caution but
   * I can override it."* The word list is a guess about intent; a quizmaster
   * who was in the room is not. So the list decides by default and this is
   * how a person overrides it — `allow` to publish a name it held back,
   * `hide` for one it let through, and an empty string to hand the decision
   * back to the list.
   *
   * Behind the LEAGUE gate and scoped to the signed-in room, exactly like the
   * publish route beside it: there is no room parameter, so this can only
   * ever rule on your own teams.
   */
  if (route === '/api/league/name' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.LEAGUE)) return true;
    const body = await readJson(req);
    /*
     * `galleryRoomFor`, NOT `roomForHost` — the same fix the photographs
     * already had, on the file it was never applied to.
     *
     * `leagues-published.json` lives in the photo folder and the PUBLIC page
     * reads it through `galleryRoomId()`, which for the owner and the host key
     * is their own quizmaster room. `roomForHost()` is HOUSE for both of those,
     * so a ruling or a publish was written into a folder the page never looks
     * at: it succeeded, said so, and read back as though nothing had happened.
     * No change at all for an ordinary quizmaster — their room id is never
     * HOUSE, so the two functions agree.
     */
    const done = await setNameDecision(
      galleryRoomFor(req, url), String(body.name || ''), String(body.decision || ''),
    );
    return sendJson(res, done.ok ? 200 : 400, done), true;
  }

  /*
   * DOES THIS VENUE RUN A LEAGUE AT ALL.
   *
   * Off until somebody says so — see `setLeagueRunning()`. It gates what
   * LEAVES: the landlord's report and the public page. The console draws every
   * venue's table either way, because the arithmetic is useful regardless of
   * whether the pub calls it a league.
   */
  if (route === '/api/league/running' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.LEAGUE)) return true;
    const body = await readJson(req);
    const key = String((body && body.venueKey) || '');
    if (!isVenueKey(key)) return sendJson(res, 400, { error: 'That is not a venue.' }), true;
    // `galleryRoomFor` — see the ruling route above.
    const done = await setLeagueRunning(galleryRoomFor(req, url), key, Boolean(body && body.on));
    if (!done.ok) return sendJson(res, 400, { error: done.error || 'Could not save that.' }), true;
    return sendJson(res, 200, { ok: true, running: done.running, venues: done.venues }), true;
  }

  if (route === '/api/league/publish' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.LEAGUE)) return true;
    const body = await readJson(req);
    // `galleryRoomFor` — see the ruling route above. This is the one that
    // decides whether a venue's table has a public page at all, so writing it
    // into the wrong folder meant publishing and reading back "not published".
    const done = await setVenuePublished(galleryRoomFor(req, url), String(body.venueKey || ''), body.on !== false);
    return sendJson(res, done.ok ? 200 : 400, done), true;
  }

  return false;
}
