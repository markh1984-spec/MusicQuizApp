/**
 * The breakout round — a laugh, not a question. See TODO.md, "BREAKOUT GAMES".
 *
 * No right answer, no score, and a host-only screen that lists every answer
 * for the mic — never the projector, never anybody else's phone. The rest of
 * the machinery (the clock, the round count, "who's still to answer") must
 * keep working without needing to know this round type exists.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Engine, PHASES, cleanTeamName } from '../src/engine.js';

const START = 1_700_000_000_000;

function breakoutQuiz() {
  return {
    id: 'break', title: 'Breakout Test', questionSeconds: 20,
    rounds: [
      {
        id: 'r1', type: 'text', title: 'Round One',
        questions: [
          { id: 'q1', prompt: 'A real question?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
        ],
      },
      {
        id: 'r2', type: 'breakout', title: 'Bonus Round',
        questions: [
          { id: 'q2', prompt: 'Finish the lyric: "I will always love ___"' },
          { id: 'q3', prompt: 'Worst tribute band name?' },
        ],
      },
      {
        id: 'r3', type: 'text', title: 'Round Three',
        questions: [
          { id: 'q4', prompt: 'Another real question?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
        ],
      },
    ],
  };
}

function makeEngine(quiz = breakoutQuiz()) {
  const time = { now: START };
  const engine = new Engine({ quiz, now: () => time.now });
  return { engine, time, advance(ms) { time.now += ms; } };
}

function toRound(engine, roundIndex) {
  engine.start();
  for (let i = 0; i < 20 && (engine.state.phase !== PHASES.QUESTION || engine.state.roundIndex !== roundIndex); i++) {
    engine.next();
  }
  if (engine.state.phase !== PHASES.QUESTION || engine.state.roundIndex !== roundIndex) {
    throw new Error('never reached that round');
  }
}

function startedBreakout() {
  const h = makeEngine();
  const a = h.engine.join({ name: 'Team A' });
  const b = h.engine.join({ name: 'Team B' });
  toRound(h.engine, 1);
  return { ...h, a, b };
}

// -------------------------------------------------------------- validation

test('a breakout question validates with just an id and a prompt', async () => {
  const { validateQuiz } = await import('../src/quizzes.js');
  const errors = validateQuiz(breakoutQuiz());
  assert.deepEqual(errors, []);
});

test('breakout is in the round type whitelist, and a pack of only breakout rounds is recognised as one', async () => {
  const { ROUND_TYPES, isBreakoutPack } = await import('../src/quizzes.js');
  assert.ok(ROUND_TYPES.includes('breakout'));
  assert.equal(isBreakoutPack({ rounds: [{ type: 'breakout' }] }), true);
  assert.equal(isBreakoutPack({ rounds: [{ type: 'breakout' }, { type: 'text' }] }), false);
  assert.equal(isBreakoutPack({ rounds: [] }), false);
  assert.equal(isBreakoutPack({}), false);
});

// -------------------------------------------------------------- answering

test('a typed answer is accepted and stored, cleaned exactly like a team name', () => {
  const { engine, a } = startedBreakout();
  const result = engine.answerBreakout(a.id, '  Puppies!! <script>  ');
  assert.equal(result.ok, true);
  const stored = engine.answersFor()[a.id];
  assert.equal(stored.text, cleanTeamName('  Puppies!! <script>  '));
});

test('an empty or whitespace-only answer is refused', () => {
  const { engine, a } = startedBreakout();
  assert.equal(engine.answerBreakout(a.id, '   ').ok, false);
  assert.equal(engine.answerBreakout(a.id, '').ok, false);
  assert.equal(Object.keys(engine.answersFor()).length, 0);
});

test('a long answer is capped the same way a team name is', () => {
  const { engine, a } = startedBreakout();
  const long = 'x'.repeat(80);
  engine.answerBreakout(a.id, long);
  const stored = engine.answersFor()[a.id];
  assert.equal(stored.text, cleanTeamName(long));
  assert.ok(stored.text.length <= 28);
});

test('answering twice on the same question is refused, same as an ordinary answer', () => {
  const { engine, a } = startedBreakout();
  assert.equal(engine.answerBreakout(a.id, 'First').ok, true);
  const second = engine.answerBreakout(a.id, 'Second');
  assert.equal(second.ok, false);
  assert.equal(engine.answersFor()[a.id].text, cleanTeamName('First'));
});

test('an unknown player is refused', () => {
  const { engine } = startedBreakout();
  const result = engine.answerBreakout('not-a-real-id', 'Hello');
  assert.equal(result.ok, false);
});

test('a breakout action on an ordinary round is refused — wrong round type', () => {
  const h = makeEngine();
  const a = h.engine.join({ name: 'Team A' });
  toRound(h.engine, 0); // the ordinary text round
  const result = h.engine.answerBreakout(a.id, 'Nope');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_a_breakout_round');
});

test('answering after the clock has closed is refused, same as every other round', () => {
  const { engine, a, advance } = startedBreakout();
  advance(25_000); // past the 20-second clock
  const result = engine.answerBreakout(a.id, 'Too late');
  assert.equal(result.ok, false);
});

// -------------------------------------------------------------- no scoring

test('a breakout answer never changes a score, however many teams answer', () => {
  const { engine, a, b } = startedBreakout();
  engine.answerBreakout(a.id, 'Something funny');
  engine.answerBreakout(b.id, 'Something else');
  for (const p of Object.values(engine.state.players)) {
    assert.equal(p.score, 0);
    assert.equal(p.correctCount, 0);
  }
});

test('correctSet and answerText are empty for a breakout question — nothing is right or wrong', () => {
  const { engine } = startedBreakout();
  const q = engine.question();
  const round = engine.round();
  assert.deepEqual(engine.correctSet(q, round), new Set());
  assert.equal(engine.answerText(q, round), '');
});

test('the fastest-finger and option-tally helpers stay harmless on a breakout question', () => {
  const { engine, a, b } = startedBreakout();
  engine.answerBreakout(a.id, 'One');
  engine.answerBreakout(b.id, 'Two');
  assert.equal(engine.fastestFinger(), null);
  assert.deepEqual(engine.optionTally(), []);
  const who = engine.whoPicked();
  assert.deepEqual(who.options, []);
});

// ----------------------------------------------------- the two-screens rule

test('the breakout answers are on the HOST view only — never the screen, never another phone', () => {
  const { engine, a, b } = startedBreakout();
  engine.answerBreakout(a.id, 'Team A says something funny');
  engine.answerBreakout(b.id, 'Team B says something else');

  const host = engine.hostView();
  assert.ok(Array.isArray(host.breakoutAnswers));
  assert.equal(host.breakoutAnswers.length, 2);
  assert.deepEqual(host.breakoutAnswers.map((x) => x.text), ['Team A says something funny', 'Team B says something else']);

  const screen = engine.screenView();
  assert.equal(screen.breakoutAnswers, undefined);
  assert.ok(!JSON.stringify(screen).includes('says something funny'));

  const otherPlayerView = engine.playerView(b.id);
  assert.equal(otherPlayerView.breakoutAnswers, undefined);
  assert.ok(!JSON.stringify(otherPlayerView).includes('says something funny'));
});

test('breakoutAnswers arrives in the order teams answered, not player-id order', () => {
  const { engine, a, b } = startedBreakout();
  engine.answerBreakout(b.id, 'B was first');
  engine.answerBreakout(a.id, 'A was second');
  const host = engine.hostView();
  assert.deepEqual(host.breakoutAnswers.map((x) => x.name), ['Team B', 'Team A']);
});

test('a player who has not answered does not appear in breakoutAnswers', () => {
  const { engine, a } = startedBreakout();
  engine.answerBreakout(a.id, 'Only me');
  const host = engine.hostView();
  assert.equal(host.breakoutAnswers.length, 1);
});

test('your own phone gets its own submitted text back, and only its own', () => {
  const { engine, a, b } = startedBreakout();
  engine.answerBreakout(a.id, 'My funny answer');
  engine.answerBreakout(b.id, "B's answer");
  const mine = engine.playerView(a.id);
  assert.equal(mine.yourAnswer.text, 'My funny answer');
  assert.ok(!JSON.stringify(mine).includes("B's answer"));
});

test('there is no reveal payload on a breakout question — nothing was right or wrong', () => {
  const { engine, a } = startedBreakout();
  engine.answerBreakout(a.id, 'Something');
  engine.reveal();
  assert.equal(engine.playerView(a.id).reveal, undefined);
  assert.equal(engine.screenView().reveal, undefined);
});

// ----------------------------------------------------------- round numbering

test('THE COUNT IS WHAT SCORES: a breakout round is not counted in "Round X of Y"', () => {
  const { engine } = startedBreakout();
  // Round index 1 (the breakout round, second in the array) is unnumbered.
  assert.equal(engine.scoringRoundNumber(1), null);
  // Round index 0 and 2 are the two SCORING rounds, numbered 1 and 2.
  assert.equal(engine.scoringRoundNumber(0), 1);
  assert.equal(engine.scoringRoundNumber(2), 2);
  assert.equal(engine.scoringRoundCount(), 2);
});

test('scoreRoundNumber/scoreRoundCount ride on every view, screen and phone alike', () => {
  const { engine, a } = startedBreakout();
  const host = engine.hostView();
  const screen = engine.screenView();
  const player = engine.playerView(a.id);
  assert.equal(host.scoreRoundNumber, null);
  assert.equal(screen.scoreRoundNumber, null);
  assert.equal(player.scoreRoundNumber, null);
  assert.equal(host.scoreRoundCount, 2);
  assert.equal(screen.scoreRoundCount, 2);
  assert.equal(player.scoreRoundCount, 2);
});

test('a night with no breakout round counts and numbers exactly as it always did', () => {
  const quiz = {
    id: 'plain', title: 'Plain', questionSeconds: 20,
    rounds: [
      { id: 'r1', type: 'text', title: 'One', questions: [{ id: 'q1', prompt: 'P?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }] },
      { id: 'r2', type: 'text', title: 'Two', questions: [{ id: 'q2', prompt: 'P2?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }] },
    ],
  };
  const { engine } = makeEngine(quiz);
  toRound(engine, 0);
  assert.equal(engine.scoringRoundNumber(0), 1);
  assert.equal(engine.scoringRoundNumber(1), 2);
  assert.equal(engine.scoringRoundCount(), 2);
});

/* ------------------------------------------------------------------------
 * FOR REAL, OVER HTTP — the class of bug a unit test cannot catch.
 *
 * CLAUDE.md's own history: a route defined in the wrong handler, or a call
 * with a mismatched action name, reads as a feature and passes every test
 * that only calls `session.runPlayerAction()` directly or reads `server.js`
 * as text. `/api/answer-breakout` is wired through the same array-driven
 * dispatch every other player action uses, but that is exactly the kind of
 * thing worth proving rather than assuming.
 */

const ROOT = new URL('..', import.meta.url).pathname;
const KEY = 'breakout-route-test-key';

async function withServer(run) {
  const dir = mkdtempSync(join(tmpdir(), 'breakout-route-'));
  const port = 4700 + (process.pid % 400);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST_KEY: KEY },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      try {
        await fetch(`${base}/api/state?role=screen`);
        up = true;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(up, 'the server never came up');
    await run(base);
  } finally {
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a breakout round can be built, launched and answered over real HTTP', async () => {
  await withServer(async (base) => {
    // "Compose" — the same scaffold route the console's "write it myself"
    // panel uses, which is the OTHER place `alphabet`-style special-casing
    // lives and the one this feature's own build nearly missed.
    const scaffold = await (await fetch(`${base}/api/mine/quiz/scaffold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ title: 'Breakout HTTP Test', rounds: [{ type: 'breakout', count: 2 }] }),
    })).json();
    assert.equal(scaffold.ok, true, `scaffold failed: ${JSON.stringify(scaffold)}`);

    const launch = await (await fetch(`${base}/api/host/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ game: 'quiz', packId: scaffold.id, replace: true }),
    })).json();
    assert.equal(launch.ok, true, `launch failed: ${JSON.stringify(launch)}`);

    const join = await (await fetch(`${base}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'HTTP Test Team' }),
    })).json();
    const playerId = join.playerId || join.id || (join.you && join.you.id);
    const token = join.token || (join.you && join.you.token);
    assert.ok(playerId, `no player id came back from join: ${JSON.stringify(join).slice(0, 200)}`);

    // Drive the lobby to the first question the same way the control view
    // does — Start, then Next through whatever slides sit in front of it.
    for (let i = 0; i < 10; i++) {
      const state = await (await fetch(`${base}/api/state?role=host`, { headers: { 'X-Host-Key': KEY } })).json();
      if (state.phase === 'question') break;
      const action = state.phase === 'lobby' ? 'start' : 'next';
      await fetch(`${base}/api/host/${action}`, { method: 'POST', headers: { 'X-Host-Key': KEY } });
    }

    const answer = await (await fetch(`${base}/api/answer-breakout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, token, text: 'The funniest possible answer', joinCode: '' }),
    })).json();
    assert.equal(answer.ok, true, `/api/answer-breakout answered ${JSON.stringify(answer)}`);

    // It reached the host — reading them out is the entire feature.
    const host = await (await fetch(`${base}/api/state?role=host`, { headers: { 'X-Host-Key': KEY } })).json();
    assert.ok(
      (host.breakoutAnswers || []).some((a) => a.text === 'The funniest possible answer'),
      `the host never saw the answer: ${JSON.stringify(host.breakoutAnswers)}`,
    );

    // And it did NOT reach the projector.
    const screen = await (await fetch(`${base}/api/state?role=screen`)).json();
    assert.ok(!JSON.stringify(screen).includes('funniest possible answer'), 'a breakout answer leaked onto the projector');
  });
});
