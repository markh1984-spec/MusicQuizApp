/**
 * A PHONE THAT JOINS DURING A BINGO INTERLUDE KEEPS THE TEAM IT IS DEALT.
 *
 * On a random-teams night that runs quiz → bingo → quiz, somebody arriving
 * during the bingo has no team — bingo has none to give. At the boundary into
 * the second quiz `join()` deals them one, as it deals every honest joiner,
 * and `seedCarriedPlayers()` then DELETED it, reading their empty `teamId` as
 * "had none, keep it that way". So they played the rest of the night as a
 * lone row beside averaged teams, and the deal left an empty team behind
 * (Part C of the September sweeps, #7, still live on 6 October 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Session } from '../src/session.js';

function withNight() {
  const dir = mkdtempSync(join(tmpdir(), 'latecomer-'));
  for (const id of ['quiz-a', 'quiz-b']) {
    writeFileSync(join(dir, `${id}.json`), JSON.stringify({
      id, title: `Quiz ${id}`, questionSeconds: 20,
      rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
        { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
      ] }],
    }));
  }
  writeFileSync(join(dir, 'bingo-a.json'), JSON.stringify({
    id: 'bingo-a', title: 'Bingo A', cardSize: 4,
    tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}` })),
  }));
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store: { load: () => null, save: () => {}, flush: () => {}, write: () => {} },
    onPush: () => {},
    now: () => 1_700_000_000_000,
  });
  return { session, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('somebody who arrives during the bingo plays the next quiz IN a team, not as a row of their own', () => {
  const it = withNight();
  try {
    const { session } = it;
    session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', shape: { rows: 3, cols: 3 }, prizes: 1 },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ], { teamPlay: true, teamMode: 'random' });
    for (const name of ['Ann', 'Bob', 'Cat']) session.engine.join({ name });
    const before = Object.values(session.engine.state.players).map((p) => [p.name, p.teamId]);
    assert.ok(before.every(([, t]) => t), 'the first quiz dealt everybody a team');

    session.advanceOrder();                                   // into the bingo
    const late = session.engine.join({ name: 'Latecomer' });
    session.advanceOrder();                                   // and the second quiz

    const players = session.engine.state.players;
    const them = players[late.id];
    assert.ok(them, 'the latecomer is carried into the second quiz');
    assert.ok(them.teamId && session.engine.state.teams[them.teamId],
      `the latecomer has a real team (teamId ${JSON.stringify(them.teamId)})`);
    for (const [name, teamId] of before) {
      const p = Object.values(players).find((x) => x.name === name);
      assert.equal(p.teamId, teamId, `${name} kept the team they were told at the door`);
    }
    const used = new Set(Object.values(players).map((p) => p.teamId));
    for (const id of Object.keys(session.engine.state.teams)) {
      assert.ok(used.has(id), `no empty team is left behind (${id})`);
    }
  } finally {
    it.done();
  }
});
