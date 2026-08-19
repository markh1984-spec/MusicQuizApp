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
 */
export function nightReportPdf(night, { headcount = 0, photoCount = 0, opens = 0, hasOffer = false } = {}) {
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
