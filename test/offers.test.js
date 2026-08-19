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
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Offers, offerPath } from '../src/offers.js';

const ROOT = new URL('..', import.meta.url).pathname;

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

/**
 * AN OPEN BELONGS TO A NIGHT, NOT TO A CALENDAR DATE.
 *
 * An advert goes up BETWEEN ROUNDS — the engine refuses one over a live
 * question — so scans arrive in bursts all evening. A quiz that runs past
 * midnight would otherwise have its last burst counted on the next day, and
 * the answer to "how did it do on Thursday" would be split across two rows.
 *
 * The 6am roll-over is the same one `nightOfGig()` and `photos.nightOf()` use.
 * A filed night, its photographs and its advert opens must agree about which
 * evening they belong to.
 */
test('a scan after midnight counts on the night it happened, not the next day', () => {
  const o = new Offers(tempFile());
  const thursdayEvening = Date.parse('2026-08-13T21:30:00Z');
  const afterMidnight = Date.parse('2026-08-14T00:20:00Z');   // same gig
  const nextEvening = Date.parse('2026-08-14T21:00:00Z');     // a different one

  o.opened('crown', 'pizza', thursdayEvening);
  o.opened('crown', 'pizza', afterMidnight);
  o.opened('crown', 'pizza', nextEvening);

  const seen = o.forSlide('crown', 'pizza', { now: nextEvening });
  const byDay = Object.fromEntries(seen.recent.map((r) => [r.day, r.count]));
  assert.equal(byDay['2026-08-13'], 2, 'the half-midnight scan belongs to Thursday');
  assert.equal(byDay['2026-08-14'], 1);
});

/* -------------------------------------------------- the wiring, over HTTP */

/**
 * THE COUNT REACHES THE CONSOLE, THE SAME WAY THE FEATURE WAS MISSING.
 *
 * `forSlide()`/`forPack()` were tested and correct for as long as this file
 * has existed, and nothing in `server.js` ever called them — the counting
 * worked and there was no route a console could ask for it through, which is
 * exactly the class of miss the arcade board and the gallery's publish button
 * were. So this proves the whole path over real HTTP: save a pack with a
 * code, scan its public offer page, and read the count back off the same
 * route the editor uses to open a set.
 */
async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'offers-route-'));
  const port = 4990 + (process.pid % 90);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    /*
     * ADVERT_DIR EXPLICITLY, or the house room's adverts default to
     * `<repo>/adverts` — a real, git-tracked folder — and this test would
     * write its fixture packs straight into it. Found by doing exactly that
     * once; the fix is never to let a test process default to a live path.
     */
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, ADVERT_DIR: join(dir, 'adverts'), HOST_KEY: 'offers-test-key' },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try { await fetch(`${base}/api/quizzes?key=offers-test-key`); up = true; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    assert.ok(up, 'the server never came up');
    await run(base);
  } finally {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a saved code, scanned twice, reads back on the same route that opened the set', async () => {
  await withServer(async (base) => {
    const put = await fetch(`${base}/api/advert/the-crown?key=offers-test-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'The Crown',
        venue: 'The Crown',
        slides: [{ id: 's1', heading: 'PIZZA — 2 FOR 1', offerCode: 'QUIZ40', offerWhen: 'Tuesdays' }],
      }),
    });
    assert.equal(put.status, 200, await put.text());

    // Scanned as the room's public offer page — no key, exactly like a phone.
    assert.equal((await fetch(`${base}/o/the-crown/s1`)).status, 200);
    assert.equal((await fetch(`${base}/o/the-crown/s1`)).status, 200);

    const got = await (await fetch(`${base}/api/advert/the-crown?key=offers-test-key`)).json();
    assert.equal(got.opens.s1.total, 2, 'both scans reached the same slide');
    assert.equal(got.slides[0].offerCode, 'QUIZ40', 'the code round-trips through save and load');

    // Never on the object the browser would PUT straight back.
    assert.equal(Object.prototype.hasOwnProperty.call(got, 'title'), true);
  });
});

test('a code with nothing scanned yet reads back with no opens rather than a throw', async () => {
  await withServer(async (base) => {
    await fetch(`${base}/api/advert/quiet-pub?key=offers-test-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Quiet pub', venue: 'The Anchor', slides: [{ id: 's1', heading: 'Fresh code', offerCode: 'NEW10' }] }),
    });
    const got = await (await fetch(`${base}/api/advert/quiet-pub?key=offers-test-key`)).json();
    assert.deepEqual(got.opens, {});
  });
});
