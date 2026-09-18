/**
 * WRITE ROUTES — group. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { HOUSE, PAYING, accounts, can, config, emailConfigured, http, randomBytes, rooms, sendEmail, welcomeEmail } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { brandForRoom, whoIs } from './identity.js';
import { MAX_SEATS } from './support-log.js';
import { backUpAccounts } from './helpers.js';

export async function writeGroup(req, res, url, route) {
  /*
   * ---- group accounts: a company or a pub group, seats under a parent
   *
   * A parent is DERIVED, never stored — any quizmaster becomes one the
   * moment they add a first seat. So there is no "create a group" route,
   * only "add a seat" and "remove a seat". See CLAUDE.md's Owner/Parent/
   * Child section and `docs/business/groups.md`.
   *
   * EVERY ROUTE HERE RESOLVES FROM `whoIs()`, NEVER FROM AN ID IN THE
   * REQUEST — the identical rule `/api/host/*` follows for rooms. A group
   * id taken from the body would be a door into somebody else's seats; the
   * only door here is "my own account's own children".
   */
  if (route === '/api/group/seats' && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (me.bootstrap) return sendJson(res, 400, { error: 'The host key is not an account, so there is no group to add a seat to.' }), true;
    if (me.role === 'owner') return sendJson(res, 400, { error: 'The owner account does not run a group.' }), true;
    if (me.parentId) return sendJson(res, 400, { error: 'You are a seat in somebody else’s group, so you cannot have seats of your own.' }), true;
    /*
     * A SEAT IS A PAID THING, AND THIS ROUTE HAD NO GATE AT ALL.
     *
     * Found by a sweep and reproduced in five calls: a `past_due` account
     * whose grace night was already spent — correctly 403ing on launch —
     * added a seat, read the reset link out of THIS reply, deleted the seat
     * (which left the ex-seat an ordinary `active` Bronze account), set a
     * password and launched a night. **The whole subscription gate walked
     * round by a route on My account.** So: in good standing to add one, and
     * `removeChild()` no longer hands out a paying account on the way out.
     *
     * Not a `FEATURES` flag, deliberately — which tier may run a group is a
     * pricing question nobody has answered, and inventing an answer here
     * would put it in the ladder by accident. This asks the one thing that
     * is not in doubt: are you paying.
     */
    if (!me.comped && !PAYING.has(me.status)) {
      return sendJson(res, 402, {
        error: 'Seats need a live subscription. Sort the payment out and you can add them again.',
        upgrade: true,
      }), true;
    }
    /*
     * AND A CEILING, because there was none: one signed-in account could mint
     * accounts in a loop. **A SAFETY number, not a design one** — the same
     * distinction `MAX_TEAMS` records. A pub group with more than fifty
     * venues is a conversation, not a form submission.
     */
    if (accounts.childrenOf(me.id).length >= MAX_SEATS) {
      return sendJson(res, 400, { error: `A group holds up to ${MAX_SEATS} seats. Get in touch if you need more.` }), true;
    }
    const body = await readJson(req);
    let created;
    try {
      /*
       * A SEAT CHOOSES ITS OWN PASSWORD — the identical mechanism `/api/signup`
       * already uses for exactly the same reason: a random one is set and
       * immediately thrown away, then the magic-link reset flow sends them
       * somewhere to set a real one. One proven "prove you own this address"
       * path, not a second one invented here that could drift from it — and
       * it means the parent adding a seat never sees, types or holds a
       * password that is not their own.
       */
      created = accounts.addChild(me.id, { email: body.email, password: randomBytes(24).toString('hex'), name: body.name });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    await backUpAccounts();

    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const started = accounts.startReset(created.email);
    const link = started && started.token ? `${base}/reset?t=${encodeURIComponent(started.token)}` : '';
    if (link && emailConfigured()) {
      const brandName = brandForRoom(rooms.get(HOUSE));
      sendEmail({ to: created.email, ...welcomeEmail({ name: brandName, link }) })
        .catch((err) => console.warn('[group] could not email the new seat:', err.message));
    }
    return sendJson(res, 200, {
      seat: created,
      // Only when there is no email service to hand the link to the SEAT the
      // ordinary way — same fallback /api/signup already relies on. Shown to
      // the parent only because there is nobody else to show it to yet; once
      // email is configured this never reaches them.
      ...(!emailConfigured() && link ? { devLink: link } : {}),
    }), true;
  }

  if (route.startsWith('/api/group/seats/') && req.method === 'DELETE') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const childId = decodeURIComponent(route.slice('/api/group/seats/'.length));
    // THE SCOPING CHECK: only ever a seat that is actually one of MINE.
    // Without this, any signed-in account could unlink any other account
    // from its group just by knowing its id.
    const parent = accounts.parentOf(childId);
    if (!parent || parent.id !== me.id) return sendJson(res, 404, { error: 'No such seat in your group.' }), true;
    accounts.removeChild(childId);
    await backUpAccounts();
    return sendJson(res, 200, { ok: true }), true;
  }

  return false;
}
