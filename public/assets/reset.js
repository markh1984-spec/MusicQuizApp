/**
 * Setting a new password from an emailed link.
 *
 * The token lives in the address and nowhere else — it is never written to
 * localStorage and never put in a link out of this page. It is checked with
 * the server before a box is offered, so somebody who clicks a link that has
 * run out is told so instead of typing a password twice for nothing.
 */

import { brandMark, brandWords } from './client.js';

const token = new URL(location.href).searchParams.get('t') || '';
const form = document.getElementById('setPw');
const problem = document.getElementById('problem');
const who = document.getElementById('who');
const dud = document.getElementById('dud');

fetch('/api/brand')
  .then((r) => r.json())
  .then((d) => {
    document.getElementById('brandSlot').innerHTML = `${brandMark(30)}${brandWords(d.name, d.appName || '')}`;
    document.title = `New password — ${d.name}`;
  })
  .catch(() => { /* the form works perfectly well without a logo on it */ });

/*
 * Ask first, so a dead link is a sentence rather than a rejected form.
 *
 * The address is shown back because a reset link is opened on whatever device
 * the inbox is on, often days later — seeing WHICH account this is about is
 * the difference between confidence and a guess.
 */
fetch('/api/reset/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
})
  .then((r) => r.json())
  .then((d) => {
    if (!d.ok) { dud.hidden = false; return; }
    who.textContent = `For ${d.email}`;
    form.hidden = false;
    form.elements.password.focus();
  })
  .catch(() => { dud.hidden = false; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  problem.textContent = '';
  const password = form.elements.password.value;
  // Checked here as well as on the server, because typing a long password
  // twice and being told at the end is a small cruelty.
  if (password !== form.elements.again.value) {
    problem.textContent = 'Those two are not the same.';
    return;
  }
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const res = await fetch('/api/reset/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'That did not save.');
    // Straight to the sign-in page with the address filled in. Setting a
    // password does NOT sign you in: every session is dropped when it changes,
    // which is what somebody who has just had to reset one wants, and a link
    // in an inbox should not be a way to be signed in by clicking it.
    location.replace(`/login?email=${encodeURIComponent(data.email || '')}`);
  } catch (err) {
    problem.textContent = err.message;
    button.disabled = false;
    button.textContent = 'Save it and sign in';
  }
});
