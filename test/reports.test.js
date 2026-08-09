/**
 * Corrections on a question.
 *
 * The packs are read-only to a quizmaster on purpose. This is the other half of
 * that: they cannot change a question, and they can always tell you about one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Reports, MAX_REPORTS } from '../src/reports.js';

function book(now = () => 1000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reports-'));
  return {
    reports: new Reports(path.join(dir, 'reports.json'), now),
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

const one = (extra = {}) => ({
  packId: 'eighties', roundIndex: 0, questionIndex: 2, questionId: 'q3',
  prompt: 'How old is Harry Styles?', answer: '30', by: 'Rob', ...extra,
});

test('a report keeps a COPY of the question, not just a pointer', () => {
  // By the time anybody reads it the pack may have been edited or reordered. A
  // report that only said "round 1 question 3" would send you confidently to
  // whatever is sitting there now, which is worse than no report at all.
  const { reports, cleanup } = book();
  try {
    const { report } = reports.add(one());
    assert.equal(report.prompt, 'How old is Harry Styles?');
    assert.equal(report.answer, '30');
    assert.equal(report.packId, 'eighties');
    assert.equal(report.by, 'Rob');
    assert.equal(report.status, 'open');
  } finally {
    cleanup();
  }
});

test('the same person reporting the same question twice is one report', () => {
  // A laggy phone on pub wifi invites a second tap — the same reason the
  // control view ignores a repeated action. A list with one question in it
  // three times is a list you stop reading.
  const { reports, cleanup } = book();
  try {
    reports.add(one());
    const second = reports.add(one());
    assert.equal(second.already, true);
    assert.equal(reports.all().length, 1);
  } finally {
    cleanup();
  }
});

test('but two different people reporting it is two reports', () => {
  // Two hosts hitting the same question is evidence, not noise.
  const { reports, cleanup } = book();
  try {
    reports.add(one({ by: 'Rob' }));
    reports.add(one({ by: 'James' }));
    assert.equal(reports.all().length, 2);
  } finally {
    cleanup();
  }
});

test('a report with no pack is refused rather than filed as a mystery', () => {
  const { reports, cleanup } = book();
  try {
    assert.equal(reports.add({ prompt: 'something' }).ok, false);
    assert.equal(reports.all().length, 0);
  } finally {
    cleanup();
  }
});

test('dealing with one takes it off the list without deleting it', () => {
  const { reports, cleanup } = book();
  try {
    const { report } = reports.add(one());
    assert.equal(reports.open().length, 1);
    assert.equal(reports.setStatus(report.id, 'done'), true);
    assert.equal(reports.open().length, 0);
    assert.equal(reports.all().length, 1, 'the record is kept');
    assert.equal(reports.setStatus(report.id, 'open'), true, 'and can be reopened');
    assert.equal(reports.open().length, 1);
  } finally {
    cleanup();
  }
});

test('a nonsense status is refused', () => {
  const { reports, cleanup } = book();
  try {
    const { report } = reports.add(one());
    assert.equal(reports.setStatus(report.id, 'maybe'), false);
    assert.equal(reports.find(report.id).status, 'open');
  } finally {
    cleanup();
  }
});

test('when it fills up, the ones already dealt with go first', () => {
  // An open report is somebody waiting for an answer. Dropping one of those to
  // make room for a newer one would lose the very thing this exists to collect.
  let t = 1000;
  const { reports, cleanup } = book(() => t++);
  try {
    const { report } = reports.add(one({ questionId: 'keep-me' }));
    reports.setStatus(report.id, 'done');
    for (let i = 0; i < MAX_REPORTS + 5; i++) reports.add(one({ questionId: `q${i}`, by: `Host ${i}` }));
    assert.equal(reports.all().length, MAX_REPORTS);
    assert.equal(reports.find(report.id), null, 'the resolved one went first');
    assert.equal(reports.open().length, MAX_REPORTS, 'every open one survived');
  } finally {
    cleanup();
  }
});

test('reports survive a restart, and a backup only lands in an empty file', () => {
  const { reports, dir, cleanup } = book();
  try {
    reports.add(one());
    const backup = reports.serialise();

    const file = path.join(dir, 'reports.json');
    fs.rmSync(file);                       // the deploy
    const fresh = new Reports(file);
    assert.equal(fresh.all().length, 0);
    assert.equal(fresh.restore(backup).ok, true);
    assert.equal(fresh.all().length, 1);

    // Never over something already here.
    assert.equal(fresh.restore(backup).reason, 'already_have_reports');
    // And never believed if it is rubbish.
    const empty = new Reports(path.join(dir, 'other.json'));
    assert.equal(empty.restore('not json').ok, false);
  } finally {
    cleanup();
  }
});
