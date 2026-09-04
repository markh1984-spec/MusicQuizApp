/**
 * The Session's action dispatcher — `run(action, body)` — which is what every
 * button on the control view actually reaches.
 *
 * Found by a live browser run, not a unit test: `bingo.js`'s own
 * `redeemVoucher`/`reinstateVoucher` worked fine when called directly, and
 * every bingo test called them that way — so nothing caught that `run()`'s
 * `perGame` object only defined the two actions on the QUIZ branch. A bingo
 * night's "Put it back" button posted `reinstateVoucher` and got back
 * `{"error":"Unknown action: reinstateVoucher"}`, live, in front of the host.
 * That is the class of bug a test which never goes through the dispatcher
 * cannot see — see CLAUDE.md's "a test that never runs the artefact proves
 * nothing about it".
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Session } from '../src/session.js';

const START = 1_700_000_000_000;

function bingoPack(trackCount = 40) {
  return {
    id: 'test-bingo',
    title: 'Test Bingo',
    cardSize: 4,
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: `t${i + 1}`,
      title: `Track ${i + 1}`,
      artist: `Artist ${i + 1}`,
    })),
  };
}

/** A Session with a store that does nothing, like the other Session tests. */
function withSession() {
  let at = START;
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: '/tmp', quizDir: '/tmp', bingoDir: '/tmp', advertDir: '/tmp' },
    store,
    onPush: () => {},
    now: () => at,
  });
  return { session, tick: (ms) => { at += ms; } };
}

test('a bingo night can redeem and reinstate a voucher through run(), same as the quiz', () => {
  const { session } = withSession();
  session.build('bingo', bingoPack());
  session.engine.state.rewards = ['A round of drinks', 'A bottle of wine'];
  const p = session.engine.join({ name: 'Quizteam Aguilera' });
  const line = session.engine.lines()[0];
  for (const i of line) {
    session.engine.call(p.card[i]);
    session.engine.mark({ playerId: p.id, index: i, marked: true });
  }
  session.engine.claim(p.id);
  const [code] = Object.keys(session.engine.state.vouchers);
  assert.ok(code, 'the test needs a real voucher to check the dispatcher against');

  const redeemed = session.run('redeemVoucher', { code });
  assert.notEqual(redeemed, undefined, 'the host\'s "Mark it used" button reached "Unknown action"');
  assert.ok(session.engine.state.vouchers[code].redeemedAt);

  const reinstated = session.run('reinstateVoucher', { code });
  assert.notEqual(reinstated, undefined, 'the host\'s "Put it back" button reached "Unknown action"');
  assert.equal(session.engine.state.vouchers[code].redeemedAt, null);
});

test('the quiz keeps the same two actions through run(), unchanged by the move', () => {
  const quiz = {
    id: 'q', title: 'A Quiz', questionSeconds: 20,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  };
  const { session } = withSession();
  session.build('quiz', quiz);
  session.engine.state.rewards = ['A free drink'];
  const p = session.engine.join({ name: 'Quizteam Aguilera' });
  session.engine.start();
  session.engine.finish();
  const [code] = Object.keys(session.engine.state.vouchers);
  assert.ok(code);

  assert.notEqual(session.run('redeemVoucher', { code }), undefined);
  assert.ok(session.engine.state.vouchers[code].redeemedAt);
  assert.notEqual(session.run('reinstateVoucher', { code }), undefined);
  assert.equal(session.engine.state.vouchers[code].redeemedAt, null);
});

// ------------------------------------------------------------ running order
//
// Quiz -> bingo -> quiz, one set of teams, one running score across the
// bingo interruption — asked for directly: "the quiz is broken up by two
// music bingos and the quiz prizes are only given out at the end." These go
// through the REAL file-loading path (`launch()`'s own pack loader), not
// `session.build()` directly, because the bug class this feature risks is
// exactly the one CLAUDE.md warns about: something that reads fine as a
// method call and is wrong the moment it goes through the actual route.

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function writeQuizPack(dir, id, { correctIndex = 0 } = {}) {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({
    id, title: `Quiz ${id}`, questionSeconds: 20, showRules: false,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex },
    ] }],
  }));
}

function writeBingoPack(dir, id, trackCount = 40) {
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({
    id, title: `Bingo ${id}`, cardSize: 4,
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: `t${i + 1}`, title: `Track ${i + 1}`, artist: `Artist ${i + 1}`,
    })),
  }));
}

/** A Session whose packs are real files, like a running quizmaster's room. */
function withFileSession() {
  const dir = mkdtempSync(join(tmpdir(), 'running-order-'));
  writeQuizPack(dir, 'quiz-a');
  writeQuizPack(dir, 'quiz-b');
  writeBingoPack(dir, 'bingo-a');
  let at = START;
  const store = { load: () => null, save: () => {}, flush: () => {}, write: () => {} };
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store,
    onPush: () => {},
    now: () => at,
  });
  return { session, dir, tick: (ms) => { at += ms; }, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Drive a one-question, one-round quiz segment right up to its own
 * ROUND_BOARD — the natural pause this whole feature leans on — and answer
 * correctly on the way, so there is a real score to carry.
 *
 * `composeQuiz()` (running-order.js) does not carry a source pack's
 * `showRules` onto the composed pack — it only copies `id`, `title`, `look`,
 * `rounds` and `sources` — so a running-order quiz always shows the rules
 * slide first, regardless of what the fixture pack says. That is existing,
 * pre-existing behaviour of `composeQuiz` and not something this feature
 * changes, so the helper drives through RULES rather than assuming it away.
 */
function playQuizSegmentToRoundBoard(session, playerId, correctIndex = 0) {
  session.engine.next(); // LOBBY -> RULES (or ROUND_INTRO, for a plain single-pack launch)
  if (session.engine.state.phase === 'rules') session.engine.next(); // RULES -> ROUND_INTRO
  session.engine.next(); // ROUND_INTRO -> QUESTION
  session.engine.answer({ playerId, optionIndex: correctIndex });
  session.engine.next(); // QUESTION -> REVEAL
  session.engine.next(); // REVEAL -> ROUND_BOARD (last question of the only round)
}

test('quiz -> bingo -> quiz: the same team keeps its identity and its score across both switches', () => {
  const it = withFileSession();
  try {
    const segments = [
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      // 2 prizes stages the night as [a line, a full house] — a genuine
      // single-line win only counts against the FIRST of those. See
      // bingo.test.js's own stagedGame() helper for the same trap.
      { kind: 'bingo', packId: 'bingo-a', prizes: 2 },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ];
    it.session.launchRunningOrder(segments, { venue: 'The Nag\'s Head', rewards: ['A trophy'] });
    assert.equal(it.session.kind, 'quiz');

    const joined = it.session.engine.join({ name: 'Quizteam Aguilera' });
    const { id, token } = joined;
    playQuizSegmentToRoundBoard(it.session, id);
    const scoreAfterPartOne = it.session.engine.state.players[id].score;
    assert.ok(scoreAfterPartOne > 0, 'the fixture needs a real score to prove it carries');
    assert.equal(it.session.engine.state.phase, 'round_board');

    // Off to bingo — the same team, with no rejoin.
    it.session.advanceOrder();
    assert.equal(it.session.kind, 'bingo');
    assert.equal(it.session.orderPos, 1);
    const inBingo = it.session.engine.state.players[id];
    assert.ok(inBingo, 'the team was not carried into the bingo part at all');
    assert.equal(inBingo.token, token, 'a new token means the phone\'s stored one stops working');
    assert.equal(inBingo.name, 'Quizteam Aguilera');
    assert.ok(Array.isArray(inBingo.card) && inBingo.card.length, 'no card was dealt for the carried player');

    // Win the bingo prize, then move on to the last part.
    it.session.engine.start();
    const line = it.session.engine.lines()[0];
    for (const i of line) {
      it.session.engine.call(inBingo.card[i]);
      it.session.engine.mark({ playerId: id, index: i, marked: true });
    }
    const claim = it.session.engine.claim(id);
    assert.ok(claim.valid, 'the bingo interlude needs a real win to prove prizes are separate');
    assert.equal(Object.keys(it.session.engine.state.vouchers).length, 1, 'the bingo prize was not given out at the time it was won');

    it.session.advanceOrder();
    assert.equal(it.session.kind, 'quiz');
    assert.equal(it.session.orderPos, 2);
    const backInQuiz = it.session.engine.state.players[id];
    assert.ok(backInQuiz, 'the team did not survive the second switch');
    assert.equal(backInQuiz.token, token);
    assert.equal(backInQuiz.score, scoreAfterPartOne, 'the running score did not carry back into the quiz');

    // Finish the last part for real and confirm the quiz's own prize is
    // only given out HERE, at the true end, never at the interludes.
    it.session.engine.next(); // LOBBY -> RULES
    it.session.engine.next(); // RULES -> ROUND_INTRO
    it.session.engine.next(); // ROUND_INTRO -> QUESTION
    it.session.engine.answer({ playerId: id, optionIndex: 0 });
    it.session.engine.next(); // QUESTION -> REVEAL
    it.session.engine.next(); // REVEAL -> ROUND_BOARD
    assert.equal(Object.keys(it.session.engine.state.vouchers || {}).length, 0, 'a fresh quiz engine holds no vouchers yet');
    it.session.engine.next(); // ROUND_BOARD -> FINAL, the real end of the night
    assert.equal(it.session.engine.state.phase, 'final');
    assert.equal(Object.keys(it.session.engine.state.vouchers).length, 1, 'the quiz prize was not given out at the true end');
  } finally {
    it.done();
  }
});

test('the lobby game re-resolves to each part\'s OWN default, rather than carrying the last part\'s across a kind switch', () => {
  // Found live: a bingo interlude showed Maze Mouth (the QUIZ default)
  // instead of Rally, because the quiz part's RESOLVED choice was carried
  // forward as if it had been an explicit one. See nightWideOpts().
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 1 },
    ]);
    assert.equal(it.session.engine.state.lobbyGame, 'maze', 'the quiz part should default to Maze Mouth');
    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);

    it.session.advanceOrder();
    assert.equal(it.session.kind, 'bingo');
    assert.equal(it.session.engine.state.lobbyGame, 'rally', 'the bingo part should default to Rally, not inherit the quiz part\'s Maze Mouth');
  } finally {
    it.done();
  }
});

test('an intermediate part never archives the night, only the true final part does', () => {
  const it = withFileSession();
  try {
    const archived = [];
    it.session.onArchive = (record) => archived.push(record);
    const segments = [
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 1 },
    ];
    it.session.launchRunningOrder(segments);
    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);
    assert.equal(archived.length, 0, 'the first part reached round_board, not FINAL — it must not have archived');

    it.session.advanceOrder();
    assert.equal(archived.length, 0, 'moving into bingo must not archive the quiz part either');

    it.session.engine.finish(); // the real end of THIS night, bingo being the last part
    assert.equal(archived.length, 1, 'the night never got archived at all');
  } finally {
    it.done();
  }
});

test('archiving a running-order night records every part, not just the last', () => {
  // Found the gap live-verifying the feature: `engine.results()` only ever
  // knows about whichever engine is `this.engine` when the night ends, i.e.
  // the LAST part — so a quiz split by a bingo interlude used to lose the
  // quiz's own pack identity from Past gigs entirely. See docs/console.md.
  const it = withFileSession();
  try {
    const segments = [
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 1 },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ];
    const archived = [];
    it.session.onArchive = (record) => archived.push(record);
    it.session.launchRunningOrder(segments);
    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);

    it.session.advanceOrder(); // into bingo
    it.session.advanceOrder(); // into the closing quiz
    it.session.engine.next(); // LOBBY -> RULES
    it.session.engine.next(); // RULES -> ROUND_INTRO
    it.session.engine.next(); // ROUND_INTRO -> QUESTION
    it.session.engine.answer({ playerId: id, optionIndex: 0 });
    it.session.engine.next(); // QUESTION -> REVEAL
    it.session.engine.next(); // REVEAL -> ROUND_BOARD
    it.session.engine.next(); // ROUND_BOARD -> FINAL, the true end

    assert.equal(archived.length, 1);
    const { parts } = archived[0];
    assert.ok(Array.isArray(parts), 'the archived record has no parts at all');
    assert.deepEqual(parts, [
      { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-a' },
      { kind: 'bingo', id: 'bingo-a', title: 'Bingo bingo-a' },
      { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-b' },
    ]);
    // And the same list is what a quizmaster's Past gigs page would actually
    // read back off disk, not just what stayed in memory this run.
    const onDisk = JSON.parse(readFileSync(join(it.session.archiveDir, `${archived[0].id}.json`), 'utf8'));
    assert.deepEqual(onDisk.parts, parts);
  } finally {
    it.done();
  }
});

test('an ordinary, single-game night is archived with no `parts` field at all', () => {
  const it = withFileSession();
  try {
    const archived = [];
    it.session.onArchive = (record) => archived.push(record);
    it.session.launch('quiz', 'quiz-a', {});
    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);
    it.session.engine.next(); // ROUND_BOARD -> FINAL
    assert.equal(archived.length, 1);
    assert.equal('parts' in archived[0], false, 'an ordinary night should not grow a new field nobody asked for');
  } finally {
    it.done();
  }
});

test('a running-order part whose pack was deleted mid-evening is named as missing, not dropped or thrown', () => {
  const it = withFileSession();
  try {
    const archived = [];
    it.session.onArchive = (record) => archived.push(record);
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 1 },
    ]);
    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);
    it.session.advanceOrder();
    // The first part's own pack is removed from disk between it being
    // played and the night actually being archived.
    rmSync(join(it.dir, 'quiz-a.json'));

    it.session.engine.start();
    const line = it.session.engine.lines()[0];
    for (const i of line) {
      it.session.engine.call(it.session.engine.state.players[id].card[i]);
      it.session.engine.mark({ playerId: id, index: i, marked: true });
    }
    it.session.engine.finish();

    assert.equal(archived.length, 1);
    assert.deepEqual(archived[0].parts[0], { kind: 'quiz', id: null, title: null });
    assert.deepEqual(archived[0].parts[1], { kind: 'bingo', id: 'bingo-a', title: 'Bingo bingo-a' });
  } finally {
    it.done();
  }
});

test('advanceOrder refuses to move past the last part', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([{ kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] }]);
    const result = it.session.advanceOrder();
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_more_parts');
  } finally {
    it.done();
  }
});

test('a plain launch() clears any running order left over from a previous night', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 1 },
    ]);
    assert.ok(it.session.runningOrder);
    it.session.launch('quiz', 'quiz-b', {});
    assert.equal(it.session.runningOrder, null, 'a stale running order survived an ordinary relaunch');
    assert.equal(it.session.hostView().runningOrder, null);
  } finally {
    it.done();
  }
});

test('a restart mid running-order restores the plan from the state, not from memory', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 1 },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ]);
    it.session.engine.join({ name: 'Quizteam Aguilera' });
    it.session.advanceOrder(); // now on the bingo part, orderPos 1

    // What a restart does: the same state, handed to a freshly built Session.
    const saved = JSON.parse(JSON.stringify(it.session.engine.state));
    const store2 = { load: () => saved, save: () => {}, flush: () => {}, write: () => {} };
    const restarted = new Session({
      config: { dataDir: it.dir, quizDir: it.dir, bingoDir: it.dir, advertDir: it.dir },
      store: store2,
      onPush: () => {},
      now: () => Date.now(),
    });
    restarted.boot();

    assert.equal(restarted.orderPos, 1);
    assert.equal(restarted.runningOrder.length, 3);
    const view = restarted.hostView();
    assert.equal(view.runningOrder.pos, 1);
    assert.equal(view.runningOrder.total, 3);
    assert.equal(view.runningOrder.nextKind, 'quiz');

    // And the plan restored from disk still actually works.
    const advanced = restarted.advanceOrder();
    assert.notEqual(advanced, undefined);
    assert.equal(restarted.kind, 'quiz');
    assert.equal(restarted.orderPos, 2);
  } finally {
    it.done();
  }
});

/*
 * `winners` IS TWO DIFFERENT FIELDS AND THE COLLISION BLANKED THE PROJECTOR.
 *
 * The quiz's `state.winners` is a NUMBER of places, added on 3 September 2026
 * and sent by the console on every launch. `bingo.js`'s has always been
 * `{ line: [], full: [] }`. `session.launch()` wrote the number onto whatever
 * engine it had just built, so launching a bingo game replaced the object —
 * and `screenView()` threw on `state.winners.line.map`, which means
 * `GET /api/state` answered 500 and **the big screen went blank**.
 *
 * Nothing saw it: every other test calls `launch()` without `winners`, and the
 * name reads as correct in both files. Found by a browser walking the gig path
 * and switching from a quiz to a bingo game, which is what a host does.
 */
test('launching a bingo game with the quiz\'s winners setting does not blank the projector', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winners-'));
  const pack = bingoPack();
  fs.writeFileSync(path.join(dir, `${pack.id}.json`), JSON.stringify(pack));

  let at = START;
  const session = new Session({
    config: { dataDir: dir, quizDir: dir, bingoDir: dir, advertDir: dir },
    store: { load: () => null, save: () => {}, flush: () => {}, write: () => {} },
    onPush: () => {},
    now: () => at,
  });

  session.launch('bingo', pack.id, { winners: 3 });
  assert.deepEqual(
    session.engine.state.winners, { line: [], full: [] },
    'the quiz\'s number of places overwrote bingo\'s own winners object',
  );
  assert.doesNotThrow(() => session.screenView(), 'the projector\'s own view threw');

  fs.rmSync(dir, { recursive: true, force: true });
});
