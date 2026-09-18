/**
 * GET ROUTES — rest. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, PACK_PENCE, accounts, calendarIcs, isOwnPack, path, readPack, reviewWarnings, rooms, upcoming, validateQuiz } from './context.js';
import { send, sendJson } from './plumbing.js';
import { brandForRoom, mayReadPack, packCtx, roomForHost, roomIdFor, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { backUpAccounts, csvCell, ensureInvoicesRestored, packPlayState } from './helpers.js';

export async function getRest(req, res, url, route) {
  /*
   * IS ANYBODY PLAYING THIS RIGHT NOW, AND WHERE HAVE THEY GOT TO?
   *
   * What the editor polls so its banner cannot be two hours old. It is only
   * the banner — the guard that actually matters runs inside the save, where
   * it cannot be stale. See `changesTheLiveQuestion`.
   *
   * A COUNT, NEVER A NAME. The owner has no business learning which
   * quizmaster is working tonight, and the number is what changes the
   * decision. A quizmaster asking about one of their own is scoped to their
   * own room by `packCtx`, so this can never leak across accounts either.
   */
  if (route.startsWith('/api/playing/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const rest = route.slice('/api/playing/'.length);
    const kind = rest.startsWith('bingo/') ? 'bingo' : 'quiz';
    const id = decodeURIComponent(rest.slice(kind.length + 1));
    if (!mayReadPack(req, url, kind, id)) return sendJson(res, 200, { playing: 0, live: null }), true;
    // Own packs are one room's; the catalogue is shared by everybody.
    const mine = isOwnPack(kind, id, roomForHost(req, url).paths);
    return sendJson(res, 200, packPlayState(kind, id, mine ? roomForHost(req, url) : null)), true;
  }

  if (route.startsWith('/api/quiz/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    if (!mayReadPack(req, url, 'quiz', id)) {
      return sendJson(res, 403, {
        error: 'That pack is not in your library yet.', upgrade: true, pence: PACK_PENCE,
      }), true;
    }
    try {
      // Their own library first, the catalogue second. An owner asking resolves
      // against the house room, so there is no id that reaches a subscriber's.
      const { pack: quiz, mine } = readPack('quiz', id, packCtx(req, url));
      return sendJson(res, 200, { ...quiz, mine, reviewWarnings: reviewWarnings(quiz), problems: validateQuiz(quiz) }), true;
    } catch {
      // Never `err.message`: on a miss that is an ENOENT carrying the server's
      // own absolute path, which tells an unknown caller the directory layout
      // and which room it just looked in. The same fault the advert sets had.
      return sendJson(res, 404, { error: 'No quiz with that name.' }), true;
    }
  }
  /*
   * THE DIARY, FOR A REAL CALENDAR APP.
   *
   * Open by design and authenticated by the key IN THE URL, because that is
   * the only credential a calendar client can carry — Google, Apple and
   * Outlook subscribe to a plain address and send no cookie. See
   * `calendarKey` in accounts.js for why that is a key of its own: it reads
   * the diary and nothing else, and rolling it kills every old subscription.
   *
   * An unknown key is a 404 rather than a 401. A calendar client that gets a
   * 401 will pop an authentication box at somebody forever; a 404 makes it
   * stop, which is what a revoked feed should do.
   */
  /*
   * The subscription URL, and a way to kill it. Behind the ordinary account
   * gate, unlike the feed itself — knowing your own address is a signed-in
   * question, reading the feed cannot be.
   */
  if (route === '/api/calendar/link' && req.method === 'GET') {
    if (!allowed(req, res, url, FEATURES.CALENDAR)) return true;
    const who = whoIs(req, url);
    if (!who || !who.id) return sendJson(res, 403, { error: 'Sign in to get your calendar link.' }), true;
    /*
     * THE HOST KEY IS NOT AN ACCOUNT, so there is nothing to hang a feed on —
     * the same sentence the other `/api/me/*` routes already say. It got this
     * far because `BOOTSTRAP.id` is the string `host-key`, which passes a
     * `!who.id` test, and `calendarKey()` then answered `''` for an account it
     * could not find: the diary printed `…/api/calendar.ics?key=` into the copy
     * box and it 404s for ever, silently, on the identity most likely to be
     * setting a calendar up.
     */
    if (who.bootstrap) {
      return sendJson(res, 400, { error: 'The host key is not an account, so there is nothing to remember this against. Sign in to get a calendar link.' }), true;
    }
    const key = accounts.calendarKey(who.id);
    await backUpAccounts();
    return sendJson(res, 200, { path: `/api/calendar.ics?key=${encodeURIComponent(key)}` }), true;
  }

  if (route === '/api/calendar.ics') {
    const account = accounts.byCalendarKey(url.searchParams.get('key') || '');
    if (!account) return send(res, 404, 'No calendar here.', { 'Content-Type': 'text/plain' }), true;
    const room = rooms.get(roomIdFor(account));
    await ensureInvoicesRestored(room);
    const nights = upcoming({
      venues: room.invoices.customers,
      bookings: room.invoices.bookings,
      // A calendar wants further ahead than a console panel does: the console
      // is answering "what is next", this is answering "what is my year".
      weeks: 26,
    });
    const body = calendarIcs(nights, {
      name: `${brandForRoom(room)} — quiz nights`,
      host: 'quizporium',
    });
    // Subscriptions are re-read often; an hour is what the feed itself asks
    // for in X-PUBLISHED-TTL and there is no reason to work harder. `send`
    // defaults to no-store, so the header is set explicitly here.
    return send(res, 200, body, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline; filename="quiz-nights.ics"',
    }), true;
  }

  if (route === '/api/results.csv') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const { session } = roomForHost(req, url);
    const results = session.results();
    const rows = session.kind === 'bingo'
      ? [['Team', 'Squares away', 'False calls', 'Won'], ...results.leaderboard.map((p) => [p.name, p.away, p.falseCalls, p.won ? 'yes' : ''])]
      : [['Position', 'Team', 'Score', 'Correct', 'Answered'], ...results.leaderboard.map((p) => [p.position, p.name, p.score, p.correctCount, p.answeredCount])];
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    return send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiz-results.csv"`,
    }), true;
  }

  return false;
  return false;
}
