/**
 * THE FLIGHT RECORDER AND THE SELF-TEST — `src/flight.js`, `src/self-test.js`.
 *
 * The recorder is what gets read when a night has gone wrong, so the tests
 * are about the reading: a room sees its own lines and the server-wide
 * failures and nothing of another room's; the text is one line per entry;
 * a control character cannot break a line; the console wrap files a
 * `[tag]` under that tag; the mirror file's tail comes back after a restart.
 *
 * The self-test is run for real against the repository's own packs, so a
 * pack change that breaks a launch fails here before it fails at boot.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Flight, clean } from '../src/flight.js';
import { runSelfTest, selfTestResult } from '../src/self-test.js';
import { config } from '../src/config.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'flight-test-'));

test('clean() makes one printable line and caps it', () => {
  assert.equal(clean('a\u0000b\tc\nd', 100), 'a b c d');
  assert.equal(clean('x'.repeat(50), 10).length, 10);
  assert.equal(clean({ a: 1 }, 100), '{"a":1}');
  assert.equal(clean(new Error('boom'), 100).startsWith('Error: boom'), true);
});

test('a room reads its own lines plus the server-wide failures, never another room', () => {
  const f = new Flight(null, { now: () => 1000 });
  f.note('boot', 'up');
  f.note('http', '401 GET /api/library', { level: 'warn' });          // global, warn: not shared
  f.note('launch', 'Launched quiz "80s"', { room: 'r1' });
  f.note('press', 'reveal refused', { room: 'r2', level: 'warn' });
  f.note('server', 'uncaught: kaboom', { level: 'fail' });             // global fail: shared
  f.note('selftest', 'passed', {});
  const r1 = f.recent({ room: 'r1' }).map((e) => e.kind);
  assert.deepEqual(r1, ['boot', 'launch', 'server', 'selftest']);
  const r2 = f.recent({ room: 'r2' }).map((e) => e.kind);
  assert.deepEqual(r2, ['boot', 'press', 'server', 'selftest']);
  assert.equal(f.recent({ all: true }).length, 6);
  assert.equal(f.recent({ room: 'r1', limit: 2 }).length, 2);
});

test('the ring forgets the oldest and the text is one line per entry, oldest first', () => {
  const f = new Flight(null, { limit: 3, now: () => Date.UTC(2026, 8, 18, 20, 5, 7) });
  for (let i = 0; i < 5; i += 1) f.note('k', `line ${i}`, { room: 'r' });
  const got = f.recent({ room: 'r' }).map((e) => e.msg);
  assert.deepEqual(got, ['line 2', 'line 3', 'line 4']);
  const text = Flight.text(f.recent({ room: 'r' }));
  assert.equal(text.split('\n').length, 3);
  assert.match(text.split('\n')[0], /^\d\d:\d\d:\d\d {6}k {9}\[r\] line 2$/);
  const fail = new Flight(null, { now: () => 0 });
  fail.note('http', '500 POST /api/x', { level: 'fail', data: 'boom' });
  assert.match(Flight.text(fail.all()), / FAIL http {6}500 POST \/api\/x {2}— boom$/);
});

test('captureConsole files a [tag] line under that tag and still prints it', () => {
  const f = new Flight(null, { now: () => 0 });
  const realWarn = console.warn;
  const realError = console.error;
  const printed = [];
  console.warn = (...a) => printed.push(['warn', ...a]);
  console.error = (...a) => printed.push(['error', ...a]);
  try {
    f.captureConsole();
    console.warn('[backup] could not reach GitHub:', 'timeout');
    console.error('plain failure', new Error('x'));
    const [a, b] = f.all();
    assert.equal(a.kind, 'backup');
    assert.equal(a.level, 'warn');
    assert.equal(a.msg, 'could not reach GitHub: timeout');
    assert.equal(b.kind, 'error');
    assert.equal(b.level, 'fail');
    assert.equal(printed.length, 2, 'the originals still print');
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }
});

test('the mirror file comes back after a restart, tail only, and a torn last line is skipped', async () => {
  const dir = tmp();
  const file = path.join(dir, 'flight.jsonl');
  const f = new Flight(file, { limit: 4, now: () => 5 });
  for (let i = 0; i < 6; i += 1) f.note('k', `n${i}`);
  await f.flush();
  fs.appendFileSync(file, '{"at":5,"kind":"k","msg":"torn');
  const again = new Flight(file, { limit: 4 }).load();
  assert.deepEqual(again.all().map((e) => e.msg), ['n2', 'n3', 'n4', 'n5']);
  assert.equal(again.seq, 4);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the self-test plays a night against the real packs and passes', async () => {
  const result = await runSelfTest({ config });
  assert.equal(result.ok, true, JSON.stringify(result.failed));
  assert.ok(result.steps >= 10, `only ${result.steps} steps`);
  assert.ok(result.ms < 5000, `${result.ms}ms is too slow for a boot`);
  assert.equal(selfTestResult(), result);
  const names = result.detail.map((s) => s.name);
  assert.ok(names.includes('the host sees the answer and the projector does not'), 'rule 1 is not asked');
  assert.ok(names.includes('the state survives a reload'), 'crash recovery is not asked');
});

test('the self-test reports a failure as a result, never a throw', async () => {
  const result = await runSelfTest({ config: { ...config, quizDir: path.join(tmp(), 'nowhere') } });
  assert.equal(result.ok, false);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0], /a quiz pack is on this disk/);
});
