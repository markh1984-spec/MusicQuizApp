/**
 * WRITE ROUTES — shows. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, deleteShow, saveShow } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { roomForHost } from './identity.js';
import { allowed, problemsWith } from './gates.js';

export async function writeShows(req, res, url, route) {
  /*
   * BUILD A NIGHT IN ADVANCE, AND THROW ONE AWAY — see `src/shows.js`.
   *
   * IN `handleWrite`, which is worth saying out loud because this repo has
   * already shipped a route defined in `handleGet` that could never answer a
   * POST and read as a working feature for months. The list comes back in
   * `/api/library` rather than from a GET here, so there is nothing of this
   * feature in the other function at all.
   *
   * **GATED ON THE GAME IT PLAYS, exactly as the launch is.** Saving a show is
   * not a way round a tier: a bingo show wants the bingo feature to save and
   * will want it again to launch, where every pack in it is re-checked. This
   * route deliberately does NOT verify the packs — that is the launch route's
   * job and duplicating it here would be a second definition of "in your
   * library" to drift. What it does instead is answer with what is WRONG with
   * the show, so the console can say so on the card days before the gig.
   */
  if (route === '/api/shows' && req.method === 'POST') {
    const body = await readJson(req);
    const kind = String(body.kind || 'quiz') === 'bingo' ? 'bingo' : 'quiz';
    if (!allowed(req, res, url, kind === 'bingo' ? FEATURES.BINGO : FEATURES.QUIZ)) return true;
    const room = roomForHost(req, url);
    try {
      const show = saveShow(room.paths, { ...body, kind });
      return sendJson(res, 200, { ok: true, show, problems: problemsWith(show, room) }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/shows/') && req.method === 'DELETE') {
    /*
     * `live: true` rather than `mayStartSomething`: throwing away a show you
     * are not going to run is tidying up, and an account whose payment has
     * bounced should still be able to tidy up. The same reasoning as every
     * other mid-night action being asked with `live` set.
     */
    if (!allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const room = roomForHost(req, url);
    try {
      deleteShow(room.paths, decodeURIComponent(route.slice('/api/shows/'.length)));
      return sendJson(res, 200, { ok: true }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }

  return false;
}
