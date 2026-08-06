/**
 * Music bingo.
 *
 * The tests that matter most are the anti-cheat ones: a card is issued once
 * and never changes, no two teams get the same card, and a line only counts
 * if the tracks in it were genuinely played.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BingoGame, BINGO_PHASES, TARGETS, validateBingoPack, normaliseBingoPack, shuffle,
  cardLines, cardShape, shapeLabel, minimumTracks, CARD_SHAPES,
  stagePlan, maxPrizes, stageLabel, DEFAULT_STAGES,
} from '../src/bingo.js';

const START = 1_700_000_000_000;

function makePack(trackCount = 40, cardSize = 4) {
  return {
    id: 'test-bingo',
    title: 'Test Bingo',
    cardSize,
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: `t${i + 1}`,
      title: `Track ${i + 1}`,
      artist: `Artist ${i + 1}`,
    })),
  };
}

function makeGame(pack = makePack()) {
  const time = { now: START };
  const game = new BingoGame({ pack, now: () => time.now });
  return { game, advance: (ms) => { time.now += ms; } };
}

/** Call every track on a player's winning line for them, and mark it. */
function winLine(game, player, lineIndex = 0) {
  const line = game.lines()[lineIndex];
  for (const i of line) {
    game.call(player.card[i]);
    game.mark({ playerId: player.id, index: i, marked: true });
  }
  return line;
}

// ------------------------------------------------------------------- cards

test('a card has one square per grid position and no repeats', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Sofa King Good' });
  assert.equal(p.card.length, 16);
  assert.equal(new Set(p.card).size, 16, 'no track appears twice on one card');
  for (const id of p.card) assert.ok(game.track(id), `${id} is a real track`);
});

test('ANTI-CHEAT: rejoining returns the identical card, never a new one', () => {
  const { game } = makeGame();
  const first = game.join({ name: 'Sofa King Good' });
  const cardBefore = [...first.card];

  // Refresh, phone locks, reopens the link, rejoins with a different name.
  const again = game.join({ playerId: first.id, name: 'Sofa King Good' });
  assert.deepEqual(again.card, cardBefore);

  const renamed = game.join({ playerId: first.id, name: 'Changed Our Name' });
  assert.deepEqual(renamed.card, cardBefore, 'renaming does not reroll the card');

  // Even after tracks have been called and marks made.
  game.call('t1');
  game.mark({ playerId: first.id, index: 0, marked: true });
  const midGame = game.join({ playerId: first.id, name: 'Sofa King Good' });
  assert.deepEqual(midGame.card, cardBefore);
  assert.equal(midGame.marks[0], true, 'and their marks are still there');
});

test('ANTI-CHEAT: there is no way to ask for a different card', () => {
  const { game } = makeGame();
  // The whole public surface of the game — anything a phone could reach.
  const phoneCanCall = ['join', 'mark', 'claim', 'touch'];
  const rerollers = Object.getOwnPropertyNames(BingoGame.prototype)
    .filter((m) => /regenerate|reroll|newCard|swapCard|shuffleCard/i.test(m));
  assert.deepEqual(rerollers, [], 'no card-rerolling method exists at all');

  // And the methods a phone CAN reach never change an existing card.
  const p = game.join({ name: 'Test' });
  const before = [...p.card];
  for (const method of phoneCanCall) {
    try { game[method]({ playerId: p.id, index: 0, name: 'Test' }); } catch { /* fine */ }
  }
  assert.deepEqual(game.state.players[p.id].card, before);
});

test('every team in the room gets a different card', () => {
  const { game } = makeGame(makePack(40, 4));
  const cards = new Set();
  for (let i = 0; i < 60; i++) {
    const p = game.join({ name: `Team ${i + 1}` });
    cards.add(p.card.join('|'));
  }
  assert.equal(cards.size, 60, 'sixty teams, sixty different cards');
});

test('the same player id always rebuilds the same card', () => {
  const a = makeGame().game;
  const b = makeGame().game;
  const cardA = a.join({ playerId: 'abcdef123456', name: 'X' }).card;
  const cardB = b.join({ playerId: 'abcdef123456', name: 'X' }).card;
  assert.deepEqual(cardA, cardB);
});

test('a new round issues fresh cards to everyone who is already in', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Sofa King Good' });
  const oldCard = [...p.card];
  game.mark({ playerId: p.id, index: 3, marked: true });

  game.newRound();
  const now = game.state.players[p.id];
  assert.notDeepEqual(now.card, oldCard, 'a genuinely new card');
  assert.equal(now.marks.every((m) => m === false), true, 'and a clean slate');
  assert.equal(game.state.called.length, 0);
  assert.equal(now.name, 'Sofa King Good', 'but the same team');
});

test('the shuffle is reproducible for a given seed and changes with it', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  assert.deepEqual(shuffle(list, 42), shuffle(list, 42));
  assert.notDeepEqual(shuffle(list, 42), shuffle(list, 43));
  assert.deepEqual([...shuffle(list, 42)].sort(), [...list].sort(), 'nothing lost or invented');
});

// ------------------------------------------------------------------ calling

test('calling a track records it, and calling it twice does not', () => {
  const { game } = makeGame();
  assert.equal(game.call('t1'), true);
  assert.equal(game.call('t1'), false);
  assert.equal(game.call('nope'), false);
  assert.deepEqual(game.state.called, ['t1']);
});

test('the first call starts the game on its own', () => {
  const { game } = makeGame();
  assert.equal(game.state.phase, BINGO_PHASES.LOBBY);
  game.call('t1');
  assert.equal(game.state.phase, BINGO_PHASES.PLAYING);
});

test('a mis-tapped call can be taken back', () => {
  const { game } = makeGame();
  game.call('t1');
  game.call('t2');
  assert.equal(game.undoLastCall(), true);
  assert.deepEqual(game.state.called, ['t1']);
  assert.equal(game.uncall('t1'), true);
  assert.deepEqual(game.state.called, []);
  assert.equal(game.undoLastCall(), false);
});

// ------------------------------------------------------------------ marking

test('a player can mark and unmark their own squares', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  assert.equal(game.mark({ playerId: p.id, index: 5 }).ok, true);
  assert.equal(game.state.players[p.id].marks[5], true);
  game.mark({ playerId: p.id, index: 5 });
  assert.equal(game.state.players[p.id].marks[5], false);
});

test('nonsense marks are refused', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  assert.equal(game.mark({ playerId: p.id, index: 99 }).reason, 'bad_square');
  assert.equal(game.mark({ playerId: p.id, index: -1 }).reason, 'bad_square');
  assert.equal(game.mark({ playerId: p.id, index: 'two' }).reason, 'bad_square');
  assert.equal(game.mark({ playerId: 'ghost', index: 0 }).reason, 'unknown_player');
});

// ------------------------------------------------------------------- claims

test('a line of tracks you actually played is a win', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Sofa King Good' });
  winLine(game, p);
  const result = game.claim(p.id);
  assert.equal(result.valid, true);
  assert.equal(result.pattern, 'line');
  assert.equal(game.state.phase, BINGO_PHASES.WON);
  assert.deepEqual(game.state.winners.line, [p.id]);
});

test('nobody can claim before you have started', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Keen' });
  for (const i of game.lines()[0]) game.mark({ playerId: p.id, index: i, marked: true });
  assert.deepEqual(game.claim(p.id), { ok: false, reason: 'not_playing' });
  assert.equal(game.state.claims.length, 0);
});

test('ANTI-CHEAT: marking squares you never heard is a false alarm', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Chancers' });
  game.start();
  // Mark a whole line without a single track being played.
  for (const i of game.lines()[0]) game.mark({ playerId: p.id, index: i, marked: true });

  const result = game.claim(p.id);
  assert.equal(result.valid, false);
  assert.equal(game.state.players[p.id].falseCalls, 1);
  assert.deepEqual(game.state.winners.line, []);
  assert.notEqual(game.state.phase, BINGO_PHASES.WON);
});

test('ANTI-CHEAT: one unplayed track in the line is enough to void it', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'So Close' });
  const line = game.lines()[0];
  // Play and mark all but the last.
  for (const i of line.slice(0, -1)) {
    game.call(p.card[i]);
    game.mark({ playerId: p.id, index: i, marked: true });
  }
  // Mark the last one anyway, without it having been played.
  game.mark({ playerId: p.id, index: line[line.length - 1], marked: true });

  assert.equal(game.claim(p.id).valid, false);
  assert.equal(game.squaresAway(game.state.players[p.id]), 1);
});

test('a played track they forgot to mark does not win it for them', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Not Paying Attention' });
  for (const i of game.lines()[0]) game.call(p.card[i]);
  // Called, but never tapped.
  assert.equal(game.claim(p.id).valid, false);
});

test('the BINGO button is only live once they have marked a full line', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  assert.equal(game.playerView(p.id).canClaim, false);
  for (const i of game.lines()[0]) game.mark({ playerId: p.id, index: i, marked: true });
  assert.equal(game.playerView(p.id).canClaim, true);
});

test('columns and diagonals count, not just rows', () => {
  for (const lineIndex of [0, 4, 8, 9]) {
    const { game } = makeGame();
    const p = game.join({ name: 'X' });
    winLine(game, p, lineIndex);
    assert.equal(game.claim(p.id).valid, true, `line ${lineIndex}`);
  }
});

test('after a line, you can play on for a full house', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  winLine(game, p);
  game.claim(p.id);

  game.playOn(TARGETS.FULL);
  assert.equal(game.state.target, TARGETS.FULL);
  assert.equal(game.state.phase, BINGO_PHASES.PLAYING);
  // The line they already had is no longer enough.
  assert.equal(game.claim(p.id).valid, false);

  for (let i = 0; i < p.card.length; i++) {
    game.call(p.card[i]);
    game.mark({ playerId: p.id, index: i, marked: true });
  }
  const full = game.claim(p.id);
  assert.equal(full.valid, true);
  assert.equal(full.pattern, 'full');
});

test('every claim is recorded, right or wrong', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Chancers' });
  game.start();
  game.claim(p.id);
  winLine(game, p);
  game.claim(p.id);
  assert.equal(game.state.claims.length, 2);
  assert.equal(game.state.claims[0].valid, false);
  assert.equal(game.state.claims[1].valid, true);
});

test('how far away a team is, is worked out honestly', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  assert.equal(game.squaresAway(game.state.players[p.id]), 4);
  const line = game.lines()[0];
  for (const i of line.slice(0, 3)) {
    game.call(p.card[i]);
    game.mark({ playerId: p.id, index: i, marked: true });
  }
  assert.equal(game.squaresAway(game.state.players[p.id]), 1);
  assert.equal(game.onesAway(), 1);
});

// -------------------------------------------------------------------- views

test('the big screen is never sent the uncalled tracks', () => {
  const { game } = makeGame();
  game.join({ name: 'X' });
  game.call('t1');
  const view = JSON.stringify(game.screenView());
  assert.ok(view.includes('Track 1'), 'what you played is shown');
  assert.equal(view.includes('Track 40'), false, 'what you have not played is not');
  assert.equal(view.includes('"tracks"'), false, 'the whole list never goes to the room');
});

test('a phone is sent its own card and nobody else s', () => {
  const { game } = makeGame();
  const a = game.join({ name: 'Team A' });
  const b = game.join({ name: 'Team B' });
  const view = game.playerView(a.id);
  assert.equal(view.card.length, 16);
  const asText = JSON.stringify(view);
  assert.equal(asText.includes('Team B'), false);
  // None of B's card squares that A does not also have.
  const aTitles = new Set(view.card.map((c) => c.title));
  const bOnly = game.state.players[b.id].card
    .map((id) => game.track(id).title)
    .filter((t) => !aTitles.has(t));
  for (const title of bOnly) {
    assert.equal(asText.includes(`"${title}"`), false, `${title} leaked from another team's card`);
  }
});

test('the caller gets the full track list and who is closest', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  winLine(game, p);
  const view = game.hostView();
  assert.equal(view.tracks.length, 40);
  assert.equal(view.tracks.filter((t) => t.called).length, 4);
  assert.equal(view.players[0].name, 'X');
  assert.equal(view.players[0].away, 0);
});

test('a removed team is told, so their phone can start again', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  game.removePlayer(p.id);
  assert.equal(game.playerView(p.id).kicked, true);
});

test('a phone the server has forgotten is asked back, and gets its card back', () => {
  // The worst version of this bug: half an hour of marked squares thrown away
  // because the app restarted, with no way to re-tap songs already played.
  const first = makeGame().game;
  const p = first.join({ playerId: 'abcdef123456', name: 'X' });
  const cardBefore = [...p.card];

  const fresh = makeGame().game;
  const view = fresh.playerView(p.id);
  assert.equal(view.rejoin, true);
  assert.equal(view.kicked, undefined);

  // Cards are derived from the player id and the pack, so rejoining rebuilds
  // the same one rather than handing out a fresh card mid-round.
  const back = fresh.join({ playerId: p.id, name: 'X' });
  assert.deepEqual(back.card, cardBefore);
});

test('a removed bingo team stays told, and can still come back', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'X' });
  game.removePlayer(p.id);
  assert.equal(game.playerView(p.id).kicked, true);

  game.join({ playerId: p.id, name: 'X' });
  assert.equal(game.playerView(p.id).kicked, undefined);
});

// -------------------------------------------------------------- persistence

test('a crash mid-game comes back with the same cards and the same marks', () => {
  const { game } = makeGame();
  const p = game.join({ name: 'Sofa King Good' });
  game.call(p.card[0]);
  game.call(p.card[1]);
  game.mark({ playerId: p.id, index: 0, marked: true });

  const onDisk = JSON.parse(JSON.stringify(game.state));
  const revived = new BingoGame({ pack: makePack(), state: onDisk, now: () => START + 1000 });

  assert.deepEqual(revived.state.players[p.id].card, p.card, 'same card after a restart');
  assert.equal(revived.state.players[p.id].marks[0], true);
  assert.deepEqual(revived.state.called, [p.card[0], p.card[1]]);
  // And rejoining still does not reroll it.
  assert.deepEqual(revived.join({ playerId: p.id, name: 'Sofa King Good' }).card, p.card);
});

// --------------------------------------------------------------- pack checks

test('a pack without enough tracks for the card size is caught', () => {
  assert.match(validateBingoPack(makePack(9, 4)).join(' '), /at least 16/);
  assert.match(validateBingoPack(makePack(20, 4)).join(' '), /Add more/);
  assert.deepEqual(validateBingoPack(makePack(40, 4)), []);
});

test('a duplicate track in a pack is caught', () => {
  const pack = makePack(40);
  pack.tracks[5] = { id: 't6', title: 'Track 1', artist: 'Artist 1' };
  assert.match(validateBingoPack(pack).join(' '), /appears twice/);
});

test('a card too big to read on a phone is caught', () => {
  const pack = makePack(80, 7); // 49 squares
  assert.match(validateBingoPack(pack).join(' '), /too many to read on a phone/);
});

test('a card shape that is not a shape is caught', () => {
  assert.match(validateBingoPack({ ...makePack(40), cardRows: 1, cardCols: 3 }).join(' '), /between 2 and 10/);
});

test('normalising fills in ids and trims the shape', () => {
  const pack = normaliseBingoPack({ title: 'X', tracks: [{ title: ' Billie Jean ', artist: ' MJ ' }] }, 'fallback');
  assert.equal(pack.id, 'fallback');
  assert.equal(pack.cardSize, 4);
  assert.deepEqual(pack.tracks[0], { id: 't1', title: 'Billie Jean', artist: 'MJ' });
});

test('the bingo pack that ships with the app is valid', async () => {
  const fs = await import('node:fs');
  const url = new URL('../bingo/eighties-bingo.json', import.meta.url);
  const pack = JSON.parse(fs.readFileSync(url, 'utf8'));
  assert.deepEqual(validateBingoPack(pack), []);
});

/*
 * The same one-line "where are we" the quiz engine has, so the console panel
 * reads the same whichever game is on.
 */
test('where() counts the tracks played and says what they are going for', () => {
  const { game } = makeGame();
  assert.match(game.where(), /lobby/i);

  game.join({ name: 'Mum' });
  game.start();
  assert.equal(game.where(), 'Round 1 — 0 of 40 played, going for a line (prize 1 of 2)');

  game.call('t1');
  game.call('t2');
  assert.equal(game.where(), 'Round 1 — 2 of 40 played, going for a line (prize 1 of 2)');

  game.finish();
  assert.match(game.where(), /finished/i);
});

// -------------------------------------------------------------- card shapes

/*
 * Strips: 3 across and 8 down, the shape of a paper bingo ticket and the shape
 * of a phone.
 *
 * The rule that makes it a fair game is that every winning line is the same
 * length. On a strip that means the LONG way only — win on the eight, never on
 * the three, or somebody calls in the first few tracks while everybody else
 * needs eight.
 */
test('a strip wins on the long way, never the short way', () => {
  const shape = { rows: 8, cols: 3 };
  const lines = cardLines(shape);
  assert.equal(lines.length, 3, 'three columns of eight, and nothing else');
  for (const line of lines) assert.equal(line.length, 8);
  // No line is a row of three, and none is a diagonal.
  const flat = lines.flat().sort((a, b) => a - b);
  assert.deepEqual(flat, Array.from({ length: 24 }, (_, i) => i), 'every square is on exactly one line');
});

test('a square card is exactly as it always was', () => {
  const lines = cardLines({ rows: 4, cols: 4 });
  assert.equal(lines.length, 10, '4 rows + 4 columns + 2 diagonals');
  assert.deepEqual(lines[0], [0, 1, 2, 3]);
  assert.deepEqual(lines[4], [0, 4, 8, 12]);
  assert.deepEqual(lines[8], [0, 5, 10, 15], 'the diagonal');
  assert.deepEqual(lines[9], [3, 6, 9, 12], 'and the other one');
});

test('turning a strip on its side gives the same game', () => {
  const tall = cardLines({ rows: 8, cols: 3 });
  const wide = cardLines({ rows: 3, cols: 8 });
  assert.equal(wide.length, 3);
  for (const line of wide) assert.equal(line.length, 8);
  assert.equal(tall.length, wide.length, 'three lines of eight either way round');
});

test('a pack still says its shape the old way, and is read the same', () => {
  assert.deepEqual(cardShape({ cardSize: 5 }), { rows: 5, cols: 5 });
  assert.deepEqual(cardShape({ cardRows: 8, cardCols: 3 }), { rows: 8, cols: 3 });
  assert.deepEqual(cardShape({}), { rows: 4, cols: 4 }, 'the default is unchanged');
});

test('a strip card is dealt the right number of squares and wins properly', () => {
  const pack = { ...makePack(42), cardRows: 8, cardCols: 3 };
  delete pack.cardSize;
  const { game } = makeGame(pack);
  const p = game.join({ name: 'Sharon' });
  assert.equal(p.card.length, 24);
  assert.equal(p.marks.length, 24);

  // Mark and call a full column of eight.
  const line = game.lines()[0];
  assert.equal(line.length, 8);
  for (const i of line) {
    game.call(p.card[i]);
    game.mark({ playerId: p.id, index: i, marked: true });
  }
  const result = game.claim(p.id);
  assert.equal(result.valid, true);
  assert.equal(result.pattern, 'line');
});

test('a row of three on a strip is NOT a win', () => {
  const pack = { ...makePack(42), cardRows: 8, cardCols: 3 };
  delete pack.cardSize;
  const { game } = makeGame(pack);
  const p = game.join({ name: 'Chancer' });
  // The top row: squares 0, 1, 2 — three across.
  for (const i of [0, 1, 2]) {
    game.call(p.card[i]);
    game.mark({ playerId: p.id, index: i, marked: true });
  }
  const result = game.claim(p.id);
  assert.equal(result.valid, false, 'three across is not a line on a strip');
  assert.equal(game.state.players[p.id].falseCalls, 1);
});

test('the shape is said one way round only, so nobody has to guess', () => {
  assert.equal(shapeLabel({ rows: 4, cols: 4 }), '4×4');
  assert.equal(shapeLabel({ rows: 8, cols: 3 }), '3 across × 8 down');
  assert.equal(shapeLabel(5), '5×5');
});

test('every offered shape is playable with a normal track list', () => {
  for (const shape of CARD_SHAPES) {
    const squares = shape.rows * shape.cols;
    assert.ok(squares <= 36, `${shapeLabel(shape)} is ${squares} squares`);
    assert.ok(minimumTracks(shape) <= 42, `${shapeLabel(shape)} wants ${minimumTracks(shape)} tracks, more than a round has`);
    // Every line the same length — the thing that makes it fair.
    const lines = cardLines(shape);
    const lengths = new Set(lines.map((l) => l.length));
    assert.equal(lengths.size, 1, `${shapeLabel(shape)} has lines of different lengths: ${[...lengths]}`);
  }
});

test('a strip survives a crash — the shape is in the game, not the pack', () => {
  // The shape is chosen at launch and can differ from the file. It lived only
  // on the in-memory pack at first, so a restart brought the game back as
  // whatever the pack said: twenty-four squares on every phone and a 4x4's
  // idea of a line on the server, which handed a player a win they had not
  // got. It is written into the state now, which is what gets saved.
  const pack = { ...makePack(42), cardRows: 8, cardCols: 3 };
  delete pack.cardSize;
  const { game } = makeGame(pack);
  const p = game.join({ name: 'Sharon' });
  const col = game.lines()[0];
  for (const i of col.slice(0, 7)) {
    game.call(p.card[i]);
    game.mark({ playerId: p.id, index: i, marked: true });
  }
  assert.equal(game.squaresAway(game.state.players[p.id]), 1);

  // The crash: the state goes to disk and comes back, but the pack on disk
  // still says what it always said.
  const onDisk = JSON.parse(JSON.stringify(game.state));
  const fileSays = makePack(42); // a plain 4x4
  const revived = new BingoGame({ pack: fileSays, state: onDisk, now: () => START });

  assert.deepEqual(revived.shape, { rows: 8, cols: 3 }, 'still a strip');
  assert.equal(revived.squareCount, 24);
  assert.equal(revived.lines().length, 3);
  assert.equal(revived.squaresAway(revived.state.players[p.id]), 1, 'and still one away, not a winner');
  assert.equal(revived.claim(p.id).valid, false, 'nobody has won yet');
});

test('a game saved before shapes existed still comes back square', () => {
  const { game } = makeGame();
  const onDisk = JSON.parse(JSON.stringify(game.state));
  delete onDisk.cardRows;
  delete onDisk.cardCols;
  delete onDisk.cardSize;
  const revived = new BingoGame({ pack: makePack(), state: onDisk, now: () => START });
  assert.deepEqual(revived.shape, { rows: 4, cols: 4 });
});

// --------------------------------------------------------------- the prizes

/*
 * More than one winner in a round: a line, then two lines, then a full house.
 * Traditional pub bingo, and the thing that turns one prize into three.
 *
 * The risk in staged prizes is a claim being judged against the wrong stage —
 * either a player winning early on a target nobody announced, or the game
 * refusing a genuine win. Both end in an argument in front of a room.
 */
function stagedGame(prizes = 3, pack = makePack(40)) {
  const { game } = makeGame(pack);
  game.state.stages = stagePlan(prizes);
  game.state.stageIndex = 0;
  game.syncTarget();
  return game;
}

/** Call and mark every square of the player's nth line. */
function completeLine(game, player, n) {
  for (const i of game.lines()[n]) {
    game.call(player.card[i]);
    game.mark({ playerId: player.id, index: i, marked: true });
  }
}

test('the default is what it always was — a line, then a full house', () => {
  const { game } = makeGame();
  assert.deepEqual(game.stages, DEFAULT_STAGES);
  assert.deepEqual(game.stages, [1, 'full']);
  assert.equal(game.state.target, TARGETS.LINE);
});

test('three prizes are a line, two lines, then a full house', () => {
  assert.deepEqual(stagePlan(1), ['full']);
  assert.deepEqual(stagePlan(2), [1, 'full']);
  assert.deepEqual(stagePlan(3), [1, 2, 'full']);
  assert.deepEqual(stagePlan(4), [1, 2, 3, 'full']);
});

test('one line does not win the two-line prize', () => {
  const game = stagedGame(3);
  const p = game.join({ name: 'Keen' });
  game.start();
  completeLine(game, p, 0);
  assert.equal(game.claim(p.id).valid, true, 'the first prize is one line');

  game.playOn();
  assert.equal(game.stage, 2, 'now playing for two lines');
  // The same card, the same one line — and it must not win again.
  assert.equal(game.claim(p.id).valid, false);
  assert.equal(game.state.players[p.id].falseCalls, 1);

  completeLine(game, p, 1);
  assert.equal(game.claim(p.id).valid, true, 'two lines wins the second prize');
});

test('the prizes are won in order and each has its own winner', () => {
  const game = stagedGame(3);
  const a = game.join({ name: 'Sharon' });
  const b = game.join({ name: 'Dave' });
  game.start();

  completeLine(game, a, 0);
  game.claim(a.id);
  game.playOn();
  completeLine(game, b, 0);
  completeLine(game, b, 1);
  game.claim(b.id);

  const prizes = game.hostView().prizes;
  assert.deepEqual(prizes.map((x) => x.label), ['a line', '2 lines', 'a full house']);
  assert.equal(prizes[0].winner, 'Sharon');
  assert.equal(prizes[1].winner, 'Dave');
  assert.equal(prizes[2].winner, null, 'the full house is still to play for');
});

test('there is nothing to play on to after the last prize', () => {
  const game = stagedGame(2);
  const p = game.join({ name: 'X' });
  game.start();
  completeLine(game, p, 0);
  game.claim(p.id);
  assert.equal(game.playOn(), true, 'on to the full house');
  assert.equal(game.stage, TARGETS.FULL);
  assert.equal(game.playOn(), false, 'and no further — that was the last one');
  assert.equal(game.stage, TARGETS.FULL, 'it did not wrap round and restart the round');
});

test('"how many to go" counts to the prize in play, not to one line', () => {
  const game = stagedGame(3);
  const p = game.join({ name: 'X' });
  game.start();
  const before = game.squaresAway(game.state.players[p.id]);
  completeLine(game, p, 0);
  assert.equal(game.squaresAway(game.state.players[p.id]), 0, 'one line, one prize');

  game.playOn();
  const away = game.squaresAway(game.state.players[p.id]);
  assert.ok(away > 0, 'two lines is further away than one');
  assert.ok(away < before, 'but nearer than starting from nothing');
});

test('crossing lines are counted together, not one after the other', () => {
  // Two lines that share a square are cheaper together than separately, and a
  // player told "8 to go" when it is really 7 will not press the button.
  const game = stagedGame(3);
  const p = game.join({ name: 'X' });
  game.start();
  const player = game.state.players[p.id];
  game.playOn(); // straight to the two-line prize
  assert.equal(game.stage, 2);

  const lines = game.lines();
  const cheapest = Math.min(...lines.flatMap((a, i) =>
    lines.slice(i + 1).map((b) => new Set([...a, ...b]).size)));
  assert.equal(game.squaresAway(player), cheapest,
    'the smallest pair of lines, counted as a set rather than added up');
});

test('a new round puts the prizes back to the first one', () => {
  const game = stagedGame(3);
  const p = game.join({ name: 'X' });
  game.start();
  completeLine(game, p, 0);
  game.claim(p.id);
  game.playOn();
  assert.equal(game.state.stageIndex, 1);

  game.newRound();
  assert.equal(game.state.stageIndex, 0);
  assert.equal(game.stage, 1);
  assert.deepEqual(game.hostView().prizes.map((x) => x.winner), [null, null, null]);
});

test('the prizes survive a crash, like the shape does', () => {
  const game = stagedGame(3);
  const p = game.join({ name: 'X' });
  game.start();
  completeLine(game, p, 0);
  game.claim(p.id);
  game.playOn();

  const onDisk = JSON.parse(JSON.stringify(game.state));
  const revived = new BingoGame({ pack: makePack(40), state: onDisk, now: () => START });
  assert.deepEqual(revived.stages, [1, 2, 'full']);
  assert.equal(revived.stage, 2, 'still playing for two lines');
  assert.equal(revived.hostView().prizes[0].winner, 'X', 'and the first prize is still won');
});

test('a game saved before prizes existed still plays line then full house', () => {
  const { game } = makeGame();
  const onDisk = JSON.parse(JSON.stringify(game.state));
  delete onDisk.stages;
  delete onDisk.stageIndex;
  const revived = new BingoGame({ pack: makePack(), state: onDisk, now: () => START });
  assert.deepEqual(revived.stages, [1, 'full']);
  assert.equal(revived.stage, 1);
});

test('a card is only offered as many prizes as it has lines to give', () => {
  // A 3-across strip has three lines, and finishing all three IS a full house,
  // so a third line prize would be the same prize twice.
  assert.equal(maxPrizes({ rows: 8, cols: 3 }), 3);
  assert.equal(maxPrizes({ rows: 5, cols: 5 }), 5);
  for (const shape of CARD_SHAPES) {
    const plan = stagePlan(maxPrizes(shape));
    const lineStages = plan.filter((x) => x !== 'full');
    assert.ok(Math.max(0, ...lineStages) < cardLines(shape).length,
      `${shapeLabel(shape)}: the last line prize must land before the full house`);
  }
});

test('the wording is the same everywhere it is said', () => {
  assert.equal(stageLabel(1), 'a line');
  assert.equal(stageLabel(2), '2 lines');
  assert.equal(stageLabel('full'), 'a full house');
});

test('a player who has won one prize can still see how far off the next is', () => {
  // With three prizes the first winner keeps playing. Their phone used to say
  // "You got it. Well done." for the rest of the round, so the one person who
  // had proved they were paying attention was the only one who could no longer
  // see how close they were.
  const game = stagedGame(3);
  const p = game.join({ name: 'Sharon' });
  game.start();
  completeLine(game, p, 0);
  game.claim(p.id);
  assert.equal(game.playerView(p.id).won, true, 'while the win is on the projector');

  game.playOn();
  const view = game.playerView(p.id);
  assert.equal(view.won, false, 'but not once the next prize is in play');
  assert.deepEqual(view.yourPrizes, ['a line'], 'it still remembers what they won');
  assert.ok(view.you.squaresAway > 0, 'and tells them how far off the next one is');
});

test('somebody else winning does not say "you got it" on your phone', () => {
  const game = stagedGame(2);
  const a = game.join({ name: 'Sharon' });
  const b = game.join({ name: 'Dave' });
  game.start();
  completeLine(game, a, 0);
  game.claim(a.id);
  assert.equal(game.playerView(a.id).won, true);
  assert.equal(game.playerView(b.id).won, false);
  assert.deepEqual(game.playerView(b.id).yourPrizes, []);
});
