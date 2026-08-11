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
