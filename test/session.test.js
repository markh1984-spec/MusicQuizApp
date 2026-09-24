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
import { listArchive } from '../src/library.js';

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
  // A row that scored nothing is not paid — see `issueVouchers()` — and this
  // test is about the two actions, not about the scoring.
  session.engine.state.players[p.id].score = 100;
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
    /*
     * ONE PRIZE ON EACH PART, NAMED ON THE PART.
     *
     * This test's subject is a team's identity and score surviving two
     * switches, so the prizes are pinned here rather than left to the deal:
     * a part now carries its own list and starts at its own first place, and
     * a night that brought none has the venue's spread across it by what each
     * part PAYS. Both of those are asserted on their own below; entangling
     * them here is how this fixture came to break when the rule changed.
     */
    const segments = [
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }], rewards: ['A trophy'] },
      // 2 prizes stages the night as [a line, a full house] — a genuine
      // single-line win only counts against the FIRST of those. See
      // bingo.test.js's own stagedGame() helper for the same trap.
      { kind: 'bingo', packId: 'bingo-a', prizes: 2, rewards: ['A medal'] },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }], rewards: ['A mug'] },
    ];
    it.session.launchRunningOrder(segments, { venue: 'The Nag\'s Head', winners: 1 });
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
    /*
     * TWO VOUCHERS HERE NOW, AND THAT IS THE CHANGE: the quiz part paid its
     * own winner as it ended (`advanceOrder()`), so its trophy is already on
     * the phone and marked `carried`, and the bingo has just minted the NEXT
     * drink on the list beside it.
     */
    const inBingoNow = Object.values(it.session.engine.state.vouchers);
    assert.equal(inBingoNow.length, 2, 'the quiz part paid at its boundary and the bingo at its claim');
    assert.equal(inBingoNow.filter((v) => v.carried).length, 1, "the quiz's own is carried");
    assert.deepEqual(inBingoNow.map((v) => v.reward).sort(), ['A medal', 'A trophy'],
      'the bingo started again at the top of the list instead of taking the next drink');

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
    /*
     * THE BINGO PRIZE IS STILL IN SOMEBODY'S HAND — and this assertion is
     * REVERSED, deliberately.
     *
     * It used to read *"a fresh quiz engine holds no vouchers yet"*, which was
     * true and was the bug: the interlude's voucher answered 200 from
     * `/api/voucher` before *Continue to the quiz* and 404 after it, the bar
     * could not redeem it, the host's panel was empty, and the prize never
     * reached the filed night. The old line was pinning the loss.
     *
     * What has NOT changed is the half it was really guarding: the QUIZ's own
     * prize is still minted at the true end and nowhere else. It is asserted
     * below by counting the ones that are not carried.
     */
    const beforeTheEnd = Object.values(it.session.engine.state.vouchers || {});
    assert.equal(beforeTheEnd.length, 2, "the earlier parts' vouchers were destroyed by a part boundary");
    assert.equal(beforeTheEnd.filter((v) => v.carried).length, 2,
      'both have to be marked, or they block the last part from paying out');
    assert.equal(beforeTheEnd.filter((v) => !v.carried).length, 0,
      "the LAST part has not paid yet — it has not reached its own ending");

    it.session.engine.next(); // ROUND_BOARD -> FINAL, the real end of the night
    assert.equal(it.session.engine.state.phase, 'final');
    const atTheEnd = Object.values(it.session.engine.state.vouchers);
    assert.equal(atTheEnd.filter((v) => !v.carried).length, 1, 'the last part was not paid at the true end');
    assert.equal(atTheEnd.length, 3, 'and both earlier drinks are still live at the bar');
    assert.deepEqual(atTheEnd.map((v) => v.reward).sort(), ['A medal', 'A mug', 'A trophy'],
      'three parts, three different drinks, in the order the venue listed them');
    // The same person won both, which is exactly the case the `carried` flag
    // exists for: the old idempotency check would have refused the second.
    assert.equal(new Set(atTheEnd.map((v) => v.winnerId)).size, 1);
  } finally {
    it.done();
  }
});

/*
 * THE VENUE'S LIST IS WORKED THROUGH, NOT RESTARTED BY EVERY PART.
 *
 * Each part pays its own winners as it ends. Without an offset every part
 * began again at the top: a quiz and the bingo after it both handed out "A
 * pint" and the venue's fourth, fifth and sixth drinks were never reached —
 * while the bar, who had been told six, saw the same name twice.
 *
 * `state.prizesBefore` is how many the NIGHT has already given when a part
 * starts, and `rewardList()` slices past them in BOTH engines. It is counted
 * off the vouchers rather than kept as a tally, because the vouchers are the
 * record and a second copy of a number is how two of them come to disagree.
 *
 * The other half matters just as much: **a part with nothing left gives
 * nothing**, rather than repeating a drink the venue has already paid for.
 */
/*
 * EACH GAME PAYS ITS OWN LIST, AND NOTHING IS COUNTED OFF ANYTHING.
 *
 * REVERSES A PINNED TEST, deliberately and on the host's say-so: *"I want to
 * offer prizes on a game basis and those prizes be given at the end of the
 * game regardless of what the venue prizes says... I can keep track of how
 * many prizes I've given out over 2-3 games no problem at all."*
 *
 * The test this replaces asserted `state.prizesBefore` — a count of the
 * vouchers a night had already MINTED, which each later part sliced the
 * venue's list past. `prize-parts.js` records why that was wrong: the count
 * is not the number of PLACES a part recognises, so a tie for first (paid in
 * full) or a room where somebody scored nothing moved every later part onto
 * the wrong drink, silently, in front of the room.
 *
 * What replaces it is the two halves of the new rule: a part carries its own
 * list and starts at its own first place, and a part that brought none takes
 * its share of a deal worked out at launch from what each part PAYS.
 */
/*
 * A MIS-PRESSED `Finish` IS RECOVERABLE, AND THE GAME THAT FOLLOWS IS FILED.
 *
 * Bingo's `Finish` is the stated escape hatch and it files the evening on the
 * spot. The control view still offers *Continue to the quiz* afterwards —
 * correctly, because a host who pressed Finish by mistake will reach for it —
 * but the quiz that followed used to be played in front of the room and
 * recorded NOWHERE: not Past gigs, not the league, not the headcounts, not the
 * report. The confirm promised the later part would not be played, and then
 * the app played it.
 *
 * ONE ROW FOR ONE EVENING, and `kind` MOVES WITH THE BOARD — a night finished
 * on the bingo and then continued into a quiz is filed as the quiz it ended
 * as, or `league.js` holds a quiz's scores under `kind: 'bingo'` and drops
 * them on sight.
 */
test('a night finished early still files the part played after it', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'bingo', packId: 'bingo-a', prizes: 1, rewards: ['A pint'] },
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }], rewards: ['A half'] },
    ], { venue: "The Nag's Head", winners: 1 });

    const { id } = it.session.engine.join({ name: 'Dave' });
    // The escape hatch, pressed by mistake at part one of two.
    it.session.engine.finish();
    const filedFirst = it.session.engine.state.archivedAs;
    assert.ok(filedFirst, 'Finish did not file the night at all');

    // And the recovery: Continue, then play the quiz to its end.
    /*
     * `advanceOrder()` returns the STARTED game, not `{ok:true}` — the `ok`
     * wrapper belongs to the HTTP route. Assert on what actually moved.
     */
    it.session.advanceOrder();
    assert.equal(it.session.orderPos, 1, 'Continue did not move on to the quiz after Finish');
    assert.equal(it.session.kind, 'quiz');
    playQuizSegmentToRoundBoard(it.session, id);
    for (let i = 0; i < 20 && it.session.engine.state.phase !== 'final'; i += 1) it.session.engine.next();

    assert.equal(it.session.engine.state.archivedAs, filedFirst,
      'the recovered part filed a SECOND night — one evening is one row');
    const filed = JSON.parse(readFileSync(join(it.session.archiveDir, `${filedFirst}.json`), 'utf8'));
    assert.equal(filed.kind, 'quiz',
      'the night ended as a quiz, so it must be filed as one — the league drops a bingo record');
    assert.deepEqual((filed.parts || []).map((p) => p.kind), ['bingo', 'quiz'],
      'both games belong in the record');
    assert.ok((filed.leaderboard || []).length > 0, 'the quiz that was played has no board in the filed night');
  } finally {
    it.done();
  }
});

test('a part pays the list IT was given, starting at its own first place', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }], rewards: ['The quiz drink'] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 2, rewards: ['The bingo drink', 'And another'] },
    ], { venue: "The Nag's Head", winners: 1, rewards: ['Something else entirely'] });

    assert.deepEqual(it.session.engine.rewardList(), ['The quiz drink'],
      'the quiz part did not get the list it was handed');

    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);
    it.session.advanceOrder();

    const carried = Object.values(it.session.engine.state.vouchers || {});
    assert.equal(carried.length, 1, 'the quiz part did not pay its winner as it ended');
    assert.equal(carried[0].reward, 'The quiz drink');

    // AND THE BINGO STARTS AT ITS OWN FIRST PRIZE — no offset, no slice.
    assert.deepEqual(it.session.engine.rewardList(), ['The bingo drink', 'And another'],
      'the bingo part did not start at its own first prize');

    it.session.engine.start();
    const me = it.session.engine.state.players[id];
    const line = it.session.engine.lines()[0];
    for (const i of line) {
      it.session.engine.call(me.card[i]);
      it.session.engine.mark({ playerId: id, index: i, marked: true });
    }
    it.session.engine.claim(id);
    const after = Object.values(it.session.engine.state.vouchers || {});
    const fresh = after.filter((v) => !v.carried);
    assert.equal(fresh.length, 1, 'the bingo did not pay its own line winner');
    assert.equal(fresh[0].reward, 'The bingo drink',
      'the bingo paid something off another part of the night');
  } finally {
    it.done();
  }
});

/*
 * AND A PART THAT BROUGHT NO LIST IS DEALT THE VENUE'S FROM THE TOP — PER
 * GAME, NOT PER NIGHT.
 *
 * *"I actually think then that drinks should be assigned per game and not per
 * night."* This REVERSES the test it replaces, which asserted the bingo was
 * dealt the venue's NEXT two after the quiz's — a share of one list down the
 * night. That share cut card bingo, one prize a round, to a single drink, and
 * the second game's winner got nothing. How many drinks an evening costs is
 * the host's and the venue's to decide; each game starts at the top.
 */
test('a part with no list of its own is dealt the venue list from the top', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 2 },
    ], {
      venue: "The Nag's Head",
      winners: 2,
      rewards: ['One', 'Two', 'Three', 'Four', 'Five'],
    });

    assert.deepEqual(it.session.engine.rewardList(), ['One', 'Two'],
      'the quiz was not dealt the first two, one per place it recognises');

    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);
    it.session.advanceOrder();

    assert.deepEqual(it.session.engine.rewardList(), ['One', 'Two'],
      'the bingo was dealt a share of the night instead of its own two from the top');
  } finally {
    it.done();
  }
});

/*
 * AND THE DEAL DOES NOT MOVE WHEN A TIE PAYS FOUR VOUCHERS FOR THREE PLACES.
 *
 * This is the fault `prizesBefore` had, asserted directly so it cannot come
 * back: the quiz below pays its three places to FOUR teams, because a tie for
 * first is paid in full by decision. Counting vouchers put the bingo on the
 * venue's fifth drink. Per game, the bingo starts at the TOP whatever the quiz
 * paid — so a tie still moves nothing, which is what this guards.
 */
test('a tie for first does not move what the next game pays', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a', prizes: 2 },
    ], {
      venue: "The Nag's Head",
      winners: 3,
      rewards: ['One', 'Two', 'Three', 'Four', 'Five'],
    });

    const a = it.session.engine.join({ name: 'Tied A' });
    const b = it.session.engine.join({ name: 'Tied B' });
    const c = it.session.engine.join({ name: 'Third' });
    playQuizSegmentToRoundBoard(it.session, a.id);
    // Two teams level at the top, one behind: three places, four vouchers.
    const P = it.session.engine.state.players;
    it.session.engine.setScore(P[a.id], 100);
    it.session.engine.setScore(P[b.id], 100);
    it.session.engine.setScore(P[c.id], 50);
    it.session.advanceOrder();

    const paid = Object.values(it.session.engine.state.vouchers || {});
    assert.ok(paid.length >= 3, `the quiz paid ${paid.length} vouchers, expected at least three`);
    assert.deepEqual(it.session.engine.rewardList(), ['One', 'Two'],
      'a tie for first moved the bingo off the top of the venue list');
  } finally {
    it.done();
  }
});

/*
 * AND EVERY GAME OF CARD BINGO PAYS — the failure the per-game rule was set
 * for, on the night it was found: a quiz, card bingo and music bingo.
 *
 * A deck pays one prize a round, so it is dealt ONE drink. Play three games of
 * card bingo with New round and the second found nothing on its list: a hand
 * completed, the claim accepted, and nothing on the winner's phone. A round
 * is a game (24 September 2026), so past its list a later ROUND pays the
 * LAST drink again — on a deck and on music bingo alike. A STAGE the list
 * never covered in round one still pays nothing: a free extra line before
 * the house is deliberate, and `stageIndex` is what tells the two apart.
 */
test('every game of card bingo pays, and music bingo keeps its free extra line', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'cards', packId: 'deck' },
      { kind: 'bingo', packId: 'bingo-a', prizes: 2 },
    ], {
      venue: "The Nag's Head",
      winners: 3,
      rewards: ['One', 'Two', 'Three', 'Four', 'Five'],
    });
    const { id } = it.session.engine.join({ name: 'Quizteam Aguilera' });
    playQuizSegmentToRoundBoard(it.session, id);
    it.session.advanceOrder();

    assert.deepEqual(it.session.engine.rewardList(), ['One'],
      'the card bingo was not dealt its one drink from the top');
    assert.equal(it.session.engine.rewardFor(0, 0), 'One', 'the first game of card bingo pays nothing');
    assert.equal(it.session.engine.rewardFor(1, 0), 'One',
      'the SECOND game of card bingo pays nothing — its winner gets a blank phone');
    assert.equal(it.session.engine.rewardFor(2, 0), 'One', 'the third game of card bingo pays nothing');

    it.session.advanceOrder();
    assert.deepEqual(it.session.engine.rewardList(), ['One', 'Two'],
      'the music bingo was not dealt its own two from the top');
    assert.equal(it.session.engine.rewardFor(2, 2), '',
      'music bingo paid a stage nobody put a prize on — the free extra line is deliberate');
    assert.equal(it.session.engine.rewardFor(2, 0), 'Two',
      'but round two of the music bingo, the list spent, pays the last drink again');
  } finally {
    it.done();
  }
});

/*
 * A NIGHT THAT ENDS ON THE BINGO IS STILL A QUIZ NIGHT.
 *
 * *"Quiz, then finish with the bingo while they drink up"* is an ordinary
 * evening — and the archive reads the LAST part's engine, which for bingo has
 * no positions and no scores. So the filed leaderboard had neither, the league
 * table came back `[]` (it drops anything whose `kind` is bingo), the report
 * had no podium, and the quiz's vouchers were never issued. The identical
 * night with the bingo in the MIDDLE files perfectly, which is the tell.
 */
test('A RUNNING ORDER THAT ENDS ON THE BINGO STILL FILES THE QUIZ\'S SCORES', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a' },
    ], { venue: 'The Guard Dog', rewards: ['A free drink'] });

    const player = it.session.engine.join({ name: 'Rob' });
    it.session.engine.state.players[player.id].score = 640;
    it.session.engine.forgetBoard();

    it.session.advanceOrder();
    assert.equal(it.session.kind, 'bingo');
    assert.ok(it.session.engine.state.quizSoFar, "the quiz's own results have to survive the boundary");

    it.session.engine.finish();
    const filed = listArchive(join(it.dir, 'archive'), { boards: true })[0];
    assert.ok(filed, 'the night was not filed at all');
    assert.equal(filed.kind, 'quiz',
      "league.js drops anything whose kind is bingo, so a quiz's scores filed under bingo are invisible");
    assert.equal((filed.leaderboard || [])[0].name, 'Rob');
    assert.equal((filed.leaderboard || [])[0].score, 640, 'the board had no scores on it at all');
    assert.equal((filed.leaderboard || [])[0].position, 1, 'and no positions, so the league scored nobody');
    assert.equal((filed.parts || []).length, 2, 'and the bingo is still named as part of the evening');
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

test('A PINNED LOBBY GAME SURVIVES THE WHOLE NIGHT, and an open list leads with each part\'s own default', () => {
  const it = withFileSession();
  try {
    // A Gold booking: Quick Draw pinned for the corporate crowd.
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a' },
    ], { lobbyGame: 'quickdraw' });
    assert.equal(it.session.engine.state.lobbyGame, 'quickdraw');

    it.session.advanceOrder();
    assert.equal(it.session.engine.state.lobbyGame, 'quickdraw',
      'the pin was lost from part two onward while the launch bar still said Quick Draw');
  } finally {
    it.done();
  }
});

test('…and "let them choose" opens on the game the part is FOR', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a' },
    ], { lobbyGames: ['maze', 'rally', 'tailback'] });
    assert.equal(it.session.engine.state.lobbyGames[0], 'maze', 'Maze Mouth before a quiz');

    it.session.advanceOrder();
    assert.equal(it.session.engine.state.lobbyGames[0], 'rally', 'and Rally before the bingo');
    assert.deepEqual([...it.session.engine.state.lobbyGames].sort(), ['maze', 'rally', 'tailback'],
      'rotated, not re-ordered — the rest of the menu keeps the order the room just saw');
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
    /*
     * AND EACH QUIZ PART NAMES THE PACKS IT WAS BUILT FROM — `sources`.
     *
     * A composed part's `id` is the reserved `~tonight`, which matches no pack
     * on any shelf, so without this every quiz played inside a running order
     * read as **"Never played here"** the following week at the venue that had
     * just heard it. `composeQuiz()` already knew; `describeOrderParts()` threw
     * it away.
     */
    assert.deepEqual(parts, [
      { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-a', sources: [{ packId: 'quiz-a', title: 'Quiz quiz-a' }] },
      { kind: 'bingo', id: 'bingo-a', title: 'Bingo bingo-a' },
      { kind: 'quiz', id: '~tonight', title: 'Quiz quiz-b', sources: [{ packId: 'quiz-b', title: 'Quiz quiz-b' }] },
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

/*
 * WHAT ELSE HAS TO SURVIVE A PART BOUNDARY — all three found by driving the
 * boundary rather than by reading it.
 */
test('A PHONE THE HOST REMOVED DOES NOT WALK BACK IN AT A PART BOUNDARY', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'bingo', packId: 'bingo-a' },
    ]);
    const keep = it.session.engine.join({ name: 'Quizteama Aguilera' });
    const gone = it.session.engine.join({ name: 'Something Unrepeatable' });
    it.session.engine.removePlayer(gone.id);
    assert.deepEqual(it.session.engine.state.removed, [gone.id]);

    it.session.advanceOrder();
    assert.deepEqual(it.session.engine.state.removed, [gone.id],
      'a fresh engine starts with an empty list, so the phone was told to REJOIN rather than that it was kicked');
    assert.ok(it.session.engine.state.players[keep.id], 'and everybody else is still here');
    assert.equal(Boolean(it.session.engine.state.players[gone.id]), false);
    // Removing a team is the one thing a host can do about a name that cannot
    // go on a projector; pressing Continue used to undo it, with a live card.
    assert.equal(it.session.engine.playerView(gone.id).kicked, true);
  } finally {
    it.done();
  }
});

test('AND AN ORGANISER IS STILL AN ORGANISER ON THE OTHER SIDE', () => {
  const it = withFileSession();
  try {
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ]);
    const client = it.session.engine.join({ name: 'The client' });
    it.session.engine.setOrganiser(client.id, true);
    assert.equal(it.session.engine.playerList().length, 0, 'organisers are in nobody\'s scoreboard');

    it.session.advanceOrder();
    const after = it.session.engine.state.players[client.id];
    assert.ok(after, 'the carry was built from playerList(), which filters organisers OUT — so they were dropped');
    assert.equal(after.organiser, true,
      'they rejoined as an ordinary contestant: onto the leaderboard, onto the projector, back channel gone');
    assert.equal(it.session.engine.playerList().length, 0);
  } finally {
    it.done();
  }
});

test('AND THE SERVER REFUSES "finish" WHILE ANOTHER PART IS QUEUED', () => {
  const it = withFileSession();
  try {
    const archived = [];
    it.session.onArchive = (record) => archived.push(record);
    it.session.launchRunningOrder([
      { kind: 'quiz', order: [{ packId: 'quiz-a', round: 0 }] },
      { kind: 'quiz', order: [{ packId: 'quiz-b', round: 0 }] },
    ], { rewards: ['A free drink'] });
    const { id } = it.session.engine.join({ name: 'Rob' });
    playQuizSegmentToRoundBoard(it.session, id);

    // `host.js` has claimed since running orders were built that the server
    // refuses this. It did not: any stale control view still draws "Stop the
    // quiz", and the night was filed two hours early with a real voucher.
    const said = it.session.run('finish', {});
    assert.equal(said.ok, false);
    assert.equal(said.reason, 'more_to_come');
    assert.equal(archived.length, 0, 'the evening was filed with two parts still queued');
    assert.notEqual(it.session.engine.state.phase, 'final');

    it.session.advanceOrder();
    assert.equal(it.session.run('finish', {}), true, 'and on the LAST part it works as it always did');
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

test('A COMPOSED NIGHT SURVIVES A RESTART — scores, teams and all', () => {
  /*
   * Every night launched from a saved show, and every night where one round
   * was unticked or two packs were mixed, is COMPOSED: `pack.id` is the
   * reserved `~tonight`, which is not a file. `pickPack()` could not load it,
   * the saved state was judged to belong to a different pack, and `boot()`
   * threw the lot away — scores, team names, everything — while the projector
   * came back reading "No quiz loaded". The order was never on disk, so the
   * night was architecturally unrecoverable; the first reconnecting phone then
   * wrote `packId: 'empty'` over `state.json` within seconds.
   *
   * On Render every push is a restart, so a docs change pushed mid-quiz ended
   * a show night.
   */
  const it = withFileSession();
  try {
    it.session.launch('quiz', 'quiz-a', {
      order: [{ packId: 'quiz-a', round: 0 }, { packId: 'quiz-b', round: 0 }],
    });
    const player = it.session.engine.join({ name: 'Quizteam Aguilera' });
    it.session.engine.state.players[player.id].score = 420;
    assert.equal(it.session.pack.id, '~tonight', 'this night is not composed');

    const saved = JSON.parse(JSON.stringify(it.session.engine.state));
    assert.ok(Array.isArray(saved.order) && saved.order.length,
      'the order has to be ON THE STATE or there is nothing to rebuild from');

    const store2 = { load: () => saved, save: () => {}, flush: () => {}, write: () => {} };
    const restarted = new Session({
      config: { dataDir: it.dir, quizDir: it.dir, bingoDir: it.dir, advertDir: it.dir },
      store: store2,
      onPush: () => {},
      now: () => Date.now(),
    });
    restarted.boot();

    assert.equal(restarted.pack.id, '~tonight', 'the composed pack was not rebuilt');
    assert.equal(restarted.pack.rounds.length, 2, 'the rounds came back short');
    assert.equal(restarted.restoredOnBoot, true, 'the night was thrown away');
    const back = restarted.engine.state.players[player.id];
    assert.ok(back, 'the team is gone');
    assert.equal(back.score, 420, 'the score is gone');
    assert.equal(back.name, 'Quizteam Aguilera');
  } finally {
    it.done();
  }
});

test('AND AN ORDINARY NIGHT WHOSE PACK HAS BEEN DELETED STILL COMES UP PLAYABLE', () => {
  /*
   * *"`boot()` always builds a game so the projector is never blank"* is
   * written three times in `session.js` and was not true: an id that would not
   * load went straight to `launcher.empty`, so the projector read "No quiz
   * loaded" with a shelf full of packs it could have used.
   */
  const it = withFileSession();
  try {
    const saved = { kind: 'quiz', packId: 'a-pack-that-has-been-deleted', players: {}, phase: 'lobby' };
    const store2 = { load: () => saved, save: () => {}, flush: () => {}, write: () => {} };
    const restarted = new Session({
      config: { dataDir: it.dir, quizDir: it.dir, bingoDir: it.dir, advertDir: it.dir },
      store: store2,
      onPush: () => {},
      now: () => Date.now(),
    });
    restarted.boot();
    assert.notEqual(restarted.pack.id, 'empty', 'the projector came back blank');
    assert.ok((restarted.pack.rounds || []).length > 0, 'the fallback pack has nothing in it');
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
