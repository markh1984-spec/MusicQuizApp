/**
 * Crash recovery.
 *
 * The rule this protects: if the server process dies mid-quiz, it comes back
 * with the teams, the scores and the question it was on. The host does not
 * restart from question one in front of a room.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Store } from '../src/store.js';

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-store-'));
  return { dir, file: path.join(dir, 'nested', 'state.json') };
}

test('a saved state comes back exactly as it went in', () => {
  const { dir, file } = tmpFile();
  try {
    const store = new Store(file);
    const state = { phase: 'question', roundIndex: 2, questionIndex: 4, players: { a: { score: 390 } } };
    store.save(state);
    store.flush();
    assert.deepEqual(new Store(file).load(), state);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no saved state at all is not an error, it is just a fresh start', () => {
  const { dir, file } = tmpFile();
  try {
    assert.equal(new Store(file).load(), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a half-written file is kept aside rather than crashing the boot', () => {
  const { dir, file } = tmpFile();
  try {
    const store = new Store(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"phase":"question","play'); // power cut mid-write
    assert.equal(store.load(), null);
    assert.ok(fs.existsSync(file + '.broken'), 'the unreadable file is preserved');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the write is atomic, so a reader never sees a half-file', () => {
  const { dir, file } = tmpFile();
  try {
    const store = new Store(file);
    store.save({ n: 1 });
    store.flush();
    store.save({ n: 2 });
    store.flush();
    // The temp file is not left lying about.
    assert.equal(fs.existsSync(file + '.tmp'), false);
    assert.deepEqual(new Store(file).load(), { n: 2 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('flush writes whatever the latest state was, not the first one queued', () => {
  const { dir, file } = tmpFile();
  try {
    const store = new Store(file);
    store.save({ questionIndex: 1 });
    store.save({ questionIndex: 2 });
    store.save({ questionIndex: 3 });
    store.flush();
    assert.deepEqual(new Store(file).load(), { questionIndex: 3 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('flushing with nothing pending does nothing and does not throw', () => {
  const { dir, file } = tmpFile();
  try {
    const store = new Store(file);
    assert.doesNotThrow(() => store.flush());
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a debounced save still lands on its own', async () => {
  const { dir, file } = tmpFile();
  try {
    const store = new Store(file);
    store.save({ n: 7 });
    assert.equal(fs.existsSync(file), false, 'not written instantly');
    await new Promise((r) => setTimeout(r, 400));
    assert.deepEqual(new Store(file).load(), { n: 7 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
