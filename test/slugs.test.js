/**
 * A VENUE'S OWN ADDRESS — and the guard that stops it eating a real route.
 *
 * *"I want to be able to have the URLs conveniently reachable, so something
 * like quizporium.co.uk/station-tap-wokingham/gallery/20-august and
 * quizporium.co.uk/station-tap-wokingham/quiz-league."*
 *
 * **THE INTERESTING TEST IS THE LAST ONE.** A one-segment prefix at the root
 * is a catch-all, and the first version of this route ate `/api/gallery` — two
 * segments, the second one `gallery`, exactly the shape a venue address has.
 * The API started answering with the gallery PAGE. That is a whole class of
 * fault that arrives silently the day somebody adds a route, so the reserved
 * list is checked against `server.js` itself rather than kept by hand.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  RESERVED, matchNightSlug, nightSlug, nightSlugExact, readVenuePath, venueSlug,
} from '../public/assets/slugs.js';

test('a venue name becomes something somebody could type', () => {
  assert.equal(venueSlug('The Station Tap, Wokingham'), 'station-tap-wokingham');
  assert.equal(venueSlug('The Crown'), 'crown');
  // Accents FOLDED, not dropped — "caf-royal" would be a different pub.
  assert.equal(venueSlug('Café Royal'), 'cafe-royal');
  // An ampersand is read aloud as a word, so it survives as one.
  assert.equal(venueSlug('Dog & Duck'), 'dog-and-duck');
  assert.equal(venueSlug('  The   Bell  '), 'bell');
  assert.equal(venueSlug(''), '');
});

test('the article only goes when something is left behind it', () => {
  // A pub called "The" is not a thing, but an empty address would be — and it
  // would match every venue with no name at all.
  assert.equal(venueSlug('The'), 'the');
  assert.equal(venueSlug('A'), 'a');
});

test('two different pubs never share an address, and punctuation does not litter one', () => {
  assert.notEqual(venueSlug('The Bell'), venueSlug('The Bell Inn'));
  // An apostrophe VANISHES rather than becoming a hyphen — "o-neill-s" is
  // neither readable nor typeable, which is the whole point of an address.
  assert.equal(venueSlug("O'Neill's"), 'oneills');
});

test('a night reads as a date somebody would say, with the year when it matters', () => {
  assert.equal(nightSlug('2026-08-20'), '20-august');
  assert.equal(nightSlugExact('2026-08-20'), '20-august-2026');
  assert.equal(nightSlug('2026-01-01'), '1-january');
  assert.equal(nightSlug('not-a-date'), '');
});

test('a night matches either form and guesses at neither', () => {
  assert.equal(matchNightSlug('2026-08-20', '20-august'), true);
  assert.equal(matchNightSlug('2026-08-20', '20-august-2026'), true);
  // The year, when given, is part of the answer — two Augusts are two nights.
  assert.equal(matchNightSlug('2025-08-20', '20-august-2026'), false);
  assert.equal(matchNightSlug('2026-08-20', '20-aug'), false);
  assert.equal(matchNightSlug('2026-08-20', ''), false);
});

test('only the two page names are answered, and only in the right shape', () => {
  assert.deepEqual(readVenuePath('/station-tap-wokingham/quiz-league'),
    { venue: 'station-tap-wokingham', page: 'quiz-league', night: '' });
  assert.deepEqual(readVenuePath('/station-tap-wokingham/gallery/20-august'),
    { venue: 'station-tap-wokingham', page: 'gallery', night: '20-august' });
  // A league is a season, not a night.
  assert.equal(readVenuePath('/crown/quiz-league/20-august'), null);
  assert.equal(readVenuePath('/crown/photos'), null);
  assert.equal(readVenuePath('/crown'), null);
  assert.equal(readVenuePath('/a/b/c/d'), null);
});

test('a venue segment cannot carry a path traversal or a stray character', () => {
  for (const bad of ['/../gallery', '/%2e%2e/gallery', '/Crown/gallery', '/cr own/gallery',
    '/crown!/gallery', `/${'x'.repeat(200)}/gallery`]) {
    assert.equal(readVenuePath(bad), null, `${bad} was accepted`);
  }
});

test('A VENUE ADDRESS CANNOT SHADOW A ROUTE THIS APP ALREADY SERVES', () => {
  /*
   * Every literal top-level route in `server.js`, checked against the reserved
   * list. This is the guard the first version did not have, and it is written
   * against the SOURCE rather than a list somebody keeps up to date — a
   * reserved list maintained by hand is one somebody forgets on the day they
   * add `/leaderboard`, and the failure is a public page answering with the
   * wrong file.
   */
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const found = new Set();
  for (const m of src.matchAll(/route === '\/([a-z0-9._-]+)'/g)) found.add(m[1]);
  for (const m of src.matchAll(/route\.startsWith\('\/([a-z0-9._-]+)\//g)) found.add(m[1]);
  const missing = [...found].filter((r) => !RESERVED.includes(r)).sort();
  assert.deepEqual(missing, [],
    `these top-level routes could be shadowed by a venue address — add them to RESERVED in public/assets/slugs.js:\n  ${missing.join('\n  ')}`);
});

test('and every reserved name is refused as a venue', () => {
  for (const name of RESERVED) {
    assert.equal(readVenuePath(`/${name}/gallery`), null, `${name} was allowed`);
  }
});
