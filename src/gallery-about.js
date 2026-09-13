/**
 * THE NUMBERS, AND HOW TO BOOK YOU — the other two thirds of a quizmaster's
 * public page.
 *
 * ---
 *
 * `/gallery?q=<accountId>` has shown a stranger the PHOTOGRAPHS since 20 August
 * 2026 and nothing else. The thing it was asked for — *"a shareable link, no
 * login: nights, numbers, and 'book me' — the thing that goes in an Instagram
 * bio or a cold email"* — was two thirds unbuilt, and the missing two thirds
 * are the two that sell. A landlord looking at a wall of photographs cannot
 * tell whether the room was busy, and has nothing to press when he decides he
 * wants one.
 *
 * **NOTHING NEW IS COLLECTED.** The headcount of every night has been in the
 * archive since `headcounts.js` was written; this is the same arithmetic, read
 * by somebody with no account.
 *
 * ---
 *
 * **ONE SUMMARY FUNCTION, N OF ONE OR N OF ALL** — the rule `headcounts.js`
 * already follows and CLAUDE.md sets for stats across a group. The plain
 * `/gallery` totals every night; `/the-crown/gallery` totals that pub's. Two
 * implementations is how the front page and the pub's own page come to
 * disagree about a number somebody is showing a landlord.
 *
 * **WHAT IS PUBLIC IS DECIDED BY THE ROUTE, NOT HERE** — this file is
 * arithmetic. The two gates live in `server.js` and both matter:
 *
 *  - **the numbers need a PUBLISHED night**, or `/gallery?q=` would report a
 *    whole season for a quizmaster who has published nothing;
 *  - **a pub's own numbers need a published night AT THAT PUB**, or guessing
 *    `/some-pub/gallery` would confirm that they work there. A venue name is
 *    the one thing on this page that is somebody else's business, and the
 *    index only ever names pubs that already have a night up.
 *
 * **NO PUB IS EVER NAMED BY THE TOTALS.** *"184 nights · 34 a night · 12
 * venues"* is arithmetic over the quizmaster's own work and names nobody, which
 * is what makes it safe to total every filed night rather than only the
 * published ones — the count would otherwise read "3 nights" for somebody with
 * three nights of photographs up and two years of work behind them, which is
 * the app underselling them with a number that is true of the wrong question.
 */

import { venueHeadcounts, nightHeadcount } from './headcounts.js';
import { venueSlug, sameVenueSlug } from '../public/assets/slugs.js';

/** One line of their own words. Long enough for a sentence, not a paragraph. */
export const BOOKING_MAX = 160;

/**
 * The numbers for a public page — every night, or one pub's.
 *
 * @param {Array}  nights  what `mergeGigs()` returns, newest first
 * @param {string} venue   a venue SLUG to narrow to, or '' for the lot
 * @returns {object|null}  null when there is nothing true to say
 */
export function galleryNumbers(nights = [], { venue = '' } = {}) {
  const want = String(venue || '').trim();
  if (want) {
    /*
     * ONE PUB IS ONE PUB, and on a public address the fold happens on the
     * SLUG — `sameVenueSlug()`, never `===`. A pub filed as "The Crown" one
     * week and "The Crown, Reading" the next has two slugs and one league
     * already; splitting its numbers here would put half a season under an
     * address that looks complete.
     */
    const here = venueHeadcounts(nights).venues
      .filter((v) => sameVenueSlug(venueSlug(v.venue), want));
    if (!here.length) return null;
    return summarise(here.flatMap((v) => v.series), { grew: true });
  }
  const counts = venueHeadcounts(nights);
  /*
   * `nightHeadcount()` rather than a sum of the venue groups: a night with no
   * venue on it is still a night they ran, and `venueHeadcounts()` puts those
   * in `unplaced` as a bare count with no players. Every night filed before
   * venues existed has none.
   *
   * A night NOBODY played is left out, which is `headcounts.js`'s own rule —
   * a launch tested and abandoned is not evidence of anything.
   */
  const series = nights
    .map((n) => ({ night: n.night, players: nightHeadcount(n) }))
    .filter((s) => s.players > 0);
  return summarise(series, { venues: distinctPubs(counts.venues) });
}

/**
 * HOW MANY PUBS, FOLDED THE WAY AN ADDRESS FOLDS — the fourth sighting of the
 * one-pub-two-spellings split, and the first where it was only a COUNT.
 *
 * `venueHeadcounts()` groups on the lowercased name, so "The Crown" and "The
 * Crown, Reading" are two rows — which is right on the console, where each row
 * is a pub somebody typed and might want to correct. On a public page the same
 * pub already has ONE set of numbers under either address (`sameVenueSlug()`),
 * so counting the rows would have printed *"3 venues"* over a page that treats
 * two of them as one. Overstating how many pubs somebody plays is the app
 * exaggerating on the page whose whole job is being believed.
 *
 * Greedy, and that is enough: the fold is a hyphen-boundary prefix, so the
 * shorter spelling absorbs the longer whichever order they arrive in.
 */
function distinctPubs(venues = []) {
  const kept = [];
  for (const v of venues) {
    const slug = venueSlug(v.venue);
    // An empty slug matches nothing, which is the rule everywhere this fold is
    // used — a night with no pub must not land in every pub's count.
    if (!slug || kept.some((k) => sameVenueSlug(k, slug))) continue;
    kept.push(slug);
  }
  return kept.length;
}

/**
 * The four numbers worth saying about a set of nights.
 *
 * **THE GROWTH LINE IS ONLY FOR ONE PUB, and only when the room GREW.**
 *
 * Across every venue, "first night to latest night" is two different rooms and
 * says nothing — so it is asked for explicitly rather than always computed.
 *
 * And a room that has shrunk is not printed. That is not the app hiding a fact
 * from the quizmaster — Past gigs shows them every night of it, deliberately
 * without red — it is the app declining to publish a sentence that argues
 * against the person whose page it is. `best` is on the page either way, so
 * nothing is replaced by silence.
 */
function summarise(list, { grew = false, venues = 0 } = {}) {
  if (!list.length) return null;
  // Oldest first, because a trend is read forwards — the same reason
  // `summarise()` in headcounts.js sorts.
  const series = [...list].sort((a, b) => String(a.night).localeCompare(String(b.night)));
  const players = series.reduce((n, s) => n + s.players, 0);
  const first = series[0];
  const latest = series[series.length - 1];
  return {
    nights: series.length,
    /*
     * THE AVERAGE, NEVER THE TOTAL — and the total is the number that looks
     * better, which is why this needs writing down.
     *
     * Summing every headcount across two years gives "6,200 players", and the
     * same forty regulars are in it fifty times. A landlord reads that as
     * footfall and it is not; the first time somebody checks it against their
     * own till it is the app caught exaggerating, on the page whose whole job
     * is being believed. The average is also the number he is actually
     * deciding on — *"how many will be in on a Thursday"*.
     */
    average: Math.round(players / series.length),
    best: series.reduce((n, s) => Math.max(n, s.players), 0),
    ...(venues ? { venues } : {}),
    ...(grew && series.length > 1 && latest.players > first.players
      ? { grew: { from: first.players, to: latest.players } }
      : {}),
  };
}

/**
 * Their own one line, cleaned the way a team name is.
 *
 * **NOT FILTERED, and that is the same decision `notes.js` records.** These are
 * the account holder's own words about their own business, on their own page.
 * A length cap and control characters stripped is the whole of it — the app
 * word-checking somebody's sales pitch would be absurd, and the profanity rule
 * in CLAUDE.md is about names the ROOM types.
 */
export function cleanBooking(words) {
  return String(words == null ? '' : words)
    .replace(/[\x00-\x1f\x7f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BOOKING_MAX);
}

/**
 * Somewhere for a landlord to press. http(s) or an email address.
 *
 * **AN EMAIL ADDRESS HAD TO BE HANDLED FIRST, or the http fallback eats it.**
 * `new URL('https://mark@example.com')` parses — as a URL with a USERNAME and
 * the host `example.com` — so the obvious thing to type in a "how do they book
 * you" box came back as a live link to somebody else's website. It produces no
 * error and looks right in the box, which is the shape of fault this repo keeps
 * recording.
 *
 * Everything else is refused rather than repaired: `javascript:` and `data:` on
 * a page a stranger opens are the two that matter.
 */
export function bookingLink(link) {
  const raw = String(link == null ? '' : link).trim().slice(0, 300);
  if (!raw) return '';
  if (/^mailto:/i.test(raw)) {
    const who = raw.slice('mailto:'.length).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who) ? `mailto:${who}` : '';
  }
  // No scheme, and an @ with a dot after it: an email address, not a host.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return `mailto:${raw}`;
  }
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    // "markquizzes.co.uk" is what somebody copies off a card — assume https
    // and check that, rather than throwing away a link that was nearly right.
    try {
      const url = new URL(`https://${raw}`);
      return url.hostname.includes('.') ? url.href : '';
    } catch {
      return '';
    }
  }
}

/**
 * What a stranger is told about how to book this quizmaster.
 *
 * **NOTHING IS DERIVED.** Not their sign-in address, not the email on their
 * invoices — publishing either would put an address they gave the APP onto a
 * page they never asked to carry it. Both fields are typed, and silence is the
 * default.
 *
 * Built field by field rather than spread, like every other public payload, or
 * the next preference added rides out onto a public page.
 */
export function bookingOf(account) {
  const prefs = (account && account.prefs) || {};
  const words = cleanBooking(prefs.booking);
  const link = bookingLink(prefs.bookingLink);
  if (!words && !link) return null;
  return { ...(words ? { words } : {}), ...(link ? { link } : {}) };
}
