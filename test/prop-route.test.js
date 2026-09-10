/**
 * THE PROP TALLY, OVER REAL HTTP.
 *
 * `prop-use.test.js` checks the arithmetic. This checks the two things only a
 * real request can show: that the counters are written from an ORDINARY photo
 * upload rather than a route of their own, and that a photograph is never lost
 * to the bookkeeping — the rule the spend ledger already carries, where a
 * counter that can break the thing it counts is the tail wagging the dog.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { withServer as live } from './helpers/live-server.mjs';

const KEY = 'prop-route-key';
const withServer = (run) => live(run, { hostKey: KEY });

/** A joined phone, because the upload refuses anything else. */
async function join(base) {
  const res = await fetch(`${base}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Props' }),
  });
  return res.json();
}

const ONE_PIXEL = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

const send = (base, id, extra = '') => fetch(
  `${base}/api/photo?playerId=${encodeURIComponent(id)}&filter=none${extra}`,
  { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: ONE_PIXEL },
);

const tallyOf = (dir) => {
  const file = path.join(dir, 'prop-use.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8')).props || {};
};

test('an ordinary photo upload carries the tally — no route of its own', async () => {
  await withServer(async (base, _file, dir) => {
    const me = await join(base);
    assert.ok(me.id, `could not join: ${JSON.stringify(me)}`);

    await send(base, me.id, '&shown=dog-ears,clown-nose&used=clown-nose');

    const props = tallyOf(dir);
    assert.equal(props['dog-ears'].shown, 1, 'the tray was not recorded');
    assert.equal(props['dog-ears'].used, 0);
    assert.equal(props['clown-nose'].used, 1, 'the prop reached for was not recorded');
  });
});

test('AND A JUNK TALLY IS DROPPED, not stored and not thrown', async () => {
  await withServer(async (base, _file, dir) => {
    const me = await join(base);
    // Written from a query string, so it is somebody else's text.
    const res = await send(base, me.id,
      `&shown=${encodeURIComponent('../../etc/passwd,Ok Then,' + 'A'.repeat(300))}&used=${encodeURIComponent('<script>')}`);
    assert.equal(res.status, 200, 'a junk tally took the upload down with it');
    assert.deepEqual(Object.keys(tallyOf(dir)), [], 'junk reached the tally file');
  });
});

test('a photo with NO tally on it still lands — every phone before this existed', async () => {
  await withServer(async (base) => {
    const me = await join(base);
    const res = await send(base, me.id);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true, `the photo was refused: ${JSON.stringify(body)}`);
  });
});

test('the weights route answers a phone, and names every prop', async () => {
  await withServer(async (base) => {
    // Open, and fetched once per phone that opens the camera — deliberately
    // NOT a field on the state payload, which every phone gets on every push.
    const res = await fetch(`${base}/api/prop-weights`);
    assert.equal(res.status, 200);
    const { weights } = await res.json();
    const { STICKERS } = await import('../public/assets/stickers.js');
    assert.equal(Object.keys(weights).length, STICKERS.length,
      'the tray and the tally disagree about which props exist');
    // Nothing judged yet, so every rate is null — "no data" and "nobody wants
    // it" must not arrive as the same number.
    assert.ok(Object.values(weights).every((w) => w === null));
  });
});

test('the owner table is behind the owner gate', async () => {
  await withServer(async (base) => {
    const open = await fetch(`${base}/api/owner/prop-use`);
    assert.notEqual(open.status, 200, 'the prop table is readable by anybody');

    const asOwner = await fetch(`${base}/api/owner/prop-use?key=${KEY}`);
    // Read ONCE — a body consumed for an assertion message is a body the
    // assertion itself can no longer parse.
    const body = await asOwner.text();
    assert.equal(asOwner.status, 200, body);
    const data = JSON.parse(body);
    assert.ok(data.props.length, 'no props in the table');
    // A prop nobody has ever been shown still appears — it is the most
    // interesting row and would otherwise be the one row absent.
    assert.ok(data.props.every((p) => typeof p.label === 'string' && p.label));
    assert.ok(data.props.some((p) => p.seasonal), 'seasonal props are not marked');
    assert.ok(data.props.every((p) => p.rate === null), 'a rate was reported with no data');
  });
});
