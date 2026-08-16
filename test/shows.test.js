/**
 * SHOWS — a whole evening built in advance, saved as references.
 *
 * The two properties worth defending with tests are not the CRUD, which is a
 * JSON file. They are:
 *
 *  - **it stores references and never copies**, or rule 11 breaks and a
 *    corrected question stops reaching a night somebody built last month;
 *  - **it is not a gate**, so a show cannot carry an entitlement its account
 *    has since lost. That one is a vulnerability rather than a bug, and it is
 *    the shape this file keeps recording: a check that was true once, cached
 *    into a file, and believed later.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  listShows, saveShow, deleteShow, readShow, normalise, showId, showProblems, MAX_SHOWS,
} from '../src/shows.js';

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shows-'));
  return { shows: path.join(dir, 'shows.json') };
}

const basic = (over = {}) => ({ name: 'Thursday at The Crown', kind: 'quiz', packId: 'eighties', ...over });

test('a show is saved, listed and read back', () => {
  const paths = scratch();
  assert.deepEqual(listShows(paths), []);
  const saved = saveShow(paths, basic({ venue: 'The Crown, Wokingham', look: 'halloween' }));
  assert.equal(saved.id, 'thursday-at-the-crown');
  assert.equal(saved.venue, 'The Crown, Wokingham');
  assert.equal(listShows(paths).length, 1);
  assert.equal(readShow(paths, saved.id).name, 'Thursday at The Crown');
});

test('SAVING THE SAME ID REPLACES RATHER THAN PILING UP', () => {
  const paths = scratch();
  saveShow(paths, basic(), 1);
  saveShow(paths, basic({ venue: 'The Red Lion' }), 2);
  const all = listShows(paths);
  assert.equal(all.length, 1);
  assert.equal(all[0].venue, 'The Red Lion');
});

test('IT STORES REFERENCES AND NEVER A QUESTION', () => {
  /*
   * The rule-11 test. A show holds pack ids and round indexes; if anything
   * ever starts copying the round itself in, a correction saved to the pack
   * would stop reaching nights built before it — silently, months later, in
   * front of a room.
   */
  const paths = scratch();
  const show = saveShow(paths, basic({
    order: [{ packId: 'eighties', round: 0 }, { packId: 'motown', round: 2 }],
    // Everything a round actually contains, offered and expected to be dropped.
    rounds: [{ questions: [{ prompt: 'Who sang this?', answer: 'Madonna' }] }],
  }));
  assert.deepEqual(show.order, [{ packId: 'eighties', round: 0 }, { packId: 'motown', round: 2 }]);
  assert.equal(show.rounds, undefined);
  const onDisk = fs.readFileSync(paths.shows, 'utf8');
  assert.ok(!onDisk.includes('Madonna'), 'a show must never hold an answer');
  assert.ok(!onDisk.includes('Who sang this?'), 'a show must never hold a question');
});

test('THE FIELDS ARE A WHITELIST — anything else is dropped', () => {
  /*
   * The same reasoning as the two-screens payload builders. This object is
   * written by a browser and read back into a launch, so a spread would opt
   * every future field in without anybody deciding to.
   */
  const show = normalise(basic({
    replace: true, hostKey: 'letmein', role: 'owner', tier: 'gold', __proto__: { evil: 1 },
  }));
  for (const key of ['replace', 'hostKey', 'role', 'tier', 'evil']) {
    assert.equal(show[key], undefined, `${key} should not survive`);
  }
  assert.deepEqual(Object.keys(show).sort(), [
    'id', 'kind', 'lobbyGame', 'lobbySound', 'look', 'name', 'online',
    'packId', 'prizes', 'shape', 'teamPlay', 'updated', 'venue',
  ]);
});

test('A SHOW CANNOT CARRY AN ENTITLEMENT — there is no allowed flag on it', () => {
  /*
   * Nothing here records that the save was permitted. The launch route
   * re-checks the tier, every pack in the order, and the lobby game — a show
   * built on Gold and launched after a downgrade is refused exactly as a fresh
   * launch would be. If a field ever appears here that says "this was fine
   * when it was saved", that is a gate running backwards.
   */
  const show = normalise(basic({ allowed: true, entitled: ['bingo'], features: ['online'] }));
  const keys = Object.keys(show).join(' ');
  for (const word of ['allow', 'entitl', 'feature', 'tier', 'plan']) {
    assert.ok(!keys.includes(word), `a show must not carry "${word}"`);
  }
});

test('a bingo show has no running order — a bingo pack has no rounds on disk', () => {
  const show = normalise(basic({ kind: 'bingo', packId: 'disco-funk', order: [{ packId: 'disco-funk', round: 0 }] }));
  assert.equal(show.order, undefined);
});

test('a quiz with one pack carries no order, so it launches the road it always did', () => {
  const show = normalise(basic());
  assert.equal(show.order, undefined);
  assert.equal(show.packId, 'eighties');
});

test('the pack id falls back to the first round of the order', () => {
  const show = normalise({ name: 'Mixed', kind: 'quiz', order: [{ packId: 'motown', round: 1 }] });
  assert.equal(show.packId, 'motown');
});

test('a show with nothing to play is refused, and so is one with no name', () => {
  assert.throws(() => normalise({ name: 'Empty', kind: 'quiz' }), /needs something to play/);
  assert.throws(() => normalise({ packId: 'eighties' }), /needs a name/);
  assert.throws(() => normalise({ name: '!!!', packId: 'eighties' }), /no letters or numbers/);
});

test('the settings survive the round trip, and the odd ones are clamped', () => {
  const show = normalise(basic({
    look: 'christmas', lobbyGame: 'rally', lobbySound: false, teamPlay: true, online: true,
    shape: { rows: 3, cols: 3 }, prizes: 99,
  }));
  assert.equal(show.look, 'christmas');
  assert.equal(show.lobbyGame, 'rally');
  assert.equal(show.lobbySound, false);
  assert.equal(show.teamPlay, true);
  assert.equal(show.online, true);
  assert.deepEqual(show.shape, { rows: 3, cols: 3 });
  assert.equal(show.prizes, 5, 'more prizes than there are places is clamped, not stored');
});

test('SOUND DEFAULTS ON wherever the field is absent', () => {
  // The same rule the lobby game itself follows: both halves default to on
  // wherever the field could be missing, so a show saved before this existed
  // does not arrive silent.
  assert.equal(normalise(basic()).lobbySound, true);
});

test('a broken pack reference is named on the card, before the gig', () => {
  const show = normalise(basic({ order: [{ packId: 'eighties', round: 0 }, { packId: 'gone', round: 0 }] }));
  const has = (kind, id) => id !== 'gone';
  assert.deepEqual(showProblems(show, has), ['There is no pack called gone any more.']);
  assert.deepEqual(showProblems(show, () => true), []);
});

test('a one-pack show checks the pack it names', () => {
  const show = normalise(basic());
  assert.deepEqual(showProblems(show, () => false), ['There is no pack called eighties any more.']);
});

test('THE CAP COUNTS NEW SHOWS ONLY — editing the last one is not refused', () => {
  const paths = scratch();
  for (let i = 0; i < MAX_SHOWS; i++) saveShow(paths, basic({ name: `Night ${i}` }));
  assert.throws(() => saveShow(paths, basic({ name: 'One too many' })), /as many as an account holds/);
  // Editing one that is already there still works.
  assert.doesNotThrow(() => saveShow(paths, basic({ name: 'Night 0', venue: 'Somewhere else' })));
  assert.equal(listShows(paths).length, MAX_SHOWS);
});

test('deleting one that is not there says so rather than failing quietly', () => {
  const paths = scratch();
  saveShow(paths, basic());
  assert.throws(() => deleteShow(paths, 'never-existed'), /no show by that name/);
  assert.equal(deleteShow(paths, 'thursday-at-the-crown'), true);
  assert.deepEqual(listShows(paths), []);
});

test('a shows file somebody has broken reads as an empty shelf, never a crash', () => {
  // A quizmaster ten minutes before a gig needs the console to load. An
  // unparseable file is a lost shelf, which is recoverable; a 500 on the
  // library route is the whole console.
  const paths = scratch();
  fs.writeFileSync(paths.shows, '{ this is not json');
  assert.deepEqual(listShows(paths), []);
});

test('the id has nothing in it that could be a path', () => {
  assert.equal(showId('../../etc/passwd'), 'etc-passwd');
  assert.equal(showId('The Crown / Thursday'), 'the-crown-thursday');
  assert.ok(!showId('a'.repeat(200)).includes('/'));
  assert.ok(showId('a'.repeat(200)).length <= 60);
});

test('the newest touched is first, so the shelf is in the order you use it', () => {
  const paths = scratch();
  saveShow(paths, basic({ name: 'Old one' }), 1000);
  saveShow(paths, basic({ name: 'New one' }), 2000);
  assert.deepEqual(listShows(paths).map((s) => s.name), ['New one', 'Old one']);
});

test('A SHOW CANNOT HOLD MORE ROUNDS THAN A NIGHT CAN PLAY', async () => {
  /*
   * A limit stated in two places disagrees with itself within a month. A show
   * allowed to hold thirteen rounds would save cleanly on a Monday and be
   * refused in a venue on a Thursday, which is the worst possible place to
   * find out — so the ceiling is imported from the thing that enforces it.
   */
  const { MAX_ROUNDS } = await import('../src/running-order.js');
  const order = Array.from({ length: MAX_ROUNDS + 5 }, (_, i) => ({ packId: 'eighties', round: i }));
  assert.equal(normalise(basic({ order })).order.length, MAX_ROUNDS);
});
