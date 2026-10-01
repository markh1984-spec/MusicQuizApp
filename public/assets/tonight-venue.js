/**
 * TONIGHT'S PUB IS REMEMBERED UNTIL 6AM, AND NOT A MINUTE LONGER.
 *
 * The host, 1 October 2026: *"I need to be able to just clear the launch bar
 * and do a new game even if I already played one, and have it assigned to the
 * same night."* It already filed that way — one join code, one night in Past
 * gigs — but only while the bar still held the pub. A reload between games
 * dropped it unless the evening was that pub's usual night, and then Launch
 * stood down for want of prizes, or the next game filed under no pub at all.
 *
 * The rule this replaces was *never remembered on the device*, and its reason
 * still stands: the venue is a fact about ONE evening, and a remembered one
 * files next Tuesday's gig under last Thursday's pub. So it is kept for exactly
 * one evening — stamped with `nightKey()`, the 6am roll-over Past gigs, the
 * photos and the archive already share — and a pick from any other night reads
 * as nobody having said.
 *
 * A LEAF: no page of its own, no DOM. Storage is passed in so a test can hand
 * it a Map-shaped stand-in, and every read and write is wrapped, because a
 * private window or blocked site data throws on `localStorage` itself.
 */
import { nightKey } from './diary.js';

export const VENUE_STORE = 'musicquiz.tonightvenue';

/** The pub picked tonight, or `null` when nobody has said this evening. */
export function rememberedVenue(store, now = Date.now()) {
  try {
    const kept = JSON.parse(store.getItem(VENUE_STORE) || 'null');
    if (!kept || kept.night !== nightKey(now) || typeof kept.venue !== 'string') return null;
    return kept.venue;
  } catch {
    return null;
  }
}

/** Keep tonight's pick until 6am. An empty string is a pick too: "nowhere". */
export function rememberVenue(store, venue, now = Date.now()) {
  try {
    store.setItem(VENUE_STORE, JSON.stringify({ night: nightKey(now), venue: String(venue ?? '') }));
  } catch {
    // Nowhere to keep it: the pick still holds for as long as the page does.
  }
}
