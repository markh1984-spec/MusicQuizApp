/**
 * The three things that were still SHARED between quizmasters.
 *
 * Rooms already split the running game, the state file, the photo wall and the
 * join code. These three were left behind, and each is a different kind of
 * problem the day a second login exists:
 *
 *   - **the invoice book** holds a quizmaster's own customers, their addresses
 *     and their bank details. Shared, Rob would have seen Mark's.
 *   - **the archive** is a record of somebody's own nights.
 *   - **the advert slides** belong to whoever sells that venue — and this is
 *     the loud one, because a second quizmaster tidying up what looked like
 *     their own venue list would have deleted The Crown's set off Mark's
 *     projector mid-season.
 *
 * Nobody has a second login yet, so nothing was exposed. These tests are what
 * make handing one out safe.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Rooms, HOUSE } from '../src/rooms.js';
import { config as appConfig } from '../src/config.js';
import { saveAdvertPack, listAdvertPacks } from '../src/adverts.js';
import { archiveResults, listArchive } from '../src/library.js';

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-'));
  const config = { ...appConfig, dataDir: dir, advertDir: path.join(dir, 'adverts') };
  const paths = {
    state: path.join(dir, 'state.json'),
    photos: path.join(dir, 'photos'),
    invoices: path.join(dir, 'invoicing.json'),
  };
  const rooms = new Rooms({ config, paths, onPush: () => {} });
  return { dir, config, rooms, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('two quizmasters keep two separate invoice books', () => {
  const { rooms, cleanup } = sandbox();
  try {
    const mark = rooms.get(HOUSE);
    const rob = rooms.get('acct-rob');
    assert.notEqual(mark.invoices, rob.invoices);

    mark.invoices.saveCustomer({ name: 'The Crown', email: 'crown@example.com' });
    assert.equal(mark.invoices.customers.length, 1);
    assert.equal(rob.invoices.customers.length, 0, "Rob can see Mark's customers");
  } finally {
    cleanup();
  }
});

/*
 * Invoice numbers are sequential and never reused — WITHIN one book. Two
 * quizmasters each starting at 1 is correct and expected: they are separate
 * businesses issuing their own invoices, not two people sharing a pad.
 */
test('each book numbers its own invoices, and they do not interleave', () => {
  const { rooms, cleanup } = sandbox();
  try {
    const mark = rooms.get(HOUSE);
    const rob = rooms.get('acct-rob');
    const draft = (who) => ({
      toName: who,
      lines: [{ description: 'Quiz night', pence: 15000 }],
    });

    const m1 = mark.invoices.issue(draft('The Crown'));
    const r1 = rob.invoices.issue(draft('The Bell'));
    const m2 = mark.invoices.issue(draft('The Crown'));

    assert.equal(mark.invoices.invoices.length, 2);
    assert.equal(rob.invoices.invoices.length, 1, "Rob's book has one of Mark's in it");
    // Rob's first is his own first, not third in a shared run.
    assert.notEqual(m1.number, r1.number === m2.number ? r1.number : null);
    assert.ok(m1.number && r1.number && m2.number);
  } finally {
    cleanup();
  }
});

test('two quizmasters keep separate venue advert sets', () => {
  const { rooms, cleanup } = sandbox();
  try {
    const mark = rooms.get(HOUSE);
    const rob = rooms.get('acct-rob');
    assert.notEqual(mark.paths.adverts, rob.paths.adverts);

    saveAdvertPack(mark.paths.adverts, 'the-crown', {
      id: 'the-crown', title: 'The Crown', slides: [{ id: 's1', heading: 'Pizza night' }],
    });

    assert.equal(listAdvertPacks(mark.paths.adverts).length, 1);
    assert.equal(listAdvertPacks(rob.paths.adverts).length, 0,
      "Rob is looking at Mark's venue slides");
  } finally {
    cleanup();
  }
});

test('a night is archived to the room that ran it', () => {
  const { rooms, cleanup } = sandbox();
  try {
    const mark = rooms.get(HOUSE);
    const rob = rooms.get('acct-rob');
    assert.notEqual(mark.paths.archive, rob.paths.archive);

    archiveResults(mark.paths.archive, { packId: 'eighties', players: [] }, 1000);

    assert.equal(listArchive(mark.paths.archive).length, 1);
    assert.equal(listArchive(rob.paths.archive).length, 0, "Rob can see Mark's past nights");
  } finally {
    cleanup();
  }
});

/*
 * The house room keeps the original locations, and that is not tidiness.
 *
 * Mark has gigs in the diary and deploys between rounds. If the default room's
 * invoice book, archive or advert folder moved, the first restart after this
 * shipped would come back with an empty invoice book and no venue slides.
 */
test('the house room keeps every original file location', () => {
  const { dir, config, rooms, cleanup } = sandbox();
  try {
    const house = rooms.get(HOUSE);
    assert.equal(house.paths.invoices, path.join(dir, 'invoicing.json'));
    assert.equal(house.paths.archive, path.join(dir, 'archive'));
    assert.equal(house.paths.adverts, config.advertDir);
  } finally {
    cleanup();
  }
});

test('another room gets a folder of its own, under its account id', () => {
  const { dir, rooms, cleanup } = sandbox();
  try {
    const rob = rooms.get('acct-rob');
    const mine = path.join(dir, 'rooms', 'acct-rob');
    assert.equal(rob.paths.invoices, path.join(mine, 'invoicing.json'));
    assert.equal(rob.paths.archive, path.join(mine, 'archive'));
    assert.equal(rob.paths.adverts, path.join(mine, 'adverts'));
  } finally {
    cleanup();
  }
});

// ================================ the control view follows WHO YOU ARE, not a code

/**
 * **`role=host` resolves the room from identity; only a phone follows a code.**
 *
 * This is the property the whole two-quizmasters guarantee rests on, and it is
 * the one an attacker actually reaches for: a join code is printed on the
 * projector and read out on the mic, so anybody in the room has one. If the
 * control view followed it, the code on the wall would be the key to the
 * answer key — every question, every right answer, and who picked what.
 *
 * Confirmed live by signing in as a second quizmaster and asking for
 * `/api/state?role=host&g=<somebody else's code>`: it came back with his OWN
 * game, a different question entirely. This pins the branch that makes that
 * true, because it is one line and it reads as a tidy-up waiting to happen.
 */
test('THE HOST VIEW IGNORES A JOIN CODE — the projector and phones follow it, the control view never does', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

  for (const route of ["route === '/api/state'", "route === '/api/stream'"]) {
    const at = server.indexOf(route);
    assert.ok(at > 0, `${route} has moved`);
    const body = server.slice(at, at + 900);
    assert.match(body, /role === 'host' \? roomForHost\(req, url\) : roomForPhone\(req, url\)/,
      `${route} no longer works the host's room out from who they are — a join code would reach somebody else's answer key`);
    // And the control view is the only one that needs an account at all.
    assert.match(body, /role === 'host' && !allowed\(/,
      `${route} no longer checks that a host view belongs to somebody entitled to it`);
  }
});

/*
 * A VENUE'S SLIDES ARE THE QUIZMASTER'S, INCLUDING IN THE BACKUP.
 *
 * Advert sets were moved to a folder per room when rooms were built, and this
 * file already records why: one folder meant a second quizmaster tidying what
 * looked like their own venue list would delete The Crown's set off Mark's
 * projector. The disk was fixed and the BACKUP was not — every room wrote to
 * `adverts/<id>.json` in the MAIN repository with no room anywhere in the path.
 * So Rob saving a set whose id matched one of Mark's overwrote Mark's file,
 * deleting his deleted Mark's, and Rob's venue's offers and ticket-sales QR
 * went into a PUBLIC repo where git history is forever.
 *
 * Found by an audit rather than by anybody hitting it, because there is no
 * second quizmaster yet — which is exactly how long it would have survived.
 */
test('an advert backup carries the room, and only the house keeps the flat path', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const at = server.indexOf('function advertBackup(');
  assert.ok(at > 0, 'the advert backup path has moved');
  const body = server.slice(at, at + 700);

  assert.match(body, /room\.id === HOUSE/, 'the advert backup no longer tells the house apart from anybody else');
  assert.match(body, /adverts\/\$\{room\.id\}\//, 'a room is not in the advert backup path — two quizmasters would share one file');
  // And not the public repository, which is where the house's deliberately go.
  assert.match(body, /'packs'/, "a quizmaster's venue slides are no longer going to the packs repository");

  // The save and the delete both have to use it, or one half still crosses.
  for (const fn of ['async function backUpAdverts(', 'async function deleteAdvertBackup(']) {
    const fnAt = server.indexOf(fn);
    assert.ok(fnAt > 0, `${fn} has moved`);
    assert.match(server.slice(fnAt, fnAt + 500), /advertBackup\(room, id\)/, `${fn} no longer asks where this room's adverts go`);
  }
});

/*
 * A JOIN CODE MUST NOT CHANGE UNDER A PRINTED QR.
 *
 * The codes live in `data/`, which on a host with no permanent disk is empty
 * again after every deploy — so an additional quizmaster's four letters were
 * silently reissued on every push. It could sit there unnoticed precisely
 * because the house room has no code at all: Mark's own printed card was
 * always safe, and the only person it would have broken is the second login.
 */
test('join codes are kept, and restored before anybody scans anything', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /onCodes:[\s\S]{0,200}backUpCodes/, 'nothing backs the join codes up any more');
  assert.match(server, /rooms\.restoreCodes\(/, 'the join codes are never read back');

  // At BOOT rather than lazily: a phone scanning a printed QR is often the
  // first thing to touch a room after a restart, and by then it is too late.
  const boot = server.indexOf('async function restoreFromBackup(');
  assert.ok(boot > 0);
  assert.ok(server.indexOf('rooms.restoreCodes(', boot) > 0 && server.indexOf('rooms.restoreCodes(', boot) < boot + 4000,
    'the join codes are no longer restored at boot');
});
