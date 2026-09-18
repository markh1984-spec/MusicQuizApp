/**
 * WRITE ROUTES — settings. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, accounts, bookingOf, can, path } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { refuseBreached, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { SUPPORT_MINUTES } from './support-log.js';
import { backUpAccounts } from './helpers.js';

export async function writeSettings(req, res, url, route) {
  /*
   * ---- support access: the subscriber's own door, and only theirs
   *
   * The one thing on this page that is not cosmetic. A quizmaster's own
   * material is their work, and other quizmasters will assume the worst about
   * a competitor who can read it — so "only when you let me in, it runs out on
   * its own, and here is everything I did" is the answer, rather than a promise.
   *
   * Only the account itself can open it. Not the owner, and not the host key:
   * `whoIs` returns BOOTSTRAP for a key and there is no account to write it
   * against, so the key cannot open a door for itself either.
   */
  if (route === '/api/me/support' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (account.bootstrap) {
      return sendJson(res, 400, {
        error: 'The host key is not an account, so there is no door to open. Sign in as the account you want to grant access to.',
      }), true;
    }
    /*
     * And NOT while acting as somebody. Letting the owner open the door from
     * inside a support session would mean one grant could extend itself for
     * ever, which is the whole point of an expiry undone in one line.
     */
    if (account.actingAs) {
      return sendJson(res, 403, {
        error: 'Support access can only be changed by the account holder, signed in as themselves.',
      }), true;
    }
    /*
     * A SWITCH, not a duration to choose.
     *
     * Picking "1 hour or 8 or 24" is a decision at the worst possible moment —
     * they do not know yet how long the problem takes. On, then off the second
     * it is sorted, is the control they actually want, and off is instant.
     *
     * And it runs on a DEAD MAN'S SWITCH rather than a booking. Half an hour
     * at a time; the app asks whether help is still needed as it runs down,
     * and one tap keeps it alive. So nobody has to remember to close
     * anything — walking away closes it, which is the behaviour you actually
     * want from somebody who has been distracted by a phone call. Opening it
     * again costs one tap, so being shut out early is cheap and being left
     * open for a week is impossible.
     */
    const body = await readJson(req);
    const saved = body.open === false
      ? accounts.closeSupport(account.id)
      : accounts.openSupport(account.id, Number(body.minutes) || SUPPORT_MINUTES);
    if (!saved) return sendJson(res, 404, { error: 'No such account' }), true;
    await backUpAccounts();
    return sendJson(res, 200, {
      ok: true,
      support: saved.support || null,
      open: accounts.supportOpen(account.id),
    }), true;
  }

  if (route === '/api/me/prefs' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (account.bootstrap) {
      return sendJson(res, 400, {
        error: 'The host key is not an account, so there is nothing to remember this against. Sign in to change it.',
      }), true;
    }
    const body = await readJson(req);
    const saved = accounts.setPrefs(account.id, body);
    if (!saved) return sendJson(res, 404, { error: 'No such account' }), true;
    await backUpAccounts();
    // `booking` for the same reason the library payload carries it: the panel
    // echoes what the server UNDERSTOOD, and a save is exactly the moment a
    // mistyped link should become visible.
    return sendJson(res, 200, {
      ok: true, prefs: saved.prefs || {}, booking: bookingOf(saved),
    }), true;
  }

  /*
   * A NEW CALENDAR ADDRESS — the only way to revoke a leaked feed.
   *
   * **IT LIVED IN `handleGet` AND THEREFORE 404ED.** Written beside its own GET
   * for readability, which put a POST inside the handler that only ever runs
   * for GET and HEAD, so every press of *"Make a new address?"* fell through to
   * the generic 404 — the identical fault the gallery's publish route already
   * carries a comment about, in this same file. A route in the wrong handler is
   * dead code that reads as a feature.
   *
   * The GET stays where it was: knowing your own address is a read.
   */
  if (route === '/api/calendar/link' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.CALENDAR)) return true;
    const who = whoIs(req, url);
    if (!who || !who.id) return sendJson(res, 403, { error: 'Sign in to get your calendar link.' }), true;
    if (who.bootstrap) {
      return sendJson(res, 400, {
        error: 'The host key is not an account, so there is nothing to remember this against. Sign in to change it.',
      }), true;
    }
    const key = accounts.rollCalendarKey(who.id);
    await backUpAccounts();
    return sendJson(res, 200, { path: `/api/calendar.ics?key=${encodeURIComponent(key)}` }), true;
  }

  // Your own password. The old one is required even though you are signed in:
  // a borrowed laptop should not be a way to take somebody's account.
  if (route === '/api/me/password' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account || account.bootstrap) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const body = await readJson(req);
    if (await refuseBreached(res, body.password)) return true;
    try {
      accounts.setPassword(account.id, body.password, { requireOld: body.current ?? '' });
      await backUpAccounts();
      return sendJson(res, 200, { ok: true, signedOut: true }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  return false;
}
