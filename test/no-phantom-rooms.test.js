/**
 * A STRANGER'S `?q=` NEVER PUTS A ROW ON THE OWNER'S OVERVIEW.
 *
 * `galleryRoomFrom()` accepted any id `accounts.find()` knew — including the
 * OWNER's own account id, which is what the console prints in its own public
 * link, and which holds no room (the owner runs HOUSE). So one anonymous GET
 * filed a room under it, and an unknown id landed on the reserved
 * `gallery-none` room, which `summaries()` then listed too: two permanent
 * nameless idle rows on the owner's Tonight tab (Part C of the September
 * sweeps, #10). An account's `?q=` now names the room its nights are in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import { withServer } from './helpers/live-server.mjs';

let ownerId = '';
function seed(dir) {
  const book = new Accounts(path.join(dir, 'accounts.json'));
  ownerId = book.create({ email: 'owner@x.com', password: 'a-long-owner-password', name: 'Mark', role: 'owner', status: 'active' }).id;
  book.save();
}

test('the owner’s own id and a made-up id both leave the overview as it was', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/sign-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@x.com', password: 'a-long-owner-password' }),
    });
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    const rowsOf = async () => (await (await fetch(`${base}/api/owner/overview`, { headers: { Cookie: cookie } })).json()).rooms || [];
    const before = (await rowsOf()).map((r) => r.id).sort();

    for (const q of [ownerId, 'nobody-at-all-1234']) {
      assert.equal((await fetch(`${base}/api/gallery?q=${encodeURIComponent(q)}`)).status, 200);
      await fetch(`${base}/api/me?q=${encodeURIComponent(q)}`);
    }
    const after = (await rowsOf()).map((r) => r.id).sort();
    assert.deepEqual(after, before, 'anonymous gallery visits added rows to the owner’s overview');
  }, { seed });
});
