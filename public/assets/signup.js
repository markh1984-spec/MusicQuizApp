/**
 * The signup page — opens a REAL account, low friction: a name and an email,
 * nothing else. See the `/api/signup` route in server.js for why the password
 * is never typed here: a magic link does that, the same mechanism a
 * forgotten password already uses.
 */

const form = document.getElementById('signupForm');
const problem = document.getElementById('problem');
const formState = document.getElementById('formState');
const doneState = document.getElementById('doneState');
const doneText = document.getElementById('doneText');

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  problem.textContent = '';
  const btn = form.querySelector('button');
  btn.disabled = true;
  const data = Object.fromEntries(new FormData(form).entries());
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
    // Only present when there is no email service configured to send the
    // link the ordinary way — a dev/local fallback, not something the live
    // app hands out in the response body.
    if (body.devLink) {
      doneText.innerHTML = `No email is set up here — <a href="${body.devLink}">set your password</a> to finish.`;
    }
    formState.hidden = true;
    doneState.hidden = false;
  } catch {
    problem.textContent = 'Could not reach the server — check your connection and try again.';
    btn.disabled = false;
  }
});
