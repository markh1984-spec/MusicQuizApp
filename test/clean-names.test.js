/**
 * WHAT A TEAM NAME LOOKS LIKE ONCE IT LEAVES THE ROOM.
 *
 * The two things this file has to prove are opposite: that a slur cannot
 * reach a public page however it is spelled, and that a real pub team is not
 * silently renamed for living in Scunthorpe.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isCleanForPublic, publicName, publicTable, HIDDEN_LABEL } from '../src/clean-names.js';
import { cleanTeamName } from '../src/engine.js';

test('A SLUR IS HIDDEN HOWEVER IT IS SPELLED', () => {
  const hidden = [
    'Nigga', 'NIGGA', 'N1gga', 'n i g g a', 'N-I-G-G-A', 'NIGGGGGA', 'n.i.g.g.a',
    'Paki', 'p4ki', 'Faggot', 'fagg0t', 'Retards', 'Nonce',
  ];
  for (const name of hidden) {
    assert.equal(isCleanForPublic(name), false, `${name} must not publish`);
    assert.equal(publicName(name), HIDDEN_LABEL);
  }
});

test('and ordinary profanity too, including the space trick', () => {
  for (const name of ['Fuck Off', 'The Shit', 'Wankers', 'Bastards', 'Bell End',
    'Dick Head', 'Bull Shit', 'Mother Fucker', 'bellend', 'Twats']) {
    assert.equal(isCleanForPublic(name), false, `${name} must not publish`);
  }
});

test('BUT A REAL TEAM IS NEVER RENAMED — the Scunthorpe problem', () => {
  /*
   * The reason this test is longer than the one above: a filter that hides a
   * slur is easy, and a filter that ALSO leaves these alone is the actual
   * job. Every one of these contains a rude substring.
   */
  const fine = [
    'Scunthorpe Stars', 'Penistone Pals', 'Cockermouth Crew', 'Lightwater Lot',
    'The Assassins', 'Classic Rockers', 'Dickens Fans', 'Arsenal Fans',
    'Sussex Massive', 'Cocktail Hour', 'Bass Players', 'Glass Half Full',
    'Grassholme', 'Analysts', 'Buttermere Boys',
    // And the real names off the host's own screenshot.
    'meow', 'gem gem', 'Joemie', 'Laura', 'Josh', 'Alfie', 'K',
    // And the seeded fixtures, which must be unaffected by all of this.
    'Quizzly Bears', 'Norfolk Enchants', 'Trivia Newton John', 'Agatha Quiztie',
    'The Sofa Kings', 'Let Us Wine', 'Brain Trust',
  ];
  for (const name of fine) {
    assert.equal(isCleanForPublic(name), true, `${name} must publish unchanged`);
    assert.equal(publicName(name), name);
  }
});

test('an empty or odd name is not something to hide', () => {
  assert.equal(isCleanForPublic(''), true);
  assert.equal(isCleanForPublic(null), true);
  assert.equal(isCleanForPublic('   '), true);
  assert.equal(isCleanForPublic('123'), true);
  assert.equal(publicName(''), '');
});

test('THE ROW IS MASKED, NEVER DROPPED — the table must not lie about the season', () => {
  const rows = [
    { position: 1, name: 'Quizzly Bears', points: 46 },
    { position: 2, name: 'Nigga', points: 40 },
    { position: 3, name: 'Brain Trust', points: 35 },
  ];
  const out = publicTable(rows);
  assert.equal(out.length, 3, 'nobody is removed');
  assert.deepEqual(out.map((r) => r.position), [1, 2, 3], 'and nobody moves up a place');
  assert.equal(out[1].name, HIDDEN_LABEL);
  assert.equal(out[1].points, 40, 'their points are their points');
  assert.equal(out[1].nameHidden, true, 'and the row says why');
  assert.equal(out[0].name, 'Quizzly Bears', 'everybody else is untouched');
  assert.ok(!('nameHidden' in out[0]), 'and carries no marker they did not earn');
});

test('THE ROOM IS UNCHANGED — this filter is at the door, not in the venue', () => {
  /*
   * The standing decision is "no profanity filter on team names", and it
   * still holds where it was made: what a phone types is what the projector
   * shows. `cleanTeamName()` strips control characters and caps the length —
   * anti-breakage, never censorship — and this must not have crept into it.
   */
  assert.equal(cleanTeamName('Nigga'), 'Nigga');
  assert.equal(cleanTeamName('Fuck Off'), 'Fuck Off');
  assert.notEqual(cleanTeamName('Nigga'), HIDDEN_LABEL);
});

/**
 * THE MANUAL OVERRIDE — *"so we're erring on the side of caution but I can
 * override it."*
 *
 * The word list is a guess about intent; a quizmaster who was in the room is
 * not. These check that the list still decides by default, that a human beats
 * it in BOTH directions, and that nothing else about the row moves.
 */
import { hiddenForPublic } from '../src/clean-names.js';
import { teamKey } from '../src/league.js';

test('WITH NO RULING, THE WORD LIST DECIDES — the cautious default is untouched', () => {
  assert.equal(hiddenForPublic('Nigga', {}, teamKey), true);
  assert.equal(hiddenForPublic('Quizzly Bears', {}, teamKey), false);
  // And an unrelated ruling does not leak onto a different team.
  assert.equal(hiddenForPublic('Nigga', { 'quizzly bears': 'allow' }, teamKey), true);
});

test('A HUMAN OVERRULES IT IN BOTH DIRECTIONS', () => {
  /*
   * BOTH, because the list is wrong both ways. It hides "The Pen Is Mightier"
   * on the adjacent-pair pass and it publishes a spoonerism it cannot see.
   * A one-way "allow" control would have left the second with no answer.
   */
  const pen = 'The Pen Is Mightier';
  assert.equal(hiddenForPublic(pen, {}, teamKey), true, 'the list gets this one wrong');
  assert.equal(hiddenForPublic(pen, { [teamKey(pen)]: 'allow' }, teamKey), false, 'and a human fixes it');

  const stunts = 'Cunning Stunts';
  assert.equal(hiddenForPublic(stunts, {}, teamKey), false, 'the list cannot see this one');
  assert.equal(hiddenForPublic(stunts, { [teamKey(stunts)]: 'hide' }, teamKey), true, 'and a human can');
});

test('a ruling is keyed by team identity, so it follows the team all season', () => {
  // The same team, typed the four ways `teamKey()` tidies.
  const ruled = { [teamKey('The Quizzly Bears')]: 'hide' };
  for (const typed of ['The Quizzly Bears', 'quizzly bears', '  Quizzly   Bears ', 'Quizzly Bears!']) {
    assert.equal(hiddenForPublic(typed, ruled, teamKey), true, `${typed} is the same team`);
  }
  assert.equal(hiddenForPublic('Quizzly Beards', ruled, teamKey), false, 'but a different name is a different team');
});

test('AN OVERRIDDEN ROW KEEPS EVERYTHING BUT ITS NAME', () => {
  const rows = [
    { position: 1, name: 'Cunning Stunts', played: 9, wins: 3, points: 63 },
    { position: 2, name: 'The Pen Is Mightier', played: 9, wins: 1, points: 40 },
  ];
  const ruled = {
    [teamKey('Cunning Stunts')]: 'hide',
    [teamKey('The Pen Is Mightier')]: 'allow',
  };
  const out = publicTable(rows, ruled, teamKey);
  assert.equal(out[0].name, HIDDEN_LABEL, 'the spoonerism the list missed');
  assert.equal(out[0].points, 63, 'and its points are its points');
  assert.equal(out[0].position, 1, 'and it does not move');
  assert.equal(out[1].name, 'The Pen Is Mightier', 'the real team the list caught');
  assert.ok(!out[1].nameHidden);
});

test('an unknown verdict is ignored rather than becoming a third behaviour', () => {
  // This file is editable by a human in a repository, so a typo in it must
  // fall back to the list rather than mean something new.
  assert.equal(hiddenForPublic('Nigga', { nigga: 'maybe' }, teamKey), true);
  assert.equal(hiddenForPublic('Quizzly Bears', { 'quizzly bears': 'maybe' }, teamKey), false);
});
