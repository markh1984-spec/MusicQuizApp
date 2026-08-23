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
import { library } from './console-state.js';

/** Every venue with a league running, best-supported first. */
function leaguesNow() {
  return Object.values(library.leagues || {})
    .filter((l) => l && l.table && l.table.length)
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
  return `
    <div class="panel league-panel">
      <div class="league-head">
        <b>${esc(league.venue)}</b>
        <span class="tiny">${league.table.length} team${league.table.length === 1 ? '' : 's'}
          across ${league.nights} night${league.nights === 1 ? '' : 's'}</span>
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
    ? `<div class="tiny lg-note">and ${league.table.length - rows.length} more.</div>` : ''}
    </div>`;
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
          points for a win, one for turning up, over a rolling twelve-week season.</p>
        <p class="tiny">A night needs a venue on it to belong to a league, and bingo
          nights score nobody: a bingo board is who was dealt a good card rather than a
          finishing order, and awarding league points for it would put somebody top for
          being lucky.</p>
      </div>`));
    return wrap;
  }

  wrap.appendChild(node(`
    <p class="tiny">Ten points for a win, one for turning up, over a rolling twelve-week
      season. A team is the name they type on the night, so a change of spelling starts a
      new team — there is no sign-up, and that is what keeps it free to join at the door.</p>`));
  for (const league of leagues) wrap.appendChild(node(leagueTableFor(league)));
  return wrap;
}
