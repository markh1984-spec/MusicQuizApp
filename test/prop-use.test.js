/**
 * WHICH PROPS GET USED — and the reason both halves are counted.
 *
 * The tray is weighted towards what people reach for, which is a FEEDBACK LOOP
 * on any count of uses alone: shown less, used less, shown less again. Six
 * weeks of that and the table says "delete these thirty" when what it means is
 * "these thirty were never on screen" — and deleting artwork on that is an
 * irreversible version of this repo's most expensive recurring fault.
 *
 * So the check that matters here is that a RATE is immune to it: two props
 * people like equally must read the same however differently often they were
 * offered.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PropUse, ENOUGH_TO_JUDGE } from '../src/prop-use.js';

const withTally = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'props-'));
  try { return fn(new PropUse(path.join(dir, 'prop-use.json')), dir); } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('a photograph counts what was shown and what was stuck on', () => {
  withTally((tally) => {
    tally.record({ shown: ['dog-ears', 'clown-nose', 'moustache'], used: ['clown-nose'] });
    const rows = Object.fromEntries(tally.table(['dog-ears', 'clown-nose', 'moustache']).map((r) => [r.id, r]));
    assert.equal(rows['clown-nose'].shown, 1);
    assert.equal(rows['clown-nose'].used, 1);
    assert.equal(rows['dog-ears'].shown, 1);
    assert.equal(rows['dog-ears'].used, 0);
  });
});

test('THE RATE IS IMMUNE TO HOW OFTEN A PROP WAS OFFERED', () => {
  withTally((tally) => {
    // Two props people like exactly as much: one in half the trays, one in
    // every tray. A count of uses would rank them 1:4. The rate must not.
    for (let i = 0; i < 200; i += 1) {
      const shown = i % 4 === 0 ? ['rare', 'common'] : ['common'];
      const used = [];
      if (shown.includes('rare') && i % 8 === 0) used.push('rare');
      if (i % 2 === 0) used.push('common');
      tally.record({ shown, used });
    }
    const rows = Object.fromEntries(tally.table(['rare', 'common']).map((r) => [r.id, r]));
    // The raw counts are wildly different — which is the whole trap.
    assert.ok(rows.common.used > rows.rare.used * 3, 'the fixture does not reproduce the imbalance');
    // And both rates are honest: half of the trays each was in.
    assert.ok(Math.abs(rows.rare.rate - 0.5) < 0.01, `rare read ${rows.rare.rate}`);
    assert.ok(Math.abs(rows.common.rate - 0.5) < 0.01, `common read ${rows.common.rate}`);
  });
});

test('THREE OF ONE PROP ON ONE FACE IS ONE VOTE', () => {
  withTally((tally) => {
    // Counting placements lets one person with a sense of humour outvote a
    // room. The question is "did anybody reach for this", per photograph.
    tally.record({ shown: ['eyes'], used: ['eyes', 'eyes', 'eyes'] });
    const [row] = tally.table(['eyes']);
    assert.equal(row.used, 1);
    assert.equal(row.shown, 1);
  });
});

test('a use implies a show, so a rate can never exceed 100%', () => {
  withTally((tally) => {
    // Reached for out of the recently-used row while not in the rotated tray.
    tally.record({ shown: ['other'], used: ['hat'] });
    const rows = Object.fromEntries(tally.table(['hat', 'other']).map((r) => [r.id, r]));
    assert.equal(rows.hat.shown, 1, 'a use did not imply a show');
    assert.equal(rows.hat.used, 1);
  });
});

test('BELOW THE THRESHOLD THE RATE IS null, NEVER 0', () => {
  withTally((tally) => {
    // "Not enough yet" and "offered plenty and nobody wanted it" are different
    // facts, and a table rendering both as 0% gets a good drawing deleted.
    tally.record({ shown: ['new-one'], used: [] });
    const [row] = tally.table(['new-one']);
    assert.equal(row.rate, null);
    assert.equal(row.enough, false);

    for (let i = 0; i < ENOUGH_TO_JUDGE; i += 1) tally.record({ shown: ['new-one'], used: [] });
    const [after] = tally.table(['new-one']);
    assert.equal(after.rate, 0, 'past the threshold it is a real zero');
    assert.equal(after.enough, true);
  });
});

test('a prop nobody has EVER been shown still appears in the table', () => {
  withTally((tally) => {
    // The most interesting row there is, and it would otherwise be the one
    // row absent — there is no entry in the tally to list.
    tally.record({ shown: ['seen'], used: ['seen'] });
    const ids = tally.table(['seen', 'never-once']).map((r) => r.id);
    assert.ok(ids.includes('never-once'));
  });
});

test('the unjudgeable sort to the BOTTOM, not the top of a delete-these list', () => {
  withTally((tally) => {
    for (let i = 0; i < ENOUGH_TO_JUDGE * 2; i += 1) {
      tally.record({ shown: ['loved', 'ignored'], used: i % 2 ? ['loved'] : [] });
    }
    tally.record({ shown: ['brand-new'], used: [] });
    const order = tally.table(['loved', 'ignored', 'brand-new']).map((r) => r.id);
    assert.equal(order[0], 'ignored', 'the worst judged prop is not first');
    assert.equal(order[order.length - 1], 'brand-new', 'a new prop leads a delete list');
  });
});

test('it is a TALLY and never a LOG — no player, night or photo is stored', () => {
  withTally((tally, dir) => {
    tally.record({ shown: ['a'], used: ['a'] });
    const raw = fs.readFileSync(path.join(dir, 'prop-use.json'), 'utf8');
    const parsed = JSON.parse(raw);
    assert.deepEqual(Object.keys(parsed), ['props']);
    assert.deepEqual(Object.keys(parsed.props.a).sort(), ['shown', 'used']);
  });
});

test('junk ids are dropped rather than stored, and an empty record is a no-op', () => {
  withTally((tally) => {
    // It is written from a request body, so it is somebody else's string.
    tally.record({ shown: ['../../etc/passwd', 'A'.repeat(400), 'Ok Then', 7, null], used: [] });
    assert.deepEqual(Object.keys(tally.data.props), []);
    assert.deepEqual(tally.record({}), { shown: 0, used: 0 });
  });
});

test('it survives a corrupt file rather than throwing, like the spend ledger', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'props-'));
  try {
    const file = path.join(dir, 'prop-use.json');
    fs.writeFileSync(file, 'not json at all');
    const tally = new PropUse(file);
    assert.deepEqual(tally.table([]), []);
    tally.record({ shown: ['a'], used: ['a'] });
    assert.equal(tally.table(['a'])[0].used, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
