/**
 * ONLINE MODE — where rule 8 is deliberately inverted, and nothing else is.
 *
 * In a pub the phone never shows the question text: the room looks up at the
 * projector, and googling is that bit harder. Online there is no projector to
 * look up at — the host is sharing a window in a video call at whatever size
 * somebody's laptop chose — so a player who cannot read the question cannot
 * play at all.
 *
 * That makes this the one mode-specific exception in the whole engine, and the
 * thing worth testing is its EDGES: that it is on when asked for and off
 * otherwise, that it survives a restart, that it never leaks an answer, and
 * that a pub night is byte-for-byte what it always was.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES } from '../src/engine.js';

const quiz = () => ({
  id: 'online-test',
  title: 'An Online Test Quiz',
  rounds: [
    {
      title: 'Round One',
      type: 'text',
      questions: [
        {
          prompt: 'Which band released Rumours in 1977?',
          options: ['Fleetwood Mac', 'The Eagles', 'Abba', 'Queen'],
          correctIndex: 0,
          note: 'A host note nobody else may ever see',
          answerNote: 'It sold forty million copies',
        },
      ],
    },
  ],
});

/** A game sitting on a live question, with one player in it. */
function playing({ online = false } = {}) {
  let t = 1_000_000;
  const engine = new Engine({ quiz: quiz(), now: () => t });
  engine.state.online = online;
  const { id } = engine.join('Rob');
  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();
  return { engine, id, tick: (ms) => { t += ms; } };
}

test('a PUB night still shows the phone no question text at all', () => {
  const { engine, id } = playing({ online: false });
  const view = engine.playerView(id);
  assert.equal(view.online, false);
  assert.equal(view.prompt, undefined, 'rule 8: the words are on the projector');
  assert.ok(Array.isArray(view.options) && view.options.length === 4, 'the options are still there');
});

test('an ONLINE night puts the question on the phone', () => {
  const { engine, id } = playing({ online: true });
  const view = engine.playerView(id);
  assert.equal(view.online, true);
  assert.equal(view.prompt, 'Which band released Rumours in 1977?');
  assert.deepEqual(view.options, ['Fleetwood Mac', 'The Eagles', 'Abba', 'Queen']);
});

/*
 * The whole safety of the exception is that it can only ever show what the
 * PROJECTOR shows — which is a payload already built field by field from a
 * whitelist and already pointed at a room full of people. If it ever grew a
 * list of its own, a new sensitive field would leak here by being forgotten.
 */
test('IT NEVER CARRIES AN ANSWER KEY, ONLINE OR NOT', () => {
  for (const online of [false, true]) {
    const { engine, id } = playing({ online });
    const view = engine.playerView(id);
    const json = JSON.stringify(view);
    assert.equal(view.correctIndex, undefined, `correctIndex leaked (online=${online})`);
    assert.equal(view.correctIndexes, undefined, `correctIndexes leaked (online=${online})`);
    assert.equal(view.note, undefined, `the host note leaked (online=${online})`);
    assert.equal(view.answerNote, undefined, `the answer note leaked (online=${online})`);
    assert.ok(!json.includes('A host note nobody else may ever see'), `host note in the payload (online=${online})`);
    assert.ok(!json.includes('forty million'), `answer note in the payload (online=${online})`);
  }
});

/*
 * A picture is zoomed, pixelated, blurred or behind tiles for most of its
 * twenty seconds, and that curve IS how many points the question is worth. The
 * finished image on the phone would make the round a giveaway and quietly
 * worth more than every other round in the pack.
 */
test('the PICTURE is held back even online, because the reveal curve is the scoring', () => {
  let t = 1_000_000;
  const pack = quiz();
  pack.rounds[0] = {
    title: 'Whose face is this',
    type: 'image',
    questions: [{
      prompt: 'Who is this?',
      image: 'portraits/madonna.png',
      options: ['Madonna', 'Cher', 'Kylie', 'Adele'],
      correctIndex: 0,
    }],
  };
  const engine = new Engine({ quiz: pack, now: () => t });
  engine.state.online = true;
  const { id } = engine.join('Rob');
  engine.start();
  while (engine.state.phase !== PHASES.QUESTION) engine.next();

  const view = engine.playerView(id);
  assert.equal(view.prompt, 'Who is this?');
  assert.equal(view.image, undefined, 'the finished picture would be the answer');
  // But the fields that DRIVE the effect are there, so porting the animation
  // to the phone is one line rather than a new payload.
  assert.ok(view.reveal, 'the effect is named, ready for the phone to run it');
  assert.equal(typeof view.zoomFrom, 'number');
});

test('the screen and the host are unchanged by the mode', () => {
  const pub = playing({ online: false });
  const online = playing({ online: true });
  // Same clock, same question, so the two payloads are comparable.
  assert.deepEqual(
    JSON.parse(JSON.stringify(online.engine.screenView())),
    JSON.parse(JSON.stringify(pub.engine.screenView())),
    'the projector is the projector whichever kind of night it is',
  );
});

/*
 * The lesson the card shape and the seasonal look both taught the hard way: a
 * SIGKILL mid-round must not bring the game back as the other kind of night —
 * here, with the question suddenly missing off every phone.
 */
test('IT SURVIVES A CRASH, because it lives in the state', () => {
  const { engine, id } = playing({ online: true });
  const onDisk = JSON.parse(JSON.stringify(engine.state));
  const back = new Engine({ quiz: quiz(), state: onDisk, now: () => 1_000_000 });
  assert.equal(back.state.online, true);
  assert.equal(back.playerView(id).prompt, 'Which band released Rumours in 1977?');
});

test('a state written before online mode existed is a PUB night', () => {
  const { engine, id } = playing({ online: false });
  const old = JSON.parse(JSON.stringify(engine.state));
  delete old.online; // exactly what every state file on disk looks like today
  const back = new Engine({ quiz: quiz(), state: old, now: () => 1_000_000 });
  const view = back.playerView(id);
  assert.equal(view.online, false);
  assert.equal(view.prompt, undefined);
});
