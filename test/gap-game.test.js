/**
 * EVERY GAP OFFERS A PHOTO AND A GAME, AND A GAP AFTER THE DOORS PLAYS ONE
 * GAME PICKED FOR IT — 8 October 2026: *"every time there needs to be a photo
 * upload and a random game."*
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { breakIdNow, breakNow, gapGame, offersGame, offersPhotos } from '../public/assets/break-parts.js';
import { arcadeFields } from '../src/arcade.js';
import { BingoGame } from '../src/bingo.js';

const LIST = ['maze', 'rally', 'tailback', 'quickdraw', 'lastorders'];

test('a bingo round whose LAST prize has gone is a gap; a win with more to come is not', () => {
  const base = { phase: 'won', stages: [1, 'full'], round: 2 };
  assert.equal(breakIdNow({ ...base, stageIndex: 0 }), '', 'play on for the house — the card is still live');
  assert.equal(breakIdNow({ ...base, stageIndex: 1 }), 'p0:b2');
  assert.equal(breakIdNow({ ...base, stageIndex: 1, orderPos: 3 }), 'p3:b2');
  assert.equal(breakIdNow({ phase: 'playing', stages: ['full'], stageIndex: 0 }), '', 'never while songs are being called');
  const gap = breakNow({ ...base, stageIndex: 1 });
  assert.equal(offersGame(gap), true);
  assert.equal(offersPhotos(gap), true);
});

test('the game for a gap is the same on every ask, and two gaps in a row differ', () => {
  const at = (roundIndex, gameSeed = 77) => gapGame({ phase: 'round_board', roundIndex, gameSeed }, LIST);
  assert.equal(at(0), at(0), 'every phone, every reload');
  assert.notEqual(at(0), at(1), 'it steps along the list');
  assert.ok(LIST.includes(at(2)));
  const seeds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => at(0, seed)));
  assert.ok(seeds.size > 1, 'a different night starts somewhere else');
});

test('the doors keep the chooser, and a game the host PINNED stays pinned', () => {
  assert.equal(gapGame({ phase: 'lobby', gameSeed: 9 }, LIST), '', 'the doors: the room chooses');
  assert.equal(gapGame({ phase: 'round_board', roundIndex: 0, gameSeed: 9 }, null), '', 'pinned: no list, no pick');
  assert.equal(gapGame({ phase: 'round_board', roundIndex: 0, gameSeed: 9 }, ['rally']), '', 'one game is no choice');
  assert.equal(gapGame({ phase: 'question', gameSeed: 9 }, LIST), '', 'not a gap at all');
});

test('at a gap the phone is handed ONE game and no chooser; at the doors, the chooser', () => {
  const gap = arcadeFields({ phase: 'round_board', roundIndex: 1, gameSeed: 5, lobbyGame: 'maze', lobbyGames: LIST });
  assert.ok(LIST.includes(gap.lobbyGame));
  assert.equal(gap.lobbyGames, undefined, 'straight into a game');
  assert.equal(gap.gameSeed, 5);
  const doors = arcadeFields({ phase: 'lobby', gameSeed: 5, lobbyGame: 'maze', lobbyGames: LIST });
  assert.deepEqual(doors.lobbyGames, LIST);
  assert.equal(doors.lobbyGame, 'maze');
});

test('a bingo phone at the gap gets the game and can bank a score there', () => {
  let now = 1_700_000_000_000;
  const game = new BingoGame({
    pack: { id: 'b', title: 'B', cardSize: 3, tracks: Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, title: `T${i}`, artist: 'A' })) },
    now: () => (now += 1000), random: () => 0.3,
  });
  game.state.stages = ['full'];
  game.syncTarget();
  game.state.lobbyGames = LIST;
  game.start();
  const a = game.join({ name: 'A' });
  assert.equal(game.playerView(a.id).gap, undefined, 'mid-round: no gap');
  assert.equal(game.arcadeScore(a.id, 10).ok, false, 'and no score');
  for (const [i, id] of game.state.players[a.id].card.entries()) {
    game.call(id);
    game.mark({ playerId: a.id, index: i, marked: true });
  }
  game.payCard(a.id);
  const view = game.playerView(a.id);
  assert.deepEqual(view.gap, { photos: true, game: true });
  assert.ok(LIST.includes(view.lobbyGame));
  assert.equal(game.arcadeScore(a.id, 10, view.lobbyGame).ok, true);
});
