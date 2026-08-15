/**
 * THE PUBLIC GALLERY — nights by date, and the photos in one.
 *
 * The page the people who were in the room come back to. They have no account
 * and never will, so this asks the server for everything and holds nothing.
 *
 * ---
 *
 * **TWO SCREENS, ONE PAGE.** No date in the address is the list of nights; a
 * date is that night's photos. `?n=YYYY-MM-DD`, so a link to one night can be
 * sent to somebody and lands where it says.
 *
 * **IT SHOWS ONLY WHAT THE SERVER SENDS.** Whether a night is public is
 * decided in `src/gallery.js` and re-checked on the photo route itself — this
 * file could not show an unpublished night if it tried, which is the only way
 * a gate is worth anything.
 *
 * **AND THE OWNER SEES IT FIRST.** Signed in, the server also sends nights
 * that are NOT yet published, marked — so the whole path can be proved end to
 * end before a single photograph becomes public. Anybody else gets the
 * published ones and no hint that the others exist.
 */

import { esc, node, brandMark, brandWords } from './client.js';

const body = document.getElementById('galBody');
const title = document.getElementById('galTitle');
const sub = document.getElementById('galSub');

/*
 * `innerHTML`, NOT `append()` — and this shipped wrong once.
 *
 * `brandMark()` and `brandWords()` return HTML STRINGS, and `Node.append()`
 * treats a string argument as literal text, so the whole SVG source printed
 * across the top of the page as garbled characters. Every other page in the
 * app sets `innerHTML`; this one invented a third way and got it wrong.
 *
 * The name comes from `/api/brand`, the same public endpoint the sign-in page
 * uses — a customer reaching this page has no account, so nothing that needs
 * one can be asked for. And it fails quietly: the page is the photographs, and
 * a missing logo is not a reason to show somebody an error.
 */
fetch('/api/brand')
  .then((r) => r.json())
  .then((d) => {
    const slot = document.getElementById('brand');
    if (slot) slot.innerHTML = `${brandMark(26)}${brandWords(d.name, d.appName || '')}`;
    if (d.name) document.title = `Photos — ${d.name}`;
  })
  .catch(() => { /* the gallery works perfectly well without a logo on it */ });

const nightIn = () => {
  const n = new URLSearchParams(location.search).get('n') || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(n) ? n : '';
};

async function get(path) {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/** A night that is visible to the owner alone says so, plainly and quietly. */
function notLive() {
  return node(`<span class="gal-draft" title="Only you can see this">Not published</span>`);
}

async function showNights() {
  const data = await get('/api/gallery');
  const nights = (data && data.nights) || [];
  title.textContent = 'Photos';
  sub.textContent = nights.length
    ? 'Pick a night.'
    : '';
  if (!nights.length) {
    /*
     * SAY WHICH KIND OF EMPTY IT IS. "Nothing here yet" on a page somebody
     * scanned a code to reach reads as broken; saying the photos go up after
     * the night is a promise they can act on.
     */
    body.replaceChildren(node(`
      <p class="muted gal-empty">No photos are up yet. They go up after the night.</p>`));
    return;
  }
  body.replaceChildren(node(`
    <div class="gal-nights">
      ${nights.map((n) => `
        <a class="gal-night ${n.live === false ? 'is-draft' : ''}" href="/gallery?n=${encodeURIComponent(n.night)}">
          <b>${esc(n.when || n.night)}</b>
          <span class="tiny">${n.count} photo${n.count === 1 ? '' : 's'}</span>
        </a>`).join('')}
    </div>`));
  if (data.preview) {
    for (const [i, n] of nights.entries()) {
      if (n.live === false) body.querySelectorAll('.gal-night')[i]?.append(notLive());
    }
  }
}

async function showNight(night) {
  const data = await get(`/api/gallery/${encodeURIComponent(night)}`);
  if (!data) {
    // The same nothing for every refusal — not a night, not published, or
    // empty. Three different messages would map which dates exist.
    title.textContent = 'Nothing here';
    sub.textContent = '';
    body.replaceChildren(node(`
      <p class="muted gal-empty">This night is not up.
      <a href="/gallery">See what is.</a></p>`));
    return;
  }
  title.textContent = data.when || night;
  sub.textContent = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`;
  body.replaceChildren(node(`
    <div class="gal-grid">
      ${data.photos.map((p) => `
        <figure class="gal-shot">
          <img src="${esc(p.url)}" alt="A photo from the night" loading="lazy" decoding="async">
        </figure>`).join('')}
    </div>
    <p class="gal-back"><a href="/gallery">All nights</a></p>`));
  if (data.preview && data.live === false) sub.append(' · ', notLive());
}

const night = nightIn();
(night ? showNight(night) : showNights()).catch(() => {
  body.replaceChildren(node('<p class="muted gal-empty">That did not load. Try again in a moment.</p>'));
});
