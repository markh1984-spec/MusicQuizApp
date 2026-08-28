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
// `keyed` comes from the shell, exactly as `console-gigs.js` takes it — the
// established pattern here, and safe because it is a hoisted function
// declaration rather than something read while the shell is half-built.
import { goTo, keyed } from './console.js';
import { library, me } from './console-state.js';
import { asksPanel, groupByVenue, nightPhotos } from './console-gigs.js';

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
 * THE BAY — what is running, in one line you read without choosing anything.
 *
 * **It says the same thing whether there are five leagues or none**, which is
 * the empty-state rule this project holds everywhere: a door that draws
 * nothing until you have data reads as broken on the day somebody opens it
 * for the first time, which is the day they are deciding whether to bother.
 */
export function communityBench() {
  const leagues = leaguesNow();
  const teams = new Set();
  for (const l of leagues) for (const t of l.table) teams.add(t.name.toLowerCase());
  const nights = leagues.reduce((n, l) => n + l.nights, 0);

  if (!leagues.length) {
    return node(`
      <div class="panel bench community-bench">
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
    <div class="panel bench community-bench">
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

/**
 * ONE VENUE'S TABLE IN FULL — the tab, where the venue card only ever had
 * room for the top five.
 *
 * **Ten rows, not five and not all of them.** The card is scanned and this is
 * read, so it can afford more; a table of forty rows on a screen is still not
 * a thing anybody reads, and the count underneath says how many there are.
 * If somebody wants the lot it wants to be a printable poster, which is a
 * different job and is not built.
 */
function leagueTableFor(league) {
  const rows = league.table.slice(0, 10);
  /*
   * THE HEADCOUNT SITS IN THE HEAD, one line, not a panel of its own.
   *
   * They are the landlord's two questions and CLAUDE.md already pairs them:
   * *"how many came"* and *"are the same people coming back"* — the headcount
   * sells the room and the league is what keeps it. A tab each would separate
   * the only two numbers anybody reads together.
   *
   * **A READ-ONLY SUMMARY MAY REPEAT; A QUEUE MAY NOT.** This same line is on
   * a venue card and on a Past gigs card, deliberately, and cannot disagree
   * with either because `library.headcounts` is worked out once on the server.
   * That is the line this app draws — and it is why "what the room asked for"
   * MOVED here rather than being copied: a triage list in two places is two
   * lists that disagree about what has been dealt with.
   */
  const heads = headsLine(league.venue);
  return `
    <div class="panel league-panel">
      <div class="league-head">
        <b>${esc(league.venue)}</b>
        <span class="tiny">${league.table.length} team${league.table.length === 1 ? '' : 's'}
          across ${league.nights} night${league.nights === 1 ? '' : 's'}</span>
        ${heads ? `<span class="tiny league-heads">${heads}</span>` : ''}
      </div>
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
          ${rows.map((t) => `
            <tr${t.position === 1 ? ' class="lg-top"' : ''}>
              <td class="lg-pos">${t.position}</td>
              <td class="lg-name">${esc(t.name)}</td>
              <!-- "9" plainly, or "9 (6)" once some are being dropped — the
                   number in brackets is what the points came from, said where
                   somebody would otherwise be adding their weeks up and
                   getting a different answer. -->
              <td class="lg-played tiny">${t.played}${t.counted < t.played ? ` <span class="lg-drop">(${t.counted})</span>` : ''}</td>
              <td class="lg-played tiny">${t.wins}</td>
              <td class="lg-pts"><b>${t.points}</b></td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${league.table.length > rows.length
    ? `<div class="tiny lg-note">and ${league.table.length - rows.length} more.</div>` : ''}
    </div>`;
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
  const link = `/league${me?.id ? `?q=${encodeURIComponent(me.id)}` : ''}`;

  const paint = (live) => {
    wrap.replaceChildren(node(live
      ? `<div class="tiny gig-gal-live">On the public table —
           <a href="${link}" target="_blank" rel="noopener">see it</a></div>`
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
 * THE LEAGUE TAB.
 *
 * **The identification rule is printed once here rather than under every
 * table.** A team is the name typed on a phone — there is no login for a
 * phone and there must not be one — so a change of spelling starts a new team
 * and a borrowed name is the same team. Somebody pinning this to a wall has
 * to know that, and saying it five times is how a page stops being read.
 */
export function leagueSection() {
  const leagues = leaguesNow();
  const wrap = document.createDocumentFragment();

  if (!leagues.length) {
    wrap.appendChild(node(`
      <div class="panel">
        <p>No league has started yet. It builds itself out of the nights you file — ten
          points for a win, one for turning up, over a rolling twelve-week season —
          and a team's best six nights are the ones that count.</p>
        <p class="tiny">A night needs a venue on it to belong to a league, and bingo
          nights score nobody: a bingo board is who was dealt a good card rather than a
          finishing order, and awarding league points for it would put somebody top for
          being lucky.</p>
      </div>`));
    return wrap;
  }

  wrap.appendChild(node(`
    <p class="tiny">Ten points for a win, one for turning up, over a rolling twelve-week
      season — and <b>a team's best six nights are the ones that count</b>, so a fortnight
      away does not end anybody's season. A team is the name they type on the night, so a
      change of spelling starts a new team — there is no sign-up, and that is what keeps it
      free to join at the door.</p>`));
  for (const league of leagues) {
    const panel = node(leagueTableFor(league));
    /*
     * THE PUBLISH CONTROL IS DRAWN NOW AND PAINTED LATER.
     *
     * Which tables are up is a GitHub read, so it is fetched ONCE when this
     * tab is opened rather than riding with the library on every console
     * render — a fact that changes twice a season must not cost a network
     * call per state push. Until it answers, the control is simply absent
     * rather than guessing "not published": a button that says "put this up"
     * on a table that is already up would be a lie for as long as the fetch
     * takes, and the one thing this control must never do is misstate what
     * is public.
     */
    panel.dataset.leagueKey = league.key;
    wrap.appendChild(panel);
  }
  paintPublished();
  return wrap;
}

/**
 * Ask which tables are up, once, and hang a control on each.
 *
 * Silent on failure — an unreachable repository means the publish control
 * does not appear, which is honest: without it nothing CAN be published, and
 * a broken button would be worse than no button.
 */
function paintPublished() {
  fetch(keyed('/api/league/published'))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return;
      const live = new Set(d.venues || []);
      /*
       * THE DOCUMENT, NEVER THE FRAGMENT THIS WAS BUILT IN — and the first
       * version queried the fragment and silently drew nothing.
       *
       * `leagueSection()` returns a `DocumentFragment`, and appending a
       * fragment MOVES its children out and leaves it empty. By the time this
       * fetch resolved, the panels were in the page and the fragment was a
       * husk, so `wrap.querySelectorAll()` matched nothing: two tables, no
       * publish controls, nothing thrown. An async paint has to look where
       * the thing IS when it runs, not where it was when it was made.
       *
       * A tab changed while the request was in flight simply matches nothing,
       * which is the right answer rather than a control on the wrong page.
       */
      for (const panel of document.querySelectorAll('[data-league-key]')) {
        if (panel.querySelector('.lg-pub-on, .lg-pub-off')) continue;
        const key = panel.dataset.leagueKey;
        const where = panel.querySelector('.league-head b');
        panel.appendChild(leagueToggle(key, where ? where.textContent : '', live.has(key)));
      }
    })
    .catch(() => {});
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
 * THE PHOTOS TAB — every picture the room took, under the venue it was taken
 * in.
 *
 * ---
 *
 * Asked for on 23 August 2026: *"photos can actually migrate to community as
 * well now, and anything else to do with the people who do the quizzing."*
 *
 * **THE PER-NIGHT GRID ON PAST GIGS STAYS, and that is not a duplicate.** The
 * same pictures do two different jobs: on Past gigs a photo is EVIDENCE, sat
 * beside the headcount, the winner and the report you hand a landlord; here it
 * is the room itself, which is what somebody comes to this door for. Splitting
 * them off Past gigs entirely was the alternative and it would have put you two
 * doors from the pictures while writing the report built out of them.
 *
 * **WHAT IS NOT DUPLICATED IS THE CODE.** The strip, the bin, the "Screen only"
 * badge and the publish control are `nightPhotos()` in `console-gigs.js`,
 * called from both — so the confirm wording, the badge and the safeguard have
 * one definition. A second copy is a second thing to forget.
 *
 * **THE PUBLISH CONTROL KEEPS ITS SAFEGUARD BECAUSE IT COMES WITH THEM.** It
 * is drawn UNDER the photographs it would publish, so nobody puts a night in
 * front of the world without having just looked at what is in it — true here
 * for the same reason it is true there, without anything being restated.
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
  const shown = new Map();   // night key -> the element holding its strip
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
    const count = entry.nights.reduce((n, x) => n + 1, 0);
    const card = node(`
      <div class="venue-card ${isOpen ? 'is-open' : ''}">
        <button class="venue-top" type="button" aria-expanded="${isOpen}">
          <span class="venue-name">${esc(entry.venue)}</span>
          <span class="tiny">${count} night${count === 1 ? '' : 's'} with photos</span>
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
    const row = node(`
      <div class="photo-night">
        <button class="photo-night-top" type="button">
          <b>${esc(readable(night.night))}</b>
          <span class="tiny">Photos ▸</span>
        </button>
      </div>`);
    const body = node('<div class="photo-night-body"></div>');
    row.appendChild(body);
    row.querySelector('.photo-night-top').addEventListener('click', async () => {
      if (shown.has(night.night)) {
        shown.delete(night.night);
        body.replaceChildren();
        return;
      }
      shown.set(night.night, body);
      body.replaceChildren();
      /*
       * FETCHED WHEN IT IS OPENED, never up front. A photo list is a request
       * per night, and a wall that loaded twenty nights on arrival would spend
       * a pub's wifi on pictures nobody had asked to see — the same reason
       * Past gigs loads a night's pictures on the press rather than with the
       * list.
       */
      await nightPhotos(body, night);
    });
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
