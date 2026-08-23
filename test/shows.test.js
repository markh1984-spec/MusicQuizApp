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
  listShows, saveShow, deleteShow, readShow, normalise, showId, showProblems, itemsOf,
  MAX_SHOWS, MAX_ITEMS,
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
    // `breaks` joined on 23 August 2026 — what happens in each gap of the
    // night. It is on this list rather than spread in, and cleaned by the same
    // `cleanPlan()` the launch uses, so a saved plan and an accepted plan
    // cannot come apart.
    'breaks', 'id', 'items', 'kind', 'lobbyGame', 'lobbySound', 'look', 'name', 'online',
    // `teamMode` joined on 23 August 2026 — how a team night's teams are made,
    // `assigned` or `random`. Cleaned by the same rule `session.launch()` uses.
    'packId', 'prizes', 'shape', 'teamMode', 'teamPlay', 'updated', 'venue',
  ]);
  // And the items are a whitelist of their own, or the same hole reopens one
  // level down.
  assert.deepEqual(Object.keys(show.items[0]).sort(), ['kind', 'packId']);
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

/* ---- A SHOW IS AN EVENING, NOT ONE GAME
 *
 * It held one game for exactly one commit, and the host killed it in a
 * sentence: *"defeats the point — you need to be able to save a show with all
 * of the rounds, venue info, and drop it onto the launch. Say you want to swap
 * out the music bingo after, you need to be able to do that independent of
 * removing the venue or other rounds."*
 *
 * Both halves of that are tested here: the evening HOLDS both games, and
 * swapping one of them touches nothing else.
 */

test('A SHOW HOLDS THE QUIZ AND THE BINGO AFTER IT', () => {
  const show = normalise(basic({
    packId: undefined,
    items: [
      { kind: 'quiz', packId: 'eighties', order: [{ packId: 'eighties', round: 0 }, { packId: 'eighties', round: 1 }] },
      { kind: 'bingo', packId: 'disco-funk' },
    ],
    venue: 'The Crown, Wokingham',
  }));
  assert.equal(show.items.length, 2);
  assert.equal(show.items[0].kind, 'quiz');
  assert.equal(show.items[1].kind, 'bingo');
  assert.equal(show.items[1].packId, 'disco-funk');
  // The bingo half carries no running order — a bingo pack has no rounds on
  // disk, which is a fact about the pack rather than a limit on the evening.
  assert.equal(show.items[1].order, undefined);
  assert.equal(show.venue, 'The Crown, Wokingham');
});

test('SWAPPING THE BINGO LEAVES THE VENUE AND THE QUIZ ROUNDS ALONE', () => {
  /*
   * The host's own requirement, stated as the reason the one-game shape was
   * wrong. The venue, the prizes and the look live on the SHOW, so an item can
   * be replaced without any of them being in the same object.
   */
  const paths = scratch();
  const before = saveShow(paths, basic({
    packId: undefined,
    venue: 'The Crown, Wokingham',
    look: 'halloween',
    prizes: 3,
    items: [
      { kind: 'quiz', packId: 'eighties', order: [{ packId: 'eighties', round: 0 }] },
      { kind: 'bingo', packId: 'disco-funk' },
    ],
  }));

  const after = saveShow(paths, {
    ...before,
    items: [before.items[0], { kind: 'bingo', packId: 'motown-bingo' }],
  });

  assert.equal(after.items[1].packId, 'motown-bingo');
  assert.deepEqual(after.items[0], before.items[0], 'the quiz half must be untouched');
  assert.equal(after.venue, 'The Crown, Wokingham');
  assert.equal(after.look, 'halloween');
  assert.equal(after.prizes, 3);
  assert.equal(listShows(paths).length, 1, 'a swap edits the show rather than adding one');
});

test('THE FIRST ITEM IS DERIVED AT THE TOP LEVEL, so it cannot drift', () => {
  const show = normalise(basic({
    packId: undefined,
    items: [
      { kind: 'bingo', packId: 'disco-funk' },
      { kind: 'quiz', packId: 'eighties' },
    ],
  }));
  assert.equal(show.kind, 'bingo');
  assert.equal(show.packId, 'disco-funk');
});

test('A SHOW SAVED IN THE ONE-GAME SHAPE STILL READS, as a list of one', () => {
  // No migration step and nothing to run — a record written before the evening
  // existed simply arrives as an evening with one thing in it.
  const old = { name: 'Old one', kind: 'bingo', packId: 'disco-funk' };
  const show = normalise(old);
  assert.equal(show.items.length, 1);
  assert.deepEqual(show.items[0], { kind: 'bingo', packId: 'disco-funk' });
  // And `itemsOf` reads a raw old record without normalising it first, because
  // the console and the launch both ask this of whatever is on disk.
  assert.deepEqual(itemsOf(old), [{ kind: 'bingo', packId: 'disco-funk' }]);
  assert.deepEqual(itemsOf({}), []);
});

test('A BROKEN PACK IN THE SECOND HALF BREAKS THE SHOW', () => {
  // The whole point of building in advance: a deleted bingo pack must be found
  // on the card, not at half ten with the quiz already finished.
  const show = normalise(basic({
    packId: undefined,
    items: [{ kind: 'quiz', packId: 'eighties' }, { kind: 'bingo', packId: 'gone' }],
  }));
  assert.deepEqual(showProblems(show, (kind, id) => id !== 'gone'),
    ['There is no pack called gone any more.']);
});

test('an evening is capped, and the cap is a guard rather than a rule about nights', () => {
  const items = Array.from({ length: MAX_ITEMS + 4 }, () => ({ kind: 'quiz', packId: 'eighties' }));
  assert.equal(normalise(basic({ packId: undefined, items })).items.length, MAX_ITEMS);
});

test('an items list with nothing playable in it is refused, not silently emptied', () => {
  assert.throws(
    () => normalise(basic({ packId: undefined, items: [{ kind: 'quiz' }, { kind: 'bingo' }] })),
    /needs something to play/,
  );
});
