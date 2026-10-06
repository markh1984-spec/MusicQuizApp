/**
 * AN ADVERT'S QR REACHES THE ROOM THAT PUT IT UP.
 *
 * `/o/<pack>/<slide>` carried no room, so the page resolved it against the
 * owner's own quizmaster room: every subscriber's offer QR scanned to "nothing
 * here", and once the owner had a set with the same id it served the OWNER'S
 * slide, counted against the owner's room (Part C of the September sweeps,
 * #4, still live on 6 October 2026).
 *
 * The address carries the room's JOIN CODE — short, because every character
 * costs a QR resolution, and already public: it is on the projector and read
 * out on the mic. An unknown code is "nothing here", never the house room.
 * The two-part address still answers as it always did, for anything already
 * printed or photographed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { Accounts } from '../src/accounts.js';
import { withServer as live } from './helpers/live-server.mjs';

function seed(dir) {
  const book = new Accounts(path.join(dir, 'accounts.json'));
  book.create({ email: 'owner@x.com', password: 'a-long-owner-password', name: 'Mark', role: 'owner', status: 'active' });
  book.create({ email: 'rob@x.com', password: 'a-long-rob-password', name: 'Rob', role: 'quizmaster', tier: 'gold', status: 'active' });
  book.save();
}

async function signIn(base, email, password) {
  const res = await fetch(`${base}/api/sign-in`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200);
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

test("a subscriber's advert QR opens THEIR slide, and the scan counts in their room", async () => {
  await live(async (base) => {
    const rob = await signIn(base, 'rob@x.com', 'a-long-rob-password');
    const H = { 'Content-Type': 'application/json', Cookie: rob };
    const put = await fetch(`${base}/api/advert/the-crown`, {
      method: 'PUT', headers: H,
      body: JSON.stringify({ title: 'The Crown', venue: 'The Crown', slides: [{ id: 's1', heading: 'PIZZA — 2 FOR 1', offerCode: 'QUIZ40' }] }),
    });
    assert.equal(put.status, 200, await put.text());
    const { joinCode } = await (await fetch(`${base}/api/library`, { headers: { Cookie: rob } })).json();
    assert.ok(joinCode, 'Rob has a room code');

    const up = await fetch(`${base}/api/host/advert`, { method: 'POST', headers: H, body: JSON.stringify({ packId: 'the-crown', slideId: 's1' }) });
    assert.equal(up.status, 200, await up.text());
    const screen = await (await fetch(`${base}/api/state?role=screen&g=${joinCode}`)).json();
    const link = screen.advert && screen.advert.offerLink;
    assert.equal(link, `/o/${joinCode}/the-crown/s1`, 'the projector QR names the room');

    const scan = await fetch(`${base}${link}`);
    assert.equal(scan.status, 200, 'the scan opens the slide');
    assert.match(await scan.text(), /PIZZA/);
    const back = await (await fetch(`${base}/api/advert/the-crown`, { headers: { Cookie: rob } })).json();
    assert.equal(back.opens.s1.total, 1, 'and the open is counted in Rob’s room');

    assert.equal((await fetch(`${base}/o/ZZZZ/the-crown/s1`)).status, 404, 'a code that is no room is nothing here');
  }, { seed });
});
