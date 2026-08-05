/**
 * Naming a quiz after what you typed.
 *
 * The theme box gets used conversationally. Typing "can I have a One Direction
 * quiz" produced a pack called "The Can I Have A One Direction Quiz Music Quiz"
 * — which is the sort of thing that ends up on a projector.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanTheme, titleCase, quizTitleFor, bingoTitleFor, themeSlug } from '../src/theme.js';

test('a request is stripped back to its subject', () => {
  assert.equal(cleanTheme('can I have a One Direction quiz'), 'One Direction');
  assert.equal(cleanTheme('make me a Britpop quiz'), 'Britpop');
  assert.equal(cleanTheme('please can you do a christmas quiz'), 'christmas');
  assert.equal(cleanTheme("I'd like a Motown round"), 'Motown');
  assert.equal(cleanTheme('give me a UK garage round'), 'UK garage');
  assert.equal(cleanTheme('write a quiz about ABBA'), 'ABBA');
  assert.equal(cleanTheme('questions about Motown'), 'Motown');
  assert.equal(cleanTheme('a quiz about the 1990s'), '1990s');
});

test('a plain theme is left alone', () => {
  assert.equal(cleanTheme('Motown'), 'Motown');
  assert.equal(cleanTheme('Christmas number ones'), 'Christmas number ones');
  assert.equal(cleanTheme('1980s music'), '1980s music');
  assert.equal(cleanTheme('the 1990s'), '1990s');
});

test('stripping never leaves you with nothing', () => {
  // If the whole thing looks like a request, keep what was typed.
  assert.equal(cleanTheme('quiz'), 'quiz');
  assert.equal(cleanTheme('a quiz'), 'a quiz');
  assert.equal(cleanTheme(''), '');
});

test('titles read like titles', () => {
  assert.equal(quizTitleFor('can I have a One Direction quiz'), 'The One Direction Quiz');
  assert.equal(quizTitleFor('the 1990s'), 'The 1990s Quiz');
  assert.equal(quizTitleFor('motown'), 'The Motown Quiz');
  assert.equal(bingoTitleFor('make me a christmas bingo'), 'Christmas Bingo');
});

test('a title is never doubled up', () => {
  // "The X Quiz Quiz" and "The The X Quiz" are both wrong.
  for (const theme of ['a quiz about the 1990s', 'the 1990s quiz', '1990s']) {
    const title = quizTitleFor(theme);
    assert.equal((title.match(/quiz/gi) || []).length, 1, `${theme} -> ${title}`);
    assert.equal(/^The The/i.test(title), false, `${theme} -> ${title}`);
  }
});

test('bands that shout keep shouting', () => {
  assert.equal(titleCase('ABBA'), 'ABBA');
  assert.equal(titleCase('UK garage'), 'UK Garage');
  assert.equal(titleCase('NWA and Public Enemy'), 'NWA and Public Enemy');
});

test('small joining words stay small in the middle of a title', () => {
  assert.equal(titleCase('songs of the sea'), 'Songs of the Sea');
  assert.equal(titleCase('rock and roll'), 'Rock and Roll');
  // ...but not at the start or end of a title, where lowercase reads wrong
  assert.equal(titleCase('the best of'), 'The Best Of');
  assert.equal(titleCase('of monsters and men'), 'Of Monsters and Men');
});

test('the filename comes from the subject, not the request', () => {
  assert.equal(themeSlug('can I have a One Direction quiz'), 'one-direction');
  assert.equal(themeSlug('the 1990s'), '1990s');
  assert.equal(themeSlug('Christmas number ones'), 'christmas-number-ones');
  assert.equal(themeSlug('!!!'), 'quiz');
});

test('a very long theme still makes a sane filename', () => {
  const slug = themeSlug('a quiz about the very best british guitar music of the nineteen nineties and beyond');
  assert.ok(slug.length <= 40, slug);
  assert.equal(/^-|-$/.test(slug), false, slug);
});
