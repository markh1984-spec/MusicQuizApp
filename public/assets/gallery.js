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
import { matchNightSlug, nightSlug, readVenuePath } from './slugs.js';

const body = document.getElementById('galBody');
const title = document.getElementById('galTitle');
const sub = document.getElementById('galSub');

/*
 * THE HOST KEY WORKS HERE TOO, AND ONLY IF IT IS IN THIS VISIT'S ADDRESS.
 *
 * The owner preview is the whole point of this page existing before anything
 * is published — *"I want to be able to see it live myself to know it works"* —
 * and it hangs on the server knowing who is asking. A signed-in account sends
 * a cookie and needs nothing; somebody arriving on a `?key=` link sends
 * nothing at all, so the preview silently did not work for them and the page
 * looked empty on the one identity most likely to be checking it.
 *
 * **Read from the URL, never from localStorage**, which is the rule this app
 * already follows for links: a REMEMBERED key must not spread itself onto new
 * pages and into browser history. This one is already in the address bar of
 * the visit that is happening, so nothing new is exposed.
 *
 * A customer's link has no key on it and this is a no-op for them.
 */
const KEY = new URLSearchParams(location.search).get('key') || '';
/*
 * WHOSE GALLERY THIS IS, the same way — read from the URL and carried onto
 * every request and every link this page builds (including the brand fetch
 * below), or the second request in (the night list, then a night's own
 * photos, then each photo itself) would silently fall back to nobody's
 * gallery in particular. See `?q=` in `server.js`'s gallery routes.
 */
const Q = new URLSearchParams(location.search).get('q') || '';
/*
 * AND WHICH VENUE, off the address bar — `/station-tap-wokingham/gallery`.
 *
 * The server serves this same file on both routes and templates nothing, so
 * the page reads its own path. Empty on plain `/gallery`, which is unchanged
 * and still shows every published night at every venue.
 */
const HERE = readVenuePath(location.pathname) || { venue: '', night: '' };
const VENUE = HERE.venue;
const keyed = (path) => {
  let out = path;
  if (KEY) out += (out.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(KEY);
  if (Q) out += (out.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(Q);
  if (VENUE) out += (out.includes('?') ? '&' : '?') + 'venue=' + encodeURIComponent(VENUE);
  return out;
};

/*
 * A LINK CARRIES THE KEY AND `?q=`, BUT NEVER `?venue=` — the venue is already
 * in the path it points at, and appending it as well produced
 * `/station-tap-wokingham/gallery/27-august?venue=station-tap-wokingham`,
 * which is the tidy address with the untidy one stapled back on.
 *
 * `keyed()` stays as it is for API calls, which genuinely need the venue as a
 * parameter because there is nowhere else on a request to put it.
 */
const linked = (path) => {
  let out = path;
  if (KEY) out += (out.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(KEY);
  if (Q) out += (out.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(Q);
  return out;
};

/** A link back to this page — the venue's own address, or the plain one. */
const home = () => linked(VENUE ? `/${VENUE}/gallery` : '/gallery');

/** A link INTO one night, in whichever address style this page arrived on. */
const nightLink = (night) => (VENUE
  ? linked(`/${VENUE}/gallery/${nightSlug(night)}`)
  : linked(`/gallery?n=${encodeURIComponent(night)}`));

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
fetch(keyed('/api/brand'))
  .then((r) => r.json())
  .then((d) => {
    const slot = document.getElementById('brand');
    if (slot) slot.innerHTML = `${brandMark(26)}${brandWords(d.name, d.appName || '')}`;
    if (d.name) document.title = `Photos — ${d.name}`;
  })
  .catch(() => { /* the gallery works perfectly well without a logo on it */ });

/*
 * WHICH NIGHT, from `?n=2026-08-20` or from `/…/gallery/20-august`.
 *
 * A DATE SLUG IS RESOLVED AGAINST THE LIST, never parsed into a date and
 * trusted: the list is fetched anyway, it already holds only the nights this
 * venue actually published, and matching against it means a slug that names
 * nothing simply shows the list rather than 404ing on a date that exists but
 * is private. `matchNightSlug()` reads both `20-august` and `20-august-2026`,
 * and the NEWEST match wins, because the list arrives newest first.
 */
const nightIn = () => {
  const n = new URLSearchParams(location.search).get('n') || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(n) ? n : '';
};

async function get(path) {
  const res = await fetch(keyed(path), { headers: { Accept: 'application/json' } });
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
        <a class="gal-night ${n.live === false ? 'is-draft' : ''}" href="${esc(nightLink(n.night))}">
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
      <a href="${esc(home())}">See what is.</a></p>`));
    return;
  }
  title.textContent = data.when || night;
  sub.textContent = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`;
  /*
   * TWO ELEMENTS, APPENDED SEPARATELY — and this is why "All nights" had never
   * appeared under a night's photographs.
   *
   * `node()` returns `firstElementChild`, so the grid came back and the
   * paragraph after it was dropped in silence. Somebody who opened a night had
   * no way back but the browser's own button, on a page a regular reaches from
   * a link with no history behind it.
   */
  body.replaceChildren(node(`
    <div class="gal-grid">
      ${data.photos.map((p) => `
        <figure class="gal-shot">
          <!-- The KEY goes on the picture too, not only on the listing: the
               photo route re-checks for itself rather than trusting that the
               listing let you through, so on an unpublished night a preview
               without it would be a page of broken images. -->
          <img src="${esc(keyed(p.url))}" alt="A photo from the night" loading="lazy" decoding="async">
        </figure>`).join('')}
    </div>`));
  body.appendChild(node(`<p class="gal-back"><a href="${esc(home())}">All nights</a></p>`));
  if (data.preview && data.live === false) sub.append(' · ', notLive());
}

/*
 * A DATE IN THE ADDRESS IS RESOLVED AGAINST THE LIST FIRST.
 *
 * `/…/gallery/20-august` names a night the way somebody says it, and the only
 * thing that knows which real date that is — for THIS venue, among the nights
 * it has actually published — is the list. So the list is fetched, matched,
 * and the night opened; a slug that matches nothing falls back to the list
 * itself rather than an error, because "that night is not up" and "there is no
 * such night" are the same answer to a stranger and should look it.
 */
async function start() {
  if (HERE.night) {
    const data = await get('/api/gallery');
    const found = (data && data.nights || []).find((n) => matchNightSlug(n.night, HERE.night));
    return found ? showNight(found.night) : showNights();
  }
  const night = nightIn();
  return night ? showNight(night) : showNights();
}

start().catch(() => {
  body.replaceChildren(node('<p class="muted gal-empty">That did not load. Try again in a moment.</p>'));
});
