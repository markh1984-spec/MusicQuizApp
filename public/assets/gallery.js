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

/**
 * THE WAY BACK TO THE CONSOLE, carrying the key that got you here.
 *
 * Only ever drawn in preview, so it is never offered to a customer — and the
 * key comes from THIS visit's address rather than from localStorage, the rule
 * this app follows everywhere: a remembered key must not spread itself onto
 * new pages and into browser history.
 */
const consoleLink = () => '/console?door=community&tab=photos'
  + (KEY ? `&key=${encodeURIComponent(KEY)}` : '');

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

/*
 * THERE IS NO "NOT PUBLISHED" BADGE ON THIS PAGE, AND THAT IS DELIBERATE.
 *
 * Removed on 31 August 2026, asked for by name after it had been wrong twice:
 * *"still says not published, remove this from the public gallery please."*
 *
 * It only ever showed on the owner's own preview, so no customer saw it — but
 * it was a SECOND place stating whether a night is live, a screen away from
 * the control that decides it, and the two disagreed. **Publish state belongs
 * to the console**, on the button that sets it and can be pressed. A read-only
 * echo of it on the public page is a label collision that can only ever go out
 * of step, which it did.
 *
 * If a preview ever needs to say "you are looking at a draft" again, say it on
 * the CONSOLE beside the control, not here.
 */

/**
 * EVERY NIGHT AS A CARD, GROUPED BY PUB — the way in.
 *
 * Asked for on 31 August 2026: *"would like this to be a sort of gallery box
 * selection — so it has the date and perhaps a mix of 2-3 of the photos from
 * the gallery itself in the image for that sub-gallery."* A list of dates says
 * nothing about what is behind it; a card with the night's own photographs on
 * it is the only thing on this page that makes somebody want to open one.
 *
 * **GROUPED BY PUB, NEWEST FIRST**, chosen over a flat run of dates: a person
 * arriving here cares about their own local, not about the quizmaster's diary.
 * The nights are already newest first from the server, so grouping preserves
 * that inside each pub, and the pubs are ordered by whichever has the most
 * recent night — the one somebody is most likely to have just been to.
 *
 * **THE PUB IS THE HEADING, SO THE CARD IS THE DATE.** The answer given was
 * "date and venue", and both are on screen — but printing the pub on twelve
 * cards under a heading that already says it is the clutter rule exactly, and
 * on a venue's own address every card would repeat the same eight words. If
 * this reads as too bare, the venue goes back on the card and the headings go.
 *
 * **A NIGHT WITH NO PUB ON IT STILL GETS A HOME** — nights filed before venues
 * existed have no venue, and dropping them would quietly shorten the archive.
 */
function groupsOf(nights) {
  const by = new Map();
  for (const n of nights) {
    const key = n.venue || '';
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(n);
  }
  // The list arrives newest first, so the first night in each group is that
  // pub's most recent — which is what the pubs themselves are ordered on.
  return [...by.entries()].map(([venue, list]) => ({ venue, list }));
}

/**
 * THE FANNED PILE — two or three photographs dropped on a table.
 *
 * **THE FIRST ONE IS ON TOP**, which is the one a human pinned if they pinned
 * any. So the choice actually shows rather than being one of three at random.
 *
 * **THE TILT IS FIXED PER POSITION, not random.** A random angle per card would
 * make the page restless and would change on every visit; three fixed angles
 * read as a pile and stay put. The same reasoning as the projector's own tilt
 * never landing near straight — these are deliberately off, so they read as
 * snapshots rather than as a broken grid.
 *
 * `aria-hidden`, because the card's own text already names the night: three
 * "a photo from the night" labels in a row is noise to a screen reader.
 */
function fanOf(urls) {
  if (!urls.length) return '<span class="gal-fan is-empty" aria-hidden="true"></span>';
  return `<span class="gal-fan" aria-hidden="true">${urls.slice(0, 3).map((u, i) => `
    <img class="gal-fan-${i}" src="${esc(keyed(u))}" alt="" loading="lazy" decoding="async">`)
    .reverse().join('')}</span>`;
}

async function showNights() {
  const data = await get('/api/gallery');
  const nights = (data && data.nights) || [];
  title.textContent = 'Photos';
  sub.textContent = nights.length ? 'Pick a night.' : '';
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
  /*
   * AND ONE LINE FOR THE QUIZMASTER, WHEN NIGHTS ARE HERE BUT NOT PUBLIC.
   *
   * The "Not published" badge per night was removed on 31 August 2026, asked
   * for by name — but the information is worth having and only the badge was
   * the problem. This is the same fact said ONCE for the page instead of
   * eighteen times down it, which is the clutter rule rather than a reversal.
   *
   * **IT IS THE ANSWER TO A REAL CONFUSION, not a status readout.** Signed
   * out, this page correctly shows nothing when nothing is published — and it
   * then says *"No photos are up yet"*, which to the person who filed those
   * nights is simply untrue. Preview shows them and this says why nobody else
   * can see them.
   *
   * **PREVIEW ONLY**, by construction: a customer is never sent it, because a
   * customer never receives an unpublished night in the first place.
   *
   * **AND IT LINKS TO WHERE THE SWITCH IS.** Naming another page and leaving
   * somebody to find it is the split-over-two-screens fault this app has a
   * rule against — *"do it over there" must be a link to there*.
   */
  const drafts = data.preview ? nights.filter((n) => n.live === false).length : 0;
  if (drafts) {
    sub.textContent = `Pick a night. ${drafts} of these ${drafts === 1 ? 'is' : 'are'} only visible to you.`;
  }
  const groups = groupsOf(nights);
  body.replaceChildren();
  if (drafts) {
    body.appendChild(node(`
      <p class="gal-drafts">Not on the public page yet.
        <a href="${esc(consoleLink())}">Put them up in the console</a>.</p>`));
  }
  body.appendChild(node(`
    <div class="gal-groups">
      ${groups.map((g) => `
        <section class="gal-group">
          ${g.venue ? `<h2 class="gal-group-name">${esc(g.venue)}</h2>` : ''}
          <div class="gal-cards">
            ${g.list.map((n) => `
              <a class="gal-card" href="${esc(nightLink(n.night))}">
                ${fanOf(n.cover || [])}
                <b>${esc(n.when || n.night)}</b>
              </a>`).join('')}
          </div>
        </section>`).join('')}
    </div>`));
}

async function showNight(night) {
  const data = await get(`/api/gallery/${encodeURIComponent(night)}`);
  if (!data) {
    /*
     * "NOT UP YET" RATHER THAN "NOTHING HERE" — and the wording is the WHOLE
     * change, which is what makes it safe.
     *
     * The projector now carries a QR of this address at the end of the night,
     * hours before the photographs are published: publishing is deliberately
     * something the quizmaster does afterwards, having looked at what is in
     * them. So the most likely person reading this page is somebody who
     * scanned that code in the pub — and telling them "nothing here" about
     * their own night, which they were at, reads as the app being broken.
     *
     * **THE SERVER IS UNTOUCHED, and that is the point.** It still answers ONE
     * 404 for every refusal — not a night, not published, or empty — so this
     * page says exactly the same thing to somebody guessing a date at random
     * as to somebody holding a real link. Nothing new can be mapped, because
     * nothing new is known. The alternative was a `pending` state on the
     * server, which would have leaked precisely which dates exist.
     *
     * It promises the morning rather than a time: the app cannot know when
     * somebody will get round to it, and a deadline it does not control is one
     * it would break.
     */
    title.textContent = 'Not up yet';
    sub.textContent = '';
    body.replaceChildren(node(`
      <p class="muted gal-empty">These photos are not up yet — try again in the morning.
      <a href="${esc(home())}">See what is up.</a></p>`));
    return;
  }
  title.textContent = data.when || night;
  /*
   * WHICH PUB, BESIDE THE COUNT — asked for on 31 August 2026: *"each gallery
   * should say which QM it's for as well as which room."* The quizmaster is
   * already in the header (`/api/brand`), so this is the missing half, and it
   * is one line rather than a second heading: somebody who scanned a code in
   * the room knows where they were, and this is confirmation rather than news.
   * Silent when the night has no venue on it, like every other derived line
   * in this app.
   */
  const count = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`;
  sub.textContent = data.venue ? `${data.venue} · ${count}` : count;
  /*
   * TWO ELEMENTS, APPENDED SEPARATELY — and this is why "All nights" had never
   * appeared under a night's photographs.
   *
   * `node()` returns `firstElementChild`, so the grid came back and the
   * paragraph after it was dropped in silence. Somebody who opened a night had
   * no way back but the browser's own button, on a page a regular reaches from
   * a link with no history behind it.
   */
  const grid = node(`
    <div class="gal-grid">
      ${data.photos.map((p, i) => `
        <!-- A BUTTON, NOT A FIGURE, because it is pressed — asked for on
             31 August 2026: *"can we make it so the gallery page is clickable
             to enlarge a specific photo?"* Nothing in this app that is pressed
             is left as a bare element with a click handler on it: a button is
             what a keyboard reaches and what a screen reader announces. -->
        <button class="gal-shot" type="button" data-at="${i}"
                aria-label="Enlarge photo ${i + 1} of ${data.photos.length}">
          <!-- The KEY goes on the picture too, not only on the listing: the
               photo route re-checks for itself rather than trusting that the
               listing let you through, so on an unpublished night a preview
               without it would be a page of broken images. -->
          <img src="${esc(keyed(p.url))}" alt="A photo from the night" loading="lazy" decoding="async">
        </button>`).join('')}
    </div>`);
  placeArrows(data);
  body.replaceChildren(grid);
  body.appendChild(node(`<p class="gal-back"><a href="${esc(home())}">All nights</a></p>`));
  wireBigPicture(grid, data.photos);
}

/**
 * AN ARROW EITHER SIDE OF THE DATE — forwards and backwards in time.
 *
 * Asked for on 31 August 2026: *"was hoping for arrows either side of the date
 * to nav forward or backwards in time."* The first version put a row of links
 * under the photographs, which on a wall of eighteen is below the fold and
 * therefore not navigation anybody finds.
 *
 * **BESIDE THE THING THEY MOVE.** The date is what the arrows change, so they
 * belong on it — the same rule the launch bar's *Unlaunch* follows, sat with
 * the line it acts on rather than across the room from it.
 *
 * **THE NEIGHBOURS ARE THE SAME PUB'S, decided on the server**, which is the
 * only side holding the archive that says which pub a dated photo folder
 * belongs to. This draws what it is handed and works out nothing.
 *
 * **AN END OF THE RUN IS AN EMPTY CELL, NOT A DEAD ARROW.** The one place
 * *present and inert* does not apply: that rule is about a control whose
 * position must be learnable on a page somebody drives every week, and this is
 * a page a stranger sees once. A greyed arrow there is a question; an empty
 * space is simply the end of the pub's nights. **The cell stays**, so the date
 * does not shift sideways when one runs out.
 *
 * **NO `title`.** A native tooltip is an unstyled box that lands over the
 * heading — the rule the bay rail already sets. The date each arrow leads to
 * is in its `aria-label`, and pressing it shows the date anyway.
 */
function placeArrows(data) {
  let row = document.querySelector('.gal-title-row');
  if (!row) {
    // The heading is in the page's own markup, so the row is built round it
    // rather than replacing it — `title` stays the same element throughout.
    row = node('<div class="gal-title-row"></div>');
    title.parentNode.insertBefore(row, title);
    row.appendChild(title);
  }
  for (const old of row.querySelectorAll('.gal-arrow, .gal-arrow-gap')) old.remove();
  const arrow = (n, side) => (n
    ? node(`<a class="gal-arrow is-${side}" href="${esc(nightLink(n.night))}"
        aria-label="${side === 'older' ? 'Earlier' : 'Later'} — ${esc(n.when || n.night)}"
        >${side === 'older' ? '\u2039' : '\u203a'}</a>`)
    : node('<span class="gal-arrow-gap" aria-hidden="true"></span>'));
  row.insertBefore(arrow(data.older, 'older'), title);
  row.appendChild(arrow(data.newer, 'newer'));
}

/**
 * ONE PHOTOGRAPH, FILLING THE SCREEN — and the next press puts it back.
 *
 * Asked for on 31 August 2026: *"can we make it so the gallery page is
 * clickable to enlarge a specific photo?"*
 *
 * **AN OVERLAY, NEVER A REPLACEMENT.** The grid underneath is not touched, so
 * closing the picture puts somebody back exactly where they were rather than
 * at the top of a wall of fourteen — the same fault, and the same fix, as the
 * console's own photo bay. `position: fixed` rather than `absolute`, because
 * here it covers the WINDOW rather than a panel, and the page behind it
 * genuinely scrolls.
 *
 * **`contain`, not `cover`.** This is the moment somebody is actually looking
 * at it; a crop is right on a wall of thumbnails and wrong here.
 *
 * **THREE WAYS OUT, and no visible control.** Click it, press Escape, or press
 * the back button — the whole picture is the way back, which is what was asked
 * for and what nobody has to be told. A close button in a corner would be one
 * more thing on top of a photograph, and this page's whole job is the
 * photographs.
 *
 * **NO ARROWS AND NO COUNTER, deliberately.** They were not asked for, and a
 * gallery of fourteen is closed and reopened without effort. The rule this app
 * holds everywhere: leave it out and wait for somebody to miss it.
 */
function wireBigPicture(grid, photos) {
  let open = null;

  const close = () => {
    if (!open) return;
    open.remove();
    open = null;
    document.body.classList.remove('gal-zoomed');
  };

  const show = (at) => {
    close();
    const p = photos[at];
    if (!p) return;
    open = node(`
      <button class="gal-big" type="button" aria-label="Close this photo">
        <img src="${esc(keyed(p.url))}" alt="A photo from the night">
      </button>`);
    open.addEventListener('click', close);
    document.body.appendChild(open);
    // The page behind it must not scroll under the picture — a flick meant for
    // the photograph would otherwise move the wall you are about to come back
    // to, which is the scroll this exists to preserve.
    document.body.classList.add('gal-zoomed');
    open.focus();
  };

  grid.addEventListener('click', (ev) => {
    const shot = ev.target.closest('.gal-shot');
    if (shot) show(Number(shot.dataset.at));
  });
  // ESCAPE, because this is a page people reach on a laptop too and it is what
  // every other overlay on the web does. One listener on the document rather
  // than one per picture: the grid is rebuilt when a night changes, and a
  // per-element listener would leak with it.
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
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
