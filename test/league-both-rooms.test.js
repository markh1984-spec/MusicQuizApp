/**
 * THE LEAGUE IS BUILT FROM EVERY ROOM THE OWNER'S NIGHTS ARE FILED IN.
 *
 * The console's league read `roomForHost()` — HOUSE for the owner and the host
 * key — while the public page read the owner's own quizmaster room, and
 * neither looked in the other. So a night run on the host key could be
 * published from the console and never appear on `/league`, and a night run
 * on the quizmaster hat was missing from the console's table (Part C of the
 * September sweeps, #8). Past gigs already unions the two (`gigRoomsFor()`);
 * the league asks the same question the same way now.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { withStubbedApp } from './helpers/stub-app.mjs';

const PASSWORD = 'a longer pass phrase';
const post = (base, path, body, cookie = '') => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

/** An owner with a password, plus the owner's own quizmaster account — the real shape. */
async function owner({ base, data, restart }) {
  const made = await (await post(base, '/api/signup', { email: 'mark@example.com', password: PASSWORD, name: 'Mark' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  assert.equal((await post(base, '/api/reset/complete', { token, password: PASSWORD })).status, 200);
  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'owner';
  acc.accounts.push({
    ...acc.accounts[0], id: 'qm-mark', email: 'mark+qm@example.com', name: "Mark's Quizporium",
    role: 'quizmaster', ownedBy: acc.accounts[0].id, comped: true, status: 'active',
  });
  writeFileSync(file, JSON.stringify(acc));
  await restart();
  const res = await post(base, '/api/sign-in', { email: 'mark@example.com', password: PASSWORD });
  return (res.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
}

function file(dir, id, venue, team, day) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({
    id, kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties', archivedAt: Date.parse(`${day}T21:30:00Z`), venue,
    leaderboard: [{ name: team, score: 2000, position: 1, faceKey: '' }],
  }));
}

test('a host-key night and a quizmaster-hat night both reach the console AND the public page', async () => {
  await withStubbedApp(async (app) => {
    const cookie = await owner(app);
    file(join(app.data, 'archive'), 'n-house', 'The Crown', 'Host Key Heroes', '2026-09-24');
    file(join(app.data, 'rooms', 'qm-mark', 'archive'), 'n-hat', 'The Wheatsheaf', 'Hat Wearers', '2026-09-25');

    for (const venueKey of ['the crown', 'the wheatsheaf']) {
      assert.equal((await post(app.base, '/api/league/running', { venueKey, on: true }, cookie)).status, 200);
      assert.equal((await post(app.base, '/api/league/publish', { venueKey, on: true }, cookie)).status, 200);
    }

    const lib = await (await fetch(`${app.base}/api/library`, { headers: { Cookie: cookie } })).json();
    assert.ok(lib.leagues['the crown'], 'the console has the host-key night');
    assert.ok(lib.leagues['the wheatsheaf'], 'the console has the quizmaster-hat night');

    const page = await (await fetch(`${app.base}/api/league`)).json();
    const venues = (page.venues || page.leagues || []).map((l) => l.venue);
    assert.ok(venues.includes('The Wheatsheaf'), `the public page has the hat night (${venues})`);
    assert.ok(venues.includes('The Crown'), `the public page has the host-key night (${venues})`);
  }, { prefix: 'league-rooms' });
});

test('after a deploy the public page still says when the next quiz is — it reads the venue book back first', async () => {
  /*
   * "Next quiz Thursday" comes off the venue's usual night in the invoice
   * book, and `/api/league` read the book without restoring it — so after a
   * deploy onto an empty disk the line was gone until somebody opened a
   * console (Part C of the September sweeps, #21).
   */
  await withStubbedApp(async (app) => {
    const cookie = await owner(app);
    file(join(app.data, 'rooms', 'qm-mark', 'archive'), 'n-hat', 'The Wheatsheaf', 'Hat Wearers', '2026-09-25');
    writeFileSync(join(app.repo, 'invoicing-qm-mark.json'), JSON.stringify({
      settings: {}, invoices: [], bookings: [],
      customers: [{ id: 'wheat', name: 'The Wheatsheaf', rewards: ['A pint'], usualNight: 'thu' }],
    }));
    for (const route of ['/api/league/running', '/api/league/publish']) {
      assert.equal((await post(app.base, route, { venueKey: 'the wheatsheaf', on: true }, cookie)).status, 200);
    }
    const page = await (await fetch(`${app.base}/api/league`)).json();
    const wheat = (page.venues || page.leagues || []).find((l) => l.venue === 'The Wheatsheaf');
    assert.ok(wheat, 'the table is on the page');
    assert.match(wheat.next, /^Next quiz /, `the next-quiz line is there (${JSON.stringify(wheat.next)})`);
  }, { prefix: 'league-next' });
});
