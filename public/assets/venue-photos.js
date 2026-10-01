/**
 * `/venue-photos` — a pub's staff, signed in to that pub's photographs.
 *
 * The host, 1 October 2026: Evie and Tabby at the Station Tap *"only have
 * access to the gallery"*, with a username and a password he sets, able to
 * change it, and saving with the watermark in Instagram's two shapes — the
 * square and the Story (`photo-save.js`, the same drawing the console's saves
 * use, so a pub's copy carries exactly what the quizmaster's does).
 *
 * The server decides everything — which pub, which nights, which photos; this
 * page asks `/api/venue-photos` and draws what comes back. **The share sheet
 * first**: these are phones, and a share sheet is how a picture reaches
 * Instagram from one.
 */
import { esc, node, postJson } from './client.js';
import { paintScheme } from './schemes.js';
import { saveName, savePhoto, saveStory } from './photo-save.js';

const body = document.getElementById('vpBody');
const title = document.getElementById('vpTitle');
const sub = document.getElementById('vpSub');
const who = document.getElementById('vpWho');

const dateWords = (night) => {
  const [y, m, d] = night.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');
};

async function start() {
  let res;
  try {
    res = await fetch('/api/venue-photos', { credentials: 'same-origin' });
  } catch {
    body.replaceChildren(node('<p class="muted">Could not reach the server — check your signal and reload.</p>'));
    return;
  }
  if (res.status === 401) return signInForm();
  show(await res.json());
}

function signInForm(said = '') {
  title.textContent = 'Your photos';
  sub.textContent = 'Sign in to see the photos from your quiz nights.';
  who.hidden = true;
  const form = node(`
    <form class="vp-form" autocomplete="on">
      <label>Username<input type="text" name="username" autocomplete="username" autocapitalize="none" required></label>
      <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
      <button class="primary" type="submit">Sign in</button>
      <p class="vp-said" role="status">${esc(said)}</p>
    </form>`);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      await postJson('/api/venue-photos/sign-in', { username: form.username.value, password: form.password.value });
      start();
    } catch (err) {
      form.querySelector('.vp-said').textContent = err.message;
      btn.disabled = false;
    }
  });
  body.replaceChildren(form);
}

function show(me) {
  paintScheme(me.scheme);
  title.textContent = me.venue;
  sub.textContent = 'Every photo from your quiz nights. Tap one to save it for Instagram — square or Story.';
  who.hidden = false;
  who.replaceChildren(node(`<span class="tiny">Signed in as <b>${esc(me.username)}</b></span>`));
  // The gallery's own outlined pill — `.minor` is the console's, and off the
  // console it draws as a flat grey box, which nothing clickable may be.
  const pw = node('<button class="gal-save" type="button">Change password</button>');
  const out = node('<button class="gal-save" type="button">Sign out</button>');
  pw.addEventListener('click', () => passwordPanel());
  out.addEventListener('click', async () => {
    try { await postJson('/api/venue-photos/sign-out', {}); } catch { /* signed out either way */ }
    signInForm('Signed out.');
  });
  who.append(pw, out);

  if (!me.nights.length) {
    body.replaceChildren(node('<p class="muted">No photos from your nights yet. They appear here the day after a quiz.</p>'));
    return;
  }
  const list = node('<div class="vp-nights"></div>');
  me.nights.forEach((night, i) => {
    const fold = node(`<details class="vp-night"${i === 0 ? ' open' : ''}><summary>${esc(dateWords(night))}</summary><div class="gal-grid"></div></details>`);
    let loaded = false;
    const load = async () => {
      if (loaded) return;
      loaded = true;
      const grid = fold.querySelector('.gal-grid');
      grid.replaceChildren(node('<p class="muted">Loading…</p>'));
      try {
        const r = await fetch(`/api/venue-photos/night/${encodeURIComponent(night)}`);
        const got = await r.json();
        grid.replaceChildren(...(got.photos || []).map((p, at) => {
          const shot = node(`<button class="gal-shot" type="button" aria-label="Open photo ${at + 1}"><img loading="lazy" alt="" src="${esc(p.url)}"></button>`);
          shot.addEventListener('click', () => openBig(me, night, p, at));
          return shot;
        }));
      } catch {
        loaded = false;
        grid.replaceChildren(node('<p class="muted">Those would not load — open the night again.</p>'));
      }
    };
    fold.addEventListener('toggle', () => { if (fold.open) load(); });
    if (i === 0) load();
    list.appendChild(fold);
  });
  body.replaceChildren(list);
}

// The pub's frame, fetched once, on the first save — most visits save nothing.
let frame = null;
async function frameOnce() {
  if (frame !== null) return frame;
  try {
    frame = (await (await fetch('/api/venue-photos/frame')).json()).overlay || '';
  } catch {
    frame = '';
  }
  return frame;
}

function openBig(me, night, photo, at) {
  const big = node(`<div class="gal-big" role="dialog" aria-label="Photo"><div class="gal-big-pic"><img src="${esc(photo.url)}" alt=""></div></div>`);
  const row = node('<div class="gal-acts"></div>');
  row.addEventListener('click', (ev) => ev.stopPropagation());
  const filename = saveName(me.venue, night, at + 1, '');
  const control = (idle, run) => {
    const b = node(`<button class="gal-save" type="button">${esc(idle)}</button>`);
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      b.disabled = true;
      b.textContent = 'Saving…';
      try {
        const went = await run(await frameOnce());
        b.textContent = went === false ? 'Nothing was saved' : 'Saved';
      } catch {
        b.textContent = 'That would not save — try again';
      }
      setTimeout(() => { b.textContent = idle; b.disabled = false; }, 2400);
    });
    row.appendChild(b);
  };
  control('Save square', (overlay) => savePhoto(photo.url, { words: me.brand, filename, overlay }));
  control('Save as a Story', (overlay) => saveStory(photo.url, {
    words: me.brand, overlay, line: me.line, filename: filename.replace(/\.jpg$/, '-story.jpg'),
  }));
  big.querySelector('.gal-big-pic').appendChild(row);
  big.addEventListener('click', () => big.remove());
  document.addEventListener('keydown', function esc2(ev) {
    if (ev.key === 'Escape') { big.remove(); document.removeEventListener('keydown', esc2); }
  });
  document.body.appendChild(big);
}

function passwordPanel() {
  if (document.querySelector('.vp-pw')) return;
  const panel = node(`
    <form class="vp-form vp-pw">
      <h2>Change your password</h2>
      <label>Current password<input type="password" name="current" autocomplete="current-password" required></label>
      <label>New password<input type="password" name="next" autocomplete="new-password" minlength="8" required></label>
      <div class="row"><button class="primary" type="submit">Change it</button><button class="gal-save" type="button">Cancel</button></div>
      <p class="vp-said" role="status"></p>
    </form>`);
  panel.querySelector('button.gal-save').addEventListener('click', () => panel.remove());
  panel.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const said = panel.querySelector('.vp-said');
    try {
      await postJson('/api/venue-photos/password', { current: panel.current.value, next: panel.next.value });
      said.textContent = 'Changed. Use the new one next time you sign in.';
      panel.current.value = '';
      panel.next.value = '';
    } catch (err) {
      said.textContent = err.message;
    }
  });
  body.prepend(panel);
  panel.current.focus();
}

start();
