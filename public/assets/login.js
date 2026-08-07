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

import { brandMark } from './client.js';

const form = document.getElementById('signIn');
const problem = document.getElementById('problem');

fetch('/api/brand')
  .then((r) => r.json())
  .then((d) => {
    const slot = document.getElementById('brandSlot');
    slot.innerHTML = `${brandMark(30)}<span class="brand-name">${d.name}</span>`;
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
