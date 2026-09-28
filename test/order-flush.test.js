/**
 * A RUNNING ORDER IS ON THE DISK THE INSTANT IT LAUNCHES — not 250ms later.
 *
 * `startOrderSegment()` launches the part (which flushes a state with no order
 * on it) and only THEN writes `runningOrder`, `orderPos` and the carried
 * scores onto the state — through the debounce. A crash inside that window
 * came back as a plain one-part night: part two onwards gone, "Continue"
 * never offered, and nothing said. A yellow of the 23 September 2026
 * launch-path sweep. Rule 7: anything that moves the night forward is
 * written this instant, and the night's own shape is the first such thing.
 *
 * A REAL `Store`; the reboot is a fresh Session over the same file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';
import { Store } from '../src/store.js';

test('the running order is on disk as soon as part one launches, and a reboot inside the window brings part two back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'order-flush-'));
  try {
    writeFileSync(join(dir, 'quiz-a.json'), JSON.stringify({
      id: 'quiz-a', title: 'Quiz A', questionSeconds: 20, showRules: false,
      rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [{ id: 'q1', prompt: 'A?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] }],
    }));
    writeFileSync(join(dir, 'bingo-a.json'), JSON.stringify({
      id: 'bingo-a', title: 'Bingo A', cardSize: 4,
      tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i + 1}`, title: `T${i + 1}`, artist: `A${i + 1}` })),
    }));
    const config = { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir };
    const boot = () => new Session({ config, store: new Store(join(dir, 'state.json')), onPush: () => {}, onArchive: () => {}, now: () => Date.now(), paths: { archive: join(dir, 'archive') } });

    const session = boot();
    session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a' },
    ], {});
    // Read the DISK now — no wait, no flush: the crash happens here.
    const onDisk = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));
    assert.ok(Array.isArray(onDisk.runningOrder) && onDisk.runningOrder.length === 2,
      `the running order is not on disk the instant it launched: ${JSON.stringify(onDisk.runningOrder)}`);
    assert.equal(onDisk.orderPos, 0);

    const again = boot().boot();
    assert.ok(again.runningOrder && again.runningOrder.length === 2, 'a reboot inside the window lost part two');
    assert.equal(again.hostView().runningOrder.nextKind, 'bingo', 'Continue to the bingo is not offered after the reboot');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
