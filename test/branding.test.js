import test from 'node:test';
import assert from 'node:assert/strict';

import { brandFor, firstName, APP_NAME } from '../src/branding.js';

test('the app is Quiztopia, and a night is somebody\'s', () => {
  assert.equal(APP_NAME, 'Quiztopia');
  assert.equal(brandFor('Mark'), "Mark's Quiztopia");
  assert.equal(brandFor('Rob'), "Rob's Quiztopia");
});

// First names only. "Mark's Quiztopia" is how he introduces himself on the mic,
// and a surname on a projector reads like a letterhead.
test('a surname never reaches the projector', () => {
  assert.equal(brandFor('Mark Harrison'), "Mark's Quiztopia");
  assert.equal(brandFor('  Rob   Smith  '), "Rob's Quiztopia");
});

/*
 * The owner's own linked quizmaster account is named "Mark (quizmaster)" by
 * `act-as`, and it is the account whose room he runs a night from with the hat
 * on. The projector must not say "Mark (quizmaster)'s Quiztopia".
 */
test('the quizmaster hat does not end up on the big screen', () => {
  assert.equal(brandFor('Mark (quizmaster)'), "Mark's Quiztopia");
});

// An account made in a hurry may have no name on it, and rob@example.com is
// still somebody telling you they are Rob.
test('an email address is better than nothing', () => {
  assert.equal(brandFor('rob@example.com'), "Rob's Quiztopia");
  assert.equal(brandFor('mark.harrison@example.com'), "Mark's Quiztopia");
  assert.equal(brandFor('mark+quizmaster@example.com'), "Mark's Quiztopia");
});

test('with nobody at all it is just the app', () => {
  assert.equal(brandFor(''), 'Quiztopia');
  assert.equal(brandFor(null), 'Quiztopia');
  assert.equal(brandFor(undefined), 'Quiztopia');
});

// BRAND_NAME is the documented way to put a different name on the whole app,
// and somebody who has set it has said what they want it called.
test('BRAND_NAME beats all of it', () => {
  assert.equal(brandFor('Mark', { override: 'The Crown Quiz League' }), 'The Crown Quiz League');
  assert.equal(brandFor('', { override: 'The Crown Quiz League' }), 'The Crown Quiz League');
});

test('a white-label deploy is one variable', () => {
  assert.equal(brandFor('Rob', { appName: 'Pub Legends' }), "Rob's Pub Legends");
});

// Said out loud far more than it is written down, and "James's" is how it is
// said. Not a style argument worth having twice, so it is pinned here.
test("a name ending in s still gets an apostrophe s", () => {
  assert.equal(brandFor('James'), "James's Quiztopia");
});

test('case is fixed up only when it was given flat', () => {
  assert.equal(firstName('mark'), 'Mark');
  assert.equal(firstName('McFly'), 'McFly');      // not "Mcfly"
  assert.equal(firstName('OConnor'), 'OConnor');
});

// A pasted-in monstrosity must not stretch the topbar off the screen.
test('a silly long name is cut down', () => {
  assert.ok(firstName('a'.repeat(200)).length <= 24);
});
