/**
 * Sending an email, and nothing else.
 *
 * Resend over plain `fetch` — one POST with one header. There is an official
 * SDK and it is not used, for the reason every other dependency here is not
 * used: a package is something that can break on a gig night, and this is
 * twenty lines.
 *
 * WHAT THIS IS FOR, and what it is deliberately not. The host asked for
 * exactly one thing: a link that lets a quizmaster set a new password. It
 * exists because there was NO WAY BACK IN — the reset route needs an account
 * id, an owner's own account is not in the subscriber list, and Render's free
 * tier has no shell. So a lost password was a locked door with nothing behind
 * it. **Do not grow this into notifications, reminders or marketing.** Those
 * were discussed and parked in TODO.md, they are a different account and a
 * different sending domain, and a quizmaster who gets a surprise email from
 * the app they run their livelihood on will not thank anybody.
 *
 * THREE RULES, all of which have bitten something else in this codebase:
 *
 *  - **Never fatal.** A reset request that 500s because a mail provider is
 *    having a bad morning tells the person locked out precisely nothing.
 *    Every path here resolves; the worst case is `{ ok: false, reason }`.
 *  - **Say what went wrong, in words.** The reason comes back from Resend and
 *    is passed through, because "it did not send" is the message that costs an
 *    evening. The commonest one by a mile is a sending domain that has not
 *    been verified, and that is worth recognising by name.
 *  - **Not configured is a STATE, not a failure.** Without a key the app must
 *    behave exactly as it did before this file existed, and say so on the page
 *    rather than offering a button that cannot work.
 */

const API = 'https://api.resend.com/emails';

/** Is there a key and an address to send from? */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && fromAddress());
}

/**
 * Who the email comes from.
 *
 * `RESEND_FROM` wins so the sending address can be changed without a deploy.
 * The fallback is built from the app's own domain, which is the one Resend
 * will have been asked to verify.
 */
export function fromAddress() {
  if (process.env.RESEND_FROM) return process.env.RESEND_FROM;
  const url = process.env.PUBLIC_URL || '';
  const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  return host ? `Quizporium <no-reply@${host}>` : '';
}

/**
 * Send one email. Resolves either way — see the rules above.
 *
 * `fetchImpl` is injected so the tests can pin the request shape without a
 * network, which is the only way to check it from here: this container's
 * egress does not reach Resend, so "it worked when I tried it" is not
 * available and the request has to be verified against a stub instead.
 */
export async function sendEmail({ to, subject, text, html = '' }, { fetchImpl = fetch } = {}) {
  if (!emailConfigured()) return { ok: false, reason: 'Email is not set up on this server.', unconfigured: true };
  if (!to || !subject || !text) return { ok: false, reason: 'An address, a subject and a message.' };

  try {
    const res = await fetchImpl(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, text, ...(html ? { html } : {}) }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, id: body.id || '' };
    return { ok: false, reason: explain(res.status, body) };
  } catch (err) {
    return { ok: false, reason: `Could not reach the mail service: ${err.message}` };
  }
}

/**
 * Turn a refusal into something somebody can act on.
 *
 * Same rule as the Spotify 403 and Imagen's `includeRaiReason`: a bare status
 * code sends you looking in the wrong place. An unverified sending domain is
 * far and away the commonest failure when this is first set up, and Resend
 * says so in a way that is easy to miss among the rest of the payload.
 */
function explain(status, body) {
  const said = String((body && (body.message || body.error || body.name)) || '').trim();
  if (status === 401 || status === 403) {
    return `Resend refused the API key (${status})${said ? ` — ${said}` : ''}. Check RESEND_API_KEY.`;
  }
  if (/domain is not verified|not verified/i.test(said)) {
    return `${said} — the sending domain has to be verified in Resend before anything will go out.`;
  }
  if (status === 422) return `Resend would not accept the message${said ? ` — ${said}` : ''}.`;
  if (status === 429) return 'Resend is rate limiting; try again in a minute.';
  return said || `Resend answered ${status}.`;
}
