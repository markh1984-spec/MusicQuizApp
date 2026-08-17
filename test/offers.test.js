/**
 * THE ADVERT QR THAT COUNTS.
 *
 * The count is the feature — a slide with a number the morning after is a
 * media buy with a report, where a slide without one is an act of faith. What
 * is pinned here is mostly about what is NOT counted and NOT claimed, because
 * that is what keeps the number believable when a landlord checks it against
 * his till.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Offers, offerPath } from '../src/offers.js';

const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'offers-')), 'offer-opens.json');
const DAY = 86400000;
const NOW = Date.parse('2026-08-17T21:00:00Z');

test('an open is counted, per slide and per day', () => {
  const o = new Offers(tempFile());
  o.opened('crown', 'pizza', NOW);
  o.opened('crown', 'pizza', NOW);
  o.opened('crown', 'pizza', NOW - DAY);
  o.opened('crown', 'quiz-night', NOW);

  const pizza = o.forSlide('crown', 'pizza', { now: NOW });
  assert.equal(pizza.total, 3);
  assert.equal(pizza.lastNight.count, 2, 'per DAY, because "did it work on the night" is the question asked');
  assert.equal(o.forSlide('crown', 'quiz-night', { now: NOW }).total, 1, 'slides are counted apart');
});

test('nothing about the person is stored — only a count and a day', () => {
  const file = tempFile();
  const o = new Offers(file);
  o.opened('crown', 'pizza', NOW);

  const raw = fs.readFileSync(file, 'utf8');
  const written = JSON.parse(raw);
  assert.deepEqual(Object.keys(written), ['opens']);
  assert.deepEqual(written.opens['crown/pizza'], { '2026-08-17': 1 });
  // No id, no address, no fingerprint anywhere in the file. That is what keeps
  // this out of every consent conversation the photos are already in.
  assert.equal(/ip|agent|address|id"/i.test(raw), false);
});

test('counts survive a restart, because the argument is made weeks later', () => {
  const file = tempFile();
  new Offers(file).opened('crown', 'pizza', NOW);
  const again = new Offers(file);
  assert.equal(again.forSlide('crown', 'pizza', { now: NOW }).total, 1);
});

test('a corrupt or missing file is an empty count, never a crash', () => {
  const file = tempFile();
  fs.writeFileSync(file, 'not json at all');
  const o = new Offers(file);
  assert.equal(o.forSlide('crown', 'pizza', { now: NOW }).total, 0);
  // And it can still record, so a bad file heals rather than staying broken.
  o.opened('crown', 'pizza', NOW);
  assert.equal(o.forSlide('crown', 'pizza', { now: NOW }).total, 1);
});

test('the recent window is a window, so an old campaign does not flatter a new one', () => {
  const o = new Offers(tempFile());
  o.opened('crown', 'pizza', NOW - 200 * DAY);
  o.opened('crown', 'pizza', NOW);

  const seen = o.forSlide('crown', 'pizza', { days: 30, now: NOW });
  assert.equal(seen.total, 2, 'the total is everything ever');
  assert.equal(seen.recent.length, 1, 'the recent list is the last 30 days only');
});

test('a whole pack comes back at once, for a venue card', () => {
  const o = new Offers(tempFile());
  o.opened('crown', 'pizza', NOW);
  o.opened('crown', 'quiz-night', NOW);
  o.opened('dog-and-duck', 'curry', NOW);

  const crown = o.forPack('crown', { now: NOW });
  assert.deepEqual(Object.keys(crown).sort(), ['pizza', 'quiz-night']);
  assert.equal(crown.pizza.total, 1);
});

test('the QR address is short, because every character costs resolution', () => {
  // Read across a pub from a phone camera at whatever angle somebody holds it.
  assert.equal(offerPath('crown', 'pizza'), '/o/crown/pizza');
  assert.ok(offerPath('crown', 'pizza').length < 20);
  // And still a real address somebody could type, with anything odd escaped.
  assert.equal(offerPath('the crown', 'two for one'), '/o/the%20crown/two%20for%20one');
});
