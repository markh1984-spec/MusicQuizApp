/** GIGS — the evidence: headcounts, what the room asked for, and nights run. */

import { binIcon, pinIcon, esc, node } from './client.js';
import { nightSlug, venueSlug } from './slugs.js';
import { library, me, nightBench, setGigsSeen, setNightDrag } from './console-state.js';
import { dragging, putNightOnBench } from './console-tonight.js';
import { hostKey, keyed } from './console.js';
import { tonight } from './diary.js';

/*
 * WHICH VENUE CARD IS OPEN — module-level, same as `openVenue` in
 * console-venues.js, and for the identical reason: picking a night puts it
 * on the bench through `putNightOnBench()`, which re-renders the WHOLE
 * console so the door head picks up the change. A variable local to
 * `pastGigsSection()` would be thrown away and rebuilt on every one of those
 * re-renders, so the card you just picked a night out of would shut itself
 * the moment you picked it.
 */
let openVenueKey = '';

/**
 * WHOSE NIGHT IS TONIGHT — the cheapest diary there is.
 *
 * Asked for as *"the quick launch should remember what you did the previous
 * week"*, and then better: *"or perhaps know which venue from the diary?"*
 * The diary is the right source and is the one thing here that does not exist
 * — `FEATURES.CALENDAR` is on Bronze and still says "Not built yet". But the
 * useful half of a diary is not a list of dates, it is **which venue has you
 * on a Thursday**, and that is one field on a record the quizmaster already
 * keeps. TODO.md had already reasoned to the same place: *"a usual night,
 * optionally, on the customer — which is what turns the list into a
 * calendar"*.
 *
 * Two sources, in this order, and the order is the whole design:
 *
 * 1. **The venue whose usual night is tonight.** Stated by the quizmaster
 *    rather than guessed from history, so it is right on the first week and
 *    right for somebody with two residencies — where "last week" would be
 *    wrong every other night.
 * 2. **Otherwise the venue of your most recent night.** `library.venues` is
 *    already ordered newest-first off the archive, so this is free and it is
 *    the "remember last week" that was asked for. It carries a one-venue host
 *    who has set nothing up at all.
 *
 * **TWO VENUES CLAIMING TONIGHT MEANS NEITHER GETS IT.** Not a double booking
 * — one quizmaster is in one room, so at most one of them is real. It is the
 * APP holding two answers for one night, and picking whichever sorted first
 * would put one pub's prizes in front of another pub's room. Nothing is
 * offered and the picker is left alone, which is exactly what happens today.
 *
 * **6AM ROLL-OVER**, the same as the photos and Past gigs. A quiz that runs
 * past midnight is still Thursday's night, so a host launching a second game
 * at half twelve must not suddenly be offered Friday's pub.
 *
 * Nothing here is silent: the launch bar prints the venue on the button and
 * the pack card shows it in the picker with the prizes underneath. A guess
 * nobody can see is worse than no guess, because the failure it produces —
 * the wrong pub's prize on the winner's phone — surfaces at the end of the
 * night in front of the room.
 */
export function tonightsVenue() {
  /*
   * The diary answers this now, which means a ONE-OFF beats a residency: the
   * Tuesday you are standing in somewhere has to win over the Tuesday you
   * normally do and are not doing this week. When this lived here it could
   * only see usual nights, so a diary entry for tonight was invisible to the
   * one control that most needed it.
   */
  return tonight({
    venues: library.venueRecords || [],
    bookings: library.bookings || [],
    playedVenues: library.venues || [],
  });
}

/* ==================================================== HEADCOUNT PER VENUE
 *
 * *"The Crown went from 22 on a Thursday to 58"* — the most persuasive
 * sentence a quizmaster owns, and until now the app knew it and never said it.
 * Every night's headcount has been in the archive since the app was written;
 * nobody had ever seen the number twice.
 *
 * **ONE RECORD, DRAWN ON BOTH TABS, and the summary line is the same function
 * either place.** `library.headcounts` is worked out once on the server (see
 * `venueHeadcounts`), so the Venues tab and Past gigs cannot arrive at two
 * different answers about a number somebody is showing a landlord. Both use
 * the same `.venue-card` component too: shut, `headcountLine()` is the whole
 * gist; the Venues tab opens into the full history and the prizes, Past gigs
 * opens into the nights themselves — see `venueCard()` further down.
 *
 * The bars are `aria-hidden` on purpose: every number they draw is written out
 * next to them, so nothing is carried by a shape alone.
 */

/** This venue's numbers, out of the one record. */
function headsFor(venue) {
  const want = String(venue || '').trim().toLowerCase();
  if (!want) return null;
  return ((library.headcounts || {}).venues || [])
    .find((v) => (v.venue || '').toLowerCase() === want) || null;
}

/**
 * The sentence, and it is deliberately the whole of what the numbers say.
 *
 * "22 → 58" first and loudest, because the growth is the argument. The rest is
 * the supporting detail somebody quotes when a landlord pushes back — and it
 * is left off a venue with one night, where "best" and "on average" are three
 * ways of printing the same number.
 */
function headcountLine(entry) {
  if (entry.nights < 2) {
    return `<div class="heads-line"><b class="heads-big">${entry.latest.players} playing</b>
      <span class="tiny">one night so far</span></div>`;
  }
  return `<div class="heads-line">
    <b class="heads-big">${entry.first.players} <span class="heads-arrow">→</span> ${entry.latest.players}</b>
    <span class="tiny">across ${entry.nights} nights · best ${entry.best} · ${entry.average} on average</span>
  </div>`;
}

/**
 * EVERY NIGHT AT ONE VENUE, newest first.
 *
 * Newest first like every other list of nights in this app, and the bar is
 * what makes it a trend rather than a column of numbers. It scrolls past a
 * dozen rather than being cut off at one: a residency of two years is a
 * hundred nights, and "and 88 earlier" on the page whose whole job is showing
 * somebody your work is the wrong half to keep.
 */
function headcountHistory(entry) {
  const rows = [...entry.series].reverse();
  return `<div class="heads-nights">${rows.map((n) => `
    <div class="heads-night">
      <span class="hn-when">${esc(shortNight(n.night))}</span>
      <span class="hn-bar" aria-hidden="true"><i style="width:${Math.max(4, Math.round((n.players / entry.best) * 100))}%"></i></span>
      <span class="hn-num">${n.players}</span>
    </div>`).join('')}</div>`;
}

/** "Thu 13 Aug", and the year only when it is not this one. */
function shortNight(date) {
  const when = new Date(date + 'T12:00:00');
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (when.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return when.toLocaleDateString('en-GB', opts);
}

/**
 * THE LEAGUE TABLE ON A VENUE'S CARD.
 *
 * Underneath the headcount, because the two answer a landlord's two questions
 * in the order he asks them: **how many came**, then **are they the same
 * people**. The headcount sells the room; the league is what keeps it.
 *
 * **The top five and no more.** A card is scanned, not studied — this is the
 * shape of the thing, and the wall poster is the place for twenty rows. The
 * count underneath says how many teams are in it, so a five-row table never
 * reads as the whole league.
 *
 * **It says how a team is identified, in one line.** A team is the name typed
 * on a phone, so a spelling change starts a new team and there is no way for
 * the app to know. Somebody pinning this to a wall has to know that, and the
 * house rule is that a warning earns its words where a blurb does not.
 */
export function leagueBlock(venue) {
  const league = (library.leagues || {})[String(venue || '').trim().toLowerCase()];
  if (!league || !league.table.length) {
    return `<div class="heads league">
      <div class="heads-tag">Quiz league</div>
      <div class="tiny">No quiz nights here yet this season. The table builds itself
        from the results — there is nothing to set up.</div>
    </div>`;
  }

  const top = league.table.slice(0, 5);
  return `<div class="heads league">
    <div class="heads-tag">Quiz league</div>
    <table class="lg-table">
      <thead>
        <tr>
          <th class="lg-pos" aria-label="Position"></th>
          <th class="lg-name">Team</th>
          <!-- Abbreviated because the column is two characters wide on a phone
               and every pub league table in the country abbreviates them. The
               full words are on the screen-reader label. -->
          <th class="lg-played"><abbr title="Nights played">P</abbr></th>
          <th class="lg-pts"><abbr title="Points">Pts</abbr></th>
        </tr>
      </thead>
      <tbody>
        ${top.map((t) => `
          <tr${t.position === 1 ? ' class="lg-top"' : ''}>
            <td class="lg-pos">${t.position}</td>
            <td class="lg-name">${esc(t.name)}</td>
            <td class="lg-played tiny">${t.played}</td>
            <td class="lg-pts"><b>${t.points}</b></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="tiny lg-note">${league.table.length} team${league.table.length === 1 ? '' : 's'}
      across ${league.nights} night${league.nights === 1 ? '' : 's'} · best six, plus one a night.
      A team is the name they type, so a change of spelling starts a new one.</div>
  </div>`;
}

/** What a venue card shows about how many have played there. */
export function headcountBlock(venue) {
  const entry = headsFor(venue);
  if (!entry) {
    return `<div class="heads">
      <div class="heads-tag">Headcount</div>
      <div class="tiny">No nights recorded here yet.</div>
    </div>`;
  }
  return `<div class="heads">
    <div class="heads-tag">Headcount</div>
    ${headcountLine(entry)}
    ${headcountHistory(entry)}
  </div>`;
}

/*
 * THE GIGS TAB USED TO PUT EVERY VENUE'S HEADCOUNT IN ITS OWN PANEL, ABOVE
 * A FLAT LIST OF EVERY NIGHT — two views of the same archive, agreeing with
 * each other by construction but reading as two different pages you scroll
 * past to find one night. It also had a bug this rewrite fixed along the
 * way: `venueHeadcounts()` keyed on the venue's id when a night had one and
 * on the lowercase NAME otherwise, so a pub picked off the Venues list one
 * week and typed freehand the next showed up as two half-histories under
 * the same name — see the merge pass added to `venueHeadcounts()` in
 * `src/headcounts.js`.
 *
 * Now there is ONE list, of venues, each one a card — same component the
 * Venues tab already uses (`.venue-card`/`.venue-top`/`.venue-name`), so a
 * quizmaster is not learning a second shape for the same idea. Shut, a card
 * shows the venue's headcount line, which is the number the old separate
 * panel existed to show. Open, it shows every night there, each one a
 * button — pressing a night does not expand anything inline; it loads that
 * night's full detail into the BAY at the top of the tab, so there is
 * always exactly one place a night's photos, invoice button and gallery
 * toggle live, however many venues are open at once.
 */

/**
 * WHAT THE ROOM ASKED FOR — yes or no, and no is a delete.
 *
 * The people who played, asking for what they want next time, from their own
 * phones at the end of the night. A separate box from the quizmasters' one:
 * that is subscribers writing to the owner and is read as a work queue with
 * somebody waiting for a reply, and strangers' one-liners from a pub would
 * bury it.
 *
 * **THE TRIAGE IS THE FEATURE.** The host's own shape: a bad idea is one tap
 * and gone for ever, a good one moves to the list of things worth writing.
 * That is this file's Monday rule applied — a queue that shrinks as you work
 * it costs a fraction of one that only grows — and it is why there is no
 * "rejected" state to browse.
 *
 * Grouped by idea, most-asked first, because four people wanting reggae is a
 * different fact from one person asking four times, and it is the number that
 * decides whether it is worth a pack.
 */
export function asksPanel({ whenEmpty = null } = {}) {
  /*
   * `whenEmpty` EXISTS BECAUSE THE SAME PANEL ANSWERS TWO DIFFERENT PAGES.
   *
   * Drawing NOTHING was right where this used to live: it sat above the quiz
   * generator, and a box saying "nobody has asked for anything" on the page
   * you open to write a quiz is furniture. On its own tab on the Community
   * door it is the opposite — a tab whose entire job is this list, showing a
   * blank page, reads as broken to the person most likely to be checking
   * whether the feature works at all.
   *
   * One optional argument rather than a second panel, so the triage — Yes
   * keeps it, No bins it, grouped by idea — has one definition.
   */
  const el = node('<div></div>');
  const draw = (data) => {
    const asked = data.asked || [];
    const kept = data.kept || [];
    if (!asked.length && !kept.length) {
      el.replaceChildren(...(whenEmpty ? [whenEmpty()] : []));
      return;
    }
    el.replaceChildren(node(`
      <div class="panel asks">
        <h3>What the room asked for</h3>
        <div class="tiny">From the phones that played. Yes keeps it on the list; No bins it.</div>
        ${!asked.length ? '' : `<div class="ask-rows">
          ${asked.map((a) => `
            <div class="ask-row" data-ids="${esc(a.ids.join(','))}">
              <div class="ask-what">
                <b>${esc(a.text)}</b>
                ${a.count > 1 ? `<span class="ask-count">×${a.count}</span>` : ''}
                ${a.venues.length ? `<div class="tiny">${esc(a.venues.join(' · '))}</div>` : ''}
              </div>
              <div class="ask-do">
                <button class="minor ask-yes">Yes</button>
                <button class="minor danger ask-no">No</button>
              </div>
            </div>`).join('')}
        </div>`}
        ${!kept.length ? '' : `
          <div class="tiny asks-kept-head">Worth doing</div>
          <div class="ask-rows kept">
            ${kept.map((k) => `
              <div class="ask-row" data-ids="${esc(k.ids.join(','))}">
                <div class="ask-what"><b>${esc(k.text)}</b>${
  k.count > 1 ? `<span class="ask-count">×${k.count}</span>` : ''}</div>
                <div class="ask-do"><button class="minor ask-done" title="Written — take it off the list">Done</button></div>
              </div>`).join('')}
          </div>`}
      </div>`));

    for (const row of el.querySelectorAll('.ask-row')) {
      const ids = (row.dataset.ids || '').split(',').filter(Boolean);
      const send = async (method, path) => {
        // A grouped row is several rows underneath — all of them move together,
        // because saying yes to "a reggae round" twice is not two decisions.
        let latest = data;
        for (const id of ids) {
          const res = await fetch(keyed(`/api/asks/${encodeURIComponent(id)}${path}`), { method });
          if (res.ok) latest = await res.json();
        }
        draw(latest);
      };
      row.querySelector('.ask-yes')?.addEventListener('click', () => send('POST', '/keep'));
      row.querySelector('.ask-no')?.addEventListener('click', () => send('DELETE', ''));
      row.querySelector('.ask-done')?.addEventListener('click', () => send('DELETE', ''));
    }
  };

  (async () => {
    try {
      const res = await fetch(keyed('/api/asks'));
      if (res.ok) draw(await res.json());
    } catch (err) {
      // Say why. A swallowed error here is a panel that silently is not there,
      // which is exactly the fault this file records about the console's own
      // loader: failure messages have to name the cause.
      console.error('[asks] could not load them:', err);
    }
  })();
  return el;
}

export function gigsSection() {
  /*
   * THE DIARY MOVED OUT, and the reason is the host not being able to find it.
   *
   * This file used to record a deliberate decision to keep Gigs whole — it
   * sits at both ends of the journey, holding what is coming and what has
   * been, and splitting it added a tenth tab to a bar that already scrolls on
   * a phone. That reasoning was sound and the outcome was still wrong: *"we
   * need to have a calendar added because I don't know where to find the
   * calendar right now."* It was built, it worked, and it was invisible.
   *
   * A tab bar is a list of places somebody looks for things. Being tidy is
   * worth less than being findable, and the person who wrote the tidy version
   * could not find his own diary.
   */
  return pastGigsSection();
}

/**
 * EVERY NIGHT, SORTED UNDER WHERE IT WAS PLAYED.
 *
 * The same merge `venueHeadcounts()` runs server-side, read back off ITS
 * output rather than re-derived here — a night's date is enough to look up
 * which of the server's already-deduplicated venue groups it belongs to, so
 * this list can never disagree with the headcount line on the same card. A
 * night that summary skipped (no players, or one whose venue carried a
 * `venueId` the summary never saw because it had none) falls back to its own
 * raw venue name; one with no name at all goes into `unfiled`.
 */
export function groupByVenue(nights, headcounts) {
  const dateVenue = new Map();
  for (const v of (headcounts.venues || [])) {
    for (const s of v.series) dateVenue.set(s.night, v.venue);
  }
  const byKey = new Map();
  const unfiled = [];
  for (const n of nights) {
    const name = dateVenue.get(n.night) || String(n.venue || '').trim();
    if (!name) { unfiled.push(n); continue; }
    const key = name.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { key, venue: name, nights: [] });
    byKey.get(key).nights.push(n);
  }
  for (const v of byKey.values()) v.nights.sort((a, b) => b.night.localeCompare(a.night));
  // Most recently played first, same order every other list of venues in
  // this app comes back in.
  const venues = [...byKey.values()]
    .sort((a, b) => b.nights[0].night.localeCompare(a.nights[0].night));
  return { venues, unfiled };
}

function pastGigsSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Past gigs</h2>
          <div class="tiny">Every night you have run — the evidence you show a venue.</div>
        </div>
      </div>
      <div class="tiny gig-note"></div>
      <div class="venue-cards">Loading…</div>
    </div>`);

  const cardsWrap = el.querySelector('.venue-cards');
  const note = el.querySelector('.gig-note');

  // WHICH NIGHT is picked lives on the bench (`nightBench`), so it survives
  // this section being rebuilt from scratch. `openVenueKey` is module-level
  // for the same reason — see the note above it.
  let groups = { venues: [], unfiled: [] };

  const drawCards = () => {
    const cards = groups.venues.map((v) => venueCard(v, {
      open: openVenueKey === v.key,
      onToggle: () => { openVenueKey = openVenueKey === v.key ? '' : v.key; drawCards(); },
      onPick: (n) => putNightOnBench(n.night),
    }));
    if (groups.unfiled.length) {
      cards.push(venueCard(
        { key: '~unfiled', venue: 'Not filed under a venue', nights: groups.unfiled },
        {
          open: openVenueKey === '~unfiled',
          onToggle: () => { openVenueKey = openVenueKey === '~unfiled' ? '' : '~unfiled'; drawCards(); },
          onPick: (n) => putNightOnBench(n.night),
          noHeadcount: true,
        },
      ));
    }
    cardsWrap.replaceChildren(...cards);
  };

  (async () => {
    let data;
    try {
      const res = await fetch(keyed('/api/past-gigs'));
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      cardsWrap.replaceChildren(node(`<div class="tiny">${esc(err.message)}</div>`));
      return;
    }

    if (!data.nights.length) {
      cardsWrap.replaceChildren(node('<div class="tiny">Nothing yet. Finish a game and the night appears here.</div>'));
      return;
    }
    // Said once, at the top, rather than against every night: without the photo
    // repository set up the pictures are on this server only, and this server
    // forgets them on the next deploy. A quiet gap would read as "nobody took
    // any", which is the wrong thing to believe about your own gig.
    if (!data.photosKept) {
      note.innerHTML = '<b style="color:var(--gold)">Photos are not being kept permanently yet.</b> '
        + 'Nights still appear here; the pictures from them will not survive a restart.';
    }
    /*
     * REMEMBERED FOR THE BENCH, which is on a different panel entirely and
     * cannot fetch this again — see `nightBench`. Held as what was just
     * fetched rather than as a copy on the bench, so a prize claimed or a
     * photo deleted since is reflected the next time this tab is opened.
     */
    setGigsSeen(data.nights || []);
    groups = groupByVenue(data.nights, library.headcounts || { venues: [] });
    drawCards();
  })();

  return el;
}

/**
 * ONE CARD PER VENUE — the same component the Venues tab already uses
 * (`.venue-card`/`.venue-top`/`.venue-name`), so this is not a second shape
 * for one idea. Shut, it shows the headcount line, which is the number the
 * tab's old separate Headcount panel existed to show. Open, it lists every
 * night there; pressing one does not expand anything inline — it puts that
 * night ON THE BENCH (`onPick`), which is the door's own panel at the top,
 * shared with Invoices. Deliberate: this tab is a PICKER now, not a second
 * place a night's detail can be shown — the bench is the only one.
 */
function venueCard(entry, { open, onToggle, onPick, noHeadcount = false }) {
  const summary = noHeadcount ? null : headsFor(entry.venue);
  const gist = summary
    ? headcountLine(summary)
    : `<div class="tiny">${entry.nights.length} night${entry.nights.length === 1 ? '' : 's'} played</div>`;

  const el = node(`
    <div class="venue-card ${open ? 'open' : 'shut'}">
      <div class="venue-top">
        <button class="venue-name" aria-expanded="${open ? 'true' : 'false'}">${esc(entry.venue)}</button>
      </div>
      ${open ? '' : `<div class="venue-gist">${gist}</div>`}
      ${!open ? '' : `
        <div class="gig-list venue-gig-list">
          <!-- Marked against nightBench, not a state var of this tab's own —
               the bench is what says which night is picked, and this list is
               just a picker, so it reads the same global the bench does. -->
          ${entry.nights.map((n) => gigRowMarkup(n, n.night === nightBench)).join('')}
        </div>`}
    </div>`);

  el.querySelector('.venue-name').addEventListener('click', onToggle);

  if (open) {
    for (const row of el.querySelectorAll('.gig-head')) {
      const target = entry.nights.find((n) => n.night === row.dataset.night);
      const wrap = row.closest('.gig');
      row.addEventListener('click', () => onPick(target));
      // Drag a night up to the bench — same gesture as a pack onto Tonight.
      wrap.addEventListener('dragstart', (ev) => {
        setNightDrag(target.night);
        ev.dataTransfer.effectAllowed = 'copy';
        ev.dataTransfer.setData('text/plain', target.night);
        wrap.classList.add('is-dragging');
        dragging(true);
      });
      wrap.addEventListener('dragend', () => {
        setNightDrag(null);
        wrap.classList.remove('is-dragging');
        dragging(false);
        document.querySelector('.night-bench')?.classList.remove('drop-here');
      });
    }
  }
  return el;
}

/**
 * ONE NIGHT, compact — the same date-block shape the row always had, minus
 * the body it used to expand into inline. A press now hands the night to
 * whichever `onPick` the open venue card was given; see `venueCard()`.
 */
function gigRowMarkup(night, isSelected) {
  const when = new Date(night.night + 'T12:00:00');
  const day = when.toLocaleDateString('en-GB', { day: 'numeric' });
  const month = when.toLocaleDateString('en-GB', { month: 'short' });
  const weekday = when.toLocaleDateString('en-GB', { weekday: 'long' });
  const year = when.getFullYear() === new Date().getFullYear()
    ? '' : String(when.getFullYear()).slice(2);
  const played = night.games.length
    ? night.games.map(gameLabel).join(' · ')
    : 'No results saved';
  const heads = night.games.reduce((n, g) => Math.max(n, g.players || 0), 0);
  const put = night.games.reduce((n, g) => n + ((g.rewards || []).length), 0);
  const taken = night.games.reduce((n, g) => n + (g.rewardsTaken || 0), 0);
  const backAgain = night.games.reduce((n, g) => n + (g.rewardsReinstated || 0), 0);
  const prizes = put
    ? ` · ${put} ${put === 1 ? 'prize' : 'prizes'}${taken ? `, ${taken} taken` : ''}${backAgain ? `, ${backAgain} put back` : ''}`
    : '';

  return `
    <div class="gig" draggable="true">
      <button class="gig-head ${isSelected ? 'is-selected' : ''}" type="button" data-night="${esc(night.night)}">
        <span class="gig-cal" aria-hidden="true">
          <b>${esc(day)}</b><span>${esc(month)}${year ? ` ${esc(year)}` : ''}</span>
        </span>
        <span class="gig-mid">
          <b>${played}</b>
          <span class="tiny">${esc(weekday)}${heads ? ` · ${heads} played` : ''}${prizes}</span>
        </span>
        <span class="gig-badges">
          ${night.hasPhotos ? '<span class="tiny gig-more">Photos ▸</span>' : ''}
        </span>
        <span class="sr-only">${esc(when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>
      </button>
    </div>`;
}

/**
 * What one archived game is called, on the list row and in the expanded
 * view alike.
 *
 * A running-order night — quiz, a bingo interlude, quiz again — is still one
 * archived record, so `night.games` has one entry for the whole evening. Its
 * own `title` names only the part that actually finished it; `parts`, when
 * present, is every part in order, and that is what gets shown instead —
 * otherwise the pack the room started on simply never appears here.
 */
function gameLabel(g) {
  if (Array.isArray(g.parts) && g.parts.length) {
    return g.parts.map((p) => esc(p.title || (p.kind === 'bingo' ? 'Music bingo' : 'Music quiz'))).join(' → ');
  }
  return esc(g.title || (g.kind === 'bingo' ? 'Music bingo' : 'Music quiz'));
}

/**
 * ONE NIGHT'S FULL DETAIL, INTO A CONTAINER SOMEBODY ELSE OWNS — who won,
 * the report for the venue, its photos and the gallery toggle. Exactly what
 * used to open inline under a row's own head, and then briefly lived in a
 * bay of its own inside this tab; it lives on the POST GIG BENCH now
 * (`nightBenchPanel()` in console.js), which already had its own heading and
 * its own "take it off" control, so this only ever fills the body — one
 * place a night's detail is built, wherever it is shown.
 *
 * DELIBERATELY NO INVOICE BUTTON — Invoices is its own tab, one door along,
 * and a second entry point into the same form is exactly the duplication
 * this whole rework exists to remove.
 */
export async function fillNightDetail(body, night) {
  // Who won, which is on the archive and never on a photo.
  for (const game of night.games) {
    body.appendChild(node(`<div class="tiny">${gameLabel(game)} —
      ${esc(game.winner ? 'won by ' + game.winner : 'no winner recorded')}</div>`));
  }

  /*
   * NO "INVOICE THIS" HERE — Invoices is its own tab, one door along, and a
   * second entry point into the same form was the exact duplication this
   * whole rework exists to remove: the bench had one, the night's own row
   * had one, and both opened the identical form. One place a night gets
   * billed from is enough, and it is where the whole invoice book already
   * lives.
   */

  /*
   * THE CLICKABLE THINGS SHARE ONE ROW — asked for after the bench read as a
   * stack of full-width rows: a button, then a photo count, then a grid,
   * then another button buried under it. `.bench-actions` is that row;
   * new buttons join it here rather than each getting a line of their own.
   *
   * THE GALLERY TOGGLE IS THE ONE DELIBERATE EXCEPTION, still built below
   * the photos rather than into this row — see the note on `galleryToggle()`.
   * It sits under the pictures it would publish so nobody can put a night in
   * front of the world without having just looked at what is in it; moving
   * it up here to tidy the row would undo that safeguard.
   */
  const actions = node('<div class="bench-actions"></div>');
  body.appendChild(actions);

  /*
   * THE REPORT FOR THE VENUE — headcount, winner, podium, photos, offer
   * scans, out through the share sheet exactly like an invoice. Present
   * even with no photographs: a quiet Tuesday is still worth a headcount.
   */
  const report = node('<button class="minor gig-report">Report for the venue</button>');
  report.addEventListener('click', async () => {
    report.disabled = true;
    await shareReport(night);
    report.disabled = false;
  });
  actions.appendChild(report);

  await nightPhotos(body, night);
}

/**
 * A NIGHT'S PHOTOGRAPHS, THE BIN ON EACH AND THE GALLERY CONTROL UNDER THEM.
 *
 * **Split out of `fillNightDetail()` on 23 August 2026 because a second page
 * wanted them** — the Community door's Photos tab, where the pictures are
 * about the PEOPLE rather than about evidence of one night. Extracted rather
 * than rewritten, and that is the whole point: the bin's confirm wording, the
 * "Screen only" badge and the publish safeguard are each a decision with a
 * reason recorded, and a second copy is a second thing to forget.
 *
 * The caller owns the container and whatever it puts above this.
 */
/**
 * HOW LONG A LAMP WAITS BEFORE IT SAVES.
 *
 * Long enough to swallow a change of mind — two taps that end where they
 * started send nothing at all — and short enough that nobody notices it. Not a
 * setting: a number with a note, like the season length and the team size.
 */
const WRITE_AFTER = 600;

/**
 * ONE GALLERY WRITE AT A TIME, ACROSS EVERY LAMP ON THE PAGE.
 *
 * Every one of these writes the SAME file in the private repository —
 * `published.json` holds the nights and every per-photo ruling together — and
 * a GitHub content write is read-modify-write against a sha. Fire three at
 * once and two of them are working from a sha that is already stale: at best a
 * 409, at worst the last one home quietly undoes the other two.
 *
 * A promise chain is the whole fix, and it costs nothing that matters: the
 * flip is already instant, so the queue is invisible.
 */
let galleryChain = Promise.resolve();
function galleryQueue(job) {
  galleryChain = galleryChain.catch(() => {}).then(job);
}

export async function nightPhotos(body, night, opts = {}) {
  /*
   * THREE OPTIONS, ALL FOR THE COMMUNITY DOOR, and they exist so there is
   * still exactly ONE definition of a photograph in this app.
   *
   * On Past gigs a night's pictures are evidence sat inside the night's own
   * row, so they are a sideways strip with the publish control under them. On
   * Community the pictures are the thing you came for and they live in the
   * bay, with the controls in the tab below — *"the bottom is for controls and
   * options, not for displaying the actual thing"*. That is a different
   * PLACEMENT of the same objects, not a different photograph: the bin's
   * confirm wording, the "Screen only" badge and the publish safeguard each
   * carry a decision with a reason recorded, and a second copy is a second
   * thing to forget.
   *
   * - `wall`         lay them out as a grid rather than a sideways strip
   * - `controlsInto` where the publish control goes, if not under the pictures
   * - `onOpen`       called with a photo instead of following its link
   */
  const { wall = false, controlsInto = null, onOpen = null } = opts;
  if (!night.hasPhotos) return;

  const loading = node('<div class="tiny">Loading photos…</div>');
  body.appendChild(loading);
  let data;
  try {
    const res = await fetch(keyed('/api/past-gigs/' + encodeURIComponent(night.night)));
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load them');
  } catch (err) {
    loading.textContent = err.message;
    return;
  }
  const counted = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`;
  loading.textContent = counted;
  /*
   * WHERE A BACKGROUND WRITE SAYS IT FAILED — the line that already counts the
   * photographs, borrowed rather than a second line appearing and disappearing
   * above the grid. One place, and it goes back to the count the moment the
   * next write lands, so a stale complaint cannot sit there.
   */
  const trouble = (msg) => {
    loading.textContent = msg || counted;
    loading.style.color = msg ? 'var(--bad)' : '';
  };
  /*
   * ONE ROW, SCROLLED SIDEWAYS RATHER THAN WRAPPED — the shape asked for.
   * `.night-strip`, not `.night-grid`: the grid wraps into as many rows as
   * it needs, which is exactly what grew the bench past its own frame on a
   * night with thirty photos. A single row has a fixed height whatever the
   * count, so the bench's own size stops depending on how many pictures
   * somebody took.
   */
  const grid = node(`<div class="${wall ? 'community-wall' : 'night-strip'}"></div>`);
  for (const p of data.photos) {
    /*
     * `filed`, always — and this was stamping "NOT FILED" on every one.
     *
     * The badge belongs to the owner's Photos tab, where a photo genuinely
     * can be sitting on a disk that the next restart wipes. Past gigs reads
     * the photo list OUT of the repository, so anything shown here is filed
     * by definition. Without the class the CSS `:not(.filed)` rule fired on
     * all of them — telling a quizmaster their night's pictures were about
     * to be lost, on the one page whose whole job is "here is my work".
     */
    /*
     * A BIN ON EVERY PHOTO, bottom right — asked for in those words, and
     * asked for BEFORE publishing anything, which is the right order: the
     * gallery control publishes a whole night, so without this the only way
     * to keep one picture off it was to keep the night off it.
     *
     * Bottom right because the top of a photo is where faces are. It is the
     * drawn `binIcon()`, like everything else in this app that deletes.
     */
    /*
     * "SCREEN ONLY" — a photo a camera did not take, read from the SAME
     * `-picked` marker `/api/gallery/<night>` filters on server-side (see
     * `isCameraFile()` in photos.js): nothing new is fetched to say this,
     * the filename the review already has is the whole answer. Never
     * "hidden" — the point of showing this HERE, before publishing, is that
     * nobody is surprised later by a photo that quietly is not on the page.
     */
    /*
     * A PILL PER PHOTO, AND IT IS A SWITCH — asked for on 29 August 2026:
     * *"a little green pill to show it's on the public gallery for this night
     * and a red one to show it isn't, and I can click one for each purpose."*
     *
     * **IT REPLACES THE "Screen only" BADGE rather than joining it.** That one
     * said what the camera GUESS thought; this says what will actually happen,
     * which is the same fact once a human can overrule it — and two badges on
     * one photograph saying overlapping things is the label collision this app
     * has a rule against. The reason lives in the pill's own title, where the
     * difference between "we thought you uploaded this" and "you turned it
     * off" is worth having and is not worth a second badge.
     *
     * **GREEN AND RED, which is the one place they are allowed to mean this.**
     * The app's fixed colours are good/paying and wrong/destructive — and "on
     * a public page" versus "not" is exactly that pair, read at a glance
     * across eighteen thumbnails.
     */
    /*
     * AND A PIN, BOTTOM LEFT — asked for on 31 August 2026: *"random spread
     * across a night but also the ability to pick them — a little icon bottom
     * left on each photo where I can pin up to 3, so if I dislike one of the
     * random photos I can remove the pin from that one and give it to
     * something else."*
     *
     * **IT IS A PREFERENCE, NEVER A GATE.** The pin says which photographs lead
     * on the night's card on the public index; whether a photograph is public
     * at all is the lamp, and a pin on a photo the lamp has switched off simply
     * is not used. Two controls, two questions, and the server asks each one
     * once — the label collision this app keeps a rule about.
     *
     * **BOTTOM LEFT, opposite the bin**, so the two controls that do very
     * different things are never adjacent under a thumb. The lamp keeps the
     * right-hand corner it already had.
     */
    const shot = node(`<figure class="cphoto filed">
      <img src="${esc(p.url)}" alt="" loading="lazy">
      <button class="cphoto-pin ${p.pinned ? 'is-on' : ''}" type="button">${pinIcon(15)}</button>
      <button class="cphoto-pub ${p.onGallery ? 'is-on' : 'is-off'}" type="button"></button>
      <button class="cphoto-bin" type="button" aria-label="Delete this photo">${binIcon(15)}</button>
    </figure>`);

    /*
     * PAINTED FROM ONE PLACE, so the label, the colour and the title cannot
     * drift apart — and so the optimistic flip on a click and the answer that
     * comes back are drawn by the same code.
     */
    let live = Boolean(p.onGallery);
    const pill = shot.querySelector('.cphoto-pub');
    const paintPill = () => {
      pill.classList.toggle('is-on', live);
      pill.classList.toggle('is-off', !live);
      /*
       * NO WORDS ON IT — asked for directly: *"I need the 'on the gallery' to
       * just be an on off button with green for on and red for off, no text
       * needed but it must be clickable."*
       *
       * He is right, and eighteen of them is the argument: a label repeated
       * across a grid stops being read and starts being furniture, while a
       * colour is answered at a glance, which is the whole job. Green and red
       * already mean this in the app, so the dot needs no key.
       *
       * **WHICH MAKES THE `title` AND THE `aria-label` LOAD-BEARING RATHER
       * THAN A NICETY.** A wordless control has to say what it is somewhere —
       * a screen reader gets nothing from a colour, and the reason a photo is
       * off (the camera guess, or a ruling) is worth having on hover. This is
       * the one place a native tooltip earns itself: it is on a picture rather
       * than over a list, which is where the last one was a nuisance.
       */
      const why = live
        ? 'On the public gallery for this night. Click to take it off.'
        : (String(p.name || '').includes('-picked')
          ? 'Off the public gallery — this did not look like a camera took it. The big screen showed it either way. Click to put it on.'
          : 'Off the public gallery. Click to put it on.');
      pill.title = why;
      pill.setAttribute('aria-label', why);
      pill.setAttribute('aria-pressed', String(live));
    };
    paintPill();

    /*
     * IT FLIPS NOW AND SAVES LATER — asked for directly: *"the 1-2 second load
     * on clicking green/red is annoying, can it not just load in the
     * background?"*
     *
     * The write goes to GitHub, which takes about a second on a good
     * connection and longer on a pub's. Waiting for it before moving the
     * colour made a lamp feel like a form submission, on a control whose whole
     * job is being flicked across a grid of eighteen.
     *
     * **THE COLOUR IS THE LOCAL TRUTH AND `saved` IS THE SERVER'S**, which is
     * what makes this safe rather than a lie: if the write fails the lamp goes
     * back to what the server actually holds and says why. Nothing is ever
     * left claiming a state that was not recorded.
     */
    let saved = live;
    let timer = null;

    pill.addEventListener('click', (ev) => {
      // Belt to the figure's own braces above: a lamp is a control ON a
      // picture, and pressing it must never also mean "open this".
      ev.stopPropagation();
      live = !live;
      paintPill();
      /*
       * SETTLE FIRST, THEN SEND. Somebody deciding about a photograph often
       * presses twice — and two taps that end where they started need no write
       * at all, while two that do not need ONE rather than two writes racing
       * on the same file. The wait is short enough to be invisible and long
       * enough to swallow a change of mind.
       */
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (live === saved) return;   // back where it started: nothing to say
        const want = live;
        galleryQueue(async () => {
          try {
            const res = await fetch(keyed(`/api/gallery-photo/${encodeURIComponent(night.night)}/${encodeURIComponent(p.name)}`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ on: want }),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(out.error || 'Could not change that.');
            saved = want;
            trouble('');
          } catch (err) {
            /*
             * PUT IT BACK AND SAY WHY — never an `alert`, which is a modal
             * interruption for something that happened in the background, and
             * never a silent revert, which reads as a lamp with a mind of its
             * own. The likeliest failure by a distance is that the private
             * repository is not configured, which is a fault in an env var
             * rather than in the photograph.
             */
            live = saved;
            paintPill();
            trouble(err.message);
          }
        });
      }, WRITE_AFTER);
    });
    /*
     * THE PIN, ON THE SAME OPTIMISTIC PATTERN AS THE LAMP — flip now, settle,
     * then send, and put it back with a reason if the write fails.
     *
     * **THE CAP IS THE SERVER'S ANSWER, NOT A COUNT IN THE BROWSER.** Counting
     * pins here would be a second copy of a rule `setPhotoPin()` already owns,
     * and the two would disagree the first time two tabs were open. A fourth
     * press comes back 400 with the reason, which is then shown and the pin
     * goes back off — so the refusal is visible rather than silent.
     */
    const pin = shot.querySelector('.cphoto-pin');
    let pinned = Boolean(p.pinned);
    let pinSaved = pinned;
    let pinTimer = null;
    const paintPin = () => {
      pin.classList.toggle('is-on', pinned);
      const why = pinned
        ? "On this night's card. Click to take it off."
        : `Put this on the night's card. Up to ${night.maxPins || 3}.`;
      pin.title = why;
      pin.setAttribute('aria-label', why);
      pin.setAttribute('aria-pressed', String(pinned));
    };
    paintPin();

    pin.addEventListener('click', (ev) => {
      // A control ON a picture must never also mean "open this".
      ev.stopPropagation();
      pinned = !pinned;
      paintPin();
      clearTimeout(pinTimer);
      pinTimer = setTimeout(() => {
        if (pinned === pinSaved) return;
        const want = pinned;
        galleryQueue(async () => {
          try {
            const res = await fetch(keyed(`/api/gallery-pin/${encodeURIComponent(night.night)}/${encodeURIComponent(p.name)}`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ on: want }),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(out.error || 'Could not change that.');
            pinSaved = want;
            trouble('');
          } catch (err) {
            pinned = pinSaved;
            paintPin();
            trouble(err.message);
          }
        });
      }, WRITE_AFTER);
    });

    shot.querySelector('.cphoto-bin').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      /*
       * ASKED FIRST, and it names what it is deleting rather than saying
       * "are you sure". This is somebody's photograph and the night is
       * already filed — there is no undo, and the confirm is the only thing
       * standing between a mis-tap on a phone and a picture being gone.
       */
      if (!confirm('Delete this photo? It will be taken out of this night and can never reach the gallery.')) return;
      btn.disabled = true;
      try {
        const res = await fetch(keyed(`/api/past-photo/${encodeURIComponent(night.night)}/${encodeURIComponent(p.name)}`), {
          method: 'DELETE',
          headers: { 'X-Host-Key': hostKey },
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'Could not delete that.');
        // Gone from the page as well as the repository, or the next tap
        // deletes something that is not there any more.
        shot.remove();
        const left = grid.querySelectorAll('.cphoto').length;
        loading.textContent = `${left} photo${left === 1 ? '' : 's'}`;
      } catch (err) {
        btn.disabled = false;
        alert(err.message);
      }
    });
    /*
     * A CLICK ON THE PICTURE ITSELF OPENS IT, AND THE NEXT CLICK GOES BACK —
     * asked for in those words. Only where a caller offered somewhere to open
     * it INTO; on Past gigs a photograph is a thumbnail in a row and there is
     * no bay to fill, so nothing changes there.
     *
     * On the figure rather than on the image, so the whole tile is the target
     * — but never when the press started on the bin, which is a control on top
     * of it and must not also mean "open this".
     */
    if (onOpen) {
      shot.classList.add('is-openable');
      shot.addEventListener('click', (ev) => {
        /*
         * NEVER WHEN THE PRESS WAS ON A CONTROL ON TOP OF IT. Both the bin and
         * the gallery lamp sit over the picture and both have a hit area
         * bigger than they look — without this, switching a photo off the
         * gallery would also blow it up to fill the bay.
         */
        if (ev.target.closest('.cphoto-bin, .cphoto-pub')) return;
        onOpen(p);
      });
    }
    grid.appendChild(shot);
  }
  body.appendChild(grid);
  /*
   * THE BUTTON, OR JUST THE ADDRESS — see `galleryToggle()`.
   *
   * On Community the rail carries a P lamp per night that publishes in one
   * press, so drawing a second control saying the same thing here would be two
   * controls for one job on one screen: the label collision this app has a
   * rule against, and the pair that can disagree. **The read-only half stays**
   * — a published night still prints its public address, which is the thing
   * somebody actually wants off this panel and is a summary rather than a
   * control. *A read-only summary may repeat; a queue may not.*
   */
  (controlsInto || body).appendChild(
    galleryToggle(night.night, data.published, night.venue, { control: !controlsInto }),
  );
}

/**
 * THE NIGHT, AS A DOCUMENT — for the venue, out through the share sheet.
 *
 * Same shape as `share()` in `console-invoices.js`, and deliberately so: the
 * decision already made for invoicing is right here too — no email service,
 * and it goes from the quizmaster's own account rather than this app's. The
 * PDF itself does the work of picking headcount, podium, photos and offer
 * scans off the archive; this only has to fetch it and hand it to whichever
 * sheet the device offers.
 */
async function shareReport(night) {
  const url = keyed(`/api/past-gigs/${encodeURIComponent(night.night)}/report.pdf`);
  const when = new Date(night.night + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const subject = `${night.venue ? night.venue + ' — ' : ''}${when}`;
  try {
    const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not build the report.');
    const blob = await res.blob();
    const file = new File([blob], `${night.night}-report.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: subject });
      return;
    }
  } catch (err) {
    // A cancelled share sheet throws too — the same trap the invoice share
    // sheet records — so only THAT falls through silently.
    if (err && err.name === 'AbortError') return;
    return alert(err.message || 'Could not share that.');
  }
  window.open(url, '_blank', 'noopener');
}

/**
 * PUT THIS NIGHT ON THE PUBLIC GALLERY, or take it back down.
 *
 * The route for this has existed since the gallery was built and **nothing
 * ever called it** — so a night could be published only by hand, which means
 * in practice not at all. Same class of miss as the projector's arcade board:
 * the server was ready, the page was ready, and no control joined them up.
 *
 * ---
 *
 * **IT SITS UNDER THE PHOTOGRAPHS, and that placement is the safeguard.** It
 * is inside a night that has to be opened, below the pictures it would publish
 * — so nobody can put a night in front of the world without having just looked
 * at what is in it. A button on the collapsed row would be one tap from a
 * stranger's face going public, taken on a phone whose only promise was that
 * it *"goes on the big screen"*.
 *
 * **IT SAYS WHAT PUBLISHING MEANS, in a sentence.** The house style says a
 * control gets a title and one short line — and that warnings are the
 * exception, because they are read once at a moment that matters. This is one:
 * *anyone with the link* is the whole fact, and it costs somebody something
 * real if it is not said.
 *
 * **TAKING IT DOWN IS AS PROMINENT AS PUTTING IT UP.** Somebody will ask for
 * their photograph to be removed, and the only honest answer on a page with no
 * contact details is a quizmaster who can do it in one tap while they are
 * stood there. It is destructive-styled — outlined red, never filled — like
 * everything else that takes something away.
 *
 * @param {string} night `YYYY-MM-DD`
 * @param {boolean} on   whether it is already published
 */
function galleryToggle(night, on, venue = '', { control = true } = {}) {
  const wrap = node('<div class="gig-gallery"></div>');

  /*
   * `?q=` NAMES WHOSE GALLERY THIS IS, and without it the link falls back to
   * the OWNER's own room — see `galleryRoomId()` in `server.js`. That was
   * fine while there was only one gallery in the app; now every subscriber
   * has their own, and a link built with no `q=` sends a quizmaster to look
   * at Mark's photos instead of their own the moment they press "see it".
   *
   * **AND THE OWNER GETS THE VENUE'S OWN ADDRESS** —
   * `/station-tap-wokingham/gallery/20-august`, asked for on 31 August 2026.
   * The pretty path resolves against the owner's room, so it is printed only
   * for the account it will actually work for; anybody else keeps `?q=`, which
   * is exactly what they had. An address that looks nicer and 404s would be
   * worse than the honest one.
   */
  const slug = venueSlug(venue);
  // ANSWERED BY THE SERVER — see `ownAddress` in `/api/me`.
  const pretty = Boolean(me && me.ownAddress) && slug && nightSlug(night);
  const galleryLink = pretty
    ? `/${slug}/gallery/${nightSlug(night)}`
    : `/gallery?n=${encodeURIComponent(night)}${me?.id ? `&q=${encodeURIComponent(me.id)}` : ''}`;

  const paint = (live) => {
    wrap.replaceChildren(node(live
      ? `<div class="tiny gig-gal-live">On the gallery —
           <a href="${esc(galleryLink)}" target="_blank" rel="noopener">see it</a>
           <code class="pub-address">${esc(location.host + galleryLink)}</code></div>`
      // Not a warning wrapper and not red: it is a plain statement of what the
      // button does, read before pressing rather than after something went
      // wrong. Red here would say a mistake had been made.
      : (control
        // Not a warning wrapper and not red: it is a plain statement of what
        // the button does, read before pressing rather than after something
        // went wrong. Red here would say a mistake had been made.
        ? '<div class="tiny gig-gal-note">Anyone with the link can see these.</div>'
        // With no button on this panel the sentence has nothing to describe;
        // the P lamp beside the night says what pressing it will do.
        : '<div class="tiny gig-gal-note">Not on the gallery — press the P beside this night to put it up.</div>')));

    // Community publishes from the rail's P lamp, so there is no button here —
    // the address above is the whole of what this panel says there.
    if (!control) return;

    const btn = node(live
      ? '<button class="minor danger gig-gal-off" type="button">Take it off the gallery</button>'
      : '<button class="minor gig-gal-on" type="button">Put these on the gallery</button>');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(keyed('/api/past-gigs/publish'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ night, on: !live }),
        });
        const out = await res.json();
        // SAY WHAT WENT WRONG. The likeliest failure by far is that the
        // private photo repository is not configured, and "could not save
        // that" would send somebody hunting through the app for a fault that
        // is in an environment variable.
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

/** "3 days ago" reads better than a timestamp when you are scanning a list. */
export function whenish(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return new Date(ts).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
