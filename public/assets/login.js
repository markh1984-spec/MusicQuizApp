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

document.getElementById('forgot').addEventListener('click', () => {
  forgotForm.hidden = false;
  document.getElementById('forgot').hidden = true;
  forgotForm.elements.email.value = form.elements.email.value.trim();
  forgotForm.elements.email.focus();
});

forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = forgotForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Sending…';
  forgotSaid.textContent = '';
  try {
    const res = await fetch('/api/reset/request', {
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
  button.textContent = 'Email me a link';
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
