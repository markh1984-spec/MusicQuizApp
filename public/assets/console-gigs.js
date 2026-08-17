/** GIGS — the evidence: headcounts, what the room asked for, and nights run. */

import { binIcon, esc, node } from './client.js';
import { invoiceApi, openInvoiceForm } from './console-invoices.js';
import { bench, book, library, setBook, setGigsSeen, setNightDrag } from './console-state.js';
import { dragging, night } from './console-tonight.js';
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
 * **ONE RECORD, DRAWN TWO WAYS, and the summary line is the same function on
 * both.** `library.headcounts` is worked out once on the server (see
 * `venueHeadcounts`), so the Venues tab and the Gigs tab cannot arrive at two
 * different answers about a number somebody is showing a landlord.
 *
 *  - **A venue card** opens on its own whole history — every night, its
 *    number, and the bar that shows the shape of it.
 *  - **The Gigs tab** puts every venue side by side, because that is where the
 *    work lives and comparing places is what you do there.
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

/** The last dozen nights as a shape, newest on the right, for the Gigs tab. */
function headcountSpark(entry) {
  if (entry.nights < 2) return '';
  const shown = entry.series.slice(-12);
  return `<div class="heads-spark" aria-hidden="true">${shown.map((n) => `
    <span style="height:${Math.max(8, Math.round((n.players / entry.best) * 100))}%"></span>`).join('')}</div>`;
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

/**
 * THE GIGS TAB'S PANEL — every venue, and which way each is going.
 *
 * Between the diary and Past gigs: what is coming is the thing you act on,
 * this is the thing you show somebody, and the long list of nights sits under
 * both. Not drawn at all when there is nothing to say, because an empty panel
 * on a tab is the clutter this app's own rules argue against.
 */
function headcountsSection() {
  const heads = library.headcounts || { venues: [], unplaced: 0 };
  if (!heads.venues.length && !heads.unplaced) return document.createDocumentFragment();
  return node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Headcount</h2>
          <div class="tiny">How many played at each venue, and which way it is going.</div>
        </div>
      </div>
      <div class="heads-list">
        ${heads.venues.map((v) => `
          <div class="heads-venue">
            <div class="heads-who"><b>${esc(v.venue)}</b>${headcountLine(v)}</div>
            ${headcountSpark(v)}
          </div>`).join('')}
      </div>
      ${!heads.unplaced ? '' : `<div class="tiny heads-unplaced">${heads.unplaced}
        night${heads.unplaced === 1 ? ' is' : 's are'} not filed under a venue.
        Type one at launch and ${heads.unplaced === 1 ? 'it counts' : 'they count'} here.</div>`}
    </div>`);
}

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
  const wrap = document.createDocumentFragment();
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
  /*
   * The numbers sit BETWEEN the two, and the order is the same argument the
   * rest of this tab is built on: what is coming is what you act on, the
   * headcounts are what you show a landlord, and the night-by-night list is
   * the long thing you scroll — so it goes under both.
   */
  wrap.appendChild(headcountsSection());
  wrap.appendChild(pastGigsSection());
  return wrap;
}

function pastGigsSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Past gigs</h2>
          <div class="tiny">Every night you have run. Saved automatically when a game finishes.</div>
        </div>
      </div>
      <div class="tiny gig-note"></div>
      <div class="gig-list">Loading…</div>
    </div>`);

  const list = el.querySelector('.gig-list');
  const note = el.querySelector('.gig-note');

  (async () => {
    let data;
    try {
      const res = await fetch(keyed('/api/past-gigs'));
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      list.replaceChildren(node(`<div class="tiny">${esc(err.message)}</div>`));
      return;
    }

    if (!data.nights.length) {
      list.replaceChildren(node('<div class="tiny">Nothing yet. Finish a game and the night appears here.</div>'));
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
    list.replaceChildren(...data.nights.map(gigRow));
  })();

  return el;
}

function gigRow(night) {
  const when = new Date(night.night + 'T12:00:00');
  const day = when.toLocaleDateString('en-GB', { day: 'numeric' });
  const month = when.toLocaleDateString('en-GB', { month: 'short' });
  const weekday = when.toLocaleDateString('en-GB', { weekday: 'long' });
  // The year only when it is not this one. Every row carrying "2026" is four
  // characters of noise on a list where almost everything is this year — and
  // the moment one says 2025 it is the thing you actually needed to see.
  const year = when.getFullYear() === new Date().getFullYear()
    ? '' : String(when.getFullYear()).slice(2);
  const played = night.games.length
    ? night.games.map((g) => esc(g.title || (g.kind === 'bingo' ? 'Music bingo' : 'Music quiz'))).join(' · ')
    : 'No results saved';
  const heads = night.games.reduce((n, g) => Math.max(n, g.players || 0), 0);
  // The venue is the headline, because it is what you are looking for when you
  // scan this list — "what did I play at The Crown". With no venue on the
  // night, what was played is the next most useful thing to lead with rather
  // than an empty line.
  const lead = night.venue ? esc(night.venue) : played;

  /*
   * WHAT WAS PUT UP, AND WHAT WAS ACTUALLY COLLECTED.
   *
   * The record has carried both since the bar started scanning vouchers, and
   * nothing ever said so — Gigs named the headcount and stopped. "Taken" is
   * the half somebody asks about: an unclaimed prize is money still sitting
   * behind a bar, and it is the quizmaster who gets asked about it weeks later.
   *
   * Silent when there were no prizes, rather than "0 prizes" on every night
   * that ran without any — the same rule as the venue line above it.
   */
  const put = night.games.reduce((n, g) => n + ((g.rewards || []).length), 0);
  const taken = night.games.reduce((n, g) => n + (g.rewardsTaken || 0), 0);
  const prizes = put
    ? ` · ${put} ${put === 1 ? 'prize' : 'prizes'}${taken ? `, ${taken} taken` : ''}`
    : '';

  const el = node(`
    <div class="gig" data-night="${esc(night.night)}" draggable="true">
      <button class="gig-head" type="button">
        <!-- THE DATE AS A BLOCK, chosen from four layouts on 15 August 2026.
             The old row was five spans in a flat sequence, which wrapped into
             a ragged block at any narrow width. This scans DOWN the dates like
             a diary, which is how somebody looks for a particular night — and
             it gives the venue a line of its own instead of burying it third
             in a run of dim text. -->
        <span class="gig-cal" aria-hidden="true">
          <b>${esc(day)}</b><span>${esc(month)}${year ? ` ${esc(year)}` : ''}</span>
        </span>
        <span class="gig-mid">
          <b>${lead}</b>
          <span class="tiny">${esc(weekday)}${night.venue ? ` · ${played}` : ''}${heads ? ` · ${heads} played` : ''}${prizes}</span>
        </span>
        <span class="gig-badges">
          ${night.unbilled ? '<span class="gig-unbilled">Not invoiced</span>' : ''}
          <!-- Its OWN span: this one is rewritten with "Loading…" and then the
               photo count the moment the night is opened. -->
          <span class="tiny gig-more">${night.hasPhotos ? 'Photos ▸' : ''}</span>
        </span>
        <!-- The full date for anybody not looking at it. The block above is
             hidden from screen readers, because "13 Aug" read out as two
             fragments is worse than the whole date said once.
             (No backticks in here: it is inside a template literal.) -->
        <span class="sr-only">${esc(when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>
      </button>
      <div class="gig-body" hidden></div>
    </div>`);

  /*
   * DRAG A NIGHT UP TO THE BENCH. Same gesture as a pack onto Tonight, and the
   * row stays a button as well — a tap opens its photos, which is what it has
   * always done, so the drag adds a way and takes none away.
   */
  el.addEventListener('dragstart', (ev) => {
    setNightDrag(night.night);
    ev.dataTransfer.effectAllowed = 'copy';
    ev.dataTransfer.setData('text/plain', night.night);
    el.classList.add('is-dragging');
    dragging(true);
  });
  el.addEventListener('dragend', () => {
    setNightDrag(null);
    el.classList.remove('is-dragging');
    dragging(false);
    document.querySelector('.night-bench')?.classList.remove('drop-here');
  });

  const body = el.querySelector('.gig-body');
  const more = el.querySelector('.gig-more');
  let loaded = false;

  el.querySelector('.gig-head').addEventListener('click', async () => {
    body.hidden = !body.hidden;
    if (body.hidden || loaded) return;
    loaded = true;

    // Who won, which is on the archive and never on a photo.
    for (const game of night.games) {
      body.appendChild(node(`<div class="tiny">${esc(game.title || '')} —
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

    if (!night.hasPhotos) return;

    more.textContent = 'Loading…';
    let data;
    try {
      const res = await fetch(keyed('/api/past-gigs/' + encodeURIComponent(night.night)));
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      more.textContent = '';
      body.appendChild(node(`<div class="tiny">${esc(err.message)}</div>`));
      return;
    }
    more.textContent = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}`;
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
          more.textContent = `${grid.querySelectorAll('.cphoto').length} photos`;
        } catch (err) {
          btn.disabled = false;
          alert(err.message);
        }
      });
      grid.appendChild(shot);
    }
    body.appendChild(grid);
    body.appendChild(galleryToggle(night.night, data.published));
  });

  return el;
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

  const paint = (live) => {
    wrap.replaceChildren(node(live
      ? `<div class="tiny gig-gal-live">On the gallery —
           <a href="/gallery?n=${encodeURIComponent(night)}" target="_blank" rel="noopener">see it</a></div>`
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
