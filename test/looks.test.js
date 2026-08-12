/**
 * Dressing a night up.
 *
 * The tests that matter here are not about it looking nice — they are the two
 * ways a decoration can do damage: a palette that only reaches one of the two
 * screens, and a look that survives a crash as something else.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOOKS, DEFAULT_LOOK, findLook, motifSvg, inSeason, lookInSeason, easterSunday } from '../public/assets/looks.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(ROOT, 'public/assets/style.css'), 'utf8');

test('every look has a palette in the stylesheet', () => {
  for (const look of LOOKS) {
    if (look.id === DEFAULT_LOOK) continue; // the default IS the :root palette
    assert.ok(
      CSS.includes(`[data-look="${look.id}"]`),
      `"${look.id}" has no palette — it would silently be the ordinary look wearing ${look.motifs[0] || 'nothing'}`,
    );
  }
});

test('every palette changes all six option colours, or none of them', () => {
  // The half-done case is the dangerous one. A player looks up, decides "the
  // pink one, bottom left", and looks back down — so if a look moves A, B and C
  // and forgets D, two of the four answers swap identity between the projector
  // and the phone.
  for (const look of LOOKS) {
    if (look.id === DEFAULT_LOOK) continue;
    const block = CSS.slice(CSS.indexOf(`[data-look="${look.id}"]`));
    const body = block.slice(0, block.indexOf('}'));
    for (const name of ['--a', '--b', '--c', '--d', '--e', '--f']) {
      assert.ok(new RegExp(`${name}\\s*:`).test(body), `"${look.id}" does not set ${name}`);
    }
  }
});

test('no two option colours in a look are the same', () => {
  // They have to be told apart from the back of a room, which matters more
  // than the palette being tasteful.
  for (const look of LOOKS) {
    if (look.id === DEFAULT_LOOK) continue;
    const block = CSS.slice(CSS.indexOf(`[data-look="${look.id}"]`));
    const body = block.slice(0, block.indexOf('}'));
    const colours = ['--a', '--b', '--c', '--d', '--e', '--f']
      .map((name) => body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))[1].trim().toLowerCase());
    assert.equal(new Set(colours).size, 6, `"${look.id}" repeats a colour: ${colours.join(' ')}`);
  }
});

test('every motif a look names is actually drawn', () => {
  for (const look of LOOKS) {
    for (const motif of look.motifs) {
      const svg = motifSvg(motif);
      assert.ok(svg.startsWith('<svg'), `"${look.id}" wants a "${motif}" and there is no such shape`);
      assert.ok(svg.includes('viewBox="0 0 24 24"'), `${motif} is not on the shared grid`);
    }
  }
});

test('the shapes are drawn, never emoji', () => {
  // Same rule as the bin icon: every phone and every projector renders an emoji
  // differently, and some render a skull as something cheerful.
  const source = fs.readFileSync(path.join(ROOT, 'public/assets/looks.js'), 'utf8');
  const emoji = source.match(/\p{Extended_Pictographic}/gu);
  assert.equal(emoji, null, `looks.js contains emoji: ${emoji && emoji.join(' ')}`);
});

test('an unknown look falls back rather than leaving the screen undressed', () => {
  assert.equal(findLook('kaleidoscope').id, DEFAULT_LOOK);
  assert.equal(findLook('').id, DEFAULT_LOOK);
  assert.equal(findLook(undefined).id, DEFAULT_LOOK);
  assert.equal(findLook('halloween').id, 'halloween');
});

test('the default look has no shapes at all', () => {
  assert.deepEqual(findLook(DEFAULT_LOOK).motifs, [], 'the ordinary look should be the ordinary look');
});

test('every look has something to call it in the console', () => {
  for (const look of LOOKS) {
    assert.ok(look.label, `${look.id} has no label`);
    assert.ok(look.blurb, `${look.id} has no blurb, so the picker cannot say what it does`);
  }
});

/* ------------------------------------------------------------------------
 * The look lives in the GAME STATE, not on the in-memory pack.
 *
 * This is the lesson the bingo card shape taught the hard way: a SIGKILL
 * mid-round brought the game back as whatever the file said. A room that was
 * black and orange five minutes ago suddenly going pink is the same class of
 * fault, just a less expensive one.
 */

import os from 'node:os';
import { Session } from '../src/session.js';
import { Store } from '../src/store.js';

function withApp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'looks-'));
  const quizDir = path.join(dir, 'quizzes');
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(quizDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const write = (id, extra = {}) => fs.writeFileSync(path.join(quizDir, id + '.json'), JSON.stringify({
    id, title: 'A Quiz', questionSeconds: 20, ...extra,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  }));
  write('plain');
  write('spooky', { look: 'halloween' });
  const config = { quizDir, bingoDir: path.join(dir, 'bingo'), dataDir, advertDir: path.join(dir, 'adverts') };
  try {
    return fn({ config, dataDir });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const open = ({ config, dataDir }) => new Session({
  config, store: new Store(path.join(dataDir, 'state.json')), onPush: () => {},
}).boot();

test('a pack carrying a look is launched wearing it', () => {
  withApp((app) => {
    const session = open(app);
    session.launch('quiz', 'spooky');
    assert.equal(session.look, 'halloween');
    assert.equal(session.screenView().look, 'halloween');
  });
});

test('a plain pack can be dressed up for tonight only', () => {
    withApp((app) => {
    const session = open(app);
    session.launch('quiz', 'plain', { look: 'valentines' });
    assert.equal(session.look, 'valentines');
    // And the pack on disk is untouched — it is a decision about this evening.
    assert.equal(JSON.parse(fs.readFileSync(path.join(app.config.quizDir, 'plain.json'), 'utf8')).look, undefined);
    // Launching it again with nothing said goes back to its own default.
    session.launch('quiz', 'plain');
    assert.equal(session.look, 'default');
  });
});

test('the look survives the server being killed mid-quiz', () => {
  withApp((app) => {
    const session = open(app);
    session.launch('quiz', 'plain', { look: 'christmas' });
    session.engine.join({ name: 'Sofa King Good' });
    session.store.flush();

    // The process dies. Everything comes back off the disk.
    const revived = open(app);
    assert.equal(revived.look, 'christmas', 'a room that was green and red must not come back pink');
    assert.equal(revived.screenView().look, 'christmas');
    assert.equal(revived.playerView('nobody').look, 'christmas');
  });
});

test('all three payloads carry the same look, always', () => {
  withApp((app) => {
    const session = open(app);
    session.launch('quiz', 'spooky');
    const player = session.engine.join({ name: 'Sofa King Good' });
    // The option colours are on the projector AND the phone. If they disagree,
    // "the pink one, bottom left" stops meaning anything.
    assert.equal(session.screenView().look, 'halloween');
    assert.equal(session.playerView(player.id).look, 'halloween');
    assert.equal(session.hostView().look, 'halloween');
  });
});

test('a look nobody has heard of is refused rather than half-applied', () => {
  withApp((app) => {
    const session = open(app);
    session.launch('quiz', 'plain', { look: 'kaleidoscope' });
    assert.equal(session.look, 'default');
    session.engine.state.look = 'nonsense';
    assert.equal(session.look, 'default', 'and a nonsense value on a restored state is ignored too');
  });
});

test('a look nobody has heard of is a validation problem, not a silent shrug', async () => {
  const { validateQuiz } = await import('../src/quizzes.js');
  const quiz = {
    id: 'q', title: 'A Quiz', look: 'kaleidoscope',
    rounds: [{ id: 'r1', type: 'text', title: 'R', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  };
  assert.match(validateQuiz(quiz)[0], /is not a look/);
  quiz.look = 'halloween';
  assert.deepEqual(validateQuiz(quiz), []);
  delete quiz.look;
  assert.deepEqual(validateQuiz(quiz), [], 'and no look at all is perfectly fine');
});

/*
 * The date SUGGESTS a look and never sets one. These pin the arithmetic —
 * particularly Christmas, whose range wraps round the new year and which a
 * naive `from <= at && at <= to` would report as never in season at all.
 */
test('a season knows its own dates, and Christmas wraps the year', () => {
  const on = (m, d) => new Date(Date.UTC(2026, m - 1, d, 12));
  const at = (m, d) => (lookInSeason(on(m, d)) || {}).id || null;

  assert.equal(at(10, 15), 'halloween');
  assert.equal(at(11, 2), 'halloween', 'the day it ends is still in it');
  assert.equal(at(2, 13), 'valentines');
  assert.equal(at(7, 4), 'summer');

  assert.equal(at(12, 20), 'christmas', 'December is in it');
  assert.equal(at(12, 26), 'christmas', 'up to and including Boxing Day');
  // NEW YEAR TAKES OVER FROM THE 27th, and its range is the one that wraps.
  // Two looks claiming the same evening would make the picker's answer depend
  // on whichever happened to come first in LOOKS, which is not a rule.
  assert.equal(at(12, 28), 'newyear');
  assert.equal(at(1, 1), 'newyear', 'on the far side of the wrap');
  assert.equal(at(1, 20), null, 'but the middle of January is nobody\'s season');

  // Bonfire Night starts the day after Halloween's range ends, same reason.
  assert.equal(at(11, 2), 'halloween');
  assert.equal(at(11, 5), 'bonfire');
  assert.equal(at(3, 17), 'stpatricks');
});

/*
 * Easter moves by more than a month — 22 March to 25 April — so a fixed range
 * would be wrong most years. The dates below are the real ones.
 */
test('Easter is worked out, not guessed at', () => {
  const iso = (y) => easterSunday(y).toISOString().slice(0, 10);
  assert.equal(iso(2024), '2024-03-31');
  assert.equal(iso(2025), '2025-04-20');
  assert.equal(iso(2026), '2026-04-05');
  assert.equal(iso(2027), '2027-03-28');

  const on = (m, d, y = 2026) => new Date(Date.UTC(y, m - 1, d, 12));
  const easter = LOOKS.find((l) => l.id === 'easter');
  assert.equal(inSeason(easter, on(4, 5)), true, 'Easter Sunday itself');
  assert.equal(inSeason(easter, on(3, 30)), true, 'the week before');
  assert.equal(inSeason(easter, on(4, 6)), true, 'and Easter Monday');
  assert.equal(inSeason(easter, on(4, 20)), false, 'a fortnight later is not');
  // The window MOVES with the year rather than sitting on 2026's dates.
  assert.equal(inSeason(easter, on(4, 20, 2025)), true, '2025 Easter Sunday');
  assert.equal(inSeason(easter, on(4, 5, 2025)), false, "2026's date, in 2025");
});

test('a look with no season is never in one', () => {
  assert.equal(inSeason(LOOKS.find((l) => l.id === 'default'), new Date()), false);
  assert.equal(inSeason(null), false);
  assert.equal(inSeason({}), false);
});
