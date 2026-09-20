/**
 * THE SUPPORT LOG — what a session inside somebody else's account may do, and what it writes down. Moved whole from server.js.
 */
import { accounts } from './context.js';
import { sendJson } from './plumbing.js';
import { whoIs } from './identity.js';

/*
 * ---- what a support session may do, and what it writes down
 *
 * Both halves live here rather than on each route, so the next route somebody
 * adds is covered without them having to think about it.
 *
 * REFUSED: anything under /api/host/*. That is the running of a night — Next,
 * Back, Reveal, Launch — and the whole reason support access waits for the gig
 * to be over. Entry already refuses while their game is live; this is the
 * other half, for a game that starts WHILE somebody is inside.
 *
 * LOGGED: reads as well as writes, because "did you look at my quizzes" is the
 * question this log exists to answer, and a writes-only log is silent about
 * exactly that. What is skipped is the noise that would drown it — the state
 * poll, the live stream, health checks and static files — none of which says
 * anything a subscriber would want to read.
 */
/**
 * How long one stretch of support access lasts before the subscriber has to
 * say they still need it. A dead man's switch, not a booking — see
 * `openSupport()` in accounts.js.
 */
export const SUPPORT_MINUTES = 30;

export const SUPPORT_NEVER = ['/api/host/'];
/*
 * WHAT IS TOO DULL TO WRITE DOWN — and it was wrong in BOTH directions.
 *
 * **Matched EXACTLY now, never as a prefix.** The old test was
 * `route === p || route.startsWith(p + '/')`, so `/api/me` on this list quietly
 * covered every `/api/me/*` WRITE: changing somebody's colour scheme — which is
 * what their projector and sixty phones wear — left no line at all, and neither
 * did hiding tabs from their console. The panel promises *"everything done
 * while it is on is in your support log"*, and this is the one feature whose
 * entire pitch is the log.
 *
 * **And `/api/live` is not a route in this app.** The SSE route is
 * `/api/stream`, so every reconnect wrote a line — and `noteSupport` keeps the
 * last 500, so stream noise was evicting the entries that matter.
 *
 * A route added here has to be one where a LINE would be noise, not one where
 * the ACT is dull. There are no `/api/me/*` reads that write anything.
 */
/*
 * HOW MANY SEATS ONE GROUP MAY HOLD. A SAFETY number, not a design one — the
 * same distinction `MAX_TEAMS` records in the engine: there was no ceiling at
 * all, so one signed-in account could mint accounts in a loop. A pub group
 * with more than this many venues is a conversation, not a form submission.
 */
export const MAX_SEATS = 50;

export const SUPPORT_QUIET = ['/api/state', '/api/stream', '/health', '/api/me', '/api/brand', '/api/has-accounts',
  // Every phone on a card night asks this once. A line each is sixty lines.
  '/api/card-art',
  // The console's ready light asks this every few seconds while it is open.
  '/api/host/ready'];

/**
 * What a support session did, in words a subscriber would use.
 *
 * The log is read by somebody deciding whether they trust you, so it has to
 * say what happened rather than which endpoint was called. "GET /api/library"
 * is developer-speak; "Looked at your pack library" is the same fact in a
 * sentence they can judge. Anything unmapped falls back to the raw route,
 * which is honest — better an ugly line than a missing one.
 */
export function supportWords(method, route) {
  const read = method === 'GET';
  if (route.startsWith('/api/quiz/') || route.startsWith('/api/bingo/')) {
    const id = decodeURIComponent(route.split('/')[3] || '');
    return read ? `Opened your pack "${id}"` : `Changed your pack "${id}"`;
  }
  /*
   * Their OWN packs, which is the whole reason support access exists.
   *
   * Said in the plainest words in this list, because these are the lines
   * somebody scrolls back to when they are deciding whether they still trust
   * you with a key to their material.
   */
  if (route.startsWith('/api/mine/')) {
    const id = decodeURIComponent(route.split('/')[4] || '');
    if (route.startsWith('/api/mine/import')) return 'Imported a track list into your own packs';
    /*
     * **Looking is not changing, and this log said it was.**
     *
     * `read` was worked out at the top of this function and then ignored here,
     * so a GET of somebody's own pack was written down as "Changed your own
     * pack" and a GET of the list as "Saved one of your own packs". On the one
     * log whose entire job is telling a subscriber what was done to their
     * material, that accuses you of altering their work when you only opened
     * it — which is worse than a missing entry, because they will believe it.
     * The block above gets this right for the catalogue; this one did not.
     */
    if (id) return read ? `Opened your own pack "${id}"` : `Changed your own pack "${id}"`;
    return read ? 'Looked at your own packs' : 'Saved one of your own packs';
  }
  if (route.startsWith('/api/invoices')) {
    return read ? 'Looked at your invoices' : 'Changed something in your invoices';
  }
  if (route.startsWith('/api/advert')) {
    return read ? 'Looked at your venue slides' : 'Changed your venue slides';
  }
  /*
   * THE TWO WRITES THAT USED TO BE SILENT — see `SUPPORT_QUIET`. A scheme is
   * what the room sees tonight, and hidden tabs are what the console offers,
   * so both are changes to somebody's app rather than to a setting nobody
   * notices. Named, so the log says which.
   */
  if (route === '/api/me/scheme') return 'Changed your colours';
  if (route === '/api/me/prefs') return 'Changed your settings';
  if (route === '/api/me/password') return 'Changed your password';
  if (route === '/api/calendar/link') return read ? 'Looked at your calendar link' : 'Made you a new calendar address';
  if (route.startsWith('/api/archive')) return 'Looked at your past nights';
  /*
   * THE PHOTOGRAPHS, AND THIS LINE IS WHY THE GAP LOOKED CLOSED FOR MONTHS.
   * `/api/photos` is not a route this app has — the pictures are served from
   * `/past-photo/`, `/gallery-photo/` and `/photos/`, none of which begin
   * `/api/`, which is where the guard used to stop. So the log carried a
   * sentence about a thing it could not see, and *"did you look at my
   * photos"* — the question the log exists to answer — was answered wrongly.
   */
  if (PHOTO_ROUTES.some((p) => route.startsWith(p))) return 'Looked at your photos';
  if (route === '/api/library') return 'Looked at your pack library';
  return `${method} ${route}`;
}

/**
 * The ways a photograph actually leaves this app.
 *
 * A support session could download every picture of a member of the public a
 * subscriber had ever taken, and the log said nothing — see `supportWords()`
 * above for why nobody noticed.
 */
export const PHOTO_ROUTES = ['/past-photo/', '/gallery-photo/', '/photos/'];

export function supportGuard(req, res, url, route) {
  /*
   * `/api/` PLUS THE PHOTOGRAPHS. The prefix test was the whole scope, and it
   * is the right default — static files, the projector and the phones are not
   * support actions — but a picture of somebody's customers leaving the app is
   * exactly what this log is for.
   */
  if (!route.startsWith('/api/') && !PHOTO_ROUTES.some((p) => route.startsWith(p))) return true;
  const who = whoIs(req, url);
  // The flag set by whoIs on an ACTING identity, never the grant object a
  // subscriber carries on their own account — see the note there.
  if (!who || !who.inSupport) return true;

  if (SUPPORT_NEVER.some((p) => route.startsWith(p))) {
    accounts.noteSupport(who.id, 'Tried to run your game — refused, support access cannot touch a night');
    sendJson(res, 403, {
      error: 'Support access cannot run a night. Ask them to close the game first, or come back when it is over.',
    });
    return false;
  }

  if (!SUPPORT_QUIET.includes(route)) {
    accounts.noteSupport(who.id, supportWords(req.method, route));
  }
  return true;
}

