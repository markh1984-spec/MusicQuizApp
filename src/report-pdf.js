/**
 * What a night looks like on paper, for the venue.
 *
 * Kept apart from `src/pdf.js` (how to put text on a page) and
 * `src/past-gigs.js` (what a night IS), the same split invoices use. The
 * numbers here are all read off the archive and the photo repository —
 * nothing is collected for this, it is the evidence that already exists,
 * assembled.
 *
 * Plain and short on purpose, like the invoice: this is a document a landlord
 * glances at the morning after, not a report they sit down to read.
 */

import { Page, renderPdf, PAGE } from './pdf.js';

const LEFT = 56;
const RIGHT = PAGE.width - 56;
const INK = [0.06, 0.06, 0.1];
const DIM = [0.42, 0.42, 0.5];
const GOLD = [0.55, 0.42, 0.06];

/**
 * @param {object} night   one entry from `mergeGigs()`, with `leaderboard`
 *   attached to each game (`listArchive(dir, { boards: true })`)
 * @param {object} extra
 * @param {number} extra.headcount   `nightHeadcount(night)`
 * @param {number} extra.photoCount
 * @param {number} extra.opens       advert opens for this venue, all time —
 *   0 when there is nothing coded, which the caller tells apart from
 *   "not shown at all" via `extra.hasOffer`
 * @param {boolean} extra.hasOffer
 * @param {object|null} [extra.league]  `leagueAfter()` for this venue — the
 *   table as it stood after THIS night, or null when the account has no
 *   league or the venue has none running.
 */
export function nightReportPdf(night, { headcount = 0, photoCount = 0, opens = 0, hasOffer = false, league = null } = {}) {
  const page = new Page();
  const when = new Date(night.night + 'T12:00:00');
  const dateLine = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  page.text(night.venue || 'Quiz night', LEFT, 74, { size: 20, bold: true, rgb: INK });
  page.text('THE NIGHT', RIGHT, 74, { size: 20, bold: true, align: 'right', rgb: DIM });
  page.text(dateLine, LEFT, 96, { size: 10, rgb: DIM });

  let y = 130;
  page.rule(LEFT, y, RIGHT);
  y += 30;

  // ---- the headline number
  page.text(String(headcount), LEFT, y + 8, { size: 34, bold: true, rgb: INK });
  page.text('played', LEFT + 56, y, { size: 11, rgb: DIM });
  y += 44;

  // ---- what was played, and who won it
  for (const game of night.games || []) {
    page.text(game.title || (game.kind === 'bingo' ? 'Music bingo' : 'Music quiz'), LEFT, y, { size: 12, bold: true, rgb: INK });
    y += 16;
    if (game.winner) {
      page.text(`Winner — ${game.winner}`, LEFT, y, { size: 11, rgb: GOLD, bold: true });
      y += 15;
    }
    const podium = (game.leaderboard || []).slice(1, 3);
    if (podium.length) {
      page.text(podium.map((p, i) => `${i + 2}${i === 0 ? 'nd' : 'rd'} — ${p.name}`).join('   ·   '), LEFT, y, { size: 10, rgb: DIM });
      y += 15;
    }
    y += 8;
  }

  /*
   * ---- THE SEASON, AND WHY IT BELONGS ON A LANDLORD'S REPORT.
   *
   * The headline number above answers *"how many came"*. This answers *"are
   * the same people coming back"*, which is the question that actually
   * renews a booking — and the report was carrying the first without the
   * second while the app had known the answer all along.
   *
   * FIVE ROWS. This is one side of A4 with a headcount, a winner, a podium
   * and two counters already on it; the full table is the wall poster's job,
   * and the line underneath says how many are in it so five never reads as
   * all of them.
   *
   * Silent when there is no league — a Bronze account, a venue with one
   * night, or a bingo-only evening. A heading over an empty table is worse
   * than no heading, and this is a document somebody hands over.
   */
  const seasonRows = league && league.table ? league.table.slice(0, 5) : [];
  if (seasonRows.length) {
    y += 10;
    page.rule(LEFT, y, RIGHT);
    y += 24;
    page.text('THE LEAGUE AFTER TONIGHT', LEFT, y, { size: 11, bold: true, rgb: INK });
    page.text(`${league.teams ?? league.table.length} teams · ${league.nights} nights`,
      RIGHT, y, { size: 9, align: 'right', rgb: DIM });
    y += 20;
    for (const team of seasonRows) {
      const gold = team.position === 1;
      page.text(String(team.position), LEFT, y, { size: 10, bold: gold, rgb: gold ? GOLD : DIM });
      page.text(team.name, LEFT + 18, y, { size: 10, bold: gold, rgb: gold ? GOLD : INK });
      page.text(`${team.played} played`, RIGHT - 96, y, { size: 9, align: 'right', rgb: DIM });
      page.text(`${team.points} pts`, RIGHT, y, { size: 10, bold: true, align: 'right', rgb: gold ? GOLD : INK });
      y += 16;
    }
    if (league.table.length > seasonRows.length) {
      y += 2;
      page.text(`and ${league.table.length - seasonRows.length} more teams in the season`,
        LEFT, y, { size: 9, rgb: DIM });
      y += 14;
    }
    y += 4;
  }

  y += 10;
  page.rule(LEFT, y, RIGHT);
  y += 28;

  // ---- the two extra numbers, side by side
  const col = (label, value, x) => {
    page.text(String(value), x, y + 8, { size: 22, bold: true, rgb: INK });
    page.text(label, x, y + 24, { size: 9, rgb: DIM });
  };
  col(photoCount === 1 ? 'photo taken' : 'photos taken', photoCount, LEFT);
  if (hasOffer) col(opens === 1 ? 'offer scan' : 'offer scans', opens, LEFT + 180);
  y += 46;

  page.rule(LEFT, y, RIGHT);
  y += 20;
  page.text('Thanks for having us.', LEFT, y, { size: 9, rgb: DIM });

  return renderPdf(page, { title: `${night.venue || 'Quiz night'} — ${night.night}` });
}

/** A filename a landlord can file without renaming it. */
export function nightReportFilename(night) {
  const who = String(night.venue || 'venue')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${night.night}-${who || 'venue'}.pdf`;
}
