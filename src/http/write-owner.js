/**
 * WRITE ROUTES — owner. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, TIERS, accounts, photosRepoConfigured, randomBytes, reports, rooms, spend } from './context.js';
import { isHostKey, readJson, sendJson } from './plumbing.js';
import { ACTING_COOKIE, SESSION_COOKIE, TIER_COOKIE, cookie, cookieFor, refuseBreached, roomForHost } from './identity.js';
import { allowed } from './gates.js';
import { pushState } from './views.js';
import { backUpAccounts, backUpReports, backUpSpend, subscriberList, within } from './helpers.js';
import { FILE_REST_WAIT_MS, fileTheRest } from './photo-filing.js';

export async function writeOwner(req, res, url, route) {
  // ---- managing subscribers
  if (route.startsWith('/api/reports/') && (req.method === 'POST' || req.method === 'DELETE')) {
    if (!allowed(req, res, url, FEATURES.CATALOGUE)) return true;
    const id = decodeURIComponent(route.slice('/api/reports/'.length));
    if (req.method === 'DELETE') {
      const gone = reports.remove(id);
      if (gone) backUpReports();
      return sendJson(res, 200, { ok: gone, ...reports.summary() }), true;
    }
    const body = await readJson(req);
    const ok = reports.setStatus(id, String(body.status || 'done'));
    if (ok) backUpReports();
    return sendJson(res, 200, { ok, ...reports.summary() }), true;
  }

  /*
   * Put the quizmaster hat on, or take it off.
   *
   * Creates the linked account the first time. It is given a long random
   * password nobody ever sees, because it is not signed into directly — the
   * whole point is ONE login. That also means there is no second password to
   * lose, and no second account anybody could sign into if they got the address.
   */
  if (route === '/api/owner/act-as' && req.method === 'POST') {
    const me = accounts.fromToken(cookie(req, SESSION_COOKIE));
    if (!me || me.role !== 'owner') return sendJson(res, 403, { error: 'Owners only.' }), true;
    const body = await readJson(req);

    if (body.on === false) {
      // Both cookies. A preview tier left behind would silently apply the next
      // time the hat went on, which is exactly the kind of thing that has you
      // hunting for a bug in the app rather than in your own session.
      res.setHeader('Set-Cookie', [
        `${ACTING_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
        `${TIER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
      ]);
      return sendJson(res, 200, { ok: true, acting: false }), true;
    }

    /*
     * Look at it as a Bronze / Silver / Gold subscriber would.
     *
     * The owner only, and only while the hat is on — a real quizmaster has
     * nothing to preview and this cookie means nothing to them. Sent as its own
     * little request rather than folded into `on: true` so changing tier does
     * not re-create the linked account or disturb the room.
     */
    if (body.tier !== undefined) {
      const wanted = String(body.tier || '');
      if (wanted && !TIERS.some((t) => t.id === wanted)) {
        return sendJson(res, 400, { error: `"${wanted}" is not a tier.` }), true;
      }
      res.setHeader('Set-Cookie', wanted
        ? cookieFor(req, TIER_COOKIE, wanted)
        : `${TIER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
      return sendJson(res, 200, { ok: true, acting: true, previewTier: wanted }), true;
    }

    /*
     * ---- into SOMEBODY ELSE's account, on their invitation
     *
     * Three refusals, and each is a different failure:
     *
     *  - no grant, or an expired one: the door is shut. This is the promise.
     *  - their game is LIVE: you would be one mis-tap from ending somebody's
     *    night in front of sixty people. Support is for between gigs, and the
     *    refusal says so rather than just failing.
     *  - not a quizmaster: there is nothing to act as.
     */
    if (body.accountId) {
      const them = accounts.find(String(body.accountId));
      if (!them || them.role !== 'quizmaster') {
        return sendJson(res, 404, { error: 'No such quizmaster.' }), true;
      }
      if (!accounts.supportOpen(them.id)) {
        return sendJson(res, 403, {
          error: 'They have not let you in. Ask them to switch support access on from their account page — it is theirs to grant and it expires on its own.',
        }), true;
      }
      /*
       * `busy`, not `live` — and the difference is forty people.
       *
       * `live` means "past the lobby", so a room with forty players sitting in
       * a lobby with their team names typed in did not count as a night in
       * progress and support access was let straight in. The launch guard uses
       * the opposite standard (any joined player counts, lobby or not), and two
       * guards with two definitions of "somebody is mid-night" is how one of
       * them quietly becomes wrong.
       */
      if (rooms.get(them.id).busy) {
        return sendJson(res, 409, {
          error: 'They have a game up with people in it. Support access waits until the night is over — going in mid-round is one mis-tap from ending it.',
        }), true;
      }
      accounts.noteSupport(them.id, `${me.name || me.email} came in`);
      await backUpAccounts();
      res.setHeader('Set-Cookie', cookieFor(req, ACTING_COOKIE, them.id));
      return sendJson(res, 200, {
        ok: true, acting: true, support: true, account: accounts.view(them),
      }), true;
    }

    let hat = accounts.ownQuizmasterFor(me.id);
    if (!hat) {
      const [name, domain] = String(me.email).split('@');
      hat = accounts.create({
        // A + alias of the owner's own address: it is theirs, it is obviously
        // theirs in the account list, and it cannot collide with a real one.
        email: `${name}+quizmaster@${domain}`,
        password: randomBytes(24).toString('hex'),
        name: `${me.name || 'You'} (quizmaster)`,
        comped: true,
        status: 'active',
        ownedBy: me.id,
      });
      await backUpAccounts();
    }
    res.setHeader('Set-Cookie', cookieFor(req, ACTING_COOKIE, hat.id));
    return sendJson(res, 200, { ok: true, acting: true, account: accounts.view(hat) }), true;
  }

  /*
   * MOVE A FEATURE BETWEEN THE TIERS — the owner's buckets.
   *
   * Owner-only twice over: the `/api/owner/` prefix is in `OWNER_ONLY`, and
   * `FEATURES.SUBSCRIBERS` is checked here as well. This decides what every
   * account in the app is entitled to, so it is the one route where belt and
   * braces is proportionate.
   *
   * **The grandfathering is `setFeatureTier`'s job, not this route's**, so
   * there is one place that knows the rule and it is the place with the
   * accounts in it. What comes back is what it DID — which feature, from
   * where, to where, and how many people it protected — because "moved
   * Adverts to Gold, 3 accounts keep it" is the sentence the owner needs and
   * a bare ok is not.
   *
   * **Backed up like any account change**, and for the same reason: on a host
   * whose disk is wiped by every deploy, an unbacked ladder reverts silently
   * while every login survives.
   */
  if (route === '/api/owner/tiers' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    try {
      const done = accounts.setFeatureTier(String(body.feature || ''), String(body.tier || ''));
      await backUpAccounts();
      return sendJson(res, 200, { ok: true, ...done, featureTiers: accounts.featureTiers() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route === '/api/owner/accounts' && req.method === 'POST') {
    /*
     * The very first account is a special case, and only this one.
     *
     * Making an owner needed the command line, and Render's free tier has no
     * shell — so there was no way to create the first login on the live app at
     * all. A "set up the first owner" page open to the world is the thing
     * CLAUDE.md rules out, and rightly: it is a door that only ever needs
     * opening once and can be walked through by whoever finds it first.
     *
     * Gated on the HOST KEY it is neither. The host key already grants every
     * feature in the app, so this hands out nothing that holding it did not
     * already give you. The moment one account exists it goes back to being
     * owner-only, so the door closes behind you.
     */
    const first = accounts.all.length === 0 && isHostKey(req, url);
    if (!first && !allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    /*
     * INCLUDING THE VERY FIRST ACCOUNT, which is the OWNER'S — the one with
     * the most to lose in the whole system, and the one this check would be
     * daftest to skip.
     */
    if (await refuseBreached(res, body.password)) return true;
    try {
      const made = accounts.create({
        email: body.email,
        password: body.password,
        name: body.name,
        role: first ? 'owner' : 'quizmaster',
        plan: body.plan || 'basic',
        addons: body.addons || [],
        comped: Boolean(body.comped),
        status: body.status || 'trialing',
      });
      const backup = await backUpAccounts();
      return sendJson(res, 200, { account: made, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  /*
   * Reset somebody's password.
   *
   * The owner cannot READ a password — only a scrypt hash is stored, which is
   * the honest version of "your account is private from me" — so the only help
   * possible is setting a new one and telling them what it is. It signs
   * everything of theirs out, which `setPassword` already does and which is
   * right: a reset is usually somebody worried, and half-logged-out is no use.
   *
   * Its own route rather than a field on `update()`, deliberately. That method
   * is what a payment webhook talks to, and a webhook payload that could carry
   * a password is a door nobody meant to leave open.
   */
  /*
   * What a month of AI is allowed to cost.
   *
   * **It only ever draws a warning.** Nothing reads it to refuse a generation,
   * and that is deliberate rather than unfinished: a ceiling that stopped a job
   * would stop it halfway, when the money is already spent and the only thing
   * left to lose is the pack. Same reasoning as the expired-topical launch,
   * which warns and goes ahead.
   *
   * `/api/owner/` is already on OWNER_ONLY, so this needs no list of its own —
   * which is the trap that has caught six other routes going the other way.
   */
  if (route === '/api/owner/budget' && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    spend.setBudget(body.pence);
    backUpSpend();
    return sendJson(res, 200, { ok: true, budget: spend.budgetState() }), true;
  }

  /*
   * What the hosting costs a month — the cost the Money tab was leaving out.
   *
   * Same shape as the budget above it, on the same already-gated prefix, and
   * backed up the same way: the figure lives in the ledger file, which on a
   * free tier is gone after every deploy unless it is pushed.
   */
  if (route === '/api/owner/hosting' && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    const pence = spend.setHosting(body.pence);
    backUpSpend();
    return sendJson(res, 200, { ok: true, hosting: pence }), true;
  }

  if (route.startsWith('/api/owner/accounts/') && route.endsWith('/password') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const id = decodeURIComponent(route.slice('/api/owner/accounts/'.length, -'/password'.length));
    const body = await readJson(req);
    try {
      const changed = accounts.setPassword(id, String(body.password || ''));
      if (!changed) return sendJson(res, 404, { error: 'No account with that id' }), true;
      const backup = await backUpAccounts();
      return sendJson(res, 200, { ok: true, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/owner/accounts/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const id = decodeURIComponent(route.slice('/api/owner/accounts/'.length));
    try {
      const changed = req.method === 'DELETE' ? accounts.close(id) : accounts.update(id, await readJson(req));
      if (!changed) return sendJson(res, 404, { error: 'No account with that id' }), true;
      const backup = await backUpAccounts();
      return sendJson(res, 200, { account: changed, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  /*
   * The owner's own photo tab: file the rest away, bin one, clear the lot.
   *
   * The same three things the control view can do, reachable from a page rather
   * than from a running game — because the job here is the morning after, not
   * the night itself. They are separate routes rather than `/api/host/*` with a
   * wider gate on purpose: `/api/host/*` is the running of a night, an owner
   * runs none, and loosening that is how a guard quietly stops meaning what it
   * says.
   */
  if (route.startsWith('/api/owner/photos/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PHOTO_EXPORT)) return true;
    const what = route.slice('/api/owner/photos/'.length);
    const room = roomForHost(req, url);
    const { photos } = room;
    const body = await readJson(req);

    /*
     * A FEW AT A TIME, AND THE REQUEST STOPS WAITING — `fileTheRest()`. It used
     * to await sixty photos one after another, each with a twenty-second
     * deadline, so a slow morning held this request past every proxy on the
     * way to the browser. The job carries on either way; `still` tells the
     * page to look again rather than to report a failure that is not one.
     */
    if (what === 'file') {
      if (!photosRepoConfigured()) return sendJson(res, 200, { ok: false, reason: 'no_repo' }), true;
      const waiting = photos.unfiled().length;
      const done = await within(fileTheRest(room), FILE_REST_WAIT_MS);
      if (done.late) return sendJson(res, 200, { ok: true, still: true, waiting }), true;
      return sendJson(res, 200, { ok: true, filed: done.filed, failed: done.failed }), true;
    }
    if (what === 'remove') {
      const removed = photos.remove(String(body.id || ''));
      if (removed) pushState(room);
      return sendJson(res, 200, { ok: removed }), true;
    }
    if (what === 'clear') {
      const n = photos.clear();
      pushState(room);
      return sendJson(res, 200, { ok: true, cleared: n }), true;
    }
    return sendJson(res, 404, { error: 'Unknown action: ' + what }), true;
  }

  return false;
}
