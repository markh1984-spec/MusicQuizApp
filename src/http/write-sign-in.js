/**
 * WRITE ROUTES — sign-in. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { accounts, entitlements, magicEmail, path, resetEmail } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { SESSION_COOKIE, cookie, cookieFor, postALink, refuseBreached } from './identity.js';
import { backUpAccounts } from './helpers.js';

export async function writeSignIn(req, res, url, route) {
  if (route === '/api/sign-in' && req.method === 'POST') {
    const body = await readJson(req);
    const session = accounts.signIn(body.email, body.password);
    // One message for a wrong password and for an address with no account —
    // otherwise this page will happily tell anybody who has an account here.
    if (!session) return sendJson(res, 401, { error: 'That email address and password do not match.' }), true;
    const secure = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=${encodeURIComponent(session.token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${30 * 86400}`,
      ...(secure ? ['Secure'] : []),
    ].join('; '));
    /*
     * A SIGN-IN IS A THING TO BACK UP, and it was the one write that was not.
     *
     * A session is the SHA-256 of a token sitting in somebody's cookie, and it
     * lives in `data/accounts.json` — which on a host with no permanent disk is
     * empty again after every deploy. The accounts came back from the private
     * repo, but the backup was pushed the last time an ACCOUNT changed, which
     * is weeks before anybody signed in. So the cookie in the browser pointed
     * at a token the restored file had never heard of, and the whole app
     * answered 401 with nothing on screen saying why.
     *
     * It cost a live test mid-gig-day: a deploy landed between Launch and the
     * first press on the control view, and every button came back "wrong host
     * key" on a night that was running perfectly. `restore()` already keeps
     * sessions deliberately, for exactly this reason — the backup simply never
     * contained one.
     *
     * Awaited, because the whole point is that it is on disk in the repository
     * before the browser has the cookie. It can never throw: `backUpAccounts()`
     * catches everything and reports, so a GitHub having a bad morning makes a
     * sign-in slower — by `BACKUP_WAIT_MS` at most — and never refuses one.
     */
    await backUpAccounts();
    return sendJson(res, 200, {
      account: { ...session.account, entitlements: entitlements(session.account) },
    }), true;
  }



  /*
   * A SIGN-IN LINK, BECAUSE A PASSWORD YOU USE ONCE A WEEK IS A PASSWORD YOU
   * FORGET. Asked for after exactly that happened.
   *
   * **IT IS AN ADDITION AND MUST NOT BECOME A REPLACEMENT.** The password box
   * stays and stays first: this app is signed into ten minutes before a gig,
   * in a pub, on somebody else's wifi — and a way in that depends on an email
   * ARRIVING is the wrong only-way-in at exactly that moment. The link is for
   * the Monday when you cannot remember; the password is for the Wednesday
   * when you cannot wait.
   */
  if (route === '/api/magic/request' && req.method === 'POST') {
    const body = await readJson(req);
    return postALink(req, res, {
      email: String(body.email || '').trim(),
      kind: 'magic',
      path: '/magic',
      template: magicEmail,
    });
  }

  /*
   * SPENT BY A POST, NEVER BY OPENING THE LINK.
   *
   * `/magic` is a page with one button on it, and this is what the button
   * presses. A GET that signs you in reads as the obvious build and is a trap:
   * mail clients and corporate scanners FETCH the links in a message before a
   * human sees it, and a single-use link is then already spent when the person
   * it was sent to clicks it — locking out the one person it was meant to let
   * in, which is precisely the situation they were already in.
   */
  if (route === '/api/magic/use' && req.method === 'POST') {
    const body = await readJson(req);
    const done = accounts.useMagic(String(body.token || ''));
    if (!done) {
      return sendJson(res, 200, { ok: false,
        error: 'That link has been used already, or it has expired. Ask for another.' }), true;
    }
    res.setHeader('Set-Cookie', cookieFor(req, SESSION_COOKIE, done.token));
    await backUpAccounts();
    return sendJson(res, 200, { ok: true, to: done.account.role === 'owner' ? '/owner' : '/console' }), true;
  }

  if (route === '/api/reset/request' && req.method === 'POST') {
    const body = await readJson(req);
    return postALink(req, res, {
      email: String(body.email || '').trim(),
      kind: 'reset',
      path: '/reset',
      template: resetEmail,
    });
  }

  /** Is this link still good? Asked by the page before it offers a box. */
  if (route === '/api/reset/check' && req.method === 'POST') {
    const body = await readJson(req);
    const who = accounts.whoseReset(String(body.token || ''));
    return sendJson(res, 200, { ok: Boolean(who), email: who ? who.email : '' }), true;
  }

  /** Spend the link and set the new password. Single use — see `useReset`. */
  if (route === '/api/reset/complete' && req.method === 'POST') {
    const body = await readJson(req);
    if (await refuseBreached(res, body.password)) return true;
    try {
      const account = accounts.useReset(String(body.token || ''), String(body.password || ''));
      if (!account) {
        return sendJson(res, 400, {
          error: 'That link has been used already or has run out. Ask for a new one.',
        }), true;
      }
      await backUpAccounts();
      return sendJson(res, 200, { ok: true, email: account.email }), true;
    } catch (err) {
      // A password that is too short, said in words rather than as a 500.
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route === '/api/sign-out' && req.method === 'POST') {
    accounts.signOut(cookie(req, SESSION_COOKIE));
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    // The other half of backing a sign-in up: without this the next deploy
    // restores a backup that still holds the session somebody just ended, so
    // signing out would quietly un-sign-out on the following restart.
    await backUpAccounts();
    return sendJson(res, 200, { ok: true }), true;
  }

  return false;
}
