/**
 * Signing in from an emailed link.
 *
 * The token lives in the address and nowhere else — never written to
 * localStorage, never put in a link out of this page. Same handling as
 * `reset.js`, and for the same reason: it is a way into somebody's account
 * until it is spent.
 *
 * **NOTHING HAPPENS UNTIL THE BUTTON IS PRESSED**, which is the whole shape of
 * this page. Spending the link on page LOAD is the obvious build and would
 * defeat the feature: mail clients and corporate scanners fetch the links in a
 * message before a human sees it, so a single-use link would already be spent
 * by the time the person it was sent to clicked it — locking out the one
 * person it exists to let in, which is the situation they were already in.
 */

import { brandMark, brandWords } from './client.js';

const token = new URL(location.href).searchParams.get('t') || '';
const go = document.getElementById('go');
const problem = document.getElementById('problem');
const dud = document.getElementById('dud');
const lead = document.getElementById('lead');

fetch('/api/brand')
  .then((r) => r.json())
  .then((d) => {
    document.getElementById('brandSlot').innerHTML = `${brandMark(30)}${brandWords(d.name, d.appName || '')}`;
    document.title = `Sign in — ${d.name}`;
  })
  .catch(() => { /* the button works perfectly well without a logo on it */ });

/*
 * A MISSING TOKEN IS SAID BEFORE ANYTHING IS PRESSED. Somebody who opened
 * `/magic` by hand, or whose mail client mangled the address, gets the reason
 * rather than a button that always fails.
 */
if (!token) {
  go.hidden = true;
  lead.hidden = true;
  dud.hidden = false;
}

go.addEventListener('click', async () => {
  go.disabled = true;
  go.textContent = 'Signing in…';
  problem.textContent = '';
  let out = null;
  try {
    const res = await fetch('/api/magic/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    out = await res.json();
  } catch {
    /*
     * A REQUEST THAT DID NOT SEND PUTS THE BUTTON BACK — the rule the
     * answering path already runs on. A link is single-use, so leaving this
     * disabled after a dropped request would strand somebody holding a
     * perfectly good link with nothing to press.
     */
    out = null;
  }

  if (out && out.ok) {
    // `replace`, so Back does not return to a page whose only button is now
    // spent — see the `dud` copy for what that would look like.
    location.replace(out.to || '/console');
    return;
  }

  go.disabled = false;
  go.textContent = 'Sign me in';
  if (out && out.error) {
    go.hidden = true;
    lead.hidden = true;
    dud.hidden = false;
  } else {
    problem.textContent = 'That did not go through. Try again.';
  }
});
