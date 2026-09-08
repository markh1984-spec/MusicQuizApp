/**
 * Past gigs — the record of what somebody has actually run.
 *
 * What the tests are for here is not the layout, which will move. It is the
 * four things that make the page trustworthy: two quizmasters' photographs are
 * never in one folder, one evening is one row however late it finished, a night
 * survives a deploy, and a restore can never write over a disk that already has
 * history on it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { photoFolder, isNightFolder, nightOfGig, mergeGigs, safePhotoName, sameVenue, setNightVenue, noteNightVenue } from '../src/past-gigs.js';
import { archiveResults, serialiseArchive, restoreArchive, listArchive, HOUSE_ROOM } from '../src/library.js';
import { nightOf } from '../src/photos.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gigs-'));
}

// --------------------------------------------------------------- the folders

test('the house keeps the flat photo folder it has always used', () => {
  // Mark already has nights filed under photos/<date>/. Moving them would make
  // his own history disappear off the page that exists to show it.
  assert.equal(photoFolder(HOUSE_ROOM), 'photos');
  assert.equal(photoFolder(), 'photos');
});

test('every other quizmaster gets a folder of their own', () => {
  assert.equal(photoFolder('acc_rob'), 'photos/acc_rob');
  assert.notEqual(photoFolder('acc_rob'), photoFolder('acc_james'));
});

test('only something shaped like a date counts as a night', () => {
  assert.ok(isNightFolder('2026-08-11'));
  assert.ok(!isNightFolder('notes'));
  assert.ok(!isNightFolder('..'));
  assert.ok(!isNightFolder('2026-08'));
});

test('a photo name has to be one this app issued', () => {
  assert.equal(safePhotoName('pm1a2b30.jpg'), 'pm1a2b30.jpg');
  assert.equal(safePhotoName('a.png'), 'a.png');
  // The names come back through a listing, so they are checked before they are
  // used to build a path rather than trusted because they started out as ours.
  assert.equal(safePhotoName('../../accounts.json'), '');
  assert.equal(safePhotoName('shell.sh'), '');
  assert.equal(safePhotoName('a b.jpg'), '');
});

test('the one exception is the -picked marker photos.js writes, and only that word', () => {
  // NOT_CAMERA_SUFFIX in photos.js — a photo the gallery filter holds back.
  assert.equal(safePhotoName('pm1a2b30-picked.jpg'), 'pm1a2b30-picked.jpg');
  // Still not an open door for an arbitrary hyphenated name.
  assert.equal(safePhotoName('pm1a2b30-anything.jpg'), '');
  assert.equal(safePhotoName('-picked.jpg'), '');
});

// ------------------------------------------------------- one evening, one row

test('a gig that finishes after midnight is filed under the night it started', () => {
  // 00:30 on the 12th is still Tuesday the 11th's gig. It HAS to match the
  // photos' own roll-over or one evening appears twice on the page — half the
  // games under one date and all the pictures under another.
  const halfTwelve = Date.parse('2026-08-12T00:30:00Z');
  assert.equal(nightOfGig(halfTwelve), '2026-08-11');
  assert.equal(nightOfGig(halfTwelve), nightOf(halfTwelve));
});

test('a quiz and the bingo after it are one night with two games', () => {
  const at = Date.parse('2026-08-11T21:00:00Z');
  const nights = mergeGigs([
    { id: 'a', kind: 'quiz', title: 'The Eighties', archivedAt: at, playerCount: 31, winner: 'Quizteama' },
    { id: 'b', kind: 'bingo', title: 'Disco Funk', archivedAt: at + 40 * 60 * 1000, playerCount: 28, winner: 'Bingo Wings' },
  ], []);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].games.length, 2);
  assert.deepEqual(nights[0].games.map((g) => g.title), ['The Eighties', 'Disco Funk']);
});

test('two DIFFERENT venues on the same calendar day stay ONE row, but stop claiming either venue', () => {
  // Found live: this used to silently take the FIRST game's venue for the
  // whole day, misattributing the second venue's headcount, winner and
  // prizes to the first. Splitting into two rows was tried and reverted —
  // photos are one folder per DATE with no venue in the name at all, and
  // the PDF export / unbilled-invoice match / drag-and-drop bench all
  // address a night by its date string alone, so two rows sharing one date
  // would have made every one of those ambiguous. An honest `venueMixed`
  // flag fixes the misattribution without touching that addressing.
  const at = Date.parse('2026-08-11T13:00:00Z');
  const nights = mergeGigs([
    { id: 'a', kind: 'quiz', title: 'Lunchtime Quiz', archivedAt: at, venue: 'The Crown', playerCount: 12 },
    { id: 'b', kind: 'quiz', title: 'Evening Quiz', archivedAt: at + 8 * 60 * 60 * 1000, venue: 'The Dog and Duck', playerCount: 40 },
  ], []);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].games.length, 2, 'both games are still there — nothing is dropped');
  assert.equal(nights[0].venue, '', 'must not silently claim either venue');
  assert.equal(nights[0].venueMixed, true);
});

test('the SAME venue, typed identically twice, still merges and claims it cleanly', () => {
  const at = Date.parse('2026-08-11T21:00:00Z');
  const nights = mergeGigs([
    { id: 'a', kind: 'quiz', title: 'The Eighties', archivedAt: at, venue: 'The Crown', playerCount: 31 },
    { id: 'b', kind: 'bingo', title: 'Disco Funk', archivedAt: at + 40 * 60 * 1000, venue: 'The Crown', playerCount: 28 },
  ], []);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].games.length, 2);
  assert.equal(nights[0].venue, 'The Crown');
  assert.equal(nights[0].venueMixed, false);
});

test('a linked venue id agrees with itself even when the free-text name is typo\'d differently', () => {
  const at = Date.parse('2026-08-11T21:00:00Z');
  const nights = mergeGigs([
    { id: 'a', kind: 'quiz', title: 'The Eighties', archivedAt: at, venue: 'The Crown', venueId: 'v1', playerCount: 31 },
    { id: 'b', kind: 'bingo', title: 'Disco Funk', archivedAt: at + 40 * 60 * 1000, venue: 'The Crown Pub', venueId: 'v1', playerCount: 28 },
  ], []);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].venueMixed, false, 'the shared id says this is one venue, whatever the free text says');
});

test('a THIRD game at a third venue the same day is caught too, not just a two-way mismatch', () => {
  const at = Date.parse('2026-08-11T12:00:00Z');
  const nights = mergeGigs([
    { id: 'a', archivedAt: at, venue: 'The Crown', playerCount: 10 },
    { id: 'b', archivedAt: at + 60 * 60 * 1000, venue: 'The Crown', playerCount: 10 },
    { id: 'c', archivedAt: at + 2 * 60 * 60 * 1000, venue: 'The Anchor', playerCount: 10 },
  ], []);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].venueMixed, true);
  assert.equal(nights[0].games.length, 3);
});

test('a night with photos and no saved results still appears', () => {
  // The archive only started being kept permanently recently, and somebody can
  // finish a night by launching something else. Photographs are evidence the
  // gig happened; dropping the night because the results are missing would
  // hide real work.
  const nights = mergeGigs([], ['2026-07-04']);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].hasPhotos, true);
  assert.deepEqual(nights[0].games, []);
});

test('nights come back newest first', () => {
  const nights = mergeGigs([], ['2025-12-31', '2026-08-11', '2026-01-02']);
  assert.deepEqual(nights.map((n) => n.night), ['2026-08-11', '2026-01-02', '2025-12-31']);
});

test('a stray folder that is not a date is not a gig', () => {
  assert.deepEqual(mergeGigs([], ['README', 'thumbs']), []);
});

// ------------------------------------------------------- surviving a deploy

test('the whole archive goes out and comes back', () => {
  const from = tempDir();
  archiveResults(from, { packId: 'eighties', title: 'The Eighties', kind: 'quiz', leaderboard: [{ name: 'Quizteama' }] }, Date.parse('2026-08-11T21:30:00Z'));
  archiveResults(from, { packId: 'disco', title: 'Disco Funk', kind: 'bingo', leaderboard: [] }, Date.parse('2026-08-04T21:30:00Z'));

  const serialised = serialiseArchive(from);
  const to = tempDir();
  const result = restoreArchive(to, serialised);

  assert.equal(result.ok, true);
  assert.equal(result.nights, 2);
  assert.deepEqual(listArchive(to).map((n) => n.title), listArchive(from).map((n) => n.title));
});

/**
 * GIGS CAN SAY WHAT WAS TAKEN, not only what was put up.
 *
 * The vouchers have been in the filed record since the bar started scanning
 * them, and `updateArchivedNight()` keeps them current when one is redeemed
 * minutes after the night is archived — but the SUMMARY this list is built
 * from never carried the number, so the console could only ever name the
 * prizes offered. An unclaimed prize is money still behind a bar, and it is
 * the quizmaster who gets asked about it weeks later.
 */
test('a filed night says how many prizes were actually taken', () => {
  const dir = tempDir();
  archiveResults(dir, {
    packId: 'tonight',
    quizTitle: 'Tonight',
    kind: 'quiz',
    rewards: ['A round of drinks', 'A bar tab', 'A packet of crisps'],
    vouchers: [
      { code: 'AAA', redeemedAt: 1_700_000_000_000 },
      { code: 'BBB', redeemedAt: null },
      { code: 'CCC', redeemedAt: 1_700_000_100_000 },
    ],
    leaderboard: [{ position: 1, name: 'Quizteam Aguilera', score: 10 }],
  }, Date.now());

  const [night] = listArchive(dir);
  assert.equal(night.rewards.length, 3, 'what was put up');
  assert.equal(night.rewardsTaken, 2, 'what was collected — the half nothing read back out');
});

/**
 * A RUNNING-ORDER NIGHT IS STILL ONE ARCHIVED RECORD, so its one game entry
 * has to carry every part it was made of, not just the part that happened to
 * finish it — see session.js's `describeOrderParts()`. Without this, quiz ->
 * bingo -> quiz merges down to a single game entry naming only the closing
 * quiz, and the bingo interlude in between vanishes from Past gigs.
 */
test('mergeGigs carries a running-order night\'s `parts` through onto its game entry', () => {
  const dir = tempDir();
  archiveResults(dir, {
    packId: '~tonight',
    quizTitle: 'Quiz quiz-b',
    kind: 'quiz',
    parts: [
      { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-a' },
      { kind: 'bingo', id: 'bingo-a', title: 'Bingo bingo-a' },
      { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-b' },
    ],
  }, Date.now());

  const [night] = mergeGigs(listArchive(dir), []);
  assert.equal(night.games.length, 1, 'a running-order night is still one archived record');
  assert.deepEqual(night.games[0].parts, [
    { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-a' },
    { kind: 'bingo', id: 'bingo-a', title: 'Bingo bingo-a' },
    { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-b' },
  ]);
});

test('an ordinary night\'s game entry has no `parts` field', () => {
  const dir = tempDir();
  archiveResults(dir, { packId: 'p', quizTitle: 'Ordinary', kind: 'quiz' }, Date.now());
  const [night] = mergeGigs(listArchive(dir), []);
  assert.equal('parts' in night.games[0], false);
});

test('a night with no vouchers reports none taken rather than undefined', () => {
  const dir = tempDir();
  archiveResults(dir, { packId: 'p', quizTitle: 'Quiet one', kind: 'quiz' }, Date.now());
  assert.equal(listArchive(dir)[0].rewardsTaken, 0);
});

/**
 * THE REINSTATE COUNT IS THE SIGNAL, not the redemption.
 *
 * `reinstateVoucher()` in engine.js has counted this on the voucher since Put
 * it back existed — it just never left the live control view. A voucher put
 * back once is the system working; one put back three times is either a bar
 * that cannot reach us or somebody working it, and that is worth having on
 * the filed record rather than only on a panel that changes and is gone.
 */
test('a filed night says how many times a voucher was put back', () => {
  const dir = tempDir();
  archiveResults(dir, {
    packId: 'tonight',
    quizTitle: 'Tonight',
    kind: 'quiz',
    rewards: ['A round of drinks', 'A bar tab'],
    vouchers: [
      { code: 'AAA', redeemedAt: 1_700_000_000_000, reinstated: 0 },
      { code: 'BBB', redeemedAt: null, reinstated: 3 },
    ],
    leaderboard: [{ position: 1, name: 'Quizteam Aguilera', score: 10 }],
  }, Date.now());

  const [night] = listArchive(dir);
  assert.equal(night.rewardsReinstated, 3);
});

test('a night with no vouchers reports no reinstates rather than undefined', () => {
  const dir = tempDir();
  archiveResults(dir, { packId: 'p', quizTitle: 'Quiet one', kind: 'quiz' }, Date.now());
  assert.equal(listArchive(dir)[0].rewardsReinstated, 0);
});

test('a voucher filed before reinstate counting existed reports zero, not a crash', () => {
  const dir = tempDir();
  archiveResults(dir, {
    packId: 'p', quizTitle: 'Old night', kind: 'quiz',
    vouchers: [{ code: 'AAA', redeemedAt: null }],
  }, Date.now());
  assert.equal(listArchive(dir)[0].rewardsReinstated, 0);
});

test('a disk that already has nights on it is ahead of any backup', () => {
  // The same rule as the accounts, the invoice book and the play counts.
  // Reading a backup over the top would either duplicate a night or lose one.
  const dir = tempDir();
  archiveResults(dir, { packId: 'tonight', title: 'Tonight', kind: 'quiz' }, Date.now());
  const result = restoreArchive(dir, JSON.stringify({ nights: [{ id: '2020-01-01-old', title: 'Old' }] }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'already_have_some');
  assert.equal(listArchive(dir).length, 1);
  assert.equal(listArchive(dir)[0].title, 'Tonight');
});

test('a corrupt backup is refused rather than believed', () => {
  const dir = tempDir();
  assert.equal(restoreArchive(dir, 'not json at all').ok, false);
  assert.equal(restoreArchive(dir, JSON.stringify({ something: 'else' })).reason, 'nothing_in_it');
  assert.deepEqual(listArchive(dir), []);
});

test('a night in a backup cannot write outside the archive folder', () => {
  const dir = tempDir();
  const result = restoreArchive(dir, JSON.stringify({ nights: [{ id: '../../escaped', title: 'Nope' }, { id: 'ok-night', title: 'Fine' }] }));
  assert.equal(result.ok, true);
  assert.equal(result.nights, 1);
  assert.deepEqual(fs.readdirSync(dir), ['ok-night.json']);
});

test('serialising a folder that is not there is empty rather than a throw', () => {
  // The normal first boot. A quizmaster who has finished no nights yet must not
  // take a backup down with them.
  const serialised = serialiseArchive(path.join(tempDir(), 'never-made'));
  assert.deepEqual(JSON.parse(serialised), { nights: [] });
});

/*
 * ONE PUB IS ONE PUB, whichever way it was filed — `sameVenue()`.
 *
 * Three readers of the archive had each invented their own answer to this, and
 * two of them compared venue STRINGS: the landlord's report and the projector's
 * own league band, the second of which did not even trim. A pub picked off the
 * book one week and typed freehand the next split a season in half, on a
 * document that gets forwarded to a brewery.
 */
test('sameVenue folds an id and a typed name into one pub', () => {
  const byId = { venue: 'The Station Tap, Wokingham', venueId: 'v1' };
  const typed = { venue: 'The Station Tap, Wokingham' };
  const spaced = { venue: '  the station tap, wokingham ' };

  assert.equal(sameVenue(byId, typed), true, 'an id and the same name typed in are one pub');
  assert.equal(sameVenue(typed, spaced), true, 'case and stray spaces are not a second pub');
  assert.equal(sameVenue(byId, { venue: 'The Station Tap, Wokingham', venueId: 'v1' }), true);

  // Two pubs that genuinely share a name stay apart wherever the book was used
  // — that is what the id is for, and it is the cost the fold accepts knowingly
  // everywhere it has no id to go on.
  assert.equal(sameVenue(byId, { venue: 'The Station Tap, Wokingham', venueId: 'v2' }), false);
  assert.equal(sameVenue(byId, { venue: 'The Crown' }), false);

  // A night with no pub on it must not land in every pub's season.
  assert.equal(sameVenue({ venue: '' }, { venue: '' }), false);
  assert.equal(sameVenue({ venue: '' }, typed), false);
  assert.equal(sameVenue(null, typed), false);
});

/**
 * THE OWNER'S NIGHTS ARE FILED IN TWO ROOMS, AND THE LISTING HAS TO READ BOTH.
 *
 * `/api/past-gigs` joins archive records to photo folders BY DATE. The archive
 * came from `roomForHost()` — HOUSE for the owner and the host key — and the
 * folders from `galleryRoomFor()`, which for those two identities is the
 * owner's own quizmaster room. A night hosted under one hat and photographed
 * under the other found no record for its date and came out with no pub on it.
 *
 * The union is asserted here, on `mergeGigs` itself, and the guard below is
 * pointed at the ROUTE — because the fault was never in the merge, it was in
 * only ever handing it one room's records.
 */
test('records from two rooms merge onto one night, and the venue survives', () => {
  const at = Date.parse('2026-08-20T21:00:00Z');
  const house = [{
    id: 'h1', kind: 'quiz', title: '80s', archivedAt: at,
    playerCount: 31, venue: 'The Station Tap, Wokingham', venueId: 'v1',
  }];
  const gallery = [];
  const [night] = mergeGigs([...house, ...gallery], ['2026-08-20']);
  assert.equal(night.venue, 'The Station Tap, Wokingham');
  assert.equal(night.hasPhotos, true);
  assert.equal(night.games.length, 1);
});

/**
 * AND A PHOTO-ONLY NIGHT SAYS SO WITH AN EMPTY VENUE, which is what the rail
 * reads to explain itself. The neighbouring test pins `games` and `hasPhotos`
 * and left this unstated — and it is the field the whole symptom is about.
 */
test('a night with photographs and no archive record has no venue', () => {
  const [night] = mergeGigs([], ['2026-08-20']);
  assert.equal(night.venue, '');
  assert.equal(night.venueId, '');
  assert.equal(night.venueMixed, false);
  assert.deepEqual(night.games, []);
});

/**
 * THE PATTERN, NOT THE SYMPTOM. A route that reads ONE room's archive and
 * joins it to the gallery room's photographs is the bug, whoever writes it
 * next — so the guard forbids the shape rather than pinning the two call
 * sites that had it.
 */
test('no past-gigs route joins one room\'s archive to another room\'s photos', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  /*
   * ONLY THE CALLS THAT ACTUALLY JOIN. Five other `mergeGigs` calls hand it
   * `[]` for the folders — they read the archive and nothing else, so the
   * two-room split cannot reach them. Forbidding the shape outright caught
   * those and would have made this a test with an exceptions list, which this
   * repo's own rule says has stopped being a test.
   */
  const joins = [];
  for (let at = src.indexOf('mergeGigs('); at !== -1; at = src.indexOf('mergeGigs(', at + 1)) {
    const call = src.slice(at, at + 260);
    if (call.includes('folders')) joins.push(call);
  }
  assert.ok(joins.length >= 2, `expected the listing and the report to join photos, found ${joins.length}`);
  for (const call of joins) {
    assert.ok(
      call.includes('gigRooms'),
      'a night list joining photos to an archive must read EVERY room this account files in — see gigRoomsFor()',
    );
  }
  assert.ok(src.includes('function gigRoomsFor('), 'gigRoomsFor() is what supplies them');
});

/*
 * ---- WHERE A PAST NIGHT WAS -----------------------------------------------
 *
 * Asked for after a batch of photographs turned up under "No venue on these":
 * *"let me set the venue on a past night"*. What these pin is the half that
 * cannot be seen from a console — that it reaches EVERY record for the date,
 * that it can carry an id, and that a night with nothing filed for it gets
 * somewhere to keep the answer without gaining a game it never had.
 */

test('setting a venue reaches every game filed on that night, not just the first', () => {
  const dir = tempDir();
  const at = Date.parse('2026-09-03T21:00:00Z');
  archiveResults(dir, { packId: 'eighties', leaderboard: [{ name: 'A' }] }, at);
  archiveResults(dir, { packId: 'disco', kind: 'bingo', leaderboard: [{ name: 'A' }] }, at + 3_600_000);

  const done = setNightVenue(dir, '2026-09-03', { venue: 'The Station Tap, Wokingham', venueId: 'v7' });
  assert.equal(done.changed, 2);

  const nights = mergeGigs(listArchive(dir), []);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].venue, 'The Station Tap, Wokingham');
  assert.equal(nights[0].venueId, 'v7');
  // And it is no longer two venues on one date, which is one of the four
  // reasons a row draws with no pub on it.
  assert.equal(nights[0].venueMixed, false);
});

test('a night that finished after midnight is still the night the photographs are under', () => {
  const dir = tempDir();
  // Half past midnight: `nightOfGig()` files this under the 3rd, and the
  // photo folder beside it is `2026-09-03` for the same reason.
  archiveResults(dir, { packId: 'eighties' }, Date.parse('2026-09-04T00:30:00Z'));
  assert.equal(setNightVenue(dir, '2026-09-03', { venue: 'The Crown' }).changed, 1);
  assert.equal(listArchive(dir)[0].venue, 'The Crown');
});

test('a date that is not a date changes nothing', () => {
  const dir = tempDir();
  archiveResults(dir, { packId: 'eighties', venue: 'The Crown' }, Date.parse('2026-09-03T21:00:00Z'));
  assert.equal(setNightVenue(dir, '../etc', { venue: 'Elsewhere' }).ok, false);
  assert.equal(listArchive(dir)[0].venue, 'The Crown');
});

test('a night with nothing filed gets a NOTE, and the note is not a game', () => {
  const dir = tempDir();
  // Nothing archived at all — the quiz was stopped before the final scores, or
  // the server restarted mid-evening. The photographs are still there.
  assert.equal(setNightVenue(dir, '2026-09-05', { venue: 'The Station Tap' }).changed, 0);
  noteNightVenue(dir, '2026-09-05', { venue: 'The Station Tap', venueId: 'v7' });

  const nights = mergeGigs(listArchive(dir), ['2026-09-05']);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].venue, 'The Station Tap');
  assert.equal(nights[0].venueId, 'v7');
  assert.equal(nights[0].hasPhotos, true);
  // THE POINT: it carries the venue and nothing else. A phantom nought-player
  // game here would land in the headcounts, the league and "has this room
  // heard this before?", and Post gig's "No results saved" would stop being
  // true of a night that genuinely has no results.
  assert.deepEqual(nights[0].games, []);
});

test('a note never overwrites a real record — the patch runs first', () => {
  const dir = tempDir();
  archiveResults(dir, { packId: 'eighties', leaderboard: [{ name: 'A' }] }, Date.parse('2026-09-05T21:00:00Z'));
  assert.equal(setNightVenue(dir, '2026-09-05', { venue: 'The Crown' }).changed, 1);
  const nights = mergeGigs(listArchive(dir), []);
  assert.equal(nights[0].games.length, 1);
  assert.equal(nights[0].venue, 'The Crown');
});

/*
 * ---- AND THE ROUTE ANSWERS A POST AT ALL ----------------------------------
 *
 * The same assertion the publish route beside it needed, for the same reason:
 * a route written in `handleGet` is only ever reached by GET and HEAD, so a
 * POST falls through to the generic 404 and the whole feature is dead code
 * that reads as a working one. **A 404 is what is asserted against**, not the
 * 200 — the difference between "the route refused that" and "there is no such
 * route" is invisible to anything that does not make the request.
 */
test('the venue route answers a POST, and writes what it is sent', async () => {
  const { withServer } = await import('./helpers/live-server.mjs');
  await withServer(async (base, dir) => {
    const res = await fetch(`${base}/api/past-gigs/venue?key=live-test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ night: '2026-09-03', venue: 'The Station Tap, Wokingham', venueId: 'v7' }),
    });
    assert.notEqual(res.status, 404, 'the venue route is not reachable by POST');
    const out = await res.json();
    assert.equal(res.status, 200, `expected it to save, got ${JSON.stringify(out)}`);

    const filed = listArchive(path.join(dir, 'archive'));
    assert.equal(filed.length, 1);
    assert.equal(filed[0].venue, 'The Station Tap, Wokingham');
    assert.equal(filed[0].venueId, 'v7');
  }, {
    // BEFORE the server starts, into the house room's own archive — which is
    // where the host key resolves, so this is the archive the route reads.
    seed: (dir) => {
      archiveResults(path.join(dir, 'archive'), { packId: 'eighties' },
        Date.parse('2026-09-03T21:00:00Z'));
      return dir;
    },
  });
});

test('a nameless venue is refused rather than blanking the night', async () => {
  const { withServer } = await import('./helpers/live-server.mjs');
  await withServer(async (base, dir) => {
    const res = await fetch(`${base}/api/past-gigs/venue?key=live-test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ night: '2026-09-03', venue: '  ' }),
    });
    assert.equal(res.status, 400);
    assert.equal(listArchive(path.join(dir, 'archive'))[0].venue, 'The Crown');
  }, {
    seed: (dir) => {
      archiveResults(path.join(dir, 'archive'), { packId: 'eighties', venue: 'The Crown' },
        Date.parse('2026-09-03T21:00:00Z'));
      return dir;
    },
  });
});

test('and something in the browser can actually reach it', async () => {
  /*
   * The publish route sat behind a perfect gate with no handle for as long as
   * the gallery existed, and the lesson written down then is the one this
   * asserts: **a test that the route works proves nothing about whether
   * anybody can reach it.**
   *
   * Comments stripped first, or the paragraph explaining why the control
   * exists keeps this green with the caller deleted — a check that gets
   * stronger the better a file is documented is the wrong way round.
   */
  const { readdirSync, readFileSync } = await import('node:fs');
  const { withoutComments } = await import('./console-source.js');
  const dir = new URL('../public/assets/', import.meta.url).pathname;
  const callers = readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => withoutComments(readFileSync(path.join(dir, f), 'utf8')).includes('/api/past-gigs/venue'));
  assert.ok(callers.length, 'nothing in the browser can say where a past night was');
});
