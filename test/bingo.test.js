/**
 * Music bingo.
 *
 * The tests that matter most are the anti-cheat ones: a card is issued once
 * and never changes, no two teams get the same card, and a line only counts
 * if the tracks in it were genuinely played.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BingoGame, BINGO_PHASES, TARGETS, validateBingoPack, normaliseBingoPack, shuffle } from '../src/bingo.js';

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

test('a silly card size is caught', () => {
  const pack = makePack(80, 7);
  assert.match(validateBingoPack(pack).join(' '), /Card size must be 3, 4 or 5/);
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
