/**
 * THE NIGHT'S DRINKS ARE A REMINDER, NEVER A LIMIT — `nightReminder()`.
 *
 * *"Nights shouldn't even have drinks totals in code, it should only be there
 * to remind me what the total should be."* Every game is dealt from the top
 * and pays what it pays; this sentence under the prize table is the one place
 * a night-wide number appears, and it stops nothing. So these tests pin the
 * two things it must be: TRUE, and never a warning about the venue's list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nightReminder, dealPrizes } from '../public/assets/prize-parts.js';

const quiz = (list) => ({ kind: 'quiz', list });
const cards = (list) => ({ kind: 'cards', list });
const bingo = (list) => ({ kind: 'bingo', list });

test('the reminder states the night total from what each game will pay', () => {
  assert.equal(nightReminder([quiz(['A pint', 'A half', 'Crisps']), bingo(['A pint', 'A half'])]),
    'Tonight gives out 5 drinks.');
  assert.equal(nightReminder([quiz(['A pint'])]), 'Tonight gives out 1 drink.');
});

/*
 * CARD BINGO IS SAID, NOT COUNTED. A deck pays one drink a GAME and nobody
 * knows at launch how many games there will be — a single total would be a
 * number that undercounts, read out to the person agreeing it with a landlord.
 */
test('card bingo is said as one per game rather than counted into a total', () => {
  assert.equal(
    nightReminder([quiz(['A pint', 'A half', 'Crisps']), cards(['A pint']), bingo(['A pint', 'A half'])]),
    'Tonight gives out 5 drinks, plus one for every game of card bingo you play.');
  assert.equal(nightReminder([cards(['A pint'])]),
    'Tonight gives out one drink for every game of card bingo you play.');
});

test('nothing set to be won says nothing', () => {
  assert.equal(nightReminder([]), '');
  assert.equal(nightReminder([quiz(['', '  ']), cards([])]), '');
  assert.equal(nightReminder(null), '');
});

/*
 * AND IT NEVER WARNS ABOUT THE VENUE'S LIST. While one list was shared down
 * the night, "7 prizes across the night and 6 on the venue's list" meant
 * somebody would go unpaid. Per game it means nothing: this proves it by
 * dealing a night that pays more than the list holds and showing every game
 * still gets its drinks.
 */
test('a night paying more than the venue list is not a shortfall, and is not called one', () => {
  const venue = ['A pint', 'A half', 'Crisps'];
  const [q, c, b] = dealPrizes(venue, [3, 1, 2]);
  assert.deepEqual(q, ['A pint', 'A half', 'Crisps'], 'the quiz ran dry');
  assert.deepEqual(c, ['A pint'], 'the card bingo ran dry');
  assert.deepEqual(b, ['A pint', 'A half'], 'the music bingo ran dry');
  const said = nightReminder([quiz(q), cards(c), bingo(b)]);
  assert.doesNotMatch(said, /list|venue|only|short|more than/i,
    `the reminder warned about the venue's list: "${said}"`);
});
