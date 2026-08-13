/**
 * The site carries a COPY of the mark, and it has to stay a copy.
 *
 * The app already says a logo may not exist twice — `client.js` and the
 * favicon share one drawing for exactly that reason. The sales site is
 * deployed somewhere else on purpose (it must not go blank because a free-tier
 * instance is asleep), so it cannot import the app's file over the network and
 * a copy is the only option left. This is what stops the copy drifting.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the sales site draws the same mark as the app, to the byte', () => {
  const app = fs.readFileSync(new URL('../public/assets/brandmark.js', import.meta.url), 'utf8');
  const site = fs.readFileSync(new URL('../site/assets/brandmark.js', import.meta.url), 'utf8');
  assert.equal(site, app,
    'site/assets/brandmark.js has drifted — copy public/assets/brandmark.js over it');
});
