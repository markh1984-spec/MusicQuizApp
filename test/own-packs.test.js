/**
 * A quizmaster's OWN packs, and the one rule that runs the wrong way.
 *
 * Every other gate in this app asks "has this account paid for that". This one
 * asks the opposite: the OWNER — who holds every feature, writes the
 * catalogue and runs the server — must not be able to read a subscriber's own
 * quizzes. It is their intellectual property, not stock in somebody else's
 * shop, and every other quizmaster will assume the worst about a competitor
 * who can read their questions.
 *
 * The enforcement is deliberately structural rather than a check somebody has
 * to remember to write: **no route takes a room parameter.** Every one works
 * the room out from who you are, a room's own packs live under that room's own
 * folder, and there is therefore no pack id and no query string that reaches
 * another room's folder. These tests pin that down, because it is the sort of
 * property a refactor breaks silently.
 *
 * What this does NOT claim, and it is worth saying in the test file as well as
 * to a subscriber: the owner runs the server, the disk and the backups, and
 * the server has to be able to read a quiz to put it on a projector. This is
 * access control and an audit trail. The honest pitch is "the app will not let
 * me in unless you let me, and here is the log".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Rooms, HOUSE } from '../src/rooms.js';
import { config as appConfig } from '../src/config.js';
import {
  listOwn, readPack, saveOwn, deleteOwn, isOwnPack, countOwn, packDir, backupPath, MAX_OWN,
} from '../src/own-packs.js';
import { changesTheLibrary, OWNER_ONLY } from '../src/gates.js';
import { FEATURES, FEATURE_TIER, featuresFor, can } from '../public/assets/plans.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'own-packs-'));
  const quizDir = path.join(dir, 'catalogue', 'quizzes');
  const bingoDir = path.join(dir, 'catalogue', 'bingo');
  fs.mkdirSync(quizDir, { recursive: true });
  fs.mkdirSync(bingoDir, { recursive: true });

  const config = { ...appConfig, dataDir: dir, quizDir, bingoDir, advertDir: path.join(dir, 'adverts') };
  const rooms = new Rooms({
    config,
    paths: { state: path.join(dir, 'state.json'), photos: path.join(dir, 'photos') },
    onPush: () => {},
  });
  return { dir, config, rooms, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** A minimal quiz that passes validation, so the tests are about the filing. */
function aQuiz(id, title = 'A quiz of my own') {
  return {
    id,
    title,
    questionSeconds: 20,
    rounds: [{
      id: 'r1',
      type: 'text',
      title: 'Round One',
      questions: [{
        id: 'r1q1',
        prompt: 'Who sang Wuthering Heights?',
        options: ['Kate Bush', 'Toyah', 'Siouxsie Sioux', 'Annie Lennox'],
        correctIndex: 0,
      }],
    }],
  };
}

// ============================================================ THE MAIN RULE

/*
 * The one that matters, said as plainly as it can be.
 *
 * Rob writes a quiz. The owner — every feature, every tier, the server in
 * their own hands as far as the app is concerned — asks for it by name, which
 * is the only thing they would have to go on. The house room is what an owner
 * resolves to, and the house room's folder does not contain it.
 */
test("THE OWNER CANNOT READ A QUIZMASTER'S OWN PACK", () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    const house = rooms.get(HOUSE);

    saveOwn('quiz', 'robs-secret', aQuiz('robs-secret'), { config, paths: rob.paths });
    assert.equal(isOwnPack('quiz', 'robs-secret', rob.paths), true, 'Rob cannot see his own pack');

    // The owner asks for it by the only name there is.
    assert.equal(isOwnPack('quiz', 'robs-secret', house.paths), false,
      "the owner's room can see Rob's pack");
    assert.throws(
      () => readPack('quiz', 'robs-secret', { config, paths: house.paths }),
      'the owner read a pack that is not theirs',
    );

    // And it is not in the owner's listing either — "the console does not draw
    // it" would not be enough, but neither would a listing that quietly did.
    assert.equal(listOwn(house.paths).quizzes.length, 0);
    assert.equal(listOwn(rob.paths).quizzes.length, 1);
  } finally {
    cleanup();
  }
});

test('and neither can another quizmaster', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    const james = rooms.get('acct-james');
    saveOwn('quiz', 'robs-secret', aQuiz('robs-secret'), { config, paths: rob.paths });

    assert.equal(isOwnPack('quiz', 'robs-secret', james.paths), false);
    assert.throws(() => readPack('quiz', 'robs-secret', { config, paths: james.paths }));
  } finally {
    cleanup();
  }
});

/*
 * The room folders are the enforcement, so they have to be genuinely separate
 * paths rather than the same one reached two ways. This is the test that fails
 * if somebody "tidies" pathsFor into a shared packs directory.
 */
test('every room keeps its own packs in its own folder', () => {
  const { rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    const james = rooms.get('acct-james');
    const house = rooms.get(HOUSE);
    const all = [rob.paths.ownQuizzes, james.paths.ownQuizzes, house.paths.ownQuizzes];
    assert.equal(new Set(all).size, 3, 'two rooms share a pack folder');
    for (const dir of all) assert.ok(dir, 'a room has nowhere to keep its own packs');
  } finally {
    cleanup();
  }
});

// ================================================ the catalogue stays the owner's

/*
 * Their own library is ADDITIONAL, never a way into the shared one. A
 * quizmaster reading a catalogue pack is the arrangement working; a quizmaster
 * WRITING one is the thing gates.js exists to stop, and adding a second
 * library must not have opened a side door into it.
 */
test('a quizmaster can still read the catalogue', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    fs.writeFileSync(path.join(config.quizDir, 'eighties.json'),
      JSON.stringify(aQuiz('eighties', 'The Eighties')), 'utf8');

    const { pack, mine } = readPack('quiz', 'eighties', { config, paths: rob.paths });
    assert.equal(pack.title, 'The Eighties');
    assert.equal(mine, false, 'a catalogue pack came back marked as theirs');
  } finally {
    cleanup();
  }
});

test('saving one of their own can never write the catalogue', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    saveOwn('quiz', 'robs-own', aQuiz('robs-own'), { config, paths: rob.paths });
    assert.equal(fs.existsSync(path.join(config.quizDir, 'robs-own.json')), false,
      'a quizmaster wrote into the shared catalogue');
  } finally {
    cleanup();
  }
});

test('deleting one of their own can never reach a catalogue pack', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    fs.writeFileSync(path.join(config.quizDir, 'eighties.json'),
      JSON.stringify(aQuiz('eighties')), 'utf8');

    assert.throws(() => deleteOwn('quiz', 'eighties', { config, paths: rob.paths }),
      /not one of your own/);
    assert.equal(fs.existsSync(path.join(config.quizDir, 'eighties.json')), true,
      'a catalogue pack was deleted through the own-packs route');
  } finally {
    cleanup();
  }
});

/*
 * A pack of theirs that took a catalogue id would SHADOW it, because
 * resolution looks in their folder first — so Launch would quietly play a
 * different quiz from the one everybody else sees under that name. Refused
 * with words, because renaming is one field and a silently shadowed pack is a
 * mystery nobody would think to look for.
 */
test('their own pack cannot take a name the catalogue already uses', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    fs.writeFileSync(path.join(config.quizDir, 'eighties.json'),
      JSON.stringify(aQuiz('eighties')), 'utf8');

    assert.throws(
      () => saveOwn('quiz', 'eighties', aQuiz('eighties'), { config, paths: rob.paths }),
      /already a pack called/,
    );
  } finally {
    cleanup();
  }
});

test('but replacing one of their own is an ordinary save', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    const ctx = { config, paths: rob.paths };
    saveOwn('quiz', 'mine', aQuiz('mine', 'First go'), ctx);
    saveOwn('quiz', 'mine', aQuiz('mine', 'Second go'), ctx);
    assert.equal(readPack('quiz', 'mine', ctx).pack.title, 'Second go');
    assert.equal(countOwn(rob.paths), 1, 'a replace made a second copy');
  } finally {
    cleanup();
  }
});

/*
 * Own first, catalogue second — which is what lets every read route carry on
 * taking a bare pack id rather than growing a "which library" parameter that
 * somebody would eventually pass from a request body.
 */
test('a pack id resolves to their own library first', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    saveOwn('quiz', 'mine', aQuiz('mine'), { config, paths: rob.paths });
    assert.deepEqual(packDir('quiz', 'mine', { config, paths: rob.paths }),
      { dir: rob.paths.ownQuizzes, mine: true });
    assert.deepEqual(packDir('quiz', 'not-here', { config, paths: rob.paths }),
      { dir: config.quizDir, mine: false });
  } finally {
    cleanup();
  }
});

test('a bad pack id cannot climb out of the folder', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    // safeQuizFile strips the separators rather than throwing on some of these,
    // so what matters is that nothing resolves to a file outside the folder.
    for (const nasty of ['../../etc/passwd', '', '.', '../eighties']) {
      assert.equal(isOwnPack('quiz', nasty, rob.paths), false, `"${nasty}" matched something`);
    }
  } finally {
    cleanup();
  }
});

// ======================================================= playing one of their own

test('a launch can play a pack they wrote', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    saveOwn('quiz', 'robs-own', aQuiz('robs-own', 'Rob wrote this'), { config, paths: rob.paths });

    rob.session.launch('quiz', 'robs-own');
    assert.equal(rob.session.pack.title, 'Rob wrote this');
  } finally {
    cleanup();
  }
});

/*
 * And the owner's room cannot, by the same id, because the launch resolves
 * through the same `readPack`. There is no room parameter to point elsewhere.
 */
test("the owner's room cannot launch somebody else's own pack", () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    const house = rooms.get(HOUSE);
    saveOwn('quiz', 'robs-own', aQuiz('robs-own'), { config, paths: rob.paths });

    assert.throws(() => house.session.launch('quiz', 'robs-own'));
  } finally {
    cleanup();
  }
});

// ================================================================ the cap

test('there is a ceiling, and it says what to do about it', () => {
  const { config, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    const ctx = { config, paths: rob.paths };
    for (let i = 0; i < MAX_OWN; i++) saveOwn('quiz', `q${i}`, aQuiz(`q${i}`), ctx);
    assert.throws(() => saveOwn('quiz', 'one-too-many', aQuiz('one-too-many'), ctx),
      /Delete one first/);
    // Replacing one they already have is not a new pack, so it still works.
    saveOwn('quiz', 'q0', aQuiz('q0', 'Edited'), ctx);
    assert.equal(readPack('quiz', 'q0', ctx).pack.title, 'Edited');
  } finally {
    cleanup();
  }
});

// ============================================================ the backup

/*
 * One folder per room, so "these are Rob's, and only Rob's" is something you
 * can see in the repository rather than something you have to trust the code
 * about.
 */
test('the backup keeps one folder per room', () => {
  assert.equal(backupPath('acct-rob', 'quiz', 'mine'), 'packs/acct-rob/quiz/mine.json');
  assert.equal(backupPath('acct-james', 'bingo', 'disco'), 'packs/acct-james/bingo/disco.json');
  assert.notEqual(backupPath('acct-rob', 'quiz', 'x'), backupPath('acct-james', 'quiz', 'x'));
});

/*
 * And it is NOT the owner's private repository.
 *
 * That file holds the owner's accounts, invoices and customer records. Mixing
 * somebody else's work in with the owner's business records is the wrong
 * boundary however careful everybody is — and `PACKS_REPO` deliberately has no
 * fallback to it, because falling back would put a subscriber's quiz in there
 * quietly on the day a variable was missing.
 */
test('a subscriber\'s packs never fall back to the owner\'s private repo', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'github.js'), 'utf8');
  const match = source.match(/export function packsRepoConfigured\(\)[\s\S]*?\n}/);
  assert.ok(match, 'packsRepoConfigured has gone');
  assert.ok(!/PHOTO_REPO/.test(match[0]),
    'the packs repository falls back to the owner\'s private one');
});

// ====================================================== the routes and the gates

/*
 * `/api/mine/*` must NOT be caught by `changesTheLibrary()`.
 *
 * That rule is a path test — it cannot look inside a request and work out
 * which of two libraries a pack id belongs to — so the two libraries need two
 * prefixes. If `/api/mine/quiz` ever started matching, a quizmaster would be
 * asked for the CATALOGUE feature to save their own work and would simply get
 * a 403 on their own quiz.
 */
test('writing your own packs is not writing the catalogue', () => {
  for (const route of ['/api/mine/quiz', '/api/mine/bingo', '/api/mine/quiz/mine', '/api/mine/import']) {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      assert.equal(changesTheLibrary(route, method), false,
        `${method} ${route} is gated as the catalogue`);
    }
  }
});

test('and it is not an owner-only route either', () => {
  assert.equal(OWNER_ONLY.some((prefix) => '/api/mine/quiz'.startsWith(prefix)), false);
});

/*
 * Every own-pack route has to ask for OWN_PACKS by name.
 *
 * The broad `FEATURES.QUIZ` gate above them would let any quizmaster through,
 * which is nearly right and not the same thing — and the day the feature moves
 * up a tier, "nearly right" is a subscriber writing packs they are not on the
 * plan for. Read out of the file for the same reason gates.test.js does: this
 * is the check that fails when somebody adds a fifth route.
 */
test('every own-pack route asks for the own-packs feature', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const lines = source.split('\n');
  const found = [];
  lines.forEach((line, i) => {
    // A route GUARD, which is the line that also names the method — as opposed
    // to the support log's own `/api/mine/` test, or a `route.slice` below one.
    if (!/route\s*(===|\.startsWith\()\s*'\/api\/mine\//.test(line)) return;
    if (!/req\.method/.test(line)) return;
    const near = lines.slice(i, i + 4).join('\n');
    found.push(line.trim());
    assert.match(near, /FEATURES\.OWN_PACKS/,
      `an /api/mine route is not gated on OWN_PACKS:\n${line.trim()}`);
  });
  assert.ok(found.length >= 4, `expected the own-pack routes, found ${found.length}`);
});

/*
 * Their own packs are never filtered by the tier's pack list.
 *
 * The tier lever is the owner's CATALOGUE — a starter set that runs out in
 * month four while somebody is doing well. Applying it to work they wrote
 * themselves would mean their own quiz disappearing off their own console
 * because of what they pay the owner, which is not an upsell.
 */
test('a tier can never take away a pack they wrote', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const match = source.match(/function onlyTheirPacks[\s\S]*?\n}/);
  assert.ok(match, 'onlyTheirPacks has gone');
  assert.match(match[0], /p\.mine/,
    'the tier filter no longer spares packs the quizmaster wrote');
});

// =============================================================== the ladder

test('writing your own packs costs the owner nothing per use, so it is Bronze', () => {
  assert.equal(FEATURE_TIER[FEATURES.OWN_PACKS], 'bronze');
});

test('an owner holds no own-packs feature — they write the catalogue instead', () => {
  assert.equal(can({ role: 'owner' }, FEATURES.OWN_PACKS), false);
  assert.equal(featuresFor({ role: 'owner' }).includes(FEATURES.OWN_PACKS), false);
});

test('a paying quizmaster on the bottom rung has it', () => {
  const rob = { role: 'quizmaster', tier: 'bronze', status: 'active' };
  assert.equal(can(rob, FEATURES.OWN_PACKS), true);
});

/*
 * The owner's overview says which room is running what — and for a pack THEY
 * wrote, it must say nothing but "one of their own".
 *
 * The id goes as well as the title, and that is not fussiness: a pack id is
 * the title slugged, so leaving it would print "robs-secret-quiz" on the
 * owner's own page directly under a feature that promises they cannot read it.
 */
test('the owner overview names nothing about a pack somebody wrote', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const route = source.slice(source.indexOf("route === '/api/owner/overview'"));
  const block = route.slice(0, route.indexOf('\n  }\n'));
  assert.match(block, /isOwnPack/, 'the overview no longer asks whether a pack is theirs');
  assert.match(block, /pack: 'One of their own'/, 'the title is no longer masked');
  assert.match(block, /packId: ''/, "the pack id is no longer masked — an id is the title slugged");
});

/*
 * The catalogue figures on the owner page are the CATALOGUE's. Reading the own
 * libraries into them would put a count of somebody's private work on the
 * owner's page, and a play count is a fact about a pack the owner cannot see.
 */
test("the owner's catalogue figures never read a quizmaster's own library", () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const fn = source.match(/function cataloguePerformance\(\)[\s\S]*?\n}/);
  assert.ok(fn, 'cataloguePerformance has gone');
  assert.ok(!/listOwn/.test(fn[0]), "the owner's catalogue figures include somebody's own packs");
  assert.match(fn[0], /fullLibrary\(config, HOUSE\)/,
    'the catalogue figures are no longer read from the shared library alone');
});
