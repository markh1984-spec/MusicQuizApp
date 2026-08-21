/** GIGS — the evidence: headcounts, what the room asked for, and nights run. */

import { binIcon, esc, node } from './client.js';
import { invoiceApi, openInvoiceForm } from './console-invoices.js';
import { book, library, me, nightToOpen, setBook, setGigsSeen, setNightDrag, setNightToOpen } from './console-state.js';
import { dragging } from './console-tonight.js';
import { can, hostKey, keyed, load } from './console.js';
import { tonight } from './diary.js';
import { FEATURES } from './plans.js';

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
      across ${league.nights} night${league.nights === 1 ? '' : 's'} · 10 points for a win, 1 for turning up.
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
export function asksPanel() {
  const el = node('<div></div>');
  const draw = (data) => {
    const asked = data.asked || [];
    const kept = data.kept || [];
    if (!asked.length && !kept.length) { el.replaceChildren(); return; }
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
function groupByVenue(nights, headcounts) {
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
      <div class="gig-bay-slot"></div>
      <div class="venue-cards">Loading…</div>
    </div>`);

  const bay = el.querySelector('.gig-bay-slot');
  const cardsWrap = el.querySelector('.venue-cards');
  const note = el.querySelector('.gig-note');
  bay.appendChild(emptyBay());

  // Which venue card is open, and which night is currently loaded into the
  // bay — both start fresh every time the tab is opened, same as the old
  // per-row expand state did.
  let openKey = '';
  let selectedNight = '';
  let groups = { venues: [], unfiled: [] };

  const drawCards = () => {
    const cards = groups.venues.map((v) => venueCard(v, {
      open: openKey === v.key,
      selectedNight,
      onToggle: () => { openKey = openKey === v.key ? '' : v.key; drawCards(); },
      onPick: showInBay,
    }));
    if (groups.unfiled.length) {
      cards.push(venueCard(
        { key: '~unfiled', venue: 'Not filed under a venue', nights: groups.unfiled },
        {
          open: openKey === '~unfiled',
          selectedNight,
          onToggle: () => { openKey = openKey === '~unfiled' ? '' : '~unfiled'; drawCards(); },
          onPick: showInBay,
          noHeadcount: true,
        },
      ));
    }
    cardsWrap.replaceChildren(...cards);
  };

  /*
   * THE BAY IS ONE SLOT, WHOEVER OPENS IT. Every venue card's nights wire up
   * to this same function, so there is exactly one place a night's photos,
   * invoice button and gallery toggle can be — never one copy per open card.
   */
  const showInBay = async (target) => {
    selectedNight = target.night;
    drawCards();
    bay.replaceChildren(await nightDetail(target));
    bay.scrollIntoView({ block: 'start', behavior: 'smooth' });
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

    /*
     * ARRIVED FROM THE MIC — open that night straight into the bay.
     *
     * `?night=` on the URL is the control view's **Check the photos** button
     * landing here at the end of a quiz. Opening its venue card and loading
     * the bay is what makes that a flow rather than a signpost.
     *
     * **Cleared whether or not the night was found**, or changing tab and
     * coming back re-opens a night nobody asked for.
     */
    if (nightToOpen) {
      const target = data.nights.find((n) => n.night === nightToOpen);
      setNightToOpen('');
      if (target) {
        const home = groups.venues.find((v) => v.nights.includes(target));
        openKey = home ? home.key : (groups.unfiled.includes(target) ? '~unfiled' : '');
        drawCards();
        await showInBay(target);
      }
    }
  })();

  return el;
}

/**
 * ONE CARD PER VENUE — the same component the Venues tab already uses
 * (`.venue-card`/`.venue-top`/`.venue-name`), so this is not a second shape
 * for one idea. Shut, it shows the headcount line, which is the number the
 * tab's old separate Headcount panel existed to show. Open, it lists every
 * night there; pressing one does not expand anything inline — it hands the
 * night to `onPick`, which loads it into the bay. That is deliberate: with
 * several venue cards open at once, a night's detail must still live in
 * exactly one place, or two open cards could each claim to be showing it.
 */
function venueCard(entry, { open, selectedNight, onToggle, onPick, noHeadcount = false }) {
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
          ${entry.nights.map((n) => gigRowMarkup(n, n.night === selectedNight)).join('')}
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
          ${night.unbilled ? '<span class="gig-unbilled">Not invoiced</span>' : ''}
          ${night.hasPhotos ? '<span class="tiny gig-more">Photos ▸</span>' : ''}
        </span>
        <span class="sr-only">${esc(when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>
      </button>
    </div>`;
}

/** The bay before anything has been picked. */
function emptyBay() {
  return node('<div class="gig-bay empty"><div class="tiny">Pick a night below to see it here.</div></div>');
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
 * THE BAY'S CONTENTS — one night's full detail: who won, invoice it, the
 * report for the venue, its photos and the gallery toggle. Exactly what used
 * to open inline under a row's own head; the shape is unchanged, only where
 * it lands moved — see the note above `venueCard()`.
 */
async function nightDetail(night) {
  const when = new Date(night.night + 'T12:00:00');
  const el = node(`
    <div class="gig-bay">
      <div class="gig-bay-head">
        <b>${night.venue ? esc(night.venue) : 'No venue recorded'}</b>
        <span class="tiny">${esc(when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>
      </div>
      <div class="gig-bay-body"></div>
    </div>`);
  const body = el.querySelector('.gig-bay-body');

  // Who won, which is on the archive and never on a photo.
  for (const game of night.games) {
    body.appendChild(node(`<div class="tiny">${gameLabel(game)} —
      ${esc(game.winner ? 'won by ' + game.winner : 'no winner recorded')}</div>`));
  }

  /*
   * BILL FOR THIS ONE, from the night itself.
   *
   * This is what lets Invoices stay a tab of its own rather than being
   * swallowed into this one. "Invoice this" already existed on the running
   * panel — but only in the minutes after a game ends, so a night from a
   * fortnight ago could only be billed by typing the venue and the date back
   * in from memory. That is precisely the blank page this app's own rule
   * says is where the time goes.
   *
   * The venue is matched to a record so the address and the usual fee come
   * with it; an unmatched name still fills the night's own details in, which
   * is the free-text venue keeping its promise. Only where they hold the
   * feature — a quizmaster without invoicing gets no button rather than one
   * that 403s.
   */
  if (can(FEATURES.INVOICES)) {
    const bill = node('<button class="minor gig-bill">Invoice this</button>');
    bill.addEventListener('click', async () => {
      bill.disabled = true;
      try {
        setBook(await invoiceApi('/api/invoices'));
      } catch (err) {
        bill.disabled = false;
        alert('Could not open the invoices: ' + err.message);
        return;
      }
      const match = book.customers.find(
        (c) => (c.name || '').toLowerCase() === String(night.venue || '').toLowerCase());
      const what = night.games.some((g) => g.kind === 'bingo') && night.games.every((g) => g.kind === 'bingo')
        ? 'Music bingo night' : 'Music quiz night';
      openInvoiceForm({
        customerId: match ? match.id : '',
        // `nightId` has been a field on every invoice since invoicing was
        // written and was never once set. It is the stable handle back to
        // the night — what tells the two apart for "have I billed this" is
        // the venue and the date together, but the id is what anything
        // later will want and it costs nothing to record now.
        event: { title: what, venue: night.venue || '', date: night.night, nightId: night.night },
        description: what,
      }, () => load());
      bill.disabled = false;
    });
    body.appendChild(bill);
  }

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
  body.appendChild(report);

  if (!night.hasPhotos) return el;

  const loading = node('<div class="tiny">Loading photos…</div>');
  body.appendChild(loading);
  let data;
  try {
    const res = await fetch(keyed('/api/past-gigs/' + encodeURIComponent(night.night)));
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load them');
  } catch (err) {
    loading.textContent = err.message;
    return el;
  }
  loading.textContent = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`;
  const grid = node('<div class="night-grid"></div>');
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
    const shot = node(`<figure class="cphoto filed">
      <img src="${esc(p.url)}" alt="" loading="lazy">
      <button class="cphoto-bin" type="button" aria-label="Delete this photo">${binIcon(15)}</button>
    </figure>`);
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
        loading.textContent = `${grid.querySelectorAll('.cphoto').length} photos`;
      } catch (err) {
        btn.disabled = false;
        alert(err.message);
      }
    });
    grid.appendChild(shot);
  }
  body.appendChild(grid);
  body.appendChild(galleryToggle(night.night, data.published));
  return el;
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
function galleryToggle(night, on) {
  const wrap = node('<div class="gig-gallery"></div>');

  /*
   * `?q=` NAMES WHOSE GALLERY THIS IS, and without it the link falls back to
   * the OWNER's own room — see `galleryRoomId()` in `server.js`. That was
   * fine while there was only one gallery in the app; now every subscriber
   * has their own, and a link built with no `q=` sends a quizmaster to look
   * at Mark's photos instead of their own the moment they press "see it".
   */
  const galleryLink = `/gallery?n=${encodeURIComponent(night)}${me?.id ? `&q=${encodeURIComponent(me.id)}` : ''}`;

  const paint = (live) => {
    wrap.replaceChildren(node(live
      ? `<div class="tiny gig-gal-live">On the gallery —
           <a href="${galleryLink}" target="_blank" rel="noopener">see it</a></div>`
      // Not a warning wrapper and not red: it is a plain statement of what the
      // button does, read before pressing rather than after something went
      // wrong. Red here would say a mistake had been made.
      : '<div class="tiny gig-gal-note">Anyone with the link can see these.</div>'));

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
