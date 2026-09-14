/**
 * Signing in.
 *
 * Deliberately the plainest page in the app. It gets used once a month, often
 * on a phone in a car park, sometimes on somebody else's laptop — so it is one
 * form, one button, and an error message that says what to do next.
 *
 * The token never comes near this file: the server sets an httpOnly cookie, so
 * nothing on the page can read it and nothing on the page can leak it.
 */

import { brandMark, brandWords } from './client.js';

const form = document.getElementById('signIn');
const problem = document.getElementById('problem');

// Arriving from a reset: the address is already known, so do not make somebody
// type it again on the one screen where they have just proved they own it.
const came = new URL(location.href).searchParams.get('email');
if (came) {
  form.elements.email.value = came;
  problem.textContent = 'Password saved. Sign in with the new one.';
  problem.classList.add('said');
}

fetch('/api/brand')
  .then((r) => r.json())
  .then((d) => {
    const slot = document.getElementById('brandSlot');
    slot.innerHTML = `${brandMark(30)}${brandWords(d.name, d.appName || '')}`;
    document.title = `Sign in — ${d.name}`;
  })
  .catch(() => { /* the form works perfectly well without a logo on it */ });

// Already signed in? Do not make somebody type a password to find that out.
fetch('/api/me')
  .then((r) => r.json())
  .then((d) => { if (d.signedIn) location.replace(landingFor(d.account)); })
  .catch(() => {});

/** The owner and a quizmaster want completely different pages. */
function landingFor(account) {
  const wanted = new URL(location.href).searchParams.get('next');
  // Only ever somewhere on this site — an open redirect on a sign-in page is
  // how a convincing fake gets a password.
  if (wanted && wanted.startsWith('/') && !wanted.startsWith('//')) return wanted;
  return account.role === 'owner' ? '/owner' : '/console';
}

/*
 * "Forgotten your password?"
 *
 * Opens under the sign-in form rather than on a page of its own: somebody who
 * has just been told their password is wrong is already here with the address
 * typed, and a page change would lose it. Pressing it carries the address
 * across for the same reason.
 *
 * THE REPLY IS THE SAME WHETHER OR NOT THE ADDRESS IS KNOWN, and this page must
 * not undo that by looking different — the sign-in error above it goes to some
 * trouble not to confirm who has an account here. The one thing it does report
 * is the server saying nothing was actually SENT, because the person asking is
 * already locked out and "check your inbox" for an email that never left is
 * how an evening goes.
 */
const forgotForm = document.getElementById('forgotForm');
const forgotSaid = document.getElementById('forgotSaid');

document.getElementById('forgot').addEventListener('click', (e) => {
  forgotForm.hidden = false;
  /*
   * THE WHOLE LINE GOES, NOT JUST THE BUTTON IN IT. Hiding the button alone
   * left its `<p>` behind — an empty paragraph with its own margins, which
   * renders as a hole between Sign in and the form that just opened.
   */
  (e.currentTarget.closest('p') || e.currentTarget).hidden = true;
  forgotForm.elements.email.value = form.elements.email.value.trim();
  forgotForm.elements.email.focus();
});

/**
 * TWO KINDS OF LINK, ONE FORM AND ONE STATUS LINE.
 *
 * A sign-in link and a password reset differ in the route they post to and in
 * nothing else a person can see — same address box, same throttle, same reply,
 * same reason a failure is said out loud rather than swallowed. So they share
 * the form rather than growing a second one beside it, and which button was
 * pressed is the only thing that varies.
 */
async function askForALink(route, button, label) {
  button.disabled = true;
  const was = button.textContent;
  button.textContent = 'Sending…';
  forgotSaid.textContent = '';
  try {
    const res = await fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotForm.elements.email.value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    const failed = data.ok === false;
    forgotSaid.textContent = failed ? (data.error || 'That did not send.') : data.sent;
    // `said` is the good-news look. The box is shared with the sign-in error,
    // and "a link is on its way" inside a red slab reads as a failure to
    // somebody who has just been locked out — which is who is reading it.
    forgotSaid.classList.toggle('said', !failed);
  } catch {
    forgotSaid.textContent = 'Could not reach the server. Try again in a moment.';
    forgotSaid.classList.remove('said');
  }
  button.disabled = false;
  button.textContent = label || was;
}

/*
 * The SUBMIT is the sign-in link, because that is the one somebody pressing
 * "forgotten your password" actually wants: it gets them in and changes
 * nothing. Pressing Enter in the address box lands here too, which is the
 * right default.
 */
forgotForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!forgotForm.elements.email.value.trim()) return;
  askForALink('/api/magic/request', document.getElementById('wantMagic'), 'Email me a sign-in link');
});

document.getElementById('wantReset').addEventListener('click', () => {
  // `reportValidity`, because this button is outside the submit path and would
  // otherwise post an empty address and get the deliberately-identical "if
  // that address has an account" reply — which reads as working.
  if (!forgotForm.reportValidity()) return;
  askForALink('/api/reset/request', document.getElementById('wantReset'), 'Set a new password instead');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Signing in…';
  problem.textContent = '';

  try {
    const res = await fetch('/api/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not sign in.');
    location.replace(landingFor(data.account));
  } catch (err) {
    problem.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Sign in';
    form.elements.password.value = '';
    form.elements.password.focus();
  }
});
