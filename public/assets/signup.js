/**
 * The signup page — opens a REAL account, low friction: a name and an email,
 * nothing else. See the `/api/signup` route in server.js for why the password
 * is never typed here: a magic link does that, the same mechanism a
 * forgotten password already uses.
 *
 * A referral rides in the URL — `?ref=<accountId>` — and is passed straight
 * through in the POST body. A bad or missing one is not this page's problem
 * to validate; the server drops anything it cannot use.
 *
 * **`?tier=` rides the same way, and for the same reason it is not checked
 * here.** The sales page has a button per rung, so this carries which one was
 * pressed. It is a NOTE OF INTENT and never a grant — the server records it as
 * `wantedTier` and starts everybody on bronze regardless, because a rung read
 * out of a request body would hand anybody Gold for nothing.
 */

const form = document.getElementById('signupForm');
const problem = document.getElementById('problem');
const formState = document.getElementById('formState');
const doneState = document.getElementById('doneState');
const doneText = document.getElementById('doneText');

const ref = new URL(location.href).searchParams.get('ref') || '';
const tier = new URL(location.href).searchParams.get('tier') || '';
if (ref) {
  const note = document.getElementById('referralNote');
  if (note) note.hidden = false;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  problem.textContent = '';
  const btn = form.querySelector('button');
  btn.disabled = true;
  const data = Object.fromEntries(new FormData(form).entries());
  if (ref) data.ref = ref;
  if (tier) data.tier = tier;
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) {
      problem.textContent = body.error || 'Something went wrong — try again in a moment.';
      btn.disabled = false;
      return;
    }
    const trialLine = body.referred
      ? `You were referred, so your trial is ${body.trialDays} days.`
      : `Your trial runs for ${body.trialDays} days.`;
    /*
     * THREE ANSWERS, and the middle one used to be missing.
     *
     * `devLink` now only comes back on a LOCAL run — handing a password link out
     * in the response body on the deployed app meant anybody could activate an
     * account on an address they do not own. `noEmail` is the case that was
     * silently falling through to "check your email" for a message nobody sent:
     * the account IS made, so the honest line says to get in touch rather than
     * leaving somebody watching an inbox.
     */
    doneText.innerHTML = body.devLink
      ? `${trialLine} No email is set up here — <a href="${body.devLink}">set your password</a> to finish.`
      : body.noEmail
        ? `${trialLine} Your account is made, but email is not set up on this app yet — get in touch and we will send you a link to set a password.`
        : `${trialLine} Check your email for a link to set a password — it lasts 30 minutes.`;
    formState.hidden = true;
    doneState.hidden = false;
  } catch {
    problem.textContent = 'Could not reach the server — check your connection and try again.';
    btn.disabled = false;
  }
});
