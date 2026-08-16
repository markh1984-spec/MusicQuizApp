/**
 * THE DRAFT KEPT WHILE SOMEBODY IS WRITING A PACK.
 *
 * This is the one surface in the app where a mistake eats somebody's writing,
 * so it gets a real test rather than a grep: `pack-draft.js` imports nothing
 * and touches nothing but `localStorage`, so a Map behind the four methods is
 * enough to RUN the actual module. That matters here more than usual — every
 * other browser file in this repo is only ever `node --check`ed, which is the
 * weakest guard there is, and "the draft survived" is not a claim parsing can
 * support.
 *
 * What it cannot cover is the policy in `editor.js` — when a draft is written,
 * offered back and cleared — because that half needs a DOM. That is checked by
 * driving a real browser; see the note in CLAUDE.md under the popover editor.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

/** Enough of localStorage to run the module against, and no more. */
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

globalThis.localStorage = fakeStorage();
const { draftKeyFor, readDraft, writeDraft, forgetDraft, pruneDrafts } =
  await import('../public/assets/pack-draft.js');

const pack = (id, prompt) => ({
  id,
  title: 'A quiz',
  rounds: [{ id: 'r1', type: 'text', title: 'One', questions: [{ id: 'q1', prompt, options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] }],
});

test('a draft comes back exactly as it went in', () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(writeDraft('quiz', pack('eighties', 'half typed')), true);
  const held = readDraft('quiz', 'eighties');
  assert.equal(held.pack.rounds[0].questions[0].prompt, 'half typed');
  assert.equal(held.kind, 'quiz');
  assert.ok(held.at > 0);
});

/*
 * THE ONE THAT MATTERS MOST.
 *
 * A single scratch slot would hand somebody the 80s quiz's unsaved changes
 * while they had Motown open — which is a WORSE failure than losing them,
 * because it looks like your work and you would save it over the real pack.
 */
test('drafts are keyed per pack, so one never reaches another', () => {
  globalThis.localStorage = fakeStorage();
  writeDraft('quiz', pack('eighties', 'the eighties one'));
  writeDraft('quiz', pack('motown', 'the motown one'));
  assert.equal(readDraft('quiz', 'eighties').pack.rounds[0].questions[0].prompt, 'the eighties one');
  assert.equal(readDraft('quiz', 'motown').pack.rounds[0].questions[0].prompt, 'the motown one');
  assert.notEqual(draftKeyFor('quiz', 'eighties'), draftKeyFor('quiz', 'motown'));
});

test('a quiz and a bingo pack of the same name are not the same draft', () => {
  globalThis.localStorage = fakeStorage();
  writeDraft('quiz', pack('eighties', 'the quiz'));
  writeDraft('bingo', pack('eighties', 'the bingo'));
  assert.equal(readDraft('quiz', 'eighties').pack.rounds[0].questions[0].prompt, 'the quiz');
  assert.equal(readDraft('bingo', 'eighties').pack.rounds[0].questions[0].prompt, 'the bingo');
});

test('nothing there reads as nothing there', () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(readDraft('quiz', 'never-written'), null);
});

/*
 * A HALF-WRITTEN localStorage ENTRY MUST NOT STOP THE REAL PACK OPENING.
 * Losing a draft is bad; being unable to edit the pack at all is worse.
 */
test('a corrupt draft is treated as no draft rather than thrown', () => {
  globalThis.localStorage = fakeStorage({
    [draftKeyFor('quiz', 'broken')]: '{not json at all',
    [draftKeyFor('quiz', 'empty')]: '{"at":1}',
  });
  assert.equal(readDraft('quiz', 'broken'), null);
  assert.equal(readDraft('quiz', 'empty'), null);
});

test('forgetting one leaves the others alone', () => {
  globalThis.localStorage = fakeStorage();
  writeDraft('quiz', pack('eighties', 'a'));
  writeDraft('quiz', pack('motown', 'b'));
  forgetDraft('quiz', 'eighties');
  assert.equal(readDraft('quiz', 'eighties'), null);
  assert.ok(readDraft('quiz', 'motown'));
});

/*
 * A FULL OR BLOCKED STORE SAYS SO RATHER THAN PRETENDING.
 *
 * The caller has to be able to tell somebody their writing is not being kept —
 * a promise that is quietly not being kept is the whole failure this feature
 * exists to prevent.
 */
test('a browser that refuses to store says false', () => {
  globalThis.localStorage = {
    length: 0, key: () => null, getItem: () => null, removeItem: () => {},
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  assert.equal(writeDraft('quiz', pack('eighties', 'x')), false);
});

test('pruning drops only old drafts, and only drafts', () => {
  const now = Date.UTC(2026, 7, 16);
  const old = now - 40 * 86400000;
  const recent = now - 2 * 86400000;
  globalThis.localStorage = fakeStorage({
    [draftKeyFor('quiz', 'ancient')]: JSON.stringify({ v: 1, at: old, kind: 'quiz', pack: pack('ancient', 'x') }),
    [draftKeyFor('quiz', 'fresh')]: JSON.stringify({ v: 1, at: recent, kind: 'quiz', pack: pack('fresh', 'y') }),
    'musicquiz.bench': '{"kind":"quiz","id":"eighties"}',
    'musicquiz.hostkey': 'devkey',
  });
  assert.equal(pruneDrafts(now), 1);
  assert.equal(readDraft('quiz', 'ancient'), null);
  assert.ok(readDraft('quiz', 'fresh'));
  // Everything else this app keeps on a device is untouched.
  assert.equal(globalThis.localStorage.getItem('musicquiz.bench'), '{"kind":"quiz","id":"eighties"}');
  assert.equal(globalThis.localStorage.getItem('musicquiz.hostkey'), 'devkey');
});

test('a draft written now is not pruned', () => {
  globalThis.localStorage = fakeStorage();
  writeDraft('quiz', pack('eighties', 'x'));
  pruneDrafts();
  assert.ok(readDraft('quiz', 'eighties'));
});
