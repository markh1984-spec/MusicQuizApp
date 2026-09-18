/**
 * WRITE ROUTES — me-and-signup. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, HOUSE, KINDS, PACK_REQUEST_KIND, REFERRAL_BONUS_DAYS, TIERS, TRIAL_DAYS, accounts, can, config, emailConfigured, http, randomBytes, rooms, sendEmail, suggestions, welcomeEmail } from './context.js';
import { isLocalRequest, readJson, sendJson, signupAllowed } from './plumbing.js';
import { brandForRoom, roomIdFor, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { pushState } from './views.js';
import { backUpAccounts, backUpSuggestions } from './helpers.js';

export async function writeMeAndSignup(req, res, url, route) {
  /*
   * Your own two colours.
   *
   * Yours and only yours — the account is read off the cookie, and there is no
   * id in the request, so this cannot repaint anybody else's projector. It sits
   * up here with the other `/api/me` routes rather than behind a feature gate
   * because it is nobody's paid extra: it costs nothing to run, which under the
   * host's own tier rule makes it Basic, and an owner needs it too.
   *
   * The host key has no account to save it against, so it is told so plainly
   * rather than silently doing nothing.
   */
  if (route === '/api/me/scheme' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 401, { error: 'Sign in first' }), true;
    if (account.bootstrap) {
      return sendJson(res, 400, {
        error: 'The host key is not an account, so there is nothing to save a colour against. Sign in to pick one.',
      }), true;
    }
    const body = await readJson(req);
    const saved = accounts.setScheme(account.id, body.scheme);
    if (!saved) return sendJson(res, 404, { error: 'No such account' }), true;
    await backUpAccounts();
    // Everything already on a screen in this room, repainted where it stands —
    // the projector and every phone, without anybody reloading anything.
    pushState(rooms.get(roomIdFor(account)));
    return sendJson(res, 200, { ok: true, scheme: saved.scheme }), true;
  }

  /*
   * What you choose to LOOK at — never what you are allowed to do.
   *
   * A quizmaster who never invoices does not want an Invoices tab, and that is
   * all this is. It can only ever HIDE something the account already has:
   * `allowed()` does not read prefs and never will, so there is no way for a
   * setting on this page to hand anybody a feature. See `setPrefs()`.
   */
  /*
   * ---- the suggestion box
   *
   * One box, three kinds, no ceremony. Open to anybody signed in and to the
   * host key, because the people most worth hearing from are the ones having
   * the worst time — and a feedback route behind a paywall hears only from
   * people who are already happy enough to have paid for the top tier.
   */
  if (route === '/api/suggestions' && req.method === 'POST') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const body = await readJson(req);
    const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : 'idea';

    /*
     * Sending is open to anybody signed in and is deliberately NOT gated on a
     * tier — the people most worth hearing from are the ones having the worst
     * time, who are the least likely to be on the top rung.
     *
     * A pack request is the one exception, because it is a claim on the
     * owner's writing time rather than a message. Checked HERE and not left to
     * the console not drawing the option: a kind is one word in a request
     * body, which is exactly the shape of the hole `POST /api/quiz` had.
     */
    if (kind === PACK_REQUEST_KIND) {
      if (!allowed(req, res, url, FEATURES.REQUEST_PACK)) return true;
      const state = suggestions.packRequestStatus(me.id || '');
      if (!state.mayAsk) {
        const when = new Date(state.nextAllowedAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', timeZone: 'Europe/London',
        });
        return sendJson(res, 409, {
          error: state.open
            ? `You already have one on the list — "${state.open.text.slice(0, 60)}". That one gets written first.`
            : `That is this month's. You can ask for the next one from ${when}.`,
          waiting: true,
          state,
        }), true;
      }
    }

    const result = suggestions.add({
      text: body.text,
      kind,
      by: me.name || me.email || 'the host key',
      byId: me.id || '',
      where: body.where,
    });
    if (!result.ok) return sendJson(res, 400, { error: result.error }), true;
    backUpSuggestions();
    return sendJson(res, 200, { ok: true, suggestion: result.suggestion }), true;
  }

  /*
   * ---- /signup — a REAL account, self-serve, public, no key.
   *
   * LOW FRICTION ON PURPOSE: a name and an email, nothing else. Everything
   * else a quizmaster might set up — a venue, their colours, their calendar —
   * is a job for the account itself, once they are in it, not a form standing
   * between a visitor and trying the app.
   *
   * **It does not take money and must not start to.** Payment is Stripe
   * Checkout, reached from the ladder on My account once somebody is in — so
   * this creates the account on Bronze, `trialing`, exactly the shape
   * `accounts.create()` already defaults to. THE PASSWORD
   * IS NEVER TYPED HERE: a random one is set at creation and immediately
   * thrown away, then the same magic-link mechanism a forgotten password
   * uses (`startReset` / `/reset`) sends them a link to set a real one. One
   * proven path for "prove you own this address and set a password", used by
   * both a reset and a signup, rather than a second one invented here that
   * could drift from it.
   */
  if (route === '/api/signup' && req.method === 'POST') {
    /*
     * HELD AT THE DOOR, AND UNLIKE A JOIN THIS ONE MAY BE REFUSED.
     *
     * Account creation was unbounded, and each signup fires TWO emails off the
     * owner's provider quota — the welcome and the "somebody signed up" note.
     * A script could fill the accounts book, burn the quota, and RESERVE
     * addresses it does not own, because `create()` throws on a duplicate.
     *
     * **The asymmetry is the OPPOSITE of the join gate's, which is why a
     * refusal is right here and wrong there.** A phone joining is standing in a
     * room with the host on a mic, so being asked to wait stops a show — rule 4
     * holds it rather than turning it away. Nobody signing up is mid-gig: "try
     * again shortly" costs a stranger a minute and costs the business nothing.
     *
     * **What it does NOT cover, said rather than implied**: a flood from many
     * addresses. That wants the email provider's own limits and a captcha,
     * neither of which is worth adding before there is a first subscriber.
     */
    if (!signupAllowed(req)) {
      return sendJson(res, 429, {
        error: 'That is a lot of new accounts from one place. Try again shortly.',
      }), true;
    }
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    if (!name) return sendJson(res, 400, { error: 'A name is needed.' }), true;

    let made;
    try {
      made = accounts.create({
        email,
        password: randomBytes(24).toString('hex'),
        name,
        role: 'quizmaster',
        tier: 'bronze',
        status: 'trialing',
        // A bad or stale code is dropped rather than refused — see the note
        // in accounts.create(). This is a query-string param a stranger can
        // edit; it must never be able to fail a real signup.
        referredBy: String(body.ref || '').trim(),
        /*
         * WHICH RUNG THEY PRESSED ON THE WAY IN — a NOTE OF INTENT, and it is
         * deliberately NOT `tier`.
         *
         * The sales page has a button per rung, so somebody who pressed "Start
         * on Gold" has told you something worth keeping: before payments exist
         * it is the only signal about what people actually want, and once
         * Stripe is wired it is what they should be offered rather than asked
         * again.
         *
         * **IT MUST NEVER BECOME `tier`.** That field is what the app grants,
         * and it is set to bronze above. Reading a rung out of a request body
         * and granting it would hand anybody Gold for nothing — a stranger can
         * type `?tier=gold` as easily as press it, which is the same shape as
         * the pack id that had to be re-checked at the launch route. Validated
         * against the real ladder so a junk value is dropped rather than kept.
         */
        wantedTier: TIERS.some((t) => t.id === String(body.tier || ''))
          ? String(body.tier) : '',
      });
    } catch (err) {
      // "There is already an account with that email address" arrives here
      // in the same words `accounts.create()` already uses everywhere else.
      return sendJson(res, 400, { error: err.message }), true;
    }
    await backUpAccounts();

    // See the note on the same fallback in /api/reset/request — no proxy
    // header means the connection really is plain HTTP, so 'http' is the
    // honest default rather than 'https'.
    const base = (config.publicUrl || '').replace(/\/+$/, '')
      || `${(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${req.headers.host}`;
    const started = accounts.startReset(email);
    const link = started && started.token ? `${base}/reset?t=${encodeURIComponent(started.token)}` : '';

    if (link && emailConfigured()) {
      const brandName = brandForRoom(rooms.get(HOUSE));
      sendEmail({ to: email, ...welcomeEmail({ name: brandName, link }) })
        .catch((err) => console.warn('[signup] could not email the new account:', err.message));
    }
    // Best-effort only, and never lets a visitor's own signup fail on it —
    // the account already exists by this point regardless of whether Mark
    // gets told about it straight away.
    if (emailConfigured() && accounts.owner && accounts.owner.email) {
      sendEmail({
        to: accounts.owner.email,
        subject: `New signup — ${name}`,
        text: `${name} <${email}> just signed up on Bronze, trialing.`,
      }).catch((err) => console.warn('[signup] could not notify the owner:', err.message));
    }

    return sendJson(res, 200, {
      ok: true,
      referred: Boolean(made.referredBy),
      trialDays: made.referredBy ? TRIAL_DAYS + REFERRAL_BONUS_DAYS : TRIAL_DAYS,
      /*
       * THE LINK ONLY COMES BACK IN THE BODY ON A LOCAL RUN.
       *
       * It used to come back whenever no provider was configured — including on
       * the deployed app, where it meant **anybody could create AND activate an
       * account on an address they do not own**, the magic link being the only
       * thing standing in for verifying it. `signup.js`'s own comment said this
       * was "not something the live app hands out", which is the third sighting
       * of a comment claiming the opposite of the code.
       *
       * A deployed app has a proxy in front of it, so `isLocalRequest()` is the
       * honest test rather than an env var somebody can forget to set. When
       * there is no provider AND this is not local the account is still MADE —
       * losing it would reserve the address with nothing to show for it — and
       * `noEmail` tells them to get in touch instead of leaving them on a
       * "check your inbox" screen for a message nobody sent.
       */
      ...(!emailConfigured() && link && isLocalRequest(req) ? { devLink: link } : {}),
      ...(!emailConfigured() && !isLocalRequest(req) ? { noEmail: true } : {}),
    }), true;
  }

  return false;
}
