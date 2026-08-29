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
 * **AND EVERY BAY HERE IS BOUNDED BY CONSTRUCTION, which is the constraint
 * that decides the shapes.** Above 900px the doorhead does not scroll — it
 * sizes to its content and the tab body is the only scroller — so a bay that
 * can grow with the data pushes the page off the bottom of the frame with
 * nothing left to bring it back. That is exactly what a night with thirty
 * photographs did to the Post gig bench, and the fix there was the same one
 * as here: make the thing unable to grow tall rather than putting a ceiling
 * on the box round it. So the wall is a fixed `WALL_DOWN` rows and the
 * league bay a fixed `BAY_ROWS`, both with the remainder said in a line
 * rather than drawn.
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

/*
 * THE WALL — six across and three down, which is the "3 x 6" that was asked
 * for, laid out the way round the rest of this console already is.
 *
 * **SIX ACROSS BECAUSE EVERYTHING ELSE HERE IS SIX ACROSS** — the pack shelf
 * and the Tonight bays, both by decision. A grid that mirrors the one two
 * inches below it reads as the same app; three across and six down would
 * also be eighteen pictures and would be twice as tall, which the doorhead
 * cannot afford.
 *
 * **AND THREE ROWS IS THE CEILING, not a page size.** The count is what makes
 * this bay safe in a region that does not scroll — see `communityBench()`.
 */
const WALL_ACROSS = 6;
const WALL_DOWN = 3;
const WALL_MAX = WALL_ACROSS * WALL_DOWN;

/*
 * HOW MANY NIGHTS ARE OPENED TO FILL IT.
 *
 * A photo list is one request per night — the reason the tab below fetches a
 * night's pictures on the press rather than up front — so a wall built by
 * asking every night in the archive would spend a pub's wifi on twenty
 * requests to draw eighteen thumbnails. Newest first, stopping the moment the
 * wall is full, and never more than this many: an ordinary night carries more
 * than eighteen photographs on its own, so the usual cost is ONE request.
 */
const WALL_NIGHTS = 4;

/**
 * FETCHED ONCE PER PAGE LOAD, then held.
 *
 * The bay is rebuilt on every state push — which during a lobby is every time
 * somebody joins — so a fetch inside the render would be a request storm on
 * the one evening the connection must not stutter. A photograph that arrives
 * after this is caught the next time the console is opened, which is the
 * right trade for a wall.
 */
let wallShots = null;

function photoWall() {
  const el = node(`
    <div class="panel bench community-bench">
      <div class="bench-head">
        <b>The wall</b>
        <span class="tiny">The last ${WALL_MAX} pictures the rooms sent. Every night's own
          set — and the bin — are underneath.</span>
      </div>
      <div class="community-wall"></div>
    </div>`);
  const grid = el.querySelector('.community-wall');

  const draw = (shots) => {
    grid.replaceChildren();
    if (!shots.length) {
      grid.appendChild(node(`<div class="tiny community-wall-none">No photographs yet. The
        camera is on the phones in the gaps, and whatever the room sends lands here.</div>`));
      return;
    }
    for (const shot of shots) {
      /*
       * A LINK TO THE PICTURE ITSELF, and nothing else on it. There is no bin
       * up here on purpose: a bin belongs beside the night it deletes from,
       * where you can see which night that is. A thumbnail on a wall with a
       * delete button on it is a mis-tap with no undo.
       */
      grid.appendChild(node(`
        <a class="community-shot" href="${esc(shot.url)}" target="_blank" rel="noopener"
           title="${esc(shot.where)}">
          <img src="${esc(shot.url)}" alt="" loading="lazy">
        </a>`));
    }
  };

  if (wallShots) draw(wallShots);
  else {
    grid.appendChild(node('<div class="tiny">Loading the photographs…</div>'));
    loadWall().then(draw).catch(() => draw([]));
  }
  return el;
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
    // definition, so a thumbnail with no answer to "which night was that" is
    // a picture you cannot go and find again.
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
 * THE BAY'S TABLE STOPS AT EIGHT, and the rest is said in a line.
 *
 * The tab underneath draws ten and the full count; this is the glance, in a
 * region that cannot scroll. Eight is what fits at 720px with the tab column
 * still usable below it, measured rather than guessed.
 */
const BAY_ROWS = 8;

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
function leagueBay() {
  const leagues = leaguesNow();
  const el = node('<div class="panel bench community-bench community-bay"></div>');

  const paint = () => {
    if (!leagues.some((l) => l.key === picked)) picked = leagues[0].key;
    const league = leagues.find((l) => l.key === picked);
    el.replaceChildren();

    const rail = node('<div class="community-rail" role="tablist"></div>');
    for (const l of leagues) {
      const btn = node(`
        <button class="community-venue ${l.key === picked ? 'on' : ''}" type="button"
                role="tab" aria-selected="${l.key === picked}">
          <span class="community-venue-name">${esc(l.venue)}</span>
          <span class="tiny">${l.table.length} team${l.table.length === 1 ? '' : 's'}
            · ${l.nights} night${l.nights === 1 ? '' : 's'}</span>
        </button>`);
      btn.addEventListener('click', () => { picked = l.key; paint(); });
      rail.appendChild(btn);
    }

    const rows = league.table.slice(0, BAY_ROWS);
    const heads = headsLine(league.venue);
    const side = node(`
      <div class="community-side">
        <div class="league-head">
          <b>${esc(league.venue)}</b>
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
                <td class="lg-played tiny">${t.played}</td>
                <td class="lg-played tiny">${t.wins}</td>
                <td class="lg-pts"><b>${t.points}</b></td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${league.table.length > rows.length
    ? `<div class="tiny lg-note">and ${league.table.length - rows.length} more, below.</div>` : ''}
      </div>`);

    el.append(rail, side);
  };

  paint();
  return el;
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
              <!-- THE REAL NAME, MARKED WHEN IT WILL NOT PUBLISH. This is the
                   room's own view and the quizmaster was there, so nothing is
                   masked here — but a name that a public page would hide says
                   so, or it would vanish off a table they had put up and there
                   would be no way to tell which one did it. -->
              <td class="lg-name">${esc(t.name)}${t.nameHidden
    ? ' <span class="lg-hidden" title="This name is hidden on the public table and on a landlord\'s report. It still scores exactly as it is.">hidden publicly</span>'
    : ''}</td>
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
          points for a win, plus one for every night a team plays, over a rolling
          twelve-week season — and their best six finishes are what count.</p>
        <p class="tiny">A night needs a venue on it to belong to a league, and bingo
          nights score nobody: a bingo board is who was dealt a good card rather than a
          finishing order, and awarding league points for it would put somebody top for
          being lucky.</p>
      </div>`));
    return wrap;
  }

  wrap.appendChild(node(`
    <p class="tiny">Ten points for a win, down to two for seventh, plus <b>one for every
      night a team plays</b> — and their <b>best six finishes</b> are the ones that count
      towards the total. So a fortnight away costs two points rather than a season, and
      turning up every week is always worth something. Rolling twelve-week season. A team
      is the name they type on the night, so a change of spelling starts a new team — there
      is no sign-up, and that is what keeps it free to join at the door. Names go on
      the big screen exactly as typed; a few are held back from the <b>public</b> table
      and the landlord's report, and they are marked below.</p>`));
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
    byKey.set(league.key, league);
    wrap.appendChild(panel);
  }
  paintPublished();
  return wrap;
}

/** Every league on screen, by the key its panel carries. */
const byKey = new Map();

/** Redraw the `hidden publicly` marks from what will ACTUALLY happen. */
function markPills(panel, league, names) {
  const rows = league.table || [];
  [...panel.querySelectorAll('tbody tr')].forEach((tr, i) => {
    const row = rows[i];
    const cell = tr.querySelector('.lg-name');
    if (!row || !cell) return;
    const hidden = hiddenNow(row, names);
    const mark = cell.querySelector('.lg-hidden');
    if (hidden && !mark) {
      cell.appendChild(node('<span class="lg-hidden" title="This name is hidden on the public table and on a landlord\'s report. It still scores exactly as it is.">hidden publicly</span>'));
    } else if (!hidden && mark) {
      mark.remove();
    }
  });
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
      const names = d.names || {};
      for (const panel of document.querySelectorAll('[data-league-key]')) {
        if (panel.querySelector('.lg-pub-on, .lg-pub-off')) continue;
        const key = panel.dataset.leagueKey;
        const league = byKey.get(key);
        const where = panel.querySelector('.league-head b');
        /*
         * THE PILLS ARE REPAINTED FROM THE COMBINE, not left as the filter
         * drew them. The table renders before the rulings arrive — it has to,
         * or the tab would sit blank on a network round trip — so a name the
         * quizmaster allowed would otherwise keep saying "hidden publicly"
         * for ever on the one screen that is supposed to tell them the truth.
         */
        if (league) {
          markPills(panel, league, names);
          panel.appendChild(nameReview(league, names, () => markPills(panel, league, names)));
        }
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
