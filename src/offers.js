/**
 * THE ADVERT QR THAT COUNTS — and the count IS the feature.
 *
 * An advert slide can already carry a QR pointing at whatever the venue likes.
 * That makes it an act of faith: the landlord puts an offer on the projector,
 * pays for the privilege in one way or another, and nobody can say whether a
 * single person looked at it. **A slide with a number the morning after is a
 * media buy with a report**, which is what gets it sold, renewed and priced —
 * and it is the first thing that makes Silver's advert slides demonstrably
 * worth money.
 *
 * So the QR points HERE instead: one short address this app serves, which
 * records that somebody opened it and then shows them the offer.
 *
 * ---
 *
 * **WHAT IS COUNTED IS AN OPEN, AND IT MUST NEVER BE CALLED A SALE.**
 *
 * The honest arrangement, and the reason it works without integrating with a
 * till, an EPOS or anything else: **the quizmaster reports OPENS, the venue
 * reports ORDERS.** The venue puts `?ref=quiz` on their own link and reads it
 * out of their own analytics, so the number that settles the argument arrives
 * from the person being convinced rather than from the person doing the
 * convincing. Presenting opens as conversions is how a quizmaster loses that
 * argument permanently — the landlord checks the till and stops believing any
 * number after it.
 *
 * ---
 *
 * **ONE SHARED CODE, NOT ONE PER PERSON.** Per-person codes are a voucher
 * system — issuance, uniqueness, fraud, staff training — and the failure mode
 * is an argument at the bar on the quizmaster's night. A shared code makes
 * that the venue's arrangement rather than theirs.
 *
 * **AND THE CODE IS A WORD, not only a scan.** Staff can hear "QUIZ40". A
 * phone held up in a dark bar at ten o'clock is a slower transaction than the
 * discount is worth, and half the room will not scan anything at all.
 *
 * ---
 *
 * **WHAT IS DELIBERATELY NOT STORED: anything about the person.** No id, no
 * fingerprint, no address. A count and a day, per slide. That keeps this out
 * of every consent conversation the photos are already in, and it is all the
 * argument needs — "forty-one people opened your offer on the 14th" does not
 * get better if you know who they were.
 */

import fs from 'node:fs';
import path from 'node:path';

/** A day key in the venue's own terms, so a count lines up with a night. */
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

export class Offers {
  constructor(file) {
    this.file = file;
    this.data = { opens: {} };
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (raw && typeof raw === 'object') this.data = { opens: raw.opens || {} };
    } catch { /* nothing counted yet, which is the ordinary state */ }
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
    } catch { /* a lost count is never worth an error on a gig night */ }
  }

  /**
   * Somebody opened a slide's offer.
   *
   * Keyed `packId/slideId` then by day. A flat total would answer "is anybody
   * looking" and nothing else; per day answers "did it work on the night",
   * which is the question a landlord actually asks, and it costs one more
   * object.
   */
  opened(packId, slideId, now = Date.now()) {
    const key = `${packId}/${slideId}`;
    const day = dayOf(now);
    if (!this.data.opens[key]) this.data.opens[key] = {};
    this.data.opens[key][day] = (this.data.opens[key][day] || 0) + 1;
    this.save();
    return this.data.opens[key][day];
  }

  /** Everything counted for one slide: the total, and the last few days. */
  forSlide(packId, slideId, { days = 30, now = Date.now() } = {}) {
    const byDay = this.data.opens[`${packId}/${slideId}`] || {};
    const floor = dayOf(now - days * 86400000);
    const recent = Object.entries(byDay)
      .filter(([day]) => day >= floor)
      .sort((a, b) => b[0].localeCompare(a[0]));
    const asRows = recent.map(([day, count]) => ({ day, count }));
    return {
      total: Object.values(byDay).reduce((n, v) => n + v, 0),
      recent: asRows,
      // The row, not the raw `[day, count]` pair it is built from — which is
      // what this returned at first, so `.count` was quietly undefined and
      // every caller would have printed nothing.
      lastNight: asRows.length ? asRows[0] : null,
    };
  }

  /** Totals for a whole pack, so a venue card can show its slides at a glance. */
  forPack(packId, opts = {}) {
    const out = {};
    for (const key of Object.keys(this.data.opens)) {
      if (!key.startsWith(`${packId}/`)) continue;
      out[key.slice(packId.length + 1)] = this.forSlide(packId, key.slice(packId.length + 1), opts);
    }
    return out;
  }
}

/**
 * The address a slide's QR points at.
 *
 * **Short on purpose.** A QR encoding a long URL is a denser grid, and this one
 * is read across a pub from a phone camera at whatever angle somebody is
 * holding it — every character costs resolution. `/o/<pack>/<slide>` is about
 * as short as it goes while still being a real address somebody could type.
 */
export function offerPath(packId, slideId) {
  return `/o/${encodeURIComponent(packId)}/${encodeURIComponent(slideId)}`;
}
