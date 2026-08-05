/**
 * The no-repeats memory.
 *
 * The point of this is a regular at your Tuesday night not hearing the same
 * sixteen songs every week. So: what was played recently is blocked, what was
 * played months ago comes back round, and near-miss spellings of the same
 * record count as the same record.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { trackKey, recordUsed, recentKeys, recentTracks, filterRecent, readHistory, forgetAll } from '../src/history.js';

const DAY = 86400000;
const NOW = 1_800_000_000_000;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-history-'));
}

function withDir(fn) {
  const dir = tmpDir();
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the same record written slightly differently is still the same record', () => {
  const key = trackKey({ title: 'Take On Me', artist: 'a-ha' });
  assert.equal(trackKey({ title: 'take on me', artist: 'A-Ha' }), key);
  assert.equal(trackKey({ title: 'Take On Me (Remastered 2017)', artist: 'a-ha' }), key);
  assert.equal(trackKey({ title: 'Take On Me - Radio Edit', artist: 'a-ha' }), key);
  assert.equal(trackKey({ title: "Take On Me [Live]", artist: 'a-ha' }), key);
  // But a genuinely different song is not.
  assert.notEqual(trackKey({ title: 'The Sun Always Shines on T.V.', artist: 'a-ha' }), key);
});

test('a track used last week is blocked', () => {
  withDir((dir) => {
    recordUsed(dir, [{ title: 'Africa', artist: 'Toto' }], { packId: 'p1', at: NOW - 7 * DAY });
    const blocked = recentKeys(dir, 3, NOW);
    assert.ok(blocked.has(trackKey({ title: 'Africa', artist: 'Toto' })));
  });
});

test('a track used six months ago comes back round', () => {
  withDir((dir) => {
    recordUsed(dir, [{ title: 'Africa', artist: 'Toto' }], { packId: 'p1', at: NOW - 180 * DAY });
    assert.equal(recentKeys(dir, 3, NOW).size, 0, 'not blocked at three months');
    assert.equal(recentKeys(dir, 12, NOW).size, 1, 'still blocked at a year');
  });
});

test('filtering drops the recent ones and keeps the rest', () => {
  withDir((dir) => {
    recordUsed(dir, [
      { title: 'Africa', artist: 'Toto' },
      { title: 'Take On Me', artist: 'a-ha' },
    ], { at: NOW - 10 * DAY });

    const { kept, dropped } = filterRecent(dir, [
      { title: 'Africa', artist: 'Toto' },              // played recently
      { title: 'take on me', artist: 'A-Ha' },          // same, different case
      { title: 'Billie Jean', artist: 'Michael Jackson' },
      { title: 'Blue Monday', artist: 'New Order' },
    ], 3, NOW);

    assert.deepEqual(kept.map((t) => t.title), ['Billie Jean', 'Blue Monday']);
    assert.equal(dropped.length, 2);
    assert.ok(dropped.every((d) => d.reason === 'played recently'));
  });
});

test('a list that repeats itself is deduplicated too', () => {
  withDir((dir) => {
    const { kept, dropped } = filterRecent(dir, [
      { title: 'Africa', artist: 'Toto' },
      { title: 'Africa (Remastered)', artist: 'Toto' },
      { title: 'Rio', artist: 'Duran Duran' },
    ], 3, NOW);
    assert.equal(kept.length, 2);
    assert.equal(dropped[0].reason, 'duplicate in this list');
  });
});

test('a window of zero months blocks nothing', () => {
  withDir((dir) => {
    recordUsed(dir, [{ title: 'Africa', artist: 'Toto' }], { at: NOW - 1000 });
    assert.equal(filterRecent(dir, [{ title: 'Africa', artist: 'Toto' }], 0, NOW).kept.length, 1);
  });
});

test('the readable list shows the most recent use of each track', () => {
  withDir((dir) => {
    recordUsed(dir, [{ title: 'Africa', artist: 'Toto' }], { packId: 'march', at: NOW - 60 * DAY });
    recordUsed(dir, [{ title: 'Africa', artist: 'Toto' }], { packId: 'may', at: NOW - 5 * DAY });
    const list = recentTracks(dir, 3, NOW);
    assert.equal(list.length, 1, 'one entry, not two');
    assert.equal(list[0].packId, 'may');
  });
});

test('history older than about eighteen months is pruned away', () => {
  withDir((dir) => {
    recordUsed(dir, [{ title: 'Ancient', artist: 'History' }], { at: NOW - 600 * DAY });
    recordUsed(dir, [{ title: 'Recent', artist: 'Thing' }], { at: NOW });
    const entries = readHistory(dir).entries;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, 'Recent');
  });
});

test('no history file at all is not an error', () => {
  withDir((dir) => {
    assert.deepEqual(readHistory(dir), { entries: [] });
    assert.equal(recentKeys(dir, 3, NOW).size, 0);
    assert.deepEqual(filterRecent(dir, [{ title: 'X', artist: 'Y' }], 3, NOW).kept.length, 1);
  });
});

test('a corrupted history file falls back to empty rather than crashing', () => {
  withDir((dir) => {
    fs.writeFileSync(path.join(dir, 'track-history.json'), '{ this is not json');
    assert.deepEqual(readHistory(dir), { entries: [] });
  });
});

test('you can wipe the memory deliberately', () => {
  withDir((dir) => {
    recordUsed(dir, [{ title: 'Africa', artist: 'Toto' }], { at: NOW });
    forgetAll(dir);
    assert.equal(recentKeys(dir, 12, NOW).size, 0);
  });
});
