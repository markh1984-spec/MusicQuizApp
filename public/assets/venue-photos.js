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
import { framedBlob, saveBlob, saveName, storyBlob } from './photo-save.js';

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

/*
 * A PHOTO OPENS INTO ITS TWO INSTAGRAM SHAPES — the host's call, 2 October
 * 2026: *"each photo opened out into the instagram story/square options on
 * click, then just have a share button on each."* Both are DRAWN here, frame
 * and name on, so what is shown is exactly what goes — and the button shares
 * those same bytes rather than drawing again.
 *
 * **"SHARE" ONLY WHERE THERE IS A SHARE SHEET.** A laptop with none gets the
 * file in Downloads, and a button saying Share there would be a control
 * reporting something it did not do — so it says Download.
 */
function canShareFiles() {
  try {
    return Boolean(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] }));
  } catch {
    return false;
  }
}

function openBig(me, night, photo, at) {
  const verb = canShareFiles() ? 'Share' : 'Download';
  const big = node(`<div class="vp-big" role="dialog" aria-label="Save this photo for Instagram">
      <div class="vp-pair">
        <figure class="vp-opt vp-opt-square"><div class="vp-prev"><span class="muted">Making the square…</span></div>
          <figcaption>Instagram post — square</figcaption>
          <button class="gal-save vp-share" type="button" disabled>${verb}</button></figure>
        <figure class="vp-opt vp-opt-story"><div class="vp-prev"><span class="muted">Making the Story…</span></div>
          <figcaption>Instagram Story</figcaption>
          <button class="gal-save vp-share" type="button" disabled>${verb}</button></figure>
      </div>
      <button class="gal-save vp-close" type="button">Close</button>
    </div>`);
  const urls = [];
  const close = () => { big.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); document.removeEventListener('keydown', onKey); };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  big.addEventListener('click', (ev) => { if (ev.target === big || ev.target.closest('.vp-close')) close(); });
  document.body.appendChild(big);

  const filename = saveName(me.venue, night, at + 1, '');
  const fill = async (fig, draw, name) => {
    const prev = fig.querySelector('.vp-prev');
    const btn = fig.querySelector('.vp-share');
    let blob;
    try {
      blob = await draw();
    } catch {
      blob = null;
    }
    if (!blob) { prev.replaceChildren(node('<span class="muted">That one would not draw — close and try again.</span>')); return; }
    const url = URL.createObjectURL(blob);
    urls.push(url);
    prev.replaceChildren(node(`<img alt="" src="${url}">`));
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      try {
        const went = await saveBlob(blob, name, true);
        btn.textContent = went === false ? 'Nothing was sent' : (verb === 'Share' ? 'Shared' : 'Saved');
      } catch {
        btn.textContent = 'That did not go — try again';
      }
      setTimeout(() => { btn.textContent = verb; delete btn.dataset.busy; }, 2400);
    });
  };
  frameOnce().then((overlay) => Promise.all([
    fill(big.querySelector('.vp-opt-square'), () => framedBlob(photo.url, { words: me.brand, overlay }), filename),
    fill(big.querySelector('.vp-opt-story'), () => storyBlob(photo.url, { words: me.brand, overlay, line: me.line }), filename.replace(/\.jpg$/, '-story.jpg')),
  ]));
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
