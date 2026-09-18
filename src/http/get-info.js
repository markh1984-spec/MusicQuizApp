/**
 * GET ROUTES — info. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { ENOUGH_TO_JUDGE, FEATURES, HOUSE, STICKERS, accounts, fs, isOwnPack, privateRepoConfigured, propUse, reports, rooms, spend } from './context.js';
import { joinUrlFor, publicOrigin, sendJson } from './plumbing.js';
import { brandForRoom, roomForPhone, whoseRoom } from './identity.js';
import { allowed } from './gates.js';
import { cataloguePerformance, subscriberList } from './helpers.js';

export async function getInfo(req, res, url, route) {
  // ---- info
  if (route === '/api/join-url') {
    const room = roomForPhone(req, url);
    return sendJson(res, 200, {
      url: joinUrlFor(publicOrigin(req), room.code),
      code: room.code,
      brand: brandForRoom(room),
    }), true;
  }
  /*
   * ---- signing in
   *
   * Open, obviously — it is the way in. The token goes in an httpOnly cookie so
   * a script on the page cannot read it, and SameSite=Lax so another site
   * cannot spend it. `secure` only when the request actually arrived over
   * https, or a laptop on http://localhost could never sign in.
   */
  /*
   * The reports. Owner only — these are corrections to the owner's own packs,
   * and a quizmaster seeing everybody else's would be the same mistake as the
   * invoice book being shared.
   */
  if (route === '/api/reports') {
    if (!allowed(req, res, url, FEATURES.CATALOGUE)) return true;
    return sendJson(res, 200, { reports: reports.all(), ...reports.summary() }), true;
  }

  /*
   * WHICH PROPS ARE EARNING THEIR PLACE — worst first, which is the order
   * somebody deleting things reads it in.
   *
   * **GATED ON `FEATURES.PHOTO_EXPORT`, which is the Photos tab's own gate,
   * and NOT on the `/api/owner/` prefix.** The first version of this comment
   * said the prefix was the gate, and the route was open to anybody — because
   * `OWNER_ONLY` in `gates.js` is an EXEMPTION from the broad quiz-feature
   * check (the owner holds no quiz features), not a check of its own. *A
   * comment that claims the opposite is where the next bug hides*, and this
   * one was the bug as well as the claim.
   *
   * The tally itself has no player, team, night or photograph in it (see
   * `src/prop-use.js`), so this is a table about drawings rather than about
   * people — but it is the owner's own catalogue and it sits on the owner's
   * own tab.
   *
   * **IN `handleGet`, WHICH IS WHERE IT BELONGS AND IS NOT WHERE IT WAS.** It
   * was written beside `/api/owner/hosting` — a PUT, in `handleWrite` — so
   * every GET fell straight through to the generic 404 while the code read as
   * a working route. That is this repo's own recorded trap, and the gallery
   * publish route shipped with it: **a route in the wrong handler is dead code
   * that reads as a feature.** Caught because the test asserts against the 404
   * rather than for the 200.
   */
  if (route === '/api/owner/prop-use') {
    if (!allowed(req, res, url, FEATURES.PHOTO_EXPORT)) return true;
    const labels = Object.fromEntries(STICKERS.map((x) => [x.id, x.label]));
    const seasonal = new Set(STICKERS.filter((x) => x.look).map((x) => x.id));
    return sendJson(res, 200, {
      enough: ENOUGH_TO_JUDGE,
      /*
       * SEASONAL PROPS ARE NAMED AS SEASONAL, and that is load-bearing rather
       * than decoration: they appear only on the one night their look is on,
       * so their `shown` climbs a fraction as fast and a table that did not
       * say so reads as "delete every skull in January".
       */
      props: propUse.table(STICKERS.map((x) => x.id))
        .map((r) => ({ ...r, label: labels[r.id] || r.id, seasonal: seasonal.has(r.id) })),
    }), true;
  }

  if (route === '/api/owner/accounts') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    return sendJson(res, 200, { accounts: subscriberList(), backupReady: privateRepoConfigured() }), true;
  }

  /*
   * The three things the owner page could not answer before: what is on a
   * projector right now, what the catalogue is actually worth, and what the AI
   * has cost.
   *
   * One route rather than three, because the page draws them together and
   * three fetches means three ways for the page to be half drawn. None of it
   * is big — the rooms are already in memory, the play counts are one file,
   * and the ledger is summarised rather than sent.
   *
   * Nothing here reveals a quizmaster's own packs. Their rooms say which
   * CATALOGUE pack is loaded, which the owner wrote; a room playing one of
   * their own says so and names nothing.
   */
  if (route === '/api/owner/overview') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    /*
     * Wake every room that has a saved game before answering.
     *
     * Rooms are made lazily, so after a restart only the house room is in
     * memory — and "nothing is running, safe to deploy" would have been a
     * confident lie told at exactly the moment it matters most, because a
     * quizmaster's phones have not reconnected yet. Reading their state file
     * is what happens the second they do; doing it here costs one file read
     * per subscriber and makes the answer true.
     *
     * Only accounts that still exist, so a closed one does not come back as a
     * room, and only ones with something saved — a subscriber who has never
     * run a night has nothing to restore and should not appear as idle.
     */
    for (const account of accounts.all) {
      if (account.role !== 'quizmaster') continue;
      if (rooms.rooms.has(account.id)) continue;
      try {
        if (fs.existsSync(rooms.pathsFor(account.id).state)) rooms.get(account.id, account.name || '');
      } catch { /* a room that will not boot is not worth taking this page down for */ }
    }
    const live = rooms.summaries().map((room) => {
      const who = whoseRoom({ id: room.id });
      const ownPack = room.id !== HOUSE
        && isOwnPack(room.game, room.packId || '', rooms.get(room.id).paths);
      return {
        ...room,
        who: (who && (who.name || who.email)) || '',
        /*
         * One of theirs is "one of their own" and nothing more.
         *
         * The ID goes as well as the title, and that is not fussiness: a pack
         * id is the title slugged, so leaving it would put "robs-secret-quiz"
         * on the owner's page under a line saying the owner cannot read it.
         */
        ...(ownPack ? { pack: 'One of their own', packId: '', own: true } : {}),
      };
    });
    return sendJson(res, 200, {
      rooms: live,
      packs: cataloguePerformance(),
      spend: spend.summary({ months: 12 }),
      spendBackedUp: privateRepoConfigured(),
    }), true;
  }

  /*
   * Are there accounts on this app at all?
   *
   * Open, and deliberately says nothing more than yes or no — it exists so the
   * console can tell "sign in" apart from "type the host key", which are very
   * different pieces of advice to give somebody locked out five minutes before
   * a gig. It reveals no email address and no count.
   */
  /*
   * HOW OFTEN EACH PROP GETS REACHED FOR, for the camera tray's weighting.
   *
   * **ITS OWN GET RATHER THAN A FIELD ON THE STATE PAYLOAD**, and that is the
   * whole reason it exists: every phone in the room receives a payload on
   * every push, so a table of sixty-seven rates riding on all of them is real
   * bytes on pub wifi for something that changes over WEEKS — and it would
   * break `pub-unchanged`, which is the guard standing over a pub night.
   * Fetched once, by the phones that actually open the camera.
   *
   * Open, because it is aggregate data about the owner's own drawings: no
   * player, no team, no night, nothing anybody said or did. See
   * `src/prop-use.js`.
   */
  if (route === '/api/prop-weights') {
    return sendJson(res, 200, { weights: propUse.weights(STICKERS.map((s) => s.id)) }), true;
  }

  if (route === '/api/has-accounts') {
    return sendJson(res, 200, { any: accounts.all.length > 0 }), true;
  }

  return false;
}
