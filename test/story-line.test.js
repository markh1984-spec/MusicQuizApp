/**
 * THE LINE UNDER A STORY'S PHOTOGRAPH — `public/assets/story-line.js`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clockWords, storyLine } from '../public/assets/story-line.js';

const NOW = new Date(2026, 9, 1, 15).getTime(); // Thursday 1 October 2026, 3pm

test('a residency is "Every Thursday", however far off the next one is', () => {
  const venues = [{ name: 'The Station Tap, Wokingham', usualNight: 'thu' }];
  assert.equal(storyLine('The Station Tap, Wokingham', { venues, now: NOW }), 'Every Thursday');
  assert.equal(storyLine('the station tap, wokingham ', { venues, now: NOW }), 'Every Thursday', 'the name is matched loosely');
});

test('a pub with only a booking names the next one, with its time when there is one', () => {
  const venues = [{ name: 'The Crown', usualNight: '' }];
  const bookings = [{ date: '2026-10-08', venue: 'The Crown', time: '20:00' }];
  assert.equal(storyLine('The Crown', { venues, bookings, now: NOW }), 'Next quiz: Thursday 8 October · 8pm');
  const untimed = [{ date: '2026-10-10', venue: 'The Crown' }];
  assert.equal(storyLine('The Crown', { venues, bookings: untimed, now: NOW }), 'Next quiz: Saturday 10 October');
});

test('nothing true to say is nothing at all', () => {
  assert.equal(storyLine('The Crown', { venues: [{ name: 'The Crown' }], now: NOW }), '');
  assert.equal(storyLine('', { venues: [{ name: 'The Crown', usualNight: 'thu' }], now: NOW }), '');
  assert.equal(storyLine('Nowhere', { now: NOW }), '');
});

test('times are said the way a poster says them', () => {
  assert.equal(clockWords('20:00'), '8pm');
  assert.equal(clockWords('19:30'), '7.30pm');
  assert.equal(clockWords('12:00'), '12pm');
  assert.equal(clockWords('00:15'), '12.15am');
  assert.equal(clockWords('8pm'), '');
});
