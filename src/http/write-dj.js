/**
 * WRITE ROUTES — dj. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { readJson, sendJson } from './plumbing.js';
import { roomForHost, whoIs } from './identity.js';
import { pushState } from './views.js';

export async function writeDj(req, res, url, route) {
  /*
   * ---- A DJ SET — its own routes, deliberately not `/api/host/*` -----------
   *
   * **THE QUIZ'S LAUNCH ROUTE IS THE MOST PROTECTED THING IN THIS APP** — item
   * 1 on the protected surface — and threading a third game through it would
   * put every pub night one ternary away from a feature that has nothing to do
   * with pub nights. `/api/dj/*` leaves it byte-for-byte untouched, which is
   * also why `pub-unchanged` can still answer honestly about this change.
   *
   * It is the same reasoning the separate front door rests on, one layer down:
   * share the room, the photos and the phone; share nothing that decides what
   * happens on a Thursday.
   *
   * **NOT GATED ON A QUIZ SUBSCRIPTION, and that is a decision rather than an
   * omission.** What a DJ set costs is a pricing question nobody has answered;
   * gating it on `FEATURES.QUIZ` today would answer it by accident, in the
   * hardest place to find later. Signed in is the whole check for now.
   */
  if (route.startsWith('/api/dj/') && req.method === 'POST') {
    const what = route.slice('/api/dj/'.length);

    /*
     * EVERYTHING ELSE IS THE DESK, and the room comes from WHO YOU ARE — the
     * rule `/api/host/*` follows and for the identical reason: there is no
     * room parameter, so none of these can be pointed at somebody else's set.
     */
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const room = roomForHost(req, url);
    const { session } = room;
    const body = await readJson(req);

    if (what === 'start') {
      /*
       * A set replaces whatever is in the room, which is what launching has
       * always meant — and the console's own "this would end the night
       * running" warning is the quiz's, so this route asks for `replace`
       * explicitly rather than inheriting a guard written for a different
       * screen.
       */
      if (!body.replace && session.inProgress()) {
        return sendJson(res, 409, { error: 'Something is already running in your room.' }), true;
      }
      session.launch('dj', 'dj', {
        venue: String(body.venue || ''),
        venueId: String(body.venueId || ''),
        look: String(body.look || ''),
      });
      pushState(room);
      return sendJson(res, 200, { ok: true, joinCode: room.joinCode || '' }), true;
    }

    if (session.kind !== 'dj') return sendJson(res, 409, { error: 'No DJ set is running.' }), true;

    if (what === 'played') {
      const ok = session.engine.played(String(body.id || ''));
      if (ok) pushState(room);
      return sendJson(res, 200, { ok }), true;
    }
    if (what === 'bin') {
      const ok = session.engine.bin(String(body.id || ''));
      if (ok) pushState(room);
      return sendJson(res, 200, { ok }), true;
    }
    if (what === 'finish') {
      session.engine.finish();
      pushState(room);
      return sendJson(res, 200, { ok: true }), true;
    }
    return sendJson(res, 404, { error: 'No such action.' }), true;
  }

  return false;
}
