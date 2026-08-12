/**
 * Sending an email, and nothing else.
 *
 * Plain `fetch` at whichever provider has a key set. There are official SDKs
 * for both and neither is used, for the reason every other dependency here is
 * not used: a package is something that can break on a gig night, and this is
 * one POST with one header.
 *
 * WHAT THIS IS FOR, and what it is deliberately not. The host asked for
 * exactly one thing: a link that lets a quizmaster set a new password. It
 * exists because there was NO WAY BACK IN — the reset route needs an account
 * id, an owner's own account is not in the subscriber list, and Render's free
 * tier has no shell. So a lost password was a locked door with nothing behind
 * it. **Do not grow this into notifications, reminders or marketing.** Those
 * were discussed and parked in TODO.md, they want a different sending domain,
 * and a quizmaster who gets a surprise email from the app they run their
 * livelihood on will not thank anybody.
 *
 * NOBODY PICKS A PROVIDER ON A BUTTON — the same rule `artProvider()` follows
 * for the picture round. Whichever key is set is the one used, and if both
 * are, Brevo wins because it is the one that can hold this app's own sending
 * domain for nothing. Resend's free tier allows a single domain, and the host
 * already spends it on another project; a second is $20 a month, which is a
 * lot for the five password resets a year this will actually send.
 *
 * THREE RULES, all of which have bitten something else in this codebase:
 *
 *  - **Never fatal.** A reset request that 500s because a mail provider is
 *    having a bad morning tells the person locked out precisely nothing.
 *    Every path here resolves; the worst case is `{ ok: false, reason }`.
 *  - **Say what went wrong, in words.** The reason comes back from the
 *    provider and is passed through, because "it did not send" is the message
 *    that costs an evening. The commonest one by a mile is a sending domain
 *    that has not been authenticated, and that is worth recognising by name.
 *  - **Not configured is a STATE, not a failure.** With no key the app must
 *    behave exactly as it did before this file existed, and say so on the page
 *    rather than offering a button that cannot work.
 */

const PROVIDERS = {
  brevo: {
    url: 'https://api.brevo.com/v3/smtp/email',
    key: () => process.env.BREVO_API_KEY,
    headers: (key) => ({ 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' }),
    body: ({ from, to, subject, text, html }) => ({
      sender: { name: from.name || 'Quizporium', email: from.email },
      to: [{ email: to }],
      subject,
      textContent: text,
      ...(html ? { htmlContent: html } : {}),
    }),
    id: (body) => body.messageId || '',
  },
  resend: {
    url: 'https://api.resend.com/emails',
    key: () => process.env.RESEND_API_KEY,
    headers: (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }),
    body: ({ from, to, subject, text, html }) => ({
      from: from.name ? `${from.name} <${from.email}>` : from.email,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
    id: (body) => body.id || '',
  },
};

/** Which provider is set up, or '' for none. Brevo first — see above. */
export function emailProvider() {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.RESEND_API_KEY) return 'resend';
  return '';
}

/** Is there a key AND an address to send from? Both, or nothing goes out. */
export function emailConfigured() {
  return Boolean(emailProvider() && fromAddress().email);
}

/**
 * Who the email comes from, as a name and an address.
 *
 * `EMAIL_FROM` is the one to set and wins outright, so the sending address can
 * be changed without a deploy. `RESEND_FROM` is still read because it was the
 * name before there were two providers and a live server may have it set —
 * quietly ignoring it would be a silent outage on the one feature whose whole
 * job is getting somebody back in. Failing that it is built from the app's own
 * domain, which is the one the provider will have been asked to authenticate.
 */
export function fromAddress() {
  const said = process.env.EMAIL_FROM || process.env.RESEND_FROM || '';
  if (said) {
    // "Quizporium <no-reply@quizporium.co.uk>" or a bare address. Brevo wants
    // the two halves separately, so they are split here rather than in one
    // provider's own code.
    const angled = said.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    if (angled) return { name: angled[1].replace(/^"|"$/g, ''), email: angled[2].trim() };
    return { name: '', email: said.trim() };
  }
  const host = (process.env.PUBLIC_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  return host ? { name: 'Quizporium', email: `no-reply@${host}` } : { name: '', email: '' };
}

/**
 * Send one email. Resolves either way — see the rules above.
 *
 * `fetchImpl` is injected so the tests can pin each provider's request shape
 * without a network, which is the only way to check it from here: this
 * container's egress reaches neither, so "it worked when I tried it" is not
 * available and the request has to be verified against a stub instead.
 */
export async function sendEmail({ to, subject, text, html = '' }, { fetchImpl = fetch } = {}) {
  const which = emailProvider();
  const from = fromAddress();
  if (!which || !from.email) {
    return { ok: false, reason: 'Email is not set up on this server.', unconfigured: true };
  }
  if (!to || !subject || !text) return { ok: false, reason: 'An address, a subject and a message.' };

  const provider = PROVIDERS[which];
  try {
    const res = await fetchImpl(provider.url, {
      method: 'POST',
      headers: provider.headers(provider.key()),
      body: JSON.stringify(provider.body({ from, to, subject, text, html })),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, id: provider.id(body), provider: which };
    return { ok: false, reason: explain(which, res.status, body), provider: which };
  } catch (err) {
    return { ok: false, reason: `Could not reach ${which}: ${err.message}`, provider: which };
  }
}

/**
 * Turn a refusal into something somebody can act on.
 *
 * Same rule as the Spotify 403 and Imagen's `includeRaiReason`: a bare status
 * code sends you looking in the wrong place. A sending domain that has not
 * been authenticated is far and away the commonest failure when this is first
 * set up, and both providers say so in a way that is easy to miss among the
 * rest of the payload.
 */
function explain(which, status, body) {
  const said = String((body && (body.message || body.error || body.name)) || '').trim();
  const keyName = which === 'brevo' ? 'BREVO_API_KEY' : 'RESEND_API_KEY';
  if (status === 401 || status === 403) {
    return `${which} refused the API key (${status})${said ? ` — ${said}` : ''}. Check ${keyName}.`;
  }
  if (/not verified|unrecognised sender|sender.*not.*valid|domain/i.test(said)) {
    return `${said} — the sending domain has to be authenticated with ${which} before anything will go out.`;
  }
  if (status === 400 || status === 422) return `${which} would not accept the message${said ? ` — ${said}` : ''}.`;
  if (status === 429) return `${which} is rate limiting; try again in a minute.`;
  return said || `${which} answered ${status}.`;
}
