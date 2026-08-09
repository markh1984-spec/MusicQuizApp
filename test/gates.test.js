import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OWNER_ONLY, changesTheLibrary } from '../src/gates.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * These come straight out of a safety sweep: signing in as a quizmaster and
 * trying, one at a time, everything a subscriber should not be able to do.
 *
 * Two of them worked. `POST /api/quiz` took the id in the BODY rather than the
 * path, so the `startsWith('/api/quiz/')` test — with the trailing slash —
 * never matched it, and a quizmaster could overwrite any quiz in the library
 * with one request. `POST /api/bingo` had the identical gap. Importing, the
 * playlist builder and the no-repeats memory were open for a different reason:
 * none of them looks like "saving a pack", so none of them was on the list.
 *
 * The bare path and the prefix are therefore BOTH asserted for every one.
 */

test('a pack cannot be written by the path the id is not in', () => {
  for (const base of ['/api/quiz', '/api/bingo', '/api/advert']) {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      // The id in the body…
      assert.equal(changesTheLibrary(base, method), true,
        `${method} ${base} is not gated — the id goes in the body`);
      // …and the id in the path.
      assert.equal(changesTheLibrary(`${base}/madonna`, method), true,
        `${method} ${base}/madonna is not gated`);
    }
  }
});

test('annotating a pack is writing to it', () => {
  assert.equal(changesTheLibrary('/api/quiz/madonna/checked', 'POST'), true);
});

/*
 * Importing IS how bingo packs are made now, the playlist step writes to the
 * owner's own Spotify account, and forgetting the history is what brings a
 * song back in front of a room months early. None of the three saves a pack in
 * the obvious way and all three are the catalogue.
 */
test('import, the playlist builder and the no-repeats memory are the catalogue', () => {
  assert.equal(changesTheLibrary('/api/import/bingo', 'POST'), true);
  assert.equal(changesTheLibrary('/api/playlist/intro', 'POST'), true);
  assert.equal(changesTheLibrary('/api/history/forget', 'POST'), true);
});

test('reading is never writing', () => {
  for (const route of ['/api/quiz/madonna', '/api/bingo/disco-funk', '/api/library', '/api/history']) {
    assert.equal(changesTheLibrary(route, 'GET'), false, `${route} counted as a write`);
  }
});

// Checking a pasted pack against the rules saves nothing, so the editor can do
// it mid-edit without the catalogue.
test('validating a pack is not writing to the library', () => {
  assert.equal(changesTheLibrary('/api/quiz/__validate', 'POST'), false);
  assert.equal(changesTheLibrary('/api/bingo/__validate', 'POST'), false);
});

test('nothing outside the library is caught by accident', () => {
  for (const route of [
    '/api/host/next', '/api/host/launch', '/api/join', '/api/answer', '/api/photo',
    '/api/sign-in', '/api/me/password', '/api/invoices', '/api/owner/accounts',
  ]) {
    assert.equal(changesTheLibrary(route, 'POST'), false, `${route} wrongly needs the catalogue`);
  }
});

/*
 * Every route on the Invoices tab asks for the ADMIN ADD-ON, not the library.
 *
 * Three of them asked for `FEATURES.LIBRARY`, which every quizmaster has, so a
 * subscriber with no admin add-on at all could download somebody else's
 * invoice — an invoice carries the host's own sort code and account number and
 * the customer's address — and could mark one paid or cancel it. Found by
 * signing in as a quizmaster and simply fetching one.
 *
 * Read out of the source because the gate is one line inside the request
 * handler, the same trick `looks.test.js` uses to keep emoji out of the
 * seasonal shapes. A wrong gate here is a bank detail, not a papercut.
 */
test('nothing on the Invoices tab is gated on the library', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8').split('\n');
  const offenders = [];
  lines.forEach((line, i) => {
    if (!/route\b.*['"`]\/api\/invoices/.test(line)) return;
    // The gate is the first `allowed(` within the few lines that open the route.
    for (const next of lines.slice(i, i + 6)) {
      if (!next.includes('allowed(')) continue;
      if (next.includes('FEATURES.LIBRARY')) offenders.push(`${i + 1}: ${line.trim()}`);
      break;
    }
  });
  assert.deepEqual(offenders, [],
    `an invoice route is gated on the library, not the admin add-on:\n${offenders.join('\n')}`);
});

/*
 * The other half of the same trap, and it has now bitten FOUR times: the owner
 * has no quiz features at all, so anything only an owner does has to skip the
 * broad `FEATURES.QUIZ` gate as well as pass its own. Import was the fourth —
 * the owner got a 403 on the main way bingo packs are made.
 *
 * A route is safe from that if it is on one list or the other. This test is
 * the thing that fails when somebody adds a fifth.
 */
test('every owner-only route escapes the broad quiz gate', () => {
  const ownerRoutes = [
    ['/api/generate/quiz', 'POST'],
    ['/api/generate/bingo', 'POST'],
    ['/api/generate/images', 'POST'],
    ['/api/owner/accounts', 'POST'],
    ['/api/owner/act-as', 'POST'],
    ['/api/reports/abc', 'POST'],
    ['/api/import/bingo', 'POST'],
    ['/api/playlist/intro', 'POST'],
    ['/api/history/forget', 'POST'],
    ['/api/quiz', 'POST'],
    ['/api/quiz/madonna', 'DELETE'],
    ['/api/bingo', 'POST'],
    ['/api/bingo/disco-funk', 'DELETE'],
    ['/api/advert/the-crown', 'PUT'],
  ];
  for (const [route, method] of ownerRoutes) {
    const exempt = changesTheLibrary(route, method)
      || OWNER_ONLY.some((prefix) => route.startsWith(prefix));
    assert.equal(exempt, true,
      `${method} ${route} would 403 for the OWNER — it is on neither list`);
  }
});
