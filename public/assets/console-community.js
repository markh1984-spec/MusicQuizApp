/**
 * THE COMMUNITY DOOR — the things that outlive one night.
 *
 * ---
 *
 * Asked for on 23 August 2026: *"I would like a fifth menu pill at the top
 * entitled 'community', which is for things like quiz leagues, and all the
 * controls for that functionality will live there — please build the page
 * identical to the others with the bay at the top, sub menu and main section
 * below."*
 *
 * **THE FIFTH DOOR IS THE HONEST PLACE FOR A LEAGUE, and the reason is the
 * rule the other four are already sorted by.** Console, Workshop and Post gig
 * name MOMENTS of a night — before it, during it, after it — and My account
 * names the one thing that is not a night at all. A league is neither: it is
 * a thing that spans nights and belongs to the ROOM rather than to the
 * quizmaster, which is exactly why it had nowhere good to live and ended up as
 * a block on a venue card, where you could only ever see one venue's at a
 * time and only by going looking for it.
 *
 * **IT GOES FOURTH, BEFORE MY ACCOUNT, and that is deliberate.** The three
 * night doors keep their sequence, this joins the end of the work, and My
 * account stays last — where an account link sits on every website anybody
 * has ever used. A menu that reorders itself is the complaint this project
 * already has on record; a menu whose last item moves is a smaller version of
 * the same thing.
 *
 * ---
 *
 * **NOTHING NEW IS COLLECTED AND NOTHING NEW IS STORED.** `src/league.js` has
 * built these tables out of the archive for as long as leagues have existed —
 * every filed night already carries its full leaderboard — and
 * `library.leagues` has been in the console's payload the whole time. This
 * door is a PLACE to read them, not a feature underneath them. That is what
 * makes it cheap, and it is the same shape the headcounts took: arithmetic
 * over what is already on disk.
 *
 * **THE BAY ANSWERS "IS ANYTHING RUNNING", THE TAB ANSWERS "WHO IS WINNING".**
 * Same split as every other door: the head is the glanceable fact you want
 * before you have chosen anything, the section below is the thing you came to
 * read. On the Console that is the night and the packs; here it is how many
 * seasons are live and then the tables themselves.
 */

import { esc, node } from './client.js';
// `filters.js` has no page and no boot code — only exported functions — which
// is what makes importing it here safe. Importing from a module with top-level
// listeners is what once hung the whole console on "Loading your library…".
import { drawFiltered } from './filters.js';
// `keyed` comes from the shell, exactly as `console-gigs.js` takes it — the
// established pattern here, and safe because it is a hoisted function
// declaration rather than something read while the shell is half-built.
import { goTo, keyed, renderKeepingPlace } from './console.js';
import { library, me } from './console-state.js';
import { asksPanel, groupByVenue, nightPhotos } from './console-gigs.js';
import { bayColumns, bayHead, bayRail } from './console-bay.js';
import { venueSlug } from './slugs.js';

/** Every venue with a league running, best-supported first. */
function leaguesNow() {
  /*
   * THE KEY TRAVELS WITH THE TABLE. `library.leagues` is keyed by
   * `venueKeyOf()` — an id where the nights have one, a lowercased name where
   * they do not — and that is what the publish control has to send, because
   * it is what the table was grouped BY. Publishing by display name would put
   * the wrong pub up the day somebody renamed one, and `Object.values()` was
   * throwing the key away one line before it was needed.
   */
  return Object.entries(library.leagues || {})
    .filter(([, l]) => l && l.table && l.table.length)
    .map(([key, l]) => ({ ...l, key }))
    .sort((a, b) => b.nights - a.nights || a.venue.localeCompare(b.venue));
}

/**
 * THE BAY IS THE TAB YOU ARE ON — asked for directly, 29 August 2026.
 *
 * *"I would like anything that loads to load onto the top bar bit, so if I
 * click photos I want the photos to load perhaps in a 3 x 6 grid at the top
 * there? Quiz league should also load up there with options perhaps on the
 * left hand side going down like the menu below it."*
 *
 * **THE OTHER FOUR DOORS ALREADY WORK THIS WAY AND THIS ONE DID NOT.** The
 * Post gig bay is the night you opened; the Workshop bay is the pack you
 * picked; the Console bay is tonight. Community's was a fixed summary that
 * said the same three numbers whichever tab you were on — so the one region
 * the frame guarantees is always on screen was spending itself on a sentence
 * you had already read, while the thing you pressed a tab to see was down in
 * the scroller.
 *
 * **THE SPLIT IS READ ABOVE, WORK BELOW — not a repeat.** The bay is the
 * glance: the wall of pictures, the standings at one pub. The tab underneath
 * keeps everything that ACTS — the bin on a photograph, publishing a night,
 * publishing a table, overruling the filter on a name. That is this project's
 * own rule about what may appear twice: *a read-only summary may repeat; a
 * queue may not*, and no control is drawn in both places.
 *
 * **AND EVERY BAY IS THE LAUNCH BAY'S SIZE — a hard rule**: *"the bay at the
 * top ALWAYS has the same dimensions as the launch bay, this must be
 * consistent across sections."* `--bay-h` in the stylesheet, applied to every
 * door's bench from 900px up, which is where the frame is fixed.
 *
 * That is what makes all of this safe as well as consistent. The doorhead does
 * not scroll — it is a fixed region and the tab body is the only scroller — so
 * before the rule a bay that grew with the data pushed the tab column off the
 * bottom of the screen with nothing left to bring it back, which is exactly
 * what a night with thirty photographs did to the Post gig bench. Given a
 * fixed box instead, a wall of any size and a league of any length simply
 * SCROLL INSIDE IT, and neither needs a cap or a "and N more" line pointing at
 * somewhere they are not.
 */
export function communityBench(active) {
  if (active === 'photos') return photoWall();
  if (active === 'league' && leaguesNow().length) return leagueBay();
  return summaryBench();
}

/**
 * WHAT IS RUNNING, in one line you read without choosing anything — the bay
 * as it was, still right for the tab that has no shape of its own.
 *
 * **It says the same thing whether there are five leagues or none**, which is
 * the empty-state rule this project holds everywhere: a door that draws
 * nothing until you have data reads as broken on the day somebody opens it
 * for the first time, which is the day they are deciding whether to bother.
 */
function summaryBench() {
  const leagues = leaguesNow();
  const teams = new Set();
  for (const l of leagues) for (const t of l.table) teams.add(t.name.toLowerCase());
  const nights = leagues.reduce((n, l) => n + l.nights, 0);

  if (!leagues.length) {
    return node(`
      <div class="panel launchbar bench community-bench">
        <div class="bench-head">
          <b>Nothing running yet</b>
          <span class="tiny">A league builds itself out of the nights you file — there is
            nothing to set up. Run a quiz at a venue and its table starts.</span>
        </div>
      </div>`);
  }

  /*
   * THREE NUMBERS, and they answer three different questions: is this worth
   * showing a landlord (venues), is it a real competition yet (teams), and how
   * far into the season are we (nights). A fourth would be furniture.
   */
  return node(`
    <div class="panel launchbar bench community-bench">
      <div class="bench-head">
        <b>${leagues.length} league${leagues.length === 1 ? '' : 's'} running</b>
        <span class="tiny">${teams.size} team${teams.size === 1 ? '' : 's'}
          across ${nights} night${nights === 1 ? '' : 's'} — a rolling twelve-week season.</span>
      </div>
      <div class="bench-row">
        ${leagues.slice(0, 4).map((l) => `
          <div class="community-lead">
            <span class="tiny community-where">${esc(l.venue)}</span>
            <b class="community-who">${esc(l.table[0].name)}</b>
            <span class="tiny">${l.table[0].points} pts</span>
          </div>`).join('')}
      </div>
    </div>`);
}

/*
 * THE WALL — six across and three down, which is the "3 x 6" that was asked
 * for, laid out the way round the rest of this console already is.
 *
 * **SIX ACROSS BECAUSE EVERYTHING ELSE HERE IS SIX ACROSS** — the pack shelf
 * and the Tonight bays, both by decision. A grid that mirrors the one two
 * inches below it reads as the same app; three across and six down would be
 * the same eighteen pictures and twice as tall, which the bay cannot afford.
 */
const WALL_MAX = 18;

/*
 * HOW MANY NIGHTS ARE OPENED TO FILL IT.
 *
 * A photo list is one request per night — the reason a night's own pictures
 * are fetched on the press rather than up front — so a wall built by asking
 * every night in the archive would spend a pub's wifi on twenty requests to
 * draw eighteen thumbnails. Newest first, stopping the moment the wall is
 * full, and never more than this many: an ordinary night carries more than
 * eighteen photographs on its own, so the usual cost is ONE request.
 */
const WALL_NIGHTS = 4;

/**
 * FETCHED ONCE PER PAGE LOAD, then held.
 *
 * The bay is rebuilt on every state push — which during a lobby is every time
 * somebody joins — so a fetch inside the render would be a request storm on
 * the one evening the connection must not stutter. A photograph that arrives
 * after this is caught the next time the console is opened, which is the right
 * trade for a wall.
 */
let wallShots = null;

/**
 * WHICH NIGHT IS OPEN, AND WHICH PICTURE IS BLOWN UP.
 *
 * Module-level, because the bay and the tab body are built by two different
 * calls inside one `render()` and both have to agree — and because a state
 * push rebuilds the lot, so anything held inside either function would reset
 * itself the next time somebody joined the lobby.
 */
let openNight = null;
let openShot = null;

/**
 * THE OPEN NIGHT'S PUBLISH CONTROL, MADE IN THE BAY AND HUNG IN THE TAB.
 *
 * `nightPhotos()` fetches a night's pictures and its published flag in ONE
 * request, so the control has to be built where that request is made — in the
 * bay — while it has to APPEAR under the night's row in the tab body, which is
 * where controls live. Asking twice would be a second request per night for a
 * boolean the first one already carried.
 *
 * Safe because `render()` evaluates its arguments in order: the doorhead is
 * built before the tab body, so the element exists by the time the row wants
 * it. Cleared whenever no night is open, or a stale control would be hung on
 * the next night somebody opened.
 */
let nightControls = null;

/** Go back to the wall — what the night list does when you press it again. */
export function closeNight() { openNight = null; openShot = null; nightControls = null; }

/**
 * THE NIGHTS THAT HAVE PHOTOGRAPHS, for the rail. Fetched once, then held.
 *
 * The same list the tab body already fetches — held here because the RAIL is
 * in the bay and the bay is rebuilt on every state push, and because two
 * fetches of one list is two answers that can disagree about which nights
 * exist.
 */
let photoNights = null;

function loadPhotoNights() {
  if (photoNights || photoNightsAsking) return;
  photoNightsAsking = true;
  fetch(keyed('/api/past-gigs'))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return;
      photoNights = (d.nights || []).filter((n) => n.hasPhotos);
      renderKeepingPlace();
    })
    .catch(() => {})
    .finally(() => { photoNightsAsking = false; });
}
let photoNightsAsking = false;

/**
 * The rail's rows: the wall, then every night under the pub it happened at.
 *
 * **GROUPED BY PUB FIRST, THEN THE NIGHTS FROM THERE** — *"the same pub having
 * two evenings is fine, but it should probably be compartmentalised into a
 * single pub and then nights from there."* Walking the archive in date order
 * and printing the venue whenever it changed did NOT do that: two Thursdays at
 * The Crown either side of a Monday at The Station Tap printed "The Crown"
 * twice, which reads as two pubs with the same name — the exact confusion the
 * league rail had for real, one bug up.
 *
 * The pubs keep DATE order — the one you played at last is first, like every
 * other list of venues in this app — and the nights inside each keep theirs.
 */
function photoRail() {
  const rows = [{ key: '', name: 'The wall', note: 'The newest pictures' }];
  const byPub = new Map();
  for (const night of photoNights || []) {
    // Keyed on the lowercase name for the same reason the league is: one pub
    // typed two ways is one pub. The FIRST spelling seen wins, which is the
    // most recent night's — `venuesUsed` and the headcounts already do that.
    const name = night.venue || 'No venue on these';
    const key = name.trim().toLowerCase();
    if (!byPub.has(key)) byPub.set(key, { name, nights: [] });
    byPub.get(key).nights.push(night);
  }
  for (const pub of byPub.values()) {
    for (const night of pub.nights) {
      /*
       * THE LAMP IS THE LOCAL TRUTH, `night.published` IS THE SERVER'S — the
       * same split the per-photo lamp uses, and for the same reason: the write
       * goes to GitHub and takes about a second, which on a control you flick
       * down a list of nights is a control that feels broken. `pubLive` holds
       * what the eye has been told; a failed write puts it back and says so.
       */
      const up = pubLive.has(night.night) ? pubLive.get(night.night) : Boolean(night.published);
      rows.push({
        key: night.night,
        group: pub.name,
        name: readable(night.night),
        note: night.venueMixed ? 'Two venues' : '',
        lamp: {
          on: up,
          said: up
            ? 'On the public gallery. Press to take it off.'
            : 'Not on the public gallery. Press to put it up — the photos open above.',
          onPress: () => togglePublish(night.night, !up),
        },
      });
    }
  }
  return rows;
}

/**
 * WHICH NIGHTS THE EYE HAS BEEN TOLD ARE PUBLIC — a module Map, because the
 * bay is rebuilt on every state push and a value held on an element would go
 * with it.
 */
const pubLive = new Map();

/**
 * PUT A NIGHT UP OR TAKE IT DOWN, FROM THE RAIL — asked for on 31 August 2026:
 * *"put a red P here by default and a click to put it to green publishes the
 * gallery, and another click unpublishes it and makes it red."*
 *
 * **IT FLIPS NOW AND SAVES LATER**, the pattern the per-photo lamp already
 * uses. There is deliberately NO settle delay here, unlike that one: a photo
 * lamp is flicked across a grid of eighteen and often changed twice, where a
 * night is published once and the press is a decision. Waiting 600ms to send a
 * decision buys nothing and delays the thing somebody is about to check.
 *
 * **A FAILED WRITE PUTS THE LAMP BACK AND SAYS WHY** — never an alert for
 * something that happened in the background, and never a silent revert, which
 * reads as a control with a mind of its own.
 */
async function togglePublish(night, want) {
  pubLive.set(night, want);
  renderKeepingPlace();
  try {
    const res = await fetch(keyed('/api/past-gigs/publish'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ night, on: want }),
    });
    const out = await res.json().catch(() => ({}));
    // SAY WHAT WENT WRONG. The likeliest failure by far is that the private
    // photo repository is not configured, and "could not save that" would send
    // somebody hunting through the app for a fault in an environment variable.
    if (!res.ok) throw new Error(out.error || 'Could not change that.');
    // The list the rail is built from is now stale by one field. Corrected
    // here rather than re-fetched: a whole archive read to learn one boolean
    // we already know is a request nobody needs.
    const row = (photoNights || []).find((n) => n.night === night);
    if (row) row.published = want;
    pubTrouble = '';
  } catch (err) {
    pubLive.set(night, !want);
    pubTrouble = err.message;
  }
  renderKeepingPlace();
}

/** What went wrong with the last publish, said under the rail. */
let pubTrouble = '';

/**
 * THE PHOTOS BAY — the wall or one night, with a picture over the top of it.
 *
 * Two states in the page and a third laid OVER them, which is the fix for
 * *"when I click into a photo on the gallery and then click off, it seems to
 * reload the entire gallery at the top — can it not just go back to where I
 * was?"*
 *
 * **NOTHING WAS RELOADING.** The wall is held in a module binding and no fetch
 * happened. What happened is that opening a picture repainted the page, which
 * REBUILT the bay — and a fresh element scrolls at 0. Holding the offset
 * across that is possible (and `renderKeepingPlace()` now does hold every
 * scroller in the frame, which was worth fixing on its own), but it cannot
 * help here: the wall is not on screen while the picture is, so by the time
 * you press back the offset being remembered is the PICTURE's, which is zero.
 *
 * **SO THE PICTURE IS AN OVERLAY AND NOTHING IS DESTROYED.** Opening and
 * closing one is a local DOM operation inside this panel — no render, no
 * rebuild, and the wall underneath keeps its scroll because it was never
 * touched. It is also simply faster, and it leaves the heading and the rail
 * in place so you can still see which night you are looking into.
 */
function photoWall() {
  loadPhotoNights();
  const el = node('<div class="panel launchbar bench community-bench bay-scroller"></div>');
  const body = node('<div class="bay-body"></div>');

  /*
   * ONE PICTURE, OVER THE BAY. `contain` rather than `cover`, because this is
   * the moment somebody is actually LOOKING at it — a crop is right on a wall
   * of thumbnails and wrong here. Clicking anywhere on it goes back.
   *
   * **IT HANGS ON THE COLUMN, NOT ON THE SCROLLING GRID INSIDE IT** — and the
   * first version hung it on the grid, which put it in the wrong place the
   * moment anything was scrolled. `position: absolute; inset: 0` anchors to
   * the padding box of the nearest positioned ancestor, and for a SCROLLED
   * container that box starts at the top of the CONTENT rather than at the top
   * of what you can see. Reported off a screenshot as a picture floating over
   * the thumbnails with the grid showing round it; measured, it was 90px high
   * and 30px short — exactly the scroll offset.
   */
  const openIt = (shot) => {
    openShot = shot;
    const over = node(`
      <button class="community-big" type="button" aria-label="Back to the photographs">
        <img src="${esc(shot.url)}" alt="">
      </button>`);
    over.addEventListener('click', () => { openShot = null; over.remove(); });
    (body.closest('.bay-side') || body).appendChild(over);
  };

  if (openNight) {
    nightControls = node('<div class="photo-night-controls"></div>');
    nightControls.appendChild(myPhotos(openNight));
    nightPhotos(body, openNight, {
      wall: true,
      controlsInto: nightControls,
      onOpen: openIt,
    });
    el.appendChild(bayColumns(rail(openNight.night), [
      bayHead(readable(openNight.night), openNight.venue || ''), body,
    ]));
    return el;
  }

  const draw = (shots) => {
    body.replaceChildren();
    if (!shots.length) {
      body.appendChild(node(`<div class="tiny community-wall-none">No photographs yet. The
        camera is on the phones in the gaps, and whatever the room sends lands here.</div>`));
      return;
    }
    const grid = node('<div class="community-wall"></div>');
    for (const shot of shots) {
      /*
       * NO BIN ON THE WALL, deliberately. A bin belongs beside the night it
       * deletes from, where you can see which night that is — a thumbnail in
       * a mixed wall with a delete button on it is a mis-tap with no undo.
       * Open the night and every picture in it has one.
       */
      const tile = node(`
        <button class="cphoto filed is-openable" type="button" title="${esc(shot.where)}">
          <img src="${esc(shot.url)}" alt="" loading="lazy">
        </button>`);
      tile.addEventListener('click', () => openIt(shot));
      grid.appendChild(tile);
    }
    body.appendChild(grid);
    // A picture that was open when a state push rebuilt the page comes back
    // over the wall it was opened from, rather than vanishing mid-look. After
    // the grid, so `body.closest('.bay-side')` has somewhere to hang it.
    if (openShot) openIt(openShot);
  };

  if (wallShots) draw(wallShots);
  else {
    body.appendChild(node('<div class="tiny">Loading the photographs…</div>'));
    loadWall().then(draw).catch(() => draw([]));
  }
  el.appendChild(bayColumns(rail(''), [
    bayHead('The wall', `The last ${WALL_MAX} pictures the rooms sent.`), body,
  ]));
  return el;
}

/**
 * THE QUIZMASTER'S OWN PHOTOGRAPHS OF THE ROOM.
 *
 * Asked for on 29 August 2026: *"would be good to be able to add room photos
 * to the gallery that everyone sees, that I take from my own phone?"*
 *
 * **THE ROOM'S CAMERA IS SIXTY PHONES POINTED AT EACH OTHER.** What a venue
 * wants to be shown is the place FULL — the bar three deep, forty heads
 * looking at a projector — and that is a picture only the person at the front
 * takes. Every photo the gallery has ever held came in through a player's
 * phone, so the one shot that actually sells the night was the one with no way
 * in.
 *
 * **IT IS FILED AGAINST THE NIGHT IN THE URL, never against today.** The
 * room's own photo store dates a picture by the clock when it lands, so
 * anything sent on the Friday would file itself under the Friday. Naming the
 * night is what lets him do this in the car park, or on the Monday.
 *
 * **SCALED DOWN HERE, BEFORE IT IS SENT.** A modern phone photograph is five
 * to eight megabytes and the route caps at three — and this is a quizmaster on
 * pub wifi, which is the connection this app protects above all others.
 * `square: false`, unlike a player's photo: a picture of a room is a room, and
 * cropping it to a square for a wall of thumbnails would throw away the half
 * that shows how full it was.
 *
 * **ONE AT A TIME, IN ORDER, with the count going up as they land.** Firing
 * six at once is six GitHub writes racing on one folder, and a progress line
 * that only moves at the end reads as a page that has hung.
 */
function myPhotos(night) {
  const wrap = node(`
    <div class="mine-add">
      <label class="minor mine-pick">
        Add your own photos
        <input type="file" accept="image/*" multiple hidden>
      </label>
      <span class="tiny mine-said">Yours go on the gallery — they are what sells the night.</span>
    </div>`);
  const input = wrap.querySelector('input');
  const said = wrap.querySelector('.mine-said');
  const label = wrap.querySelector('.mine-pick');

  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    input.value = '';
    if (!files.length) return;
    label.classList.add('is-busy');
    let done = 0;
    for (const file of files) {
      said.textContent = `Sending ${done + 1} of ${files.length}…`;
      try {
        const blob = await shrink(file);
        const res = await fetch(keyed(`/api/past-photo/${encodeURIComponent(night.night)}`), {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'Could not add that one.');
        done += 1;
      } catch (err) {
        said.textContent = err.message;
        label.classList.remove('is-busy');
        return;
      }
    }
    said.textContent = `${done} added.`;
    label.classList.remove('is-busy');
    /*
     * THE WALL IS STALE NOW, so it is dropped rather than left showing the
     * night as it was a moment ago — the one thing worse than a slow wall is
     * one that does not have the picture you just watched it accept.
     */
    wallShots = null;
    renderKeepingPlace();
  });
  return wrap;
}

/** A phone photograph, down to something a pub's wifi can carry. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      try {
        const canvas = document.createElement('canvas');
        // `square: false` — a room is a room. 1600 rather than the phone's
        // 1280 because this one is meant to be looked at on a laptop.
        drawFiltered(canvas, img, 'none', 1600, { square: false });
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo.'))), 'image/jpeg', 0.85);
      } catch (err) { reject(err); }
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('That file is not a photo.')); };
    img.src = src;
  });
}

/** The photos rail, lit on whatever is showing. */
function rail(picked) {
  const list = bayRail({
    items: photoRail(),
    picked,
    railId: 'photos',
    // A rail is a picker, not the archive — the whole list, with its venue
    // cards and headcounts, is the tab body directly underneath.
    more: 'Older nights are in the list below.',
    onFold: () => renderKeepingPlace(),
    onPick: (key) => {
      openShot = null;
      nightControls = null;
      openNight = key ? (photoNights || []).find((n) => n.night === key) || null : null;
      renderKeepingPlace();
    },
    empty: 'No photographs yet.',
  });
  /*
   * A FAILED PUBLISH SAYS SO IN THE RAIL, under the row it happened on — never
   * an `alert` for something that went wrong in the background, and never a
   * silent revert, which reads as a lamp with a mind of its own.
   */
  if (pubTrouble) {
    list.appendChild(node(`<div class="tiny bay-rail-trouble">${esc(pubTrouble)}</div>`));
  }
  return list;
}

/** The newest pictures across the newest nights, up to a wall's worth. */
async function loadWall() {
  const res = await fetch(keyed('/api/past-gigs'));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load them');
  const nights = (data.nights || []).filter((n) => n.hasPhotos).slice(0, WALL_NIGHTS);
  const shots = [];
  for (const night of nights) {
    if (shots.length >= WALL_MAX) break;
    let one;
    try {
      const r = await fetch(keyed('/api/past-gigs/' + encodeURIComponent(night.night)));
      one = await r.json();
      if (!r.ok) continue;
    } catch { continue; }
    // Where it was taken, on the picture's own tooltip — the wall is mixed by
    // definition, so a thumbnail with no answer to "which night was that" is a
    // picture you cannot go and find again.
    const where = `${readable(night.night)}${night.venue ? ` — ${night.venue}` : ''}`;
    for (const p of one.photos || []) {
      shots.push({ url: p.url, where });
      if (shots.length >= WALL_MAX) break;
    }
  }
  wallShots = shots;
  return shots;
}

/*
 * EVERY TEAM IS IN THE BAY, AND THE BAY SCROLLS.
 *
 * It was capped at eight with "and N more, below" under it — which was true
 * only while the tab underneath drew the table as well. It does not any more:
 * *"if a quiz league appears at the top it shouldn't be at the bottom"*. A cap
 * plus a pointer at a table that no longer exists is a page lying about
 * itself, and the fixed bay height makes the cap unnecessary anyway: the
 * column scrolls inside a box that cannot grow, so a league of forty teams
 * costs nothing and is all reachable.
 */

/** Which venue the bay is showing. Module-level, or a state push resets it. */
let picked = '';

/**
 * THE LEAGUE BAY — venues down the left, that venue's table beside them.
 *
 * *"Options perhaps on the left hand side going down like the menu below
 * it."* Literally that: the rail is the same object as the tab column under
 * it — a stack of buttons, the lit one marked on its left edge — because a
 * second way of saying "pick one of these" on one screen is the label
 * collision this project keeps finding.
 *
 * **ONE VENUE AT A TIME, WHICH IS THE POINT.** The tab below lists every
 * league one after another and is the right shape for reading them all; a bay
 * is a glance, and "who is winning at The Crown" is a question about one pub.
 * The rail is what makes that a tap rather than a scroll.
 *
 * **NO CONTROLS UP HERE.** Publishing a table and overruling the filter on a
 * name both stay under the full table below, where the safeguard is that you
 * have just read the names you are about to put on a public page. Moving
 * either into the bay would put it above the thing it acts on.
 */
/** Which night the league bay is showing, if any. `''` is the season table. */
let leagueNight = '';

/**
 * THE LEAGUE BAY — the season at one venue, or one of its nights.
 *
 * Asked for on 29 August 2026, once the Photos bay had the shape: *"Quiz
 * league also needs a similar drop down for each night… perhaps the summary
 * (i.e. the actual quiz league table) is the one that displays when you click
 * venue, and then you can click each night to see who won and when on any
 * given night."*
 *
 * So the rail is the same object the Photos rail is: **a pub that folds, with
 * its nights inside it** — and the pub's own row, *The table*, is the first
 * one in the fold rather than the heading itself. That is deliberate: the
 * heading is the FOLD, and a heading that both folds and picks is one control
 * doing two jobs, which is the collision this app has a rule against. Pressing
 * the pub opens it; pressing *The table* shows the season.
 */
function leagueBay() {
  const leagues = leaguesNow();
  if (!leagues.some((l) => l.key === picked)) { picked = leagues[0].key; leagueNight = ''; }
  const league = leagues.find((l) => l.key === picked);
  const names = (published || {}).names || {};
  const evening = leagueNight && (league.evenings || []).find((e) => e.night === leagueNight);

  /*
   * ONE ROW PER PLACING, and the same `.lg-table` either way — the season and
   * a single night are the same object with a different column in the middle,
   * so drawing them with two components would be two things to keep in step.
   */
  const table = evening ? node(`
    <table class="lg-table">
      <thead>
        <tr>
          <th class="lg-pos" aria-label="Position"></th>
          <th class="lg-name">Team</th>
          <th class="lg-pts"><abbr title="What that placing was worth — the ladder plus the point for turning up">Pts</abbr></th>
        </tr>
      </thead>
      <tbody>
        ${evening.top.map((t) => `
          <tr${t.position === 1 ? ' class="lg-top"' : ''}>
            <td class="lg-pos">${t.position}</td>
            <td class="lg-name">${esc(t.name)}${hiddenNow(t, names)
    ? ' <span class="lg-hidden" title="This name is hidden on the public table and on a landlord\'s report. It still scores exactly as it is.">hidden publicly</span>'
    : ''}</td>
            <td class="lg-pts"><b>${t.points}</b></td>
          </tr>`).join('')}
      </tbody>
    </table>`) : node(`
    <table class="lg-table">
      <thead>
        <tr>
          <th class="lg-pos" aria-label="Position"></th>
          <th class="lg-name">Team</th>
          <th class="lg-played"><abbr title="Nights played">P</abbr></th>
          <th class="lg-played"><abbr title="Nights won">W</abbr></th>
          <th class="lg-pts"><abbr title="Points">Pts</abbr></th>
        </tr>
      </thead>
      <tbody>
        ${league.table.map((t) => `
          <tr${t.position === 1 ? ' class="lg-top"' : ''}>
            <td class="lg-pos">${t.position}</td>
            <!-- THE REAL NAME, MARKED WHEN IT WILL NOT PUBLISH. This is the
                 room's own view and the quizmaster was there, so nothing is
                 masked — but a name a public page would hide says so, or it
                 would vanish off a table they had put up with no way to tell
                 which one did it. Drawn from the COMBINE in hiddenNow(), so
                 a name a human has allowed stops claiming it is held back. -->
            <td class="lg-name">${esc(t.name)}${hiddenNow(t, names)
    ? ' <span class="lg-hidden" title="This name is hidden on the public table and on a landlord\'s report. It still scores exactly as it is.">hidden publicly</span>'
    : ''}</td>
            <td class="lg-played tiny">${t.played}</td>
            <td class="lg-played tiny">${t.wins}</td>
            <td class="lg-pts"><b>${t.points}</b></td>
          </tr>`).join('')}
      </tbody>
    </table>`);

  /*
   * THE RAIL: every venue, folded, with its own table row and its nights.
   * A venue's key is its own; a night's is `key|date`, so one flat list of
   * rows can address both without a second piece of state.
   */
  const items = [];
  for (const l of leagues) {
    items.push({
      key: l.key,
      group: l.venue,
      name: 'The table',
      note: `${l.table.length} team${l.table.length === 1 ? '' : 's'} · ${l.nights} night${l.nights === 1 ? '' : 's'}`,
    });
    for (const e of l.evenings || []) {
      /*
       * THE DATE AND NOTHING ELSE — *"save space here by just putting the
       * dates."*
       *
       * It carried *Won by …* underneath, on the reasoning that a rail which
       * answers before it is pressed is a better rail. That is true of a short
       * note and false of this one: a team called "Stephen Hawking Dance
       * School" wraps to two lines under the date, so a row meant to be
       * scanned became three lines tall and four nights filled the whole bay.
       *
       * **A RAIL IS A PICKER, AND THE THING IT PICKS IS ONE PRESS AWAY.** The
       * winner is the first row of the night itself, which is where somebody
       * looking for it is going anyway — so the note was buying a glance and
       * charging two-thirds of the rail for it.
       */
      items.push({ key: `${l.key}|${e.night}`, group: l.venue, name: readable(e.night) });
    }
  }

  const el = node('<div class="panel launchbar bench community-bench bay-scroller"></div>');
  el.appendChild(bayColumns(
    bayRail({
      items,
      picked: leagueNight ? `${picked}|${leagueNight}` : picked,
      railId: 'league',
      // NOT "on the public table" — that was true only while every venue had
      // one, and a venue that does not run a league now has no public page at
      // all. This says the thing that is true either way.
      more: 'Older nights still count towards the table.',
      onFold: () => renderKeepingPlace(),
      /*
       * THE WHOLE PAGE REPAINTS, not just the bay — because the CONTROLS for
       * this venue live in the tab body underneath, and a rail that changed the
       * table up here while leaving "put this table up" pointing at the pub
       * before it would publish the wrong room's names.
       */
      onPick: (key) => {
        const bar = key.indexOf('|');
        picked = bar < 0 ? key : key.slice(0, bar);
        leagueNight = bar < 0 ? '' : key.slice(bar + 1);
        renderKeepingPlace();
      },
    }),
    [
      bayHead(
        evening ? readable(evening.night) : league.venue,
        evening
          ? `${league.venue} · ${evening.teams} team${evening.teams === 1 ? '' : 's'}`
          : [
            `${league.table.length} team${league.table.length === 1 ? '' : 's'} across ${league.nights} night${league.nights === 1 ? '' : 's'}`,
            headsLine(league.venue),
          ].filter(Boolean).join(' · '),
      ),
      table,
    ],
  ));
  return el;
}

/**
 * WHAT THE PUBLIC WILL ACTUALLY SEE FOR ONE TEAM — the word list's verdict,
 * unless a human has overruled it.
 *
 * **This mirrors `hiddenForPublic()` on the server and must keep mirroring
 * it.** The two halves arrive separately on purpose: the filter's verdict
 * rides with the library (no I/O), the rulings come from the one GitHub read
 * this tab makes. The ROW'S KEY travels with the row so this combine cannot
 * drift — a second copy of `teamKey()` in the browser is how a ruling would
 * eventually land on the wrong team.
 */
function hiddenNow(row, names) {
  const said = names[row.key];
  if (said === 'allow') return false;
  if (said === 'hide') return true;
  return Boolean(row.nameHidden);
}

/**
 * OVERRULE THE FILTER, IN EITHER DIRECTION.
 *
 * *"Can I get a manual override so we're erring on the side of caution but I
 * can override it."* A word list is a guess about intent and the quizmaster
 * was in the room, so the list decides by default and this is where a person
 * says otherwise.
 *
 * **ONE PLACE, NOT A BUTTON PER ROW.** Ten teams times several venues is
 * thirty controls on a page whose job is being read, which is the clutter
 * rule exactly. It is folded away behind one line, under the table and beside
 * the publish control — which is also the moment somebody would want it:
 * checking the names before putting them up.
 *
 * **THE LIST SAYS WHAT WILL HAPPEN, not what the filter thought.** A name a
 * human has allowed reads "on the public table" like any other, with a quiet
 * mark saying the decision was theirs, so the page never argues with itself.
 */
function nameReview(league, names, onRuled) {
  const rows = league.table || [];
  const wrap = node('<div class="lg-review"></div>');

  const paint = () => {
    const held = rows.filter((r) => hiddenNow(r, names)).length;
    wrap.replaceChildren();
    const head = node(`
      <button class="minor lg-review-open" type="button" aria-expanded="false">
        Check the names${held ? ` — ${held} held back` : ''}
      </button>`);
    const list = node('<div class="lg-review-list" hidden></div>');

    for (const row of rows) {
      const hidden = hiddenNow(row, names);
      const said = names[row.key] || '';
      const line = node(`
        <div class="lg-review-row">
          <span class="lg-review-name">${esc(row.name)}</span>
          <span class="tiny lg-review-state">${hidden ? 'Held back' : 'On the public table'}${
  said ? ` <span class="lg-review-yours">your call</span>` : ''}</span>
        </div>`);
      // Outlined red to hide, ordinary to show — the app's own roles, so the
      // more consequential direction reads as the more consequential one.
      const btn = node(hidden
        ? '<button class="minor lg-review-go" type="button">Show it</button>'
        : '<button class="minor danger lg-review-go" type="button">Hide it</button>');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        /*
         * A RULING THAT ONLY RESTATES THE FILTER IS CLEARED, not stored. If
         * the word list would have hidden it anyway, "hide" is the list's own
         * answer and keeping a human ruling beside it means a later change to
         * the list silently cannot reach this name. Same rule as the gap
         * dial's `cleanPlan()`: only what actually differs is recorded.
         */
        const want = hidden ? 'allow' : 'hide';
        const decision = want === (row.nameHidden ? 'hide' : 'allow') ? '' : want;
        try {
          const res = await fetch(keyed('/api/league/name'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: row.name, decision }),
          });
          const out = await res.json();
          if (!res.ok) throw new Error(out.error || 'Could not change that.');
          if (decision) names[row.key] = decision; else delete names[row.key];
          onRuled();
          paint();
          list.hidden = false;
          head.setAttribute('aria-expanded', 'true');
        } catch (err) {
          btn.disabled = false;
          line.appendChild(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
        }
      });
      line.appendChild(btn);
      list.appendChild(line);
    }

    head.addEventListener('click', () => {
      list.hidden = !list.hidden;
      head.setAttribute('aria-expanded', String(!list.hidden));
    });
    wrap.append(head, list);
  };

  paint();
  return wrap;
}

/**
 * DOES THIS VENUE RUN A LEAGUE — the switch everything outward depends on.
 *
 * Asked for on 31 August 2026: *"quiz leagues should be turn on and offable as
 * well — it's useful to have the information regardless, but from the point of
 * view of showing a page that is quiz league format it might be misleading if
 * this app just had that as standard even in venues that don't have a quiz
 * league."*
 *
 * **THE TABLE IS ARITHMETIC; A LEAGUE IS A THING YOU RUN.** Every venue with
 * two filed nights has a table, because finishing positions always add up. A
 * pub where nobody has ever mentioned a league does not have one, and printing
 * a season table in that landlord's report says otherwise — which is the app
 * asserting something about somebody else's night.
 *
 * **SO THIS GATES WHAT LEAVES AND NOTHING THE QUIZMASTER SEES.** The bay draws
 * every venue's table either way; this decides whether it reaches the report
 * and whether it can go public at all.
 *
 * **AND THE CONTROLS UNDER IT ARE ABSENT RATHER THAN GREYED, which is the one
 * place this app does that on purpose.** *A control is present and inert,
 * never absent* is about a control that comes and goes AS YOU WORK — a thumb
 * has to learn where it is. Publishing a league at a pub that does not run one
 * is not a disabled action, it is a question that does not arise, and offering
 * it would say the opposite of what the switch above just said.
 */
function runningToggle(key, on) {
  const wrap = node('<div class="lg-running"></div>');

  const paint = (live) => {
    wrap.replaceChildren(node(`
      <div class="tiny">${live
    ? 'This pub runs a league — the table goes on its report, and can go on a public page.'
    : 'No league here yet. The table is still worked out and shown above; it just stays in this console.'}</div>`));
    const btn = node(live
      ? '<button class="minor danger lg-run-off" type="button">This pub does not run a league</button>'
      : '<button class="minor lg-run-on" type="button">This pub runs a league</button>');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(keyed('/api/league/running'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ venueKey: key, on: !live }),
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out.error || 'Could not change that.');
        /*
         * SWITCHING IT OFF TAKES THE PUBLIC TABLE DOWN TOO — the server does
         * that, and the answer carries both lists back, so the page repaints
         * from what was actually recorded rather than from what was asked
         * for. A publish control still claiming "on the public table" under a
         * pub that no longer runs one is the app disagreeing with itself.
         */
        published = { ...published, running: out.running || [], venues: out.venues || [] };
        renderKeepingPlace();
      } catch (err) {
        btn.disabled = false;
        wrap.appendChild(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
      }
    });
    wrap.appendChild(btn);
  };

  paint(Boolean(on));
  return wrap;
}

/**
 * PUT THIS VENUE'S TABLE ON A PUBLIC PAGE, or take it back down.
 *
 * Asked for on 25 August 2026 — *"can that be exported to the landlord and
 * the quiz teams to view?"* The landlord's half went on the report PDF he
 * already receives; this is the teams' half, and it is a PUBLIC page, so it
 * gets the gallery's safeguards rather than a lighter version of them:
 *
 * - **The control is drawn UNDER the table it publishes**, so nobody puts a
 *   pub's teams online without having just looked at the names.
 * - **It says what publishing means in one line**, read before pressing. Not
 *   red: red would say a mistake had been made, and this is a choice.
 * - **Taking it down is as prominent as putting it up**, outlined red. A team
 *   will ask, and the honest answer is a quizmaster who can do it while stood
 *   there.
 * - **Per VENUE, not per night** — a league IS a season, so there is no
 *   per-night decision to make.
 *
 * `?q=` names whose page it is, or the link falls back to the owner's own
 * room — the exact fault the gallery link was fixed for once already.
 */
function leagueToggle(key, venue, on) {
  const wrap = node('<div class="gig-gallery"></div>');
  /*
   * THE ADDRESS, WRITTEN OUT — asked for on 31 August 2026: *"I want to be
   * able to have the URLs conveniently reachable."* A link somebody has to
   * construct is a link nobody hands out, so the page says what it is.
   *
   * **THE PRETTY FORM IS THE OWNER'S OWN**, because the pretty path resolves
   * against the owner's room; anybody else gets the same page with `?q=` on
   * it, which is exactly what they had before addresses existed. So the
   * console prints whichever one will actually work for the account reading
   * it, rather than an address that looks nicer and 404s.
   */
  const slug = venueSlug(venue);
  // ANSWERED BY THE SERVER, never guessed here — see `ownAddress` in
  // `/api/me`. `role === 'owner'` was wrong in both directions.
  const mine = Boolean(me && me.ownAddress);
  const link = mine && slug
    ? `/${slug}/quiz-league`
    : `/league${me?.id ? `?q=${encodeURIComponent(me.id)}` : ''}`;

  const paint = (live) => {
    wrap.replaceChildren(node(live
      ? `<div class="tiny gig-gal-live">On the public table —
           <a href="${esc(link)}" target="_blank" rel="noopener">see it</a>
           <code class="pub-address">${esc(location.host + link)}</code></div>`
      : '<div class="tiny gig-gal-note">Anyone with the link can see these team names.</div>'));

    const btn = node(live
      ? '<button class="minor danger lg-pub-off" type="button">Take this table down</button>'
      : '<button class="minor lg-pub-on" type="button">Put this table up for the teams</button>');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(keyed('/api/league/publish'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ venueKey: key, on: !live }),
        });
        const out = await res.json();
        // SAY WHAT WENT WRONG — the likeliest failure by a distance is that
        // the private repository is not configured, and "could not save that"
        // would send somebody hunting through the app for a fault that is in
        // an environment variable.
        if (!res.ok) throw new Error(out.error || 'Could not change that.');
        paint(!live);
      } catch (err) {
        btn.disabled = false;
        wrap.appendChild(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
      }
    });
    wrap.appendChild(btn);
  };

  paint(Boolean(on));
  return wrap;
}

/**
 * WHICH TABLES ARE UP AND WHAT A HUMAN HAS RULED — fetched once, then held.
 *
 * A GitHub read, so it rides on the tab being opened rather than on the
 * library: a fact that changes twice a season must not cost a network call per
 * state push. Held in a module binding because the door is rebuilt on every
 * push, and because the BAY needs it too — it draws the `hidden publicly`
 * marks from the same combine the controls act on, and two fetches would be
 * two answers.
 */
let published = null;
let asking = false;

function loadPublished() {
  if (published || asking) return;
  asking = true;
  fetch(keyed('/api/league/published'))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return;
      published = { venues: d.venues || [], names: d.names || {}, running: d.running || [] };
      /*
       * ONE REPAINT WHEN IT LANDS, and it has to be the whole page: the marks
       * are in the BAY and the controls are in the tab body, so painting one
       * of them would leave the other saying something else. Guarded by
       * `published` itself, so this happens once rather than on every render.
       */
      renderKeepingPlace();
    })
    .catch(() => {})
    .finally(() => { asking = false; });
}

/**
 * THE LEAGUE TAB — THE CONTROLS, AND NOT THE TABLE.
 *
 * *"If a quiz league appears at the top it shouldn't be at the bottom — the
 * bottom is for controls and options, not for displaying the actual thing."*
 * So the table is in the bay, once, and this is what you DO about it: put it
 * up for the teams, take it down, and overrule the filter on a name.
 *
 * **THE CONTROLS FOLLOW THE VENUE IN THE BAY.** There is one set of them and
 * they act on whatever the rail is pointing at, which is why the rail
 * repaints the page rather than only the bay. A control per venue stacked
 * down this tab would be the duplicate display again wearing buttons.
 *
 * **THE SAFEGUARD SURVIVES THE MOVE, and that was the thing to check.** The
 * rule is that nobody publishes a pub's team names without having just looked
 * at them — it was kept by drawing the button UNDER the table. In a fixed
 * frame the bay is on screen while this is pressed, with the names in it, so
 * the button is still directly beneath the thing it publishes. What would
 * break the rule is a control on a screen the table is not on, and there
 * isn't one.
 */
export function leagueSection() {
  const leagues = leaguesNow();
  const wrap = document.createDocumentFragment();

  if (!leagues.length) {
    wrap.appendChild(node(`
      <div class="panel">
        <p>No league has started yet. It builds itself out of the nights you file — ten
          points for a win, plus one for every night a team plays, over a rolling
          twelve-week season — and their best six finishes are what count.</p>
        <p class="tiny">A night needs a venue on it to belong to a league, and bingo
          nights score nobody: a bingo board is who was dealt a good card rather than a
          finishing order, and awarding league points for it would put somebody top for
          being lucky.</p>
      </div>`));
    return wrap;
  }

  loadPublished();
  const league = leagues.find((l) => l.key === picked) || leagues[0];

  wrap.appendChild(node(`
    <p class="tiny">Ten points for a win, down to two for seventh, plus <b>one for every
      night a team plays</b> — and their <b>best six finishes</b> are the ones that count
      towards the total. So a fortnight away costs two points rather than a season, and
      turning up every week is always worth something. Rolling twelve-week season. A team
      is the name they type on the night, so a change of spelling starts a new team — there
      is no sign-up, and that is what keeps it free to join at the door. Names go on the big
      screen exactly as typed; a few are held back from the <b>public</b> table and the
      landlord's report, and they are marked in the table above.</p>`));

  const panel = node(`
    <div class="panel league-panel">
      <div class="league-head">
        <b>${esc(league.venue)}</b>
        <span class="tiny">${league.table.length} team${league.table.length === 1 ? '' : 's'}
          across ${league.nights} night${league.nights === 1 ? '' : 's'} — showing above</span>
      </div>
    </div>`);
  /*
   * UNTIL THE RULINGS ARRIVE THERE IS NO CONTROL, rather than a guessed one.
   * A button saying "put this up" on a table that is already up would be a lie
   * for as long as the fetch takes, and the one thing this must never do is
   * misstate what is public.
   */
  if (published) {
    /*
     * DOES THIS PUB RUN A LEAGUE — first, because everything under it depends
     * on the answer. *"It's useful to have the information regardless, but…
     * it might be misleading if this app just had that as standard even in
     * venues that don't have a quiz league."*
     */
    panel.appendChild(runningToggle(league.key, published.running.includes(league.key)));
    if (published.running.includes(league.key)) {
      panel.appendChild(nameReview(league, published.names, () => renderKeepingPlace()));
      panel.appendChild(leagueToggle(league.key, league.venue, published.venues.includes(league.key)));
    }
  } else {
    panel.appendChild(node('<div class="tiny">Checking what is published…</div>'));
  }
  wrap.appendChild(panel);
  return wrap;
}

/** This venue's headcount, as the one line a card already shows. */
function headsLine(venue) {
  const key = String(venue || '').trim().toLowerCase();
  const entry = ((library.headcounts || {}).venues || [])
    .find((v) => String(v.venue || '').trim().toLowerCase() === key);
  if (!entry || !entry.latest) return '';
  if (!entry.first || entry.first.players === entry.latest.players) {
    return `${entry.latest.players} playing`;
  }
  return `${entry.first.players} → ${entry.latest.players} playing`;
}

/**
 * THE PHOTOS TAB — THE LIST YOU PICK FROM, AND WHAT YOU DO ABOUT ONE NIGHT.
 *
 * ---
 *
 * Asked for on 23 August 2026: *"photos can actually migrate to community as
 * well now, and anything else to do with the people who do the quizzing"* —
 * and rearranged on 29 August: *"the bottom is for controls and options, not
 * for displaying the actual thing, so you click the thing at the bottom to
 * reveal it at the top."*
 *
 * So this tab draws NO photographs. It is venues, then nights inside them —
 * options — and under the night you opened, the one control that acts on it.
 * The pictures themselves are in the bay, where there is a whole screen for
 * them and where they are still on screen while this is read.
 *
 * **THE PER-NIGHT GRID ON PAST GIGS STAYS, and that is not a duplicate.** The
 * same pictures do two different jobs: on Past gigs a photo is EVIDENCE, sat
 * beside the headcount, the winner and the report you hand a landlord; here it
 * is the room itself. **What is not duplicated is the CODE** — the figures,
 * the bin, the "Screen only" badge and the publish control are `nightPhotos()`
 * in `console-gigs.js`, called from both, so the confirm wording and the
 * safeguard have one definition.
 *
 * **A NIGHT WITH NO PICTURES IS NOT LISTED.** This tab is the photographs; a
 * row saying a night has none belongs on the page about nights.
 */
export function photosSection() {
  const el = node('<div></div>');
  const note = node('<div class="tiny"></div>');
  const wrap = node('<div class="venue-cards"></div>');
  el.append(note, wrap);

  const open = new Set();
  let groups = { venues: [], unfiled: [] };

  const draw = () => {
    wrap.replaceChildren();
    const all = [...groups.venues, ...(groups.unfiled.length
      ? [{ key: '', venue: 'No venue on these', nights: groups.unfiled }] : [])];
    if (!all.length) {
      wrap.appendChild(node(`<div class="tiny">No photographs yet. The camera is on the
        phones in the gaps, and whatever the room sends lands here.</div>`));
      return;
    }
    for (const entry of all) wrap.appendChild(venuePhotos(entry));
  };

  const venuePhotos = (entry) => {
    const isOpen = open.has(entry.key);
    const card = node(`
      <div class="venue-card ${isOpen ? 'is-open' : ''}">
        <button class="venue-top" type="button" aria-expanded="${isOpen}">
          <span class="venue-name">${esc(entry.venue)}</span>
          <span class="tiny">${entry.nights.length} night${entry.nights.length === 1 ? '' : 's'} with photos</span>
        </button>
      </div>`);
    card.querySelector('.venue-top').addEventListener('click', () => {
      if (isOpen) open.delete(entry.key); else open.add(entry.key);
      draw();
    });
    if (!isOpen) return card;
    for (const night of entry.nights) card.appendChild(nightRow(night));
    return card;
  };

  const nightRow = (night) => {
    const showing = Boolean(openNight) && openNight.night === night.night;
    const row = node(`
      <div class="photo-night ${showing ? 'is-showing' : ''}">
        <button class="photo-night-top" type="button" aria-pressed="${showing}">
          <b>${esc(readable(night.night))}</b>
          <span class="tiny">${showing ? 'Showing above — press to close' : 'Show these above ▸'}</span>
        </button>
      </div>`);
    /*
     * ONE PRESS PUTS IT IN THE BAY AND THE NEXT PRESS TAKES IT BACK OUT, which
     * is the whole model: the list is what you press and the bay is what
     * answers. The page repaints because the bay is built by a different call
     * inside the same `render()`.
     */
    row.querySelector('.photo-night-top').addEventListener('click', () => {
      if (showing) closeNight(); else { openNight = night; openShot = null; nightControls = null; }
      renderKeepingPlace();
    });
    /*
     * AND THE PUBLISH CONTROL IS DRAWN ONLY FOR THE NIGHT THAT IS SHOWING.
     * The safeguard is unchanged in substance — nobody publishes a night
     * without having just looked at what is in it — because the pictures are
     * in the bay, on screen, directly above this button. What it must never
     * become is a button on a row whose photographs nobody has opened.
     */
    if (showing && nightControls) row.appendChild(nightControls);
    return row;
  };

  (async () => {
    let data;
    try {
      const res = await fetch(keyed('/api/past-gigs'));
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      wrap.replaceChildren(node(`<div class="tiny">${esc(err.message)}</div>`));
      return;
    }
    if (!data.photosKept) {
      note.innerHTML = '<b style="color:var(--gold)">Photos are not being kept permanently yet.</b> '
        + 'They are on this server only, and it forgets them on the next restart.';
    }
    const withPhotos = (data.nights || []).filter((n) => n.hasPhotos);
    groups = groupByVenue(withPhotos, library.headcounts || { venues: [] });
    /*
     * THE VENUE OF THE NIGHT IN THE BAY IS OPENED, so arriving with one
     * showing does not leave its row folded away inside a shut card — the
     * bay would be describing a night nothing on the page points at.
     */
    if (openNight) {
      for (const entry of groups.venues) {
        if (entry.nights.some((n) => n.night === openNight.night)) open.add(entry.key);
      }
    }
    draw();
  })();

  return el;
}

/** A night's date, said the way a person says it. */
function readable(night) {
  const d = new Date(`${night}T12:00:00`);
  if (Number.isNaN(d.getTime())) return night;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * WHAT THE ROOM ASKED FOR — moved here, not copied.
 *
 * It lived above the quiz generator on the Music Quiz tab, on the reasoning
 * that it answers *"what should I write next"* and so belongs where that is
 * decided. That reasoning is still true and it lost to a better one: **this is
 * the players' own voice, three buttons on their phones at the end of the
 * night, and the players now have a door.**
 *
 * **IT MOVED RATHER THAN BEING COPIED BECAUSE IT IS A QUEUE.** Yes keeps it,
 * No bins it — a triage list drawn in two places is two lists that disagree
 * about what has been dealt with, which is the note the old placement already
 * carried. A LINK is left on the quiz tab when something is waiting, which is
 * this project's own rule for "do it over there".
 */
export function asksSection() {
  const wrap = document.createDocumentFragment();
  wrap.appendChild(node(`<p class="tiny">Three buttons on the phone at the end of the
    night, so nothing a stranger types ever reaches you — what comes back is a VOTE,
    which can be counted. Yes keeps it on the list; No bins it for good.</p>`));
  /*
   * AN EMPTY STATE, because this tab IS the list — see `asksPanel`'s own note
   * on why the same panel draws nothing where it used to live. The switch is
   * off unless somebody turns it on, so "nothing here" has two very different
   * causes and the page has to say which: never asked, or asked and nobody
   * voted. It links to the switch rather than naming it, which is this
   * project's rule for "do it over there".
   */
  wrap.appendChild(asksPanel({
    whenEmpty: () => node(`
      <div class="panel">
        <p>${(library.prefs || {}).askRounds
    ? 'Nothing yet. The card goes up on the phones at the end of a night — whatever the room votes for lands here.'
    : `The phones are not being asked. Turn <b>Ask the room what they want next</b> on
       in ${goTo('account', 'account', 'My account')}, and the card goes up at the end
       of every night.`}</p>
      </div>`),
  }));
  return wrap;
}
