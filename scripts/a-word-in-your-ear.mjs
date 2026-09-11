#!/usr/bin/env node
/**
 * DOES A MESSAGE REACH ONE PHONE, AND ONLY THAT ONE?
 *
 *   node scripts/a-word-in-your-ear.mjs
 *
 * ---
 *
 * Asked for on 11 September 2026: *"Say someone is being a bit cheeky I can
 * send them a message saying 'stop being a cheeky dickhead' and it appears on
 * their bingo screen."*
 *
 * Four questions, and the middle two are the ones that matter:
 *
 *   1. does it arrive on the phone it was aimed at;
 *   2. **is it absent from every other phone AND from the projector** — rule
 *      1, and the whole difference between a quiet word and humiliating
 *      somebody in front of sixty people;
 *   3. does tapping it away tell the HOST it landed, which is the half that
 *      was specifically asked for (*"also let me know when they did"*);
 *   4. does it work on a BINGO night as well as a quiz — *"their bingo
 *      screen"* is how the request was phrased, and a decision taken for both
 *      engines needs an assertion in both.
 *
 * Driven over real HTTP against the running app, because every one of these is
 * about what a DIFFERENT party receives, and a unit test that calls one
 * engine's view cannot see the other three.
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const KEY = 'a-word';
const OWNER = { email: 'word@example.com', password: 'a-word-in-your-ear-pw' };

const { Accounts } = await import('../src/accounts.js');
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Word Check', role: 'owner' });

const { base: BASE, stop } = await startApp({ key: KEY, seed: seedOwner });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const host = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
/*
 * A HOST ACTION ANSWERS `{ ok: <what the engine returned>, view: <the whole
 * control view> }`, so the result of the act itself is one level down. Reading
 * `body.ok` here is truthy for a REFUSAL — `{ ok: false, reason: 'empty' }` is
 * an object — which is exactly how this guard first called a refusal a pass.
 * `result()` is the one place that unwrapping happens.
 */
const act = (a, b = {}) => host(`/api/host/${a}`, b);
const result = (r) => (r && r.body && typeof r.body.ok === 'object' ? r.body.ok : (r || {}).body);
const phone = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

/* The words the feature was asked for, verbatim. There is no filter here by
   decision, and a test that used something polite would not prove that. */
const WORDS = 'stop being a cheeky dickhead';

async function run(kind, packId) {
  console.log(`\n--- ${kind}`);
  await act('launch', { game: kind, packId, replace: true });
  const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';
  const gg = joinCode ? `&g=${joinCode}` : '';

  const cheeky = (await phone(`/api/join${g}`, { name: 'Cheeky' })).body;
  const innocent = (await phone(`/api/join${g}`, { name: 'Innocent' })).body;
  await act('start');

  const idOf = (p) => p.playerId || p.id;
  const stateFor = async (p) => (await phone(
    `/api/state?role=player&playerId=${idOf(p)}&token=${encodeURIComponent(p.token)}${gg}`,
  )).body;
  const screen = async () => (await phone(`/api/state?role=screen${gg}`)).body;
  const hostState = async () => (await host(`/api/state?role=host${gg}`)).body;

  const sent = result(await act('messagePlayer', { playerId: idOf(cheeky), text: WORDS }));
  check('the message is accepted', Boolean(sent && sent.ok === true), JSON.stringify(sent));

  const theirs = await stateFor(cheeky);
  check('IT REACHES THE PHONE IT WAS AIMED AT',
    Boolean(theirs.note) && theirs.note.text === WORDS, JSON.stringify(theirs.note || null));

  const other = await stateFor(innocent);
  check('and NOT the phone next to them', !other.note, JSON.stringify(other.note || null));

  /*
   * THE PROJECTOR IS THE ONE THAT MUST NOT HAVE IT. Checked as a deep search
   * of the whole payload rather than one field, because the question is "can
   * these words reach the big screen by ANY route", and a check that named
   * `sting`-style one field would miss the next field somebody adds.
   */
  const wall = JSON.stringify(await screen());
  check('AND THE PROJECTOR NEVER SEES IT, anywhere in its payload',
    !wall.includes('cheeky'), wall.length > 0 ? 'searched the whole payload' : 'empty');

  /* ------------------------------------------------- the read receipt */
  const before = await hostState();
  const noteBefore = (before.notes || {})[idOf(cheeky)];
  check('the host can see it was sent', Boolean(noteBefore), JSON.stringify(before.notes || null));
  check('and that it has NOT been read yet', noteBefore && !noteBefore.seenAt);

  const read = await phone('/api/note-read', {
    playerId: idOf(cheeky), token: cheeky.token, joinCode,
  });
  check('the phone can tap it away', read.status === 200 && read.body && read.body.ok,
    JSON.stringify(read.body));

  const after = await hostState();
  const noteAfter = (after.notes || {})[idOf(cheeky)];
  check('THE HOST IS TOLD WHEN THEY READ IT', Boolean(noteAfter && noteAfter.seenAt),
    JSON.stringify(noteAfter || null));
  check('and the words are still there to look back at', noteAfter && noteAfter.text === WORDS);

  const gone = await stateFor(cheeky);
  check('and it stops being sent to the phone', !gone.note, JSON.stringify(gone.note || null));

  /*
   * SOMEBODY ELSE'S PHONE MAY NOT MARK IT READ. The receipt is a fact about
   * that handset, and one anybody could post would make the tick a lie —
   * rule 3 applied to a new route.
   */
  await act('messagePlayer', { playerId: idOf(cheeky), text: 'second go' });
  const forged = await phone('/api/note-read', {
    playerId: idOf(cheeky), token: 'not-their-token', joinCode,
  });
  check('a phone that cannot prove who it is cannot forge the receipt',
    forged.body && forged.body.ok === false, JSON.stringify(forged.body));
  const stillThere = await stateFor(cheeky);
  check('so the message is still on their screen',
    Boolean(stillThere.note) && stillThere.note.text === 'second go');

  /* A new message replaces the old one rather than stacking. */
  await act('messagePlayer', { playerId: idOf(cheeky), text: 'third go' });
  const latest = await stateFor(cheeky);
  check('a newer message replaces the older one', latest.note && latest.note.text === 'third go');

  const empty = result(await act('messagePlayer', { playerId: idOf(cheeky), text: '   ' }));
  check('an empty one is REFUSED rather than silently dropped',
    Boolean(empty && empty.ok === false), JSON.stringify(empty));
  const unchanged = await stateFor(cheeky);
  check('and the refusal leaves the message that was already there alone',
    unchanged.note && unchanged.note.text === 'third go', JSON.stringify(unchanged.note || null));
}

/**
 * AND THE HALF THAT HTTP CANNOT SEE: DID ANYBODY DRAW IT?
 *
 * Everything above passed — on both engines, over real HTTP, on a quiz night
 * and a bingo night — while the phone drew NOTHING. `paintHostNote()` had been
 * written into `draw()`'s `state.kicked` branch, which RETURNS, so the card
 * appeared for a phone that had been thrown out of the game and for no other.
 * At the same time the host's envelope was in `host.js` alone, and
 * `host-bingo.js` has a player panel of its own — so on the very screen this
 * was asked for ("it appears on their bingo screen") the host had no mark and
 * no way to send one.
 *
 * *A test that the payload is right proves nothing about whether anybody drew
 * it.* Both faults were found by taking the screenshot; this is that screenshot
 * with an assertion on it.
 *
 * A BINGO night, because that is the one the request named, and because the
 * bingo card never rebuilds between rounds — so a card that waited for a
 * redraw would never arrive there at all.
 */
async function inARealBrowser(packId) {
  console.log('\n--- and on a real bingo screen');
  const browser = await chromium.launch();
  try {
    await act('launch', { game: 'bingo', packId, replace: true });
    const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';

    const openPhone = async (name) => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(`${BASE}/play${joinCode ? `?g=${joinCode}` : ''}`, { waitUntil: 'domcontentloaded' });
      await page.fill('#nameInput', name);
      await page.click('#joinBtn');
      await wait(500);
      const me = await page.evaluate(() => JSON.parse(localStorage.getItem('musicquiz.player') || '{}'));
      return { page, me };
    };
    const cheeky = await openPhone('Table 4');
    const innocent = await openPhone('The Quizzards');
    await act('start');
    await wait(600);

    await act('messagePlayer', { playerId: cheeky.me.id, text: WORDS });
    await wait(1300);

    /* PUT A FINGER ON IT — in the document, has a size, and is what is actually
       under that point. Three questions, and the gap has bitten this repo six
       times. */
    const card = (page) => page.evaluate(() => {
      const el = document.querySelector('.hostnote');
      if (!el) return { drawn: false, why: 'not in the document' };
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return { drawn: false, why: 'zero size' };
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        drawn: Boolean(hit && el.contains(hit)),
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        /* AND IT MUST BE AN OPAQUE SURFACE. `--panel` is six per cent white, so
           a card built on it let the bingo squares read straight through the
           words — the surface underneath is what makes this legible. */
        opaque: !/rgba\([^)]*,\s*0?\.\d+\s*\)/.test(getComputedStyle(el).backgroundColor),
      };
    });

    const theirs = await card(cheeky.page);
    check('THE CARD IS ACTUALLY DRAWN ON THE PHONE', theirs.drawn === true, JSON.stringify(theirs));
    check('and it says what was sent', theirs.text && theirs.text.includes('cheeky'),
      JSON.stringify(theirs.text));
    check('and it sits on an opaque surface, not a see-through one', theirs.opaque === true);

    const next = await card(innocent.page);
    check('and nothing is drawn on the phone beside it', next.drawn === false, JSON.stringify(next));

    /* THE HOST'S OWN SCREEN — the bingo one, which has a player panel of its
       own and therefore its own chance to miss this entirely. */
    const board = await browser.newPage({ viewport: { width: 430, height: 932 } });
    await board.goto(`${BASE}/host?key=${KEY}`, { waitUntil: 'domcontentloaded' });
    await wait(1600);
    const mark = () => board.evaluate(() => {
      const el = document.querySelector('.notemark');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim(), seen: el.classList.contains('seen'), sized: r.width > 0 };
    });
    const sent = await mark();
    check('THE BINGO CONTROL VIEW DRAWS THE ENVELOPE', Boolean(sent && sent.sized),
      JSON.stringify(sent));
    check('and it does not claim it has been read yet', sent && sent.seen === false);

    const sendable = await board.evaluate(() => {
      const btn = document.querySelector('.prow [data-act="note"]');
      if (!btn) return { there: false };
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { there: true, pressable: Boolean(hit && (btn === hit || btn.contains(hit))) };
    });
    check('AND THERE IS A WAY TO SEND ONE FROM A BINGO NIGHT', sendable.pressable === true,
      JSON.stringify(sendable));

    /* THE REAL PRESS, on the real button. */
    await cheeky.page.click('.hostnote button');
    await wait(1400);
    const goneFor = await card(cheeky.page);
    check('tapping OK takes the card away', goneFor.drawn === false, JSON.stringify(goneFor));

    await wait(1600);
    const read = await mark();
    check('AND THE HOST\'S MARK TURNS OVER TO READ', Boolean(read && read.seen),
      JSON.stringify(read));
  } finally {
    await browser.close();
  }
}

try {
  const library = (await host('/api/library')).body;
  const quiz = (library.quizzes || [])[0];
  const bingo = (library.bingo || library.bingoPacks || [])[0];
  if (!quiz || !bingo) throw new Error('the fixture library needs a quiz and a bingo pack');
  await run('quiz', quiz.id);
  await run('bingo', bingo.id);
  await inARealBrowser(bingo.id);
} finally {
  stop();
}

console.log(failures ? `\n${failures} FAILED` : '\na word reaches one ear and no others');
process.exit(failures ? 1 : 0);
