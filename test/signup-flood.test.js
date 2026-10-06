/**
 * A SIGNUP FLOOD FROM MANY ADDRESSES IS HELD TOO.
 *
 * `SIGNUPS_PER_HOUR` counts per caller, and the caller is the first entry of
 * `x-forwarded-for` — which the client writes. Twelve rotated addresses made
 * twelve accounts (Part C of the September sweeps, #3), and every signup backs
 * up the whole accounts book against the GitHub quota the gallery, the archive
 * and the invoices share. So there is a ceiling for EVERYBODY as well:
 * `SIGNUPS_EVERYWHERE_PER_HOUR`, a safety number far above an honest hour.
 * A signup may be refused; a join may not, and this touches no join.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { withServer } from './helpers/live-server.mjs';
import { SIGNUPS_EVERYWHERE_PER_HOUR } from '../src/http/plumbing.js';

test('rotating the forwarded address does not get past the ceiling for everybody', async () => {
  await withServer(async (base) => {
    const attempt = (i) => fetch(`${base}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.${Math.floor(i / 250)}.${i % 250}` },
      body: JSON.stringify({}),            // refused for having no name — AFTER the door, so it still counts
    });
    for (let i = 0; i < SIGNUPS_EVERYWHERE_PER_HOUR; i += 1) {
      assert.equal((await attempt(i)).status, 400, `attempt ${i + 1} reached the form`);
    }
    const over = await attempt(SIGNUPS_EVERYWHERE_PER_HOUR);
    assert.equal(over.status, 429, 'one more, from yet another address, is held');
    assert.match((await over.json()).error, /shortly|few minutes/);
  });
});
