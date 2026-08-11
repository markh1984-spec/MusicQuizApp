/**
 * Who is knocking, and whether to open the door.
 *
 * The join code is on the projector and read out on the mic, so everybody in
 * the room has it — and joining is an ordinary web request, so anybody bored
 * can fire a few hundred from a phone browser. Measured against a running
 * server: 300 joins landed in half a second.
 *
 * The tests that matter are not about the threshold, which is a number that
 * will move. They are about the three properties that make this safe to have
 * on at a gig: it never refuses, a reconnection storm is not a flood, and one
 * tap lets a real room through.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { JoinGate, BURST, WINDOW_MS, LET_IN_MS } from '../src/joins.js';

function gate() {
  const clock = { at: 1_700_000_000_000 };
  return { g: new JoinGate(() => clock.at), clock };
}

test('an ordinary trickle of phones is never touched', () => {
  const { g, clock } = gate();
  for (let i = 0; i < 200; i++) {
    clock.at += 1000;                       // one a second, all night
    assert.equal(g.ask({ who: `p${i}` }).ok, true, `held a phone at ${i}`);
  }
  assert.equal(g.waitingCount(), 0);
});

/*
 * **A room told to scan gets in.** Sixty people take twenty to sixty seconds —
 * they have to find the camera and type a name — so the peak is a handful a
 * second, which is two orders of magnitude below a script.
 */
test('a room of sixty scanning at once all get through', () => {
  const { g, clock } = gate();
  let held = 0;
  for (let i = 0; i < 60; i++) {
    clock.at += 400;                        // 2.5 a second for 24 seconds
    if (!g.ask({ who: `p${i}` }).ok) held++;
  }
  assert.equal(held, 0, `${held} of a real room were held at the door`);
});

/*
 * The online case, which is the bigger burst: two hundred people click a link
 * in a channel at the same moment. They still have to type a name, so it lands
 * around ten a second — and that has to get through, because holding two
 * hundred people at once is exactly the outage this must not cause.
 */
test('two hundred people online, clicking a link at once, all get through', () => {
  const { g, clock } = gate();
  let held = 0;
  for (let i = 0; i < 200; i++) {
    clock.at += 100;                        // 10 a second for 20 seconds
    if (!g.ask({ who: `p${i}` }).ok) held++;
  }
  assert.equal(held, 0, `${held} of a 200-person online room were held at the door`);
});

/*
 * A script fires far more than a room can, so it is stopped — but note what
 * gets through first. The threshold is deliberately LOOSE (see BURST), so some
 * junk lands before the door shuts. That is the cheap direction: those teams
 * are one tap to tidy and no player ever sees them, where a threshold tight
 * enough to catch the first one would sometimes hold a real room at the door
 * while the host is on a mic.
 */
test('a script is stopped, and the host is told somebody is knocking', () => {
  const { g } = gate();
  let inside = 0; let held = 0;
  for (let i = 0; i < 2000; i++) (g.ask({ who: `bot${i}` }).ok ? inside++ : held++);
  assert.equal(inside, BURST, `${inside} scripted joins landed before the door shut`);
  assert.ok(held > 1800, `only ${held} of 2000 were held`);
  assert.ok(g.waitingCount() > 100, 'the host is not shown a number big enough to judge by');
});

/**
 * **THE ONE THAT WOULD BE A SELF-INFLICTED OUTAGE.**
 *
 * A restart, a redeploy or a wifi blip sends every phone in the room back at
 * once — two hundred reconnects in a few seconds, which looks exactly like a
 * flood. Holding them would put a "just a moment" screen in front of a whole
 * room mid-quiz.
 *
 * A rejoin carries a token, so it is provably somebody already in the game.
 * Only joins that would create a NEW player are ever counted.
 */
test('A RECONNECTION STORM IS NOT A FLOOD', () => {
  const { g } = gate();
  for (let i = 0; i < 500; i++) {
    assert.equal(g.ask({ known: true, who: `back${i}` }).ok, true, `a returning phone was held at ${i}`);
  }
  assert.equal(g.waitingCount(), 0, 'returning phones were counted as knocking');
  // And they have not used up the room's allowance either.
  assert.equal(g.ask({ who: 'a genuinely new phone' }).ok, true);
});

test('one tap lets everybody in, and keeps the door open while the rest arrive', () => {
  const { g, clock } = gate();
  for (let i = 0; i < 200; i++) g.ask({ who: `p${i}` });
  assert.ok(g.waitingCount() > 0);

  const done = g.letThemIn();
  assert.ok(done.letIn > 0, 'nobody was let in');
  assert.equal(g.waitingCount(), 0);

  // The rest of a big room turning up in the next minute is not held again.
  for (let i = 0; i < 300; i++) assert.equal(g.ask({ who: `late${i}` }).ok, true);
  // …and once the minute is up, the guard is back.
  clock.at += LET_IN_MS + 1;
  let held = 0;
  for (let i = 0; i < 300; i++) if (!g.ask({ who: `later${i}` }).ok) held++;
  assert.ok(held > 0, 'the door stayed open for good');
});

test('a burst that stops is forgotten, so the next one starts fresh', () => {
  const { g, clock } = gate();
  for (let i = 0; i < BURST + 20; i++) g.ask({ who: `p${i}` });
  clock.at += WINDOW_MS + 1;
  assert.equal(g.ask({ who: 'somebody new' }).ok, true, 'the window never clears');
});

test('one phone asking ten times is one person waiting, not ten', () => {
  const { g } = gate();
  for (let i = 0; i < BURST + 5; i++) g.ask({ who: `p${i}` });
  const before = g.waitingCount();
  for (let i = 0; i < 10; i++) g.ask({ who: 'the same phone retrying' });
  assert.equal(g.waitingCount(), before + 1, 'retries are being counted as separate people');
});

test('a fresh game starts with nobody knocking', () => {
  const { g } = gate();
  for (let i = 0; i < 200; i++) g.ask({ who: `p${i}` });
  g.reset();
  assert.equal(g.waitingCount(), 0);
  assert.equal(g.ask({ who: 'first of the night' }).ok, true);
});
