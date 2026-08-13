/**
 * The restart notice, and the one state that makes it a lie.
 *
 * "The app restarted — scores from before are gone, tap a name to put their
 * points back" is exactly right for the case it was written for: a crash
 * mid-round, phones putting themselves back on their own, and the whole room
 * suddenly on nothing. From the front that looks like a scoring bug rather
 * than what it is.
 *
 * It is FALSE the moment the host launches on purpose. The new night starts at
 * zero because that is what launching means, there is nothing to put back, and
 * the sentence is built out of a phone count belonging to a game that no
 * longer exists. Found on a gig day, across the top of a control view driving
 * a night that was running perfectly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Session } from '../src/session.js';
import { Store } from '../src/store.js';

function withApp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restart-'));
  const quizDir = path.join(dir, 'quizzes');
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(quizDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(quizDir, 'plain.json'), JSON.stringify({
    id: 'plain', title: 'A Quiz', questionSeconds: 20,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
      { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  }));
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

test('a phone holding an id from a game this process never saw is counted as stranded', () => {
  withApp((app) => {
    const session = open(app);
    session.launch('quiz', 'plain');
    // A launch clears the count, so strand one AFTER it — which is the real
    // order: the app comes back, the host does nothing, the phones return.
    session.strandedPhones = 0;
    session.joinPlayer({ playerId: 'a-phone-from-before', name: 'Rob' });
    assert.equal(session.hostView().server.strandedPhones, 1,
      'the control view has nothing to build the restart notice out of');
  });
});

test('A DELIBERATE LAUNCH CLEARS THE RESTART NOTICE', () => {
  withApp((app) => {
    const session = open(app);
    session.strandedPhones = 0;
    session.joinPlayer({ playerId: 'a-phone-from-before', name: 'Rob' });
    assert.equal(session.hostView().server.strandedPhones, 1, 'stranded, as it should be');

    // The host launches on purpose. Everybody is at zero because that is what
    // launching means — nothing was lost and there is nothing to put back.
    session.launch('quiz', 'plain');
    assert.equal(session.hostView().server.strandedPhones, 0,
      'the notice would sit across the control view for twenty minutes telling '
      + 'a working game it had lost scores it never had');
  });
});
