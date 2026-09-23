/**
 * WHICH LINES EACH BINGO PRIZE PAYS ON — chosen by the host, checked by the app.
 *
 * *"I select 3 and then select lines 2, 3 and full house."* The engine could
 * always play any list of stages; what was missing was a way to say one, and
 * a check that what is said is a list a room can actually play. Both halves
 * share `prize-parts.js`, so the picker and the launch cannot disagree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FULL_HOUSE, checkStages, defaultStages, moveStage, stageChoices, stageWord,
} from '../public/assets/prize-parts.js';
import { CARD_SHAPES, maxLineStage, maxPrizes, stageLabel, stagePlan } from '../src/bingo.js';
import { Session } from '../src/session.js';
import { normalise } from '../src/shows.js';

const FIVE = { rows: 5, cols: 5 };

test('the ceiling is the lines a card holds without being a full house', () => {
  const at = (rows, cols) => maxLineStage({ rows, cols });
  // An edge square on a square card is on its row and its column only.
  assert.equal(at(5, 5), 10);
  assert.equal(at(4, 4), 8);
  assert.equal(at(3, 3), 6);
  // A strip wins the long way only, so every square is on exactly one line —
  // and all but one is the old strip rule, found by the same sum.
  assert.equal(at(6, 4), 3);
  assert.equal(at(8, 3), 2);
  // And every plan the app already offers fits under it.
  for (const shape of CARD_SHAPES) {
    const plan = stagePlan(maxPrizes(shape));
    assert.ok(checkStages(plan, plan.length, maxLineStage(shape)),
      `the default plan for ${shape.rows}x${shape.cols} does not fit its own card`);
  }
});

test('one wording and one default, shared with the console', () => {
  assert.deepEqual(defaultStages(3), [1, 2, FULL_HOUSE]);
  assert.deepEqual(stagePlan(3), defaultStages(3));
  assert.equal(stageWord(1), 'a line');
  assert.equal(stageWord(3), '3 lines');
  assert.equal(stageWord(FULL_HOUSE), 'a full house');
  assert.equal(stageLabel(2), stageWord(2));
});

test('a list the room can play is kept, and anything else means "the default"', () => {
  assert.deepEqual(checkStages([2, 3, 'full'], 3, 10), [2, 3, 'full'], 'the one that was asked for');
  assert.equal(checkStages([2, 3, 5], 3, 10), null, 'a night ends on the full house');
  assert.equal(checkStages(['full', 2, 'full'], 3, 10), null, 'the full house is last and only last');
  assert.equal(checkStages([3, 2, 'full'], 3, 10), null, 'falling: the second prize would already be won');
  assert.equal(checkStages([2, 2, 'full'], 3, 10), null, 'level: the same card takes two at once');
  assert.equal(checkStages([2, 11, 'full'], 3, 10), null, 'more lines than the card holds short of a full house');
  assert.equal(checkStages([2, 3, 'full'], 4, 10), null, 'a list for three is not a list for four');
  assert.equal(checkStages([1.5, 'full'], 2, 10), null);
  assert.equal(checkStages('2,3,full', 3, 10), null, 'whatever a request body made up');
  assert.deepEqual(checkStages(['full'], 1, 10), ['full'], 'one prize is the full house');
});

test('the picker offers only what leaves room either side, and a choice moves only what it must', () => {
  // Three prizes on a 5x5: two line prizes, then the full house.
  assert.deepEqual(stageChoices(0, 3, 10), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(stageChoices(1, 3, 10), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // A strip of three lines holds two line prizes at most, and they are fixed.
  assert.deepEqual(stageChoices(0, 3, 2), [1]);
  assert.deepEqual(stageChoices(1, 3, 2), [2]);

  // The host's own example: the first prize moved to 2 lines pushes the
  // second up to 3, and the full house stays where it is.
  assert.deepEqual(moveStage([1, 2, 'full'], 0, 2), [2, 3, 'full']);
  // Moving the second DOWN past the first pulls the first down with it.
  assert.deepEqual(moveStage([4, 6, 'full'], 1, 3), [2, 3, 'full']);
  // A neighbour already far enough away is left exactly where the host put it.
  assert.deepEqual(moveStage([1, 8, 'full'], 0, 3), [3, 8, 'full']);

  // EVERY choice the picker can offer lands on a list the room can play.
  for (const shape of CARD_SHAPES) {
    const maxLine = maxLineStage(shape);
    for (let count = 2; count <= maxPrizes(shape); count += 1) {
      const start = defaultStages(count);
      for (let at = 0; at < count - 1; at += 1) {
        for (const lines of stageChoices(at, count, maxLine)) {
          const moved = moveStage(start, at, lines);
          assert.ok(checkStages(moved, count, maxLine),
            `${shape.rows}x${shape.cols}, ${count} prizes, prize ${at + 1} on ${lines}: ${JSON.stringify(moved)}`);
        }
      }
    }
  }
});

/** A bingo session on a copy of one pack, dealt on a 5x5. */
function withBingo(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'which-lines-'));
  const pack = {
    id: 'lines-test', title: 'Lines test', card: FIVE,
    tracks: Array.from({ length: 40 }, (_, i) => ({ title: `Song ${i + 1}`, artist: `Artist ${i + 1}` })),
  };
  fs.writeFileSync(path.join(dir, `${pack.id}.json`), JSON.stringify(pack));
  try {
    return run(new Session({
      config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
      store: { load: () => null, save: () => {}, flush: () => {}, write: () => {} },
      onPush: () => {},
      now: () => Date.parse('2026-09-23T20:00:00Z'),
    }), pack);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the launch plays the lines the host chose, and the room is told them', () => {
  withBingo((session, pack) => {
    session.launch('bingo', pack.id, { shape: FIVE, prizes: 3, stages: [2, 3, 'full'] });
    assert.deepEqual(session.engine.state.stages, [2, 3, 'full']);
    // What every screen reads the prizes off — the projector, the phones and
    // the control view all build on `baseView()`.
    for (const [who, view] of [['projector', session.screenView()], ['control view', session.hostView()]]) {
      assert.deepEqual((view.prizes || []).map((p) => p.label), ['2 lines', '3 lines', 'a full house'],
        `the ${who} names different prizes from the ones chosen`);
    }
  });
});

test('a list that does not fit is the default plan, never a refused launch', () => {
  withBingo((session, pack) => {
    // Lines 11 and 12 on a 5x5 are a full house wearing a line's name.
    session.launch('bingo', pack.id, { shape: FIVE, prizes: 3, stages: [11, 12, 'full'] });
    assert.deepEqual(session.engine.state.stages, [1, 2, 'full']);
  });
  withBingo((session, pack) => {
    // Chosen for three prizes, launched on four: the count wins.
    session.launch('bingo', pack.id, { shape: FIVE, prizes: 4, stages: [2, 3, 'full'] });
    assert.deepEqual(session.engine.state.stages, [1, 2, 3, 'full']);
  });
  withBingo((session, pack) => {
    // An ordinary night sends nothing, and gets exactly what it always got.
    session.launch('bingo', pack.id, { shape: FIVE, prizes: 3 });
    assert.deepEqual(session.engine.state.stages, [1, 2, 'full']);
  });
});

test('a saved show keeps the lines with the count they were chosen for, and drops them when it moves', () => {
  const one = normalise({ name: 'Thursday', kind: 'bingo', packId: 'b', prizes: 3, stages: [2, 3, 'full'] }, 0);
  assert.deepEqual(one.stages, [2, 3, 'full'], 'the one-game show');
  assert.deepEqual(one.items[0].stages, [2, 3, 'full'], 'and its one part');
  const mixed = normalise({
    name: 'Quiz then bingo',
    items: [{ kind: 'quiz', packId: 'q', order: [{ packId: 'q', round: 0 }] },
      { kind: 'bingo', packId: 'b', prizes: 3, stages: [1, 4, 'full'] }],
  }, 0);
  assert.deepEqual(mixed.items[1].stages, [1, 4, 'full'], 'a bingo part of a running order');
  const stale = normalise({ name: 'T', kind: 'bingo', packId: 'b', prizes: 4, stages: [2, 3, 'full'] }, 0);
  assert.equal(stale.stages, undefined, 'a list for three is not kept on a count of four');
});
