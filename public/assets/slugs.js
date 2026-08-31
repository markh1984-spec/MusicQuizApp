/**
 * THE ADDRESSES A REGULAR CAN TYPE — `/station-tap-wokingham/quiz-league`.
 *
 * Asked for on 31 August 2026: *"I want to be able to have the URLs
 * conveniently reachable, so something like
 * quizporium.co.uk/station-tap-wokingham/gallery/20-august and
 * quizporium.co.uk/station-tap-wokingham/quiz-league (or similar). Possible?"*
 *
 * ---
 *
 * **A SLUG IS DERIVED AND NEVER STORED.** It is a function of the venue's name
 * and the night's date, both of which the app already holds — so there is no
 * second record to keep in step, nothing to migrate, and renaming a venue
 * changes its address rather than leaving a stale one pointing somewhere else.
 * That is the same call `pack-look.js` makes about a pack's colours and rule 11
 * makes about packs: fewer copies beats better syncing.
 *
 * **WHICH MEANS RENAMING A VENUE BREAKS ITS LINK, and that is the honest
 * trade.** A stored slug would survive the rename and then name a pub that no
 * longer exists — a link that works and lies. This one 404s, which is a
 * question somebody asks rather than an answer nobody checks.
 *
 * **IT LIVES IN `public/assets/` AND THE SERVER IMPORTS IT FROM THERE**, like
 * `schemes.js`, `show-parts.js` and `break-parts.js` — because the page reads
 * its own address and the server reads the same one, and two implementations
 * of one slug is how a link comes to work in the browser and 404 on the
 * server. It has no page and no boot code, which is what makes that safe.
 *
 * **NOTHING HERE DECIDES WHAT IS PUBLIC.** A slug resolves to a venue; the
 * league switch and the published list decide whether that venue has a page at
 * all, exactly as they did before addresses existed. An address for something
 * unpublished is a 404 like any other.
 */

/** Words dropped from the front of a venue name — an article is not an address. */
const LEADING = ['the', 'a', 'an'];

/**
 * `"The Station Tap, Wokingham"` → `station-tap-wokingham`.
 *
 * Accents are folded rather than dropped, so "Café Royal" is `cafe-royal` and
 * not `caf-royal`. Everything that is not a letter or a digit becomes a
 * hyphen, runs collapse, and the ends are trimmed.
 */
export function venueSlug(name) {
  const flat = String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // An ampersand is read aloud as a word, so it survives as one.
    .replace(/&/g, ' and ')
    // An apostrophe VANISHES rather than becoming a hyphen: "O'Neill's" is
    // `oneills`, not `o-neill-s`, which is neither readable nor typeable.
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!flat) return '';
  const parts = flat.split('-');
  // Only the FIRST word, and only when something follows it: a pub genuinely
  // called "The" is not a thing, but dropping the article off "The Bell" must
  // not leave an empty address.
  if (parts.length > 1 && LEADING.includes(parts[0])) parts.shift();
  return parts.join('-');
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * `"2026-08-20"` → `20-august`.
 *
 * **No year, deliberately** — it is the form somebody would type, and a
 * quizmaster handing out a link a fortnight after the night wants it short.
 * The cost is that two Augusts collide, which `matchNightSlug()` resolves by
 * preferring the newest; a link that has to be exact can carry the year and
 * this reads that too.
 */
export function nightSlug(night) {
  const [y, m, d] = String(night || '').split('-');
  const month = MONTHS[Number(m) - 1];
  if (!month || !Number(d)) return '';
  return `${Number(d)}-${month}${y ? '' : ''}`;
}

/** The unambiguous form, for a link that must never drift: `20-august-2026`. */
export function nightSlugExact(night) {
  const [y] = String(night || '').split('-');
  const short = nightSlug(night);
  return short && y ? `${short}-${y}` : short;
}

/**
 * Does this night match what somebody typed?
 *
 * Reads `20-august` and `20-august-2026`, and is deliberately forgiving about
 * neither: anything else is no match rather than a guess.
 */
export function matchNightSlug(night, slug) {
  const want = String(slug || '').toLowerCase();
  if (!want) return false;
  return want === nightSlug(night) || want === nightSlugExact(night);
}

/**
 * THE TWO PAGES A VENUE HAS, and the only second segments this app answers on
 * a slug path.
 *
 * A one-segment prefix at the root is a catch-all, and a catch-all at the root
 * of an app that also serves `/console`, `/play` and `/assets/…` is how a page
 * quietly starts shadowing a route somebody adds next year. Naming the second
 * segment exactly means `/anything/quiz-league` is the ONLY shape this can
 * claim, and nothing existing has that shape.
 */
export const VENUE_PAGES = ['quiz-league', 'gallery'];

/**
 * FIRST SEGMENTS A VENUE ADDRESS MAY NOT CLAIM.
 *
 * **This list exists because the first version of this route ate
 * `/api/gallery`.** Two segments, the second one `gallery` — exactly the shape
 * a venue address has — so the API started answering with the gallery PAGE and
 * four tests failed with *"Unexpected token '<'"*. The comment warning about a
 * catch-all at the root was written in the same commit that walked into one.
 *
 * Naming the second segment is not enough on its own; the FIRST one has to be
 * refused as well. `test/slugs.test.js` walks `server.js` for every literal
 * top-level route and fails if one is missing here, so a route added next year
 * cannot be quietly shadowed by a pub with the same name.
 */
export const RESERVED = [
  'api', 'assets', 'gallery', 'league', 'play', 'host', 'console', 'editor',
  'login', 'home', 'signup', 'owner', 'screen', 'v', 'o', 'r', 'terms',
  'privacy', 'refunds', 'past-photo', 'gallery-photo', 'favicon.svg',
  'robots.txt', 'manifest.webmanifest', 'sw.js',
  // Found by the guard rather than by remembering — which is the point of it.
  'health', 'photos', 'quiz-images', 'reset', 'qr.svg', 'join-qr.svg',
];

/**
 * Read `/station-tap-wokingham/gallery/20-august` into its parts.
 *
 * @returns {{venue: string, page: string, night: string}|null}
 */
export function readVenuePath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length < 2 || parts.length > 3) return null;
  const [venue, page, night = ''] = parts;
  if (!VENUE_PAGES.includes(page)) return null;
  // The venue segment has to look like a slug we would have made. That is a
  // validation, not a lookup: it keeps a path traversal or a stray character
  // out of everything downstream.
  if (!/^[a-z0-9-]{1,120}$/.test(venue)) return null;
  // AND IT MAY NOT BE A NAME THIS APP ALREADY SERVES — see `RESERVED`.
  if (RESERVED.includes(venue)) return null;
  if (night && !/^[a-z0-9-]{1,40}$/.test(night)) return null;
  // Only the gallery has a third segment. A league is a season, not a night.
  if (night && page !== 'gallery') return null;
  return { venue, page, night };
}
